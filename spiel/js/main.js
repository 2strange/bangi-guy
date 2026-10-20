// main.js — Szene, Eingabe, Spielschleife, Folge-Kamera, prozedurales Watscheln, Kundschaft + Mechanik v0,
// Snap-Modus (?snap=1, &at=…, &cy=…, &scene=dialog|inspect).
import * as THREE from 'three';
import { buildWorld } from './world.js';
import { schluffi } from './figures.js';
import { buildKunde, setMood, setRevealed } from './kunden.js';
import { createUI } from './ui.js';
import {
  inputToDir, dirToTarget, stepPlayer, followCamera, waddlePose, CAM_OFFSET, DEFAULT_CAM_YAW, isOccluder,
} from './logic.js';
import {
  initialState, normalizeKatalog, pickKunden, startDialog, advanceDialog, chooseOption, isArrested, newDay, moodFor,
  kundeStatus, nearestKunde, wanderStep, inspectCamera, kundeLookYaw, TALK_DIST, idSeed,
} from './game.js';

// Tastenbelegung (Konstanten, einfach umzulegen): E = immer ansprechen, F = hinschauen, Kamera Q/R
const KEY_TALK = 'KeyE';
const KEY_LOOK = 'KeyF';
const KEY_CAM_LEFT = 'KeyQ';
const KEY_CAM_RIGHT = 'KeyR';

// Parameter per Regex, weil der Screenshot-Aufruf „?snap=1“ hinter andere Parameter hängt (…?at=bar?snap=1)
const q = (name) => (location.search.match(new RegExp('[?&]' + name + '=([-a-z0-9.]+)')) || [])[1];
const SNAP = q('snap') === '1';
const STATS = q('stats') === '1';
const AT = q('at');
const CY = q('cy'); // Kamera-Gierung in Grad relativ zum Standard, z. B. ?at=hotel&cy=-90 (Kamera im Osten, Blick nach Westen)
const SCENE = q('scene'); // dialog | inspect | lineup (nur Snap)

const renderer = new THREE.WebGLRenderer({ antialias: true, preserveDrawingBuffer: SNAP });
renderer.setPixelRatio(SNAP ? 1 : Math.min(window.devicePixelRatio, 1.5));
renderer.shadowMap.enabled = true;
renderer.shadowMap.type = THREE.PCFShadowMap;
document.body.appendChild(renderer.domElement);

const scene = new THREE.Scene();
scene.background = new THREE.Color(0x8fe0ff);
scene.fog = new THREE.Fog(0x9fe6ff, 70, 230);

const camera = new THREE.PerspectiveCamera(44, 1.6, 0.5, 600);

// Licht: Sonne mit Schatten, die mit dem Spieler mitwandert (kleine, scharfe Schattenkarte)
const sunLight = new THREE.DirectionalLight(0xfff4d6, 1.9);
sunLight.castShadow = true;
sunLight.shadow.mapSize.set(2048, 2048);
const sc = sunLight.shadow.camera;
sc.left = -32; sc.right = 32; sc.top = 32; sc.bottom = -32; sc.near = 1; sc.far = 120;
sunLight.shadow.bias = -0.0006;
sunLight.shadow.normalBias = 0.03;
scene.add(sunLight, sunLight.target);
scene.add(new THREE.HemisphereLight(0xcfeeff, 0xd9b27a, 0.75));

// Welt + Figuren
const world = buildWorld();
scene.add(world.group);
world.group.updateMatrixWorld(true);
// Welt-Bounding-Sphere je Prop (einmalig) als Vorfilter für die Verdeckung
{
  const box = new THREE.Box3();
  const sph = new THREE.Sphere();
  for (const o of world.group.children) {
    if (o.userData.noFade) continue;
    box.setFromObject(o);
    if (box.isEmpty()) continue;
    box.getBoundingSphere(sph);
    o.userData.sphere = { x: sph.center.x, y: sph.center.y, z: sph.center.z, r: sph.radius };
  }
}
const colliders = world.colliders.slice();

const player = schluffi();
scene.add(player);
const P = player.userData.parts;

// ---------- Zustand ----------
const startSpot = world.spots[AT] || world.spots.start;
let state = { x: startSpot.x, z: startSpot.z, yaw: startSpot.yaw, phase: 0, speed: 0 };
let camYaw = DEFAULT_CAM_YAW + (CY ? parseFloat(CY) * Math.PI / 180 : 0);
let cam = { x: state.x, y: CAM_OFFSET.up, z: state.z - CAM_OFFSET.back, tx: state.x, ty: CAM_OFFSET.targetY, tz: state.z };
let clickTarget = null;

let game = initialState();
let mode = 'free';          // free | dialog | inspect | arrest
let dialog = null;          // aus game.js
let selected = 0;           // gewählte Option in der Sprechblase
let talking = null;         // Kunde im Gespräch / im Blick
let lineIdx = 0;            // Satzwahl zyklisch
const ui = createUI();
ui.setHud(game);

// ---------- Kundschaft ----------
// Spawn + Schlenderpunkte am Strand (frei von Gebäuden); mehr Kunden als Plätze teilen sich Plätze
const SPAWNS = [
  [{ x: -4, z: 10 }, { x: 3, z: 12 }, { x: 8, z: 7 }],
  [{ x: 14, z: 7 }, { x: 22, z: 11 }],
  [{ x: -25, z: 10 }, { x: -31, z: 13 }, { x: -21, z: 6 }], // Bar-Bereich, frei von den Hängematten-Palmen
  [{ x: 30, z: 4 }, { x: 40, z: 9 }],
  [{ x: 52, z: 9 }, { x: 60, z: 4 }],
  [{ x: -38, z: 5 }, { x: -44, z: 11 }],
];
const kunden = []; // { def, group, npc, collider, look }
const kundenGroup = new THREE.Group();
scene.add(kundenGroup);
let katalog = []; // normalisierter Kundenkatalog (für den Tageswechsel)

// Spawn-Codes aus dem Katalog (Karte): K1 Fähre/Ost, K2 Verleih, K3 Bar, K4 Mitte, K5 Richtung Dorf, K6 Hotel-Liegen
const SPAWN_CODE = { K1: 4, K2: 5, K3: 2, K4: 0, K5: 1, K6: 3 };
function clearKunden() {
  for (const k of kunden) {
    kundenGroup.remove(k.group);
    const i = colliders.indexOf(k.collider);
    if (i >= 0) colliders.splice(i, 1);
  }
  kunden.length = 0;
}
// Kunden für den aktuellen Tag aufstellen: 7 Stück, die Zivis rotieren pro Tag
function spawnKunden(day = 1) {
  clearKunden();
  const list = pickKunden(katalog, undefined, 2, day);
  const used = {};
  list.forEach((def, i) => {
    const si = def.spawn && SPAWN_CODE[def.spawn] !== undefined ? SPAWN_CODE[def.spawn] : i % SPAWNS.length;
    const n = used[si] = (used[si] || 0) + 1; // mehrere Kunden am selben Platz: versetzt
    const pts = SPAWNS[si].map((p) => ({ x: p.x + (n - 1) * 2.2, z: p.z + (n - 1) * 1.3 }));
    const group = buildKunde(def, idSeed(def.id));
    kundenGroup.add(group);
    setMood(group, def.stimmung_start || 'neutral');
    const npc = { x: pts[0].x, z: pts[0].z, yaw: Math.PI, points: pts, idx: 1, pause: 1 + i * 0.7, speed: 0.5 + def.tempo * 1.1, phase: 0 };
    const collider = { x: npc.x, z: npc.z, r: 0.7 };
    colliders.push(collider);
    kunden.push({ def, group, npc, collider, look: 0, id: def.id });
    applyKunde(kunden[kunden.length - 1]);
  });
}
function applyKunde(k) {
  k.group.position.set(k.npc.x, 0, k.npc.z);
  k.group.rotation.y = k.npc.yaw;
  k.collider.x = k.npc.x; k.collider.z = k.npc.z;
  const pose = waddlePose(k.npc.phase, k.npc.moving ? k.npc.speed : 0);
  const parts = k.group.userData.parts;
  parts.legs[0].rotation.x = pose.legL; parts.legs[1].rotation.x = pose.legR;
  parts.arms[0].rotation.x = pose.armL; parts.arms[1].rotation.x = pose.armR;
  parts.head.rotation.y = k.look;
  if (parts.dog) parts.dog.userData.head.rotation.y = k.look * 0.6;
}
// Kunden-Positionen für Logik (x, z, yaw, id)
const kundenPos = () => kunden.map((k) => ({ id: k.id, x: k.npc.x, z: k.npc.z, yaw: k.npc.yaw, ref: k }));

async function loadKunden() {
  let json = null;
  try {
    const res = await fetch('./data/kunden.json', { cache: 'no-store' });
    if (res.ok) json = await res.json();
  } catch (e) { /* Datei fehlt oder kaputt → Fallback unten */ }
  katalog = normalizeKatalog(json);
  if (katalog.length === 0) {
    katalog = normalizeKatalog([
      { id: 'fallback_schluffi', typ: 'Strandgast', schuhe: 'sandale', hemd: 'hawaii', accessoire: 'sonnenbrille' },
      { id: 'fallback_zivi', typ: 'Zu sauberer Tourist', schuhe: 'turnschuh', hemd: 'polo_sauber', accessoire: 'ohrknopf', zivi: true, heat: 2 },
    ]);
  }
  spawnKunden(game.tag);
}

// ---------- Eingabe ----------
const keys = { up: false, down: false, left: false, right: false, run: false, rotL: false, rotR: false };
const KEYMAP = {
  KeyW: 'up', ArrowUp: 'up', KeyS: 'down', ArrowDown: 'down', KeyA: 'left', ArrowLeft: 'left',
  KeyD: 'right', ArrowRight: 'right', ShiftLeft: 'run', ShiftRight: 'run', [KEY_CAM_LEFT]: 'rotL', [KEY_CAM_RIGHT]: 'rotR',
};
let nearK = null; // nächster Kunde in Reichweite (jeden Frame neu)
window.addEventListener('keydown', (e) => {
  if (mode === 'arrest') { if (e.code === 'Enter' || e.code === 'Space') { startNewDay(); e.preventDefault(); } return; }
  if (mode === 'dialog') { dialogKey(e); return; }
  // E = immer ansprechen (ohne Kunden in Reichweite passiert nichts), F = hinschauen
  if (e.code === KEY_TALK) { if (nearK && mode === 'free') startTalk(nearK); e.preventDefault(); return; }
  if (e.code === KEY_LOOK && (nearK || mode === 'inspect')) { toggleInspect(); e.preventDefault(); return; }
  if (e.code === 'Escape' && mode === 'inspect') { endInspect(); return; }
  const k = KEYMAP[e.code];
  if (k) { keys[k] = true; clickTarget = null; e.preventDefault(); }
});
window.addEventListener('keyup', (e) => { const k = KEYMAP[e.code]; if (k) keys[k] = false; });
window.addEventListener('blur', () => { for (const k in keys) keys[k] = false; });

// Klick auf den Boden = hinlaufen
const ray = new THREE.Raycaster();
const groundPlane = new THREE.Plane(new THREE.Vector3(0, 1, 0), 0);
renderer.domElement.addEventListener('pointerdown', (e) => {
  if (e.button !== 0 || mode !== 'free') return;
  const ndc = new THREE.Vector2((e.clientX / window.innerWidth) * 2 - 1, -(e.clientY / window.innerHeight) * 2 + 1);
  ray.setFromCamera(ndc, camera);
  const hit = new THREE.Vector3();
  if (ray.ray.intersectPlane(groundPlane, hit)) clickTarget = { x: hit.x, z: hit.z };
});
ui.onOptionClick((i, where) => {
  if (where === 'arrest') startNewDay();
  else if (mode === 'dialog') { selected = i; confirmDialog(); }
});

// ---------- Gespräch ----------
function startTalk(k) {
  talking = k;
  for (const key in keys) keys[key] = false;
  clickTarget = null;
  dialog = startDialog(k.def, game, lineIdx++);
  selected = 0;
  mode = 'dialog';
  ui.showPrompt(null);
  renderBubble();
}
function renderBubble() {
  if (!dialog) return;
  ui.showBubble(dialog, talking.def.name || talking.def.typ, selected);
}
function dialogKey(e) {
  if (!dialog) return;
  const n = dialog.options.length;
  if (e.code === 'ArrowLeft' || e.code === 'KeyA') { selected = (selected + n - 1) % Math.max(1, n); renderBubble(); }
  else if (e.code === 'ArrowRight' || e.code === 'KeyD') { selected = (selected + 1) % Math.max(1, n); renderBubble(); }
  else if (e.code === 'Digit1') { selected = 0; confirmDialog(); }
  else if (e.code === 'Digit2' && n > 1) { selected = 1; confirmDialog(); }
  else if (e.code === 'Enter' || e.code === 'Space' || e.code === 'KeyE') confirmDialog();
  else if (e.code === 'Escape') endDialog();
  e.preventDefault();
}
function confirmDialog() {
  if (!dialog) return;
  if (dialog.phase === 'wahl') {
    const r = chooseOption(game, dialog, talking.def, dialog.options[selected], lineIdx++);
    game = r.state; dialog = r.dialog;
    ui.setHud(game);
    setMood(talking.group, moodFor(kundeStatus(game, talking.id)));
    if (dialog.result === 'reveal') setRevealed(talking.group, true);
    selected = 0;
    renderBubble();
    return;
  }
  const next = advanceDialog(dialog);
  if (next) { dialog = next; selected = 0; renderBubble(); } else endDialog();
}
function endDialog() {
  dialog = null;
  ui.hideBubble();
  mode = 'free';
  if (isArrested(game)) { mode = 'arrest'; ui.showArrest(game); }
}
function startNewDay() {
  game = newDay(game);
  ui.setHud(game);
  ui.hideArrest();
  spawnKunden(game.tag); // neue Kundschaft, Zivis rotieren
  state = { ...state, x: world.spots.start.x, z: world.spots.start.z, yaw: world.spots.start.yaw, speed: 0 };
  mode = 'free';
}

// ---------- Genau hinschauen ----------
// Kamera-Abstand und Blickhöhe wachsen mit der Statur des Kunden (Figuren sind ±15 % groß)
function inspectOpts(k) {
  const sc = k.group.scale.x || 1;
  return { dist: 5.4 * sc, height: 1.8 * sc, targetY: 1.4 * sc };
}
function toggleInspect() {
  if (mode === 'inspect') endInspect();
  else if (nearK) { talking = nearK; mode = 'inspect'; ui.showPrompt('F / Esc: fertig geschaut'); }
}
function endInspect() { mode = 'free'; ui.showPrompt(null); }

// ---------- Pose anwenden ----------
function applyPose(st) {
  player.position.set(st.x, 0, st.z);
  player.rotation.y = st.yaw;
  const pose = waddlePose(st.phase, st.speed, st.running);
  P.legs[0].rotation.x = pose.legL;
  P.legs[1].rotation.x = pose.legR;
  // Sandale flappt: Ferse hebt sich, wenn das Bein nach hinten schwingt
  P.legs[0].children[2].rotation.x = Math.max(0, pose.legL) * 0.9;
  P.legs[1].children[2].rotation.x = Math.max(0, pose.legR) * 0.9;
  P.arms[0].rotation.x = pose.armL;
  P.arms[1].rotation.x = pose.armR * 0.4;
  P.body.position.y = 0.9 + pose.bob;
  P.body.rotation.set(P.baseBodyRot.x + pose.lean, 0, P.baseBodyRot.z + pose.sway);
  P.head.rotation.set(P.baseHeadRot.x - pose.lean * 0.5, P.baseHeadRot.y, P.baseHeadRot.z - pose.sway * 0.8);
}

function applyCamera() {
  camera.position.set(cam.x, cam.y, cam.z);
  camera.lookAt(cam.tx, cam.ty, cam.tz);
  sunLight.position.set(state.x + 20, 40, state.z + 14);
  sunLight.target.position.set(state.x, 0, state.z);
}

// Sprechblase über den Kopf des Gesprächspartners legen
const headWorld = new THREE.Vector3();
function placeBubbleAtHead() {
  if (!talking) return;
  talking.group.userData.parts.head.getWorldPosition(headWorld);
  headWorld.y += 1.7; // bei der steilen Kamera liegt „über dem Kopf“ sonst im Bild auf dem Körper
  headWorld.project(camera);
  ui.placeBubble((headWorld.x + 1) / 2 * window.innerWidth, (1 - headWorld.y) / 2 * window.innerHeight);
}

// ---------- Verdeckung: was zwischen Kamera und Spieler steht (oder direkt vor der Linse), wird durchsichtig ----------
// Materialien sind pro Farbe geteilt, deshalb bekommt jedes betroffene Mesh beim Ausblenden eine eigene Kopie.
const faded = new Map(); // mesh -> Originalmaterial
const fadeRay = new THREE.Raycaster();
const tmpV = new THREE.Vector3();
const tmpSphere = new THREE.Sphere();
const FADE_OPACITY = 0.25;
function fadeMesh(m) {
  if (faded.has(m) || !m.isMesh) return;
  const orig = m.material;
  faded.set(m, orig);
  const mats = Array.isArray(orig) ? orig : [orig];
  const clones = mats.map((mat) => {
    const c = mat.clone();
    c.transparent = true;
    if (c.isShaderMaterial) c.uniforms.opacity.value = FADE_OPACITY; else c.opacity = FADE_OPACITY;
    c.depthWrite = false;
    return c;
  });
  m.material = Array.isArray(orig) ? clones : clones[0];
}
function unfadeAll(keep) {
  for (const [m, orig] of faded) {
    if (keep.has(m)) continue;
    const cur = Array.isArray(m.material) ? m.material : [m.material];
    cur.forEach((c) => c.dispose());
    m.material = orig;
    faded.delete(m);
  }
}
const FADE_TARGET_HEIGHTS = [2.5, 0.8]; // Kopf und Knie: Palmenkronen hängen sonst über dem Brust-Strahl
function updateFade(focus) {
  const camPos = camera.position;
  const keep = new Set();
  const groups = new Set();
  const candidates = [];
  for (const h of FADE_TARGET_HEIGHTS) {
    const target = tmpV.set(focus.x, h, focus.z);
    const dist = camPos.distanceTo(target);
    // Vorfilter (reine Logik, getestet): Props, deren Kugel die Sichtlinie schneidet oder vor der Linse liegt
    candidates.length = 0;
    for (const o of world.group.children) {
      // Palmenkronen: Kugel an der Sichtlinie reicht (ohne Mesh-Raycast), die Krone ist eine große flache Fläche
      if (o.userData.crown && isOccluder(camPos, target, o.userData.crown, { margin: 0.4 })) { groups.add(o); continue; }
      if (o.userData.sphere && isOccluder(camPos, target, o.userData.sphere)) candidates.push(o);
    }
    // Feinprüfung per Raycast gegen die Meshes der Kandidaten (eine große Kugel heißt noch nicht Treffer)
    fadeRay.set(camPos, target.clone().sub(camPos).normalize());
    fadeRay.far = dist - 0.8;
    for (const hit of fadeRay.intersectObjects(candidates, true)) {
      let o = hit.object;
      while (o.parent && o.parent !== world.group) o = o.parent;
      groups.add(o);
    }
  }
  // direkt vor der Linse: Mesh-Kugel nahe an der Kamera
  for (const o of candidates) {
    if (groups.has(o)) continue;
    o.traverse((m) => {
      if (groups.has(o) || !m.isMesh || !m.geometry.boundingSphere) return;
      tmpSphere.copy(m.geometry.boundingSphere).applyMatrix4(m.matrixWorld);
      if (tmpSphere.distanceToPoint(camPos) < 2.5) groups.add(o);
    });
  }
  for (const grp of groups) grp.traverse((m) => { if (m.isMesh) { fadeMesh(m); keep.add(m); } });
  unfadeAll(keep);
  // beim Hinschauen den Spieler ganz ausblenden (inkl. Schatten) — halbtransparente Hüllen würden zu Matsch
  player.visible = mode !== 'inspect';
}

function resize() {
  const w = window.innerWidth, h = window.innerHeight;
  renderer.setSize(w, h, true);
  camera.aspect = w / h;
  camera.updateProjectionMatrix();
}

const hint = document.getElementById('hint');
function stats() {
  if (!hint || !STATS) return;
  const r = renderer.info.render;
  hint.textContent = `calls ${r.calls} · tris ${r.triangles} · ${Math.round(1000 / Math.max(1, frameMs))} fps`;
}
let frameMs = 16;

// ---------- Kunden je Frame ----------
function updateKunden(dt) {
  for (const k of kunden) {
    const busy = (mode === 'dialog' || mode === 'inspect') && talking === k;
    if (busy) {
      // stehen bleiben und sich zum Spieler drehen — beim Hinschauen zur Kamera (wer angestarrt wird, dreht sich um)
      const to = mode === 'inspect' ? cam : state;
      const want = Math.atan2(to.x - k.npc.x, to.z - k.npc.z);
      const d = Math.atan2(Math.sin(want - k.npc.yaw), Math.cos(want - k.npc.yaw));
      k.npc = { ...k.npc, yaw: k.npc.yaw + d * (1 - Math.exp(-6 * dt)), moving: false, pause: Math.max(k.npc.pause, 1.5) };
      k.look += (0 - k.look) * (1 - Math.exp(-6 * dt));
    } else {
      const before = k.npc;
      k.npc = wanderStep(k.npc, dt);
      k.npc.phase = (before.phase || 0) + Math.hypot(k.npc.x - before.x, k.npc.z - before.z) * (Math.PI * 2 / 1.6);
      const want = kundeLookYaw(k.npc, state);
      k.look += (want - k.look) * (1 - Math.exp(-3 * dt));
    }
    applyKunde(k);
  }
}

// ---------- Snap: einmal rendern an fester Stelle ----------
function setupScene() {
  if (!SCENE || kunden.length === 0) return;
  if (SCENE === 'lineup') {
    // Gruppenbild: alle Kunden in einer Reihe, Blick zur Kamera (Kamera von Süden, tief)
    const n = kunden.length, x0 = -(n - 1) * 1.7, z0 = 6;
    kunden.forEach((k, i) => {
      k.npc = { ...k.npc, x: x0 + i * 3.4, z: z0, yaw: 0, moving: false, pause: 99 };
      k.look = 0; applyKunde(k);
    });
    state = { ...state, x: x0 - 3.4, z: z0, yaw: 0, speed: 0 };
    mode = 'free';
    return;
  }
  // Gespräch mit dem ersten Kunden / Hinschauen beim zweiten (dem Zivi, falls vorhanden)
  const k = SCENE === 'inspect' ? (kunden.find((x) => x.def.zivi) || kunden[1] || kunden[0]) : kunden[0];
  const p = k.npc.points[0];
  k.npc = { ...k.npc, x: p.x, z: p.z, yaw: 0, moving: false, pause: 99 };
  // Spieler schräg nördlich vom Kunden, damit das Kundengesicht zur (nördlichen) Kamera zeigt
  state = { ...state, x: p.x + 1.7, z: p.z - 1.8, yaw: Math.atan2(p.x - (p.x + 1.7), p.z - (p.z - 1.8)), speed: 0 };
  k.npc.yaw = Math.atan2(state.x - k.npc.x, state.z - k.npc.z);
  k.look = 0;
  applyKunde(k);
  talking = k;
  if (SCENE === 'dialog') {
    dialog = advanceDialog(startDialog(k.def, game, 0));
    selected = 0;
    mode = 'dialog';
    renderBubble();
  } else {
    mode = 'inspect';
    ui.showPrompt('F / Esc: fertig geschaut');
  }
}

if (SNAP) {
  loadKunden().then(() => {
    const overview = AT === 'overview';
    setupScene();
    applyPose(state);
    for (let i = 0; i < 300; i++) cam = followCamera(cam, state, 1 / 60, camYaw);
    if (overview) cam = { x: 0, y: 78, z: -74, tx: 0, ty: 0, tz: 10 };
    if (mode === 'inspect') {
      cam = inspectCamera(talking.npc, state, inspectOpts(talking));
      talking.npc.yaw = Math.atan2(cam.x - talking.npc.x, cam.z - talking.npc.z);
      applyKunde(talking);
    }
    if (SCENE === 'lineup') cam = { x: 0, y: 3.2, z: 6 + 16.5, tx: 0, ty: 1.2, tz: 6 };
    applyCamera();
    camera.updateMatrixWorld();
    world.group.updateMatrixWorld(true);
    kundenGroup.updateMatrixWorld(true);
    updateFade(mode === 'inspect' ? talking.npc : state);
    const shoot = () => {
      resize(); camera.updateMatrixWorld();
      if (mode === 'dialog') placeBubbleAtHead();
      renderer.render(scene, camera);
      requestAnimationFrame(() => { resize(); if (mode === 'dialog') placeBubbleAtHead(); renderer.render(scene, camera); });
    };
    if (document.readyState === 'complete') shoot(); else window.addEventListener('load', shoot);
    window.addEventListener('resize', shoot);
  });
} else {
  resize();
  window.addEventListener('resize', resize);
  loadKunden();
  let last = performance.now();
  renderer.setAnimationLoop((now) => {
    const dt = Math.min(0.05, (now - last) / 1000);
    frameMs = now - last;
    last = now;
    const free = mode === 'free' || mode === 'inspect';
    if (free) {
      if (keys.rotL) camYaw += 1.5 * dt;
      if (keys.rotR) camYaw -= 1.5 * dt;
      let dir = inputToDir(keys, camYaw);
      if (dir.x === 0 && dir.z === 0 && clickTarget) {
        dir = dirToTarget(state, clickTarget);
        if (!dir) clickTarget = null;
      }
      state = stepPlayer(state, { dir, run: keys.run }, dt, colliders);
    } else {
      state = stepPlayer(state, { dir: null, run: false }, dt, colliders);
    }
    applyPose(state);
    updateKunden(dt);

    // Nähe + Prompt
    const near = nearestKunde(state, kundenPos());
    nearK = near ? near.ref : null;
    if (mode === 'free') ui.showPrompt(nearK ? `${nearK.def.name || nearK.def.typ} — E: ansprechen · F: genau hinschauen` : null);
    if (mode === 'inspect' && talking) {
      const d = Math.hypot(talking.npc.x - state.x, talking.npc.z - state.z);
      if (d > TALK_DIST + 1.5) endInspect(); // Weggehen beendet das Hinschauen
    }

    // Kamera: Folge-Kamera oder Hinschau-Kamera (weich)
    if (mode === 'inspect' && talking) {
      const want = inspectCamera(talking.npc, state, inspectOpts(talking));
      const t = 1 - Math.exp(-5 * dt);
      for (const key of ['x', 'y', 'z', 'tx', 'ty', 'tz']) cam[key] += (want[key] - cam[key]) * t;
    } else {
      cam = followCamera(cam, state, dt, camYaw);
    }
    applyCamera();
    camera.updateMatrixWorld();
    updateFade(mode === 'inspect' && talking ? talking.npc : state);
    if (mode === 'dialog') placeBubbleAtHead();
    renderer.render(scene, camera);
    stats();
  });
}
