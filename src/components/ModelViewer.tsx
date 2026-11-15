import { useState } from "react";
import { Link } from "react-router-dom";
import Body3D, { type BodyKind } from "./Body3D.tsx";
import { PLANETS } from "../lib/orbits.ts";
import styles from "./ModelViewer.module.css";

interface Model {
  kind: BodyKind;
  name: string;
  detail: string;
  blink?: { label: string; href: string };
}

const blink = (target: string, detector: string) => `/view?${new URLSearchParams({ target, det: detector, fov: "0.06", mode: "blink" }).toString()}`;

const GROUPS: { title: string; models: Model[] }[] = [
  {
    title: "Stars, hottest to coolest",
    models: [
      { kind: "O", name: "O star", detail: "Above about 30,000 K. Rare, massive and short-lived, like Alnitak in Orion's belt." },
      { kind: "B", name: "B star", detail: "About 10,000 to 30,000 K. Blue-white, like Rigel." },
      { kind: "A", name: "A star", detail: "About 7,500 to 10,000 K. White, like Vega and Sirius A." },
      { kind: "F", name: "F star", detail: "About 6,000 to 7,500 K. Yellow-white, like Procyon A." },
      { kind: "G", name: "G star", detail: "About 5,200 to 6,000 K. The Sun and Alpha Centauri A." },
      { kind: "K", name: "K star", detail: "About 3,700 to 5,200 K. Orange, like Alpha Centauri B.", blink: { label: "Blink Alpha Centauri B", href: blink("* alf Cen B", "D2") } },
      { kind: "M", name: "Red dwarf (M)", detail: "About 2,400 to 3,700 K. The most common star in the Galaxy, like Barnard's Star.", blink: { label: "Blink Barnard's Star", href: blink("Barnard's Star", "D2") } },
      { kind: "WD", name: "White dwarf", detail: "The exposed core of a dead Sun-like star, about Earth-sized, like Sirius B." },
    ],
  },
  {
    title: "Brown dwarfs, too small to burn hydrogen",
    models: [
      { kind: "L", name: "L dwarf", detail: "About 1,300 to 2,400 K, with clouds of hot dust. Luhman 16 A is one.", blink: { label: "Blink Luhman 16", href: blink("NAME Luhman 16", "D5") } },
      { kind: "T", name: "T dwarf", detail: "About 550 to 1,300 K, with methane in the air, like Epsilon Indi B.", blink: { label: "Blink Epsilon Indi B", href: blink("Epsilon Indi B", "D5") } },
      { kind: "Y", name: "Y dwarf", detail: "Below about 500 K, the coldest known. WISE 0855−0714 is the coldest of all.", blink: { label: "Blink WISE 0855−0714", href: blink("WISE 0855-0714", "D6") } },
    ],
  },
  {
    title: "Planets",
    models: PLANETS.map((p) => ({ kind: p.key, name: p.name, detail: `${Math.round(p.radiusKm).toLocaleString("en")} km in radius, ${p.a[0].toFixed(2)} AU from the Sun.` })),
  },
  {
    title: "Small bodies",
    models: [
      { kind: "asteroid", name: "Asteroid", detail: "A rocky leftover of planet building, like Bennu or Ryugu. The shape here is invented." },
      { kind: "comet", name: "Comet nucleus", detail: "Dark ice and dust that grows a glowing coma near the Sun. The shape here is invented." },
    ],
  },
];

const ALL = GROUPS.flatMap((g) => g.models);

/** One large, rotatable impression at a time: browsers allow only a few 3D canvases on a page. */
export default function ModelViewer({ full = false }: { full?: boolean }) {
  const [current, setCurrent] = useState<Model>(ALL.find((m) => m.kind === "G") ?? ALL[0]);
  return (
    <div className={styles.layout}>
      <div className={styles.stageWrap}>
        <Body3D key={current.kind} kind={current.kind} id={current.name} className={`${styles.stage} ${full ? styles.stageFull : ""}`} interactive caption={false} />
        <div className={styles.info}>
          <strong className={styles.name}>{current.name}</strong>
          <p className={styles.detail}>{current.detail}</p>
          {current.blink ? (
            <Link to={current.blink.href} className="btn btn-primary">
              {current.blink.label}
            </Link>
          ) : null}
          <span className={styles.caption}>Artist’s impression · not an image · drag to turn, scroll to zoom</span>
        </div>
      </div>
      <div className={styles.picker}>
        {GROUPS.map((group) => (
          <div key={group.title} className={styles.group}>
            <span className={styles.groupTitle}>{group.title}</span>
            <div className={styles.chips}>
              {group.models.map((m) => (
                <button key={m.kind} type="button" className={styles.chip} aria-pressed={m.kind === current.kind} onClick={() => setCurrent(m)}>
                  {m.name}
                </button>
              ))}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
