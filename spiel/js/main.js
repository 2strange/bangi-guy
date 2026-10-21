// main.js — Szene, Eingabe, Spielschleife, Folge-Kamera, prozedurales Watscheln, Kundschaft + Mechanik v0,
// Snap-Modus (?snap=1, &at=…, &cy=…, &scene=dialog|inspect).
import * as THREE from 'three';
import { buildWorld } from './world.js';
import { schluffi } from './figures.js';
import { buildKunde, setMood, setRevealed } from './kunden.js';
import { pose as figurePose, updateNong, setNongMood } from './figures.js';
import { initLicht } from './licht.js';
import { mentorBarSpot } from './zone-huegel.js';
import { createUI, isTouchDevice, hintSeen, markHint } from './ui.js';
import { prepareGags, playGag, stopGag } from './gags.js';
import {
  inputToDir, dirToTarget, stepPlayer, followCamera, waddlePose, CAM_OFFSET, DEFAULT_CAM_YAW, isOccluder, joystickInput, rotateDir,
  ANCHORS, assignAnchors, zoneMix, patrolStart, seesTarget, chaseStep, inHideout, CHASE_SPEED, PATROL_SPEED, WORLD, BUILDING_POS, STREIFE_P2_ROUTE,
} from './logic.js';
import {
  initialState, normalizeKatalog, pickKunden, startDialog, advanceDialog, chooseOption, isArrested, newDay, moodFor,
  kundeStatus, nearestKunde, wanderStep, inspectCamera, kundeLookYaw, TALK_DIST, idSeed,
  normalizeTexte, soldOutDialog, isSoldOut, dayEndCard, assignOutfits, START_WARE, gagFor, nextIdleGagDelay,
  normalizeStimmen, barksFor, pickBark,
  normalizeMentorSzene, mentorSzene, finishMentor, mentorBesucht,
  normalizePosten7, buyMango, giveMango, mangoText, pongText, inPostenSicht, patrolSpotted, normalizeKunde, arrestNow, tukTukRide, TUKTUK_PREIS_MANGOS, TUKTUK_PREIS_GELD,
  initialClock, clockStep, clockLabel, phaseFor, abendBeginnt, nachtBeginnt, barBeendetTag, inBar, normalizeAbend, zwischenrufLine, STREIFE_P2_AB_TAG, lichtT, barAbend, guteNacht, sonnenuntergangLine, einschlafenLine,
} from './game.js';
import { POSTEN as POSTEN_LAYOUT, MARKT as MARKT_AREA, STAENDE, LANES as MARKT_LANES } from './zone-markt-layout.js';
import { HAFENPLATZ } from './zone-pier-layout.js';

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
const SCENE = q('scene'); // dialog | inspect | lineup | ausverkauft | bilanz | gag | mentor | mango | streife | abend (nur Snap)
const T01 = q('t'); // Tageszeit 0..1 für Snaps
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

const camera = new THREE.PerspectiveCamera(44, 1.6, 1.0, 600); // near 1.0: bessere Tiefenauflösung, die Kamera ist nie näher als ~4 Einheiten

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
const SFX = { talk: 'ui_klick', kasse: 'kasse', alarm: 'heat', ablehnung: 'ablehnen', look: 'hinschauen', feierabend: 'ui_klick', verhaftet: 'verhaftet', ausverkauft: 'ausverkauft', schritt: 'schritt_sand', tuten: 'tuten', tuktuk: 'tuktuk_abwuergen' };
const sfx = (name, opts) => { try { audio?.sfx?.(SFX[name] || name, opts); } catch (e) { /* ohne Ton weiter */ } };
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
// Zonen-Ambience: Mischung aus der Spielerposition, alle 250 ms (Zonen-Mitten kommen vom Markt-Modul, bis dahin Platzhalter)
let ambienceAt = 0;
const POSTEN_ZONE = world.markt?.posten || { x: POSTEN_LAYOUT.pong.x, z: POSTEN_LAYOUT.pong.z, r: 14 }; // Vorplatz des Postens (Heat doppelt), aus dem Markt-Modul
const MARKT_ZONE = { x: (MARKT_AREA.minX + MARKT_AREA.maxX) / 2, z: (MARKT_AREA.minZ + MARKT_AREA.maxZ) / 2, r: 22 };
const PIER_ZONE = { x: HAFENPLATZ.x, z: HAFENPLATZ.z, r: 22 }; // Hafen: Tuk-Tuk-Leerlauf-Knattern
const BAR_ZONE = { x: BUILDING_POS.bar.x, z: BUILDING_POS.bar.z, r: 12 }; // Gläserklirren + Gemurmel
const ZONE_DEFS = () => ({ markt: MARKT_ZONE, posten: POSTEN_ZONE, pier: PIER_ZONE, bar: BAR_ZONE });
function updateAmbience(now) {
  if (!audio?.ambience?.setZone || now < ambienceAt) return;
  ambienceAt = now + 250;
  try { audio.ambience.setZone(zoneMix(state, ZONE_DEFS())); } catch (e) { /* ignorieren */ }
}
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
let abendTexte = normalizeAbend(null);
let tagesuhr = initialClock();
let phase = phaseFor(0);
// Licht über den Tag (licht.js: Himmel, Nebel, Sonnen-/Hemisphärenlicht, Nachtlichter, Sonne/Mond) + Musik-/Ambience-Stimmung
const licht = initLicht(scene, { sonne: world.sonne });
function applyTageszeit() {
  try { licht.set(lichtT(tagesuhr.t01)); } catch (e) { /* ignorieren */ } // Uhr-t (06–24 h) → 24-h-Palette
  const ph = phaseFor(tagesuhr.t01);
  if (ph !== phase) {
    phase = ph;
    const mood = ph === 'abend' || ph === 'nacht' ? 'abend' : 'tag';
    try { if (audio?.setMood) audio.setMood(mood); else audio?.music?.setMood?.(mood); } catch (e) { /* ignorieren */ }
  }
}
applyTageszeit();
function refreshHud() { ui.setHud({ ...game, clockLabel: clockLabel(tagesuhr.t01) }); }
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
  const anchors = assignAnchors(list, ANCHORS, { day }); // feste Plätze über alle Zonen (Markt-Plätze stecken in ANCHORS), Zivis mit Abstand
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
    kunden.push({ def, group, npc, collider, look: 0, id: def.id, gag: null, idleN: i, nextIdle: 3 + i * 1.3, anchor: a, arrived: def.spawn !== 'K1' });
    // Fähren-Gäste (K1) warten unsichtbar auf dem Wasser, bis die Fähre anlegt
    if (def.spawn === 'K1' && world.pier?.ferrySpawn) { group.visible = false; collider.r = 0; }
    applyKunde(kunden[kunden.length - 1]);
  });
}
function applyKunde(k) {
  k.group.position.set(k.npc.x, 0, k.npc.z);
  k.group.rotation.y = k.npc.yaw;
  k.collider.x = k.npc.x; k.collider.z = k.npc.z;
  k.group.position.y = k.group.userData.poseOffset || 0;
  if (k.gag) return; // gags.js hat Arme/Beine/Kopf/Hund in der Hand
  const parts = k.group.userData.parts;
  if (!k.npc.moving) {
    // steht am Platz: Tätigkeits-Pose aus figures.js (einmal gesetzt), nur der Kopf folgt dem Spieler
    if (!k.group.userData.pose) {
      const { offsetY } = figurePose(k.group, POSE_NAME(k.anchor));
      k.group.userData.poseOffset = offsetY;
      k.group.position.y = offsetY;
    }
    if (k.group.userData.pose !== 'liegen') parts.head.rotation.y = k.look;
    if (parts.dog) parts.dog.userData.head.rotation.y = k.look * 0.6;
    return;
  }
  k.group.userData.pose = null; k.group.userData.poseOffset = 0;
  const pose = waddlePose(k.npc.phase, k.npc.speed);
  parts.legs[0].rotation.x = pose.legL; parts.legs[1].rotation.x = pose.legR;
  parts.arms[0].rotation.x = pose.armL; parts.arms[1].rotation.x = pose.armR;
  parts.head.rotation.y = k.look;
  if (parts.dog) parts.dog.userData.head.rotation.y = k.look * 0.6;
}
// Ankerplatz-Tätigkeit → Pose aus figures.js (Liegen = liegen, Hocker = sitzen)
const POSE_NAME = (a) => ({ sitzt: a.id.startsWith('liege') ? 'liegen' : 'sitzen', telefoniert: 'handy', fotografiert: 'foto', schaut: 'meer', steht: 'stehen' }[a.activity] || 'stehen');
// Kunden-Positionen für Logik (x, z, yaw, id)
const kundenPos = () => kunden.map((k) => ({ id: k.id, x: k.npc.x, z: k.npc.z, yaw: k.npc.yaw, ref: k }));

async function loadTexte() {
  let json = null;
  try {
    const res = await fetch('./data/texte.json', { cache: 'no-store' });
    if (res.ok) json = await res.json();
  } catch (e) { /* Datei fehlt → Platzhalter-Texte */ }
  texte = normalizeTexte(json);
  mentorSz = normalizeMentorSzene(json);
  posten7 = normalizePosten7(json);
  abendTexte = normalizeAbend(json);
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
// Stereo-Position einer Figur relativ zur Kamera (−1 links … 1 rechts, gedämpft, damit es nie hart einseitig wird)
const panV = new THREE.Vector3();
function panFor(group) {
  const head = group?.userData?.parts?.head || group;
  if (!head) return 0;
  head.getWorldPosition(panV);
  panV.project(camera);
  return Number.isFinite(panV.x) ? Math.max(-1, Math.min(1, panV.x)) * 0.7 : 0;
}
function bark(k, kind, ttl) {
  // audio.bark() liefert Text + Dauer und brabbelt gleich mit (gepannt nach Bildposition); ohne Audio-Modul der eigene Picker
  let r = null;
  try { r = audio?.bark?.(k.def.id, kind, { pan: panFor(k.group) }) || null; } catch (e) { r = null; }
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
  P.head.getWorldPosition(barkHead);
  barkHead.y += 0.9; barkHead.project(camera);
  ui.placeBark('spieler', (barkHead.x + 1) / 2 * window.innerWidth, (1 - barkHead.y) / 2 * window.innerHeight, now);
  (barkeeperObj.userData.parts?.head || barkeeperObj).getWorldPosition(barkHead); barkHead.y += 0.9; barkHead.project(camera);
  ui.placeBark('barkeeper', (barkHead.x + 1) / 2 * window.innerWidth, (1 - barkHead.y) / 2 * window.innerHeight, now);
  for (const s of streifen) {
    s.group.userData.parts.head.getWorldPosition(barkHead);
    barkHead.y += 0.9; barkHead.project(camera);
    ui.placeBark(s.id, (barkHead.x + 1) / 2 * window.innerWidth, (1 - barkHead.y) / 2 * window.innerHeight, now);
  }
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
// Mentor auf der Kuppe: eigener Gesprächspartner (kein Kunde), Szene einmal pro Tag
let mentorSz = normalizeMentorSzene(null);
const mentorRef = world.huegel.mentor ? { id: 'mentor', group: world.huegel.mentor, def: { id: 'mentor', name: 'Mentor', typ: 'Mentor', zivi: false }, npc: { x: world.huegel.mentor.position.x, z: world.huegel.mentor.position.z, yaw: 0 }, isMentor: true } : null;
let nearMentor = false;
// Abends sitzt der Mentor an der Bar (Hocker, Kokosnuss — zone-huegel.mentorAnBar) statt im Garten; morgens zurück
const MENTOR_GARTEN = mentorRef ? { x: mentorRef.npc.x, z: mentorRef.npc.z } : null;
let mentorAmTresen = false;
function placeMentor(abends) {
  if (!mentorRef || abends === mentorAmTresen) return;
  mentorAmTresen = abends;
  try { world.huegel.mentorAnBar?.(abends); } catch (e) { /* ohne Umzug */ }
  nongSag(abends ? 'muede' : 'neutral');
  const p = abends ? mentorBarSpot() : MENTOR_GARTEN;
  mentorRef.npc.x = p.x; mentorRef.npc.z = p.z;
}
// Interaktionspunkte (E): Mango-Stand am Markt (kaufen), Pong am Posten (Mango abgeben); Blase an einem Hilfsobjekt
let posten7 = normalizePosten7(null);
function pointObj(x, y, z) { const o = new THREE.Object3D(); o.position.set(x, y, z); o.userData.parts = { head: o }; scene.add(o); return o; }
const mangoStandDef = STAENDE.find((st) => st.kind === 'mango') || { x: 44, z: -44 };
const POINTS = [
  { id: 'mango_stand', x: mangoStandDef.x, z: mangoStandDef.z + 1.4, r: TALK_DIST + 0.6, name: 'Mango-Stand', obj: pointObj(mangoStandDef.x, 2.6, mangoStandDef.z) },
  { id: 'pong', x: POSTEN_LAYOUT.pong.x, z: POSTEN_LAYOUT.pong.z, r: TALK_DIST + 0.8, name: 'Pong', obj: world.markt?.pong || pointObj(POSTEN_LAYOUT.pong.x, 2.6, POSTEN_LAYOUT.pong.z) },
  // Tuk-Tuk-Express am Hafen: Fahrt zur Bar (20 Mangos laut Schild, sonst Geld), beendet eine Verfolgung
  { id: 'tuktuk', x: world.pier?.tuktuk?.x ?? 74, z: (world.pier?.tuktuk?.z ?? -4) + 2.4, r: TALK_DIST + 1.2, name: 'Somchai', obj: pointObj(world.pier?.tuktuk?.x ?? 74, 2.4, world.pier?.tuktuk?.z ?? -4) },
  // Bestechungs-Stand „1 MANGO = 1 GNADE“ neben Pong: dieselbe Abgabe wie bei Pong selbst
  { id: 'gnaden_stand', x: world.markt?.mangoStand?.x ?? 15.5, z: (world.markt?.mangoStand?.z ?? -82) + 1.4, r: TALK_DIST + 0.6, name: 'Pong', obj: world.markt?.pong || pointObj(POSTEN_LAYOUT.pong.x, 2.6, POSTEN_LAYOUT.pong.z) },
];
let nearPoint = null;
function pongSay(situation) {
  try { const pan = panFor(POINTS[1].obj); if (situation === 'pfiff') sfx('pfeife'); else audio?.bark?.('pong', situation, { pan }); } catch (e) { /* ohne Ton */ }
}
// Einzel-Blase mit „Weiter“ (nutzt den Mentor-Modus mit einer Folge aus einer Blase)
function showInfo(point, text, bark = null) {
  mentorFolge = [{ id: point.id, text, bark }];
  mentorIdx = 0;
  talking = { id: point.id, group: point.obj, def: { id: point.id, name: point.name, typ: point.name, zivi: false }, npc: { x: point.x, z: point.z, yaw: 0 } };
  for (const key in keys) keys[key] = false;
  clickTarget = null;
  mode = 'info';
  ui.showPrompt(null);
  ui.showBubble({ text, options: ['Weiter'] }, point.name, 0);
}
function usePoint(point) {
  if (point.id === 'mango_stand') {
    const r = buyMango(game);
    game = r.state; refreshHud();
    if (r.result === 'gekauft') { sfx('kasse'); showInfo(point, `Eine Mango, 10 Münzen. Du hast jetzt ${game.mangos}. „3 = 1“ gilt nur für Stammkunden, sagt der Händler.`); }
    else showInfo(point, 'Zu wenig Geld, Mann. Der Händler zeigt auf das Schild und dann aufs Meer.');
    try { audio?.ambience?.ruf?.(); } catch (e) { /* ignorieren */ }
    return;
  }
  if (point.id === 'tuktuk') {
    const r = tukTukRide(game);
    if (r.result === 'zu_arm') { showInfo(point, `Somchai zeigt aufs Schild: ${TUKTUK_PREIS_MANGOS} Mangos. Oder ${TUKTUK_PREIS_GELD} Münzen, wenn's eilt. Du hast beides nicht.`); return; }
    if (r.result === 'verhaftet') return;
    game = r.state; refreshHud();
    sfx('tuktuk');
    // Fahrt: Spieler landet an der Bar, die Streife verliert die Spur
    const bar = world.spots.bar;
    state = { ...state, x: bar.x, z: bar.z, yaw: bar.yaw, speed: 0 };
    cam = { ...cam, x: bar.x, z: bar.z + (cam.z - state.z), tx: bar.x, tz: bar.z };
    for (const s of streifen) if (s.patrol.mode === 'chase') s.patrol = { ...s.patrol, mode: 'return', lost: 0, kante: false };
    showInfo({ ...point, obj: P.head }, r.result === 'mangos' ? `Somchai nimmt die ${TUKTUK_PREIS_MANGOS} Mangos, der Motor säuft zweimal ab, dann sind wir an der Bar.` : `${TUKTUK_PREIS_GELD} Münzen, Motor säuft ab, läuft, säuft ab — Bar.`);
    return;
  }
  if (point.id === 'pong' || point.id === 'gnaden_stand') {
    const r = giveMango(game);
    game = r.state; refreshHud();
    if (r.result === 'gnade') { sfx('mango'); pongSay('mango_gnaedig'); }
    else if (r.result === 'schon_heute') pongSay('mango_schon');
    else if (r.result === 'keine_mango') pongSay('mango_keine');
    const text = r.result === 'keine_mango' && game.heat === 0 ? pongText(posten7, game, lineIdx++) : mangoText(posten7, r.result, lineIdx++);
    showInfo(point, text);
  }
}
function endInfo() { mentorFolge = null; ui.hideBubble(); stopBabble(); mode = 'free'; }

// Verhaftung: Pong bringt den Schluffi am Abend an der Bar vorbei — Mentor kommentiert, dann die Bilanz
function verhaftetZurBar() {
  const bar = barStehplatz();
  cam = { ...cam, x: cam.x + (bar.x - state.x), z: cam.z + (bar.z - state.z), tx: bar.x, tz: bar.z };
  state = { ...state, x: bar.x, z: bar.z, yaw: bar.yaw, speed: 0, stumbled: false };
  tagesuhr = { t01: Math.max(tagesuhr.t01, 0.72) }; applyTageszeit(); placeMentor(true); refreshHud();
  startBarAbend();
}
// ---------- Abend in der Bar: Nong (Barkeeper) → Mentor-Rückblick → letzte Runde → Bilanz-Karte → neuer Tag ----------
const barkeeperObj = world.nong || pointObj(BUILDING_POS.bar.x - 1, 2.6, BUILDING_POS.bar.z - 1.8); // Nong hinter der Theke (Blasen-Anker am Kopf)
// Nongs Gesicht: tagsüber neutral, abends müde, beim Gruß kurz eine Braue hoch
let nongMoodAt = 0;
const nongBaseMood = () => (mentorAmTresen ? 'muede' : 'neutral');
function nongSag(mood, now = performance.now()) { try { setNongMood(world.nong, mood); } catch (e) { /* ohne Figur */ } nongMoodAt = mood === 'gruss' ? now + 1500 : 0; }
let barFolge = null, barIdx = 0, nachtArt = 'bar';
// Bar-Kamera: von der Meerseite leicht links auf den Tresen, Mentor mittig, Schluffi am linken Hocker nicht in der Sichtlinie
const barCamera = () => { const b = BUILDING_POS.bar; return { x: b.x - 5.5, y: 4.8, z: b.z + 11, tx: b.x - 0.5, ty: 1.5, tz: b.z - 0.5 }; };
const barStehplatz = () => { const b = BUILDING_POS.bar; return { x: b.x - 4.2, z: b.z + 2.6, yaw: Math.PI }; }; // am linken Ende des Tresens, verdeckt weder Nong noch den Mentor
function startBarAbend() {
  barFolge = barAbend(game, abendTexte, lineIdx++);
  barIdx = 0;
  nachtArt = 'bar';
  for (const key in keys) keys[key] = false;
  clickTarget = null;
  mode = 'bar';
  ui.showPrompt(null); ui.hideBarks();
  showBarStep();
}
function showBarStep() {
  const e = barFolge[barIdx];
  const last = barIdx === barFolge.length - 1;
  const isMentor = e.wer === 'mentor';
  nongSag(e.id === 'gruss' ? 'gruss' : nongBaseMood());
  talking = isMentor && mentorRef ? mentorRef : { id: 'barkeeper', group: barkeeperObj, def: { id: 'barkeeper', name: abendTexte.barkeeper.name }, npc: { x: -27.5, z: -2.2, yaw: 0 } };
  ui.showBubble({ text: e.text, options: e.frage ? e.optionen : [last ? 'Feierabend' : 'Weiter'] }, isMentor ? 'Mentor' : abendTexte.barkeeper.name, 0);
  if (e.bark) { try { const pan = panFor(talking.group); audio?.bark?.(isMentor ? 'mentor' : 'barkeeper', e.bark, { pan }); } catch (err) { /* ohne Ton */ } }
}
// wahl: Index der angeklickten/gedrückten Option (bei der Frage „Feierabend?“: 0 = ja, 1 = noch nicht)
function advanceBar(wahl = 0) {
  if (!barFolge) return;
  const e = barFolge[barIdx];
  if (e.frage && wahl === 1) { barFolge = null; ui.hideBubble(); stopBabble(); talking = null; mode = 'free'; return; } // noch nicht — Mentor bleibt am Tresen, E startet erneut
  if (barIdx < barFolge.length - 1) { barIdx++; showBarStep(); return; }
  barFolge = null;
  ui.hideBubble(); stopBabble();
  endDay(null, { fuss: guteNacht(abendTexte, lineIdx++) });
}

// ---------- Streifen: P1 Posten ↔ Markt (Straßen aus dem Markt-Layout), P2 Hotelstrand ↔ Furt ↔ Pier (watet, ab Tag 2).
// Sieht eine Streife einen Verkauf → Heat + Pfiff; ab Heat 2 Verfolgung ----------
const PATROL_ROUTE = [[8, -82], ...MARKT_LANES.ring.slice().reverse()].map(([x, z]) => ({ x, z })); // Posten → Ringstraße → Marktzufahrt und zurück
const PLAYER_SCHUHE = 'sandalen'; // der Schluffi: darf in die Furt, watet dort mit 0,6
const STREIFE_DEFS = [
  { id: 'streife_p1', route: PATROL_ROUTE, schuhe: 'sandalen', seed: 7, abTag: 1 },          // Sandalen: watet durch die Furt; 'turnschuhe' bliebe an der Kante
  { id: 'streife_p2', route: STREIFE_P2_ROUTE, schuhe: 'sandalen', seed: 11, abTag: STREIFE_P2_AB_TAG, hautton: 'dunkel' },
];
function makeStreife(def) {
  const group = buildKunde(normalizeKunde({ id: def.id, typ: 'Streife', name: 'Streife', schuhe: 'sandale', hemd: 'polo_sauber', hose: 'chino', accessoire: 'ohrknopf', extras: ['funkgeraet'], hautton: def.hautton || 'mittel', haare: 'kurz', zivi: true, stimmung_start: 'misstrauisch' }), def.seed);
  setRevealed(group, true); // Polizeimütze: die Streife ist offen Polizei (Pong in Sandalen — kann nicht rennen)
  scene.add(group);
  const patrol = { ...patrolStart(def.route), mode: 'patrol' };
  const collider = { x: patrol.x, z: patrol.z, r: 0.7 };
  colliders.push(collider);
  return { ...def, group, patrol, collider, sees: false };
}
const streifen = STREIFE_DEFS.map(makeStreife);
const streifeAktiv = (s) => (game.tag || 1) >= s.abTag;
const streifeSieht = () => streifen.some((st) => st.sees);
let sightCooldown = 0;
function applyCop(s) {
  const aktiv = streifeAktiv(s);
  s.group.visible = aktiv;
  if (!aktiv) { s.collider.x = 1e4; s.collider.z = 1e4; return; } // inaktiv: unsichtbar und ohne Collider
  const { patrol } = s;
  s.group.position.set(patrol.x, 0, patrol.z);
  s.group.rotation.y = patrol.yaw;
  s.collider.x = patrol.x; s.collider.z = patrol.z;
  const pose = waddlePose(patrol.phase || 0, patrol.moving ? (patrol.mode === 'chase' ? CHASE_SPEED : PATROL_SPEED) : 0, patrol.mode === 'chase');
  const P = s.group.userData.parts;
  P.legs[0].rotation.x = pose.legL; P.legs[1].rotation.x = pose.legR;
  P.arms[0].rotation.x = pose.armL; P.arms[1].rotation.x = pose.armR;
  P.head.rotation.y = s.sees ? Math.max(-1, Math.min(1, Math.atan2(Math.sin(Math.atan2(state.x - patrol.x, state.z - patrol.z) - patrol.yaw), Math.cos(Math.atan2(state.x - patrol.x, state.z - patrol.z) - patrol.yaw)))) : 0;
}
const applyCops = () => { for (const s of streifen) applyCop(s); };
function updatePatrol(dt, now) {
  const busy = mode === 'dialog' || mode === 'mentor' || mode === 'info' || mode === 'card' || mode === 'arrest' || mode === 'bar';
  for (const s of streifen) {
    if (!streifeAktiv(s)) { s.sees = false; applyCop(s); continue; }
    const sees = seesTarget(s.patrol, state);
    s.sees = sees && !inHideout(state, world.hideouts);
    // Verfolgung ab Heat 2: langsam (Sandalen), verliert den Spieler nach 6 s ohne Sicht oder im Versteck
    const r = chaseStep(s.patrol, s.route, state, dt, { sees, heat: game.heat, hideouts: world.hideouts, schuhe: s.schuhe });
    if (r.event === 'kante') { ui.showBark(s.id, 'These are new!', 2.5); try { audio?.babble?.('pong', 'These are new!', { pan: panFor(s.group) }); } catch (e) { /* ohne Ton */ } }
    s.patrol = r.st;
    if (r.event === 'chase_start') { sfx('pfeife'); try { audio?.bark?.('pong', 'verfolgung', { pan: panFor(s.group) }); } catch (e) { /* ohne Ton */ } ui.showPrompt('Die Streife hat dich gesehen — lauf! (oder ab ins Gedränge)'); }
    if (r.event === 'lost') { try { audio?.bark?.('pong', 'sichtung', { pan: panFor(s.group) }); } catch (e) { /* ohne Ton */ } if (mode === 'free') ui.showPrompt(null); }
    if (r.event === 'caught' && !busy && !isArrested(game)) {
      game = arrestNow(game); refreshHud();
      sfx('verhaftet'); try { audio?.bark?.('pong', 'verhaftung', { pan: panFor(s.group) }); } catch (e) { /* ohne Ton */ }
      dialog = null; ui.hideBubble();
      s.patrol = { ...s.patrol, mode: 'return', lost: 0 };
      verhaftetZurBar();
    }
    // Sichtung (ohne Verkauf): Pfiff + Funkspruch, alle 8 s höchstens einmal, nur ab Heat 1
    if (s.sees && game.heat >= 1 && now > sightCooldown) {
      sightCooldown = now + 8000;
      sfx('pfeife');
      try { audio?.bark?.('pong', 'sichtung', { pan: panFor(s.group) }); } catch (e) { /* ohne Ton */ }
    }
    applyCop(s);
  }
}
let mentorFolge = null; // laufende Blasenfolge
let mentorIdx = 0;
function startMentor() {
  // abends an der Bar: Abendgespräch (Rückblick + Abschied), kein Nachschub
  if (mentorAmTresen) { startBarAbend(); return; }
  mentorFolge = mentorSzene(game, mentorSz, lineIdx++);
  mentorIdx = 0;
  talking = mentorRef;
  for (const key in keys) keys[key] = false;
  clickTarget = null;
  mode = 'mentor';
  ui.showPrompt(null);
  ui.hideBarks();
  sfx('talk');
  showMentorStep();
}
function showMentorStep() {
  const e = mentorFolge[mentorIdx];
  const last = mentorIdx === mentorFolge.length - 1;
  ui.showBubble({ text: e.text, options: [last ? 'Danke' : 'Weiter'] }, e.titel ? `Mentor — ${e.titel}` : 'Mentor', 0);
  try { const pan = panFor(mentorRef.group); const r = audio?.bark?.('mentor', e.bark, { pan }); if (!r) audio?.babble?.('mentor', e.text.slice(0, 40), { pan }); } catch (err) { /* ohne Ton */ }
}
function advanceMentor() {
  if (!mentorFolge) return;
  if (mentorIdx < mentorFolge.length - 1) { mentorIdx++; showMentorStep(); return; }
  const before = game;
  game = finishMentor(game, mentorFolge);
  if (game.ware > before.ware) sfx('kasse');
  refreshHud();
  mentorFolge = null;
  ui.hideBubble();
  stopBabble();
  mode = 'free';
}
// Touch: Joystick links (weit ausgelenkt = rennen), Buttons rechts; Mathe in logic.joystickInput
let joy = null;
const touch = ui.createTouchControls({
  onJoystick: (dx, dy) => { joy = dx === null ? null : joystickInput(dx, dy, { radius: touch.radius }); if (joy) clickTarget = null; },
  onTalk: () => { sfx('talk'); if (mode === 'dialog') confirmDialog(); else if (mode === 'mentor') advanceMentor(); else if (mode === 'info') endInfo(); else if (mode === 'bar') advanceBar(); else if (nearK && mode === 'free') startTalk(nearK); else if (nearMentor && mode === 'free') startMentor(); else if (nearPoint && mode === 'free') usePoint(nearPoint); },
  onLook: () => { sfx('talk'); if (nearK || mode === 'inspect') toggleInspect(); },
  onCamLeft: (down) => { keys.rotL = down; },
  onCamRight: (down) => { keys.rotR = down; },
});
if (TOUCH) touch.show();
window.addEventListener('keydown', (e) => {
  if (mode === 'arrest' || mode === 'card') { if (e.code === 'Enter' || e.code === 'Space') { startNewDay(); e.preventDefault(); } return; }
  if (mode === 'dialog') { dialogKey(e); return; }
  if (mode === 'mentor') { if (['Enter', 'Space', 'KeyE', 'Digit1'].includes(e.code)) advanceMentor(); else if (e.code === 'Escape') advanceMentor(); e.preventDefault(); return; }
  if (mode === 'info') { if (['Enter', 'Space', 'KeyE', 'Digit1', 'Escape'].includes(e.code)) endInfo(); e.preventDefault(); return; }
  if (mode === 'bar') { if (['Enter', 'Space', 'KeyE', 'Digit1'].includes(e.code)) advanceBar(0); else if (['Digit2', 'Escape'].includes(e.code)) advanceBar(1); e.preventDefault(); return; }
  if (e.code === KEY_TALK && nearMentor && mode === 'free') { startMentor(); e.preventDefault(); return; }
  if (e.code === KEY_TALK && nearPoint && !nearK && mode === 'free') { usePoint(nearPoint); e.preventDefault(); return; }
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
const ray = new THREE.Raycaster(); ray.camera = camera; // Sprites (Lichterketten-Halos) brauchen die Kamera beim Raycast
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
  else if (mode === 'mentor') advanceMentor();
  else if (mode === 'info') endInfo();
  else if (mode === 'bar') advanceBar(i);
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
    const inSicht = inPostenSicht(state, POSTEN_ZONE);
    const r = chooseOption(game, dialog, talking.def, dialog.options[selected], lineIdx++, { posten: POSTEN_ZONE, pos: state });
    game = r.state; dialog = r.dialog;
    if (game.heat > heatBefore) { sfx('alarm'); if (inSicht) { sfx('pfeife'); pongSay('sichtung'); } }
    // Streife hat den Verkauf gesehen (egal an wen): Heat +1, Pfiff
    if ((dialog.result === 'kauf' || dialog.result === 'reveal') && streifeSieht()) {
      const sp = patrolSpotted(game, { selling: true });
      game = sp.state; refreshHud();
      const zeuge = streifen.find((st) => st.sees) || streifen[0];
      sfx('pfeife'); try { audio?.bark?.('pong', 'sichtung', { pan: panFor(zeuge.group) }); } catch (e) { /* ohne Ton */ }
    }
    refreshHud();
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
  if (isArrested(game)) { sfx('verhaftet'); verhaftetZurBar(); return; }
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
function endDay(vorspann = null, { fuss = null } = {}) {
  dialog = null;
  ui.hideBubble();
  ui.showPrompt(null);
  mode = 'card';
  sfx('feierabend');
  const c = dayEndCard(game, texte, lineIdx++);
  ui.showCard({ titel: c.titel, zeilen: [...(vorspann ? [vorspann] : []), c.spruch, ...c.zeilen, ...(fuss ? [fuss] : [])], button: c.button, rot: c.lage === 'verhaftet' });
}
function startNewDay() {
  game = newDay(game, { nacht: nachtArt });
  nachtArt = 'bar';
  tagesuhr = initialClock();
  applyTageszeit();
  placeMentor(false);
  for (const s of streifen) s.patrol = { ...patrolStart(s.route), mode: 'patrol' };
  soldOutShown = false;
  refreshHud();
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
const groundY = (x, z) => world.huegel.height(x, z);
function applyPose(st) {
  player.position.set(st.x, groundY(st.x, st.z), st.z);
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
  // Kamera hebt sich mit dem Gelände unter dem Blickpunkt (Hügel), Strand = 0
  const hy = groundY(cam.tx, cam.tz);
  camera.position.set(cam.x, cam.y + hy, cam.z);
  camera.lookAt(cam.tx, cam.ty + hy, cam.tz);
  const o = licht.sunOffset(lichtT(tagesuhr.t01)); // Sonne wandert über den Tag (abends flach aus Westen)
  sunLight.position.set(state.x + o.x, o.y, state.z + o.z);
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
const fadeRay = new THREE.Raycaster(); fadeRay.camera = camera;
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
    const target = tmpV.set(focus.x, h + groundY(focus.x, focus.z), focus.z);
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
let sunsetAt = 0;
let zwischenrufAt = 0, warAmTresen = false;
let tafelAt = 0, tafelShown = -1;

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
  k.group.userData.pose = null; // Pose nach dem Gag neu setzen
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
  if (!nearK && nearMentor) {
    const txt = mentorBesucht(game) ? 'Mentor — E: kurz hallo sagen' : (TOUCH ? '💬 Reden: dem Mentor zuhören (Lektion + Nachschub)' : 'Mentor — E: zuhören (Lektion + Nachschub)');
    ui.showPrompt(txt); ui.showBadge(null); ui.pulseButtons({ talk: true }); return;
  }
  if (!nearK && nearPoint) {
    const txt = nearPoint.id === 'mango_stand' ? 'Mango-Stand — E: Mango kaufen (10 Münzen)' : nearPoint.id === 'tuktuk' ? `Tuk-Tuk — E: zur Bar (${TUKTUK_PREIS_MANGOS} Mangos oder ${TUKTUK_PREIS_GELD} Münzen)` : (game.mangos > 0 ? 'Pong — E: Mango abgeben (1 Mango = 1 Gnade)' : 'Pong — E: ansprechen');
    ui.showPrompt(txt); ui.showBadge(null); ui.pulseButtons({ talk: true }); return;
  }
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

// ---------- Fähre: wer mit der Fähre kommt (Spawn-Code K1), steigt beim Anlegen am Steg aus und geht zu seinem Platz ----------
let ferryWasDocked = false;
let ferryHorn = false;
function updateFerry(t) {
  if (!world.pier?.ferry) return;
  const f = world.pier.ferry(t);
  const docked = f.state === 'docked';
  if (f.horn && !ferryHorn) sfx('tuten'); // Fährhorn, wenn das Pier-Modul es vorgibt (kurz vor dem Anlegen, beim Ablegen)
  ferryHorn = !!f.horn;
  if (docked && !ferryWasDocked) {
    const sp = world.pier.ferrySpawn;
    for (const k of kunden) {
      if (k.def.spawn !== 'K1' || k.arrived) continue;
      k.arrived = true;
      k.group.visible = true; k.collider.r = 0.7;
      k.npc = { ...k.npc, x: sp.x, z: sp.z, points: [{ x: sp.x, z: sp.z }, { x: k.anchor.x, z: k.anchor.z }], idx: 1, pause: 1.5 + Math.random(), moving: false };
      k.group.userData.pose = null;
    }
  }
  ferryWasDocked = docked;
  // Tuk-Tuk-Gag: Motor säuft synchron zum 8-s-Takt des Pier-Moduls ab (Zyklusbeginn), nur in Hörweite
  const tt = world.pier.tuktuk;
  const k = t % 8;
  if (tt && k < tuktukLastK) {
    const dist = Math.hypot(tt.x - state.x, tt.z - state.z);
    if (dist < 18) sfx('tuktuk', { gain: 1 - dist / 18, pan: panFor(POINTS.find((pt) => pt.id === 'tuktuk')?.obj) }); // Abstands-Lautstärke + Stereo
  }
  tuktukLastK = k;
}
let tuktukLastK = 0;

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
  // ?t= (Uhr-t) gilt auch ohne Szene; HUD mit Uhr auffrischen, bevor eine Szene früh zurückkehrt
  if (T01) { tagesuhr = { t01: Math.max(0, Math.min(1, parseFloat(T01))) }; applyTageszeit(); placeMentor(barBeendetTag(tagesuhr.t01)); }
  refreshHud();
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
  if (SCENE === 'verfolgung') {
    // Streife hinter dem Spieler her, Heat 2
    state = { ...state, x: 24, z: -78, yaw: Math.PI / 2, speed: 0 };
    streifen[0].patrol = { ...streifen[0].patrol, x: 18, z: -78.5, yaw: Math.PI / 2, mode: 'chase', lastSeen: { x: 24, z: -78 }, lost: 0, moving: true, phase: 1.1 };
    game = { ...game, heat: 2 };
    refreshHud();
    streifen[0].sees = true;
    applyCops();
    ui.showPrompt('Die Streife hat dich gesehen — lauf! (oder ab ins Gedränge)');
    mode = 'free';
    return;
  }
  if (SCENE === 'nong') {
    // Nong grüßt (eine Braue hoch), Bar-Kamera
    tagesuhr = { t01: 0.74 }; applyTageszeit(); placeMentor(true); refreshHud();
    state = { ...state, ...barStehplatz(), speed: 0 };
    startBarAbend(); // Schritt 0 = Nongs Gruß
    return;
  }
  if (SCENE === 'bar') {
    tagesuhr = { t01: 0.78 }; applyTageszeit(); placeMentor(true);
    game = { ...game, geld: 95, verkauftHeute: 4, geldHeute: 95, heat: 1 }; refreshHud();
    state = { ...state, ...barStehplatz(), speed: 0 };
    startBarAbend(); barIdx = 1; showBarStep(); // Mentor-Rückblick
    return;
  }
  if (SCENE === 'abend') {
    tagesuhr = { t01: 0.72 }; applyTageszeit(); placeMentor(true); refreshHud();
    state = { ...state, x: world.spots.bar.x + 2, z: world.spots.bar.z + 3, yaw: Math.PI, speed: 0 };
    ui.showBark('spieler', sonnenuntergangLine(abendTexte, 0), 999);
    mode = 'free';
    return;
  }
  if (SCENE === 'streife') {
    // Streife auf der Straße am Posten, Spieler davor im Sichtkegel
    streifen[0].patrol = { ...streifen[0].patrol, x: 12, z: -78, yaw: Math.PI / 2, idx: 2, moving: true, phase: 2.2 };
    state = { ...state, x: 18, z: -77, yaw: -Math.PI / 2, speed: 0 };
    game = { ...game, heat: 1 };
    refreshHud();
    streifen[0].sees = seesTarget(streifen[0].patrol, state);
    applyCops();
    mode = 'free';
    return;
  }
  if (SCENE === 'streife2') {
    // Tag 2: Streife P2 watet auf dem Steinbogen der Furt, Spieler schaut vom Hotelstrand zu
    game = { ...game, tag: 2, heat: 1 }; refreshHud();
    const p2 = streifen[1];
    const m = STREIFE_P2_ROUTE[5]; // mitten auf dem Bogen
    p2.patrol = { ...p2.patrol, x: m.x, z: m.z, yaw: Math.PI / 2, idx: 6, moving: true, phase: 1.5 };
    state = { ...state, x: 55, z: 8, yaw: Math.atan2(m.x - 55, m.z - 8), speed: 0 };
    p2.sees = seesTarget(p2.patrol, state);
    applyCops();
    mode = 'free';
    return;
  }
  if (SCENE === 'mango') {
    const pt = POINTS[0];
    state = { ...state, x: pt.x + 0.4, z: pt.z + 1.2, yaw: Math.PI, speed: 0 };
    game = { ...game, geld: 35 };
    usePoint(pt); // kauft eine Mango und zeigt die Blase
    return;
  }
  if (SCENE === 'mentor' && mentorRef) {
    const sp = world.spots.garten;
    state = { ...state, x: mentorRef.npc.x + 1.2, z: mentorRef.npc.z + 2.6, yaw: Math.PI, speed: 0 };
    game = { ...game, ware: 1, heat: 2 };
    refreshHud();
    startMentor();
    mentorIdx = Math.min(2, mentorFolge.length - 1); // Lektion: Regel
    showMentorStep();
    void sp;
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
    refreshHud();
    endDay();
    return;
  }
  if (SCENE === 'ausverkauft') {
    game = { ...game, ware: 0, verkauftHeute: START_WARE, geldHeute: 120, geld: 120 };
    refreshHud();
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
    if (overview) { cam = { x: 12, y: 135, z: -160, tx: 12, ty: 0, tz: -22 }; scene.fog = null; camera.near = 20; camera.updateProjectionMatrix(); } // Übersicht ohne Nebel; near 20 gegen Tiefen-Streifen (Gras über Sand) in der Ferne
    if (mode === 'inspect') {
      cam = inspectCamera(talking.npc, state, inspectOpts(talking));
      talking.npc.yaw = Math.atan2(cam.x - talking.npc.x, cam.z - talking.npc.z);
      applyKunde(talking);
    }
    if (SCENE === 'lineup') cam = { x: 0, y: 3.2, z: 6 + 16.5, tx: 0, ty: 1.2, tz: 6 };
    if (mode === 'bar') cam = barCamera();
    applyCamera();
    camera.updateMatrixWorld();
    world.huegel.update(3.2);
    world.markt?.update?.(3.2);
    world.pier?.update?.(3.2);
    try { updateNong(world.nong, 3.2); } catch (e) { /* ohne Figur */ }
    if (SCENE !== 'streife' && SCENE !== 'verfolgung' && SCENE !== 'streife2') applyCops();
    try { world.markt?.setTafel?.(0); } catch (e) { /* ignorieren */ }
    world.group.updateMatrixWorld(true);
    kundenGroup.updateMatrixWorld(true);
    updateFade(mode === 'inspect' ? talking.npc : state);
    const shoot = () => {
      resize(); camera.updateMatrixWorld();
      if (SCENE === 'badge' || SCENE === 'hint' || SCENE === 'bark') { const near = nearestKunde(state, kundenPos()); nearK = near ? near.ref : null; updateNearHint(); placeBarks(); }
      if (mode === 'dialog' || mode === 'mentor' || mode === 'info' || mode === 'bar') placeBubbleAtHead();
      renderer.render(scene, camera);
      requestAnimationFrame(() => { resize(); if (mode === 'dialog' || mode === 'mentor' || mode === 'info' || mode === 'bar') placeBubbleAtHead(); renderer.render(scene, camera); stats(); });
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
    if (!mentorAmTresen) world.huegel.update(now / 1000);
    world.markt?.update?.(now / 1000);
    world.pier?.update?.(now / 1000);
    try { updateNong(world.nong, now / 1000); } catch (e) { /* ohne Figur */ }
    if (nongMoodAt && now > nongMoodAt) nongSag(nongBaseMood());
    updateFerry(now / 1000);
    if (now > tafelAt) { tafelAt = now + 500; const n = isArrested(game) ? 0 : (game.tageOhneVorfall || 0); if (n !== tafelShown) { tafelShown = n; try { world.markt?.setTafel?.(n); } catch (e) { /* ignorieren */ } } }
    const free = mode === 'free' || mode === 'inspect'; // dialog/mentor/info/card: stehen bleiben
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
      state = stepPlayer(state, { dir, run }, dt, colliders, WORLD, { schuhe: PLAYER_SCHUHE });
      if (state.stumbled) sfx('schritt');
    } else {
      state = stepPlayer(state, { dir: null, run: false }, dt, colliders);
    }
    applyPose(state);
    if (free) {
      const prev = tagesuhr.t01;
      tagesuhr = clockStep(tagesuhr, dt);
      applyTageszeit();
      if (abendBeginnt(prev, tagesuhr.t01)) { placeMentor(true); sunsetAt = 0; }
      // Nong tagsüber: ein Zwischenruf pro Vorbeigehen am Tresen, höchstens alle 30 s
      const amTresen = inBar(state, BUILDING_POS.bar, 5);
      if (amTresen && !warAmTresen && !barBeendetTag(tagesuhr.t01) && now > zwischenrufAt) { zwischenrufAt = now + 30000; ui.showBark('barkeeper', zwischenrufLine(abendTexte, lineIdx++), 3.2); nongSag('gruss', now); try { audio?.bark?.('barkeeper', 'zwischenruf', { pan: panFor(barkeeperObj) }); } catch (e) { /* ohne Ton */ } }
      warAmTresen = amTresen;
      if (barBeendetTag(tagesuhr.t01) && now > sunsetAt) { sunsetAt = now + 20000; ui.showBark('spieler', sonnenuntergangLine(abendTexte, lineIdx++), 4); }
      if (nachtBeginnt(prev, tagesuhr.t01)) { nachtArt = 'haengematte'; sfx('gaehnen'); endDay(einschlafenLine(abendTexte, lineIdx++)); }
      if (Math.floor(prev * 1000) !== Math.floor(tagesuhr.t01 * 1000)) refreshHud();
    }
    updatePatrol(dt, now);
    // Schritt im Sand: jede volle Watschel-Periode (1.6 Einheiten ≈ 0.4 s Gehen)
    if (state.moving && Math.floor(state.phase / (Math.PI * 2)) !== Math.floor(lastStepPhase / (Math.PI * 2))) sfx('schritt');
    lastStepPhase = state.phase;
    if (audio && gestureSeen && !audioStarted && now > audioRetryAt) { audioRetryAt = now + 2000; startAudio(); }
    updateAmbience(now);
    updateKunden(dt);

    // Nähe + Prompt
    const near = nearestKunde(state, kundenPos());
    const prevNear = nearK;
    nearK = near ? near.ref : null;
    nearMentor = !!mentorRef && Math.hypot(mentorRef.npc.x - state.x, mentorRef.npc.z - state.z) < TALK_DIST + 1;
    nearPoint = POINTS.find((pt) => Math.hypot(pt.x - state.x, pt.z - state.z) < pt.r) || null;
    if (nearK && nearK !== prevNear && mode === 'free') bark(nearK, 'gruss'); // Gruß beim Näherkommen
    placeBarks();
    if (mode === 'free') updateNearHint();
    else { ui.showBadge(null); ui.pulseButtons(null); }
    if (mode === 'inspect' && talking) {
      const d = Math.hypot(talking.npc.x - state.x, talking.npc.z - state.z);
      if (d > TALK_DIST + 1.5) endInspect(); // Weggehen beendet das Hinschauen
    }

    // Kamera: Folge-Kamera oder Hinschau-Kamera (weich)
    if ((mode === 'inspect' && talking) || mode === 'bar') {
      const want = mode === 'bar' ? barCamera() : inspectCamera(talking.npc, state, inspectOpts(talking));
      const t = 1 - Math.exp(-5 * dt);
      for (const key of ['x', 'y', 'z', 'tx', 'ty', 'tz']) cam[key] += (want[key] - cam[key]) * t;
    } else {
      cam = followCamera(cam, state, dt, camYaw);
    }
    applyCamera();
    camera.updateMatrixWorld();
    updateFade(mode === 'inspect' && talking ? talking.npc : state);
    if (mode === 'dialog' || mode === 'mentor' || mode === 'info' || mode === 'bar') placeBubbleAtHead();
    renderer.render(scene, camera);
    stats();
  });
}
