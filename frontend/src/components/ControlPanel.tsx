import { Eye, GitCompareArrows, Play, Square } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { ToggleGroup, ToggleGroupItem } from "@/components/ui/toggle-group";
import { PRESETS, areaSqMi, parseCoords, type Coords } from "@/lib/geo";
import type { Run } from "@/lib/types";
import { cn } from "@/lib/utils";

export interface Form {
  date: string;
  start: string;
  end: string;
  gran: string;
  atype: string;
  thr: string;
  dir: string;
}
export interface Status {
  kind: "ok" | "warn" | "err" | "info";
  text: string;
}

interface Props {
  keyOk: boolean | null;
  coords: Coords;
  setCoords: (c: Coords) => void;
  pickPreset: (name: string) => void;
  drawing: boolean;
  setDrawing: (v: boolean) => void;
  form: Form;
  setForm: (f: Form) => void;
  busy: boolean;
  status: Status | null;
  payload: string | null;
  current: Run | null;
  runs: Run[];
  A: string | null;
  B: string | null;
  setA: (id: string) => void;
  setB: (id: string) => void;
  onPreview: () => void;
  onRun: () => void;
  onLoad: (id: string) => void;
  onCompare: () => void;
}

const dot: Record<Status["kind"], string> = {
  ok: "bg-white shadow-[0_0_4px_rgba(255,255,255,0.8)]",
  warn: "bg-zinc-400",
  err: "bg-zinc-100 ring-1 ring-zinc-400",
  info: "bg-zinc-300",
};

function Field({ label, children, className }: { label: string; children: React.ReactNode; className?: string }) {
  return (
    <div className={cn("space-y-1", className)}>
      <Label>{label}</Label>
      {children}
    </div>
  );
}

function Section({ title, hint, children }: { title: string; hint?: string; children: React.ReactNode }) {
  return (
    <section className="border-b border-zinc-800/80 px-5 py-3.5 last:border-b-0">
      <h2 className="font-mono text-[10px] font-bold uppercase tracking-widest text-zinc-400">{title}</h2>
      {hint && <p className="mt-0.5 font-mono text-[10px] text-zinc-600 leading-normal uppercase">{hint}</p>}
      <div className="mt-2.5 space-y-2.5">{children}</div>
    </section>
  );
}

const when = (r: Run) => {
  const q = r.request;
  return `${q.start_date} [${q.start_time} - ${q.end_time}]`;
};

export function ControlPanel(p: Props) {
  const bbox = parseCoords(p.coords);
  const area = bbox ? areaSqMi(bbox) : null;
  const s = p.current?.summary;
  const labels = ["WEST", "SOUTH", "EAST", "NORTH"];
  const done = (r: Run) => r.status.toLowerCase() === "completed";

  return (
    <aside className="pointer-events-auto flex max-h-full w-[380px] max-w-full flex-col overflow-hidden rounded-sm border border-zinc-800 bg-black/95 backdrop-blur-md shadow-2xl">
      <header className="border-b border-zinc-800 bg-zinc-950/60 px-5 py-3.5">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <div className="flex h-5 w-5 items-center justify-center rounded-xs bg-white text-[10px] font-black font-mono text-black shadow-xs">
              HL
            </div>
            <h1 className="font-mono text-xs font-bold uppercase tracking-wider text-white">FortyGuard API</h1>
          </div>
          <span className="rounded-xs border border-zinc-800 bg-zinc-900 px-1.5 py-0.5 font-mono text-[9px] uppercase tracking-widest text-zinc-400">
            40GUARD API
          </span>
        </div>
        <p className="mt-1 font-mono text-[10px] text-zinc-500 uppercase tracking-tight">
          STREET-LEVEL THERMAL ANALYTICS & COMPARISON
        </p>
        {p.keyOk === false && (
          <div className="mt-2 rounded-xs border border-zinc-700 bg-zinc-900 px-2 py-1 font-mono text-[10px] uppercase text-zinc-300">
            [ALERT] FORTYGUARD_API_KEY NOT CONFIGURED IN .ENV
          </div>
        )}
      </header>

      <div className="thin-scroll min-h-0 flex-1 overflow-y-auto">
        {s?.n ? (
          <div key={p.current?.activity_id} className="border-b border-zinc-800 bg-zinc-950/80 px-5 py-3">
            <div className="rounded-xs border border-zinc-800 bg-black p-3">
              <div className="flex items-center justify-between font-mono text-[10px] uppercase tracking-wider text-zinc-500">
                <span>THERMAL MEAN</span>
                <span>{s.n.toLocaleString()} TILES</span>
              </div>
              <div className="mt-1 flex items-baseline gap-1.5">
                <span className="font-mono text-3xl font-bold tracking-tight text-white tabular-nums">
                  {s.mean?.toFixed(1)}°
                </span>
                <span className="font-mono text-[10px] uppercase text-zinc-500">CELSIUS</span>
              </div>
              <div className="mt-2 flex items-center justify-between border-t border-zinc-900 pt-2 font-mono text-[10px] text-zinc-400">
                <span>
                  MIN: <strong className="font-bold text-white">{s.min?.toFixed(1)}°</strong>
                </span>
                <span>
                  MAX: <strong className="font-bold text-white">{s.max?.toFixed(1)}°</strong>
                </span>
              </div>
            </div>
          </div>
        ) : null}

        <Section title="01 // BOUNDS" hint="US contiguous. Choose preset, draw, or manual coordinates.">
          <div className="flex flex-wrap gap-1">
            {Object.keys(PRESETS).map((n) => (
              <button
                key={n}
                type="button"
                onClick={() => p.pickPreset(n)}
                className="rounded-xs border border-zinc-800 bg-zinc-950 px-2 py-0.5 font-mono text-[10px] font-semibold uppercase tracking-wider text-zinc-400 transition-colors hover:border-zinc-500 hover:bg-white hover:text-black focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-white"
              >
                {n}
              </button>
            ))}
          </div>

          <div className="grid grid-cols-2 gap-2">
            {labels.map((l, i) => (
              <Field key={l} label={l}>
                <Input
                  type="number"
                  step="any"
                  value={p.coords[i]}
                  onChange={(e) => {
                    const c = [...p.coords] as Coords;
                    c[i] = e.target.value;
                    p.setCoords(c);
                  }}
                />
              </Field>
            ))}
          </div>

          <div className="flex items-center justify-between pt-0.5">
            <Button
              variant={p.drawing ? "default" : "outline"}
              size="sm"
              onClick={() => p.setDrawing(!p.drawing)}
            >
              <Square /> {p.drawing ? "ABORT DRAW" : "DRAW BOUNDS"}
            </Button>
            <span className="font-mono text-[11px] font-bold text-zinc-300">
              {area !== null ? `${area.toFixed(2)} SQ MI` : ""}
            </span>
          </div>
        </Section>

        <Section title="02 // QUERY" hint="Times are local to selected geographical area.">
          <div className="grid grid-cols-3 gap-2">
            <Field label="DATE" className="col-span-3">
              <Input
                type="date"
                value={p.form.date}
                onChange={(e) => p.setForm({ ...p.form, date: e.target.value })}
              />
            </Field>
            <Field label="FROM" className="col-span-1">
              <Input
                value={p.form.start}
                onChange={(e) => p.setForm({ ...p.form, start: e.target.value })}
              />
            </Field>
            <Field label="TO" className="col-span-1">
              <Input
                value={p.form.end}
                onChange={(e) => p.setForm({ ...p.form, end: e.target.value })}
              />
            </Field>
            <Field label="THRESH °C" className="col-span-1">
              <Input
                type="number"
                step="any"
                value={p.form.thr}
                onChange={(e) => p.setForm({ ...p.form, thr: e.target.value })}
              />
            </Field>
          </div>

          <Field label="HOURS SPENT">
            <ToggleGroup
              type="single"
              value={p.form.dir}
              onValueChange={(v) => v && p.setForm({ ...p.form, dir: v })}
              aria-label="Direction"
            >
              <ToggleGroupItem value="above">Above threshold</ToggleGroupItem>
              <ToggleGroupItem value="below">Below threshold</ToggleGroupItem>
            </ToggleGroup>
          </Field>

          <Field label="TILE RESOLUTION">
            <ToggleGroup
              type="single"
              value={p.form.gran}
              onValueChange={(v) => v && p.setForm({ ...p.form, gran: v })}
              aria-label="Tile size"
            >
              {["60", "80", "100"].map((g) => (
                <ToggleGroupItem key={g} value={g}>
                  {g}M
                </ToggleGroupItem>
              ))}
            </ToggleGroup>
          </Field>

          <Field label="ANALYTIC TYPE">
            <Input
              value={p.form.atype}
              onChange={(e) => p.setForm({ ...p.form, atype: e.target.value })}
            />
          </Field>

          <div className="flex gap-2 pt-1">
            <Button variant="outline" size="sm" className="flex-1" onClick={p.onPreview} disabled={p.busy}>
              <Eye /> PREVIEW
            </Button>
            <Button variant="chrome" size="sm" className="flex-[1.4]" onClick={p.onRun} disabled={p.busy}>
              <Play /> RUN HEATMAP
            </Button>
          </div>

          {p.status && (
            <div className="rounded-xs border border-zinc-800 bg-zinc-950 p-2.5">
              <div className="flex items-start gap-2">
                <span className={cn("mt-1 h-1.5 w-1.5 shrink-0 rounded-xs", dot[p.status.kind])} />
                <p className="whitespace-pre-wrap break-words font-mono text-[10px] leading-relaxed text-zinc-300">
                  {p.status.text}
                </p>
              </div>
            </div>
          )}

          {p.payload && (
            <pre className="thin-scroll max-h-40 overflow-auto rounded-xs border border-zinc-800 bg-black p-2.5 font-mono text-[10px] leading-relaxed text-zinc-400">
              {p.payload}
            </pre>
          )}
        </Section>

        <Section title="03 // COMPARISON" hint="Compare two completed jobs matching area & resolution.">
          <div className="flex items-center gap-2">
            <Button
              size="sm"
              variant="outline"
              disabled={!p.A || !p.B || p.A === p.B}
              onClick={p.onCompare}
            >
              <GitCompareArrows /> COMPARE [A / B]
            </Button>
            <span className="font-mono text-[10px] uppercase text-zinc-400">
              A: {p.A ? p.A.slice(0, 6) : "–"} | B: {p.B ? p.B.slice(0, 6) : "–"}
            </span>
          </div>
        </Section>

        <Section title="04 // ARCHIVE" hint="Local cached runs. Reloading uses 0 credits.">
          {p.runs.length === 0 && (
            <p className="font-mono text-[10px] text-zinc-600 uppercase">NO ARCHIVED RUNS DETECTED</p>
          )}
          <ul className="space-y-1.5">
            {p.runs.map((r) => (
              <li
                key={r.activity_id}
                className={cn(
                  "rounded-xs border border-zinc-800 bg-zinc-950 p-2.5 transition-colors",
                  p.current?.activity_id === r.activity_id && "border-white bg-zinc-900/80",
                )}
              >
                <div className="flex items-baseline justify-between gap-2">
                  <span className="font-mono text-[11px] font-semibold text-zinc-200">{when(r)}</span>
                  <span className="font-mono text-[9px] uppercase text-zinc-500">
                    {done(r) ? `${r.n_tiles} TILES` : r.status}
                  </span>
                </div>
                <p className="mt-0.5 font-mono text-[10px] text-zinc-500 uppercase">
                  {r.request.analytic_type}
                  {r.request.threshold !== null ? `, ${r.request.direction} ${r.request.threshold}°C` : ""}, {r.request.granularity}M
                </p>
                <div className="mt-2 flex items-center gap-1.5">
                  <Button size="sm" variant="secondary" className="h-6 text-[10px]" onClick={() => p.onLoad(r.activity_id)}>
                    {done(r) ? "LOAD" : "STATUS"}
                  </Button>
                  {done(r) && (
                    <>
                      <Button
                        size="sm"
                        variant={p.A === r.activity_id ? "default" : "outline"}
                        className="h-6 px-2 text-[10px]"
                        onClick={() => p.setA(r.activity_id)}
                      >
                        SET A
                      </Button>
                      <Button
                        size="sm"
                        variant={p.B === r.activity_id ? "default" : "outline"}
                        className="h-6 px-2 text-[10px]"
                        onClick={() => p.setB(r.activity_id)}
                      >
                        SET B
                      </Button>
                    </>
                  )}
                </div>
              </li>
            ))}
          </ul>
        </Section>
      </div>
    </aside>
  );
}
