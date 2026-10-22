// props.js — Palmen, schiefe Hütten, Strandbar, Steg, Kleinkram (DOTT-krumm, nichts steht gerade).
import * as THREE from 'three';
import { RoundedBoxGeometry } from 'three/addons/geometries/RoundedBoxGeometry.js';
import { toonMesh, toon, deform, rng, textTexture, stripeTexture, BLACK } from './toon.js';
import { faceDecal, sunFace } from './faces.js';
import { BUILDING_BASE } from './logic.js';

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
  const doorH = BUILDING_BASE.hut.door; // figurengroß nach Skalierung (Test in logic.test.js)
  const doorGeo = new THREE.BoxGeometry(0.95, doorH, 0.12);
  const doorM = toonMesh(doorGeo, door, { outline: 0.04 });
  doorM.position.set(frontX(0.3, -0.55), stilts + doorH / 2, frontZ(0.35) + 0.02);
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
  const boards = [];
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
    board.userData.text = txt;
    g.add(board); boards.push(board);
  }
  g.userData.boards = boards;
  return g;
}

// Text eines Wegweiser-Bretts tauschen (Index 0 = oben; 2 = „POLIZEI 2km“). Finale: „POLIZEI 2km. Jetzt stimmt es.“
export function setWegweiserText(sp, index, text, { font = 'bold 66px sans-serif' } = {}) {
  const board = sp.userData.boards?.[index];
  if (!board) return;
  const tex = textTexture(text, { bg: '#e8c57a', fg: '#2b1b0b', font, w: 640 });
  board.material[4] = toon(0xffffff, { map: tex });
  board.material.needsUpdate = true;
  board.userData.text = text;
}

// ---------- Finale-Hütte am Verleih: Stelzenhütte auf den Felsen am Weststrand, umbaubar ----------
// Zustände: 'verkauf' (Schild „ZU VERKAUFEN“, verrammeltes Fenster), 'halb' (Möwe sitzt schon drauf, Schild
// „HALB VERKAUFT“), 'deine' (Veranda mit Hängematte, Möwe, Blumenkasten, Laterne, Hawaii-Flagge, Kräuterbeet
// hinterm Haus), 'posten8' (blaues Schild „POLIZEI · POSTEN 8“, Gitter, Fahne, Hütchen, Rucksack des Zivis).
export function finaleHuette() {
  const g = new THREE.Group();
  const base = hut({ w: 2.6, h: 2.1, d: 2.3, lean: 0.3, wall: 0x9fd8ff, roofColor: 0xd62e2e, straw: true, stilts: 1.2, seed: 27 });
  g.add(base);
  const S = {}; // Zustandsgruppen
  const grp = (name) => { const o = new THREE.Group(); o.visible = false; g.add(o); S[name] = o; return o; };
  const post = (o, x, z, h = 2.4) => { const l = limb(new THREE.Vector3(x, 0, z), new THREE.Vector3(x + 0.08, h, z), 0.08, 0x7a4b22, { outline: 0.035 }); o.add(l); return l; };
  const schild = (o, text, x, z, y, { bg = '#fff1c2', fg = '#2b1b0b', w = 2.2, h = 0.5 } = {}) => {
    const tex = textTexture(text, { bg, fg, font: 'bold 56px sans-serif', w: 1024, h: 160 });
    const plain = toon(new THREE.Color(bg).getHex());
    const b = toonMesh(new THREE.BoxGeometry(w, h, 0.06), [plain, plain, plain, plain, toon(0xffffff, { map: tex }), toon(0xffffff, { map: tex })], { outline: 0.03 });
    b.position.set(x, y, z); b.rotation.z = 0.05; o.add(b); return b;
  };
  // Fenster-Position der Stelzenhütte (wie hut(): frontX(0.62, 0.75), frontZ(0.62))
  const lean = 0.3, w = 2.6, d = 2.3, hh = 2.1, st = 1.2;
  const fx = 0.75 * (1 + 0.14 * 0.62) + lean * 0.62, fz = (d / 2) * 0.38 + (d / 2 * 1.06 + lean * 0.25) * 0.62, fy = st + hh * 0.62;
  // --- zu verkaufen ---
  { const o = grp('verkauf');
    post(o, 2.2, 1.6); schild(o, 'ZU VERKAUFEN', 2.25, 1.6, 2.2);
    g.userData.zielSchild = schild(o, '1000 MÜNZEN · BIS SONNTAG', 2.22, 1.6, 1.65, { bg: '#e8c57a', w: 2.4, h: 0.36 });
    for (const [dy, rz] of [[0.2, 0.35], [-0.15, -0.4]]) { const brett = toonMesh(new THREE.BoxGeometry(1.1, 0.16, 0.06), 0x8b5a2b, { outline: 0.025 }); brett.position.set(fx, fy + dy, fz + 0.12); brett.rotation.z = rz; o.add(brett); }
  }
  // --- halb deine: Möwe sitzt schon drauf ---
  { const o = grp('halb');
    post(o, 2.2, 1.6); schild(o, 'HALB VERKAUFT', 2.25, 1.6, 2.2); schild(o, 'REST: NONG (ODER DU)', 2.22, 1.6, 1.65, { bg: '#e8c57a', w: 2.4, h: 0.36 });
    const m = gull(); m.position.set(0.3, st + hh + 1.5, 0.1); m.rotation.y = -0.6; o.add(m);
  }
  // --- deine: Veranda mit Hängematte, Möwe, Blumen, Laterne, Flagge, Kräuterbeet hinterm Haus ---
  { const o = grp('deine');
    const pfosten = post(o, 2.2, 1.6, 1.4); const verkauft = schild(o, 'VERKAUFT', 2.25, 1.6, 1.5, { bg: '#e8463a', fg: '#ffffff', w: 1.6, h: 0.45 }); g.userData.deineSchild = [pfosten, verkauft].filter(Boolean);
    const deck = toonMesh(new THREE.BoxGeometry(2.6, 0.14, 1.6), 0xd8a85a, { outline: 0.035 }); deck.position.set(0.2, st - 0.05, d / 2 + 1.0); o.add(deck);
    for (const [x, z] of [[-1.0, d / 2 + 1.7], [1.4, d / 2 + 1.7]]) { o.add(limb(new THREE.Vector3(x, 0, z), new THREE.Vector3(x, st + 2.4, z), 0.09, 0x7a4b22, { outline: 0.035 })); }
    o.add(hammock(new THREE.Vector3(-1.0, st + 1.6, d / 2 + 1.7), new THREE.Vector3(1.4, st + 1.7, d / 2 + 1.7)));
    const m = gull(); m.position.set(0.3, st + hh + 1.5, 0.1); m.rotation.y = 0.4; o.add(m);
    const fb = new THREE.Group(); // Blumenkasten unterm Fenster
    const box = toonMesh(new THREE.BoxGeometry(0.9, 0.24, 0.3), 0x8b5a2b, { outline: 0.03 }); box.position.set(fx, fy - 0.55, fz + 0.2); fb.add(box);
    [0xe8463a, 0xffd54a, 0xff5fa2, 0xffffff].forEach((c, i) => { const f = toonMesh(new THREE.SphereGeometry(0.1, 8, 6), c, { outline: 0.02 }); f.position.set(fx - 0.33 + i * 0.22, fy - 0.35, fz + 0.2); fb.add(f); });
    o.add(fb);
    const lantern = toonMesh(new THREE.SphereGeometry(0.16, 10, 8), 0xfff1c2, { outline: 0.03 }); lantern.position.set(-1.0, st + 2.1, d / 2 + 1.7); lantern.userData.nachtlicht = { color: 0xffd27a, staerke: 1.2 }; o.add(lantern);
    o.add(limb(new THREE.Vector3(-1.2, st + hh + 1.2, -0.3), new THREE.Vector3(-1.3, st + hh + 2.8, -0.3), 0.03, 0x555566, { outline: 0.015 }));
    const flag = toonMesh(new THREE.BoxGeometry(0.9, 0.55, 0.04), toon(0xffffff, { map: stripeTexture(['#ff7f3f', '#3bb84a', '#ffe14a', '#ff7f3f'], { vertical: true }) }), { outline: 0.02 }); flag.position.set(-0.85, st + hh + 2.5, -0.3); o.add(flag);
    const bed = toonMesh(new THREE.BoxGeometry(2.2, 0.3, 1.0), 0x8b5a2b, { outline: 0.035 }); bed.position.set(0.2, 0.15, -d / 2 - 1.2); o.add(bed);
    for (let i = 0; i < 5; i++) { const leaf = toonMesh(new THREE.ConeGeometry(0.06, 0.55, 5), i % 2 ? 0x3bb84a : 0x2f9f3a, { outline: 0.02 }); leaf.position.set(-0.6 + i * 0.4, 0.55, -d / 2 - 1.2); leaf.rotation.z = (i % 2 ? 1 : -1) * 0.2; o.add(leaf); }
    const s = schild(o, 'KRÄUTER · PRIVAT', 0.2, -d / 2 - 1.75, 0.6, { bg: '#e8c57a', w: 1.4, h: 0.3 }); s.rotation.y = Math.PI;
    g.userData.beetLokal = new THREE.Vector3(0.2, 0, -d / 2 - 2.4); // hier steht der Mentor, wenn er hinter der Hütte gärtnert
  }
  // --- Posten 8 ---
  { const o = grp('posten8');
    schild(o, 'POLIZEI · POSTEN 8', fx - 0.9, fz + 0.22, st + hh - 0.35, { bg: '#2a3f8f', fg: '#ffffff', w: 2.4, h: 0.5 });
    for (let i = -1; i <= 1; i++) { const bar = toonMesh(new THREE.BoxGeometry(0.05, 0.85, 0.05), 0x333344, { outline: 0.015 }); bar.position.set(fx + i * 0.28, fy, fz + 0.12); o.add(bar); }
    o.add(limb(new THREE.Vector3(2.0, 0, -1.2), new THREE.Vector3(2.05, 5.0, -1.2), 0.07, 0xeeeeee, { outline: 0.03 }));
    const fl = toonMesh(new THREE.BoxGeometry(0.05, 0.8, 1.1, 1, 4, 6), 0x2a3f8f, { outline: 0.03 }); deform(fl.geometry, (v) => { v.x += 0.06 * Math.sin(v.z * 4); v.y -= 0.2 * Math.max(0, v.z + 0.2); }); fl.position.set(2.1, 4.5, -0.6); o.add(fl);
    const cap = toonMesh(new THREE.CylinderGeometry(0.35, 0.38, 0.22, 14), 0x2a3f8f, { outline: 0.035 }); cap.position.set(0.3, st + hh + 1.45, 0.1); cap.rotation.z = 0.15; o.add(cap);
    const brim = toonMesh(new THREE.BoxGeometry(0.36, 0.04, 0.22), 0x111111, { outline: 0.025 }); brim.position.set(0.3, st + hh + 1.36, 0.42); o.add(brim);
    const cone = toonMesh(new THREE.ConeGeometry(0.3, 0.8, 8), 0xff7f3f, { outline: 0.035 }); cone.position.set(2.4, 0.4, 1.6); o.add(cone);
    const pack = toonMesh(new RoundedBoxGeometry(0.7, 0.9, 0.4, 3, 0.12), 0x3bb84a, { outline: 0.045 }); pack.position.set(-1.6, 0.45, 1.5); pack.rotation.set(0.3, 0.4, 0); o.add(pack); // Rucksack vom Typ mit den Fragen, endlich voll
    const board = toonMesh(new THREE.BoxGeometry(2.4, 0.4, 0.1), toon(0xffffff, { map: stripeTexture(['#2a3f8f', '#ffffff', '#2a3f8f', '#ffffff', '#2a3f8f', '#ffffff'], { vertical: true }) }), { outline: 0.04 }); board.position.set(0.2, 0.9, d / 2 + 1.3); o.add(board);
    for (const x of [-0.9, 1.3]) o.add(limb(new THREE.Vector3(x, 0, d / 2 + 1.3), new THREE.Vector3(x, 1.1, d / 2 + 1.3), 0.06, 0xeeeeee, { outline: 0.025 }));
  }
  g.userData.zustaende = S;
  g.userData.zustand = null;
  setHuette(g, 'verkauf');
  return g;
}

export const HUETTE_ZUSTAENDE = ['verkauf', 'halb', 'deine', 'posten8'];

// Zielbetrag auf dem Verkaufsschild neu malen (Wochenziel ist kalibrierbar)
export function setHuetteZiel(g, betrag, { text = `${betrag} MÜNZEN · BIS SONNTAG` } = {}) {
  const b = g.userData.zielSchild;
  if (!b) return;
  const tex = textTexture(text, { bg: '#e8c57a', fg: '#2b1b0b', font: 'bold 56px sans-serif', w: 1024, h: 160 });
  const lit = toon(0xffffff, { map: tex });
  b.material[4] = lit; b.material[5] = lit; b.material.needsUpdate = true;
  g.userData.ziel = betrag;
}
export function setHuette(g, zustand, { schild = true } = {}) { // schild: false = „deine“ ohne Verkaufsschild (Erfolgs-Tableau)
  const S = g.userData.zustaende;
  if (!S) return;
  for (const [name, o] of Object.entries(S)) o.visible = name === zustand;
  for (const m of g.userData.deineSchild ?? []) m.visible = schild;
  g.userData.zustand = zustand;
}

// Möwe (sitzend) — auch auf dem Bar-Schild und der Finale-Hütte
export function gull() {
  const g = new THREE.Group();
  const body = toonMesh(new THREE.SphereGeometry(0.17, 10, 8), 0xffffff, { outline: 0.03 }); body.geometry.scale(1.5, 1, 1); g.add(body);
  const head = toonMesh(new THREE.SphereGeometry(0.12, 8, 6), 0xffffff, { outline: 0.025 }); head.position.set(0.22, 0.17, 0); g.add(head);
  const beak = toonMesh(new THREE.ConeGeometry(0.05, 0.18, 6), 0xffb13b, { outline: 0.02 }); beak.position.set(0.38, 0.15, 0); beak.rotation.z = -Math.PI / 2; g.add(beak);
  const wing = toonMesh(new THREE.BoxGeometry(0.4, 0.04, 0.2), 0xc9cfdc, { outline: 0.015 }); wing.position.set(-0.05, 0.08, 0); g.add(wing);
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
  const entryH = BUILDING_BASE.hotel.door;
  const entry = toonMesh(new THREE.BoxGeometry(2.4, entryH, 0.2), 0x5a3b1a, { outline: 0.05 });
  entry.position.set(W * 0.05, entryH / 2, frontZ1 + 0.02); g.add(entry);
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
  // Rutsche: Leiter und Plattform außen am Ostrand des Beckens (Beckenrand reicht bis x ≈ 5.5),
  // die Röhre läuft von der Plattform ins Becken und endet über dem Wasser
  const platform = toonMesh(new THREE.BoxGeometry(1.5, 0.14, 1.4), 0xeeeeee, { outline: 0.04 });
  platform.position.set(7.3, 3.0, 0); platform.rotation.z = 0.02; pool.add(platform);
  for (const [x, z] of [[6.7, -0.55], [6.7, 0.55], [7.9, -0.55], [7.9, 0.55]]) {
    pool.add(limb(new THREE.Vector3(x, 0, z), new THREE.Vector3(x + 0.03, 2.95, z), 0.12, 0xeeeeee, { outline: 0.035 }));
  }
  const rail = toonMesh(new THREE.BoxGeometry(0.08, 0.7, 1.4), 0xeeeeee, { outline: 0.03 });
  rail.position.set(8.0, 3.4, 0); pool.add(rail);
  const curve = new THREE.CatmullRomCurve3([
    new THREE.Vector3(6.6, 3.0, 0), new THREE.Vector3(5.2, 2.5, 0.4), new THREE.Vector3(3.2, 1.5, 0.9), new THREE.Vector3(1.4, 0.95, 1.1),
  ]);
  const slide = toonMesh(new THREE.TubeGeometry(curve, 24, 0.55, 8, false), 0xffd54a, { outline: 0.05 });
  pool.add(slide);
  pool.add(limb(new THREE.Vector3(5.3, 0.3, 0.4), new THREE.Vector3(5.3, 2.0, 0.4), 0.15, 0xeeeeee, { outline: 0.04 })); // Stütze auf dem Beckenrand
  // Leiter außen an der Plattform, vom Sand hoch
  const lx = 8.6;
  for (const s of [-1, 1]) pool.add(limb(new THREE.Vector3(lx, 0, s * 0.35), new THREE.Vector3(lx - 0.5, 3.1, s * 0.35), 0.07, 0xeeeeee, { outline: 0.03 }));
  for (let i = 0; i < 4; i++) {
    const rung = toonMesh(new THREE.BoxGeometry(0.08, 0.08, 0.7), 0xeeeeee, { outline: 0.03 });
    rung.position.set(lx - 0.5 * (0.6 + i * 0.7) / 3.1, 0.6 + i * 0.7, 0); pool.add(rung);
  }
  g.add(pool);
  g.userData.pool = pool;
  g.userData.poolOffset = { x: pool.position.x, z: pool.position.z };
  return g;
}

// ---------- Liege mit Handtuch ----------
// Strandliege: Fußende bei +z, Kopfende bei −z. Dort steht das Rückenteil schräg hoch (55°, Oberkante nach hinten),
// man sitzt bzw. liegt halb drauf. userData.sitz = Hüftpunkt auf der Liege (lokal) für die Sitzpose „liegestuhl“
// aus figures.js (Figur schaut nach +z, also zum Fußende).
export function lounger(stripes = ['#3a7bd5', '#ffffff']) {
  const g = new THREE.Group();
  const frame = toonMesh(new THREE.BoxGeometry(0.9, 0.12, 2.2), 0xffffff, { outline: 0.035 });
  frame.position.y = 0.4; g.add(frame);
  const tex = stripeTexture([stripes[0], stripes[1], stripes[0], stripes[1], stripes[0]], { vertical: false });
  const cloth = toon(0xffffff, { map: tex });
  const towel = toonMesh(new THREE.BoxGeometry(0.8, 0.06, 1.5), cloth, { outline: 0.03 });
  towel.position.set(0, 0.49, 0.25); g.add(towel);
  // Rückenteil: Scharnier am Sitz (z −0.5), Oberkante nach −z geneigt
  const tilt = 0.96, len = 1.0, hinge = new THREE.Vector3(0, 0.46, -0.5);
  const back = toonMesh(new THREE.BoxGeometry(0.9, 0.1, len), toon(0xffffff, { map: tex }), { outline: 0.035 });
  back.position.copy(hinge).add(new THREE.Vector3(0, Math.sin(tilt) * len / 2, -Math.cos(tilt) * len / 2));
  back.rotation.x = tilt; g.add(back);
  for (const s of [-1, 1]) { // Stützstreben hinter dem Rückenteil
    g.add(limb(new THREE.Vector3(s * 0.4, 0.4, -1.05), new THREE.Vector3(s * 0.4, 0.46 + Math.sin(tilt) * 0.7, -0.5 - Math.cos(tilt) * 0.7), 0.035, 0xdddddd, { outline: 0.015 }));
  }
  for (const [x, z] of [[-0.4, 0.9], [0.4, 0.9], [-0.4, -0.9], [0.4, -0.9]]) {
    g.add(limb(new THREE.Vector3(x, 0, z), new THREE.Vector3(x, 0.38, z), 0.05, 0xdddddd, { outline: 0.02 }));
  }
  g.userData.sitz = { x: 0, y: 0.52, z: -0.35 };
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
    const eye = toonMesh(new THREE.BoxGeometry(0.2, 0.04, 0.03), BLACK, { outline: 0, basic: true });
    eye.position.set(s * 0.16, 0.9, -0.95); eye.rotation.x = -0.3; g.add(eye);
  }
  const mouth = toonMesh(new THREE.TorusGeometry(0.09, 0.016, 5, 10, Math.PI), BLACK, { outline: 0, basic: true }); // zufriedener Schlafmund, zu
  mouth.position.set(0.03, 0.85, -0.72); mouth.rotation.set(-1.0, 0, Math.PI); g.add(mouth);
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
  g.userData.update = (t) => { z.position.y = 1.6 + 0.15 * Math.sin(t * 1.3); z.position.x = 0.9 + 0.08 * Math.sin(t * 0.9); z.material.opacity = 0.75 + 0.25 * Math.sin(t * 2.1); }; // Zzz schweben
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

// ---------- Hingucker für den Sand: Muschel, Seestern, Sandburg, Treibholz ----------
export function shell(color = 0xffd5e0, seed = 1) {
  const g = new THREE.Group();
  const rand = rng(seed);
  const geo = new THREE.SphereGeometry(0.32, 10, 6, 0, Math.PI * 2, 0, Math.PI * 0.5);
  geo.scale(1, 0.55, 0.85);
  deform(geo, (v) => { const a = Math.atan2(v.z, v.x); v.y *= 1 + 0.25 * Math.sin(a * 6); });
  const m = toonMesh(geo, color, { outline: 0.03 });
  m.rotation.y = rand() * Math.PI * 2;
  g.add(m);
  return g;
}

export function starfish(color = 0xff8c42) {
  const g = new THREE.Group();
  const core = toonMesh(new THREE.SphereGeometry(0.18, 8, 6), color, { outline: 0.03 });
  core.geometry.scale(1, 0.5, 1);
  core.position.y = 0.08;
  g.add(core);
  for (let i = 0; i < 5; i++) {
    const a = (i / 5) * Math.PI * 2;
    const arm = toonMesh(new THREE.ConeGeometry(0.11, 0.5, 6), color, { outline: 0.025 });
    arm.geometry.rotateX(Math.PI / 2);
    arm.geometry.scale(1, 0.5, 1);
    arm.position.set(Math.cos(a) * 0.3, 0.07, Math.sin(a) * 0.3);
    arm.rotation.y = -a + Math.PI / 2;
    g.add(arm);
  }
  return g;
}

export function sandcastle() {
  const g = new THREE.Group();
  const c = 0xe8c47a;
  const base = toonMesh(new THREE.CylinderGeometry(1.0, 1.2, 0.5, 10), c, { outline: 0.04 });
  base.position.y = 0.25; g.add(base);
  const towers = [[-0.5, -0.4, 0.42, 1.0], [0.55, -0.3, 0.36, 0.8], [0.1, 0.5, 0.3, 1.2], [-0.2, 0.0, 0.5, 0.6]];
  for (const [x, z, r, h] of towers) {
    const t = toonMesh(new THREE.CylinderGeometry(r * 0.9, r, h, 10), c, { outline: 0.035 });
    t.position.set(x, 0.5 + h / 2, z); t.rotation.z = (x - z) * 0.08; g.add(t);
    const roof = toonMesh(new THREE.ConeGeometry(r * 1.05, r * 1.2, 10), 0xd9a84a, { outline: 0.035 });
    roof.position.set(x, 0.5 + h + r * 0.55, z); g.add(roof);
  }
  // Fähnchen auf dem höchsten Turm
  g.add(limb(new THREE.Vector3(0.1, 1.9, 0.5), new THREE.Vector3(0.15, 2.7, 0.5), 0.02, 0x333333, { outline: 0.01 }));
  const flag = toonMesh(new THREE.BoxGeometry(0.4, 0.25, 0.03), 0xe8463a, { outline: 0.02 });
  flag.position.set(0.37, 2.58, 0.5); g.add(flag);
  // Burggraben-Andeutung: dunkler Ring
  const moat = toonMesh(new THREE.RingGeometry(1.25, 1.6, 20), 0xd9b56a, { outline: 0, shadow: false, basic: true });
  moat.rotation.x = -Math.PI / 2; moat.position.y = 0.012; g.add(moat);
  return g;
}

export function driftwood(seed = 2) {
  const g = new THREE.Group();
  const rand = rng(seed);
  const pts = [new THREE.Vector3(-1.2, 0.15, 0), new THREE.Vector3(-0.3, 0.25, 0.25), new THREE.Vector3(0.5, 0.15, -0.1), new THREE.Vector3(1.3, 0.3, 0.2)];
  const curve = new THREE.CatmullRomCurve3(pts);
  const tube = toonMesh(new THREE.TubeGeometry(curve, 10, 0.16, 7, false), 0xa08a6a, { outline: 0.035 });
  g.add(tube);
  g.add(limb(new THREE.Vector3(0.4, 0.2, -0.1), new THREE.Vector3(0.7, 0.55, -0.5), 0.07, 0xa08a6a, { outline: 0.025, taper: 0.5 }));
  g.rotation.y = rand() * Math.PI * 2;
  return g;
}
