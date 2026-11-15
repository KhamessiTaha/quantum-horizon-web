import NEIGHBOURS from "../data/neighbourhood.json";
import READY from "../data/ready.json";
import { blinkQuery, type Neighbour } from "./stellar.ts";

export const NEIGHBOUR_LIST = NEIGHBOURS as Neighbour[];

const READY_SET = new Set(READY as string[]);

function normalise(text: string): string {
  return text.toLowerCase().replace(/^(name|\*)\s+/, "").replace(/[\s'’−-]+/g, "");
}

export function isReady(star: Neighbour): boolean {
  return READY_SET.has(blinkQuery(star));
}

/** The neighbour a viewer target refers to, matched by SIMBAD identifier first and then by name. */
export function findNeighbour(...names: (string | null | undefined)[]): Neighbour | null {
  const wanted = names.filter((n): n is string => !!n);
  for (const name of wanted) {
    const byId = NEIGHBOUR_LIST.find((s) => s.id === name);
    if (byId) return byId;
  }
  const keys = new Set(wanted.map(normalise));
  return NEIGHBOUR_LIST.find((s) => keys.has(normalise(s.name)) || keys.has(normalise(s.id))) ?? null;
}
