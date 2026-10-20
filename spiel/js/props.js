// props.js — Palmen, schiefe Hütten, Strandbar, Steg, Kleinkram (DOTT-krumm, nichts steht gerade).
import * as THREE from 'three';
import { RoundedBoxGeometry } from 'three/addons/geometries/RoundedBoxGeometry.js';
import { toonMesh, toon, deform, rng, textTexture, stripeTexture, BLACK } from './toon.js';
import { faceDecal, sunFace } from './faces.js';

const UP = new THREE.Vector3(0, 1, 0);

// Zylinder von a nach b (Stämme, Pfosten, Seile, Gliedmaßen)
export function limb(a, b, r, color, opts = {}) {
  const dir = new THREE.Vector3().subVectors(b, a);
  const len = dir.length();
  const geo = new THREE.CylinderGeometry(r * (opts.taper ?? 1), r, len, opts.segments ?? 10, 1);
  const m = toonMesh(geo, color, opts);
  m.position.copy(a).addScaledVector(dir, 0.5);
  m.quaternion.setFromUnitVectors(UP, dir.normalize());
  return m;
}

// ---------- Palme ----------
export function palm({ lean = new THREE.Vector3(1.2, 0, 0.3), height = 4.4, seed = 1, scale = 1 } = {}) {
  const g = new THREE.Group();
  const rand = rng(seed);
  const top = new THREE.Vector3(lean.x, height, lean.z);
  const curve = new THREE.CatmullRomCurve3([
    new THREE.Vector3(0, 0, 0),
    new THREE.Vector3(lean.x * 0.15, height * 0.35, lean.z * 0.15),
    new THREE.Vector3(lean.x * 0.55, height * 0.7, lean.z * 0.55),
    top,
  ]);
  g.userData.curve = curve;
  // Stamm aus Ringsegmenten (Kokospalmen-Ringe entstehen durch die Radius-Sprünge)
  const n = 7;
  for (let i = 0; i < n; i++) {
    const t0 = i / n, t1 = (i + 1) / n;
    const a = curve.getPointAt(t0), b = curve.getPointAt(t1);
    const r = 0.30 * (1 - 0.45 * t1);
    const seg = limb(a, b, r * 1.12, 0xa66b38, { taper: 0.82, segments: 10 });
    g.add(seg);
  }
  // Blätter: gestreckte Kugel, gebogen/hängend
  const leafCount = 7;
  for (let i = 0; i < leafCount; i++) {
    const lg = new THREE.SphereGeometry(1, 12, 8);
    lg.scale(1.75 * scale, 0.14, 0.5 * scale);
    lg.translate(1.65 * scale, 0, 0);
    deform(lg, (v) => { const x = Math.max(0, v.x); v.y -= 0.38 * (x / (1.6 * scale)) ** 2; v.y += 0.05 * Math.abs(v.z); });
    const leaf = toonMesh(lg, i % 2 ? 0x2f9f3a : 0x3bb84a, { outline: 0.045 });
    leaf.position.copy(top);
    leaf.rotation.y = (i / leafCount) * Math.PI * 2 + rand() * 0.5;
    leaf.rotation.z = 0.25 + rand() * 0.35;
    leaf.rotation.order = 'YZX';
    g.add(leaf);
  }
  // Kokosnüsse
  for (let i = 0; i < 3; i++) {
    const c = toonMesh(new THREE.SphereGeometry(0.24, 10, 8), 0x6b4423, { outline: 0.035 });
    const a = i * 2.1 + rand();
    c.position.copy(top).add(new THREE.Vector3(Math.cos(a) * 0.3, -0.25, Math.sin(a) * 0.3));
    g.add(c);
  }
  return g;
}

// ---------- Hütte (schief, oben breiter als unten) ----------
export function hut({ w = 3, h = 2.6, d = 2.8, lean = 0.4, wall = 0xf08ac4, roofColor = 0x2fa9b9, straw = false, stilts = 0, door = 0x4a2e1a, seed = 2 } = {}) {
  const g = new THREE.Group();
  const rand = rng(seed);
  const flare = 1.14;
  const wallGeo = new THREE.BoxGeometry(w, h, d);
  deform(wallGeo, (v) => {
    if (v.y > 0) { v.x = v.x * flare + lean; v.z = v.z * 1.06 + lean * 0.25; }
  });
  wallGeo.translate(0, h / 2 + stilts, 0);
  const walls = toonMesh(wallGeo, wall, { outline: 0.06 });
  g.add(walls);

  // vordere Fläche bei Höhe t (0..1): z-Position für Tür/Fenster
  const frontZ = (t) => (d / 2) * (1 - t) + (d / 2 * 1.06 + lean * 0.25) * t;
  const frontX = (t, x) => x * (1 + (flare - 1) * t) + lean * t;

  // Tür (schief eingesetzt)
  const doorGeo = new THREE.BoxGeometry(0.85, 1.5, 0.12);
  const doorM = toonMesh(doorGeo, door, { outline: 0.04 });
  doorM.position.set(frontX(0.25, -0.55), stilts + 0.75, frontZ(0.28) + 0.02);
  doorM.rotation.z = 0.06;
  g.add(doorM);
  const knob = toonMesh(new THREE.SphereGeometry(0.07, 8, 6), 0xffd54a, { outline: 0.02 });
  knob.position.set(0.28, 0, 0.1);
  doorM.add(knob);

  // Fenster
  const win = new THREE.Group();
  const frame = toonMesh(new THREE.BoxGeometry(0.9, 0.8, 0.14), 0xfff4d6, { outline: 0.04 });
  const pane = toonMesh(new THREE.BoxGeometry(0.66, 0.56, 0.16), 0x7fd8ff, { outline: 0.02 });
  win.add(frame, pane);
  win.position.set(frontX(0.62, 0.75), stilts + h * 0.62, frontZ(0.62) + 0.04);
  win.rotation.z = -0.09;
  g.add(win);

  // Dach: Kegel, Spitze verzogen, mit Überstand
  const rr = Math.max(w, d) * (straw ? 0.95 : 0.82);
  const roofGeo = new THREE.ConeGeometry(rr, straw ? 1.7 : 1.5, straw ? 8 : 4);
  if (!straw) roofGeo.rotateY(Math.PI / 4);
  deform(roofGeo, (v) => { if (v.y > 0.5) { v.x += lean * 0.9; v.z += lean * 0.2; } });
  roofGeo.scale(1, 1, d / w);
  const roof = toonMesh(roofGeo, straw ? 0xe3b04b : roofColor, { outline: 0.06 });
  roof.position.set(lean * 0.9, stilts + h + (straw ? 0.75 : 0.65), lean * 0.2);
  roof.rotation.z = 0.05;
  g.add(roof);
  if (straw) {
    // Strohfransen als zweiter, flacherer Kegel unten
    const fringe = toonMesh(new THREE.ConeGeometry(rr * 1.08, 0.45, 8), 0xcf9a3c, { outline: 0.05 });
    fringe.geometry.scale(1, 1, d / w);
    fringe.position.set(lean * 0.4, stilts + h - 0.1, lean * 0.1);
    g.add(fringe);
  }

  // Schornsteinrohr, krumm
  if (!straw) {
    const pipe = limb(new THREE.Vector3(w * 0.3, stilts + h + 0.4, -d * 0.2), new THREE.Vector3(w * 0.3 + 0.35, stilts + h + 1.7, -d * 0.2), 0.14, 0x555566, { outline: 0.04 });
    g.add(pipe);
    const cap = toonMesh(new THREE.CylinderGeometry(0.22, 0.22, 0.12, 10), 0x333344, { outline: 0.03 });
    cap.position.set(w * 0.3 + 0.37, stilts + h + 1.76, -d * 0.2);
    cap.rotation.z = 0.15;
    g.add(cap);
  }

  // Stelzen + Leiter
  if (stilts > 0) {
    for (const [sx, sz] of [[-1, -1], [1, -1], [-1, 1], [1, 1]]) {
      const a = new THREE.Vector3(sx * w * 0.4, 0, sz * d * 0.4);
      const b = new THREE.Vector3(sx * w * 0.4 + (rand() - 0.5) * 0.3, stilts + 0.1, sz * d * 0.4 + (rand() - 0.5) * 0.3);
      g.add(limb(a, b, 0.13, 0x7a4b22, { outline: 0.04 }));
    }
    const lx = frontX(0.1, -0.55), lz0 = frontZ(0.2) + 0.9;
    const l1 = limb(new THREE.Vector3(lx - 0.3, 0, lz0), new THREE.Vector3(lx - 0.3, stilts + 0.3, lz0 - 0.8), 0.06, 0xd8a85a, { outline: 0.03 });
    const l2 = limb(new THREE.Vector3(lx + 0.3, 0, lz0), new THREE.Vector3(lx + 0.3, stilts + 0.3, lz0 - 0.8), 0.06, 0xd8a85a, { outline: 0.03 });
    g.add(l1, l2);
    for (let i = 1; i <= 3; i++) {
      const t = i / 4;
      const rung = toonMesh(new THREE.BoxGeometry(0.6, 0.07, 0.07), 0xd8a85a, { outline: 0.03 });
      rung.position.set(lx + (rand() - 0.5) * 0.1, (stilts + 0.3) * t, lz0 - 0.8 * t);
      rung.rotation.z = (rand() - 0.5) * 0.3;
      g.add(rung);
    }
  }
  return g;
}

// ---------- Strandbar ----------
export function beachBar() {
  const g = new THREE.Group();
  const rand = rng(11);
  const W = 4.2;
  // Pfosten, keiner gerade
  const posts = [[-W / 2, -1.1], [W / 2, -1.1], [-W / 2 + 0.2, 1.0], [W / 2 - 0.1, 1.0]];
  for (const [x, z] of posts) {
    g.add(limb(new THREE.Vector3(x, 0, z), new THREE.Vector3(x + (rand() - 0.5) * 0.4, 3.1, z + (rand() - 0.5) * 0.3), 0.12, 0x8b5a2b, { outline: 0.045 }));
  }
  // Theke
  const counterGeo = new THREE.BoxGeometry(W, 1.05, 0.8);
  deform(counterGeo, (v) => { if (v.y > 0) v.x *= 1.06; });
  counterGeo.translate(0, 0.525, 0);
  const counter = toonMesh(counterGeo, 0xc47a3a, { outline: 0.05 });
  counter.position.z = 0.9;
  g.add(counter);
  const topGeo = new THREE.BoxGeometry(W + 0.4, 0.14, 1.05);
  const ctop = toonMesh(topGeo, 0xf1c27a, { outline: 0.045 });
  ctop.position.set(0.05, 1.12, 0.9);
  ctop.rotation.z = 0.02;
  g.add(ctop);
  // Bretter-Linien auf der Theke
  for (let i = 0; i < 3; i++) {
    const slat = toonMesh(new THREE.BoxGeometry(W - 0.3, 0.05, 0.06), BLACK, { outline: 0, shadow: false, basic: true });
    slat.position.set(0, 0.25 + i * 0.3, 1.31);
    slat.rotation.z = (rand() - 0.5) * 0.04;
    g.add(slat);
  }
  // Strohdach, kippt nach vorn
  const roofGeo = new THREE.ConeGeometry(3.5, 1.6, 7);
  roofGeo.scale(1.1, 1, 0.9);
  deform(roofGeo, (v) => { if (v.y > 0.6) { v.x += 0.4; v.z += 0.2; } });
  const roof = toonMesh(roofGeo, 0xe3b04b, { outline: 0.06 });
  roof.position.set(0.1, 3.75, 0.1);
  roof.rotation.z = 0.07;
  roof.rotation.x = 0.08;
  g.add(roof);
  const fringe = toonMesh(new THREE.ConeGeometry(3.75, 0.5, 7), 0xcf9a3c, { outline: 0.05 });
  fringe.geometry.scale(1.1, 1, 0.9);
  fringe.position.set(0, 3.0, 0);
  fringe.rotation.x = 0.08;
  g.add(fringe);

  // Schild "BANGI BAR" hängt an zwei Seilen, schief
  const signTex = textTexture('BANGI BAR', { bg: '#fff1c2', fg: '#d62e2e', font: 'bold 92px sans-serif' });
  const plain = toon(0xfff1c2);
  const signGeo = new THREE.BoxGeometry(3.4, 0.9, 0.12);
  deform(signGeo, (v) => { if (v.x > 1) v.y *= 1.15; }); // rechts höher = schief gesägt
  const sign = toonMesh(signGeo, [plain, plain, plain, plain, toon(0xffffff, { map: signTex }), plain], { outline: 0.05 });
  sign.position.set(0.3, 5.0, 1.0);
  sign.rotation.set(-0.08, 0.05, -0.09);
  g.add(sign);
  g.add(limb(new THREE.Vector3(-1.1, 3.4, 1.0), new THREE.Vector3(-1.2, 4.7, 1.0), 0.08, 0x5a3b1a, { outline: 0.03 }));
  g.add(limb(new THREE.Vector3(1.7, 3.7, 1.0), new THREE.Vector3(1.8, 4.8, 1.0), 0.08, 0x5a3b1a, { outline: 0.03 }));
  // Möwe auf dem Schild
  const gull = toonMesh(new THREE.SphereGeometry(0.17, 10, 8), 0xffffff, { outline: 0.03 });
  gull.geometry.scale(1.5, 1, 1);
  gull.position.set(1.4, 5.65, 1.0);
  g.add(gull);
  const gullHead = toonMesh(new THREE.SphereGeometry(0.12, 8, 6), 0xffffff, { outline: 0.025 });
  gullHead.position.set(1.62, 5.82, 1.0);
  g.add(gullHead);
  const beak = toonMesh(new THREE.ConeGeometry(0.05, 0.18, 6), 0xffb13b, { outline: 0.02 });
  beak.position.set(1.78, 5.8, 1.0);
  beak.rotation.z = -Math.PI / 2;
  g.add(beak);

  // Regal mit Flaschen hinten
  const shelf = toonMesh(new THREE.BoxGeometry(W - 0.4, 0.1, 0.5), 0x8b5a2b, { outline: 0.04 });
  shelf.position.set(0, 1.9, -0.9);
  shelf.rotation.z = 0.03;
  g.add(shelf);
  const bottleColors = [0x5fbf3a, 0xf0c33c, 0x3a7bd5, 0xe8463a, 0xffffff, 0x9b59b6];
  for (let i = 0; i < 6; i++) {
    const x = -1.5 + i * 0.6;
    const hgt = 0.5 + rand() * 0.3;
    const b = toonMesh(new THREE.CylinderGeometry(0.11, 0.13, hgt, 9), bottleColors[i], { outline: 0.03 });
    b.position.set(x, 1.95 + hgt / 2, -0.9);
    b.rotation.z = (rand() - 0.5) * 0.1;
    g.add(b);
    const neck = toonMesh(new THREE.CylinderGeometry(0.04, 0.06, 0.2, 8), bottleColors[i], { outline: 0.02 });
    neck.position.set(x, 1.95 + hgt + 0.1, -0.9);
    g.add(neck);
  }
  // Rückwand halbhoch (Bambus)
  const back = toonMesh(new THREE.BoxGeometry(W, 1.6, 0.15), 0xd8a85a, { outline: 0.05 });
  back.position.set(0, 0.8, -1.1);
  g.add(back);

  // Hocker
  for (const x of [-1.1, 0.5]) {
    const seat = toonMesh(new THREE.CylinderGeometry(0.32, 0.3, 0.12, 12), 0xd62e2e, { outline: 0.04 });
    seat.position.set(x, 0.75, 1.9);
    seat.rotation.z = (rand() - 0.5) * 0.15;
    g.add(seat);
    g.add(limb(new THREE.Vector3(x, 0, 1.9), new THREE.Vector3(x + 0.05, 0.7, 1.9), 0.07, 0x555566, { outline: 0.03 }));
    const foot = toonMesh(new THREE.CylinderGeometry(0.22, 0.26, 0.08, 10), 0x555566, { outline: 0.03 });
    foot.position.set(x, 0.04, 1.9);
    g.add(foot);
  }

  // Cocktail mit Schirmchen auf der Theke
  const glass = toonMesh(new THREE.ConeGeometry(0.22, 0.4, 10), 0xffb13b, { outline: 0.03 });
  glass.geometry.rotateX(Math.PI);
  glass.position.set(1.2, 1.5, 1.0);
  g.add(glass);
  g.add(limb(new THREE.Vector3(1.2, 1.2, 1.0), new THREE.Vector3(1.2, 1.32, 1.0), 0.03, 0xdddddd, { outline: 0.015 }));
  const gbase = toonMesh(new THREE.CylinderGeometry(0.14, 0.14, 0.03, 10), 0xdddddd, { outline: 0.02 });
  gbase.position.set(1.2, 1.2, 1.0);
  g.add(gbase);
  const umb = toonMesh(new THREE.ConeGeometry(0.22, 0.12, 8), 0xff5fa2, { outline: 0.02 });
  umb.position.set(1.32, 1.78, 1.0);
  umb.rotation.z = -0.6;
  g.add(umb);
  g.add(limb(new THREE.Vector3(1.22, 1.5, 1.0), new THREE.Vector3(1.38, 1.8, 1.0), 0.015, 0xffffff, { outline: 0.01 }));

  // Tafel „HAPPY HOUR 24h", lehnt am Pfosten
  const boardTex = textTexture('HAPPY HOUR 24h', { bg: '#2b2f2b', fg: '#fff5c2', font: 'bold 64px sans-serif' });
  const bplain = toon(0x7a4b22);
  const board = toonMesh(new THREE.BoxGeometry(1.4, 0.95, 0.08), [bplain, bplain, bplain, bplain, toon(0xffffff, { map: boardTex }), bplain], { outline: 0.04 });
  board.position.set(-2.5, 0.5, 1.6);
  board.rotation.set(-0.18, 0.35, 0.05);
  g.add(board);

  // Surfbrett lehnt rechts am Pfosten
  const sbGeo = new THREE.SphereGeometry(1, 12, 10);
  sbGeo.scale(0.32, 1.25, 0.07);
  const sb = toonMesh(sbGeo, 0x3dd6e0, { outline: 0.045 });
  sb.position.set(2.6, 1.25, 1.35);
  sb.rotation.set(-0.3, 0.3, 0.2);
  g.add(sb);
  const stripe = toonMesh(new THREE.BoxGeometry(0.1, 2.1, 0.17), 0xffffff, { outline: 0.02 });
  sb.add(stripe);
  return g;
}

// ---------- Steg ----------
export function pier({ length = 8, seed = 5 } = {}) {
  const g = new THREE.Group();
  const rand = rng(seed);
  const step = 0.64;
  const n = Math.floor(length / step);
  for (let i = 0; i < n; i++) {
    if (i === 7) continue; // ein Brett fehlt
    const z = i * step;
    const plank = toonMesh(new THREE.BoxGeometry(1.9 + (rand() - 0.5) * 0.2, 0.13, 0.5), i % 3 === 1 ? 0xb87a3e : 0xc98a48, { outline: 0.04 });
    plank.position.set((rand() - 0.5) * 0.12, 0.35 + (rand() - 0.5) * 0.08, z);
    plank.rotation.set((rand() - 0.5) * 0.07, (rand() - 0.5) * 0.08, (rand() - 0.5) * 0.06);
    g.add(plank);
  }
  for (let z = 0.3; z < length; z += 1.9) {
    for (const x of [-0.8, 0.8]) {
      const a = new THREE.Vector3(x, -1.9, z);
      const b = new THREE.Vector3(x + (rand() - 0.5) * 0.3, 0.55 + rand() * 0.2, z + (rand() - 0.5) * 0.2);
      g.add(limb(a, b, 0.14, 0x7a4b22, { outline: 0.045 }));
    }
  }
  // Poller mit Seil zum Boot
  const bollard = limb(new THREE.Vector3(0.9, 0.3, length - 0.6), new THREE.Vector3(1.0, 1.0, length - 0.6), 0.12, 0x5a3b1a, { outline: 0.04 });
  g.add(bollard);
  return g;
}

// ---------- Boot ----------
export function boat() {
  const g = new THREE.Group();
  const hullGeo = new THREE.BoxGeometry(2.6, 0.7, 1.2, 4, 1, 1);
  deform(hullGeo, (v) => {
    const t = (v.x + 1.3) / 2.6; // 0 hinten, 1 vorn
    v.z *= 1 - 0.7 * Math.max(0, t - 0.55) / 0.45;
    if (v.y < 0) { v.z *= 0.6; v.x *= 0.85; }
    if (t > 0.9) v.y += 0.25;
  });
  const hull = toonMesh(hullGeo, 0xf2c14e, { outline: 0.05 });
  g.add(hull);
  const inner = toonMesh(new THREE.BoxGeometry(2.0, 0.2, 0.7), 0x8b5a2b, { outline: 0.03 });
  inner.position.set(-0.2, 0.26, 0);
  g.add(inner);
  const bench = toonMesh(new THREE.BoxGeometry(0.3, 0.08, 1.0), 0xd8a85a, { outline: 0.03 });
  bench.position.set(0.1, 0.4, 0);
  g.add(bench);
  const oar = limb(new THREE.Vector3(-0.8, 0.45, 0.4), new THREE.Vector3(0.9, 0.5, -0.5), 0.05, 0xd8a85a, { outline: 0.025 });
  g.add(oar);
  return g;
}

// ---------- Briefkasten ----------
export function mailbox() {
  const g = new THREE.Group();
  g.add(limb(new THREE.Vector3(0, 0, 0), new THREE.Vector3(0.18, 1.15, 0.05), 0.08, 0x7a4b22, { outline: 0.035 }));
  const box = toonMesh(new RoundedBoxGeometry(0.5, 0.48, 0.85, 4, 0.16), 0x3a7bd5, { outline: 0.04 });
  box.position.set(0.2, 1.4, 0.05);
  box.rotation.set(0.1, 0.2, 0.22);
  g.add(box);
  const flap = toonMesh(new THREE.BoxGeometry(0.44, 0.4, 0.06), 0x2a5aa0, { outline: 0.025 });
  flap.position.set(0, -0.02, 0.44);
  flap.rotation.x = -0.5;
  box.add(flap);
  const flag = toonMesh(new THREE.BoxGeometry(0.06, 0.4, 0.14), 0xe8463a, { outline: 0.025 });
  flag.position.set(0.28, 0.3, -0.1);
  flag.rotation.z = -0.3;
  box.add(flag);
  return g;
}

// ---------- Wegweiser ----------
export function signpost() {
  const g = new THREE.Group();
  g.add(limb(new THREE.Vector3(0, 0, 0), new THREE.Vector3(-0.25, 2.6, 0.1), 0.1, 0x7a4b22, { outline: 0.04 }));
  const items = [['BAR  →', 2.3, -0.3, 0x7a4b22], ['← STRAND', 1.8, 0.3, 0x7a4b22], ['POLIZEI 2km', 1.25, 0.05, 0x7a4b22]];
  for (const [txt, y, rot] of items) {
    const tex = textTexture(txt, { bg: '#e8c57a', fg: '#2b1b0b', font: 'bold 66px sans-serif', w: 640 });
    const p = toon(0xe8c57a);
    const geo = new THREE.BoxGeometry(2.0, 0.42, 0.08);
    deform(geo, (v) => { if (v.x > 0.85) v.y *= 0.5; });
    const board = toonMesh(geo, [p, p, p, p, toon(0xffffff, { map: tex }), p], { outline: 0.035 });
    const px = -0.25 * (y / 2.6);
    board.position.set(px, y, 0.28);
    board.rotation.y = rot;
    board.rotation.z = (y % 0.5) * 0.3 - 0.08;
    g.add(board);
  }
  return g;
}

// ---------- Hängematte zwischen zwei Punkten ----------
export function hammock(a, b) {
  const g = new THREE.Group();
  const mid = new THREE.Vector3().addVectors(a, b).multiplyScalar(0.5);
  const dir = new THREE.Vector3().subVectors(b, a);
  const len = dir.length();
  const clothLen = len * 0.55;
  const geo = new THREE.BoxGeometry(clothLen, 0.08, 1.2, 16, 1, 6);
  deform(geo, (v) => {
    const u = v.x / (clothLen / 2);
    v.y -= 0.55 * (1 - u * u);
    v.y += 0.22 * (v.z / 0.6) ** 2;
    v.z *= 1 - 0.3 * u * u;
  });
  const tex = stripeTexture(['#ff6f61', '#fff1c2', '#ff6f61', '#fff1c2', '#ff6f61', '#fff1c2', '#ff6f61'], { vertical: true });
  const cloth = toonMesh(geo, toon(0xffffff, { map: tex }), { outline: 0.045 });
  cloth.position.copy(mid);
  cloth.rotation.y = -Math.atan2(dir.z, dir.x);
  g.add(cloth);
  const right = dir.clone().normalize();
  const e1 = mid.clone().addScaledVector(right, -clothLen / 2);
  const e2 = mid.clone().addScaledVector(right, clothLen / 2);
  g.add(limb(e1, a, 0.035, 0xfff1c2, { outline: 0.02 }));
  g.add(limb(e2, b, 0.035, 0xfff1c2, { outline: 0.02 }));
  return g;
}

// ---------- Sonnenschirm + Handtuch ----------
export function parasol() {
  const g = new THREE.Group();
  g.add(limb(new THREE.Vector3(0, 0, 0), new THREE.Vector3(0.35, 2.6, 0), 0.06, 0xeeeeee, { outline: 0.03 }));
  const tex = stripeTexture(['#e8463a', '#fff5e0', '#e8463a', '#fff5e0', '#e8463a', '#fff5e0', '#e8463a', '#fff5e0'], { vertical: true });
  const cone = toonMesh(new THREE.ConeGeometry(1.6, 0.7, 8, 1, true), toon(0xffffff, { map: tex, side: THREE.DoubleSide }), { outline: 0.05 });
  cone.position.set(0.35, 2.35, 0);
  cone.rotation.z = -0.13;
  g.add(cone);
  const towelTex = stripeTexture(['#3a7bd5', '#ffffff', '#3a7bd5', '#ffffff', '#3a7bd5'], { vertical: false });
  const towel = toonMesh(new THREE.BoxGeometry(1.0, 0.06, 2.0), toon(0xffffff, { map: towelTex }), { outline: 0.035 });
  towel.position.set(1.1, 0.03, 0.6);
  towel.rotation.y = 0.3;
  g.add(towel);
  return g;
}

// ---------- Wasserball ----------
export function beachBall(r = 0.42) {
  const tex = stripeTexture(['#e8463a', '#fff5e0', '#3a7bd5', '#ffd54a', '#e8463a', '#fff5e0', '#3a7bd5', '#ffd54a'], { vertical: true });
  const b = toonMesh(new THREE.SphereGeometry(r, 16, 12), toon(0xffffff, { map: tex }), { outline: 0.04 });
  b.position.y = r;
  return b;
}

// ---------- Kokosnuss am Boden (mit Strohhalm) ----------
export function coconut(straw = false) {
  const g = new THREE.Group();
  const c = toonMesh(new THREE.SphereGeometry(0.3, 12, 9), 0x6b4423, { outline: 0.04 });
  c.geometry.scale(1, 1.1, 1);
  c.position.y = 0.3;
  g.add(c);
  for (let i = 0; i < 3; i++) {
    const dot = toonMesh(new THREE.SphereGeometry(0.05, 6, 5), 0x3a2211, { outline: 0 });
    dot.position.set(Math.cos(i * 2.1) * 0.12, 0.3, Math.sin(i * 2.1) * 0.12 + 0.28);
    g.add(dot);
  }
  if (straw) g.add(limb(new THREE.Vector3(0.05, 0.5, 0), new THREE.Vector3(0.25, 1.0, 0.1), 0.03, 0xff5fa2, { outline: 0.015 }));
  return g;
}

// ---------- Krabbe ----------
export function crab() {
  const g = new THREE.Group();
  const body = toonMesh(new THREE.SphereGeometry(0.26, 12, 8), 0xe8463a, { outline: 0.035 });
  body.geometry.scale(1.3, 0.6, 1);
  body.position.y = 0.18;
  g.add(body);
  for (const s of [-1, 1]) {
    g.add(limb(new THREE.Vector3(s * 0.2, 0.25, 0), new THREE.Vector3(s * 0.25, 0.6, 0.05), 0.03, 0xe8463a, { outline: 0.015 }));
    const eye = toonMesh(new THREE.SphereGeometry(0.08, 8, 6), 0xffffff, { outline: 0.02 });
    eye.position.set(s * 0.25, 0.62, 0.05);
    g.add(eye);
    const pupil = toonMesh(new THREE.SphereGeometry(0.035, 6, 5), BLACK, { outline: 0, basic: true });
    pupil.position.set(0, 0, 0.065);
    eye.add(pupil);
    const claw = toonMesh(new THREE.SphereGeometry(0.14, 8, 6), 0xe8463a, { outline: 0.03 });
    claw.geometry.scale(1.2, 0.8, 1.3);
    claw.position.set(s * 0.45, 0.18, 0.3);
    g.add(claw);
    g.add(limb(new THREE.Vector3(s * 0.28, 0.18, 0.1), new THREE.Vector3(s * 0.42, 0.18, 0.28), 0.04, 0xe8463a, { outline: 0.02 }));
    for (let i = 0; i < 3; i++) {
      g.add(limb(new THREE.Vector3(s * 0.25, 0.15, -0.1 + i * 0.1), new THREE.Vector3(s * 0.55, 0.0, -0.25 + i * 0.15), 0.03, 0xe8463a, { outline: 0.015 }));
    }
  }
  return g;
}

// ---------- Himmel: Wolken + Sonne (unbeleuchtet, flach) ----------
export function cloud(seed = 1) {
  const g = new THREE.Group();
  const rand = rng(seed);
  const blobs = [[0, 0, 0, 1.6], [1.5, 0.3, 0.2, 1.2], [-1.6, 0.1, -0.1, 1.1], [0.6, 0.9, 0, 1.0], [-0.6, 0.8, 0.1, 0.9]];
  for (const [x, y, z, r] of blobs) {
    const b = toonMesh(new THREE.SphereGeometry(r * (0.9 + rand() * 0.2), 14, 10), 0xffffff, { outline: 0.09, shadow: false, basic: true });
    b.position.set(x, y, z);
    g.add(b);
  }
  const baseGeo = new THREE.SphereGeometry(1, 18, 8);
  baseGeo.scale(2.5, 0.55, 0.9);
  const base = toonMesh(baseGeo, 0xffffff, { outline: 0.09, shadow: false, basic: true });
  base.position.y = -0.75;
  g.add(base);
  return g;
}

export function sun() {
  const g = new THREE.Group();
  const s = toonMesh(new THREE.SphereGeometry(2.0, 20, 14), 0xffd93b, { outline: 0.12, shadow: false, basic: true });
  g.add(s);
  for (let i = 0; i < 10; i++) {
    const a = (i / 10) * Math.PI * 2;
    const ray = toonMesh(new THREE.ConeGeometry(0.35, 1.3, 4), 0xffd93b, { outline: 0.08, shadow: false, basic: true });
    ray.position.set(Math.cos(a) * 2.9, Math.sin(a) * 2.9, 0);
    ray.rotation.z = a - Math.PI / 2;
    g.add(ray);
  }
  // Gesicht: stoned — gemaltes Decal: Schlafzimmeraugen, Äderchen, seliges Grinsen
  g.add(faceDecal(sunFace(), 2.02, null, { basic: true }));
  // Rauchkringel + zwei Pufferl, dezent links neben der Sonne
  const ring = toonMesh(new THREE.TorusGeometry(0.5, 0.14, 8, 16), 0xf4f4f4, { outline: 0.07, shadow: false, basic: true });
  ring.position.set(-3.7, 0.7, 0.5);
  ring.rotation.set(0.5, 0.3, 0);
  g.add(ring);
  for (const [x, y, z, r] of [[-1.5, -0.6, 1.9, 0.2], [-2.5, 0.0, 1.3, 0.27]]) {
    const puff = toonMesh(new THREE.SphereGeometry(r, 10, 8), 0xf4f4f4, { outline: 0.06, shadow: false, basic: true });
    puff.position.set(x, y, z);
    g.add(puff);
  }
  return g;
}

// ---------- Fußspuren (dunklerer Sand, flach): Sandale = Oval + Zehen, Turnschuh = Rechteck + Profilrillen ----------
export function footprints(kind, from, to, count = 5) {
  const g = new THREE.Group();
  const col = 0xdcb860;
  const dir = new THREE.Vector3().subVectors(to, from);
  const yaw = Math.atan2(dir.x, dir.z);
  const side = new THREE.Vector3(Math.cos(yaw), 0, -Math.sin(yaw));
  for (let i = 0; i < count; i++) {
    const t = i / (count - 1);
    const s = i % 2 ? 1 : -1;
    const p = from.clone().addScaledVector(dir, t).addScaledVector(side, s * 0.3);
    const print = new THREE.Group();
    print.position.copy(p);
    print.position.y = 0.015;
    print.rotation.y = yaw + s * 0.25;
    if (kind === 'sandal') {
      const o = toonMesh(new THREE.CircleGeometry(0.26, 14), col, { outline: 0, shadow: false, basic: true });
      o.geometry.scale(0.75, 1.4, 1);
      o.rotation.x = -Math.PI / 2;
      print.add(o);
      for (let k = 0; k < 5; k++) {
        const d = toonMesh(new THREE.CircleGeometry(0.07 - k * 0.008, 8), col, { outline: 0, shadow: false, basic: true });
        d.rotation.x = -Math.PI / 2;
        d.position.set(-0.13 + k * 0.065, 0, 0.42 - k * 0.02);
        print.add(d);
      }
    } else {
      const o = toonMesh(new THREE.PlaneGeometry(0.42, 0.9), col, { outline: 0, shadow: false, basic: true });
      o.rotation.x = -Math.PI / 2;
      print.add(o);
      for (let k = 0; k < 4; k++) {
        const bar = toonMesh(new THREE.PlaneGeometry(0.34, 0.07), 0xf7d984, { outline: 0, shadow: false, basic: true });
        bar.rotation.x = -Math.PI / 2;
        bar.position.set(0, 0.002, -0.3 + k * 0.2);
        print.add(bar);
      }
    }
    g.add(print);
  }
  return g;
}

// ---------- Hotel Palmenschatten: zwei Stockwerke, Balkone, Schild, Pool mit Rutsche ----------
export function hotel() {
  const g = new THREE.Group();
  const W = 14, D = 7, H1 = 3.6, H2 = 3.2;
  const lean = 0.5;
  const floor1 = new THREE.BoxGeometry(W, H1, D);
  deform(floor1, (v) => { if (v.y > 0) { v.x = v.x * 1.03 + lean * 0.5; } });
  floor1.translate(0, H1 / 2, 0);
  g.add(toonMesh(floor1, 0xffc4dd, { outline: 0.07 }));
  const floor2 = new THREE.BoxGeometry(W * 1.02, H2, D * 0.95);
  deform(floor2, (v) => { if (v.y > 0) { v.x = v.x * 1.06 + lean; v.z *= 1.04; } });
  floor2.translate(lean * 0.5, H1 + H2 / 2, 0);
  g.add(toonMesh(floor2, 0xfff1f6, { outline: 0.07 }));
  // Dach
  const roofGeo = new THREE.BoxGeometry(W * 1.2, 0.5, D * 1.15);
  deform(roofGeo, (v) => { if (v.x > 0) v.y += 0.6 * (v.x / (W * 0.6)); });
  const roof = toonMesh(roofGeo, 0x2fa9b9, { outline: 0.07 });
  roof.position.set(lean, H1 + H2 + 0.3, 0);
  roof.rotation.z = 0.03;
  g.add(roof);
  // Fenster + Balkone vorn (Südseite, +z)
  const frontZ1 = D / 2 + 0.04, frontZ2 = D * 0.95 / 2 + 0.1;
  for (let i = 0; i < 4; i++) {
    const x = -W * 0.36 + i * (W * 0.24);
    const win = toonMesh(new THREE.BoxGeometry(1.4, 1.3, 0.12), 0x7fd8ff, { outline: 0.04 });
    win.position.set(x, H1 * 0.55, frontZ1); win.rotation.z = (i % 2 ? 1 : -1) * 0.05; g.add(win);
    const bal = toonMesh(new THREE.BoxGeometry(2.2, 0.15, 1.1), 0xfff1f6, { outline: 0.04 });
    bal.position.set(x + lean * 0.6, H1 + 0.9, frontZ2 + 0.5); g.add(bal);
    const rail = toonMesh(new THREE.BoxGeometry(2.2, 0.7, 0.08), 0xffffff, { outline: 0.035 });
    rail.position.set(x + lean * 0.6, H1 + 1.3, frontZ2 + 1.0); g.add(rail);
    const door = toonMesh(new THREE.BoxGeometry(1.2, 2.0, 0.12), 0x7fd8ff, { outline: 0.04 });
    door.position.set(x + lean * 0.6, H1 + 1.9, frontZ2); g.add(door);
  }
  // Eingang mit Vordach
  const entry = toonMesh(new THREE.BoxGeometry(2.4, 2.6, 0.2), 0x5a3b1a, { outline: 0.05 });
  entry.position.set(W * 0.05, 1.3, frontZ1 + 0.02); g.add(entry);
  const canopy = toonMesh(new THREE.BoxGeometry(3.6, 0.2, 2.2), 0xe8463a, { outline: 0.05 });
  canopy.position.set(W * 0.05, 2.9, frontZ1 + 1.1); canopy.rotation.x = 0.08; g.add(canopy);
  // Schild auf dem Dach
  const tex = textTexture('HOTEL PALMENSCHATTEN', { bg: '#fff1c2', fg: '#d62e2e', font: 'bold 60px sans-serif', w: 1024 });
  const plain = toon(0xfff1c2);
  const sign = toonMesh(new THREE.BoxGeometry(9, 1.3, 0.15), [plain, plain, plain, plain, toon(0xffffff, { map: tex }), plain], { outline: 0.06 });
  sign.position.set(lean, H1 + H2 + 1.5, 0.5); sign.rotation.z = -0.04; g.add(sign);
  g.add(limb(new THREE.Vector3(-3.5, H1 + H2 + 0.5, 0.5), new THREE.Vector3(-3.6, H1 + H2 + 1.0, 0.5), 0.1, 0x5a3b1a, { outline: 0.03 }));
  g.add(limb(new THREE.Vector3(4.5, H1 + H2 + 0.5, 0.5), new THREE.Vector3(4.6, H1 + H2 + 1.0, 0.5), 0.1, 0x5a3b1a, { outline: 0.03 }));
  // Pool rechts vor dem Hotel (flach), Rand, Rutsche Richtung Meer
  const pool = new THREE.Group();
  pool.position.set(W * 0.5 + 4.5, 0, D / 2 + 3.5);
  const rim = toonMesh(new THREE.CylinderGeometry(4.2, 4.2, 0.35, 20), 0xeeeeee, { outline: 0.05 });
  rim.geometry.scale(1.3, 1, 1); rim.position.y = 0.17; pool.add(rim);
  const water = toonMesh(new THREE.CylinderGeometry(3.7, 3.7, 0.2, 20), 0x3dd6e0, { outline: 0 });
  water.geometry.scale(1.3, 1, 1); water.position.y = 0.3; pool.add(water);
  // Rutsche: gebogene Röhre vom Pool über den Strand
  const curve = new THREE.CatmullRomCurve3([
    new THREE.Vector3(3.5, 3.2, 0), new THREE.Vector3(5.5, 2.6, 1.5), new THREE.Vector3(7, 1.4, 4.5), new THREE.Vector3(8.5, 0.6, 8),
  ]);
  const slide = toonMesh(new THREE.TubeGeometry(curve, 24, 0.55, 8, false), 0xffd54a, { outline: 0.05 });
  pool.add(slide);
  pool.add(limb(new THREE.Vector3(3.5, 0, 0), new THREE.Vector3(3.5, 3.0, 0), 0.15, 0xeeeeee, { outline: 0.04 }));
  pool.add(limb(new THREE.Vector3(6.2, 0, 2.5), new THREE.Vector3(6.2, 2.1, 2.5), 0.15, 0xeeeeee, { outline: 0.04 }));
  // Leiter zur Rutsche
  for (let i = 0; i < 4; i++) {
    const rung = toonMesh(new THREE.BoxGeometry(0.7, 0.08, 0.08), 0xeeeeee, { outline: 0.03 });
    rung.position.set(3.5, 0.6 + i * 0.7, -0.5); pool.add(rung);
  }
  g.add(pool);
  g.userData.poolOffset = { x: pool.position.x, z: pool.position.z };
  return g;
}

// ---------- Liege mit Handtuch ----------
export function lounger(stripes = ['#3a7bd5', '#ffffff']) {
  const g = new THREE.Group();
  const frame = toonMesh(new THREE.BoxGeometry(0.9, 0.12, 2.2), 0xffffff, { outline: 0.035 });
  frame.position.y = 0.4; g.add(frame);
  const back = toonMesh(new THREE.BoxGeometry(0.9, 0.12, 0.9), 0xffffff, { outline: 0.035 });
  back.position.set(0, 0.7, -1.3); back.rotation.x = -0.9; g.add(back);
  const tex = stripeTexture([stripes[0], stripes[1], stripes[0], stripes[1], stripes[0]], { vertical: false });
  const towel = toonMesh(new THREE.BoxGeometry(0.8, 0.06, 1.9), toon(0xffffff, { map: tex }), { outline: 0.03 });
  towel.position.set(0, 0.5, 0.1); g.add(towel);
  for (const [x, z] of [[-0.4, 0.9], [0.4, 0.9], [-0.4, -0.9], [0.4, -0.9]]) {
    g.add(limb(new THREE.Vector3(x, 0, z), new THREE.Vector3(x, 0.38, z), 0.05, 0xdddddd, { outline: 0.02 }));
  }
  return g;
}

// ---------- Surfbrett-Verleih: Hütte + Brett-Ständer + schlafender Surfer ----------
export function rental() {
  const g = new THREE.Group();
  const h = hut({ w: 3.4, h: 2.4, d: 2.8, lean: -0.4, wall: 0x9fd8ff, roofColor: 0xffd54a, straw: true, seed: 12 });
  g.add(h);
  const tex = textTexture('VERLEIH', { bg: '#ffd54a', fg: '#1a1a1a', font: 'bold 90px sans-serif' });
  const plain = toon(0xffd54a);
  const sign = toonMesh(new THREE.BoxGeometry(2.6, 0.7, 0.1), [plain, plain, plain, plain, toon(0xffffff, { map: tex }), plain], { outline: 0.045 });
  sign.position.set(-0.3, 3.9, 0.6); sign.rotation.z = 0.08; g.add(sign);
  g.add(limb(new THREE.Vector3(-1.3, 3.2, 0.6), new THREE.Vector3(-1.4, 3.6, 0.6), 0.07, 0x5a3b1a, { outline: 0.03 }));
  g.add(limb(new THREE.Vector3(0.9, 3.2, 0.6), new THREE.Vector3(0.95, 3.6, 0.6), 0.07, 0x5a3b1a, { outline: 0.03 }));
  // Bretter im Ständer rechts neben der Hütte
  const colors = [0x3dd6e0, 0xff5fa2, 0xffd54a, 0x3bb84a, 0xffffff];
  for (let i = 0; i < 5; i++) {
    const bg = new THREE.SphereGeometry(1, 12, 10);
    bg.scale(0.3, 1.2, 0.07);
    const b = toonMesh(bg, colors[i], { outline: 0.045 });
    b.position.set(2.6 + i * 0.5, 1.25, 1.3 - i * 0.05);
    b.rotation.set(-0.25, 0.3, 0.15 - i * 0.05);
    g.add(b);
    const stripe = toonMesh(new THREE.BoxGeometry(0.08, 2.0, 0.17), i === 4 ? 0xe8463a : 0xffffff, { outline: 0.02 });
    b.add(stripe);
  }
  g.add(limb(new THREE.Vector3(2.3, 0, 1.6), new THREE.Vector3(2.3, 1.6, 1.6), 0.08, 0x8b5a2b, { outline: 0.03 }));
  g.add(limb(new THREE.Vector3(5.0, 0, 1.3), new THREE.Vector3(5.0, 1.6, 1.3), 0.08, 0x8b5a2b, { outline: 0.03 }));
  const rail = toonMesh(new THREE.BoxGeometry(2.9, 0.08, 0.08), 0x8b5a2b, { outline: 0.03 });
  rail.position.set(3.65, 1.55, 1.45); rail.rotation.y = 0.1; g.add(rail);
  return g;
}

// Schlafender Surfer auf seinem Brett (Surfer-Siesta)
export function sleepingSurfer() {
  const g = new THREE.Group();
  const bg = new THREE.SphereGeometry(1, 14, 10);
  bg.scale(0.45, 0.08, 1.35);
  const board = toonMesh(bg, 0xff5fa2, { outline: 0.045 });
  board.position.y = 0.08; g.add(board);
  const skin = 0xd99a6e;
  const bodyGeo = new THREE.CylinderGeometry(0.28, 0.32, 1.1, 10);
  bodyGeo.rotateX(Math.PI / 2);
  const body = toonMesh(bodyGeo, 0x3bb84a, { outline: 0.04 });
  body.position.set(0, 0.42, -0.1); g.add(body);
  const head = toonMesh(new THREE.SphereGeometry(0.42, 14, 10), skin, { outline: 0.045 });
  head.position.set(0, 0.5, -0.95); g.add(head);
  const hair = toonMesh(new THREE.SphereGeometry(0.44, 12, 8, 0, Math.PI * 2, 0, Math.PI * 0.5), 0xffe14a, { outline: 0.04 });
  hair.position.set(0, 0.55, -1.0); hair.rotation.x = -1.2; g.add(hair);
  // geschlossene Augen + offener Mund als Striche
  for (const s of [-1, 1]) {
    const eye = toonMesh(new THREE.BoxGeometry(0.16, 0.03, 0.03), BLACK, { outline: 0, basic: true });
    eye.position.set(s * 0.16, 0.9, -0.95); g.add(eye);
  }
  const mouth = toonMesh(new THREE.SphereGeometry(0.09, 8, 6), BLACK, { outline: 0, basic: true });
  mouth.position.set(0.05, 0.86, -0.75); g.add(mouth);
  for (const s of [-1, 1]) {
    g.add(limb(new THREE.Vector3(s * 0.2, 0.3, 0.4), new THREE.Vector3(s * 0.35, 0.25, 1.1), 0.09, skin, { outline: 0.035 }));
    const foot = toonMesh(new THREE.BoxGeometry(0.22, 0.12, 0.42), skin, { outline: 0.03 });
    foot.position.set(s * 0.38, 0.3, 1.3); foot.rotation.x = -0.4; g.add(foot);
    g.add(limb(new THREE.Vector3(s * 0.3, 0.45, -0.5), new THREE.Vector3(s * 0.75, 0.2, -0.9), 0.08, skin, { outline: 0.035 }));
  }
  // zzz
  const tex = textTexture('z z Z', { bg: 'rgba(0,0,0,0)', fg: '#1a1a1a', font: 'bold 100px sans-serif', w: 256, h: 128 });
  const z = new THREE.Mesh(new THREE.PlaneGeometry(1.6, 0.8), new THREE.MeshBasicMaterial({ map: tex, transparent: true }));
  z.position.set(0.9, 1.6, -1.1); z.rotation.set(-0.6, 0.3, 0.2);
  g.add(z);
  return g;
}

// ---------- Absperrung: Sägebock mit gestreiftem Brett + Schild ----------
export function barrier(text) {
  const g = new THREE.Group();
  const tex = stripeTexture(['#e8463a', '#ffffff', '#e8463a', '#ffffff', '#e8463a', '#ffffff', '#e8463a', '#ffffff'], { vertical: true });
  const board = toonMesh(new THREE.BoxGeometry(4.6, 0.5, 0.12), toon(0xffffff, { map: tex }), { outline: 0.05 });
  board.position.set(0, 1.1, 0); board.rotation.z = 0.05; g.add(board);
  for (const s of [-1, 1]) {
    g.add(limb(new THREE.Vector3(s * 1.9 - 0.4, 0, -0.5), new THREE.Vector3(s * 1.9, 1.4, 0), 0.08, 0xd8a85a, { outline: 0.035 }));
    g.add(limb(new THREE.Vector3(s * 1.9 + 0.4, 0, 0.5), new THREE.Vector3(s * 1.9, 1.4, 0), 0.08, 0xd8a85a, { outline: 0.035 }));
  }
  const stex = textTexture(text, { bg: '#fff1c2', fg: '#2b1b0b', font: 'bold 56px sans-serif', w: 768 });
  const plain = toon(0xfff1c2);
  const sign = toonMesh(new THREE.BoxGeometry(3.4, 0.7, 0.1), [plain, plain, plain, plain, toon(0xffffff, { map: stex }), plain], { outline: 0.045 });
  sign.position.set(0.3, 1.85, 0.05); sign.rotation.z = -0.07; g.add(sign);
  g.add(limb(new THREE.Vector3(-1.1, 1.3, 0), new THREE.Vector3(-1.1, 1.55, 0.03), 0.05, 0x5a3b1a, { outline: 0.02 }));
  g.add(limb(new THREE.Vector3(1.6, 1.3, 0), new THREE.Vector3(1.6, 1.5, 0.03), 0.05, 0x5a3b1a, { outline: 0.02 }));
  // ein Verkehrshütchen daneben, umgekippt
  const cone = toonMesh(new THREE.ConeGeometry(0.3, 0.8, 8), 0xff7f3f, { outline: 0.035 });
  cone.position.set(2.9, 0.3, 0.6); cone.rotation.set(0.3, 0, 1.4); g.add(cone);
  return g;
}

// ---------- Laterne für die Promenade ----------
export function lamp() {
  const g = new THREE.Group();
  g.add(limb(new THREE.Vector3(0, 0, 0), new THREE.Vector3(0.12, 3.6, 0), 0.1, 0x2b4a5a, { outline: 0.04 }));
  const head = toonMesh(new THREE.SphereGeometry(0.38, 10, 8), 0xfff1c2, { outline: 0.04 });
  head.position.set(0.12, 3.9, 0); g.add(head);
  const cap = toonMesh(new THREE.ConeGeometry(0.5, 0.35, 8), 0x2b4a5a, { outline: 0.035 });
  cap.position.set(0.12, 4.3, 0); g.add(cap);
  return g;
}

// ---------- Hecke (Nordrand): Reihe lumpiger Büsche ----------
export function hedge(x0, x1, z, { gapFrom = 1, gapTo = -1, seed = 3 } = {}) {
  const g = new THREE.Group();
  const rand = rng(seed);
  for (let x = x0; x <= x1; x += 2.4) {
    if (x > gapFrom && x < gapTo) continue;
    const bg = new THREE.SphereGeometry(1.5 + rand() * 0.4, 10, 7);
    bg.scale(1.1, 0.8 + rand() * 0.3, 1);
    const b = toonMesh(bg, rand() > 0.5 ? 0x3f9d37 : 0x4cae3c, { outline: 0.06 });
    b.position.set(x + (rand() - 0.5) * 0.8, 0.9, z + (rand() - 0.5) * 1.2);
    g.add(b);
  }
  return g;
}
