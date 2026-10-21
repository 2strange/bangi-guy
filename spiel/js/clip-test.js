// clip-test.js — Nahansichten im Raster zum Aufspüren durchstechender Geometrie (Konturhüllen innenliegender
// Teile, Hände im Rumpf, Accessoires im Kopf, Requisiten in Dächern). Standbild, keine Steuerung.
// Pro Spalte ein Objekt, pro Zeile eine Ansicht: von vorn, von der Seite, schräg von oben (≈ Spielkamera, 45°).
// Gekippt wird das Objekt, die Kamera bleibt orthografisch — so passen viele Nahansichten in ein Bild.
// ?set=kunden1|kunden2|kunden3 → Kundschaft mit Extras · leute1|leute2 → Spieler, Mentor, Nong, Pong, Nok, Statisten
//      posen → alle Posen an einem Kunden · gags1|gags2|gags3 → Reveal-Gags im Endzustand · daecher → Gebäude mit Dachrequisiten
//      bar → die Strandbar mit Nong groß, drei Ansichten
import * as THREE from 'three';
import { textTexture } from './toon.js';
import { schluffi, runner, pose, POSES, buildNong, updateNong, setNongMood, kundenExtras, updateKundenExtras } from './figures.js';
import { beachBar, hut, hotel, finaleHuette, rental, signpost } from './props.js';
import { buildingScale } from './logic.js';
import { buildKunde } from './kunden.js';
import { normalizeKatalog } from './game.js';
import { playGag } from './gags.js';
import { mentor, scarecrow } from './zone-huegel.js';
import { pong, bystander, stand } from './zone-markt.js';
import { nok, climber } from './zone-reisfeld.js';
import { fisherman, sleepingWorker } from './zone-pier.js';
import { oma } from './zone-dorf.js';

const q = (name) => (location.search.match(new RegExp('[?&]' + name + '=([-a-z0-9.]+)')) || [])[1];
const SET = q('set') || 'leute1';

const renderer = new THREE.WebGLRenderer({ antialias: true, preserveDrawingBuffer: true });
renderer.setPixelRatio(1);
renderer.shadowMap.enabled = true;
document.body.appendChild(renderer.domElement);
const scene = new THREE.Scene();
scene.background = new THREE.Color(0x8fe0ff);
const camera = new THREE.OrthographicCamera(-1, 1, 1, -1, 0.1, 200);

const sunLight = new THREE.DirectionalLight(0xfff4d6, 1.9);
sunLight.position.set(8, 20, 14);
scene.add(sunLight, sunLight.target);
scene.add(new THREE.HemisphereLight(0xcfeeff, 0xd9b27a, 0.75));

// Ansichten: Drehung/Kippung des Objekts um seinen Fußpunkt
const VIEWS = {
  vorn: (o) => { o.rotation.set(0, 0.12, 0); },
  seite: (o) => { o.rotation.set(0, -Math.PI / 2 + 0.1, 0); },
  oben: (o) => { o.rotation.set(0.78, 0.3, 0); },           // Spielkamera: 45° von schräg vorn oben
  hinten_oben: (o) => { o.rotation.set(0.78, Math.PI - 0.4, 0); },
  roh: () => {},                                            // Objekt bringt seine Drehung selbst mit
};

/** Raster: items = [{ label, make(view) → Object3D }], views = Zeilennamen.
 *  Zellenmaße kommen aus den Bounding-Boxen (Spaltenbreite je Objekt, Zeilenhöhe = höchstes Objekt), mindestens cw/ch. */
function grid(items, views, { cw = 3.2, ch = 4.0, maxFactor = 1.5 } = {}) {
  const rows = views.length;
  // erst bauen und drehen, dann über die gedrehten Bounding-Boxen setzen (Zelle = größte Box der Spalte/Zeile,
  // höchstens maxFactor × Mindestmaß, damit ein Ausreißer — fliegender Reiher, Lichtkegel — das Raster nicht sprengt)
  const built = items.map((it) => views.map((view) => { const o = it.make(view); VIEWS[view](o); o.updateMatrixWorld(true); return { o, box: new THREE.Box3().setFromObject(o) }; }));
  const size = new THREE.Vector3();
  const widths = built.map((col) => Math.min(cw * maxFactor, Math.max(cw, ...col.map(({ box }) => { box.getSize(size); return size.x * 1.1 + 0.4; }))));
  const chMin = ch;
  built.forEach((col) => col.forEach(({ box }) => { box.getSize(size); ch = Math.min(chMin * maxFactor, Math.max(ch, size.y * 1.08 + 0.3)); }));
  let x = 0;
  items.forEach((it, i) => {
    const w = widths[i], cx = x + w / 2; x += w;
    views.forEach((view, r) => {
      const { o, box } = built[i][r];
      o.position.set(cx - (box.min.x + box.max.x) / 2, (rows - 1 - r) * ch + 0.15 - box.min.y, 0);
      scene.add(o);
    });
    const tex = textTexture(it.label, { bg: '#fff1c2', fg: '#2b1b0b', font: 'bold 48px sans-serif', w: 640, h: 80 });
    const label = new THREE.Mesh(new THREE.PlaneGeometry(Math.min(w, cw) * 0.92, Math.min(w, cw) * 0.115), new THREE.MeshBasicMaterial({ map: tex }));
    label.position.set(cx, rows * ch - 0.05, 20); scene.add(label);
  });
  const w = x, h = rows * ch + 0.3, aspect = 1.6;
  const vw = Math.max(w, h * aspect), vh = vw / aspect;
  camera.left = w / 2 - vw / 2; camera.right = w / 2 + vw / 2; camera.top = h / 2 + vh / 2; camera.bottom = h / 2 - vh / 2;
  camera.updateProjectionMatrix();
  camera.position.set(0, 0, 60); camera.lookAt(0, 0, 0);
  sunLight.target.position.set(w / 2, h / 2, 0);
}

const ladeKunden = async () => normalizeKatalog(await fetch('./data/kunden.json').then((r) => r.json()));
const kundeItem = (k, seed, index = 0) => ({
  label: k.name || k.id, make: () => { const f = buildKunde(k, seed); kundenExtras(f, k, { index }); updateKundenExtras(f, 1.3); return f; },
});

if (SET.startsWith('kunden')) {
  const kunden = await ladeKunden();
  const items = [];
  kunden.forEach((k, i) => { items.push(kundeItem(k, 7 + i)); if (k.figuren === 2) items.push({ ...kundeItem(k, 7 + i, 1), label: (k.name || k.id) + ' (2)' }); });
  const seiten = [items.slice(0, 6), items.slice(6, 12), items.slice(12)];
  grid(seiten[Number(SET.slice(-1)) - 1] || seiten[0], ['vorn', 'seite', 'oben']);
} else if (SET === 'leute1') {
  grid([
    { label: 'Spieler', make: schluffi },
    { label: 'Läufer', make: runner },
    { label: 'Mentor', make: mentor },
    { label: 'Nong', make: () => { const n = buildNong(); setNongMood(n, 'neutral'); updateNong(n, 1.1); return n; } },
    { label: 'Pong', make: pong },
    { label: 'Nok', make: nok },
  ], ['vorn', 'seite', 'oben']);
} else if (SET === 'leute2') {
  grid([
    { label: 'Fischer', make: fisherman },
    { label: 'Kletterer', make: climber },
    { label: 'Oma', make: oma },
    { label: 'Statist', make: () => bystander(3) },
    { label: 'Bauarbeiter', make: sleepingWorker },
    { label: 'Vogelscheuche', make: scarecrow },
  ], ['vorn', 'seite', 'oben']);
} else if (SET === 'posen') {
  const kunden = await ladeKunden();
  const k = kunden.find((x) => x.id === 'rentner_1');
  grid(POSES.map((name) => ({ label: name, make: () => { const f = buildKunde(k, 5); const { offsetY } = pose(f, name); f.position.y = offsetY; const g = new THREE.Group(); g.add(f); return g; } })), ['vorn', 'seite', 'oben'], { cw: 3.0 });
} else if (SET.startsWith('gags')) {
  const [kunden, texte] = await Promise.all([ladeKunden(), fetch('./data/texte.json').then((r) => r.json())]);
  const byId = new Map(kunden.map((k) => [k.id, k]));
  const items = texte.reveal_gags.filter((g) => byId.has(g.id)).map((g) => ({
    label: `${g.id} · ${g.wann}`,
    make: () => { const k = byId.get(g.id); const f = buildKunde(k, 3); kundenExtras(f, k); playGag(f, g, g.wann === 'immer' ? g.dauer_s * 0.5 : g.dauer_s); return f; },
  }));
  const per = Math.ceil(items.length / 3), n = Number(SET.slice(-1)) - 1;
  grid(items.slice(n * per, (n + 1) * per), ['vorn', 'seite', 'oben'], { cw: 3.0 });
} else if (SET === 'bar') { // eine Zeile, drei Ansichten der Bar samt Nong (wie im Spiel eingehängt)
  const bs = buildingScale('bar');
  const barMitNong = (rx, ry) => () => { const b = beachBar(); b.scale.setScalar(bs); const n = buildNong(); n.position.set(-0.7, 0, -0.1); n.scale.setScalar(1 / bs); b.add(n); setNongMood(n, 'neutral'); updateNong(n, 1.1); b.rotation.set(rx, ry, 0); return b; };
  grid([
    { label: 'schräg oben', make: barMitNong(0.78, 0.3) },
    { label: 'von hinten oben', make: barMitNong(0.78, Math.PI - 0.4) },
    { label: 'von der Seite', make: barMitNong(0, -Math.PI / 2 + 0.1) },
  ], ['roh'], { cw: 10, ch: 8, maxFactor: 2 });
} else if (SET === 'daecher') {
  grid([
    { label: 'Bar', make: () => { const b = beachBar(); b.scale.setScalar(buildingScale('bar')); return b; } },
    { label: 'Hütte', make: () => { const h = hut({ straw: true, stilts: 0.6, seed: 4 }); h.scale.setScalar(buildingScale('hut')); return h; } },
    { label: 'Hotel', make: () => { const h = hotel(); h.scale.setScalar(buildingScale('hotel')); return h; } },
    { label: 'Finale-Hütte', make: () => { const h = finaleHuette(); h.scale.setScalar(1.5); return h; } },
    { label: 'Verleih', make: rental },
    { label: 'Marktstand', make: () => stand({ kind: 'fisch', sign: 'FISCH · FAST FRISCH', cloth: ['#3a7bd5', '#ffffff'], seed: 11 }) },
    { label: 'Wegweiser', make: () => { const s = signpost(); s.scale.setScalar(1.25); return s; } },
  ], ['oben', 'hinten_oben'], { cw: 9.5, ch: 7.5, maxFactor: 3 });
}

function shoot() {
  renderer.setSize(window.innerWidth, window.innerHeight, true);
  renderer.render(scene, camera);
  requestAnimationFrame(() => renderer.render(scene, camera));
}
if (document.readyState === 'complete') shoot(); else window.addEventListener('load', shoot);
window.addEventListener('resize', shoot);
