// Citizen complaint loop (Sameer-2.0 pattern): photograph a source, it enters
// the enforcement funnel as a candidate, and the SLA clock is public. Reports
// are transparency machinery, so the list renders for everyone.
import { useEffect, useRef, useState } from "react";
import { api, API_BASE, API_TOKEN } from "./api";

type Report = {
  id: number;
  h3_cell: string;
  category: string;
  description?: string;
  photo_url?: string | null;
  status: "received" | "verified" | "actioned" | "resolved" | "rejected";
  sla_hours: number;
  sla_remaining_h?: number | null;
  sla_breached?: boolean;
  created_at: string;
};

const CATEGORIES: Array<[string, string]> = [
  ["waste_burning", "Waste burning"],
  ["construction_dust", "Construction dust"],
  ["industrial_smoke", "Industrial smoke"],
  ["vehicle_smoke", "Vehicle smoke"],
  ["other", "Other"],
];

const STATUS_STYLE: Record<Report["status"], string> = {
  received: "bg-slate-100 text-slate-700",
  verified: "bg-sky-100 text-sky-800",
  actioned: "bg-amber-100 text-amber-800",
  resolved: "bg-emerald-100 text-emerald-800",
  rejected: "bg-gray-100 text-gray-500",
};

export default function CitizenReports({ city, center }: { city: string; center?: [number, number] }) {
  const [reports, setReports] = useState<Report[]>([]);
  const [openForm, setOpenForm] = useState(false);
  const [category, setCategory] = useState("waste_burning");
  const [description, setDescription] = useState("");
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState<string | null>(null);
  const fileRef = useRef<HTMLInputElement>(null);

  const load = () => {
    api<{ reports: Report[] }>(`/reports?city=${city}`)
      .then((d) => setReports(d.reports ?? []))
      .catch(() => setReports([]));
  };
  useEffect(() => {
    let alive = true;
    api<{ reports: Report[] }>(`/reports?city=${city}`)
      .then((d) => alive && setReports(d.reports ?? []))
      .catch(() => alive && setReports([]));
    return () => {
      alive = false;
    };
  }, [city]);

  const submit = async () => {
    setBusy(true);
    setMsg(null);
    try {
      // browser location if granted; city centre otherwise — honesty over precision
      const loc = await new Promise<[number, number] | null>((resolve) => {
        if (!navigator.geolocation) return resolve(null);
        navigator.geolocation.getCurrentPosition(
          (p) => resolve([p.coords.latitude, p.coords.longitude]),
          () => resolve(null),
          { timeout: 4000 },
        );
      });
      const fallback: [number, number] | null = center ? [center[1], center[0]] : null;
      const chosen = loc ?? fallback;
      if (!chosen) {
        setMsg("Location permission is needed to file a report (or try again on a device with GPS).");
        setBusy(false);
        return;
      }
      const [lat, lng] = chosen;
      const fd = new FormData();
      fd.set("city", city);
      fd.set("lat", String(lat));
      fd.set("lng", String(lng));
      fd.set("category", category);
      fd.set("description", description);
      const photo = fileRef.current?.files?.[0];
      if (photo) fd.set("photo", photo);
      const res = await fetch(`${API_BASE}/report`, {
        method: "POST",
        headers: API_TOKEN ? { Authorization: `Bearer ${API_TOKEN}` } : undefined,
        body: fd,
      });
      const env = await res.json();
      if (!env.success) throw new Error(env.error?.message ?? "failed");
      setMsg(`Report #${env.data.report_id} received — 72h SLA clock started.`);
      setDescription("");
      if (fileRef.current) fileRef.current.value = "";
      setOpenForm(false);
      load();
    } catch (e) {
      setMsg(e instanceof Error ? e.message : "Could not submit the report.");
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="mt-3 border-t border-gray-100 pt-2">
      <div className="flex items-center justify-between">
        <div>
          <span className="text-xs font-semibold text-slate-700">📸 Report a pollution source</span>
          <span className="ml-1 text-[11px] text-slate-400">photo → verified → enforcement worklist</span>
        </div>
        <button
          onClick={() => setOpenForm((v) => !v)}
          className="rounded-md bg-slate-800 px-2 py-1 text-[11px] font-semibold text-white hover:bg-slate-700 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-emerald-400/80"
        >
          {openForm ? "Cancel" : "Report"}
        </button>
      </div>

      {openForm && (
        <div className="mt-2 space-y-2 rounded-md border border-slate-200 bg-slate-50 p-2">
          <select
            value={category}
            onChange={(e) => setCategory(e.target.value)}
            className="w-full rounded border border-slate-300 bg-white px-2 py-1 text-xs"
          >
            {CATEGORIES.map(([v, l]) => (
              <option key={v} value={v}>{l}</option>
            ))}
          </select>
          <input
            value={description}
            onChange={(e) => setDescription(e.target.value)}
            placeholder="What do you see? (optional)"
            className="w-full rounded border border-slate-300 px-2 py-1 text-xs"
          />
          <input ref={fileRef} type="file" accept="image/*" className="w-full text-[11px] text-slate-500" />
          <button
            onClick={submit}
            disabled={busy}
            className="w-full rounded-md bg-emerald-600 py-1.5 text-xs font-semibold text-white hover:bg-emerald-700 disabled:opacity-50"
          >
            {busy ? "Submitting…" : "Submit report (uses your location if allowed)"}
          </button>
        </div>
      )}
      {msg && <div className="mt-1 text-[11px] text-emerald-700">{msg}</div>}

      {reports.length > 0 && (
        <div className="mt-2 space-y-1.5">
          {reports.slice(0, 4).map((r) => (
            <div key={r.id} className="flex items-center gap-2 rounded-md border border-slate-200 p-1.5 text-[11px]">
              {r.photo_url ? (
                <img src={r.photo_url} alt="" className="h-8 w-8 rounded object-cover ring-1 ring-slate-200" />
              ) : (
                <div className="flex h-8 w-8 items-center justify-center rounded bg-slate-100 text-slate-400">#{r.id}</div>
              )}
              <div className="min-w-0 flex-1">
                <span className="font-semibold text-slate-700">{r.category.replace(/_/g, " ")}</span>
                <span className="ml-1 text-slate-400">· cell {r.h3_cell.slice(-6)}</span>
              </div>
              <span className={`rounded px-1.5 py-0.5 font-semibold ${STATUS_STYLE[r.status]}`}>{r.status}</span>
              {typeof r.sla_remaining_h === "number" && r.status !== "resolved" && r.status !== "rejected" && (
                <span className={`rounded px-1.5 py-0.5 font-semibold ${r.sla_breached ? "bg-red-100 text-red-700" : "bg-slate-100 text-slate-600"}`}>
                  {r.sla_breached ? "SLA breached" : `${Math.max(0, Math.round(r.sla_remaining_h))}h left`}
                </span>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
