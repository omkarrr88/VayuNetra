// Every city we run, ranked live on the scale you chose. The table and the cards are the console's
// own components — the numbers here are the same composite indices each city's page shows, so the
// scoreboard can never disagree with the city it links to.
import { useEffect, useState } from "react";
import { api } from "../api";
import { SCALES } from "../aqi";
import { useAqiScale } from "../aqiScale";
import { CitiesTable, CityCards, type CityRow } from "../city/charts";
import { Empty, Loading, Text } from "../design/ui";
import { PageSection } from "./section";
import { ScaleExplainer } from "./explainer";
import { useSite } from "./context";

export default function RankingsPage() {
  const { city, setCity } = useSite();
  const { scale } = useAqiScale();
  const [rows, setRows] = useState<CityRow[] | null | "error">(null);
  const [pattern, setPattern] = useState<string>("");

  useEffect(() => {
    let live = true;
    api<{ summary?: { shared_pattern?: string }; cities: CityRow[] } | CityRow[]>("/comparison")
      .then((r) => {
        if (!live) return;
        if (Array.isArray(r)) setRows(r);
        else { setRows(r.cities ?? []); setPattern(r.summary?.shared_pattern ?? ""); }
      })
      .catch(() => { if (live) setRows("error"); });
    return () => { live = false; };
  }, []);

  return (
    <div className="vn-page">
      <header style={{ maxWidth: 760 }}>
        <Text as="h1" size="display" weight={800} tone="ink" tight style={{ letterSpacing: "-0.03em" }}>India, right now</Text>
        <Text as="p" size="md" tone="muted" style={{ marginTop: "var(--s-3)", lineHeight: "var(--lh-body)" }}>
          Ten cities, one definition of the index, updated every hour from CPCB station data. Sort by
          any column; click a city to open its page.
        </Text>
      </header>

      <PageSection
        kicker={`on the ${SCALES[scale].name}`}
        title="Live city rankings"
        lead={pattern || "The dominant source column is the city's mean attributed source across its 1 km cells."}
        note="A city appears only once its stations have reported in the current window. '+24 h' is the forecast city-mean PM2.5, not an index."
      >
        {rows === null && <Loading lines={6} label="Loading the rankings" />}
        {rows === "error" && <Empty message="Could not load the multi-city comparison right now." />}
        {Array.isArray(rows) && rows.length === 0 && <Empty message="No cities have reported in the current window." />}
        {Array.isArray(rows) && rows.length > 0 && (
          <>
            <CitiesTable rows={rows} scale={scale} onOpen={setCity} activeCity={city} />
            <div style={{ marginTop: "var(--s-5)" }}>
              <CityCards rows={rows} scale={scale} onOpen={setCity} />
            </div>
          </>
        )}
      </PageSection>

      <PageSection
        kicker="read the number"
        title="Which scale am I looking at?"
        lead="The same air, three published yardsticks. Switching the toggle in the header changes labels, band colours and the index number — never the measured concentration underneath."
      >
        <ScaleExplainer />
      </PageSection>
    </div>
  );
}
