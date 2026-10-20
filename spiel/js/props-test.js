// props-test.js — Standbild-Seite für einzelne Figuren und Props (keine Steuerung).
// ?what=feet  → Schluffi und Turnschuh-Typ von vorn unten (Schuhe links/rechts)
// ?what=shoes → die vier Schuhe einzeln von schräg oben
// ?what=pool  → der Hotel-Pool mit Leiter, Plattform und Rutsche
// ?what=gags  → Raster aller Reveal-Gags aus data/texte.json im Endzustand (t = dauer_s)
import * as THREE from 'three';
import { toonMesh, textTexture } from './toon.js';
import { schluffi, runner, sandal, sneaker } from './figures.js';
import { hotel } from './props.js';
import { buildKunde } from './kunden.js';
import { normalizeKatalog } from './game.js';
import { playGag } from './gags.js';

const q = (name) => (location.search.match(new RegExp('[?&]' + name + '=([-a-z0-9.]+)')) || [])[1];
const WHAT = q('what') || 'feet';

const renderer = new THREE.WebGLRenderer({ antialias: true, preserveDrawingBuffer: true });
renderer.setPixelRatio(1);
renderer.shadowMap.enabled = true;
renderer.shadowMap.type = THREE.PCFShadowMap;
document.body.appendChild(renderer.domElement);
const scene = new THREE.Scene();
scene.background = new THREE.Color(0x8fe0ff);
const camera = new THREE.PerspectiveCamera(40, 1.6, 0.1, 200);

const sunLight = new THREE.DirectionalLight(0xfff4d6, 1.9);
sunLight.castShadow = true;
sunLight.shadow.mapSize.set(2048, 2048);
const sc = sunLight.shadow.camera;
sc.left = -20; sc.right = 20; sc.top = 20; sc.bottom = -20; sc.near = 1; sc.far = 80;
sunLight.shadow.bias = -0.0006;
sunLight.shadow.normalBias = 0.03;
sunLight.position.set(8, 20, 10);
scene.add(sunLight, sunLight.target);
scene.add(new THREE.HemisphereLight(0xcfeeff, 0xd9b27a, 0.75));

const sand = toonMesh(new THREE.PlaneGeometry(200, 200), 0xf7d984, { outline: 0, shadow: false });
sand.rotation.x = -Math.PI / 2; sand.receiveShadow = true; scene.add(sand);

if (WHAT === 'feet') {
  const a = schluffi(); a.position.set(-1.7, 0, 0); scene.add(a);
  const b = runner(); b.position.set(1.7, 0, 0); scene.add(b);
  camera.position.set(0, 1.6, 5.2);
  camera.lookAt(0, 0.6, 0);
} else if (WHAT === 'shoes') {
  const items = [[sandal(0xf0b98a, 'L'), -2.4], [sandal(0xf0b98a, 'R'), -0.8], [sneaker(0xe8463a, 'L'), 0.8], [sneaker(0xe8463a, 'R'), 2.4]];
  for (const [shoe, x] of items) { shoe.position.set(x, 0, 0); shoe.scale.setScalar(1.6); scene.add(shoe); }
  camera.position.set(0, 4.2, 4.5);
  camera.lookAt(0, 0.3, 0);
} else if (WHAT === 'gags') {
  const [kat, texte] = await Promise.all([fetch('./data/kunden.json').then((r) => r.json()), fetch('./data/texte.json').then((r) => r.json())]);
  const kunden = normalizeKatalog(kat);
  const byId = new Map(kunden.map((k) => [k.id, k]));
  const gags = texte.reveal_gags;
  const cols = 5, dx = 4.6, dz = 7.5;
  gags.forEach((g, i) => {
    const k = byId.get(g.id);
    if (!k) return;
    const fig = buildKunde(k, 3);
    const col = i % cols, row = Math.floor(i / cols);
    fig.position.set((col - (cols - 1) / 2) * dx, 0, (row - 1) * dz);
    scene.add(fig);
    // Endzustand; immer-Gags auf dem Höhepunkt
    playGag(fig, g, g.wann === 'immer' ? g.dauer_s * 0.5 : g.dauer_s);
    const tex = textTexture(`${g.id} · ${g.wann}${g.extra ? ' · ' + g.extra : ''}`, { bg: '#fff1c2', fg: '#2b1b0b', font: 'bold 44px sans-serif', w: 768, h: 72 });
    const label = new THREE.Mesh(new THREE.PlaneGeometry(3.2, 0.3), new THREE.MeshBasicMaterial({ map: tex }));
    label.position.set(fig.position.x, 4.4, fig.position.z); label.rotation.x = -0.6; scene.add(label);
  });
  camera.position.set(0, 15, 19);
  camera.lookAt(0, 0.5, 0.5);
} else {
  const h = hotel();
  const pool = h.userData.pool;
  h.remove(pool);
  pool.position.set(0, 0, 0);
  pool.scale.setScalar(1.2);
  scene.add(pool);
  camera.position.set(13, 8, 13);
  camera.lookAt(3, 0.8, 0.5);
}

function shoot() {
  renderer.setSize(window.innerWidth, window.innerHeight, true);
  camera.aspect = window.innerWidth / window.innerHeight;
  camera.updateProjectionMatrix();
  renderer.render(scene, camera);
  requestAnimationFrame(() => renderer.render(scene, camera));
}
if (document.readyState === 'complete') shoot(); else window.addEventListener('load', shoot);
window.addEventListener('resize', shoot);
