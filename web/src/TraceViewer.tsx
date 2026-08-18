// Agent Trace Viewer — makes the multi-agent architecture visible: the latest
// orchestrator→attribution→forecast→enforcement→advisory run as a timeline,
// plus a button that runs the whole pipeline live on stage.
import { useCallback, useEffect, useState } from "react";
import { api } from "./api";
import { Panel, Step } from "./ui";

type TraceStep = { node: string; ts: string; meta?: Record<string, unknown> };
type TraceRow = { city_id: string; total_latency_ms?: number; trace?: TraceStep[]; signal_ts?: string };
type AgentRun = { latency_ms?: number; trace?: TraceStep[] };

// One entry per LangGraph node: label, accent color, 24px stroke icon path.
const NODES: Record<string, { label: string; color: string; icon: string }> = {
  orchestrator: {
    label: "Orchestrator",
    color: "#475569",
    icon: "M12 3a9 9 0 1 0 0 18 9 9 0 0 0 0-18Zm3.5 5.5-2 4.5-4.5 2.5 2-4.5 4.5-2.5Z",
  },
  attribution: {
    label: "Attribution",
    color: "#2563eb",
    icon: "M11 4a7 7 0 1 0 0 14 7 7 0 0 0 0-14Zm10 17-4.35-4.35",
  },
  forecast: {
    label: "Forecast",
    color: "#0891b2",
    icon: "M3 17l5-6 4 3 5-7 4 5M3 21h18",
  },
  spike_gate: {
    label: "Spike gate",
    color: "#d97706",
    icon: "M4 5h16l-6 7v6l-4-2v-4L4 5Z",
  },
  enforcement: {
    label: "Enforcement",
    color: "#7c3aed",
    icon: "M12 3l7 3v5c0 4.5-3 8.5-7 10-4-1.5-7-5.5-7-10V6l7-3Zm-3 9 2 2 4-4",
  },
  advisory: {
    label: "Advisory",
    color: "#059669",
    icon: "M11 5 6 9H3v6h3l5 4V5Zm5.5 2.5a5 5 0 0 1 0 9",
  },
};
const FALLBACK_NODE = { label: "", color: "#64748b", icon: "M12 5v14m-7-7h14" };

// The full graph, in execution order. The trace only records nodes that RAN —
// the spike gate routes past enforcement when the air is clean, and that
// decision is worth SHOWING, not silently dropping rows.
const PIPELINE_ORDER = ["orchestrator", "attribution", "forecast", "spike_gate", "enforcement", "advisory"];

const MULTICITY = {
  label: "Multi-City",
  color: "#0369a1",
  icon: "M3 21h18M6 21V10m6 11V4m6 17v-8",
};

function NodeIcon({ d, color }: { d: string; color: string }) {
  return (
    <svg
      viewBox="0 0 24 24"
      fill="none"
      stroke={color}
      strokeWidth="1.9"
      strokeLinecap="round"
      strokeLinejoin="round"
      className="h-3.5 w-3.5"
      aria-hidden="true"
    >
      <path d={d} />
    </svg>
  );
}

function Timeline({ steps }: { steps: TraceStep[] }) {
  if (!steps.length) {
    return (
      <div className="mt-2 rounded-md border border-dashed border-slate-200 p-3 text-center text-xs text-slate-500">
        No trace yet — press "Run agents live" to watch the pipeline think.
      </div>
    );
  }
  const t0 = new Date(steps[0].ts).getTime();
  const ran = new Map(steps.map((s, i) => [s.node, i]));
  const stepMs = steps.map((s, i) => (i === 0 ? 0 : new Date(s.ts).getTime() - new Date(steps[i - 1].ts).getTime()));
  const maxStep = Math.max(1, ...stepMs);
  const escalated = ran.has("enforcement");

  // Render the WHOLE graph: executed nodes with times, plus the gate's
  // decision and any skipped branch — extra trace nodes append at the end.
  const rows = [
    ...PIPELINE_ORDER,
    ...steps.map((s) => s.node).filter((n) => !PIPELINE_ORDER.includes(n)),
  ];

  return (
    <div className="relative mt-2">
      {/* connector line behind the icon badges */}
      <div className="absolute bottom-3 left-[11px] top-3 w-px bg-slate-200" aria-hidden="true" />
      <div className="space-y-1">
        {rows.map((name) => {
          const node = NODES[name] ?? { ...FALLBACK_NODE, label: name.replace("_", " ") };
          const i = ran.get(name);

          if (name === "spike_gate" && i === undefined) {
            // The gate is a decision, not a timed node — show what it chose.
            return (
              <div key={name} className="relative flex items-center gap-2.5 text-xs">
                <span
                  className="z-10 flex h-[23px] w-[23px] shrink-0 items-center justify-center rounded-full bg-white"
                  style={{ boxShadow: `inset 0 0 0 1px ${node.color}55` }}
                >
                  <NodeIcon d={node.icon} color={node.color} />
                </span>
                <span className="w-24 shrink-0 font-medium text-slate-600">{node.label}</span>
                <span className={`text-[10.5px] ${escalated ? "text-amber-600" : "text-emerald-600"}`}>
                  {escalated ? "spike → escalated to enforcement" : "no spike → straight to advisory"}
                </span>
              </div>
            );
          }

          if (i === undefined) {
            // in the graph but not in this run (e.g. enforcement on clean air)
            return (
              <div key={name} className="relative flex items-center gap-2.5 text-xs opacity-70">
                <span className="z-10 flex h-[23px] w-[23px] shrink-0 items-center justify-center rounded-full border border-dashed border-slate-300 bg-white">
                  <NodeIcon d={node.icon} color="#94a3b8" />
                </span>
                <span className="w-24 shrink-0 font-medium text-slate-500">{node.label}</span>
                <span className="text-[10.5px] italic text-slate-500">
                  {name === "enforcement" ? "skipped — air is clean, nothing to enforce" : "not in this run"}
                </span>
              </div>
            );
          }

          const dt = (new Date(steps[i].ts).getTime() - t0) / 1000;
          return (
            <div key={name} className="relative flex items-center gap-2.5 text-xs">
              <span
                className="z-10 flex h-[23px] w-[23px] shrink-0 items-center justify-center rounded-full ring-1 ring-inset"
                style={{ background: `${node.color}14`, boxShadow: `inset 0 0 0 1px ${node.color}33` }}
              >
                <NodeIcon d={node.icon} color={node.color} />
              </span>
              <span className="w-24 shrink-0 font-medium text-slate-700">{node.label}</span>
              <span className="font-mono text-[11px] text-slate-500">+{dt.toFixed(1)}s</span>
              {i > 0 && (
                <span className="flex min-w-0 flex-1 items-center gap-1.5">
                  <span
                    className="h-1 rounded-full"
                    style={{
                      width: `${Math.max(6, (stepMs[i] / maxStep) * 56)}px`,
                      background: node.color,
                      opacity: 0.45,
                    }}
                    aria-hidden="true"
                  />
                  <span className="font-mono text-[10px] text-slate-500">{(stepMs[i] / 1000).toFixed(1)}s</span>
                </span>
              )}
            </div>
          );
        })}

        {/* the 6th agent runs cross-city, outside the per-city pipeline */}
        <div className="relative flex items-center gap-2.5 text-xs opacity-70">
          <span className="z-10 flex h-[23px] w-[23px] shrink-0 items-center justify-center rounded-full border border-dashed border-slate-300 bg-white">
            <NodeIcon d={MULTICITY.icon} color="#94a3b8" />
          </span>
          <span className="w-24 shrink-0 font-medium text-slate-500">{MULTICITY.label}</span>
          <span className="text-[10.5px] italic text-slate-500">cross-city playbooks — see the Cities section</span>
        </div>
      </div>
    </div>
  );
}

export default function TraceViewer({ city }: { city: string }) {
  const [steps, setSteps] = useState<TraceStep[]>([]);
  const [latency, setLatency] = useState<number | null>(null);
  const [running, setRunning] = useState(false);
  const [err, setErr] = useState<string | null>(null);

  const load = useCallback(() => {
    api<TraceRow[] | TraceRow>(`/traces?city=${city}&limit=1`)
      .then((d) => {
        const row = Array.isArray(d) ? d[0] : d;
        setSteps(row?.trace ?? []);
        setLatency(row?.total_latency_ms ?? null);
      })
      .catch(() => setSteps([]));
  }, [city]);

  useEffect(load, [load]);

  async function runLive() {
    setRunning(true);
    setErr(null);
    try {
      const r = await api<AgentRun>("/agent/query", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ city, query: "live judging demo run" }),
      });
      if (r.trace?.length) setSteps(r.trace);
      if (typeof r.latency_ms === "number") setLatency(r.latency_ms);
      else load();
    } catch (e) {
      setErr((e as Error).message);
    } finally {
      setRunning(false);
    }
  }

  return (
    <Step n={1} label="Run the agents" info={<p>The LangGraph orchestrator: ingest → attribution → forecast → spike gate → enforcement → advisory. Each node's inputs, outputs and wall-clock are traced; the button really runs the graph against the live database.</p>}>
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
      <div className="text-[11px] text-slate-500">last multi-agent run · detect → decide → issue</div>
      <Timeline steps={steps} />
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
    </Panel>
    </Step>
  );
}
