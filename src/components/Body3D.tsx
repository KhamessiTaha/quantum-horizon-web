import { useEffect, useRef } from "react";
import * as THREE from "three";
import type { PlanetKey } from "../lib/orbits.ts";
import type { Kind } from "../lib/stellar.ts";
import styles from "./Body3D.module.css";

export type BodyKind = Kind | PlanetKey | "asteroid" | "comet";

const STAR = 0;
const BANDED = 1;
const ROCKY = 2;
const EARTH = 3;
const LUMPY = 4;

interface Look {
  bright: string;
  dark: string;
  glow: string;
  mode: number;
  lit: number;
  spots: number;
  granulation: number;
  bands: number;
  contrast: number;
  ice: number;
  halo: number;
  scale: number;
  ring?: { inner: number; outer: number; colour: string; tilt: number; opacity: number };
}

const star = (bright: string, dark: string, glow: string, spots: number, granulation: number, scale = 1): Look => ({
  bright, dark, glow, mode: STAR, lit: 0, spots, granulation, bands: 0, contrast: 0, ice: 0, halo: 1.4, scale,
});

const dwarf = (bright: string, dark: string, glow: string, scale: number): Look => ({
  bright, dark, glow, mode: BANDED, lit: 0, spots: 0, granulation: 0, bands: 18, contrast: 0.75, ice: 0, halo: 0.7, scale,
});

const planet = (partial: Partial<Look> & Pick<Look, "bright" | "dark" | "mode">): Look => ({
  glow: partial.bright, lit: 1, spots: 0, granulation: 0, bands: 0, contrast: 0, ice: 0, halo: 0, scale: 0.85, ...partial,
});

const LOOKS: Record<BodyKind, Look> = {
  O: star("#dfe8ff", "#8fa8ff", "#9bb0ff", 0, 0.25),
  B: star("#e4ecff", "#9db4ff", "#aabfff", 0, 0.25),
  A: star("#f3f6ff", "#b9c9ff", "#cad7ff", 0, 0.3),
  F: star("#fffdf4", "#e6dcc0", "#f8f7ff", 0.1, 0.45),
  G: star("#fff3c4", "#e09a2c", "#ffd27a", 0.2, 0.7),
  K: star("#ffd08a", "#c0581c", "#ffad5c", 0.35, 0.75, 0.92),
  M: star("#ff9a5c", "#7a1c0c", "#ff6a3a", 0.6, 0.85, 0.85),
  L: dwarf("#c8603a", "#4a1608", "#b0402a", 0.8),
  T: dwarf("#c46ad8", "#2c1452", "#9a4dff", 0.8),
  Y: dwarf("#7a5ad0", "#160c30", "#6a4cff", 0.78),
  WD: star("#f4f8ff", "#c9d8ff", "#dde8ff", 0, 0.1, 0.6),
  "?": star("#d0d6de", "#5a6270", "#9aa4b2", 0.2, 0.5, 0.85),
  mercury: planet({ bright: "#bdb5ad", dark: "#4f4a45", mode: ROCKY, scale: 0.75 }),
  venus: planet({ bright: "#f5e6c0", dark: "#c99a5b", mode: BANDED, bands: 5, contrast: 0.35, halo: 0.45 }),
  earth: planet({ bright: "#2f6fc0", dark: "#0c2a5a", glow: "#7fb6ff", mode: EARTH, halo: 0.55, ice: 1 }),
  mars: planet({ bright: "#e08050", dark: "#6a2a12", glow: "#ff9a6a", mode: ROCKY, ice: 1, halo: 0.2, scale: 0.8 }),
  jupiter: planet({ bright: "#efdcbc", dark: "#9a5a32", mode: BANDED, bands: 22, contrast: 0.8, halo: 0.25, scale: 0.92 }),
  saturn: planet({
    bright: "#f0e0b0", dark: "#b08a50", mode: BANDED, bands: 14, contrast: 0.4, halo: 0.2, scale: 0.56,
    ring: { inner: 1.25, outer: 2.25, colour: "#e8d6aa", tilt: 0.47, opacity: 0.85 },
  }),
  uranus: planet({
    bright: "#c4f1f4", dark: "#86ccd6", mode: BANDED, bands: 6, contrast: 0.15, halo: 0.45, scale: 0.8,
    ring: { inner: 1.6, outer: 1.68, colour: "#cfe8ee", tilt: 1.71, opacity: 0.45 },
  }),
  neptune: planet({ bright: "#6f9cff", dark: "#203f9c", mode: BANDED, bands: 8, contrast: 0.35, halo: 0.45, scale: 0.8 }),
  asteroid: planet({ bright: "#a39a90", dark: "#3e3934", mode: LUMPY, scale: 0.8 }),
  comet: planet({ bright: "#7c746c", dark: "#24201c", glow: "#a8e4ff", mode: LUMPY, halo: 1.1, scale: 0.6 }),
};

const NOISE = `
vec3 mod289(vec3 x){return x-floor(x*(1.0/289.0))*289.0;}
vec4 mod289(vec4 x){return x-floor(x*(1.0/289.0))*289.0;}
vec4 permute(vec4 x){return mod289(((x*34.0)+1.0)*x);}
vec4 taylorInvSqrt(vec4 r){return 1.79284291400159-0.85373472095314*r;}
float snoise(vec3 v){
  const vec2 C=vec2(1.0/6.0,1.0/3.0);const vec4 D=vec4(0.0,0.5,1.0,2.0);
  vec3 i=floor(v+dot(v,C.yyy));vec3 x0=v-i+dot(i,C.xxx);
  vec3 g=step(x0.yzx,x0.xyz);vec3 l=1.0-g;vec3 i1=min(g.xyz,l.zxy);vec3 i2=max(g.xyz,l.zxy);
  vec3 x1=x0-i1+C.xxx;vec3 x2=x0-i2+C.yyy;vec3 x3=x0-D.yyy;
  i=mod289(i);
  vec4 p=permute(permute(permute(i.z+vec4(0.0,i1.z,i2.z,1.0))+i.y+vec4(0.0,i1.y,i2.y,1.0))+i.x+vec4(0.0,i1.x,i2.x,1.0));
  float n_=0.142857142857;vec3 ns=n_*D.wyz-D.xzx;
  vec4 j=p-49.0*floor(p*ns.z*ns.z);vec4 x_=floor(j*ns.z);vec4 y_=floor(j-7.0*x_);
  vec4 x=x_*ns.x+ns.yyyy;vec4 y=y_*ns.x+ns.yyyy;vec4 h=1.0-abs(x)-abs(y);
  vec4 b0=vec4(x.xy,y.xy);vec4 b1=vec4(x.zw,y.zw);
  vec4 s0=floor(b0)*2.0+1.0;vec4 s1=floor(b1)*2.0+1.0;vec4 sh=-step(h,vec4(0.0));
  vec4 a0=b0.xzyw+s0.xzyw*sh.xxyy;vec4 a1=b1.xzyw+s1.xzyw*sh.zzww;
  vec3 p0=vec3(a0.xy,h.x);vec3 p1=vec3(a0.zw,h.y);vec3 p2=vec3(a1.xy,h.z);vec3 p3=vec3(a1.zw,h.w);
  vec4 norm=taylorInvSqrt(vec4(dot(p0,p0),dot(p1,p1),dot(p2,p2),dot(p3,p3)));
  p0*=norm.x;p1*=norm.y;p2*=norm.z;p3*=norm.w;
  vec4 m=max(0.6-vec4(dot(x0,x0),dot(x1,x1),dot(x2,x2),dot(x3,x3)),0.0);m=m*m;
  return 42.0*dot(m*m,vec4(dot(p0,x0),dot(p1,x1),dot(p2,x2),dot(p3,x3)));
}
float fbm(vec3 p){float f=0.0;float a=0.5;for(int i=0;i<5;i++){f+=a*snoise(p);p*=2.03;a*=0.5;}return f;}
`;

const SURFACE_VERTEX = `
uniform float uMode;uniform float uSeed;
varying vec3 vPosition;varying vec3 vNormal;varying vec3 vView;
${NOISE}
void main(){
  vec3 p=position;
  if(uMode>3.5){
    vec3 q=normalize(position);
    float lump=fbm(q*1.2+uSeed)*0.42+snoise(q*3.1+uSeed*2.0)*0.08;
    float stretch=1.0+0.35*q.x*q.x;
    p=position*(1.0+lump)*vec3(stretch,1.0,1.0);
  }
  vPosition=position;
  vNormal=normalize(normalMatrix*normal);
  vec4 world=modelViewMatrix*vec4(p,1.0);
  vView=-world.xyz;
  gl_Position=projectionMatrix*world;
}`;

const GLOW_VERTEX = `
varying vec3 vNormal;
void main(){
  vNormal=normalize(normalMatrix*normal);
  gl_Position=projectionMatrix*modelViewMatrix*vec4(position,1.0);
}`;

const SURFACE_FRAGMENT = `
uniform float uTime;uniform float uSeed;uniform vec3 uBright;uniform vec3 uDark;uniform float uMode;uniform float uLit;
uniform float uSpots;uniform float uGranulation;uniform float uBands;uniform float uContrast;uniform float uIce;
varying vec3 vPosition;varying vec3 vNormal;varying vec3 vView;
${NOISE}
void main(){
  vec3 q=normalize(vPosition);
  vec3 p=q+uSeed;
  vec3 view=normalize(vView);
  vec3 n=normalize(vNormal);
  if(uMode>3.5){n=normalize(cross(dFdx(-vView),dFdy(-vView)));}
  float limb=max(dot(n,view),0.0);
  vec3 colour;
  if(uMode<0.5){
    float cells=fbm(p*9.0+vec3(0.0,0.0,uTime*0.05));
    float spots=smoothstep(0.35,0.6,fbm(p*2.2+uSeed));
    colour=mix(uBright,uDark,clamp(0.5-cells*uGranulation,0.0,1.0)*0.55);
    colour=mix(colour,uDark*0.55,spots*uSpots);
    colour*=0.45+0.7*pow(limb,0.45);
    colour+=uBright*0.12;
  } else if(uMode<1.5){
    float turbulence=fbm(p*vec3(2.0,6.0,2.0)+vec3(uTime*0.03,0.0,0.0));
    float bands=sin((q.y+turbulence*0.18)*uBands+uSeed*3.0)*0.5+0.5;
    float storms=smoothstep(0.55,0.8,fbm(p*4.0+uTime*0.02));
    colour=mix(uDark,uBright,mix(0.6,bands*0.75+0.15,uContrast));
    colour=mix(colour,uBright*1.15,storms*0.35*uContrast);
    if(uLit<0.5){colour*=0.35+0.75*pow(limb,0.7);}
  } else if(uMode<2.5){
    float terrain=fbm(p*2.5)*0.6+fbm(p*9.0)*0.4;
    float craters=smoothstep(0.25,0.55,abs(snoise(p*7.0)));
    colour=mix(uDark,uBright,clamp(0.55+terrain*0.9,0.0,1.0));
    colour*=0.82+0.18*craters;
    colour=mix(colour,vec3(0.95,0.96,1.0),uIce*smoothstep(0.86,0.93,abs(q.y)));
  } else if(uMode<3.5){
    float land=smoothstep(0.02,0.1,fbm(p*1.7));
    vec3 ground=mix(vec3(0.24,0.42,0.2),vec3(0.62,0.52,0.34),smoothstep(-0.1,0.35,fbm(p*4.0)));
    colour=mix(mix(uDark,uBright,0.5+0.5*fbm(p*6.0)),ground,land);
    colour=mix(colour,vec3(0.94,0.96,1.0),smoothstep(0.8,0.88,abs(q.y)));
    float clouds=smoothstep(0.08,0.45,fbm(p*3.2+vec3(uTime*0.012,0.0,0.0)));
    colour=mix(colour,vec3(1.0),clouds*0.75);
  } else {
    float terrain=fbm(p*3.0)*0.7+fbm(p*11.0)*0.3;
    float craters=smoothstep(0.2,0.6,abs(snoise(p*6.0)));
    colour=mix(uDark,uBright,clamp(0.5+terrain,0.0,1.0))*(0.75+0.25*craters);
  }
  if(uLit>0.5){
    vec3 light=normalize(vec3(-0.75,0.35,0.6));
    float diffuse=max(dot(n,light),0.0);
    colour*=0.04+1.05*pow(diffuse,0.85);
  }
  gl_FragColor=vec4(colour,1.0);
}`;

const GLOW_FRAGMENT = `
uniform vec3 uGlow;uniform float uStrength;varying vec3 vNormal;
void main(){
  float halo=pow(max(-dot(normalize(vNormal),vec3(0.0,0.0,1.0)),0.0),2.2);
  gl_FragColor=vec4(uGlow,clamp(halo*uStrength,0.0,1.0));
}`;

const RING_VERTEX = `
varying float vRadius;
void main(){
  vRadius=length(position.xy);
  gl_Position=projectionMatrix*modelViewMatrix*vec4(position,1.0);
}`;

const RING_FRAGMENT = `
uniform vec3 uColour;uniform float uInner;uniform float uOuter;uniform float uOpacity;varying float vRadius;
void main(){
  float t=(vRadius-uInner)/(uOuter-uInner);
  float bands=0.55+0.45*sin(t*70.0)*sin(t*23.0+1.3);
  float gap=1.0-smoothstep(0.6,0.62,t)*(1.0-smoothstep(0.66,0.68,t));
  float edge=smoothstep(0.0,0.04,t)*(1.0-smoothstep(0.95,1.0,t));
  gl_FragColor=vec4(uColour*(0.7+0.3*bands),uOpacity*bands*gap*edge);
}`;

function captionFor(kind: BodyKind): string {
  if (kind === "asteroid" || kind === "comet") return "Artist’s impression · the shape is invented";
  if (kind.length > 2) return "Artist’s impression · not an image";
  return "Artist’s impression from the spectral type · not an image";
}

function seedOf(text: string): number {
  let hash = 0;
  for (const ch of text) hash = (hash * 31 + ch.charCodeAt(0)) % 1000;
  return hash / 100;
}

/** An artist's impression of a star or brown dwarf, chosen from its spectral type. It is not an image of the object. */
export default function Body3D({
  kind,
  id,
  className,
  caption = true,
}: {
  kind: BodyKind;
  id: string;
  className?: string;
  caption?: boolean;
}) {
  const holder = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const host = holder.current;
    if (!host) return;
    const look = LOOKS[kind];
    const renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true });
    renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
    renderer.setSize(host.clientWidth, host.clientHeight);
    host.append(renderer.domElement);

    const scene = new THREE.Scene();
    const camera = new THREE.PerspectiveCamera(35, host.clientWidth / host.clientHeight, 0.1, 50);
    camera.position.set(0, 0, 4.2);

    const uniforms = {
      uTime: { value: 0 },
      uSeed: { value: seedOf(id) },
      uBright: { value: new THREE.Color(look.bright) },
      uDark: { value: new THREE.Color(look.dark) },
      uMode: { value: look.mode },
      uLit: { value: look.lit },
      uSpots: { value: look.spots },
      uGranulation: { value: look.granulation },
      uBands: { value: look.bands },
      uContrast: { value: look.contrast },
      uIce: { value: look.ice },
    };
    const body = new THREE.Mesh(
      new THREE.SphereGeometry(look.scale, 96, 64),
      new THREE.ShaderMaterial({ uniforms, vertexShader: SURFACE_VERTEX, fragmentShader: SURFACE_FRAGMENT }),
    );
    const tilt = new THREE.Group();
    tilt.rotation.z = look.ring ? look.ring.tilt * 0.35 : look.mode === BANDED ? 0.38 : 0.12;
    tilt.add(body);
    scene.add(tilt);

    const glow = new THREE.Mesh(
      new THREE.SphereGeometry(look.scale * (look.mode === STAR ? 1.38 : look.mode === LUMPY ? 1.9 : 1.12), 64, 32),
      new THREE.ShaderMaterial({
        uniforms: { uGlow: { value: new THREE.Color(look.glow) }, uStrength: { value: look.halo } },
        vertexShader: GLOW_VERTEX,
        fragmentShader: GLOW_FRAGMENT,
        transparent: true,
        blending: THREE.AdditiveBlending,
        side: THREE.BackSide,
        depthWrite: false,
      }),
    );
    glow.visible = look.halo > 0;
    scene.add(glow);

    if (look.ring) {
      const ring = new THREE.Mesh(
        new THREE.RingGeometry(look.scale * look.ring.inner, look.scale * look.ring.outer, 128, 1),
        new THREE.ShaderMaterial({
          uniforms: {
            uColour: { value: new THREE.Color(look.ring.colour) },
            uInner: { value: look.scale * look.ring.inner },
            uOuter: { value: look.scale * look.ring.outer },
            uOpacity: { value: look.ring.opacity },
          },
          vertexShader: RING_VERTEX,
          fragmentShader: RING_FRAGMENT,
          transparent: true,
          side: THREE.DoubleSide,
          depthWrite: false,
        }),
      );
      ring.rotation.x = Math.PI / 2 - 0.32;
      tilt.add(ring);
    }

    const still = window.matchMedia?.("(prefers-reduced-motion: reduce)").matches === true;
    const clock = new THREE.Clock();
    const animation = { frame: 0, visible: true };
    const loop = () => {
      animation.frame = requestAnimationFrame(loop);
      if (!animation.visible) return;
      const t = clock.getElapsedTime();
      if (!still) {
        uniforms.uTime.value = t;
        body.rotation.y = t * (look.mode === LUMPY ? 0.35 : 0.18);
        if (look.mode === LUMPY) body.rotation.x = t * 0.11;
      }
      renderer.render(scene, camera);
    };
    loop();

    const resize = new ResizeObserver(() => {
      if (!host.clientWidth || !host.clientHeight) return;
      renderer.setSize(host.clientWidth, host.clientHeight);
      camera.aspect = host.clientWidth / host.clientHeight;
      camera.updateProjectionMatrix();
    });
    resize.observe(host);
    const seen = new IntersectionObserver(([entry]) => {
      animation.visible = entry.isIntersecting;
    });
    seen.observe(host);

    return () => {
      cancelAnimationFrame(animation.frame);
      resize.disconnect();
      seen.disconnect();
      scene.traverse((object) => {
        const mesh = object as THREE.Mesh;
        mesh.geometry?.dispose();
        (mesh.material as THREE.Material | undefined)?.dispose();
      });
      renderer.dispose();
      renderer.domElement.remove();
    };
  }, [kind, id]);

  return (
    <figure className={styles.figure}>
      <div ref={holder} className={`${styles.stage} ${className ?? ""}`} />
      {caption ? <figcaption className={styles.caption}>{captionFor(kind)}</figcaption> : null}
    </figure>
  );
}
