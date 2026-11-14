import { useEffect, useRef, useState } from "react";
import styles from "./Chart.module.css";

const ALADIN_MODULE = "https://cdn.jsdelivr.net/npm/aladin-lite@3.8.2/dist/aladin.js";

const IRSA_HIPS = "https://irsa.ipac.caltech.edu/data/hips/CDS";

const SURVEYS = {
  wise: `${IRSA_HIPS}/AllWISE/RGB-W4-W2-W1`,
  twomass: `${IRSA_HIPS}/2MASS/Color`,
  dss: `${IRSA_HIPS}/DSS2/color`,
};

interface AladinApi {
  init: Promise<void>;
  aladin: (element: HTMLElement, options: Record<string, unknown>) => AladinInstance;
}

interface AladinInstance {
  setImageSurvey: (survey: string) => void;
  addCatalog: (catalog: unknown) => void;
  catalogFromSimbad?: (target: string, radius: number, options: Record<string, unknown>) => unknown;
}

let loading: Promise<AladinApi> | null = null;

function load(): Promise<AladinApi> {
  loading ??= import(/* @vite-ignore */ ALADIN_MODULE)
    .then((module: { default: AladinApi }) => module.default)
    .catch(() => {
      loading = null;
      throw new Error("the sky-map library could not be reached");
    });
  return loading;
}

/** Where this field sits in the wider sky, on survey imagery served by CDS. */
export default function SkyContext({ ra, dec, fovDeg, name }: { ra: number; dec: number; fovDeg: number; name: string }) {
  const [open, setOpen] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [survey, setSurvey] = useState(SURVEYS.wise);
  const holder = useRef<HTMLDivElement>(null);
  const instance = useRef<AladinInstance | null>(null);

  useEffect(() => {
    if (!open || !holder.current || instance.current) return;
    let cancelled = false;
    load()
      .then(async (api) => {
        await api.init;
        if (cancelled || !holder.current) return;
        instance.current = api.aladin(holder.current, {
          survey,
          target: `${ra} ${dec}`,
          fov: Math.max(fovDeg * 6, 0.3),
          cooFrame: "ICRS",
          showReticle: true,
          showCooGrid: false,
          showFullscreenControl: false,
          showLayersControl: false,
          showGotoControl: false,
        });
        instance.current.setImageSurvey(survey);
      })
      .catch((reason: unknown) => {
        if (!cancelled) setError(reason instanceof Error ? reason.message : "could not load the sky map");
      });
    return () => {
      cancelled = true;
    };
  }, [open, ra, dec, fovDeg, survey]);

  useEffect(() => {
    instance.current?.setImageSurvey(survey);
  }, [survey]);

  return (
    <section className={`panel ${styles.card}`} aria-label="Sky context">
      <div className={styles.head}>
        <div>
          <h2>Where this is in the sky</h2>
          <p className={styles.sub}>
            {name} on all-sky survey imagery, for context around the {(fovDeg * 60).toFixed(1)}′ SPHEREx field.
          </p>
        </div>
        <button type="button" className="btn" onClick={() => setOpen((o) => !o)} aria-expanded={open}>
          {open ? "Hide map" : "Show map"}
        </button>
      </div>
      {open ? (
        <>
          <div className={styles.legend}>
            {[
              [SURVEYS.wise, "WISE (3.4–22 µm)"],
              [SURVEYS.twomass, "2MASS (1.2–2.2 µm)"],
              [SURVEYS.dss, "DSS2 (visible)"],
            ].map(([id, label]) => (
              <button
                key={id}
                type="button"
                className="btn toggle mono"
                aria-pressed={survey === id}
                onClick={() => setSurvey(id)}
              >
                {label}
              </button>
            ))}
          </div>
          {error ? (
            <p className={styles.note}>
              The sky map could not load: {error}. Everything else on this page works without it.
            </p>
          ) : (
            <div ref={holder} className={styles.sky} />
          )}
          <p className={styles.sub}>Imagery: WISE, 2MASS and DSS2 hierarchical surveys served by NASA/IPAC IRSA. Viewer: Aladin Lite, CDS/Strasbourg.</p>
        </>
      ) : null}
    </section>
  );
}
