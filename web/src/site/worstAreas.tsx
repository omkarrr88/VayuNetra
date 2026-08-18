// "Where is it worst right now" — the cell-level answer, as a list rather than a map, because the
// overview page carries no map. Same GET /aqi/current rows the map draws from, so the list and the
// map can never disagree; the button hands you to the map with this city loaded.
import { useEffect, useState } from "react";
import { api } from "../api";
import { categoryForIndex, formatIndex, pm25Index, POLLUTANT_LABEL, type AqiScale } from "../aqi";
import { placeForCell } from "../placeName";
import { navigate } from "../router";
import { Button, Empty, Loading, Surface, Text } from "../design/ui";

type Cell = {
  h3_cell: string; pm25: number | null; ts?: string; confidence?: number;
  aqi_in?: number | null; aqi_us?: number | null; prominent_in?: string | null; prominent_us?: string | null;
};

function cellIndex(c: Cell, scale: AqiScale): number | null {
  if (scale === "who") return c.pm25 !== null && c.pm25 !== undefined ? pm25Index(c.pm25, "who") : null;
  const v = scale === "us" ? c.aqi_us : c.aqi_in;
  if (typeof v === "number") return v;
  return c.pm25 !== null && c.pm25 !== undefined ? pm25Index(c.pm25, scale) : null;
}

export function WorstAreas({ city, scale, limit = 6 }: { city: string; scale: AqiScale; limit?: number }) {
  const [rows, setRows] = useState<Cell[] | null | "error">(null);
  const [names, setNames] = useState<Record<string, string>>({});

  useEffect(() => {
    setRows(null);
    setNames({});
    let live = true;
    api<Cell[]>(`/aqi/current?city=${city}`)
      .then((r) => { if (live) setRows(r); })
      .catch(() => { if (live) setRows("error"); });
    return () => { live = false; };
  }, [city]);

  const ranked = Array.isArray(rows)
    ? [...rows].filter((c) => cellIndex(c, scale) !== null).sort((a, b) => (cellIndex(b, scale) ?? 0) - (cellIndex(a, scale) ?? 0)).slice(0, limit)
    : [];

  // Ward names resolve from the bundled boundary files — best effort, never blocking the list.
  useEffect(() => {
    let live = true;
    Promise.all(ranked.map(async (c) => [c.h3_cell, (await placeForCell(city, c.h3_cell))?.label] as const))
      .then((pairs) => {
        if (!live) return;
        const next: Record<string, string> = {};
        for (const [cell, label] of pairs) if (label) next[cell] = label;
        setNames(next);
      })
      .catch(() => { /* raw cell ids are a fine fallback */ });
    return () => { live = false; };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [city, ranked.map((c) => c.h3_cell).join(",")]);

  if (rows === null) return <Loading lines={4} label="Loading the worst areas" />;
  if (rows === "error" || ranked.length === 0) {
    return <Empty message="No cell-level readings for this city right now — its stations may not have reported in the last hour." />;
  }

  return (
    <div>
      <Surface level={1} pad={0} radius="md" style={{ overflow: "hidden" }}>
        <ol className="vn-stagger" style={{ listStyle: "none", margin: 0, padding: 0 }}>
          {ranked.map((c, i) => {
            const idx = cellIndex(c, scale) ?? 0;
            const cat = categoryForIndex(idx, scale);
            const prominent = scale === "us" ? c.prominent_us : c.prominent_in;
            return (
              <li key={c.h3_cell} style={{ display: "flex", alignItems: "center", gap: "var(--s-3)", padding: "var(--s-3) var(--s-4)", borderTop: i ? "1px solid var(--line)" : undefined }}>
                <span aria-hidden="true" style={{ width: 4, alignSelf: "stretch", borderRadius: 2, background: cat.color, flex: "none" }} />
                <Text size="xs" tone="faint" weight={700} style={{ width: 18, flex: "none" }}>{i + 1}</Text>
                <span style={{ minWidth: 0, flex: 1 }}>
                  <Text as="div" size="sm" weight={700} tone="ink" style={{ overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                    {names[c.h3_cell] ?? "1 km cell"}
                  </Text>
                  <Text as="div" size="2xs" tone="faint" style={{ fontFamily: "ui-monospace, monospace" }}>{c.h3_cell}</Text>
                </span>
                <span style={{ textAlign: "right", flex: "none" }}>
                  <Text as="div" size="lg" weight={800} tight style={{ color: cat.color }}>{formatIndex(idx, scale)}</Text>
                  <Text as="div" size="2xs" tone="muted">
                    {c.pm25 !== null && c.pm25 !== undefined ? `PM2.5 ${c.pm25}` : cat.label}
                    {prominent && scale !== "who" ? ` · ${POLLUTANT_LABEL[prominent] ?? prominent}` : ""}
                  </Text>
                </span>
              </li>
            );
          })}
        </ol>
      </Surface>
      <div style={{ marginTop: "var(--s-3)", display: "flex", gap: "var(--s-2)", flexWrap: "wrap" }}>
        <Button variant="primary" size="sm" onClick={() => navigate(`/map?city=${city}`)}>See these on the live map →</Button>
      </div>
    </div>
  );
}
