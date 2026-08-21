// Agent Trace Viewer — makes the multi-agent architecture visible: the per-city LangGraph drawn
// as a graph (five agents and a gate), the last run's timings on it, a button that runs the whole
// pipeline live on stage, and the same run as a table of numbers underneath.
import { useCallback, useEffect, useState } from "react";
import { api } from "./api";
import { Panel, Step } from "./ui";
import { NODES, PIPELINE_ORDER, TraceGraph, TraceTable, summarise, type TraceStep } from "./TraceGraph";

type TraceRow = {
  city_id: string;
  total_latency_ms?: number;
  /** live runs return a list of steps; stored rows carry {nodes:[…]} plus one timestamp column per node */
  trace?: TraceStep[] | { nodes?: string[] } | null;
  signal_ts?: string | null;
  attribution_ts?: string | null;
  forecast_ts?: string | null;
  enforcement_ts?: string | null;
  advisory_ts?: string | null;
};
type AgentRun = { latency_ms?: number; trace?: TraceStep[] };

const TICK_MS = 380; // one hop of the "working" ring while the real graph runs
const REPLAY_MS = 220; // one hop of the quick replay once the run has returned

/** A stored trace row → steps. The table keeps one timestamp column per node (signal_ts is the
 *  orchestrator's start; enforcement_ts is null when the gate skipped it) and `trace.nodes` lists
 *  what ran; a live run answers with a ready list of steps instead. Both become the same shape. */
function stepsFromRow(row: TraceRow | undefined): TraceStep[] {
  if (!row) return [];
  if (Array.isArray(row.trace)) return normaliseSteps(row.trace);
  const ran = new Set(row.trace?.nodes ?? []);
  const cols: Array<[string, string | null | undefined]> = [
    ["orchestrator", row.signal_ts],
    ["attribution", row.attribution_ts],
    ["forecast", row.forecast_ts],
    ["enforcement", row.enforcement_ts],
    ["advisory", row.advisory_ts],
  ];
  return cols
    .filter(([node, ts]) => !!ts && (ran.size === 0 || ran.has(node)))
    .map(([node, ts]) => ({ node, ts: ts as string }));
}

/** Live runs send steps as objects; an older writer stored each step as a JSON string — accept both. */
function normaliseSteps(raw: unknown): TraceStep[] {
  if (!Array.isArray(raw)) return [];
  const out: TraceStep[] = [];
  for (const item of raw) {
    let s: unknown = item;
    if (typeof s === "string") {
      try { s = JSON.parse(s); } catch { continue; }
    }
    if (s && typeof s === "object" && typeof (s as TraceStep).node === "string" && typeof (s as TraceStep).ts === "string") {
      out.push(s as TraceStep);
    }
  }
  return out;
}

function NodeIcon({ d, color }: { d: string; color: string }) {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth="1.9" strokeLinecap="round" strokeLinejoin="round" className="h-3.5 w-3.5" aria-hidden="true">
      <path d={d} />
    </svg>
  );
}

/** Narrow screens: the same graph as a vertical timeline — every node, including the gate's decision and the skipped branch. */
function Timeline({ steps }: { steps: TraceStep[] }) {
  const S = summarise(steps);
  if (!S.hasRun) {
    return (
      <div className="mt-2 rounded-md border border-dashed border-slate-200 p-3 text-center text-xs text-slate-500">
        No run loaded yet — press "Run agents live" to watch the five agents and the gate think.
      </div>
    );
  }
  const rows = [...PIPELINE_ORDER, ...steps.map((s) => s.node).filter((n) => !PIPELINE_ORDER.includes(n))];
  return (
    <div className="relative mt-2">
      <div className="absolute bottom-3 left-[11px] top-3 w-px bg-slate-200" aria-hidden="true" />
      <div className="space-y-1">
        {rows.map((name) => {
          const node = NODES[name] ?? { label: name.replace("_", " "), role: "", color: "#64748b", icon: "M12 5v14m-7-7h14" };
          const st = S.nodeState(name);
          const t = S.at.get(name);
          const text =
            name === "spike_gate"
              ? S.escalated ? "spike → escalated to enforcement" : "no spike → straight to advisory"
              : st === "skipped" ? "skipped — air is clean, nothing to enforce"
              : t ? `+${t.start.toFixed(1)}s${t.took > 0.05 ? ` · ${t.took.toFixed(1)}s` : ""}` : "not in this run";
          const dim = st !== "ran";
          return (
            <div key={name} className={`relative flex items-center gap-2.5 text-xs ${dim ? "opacity-70" : ""}`}>
              <span
                className={`z-10 flex h-[23px] w-[23px] shrink-0 items-center justify-center rounded-full bg-white ${dim ? "border border-dashed border-slate-300" : ""}`}
                style={dim ? undefined : { background: `${node.color}14`, boxShadow: `inset 0 0 0 1px ${node.color}33` }}
              >
                <NodeIcon d={node.icon} color={dim ? "#94a3b8" : node.color} />
              </span>
              <span className="w-24 shrink-0 font-medium text-slate-700">{node.label}</span>
              <span className={`font-mono text-[11px] ${name === "spike_gate" ? (S.escalated ? "text-amber-600" : "text-emerald-600") : st === "skipped" ? "italic text-slate-500" : "text-slate-500"}`}>{text}</span>
            </div>
          );
        })}
      </div>
    </div>
  );
}

function useWide(px = 900) {
  const [wide, setWide] = useState(() => (typeof window === "undefined" ? true : window.matchMedia(`(min-width: ${px}px)`).matches));
  useEffect(() => {
    const mq = window.matchMedia(`(min-width: ${px}px)`);
    const on = () => setWide(mq.matches);
    mq.addEventListener("change", on);
    return () => mq.removeEventListener("change", on);
  }, [px]);
  return wide;
}

export default function TraceViewer({ city }: { city: string }) {
  const [steps, setSteps] = useState<TraceStep[]>([]);
  const [latency, setLatency] = useState<number | null>(null);
  const [running, setRunning] = useState(false);
  const [replay, setReplay] = useState(0);
  const [active, setActive] = useState<string | null>(null);
  const [err, setErr] = useState<string | null>(null);
  const wide = useWide();

  // The newest row can be a bare latency record; the graph wants a row WITH a trace, so ask for a
  // few and take the first one that carries steps (falling back to the newest).
  const load = useCallback(() => {
    api<TraceRow[] | TraceRow>(`/traces?city=${city}&limit=5`)
      .then((d) => {
        const rows = (Array.isArray(d) ? d : d ? [d] : []).map((r) => ({ ...r, trace: stepsFromRow(r) }));
        const row = rows.find((r) => r.trace.length) ?? rows[0];
        setSteps(row?.trace ?? []);
        setLatency(row?.total_latency_ms ?? null);
      })
      .catch(() => setSteps([]));
  }, [city]);

  useEffect(load, [load]);

  // While the real graph runs, the ring walks the nodes; when it returns, a quick replay in order.
  useEffect(() => {
    if (!running) return;
    let i = 0;
    setActive(PIPELINE_ORDER[0]);
    const t = setInterval(() => {
      i = (i + 1) % PIPELINE_ORDER.length;
      setActive(PIPELINE_ORDER[i]);
    }, TICK_MS);
    return () => clearInterval(t);
  }, [running]);

  useEffect(() => {
    if (!replay) return;
    const ran = PIPELINE_ORDER.filter((n) => steps.some((s) => s.node === n) || n === "spike_gate");
    const timers = ran.map((n, i) => setTimeout(() => setActive(n), i * REPLAY_MS));
    timers.push(setTimeout(() => setActive(null), ran.length * REPLAY_MS + 300));
    return () => timers.forEach(clearTimeout);
  }, [replay, steps]);

  async function runLive() {
    setRunning(true);
    setErr(null);
    try {
      const r = await api<AgentRun>("/agent/query", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ city, query: "live judging demo run" }),
      });
      const got = normaliseSteps(r.trace);
      if (got.length) setSteps(got);
      if (typeof r.latency_ms === "number") setLatency(r.latency_ms);
      else load();
      setReplay((n) => n + 1);
    } catch (e) {
      setErr((e as Error).message);
      setActive(null);
    } finally {
      setRunning(false);
    }
  }

  const S = summarise(steps);

  return (
    <Step n={1} label="Run the agents" info={<p>The LangGraph orchestrator: five agents and a gate — ingest → attribution → forecast → spike gate → enforcement (only when a spike is coming) → advisory. Each node's inputs, outputs and wall-clock are traced; the button really runs the graph against the live database.</p>}>
      <Panel
        title="Agent Pipeline"
        right={
          latency != null && latency > 0 ? (
            <span className="rounded bg-emerald-100 px-1.5 py-0.5 text-[11px] font-semibold text-emerald-700">
              {(latency / 1000).toFixed(1)}s end-to-end
            </span>
          ) : undefined
        }
      >
        <div className="text-[11px] text-slate-500">
          {S.hasRun
            ? `last multi-agent run · detect → decide → issue · ${S.escalated ? "a spike was coming, so enforcement ran" : "no spike, so enforcement was skipped"}`
            : "five agents and a gate, in execution order · no run loaded yet"}
        </div>

        {wide ? <TraceGraph steps={steps} active={active} /> : <Timeline steps={steps} />}

        <div className="tg-foot">
          {!S.hasRun && <span><b>Nothing has run for this city yet</b> — press Run agents live and watch it think.</span>}
          <span>Cross-city comparison runs outside this per-city graph — see <b>Cities</b>.</span>
        </div>

        <button
          onClick={runLive}
          disabled={running}
          className="mt-2.5 flex w-full items-center justify-center gap-1.5 rounded-md bg-slate-800 px-2 py-1.5 text-xs font-semibold text-white transition-colors hover:bg-slate-900 disabled:opacity-60"
        >
          {running ? (
            <>
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" className="h-3.5 w-3.5 animate-spin" aria-hidden="true">
                <path d="M21 12a9 9 0 1 1-6.2-8.56" />
              </svg>
              Agents running…
            </>
          ) : (
            <>
              <svg viewBox="0 0 24 24" fill="currentColor" className="h-3 w-3" aria-hidden="true">
                <path d="M8 5v14l11-7L8 5Z" />
              </svg>
              Run agents live
            </>
          )}
        </button>
        {err && <div className="mt-1 text-[11px] text-red-600">{err}</div>}

        {wide && <TraceTable steps={steps} />}
      </Panel>
    </Step>
  );
}
