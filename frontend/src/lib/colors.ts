// Chrome White-Hot Ramp: Charcoal -> Steel -> Chrome Silver -> Platinum -> Stark White
const STOPS = ["#18181b", "#3f3f46", "#71717a", "#a1a1aa", "#e4e4e7", "#ffffff"];

function hexToRgb(h: string): [number, number, number] {
  const n = parseInt(h.slice(1), 16);
  return [(n >> 16) & 255, (n >> 8) & 255, n & 255];
}
const mix = (a: number, b: number, t: number) => Math.round(a + (b - a) * t);

export function ramp(t: number): string {
  const x = Math.max(0, Math.min(1, t)) * (STOPS.length - 1);
  const i = Math.min(Math.floor(x), STOPS.length - 2);
  const f = x - i;
  const a = hexToRgb(STOPS[i]);
  const b = hexToRgb(STOPS[i + 1]);
  return `rgb(${mix(a[0], b[0], f)},${mix(a[1], b[1], f)},${mix(a[2], b[2], f)})`;
}

export const ZONE_NAMES = ["Low", "Moderate", "Elevated", "High", "Peak"];
export const ZONE_COLORS = [0.05, 0.28, 0.52, 0.78, 1].map(ramp);

export function zoneIndex(v: number, breaks: number[]): number {
  let i = 0;
  while (i < breaks.length && v > breaks[i]) i++;
  return i;
}

// Delta: stark monochrome (cooler = dark charcoal, 0 = neutral, warmer = pure white)
export function diverge(d: number, max: number): string {
  const t = Math.max(-1, Math.min(1, d / (max || 1)));
  const end = hexToRgb(t < 0 ? "#27272a" : "#ffffff");
  const mid = hexToRgb("#71717a");
  const k = Math.abs(t);
  return `rgb(${mix(mid[0], end[0], k)},${mix(mid[1], end[1], k)},${mix(mid[2], end[2], k)})`;
}
