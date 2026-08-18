// "Share this place" — draws a 1080×1350 (WhatsApp/Instagram-friendly) PNG of
// a cell's story straight onto a canvas from the data. No DOM rasterising, no
// dependency: identical output everywhere, and it works offline.
import { SOURCE_COLORS } from "./sources";

type Trend = { series: Array<{ date: string; pm25: number; band: string }>; verdict?: { text: string; direction: string } | null };
type Forecast = { horizon_h: number; value: number; pi_low?: number; pi_high?: number };

const BAND = (v: number) =>
  v <= 30 ? "#22c55e" : v <= 60 ? "#84cc16" : v <= 90 ? "#eab308" : v <= 120 ? "#f97316" : v <= 250 ? "#ef4444" : "#7f1d1d";

function rr(ctx: CanvasRenderingContext2D, x: number, y: number, w: number, h: number, r: number) {
  ctx.beginPath();
  ctx.moveTo(x + r, y); ctx.arcTo(x + w, y, x + w, y + h, r); ctx.arcTo(x + w, y + h, x, y + h, r);
  ctx.arcTo(x, y + h, x, y, r); ctx.arcTo(x, y, x + w, y, r); ctx.closePath();
}

export function renderShareCard(opts: {
  cityName: string;
  place: string;
  cellId: string;
  shares: Array<[string, number]>;
  confidence?: number;
  trend?: Trend | null;
  forecast?: Forecast[];
  logo?: HTMLImageElement | null;
}): HTMLCanvasElement {
  const W = 1080, H = 1420;
  const c = document.createElement("canvas");
  c.width = W; c.height = H;
  const ctx = c.getContext("2d")!;
  // background
  ctx.fillStyle = "#f8fafc"; ctx.fillRect(0, 0, W, H);
  // header band
  ctx.fillStyle = "#1b294a"; ctx.fillRect(0, 0, W, 210);
  ctx.fillStyle = "#059669"; ctx.fillRect(0, 0, W, 8);
  if (opts.logo) ctx.drawImage(opts.logo, 56, 52, 96, 96);
  ctx.fillStyle = "#fff"; ctx.font = "800 54px Inter, Segoe UI, Arial"; ctx.fillText("VayuNetra", 176, 108);
  ctx.fillStyle = "#94a3b8"; ctx.font = "500 26px Inter, Segoe UI, Arial"; ctx.fillText("Air quality intelligence · " + opts.cityName, 178, 150);

  // place
  ctx.fillStyle = "#0f172a"; ctx.font = "800 60px Inter, Segoe UI, Arial";
  ctx.fillText(opts.place.length > 26 ? opts.place.slice(0, 25) + "…" : opts.place, 56, 300);
  ctx.fillStyle = "#64748b"; ctx.font = "500 24px ui-monospace, Menlo, monospace"; ctx.fillText(`~1 km² · ${opts.cellId}`, 58, 340);

  // blame bars
  let y = 410;
  ctx.fillStyle = "#0f172a"; ctx.font = "800 30px Inter, Segoe UI, Arial"; ctx.fillText("Who is to blame", 56, y);
  if (typeof opts.confidence === "number") {
    ctx.fillStyle = "#64748b"; ctx.font = "500 24px Inter, Segoe UI, Arial";
    ctx.fillText(`confidence ${Math.round(opts.confidence * 100)}%`, 330, y);
  }
  y += 34;
  for (const [k, v] of opts.shares.slice(0, 4)) {
    const [r, g, b] = (SOURCE_COLORS as Record<string, [number, number, number]>)[k] ?? [107, 114, 128];
    ctx.fillStyle = "#334155"; ctx.font = "600 26px Inter, Segoe UI, Arial";
    ctx.fillText(k.replace(/_/g, " "), 56, y + 26);
    rr(ctx, 380, y + 6, 560, 24, 12); ctx.fillStyle = "#e2e8f0"; ctx.fill();
    rr(ctx, 380, y + 6, Math.max(6, 560 * Math.min(1, v)), 24, 12); ctx.fillStyle = `rgb(${r},${g},${b})`; ctx.fill();
    ctx.fillStyle = "#0f172a"; ctx.font = "700 26px Inter, Segoe UI, Arial"; ctx.textAlign = "right";
    ctx.fillText(`${Math.round(v * 100)}%`, W - 56, y + 27); ctx.textAlign = "left";
    y += 50;
  }

  // trend
  y += 46;
  ctx.fillStyle = "#0f172a"; ctx.font = "800 30px Inter, Segoe UI, Arial"; ctx.fillText("Past air — daily PM2.5", 56, y);
  const series = opts.trend?.series ?? [];
  const verdict = opts.trend?.verdict;
  if (verdict) {
    const col = verdict.direction === "worse" ? "#dc2626" : verdict.direction === "better" ? "#059669" : "#475569";
    const bg = verdict.direction === "worse" ? "#fef2f2" : verdict.direction === "better" ? "#ecfdf5" : "#f1f5f9";
    rr(ctx, 56, y + 18, W - 112, 62, 12); ctx.fillStyle = bg; ctx.fill();
    ctx.fillStyle = col; ctx.font = "700 26px Inter, Segoe UI, Arial";
    const t = verdict.text.length > 62 ? verdict.text.slice(0, 61) + "…" : verdict.text;
    ctx.fillText((verdict.direction === "worse" ? "↑ " : verdict.direction === "better" ? "↓ " : "→ ") + t, 76, y + 58);
  }
  const cx = 56, cy = y + 104, cw = W - 112, ch = 210;
  if (series.length >= 3) {
    const max = Math.max(60, ...series.map((p) => p.pm25)) * 1.08;
    // bands
    for (const [lo, hi, col] of [[0, 30, "#22c55e"], [30, 60, "#84cc16"], [60, 90, "#eab308"], [90, 120, "#f97316"], [120, 250, "#ef4444"]] as const) {
      const y1 = cy + ch - (Math.min(hi, max) / max) * ch, y2 = cy + ch - (lo / max) * ch;
      ctx.fillStyle = col; ctx.globalAlpha = 0.10; ctx.fillRect(cx, y1, cw, y2 - y1); ctx.globalAlpha = 1;
    }
    ctx.beginPath();
    series.forEach((p, i) => { const px = cx + (i / (series.length - 1)) * cw; const py = cy + ch - (p.pm25 / max) * ch; i ? ctx.lineTo(px, py) : ctx.moveTo(px, py); });
    ctx.strokeStyle = "#1e3a8a"; ctx.lineWidth = 3.5; ctx.stroke();
    ctx.fillStyle = "#94a3b8"; ctx.font = "500 20px Inter, Segoe UI, Arial";
    ctx.fillText(series[0].date, cx, cy + ch + 28); ctx.textAlign = "right"; ctx.fillText(series[series.length - 1].date, cx + cw, cy + ch + 28); ctx.textAlign = "left";
    ctx.fillText(`${series.length} days of station readings`, cx, cy + ch + 56);
  } else {
    ctx.fillStyle = "#94a3b8"; ctx.font = "500 24px Inter, Segoe UI, Arial"; ctx.fillText("Not enough daily history for this place yet.", cx, cy + 40);
  }

  // forecast chips
  y = cy + ch + 116;
  ctx.fillStyle = "#0f172a"; ctx.font = "800 30px Inter, Segoe UI, Arial"; ctx.fillText("Where it's heading", 56, y);
  const fcs = (opts.forecast ?? []).slice(0, 3);
  fcs.forEach((f, i) => {
    const bx = 56 + i * 330, by = y + 22;
    rr(ctx, bx, by, 300, 110, 16); ctx.fillStyle = "#fff"; ctx.fill(); ctx.strokeStyle = "#e2e8f0"; ctx.lineWidth = 2; ctx.stroke();
    ctx.fillStyle = "#64748b"; ctx.font = "600 22px Inter, Segoe UI, Arial"; ctx.fillText(`+${f.horizon_h}h`, bx + 20, by + 34);
    ctx.fillStyle = BAND(f.value); ctx.font = "800 44px Inter, Segoe UI, Arial"; ctx.fillText(`${Math.round(f.value)}`, bx + 20, by + 84);
    if (typeof f.pi_low === "number") { ctx.fillStyle = "#94a3b8"; ctx.font = "500 20px Inter, Segoe UI, Arial"; ctx.fillText(`[${Math.round(f.pi_low)}–${Math.round(f.pi_high ?? 0)}] µg/m³`, bx + 110, by + 82); }
  });

  // footer
  ctx.fillStyle = "#1b294a"; ctx.fillRect(0, H - 90, W, 90);
  ctx.fillStyle = "#94a3b8"; ctx.font = "500 22px Inter, Segoe UI, Arial";
  ctx.fillText("vayunetra-aqi.vercel.app · real station data · PM2.5 in µg/m³ · CPCB bands", 56, H - 36);
  return c;
}

export async function loadLogo(): Promise<HTMLImageElement | null> {
  return new Promise((resolve) => {
    const img = new Image();
    img.onload = () => resolve(img);
    img.onerror = () => resolve(null);
    img.src = "/icon-192.png";
  });
}
