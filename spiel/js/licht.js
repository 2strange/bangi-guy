// licht.js — Tagesablauf in der Szene: setTageszeit(scene, t01, opts) stellt Sonnenlicht (Farbe, Stärke,
// Richtung), Hemisphärenlicht, Himmel und Nebel nach licht-palette.js ein, schaltet abends Laternen,
// Fensterscheiben und Lichterketten an (emissive) und lässt die Sonnen-Kulisse über den Himmel wandern
// (müdes Gesicht morgens/abends); nachts hängt ein schlafender Mond am Himmel.
// Einbau: einmal `const licht = initLicht(scene, { sonne: world.sonne })`, dann im Loop
// `licht.set(t01)` und `sunLight.position = spieler + licht.sunOffset(t01)`.
import * as THREE from 'three';
import { toonMesh } from './toon.js';
import { flackern } from './ereignisse-logik.js';
import { face, faceDecal, setFace } from './faces.js';
import { tageszeitPalette, sunOffset, sonnenPosition, sonnenStimmung, nachtAnteil } from './licht-palette.js';

export { tageszeitPalette, sunOffset, sonnenPosition, sonnenStimmung, nachtAnteil } from './licht-palette.js';

const WARM = new THREE.Color(0xffd27a);

// Nachtlichter einsammeln: Laternenköpfe (Kugel r 0.38, Farbe 0xfff1c2), Fensterscheiben (hellblaue Boxen),
// und alles, was per userData.nachtlicht = { color?, staerke? } markiert ist. Jedes bekommt eine eigene
// Materialkopie (Toon-Materialien sind sonst pro Farbe geteilt).
function istLaternenkopf(m) { return m.geometry.type === 'SphereGeometry' && Math.abs(m.geometry.parameters.radius - 0.38) < 1e-6 && m.material.color?.getHex() === 0xfff1c2; }
function istFenster(m) {
  if (m.geometry.type !== 'BoxGeometry') return false;
  const p = m.geometry.parameters, hex = m.material.color?.getHex();
  return hex === 0x7fd8ff && Math.abs(p.depth - 0.16) < 1e-6 && p.width >= 0.5 && p.width <= 1.0;
}
export function registriereNachtlichter(root) {
  const lights = [];
  root.traverse((m) => {
    if (!m.isMesh || Array.isArray(m.material) || m.userData.nachtlichtMat) return;
    let spec = m.userData.nachtlicht;
    if (!spec && istLaternenkopf(m)) spec = { color: 0xffd27a, staerke: 1.0 };
    if (!spec && istFenster(m)) spec = { color: 0xffc85a, staerke: 0.9, tag: 0x7fd8ff };
    if (!spec) return;
    const mat = m.material.clone();
    mat.emissive = new THREE.Color(spec.color ?? 0xffd27a);
    mat.emissiveIntensity = 0;
    m.material = mat;
    m.userData.nachtlichtMat = { mat, staerke: spec.staerke ?? 1, tag: spec.tag ?? mat.color.getHex(), nacht: spec.nachtFarbe ?? null };
    lights.push(m);
  });
  return lights;
}

// Halo-Textur für Birnchen: weicher radialer Verlauf (einmal gebaut, von allen Sprites geteilt)
let haloTex = null;
function haloTexture() {
  if (haloTex) return haloTex;
  const c = document.createElement('canvas'); c.width = 128; c.height = 128;
  const ctx = c.getContext('2d');
  const g = ctx.createRadialGradient(64, 64, 4, 64, 64, 62);
  g.addColorStop(0, 'rgba(255,255,255,1)'); g.addColorStop(0.35, 'rgba(255,255,255,0.55)'); g.addColorStop(1, 'rgba(255,255,255,0)');
  ctx.fillStyle = g; ctx.fillRect(0, 0, 128, 128);
  haloTex = new THREE.CanvasTexture(c);
  return haloTex;
}

// Lichterkette: Girlande zwischen Punkten (Weltkoordinaten), Birnchen bunt, abends größer und mit glühendem
// Sprite-Halo (additiv, Deckkraft und Größe hängen an `lights` aus der Palette)
export function lichterkette(points, { colors = [0xffd54a, 0xe8463a, 0x3dd6e0, 0xff5fa2, 0x3bb84a], abstand = 0.55, sag = 0.35 } = {}) {
  const g = new THREE.Group();
  let n = 0;
  for (let i = 1; i < points.length; i++) {
    const a = points[i - 1], b = points[i];
    const mid = new THREE.Vector3().addVectors(a, b).multiplyScalar(0.5); mid.y -= sag * 2;
    const curve = new THREE.QuadraticBezierCurve3(a, mid, b);
    g.add(toonMesh(new THREE.TubeGeometry(curve, 12, 0.025, 5, false), 0x222222, { outline: 0.012, shadow: false }));
    const len = curve.getLength(), k = Math.max(1, Math.round(len / abstand));
    for (let j = 1; j < k; j++) {
      const p = curve.getPointAt(j / k);
      const col = colors[n % colors.length];
      const bulb = toonMesh(new THREE.SphereGeometry(0.11, 8, 6), col, { outline: 0.025, shadow: false });
      bulb.position.copy(p); bulb.position.y -= 0.12;
      bulb.userData.nachtlicht = { color: col, staerke: 1.4, glow: true };
      const halo = new THREE.Sprite(new THREE.SpriteMaterial({ map: haloTexture(), color: col, transparent: true, opacity: 0, blending: THREE.AdditiveBlending, depthWrite: false }));
      halo.scale.setScalar(0.5); halo.position.set(0, 0, 0); halo.userData.noFade = true;
      bulb.add(halo); bulb.userData.halo = halo;
      g.add(bulb); n++;
    }
  }
  return g;
}

// Kerzen (für den Stromausfall): Wachsstummel mit Flamme + warmem Halo an den gegebenen Weltpunkten
export function kerzen(points) {
  const g = new THREE.Group();
  const flames = [];
  points.forEach((p, i) => {
    const k = new THREE.Group(); k.position.copy(p);
    const wax = toonMesh(new THREE.CylinderGeometry(0.07, 0.08, 0.28 + (i % 3) * 0.08, 8), 0xfff5e0, { outline: 0.02 }); wax.position.y = 0.14; k.add(wax);
    const flame = toonMesh(new THREE.SphereGeometry(0.06, 7, 6), 0xffb13b, { outline: 0, basic: true }); flame.geometry.scale(0.8, 1.6, 0.8); flame.position.y = 0.36 + (i % 3) * 0.08; k.add(flame);
    const halo = new THREE.Sprite(new THREE.SpriteMaterial({ map: haloTexture(), color: 0xffb36b, transparent: true, opacity: 0.6, blending: THREE.AdditiveBlending, depthWrite: false }));
    halo.scale.setScalar(1.4); halo.position.copy(flame.position); k.add(halo);
    const light = new THREE.PointLight(0xffb36b, 0.9, 7, 2); light.position.copy(flame.position); k.add(light);
    flames.push({ flame, halo, light, i });
    g.add(k);
  });
  g.visible = false; g.userData.flames = flames; g.userData.noFade = true;
  return g;
}

// Mond: blasse Scheibe mit schlafendem Gesicht, nachts sichtbar
export function mond() {
  const g = new THREE.Group();
  const m = toonMesh(new THREE.SphereGeometry(1.6, 20, 14), 0xe6e6f2, { outline: 0.1, shadow: false, basic: true });
  g.add(m);
  g.add(faceDecal(face('kunde', 'schlaeft', { skin: '#e6e6f2', seed: 5 }), 1.62, null, { basic: true }));
  for (const [x, y, z, r] of [[-0.6, 0.5, 1.3, 0.25], [0.7, -0.3, 1.4, 0.18], [0.2, 0.9, 1.2, 0.14]]) {
    const crater = toonMesh(new THREE.SphereGeometry(r, 8, 6), 0xc9c9dc, { outline: 0.03, shadow: false, basic: true });
    crater.geometry.scale(1, 1, 0.3); crater.position.set(x, y, z); g.add(crater);
  }
  const cap = toonMesh(new THREE.ConeGeometry(0.9, 1.3, 10), 0x3a7bd5, { outline: 0.06, shadow: false, basic: true }); // Schlafmütze
  cap.position.set(0.4, 1.7, 0); cap.rotation.z = -0.5; g.add(cap);
  const pom = toonMesh(new THREE.SphereGeometry(0.22, 8, 6), 0xffffff, { outline: 0.03, shadow: false, basic: true }); pom.position.set(1.1, 2.1, 0); g.add(pom);
  g.userData.noFade = true;
  return g;
}

/**
 * Einmal aufrufen: findet Sonnen- und Hemisphärenlicht in der Szene, sammelt Nachtlichter, hängt den Mond ein.
 * opts.sonne = Sonnen-Kulisse aus props.sun() (wandert dann über den Himmel, Gesicht wird müde).
 * Rückgabe { set(t01), sunOffset(t01), register(root), palette(t01) }.
 */
export function initLicht(scene, { sonne = null, mondObj = null, kerzen: kerzenG = null } = {}) {
  let sun = null, hemi = null;
  scene.traverse((o) => { if (o.isDirectionalLight && !sun) sun = o; if (o.isHemisphereLight && !hemi) hemi = o; });
  const lights = registriereNachtlichter(scene);
  const moon = mondObj ?? mond();
  moon.scale.setScalar(4); moon.visible = false; scene.add(moon);
  const sunFace = sonne ? sonne.getObjectByName('face') : null;
  let lastMood = null;
  const fogBase = scene.fog ? { near: scene.fog.near, far: scene.fog.far } : null;
  const state = { t: 0.5, ausfall: false };
  if (kerzenG) scene.add(kerzenG);

  function set(t01) {
    const p = tageszeitPalette(t01);
    state.t = t01;
    if (scene.background?.isColor) scene.background.setHex(p.sky); else scene.background = new THREE.Color(p.sky);
    if (scene.fog) { scene.fog.color.setHex(p.fog); if (fogBase) { scene.fog.near = fogBase.near * (1 - 0.3 * p.nacht); scene.fog.far = fogBase.far * (1 - 0.25 * p.nacht); } }
    if (sun) { sun.color.setHex(p.sun); sun.intensity = p.sunI; }
    if (hemi) { hemi.color.setHex(p.hemiSky); hemi.groundColor.setHex(p.hemiGround); hemi.intensity = p.hemiI; }
    const strom = state.ausfall ? 0 : 1; // Stromausfall: alle Nachtlichter aus, Kerzen an
    for (const m of lights) {
      const L = m.userData.nachtlichtMat;
      L.mat.emissiveIntensity = p.lights * L.staerke * strom;
      if (L.tag !== undefined) L.mat.color.setHex(p.lights * strom > 0.5 ? L.mat.emissive.getHex() : L.tag);
      if (m.userData.halo) { // Birnchen: abends doppelt so groß, Halo glüht (Sprite-Skala in Welteinheiten, Elternskala herausgerechnet)
        const k = 1 + p.lights;
        m.scale.setScalar(k);
        m.userData.halo.material.opacity = 0.55 * p.lights * strom;
        m.userData.halo.scale.setScalar((0.5 + 0.5 * p.lights) / k);
      }
    }
    if (sonne) {
      const sp = sonnenPosition(t01);
      sonne.position.set(sp.x, sp.y, sp.z); sonne.visible = sp.sichtbar;
      const mood = sonnenStimmung(t01);
      if (sunFace && mood !== lastMood) { setFace(sunFace, face('sun', mood)); lastMood = mood; }
    }
    if (kerzenG) {
      kerzenG.visible = state.ausfall;
      if (state.ausfall) { const now = performance.now() / 1000; for (const f of kerzenG.userData.flames) { const k = flackern(now, f.i); f.flame.scale.set(0.8 * k, 1.6 * k, 0.8 * k); f.halo.material.opacity = 0.6 * k; f.light.intensity = 0.9 * k; } }
    }
    const na = nachtAnteil(t01);
    moon.visible = na > 0.2;
    moon.position.set(-120 + 60 * na, 40 + 25 * na, -180);
    return p;
  }
  // Stromausfall an/aus: Laternen, Fenster, Lichterkette aus, Kerzen an (wirkt beim nächsten set(t01))
  const stromausfall = (an) => { state.ausfall = !!an; set(state.t); };
  return { set, sunOffset, palette: tageszeitPalette, register: (root) => { lights.push(...registriereNachtlichter(root)); }, moon, state, stromausfall, kerzen: kerzenG };
}
