/** Asteroids whose SPHEREx exposures are stored with the API, so they blink without NASA's archive. */
export const BLINKABLE_ASTEROIDS = ["Ceres", "Vesta", "Pallas", "Juno", "Hygiea", "Psyche", "Eunomia", "Hebe", "Iris", "Flora", "Eros"];

export function trackLink(name: string, detector = "D2", id?: string | null, kind?: "asteroid" | "comet"): string {
  const search = new URLSearchParams({ body: name, det: detector });
  if (id && !BLINKABLE_ASTEROIDS.includes(name)) search.set("id", id);
  if (kind === "comet") search.set("kind", kind);
  return `/track?${search.toString()}`;
}
