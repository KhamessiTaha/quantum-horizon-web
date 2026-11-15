import { Link } from "react-router-dom";
import Body3D from "./Body3D.tsx";
import { findNeighbour, isReady } from "../lib/neighbours.ts";
import { blinkLink, KIND_LABEL, kindOf, LIGHT_YEARS_PER_PC } from "../lib/stellar.ts";
import styles from "./NeighbourGallery.module.css";

const LINEUP = ["Alpha Centauri A", "Barnard's Star", "Luhman 16", "Epsilon Indi B", "WISE 0855-0714"];

const STARS = LINEUP.map((name) => findNeighbour(name)).filter((s) => s !== null);

/** Five neighbours from hottest to coldest, each an impression rendered from its SIMBAD spectral type. */
export default function NeighbourGallery() {
  return (
    <div className={styles.wrap}>
      <ol className={styles.row}>
        {STARS.map((star) => {
          const kind = kindOf(star);
          return (
            <li key={star.id} className={styles.card}>
              <Link to={blinkLink(star, kind)} className={styles.link}>
                <Body3D kind={kind} id={star.id} className={styles.stage} caption={false} />
                <span className={styles.name}>{star.name}</span>
                <span className={styles.kind}>
                  {KIND_LABEL[kind]} · <span className="mono">{star.sp}</span>
                </span>
                <span className={`mono ${styles.distance}`}>
                  {(star.d * LIGHT_YEARS_PER_PC).toFixed(1)} light years
                </span>
                <span className={styles.cta}>
                  Blink it {isReady(star) ? <span className={styles.ready}>ready</span> : null}
                </span>
              </Link>
            </li>
          );
        })}
      </ol>
      <p className={styles.note}>
        Hotter to colder, left to right. Each body is an artist’s impression chosen from its spectral type, not an
        image: SPHEREx sees every one of them as a point of light.
      </p>
    </div>
  );
}
