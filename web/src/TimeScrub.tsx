// "Play the last 24 hours": scrubs the dense PM2.5 field through the day so
// the map visibly breathes with the morning rush and evening burn. Each dense
// cell is scaled by its nearest monitored cell's hourly ratio — a station-
// scaled replay, labelled as such, not a claim of hourly 1 km truth.
import { useEffect, useMemo, useRef, useState } from "react";
import { cellToLatLng } from "h3-js";
import { api } from "./api";

type Frame = { hour: string; cells: Record<string, number> };
export type ScrubFrame = { hour: string; scale: Record<string, number> } | null;

interface Props {
  city: string;
  denseCells: Array<{ h3_cell: string; pm25: number }>;
  onFrame: (f: ScrubFrame) => void; // null = live (no replay)
}

export default function TimeScrub({ city, denseCells, onFrame }: Props) {
  const [frames, setFrames] = useState<Frame[]>([]);
  const [idx, setIdx] = useState<number | null>(null); // null = live
  const [playing, setPlaying] = useState(false);
  const timer = useRef<number | null>(null);

  useEffect(() => {
    let alive = true;
    setFrames([]); setIdx(null); setPlaying(false); onFrame(null);
    api<{ frames: Frame[] }>(`/history/cells?city=${city}&hours=24`)
      .then((d) => alive && setFrames(d.frames ?? []))
      .catch(() => alive && setFrames([]));
    return () => { alive = false; };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [city]);

  // nearest monitored cell for each dense cell (computed once per city)
  const nearest = useMemo(() => {
    const monitored = frames.length ? Object.keys(frames[frames.length - 1].cells) : [];
    if (!monitored.length) return new Map<string, string>();
    const mLL = monitored.map((m) => [m, ...cellToLatLng(m)] as [string, number, number]);
    const out = new Map<string, string>();
    for (const c of denseCells) {
      const [lat, lng] = cellToLatLng(c.h3_cell);
      let best = mLL[0][0], bd = Infinity;
      for (const [m, mlat, mlng] of mLL) {
        const d = (mlat - lat) ** 2 + ((mlng - lng) * Math.cos((lat * Math.PI) / 180)) ** 2;
        if (d < bd) { bd = d; best = m; }
      }
      out.set(c.h3_cell, best);
    }
    return out;
  }, [frames, denseCells]);

  // emit the scaled frame whenever idx changes
  useEffect(() => {
    if (idx === null || !frames.length) { onFrame(null); return; }
    const now = frames[frames.length - 1].cells;
    const f = frames[idx];
    const scale: Record<string, number> = {};
    for (const [cell, station] of nearest) {
      const cur = now[station]; const then = f.cells[station];
      scale[cell] = cur && then ? then / cur : 1;
    }
    onFrame({ hour: f.hour, scale });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [idx, frames, nearest]);

  useEffect(() => {
    if (!playing) { if (timer.current) window.clearInterval(timer.current); return; }
    timer.current = window.setInterval(() => {
      setIdx((i) => {
        const n = frames.length;
        if (!n) return null;
        const next = i === null ? 0 : i + 1;
        if (next >= n) { setPlaying(false); return null; } // end → back to live
        return next;
      });
    }, 550);
    return () => { if (timer.current) window.clearInterval(timer.current); };
  }, [playing, frames.length]);

  if (frames.length < 6) return null;
  const hourLabel = (h: string) => {
    const d = new Date(h);
    return d.toLocaleTimeString("en-IN", { hour: "2-digit", minute: "2-digit", hour12: false, timeZone: "Asia/Kolkata" });
  };
  const label = idx === null ? "live" : `${hourLabel(frames[idx].hour)} IST`;

  return (
    <div className="pointer-events-auto flex items-center gap-2 rounded-lg border border-slate-200 bg-white/95 px-2.5 py-1.5 shadow-lg backdrop-blur">
      <button
        onClick={() => { if (playing) { setPlaying(false); } else { setIdx(0); setPlaying(true); } }}
        aria-label={playing ? "Pause replay" : "Play the last 24 hours"}
        className="flex h-7 w-7 items-center justify-center rounded-md bg-slate-800 text-white hover:bg-slate-700 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-emerald-400/80"
      >
        {playing ? (
          <svg viewBox="0 0 24 24" fill="currentColor" className="h-3.5 w-3.5"><rect x="6" y="5" width="4" height="14" /><rect x="14" y="5" width="4" height="14" /></svg>
        ) : (
          <svg viewBox="0 0 24 24" fill="currentColor" className="h-3.5 w-3.5"><path d="M8 5v14l11-7z" /></svg>
        )}
      </button>
      <input
        type="range" min={0} max={frames.length - 1} step={1}
        value={idx ?? frames.length - 1}
        onChange={(e) => { setPlaying(false); const v = Number(e.target.value); setIdx(v >= frames.length - 1 ? null : v); }}
        aria-label="Scrub the last 24 hours"
        className="h-1.5 w-40 cursor-pointer accent-slate-800 lg:w-56"
      />
      <span className={`w-20 text-[11px] font-semibold ${idx === null ? "text-emerald-700" : "text-slate-700"}`}>
        {idx === null ? "● live" : label}
      </span>
      <span className="hidden text-[10px] text-slate-400 xl:inline">last 24 h · station-scaled replay</span>
    </div>
  );
}
