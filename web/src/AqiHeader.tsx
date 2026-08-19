import { useEffect, useRef, useState, type ReactNode } from "react";
import { api, API_BASE, API_TOKEN } from "./api";
import { agoLabel, categoryForIndex, headline, formatIndex, pm25Index, POLLUTANT_LABEL, SCALES, type AqiRow, bandInk } from "./aqi";
import { useAqiScale } from "./aqiScale";


/** Pulsing dot showing the /live WebSocket connection state. */
function LiveDot() {
  const [on, setOn] = useState(false);
  const wsRef = useRef<WebSocket | null>(null);

  useEffect(() => {
    let closed = false;
    let retry: ReturnType<typeof setTimeout>;
    function connect() {
      const base = API_BASE.replace(/^http/, "ws");
      const q = API_TOKEN ? `?token=${encodeURIComponent(API_TOKEN)}` : "";
      try {
        const ws = new WebSocket(`${base}/live${q}`);
        wsRef.current = ws;
        ws.onopen = () => {
          if (closed) {
            ws.close(); // unmounted while connecting (StrictMode dev remount)
            return;
          }
          setOn(true);
        };
        ws.onclose = () => {
          if (closed) return; // no setState / retries after unmount
          setOn(false);
          retry = setTimeout(connect, 15_000);
        };
        ws.onerror = () => {
          if (ws.readyState === WebSocket.OPEN) ws.close();
        };
      } catch {
        setOn(false);
      }
    }
    connect();
    return () => {
      // Never close a CONNECTING socket (browsers log a warning); let onopen do it.
      closed = true;
      clearTimeout(retry);
      const ws = wsRef.current;
      if (ws && ws.readyState === WebSocket.OPEN) ws.close();
    };
  }, []);

  return (
    <span className="flex items-center gap-1 text-[11px] font-medium" title={on ? "Live feed connected" : "Live feed offline"}>
      <span className={`inline-block h-2 w-2 rounded-full ${on ? "animate-pulse bg-emerald-500" : "bg-slate-300"}`} />
      <span className={on ? "text-emerald-700" : "text-slate-500"}>{on ? "LIVE" : "OFF"}</span>
    </span>
  );
}

type Compound = {
  level: "none" | "watch" | "alert";
  tmax_next24_c?: number | null;
  grap?: { stage: number; label: string; trigger_aqi?: number } | null;
  dust_traffic?: { count: number } | null;
};

const GRAP_ROMAN = ["", "I", "II", "III", "IV"];

/** The city's air right now — GET /city/now, the single definition of this city's index
 *  (index of the city mean). The map tile shows it; the worst cell rides along as a chip. */
type CityNow = {
  pollutants: Record<string, { value: number; unit?: string | null; hour: string; n?: number }>;
  pm25_24h: number | null;
  aqi_in: number | null; prominent_in: string | null; sub_in?: Record<string, number>;
  aqi_us: number | null; prominent_us: string | null; sub_us?: Record<string, number>;
};

/** Hero AQI badge: worst-cell CPCB AQI, category color, data freshness. */
export default function AqiHeader({ city }: { city: string }) {
  const { scale } = useAqiScale();
  const [rows, setRows] = useState<AqiRow[] | null>(null);
  const [now, setNow] = useState<CityNow | null>(null);
  const [compound, setCompound] = useState<Compound | null>(null);

  useEffect(() => {
    setRows(null);
    api<AqiRow[]>(`/aqi/current?city=${city}`).then(setRows).catch(() => setRows([]));
    api<CityNow>(`/city/now?city=${city}`).then(setNow).catch(() => setNow(null));
    api<Compound>(`/alerts/compound?city=${city}`).then(setCompound).catch(() => setCompound(null));
  }, [city]);

  if (rows === null) {
    return <div className="h-14 w-44 animate-pulse rounded-lg bg-white/80 shadow" />;
  }

  // The headline is the CITY index (index of the city mean, from /city/now) so this tile, the
  // City air section and the public page can never show two different "AQI"s for one city. The
  // worst cell — what an officer actually drives to — is shown beside it, labelled.
  const worstCell = headline(rows, scale);
  const cityIndex = now
    ? (scale === "us" ? now.aqi_us : scale === "in" ? now.aqi_in : now.pollutants.pm25 ? pm25Index(now.pollutants.pm25.value, "who") : null)
    : worstCell.index;
  const aqi = cityIndex;
  const cat = aqi !== null ? categoryForIndex(aqi, scale) : null;
  const worst = worstCell.worstPm25;
  const latest = rows.map((r) => r.ts).filter(Boolean).sort().pop();
  const promKey = now ? (scale === "us" ? now.prominent_us : now.prominent_in) : worstCell.prominent;
  const prominent = promKey ? POLLUTANT_LABEL[promKey] ?? promKey : null;
  const subs = now ? (scale === "us" ? now.sub_us : scale === "in" ? now.sub_in : undefined) : undefined;
  const tip = `${SCALES[scale].name} — ${SCALES[scale].note}
This city: the index of the city mean over the stations reporting each pollutant${subs && Object.keys(subs).length ? ` — ${Object.entries(subs).map(([k, v]) => `${POLLUTANT_LABEL[k] ?? k} ${v}`).join(" · ")}` : ""}.
Worst cell right now: ${worstCell.index !== null ? `${formatIndex(worstCell.index, scale)} (PM2.5 ${Math.round(worst ?? 0)} µg/m³)` : "–"} — the place an inspector would go.
The formula runs on the latest hourly means, so the official 24-hour bulletin can differ.`;

  const chips: ReactNode[] = [];
  if (compound && compound.level !== "none") {
    chips.push(
      <span
        key="heat"
        className={`rounded-md px-1.5 py-0.5 text-[11px] font-bold text-white ${
          compound.level === "alert" ? "bg-red-700" : "bg-orange-500"
        }`}
        title="Compound risk: heat amplifies PM mortality and drives ozone formation (IMD heatwave criteria x CPCB bands)"
      >
        🔥 Heat×Smog {compound.level}
        {typeof compound.tmax_next24_c === "number" && ` · ${Math.round(compound.tmax_next24_c)}°C`}
      </span>,
    );
  }
  if (compound?.grap) {
    chips.push(
      <span
        key="grap"
        className="rounded-md bg-purple-700 px-1.5 py-0.5 text-[11px] font-bold text-white"
        title={`Forecast-triggered graded response: 24h forecast AQI ${compound.grap.trigger_aqi ?? "--"} enters the CAQM GRAP Stage ${GRAP_ROMAN[compound.grap.stage]} band (statutory in Delhi-NCR; advisory playbook elsewhere) — a day before observed AQI would trigger it`}
      >
        ⚖️ GRAP Stage {GRAP_ROMAN[compound.grap.stage]} · from forecast
      </span>,
    );
  }
  if (compound?.dust_traffic && compound.dust_traffic.count > 0) {
    chips.push(
      <span
        key="dust"
        className="rounded-md bg-amber-700 px-1.5 py-0.5 text-[11px] font-bold text-white"
        title="Cells where construction dust AND traffic are both major contributors (attribution shares ≥25% each) — traffic resuspends construction dust, so these corridors escalate fastest"
      >
        🚧 Dust×Traffic · {compound.dust_traffic.count} cell{compound.dust_traffic.count > 1 ? "s" : ""}
      </span>,
    );
  }

  return (
    <div
      className="max-w-xs rounded-xl border border-slate-200/80 bg-white/95 px-3 py-2 shadow-lg shadow-slate-900/5 backdrop-blur"
      role="status"
      aria-label={aqi !== null && cat ? `${SCALES[scale].name} ${formatIndex(aqi, scale)}, ${cat.label}, worst cell PM2.5 ${Math.round(worst!)} micrograms per cubic metre` : "Air quality data unavailable"}
      title={tip}
    >
      {aqi !== null && cat ? (
        <>
          <div className="flex items-center gap-3">
            <div
              className="flex h-12 min-w-16 flex-col items-center justify-center rounded-lg px-2"
              style={{ background: cat.color, color: cat.text }}
            >
              <span className="text-xl font-extrabold leading-none">{formatIndex(aqi, scale)}</span>
              <span className="text-[10px] font-semibold uppercase tracking-wide">{scale === "who" ? "× WHO" : "AQI"}</span>
            </div>
            <div className="text-xs">
              <div className="text-sm font-bold" style={{ color: bandInk(cat.color) }}>
                {cat.label}
              </div>
              <div className="text-slate-500">
                city · {SCALES[scale].short}{prominent && scale !== "who" ? ` · prominent ${prominent}` : ""}
                {now?.pm25_24h != null && <> · PM2.5 24 h {now.pm25_24h}</>}
              </div>
              {worstCell.index !== null && (
                <div className="text-slate-500">
                  worst cell <b className="text-slate-700">{formatIndex(worstCell.index, scale)}</b>
                  {worst !== null && <> · PM2.5 {Math.round(worst)} µg/m³</>}
                </div>
              )}
              <div className="flex items-center gap-2 text-slate-500">
                <span>data {agoLabel(latest)}</span>
                <LiveDot />
              </div>
            </div>
          </div>
          {chips.length > 0 && <div className="mt-1.5 flex flex-wrap gap-1">{chips}</div>}
        </>
      ) : (
        <div className="text-xs text-slate-500">no AQI data</div>
      )}
    </div>
  );
}
