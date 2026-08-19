// The live map, full-bleed. The overview page deliberately carries no map, so this page is where
// the 1 km grid lives: the same BlameMap the console uses, with the same layers and the same cell
// story — only the officer-only actions are absent, because a citizen has nothing to dispatch.
import { useEffect, useState } from "react";
import "maplibre-gl/dist/maplibre-gl.css";
import BlameMap, { type AttrCell, type CoverageCell, type MapMode } from "../BlameMap";
import LayersControl, { type CoverageMeta } from "../LayersControl";
import CellStoryPanel from "../CellStoryPanel";
import AqiHeader from "../AqiHeader";
import { api } from "../api";
import { navigate } from "../router";
import { Text } from "../design/ui";
import { useSite, type City } from "./context";

type LngLat = [number, number];
const DELHI: LngLat = [77.21, 28.61];

function toLngLat(center: City["center"] | { coordinates: [number, number] } | undefined): LngLat {
  const co = Array.isArray(center) ? center : (center as { coordinates?: [number, number] } | undefined)?.coordinates;
  return Array.isArray(co) && Number.isFinite(co[0]) && Number.isFinite(co[1]) ? [co[0], co[1]] : DELHI;
}

export default function MapPage() {
  const { city, name, cities } = useSite();
  const [mode, setMode] = useState<MapMode>("blame");
  const [cell, setCell] = useState<AttrCell | null>(null);
  const [showSources, setShowSources] = useState(false);
  const [showPlumes, setShowPlumes] = useState(false);
  const [showWards, setShowWards] = useState(false);
  const [showFreight, setShowFreight] = useState(false);
  const [showFires, setShowFires] = useState(false);
  const [coverageKind, setCoverageKind] = useState<"stations" | "dense">("dense");
  const [coverage, setCoverage] = useState<CoverageMeta>(null);

  useEffect(() => { setCell(null); }, [city]);
  useEffect(() => {
    let live = true;
    api<CoverageMeta>(`/coverage?city=${city}`).then((c) => { if (live) setCoverage(c); }).catch(() => { if (live) setCoverage(null); });
    return () => { live = false; };
  }, [city]);

  const center = toLngLat(cities.find((c) => c.city_id === city)?.center);

  return (
    <div style={{ position: "relative", height: "calc(100dvh - 60px)", minHeight: 460, width: "100%" }}>
      <BlameMap
        city={city}
        center={center}
        bbox={cities.find((c) => c.city_id === city)?.bbox}
        mode={mode}
        selected={cell?.h3_cell}
        onSelect={setCell}
        showSources={showSources}
        showPlumes={showPlumes}
        showWards={showWards}
        showFreight={showFreight}
        showFires={showFires}
        coverageCells={(coverage?.cells ?? []) as CoverageCell[]}
        coverageKind={coverageKind}
      />

      <div style={{ position: "absolute", left: "var(--s-3)", top: "var(--s-3)", zIndex: 10, display: "flex", flexWrap: "wrap", gap: "var(--s-2)", maxWidth: "calc(100% - 24px)" }}>
        <AqiHeader city={city} />
      </div>

      {/* Above the cell story, not merely equal to it: both used zIndex 10, so paint order fell
          to DOM order and the story — which comes later — covered the layer menu when open. */}
      <div style={{ position: "absolute", right: "var(--s-3)", top: "var(--s-3)", zIndex: 20 }}>
        <LayersControl
          mode={mode} onMode={setMode}
          showSources={showSources} onShowSources={setShowSources}
          showPlumes={showPlumes} onShowPlumes={setShowPlumes}
          showWards={showWards} onShowWards={setShowWards}
          showFreight={showFreight} onShowFreight={setShowFreight}
          showFires={showFires} onShowFires={setShowFires}
          coverageKind={coverageKind} onCoverageKind={setCoverageKind}
          coverage={coverage}
        />
      </div>

      {/* The panel ends above the basemap attribution: OpenStreetMap and CARTO require it to
          stay visible, and moving this to the right put it directly on top. */}
      {cell && (
        <div className="vn-sheet vn-scroll-thin" style={{ position: "absolute", right: "var(--s-3)", bottom: "calc(var(--s-3) + 1.75rem)", top: "5.5rem", zIndex: 10, width: "min(20rem, calc(100% - 24px))", overflowY: "auto", borderRadius: "var(--r-lg)" }}>
          <CellStoryPanel
            city={city}
            cell={cell}
            onClose={() => setCell(null)}
            onAct={() => navigate(`/console?city=${city}&section=action&cell=${cell.h3_cell}`)}
          />
        </div>
      )}

      {!cell && (
        <div style={{ position: "absolute", left: "50%", bottom: "var(--s-4)", transform: "translateX(-50%)", zIndex: 10, pointerEvents: "none" }}>
          <div className="vn-fade" style={{ background: "var(--glass)", backdropFilter: "blur(12px)", border: "1px solid var(--glass-line)", borderRadius: "var(--r-full)", padding: "7px 14px", boxShadow: "var(--e-2)" }}>
            <Text size="xs" tone="ink2" weight={600}>Tap any cell to see what is polluting it in {name}</Text>
          </div>
        </div>
      )}
    </div>
  );
}
