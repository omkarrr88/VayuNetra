import { useEffect, useState } from "react";
import { api } from "./api";
import { Panel, SegBtn } from "./ui";

/** One row of the headline table served by GET /metrics/benchmark. */
type Headline = {
  horizon_h: number;
  n_test: number;
  skill_vs_persistence: number | null;
  skill_vs_seasonal_naive: number | null;
  winter_skill_vs_persistence: number | null;
  very_poor_hours_skill: number | null;
  very_poor_hours_n: number;
  onset_recall_model: number | null;
  onset_recall_persistence: number | null;
  onsets: number;
  pi80_coverage: number | null;
  brier_skill_very_poor: number | null;
};

type Summary = {
  city_id: string;
  source: "hist" | "live";
  window: { start: string; end: string; split: string };
  stations_cells: number;
  generated_at: string;
  headline: Headline[];
};

type Benchmark = { city_id: string; history: Summary | null; live: Summary | null };

const pct = (x: number | null | undefined, signed = true) =>
  x === null || x === undefined ? "–" : `${signed && x >= 0 ? "+" : ""}${Math.round(x * 100)}%`;
const day = (iso?: string) => (iso ? iso.slice(0, 10) : "");

function Cell({ v, good }: { v: number | null | undefined; good?: (x: number) => boolean }) {
  if (v === null || v === undefined) return <td className="px-1.5 py-1 text-right text-slate-300">–</td>;
  const ok = good ? good(v) : v > 0;
  return (
    <td className={`px-1.5 py-1 text-right font-mono tabular-nums ${ok ? "text-emerald-700" : "text-rose-600"}`}>
      {pct(v)}
    </td>
  );
}

/** "How good is this forecast, really?" — the temporal-split benchmark, recomputed by
 *  `python -m ml.eval.benchmark` from real station data and served as an artifact.
 *  Every number here is a measurement, including the negative ones. */
export default function ValidationPanel({ city }: { city: string }) {
  const [data, setData] = useState<Benchmark | null | undefined>(undefined);
  const [tab, setTab] = useState<"history" | "live">("history");

  useEffect(() => {
    setData(undefined);
    api<Benchmark>(`/metrics/benchmark?city=${city}`)
      .then((d) => {
        setData(d);
        setTab(d.history ? "history" : "live");
      })
      .catch(() => setData(null));
  }, [city]);

  if (data === undefined) return <Panel title="Forecast validation"><div className="h-24 animate-pulse rounded-md bg-slate-100" /></Panel>;
  if (data === null || (!data.history && !data.live)) {
    return (
      <Panel title="Forecast validation" tag="pending">
        <div className="text-xs text-slate-500">
          No benchmark artifact for this city yet — run <code className="rounded bg-slate-100 px-1">python -m ml.eval.benchmark --city {city}</code>.
          We publish measured skill, not assumed skill.
        </div>
      </Panel>
    );
  }
  const s = (tab === "history" ? data.history : data.live) ?? data.history ?? data.live!;
  const h24 = s.headline.find((h) => h.horizon_h === 24);
  const anyOnsets = s.headline.some((h) => h.onsets > 0);
  const anyEpisodes = s.headline.some((h) => h.very_poor_hours_n > 0);

  return (
    <Panel
      title="Forecast validation"
      tag="measured"
      right={
        data.history && data.live ? (
          <div className="flex gap-1">
            <SegBtn active={tab === "history"} onClick={() => setTab("history")}>multi-season</SegBtn>
            <SegBtn active={tab === "live"} onClick={() => setTab("live")}>live 90d</SegBtn>
          </div>
        ) : undefined
      }
    >
      <div className="text-[11px] leading-4 text-slate-500">
        Strict temporal split: trained on {day(s.window.start)} → {day(s.window.split)}, tested on {day(s.window.split)} → {day(s.window.end)}
        {" "}({s.stations_cells} station cells, {h24 ? h24.n_test.toLocaleString() : "–"} test hours @24h). Same LightGBM as production;
        baselines persistence, weekly seasonal-naive, hour-of-day climatology; one shared support mask.
      </div>

      <div className="mt-2 overflow-x-auto">
        <table className="w-full text-[11px]">
          <thead className="text-slate-500">
            <tr className="border-b border-slate-200 text-left">
              <th className="py-1 pr-1 font-medium">horizon</th>
              <th className="px-1.5 py-1 text-right font-medium" title="skill = 1 − RMSE_model / RMSE_persistence">vs persistence</th>
              <th className="px-1.5 py-1 text-right font-medium" title="skill vs same-hour-last-week">vs seasonal</th>
              {s.headline.some((h) => h.winter_skill_vs_persistence !== null) && (
                <th className="px-1.5 py-1 text-right font-medium" title="Nov–Feb test hours only">winter</th>
              )}
              {anyEpisodes && (
                <th className="px-1.5 py-1 text-right font-medium" title="only hours where observed PM2.5 > 120 (Very Poor+)">&gt;120 hours</th>
              )}
              <th className="px-1.5 py-1 text-right font-medium" title="empirical coverage of the served 80% interval">80% PI</th>
            </tr>
          </thead>
          <tbody>
            {s.headline.map((h) => (
              <tr key={h.horizon_h} className="border-b border-slate-100">
                <td className="py-1 pr-1 font-semibold text-slate-700">+{h.horizon_h}h</td>
                <Cell v={h.skill_vs_persistence} />
                <Cell v={h.skill_vs_seasonal_naive} />
                {s.headline.some((x) => x.winter_skill_vs_persistence !== null) && <Cell v={h.winter_skill_vs_persistence} />}
                {anyEpisodes && <Cell v={h.very_poor_hours_skill} />}
                <Cell v={h.pi80_coverage} good={(x) => x >= 0.75 && x <= 0.9} />
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {anyOnsets && (
        <div className="mt-2 rounded-md bg-indigo-50 px-2 py-1.5 text-[11px] leading-4 text-indigo-900">
          <b>Early warning on Very Poor onsets</b> (clean at issue time, &gt;120 µg/m³ at t+h): the model flags{" "}
          {s.headline
            .filter((h) => h.onsets > 0)
            .map((h) => `${pct(h.onset_recall_model, false)} @${h.horizon_h}h`)
            .join(" · ")}{" "}
          of onsets. Persistence catches <b>0%</b> by construction — a "tomorrow = today" system can never warn of a spike before it starts.
        </div>
      )}
      {!anyEpisodes && (
        <div className="mt-2 rounded-md bg-slate-50 px-2 py-1.5 text-[11px] leading-4 text-slate-600">
          No hours above 120 µg/m³ in this test window (clean season) — the high-pollution slice and onset recall are
          reported only where they can be measured, not extrapolated.
        </div>
      )}
      <div className="mt-1.5 text-[10px] text-slate-400">
        Recomputed {day(s.generated_at)} · negative numbers are kept, not hidden · full tables in docs/benchmarks/{city}.md
      </div>
    </Panel>
  );
}
