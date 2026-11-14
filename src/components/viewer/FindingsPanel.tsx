import Badge, { type Confidence } from "../Badge.tsx";
import type { FramesResponse } from "../../lib/api.ts";
import styles from "./FindingsPanel.module.css";

const FLAG_HELP: Record<string, string> = {
  SOURCE: "a known source sits in this pixel, which is expected here",
  BLOOM: "blooming around a saturated source",
  OVERFLOW: "nearing saturation",
  SUR_ERROR: "possible error in the ramp fit, common on bright sources",
  TRANSIENT: "a transient in the ramp, usual on bright sources, a cosmic ray elsewhere",
  NONLINEAR: "beyond the nonlinearity correction",
  PERSIST: "persistent charge from an earlier exposure",
  GHOST: "optical ghost of a bright source",
  GHOST_EXT: "ghost from a source outside the field",
  CROSSTALK: "detector crosstalk",
  HALO: "transient halo",
  STREAK: "satellite or debris streak",
};

function arcsec(value: number | null | undefined, digits = 2): string {
  return value === null || value === undefined ? "—" : `${value.toFixed(digits)}″`;
}

export default function FindingsPanel({ frames }: { frames: FramesResponse | null }) {
  const measurement = frames?.measurement ?? null;
  const motion = measurement?.motion ?? null;
  const confidence: Confidence = (motion?.confidence ?? "pending") as Confidence;
  const flags = [...new Set((frames?.frames ?? []).flatMap((f) => f.flags_at_target))].sort();
  const used = (frames?.frames ?? []).filter((f) => f.status === "used").length;
  const failed = (frames?.frames ?? []).filter((f) => f.status !== "used").length;

  return (
    <aside aria-label="Findings" className={styles.aside}>
      <section className={`panel ${styles.card}`}>
        <div className={styles.cardHead}>
          <h2>Motion</h2>
          <Badge confidence={confidence} />
        </div>
        <div className={styles.headline}>
          <span className={`mono ${styles.value}`}>
            {motion?.measured_arcsec !== null && motion?.measured_arcsec !== undefined
              ? `${motion.measured_arcsec.toFixed(2)} ± ${(motion.sigma_arcsec ?? 0).toFixed(2)}″`
              : "—"}
          </span>
          <span className={styles.sub}>
            {motion
              ? `measured between pass ${motion.from_pass} and pass ${motion.to_pass}, over ${motion.baseline_years.toFixed(2)} yr`
              : "measured motion, with its uncertainty"}
          </span>
        </div>
        <div className={styles.compare}>
          <div>
            <span className={styles.term}>Catalog prediction</span>
            <span className={`mono ${styles.predicted}`}>{arcsec(motion?.predicted_arcsec)}</span>
          </div>
          <div>
            <span className={styles.term}>Difference</span>
            <span className="mono">
              {motion?.difference_arcsec !== null && motion?.difference_arcsec !== undefined
                ? `${motion.difference_arcsec > 0 ? "+" : ""}${motion.difference_arcsec.toFixed(2)}″`
                : "—"}
            </span>
          </div>
          <div>
            <span className={styles.term}>Direction measured</span>
            <span className="mono">{motion?.measured_pa_deg !== null && motion?.measured_pa_deg !== undefined ? `${motion.measured_pa_deg.toFixed(0)}° PA` : "—"}</span>
          </div>
          <div>
            <span className={styles.term}>Direction predicted</span>
            <span className={`mono ${styles.predicted}`}>
              {motion?.predicted_pa_deg !== null && motion?.predicted_pa_deg !== undefined ? `${motion.predicted_pa_deg.toFixed(0)}° PA` : "—"}
            </span>
          </div>
        </div>
        <p className={styles.note}>
          {motion?.summary ??
            "A plain-language explanation of the result appears here, including how far the data can be trusted."}
        </p>
        {motion?.significance ? (
          <p className={`mono ${styles.fine}`}>
            {motion.significance.toFixed(1)}σ detection · {motion.pixels?.toFixed(2)} pixels ·{" "}
            {motion.measured_arcsec_per_year?.toFixed(2)}″ per year measured against{" "}
            {motion.predicted_arcsec_per_year?.toFixed(2)}″ predicted
          </p>
        ) : null}
      </section>

      <section className={`panel ${styles.card}`}>
        <h2>Per pass</h2>
        {measurement?.passes.length ? (
          <table className={styles.table}>
            <thead>
              <tr>
                <th>Pass</th>
                <th>Date</th>
                <th>Frames</th>
                <th>S/N</th>
                <th>Offset</th>
              </tr>
            </thead>
            <tbody>
              {measurement.passes.map((p) => {
                const info = frames?.passes.find((q) => q.index === p.index);
                return (
                  <tr key={p.index} data-confidence={p.confidence}>
                    <td className="mono">{p.index}</td>
                    <td className="mono">{info?.mid_date ?? "—"}</td>
                    <td className="mono">
                      {p.frames_fit}
                      {p.frames_rejected ? <span className={styles.rejected}> −{p.frames_rejected}</span> : null}
                    </td>
                    <td className="mono">{p.snr ? p.snr.toFixed(0) : "—"}</td>
                    <td className="mono">{arcsec(p.offset_from_predicted_arcsec)}</td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        ) : (
          <p className={styles.note}>Dates, frame counts and measured offsets for each pass.</p>
        )}
        <p className={`mono ${styles.fine}`}>
          Offset is the distance between the measured position and the catalog prediction for that pass. Frames shown
          as −n were rejected for low signal or for disagreeing with the rest of the pass.
        </p>
      </section>

      <section className={`panel ${styles.card}`}>
        <div className={styles.cardHead}>
          <h2>Data quality</h2>
          {measurement ? (
            <span className={styles.badgeGroup}>
              brightness
              <Badge confidence={measurement.photometry_confidence as Confidence} />
            </span>
          ) : null}
        </div>
        <dl className={styles.quality}>
          <div className={styles.qualityRow}>
            <dt>Releases</dt>
            <dd className="mono">{frames?.releases.join(", ").toUpperCase() || "—"}</dd>
          </div>
          <div className={styles.qualityRow}>
            <dt>Frames used</dt>
            <dd className="mono">
              {frames ? `${used}${failed ? ` of ${used + failed}` : ""}` : "—"}
            </dd>
          </div>
          <div className={styles.qualityRow}>
            <dt>Pixel scale</dt>
            <dd className="mono">{frames ? `${frames.grid.pixel_arcsec}″` : "—"}</dd>
          </div>
          <div className={styles.qualityRow}>
            <dt>Aperture</dt>
            <dd className="mono">{measurement ? `${measurement.aperture_arcsec}″` : "—"}</dd>
          </div>
          <div className={styles.qualityRow}>
            <dt>Zodiacal light</dt>
            <dd className="mono">{frames ? "model subtracted" : "—"}</dd>
          </div>
          <div className={styles.qualityRow}>
            <dt>Served from</dt>
            <dd className="mono">{frames ? (frames.from_cache ? "cache" : `archive · ${frames.elapsed_s}s`) : "—"}</dd>
          </div>
        </dl>
        {flags.length ? (
          <details className={styles.flags}>
            <summary className={styles.summary}>
              {flags.length} quality flag{flags.length === 1 ? "" : "s"} on the source
            </summary>
            <ul>
              {flags.map((flag) => (
                <li key={flag}>
                  <code>{flag}</code>
                  {FLAG_HELP[flag] ? <span> — {FLAG_HELP[flag]}</span> : null}
                </li>
              ))}
            </ul>
          </details>
        ) : null}
        {frames?.notes.length ? (
          <ul className={styles.notes}>
            {frames.notes.map((note) => (
              <li key={note}>{note}</li>
            ))}
          </ul>
        ) : null}
      </section>

      {measurement ? (
        <details className={`panel ${styles.card}`}>
          <summary className={styles.summary}>How this was measured</summary>
          <p className={styles.note}>{measurement.method}</p>
        </details>
      ) : null}
    </aside>
  );
}
