// ereignis-test.js — Ereignis-Requisiten im Raster: Möwe mit Beutel über der Bar, Regenwolke über dem Strand,
// Kreuzfahrtschiff am Horizont, Party am Posten 7; ?nacht=1 zeigt die dunkle Bar mit Kerzen (Stromausfall).
import * as THREE from 'three';
import { toonMesh } from './toon.js';
import { beachBar, lamp, palm, hut } from './props.js';
import { schluffi } from './figures.js';
import { initLicht, lichterkette, kerzen } from './licht.js';
import { moeweMitBeutel, regenwolke, kreuzfahrtschiff } from './ereignisse.js';
import { buildMarkt } from './zone-markt.js';
import { BUILDING_POS, buildingScale } from './logic.js';

const q = (name) => (location.search.match(new RegExp('[?&]' + name + '=([-a-z0-9.]+)')) || [])[1];
const NACHT = q('nacht') === '1';
const T = parseFloat(q('t') || '2');

const renderer = new THREE.WebGLRenderer({ antialias: true, preserveDrawingBuffer: true });
renderer.setPixelRatio(1);
renderer.shadowMap.enabled = true;
document.body.appendChild(renderer.domElement);
const scene = new THREE.Scene();
scene.background = new THREE.Color(0x8fe0ff);
scene.fog = new THREE.Fog(0x9fe6ff, 70, 330);
const camera = new THREE.PerspectiveCamera(44, 1.6, 0.5, 600);
const sunLight = new THREE.DirectionalLight(0xfff4d6, 1.9);
sunLight.castShadow = true; sunLight.shadow.mapSize.set(2048, 2048);
const sc = sunLight.shadow.camera; sc.left = -40; sc.right = 40; sc.top = 40; sc.bottom = -40; sc.near = 1; sc.far = 140;
sunLight.shadow.bias = -0.0006; sunLight.shadow.normalBias = 0.03;
scene.add(sunLight, sunLight.target);
scene.add(new THREE.HemisphereLight(0xcfeeff, 0xd9b27a, 0.75));
const V = (x, y, z) => new THREE.Vector3(x, y, z);

const sand = toonMesh(new THREE.PlaneGeometry(600, 600), 0xf7d984, { outline: 0, shadow: false }); sand.rotation.x = -Math.PI / 2; sand.receiveShadow = true; scene.add(sand);
const sea = toonMesh(new THREE.PlaneGeometry(600, 300), 0x1d9be6, { outline: 0, shadow: false }); sea.rotation.x = -Math.PI / 2; sea.position.set(0, 0.06, 162); scene.add(sea);
const grass = toonMesh(new THREE.PlaneGeometry(600, 200), 0x5fc74a, { outline: 0, shadow: false }); grass.rotation.x = -Math.PI / 2; grass.position.set(0, 0.02, -112); grass.receiveShadow = true; scene.add(grass);

const bx = BUILDING_POS.bar.x, bz = BUILDING_POS.bar.z, bs = buildingScale('bar');
const bar = beachBar(); bar.position.set(bx, 0, bz); bar.scale.setScalar(bs); scene.add(bar);
scene.add(lichterkette([V(bx - 2.5 * bs, 3.2 * bs, bz - 1.3 * bs), V(bx - 2.5 * bs, 3.2 * bs, bz + 1.3 * bs), V(bx + 2.5 * bs, 3.2 * bs, bz + 1.3 * bs), V(bx + 2.5 * bs, 3.2 * bs, bz - 1.3 * bs), V(bx - 2.5 * bs, 3.2 * bs, bz - 1.3 * bs)]));
for (const x of [-42, -14]) { const l = lamp(); l.position.set(x, 0, -12.6); l.scale.setScalar(1.4); scene.add(l); }
for (const [x, z, l, s] of [[-40, 2, [1.1, 0, 0.5], 4], [-16, 4, [-0.8, 0, 0.7], 5]]) { const p = palm({ lean: V(...l), seed: s }); p.position.set(x, 0, z); p.scale.setScalar(1.4); scene.add(p); }
const player = schluffi(); player.position.set(-24, 0, 1); player.rotation.y = 2.6; scene.add(player);
const colliders = [];
const markt = buildMarkt(scene, colliders, { exits: { pier: false, stadt: false } });

const moewe = moeweMitBeutel(); scene.add(moewe);
const wolke = regenwolke(); scene.add(wolke);
const schiff = kreuzfahrtschiff(); scene.add(schiff);
const licht = initLicht(scene, { kerzen: kerzen([V(bx - 1.2 * bs, 1.2 * bs, bz + 0.9 * bs), V(bx + 0.3 * bs, 1.2 * bs, bz + 0.9 * bs), V(bx + 1.6 * bs, 1.2 * bs, bz + 0.9 * bs)]) });

moewe.userData.start({ x: -24, z: 1 }, { x: 0.4, z: 1 });
wolke.userData.start(); schiff.userData.start(); markt.party(true);
// Zeitpunkte: Möwe t, Wolke mitten über dem Strand, Schiff mittig am Horizont
moewe.userData.update(0); moewe.userData.update(T);
wolke.userData.update(0); wolke.userData.update(22);
schiff.userData.update(0); schiff.userData.update(120);
markt.update(T);

const panels = NACHT
  ? [{ t01: 0.95, pos: V(bx + 2, 7, bz + 16), look: V(bx, 2.2, bz), ausfall: true }]
  : [
    { t01: 0.5, pos: V(-24, 6, 14), look: V(-24, 6, -4) },               // Möwe mit Beutel
    { t01: 0.5, pos: V(0, 10, 30), look: V(0, 8, -10) },                 // Regenwolke
    { t01: 0.5, pos: V(10, 6, 60), look: V(10, 6, 150) },                 // Kreuzfahrtschiff
    { t01: 0.5, pos: V(14, 11, -66), look: V(4, 2, -84) },                // Party am Posten
  ];

function render() {
  const W = window.innerWidth, H = window.innerHeight;
  renderer.setSize(W, H, true); renderer.setScissorTest(true);
  const cols = NACHT ? 1 : 2, rows = NACHT ? 1 : 2, pw = Math.floor(W / cols), ph = Math.floor(H / rows);
  panels.forEach((p, i) => {
    licht.stromausfall(!!p.ausfall); licht.set(p.t01);
    const o = licht.sunOffset(p.t01); sunLight.position.set(p.look.x + o.x, o.y, p.look.z + o.z); sunLight.target.position.set(p.look.x, 0, p.look.z); sunLight.target.updateMatrixWorld();
    camera.aspect = pw / ph; camera.updateProjectionMatrix(); camera.position.copy(p.pos); camera.lookAt(p.look);
    const cx = (i % cols) * pw, cy = H - ph - Math.floor(i / cols) * ph;
    renderer.setViewport(cx, cy, pw, ph); renderer.setScissor(cx, cy, pw, ph); renderer.render(scene, camera);
  });
  renderer.setScissorTest(false);
}
const shoot = () => { render(); requestAnimationFrame(render); };
if (document.readyState === 'complete') shoot(); else window.addEventListener('load', shoot);
window.addEventListener('resize', shoot);
