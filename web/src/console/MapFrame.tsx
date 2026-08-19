// The map, as a panel inside a page rather than a backdrop behind one. Everything that used to
// float over the full-bleed map lives here — live index, layers, time scrub, cell story — with the
// same props and the same handlers, so behaviour is unchanged and only the frame is new.
import { type ReactNode } from "react";
import BlameMap, { type AttrCell, type CoverageCell, type MapMode } from "../BlameMap";
import LayersControl, { type CoverageMeta } from "../LayersControl";
import CellStoryPanel from "../CellStoryPanel";
import AqiHeader from "../AqiHeader";
import LatencyWidget from "../LatencyWidget";
import TimeScrub, { type ScrubFrame } from "../TimeScrub";
import { Text } from "../design/ui";

export type MapFrameProps = {
  city: string;
  center: [number, number];
  mode: MapMode;
  onMode: (m: MapMode) => void;
  cell: AttrCell | null;
  onSelect: (c: AttrCell | null) => void;
  onCellsLoaded?: (cells: AttrCell[]) => void;
  onAct: () => void;
  showSources: boolean; onShowSources: (v: boolean) => void;
  showPlumes: boolean; onShowPlumes: (v: boolean) => void;
  showWards: boolean; onShowWards: (v: boolean) => void;
  showFreight: boolean; onShowFreight: (v: boolean) => void;
  showFires: boolean; onShowFires: (v: boolean) => void;
  coverageKind: "stations" | "dense"; onCoverageKind: (k: "stations" | "dense") => void;
  coverage: CoverageMeta;
  scrub: ScrubFrame;
  onScrub: (f: ScrubFrame) => void;
  /** The city's extent as /cities gave it — the map normalises and frames it on arrival. */
  bbox?: unknown;
  caption?: ReactNode;
};

export default function MapFrame(p: MapFrameProps) {
  return (
    <div
      data-tour="map"
      className="vn-rise vn-mapbox"
      style={{
        // A fixed height on purpose: the box must not resize when the city changes, when the
        // cell story opens, or when the page below it gets longer or shorter.
        position: "relative", width: "100%", height: 540,
        borderRadius: "var(--r-lg)", overflow: "hidden",
        border: "1px solid var(--line)", boxShadow: "var(--e-2)", background: "var(--surface-2)",
      }}
    >
      <BlameMap
        city={p.city}
        center={p.center}
        mode={p.mode}
        selected={p.cell?.h3_cell}
        onSelect={p.onSelect}
        onCellsLoaded={p.onCellsLoaded}
        showSources={p.showSources}
        showPlumes={p.showPlumes}
        showWards={p.showWards}
        showFreight={p.showFreight}
        showFires={p.showFires}
        coverageCells={(p.coverage?.cells ?? []) as CoverageCell[]}
        coverageKind={p.coverageKind}
        scrub={p.scrub}
        bbox={p.bbox}
      />

      <div style={{ position: "absolute", left: "var(--s-3)", top: "var(--s-3)", zIndex: 10, display: "flex", flexWrap: "wrap", gap: "var(--s-2)", maxWidth: "min(60%, 34rem)" }}>
        <AqiHeader city={p.city} />
        <LatencyWidget city={p.city} />
      </div>

      {/* Above the cell story, not merely equal to it: both used zIndex 10, so paint order fell
          to DOM order and the story — which comes later — covered the layer menu when open. */}
      <div style={{ position: "absolute", right: "var(--s-3)", top: "var(--s-3)", zIndex: 20 }}>
        <LayersControl
          mode={p.mode} onMode={p.onMode}
          showSources={p.showSources} onShowSources={p.onShowSources}
          showPlumes={p.showPlumes} onShowPlumes={p.onShowPlumes}
          showWards={p.showWards} onShowWards={p.onShowWards}
          showFreight={p.showFreight} onShowFreight={p.onShowFreight}
          showFires={p.showFires} onShowFires={p.onShowFires}
          coverageKind={p.coverageKind} onCoverageKind={p.onCoverageKind}
          coverage={p.coverage}
        />
      </div>

      {/* The panel ends above the basemap attribution: OpenStreetMap and CARTO require it to
          stay visible, and moving this to the right put it directly on top. */}
      {p.cell && (
        <div className="vn-sheet vn-scroll-thin" style={{ position: "absolute", right: "var(--s-3)", top: "4.75rem", bottom: "calc(var(--s-3) + 1.75rem)", zIndex: 10, width: "min(19rem, calc(100% - 24px))", overflowY: "auto", borderRadius: "var(--r-lg)" }}>
          <CellStoryPanel city={p.city} cell={p.cell} onClose={() => p.onSelect(null)} onAct={p.onAct} />
        </div>
      )}

      <div style={{ position: "absolute", left: "50%", bottom: "var(--s-3)", transform: "translateX(-50%)", zIndex: 10 }}>
        <TimeScrub city={p.city} denseCells={(p.coverage?.cells ?? []) as CoverageCell[]} onFrame={p.onScrub} />
      </div>

      {p.caption && !p.cell && (
        <div style={{ position: "absolute", left: "var(--s-3)", bottom: "var(--s-3)", zIndex: 9, maxWidth: "16rem" }}>
          <div style={{ background: "var(--glass)", backdropFilter: "blur(12px)", border: "1px solid var(--glass-line)", borderRadius: "var(--r-md)", padding: "6px 10px", boxShadow: "var(--e-1)" }}>
            <Text size="2xs" tone="ink2" weight={600}>{p.caption}</Text>
          </div>
        </div>
      )}
    </div>
  );
}
