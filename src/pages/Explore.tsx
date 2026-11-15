import { lazy, Suspense } from "react";
import { useSearchParams } from "react-router-dom";
import FullscreenFrame from "../components/FullscreenFrame.tsx";
import styles from "./Explore.module.css";

const Neighbourhood3D = lazy(() => import("../components/Neighbourhood3D.tsx"));
const SolarSystem3D = lazy(() => import("../components/SolarSystem3D.tsx"));
const ModelViewer = lazy(() => import("../components/ModelViewer.tsx"));

type Tab = "neighbourhood" | "solar" | "models";

const TABS: { id: Tab; label: string; intro: string }[] = [
  {
    id: "neighbourhood",
    label: "Stars near the Sun",
    intro: "163 stars and brown dwarfs within about 7 parsecs, placed by their SIMBAD parallaxes. Click one, then blink it with SPHEREx.",
  },
  {
    id: "solar",
    label: "Solar System",
    intro: "The planets and 7,533 real asteroids, comets and distant objects from NASA/JPL, moving along their orbits. Click anything to follow it.",
  },
  {
    id: "models",
    label: "Models",
    intro: "Every kind of body in the tool as a rotating impression, from the hottest stars to the coldest brown dwarfs, the planets and the small bodies.",
  },
];

const FULL_HEIGHT = "calc(100vh - 90px)";
const PAGE_HEIGHT = "min(74vh, 760px)";

export default function Explore() {
  const [params, setParams] = useSearchParams();
  const requested = params.get("view");
  const tab: Tab = requested === "solar" || requested === "models" ? requested : "neighbourhood";
  const current = TABS.find((t) => t.id === tab) ?? TABS[0];

  return (
    <main className={`container ${styles.page}`}>
      <div className={styles.head}>
        <h1>Explore in 3D</h1>
        <p>{current.intro}</p>
      </div>
      <div className={styles.tabs} role="tablist" aria-label="Explore">
        {TABS.map((t) => (
          <button
            key={t.id}
            type="button"
            role="tab"
            className="btn toggle"
            aria-selected={t.id === tab}
            onClick={() => setParams(t.id === "neighbourhood" ? {} : { view: t.id }, { replace: true })}
          >
            {t.label}
          </button>
        ))}
      </div>
      <FullscreenFrame key={tab} label={current.label}>
        {(full) => (
          <Suspense fallback={<p className={styles.loading}>Loading…</p>}>
            {tab === "neighbourhood" ? (
              <Neighbourhood3D height={full ? FULL_HEIGHT : PAGE_HEIGHT} />
            ) : tab === "solar" ? (
              <SolarSystem3D height={full ? FULL_HEIGHT : PAGE_HEIGHT} />
            ) : (
              <ModelViewer full={full} />
            )}
          </Suspense>
        )}
      </FullscreenFrame>
    </main>
  );
}
