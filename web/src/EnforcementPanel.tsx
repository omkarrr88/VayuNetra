import { useEffect, useMemo, useState } from "react";
import { cellToLatLng } from "h3-js";
import { api, downloadFile } from "./api";
import { cleanRationale, prettyRule } from "./format";
import { Panel, SegBtn, notifyEnforcementChanged } from "./ui";
import { placeForCell } from "./placeName";

type Rec = {
  id: number;
  h3_cell?: string;
  priority_score: number;
  /** Value per inspector-hour, computed by the enforcement agent (agents/enforcement.py). */
  evidence?: {
    value?: {
      value_per_hour: number | null;
      inspector_hours: number;
      share_low?: number;
      pm25_low?: number;
      p_exceed?: number;
      delta_pm25_low?: number;
      benefit_person_ugm3?: number;
      basis: string;
      assumption: string;
    };
  } & Record<string, unknown>;
  contribution: number;
  pop_exposed: number;
  rationale: string;
  status: string;
  closed_at?: string | null;
  closure_finding?: string | null;
  closure_note?: string | null;
  rubric_score?: { total?: number };
};

type LogRow = { from_status: string | null; to_status: string; actor: string | null; note: string | null; finding: string | null; created_at: string };
const FINDING_LABEL: Record<string, string> = {
  violation_found: "violation found", compliant: "compliant", inaccessible: "site inaccessible", not_applicable: "not applicable",
};
const OFFICER_KEY = "vayunetra-officer";

/** Rough km between two H3 cells (equirectangular — fine at city scale). */
function cellKm(a: string, b: string): number | null {
  try {
    const [la1, ln1] = cellToLatLng(a);
    const [la2, ln2] = cellToLatLng(b);
    const x = (ln2 - ln1) * Math.cos(((la1 + la2) / 2) * (Math.PI / 180));
    const y = la2 - la1;
    return Math.sqrt(x * x + y * y) * 111.32;
  } catch {
    return null;
  }
}

type Citation = { rule?: string; url?: string; excerpt?: string; similarity?: number };

type SatellitePatch = {
  title?: string;
  image_ref?: string;
  source_url?: string;
  excerpt?: string;
  similarity?: number;
  metadata?: {
    detection_confidence?: number;
    source_type?: string;
  };
};

type Dossier = {
  rec_id: number;
  rationale?: string;
  contribution_pct?: number;
  pop_exposed?: number;
  citations?: Citation[];
  satellite_patch?: string | SatellitePatch | null;
  suggested_notice_text?: string;
};

function normalizePatch(patch: Dossier["satellite_patch"]): SatellitePatch | null {
  if (!patch) return null;
  if (typeof patch === "string") return { title: "Sentinel-2 patch", image_ref: patch };
  return patch;
}

/** kb-chunk excerpts carry raw document scaffolding (===== rules, ALL-CAPS headers). */
function cleanExcerpt(text: string): string {
  let s = text.replace(/[=_*\-]{4,}/g, " ").replace(/\s+/g, " ").trim();
  // kb chunks carry table headers and SHOUTING section titles mid-excerpt
  // ("ENFORCEMENT ACTIONS AND PENALTIES Violation Type | Penalty …") — cut
  // the excerpt where that debris starts rather than showing it to officers.
  const junk = s.search(/(?:[A-Z][A-Z ]{11,}(?::| [A-Z]))|(?:\S+ \| )/);
  if (junk > 40) s = s.slice(0, junk).trim();
  s = s.replace(/[|•·]\s*$/, "").trim();
  return s.length > 180 ? `${s.slice(0, 180)}…` : s;
}

/** Source category parsed from the rationale's leading clause
 * ("Construction dust contributes…" / "Industrial emissions contributes…"). */
function recCategory(rationale: string): "construction" | "industrial" | "waste" | "other" {
  const r = rationale.toLowerCase();
  if (r.startsWith("construction")) return "construction";
  if (r.startsWith("industrial")) return "industrial";
  if (r.startsWith("waste") || r.includes("open burning")) return "waste";
  return "other";
}

const CATEGORY_LABEL: Record<ReturnType<typeof recCategory>, string> = {
  construction: "Construction dust",
  industrial: "Industrial emissions",
  waste: "Waste / biomass burning",
  other: "Pollution source",
};

const CATEGORY_FILTERS = [
  { id: "all", label: "All" },
  { id: "construction", label: "Construction" },
  { id: "industrial", label: "Industrial" },
  { id: "waste", label: "Waste" },
] as const;

/** Several chunks of one document retrieve as near-identical citations — show each rule once. */
function dedupeCitations(citations: Citation[]): Citation[] {
  const seen = new Set<string>();
  return citations
    .filter((c) => {
      const key = `${prettyRule(c.rule ?? "")}|${cleanExcerpt(c.excerpt ?? "").slice(0, 60)}`;
      if (seen.has(key)) return false;
      seen.add(key);
      return true;
    })
    .slice(0, 3);
}

export default function EnforcementPanel({ city, focusCell }: { city: string; focusCell?: string | null }) {
  const [rows, setRows] = useState<Rec[] | null>(null);
  const [open, setOpen] = useState<number | null>(null);
  const [dossier, setDossier] = useState<Dossier | null>(null);
  const [busy, setBusy] = useState<number | null>(null);
  const [filter, setFilter] = useState<(typeof CATEGORY_FILTERS)[number]["id"]>("all");
  // "Where is my next hour best spent" is the officer's real question, so value-per-hour leads.
  // Selecting a cell on the map used to override the order silently; it is now an explicit third
  // option that defaults on, so the officer can always see and change what the list is sorted by.
  const [order, setOrder] = useState<"value" | "priority" | "nearest">("value");
  useEffect(() => { if (focusCell) setOrder("nearest"); }, [focusCell]);
  const [query, setQuery] = useState("");

  useEffect(() => {
    setRows(null);
    setOpen(null);
    // fetch a wide slice so category filters have something to filter
    api<Rec[]>(`/enforcement?city=${city}&limit=40`).then(setRows).catch(() => setRows([]));
  }, [city]);

  // With a focused hexagon, closest actions come first — the story's step 3.
  // Clusters of near-identical recs (many detected sites in one cell sharing
  // the same contribution/exposure) collapse into one card with a count —
  // a worklist that repeats "44% · 15,000" five times reads as noise.
  const ordered = useMemo(() => {
    if (!rows) return null;
    const q = query.trim().toLowerCase();
    const filtered = rows.filter(
      (r) =>
        (filter === "all" || recCategory(r.rationale) === filter) &&
        (!q || r.rationale.toLowerCase().includes(q)),
    );
    const seen = new Map<string, Rec & { km?: number | null; similar?: number }>();
    for (const r of filtered) {
      const key = `${r.h3_cell ?? "?"}|${Math.round(r.contribution * 100)}|${r.pop_exposed}`;
      const kept = seen.get(key);
      if (kept) kept.similar = (kept.similar ?? 0) + 1;
      else seen.set(key, { ...r });
    }
    const collapsed = [...seen.values()];
    const withKm = focusCell
      ? collapsed.map((r) => ({ ...r, km: r.h3_cell ? cellKm(focusCell, r.h3_cell) : null }))
      : collapsed;
    if (order === "nearest" && focusCell) {
      return [...withKm].sort((a, b) => (a.km ?? 1e9) - (b.km ?? 1e9)).slice(0, 10);
    }
    if (order === "value") {
      // items without a computed value fall to the bottom rather than being dropped
      return [...withKm]
        .sort((a, b) => (b.evidence?.value?.value_per_hour ?? -1) - (a.evidence?.value?.value_per_hour ?? -1))
        .slice(0, 10);
    }
    return withKm.slice(0, 10); // keep the list scannable
  }, [rows, focusCell, filter, query, order]);

  // Place names for the visible items — an officer thinks in wards, not H3 ids.
  const [places, setPlaces] = useState<Record<string, string>>({});
  useEffect(() => {
    let alive = true;
    const cells = Array.from(new Set((ordered ?? []).map((r) => r.h3_cell).filter((c): c is string => !!c)));
    Promise.all(cells.map((c) => placeForCell(city, c).then((p) => [c, p?.label ?? ""] as const).catch(() => [c, ""] as const)))
      .then((pairs) => alive && setPlaces(Object.fromEntries(pairs.filter(([, l]) => l))));
    return () => {
      alive = false;
    };
  }, [ordered, city]);

  function toggleDossier(id: number) {
    if (open === id) {
      setOpen(null);
      return;
    }
    setOpen(id);
    setDossier(null);
    api<Dossier>(`/enforcement/${id}/dossier`).then(setDossier).catch(() => setDossier({ rec_id: id, citations: [] }));
  }

  async function getNotice(id: number) {
    setBusy(id);
    try {
      await downloadFile(`/enforcement/${id}/notice.pdf`, `notice_${id}.pdf`);
    } catch {
      /* swallow — the button just re-enables so the user can retry */
    } finally {
      setBusy(null);
    }
  }

  // Officer actions: proposed → approved → dispatched (or dismissed). Dispatch freezes the
  // cell's 7-day baseline server-side and arms the before/after tracker; the ward queues and
  // the tracker card refetch on the change event.
  const [acting, setActing] = useState<number | null>(null);
  // "Acting as" — the officer's name stamped on every status change (the demo runs without
  // sign-in, so the audit trail records what the console was told; a real deployment binds
  // this to the authenticated user).
  const [officer, setOfficer] = useState<string>(() => { try { return localStorage.getItem(OFFICER_KEY) ?? ""; } catch { return ""; } });
  useEffect(() => { try { localStorage.setItem(OFFICER_KEY, officer); } catch { /* ignore */ } }, [officer]);
  const [closing, setClosing] = useState<number | null>(null);
  const [finding, setFinding] = useState<string>("violation_found");
  const [closeNote, setCloseNote] = useState<string>("");
  const [logFor, setLogFor] = useState<number | null>(null);
  const [log, setLog] = useState<LogRow[] | null>(null);

  async function setStatus(id: number, status: "approved" | "dispatched" | "dismissed" | "closed", extra?: { finding?: string; note?: string }) {
    setActing(id);
    try {
      await api(`/enforcement/${id}/status`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ status, actor: officer.trim() || undefined, ...(extra ?? {}) }),
      });
      setRows((prev) => (prev ? prev.map((r) => (r.id === id ? { ...r, status, ...(status === "closed" ? { closed_at: new Date().toISOString(), closure_finding: extra?.finding ?? null, closure_note: extra?.note ?? null } : {}) } : r)) : prev));
      notifyEnforcementChanged();
      if (status === "closed") { setClosing(null); setCloseNote(""); }
      if (logFor === id) void showLog(id);
    } catch {
      /* the button re-enables; the status chip stays as it was */
    } finally {
      setActing(null);
    }
  }

  async function showLog(id: number) {
    if (logFor === id) { setLogFor(null); return; }
    setLogFor(id);
    setLog(null);
    try {
      const d = await api<{ log: LogRow[] }>(`/enforcement/${id}/log`);
      setLog(d.log ?? []);
    } catch {
      setLog([]);
    }
  }

  return (
    <Panel
      title="Enforcement Worklist"
      right={
        <span role="group" aria-label="Order the worklist" className="flex items-center gap-1">
          <SegBtn active={order === "value"} onClick={() => setOrder("value")}
            title="Conservative exposure reduction per inspector-hour: (share × confidence) × the conformal lower bound of the +24 h forecast × residents exposed × (1 + 3 × P(>120 µg/m³)), divided by the hours the inspection is assumed to take.">
            per hour
          </SegBtn>
          <SegBtn active={order === "priority"} onClick={() => setOrder("priority")}
            title="Contribution × exposure × actionability × confidence — how big the source is, regardless of what acting on it costs.">
            by size
          </SegBtn>
          {focusCell && (
            <SegBtn active={order === "nearest"} onClick={() => setOrder("nearest")}
              title="Nearest to the cell selected on the map">
              nearest
            </SegBtn>
          )}
        </span>
      }
    >
      <div className="flex flex-wrap items-center gap-1.5">
        {CATEGORY_FILTERS.map((f) => (
          <button
            key={f.id}
            onClick={() => setFilter(f.id)}
            className={`rounded-md px-2 py-1 text-xs font-medium transition-colors ${
              filter === f.id ? "bg-blue-600 text-white shadow-sm" : "bg-slate-100 text-slate-600 hover:bg-slate-200"
            }`}
          >
            {f.label}
          </button>
        ))}
        <input
          type="search"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder="Search recommendations…"
          aria-label="Search enforcement recommendations"
          className="min-w-[9rem] flex-1 rounded-md border border-slate-200 bg-slate-50 px-2 py-1 text-xs text-slate-700 placeholder:text-slate-500 focus:outline-none focus:ring-2 focus:ring-blue-400"
        />
        <label className="flex items-center gap-1 text-[11px] text-slate-500" title="Stamped on every approve / dispatch / close in the audit trail">
          acting as
          <input
            type="text"
            value={officer}
            onChange={(e) => setOfficer(e.target.value)}
            placeholder="officer name"
            maxLength={80}
            aria-label="Acting officer name"
            className="w-28 rounded-md border border-slate-200 bg-white px-1.5 py-1 text-xs text-slate-700 placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-blue-400"
          />
        </label>
      </div>

      {ordered === null ? (
        <div className="mt-2 space-y-2">
          {[0, 1, 2].map((i) => (
            <div key={i} className="h-16 animate-pulse rounded-md bg-slate-100" />
          ))}
        </div>
      ) : (
        <div className="mt-2 space-y-2">
          {ordered.map((r: Rec & { km?: number | null; similar?: number }) => (
            <div
              key={r.id}
              className={`rounded-lg border p-2.5 transition-colors ${
                focusCell && r.h3_cell === focusCell ? "border-blue-400 bg-blue-50/50" : "border-slate-200 hover:border-slate-300"
              }`}
            >
              <div className="flex flex-wrap items-center justify-between gap-x-2 gap-y-0.5">
                <span className="min-w-0 truncate font-semibold text-slate-800" title={(r.h3_cell && places[r.h3_cell]) || "About 1 km² of this city"}>
                  {CATEGORY_LABEL[recCategory(r.rationale)] ?? "Source"}
                  {r.h3_cell && places[r.h3_cell] ? <span className="font-normal text-slate-500"> · {places[r.h3_cell]}</span> : null}
                </span>
                <span className="flex items-center gap-1.5 whitespace-nowrap text-xs text-slate-500">
                  {focusCell && r.h3_cell === focusCell && (
                    <span className="rounded bg-blue-600 px-1 py-0.5 text-[11px] font-semibold text-white">📍 this cell</span>
                  )}
                  {focusCell && r.h3_cell !== focusCell && typeof r.km === "number" && (
                    <span className="text-[11px] text-slate-500">~{r.km < 1 ? "<1" : Math.round(r.km)} km</span>
                  )}
                  {(() => {
                    const v = r.evidence?.value;
                    if (!v || v.value_per_hour === null || v.value_per_hour === undefined) return null;
                    return (
                      <>
                        <span
                          className="rounded bg-emerald-50 px-1.5 py-0.5 text-[11px] font-bold text-emerald-700"
                          title={[
                            `Conservative exposure reduction per inspector-hour.`,
                            `share × confidence = ${((v.share_low ?? 0) * 100).toFixed(1)}%`,
                            `× forecast lower bound ${v.pm25_low} µg/m³ = ${v.delta_pm25_low} µg/m³ attributable`,
                            `× ${r.pop_exposed.toLocaleString("en-IN")} residents × P(>120) ${((v.p_exceed ?? 0) * 100).toFixed(0)}%`,
                            `÷ ${v.inspector_hours} inspector-hours (assumed)`,
                            ``,
                            v.basis,
                            v.assumption,
                          ].join("\n")}
                        >
                          {v.value_per_hour >= 1000 ? `${Math.round(v.value_per_hour / 1000)}k` : Math.round(v.value_per_hour)}/hr
                        </span>
                        <span className="text-slate-400">·</span>
                        <span className="text-[11px] text-slate-500" title="Hours this inspection is assumed to take — the team's estimate, not a measured figure">
                          {v.inspector_hours}h
                        </span>
                        <span className="text-slate-400">·</span>
                      </>
                    );
                  })()}
                  <span title="Priority = contribution × exposure × actionability × confidence">priority {Math.round(r.priority_score * 100)}</span>
                  <span className="text-slate-400">·</span>
                  <span title="Evidence rubric out of 10">rubric {r.rubric_score?.total ?? "--"}/10</span>
                </span>
              </div>
              <div className="mt-1 text-xs leading-5 text-slate-700">{cleanRationale(r.rationale)}</div>
              <div className="mt-1 text-xs text-slate-500">
                {Math.round(r.contribution * 100)}% contribution · {(r.pop_exposed ?? 0).toLocaleString()} exposed
                {(r.similar ?? 0) > 0 && (
                  <span
                    className="ml-1.5 rounded bg-slate-100 px-1.5 py-0.5 text-[11px] font-medium text-slate-600"
                    title="Other detected sites in this same cell with matching contribution/exposure — one inspection visit covers the cluster"
                  >
                    +{r.similar} similar site{r.similar! > 1 ? "s" : ""} here
                  </span>
                )}
              </div>
              <div className="mt-2 flex flex-wrap items-center gap-2">
                <button
                  onClick={() => toggleDossier(r.id)}
                  className={`rounded px-2 py-1 text-xs ${
                    open === r.id ? "bg-slate-700 text-white" : "bg-slate-200 text-slate-700 hover:bg-slate-300"
                  }`}
                >
                  {open === r.id ? "Hide dossier" : "Evidence dossier"}
                </button>
                <button
                  onClick={() => getNotice(r.id)}
                  disabled={busy === r.id}
                  className="rounded bg-blue-600 px-2 py-1 text-xs text-white hover:bg-blue-700 disabled:opacity-50"
                >
                  {busy === r.id ? "Generating…" : "Notice PDF"}
                </button>
                <span className="mx-0.5 h-4 w-px bg-slate-200" aria-hidden="true" />
                {r.status === "proposed" && (
                  <>
                    <button
                      onClick={() => setStatus(r.id, "approved")}
                      disabled={acting === r.id}
                      className="cursor-pointer rounded bg-emerald-700 px-2 py-1 text-xs font-semibold text-white transition-colors hover:bg-emerald-800 disabled:opacity-50"
                      title="Officer approval — moves this action to the ward queue"
                    >
                      Approve
                    </button>
                    <button
                      onClick={() => setStatus(r.id, "dismissed")}
                      disabled={acting === r.id}
                      className="cursor-pointer rounded px-2 py-1 text-xs text-slate-500 transition-colors hover:bg-slate-100 disabled:opacity-50"
                    >
                      Dismiss
                    </button>
                  </>
                )}
                {r.status === "approved" && (
                  <button
                    onClick={() => setStatus(r.id, "dispatched")}
                    disabled={acting === r.id}
                    className="cursor-pointer rounded bg-violet-700 px-2 py-1 text-xs font-semibold text-white transition-colors hover:bg-violet-800 disabled:opacity-50"
                    title="Dispatch the field team — freezes the cell's 7-day PM2.5 baseline and starts before/after tracking"
                  >
                    {acting === r.id ? "Dispatching…" : "Dispatch team"}
                  </button>
                )}
                {r.status === "dispatched" && (
                  <>
                    <span className="rounded bg-violet-100 px-1.5 py-0.5 text-[11px] font-semibold text-violet-800" title="Baseline frozen; before/after effect is being measured (see step 5)">
                      ✓ Dispatched · tracking armed
                    </span>
                    <button
                      onClick={() => setClosing(closing === r.id ? null : r.id)}
                      disabled={acting === r.id}
                      className="cursor-pointer rounded bg-slate-800 px-2 py-1 text-xs font-semibold text-white transition-colors hover:bg-slate-900 disabled:opacity-50"
                      title="Record the field finding and close this action"
                    >
                      Close case
                    </button>
                  </>
                )}
                {r.status === "closed" && (
                  <span className="rounded bg-emerald-100 px-1.5 py-0.5 text-[11px] font-semibold text-emerald-800" title={r.closure_note ?? undefined}>
                    ✓ Closed · {FINDING_LABEL[r.closure_finding ?? ""] ?? "recorded"}{r.closed_at ? ` · ${r.closed_at.slice(0, 10)}` : ""}
                  </span>
                )}
                {r.status === "dismissed" && (
                  <span className="rounded bg-slate-100 px-1.5 py-0.5 text-[11px] font-semibold text-slate-500">Dismissed</span>
                )}
                {r.status !== "proposed" && (
                  <button
                    onClick={() => void showLog(r.id)}
                    className="cursor-pointer rounded px-1.5 py-1 text-[11px] text-slate-500 transition-colors hover:bg-slate-100"
                    title="Who moved this action, and when"
                  >
                    {logFor === r.id ? "Hide history" : "History"}
                  </button>
                )}
              </div>

              {closing === r.id && (
                <div className="mt-2 flex flex-wrap items-center gap-1.5 rounded-md bg-slate-50 p-2 ring-1 ring-slate-200">
                  <span className="text-[11px] font-semibold text-slate-600">Field finding</span>
                  <select
                    value={finding}
                    onChange={(e) => setFinding(e.target.value)}
                    aria-label="Closure finding"
                    className="rounded-md border border-slate-200 bg-white px-1.5 py-1 text-xs text-slate-700"
                  >
                    {Object.entries(FINDING_LABEL).map(([k, v]) => <option key={k} value={k}>{v}</option>)}
                  </select>
                  <input
                    type="text"
                    value={closeNote}
                    onChange={(e) => setCloseNote(e.target.value)}
                    placeholder="note (optional): what was seen, notice served, follow-up…"
                    aria-label="Closure note"
                    className="min-w-0 flex-1 rounded-md border border-slate-200 bg-white px-1.5 py-1 text-xs text-slate-700 placeholder:text-slate-400"
                  />
                  <button
                    onClick={() => setStatus(r.id, "closed", { finding, note: closeNote.trim() || undefined })}
                    disabled={acting === r.id}
                    className="cursor-pointer rounded bg-emerald-700 px-2 py-1 text-xs font-semibold text-white hover:bg-emerald-800 disabled:opacity-50"
                  >
                    {acting === r.id ? "Closing…" : "Record & close"}
                  </button>
                </div>
              )}

              {logFor === r.id && (
                <div className="mt-2 rounded-md bg-white p-2 text-[11px] text-slate-600 ring-1 ring-slate-200">
                  {log === null ? (
                    <div className="h-6 animate-pulse rounded bg-slate-100" />
                  ) : log.length === 0 ? (
                    <span className="text-slate-500">No status changes recorded for this action yet.</span>
                  ) : (
                    <ol className="space-y-0.5">
                      {log.map((l, i) => (
                        <li key={i} className="flex flex-wrap items-baseline gap-x-1.5">
                          <span className="font-mono text-[10px] text-slate-400">{new Date(l.created_at).toLocaleString("en-IN", { day: "2-digit", month: "short", hour: "2-digit", minute: "2-digit" })}</span>
                          <span>{l.from_status ?? "—"} → <b>{l.to_status}</b></span>
                          {l.actor && <span className="text-slate-500">by {l.actor}</span>}
                          {l.finding && <span className="rounded bg-slate-100 px-1 text-slate-600">{FINDING_LABEL[l.finding] ?? l.finding}</span>}
                          {l.note && <span className="text-slate-500">“{l.note}”</span>}
                        </li>
                      ))}
                    </ol>
                  )}
                </div>
              )}

              {open === r.id && (
                <div className="mt-2 rounded-md bg-slate-50 p-2 ring-1 ring-slate-200">
                  {dossier === null ? (
                    <div className="h-12 animate-pulse rounded bg-slate-100" />
                  ) : (
                    <>
                      {(() => {
                        const patch = normalizePatch(dossier.satellite_patch);
                        return patch ? (
                          <div className="mb-2 rounded border border-sky-100 bg-white p-1.5">
                            <div className="text-[11px] font-semibold uppercase tracking-wide text-sky-700">
                              Satellite evidence
                            </div>
                            {patch.image_ref && (
                              <img
                                src={patch.image_ref}
                                alt={patch.title ?? "Sentinel-2 satellite patch"}
                                className="mt-1 aspect-[3/2] w-full rounded object-cover ring-1 ring-slate-200"
                              />
                            )}
                            <div className="mt-1 text-xs font-semibold text-slate-800">{patch.title ?? "Sentinel-2 patch"}</div>
                            <div className="text-[11px] leading-4 text-slate-500">
                              {patch.metadata?.source_type?.replace(/_/g, " ") ?? "detected source"}
                              {typeof patch.metadata?.detection_confidence === "number" &&
                                ` · ${Math.round(patch.metadata.detection_confidence * 100)}% detection confidence`}
                            </div>
                          </div>
                        ) : null;
                      })()}
                      <div className="text-[11px] font-semibold uppercase tracking-wide text-slate-500">
                        Regulatory citations (RAG)
                      </div>
                      {dedupeCitations(dossier.citations ?? []).length ? (
                        <div className="mt-1 space-y-1.5">
                          {dedupeCitations(dossier.citations ?? []).map((c, i) => (
                            <div key={i} className="rounded border border-slate-200 bg-white p-1.5">
                              <div className="flex items-center justify-between gap-2">
                                <span className="text-xs font-semibold text-slate-800">{c.rule ? prettyRule(c.rule) : "Regulation"}</span>
                                {typeof c.similarity === "number" && (
                                  <span className="shrink-0 rounded bg-emerald-100 px-1 text-[11px] text-emerald-700">
                                    match {Math.round(c.similarity * 100)}%
                                  </span>
                                )}
                              </div>
                              {c.excerpt && <div className="mt-0.5 text-[11px] leading-4 text-slate-500">{cleanExcerpt(c.excerpt)}</div>}
                            </div>
                          ))}
                        </div>
                      ) : (
                        <div className="mt-1 text-xs text-slate-500">no citations returned</div>
                      )}
                    </>
                  )}
                </div>
              )}
            </div>
          ))}
          {ordered.length === 0 && (
            <div className="py-2 text-center text-xs text-slate-500">
              {filter !== "all" || query ? (
                <>
                  No recommendations match this filter.{" "}
                  <button
                    className="font-medium text-blue-600 hover:underline"
                    onClick={() => {
                      setFilter("all");
                      setQuery("");
                    }}
                  >
                    Clear filters
                  </button>
                </>
              ) : (
                "No active recommendations"
              )}
            </div>
          )}
        </div>
      )}
    </Panel>
  );
}
