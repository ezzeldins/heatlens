import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import type L from "leaflet";
import { ControlPanel, type Form, type Status } from "@/components/ControlPanel";
import { Legend } from "@/components/Legend";
import { MapView } from "@/components/MapView";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { ToggleGroup, ToggleGroupItem } from "@/components/ui/toggle-group";
import { api } from "@/lib/api";
import { ZONE_COLORS, diverge, ramp, zoneIndex } from "@/lib/colors";
import { PRESETS, isTileInBBox, parseCoords, summarizeTiles, toCoords, type Coords } from "@/lib/geo";
import type { BBox, Delta, Feature, Run, RunRequest, ViewMode } from "@/lib/types";

const defaultForm = (): Form => {
  const d = new Date();
  d.setDate(d.getDate() - 14);
  return {
    date: d.toISOString().slice(0, 10),
    start: "06:00",
    end: "18:00",
    gran: "100",
    atype: "exceedance",
    thr: "30",
    dir: "above",
  };
};

export default function App() {
  const [keyOk, setKeyOk] = useState<boolean | null>(null);
  const [coords, setCoords] = useState<Coords>(toCoords(PRESETS["Downtown LA"]));
  const [form, setForm] = useState<Form>(defaultForm);
  const [runs, setRuns] = useState<Run[]>([]);
  const [current, setCurrent] = useState<Run | null>(null);
  const [delta, setDelta] = useState<Delta | null>(null);
  const [A, setA] = useState<string | null>(null);
  const [B, setB] = useState<string | null>(null);
  const [view, setView] = useState<ViewMode>("gradient");
  const [status, setStatus] = useState<Status | null>(null);
  const [payload, setPayload] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [drawing, setDrawing] = useState(false);
  const [fit, setFit] = useState<{ key: number; box: BBox | null }>({ key: 0, box: PRESETS["Downtown LA"] });
  const [confirm, setConfirm] = useState<{ body: RunRequest; area: number; warnings: string[] } | null>(null);
  const alive = useRef(true);

  const bbox = useMemo(() => parseCoords(coords), [coords]);
  const flyTo = (box: BBox) => setFit((f) => ({ key: f.key + 1, box }));

  // Dynamically filter active run tiles based on the current bounding box
  const selectedTiles = useMemo(() => {
    const feats = current?.result?.map_data?.features;
    if (!feats || feats.length === 0 || !bbox) return [];
    return feats.filter((f) => isTileInBBox(f, bbox));
  }, [current, bbox]);

  const activeSummary = useMemo(() => {
    if (selectedTiles.length > 0) {
      return summarizeTiles(selectedTiles);
    }
    return null;
  }, [selectedTiles]);

  const loadRuns = useCallback(async () => {
    try {
      setRuns(await api.runs());
    } catch {
      /* Saved runs list is a convenience; silent failure */
    }
  }, []);

  useEffect(() => {
    alive.current = true;
    api.config().then((c) => setKeyOk(c.key_configured)).catch(() => setKeyOk(false));
    loadRuns();
    return () => {
      alive.current = false;
    };
  }, [loadRuns]);

  const body = (): RunRequest => {
    if (!bbox) throw new Error("Set an area first: choose a preset, draw on map, or enter bounds.");
    const t = form.thr.trim();
    return {
      bbox,
      granularity: +form.gran,
      start_date: form.date,
      start_time: form.start,
      end_time: form.end,
      analytic_type: form.atype.trim(),
      threshold: t === "" ? null : +t,
      direction: form.dir,
    };
  };

  const show = (r: Run) => {
    setCurrent(r);
    setView("gradient");
    const q = r.request;
    setCoords(toCoords(q.bbox));
    setForm({
      date: q.start_date,
      start: q.start_time,
      end: q.end_time,
      gran: String(q.granularity),
      atype: q.analytic_type,
      thr: q.threshold === null ? "" : String(q.threshold),
      dir: q.direction ?? "above",
    });
    flyTo(q.bbox);
  };

  const onPreview = async () => {
    try {
      const p = await api.preview(body());
      setPayload(JSON.stringify(p.payload, null, 2));
      const first = p.already_run
        ? "Identical query already cached on disk. Will open without using credits."
        : "New query; will consume API credits.";
      setStatus({
        kind: p.warnings.length ? "warn" : "ok",
        text: [`${p.area_sq_mi.toFixed(2)} sq mi. ${first}`, ...p.warnings].join("\n"),
      });
    } catch (e) {
      setStatus({ kind: "err", text: (e as Error).message });
    }
  };

  const poll = async (id: string) => {
    const t0 = Date.now();
    while (alive.current && Date.now() - t0 < 10 * 60_000) {
      const r = await api.status(id);
      if (r.status.toLowerCase() === "completed") {
        show(r);
        setStatus({
          kind: r.warning ? "warn" : "ok",
          text: `${r.warning ? r.warning + "\n" : ""}Completed: ${r.n_tiles.toLocaleString()} tiles loaded.`,
        });
        return;
      }
      setStatus({
        kind: "info",
        text: `Processing: ${r.status} (${Math.round((Date.now() - t0) / 1000)}s elapsed). Polling is free.`,
      });
      await new Promise((res) => setTimeout(res, 4000));
    }
    if (alive.current) {
      setStatus({
        kind: "warn",
        text: "Still processing after 10 minutes. Saved under 'Saved runs' to check again later.",
      });
    }
  };

  const submit = async (b: RunRequest) => {
    setBusy(true);
    try {
      const { activity_id, cached } = await api.submit(b);
      setStatus({ kind: "info", text: cached ? "Opening cached result from disk." : "Submitted job. Polling for results..." });
      await poll(activity_id);
    } catch (e) {
      setStatus({ kind: "err", text: (e as Error).message });
    } finally {
      setBusy(false);
      loadRuns();
    }
  };

  const onRun = async () => {
    try {
      const b = body();
      const p = await api.preview(b);
      if (p.already_run) return submit(b);
      setConfirm({ body: b, area: p.area_sq_mi, warnings: p.warnings });
    } catch (e) {
      setStatus({ kind: "err", text: (e as Error).message });
    }
  };

  const onLoad = async (id: string) => {
    try {
      const r = await api.status(id);
      if (r.status.toLowerCase() === "completed") show(r);
      setStatus({ kind: "info", text: `Status: ${r.status} (${r.n_tiles} tiles).` });
    } catch (e) {
      setStatus({ kind: "err", text: (e as Error).message });
    } finally {
      loadRuns();
    }
  };

  const onCompare = async () => {
    if (!A || !B) return;
    try {
      const d = await api.compare(A, B);
      setDelta(d);
      setView("delta");
      const s = d.delta_summary;
      setStatus({
        kind: "ok",
        text: `B minus A across ${s.n} tiles: mean ${s.mean?.toFixed(2)}°, range [${s.min?.toFixed(2)}°, ${s.max?.toFixed(2)}°].`,
      });
      const first = d.map_data.features[0];
      if (first && bbox) flyTo(bbox);
    } catch (e) {
      setStatus({ kind: "err", text: (e as Error).message });
    }
  };

  // Map data and styling for active view
  const data = view === "delta" && delta ? delta.map_data : current?.result?.map_data ?? null;
  const summary = current?.summary;
  const dMax = delta ? Math.max(Math.abs(delta.delta_summary.min ?? 0), Math.abs(delta.delta_summary.max ?? 0), 0.1) : 1;

  const style = (f: Feature): L.PathOptions => {
    if (view === "delta" && delta) {
      return { fillColor: diverge(f.properties.delta, dMax), fillOpacity: 0.82, weight: 0, stroke: false };
    }
    const v = f.properties.value;
    const min = summary?.min ?? 0;
    const span = (summary?.max ?? 1) - min || 1;
    const fill = view === "zones" ? ZONE_COLORS[zoneIndex(v, summary?.quantile_breaks ?? [])] : ramp((v - min) / span);
    return { fillColor: fill, fillOpacity: 0.85, weight: 0, stroke: false };
  };

  const isExceedance = current?.request.analytic_type === "exceedance";
  const tip = (f: Feature) =>
    view === "delta" && delta
      ? `A: ${f.properties.a.toFixed(1)}° · B: ${f.properties.b.toFixed(1)}° (Change ${f.properties.delta > 0 ? "+" : ""}${f.properties.delta.toFixed(1)}°)`
      : `Tile ${f.properties.tile_id}: ${f.properties.value}${isExceedance ? " hrs" : "°C"}`;

  const layerKey = `${view}:${current?.activity_id ?? ""}:${delta ? A + "-" + B : ""}`;

  return (
    <div className="relative h-full w-full overflow-hidden bg-background">
      <MapView
        bbox={bbox}
        onBBox={(b) => setCoords(toCoords(b))}
        drawing={drawing}
        onDrawEnd={() => setDrawing(false)}
        data={data}
        layerKey={layerKey}
        style={style}
        tip={tip}
        fit={fit}
      />

      <div className="pointer-events-none absolute inset-0 z-[1200] flex flex-col gap-4 p-4 md:flex-row">
        <div className="flex max-h-full min-h-0 md:h-full">
          <ControlPanel
            keyOk={keyOk}
            coords={coords}
            setCoords={setCoords}
            pickPreset={(n) => {
              setCoords(toCoords(PRESETS[n]));
              flyTo(PRESETS[n]);
            }}
            drawing={drawing}
            setDrawing={setDrawing}
            form={form}
            setForm={setForm}
            busy={busy}
            status={status}
            payload={payload}
            current={current}
            activeSummary={activeSummary}
            totalTilesCount={current?.summary?.n ?? 0}
            runs={runs}
            A={A}
            B={B}
            setA={setA}
            setB={setB}
            onPreview={onPreview}
            onRun={onRun}
            onLoad={onLoad}
            onCompare={onCompare}
          />
        </div>

        <div className="pointer-events-none relative hidden flex-1 md:block">
          {current && (
            <div className="pointer-events-auto absolute left-1/2 top-4 -translate-x-1/2">
              <div className="rounded-full border border-white/10 bg-black/80 p-1 shadow-2xl backdrop-blur-2xl ring-1 ring-white/[0.05]">
                <ToggleGroup
                  type="single"
                  value={view}
                  onValueChange={(v) => v && setView(v as ViewMode)}
                  aria-label="Map view mode"
                  className="w-auto gap-1 border-0 bg-transparent p-0"
                >
                  <ToggleGroupItem value="gradient" className="h-7 rounded-full px-3.5 text-xs font-medium">
                    Gradient
                  </ToggleGroupItem>
                  <ToggleGroupItem value="zones" className="h-7 rounded-full px-3.5 text-xs font-medium">
                    Tiers
                  </ToggleGroupItem>
                  {delta && (
                    <ToggleGroupItem value="delta" className="h-7 rounded-full px-3.5 text-xs font-medium">
                      Change
                    </ToggleGroupItem>
                  )}
                </ToggleGroup>
              </div>
            </div>
          )}

          <div className="pointer-events-auto absolute bottom-6 right-4">
            <Legend view={view} run={current} summary={activeSummary} delta={delta} />
          </div>
        </div>
      </div>

      <AlertDialog open={confirm !== null} onOpenChange={(o) => !o && setConfirm(null)}>
        <AlertDialogContent>
          <AlertDialogTitle>Run heatmap?</AlertDialogTitle>
          <AlertDialogDescription>
            This query covers {confirm ? confirm.area.toFixed(2) : ""} sq mi and will consume FortyGuard API credits.
            {confirm?.warnings.map((w) => (
              <span key={w} className="mt-2 block text-xs text-amber-300">
                Warning: {w}
              </span>
            ))}
          </AlertDialogDescription>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={() => {
                const b = confirm?.body;
                setConfirm(null);
                if (b) void submit(b);
              }}
            >
              Run heatmap
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
