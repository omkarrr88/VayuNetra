import { useEffect, useState } from "react";
import { api } from "./api";

type Trace = {
  city_id: string;
  total_latency_ms: number;
  signal_ts: string;
  advisory_ts: string;
};

function fmt(ms?: number) {
  if (!ms || ms <= 0) return "--";
  if (ms < 10_000) return `${(ms / 1000).toFixed(1)}s`; // never show a fake-looking "0s"
  const total = Math.round(ms / 1000);
  if (total < 60) return `${total}s`;
  const m = Math.floor(total / 60);
  const s = total % 60;
  return `${m}m ${String(s).padStart(2, "0")}s`;
}

/** Human "3h ago" for the last pipeline run, so the latency isn't misread as freshness. */
function agoLabel(iso?: string): string | null {
  if (!iso) return null;
  const then = new Date(iso).getTime();
  if (!Number.isFinite(then)) return null;
  const mins = Math.max(0, Math.round((Date.now() - then) / 60_000));
  if (mins < 1) return "just now";
  if (mins < 60) return `${mins}m ago`;
  const h = Math.floor(mins / 60);
  if (h < 24) return `${h}h ago`;
  return `${Math.floor(h / 24)}d ago`;
}

/** North-Star banner: end-to-end signal → action latency (target < 5 min). */
export default function LatencyWidget({ city }: { city: string }) {
  const [trace, setTrace] = useState<Trace | null>(null);

  useEffect(() => {
    api<Trace>(`/latency?city=${city}`).then(setTrace).catch(() => setTrace(null));
  }, [city]);

  const ms = trace?.total_latency_ms;
  const under5 = typeof ms === "number" && ms > 0 && ms < 5 * 60_000;
  const ran = agoLabel(trace?.advisory_ts || trace?.signal_ts);

  return (
    <div
      className="rounded-lg bg-emerald-700 px-4 py-2 text-white shadow"
      title="Wall-clock of the last full multi-agent run: spike detected → attribution → forecast → enforcement + advisory issued. Runs on the pipeline schedule, not per page-load."
    >
      <div className="text-[11px] font-semibold uppercase tracking-wider text-white">⚡ Last pipeline run</div>
      <div className="flex items-baseline gap-2">
        <span className="text-2xl font-extrabold leading-tight">{fmt(ms)}</span>
        {under5 && <span className="rounded bg-emerald-950/40 px-1.5 py-0.5 text-[11px] font-semibold text-white">signal→action &lt; 5 min ✓</span>}
      </div>
      <div className="text-[11px] text-emerald-50">detect → decide → issue{ran ? ` · ran ${ran}` : ""}</div>
    </div>
  );
}
