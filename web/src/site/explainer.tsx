// The three published scales, side by side. Every line here is from the standard itself — CPCB's
// 2014 National AQI, the US EPA AQI, and the WHO 2021 guidelines — not from our own data.
import { SCALES, type AqiScale } from "../aqi";
import { useAqiScale } from "../aqiScale";
import { Chip, Surface, Text } from "../design/ui";

const DETAIL: Record<AqiScale, { how: string; bands: string; useIt: string }> = {
  in: {
    how: "Each pollutant gets a sub-index from its own breakpoints; the city index is the highest of them, and that pollutant is named the prominent one.",
    bands: "Good · Satisfactory · Moderate · Poor · Very Poor · Severe",
    useIt: "This is the number Indian officers, CPCB bulletins and GRAP actions run on. It is our default for that reason.",
  },
  us: {
    how: "Same idea, different breakpoints — the 2024 PM2.5 revision makes it stricter at the clean end, so the US number usually reads higher than the Indian one for the same air.",
    bands: "Good · Moderate · Unhealthy for Sensitive Groups · Unhealthy · Very Unhealthy · Hazardous",
    useIt: "Most international apps display this, so it is here to let you check us against them without changing what we measure.",
  },
  who: {
    how: "Not an index at all — PM2.5 expressed as a multiple of the WHO 24-hour guideline of 15 µg/m³, banded by the WHO interim targets.",
    bands: "Within guideline · above it, by interim target IT-4 down to IT-1",
    useIt: "The health yardstick: it says how far from safe the air is, rather than which administrative box it falls in.",
  },
};

export function ScaleExplainer() {
  const { scale, setScale } = useAqiScale();
  return (
    <div className="vn-grid-3">
      {(Object.keys(SCALES) as AqiScale[]).map((k) => {
        const on = k === scale;
        return (
          <Surface key={k} level={on ? 2 : 1} pad={4} radius="lg" style={{ borderColor: on ? "var(--primary)" : undefined, minWidth: 0 }}>
            <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: "var(--s-2)" }}>
              <Text size="md" weight={800} tone="ink" tight>{SCALES[k].short}</Text>
              {on ? <Chip tone="primary" solid>showing</Chip> : (
                <button onClick={() => setScale(k)} style={{ background: "none", border: 0, padding: 0, color: "var(--primary)", fontSize: "var(--t-xs)", fontWeight: 700, cursor: "pointer" }}>
                  switch to this
                </button>
              )}
            </div>
            <Text as="div" size="xs" tone="muted" weight={600} style={{ marginTop: 2 }}>{SCALES[k].name}</Text>
            <Text as="p" size="sm" tone="ink2" style={{ marginTop: "var(--s-3)", lineHeight: "var(--lh-body)" }}>{DETAIL[k].how}</Text>
            <Text as="p" size="xs" tone="muted" style={{ marginTop: "var(--s-3)", lineHeight: "var(--lh-body)" }}><b>Bands.</b> {DETAIL[k].bands}</Text>
            <Text as="p" size="xs" tone="muted" style={{ marginTop: "var(--s-2)", lineHeight: "var(--lh-body)" }}>{DETAIL[k].useIt}</Text>
          </Surface>
        );
      })}
    </div>
  );
}
