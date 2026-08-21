import { useEffect, useRef, useState } from "react";
import "maplibre-gl/dist/maplibre-gl.css";
import { type AttrCell, type CoverageCell, type MapMode } from "./BlameMap";
import ForecastPanel from "./ForecastPanel";
import ValidationPanel from "./ValidationPanel";
import InterventionsHindsight from "./InterventionsHindsight";
import BriefCard from "./BriefCard";
import { api } from "./api";
import EnforcementPanel from "./EnforcementPanel";
import CitizenPanel from "./CitizenPanel";
import ComparativePanel from "./ComparativePanel";
import CityIntelPanel from "./CityIntelPanel";
import TraceViewer from "./TraceViewer";
import WhatIfPanel from "./WhatIfPanel";
import RoiPanel, { FundGuidance } from "./RoiPanel";
import FairnessPanel from "./FairnessPanel";
import CityStatsPanel from "./CityStatsPanel";
import InterventionsPanel from "./InterventionsPanel";
import DispatchQueues from "./DispatchQueues";
import { type ScrubFrame } from "./TimeScrub";
import { SECTIONS, type Section } from "./Sidebar";
import Tour, { tourSeen } from "./Tour";
import { CommandPalette } from "./console/CommandPalette";
import { FLOWS } from "./console/flows";
import MapFrame from "./console/MapFrame";
import { Cols } from "./console/Cols";
import { Deferred } from "./console/nearView";
import { PollutantsNowPanel, AirGraphPanel, AirRecordCols, HealthPanel } from "./console/cityAir";
import { SectionIntro } from "./console/SectionIntro";
import { TopNav, FallbackNotice, type NavItem } from "./shell/TopNav";
import { navigate } from "./router";
import { Step } from "./ui";

type LngLat = [number, number];
type GeoPoint = { coordinates: [number, number] };
type City = { city_id: string; name: string; center?: LngLat | GeoPoint; bbox?: unknown; languages?: string[] };

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

// Sections whose content is a single light card read better in a reading column than stretched
// across 1360px of empty page.
// (no section is capped any more — the pipeline graph wants the full width)
const NARROW_SECTIONS = new Set<Section>();

/** The console's nav items — the same sections, same order, as the keyboard shortcuts. */
const NAV_ITEMS: NavItem[] = SECTIONS.map((s, i) => ({ id: s.id, label: s.label, hint: s.hint, key: String(i + 1) }));

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
      // The pitch deck embeds this app in an iframe and uses D to step in and back out. Once the
      // presenter clicks inside the app the iframe owns the keyboard, so the deck never sees the
      // keypress — the app forwards it. Only when actually embedded, so D stays free otherwise.
      if ((e.key === "d" || e.key === "D") && window.parent !== window) {
        window.parent.postMessage("vn-exit-demo", "*");
        return;
      }
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
    if (section !== "action") return; // no map on screen — nothing to point at
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
    let alive = true;
    api<AttrCell[]>(`/attribution?city=${active}`)
      .then((rows) => { if (alive) setAttrCells(rows); })
      .catch(() => { if (alive) setAttrCells([]); });
    return () => { alive = false; };
  }, [active]);

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

  // The map lives on the pages that act on places. Everywhere else it would be decoration,
  // and the public site already has a full-bleed map of its own.
  const wantsMap = section === "action";

  const mapFrame = (
    <MapFrame
      city={active}
      center={center}
      bbox={city?.bbox}
      mode={mode}
      onMode={setMode}
      cell={cell}
      onSelect={handleSelect}
      onCellsLoaded={(c) => { setAttrCells(c); autoOpenBest(c); }}
      onAct={() => setSection("action")}
      showSources={showSources} onShowSources={setShowSources}
      showPlumes={showPlumes} onShowPlumes={setShowPlumes}
      showWards={showWards} onShowWards={setShowWards}
      showFreight={showFreight} onShowFreight={setShowFreight}
      showFires={showFires} onShowFires={setShowFires}
      coverageKind={coverageKind} onCoverageKind={setCoverageKind}
      coverage={coverage}
      scrub={scrub}
      onScrub={(f) => { setScrub(f); if (f && mode !== "coverage") setMode("coverage"); }}
      caption={`Every ~1 km cell in ${city?.name ?? "this city"}, coloured by its dominant source. Click one for its story.`}
    />
  );

  return (
    <div className="vn vn-console" style={{ display: "flex", minHeight: "100dvh", flexDirection: "column", background: "var(--canvas)" }}>
      <TopNav
        subtitle="OPERATIONS"
        navLabel="Console sections"
        items={NAV_ITEMS}
        activeId={section}
        onSelect={(id) => setSection(id as Section)}
        city={active}
        cities={cities.map((c) => ({ city_id: c.city_id, name: c.name }))}
        onCity={setActive}
        action={{ label: "Public site", title: "The citizen-facing pages for this city", onClick: () => navigate(`/city/${active}`) }}
        extras={
          <>
            <button
              onClick={() => setPresent((v) => !v)}
              aria-pressed={present}
              title="Presentation mode (P) — larger type for the projector"
              style={{ height: 32, padding: "0 10px", borderRadius: "var(--r-sm)", border: "1px solid var(--line)", background: present ? "var(--primary-soft)" : "var(--surface-2)", color: present ? "var(--primary)" : "var(--muted)", fontSize: "var(--t-xs)", fontWeight: 700, cursor: "pointer" }}
            >
              Present
            </button>
            <button
              onClick={() => setTour(true)}
              title="Replay the guided tour"
              style={{ height: 32, padding: "0 10px", borderRadius: "var(--r-sm)", border: "1px solid var(--line)", background: "var(--surface-2)", color: "var(--muted)", fontSize: "var(--t-xs)", fontWeight: 700, cursor: "pointer" }}
            >
              Tour
            </button>
          </>
        }
      />
      <FallbackNotice />

      <main data-tour="panel" data-rail className="vn-page" style={{ flex: 1, minWidth: 0 }}>
        <SectionIntro section={section} cityName={city?.name} />

        <div key={section} className="vn-fade" style={{ display: "flex", flexDirection: "column", gap: "var(--s-5)", marginTop: "var(--s-6)", maxWidth: NARROW_SECTIONS.has(section) ? 940 : undefined }}>
          {wantsMap && mapFrame}

          {section === "action" && (
            <>
              <Step {...S("action", 1)}><BriefCard city={active} /></Step>
              <Step {...S("action", 2)}><EnforcementPanel city={active} focusCell={cell?.h3_cell ?? null} /></Step>
              <Cols>
                <Step {...S("action", 4)}><Deferred minHeight={200} label="Dispatch queues"><DispatchQueues city={active} /></Deferred></Step>
                <Step {...S("action", 5)}><Deferred minHeight={260} label="Tracked outcomes"><InterventionsPanel city={active} /></Deferred></Step>
              </Cols>
              <Deferred minHeight={200} label="City intelligence"><CityIntelPanel city={active} /></Deferred>
            </>
          )}
          {section === "forecast" && (
            <>
              <Step {...S("forecast", 1)}><ForecastPanel city={active} /></Step>
              <Cols>
                <Step {...S("forecast", 2)}><ValidationPanel city={active} /></Step>
                <Step {...S("forecast", 3)}><InterventionsHindsight city={active} /></Step>
              </Cols>
              <Deferred minHeight={420} label="City statistics"><CityStatsPanel city={active} cells={attrCells} coverageCells={coverage?.cells ?? []} /></Deferred>
              <Step {...S("forecast", 6)}><Deferred minHeight={220} label="Pollutants now"><PollutantsNowPanel city={active} /></Deferred></Step>
              <Step {...S("forecast", 7)}><Deferred minHeight={320} label="Air graph"><AirGraphPanel city={active} /></Deferred></Step>
              <Deferred minHeight={320} label="Air record"><AirRecordCols city={active} /></Deferred>
            </>
          )}
          {section === "citizen" && (
            <>
              <CitizenPanel city={active} languages={city?.languages} center={center} />
              <Step {...S("citizen", 5)}><Deferred minHeight={340} label="Health"><HealthPanel city={active} /></Deferred></Step>
            </>
          )}
          {section === "compare" && (
            <ComparativePanel
              onSelectCity={setActive}
              onOpenEnforcement={(id) => { setActive(id); setSection("action"); }}
            />
          )}
          {section === "whatif" && <WhatIfPanel city={active} />}
          {section === "impact" && (
            <>
              <RoiPanel city={active} />
              <Cols>
                <FundGuidance city={active} />
                <Step {...S("impact", 3)}><FairnessPanel /></Step>
              </Cols>
            </>
          )}
          {section === "pipeline" && <TraceViewer city={active} />}
        </div>
      </main>

      <CommandPalette
        cities={cities.map((c) => ({ city_id: c.city_id, name: c.name }))}
        activeCity={active}
        activeSection={section}
        onCity={setActive}
        onSection={setSection}
      />
      {tour && <Tour onDone={() => setTour(false)} />}
    </div>
  );
}
