// props-test.js — Standbild-Seite für einzelne Figuren und Props (keine Steuerung).
// ?what=feet  → Schluffi und Turnschuh-Typ von vorn unten (Schuhe links/rechts)
// ?what=shoes → die vier Schuhe einzeln von schräg oben
// ?what=pool  → der Hotel-Pool mit Leiter, Plattform und Rutsche
// ?what=gags  → Raster aller Reveal-Gags aus data/texte.json im Endzustand (t = dauer_s)
// ?what=posen → Tätigkeits-Posen (figures.pose) an drei Kunden
// ?what=nong  → Barkeeper Nong hinter der Theke (links neutral/tagsüber, rechts müde/abends), t über ?t=
// ?what=huette → Finale-Hütte in allen Zuständen + Wegweiser normal/„Jetzt stimmt es.“
// ?what=neue  → die neuen Kunden (Fischhändler, lauter Typ, Kreuzfahrt-Tante, Fragesteller) mit kundenExtras()
// ?what=neue2 → Bauer Nok, Kletterer Dao, Frau Trillerpfeife (Zivi), Flitterwochen-Paar
// ?what=bauch → Schluffi von vorn und von der Seite (Bauch unterm Hemd)
import * as THREE from 'three';
import { toonMesh, textTexture } from './toon.js';
import { schluffi, runner, sandal, sneaker, pose, POSES, buildNong, updateNong, setNongMood, kundenExtras, updateKundenExtras } from './figures.js';
import { hotel, beachBar, finaleHuette, setHuette, HUETTE_ZUSTAENDE, signpost, setWegweiserText } from './props.js';
import { buildingScale } from './logic.js';
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
} else if (WHAT === 'bauch') {
  const a = schluffi(); a.position.set(-1.6, 0, 0); scene.add(a);
  const b = schluffi(); b.position.set(1.6, 0, 0); b.rotation.y = Math.PI / 2; scene.add(b);
  camera.position.set(0, 1.9, 5.6);
  camera.lookAt(0, 1.5, 0);
} else if (WHAT === 'shoes') {
  const items = [[sandal(0xf0b98a, 'L'), -2.4], [sandal(0xf0b98a, 'R'), -0.8], [sneaker(0xe8463a, 'L'), 0.8], [sneaker(0xe8463a, 'R'), 2.4]];
  for (const [shoe, x] of items) { shoe.position.set(x, 0, 0); shoe.scale.setScalar(1.6); scene.add(shoe); }
  camera.position.set(0, 4.2, 4.5);
  camera.lookAt(0, 0.3, 0);
} else if (WHAT === 'neue' || WHAT === 'neue2') {
  const kat = await fetch('./data/kunden.json').then((r) => r.json());
  const kunden = normalizeKatalog(kat);
  const ids = q('what') === 'neue2' ? ['bauer_nok', 'kletterer_1', 'zivi_5', 'paar_1'] : ['fischer_1', 'lauter_typ_1', 'touristin_1', 'zivi_4'];
  ids.forEach((id, i) => {
    const k = kunden.find((x) => x.id === id); if (!k) return;
    const fig = buildKunde(k, 7 + i); kundenExtras(fig, k); updateKundenExtras(fig, 1.3);
    fig.position.set((i - 1.5) * 3.6, 0, 0); fig.rotation.y = 0.15; scene.add(fig);
    const tex = textTexture(k.name, { bg: '#fff1c2', fg: '#2b1b0b', font: 'bold 44px sans-serif', w: 640, h: 96 });
    const label = new THREE.Mesh(new THREE.PlaneGeometry(3.2, 0.48), new THREE.MeshBasicMaterial({ map: tex })); label.position.set((i - 1.5) * 3.6, 4.4, 0); scene.add(label);
  });
  camera.position.set(0, 3.8, 12.5);
  camera.lookAt(0, 2.0, 0);
} else if (WHAT === 'huette') {
  HUETTE_ZUSTAENDE.forEach((z, i) => {
    const h = finaleHuette(); setHuette(h, z); h.scale.setScalar(1.5); h.position.set((i - 1.5) * 9, 0, 0); h.rotation.y = 0.2; scene.add(h);
    const tex = textTexture(z, { bg: '#fff1c2', fg: '#2b1b0b', font: 'bold 56px sans-serif', w: 384, h: 96 });
    const label = new THREE.Mesh(new THREE.PlaneGeometry(2.4, 0.6), new THREE.MeshBasicMaterial({ map: tex })); label.position.set((i - 1.5) * 9, 9.2, 0); scene.add(label);
  });
  const sp1 = signpost(); sp1.position.set(-20, 0, 6); sp1.rotation.y = -0.4; sp1.scale.setScalar(1.25); scene.add(sp1);
  const sp2 = signpost(); setWegweiserText(sp2, 2, 'POLIZEI 2km. Jetzt stimmt es.', { font: 'bold 44px sans-serif' }); sp2.position.set(20, 0, 6); sp2.rotation.y = -0.4; sp2.scale.setScalar(1.25); scene.add(sp2);
  camera.position.set(0, 13, 36);
  camera.lookAt(0, 3.4, 0);
} else if (WHAT === 'nong') {
  const t = parseFloat(q('t') || '1.1');
  const bs = buildingScale('bar');
  [['neutral', -5], ['muede', 5]].forEach(([mood, x]) => {
    const bar = beachBar(); bar.position.set(x, 0, 0); bar.scale.setScalar(bs); scene.add(bar);
    const nong = buildNong(); nong.position.set(-0.7, 0, -0.1); nong.scale.setScalar(1 / bs); bar.add(nong); // zwischen Regal (z -0.9) und Theke (z +0.9)
    setNongMood(nong, mood); updateNong(nong, t);
  });
  camera.position.set(0, 2.9, 8.5);
  camera.lookAt(0, 2.4, -0.5);
} else if (WHAT === 'posen') {
  const kat = await fetch('./data/kunden.json').then((r) => r.json());
  const kunden = normalizeKatalog(kat);
  const ids = ['rentner_1', 'backpacker_1', 'jogger_1'];
  POSES.forEach((name, i) => {
    ids.forEach((id, row) => {
      const k = kunden.find((x) => x.id === id);
      const fig = buildKunde(k, 5 + row);
      const { offsetY } = pose(fig, name);
      fig.position.set((i - (POSES.length - 1) / 2) * 3.4, offsetY, (row - 1) * 5.5);
      scene.add(fig);
    });
    const tex = textTexture(name, { bg: '#fff1c2', fg: '#2b1b0b', font: 'bold 56px sans-serif', w: 384, h: 96 });
    const label = new THREE.Mesh(new THREE.PlaneGeometry(2.4, 0.6), new THREE.MeshBasicMaterial({ map: tex }));
    label.position.set((i - (POSES.length - 1) / 2) * 3.4, 4.2, -5.5); label.rotation.x = -0.5; scene.add(label);
  });
  camera.position.set(0, 12, 19);
  camera.lookAt(0, 0.8, 0);
} else if (WHAT === 'gags') {
  const [kat, texte] = await Promise.all([fetch('./data/kunden.json').then((r) => r.json()), fetch('./data/texte.json').then((r) => r.json())]);
  const kunden = normalizeKatalog(kat);
  const byId = new Map(kunden.map((k) => [k.id, k]));
  const gags = texte.reveal_gags;
  const cols = 5, dx = 4.6, dz = 7.5, rows = Math.ceil(gags.length / cols);
  gags.forEach((g, i) => {
    const k = byId.get(g.id);
    if (!k) return;
    const fig = buildKunde(k, 3); kundenExtras(fig, k);
    const col = i % cols, row = Math.floor(i / cols);
    fig.position.set((col - (cols - 1) / 2) * dx, 0, (row - (rows - 1) / 2) * dz);
    scene.add(fig);
    // Endzustand; immer-Gags auf dem Höhepunkt
    playGag(fig, g, g.wann === 'immer' ? g.dauer_s * 0.5 : g.dauer_s);
    const tex = textTexture(`${g.id} · ${g.wann}${g.extra ? ' · ' + g.extra : ''}`, { bg: '#fff1c2', fg: '#2b1b0b', font: 'bold 44px sans-serif', w: 768, h: 72 });
    const label = new THREE.Mesh(new THREE.PlaneGeometry(3.2, 0.3), new THREE.MeshBasicMaterial({ map: tex }));
    label.position.set(fig.position.x, 4.4, fig.position.z); label.rotation.x = -0.6; scene.add(label);
  });
  camera.position.set(0, 7 + 4.2 * rows, 8 + 5.5 * rows);
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
