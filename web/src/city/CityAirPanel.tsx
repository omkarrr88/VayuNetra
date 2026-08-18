// "City air" — the read-the-air section of the console: the same live index, pollutant,
// calendar, trend and health content the public /city page shows, laid out for the rail's
// tabbed pane (one card per step). Everything comes from GET /city/overview, computed from this
// city's own station readings, so all ten cities render identically.
import { useEffect, useState } from "react";
import { api } from "../api";
import { POLLUTANT_LABEL, SCALES } from "../aqi";
import { useAqiScale } from "../aqiScale";
import { Panel, Step } from "../ui";
import { CityHero, PollutantCards, PollutantChips, type Overview, type Pollutant } from "./parts";
import { PollutantDetail } from "./pollutantInfo";
import { AqiCalendar, HealthAdvice, MonthlyTrend, SeriesGraph } from "./charts";

export default function CityAirPanel({ city }: { city: string }) {
  const { scale } = useAqiScale();
  const [d, setD] = useState<Overview | null | "error">(null);
  const [pollutant, setPollutant] = useState<Pollutant>("aqi");

  useEffect(() => {
    setD(null);
    setPollutant("aqi");
    api<Overview>(`/city/overview?city=${city}`).then(setD).catch(() => setD("error"));
  }, [city]);

  if (d === null) return <div className="vn-card h-64 animate-pulse" />;
  if (d === "error") {
    return (
      <div className="vn-card p-4 text-[13px] text-slate-600">
        No live overview for this city right now — the backend may be waking up, or its stations have not reported yet.
      </div>
    );
  }
  const available = Object.keys(d.now.pollutants);
  return (
    <>
      <Step n={1} label="Right now" info={<p>The city's live index on the scale chosen in the header — the maximum of its pollutant sub-indices, with the pollutant that sets it. Station means over this city's own CPCB stations; the age of the newest reading is shown.</p>}>
        <Panel title="Right now" tag={SCALES[scale].short} right={<span className="truncate text-[11px] text-slate-500">{d.name}</span>}>
          <CityHero d={d} scale={scale} />
        </Panel>
      </Step>

      <Step n={2} label="Pollutants" info={<p>Every pollutant this city's stations publish, with its own sub-index on the chosen scale. The card of the pollutant that sets the city index is the prominent one. Click a card for what it is, where it comes from and the standard it is judged against.</p>}>
        <Panel title="Major air pollutants" tag="live" right={<span className="truncate text-[11px] text-slate-500">latest station means</span>}>
          <PollutantCards d={d} scale={scale} onPick={setPollutant} selected={pollutant} compact />
          {pollutant !== "aqi" && <PollutantDetail d={d} scale={scale} pollutant={pollutant} onClose={() => setPollutant("aqi")} />}
        </Panel>
      </Step>

      <Step n={3} label="Graph" info={<p>The index or a single pollutant over 24 hours (hourly means) or 7 days / 30 days / 1 year (daily means), coloured by band. Bars or line. Where the record is shorter than the range, the card says so instead of stretching the axis.</p>}>
        <Panel
          title={pollutant === "aqi" ? "Air quality graph" : `${POLLUTANT_LABEL[pollutant] ?? pollutant} graph`}
          right={<PollutantChips available={available} value={pollutant} onChange={setPollutant} compact />}
        >
          <SeriesGraph d={d} scale={scale} pollutant={pollutant} />
        </Panel>
      </Step>

      <Step n={4} label="Calendar" info={<p>One tile per day, coloured by that day's index from this city's stations. Blank tiles are days with no reading — coverage is shown, never filled in.</p>}>
        <Panel title="Air quality calendar" right={<span className="truncate text-[11px] text-slate-500">{d.coverage.since ? `since ${d.coverage.since}` : ""}</span>}>
          <AqiCalendar d={d} scale={scale} />
        </Panel>
      </Step>

      <Step n={5} label="Trend" info={<p>Monthly mean PM2.5 over the record, with the most and least polluted month. Delhi's winter shows here as the real smog season; cities with a short record say how short it is.</p>}>
        <Panel title="Monthly trend" right={<span className="truncate text-[11px] text-slate-500">{d.coverage.days} days of record</span>}>
          <MonthlyTrend d={d} scale={scale} />
        </Panel>
      </Step>

      <Step n={6} label="Health" info={<p>What today's air means for people: the cigarette-equivalent of the last 24 hours, what to do now, and per-condition guidance. Templated from CPCB's advisory table and WHO guidance — no language model writes health text.</p>}>
        <Panel title="Health advice" tag="not medical advice">
          <HealthAdvice d={d} />
        </Panel>
      </Step>
    </>
  );
}
