// How it works — the honest version. Everything on this page describes what the system actually
// does; where a standard is quoted, the standard is named and linked.
import { REFERENCE_SOURCES } from "../city/pollutantInfo";
import { navigate } from "../router";
import { Button, Chip, Kicker, Surface, Text } from "../design/ui";
import { PageSection } from "./section";
import { ScaleExplainer } from "./explainer";

const PIPELINE: { n: number; title: string; body: string }[] = [
  { n: 1, title: "Measure", body: "CPCB / CAAQMS station readings and OpenAQ are pulled hourly and normalised into one canonical measurement record. Every value keeps its station, its timestamp and its source." },
  { n: 2, title: "Fill the gaps", body: "Stations are sparse — a handful for a whole metro. We interpolate onto an H3 resolution-8 grid (roughly 1 km² per cell) so every neighbourhood has a number, and we publish how confident each cell is." },
  { n: 3, title: "Explain", body: "Each cell's chemical signature — NO₂, SO₂, CO, the PM10/PM2.5 ratio — plus satellite NO₂ columns and active-fire detections are used to attribute pollution to traffic, industry, construction dust, burning, or transport from outside the city." },
  { n: 4, title: "Forecast", body: "A gradient-boosted quantile model, blended with persistence and wrapped in a conformal prediction interval, produces a 72-hour PM2.5 outlook per cell with calibrated probabilities of crossing the action thresholds." },
  { n: 5, title: "Act", body: "The forecast and the attribution become a ranked, evidence-backed worklist for officers, and plain-language advisories for the public in eight languages." },
];

const SOURCES: { name: string; what: string }[] = [
  { name: "CPCB / CAAQMS", what: "India's official continuous ambient air-quality monitoring stations — the ground truth for every index on this site." },
  { name: "OpenAQ", what: "Aggregated public station data, used to widen coverage where CAAQMS is thin." },
  { name: "Copernicus Sentinel-5P", what: "Tropospheric NO₂ column density — the satellite view of combustion, used as an attribution feature." },
  { name: "NASA FIRMS (MODIS / VIIRS)", what: "Active-fire detections — the burning signal behind the fire layer on the map." },
  { name: "Open-Meteo", what: "Weather and boundary-layer variables that drive both the forecast and the deweathering." },
  { name: "OpenStreetMap · WorldPop", what: "Roads, land use, industrial sites and population — the static layers behind exposure and enforcement targeting." },
];

export default function AboutPage() {
  return (
    <div className="vn-page">
      <header style={{ maxWidth: 760 }}>
        <Kicker>how it works</Kicker>
        <Text as="h1" size="display" weight={800} tone="ink" tight style={{ letterSpacing: "-0.03em", marginTop: 6 }}>
          From a few stations to every square kilometre
        </Text>
        <Text as="p" size="md" tone="muted" style={{ marginTop: "var(--s-3)", lineHeight: "var(--lh-body)" }}>
          VayuNetra takes the public station data a city already has, fills the space between the
          stations, works out what is causing the pollution in each cell, forecasts the next three
          days, and turns that into something an officer can act on and a citizen can read.
        </Text>
      </header>

      <PageSection kicker="the pipeline" title="What happens every hour" lead="Five steps, all of them running on live data — nothing on this site is pre-recorded.">
        <div className="vn-grid-3 vn-stagger">
          {PIPELINE.map((s) => (
            <Surface key={s.n} level={1} pad={4} radius="lg" style={{ minWidth: 0 }}>
              <span style={{ display: "inline-grid", placeItems: "center", width: 26, height: 26, borderRadius: "var(--r-full)", background: "var(--primary)", color: "var(--primary-ink)", fontSize: "var(--t-xs)", fontWeight: 800 }}>{s.n}</span>
              <Text as="h3" size="md" weight={800} tone="ink" tight style={{ marginTop: "var(--s-3)" }}>{s.title}</Text>
              <Text as="p" size="sm" tone="ink2" style={{ marginTop: "var(--s-2)", lineHeight: "var(--lh-body)" }}>{s.body}</Text>
            </Surface>
          ))}
        </div>
      </PageSection>

      <PageSection kicker="read the number" title="Three scales, one measurement" lead="The toggle in the header changes how the number is expressed, never what was measured.">
        <ScaleExplainer />
      </PageSection>

      <PageSection kicker="provenance" title="Where the data comes from" lead="Every source is public. None of it is synthesised, and nothing on this site is filled in when a station is silent — gaps are shown as gaps.">
        <Surface level={1} pad={0} radius="lg" style={{ overflow: "hidden" }}>
          <ul style={{ listStyle: "none", margin: 0, padding: 0 }}>
            {SOURCES.map((s, i) => (
              <li key={s.name} style={{ display: "flex", flexWrap: "wrap", gap: "var(--s-3)", padding: "var(--s-4)", borderTop: i ? "1px solid var(--line)" : undefined }}>
                <Text size="sm" weight={700} tone="ink" style={{ flex: "0 0 200px" }}>{s.name}</Text>
                <Text size="sm" tone="ink2" style={{ flex: "1 1 320px", lineHeight: "var(--lh-body)" }}>{s.what}</Text>
              </li>
            ))}
          </ul>
        </Surface>
      </PageSection>

      <PageSection
        kicker="honesty"
        title="What this is not"
        lead="The limits matter as much as the numbers."
      >
        <div className="vn-grid-3">
          <Surface level={1} pad={4} radius="lg">
            <Chip tone="warn">not a compliance measurement</Chip>
            <Text as="p" size="sm" tone="ink2" style={{ marginTop: "var(--s-3)", lineHeight: "var(--lh-body)" }}>
              Our "right now" reading is a city mean of the latest station values, not the 24-hour average CPCB
              publishes in its daily bulletin. Expect our number and the bulletin to differ — they answer different questions.
            </Text>
          </Surface>
          <Surface level={1} pad={4} radius="lg">
            <Chip tone="warn">attribution is an estimate</Chip>
            <Text as="p" size="sm" tone="ink2" style={{ marginTop: "var(--s-3)", lineHeight: "var(--lh-body)" }}>
              Source shares come from a model reading each cell's chemical signature, and every cell carries its own
              confidence. They are a strong lead for an inspector, not a legal finding.
            </Text>
          </Surface>
          <Surface level={1} pad={4} radius="lg">
            <Chip tone="warn">health text is templated</Chip>
            <Text as="p" size="sm" tone="ink2" style={{ marginTop: "var(--s-3)", lineHeight: "var(--lh-body)" }}>
              Advice is generated from CPCB's advisory table and WHO guidance by template — no language model writes
              health text here, and none of it is medical advice.
            </Text>
          </Surface>
        </div>
      </PageSection>

      <PageSection kicker="standards" title="References" lead="The published documents behind every threshold quoted on this site.">
        <Surface level={1} pad={4} radius="lg">
          <ul style={{ margin: 0, paddingLeft: "1.1rem", display: "flex", flexDirection: "column", gap: "var(--s-2)" }}>
            {REFERENCE_SOURCES.map((s) => (
              <li key={s.url}>
                <a href={s.url} target="_blank" rel="noreferrer" style={{ color: "var(--primary)", fontSize: "var(--t-sm)", textDecoration: "underline" }}>{s.label}</a>
              </li>
            ))}
          </ul>
          <div style={{ marginTop: "var(--s-4)" }}>
            <Button variant="primary" size="sm" onClick={() => navigate("/console?section=impact")}>
              See the validation numbers in the console →
            </Button>
          </div>
        </Surface>
      </PageSection>
    </div>
  );
}
