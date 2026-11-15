import { useEffect, useState } from "react";
import { imageUrl, type PassInfo } from "../lib/api.ts";
import styles from "./HeroBlink.module.css";

const ZOOM = 1.35;
const STEP_MS = 850;

function reducedMotion(): boolean {
  return typeof window !== "undefined" && window.matchMedia?.("(prefers-reduced-motion: reduce)").matches === true;
}

/** The hero's blink: real SPHEREx passes of one star, played in a loop, with the catalog prediction for each date. */
export default function HeroBlink({
  passes,
  width,
  height,
  name,
  onPass,
}: {
  passes: PassInfo[];
  width: number;
  height: number;
  name: string;
  onPass?: (index: number) => void;
}) {
  const [step, setStep] = useState(0);
  const [paused, setPaused] = useState(reducedMotion);
  const shown = passes.length ? passes[step % passes.length] : null;

  useEffect(() => {
    if (paused || passes.length < 2) return;
    const timer = window.setInterval(() => setStep((s) => (s + 1) % passes.length), STEP_MS);
    return () => window.clearInterval(timer);
  }, [paused, passes.length]);

  useEffect(() => {
    if (shown) onPass?.(shown.index);
  }, [shown, onPass]);

  const place = (value: number, size: number) => `${50 + ((value + 0.5) / size - 0.5) * 100 * ZOOM}%`;

  return (
    <div className={styles.blink}>
      <button
        type="button"
        className={styles.frame}
        onClick={() => setPaused((p) => !p)}
        aria-label={paused ? "Play the blink" : "Pause the blink"}
      >
        {shown ? (
          <>
            <img src={imageUrl(shown.image)} alt={`${name}, SPHEREx pass ${shown.index}, ${shown.mid_date}`} className={styles.image} />
            {shown.predicted_px ? (
              <span
                className={styles.cross}
                style={{ left: place(shown.predicted_px[0], width), top: place(shown.predicted_px[1], height) }}
                aria-hidden="true"
              />
            ) : null}
            <span className={`mono ${styles.label}`}>
              Pass {shown.index} · {shown.mid_date}
            </span>
            <span className={`mono ${styles.state}`}>{paused ? "paused · click to play" : "live blink"}</span>
          </>
        ) : (
          <span className={`mono ${styles.loading}`}>loading real SPHEREx frames…</span>
        )}
      </button>
    </div>
  );
}
