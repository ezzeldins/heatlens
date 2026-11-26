import type { Config, Delta, Preview, Run, RunRequest } from "./types";

async function req<T>(path: string, init?: RequestInit): Promise<T> {
  const r = await fetch(path, init);
  const j = (await r.json().catch(() => ({}))) as { detail?: unknown };
  if (!r.ok) {
    const d = j.detail;
    throw new Error(typeof d === "string" ? d : JSON.stringify(d, null, 1));
  }
  return j as T;
}

const post = <T,>(path: string, body: unknown) =>
  req<T>(path, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body) });

export const api = {
  config: () => req<Config>("/api/config"),
  preview: (b: RunRequest) => post<Preview>("/api/preview", b),
  submit: (b: RunRequest) => post<{ activity_id: string; cached: boolean }>("/api/heatmap", b),
  status: (id: string) => req<Run>(`/api/status/${encodeURIComponent(id)}`),
  runs: () => req<Run[]>("/api/runs"),
  compare: (a: string, b: string) =>
    req<Delta>(`/api/compare?a=${encodeURIComponent(a)}&b=${encodeURIComponent(b)}`),
};
