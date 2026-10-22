// ambient.js — Figuren und Requisiten für die Ambient-Szenen (Leben am Strand ohne Spielwirkung). Bausteine für das
// Szenen-System: jede Figur kommt als Gruppe (Füße auf y = 0, Blick +z) mit userData.parts, userData.update(t) und
// Pose-Schaltern; Ort, Weg und Zeitplan setzt das Spiel von außen. Erwachsene entstehen aus buildKunde() (gleicher Look
// wie die Kundschaft), Kinder haben einen eigenen Bau (kurze Beine, großer Kopf).
//
//   buildKind({ seed, item })            Kind mit 'wasserpistole' | 'eis' | null; update(t, { rennt, spritzt }); kindPose(k, name)
//   buildEhepaar()                        { sie, er, update(t), setStreit(an), setVersoehnt(an) } — gestikulieren bzw. umarmen
//   buildInfluencerin()                   { sie, freund, reflektor, update(t), setFoto(an) } — Selfie-Serie mit Blitz, Freund hält die Scheibe
//   buildBetrunkener()                    Amerikaner im Collegeshirt, Bierdose; update(t, { schwankt }); setSchlaeft(g, an) für die Hängematte
//   handtuchAufLiege(liege, farben)       Handtuch als Reservierung über Sitz und Rückenteil (Kind der Liege); zurück: Gruppe
//   handtuchRolle(farben)                 gerolltes Handtuch als Wurfgeschoss (Position/Flug setzt das Spiel; update(t) dreht es)
//   zzz()                                 schwebende „z z Z“-Tafel mit update(t) (Schläfer aller Art)
import * as THREE from 'three';
import { toonMesh, toon, deform, rng, stripeTexture, textTexture, BLACK } from './toon.js';
import { limb } from './props.js';
import { faceDecal, face, setFace } from './faces.js';
import { kopfOhneSchattenwurf, pose, sneaker } from './figures.js';
import { buildKunde, setMood } from './kunden.js';
import { normalizeKunde } from './game.js';
import { HANDTUCH_FARBEN, handtuchPlan } from './ambient-logik.js';

const V = (x, y, z) => new THREE.Vector3(x, y, z);
const HAND = V(0.22, -0.92, 0.1); // hängende Hand im Arm-Pivot der Kunden (kunden.js)
const smoothstep = (x, a, b) => { const t = Math.min(1, Math.max(0, (x - a) / (b - a))); return t * t * (3 - 2 * t); };

// ---------- Zzz ----------
export function zzz({ size = 1.4 } = {}) {
  const tex = textTexture('z z Z', { bg: 'rgba(0,0,0,0)', fg: '#1a1a1a', font: 'bold 100px sans-serif', w: 256, h: 128 });
  const z = new THREE.Mesh(new THREE.PlaneGeometry(size, size / 2), new THREE.MeshBasicMaterial({ map: tex, transparent: true }));
  z.userData.update = (t) => { z.position.y = z.userData.y0 + 0.15 * Math.sin(t * 1.3); z.material.opacity = 0.7 + 0.3 * Math.sin(t * 2.1); };
  z.userData.y0 = 0;
  return z;
}

// ---------- Kinder ----------
// Klein (Kopf auf ~1.45), großer Kopf, kurze Beine, Kappe oder Zöpfe; item: Wasserpistole (rechts) oder Eis (links).
const KIND_SKINS = [0xf4c9a4, 0xe8a773, 0x8d5a3a, 0xd9a06e];
const KIND_SHIRTS = [0xff5fa2, 0x3dd6e0, 0xffd54a, 0x3bb84a, 0xff7f3f];
export function buildKind({ seed = 1, item = 'wasserpistole' } = {}) {
  const rand = rng(100 + seed);
  const root = new THREE.Group();
  const skin = KIND_SKINS[seed % KIND_SKINS.length], shirt = KIND_SHIRTS[seed % KIND_SHIRTS.length];
  const hipY = 0.62;
  const legs = [];
  for (const s of [-1, 1]) {
    const leg = new THREE.Group(); leg.position.set(s * 0.14, hipY, 0);
    leg.add(limb(V(0, 0, 0), V(0, 0.12 - hipY, 0), 0.075, skin, { outline: 0.03 }));
    const shorts = toonMesh(new THREE.CylinderGeometry(0.12, 0.13, 0.26, 8), 0x3a7bd5, { outline: 0.025 }); shorts.position.y = -0.1; leg.add(shorts);
    const shoe = sneaker([0xe8463a, 0xffffff, 0x3bb84a][seed % 3], s < 0 ? 'L' : 'R'); shoe.scale.setScalar(0.48); shoe.position.set(0, -hipY, 0.02); leg.add(shoe);
    root.add(leg); legs.push(leg);
  }
  const body = new THREE.Group(); body.position.set(0, hipY - 0.04, 0); root.add(body);
  const torso = toonMesh(new THREE.CylinderGeometry(0.22, 0.25, 0.5, 10), shirt, { outline: 0.035 }); torso.position.y = 0.28; body.add(torso);
  const shoulderY = 0.5;
  const arms = [];
  for (const s of [-1, 1]) {
    const arm = new THREE.Group(); arm.position.set(s * 0.26, shoulderY, 0); body.add(arm);
    const sl = toonMesh(new THREE.CylinderGeometry(0.09, 0.1, 0.14, 8), shirt, { outline: 0.025 }); sl.position.set(s * 0.02, -0.05, 0); sl.rotation.z = -s * 0.3; arm.add(sl);
    arm.add(limb(V(0, 0, 0), V(s * 0.08, -0.42, 0.04), 0.055, skin, { outline: 0.025 }));
    const hand = toonMesh(new THREE.SphereGeometry(0.1, 10, 8), skin, { outline: 0.025 }); hand.position.set(s * 0.09, -0.48, 0.05); arm.add(hand);
    arm.userData.hand = hand;
    arms.push(arm);
  }
  // Kopf: groß, Sommersprossen-Seed, Kappe (gerade Seeds) oder Zöpfe (ungerade)
  const head = new THREE.Group(); head.position.set(0, hipY + 0.5 + 0.36, 0.02); root.add(head);
  const hg = new THREE.SphereGeometry(0.36, 20, 16); hg.scale(1, 1.04, 0.96);
  head.add(toonMesh(hg, skin, { outline: 0.04 }));
  const skinCss = '#' + skin.toString(16).padStart(6, '0');
  const decal = faceDecal(face('kunde', 'zufrieden', { skin: skinCss, seed: 300 + seed, lids: [0.05, 0.05] }), 0.366, (g) => g.scale(1, 1.04, 0.96)); head.add(decal);
  const nose = toonMesh(new THREE.SphereGeometry(0.06, 8, 6), skin, { outline: 0.02 }); nose.position.set(0, -0.04, 0.35); head.add(nose);
  for (const s of [-1, 1]) { const ear = toonMesh(new THREE.SphereGeometry(0.07, 8, 6), skin, { outline: 0.02 }); ear.position.set(s * 0.36, 0, 0); head.add(ear); }
  const hairColor = [0x4a2a12, 0xffe14a, 0x1a1a1a, 0xb8552a][seed % 4];
  const hair = toonMesh(new THREE.SphereGeometry(0.38, 14, 10, 0, Math.PI * 2, 0, Math.PI * 0.42), hairColor, { outline: 0.035 }); hair.position.set(0, 0.08, -0.03); hair.rotation.x = -0.15; head.add(hair);
  if (seed % 2 === 0) {
    const cap = toonMesh(new THREE.SphereGeometry(0.39, 14, 10, 0, Math.PI * 2, 0, Math.PI * 0.5), 0xe8463a, { outline: 0.035 }); cap.position.set(0, 0.12, -0.02); head.add(cap);
    const brim = toonMesh(new THREE.BoxGeometry(0.4, 0.05, 0.36), 0xe8463a, { outline: 0.025 }); brim.position.set(0, 0.22, 0.42); brim.rotation.x = -0.15; head.add(brim);
  } else {
    for (const s of [-1, 1]) { const z = toonMesh(new THREE.CylinderGeometry(0.06, 0.09, 0.4, 8), hairColor, { outline: 0.03 }); z.position.set(s * 0.4, -0.1, -0.05); z.rotation.z = s * 0.35; head.add(z); const b = toonMesh(new THREE.SphereGeometry(0.06, 8, 6), 0xff5fa2, { outline: 0.015 }); b.position.set(s * 0.37, 0.12, -0.05); head.add(b); }
  }
  kopfOhneSchattenwurf(head);
  // Item in der Hand
  let pistole = null, strahl = null, eis = null;
  if (item === 'wasserpistole') {
    const arm = arms[1];
    // Lauf zeigt den Arm entlang (lokal −y): hängt der Arm, zeigt sie nach unten; zeigt der Arm nach vorn, spritzt sie nach vorn
    pistole = new THREE.Group(); pistole.position.copy(arm.userData.hand.position).add(V(0.02, -0.02, 0.1)); pistole.rotation.x = Math.PI / 2; arm.add(pistole);
    const pc = [0xff7f3f, 0x3bb84a, 0xffd54a][seed % 3];
    const griff = toonMesh(new THREE.BoxGeometry(0.08, 0.16, 0.07), pc, { outline: 0.02 }); griff.position.set(0, -0.04, 0); pistole.add(griff);
    const lauf = toonMesh(new THREE.CylinderGeometry(0.045, 0.06, 0.32, 8), pc, { outline: 0.02 }); lauf.rotation.x = Math.PI / 2; lauf.position.set(0, 0.06, 0.14); pistole.add(lauf);
    const tank = toonMesh(new THREE.SphereGeometry(0.09, 10, 8), 0x3dd6e0, { outline: 0.02 }); tank.position.set(0, 0.14, 0.02); pistole.add(tank);
    strahl = toonMesh(new THREE.CylinderGeometry(0.02, 0.05, 1.8, 6), toon(0x7fd8ff, { transparent: true, opacity: 0.8 }), { outline: 0, shadow: false });
    strahl.rotation.x = Math.PI / 2; strahl.position.set(0, 0.06, 0.3 + 0.9); strahl.visible = false; pistole.add(strahl);
  } else if (item === 'eis') {
    const arm = arms[0];
    eis = new THREE.Group(); eis.position.copy(arm.userData.hand.position).add(V(0, 0.08, 0.06)); arm.add(eis);
    const cone = toonMesh(new THREE.ConeGeometry(0.07, 0.24, 8), 0xd8a85a, { outline: 0.02 }); cone.rotation.x = Math.PI; cone.position.y = 0.05; eis.add(cone);
    [[0xff5fa2, 0.2], [0xfff1c2, 0.33], [0x6b4423, 0.45]].forEach(([c, y]) => { const k = toonMesh(new THREE.SphereGeometry(0.085, 10, 8), c, { outline: 0.02 }); k.position.y = y; eis.add(k); });
    const tropf = toonMesh(new THREE.SphereGeometry(0.03, 6, 5), 0xff5fa2, { outline: 0 }); tropf.position.set(0.06, 0.1, 0.02); eis.add(tropf); eis.userData.tropf = tropf;
  }
  root.userData.parts = { legs, arms, head, body, decal, pistole, strahl, eis, baseHeadRot: head.rotation.clone() };
  root.userData.item = item; root.userData.seed = seed;
  root.userData.update = (t, opts) => updateKind(root, t, opts);
  root.userData.pose = (name) => kindPose(root, name);
  root.userData.faceOpts = { skin: skinCss, seed: 300 + seed, lids: [0.05, 0.05] };
  return root;
}
/** Pose eines Kindes ohne Animation: 'stehen' | 'rennen' | 'spritzen' | 'fragen' (Hände hinterm Rücken, Kopf schief). */
export function kindPose(k, name = 'stehen') {
  const P = k.userData.parts;
  k.userData.poseName = name;
  if (P.strahl) P.strahl.visible = name === 'spritzen';
  setFace(P.decal, face('kunde', name === 'fragen' ? 'neutral' : 'zufrieden', k.userData.faceOpts));
  if (name === 'fragen') { for (const a of P.arms) a.rotation.set(0.5, 0, 0); if (P.eis) P.arms[0].rotation.set(-1.3, 0, 0.3); P.head.rotation.set(0.1, 0, 0.25); } // Eis bleibt vorn
  return k;
}
/** opts.rennt: schnelle Beine, Arme pumpen, Körper nach vorn; opts.spritzt: Pistolenarm nach vorn, Strahl sichtbar. */
export function updateKind(k, t, { rennt = true, spritzt = false } = {}) {
  const P = k.userData.parts;
  const w = t * 14 + k.userData.seed, gang = rennt ? Math.sin(w) : 0;
  P.legs[0].rotation.x = 0.9 * gang; P.legs[1].rotation.x = -0.9 * gang;
  P.body.rotation.x = rennt ? 0.18 : 0;
  P.body.position.y = (P.legs[0].position.y - 0.04) + (rennt ? 0.03 * Math.abs(Math.cos(w)) : 0);
  P.head.position.y = P.legs[0].position.y + 0.5 + 0.36 + (rennt ? 0.03 * Math.abs(Math.cos(w)) : 0);
  const spritzArm = k.userData.item === 'wasserpistole' ? P.arms[1] : null;
  for (const [i, a] of P.arms.entries()) {
    if (a === spritzArm && spritzt) continue;
    a.rotation.set(rennt ? -0.9 * gang * (i === 0 ? 1 : -1) - 0.3 : 0, 0, (i === 0 ? 1 : -1) * 0.15);
  }
  if (spritzArm) {
    if (spritzt) { spritzArm.rotation.set(-1.45 + 0.05 * Math.sin(t * 30), 0, -0.1); P.strahl.visible = true; P.strahl.scale.z = 0.8 + 0.3 * Math.abs(Math.sin(t * 9)); P.strahl.position.z = 0.3 + 0.9 * P.strahl.scale.z; }
    else P.strahl.visible = false;
  }
  if (P.eis?.userData.tropf) P.eis.userData.tropf.position.y = 0.1 - ((t * 0.4 + k.userData.seed) % 1) * 0.25;
  if (k.userData.poseName !== 'fragen') P.head.rotation.set(rennt ? -0.1 : 0, 0.25 * Math.sin(t * 1.7 + k.userData.seed), 0.05 * gang);
}

// ---------- Erwachsene aus der Kundschaft ----------
function figur(record, seed) {
  const k = normalizeKunde(record);
  const g = buildKunde(k, seed);
  g.userData.kunde = k;
  return g;
}

// Streitendes Ehepaar (Hotel): sie gestikuliert, er zuckt mit den Schultern; abends Umarmung.
export function buildEhepaar() {
  const sie = figur({ id: 'ehefrau', typ: 'Hotelgast', schuhe: 'sandale', hemd: 'hawaii', hose: 'rock', hautton: 'hell', haare: 'dutt', brille: 'sonnenbrille', stimmung_start: 'misstrauisch', extras: ['riesenhut'] }, 41);
  const er = figur({ id: 'ehemann', typ: 'Hotelgast', schuhe: 'sandale', hemd: 'polo_sauber', hose: 'chino', hautton: 'sonnenbrand', haare: 'glatze', bart: 'schnauzer', stimmung_start: 'neutral', extras: ['socken', 'bauchtasche'] }, 42);
  const g = new THREE.Group();
  sie.position.set(-0.9, 0, 0); sie.rotation.y = Math.PI / 2 + 0.2; g.add(sie);      // schauen sich an
  er.position.set(0.9, 0, 0); er.rotation.y = -Math.PI / 2 - 0.2; g.add(er);
  const S = { streit: true, versoehnt: false };
  const update = (t) => {
    const Ps = sie.userData.parts, Pe = er.userData.parts;
    if (S.versoehnt) { // Umarmung: Arme um den anderen, Köpfe aneinander
      sie.position.x = -0.6; er.position.x = 0.6;
      for (const a of Ps.arms) a.rotation.set(-1.2, 0, 0); Ps.arms[0].rotation.z = 0.5; Ps.arms[1].rotation.z = -0.5;
      for (const a of Pe.arms) a.rotation.set(-1.0, 0, 0); Pe.arms[0].rotation.z = 0.55; Pe.arms[1].rotation.z = -0.55;
      Ps.head.rotation.set(0, 0.3, 0.25 + 0.02 * Math.sin(t * 2)); Pe.head.rotation.set(0, -0.3, -0.2 + 0.02 * Math.sin(t * 2));
      return;
    }
    sie.position.x = -0.9; er.position.x = 0.9;
    if (S.streit) { // sie: Arme fliegen, Kopf vor; er: Schultern hoch, Handflächen nach oben, Kopf weg
      const a = Math.sin(t * 5), b = Math.sin(t * 5 + 1.3);
      Ps.arms[0].rotation.set(-1.4 - 0.6 * a, 0, 0.6 + 0.3 * b); Ps.arms[1].rotation.set(-1.0 + 0.7 * b, 0, -0.5 - 0.3 * a);
      Ps.head.rotation.set(0.25 + 0.08 * a, 0.1 * b, 0.05);
      const z = (t % 4) < 0.7 ? Math.sin((t % 4) / 0.7 * Math.PI) : 0;
      Pe.arms[0].rotation.set(-0.5 - 0.6 * z, 0, 0.9); Pe.arms[1].rotation.set(-0.5 - 0.6 * z, 0, -0.9);
      Pe.head.rotation.set(-0.1 * z, 0.5 * Math.sin(t * 0.9), 0.1 * z);
    } else { // Pause: schweigen, Rücken an Rücken
      for (const a of Ps.arms) a.rotation.set(-0.9, 0, 0); Ps.arms[0].rotation.z = 0.7; Ps.arms[1].rotation.z = -0.7; // verschränkt
      for (const a of Pe.arms) a.rotation.set(0, 0, 0);
      Ps.head.rotation.set(0, 0.6, 0); Pe.head.rotation.set(0.1, -0.6, 0);
    }
  };
  const setStreit = (an) => { S.streit = !!an; S.versoehnt = false; setMood(sie, an ? 'misstrauisch' : 'neutral'); setMood(er, an ? 'erschrocken' : 'neutral'); };
  const setVersoehnt = (an) => { S.versoehnt = !!an; if (an) { S.streit = false; setMood(sie, 'selig'); setMood(er, 'selig'); } };
  g.userData = { sie, er, update, setStreit, setVersoehnt };
  return { gruppe: g, sie, er, update, setStreit, setVersoehnt };
}

// Influencerin (Steg) mit Reflektor-Freund: sie macht Selfie-Serien vom Sonnenuntergang (Blitz), er hält seit Stunden die Scheibe.
export function buildInfluencerin() {
  const sie = figur({ id: 'influencerin', typ: 'Content', schuhe: 'barfuss', hemd: 'tanktop', hose: 'shorts', hautton: 'hell', haare: 'lang', brille: 'sonnenbrille', accessoire: 'handy', stimmung_start: 'selig', extras: ['strohhut'] }, 51);
  const freund = figur({ id: 'reflektor_freund', typ: 'Freund', schuhe: 'turnschuh', hemd: 'polo_sauber', hose: 'chino', hautton: 'mittel', haare: 'kurz', stimmung_start: 'neutral', extras: ['socken'] }, 52);
  setFace(freund.userData.parts.decal, face('kunde', 'muede', freund.userData.faceOpts)); // traurig, nicht müde: schwere Lider reichen
  // Reflektorscheibe: silberne Scheibe mit Goldrand, in beiden Händen vor der Brust
  const reflektor = new THREE.Group();
  const disc = toonMesh(new THREE.CylinderGeometry(0.75, 0.75, 0.03, 24), toon(0xe8ecf2, { emissive: 0x222222 }), { outline: 0.03 }); disc.rotation.x = Math.PI / 2; reflektor.add(disc);
  const ring = toonMesh(new THREE.TorusGeometry(0.75, 0.035, 8, 32), 0xf1c232, { outline: 0.02 }); reflektor.add(ring);
  const glanz = toonMesh(new THREE.CylinderGeometry(0.3, 0.3, 0.035, 16), 0xffffff, { outline: 0, basic: true }); glanz.rotation.x = Math.PI / 2; glanz.position.set(-0.2, 0.2, 0.0); glanz.scale.set(1, 0.4, 1); reflektor.add(glanz);
  reflektor.position.set(0, 1.9, 0.75); freund.add(reflektor);
  const Pf = freund.userData.parts;
  for (const [i, a] of Pf.arms.entries()) a.rotation.set(-1.5, 0, (i === 0 ? 1 : -1) * 0.35); // beide Arme vorgestreckt, Scheibe halten
  // Blitz: weiße Kugel am Handy, kurz sichtbar
  const blitz = toonMesh(new THREE.SphereGeometry(0.22, 10, 8), 0xffffff, { outline: 0, basic: true, shadow: false }); blitz.visible = false;
  const Ps = sie.userData.parts;
  Ps.arms[1].add(blitz); blitz.position.copy(HAND).add(V(-0.1, 0.25, 0.3));
  const g = new THREE.Group();
  sie.position.set(0.6, 0, 0); sie.rotation.y = Math.PI - 0.3; g.add(sie);        // Rücken zum Meer, Selfie
  freund.position.set(-1.4, 0, 0.9); freund.rotation.y = 0.9; g.add(freund);
  const S = { foto: true };
  const update = (t) => {
    const u = (t % 2.4) / 2.4; // ein Selfie alle 2,4 s: Arm hoch, Pose, Klick, Display prüfen
    if (S.foto) {
      Ps.arms[1].rotation.set(-2.6 + 0.15 * Math.sin(t * 2), -0.3, -0.5);
      Ps.arms[0].rotation.set(0.2, 0, 0.9 + 0.1 * Math.sin(t * 3)); // Hand in die Hüfte
      Ps.head.rotation.set(-0.25, 0.3 + 0.1 * Math.sin(t * 1.5), 0.2 * Math.sin(t * 0.8));
      blitz.visible = u > 0.55 && u < 0.6;
      blitz.scale.setScalar(1 + 2 * (u - 0.55) / 0.05);
    } else {
      Ps.arms[1].rotation.set(-1.6, 0, -0.3); Ps.arms[0].rotation.set(-1.4, 0, 0.3); // schaut aufs Display, beide Hände
      Ps.head.rotation.set(0.5, 0, 0); blitz.visible = false;
    }
    const seufz = (t % 6) < 1 ? Math.sin((t % 6) * Math.PI) : 0; // Freund: alle 6 s ein Seufzer, Scheibe sackt kurz ab
    for (const [i, a] of Pf.arms.entries()) a.rotation.set(-1.5 + 0.25 * seufz, 0, (i === 0 ? 1 : -1) * 0.35);
    reflektor.position.y = 1.9 - 0.2 * seufz; reflektor.rotation.x = 0.1 * seufz;
    Pf.head.rotation.set(0.2 + 0.15 * seufz, 0.15 * Math.sin(t * 0.4), 0.08);
  };
  const setFoto = (an) => { S.foto = !!an; };
  g.userData = { sie, freund, reflektor, update, setFoto };
  return { gruppe: g, sie, freund, reflektor, update, setFoto };
}

// Betrunkener Amerikaner (Bar, ab mittags): Collegeshirt, Bierdose, schwankt; abends in der Hängematte (setSchlaeft).
export function buildBetrunkener() {
  const g = figur({ id: 'betrunkener', typ: 'Tourist', schuhe: 'flipflop', hemd: 'polo_sauber', hose: 'shorts', hautton: 'sonnenbrand', haare: 'kurz', accessoire: 'bierdose', stimmung_start: 'selig', extras: ['sonnenbrand_streifen'] }, 61);
  const P = g.userData.parts;
  // Collegeshirt: Aufdruck auf der Brust
  const print = new THREE.Mesh(new THREE.PlaneGeometry(0.6, 0.3), new THREE.MeshBasicMaterial({ map: textTexture('STATE U.', { bg: 'rgba(0,0,0,0)', fg: '#8b1e1e', font: 'bold 80px sans-serif', w: 384, h: 192 }), transparent: true }));
  print.position.set(0, P.legs[0].position.y + 0.62, 0.47); g.add(print);
  const z = zzz(); z.visible = false; z.position.set(0.6, 2.9, 0); z.userData.y0 = 2.9; g.add(z);
  g.userData.schwankt = true; g.userData.schlaeft = false;
  g.userData.update = (t, opts) => updateBetrunkener(g, t, opts);
  g.userData.setSchlaeft = (an) => setSchlaeft(g, an);
  g.userData.zzz = z;
  return g;
}
export function updateBetrunkener(g, t, { schwankt = g.userData.schwankt } = {}) {
  const P = g.userData.parts;
  if (g.userData.schlaeft) { g.userData.zzz.userData.update(t); return; }
  const w1 = Math.sin(t * 1.1), w2 = Math.sin(t * 0.7 + 1);
  g.rotation.z = schwankt ? 0.12 * w1 : 0; g.rotation.x = schwankt ? 0.06 * w2 : 0;
  P.head.rotation.set(0.15 + 0.15 * w2, 0.4 * w1, -0.2 * w1);
  P.arms[1].rotation.set(-1.9 + 0.4 * Math.max(0, Math.sin(t * 0.5)), 0, -0.5); // prostet der Welt zu
  P.arms[0].rotation.set(-0.3 + 0.3 * w1, 0, 0.6 + 0.2 * w2);
  const stolper = (t % 5) < 0.5 ? Math.sin((t % 5) / 0.5 * Math.PI) : 0; // alle 5 s ein Ausfallschritt
  P.legs[0].rotation.x = 0.6 * stolper; P.legs[1].rotation.x = -0.2 * stolper;
}
export function setSchlaeft(g, an) {
  const P = g.userData.parts;
  g.userData.schlaeft = !!an;
  g.userData.zzz.visible = !!an;
  if (an) { pose(g, 'liegen'); setMood(g, 'schlaeft'); g.rotation.z = 0; }
  else { pose(g, 'stehen'); setMood(g, 'selig'); }
}

// ---------- Handtücher ----------
function handtuchMat(farben) {
  return toon(0xffffff, { map: stripeTexture([farben[0], farben[1], farben[0], farben[1], farben[0], farben[1]], { vertical: false }) });
}
/** Handtuch als Reservierung auf einer Liege (props.lounger): liegt über Sitz und Rückenteil, Kind der Liege. */
export function handtuchAufLiege(liege, farben = HANDTUCH_FARBEN[0]) {
  const g = new THREE.Group();
  const mat = handtuchMat(farben);
  const sitz = toonMesh(new THREE.BoxGeometry(0.7, 0.05, 1.2), mat, { outline: 0.03 });
  deform(sitz.geometry, (v) => { v.y += 0.015 * Math.sin(v.x * 9) + 0.01 * Math.sin(v.z * 7); });
  sitz.position.set(0, 0.55, 0.05); g.add(sitz);
  const tilt = 0.96, len = 0.85;
  const ruecken = toonMesh(new THREE.BoxGeometry(0.7, 0.05, len), mat, { outline: 0.03 });
  ruecken.position.set(0, 0.53 + Math.sin(tilt) * len / 2, -0.5 - Math.cos(tilt) * len / 2); ruecken.rotation.x = tilt; g.add(ruecken);
  const zipfel = toonMesh(new THREE.BoxGeometry(0.3, 0.05, 0.25), mat, { outline: 0.025 }); zipfel.position.set(0.25, 0.5, 0.7); zipfel.rotation.set(0.9, 0, 0.1); g.add(zipfel); // hängt vorn über
  g.userData.farben = farben;
  liege.add(g);
  return g;
}
/** Gerolltes Handtuch (Wurfgeschoss der 6-Uhr-Reservierer). Position/Flug setzt das Spiel, update(t) lässt es rotieren. */
export function handtuchRolle(farben = HANDTUCH_FARBEN[1]) {
  const g = new THREE.Group();
  const rolle = toonMesh(new THREE.CylinderGeometry(0.16, 0.16, 0.6, 12), handtuchMat(farben), { outline: 0.03 }); rolle.rotation.z = Math.PI / 2; g.add(rolle);
  const ende = toonMesh(new THREE.BoxGeometry(0.2, 0.04, 0.3), handtuchMat(farben), { outline: 0.02 }); ende.position.set(0.2, 0.1, 0.12); ende.rotation.x = 0.4; g.add(ende);
  g.userData.update = (t) => { g.rotation.x = t * 9; };
  return g;
}
export { HANDTUCH_FARBEN, handtuchPlan };
