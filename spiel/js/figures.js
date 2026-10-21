// figures.js — die Figuren, ohne Rig, aber mit Pivot-Gruppen, die sich animieren lassen:
// userData.parts = { body, legs: [L, R], arms: [L, R], head }. Beine/Arme drehen um Hüfte/Schulter (x-Achse).
import * as THREE from 'three';
import { RoundedBoxGeometry } from 'three/addons/geometries/RoundedBoxGeometry.js';
import { toonMesh, toon, deform, BLACK } from './toon.js';
import { limb } from './props.js';
import { faceDecal, schluffiFace, runnerFace, face, setFace } from './faces.js';

const V = (x, y, z) => new THREE.Vector3(x, y, z);

// ---------- Schuhe ----------
// side: 'L' (links) | 'R' (rechts). Die Figur schaut nach +z, ihr linker Fuß steht bei -x; die Innenseite
// des linken Fußes zeigt also nach +x. Gespiegelt wird über das Vorzeichen m (keine negative Skalierung,
// sonst kippen die Kontur-Hüllen). Großer Zeh innen, Zehenkappe zur Innenseite gezogen, Streifen nur außen.
const sideSign = (side) => (side === 'R' ? -1 : 1);

export function sandal(skin, side = 'L') {
  const m = sideSign(side);
  const g = new THREE.Group();
  const soleGeo = new RoundedBoxGeometry(0.54, 0.15, 1.12, 3, 0.05);
  const toeward = (v) => { if (v.z > 0.1) v.x += m * 0.06 * (v.z - 0.1) / 0.46; }; // Sohle vorn zur Innenseite
  deform(soleGeo, toeward);
  const sole = toonMesh(soleGeo, 0x6e4120, { outline: 0.045 });
  sole.position.y = 0.075;
  g.add(sole);
  const sole2Geo = new RoundedBoxGeometry(0.5, 0.06, 1.06, 3, 0.03);
  deform(sole2Geo, toeward);
  const sole2 = toonMesh(sole2Geo, 0xe0a86a, { outline: 0.025 });
  sole2.position.y = 0.17;
  g.add(sole2);
  const footGeo = new RoundedBoxGeometry(0.42, 0.16, 0.74, 3, 0.07);
  deform(footGeo, (v) => { if (v.z < -0.22) v.y += 0.06; if (v.z > 0.1) v.x += m * 0.04 * (v.z - 0.1) / 0.27; });
  const foot = toonMesh(footGeo, skin, { outline: 0.04 });
  foot.position.set(0, 0.27, -0.12);
  g.add(foot);
  // Zehen: der große innen (+x·m), nach außen kleiner und weiter hinten
  const toes = [[0.16, 0.11], [0.04, 0.085], [-0.06, 0.075], [-0.145, 0.067], [-0.22, 0.06]];
  for (const [x, r] of toes) {
    const t = toonMesh(new THREE.SphereGeometry(r, 9, 7), skin, { outline: 0.03 });
    t.position.set(m * x, 0.2 + r * 0.5, 0.3 + (0.11 - r) * 0.8);
    g.add(t);
    const nail = toonMesh(new THREE.SphereGeometry(r * 0.45, 6, 5), 0xfff0d8, { outline: 0.015 });
    nail.position.set(0, r * 0.5, r * 0.55);
    t.add(nail);
  }
  const strap1 = toonMesh(new THREE.TorusGeometry(0.24, 0.05, 6, 14, Math.PI), 0x3a1e0c, { outline: 0.03 });
  strap1.position.set(m * 0.02, 0.2, 0.1);
  strap1.rotation.y = -m * 0.12; // Riemchen läuft schräg zum großen Zeh
  g.add(strap1);
  const strap2 = toonMesh(new THREE.TorusGeometry(0.26, 0.05, 6, 14, Math.PI), 0x3a1e0c, { outline: 0.03 });
  strap2.position.set(0, 0.22, -0.22);
  strap2.rotation.x = 0.15;
  g.add(strap2);
  return g;
}

export function sneaker(color = 0xe8463a, side = 'L') {
  const m = sideSign(side);
  const g = new THREE.Group();
  const toeward = (v) => { if (v.z > 0.15) v.x += m * 0.08 * (v.z - 0.15) / 0.46; }; // Zehenkappe zur Innenseite
  const soleGeo = new RoundedBoxGeometry(0.54, 0.22, 1.22, 3, 0.08);
  deform(soleGeo, toeward);
  const sole = toonMesh(soleGeo, 0xffffff, { outline: 0.045 });
  sole.position.y = 0.11;
  g.add(sole);
  const soleLineGeo = new RoundedBoxGeometry(0.57, 0.05, 1.25, 2, 0.02);
  deform(soleLineGeo, toeward);
  const soleLine = toonMesh(soleLineGeo, 0xc9cfdc, { outline: 0.02 });
  soleLine.position.y = 0.07;
  g.add(soleLine);
  const upperGeo = new RoundedBoxGeometry(0.48, 0.36, 1.04, 3, 0.12);
  deform(upperGeo, (v) => {
    if (v.z < -0.28) v.y += 0.1;
    if (v.z > 0.25 && v.y > 0) v.y -= 0.12 * (v.z - 0.25);
    toeward(v);
  });
  const upper = toonMesh(upperGeo, color, { outline: 0.045 });
  upper.position.set(0, 0.38, -0.06);
  g.add(upper);
  const cap = toonMesh(new RoundedBoxGeometry(0.46, 0.2, 0.36, 3, 0.1), 0xffffff, { outline: 0.035 });
  cap.position.set(m * 0.05, 0.3, 0.4);
  cap.rotation.y = -m * 0.1;
  g.add(cap);
  // drei Streifen nur an der Außenseite
  for (let i = 0; i < 3; i++) {
    const stripe = toonMesh(new THREE.BoxGeometry(0.03, 0.26, 0.07), 0xffffff, { outline: 0.015 });
    stripe.position.set(-m * 0.245, 0.38, -0.02 + i * 0.14);
    stripe.rotation.x = -0.5;
    g.add(stripe);
  }
  const tongue = toonMesh(new THREE.BoxGeometry(0.24, 0.28, 0.08), 0xb83428, { outline: 0.03 });
  tongue.position.set(m * 0.02, 0.6, -0.28);
  tongue.rotation.set(0.4, 0, -m * 0.08);
  g.add(tongue);
  for (let i = 0; i < 4; i++) {
    const lace = toonMesh(new THREE.BoxGeometry(0.32, 0.055, 0.07), 0xffffff, { outline: 0.02 });
    lace.position.set(m * 0.015 * i, 0.6 - i * 0.05, -0.16 + i * 0.11);
    lace.rotation.set(0.35, 0, -m * 0.1);
    g.add(lace);
  }
  const heel = toonMesh(new THREE.BoxGeometry(0.2, 0.16, 0.05), 0xffffff, { outline: 0.02 });
  heel.position.set(0, 0.62, -0.54);
  g.add(heel);
  return g;
}

// Hawaiihemd-Textur (Canvas)
export function hawaiiTexture(base = '#ff7f3f', petals = ['#ffe14a', '#3bb84a']) {
  const c = document.createElement('canvas'); c.width = 256; c.height = 256;
  const ctx = c.getContext('2d');
  ctx.fillStyle = base; ctx.fillRect(0, 0, 256, 256);
  for (let i = 0; i < 14; i++) {
    const x = (i * 97) % 256, y = (i * 61 + 30) % 256;
    ctx.fillStyle = petals[i % petals.length];
    for (let k = 0; k < 5; k++) { ctx.beginPath(); ctx.arc(x + Math.cos(k * 1.26) * 16, y + Math.sin(k * 1.26) * 16, 11, 0, 7); ctx.fill(); }
    ctx.fillStyle = '#ffffff'; ctx.beginPath(); ctx.arc(x, y, 7, 0, 7); ctx.fill();
  }
  const tex = new THREE.CanvasTexture(c); tex.colorSpace = THREE.SRGBColorSpace;
  return tex;
}

/**
 * Schluffi (Spielerfigur). Füße auf y=0, Blick nach +z.
 * Aufbau: root → body (Pivot an der Hüfte, schief/zurückgelehnt) → Rumpf, Arme (Pivot Schulter), Kopf.
 *         root → legs[] (Pivot an der Hüfte) → Bein + Shorts + Sandale.
 */
export function schluffi() {
  const root = new THREE.Group();
  const skin = 0xf0b98a;
  const stance = 0.6;
  const hipY = 1.0;
  const legs = [];
  for (const s of [-1, 1]) {
    const hipX = s * 0.3;
    const leg = new THREE.Group();
    leg.position.set(hipX, hipY, 0);
    const footX = s * stance - hipX;
    leg.add(limb(V(footX * 0.9, 0.25 - hipY, -0.05), V(0, 0, 0), 0.12, skin, { outline: 0.04 }));
    const shorts = toonMesh(new THREE.CylinderGeometry(0.21, 0.24, 0.45, 12), 0x2fa9b9, { outline: 0.04 });
    shorts.position.set(0, -0.15, 0);
    shorts.rotation.z = -s * 0.1;
    leg.add(shorts);
    const shoe = sandal(skin, s < 0 ? 'L' : 'R');
    shoe.position.set(footX, -hipY, 0);
    shoe.rotation.y = s * 0.75;
    leg.add(shoe);
    root.add(leg);
    legs.push(leg);
  }

  // Oberkörper-Pivot an der Hüfte: schief und zurückgelehnt
  const body = new THREE.Group();
  body.position.set(0, hipY - 0.1, 0);
  body.rotation.set(-0.14, 0, 0.09);
  root.add(body);
  const inner = new THREE.Group();
  inner.position.set(0, -(hipY - 0.1), 0);
  body.add(inner);

  const tg = new THREE.SphereGeometry(0.5, 16, 12);
  tg.scale(1.0, 1.0, 0.85);
  const torso = toonMesh(tg, toon(0xffffff, { map: hawaiiTexture() }), { outline: 0.05 });
  torso.position.set(0, hipY + 0.42, 0.05);
  torso.rotation.x = 0.12;
  inner.add(torso);
  const belly = toonMesh(new THREE.SphereGeometry(0.34, 14, 10), skin, { outline: 0.035 });
  belly.position.set(0.02, hipY + 0.22, 0.38);
  inner.add(belly);
  const navel = toonMesh(new THREE.SphereGeometry(0.035, 6, 5), BLACK, { outline: 0, basic: true });
  navel.position.set(0, -0.05, 0.3);
  belly.add(navel);
  for (let i = 0; i < 3; i++) {
    const btn = toonMesh(new THREE.SphereGeometry(0.035, 6, 5), 0xfff5e0, { outline: 0.012 });
    btn.position.set(-0.3 + i * 0.07, hipY + 0.62 - i * 0.14, 0.44 - i * 0.03);
    inner.add(btn);
  }

  // Arme: Pivot an der Schulter
  const shoulderY = hipY + 0.66;
  const sleeveColor = 0xff7f3f;
  const arms = [];
  {
    const arm = new THREE.Group();
    arm.position.set(-0.48, shoulderY, 0.05);
    arm.add(limb(V(0, 0, 0), V(-0.24, -0.75, 0.1), 0.1, skin, { outline: 0.04 }));
    const sl = toonMesh(new THREE.CylinderGeometry(0.15, 0.16, 0.3, 10), sleeveColor, { outline: 0.035 });
    sl.position.set(-0.04, -0.1, 0.02); sl.rotation.z = 0.35; arm.add(sl);
    const hand = toonMesh(new THREE.SphereGeometry(0.2, 12, 9), skin, { outline: 0.04 });
    hand.position.set(-0.3, -0.92, 0.13); arm.add(hand);
    inner.add(arm); arms.push(arm);
  }
  {
    const arm = new THREE.Group();
    arm.position.set(0.48, shoulderY, 0.05);
    arm.add(limb(V(0, 0, 0), V(0.27, -0.45, 0.4), 0.1, skin, { outline: 0.04 }));
    const sr = toonMesh(new THREE.CylinderGeometry(0.15, 0.16, 0.3, 10), sleeveColor, { outline: 0.035 });
    sr.position.set(0.04, -0.1, 0.05); sr.rotation.z = -0.45; arm.add(sr);
    const hand = toonMesh(new THREE.SphereGeometry(0.2, 12, 9), skin, { outline: 0.04 });
    hand.position.set(0.32, -0.6, 0.5); arm.add(hand);
    const nut = toonMesh(new THREE.SphereGeometry(0.28, 12, 9), 0x6b4423, { outline: 0.04 });
    nut.position.set(0.32, -0.3, 0.55); arm.add(nut);
    arm.add(limb(V(0.36, -0.1, 0.55), V(0.5, 0.35, 0.5), 0.03, 0xff5fa2, { outline: 0.015 }));
    const umb = toonMesh(new THREE.ConeGeometry(0.2, 0.1, 8), 0x3bb84a, { outline: 0.02 });
    umb.position.set(0.5, 0.38, 0.5); umb.rotation.z = -0.4; arm.add(umb);
    inner.add(arm); arms.push(arm);
  }

  // Hals + Kopf
  const neckY = shoulderY + 0.15;
  inner.add(limb(V(0, neckY - 0.2, 0), V(0, neckY + 0.3, 0), 0.14, skin, { outline: 0.035 }));
  const head = new THREE.Group();
  head.position.set(0, neckY + 0.75, 0.12);
  head.rotation.set(0.1, 0.05, 0.2);
  inner.add(head);
  const slobShape = (geo) => { geo.scale(1, 1.12, 1); deform(geo, (v) => { if (v.y < -0.2) { v.x *= 1.0 + 0.3 * (-v.y - 0.2); } }); };
  const hg = new THREE.SphereGeometry(0.55, 28, 20);
  slobShape(hg);
  head.add(toonMesh(hg, skin, { outline: 0.05 }));
  head.add(faceDecal(schluffiFace('#f0b98a'), 0.557, slobShape));
  const nose = toonMesh(new THREE.SphereGeometry(0.15, 10, 8), 0xe89a6a, { outline: 0.03 });
  nose.position.set(0, -0.08, 0.57); head.add(nose);
  for (const s of [-1, 1]) {
    const ear = toonMesh(new THREE.SphereGeometry(0.11, 8, 6), skin, { outline: 0.03 });
    ear.position.set(s * 0.56, 0.0, 0); head.add(ear);
  }
  for (let i = 0; i < 7; i++) {
    const a = i * 0.9;
    const h = toonMesh(new THREE.SphereGeometry(0.16 + (i % 3) * 0.03, 10, 7), 0x4a2a12, { outline: 0.035 });
    h.geometry.scale(1.2, 0.8, 1);
    h.position.set(Math.cos(a) * 0.3, 0.52 + (i % 2) * 0.08, Math.sin(a) * 0.25);
    h.rotation.z = a;
    head.add(h);
  }
  const band = toonMesh(new THREE.TorusGeometry(0.43, 0.065, 8, 24), 0xe8463a, { outline: 0.03 });
  band.position.set(0, 0.44, 0); band.rotation.set(Math.PI / 2 + 0.1, 0, 0.05); head.add(band);
  for (const s of [-1, 1]) {
    const tail = toonMesh(new THREE.BoxGeometry(0.08, 0.3, 0.05), 0xe8463a, { outline: 0.025 });
    tail.position.set(s * 0.1, 0.28, -0.44); tail.rotation.z = s * 0.4; head.add(tail);
  }
  for (const s of [-1, 1]) {
    const lens = toonMesh(new THREE.TorusGeometry(0.11, 0.03, 6, 12), BLACK, { outline: 0, basic: true });
    lens.position.set(s * 0.14, 0.6, 0.3); lens.rotation.x = -0.9; head.add(lens);
  }

  root.userData.parts = { body, legs, arms, head, baseBodyRot: body.rotation.clone(), baseHeadRot: head.rotation.clone() };
  return root;
}

/** Turnschuh-Typ (NPC): steht kerzengerade, Kopf drehbar (userData.parts.head). */
export function runner() {
  const root = new THREE.Group();
  const skin = 0xe8a773;
  const stance = 0.48;
  const hipY = 1.15;
  for (const s of [-1, 1]) {
    const shoe = sneaker(0xe8463a, s < 0 ? 'L' : 'R');
    shoe.position.set(s * stance, 0, 0);
    shoe.rotation.y = s * 0.28;
    root.add(shoe);
    const fx = s * stance;
    root.add(limb(V(fx, 0.3, -0.1), V(fx, 0.9, -0.08), 0.12, skin, { outline: 0.035 }));
    const sock = toonMesh(new THREE.CylinderGeometry(0.14, 0.14, 0.22, 12), 0xffffff, { outline: 0.03 });
    sock.position.set(fx, 0.62, -0.09);
    root.add(sock);
    root.add(limb(V(fx, 0.82, -0.08), V(s * 0.3, hipY, 0), 0.17, 0xd9c08a, { outline: 0.04 }));
    const cuff = toonMesh(new THREE.CylinderGeometry(0.19, 0.19, 0.1, 12), 0xc4aa74, { outline: 0.03 });
    cuff.position.set(fx, 0.86, -0.08);
    root.add(cuff);
  }
  const tg = new RoundedBoxGeometry(0.95, 0.95, 0.55, 3, 0.2);
  deform(tg, (v) => { if (v.y > 0) v.x *= 1.25; else v.x *= 0.9; });
  const torso = toonMesh(tg, 0xf4f4f8, { outline: 0.05 });
  torso.position.set(0, hipY + 0.5, 0);
  root.add(torso);
  const collar = toonMesh(new THREE.CylinderGeometry(0.26, 0.3, 0.14, 12), 0xdfe3ee, { outline: 0.03 });
  collar.position.set(0, hipY + 0.98, 0);
  root.add(collar);
  for (let i = 0; i < 2; i++) {
    const btn = toonMesh(new THREE.SphereGeometry(0.03, 6, 5), BLACK, { outline: 0, basic: true });
    btn.position.set(0, hipY + 0.86 - i * 0.12, 0.29);
    root.add(btn);
  }
  const belt = toonMesh(new THREE.CylinderGeometry(0.44, 0.44, 0.1, 14), 0x333333, { outline: 0.03 });
  belt.position.set(0, hipY + 0.05, 0);
  root.add(belt);
  const buckle = toonMesh(new THREE.BoxGeometry(0.14, 0.1, 0.05), 0xffd54a, { outline: 0.02 });
  buckle.position.set(0, hipY + 0.05, 0.43);
  root.add(buckle);

  const shoulderY = hipY + 0.9;
  const sleeve = 0xf4f4f8;
  root.add(limb(V(-0.55, shoulderY, 0), V(-0.95, shoulderY - 0.45, 0.05), 0.11, skin, { outline: 0.04 }));
  root.add(limb(V(-0.95, shoulderY - 0.45, 0.05), V(-0.5, hipY + 0.1, 0.2), 0.1, skin, { outline: 0.04 }));
  const sl = toonMesh(new THREE.CylinderGeometry(0.17, 0.18, 0.3, 10), sleeve, { outline: 0.035 });
  sl.position.set(-0.6, shoulderY - 0.08, 0.02); sl.rotation.z = 0.6; root.add(sl);
  const hand1 = toonMesh(new THREE.SphereGeometry(0.2, 12, 9), skin, { outline: 0.04 });
  hand1.position.set(-0.5, hipY + 0.08, 0.25); root.add(hand1);
  root.add(limb(V(0.55, shoulderY, 0), V(0.85, shoulderY - 0.55, 0.1), 0.11, skin, { outline: 0.04 }));
  root.add(limb(V(0.85, shoulderY - 0.55, 0.1), V(0.45, shoulderY - 0.35, 0.55), 0.1, skin, { outline: 0.04 }));
  const sr = toonMesh(new THREE.CylinderGeometry(0.17, 0.18, 0.3, 10), sleeve, { outline: 0.035 });
  sr.position.set(0.6, shoulderY - 0.08, 0.02); sr.rotation.z = -0.5; root.add(sr);
  const hand2 = toonMesh(new THREE.SphereGeometry(0.2, 12, 9), skin, { outline: 0.04 });
  hand2.position.set(0.4, shoulderY - 0.3, 0.62); root.add(hand2);
  const phone = toonMesh(new THREE.BoxGeometry(0.2, 0.34, 0.04), 0x222233, { outline: 0.025 });
  phone.position.set(0.32, shoulderY - 0.1, 0.72); phone.rotation.set(-0.5, 0.2, 0.1); root.add(phone);
  const screen = toonMesh(new THREE.BoxGeometry(0.16, 0.28, 0.02), 0x6ee7ff, { outline: 0, basic: true });
  screen.position.z = 0.02; phone.add(screen);

  const neckY = shoulderY + 0.15;
  root.add(limb(V(0, neckY - 0.2, 0), V(0, neckY + 0.3, 0), 0.14, skin, { outline: 0.035 }));
  const head = new THREE.Group();
  head.position.set(0, neckY + 0.75, 0);
  root.add(head);
  const boxify = (v) => {
    const len = v.length();
    const n = v.clone().normalize();
    const m = Math.max(Math.abs(n.x), Math.abs(n.y), Math.abs(n.z));
    v.copy(n).lerp(n.clone().divideScalar(m), 0.42).multiplyScalar(len);
    if (v.y < -0.1) v.x *= 1.06;
  };
  const runnerShape = (geo) => { deform(geo, boxify); geo.scale(1.0, 1.12, 0.95); };
  const hg = new THREE.SphereGeometry(0.5, 28, 20);
  runnerShape(hg);
  head.add(toonMesh(hg, skin, { outline: 0.05 }));
  head.add(faceDecal(runnerFace('#e8a773'), 0.507, runnerShape));
  const nose = toonMesh(new THREE.BoxGeometry(0.12, 0.26, 0.14), 0xd9966a, { outline: 0.03 });
  nose.position.set(0, -0.1, 0.5); nose.rotation.x = 0.2; head.add(nose);
  for (const s of [-1, 1]) {
    const ear = toonMesh(new THREE.SphereGeometry(0.1, 8, 6), skin, { outline: 0.03 });
    ear.position.set(s * 0.52, -0.02, 0); head.add(ear);
  }
  const capTop = toonMesh(new THREE.SphereGeometry(0.56, 16, 10, 0, Math.PI * 2, 0, Math.PI * 0.5), 0x2a3f8f, { outline: 0.045 });
  capTop.position.set(0, 0.2, 0); capTop.rotation.x = -0.12; head.add(capTop);
  const brimGeo = new THREE.BoxGeometry(0.6, 0.07, 0.55);
  deform(brimGeo, (v) => { if (v.z > 0) v.x *= 1 - 0.5 * (v.z / 0.275); });
  const brim = toonMesh(brimGeo, 0x2a3f8f, { outline: 0.035 });
  brim.position.set(0, 0.36, 0.62); brim.rotation.x = -0.2; head.add(brim);
  const capBtn = toonMesh(new THREE.SphereGeometry(0.06, 6, 5), 0x2a3f8f, { outline: 0.02 });
  capBtn.position.set(0, 0.74, 0); head.add(capBtn);
  const bud = toonMesh(new THREE.SphereGeometry(0.06, 6, 5), 0xffffff, { outline: 0.02 });
  bud.position.set(0.58, -0.02, 0.06); head.add(bud);

  root.userData.parts = { head };
  return root;
}

// ---------- Tätigkeits-Posen für stehende Figuren mit userData.parts { legs, arms, head } ----------
// pose(figur, name) setzt Beine/Arme/Kopf (und Requisiten) für eine feste Tätigkeit und gibt den
// Höhenversatz der Figur zurück ({ offsetY }), z. B. fürs Sitzen auf dem Boden. Die Figur merkt sich die
// Pose in userData.pose; wer pro Frame Geh-Posen setzt, lässt Figuren mit gesetzter Pose aus.
export const POSES = ['stehen', 'sitzen', 'liegen', 'handy', 'foto', 'meer', 'winken'];

function poseProp(figur, name, build, parent, pos, rot) {
  const props = figur.userData.poseProps ?? (figur.userData.poseProps = {});
  if (!props[name]) {
    const m = build(); m.position.copy(pos); if (rot) m.rotation.copy(rot); parent.add(m); props[name] = m;
  }
  props[name].visible = true;
  return props[name];
}

export function pose(figur, name = 'stehen') {
  const P = figur.userData.parts;
  if (!P) return { offsetY: 0 };
  const legs = P.legs ?? [], arms = P.arms ?? [];
  for (const l of legs) l.rotation.set(0, 0, 0);
  for (const a of arms) a.rotation.set(0, 0, 0);
  if (P.head) P.head.rotation.set(0, 0, 0);
  figur.rotation.x = 0; figur.rotation.z = 0;
  for (const m of Object.values(figur.userData.poseProps ?? {})) m.visible = false;
  const hipY = legs[0]?.position.y ?? 1.1;
  const sc = figur.scale.y;
  const armR = arms[1], armL = arms[0];
  const hand = V(0.22, -0.92, 0.1); // hängende Hand im Arm-Pivot (kunden.js/figures.js)
  let offsetY = 0;
  switch (name) {
    case 'sitzen': // auf dem Boden, Beine nach vorn, Hände auf den Knien
      for (const l of legs) l.rotation.x = -Math.PI / 2;
      for (const a of arms) a.rotation.x = -0.55;
      if (P.head) P.head.rotation.x = 0.1;
      offsetY = -(hipY - 0.32) * sc;
      break;
    case 'liegen': // auf dem Rücken, Arme hinter dem Kopf
      figur.rotation.x = -Math.PI / 2;
      for (const a of arms) a.rotation.x = -3.0;
      if (armL) armL.rotation.z = 0.5;
      if (armR) armR.rotation.z = -0.5;
      offsetY = 0.5 * sc;
      break;
    case 'handy': // tippt, Kopf gesenkt
      if (armR) { armR.rotation.x = -1.9; armR.rotation.z = -0.4; }
      if (armL) { armL.rotation.x = -1.6; armL.rotation.z = 0.35; }
      if (P.head) P.head.rotation.x = 0.5;
      if (armR && !figur.userData.kunde?.accessoire?.includes?.('handy')) {
        poseProp(figur, 'phone', () => {
          const phone = toonMesh(new THREE.BoxGeometry(0.16, 0.3, 0.04), 0x222233, { outline: 0.02 });
          const screen = toonMesh(new THREE.BoxGeometry(0.12, 0.24, 0.02), 0x6ee7ff, { outline: 0, basic: true });
          screen.position.z = 0.02; phone.add(screen); return phone;
        }, armR, hand.clone().add(V(-0.1, 0.1, 0.22)), new THREE.Euler(-1.2, 0.2, 0));
      }
      break;
    case 'foto': // Kamera vor dem Gesicht, beide Hände dran
      for (const a of arms) a.rotation.x = -2.0;
      if (armL) armL.rotation.z = 0.55;
      if (armR) armR.rotation.z = -0.55;
      if (P.head) P.head.rotation.x = -0.05;
      if (armR) poseProp(figur, 'camera', () => {
        const cam = toonMesh(new THREE.BoxGeometry(0.34, 0.22, 0.2), 0x222233, { outline: 0.03 });
        const lens = toonMesh(new THREE.CylinderGeometry(0.08, 0.08, 0.12, 10), 0x555566, { outline: 0.02 });
        lens.position.set(0, 0, 0.14); lens.rotation.x = Math.PI / 2; cam.add(lens);
        const fl = toonMesh(new THREE.BoxGeometry(0.1, 0.06, 0.04), 0xffffff, { outline: 0.012 });
        fl.position.set(0.1, 0.14, 0.04); cam.add(fl); return cam;
      }, armR, hand.clone().add(V(-0.3, 0.05, 0.15)), new THREE.Euler(-1.6, 0, 0));
      break;
    case 'meer': // Hand über den Augen, andere in die Hüfte, Kinn hoch
      if (armR) { armR.rotation.x = -2.7; armR.rotation.z = -0.45; }
      if (armL) { armL.rotation.x = 0.35; armL.rotation.z = 0.85; }
      if (P.head) P.head.rotation.x = -0.18;
      break;
    case 'winken':
      if (armR) { armR.rotation.x = -2.9; armR.rotation.z = -0.35; }
      if (P.head) P.head.rotation.z = -0.1;
      break;
    default:
      break;
  }
  figur.userData.pose = name === 'stehen' ? null : name;
  figur.userData.poseOffsetY = offsetY;
  return { offsetY };
}

// ---------- Barkeeper Nong: poliert seit Jahren dasselbe Glas; die Möwe „Chef“ sitzt auf der Schulter ----------
// Barfuß, Tanktop, lange Hose, Schürze, Glatze, Schnauzer, dunkle Haut; ein Auge immer halb zu, Mund ein Strich.
// buildNong() → Gruppe (Füße auf y = 0, Blick nach +z); updateNong(g, t) = Idle-Loop (polieren, nicken, Möwe);
// setNongMood(g, 'neutral' | 'muede' | 'gruss' | …) tauscht nur das Gesicht (das halb geschlossene Auge bleibt).
const NONG_SKIN = 0x8d5a3a;
const NONG_FACE = { skin: '#8d5a3a', bart: 'schnauzer', seed: 41, lids: [0.55, 0.2] };

function bareFoot(skin, side = 'L') {
  const m = sideSign(side);
  const g = new THREE.Group();
  const footGeo = new RoundedBoxGeometry(0.42, 0.18, 0.78, 3, 0.07);
  deform(footGeo, (v) => { if (v.z < -0.22) v.y += 0.06; if (v.z > 0.1) v.x += m * 0.05 * (v.z - 0.1) / 0.29; });
  const foot = toonMesh(footGeo, skin, { outline: 0.04 }); foot.position.set(0, 0.1, -0.1); g.add(foot);
  for (const [x, r] of [[0.16, 0.1], [0.04, 0.08], [-0.06, 0.07], [-0.145, 0.065], [-0.22, 0.055]]) {
    const t = toonMesh(new THREE.SphereGeometry(r, 9, 7), skin, { outline: 0.03 });
    t.position.set(m * x, 0.05 + r * 0.5, 0.3 + (0.1 - r) * 0.8); g.add(t);
  }
  return g;
}

function nongGull() {
  const g = new THREE.Group();
  const body = toonMesh(new THREE.SphereGeometry(0.17, 10, 8), 0xffffff, { outline: 0.03 }); body.geometry.scale(1.5, 1, 1); g.add(body);
  const head = new THREE.Group(); head.position.set(0.22, 0.17, 0); g.add(head);
  head.add(toonMesh(new THREE.SphereGeometry(0.12, 8, 6), 0xffffff, { outline: 0.025 }));
  const beak = toonMesh(new THREE.ConeGeometry(0.05, 0.18, 6), 0xffb13b, { outline: 0.02 }); beak.position.set(0.16, -0.02, 0); beak.rotation.z = -Math.PI / 2; head.add(beak);
  for (const s of [-1, 1]) { const e = toonMesh(new THREE.SphereGeometry(0.025, 6, 5), BLACK, { outline: 0, basic: true }); e.position.set(0.06, 0.04, s * 0.08); head.add(e); }
  const wing = toonMesh(new THREE.BoxGeometry(0.4, 0.04, 0.22), 0xc9cfdc, { outline: 0.015 }); wing.position.set(-0.05, 0.1, 0.12); g.add(wing);
  const wing2 = toonMesh(new THREE.BoxGeometry(0.4, 0.04, 0.22), 0xc9cfdc, { outline: 0.015 }); wing2.position.set(-0.05, 0.1, -0.12); g.add(wing2);
  for (const s of [-1, 1]) g.add(limb(V(0.02, -0.12, s * 0.06), V(0.02, -0.3, s * 0.07), 0.02, 0xffb13b, { outline: 0.01 }));
  g.userData.parts = { head, wings: [wing, wing2] };
  return g;
}

export function buildNong() {
  const root = new THREE.Group();
  const skin = NONG_SKIN;
  const hipY = 1.1;
  for (const s of [-1, 1]) {
    const foot = bareFoot(skin, s < 0 ? 'L' : 'R'); foot.position.set(s * 0.3, 0, 0.05); foot.rotation.y = s * 0.2; root.add(foot);
    root.add(limb(V(s * 0.3, 0.25, 0), V(s * 0.26, hipY, 0), 0.16, 0x334455, { outline: 0.04 })); // lange Hose
  }
  const belly = toonMesh(new THREE.CylinderGeometry(0.42, 0.52, 0.95, 14), 0xffffff, { outline: 0.045 }); belly.position.set(0, hipY + 0.48, 0); root.add(belly); // Tanktop
  const shoulders = toonMesh(new THREE.SphereGeometry(0.46, 14, 10, 0, Math.PI * 2, 0, Math.PI * 0.45), skin, { outline: 0.04 }); shoulders.position.set(0, hipY + 0.72, 0); root.add(shoulders);
  const apron = toonMesh(new THREE.BoxGeometry(0.8, 1.2, 0.06), 0x2fa9b9, { outline: 0.035 }); apron.position.set(0, hipY + 0.2, 0.5); apron.rotation.x = 0.06; root.add(apron);
  const strap = toonMesh(new THREE.TorusGeometry(0.2, 0.025, 6, 12, Math.PI), 0x2fa9b9, { outline: 0.012 }); strap.position.set(0, hipY + 0.95, 0.3); strap.rotation.x = Math.PI / 2 + 0.4; root.add(strap);
  const belt = toonMesh(new THREE.CylinderGeometry(0.48, 0.48, 0.1, 14), 0x222222, { outline: 0.03 }); belt.position.set(0, hipY + 0.02, 0); root.add(belt);
  const shoulderY = hipY + 0.9;
  const arms = [];
  for (const s of [-1, 1]) {
    const arm = new THREE.Group(); arm.position.set(s * 0.52, shoulderY, 0.02);
    arm.add(limb(V(0, 0, 0), V(s * 0.1, -0.5, 0.3), 0.1, skin, { outline: 0.04 }));
    arm.add(limb(V(s * 0.1, -0.5, 0.3), V(s * -0.1, -0.55, 0.75), 0.09, skin, { outline: 0.04 }));
    const hand = toonMesh(new THREE.SphereGeometry(0.17, 12, 9), skin, { outline: 0.04 }); hand.position.set(s * -0.12, -0.56, 0.82); arm.add(hand);
    root.add(arm); arms.push(arm);
  }
  // rechts das Glas (nie benutzt), links das Tuch
  const glass = new THREE.Group();
  const gbody = toonMesh(new THREE.CylinderGeometry(0.12, 0.09, 0.32, 10), toon(0xdff4ff, { transparent: true, opacity: 0.75 }), { outline: 0.02 }); glass.add(gbody);
  const glint = toonMesh(new THREE.SphereGeometry(0.045, 6, 5), 0xffffff, { outline: 0, basic: true }); glint.position.set(0.07, 0.1, 0.07); glass.add(glint);
  glass.position.set(-0.12, -0.42, 0.9); arms[1].add(glass);
  const cloth = toonMesh(new THREE.BoxGeometry(0.26, 0.05, 0.3), 0xfff1c2, { outline: 0.02 }); cloth.position.set(0.12, -0.5, 0.95); cloth.rotation.z = 0.3; arms[0].add(cloth);
  // Hals + Kopf: Glatze mit Glanz, Schnauzer, ein Auge halb zu
  const neckY = shoulderY + 0.15;
  root.add(limb(V(0, neckY - 0.2, 0), V(0, neckY + 0.3, 0), 0.15, skin, { outline: 0.035 }));
  const head = new THREE.Group(); head.position.set(0, neckY + 0.72, 0.02); root.add(head);
  const shape = (geo) => { geo.scale(1.02, 1.08, 0.98); };
  const hg = new THREE.SphereGeometry(0.52, 28, 20); shape(hg);
  head.add(toonMesh(hg, skin, { outline: 0.05 }));
  const decal = faceDecal(face('kunde', 'neutral', NONG_FACE), 0.527, shape); head.add(decal);
  const nose = toonMesh(new THREE.SphereGeometry(0.13, 10, 8), 0x7a4a2e, { outline: 0.03 }); nose.position.set(0, -0.08, 0.52); head.add(nose);
  const mo = toonMesh(new THREE.BoxGeometry(0.36, 0.09, 0.08), 0x222222, { outline: 0.025 }); mo.position.set(0, -0.22, 0.52); head.add(mo);
  for (const s of [-1, 1]) { const ear = toonMesh(new THREE.SphereGeometry(0.1, 8, 6), skin, { outline: 0.03 }); ear.position.set(s * 0.52, -0.02, 0); head.add(ear); }
  const shine = toonMesh(new THREE.SphereGeometry(0.08, 6, 5), 0xffffff, { outline: 0 }); shine.position.set(-0.2, 0.42, 0.25); head.add(shine);
  // Möwe Chef auf der linken Schulter
  const gull = nongGull(); gull.position.set(-0.62, shoulderY + 0.28, 0.05); gull.rotation.y = 0.6; root.add(gull);
  root.userData.parts = { arms, head, decal, glass, glint, cloth, gull };
  root.userData.mood = 'neutral';
  root.userData.update = (t) => updateNong(root, t);
  return root;
}

// Idle-Loop: Tuch kreist übers Glas, Glas dreht sich langsam, alle ~7 s ein Nicken, die Möwe schaut sich um
// und schlägt alle ~9 s kurz mit den Flügeln; abends glänzt das Glas mehr.
export function updateNong(g, t) {
  const P = g.userData.parts;
  if (!P) return;
  const [armL, armR] = P.arms;
  armR.rotation.set(-0.25 + 0.03 * Math.sin(t * 1.3), 0, 0.15);
  P.glass.rotation.y = t * 0.8;
  armL.rotation.set(-0.3 + 0.12 * Math.sin(t * 6), 0.1 * Math.cos(t * 6), 0.25 + 0.08 * Math.sin(t * 6 + 1));
  P.cloth.rotation.set(0.2 * Math.sin(t * 6), 0, 0.3 + 0.3 * Math.cos(t * 6));
  const nod = (t % 7) < 0.6 ? Math.sin((t % 7) / 0.6 * Math.PI) : 0;
  P.head.rotation.set(0.2 * nod, 0.05, 0.04);
  const abend = g.userData.mood === 'muede' ? 1 : 0;
  P.glint.scale.setScalar(1 + 0.5 * abend + 0.4 * Math.max(0, Math.sin(t * 3)));
  const G = P.gull.userData.parts;
  G.head.rotation.y = 0.7 * Math.sin(t * 0.7) + 0.2 * Math.sin(t * 2.3);
  const flap = (t % 9) < 0.8 ? Math.sin((t % 9) / 0.8 * Math.PI * 4) * 0.6 : 0;
  G.wings[0].rotation.x = -flap; G.wings[1].rotation.x = flap;
  G.head.rotation.x = (t % 9) < 0.8 ? -0.3 : 0;
}

// Moods wie faces.js; zusätzlich 'gruss' = neutrales Gesicht, die Braue über dem offenen Auge geht hoch
export function setNongMood(g, mood) {
  const P = g.userData.parts;
  if (!P) return;
  const opts = mood === 'gruss' ? { ...NONG_FACE, brows: ['normal', 'hoch'] } : NONG_FACE;
  setFace(P.decal, face('kunde', mood === 'gruss' ? 'neutral' : mood, opts));
  g.userData.mood = mood;
}
