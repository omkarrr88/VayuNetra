import { useEffect, useState } from "react";
import { api } from "./api";
import { EmptyState, Panel, SegBtn } from "./ui";

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
  onset_recall_p30?: number | null;
  precision_p30?: number | null;
  skill_raw_vs_persistence?: number | null;
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

type AttrMethods = {
  cities: {
    city_id: string; n_cells: number;
    methods: { method: string; label: string; n_cells: number }[];
    share_per_cell_model: number | null; median_model_r2: number | null; mean_confidence: number | null; cells_with_gas_marker_24h: number;
  }[];
  gate: string; note: string;
};

const METHOD_SHORT: Record<string, string> = {
  "hybrid-gbm-shap-v2": "per-cell model",
  "signature-citymean-v1": "shrunk to city model mean",
  "signature-v1": "signature priors",
};

/** How today's attribution was produced for this city — the split a reviewer would otherwise
 *  have to query for. Rendered inside the Validation panel so the number sits next to the
 *  forecast benchmark and never looks like a claim we hid. */
function AttributionMethods({ city }: { city: string }) {
  const [d, setD] = useState<AttrMethods | null | undefined>(undefined);
  useEffect(() => {
    setD(undefined);
    api<AttrMethods>(`/metrics/attribution?city=${city}`).then(setD).catch(() => setD(null));
  }, [city]);
  const row = d?.cities.find((c) => c.city_id === city);
  if (d === undefined) return <div className="mt-3 h-10 animate-pulse rounded-md bg-slate-100" />;
  if (!d || !row) return null;
  return (
    <div className="mt-3 rounded-md border border-slate-200 bg-slate-50 px-2 py-1.5 text-[11px] leading-4 text-slate-700">
      <div className="flex items-baseline justify-between gap-2">
        <b>How today's attribution was made</b>
        <span className="text-slate-500">{row.n_cells} cells</span>
      </div>
      <div className="mt-1 flex flex-wrap gap-1">
        {row.methods.map((m) => (
          <span key={m.method} title={m.label} className="rounded bg-white px-1.5 py-0.5 ring-1 ring-slate-200">
            {METHOD_SHORT[m.method] ?? m.method} <b>{m.n_cells}</b>
          </span>
        ))}
      </div>
      <div className="mt-1 text-slate-600">
        {row.median_model_r2 !== null ? <>median out-of-sample R² <b>{row.median_model_r2}</b> · </> : <>no cell passed the R² ≥ 0.15 gate · </>}
        mean confidence <b>{row.mean_confidence ?? "–"}</b> · cells reporting NO₂/CO/SO₂ in the last 24 h <b>{row.cells_with_gas_marker_24h}</b>
      </div>
      <div className="mt-0.5 text-[10px] text-slate-500">{d.note}</div>
    </div>
  );
}

const pct = (x: number | null | undefined, signed = true) =>
  x === null || x === undefined ? "–" : `${signed && x >= 0 ? "+" : ""}${Math.round(x * 100)}%`;
const day = (iso?: string) => (iso ? iso.slice(0, 10) : "");

function Cell({ v, good }: { v: number | null | undefined; good?: (x: number) => boolean }) {
  if (v === null || v === undefined) return <td className="px-1.5 py-1 text-right text-slate-400">–</td>;
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
        <EmptyState message="No benchmark published for this city yet. Skill is measured on a held-out slice of that city's own record, so a city needs enough history before there is anything honest to report — we publish measured skill, never assumed skill." />
        <AttributionMethods city={city} />
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
        {" "}({s.stations_cells} station cells, {h24 ? h24.n_test.toLocaleString() : "–"} test hours @24h). The served forecast (LightGBM
        median blended with persistence, weight from the calibration tail) vs persistence, weekly seasonal-naive and hour-of-day
        climatology on one shared support mask.
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
          <b>Early warning on Very Poor onsets</b> (clean at issue time, &gt;120 µg/m³ at t+h): alarming on the calibrated
          probability (P ≥ 30%) flags{" "}
          {s.headline
            .filter((h) => h.onsets > 0)
            .map((h) => `${pct(h.onset_recall_p30 ?? h.onset_recall_model, false)} @${h.horizon_h}h`)
            .join(" · ")}{" "}
          of onsets{s.headline.some((h) => h.precision_p30 != null) ? ` (precision ${s.headline.filter((h) => h.precision_p30 != null).map((h) => pct(h.precision_p30, false)).join(" · ")})` : ""}
          {s.headline.some((h) => h.onset_recall_p30 != null && h.onset_recall_model != null) ? `; the plain median alarm ${s.headline.filter((h) => h.onsets > 0).map((h) => pct(h.onset_recall_model, false)).join(" · ")}` : ""}.
          Persistence catches <b>0%</b> by construction — a "tomorrow = today" system can never warn of a spike before it starts.
        </div>
      )}
      {!anyEpisodes && (
        <div className="mt-2 rounded-md bg-slate-50 px-2 py-1.5 text-[11px] leading-4 text-slate-600">
          No hours above 120 µg/m³ in this test window (clean season) — the high-pollution slice and onset recall are
          reported only where they can be measured, not extrapolated.
        </div>
      )}
      <div className="mt-1.5 text-[10px] text-slate-500">
        Recomputed {day(s.generated_at)} · negative numbers are kept, not hidden · full tables in docs/benchmarks/{city}.md
      </div>
      <AttributionMethods city={city} />
    </Panel>
  );
}
