const env = (import.meta as unknown as { env?: Record<string, string | undefined> }).env;

const DEFAULT_API = env?.PROD ? "https://quantum-horizon-api.vercel.app" : "http://localhost:8000";

export const API_BASE = (env?.VITE_API_BASE || DEFAULT_API).replace(/\/$/, "");

export type Confidence = "measured" | "marginal" | "not-measurable" | "below-noise" | "indicative";

export interface Resolved {
  query: string;
  name: string;
  simbad_id: string | null;
  ra: number;
  dec: number;
  pmra: number;
  pmdec: number;
  parallax: number | null;
  epoch: string;
  source: string;
  featured: string | null;
}

export interface FrameInfo {
  plane_id: string;
  mjd: number;
  date: string;
  release: string;
  uri: string;
  wavelength_um: number | null;
  status: "used" | "failed" | "off-detector";
  source: "s3" | "cutout" | "cache" | null;
  flags_at_target: string[];
  error: string | null;
}

export interface PassInfo {
  index: number;
  start: string;
  end: string;
  mid_mjd: number;
  mid_date: string;
  frames_used: number;
  frames_total: number;
  wavelength_min_um: number | null;
  wavelength_max_um: number | null;
  predicted_px: [number, number] | null;
  image: string;
}

export interface PassMeasurement {
  index: number;
  confidence: Confidence;
  measured_px: [number, number] | null;
  measured_ra: number | null;
  measured_dec: number | null;
  sigma_arcsec: number | null;
  scatter_arcsec: number | null;
  snr: number | null;
  flux: number | null;
  flux_err: number | null;
  frames_fit: number;
  frames_rejected: number;
  offset_from_predicted_arcsec: number | null;
}

export interface Motion {
  confidence: Confidence;
  baseline_years: number;
  from_pass: number;
  to_pass: number;
  measured_arcsec: number | null;
  sigma_arcsec: number | null;
  measured_pa_deg: number | null;
  measured_arcsec_per_year: number | null;
  predicted_arcsec: number | null;
  predicted_pa_deg: number | null;
  predicted_arcsec_per_year: number | null;
  difference_arcsec: number | null;
  significance: number | null;
  pixels: number | null;
  summary: string;
}

export interface Measurement {
  passes: PassMeasurement[];
  motion: Motion | null;
  photometry_confidence: Confidence;
  photometry_note: string | null;
  aperture_arcsec: number;
  method: string;
}

export interface Grid {
  ra: number;
  dec: number;
  width_px: number;
  height_px: number;
  pixel_arcsec: number;
  fov_deg: number;
  north_up: boolean;
  east_left: boolean;
}

export interface FramesResponse {
  target: Resolved;
  detector: string;
  grid: Grid;
  passes: PassInfo[];
  difference_image: string | null;
  frames: FrameInfo[];
  releases: string[];
  notes: string[];
  measurement: Measurement | null;
  elapsed_s: number;
  from_cache: boolean;
}

export interface SpectrumPoint {
  wavelength_um: number;
  flux: number;
  flux_err: number;
  frames: number;
  blanked_fraction: number;
  suspect: boolean;
}

export interface SpectrumResponse {
  target: Resolved;
  detector: string;
  ra: number;
  dec: number;
  px: [number, number];
  aperture_arcsec: number;
  series: { pass_index: number; label: string; points: SpectrumPoint[] }[];
  notes: string[];
  elapsed_s: number;
}

export interface LightCurvePoint {
  date: string;
  mjd: number;
  wavelength_um: number | null;
  flux: number;
  flux_err: number;
  snr: number;
  pass_index: number;
  flagged_fraction: number;
  suspect: boolean;
}

export interface LightCurveResponse {
  target: Resolved;
  detector: string;
  bands: {
    label: string;
    wavelength_min_um: number;
    wavelength_max_um: number;
    points: LightCurvePoint[];
    change_percent: number | null;
    change_sigma: number | null;
  }[];
  blanked_fraction: number;
  confidence: Confidence;
  summary: string;
  notes: string[];
  elapsed_s: number;
}

export interface CatalogSource {
  source_id: string;
  g_mag: number | null;
  pm_total_arcsec_per_year: number;
  positions: Record<string, [number, number]>;
  is_target: boolean;
}

export interface CatalogResponse {
  provider: string;
  limit_mag: number;
  sources: CatalogSource[];
  notes: string[];
  elapsed_s: number;
}

export interface MoverCandidate {
  label: "known" | "unexplained" | "unchecked";
  explanation: string;
  catalogue_match: string | null;
  catalogue_g_mag: number | null;
  speed_arcsec_per_year: number;
  speed_error_arcsec_per_year: number;
  catalogue_speed_arcsec_per_year: number | null;
  position_angle_deg: number;
  significance: number;
  snr: number;
  ra: number;
  dec: number;
  passes: number[];
  track_px: Record<string, [number, number]>;
}

export interface MoversResponse {
  target: Resolved;
  detector: string;
  candidates: MoverCandidate[];
  catalogue: string;
  searched: number;
  rejected: Record<string, number>;
  limit_arcsec_per_year: number | null;
  notes: string[];
  elapsed_s: number;
}

export interface FlagReference {
  bits: { bit: number; name: string; meaning: string | null; treatment: string }[];
  transient_rule: string;
  source: string;
}

export class ApiError extends Error {
  status: number;

  constructor(status: number, message: string) {
    super(message);
    this.status = status;
    this.name = "ApiError";
  }
}

export function imageUrl(path: string): string {
  return path.startsWith("http") || path.startsWith("data:") ? path : `${API_BASE}${path}`;
}

export interface TargetQuery {
  target: string | null;
  ra: number | null;
  dec: number | null;
  detector: string;
  fovDeg: number;
}

function params(query: TargetQuery, extra: Record<string, string | number> = {}): URLSearchParams {
  const search = new URLSearchParams();
  if (query.target) search.set("target", query.target);
  if (query.ra !== null && query.dec !== null) {
    search.set("ra", String(query.ra));
    search.set("dec", String(query.dec));
  }
  search.set("det", query.detector);
  search.set("fov", String(query.fovDeg));
  for (const [key, value] of Object.entries(extra)) search.set(key, String(value));
  return search;
}

async function get<T>(path: string, search: URLSearchParams, signal?: AbortSignal): Promise<T> {
  const response = await fetch(`${API_BASE}${path}?${search.toString()}`, { signal });
  if (!response.ok) {
    let detail = `Request failed with status ${response.status}`;
    try {
      const body = (await response.json()) as { detail?: string };
      if (body.detail) detail = body.detail;
    } catch {
      // the server returned no JSON body; the status line is all we have
    }
    throw new ApiError(response.status, detail);
  }
  return (await response.json()) as T;
}

export function fetchFrames(query: TargetQuery, signal?: AbortSignal): Promise<FramesResponse> {
  return get<FramesResponse>("/api/frames", params(query), signal);
}

export function fetchSpectrum(
  query: TargetQuery,
  pick: { x: number; y: number } | null,
  signal?: AbortSignal,
): Promise<SpectrumResponse> {
  const extra: Record<string, string> = pick ? { x: pick.x.toFixed(2), y: pick.y.toFixed(2) } : {};
  return get<SpectrumResponse>("/api/spectrum", params(query, extra), signal);
}

export function fetchLightCurve(query: TargetQuery, signal?: AbortSignal): Promise<LightCurveResponse> {
  return get<LightCurveResponse>("/api/lightcurve", params(query), signal);
}

export function fetchDifference(
  query: TargetQuery,
  a: number,
  b: number,
  signal?: AbortSignal,
): Promise<{ image: string }> {
  return get<{ image: string }>("/api/difference", params(query, { a, b }), signal);
}

export function fetchCatalog(query: TargetQuery, signal?: AbortSignal): Promise<CatalogResponse> {
  return get<CatalogResponse>("/api/catalog", params(query), signal);
}

export function fetchMovers(query: TargetQuery, signal?: AbortSignal): Promise<MoversResponse> {
  return get<MoversResponse>("/api/movers", params(query), signal);
}

export function fetchFlagReference(signal?: AbortSignal): Promise<FlagReference> {
  return get<FlagReference>("/api/flags", new URLSearchParams(), signal);
}

export interface NamedObject {
  name: string;
  display: string;
  ra: number;
  dec: number;
  kind: string;
  refs: number;
}

export interface NearbyResponse {
  ra: number;
  dec: number;
  radius: number;
  objects: NamedObject[];
  source: string;
}

export function fetchNearby(ra: number, dec: number, radius: number, signal?: AbortSignal): Promise<NearbyResponse> {
  const search = new URLSearchParams({ ra: ra.toFixed(3), dec: dec.toFixed(3), radius: radius.toFixed(3) });
  return get<NearbyResponse>("/api/nearby", search, signal);
}
