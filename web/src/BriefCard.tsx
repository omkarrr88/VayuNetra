import { useEffect, useState } from "react";
import { api, downloadFile } from "./api";
import { Panel } from "./ui";

type Brief = {
  city_id: string;
  city_name: string;
  generated_at: string;
  air: {
    now_pm25: number | null; now_band: string; yesterday_pm25: number | null; change_pm25: number | null;
    worst_cell: { place: string; pm25: number } | null; outlook_24h_pm25: number | null; outlook_24h_band: string; n_cells: number;
    stale_hours?: number | null;
  };
  onsets: { place: string; horizon_h: number; p_over_120: number; forecast_pm25: number | null }[];
  onset_tau: number;
  actions: { rec_id: number; place: string; source: string; contribution_pct: number; pop_exposed: number; status: string }[];
  open_actions: number;
  outcomes: { place: string; days: number | null; effect_pm25: number | null; note?: string | null }[];
  advisories: { worst_tier: string | null; wards_at_worst: number; languages: string[] };
};

/** The officer's morning brief — what changed overnight, where the air is about to turn,
 *  the top actions and yesterday's measured outcomes. Every line is a template over stored
 *  rows (no LLM). Download as PDF or push to the city's Telegram subscribers. */
export default function BriefCard({ city }: { city: string }) {
  const [b, setB] = useState<Brief | null | undefined>(undefined);
  const [busy, setBusy] = useState<"pdf" | "send" | null>(null);
  const [sent, setSent] = useState<string | null>(null);

  useEffect(() => {
    setB(undefined);
    setSent(null);
    api<Brief>(`/brief?city=${city}`).then(setB).catch(() => setB(null));
  }, [city]);

  if (b === undefined) return <Panel title="Morning brief"><div className="h-20 animate-pulse rounded-md bg-slate-100" /></Panel>;
  if (b === null) return null;
  const a = b.air;
  const chg = a.change_pm25;

  return (
    <Panel
      title="Morning brief"
      tag={b.generated_at.slice(0, 10)}
      right={
        <div className="flex items-center gap-1">
          <button
            onClick={async () => { setBusy("pdf"); try { await downloadFile(`/brief.pdf?city=${city}`, `brief_${city}.pdf`); } finally { setBusy(null); } }}
            disabled={busy !== null}
            className="cursor-pointer rounded-md bg-slate-100 px-2 py-1 text-[11px] font-semibold text-slate-700 transition-colors hover:bg-slate-200 disabled:opacity-50"
          >
            {busy === "pdf" ? "…" : "PDF"}
          </button>
          <button
            onClick={async () => {
              setBusy("send");
              try {
                const r = await api<{ status: string; sent?: number; detail?: string }>("/brief/send", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ city }) });
                setSent(r.status === "sent" ? `sent to ${r.sent} Telegram subscriber${r.sent === 1 ? "" : "s"}` : r.detail ?? r.status);
              } catch {
                setSent("send failed");
              } finally {
                setBusy(null);
              }
            }}
            disabled={busy !== null}
            title="Push this brief to the city's Telegram subscribers (real send)"
            className="cursor-pointer rounded-md bg-sky-700 px-2 py-1 text-[11px] font-semibold text-white transition-colors hover:bg-sky-800 disabled:opacity-50"
          >
            {busy === "send" ? "Sending…" : "Send to Telegram"}
          </button>
        </div>
      }
    >
      {/* air now */}
      <div className="rounded-md bg-slate-50 px-2.5 py-2 text-[12px] leading-5 text-slate-700">
        {a.now_pm25 !== null ? (
          <>
            City mean <b>{a.now_pm25} µg/m³</b> ({a.now_band}){(a.stale_hours ?? 0) > 6 ? <span className="text-slate-500"> as of {Math.round(a.stale_hours!)} h ago</span> : null}
            {chg !== null && <span className={chg > 0 ? "text-rose-700" : "text-emerald-700"}> {chg > 0 ? "▲" : "▼"} {Math.abs(chg)} vs yesterday</span>}
            {a.worst_cell && <> · worst <b>{a.worst_cell.place}</b> {Math.round(a.worst_cell.pm25)}</>}
            {a.outlook_24h_pm25 !== null && <> · 24 h outlook <b>{a.outlook_24h_pm25}</b> ({a.outlook_24h_band})</>}
          </>
        ) : (
          "No station readings in the last 36 hours."
        )}
      </div>

      {/* onsets */}
      <div className="mt-2 text-[11px] font-bold uppercase tracking-wide text-slate-500">Where the air is about to turn</div>
      {b.onsets.length ? (
        <ul className="mt-1 space-y-0.5 text-[12px] text-slate-700">
          {b.onsets.slice(0, 4).map((o, i) => (
            <li key={i} className="flex items-center justify-between gap-2">
              <span className="truncate">{o.place}</span>
              <span className="shrink-0 rounded bg-orange-100 px-1.5 py-0.5 text-[11px] font-semibold text-orange-800">
                {Math.round(o.p_over_120 * 100)}% Very Poor · +{o.horizon_h}h{o.forecast_pm25 !== null ? ` · ${Math.round(o.forecast_pm25)}` : ""}
              </span>
            </li>
          ))}
        </ul>
      ) : (
        <div className="mt-1 text-[12px] text-slate-500">No cell crosses P(Very Poor) ≥ {Math.round(b.onset_tau * 100)}% in the 72 h outlook.</div>
      )}

      {/* actions */}
      <div className="mt-2 text-[11px] font-bold uppercase tracking-wide text-slate-500">Top actions today</div>
      {b.actions.length ? (
        <ol className="mt-1 space-y-0.5 text-[12px] text-slate-700">
          {b.actions.map((x, i) => (
            <li key={x.rec_id} className="flex items-baseline gap-1.5">
              <span className="font-bold text-slate-500">{i + 1}.</span>
              <span className="min-w-0 truncate"><b>{x.source}</b> · {x.place} — {x.contribution_pct}% of local PM2.5, ~{x.pop_exposed.toLocaleString()} exposed{x.status !== "proposed" ? ` (${x.status})` : ""}</span>
            </li>
          ))}
        </ol>
      ) : (
        <div className="mt-1 text-[12px] text-slate-500">No open recommendations today.</div>
      )}
      {b.open_actions > b.actions.length && <div className="mt-0.5 text-[11px] text-slate-500">+{b.open_actions - b.actions.length} more in the worklist below</div>}

      {/* outcomes */}
      <div className="mt-2 text-[11px] font-bold uppercase tracking-wide text-slate-500">Yesterday's dispatches</div>
      {b.outcomes.length ? (
        <ul className="mt-1 space-y-0.5 text-[12px] text-slate-700">
          {b.outcomes.slice(0, 3).map((o, i) => (
            <li key={i}>{o.place}: {typeof o.effect_pm25 === "number" ? `${o.effect_pm25 > 0 ? "+" : ""}${o.effect_pm25} µg/m³ vs city drift` : (o.note ?? "collecting measurements")}{o.days !== null ? ` (${o.days} d)` : ""}</li>
          ))}
        </ul>
      ) : (
        <div className="mt-1 text-[12px] text-slate-500">No dispatched intervention is being tracked yet.</div>
      )}

      <div className="mt-2 text-[10px] leading-4 text-slate-500">
        Advisories: {b.advisories.worst_tier ? `worst tier ${b.advisories.worst_tier.replace("_", " ")} in ${b.advisories.wards_at_worst} zone(s), ${b.advisories.languages.length} language(s)` : "none yet"} ·
        templated from stored rows, no language model{sent ? ` · ${sent}` : ""}
      </div>
    </Panel>
  );
}
