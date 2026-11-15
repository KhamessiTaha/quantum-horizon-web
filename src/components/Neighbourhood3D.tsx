import { useEffect, useRef, useState } from "react";
import { Link } from "react-router-dom";
import * as THREE from "three";
import { OrbitControls } from "three/examples/jsm/controls/OrbitControls.js";
import { CSS2DObject, CSS2DRenderer } from "three/examples/jsm/renderers/CSS2DRenderer.js";
import NEIGHBOURS from "../data/neighbourhood.json";
import styles from "./Neighbourhood3D.module.css";

interface Neighbour {
  query: string;
  name: string;
  group: string;
  ra: number;
  dec: number;
  parallax_mas: number;
  distance_pc: number;
  pmra: number;
  pmdec: number;
  xyz_pc: number[];
  source: string | null;
}

const STARS = NEIGHBOURS as Neighbour[];
const LIGHT_YEARS_PER_PC = 3.2616;
const MOTION_YEARS = 10000;
const RINGS_PC = [2, 4, 6, 8, 10, 12];

const LOOK: Record<string, { colour: string; size: number; label: string }> = {
  "Challenge targets": { colour: "#5cc8ff", size: 0.16, label: "Challenge target" },
  "Bright neighbours": { colour: "#f4f1e8", size: 0.2, label: "Bright star" },
  "Red dwarfs": { colour: "#ff8a5c", size: 0.12, label: "Red dwarf" },
  "Brown dwarfs": { colour: "#c084fc", size: 0.1, label: "Brown dwarf" },
};

const DETECTOR_FOR: Record<string, string> = {
  "Challenge targets": "D2",
  "Bright neighbours": "D2",
  "Red dwarfs": "D2",
  "Brown dwarfs": "D5",
};

function blinkLink(star: Neighbour): string {
  const detector = star.query === "WISE 0855-0714" ? "D6" : star.query === "Epsilon Indi B" ? "D5" : DETECTOR_FOR[star.group];
  return `/view?${new URLSearchParams({ target: star.query, det: detector, fov: "0.06", mode: "blink" }).toString()}`;
}

/** Equatorial x, y, z (z to the celestial north pole) to three.js, which has y up. */
function toScene([x, y, z]: number[]): THREE.Vector3 {
  return new THREE.Vector3(x, z, -y);
}

/** Where proper motion carries the star across the sky in MOTION_YEARS, at its distance. Radial motion is not included. */
function drift(star: Neighbour): THREE.Vector3 {
  const ra = THREE.MathUtils.degToRad(star.ra);
  const dec = THREE.MathUtils.degToRad(star.dec);
  const masToRad = Math.PI / (180 * 3.6e6);
  const east = [-Math.sin(ra), Math.cos(ra), 0];
  const north = [-Math.sin(dec) * Math.cos(ra), -Math.sin(dec) * Math.sin(ra), Math.cos(dec)];
  const da = star.pmra * MOTION_YEARS * masToRad * star.distance_pc;
  const dd = star.pmdec * MOTION_YEARS * masToRad * star.distance_pc;
  return toScene([0, 1, 2].map((i) => east[i] * da + north[i] * dd));
}

function label(text: string, className: string): CSS2DObject {
  const element = document.createElement("span");
  element.className = className;
  element.textContent = text;
  return new CSS2DObject(element);
}

function webglAvailable(): boolean {
  try {
    const canvas = document.createElement("canvas");
    return !!(canvas.getContext("webgl2") ?? canvas.getContext("webgl"));
  } catch {
    return false;
  }
}

function reducedMotion(): boolean {
  return window.matchMedia?.("(prefers-reduced-motion: reduce)").matches === true;
}

/** The Sun's neighbourhood in 3D, from SIMBAD parallaxes: every position and arrow comes from catalog data. */
export default function Neighbourhood3D() {
  const holder = useRef<HTMLDivElement>(null);
  const [selected, setSelected] = useState<Neighbour | null>(null);
  const [error] = useState<string | null>(() => (webglAvailable() ? null : "This browser cannot draw 3D graphics."));

  useEffect(() => {
    const host = holder.current;
    if (!host || error) return;
    const renderer = new THREE.WebGLRenderer({ antialias: true, alpha: false });
    const width = () => host.clientWidth;
    const height = () => host.clientHeight;
    renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
    renderer.setSize(width(), height());
    renderer.setClearColor("#05070a");
    host.append(renderer.domElement);

    const labels = new CSS2DRenderer();
    labels.setSize(width(), height());
    labels.domElement.className = styles.labels;
    host.append(labels.domElement);

    const scene = new THREE.Scene();
    const camera = new THREE.PerspectiveCamera(45, width() / height(), 0.05, 400);
    camera.position.set(7.5, 5, 8.5);

    const controls = new OrbitControls(camera, renderer.domElement);
    controls.enableDamping = true;
    controls.minDistance = 2;
    controls.maxDistance = 60;
    controls.autoRotate = !reducedMotion();
    controls.autoRotateSpeed = 0.5;

    const sun = new THREE.Mesh(new THREE.SphereGeometry(0.22, 32, 16), new THREE.MeshBasicMaterial({ color: "#ffd166" }));
    scene.add(sun);
    sun.add(label("Sun", styles.sunLabel));
    const glow = new THREE.Mesh(
      new THREE.SphereGeometry(0.5, 32, 16),
      new THREE.MeshBasicMaterial({ color: "#ffd166", transparent: true, opacity: 0.12 }),
    );
    scene.add(glow);

    for (const radius of RINGS_PC) {
      const points = Array.from({ length: 129 }, (_, i) => {
        const angle = (i / 128) * Math.PI * 2;
        return new THREE.Vector3(Math.cos(angle) * radius, 0, Math.sin(angle) * radius);
      });
      const ring = new THREE.Line(
        new THREE.BufferGeometry().setFromPoints(points),
        new THREE.LineBasicMaterial({ color: "#5cc8ff", transparent: true, opacity: radius % 4 === 0 ? 0.28 : 0.12 }),
      );
      scene.add(ring);
      if (radius % 4 === 0) {
        const tag = label(`${radius} pc · ${(radius * LIGHT_YEARS_PER_PC).toFixed(0)} ly`, styles.ringLabel);
        tag.position.set(radius, 0, 0);
        scene.add(tag);
      }
    }

    const pickable: THREE.Mesh[] = [];
    for (const star of STARS) {
      const look = LOOK[star.group] ?? LOOK["Red dwarfs"];
      const position = toScene(star.xyz_pc);
      const body = new THREE.Mesh(
        new THREE.SphereGeometry(look.size, 20, 12),
        new THREE.MeshBasicMaterial({ color: look.colour }),
      );
      body.position.copy(position);
      body.userData.star = star;
      scene.add(body);
      pickable.push(body);

      const halo = new THREE.Mesh(
        new THREE.SphereGeometry(look.size * 2, 20, 12),
        new THREE.MeshBasicMaterial({ color: look.colour, transparent: true, opacity: 0.12, depthWrite: false }),
      );
      halo.position.copy(position);
      scene.add(halo);

      const stem = new THREE.Line(
        new THREE.BufferGeometry().setFromPoints([position, new THREE.Vector3(position.x, 0, position.z)]),
        new THREE.LineBasicMaterial({ color: look.colour, transparent: true, opacity: 0.18 }),
      );
      scene.add(stem);

      const motion = drift(star);
      if (motion.length() > 0.02) {
        const arrow = new THREE.ArrowHelper(
          motion.clone().normalize(),
          position,
          motion.length(),
          look.colour,
          Math.min(0.18, motion.length() * 0.35),
          Math.min(0.1, motion.length() * 0.2),
        );
        (arrow.line.material as THREE.LineBasicMaterial).transparent = true;
        (arrow.line.material as THREE.LineBasicMaterial).opacity = 0.55;
        scene.add(arrow);
      }

      if (star.group === "Challenge targets") {
        const ring = new THREE.Mesh(
          new THREE.RingGeometry(0.26, 0.3, 40),
          new THREE.MeshBasicMaterial({ color: "#5cc8ff", side: THREE.DoubleSide, transparent: true, opacity: 0.9 }),
        );
        ring.position.copy(position);
        ring.userData.faceCamera = true;
        scene.add(ring);
      }
      const crowded =
        star.group !== "Challenge targets" &&
        STARS.some((other) => other.group === "Challenge targets" && toScene(other.xyz_pc).distanceTo(position) < 0.6);
      if ((star.group === "Challenge targets" || star.group === "Bright neighbours") && !crowded) {
        const tag = label(star.query, star.group === "Challenge targets" ? styles.targetLabel : styles.starLabel);
        tag.position.copy(position).add(new THREE.Vector3(0, 0.32, 0));
        scene.add(tag);
      }
    }

    const hover = label("", styles.hoverLabel);
    hover.visible = false;
    scene.add(hover);

    const raycaster = new THREE.Raycaster();
    const pointer = new THREE.Vector2();
    const gesture = { dragged: false };

    function pick(event: PointerEvent): Neighbour | null {
      const bounds = renderer.domElement.getBoundingClientRect();
      pointer.set(((event.clientX - bounds.left) / bounds.width) * 2 - 1, -((event.clientY - bounds.top) / bounds.height) * 2 + 1);
      raycaster.setFromCamera(pointer, camera);
      const hit = raycaster.intersectObjects(pickable, false)[0];
      return hit ? (hit.object.userData.star as Neighbour) : null;
    }

    function onMove(event: PointerEvent) {
      if (event.buttons) gesture.dragged = true;
      const star = pick(event);
      renderer.domElement.style.cursor = star ? "pointer" : "grab";
      if (star) {
        (hover.element as HTMLElement).textContent = `${star.query} · ${star.distance_pc.toFixed(2)} pc`;
        hover.position.copy(toScene(star.xyz_pc)).add(new THREE.Vector3(0, -0.32, 0));
        hover.visible = true;
      } else {
        hover.visible = false;
      }
    }
    function onDown() {
      gesture.dragged = false;
    }
    function onUp(event: PointerEvent) {
      if (gesture.dragged) return;
      const star = pick(event);
      if (star) {
        setSelected(star);
        controls.autoRotate = false;
      }
    }
    renderer.domElement.addEventListener("pointermove", onMove);
    renderer.domElement.addEventListener("pointerdown", onDown);
    renderer.domElement.addEventListener("pointerup", onUp);

    const resize = new ResizeObserver(() => {
      camera.aspect = width() / height();
      camera.updateProjectionMatrix();
      renderer.setSize(width(), height());
      labels.setSize(width(), height());
    });
    resize.observe(host);

    let frame = 0;
    const loop = () => {
      frame = requestAnimationFrame(loop);
      controls.update();
      scene.traverse((object) => {
        if (object.userData.faceCamera) object.quaternion.copy(camera.quaternion);
      });
      renderer.render(scene, camera);
      labels.render(scene, camera);
    };
    loop();

    return () => {
      cancelAnimationFrame(frame);
      resize.disconnect();
      renderer.domElement.removeEventListener("pointermove", onMove);
      renderer.domElement.removeEventListener("pointerdown", onDown);
      renderer.domElement.removeEventListener("pointerup", onUp);
      controls.dispose();
      scene.traverse((object) => {
        const mesh = object as THREE.Mesh;
        mesh.geometry?.dispose();
        const material = mesh.material as THREE.Material | THREE.Material[] | undefined;
        if (Array.isArray(material)) material.forEach((m) => m.dispose());
        else material?.dispose();
      });
      renderer.dispose();
      renderer.domElement.remove();
      labels.domElement.remove();
    };
  }, [error]);

  const look = selected ? (LOOK[selected.group] ?? LOOK["Red dwarfs"]) : null;
  const motion = selected ? Math.hypot(selected.pmra, selected.pmdec) / 1000 : 0;

  return (
    <div className={styles.wrap}>
      {error ? <p className={styles.error}>{error}</p> : <div ref={holder} className={styles.stage} />}
      <div className={styles.legend} aria-hidden="true">
        {Object.entries(LOOK).map(([group, l]) => (
          <span key={group}>
            <i style={{ background: l.colour }} />
            {l.label}
          </span>
        ))}
      </div>
      {selected && look ? (
        <aside className={styles.card} aria-live="polite">
          <button type="button" className={styles.close} onClick={() => setSelected(null)} aria-label="Close">
            ×
          </button>
          <span className={styles.kind} style={{ color: look.colour }}>
            {look.label}
          </span>
          <strong className={styles.title}>{selected.query}</strong>
          <span className={`mono ${styles.id}`}>{selected.name}</span>
          <dl className={styles.facts}>
            <div>
              <dt>Distance</dt>
              <dd className="mono">
                {selected.distance_pc.toFixed(2)} pc · {(selected.distance_pc * LIGHT_YEARS_PER_PC).toFixed(1)} ly
              </dd>
            </div>
            <div>
              <dt>Motion on the sky</dt>
              <dd className="mono">{motion.toFixed(2)}″ per year</dd>
            </div>
            <div>
              <dt>Parallax</dt>
              <dd className="mono">{selected.parallax_mas.toFixed(1)} mas</dd>
            </div>
          </dl>
          <Link to={blinkLink(selected)} className="btn btn-primary" onClick={() => window.scrollTo({ top: 0 })}>
            Blink it with SPHEREx
          </Link>
        </aside>
      ) : null}
      <p className={styles.note}>
        {STARS.length} stars and brown dwarfs placed by their SIMBAD parallaxes, the Sun at the centre. Arrows show where
        each drifts across the sky in {MOTION_YEARS.toLocaleString()} years from its measured proper motion; motion towards
        or away from us is not shown. Drag to turn, scroll to zoom, click a star.
      </p>
    </div>
  );
}
