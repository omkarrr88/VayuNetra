import { useEffect, useState } from "react";
import { api } from "./api";
import { aqiCategory, pm25ToAqi } from "./aqi";
import { SOURCE_COLORS, dominantSource, type Shares } from "./sources";
import { DRIVER_LABELS, type AttrCell } from "./BlameMap";
import { placeForCell } from "./placeName";
import TrendPanel from "./TrendPanel";

type FC = { h3_cell: string; horizon_h: number; value: number; pi_low: number; pi_high: number };

const HORIZONS = [24, 48, 72];

/** "construction_dust" -> "construction dust" (for signature-based reasoning copy). */
function prettyCat(cat: string): string {
  return cat.replace(/_/g, " ");
}

/** The full story for one clicked hexagon: blame → forecast → act. */
export default function CellStoryPanel({
  city,
  cell,
  onClose,
  onAct,
}: {
  city: string;
  cell: AttrCell;
  onClose: () => void;
  onAct: () => void;
}) {
  const [fc, setFc] = useState<FC[] | null>(null);
  const [place, setPlace] = useState<string | null>(null);

  // Ward name from the shipped boundary files — humans read "Karol Bagh",
  // not an H3 id. Falls back to the raw id when no ward matches.
  useEffect(() => {
    let alive = true;
    setPlace(null);
    placeForCell(city, cell.h3_cell).then((p) => alive && setPlace(p?.label ?? null));
    return () => {
      alive = false;
    };
  }, [city, cell.h3_cell]);

  useEffect(() => {
    setFc(null);
    Promise.all(HORIZONS.map((h) => api<FC[]>(`/forecast?city=${city}&horizon=${h}`).catch(() => [] as FC[])))
      .then((all) => setFc(all.flat().filter((r) => r.h3_cell === cell.h3_cell)))
      .catch(() => setFc([]));
  }, [city, cell.h3_cell]);

  const shares = Object.entries(cell.shares as Shares).sort((a, b) => b[1] - a[1]);
  const dom = dominantSource(cell.shares);
  const ev = cell.evidence ?? {};
  const topSignals = Array.isArray(ev.top_signals) ? ev.top_signals : [];

  // Only surface markers that were actually observed (non-zero) — printing a
  // literal "NO₂ 0" for an unsensed cell reads as broken, not honest.
  const markerBits: string[] = [];
  if (typeof ev.no2 === "number" && ev.no2 > 0) markerBits.push(`NO₂ ${ev.no2.toFixed(0)}`);
  if (typeof ev.no2_sat === "number" && ev.no2_sat > 0) markerBits.push(`satellite NO₂ ${ev.no2_sat.toExponential(1)}`);
  if (typeof ev.pm10_pm25_ratio === "number" && ev.pm10_pm25_ratio > 0)
    markerBits.push(`PM10/PM2.5 ${ev.pm10_pm25_ratio.toFixed(1)}`);

  return (
    <div className="rounded-lg border-2 border-blue-500 bg-white/95 p-3 text-sm shadow-lg">
      <div className="flex items-start justify-between">
        <div>
          <div className="text-[11px] font-semibold uppercase tracking-wide text-blue-600">Cell story</div>
          {place ? (
            <>
              <div className="text-sm font-bold leading-tight text-slate-800">{place}</div>
              <div className="font-mono text-[10px] text-gray-400">~1 km² cell · {cell.h3_cell}</div>
            </>
          ) : (
            <div className="font-mono text-xs text-gray-500">{cell.h3_cell}</div>
          )}
        </div>
        <button aria-label="Close cell story" onClick={onClose} className="rounded px-1.5 text-gray-500 hover:bg-gray-100 hover:text-gray-700">
          ✕
        </button>
      </div>

      {/* 1 — Blame */}
      <div className="mt-2">
        <div className="text-xs font-semibold text-gray-700">
          1 · Who's to blame — <span className="capitalize">{dom.replace("_", " ")}</span>
          <span className="ml-1 font-normal text-gray-400">conf {Math.round(cell.confidence * 100)}%</span>
        </div>
        <div className="mt-1 space-y-1">
          {shares.map(([k, v]) => {
            const [r, g, b] = SOURCE_COLORS[k as keyof typeof SOURCE_COLORS] ?? [120, 120, 120];
            return (
              <div key={k} className="flex items-center gap-2 text-xs">
                <span className="w-24 shrink-0 capitalize text-gray-600">{k.replace("_", " ")}</span>
                <div className="h-2 flex-1 rounded bg-gray-100">
                  <div
                    className="h-2 rounded"
                    style={{ width: `${Math.round(v * 100)}%`, background: `rgb(${r},${g},${b})` }}
                  />
                </div>
                <span className="w-8 text-right font-mono text-gray-500">{Math.round(v * 100)}%</span>
              </div>
            );
          })}
        </div>
        {/* Why this attribution — model-explained (SHAP) when the skill gate
            passed, signature-based otherwise. Never an empty box. */}
        {(ev.shap_drivers ?? []).length > 0 ? (
          <div className="mt-1.5 rounded bg-emerald-50 px-2 py-1.5 text-xs text-emerald-900">
            <div className="font-semibold">Why — model attribution (SHAP, µg/m³)</div>
            <div className="mt-0.5 text-emerald-800">
              {ev.shap_drivers!.map((d) => `${DRIVER_LABELS[d.feature] ?? d.feature} +${d.contribution.toFixed(1)}`).join(" · ")}
            </div>
            {typeof ev.model_r2 === "number" && (
              <div className="mt-0.5 text-[11px] text-emerald-600">
                out-of-sample model R² {ev.model_r2} — passed the ≥0.15 skill gate
              </div>
            )}
          </div>
        ) : (
          <div className="mt-1.5 rounded bg-amber-50 px-2 py-1.5 text-xs text-amber-900">
            <div className="font-semibold">Why — chemical-signature attribution</div>
            <div className="mt-0.5 text-amber-800">
              {topSignals.length
                ? `Marker chemistry points to ${topSignals.map(prettyCat).join(" and ")}.`
                : `Blended from source-marker chemistry for this cell.`}
              {ev.shrunk_toward === "city_hybrid_mean" && " Sparse local sensors → adjusted toward the city mean."}
            </div>
            <div className="mt-0.5 text-[11px] text-amber-600">
              Local model missed the ≥0.15 skill gate here — we fall back to cited chemical-signature priors rather than over-claim.
            </div>
          </div>
        )}
        {markerBits.length > 0 && (
          <div className="mt-1 text-[11px] text-gray-400">evidence: {markerBits.join(" · ")}</div>
        )}
      </div>

      {/* Past — where it has been (daily station history for this cell) */}
      <div className="mt-3">
        <TrendPanel city={city} cell={cell.h3_cell} compact />
      </div>

      {/* 2 — Forecast */}
      <div className="mt-3">
        <div className="text-xs font-semibold text-gray-700">2 · Where it's heading</div>
        {fc === null ? (
          <div className="mt-1 h-8 animate-pulse rounded bg-gray-100" />
        ) : fc.length ? (
          <div className="mt-1 flex gap-2">
            {HORIZONS.map((h) => {
              const r = fc.find((x) => x.horizon_h === h);
              if (!r) return null;
              const cat = aqiCategory(pm25ToAqi(r.value));
              return (
                <div key={h} className="flex-1 rounded-md border border-gray-200 p-1.5 text-center">
                  <div className="text-[11px] text-gray-400">+{h}h</div>
                  <div className="text-sm font-bold" style={{ color: cat.color }}>
                    {Math.round(r.value)}
                  </div>
                  <div className="text-[11px] text-gray-400">
                    [{Math.round(r.pi_low)}–{Math.round(r.pi_high)}]
                  </div>
                </div>
              );
            })}
          </div>
        ) : (
          <div className="mt-1 text-xs text-gray-400">no per-cell forecast (see city panel)</div>
        )}
      </div>

      {/* 3 — Act */}
      <button
        onClick={onAct}
        className="mt-3 w-full rounded bg-blue-600 px-2 py-1.5 text-xs font-semibold text-white hover:bg-blue-700"
      >
        3 · Act — view enforcement actions →
      </button>
    </div>
  );
}
