// The per-city LangGraph, drawn: five agents and a gate, left to right, with the gate's two
// exits. HTML cards carry the text (crisp at any width, both themes); one SVG overlay carries
// the edges, measured from the cards after layout so the picture never drifts from the DOM.
import { useLayoutEffect, useRef, useState, type CSSProperties } from "react";
import "./design/tracegraph.css";

export type TraceStep = { node: string; ts: string; meta?: Record<string, unknown> };

export type NodeDef = { label: string; role: string; color: string; icon: string };

// One entry per LangGraph node: label, one-line role, accent colour, 24px stroke icon path.
export const NODES: Record<string, NodeDef> = {
  orchestrator: { label: "Orchestrator", role: "routes the run, traces every node", color: "#475569", icon: "M12 3a9 9 0 1 0 0 18 9 9 0 0 0 0-18Zm3.5 5.5-2 4.5-4.5 2.5 2-4.5 4.5-2.5Z" },
  attribution: { label: "Attribution", role: "who is to blame, per ~1 km cell", color: "#2563eb", icon: "M11 4a7 7 0 1 0 0 14 7 7 0 0 0 0-14Zm10 17-4.35-4.35" },
  forecast: { label: "Forecast", role: "PM2.5 at +24/48/72 h, 80 % band", color: "#0891b2", icon: "M3 17l5-6 4 3 5-7 4 5M3 21h18" },
  spike_gate: { label: "Spike gate", role: "is a spike coming? picks the route", color: "#d97706", icon: "M4 5h16l-6 7v6l-4-2v-4L4 5Z" },
  enforcement: { label: "Enforcement", role: "ranked, RAG-cited worklist", color: "#7c3aed", icon: "M12 3l7 3v5c0 4.5-3 8.5-7 10-4-1.5-7-5.5-7-10V6l7-3Zm-3 9 2 2 4-4" },
  advisory: { label: "Advisory", role: "templated alerts, eight languages", color: "#059669", icon: "M11 5 6 9H3v6h3l5 4V5Zm5.5 2.5a5 5 0 0 1 0 9" },
};

// Execution order. The trace only records nodes that RAN — the gate is a decision, not a timed
// node, and it routes past enforcement when the air is clean; both facts are drawn, not dropped.
export const PIPELINE_ORDER = ["orchestrator", "attribution", "forecast", "spike_gate", "enforcement", "advisory"];

/** Grid placement: column 1–6; row 2 is the main rail, row 1 the escalation branch. */
const PLACE: Record<string, { col: number; row: 1 | 2 }> = {
  orchestrator: { col: 1, row: 2 },
  attribution: { col: 2, row: 2 },
  forecast: { col: 3, row: 2 },
  spike_gate: { col: 4, row: 2 },
  enforcement: { col: 5, row: 1 },
  advisory: { col: 6, row: 2 },
};

const EDGES: Array<{ from: string; to: string }> = [
  { from: "orchestrator", to: "attribution" },
  { from: "attribution", to: "forecast" },
  { from: "forecast", to: "spike_gate" },
  { from: "spike_gate", to: "enforcement" },
  { from: "enforcement", to: "advisory" },
  { from: "spike_gate", to: "advisory" },
];

export type NodeState = "pending" | "ran" | "skipped";
export type EdgeState = "neutral" | "taken" | "skipped";

/** What the last run says about each node and edge — pure, so the table and graph agree. */
export function summarise(steps: TraceStep[]) {
  const t0 = steps.length ? Date.parse(steps[0].ts) : NaN;
  const at = new Map<string, { start: number; took: number }>();
  steps.forEach((s, i) => {
    const t = Date.parse(s.ts);
    const prev = i ? Date.parse(steps[i - 1].ts) : t;
    at.set(s.node, { start: (t - t0) / 1000, took: (t - prev) / 1000 });
  });
  const hasRun = steps.length > 0;
  const escalated = at.has("enforcement");
  const nodeState = (n: string): NodeState => {
    if (!hasRun) return "pending";
    if (at.has(n) || n === "spike_gate") return "ran";
    return n === "enforcement" ? "skipped" : "pending";
  };
  const edgeState = (from: string, to: string): EdgeState => {
    if (!hasRun) return "neutral";
    if (from === "spike_gate" && to === "enforcement") return escalated ? "taken" : "skipped";
    if (from === "enforcement") return escalated ? "taken" : "skipped";
    if (from === "spike_gate" && to === "advisory") return escalated ? "skipped" : "taken";
    return "taken";
  };
  return { hasRun, escalated, at, nodeState, edgeState };
}

function NodeIcon({ d }: { d: string }) {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.9" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <path d={d} />
    </svg>
  );
}

type Path = { key: string; from: string; to: string; d: string; lx: number; ly: number };

/**
 * @param steps   the last run's trace (empty = nothing loaded yet)
 * @param active  node currently being worked during a live run — drives the ring and edge draw
 */
export function TraceGraph({ steps, active }: { steps: TraceStep[]; active: string | null }) {
  const wrap = useRef<HTMLDivElement>(null);
  const nodeEls = useRef<Record<string, HTMLDivElement | null>>({});
  const [paths, setPaths] = useState<Path[]>([]);
  const [size, setSize] = useState({ w: 0, h: 0 });

  useLayoutEffect(() => {
    const el = wrap.current;
    if (!el) return;
    const measure = () => {
      const box = el.getBoundingClientRect();
      const rect = (k: string) => {
        const r = nodeEls.current[k]?.getBoundingClientRect();
        return r ? { x: r.left - box.left, y: r.top - box.top, w: r.width, h: r.height } : null;
      };
      const next = EDGES.flatMap((e) => {
        const a = rect(e.from);
        const b = rect(e.to);
        if (!a || !b) return [];
        const x1 = a.x + a.w, y1 = a.y + a.h / 2, x2 = b.x, y2 = b.y + b.h / 2;
        const dx = Math.max(22, (x2 - x1) / 2);
        return [{ key: `${e.from}-${e.to}`, from: e.from, to: e.to, d: `M${x1},${y1} C${x1 + dx},${y1} ${x2 - dx},${y2} ${x2},${y2}`, lx: (x1 + x2) / 2, ly: (y1 + y2) / 2 }];
      });
      setPaths(next);
      setSize({ w: box.width, h: box.height });
    };
    measure();
    const ro = new ResizeObserver(measure);
    ro.observe(el);
    return () => ro.disconnect();
  }, [steps]);

  const S = summarise(steps);

  const timing = (k: string): string => {
    const st = S.nodeState(k);
    if (k === "spike_gate") return S.hasRun ? (S.escalated ? "spike → escalate" : "clean → skip enforcement") : "—";
    if (st === "skipped") return "skipped · air is clean";
    const t = S.at.get(k);
    if (!t) return "—";
    return `+${t.start.toFixed(1)} s${t.took > 0.05 ? ` · took ${t.took.toFixed(1)} s` : ""}`;
  };

  const edgeColor = (p: Path): string => {
    const st = S.edgeState(p.from, p.to);
    if (active === p.to || st === "taken") return NODES[p.to].color;
    return st === "skipped" ? "var(--faint)" : "var(--line)";
  };

  return (
    <div ref={wrap} className="tg" data-run={S.hasRun ? "yes" : "no"}>
      <svg className="tg-edges" width={size.w || "100%"} height={size.h || 0} aria-hidden="true">
        <defs>
          {paths.map((p) => (
            <marker key={p.key} id={`tga-${p.key}`} markerWidth="8" markerHeight="8" refX="7.5" refY="4" orient="auto" markerUnits="userSpaceOnUse">
              <path d="M0,0 L8,4 L0,8 Z" fill={edgeColor(p)} />
            </marker>
          ))}
        </defs>
        {paths.map((p) => {
          const st = S.edgeState(p.from, p.to);
          const drawing = active === p.to;
          return (
            <path
              key={`${p.key}-${drawing ? "on" : "off"}`}
              d={p.d}
              pathLength={1}
              className={`tg-edge tg-edge-${st}${drawing ? " tg-edge-active" : ""}`}
              style={{ color: edgeColor(p) }}
              markerEnd={`url(#tga-${p.key})`}
            />
          );
        })}
        {S.hasRun &&
          paths
            .filter((p) => p.from === "spike_gate")
            .map((p) => {
              const upper = p.to === "enforcement";
              const on = upper ? S.escalated : !S.escalated;
              const text = upper ? (S.escalated ? "spike → escalated" : "no spike") : S.escalated ? "" : "clean → straight to advisory";
              if (!text) return null;
              return (
                <text key={`${p.key}-lbl`} x={p.lx} y={p.ly + (upper ? -9 : 14)} textAnchor="middle" className={`tg-edge-label${on ? " on" : ""}`} style={{ color: on ? NODES[p.to].color : undefined }}>
                  {text}
                </text>
              );
            })}
      </svg>

      <div className="tg-grid" role="list" aria-label="Agent pipeline, in execution order">
        {PIPELINE_ORDER.map((k) => {
          const def = NODES[k];
          const place = PLACE[k];
          const st = S.nodeState(k);
          const cls = ["tg-node", `tg-${st}`, k === "spike_gate" ? "tg-gate" : "", active === k ? "tg-active" : ""].filter(Boolean).join(" ");
          return (
            <div
              key={k}
              ref={(el) => { nodeEls.current[k] = el; }}
              role="listitem"
              className={cls}
              style={{ gridColumn: place.col, gridRow: place.row, "--c": def.color } as CSSProperties}
              aria-label={`${def.label}: ${def.role}. ${timing(k)}`}
            >
              <div className="tg-head">
                <span className="tg-ic"><NodeIcon d={def.icon} /></span>
                <b className="tg-label">{def.label}</b>
              </div>
              <div className="tg-role">{def.role}</div>
              <div className="tg-time">{timing(k)}</div>
            </div>
          );
        })}
      </div>
    </div>
  );
}

/** The same run as numbers: node · started · took · the first thing it recorded. */
export function TraceTable({ steps }: { steps: TraceStep[] }) {
  if (!steps.length) return null;
  const S = summarise(steps);
  // stored rows carry no per-node payload — then the column would be a row of dashes, so it goes
  const anyMeta = steps.some((s) => s.meta && Object.keys(s.meta).length > 0);
  const metaOf = (s: TraceStep): string => {
    const entries = Object.entries(s.meta ?? {}).slice(0, 2);
    if (!entries.length) return "—";
    return entries
      .map(([k, v]) => {
        const str = typeof v === "string" ? v : JSON.stringify(v);
        return `${k}: ${str.length > 36 ? `${str.slice(0, 35)}…` : str}`;
      })
      .join(" · ");
  };
  return (
    <div className="tg-table" role="region" aria-label="Trace of the last run">
      <table>
        <thead>
          <tr>
            <th>node</th>
            <th className="num">started</th>
            <th className="num">took</th>
            {anyMeta && <th>recorded</th>}
          </tr>
        </thead>
        <tbody>
          {steps.slice(0, 8).map((s, i) => {
            const t = S.at.get(s.node);
            return (
              <tr key={`${s.node}-${i}`}>
                <td><b style={{ color: s.node === "orchestrator" ? "var(--ink-2)" : NODES[s.node]?.color ?? "var(--ink-2)", fontWeight: 700 }}>{NODES[s.node]?.label ?? s.node.replace("_", " ")}</b></td>
                <td className="num">+{(t?.start ?? 0).toFixed(2)} s</td>
                <td className="num">{t && t.took > 0 ? `${t.took.toFixed(2)} s` : "—"}</td>
                {anyMeta && <td className="meta" title={metaOf(s)}>{metaOf(s)}</td>}
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}
