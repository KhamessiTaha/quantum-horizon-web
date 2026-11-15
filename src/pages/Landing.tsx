import { useSearchParams } from "react-router-dom";
import { lazy, Suspense, useState } from "react";
import HeroBlink from "../components/HeroBlink.tsx";
import HeroSky from "../components/HeroSky.tsx";
import SearchBox from "../components/SearchBox.tsx";
import SkyMap from "../components/SkyMap.tsx";
import TargetCard from "../components/TargetCard.tsx";
import { FEATURED_TARGETS } from "../data/featuredTargets.ts";
import NEIGHBOURS from "../data/neighbourhood.json";
import { fetchFrames, imageUrl, type FramesResponse } from "../lib/api.ts";
import { useAsync } from "../lib/useAsync.ts";
import styles from "./Landing.module.css";

const Neighbourhood3D = lazy(() => import("../components/Neighbourhood3D.tsx"));

const HERO_TARGET = { target: "Barnard's Star", ra: null, dec: null, detector: "D2", fovDeg: 0.06 };

const STATS = [
  { value: "102", label: "infrared bands, 0.75–5 µm" },
  { value: "6", label: "detectors, stacked or in colour" },
  { value: "6 months", label: "to map the whole sky again" },
  { value: "5 of 5", label: "challenge targets measured" },
  { value: String((NEIGHBOURS as unknown[]).length), label: "neighbours in 3D, from SIMBAD" },
];

const STEPS = [
  {
    n: "01 · Find",
    title: "Every image of that spot",
    body: "Queries the NASA/IPAC archive for every SPHEREx exposure covering your position, including the latest weekly release.",
  },
  {
    n: "02 · Align",
    title: "One grid, one moment",
    body: "Reprojects every frame onto a common grid and moves catalog positions to each frame's date, so only real changes remain.",
  },
  {
    n: "03 · Measure",
    title: "Numbers you can trust",
    body: "Motion, brightness and spectrum over time, each with an uncertainty and a plain label for how far the data can be trusted.",
  },
];

export default function Landing() {
  const hero = useAsync<FramesResponse>((signal) => fetchFrames(HERO_TARGET, signal), "landing-hero");
  const motion = hero.data?.measurement?.motion ?? null;
  const [activePass, setActivePass] = useState<number | null>(null);
  const [params] = useSearchParams();
  const [explore, setExplore] = useState<"sky" | "3d">(params.get("explore") === "sky" ? "sky" : "3d");
  const strip = [
    ...(hero.data?.passes.map((p) => ({ label: `Pass ${p.index} · ${p.mid_date}`, image: p.image, pass: p.index })) ?? []),
    ...(hero.data?.difference_image ? [{ label: "Difference", image: hero.data.difference_image }] : []),
  ];

  return (
    <main>
      <div className={styles.heroBand}>
        <HeroSky />
        <section className={`container ${styles.hero}`}>
          <div className={styles.heroText}>
            <p className={`mono ${styles.eyebrow}`}>NASA SPHEREx · 102 infrared bands · the whole sky every six months</p>
            <h1 className={styles.title}>
              Blink the infrared sky.
              <br />
              Measure what moved.
            </h1>
            <p className={styles.lead}>
              In 1930, Pluto was found by comparing two photographs of the same patch of sky. Quantum Horizon does the
              same with every SPHEREx image of any position you choose, then tells you how far things moved, how they
              changed, and how sure that measurement is.
            </p>
            <SearchBox />
            <a href="#sky" className={styles.skyLink}>
              Don't know a name? Fly through the neighbourhood in 3D ↓
            </a>
          </div>
          <figure className={styles.heroFigure}>
            <HeroBlink
              passes={hero.data?.passes ?? []}
              width={hero.data?.grid.width_px ?? 35}
              height={hero.data?.grid.height_px ?? 35}
              name="Barnard's Star"
              onPass={setActivePass}
            />
            <div className={styles.strip}>
              {(strip.length ? strip : [1, 2, 3, 4].map((n) => ({ label: "", image: "" , key: n }))).map((item, index) => (
                <div
                  key={item.label || index}
                  className={styles.stripItem}
                  data-active={"pass" in item && item.pass === activePass}
                >
                  {item.image ? (
                    <img
                      src={imageUrl(item.image)}
                      alt={`Barnard's Star, ${item.label}`}
                      className={styles.frameImage}
                      loading="lazy"
                    />
                  ) : (
                    <div className={styles.framePlaceholder} role="img" aria-label="Loading a SPHEREx frame" />
                  )}
                  <span className="mono">{item.label || "loading"}</span>
                </div>
              ))}
            </div>
            <figcaption className={`panel ${styles.caption}`}>
              <span>Barnard's Star · detector 2 · {hero.data?.passes.length ?? 3} passes of real SPHEREx data</span>
              <span className="mono">
                {motion?.measured_arcsec
                  ? `measured ${motion.measured_arcsec.toFixed(2)} ± ${(motion.sigma_arcsec ?? 0).toFixed(2)}″ · catalog ${motion.predicted_arcsec?.toFixed(2)}″`
                  : hero.error
                    ? "frames could not be loaded"
                    : "loading frames from the archive"}
              </span>
            </figcaption>
          </figure>
        </section>
      </div>

      <div className="container">
        <section className={styles.stats} aria-label="At a glance">
          {STATS.map((s) => (
            <div key={s.label} className={styles.stat}>
              <span className={`mono ${styles.statValue}`}>{s.value}</span>
              <span className={styles.statLabel}>{s.label}</span>
            </div>
          ))}
        </section>
      </div>

      <section id="targets" className={`container ${styles.targets}`}>
        <div className={styles.sectionHead}>
          <h2>Start with a test target</h2>
          <p>The five sources named in the challenge, measured on real SPHEREx data. Hover a card to blink it.</p>
        </div>
        <div className={styles.cards}>
          {FEATURED_TARGETS.map((t) => (
            <TargetCard key={t.slug} target={t} />
          ))}
        </div>
      </section>

      <section id="sky" className={`container ${styles.explore}`}>
        <div className={styles.sectionHead}>
          <h2>Explore, then blink</h2>
          <p>Fly through the Sun's neighbourhood in 3D, or pan the infrared sky, and blink anything you find.</p>
        </div>
        <div className={styles.exploreTabs} role="tablist" aria-label="Explore">
          <button type="button" role="tab" className="btn toggle" aria-selected={explore === "3d"} onClick={() => setExplore("3d")}>
            3D neighbourhood
          </button>
          <button type="button" role="tab" className="btn toggle" aria-selected={explore === "sky"} onClick={() => setExplore("sky")}>
            Sky map
          </button>
        </div>
        {explore === "3d" ? (
          <Suspense fallback={<p className={styles.exploreLoading}>Loading the 3D neighbourhood…</p>}>
            <Neighbourhood3D />
          </Suspense>
        ) : (
          <SkyMap
          ra={83.8221}
          dec={-5.3911}
          viewDeg={9}
          initialSurvey={0}
          title="Explore the sky"
          subtitle="Orion in the infrared, as NASA’s WISE saw it. Scroll to zoom into anything, click it, and blink it with SPHEREx. Amber names come from SIMBAD."
        />
        )}
      </section>

      <section id="how" className={styles.band}>
        <div className={`container ${styles.how}`}>
          <h2>Every blink becomes a measurement</h2>
          <ol className={styles.steps}>
            {STEPS.map((s) => (
              <li key={s.n}>
                <span className={`mono ${styles.stepN}`}>{s.n}</span>
                <span className={styles.stepTitle}>{s.title}</span>
                <span className={styles.stepBody}>{s.body}</span>
              </li>
            ))}
          </ol>
        </div>
      </section>

      <footer id="data" className={`container ${styles.footer}`}>
        <p>
          Images: NASA/JPL-Caltech/IPAC, SPHEREx Quick Release via the NASA/IPAC Infrared Science Archive. Positions and
          motions: SIMBAD (CDS) and Gaia DR3 (ESA). Results are labelled measurements or candidates, never discoveries.
        </p>
        <p>NASA Space Apps 2026 · Planet X and SPHEREx</p>
      </footer>
    </main>
  );
}
