export type BBox = [number, number, number, number]; // west, south, east, north

export interface Feature {
  type: "Feature";
  geometry: unknown;
  properties: Record<string, number>;
}
export interface FeatureCollection {
  type: "FeatureCollection";
  features: Feature[];
}

export interface Summary {
  n: number;
  min?: number;
  max?: number;
  mean?: number;
  quantile_breaks?: number[];
}

export interface RunRequest {
  bbox: BBox;
  granularity: number;
  start_date: string;
  start_time: string;
  end_time: string;
  analytic_type: string;
  threshold: number | null;
  direction: string | null;
}

export interface Run {
  activity_id: string;
  request: RunRequest;
  status: string;
  submitted_at?: number;
  n_tiles: number;
  summary: Summary;
  warning?: string;
  result?: { map_data: FeatureCollection };
}

export interface Delta {
  matched_tiles: number;
  delta_summary: Summary;
  map_data: FeatureCollection;
}

export interface Preview {
  area_sq_mi: number;
  warnings: string[];
  payload: unknown;
  already_run: boolean;
}

export interface Config {
  base_url: string;
  key_configured: boolean;
}

export type ViewMode = "gradient" | "zones" | "delta";
