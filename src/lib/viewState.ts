export type ViewMode = "blink" | "difference";

export type DetectorId = "D1" | "D2" | "D3" | "D4" | "D5" | "D6";

export type Panel = "findings" | "spectrum" | "brightness" | "movers";

export interface ViewState {
  target: string | null;
  ra: number | null;
  dec: number | null;
  fovDeg: number;
  detector: DetectorId;
  mode: ViewMode;
  hidden: number[];
  pair: [number, number] | null;
  panel: Panel;
  pick: { x: number; y: number } | null;
  overlay: boolean;
  gaia: boolean;
  colour: boolean;
  embed: boolean;
}

export const DETECTORS: { id: DetectorId; rangeMicron: string }[] = [
  { id: "D1", rangeMicron: "0.75–1.09 µm" },
  { id: "D2", rangeMicron: "1.10–1.62 µm" },
  { id: "D3", rangeMicron: "1.63–2.41 µm" },
  { id: "D4", rangeMicron: "2.42–3.82 µm" },
  { id: "D5", rangeMicron: "3.83–4.41 µm" },
  { id: "D6", rangeMicron: "4.42–5.00 µm" },
];

export const FOV_LIMITS = { min: 0.03, max: 0.2, defaultDeg: 0.06 };

const DETECTOR_IDS = new Set<string>(DETECTORS.map((d) => d.id));
const PANELS = new Set<string>(["findings", "spectrum", "brightness", "movers"]);

function parseNumber(value: string | null, min: number, max: number): number | null {
  if (value === null || value.trim() === "") return null;
  const n = Number(value);
  return Number.isFinite(n) && n >= min && n <= max ? n : null;
}

function parseList(value: string | null): number[] {
  if (!value) return [];
  return [...new Set(value.split(",").map((part) => Number(part)).filter((n) => Number.isInteger(n) && n > 0))].sort(
    (a, b) => a - b,
  );
}

function parsePair(value: string | null): [number, number] | null {
  if (!value) return null;
  const parts = value.split("-").map((part) => Number(part));
  if (parts.length !== 2 || parts.some((n) => !Number.isInteger(n) || n < 1) || parts[0] === parts[1]) return null;
  return [parts[0], parts[1]];
}

function parsePick(value: string | null): { x: number; y: number } | null {
  if (!value) return null;
  const parts = value.split(",").map((part) => Number(part));
  if (parts.length !== 2 || parts.some((n) => !Number.isFinite(n))) return null;
  return { x: parts[0], y: parts[1] };
}

export function parseViewState(params: URLSearchParams): ViewState {
  const detector = params.get("det")?.toUpperCase() ?? "D2";
  const fov = parseNumber(params.get("fov"), FOV_LIMITS.min, FOV_LIMITS.max);
  const panel = params.get("panel") ?? "findings";
  return {
    target: params.get("target"),
    ra: parseNumber(params.get("ra"), 0, 360),
    dec: parseNumber(params.get("dec"), -90, 90),
    fovDeg: fov ?? FOV_LIMITS.defaultDeg,
    detector: (DETECTOR_IDS.has(detector) ? detector : "D2") as DetectorId,
    mode: params.get("mode") === "difference" ? "difference" : "blink",
    hidden: parseList(params.get("hide")),
    pair: parsePair(params.get("pair")),
    panel: (PANELS.has(panel) ? panel : "findings") as Panel,
    pick: parsePick(params.get("pick")),
    overlay: params.get("overlay") !== "0",
    gaia: params.get("gaia") === "1",
    colour: params.get("colour") === "1",
    embed: params.get("embed") === "1",
  };
}

export function toSearchParams(state: ViewState): URLSearchParams {
  const params = new URLSearchParams();
  if (state.target) params.set("target", state.target);
  if (state.ra !== null) params.set("ra", state.ra.toFixed(5));
  if (state.dec !== null) params.set("dec", state.dec.toFixed(5));
  params.set("fov", String(state.fovDeg));
  params.set("det", state.detector);
  params.set("mode", state.mode);
  if (state.hidden.length) params.set("hide", state.hidden.join(","));
  if (state.pair) params.set("pair", state.pair.join("-"));
  if (state.panel !== "findings") params.set("panel", state.panel);
  if (state.pick) params.set("pick", `${state.pick.x.toFixed(2)},${state.pick.y.toFixed(2)}`);
  if (!state.overlay) params.set("overlay", "0");
  if (state.gaia) params.set("gaia", "1");
  if (state.colour) params.set("colour", "1");
  if (state.embed) params.set("embed", "1");
  return params;
}

/** The parts of the state the backend cares about: changing anything else must not refetch. */
export function queryKey(state: ViewState): string {
  const place = state.target ?? `${state.ra},${state.dec}`;
  return `${place}|${state.detector}|${state.fovDeg}`;
}

export function targetQuery(state: ViewState) {
  return {
    target: state.target,
    ra: state.ra,
    dec: state.dec,
    detector: state.detector,
    fovDeg: state.fovDeg,
  };
}

const SEXAGESIMAL_MARKS = /[hmsd°'′"″:]/gi;

/** Coordinates in degrees ("269.4463 4.7682") or sexagesimal ("17 57 47.09 +04 46 07.7", "17h57m47s +04°46′07″"). */
export function parseCoordinates(text: string): { ra: number; dec: number } | null {
  const trimmed = text.trim();
  if (!/^[\d\s.,:+\-hmsd°'′"″]+$/i.test(trimmed)) return null;
  const parts = trimmed.replace(SEXAGESIMAL_MARKS, " ").split(/[\s,]+/).filter(Boolean);
  if (parts.length === 2) {
    const ra = parseNumber(parts[0], 0, 360);
    const dec = parseNumber(parts[1], -90, 90);
    return ra !== null && dec !== null ? { ra, dec } : null;
  }
  if (parts.length !== 6) return null;
  const [h, m, s, d, dm, ds] = parts.map(Number);
  if ([h, m, s, d, dm, ds].some((n) => !Number.isFinite(n))) return null;
  if (h < 0 || h >= 24 || m < 0 || m >= 60 || s < 0 || s >= 60 || dm < 0 || dm >= 60 || ds < 0 || ds >= 60) return null;
  const sign = parts[3].startsWith("-") ? -1 : 1;
  const ra = (h + m / 60 + s / 3600) * 15;
  const dec = sign * (Math.abs(d) + dm / 60 + ds / 3600);
  if (dec < -90 || dec > 90) return null;
  return { ra: Number(ra.toFixed(6)), dec: Number(dec.toFixed(6)) };
}

export function parseQuery(query: string): { target: string | null; ra: number | null; dec: number | null } {
  const coordinates = parseCoordinates(query);
  if (coordinates) return { target: null, ...coordinates };
  return { target: query.trim() || null, ra: null, dec: null };
}
