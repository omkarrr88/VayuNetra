import { useEffect, useMemo, useState } from "react";
import { cellToLatLng } from "h3-js";
import { api, downloadFile } from "./api";
import { cleanRationale, prettyRule } from "./format";
import { Panel } from "./ui";
import { placeForCell } from "./placeName";

type Rec = {
  id: number;
  h3_cell?: string;
  priority_score: number;
  contribution: number;
  pop_exposed: number;
  rationale: string;
  status: string;
  rubric_score?: { total?: number };
};

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
    const sorted = focusCell
      ? collapsed
          .map((r) => ({ ...r, km: r.h3_cell ? cellKm(focusCell, r.h3_cell) : null }))
          .sort((a, b) => (a.km ?? 1e9) - (b.km ?? 1e9))
      : collapsed;
    return sorted.slice(0, 10); // keep the list scannable
  }, [rows, focusCell, filter, query]);

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

  return (
    <Panel
      title="Enforcement Worklist"
      right={
        focusCell ? (
          <span className="rounded bg-blue-100 px-1.5 py-0.5 text-[11px] font-medium text-blue-700">
            nearest to selected cell first
          </span>
        ) : undefined
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
          className="min-w-0 flex-1 rounded-md border border-slate-200 bg-slate-50 px-2 py-1 text-xs text-slate-700 placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-blue-400"
        />
      </div>

      {ordered === null ? (
        <div className="mt-2 space-y-2">
          {[0, 1, 2].map((i) => (
            <div key={i} className="h-16 animate-pulse rounded-md bg-gray-100" />
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
                <span className="min-w-0 truncate font-semibold text-slate-800" title={r.h3_cell}>
                  {CATEGORY_LABEL[recCategory(r.rationale)] ?? "Source"}
                  {r.h3_cell && places[r.h3_cell] ? <span className="font-normal text-slate-500"> · {places[r.h3_cell]}</span> : null}
                </span>
                <span className="flex items-center gap-1.5 whitespace-nowrap text-xs text-gray-500">
                  {focusCell && r.h3_cell === focusCell && (
                    <span className="rounded bg-blue-600 px-1 py-0.5 text-[11px] font-semibold text-white">📍 this cell</span>
                  )}
                  {focusCell && r.h3_cell !== focusCell && typeof r.km === "number" && (
                    <span className="text-[11px] text-gray-400">~{r.km < 1 ? "<1" : Math.round(r.km)} km</span>
                  )}
                  <span title="Priority = contribution × exposure × actionability × confidence">priority {Math.round(r.priority_score * 100)}</span>
                  <span className="text-slate-300">·</span>
                  <span title="Evidence rubric out of 10">rubric {r.rubric_score?.total ?? "--"}/10</span>
                </span>
              </div>
              <div className="mt-1 text-xs leading-5 text-gray-700">{cleanRationale(r.rationale)}</div>
              <div className="mt-1 text-xs text-gray-500">
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
              <div className="mt-2 flex gap-2">
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
              </div>

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
                        <div className="mt-1 text-xs text-slate-400">no citations returned</div>
                      )}
                    </>
                  )}
                </div>
              )}
            </div>
          ))}
          {ordered.length === 0 && (
            <div className="py-2 text-center text-xs text-gray-500">
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
