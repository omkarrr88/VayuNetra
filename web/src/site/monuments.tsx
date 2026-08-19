// A landmark per city, drawn as line art.
//
// Original drawings, not traced or copied. One 96x72 grid, ground at y=64, one stroke weight, so the
// ten read as a set. `currentColor` with no fill, so the card owns the colour, both themes are
// correct for free, and there is no image request — the set is a few hundred bytes of path data.
//
// The first version of these failed because it drew every monument as the same generic block with a
// small arch. What makes each one recognisable is ONE dominant gesture, and the drawing has to spend
// its detail budget there: Charminar is four tall slender minarets, not a base with stubs; India
// Gate is a single enormous arch opening, not a building with a door; Rumi Darwaza is its lantern;
// Hawa Mahal is five stepped tiers of windows. Everything else is subordinate.
//
// Decoration only: every drawing is aria-hidden, because the city name is already the heading.
import { type CSSProperties } from "react";

type Art = { name: string; d: string[] };

const LANDMARKS: Record<string, Art> = {
  delhi: {
    name: "India Gate",
    // one monumental arch: the opening dominates, cornices step IN rather than out (projecting
    // wider than the piers made it read as a canopy on legs)
    d: [
      "M6 64h84",
      "M16 64v-6h64v6",
      "M26 58V20h44v38",                                    // the mass
      "M37 58V36a11 11 0 0 1 22 0v22",                      // THE arch
      "M24 20h48", "M27 15h42",                             // cornices, stepping in
      "M32 15v-5h32v5",
      "M40 10V5h16v5",                                      // attic
      "M33 58V38M63 58V38",
    ],
  },
  mumbai: {
    name: "Gateway of India",
    // The silhouette is a TALL central bay carrying one huge arch, with lower wings either side and
    // four slender corner turrets. Drawing it as a single wide block with a small arch — which is
    // what the first two attempts did — loses the thing that makes it the Gateway.
    d: [
      "M4 64h88",
      "M12 64v-5h72v5",
      "M34 59V20h28v39",                                    // the tall central bay
      "M39 59V40q9-15 18 0v19",                             // the great arch, ogee-headed
      "M31 20h34",                                          // its cornice
      "M40 20q8-13 16 0",                                   // dome set back behind the bay
      "M48 7V3",
      "M16 59V36h18M62 36h18v23",                           // the lower flanking wings
      "M13 36h23M60 36h23",
      "M21 59V44a4 4 0 0 1 8 0v15", "M67 59V44a4 4 0 0 1 8 0v15",   // wing arches
      "M18 36V22M32 36V22M64 36V22M78 36V22",               // four corner turrets
      "M15 22h6M29 22h6M61 22h6M75 22h6",
      "M15 22q3-6 6 0M29 22q3-6 6 0M61 22q3-6 6 0M75 22q3-6 6 0",   // turret domes
    ],
  },
  hyderabad: {
    name: "Charminar",
    // four tall slender minarets, each with two balcony rings and a small dome — this is the whole
    // identity of the building and gets most of the height
    d: [
      "M6 64h84",
      "M18 64v-5h60v5",
      "M26 59V36h44v23",
      "M32 59V48a7 7 0 0 1 14 0v11", "M50 59V48a7 7 0 0 1 14 0v11",
      "M26 45h44",
      "M22 36h52",
      "M27 36V14M35 36V14M61 36V14M69 36V14",               // shafts
      "M24 25h6M32 25h6M58 25h6M66 25h6",                   // balcony rings
      "M23 14h8M31 14h8M57 14h8M65 14h8",                   // dome bases
      "M23 14q4-7 8 0M31 14q4-7 8 0M57 14q4-7 8 0M65 14q4-7 8 0",   // domes, not spikes
    ],
  },
  jaipur: {
    name: "Hawa Mahal",
    // five stepped tiers, dense with tiny windows — the pyramid of jharokhas
    d: [
      "M4 64h88",
      "M12 64V46h72v18",
      "M19 46V34h58v12",
      "M27 34V23h42v11",
      "M35 23V14h26v9",
      "M42 14V8h12v6",
      "M44 8q4-5 8 0",
      "M48 3V1",
      "M18 64v-9M26 64v-9M34 64v-9M42 64v-9M50 64v-9M58 64v-9M66 64v-9M74 64v-9",   // tier 1 windows
      "M24 46v-7M32 46v-7M40 46v-7M48 46v-7M56 46v-7M64 46v-7M72 46v-7",
      "M32 34v-6M40 34v-6M48 34v-6M56 34v-6M64 34v-6",
      "M40 23v-5M48 23v-5M56 23v-5",
    ],
  },
  bengaluru: {
    name: "Vidhana Soudha",
    // wide neo-Dravidian block, projecting porch, big dome on a drum
    d: [
      "M4 64h88",
      "M10 64v-5h76v5",
      "M16 59V32h64v27",
      "M13 32h70",
      "M22 59V38M30 59V38M38 59V38M58 59V38M66 59V38M74 59V38",   // colonnade
      "M16 44h64",
      "M40 59V44h16v15",                                    // central porch
      "M38 32v-8h20v8",                                     // drum
      "M38 24q10-16 20 0",                                  // dome
      "M48 8V3",
      "M18 32v-5h7v5M71 27h7v5",                            // corner pavilions
    ],
  },
  kolkata: {
    name: "Victoria Memorial",
    // one great central dome on a tall drum, four smaller corner domes, low wide body
    d: [
      "M4 64h88",
      "M12 64v-5h72v5",
      "M20 59V38h56v21",
      "M16 38h64",
      "M27 59V43M35 59V43M61 59V43M69 59V43",
      "M40 38V28h16v10",                                    // drum
      "M39 28q9-18 18 0",                                   // central dome
      "M48 10V4",
      "M22 38V33h10v5M64 33h10v5",                          // corner pavilions
      "M22 33q5-9 10 0M64 33q5-9 10 0",                     // corner domes
      "M27 24v-4M69 24v-4",
    ],
  },
  chennai: {
    name: "Kapaleeshwarar gopuram",
    // a tall narrow tower of many diminishing tiers, crowned with kalasams
    d: [
      "M14 64h68",
      "M24 64v-5h40v5",
      "M26 59V50h36v9",
      "M28 50V42h32v8",
      "M30 42V34h28v8",
      "M32 34V26h24v8",
      "M34 26V19h20v7",
      "M36 19v-6h16v6",
      "M38 13q6-6 12 0",                                    // barrel-vaulted crown
      "M40 8V4M44 7V2M48 7V2M52 7V2",                       // kalasams
      "M35 59v-9M44 59v-9M53 59v-9",                        // tier niches
      "M37 50v-8M44 50v-8M51 50v-8",
      "M39 42v-8M49 42v-8",
    ],
  },
  pune: {
    name: "Shaniwar Wada",
    // the Delhi Darwaza: battlemented rampart, deep gateway, flanking bastions
    d: [
      "M6 64h84",
      "M16 64v-5h64v5",
      "M24 59V30h48v29",
      "M37 59V42q11-14 22 0v17",                            // the great gate
      "M42 59V48h12v11",                                    // gate leaf
      "M24 30h48",
      "M24 30v-7h8v7M38 30v-7h8v7M52 30v-7h8v7M64 30v-7h8v7",     // battlements
      "M14 59V36h10M72 36h10v23",                           // bastions
      "M14 36v-6h10v6M72 30h10v6",
      "M19 59V40M77 59V40",
    ],
  },
  ahmedabad: {
    name: "Jama Masjid",
    d: [
      "M6 64h84",
      "M16 64v-5h64v5",
      "M28 59V34h40v25",
      "M38 59V44a10 10 0 0 1 20 0v15",
      "M31 59V48a4 4 0 0 1 8 0v11", "M57 59V48a4 4 0 0 1 8 0v11",
      "M24 34h48",
      "M39 34q9-16 18 0",                                   // dome
      "M48 18v-5",
      "M22 34V16M74 34V16",                                 // minarets stop at the cornice
      "M19 26h6M71 26h6",
      "M18 16h8M70 16h8",
      "M18 16q4-7 8 0M70 16q4-7 8 0",
    ],
  },
  lucknow: {
    name: "Rumi Darwaza",
    d: [
      "M10 64h76",
      "M20 64v-5h56v5",
      "M28 59V30h40v29",
      "M36 59V42q12-18 24 0v17",                            // the towering arch
      "M24 30h48",
      "M38 30V20h20v10",
      "M42 20v-8h12v8",
      "M40 12h16",
      "M42 12q6-7 12 0",                                    // the lantern cupola
      "M48 5V2",
      "M32 59V36M64 59V36",
      "M30 30V25M66 30V25",
      "M27 25h6M63 25h6",
      "M27 25q3-5 6 0M63 25q3-5 6 0",
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
      viewBox="0 0 96 72"
      width={width}
      height={(width * 72) / 96}
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
