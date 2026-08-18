import { useEffect, useState } from "react";
import { api } from "./api";
import { Panel } from "./ui";

type StaticLayers = {
  emission_sources: { id: string; type: string; name: string; detection_confidence: number }[];
  vulnerability: {
    ward_id: string;
    population: number;
    vulnerability_index: number;
    schools: number;
    hospitals: number;
    eldercare?: number;
  }[];
};

type Mobility = { station_id: string; value: number; ts: string }[];

export default function CityIntelPanel({ city }: { city: string }) {
  const [layers, setLayers] = useState<StaticLayers | null>(null);
  const [mobility, setMobility] = useState<Mobility>([]);

  useEffect(() => {
    api<StaticLayers>(`/static-layers?city=${city}`).then(setLayers).catch(() => setLayers(null));
    api<Mobility>(`/mobility?city=${city}`).then(setMobility).catch(() => setMobility([]));
  }, [city]);

  const traffic = mobility.length ? Math.round(mobility.reduce((s, r) => s + r.value, 0) / mobility.length) : null;
  const vuln = layers?.vulnerability ?? [];
  const hospitals = vuln.reduce((s, v) => s + (v.hospitals || 0), 0);
  const schools = vuln.reduce((s, v) => s + (v.schools || 0), 0);
  const stats: Array<[string, string]> = [];
  if (layers?.emission_sources.length) stats.push(["registry sources", String(layers.emission_sources.length)]);
  if (traffic !== null) stats.push(["traffic index", String(traffic)]);
  if (vuln.length) stats.push(["sensitive zones", String(vuln.length)]);

  return (
    <Panel title="City Intel">
      {stats.length > 0 ? (
        <div className={`grid gap-2 text-xs ${stats.length === 3 ? "grid-cols-3" : "grid-cols-2"}`}>
          {stats.map(([label, value]) => (
            <div key={label} className="rounded-md bg-slate-50 p-2 ring-1 ring-slate-100">
              <div className="text-[11px] text-slate-500">{label}</div>
              <div className="text-sm font-bold text-slate-800">{value}</div>
            </div>
          ))}
        </div>
      ) : (
        <div className="text-xs text-slate-500">loading city profile…</div>
      )}
      {vuln.length > 0 && (
        <div
          className="mt-2 rounded-md bg-rose-50 px-2 py-1.5 text-xs text-rose-900"
          title="OSM hospitals/clinics, schools and elder-care facilities per ~1km zone, weighted with GPW population — drives advisory tier escalation and audience segments"
        >
          <b>{hospitals.toLocaleString()}</b> hospitals/clinics · <b>{schools.toLocaleString()}</b> schools mapped —
          advisories escalate where forecast air is bad <i>and</i> sensitive people are.
        </div>
      )}
      {(layers?.emission_sources.length ?? 0) > 0 && (
        <div className="mt-2 space-y-1 text-xs text-slate-600">
          <div className="text-[11px] font-semibold uppercase tracking-wide text-slate-500">top registered sources</div>
          {layers!.emission_sources.slice(0, 2).map((s) => (
            <div key={s.id} className="flex justify-between gap-2">
              <span className="truncate">{s.name}</span>
              <span className="shrink-0 text-slate-500">{Math.round(s.detection_confidence * 100)}%</span>
            </div>
          ))}
        </div>
      )}
    </Panel>
  );
}
