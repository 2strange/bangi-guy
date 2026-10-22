// ambient.js — Figuren und Requisiten für die Ambient-Szenen aus data/szenen.json (Leben am Strand ohne Spielerzwang).
// Bausteine für das Szenen-System: jede Figur ist eine Gruppe (Füße auf y = 0, Blick +z) mit userData.parts,
// userData.update(t) und userData.pose(name, t0, dauer) — die Pose-Namen sind die aus szenen.json (schritte[].pose),
// laufen als Zeitfunktion u = (t − t0) / dauer im Update ab und räumen sich am Ende selbst auf. Ort, Weg und Zeitplan
// setzt das Spiel von außen. Erwachsene entstehen aus buildKunde() (Look wie die Kundschaft, Felder aus aussehen),
// Kinder haben einen eigenen Bau (kurze Beine, großer Kopf).
//
//   buildAmbientFigur(slug, aussehen)  Figur nach szenen.json-Slug: kind_1|kind_2|kind_3, ehe_sie|ehe_er, werfer_1|werfer_2,
//                                     chad, influencerin|reflektor_freund (aussehen = Felder wie kunden.json, optional)
//   fig.userData.update(t)             pro Frame; Grundverhalten (Gestikulieren, Schwanken, Rennen …) + laufende Pose
//   fig.userData.pose(name, t0, dauer) Pose aus szenen.json starten (t0 = Startzeit in derselben Uhr wie update)
//   handtuchAufLiege / handtuchRolle / handtuchPlan   Handtuch-Reservierung (siehe ambient-logik.js)
//   sandburgKaputt(), zzz()            Requisiten
// Pong (pong_mittag) liegt in zone-markt.js: buildMarkt().pongPose(name, t0, dauer).
import * as THREE from 'three';
import { toonMesh, toon, deform, rng, stripeTexture, textTexture, BLACK } from './toon.js';
import { limb, sandcastle } from './props.js';
import { faceDecal, face, setFace } from './faces.js';
import { kopfOhneSchattenwurf, pose, sneaker, kundenExtras } from './figures.js';
import { buildKunde, setMood, flipflop } from './kunden.js';
import { normalizeKunde } from './game.js';
import { HANDTUCH_FARBEN, handtuchPlan } from './ambient-logik.js';

const V = (x, y, z) => new THREE.Vector3(x, y, z);
const HAND = V(0.22, -0.92, 0.1); // hängende Hand im Arm-Pivot der Kunden (kunden.js)
const smoothstep = (x, a, b) => { const t = Math.min(1, Math.max(0, (x - a) / (b - a))); return t * t * (3 - 2 * t); };
const puls = (u, a, b) => (u < a ? 0 : u < b ? Math.sin((u - a) / (b - a) * Math.PI) : 0); // 0 → 1 → 0 zwischen a und b

// ---------- Zzz ----------
export function zzz({ size = 1.4 } = {}) {
  const tex = textTexture('z z Z', { bg: 'rgba(0,0,0,0)', fg: '#1a1a1a', font: 'bold 100px sans-serif', w: 256, h: 128 });
  const z = new THREE.Mesh(new THREE.PlaneGeometry(size, size / 2), new THREE.MeshBasicMaterial({ map: tex, transparent: true }));
  z.userData.y0 = 0;
  z.userData.update = (t) => { z.position.y = z.userData.y0 + 0.15 * Math.sin(t * 1.3); z.material.opacity = 0.7 + 0.3 * Math.sin(t * 2.1); };
  return z;
}

// ---------- Pose-Läufe (gemeinsam für alle Figuren) ----------
function startPose(fig, name, t0 = 0, dauer = 4) { fig.userData.poseLauf = { name, t0, dauer }; }
function poseU(fig, t) { // laufende Pose → { name, u } oder null (und Aufräumen, wenn vorbei)
  const L = fig.userData.poseLauf; if (!L) return null;
  const u = (t - L.t0) / L.dauer;
  if (u >= 1) { fig.userData.poseLauf = null; fig.userData.letztePose = L.name; return null; }
  return { name: L.name, u: Math.max(0, u) };
}
function ruhe(P) { for (const a of P.arms) a.rotation.set(0, 0, 0); for (const l of P.legs ?? []) l.rotation.set(0, 0, 0); P.head.rotation.set(0, 0, 0); }

// ---------- Kinder ----------
// Klein (Kopf auf ~1.5), großer Kopf, kurze Beine. slug kind_1 (8, Wasserpistole, Schwimmflügel, Sand im Gesicht),
// kind_2 (6, Flip-Flops, die er verliert, weiße Sonnencreme-Nase, tropfendes Eis, Zunge raus), kind_3 (4, Eimer,
// Enten-Schwimmring, ernst wie ein Beamter). Posen: rennen_kreis, flipflop_verlieren, eimer_kippen, pistole_auf_streife, fragen.
const SKIN_HEX = { hell: 0xf4c9a4, mittel: 0xe8a773, dunkel: 0x8d5a3a, sonnenbrand: 0xf0907a };
const KIND_DEFAULT = {
  kind_1: { seed: 1, hautton: 'mittel', haare: 'lang', item: 'wasserpistole', schwimmfluegel: true, sand: true, groesse: 1.0, schuhe: 'barfuss', mund: 'erschrocken' },
  kind_2: { seed: 2, hautton: 'hell', haare: 'kurz', item: 'wasserpistole', eis: true, nase: true, zunge: true, groesse: 0.9, schuhe: 'flipflop', mund: 'zufrieden' },
  kind_3: { seed: 3, hautton: 'dunkel', haare: 'lockig', item: 'eimer', ente: true, groesse: 0.78, schuhe: 'barfuss', mund: 'neutral', lids: [0.35, 0.35] },
};
export function buildKind(slug = 'kind_1', aussehen = null) {
  const D = { ...(KIND_DEFAULT[slug] ?? KIND_DEFAULT.kind_1) };
  if (aussehen) { if (aussehen.hautton) D.hautton = aussehen.hautton; if (aussehen.haare) D.haare = aussehen.haare; if (aussehen.schuhe) D.schuhe = aussehen.schuhe; }
  const root = new THREE.Group();
  const skin = SKIN_HEX[D.hautton] ?? SKIN_HEX.mittel;
  const shirt = [0xff5fa2, 0x3dd6e0, 0xffd54a, 0x3bb84a, 0xff7f3f][D.seed % 5];
  const hipY = 0.62;
  const legs = [], fuesse = [];
  for (const s of [-1, 1]) {
    const leg = new THREE.Group(); leg.position.set(s * 0.14, hipY, 0);
    leg.add(limb(V(0, 0, 0), V(0, 0.12 - hipY, 0), 0.075, skin, { outline: 0.03 }));
    const shorts = toonMesh(new THREE.CylinderGeometry(0.12, 0.13, 0.26, 8), [0x3a7bd5, 0xe8463a, 0x3bb84a][D.seed % 3], { outline: 0.025 }); shorts.position.y = -0.1; leg.add(shorts);
    let fuss;
    if (D.schuhe === 'flipflop') { fuss = flipflop(skin, 0xffd54a, s < 0 ? 'L' : 'R'); fuss.scale.setScalar(0.55); }
    else if (D.schuhe === 'turnschuh') { fuss = sneaker([0xe8463a, 0xffffff, 0x3bb84a][D.seed % 3], s < 0 ? 'L' : 'R'); fuss.scale.setScalar(0.48); }
    else { fuss = toonMesh(new THREE.BoxGeometry(0.17, 0.09, 0.3), skin, { outline: 0.025 }); fuss.position.y = 0.045; fuss.position.z = 0.05; const f2 = new THREE.Group(); f2.add(fuss); fuss = f2; }
    fuss.position.set(0, -hipY, 0.02); leg.add(fuss); fuesse.push(fuss);
    root.add(leg); legs.push(leg);
  }
  const body = new THREE.Group(); body.position.set(0, hipY - 0.04, 0); root.add(body);
  const torso = toonMesh(new THREE.CylinderGeometry(0.22, 0.25, 0.5, 10), shirt, { outline: 0.035 }); torso.position.y = 0.28; body.add(torso);
  const arms = [];
  for (const s of [-1, 1]) {
    const arm = new THREE.Group(); arm.position.set(s * 0.26, 0.5, 0); body.add(arm);
    const sl = toonMesh(new THREE.CylinderGeometry(0.09, 0.1, 0.14, 8), shirt, { outline: 0.025 }); sl.position.set(s * 0.02, -0.05, 0); sl.rotation.z = -s * 0.3; arm.add(sl);
    arm.add(limb(V(0, 0, 0), V(s * 0.08, -0.42, 0.04), 0.055, skin, { outline: 0.025 }));
    const hand = toonMesh(new THREE.SphereGeometry(0.1, 10, 8), skin, { outline: 0.025 }); hand.position.set(s * 0.09, -0.48, 0.05); arm.add(hand);
    arm.userData.hand = hand;
    if (D.schwimmfluegel) { const fl = toonMesh(new THREE.CylinderGeometry(0.13, 0.13, 0.14, 10), 0xff7f3f, { outline: 0.025 }); fl.position.set(s * 0.04, -0.16, 0.02); fl.rotation.z = -s * 0.3; arm.add(fl); }
    arms.push(arm);
  }
  // Kopf: groß; Kappe (kurz) oder Zöpfe (lang) oder Locken
  const head = new THREE.Group(); head.position.set(0, hipY + 0.5 + 0.36, 0.02); root.add(head);
  const hg = new THREE.SphereGeometry(0.36, 20, 16); hg.scale(1, 1.04, 0.96);
  head.add(toonMesh(hg, skin, { outline: 0.04 }));
  const skinCss = '#' + skin.toString(16).padStart(6, '0');
  const faceOpts = { skin: skinCss, seed: 300 + D.seed, lids: D.lids ?? [0.05, 0.05] };
  const decal = faceDecal(face('kunde', D.mund, faceOpts), 0.366, (g) => g.scale(1, 1.04, 0.96)); head.add(decal);
  const nose = toonMesh(new THREE.SphereGeometry(0.06, 8, 6), D.nase ? 0xffffff : skin, { outline: 0.02 }); nose.position.set(0, -0.04, 0.35); head.add(nose); // weiße Sonnencreme-Nase
  for (const s of [-1, 1]) { const ear = toonMesh(new THREE.SphereGeometry(0.07, 8, 6), skin, { outline: 0.02 }); ear.position.set(s * 0.36, 0, 0); head.add(ear); }
  if (D.sand) for (let i = 0; i < 7; i++) { const k = toonMesh(new THREE.SphereGeometry(0.018, 5, 4), 0xe8c47a, { outline: 0 }); const a = i * 0.9; k.position.set(Math.cos(a) * 0.14 + 0.05, -0.14 + Math.sin(a) * 0.06, 0.34); head.add(k); } // Sand im Gesicht
  if (D.zunge) { const z = toonMesh(new THREE.SphereGeometry(0.05, 8, 6), 0xff7b9c, { outline: 0.015 }); z.geometry.scale(1, 0.6, 1.3); z.position.set(0.03, -0.17, 0.33); head.add(z); }
  const hairColor = [0x4a2a12, 0xffe14a, 0x1a1a1a, 0xb8552a][D.seed % 4];
  if (D.haare === 'lockig') {
    for (let i = 0; i < 7; i++) { const a = i * 0.9; const h = toonMesh(new THREE.SphereGeometry(0.13, 10, 7), hairColor, { outline: 0.03 }); h.position.set(Math.cos(a) * 0.26, 0.28 + (i % 2) * 0.08, Math.sin(a) * 0.22 - 0.04); head.add(h); }
  } else {
    const hair = toonMesh(new THREE.SphereGeometry(0.38, 14, 10, 0, Math.PI * 2, 0, Math.PI * 0.42), hairColor, { outline: 0.035 }); hair.position.set(0, 0.08, -0.03); hair.rotation.x = -0.15; head.add(hair);
    if (D.haare === 'lang') {
      for (const s of [-1, 1]) { const z = toonMesh(new THREE.CylinderGeometry(0.06, 0.09, 0.4, 8), hairColor, { outline: 0.03 }); z.position.set(s * 0.4, -0.1, -0.05); z.rotation.z = s * 0.35; head.add(z); const b = toonMesh(new THREE.SphereGeometry(0.06, 8, 6), 0xff5fa2, { outline: 0.015 }); b.position.set(s * 0.37, 0.12, -0.05); head.add(b); }
    } else {
      const cap = toonMesh(new THREE.SphereGeometry(0.39, 14, 10, 0, Math.PI * 2, 0, Math.PI * 0.5), 0xe8463a, { outline: 0.035 }); cap.position.set(0, 0.12, -0.02); head.add(cap);
      const brim = toonMesh(new THREE.BoxGeometry(0.4, 0.05, 0.36), 0xe8463a, { outline: 0.025 }); brim.position.set(0, 0.22, 0.42); brim.rotation.x = -0.15; head.add(brim);
    }
  }
  kopfOhneSchattenwurf(head);
  // Items
  let pistole = null, strahl = null, eis = null, eimer = null, wasser = null, flipVerloren = null;
  if (D.item === 'wasserpistole') {
    const arm = arms[1];
    // Lauf zeigt den Arm entlang (lokal −y): hängt der Arm, zeigt sie nach unten; zeigt der Arm nach vorn, spritzt sie nach vorn
    pistole = new THREE.Group(); pistole.position.copy(arm.userData.hand.position).add(V(0.02, -0.02, 0.1)); pistole.rotation.x = Math.PI / 2; arm.add(pistole);
    const pc = [0xff7f3f, 0x3bb84a, 0xffd54a][D.seed % 3];
    const griff = toonMesh(new THREE.BoxGeometry(0.08, 0.16, 0.07), pc, { outline: 0.02 }); griff.position.set(0, -0.04, 0); pistole.add(griff);
    const lauf = toonMesh(new THREE.CylinderGeometry(0.045, 0.06, 0.32, 8), pc, { outline: 0.02 }); lauf.rotation.x = Math.PI / 2; lauf.position.set(0, 0.06, 0.14); pistole.add(lauf);
    const tank = toonMesh(new THREE.SphereGeometry(0.09, 10, 8), 0x3dd6e0, { outline: 0.02 }); tank.position.set(0, 0.14, 0.02); pistole.add(tank);
    strahl = toonMesh(new THREE.CylinderGeometry(0.02, 0.05, 1.8, 6), toon(0x7fd8ff, { transparent: true, opacity: 0.8 }), { outline: 0, shadow: false });
    strahl.rotation.x = Math.PI / 2; strahl.position.set(0, 0.06, 1.2); strahl.visible = false; pistole.add(strahl);
  }
  if (D.eis) {
    const arm = arms[0];
    eis = new THREE.Group(); eis.position.copy(arm.userData.hand.position).add(V(0, 0.08, 0.06)); arm.add(eis);
    const cone = toonMesh(new THREE.ConeGeometry(0.07, 0.24, 8), 0xd8a85a, { outline: 0.02 }); cone.rotation.x = Math.PI; cone.position.y = 0.05; eis.add(cone);
    [[0xff5fa2, 0.2], [0xfff1c2, 0.33], [0x6b4423, 0.45]].forEach(([c, y]) => { const k = toonMesh(new THREE.SphereGeometry(0.085, 10, 8), c, { outline: 0.02 }); k.position.y = y; eis.add(k); });
    const tropf = toonMesh(new THREE.SphereGeometry(0.03, 6, 5), 0xff5fa2, { outline: 0 }); tropf.position.set(0.06, 0.1, 0.02); eis.add(tropf); eis.userData.tropf = tropf;
  }
  if (D.item === 'eimer') {
    const arm = arms[1];
    eimer = new THREE.Group(); eimer.position.copy(arm.userData.hand.position).add(V(0.02, -0.2, 0.04)); arm.add(eimer);
    const e = toonMesh(new THREE.CylinderGeometry(0.15, 0.12, 0.26, 10, 1, true), toon(0xe8463a, { side: THREE.DoubleSide }), { outline: 0.025 }); eimer.add(e);
    const boden = toonMesh(new THREE.CylinderGeometry(0.12, 0.12, 0.02, 10), 0xe8463a, { outline: 0.02 }); boden.position.y = -0.13; eimer.add(boden);
    const henkel = toonMesh(new THREE.TorusGeometry(0.15, 0.015, 6, 14, Math.PI), 0x333333, { outline: 0.01 }); henkel.position.y = 0.12; eimer.add(henkel);
    const w = toonMesh(new THREE.CylinderGeometry(0.14, 0.14, 0.03, 10), toon(0x7fd8ff, { transparent: true, opacity: 0.85 }), { outline: 0, shadow: false }); w.position.y = 0.08; eimer.add(w);
    wasser = toonMesh(new THREE.ConeGeometry(0.22, 0.6, 8, 1, true), toon(0x7fd8ff, { transparent: true, opacity: 0.7, side: THREE.DoubleSide }), { outline: 0, shadow: false }); wasser.position.set(0, -0.1, 0.4); wasser.rotation.x = 2.4; wasser.visible = false; eimer.add(wasser); // Schwall beim Kippen
  }
  if (D.ente) { // Enten-Schwimmring um den Bauch
    const ring = toonMesh(new THREE.TorusGeometry(0.34, 0.1, 8, 20), 0xffd54a, { outline: 0.03 }); ring.rotation.x = Math.PI / 2; ring.position.set(0, 0.2, 0); body.add(ring);
    const kopf = toonMesh(new THREE.SphereGeometry(0.11, 10, 8), 0xffd54a, { outline: 0.025 }); kopf.position.set(0, 0.36, 0.42); body.add(kopf);
    const schnabel = toonMesh(new THREE.BoxGeometry(0.1, 0.05, 0.12), 0xff7f3f, { outline: 0.015 }); schnabel.position.set(0, 0.33, 0.54); body.add(schnabel);
    for (const s of [-1, 1]) { const auge = toonMesh(new THREE.SphereGeometry(0.02, 5, 4), BLACK, { outline: 0, basic: true }); auge.position.set(s * 0.05, 0.4, 0.5); body.add(auge); }
  }
  if (D.schuhe === 'flipflop') { flipVerloren = flipflop(skin, 0xffd54a, 'R'); flipVerloren.scale.setScalar(0.55); flipVerloren.visible = false; root.add(flipVerloren); } // der verlorene, fliegt nach hinten
  root.userData.parts = { legs, arms, head, body, decal, pistole, strahl, eis, eimer, wasser, fuesse, flipVerloren };
  root.userData.art = 'kind'; root.userData.seed = D.seed; root.userData.faceOpts = faceOpts; root.userData.mund = D.mund;
  root.userData.rennt = true;
  root.scale.setScalar(D.groesse);
  root.userData.update = (t) => updateKind(root, t);
  root.userData.pose = (name, t0, dauer) => startPose(root, name, t0, dauer);
  return root;
}
export function updateKind(k, t) {
  const P = k.userData.parts;
  const L = poseU(k, t), name = L?.name ?? null, u = L?.u ?? 0;
  const rennt = name ? name === 'rennen_kreis' || name === 'pistole_auf_streife' && u < 0.3 : k.userData.rennt;
  const w = t * 14 + k.userData.seed, gang = rennt ? Math.sin(w) : 0;
  P.legs[0].rotation.x = 0.9 * gang; P.legs[1].rotation.x = -0.9 * gang;
  P.body.rotation.x = rennt ? 0.18 : 0;
  const hop = rennt ? 0.03 * Math.abs(Math.cos(w)) : 0;
  P.body.position.y = (P.legs[0].position.y - 0.04) + hop; P.head.position.y = P.legs[0].position.y + 0.86 + hop;
  for (const [i, a] of P.arms.entries()) a.rotation.set(rennt ? -0.9 * gang * (i === 0 ? 1 : -1) - 0.3 : 0, 0, (i === 0 ? 1 : -1) * 0.15);
  P.head.rotation.set(rennt ? -0.1 : 0, 0.25 * Math.sin(t * 1.7 + k.userData.seed), 0.05 * gang);
  if (P.strahl) P.strahl.visible = false;
  if (P.wasser) P.wasser.visible = false;
  if (P.flipVerloren) P.flipVerloren.visible = false;
  if (P.fuesse[1]) P.fuesse[1].visible = true;
  if (P.eis?.userData.tropf) P.eis.userData.tropf.position.y = 0.1 - ((t * 0.4 + k.userData.seed) % 1) * 0.25;
  switch (name) {
    case 'pistole_auf_streife': { // bleibt stehen, Arm hoch, Dauerstrahl auf die Streife (das Spiel dreht das Kind zum Ziel)
      if (!P.strahl) break;
      const an = u >= 0.3;
      P.arms[1].rotation.set(-1.45 + 0.05 * Math.sin(t * 30), 0, -0.1);
      P.strahl.visible = an; P.strahl.scale.z = 0.8 + 0.3 * Math.abs(Math.sin(t * 9)); P.strahl.position.z = 0.3 + 0.9 * P.strahl.scale.z;
      P.head.rotation.set(-0.05, 0, 0.1);
      break;
    }
    case 'flipflop_verlieren': { // rechter Fuß kickt, der Flip-Flop fliegt nach hinten und bleibt liegen; Kind guckt hin
      const kick = puls(u, 0, 0.35);
      P.legs[1].rotation.x = -1.2 * kick;
      if (P.flipVerloren) {
        const f = Math.min(1, u / 0.6);
        P.fuesse[1].visible = u < 0.15; P.flipVerloren.visible = u >= 0.15;
        P.flipVerloren.position.set(0.3, Math.max(0, 1.0 * Math.sin(f * Math.PI)), -0.4 - 1.6 * f); P.flipVerloren.rotation.set(f * 9, 0.3, 0.5);
      }
      if (u > 0.5) P.head.rotation.set(0.3, Math.PI * 0.8, 0); // dreht sich um, schaut zum Schuh
      break;
    }
    case 'eimer_kippen': { // beide Arme hoch, Eimer kippt nach vorn, Schwall
      if (!P.eimer) break;
      const hoch = smoothstep(u, 0, 0.35), kipp = smoothstep(u, 0.35, 0.55);
      P.arms[1].rotation.set(-1.3 * hoch, 0, -0.2); P.arms[0].rotation.set(-1.3 * hoch, 0, 0.5);
      P.eimer.rotation.x = 1.6 * kipp; P.wasser.visible = kipp > 0.4 && u < 0.85;
      P.head.rotation.set(0.2 * hoch, 0, 0);
      break;
    }
    case 'fragen': { for (const a of P.arms) a.rotation.set(0.5, 0, 0); if (P.eis) P.arms[0].rotation.set(-1.3, 0, 0.3); P.head.rotation.set(0.1, 0, 0.25); break; }
    default: break;
  }
}

// ---------- Erwachsene aus der Kundschaft ----------
function figur(record, seed, { extras = true } = {}) {
  const k = normalizeKunde(record);
  const g = buildKunde(k, seed);
  if (extras) kundenExtras(g, k);
  g.userData.kunde = k;
  return g;
}
// Requisiten in der Hand: an einen Arm hängen (Position relativ zur Hand)
function inHand(arm, obj, offset = V(0, 0, 0), s = 1) { obj.position.copy(HAND).add(V(s * 0.04, -0.12, 0.02)).add(offset); arm.add(obj); return obj; }
function zeitschrift() { const g = new THREE.Group(); const r = toonMesh(new THREE.CylinderGeometry(0.06, 0.06, 0.42, 10), toon(0xffffff, { map: stripeTexture(['#ffffff', '#e8463a', '#ffffff', '#3a7bd5'], { vertical: false }) }), { outline: 0.02 }); r.rotation.z = Math.PI / 2; g.add(r); return g; }
function bierdose() { const g = new THREE.Group(); const d = toonMesh(new THREE.CylinderGeometry(0.08, 0.08, 0.24, 10), 0xe8463a, { outline: 0.02 }); g.add(d); const top = toonMesh(new THREE.CylinderGeometry(0.08, 0.08, 0.02, 10), 0xc9cfdc, { outline: 0.01 }); top.position.y = 0.12; g.add(top); return g; }
function kaffeebecher() { const g = new THREE.Group(); const b = toonMesh(new THREE.CylinderGeometry(0.09, 0.07, 0.2, 10), 0xffffff, { outline: 0.02 }); g.add(b); const h = toonMesh(new THREE.TorusGeometry(0.06, 0.015, 6, 10, Math.PI), 0xffffff, { outline: 0.01 }); h.position.set(0.09, 0, 0); h.rotation.y = Math.PI / 2; g.add(h); const dampf = toonMesh(new THREE.SphereGeometry(0.04, 6, 5), 0xffffff, { outline: 0, basic: true }); dampf.position.set(0, 0.18, 0); dampf.material = toon(0xffffff, { transparent: true, opacity: 0.5 }); g.add(dampf); g.userData.dampf = dampf; return g; }
function handtuchstapel(n = 4) { const g = new THREE.Group(); for (let i = 0; i < n; i++) { const h = toonMesh(new THREE.BoxGeometry(0.5, 0.08, 0.36), toon(0xffffff, { map: stripeTexture([HANDTUCH_FARBEN[i % 4][0], HANDTUCH_FARBEN[i % 4][1], HANDTUCH_FARBEN[i % 4][0]], { vertical: false }) }), { outline: 0.02 }); h.position.set((i % 2) * 0.03, 0.04 + i * 0.085, 0); h.rotation.y = (i % 2) * 0.12; g.add(h); } g.userData.anzahl = n; return g; }
function bademantel(g, hipY) { // weißer Mantel über dem Rumpf, Gürtel, Kragen — deckt das Kittel-Hemd aus buildKunde
  const m = toonMesh(new THREE.CylinderGeometry(0.5, 0.6, 1.55, 14), 0xf4f4f8, { outline: 0.045 }); m.position.set(0, hipY + 0.2, 0); g.add(m);
  const kragen = toonMesh(new THREE.TorusGeometry(0.34, 0.07, 8, 14, Math.PI), 0xf4f4f8, { outline: 0.03 }); kragen.position.set(0, hipY + 0.95, 0.05); kragen.rotation.x = Math.PI / 2; g.add(kragen);
  const guertel = toonMesh(new THREE.CylinderGeometry(0.56, 0.56, 0.07, 14), 0xf4f4f8, { outline: 0.025 }); guertel.position.set(0, hipY + 0.1, 0); g.add(guertel);
  const knoten = toonMesh(new THREE.BoxGeometry(0.14, 0.08, 0.08), 0xf4f4f8, { outline: 0.02 }); knoten.position.set(0.1, hipY + 0.1, 0.55); g.add(knoten);
  for (const s of [-1, 1]) { const sl = toonMesh(new THREE.CylinderGeometry(0.18, 0.2, 0.42, 10), 0xf4f4f8, { outline: 0.035 }); sl.position.set(s * 0.06, -0.2, 0.03); sl.rotation.z = -s * 0.25; g.userData.parts.arms[s < 0 ? 0 : 1].add(sl); }
}
function lockenwickler(head) { for (let i = 0; i < 7; i++) { const a = -1.2 + i * 0.4; const w = toonMesh(new THREE.CylinderGeometry(0.07, 0.07, 0.22, 8), [0xff5fa2, 0x3dd6e0, 0xffd54a][i % 3], { outline: 0.02 }); w.position.set(Math.sin(a) * 0.5, 0.36, Math.cos(a) * 0.38 - 0.1); w.rotation.z = Math.PI / 2; w.rotation.y = -a; head.add(w); } }
function schnorchel(head) { // Maske auf der Stirn, Rohr seitlich; Gruppe, damit sie runter über die Augen rutschen kann
  const g = new THREE.Group(); g.position.set(0, 0.3, 0.42); head.add(g);
  const maske = toonMesh(new THREE.BoxGeometry(0.62, 0.26, 0.14), 0x3dd6e0, { outline: 0.03 }); g.add(maske);
  const glas = toonMesh(new THREE.BoxGeometry(0.5, 0.18, 0.04), toon(0xcfeeff, { transparent: true, opacity: 0.75 }), { outline: 0.015 }); glas.position.z = 0.08; g.add(glas);
  const band = toonMesh(new THREE.TorusGeometry(0.5, 0.03, 6, 16, Math.PI), BLACK, { outline: 0 }); band.position.set(0, 0, -0.4); band.rotation.set(0, 0, Math.PI); band.rotation.x = Math.PI / 2; g.add(band);
  const rohr = toonMesh(new THREE.CylinderGeometry(0.035, 0.035, 0.55, 8), 0xff7f3f, { outline: 0.02 }); rohr.position.set(0.38, 0.25, -0.1); g.add(rohr);
  return g;
}
function ringlicht(arm) { const r = toonMesh(new THREE.TorusGeometry(0.16, 0.02, 8, 24), 0xffffff, { outline: 0.012, basic: true }); r.material = toon(0xffffff, { emissive: 0xffffff, emissiveIntensity: 0.6 }); inHand(arm, r, V(-0.1, 0.25, 0.3), 1); r.rotation.x = -1.2; return r; }
function reflektorScheibe(r = 0.95) {
  const g = new THREE.Group();
  const disc = toonMesh(new THREE.CylinderGeometry(r, r, 0.03, 28), toon(0xe8ecf2, { emissive: 0x222222 }), { outline: 0.03 }); disc.rotation.x = Math.PI / 2; g.add(disc);
  const ring = toonMesh(new THREE.TorusGeometry(r, 0.04, 8, 36), 0xf1c232, { outline: 0.02 }); g.add(ring);
  const glanz = toonMesh(new THREE.CylinderGeometry(r * 0.4, r * 0.4, 0.035, 16), 0xffffff, { outline: 0, basic: true }); glanz.rotation.x = Math.PI / 2; glanz.position.set(-r * 0.25, r * 0.25, 0); glanz.scale.set(1, 0.4, 1); g.add(glanz);
  return g;
}
function stativ() { const g = new THREE.Group(); for (let i = 0; i < 3; i++) { const a = i * 2.1; g.add(limb(V(Math.cos(a) * 0.45, 0, Math.sin(a) * 0.45), V(0, 1.5, 0), 0.025, 0x333333, { outline: 0.012 })); } const kopf = toonMesh(new THREE.BoxGeometry(0.12, 0.08, 0.12), 0x333333, { outline: 0.015 }); kopf.position.y = 1.55; g.add(kopf); const r = toonMesh(new THREE.TorusGeometry(0.28, 0.03, 8, 24), 0xffffff, { outline: 0.012 }); r.material = toon(0xffffff, { emissive: 0xffffff, emissiveIntensity: 0.5 }); r.position.y = 1.9; g.add(r); return g; }
export function bierdosenHaufen(n = 7, seed = 3) { const g = new THREE.Group(); const r = rng(seed); for (let i = 0; i < n; i++) { const d = bierdose(); d.position.set((r() - 0.5) * 1.2, 0.08, (r() - 0.5) * 0.8); d.rotation.set(Math.PI / 2 + (r() - 0.5) * 0.4, r() * 6, 0); if (i % 3 === 0) { d.rotation.x = 0; d.position.y = 0.12; } g.add(d); } return g; }
export function sandburgKaputt() { const g = sandcastle(); g.children.forEach((c, i) => { if (i > 1 && i % 2 === 0) c.rotation.z += 0.9; if (i === 3) c.position.y -= 0.6; }); const kerbe = toonMesh(new THREE.BoxGeometry(0.6, 0.6, 0.6), 0xe8c47a, { outline: 0.03 }); kerbe.position.set(0.9, 0.3, 0.5); kerbe.rotation.set(0.3, 0.4, 0.6); g.add(kerbe); return g; }
export { reflektorScheibe, stativ, zeitschrift, bierdose, kaffeebecher, handtuchstapel };

// ---------- Figuren nach Slug ----------
const AUSSEHEN_DEFAULT = {
  ehe_sie: { id: 'ehe_sie', typ: 'Hotelgast', schuhe: 'sandale', hemd: 'hawaii', hose: 'rock', hautton: 'sonnenbrand', brille: 'sonnenbrille', haare: 'kurz', accessoire: 'handy', extras: ['strohhut', 'bauchtasche'], stimmung_start: 'misstrauisch' },
  ehe_er: { id: 'ehe_er', typ: 'Hotelgast', schuhe: 'sandale', hemd: 'polo_sauber', hose: 'shorts', hautton: 'sonnenbrand', bart: 'schnauzer', brille: 'lesebrille', haare: 'glatze', accessoire: 'bierdose', extras: ['socken'], stimmung_start: 'zufrieden' },
  werfer_1: { id: 'werfer_1', typ: 'Frühaufsteher', schuhe: 'sandale', hemd: 'kittel', hose: 'lang', hautton: 'hell', haare: 'glatze', extras: ['socken'], stimmung_start: 'neutral' },
  werfer_2: { id: 'werfer_2', typ: 'Frühaufsteherin', schuhe: 'sandale', hemd: 'kittel', hose: 'lang', hautton: 'hell', brille: 'lesebrille', haare: 'weiss', stimmung_start: 'misstrauisch' },
  chad: { id: 'chad', typ: 'Tourist', schuhe: 'flipflop', hemd: 'trikot', hose: 'shorts', hautton: 'sonnenbrand', brille: 'sonnenbrille', haare: 'kurz', accessoire: 'bierdose', extras: ['blumenkranz'], stimmung_start: 'zufrieden' },
  influencerin: { id: 'influencerin', typ: 'Content', schuhe: 'barfuss', hemd: 'tanktop', hose: 'rock', hautton: 'hell', brille: 'sonnenbrille', haare: 'lang', accessoire: 'handy', extras: ['riesenhut'], stimmung_start: 'zufrieden' },
  reflektor_freund: { id: 'reflektor_freund', typ: 'Freund', schuhe: 'turnschuh', hemd: 'polo_sauber', hose: 'chino', hautton: 'hell', bart: 'stoppel', haare: 'kurz', accessoire: 'rucksack', extras: ['socken'], stimmung_start: 'neutral' },
};
const SEEDS = { ehe_sie: 41, ehe_er: 42, werfer_1: 43, werfer_2: 44, chad: 61, influencerin: 51, reflektor_freund: 52 };

/** Figur nach szenen.json-Slug; aussehen überschreibt die Defaults feldweise (unbekannte Accessoires/Extras werden hier ergänzt). */
export function buildAmbientFigur(slug, aussehen = null) {
  if (slug.startsWith('kind')) return buildKind(slug, aussehen);
  const base = AUSSEHEN_DEFAULT[slug]; if (!base) return null;
  const rec = { ...base, ...(aussehen ?? {}), id: slug };
  // Felder, die kunden.js nicht kennt, hier abfangen (normalizeKunde filtert sie sonst nur weg)
  const extrasWunsch = new Set(rec.extras ?? []), accWunsch = rec.accessoire;
  if (accWunsch === 'reflektor' || accWunsch === 'wasserpistole' || accWunsch === 'eimer') rec.accessoire = slug === 'reflektor_freund' ? 'rucksack' : null;
  const g = figur(rec, SEEDS[slug] ?? 7);
  const P = g.userData.parts, hipY = P.legs[0].position.y;
  const E = g.userData.ambient = { art: slug, props: {} };
  if (slug === 'ehe_sie') {
    E.props.zeitschrift = inHand(P.arms[0], zeitschrift(), V(0, 0.05, 0.1), -1);
  }
  if (slug === 'ehe_er') {
    E.props.schnorchel = schnorchel(P.head);
    E.props.tropfen = []; for (let i = 0; i < 6; i++) { const d = toonMesh(new THREE.SphereGeometry(0.04, 6, 5), 0x7fd8ff, { outline: 0 }); d.visible = false; g.add(d); E.props.tropfen.push(d); }
  }
  if (slug === 'werfer_1' || slug === 'werfer_2') {
    bademantel(g, hipY);
    if (slug === 'werfer_1') { E.props.stapel = inHand(P.arms[0], handtuchstapel(4), V(0.1, 0.1, 0.2), -1); E.props.becher = inHand(P.arms[1], kaffeebecher(), V(0, 0.1, 0.1), 1); E.props.rolle = inHand(P.arms[1], handtuchRolle(HANDTUCH_FARBEN[1]), V(0, 0.05, 0.15), 1); E.props.rolle.visible = false; }
    if (slug === 'werfer_2') { lockenwickler(P.head); E.props.stapel = inHand(P.arms[0], handtuchstapel(5), V(0.1, 0.1, 0.2), -1); }
  }
  if (slug === 'chad') {
    E.props.dose2 = inHand(P.arms[0], bierdose(), V(0, 0.08, 0.1), -1);
    const cap = toonMesh(new THREE.SphereGeometry(0.56, 16, 10, 0, Math.PI * 2, 0, Math.PI * 0.5), 0x8b1e1e, { outline: 0.045 }); cap.position.set(0, 0.2, 0); P.head.add(cap);
    const brim = toonMesh(new THREE.BoxGeometry(0.55, 0.07, 0.5), 0x8b1e1e, { outline: 0.035 }); brim.position.set(0, 0.36, -0.6); brim.rotation.x = 0.2; P.head.add(brim); // Cap rückwärts
    cap.castShadow = brim.castShadow = false;
    const z = zzz(); z.visible = false; z.position.set(0.6, 2.9, 0); z.userData.y0 = 2.9; g.add(z); E.props.zzz = z;
    g.userData.faceOpts = { ...g.userData.faceOpts, look: [[-34, 34], [0, 12]] }; setMood(g, 'zufrieden'); // Augen in zwei Richtungen
  }
  if (slug === 'influencerin') { E.props.ringlicht = ringlicht(P.arms[1]); const b = toonMesh(new THREE.SphereGeometry(0.24, 10, 8), 0xffffff, { outline: 0, basic: true, shadow: false }); b.visible = false; inHand(P.arms[1], b, V(-0.1, 0.25, 0.3), 1); E.props.blitz = b; }
  if (slug === 'reflektor_freund') {
    E.props.reflektor = reflektorScheibe(1.0); E.props.reflektor.position.set(0, hipY + 0.9, 0.8); g.add(E.props.reflektor);
    for (const [i, a] of P.arms.entries()) a.rotation.set(-1.5, 0, (i === 0 ? 1 : -1) * 0.35);
    for (let i = 0; i < 3; i++) { const d = toonMesh(new THREE.SphereGeometry(0.035, 6, 5), 0x7fd8ff, { outline: 0 }); d.position.set(0.3 + i * 0.1, 0.1 - i * 0.15, 0.45); P.head.add(d); } // Schweiß
    setFace(P.decal, face('kunde', 'muede', g.userData.faceOpts)); // leerer Blick
  }
  g.userData.update = (t) => updateAmbient(g, t);
  g.userData.pose = (name, t0, dauer) => startPose(g, name, t0, dauer);
  return g;
}

// Grundverhalten + Posen je Figurenart. u = Fortschritt der laufenden Pose (0…1).
export function updateAmbient(g, t) {
  const P = g.userData.parts, E = g.userData.ambient; if (!P || !E) return;
  const L = poseU(g, t), name = L?.name ?? null, u = L?.u ?? 0;
  const armL = P.arms[0], armR = P.arms[1], head = P.head;
  const s = Math.sin(t * 5), c = Math.sin(t * 5 + 1.3);
  switch (E.art) {
    case 'ehe_sie': {
      // Grund: Mund in Bewegung = Kopf nickt, Hände reden mit
      armL.rotation.set(-1.2 - 0.3 * s, 0, 0.5); armR.rotation.set(-1.0 + 0.4 * c, 0, -0.5 - 0.2 * s); head.rotation.set(0.1 + 0.06 * s, 0.1 * c, 0.05);
      if (name === 'handy_hochhalten') { armR.rotation.set(-2.9 + 0.1 * Math.sin(t * 3), 0.2, -0.3); head.rotation.set(-0.45, 0.2 * Math.sin(t * 2), 0.1); } // sucht Empfang
      if (name === 'zeitschrift_rollen') { const r = Math.sin(t * 8); armL.rotation.set(-1.3, 0, 0.3 + 0.15 * r); armR.rotation.set(-1.3, 0, -0.3 - 0.15 * r); head.rotation.set(0.35, 0, 0); E.props.zeitschrift.rotation.y = t * 3; }
      if (name === 'hinterherrufen') { armR.rotation.set(-2.3, -0.3, -0.5); armL.rotation.set(0.3, 0, 0.8); head.rotation.set(-0.15, 0.5, 0.05); g.rotation.x = -0.08 * puls(u, 0, 1); } // Hand am Mund, Körper vor
      else g.rotation.x = 0;
      break;
    }
    case 'ehe_er': {
      // Grund: zufrieden bis zur Provokation — Schultern zucken, Dose locker, Blick weg
      armL.rotation.set(-0.3, 0, 0.5); armR.rotation.set(-0.7, 0, -0.3); head.rotation.set(-0.05, 0.5 * Math.sin(t * 0.9), 0.05);
      E.props.schnorchel.position.y = 0.3; E.props.schnorchel.rotation.x = 0;
      for (const d of E.props.tropfen) d.visible = false;
      if (name === 'dose_heben') { armR.rotation.set(-2.4 + 0.1 * Math.sin(t * 2), 0, -0.45); head.rotation.set(-0.2, 0.2, 0.05); }
      if (name === 'schnorchel_runter') { const r = smoothstep(u, 0.1, 0.4); armL.rotation.set(-2.6 * (1 - smoothstep(u, 0.4, 0.6)), 0, 0.3); E.props.schnorchel.position.y = 0.3 - 0.38 * r; E.props.schnorchel.position.z = 0.42 + 0.05 * r; head.rotation.set(0.1, 0.9 * smoothstep(u, 0.5, 1), 0); } // Maske über die Augen, dann ab ins Meer
      if (name === 'zurueckkommen_nass') { // schüttelt sich, Tropfen fliegen
        const sh = Math.sin(t * 12);
        armL.rotation.set(-0.6, 0, 1.1 + 0.2 * sh); armR.rotation.set(-0.6, 0, -1.1 - 0.2 * sh); head.rotation.set(0, 0.3 * sh, 0.1 * sh);
        E.props.tropfen.forEach((d, i) => { const ph = (t * 1.5 + i * 0.37) % 1; d.visible = u < 0.7; d.position.set(Math.cos(i * 1.05) * (0.6 + ph * 0.9), 2.4 - ph * 1.6, Math.sin(i * 1.05) * (0.6 + ph * 0.9)); });
      }
      break;
    }
    case 'werfer_1': {
      armL.rotation.set(-1.3, 0, 0.4); armR.rotation.set(-0.8, 0, -0.25); head.rotation.set(0.05, 0.2 * Math.sin(t * 0.5), 0);
      E.props.rolle.visible = false; E.props.becher.visible = true;
      if (name === 'handtuch_werfen') { // Becher weg, Rolle in die Hand, ausholen, werfen (Wurf bei u ≈ 0.55: wurfMoment() sagt es dem Spiel)
        E.props.becher.visible = false; E.props.rolle.visible = u < 0.55;
        const aushol = smoothstep(u, 0.05, 0.4), wurf = smoothstep(u, 0.45, 0.6);
        armR.rotation.set(-0.8 - 2.0 * aushol + 2.6 * wurf, 0, -0.25 - 0.3 * aushol);
        head.rotation.set(-0.1, 0.2, 0); g.rotation.x = 0.05 * aushol - 0.12 * wurf;
        E.wurfMoment = u >= 0.55;
      } else { g.rotation.x = 0; E.wurfMoment = false; }
      break;
    }
    case 'werfer_2': {
      armL.rotation.set(-1.3, 0, 0.4); armR.rotation.set(-0.2, 0, -0.3); head.rotation.set(0.05, 0.4 * Math.sin(t * 0.6), 0);
      if (name === 'stapel_reichen') { armL.rotation.set(-1.6, 0.4, 0.2); armR.rotation.set(-1.5, -0.3, -0.2); head.rotation.set(0.15, -0.4, 0); } // Stapel nach vorn zum Werfer
      if (name === 'zaehlen') { const n = Math.floor(u * 4); armR.rotation.set(-1.9, 0, -0.4 + 0.3 * Math.sin(t * 6)); head.rotation.set(0.15 * ((n + 1) % 2), 0.3 * Math.sin(t * 2), 0); } // Finger zählt, nickt bei Treffern
      break;
    }
    case 'chad': {
      E.props.zzz.visible = false;
      const w1 = Math.sin(t * 1.1), w2 = Math.sin(t * 0.7 + 1);
      g.rotation.z = 0.12 * w1; g.rotation.x = 0.06 * w2;
      head.rotation.set(0.15 + 0.15 * w2, 0.4 * w1, -0.2 * w1);
      armR.rotation.set(-1.0, 0, -0.5); armL.rotation.set(-0.5, 0, 0.6);
      if (name === 'an_tresen_lehnen') { g.rotation.z = -0.22; g.rotation.x = 0.05; armL.rotation.set(-1.2, 0, 1.3); head.rotation.set(0.1, 0.5, 0.3); } // Ellbogen auf dem Tresen (links)
      if (name === 'dose_heben') { armR.rotation.set(-2.6 + 0.15 * w1, 0, -0.5); head.rotation.set(-0.35, 0.2 * w1, 0.1); }
      if (name === 'kippen_fangen') { const kipp = puls(u, 0, 0.6); g.rotation.z = 0.5 * kipp; armL.rotation.set(-1.4 * kipp, 0, 1.4 * kipp); armR.rotation.set(-1.0, 0, -0.5 - 0.6 * kipp); P.legs[0].rotation.x = 0.5 * puls(u, 0.3, 0.7); head.rotation.set(0.1, 0, -0.3 * kipp); } // kippt zur Seite, fängt sich mit Ausfallschritt
      if (name === 'moewe_anreden') { armR.rotation.set(-2.2, 0.4, -0.6); head.rotation.set(-0.45, -0.4, 0.1); } // zeigt nach oben, redet
      if (name === 'einschlafen_tresen') { const r = smoothstep(u, 0, 0.5); g.rotation.z = -0.25 * r; g.rotation.x = 0.35 * r; armL.rotation.set(-1.4 * r, 0, 1.0 * r); armR.rotation.set(-1.3 * r, 0, -0.9 * r); head.rotation.set(0.6 * r, 0.3, 0); E.props.zzz.visible = u > 0.5; E.props.zzz.userData.update(t); if (u > 0.5 && !E.schlaeftGesicht) { setMood(g, 'schlaeft'); E.schlaeftGesicht = true; } }
      else if (E.schlaeftGesicht) { setMood(g, 'zufrieden'); E.schlaeftGesicht = false; }
      break;
    }
    case 'influencerin': {
      // Dauerpose: Hand in der Hüfte, Handy mit Ringlicht oben, Kopf in einem der drei Winkel
      armR.rotation.set(-2.6 + 0.15 * Math.sin(t * 2), -0.3, -0.5); armL.rotation.set(0.2, 0, 0.9); head.rotation.set(-0.25, 0.3, 0.2);
      E.props.blitz.visible = false;
      if (name === 'pose_steg') { g.rotation.z = 0.08; armL.rotation.set(0.1, 0, 1.1); head.rotation.set(-0.2, 0.6, 0.3); } // Hüfte raus, Kinn hoch
      else g.rotation.z = 0;
      if (name === 'foto') { const k = (u * 3) % 1; E.props.blitz.visible = k > 0.55 && k < 0.62; E.props.blitz.scale.setScalar(1 + 2 * (k - 0.55) / 0.07); head.rotation.set(-0.3, 0.2 * Math.sin(u * 9), 0.15); } // drei Blitze
      if (name === 'pose_wechseln') { armL.rotation.set(-2.7, 0, 0.5); armR.rotation.set(-2.7, 0, -0.5); head.rotation.set(-0.4, -0.5, -0.25); } // beide Hände hoch, anderer Winkel
      break;
    }
    case 'reflektor_freund': {
      const seufz = (t % 6) < 1 ? Math.sin((t % 6) * Math.PI) : 0;
      for (const [i, a] of P.arms.entries()) a.rotation.set(-1.5 + 0.25 * seufz, 0, (i === 0 ? 1 : -1) * 0.35);
      E.props.reflektor.position.set(0, P.legs[0].position.y + 0.9 - 0.2 * seufz, 0.8); E.props.reflektor.rotation.set(0.1 * seufz, 0, 0);
      head.rotation.set(0.2 + 0.15 * seufz, 0.15 * Math.sin(t * 0.4), 0.08);
      if (name === 'reflektor_heben') { const h = smoothstep(u, 0, 0.4); for (const [i, a] of P.arms.entries()) a.rotation.set(-1.5 - 1.3 * h, 0, (i === 0 ? 1 : -1) * 0.35); E.props.reflektor.position.set(0, P.legs[0].position.y + 0.9 + 1.4 * h, 0.8 - 0.5 * h); E.props.reflektor.rotation.set(-0.6 * h, 0, 0); head.rotation.set(-0.3 * h, 0, 0.05); }
      if (name === 'blick_ins_meer') { for (const [i, a] of P.arms.entries()) a.rotation.set(-0.4, 0, (i === 0 ? 1 : -1) * 0.3); E.props.reflektor.position.set(0.6, 0.95, 0.4); E.props.reflektor.rotation.set(0, 0.3, 1.3); head.rotation.set(-0.1, 1.1, 0); } // Scheibe abgestellt, schaut dahin, wo das Leben ist
      break;
    }
    default: break;
  }
}

// ---------- Stolpern (Streife über Kind 2) ----------
// Für jede Figur mit Kunden-Teilen (parts.legs/arms/head), pro Frame mit u = Fortschritt 0…1 aufrufen (Dauer setzt das
// Spiel, szenen.json sagt 5 s): fällt nach vorn, Arme rudern, liegt kurz, steht langsam wieder auf. u ≥ 1 = aufgeräumt.
export function stolpern(fig, u) {
  const P = fig.userData.parts; if (!P) return;
  if (u >= 1) { fig.rotation.x = 0; fig.position.y = fig.userData.stolperY0 ?? fig.position.y; for (const a of P.arms) a.rotation.set(0, 0, 0); for (const l of P.legs) l.rotation.set(0, 0, 0); P.head.rotation.set(0, 0, 0); fig.userData.stolperY0 = undefined; return; }
  if (fig.userData.stolperY0 === undefined) fig.userData.stolperY0 = fig.position.y;
  const fall = smoothstep(u, 0, 0.18), liegt = smoothstep(u, 0.18, 0.22), auf = smoothstep(u, 0.5, 0.95);
  const kipp = (1.45 * fall) * (1 - auf);
  fig.rotation.x = kipp;
  fig.position.y = fig.userData.stolperY0 + 0.25 * fall * (1 - auf); // Fußpunkt bleibt unten, Körper liegt
  for (const [i, a] of P.arms.entries()) a.rotation.set(-2.0 * fall * (1 - auf) + (u < 0.18 ? 0.6 * Math.sin(u * 60) : 0), 0, (i === 0 ? 1 : -1) * (0.9 * fall * (1 - auf)));
  P.legs[0].rotation.x = -0.7 * fall * (1 - auf) + 0.3 * puls(u, 0.5, 0.8); P.legs[1].rotation.x = 0.4 * fall * (1 - auf);
  P.head.rotation.set(-0.6 * liegt * (1 - auf) + 0.2 * puls(u, 0.25, 0.5), 0.3 * Math.sin(u * 20) * liegt * (1 - auf), 0);
}

// ---------- Handtücher ----------
function handtuchMat(farben) { return toon(0xffffff, { map: stripeTexture([farben[0], farben[1], farben[0], farben[1], farben[0], farben[1]], { vertical: false }) }); }
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
