// Human place names for H3 cells — fully offline, from the ward boundaries we
// already ship (web/public/wards/{city}.geojson, datameet ODbL). A judge reads
// "Karol Bagh", not "883da11215fffff"; the raw cell id stays as a subtitle.
import { cellToLatLng } from "h3-js";

type WardProps = { ward_id: string; name: string };
export type Geometry =
  | { type: "Polygon"; coordinates: number[][][] }
  | { type: "MultiPolygon"; coordinates: number[][][][] };
type Feature = { properties: WardProps; geometry: Geometry };
type Collection = { features: Feature[] };

const wardCache = new Map<string, Promise<Feature[] | null>>();

function loadWards(city: string): Promise<Feature[] | null> {
  let p = wardCache.get(city);
  if (!p) {
    p = fetch(`/wards/${city}.geojson`)
      .then((r) => (r.ok ? (r.json() as Promise<Collection>) : null))
      .then((d) => d?.features ?? null)
      .catch(() => null);
    wardCache.set(city, p);
  }
  return p;
}

/** Ray-cast point-in-ring (lon/lat degrees — fine at city scale). */
function inRing(lng: number, lat: number, ring: number[][]): boolean {
  let inside = false;
  for (let i = 0, j = ring.length - 1; i < ring.length; j = i++) {
    const [xi, yi] = ring[i];
    const [xj, yj] = ring[j];
    if (yi > lat !== yj > lat && lng < ((xj - xi) * (lat - yi)) / (yj - yi) + xi) {
      inside = !inside;
    }
  }
  return inside;
}

export function inGeometry(lng: number, lat: number, g: Geometry): boolean {
  const polys = g.type === "Polygon" ? [g.coordinates] : g.coordinates;
  for (const poly of polys) {
    if (!poly.length) continue;
    if (!inRing(lng, lat, poly[0])) continue; // outside outer ring
    let inHole = false;
    for (let h = 1; h < poly.length; h++) {
      if (inRing(lng, lat, poly[h])) {
        inHole = true;
        break;
      }
    }
    if (!inHole) return true;
  }
  return false;
}

function centroidOf(g: Geometry): [number, number] {
  const ring = g.type === "Polygon" ? g.coordinates[0] : g.coordinates[0]?.[0] ?? [];
  let sx = 0;
  let sy = 0;
  for (const [x, y] of ring) {
    sx += x;
    sy += y;
  }
  return ring.length ? [sx / ring.length, sy / ring.length] : [0, 0];
}

export type Place = { label: string; approx: boolean };

/** Mumbai's BMC boundary file names its wards by letter alone — "S", "G/S", "K/E". An officer
 *  thinks in localities, so each letter is shown as the area it covers with the official code kept
 *  alongside it: "Bhandup (Ward S)". Nothing is replaced — the code an officer would quote in a
 *  notice is still on screen.
 *
 *  EDITORIAL MAPPING, not from the boundary file: these are the localities each BMC ward is
 *  commonly known by, not an official one-to-one designation. Every other city's file already
 *  carries usable names (Delhi "R. K. PURAM", Bengaluru "Shettihalli", Pune "Lohegaon - Vimannagar"),
 *  and Chennai/Kolkata give a numbered ward, which is a real administrative name and is left alone. */
const BMC_WARD_AREAS: Record<string, string> = {
  A: "Colaba & Fort", B: "Dongri & Sandhurst Road", C: "Kalbadevi & Marine Lines",
  D: "Malabar Hill & Grant Road", E: "Byculla",
  "F/S": "Parel & Sewri", "F/N": "Matunga & Sion",
  "G/S": "Worli & Prabhadevi", "G/N": "Dadar & Mahim",
  "H/E": "Bandra East & Khar", "H/W": "Bandra West & Santacruz West",
  "K/E": "Andheri East & Vile Parle East", "K/W": "Andheri West & Juhu",
  "P/S": "Goregaon", "P/N": "Malad",
  "R/S": "Kandivali", "R/C": "Borivali", "R/N": "Dahisar",
  L: "Kurla", "M/E": "Govandi & Mankhurd", "M/W": "Chembur",
  N: "Ghatkopar", S: "Bhandup & Vikhroli", T: "Mulund",
};

/** Chennai's boundary file names every ward "Ward N" with no locality anywhere in it. The GCC's
 *  fifteen zones ARE named places and each covers a documented, contiguous block of ward numbers,
 *  so a ward number resolves to the zone a resident would actually name. Shown as
 *  "Adyar (Ward 176)" — the zone to place it, the official ward number kept. */
const CHENNAI_ZONES: [number, number, string][] = [
  [1, 14, "Thiruvottiyur"], [15, 21, "Manali"], [22, 33, "Madhavaram"], [34, 48, "Tondiarpet"],
  [49, 63, "Royapuram"], [64, 78, "Thiru-Vi-Ka Nagar"], [79, 93, "Ambattur"], [94, 108, "Anna Nagar"],
  [109, 126, "Teynampet"], [127, 142, "Kodambakkam"], [143, 155, "Valasaravakkam"], [156, 167, "Alandur"],
  [168, 182, "Adyar"], [183, 191, "Perungudi"], [192, 200, "Sholinganallur"],
];

const TITLE = (n: string) =>
  n.toLowerCase().replace(/(^|[\s.\-/(])([a-z])/g, (_, p, c) => p + c.toUpperCase());

/** A ward's display name — the LOCALITY first, in every city.
 *
 *  The boundary files disagree about where the name lives. Eight of the ten carry a real locality,
 *  just buried behind a ward number ("Ward 91 Khairatabad", "48 RAMOL HATHIJAN",
 *  "01 Dhanori - Vishrantwadi") or trailing boilerplate ("Kempegowda Ward"). Digging it out is
 *  cleaning, not invention. Mumbai is lettered and Chennai is numbered, so those two get a mapping;
 *  Kolkata's file carries nothing but a number, and a number is what it keeps.
 */
function wardLabel(name: string, city?: string): string {
  const n = name.trim();

  if (city === "mumbai") {
    const area = BMC_WARD_AREAS[n.toUpperCase()];
    if (area) return `${area} (Ward ${n})`;
  }

  if (city === "chennai") {
    const num = Number(n.match(/(\d+)/)?.[1]);
    const zone = Number.isFinite(num) && CHENNAI_ZONES.find(([lo, hi]) => num >= lo && num <= hi);
    if (zone) return `${zone[2]} (Ward ${num})`;
  }

  // "Ward 91 Khairatabad" / "Ward 76 HAWA MAHAL" -> the locality, with the ward number kept
  const wardThenName = n.match(/^Ward\s+(\d+)\s+(.+)$/i);
  if (wardThenName) return `${TITLE(wardThenName[2])} (Ward ${wardThenName[1]})`;

  // "48 RAMOL HATHIJAN" / "01 Dhanori - Vishrantwadi" -> leading number is the ward id
  const numThenName = n.match(/^(\d+)\s+(.+)$/);
  if (numThenName) return `${TITLE(numThenName[2])} (Ward ${Number(numThenName[1])})`;

  // "Kempegowda Ward" -> "Kempegowda"
  const trailing = n.match(/^(.+?)\s+Ward$/i);
  if (trailing) return TITLE(trailing[1]);

  // a bare code with nothing to expand it (Kolkata's "Ward 93", a stray letter)
  if (/^Ward\s+\d+$/i.test(n)) return n;
  if (n.length <= 4) return `Ward ${n}`;

  // Delhi's file SHOUTS ("R. K. PURAM")
  return n === n.toUpperCase() ? TITLE(n) : n;
}

/** Resolve an H3 cell to its ward name ("Karol Bagh"), or "near <ward>" for
 *  metro-fringe cells outside the municipal boundary. Null when ward data is
 *  unavailable (caller keeps showing the raw cell id). */
export async function placeForCell(city: string, h3Cell: string): Promise<Place | null> {
  let lat: number;
  let lng: number;
  try {
    [lat, lng] = cellToLatLng(h3Cell);
  } catch {
    return null;
  }
  const wards = await loadWards(city);
  if (!wards?.length) return null;

  const exact = wards.find((f) => inGeometry(lng, lat, f.geometry));
  if (exact?.properties.name) return { label: wardLabel(exact.properties.name, city), approx: false };

  // fringe cell (bbox is the metro region; ward files cover the municipality):
  // nearest ward centroid within ~15 km reads as "near X"
  let best: { name: string; d2: number } | null = null;
  for (const f of wards) {
    const [cx, cy] = centroidOf(f.geometry);
    const dx = (cx - lng) * Math.cos((lat * Math.PI) / 180);
    const dy = cy - lat;
    const d2 = dx * dx + dy * dy;
    if (f.properties.name && (!best || d2 < best.d2)) best = { name: f.properties.name, d2 };
  }
  if (best && Math.sqrt(best.d2) * 111 <= 15) return { label: `near ${wardLabel(best.name, city)}`, approx: true };
  return null;
}
