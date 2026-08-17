// Grid-dispatch lite (the Beijing 网格化 pattern, honest MVP): every approved or
// dispatched recommendation auto-routes to its ward's field queue. Wards are
// resolved offline from the shipped boundary polygons — no backend changes.
import { useEffect, useState } from "react";
import { api } from "./api";
import { EmptyState, Panel } from "./ui";
import { placeForCell } from "./placeName";

type Rec = { id: number; h3_cell?: string; status?: string; priority_score?: number };

type Queue = { ward: string; count: number; top: number };

export default function DispatchQueues({ city }: { city: string }) {
  const [queues, setQueues] = useState<Queue[] | null>(null);

  useEffect(() => {
    let alive = true;
    setQueues(null);
    (async () => {
      try {
        const active: Rec[] = [];
        for (const status of ["approved", "dispatched"]) {
          const rows = await api<Rec[]>(`/enforcement?city=${city}&status=${status}&limit=50`).catch(() => []);
          active.push(...rows);
        }
        if (!alive) return;
        const byWard = new Map<string, Queue>();
        for (const r of active) {
          if (!r.h3_cell) continue;
          const place = await placeForCell(city, r.h3_cell).catch(() => null);
          const ward = place?.label ?? `cell ${r.h3_cell.slice(-6)}`;
          const q = byWard.get(ward) ?? { ward, count: 0, top: 0 };
          q.count += 1;
          q.top = Math.max(q.top, r.priority_score ?? 0);
          byWard.set(ward, q);
        }
        if (alive) setQueues([...byWard.values()].sort((a, b) => b.count - a.count).slice(0, 6));
      } catch {
        if (alive) setQueues([]);
      }
    })();
    return () => {
      alive = false;
    };
  }, [city]);

  if (queues === null) {
    return (
      <Panel title="Ward dispatch queues">
        <div className="h-10 animate-pulse rounded-md bg-slate-100" />
      </Panel>
    );
  }
  if (queues.length === 0) {
    return (
      <Panel title="Ward dispatch queues" tag="empty">
        <EmptyState message="Nothing dispatched yet. Approve or dispatch a worklist item above and it lands in its ward's field queue here." />
      </Panel>
    );
  }

  return (
    <Panel title="Ward dispatch queues" tag={`${queues.reduce((a, q) => a + q.count, 0)} queued`}>
      <div className="space-y-1">
        {queues.map((q) => (
          <div key={q.ward} className="flex items-center justify-between rounded-md bg-slate-50 px-2 py-1 text-xs">
            <span className="truncate font-medium text-slate-700">{q.ward}</span>
            <span className="ml-2 shrink-0 rounded bg-violet-100 px-1.5 py-0.5 text-[11px] font-semibold text-violet-800">
              {q.count} in queue
            </span>
          </div>
        ))}
      </div>
      <div className="mt-1.5 text-[11px] leading-4 text-slate-500">
        Approved and dispatched actions auto-route to their ward's field queue — the grid-supervision
        pattern, per ~1 km² cell. A zonal officer sees only their patch.
      </div>
    </Panel>
  );
}
