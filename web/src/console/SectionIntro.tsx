// The head of a console page: what this section is for, in the one honest sentence the flow
// definition already carries, plus the numbered path through it.
import { FLOWS } from "./flows";
import type { Section } from "../Sidebar";
import { Kicker, Text } from "../design/ui";

export function SectionIntro({ section, cityName }: { section: Section; cityName?: string }) {
  const flow = FLOWS[section];
  return (
    <header data-tour="spine" style={{ maxWidth: 820 }}>
      <Kicker>{flow.verb}{cityName ? ` · ${cityName}` : ""}</Kicker>
      <Text as="h1" size="display" weight={800} tone="ink" tight style={{ letterSpacing: "-0.03em", marginTop: 6 }}>{flow.title}</Text>
      <Text as="p" size="md" tone="muted" style={{ marginTop: "var(--s-3)", lineHeight: "var(--lh-body)" }}>{flow.blurb}</Text>
      {flow.steps.length > 1 && (
        <ol style={{ listStyle: "none", display: "flex", flexWrap: "wrap", gap: "var(--s-2)", margin: "var(--s-4) 0 0", padding: 0 }}>
          {flow.steps.map((s) => (
            <li key={s.n}>
              <a
                href={`#step-${s.n}`}
                onClick={(e) => { e.preventDefault(); document.querySelector(`[data-step="${s.n}"]`)?.scrollIntoView({ behavior: "smooth", block: "start" }); }}
                style={{
                  display: "inline-flex", alignItems: "center", gap: 6, padding: "5px 11px", borderRadius: "var(--r-full)",
                  border: "1px solid var(--line)", background: "var(--surface)", textDecoration: "none",
                  fontSize: "var(--t-xs)", fontWeight: 700, color: "var(--ink-2)", whiteSpace: "nowrap",
                }}
              >
                <span style={{ display: "inline-grid", placeItems: "center", width: 16, height: 16, borderRadius: "var(--r-full)", background: "var(--primary)", color: "var(--primary-ink)", fontSize: "9px", fontWeight: 800 }}>{s.n}</span>
                {s.label}
              </a>
            </li>
          ))}
        </ol>
      )}
    </header>
  );
}
