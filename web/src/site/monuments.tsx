// A landmark per city, drawn as line art.
//
// Original drawings, not traced or copied: each is built from straight segments and arcs on one
// 96x64 grid with a shared ground line at y=56 and a shared visual weight, so the ten read as a set
// rather than as ten pieces of clip art. Stroke is `currentColor` with no fill, so the card controls
// the colour, both themes are correct for free, and there is no image to fetch.
//
// They are decoration: every one is `aria-hidden`, because the city's name is already the heading
// and a screen reader announcing "India Gate" here would be noise.
import { type CSSProperties } from "react";

type Art = { name: string; d: string[] };

const LANDMARKS: Record<string, Art> = {
  delhi: {
    name: "India Gate",
    d: [
      "M10 56h76",
      "M20 56v-5h56v5",                                    // plinth
      "M26 51V24h44v27",                                   // piers
      "M39 51V36a9 9 0 0 1 18 0v15",                       // the arch
      "M23 24h50", "M25 20h46", "M28 16h40",               // stacked cornices
      "M40 16v-6h16v6",                                    // attic
      "M43 10h10",
      "M33 51V38", "M63 51V38",                            // pier reveals
    ],
  },
  mumbai: {
    name: "Gateway of India",
    d: [
      "M8 56h80",
      "M17 56v-4h62v4",
      "M32 52V27h32v25",                                   // central block
      "M41 52V38a7 7 0 0 1 14 0v14",                       // arch
      "M28 27h40",
      "M41 27q7-15 14 0",                                  // dome
      "M48 12V7",
      "M20 52V31h12M64 31h12v21",                          // flanking turrets
      "M20 31q6-8 12 0M64 31q6-8 12 0",                    // turret domes
      "M26 23v-4M70 23v-4",
      "M24 52V38M28 52V38M68 52V38M72 52V38",
    ],
  },
  hyderabad: {
    name: "Charminar",
    d: [
      "M10 56h76",
      "M20 56v-4h56v4",
      "M28 52V27h40v25",                                   // arcaded body
      "M34 52V43a6 6 0 0 1 12 0v9", "M50 52V43a6 6 0 0 1 12 0v9",
      "M28 39h40",                                         // storey band
      "M24 27h48",
      "M26 27V14M34 27V14M62 27V14M70 27V14",              // four minarets
      "M24 20h5M32 20h5M60 20h5M68 20h5",                  // balconies
      "M26 14q0-4 3-4t3 4M62 14q0-4 3-4t3 4",
      "M29 10V6M65 10V6",
    ],
  },
  jaipur: {
    name: "Hawa Mahal",
    d: [
      "M8 56h80",
      "M16 56V41h64v15",                                   // the stepped honeycomb facade
      "M23 41V31h50v10",
      "M31 31V21h34v10",
      "M38 21v-7h20v7",
      "M43 14q5-6 10 0",
      "M48 8V4",
      "M23 56v-8M31 56v-8M39 56v-8M48 56v-8M57 56v-8M65 56v-8M73 56v-8",   // window columns
      "M28 41v-6M36 41v-6M48 41v-6M60 41v-6M68 41v-6",
      "M36 31v-6M48 31v-6M60 31v-6",
    ],
  },
  bengaluru: {
    name: "Vidhana Soudha",
    d: [
      "M8 56h80",
      "M15 56v-4h66v4",
      "M20 52V31h56v21",
      "M17 31h62",
      "M27 52V36M35 52V36M43 52V36M53 52V36M61 52V36M69 52V36",   // colonnade
      "M20 40h56",
      "M38 31v-7h20v7",
      "M39 24q9-15 18 0",                                  // central dome
      "M48 9V4",
      "M23 31v-4h6v4M67 27h6v4",                           // flanking pavilions
    ],
  },
  kolkata: {
    name: "Victoria Memorial",
    d: [
      "M8 56h80",
      "M16 56v-4h64v4",
      "M24 52V33h48v19",
      "M20 33h56",
      "M31 52V38M41 52V38M55 52V38M65 52V38",              // colonnade
      "M40 33v-7h16v7",
      "M40 26q8-16 16 0",                                  // central dome
      "M48 10V5",
      "M26 33q5-8 10 0M60 33q5-8 10 0",                    // corner domes
      "M31 25v-3M65 25v-3",
    ],
  },
  chennai: {
    name: "Kapaleeshwarar gopuram",
    d: [
      "M18 56h60",
      "M26 56v-4h44v4",
      "M29 52V44h38v8",                                    // stepped gopuram
      "M31 44V36h34v8",
      "M34 36V28h28v8",
      "M37 28v-7h22v7",
      "M40 21v-6h16v6",
      "M42 15q6-5 12 0",                                   // barrel vault
      "M44 10V6M48 9V4M52 10V6",                           // kalasams
      "M38 52v-8M48 52v-8M58 52v-8",
      "M40 44v-8M56 44v-8",
    ],
  },
  pune: {
    name: "Shaniwar Wada",
    d: [
      "M10 56h76",
      "M18 56v-4h60v4",
      "M24 52V29h48v23",                                   // rampart
      "M39 52V38a9 9 0 0 1 18 0v14",                       // gateway arch
      "M24 29h48",
      "M24 29v-6h7v6M36 29v-6h7v6M53 29v-6h7v6M65 29v-6h7v6",     // battlements
      "M18 52V34h6M72 34h6v18",                            // bastions
      "M18 34v-5h6v5M72 29h6v5",
      "M33 52V36M63 52V36",
    ],
  },
  ahmedabad: {
    name: "Jama Masjid",
    d: [
      "M10 56h76",
      "M18 56v-4h60v4",
      "M28 52V29h40v23",
      "M39 52V39a9 9 0 0 1 18 0v13",                       // central arch
      "M32 52V44a4 4 0 0 1 8 0v8M56 52V44a4 4 0 0 1 8 0v8",       // side bays
      "M24 29h48",
      "M40 29q8-13 16 0",                                  // dome
      "M48 16v-4",
      "M25 29V14M71 29V14",                                // minarets
      "M23 21h5M69 21h5",                                  // balconies
      "M25 14q0-4 3-4t3 4M65 14q0-4 3-4t3 4",
    ],
  },
  lucknow: {
    name: "Rumi Darwaza",
    d: [
      "M14 56h68",
      "M22 56v-4h52v4",
      "M30 52V26h36v26",
      "M38 52V38q10-14 20 0v14",                           // the tall pointed arch
      "M26 26h44",
      "M40 26v-9h16v9",
      "M43 17v-6h10v6",
      "M43 11q5-6 10 0",                                   // lantern cupola
      "M48 5V1",
      "M34 52V32M62 52V32",
      "M34 26v-5h4v5M58 21h4v5",                           // side finials
    ],
  },
};

/** Cities with no drawing render nothing — no placeholder, no broken image. */
export function Monument({ city, width = 96, style, className = "" }: {
  city: string;
  width?: number;
  style?: CSSProperties;
  className?: string;
}) {
  const art = LANDMARKS[city];
  if (!art) return null;
  return (
    <svg
      viewBox="0 0 96 64"
      width={width}
      height={(width * 64) / 96}
      aria-hidden="true"
      focusable="false"
      className={className}
      style={{ flex: "none", display: "block", overflow: "visible", ...style }}
    >
      <g fill="none" stroke="currentColor" strokeWidth={1.5} strokeLinecap="round" strokeLinejoin="round">
        {art.d.map((d) => <path key={d} d={d} />)}
      </g>
    </svg>
  );
}

/** The landmark's name, for a tooltip where a card wants one. */
export const landmarkName = (city: string): string | undefined => LANDMARKS[city]?.name;
