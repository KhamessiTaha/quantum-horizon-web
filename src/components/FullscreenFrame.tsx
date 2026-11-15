import { useEffect, useRef, useState, type ReactNode } from "react";
import styles from "./FullscreenFrame.module.css";

/** Wraps a 3D view so it can fill the screen. Children get whether the frame is full screen, to size themselves. */
export default function FullscreenFrame({ label, children }: { label: string; children: (full: boolean) => ReactNode }) {
  const frame = useRef<HTMLDivElement>(null);
  const [full, setFull] = useState(false);
  const supported = typeof document !== "undefined" && document.fullscreenEnabled;

  useEffect(() => {
    const onChange = () => setFull(document.fullscreenElement === frame.current);
    document.addEventListener("fullscreenchange", onChange);
    return () => document.removeEventListener("fullscreenchange", onChange);
  }, []);

  function toggle() {
    if (document.fullscreenElement) void document.exitFullscreen();
    else void frame.current?.requestFullscreen();
  }

  return (
    <div ref={frame} className={styles.frame} data-full={full}>
      {supported ? (
        <button type="button" className={styles.toggle} onClick={toggle} aria-label={full ? `Leave full screen` : `Show ${label} full screen`}>
          {full ? "✕ Exit full screen" : "⛶ Full screen"}
        </button>
      ) : null}
      {children(full)}
    </div>
  );
}
