import { useEffect, useRef, useState } from "react";
import { fetchFrames, type FramesResponse, type PassInfo, type TargetQuery } from "./api.ts";
import type { DetectorId } from "./viewState.ts";

/** Long wavelengths red, short blue, as in most infrared colour images: D6 4.42–5.00 µm, D3 1.63–2.41 µm, D1 0.75–1.09 µm. */
export const COLOUR_CHANNELS: { detector: DetectorId; channel: 0 | 1 | 2 }[] = [
  { detector: "D6", channel: 0 },
  { detector: "D3", channel: 1 },
  { detector: "D1", channel: 2 },
];

/** Passes of different detectors are matched by date; within a pass they are at most this far apart. */
const MATCH_DAYS = 40;

export interface ColourState {
  images: Record<number, string>;
  loading: boolean;
  error: string | null;
}

function loadImage(src: string): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const image = new Image();
    image.onload = () => resolve(image);
    image.onerror = () => reject(new Error("could not decode a frame"));
    image.src = src;
  });
}

function nearest(passes: PassInfo[], mjd: number): PassInfo | null {
  let best: PassInfo | null = null;
  for (const pass of passes) {
    if (Math.abs(pass.mid_mjd - mjd) > MATCH_DAYS) continue;
    if (!best || Math.abs(pass.mid_mjd - mjd) < Math.abs(best.mid_mjd - mjd)) best = pass;
  }
  return best;
}

/** Each detector's frame is rendered with its own sky level; set that level to black and its bright sources to full scale. */
function stretch(pixels: Uint8ClampedArray): { floor: number; span: number } {
  const values: number[] = [];
  for (let i = 0; i < pixels.length; i += 4) values.push(pixels[i]);
  values.sort((a, b) => a - b);
  const at = (q: number) => values[Math.min(values.length - 1, Math.floor(q * values.length))];
  const floor = at(0.6);
  return { floor, span: Math.max(at(0.995) - floor, 24) };
}

async function compose(reference: PassInfo[], views: FramesResponse[]) {
  const sample = reference.length ? await loadImage(reference[0].image) : null;
  const width = sample?.naturalWidth || 1;
  const height = sample?.naturalHeight || 1;
  const canvas = document.createElement("canvas");
  canvas.width = width;
  canvas.height = height;
  const context = canvas.getContext("2d", { willReadFrequently: true });
  if (!context) throw new Error("this browser cannot draw the colour view");
  const images: Record<number, string> = {};

  for (const pass of reference) {
    const matched = views.map((view) => nearest(view.passes, pass.mid_mjd));
    if (matched.some((m) => m === null)) continue;
    const output = context.createImageData(width, height);
    for (let i = 0; i < output.data.length; i += 4) output.data[i + 3] = 255;
    for (const [k, match] of matched.entries()) {
      const frame = await loadImage((match as PassInfo).image);
      context.clearRect(0, 0, width, height);
      context.drawImage(frame, 0, 0, width, height);
      const pixels = context.getImageData(0, 0, width, height).data;
      const channel = COLOUR_CHANNELS[k].channel;
      const { floor, span } = stretch(pixels);
      for (let i = 0; i < pixels.length; i += 4) {
        output.data[i + channel] = Math.round(255 * Math.min(1, Math.max(0, (pixels[i] - floor) / span)));
      }
    }
    context.putImageData(output, 0, 0);
    images[pass.index] = canvas.toDataURL("image/png");
  }
  return images;
}

/** An RGB composite per pass, built in the browser from three detectors' stacked frames of the same field. */
export function useColour(query: TargetQuery, reference: FramesResponse | null, enabled: boolean): ColourState {
  const [state, setState] = useState<ColourState & { key: string }>({ key: "", images: {}, loading: false, error: null });
  const latest = useRef({ query, reference });
  const key = `${query.target ?? `${query.ra},${query.dec}`}|${query.fovDeg}|${reference?.passes.map((p) => p.index).join(",") ?? ""}`;

  useEffect(() => {
    latest.current = { query, reference };
  });

  useEffect(() => {
    const { query: current, reference: frames } = latest.current;
    if (!enabled || !frames) return;
    const controller = new AbortController();
    Promise.all(COLOUR_CHANNELS.map(({ detector }) => fetchFrames({ ...current, detector }, controller.signal)))
      .then((views) => compose(frames.passes, views))
      .then((images) => {
        if (!controller.signal.aborted) setState({ key, images, loading: false, error: null });
      })
      .catch((reason: unknown) => {
        if (controller.signal.aborted) return;
        const message = reason instanceof Error ? reason.message : "could not build the colour view";
        setState({ key, images: {}, loading: false, error: message });
      });
    return () => controller.abort();
  }, [key, enabled]);

  if (!enabled || state.key !== key) return { images: {}, loading: enabled && !!reference, error: null };
  return { images: state.images, loading: state.loading, error: state.error };
}
