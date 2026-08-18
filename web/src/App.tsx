import { useEffect, useRef, useState } from "react";
import "maplibre-gl/dist/maplibre-gl.css";
import BlameMap, { type AttrCell, type CoverageCell, type MapMode } from "./BlameMap";
import ForecastPanel from "./ForecastPanel";
import ValidationPanel from "./ValidationPanel";
import InterventionsHindsight from "./InterventionsHindsight";
import BriefCard from "./BriefCard";
import { api } from "./api";
import AqiHeader from "./AqiHeader";
import CellStoryPanel from "./CellStoryPanel";
import LatencyWidget from "./LatencyWidget";
import EnforcementPanel from "./EnforcementPanel";
import CitizenPanel from "./CitizenPanel";
import ComparativePanel from "./ComparativePanel";
import CityIntelPanel from "./CityIntelPanel";
import TraceViewer from "./TraceViewer";
import WhatIfPanel from "./WhatIfPanel";
import RoiPanel from "./RoiPanel";
import FairnessPanel from "./FairnessPanel";
import CityStatsPanel from "./CityStatsPanel";
import InterventionsPanel from "./InterventionsPanel";
import DispatchQueues from "./DispatchQueues";
import LayersControl from "./LayersControl";
import TimeScrub, { type ScrubFrame } from "./TimeScrub";
import { Sidebar, BottomNav, type Section } from "./Sidebar";
import TopBar from "./TopBar";
import Tour, { tourSeen } from "./Tour";
import SectionHeader from "./console/SectionHeader";
import { FLOWS } from "./console/flows";
import { Step } from "./ui";

type LngLat = [number, number];
type GeoPoint = { coordinates: [number, number] };
type City = { city_id: string; name: string; center?: LngLat | GeoPoint; languages?: string[] };

const DELHI: LngLat = [77.21, 28.61];

// /cities returns `center` as a plain [lng,lat] (demo fixtures) OR a GeoJSON
// Point (live PostGIS). Normalize both to a finite [lng,lat] for MapLibre.
function toLngLat(center: City["center"]): LngLat {
  const co = Array.isArray(center) ? center : center?.coordinates;
  if (Array.isArray(co) && Number.isFinite(co[0]) && Number.isFinite(co[1])) {
    return [co[0], co[1]];
  }
  return DELHI;
}

const CITY_STORE_KEY = "vayunetra-city";

/** Step meta for <Step> from the section's flow definition (single source of truth). */
function S(section: Section, n: number) {
  const st = FLOWS[section].steps.find((x) => x.n === n)!;
  return { n: st.n, label: st.label, info: st.info };
}

// Deep links: /console?city=…&section=…&cell=…&mode=…&layers=sources,plumes,wards,freight,fires
// Every console state is a shareable URL — a bookmarked demo path, or a link
// you hand a judge to the exact Hyderabad cell during Q&A.
const SECTION_IDS: Section[] = ["action", "forecast", "citizen", "compare", "whatif", "impact", "pipeline"];
const LAYER_KEYS = ["sources", "plumes", "wards", "freight", "fires"] as const;

function urlState() {
  const q = new URLSearchParams(window.location.search);
  const sec = q.get("section");
  const mode = q.get("mode");
  const layers = new Set((q.get("layers") ?? "").split(",").filter(Boolean));
  return {
    city: q.get("city"),
    section: SECTION_IDS.includes(sec as Section) ? (sec as Section) : null,
    cell: q.get("cell"),
    mode: mode === "blame" || mode === "satellite" || mode === "coverage" ? (mode as MapMode) : null,
    layers,
  };
}

function storedCity(): string {
  const fromUrl = urlState().city;
  if (fromUrl) return fromUrl;
  try {
    return localStorage.getItem(CITY_STORE_KEY) ?? "delhi";
  } catch {
    return "delhi"; // storage blocked (private mode) — default is fine
  }
}

export default function App() {
  const [cities, setCities] = useState<City[]>([]);
  const [active, setActive] = useState(storedCity);
  const [mode, setMode] = useState<MapMode>(() => urlState().mode ?? "blame");
  const [showSources, setShowSources] = useState(() => urlState().layers.has("sources"));
  const [showPlumes, setShowPlumes] = useState(() => urlState().layers.has("plumes"));
  const [showWards, setShowWards] = useState(() => urlState().layers.has("wards"));
  const [showFreight, setShowFreight] = useState(() => urlState().layers.has("freight"));
  const [showFires, setShowFires] = useState(() => urlState().layers.has("fires"));
  const [section, setSection] = useState<Section>(() => urlState().section ?? "action");
  const [cell, setCell] = useState<AttrCell | null>(null);
  const [attrCells, setAttrCells] = useState<AttrCell[]>([]);
  const [fallback, setFallback] = useState(false);
  const [tour, setTour] = useState(() => !tourSeen());
  const [coverageKind, setCoverageKind] = useState<"stations" | "dense">("dense");
  const [scrub, setScrub] = useState<ScrubFrame>(null);
  const [present, setPresent] = useState(() => {
    try { return localStorage.getItem("vayunetra-present") === "1"; } catch { return false; }
  });
  useEffect(() => {
    document.documentElement.classList.toggle("vn-present", present);
    try { localStorage.setItem("vayunetra-present", present ? "1" : "0"); } catch { /* ignore */ }
    return () => document.documentElement.classList.remove("vn-present");
  }, [present]);
  // Keyboard: P toggles presentation mode; 1–7 jump sections; [ ] cycle cities.
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      const tag = (e.target as HTMLElement | null)?.tagName;
      if (tag === "INPUT" || tag === "SELECT" || tag === "TEXTAREA" || e.metaKey || e.ctrlKey || e.altKey) return;
      if (e.key === "p" || e.key === "P") { setPresent((v) => !v); return; }
      const n = Number(e.key);
      if (n >= 1 && n <= SECTION_IDS.length) { setSection(SECTION_IDS[n - 1]); return; }
      if (e.key === "[" || e.key === "]") {
        setActive((cur) => {
          const ids = cities.map((c) => c.city_id);
          if (!ids.length) return cur;
          const i = Math.max(0, ids.indexOf(cur));
          return ids[(i + (e.key === "]" ? 1 : ids.length - 1)) % ids.length];
        });
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [cities]);
  const [coverage, setCoverage] = useState<{
    cells: CoverageCell[];
    n_cells?: number;
    n_stations?: number;
    validation?: { skill_vs_bilinear?: number };
  } | null>(null);

  useEffect(() => {
    api<City[]>("/cities")
      .then((list) => {
        setCities(list);
        // Stored city might have been deleted (e.g. an onboarding demo city) —
        // fall back to Delhi rather than render an empty console.
        if (list.length && !list.some((c) => c.city_id === storedCity())) {
          setActive("delhi");
        }
      })
      .catch(() => setCities([]));
  }, []);

  // Refresh keeps you on the city you were on (Mumbai stays Mumbai).
  useEffect(() => {
    try {
      localStorage.setItem(CITY_STORE_KEY, active);
    } catch {
      /* storage blocked — refresh just defaults to delhi */
    }
  }, [active]);

  // Demo insurance: api.ts dispatches "api-fallback" when the backend is
  // unreachable and bundled fixtures were served instead — and "api-live" on
  // every successful response, so the banner clears itself the moment the
  // backend is actually awake (it used to stick forever after one slow call).
  useEffect(() => {
    const onFallback = () => setFallback(true);
    const onLive = () => setFallback(false);
    window.addEventListener("api-fallback", onFallback);
    window.addEventListener("api-live", onLive);
    return () => {
      window.removeEventListener("api-fallback", onFallback);
      window.removeEventListener("api-live", onLive);
    };
  }, []);

  // A ref (always current, unlike a captured `cell`/state closure) records
  // whether a story is already open for this city — so an async auto-open can
  // never overwrite a selection the user made while attribution was loading.
  const openedRef = useRef(false);
  // A cell named in the URL wins over the auto-open heuristic (once).
  const urlCellRef = useRef<string | null>(urlState().cell);

  useEffect(() => {
    setCell(null); // clear story on city switch
    setAttrCells([]); // stats panel must not show the previous city's mix
    openedRef.current = false; // allow one auto-open for the new city
  }, [active]);

  // Any explicit selection (map click / deselect) locks out auto-open.
  function handleSelect(c: AttrCell | null) {
    if (c) openedRef.current = true;
    setCell(c);
  }

  // Discoverability: the whole product is behind a hexagon click, so open one
  // for the judge on first load. Prefer a model-explained (SHAP) cell so the
  // first thing seen is the full "why", else the highest-confidence cell.
  function autoOpenBest(cells: AttrCell[]) {
    if (openedRef.current || !cells.length) return;
    if (urlCellRef.current) {
      const wanted = cells.find((c) => c.h3_cell === urlCellRef.current);
      urlCellRef.current = null;
      if (wanted) {
        openedRef.current = true;
        setCell(wanted);
        return;
      }
    }
    const explained = cells.filter((c) => (c.evidence?.shap_drivers ?? []).length > 0);
    const pool = explained.length ? explained : cells;
    const best = [...pool].sort((a, b) => (b.confidence ?? 0) - (a.confidence ?? 0))[0];
    if (best) {
      openedRef.current = true;
      setCell(best);
    }
  }

  useEffect(() => {
    let alive = true; // rapid city switches: a slow older fetch must not win
    api<typeof coverage>(`/coverage?city=${active}`)
      .then((d) => alive && setCoverage(d))
      .catch(() => alive && setCoverage(null));
    return () => {
      alive = false;
    };
  }, [active]);

  useEffect(() => {
    if (!window.location.pathname.startsWith("/console")) return;
    const q = new URLSearchParams();
    q.set("city", active);
    if (section !== "action") q.set("section", section);
    if (cell) q.set("cell", cell.h3_cell);
    if (mode !== "blame") q.set("mode", mode);
    const on = LAYER_KEYS.filter((k) =>
      ({ sources: showSources, plumes: showPlumes, wards: showWards, freight: showFreight, fires: showFires })[k]);
    if (on.length) q.set("layers", on.join(","));
    const next = `${window.location.pathname}?${q.toString()}`;
    if (next !== `${window.location.pathname}${window.location.search}`) {
      window.history.replaceState({}, "", next);
    }
  }, [active, section, cell, mode, showSources, showPlumes, showWards, showFreight, showFires]);

  const city = cities.find((c) => c.city_id === active);
  const center = toLngLat(city?.center);

  return (
    <div className="vn-console flex h-full w-full flex-col bg-[var(--vn-canvas)]">
      <TopBar cities={cities} active={active} onCity={setActive} section={section} onReplayTour={() => setTour(true)} present={present} onTogglePresent={() => setPresent((v) => !v)} />

      <div className="flex min-h-0 flex-1">
        <Sidebar active={section} onSelect={setSection} />

        <main className="relative min-h-0 flex-1 overflow-y-auto pb-[calc(4.5rem+env(safe-area-inset-bottom))] lg:overflow-hidden lg:pb-0">
          {/* Map — in-flow on mobile, full-bleed behind panels on desktop */}
          <div data-tour="map" className="relative z-0 h-[42vh] min-h-[21rem] w-full lg:absolute lg:inset-0 lg:h-full lg:min-h-0">
            <BlameMap
              city={active}
              center={center}
              mode={mode}
              selected={cell?.h3_cell}
              onSelect={handleSelect}
              onCellsLoaded={(c) => {
                setAttrCells(c);
                autoOpenBest(c);
              }}
              showSources={showSources}
              showPlumes={showPlumes}
              showWards={showWards}
              showFreight={showFreight}
              showFires={showFires}
              coverageCells={coverage?.cells ?? []}
              coverageKind={coverageKind}
              scrub={scrub}
            />

            {/* Live status — top-left so the section panel owns the right edge */}
            <div className="absolute left-2 top-2 z-10 flex flex-wrap items-start gap-2 lg:left-4 lg:top-3 lg:max-w-[calc(100%-32rem)] 2xl:max-w-[calc(100%-36rem)]">
              <AqiHeader city={active} />
              <LatencyWidget city={active} />
            </div>

            {/* Cell story — slide-in drawer under the status strip (desktop) */}
            {cell && (
              <div className="vn-slide-in-left absolute bottom-4 left-4 top-[17.5rem] z-10 hidden w-72 lg:block min-[1280px]:top-48">
                <div className="vn-scroll max-h-full overflow-y-auto rounded-xl">
                  <CellStoryPanel
                    city={active}
                    cell={cell}
                    onClose={() => setCell(null)}
                    onAct={() => setSection("action")} // keep the cell focused — enforcement sorts by it
                  />
                </div>
              </div>
            )}

            {/* Time scrub — bottom-centre of the map (desktop); switches the
                map to the PM2.5 field while replaying so the change is visible */}
            <div className={`pointer-events-none absolute bottom-2 z-10 hidden -translate-x-1/2 lg:block ${
              cell ? "lg:left-[calc((100%-7rem)/2)] 2xl:left-[calc((100%-11rem)/2)]" : "lg:left-[calc((100%-26rem)/2)] 2xl:left-[calc((100%-30rem)/2)]"
            }`}>
              <TimeScrub
                city={active}
                denseCells={coverage?.cells ?? []}
                onFrame={(f) => {
                  setScrub(f);
                  if (f && mode !== "coverage") setMode("coverage");
                }}
              />
            </div>

            {/* Map layers — bottom-right corner of the map, clear of the
                cell-story drawer (left) and the section panel (right edge) */}
            <div className="absolute bottom-2 left-2 z-10 lg:bottom-auto lg:left-auto lg:right-[27.25rem] lg:top-3 2xl:right-[31.25rem]">
              <LayersControl
                mode={mode}
                onMode={setMode}
                showSources={showSources}
                onShowSources={setShowSources}
                showPlumes={showPlumes}
                onShowPlumes={setShowPlumes}
                showWards={showWards}
                onShowWards={setShowWards}
                showFreight={showFreight}
                onShowFreight={setShowFreight}
            showFires={showFires}
            onShowFires={setShowFires}
                coverageKind={coverageKind}
                onCoverageKind={setCoverageKind}
                coverage={coverage}
              />
            </div>

            {fallback && (
              <div className="absolute inset-x-2 top-2 z-10 mx-auto max-w-md rounded-md bg-amber-100 px-3 py-1.5 text-center text-xs text-amber-900 shadow lg:inset-x-auto lg:left-1/2 lg:-translate-x-1/2">
                ⚠ backend waking up — showing bundled demo snapshot.{" "}
                <button className="underline" onClick={() => window.location.reload()}>
                  retry
                </button>
                <button aria-label="Dismiss notice" className="ml-2 text-amber-500" onClick={() => setFallback(false)}>
                  ✕
                </button>
              </div>
            )}

            <div className="absolute bottom-1 right-2 z-10 text-[11px] text-gray-500 lg:hidden">scroll for panels ↓</div>
          </div>

          {/* Section content — right panel on desktop, stacked below map on mobile */}
          <div
            data-tour="panel"
            data-rail
            className="vn-scroll relative z-10 space-y-3 p-3 lg:absolute lg:bottom-3 lg:right-3 lg:top-3 lg:w-[26rem] lg:overflow-y-auto lg:p-0 lg:pl-1 2xl:w-[30rem]"
          >
            <SectionHeader section={section} cityName={city?.name} />
            {/* Mobile keeps the cell story inline, above the section content */}
            {cell && (
              <div className="lg:hidden">
                <CellStoryPanel
                  city={active}
                  cell={cell}
                  onClose={() => setCell(null)}
                  onAct={() => setSection("action")}
                />
              </div>
            )}

            <div key={section} className="space-y-3 lg:vn-slide-in-right">
              {section === "action" && (
                <>
                  <Step {...S("action", 1)}><BriefCard city={active} /></Step>
                  <Step {...S("action", 2)}><EnforcementPanel city={active} focusCell={cell?.h3_cell ?? null} /></Step>
                  <Step {...S("action", 4)}><DispatchQueues city={active} /></Step>
                  <Step {...S("action", 5)}><InterventionsPanel city={active} /></Step>
                  <CityIntelPanel city={active} />
                </>
              )}
              {section === "forecast" && (
                <>
                  <Step {...S("forecast", 1)}><ForecastPanel city={active} /></Step>
                  <Step {...S("forecast", 2)}><ValidationPanel city={active} /></Step>
                  <Step {...S("forecast", 3)}><InterventionsHindsight city={active} /></Step>
                  <Step {...S("forecast", 4)}><CityStatsPanel city={active} cells={attrCells} coverageCells={coverage?.cells ?? []} /></Step>
                </>
              )}
              {section === "citizen" && <Step {...S("citizen", 1)}><CitizenPanel city={active} languages={city?.languages} center={center} /></Step>}
              {section === "compare" && <Step {...S("compare", 1)}><ComparativePanel onSelectCity={setActive} /></Step>}
              {section === "whatif" && <Step {...S("whatif", 1)}><WhatIfPanel city={active} /></Step>}
              {section === "impact" && (
                <>
                  <Step {...S("impact", 1)}><RoiPanel city={active} /></Step>
                  <Step {...S("impact", 3)}><FairnessPanel /></Step>
                </>
              )}
              {section === "pipeline" && <Step {...S("pipeline", 1)}><TraceViewer city={active} /></Step>}
            </div>
          </div>
        </main>
      </div>

      <BottomNav active={section} onSelect={setSection} />
      {tour && <Tour onDone={() => setTour(false)} />}
    </div>
  );
}
