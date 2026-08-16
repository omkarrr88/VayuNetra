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

/** BMC wards are lettered ("K/E") — a bare letter reads broken, so short
 *  administrative codes become "Ward K/E"; real locality names pass through. */
function wardLabel(name: string): string {
  const n = name.trim();
  if (n.length <= 4) return `Ward ${n}`;
  // Delhi's file SHOUTS ("R. K. PURAM") — title-case long all-caps names
  if (n === n.toUpperCase()) {
    return n.toLowerCase().replace(/(^|[\s.\-/(])([a-z])/g, (_, p, c) => p + c.toUpperCase());
  }
  return n;
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
  if (exact?.properties.name) return { label: wardLabel(exact.properties.name), approx: false };

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
  if (best && Math.sqrt(best.d2) * 111 <= 15) return { label: `near ${wardLabel(best.name)}`, approx: true };
  return null;
}
