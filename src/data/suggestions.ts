import type { DetectorId } from "../lib/viewState.ts";
import { FEATURED_TARGETS } from "./featuredTargets.ts";

export interface Suggestion {
  /** What is sent to the resolver; every entry was checked against SIMBAD through the backend. */
  name: string;
  group: string;
  note: string;
  detector: DetectorId;
}

/** Proper motions are SIMBAD's, rounded, so a user knows roughly how much a blink should show. */
const NOTABLE: Suggestion[] = [
  { name: "Kapteyn's Star", group: "Fast-moving nearby stars", note: "8.6″ per year", detector: "D2" },
  { name: "61 Cygni A", group: "Fast-moving nearby stars", note: "5.3″ per year", detector: "D2" },
  { name: "Teegarden's Star", group: "Fast-moving nearby stars", note: "5.1″ per year", detector: "D2" },
  { name: "Lalande 21185", group: "Fast-moving nearby stars", note: "4.8″ per year", detector: "D2" },
  { name: "Wolf 359", group: "Fast-moving nearby stars", note: "4.7″ per year", detector: "D2" },
  { name: "Proxima Centauri", group: "Fast-moving nearby stars", note: "nearest star to the Sun · 3.9″ per year", detector: "D2" },
  { name: "Luyten's Star", group: "Fast-moving nearby stars", note: "3.7″ per year", detector: "D2" },
  { name: "Groombridge 34", group: "Fast-moving nearby stars", note: "2.9″ per year", detector: "D2" },
  { name: "Ross 128", group: "Fast-moving nearby stars", note: "1.4″ per year", detector: "D2" },
  { name: "TRAPPIST-1", group: "Fast-moving nearby stars", note: "seven-planet system · 1.0″ per year", detector: "D2" },
  { name: "Luhman 16", group: "Brown dwarfs", note: "nearest brown dwarfs · 2.8″ per year", detector: "D5" },
  { name: "Gliese 570 D", group: "Brown dwarfs", note: "cold companion · 2.0″ per year", detector: "D5" },
  { name: "Gliese 229 B", group: "Brown dwarfs", note: "beside a bright red dwarf", detector: "D5" },
  { name: "Mira", group: "Changing stars", note: "the original long-period variable", detector: "D1" },
  { name: "Chi Cygni", group: "Changing stars", note: "Mira variable with a huge swing", detector: "D1" },
  { name: "R Leonis", group: "Changing stars", note: "Mira variable", detector: "D1" },
  { name: "R Coronae Borealis", group: "Changing stars", note: "fades when it puffs out dust", detector: "D1" },
  { name: "T Tauri", group: "Changing stars", note: "the prototype young star", detector: "D1" },
  { name: "FU Orionis", group: "Changing stars", note: "young star in outburst", detector: "D1" },
  { name: "EX Lupi", group: "Changing stars", note: "young star with repeated outbursts", detector: "D1" },
  { name: "KIC 8462852", group: "Changing stars", note: "Boyajian's star, with irregular dips", detector: "D1" },
  { name: "Eta Carinae", group: "Changing stars", note: "massive unstable star", detector: "D1" },
  { name: "Orion Nebula", group: "Nebulae, clusters and galaxies", note: "star-forming region", detector: "D3" },
  { name: "Crab Nebula", group: "Nebulae, clusters and galaxies", note: "supernova remnant", detector: "D3" },
  { name: "Ring Nebula", group: "Nebulae, clusters and galaxies", note: "planetary nebula", detector: "D3" },
  { name: "Pleiades", group: "Nebulae, clusters and galaxies", note: "young open cluster", detector: "D2" },
  { name: "Andromeda Galaxy", group: "Nebulae, clusters and galaxies", note: "nearest large galaxy", detector: "D2" },
];

export const SUGGESTIONS: Suggestion[] = [
  ...FEATURED_TARGETS.map((t) => ({ name: t.name, group: "Challenge targets", note: t.kind, detector: t.detector })),
  ...NOTABLE,
];

function normalise(text: string): string {
  return text.toLowerCase().normalize("NFKD").replace(/[^a-z0-9]+/g, " ").trim();
}

export function matchSuggestions(query: string, limit = 8): Suggestion[] {
  const q = normalise(query);
  if (!q) return SUGGESTIONS;
  const scored = SUGGESTIONS.map((s) => {
    const name = normalise(s.name);
    const rest = normalise(`${s.note} ${s.group}`);
    const score = name.startsWith(q) ? 0 : name.split(" ").some((w) => w.startsWith(q)) ? 1 : name.includes(q) ? 2 : rest.includes(q) ? 3 : -1;
    return { s, score };
  }).filter((x) => x.score >= 0);
  return scored.sort((a, b) => a.score - b.score).slice(0, limit).map((x) => x.s);
}
