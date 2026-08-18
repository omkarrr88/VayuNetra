// Exposure-based routing, honest MVP: straight-corridor screening over the
// dense 1 km field — "how much air do I breathe getting there?" — explicitly
// NOT turn-by-turn navigation. Generalizes the clean-zones idea to journeys.
import { useEffect, useMemo, useState } from "react";
import { cellToLatLng } from "h3-js";
import { api } from "./api";

type CoverageCell = { h3_cell: string; pm25?: number };
type Zone = { h3_cell: string; zone_id: string; pm25?: number };

function corridorExposure(
  a: [number, number], b: [number, number],
  cells: Array<{ lat: number; lng: number; pm25: number }>,
): number | null {
  if (!cells.length) return null;
  const samples = 24;
  let sum = 0;
  let counted = 0;
  for (let i = 0; i <= samples; i++) {
    const t = i / samples;
    const lat = a[0] + (b[0] - a[0]) * t;
    const lng = a[1] + (b[1] - a[1]) * t;
    // nearest dense-field cell (fields are ~1 km, cities ~30 km — linear scan is fine)
    let best: number | null = null;
    let bestD = Infinity;
    for (const c of cells) {
      const dLat = c.lat - lat;
      const dLng = (c.lng - lng) * Math.cos((lat * Math.PI) / 180);
      const d2 = dLat * dLat + dLng * dLng;
      if (d2 < bestD) {
        bestD = d2;
        best = c.pm25;
      }
    }
    if (best != null && bestD < 0.01) {
      sum += best;
      counted += 1;
    }
  }
  return counted >= samples / 2 ? sum / counted : null;
}

export default function ExposureCorridors({
  city, center, zones,
}: { city: string; center?: [number, number]; zones: Zone[] }) {
  const [cov, setCov] = useState<CoverageCell[]>([]);
  const [dest, setDest] = useState<string>("");

  useEffect(() => {
    let alive = true;
    setCov([]);
    api<{ cells: CoverageCell[] }>(`/coverage?city=${city}`)
      .then((d) => alive && setCov(d.cells ?? []))
      .catch(() => alive && setCov([]));
    return () => {
      alive = false;
    };
  }, [city]);

  const field = useMemo(
    () =>
      cov
        .filter((c) => typeof c.pm25 === "number")
        .map((c) => {
          const [lat, lng] = cellToLatLng(c.h3_cell);
          return { lat, lng, pm25: c.pm25 as number };
        }),
    [cov],
  );
  const cityMean = useMemo(
    () => (field.length ? field.reduce((s, c) => s + c.pm25, 0) / field.length : null),
    [field],
  );

  if (!center || zones.length === 0 || field.length < 10) return null;

  const chosen = zones.find((z) => z.h3_cell === dest) ?? zones[0];
  const [zLat, zLng] = cellToLatLng(chosen.h3_cell);
  const exposure = corridorExposure([center[1], center[0]], [zLat, zLng], field);
  const deltaPct =
    exposure != null && cityMean ? Math.round(((exposure - cityMean) / cityMean) * 100) : null;

  return (
    <div className="mt-2 rounded-md border border-teal-100 bg-teal-50/60 p-2">
      <div className="text-[11px] font-semibold uppercase tracking-wide text-teal-800">
        Corridor exposure screening
      </div>
      <div className="mt-1 flex items-center gap-1 text-xs text-slate-700">
        <span>city centre →</span>
        <select
          aria-label="Destination clean-air zone"
          value={chosen.h3_cell}
          onChange={(e) => setDest(e.target.value)}
          className="flex-1 rounded border border-teal-200 bg-white px-1 py-0.5 text-xs"
        >
          {zones.map((z) => (
            <option key={z.h3_cell} value={z.h3_cell}>{z.zone_id}</option>
          ))}
        </select>
      </div>
      {exposure != null && (
        <div className="mt-1 text-xs text-slate-700">
          corridor exposure ≈ <b>{Math.round(exposure)} µg/m³</b>
          {deltaPct != null && (
            <span
              className={`ml-1.5 rounded px-1.5 py-0.5 text-[11px] font-semibold ${
                deltaPct <= 0 ? "bg-emerald-100 text-emerald-800" : "bg-amber-100 text-amber-800"
              }`}
            >
              {deltaPct <= 0 ? "" : "+"}{deltaPct}% vs city mean
            </span>
          )}
        </div>
      )}
      <div className="mt-1 text-[11px] leading-4 text-slate-500">
        Straight-corridor screening over the dense 1 km model field — a planning guide, not
        turn-by-turn navigation.
      </div>
    </div>
  );
}
