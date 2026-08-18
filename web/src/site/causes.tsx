// "What is causing it" for the whole city — the mean source mix across every attributed 1 km cell,
// straight from GET /attribution. Same rows, same shares and same palette the blame map draws from;
// this only adds them up so a citizen can read the city in one shape.
import { useEffect, useMemo, useState } from "react";
import { api } from "../api";
import { SOURCE_COLORS } from "../sources";
import { navigate } from "../router";
import { Button, Empty, Loading, Surface, Text } from "../design/ui";

type AttrRow = { h3_cell: string; shares?: Record<string, number>; confidence?: number };

const LABEL: Record<string, string> = {
  traffic: "Traffic", construction_dust: "Construction dust", industrial: "Industry",
  biomass_burning: "Burning", transported: "Blown in from outside", other: "Other / unresolved",
};
const rgb = (c: [number, number, number]) => `rgb(${c[0]},${c[1]},${c[2]})`;

/** Mean share per source across the attributed cells, biggest first. */
function mix(rows: AttrRow[]): { key: string; label: string; pct: number; color: string }[] {
  if (!rows.length) return [];
  const sums: Record<string, number> = {};
  for (const r of rows) for (const [k, v] of Object.entries(r.shares ?? {})) sums[k] = (sums[k] ?? 0) + (typeof v === "number" ? v : 0);
  return Object.entries(sums)
    .map(([k, v]) => ({ key: k, label: LABEL[k] ?? k.replace(/_/g, " "), pct: (v / rows.length) * 100, color: rgb(SOURCE_COLORS[k] ?? [148, 163, 184]) }))
    .filter((d) => d.pct >= 0.5)
    .sort((a, b) => b.pct - a.pct);
}

/** A donut drawn as SVG arcs — no chart library, so it costs nothing and animates cleanly. */
function Donut({ parts, size = 190 }: { parts: { key: string; label: string; pct: number; color: string }[]; size?: number }) {
  const r = size / 2 - 12, c = 2 * Math.PI * r;
  let offset = 0;
  const total = parts.reduce((s, p) => s + p.pct, 0) || 100;
  const top = parts[0];
  return (
    <div style={{ position: "relative", width: size, height: size, flex: "none" }}>
      <svg viewBox={`0 0 ${size} ${size}`} width={size} height={size} role="img" aria-label={`Source mix: ${parts.map((p) => `${p.label} ${p.pct.toFixed(0)} per cent`).join(", ")}`}>
        <g transform={`rotate(-90 ${size / 2} ${size / 2})`}>
          {parts.map((p) => {
            const len = (p.pct / total) * c;
            const dash = `${len} ${c - len}`;
            const el = (
              <circle key={p.key} cx={size / 2} cy={size / 2} r={r} fill="none" stroke={p.color} strokeWidth="22"
                      strokeDasharray={dash} strokeDashoffset={-offset} className="vn-fade" />
            );
            offset += len;
            return el;
          })}
        </g>
      </svg>
      {top && (
        <div style={{ position: "absolute", inset: 0, display: "grid", placeItems: "center", textAlign: "center", padding: 30 }}>
          <div>
            <Text as="div" size="xl" weight={800} tone="ink" tight>{top.pct.toFixed(0)}%</Text>
            <Text as="div" size="2xs" tone="muted" weight={700}>{top.label}</Text>
          </div>
        </div>
      )}
    </div>
  );
}

export function CityCauses({ city, name }: { city: string; name: string }) {
  const [rows, setRows] = useState<AttrRow[] | null | "error">(null);
  useEffect(() => {
    setRows(null);
    let live = true;
    api<AttrRow[]>(`/attribution?city=${city}`).then((r) => { if (live) setRows(r); }).catch(() => { if (live) setRows("error"); });
    return () => { live = false; };
  }, [city]);

  const parts = useMemo(() => (Array.isArray(rows) ? mix(rows) : []), [rows]);
  const meanConfidence = useMemo(() => {
    if (!Array.isArray(rows) || !rows.length) return null;
    const vals = rows.map((r) => r.confidence).filter((v): v is number => typeof v === "number");
    return vals.length ? vals.reduce((s, v) => s + v, 0) / vals.length : null;
  }, [rows]);

  if (rows === null) return <Loading lines={4} label="Loading the source mix" />;
  if (rows === "error" || parts.length === 0) {
    return <Empty message={`No attribution for ${name} in the latest window — it runs on the hour, per 1 km cell.`} />;
  }

  return (
    <Surface level={1} pad={5} radius="lg">
      <div style={{ display: "flex", flexWrap: "wrap", gap: "var(--s-6)", alignItems: "center" }}>
        <Donut parts={parts} />
        <div style={{ minWidth: 0, flex: "1 1 260px" }}>
          <ul className="vn-stagger" style={{ listStyle: "none", margin: 0, padding: 0, display: "flex", flexDirection: "column", gap: "var(--s-3)" }}>
            {parts.map((p) => (
              <li key={p.key}>
                <div style={{ display: "flex", alignItems: "baseline", justifyContent: "space-between", gap: "var(--s-3)" }}>
                  <Text size="sm" weight={700} tone="ink">{p.label}</Text>
                  <Text size="sm" weight={800} tone="ink">{p.pct.toFixed(1)}%</Text>
                </div>
                <div style={{ marginTop: 4, height: 6, borderRadius: "var(--r-full)", background: "var(--surface-3)", overflow: "hidden" }}>
                  <div style={{ width: `${Math.min(100, p.pct)}%`, height: "100%", background: p.color, borderRadius: "var(--r-full)", transition: "width var(--slow) var(--ease)" }} />
                </div>
              </li>
            ))}
          </ul>
          <div style={{ marginTop: "var(--s-4)", display: "flex", flexWrap: "wrap", gap: "var(--s-2)", alignItems: "center" }}>
            <Button size="sm" onClick={() => navigate(`/map?city=${city}`)}>See it cell by cell →</Button>
            {meanConfidence !== null && <Text size="xs" tone="muted">mean confidence {(meanConfidence * 100).toFixed(0)}% · {rows.length} cells</Text>}
          </div>
        </div>
      </div>
    </Surface>
  );
}
