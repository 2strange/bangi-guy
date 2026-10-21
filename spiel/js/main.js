// main.js — Szene, Eingabe, Spielschleife, Folge-Kamera, prozedurales Watscheln, Kundschaft + Mechanik v0,
// Snap-Modus (?snap=1, &at=…, &cy=…, &scene=dialog|inspect).
import * as THREE from 'three';
import { buildWorld } from './world.js';
import { schluffi } from './figures.js';
import { buildKunde, setMood, setRevealed, setActivity } from './kunden.js';
import { createUI, isTouchDevice, hintSeen, markHint } from './ui.js';
import { prepareGags, playGag, stopGag } from './gags.js';
import {
  inputToDir, dirToTarget, stepPlayer, followCamera, waddlePose, CAM_OFFSET, DEFAULT_CAM_YAW, isOccluder, joystickInput, rotateDir,
  ANCHORS, assignAnchors,
} from './logic.js';
import {
  initialState, normalizeKatalog, pickKunden, startDialog, advanceDialog, chooseOption, isArrested, newDay, moodFor,
  kundeStatus, nearestKunde, wanderStep, inspectCamera, kundeLookYaw, TALK_DIST, idSeed,
  normalizeTexte, soldOutDialog, isSoldOut, dayEndCard, assignOutfits, START_WARE, gagFor, nextIdleGagDelay,
  normalizeStimmen, barksFor, pickBark,
} from './game.js';

// Tastenbelegung (Konstanten, einfach umzulegen): E = immer ansprechen, F = hinschauen, Kamera Q/R
const KEY_TALK = 'KeyE';
const KEY_LOOK = 'KeyF';
const KEY_CAM_LEFT = 'KeyQ';
const KEY_CAM_RIGHT = 'KeyR';

// Parameter per Regex, weil der Screenshot-Aufruf „?snap=1“ hinter andere Parameter hängt (…?at=bar?snap=1)
const q = (name) => (location.search.match(new RegExp('[?&]' + name + '=([-a-z0-9._]+)')) || [])[1];
const SNAP = q('snap') === '1';
const STATS = q('stats') === '1';
const AT = q('at');
const CY = q('cy'); // Kamera-Gierung in Grad relativ zum Standard, z. B. ?at=hotel&cy=-90 (Kamera im Osten, Blick nach Westen)
const SCENE = q('scene'); // dialog | inspect | lineup | ausverkauft | bilanz | gag (nur Snap)
const SCENE_ID = q('id'); // Kunde für scene=gag
const TOUCH = q('touch') === '1' || isTouchDevice(); // Touch-Steuerung einblenden

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
// Audio (audio.js, eigenes Modul): optional geladen; initAudio() wartet selbst auf die erste Geste (Mobil!).
// Die Spiellogik ruft nur Einzeiler-Hooks; ohne Modul bleibt alles stumm.
let audio = null;
const SFX = { talk: 'ui_klick', kasse: 'kasse', alarm: 'heat', ablehnung: 'ablehnen', look: 'hinschauen', feierabend: 'ui_klick', verhaftet: 'verhaftet', ausverkauft: 'ausverkauft', schritt: 'schritt_sand' };
const sfx = (name) => { try { audio?.sfx?.(SFX[name] || name); } catch (e) { /* ohne Ton weiter */ } };
const muteBtn = ui.createMuteButton((m) => { try { audio?.setMuted?.(m); } catch (e) { /* ignorieren */ } });
let audioStarted = false;
function startAudio() {
  if (!audio) return;
  try {
    if (!audio.ambience?.isPlaying?.()) { audio.ambience?.start?.(); audio.music?.start?.(); }
    audioStarted = !!audio.ambience?.isPlaying?.();
  } catch (e) { /* ignorieren */ }
}
let audioRetryAt = 0;
import('./audio.js').then((m) => {
  audio = m;
  try { audio.initAudio?.(); audio.loadStimmen?.(); muteBtn.set(!!audio.isMuted?.()); } catch (e) { /* ignorieren */ }
  const el = document.getElementById('mute');
  if (el) el.style.display = 'block';
  const mb = document.getElementById('music');
  if (mb && audio.music?.setEnabled) {
    mb.style.display = 'block';
    const paint = () => { const on = audio.music.isEnabled ? audio.music.isEnabled() : true; mb.textContent = on ? '🎵' : '🎵̸'; mb.classList.toggle('muted', !on); };
    paint();
    mb.addEventListener('click', () => { try { const on = audio.music.isEnabled ? !audio.music.isEnabled() : false; audio.music.setEnabled(on); paint(); sfx('talk'); } catch (e) { /* ignorieren */ } });
  }
  if (gestureSeen) startAudio();
}).catch(() => { /* kein Audio-Modul → stumm */ });
let gestureSeen = false;
const firstGesture = () => { gestureSeen = true; startAudio(); setTimeout(startAudio, 300); };
window.addEventListener('pointerdown', firstGesture, { once: true });
window.addEventListener('keydown', firstGesture, { once: true });
let texte = normalizeTexte(null);
let stimmen = normalizeStimmen(null);
const barkPrev = {}; // `${id}/${kind}` -> zuletzt gesagter Index (nie zweimal dieselbe Zeile)
let barkSeed = 0;
let soldOutShown = false; // Ausverkauft-Meldung einmal pro Tag

// ---------- Kundschaft ----------
// Kundschaft steht an festen Ankerplätzen (logic.ANCHORS) und tut etwas; Zuteilung in assignAnchors()
const kunden = []; // { def, group, npc, collider, look }
const kundenGroup = new THREE.Group();
scene.add(kundenGroup);
let katalog = []; // normalisierter Kundenkatalog (für den Tageswechsel)

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
  const outfits = assignOutfits(list, day); // keine Doppel-Outfits pro Tag
  const anchors = assignAnchors(list, ANCHORS, { day }); // feste Plätze, Zivis mit Abstand
  const seen = {};
  list.forEach((def, i) => {
    const a = anchors[def.id];
    const n = seen[a.id] = (seen[a.id] || 0) + 1; // Notnagel: geteilter Platz versetzt
    const pos = { x: a.x + (n - 1) * 2.2, z: a.z + (n - 1) * 1.3 };
    const group = buildKunde(def, idSeed(def.id), outfits[def.id]);
    kundenGroup.add(group);
    setMood(group, def.stimmung_start || 'neutral');
    // kein Kreisen: ein Punkt, der Kunde bleibt an seinem Platz und tut etwas
    const pts = [pos];
    const npc = { x: pos.x, z: pos.z, yaw: a.blick ?? 0, points: pts, idx: 0, pause: 99, speed: 0.5 + def.tempo * 1.1, phase: 0, activity: a.activity };
    const collider = { x: npc.x, z: npc.z, r: 0.7 };
    colliders.push(collider);
    prepareGags(group);
    kunden.push({ def, group, npc, collider, look: 0, id: def.id, gag: null, idleN: i, nextIdle: 3 + i * 1.3, anchor: a });
    setActivity(group, a.activity);
    applyKunde(kunden[kunden.length - 1]);
  });
}
function applyKunde(k) {
  k.group.position.set(k.npc.x, 0, k.npc.z);
  k.group.rotation.y = k.npc.yaw;
  k.collider.x = k.npc.x; k.collider.z = k.npc.z;
  k.group.position.y = k.group.userData.sitOffset || 0;
  if (k.gag) return; // gags.js hat Arme/Beine/Kopf/Hund in der Hand
  const parts = k.group.userData.parts;
  if (!k.npc.moving) {
    // steht am Platz: Tätigkeits-Pose (einmal gesetzt, nur der Kopf folgt dem Spieler)
    if (!k.posed) { setActivity(k.group, k.npc.activity); k.posed = true; }
    parts.head.rotation.y = k.look;
    if (parts.dog) parts.dog.userData.head.rotation.y = k.look * 0.6;
    return;
  }
  k.posed = false;
  const pose = waddlePose(k.npc.phase, k.npc.speed);
  parts.legs[0].rotation.x = pose.legL; parts.legs[1].rotation.x = pose.legR;
  parts.arms[0].rotation.x = pose.armL; parts.arms[1].rotation.x = pose.armR;
  parts.head.rotation.y = k.look;
  if (parts.dog) parts.dog.userData.head.rotation.y = k.look * 0.6;
}
// Kunden-Positionen für Logik (x, z, yaw, id)
const kundenPos = () => kunden.map((k) => ({ id: k.id, x: k.npc.x, z: k.npc.z, yaw: k.npc.yaw, ref: k }));

async function loadTexte() {
  let json = null;
  try {
    const res = await fetch('./data/texte.json', { cache: 'no-store' });
    if (res.ok) json = await res.json();
  } catch (e) { /* Datei fehlt → Platzhalter-Texte */ }
  texte = normalizeTexte(json);
  game = { ...game, texte };
}
async function loadStimmen() {
  let json = null;
  try {
    const res = await fetch('./data/stimmen.json', { cache: 'no-store' });
    if (res.ok) json = await res.json();
  } catch (e) { /* ohne Datei keine Barks */ }
  stimmen = normalizeStimmen(json);
}
// Bark: kurze englische Zeile als kleine Blase über dem Kopf (+ Gebrabbel-Hook fürs Audio)
function bark(k, kind, ttl) {
  // audio.bark() liefert Text + Dauer und brabbelt gleich mit; ohne Audio-Modul der eigene Picker
  let r = null;
  try { r = audio?.bark?.(k.def.id, kind) || null; } catch (e) { r = null; }
  if (r && r.text) { ui.showBark(k.id, r.text, ttl ?? Math.max(2.6, (r.dauer || 0) + 0.6)); return; }
  const list = barksFor(stimmen, k.def, kind);
  const key = `${k.id}/${kind}`;
  const p = pickBark(list, barkPrev[key] ?? -1, barkSeed++);
  if (!p) return;
  barkPrev[key] = p.idx;
  ui.showBark(k.id, p.text, ttl);
}
const stopBabble = () => { try { audio?.stopBabble?.(); } catch (e) { /* ignorieren */ } };
const barkHead = new THREE.Vector3();
function placeBarks() {
  const now = performance.now() / 1000;
  for (const k of kunden) {
    k.group.userData.parts.head.getWorldPosition(barkHead);
    barkHead.y += 0.9;
    barkHead.project(camera);
    ui.placeBark(k.id, (barkHead.x + 1) / 2 * window.innerWidth, (1 - barkHead.y) / 2 * window.innerHeight, now);
  }
}
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
// Touch: Joystick links (weit ausgelenkt = rennen), Buttons rechts; Mathe in logic.joystickInput
let joy = null;
const touch = ui.createTouchControls({
  onJoystick: (dx, dy) => { joy = dx === null ? null : joystickInput(dx, dy, { radius: touch.radius }); if (joy) clickTarget = null; },
  onTalk: () => { sfx('talk'); if (mode === 'dialog') confirmDialog(); else if (nearK && mode === 'free') startTalk(nearK); },
  onLook: () => { sfx('talk'); if (nearK || mode === 'inspect') toggleInspect(); },
  onCamLeft: (down) => { keys.rotL = down; },
  onCamRight: (down) => { keys.rotR = down; },
});
if (TOUCH) touch.show();
window.addEventListener('keydown', (e) => {
  if (mode === 'arrest' || mode === 'card') { if (e.code === 'Enter' || e.code === 'Space') { startNewDay(); e.preventDefault(); } return; }
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
  sfx('talk');
  if (where === 'card') startNewDay();
  else if (mode === 'dialog') { selected = i; confirmDialog(); }
});

// ---------- Gespräch ----------
function startTalk(k) {
  markHint('talk');
  sfx('talk');
  ui.hideBarks();
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
  ui.showBubble(dialog, talking ? (talking.def.name || talking.def.typ) : 'Schluffi', selected);
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
  if (dialog.phase === 'ausverkauft') {
    soldOutShown = true;
    if (selected === 0) endDay(); else endDialog();
    return;
  }
  if (dialog.phase === 'wahl') {
    const heatBefore = game.heat;
    const r = chooseOption(game, dialog, talking.def, dialog.options[selected], lineIdx++);
    game = r.state; dialog = r.dialog;
    if (game.heat > heatBefore) sfx('alarm');
    ui.setHud(game);
    setMood(talking.group, moodFor(kundeStatus(game, talking.id)));
    if (dialog.result === 'kauf' || dialog.result === 'reveal') sfx('kasse'); else sfx('ablehnung');
    if (dialog.result === 'reveal') setRevealed(talking.group, true);
    const wann = dialog.result === 'ablehnung' ? 'ablehnung' : (dialog.result === 'kauf' || dialog.result === 'reveal') ? 'kauf' : null;
    if (wann) startGag(talking, gagFor(texte, talking.id, wann));
    selected = 0;
    renderBubble();
    return;
  }
  const next = advanceDialog(dialog);
  if (next) { dialog = next; selected = 0; renderBubble(); } else endDialog();
}
function endDialog() {
  // der Kunde ruft noch etwas hinterher (englischer Bark), je nach Ausgang
  if (dialog && talking && (dialog.result === 'kauf' || dialog.result === 'reveal')) bark(talking, 'kauf');
  else if (dialog && talking && dialog.result === 'ablehnung') bark(talking, 'ablehnung');
  dialog = null;
  ui.hideBubble();
  stopBabble();
  mode = 'free';
  if (isArrested(game)) { mode = 'arrest'; sfx('verhaftet'); const c = dayEndCard(game, texte, lineIdx++); ui.showCard({ titel: c.titel, zeilen: [c.spruch, ...c.zeilen], button: c.button, rot: true }); return; }
  if (isSoldOut(game) && !soldOutShown) showSoldOut();
}
// Ausverkauft: Sprechblase des Spielers mit „Tag beenden“ / „Weiterbummeln“
function showSoldOut() {
  talking = null;
  dialog = soldOutDialog(texte, lineIdx++);
  sfx('ausverkauft');
  selected = 0;
  mode = 'dialog';
  ui.showPrompt(null);
  renderBubble();
}
// Tagesbilanz-Karte, danach neuer Tag
function endDay() {
  dialog = null;
  ui.hideBubble();
  mode = 'card';
  sfx('feierabend');
  const c = dayEndCard(game, texte, lineIdx++);
  ui.showCard({ titel: c.titel, zeilen: [c.spruch, ...c.zeilen], button: c.button, rot: c.lage === 'verhaftet' });
}
function startNewDay() {
  game = newDay(game);
  soldOutShown = false;
  ui.setHud(game);
  ui.hideCard();
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
  else if (nearK) { talking = nearK; mode = 'inspect'; markHint('look'); sfx('look'); showInspectHint(); if (nearK.def.zivi) bark(nearK, 'zivi_verdaechtig', 3.5); }
}
function endInspect() { mode = 'free'; markHint('end'); ui.showPrompt(null); stopBabble(); }
// Inspect-Ansicht bleibt frei: Beenden-Hinweis als kleine Pille am Rand, groß nur beim ersten Mal
function showInspectHint() {
  if (!hintSeen('end')) ui.showPrompt(TOUCH ? 'Nochmal Schauen oder weggehen: fertig' : 'F oder Esc: fertig geschaut — weggehen geht auch', { small: true });
  else ui.showPrompt(TOUCH ? '👀 fertig' : 'F / Esc', { small: true });
}

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
  const head = talking ? talking.group.userData.parts.head : P.head;
  head.getWorldPosition(headWorld);
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
  // direkt vor der Linse: Mesh-Kugel nahe an der Kamera. Nicht beim Hinschauen: die Kamera steht dann bewusst
  // nah am Kunden, und ein Gebäude daneben (Hotelwand) würde sonst als riesiger halbtransparenter Block erscheinen.
  for (const o of mode === 'inspect' ? [] : candidates) {
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
  if (!STATS) return;
  let el = hint || document.getElementById('stats');
  if (!el) {
    el = document.createElement('div'); el.id = 'stats'; el.className = 'comic';
    el.style.cssText = 'position:fixed;right:12px;top:10px;background:#fff8e6;border:3px solid #111;border-radius:12px;padding:4px 12px;font-size:16px;box-shadow:3px 3px 0 #111';
    document.body.appendChild(el);
  }
  const r = renderer.info.render;
  el.textContent = `calls ${r.calls} · tris ${r.triangles}` + (SNAP ? '' : ` · ${Math.round(1000 / Math.max(1, frameMs))} fps`);
}
let frameMs = 16;
let lastStepPhase = 0;

// ---------- Reveal-Gags (gags.js, Daten aus texte.json) ----------
const clock = () => performance.now() / 1000;
function startGag(k, entry) {
  if (!entry) return;
  if (k.gag) stopGag(k.group);
  k.gag = { entry, t0: clock() };
  k.npc = { ...k.npc, moving: false, pause: Math.max(k.npc.pause, entry.dauer_s + 1) };
}
// Gag beenden und Status-Mimik/Mütze wiederherstellen (stopGag setzt die Grundstimmung zurück)
function endGag(k) {
  if (!k.gag) return;
  stopGag(k.group);
  k.gag = null;
  k.posed = false;
  setMood(k.group, kundeStatus(game, k.id) === 'neutral' ? (k.def.stimmung_start || 'neutral') : moodFor(kundeStatus(game, k.id)));
  setRevealed(k.group, kundeStatus(game, k.id) === 'misstrauisch');
}
function updateGag(k, now) {
  if (!k.gag) return;
  const t = now - k.gag.t0;
  const running = playGag(k.group, k.gag.entry, t);
  const d = Math.hypot(k.npc.x - state.x, k.npc.z - state.z);
  if (k.gag.entry.wann === 'immer') { if (!running) endGag(k); return; }
  // kauf/ablehnung halten den Endzustand, bis der Spieler weitergeht oder ein anderes Gespräch beginnt
  if (!running && (d > TALK_DIST + 3 || (mode === 'dialog' && talking !== k))) endGag(k);
}

// ---------- Hinweise in Kundennähe: groß nur beim ersten Mal, danach kleines blinkendes E/F-Badge über der Figur ----------
const badgeWorld = new THREE.Vector3();
function updateNearHint() {
  if (!nearK) { ui.showPrompt(null); ui.showBadge(null); ui.pulseButtons(null); return; }
  const name = nearK.def.name || nearK.def.typ;
  const firstTalk = !hintSeen('talk'), firstLook = !hintSeen('look');
  if (firstTalk || firstLook) {
    const parts = [];
    if (firstTalk) parts.push(TOUCH ? '💬 Reden' : 'E: ansprechen');
    if (firstLook) parts.push(TOUCH ? '👀 Schauen = genau hinsehen (Schuhe!)' : 'F: genau hinschauen (Schuhe!)');
    ui.showPrompt(`${name} — ${parts.join(' · ')}`);
    ui.showBadge(null);
    ui.pulseButtons({ talk: firstTalk, look: firstLook });
    return;
  }
  ui.showPrompt(null);
  if (TOUCH) { ui.pulseButtons({ talk: true, look: true }); ui.showBadge(null); return; }
  nearK.group.userData.parts.head.getWorldPosition(badgeWorld);
  badgeWorld.y += 1.2;
  badgeWorld.project(camera);
  ui.showBadge(['E', 'F'], (badgeWorld.x + 1) / 2 * window.innerWidth, (1 - badgeWorld.y) / 2 * window.innerHeight);
}

// ---------- Kunden je Frame ----------
function updateKunden(dt) {
  const now = clock();
  for (const k of kunden) {
    const busy = (mode === 'dialog' || mode === 'inspect') && talking === k;
    if (k.gag) { updateGag(k, now); if (k.gag) { applyKunde(k); continue; } }
    // Idle-Gag („immer“) alle 6–10 s, wenn der Spieler in der Nähe ist — der Hinweis zum Leute-Lesen
    if (!busy && mode === 'free' && now > k.nextIdle) {
      k.nextIdle = now + nextIdleGagDelay(k.idleN++);
      const d = Math.hypot(k.npc.x - state.x, k.npc.z - state.z);
      if (d < 10) startGag(k, gagFor(texte, k.id, 'immer'));
      if (k.gag) { updateGag(k, now); applyKunde(k); continue; }
    }
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
  if (SCENE === 'gag') {
    // Kunde mitten im Kauf-Gag: ggf. Tag wechseln, bis der Kunde dran ist (Zivis rotieren)
    let k = kunden.find((x) => x.id === SCENE_ID);
    for (let day = 2; !k && day <= 3; day++) { spawnKunden(day); k = kunden.find((x) => x.id === SCENE_ID); }
    k = k || kunden[0];
    const p = k.npc.points[0];
    k.npc = { ...k.npc, x: p.x, z: p.z, yaw: 0, moving: false, pause: 99 };
    state = { ...state, x: p.x + 1.7, z: p.z - 1.8, yaw: Math.PI, speed: 0 };
    k.npc.yaw = Math.atan2(state.x - k.npc.x, state.z - k.npc.z);
    k.look = 0; applyKunde(k);
    talking = k;
    const entry = gagFor(texte, k.id, 'kauf') || gagFor(texte, k.id, 'immer') || gagFor(texte, k.id, 'ablehnung');
    if (entry) { k.gag = { entry, t0: 0 }; playGag(k.group, entry, entry.dauer_s * 0.6); }
    mode = 'inspect'; // Hinschau-Kamera + Spieler ausgeblendet, damit der Gag frei steht
    return;
  }
  if (SCENE === 'bark') {
    const k = kunden.find((x) => x.anchor.activity === 'schaut' || x.anchor.activity === 'steht') || kunden[0];
    state = { ...state, x: k.npc.x + 1.8, z: k.npc.z + 1.6, yaw: Math.atan2(k.npc.x - state.x, k.npc.z - state.z), speed: 0 };
    markHint('talk'); markHint('look');
    nearK = k; bark(k, 'gruss', 999);
    mode = 'free';
    return;
  }
  if (SCENE === 'badge' || SCENE === 'hint') {
    // Spieler neben dem ersten Kunden; 'badge' = Hinweise schon gesehen (kleines E/F), 'hint' = erstes Mal (groß)
    const k = kunden.find((x) => x.anchor.activity === 'schaut' || x.anchor.activity === 'steht') || kunden[0];
    state = { ...state, x: k.npc.x + 1.8, z: k.npc.z + 1.6, yaw: Math.atan2(k.npc.x - state.x, k.npc.z - state.z), speed: 0 };
    if (SCENE === 'badge') { markHint('talk'); markHint('look'); }
    mode = 'free';
    return;
  }
  if (SCENE === 'bilanz') {
    game = { ...game, ware: 0, verkauftHeute: START_WARE - 1, anZivisHeute: 1, geldHeute: 95, geld: 95, heat: 2 }; // Zahlen gehen auf: verkauft + an Zivis + übrig = Start
    ui.setHud(game);
    endDay();
    return;
  }
  if (SCENE === 'ausverkauft') {
    game = { ...game, ware: 0, verkauftHeute: START_WARE, geldHeute: 120, geld: 120 };
    ui.setHud(game);
    showSoldOut();
    return;
  }
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
    showInspectHint();
  }
}

if (SNAP) {
  Promise.all([loadTexte(), loadStimmen(), loadKunden()]).then(() => {
    const overview = AT === 'overview';
    setupScene();
    applyPose(state);
    for (let i = 0; i < 300; i++) cam = followCamera(cam, state, 1 / 60, camYaw);
    if (overview) { cam = { x: 6, y: 112, z: -128, tx: 6, ty: 0, tz: -10 }; scene.fog = null; } // Übersicht ohne Nebel
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
      if (SCENE === 'badge' || SCENE === 'hint' || SCENE === 'bark') { const near = nearestKunde(state, kundenPos()); nearK = near ? near.ref : null; updateNearHint(); placeBarks(); }
      if (mode === 'dialog') placeBubbleAtHead();
      renderer.render(scene, camera);
      requestAnimationFrame(() => { resize(); if (mode === 'dialog') placeBubbleAtHead(); renderer.render(scene, camera); stats(); });
    };
    if (document.readyState === 'complete') shoot(); else window.addEventListener('load', shoot);
    window.addEventListener('resize', shoot);
  });
} else {
  resize();
  window.addEventListener('resize', resize);
  loadTexte();
  loadStimmen();
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
      let run = keys.run;
      if (joy && joy.active) { dir = rotateDir(joy, camYaw); run = joy.run; }
      if (dir.x === 0 && dir.z === 0 && clickTarget) {
        dir = dirToTarget(state, clickTarget);
        if (!dir) clickTarget = null;
      }
      state = stepPlayer(state, { dir, run }, dt, colliders);
    } else {
      state = stepPlayer(state, { dir: null, run: false }, dt, colliders);
    }
    applyPose(state);
    // Schritt im Sand: jede volle Watschel-Periode (1.6 Einheiten ≈ 0.4 s Gehen)
    if (state.moving && Math.floor(state.phase / (Math.PI * 2)) !== Math.floor(lastStepPhase / (Math.PI * 2))) sfx('schritt');
    lastStepPhase = state.phase;
    if (audio && gestureSeen && !audioStarted && now > audioRetryAt) { audioRetryAt = now + 2000; startAudio(); }
    updateKunden(dt);

    // Nähe + Prompt
    const near = nearestKunde(state, kundenPos());
    const prevNear = nearK;
    nearK = near ? near.ref : null;
    if (nearK && nearK !== prevNear && mode === 'free') bark(nearK, 'gruss'); // Gruß beim Näherkommen
    placeBarks();
    if (mode === 'free') updateNearHint();
    else { ui.showBadge(null); ui.pulseButtons(null); }
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
