import { useEffect, useMemo, useRef, useState } from "react";
import { Link } from "react-router-dom";
import * as THREE from "three";
import { OrbitControls } from "three/examples/jsm/controls/OrbitControls.js";
import { CSS2DObject, CSS2DRenderer } from "three/examples/jsm/renderers/CSS2DRenderer.js";
import Body3D from "./Body3D.tsx";
import BRIGHT from "../data/brightstars.json";
import NEIGHBOURS from "../data/neighbourhood.json";
import READY from "../data/ready.json";
import {
  blinkLink,
  blinkQuery,
  colourFromBV,
  displaySize,
  isBrownDwarf,
  KIND_COLOUR,
  KIND_LABEL,
  kindOf,
  LIGHT_YEARS_PER_PC,
  type Kind,
  type Neighbour,
} from "../lib/stellar.ts";
import styles from "./Neighbourhood3D.module.css";

const STARS = (NEIGHBOURS as Neighbour[]).slice().sort((a, b) => a.d - b.d);
const SKY = BRIGHT as number[][];
const SKY_RADIUS = 300;
const MOTION_YEARS = 10000;
const RINGS_PC = [2, 4, 6, 8];
const FLY_MS = 1300;

type Filter = "all" | "ready" | "targets" | "brown" | "red" | "bright" | "planets";

const READY_SET = new Set(READY as string[]);

function isReady(star: Neighbour): boolean {
  return READY_SET.has(blinkQuery(star));
}

const FILTERS: { id: Filter; label: string; keep: (star: Neighbour, kind: Kind) => boolean }[] = [
  { id: "all", label: "All", keep: () => true },
  { id: "ready", label: "Ready to blink", keep: (s) => isReady(s) },
  { id: "targets", label: "Challenge targets", keep: (s) => !!s.target },
  { id: "brown", label: "Brown dwarfs", keep: (_, k) => isBrownDwarf(k) },
  { id: "red", label: "Red dwarfs", keep: (_, k) => k === "M" },
  { id: "bright", label: "Bright stars", keep: (_, k) => "OBAFGK".includes(k) },
  { id: "planets", label: "Planet hosts", keep: (s) => s.planets > 0 },
];

function toScene([x, y, z]: number[]): THREE.Vector3 {
  return new THREE.Vector3(x, z, -y);
}

function unitFromRaDec(ra: number, dec: number): number[] {
  const a = THREE.MathUtils.degToRad(ra);
  const d = THREE.MathUtils.degToRad(dec);
  return [Math.cos(d) * Math.cos(a), Math.cos(d) * Math.sin(a), Math.sin(d)];
}

function drift(star: Neighbour): THREE.Vector3 {
  const ra = THREE.MathUtils.degToRad(star.ra);
  const dec = THREE.MathUtils.degToRad(star.dec);
  const masToRad = Math.PI / (180 * 3.6e6);
  const east = [-Math.sin(ra), Math.cos(ra), 0];
  const north = [-Math.sin(dec) * Math.cos(ra), -Math.sin(dec) * Math.sin(ra), Math.cos(dec)];
  const da = star.pmra * MOTION_YEARS * masToRad * star.d;
  const dd = star.pmdec * MOTION_YEARS * masToRad * star.d;
  return toScene([0, 1, 2].map((i) => east[i] * da + north[i] * dd));
}

function glowTexture(): THREE.Texture {
  const size = 128;
  const canvas = document.createElement("canvas");
  canvas.width = canvas.height = size;
  const context = canvas.getContext("2d") as CanvasRenderingContext2D;
  const gradient = context.createRadialGradient(size / 2, size / 2, 0, size / 2, size / 2, size / 2);
  gradient.addColorStop(0, "rgba(255,255,255,1)");
  gradient.addColorStop(0.12, "rgba(255,255,255,0.95)");
  gradient.addColorStop(0.3, "rgba(255,255,255,0.35)");
  gradient.addColorStop(0.6, "rgba(255,255,255,0.08)");
  gradient.addColorStop(1, "rgba(255,255,255,0)");
  context.fillStyle = gradient;
  context.fillRect(0, 0, size, size);
  const texture = new THREE.CanvasTexture(canvas);
  texture.colorSpace = THREE.SRGBColorSpace;
  return texture;
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

interface SceneApi {
  flyTo: (star: Neighbour) => void;
  setMotion: (visible: boolean) => void;
  setHighlight: (ids: Set<string>) => void;
}

/** The Sun's neighbourhood, built from SIMBAD: positions from parallaxes, colours from spectral types, sizes from
 * catalog magnitudes, and a backdrop of the real naked-eye sky coloured by each star's B−V. */
export default function Neighbourhood3D({ height }: { height?: string } = {}) {
  const holder = useRef<HTMLDivElement>(null);
  const api = useRef<SceneApi | null>(null);
  const [error] = useState<string | null>(() => (webglAvailable() ? null : "This browser cannot draw 3D graphics."));
  const [selected, setSelected] = useState<Neighbour | null>(null);
  const [filter, setFilter] = useState<Filter>("all");
  const [search, setSearch] = useState("");
  const [motion, setMotion] = useState(false);

  const listed = useMemo(() => {
    const rule = FILTERS.find((f) => f.id === filter) ?? FILTERS[0];
    const text = search.trim().toLowerCase();
    return STARS.filter((s) => rule.keep(s, kindOf(s)) && (!text || `${s.name} ${s.id} ${s.sp}`.toLowerCase().includes(text)));
  }, [filter, search]);

  useEffect(() => {
    api.current?.setHighlight(new Set(listed.map((s) => s.id)));
  }, [listed]);

  useEffect(() => {
    api.current?.setMotion(motion);
  }, [motion]);

  useEffect(() => {
    const host = holder.current;
    if (!host || error) return;
    const renderer = new THREE.WebGLRenderer({ antialias: true });
    const width = () => host.clientWidth;
    const height = () => host.clientHeight;
    renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
    renderer.setSize(width(), height());
    renderer.setClearColor("#020306");
    host.append(renderer.domElement);

    const labels = new CSS2DRenderer();
    labels.setSize(width(), height());
    labels.domElement.className = styles.labels;
    host.append(labels.domElement);

    const scene = new THREE.Scene();
    const camera = new THREE.PerspectiveCamera(50, width() / height(), 0.01, 1000);
    camera.position.set(9.5, 6, 11);
    const controls = new OrbitControls(camera, renderer.domElement);
    controls.enableDamping = true;
    controls.dampingFactor = 0.08;
    controls.minDistance = 0.25;
    controls.maxDistance = 60;
    controls.autoRotate = !reducedMotion();
    controls.autoRotateSpeed = 0.35;
    controls.addEventListener("start", () => {
      controls.autoRotate = false;
    });

    const glow = glowTexture();

    const skyGroups = new Map<number, { positions: number[]; colours: number[] }>();
    for (const [ra, dec, v, bv] of SKY) {
      const bin = v < 1.5 ? 0 : v < 3 ? 1 : v < 4.5 ? 2 : 3;
      const group = skyGroups.get(bin) ?? { positions: [], colours: [] };
      const p = toScene(unitFromRaDec(ra, dec)).multiplyScalar(SKY_RADIUS);
      group.positions.push(p.x, p.y, p.z);
      const [r, g, b] = colourFromBV(bv);
      const fade = bin === 3 ? 0.55 : bin === 2 ? 0.75 : 1;
      group.colours.push(r * fade, g * fade, b * fade);
      skyGroups.set(bin, group);
    }
    for (const [bin, group] of skyGroups) {
      const geometry = new THREE.BufferGeometry();
      geometry.setAttribute("position", new THREE.Float32BufferAttribute(group.positions, 3));
      geometry.setAttribute("color", new THREE.Float32BufferAttribute(group.colours, 3));
      scene.add(
        new THREE.Points(
          geometry,
          new THREE.PointsMaterial({
            size: [6.5, 4.5, 3.2, 2.2][bin],
            sizeAttenuation: false,
            vertexColors: true,
            map: glow,
            transparent: true,
            depthWrite: false,
            blending: THREE.AdditiveBlending,
          }),
        ),
      );
    }

    const sun = new THREE.Sprite(
      new THREE.SpriteMaterial({ map: glow, color: KIND_COLOUR.G, blending: THREE.AdditiveBlending, depthWrite: false }),
    );
    sun.scale.setScalar(0.18 * 7);
    scene.add(sun);
    const sunLabel = label("Sun", styles.sunLabel);
    sunLabel.position.set(0, 0.22, 0);
    scene.add(sunLabel);

    for (const radius of RINGS_PC) {
      const points = Array.from({ length: 161 }, (_, i) => {
        const angle = (i / 160) * Math.PI * 2;
        return new THREE.Vector3(Math.cos(angle) * radius, 0, Math.sin(angle) * radius);
      });
      scene.add(
        new THREE.Line(
          new THREE.BufferGeometry().setFromPoints(points),
          new THREE.LineBasicMaterial({ color: "#5cc8ff", transparent: true, opacity: radius % 4 === 0 ? 0.16 : 0.07 }),
        ),
      );
      if (radius % 4 === 0) {
        const tag = label(`${radius} pc · ${Math.round(radius * LIGHT_YEARS_PER_PC)} ly`, styles.ringLabel);
        tag.position.set(radius, 0, 0);
        scene.add(tag);
      }
    }

    const sprites = new Map<string, THREE.Sprite>();
    const arrows: THREE.ArrowHelper[] = [];
    for (const star of STARS) {
      const kind = kindOf(star);
      const colour = KIND_COLOUR[kind];
      const position = toScene(star.xyz);
      const size = displaySize(star);
      const sprite = new THREE.Sprite(
        new THREE.SpriteMaterial({ map: glow, color: colour, blending: THREE.AdditiveBlending, depthWrite: false, transparent: true }),
      );
      sprite.position.copy(position);
      sprite.scale.setScalar(size * 7);
      sprite.userData = { star };
      scene.add(sprite);
      sprites.set(star.id, sprite);

      scene.add(
        new THREE.Line(
          new THREE.BufferGeometry().setFromPoints([position, new THREE.Vector3(position.x, 0, position.z)]),
          new THREE.LineBasicMaterial({ color: colour, transparent: true, opacity: star.target ? 0.35 : 0.035 }),
        ),
      );

      const move = drift(star);
      if (move.length() > 0.02) {
        const arrow = new THREE.ArrowHelper(move.clone().normalize(), position, move.length(), colour, 0.12, 0.06);
        arrow.visible = false;
        scene.add(arrow);
        arrows.push(arrow);
      }

      if (star.target) {
        const ring = new THREE.Mesh(
          new THREE.RingGeometry(0.2, 0.214, 64),
          new THREE.MeshBasicMaterial({ color: "#5cc8ff", side: THREE.DoubleSide, transparent: true, opacity: 0.9 }),
        );
        ring.position.copy(position);
        ring.userData.faceCamera = true;
        scene.add(ring);
        const tag = label(star.name, styles.targetLabel);
        tag.position.copy(position).add(new THREE.Vector3(0, 0.3, 0));
        scene.add(tag);
      } else if (size > 0.2 || star.planets >= 3) {
        const tag = label(star.name, styles.starLabel);
        tag.position.copy(position).add(new THREE.Vector3(0, size * 1.4, 0));
        scene.add(tag);
      }
    }

    const hover = label("", styles.hoverLabel);
    hover.visible = false;
    scene.add(hover);
    const focus = label("", styles.focusLabel);
    focus.visible = false;
    scene.add(focus);

    const flight = {
      active: false,
      start: 0,
      fromTarget: new THREE.Vector3(),
      toTarget: new THREE.Vector3(),
      fromCamera: new THREE.Vector3(),
      toCamera: new THREE.Vector3(),
    };

    api.current = {
      flyTo(star) {
        const position = toScene(star.xyz);
        const direction = camera.position.clone().sub(controls.target).normalize();
        const distance = Math.max(2.4, displaySize(star) * 12);
        flight.fromTarget.copy(controls.target);
        flight.toTarget.copy(position);
        flight.fromCamera.copy(camera.position);
        flight.toCamera.copy(position).add(direction.multiplyScalar(distance));
        flight.start = performance.now();
        flight.active = true;
        controls.autoRotate = false;
        (focus.element as HTMLElement).textContent = star.name;
        focus.position.copy(position).add(new THREE.Vector3(0, displaySize(star) * 1.6, 0));
        focus.visible = !star.target;
        if (reducedMotion()) {
          controls.target.copy(flight.toTarget);
          camera.position.copy(flight.toCamera);
          flight.active = false;
        }
      },
      setMotion(visible) {
        for (const arrow of arrows) arrow.visible = visible;
      },
      setHighlight(ids) {
        for (const [id, sprite] of sprites) {
          (sprite.material as THREE.SpriteMaterial).opacity = ids.has(id) ? 1 : 0.18;
        }
      },
    };

    const raycaster = new THREE.Raycaster();
    const pointer = new THREE.Vector2();
    const gesture = { dragged: false };
    const pickable = [...sprites.values()];

    function pick(event: PointerEvent): Neighbour | null {
      const bounds = renderer.domElement.getBoundingClientRect();
      pointer.set(((event.clientX - bounds.left) / bounds.width) * 2 - 1, -((event.clientY - bounds.top) / bounds.height) * 2 + 1);
      raycaster.setFromCamera(pointer, camera);
      const hits = raycaster.intersectObjects(pickable, false);
      return hits.length ? (hits[0].object.userData.star as Neighbour) : null;
    }
    function onMove(event: PointerEvent) {
      if (event.buttons) gesture.dragged = true;
      const star = pick(event);
      renderer.domElement.style.cursor = star ? "pointer" : "grab";
      if (star) {
        (hover.element as HTMLElement).textContent = `${star.name} · ${(star.d * LIGHT_YEARS_PER_PC).toFixed(1)} ly`;
        hover.position.copy(toScene(star.xyz)).add(new THREE.Vector3(0, -displaySize(star) * 1.4, 0));
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
        api.current?.flyTo(star);
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

    const animation = { frame: 0 };
    const loop = (now: number) => {
      animation.frame = requestAnimationFrame(loop);
      if (flight.active) {
        const t = Math.min(1, (now - flight.start) / FLY_MS);
        const k = t * t * (3 - 2 * t);
        controls.target.lerpVectors(flight.fromTarget, flight.toTarget, k);
        camera.position.lerpVectors(flight.fromCamera, flight.toCamera, k);
        if (t >= 1) flight.active = false;
      }
      controls.update();
      scene.traverse((object) => {
        if (object.userData.faceCamera) object.quaternion.copy(camera.quaternion);
      });
      renderer.render(scene, camera);
      labels.render(scene, camera);
    };
    animation.frame = requestAnimationFrame(loop);

    return () => {
      cancelAnimationFrame(animation.frame);
      resize.disconnect();
      renderer.domElement.removeEventListener("pointermove", onMove);
      renderer.domElement.removeEventListener("pointerdown", onDown);
      renderer.domElement.removeEventListener("pointerup", onUp);
      controls.dispose();
      glow.dispose();
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
      api.current = null;
    };
  }, [error]);

  function choose(star: Neighbour) {
    setSelected(star);
    api.current?.flyTo(star);
  }

  const kind = selected ? kindOf(selected) : null;
  const speed = selected ? Math.hypot(selected.pmra, selected.pmdec) / 1000 : 0;

  return (
    <div className={styles.wrap}>
      <div className={styles.layout}>
        <div className={styles.stageWrap}>
          {error ? <p className={styles.error}>{error}</p> : <div ref={holder} className={styles.stage} style={height ? { height } : undefined} />}
          {selected && kind ? (
            <aside className={styles.card} aria-live="polite">
              <button type="button" className={styles.close} onClick={() => setSelected(null)} aria-label="Close">
                ×
              </button>
              <span className={styles.kind} style={{ color: KIND_COLOUR[kind] }}>
                {KIND_LABEL[kind]}
                {selected.target ? " · challenge target" : ""}
              </span>
              <strong className={styles.title}>{selected.name}</strong>
              <span className={`mono ${styles.id}`}>{selected.id}</span>
              <Body3D kind={kind} id={selected.id} />
              <dl className={styles.facts}>
                <div>
                  <dt>Distance</dt>
                  <dd className="mono">
                    {(selected.d * LIGHT_YEARS_PER_PC).toFixed(2)} ly · {selected.d.toFixed(2)} pc
                  </dd>
                </div>
                {selected.sp ? (
                  <div>
                    <dt>Spectral type</dt>
                    <dd className="mono">{selected.sp}</dd>
                  </div>
                ) : null}
                <div>
                  <dt>Motion on the sky</dt>
                  <dd className="mono">{speed.toFixed(2)}″ per year</dd>
                </div>
                {selected.planets ? (
                  <div>
                    <dt>Known planets</dt>
                    <dd className="mono">{selected.planets}</dd>
                  </div>
                ) : null}
              </dl>
              <p className={styles.readiness} data-ready={isReady(selected)}>
                {isReady(selected)
                  ? "Ready: its SPHEREx images are indexed, so it opens without waiting on NASA's archive."
                  : "Not indexed yet: opening it asks NASA's archive, which is down at times today, and the first look can take a minute."}
              </p>
              <Link
                to={blinkLink(selected, kind)}
                className={isReady(selected) ? "btn btn-primary" : "btn"}
                onClick={() => window.scrollTo({ top: 0 })}
              >
                {isReady(selected) ? "Blink it with SPHEREx" : "Try it · needs NASA's archive"}
              </Link>
            </aside>
          ) : null}
          <label className={styles.motionToggle}>
            <input type="checkbox" checked={motion} onChange={(e) => setMotion(e.target.checked)} />
            Motion over 10,000 years
          </label>
        </div>
        <div className={styles.side} style={height ? { maxHeight: height } : undefined}>
          <input
            className={`mono ${styles.search}`}
            type="search"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Find a star or brown dwarf"
            aria-label="Find a star or brown dwarf"
          />
          <div className={styles.filters} role="group" aria-label="Show">
            {FILTERS.map((f) => (
              <button key={f.id} type="button" className={styles.filter} aria-pressed={filter === f.id} onClick={() => setFilter(f.id)}>
                {f.label}
              </button>
            ))}
          </div>
          <ul className={styles.list}>
            {listed.map((star) => {
              const k = kindOf(star);
              return (
                <li key={star.id}>
                  <button type="button" className={styles.item} aria-pressed={selected?.id === star.id} onClick={() => choose(star)}>
                    <i style={{ background: KIND_COLOUR[k] }} />
                    <span className={styles.itemName}>{star.name}</span>
                    {isReady(star) ? <span className={styles.readyTag}>ready</span> : null}
                    <span className={`mono ${styles.itemMeta}`}>{(star.d * LIGHT_YEARS_PER_PC).toFixed(1)} ly</span>
                  </button>
                </li>
              );
            })}
          </ul>
          <span className={styles.count}>
            {listed.length} of {STARS.length} shown
          </span>
        </div>
      </div>
      <p className={styles.note}>
        {STARS.length} stars and brown dwarfs within about 7 parsecs, from SIMBAD: positions from parallaxes, colours from
        spectral types, sizes from catalog magnitudes. Behind them, the {SKY.length.toLocaleString()} brightest stars of
        the real sky, coloured by their B−V index. Drag to turn, scroll to zoom, click a star or pick one from the list.
      </p>
    </div>
  );
}
