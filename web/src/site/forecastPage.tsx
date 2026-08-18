// Forecast and causes — the two questions a city-level number cannot answer: what happens next,
// and why. Both panels are the console's own, unchanged; only their frame is new.
import ForecastPanel from "../ForecastPanel";
import { Text } from "../design/ui";
import { PageSection } from "./section";
import { CityCauses } from "./causes";
import { useSite } from "./context";

export default function ForecastPage() {
  const { city, name } = useSite();
  return (
    <div className="vn-page">
      <header style={{ maxWidth: 760 }}>
        <Text as="h1" size="display" weight={800} tone="ink" tight style={{ letterSpacing: "-0.03em" }}>What happens next in {name}</Text>
        <Text as="p" size="md" tone="muted" style={{ marginTop: "var(--s-3)", lineHeight: "var(--lh-body)" }}>
          A 72-hour PM2.5 outlook for every 1 km cell, with an honest uncertainty band, and the source
          mix that explains where today's pollution is coming from.
        </Text>
      </header>

      <PageSection
        kicker="next 72 hours"
        title="Forecast"
        lead="Hourly PM2.5 by horizon, with the 80% prediction interval and the probability of crossing the action thresholds. The band is calibrated, not decorative — it is meant to be wrong about one time in five."
      >
        <ForecastPanel city={city} />
      </PageSection>

      <PageSection
        kicker="why"
        title="What is causing it"
        lead="Mean source shares across every attributed 1 km cell in the city, from the chemical signature of each cell — traffic, industry, construction dust, burning, and what blew in from outside."
        note="Shares are a model estimate with a stated confidence, not a measurement. The cell-by-cell view on the map shows the evidence behind each one."
      >
        <CityCauses city={city} name={name} />
      </PageSection>
    </div>
  );
}
