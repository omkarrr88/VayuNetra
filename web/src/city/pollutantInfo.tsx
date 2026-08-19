// What each pollutant is, where it comes from in an Indian city, what it does to people, and the
// standard it is judged against. Reference text only — every number here is a published standard
// with its source named; nothing is inferred from our own data. The live values beside them come
// from GET /city/overview (this city's stations).
import { POLLUTANT_LABEL, categoryForIndex, type AqiScale, bandInk } from "../aqi";
import { POLLUTANT_FULL, ago, type Overview, type Pollutant } from "./parts";

export type Standard = { label: string; value: string };
export type PollutantInfo = {
  what: string;
  sources: string;
  health: string;
  /** India's National Ambient Air Quality Standards (CPCB, 2009 notification). */
  naaqs: Standard[];
  /** WHO 2021 global air-quality guideline levels. */
  who: Standard[];
};

export const POLLUTANT_INFO: Partial<Record<Exclude<Pollutant, "aqi">, PollutantInfo>> = {
  pm25: {
    what: "Airborne particles under 2.5 micrometres — small enough to reach the deepest part of the lung and cross into the bloodstream. It is the pollutant health research is built on, and the one VayuNetra forecasts and attributes.",
    sources: "Combustion, mostly: vehicle exhaust, industry and power generation, solid fuel burned for cooking and heating, open burning of waste and crop residue — plus secondary particles that form in the air from gases such as SO₂, NOₓ and ammonia.",
    health: "Linked to heart disease, stroke, lower respiratory infection, chronic lung disease and lung cancer; there is no threshold below which it is known to be safe.",
    naaqs: [{ label: "Annual", value: "40 µg/m³" }, { label: "24-hour", value: "60 µg/m³" }],
    who: [{ label: "Annual", value: "5 µg/m³" }, { label: "24-hour", value: "15 µg/m³" }],
  },
  pm10: {
    what: "Particles under 10 micrometres, including the coarse dust fraction. In dusty Indian months PM10 often sets the National AQI even when PM2.5 looks moderate — which is why the index here can be higher than a PM2.5-only number.",
    sources: "Road and construction dust, resuspension by traffic, demolition and material handling, industrial process dust — plus everything that makes PM2.5, since PM2.5 is part of PM10.",
    health: "Irritates the airways and worsens asthma and chronic bronchitis; associated with cardiovascular and respiratory hospital admissions.",
    naaqs: [{ label: "Annual", value: "60 µg/m³" }, { label: "24-hour", value: "100 µg/m³" }],
    who: [{ label: "Annual", value: "15 µg/m³" }, { label: "24-hour", value: "45 µg/m³" }],
  },
  no2: {
    what: "A reactive gas from high-temperature combustion. It is the clearest chemical fingerprint of traffic and burning, which is why our attribution model keys on it.",
    sources: "Vehicle engines, diesel generators, power generation and industry; concentrations peak beside busy roads and in rush hours.",
    health: "Inflames the airways, aggravates asthma and is associated with reduced lung development in children; also a precursor of ozone and of secondary particles.",
    naaqs: [{ label: "Annual", value: "40 µg/m³" }, { label: "24-hour", value: "80 µg/m³" }],
    who: [{ label: "Annual", value: "10 µg/m³" }, { label: "24-hour", value: "25 µg/m³" }],
  },
  so2: {
    what: "A sharp-smelling gas from burning sulphur-bearing fuels — the signature of coal and heavy oil rather than of traffic.",
    sources: "Coal-fired power generation, refineries, smelters, brick kilns and industrial boilers; also a precursor of secondary sulphate particles.",
    health: "Causes bronchial irritation and worsens asthma at short exposures; longer exposure is associated with respiratory infection.",
    naaqs: [{ label: "Annual", value: "50 µg/m³" }, { label: "24-hour", value: "80 µg/m³" }],
    who: [{ label: "24-hour", value: "40 µg/m³" }],
  },
  co: {
    what: "A colourless gas from incomplete combustion. Outdoors it rarely drives the index, but it rises with congestion and with generator use.",
    sources: "Petrol vehicles and idling engines, diesel generators, solid-fuel cooking and heating, open burning.",
    health: "Binds haemoglobin in place of oxygen — headaches, dizziness and reduced exercise tolerance at ambient levels; dangerous indoors at high concentrations.",
    naaqs: [{ label: "8-hour", value: "2 mg/m³" }, { label: "1-hour", value: "4 mg/m³" }],
    who: [{ label: "24-hour", value: "4 mg/m³" }],
  },
  o3: {
    what: "Ground-level ozone is not emitted: it forms in sunlight from NOₓ and volatile organic compounds. It peaks on hot, still afternoons — the opposite pattern to the winter particulate season.",
    sources: "Secondary — made from traffic and industrial precursor gases under strong sunlight; it can be highest downwind of the sources that made it.",
    health: "Irritates the airways, reduces lung function and worsens asthma and COPD, especially during outdoor exertion.",
    naaqs: [{ label: "8-hour", value: "100 µg/m³" }, { label: "1-hour", value: "180 µg/m³" }],
    who: [{ label: "Peak season", value: "60 µg/m³" }, { label: "8-hour", value: "100 µg/m³" }],
  },
};

export const REFERENCE_SOURCES: { label: string; url: string }[] = [
  { label: "CPCB National Ambient Air Quality Standards (notified 18 Nov 2009)", url: "https://www.cpcb.gov.in/openpdffile.php?id=UmVwb3J0RmlsZXMvMjdfMTQ1ODExMDQyNl9OZXdJdGVtXzE5Nl9OQUFRTVNfVm9sdW1lLUkucGRm" },
  { label: "WHO global air quality guidelines, 2021", url: "https://www.who.int/publications/i/item/9789240034228" },
  { label: "WHO — types of pollutants", url: "https://www.who.int/teams/environment-climate-change-and-health/air-quality-and-health/health-impacts/types-of-pollutants" },
];

/** Drill-down for one pollutant: the live reading and its sub-index, then the reference block. */
export function PollutantDetail({ d, scale, pollutant, onClose }: { d: Overview; scale: AqiScale; pollutant: Exclude<Pollutant, "aqi">; onClose: () => void }) {
  const r = d.now.pollutants[pollutant];
  const sub = (scale === "us" ? d.now.sub_us : d.now.sub_in)?.[pollutant];
  const cat = sub !== undefined ? categoryForIndex(sub, scale) : null;
  const info = POLLUTANT_INFO[pollutant];
  const prominent = (scale === "us" ? d.now.prominent_us : d.now.prominent_in) === pollutant;
  if (!r) return null;
  return (
    <div className="vn-card mt-2 p-3">
      <div className="flex items-start justify-between gap-2">
        <div>
          <div className="text-[13px] font-extrabold text-slate-900">{POLLUTANT_FULL[pollutant]}</div>
          <div className="text-[11px] text-slate-500">{d.name} · {ago(r.hour)}{r.n ? ` · ${r.n} station${r.n === 1 ? "" : "s"}` : ""}</div>
        </div>
        <button onClick={onClose} aria-label="Close pollutant detail" className="rounded px-1.5 text-slate-400 hover:bg-slate-100 hover:text-slate-700">✕</button>
      </div>

      <div className="mt-2 flex flex-wrap items-end gap-4">
        <div>
          <div className="text-3xl font-extrabold tabular-nums text-slate-900">{r.value}<span className="ml-1 text-[12px] font-semibold text-slate-500">{r.unit ?? ""}</span></div>
          <div className="text-[11px] text-slate-500">latest city mean</div>
        </div>
        {sub !== undefined && (
          <div>
            <div className="text-2xl font-extrabold" style={{ color: bandInk(cat?.color) }}>{sub}</div>
            <div className="text-[11px] text-slate-500">sub-index · {cat?.label}{prominent ? " · sets the city index" : ""}</div>
          </div>
        )}
      </div>

      {info ? (
        <div className="mt-3 space-y-2 text-[12px] leading-5 text-slate-700">
          <p><b>What it is.</b> {info.what}</p>
          <p><b>Where it comes from.</b> {info.sources}</p>
          <p><b>What it does.</b> {info.health}</p>
          {(info.naaqs.length > 0 || info.who.length > 0) && (
            <div className="grid gap-2 sm:grid-cols-2">
              {info.naaqs.length > 0 && (
                <div className="rounded-md bg-slate-50 p-2">
                  <div className="text-[11px] font-bold uppercase tracking-wide text-slate-500">India · NAAQS</div>
                  {info.naaqs.map((s) => (
                    <div key={s.label} className="flex justify-between gap-2 text-[12px]"><span className="text-slate-600">{s.label}</span><b className="tabular-nums text-slate-900">{s.value}</b></div>
                  ))}
                </div>
              )}
              {info.who.length > 0 && (
                <div className="rounded-md bg-slate-50 p-2">
                  <div className="text-[11px] font-bold uppercase tracking-wide text-slate-500">WHO 2021 guideline</div>
                  {info.who.map((s) => (
                    <div key={s.label} className="flex justify-between gap-2 text-[12px]"><span className="text-slate-600">{s.label}</span><b className="tabular-nums text-slate-900">{s.value}</b></div>
                  ))}
                </div>
              )}
            </div>
          )}
        </div>
      ) : (
        <p className="mt-3 text-[12px] text-slate-500">
          Reference text for {POLLUTANT_LABEL[pollutant]} is not published in this build — the reading and its sub-index above are live.
        </p>
      )}

      {REFERENCE_SOURCES.length > 0 && (
        <p className="mt-2 text-[10px] leading-4 text-slate-500">
          Standards and health effects:{" "}
          {REFERENCE_SOURCES.map((s, i) => (
            <span key={s.url}>
              {i > 0 && " · "}
              <a href={s.url} target="_blank" rel="noreferrer" className="underline hover:text-slate-700">{s.label}</a>
            </span>
          ))}
          . Our reading is a city mean of the latest station values, not a 24-hour average, so it is not a compliance measurement.
        </p>
      )}
    </div>
  );
}
