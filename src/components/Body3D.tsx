import { useEffect, useRef } from "react";
import * as THREE from "three";
import type { Kind } from "../lib/stellar.ts";
import styles from "./Body3D.module.css";

interface Look {
  bright: string;
  dark: string;
  glow: string;
  banded: number;
  spots: number;
  granulation: number;
  scale: number;
}

const LOOKS: Record<Kind, Look> = {
  O: { bright: "#dfe8ff", dark: "#8fa8ff", glow: "#9bb0ff", banded: 0, spots: 0, granulation: 0.25, scale: 1 },
  B: { bright: "#e4ecff", dark: "#9db4ff", glow: "#aabfff", banded: 0, spots: 0, granulation: 0.25, scale: 1 },
  A: { bright: "#f3f6ff", dark: "#b9c9ff", glow: "#cad7ff", banded: 0, spots: 0, granulation: 0.3, scale: 1 },
  F: { bright: "#fffdf4", dark: "#e6dcc0", glow: "#f8f7ff", banded: 0, spots: 0.1, granulation: 0.45, scale: 1 },
  G: { bright: "#fff3c4", dark: "#e09a2c", glow: "#ffd27a", banded: 0, spots: 0.2, granulation: 0.7, scale: 1 },
  K: { bright: "#ffd08a", dark: "#c0581c", glow: "#ffad5c", banded: 0, spots: 0.35, granulation: 0.75, scale: 0.92 },
  M: { bright: "#ff9a5c", dark: "#7a1c0c", glow: "#ff6a3a", banded: 0, spots: 0.6, granulation: 0.85, scale: 0.85 },
  L: { bright: "#c8603a", dark: "#4a1608", glow: "#b0402a", banded: 1, spots: 0, granulation: 0, scale: 0.8 },
  T: { bright: "#c46ad8", dark: "#2c1452", glow: "#9a4dff", banded: 1, spots: 0, granulation: 0, scale: 0.8 },
  Y: { bright: "#7a5ad0", dark: "#160c30", glow: "#6a4cff", banded: 1, spots: 0, granulation: 0, scale: 0.78 },
  WD: { bright: "#f4f8ff", dark: "#c9d8ff", glow: "#dde8ff", banded: 0, spots: 0, granulation: 0.1, scale: 0.6 },
  "?": { bright: "#d0d6de", dark: "#5a6270", glow: "#9aa4b2", banded: 0, spots: 0.2, granulation: 0.5, scale: 0.85 },
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
varying vec3 vPosition;
varying vec3 vNormal;
varying vec3 vView;
void main(){
  vPosition=position;
  vNormal=normalize(normalMatrix*normal);
  vec4 world=modelViewMatrix*vec4(position,1.0);
  vView=normalize(-world.xyz);
  gl_Position=projectionMatrix*world;
}`;

const SURFACE_FRAGMENT = `
uniform float uTime;uniform float uSeed;uniform vec3 uBright;uniform vec3 uDark;
uniform float uBanded;uniform float uSpots;uniform float uGranulation;
varying vec3 vPosition;varying vec3 vNormal;varying vec3 vView;
${NOISE}
void main(){
  vec3 p=normalize(vPosition)+uSeed;
  float limb=max(dot(normalize(vNormal),normalize(vView)),0.0);
  vec3 colour;
  if(uBanded>0.5){
    float turbulence=fbm(p*vec3(2.0,6.0,2.0)+vec3(uTime*0.03,0.0,0.0));
    float bands=sin((normalize(vPosition).y+turbulence*0.18)*18.0+uSeed*3.0)*0.5+0.5;
    float storms=smoothstep(0.55,0.8,fbm(p*4.0+uTime*0.02));
    colour=mix(uDark,uBright,bands*0.75+0.15);
    colour=mix(colour,uBright*1.15,storms*0.35);
    colour*=0.35+0.75*pow(limb,0.7);
  } else {
    float cells=fbm(p*9.0+vec3(0.0,0.0,uTime*0.05));
    float spots=smoothstep(0.35,0.6,fbm(p*2.2+uSeed));
    colour=mix(uBright,uDark,clamp(0.5-cells*uGranulation,0.0,1.0)*0.55);
    colour=mix(colour,uDark*0.55,spots*uSpots);
    colour*=0.45+0.7*pow(limb,0.45);
    colour+=uBright*0.12;
  }
  gl_FragColor=vec4(colour,1.0);
}`;

const GLOW_FRAGMENT = `
uniform vec3 uGlow;uniform float uStrength;varying vec3 vNormal;varying vec3 vView;
void main(){
  float halo=pow(max(-dot(normalize(vNormal),vec3(0.0,0.0,1.0)),0.0),2.2);
  gl_FragColor=vec4(uGlow,clamp(halo*uStrength,0.0,1.0));
}`;

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
  kind: Kind;
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
      uBanded: { value: look.banded },
      uSpots: { value: look.spots },
      uGranulation: { value: look.granulation },
    };
    const body = new THREE.Mesh(
      new THREE.SphereGeometry(look.scale, 96, 64),
      new THREE.ShaderMaterial({ uniforms, vertexShader: SURFACE_VERTEX, fragmentShader: SURFACE_FRAGMENT }),
    );
    body.rotation.z = look.banded ? 0.38 : 0.12;
    scene.add(body);

    const glow = new THREE.Mesh(
      new THREE.SphereGeometry(look.scale * (look.banded ? 1.12 : 1.38), 64, 32),
      new THREE.ShaderMaterial({
        uniforms: { uGlow: { value: new THREE.Color(look.glow) }, uStrength: { value: look.banded ? 0.7 : 1.4 } },
        vertexShader: SURFACE_VERTEX,
        fragmentShader: GLOW_FRAGMENT,
        transparent: true,
        blending: THREE.AdditiveBlending,
        side: THREE.BackSide,
        depthWrite: false,
      }),
    );
    scene.add(glow);

    const still = window.matchMedia?.("(prefers-reduced-motion: reduce)").matches === true;
    const clock = new THREE.Clock();
    const animation = { frame: 0, visible: true };
    const loop = () => {
      animation.frame = requestAnimationFrame(loop);
      if (!animation.visible) return;
      const t = clock.getElapsedTime();
      if (!still) {
        uniforms.uTime.value = t;
        body.rotation.y = t * 0.18;
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
      body.geometry.dispose();
      (body.material as THREE.Material).dispose();
      glow.geometry.dispose();
      (glow.material as THREE.Material).dispose();
      renderer.dispose();
      renderer.domElement.remove();
    };
  }, [kind, id]);

  return (
    <figure className={styles.figure}>
      <div ref={holder} className={`${styles.stage} ${className ?? ""}`} />
      {caption ? <figcaption className={styles.caption}>Artist’s impression from the spectral type · not an image</figcaption> : null}
    </figure>
  );
}
