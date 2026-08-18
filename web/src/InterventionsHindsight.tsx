import { useEffect, useState } from "react";
import { api } from "./api";
import { Panel } from "./ui";

type Lead = {
  n_cells: number; low_coverage?: boolean;
  p_over_120_mean: number | null; p_over_250_mean: number | null; share_cells_alarm_120: number | null;
  served_city_mean: number | null; persistence_city_mean: number | null; observed_target_mean: number | null;
};
type Event = { key: string; label: string; stage: number; order_at: string; source: string; observed_at_order: number | null; lead: Record<string, Lead | null> };
type Window = {
  key: string; label: string; kind?: string; start?: string; end?: string; source?: string; note?: string;
  days?: number; cells?: number; observed_mean?: number; weather_expected_mean?: number; difference?: number; difference_pct?: number; ci90?: [number, number];
};
type Artifact = {
  city_id: string; generated_at: string; stations_cells: number; season: { start: string; end: string };
  status_quo: string;
  early_warning: { tau: number; events: Event[] };
  deweathered: { model: { holdout_r2: number | null; holdout_rmse: number | null; trained_on_hours: number; note: string }; windows: Window[] };
};

const pct = (x: number | null | undefined) => (x === null || x === undefined ? "–" : `${Math.round(x * 100)}%`);
const short = (label: string) => label.replace(" invoked", "").replace(" (construction / demolition ban)", "").replace("Diwali night (green crackers 20:00–22:00 permitted, SC order 15 Oct)", "Diwali night");

/** Real, dated interventions in hindsight — the CAQM GRAP escalations of winter 2025-26 (and
 *  Diwali night), replayed against the served forecast and a weather-normalised expectation.
 *  Every number is read from docs/benchmarks/<city>_interventions.json (python -m ml.eval.interventions);
 *  negative results and low-coverage rows are shown, not hidden. */
export default function InterventionsHindsight({ city }: { city: string }) {
  const [d, setD] = useState<Artifact | null | undefined>(undefined);
  const [tab, setTab] = useState<"warn" | "effect">("warn");
  useEffect(() => {
    setD(undefined);
    api<Artifact>(`/metrics/interventions?city=${city}`).then(setD).catch(() => setD(null));
  }, [city]);

  if (d === undefined) return <Panel title="Real interventions, in hindsight"><div className="h-16 animate-pulse rounded-md bg-slate-100" /></Panel>;
  if (d === null) {
    return (
      <Panel title="Real interventions, in hindsight" tag="pending">
        <div className="text-xs text-slate-500">
          No retrospective for this city yet — it needs a season of station history with dated orders
          (<code className="rounded bg-slate-100 px-1">python -m ml.eval.interventions --city {city}</code>). Delhi's winter 2025-26 is published.
        </div>
      </Panel>
    );
  }
  const tau = d.early_warning.tau;
  const events = d.early_warning.events;
  const wins = d.deweathered.windows.filter((w) => !w.note);
  const model = d.deweathered.model;

  return (
    <Panel
      title="Real interventions, in hindsight"
      tag={`${d.season.start.slice(0, 7)} → ${d.season.end.slice(0, 7)}`}
      right={
        <div className="flex gap-1">
          <button onClick={() => setTab("warn")} className={`rounded px-2 py-0.5 text-[11px] font-semibold ${tab === "warn" ? "bg-slate-800 text-white" : "bg-slate-100 text-slate-600"}`}>would we have warned?</button>
          <button onClick={() => setTab("effect")} className={`rounded px-2 py-0.5 text-[11px] font-semibold ${tab === "effect" ? "bg-slate-800 text-white" : "bg-slate-100 text-slate-600"}`}>did the air change?</button>
        </div>
      }
    >
      {tab === "warn" ? (
        <>
          <div className="text-[11px] leading-4 text-slate-500">
            CAQM's GRAP orders for Delhi-NCR, winter 2025-26 (dates from the government releases), against the served forecast
            replayed on {d.stations_cells} station cells: the calibrated P(&gt;120) the system carried <b>24 / 48 / 72 h before each order</b>,
            and the share of cells past the P ≥ {Math.round(tau * 100)}% alarm.
          </div>
          <div className="mt-2 overflow-x-auto">
            <table className="w-full text-[11px]">
              <thead className="text-slate-500">
                <tr className="border-b border-slate-200 text-left">
                  <th className="py-1 pr-1 font-medium">order</th>
                  <th className="px-1 py-1 text-right font-medium" title="city-mean PM2.5 in the 6 h before the order">at order</th>
                  <th className="px-1 py-1 text-right font-medium">P(&gt;120) 24 h before</th>
                  <th className="px-1 py-1 text-right font-medium">48 h</th>
                  <th className="px-1 py-1 text-right font-medium">72 h</th>
                  <th className="px-1 py-1 text-right font-medium" title="share of station cells with P(>120) ≥ τ, 24 h before">cells alarming</th>
                </tr>
              </thead>
              <tbody>
                {events.map((e) => {
                  const l24 = e.lead["24"], l48 = e.lead["48"], l72 = e.lead["72"];
                  const low = [l24, l48, l72].some((l) => l?.low_coverage);
                  const cls = (l: Lead | null | undefined) => (l && (l.p_over_120_mean ?? 0) >= tau ? "text-emerald-700 font-semibold" : "text-slate-600");
                  return (
                    <tr key={e.key} className="border-b border-slate-100">
                      <td className="py-1 pr-1 text-slate-700">
                        <a href={e.source} target="_blank" rel="noreferrer" className="hover:underline">{short(e.label)}</a>
                        <span className="text-slate-400"> · {e.order_at.slice(0, 10)}</span>
                        {low && <span className="ml-1 rounded bg-amber-100 px-1 text-[10px] text-amber-800" title="fewer than 5 station cells in the public feed at that time — one station, not the city">low coverage</span>}
                      </td>
                      <td className="px-1 py-1 text-right font-mono tabular-nums">{e.observed_at_order ?? "–"}</td>
                      <td className={`px-1 py-1 text-right font-mono tabular-nums ${cls(l24)}`}>{pct(l24?.p_over_120_mean)}</td>
                      <td className={`px-1 py-1 text-right font-mono tabular-nums ${cls(l48)}`}>{pct(l48?.p_over_120_mean)}</td>
                      <td className={`px-1 py-1 text-right font-mono tabular-nums ${cls(l72)}`}>{pct(l72?.p_over_120_mean)}</td>
                      <td className="px-1 py-1 text-right font-mono tabular-nums">{l24 ? `${pct(l24.share_cells_alarm_120)} of ${l24.n_cells}` : "–"}</td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
          <div className="mt-2 rounded-md bg-slate-50 px-2 py-1.5 text-[11px] leading-4 text-slate-600">
            <b>Read honestly.</b> The Stage III (11 Nov) and Stage IV (13 Dec) escalations were flagged a day ahead across the whole
            station network; the two October orders were not — the mid-October rise came faster than the model saw. Persistence, by
            construction, only ever repeats today's level. Status quo, for contrast: {d.status_quo.split(" — ")[0]} (press analysis, not an audit figure).
          </div>
        </>
      ) : (
        <>
          <div className="text-[11px] leading-4 text-slate-500">
            A city-wide order has no untreated control and is triggered by dirty air, so a plain before/after measures weather and
            regression to the mean. Instead: what PM2.5 <i>that weather</i> normally brings (LightGBM on ERA5 meteorology + calendar,
            fitted on the season's hours outside the windows; held-out R² {model.holdout_r2 ?? "–"}, RMSE {model.holdout_rmse ?? "–"} µg/m³) vs what was observed.
          </div>
          <div className="mt-2 overflow-x-auto">
            <table className="w-full text-[11px]">
              <thead className="text-slate-500">
                <tr className="border-b border-slate-200 text-left">
                  <th className="py-1 pr-1 font-medium">window</th>
                  <th className="px-1 py-1 text-right font-medium">observed</th>
                  <th className="px-1 py-1 text-right font-medium">weather-expected</th>
                  <th className="px-1 py-1 text-right font-medium">difference</th>
                  <th className="px-1 py-1 text-right font-medium" title="day-block bootstrap">90% interval</th>
                </tr>
              </thead>
              <tbody>
                {wins.map((w) => {
                  const diff = w.difference ?? 0;
                  const sig = w.ci90 && (w.ci90[0] > 0 || w.ci90[1] < 0);
                  return (
                    <tr key={w.key} className="border-b border-slate-100">
                      <td className="py-1 pr-1 text-slate-700">
                        {w.source ? <a href={w.source} target="_blank" rel="noreferrer" className="hover:underline">{short(w.label)}</a> : short(w.label)}
                        <span className="text-slate-400"> · {w.start?.slice(0, 10)} → {w.end?.slice(0, 10)} · {w.days} d</span>
                      </td>
                      <td className="px-1 py-1 text-right font-mono tabular-nums">{w.observed_mean}</td>
                      <td className="px-1 py-1 text-right font-mono tabular-nums">{w.weather_expected_mean}</td>
                      <td className={`px-1 py-1 text-right font-mono tabular-nums ${sig ? (diff < 0 ? "text-emerald-700" : "text-rose-700") : "text-slate-600"}`}>{diff > 0 ? "+" : ""}{w.difference} ({diff > 0 ? "+" : ""}{w.difference_pct}%)</td>
                      <td className="px-1 py-1 text-right font-mono tabular-nums text-slate-500">{w.ci90 ? `[${w.ci90[0]}, ${w.ci90[1]}]` : "–"}</td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
          <div className="mt-2 rounded-md bg-slate-50 px-2 py-1.5 text-[11px] leading-4 text-slate-600">
            <b>Read honestly.</b> Diwali night shows the method has the power to see a large signal. For the GRAP windows we find
            <b> no weather-adjusted reduction this method can detect</b>; the Stage IV rows sit in the most stagnant weather of the season,
            where a tree model fitted on calmer hours under-predicts, so a positive difference there is at least partly method. Association,
            not causation — coincident factors stay in the number. This is exactly why VayuNetra tracks each dispatched action against its
            own cell instead of grading city-wide stages.
          </div>
        </>
      )}
      <div className="mt-1.5 text-[10px] text-slate-500">
        Recomputed {d.generated_at.slice(0, 10)} · every order links to its government release · docs/benchmarks/{d.city_id}_interventions.md
      </div>
    </Panel>
  );
}
