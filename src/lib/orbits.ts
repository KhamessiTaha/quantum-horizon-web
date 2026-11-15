/** Two-body orbits for the Solar System view. The Kepler solver, planet elements and compressed distance scale are
 * adapted from CosmoArchitects (NASA Space Apps 2024, same author). Positions are heliocentric ecliptic J2000, in AU. */

import RAW from "../data/smallbodies.json";

const DEG = Math.PI / 180;
const GAUSS_DEG_PER_DAY = 0.9856076686;
const J2000 = 2451545.0;
const MJD_OFFSET = 2400000.5;
const OBLIQUITY = 23.43928 * DEG;

export type Vec = [number, number, number];

export type Group = "famous" | "neo" | "asteroid" | "distant" | "extreme" | "comet";

export interface SmallBody {
  name: string;
  group: Group;
  cls: string;
  epochJd: number;
  a: number;
  e: number;
  i: number;
  om: number;
  w: number;
  ma: number;
  diameter: number | null;
  H: number | null;
  designation: string | null;
}

export const SMALL_BODIES: SmallBody[] = (RAW as { bodies: (string | number | null)[][] }).bodies.map((row) => ({
  name: row[0] as string,
  group: row[1] as Group,
  cls: (row[2] as string) ?? "",
  epochJd: (row[3] as number) + MJD_OFFSET,
  a: row[4] as number,
  e: row[5] as number,
  i: row[6] as number,
  om: row[7] as number,
  w: row[8] as number,
  ma: row[9] as number,
  diameter: row[10] as number | null,
  H: row[11] as number | null,
  designation: (row[12] as string | null) ?? null,
}));

export const SMALL_BODY_SOURCE = (RAW as { source: string }).source;

export type PlanetKey = "mercury" | "venus" | "earth" | "mars" | "jupiter" | "saturn" | "uranus" | "neptune";

export interface Planet {
  key: PlanetKey;
  name: string;
  radiusKm: number;
  colour: string;
  a: [number, number];
  e: [number, number];
  i: [number, number];
  L: [number, number];
  lp: [number, number];
  om: [number, number];
}

/** JPL's "Keplerian Elements for Approximate Positions of the Major Planets" (Standish), table 1, 1800–2050. */
export const PLANETS: Planet[] = [
  { key: "mercury", name: "Mercury", radiusKm: 2439.7, colour: "#b8b0a8", a: [0.38709927, 0.00000037], e: [0.20563593, 0.00001906], i: [7.00497902, -0.00594749], L: [252.2503235, 149472.67411175], lp: [77.45779628, 0.16047689], om: [48.33076593, -0.12534081] },
  { key: "venus", name: "Venus", radiusKm: 6051.8, colour: "#f0d9a8", a: [0.72333566, 0.0000039], e: [0.00677672, -0.00004107], i: [3.39467605, -0.0007889], L: [181.9790995, 58517.81538729], lp: [131.60246718, 0.00268329], om: [76.67984255, -0.27769418] },
  { key: "earth", name: "Earth", radiusKm: 6371, colour: "#5c9eff", a: [1.00000261, 0.00000562], e: [0.01671123, -0.00004392], i: [-0.00001531, -0.01294668], L: [100.46457166, 35999.37244981], lp: [102.93768193, 0.32327364], om: [0, 0] },
  { key: "mars", name: "Mars", radiusKm: 3389.5, colour: "#e0784c", a: [1.52371034, 0.00001847], e: [0.0933941, 0.00007882], i: [1.84969142, -0.00813131], L: [-4.55343205, 19140.30268499], lp: [-23.94362959, 0.44441088], om: [49.55953891, -0.29257343] },
  { key: "jupiter", name: "Jupiter", radiusKm: 69911, colour: "#e3c7a0", a: [5.202887, -0.00011607], e: [0.04838624, -0.00013253], i: [1.30439695, -0.00183714], L: [34.39644051, 3034.74612775], lp: [14.72847983, 0.21252668], om: [100.47390909, 0.20469106] },
  { key: "saturn", name: "Saturn", radiusKm: 58232, colour: "#ead9a8", a: [9.53667594, -0.0012506], e: [0.05386179, -0.00050991], i: [2.48599187, 0.00193609], L: [49.95424423, 1222.49362201], lp: [92.59887831, -0.41897216], om: [113.66242448, -0.28867794] },
  { key: "uranus", name: "Uranus", radiusKm: 25362, colour: "#a9e6ee", a: [19.18916464, -0.00196176], e: [0.04725744, -0.00004397], i: [0.77263783, -0.00242939], L: [313.23810451, 428.48202785], lp: [170.9542763, 0.40805281], om: [74.01692503, 0.04240589] },
  { key: "neptune", name: "Neptune", radiusKm: 24622, colour: "#5b8cff", a: [30.06992276, 0.00026291], e: [0.00859048, 0.00005105], i: [1.77004347, 0.00035372], L: [-55.12002969, 218.45945325], lp: [44.96476227, -0.32241464], om: [131.78422574, -0.00508664] },
];

export const CLASS_LABEL: Record<string, string> = {
  MBA: "Main-belt asteroid",
  IMB: "Inner main-belt asteroid",
  OMB: "Outer main-belt asteroid",
  MCA: "Mars-crossing asteroid",
  APO: "Near-Earth asteroid (Apollo)",
  ATE: "Near-Earth asteroid (Aten)",
  AMO: "Near-Earth asteroid (Amor)",
  IEO: "Near-Earth asteroid (inside Earth's orbit)",
  TJN: "Jupiter Trojan",
  CEN: "Centaur",
  TNO: "Trans-Neptunian object",
  AST: "Asteroid",
  JFc: "Jupiter-family comet",
  JFC: "Jupiter-family comet",
  HTC: "Halley-type comet",
  ETc: "Encke-type comet",
  CTc: "Chiron-type comet",
  COM: "Comet",
};

export function julianDate(ms: number): number {
  return ms / 86400000 + 2440587.5;
}

export function dateOf(jd: number): Date {
  return new Date((jd - 2440587.5) * 86400000);
}

function solveKepler(M: number, e: number): number {
  let E = e > 0.8 ? Math.PI : M;
  for (let k = 0; k < 30; k++) {
    const delta = (E - e * Math.sin(E) - M) / (1 - e * Math.cos(E));
    E -= delta;
    if (Math.abs(delta) < 1e-9) break;
  }
  return E;
}

function fromEccentricAnomaly(a: number, e: number, i: number, om: number, w: number, E: number, out: Vec): Vec {
  const nu = 2 * Math.atan2(Math.sqrt(1 + e) * Math.sin(E / 2), Math.sqrt(1 - e) * Math.cos(E / 2));
  const r = a * (1 - e * Math.cos(E));
  const cosOm = Math.cos(om * DEG);
  const sinOm = Math.sin(om * DEG);
  const cosI = Math.cos(i * DEG);
  const sinI = Math.sin(i * DEG);
  const u = w * DEG + nu;
  out[0] = r * (cosOm * Math.cos(u) - sinOm * Math.sin(u) * cosI);
  out[1] = r * (sinOm * Math.cos(u) + cosOm * Math.sin(u) * cosI);
  out[2] = r * Math.sin(u) * sinI;
  return out;
}

function elementsToEcliptic(a: number, e: number, i: number, om: number, w: number, maDeg: number, out: Vec): Vec {
  const M = ((((maDeg * DEG) % (2 * Math.PI)) + 2 * Math.PI) % (2 * Math.PI));
  return fromEccentricAnomaly(a, e, i, om, w, solveKepler(M, e), out);
}

export function planetPosition(planet: Planet, jd: number, out: Vec = [0, 0, 0]): Vec {
  const T = (jd - J2000) / 36525;
  const at = ([value, rate]: [number, number]) => value + rate * T;
  const L = at(planet.L);
  const lp = at(planet.lp);
  const om = at(planet.om);
  return elementsToEcliptic(at(planet.a), at(planet.e), at(planet.i), om, lp - om, L - lp, out);
}

export function bodyPosition(body: SmallBody, jd: number, out: Vec = [0, 0, 0]): Vec {
  const meanMotion = GAUSS_DEG_PER_DAY / Math.pow(body.a, 1.5);
  return elementsToEcliptic(body.a, body.e, body.i, body.om, body.w, body.ma + meanMotion * (jd - body.epochJd), out);
}

/** Points around a whole orbit, sampled evenly in eccentric anomaly so eccentric orbits stay smooth. */
export function orbitPoints(orbit: { a: number; e: number; i: number; om: number; w: number }, segments = 256): Vec[] {
  return Array.from({ length: segments + 1 }, (_, k) =>
    fromEccentricAnomaly(orbit.a, orbit.e, orbit.i, orbit.om, orbit.w, (k / segments) * 2 * Math.PI, [0, 0, 0]),
  );
}

export function planetOrbit(planet: Planet, jd: number) {
  const T = (jd - J2000) / 36525;
  const at = ([value, rate]: [number, number]) => value + rate * T;
  const om = at(planet.om);
  return { a: at(planet.a), e: at(planet.e), i: at(planet.i), om, w: at(planet.lp) - om };
}

export function periodYears(a: number): number {
  return Math.pow(a, 1.5);
}

const SCALE: [number, number][] = [
  [0, 0],
  [0.387, 8],
  [0.723, 12],
  [1, 16],
  [1.524, 22],
  [3.3, 26.5],
  [5.203, 30],
  [9.537, 40],
  [19.19, 50],
  [30.07, 60],
  [50, 70],
  [150, 86],
  [500, 104],
  [2000, 124],
];

/** Distances compressed onto readable rings: each planet on its own ring, everything between them interpolated. */
export function visualRadius(au: number): number {
  for (let k = 1; k < SCALE.length; k++) {
    const [au1, r1] = SCALE[k];
    if (au <= au1 || k === SCALE.length - 1) {
      const [au0, r0] = SCALE[k - 1];
      return r0 + ((au - au0) * (r1 - r0)) / (au1 - au0);
    }
  }
  return 0;
}

/** Ecliptic AU to scene units on the compressed scale, with y up. */
export function toScene(p: Vec, out: Vec = [0, 0, 0]): Vec {
  const au = Math.hypot(p[0], p[1], p[2]);
  const k = au > 0 ? visualRadius(au) / au : 0;
  out[0] = p[0] * k;
  out[1] = p[2] * k;
  out[2] = -p[1] * k;
  return out;
}

export interface SkyPlace {
  ra: number;
  dec: number;
  distanceAu: number;
  elongation: number;
}

/** Where a body appears from Earth: right ascension and declination (J2000), distance, and angle from the Sun. */
export function skyPlace(body: Vec, earth: Vec): SkyPlace {
  const dx = body[0] - earth[0];
  const dy = body[1] - earth[1];
  const dz = body[2] - earth[2];
  const x = dx;
  const y = dy * Math.cos(OBLIQUITY) - dz * Math.sin(OBLIQUITY);
  const z = dy * Math.sin(OBLIQUITY) + dz * Math.cos(OBLIQUITY);
  const distanceAu = Math.hypot(x, y, z);
  const ra = ((Math.atan2(y, x) / DEG) + 360) % 360;
  const dec = Math.asin(z / distanceAu) / DEG;
  const sunDistance = Math.hypot(earth[0], earth[1], earth[2]);
  const cosElong = -(dx * earth[0] + dy * earth[1] + dz * earth[2]) / (distanceAu * sunDistance);
  return { ra, dec, distanceAu, elongation: Math.acos(Math.max(-1, Math.min(1, cosElong))) / DEG };
}

/** How fast a body crosses the sky from Earth, in arcseconds per hour, from positions one hour apart. */
export function skyRate(body: SmallBody, jd: number): number {
  const earth = PLANETS[2];
  const hour = 1 / 24;
  const a = skyPlace(bodyPosition(body, jd), planetPosition(earth, jd));
  const b = skyPlace(bodyPosition(body, jd + hour), planetPosition(earth, jd + hour));
  const cosD = Math.sin(a.dec * DEG) * Math.sin(b.dec * DEG) + Math.cos(a.dec * DEG) * Math.cos(b.dec * DEG) * Math.cos((b.ra - a.ra) * DEG);
  return (Math.acos(Math.max(-1, Math.min(1, cosD))) / DEG) * 3600;
}
