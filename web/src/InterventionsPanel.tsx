// Before/after effect tracking for dispatched recs — the PS's "intervention
// effectiveness", built as machinery that arms itself at the first real
// dispatch. Until then it says so, honestly, in one line.
import { useEffect, useState } from "react";
import { api, API_BASE, API_TOKEN } from "./api";
import { Panel } from "./ui";

type Tracked = {
  rec_id: number;
  h3_cell: string;
  dispatched_at: string;
  days_since_dispatch: number;
  status: "measuring" | "provisional" | "measured";
  effect_pm25?: number;
  cell_delta?: number;
  city_drift?: number;
  note?: string;
};

type Data = { tracked: Tracked[]; note?: string };

export default function InterventionsPanel({ city }: { city: string }) {
  const [d, setD] = useState<Data | null>(null);

  useEffect(() => {
    let alive = true;
    setD(null);
    api<Data>(`/interventions?city=${city}`)
      .then((r) => alive && setD(r))
      .catch(() => alive && setD({ tracked: [] }));
    return () => {
      alive = false;
    };
  }, [city]);

  if (!d) return null;

  const exportCsv = async () => {
    // fetch with auth, then hand the CSV to the browser as a download
    const res = await fetch(`${API_BASE}/interventions/export?city=${city}`, {
      headers: API_TOKEN ? { Authorization: `Bearer ${API_TOKEN}` } : undefined,
    });
    const blob = await res.blob();
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `ncap_evidence_${city}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  };

  return (
    <Panel title="Intervention tracking">
      {d.tracked.length === 0 ? (
        <div className="text-xs leading-5 text-gray-500">
          {d.note ??
            "No real-world intervention dispatched yet — tracking arms automatically at first dispatch."}{" "}
          <span className="text-gray-400">
            Marking a recommendation "dispatched" freezes the cell's 7-day PM2.5 baseline and opens a
            before/after measurement window, corrected for city-wide drift.
          </span>
        </div>
      ) : (
        <div className="space-y-2">
          {d.tracked.map((t) => (
            <div key={t.rec_id} className="rounded-md border border-gray-200 p-2 text-xs">
              <div className="flex items-center justify-between">
                <span className="font-medium">rec #{t.rec_id} · cell {t.h3_cell.slice(-6)}</span>
                <span
                  className={`rounded px-1.5 py-0.5 text-[11px] font-semibold ${
                    t.status === "measured"
                      ? "bg-emerald-100 text-emerald-800"
                      : "bg-amber-100 text-amber-800"
                  }`}
                >
                  {t.status}
                </span>
              </div>
              <div className="mt-1 text-gray-600">
                {typeof t.effect_pm25 === "number" ? (
                  <>
                    effect <b>{t.effect_pm25 > 0 ? "+" : ""}{t.effect_pm25} µg/m³</b> vs city drift ·{" "}
                    {t.days_since_dispatch} days since dispatch
                  </>
                ) : (
                  <>measuring — {t.days_since_dispatch} days since dispatch</>
                )}
                {t.note && <span className="text-gray-400"> · {t.note}</span>}
              </div>
            </div>
          ))}
        </div>
      )}
      <div className="mt-2 border-t border-gray-100 pt-2 text-[11px] leading-4 text-gray-500">
        <button
          onClick={exportCsv}
          className="font-semibold text-teal-700 hover:text-teal-900 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-emerald-400/80"
        >
          Export as NCAP action-plan evidence (PRANA-ready CSV) ↓
        </button>{" "}
        — each dispatched intervention with its measured effect, mapped to the NCAP spending head
        the city reports against. We feed the official portal, not compete with it.
      </div>
    </Panel>
  );
}
