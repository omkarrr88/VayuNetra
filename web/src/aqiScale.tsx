import { createContext, useContext, useEffect, useState, type ReactNode } from "react";
import { SCALES, type AqiScale } from "./aqi";

const KEY = "vayunetra-aqi-scale";
const Ctx = createContext<{ scale: AqiScale; setScale: (s: AqiScale) => void }>({ scale: "in", setScale: () => {} });

function initial(): AqiScale {
  try {
    const q = new URLSearchParams(window.location.search).get("scale");
    if (q === "in" || q === "us" || q === "who") return q;
    const s = localStorage.getItem(KEY);
    if (s === "in" || s === "us" || s === "who") return s;
  } catch { /* ignore */ }
  return "in";   // the official Indian scale by default
}

/** Which AQI scale the console displays. Concentrations and models never change with it —
 *  only labels, index numbers and band colours do. Persisted per browser; `?scale=us` deep-links it. */
export function AqiScaleProvider({ children }: { children: ReactNode }) {
  const [scale, setScale] = useState<AqiScale>(initial);
  useEffect(() => { try { localStorage.setItem(KEY, scale); } catch { /* ignore */ } }, [scale]);
  return <Ctx.Provider value={{ scale, setScale }}>{children}</Ctx.Provider>;
}

export function useAqiScale() { return useContext(Ctx); }

/** The header toggle: IN · CPCB | US · EPA | WHO. */
export function AqiScaleToggle({ dark = true }: { dark?: boolean }) {
  const { scale, setScale } = useAqiScale();
  return (
    <div role="group" aria-label="AQI scale" title={SCALES[scale].note} className={`flex items-center overflow-hidden rounded-md border text-[11px] font-semibold ${dark ? "border-white/15" : "border-slate-300"}`}>
      {(Object.keys(SCALES) as AqiScale[]).map((k) => (
        <button
          key={k}
          type="button"
          onClick={() => setScale(k)}
          aria-pressed={scale === k}
          title={SCALES[k].name + " — " + SCALES[k].note}
          className={`px-2 py-1 transition-colors ${scale === k ? (dark ? "bg-white text-slate-900" : "bg-slate-900 text-white") : dark ? "text-slate-300 hover:bg-white/10" : "text-slate-700 hover:bg-slate-100"}`}
        >
          {SCALES[k].short}
        </button>
      ))}
    </div>
  );
}
