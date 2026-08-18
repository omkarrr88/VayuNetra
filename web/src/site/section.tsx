// Section frame for the public pages: a kicker, a title people would say out loud, a one-line
// explanation, and room on the right for the section's own control.
import { type ReactNode } from "react";
import { Kicker, Text } from "../design/ui";

export function PageSection({ kicker, title, lead, right, note, children, id }: {
  kicker?: string; title: string; lead?: ReactNode; right?: ReactNode; note?: ReactNode; children: ReactNode; id?: string;
}) {
  return (
    <section id={id} style={{ marginTop: "var(--s-10)", scrollMarginTop: 80 }}>
      <div style={{ display: "flex", flexWrap: "wrap", alignItems: "flex-end", justifyContent: "space-between", gap: "var(--s-4)", paddingBottom: "var(--s-3)", borderBottom: "1px solid var(--line)" }}>
        <div style={{ minWidth: 0, maxWidth: 720 }}>
          {kicker && <Kicker>{kicker}</Kicker>}
          <Text as="h2" size="xl" weight={800} tone="ink" tight style={{ marginTop: kicker ? 4 : 0 }}>{title}</Text>
          {lead && <Text as="p" size="sm" tone="muted" style={{ marginTop: 6, lineHeight: "var(--lh-body)" }}>{lead}</Text>}
        </div>
        {right && <div style={{ flex: "none" }}>{right}</div>}
      </div>
      <div style={{ marginTop: "var(--s-5)" }}>{children}</div>
      {note && <Text as="p" size="2xs" tone="faint" style={{ marginTop: "var(--s-3)", lineHeight: "var(--lh-body)" }}>{note}</Text>}
    </section>
  );
}
