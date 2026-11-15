import { Link } from "react-router-dom";
import SURVEY from "../data/asteroid_survey.json";
import styles from "./SurveyBand.module.css";

const PIXEL_ARCSEC = 6.15;

interface Row {
  status: string;
  offset_arcsec?: number | null;
  sigma_arcsec?: number | null;
  label?: string;
}

const ROWS = (SURVEY as { results: Row[] }).results;
const MEASURED = ROWS.filter((r) => r.status === "ok" && r.offset_arcsec != null && r.sigma_arcsec != null);
const CONSISTENT = MEASURED.filter((r) => (r.offset_arcsec as number) <= Math.max(3 * (r.sigma_arcsec as number), PIXEL_ARCSEC));
const OFFSETS = MEASURED.map((r) => r.offset_arcsec as number).sort((a, b) => a - b);
const TYPICAL = OFFSETS.length ? OFFSETS[Math.floor(OFFSETS.length / 2)] : null;

/** The headline result on the home page: the asteroid orbit check, with its numbers read from the survey file. */
export default function SurveyBand() {
  if (!MEASURED.length) return null;
  return (
    <section className={`container ${styles.band}`} aria-label="Result">
      <div className={styles.text}>
        <span className={`mono ${styles.eyebrow}`}>Our result</span>
        <h2>We checked NASA/JPL's orbits for {ROWS.length} asteroids against SPHEREx.</h2>
        <p>
          Each asteroid was tracked through every SPHEREx exposure that caught it and measured against where its orbit says it
          should be. The same test underpins any search for an unseen planet: known bodies must land where predicted.
        </p>
        <Link to="/survey" className="btn btn-primary">
          See every asteroid
        </Link>
      </div>
      <dl className={styles.numbers}>
        <div>
          <dt>Detected and measured</dt>
          <dd className="mono">{MEASURED.length}</dd>
        </div>
        <div>
          <dt>Agree with their orbit</dt>
          <dd className="mono">
            {CONSISTENT.length} of {MEASURED.length}
          </dd>
        </div>
        <div>
          <dt>Typical offset</dt>
          <dd className="mono">{TYPICAL !== null ? `${TYPICAL.toFixed(1)}″` : "—"}</dd>
        </div>
        <div>
          <dt>In SPHEREx pixels</dt>
          <dd className="mono">{TYPICAL !== null ? (TYPICAL / PIXEL_ARCSEC).toFixed(2) : "—"}</dd>
        </div>
      </dl>
    </section>
  );
}
