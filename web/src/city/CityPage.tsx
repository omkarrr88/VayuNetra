// The public city page — /city/<city_id> — for citizens, journalists and anyone who wants the
// numbers without the officer console. Identical for every city we run: one fetch of
// GET /city/overview (that city's own stations) plus GET /comparison for the cross-city views.
import { useEffect, useMemo, useState } from "react";
import { api } from "../api";
import { POLLUTANT_LABEL, SCALES } from "../aqi";
import { AqiScaleToggle, useAqiScale } from "../aqiScale";
import { ThemeToggle } from "../theme";
import { linkClick, navigate } from "../router";
import { CityHero, PollutantCards, PollutantChips, Section, type Overview, type Pollutant } from "./parts";
import { AqiCalendar, CitiesTable, CityCards, HealthAdvice, MonthlyTrend, SeriesGraph, type CityRow } from "./charts";

type CityMeta = { city_id: string; name: string };

export default function CityPage({ cityId }: { cityId: string }) {
  const { scale } = useAqiScale();
  const [d, setD] = useState<Overview | null | "error">(null);
  const [cities, setCities] = useState<CityRow[]>([]);
  const [meta, setMeta] = useState<CityMeta[]>([]);
  const [pollutant, setPollutant] = useState<Pollutant>("aqi");

  useEffect(() => {
    setD(null);
    setPollutant("aqi");
    api<Overview>(`/city/overview?city=${cityId}`).then(setD).catch(() => setD("error"));
    api<{ cities: CityRow[] }>("/comparison").then((c) => setCities(c.cities ?? [])).catch(() => setCities([]));
    api<CityMeta[]>("/cities").then(setMeta).catch(() => setMeta([]));
    window.scrollTo({ top: 0 });
  }, [cityId]);

  const available = useMemo(() => (d && d !== "error" ? Object.keys(d.now.pollutants) : []), [d]);
  const open = (c: string) => navigate(`/city/${c}`);

  return (
    <div className="vn-console min-h-full overflow-y-auto" style={{ background: "var(--vn-canvas)" }}>
      {/* header */}
      <header className="sticky top-0 z-20 border-b border-slate-200" style={{ background: "var(--vn-surface)" }}>
        <div className="mx-auto flex max-w-6xl flex-wrap items-center gap-3 px-4 py-2.5">
          <a href="/" onClick={(e) => linkClick(e, "/")} className="flex items-center gap-2 text-[15px] font-extrabold tracking-tight text-slate-900">
            <span className="grid h-7 w-7 place-items-center rounded-full bg-slate-900 text-[11px] font-black text-white">VN</span> VayuNetra
          </a>
          <select
            aria-label="Choose city"
            value={cityId}
            onChange={(e) => open(e.target.value)}
            className="rounded-md border border-slate-300 px-2 py-1 text-[13px] font-semibold text-slate-800"
          >
            {(meta.length ? meta : [{ city_id: cityId, name: cityId }]).map((c) => <option key={c.city_id} value={c.city_id}>{c.name}</option>)}
          </select>
          <div className="ml-auto flex items-center gap-2">
            <AqiScaleToggle dark={false} />
            <ThemeToggle dark={false} />
            <a href="/console" onClick={(e) => linkClick(e, `/console?city=${cityId}`)}
              className="rounded-md bg-slate-900 px-3 py-1.5 text-[12px] font-bold text-white hover:bg-slate-800">Officer console →</a>
          </div>
        </div>
      </header>

      <main className="mx-auto max-w-6xl px-4 pb-16">
        {d === null && <div className="mt-8 h-64 animate-pulse rounded-xl" style={{ background: "var(--vn-surface)" }} />}
        {d === "error" && (
          <div className="vn-card mt-8 p-6 text-[13px] text-slate-600">
            No live overview for <b>{cityId}</b> right now — the backend may be waking up, or this city has no readings yet.
            <button onClick={() => navigate(`/city/${cityId}`)} className="ml-2 font-semibold text-blue-700 underline">retry</button>
          </div>
        )}
        {d && d !== "error" && (
          <>
            {/* title + pollutant chips */}
            <div className="mt-6 flex flex-wrap items-end justify-between gap-3">
              <div>
                <div className="text-[11px] font-bold uppercase tracking-widest text-blue-700">air quality · live</div>
                <h1 className="text-3xl font-extrabold tracking-tight text-slate-900">{d.name}</h1>
                <p className="text-[13px] text-slate-500">
                  Real-time PM2.5, PM10 and gas readings from this city's CPCB stations · updated {new Date(d.generated_at).toLocaleString("en-IN", { day: "numeric", month: "short", hour: "2-digit", minute: "2-digit" })}
                </p>
              </div>
              <PollutantChips available={available} value={pollutant} onChange={setPollutant} />
            </div>

            <div className="mt-4"><CityHero d={d} scale={scale} /></div>

            <Section title="Major air pollutants" city={d.name} note={d.coverage.note}>
              <PollutantCards d={d} scale={scale} onPick={setPollutant} />
            </Section>

            <Section
              title={pollutant === "aqi" ? "Air quality graph" : `${POLLUTANT_LABEL[pollutant] ?? pollutant.toUpperCase()} graph`}
              city={`${d.name} · historical readings`}
              right={<span className="text-[11px] text-slate-500">{pollutant === "aqi" ? SCALES[scale].name : "concentration"}</span>}
            >
              <SeriesGraph d={d} scale={scale} pollutant={pollutant} />
            </Section>

            <Section title="Air quality calendar" city={d.name}
              note={`Daily index per day from this city's stations. Blank tiles are days with no reading${d.coverage.since ? `; the record starts ${d.coverage.since}` : ""}.`}>
              <AqiCalendar d={d} scale={scale} />
            </Section>

            <Section title="Monthly trend" city={d.name}>
              <MonthlyTrend d={d} scale={scale} />
            </Section>

            <Section title="Health advice" city={d.name}
              note="Templated from CPCB's advisory table and WHO guidance — no language model writes health text. Not medical advice.">
              <HealthAdvice d={d} />
            </Section>

            <Section title="Every city we run" city="real-time comparison"
              note="City means over each city's own stations; click a row or card to open that city.">
              <CitiesTable rows={cities} scale={scale} onOpen={open} activeCity={cityId} />
              <div className="mt-4"><CityCards rows={cities} scale={scale} onOpen={open} exclude={cityId} /></div>
            </Section>

            <Section title="Where this data comes from" city={d.name}>
              <div className="vn-card p-4 text-[13px] leading-5 text-slate-600">
                <p>
                  Readings are CPCB CAAQMS station data (via OpenAQ), aggregated to city means per hour and per day.
                  The index is the {SCALES[scale].name} formula applied to those means — <b>{SCALES[scale].short}</b> — so it can differ
                  from the official 24-hour bulletin, and from apps that display a different national scale. Switch the scale in the header
                  to see the same air on the other scales.
                </p>
                <p className="mt-2">
                  Only pollutants this city's stations publish enter its index; {d.name} currently reports{" "}
                  <b>{available.map((p) => p.toUpperCase()).join(", ") || "no pollutants"}</b>. Forecasts, source attribution and the officer
                  worklist live in the <a href="/console" onClick={(e) => linkClick(e, `/console?city=${cityId}`)} className="font-semibold text-blue-700 underline">console</a>.
                </p>
                <p className="mt-2 text-[11px] text-slate-500">
                  Coverage: {d.coverage.days} day(s) of daily history{d.coverage.since ? ` since ${d.coverage.since}` : ""}, {d.coverage.hours_24h} of the last 24 hours.
                </p>
              </div>
            </Section>
          </>
        )}
      </main>

      <footer className="border-t border-slate-200 py-6 text-center text-[11px] text-slate-500">
        VayuNetra · ten Indian cities · ₹0 infrastructure · open source
      </footer>
    </div>
  );
}
