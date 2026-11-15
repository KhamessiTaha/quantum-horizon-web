import { useEffect, useRef, useState } from "react";
import { Link } from "react-router-dom";
import { fetchNearby, type NamedObject } from "../lib/api.ts";
import styles from "./SkyMap.module.css";

const ALADIN_MODULE = "https://cdn.jsdelivr.net/npm/aladin-lite@3.8.2/dist/aladin.js";
const IRSA_HIPS = "https://irsa.ipac.caltech.edu/data/hips/CDS";

const SURVEYS: [string, string][] = [
  [`${IRSA_HIPS}/AllWISE/RGB-W4-W2-W1`, "WISE (3.4–22 µm)"],
  [`${IRSA_HIPS}/2MASS/Color`, "2MASS (1.2–2.2 µm)"],
  [`${IRSA_HIPS}/DSS2/color`, "DSS2 (visible)"],
];

const MAX_LABELS = 8;

/** The best-known objects that sit far enough apart for their labels not to overlap. */
function spreadOut(objects: NamedObject[], spacingDeg: number): Set<string> {
  const chosen: NamedObject[] = [];
  for (const o of objects) {
    if (chosen.length >= MAX_LABELS) break;
    if (chosen.every((c) => angularDistance(c, o) >= spacingDeg)) chosen.push(o);
  }
  return new Set(chosen.map((o) => o.name));
}

interface AladinSource {
  ra: number;
  dec: number;
  data: { name?: string; query?: string; kind?: string };
}

interface AladinCatalog {
  addSources: (sources: unknown[]) => void;
  removeAll: () => void;
}

interface AladinOverlay {
  add: (shape: unknown) => void;
  removeAll: () => void;
}

interface AladinInstance {
  setImageSurvey: (survey: string) => void;
  addCatalog: (catalog: AladinCatalog) => void;
  addOverlay: (overlay: AladinOverlay) => void;
  gotoRaDec: (ra: number, dec: number) => void;
  getRaDec: () => [number, number];
  getFov: () => [number, number];
  setFoV: (fov: number) => void;
  on: (event: string, callback: (payload: never) => void) => void;
}

interface AladinApi {
  init: Promise<void>;
  aladin: (element: HTMLElement, options: Record<string, unknown>) => AladinInstance;
  catalog: (options: Record<string, unknown>) => AladinCatalog;
  source: (ra: number, dec: number, data: Record<string, unknown>) => unknown;
  graphicOverlay: (options: Record<string, unknown>) => AladinOverlay;
  polygon: (corners: [number, number][], options?: Record<string, unknown>) => unknown;
  circle: (ra: number, dec: number, radiusDeg: number, options?: Record<string, unknown>) => unknown;
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

function sexagesimal(ra: number, dec: number): string {
  const pad = (n: number, width: number, digits = 0) => n.toFixed(digits).padStart(width, "0");
  const h = ra / 15;
  const hh = Math.floor(h);
  const mm = Math.floor((h - hh) * 60);
  const ss = ((h - hh) * 60 - mm) * 60;
  const sign = dec < 0 ? "-" : "+";
  const d = Math.abs(dec);
  const dd = Math.floor(d);
  const dm = Math.floor((d - dd) * 60);
  const ds = ((d - dd) * 60 - dm) * 60;
  return `${pad(hh, 2)} ${pad(mm, 2)} ${pad(ss, 5, 2)} ${sign}${pad(dd, 2)} ${pad(dm, 2)} ${pad(ds, 4, 1)}`;
}

function angularDistance(a: { ra: number; dec: number }, b: { ra: number; dec: number }): number {
  const rad = Math.PI / 180;
  const cos =
    Math.sin(a.dec * rad) * Math.sin(b.dec * rad) + Math.cos(a.dec * rad) * Math.cos(b.dec * rad) * Math.cos((a.ra - b.ra) * rad);
  return Math.acos(Math.min(1, Math.max(-1, cos))) / rad;
}

function blinkLink(pick: Picked, detector: string): string {
  const search = pick.query
    ? new URLSearchParams({ target: pick.query })
    : new URLSearchParams({ ra: pick.ra.toFixed(5), dec: pick.dec.toFixed(5) });
  search.set("det", detector);
  search.set("fov", "0.06");
  search.set("mode", "blink");
  return `/view?${search.toString()}`;
}

interface Picked {
  ra: number;
  dec: number;
  name?: string;
  query?: string;
  kind?: string;
}

interface SkyMapProps {
  ra: number;
  dec: number;
  /** Width of the map view, in degrees. */
  viewDeg: number;
  title: string;
  subtitle: string;
  /** The SPHEREx field being blinked, drawn as a square. */
  field?: { ra: number; dec: number; sizeDeg: number };
  detector?: string;
  startOpen?: boolean;
  /** Which survey to open on: 0 WISE, 1 2MASS, 2 DSS2. */
  initialSurvey?: number;
}

/** All-sky imagery with SIMBAD's named objects on top: click anywhere, or on a name, and blink that spot. */
export default function SkyMap({ ra, dec, viewDeg, title, subtitle, field, detector = "D2", startOpen = false, initialSurvey = 0 }: SkyMapProps) {
  const [open, setOpen] = useState(startOpen);
  const [error, setError] = useState<string | null>(null);
  const [survey, setSurvey] = useState(SURVEYS[initialSurvey][0]);
  const [picked, setPicked] = useState<Picked | null>(null);
  const [center, setCenter] = useState({ ra, dec });
  const [objects, setObjects] = useState<NamedObject[]>([]);
  const [namesState, setNamesState] = useState<"idle" | "loading" | "ready" | "failed">("idle");
  const [copied, setCopied] = useState(false);
  const [mapReady, setMapReady] = useState(false);
  const section = useRef<HTMLElement>(null);
  const holder = useRef<HTMLDivElement>(null);
  const instance = useRef<AladinInstance | null>(null);
  const api = useRef<AladinApi | null>(null);
  const labelled = useRef<AladinCatalog | null>(null);
  const selection = useRef<AladinOverlay | null>(null);
  const unlabelled = useRef<AladinCatalog | null>(null);
  const lastObjectClick = useRef(0);
  const moveTimer = useRef<ReturnType<typeof setTimeout> | undefined>(undefined);
  const radius = Math.min(0.5, Math.max(0.05, viewDeg / 2));

  useEffect(() => {
    if (open || !section.current) return;
    const observer = new IntersectionObserver((entries) => {
      if (entries.some((e) => e.isIntersecting)) setOpen(true);
    });
    observer.observe(section.current);
    return () => observer.disconnect();
  }, [open]);

  useEffect(() => {
    if (!open || !holder.current || instance.current) return;
    const state = { cancelled: false };
    load()
      .then(async (aladinApi) => {
        await aladinApi.init;
        if (state.cancelled || !holder.current) return;
        api.current = aladinApi;
        const map = aladinApi.aladin(holder.current, {
          target: `${ra} ${dec}`,
          fov: viewDeg,
          cooFrame: "ICRS",
          showReticle: true,
          showCooGrid: false,
          showFullscreenControl: false,
          showLayersControl: false,
          showGotoControl: false,
        });
        map.setImageSurvey(survey);
        instance.current = map;

        if (field) {
          const overlay = aladinApi.graphicOverlay({ color: "#5cc8ff", lineWidth: 2 });
          map.addOverlay(overlay);
          const half = field.sizeDeg / 2;
          const dra = half / Math.max(Math.cos((field.dec * Math.PI) / 180), 0.05);
          overlay.add(
            aladinApi.polygon([
              [field.ra - dra, field.dec - half],
              [field.ra + dra, field.dec - half],
              [field.ra + dra, field.dec + half],
              [field.ra - dra, field.dec + half],
            ]),
          );
        }

        selection.current = aladinApi.graphicOverlay({ color: "#5cc8ff", lineWidth: 3 });
        map.addOverlay(selection.current);

        labelled.current = aladinApi.catalog({
          name: "Named objects",
          sourceSize: 14,
          color: "#f2a541",
          shape: "circle",
          displayLabel: true,
          labelColumn: "name",
          labelColor: "#f2a541",
          labelFont: "12px IBM Plex Sans, sans-serif",
        });
        unlabelled.current = aladinApi.catalog({ name: "More objects", sourceSize: 10, color: "#f2a541", shape: "circle" });
        map.addCatalog(unlabelled.current);
        map.addCatalog(labelled.current);

        map.on("objectClicked", ((source: AladinSource | null) => {
          if (!source) return;
          lastObjectClick.current = Date.now();
          setPicked({ ra: source.ra, dec: source.dec, name: source.data.name, query: source.data.query, kind: source.data.kind });
        }) as (payload: never) => void);
        map.on("click", ((event: { ra: number; dec: number; isDragging: boolean }) => {
          if (event.isDragging || Date.now() - lastObjectClick.current < 400) return;
          setPicked({ ra: (event.ra + 360) % 360, dec: event.dec });
        }) as (payload: never) => void);
        map.on("positionChanged", ((position: { ra: number; dec: number; dragging?: boolean }) => {
          clearTimeout(moveTimer.current);
          moveTimer.current = setTimeout(() => setCenter({ ra: (position.ra + 360) % 360, dec: position.dec }), 700);
        }) as (payload: never) => void);
        setMapReady(true);
      })
      .catch((reason: unknown) => {
        if (!state.cancelled) setError(reason instanceof Error ? reason.message : "could not load the sky map");
      });
    return () => {
      state.cancelled = true;
    };
  }, [open, ra, dec, viewDeg, survey, field]);

  useEffect(() => {
    instance.current?.setImageSurvey(survey);
  }, [survey]);

  const queried = useRef<{ ra: number; dec: number } | null>(null);
  const request = useRef(0);

  useEffect(() => {
    if (!open) return;
    if (queried.current && angularDistance(queried.current, center) <= radius * 0.6) return;
    queried.current = { ...center };
    const id = ++request.current;
    setNamesState("loading");
    fetchNearby(center.ra, center.dec, radius)
      .then((data) => {
        if (id !== request.current) return;
        setObjects(data.objects);
        setNamesState("ready");
      })
      .catch(() => {
        if (id === request.current) setNamesState("failed");
      });
  }, [open, center, radius]);

  useEffect(() => {
    const aladinApi = api.current;
    if (!mapReady || !aladinApi || !labelled.current || !unlabelled.current) return;
    labelled.current.removeAll();
    unlabelled.current.removeAll();
    const toSource = (o: NamedObject) => aladinApi.source(o.ra, o.dec, { name: o.display, query: o.name, kind: o.kind });
    const labels = spreadOut(objects, viewDeg / 10);
    labelled.current.addSources(objects.filter((o) => labels.has(o.name)).map(toSource));
    unlabelled.current.addSources(objects.filter((o) => !labels.has(o.name)).map(toSource));
  }, [objects, mapReady, viewDeg]);

  useEffect(() => {
    const aladinApi = api.current;
    const overlay = selection.current;
    if (!mapReady || !aladinApi || !overlay) return;
    overlay.removeAll();
    if (picked) overlay.add(aladinApi.circle(picked.ra, picked.dec, Math.max(viewDeg / 40, 0.004)));
  }, [picked, mapReady, viewDeg]);

  function choose(o: NamedObject) {
    setPicked({ ra: o.ra, dec: o.dec, name: o.display, query: o.name, kind: o.kind });
    const map = instance.current;
    if (!map) return;
    map.gotoRaDec(o.ra, o.dec);
    map.setFoV(Math.min(map.getFov()[0], Math.max(viewDeg / 3, 0.1)));
  }

  async function copy(text: string) {
    try {
      await navigator.clipboard.writeText(text);
      setCopied(true);
      setTimeout(() => setCopied(false), 1500);
    } catch {
      setCopied(false);
    }
  }

  return (
    <section ref={section} className={`panel ${styles.card}`} aria-label={title}>
      <div className={styles.head}>
        <div>
          <h2>{title}</h2>
          <p className={styles.sub}>{subtitle}</p>
        </div>
        {startOpen ? null : (
          <button type="button" className="btn" onClick={() => setOpen((o) => !o)} aria-expanded={open}>
            {open ? "Hide map" : "Show map"}
          </button>
        )}
      </div>
      {open ? (
        <>
          <div className={styles.surveys} role="group" aria-label="Survey">
            {SURVEYS.map(([id, label]) => (
              <button key={id} type="button" className="btn toggle mono" aria-pressed={survey === id} onClick={() => setSurvey(id)}>
                {label}
              </button>
            ))}
          </div>
          <div className={styles.body}>
            {error ? (
              <p className={styles.note}>The sky map could not load: {error}. Everything else on this page works without it.</p>
            ) : (
              <div ref={holder} className={styles.sky} />
            )}
            <aside className={styles.side}>
              <div className={styles.pick} aria-live="polite">
                {picked ? (
                  <>
                    <span className={styles.term}>{picked.name ? picked.kind || "Named object" : "Position"}</span>
                    {picked.name ? <span className={styles.pickName}>{picked.name}</span> : null}
                    <span className={`mono ${styles.coords}`}>{sexagesimal(picked.ra, picked.dec)}</span>
                    <span className={`mono ${styles.degrees}`}>
                      {picked.ra.toFixed(4)}° {picked.dec >= 0 ? "+" : ""}
                      {picked.dec.toFixed(4)}°
                    </span>
                    <div className={styles.actions}>
                      <Link
                        to={blinkLink(picked, detector)}
                        className="btn btn-primary"
                        onClick={() => window.scrollTo({ top: 0, behavior: "smooth" })}
                      >
                        Blink this
                      </Link>
                      <button type="button" className="btn" onClick={() => copy(sexagesimal(picked.ra, picked.dec))}>
                        {copied ? "Copied" : "Copy coordinates"}
                      </button>
                    </div>
                  </>
                ) : (
                  <p className={styles.hint}>
                    Click anywhere on the sky, or on an amber name, then blink that spot. Coordinates copied from here also
                    work in the search box.
                  </p>
                )}
              </div>
              <div className={styles.names}>
                <span className={styles.term}>
                  {namesState === "loading" ? "Looking up named objects…" : namesState === "failed" ? "Names unavailable right now" : "Named objects in view"}
                </span>
                {objects.length ? (
                  <ul>
                    {objects.slice(0, 14).map((o) => (
                      <li key={o.name}>
                        <button
                          type="button"
                          className={styles.nameButton}
                          aria-pressed={picked?.query === o.name}
                          onClick={() => choose(o)}
                        >
                          <span>{o.display}</span>
                          <span className={styles.kind}>{o.kind}</span>
                        </button>
                      </li>
                    ))}
                  </ul>
                ) : null}
              </div>
            </aside>
          </div>
          <p className={styles.sub}>
            Imagery: WISE, 2MASS and DSS2 surveys served by NASA/IPAC IRSA. Names and positions: SIMBAD (J2000). Viewer:
            Aladin Lite, CDS/Strasbourg.
          </p>
        </>
      ) : null}
    </section>
  );
}
