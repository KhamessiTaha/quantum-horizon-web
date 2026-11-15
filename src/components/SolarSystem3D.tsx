import { useEffect, useMemo, useRef, useState } from "react";
import { Link } from "react-router-dom";
import * as THREE from "three";
import { OrbitControls } from "three/examples/jsm/controls/OrbitControls.js";
import { CSS2DObject, CSS2DRenderer } from "three/examples/jsm/renderers/CSS2DRenderer.js";
import Body3D, { type BodyKind } from "./Body3D.tsx";
import { BLINKABLE_ASTEROIDS, trackLink } from "../data/asteroids.ts";
import BRIGHT from "../data/brightstars.json";
import {
  bodyPosition,
  CLASS_LABEL,
  dateOf,
  julianDate,
  orbitPoints,
  periodYears,
  planetOrbit,
  planetPosition,
  PLANETS,
  skyPlace,
  skyRate,
  SMALL_BODIES,
  toScene,
  type Group,
  type Planet,
  type SmallBody,
  type Vec,
} from "../lib/orbits.ts";
import { colourFromBV } from "../lib/stellar.ts";
import styles from "./SolarSystem3D.module.css";

const SPHEREX_PIXEL_ARCSEC = 6.15;
const SKY_RADIUS = 900;
const FLY_MS = 1400;
const OBLIQUITY = THREE.MathUtils.degToRad(23.43928);

const GROUPS: { id: Group; label: string; colour: string; size: number }[] = [
  { id: "asteroid", label: "Main belt and beyond", colour: "#8d96a3", size: 2.2 },
  { id: "neo", label: "Near-Earth asteroids", colour: "#ff8f5a", size: 3 },
  { id: "comet", label: "Comets", colour: "#7fe3ff", size: 3.2 },
  { id: "distant", label: "Beyond Neptune", colour: "#9ab8ff", size: 3.2 },
  { id: "extreme", label: "Extreme orbits", colour: "#c35cff", size: 4.2 },
  { id: "famous", label: "Visited by spacecraft", colour: "#ffffff", size: 6 },
];

const GROUP_STYLE = new Map(GROUPS.map((g) => [g.id, g]));

type Filter = "all" | "planets" | "blink" | Group;

const BLINKABLE = new Set(BLINKABLE_ASTEROIDS);

const FILTERS: { id: Filter; label: string }[] = [
  { id: "all", label: "All" },
  { id: "blink", label: "Blink with SPHEREx" },
  { id: "planets", label: "Planets" },
  { id: "famous", label: "Visited" },
  { id: "neo", label: "Near-Earth" },
  { id: "comet", label: "Comets" },
  { id: "distant", label: "Beyond Neptune" },
  { id: "extreme", label: "Planet Nine clues" },
];

const SPEEDS = [
  { days: 1, label: "1 day/s" },
  { days: 7, label: "1 week/s" },
  { days: 30, label: "1 month/s" },
  { days: 365, label: "1 year/s" },
];

const DEFAULT_SPEED = 1;

const PLANET_SIZE: Record<string, number> = {
  mercury: 0.32,
  venus: 0.5,
  earth: 0.54,
  mars: 0.4,
  jupiter: 1.35,
  saturn: 1.15,
  uranus: 0.85,
  neptune: 0.85,
};

type Selection = { type: "sun" } | { type: "planet"; planet: Planet } | { type: "body"; body: SmallBody };

function keyOf(selection: Selection): string {
  return selection.type === "sun" ? "sun" : selection.type === "planet" ? selection.planet.key : selection.body.name;
}

function nameOf(selection: Selection): string {
  return selection.type === "sun" ? "Sun" : selection.type === "planet" ? selection.planet.name : selection.body.name;
}

function heliocentric(selection: Selection, jd: number): Vec {
  if (selection.type === "sun") return [0, 0, 0];
  return selection.type === "planet" ? planetPosition(selection.planet, jd) : bodyPosition(selection.body, jd);
}

function kindOf(selection: Selection): BodyKind {
  if (selection.type === "sun") return "G";
  if (selection.type === "planet") return selection.planet.key;
  return selection.body.group === "comet" ? "comet" : "asteroid";
}

function glowTexture(): THREE.Texture {
  const size = 128;
  const canvas = document.createElement("canvas");
  canvas.width = canvas.height = size;
  const context = canvas.getContext("2d") as CanvasRenderingContext2D;
  const gradient = context.createRadialGradient(size / 2, size / 2, 0, size / 2, size / 2, size / 2);
  gradient.addColorStop(0, "rgba(255,255,255,1)");
  gradient.addColorStop(0.15, "rgba(255,255,255,0.9)");
  gradient.addColorStop(0.35, "rgba(255,255,255,0.3)");
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

function skyDirection(ra: number, dec: number): THREE.Vector3 {
  const a = THREE.MathUtils.degToRad(ra);
  const d = THREE.MathUtils.degToRad(dec);
  const x = Math.cos(d) * Math.cos(a);
  const y = Math.cos(d) * Math.sin(a);
  const z = Math.sin(d);
  const ey = y * Math.cos(OBLIQUITY) + z * Math.sin(OBLIQUITY);
  const ez = -y * Math.sin(OBLIQUITY) + z * Math.cos(OBLIQUITY);
  return new THREE.Vector3(x, ez, -ey);
}

function formatDate(jd: number): string {
  return dateOf(jd).toISOString().slice(0, 10);
}

function formatRa(ra: number): string {
  const h = ra / 15;
  const hh = Math.floor(h);
  const mm = Math.floor((h - hh) * 60);
  const ss = ((h - hh) * 60 - mm) * 60;
  return `${String(hh).padStart(2, "0")} ${String(mm).padStart(2, "0")} ${ss.toFixed(0).padStart(2, "0")}`;
}

function formatDec(dec: number): string {
  const sign = dec < 0 ? "−" : "+";
  const v = Math.abs(dec);
  const dd = Math.floor(v);
  const mm = Math.floor((v - dd) * 60);
  return `${sign}${String(dd).padStart(2, "0")} ${String(mm).padStart(2, "0")}`;
}

interface SceneApi {
  focus: (selection: Selection) => void;
  setFilter: (filter: Filter) => void;
  setPlaying: (playing: boolean) => void;
  setSpeed: (days: number) => void;
  setJd: (jd: number) => void;
}

/** The Solar System on a compressed distance scale: the eight planets from JPL's mean elements, and 7,500 real
 * asteroids, comets and distant objects from JPL's Small-Body Database, each moved along its own orbit. */
export default function SolarSystem3D({ height }: { height?: string } = {}) {
  const holder = useRef<HTMLDivElement>(null);
  const api = useRef<SceneApi | null>(null);
  const [error] = useState<string | null>(() => (webglAvailable() ? null : "This browser cannot draw 3D graphics."));
  const [selected, setSelected] = useState<Selection | null>(null);
  const [filter, setFilter] = useState<Filter>("all");
  const [search, setSearch] = useState("");
  const [playing, setPlaying] = useState(!reducedMotion());
  const [speed, setSpeed] = useState(DEFAULT_SPEED);
  const [jd, setJd] = useState(() => julianDate(Date.now()));

  const listed = useMemo(() => {
    const text = search.trim().toLowerCase();
    const planets: Selection[] = PLANETS.map((planet) => ({ type: "planet", planet }));
    const bodies: Selection[] = SMALL_BODIES.filter((b) => filter === "all" || b.group === filter || (filter === "blink" && BLINKABLE.has(b.name))).map(
      (body) => ({ type: "body", body }),
    );
    const pool = filter === "planets" ? planets : filter === "all" ? [...planets, ...bodies.filter((s) => s.type === "body" && s.body.group === "famous"), ...bodies] : bodies;
    const seen = new Set<string>();
    const matches = pool.filter((s) => {
      const key = keyOf(s);
      if (seen.has(key)) return false;
      seen.add(key);
      return !text || nameOf(s).toLowerCase().includes(text);
    });
    return { total: matches.length, shown: matches.slice(0, 200) };
  }, [filter, search]);

  useEffect(() => {
    api.current?.setFilter(filter);
  }, [filter]);

  useEffect(() => {
    api.current?.setPlaying(playing);
  }, [playing]);

  useEffect(() => {
    api.current?.setSpeed(SPEEDS[speed].days);
  }, [speed]);

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
    const camera = new THREE.PerspectiveCamera(45, width() / height(), 0.05, 4000);
    camera.position.set(0, 46, 70);
    const controls = new OrbitControls(camera, renderer.domElement);
    controls.enableDamping = true;
    controls.dampingFactor = 0.08;
    controls.minDistance = 1.2;
    controls.maxDistance = 420;
    controls.zoomSpeed = 1.2;

    const glow = glowTexture();

    const skyPositions: number[] = [];
    const skyColours: number[] = [];
    for (const [ra, dec, v, bv] of BRIGHT as number[][]) {
      const p = skyDirection(ra, dec).multiplyScalar(SKY_RADIUS);
      skyPositions.push(p.x, p.y, p.z);
      const [r, g, b] = colourFromBV(bv);
      const fade = v < 2 ? 1 : v < 4 ? 0.7 : 0.45;
      skyColours.push(r * fade, g * fade, b * fade);
    }
    const skyGeometry = new THREE.BufferGeometry();
    skyGeometry.setAttribute("position", new THREE.Float32BufferAttribute(skyPositions, 3));
    skyGeometry.setAttribute("color", new THREE.Float32BufferAttribute(skyColours, 3));
    scene.add(
      new THREE.Points(
        skyGeometry,
        new THREE.PointsMaterial({ size: 3, sizeAttenuation: false, vertexColors: true, map: glow, transparent: true, depthWrite: false, blending: THREE.AdditiveBlending }),
      ),
    );

    scene.add(new THREE.AmbientLight("#ffffff", 0.12));
    const sunLight = new THREE.PointLight("#fff4dd", 3, 0, 0);
    scene.add(sunLight);
    const sunCore = new THREE.Mesh(new THREE.SphereGeometry(1.4, 48, 32), new THREE.MeshBasicMaterial({ color: "#fff1c8" }));
    scene.add(sunCore);
    const sunGlow = new THREE.Sprite(new THREE.SpriteMaterial({ map: glow, color: "#ffc86a", blending: THREE.AdditiveBlending, depthWrite: false }));
    sunGlow.scale.setScalar(11);
    scene.add(sunGlow);
    const sunLabel = label("Sun", styles.sunLabel);
    sunLabel.position.set(0, 2.4, 0);
    scene.add(sunLabel);

    const scratch: Vec = [0, 0, 0];
    const scenePos: Vec = [0, 0, 0];
    const state = { jd: julianDate(Date.now()), playing: !reducedMotion(), speed: SPEEDS[DEFAULT_SPEED].days, lastUi: 0, filter: "all" as Filter };

    const orbitMaterial = (colour: string, opacity: number) => new THREE.LineBasicMaterial({ color: colour, transparent: true, opacity });
    const lineFrom = (points: Vec[], material: THREE.LineBasicMaterial) =>
      new THREE.Line(new THREE.BufferGeometry().setFromPoints(points.map((p) => new THREE.Vector3(...toScene(p)))), material);

    const planetMeshes = new Map<string, THREE.Mesh>();
    for (const planet of PLANETS) {
      scene.add(lineFrom(orbitPoints(planetOrbit(planet, state.jd), 360), orbitMaterial(planet.colour, 0.22)));
      const mesh = new THREE.Mesh(
        new THREE.SphereGeometry(PLANET_SIZE[planet.key], 32, 24),
        new THREE.MeshStandardMaterial({ color: planet.colour, roughness: 0.9, metalness: 0, emissive: planet.colour, emissiveIntensity: 0.08 }),
      );
      if (planet.key === "saturn") {
        const ring = new THREE.Mesh(
          new THREE.RingGeometry(PLANET_SIZE.saturn * 1.35, PLANET_SIZE.saturn * 2.3, 64),
          new THREE.MeshBasicMaterial({ color: "#d8c79a", side: THREE.DoubleSide, transparent: true, opacity: 0.55 }),
        );
        ring.rotation.x = Math.PI / 2 - 0.47;
        mesh.add(ring);
      }
      const tag = label(planet.name, styles.planetLabel);
      tag.position.set(0, PLANET_SIZE[planet.key] + 0.9, 0);
      mesh.add(tag);
      scene.add(mesh);
      planetMeshes.set(planet.key, mesh);
    }

    const extremeOrbits = new THREE.Group();
    for (const body of SMALL_BODIES.filter((b) => b.group === "extreme")) {
      extremeOrbits.add(lineFrom(orbitPoints(body, 240), orbitMaterial("#c35cff", 0.16)));
    }
    extremeOrbits.visible = false;
    scene.add(extremeOrbits);

    const groupPoints = new Map<Group, { points: THREE.Points; bodies: SmallBody[]; positions: Float32Array }>();
    for (const group of GROUPS) {
      const bodies = SMALL_BODIES.filter((b) => b.group === group.id);
      const positions = new Float32Array(bodies.length * 3);
      const geometry = new THREE.BufferGeometry();
      geometry.setAttribute("position", new THREE.BufferAttribute(positions, 3));
      const points = new THREE.Points(
        geometry,
        new THREE.PointsMaterial({ size: group.size, sizeAttenuation: false, color: group.colour, map: glow, transparent: true, depthWrite: false, blending: THREE.AdditiveBlending }),
      );
      points.frustumCulled = false;
      scene.add(points);
      groupPoints.set(group.id, { points, bodies, positions });
    }
    for (const body of SMALL_BODIES.filter((b) => b.group === "famous")) {
      const tag = label(body.name, styles.bodyLabel);
      tag.userData.body = body;
      scene.add(tag);
    }
    const famousTags = scene.children.filter((c) => c.userData.body) as CSS2DObject[];

    const marker = new THREE.Mesh(
      new THREE.RingGeometry(0.93, 1.0, 64),
      new THREE.MeshBasicMaterial({ color: "#5cc8ff", side: THREE.DoubleSide, transparent: true, opacity: 0.95, depthTest: false }),
    );
    marker.visible = false;
    marker.renderOrder = 10;
    scene.add(marker);
    const focusLabel = label("", styles.focusLabel);
    focusLabel.visible = false;
    scene.add(focusLabel);
    const hover = label("", styles.hoverLabel);
    hover.visible = false;
    scene.add(hover);
    const selectedOrbit = { line: null as THREE.Line | null };

    const follow = { selection: null as Selection | null, offset: new THREE.Vector3() };
    const flight = { active: false, start: 0, fromTarget: new THREE.Vector3(), fromCamera: new THREE.Vector3(), distance: 10 };

    function placeOf(selection: Selection, jd: number): THREE.Vector3 {
      return new THREE.Vector3(...toScene(heliocentric(selection, jd), scenePos));
    }

    function updatePositions() {
      for (const planet of PLANETS) {
        toScene(planetPosition(planet, state.jd, scratch), scenePos);
        planetMeshes.get(planet.key)?.position.set(...scenePos);
      }
      for (const { points, bodies, positions } of groupPoints.values()) {
        if (!points.visible) continue;
        for (let k = 0; k < bodies.length; k++) {
          toScene(bodyPosition(bodies[k], state.jd, scratch), scenePos);
          positions[k * 3] = scenePos[0];
          positions[k * 3 + 1] = scenePos[1];
          positions[k * 3 + 2] = scenePos[2];
        }
        points.geometry.attributes.position.needsUpdate = true;
      }
      for (const tag of famousTags) {
        toScene(bodyPosition(tag.userData.body as SmallBody, state.jd, scratch), scenePos);
        tag.position.set(scenePos[0], scenePos[1] + 1.1, scenePos[2]);
      }
    }

    function applyFilter(chosen: Filter) {
      const filter = chosen === "blink" ? "all" : chosen;
      state.filter = filter;
      for (const [group, { points }] of groupPoints) {
        points.visible = filter === "all" || filter === group || group === "famous";
        (points.material as THREE.PointsMaterial).opacity = filter === "all" || filter === group ? 1 : 0.5;
      }
      if (filter === "planets") for (const { points } of groupPoints.values()) points.visible = false;
      extremeOrbits.visible = filter === "extreme";
      for (const tag of famousTags) tag.visible = filter === "all" || filter === "famous";
      updatePositions();
    }

    api.current = {
      focus(selection) {
        follow.selection = selection;
        const place = placeOf(selection, state.jd);
        const size = selection.type === "planet" ? PLANET_SIZE[selection.planet.key] : selection.type === "sun" ? 1.4 : 0.3;
        flight.distance = selection.type === "sun" ? 70 : Math.max(5, size * 9);
        flight.fromTarget.copy(controls.target);
        flight.fromCamera.copy(camera.position);
        flight.start = performance.now();
        flight.active = !reducedMotion();
        const direction = camera.position.clone().sub(controls.target).normalize();
        if (selection.type === "sun") direction.set(0, 0.55, 0.83);
        follow.offset.copy(direction.multiplyScalar(flight.distance));
        if (!flight.active) {
          controls.target.copy(place);
          camera.position.copy(place).add(follow.offset);
        }
        if (selectedOrbit.line) {
          scene.remove(selectedOrbit.line);
          selectedOrbit.line.geometry.dispose();
          (selectedOrbit.line.material as THREE.Material).dispose();
          selectedOrbit.line = null;
        }
        if (selection.type === "body") {
          selectedOrbit.line = lineFrom(orbitPoints(selection.body, 360), orbitMaterial("#5cc8ff", 0.75));
          scene.add(selectedOrbit.line);
        }
        marker.visible = selection.type !== "sun";
        marker.userData.size = selection.type === "planet" ? PLANET_SIZE[selection.planet.key] * 1.5 : 0;
        (focusLabel.element as HTMLElement).textContent = nameOf(selection);
        focusLabel.visible = selection.type === "body" && selection.body.group !== "famous";
      },
      setFilter: applyFilter,
      setPlaying(playing) {
        state.playing = playing;
      },
      setSpeed(days) {
        state.speed = days;
      },
      setJd(jd) {
        state.jd = jd;
        updatePositions();
      },
    };
    applyFilter("all");

    const pointer = new THREE.Vector2();
    const projected = new THREE.Vector3();
    const gesture = { dragged: false, lastMove: 0 };

    function pick(event: PointerEvent): Selection | null {
      const bounds = renderer.domElement.getBoundingClientRect();
      pointer.set(event.clientX - bounds.left, event.clientY - bounds.top);
      const best = { selection: null as Selection | null, distance: 10 };
      const consider = (selection: Selection, position: THREE.Vector3, radius: number) => {
        projected.copy(position).project(camera);
        if (projected.z > 1) return;
        const x = ((projected.x + 1) / 2) * bounds.width;
        const y = ((1 - projected.y) / 2) * bounds.height;
        const distance = Math.hypot(x - pointer.x, y - pointer.y) - radius;
        if (distance < best.distance) {
          best.distance = distance;
          best.selection = selection;
        }
      };
      consider({ type: "sun" }, new THREE.Vector3(), 14);
      for (const planet of PLANETS) {
        const mesh = planetMeshes.get(planet.key);
        if (mesh) consider({ type: "planet", planet }, mesh.position, 6);
      }
      for (const { points, bodies, positions } of groupPoints.values()) {
        if (!points.visible) continue;
        for (let k = 0; k < bodies.length; k++) {
          projected.set(positions[k * 3], positions[k * 3 + 1], positions[k * 3 + 2]);
          consider({ type: "body", body: bodies[k] }, projected.clone(), bodies[k].group === "famous" ? 3 : 0);
        }
      }
      return best.selection;
    }

    function onMove(event: PointerEvent) {
      if (event.buttons) {
        gesture.dragged = true;
        return;
      }
      const now = performance.now();
      if (now - gesture.lastMove < 60) return;
      gesture.lastMove = now;
      const found = pick(event);
      renderer.domElement.style.cursor = found ? "pointer" : "grab";
      if (found) {
        (hover.element as HTMLElement).textContent = nameOf(found);
        hover.position.copy(placeOf(found, state.jd)).add(new THREE.Vector3(0, -1.2, 0));
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
      const found = pick(event);
      if (found) {
        setSelected(found);
        api.current?.focus(found);
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

    const clock = new THREE.Clock();
    const animation = { frame: 0 };
    const loop = (now: number) => {
      animation.frame = requestAnimationFrame(loop);
      const dt = Math.min(clock.getDelta(), 0.1);
      if (state.playing) {
        state.jd += dt * state.speed;
        updatePositions();
        if (now - state.lastUi > 250) {
          state.lastUi = now;
          setJd(state.jd);
        }
      }
      if (follow.selection) {
        const place = placeOf(follow.selection, state.jd);
        if (flight.active) {
          const t = Math.min(1, (now - flight.start) / FLY_MS);
          const k = t * t * (3 - 2 * t);
          controls.target.lerpVectors(flight.fromTarget, place, k);
          camera.position.lerpVectors(flight.fromCamera, place.clone().add(follow.offset), k);
          if (t >= 1) flight.active = false;
        } else {
          const shift = place.clone().sub(controls.target);
          controls.target.add(shift);
          camera.position.add(shift);
          follow.offset.copy(camera.position).sub(controls.target);
        }
        marker.position.copy(place);
        marker.quaternion.copy(camera.quaternion);
        marker.scale.setScalar(Math.max(marker.userData.size ?? 0, camera.position.distanceTo(place) * 0.03));
        focusLabel.position.copy(place).add(new THREE.Vector3(0, 1.3, 0));
      }
      sunCore.rotation.y += dt * 0.05;
      controls.update();
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

  function choose(selection: Selection) {
    setSelected(selection);
    api.current?.focus(selection);
  }

  function goToday() {
    const now = julianDate(Date.now());
    setJd(now);
    api.current?.setJd(now);
  }

  if (error) return <p className={styles.error}>{error}</p>;

  return (
    <div className={styles.wrap}>
      <div className={styles.layout}>
        <div className={styles.stageWrap}>
          <div ref={holder} className={styles.stage} style={height ? { height } : undefined} />
          <div className={styles.timeDock}>
            <button type="button" className={styles.play} onClick={() => setPlaying((p) => !p)} aria-label={playing ? "Pause time" : "Play time"}>
              {playing ? "❚❚" : "▶"}
            </button>
            <span className={`mono ${styles.date}`}>{formatDate(jd)}</span>
            {SPEEDS.map((s, index) => (
              <button key={s.label} type="button" className={styles.speed} aria-pressed={speed === index} onClick={() => setSpeed(index)}>
                {s.label}
              </button>
            ))}
            <button type="button" className={styles.speed} onClick={goToday}>
              Today
            </button>
          </div>
          <button type="button" className={styles.home} onClick={() => choose({ type: "sun" })}>
            ⌂ Whole system
          </button>
          {selected ? <BodyCard selection={selected} jd={jd} onClose={() => setSelected(null)} /> : null}
        </div>
        <aside className={styles.side} style={height ? { maxHeight: height } : undefined}>
          <input
            className={styles.search}
            type="search"
            placeholder="Find a planet, asteroid or comet"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            aria-label="Find a body"
          />
          <div className={styles.filters} role="group" aria-label="Show">
            {FILTERS.map((f) => (
              <button key={f.id} type="button" className={styles.filter} aria-pressed={filter === f.id} onClick={() => setFilter(f.id)}>
                {f.label}
              </button>
            ))}
          </div>
          <ul className={styles.list}>
            {listed.shown.map((s) => (
              <li key={keyOf(s)}>
                <button type="button" className={styles.item} aria-pressed={selected ? keyOf(selected) === keyOf(s) : false} onClick={() => choose(s)}>
                  <i style={{ background: s.type === "planet" ? s.planet.colour : s.type === "body" ? GROUP_STYLE.get(s.body.group)?.colour : "#ffc86a" }} />
                  <span className={styles.itemName}>{nameOf(s)}</span>
                  <span className={styles.itemMeta}>{s.type === "body" ? s.body.cls : "planet"}</span>
                </button>
              </li>
            ))}
          </ul>
          <span className={styles.count}>
            {listed.shown.length < listed.total ? `First ${listed.shown.length} of ${listed.total.toLocaleString("en")}` : `${listed.total} shown`}
          </span>
        </aside>
      </div>
      {filter === "extreme" ? (
        <p className={`panel ${styles.clue}`}>
          <strong>Planet Nine clues.</strong> These objects never come closer to the Sun than Neptune, yet swing out hundreds
          of times farther than Earth. Several of their orbits point the same way. Some astronomers read that as the pull of
          an unseen planet; others as a bias in where surveys have looked. No such planet has been found. All-sky infrared
          maps like SPHEREx's are one way to look.
        </p>
      ) : null}
      <p className={styles.note}>
        {SMALL_BODIES.length.toLocaleString("en")} asteroids, comets and distant objects from NASA/JPL's Small-Body Database,
        and the planets from JPL's mean orbital elements, each moved along its own orbit. Distances are compressed so every
        planet fits; sizes are not to scale. Drag to turn, scroll to zoom, click anything to follow it.
      </p>
    </div>
  );
}

function BodyCard({ selection, jd, onClose }: { selection: Selection; jd: number; onClose: () => void }) {
  const earth = planetPosition(PLANETS[2], jd);
  const here = heliocentric(selection, jd);
  const sunDistance = Math.hypot(...here);
  const sky = selection.type === "sun" || (selection.type === "planet" && selection.planet.key === "earth") ? null : skyPlace(here, earth);
  const rate = selection.type === "body" ? skyRate(selection.body, jd) : null;
  const body = selection.type === "body" ? selection.body : null;
  const orbit = selection.type === "planet" ? planetOrbit(selection.planet, jd) : body;
  const kindLabel =
    selection.type === "sun" ? "Our star · G2V" : selection.type === "planet" ? "Planet" : CLASS_LABEL[body?.cls ?? ""] ?? body?.cls ?? "Small body";

  return (
    <div className={styles.card} role="dialog" aria-label={nameOf(selection)}>
      <button type="button" className={styles.close} onClick={onClose} aria-label="Close">
        ×
      </button>
      <span className={styles.kind}>{kindLabel}</span>
      <strong className={styles.title}>{nameOf(selection)}</strong>
      <Body3D kind={kindOf(selection)} id={keyOf(selection)} />
      <dl className={styles.facts}>
        {orbit && selection.type !== "sun" ? (
          <>
            <div>
              <dt>Orbit</dt>
              <dd className="mono">
                {orbit.a.toFixed(orbit.a < 10 ? 2 : 0)} AU · e {orbit.e.toFixed(2)} · {orbit.i.toFixed(1)}°
              </dd>
            </div>
            <div>
              <dt>Year</dt>
              <dd className="mono">
                {periodYears(orbit.a) < 2 ? `${Math.round(periodYears(orbit.a) * 365.25)} days` : `${periodYears(orbit.a).toFixed(periodYears(orbit.a) < 100 ? 1 : 0)} years`}
              </dd>
            </div>
          </>
        ) : null}
        {selection.type === "planet" ? (
          <div>
            <dt>Radius</dt>
            <dd className="mono">{Math.round(selection.planet.radiusKm).toLocaleString("en")} km</dd>
          </div>
        ) : null}
        {body ? (
          <div>
            <dt>Size</dt>
            <dd className="mono">{body.diameter ? `${body.diameter < 10 ? body.diameter.toFixed(1) : Math.round(body.diameter)} km across` : body.H !== null ? `unknown · H ${body.H}` : "unknown"}</dd>
          </div>
        ) : null}
        {selection.type !== "sun" ? (
          <div>
            <dt>From the Sun</dt>
            <dd className="mono">{sunDistance.toFixed(sunDistance < 10 ? 2 : 1)} AU</dd>
          </div>
        ) : null}
        {sky ? (
          <>
            <div>
              <dt>From Earth</dt>
              <dd className="mono">{sky.distanceAu.toFixed(sky.distanceAu < 10 ? 2 : 1)} AU</dd>
            </div>
            <div>
              <dt>In our sky</dt>
              <dd className={`mono ${styles.predicted}`}>
                {formatRa(sky.ra)} {formatDec(sky.dec)}
              </dd>
            </div>
            <div>
              <dt>Angle from the Sun</dt>
              <dd className="mono">{sky.elongation.toFixed(0)}°</dd>
            </div>
          </>
        ) : null}
        {rate !== null ? (
          <div>
            <dt>Moves across the sky</dt>
            <dd className={`mono ${styles.predicted}`}>
              {rate < 10 ? rate.toFixed(1) : Math.round(rate)}″ per hour
            </dd>
          </div>
        ) : null}
      </dl>
      {rate !== null ? (
        <p className={styles.blinkNote}>
          {sky && sky.elongation < 45
            ? `On this date it sits ${sky.elongation.toFixed(0)}° from the Sun in our sky, too close for SPHEREx or any night-sky survey to look. Play time forward to see it move out.`
            : rate / SPHEREX_PIXEL_ARCSEC >= 1
            ? `About ${(rate / SPHEREX_PIXEL_ARCSEC).toFixed(rate / SPHEREX_PIXEL_ARCSEC < 10 ? 1 : 0)} SPHEREx pixels an hour: it would jump between exposures, the kind of mover a blink catches.`
            : `About ${((rate * 24) / SPHEREX_PIXEL_ARCSEC).toFixed(1)} SPHEREx pixels a day: too slow to see in one visit, but it shifts between passes six months apart.`}
        </p>
      ) : null}
      {body && BLINKABLE.has(body.name) ? (
        <Link to={trackLink(body.name)} className={`btn btn-primary ${styles.blinkButton}`}>
          Blink it with SPHEREx
        </Link>
      ) : body && body.designation ? (
        <>
          <Link
            to={trackLink(body.name, "D2", body.designation, body.group === "comet" ? "comet" : "asteroid")}
            className={`btn btn-primary ${styles.blinkButton}`}
          >
            Track it with SPHEREx
          </Link>
          <span className={styles.trackNote}>Asks NASA's moving-object search live, about 20 seconds the first time.</span>
        </>
      ) : null}
      {selection.type !== "sun" ? (
        <span className={styles.source}>
          {formatDate(jd)} · predicted from JPL orbital elements, two-body motion · indicative
        </span>
      ) : null}
    </div>
  );
}
