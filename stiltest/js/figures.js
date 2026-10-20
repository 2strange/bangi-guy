// figures.js — zwei Typen, überzeichnet (großer Kopf, große Hände, riesige Füße), ohne Rig.
// Die Schuhe sind der Kern: Sandalen mit nackten Zehen + Riemchen, Turnschuhe mit dicker weißer Sohle.
import * as THREE from 'three';
import { RoundedBoxGeometry } from 'three/addons/geometries/RoundedBoxGeometry.js';
import { toonMesh, toon, deform, BLACK, textTexture } from './toon.js';
import { limb } from './props.js';
import { faceDecal, schluffiFace, runnerFace } from './faces.js';

const V = (x, y, z) => new THREE.Vector3(x, y, z);

// ---------- Schuhe ----------
export function sandal(skin) {
  const g = new THREE.Group();
  const sole = toonMesh(new RoundedBoxGeometry(0.54, 0.15, 1.12, 3, 0.05), 0x6e4120, { outline: 0.045 });
  sole.position.y = 0.075;
  g.add(sole);
  const sole2 = toonMesh(new RoundedBoxGeometry(0.5, 0.06, 1.06, 3, 0.03), 0xe0a86a, { outline: 0.025 });
  sole2.position.y = 0.17;
  g.add(sole2);
  // Fuß (Fleisch)
  const footGeo = new RoundedBoxGeometry(0.42, 0.16, 0.74, 3, 0.07);
  deform(footGeo, (v) => { if (v.z < -0.22) v.y += 0.06; });
  const foot = toonMesh(footGeo, skin, { outline: 0.04 });
  foot.position.set(0, 0.27, -0.12);
  g.add(foot);
  // 5 Zehen, dicker großer Zeh innen
  const toes = [[-0.16, 0.11], [-0.04, 0.085], [0.06, 0.075], [0.145, 0.067], [0.22, 0.06]];
  for (const [x, r] of toes) {
    const t = toonMesh(new THREE.SphereGeometry(r, 9, 7), skin, { outline: 0.03 });
    t.position.set(x, 0.2 + r * 0.5, 0.3 + (0.11 - r) * 0.8);
    g.add(t);
    const nail = toonMesh(new THREE.SphereGeometry(r * 0.45, 6, 5), 0xfff0d8, { outline: 0.015 });
    nail.position.set(0, r * 0.5, r * 0.55);
    t.add(nail);
  }
  // Riemchen: Zehensteg + Spannriemen
  const strap1 = toonMesh(new THREE.TorusGeometry(0.24, 0.05, 6, 14, Math.PI), 0x3a1e0c, { outline: 0.03 });
  strap1.position.set(0, 0.2, 0.1);
  g.add(strap1);
  const strap2 = toonMesh(new THREE.TorusGeometry(0.26, 0.05, 6, 14, Math.PI), 0x3a1e0c, { outline: 0.03 });
  strap2.position.set(0, 0.22, -0.22);
  strap2.rotation.x = 0.15;
  g.add(strap2);
  return g;
}

export function sneaker(color = 0xe8463a) {
  const g = new THREE.Group();
  // dicke weiße Sohle
  const sole = toonMesh(new RoundedBoxGeometry(0.54, 0.22, 1.22, 3, 0.08), 0xffffff, { outline: 0.045 });
  sole.position.y = 0.11;
  g.add(sole);
  const soleLine = toonMesh(new RoundedBoxGeometry(0.57, 0.05, 1.25, 2, 0.02), 0xc9cfdc, { outline: 0.02 });
  soleLine.position.y = 0.07;
  g.add(soleLine);
  // Oberschuh (farbig), hinten höher
  const upperGeo = new RoundedBoxGeometry(0.48, 0.36, 1.04, 3, 0.12);
  deform(upperGeo, (v) => {
    if (v.z < -0.28) v.y += 0.1;
    if (v.z > 0.25 && v.y > 0) v.y -= 0.12 * (v.z - 0.25);
  });
  const upper = toonMesh(upperGeo, color, { outline: 0.045 });
  upper.position.set(0, 0.38, -0.06);
  g.add(upper);
  // weiße Zehenkappe
  const cap = toonMesh(new RoundedBoxGeometry(0.46, 0.2, 0.36, 3, 0.1), 0xffffff, { outline: 0.035 });
  cap.position.set(0, 0.3, 0.4);
  g.add(cap);
  // Seitenstreifen (beidseitig durchgehend)
  for (const s of [-1, 1]) for (let i = 0; i < 3; i++) {
    const stripe = toonMesh(new THREE.BoxGeometry(0.03, 0.26, 0.07), 0xffffff, { outline: 0.015 });
    stripe.position.set(s * 0.245, 0.38, -0.02 + i * 0.14);
    stripe.rotation.x = -0.5;
    g.add(stripe);
  }
  // Zunge + Schnürung
  const tongue = toonMesh(new THREE.BoxGeometry(0.24, 0.28, 0.08), 0xb83428, { outline: 0.03 });
  tongue.position.set(0, 0.6, -0.28);
  tongue.rotation.x = 0.4;
  g.add(tongue);
  for (let i = 0; i < 4; i++) {
    const lace = toonMesh(new THREE.BoxGeometry(0.32, 0.055, 0.07), 0xffffff, { outline: 0.02 });
    lace.position.set(0, 0.6 - i * 0.05, -0.16 + i * 0.11);
    lace.rotation.x = 0.35;
    g.add(lace);
    for (const s of [-1, 1]) {
      const eyelet = toonMesh(new THREE.SphereGeometry(0.03, 6, 5), 0x333333, { outline: 0 });
      eyelet.position.set(s * 0.15, 0, 0);
      lace.add(eyelet);
    }
  }
  // Schleife
  const bow1 = toonMesh(new THREE.TorusGeometry(0.07, 0.025, 6, 10), 0xffffff, { outline: 0.02 });
  bow1.position.set(-0.08, 0.66, -0.3);
  bow1.rotation.set(0.6, 0, 0.3);
  const bow2 = bow1.clone();
  bow2.position.x = 0.08;
  bow2.rotation.z = -0.3;
  g.add(bow1, bow2);
  // Fersenlasche
  const heel = toonMesh(new THREE.BoxGeometry(0.2, 0.16, 0.05), 0xffffff, { outline: 0.02 });
  heel.position.set(0, 0.62, -0.54);
  g.add(heel);
  return g;
}

// ---------- Figur ----------
export function figure(kind = 'schluffi') {
  let g = new THREE.Group();
  const isSlob = kind === 'schluffi';
  const skin = isSlob ? 0xf0b98a : 0xe8a773;
  const stance = isSlob ? 0.6 : 0.48; // Fußabstand

  // Füße (nach außen gedreht, damit das Profil der Schuhe sichtbar ist)
  for (const s of [-1, 1]) {
    const shoe = isSlob ? sandal(skin) : sneaker(0xe8463a);
    shoe.position.set(s * stance, 0, 0);
    shoe.rotation.y = s * (isSlob ? 0.75 : 0.28);
    g.add(shoe);
  }

  // Beine
  const hipY = isSlob ? 1.0 : 1.15;
  const legR = 0.12;
  for (const s of [-1, 1]) {
    const x = s * (isSlob ? 0.3 : 0.28);
    if (isSlob) {
      // nackte Beine, Shorts
      g.add(limb(V(s * stance * 0.9, 0.25, -0.05), V(x, hipY, 0), legR, skin, { outline: 0.04 }));
      const shortsGeo = new THREE.CylinderGeometry(0.21, 0.24, 0.45, 12);
      const shorts = toonMesh(shortsGeo, 0x2fa9b9, { outline: 0.04 });
      shorts.position.set(x, hipY - 0.15, 0);
      shorts.rotation.z = -s * 0.1;
      g.add(shorts);
    } else {
      // Knöchel + weiße Socke, darüber beige Chinos (enden klar über dem Schuh)
      const fx = s * stance;
      g.add(limb(V(fx, 0.3, -0.1), V(fx, 0.9, -0.08), 0.12, skin, { outline: 0.035 }));
      const sock = toonMesh(new THREE.CylinderGeometry(0.14, 0.14, 0.22, 12), 0xffffff, { outline: 0.03 });
      sock.position.set(fx, 0.62, -0.09);
      g.add(sock);
      g.add(limb(V(fx, 0.82, -0.08), V(s * 0.3, hipY, 0), 0.17, 0xd9c08a, { outline: 0.04 }));
      const cuff = toonMesh(new THREE.CylinderGeometry(0.19, 0.19, 0.1, 12), 0xc4aa74, { outline: 0.03 });
      cuff.position.set(fx, 0.86, -0.08);
      g.add(cuff);
    }
  }

  // Rumpf — beim Schluffi hängt alles ab Hüfte in einer Gruppe, die zurückgelehnt und schief steht
  const root = g;
  let body = g;
  if (isSlob) {
    const pivot = new THREE.Group();
    pivot.position.set(0, hipY - 0.1, 0);
    pivot.rotation.set(-0.14, 0, 0.09);
    body = new THREE.Group();
    body.position.set(0, -(hipY - 0.1), 0);
    pivot.add(body);
    root.add(pivot);
  }
  const g0 = g;
  g = body;
  let torso;
  if (isSlob) {
    const tg = new THREE.SphereGeometry(0.5, 16, 12);
    tg.scale(1.0, 1.0, 0.85);
    // Hawaiihemd: Canvas mit Blümchen
    const c = document.createElement('canvas'); c.width = 256; c.height = 256;
    const ctx = c.getContext('2d');
    ctx.fillStyle = '#ff7f3f'; ctx.fillRect(0, 0, 256, 256);
    for (let i = 0; i < 14; i++) {
      const x = (i * 97) % 256, y = (i * 61 + 30) % 256;
      ctx.fillStyle = i % 2 ? '#ffe14a' : '#3bb84a';
      for (let k = 0; k < 5; k++) { ctx.beginPath(); ctx.arc(x + Math.cos(k * 1.26) * 16, y + Math.sin(k * 1.26) * 16, 11, 0, 7); ctx.fill(); }
      ctx.fillStyle = '#ffffff'; ctx.beginPath(); ctx.arc(x, y, 7, 0, 7); ctx.fill();
    }
    const tex = new THREE.CanvasTexture(c); tex.colorSpace = THREE.SRGBColorSpace;
    torso = toonMesh(tg, toon(0xffffff, { map: tex }), { outline: 0.05 });
    torso.position.set(0, hipY + 0.42, 0.05);
    torso.rotation.x = 0.12;
    g.add(torso);
    // Bauch guckt raus (Hemd offen)
    const belly = toonMesh(new THREE.SphereGeometry(0.34, 14, 10), skin, { outline: 0.035 });
    belly.position.set(0.02, hipY + 0.22, 0.38);
    g.add(belly);
    const navel = toonMesh(new THREE.SphereGeometry(0.035, 6, 5), BLACK, { outline: 0, basic: true });
    navel.position.set(0, -0.05, 0.3);
    belly.add(navel);
  } else {
    const tg = new RoundedBoxGeometry(0.95, 0.95, 0.55, 3, 0.2);
    deform(tg, (v) => { if (v.y > 0) v.x *= 1.25; else v.x *= 0.9; });
    torso = toonMesh(tg, 0xf4f4f8, { outline: 0.05 });
    torso.position.set(0, hipY + 0.5, 0);
    g.add(torso);
    // Polokragen + Knöpfe
    const collar = toonMesh(new THREE.CylinderGeometry(0.26, 0.3, 0.14, 12), 0xdfe3ee, { outline: 0.03 });
    collar.position.set(0, hipY + 0.98, 0);
    g.add(collar);
    for (let i = 0; i < 2; i++) {
      const btn = toonMesh(new THREE.SphereGeometry(0.03, 6, 5), BLACK, { outline: 0, basic: true });
      btn.position.set(0, hipY + 0.86 - i * 0.12, 0.29);
      g.add(btn);
    }
    // Gürtel
    const belt = toonMesh(new THREE.CylinderGeometry(0.44, 0.44, 0.1, 14), 0x333333, { outline: 0.03 });
    belt.position.set(0, hipY + 0.05, 0);
    g.add(belt);
    const buckle = toonMesh(new THREE.BoxGeometry(0.14, 0.1, 0.05), 0xffd54a, { outline: 0.02 });
    buckle.position.set(0, hipY + 0.05, 0.43);
    g.add(buckle);
  }

  // Arme + Hände (groß)
  const shoulderY = hipY + (isSlob ? 0.66 : 0.9);
  const handR = 0.2;
  const armColor = isSlob ? skin : skin;
  const sleeve = isSlob ? 0xff7f3f : 0xf4f4f8;
  if (isSlob) {
    // linker Arm hängt, rechter hält die Kokosnuss
    g.add(limb(V(-0.48, shoulderY, 0.05), V(-0.72, shoulderY - 0.75, 0.15), 0.1, armColor, { outline: 0.04 }));
    const sl = toonMesh(new THREE.CylinderGeometry(0.15, 0.16, 0.3, 10), sleeve, { outline: 0.035 });
    sl.position.set(-0.52, shoulderY - 0.1, 0.07); sl.rotation.z = 0.35; g.add(sl);
    const hand1 = toonMesh(new THREE.SphereGeometry(handR, 12, 9), skin, { outline: 0.04 });
    hand1.position.set(-0.78, shoulderY - 0.92, 0.18); g.add(hand1);
    g.add(limb(V(0.48, shoulderY, 0.05), V(0.75, shoulderY - 0.45, 0.45), 0.1, armColor, { outline: 0.04 }));
    const sr = toonMesh(new THREE.CylinderGeometry(0.15, 0.16, 0.3, 10), sleeve, { outline: 0.035 });
    sr.position.set(0.52, shoulderY - 0.1, 0.1); sr.rotation.z = -0.45; g.add(sr);
    const hand2 = toonMesh(new THREE.SphereGeometry(handR, 12, 9), skin, { outline: 0.04 });
    hand2.position.set(0.8, shoulderY - 0.6, 0.55); g.add(hand2);
    // Kokosnuss-Drink in der Hand
    const nut = toonMesh(new THREE.SphereGeometry(0.28, 12, 9), 0x6b4423, { outline: 0.04 });
    nut.position.set(0.8, shoulderY - 0.3, 0.6); g.add(nut);
    g.add(limb(V(0.84, shoulderY - 0.1, 0.6), V(0.98, shoulderY + 0.35, 0.55), 0.03, 0xff5fa2, { outline: 0.015 }));
    const umb = toonMesh(new THREE.ConeGeometry(0.2, 0.1, 8), 0x3bb84a, { outline: 0.02 });
    umb.position.set(0.98, shoulderY + 0.38, 0.55); umb.rotation.z = -0.4; g.add(umb);
  } else {
    // links: Hand in der Hüfte; rechts: Handy
    g.add(limb(V(-0.55, shoulderY, 0), V(-0.95, shoulderY - 0.45, 0.05), 0.11, skin, { outline: 0.04 }));
    g.add(limb(V(-0.95, shoulderY - 0.45, 0.05), V(-0.5, hipY + 0.1, 0.2), 0.1, skin, { outline: 0.04 }));
    const sl = toonMesh(new THREE.CylinderGeometry(0.17, 0.18, 0.3, 10), sleeve, { outline: 0.035 });
    sl.position.set(-0.6, shoulderY - 0.08, 0.02); sl.rotation.z = 0.6; g.add(sl);
    const hand1 = toonMesh(new THREE.SphereGeometry(handR, 12, 9), skin, { outline: 0.04 });
    hand1.position.set(-0.5, hipY + 0.08, 0.25); g.add(hand1);
    g.add(limb(V(0.55, shoulderY, 0), V(0.85, shoulderY - 0.55, 0.1), 0.11, skin, { outline: 0.04 }));
    g.add(limb(V(0.85, shoulderY - 0.55, 0.1), V(0.45, shoulderY - 0.35, 0.55), 0.1, skin, { outline: 0.04 }));
    const sr = toonMesh(new THREE.CylinderGeometry(0.17, 0.18, 0.3, 10), sleeve, { outline: 0.035 });
    sr.position.set(0.6, shoulderY - 0.08, 0.02); sr.rotation.z = -0.5; g.add(sr);
    const hand2 = toonMesh(new THREE.SphereGeometry(handR, 12, 9), skin, { outline: 0.04 });
    hand2.position.set(0.4, shoulderY - 0.3, 0.62); g.add(hand2);
    const phone = toonMesh(new THREE.BoxGeometry(0.2, 0.34, 0.04), 0x222233, { outline: 0.025 });
    phone.position.set(0.32, shoulderY - 0.1, 0.72); phone.rotation.set(-0.5, 0.2, 0.1); g.add(phone);
    const screen = toonMesh(new THREE.BoxGeometry(0.16, 0.28, 0.02), 0x6ee7ff, { outline: 0, basic: true });
    screen.position.z = 0.02; phone.add(screen);
    // Armbanduhr
    const watch = toonMesh(new THREE.CylinderGeometry(0.13, 0.13, 0.06, 10), 0x333333, { outline: 0.02 });
    watch.position.set(0.72, shoulderY - 0.5, 0.26); watch.rotation.set(0.6, 0, 0.8); g.add(watch);
  }

  // Hals + Kopf
  const neckY = shoulderY + 0.15;
  g.add(limb(V(0, neckY - 0.2, 0), V(0, neckY + 0.3, 0), 0.14, skin, { outline: 0.035 }));
  const head = new THREE.Group();
  head.position.set(0, neckY + 0.75, isSlob ? 0.12 : 0);
  if (isSlob) head.rotation.set(0.1, 0.05, 0.2);
  g.add(head);

  if (isSlob) {
    // Kopf: Kugel, unten breiter (Backen); Gesicht = gemaltes Decal, Nase bleibt 3D
    const slobShape = (geo) => { geo.scale(1, 1.12, 1); deform(geo, (v) => { if (v.y < -0.2) { v.x *= 1.0 + 0.3 * (-v.y - 0.2); } }); };
    const hg = new THREE.SphereGeometry(0.55, 28, 20);
    slobShape(hg);
    head.add(toonMesh(hg, skin, { outline: 0.05 }));
    head.add(faceDecal(schluffiFace('#f0b98a'), 0.557, slobShape));
    // Nase (Knolle)
    const nose = toonMesh(new THREE.SphereGeometry(0.15, 10, 8), 0xe89a6a, { outline: 0.03 });
    nose.position.set(0, -0.08, 0.57); head.add(nose);
    // Ohren
    for (const s of [-1, 1]) {
      const ear = toonMesh(new THREE.SphereGeometry(0.11, 8, 6), skin, { outline: 0.03 });
      ear.position.set(s * 0.56, 0.0, 0); head.add(ear);
    }
    // wirre Haare + Sonnenbrille auf dem Kopf
    for (let i = 0; i < 7; i++) {
      const a = i * 0.9;
      const h = toonMesh(new THREE.SphereGeometry(0.16 + (i % 3) * 0.03, 10, 7), 0x4a2a12, { outline: 0.035 });
      h.geometry.scale(1.2, 0.8, 1);
      h.position.set(Math.cos(a) * 0.3, 0.52 + (i % 2) * 0.08, Math.sin(a) * 0.25);
      h.rotation.z = a;
      head.add(h);
    }
    // Stirnband mit Knoten hinten
    const band = toonMesh(new THREE.TorusGeometry(0.43, 0.065, 8, 24), 0xe8463a, { outline: 0.03 });
    band.position.set(0, 0.44, 0); band.rotation.set(Math.PI / 2 + 0.1, 0, 0.05); head.add(band);
    for (const s of [-1, 1]) {
      const tail = toonMesh(new THREE.BoxGeometry(0.08, 0.3, 0.05), 0xe8463a, { outline: 0.025 });
      tail.position.set(s * 0.1, 0.28, -0.44); tail.rotation.z = s * 0.4; head.add(tail);
    }
    // Hemd schief geknöpft
    for (let i = 0; i < 3; i++) {
      const btn = toonMesh(new THREE.SphereGeometry(0.035, 6, 5), 0xfff5e0, { outline: 0.012 });
      btn.position.set(-0.3 + i * 0.07, hipY + 0.62 - i * 0.14, 0.44 - i * 0.03); g.add(btn);
    }
    for (const s of [-1, 1]) {
      const lens = toonMesh(new THREE.TorusGeometry(0.11, 0.03, 6, 12), BLACK, { outline: 0, basic: true });
      lens.position.set(s * 0.14, 0.6, 0.3); lens.rotation.x = -0.9; head.add(lens);
    }
  } else {
    // Kopf: Kugel Richtung Würfel gezogen (kantiger Kiefer), Gesicht = gemaltes Decal
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
    // Cap (Schirm nach vorn), kurze Haare am Rand
    const capTop = toonMesh(new THREE.SphereGeometry(0.56, 16, 10, 0, Math.PI * 2, 0, Math.PI * 0.5), 0x2a3f8f, { outline: 0.045 });
    capTop.position.set(0, 0.2, 0); capTop.rotation.x = -0.12; head.add(capTop);
    const brimGeo = new THREE.BoxGeometry(0.6, 0.07, 0.55);
    deform(brimGeo, (v) => { if (v.z > 0) v.x *= 1 - 0.5 * (v.z / 0.275); });
    const brim2 = toonMesh(brimGeo, 0x2a3f8f, { outline: 0.035 });
    brim2.position.set(0, 0.36, 0.62); brim2.rotation.x = -0.2; head.add(brim2);
    const capBtn = toonMesh(new THREE.SphereGeometry(0.06, 6, 5), 0x2a3f8f, { outline: 0.02 });
    capBtn.position.set(0, 0.74, 0); head.add(capBtn);
    // Funkknopf im Ohr — „zu sauber, zu wach"
    const bud = toonMesh(new THREE.SphereGeometry(0.06, 6, 5), 0xffffff, { outline: 0.02 });
    bud.position.set(0.58, -0.02, 0.06); head.add(bud);
    g.add(limb(V(0.6, neckY + 0.72, 0.05), V(0.45, neckY + 0.2, 0.2), 0.012, 0xffffff, { outline: 0.008 }));
  }
  return g0;
}

// Namensschild unter der Figur (kleines Sandschild)
export function nameTag(text) {
  const tex = textTexture(text, { bg: '#fff1c2', fg: '#1a1a1a', font: 'bold 74px sans-serif' });
  const p = toon(0xfff1c2);
  const geo = new THREE.BoxGeometry(1.6, 0.4, 0.06);
  const tag = toonMesh(geo, [p, p, p, p, toon(0xffffff, { map: tex }), p], { outline: 0.03 });
  tag.position.y = 0.25;
  const post = limb(V(0, 0, 0), V(0, 0.25, 0), 0.04, 0x7a4b22, { outline: 0.02 });
  const g = new THREE.Group();
  g.add(post, tag);
  return g;
}
