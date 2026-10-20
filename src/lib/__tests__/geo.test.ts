import { describe, expect, it } from "vitest";
import { detectHole, distanceToSegmentMeters, haversineMeters, isAtCourse, type GeoHole } from "../geo";

const M_LAT = 111_320;
const base = { lat: 33.89, lng: -117.92 };
const M_LNG = M_LAT * Math.cos((base.lat * Math.PI) / 180);
const at = (xMeters: number, yMeters: number) => ({ lat: base.lat + yMeters / M_LAT, lng: base.lng + xMeters / M_LNG });

// Three holes in a row heading east, 400 m long, tees 40 m past the previous green (like the seeded layout).
const holes: GeoHole[] = [0, 1, 2].map((i) => {
  const tee = at(i * 440, 0);
  const green = at(i * 440 + 400, 0);
  return { number: i + 1, teeLat: tee.lat, teeLng: tee.lng, greenLat: green.lat, greenLng: green.lng };
});

describe("haversineMeters", () => {
  it("is zero for the same point and about 111 km per degree of latitude", () => {
    expect(haversineMeters(base, base)).toBe(0);
    const d = haversineMeters(base, { lat: base.lat + 1, lng: base.lng });
    expect(d).toBeGreaterThan(111_000);
    expect(d).toBeLessThan(111_400);
  });
});

describe("distanceToSegmentMeters", () => {
  it("measures to the line, and to the end point beyond it", () => {
    expect(distanceToSegmentMeters(at(200, 30), at(0, 0), at(400, 0))).toBeCloseTo(30, 0);
    expect(distanceToSegmentMeters(at(-50, 0), at(0, 0), at(400, 0))).toBeCloseTo(50, 0);
  });
  it("handles a zero-length segment", () => {
    expect(distanceToSegmentMeters(at(3, 4), at(0, 0), at(0, 0))).toBeCloseTo(5, 0);
  });
});

describe("detectHole", () => {
  it("picks the nearest tee-to-green line", () => {
    expect(detectHole(at(10, 5), holes)?.hole).toBe(1);
    expect(detectHole(at(660, -10), holes)?.hole).toBe(2);
    expect(detectHole(at(1000, 0), holes)?.hole).toBe(3);
  });

  it("stays on the last hole while walking toward the next tee", () => {
    // 435 m: 35 m past hole 1's green and 5 m before hole 2's tee, so hole 2 is nearest by 35 m or less.
    expect(detectHole(at(435, 0), holes, 1)?.hole).toBe(1);
    expect(detectHole(at(405, 0), holes, 1)?.hole).toBe(1);
  });

  it("moves to the next hole once clearly on it", () => {
    expect(detectHole(at(600, 0), holes, 1)?.hole).toBe(2);
  });

  it("never jumps two holes ahead from the last hole when that is within the slack", () => {
    expect(detectHole(at(875, 0), holes, 2)?.hole).toBe(2);
    expect(detectHole(at(1000, 0), holes, 2)?.hole).toBe(3);
  });

  it("ignores holes without coordinates and returns null with none", () => {
    expect(detectHole(at(0, 0), [{ number: 1, teeLat: null, teeLng: null, greenLat: null, greenLng: null }])).toBeNull();
    expect(detectHole(at(0, 0), [])).toBeNull();
  });
});

describe("isAtCourse", () => {
  it("uses the geofence radius", () => {
    expect(isAtCourse(at(500, 0), base, 800)).toBe(true);
    expect(isAtCourse(at(900, 0), base, 800)).toBe(false);
  });
});
