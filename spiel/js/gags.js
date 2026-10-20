// gags.js — Reveal-Gags je Kunde (Daten: data/texte.json → reveal_gags[]). Requisiten als kleine Meshes,
// Posen als reine Zeitfunktion: playGag(figur, eintrag, t) setzt Arme/Beine/Kopf/Hund und Sichtbarkeiten
// allein aus t (Sekunden seit Start). kauf/ablehnung halten den Endzustand ab t ≥ dauer_s, immer-Gags kehren
// zur Grundpose zurück. stopGag() stellt die Grundpose her. Figur = Ergebnis von buildKunde() aus kunden.js.
import * as THREE from 'three';
import { toonMesh, textTexture, BLACK } from './toon.js';
import { limb } from './props.js';
import { setMood } from './kunden.js';

const V = (x, y, z) => new THREE.Vector3(x, y, z);
const clamp01 = (x) => Math.max(0, Math.min(1, x));
const ease = (x) => { const u = clamp01(x); return u * u * (3 - 2 * u); };
// Anteil 0..1 innerhalb eines Zeitfensters [a, b]
const win = (t, a, b) => ease((t - a) / Math.max(1e-6, b - a));
// Auf-und-ab innerhalb [a, b]: 0 → 1 → 0
const bump = (t, a, b) => { const u = clamp01((t - a) / Math.max(1e-6, b - a)); return Math.sin(u * Math.PI); };

// Mesh einer Figur über die Maße seiner BoxGeometry finden (so sind Sonnenbrille, Preisschild,
// Funkgerät und Kamera erreichbar, ohne kunden.js zu ändern). null, wenn nicht vorhanden.
function findBox(root, w, h, d) {
  let hit = null;
  root.traverse((m) => {
    if (hit || !m.isMesh || m.geometry.type !== 'BoxGeometry') return;
    const p = m.geometry.parameters;
    if (Math.abs(p.width - w) < 1e-3 && Math.abs(p.height - h) < 1e-3 && Math.abs(p.depth - d) < 1e-3) hit = m;
  });
  return hit;
}
function findSunglasses(head) {
  return head.children.filter((m) => m.isMesh && ((m.geometry.type === 'CylinderGeometry' && Math.abs(m.position.z - 0.5) < 0.01 && Math.abs(m.position.y - 0.08) < 0.01)
    || (m.geometry.type === 'BoxGeometry' && Math.abs(m.position.z - 0.52) < 0.01 && Math.abs(m.position.y - 0.1) < 0.01)));
}

// ---------- Requisiten ----------
function badge(r = 0.14) {
  const g = new THREE.Group();
  const disc = toonMesh(new THREE.CylinderGeometry(r, r, 0.04, 8), 0xffd54a, { outline: 0.02 });
  disc.rotation.x = Math.PI / 2; g.add(disc);
  const star = toonMesh(new THREE.CylinderGeometry(r * 0.55, r * 0.55, 0.05, 5), 0x2a3f8f, { outline: 0.015 });
  star.rotation.x = Math.PI / 2; star.position.z = 0.01; g.add(star);
  const strap = toonMesh(new THREE.BoxGeometry(r * 1.6, r * 0.6, 0.03), 0x222222, { outline: 0.015 });
  strap.position.y = -r * 1.1; g.add(strap);
  return g;
}
function notepad() {
  const g = new THREE.Group();
  const pad = toonMesh(new THREE.BoxGeometry(0.28, 0.36, 0.04), 0xfff9e6, { outline: 0.02 });
  g.add(pad);
  for (let i = 0; i < 4; i++) {
    const line = toonMesh(new THREE.BoxGeometry(0.18, 0.012, 0.01), BLACK, { outline: 0, basic: true });
    line.position.set(0, 0.1 - i * 0.07, 0.025); g.add(line);
  }
  const spiral = toonMesh(new THREE.BoxGeometry(0.26, 0.04, 0.06), 0x555566, { outline: 0.015 });
  spiral.position.y = 0.18; g.add(spiral);
  return g;
}
function pencil() {
  const g = new THREE.Group();
  g.add(limb(V(0, 0, 0), V(0, 0.3, 0), 0.025, 0xffd54a, { outline: 0.012 }));
  const tip = toonMesh(new THREE.ConeGeometry(0.025, 0.06, 6), 0x222222, { outline: 0.01 });
  tip.position.y = -0.03; tip.rotation.x = Math.PI; g.add(tip);
  return g;
}
function thumb() {
  const t = toonMesh(new THREE.CylinderGeometry(0.05, 0.055, 0.22, 8), 0xe8a773, { outline: 0.02 });
  t.rotation.x = Math.PI / 2;
  return t;
}
function watch() {
  const g = new THREE.Group();
  const band = toonMesh(new THREE.TorusGeometry(0.13, 0.03, 6, 14), 0x222233, { outline: 0.015 });
  band.rotation.x = Math.PI / 2; g.add(band);
  const screen = toonMesh(new THREE.BoxGeometry(0.14, 0.03, 0.12), 0x6ee7ff, { outline: 0.015 });
  screen.position.set(-0.12, 0.0, 0); screen.rotation.z = 0.3; g.add(screen);
  const heart = toonMesh(new THREE.SphereGeometry(0.03, 6, 5), 0xe8463a, { outline: 0, basic: true });
  heart.position.set(-0.15, 0.03, 0); g.add(heart);
  return g;
}
function lightCone() {
  const geo = new THREE.ConeGeometry(0.5, 1.4, 12, 1, true);
  geo.translate(0, -0.7, 0);
  const m = new THREE.Mesh(geo, new THREE.MeshBasicMaterial({ color: 0xfff1a0, transparent: true, opacity: 0.45, side: THREE.DoubleSide, depthWrite: false }));
  return m;
}
function flash() {
  const m = new THREE.Mesh(new THREE.SphereGeometry(0.35, 10, 8), new THREE.MeshBasicMaterial({ color: 0xffffff, transparent: true, opacity: 0.9, depthWrite: false }));
  return m;
}
function bubble(text, w = 0.9) {
  const tex = textTexture(text, { bg: 'rgba(0,0,0,0)', fg: '#1a1a1a', font: 'bold 80px sans-serif', w: 512, h: 160 });
  const m = new THREE.Mesh(new THREE.PlaneGeometry(w, w * 0.31), new THREE.MeshBasicMaterial({ map: tex, transparent: true, depthWrite: false }));
  return m;
}

/** Baut alle Requisiten einer Figur einmal (unsichtbar) und merkt sich die Grundpose. Idempotent. */
export function prepareGags(figur) {
  if (figur.userData.gags) return figur.userData.gags;
  const P = figur.userData.parts;
  const k = figur.userData.kunde || {};
  const armR = P.arms[1], armL = P.arms[0];
  const handR = V(0.22, -0.92, 0.1), handL = V(-0.22, -0.92, 0.1);
  if (k.accessoire === 'handy') handR.set(0.09, -0.47, 0.32);
  const G = {
    base: {
      arms: P.arms.map((a) => a.rotation.clone()), legs: P.legs.map((l) => l.rotation.clone()),
      head: P.head.rotation.clone(), dog: P.dog ? { rot: P.dog.rotation.clone(), y: P.dog.position.y } : null,
    },
    props: {},
    baseMood: figur.userData.mood,
  };
  const addProp = (name, mesh, parent, pos) => { mesh.position.copy(pos); mesh.visible = false; parent.add(mesh); G.props[name] = mesh; };
  addProp('badge', badge(), armR, handR.clone().add(V(0.05, 0.1, 0.2)));
  addProp('notepad', notepad(), armL, handL.clone().add(V(0.05, 0.05, 0.22)));
  addProp('pencil', pencil(), armR, handR.clone().add(V(0, 0.05, 0.2)));
  addProp('thumb', thumb(), armR, handR.clone().add(V(0, 0.08, 0.2)));
  addProp('light', lightCone(), armR, handR.clone().add(V(0.05, 0.1, 0.12)));
  addProp('bubble', bubble('Zentrale?'), figur, V(-0.6, 1.9, -0.2));
  addProp('cough', bubble('hust', 0.6), figur, V(0.5, 2.9, 0.3));
  addProp('nichts', bubble('ICH HAB NICHTS', 1.6), figur, V(0, 3.4, 0.2));
  // Pulsuhr: Tell, immer sichtbar
  if ((k.extras || []).includes('pulsuhr') || k.id === 'jogger_1') { const w = watch(); w.position.copy(handL).add(V(0, 0.18, 0)); armL.add(w); G.props.watch = w; }
  // Kamera-Blitz sitzt an der Kamera der Figur (Box 0.34 × 0.22 × 0.2), sonst vor der Brust
  const cam = findBox(figur, 0.34, 0.22, 0.2);
  const fl = flash(); fl.visible = false;
  if (cam) { fl.position.set(0, 0, 0.3); cam.add(fl); } else { fl.position.set(0, 1.6, 0.7); figur.add(fl); }
  G.props.flash = fl;
  G.sunglasses = findSunglasses(P.head).map((m) => ({ m, y: m.position.y, z: m.position.z }));
  G.tag = findBox(figur, 0.3, 0.2, 0.03);
  if (G.tag) G.tagRot = G.tag.rotation.clone();
  G.radio = findBox(figur, 0.16, 0.3, 0.12);
  if (P.dog) {
    const dh = P.dog.userData.head;
    const db = badge(0.11); db.visible = false; db.position.set(0.5, -0.18, 0); db.rotation.y = Math.PI / 2;
    (dh || P.dog).add(db); G.props.dogBadge = db;
    G.dogHead = dh ? { rot: dh.rotation.clone() } : null;
  }
  figur.userData.gags = G;
  return G;
}

/** Grundpose und Sichtbarkeiten wiederherstellen (nach einem kauf/ablehnung-Gag). */
export function stopGag(figur) {
  const G = figur.userData.gags;
  if (!G) return;
  const P = figur.userData.parts;
  P.arms.forEach((a, i) => a.rotation.copy(G.base.arms[i]));
  P.legs.forEach((l, i) => l.rotation.copy(G.base.legs[i]));
  P.head.rotation.copy(G.base.head);
  if (P.dog && G.base.dog) { P.dog.rotation.copy(G.base.dog.rot); P.dog.position.y = G.base.dog.y; }
  if (P.dog && G.dogHead) P.dog.userData.head.rotation.copy(G.dogHead.rot);
  for (const [name, m] of Object.entries(G.props)) if (name !== 'watch') m.visible = false;
  for (const s of G.sunglasses) { s.m.position.y = s.y; s.m.position.z = s.z; }
  if (G.tag) G.tag.rotation.copy(G.tagRot);
  if (figur.userData.mood !== G.baseMood) setMood(figur, G.baseMood);
}

/**
 * Pose/Sichtbarkeit für Gag `g` (Eintrag aus reveal_gags) zur Zeit t (s seit Start) setzen.
 * Rückgabe: true, solange der Gag läuft (t < dauer_s). Danach bleibt bei kauf/ablehnung der Endzustand
 * stehen (bis stopGag), bei `immer` ist die Figur wieder in Grundpose.
 */
export function playGag(figur, g, t) {
  const G = prepareGags(figur);
  const P = figur.userData.parts;
  const D = g.dauer_s || 1;
  const idle = g.wann === 'immer';
  // Grundpose, dann die Pose aus t obendrauf
  stopGag(figur);
  const mood = g.extra === 'polizistenaugen' ? 'reveal' : g.mood;
  if (mood && figur.userData.mood !== mood && (!idle || t < D)) setMood(figur, mood);
  const armR = P.arms[1], armL = P.arms[0], head = P.head, pr = G.props;
  const key = `${g.id}/${g.wann}`;
  switch (key) {
    case 'zivi_1/kauf': { // Lächeln friert ein, Hand ans Ohr, Dienstmarke klappt aus der Tasche
      armL.rotation.x = -2.5 * win(t, 0, 0.5); armL.rotation.z = 0.5 * win(t, 0, 0.5);
      armR.rotation.x = -1.4 * win(t, 0.4, 1.0); armR.rotation.z = -0.3 * win(t, 0.4, 1.0);
      pr.badge.visible = t > 0.5; pr.badge.scale.setScalar(0.2 + 1.3 * win(t, 0.5, 1.1)); // viel zu groß
      head.rotation.z = 0.12 * win(t, 0.2, 0.6);
      break;
    }
    case 'zivi_1/ablehnung': { // tippt in die Luft, schaut zurück
      armR.rotation.x = -1.3 * win(t, 0, 0.3); armR.rotation.z = -0.4 + 0.15 * Math.sin(t * 22);
      armL.rotation.x = -0.6 * win(t, 0, 0.3);
      head.rotation.y = 0.9 * win(t, 0.6, 1.0); head.rotation.x = 0.1;
      break;
    }
    case 'zivi_2/kauf': { // Sonnenbrille rutscht, Polizistenaugen, Preisschild wippt
      const slide = win(t, 0.2, 0.9);
      for (const s of G.sunglasses) { s.m.position.y = s.y - 0.24 * slide; s.m.position.z = s.z + 0.08 * slide; }
      head.rotation.x = 0.12 * slide;
      if (G.tag) G.tag.rotation.z = G.tagRot.z + 0.5 * Math.sin(t * 9) * bump(t, 0, D);
      break;
    }
    case 'zivi_2/ablehnung': { // Notizblock aus dem Hemd, schreibt demonstrativ entspannt
      armL.rotation.x = -1.5 * win(t, 0, 0.4); armL.rotation.z = 0.35 * win(t, 0, 0.4);
      armR.rotation.x = -1.45 * win(t, 0.2, 0.5); armR.rotation.z = -0.45 + 0.08 * Math.sin(t * 25) * win(t, 0.5, 0.6);
      pr.notepad.visible = t > 0.25; pr.pencil.visible = t > 0.4;
      head.rotation.x = 0.35 * win(t, 0.3, 0.6);
      break;
    }
    case 'zivi_2/immer': { // zupft am Preisschild
      const b = bump(t, 0, D);
      armR.rotation.x = -1.1 * b; armR.rotation.z = -0.7 * b + 0.06 * Math.sin(t * 30) * b;
      if (G.tag) G.tag.rotation.z = G.tagRot.z + 0.35 * Math.sin(t * 20) * b;
      break;
    }
    case 'zivi_3/kauf': { // Rex setzt sich kerzengerade, Dienstmarke aus dem Halstuch
      if (P.dog) {
        const s = win(t, 0, 0.6);
        P.dog.rotation.z = G.base.dog.rot.z + 0.5 * s; P.dog.position.y = G.base.dog.y + 0.3 * s;
        if (G.dogHead) P.dog.userData.head.rotation.z = -0.3 * s;
        pr.dogBadge.visible = t > 0.8; pr.dogBadge.scale.setScalar(0.3 + 0.7 * win(t, 0.8, 1.3));
        pr.dogBadge.rotation.z = 0.15 * Math.sin(t * 12);
      }
      head.rotation.z = 0.05 * Math.sin(t * 6); // kaut weiter
      break;
    }
    case 'zivi_3/ablehnung': { // Rex schnüffelt, legt Ohren an, Blick zum Mann; der zuckt mit den Schultern
      if (P.dog && G.dogHead) {
        const dh = P.dog.userData.head;
        dh.rotation.z = -0.55 * bump(t, 0, 0.9) + 0.05 * Math.sin(t * 40) * bump(t, 0, 0.9);
        dh.rotation.y = -0.9 * win(t, 0.9, 1.2);
      }
      armL.rotation.z = 0.6 * win(t, 1.0, 1.4); armR.rotation.z = -0.6 * win(t, 1.0, 1.4);
      head.rotation.z = -0.2 * win(t, 1.0, 1.4);
      break;
    }
    case 'zivi_3/immer': { // Funkgerät knackt „Zentrale?“, Hustanfall zur Tarnung
      const b = bump(t, 0, D);
      pr.bubble.visible = t > 0.1 && t < D * 0.6; pr.bubble.scale.setScalar(0.6 + 0.4 * b);
      if (G.radio) G.radio.rotation.z = 0.15 * Math.sin(t * 50) * bump(t, 0.1, 0.5);
      pr.cough.visible = t > D * 0.55 && t < D;
      head.rotation.x = 0.35 * bump(t, D * 0.55, D * 0.9);
      armR.rotation.x = -1.6 * bump(t, D * 0.5, D);
      break;
    }
    case 'jogger_1/kauf': { // Daumen hoch, Grinsen, auf der Stelle weiter, winkt
      armR.rotation.x = -1.6 * win(t, 0, 0.3); pr.thumb.visible = t > 0.15;
      if (t > 1.0) { armR.rotation.x = -2.8; armR.rotation.z = -0.4 + 0.3 * Math.sin(t * 14); pr.thumb.visible = false; }
      const jog = Math.sin(t * 12) * 0.5 * win(t, 0.3, 0.6);
      P.legs[0].rotation.x = jog; P.legs[1].rotation.x = -jog; armL.rotation.x = -jog * 0.8;
      break;
    }
    case 'jogger_1/ablehnung': { // schaut auf die Pulsuhr, nickt, läuft auf der Stelle
      armL.rotation.x = -2.0 * win(t, 0, 0.3); armL.rotation.z = 0.6 * win(t, 0, 0.3);
      head.rotation.x = 0.45 * win(t, 0.1, 0.4) - 0.15 * Math.sin(t * 10) * win(t, 0.5, 0.7);
      const jog = Math.sin(t * 12) * 0.4;
      P.legs[0].rotation.x = jog; P.legs[1].rotation.x = -jog; armR.rotation.x = jog * 0.6;
      break;
    }
    case 'erstkaeufer_1/kauf': { // Ware: Hand, Hosentasche, Hand, hinter den Rücken; „ICH HAB NICHTS“, Taschenlampe an
      const phase = Math.floor(t / 0.35) % 4;
      armR.rotation.x = [-1.2, 0.4, -1.2, 1.9][phase]; armR.rotation.z = [-0.3, 0.1, -0.3, 0.6][phase];
      if (t >= 1.4) { armR.rotation.x = -1.5; armR.rotation.z = -0.3; pr.light.visible = true; }
      pr.nichts.visible = t > 1.2; pr.nichts.scale.setScalar(0.5 + 0.5 * win(t, 1.2, 1.4));
      head.rotation.y = 0.6 * Math.sin(t * 9);
      break;
    }
    case 'erstkaeufer_1/ablehnung': { // atmet aus, lächelt, erschrickt vor dem eigenen Schatten
      if (t < 1.1 && figur.userData.mood !== 'zufrieden' && t > 0.4) setMood(figur, 'zufrieden');
      if (t >= 1.1 && figur.userData.mood !== 'erschrocken') setMood(figur, 'erschrocken');
      head.rotation.x = 0.3 * bump(t, 0, 0.6);
      const j = win(t, 1.1, 1.3);
      armL.rotation.x = -2.9 * j; armR.rotation.x = -2.9 * j; armL.rotation.z = 0.4 * j; armR.rotation.z = -0.4 * j;
      head.rotation.y = -0.8 * j; head.rotation.x = -0.2 * j;
      break;
    }
    case 'rentner_1/kauf': { // Blitz ins eigene Gesicht, Socken hochziehen, strahlen
      pr.flash.visible = t > 0.35 && t < 0.55;
      head.rotation.x = -0.3 * bump(t, 0.3, 0.7);
      const pull = win(t, 0.7, 1.1) * bump(t, 0.7, 1.5);
      armL.rotation.x = 0.9 * pull; armR.rotation.x = 0.9 * pull; head.rotation.x += 0.5 * pull;
      break;
    }
    default:
      break;
  }
  return t < D;
}
