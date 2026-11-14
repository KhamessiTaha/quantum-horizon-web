import type { PassInfo } from "../../lib/api.ts";
import styles from "./Timeline.module.css";

interface TimelineProps {
  passes: PassInfo[];
  hidden: number[];
  current: number | null;
}

export default function Timeline({ passes, hidden, current }: TimelineProps) {
  if (!passes.length) {
    return (
      <div className={`panel ${styles.timeline}`}>
        <div className={styles.head}>
          <span>Observations over time</span>
          <span className="mono">frames pending</span>
        </div>
        <div className={styles.track} />
        <div className={`mono ${styles.axis}`}>
          <span>start</span>
          <span>dates appear once frames load</span>
          <span>latest</span>
        </div>
      </div>
    );
  }

  const shown = passes.filter((p) => !hidden.includes(p.index));
  const totalFrames = shown.reduce((sum, p) => sum + p.frames_used, 0);
  const starts = passes.map((p) => Date.parse(p.start));
  const ends = passes.map((p) => Date.parse(p.end));
  const first = Math.min(...starts);
  const last = Math.max(...ends);
  const span = Math.max(last - first, 1);
  const days = Math.round(span / 86_400_000);

  return (
    <div className={`panel ${styles.timeline}`}>
      <div className={styles.head}>
        <span>
          {shown.length} of {passes.length} passes · {days} days covered
        </span>
        <span className="mono">{totalFrames} frames stacked</span>
      </div>
      <div className={styles.track}>
        {passes.map((p) => {
          const left = ((Date.parse(p.start) - first) / span) * 100;
          const width = ((Date.parse(p.end) - Date.parse(p.start)) / span) * 100;
          const off = hidden.includes(p.index);
          return (
            <div
              key={p.index}
              className={styles.pass}
              data-active={p.index === current}
              data-off={off}
              data-end={left > 70}
              style={{ left: `${Math.min(left, 98)}%`, width: `${Math.max(width, 1.5)}%` }}
              title={`Pass ${p.index}: ${p.start} to ${p.end}, ${p.frames_used} of ${p.frames_total} frames${
                p.wavelength_min_um ? `, ${p.wavelength_min_um}–${p.wavelength_max_um} µm` : ""
              }`}
            >
              <span className={`mono ${styles.passLabel}`}>{off ? "off" : `${p.frames_used} frames`}</span>
            </div>
          );
        })}
      </div>
      <div className={`mono ${styles.axis}`}>
        <span>{passes[0].start}</span>
        <span>{passes.length} passes</span>
        <span>{passes.at(-1)?.end}</span>
      </div>
    </div>
  );
}
