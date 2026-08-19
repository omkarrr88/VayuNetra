// An illustration per health condition, drawn rather than fetched.
//
// Original line art on one 64x64 grid with a shared stroke weight, matching the landmark set in
// site/monuments.tsx. `currentColor` with no fill, so the card owns the colour and both themes are
// correct for free; the whole set is a few hundred bytes of path data and costs no request.
//
// These illustrate an ANATOMICAL or SYMPTOMATIC subject rather than a person, deliberately: a
// drawing of a distressed patient is a stock-illustration cliché, and it also implies a severity the
// card is not entitled to claim on a Good-air day. Lungs, a heart, a sinus map and a pollen grain
// say what the condition is without dramatising it.
import { type CSSProperties } from "react";

type Art = { title: string; d: string[] };

const CONDITION_ART: Record<string, Art> = {
  asthma: {
    title: "Airways",
    // bronchial tree — the airway that narrows
    d: [
      "M32 8v16",                                        // trachea
      "M32 24c-6 2-11 7-13 14M32 24c6 2 11 7 13 14",     // main bronchi
      "M19 38c-3 4-4 9-4 14M19 38c-4 2-7 6-8 11",        // left branches
      "M45 38c3 4 4 9 4 14M45 38c4 2 7 6 8 11",          // right branches
      "M28 8h8",                                         // larynx
      "M26 32h12M27 36h10",                              // cartilage rings
      "M15 52a3 3 0 1 0 .1 0M49 52a3 3 0 1 0 .1 0",      // alveolar tips
    ],
  },
  heart: {
    title: "Heart",
    d: [
      "M32 54C18 44 10 35 10 26a10 10 0 0 1 22-6 10 10 0 0 1 22 6c0 9-8 18-22 28Z",
      "M12 32h10l4-7 5 14 4-9 3 5h14",                   // the ECG trace across it
    ],
  },
  allergies: {
    title: "Pollen and particles",
    d: [
      "M32 32a9 9 0 1 0 .1 0",                           // grain body
      "M32 15v8M32 41v8M15 32h8M41 32h8",                // spikes, cardinal
      "M20 20l6 6M44 44l-6-6M44 20l-6 6M20 44l6-6",      // spikes, diagonal
      "M32 19a4 4 0 1 0 .1 0M32 45a4 4 0 1 0 .1 0",      // satellite particles
      "M12 12a3 3 0 1 0 .1 0M52 52a3 3 0 1 0 .1 0M52 12a3 3 0 1 0 .1 0M12 52a3 3 0 1 0 .1 0",
    ],
  },
  sinus: {
    title: "Sinuses",
    // a profile with the sinus cavities marked
    d: [
      "M22 54V38c-4-2-6-6-6-11a16 16 0 0 1 32 0c0 5-2 9-6 11v16",
      "M32 27v9c0 2-2 3-4 3",                            // nasal bridge
      "M27 44h9",                                        // mouth line
      "M23 22a5 5 0 1 0 .1 0M41 22a5 5 0 1 0 .1 0",      // the two sinus cavities
      "M32 12v-4",
    ],
  },
  coldflu: {
    title: "Fever and cough",
    d: [
      "M28 10h8v30a4 4 0 0 1-8 0Z",                      // thermometer stem
      "M32 52a6 6 0 1 0 .1 0",                           // bulb
      "M31 44v-4M31 36v-4M31 28v-4",                     // scale marks
      "M46 18c4 0 6 3 6 6M46 26c6 0 8 3 8 7M46 34c8 0 10 4 10 8",   // radiating heat
    ],
  },
  copd: {
    title: "Lungs",
    d: [
      "M32 12v22",                                       // trachea
      "M28 12h8",
      "M32 22c-4 0-9 3-11 9-2 6-3 13-2 18 1 4 5 5 8 3 4-3 6-8 6-14V22Z",   // left lung
      "M32 22c4 0 9 3 11 9 2 6 3 13 2 18-1 4-5 5-8 3-4-3-6-8-6-14V22Z",    // right lung
      "M24 36c3 1 5 3 6 6M40 36c-3 1-5 3-6 6",           // inner branching
    ],
  },
};

/** Nothing renders for a condition with no drawing — no placeholder, no broken image. */
export function ConditionArt({ conditionKey, width = 72, style, className = "" }: {
  conditionKey: string;
  width?: number;
  style?: CSSProperties;
  className?: string;
}) {
  const art = CONDITION_ART[conditionKey];
  if (!art) return null;
  return (
    <svg
      viewBox="0 0 64 64"
      width={width}
      height={width}
      aria-hidden="true"
      focusable="false"
      className={className}
      style={{ flex: "none", display: "block", ...style }}
    >
      <g fill="none" stroke="currentColor" strokeWidth={1.6} strokeLinecap="round" strokeLinejoin="round">
        {art.d.map((d) => <path key={d} d={d} />)}
      </g>
    </svg>
  );
}

export const conditionArtTitle = (key: string): string | undefined => CONDITION_ART[key]?.title;
