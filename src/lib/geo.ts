// Distances and "which hole am I on" for the game screen. Pure, so it is unit tested without a phone.

export interface LatLng {
  lat: number;
  lng: number;
}

export interface GeoHole {
  number: number;
  teeLat: number | null;
  teeLng: number | null;
  greenLat: number | null;
  greenLng: number | null;
}

const EARTH_M = 6_371_000;
const rad = (deg: number) => (deg * Math.PI) / 180;

/** Great-circle distance in meters. */
export function haversineMeters(a: LatLng, b: LatLng): number {
  const dLat = rad(b.lat - a.lat);
  const dLng = rad(b.lng - a.lng);
  const h = Math.sin(dLat / 2) ** 2 + Math.cos(rad(a.lat)) * Math.cos(rad(b.lat)) * Math.sin(dLng / 2) ** 2;
  return 2 * EARTH_M * Math.asin(Math.min(1, Math.sqrt(h)));
}

/** Distance in meters from p to the segment a-b (flat-earth projection, fine at golf-course scale). */
export function distanceToSegmentMeters(p: LatLng, a: LatLng, b: LatLng): number {
  const mPerDegLat = (Math.PI / 180) * EARTH_M;
  const mPerDegLng = mPerDegLat * Math.cos(rad(a.lat));
  const px = (p.lng - a.lng) * mPerDegLng;
  const py = (p.lat - a.lat) * mPerDegLat;
  const bx = (b.lng - a.lng) * mPerDegLng;
  const by = (b.lat - a.lat) * mPerDegLat;
  const len2 = bx * bx + by * by;
  const t = len2 === 0 ? 0 : Math.max(0, Math.min(1, (px * bx + py * by) / len2));
  return Math.hypot(px - t * bx, py - t * by);
}

/** Meters of slack in which we keep the previous hole (or step to the next) instead of flipping. */
export const HOLE_HYSTERESIS_METERS = 40;

export interface DetectedHole {
  hole: number;
  /** Distance to that hole's tee-to-green line. */
  distanceMeters: number;
}

/**
 * The hole whose tee-to-green line is nearest to the golfer. To stop the answer flipping while someone
 * walks between a green and the next tee, lastHole (then lastHole + 1) wins whenever it is within
 * HOLE_HYSTERESIS_METERS of the true nearest. Holes without coordinates are skipped.
 */
export function detectHole(position: LatLng, holes: GeoHole[], lastHole?: number | null): DetectedHole | null {
  const dists = new Map<number, number>();
  for (const h of holes) {
    if (h.teeLat == null || h.teeLng == null || h.greenLat == null || h.greenLng == null) continue;
    dists.set(h.number, distanceToSegmentMeters(position, { lat: h.teeLat, lng: h.teeLng }, { lat: h.greenLat, lng: h.greenLng }));
  }
  if (dists.size === 0) return null;
  let best = [...dists.entries()][0];
  for (const e of dists) if (e[1] < best[1]) best = e;

  if (lastHole != null) {
    for (const candidate of [lastHole, lastHole + 1]) {
      const d = dists.get(candidate);
      if (d !== undefined && d <= best[1] + HOLE_HYSTERESIS_METERS) return { hole: candidate, distanceMeters: d };
    }
  }
  return { hole: best[0], distanceMeters: best[1] };
}

export function isAtCourse(position: LatLng, course: LatLng, geofenceMeters: number): boolean {
  return haversineMeters(position, course) <= geofenceMeters;
}
