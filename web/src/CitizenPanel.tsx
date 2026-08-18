import { useEffect, useMemo, useState } from "react";
import { api } from "./api";
import CitizenReports from "./CitizenReports";
import ExposureCorridors from "./ExposureCorridors";
import { categoryForPm25, formatIndex, pm25Index } from "./aqi";
import { useAqiScale } from "./aqiScale";
import { Panel, SegBtn, Step } from "./ui";

type Advisory = {
  ward_id: string;
  risk_tier: string;
  audience_segment: string;
  language: string;
  channel: string;
  message: string;
};

const ALL_LANGS = ["en", "hi", "kn", "mr", "ta", "te", "bn", "gu"];
const LABELS: Record<string, string> = { en: "English", hi: "Hindi", kn: "Kannada", mr: "Marathi", ta: "Tamil", te: "Telugu", bn: "Bengali", gu: "Gujarati" };

type BroadcastResult = {
  telegram?: { status: string; detail?: string; message_id?: number };
  ivr?: { status: string; detail?: string; sid?: string };
};

type CleanZone = {
  h3_cell: string;
  zone_id: string;
  pm25: number;
  aqi: number;
  maps_url: string;
};

type CleanZones = { basis?: string; zones: CleanZone[] };

export default function CitizenPanel({ city, languages, center }: { city: string; languages?: string[]; center?: [number, number] }) {
  const { scale } = useAqiScale();
  // Offer only the languages this city is configured for (falling back to all
  // four only when the config carries none). Merging in ALL_LANGS used to let a
  // judge pick Kannada for Chennai and get a template advisory nobody reviewed.
  const choices = useMemo(
    () => (languages && languages.length ? languages.filter((l) => ALL_LANGS.includes(l)) : ALL_LANGS),
    [languages],
  );
  const [lang, setLang] = useState(choices[0] ?? "en");
  const [rows, setRows] = useState<Advisory[] | null>(null);
  const [channel, setChannel] = useState("pwa");
  const [bcast, setBcast] = useState<"idle" | "confirm" | "sending" | "done" | "error">("idle");
  const [bcastMsg, setBcastMsg] = useState("");
  const [cleanZones, setCleanZones] = useState<CleanZones | null>(null);

  useEffect(() => {
    setCleanZones(null);
    api<CleanZones>(`/clean-zones?city=${city}&top=4`).then(setCleanZones).catch(() => setCleanZones({ zones: [] }));
  }, [city]);

  // Default to the city's first showcase language (Hindi in Delhi, Marathi in Mumbai…) —
  // the city config arrives after first paint, so re-derive when the choices change.
  const choicesKey = choices.join(",");
  useEffect(() => {
    setLang(choices[0] ?? "en");
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [choicesKey, city]);

  useEffect(() => {
    setRows(null);
    api<Advisory[]>(`/advisory?city=${city}&lang=${lang}`).then(setRows).catch(() => setRows([]));
  }, [city, lang]);

  async function broadcast() {
    setBcast("sending");
    try {
      const r = await api<BroadcastResult>("/advisory/broadcast", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ city, ivr: true }),
      });
      const parts: string[] = [];
      if (r.telegram) parts.push(`Telegram: ${r.telegram.status}`);
      if (r.ivr) parts.push(`IVR: ${r.ivr.status}`);
      setBcastMsg(parts.join(" · ") || "sent");
      setBcast("done");
    } catch (e) {
      setBcastMsg(e instanceof Error ? e.message : "failed");
      setBcast("error");
    }
    setTimeout(() => setBcast("idle"), 8000);
  }

  // One advisory per zone (rows repeat per delivery channel with the same
  // text) — the chips below switch the CHANNEL PREVIEW, i.e. how the same
  // advisory actually looks on the app, in Telegram, over IVR, on a display.
  const seen = new Set<string>();
  const items = (rows ?? []).filter((r) => {
    if (seen.has(r.ward_id)) return false;
    seen.add(r.ward_id);
    return true;
  });
  const CHANNELS: Array<[string, string]> = [
    ["pwa", "App"],
    ["telegram", "Telegram"],
    ["ivr", "IVR call"],
    ["display", "Big screen"],
  ];

  return (
    <>
    <Step n={1} label="Advisories by ward" info={<p>Ward-level health advisories tiered by forecast risk and vulnerability, in the city's languages. Templated by design (no language model), script-validated in code.</p>}>
    <Panel
      title="Citizen Advisory"
      right={
        <select
          aria-label="Advisory language"
          className="rounded-md border border-slate-200 bg-slate-50 px-2 py-1 text-xs font-medium text-slate-700"
          value={lang}
          onChange={(e) => setLang(e.target.value)}
        >
          {choices.map((l) => (
            <option key={l} value={l}>
              {LABELS[l] ?? l}
            </option>
          ))}
        </select>
      }
    >
      <div className="flex flex-wrap gap-1">
        {CHANNELS.map(([c, label]) => (
          <SegBtn key={c} active={channel === c} onClick={() => setChannel(c)}>
            {label}
          </SegBtn>
        ))}
      </div>
      <div className="mt-1 text-[10px] text-gray-500">how the same advisory reaches citizens on each channel</div>

      {rows === null ? (
        <div className="mt-3 space-y-2">
          {[0, 1].map((i) => (
            <div key={i} className="h-14 animate-pulse rounded-md bg-gray-100" />
          ))}
        </div>
      ) : items.length === 0 ? (
        <div className="mt-3 text-xs text-gray-500">No advisory in this language yet</div>
      ) : channel === "pwa" ? (
        <div className="mt-3 space-y-2">
          {items.map((a) => (
            <div key={a.ward_id} className="rounded-md border border-gray-200 p-2">
              <div className="flex items-center justify-between text-xs">
                <span className="font-medium">{a.ward_id}</span>
                <span className="rounded bg-amber-100 px-1.5 py-0.5 text-amber-800">{a.risk_tier.replace("_", " ")}</span>
              </div>
              <div className="mt-1 text-xs leading-5 text-gray-700">{a.message}</div>
            </div>
          ))}
        </div>
      ) : channel === "telegram" ? (
        <div className="mt-3">
          {/* Telegram chat mock: bot bubbles, real message text */}
          <div className="rounded-lg bg-[#8ab4d8]/20 p-2.5">
            <div className="mb-1.5 flex items-center gap-1.5 text-[11px] font-semibold text-slate-700">
              <img src="/icon-192.png" alt="" className="h-4 w-4 rounded-full" width={16} height={16} />
              VayuNetra Bot
            </div>
            {items.slice(0, 3).map((a) => (
              <div key={a.ward_id} className="mb-1.5 max-w-[95%] rounded-xl rounded-tl-sm bg-white p-2 text-xs leading-5 text-slate-800 shadow-sm">
                <b>⚠ {a.ward_id}</b> · {a.risk_tier.replace("_", " ")}
                <br />
                {a.message}
              </div>
            ))}
          </div>
          <div className="mt-2 flex items-center gap-2 rounded-md border border-gray-200 p-2">
            <img src="/qr-telegram.svg" alt="QR — open the VayuNetra Telegram bot" className="h-14 w-14" width={56} height={56} />
            <div className="text-[11px] leading-4 text-gray-600">
              Live two-way bot: <b>/start</b> → pick a city → auto-receive advisories. Scan to subscribe on your own phone.
            </div>
          </div>
        </div>
      ) : channel === "ivr" ? (
        <div className="mt-3 space-y-2">
          {/* What a caller actually hears (mirrors channels/ivr.py wording) */}
          <div className="rounded-md border border-gray-200 p-2.5">
            <div className="flex items-center gap-1.5 text-[11px] font-semibold text-slate-700">📞 What callers hear</div>
            <p className="mt-1 text-xs italic leading-5 text-gray-600">
              "This is an air quality alert from Vayu Netra. {items[0].message} I will now repeat this alert… Stay safe, and
              limit outdoor exposure. Goodbye."
            </p>
          </div>
          <div className="rounded-md bg-slate-50 p-2 text-[11px] leading-4 text-gray-600">
            Citizens can also <b>call in</b>: the line answers with a city menu — press 1 for Delhi, 2 for Bengaluru, 3 for Mumbai, 4–9 and 0 for the other seven — and
            reads that city's latest advisory in a clear Indian-English voice.
          </div>
          <div className="text-[10px] leading-4 text-gray-500">
            Live calls are spoken in Hindi (Polly Kajal) for Hindi-first cities and in English elsewhere — Polly has no voice yet for the other Indian scripts.
          </div>
        </div>
      ) : (
        <div className="mt-3 space-y-2">
          {/* Public display board mode: big type, high contrast */}
          {items.slice(0, 2).map((a) => (
            <div key={a.ward_id} className="rounded-lg bg-[#1b294a] p-3 text-white">
              <div className="flex items-center justify-between">
                <span className="text-[11px] font-bold uppercase tracking-widest text-emerald-300">Air quality advisory</span>
                <span className="rounded bg-amber-400 px-1.5 py-0.5 text-[11px] font-bold text-slate-900">
                  {a.risk_tier.replace("_", " ").toUpperCase()}
                </span>
              </div>
              <div className="mt-1 text-[15px] font-extrabold leading-6">{a.ward_id.toUpperCase()}</div>
              <div className="mt-0.5 text-[13px] leading-5 text-slate-200">{a.message}</div>
            </div>
          ))}
          <div className="text-[10px] text-gray-500">public display / big-screen board rendering</div>
        </div>
      )}

    </Panel>
</Step>

      {/* 2 — Send it: live multi-channel broadcast (real Telegram + real IVR call) */}
      <Step n={2} label="Send it" info={<p>Broadcasts the latest advisory to the configured Telegram channel and places a real IVR phone call (Twilio, Indian-English neural voice). Confirmation is required — this touches the outside world.</p>}>
        <Panel title="Send it" tag="Telegram · IVR · display">
          {bcast === "idle" && (
            <button
              onClick={() => setBcast("confirm")}
              className="w-full cursor-pointer rounded-md bg-emerald-700 px-2 py-2 text-xs font-semibold text-white transition-colors hover:bg-emerald-800"
            >
              📣 Broadcast latest alert (Telegram + IVR)
            </button>
          )}
          {bcast === "confirm" && (
            <div className="rounded border border-amber-300 bg-amber-50 p-2 text-xs">
              <div className="text-amber-800">Send a real Telegram message and place a real phone call?</div>
              <div className="mt-1.5 flex gap-2">
                <button onClick={broadcast} className="cursor-pointer rounded bg-emerald-700 px-2 py-1 text-white">
                  Yes, broadcast
                </button>
                <button onClick={() => setBcast("idle")} className="cursor-pointer rounded bg-gray-200 px-2 py-1 text-gray-700">
                  Cancel
                </button>
              </div>
            </div>
          )}
          {bcast === "sending" && <div className="text-center text-xs text-gray-500">broadcasting…</div>}
          {(bcast === "done" || bcast === "error") && (
            <div className={`rounded p-1.5 text-center text-xs ${bcast === "done" ? "bg-emerald-50 text-emerald-700" : "bg-red-50 text-red-700"}`}>
              {bcastMsg}
            </div>
          )}
          <div className="mt-1.5 text-[11px] leading-4 text-slate-500">
            The same advisory, rendered per channel above; a WhatsApp-ready card for any place is one click away in its cell story.
          </div>
        </Panel>
      </Step>

      {/* 3 — Cleanest zones right now — the flip side of the blame map: where
          to go, computed from the E2 dense 1km field (not a hardcoded list). */}
      {cleanZones && cleanZones.zones.length > 0 && (
        <Step n={3} label="Clean-air routes" info={<p>Lowest ~1 km cells from the dense model field anchored on live stations, with a corridor exposure screen for commutes. A modelled guide, not a measurement.</p>}>
        <Panel title="Cleanest air right now" tag="lowest ~1 km cells">
          <div className="grid grid-cols-2 gap-1.5">
            {cleanZones.zones.map((z) => {
              const cat = categoryForPm25(z.pm25, scale);
              const zIndex = pm25Index(z.pm25, scale);
              return (
                <a
                  key={z.h3_cell}
                  href={z.maps_url}
                  target="_blank"
                  rel="noreferrer"
                  className="rounded-lg border border-slate-200 p-2 transition-colors hover:border-emerald-300 hover:bg-emerald-50/50"
                  aria-label={`Open ${z.zone_id} in Google Maps — ${formatIndex(zIndex, scale)}, ${cat.label}`}
                >
                  <div className="flex items-center justify-between gap-1">
                    <span
                      className="rounded px-1.5 py-0.5 text-[11px] font-bold"
                      style={{ background: cat.color, color: cat.text }}
                    >
                      {formatIndex(zIndex, scale)}
                    </span>
                    <span className="text-[11px] text-slate-500">{cat.label}</span>
                  </div>
                  <div className="mt-1 font-mono text-xs font-semibold text-slate-700">{z.zone_id}</div>
                  <div className="text-[11px] text-emerald-700">Directions ↗</div>
                </a>
              );
            })}
          </div>
          <div className="mt-1 text-[11px] leading-4 text-slate-500">
            Estimated from the dense 1 km model field anchored on live station data — a modeled guide, not a measurement.
          </div>
          <ExposureCorridors city={city} center={center} zones={cleanZones.zones} />
        </Panel>
        </Step>
      )}

      {/* 4 — Citizen reports: the loop closes (photo → verified → enforcement worklist) */}
      <Step n={4} label="Citizen reports" info={<p>Residents report smoke, dust or burning with a photo and location. A verified report becomes an emission source in the enforcement worklist — citizens feed the officer loop.</p>}>
        <Panel title="Citizen reports" tag="photo → verified → worklist">
          <CitizenReports city={city} center={center} />
        </Panel>
      </Step>
    </>
  );
}
