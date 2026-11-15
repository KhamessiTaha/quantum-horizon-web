import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import Badge, { type Confidence } from "./Badge.tsx";
import { viewLink, type FeaturedTarget } from "../data/featuredTargets.ts";
import { fetchFrames, imageUrl, type FramesResponse } from "../lib/api.ts";
import { useAsync } from "../lib/useAsync.ts";
import styles from "./TargetCard.module.css";

/** A challenge target with its own SPHEREx frames, which blink on hover, and the motion the tool measured. */
export default function TargetCard({ target }: { target: FeaturedTarget }) {
  const frames = useAsync<FramesResponse>(
    (signal) => fetchFrames({ target: target.name, ra: null, dec: null, detector: target.detector, fovDeg: 0.06 }, signal),
    `card|${target.slug}`,
  );
  const [hovered, setHovered] = useState(false);
  const [step, setStep] = useState(0);
  const passes = frames.data?.passes ?? [];
  const motion = frames.data?.measurement?.motion ?? null;

  useEffect(() => {
    if (!hovered || passes.length < 2) return;
    const timer = window.setInterval(() => setStep((s) => s + 1), 700);
    return () => window.clearInterval(timer);
  }, [hovered, passes.length]);

  const shown = passes.length ? passes[hovered ? step % passes.length : 0] : null;

  return (
    <Link
      to={viewLink(target)}
      className={`panel ${styles.card}`}
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => setHovered(false)}
      onFocus={() => setHovered(true)}
      onBlur={() => setHovered(false)}
    >
      <div className={styles.thumb}>
        {shown ? (
          <img src={imageUrl(shown.image)} alt={`${target.name}, SPHEREx ${target.detector}, pass ${shown.index}`} />
        ) : (
          <span className={styles.placeholder}>{frames.error ? "frames unavailable" : "loading frames…"}</span>
        )}
        {shown ? (
          <span className={`mono ${styles.pass}`}>
            {target.detector} · pass {shown.index} · {shown.mid_date}
          </span>
        ) : null}
        {passes.length > 1 ? <span className={`mono ${styles.hint}`}>{hovered ? "blinking" : "hover to blink"}</span> : null}
      </div>
      <div className={styles.body}>
        <span className={`mono ${styles.kind}`}>{target.kind}</span>
        <span className={styles.name}>{target.name}</span>
        <span className={styles.hook}>{target.hook}</span>
        <div className={styles.result}>
          {motion?.measured_arcsec !== null && motion?.measured_arcsec !== undefined ? (
            <>
              <span className={`mono ${styles.value}`}>
                {motion.measured_arcsec.toFixed(2)} ± {(motion.sigma_arcsec ?? 0).toFixed(2)}″
              </span>
              <span className={`mono ${styles.catalog}`}>catalog {motion.predicted_arcsec?.toFixed(2)}″</span>
              <Badge confidence={motion.confidence as Confidence} />
            </>
          ) : (
            <span className={styles.pending}>measuring…</span>
          )}
        </div>
      </div>
    </Link>
  );
}
