// toon.js — Material- und Kontur-Helfer für den Bangi-Cartoon-Look.
// Toon-Stufen: MeshToonMaterial + 1-D gradientMap (NearestFilter) → harte Stufen.
// Konturen: Inverted Hull — Kopie der Geometrie, entlang (geglätteter) Normalen aufgeblasen,
// schwarz, BackSide. Normalen werden vorher geglättet (mergeVertices), sonst reißen
// die Hüllen an harten Kanten (Boxen) auf.
import * as THREE from 'three';
import { mergeVertices } from 'three/addons/utils/BufferGeometryUtils.js';

// 4 Texel: Schattenseite, Schattenseite, Übergangsband, Licht → 3 sichtbare Stufen
const STEPS = new Uint8Array([70, 70, 150, 255]);
export const gradientMap = new THREE.DataTexture(STEPS, STEPS.length, 1, THREE.RedFormat);
gradientMap.minFilter = THREE.NearestFilter;
gradientMap.magFilter = THREE.NearestFilter;
gradientMap.generateMipmaps = false;
gradientMap.needsUpdate = true;

export const BLACK = 0x111111;

export function toon(color, extra = {}) {
  return new THREE.MeshToonMaterial({ color, gradientMap, ...extra });
}

const outlineMats = new Map();
export function outlineMaterial(thickness) {
  const key = thickness.toFixed(4);
  if (!outlineMats.has(key)) {
    outlineMats.set(key, new THREE.ShaderMaterial({
      uniforms: { thickness: { value: thickness } },
      vertexShader: `
        uniform float thickness;
        void main() {
          vec3 p = position + normalize(normal) * thickness;
          gl_Position = projectionMatrix * modelViewMatrix * vec4(p, 1.0);
        }`,
      fragmentShader: `void main() { gl_FragColor = vec4(0.04, 0.03, 0.05, 1.0); }`,
      side: THREE.BackSide,
    }));
  }
  return outlineMats.get(key);
}

// Geometrie-Kopie mit geglätteten Normalen (für die Hülle)
export function outlineGeometry(geometry) {
  let g = geometry.clone();
  g.deleteAttribute('normal');
  g.deleteAttribute('uv');
  g.clearGroups();
  g = mergeVertices(g, 1e-4);
  g.computeVertexNormals();
  return g;
}

/**
 * Mesh mit Toon-Material + Kontur-Hülle als Kind.
 * color: Hex, Material oder Material-Array.
 * opts: outline (Dicke in Welt-Einheiten, 0 = keine), shadow, map, basic (unbeleuchtet)
 */
export function toonMesh(geometry, color, opts = {}) {
  const { outline = 0.045, shadow = true, map = null, basic = false } = opts;
  let mat;
  if (color instanceof THREE.Material || Array.isArray(color)) mat = color;
  else mat = basic ? new THREE.MeshBasicMaterial({ color, map }) : toon(color, map ? { map } : {});
  const m = new THREE.Mesh(geometry, mat);
  m.castShadow = shadow;
  m.receiveShadow = shadow;
  if (outline > 0) {
    const o = new THREE.Mesh(outlineGeometry(geometry), outlineMaterial(outline));
    o.castShadow = false;
    o.receiveShadow = false;
    o.name = 'outline';
    m.add(o);
  }
  return m;
}

// Transform in die Geometrie backen (Meshes bleiben scale=1, sonst wird die Hülle ungleichmäßig)
export function bake(geometry, { scale, rotate, translate } = {}) {
  if (scale) geometry.scale(scale[0], scale[1], scale[2]);
  if (rotate) geometry.rotateX(rotate[0]), geometry.rotateY(rotate[1]), geometry.rotateZ(rotate[2]);
  if (translate) geometry.translate(translate[0], translate[1], translate[2]);
  return geometry;
}

// Vertex-weise verformen: fn(v: Vector3) mutiert v
export function deform(geometry, fn) {
  const pos = geometry.attributes.position;
  const v = new THREE.Vector3();
  for (let i = 0; i < pos.count; i++) {
    v.fromBufferAttribute(pos, i);
    fn(v, i);
    pos.setXYZ(i, v.x, v.y, v.z);
  }
  pos.needsUpdate = true;
  geometry.computeVertexNormals();
  geometry.computeBoundingSphere();
  return geometry;
}

// Deterministischer Zufall, damit das Standbild reproduzierbar bleibt
export function rng(seed = 1) {
  let s = seed >>> 0;
  return () => {
    s = (s + 0x6d2b79f5) >>> 0;
    let t = s;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

// Canvas-Text als Textur (keine Fremd-Assets, nur Canvas-2D)
export function textTexture(text, { bg = '#f3e2b3', fg = '#1a1a1a', w = 512, h = 128, font = 'bold 88px sans-serif' } = {}) {
  const c = document.createElement('canvas');
  c.width = w; c.height = h;
  const ctx = c.getContext('2d');
  ctx.fillStyle = bg; ctx.fillRect(0, 0, w, h);
  ctx.fillStyle = fg; ctx.font = font;
  ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
  ctx.fillText(text, w / 2, h / 2 + 4);
  const tex = new THREE.CanvasTexture(c);
  tex.colorSpace = THREE.SRGBColorSpace;
  tex.minFilter = THREE.LinearFilter;
  return tex;
}

// Streifen-Textur (Sonnenschirm, Wasserball, Handtuch)
export function stripeTexture(colors, { w = 512, h = 64, vertical = true } = {}) {
  const c = document.createElement('canvas');
  c.width = w; c.height = h;
  const ctx = c.getContext('2d');
  const n = colors.length;
  for (let i = 0; i < n; i++) {
    ctx.fillStyle = colors[i];
    if (vertical) ctx.fillRect((w / n) * i, 0, w / n + 1, h);
    else ctx.fillRect(0, (h / n) * i, w, h / n + 1);
  }
  const tex = new THREE.CanvasTexture(c);
  tex.colorSpace = THREE.SRGBColorSpace;
  tex.magFilter = THREE.NearestFilter;
  tex.minFilter = THREE.NearestFilter;
  return tex;
}
