import { useEffect, useState } from "react";
import type { MapMode } from "./BlameMap";
import { SOURCE_COLORS } from "./sources";
import { pm25Legend, SCALES } from "./aqi";
import { useAqiScale } from "./aqiScale";
import { SegBtn } from "./ui";

const SOURCE_LABEL: Record<string, string> = {
  construction_dust: "construction dust",
  biomass_burning: "biomass burning",
  industrial: "industry",
  transported: "regional transport",
};

export type CoverageMeta = {
  n_cells?: number;
  n_stations?: number;
  cells: unknown[];
  validation?: { skill_vs_bilinear?: number };
} | null;

interface LayersControlProps {
  mode: MapMode;
  onMode: (m: MapMode) => void;
  showSources: boolean;
  onShowSources: (v: boolean) => void;
  showPlumes: boolean;
  onShowPlumes: (v: boolean) => void;
  showWards: boolean;
  onShowWards: (v: boolean) => void;
  showFreight: boolean;
  onShowFreight: (v: boolean) => void;
  showFires: boolean;
  onShowFires: (v: boolean) => void;
  coverageKind: "stations" | "dense";
  onCoverageKind: (k: "stations" | "dense") => void;
  coverage: CoverageMeta;
}

function OverlayToggle({
  on,
  onClick,
  swatch,
  label,
  activeClass,
}: {
  on: boolean;
  onClick: () => void;
  swatch: string;
  label: string;
  activeClass: string;
}) {
  return (
    <button
      onClick={onClick}
      className={`flex w-full items-center justify-between rounded-md px-2 py-1 text-xs font-medium transition-colors ${
        on ? activeClass : "bg-slate-100 text-slate-600 hover:bg-slate-200"
      }`}
    >
      <span className="flex items-center gap-1.5">
        <span className={swatch} />
        {label}
      </span>
      <span>{on ? "on" : "off"}</span>
    </button>
  );
}

/** Google-Maps-style floating layer control: a compact chip that expands into
 *  the full layer card. Lives on the map, so layer options are found where the
 *  layers actually are — not buried in a side rail. */
export default function LayersControl(p: LayersControlProps) {
  const { scale } = useAqiScale();
  // Open by default only where there's room — on phones the expanded card
  // would bury the (much smaller) map.
  // Starts as the compact chip everywhere: the map is the hero and the layer card is a
  // tool you reach for, not a panel that competes with the section rail. The chip shows
  // how many overlays are on so nothing is hidden by surprise.
  const [open, setOpen] = useState(false);
  const overlaysOn = [p.showSources, p.showPlumes, p.showWards, p.showFreight, p.showFires].filter(Boolean).length;

  // Presentation mode toggled at runtime (the P key) — collapse to the chip so
  // the scaled-up card never sits on top of the cell-story drawer.
  useEffect(() => {
    const root = document.documentElement;
    const obs = new MutationObserver(() => {
      if (root.classList.contains("vn-present")) setOpen(false);
    });
    obs.observe(root, { attributes: true, attributeFilter: ["class"] });
    return () => obs.disconnect();
  }, []);

  if (!open) {
    return (
      <button
        onClick={() => setOpen(true)}
        className="vn-pop flex items-center gap-1.5 rounded-lg border border-slate-200 bg-white/95 px-3 py-2 text-xs font-semibold text-slate-700 shadow-lg backdrop-blur transition-colors hover:bg-white"
        title="Map layers"
      >
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="h-4 w-4" aria-hidden="true">
          <path d="m12 2 9 4.9-9 4.9-9-4.9L12 2Zm-9 9.8 9 4.9 9-4.9M3 16.7l9 4.9 9-4.9" />
        </svg>
        Layers
        {overlaysOn > 0 && (
          <span className="rounded-full bg-blue-600 px-1.5 text-[10px] font-bold text-white">{overlaysOn}</span>
        )}
      </button>
    );
  }

  return (
    <div className="vn-pop w-60 rounded-xl border border-slate-200 bg-white/95 p-2.5 shadow-xl backdrop-blur">
      <div className="mb-2 flex items-center justify-between">
        <span className="text-[11px] font-bold uppercase tracking-wide text-slate-500">Map layers</span>
        <button
          onClick={() => setOpen(false)}
          aria-label="Collapse layer panel"
          className="rounded p-0.5 text-slate-500 transition-colors hover:bg-slate-100 hover:text-slate-600"
        >
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="h-3.5 w-3.5" aria-hidden="true">
            <path d="m6 9 6 6 6-6" />
          </svg>
        </button>
      </div>

      <div className="flex gap-1">
        {(["blame", "satellite", "coverage"] as MapMode[]).map((m) => (
          <SegBtn key={m} active={p.mode === m} onClick={() => p.onMode(m)} className="flex-1">
            {m === "blame" ? "Sources" : m === "satellite" ? "Sat NO2" : "PM2.5"}
          </SegBtn>
        ))}
      </div>

      <div className="mt-2 space-y-1.5">
        <OverlayToggle
          on={p.showSources}
          onClick={() => p.onShowSources(!p.showSources)}
          swatch="inline-block h-2.5 w-2.5 rounded-full border border-white bg-slate-900"
          label="Detected sources"
          activeClass="bg-slate-800 text-white"
        />
        <OverlayToggle
          on={p.showPlumes}
          onClick={() => p.onShowPlumes(!p.showPlumes)}
          swatch="inline-block h-2.5 w-2.5 rounded-full border border-white bg-orange-500"
          label="Wind plumes"
          activeClass="bg-orange-600 text-white"
        />
        <OverlayToggle
          on={p.showWards}
          onClick={() => p.onShowWards(!p.showWards)}
          swatch="inline-block h-2.5 w-2.5 rounded-sm border border-slate-500 bg-transparent"
          label="Ward boundaries"
          activeClass="bg-slate-800 text-white"
        />
        <OverlayToggle
          on={p.showFreight}
          onClick={() => p.onShowFreight(!p.showFreight)}
          swatch="inline-block h-2.5 w-2.5 rounded-full border border-white bg-violet-600"
          label="Freight corridors"
          activeClass="bg-violet-700 text-white"
        />
        <OverlayToggle
          on={p.showFires}
          onClick={() => p.onShowFires(!p.showFires)}
          swatch="inline-block h-2.5 w-2.5 rounded-full border border-white bg-orange-600"
          label="Fire / burn events (30d)"
          activeClass="bg-orange-700 text-white"
        />
      </div>
      {p.showWards && (
        <div className="mt-1 text-[10px] text-slate-500">ward boundaries © Datameet / OSM (ODbL)</div>
      )}

      {p.mode === "blame" && (
        <div className="mt-2.5 space-y-1 border-t border-slate-100 pt-2 text-xs">
          {Object.entries(SOURCE_COLORS).map(([k, [r, g, b]]) => (
            <div key={k} className="flex items-center gap-2">
              <span className="inline-block h-3 w-3 rounded" style={{ background: `rgb(${r},${g},${b})` }} />
              <span className="capitalize">{SOURCE_LABEL[k] ?? k.replace("_", " ")}</span>
            </div>
          ))}
        </div>
      )}
      {p.mode === "satellite" && (
        <div className="mt-2.5 border-t border-slate-100 pt-2 text-xs text-slate-600">
          Sentinel-5P NO2 column. Blue is lower, red is higher.
        </div>
      )}
      {p.mode === "coverage" && (
        <div className="mt-2.5 border-t border-slate-100 pt-2 text-xs">
          <div className="flex gap-1">
            {(["stations", "dense"] as const).map((k) => (
              <SegBtn key={k} active={p.coverageKind === k} onClick={() => p.onCoverageKind(k)} className="flex-1">
                {k === "stations" ? "Stations only" : "Dense 1km"}
              </SegBtn>
            ))}
          </div>
          <div className="mt-2 space-y-1">
            <div className="mb-0.5 w-full text-[10px] font-semibold text-slate-500" title={SCALES[scale].note}>{SCALES[scale].short} bands · PM2.5 µg/m³</div>
            {pm25Legend(scale).map(([label, color]) => (
              <div key={label} className="flex items-center gap-2">
                <span className="inline-block h-3 w-3 rounded" style={{ background: color }} />
                <span>{label}</span>
              </div>
            ))}
          </div>
          <div className="mt-1 text-[11px] text-slate-500">
            {p.coverage
              ? `${p.coverage.n_stations ?? "~"} stations → ${p.coverage.n_cells ?? p.coverage.cells.length} cells · ${
                  typeof p.coverage.validation?.skill_vs_bilinear === "number"
                    ? `+${Math.round(p.coverage.validation.skill_vs_bilinear * 100)}% skill vs interpolation (synthetic-field validation)`
                    : "experimental — covariate-guided interpolation"
                }`
              : "loading field…"}
          </div>
        </div>
      )}
    </div>
  );
}
