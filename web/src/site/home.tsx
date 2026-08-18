// The public overview page — home. Everything a person wants to know about the air in their city,
// on one page, with no map: the index now, every pollutant, the graph, where it is worst, the
// calendar, the yearly rhythm, and what to do about it. All of it from GET /city/overview.
import { useEffect, useState } from "react";
import { api } from "../api";
import { POLLUTANT_LABEL } from "../aqi";
import { useAqiScale } from "../aqiScale";
import { navigate } from "../router";
import { PollutantCards, PollutantChips, type Overview, type Pollutant } from "../city/parts";
import { PollutantDetail } from "../city/pollutantInfo";
import { AqiCalendar, CityCards, HealthAdvice, MonthlyTrend, SeriesGraph, type CityRow } from "../city/charts";
import { Button, Empty, Loading, Text } from "../design/ui";
import { CityHeroBig } from "./hero";
import { PageSection } from "./section";
import { WorstAreas } from "./worstAreas";
import { useSite } from "./context";

export default function HomePage() {
  const { city, setCity } = useSite();
  const { scale } = useAqiScale();
  const [d, setD] = useState<Overview | null | "error">(null);
  const [others, setOthers] = useState<CityRow[]>([]);
  const [pollutant, setPollutant] = useState<Pollutant>("aqi");

  useEffect(() => {
    setD(null);
    setPollutant("aqi");
    let live = true;
    api<Overview>(`/city/overview?city=${city}`)
      .then((r) => { if (live) setD(r); })
      .catch(() => { if (live) setD("error"); });
    return () => { live = false; };
  }, [city]);

  useEffect(() => {
    let live = true;
    api<{ cities: CityRow[] } | CityRow[]>("/comparison")
      .then((r) => { if (live) setOthers(Array.isArray(r) ? r : r.cities ?? []); })
      .catch(() => { /* the section simply hides itself */ });
    return () => { live = false; };
  }, []);

  if (d === null) {
    return <div className="vn-page"><Loading lines={6} label="Loading this city's air" /></div>;
  }
  if (d === "error") {
    return (
      <div className="vn-page">
        <Empty
          message="No live overview for this city right now — the backend may be waking up, or its stations have not reported yet."
          action={<Button variant="primary" size="sm" onClick={() => window.location.reload()}>Try again</Button>}
        />
      </div>
    );
  }

  const available = Object.keys(d.now.pollutants);

  return (
    <div className="vn-page">
      <CityHeroBig d={d} scale={scale} />

      <PageSection
        kicker="what is in the air"
        title="Major air pollutants"
        lead="Every pollutant this city's CPCB stations publish, with its own sub-index on the scale you chose. The card marked PROMINENT is the one setting the city index right now — open any card for what it is, where it comes from, and the standard it is judged against."
      >
        <PollutantCards d={d} scale={scale} onPick={setPollutant} selected={pollutant} />
        {pollutant !== "aqi" && <PollutantDetail d={d} scale={scale} pollutant={pollutant} onClose={() => setPollutant("aqi")} />}
      </PageSection>

      <div className="vn-grid-2" style={{ alignItems: "start" }}>
        <PageSection
          kicker="over time"
          title={pollutant === "aqi" ? "Air quality graph" : `${POLLUTANT_LABEL[pollutant] ?? pollutant} graph`}
          lead="Hourly means over 24 hours, daily means over 7 days, 30 days or a year. Where our record is shorter than the range, the card says so rather than stretching the axis."
          right={<PollutantChips available={available} value={pollutant} onChange={setPollutant} compact />}
        >
          <SeriesGraph d={d} scale={scale} pollutant={pollutant} />
        </PageSection>

        <PageSection
          kicker="where"
          title="Most polluted areas right now"
          lead="Our 1 km grid, ranked. This is the part a city-level number hides — two neighbourhoods can differ by a whole category."
        >
          <WorstAreas city={city} scale={scale} />
        </PageSection>
      </div>

      <PageSection
        kicker="the record"
        title="Air quality calendar"
        lead="One tile per day, coloured by that day's index from this city's own stations."
        right={<Text size="xs" tone="muted">{d.coverage.since ? `since ${d.coverage.since}` : ""}</Text>}
        note="Blank tiles are days with no reading. Coverage is shown, never filled in."
      >
        <AqiCalendar d={d} scale={scale} />
      </PageSection>

      <PageSection
        kicker="the year"
        title="Monthly trend"
        lead="Mean PM2.5 by month across the whole record, with the most and least polluted month called out."
        right={<Text size="xs" tone="muted">{d.coverage.days} days of record</Text>}
      >
        <MonthlyTrend d={d} scale={scale} />
      </PageSection>

      <PageSection
        kicker="what it means for you"
        title="Health advice"
        lead="The cigarette-equivalent of the last 24 hours, what to do today, and guidance per condition. Templated from CPCB's advisory table and WHO guidance — no language model writes health text."
      >
        <HealthAdvice d={d} />
      </PageSection>

      {others.length > 1 && (
        <PageSection
          kicker="compare"
          title="The other cities, right now"
          lead="The same index, computed the same way, for every city we run."
          right={<Button size="sm" onClick={() => navigate(`/rankings?city=${city}`)}>Full rankings →</Button>}
        >
          <CityCards rows={others} scale={scale} onOpen={setCity} exclude={city} />
        </PageSection>
      )}
    </div>
  );
}
