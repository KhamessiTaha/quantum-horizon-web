import { useEffect, useRef } from "react";
import { colourFromBV } from "../lib/stellar.ts";
import styles from "./HeroSky.module.css";

const DRIFT_DEG_PER_SECOND = 0.6;

function reducedMotion(): boolean {
  return window.matchMedia?.("(prefers-reduced-motion: reduce)").matches === true;
}

/** The real naked-eye sky behind the hero: the 6,372 brightest stars from SIMBAD, in an equirectangular map that drifts. */
export default function HeroSky() {
  const canvas = useRef<HTMLCanvasElement>(null);

  useEffect(() => {
    const element = canvas.current;
    const context = element?.getContext("2d");
    if (!element || !context) return;
    const state = { stars: [] as { ra: number; dec: number; r: number; colour: string; alpha: number }[], frame: 0, offset: 0, last: 0, cancelled: false };

    function resize() {
      if (!element || !context) return;
      const ratio = Math.min(window.devicePixelRatio, 2);
      element.width = element.clientWidth * ratio;
      element.height = element.clientHeight * ratio;
      context.setTransform(ratio, 0, 0, ratio, 0, 0);
    }

    function draw(now: number) {
      if (!element || !context) return;
      const width = element.clientWidth;
      const height = element.clientHeight;
      if (state.last && !reducedMotion()) state.offset = (state.offset + ((now - state.last) / 1000) * DRIFT_DEG_PER_SECOND) % 360;
      state.last = now;
      context.clearRect(0, 0, width, height);
      const scale = width / 180;
      for (const star of state.stars) {
        const x = (((star.ra + state.offset) % 360) - 90) * scale;
        if (x < -4 || x > width + 4) continue;
        const y = (55 - star.dec) * (height / 110);
        if (y < -4 || y > height + 4) continue;
        context.globalAlpha = star.alpha;
        context.fillStyle = star.colour;
        context.beginPath();
        context.arc(x, y, star.r, 0, Math.PI * 2);
        context.fill();
      }
      if (!reducedMotion() && !state.cancelled) state.frame = requestAnimationFrame(draw);
    }

    import("../data/brightstars.json").then((module) => {
      if (state.cancelled) return;
      state.stars = (module.default as number[][]).map(([ra, dec, v, bv]) => {
        const [r, g, b] = colourFromBV(bv);
        return {
          ra,
          dec,
          r: Math.max(0.5, 2.6 - v * 0.38),
          colour: `rgb(${Math.round(r * 255)},${Math.round(g * 255)},${Math.round(b * 255)})`,
          alpha: Math.max(0.18, Math.min(0.9, 1 - v * 0.13)),
        };
      });
      resize();
      state.frame = requestAnimationFrame(draw);
    });

    const observer = new ResizeObserver(resize);
    observer.observe(element);
    return () => {
      state.cancelled = true;
      cancelAnimationFrame(state.frame);
      observer.disconnect();
    };
  }, []);

  return <canvas ref={canvas} className={styles.sky} aria-hidden="true" />;
}
