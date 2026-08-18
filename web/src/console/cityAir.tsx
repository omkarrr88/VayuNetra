// The city-air blocks, as console cards. These used to be a section of their own; they belong
// inside the pages that already ask the same questions — what is in the air (Forecast), what the
// record looks like (Forecast), and what people should do about it (Advisories).
//
// The public city page keeps its own full-width versions of these; both read the identical
// GET /city/overview payload, so the officer and the citizen can never see different air.
import { useEffect, useState } from "react";
import { api } from "../api";
import { POLLUTANT_LABEL, SCALES } from "../aqi";
import { useAqiScale } from "../aqiScale";
import { PollutantCards, PollutantChips, type Overview, type Pollutant } from "../city/parts";
import { PollutantDetail } from "../city/pollutantInfo";
import { AqiCalendar, HealthAdvice, MonthlyTrend, SeriesGraph } from "../city/charts";
import { EmptyState, Panel } from "../ui";
import { Cols } from "./Cols";

/** One fetch per city, shared by whichever blocks a page mounts. */
export function useOverview(city: string) {
  const [d, setD] = useState<Overview | null | "error">(null);
  useEffect(() => {
    setD(null);
    let live = true;
    api<Overview>(`/city/overview?city=${city}`)
      .then((r) => { if (live) setD(r); })
      .catch(() => { if (live) setD("error"); });
    return () => { live = false; };
  }, [city]);
  return d;
}

const Loading = () => <Panel><div className="vn-skeleton" style={{ height: 180 }} /></Panel>;
const Failed = ({ what }: { what: string }) => (
  <Panel title={what}><EmptyState message="No live overview for this city right now — its stations may not have reported yet." tone="error" /></Panel>
);

/** What is in the air right now, pollutant by pollutant, with the one that sets the index. */
export function PollutantsNowPanel({ city }: { city: string }) {
  const { scale } = useAqiScale();
  const d = useOverview(city);
  const [pollutant, setPollutant] = useState<Pollutant>("aqi");
  if (d === null) return <Loading />;
  if (d === "error") return <Failed what="Pollutants right now" />;
  return (
    <Panel
      title="Pollutants right now"
      tag={SCALES[scale].short}
      right={<span className="text-[11px] text-slate-500">latest station means</span>}
      info={<p>Every pollutant this city's stations publish, with its own sub-index on the chosen scale. The card marked PROMINENT is the one setting the city index. Open a card for what it is, where it comes from and the standard it is judged against.</p>}
    >
      <PollutantCards d={d} scale={scale} onPick={setPollutant} selected={pollutant} />
      {pollutant !== "aqi" && <PollutantDetail d={d} scale={scale} pollutant={pollutant} onClose={() => setPollutant("aqi")} />}
    </Panel>
  );
}

/** The graph — the step-numbered card of the record. */
export function AirGraphPanel({ city }: { city: string }) {
  const { scale } = useAqiScale();
  const d = useOverview(city);
  const [pollutant, setPollutant] = useState<Pollutant>("aqi");
  if (d === null) return <Loading />;
  if (d === "error") return <Failed what="The record" />;
  const available = Object.keys(d.now.pollutants);
  return (
    <Panel
        title={pollutant === "aqi" ? "Air quality graph" : `${POLLUTANT_LABEL[pollutant] ?? pollutant} graph`}
        right={<PollutantChips available={available} value={pollutant} onChange={setPollutant} compact />}
        info={<p>The index or a single pollutant over 24 hours (hourly means) or 7 / 30 / 365 days (daily means), coloured by band. Where the record is shorter than the range, the card says so instead of stretching the axis.</p>}
      >
      <SeriesGraph d={d} scale={scale} pollutant={pollutant} />
    </Panel>
  );
}

/** The calendar and the yearly rhythm — two summary cards, side by side. */
export function AirRecordCols({ city }: { city: string }) {
  const { scale } = useAqiScale();
  const d = useOverview(city);
  if (d === null) return <Loading />;
  if (d === "error") return null;
  return (
    <Cols>
      <Panel
        title="Air quality calendar"
          right={<span className="text-[11px] text-slate-500">{d.coverage.since ? `since ${d.coverage.since}` : ""}</span>}
          info={<p>One tile per day, coloured by that day's index from this city's own stations. Blank tiles are days with no reading — coverage is shown, never filled in.</p>}
        >
          <AqiCalendar d={d} scale={scale} />
        </Panel>
      <Panel
        title="Monthly trend"
          right={<span className="text-[11px] text-slate-500">{d.coverage.days} days of record</span>}
          info={<p>Mean PM2.5 by month across the whole record, with the most and least polluted month. Cities with a short record say how short it is rather than charting years we did not measure.</p>}
        >
          <MonthlyTrend d={d} scale={scale} />
        </Panel>
    </Cols>
  );
}

/** What today's air means for people — the advisory page's evidence for what it tells them. */
export function HealthPanel({ city }: { city: string }) {
  const d = useOverview(city);
  if (d === null) return <Loading />;
  if (d === "error") return <Failed what="Health advice" />;
  return (
    <Panel
      title="What today's air does to people"
      tag="not medical advice"
      info={<p>The cigarette-equivalent of the last 24 hours, what to do now, and per-condition guidance. Templated from CPCB's advisory table and WHO guidance — no language model writes health text.</p>}
    >
      <HealthAdvice d={d} />
    </Panel>
  );
}
