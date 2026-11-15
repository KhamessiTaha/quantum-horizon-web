/** Asteroids whose SPHEREx exposures are stored with the API, so they blink without NASA's archive. */
export const BLINKABLE_ASTEROIDS = ["Ceres", "Vesta", "Pallas", "Juno", "Hygiea", "Psyche", "Eunomia", "Hebe", "Iris", "Flora", "Eros"];

export function trackLink(name: string, detector = "D2"): string {
  return `/track?${new URLSearchParams({ body: name, det: detector }).toString()}`;
}
