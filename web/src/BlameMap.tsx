import { useEffect, useRef, useState } from "react";
import maplibregl from "maplibre-gl";
import { MapboxOverlay } from "@deck.gl/mapbox";
import { H3HexagonLayer } from "@deck.gl/geo-layers";
import { GeoJsonLayer, LineLayer, PolygonLayer, ScatterplotLayer } from "@deck.gl/layers";
import { api } from "./api";
import { cellToLatLng } from "h3-js";
import { inGeometry, type Geometry } from "./placeName";
import { colorFor, dominantSource, pm25Color, satColor, type Shares } from "./sources";

export type ShapDriver = { feature: string; source: string; contribution: number };

// Emission sources plotted as an optional overlay (registry/OSM today; E1 CV
// detections drop in later via the same shape with source_origin="cv_detected").
export type EmissionSource = {
  id: string;
  name: string;
  type: string;
  source_origin?: string;
  detection_confidence?: number;
  coordinates: [number, number];
};

// Satellite patch for a hovered source — fetched lazily, cached, and the
// tooltip re-renders once it lands. Only rec sources have patches; others
// simply show no image (never a fake one).
type Patch = { image_ref: string | null; title?: string | null; placeholder?: boolean };
const patchCache = new Map<string, Patch | "loading">();
function patchFor(id: string, onReady: () => void): Patch | null {
  const hit = patchCache.get(id);
  if (hit === "loading") return null;
  if (hit) return hit;
  patchCache.set(id, "loading");
  api<Patch>(`/sources/${id}/patch`)
    .then((p) => { patchCache.set(id, p ?? { image_ref: null }); onReady(); })
    .catch(() => patchCache.set(id, { image_ref: null }));
  return null;
}

// The live API returns PostGIS GeoJSON (`geom.coordinates`); fixtures use a flat
// `coordinates`. Normalize both so the overlay renders on real data too.
type RawSource = Omit<EmissionSource, "coordinates"> & {
  coordinates?: [number, number];
  geom?: { coordinates?: [number, number] } | null;
};

function normalizeSources(rows: RawSource[]): EmissionSource[] {
  return rows
    .map((s) => ({ ...s, coordinates: s.coordinates ?? s.geom?.coordinates }))
    .filter((s): s is EmissionSource => Array.isArray(s.coordinates) && s.coordinates.length === 2);
}

// Wind-oriented Gaussian plume footprints from /plume (relative intensity —
// source category x detection confidence; the API says so in its `note`).
export type Plume = {
  id: number | string;
  name: string;
  type: string;
  intensity: number;
  origin: [number, number];
  polygon: [number, number][];
};

export type PlumeWind = {
  speed_ms: number;
  bearing_deg: number;
  calm: boolean;
  stability: string;
};

type PlumeData = { wind: PlumeWind | null; plumes: Plume[]; reach_m?: number; note?: string };

// Ward boundary GeoJSON (web/public/wards/{city}.geojson — datameet, ODbL).
type WardFeature = { properties: { ward_id: string; name: string } };
type WardCollection = { type: "FeatureCollection"; features: WardFeature[] };

// Freight corridors (web/public/corridors/{city}.geojson — real OSM
// motorway/trunk ways; policy = the city's real truck-hours rule).
type FreightFeature = { properties: { name: string; highway?: string; policy?: string } };
type FreightCollection = { type: "FeatureCollection"; features: FreightFeature[] };

const COMPASS = ["N", "NNE", "NE", "ENE", "E", "ESE", "SE", "SSE", "S", "SSW", "SW", "WSW", "W", "WNW", "NW", "NNW"];

function compass(bearingDeg: number): string {
  return COMPASS[Math.round(((bearingDeg % 360) + 360) % 360 / 22.5) % 16];
}

// E2 dense-coverage cell: dense (downscaled ~1 km) + sparse (stations-only) PM2.5.
export type CoverageCell = {
  h3_cell: string;
  pm25: number;
  pm25_stations: number;
  uncertainty: number;
};

export type AttrCell = {
  h3_cell: string;
  shares: Shares;
  confidence: number;
  evidence?: {
    no2?: number;
    no2_sat?: number;
    pm10_pm25_ratio?: number;
    shap_drivers?: ShapDriver[];
    model_r2?: number;
    top_signals?: string[];
    shrunk_toward?: string;
    [k: string]: unknown;
  };
};

// readable labels for SHAP driver features
export const DRIVER_LABELS: Record<string, string> = {
  no2: "NO₂",
  co: "CO",
  so2: "SO₂",
  no2_sat: "satellite NO₂",
  pm10_pm25_ratio: "PM10/PM2.5 ratio",
  fire: "fire (FIRMS)",
  advected_pm25: "upwind PM2.5",
};

export type MapMode = "blame" | "satellite" | "coverage";

// Clean light raster basemap (CARTO, free, no API key) — colored hexagons pop on it.
const BASEMAP = {
  version: 8,
  sources: {
    carto: {
      type: "raster",
      tiles: [
        "https://a.basemaps.cartocdn.com/light_all/{z}/{x}/{y}.png",
        "https://b.basemaps.cartocdn.com/light_all/{z}/{x}/{y}.png",
      ],
      tileSize: 256,
      attribution: "© OpenStreetMap © CARTO",
    },
  },
  layers: [{ id: "carto", type: "raster", source: "carto" }],
} as unknown as maplibregl.StyleSpecification;

const ZOOM = 10.5;

function tooltip(c: AttrCell, mode: MapMode) {
  if (mode === "satellite") {
    const v = c.evidence?.no2_sat ?? 0;
    return { html: `satellite NO₂ column<br/><b>${v.toExponential(2)}</b> mol/m²`, style: { fontSize: "12px" } };
  }
  const top = Object.entries(c.shares)
    .sort((a, b) => b[1] - a[1])
    .slice(0, 3)
    .map(([k, v]) => `${k.replace("_", " ")} ${Math.round(v * 100)}%`)
    .join("<br/>");
  const ev = c.evidence ?? {};
  const drivers = (ev.shap_drivers ?? [])
    .map((d) => `${DRIVER_LABELS[d.feature] ?? d.feature} +${d.contribution.toFixed(1)}`)
    .join(" · ");
  return {
    html:
      `<b>${dominantSource(c.shares).replace("_", " ")}</b> · conf ${c.confidence}<br/>${top}` +
      (drivers ? `<br/><span style="color:#4ade80">SHAP drivers: ${drivers} µg/m³</span>` : "") +
      `<br/><span style="color:#888">NO₂ ${ev.no2 ?? "–"} · sat ${(ev.no2_sat ?? 0).toExponential?.(1) ?? "–"} · PM10/PM2.5 ${ev.pm10_pm25_ratio ?? "–"}</span>`,
    style: { fontSize: "12px" },
  };
}

export default function BlameMap({
  city,
  center,
  mode,
  selected,
  onSelect,
  onCellsLoaded,
  showSources = false,
  showPlumes = false,
  showWards = false,
  showFreight = false,
  showFires = false,
  coverageCells = [],
  coverageKind = "dense",
  scrub = null,
}: {
  city: string;
  center: [number, number];
  mode: MapMode;
  selected?: string | null;
  onSelect?: (cell: AttrCell | null) => void;
  onCellsLoaded?: (cells: AttrCell[]) => void;
  showSources?: boolean;
  showPlumes?: boolean;
  showWards?: boolean;
  showFreight?: boolean;
  showFires?: boolean;
  coverageCells?: CoverageCell[];
  coverageKind?: "stations" | "dense";
  scrub?: { hour: string; scale: Record<string, number> } | null;
}) {
  const containerRef = useRef<HTMLDivElement>(null);
  const mapRef = useRef<maplibregl.Map | null>(null);
  const overlayRef = useRef<MapboxOverlay | null>(null);
  const [cells, setCells] = useState<AttrCell[]>([]);
  const [patchTick, setPatchTick] = useState(0); // bumps when a hovered source's patch arrives
  const [sources, setSources] = useState<EmissionSource[]>([]);
  const [plume, setPlume] = useState<PlumeData | null>(null);
  const [wards, setWards] = useState<WardCollection | null>(null);
  const wardMeansRef = useRef<Map<string, number>>(new Map());
  const [wardMeansVersion, setWardMeansVersion] = useState(0);
  useEffect(() => {
    if (!wards || !coverageCells.length) { wardMeansRef.current = new Map(); setWardMeansVersion((v) => v + 1); return; }
    const sums = new Map<string, [number, number]>();
    const feats = wards.features as Array<WardFeature & { geometry: Geometry }>;
    for (const c of coverageCells) {
      const [lat, lng] = cellToLatLng(c.h3_cell);
      for (const f of feats) {
        if (f.geometry && inGeometry(lng, lat, f.geometry)) {
          const k = f.properties.ward_id;
          const cur = sums.get(k) ?? [0, 0];
          sums.set(k, [cur[0] + c.pm25, cur[1] + 1]);
          break;
        }
      }
    }
    const out = new Map<string, number>();
    for (const [k, [sum, n]] of sums) if (n) out.set(k, sum / n);
    wardMeansRef.current = out;
    setWardMeansVersion((v) => v + 1);
  }, [wards, coverageCells]);
  const [freight, setFreight] = useState<FreightCollection | null>(null);
  const [fires, setFires] = useState<import("geojson").FeatureCollection | null>(null);
  const [phase, setPhase] = useState(0);

  const [mapError, setMapError] = useState(false);

  useEffect(() => {
    if (!containerRef.current || mapRef.current) return;
    try {
      const map = new maplibregl.Map({ container: containerRef.current, style: BASEMAP, center, zoom: ZOOM });
      const overlay = new MapboxOverlay({ interleaved: false, layers: [] });
      map.addControl(overlay);
      map.on("error", () => {}); // tile fetch failures shouldn't spam the console
      mapRef.current = map;
      overlayRef.current = overlay;
    } catch {
      // WebGL unavailable (headless VM, blocked GPU) — panels still work.
      setMapError(true);
    }
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => {
    const [lng, lat] = center;
    if (Number.isFinite(lng) && Number.isFinite(lat)) {
      mapRef.current?.flyTo({ center, zoom: ZOOM });
    }
  }, [center]);

  useEffect(() => {
    let alive = true; // rapid city switches: a slow older fetch must not win
    api<AttrCell[]>(`/attribution?city=${city}`)
      .then((c) => {
        if (!alive) return;
        setCells(c);
        onCellsLoaded?.(c);
      })
      .catch(() => alive && setCells([]));
    return () => {
      alive = false;
    };
  }, [city]); // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => {
    let alive = true;
    api<{ emission_sources?: RawSource[] }>(`/static-layers?city=${city}`)
      .then((d) => alive && setSources(normalizeSources(d.emission_sources ?? [])))
      .catch(() => alive && setSources([]));
    return () => {
      alive = false;
    };
  }, [city]);

  useEffect(() => {
    if (!showPlumes) return;
    let alive = true;
    setPlume(null);
    api<PlumeData>(`/plume?city=${city}`)
      .then((d) => alive && setPlume(d))
      .catch(() => alive && setPlume(null));
    return () => {
      alive = false;
    };
  }, [city, showPlumes]);

  useEffect(() => {
    if (!showWards) return;
    let alive = true;
    setWards(null);
    // static asset from web/public — works offline and in DEMO_MODE
    fetch(`/wards/${city}.geojson`)
      .then((r) => (r.ok ? (r.json() as Promise<WardCollection>) : null))
      .then((d) => alive && setWards(d))
      .catch(() => alive && setWards(null));
    return () => {
      alive = false;
    };
  }, [city, showWards]);

  useEffect(() => {
    if (!showFreight) return;
    let alive = true;
    setFreight(null);
    fetch(`/corridors/${city}.geojson`)
      .then((r) => (r.ok ? (r.json() as Promise<FreightCollection>) : null))
      .then((d) => alive && setFreight(d))
      .catch(() => alive && setFreight(null));
    return () => {
      alive = false;
    };
  }, [city, showFreight]);

  useEffect(() => {
    if (!showFires) return;
    let alive = true;
    setFires(null);
    fetch(`/fires/${city}.geojson`)
      .then((r) => (r.ok ? (r.json() as Promise<import("geojson").FeatureCollection>) : null))
      .then((d) => alive && setFires(d))
      .catch(() => alive && setFires(null));
    return () => {
      alive = false;
    };
  }, [city, showFires]);

  // Slow opacity pulse gives the plumes a "drifting" feel without particle cost.
  useEffect(() => {
    if (!showPlumes) return;
    const t = setInterval(() => setPhase((p) => (p + 1) % 100000), 160);
    return () => clearInterval(t);
  }, [showPlumes]);

  useEffect(() => {
    const blame = new H3HexagonLayer<AttrCell>({
      id: "blame",
      data: cells,
      getHexagon: (d) => d.h3_cell,
      getFillColor: (d) => (mode === "satellite" ? satColor(d.evidence?.no2_sat ?? 0) : colorFor(d.shares)),
      getLineColor: (d) => (d.h3_cell === selected ? [30, 64, 175, 255] : [255, 255, 255, 90]),
      getLineWidth: (d) => (d.h3_cell === selected ? 3 : 1),
      lineWidthMinPixels: 1,
      lineWidthUnits: "pixels",
      extruded: false,
      pickable: true,
      onClick: ({ object }: { object?: AttrCell }) => {
        onSelect?.(object && object.h3_cell !== selected ? object : null);
        return true;
      },
      updateTriggers: { getFillColor: mode, getLineColor: selected, getLineWidth: selected },
    });

    // E2 dense-coverage PM2.5 field — replaces the blame layer when active.
    const coverage = new H3HexagonLayer<CoverageCell>({
      id: "coverage",
      data: coverageCells,
      getHexagon: (d) => d.h3_cell,
      getFillColor: (d) => {
        const base = coverageKind === "stations" ? d.pm25_stations : d.pm25;
        const k = scrub ? (scrub.scale[d.h3_cell] ?? 1) : 1;
        return pm25Color(base * k);
      },
      stroked: false,
      extruded: false,
      pickable: true,
      transitions: { getFillColor: 400 },
      updateTriggers: { getFillColor: [coverageKind, scrub?.hour ?? "live"] },
    });

    type AnyLayer =
      | H3HexagonLayer<AttrCell>
      | H3HexagonLayer<CoverageCell>
      | ScatterplotLayer<EmissionSource>
      | PolygonLayer<Plume>
      | LineLayer<{ from: [number, number]; to: [number, number] }>
      | GeoJsonLayer;
    // (freight corridors reuse GeoJsonLayer)
    const layers: AnyLayer[] = [mode === "coverage" ? coverage : blame];
    if (showWards && wards) {
      // Ward heat: mean PM2.5 of the dense-field cells inside each ward — the
      // unit NCAP officers think and report in. Computed once per (wards, field).
      const wardMean = wardMeansRef.current;
      layers.push(
        new GeoJsonLayer({
          id: "wards",
          data: wards as unknown as import("geojson").FeatureCollection,
          stroked: true,
          filled: true,
          getFillColor: (f: unknown) => {
            const wid = (f as WardFeature).properties?.ward_id;
            const m = wid ? wardMean.get(wid) : undefined;
            if (m === undefined) return [148, 163, 184, 8];
            const [r, g, b] = pm25Color(m);
            return [r, g, b, 95];
          },
          getLineColor: [51, 65, 85, 170],
          lineWidthMinPixels: 1,
          pickable: true,
          updateTriggers: { getFillColor: wardMeansVersion },
        }),
      );
    }
    if (showFreight && freight) {
      layers.push(
        new GeoJsonLayer({
          id: "freight",
          data: freight as unknown as import("geojson").FeatureCollection,
          stroked: true,
          filled: false,
          getLineColor: [124, 58, 237, 190],
          lineWidthMinPixels: 2,
          pickable: true,
        }),
      );
    }
    if (showFires && fires?.features?.length) {
      layers.push(
        new GeoJsonLayer({
          id: "fires",
          data: fires,
          pointType: "circle",
          getPointRadius: 380,
          pointRadiusUnits: "meters",
          getFillColor: [234, 88, 12, 200],
          getLineColor: [255, 237, 213, 220],
          lineWidthMinPixels: 1,
          stroked: true,
          pickable: true,
        }),
      );
    }
    // Wind arrows — a sparse grid over the city, all carrying the city-mean
    // wind (direction + speed as length), so a viewer can see WHY the plumes
    // point the way they do. Rendered as short LineLayers with an arrow tip.
    if (showPlumes && plume?.wind && !plume.wind.calm && cells.length) {
      const w = plume.wind;
      const lats = cells.map((c) => cellToLatLng(c.h3_cell)[0]);
      const lngs = cells.map((c) => cellToLatLng(c.h3_cell)[1]);
      const minLat = Math.min(...lats), maxLat = Math.max(...lats), minLng = Math.min(...lngs), maxLng = Math.max(...lngs);
      const rows = 6, cols = 8;
      const toDeg = (b: number) => (b * Math.PI) / 180;
      // bearing_deg is the direction the wind blows TOWARD (u/v convention)
      const dirLat = Math.cos(toDeg(w.bearing_deg));
      const dirLng = Math.sin(toDeg(w.bearing_deg));
      const len = Math.min(0.02, 0.006 + w.speed_ms * 0.0025); // degrees, ~0.6–2 km
      const segs: Array<{ from: [number, number]; to: [number, number] }> = [];
      for (let r = 0; r < rows; r++) for (let c = 0; c < cols; c++) {
        const lat = minLat + ((r + 0.5) / rows) * (maxLat - minLat);
        const lng = minLng + ((c + 0.5) / cols) * (maxLng - minLng);
        const midLat = lat, midLng = lng;
        segs.push({ from: [midLng - dirLng * len * 0.5, midLat - dirLat * len * 0.5], to: [midLng + dirLng * len * 0.5, midLat + dirLat * len * 0.5] });
      }
      // arrow tips: two short strokes off the head
      const tips: Array<{ from: [number, number]; to: [number, number] }> = [];
      for (const sgm of segs) {
        const [hx, hy] = sgm.to; const back = len * 0.28;
        for (const ang of [150, -150]) {
          const a = toDeg(w.bearing_deg + ang);
          tips.push({ from: [hx, hy], to: [hx + Math.sin(a) * back, hy + Math.cos(a) * back] });
        }
      }
      layers.push(
        new LineLayer<{ from: [number, number]; to: [number, number] }>({
          id: "wind-arrows",
          data: [...segs, ...tips],
          getSourcePosition: (d) => d.from,
          getTargetPosition: (d) => d.to,
          getColor: [30, 41, 59, 150],
          getWidth: 2,
          widthUnits: "pixels",
          pickable: false,
        }),
      );
    }
    if (showPlumes && plume?.plumes?.length) {
      layers.push(
        new PolygonLayer<Plume>({
          id: "plumes",
          data: plume.plumes,
          getPolygon: (d) => d.polygon,
          getFillColor: (d, { index }) => {
            const pulse = 0.72 + 0.28 * Math.sin(phase / 4 + index * 0.9);
            return [234, 88, 12, Math.min(210, Math.round(30 + 150 * d.intensity * pulse))];
          },
          stroked: false,
          pickable: true,
          updateTriggers: { getFillColor: phase },
        }),
      );
    }
    if (showSources && sources.length) {
      layers.push(
        new ScatterplotLayer<EmissionSource>({
          id: "sources",
          data: sources,
          getPosition: (d) => d.coordinates,
          getRadius: (d) => 140 + 240 * (d.detection_confidence ?? 0.5),
          radiusUnits: "meters",
          radiusMinPixels: 5,
          radiusMaxPixels: 24,
          stroked: true,
          getFillColor: [17, 24, 39, 235],
          getLineColor: [255, 255, 255, 235],
          lineWidthMinPixels: 1.5,
          pickable: true,
        }),
      );
    }

    overlayRef.current?.setProps({
      layers,
      getTooltip: (info: { object?: AttrCell | CoverageCell | EmissionSource | Plume | WardFeature }) => {
        const o = info?.object;
        if (!o) return null;
        if ("shares" in o) return tooltip(o, mode);
        if ("pm25" in o) {
          const val = coverageKind === "stations" ? o.pm25_stations : o.pm25;
          return {
            html: `<b>${Math.round(val)} µg/m³</b> PM2.5 · ${coverageKind}<br/><span style="color:#888">±${o.uncertainty} µg/m³ uncertainty</span>`,
            style: { fontSize: "12px" },
          };
        }
        if ("polygon" in o && "intensity" in o) {
          const w = plume?.wind;
          return {
            html:
              `<b>${o.name}</b><br/>${(o.type ?? "source").replace("_", " ")} plume · relative intensity ${Math.round(o.intensity * 100)}%` +
              (w ? `<br/><span style="color:#888">wind ${w.speed_ms} m/s → ${compass(w.bearing_deg)} · Gaussian (Briggs urban)</span>` : ""),
            style: { fontSize: "12px" },
          };
        }
        if ("properties" in o) {
          const p = o.properties as { ward_id?: string; name: string; highway?: string; policy?: string };
          if (p.ward_id) {
            const m = wardMeansRef.current.get(p.ward_id);
            return {
              html: `<b>${p.name}</b><br/><span style="color:#888">ward ${p.ward_id}</span>` +
                (m !== undefined ? `<br/><b>${Math.round(m)} µg/m³</b> mean PM2.5 (dense field)` : ""),
              style: { fontSize: "12px" },
            };
          }
          return {
            html:
              `<b>${p.name}</b><br/><span style="color:#888">diesel freight corridor (OSM ${p.highway ?? "trunk"})</span>` +
              (p.policy ? `<br/><span style="color:#7c3aed">${p.policy}</span>` : ""),
            style: { fontSize: "12px" },
          };
        }
        const patch = patchFor(String(o.id), () => setPatchTick((t) => t + 1));
        const img = patch?.image_ref && !patch.placeholder
          ? `<img src="${patch.image_ref}" alt="" style="display:block;width:220px;height:146px;object-fit:cover;border-radius:6px;margin-bottom:6px" />` +
            `<div style="color:#0369a1;font-size:10px;font-weight:600;letter-spacing:.04em;margin-bottom:2px">SENTINEL-2 · REAL SITE IMAGERY</div>`
          : "";
        return {
          html: `${img}<b>${o.name}</b><br/>${o.type.replace("_", " ")} · ${Math.round((o.detection_confidence ?? 0) * 100)}% · ${o.source_origin ?? "registry"}`,
          style: { fontSize: "12px", maxWidth: "240px" },
        };
      },
    });
  }, [cells, mode, selected, onSelect, showSources, sources, coverageCells, coverageKind, showPlumes, plume, showWards, wards, wardMeansVersion, showFreight, freight, phase, patchTick]);

  return (
    <div className="relative h-full w-full">
      <div ref={containerRef} className="h-full w-full" />
      {showPlumes && plume?.wind && (
        <div className="absolute bottom-2 left-1/2 z-10 flex -translate-x-1/2 items-center gap-1.5 whitespace-nowrap rounded-md border border-slate-200 bg-white/95 px-2.5 py-1.5 text-[11px] font-medium text-slate-700 shadow">
          <span aria-hidden="true" className="inline-block text-orange-600" style={{ transform: `rotate(${plume.wind.bearing_deg}deg)` }}>
            ↑
          </span>
          wind {plume.wind.speed_ms} m/s → {compass(plume.wind.bearing_deg)}
          {plume.wind.calm ? " · calm, pollution pooling" : ""} · stability {plume.wind.stability}
        </div>
      )}
      {mapError && (
        <div className="absolute inset-0 flex items-center justify-center bg-slate-100 p-6 text-center text-sm text-slate-500">
          Map view unavailable on this device — the analysis panels still work.
        </div>
      )}
    </div>
  );
}
