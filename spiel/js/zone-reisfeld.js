// zone-reisfeld.js — Reisfeld mit Bauer Nok (sechs Wasserfelder, Dämme mit Bambusstegen, Nok pflanzt mit
// Kegelhut, Wasserbüffel mit Kuhreiher auf dem Rücken, Noks Vogelscheuche in Hawaiihemd — die Konkurrenz
// zur Mentor-Vogelscheuche, auf der die Vögel sitzen) und der Kokoshain (Palmenwäldchen mit Kokos-Kletterer,
// Hängematte, Versteck). Grundriss/Collider: zone-reisfeld-layout.js.
// Einbau: buildReisfeld(gruppe, colliders) → { spots, update(t), anchors } und buildKokoshain(gruppe, colliders)
// → { spots, update(t), anchors, hideouts }.
import * as THREE from 'three';
import { RoundedBoxGeometry } from 'three/addons/geometries/RoundedBoxGeometry.js';
import { mergeGeometries } from 'three/addons/utils/BufferGeometryUtils.js';
import { toonMesh, toon, deform, rng, stripeTexture, BLACK } from './toon.js';
import { limb, palm, hut, coconut, hammock } from './props.js';
import { bareFoot } from './figures.js';
import { face, faceDecal } from './faces.js';
import { shirtTexture } from './kunden.js';
import { plate, chicken, cobbleTexture, paving } from './zone-dorf.js';
import { FELDER, LANES, DAMM_BREITE, NOK, BUEFFEL, VOGELSCHEUCHE, HUETTE, PROPS, REISFELD_SPOTS, REISFELD_ANCHORS, reisfeldColliders,
  PALMEN, HAIN_LANES, HAIN_VERSTECK, HAIN_PROPS, HAIN_SPOTS, HAIN_ANCHORS, hainColliders } from './zone-reisfeld-layout.js';

const V = (x, y, z) => new THREE.Vector3(x, y, z);

// ---------- Wasserfeld: Schlammrand, Wasser, Reihen von Setzlingen (eine Geometrie je Feld) ----------
function paddy(f, seed) {
  const g = new THREE.Group();
  const rand = rng(seed);
  const rim = toonMesh(new THREE.BoxGeometry(f.w + 0.6, 0.35, f.d + 0.6), 0x6b4a2a, { outline: 0.04 });
  deform(rim.geometry, (v) => { if (v.y > 0) { v.x *= 1.02; v.z *= 1.03; } });
  rim.position.set(f.x, 0.17, f.z); g.add(rim);
  const water = toonMesh(new THREE.BoxGeometry(f.w, 0.1, f.d), toon(0x7fbfb0, { transparent: true, opacity: 0.9 }), { outline: 0 });
  water.position.set(f.x, 0.33, f.z); water.userData.noFade = true; g.add(water);
  // Setzlinge: 3 Blätter je Pflanze, Reihen quer, alles in eine Geometrie
  const parts = [];
  const cols = Math.floor(f.w / 0.9), rows = Math.floor(f.d / 0.9);
  for (let c = 0; c < cols; c++) for (let r = 0; r < rows; r++) {
    const px = f.x - f.w / 2 + 0.7 + c * (f.w - 1.4) / Math.max(1, cols - 1), pz = f.z - f.d / 2 + 0.6 + r * (f.d - 1.2) / Math.max(1, rows - 1);
    for (let k = 0; k < 3; k++) {
      const leaf = new THREE.ConeGeometry(0.05, 0.5 + rand() * 0.3, 4);
      const a = k * 2.1 + rand();
      leaf.rotateX(Math.sin(a) * 0.35); leaf.rotateZ(-Math.cos(a) * 0.35);
      leaf.translate(px + Math.cos(a) * 0.05, 0.6, pz + Math.sin(a) * 0.05);
      parts.push(leaf);
    }
  }
  const merged = mergeGeometries(parts, false);
  g.add(toonMesh(merged, 0x5fc74a, { outline: 0.02 }));
  return g;
}

// Damm mit Bambusplanken entlang einer Strecke
function damm(a, b, width) {
  const g = new THREE.Group();
  const len = Math.hypot(b[0] - a[0], b[1] - a[1]);
  const base = toonMesh(new THREE.BoxGeometry(len + width, 0.3, width), 0x8b6b3e, { outline: 0.035 });
  base.position.set((a[0] + b[0]) / 2, 0.15, (a[1] + b[1]) / 2); base.rotation.y = Math.atan2(-(b[1] - a[1]), b[0] - a[0]); g.add(base);
  const n = Math.floor(len / 0.5);
  const rand = rng(Math.round(a[0] + a[1] * 7));
  const planks = [];
  for (let i = 0; i < n; i++) {
    const t = (i + 0.5) / n;
    const pg = new THREE.BoxGeometry(0.42, 0.08, width * 0.55 + (rand() - 0.5) * 0.3);
    pg.rotateY(base.rotation.y + (rand() - 0.5) * 0.08);
    pg.translate(a[0] + (b[0] - a[0]) * t, 0.33 + (rand() - 0.5) * 0.03, a[1] + (b[1] - a[1]) * t);
    planks.push(pg);
  }
  if (planks.length) g.add(toonMesh(mergeGeometries(planks, false), 0xd8a85a, { outline: 0.025 }));
  return g;
}

// ---------- Bauer Nok: Kegelhut, hochgekrempelte Hose, barfuß, pflanzt gebückt ----------
function nok() {
  const root = new THREE.Group();
  const skin = 0xd9a06e;
  const hipY = 1.05;
  for (const s of [-1, 1]) {
    const foot = bareFoot(skin, s < 0 ? 'L' : 'R'); foot.position.set(s * 0.28, 0, 0.05); root.add(foot);
    root.add(limb(V(s * 0.28, 0.2, 0), V(s * 0.25, hipY, 0), 0.12, skin, { outline: 0.04 }));
    const cuff = toonMesh(new THREE.CylinderGeometry(0.19, 0.2, 0.5, 10), 0x334455, { outline: 0.035 }); cuff.position.set(s * 0.26, hipY - 0.3, 0); root.add(cuff);
  }
  const body = new THREE.Group(); body.position.set(0, hipY, 0); root.add(body);
  const torso = toonMesh(new THREE.CylinderGeometry(0.36, 0.4, 0.85, 12), 0x9fd8ff, { outline: 0.045 }); torso.position.set(0, 0.45, 0); body.add(torso);
  const arms = [];
  for (const s of [-1, 1]) {
    const arm = new THREE.Group(); arm.position.set(s * 0.44, 0.78, 0.02);
    arm.add(limb(V(0, 0, 0), V(s * 0.15, -0.75, 0.15), 0.09, skin, { outline: 0.035 }));
    const hand = toonMesh(new THREE.SphereGeometry(0.15, 10, 8), skin, { outline: 0.035 }); hand.position.set(s * 0.17, -0.85, 0.17); arm.add(hand);
    body.add(arm); arms.push(arm);
  }
  const seedling = toonMesh(new THREE.ConeGeometry(0.05, 0.5, 4), 0x5fc74a, { outline: 0.02 }); seedling.position.set(0.2, -0.7, 0.25); seedling.rotation.z = 0.4; arms[1].add(seedling);
  const bundle = toonMesh(new THREE.CylinderGeometry(0.12, 0.12, 0.5, 8), 0x5fc74a, { outline: 0.025 }); bundle.position.set(-0.2, -0.75, 0.2); bundle.rotation.z = 0.6; arms[0].add(bundle);
  const head = new THREE.Group(); head.position.set(0, 1.45, 0.05); body.add(head);
  head.add(toonMesh(new THREE.SphereGeometry(0.42, 16, 12), skin, { outline: 0.045 }));
  head.add(faceDecal(face('kunde', 'zufrieden', { skin: '#d9a06e', bart: 'stoppel', seed: 51 }), 0.425, null));
  const hat = toonMesh(new THREE.ConeGeometry(0.95, 0.55, 14), 0xe3b04b, { outline: 0.04 }); hat.position.set(0, 0.45, 0); hat.rotation.z = 0.06; head.add(hat);
  const band = toonMesh(new THREE.TorusGeometry(0.1, 0.02, 6, 10, Math.PI), 0x222222, { outline: 0.01 }); band.position.set(0, -0.25, 0.1); band.rotation.x = 0.3; head.add(band); // Kinnband
  root.userData.parts = { body, arms, head };
  return root;
}

// ---------- Wasserbüffel mit Kuhreiher ----------
function buffalo() {
  const g = new THREE.Group();
  const c = 0x5a5a66;
  const body = toonMesh(new THREE.SphereGeometry(1, 16, 12), c, { outline: 0.06 }); body.geometry.scale(1.5, 0.95, 0.9); body.position.set(0, 1.3, 0); g.add(body);
  for (const [x, z] of [[-0.9, -0.4], [-0.9, 0.4], [0.9, -0.4], [0.9, 0.4]]) {
    g.add(limb(V(x, 0.05, z), V(x, 1.0, z), 0.16, c, { outline: 0.04 }));
    const hoof = toonMesh(new THREE.CylinderGeometry(0.2, 0.22, 0.14, 8), 0x222222, { outline: 0.025 }); hoof.position.set(x, 0.07, z); g.add(hoof);
  }
  const head = new THREE.Group(); head.position.set(1.5, 1.35, 0); g.add(head);
  head.add(toonMesh(new RoundedBoxGeometry(0.9, 0.7, 0.7, 3, 0.2), c, { outline: 0.045 }));
  const nose = toonMesh(new RoundedBoxGeometry(0.5, 0.4, 0.55, 3, 0.15), 0x777788, { outline: 0.03 }); nose.position.set(0.55, -0.12, 0); head.add(nose);
  for (const s of [-1, 1]) {
    const nostril = toonMesh(new THREE.SphereGeometry(0.05, 6, 5), BLACK, { outline: 0, basic: true }); nostril.position.set(0.8, -0.1, s * 0.14); head.add(nostril);
    const eye = toonMesh(new THREE.SphereGeometry(0.08, 8, 6), 0xffffff, { outline: 0.02 }); eye.position.set(0.3, 0.18, s * 0.36); head.add(eye);
    const pupil = toonMesh(new THREE.SphereGeometry(0.04, 6, 5), BLACK, { outline: 0, basic: true }); pupil.position.set(0.05, 0, s * 0.03); eye.add(pupil);
    const ear = toonMesh(new THREE.SphereGeometry(0.14, 8, 6), c, { outline: 0.03 }); ear.geometry.scale(0.6, 1, 1.6); ear.position.set(-0.2, 0.2, s * 0.5); ear.userData.side = s; head.add(ear);
    // Hörner: nach hinten-außen geschwungen
    const curve = new THREE.CatmullRomCurve3([V(-0.1, 0.35, s * 0.25), V(-0.4, 0.55, s * 0.7), V(-0.3, 0.75, s * 1.15), V(0.0, 0.95, s * 1.35)]);
    head.add(toonMesh(new THREE.TubeGeometry(curve, 10, 0.09, 7, false), 0x3a3a44, { outline: 0.03 }));
  }
  const jaw = toonMesh(new RoundedBoxGeometry(0.5, 0.18, 0.5, 3, 0.07), 0x777788, { outline: 0.03 }); jaw.position.set(0.5, -0.4, 0); head.add(jaw);
  g.add(limb(V(-1.5, 1.6, 0), V(-2.0, 0.9, 0.1), 0.05, c, { outline: 0.02, taper: 0.6 }));
  const tuft = toonMesh(new THREE.SphereGeometry(0.12, 6, 5), 0x222222, { outline: 0.02 }); tuft.position.set(-2.0, 0.85, 0.1); g.add(tuft);
  // Kuhreiher auf dem Rücken
  const egret = new THREE.Group(); egret.position.set(-0.5, 2.25, 0.1); g.add(egret);
  const eb = toonMesh(new THREE.SphereGeometry(0.2, 10, 8), 0xffffff, { outline: 0.03 }); eb.geometry.scale(1.5, 1, 1); egret.add(eb);
  egret.add(limb(V(0.2, 0.1, 0), V(0.35, 0.65, 0), 0.04, 0xffffff, { outline: 0.015 }));
  const eh = toonMesh(new THREE.SphereGeometry(0.11, 8, 6), 0xffffff, { outline: 0.02 }); eh.position.set(0.37, 0.7, 0); egret.add(eh);
  const beak = toonMesh(new THREE.ConeGeometry(0.03, 0.3, 5), 0xffd54a, { outline: 0.012 }); beak.position.set(0.55, 0.68, 0); beak.rotation.z = -Math.PI / 2; egret.add(beak);
  for (const s of [-1, 1]) egret.add(limb(V(0, -0.15, s * 0.06), V(0, -0.45, s * 0.07), 0.02, 0x222222, { outline: 0.01 }));
  g.userData.parts = { head, jaw, egret, ears: head.children.filter((m) => m.userData.side) };
  return g;
}

// Noks Vogelscheuche: Hawaiihemd, Sonnenbrille, Strohhut — und zwei Vögel sitzen drauf (sie wirkt nicht)
function nokScarecrow() {
  const g = new THREE.Group();
  g.add(limb(V(0, 0, 0), V(0.05, 2.3, 0), 0.07, 0x7a4b22, { outline: 0.03 }));
  g.add(limb(V(-0.95, 1.7, 0.05), V(0.95, 1.75, -0.05), 0.05, 0x7a4b22, { outline: 0.025 }));
  const shirt = toonMesh(new THREE.CylinderGeometry(0.32, 0.4, 0.9, 10), toon(0xffffff, { map: shirtTexture(0, '#e8463a') }), { outline: 0.04 }); shirt.position.set(0.02, 1.4, 0); g.add(shirt);
  for (const s of [-1, 1]) { const sl = toonMesh(new THREE.CylinderGeometry(0.1, 0.12, 0.7, 8), toon(0xffffff, { map: shirtTexture(0, '#e8463a') }), { outline: 0.03 }); sl.position.set(s * 0.6, 1.72, 0); sl.rotation.z = Math.PI / 2; g.add(sl); }
  const head = toonMesh(new THREE.SphereGeometry(0.32, 12, 9), 0xe8c57a, { outline: 0.04 }); head.position.set(0.05, 2.25, 0); g.add(head);
  for (const s of [-1, 1]) { const lens = toonMesh(new THREE.CylinderGeometry(0.11, 0.11, 0.04, 10), 0x111111, { outline: 0.015 }); lens.position.set(0.05 + s * 0.13, 2.3, 0.3); lens.rotation.x = Math.PI / 2; g.add(lens); }
  const smile = toonMesh(new THREE.TorusGeometry(0.1, 0.02, 6, 10, Math.PI), BLACK, { outline: 0, basic: true }); smile.position.set(0.05, 2.12, 0.3); smile.rotation.z = Math.PI; g.add(smile);
  const hat = toonMesh(new THREE.CylinderGeometry(0.3, 0.33, 0.25, 12), 0xe3b04b, { outline: 0.03 }); hat.position.set(0.05, 2.62, 0); g.add(hat);
  const brim = toonMesh(new THREE.CylinderGeometry(0.62, 0.62, 0.04, 16), 0xe3b04b, { outline: 0.03 }); brim.position.set(0.05, 2.5, 0); brim.rotation.z = 0.1; g.add(brim);
  const sign = plate('BESSER ALS DIE DA OBEN', 1.6, 0.3, { font: 'bold 56px sans-serif', tw: 1024, th: 160, thick: 0.04 });
  sign.position.set(0.02, 0.9, 0.42); sign.rotation.z = 0.06; g.add(sign);
  for (const [x, k] of [[-0.75, 4], [0.7, 5]]) { const bird = chicken(0x333344, k); bird.scale.setScalar(0.55); bird.position.set(x, 1.78, 0); g.add(bird); }
  return g;
}

function pump() {
  const g = new THREE.Group();
  g.add(limb(V(0, 0, 0), V(0, 1.1, 0), 0.1, 0x3a7bd5, { outline: 0.035 }));
  const headp = toonMesh(new THREE.BoxGeometry(0.3, 0.3, 0.3), 0x3a7bd5, { outline: 0.03 }); headp.position.set(0, 1.2, 0); g.add(headp);
  g.add(limb(V(0.15, 1.2, 0), V(0.45, 1.05, 0), 0.05, 0x3a7bd5, { outline: 0.02 })); // Auslauf
  g.add(limb(V(-0.1, 1.3, 0), V(-0.7, 1.9, 0.1), 0.04, 0x222222, { outline: 0.02 })); // Schwengel
  const bucket = toonMesh(new THREE.CylinderGeometry(0.26, 0.22, 0.4, 10), 0x8d8fa0, { outline: 0.03 }); bucket.position.set(0.55, 0.2, 0.1); g.add(bucket);
  return g;
}

/** Reisfeld bauen. Rückgabe { spots, update(t), anchors }. */
export function buildReisfeld(parent, colliders) {
  const rand = rng(71);
  const add = (o) => { parent.add(o); return o; };
  paving(parent, cobbleTexture(), { zufahrt: LANES.reis_zufahrt }, null);
  FELDER.forEach((f, i) => add(paddy(f, 80 + i)));
  for (const [name, pts] of Object.entries(LANES)) if (name !== 'reis_zufahrt') for (let i = 1; i < pts.length; i++) add(damm(pts[i - 1], pts[i], DAMM_BREITE));
  const nokObj = nok(); nokObj.position.set(NOK.x, 0.1, NOK.z); nokObj.rotation.y = NOK.rot; add(nokObj);
  const buf = buffalo(); buf.position.set(BUEFFEL.x, 0.1, BUEFFEL.z); buf.rotation.y = BUEFFEL.rot; add(buf);
  const sc = nokScarecrow(); sc.position.set(VOGELSCHEUCHE.x, 0.2, VOGELSCHEUCHE.z); sc.rotation.y = VOGELSCHEUCHE.rot; add(sc);
  const h = hut({ w: 2.0, h: 1.6, d: 1.5, lean: 0.3, wall: 0x8b5a2b, straw: true, seed: 19 }); h.position.set(HUETTE.x, 0, HUETTE.z); h.rotation.y = HUETTE.rot; h.scale.setScalar(2.0); add(h);
  for (const p of PROPS) {
    if (p.kind === 'pumpe') { const o = pump(); o.position.set(p.x, 0, p.z); add(o); }
    else if (p.kind === 'schild') {
      const s = new THREE.Group();
      s.add(limb(V(0, 0, 0), V(0.08, 2.2, 0), 0.07, 0x7a4b22, { outline: 0.03 }));
      const b = plate('REISFELD NOK', 1.8, 0.42, { font: 'bold 64px sans-serif', tw: 768, th: 160, thick: 0.05 }); b.position.set(0.08, 2.15, 0); b.rotation.set(0, -0.3, 0.05); s.add(b);
      const b2 = plate('BETRETEN AUF EIGENE NÄSSE', 2.4, 0.3, { bg: '#e8c57a', font: 'bold 52px sans-serif', tw: 1024, th: 140, thick: 0.05 }); b2.position.set(0.05, 1.65, 0); b2.rotation.set(0, -0.2, -0.05); s.add(b2);
      s.position.set(p.x, 0, p.z); add(s);
    } else if (p.kind === 'koerbe') {
      for (let i = 0; i < 3; i++) {
        const k = toonMesh(new THREE.CylinderGeometry(0.4, 0.3, 0.45, 10), 0xd8a85a, { outline: 0.03 });
        k.position.set(p.x + (i - 1) * 0.6, 0.22 + (i === 1 ? 0.45 : 0), p.z + (i % 2) * 0.3); k.rotation.z = (rand() - 0.5) * 0.2; add(k);
        const rice = toonMesh(new THREE.SphereGeometry(0.3, 8, 6), 0xfff1c2, { outline: 0.02 }); rice.geometry.scale(1, 0.4, 1); rice.position.set(0, 0.25, 0); k.add(rice);
      }
    }
  }
  // Frösche am Rand (kleine grüne Kugeln mit Augen) — passend zur Reisfeld-Geräuschkulisse
  for (let i = 0; i < 4; i++) {
    const f = FELDER[i % FELDER.length];
    const frog = toonMesh(new THREE.SphereGeometry(0.14, 8, 6), 0x3bb84a, { outline: 0.02 }); frog.geometry.scale(1.2, 0.7, 1);
    frog.position.set(f.x - f.w / 2 + 0.5 + rand() * 2, 0.42, f.z - f.d / 2 + 0.4); add(frog);
    for (const s of [-1, 1]) { const e = toonMesh(new THREE.SphereGeometry(0.04, 6, 5), BLACK, { outline: 0, basic: true }); e.position.set(s * 0.07, 0.1, 0.08); frog.add(e); }
  }
  for (const c of reisfeldColliders()) colliders.push(c);
  colliders.push({ x: BUEFFEL.x, z: BUEFFEL.z, r: BUEFFEL.r });

  const NP = nokObj.userData.parts, BP = buf.userData.parts;
  function update(t) {
    // Nok: beugt sich alle 3 s runter, steckt einen Setzling, richtet sich auf
    const k = t % 3;
    const bend = k < 1.2 ? Math.sin(k / 1.2 * Math.PI) : 0;
    NP.body.rotation.x = 0.95 * bend;
    NP.arms[1].rotation.x = -0.6 - 0.9 * bend; NP.arms[0].rotation.x = -0.4 - 0.3 * bend;
    NP.head.rotation.x = -0.4 * bend;
    // Büffel: kaut, Ohren zucken, der Reiher schaut
    BP.jaw.position.y = -0.4 - 0.06 * Math.abs(Math.sin(t * 5));
    BP.head.rotation.y = 0.15 * Math.sin(t * 0.6);
    for (const e of BP.ears) e.rotation.x = e.userData.side * ((t % 4) < 0.3 ? 0.6 * Math.sin((t % 4) / 0.3 * Math.PI) : 0);
    BP.egret.rotation.y = 0.5 * Math.sin(t * 0.9);
  }
  update(0);
  return { spots: REISFELD_SPOTS, update, anchors: REISFELD_ANCHORS };
}

// ---------- Kokoshain ----------
// Kokos-Kletterer: klammert am Stamm, Sack über der Schulter, lässt ab und zu eine Nuss fallen
function climber(skin = 0x8d5a3a) {
  const g = new THREE.Group();
  const torso = toonMesh(new THREE.CylinderGeometry(0.3, 0.33, 0.8, 10), 0xffd54a, { outline: 0.04 }); torso.position.set(0, 0.4, 0); g.add(torso);
  for (const s of [-1, 1]) {
    g.add(limb(V(s * 0.3, 0.75, 0), V(s * 0.25, 0.95, -0.45), 0.08, skin, { outline: 0.03 })); // Arme umschlingen den Stamm
    g.add(limb(V(s * 0.22, 0.05, 0), V(s * 0.3, -0.5, -0.35), 0.1, skin, { outline: 0.035 }));
    const foot = bareFoot(skin, s < 0 ? 'L' : 'R'); foot.scale.setScalar(0.9); foot.position.set(s * 0.3, -0.6, -0.4); foot.rotation.x = -1.2; g.add(foot);
  }
  const shorts = toonMesh(new THREE.CylinderGeometry(0.34, 0.34, 0.3, 10), 0xe8463a, { outline: 0.03 }); shorts.position.set(0, 0.0, 0); g.add(shorts);
  const head = new THREE.Group(); head.position.set(0, 1.15, 0.05); g.add(head);
  head.add(toonMesh(new THREE.SphereGeometry(0.38, 14, 10), skin, { outline: 0.04 }));
  head.add(faceDecal(face('kunde', 'erschrocken', { skin: '#8d5a3a', seed: 61 }), 0.385, null));
  const bandana = toonMesh(new THREE.SphereGeometry(0.4, 12, 8, 0, Math.PI * 2, 0, Math.PI * 0.4), 0x3bb84a, { outline: 0.03 }); bandana.position.set(0, 0.08, 0); head.add(bandana);
  const sack = toonMesh(new THREE.SphereGeometry(0.35, 10, 8), 0xd8a85a, { outline: 0.035 }); sack.geometry.scale(1, 1.3, 0.8); sack.position.set(0.45, 0.6, 0.25); g.add(sack);
  const nut = toonMesh(new THREE.SphereGeometry(0.2, 10, 8), 0x6b4423, { outline: 0.03 }); nut.position.set(0.6, 0.3, 0.3); g.add(nut);
  g.userData.parts = { head, nut };
  return g;
}

/** Kokoshain bauen. Rückgabe { spots, update(t), anchors, hideouts }. */
export function buildKokoshain(parent, colliders) {
  const rand = rng(73);
  const add = (o) => { parent.add(o); return o; };
  paving(parent, cobbleTexture(), { hain: HAIN_LANES.hain }, null);
  const palms = [];
  for (const p of PALMEN) {
    const obj = palm({ lean: new THREE.Vector3(...p.lean), seed: p.seed, height: 4.4 + (p.seed % 3) * 0.4 });
    obj.position.set(p.x, 0, p.z); obj.scale.setScalar(1.4); add(obj); palms.push(obj);
    const top = obj.userData.curve.getPointAt(1).multiplyScalar(1.4);
    obj.userData.crown = { x: p.x + top.x, y: top.y - 0.6, z: p.z + top.z, r: 4.8 };
    for (let i = 0; i < 2 + (p.seed % 2); i++) { const c = coconut(false); c.position.set(p.x + (rand() - 0.5) * 3, 0, p.z + (rand() - 0.5) * 3); c.rotation.z = rand() * 2; add(c); }
  }
  // Kletterer am Stamm der markierten Palme, auf halber Höhe, dem Stamm folgend
  const kp = PALMEN.findIndex((p) => p.kletterer);
  let cl = null, fallingNut = null;
  if (kp >= 0) {
    const pObj = palms[kp], curve = pObj.userData.curve;
    const pos = curve.getPointAt(0.55).multiplyScalar(1.4), tan = curve.getTangentAt(0.55);
    cl = climber(); cl.position.copy(pObj.position).add(pos);
    cl.quaternion.setFromUnitVectors(V(0, 1, 0), tan.clone().normalize()); cl.rotateY(Math.PI);
    add(cl);
    fallingNut = coconut(false); fallingNut.position.set(PALMEN[kp].x + 0.8, 0, PALMEN[kp].z + 0.6); add(fallingNut);
  }
  // Hängematte zwischen den beiden südwestlichen Palmen, Helm am Boden, Schild
  {
    const a = palms[0].userData.curve.getPointAt(0.45).multiplyScalar(1.4).add(palms[0].position);
    const b = palms[7].userData.curve.getPointAt(0.45).multiplyScalar(1.4).add(palms[7].position);
    add(hammock(a, b));
  }
  for (const p of HAIN_PROPS) {
    if (p.kind === 'schild') {
      const s = new THREE.Group();
      s.add(limb(V(0, 0, 0), V(-0.1, 2.2, 0), 0.07, 0x7a4b22, { outline: 0.03 }));
      const b = plate('KOKOSNÜSSE · SELBST PFLÜCKEN', 2.4, 0.4, { font: 'bold 54px sans-serif', tw: 1024, th: 160, thick: 0.05 }); b.position.set(-0.1, 2.15, 0); b.rotation.set(0, 0.5, 0.05); s.add(b);
      const b2 = plate('HELM EMPFOHLEN', 1.5, 0.3, { bg: '#e8c57a', font: 'bold 60px sans-serif', tw: 768, th: 140, thick: 0.05 }); b2.position.set(-0.08, 1.7, 0); b2.rotation.set(0, 0.6, -0.05); s.add(b2);
      s.position.set(p.x, 0, p.z); add(s);
    } else if (p.kind === 'helm') {
      const helm = toonMesh(new THREE.SphereGeometry(0.35, 12, 8, 0, Math.PI * 2, 0, Math.PI * 0.5), 0xffd54a, { outline: 0.03 }); helm.position.set(p.x, 0.05, p.z); helm.rotation.z = 0.4; add(helm);
      const dent = toonMesh(new THREE.SphereGeometry(0.12, 8, 6), 0xe8a034, { outline: 0.015 }); dent.position.set(p.x + 0.15, 0.3, p.z); add(dent); // Delle
    }
  }
  for (const c of hainColliders()) colliders.push(c);
  const hideouts = [{ ...HAIN_VERSTECK }];
  const CP = cl?.userData.parts;
  function update(t) {
    if (!cl) return;
    const k = t % 6;
    CP.head.rotation.y = 0.4 * Math.sin(t * 1.1);
    // alle 6 s fällt eine Nuss (0.8 s Fall), landet, hüpft kurz
    if (k < 0.8) { const u = k / 0.8; fallingNut.position.y = 5.5 * (1 - u * u); fallingNut.visible = true; CP.head.rotation.x = -0.5; }
    else if (k < 1.3) { fallingNut.position.y = 0.4 * Math.abs(Math.sin((k - 0.8) / 0.5 * Math.PI)); CP.head.rotation.x = 0; }
    else fallingNut.position.y = 0;
  }
  update(0);
  return { spots: HAIN_SPOTS, update, anchors: HAIN_ANCHORS, hideouts };
}
