import { useEffect, useState } from "react";

export const TOUR_KEY = "vayunetra-tour-v1";

export function tourSeen(): boolean {
  try {
    return localStorage.getItem(TOUR_KEY) === "done";
  } catch {
    return true; // storage blocked — never nag
  }
}

function markSeen() {
  try {
    localStorage.setItem(TOUR_KEY, "done");
  } catch {
    /* storage blocked — the flag just won't persist */
  }
}

type Step = {
  title: string;
  body: string;
  // Element the dimmed overlay cuts a spotlight around (desktop only). The card is then placed
  // against that element's measured box, so the tour cannot drift when the layout changes.
  target?: string;
  shrink?: number; // spotlight only the central fraction (full-bleed targets)
};

const STEPS: Step[] = [
  {
    title: "One city at a time",
    body: "Pick any of the 10 cities up here. Everything on the page — map, forecasts, worklist — follows the city you choose. [ and ] cycle through them.",
    target: "[data-tour=city]",
  },
  {
    title: "Every section is a page",
    body: "The links along the top are the console's sections. Keys 1–8 jump straight to them, ⌘K opens a search over every city and section, and P is presentation mode for the projector.",
    target: "[data-tour=nav]",
  },
  {
    title: "Every hexagon is ~1 km² of the city",
    body: "The map shows who is to blame for PM2.5, square kilometre by square kilometre. Click any hexagon for its full story: sources, evidence and a 72-hour outlook.",
    target: "[data-tour=map]",
    shrink: 0.5,
  },
  {
    title: "Every section has a path",
    body: "Under the section title are its numbered steps. Click a number to jump to that card; every card carries the same number, and its ? explains where the numbers come from.",
    target: "[data-tour=spine]",
  },
  {
    title: "From blame to action",
    body: "Enforcement turns the science into a ranked officer worklist — each item carries cited evidence, a real satellite dossier and a draft notice PDF; then you dispatch by ward and track the measured outcome.",
    target: "[data-tour=panel]",
    shrink: 0.35,
  },
];

type Spot = { left: number; top: number; width: number; height: number };

const CARD_W = 304;
const CARD_H = 220;

/** Put the card just outside the spotlight — below it when there is room, above it otherwise —
 *  and keep it fully on screen. Without a spotlight (mobile) it centres. */
function cardStyle(spot: Spot | null): React.CSSProperties {
  if (!spot) return { left: "50%", top: "50%", transform: "translate(-50%, -50%)" };
  const gap = 14;
  const vw = window.innerWidth, vh = window.innerHeight;
  const below = spot.top + spot.height + gap;
  const roomBelow = vh - below > CARD_H;
  const wanted = roomBelow ? below : spot.top - CARD_H - gap;
  // the card must be fully on screen whatever the target does
  const top = Math.min(Math.max(gap, wanted), Math.max(gap, vh - CARD_H - gap));
  const left = Math.min(Math.max(gap, spot.left + spot.width / 2 - CARD_W / 2), Math.max(gap, vw - CARD_W - gap));
  return { left, top, transform: "none" };
}

function spotlightRect(s: Step): Spot | null {
  if (!s.target || !window.matchMedia("(min-width: 1024px)").matches) return null;
  const el = document.querySelector(s.target);
  if (!el) return null;
  const r = el.getBoundingClientRect();
  if (r.width < 4 || r.height < 4) return null;
  let { left, top, width, height } = r;
  if (s.shrink) {
    // full-bleed target (the map): spotlight only its central region
    left += (width * (1 - s.shrink)) / 2;
    top += (height * (1 - s.shrink)) / 2;
    width *= s.shrink;
    height *= s.shrink;
  }
  const pad = 6;
  // Clip to the viewport: a target taller than the screen would otherwise put the spotlight — and
  // the card anchored to it — below the fold.
  const vw = window.innerWidth, vh = window.innerHeight;
  const x0 = Math.max(0, left - pad), y0 = Math.max(0, top - pad);
  const x1 = Math.min(vw, left + width + pad), y1 = Math.min(vh, top + height + pad);
  if (x1 - x0 < 8 || y1 - y0 < 8) return null;
  return { left: x0, top: y0, width: x1 - x0, height: y1 - y0 };
}

/** First-run guided tour: 4 fixed cards, no library, dismiss = never again. */
export default function Tour({ onDone }: { onDone: () => void }) {
  const [step, setStep] = useState(0);
  const s = STEPS[step];
  const last = step === STEPS.length - 1;

  // Spotlight: measured per step, re-measured on resize.
  const [spot, setSpot] = useState<Spot | null>(() => spotlightRect(STEPS[0]));
  useEffect(() => {
    const measure = () => setSpot(spotlightRect(STEPS[step]));
    measure();
    window.addEventListener("resize", measure);
    return () => window.removeEventListener("resize", measure);
  }, [step]);

  function finish() {
    markSeen();
    onDone();
  }

  // Standard dialog affordances: Escape and backdrop-click both dismiss.
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") finish();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  return (
    <div
      className={`fixed inset-0 z-40 ${spot ? "" : "bg-slate-900/50 backdrop-blur-[2px]"}`}
      role="dialog"
      aria-modal="true"
      aria-label="Quick tour"
      onClick={(e) => e.target === e.currentTarget && finish()}
    >
      {/* The spotlight: a transparent window whose giant box-shadow dims
          everything else — the highlighted element stays at full brightness.
          It morphs between steps via the transition on position/size. */}
      {spot && (
        <div
          aria-hidden="true"
          className="pointer-events-none absolute rounded-xl ring-2 ring-emerald-300/90 transition-all duration-300 ease-out"
          style={{
            left: spot.left,
            top: spot.top,
            width: spot.width,
            height: spot.height,
            boxShadow: "0 0 0 9999px rgba(15, 23, 42, 0.55)",
          }}
        />
      )}
      {/* Positioning and animation live on separate elements — the vn-pop
          keyframe's `transform` would otherwise override the centering
          translate (animation fill-mode wins over utility classes). */}
      <div className="absolute w-[19rem] max-w-[calc(100vw-2rem)]" style={cardStyle(spot)}>
        <div key={step} className="vn-pop relative rounded-xl bg-white p-4 shadow-2xl">
          <div className="mb-1 flex items-center gap-2">
            <img src="/icon-192.png" alt="" className="h-5 w-5 rounded" width={20} height={20} />
            <span className="text-[13px] font-bold text-slate-900">{s.title}</span>
          </div>
          <p className="text-[12.5px] leading-relaxed text-slate-600">{s.body}</p>

          <div className="mt-3 flex items-center justify-between">
            <div className="flex gap-1.5" aria-label={`Step ${step + 1} of ${STEPS.length}`}>
              {STEPS.map((_, i) => (
                <span
                  key={i}
                  className={`h-1.5 w-1.5 rounded-full transition-colors ${i === step ? "bg-blue-600" : "bg-slate-200"}`}
                />
              ))}
            </div>
            <div className="flex items-center gap-2">
              {!last && (
                <button onClick={finish} className="text-[12px] font-medium text-slate-500 transition-colors hover:text-slate-600">
                  Skip
                </button>
              )}
              <button
                onClick={() => (last ? finish() : setStep(step + 1))}
                className="rounded-md bg-blue-600 px-3 py-1.5 text-[12px] font-semibold text-white transition-colors hover:bg-blue-700"
              >
                {last ? "Start exploring" : "Next"}
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
