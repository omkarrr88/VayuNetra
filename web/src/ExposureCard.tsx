import { useEffect, useState } from "react";
import { api } from "./api";

type HorizonExposure = {
  horizon_h: number;
  n_cells: number;
  calibrated?: boolean;
  people_very_poor?: number;
  people_severe?: number;
  people_very_poor_city_scaled?: number | null;
  people_severe_city_scaled?: number | null;
  share_very_poor?: number | null;
  share_severe?: number | null;
  pop_weighted_pm25?: number | null;
};

type Exposure = {
  city_id: string;
  population_basis: "gpw411_cells" | "uniform_city_population" | "none";
  population_covered: number;
  city_population: number;
  horizons: HorizonExposure[];
  person_hours_24_to_72h: { very_poor: number | null; severe: number | null };
  person_hours_24_to_72h_city_scaled?: { very_poor: number | null; severe: number | null };
};

const fmt = (n?: number | null) => {
  if (n === null || n === undefined) return "–";
  if (n >= 1e7) return `${(n / 1e7).toFixed(1)} cr`;
  if (n >= 1e5) return `${(n / 1e5).toFixed(1)} lakh`;
  if (n >= 1e3) return `${Math.round(n / 1e3)}k`;
  return String(Math.round(n));
};

/** "Who is in the forecast?" — expected people in Very Poor / Severe air at +24/48/72 h,
 *  population-weighted over the calibrated exceedance probabilities. Self-computed. */
export default function ExposureCard({ city }: { city: string }) {
  const [data, setData] = useState<Exposure | null | undefined>(undefined);
  useEffect(() => {
    setData(undefined);
    api<Exposure>(`/exposure?city=${city}`).then(setData).catch(() => setData(null));
  }, [city]);

  if (data === undefined) return <div className="mt-1 h-16 animate-pulse rounded-md bg-gray-100" />;
  if (!data || !data.horizons.some((h) => h.n_cells > 0)) return null;
  const worst = [...data.horizons].filter((h) => h.n_cells > 0).sort((a, b) => (b.people_very_poor ?? 0) - (a.people_very_poor ?? 0))[0];
  const calibrated = data.horizons.some((h) => h.calibrated);
  const basis = data.population_basis === "gpw411_cells" ? "GPW v4.11 gridded population per cell" : "cited city population, uniform over forecast cells";

  return (
    <div>
      <div className="text-[12px] font-semibold text-slate-700">Who is in the forecast?</div>
      <div className="mt-1 grid grid-cols-3 gap-1.5">
        {data.horizons.map((h) => {
          const sev = (h.share_severe ?? 0) >= 0.25;
          const vp = (h.share_very_poor ?? 0) >= 0.25;
          return (
            <div key={h.horizon_h} className={`rounded-md border p-1.5 text-center ${sev ? "border-rose-200 bg-rose-50" : vp ? "border-orange-200 bg-orange-50" : "border-slate-200 bg-slate-50"}`}>
              <div className="text-[10px] text-slate-500">+{h.horizon_h}h</div>
              <div className={`text-sm font-bold ${sev ? "text-rose-700" : vp ? "text-orange-700" : "text-slate-700"}`}>{fmt(h.people_very_poor_city_scaled ?? h.people_very_poor)}</div>
              <div className="text-[10px] text-slate-500">in Very Poor+ air</div>
              {(h.people_severe_city_scaled ?? h.people_severe ?? 0) > 0 && <div className="text-[10px] font-semibold text-rose-700">{fmt(h.people_severe_city_scaled ?? h.people_severe)} Severe</div>}
              <div className="text-[9px] text-slate-500">{fmt(h.people_very_poor)} in monitored cells</div>
            </div>
          );
        })}
      </div>
      <div className="mt-1 text-[10px] leading-4 text-gray-500">
        City-scale = share of monitored population × city population ({fmt(data.city_population)}), monitored cells taken as representative. Expected people = Σ cell population × calibrated P(PM2.5 &gt; 120 / &gt; 250 µg/m³)
        {calibrated ? "" : " (probabilities pending — point-forecast indicator used)"} · {basis} ({fmt(data.population_covered)} covered)
        {(data.person_hours_24_to_72h_city_scaled?.very_poor ?? data.person_hours_24_to_72h.very_poor) ? <> · ≈{fmt(data.person_hours_24_to_72h_city_scaled?.very_poor ?? data.person_hours_24_to_72h.very_poor)} person-hours of Very Poor+ air over the 24→72 h outlook</> : null}
        {worst && worst.pop_weighted_pm25 ? <> · pop-weighted PM2.5 peaks {worst.pop_weighted_pm25} µg/m³ at +{worst.horizon_h}h</> : null}
        . Exposure, not mortality.
      </div>
    </div>
  );
}
