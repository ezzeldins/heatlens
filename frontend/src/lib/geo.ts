import type { BBox, Feature, Summary } from "./types";

export const PRESETS: Record<string, BBox> = {
  "Downtown LA": [-118.275, 34.035, -118.225, 34.065],
  "Boyle Heights": [-118.225, 34.035, -118.185, 34.06],
  "Culver City": [-118.42, 33.985, -118.375, 34.015],
  Phoenix: [-112.095, 33.47, -112.08, 33.479],
  Houston: [-95.385, 29.745, -95.35, 29.77],
  Miami: [-80.215, 25.76, -80.185, 25.78],
};

export function areaSqMi([w, s, e, n]: BBox): number {
  const R = 6371008.8;
  const lam = (Math.abs(e - w) * Math.PI) / 180;
  const m2 = R * R * lam * Math.abs(Math.sin((n * Math.PI) / 180) - Math.sin((s * Math.PI) / 180));
  return m2 / 2589988.11;
}

export type Coords = [string, string, string, string];
export const toCoords = (b: BBox): Coords => b.map((v) => v.toFixed(5)) as Coords;
export function parseCoords(c: Coords): BBox | null {
  const v = c.map((x) => parseFloat(x));
  return v.every(Number.isFinite) ? (v as BBox) : null;
}

export function isTileInBBox(feature: Feature, bbox: BBox): boolean {
  const coords = (feature.geometry as { coordinates?: [number, number][][] })?.coordinates?.[0];
  if (!coords || coords.length === 0) return false;
  let sumLon = 0;
  let sumLat = 0;
  for (const [lon, lat] of coords) {
    sumLon += lon;
    sumLat += lat;
  }
  const cLon = sumLon / coords.length;
  const cLat = sumLat / coords.length;
  const [w, s, e, n] = bbox;
  const minLon = Math.min(w, e);
  const maxLon = Math.max(w, e);
  const minLat = Math.min(s, n);
  const maxLat = Math.max(s, n);
  return cLon >= minLon && cLon <= maxLon && cLat >= minLat && cLat <= maxLat;
}

export function summarizeTiles(features: Feature[]): Summary | null {
  const values = features
    .map((f) => f.properties?.value)
    .filter((v): v is number => typeof v === "number" && Number.isFinite(v));
  if (values.length === 0) return null;
  values.sort((a, b) => a - b);
  const sum = values.reduce((acc, v) => acc + v, 0);
  const q = (p: number) => {
    const i = (values.length - 1) * p;
    const lo = Math.floor(i);
    const hi = Math.ceil(i);
    return values[lo] + (values[hi] - values[lo]) * (i - lo);
  };
  return {
    n: values.length,
    min: values[0],
    max: values[values.length - 1],
    mean: sum / values.length,
    quantile_breaks: [q(0.2), q(0.4), q(0.6), q(0.8)],
  };
}
