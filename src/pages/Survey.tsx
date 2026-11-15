import { useMemo, useState } from "react";
import { Link } from "react-router-dom";
import Badge from "../components/Badge.tsx";
import SURVEY from "../data/asteroid_survey.json";
import { trackLink } from "../data/asteroids.ts";
import type { Confidence } from "../lib/api.ts";
import { CLASS_LABEL } from "../lib/orbits.ts";
import styles from "./Survey.module.css";

const PIXEL_ARCSEC = 6.15;

interface Row {
  name: string;
  designation: string;
  class: string;
  H: number;
  diameter_km: number | null;
  detector: string;
  status: string;
  exposures?: number;
  frames?: number;
  detected_frames?: number;
  saturated_frames?: number;
  typical_vmag?: number | null;
  stack_snr?: number | null;
  offset_arcsec?: number | null;
  sigma_arcsec?: number | null;
  label?: Confidence;
  reason?: string;
}

type Sort = "offset" | "brightness" | "name";

const ROWS = (SURVEY as { results: Row[] }).results;
const DETECTOR = (SURVEY as { detector: string }).detector;

function median(values: number[]): number | null {
  if (!values.length) return null;
  const sorted = [...values].sort((a, b) => a - b);
  const mid = Math.floor(sorted.length / 2);
  return sorted.length % 2 ? sorted[mid] : (sorted[mid - 1] + sorted[mid]) / 2;
}

export default function Survey() {
  const [sort, setSort] = useState<Sort>("offset");
  const tracked = ROWS.filter((r) => r.status === "ok");
  const measured = tracked.filter((r) => r.offset_arcsec !== null && r.offset_arcsec !== undefined && r.sigma_arcsec !== null);
  const notSeen = tracked.filter((r) => r.label === "not-measurable");
  const consistent = measured.filter((r) => (r.offset_arcsec as number) <= Math.max(3 * (r.sigma_arcsec as number), PIXEL_ARCSEC));
  const outliers = measured.filter((r) => !consistent.includes(r));
  const typical = median(measured.map((r) => r.offset_arcsec as number));
  const clean = measured.filter((r) => r.label === "measured");

  const edges = [0, 0.25, 0.5, 0.75, 1, 1.5, 2, 3];
  const bins = edges.map((low, i) => {
      const high = edges[i + 1] ?? Infinity;
      const inBin = measured.filter((r) => {
        const px = (r.offset_arcsec as number) / PIXEL_ARCSEC;
        return px >= low && px < high;
      });
      return { label: high === Infinity ? `${low}+` : `${low}–${high}`, count: inBin.length, clean: inBin.filter((r) => r.label === "measured").length };
  });
  const tallest = Math.max(1, ...bins.map((b) => b.count));

  const rows = useMemo(() => {
    const list = [...ROWS];
    if (sort === "name") list.sort((a, b) => a.name.localeCompare(b.name));
    else if (sort === "brightness") list.sort((a, b) => a.H - b.H);
    else list.sort((a, b) => (b.offset_arcsec ?? -1) / Math.max(b.sigma_arcsec ?? 1, 0.1) - (a.offset_arcsec ?? -1) / Math.max(a.sigma_arcsec ?? 1, 0.1));
    return list;
  }, [sort]);

  return (
    <main className={`container ${styles.page}`}>
      <header className={styles.head}>
        <span className={`mono ${styles.eyebrow}`}>Result · SPHEREx {DETECTOR} · {ROWS.length} asteroids</span>
        <h1>Do the asteroids sit where JPL says they should?</h1>
        <p>
          We tracked the largest main-belt and near-Earth asteroids through every SPHEREx exposure that caught them, centring each frame on the
          position NASA/JPL's orbit predicts for that moment, and measured how far the asteroid actually sits from it. This is
          the same test a search for an unseen planet relies on: if the known bodies land where their orbits say, anything
          that does not is worth a second look.
        </p>
      </header>

      <section className={styles.stats} aria-label="Summary">
        <div>
          <strong className="mono">{measured.length}</strong>
          <span>asteroids detected and measured</span>
        </div>
        <div>
          <strong className="mono">{typical !== null ? `${typical.toFixed(1)}″` : "—"}</strong>
          <span>typical offset from JPL's prediction ({typical !== null ? (typical / PIXEL_ARCSEC).toFixed(2) : "—"} SPHEREx pixels)</span>
        </div>
        <div>
          <strong className="mono">
            {consistent.length} of {measured.length}
          </strong>
          <span>agree with their orbit within the uncertainty or one pixel</span>
        </div>
        <div>
          <strong className="mono">{notSeen.length}</strong>
          <span>not seen, reported as such rather than matched to a passing star</span>
        </div>
      </section>

      <section className={`panel ${styles.chart}`} aria-label="Offsets">
        <div className={styles.chartHead}>
          <h2>Offset from the predicted position</h2>
          <span>
            in SPHEREx pixels of 6.15″ · <i className={styles.keyClean} /> measured <i className={styles.keyIndicative} /> indicative or
            marginal
          </span>
        </div>
        <div className={styles.bars}>
          {bins.map((b) => (
            <div key={b.label} className={styles.bar}>
              <span className="mono">{b.count || ""}</span>
              <div className={styles.column} style={{ height: `${(b.count / tallest) * 100}%` }}>
                <div className={styles.columnClean} style={{ height: `${b.count ? (b.clean / b.count) * 100 : 0}%` }} />
              </div>
              <span className={`mono ${styles.binLabel}`}>{b.label}</span>
            </div>
          ))}
        </div>
        <p className={styles.chartNote}>
          {clean.length} {clean.length === 1 ? "asteroid is" : "asteroids are"} faint enough to measure cleanly; the rest saturate SPHEREx at their brightest, so their
          positions come from the edges of the image and are labelled indicative.
          {outliers.length
            ? outliers.length === 1
              ? ` One, ${outliers[0].name}, sits further from its orbit than its uncertainty allows. It is flagged in the table and rests on only ${outliers[0].detected_frames} frames; a nearby star can pull a centroid, so it is not claimed as a discovery.`
              : ` ${outliers.length} sit further from their orbits than their uncertainties allow. They are flagged in the table; each rests on few frames, and a nearby star can pull a centroid, so none is claimed as a discovery.`
            : " None sits further from its orbit than the uncertainty allows."}
        </p>
      </section>

      <section className={styles.tableWrap} aria-label="Every asteroid">
        <div className={styles.tableHead}>
          <h2>Every asteroid</h2>
          <div className={styles.sorts} role="group" aria-label="Sort by">
            {(["offset", "brightness", "name"] as Sort[]).map((s) => (
              <button key={s} type="button" className={styles.sort} aria-pressed={sort === s} onClick={() => setSort(s)}>
                {s === "offset" ? "Least consistent first" : s === "brightness" ? "Brightest first" : "Name"}
              </button>
            ))}
          </div>
        </div>
        <div className={styles.scroll}>
          <table className={styles.table}>
            <thead>
              <tr>
                <th>Asteroid</th>
                <th>Kind</th>
                <th>V</th>
                <th>Frames seen</th>
                <th>Offset from JPL</th>
                <th>Label</th>
                <th />
              </tr>
            </thead>
            <tbody>
              {rows.map((r) => (
                <tr key={r.designation} data-outlier={outliers.includes(r) ? "true" : undefined}>
                  <td>{r.name}</td>
                  <td className={styles.kind}>{CLASS_LABEL[r.class] ?? r.class}</td>
                  <td className={`mono ${styles.predicted}`}>{r.typical_vmag !== null && r.typical_vmag !== undefined ? r.typical_vmag.toFixed(1) : "—"}</td>
                  <td className="mono">{r.status === "ok" ? `${r.detected_frames}/${r.frames}` : "—"}</td>
                  <td className={`mono ${styles.measured}`}>
                    {r.offset_arcsec !== null && r.offset_arcsec !== undefined
                      ? `${r.offset_arcsec.toFixed(1)}${r.sigma_arcsec !== null && r.sigma_arcsec !== undefined ? ` ± ${r.sigma_arcsec.toFixed(1)}` : ""}″`
                      : r.status === "ok"
                        ? "not seen"
                        : "no SPHEREx data"}
                  </td>
                  <td>{r.label ? <Badge confidence={r.label} /> : null}</td>
                  <td>
                    {r.status === "ok" ? (
                      <Link to={trackLink(r.name, DETECTOR, r.designation)} className={styles.blink}>
                        Blink →
                      </Link>
                    ) : null}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>

      <p className={styles.method}>
        Method: the exposure list and predicted positions come from IRSA's Moving Object Search Tool with JPL Horizons; up to
        16 exposures per asteroid on {DETECTOR} are read from the SPHEREx archive on AWS and cut out around the prediction. An
        asteroid counts as seen only if it stands out at the predicted position in the median of all its frames, where the
        stars cancel. Offsets are the mean of the per-frame offsets as a vector, with the standard error of that mean. The
        list is the {ROWS.length} largest main-belt and near-Earth asteroids by absolute magnitude, from NASA/JPL's Small-Body
        Database.{" "}
        <Link to="/methods">More on the methods and limits</Link>.
      </p>
    </main>
  );
}
