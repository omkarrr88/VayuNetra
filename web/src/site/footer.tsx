// Footer: what this is, who it is for, and where to go next. Deliberately plain — the page above it
// is the argument.
import { linkClick, navigate } from "../router";
import { Text } from "../design/ui";
import { SITE_PAGES, hrefFor } from "./nav";
import { useSite } from "./context";

export function SiteFooter() {
  const { city } = useSite();
  return (
    <footer style={{ borderTop: "1px solid var(--line)", background: "var(--surface-2)", marginTop: "var(--s-10)" }}>
      <div style={{ margin: "0 auto", maxWidth: 1360, padding: "var(--s-8) var(--s-5)", display: "flex", flexWrap: "wrap", gap: "var(--s-8)" }}>
        <div style={{ flex: "1 1 300px", minWidth: 0, maxWidth: 460 }}>
          <Text as="div" size="md" weight={800} tone="ink">VayuNetra</Text>
          <Text as="p" size="sm" tone="muted" style={{ marginTop: "var(--s-2)", lineHeight: "var(--lh-body)" }}>
            Kilometre-scale air quality for Indian cities: what the air is now, what is causing it,
            what it will be for the next three days, and what a city can do about it today.
          </Text>
        </div>
        <nav aria-label="Footer" style={{ flex: "0 1 auto", display: "flex", flexDirection: "column", gap: "var(--s-2)" }}>
          <Text size="2xs" tone="muted" weight={700} uppercase>Pages</Text>
          {SITE_PAGES.map((p) => {
            const href = hrefFor(p.path, city);
            return (
              <a key={p.path} href={href} onClick={(e) => linkClick(e, href)} style={{ fontSize: "var(--t-sm)", color: "var(--ink-2)", textDecoration: "none" }}>{p.label}</a>
            );
          })}
        </nav>
        <div style={{ flex: "0 1 auto", display: "flex", flexDirection: "column", gap: "var(--s-2)" }}>
          <Text size="2xs" tone="muted" weight={700} uppercase>For officials</Text>
          <button onClick={() => navigate(`/console?city=${city}`)} style={{ background: "none", border: 0, padding: 0, textAlign: "left", fontSize: "var(--t-sm)", color: "var(--ink-2)", cursor: "pointer" }}>
            Operations console
          </button>
          <a href="/console?section=impact" onClick={(e) => linkClick(e, "/console?section=impact")} style={{ fontSize: "var(--t-sm)", color: "var(--ink-2)", textDecoration: "none" }}>Validation & impact</a>
        </div>
      </div>
      <div style={{ borderTop: "1px solid var(--line)" }}>
        <div style={{ margin: "0 auto", maxWidth: 1360, padding: "var(--s-3) var(--s-5)" }}>
          <Text size="2xs" tone="faint" style={{ lineHeight: "var(--lh-body)" }}>
            Readings are the latest values from public CPCB / CAAQMS stations, averaged over a city's
            stations — not the 24-hour compliance average. Source attribution and forecasts are model
            estimates with stated confidence. Health guidance is templated from published CPCB and WHO
            advice and is not medical advice.
          </Text>
        </div>
      </div>
    </footer>
  );
}
