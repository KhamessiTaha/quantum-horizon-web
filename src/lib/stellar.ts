/** Display helpers for the 3D neighbourhood. Colours follow the usual spectral-class palette; sizes follow catalog magnitudes. */

export interface Neighbour {
  id: string;
  name: string;
  sp: string;
  otype: string;
  ra: number;
  dec: number;
  plx: number;
  d: number;
  pmra: number;
  pmdec: number;
  V: number | null;
  G: number | null;
  J: number | null;
  planets: number;
  xyz: number[];
  target?: boolean;
}

export type Kind = "O" | "B" | "A" | "F" | "G" | "K" | "M" | "L" | "T" | "Y" | "WD" | "?";

export const KIND_COLOUR: Record<Kind, string> = {
  O: "#9bb0ff",
  B: "#aabfff",
  A: "#cad7ff",
  F: "#f8f7ff",
  G: "#fff1d6",
  K: "#ffcf8f",
  M: "#ff8f5a",
  L: "#e2573a",
  T: "#c35cff",
  Y: "#8a5cff",
  WD: "#dde8ff",
  "?": "#9aa4b2",
};

export const KIND_LABEL: Record<Kind, string> = {
  O: "O star",
  B: "B star",
  A: "A star",
  F: "F star",
  G: "G star, like the Sun",
  K: "K star",
  M: "Red dwarf (M)",
  L: "Brown dwarf (L)",
  T: "Brown dwarf (T)",
  Y: "Brown dwarf (Y)",
  WD: "White dwarf",
  "?": "Unclassified",
};

export function kindOf(star: Pick<Neighbour, "sp" | "otype">): Kind {
  if (star.otype === "WD*") return "WD";
  const sp = star.sp.trim().replace(/^(esd|usd|sd|d)/i, "");
  const first = sp.charAt(0).toUpperCase();
  if (first === "D") return "WD";
  if ("OBAFGKMLTY".includes(first) && first) return first as Kind;
  if (star.otype === "BD*") return "T";
  return "?";
}

export function isBrownDwarf(kind: Kind): boolean {
  return kind === "L" || kind === "T" || kind === "Y";
}

const SUN_ABSOLUTE = 4.83;

/** Absolute magnitude in the best band the catalog has: V, else Gaia G, else J (cool dwarfs are faint in visible light). */
export function absoluteMagnitude(star: Pick<Neighbour, "V" | "G" | "J" | "plx">): number | null {
  const m = star.V ?? star.G ?? star.J;
  if (m === null || !star.plx) return null;
  return m + 5 * (Math.log10(star.plx) - 2);
}

/** World size of a star's glow: compressed so the Sun reads about 0.18, Sirius 0.28 and a red dwarf 0.08. */
export function displaySize(star: Pick<Neighbour, "V" | "G" | "J" | "plx">): number {
  const absolute = absoluteMagnitude(star);
  if (absolute === null) return 0.07;
  const luminosity = 10 ** (-0.4 * (absolute - SUN_ABSOLUTE));
  return Math.min(0.45, Math.max(0.05, 0.07 + 0.11 * luminosity ** 0.2));
}

/** Colour of a star from its B−V index, through an effective temperature. */
export function colourFromBV(bv: number): [number, number, number] {
  const clamped = Math.min(2, Math.max(-0.4, bv));
  const t = 4600 * (1 / (0.92 * clamped + 1.7) + 1 / (0.92 * clamped + 0.62));
  const k = t / 100;
  const red = k <= 66 ? 255 : 329.7 * (k - 60) ** -0.1332;
  const green = k <= 66 ? 99.47 * Math.log(k) - 161.12 : 288.12 * (k - 60) ** -0.0755;
  const blue = k >= 66 ? 255 : k <= 19 ? 0 : 138.52 * Math.log(k - 10) - 305.04;
  const clip = (v: number) => Math.min(255, Math.max(0, v)) / 255;
  return [clip(red), clip(green), clip(blue)];
}

export const LIGHT_YEARS_PER_PC = 3.2616;

/** What the viewer resolves: challenge targets by their common name, everything else by its SIMBAD identifier. */
export function blinkQuery(star: Pick<Neighbour, "id" | "name" | "target">): string {
  return star.target ? star.name : star.id;
}

export function blinkLink(star: Pick<Neighbour, "id" | "name" | "target">, kind: Kind): string {
  const target = blinkQuery(star);
  const detector = star.name === "WISE 0855-0714" ? "D6" : isBrownDwarf(kind) ? "D5" : "D2";
  return `/view?${new URLSearchParams({ target, det: detector, fov: "0.06", mode: "blink" }).toString()}`;
}
