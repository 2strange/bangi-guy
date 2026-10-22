// galerie.js — alle Figuren des Spiels zum Durchklicken: Kundschaft, Spieler, Mentor, Nong, Pong, Mister Coconut,
// Szenen-Figuren, Statisten. Pfeile/Liste zum Blättern, OrbitControls zum Drehen und Zoomen, heller Hintergrund.
// ?figur=<id> springt direkt zu einer Figur, ?t= setzt die Animationszeit fürs Standbild.
import * as THREE from 'three';
import { OrbitControls } from 'three/addons/controls/OrbitControls.js';
import { toonMesh } from './toon.js';
import { schluffi, runner, buildNong, updateNong, setNongMood, buildKokosVerkaeufer, kundenExtras, updateKundenExtras, SCHLUFFI_KOEPFE } from './figures.js';
import { buildKunde } from './kunden.js';
import { normalizeKatalog } from './game.js';
import { mentor, scarecrow } from './zone-huegel.js';
import { pong, bystander } from './zone-markt.js';
import { nok, climber } from './zone-reisfeld.js';
import { fisherman, sleepingWorker } from './zone-pier.js';
import { oma } from './zone-dorf.js';
import { buildAmbientFigur } from './ambient.js';

const q = (name) => (location.search.match(new RegExp('[?&]' + name + '=([-a-z0-9_.]+)')) || [])[1];

const renderer = new THREE.WebGLRenderer({ antialias: true, preserveDrawingBuffer: true });
renderer.setPixelRatio(Math.min(2, window.devicePixelRatio || 1));
renderer.shadowMap.enabled = true;
renderer.shadowMap.type = THREE.PCFShadowMap;
document.body.appendChild(renderer.domElement);
const scene = new THREE.Scene();
scene.background = new THREE.Color(0xf4f1ea);
const camera = new THREE.PerspectiveCamera(36, 1.6, 0.1, 100);
camera.position.set(2.8, 2.6, 7.6);
const controls = new OrbitControls(camera, renderer.domElement);
controls.target.set(0, 1.4, 0); controls.enableDamping = true; controls.minDistance = 2; controls.maxDistance = 14; controls.maxPolarAngle = Math.PI * 0.52;
const sun = new THREE.DirectionalLight(0xfff4d6, 1.9);
sun.castShadow = true; sun.shadow.mapSize.set(2048, 2048);
const sc = sun.shadow.camera; sc.left = -6; sc.right = 6; sc.top = 6; sc.bottom = -6; sc.near = 1; sc.far = 40;
sun.shadow.bias = -0.0006; sun.shadow.normalBias = 0.03;
sun.position.set(5, 10, 6); scene.add(sun, sun.target);
scene.add(new THREE.HemisphereLight(0xffffff, 0xd9b27a, 0.8));
const boden = toonMesh(new THREE.CircleGeometry(3.2, 40), 0xf7d984, { outline: 0, shadow: false });
boden.rotation.x = -Math.PI / 2; boden.receiveShadow = true; scene.add(boden);

// Katalog: { id, name, gruppe, bau(), update?(t) } — bau() liefert die Gruppe (Füße auf y 0, Blick +z)
const kat = await fetch('./data/kunden.json').then((r) => r.json()).catch(() => null);
const kunden = kat ? normalizeKatalog(kat) : [];
const eintraege = [];
const add = (id, name, gruppe, bau, update = null) => eintraege.push({ id, name, gruppe, bau, update });
for (const kopf of SCHLUFFI_KOEPFE) add('spieler_' + kopf, `Spieler (${kopf})`, 'Spieler', () => schluffi({ kopf }));
add('laeufer', 'Turnschuh-Typ', 'Spieler', () => runner());
add('mentor', 'Mentor', 'Feste Figuren', () => mentor());
add('nong', 'Nong (Barkeeper)', 'Feste Figuren', () => { const n = buildNong(); setNongMood(n, 'neutral'); return n; }, (g, t) => updateNong(g, t));
add('pong', 'Pong (Polizist)', 'Feste Figuren', () => pong());
add('mister_coconut', 'Mister Coconut', 'Feste Figuren', () => buildKokosVerkaeufer(), (g, t) => g.userData.update(t));
kunden.forEach((k, i) => add(k.id, `${k.name ?? k.id} (${k.typ})`, 'Kundschaft', () => { const f = buildKunde(k, 7 + i); kundenExtras(f, k); return f; }, (g, t) => updateKundenExtras(g, t)));
for (const slug of ['kind_1', 'kind_2', 'kind_3', 'ehe_sie', 'ehe_er', 'werfer_1', 'werfer_2', 'chad', 'influencerin', 'reflektor_freund', 'dieb', 'schlaeferin', 'tourist_kamera']) add(slug, slug.replace('_', ' '), 'Szenen', () => buildAmbientFigur(slug), (g, t) => g.userData.update(t));
add('nok', 'Bauer Nok (Reisfeld)', 'Statisten', () => nok());
add('kletterer', 'Kokos-Kletterer', 'Statisten', () => climber());
add('fischer', 'Fischer (Pier)', 'Statisten', () => fisherman());
add('bauarbeiter', 'Bauarbeiter (Pier)', 'Statisten', () => sleepingWorker());
add('oma', 'Oma (Dorf)', 'Statisten', () => oma());
add('vogelscheuche', 'Vogelscheuche (Hügel)', 'Statisten', () => scarecrow());
for (let i = 1; i <= 3; i++) add('statist_' + i, `Marktbesucher ${i}`, 'Statisten', () => bystander(i));

const liste = document.getElementById('liste');
let gruppeName = null;
for (const [i, e] of eintraege.entries()) {
  if (e.gruppe !== gruppeName) { gruppeName = e.gruppe; const og = document.createElement('optgroup'); og.label = gruppeName; liste.appendChild(og); }
  const o = document.createElement('option'); o.value = String(i); o.textContent = e.name; liste.lastElementChild.appendChild(o);
}
let aktuell = null, obj = null, idx = Math.max(0, eintraege.findIndex((e) => e.id === q('figur')));
const T0 = parseFloat(q('t') || '1.3');
function zeige(i) {
  idx = (i + eintraege.length) % eintraege.length;
  if (obj) scene.remove(obj);
  aktuell = eintraege[idx];
  obj = aktuell.bau();
  obj.rotation.y = 0.35; scene.add(obj);
  document.getElementById('name').textContent = aktuell.name;
  document.getElementById('zaehler').textContent = `${idx + 1} / ${eintraege.length}`;
  liste.value = String(idx);
  if (aktuell.update) aktuell.update(obj, T0);
  const url = new URL(location.href); url.searchParams.set('figur', aktuell.id); history.replaceState(null, '', url);
}
document.getElementById('prev').addEventListener('click', () => zeige(idx - 1));
document.getElementById('next').addEventListener('click', () => zeige(idx + 1));
liste.addEventListener('change', () => zeige(Number(liste.value)));
window.addEventListener('keydown', (e) => { if (e.key === 'ArrowLeft') zeige(idx - 1); if (e.key === 'ArrowRight') zeige(idx + 1); });
zeige(idx);

const start = performance.now();
function frame() {
  const t = T0 + (performance.now() - start) / 1000;
  if (aktuell?.update && obj) aktuell.update(obj, t);
  controls.update();
  renderer.render(scene, camera);
  requestAnimationFrame(frame);
}
function resize() { renderer.setSize(window.innerWidth, window.innerHeight, true); camera.aspect = window.innerWidth / window.innerHeight; camera.updateProjectionMatrix(); }
window.addEventListener('resize', resize); resize();
frame();
