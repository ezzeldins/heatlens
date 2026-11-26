import { ZONE_COLORS, ZONE_NAMES, diverge, ramp } from "@/lib/colors";
import type { Delta, Run, Summary, ViewMode } from "@/lib/types";

interface Props {
  view: ViewMode;
  run: Run | null;
  summary?: Summary | null;
  delta: Delta | null;
}

const fmt = (v: number | undefined) => (v === undefined ? "–" : v.toFixed(1));

export function Legend({ view, run, summary, delta }: Props) {
  if (view === "delta" && delta) {
    const m = Math.max(Math.abs(delta.delta_summary.min ?? 0), Math.abs(delta.delta_summary.max ?? 0), 0.1);
    return (
      <div className="w-56 rounded-2xl border border-white/10 bg-black/80 p-3.5 shadow-2xl backdrop-blur-2xl ring-1 ring-white/[0.05]">
        <p className="font-impact text-sm tracking-wide text-white">Change (A to B)</p>
        <div
          className="mt-2.5 h-1.5 rounded-full"
          style={{ background: `linear-gradient(90deg, ${diverge(-m, m)}, ${diverge(0, m)}, ${diverge(m, m)})` }}
        />
        <div className="mt-1.5 flex justify-between text-[11px] text-zinc-400">
          <span>Cooler −{m.toFixed(1)}°</span>
          <span>Warmer +{m.toFixed(1)}°</span>
        </div>
        <p className="mt-2 border-t border-white/[0.06] pt-2 text-[11px] text-zinc-500">
          {delta.matched_tiles.toLocaleString()} tiles compared
        </p>
      </div>
    );
  }

  const s = summary ?? run?.summary;
  if (!s?.n || !run) return null;

  const isExceedance = run.request.analytic_type === "exceedance";
  const u = isExceedance ? "h" : "°";

  if (view === "zones") {
    const edges = [s.min ?? 0, ...(s.quantile_breaks ?? []), s.max ?? 0];
    return (
      <div className="w-56 rounded-2xl border border-white/10 bg-black/80 p-3.5 shadow-2xl backdrop-blur-2xl ring-1 ring-white/[0.05]">
        <p className="font-impact text-sm tracking-wide text-white">
          {isExceedance ? "Exceedance tiers" : "Temperature tiers"}
        </p>
        <ul className="mt-2.5 space-y-1.5">
          {ZONE_NAMES.map((n, i) => (
            <li key={n} className="flex items-center gap-2 text-xs">
              <span
                className="h-2 w-2 rounded-full shrink-0"
                style={{ background: ZONE_COLORS[i] }}
              />
              <span className="flex-1 text-[11px] font-medium text-zinc-300">{n}</span>
              <span className="text-[11px] text-zinc-500 tabular-nums">
                {fmt(edges[i])} - {fmt(edges[i + 1])}{u}
              </span>
            </li>
          ))}
        </ul>
      </div>
    );
  }

  return (
    <div className="w-56 rounded-2xl border border-white/10 bg-black/80 p-3.5 shadow-2xl backdrop-blur-2xl ring-1 ring-white/[0.05]">
      <div className="flex items-center justify-between">
        <p className="font-impact text-sm tracking-wide text-white">Gradient</p>
        <span className="text-[11px] text-zinc-500">{run.request.analytic_type}</span>
      </div>
      <div
        className="mt-2.5 h-1.5 rounded-full"
        style={{ background: `linear-gradient(90deg, ${[0, 0.2, 0.4, 0.6, 0.8, 1].map(ramp).join(",")})` }}
      />
      <div className="mt-1.5 flex justify-between text-[11px] text-zinc-400 tabular-nums">
        <span>{fmt(s.min)}{u}</span>
        <span>{fmt(s.max)}{u}</span>
      </div>
    </div>
  );
}
