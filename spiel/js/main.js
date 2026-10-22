// main.js — Szene, Eingabe, Spielschleife, Folge-Kamera, prozedurales Watscheln, Kundschaft + Mechanik v0,
// Snap-Modus (?snap=1, &at=…, &cy=…, &scene=dialog|inspect).
import * as THREE from 'three';
import { buildWorld } from './world.js';
import { schluffi } from './figures.js';
import { buildKunde, setMood, setRevealed, holdPose, setRegen } from './kunden.js';
import { kundenExtras, updateKundenExtras } from './figures.js';
import { pose as figurePose, updateNong, setNongMood } from './figures.js';
import * as FIG from './figures.js'; // buildKokosVerkaeufer/setRuf kommen aus figures.js, sobald vorhanden
import { initLicht } from './licht.js';
import { zielMarker, updateMarker } from './marker.js';
import { ereignisSteuerung } from './ereignisse.js';
import { createSpuren } from './spuren.js';
import { normalizeSzenen, szenenDesTages, szenenAktiv, szeneSchritte, szeneAnsprechen, szenenWirkung, inStolperZone, zeitT } from './szenen.js';
import { buildAmbientFigur, stolpern, handtuchAufLiege, handtuchRolle, handtuchPlan, sandburgKaputt, bierdosenHaufen } from './ambient.js';
import { setHuetteZiel, setHuette, setWegweiserText, coconut, lounger } from './props.js';
import { feuerwerk } from './feuerwerk.js';
import { mentorBarSpot } from './zone-huegel.js';
import { createUI, isTouchDevice, hintSeen, markHint } from './ui.js';
import { prepareGags, playGag, stopGag } from './gags.js';
import {
  inputToDir, dirToTarget, stepPlayer, followCamera, waddlePose, CAM_OFFSET, DEFAULT_CAM_YAW, isOccluder, joystickInput, rotateDir,
  ANCHORS, assignAnchors, zoneMix, patrolStart, seesTarget, chaseStep, inHideout, CHASE_SPEED, PATROL_SPEED, WORLD, BUILDING_POS, STREIFE_P2_ROUTE,
  CAM_PITCH, clampPitch, spurSchritt, imSand, kokosStart, kokosStep, kokosRuf, ballStep, shoreZ,
} from './logic.js';
import { LANES as PIER_LANES, FERRY_SPAWN } from './zone-pier-layout.js';
import { DORF_SPOTS } from './zone-dorf-layout.js';
import { MARKT_SPOTS } from './zone-markt-layout.js';
import {
  initialState, normalizeKatalog, pickKunden, startDialog, advanceDialog, chooseOption, isArrested, newDay, moodFor,
  kundeStatus, nearestKunde, wanderStep, inspectCamera, kundeLookYaw, TALK_DIST, idSeed,
  normalizeTexte, soldOutDialog, isSoldOut, dayEndCard, assignOutfits, START_WARE, gagFor, nextIdleGagDelay,
  mergeTexte, mergeKundenKatalog, normalizeOptionen, toSave, fromSave, hatFortschritt, fillText, dayReport, buyKokos, kokosSchutz, normalizeKokos, kokosGag, kokosWirkung, pickLine,
  normalizeTutorial, tutorialStart, tutorialEvent, tutorialSkip,
  normalizeWoche, tagesziel, tagModifikator, hudZiel, finaleStufe, harmloseFuerTag, kalibriereWoche, neueWoche, finaleKarte, besucherWahl, besucherStep, KOPF_WAHL,
  normalizeEreignisse, ereignisFuerTag, ereignisKundenFaktor, ereignisZiviExtra, kundenFuerTag, ereignisFenster,
  normalizeStimmen, barksFor, pickBark,
  normalizeMentorSzene, mentorSzene, finishMentor, mentorBesucht,
  normalizePosten7, buyMango, giveMango, mangoText, pongText, inPostenSicht, patrolSpotted, normalizeKunde, arrestNow, tukTukRide, TUKTUK_PREIS_MANGOS, TUKTUK_PREIS_GELD,
  initialClock, clockStep, clockLabel, phaseFor, abendBeginnt, nachtBeginnt, barBeendetTag, inBar, normalizeAbend, zwischenrufLine, STREIFE_P2_AB_TAG, lichtT, barAbend, guteNacht, sonnenuntergangLine, einschlafenLine,
} from './game.js';
import { POSTEN as POSTEN_LAYOUT, MARKT as MARKT_AREA, STAENDE, LANES as MARKT_LANES } from './zone-markt-layout.js';
import { HAFENPLATZ } from './zone-pier-layout.js';

// Tastenbelegung (Konstanten, einfach umzulegen): F = ansprechen (Gespräch mit Blick aufs Gesicht), Kamera Q/E (R = Alias)
const KEY_TALK = 'KeyF';
const KEY_CAM_LEFT = 'KeyQ';
const KEY_CAM_RIGHT = 'KeyE';
const KEY_CAM_RIGHT_ALIAS = 'KeyR';
const KEY_CAM_UP = 'KeyT';   // Kamera steiler (Draufsicht)
const KEY_CAM_DOWN = 'KeyG'; // Kamera flacher (mehr Welt)

// Parameter per Regex, weil der Screenshot-Aufruf „?snap=1“ hinter andere Parameter hängt (…?at=bar?snap=1)
const q = (name) => (location.search.match(new RegExp('[?&]' + name + '=([-a-z0-9._]+)')) || [])[1];
const SNAP = q('snap') === '1';
const STATS = q('stats') === '1';
const AT = q('at');
const CY = q('cy'); // Kamera-Gierung in Grad relativ zum Standard, z. B. ?at=hotel&cy=-90 (Kamera im Osten, Blick nach Westen)
const SCENE = q('scene'); // dialog | inspect | lineup | ausverkauft | bilanz | gag | mentor | mango | streife | abend (nur Snap)
const T01 = q('t'); // Tageszeit 0..1 für Snaps
const TAG = q('tag'); // Spieltag für Snaps (Szenen laufen ab Tag 2)
const PITCH = q('pitch'); // Kamera-Neigung in Grad für Snaps
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

let player = schluffi();
scene.add(player);
let P = player.userData.parts;
// Figurenwahl: Schluffi mit anderer Kopfbedeckung neu bauen (Kokosnuss in der Hand wandert mit)
function setzeSchluffi(kopf) {
  const alt = player;
  player = schluffi({ kopf }); player.position.copy(alt.position); player.rotation.copy(alt.rotation);
  scene.remove(alt); scene.add(player);
  P = player.userData.parts;
  if (P.arms?.[0] && typeof spielerNuss !== 'undefined') P.arms[0].add(spielerNuss);
  game = { ...game, kopf };
}

// ---------- Zustand ----------
const startSpot = world.spots[AT] || world.spots.start;
let state = { x: startSpot.x, z: startSpot.z, yaw: startSpot.yaw, phase: 0, speed: 0 };
let camYaw = DEFAULT_CAM_YAW + (CY ? parseFloat(CY) * Math.PI / 180 : 0);
let cam = { x: state.x, y: CAM_OFFSET.up, z: state.z - CAM_OFFSET.back, tx: state.x, ty: CAM_OFFSET.targetY, tz: state.z };
let clickTarget = null;

const neuerSeed = () => 1 + Math.floor(Math.random() * 999983); // Spielstand-Seed: Tages-Ereignisse sind damit je Spiel verschieden, aber reproduzierbar
let game = { ...initialState(), seed: neuerSeed() };
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
const sfx = (name, opts) => { try { return audio?.sfx?.(SFX[name] || name, opts) ?? 0; } catch (e) { return 0; } }; // Rückgabe: Dauer in s (Gesang), sonst 0
const muteBtn = ui.createMuteButton((m) => { optionen = { ...optionen, ton: !m }; saveOptionen(); try { audio?.setMuted?.(m); } catch (e) { /* ignorieren */ } });
let paintMusic = null;
function applyAudioOptionen() {
  try { audio?.setMuted?.(!optionen.ton); muteBtn.set(!optionen.ton); audio?.music?.setEnabled?.(optionen.musik); paintMusic?.(); } catch (e) { /* ignorieren */ }
}
let audioStarted = false;
function startAudio() {
  try { audio?.preloadAusrufe?.('alle'); } catch (e) { /* ohne Clips */ } // Clips dekodieren, sobald eine Geste da ist
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
const REISFELD_ZONE = { x: -36.75, z: -85.25, r: 16 }; // Frösche, Wasser (Mitte des Reisfeld-Layouts)
const ZONE_DEFS = () => ({ markt: MARKT_ZONE, posten: POSTEN_ZONE, pier: PIER_ZONE, bar: BAR_ZONE, reisfeld: REISFELD_ZONE });
function updateAmbience(now) {
  if (!audio?.ambience?.setZone || now < ambienceAt) return;
  ambienceAt = now + 250;
  try { audio.ambience.setZone(zoneMix(state, ZONE_DEFS())); } catch (e) { /* ignorieren */ }
}
import('./audio.js').then((m) => {
  audio = m;
  try { audio.initAudio?.(); audio.loadStimmen?.(); audio.loadAusrufe?.(); } catch (e) { /* ignorieren */ } // Ausrufe: Manifest + data/ausrufe.json
  const el = document.getElementById('mute');
  if (el) el.style.display = 'block';
  const mb = document.getElementById('music');
  if (mb && audio.music?.setEnabled) {
    mb.style.display = 'block';
    const paint = () => { const on = audio.music.isEnabled ? audio.music.isEnabled() : true; mb.textContent = on ? '🎵' : '🎵̸'; mb.classList.toggle('muted', !on); };
    paintMusic = paint;
    mb.addEventListener('click', () => { try { optionen = { ...optionen, musik: !optionen.musik }; saveOptionen(); audio.music.setEnabled(optionen.musik); paint(); sfx('talk'); } catch (e) { /* ignorieren */ } });
  }
  applyAudioOptionen(); // gespeicherte Optionen (Ton/Musik) gelten ab dem Start
  if (gestureSeen) startAudio();
}).catch(() => { /* kein Audio-Modul → stumm */ });
let gestureSeen = false;
const firstGesture = () => { gestureSeen = true; startAudio(); setTimeout(startAudio, 300); };
window.addEventListener('pointerdown', firstGesture, { once: true });
window.addEventListener('keydown', firstGesture, { once: true });
// ---------- Optionen (⚙): Textsprache, Zivi-Beschlagnahme, Musik, Ton — im Browser gemerkt (privater Modus: nur für die Sitzung) ----------
const OPT_KEY = 'bangi.optionen';
let optionen = normalizeOptionen((() => { try { return JSON.parse(localStorage.getItem(OPT_KEY) || 'null'); } catch (e) { return null; } })());
const LANG = q('lang'); // ?lang=en für Snaps
if (LANG) optionen = { ...optionen, sprache: LANG === 'en' ? 'en' : 'de' };
function saveOptionen() { try { localStorage.setItem(OPT_KEY, JSON.stringify(optionen)); } catch (e) { /* privat/gesperrt */ } }
// Kamera-Neigung: aus den Optionen (Grad), ?pitch= für Snaps; Änderungen werden gesammelt gespeichert
let camPitch = clampPitch((PITCH ? parseFloat(PITCH) : optionen.neigung) * Math.PI / 180);
let pitchSaveAt = 0;
function setPitch(p) { camPitch = clampPitch(p); pitchSaveAt = performance.now() + 800; }
function flushPitch(now) { if (pitchSaveAt && now > pitchSaveAt) { pitchSaveAt = 0; const g = Math.round(camPitch * 180 / Math.PI); if (g !== optionen.neigung) { optionen = { ...optionen, neigung: g }; saveOptionen(); } } }
// Spielstand: automatisch beim Tageswechsel (Morgenstand), Startkarte „Weiter“/„Neues Spiel“ wenn einer da ist
const SAVE_KEY = 'bangi.spielstand';
function saveGame() { try { localStorage.setItem(SAVE_KEY, JSON.stringify({ ...toSave(game), zeit: new Date().toISOString() })); } catch (e) { /* privat/gesperrt */ } }
function readSave() { try { return JSON.parse(localStorage.getItem(SAVE_KEY) || 'null'); } catch (e) { return null; } }
function clearSave() { try { localStorage.removeItem(SAVE_KEY); } catch (e) { /* ignorieren */ } }
async function fetchJson(url) { try { const res = await fetch(url, { cache: 'no-store' }); return res.ok ? await res.json() : null; } catch (e) { return null; } }
let texte = normalizeTexte(null);
let abendTexte = normalizeAbend(null);
let tutorialTexte = normalizeTutorial(null);
let kokosTexte = normalizeKokos(null); // Mister Coconut (texte.json → kokosverkaeufer{})
// ---------- Ambient-Szenen (data/szenen.json): Zeitplan/Zustand in szenen.js, hier Schritte auslösen und Wirkung anwenden ----------
let szenen = normalizeSzenen(null);
let szenenHeute = []; // Szenen des Tages (Chance deterministisch aus dem Seed)
let szenenLauf = {}; // id → zuletzt abgespielte Sekunde (damit jeder Ablauf-Schritt einmal kommt)
let szenenWirk = szenenWirkung([]);
let szeneNah = null; // aktive Szene in Reichweite (E = ansprechen)
let szenenGelaufen = []; // Szenen, die heute liefen (Bar-Kommentar abends)
async function loadSzenen() { const json = await fetchJson('./data/szenen.json'); szenen = normalizeSzenen(json); planeSzenen(); }
// Szenen-Ort: Spot-Name (strand|markt|posten|pier|steg|bar|liegen|dorf|…) oder {x,z,r} → Weltposition mit Radius
const SZENE_ORT = (ort) => (ort && typeof ort === 'object' ? ort : { r: 5, ...({ strand: world.spots.mitte }[ort] || world.spots[ort] || world.spots.start) });
// Szenen-Sounds, die im Fenster von selbst laufen (Slug → Pause zwischen zwei Durchläufen in s, Hörradius); Schritt-Sounds laufen über `sound`-Schritte
const SZENE_SOUND_TAKT = { schnarchen_pong: { pause: [0.4, 0.8], radius: 18 }, kinder_kreischen: { pause: [15, 30], radius: 45 }, streit_duo: { pause: [8, 15], radius: 33 } };
let szenenSoundAt = {}; // Slug → nächster Start (ms)
let pongSchlief = false;
// Szenen-Figuren (ambient.js): Aufstellung je Szene relativ zum Ort (dx/dz, Blick yaw); kreis = Kinder laufen im Kreis um den Ort (Startwinkel)
const szenenGroup = new THREE.Group(); scene.add(szenenGroup);
const szenenFiguren = {}; // szene.id → { slug → Figur-Zustand, _req: Requisiten, _plan: Handtuch-Plan }
const SZENE_AUFSTELLUNG = {
  kinder: { kind_1: { kreis: 0 }, kind_2: { kreis: 2.1 }, kind_3: { kreis: 4.2 } },
  ehepaar: { ehe_sie: { dx: -2, dz: -3.5, yaw: 1.1 }, ehe_er: { dx: 0.5, dz: -3.5, yaw: -1.1 } }, // vor den Hotel-Liegen, einander zugewandt
  handtuch_werfer: { werfer_1: { dx: -2, dz: -9.5, yaw: 0 }, werfer_2: { dx: 0, dz: -9.5, yaw: 0.3 } }, // Hotelseite, Blick auf die Liegen
  betrunkener: { chad: { dx: 2, dz: -3.3, yaw: Math.PI } }, // am Tresen
  influencerin: { influencerin: { dx: 0, dz: 2, yaw: Math.PI }, reflektor_freund: { dx: 1.6, dz: 1.5, yaw: -Math.PI / 2 } }, // Rücken zum Meer
};
const KINDER_KREIS = { r: 2.5, w: 1.0 }; // Radius, Winkelgeschwindigkeit (rad/s)
const MEER_WEG = 9; // ehe_er „geht tauchen“: so weit Richtung Meer (+z)
function szeneAufbauen(szene) {
  if (szenenFiguren[szene.id]) return;
  const o = SZENE_ORT(szene.ort), auf = SZENE_AUFSTELLUNG[szene.id] || {};
  const F = szenenFiguren[szene.id] = { _req: [], _plan: null };
  for (const fig of szene.figuren) {
    if (fig.slug === 'pong') continue; // Pong ist die Markt-Figur (pongPose)
    let g = null; try { g = buildAmbientFigur(fig.slug, fig.aussehen); } catch (e) { g = null; }
    if (!g) continue;
    const a = auf[fig.slug] || { dx: 0, dz: 0, yaw: 0 };
    const start = fig.start ? SZENE_ORT(fig.start) : o;
    const f = { slug: fig.slug, stimme: fig.stimme, g, x: start.x + (a.dx || 0), z: start.z + (a.dz || 0), yaw: a.yaw || 0, ziel: null, speed: 1.2, kreis: a.kreis !== undefined ? { cx: o.x, cz: o.z, ang: a.kreis } : null, stehtBis: 0, yawZiel: null, geworfen: false };
    f.x0 = f.x; f.z0 = f.z; f.yaw0 = f.yaw;
    f.seit = performance.now() / 1000; g.scale.setScalar(0.01); // wächst in 0,6 s auf, statt ins Bild zu poppen
    g.position.set(f.x, 0, f.z); g.rotation.y = f.yaw; szenenGroup.add(g); F[fig.slug] = f;
  }
  try { // Requisiten mit Baustein
    if (szene.requisite.includes('sandburg_kaputt')) { const r = sandburgKaputt(); r.position.set(o.x + 3.6, 0, o.z + 2.8); F._req.push(r); }
    if (szene.requisite.includes('bierdosen_haufen') && F.chad) { const r = bierdosenHaufen(); r.position.set(F.chad.x + 0.9, 0, F.chad.z + 0.4); F._req.push(r); }
  } catch (e) { /* ohne Requisite */ }
  for (const r of F._req) szenenGroup.add(r);
  if (szene.wirkung.liegen_belegt) F._plan = handtuchPlan(world.liegenAlle?.length || 0, game.tag); // welche Liegen heute ein Handtuch bekommen
}
function szeneAbbauen(id) {
  const F = szenenFiguren[id]; if (!F) return;
  for (const [k, f] of Object.entries(F)) { if (k.startsWith('_')) continue; szenenGroup.remove(f.g); delete szenenAnker[`szene_${id}_${k}`]; }
  for (const r of F._req) szenenGroup.remove(r);
  delete szenenFiguren[id];
}
const rollen = []; // fliegende Handtuch-Rollen { g, von, nach, t0, dauer, liege, farben }
function handtuchWerfen(f) { // Wurfmoment der Pose handtuch_werfen: nächste Liege aus dem Plan, Rolle fliegt in ~1,2 s hin
  const plan = szenenFiguren.handtuch_werfer?._plan; if (!plan?.length || !world.liegenAlle?.length) return;
  const w = plan.shift(), liege = world.liegenAlle[w.liege]; if (!liege) return;
  const g = handtuchRolle(w.farben), hand = new THREE.Vector3(0.22, -1.0, 0.25);
  try { f.g.userData.parts.arms[1].localToWorld(hand); } catch (e) { hand.set(f.x, 1.4, f.z); }
  g.position.copy(hand); szenenGroup.add(g);
  rollen.push({ g, von: hand.clone(), nach: new THREE.Vector3(liege.x, 0.6, liege.z), t0: performance.now() / 1000, dauer: 1.2, liege, farben: w.farben });
}
function updateRollen(t) {
  for (let i = rollen.length - 1; i >= 0; i--) {
    const r = rollen[i], u = Math.min(1, (t - r.t0) / r.dauer);
    r.g.position.lerpVectors(r.von, r.nach, u); r.g.position.y += 2.2 * Math.sin(u * Math.PI); r.g.userData.update(t);
    if (u >= 1) { szenenGroup.remove(r.g); rollen.splice(i, 1); try { handtuchAufLiege(r.liege.obj, r.farben); } catch (e) { /* ohne Handtuch */ } sfx('handtuch', { pan: panFor(r.liege.obj) }); }
  }
}
function handtuecherWeg() { for (const l of world.liegenAlle || []) for (const c of [...l.obj.children]) if (c.userData.farben) l.obj.remove(c); }
function updateSzenenFiguren(t, dt) {
  for (const F of Object.values(szenenFiguren)) for (const [k, f] of Object.entries(F)) {
    if (k.startsWith('_')) continue;
    const steht = t < f.stehtBis;
    if (!steht) f.yawZiel = null;
    if (f.kreis) { // Kinder: im Kreis um den Ort, bei einer Stand-Pose anhalten
      f.g.userData.rennt = !steht;
      if (!steht) { f.kreis.ang += dt * KINDER_KREIS.w; f.x = f.kreis.cx + Math.cos(f.kreis.ang) * KINDER_KREIS.r; f.z = f.kreis.cz + Math.sin(f.kreis.ang) * KINDER_KREIS.r; f.yaw = Math.atan2(-Math.sin(f.kreis.ang), Math.cos(f.kreis.ang)); }
    } else if (f.ziel) { // geh: geradeaus zum Ziel
      const dx = f.ziel.x - f.x, dz = f.ziel.z - f.z, d = Math.hypot(dx, dz), step = f.speed * dt;
      if (d <= step) { f.x = f.ziel.x; f.z = f.ziel.z; f.ziel = null; f.yaw = f.yawRuhe ?? f.yaw; } else { f.x += dx / d * step; f.z += dz / d * step; f.yaw = Math.atan2(dx, dz); }
    }
    if (f.yawZiel) f.yaw = Math.atan2(f.yawZiel.x - f.x, f.yawZiel.z - f.z);
    f.g.position.set(f.x, 0, f.z); f.g.rotation.y = f.yaw;
    if (f.seit !== undefined) { const u = Math.min(1, (t - f.seit) / 0.6); f.g.scale.setScalar(0.01 + 0.99 * u * u * (3 - 2 * u)); if (u >= 1) f.seit = undefined; }
    try { f.g.userData.update?.(t); } catch (e) { /* Figur ohne update */ }
    if (f.g.userData.ambient?.wurfMoment) { if (!f.geworfen) { f.geworfen = true; handtuchWerfen(f); } } else f.geworfen = false;
  }
  updateRollen(t);
}
const naechsteStreife = (pos, max = 14) => streifen.filter(streifeAktiv).map((s) => ({ s, d: Math.hypot(s.patrol.x - pos.x, s.patrol.z - pos.z) })).filter((x) => x.d <= max).sort((a, b) => a.d - b.d)[0]?.s || null;
function streifeStolpert(s, t, dauer = 5) { // fällt hin (ambient.js), bleibt liegen, steht auf; eine Verfolgung ist damit vorbei
  s.stolper = { t0: t, dauer };
  s.patrol = { ...s.patrol, mode: s.patrol.mode === 'chase' ? 'return' : s.patrol.mode, wait: dauer, moving: false, lost: 0, kante: false };
}
function planeSzenen() { szenenHeute = szenenDesTages(szenen, { seed: game.seed, woche: game.woche, tag: game.tag }); szenenLauf = {}; szenenGelaufen = []; for (const id of Object.keys(szenenFiguren)) szeneAbbauen(id); for (const r of rollen) szenenGroup.remove(r.g); rollen.length = 0; }
function updateSzenen(now) {
  const t = now / 1000;
  const aktive = szenenAktiv(szenenHeute, tagesuhr.t01);
  const neu = {};
  for (const { szene, seitSek } of aktive) {
    const vorher = szenenLauf[szene.id];
    if (vorher === undefined) { szeneAufbauen(szene); if (!szenenGelaufen.includes(szene.id)) szenenGelaufen.push(szene.id); }
    for (const st of szeneSchritte(szene, vorher ?? -1, seitSek)) szenenSchritt(szene, st, now);
    neu[szene.id] = seitSek;
  }
  for (const id of Object.keys(szenenLauf)) if (!(id in neu)) { szeneAbbauen(id); ui.hideBarks(); } // Fensterende: Figuren und Blasen weg
  szenenLauf = neu;
  szenenWirk = szenenWirkung(aktive, SZENE_ORT);
  const schlaeft = szenenWirk.streife_p1 === 'schlaeft';
  if (schlaeft !== pongSchlief) { pongSchlief = schlaeft; if (!schlaeft) { try { world.markt?.pongPose?.('aufwachen', t, 1.5); } catch (e) { /* ohne Markt */ } } } // Fensterende ohne „aufwachen“-Schritt: Pong wacht trotzdem auf
  for (const { szene } of aktive) for (const slug of szene.sound) { // Dauer-Sounds im Fenster (Schnarchen, Kinder, Streit), nur in Hörweite, Lautstärke nach Abstand
    const takt = SZENE_SOUND_TAKT[slug]; if (!takt || now < (szenenSoundAt[slug] || 0)) continue;
    const o = slug === 'schnarchen_pong' && world.markt?.pong ? world.markt.pong.position : SZENE_ORT(szene.ort);
    const dist = Math.hypot(o.x - state.x, o.z - state.z); if (dist > takt.radius) { szenenSoundAt[slug] = now + 500; continue; }
    let dauer = 0; try { dauer = audio?.ereignis?.(slug, 'start', { pan: Math.max(-1, Math.min(1, (o.x - state.x) / 12)), gain: 1 - dist / takt.radius }) || 0; } catch (e) { /* ohne Ton */ }
    szenenSoundAt[slug] = now + (dauer || 2.2) * 1000 + (takt.pause[0] + Math.random() * (takt.pause[1] - takt.pause[0])) * 1000;
  }
  szeneNah = aktive.map((a) => a.szene).find((sz) => { const o = SZENE_ORT(sz.ort); return Math.hypot(o.x - state.x, o.z - state.z) < Math.max(4, o.r) && sz.ansprechen.length; }) || null;
  liegenReserviert();
}
// Handtuch-Reservierung (wirkung liegen_belegt): die Liegen-Kunden bleiben bis 14 Uhr im Hotel und kommen dann zu ihrer Liege
const LIEGEN_FREI_AB = zeitT('14:00');
function liegenReserviert() {
  if (SCENE && SCENE !== 'szene') return; // Schnappschüsse anderer Szenen setzen Kunden selbst auf die Liegen
  const belegt = szenenHeute.some((sz) => sz.wirkung.liegen_belegt) && tagesuhr.t01 < LIEGEN_FREI_AB;
  for (const k of kunden) {
    if (!k.liege) continue;
    if (belegt && !k.wartet && !k.freigegeben) { k.wartet = true; k.group.visible = false; k.collider.r = 0; k.npc = { ...k.npc, x: 999, z: 999, moving: false }; }
    if (!belegt && k.wartet) { k.wartet = false; k.freigegeben = true; k.group.visible = true; k.collider.r = 0.7; const h = world.spots.hotel; k.npc = { ...k.npc, x: h.x, z: h.z, points: [{ x: h.x, z: h.z }, { x: k.anchor.x, z: k.anchor.z }], idx: 1, pause: 1 + Math.random(), moving: false }; k.group.userData.pose = null; }
  }
}
// Schritt: sag = Erzähltext als Einblendung unten (+ optionaler Bark als Blase), bark = Blase an der Figur (Pong = Markt-Pong, Streife = nächste
// Streife, sonst Szenen-Figur oder Anker am Ort), pose = Pose der Figur (ambient.js) bzw. pongPose / Stolpern der Streife, geh = Ziel, sound über sfx
function szenenSchritt(szene, st, now, { halten = false } = {}) { // halten: Blase stehen lassen (Schnappschuss)
  const t = now / 1000, o = SZENE_ORT(szene.ort);
  const F = szenenFiguren[szene.id]?.[st.wer] || null;
  const anker = st.wer === 'pong' ? 'pong' : st.wer === 'streife' ? (naechsteStreife(o, 30) || streifen[0])?.id || 'streife_p1' : `szene_${szene.id}_${st.wer}`;
  if (st.aktion === 'sag' && st.text && mode === 'free') { ui.showPrompt(fillText(st.text, dayReport(game)), { small: true }); hinweisBis = now + Math.min(9000, 1000 + st.dauer * 1000); }
  const blase = st.aktion === 'bark' ? st.bark || st.text : st.aktion === 'sag' ? st.bark : null;
  if (blase) {
    ui.showBark(anker, blase, halten ? 999 : Math.min(4, st.dauer));
    if (F) szenenAnker[anker] = { obj: F.g.userData.parts?.head || F.g }; else if (!anker.startsWith('streife') && anker !== 'pong') szenenAnker[anker] = o;
    const stimme = F?.stimme || szene.figuren.find((f) => f.slug === st.wer)?.stimme || (st.wer === 'streife' ? 'pong' : st.wer);
    try { audio?.babble?.(stimme, blase, { pan: F ? panFor(F.g) : 0 }); } catch (e) { /* ohne Ton */ }
  }
  if (st.aktion === 'pose') {
    if (F) {
      try { F.g.userData.pose?.(st.pose, t, st.dauer); } catch (e) { /* Pose unbekannt */ }
      if (F.kreis && st.pose !== 'rennen_kreis') F.stehtBis = t + st.dauer; // Kind bleibt für die Pose stehen
      if (st.pose === 'pistole_auf_streife') { const s = naechsteStreife(o, 30); F.yawZiel = s ? s.patrol : null; }
      if (st.pose === 'schnorchel_runter') { F.ziel = { x: F.x0, z: F.z0 + MEER_WEG }; F.yawRuhe = 0; } // geht tauchen
      if (st.pose === 'zurueckkommen_nass') { F.ziel = { x: F.x0, z: F.z0 }; F.yawRuhe = F.yaw0; }
      if (st.pose === 'handtuch_werfen') F.geworfen = false;
    } else if (st.wer === 'pong') { try { world.markt?.pongPose?.(st.pose, t, st.dauer); } catch (e) { /* ohne Markt */ } }
    else if (st.wer === 'streife' && st.pose === 'stolpern') { const s = naechsteStreife(o, 14); if (s && !s.stolper) streifeStolpert(s, t, st.dauer); }
  }
  if (st.aktion === 'geh' && F && st.ziel) { const z = SZENE_ORT(st.ziel); F.ziel = { x: z.x, z: z.z }; }
  if (st.aktion === 'sound' && st.text) sfx(st.text, { pan: F ? panFor(F.g) : 0, gain: 0.6 });
}
const szenenAnker = {}; // Bark-Anker: { obj } (Figurkopf) oder { x, z } (Ort)
const alleVerstecke = () => (szenenWirk.verstecke.length ? [...world.hideouts, ...szenenWirk.verstecke] : world.hideouts);
function szeneAnreden() {
  if (!szeneNah) return;
  const text = szeneAnsprechen(szeneNah, lineIdx++);
  if (!text) return;
  const F = Object.entries(szenenFiguren[szeneNah.id] || {}).find(([k]) => !k.startsWith('_'))?.[1] || null;
  const obj = F ? F.g : szeneNah.figuren.some((f) => f.slug === 'pong') && world.markt?.pong ? world.markt.pong : player;
  if (szeneNah.folge) game = { ...game, folgen: { ...(game.folgen || {}), ...szeneNah.folge } }; // z. B. abends_haengematte_belegt (Einschlaf-Zeile)
  showInfo({ id: 'szene', name: szeneNah.titel, x: SZENE_ORT(szeneNah.ort).x, z: SZENE_ORT(szeneNah.ort).z, obj }, fillText(text, dayReport(game)));
}
let ereignisse = normalizeEreignisse(null); // Tages-Ereignisse (texte.json → ereignisse[])
let woche = normalizeWoche(null); // Wochenbogen: Tagesziele + Finale (texte.json → woche{}), Ziel kalibriert am Kundenkatalog
let wocheRoh = woche;
function applyWoche() {
  woche = kalibriereWoche(wocheRoh, katalog);
  try { setHuetteZiel(world.huette, woche.ziel.muenzen); } catch (e) { /* ohne Hütte */ }
}
let tutorial = null; // Tutorial-Zustand (nur im ersten Spiel, Tag 1)
let tagesuhr = initialClock();
let phase = phaseFor(0);
// Licht über den Tag (licht.js: Himmel, Nebel, Sonnen-/Hemisphärenlicht, Nachtlichter, Sonne/Mond) + Musik-/Ambience-Stimmung
const licht = initLicht(scene, { sonne: world.sonne });
// Fußspuren im Sand (Schluffi + Kundschaft): Pool in spuren.js, Logik in logic.js
const spuren = createSpuren(scene);
let spielerSpur = null;
function spurLegen(trackHolder, key, from, to, yaw, schuhe, now) {
  if (!imSand(to)) { trackHolder[key] = null; return; }
  const r = spurSchritt(trackHolder[key], from, to, yaw, schuhe, now);
  trackHolder[key] = r.track;
  for (const sp of r.spuren) spuren.add(sp, groundY(sp.x, sp.z));
}
// Ereignis-Requisiten (ereignisse.js): Möwe mit Beutel, Regenwolke mit Regentüten, Schiff, Party, Stromausfall, Fähre fällt aus
const ereignisSteuer = ereignisSteuerung({ scene, markt: world.markt, pier: world.pier, licht, figuren: () => [player, ...kunden.flatMap((k) => (k.group.userData.partner ? [k.group, k.group.userData.partner] : [k.group]))] });
world.setEreignis = (id, an = true, opts) => ereignisSteuer.setEreignis(id, an, opts);
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
let zielGemeldet = false; // Tagesziel-Jingle einmal pro Tag
function refreshHud() {
  const ziel = hudZiel(game, woche, game.tag);
  ui.setHud({ ...game, clockLabel: clockLabel(tagesuhr.t01), ziel, hud: texte.hud });
  if (ziel?.erreicht && !zielGemeldet) { zielGemeldet = true; sfx('ziel'); }
}
function applyFinale(stufe) {
  try { setHuette(world.huette, { gut: 'deine', mittel: 'halb', fail: 'posten8' }[stufe] || 'verkauf'); } catch (e) { /* ohne Hütte */ }
  try { if (stufe === 'gut') { world.huegel.mentorAnHuette?.(world.huette, true); setWegweiserText(world.wegweiser, 2, 'POLIZEI 2km. Jetzt stimmt es.', { font: 'bold 44px sans-serif' }); } } catch (e) { /* ohne Mentor */ }
}
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
function spawnKunden(day = 1, { erzwinge = null } = {}) {
  clearKunden();
  // „Großer Markt“: doppelt so viele; Ereignisse (Regen, Kreuzfahrt) skalieren mit, ein Zivi extra bei zivi_extra
  const list = kundenFuerTag(katalog, harmloseFuerTag((tagModifikator(woche, day).kunden_faktor || 1) * ereignisKundenFaktor(game.ereignis) * (game.kokosWirkung?.kunden_faktor || 1)), Math.max(0, 2 + ereignisZiviExtra(game.ereignis)), day, game.ereignis, tagesziel(woche, day)); // mind. 6 Harmlose, Zivis obendrauf; Tagesziel „Oma“ garantiert die Oma
  if (erzwinge && !list.some((k) => k.id === erzwinge)) { const def = katalog.find((k) => k.id === erzwinge); if (def) list.push(def); } // Snap/Szene: bestimmten Kunden erzwingen
  const outfits = assignOutfits(list, day); // keine Doppel-Outfits pro Tag
  const anchors = assignAnchors(list, ANCHORS, { day }); // feste Plätze über alle Zonen (Markt-Plätze stecken in ANCHORS), Zivis mit Abstand
  const seen = {};
  list.forEach((def, i) => {
    const a = anchors[def.id];
    const n = seen[a.id] = (seen[a.id] || 0) + 1; // Notnagel: geteilter Platz versetzt
    const liege = n === 1 ? world.liegen?.[a.id] : null; // Strandliege: Sitzpunkt + Ausrichtung der Liege
    const pos = liege ? { x: liege.sitz.x, z: liege.sitz.z } : { x: a.x + (n - 1) * 2.2, z: a.z + (n - 1) * 1.3 };
    const group = buildKunde(def, idSeed(def.id), outfits[def.id]);
    kundenExtras(group, def, { index: 0 }); // Kleinkram je Kunde (figures.js): Kegelhut, Helm, Pfeife, Blumenkranz …
    kundenGroup.add(group);
    if (def.figuren === 2) { // Paar: zweite Figur im Partnerlook daneben, ein Dialog, ein Verkauf
      const partner = buildKunde(def, idSeed(def.id), outfits[def.id]); // Partnerlook: gleicher Seed
      kundenExtras(partner, def, { index: 1 }); // Cap statt Kranz
      partner.position.set(1.1, 0, 0.15); partner.rotation.y = -0.2; group.add(partner);
      setMood(partner, def.stimmung_start || 'neutral');
      group.userData.partner = partner;
    }
    if (regenAktiv) { setRegen(group, true); if (group.userData.partner) setRegen(group.userData.partner, true); } // Regen läuft schon: Gummistiefel
    setMood(group, def.stimmung_start || 'neutral');
    // kein Kreisen: ein Punkt, der Kunde bleibt an seinem Platz und tut etwas
    const pts = [pos];
    const npc = { x: pos.x, z: pos.z, yaw: liege ? liege.yaw : (a.blick ?? 0), points: pts, idx: 0, pause: 99, speed: 0.5 + def.tempo * 1.1, phase: 0, activity: a.activity };
    const collider = { x: npc.x, z: npc.z, r: 0.7 };
    colliders.push(collider);
    prepareGags(group);
    kunden.push({ def, group, npc, collider, look: 0, id: def.id, gag: null, idleN: i, nextIdle: 3 + i * 1.3, anchor: a, liege, arrived: def.spawn !== 'K1' });
    // Fähren-Gäste (K1) warten unsichtbar auf dem Wasser, bis die Fähre anlegt
    if (def.spawn === 'K1' && world.pier?.ferrySpawn) { group.visible = false; collider.r = 0; }
    applyKunde(kunden[kunden.length - 1]);
  });
}
// ---------- Fähren-Besucher: steigen bei jedem Anlegen aus (1–2), drehen eine Runde Hafen → Markt → Dorf und zurück, fahren mit der nächsten Fähre ----------
const rueck = (lane) => lane.slice().reverse();
const BESUCHER_HIN = [FERRY_SPAWN, ...rueck(PIER_LANES.hafen_steg), ...rueck(PIER_LANES.hafen_platz).slice(1), ...rueck(PIER_LANES.hafen_zufahrt).slice(1), ...rueck(PIER_LANES.markt_quer).slice(1), [MARKT_SPOTS.markt.x, MARKT_SPOTS.markt.z], [DORF_SPOTS.ost.x, DORF_SPOTS.ost.z], [DORF_SPOTS.platz.x, DORF_SPOTS.platz.z], [DORF_SPOTS.dorf.x, DORF_SPOTS.dorf.z]].map((p) => (Array.isArray(p) ? { x: p[0], z: p[1] } : { x: p.x, z: p.z }));
const BESUCHER_ROUTE = [...BESUCHER_HIN, ...BESUCHER_HIN.slice(0, -1).reverse()]; // hin und auf demselben Weg zurück zum Steg
const BESUCHER_MAX = 4;
let ferryNr = 0;
function besucherWechsel(sp) {
  // wer am Steg wartet, fährt ab
  for (let i = kunden.length - 1; i >= 0; i--) {
    const k = kunden[i];
    if (!k.besucher || k.npc.status !== 'wartet' || talking === k) continue;
    kundenGroup.remove(k.group); const ci = colliders.indexOf(k.collider); if (ci >= 0) colliders.splice(ci, 1); kunden.splice(i, 1);
  }
  ferryNr++;
  const frei = BESUCHER_MAX - kunden.filter((k) => k.besucher).length;
  const neu = besucherWahl(katalog, kunden.map((k) => k.id), Math.min(frei, 1 + (ferryNr % 2)), ferryNr);
  neu.forEach((def, i) => {
    const group = buildKunde(def, idSeed(def.id) + ferryNr, assignOutfits([def], game.tag + ferryNr)[def.id]);
    kundenExtras(group, def, { index: 0 });
    if (regenAktiv) setRegen(group, true);
    setMood(group, def.stimmung_start || 'neutral');
    kundenGroup.add(group);
    const start = { x: sp.x + i * 0.9, z: sp.z };
    const npc = { x: start.x, z: start.z, yaw: Math.PI, points: BESUCHER_ROUTE, idx: 1, pause: 1.5 + i, speed: 1.2 + def.tempo * 0.6, phase: 0, activity: 'steht', status: 'runde' };
    const collider = { x: npc.x, z: npc.z, r: 0.7 };
    colliders.push(collider);
    prepareGags(group);
    kunden.push({ def, group, npc, collider, look: 0, id: def.id, gag: null, idleN: kunden.length, nextIdle: 5 + i * 1.3, anchor: { id: 'besucher', x: start.x, z: start.z, activity: 'steht', blick: Math.PI, zone: 'pier' }, liege: null, arrived: true, besucher: true });
    applyKunde(kunden[kunden.length - 1]);
  });
}
function applyKunde(k) {
  const shift = k.group.userData.poseShift || 0; // Liegestuhl: Rumpf kippt zurück, Hüfte wandert nach vorn
  k.group.position.set(k.npc.x + Math.sin(k.npc.yaw) * shift, 0, k.npc.z + Math.cos(k.npc.yaw) * shift);
  k.group.rotation.y = k.npc.yaw;
  k.collider.x = k.npc.x; k.collider.z = k.npc.z;
  k.group.position.y = k.group.userData.poseOffset || 0;
  if (k.gag) return; // gags.js hat Arme/Beine/Kopf/Hund in der Hand
  const parts = k.group.userData.parts;
  if (!k.npc.moving) {
    // steht am Platz: Tätigkeits-Pose aus figures.js (einmal gesetzt), nur der Kopf folgt dem Spieler
    if (!k.group.userData.pose && !k.group.userData.inspectPose) {
      const { offsetY, offsetZ = 0 } = figurePose(k.group, POSE_NAME(k.anchor));
      holdPose(k.group, POSE_NAME(k.anchor)); // Surfbrett in den Händen oder im Sand
      k.group.userData.poseOffset = offsetY + (k.liege ? k.liege.sitz.y : 0); // auf der Liege: Hüfte auf die Liegenfläche
      k.group.userData.poseShift = k.liege ? offsetZ : 0;
      k.group.position.y = k.group.userData.poseOffset;
    }
    if (k.group.userData.pose !== 'liegen') parts.head.rotation.y = k.look;
    if (parts.dog) parts.dog.userData.head.rotation.y = k.look * 0.6;
    return;
  }
  k.group.userData.pose = null; k.group.userData.poseOffset = 0; k.group.userData.poseShift = 0;
  const pose = waddlePose(k.npc.phase, k.npc.speed);
  parts.legs[0].rotation.x = pose.legL; parts.legs[1].rotation.x = pose.legR;
  parts.arms[0].rotation.x = pose.armL; parts.arms[1].rotation.x = pose.armR;
  holdPose(k.group, 'gehen'); // Surfbrett: Arme bleiben vorn
  parts.head.rotation.y = k.look;
  if (parts.dog) parts.dog.userData.head.rotation.y = k.look * 0.6;
}
// Ankerplatz-Tätigkeit → Pose aus figures.js (Liegen = liegen, Hocker = sitzen)
const POSE_NAME = (a) => ({ sitzt: a.id.startsWith('liege') ? 'liegestuhl' : 'sitzen', telefoniert: 'handy', fotografiert: 'foto', schaut: 'meer', steht: 'stehen' }[a.activity] || 'stehen');
// Kunden-Positionen für Logik (x, z, yaw, id)
const kundenPos = () => kunden.map((k) => ({ id: k.id, x: k.npc.x, z: k.npc.z, yaw: k.npc.yaw, ref: k }));

async function loadTexte() {
  let json = await fetchJson('./data/texte.json'); // Datei fehlt → Platzhalter-Texte
  if (json && optionen.sprache === 'en') { const en = await fetchJson('./data/texte.en.json'); if (en) json = mergeTexte(json, en); } // fehlende EN-Zweige bleiben DE
  texte = normalizeTexte(json);
  mentorSz = normalizeMentorSzene(json);
  posten7 = normalizePosten7(json);
  abendTexte = normalizeAbend(json);
  tutorialTexte = normalizeTutorial(json);
  kokosTexte = normalizeKokos(json);
  ereignisse = normalizeEreignisse(json);
  wocheRoh = normalizeWoche(json); applyWoche();
  game = { ...game, texte };
  refreshHud();
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
const BARK_HOERWEITE = 18; // Blasen nur bei Figuren in der Nähe und im Bild
function platziereBark(id, now) { // barkHead steht in Welt (Kopf + 0.9); versteckt, wenn weit weg, hinter der Kamera oder außerhalb des Bildes
  const nah = Math.hypot(barkHead.x - state.x, barkHead.z - state.z) <= BARK_HOERWEITE || id === 'spieler';
  barkHead.project(camera);
  const sichtbar = nah && barkHead.z < 1 && Math.abs(barkHead.x) < 1.05 && Math.abs(barkHead.y) < 1.05;
  ui.placeBark(id, (barkHead.x + 1) / 2 * window.innerWidth, (1 - barkHead.y) / 2 * window.innerHeight, now, sichtbar);
}
function placeBarks() {
  const now = performance.now() / 1000;
  P.head.getWorldPosition(barkHead); barkHead.y += 0.9; platziereBark('spieler', now);
  (kokosFig.userData.parts?.head || kokosFig).getWorldPosition(barkHead); barkHead.y += 0.9; platziereBark('kokos', now);
  (barkeeperObj.userData.parts?.head || barkeeperObj).getWorldPosition(barkHead); barkHead.y += 0.9; platziereBark('barkeeper', now);
  if (world.markt?.pong) { (world.markt.pong.userData.parts?.head || world.markt.pong).getWorldPosition(barkHead); barkHead.y += 0.9; platziereBark('pong', now); } // Pong am Posten (Szenen)
  for (const [id, pos] of Object.entries(szenenAnker)) { if (pos.obj) { pos.obj.getWorldPosition(barkHead); barkHead.y += 0.9; } else barkHead.set(pos.x, 2.4, pos.z); platziereBark(id, now); }
  for (const s of streifen) { s.group.userData.parts.head.getWorldPosition(barkHead); barkHead.y += 0.9; platziereBark(s.id, now); }
  for (const k of kunden) { k.group.userData.parts.head.getWorldPosition(barkHead); barkHead.y += 0.9; platziereBark(k.id, now); }
}
async function loadKunden() {
  let json = await fetchJson('./data/kunden.json'); // Datei fehlt oder kaputt → Fallback unten
  if (json && optionen.sprache === 'en') { const en = await fetchJson('./data/kunden.en.json'); if (en) json = mergeKundenKatalog(json, en); }
  katalog = normalizeKatalog(json);
  applyWoche(); // Wochenziel hängt an den Kundenpreisen
  // schon gespawnte Kunden: Namen/Sätze nachziehen (Sprachwechsel mitten im Tag)
  for (const k of kunden) { const d = katalog.find((x) => x.id === k.id); if (d) k.def = { ...k.def, name: d.name, typ: d.typ, tells: d.tells, saetze: d.saetze }; }
  if (katalog.length === 0) {
    katalog = normalizeKatalog([
      { id: 'fallback_schluffi', typ: 'Strandgast', schuhe: 'sandale', hemd: 'hawaii', accessoire: 'sonnenbrille' },
      { id: 'fallback_zivi', typ: 'Zu sauberer Tourist', schuhe: 'turnschuh', hemd: 'polo_sauber', accessoire: 'ohrknopf', zivi: true, heat: 2 },
    ]);
  }
  spawnKunden(game.tag);
}

// ---------- Eingabe ----------
const keys = { up: false, down: false, left: false, right: false, run: false, rotL: false, rotR: false, pitchUp: false, pitchDown: false };
const KEYMAP = {
  KeyW: 'up', ArrowUp: 'up', KeyS: 'down', ArrowDown: 'down', KeyA: 'left', ArrowLeft: 'left',
  KeyD: 'right', ArrowRight: 'right', ShiftLeft: 'run', ShiftRight: 'run', [KEY_CAM_LEFT]: 'rotL', [KEY_CAM_RIGHT]: 'rotR', [KEY_CAM_RIGHT_ALIAS]: 'rotR', [KEY_CAM_UP]: 'pitchUp', [KEY_CAM_DOWN]: 'pitchDown',
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
  { id: 'kokos', get x() { return kokos.x; }, get z() { return kokos.z; }, r: TALK_DIST + 0.6, name: 'Kokos-Verkäufer', get obj() { return kokosFig; } },
  { id: 'mango_stand', x: mangoStandDef.x, z: mangoStandDef.z + 1.4, r: TALK_DIST + 0.6, name: 'Mango-Stand', obj: pointObj(mangoStandDef.x, 2.6, mangoStandDef.z) },
  { id: 'pong', x: POSTEN_LAYOUT.pong.x, z: POSTEN_LAYOUT.pong.z, r: TALK_DIST + 0.8, name: 'Pong', obj: world.markt?.pong || pointObj(POSTEN_LAYOUT.pong.x, 2.6, POSTEN_LAYOUT.pong.z) },
  // Tuk-Tuk-Express am Hafen: Fahrt zur Bar (20 Mangos laut Schild, sonst Geld), beendet eine Verfolgung
  { id: 'tuktuk', x: world.pier?.tuktuk?.x ?? 74, z: (world.pier?.tuktuk?.z ?? -4) + 2.4, r: TALK_DIST + 1.2, name: 'Somchai', obj: pointObj(world.pier?.tuktuk?.x ?? 74, 2.4, world.pier?.tuktuk?.z ?? -4) },
  // Bestechungs-Stand „1 MANGO = 1 GNADE“ neben Pong: dieselbe Abgabe wie bei Pong selbst
  { id: 'gnaden_stand', x: world.markt?.mangoStand?.x ?? 15.5, z: (world.markt?.mangoStand?.z ?? -82) + 1.4, r: TALK_DIST + 0.6, name: 'Pong', obj: world.markt?.pong || pointObj(POSTEN_LAYOUT.pong.x, 2.6, POSTEN_LAYOUT.pong.z) },
];
let nearPoint = null;
// ---------- Kokos-Verkäufer: läuft den Strand am Wasser auf und ab (logic.kokosStep), ruft, verkauft Kokosnüsse (E) ----------
const kokosFig = FIG.buildKokosVerkaeufer?.() || buildKunde(normalizeKunde({ id: 'kokos_verkaeufer', typ: 'Kokos-Verkäufer', name: 'Kokos', schuhe: 'barfuss', hemd: 'tanktop', hose: 'shorts', accessoire: 'kegelhut', extras: ['kokosnuss'], hautton: 'dunkel', haare: 'kurz', stimmung_start: 'zufrieden' }), 1234);
if (!FIG.buildKokosVerkaeufer) kundenExtras(kokosFig, { extras: ['kokosnuss'], accessoire: 'kegelhut' });
scene.add(kokosFig);
let kokos = kokosStart();
const kokosCollider = { x: kokos.x, z: kokos.z, r: 0.6 };
colliders.push(kokosCollider);
let kokosSpur = null, kokosRufBis = 0, kokosGagBis = 0, kokosGangT = 0;
function applyKokos(dt = 0, now = performance.now()) {
  kokosFig.position.set(kokos.x, 0, kokos.z); kokosFig.rotation.y = kokos.yaw;
  kokosCollider.x = kokos.x; kokosCollider.z = kokos.z;
  kokosGangT += dt;
  if (kokosFig.userData.update) { kokosFig.userData.update(now / 1000, { gehen: kokos.moving && now > kokosGagBis }); return; } // Figur aus figures.js: Gang (Pause in Ruhestellung), Laden, Ruf-Pose, Gags
  const P = kokosFig.userData.parts; if (!P?.legs) return;
  const pose = waddlePose(kokos.phase || 0, kokos.moving ? 1.6 : 0);
  P.legs[0].rotation.x = pose.legL; P.legs[1].rotation.x = pose.legR;
  P.arms[0].rotation.x = pose.armL; P.arms[1].rotation.x = pose.armR;
}
function updateKokos(dt, now) {
  if (mode !== 'free' && mode !== 'inspect') { applyKokos(0, now); return; } // im Gespräch bleibt er stehen
  const vorher = { x: kokos.x, z: kokos.z };
  const hind = [kokosHindernisse(), { x: state.x, z: state.z, r: 0.8 }].flat();
  kokos = kokosStep(kokos, dt, hind);
  const r = kokosRuf(kokos); kokos = r.st;
  if (r.ruf) {
    ui.showBark('kokos', kokosTexte.ruf, 2.4);
    const dist = Math.hypot(kokos.x - state.x, kokos.z - state.z);
    kokosRufen(now, Math.max(0, 1 - dist / 40)); // von weitem zu hören (Radius 40)
  }
  if (kokosRufBis && now > kokosRufBis) { kokosRufBis = 0; try { kokosFig.userData.setRuf?.(false); } catch (e) { /* ignorieren */ } }
  if (kokos.moving) { const h = { s: kokosSpur }; spurLegen(h, 's', vorher, kokos, kokos.yaw, 'flipflop', now / 1000); kokosSpur = h.s; }
  applyKokos(dt, now);
}
const kokosHindernisse = () => kunden.filter((k) => k.group.visible).map((k) => ({ x: k.npc.x, z: k.npc.z, r: 0.8 }));
function kokosGagSpielen(name) { const now = performance.now(); try { kokosFig.userData.gag?.(name, now / 1000); } catch (e) { /* ohne Gag */ } kokosGagBis = now + 1500; kokos = { ...kokos, wait: Math.max(kokos.wait, 1.5) }; }
// Ab Tag 2 liegt die „Bangi-Kokos“ (Filzstift-Blatt) auf dem Tablett; Kokosnuss in Schluffis linker Hand, solange der Tourist-Schutz läuft
function refreshKokos() {
  try { kokosFig.userData.setBangiKokos?.(game.tag >= 2); } catch (e) { /* ohne Tablett */ }
  game = { ...game, kokosWirkung: kokosWirkung(kokosTexte, game.tag) }; // Tag 3: weniger Kundschaft (Bangi-Kokos-Touristen), Tag 6: er unterbietet dich
}
const spielerNuss = coconut(true); spielerNuss.scale.setScalar(0.75); spielerNuss.position.set(-0.25, -0.95, 0.25); spielerNuss.visible = false;
if (P.arms?.[0]) P.arms[0].add(spielerNuss);
// gesungener Strandruf (sfx leitet an audio.gesang weiter, echter Clip sobald geladen), gain = nur Abstand; Megafon-Pose so lang wie der Ruf
function kokosRufen(now, gain) {
  const d = sfx('kokos_ruf', { pan: panFor(kokosFig), gain });
  try { kokosFig.userData.setRuf?.(true); } catch (e) { /* ohne Ruf-Pose */ }
  kokosRufBis = now + (Number.isFinite(d) && d > 0 ? d : 2.2) * 1000;
}
// Kauf: kleine Blase mit Kaufen/Nein; danach der Gag „was Besonderes“ als lauter Ruf
let kokosDialog = false;
function startKokos() {
  const K = kokosTexte, D = texte.dialog;
  talking = { id: 'kokos', group: kokosFig, def: { id: 'kokosverkaeufer', name: K.name, stimme: 'kokosverkaeufer' }, npc: { x: kokos.x, z: kokos.z, yaw: kokos.yaw } };
  for (const key in keys) keys[key] = false;
  clickTarget = null; mode = 'kokos'; kokosDialog = true;
  ui.showPrompt(null);
  ui.showBubble({ text: pickLine(K.gruss, lineIdx++), options: [fillText(D.kokosnuss, { preis: K.preis }), D.besonderes, D.weiter] }, K.name, 0);
  try { audio?.bark?.('kokosverkaeufer', 'gruss', { pan: panFor(kokosFig) }); } catch (e) { /* ohne Ton */ }
}
function kokosChoice(i) {
  if (!kokosDialog) return;
  const K = kokosTexte, D = texte.dialog;
  kokosDialog = false;
  const antwort = (text, bark) => { ui.showBubble({ text, options: [D.weiter] }, K.name, 0); mode = 'info'; try { if (bark) audio?.bark?.('kokosverkaeufer', bark, { pan: panFor(kokosFig) }); } catch (e) { /* ohne Ton */ } };
  if (i === 0) { // Kokosnuss kaufen: 60 s Tourist-Schutz (Streife sieht halb so weit)
    const r = buyKokos(game, K.preis, tagesuhr.t01);
    game = r.state; refreshHud();
    if (r.result === 'gekauft') { sfx('kasse'); antwort(pickLine(K.kauf, lineIdx++), 'kauf'); kokosGagSpielen('verkauf'); } // Machetenhieb
    else { sfx('ablehnung'); antwort(pickLine(K.kein_geld, lineIdx++), 'ablehnung'); }
  } else if (i === 1) { // Running Gag: er will dein Konkurrent werden, eine Zeile pro Tag
    antwort(kokosGag(K, game.tag).text, 'besonderes'); kokosGagSpielen('besonderes'); // Brauen-Scheibenwischer
  } else { ui.hideBubble(); talking = null; mode = 'free'; }
}
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
  if (point.id === 'kokos') { startKokos(); return; }
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
  tutorialFire('bar_betreten');
  // letzter Tag der Woche: Finale-Stufe festhalten, Hütte umbauen (Zustände aus props.js), Mentor zieht bei „gut“ hinter die Hütte
  if (!game.finale && tagesziel(woche, game.tag) && game.tag === woche.tage.length) { game = { ...game, finale: finaleStufe(game, woche) }; applyFinale(game.finale); }
  barFolge = barAbend(game, abendTexte, lineIdx++, { woche, szenen: szenenGelaufen.map((id) => szenenHeute.find((sz) => sz.id === id)?.kommentar).filter(Boolean) }); // je gelaufener Ambient-Szene ein Kommentar
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
const streifeSchlaeft = (s) => s.id === 'streife_p1' && szenenWirk.streife_p1 === 'schlaeft'; // Pongs Mittagsschlaf: P1 bleibt am Posten, sieht nichts
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
    if (streifeSchlaeft(s)) { s.sees = false; if (s.patrol.mode !== 'patrol' || s.patrol.idx !== 1 || Math.hypot(s.patrol.x - s.route[0].x, s.patrol.z - s.route[0].z) > 0.3) s.patrol = { ...patrolStart(s.route), mode: 'patrol', wait: 1 }; s.patrol = { ...s.patrol, wait: 1, moving: false }; applyCop(s); continue; } // schläft am Posten (Startpunkt der Route)
    const sees = seesTarget(s.patrol, state, { range: kokosSchutz(game, tagesuhr.t01) ? 6 : 12 }); // Kokosnuss in der Hand: gilt als Tourist, halbe Sichtweite
    s.sees = sees && !inHideout(state, alleVerstecke());
    // Verfolgung ab Heat 2: langsam (Sandalen), verliert den Spieler nach 6 s ohne Sicht oder im Versteck
    const r = chaseStep(s.patrol, s.route, state, dt, { sees, heat: game.heat, hideouts: alleVerstecke(), schuhe: s.schuhe });
    if (r.event === 'kante') { ui.showBark(s.id, 'These are new!', 2.5); try { audio?.babble?.('pong', 'These are new!', { pan: panFor(s.group) }); } catch (e) { /* ohne Ton */ } }
    s.patrol = r.st;
    // Szene im Weg (Kinder, Ehepaar): läuft der Spieler mitten durch, stolpert die verfolgende Streife und verliert ihn
    if (r.st.mode === 'chase' && inStolperZone(szenenWirk, state) && Math.hypot(r.st.x - state.x, r.st.z - state.z) < 7) {
      streifeStolpert(s, now / 1000, 3);
      ui.showBark(s.id, 'Oof!', 2); try { audio?.bark?.('pong', 'sichtung', { pan: panFor(s.group) }); } catch (e) { /* ohne Ton */ }
      if (mode === 'free') ui.showPrompt('Die Streife stolpert über die Szene — weg bist du.');
    }
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
    if (s.stolper) { const u = (now / 1000 - s.stolper.t0) / s.stolper.dauer; stolpern(s.group, Math.min(1, u)); if (u >= 1) s.stolper = null; } // Szene: hingefallen (ambient.js), nach der Pose aufgeräumt
  }
}
let mentorFolge = null; // laufende Blasenfolge
let mentorIdx = 0;
function startMentor() {
  // abends an der Bar: Abendgespräch (Rückblick + Abschied), kein Nachschub
  if (mentorAmTresen) { startBarAbend(); return; }
  mentorFolge = mentorSzene(game, mentorSz, lineIdx++, { woche });
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
  tutorialFire('mentor_szene_ende');
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
  onTalk: () => { sfx('talk'); if (mode === 'dialog') confirmDialog(); else if (mode === 'mentor') advanceMentor(); else if (mode === 'info') endInfo(); else if (mode === 'bar') advanceBar(); else if (mode === 'kokos') kokosChoice(0); else if (erfolg && mode === 'free') neuesSpiel(); else if (nearK && mode === 'free') startTalk(nearK); else if (nearMentor && mode === 'free') startMentor(); else if (nearPoint && mode === 'free') usePoint(nearPoint); else if (szeneNah && mode === 'free') szeneAnreden(); },
  onCamLeft: (down) => { keys.rotL = down; },
  onCamRight: (down) => { keys.rotR = down; },
});
if (TOUCH) touch.show();
window.addEventListener('keydown', (e) => {
  if (mode === 'menu') { if (e.code === 'Escape') closeMenu(); e.preventDefault(); return; }
  if (mode === 'start') { if (['Enter', 'Space', 'Digit1'].includes(e.code)) startChoice(0); else if (e.code === 'Digit2') startChoice(1); else if (e.code === 'Digit3') startChoice(2); e.preventDefault(); return; }
  if (mode === 'infoseite') { if (['Enter', 'Space', 'Escape', 'Digit1'].includes(e.code)) closeInfo(); e.preventDefault(); return; }
  if (mode === 'figur') { const d = { Digit1: 0, Digit2: 1, Digit3: 2, Digit4: 3, Enter: 0, Space: 0 }[e.code]; if (d !== undefined) figurChoice(d); e.preventDefault(); return; }
  if (mode === 'intro') { if (['Enter', 'Space', 'Escape', KEY_TALK].includes(e.code)) introEnde(); e.preventDefault(); return; }
  if (e.code === 'Escape' && (mode === 'free')) { openMenu(); e.preventDefault(); return; }
  if (mode === 'finale') { if (['Enter', 'Space', 'Digit1'].includes(e.code)) finaleChoice(0); else if (e.code === 'Digit2') finaleChoice(1); e.preventDefault(); return; }
  if (mode === 'arrest' || mode === 'card') { if (e.code === 'Enter' || e.code === 'Space') { cardWeiter(); e.preventDefault(); } return; }
  if (mode === 'dialog') { dialogKey(e); return; }
  if (mode === 'mentor') { if (['Enter', 'Space', 'KeyE', 'Digit1'].includes(e.code)) advanceMentor(); else if (e.code === 'Escape') advanceMentor(); e.preventDefault(); return; }
  if (mode === 'info') { if (['Enter', 'Space', 'KeyE', 'Digit1', 'Escape'].includes(e.code)) endInfo(); e.preventDefault(); return; }
  if (mode === 'bar') { if (['Enter', 'Space', 'KeyE', 'Digit1'].includes(e.code)) advanceBar(0); else if (['Digit2', 'Escape'].includes(e.code)) advanceBar(1); e.preventDefault(); return; }
  if (mode === 'kokos') { if (['Enter', 'Space', 'KeyE', 'Digit1'].includes(e.code)) kokosChoice(0); else if (e.code === 'Digit2') kokosChoice(1); else if (['Digit3', 'Escape'].includes(e.code)) kokosChoice(2); e.preventDefault(); return; }
  if (e.code === KEY_TALK && nearMentor && mode === 'free') { startMentor(); e.preventDefault(); return; }
  if (e.code === KEY_TALK && nearPoint && !nearK && mode === 'free') { usePoint(nearPoint); e.preventDefault(); return; }
  if (e.code === KEY_TALK && szeneNah && !nearK && !nearMentor && mode === 'free') { szeneAnreden(); e.preventDefault(); return; }
  // F = ansprechen (das Gespräch läuft im Anschau-Modus: Kamera aufs Gesicht); ohne Kunden in Reichweite passiert nichts
  if (e.code === KEY_TALK) { if (nearK && mode === 'free') { if (erfolg) neuesSpiel(); else startTalk(nearK); } else if (erfolg && mode === 'free') neuesSpiel(); e.preventDefault(); return; }
  if (e.code === 'Enter' && erfolg && mode === 'free') { neuesSpiel(); e.preventDefault(); return; }
  if (e.code === 'Escape' && mode === 'inspect') { endInspect(); return; }
  const k = KEYMAP[e.code];
  if (k) { keys[k] = true; clickTarget = null; e.preventDefault(); }
});
window.addEventListener('keyup', (e) => { const k = KEYMAP[e.code]; if (k) keys[k] = false; });
window.addEventListener('blur', () => { for (const k in keys) keys[k] = false; });

// Klick auf den Boden = hinlaufen
const ray = new THREE.Raycaster(); ray.camera = camera; // Sprites (Lichterketten-Halos) brauchen die Kamera beim Raycast
const groundPlane = new THREE.Plane(new THREE.Vector3(0, 1, 0), 0);
// Maus: Ziehen dreht (waagerecht) und neigt (senkrecht) die Kamera, ein Klick ohne Ziehen läuft hin; Rad neigt; zwei Finger neigen
const drag = { id: null, x: 0, y: 0, moved: false, fingers: new Map(), pinchY: null };
renderer.domElement.addEventListener('pointerdown', (e) => {
  if (e.pointerType === 'touch') { drag.fingers.set(e.pointerId, e.clientY); drag.pinchY = drag.fingers.size === 2 ? [...drag.fingers.values()].reduce((a, b) => a + b, 0) / 2 : null; }
  if (e.button !== 0 || mode !== 'free' || e.pointerType === 'touch') return;
  drag.id = e.pointerId; drag.x = e.clientX; drag.y = e.clientY; drag.moved = false;
});
renderer.domElement.addEventListener('pointermove', (e) => {
  if (e.pointerType === 'touch') {
    if (drag.fingers.has(e.pointerId)) drag.fingers.set(e.pointerId, e.clientY);
    if (drag.fingers.size === 2 && drag.pinchY !== null) { const y = [...drag.fingers.values()].reduce((a, b) => a + b, 0) / 2; setPitch(camPitch - (y - drag.pinchY) * 0.004); drag.pinchY = y; }
    return;
  }
  if (drag.id !== e.pointerId) return;
  const dx = e.clientX - drag.x, dy = e.clientY - drag.y;
  if (!drag.moved && Math.hypot(dx, dy) < 6) return;
  drag.moved = true;
  camYaw -= dx * 0.005; setPitch(camPitch - dy * 0.005); // hochziehen = steiler
  drag.x = e.clientX; drag.y = e.clientY;
});
const dragEnd = (e) => {
  if (e.pointerType === 'touch') { drag.fingers.delete(e.pointerId); drag.pinchY = null; return; }
  if (drag.id !== e.pointerId) return;
  drag.id = null;
  if (drag.moved || mode !== 'free') return;
  const ndc = new THREE.Vector2((e.clientX / window.innerWidth) * 2 - 1, -(e.clientY / window.innerHeight) * 2 + 1);
  ray.setFromCamera(ndc, camera);
  const hit = new THREE.Vector3();
  if (ray.ray.intersectPlane(groundPlane, hit)) clickTarget = { x: hit.x, z: hit.z };
};
renderer.domElement.addEventListener('pointerup', dragEnd);
renderer.domElement.addEventListener('pointercancel', dragEnd);
renderer.domElement.addEventListener('wheel', (e) => { if (mode === 'free' || mode === 'inspect') { setPitch(camPitch + e.deltaY * 0.0015); e.preventDefault(); } }, { passive: false });
// ---------- Tutorial Tag 1: Schritte aus texte.json → tutorial{}, Zielmarker (marker.js), nur im ersten Spiel, überspringbar ----------
const TUT_KEY = 'bangi.tutorial';
const TUT_PARAM = q('tutorial'); // ?tutorial=1 erzwingt, =0 unterdrückt (Snaps/Tests)
function tutorialErlaubt() { if (TUT_PARAM === '1') return true; if (TUT_PARAM === '0') return false; try { return localStorage.getItem(TUT_KEY) !== '1'; } catch (e) { return true; } }
const marker = zielMarker({ x: 0, z: 0 }); marker.visible = false; scene.add(marker);
let markerZiel = null, tutorialBis = 0, fertigGezeigt = false;
function beginTutorial() { if (!tutorialErlaubt() || game.tag !== 1) return; tutorial = tutorialStart(); fertigGezeigt = false; tutorialFire('tag1_start'); }
function tutorialDone() { tutorial = null; tutorialBis = 0; setTutorialZiel(null); ui.hideTutorial(); try { localStorage.setItem(TUT_KEY, '1'); } catch (e) { /* ignorieren */ } }
function tutorialFire(trigger) {
  if (!tutorial || tutorial.fertig) return;
  const r = tutorialEvent(tutorial, tutorialTexte, trigger);
  tutorial = r.tut;
  if (!r.schritt) return;
  ui.showTutorial({ text: r.schritt.text, skip: tutorialTexte.ueberspringen });
  tutorialBis = performance.now() + 10000;
  setTutorialZiel(r.schritt.ziel);
  sfx(tutorial.idx > 1 ? 'ui_schritt' : 'ui_oeffnen'); // erster Schritt öffnet, danach „Schritt erledigt“
}
function setTutorialZiel(ziel) {
  markerZiel = ziel;
  ui.pulseHud('heat', ziel === 'heat_anzeige');
  const p = ziel === 'huegel' ? (mentorRef ? mentorRef.npc : world.spots.garten) : ziel === 'strand' ? world.spots.start : ziel === 'bar' ? world.spots.bar : null;
  marker.visible = !!p;
  if (p) marker.userData.setPosition(p.x, p.z, groundY(p.x, p.z));
}
function updateTutorial(now) {
  if (markerZiel === 'kunde') { const k = nearK || kunden[0]; if (k) { marker.visible = true; marker.userData.setPosition(k.npc.x, k.npc.z, groundY(k.npc.x, k.npc.z)); } }
  if (marker.visible) updateMarker(marker, now / 1000);
  if (!tutorialBis || now < tutorialBis) return;
  if (tutorial?.fertig && !fertigGezeigt) { fertigGezeigt = true; ui.showTutorial({ text: tutorialTexte.fertig }); tutorialBis = now + 7000; setTutorialZiel(null); return; }
  ui.hideTutorial(); tutorialBis = 0;
  if (tutorial?.fertig) tutorialDone();
}
ui.onTutorialSkip(() => { if (!tutorial) return; tutorial = tutorialSkip(tutorial, tutorialTexte); sfx('talk'); tutorialDone(); });
// ---------- Titelbildschirm: Neues Spiel (Intro-Kamerafahrt zur Hütte, dann Tutorial) / Weiter (Stand laden) / Info ----------
let startButtons = [];
function showTitle() {
  const T = texte.start, sv = readSave(), saved = hatFortschritt(sv) ? fromSave(sv) : null;
  startButtons = [{ id: 'neu', label: T.neu }, ...(saved ? [{ id: 'weiter', label: T.weiter }] : []), { id: 'info', label: T.info }];
  mode = 'start';
  ui.hideBarks();
  ui.showCard({ titel: T.titel, zeilen: saved ? [fillText(T.stand, saved)] : [T.untertitel, woche.ziel.text].filter(Boolean), buttons: startButtons.map((b) => b.label) });
}
const showStart = () => showTitle();
function startChoice(i) {
  const wahl = startButtons[i]?.id;
  if (!wahl) return;
  const sv = readSave(), saved = hatFortschritt(sv) ? fromSave(sv) : null;
  ui.hideCard();
  if (wahl === 'info') { showInfoSeite('start'); return; }
  if (wahl === 'weiter' && saved) {
    game = { ...game, ...saved };
    if (game.kopf && game.kopf !== 'stirnband') setzeSchluffi(game.kopf);
    if (game.finale) applyFinale(game.finale);
    refreshKokos();
    planeSzenen();
    spawnKunden(game.tag);
    for (const s of streifen) s.patrol = { ...patrolStart(s.route), mode: 'patrol' };
    tagesuhr = initialClock(); applyTageszeit(); placeMentor(false);
    refreshHud();
    mode = 'free';
    return;
  }
  clearSave(); game = { ...game, seed: neuerSeed() }; refreshHud();
  showFigurWahl();
}
// Figurenwahl vor dem Intro: vier Kopfbedeckungen, Wahl landet im Spielstand (game.kopf)
function showFigurWahl() {
  const T = texte.figur;
  mode = 'figur';
  ui.showCard({ titel: T.titel, zeilen: [T.hinweis], buttons: KOPF_WAHL.map((k) => T[k]) });
}
function figurChoice(i) {
  const kopf = KOPF_WAHL[i]; if (!kopf) return;
  setzeSchluffi(kopf); sfx('talk');
  ui.hideCard();
  startIntro();
}
// Info-Seite (Titel → Info, ⚙ → Hilfe): Text aus texte.json ui.info, Code-Default in game.js
let infoVon = 'start';
function showInfoSeite(von) {
  infoVon = von; mode = 'infoseite';
  ui.showCard({ titel: texte.info.titel, zeilen: texte.info.zeilen.map((z) => fillText(z, { muenzen: woche.ziel.muenzen })), buttons: [texte.info.zurueck] });
}
function closeInfo() { ui.hideCard(); if (infoVon === 'start') showTitle(); else mode = 'free'; }
// Intro: Kamera steht vor der Hütte mit dem Zielschild („Das ist dein Ziel“), fährt dann zum Startstrand; Enter überspringt
const INTRO = { jeZeile: 3.2, dauerB: 2.6, hut: { x: -62.5, z: 8.5 } }; // Phase A: je Intro-Zeile 3,2 s vor der Hütte, dann die Fahrt zum Strand
const introDauerA = () => Math.max(3.8, texte.intro.zeilen.length * INTRO.jeZeile);
let intro = null; // { t0, halt } — halt: feste Sekunde (Schnappschuss)
function startIntro({ halt = null } = {}) {
  intro = { t0: performance.now(), halt };
  mode = 'intro';
  for (const key in keys) keys[key] = false;
  clickTarget = null;
  ui.hideCard(); ui.hideBarks();
  intro.zeile = -1;
}
function introCamera(now) {
  const t = intro.halt !== null ? intro.halt : (now - intro.t0) / 1000, dauerA = introDauerA();
  const a = Math.min(1, t / dauerA);
  const A = { x: -54.5 - 1.5 * a, y: 6.4 - 0.6 * a, z: 19.5 - 1.5 * a, tx: INTRO.hut.x, ty: 2.4, tz: INTRO.hut.z }; // von Süd-Ost, die Palme bleibt rechts vom Zielschild; langsam näher ran
  const zeile = Math.min(texte.intro.zeilen.length - 1, Math.floor(t / INTRO.jeZeile));
  if (zeile !== intro.zeile) { intro.zeile = zeile; ui.showPrompt(fillText(texte.intro.zeilen[zeile], { muenzen: woche.ziel.muenzen })); }
  if (t <= dauerA) return A;
  const u = Math.min(1, (t - dauerA) / INTRO.dauerB), e = u * u * (3 - 2 * u);
  const Z = followCamera(cam, state, 1, camYaw, 100, camPitch); // Zielposition der Folgekamera am Startstrand
  const out = {}; for (const k of ['x', 'y', 'z', 'tx', 'ty', 'tz']) out[k] = A[k] + (Z[k] - A[k]) * e;
  if (u >= 1 && intro.halt === null) introEnde();
  return out;
}
function introEnde() { if (mode !== 'intro') return; intro = null; mode = 'free'; ui.showPrompt(null); refreshHud(); beginTutorial(); }
// Erfolgs-Tableau nach Tag 7 (Kasse ≥ Ziel): Hütte ohne Schild, Feuerwerk (Bausteine aus props/world, wenn vorhanden), Spieler davor,
// man kann noch rumlaufen; Enter/F/Reden-Knopf = Neues Spiel. Die Uhr steht, der Spielstand ist erledigt.
let erfolg = false;
let erfolgSitzt = false; // Schluffi liegt im Liegestuhl, bis der Spieler loslaufen will
let fw = null; // Feuerwerk (feuerwerk.js) überm Meer
const ERFOLG_LIEGE = { x: -57.2, z: 11.2, yaw: Math.PI / 2 }; // vor der Hüttentür (Osten), Blick zur Kamera
function erfolgTableau() {
  erfolg = true; erfolgSitzt = true; finaleKarteOffen = null; clearSave();
  tagesuhr = { t01: zeitT('21:00') }; applyTageszeit(); // Abend: Feuerwerk leuchtet, Lichterkette an
  const hut = world.huette.position;
  try { setHuette(world.huette, 'deine', { schild: false }); world.huegel.mentorAnHuette?.(world.huette, true); } catch (e) { /* ohne Hütte */ }
  try { // Liegestuhl vor der Hütte, Schluffi liegt drin (Pose liegestuhl auf dem Sitzpunkt der Liege)
    const lo = lounger(['#e8463a', '#fff5e0']); lo.position.set(ERFOLG_LIEGE.x, 0, ERFOLG_LIEGE.z); lo.rotation.y = ERFOLG_LIEGE.yaw; lo.scale.setScalar(1.3); scene.add(lo);
    const { offsetY, offsetZ = 0 } = figurePose(player, 'liegestuhl');
    const sitz = new THREE.Vector3(lo.userData.sitz.x, lo.userData.sitz.y, lo.userData.sitz.z); lo.localToWorld(sitz);
    state = { ...state, x: sitz.x, z: sitz.z, yaw: ERFOLG_LIEGE.yaw, speed: 0, phase: 0 };
    player.position.set(sitz.x + Math.sin(ERFOLG_LIEGE.yaw) * offsetZ, sitz.y + offsetY, sitz.z + Math.cos(ERFOLG_LIEGE.yaw) * offsetZ); player.rotation.y = ERFOLG_LIEGE.yaw;
  } catch (e) { state = { ...state, x: ERFOLG_LIEGE.x, z: ERFOLG_LIEGE.z, yaw: ERFOLG_LIEGE.yaw, speed: 0 }; erfolgSitzt = false; }
  try { fw = feuerwerk(scene, { x: hut.x - 4, z: shoreZ(hut.x) + 9, hoehe: 12, breite: 18 }); fw.start(); } catch (e) { fw = null; }
  sfx('feuerwerk');
  camYaw = Math.PI / 2; // Kamera im Osten, Blick nach Westen: Schluffi vorn, Hütte dahinter, Feuerwerk links überm Meer
  cam = followCamera(cam, state, 1, camYaw, 100, camPitch);
  ui.hideCard(); ui.hideBarks(); ui.hideBubble(); dialog = null; talking = null;
  mode = 'free';
  ui.showPrompt(texte.finale.hinweis, { small: true });
}
function erfolgAufstehen() { if (!erfolgSitzt) return; erfolgSitzt = false; figurePose(player, 'stehen'); state = { ...state, x: ERFOLG_LIEGE.x + 1.6, z: ERFOLG_LIEGE.z, speed: 0 }; }
function neuesSpiel() { try { fw?.stop(); } catch (e) { /* ignorieren */ } clearSave(); location.reload(); }
// ---------- Optionen-Menü (⚙): pausiert das Spiel (Modus menu), Esc oder „Schließen“ geht zurück ----------
let menuPrev = 'free';
function menuModel() {
  const M = texte.menue;
  const anAus = [{ v: true, label: M.an }, { v: false, label: M.aus }];
  return {
    titel: M.titel, hinweis: M.hinweis, schliessen: M.schliessen,
    rows: [
      { id: 'sprache', label: M.sprache, value: optionen.sprache, werte: [{ v: 'de', label: 'DE' }, { v: 'en', label: 'EN' }] },
      { id: 'beschlagnahme', label: M.beschlagnahme, value: optionen.beschlagnahme, werte: anAus },
      { id: 'musik', label: M.musik, value: optionen.musik, werte: anAus },
      { id: 'ton', label: M.ton, value: optionen.ton, werte: anAus },
      { id: 'info', label: M.info, value: null, werte: [{ v: 'x', label: M.anzeigen }] }, // Info-Seite
    ],
  };
}
function openMenu() {
  if (mode === 'menu') return;
  if (mode !== 'free' && mode !== 'inspect') return; // mitten im Gespräch/auf der Karte nicht
  menuPrev = mode;
  for (const key in keys) keys[key] = false;
  clickTarget = null;
  mode = 'menu';
  ui.showMenu(menuModel());
  sfx('ui_oeffnen');
}
function closeMenu() { if (mode !== 'menu') return; ui.hideMenu(); mode = menuPrev; sfx('ui_schliessen'); }
ui.createOptionsButton(() => { if (mode === 'menu') closeMenu(); else openMenu(); });
ui.onMenu({
  close: closeMenu,
  change: async (id, raw) => {
    if (id === 'info') { closeMenu(); showInfoSeite('menu'); return; }
    const val = id === 'sprache' ? raw : raw === 'true';
    if (optionen[id] === val) return;
    optionen = normalizeOptionen({ ...optionen, [id]: val });
    saveOptionen(); sfx('ui_umschalten');
    if (id === 'sprache') { await loadTexte(); await loadKunden(); refreshHud(); } else applyAudioOptionen();
    if (mode === 'menu') ui.showMenu(menuModel());
  },
});
ui.onOptionClick((i, where) => {
  sfx('talk');
  if (where === 'card') { if (mode === 'start') startChoice(i); else if (mode === 'figur') figurChoice(i); else if (mode === 'infoseite') closeInfo(); else if (mode === 'finale') finaleChoice(i); else cardWeiter(); }
  else if (mode === 'mentor') advanceMentor();
  else if (mode === 'info') endInfo();
  else if (mode === 'bar') advanceBar(i);
  else if (mode === 'kokos') kokosChoice(i);
  else if (mode === 'dialog') { selected = i; confirmDialog(); }
});

// ---------- Gespräch ----------
function startTalk(k) {
  markHint('talk'); markHint('look');
  sfx('talk');
  ui.hideBarks();
  talking = k;
  inspectPoseAn(k); // Gespräch im Anschau-Modus: Hände weg vom Gesicht, Kamera fährt vors Gesicht (Loop)
  for (const key in keys) keys[key] = false;
  clickTarget = null;
  dialog = startDialog(k.def, game, lineIdx++, texte);
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
  else if (e.code === 'Digit3' && n > 2) { selected = 2; confirmDialog(); }
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
    const r = chooseOption(game, dialog, talking.def, selected, lineIdx++, { posten: POSTEN_ZONE, pos: state, beschlagnahmt: optionen.beschlagnahme, wuerfel: Math.random() }, texte); // wuerfel: Verhandlungsrisiko
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
    if (dialog.result === 'kauf' || dialog.result === 'reveal') { sfx('kasse'); if (dialog.teuer) sfx('kasse'); tutorialFire('erster_verkauf'); } else { sfx('ablehnung'); if (dialog.result === 'ablehnung') tutorialFire('erste_ablehnung'); }
    if (dialog.result === 'reveal') setRevealed(talking.group, true);
    const wann = dialog.result === 'ablehnung' ? 'ablehnung' : (dialog.result === 'kauf' || dialog.result === 'reveal') ? 'kauf' : null;
    if (wann) startGag(talking, gagFor(texte, talking.id, wann));
    selected = 0;
    renderBubble();
    return;
  }
  const next = advanceDialog(dialog, texte);
  if (next) { dialog = next; selected = 0; renderBubble(); } else endDialog();
}
function endDialog() {
  // der Kunde ruft noch etwas hinterher (englischer Bark), je nach Ausgang
  if (dialog && talking && dialog.result === 'reveal' && talking.def.stimme === 'zivi_pfeife') sfx('pfeife'); // Frau Trillerpfeife: ihr Reveal ist der Pfiff
  else if (dialog && talking && (dialog.result === 'kauf' || dialog.result === 'reveal')) bark(talking, 'kauf');
  else if (dialog && talking && dialog.result === 'ablehnung') bark(talking, 'ablehnung');
  dialog = null;
  ui.hideBubble();
  stopBabble();
  mode = 'free';
  inspectPoseAus(talking); tutorialFire('nach_hinschauen'); // Gespräch = hingeschaut
  if (isArrested(game)) { sfx('verhaftet'); verhaftetZurBar(); return; }
  if (isSoldOut(game) && !soldOutShown) showSoldOut();
}
// Ausverkauft: Sprechblase des Spielers mit „Tag beenden“ / „Weiterbummeln“
function showSoldOut() {
  tutorialFire('ware_leer');
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
  if (game.ereignis && game.ereignisAktiv) ereignisEnde(game.ereignis, { leise: true }); // Tag rum: Requisite aus, Wetter klar
  try { ereignisSteuer.alleAus(); } catch (e) { /* ohne Requisiten */ }
  dialog = null;
  ui.hideBubble();
  ui.showPrompt(null);
  mode = 'card';
  sfx('feierabend');
  const c = dayEndCard(game, texte, lineIdx++);
  ui.showCard({ titel: c.titel, zeilen: [...(vorspann ? [vorspann] : []), c.spruch, ...c.zeilen, ...(fuss ? [fuss] : [])], button: c.button, rot: c.lage === 'verhaftet' });
}
// Bilanz-Karte bestätigt: am letzten Wochentag erst die Finale-Karte (Weiterspielen / Neue Woche), sonst neuer Tag
let finaleKarteOffen = null;
function cardWeiter() {
  // Finale auch ohne Bar-Abend (Hängematte, Verhaftung): sonst lief die Woche ohne Ende weiter
  if (!game.finale && tagesziel(woche, game.tag) && game.tag === woche.tage.length) { game = { ...game, finale: finaleStufe(game, woche) }; applyFinale(game.finale); }
  if (game.finale && tagesziel(woche, game.tag) && game.tag === woche.tage.length) { showFinaleKarte(); return; }
  startNewDay();
}
function showFinaleKarte() {
  finaleKarteOffen = finaleKarte(game, woche, texte);
  mode = 'finale';
  ui.showCard({ titel: finaleKarteOffen.titel, zeilen: finaleKarteOffen.zeilen, buttons: finaleKarteOffen.buttons, rot: finaleKarteOffen.stufe === 'fail' });
  sfx({ gut: 'woche_gut', mittel: 'woche_mittel', fail: 'woche_fail' }[finaleKarteOffen.stufe] || 'woche_gut');
}
function finaleChoice() { // Tag 7 ist immer das Ende: Erfolg → Tableau an der Hütte, sonst neue Woche
  if (!finaleKarteOffen) return;
  const k = finaleKarteOffen; finaleKarteOffen = null;
  if (k.erfolg) erfolgTableau(); else startNeueWoche();
}
function startNeueWoche() {
  game = neueWoche(game);
  try { setHuette(world.huette, 'verkauf'); world.huegel.mentorAnHuette?.(world.huette, false); } catch (e) { /* ohne Hütte */ }
  nachtArt = 'bar';
  saveGame();
  morgen();
}
function startNewDay() {
  // Ereignis des neuen Tages: deterministisch aus Seed/Woche/Tag, nie Tag 1, nie am Tutorial-Tag
  const ereignis = ereignisFuerTag(ereignisse, { seed: game.seed, woche: game.woche, tag: game.tag + 1, tutorial: !!tutorial && !tutorial.fertig });
  game = newDay(game, { nacht: nachtArt, modifikator: tagModifikator(woche, game.tag + 1), ereignis });
  nachtArt = 'bar';
  saveGame(); // Morgenstand des neuen Tages
  morgen();
}
// Morgen-Routine: Uhr, Mentor, Streifen, Kundschaft des Tages, Spieler am Start
let hinweisBis = 0; // Einblendung zum Tagesereignis
let regenAktiv = false;
// Ereignis starten/beenden: Zeitfenster (zeitpunkt/dauer_s), Requisite (ereignisse.js, Party, Stromausfall), Klang (audio.ereignis), Gummistiefel
function ereignisStart(ev) {
  game = { ...game, ereignisAktiv: true };
  ui.showPrompt(ev.hinweis); hinweisBis = performance.now() + 8000;
  setEreignisRequisite(ev, true);
  try { audio?.ereignis?.(ev.sound, 'start', { pan: 0.3 }); } catch (e) { /* ohne Ton */ }
  if ((ev.wirkung.tells_verdeckt || []).includes('schuhe')) setAlleRegen(true);
}
function ereignisEnde(ev, { leise = false } = {}) {
  game = { ...game, ereignisAktiv: false };
  if (!leise && ev.ende) { ui.showPrompt(ev.ende); hinweisBis = performance.now() + 8000; }
  setEreignisRequisite(ev, false);
  try { audio?.ereignis?.(ev.sound, 'ende'); } catch (e) { /* ohne Ton */ }
  setAlleRegen(false);
}
function setAlleRegen(an) {
  regenAktiv = an;
  for (const k of kunden) { setRegen(k.group, an); if (k.group.userData.partner) setRegen(k.group.userData.partner, an); }
}
function setEreignisRequisite(ev, an) {
  // Requisite per Content-Slug (moewe | wolke | schiff | kuchen | kerze | leerer_pier) oder Ereignis-id, Dauer aus den Daten
  try { ereignisSteuer.setEreignis(ev.requisite || ev.id, an, { dauer: ev.dauer_s || 120, from: { x: state.x, z: state.z }, dir: { x: 0.3, z: 1 } }); } catch (e) { /* ohne Requisite */ }
}
function morgen() {
  zielGemeldet = false;
  refreshKokos();
  game = { ...game, folgen: {} }; handtuecherWeg();
  planeSzenen();
  // Tagesereignis: Einblendung, Requisite (world.setEreignis, falls vorhanden), Sound (audio.ereignis, falls vorhanden)
  const ev = game.ereignis;
  ui.showPrompt(null);
  if (ev && game.ereignisAktiv) ereignisStart(ev); // morgen: sofort; mittag/abend: der Loop startet es im Zeitfenster
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
  sfx('morgen');
}

// ---------- Genau hinschauen ----------
// Kamera-Abstand und Blickhöhe wachsen mit der Statur des Kunden (Figuren sind ±15 % groß)
function inspectOpts(k) {
  const sc = k.group.scale.x || 1;
  return { dist: 5.4 * sc, height: 1.95 * sc, targetY: 1.55 * sc }; // Blick etwas höher: Stirn (Mützen-Streifen) bleibt im Bild
}
// Beim Hinschauen sollen Hände nicht vor dem Gesicht sein (Foto, Handy, Hand über den Augen): solange neutral stehen, danach zurück in die Tätigkeit
const HAENDE_VORM_GESICHT = ['foto', 'handy', 'meer', 'winken'];
function inspectPoseAn(k) {
  if (!k || !HAENDE_VORM_GESICHT.includes(k.group.userData.pose)) return;
  figurePose(k.group, 'stehen'); holdPose(k.group, 'stehen');
  k.group.userData.inspectPose = true; k.group.userData.poseOffset = 0; k.group.position.y = 0;
}
function inspectPoseAus(k) {
  if (!k?.group.userData.inspectPose) return;
  k.group.userData.inspectPose = false; k.group.userData.pose = null; // applyKunde setzt die Tätigkeits-Pose wieder
}
function toggleInspect() {
  if (mode === 'inspect') endInspect();
  else if (nearK) { talking = nearK; mode = 'inspect'; inspectPoseAn(nearK); markHint('look'); sfx('look'); showInspectHint(); if (nearK.def.zivi) bark(nearK, 'zivi_verdaechtig', 3.5); }
}
function endInspect() { mode = 'free'; inspectPoseAus(talking); markHint('end'); ui.showPrompt(null); stopBabble(); tutorialFire('nach_hinschauen'); }
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
  const neben = mode === 'dialog' && talking?.npc; // Gespräch im Anschau-Modus: Dialog neben dem Gesicht statt darüber
  ui.placeBubble((headWorld.x + 1) / 2 * window.innerWidth + (neben ? window.innerWidth * 0.24 : 0), (1 - headWorld.y) / 2 * window.innerHeight + (neben ? window.innerHeight * 0.3 : 0));
}

// ---------- Verdeckung: was zwischen Kamera und Spieler steht (oder direkt vor der Linse), wird durchsichtig ----------
// Materialien sind pro Farbe geteilt, deshalb bekommt jedes betroffene Mesh beim Ausblenden eine eigene Kopie.
const faded = new Map(); // mesh -> Originalmaterial
const fadeRay = new THREE.Raycaster(); fadeRay.camera = camera;
const tmpV = new THREE.Vector3();
const tmpSphere = new THREE.Sphere();
const FADE_OPACITY = 0.25;
const FADE_OPACITY_PALME = 0.1; // Palmenkrone/-stamm über dem Spieler: fast weg, sonst färbt der grüne Schleier die Figur
function fadeMesh(m, op = FADE_OPACITY) {
  if (!m.isMesh) return;
  if (faded.has(m)) { for (const c of (Array.isArray(m.material) ? m.material : [m.material])) { if (c.isShaderMaterial) c.uniforms.opacity.value = op; else c.opacity = op; } return; }
  const orig = m.material;
  faded.set(m, orig);
  const mats = Array.isArray(orig) ? orig : [orig];
  const clones = mats.map((mat) => {
    const c = mat.clone();
    c.transparent = true;
    if (c.isShaderMaterial) c.uniforms.opacity.value = op; else c.opacity = op;
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
  for (const grp of groups) { const op = grp.userData.crown ? FADE_OPACITY_PALME : FADE_OPACITY; grp.traverse((m) => { if (m.isMesh) { fadeMesh(m, op); keep.add(m); } }); }
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
    const txt = mentorBesucht(game) ? 'Mentor — F: kurz hallo sagen' : (TOUCH ? '💬 Reden: dem Mentor zuhören (Lektion + Nachschub)' : 'Mentor — F: zuhören (Lektion + Nachschub)');
    ui.showPrompt(txt); ui.showBadge(null); ui.pulseButtons({ talk: true }); return;
  }
  if (!nearK && nearPoint) {
    const txt = nearPoint.id === 'kokos' ? `${kokosTexte.name} — E: Kokosnuss (${kokosTexte.preis} Münzen)` : nearPoint.id === 'mango_stand' ? 'Mango-Stand — E: Mango kaufen (10 Münzen)' : nearPoint.id === 'tuktuk' ? `Tuk-Tuk — E: zur Bar (${TUKTUK_PREIS_MANGOS} Mangos oder ${TUKTUK_PREIS_GELD} Münzen)` : (game.mangos > 0 ? 'Pong — E: Mango abgeben (1 Mango = 1 Gnade)' : 'Pong — E: ansprechen');
    ui.showPrompt(txt); ui.showBadge(null); ui.pulseButtons({ talk: true }); return;
  }
  if (!nearK) { ui.showPrompt(erfolg ? texte.finale.hinweis : null, { small: true }); ui.showBadge(null); ui.pulseButtons(null); return; }
  const name = nearK.def.name || nearK.def.typ;
  const firstTalk = !hintSeen('talk'), firstLook = !hintSeen('look');
  if (firstTalk || firstLook) {
    const parts = [];
    if (firstTalk) parts.push(TOUCH ? '💬 Reden (Blick aufs Gesicht)' : 'F: ansprechen (Blick aufs Gesicht)');
    if (firstLook && !firstTalk) parts.push('genau hinschauen (Schuhe!)');
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
  ui.showBadge(['F'], (badgeWorld.x + 1) / 2 * window.innerWidth, (1 - badgeWorld.y) / 2 * window.innerHeight);
}

// ---------- Fähre: wer mit der Fähre kommt (Spawn-Code K1), steigt beim Anlegen am Steg aus und geht zu seinem Platz ----------
let ferryWasDocked = false;
let ferryHorn = false;
// Wasserball am Startstrand: kickbar (logic.ballStep), rollt aus, prallt an Collidern und am Wasser ab
let ball = { x: -20, z: 9.5, vx: 0, vz: 0, r: 0.42 };
function updateBall(dt) {
  const vorher = ball;
  ball = ballStep(ball, state, dt, colliders);
  const m = world.wasserball; if (!m) return;
  if (ball.kicked && !vorher.kicked) sfx('ball', { pan: panFor(m) });
  m.position.set(ball.x, ball.r, ball.z);
  if (ball.rollt) { m.rotation.x += ball.vz * dt / ball.r; m.rotation.z -= ball.vx * dt / ball.r; } // rollt in Fahrtrichtung
}
function updateFerry(t) {
  if (!world.pier?.ferry) return;
  const f = world.pier.ferry(t);
  const docked = f.state === 'docked';
  if (f.horn && !ferryHorn) sfx('tuten'); // Fährhorn, wenn das Pier-Modul es vorgibt (kurz vor dem Anlegen, beim Ablegen)
  ferryHorn = !!f.horn;
  if (docked && !ferryWasDocked) {
    const sp = world.pier.ferrySpawn;
    besucherWechsel(sp); // Wartende fahren ab, 1–2 neue Besucher steigen aus
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
      k.npc = k.besucher ? besucherStep(k.npc, dt, { docked: ferryWasDocked }) : wanderStep(k.npc, dt);
      k.npc.phase = (before.phase || 0) + Math.hypot(k.npc.x - before.x, k.npc.z - before.z) * (Math.PI * 2 / 1.6);
      if (k.npc.moving && k.group.visible) spurLegen(k, 'spurTrack', before, k.npc, k.npc.yaw, regenAktiv ? 'gummistiefel' : k.def.schuhe, performance.now() / 1000);
      const want = kundeLookYaw(k.npc, state);
      k.look += (want - k.look) * (1 - Math.exp(-3 * dt));
    }
    applyKunde(k);
  }
}

// ---------- Snap: einmal rendern an fester Stelle ----------
// Kunde per id, notfalls aus einem späteren Tag (Zivis rotieren)
function kundeById(id) {
  let k = kunden.find((x) => x.id === id);
  for (let day = 2; !k && day <= 7; day++) { spawnKunden(day); k = kunden.find((x) => x.id === id); }
  if (!k) { spawnKunden(1, { erzwinge: id }); k = kunden.find((x) => x.id === id); } // nicht in der Rotation: zusätzlich spawnen
  return k;
}
function setupScene() {
  // ?t= (Uhr-t) gilt auch ohne Szene; HUD mit Uhr auffrischen, bevor eine Szene früh zurückkehrt
  if (TAG && Number.isFinite(parseInt(TAG, 10))) { game = { ...game, tag: Math.max(1, parseInt(TAG, 10)) }; planeSzenen(); spawnKunden(game.tag); }
  if (T01) { tagesuhr = { t01: Math.max(0, Math.min(1, parseFloat(T01))) }; applyTageszeit(); placeMentor(barBeendetTag(tagesuhr.t01)); }
  refreshHud();
  if (q('kopf')) setzeSchluffi(q('kopf')); // Schnappschuss mit Kopfbedeckung
  if (SCENE === 'figur_wahl') { showFigurWahl(); return; }
  if (SCENE === 'titel') { showTitle(); return; }
  if (SCENE === 'intro') { startIntro({ halt: parseFloat(q('bei') || '2') }); return; }
  if (SCENE === 'erfolg') { game = { ...game, tag: woche.tage.length, geld: woche.ziel.muenzen + 10, finale: 'gut' }; refreshHud(); erfolgTableau(); return; }
  if (!SCENE || kunden.length === 0) return;
  if (SCENE === 'gag') {
    // Kunde mitten im Kauf-Gag: ggf. Tag wechseln, bis der Kunde dran ist (Zivis rotieren)
    const k = kundeById(SCENE_ID) || kunden[0];
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
  if (SCENE === 'menue') { openMenu(); return; }
  if (SCENE === 'szene') { // ?scene=szene&id=pong_mittag: Tag 2, Uhr in die Mitte des Fensters, Spieler am Ort, Szene läuft
    const sz = szenen.find((x) => x.id === SCENE_ID) || szenen[0];
    game = { ...game, tag: Math.max(game.tag, sz.ab_tag) }; szenenHeute = [sz]; szenenLauf = {};
    tagesuhr = { t01: (sz.fenster.von + sz.fenster.bis) / 2 }; applyTageszeit(); refreshHud();
    const ort = SZENE_ORT(sz.ort);
    mode = 'free';
    updateSzenen(0); updateSzenenFiguren(performance.now() / 1000, 0.5);
    // Spieler landseitig (−z) vor den Figuren, Blick aufs Meer: die Kamera schaut Richtung +z, die Figuren stehen davor
    const figs = Object.entries(szenenFiguren[sz.id] || {}).filter(([k]) => !k.startsWith('_')).map(([, f]) => f);
    const zMin = figs.length ? Math.min(...figs.map((f) => f.z)) - (figs.some((f) => f.kreis) ? KINDER_KREIS.r : 0) : ort.z;
    const xMitte = figs.length ? figs.reduce((a, f) => a + f.x, 0) / figs.length : ort.x;
    state = { ...state, x: xMitte, z: zMin - 5, yaw: 0, speed: 0 };
    for (const s of streifen) applyCop(s);
    const erster = sz.schritte.find((st) => st.bark || (st.aktion === 'sag' && st.text)); if (erster) szenenSchritt(sz, { ...erster, dauer: 999 }, performance.now(), { halten: true });
    if (sz.schritte.some((st) => st.wer === 'streife' && st.pose === 'stolpern')) { // Kinder mit Streife: P1 liegt gerade im Sand, links vom Kreis
      const s = streifen[0]; s.patrol = { ...s.patrol, x: ort.x - 4, z: ort.z + 0.5, yaw: Math.PI / 2, mode: 'patrol' }; streifeStolpert(s, performance.now() / 1000 - 1.2, 5); applyCop(s);
      stolpern(s.group, 1.2 / 5);
    }
    return;
  }
  if (SCENE === 'kokos') { // Verkäufer neben dem Schluffi am Wasser, Ruf-Blase, Kauf-Blase
    kokos = { ...kokos, x: state.x + 2.2, z: state.z + 2.5, yaw: -Math.PI / 2, moving: true, phase: 1.2 };
    applyKokos(0, 300); try { kokosFig.userData.setRuf?.(true); } catch (e) { /* ignorieren */ } applyKokos(0, 300);
    ui.showBark('kokos', kokosTexte.ruf, 999);
    startKokos();
    if (q('kauf')) { game = { ...game, geld: 20 }; kokosChoice(0); spielerNuss.visible = true; try { kokosFig.userData.setRuf?.(false); kokosFig.userData.update?.(0.6, { gehen: false }); } catch (e) { /* ignorieren */ } } // ?kauf=1: Machetenhieb + Nuss in Schluffis Hand
    return;
  }
  if (SCENE === 'liegen') { // zwei Kunden auf den Hotel-Liegen (Pose liegestuhl), Spieler davor am Strand
    const ids = ['liege_1', 'liege_2'];
    kunden.slice(0, 2).forEach((k, i) => {
      const a = ANCHORS.find((x) => x.id === ids[i]); const liege = world.liegen?.[ids[i]];
      if (!a || !liege) return;
      k.anchor = a; k.liege = liege; k.group.userData.pose = null;
      k.npc = { ...k.npc, x: liege.sitz.x, z: liege.sitz.z, yaw: liege.yaw, moving: false, pause: 99, points: [{ x: liege.sitz.x, z: liege.sitz.z }] };
      k.look = 0; applyKunde(k);
    });
    state = { ...state, x: 31, z: 2.5, yaw: Math.PI, speed: 0 }; camYaw += Math.PI; // Kamera von der Meerseite auf die Liegen
    mode = 'free';
    return;
  }
  if (SCENE === 'spuren') { // Schluffi-Sandalen und Turnschuh-Spur eines Kunden im Sand, verschieden alt
    const t0 = 3.2;
    let tr = null, pos = { x: state.x - 6, z: state.z - 3 };
    for (let i = 0; i < 60; i++) { const to = { x: pos.x + 0.1, z: pos.z + 0.05 }; const r = spurSchritt(tr, pos, to, Math.atan2(0.1, 0.05), 'sandale', t0 - 12 + i * 0.2); tr = r.track; for (const sp of r.spuren) spuren.add(sp, 0); pos = to; }
    let tr2 = null; pos = { x: state.x + 5, z: state.z + 6 };
    for (let i = 0; i < 50; i++) { const to = { x: pos.x - 0.02, z: pos.z - 0.1 }; const r = spurSchritt(tr2, pos, to, Math.atan2(-0.02, -0.1), 'turnschuh', t0 - 4 + i * 0.08); tr2 = r.track; for (const sp of r.spuren) spuren.add(sp, 0); pos = to; }
    spuren.update(t0);
    mode = 'free';
    return;
  }
  if (SCENE === 'ereignis') { // ?scene=ereignis&id=regenschauer: Tag 2, Ereignis läuft sofort
    const ev = ereignisse.find((e) => e.id === SCENE_ID) || ereignisse[0];
    game = { ...game, tag: 2, ereignis: ev, ereignisAktiv: false }; refreshHud();
    ereignisStart(ev);
    try { ereignisSteuer.update(1); ereignisSteuer.update(31); } catch (e) { /* ohne Requisiten */ }
    const k = kunden[0]; const pk = k.npc.points[0]; // neben dem ersten Kunden stehen (Gummistiefel im Bild)
    k.npc = { ...k.npc, x: pk.x, z: pk.z, yaw: 0, moving: false, pause: 99 };
    state = { ...state, x: pk.x + 1.7, z: pk.z - 1.8, yaw: Math.atan2(-1.7, 1.8), speed: 0 };
    k.npc.yaw = Math.atan2(state.x - k.npc.x, state.z - k.npc.z); k.look = 0; applyKunde(k);
    mode = 'free';
    return;
  }
  if (SCENE === 'finale') { game = { ...game, tag: woche.tage.length, geld: 710, finale: 'gut' }; refreshHud(); applyFinale('gut'); showFinaleKarte(); return; }
  if (SCENE === 'huette') { state = { ...state, x: -57, z: 10, yaw: Math.PI, speed: 0 }; camYaw += Math.PI; mode = 'free'; return; } // Finale-Hütte am Weststrand, Kamera von der Meerseite
  if (SCENE === 'tutorial') {
    // Schritt „hinschauen“: Kunde in Reichweite, Zielmarker am Kunden, Hinweiskasten oben
    const k = kunden[0]; const p = k.npc.points[0];
    k.npc = { ...k.npc, x: p.x, z: p.z, yaw: 0, moving: false, pause: 99 };
    state = { ...state, x: p.x + 1.7, z: p.z - 1.8, yaw: Math.atan2(-1.7, 1.8), speed: 0 };
    k.npc.yaw = Math.atan2(state.x - k.npc.x, state.z - k.npc.z); k.look = 0; applyKunde(k);
    nearK = k;
    tutorial = tutorialEvent(tutorialStart(), tutorialTexte, 'tag1_start').tut;
    tutorialFire('kunde_in_reichweite');
    updateTutorial(0);
    updateMarker(marker, 3.2);
    mode = 'free';
    return;
  }
  if (SCENE === 'start') { showStart({ ...initialState(), tag: 3, geld: 140, ware: 4 }); return; }
  if (SCENE === 'figur') {
    // Einzelfigur auf offenem Sand, Blick zur Kamera: ?scene=figur&id=surfer_1[&cy=50]
    const k = (SCENE_ID && kundeById(SCENE_ID)) || kunden[0];
    state = { ...state, x: 7, z: 4, yaw: -Math.PI / 2, speed: 0 };
    let c = cam; for (let i = 0; i < 300; i++) c = followCamera(c, state, 1 / 60, camYaw, 4, camPitch);
    k.npc = { ...k.npc, x: 4, z: 6, yaw: Math.atan2(c.x - 4, c.z - 6), moving: false, pause: 99 };
    k.look = 0; applyKunde(k);
    mode = 'free';
    return;
  }
  if (SCENE === 'lineup') {
    // Gruppenbild: alle Kunden in einer Reihe, Blick zur Kamera (Kamera von Süden, tief); ?id= holt den Tag dieses Kunden
    if (SCENE_ID) kundeById(SCENE_ID);
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
  const k = SCENE === 'inspect' ? ((SCENE_ID && kundeById(SCENE_ID)) || kunden.find((x) => x.def.zivi) || kunden[1] || kunden[0]) : kunden[0];
  const p = k.npc.points[0];
  k.npc = { ...k.npc, x: p.x, z: p.z, yaw: 0, moving: false, pause: 99 };
  // Spieler schräg nördlich vom Kunden, damit das Kundengesicht zur (nördlichen) Kamera zeigt
  state = { ...state, x: p.x + 1.7, z: p.z - 1.8, yaw: Math.atan2(p.x - (p.x + 1.7), p.z - (p.z - 1.8)), speed: 0 };
  k.npc.yaw = Math.atan2(state.x - k.npc.x, state.z - k.npc.z);
  k.look = 0;
  applyKunde(k);
  talking = k;
  if (SCENE === 'inspect') inspectPoseAn(k);
  if (SCENE === 'dialog') {
    dialog = advanceDialog(startDialog(k.def, game, 0, texte), texte);
    selected = 0;
    mode = 'dialog';
    renderBubble();
  } else {
    mode = 'inspect';
    showInspectHint();
  }
}

if (SNAP) {
  Promise.all([loadTexte(), loadStimmen(), loadKunden(), loadSzenen()]).then(() => {
    const overview = AT === 'overview';
    setupScene();
    if (!erfolgSitzt) applyPose(state);
    for (let i = 0; i < 300; i++) cam = followCamera(cam, state, 1 / 60, camYaw, 4, camPitch);
    if (overview) { cam = { x: 12, y: 135, z: -160, tx: 12, ty: 0, tz: -22 }; scene.fog = null; camera.near = 20; camera.updateProjectionMatrix(); } // Übersicht ohne Nebel; near 20 gegen Tiefen-Streifen (Gras über Sand) in der Ferne
    if (mode === 'inspect') {
      cam = inspectCamera(talking.npc, state, inspectOpts(talking));
      talking.npc.yaw = Math.atan2(cam.x - talking.npc.x, cam.z - talking.npc.z);
      applyKunde(talking);
    }
    if (SCENE === 'lineup') cam = { x: 0, y: 3.2, z: 6 + 16.5, tx: 0, ty: 1.2, tz: 6 };
    if (mode === 'bar') cam = barCamera();
    if (mode === 'dialog' && talking?.npc) cam = inspectCamera(talking.npc, state, inspectOpts(talking)); // Gespräch läuft im Anschau-Modus
    if (mode === 'intro') cam = introCamera(performance.now());
    if (erfolg && fw) { for (let t = 0; t < 4; t += 1 / 60) fw.update(t); } // Schnappschuss: Raketen und Bursts gleichzeitig im Bild
    if (!SCENE || SCENE !== 'szene') { updateSzenen(performance.now()); updateSzenenFiguren(performance.now() / 1000, 0.5); } // Ambient-Szenen auch im Schnappschuss
    applyCamera();
    camera.updateMatrixWorld();
    world.huegel.update(3.2);
    world.markt?.update?.(3.2);
    world.pier?.update?.(3.2);
    world.reis?.update?.(3.2);
    world.hain?.update?.(3.2);
    try { updateNong(world.nong, 3.2); } catch (e) { /* ohne Figur */ }
    if (SCENE !== 'streife' && SCENE !== 'verfolgung' && SCENE !== 'streife2') applyCops();
    try { world.markt?.setTafel?.(0); } catch (e) { /* ignorieren */ }
    world.group.updateMatrixWorld(true);
    kundenGroup.updateMatrixWorld(true);
    updateFade(mode === 'inspect' ? talking.npc : state);
    const shoot = () => {
      resize(); camera.updateMatrixWorld();
      if (SCENE === 'badge' || SCENE === 'hint' || SCENE === 'bark' || SCENE === 'kokos' || SCENE === 'szene') { const near = nearestKunde(state, kundenPos()); nearK = near ? near.ref : null; updateNearHint(); placeBarks(); }
      if (mode === 'dialog' || mode === 'mentor' || mode === 'info' || mode === 'bar' || mode === 'kokos') placeBubbleAtHead();
      renderer.render(scene, camera);
      requestAnimationFrame(() => { resize(); if (mode === 'dialog' || mode === 'mentor' || mode === 'info' || mode === 'bar' || mode === 'kokos') placeBubbleAtHead(); renderer.render(scene, camera); stats(); });
    };
    if (document.readyState === 'complete') shoot(); else window.addEventListener('load', shoot);
    window.addEventListener('resize', shoot);
  });
} else {
  resize();
  window.addEventListener('resize', resize);
  Promise.all([loadTexte(), loadStimmen(), loadKunden(), loadSzenen()]).then(() => { if (SNAP || SCENE || AT || T01) beginTutorial(); else showTitle(); }); // Schnappschüsse ohne Titel
  let last = performance.now();
  renderer.setAnimationLoop((now) => {
    const dt = Math.min(0.05, (now - last) / 1000);
    frameMs = now - last;
    last = now;
    if (!mentorAmTresen) world.huegel.update(now / 1000);
    world.markt?.update?.(now / 1000);
    world.pier?.update?.(now / 1000);
    world.reis?.update?.(now / 1000);
    world.hain?.update?.(now / 1000);
    try { world.surfer?.userData.update?.(now / 1000); } catch (e) { /* ohne Zzz */ }
    try { updateNong(world.nong, now / 1000); } catch (e) { /* ohne Figur */ }
    if (nongMoodAt && now > nongMoodAt) nongSag(nongBaseMood());
    updateFerry(now / 1000);
    if (now > tafelAt) { tafelAt = now + 500; const n = isArrested(game) ? 0 : (game.tageOhneVorfall || 0); if (n !== tafelShown) { tafelShown = n; try { world.markt?.setTafel?.(n); } catch (e) { /* ignorieren */ } } }
    const free = mode === 'free' || mode === 'inspect'; // dialog/mentor/info/card: stehen bleiben
    if (free) {
      if (keys.rotL) camYaw += 1.5 * dt;
      if (keys.rotR) camYaw -= 1.5 * dt;
      if (keys.pitchUp) setPitch(camPitch + 1.0 * dt);
      if (keys.pitchDown) setPitch(camPitch - 1.0 * dt);
      let dir = inputToDir(keys, camYaw);
      let run = keys.run;
      if (joy && joy.active) { dir = rotateDir(joy, camYaw); run = joy.run; }
      if (dir.x === 0 && dir.z === 0 && clickTarget) {
        dir = dirToTarget(state, clickTarget);
        if (!dir) clickTarget = null;
      }
      if (erfolgSitzt && ((dir.x !== 0 || dir.z !== 0) || clickTarget)) erfolgAufstehen(); // im Liegestuhl: erst aufstehen
      if (erfolgSitzt) { dir = { x: 0, z: 0 }; clickTarget = null; }
      const vorher = { x: state.x, z: state.z };
      state = stepPlayer(state, { dir, run }, dt, colliders, WORLD, { schuhe: PLAYER_SCHUHE });
      if (state.moving) { const h = { s: spielerSpur }; spurLegen(h, 's', vorher, state, state.yaw, regenAktiv ? 'gummistiefel' : PLAYER_SCHUHE, now / 1000); spielerSpur = h.s; }
      if (state.stumbled) sfx('schritt');
    } else {
      state = stepPlayer(state, { dir: null, run: false }, dt, colliders);
    }
    if (!erfolgSitzt) applyPose(state); // im Liegestuhl bleibt die Pose stehen
    try { fw?.update(now / 1000); } catch (e) { /* ohne Feuerwerk */ }
    if (free && !erfolg) {
      const prev = tagesuhr.t01;
      tagesuhr = clockStep(tagesuhr, dt);
      applyTageszeit();
      if (abendBeginnt(prev, tagesuhr.t01)) { placeMentor(true); sunsetAt = 0; tutorialFire('sonnenuntergang'); }
      // Ereignis-Zeitfenster (Regenschauer mittags für 120 s): Start und Ende an der Uhr
      if (game.ereignis) { const f = ereignisFenster(game.ereignis); if (!game.ereignisAktiv && prev < f.start && tagesuhr.t01 >= f.start && f.ende > f.start) ereignisStart(game.ereignis); else if (game.ereignisAktiv && tagesuhr.t01 >= f.ende && f.ende < 1) ereignisEnde(game.ereignis); }
      // Nong tagsüber: ein Zwischenruf pro Vorbeigehen am Tresen, höchstens alle 30 s
      const amTresen = inBar(state, BUILDING_POS.bar, 5);
      if (amTresen && !warAmTresen && !barBeendetTag(tagesuhr.t01) && now > zwischenrufAt) { zwischenrufAt = now + 30000; ui.showBark('barkeeper', zwischenrufLine(abendTexte, lineIdx++), 3.2); nongSag('gruss', now); try { audio?.bark?.('barkeeper', 'zwischenruf', { pan: panFor(barkeeperObj) }); } catch (e) { /* ohne Ton */ } }
      warAmTresen = amTresen;
      if (barBeendetTag(tagesuhr.t01) && now > sunsetAt) { sunsetAt = now + 20000; ui.showBark('spieler', sonnenuntergangLine(abendTexte, lineIdx++), 4); }
      if (nachtBeginnt(prev, tagesuhr.t01)) { nachtArt = 'haengematte'; sfx('gaehnen'); endDay(einschlafenLine(abendTexte, lineIdx++, { belegt: !!game.folgen?.abends_haengematte_belegt })); }
      if (Math.floor(prev * 1000) !== Math.floor(tagesuhr.t01 * 1000)) refreshHud();
    }
    if (nearK) tutorialFire('kunde_in_reichweite');
    if (hinweisBis && now > hinweisBis) { hinweisBis = 0; if (mode === 'free') ui.showPrompt(null); }
    flushPitch(now);
    try { ereignisSteuer.update(now / 1000); } catch (e) { /* ohne Requisiten */ }
    spuren.update(now / 1000);
    for (const k of kunden) updateKundenExtras(k.group, now / 1000);
    updateTutorial(now);
    updateSzenen(now);
    updateSzenenFiguren(now / 1000, dt);
    if (free) updateBall(dt);
    updatePatrol(dt, now);
    updateKokos(dt, now);
    spielerNuss.visible = kokosSchutz(game, tagesuhr.t01);
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
    if (mode === 'intro') {
      cam = introCamera(now);
    } else if (((mode === 'inspect' || mode === 'dialog') && talking?.npc && talking.group) || mode === 'bar') { // Gespräch und Hinschauen: Kamera vors Gesicht
      const want = mode === 'bar' ? barCamera() : inspectCamera(talking.npc, state, inspectOpts(talking));
      const t = 1 - Math.exp(-5 * dt);
      for (const key of ['x', 'y', 'z', 'tx', 'ty', 'tz']) cam[key] += (want[key] - cam[key]) * t;
    } else {
      cam = followCamera(cam, state, dt, camYaw, 4, camPitch);
    }
    applyCamera();
    camera.updateMatrixWorld();
    updateFade((mode === 'inspect' || mode === 'dialog') && talking?.npc ? talking.npc : state);
    if (mode === 'dialog' || mode === 'mentor' || mode === 'info' || mode === 'bar' || mode === 'kokos') placeBubbleAtHead();
    renderer.render(scene, camera);
    stats();
  });
}
