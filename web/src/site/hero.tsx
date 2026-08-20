// The public page's opening statement: one number, said once, at the size it deserves.
// Everything in it is live from GET /city/overview — the same payload the console reads, so the
// public page and the officer console can never show different air.
import { categoryForIndex, whoWorst, POLLUTANT_LABEL, SCALES, type AqiScale, bandInk } from "../aqi";
import { ScaleBar, ago, type Overview } from "../city/parts";
import { Metric, Surface, Text } from "../design/ui";

/** Index on the chosen scale — WHO is defined on PM2.5 alone, the other two are composites. */
export function heroIndex(d: Overview, scale: AqiScale): number | null {
  if (scale === "us") return d.now.aqi_us;
  // WHO: the pollutant furthest above ITS OWN guideline, like CPCB and EPA take the worst
  // sub-index. This used to divide PM2.5 alone by 15 while the caption named the CPCB prominent
  // pollutant, so the number and the label described different things.
  if (scale === "who") return whoWorst(d.now.pollutants)?.multiple ?? null;
  return d.now.aqi_in;
}

/** The pollutant a scale's headline is set by. */
export function heroProminent(d: Overview, scale: AqiScale): string | null {
  if (scale === "us") return d.now.prominent_us;
  if (scale === "who") return whoWorst(d.now.pollutants)?.pollutant ?? null;
  return d.now.prominent_in;
}

/** The last 24 hours of the city index, drawn as a line that draws itself in. */
function Sparkline({ d, scale, color }: { d: Overview; scale: AqiScale; color: string }) {
  const pts = d.hourly.index ?? [];
  if (pts.length < 3) return null;
  // On the WHO scale the hourly series is the PM2.5 multiple of the 15 µg/m³ guideline; plotting
  // aqi_in here made the WHO sparkline identical to the CPCB one, down to its axis labels.
  // the server supplies the WHO multiple per hour, because it needs the raw readings the browser
  // does not receive; without it this chart plotted the CPCB index under a WHO heading
  const vals = pts.map((p) => (scale === "us" ? p.aqi_us : scale === "who" ? (p.who ?? 0) : p.aqi_in));
  const lo = Math.min(...vals), hi = Math.max(...vals);
  const span = hi - lo || 1;
  const W = 100, H = 30;
  const xy = vals.map((v, i) => [(i / (vals.length - 1)) * W, H - ((v - lo) / span) * (H - 4) - 2] as const);
  const path = xy.map(([x, y], i) => `${i ? "L" : "M"}${x.toFixed(2)} ${y.toFixed(2)}`).join(" ");
  const area = `${path} L${W} ${H} L0 ${H} Z`;
  const first = vals[0], last = vals[vals.length - 1];
  const delta = last - first;
  return (
    <div style={{ minWidth: 0, flex: "1 1 220px" }}>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "baseline", marginBottom: 4 }}>
        <Text size="2xs" tone="muted" weight={700} uppercase>last 24 hours</Text>
        <Text size="xs" tone={delta > 0 ? "danger" : delta < 0 ? "accent" : "muted"} weight={700}>
          {delta === 0 ? "flat" : `${delta > 0 ? "▲" : "▼"} ${Math.abs(Math.round(delta))}`}
        </Text>
      </div>
      <svg viewBox={`0 0 ${W} ${H}`} preserveAspectRatio="none" style={{ width: "100%", height: 56, display: "block", overflow: "visible" }} role="img"
           aria-label={`City index over the last 24 hours, from ${Math.round(first)} to ${Math.round(last)}`}>
        <defs>
          <linearGradient id="vn-spark" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor={color} stopOpacity="0.16" />
            <stop offset="100%" stopColor={color} stopOpacity="0" />
          </linearGradient>
        </defs>
        <path d={area} fill="url(#vn-spark)" className="vn-fade" />
        <path d={path} fill="none" stroke={color} strokeWidth="1.6" strokeLinejoin="round" strokeLinecap="round"
              vectorEffect="non-scaling-stroke" className="vn-draw" style={{ ["--len" as string]: "400" }} />
        <circle cx={xy[xy.length - 1][0]} cy={xy[xy.length - 1][1]} r="2.4" fill={color} vectorEffect="non-scaling-stroke" />
      </svg>
      <div style={{ display: "flex", justifyContent: "space-between", marginTop: 2 }}>
        <Text size="2xs" tone="faint">low {Math.round(lo)}</Text>
        <Text size="2xs" tone="faint">high {Math.round(hi)}</Text>
      </div>
    </div>
  );
}

function Tile({ value, label, sub }: { value: string; label: string; sub?: string }) {
  return (
    <Surface level={1} pad={3} radius="md" style={{ minWidth: 0 }}>
      <Text as="div" size="xl" weight={800} tone="ink" tight>{value}</Text>
      <Text as="div" size="xs" tone="muted" weight={700} style={{ marginTop: 2 }}>{label}</Text>
      {sub && <Text as="div" size="2xs" tone="faint" style={{ marginTop: 2 }}>{sub}</Text>}
    </Surface>
  );
}

export function CityHeroBig({ d, scale }: { d: Overview; scale: AqiScale }) {
  const index = heroIndex(d, scale);
  // On WHO the band must come from the SETTING pollutant's own interim targets. Deriving it from
  // the multiple ran it back through PM2.5's ladder, so Ahmedabad's PM10 at 174 µg/m³ — past PM10's
  // IT-1 of 150 — was shown as "≤ IT-1", one band too kind.
  const who = scale === "who" ? whoWorst(d.now.pollutants) : null;
  const cat = scale === "who" ? who?.category ?? null : index !== null ? categoryForIndex(index, scale) : null;
  // the band colour reads as a fill; as TEXT it needs the darkened/lightened ink
  const fill = cat?.color ?? "var(--muted)";
  const colour = bandInk(cat?.color);
  const prominent = heroProminent(d, scale);
  const newest = Object.values(d.now.pollutants).map((p) => p.hour).sort().pop();
  const pm25 = d.now.pollutants.pm25;
  const cigs = d.health?.cigarettes?.per_day ?? null;

  return (
    <section className="vn-wash" style={{ ["--wash" as string]: fill, paddingBottom: "var(--s-6)" }}>
      <div style={{ position: "relative", display: "flex", flexWrap: "wrap", alignItems: "flex-end", gap: "var(--s-6)" }}>
        <div style={{ minWidth: 0, flex: "1 1 300px" }}>
          <div style={{ display: "flex", alignItems: "center", gap: "var(--s-2)" }}>
            <span aria-hidden="true" style={{ position: "relative", display: "inline-flex", width: 8, height: 8 }}>
              <span style={{ position: "absolute", inset: 0, borderRadius: "var(--r-full)", background: colour, animation: "vn-pulse-ring 1.8s var(--ease) infinite" }} />
              <span style={{ position: "relative", width: 8, height: 8, borderRadius: "var(--r-full)", background: colour }} />
            </span>
            <Text size="2xs" weight={800} uppercase style={{ color: colour }}>live</Text>
            <Text size="2xs" tone="faint">· station means, {ago(newest)}</Text>
          </div>

          <Text as="h1" size="display" weight={800} tone="ink" tight style={{ marginTop: "var(--s-2)", letterSpacing: "-0.03em" }}>
            {d.name}
          </Text>
          <Text as="p" size="sm" tone="muted" style={{ marginTop: 2 }}>
            Air quality right now, on the {SCALES[scale].name}.
          </Text>

          <div style={{ display: "flex", alignItems: "flex-end", gap: "var(--s-4)", marginTop: "var(--s-4)", flexWrap: "wrap" }}>
            <Metric value={index} size="metric" tone={colour} unit={SCALES[scale].short} decimals={scale === "who" ? 1 : 0} suffix={scale === "who" ? "×" : undefined} />
            <div style={{ paddingBottom: 4 }}>
              <Text as="div" size="lg" weight={800} tight style={{ color: colour }}>{cat?.label ?? "no reading"}</Text>
              {prominent && (
                <Text as="div" size="sm" tone="muted">
                  set by <b style={{ color: "var(--ink)" }}>{POLLUTANT_LABEL[prominent] ?? prominent}</b>
                </Text>
              )}
            </div>
          </div>

          <div style={{ maxWidth: 460 }}><ScaleBar index={index} scale={scale} pollutant={prominent} /></div>
        </div>

        <Sparkline d={d} scale={scale} color={colour} />
      </div>

      <div className="vn-grid-3 vn-stagger" style={{ marginTop: "var(--s-5)" }}>
        {d.rank && <Tile value={`#${d.rank.position}`} label={`of ${d.rank.of} cities we run`} sub="most polluted right now" />}
        {pm25 && <Tile value={`${pm25.value}`} label="PM2.5 µg/m³ latest" sub={`${pm25.n ?? 0} station${pm25.n === 1 ? "" : "s"}`} />}
        {d.now.pm25_24h !== null && <Tile value={`${d.now.pm25_24h}`} label="PM2.5 µg/m³ · 24 h mean" sub={`${d.coverage.hours_24h} h of readings`} />}
        {cigs !== null && <Tile value={`${cigs}`} label="cigarettes a day" sub="equivalent of today's PM2.5" />}
      </div>
    </section>
  );
}
