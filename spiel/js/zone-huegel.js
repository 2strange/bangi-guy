// zone-huegel.js — Zone „Kiffer-Kuppe“: Mentor-Hügel als Plateau mit Serpentine (Heightfield aus
// zone-huegel-layout.huegelHeight), Mentor-Hütte, Garten mit krummen Beeten, Zaun, Vogelscheuche mit
// Polizeimütze (Gag 16), Hühner, Bank am Aussichtspunkt, Schild „NICHT MIT TURNSCHUHEN“, Rauchringe.
// Der Mentor (alter Schluffi) gärtnert mit Idle-Animation: buildHuegel() liefert update(t).
// Einbau: buildHuegel(gruppe, colliders) → { spots, update(t), height(x, z) }. Spielerhöhe = height(x, z).
import * as THREE from 'three';
import { RoundedBoxGeometry } from 'three/addons/geometries/RoundedBoxGeometry.js';
import { toonMesh, toon, deform, rng, BLACK } from './toon.js';
import { limb, hut } from './props.js';
import { sandal, pose } from './figures.js';
import { coconut } from './props.js';
import { BUILDING_POS, buildingScale } from './logic.js';
import { face, faceDecal } from './faces.js';
import { plate, chicken, herbPot } from './zone-dorf.js';
import { AREA, HUETTE, BEETE, ZAUN, PROPS, HUEGEL_SPOTS, H, huegelHeight, onRamp, huegelColliders } from './zone-huegel-layout.js';

const V = (x, y, z) => new THREE.Vector3(x, y, z);

// ---------- Gelände: Heightfield, Weg als Sandfarbe über Vertex-Farben ----------
function terrain() {
  const nx = 72, nz = 72;
  const geo = new THREE.PlaneGeometry(AREA.maxX - AREA.minX, AREA.maxZ - AREA.minZ, nx, nz);
  geo.rotateX(-Math.PI / 2);
  geo.translate((AREA.minX + AREA.maxX) / 2, 0, (AREA.minZ + AREA.maxZ) / 2);
  const pos = geo.attributes.position;
  const colors = new Float32Array(pos.count * 3);
  const green = new THREE.Color(0x5fc74a), dark = new THREE.Color(0x4cae3c), sand = new THREE.Color(0xd6bd92);
  for (let i = 0; i < pos.count; i++) {
    const x = pos.getX(i), z = pos.getZ(i);
    const h = huegelHeight(x, z);
    pos.setY(i, h + 0.03); // kein Rauschen: Mini-Facetten am Hang fangen sonst Schatten-Acne
    const c = onRamp(x, z) ? sand : (h > H - 0.2 ? green : dark.clone().lerp(green, h / H));
    colors[i * 3] = c.r; colors[i * 3 + 1] = c.g; colors[i * 3 + 2] = c.b;
  }
  geo.setAttribute('color', new THREE.BufferAttribute(colors, 3));
  geo.computeVertexNormals();
  const m = toonMesh(geo, toon(0xffffff, { vertexColors: true }), { outline: 0.14 });
  m.receiveShadow = true;
  m.userData.noFade = true;
  return m;
}

// ---------- Garten ----------
function bed(w, d, seed) {
  const g = new THREE.Group();
  const rand = rng(seed);
  const frame = toonMesh(new THREE.BoxGeometry(w, 0.4, d), 0x8b5a2b, { outline: 0.04 });
  deform(frame.geometry, (v) => { if (v.y > 0) { v.x *= 1.04; v.z *= 1.03; } });
  frame.position.y = 0.2; g.add(frame);
  const soil = toonMesh(new THREE.BoxGeometry(w - 0.3, 0.1, d - 0.3), 0x5a3b1a, { outline: 0 });
  soil.position.y = 0.4; g.add(soil);
  // Kräuter in Reihen: spitze Blätter, comic-harmlos
  const rows = 2, cols = Math.floor(w / 0.9);
  for (let r = 0; r < rows; r++) for (let c = 0; c < cols; c++) {
    const x = -w / 2 + 0.6 + c * (w - 1.2) / Math.max(1, cols - 1), z = -d / 4 + r * d / 2;
    const n = 5 + Math.floor(rand() * 3);
    for (let i = 0; i < n; i++) {
      const a = i * 1.3 + rand();
      const leaf = toonMesh(new THREE.ConeGeometry(0.06, 0.5 + rand() * 0.35, 5), i % 2 ? 0x3bb84a : 0x2f9f3a, { outline: 0.02 });
      leaf.position.set(x + Math.cos(a) * 0.1, 0.62 + rand() * 0.1, z + Math.sin(a) * 0.1);
      leaf.rotation.set(Math.sin(a) * 0.35, 0, -Math.cos(a) * 0.35);
      g.add(leaf);
    }
  }
  return g;
}

function fence() {
  const g = new THREE.Group();
  const rand = rng(43);
  const post = (x, z) => g.add(limb(V(x, 0, z), V(x + (rand() - 0.5) * 0.2, 1.1 + rand() * 0.2, z + (rand() - 0.5) * 0.2), 0.07, 0xd8a85a, { outline: 0.03 }));
  const rail = (x0, z0, x1, z1, y) => g.add(limb(V(x0, y, z0), V(x1, y + (rand() - 0.5) * 0.15, z1), 0.04, 0xd8a85a, { outline: 0.025 }));
  const Z = ZAUN;
  const segs = [[Z.minX, Z.minZ, Z.maxX, Z.minZ], [Z.maxX, Z.minZ, Z.maxX, Z.maxZ], [Z.maxX, Z.maxZ, Z.minX, Z.maxZ], [Z.minX, Z.maxZ, Z.minX, Z.gate.z1], [Z.minX, Z.gate.z0, Z.minX, Z.minZ]];
  for (const [x0, z0, x1, z1] of segs) {
    const len = Math.hypot(x1 - x0, z1 - z0), n = Math.max(1, Math.round(len / 1.6));
    for (let i = 0; i <= n; i++) post(x0 + (x1 - x0) * i / n, z0 + (z1 - z0) * i / n);
    rail(x0, z0, x1, z1, 0.45); rail(x0, z0, x1, z1, 0.9);
  }
  // Tor: hängt schief in einer Angel
  const gate = new THREE.Group();
  const gw = Z.gate.z1 - Z.gate.z0;
  for (const y of [0.35, 0.8]) { const b = toonMesh(new THREE.BoxGeometry(0.06, 0.08, gw - 0.2), 0xd8a85a, { outline: 0.025 }); b.position.set(0, y, gw / 2 - 0.1); gate.add(b); }
  for (let i = 0; i < 4; i++) { const p = toonMesh(new THREE.BoxGeometry(0.06, 1.0, 0.1), 0xd8a85a, { outline: 0.025 }); p.position.set(0, 0.55, 0.15 + i * (gw - 0.4) / 3); gate.add(p); }
  gate.position.set(Z.minX, 0.05, Z.gate.z0); gate.rotation.set(0, -0.9, -0.08);
  g.add(gate);
  return g;
}

// Vogelscheuche mit Polizeimütze (Gag 16: die Hühner respektieren sie, der Mentor nicht)
function scarecrow() {
  const g = new THREE.Group();
  g.add(limb(V(0, 0, 0), V(0.05, 2.2, 0), 0.07, 0x7a4b22, { outline: 0.03 }));
  g.add(limb(V(-0.9, 1.6, 0.05), V(0.95, 1.7, -0.05), 0.05, 0x7a4b22, { outline: 0.025 }));
  const shirt = toonMesh(new THREE.CylinderGeometry(0.3, 0.38, 0.9, 10), 0x2a3f8f, { outline: 0.04 }); // altes Uniformhemd
  shirt.position.set(0.02, 1.35, 0); g.add(shirt);
  for (const s of [-1, 1]) {
    const sl = toonMesh(new THREE.CylinderGeometry(0.1, 0.12, 0.7, 8), 0x2a3f8f, { outline: 0.03 });
    sl.position.set(s * 0.6, 1.65, 0); sl.rotation.z = Math.PI / 2 + s * 0.1; g.add(sl);
    const straw = toonMesh(new THREE.ConeGeometry(0.1, 0.3, 6), 0xe3b04b, { outline: 0.02 });
    straw.position.set(s * 1.0, 1.66, 0); straw.rotation.z = -s * Math.PI / 2; g.add(straw);
  }
  const head = toonMesh(new THREE.SphereGeometry(0.32, 12, 9), 0xe8c57a, { outline: 0.04 });
  head.position.set(0.05, 2.2, 0); g.add(head);
  // Sackgesicht: Kreuzaugen, Zickzackmund
  for (const s of [-1, 1]) for (const r of [0.6, -0.6]) {
    const x = toonMesh(new THREE.BoxGeometry(0.14, 0.03, 0.02), BLACK, { outline: 0, basic: true });
    x.position.set(s * 0.12, 2.26, 0.31); x.rotation.z = r; g.add(x);
  }
  for (let i = 0; i < 4; i++) {
    const m = toonMesh(new THREE.BoxGeometry(0.09, 0.03, 0.02), BLACK, { outline: 0, basic: true });
    m.position.set(-0.13 + i * 0.09, 2.08 + (i % 2) * 0.05, 0.31); m.rotation.z = i % 2 ? 0.6 : -0.6; g.add(m);
  }
  // Polizeimütze
  const cap = toonMesh(new THREE.CylinderGeometry(0.33, 0.36, 0.22, 14), 0x2a3f8f, { outline: 0.035 });
  cap.position.set(0.02, 2.5, -0.02); cap.rotation.z = 0.12; g.add(cap);
  const top = toonMesh(new THREE.CylinderGeometry(0.38, 0.33, 0.08, 14), 0x2a3f8f, { outline: 0.035 });
  top.position.set(0.02, 2.64, -0.02); top.rotation.z = 0.12; g.add(top);
  const brim = toonMesh(new THREE.BoxGeometry(0.34, 0.04, 0.2), 0x111111, { outline: 0.025 });
  brim.position.set(0.04, 2.42, 0.34); brim.rotation.z = 0.12; g.add(brim);
  const badge = toonMesh(new THREE.SphereGeometry(0.06, 8, 6), 0xffd54a, { outline: 0.015 });
  badge.position.set(0.04, 2.54, 0.32); g.add(badge);
  // ein Huhn sitzt respektvoll auf dem Arm
  const hen = chicken(0xfff5e0, 2); hen.scale.setScalar(0.8); hen.position.set(0.6, 1.72, 0); hen.rotation.y = -0.4; g.add(hen);
  return g;
}

function bench() {
  const g = new THREE.Group();
  const seat = toonMesh(new THREE.BoxGeometry(2.4, 0.12, 0.6), 0xd8a85a, { outline: 0.035 });
  seat.position.y = 0.55; seat.rotation.z = 0.02; g.add(seat);
  const back = toonMesh(new THREE.BoxGeometry(2.4, 0.5, 0.1), 0xd8a85a, { outline: 0.035 });
  back.position.set(0, 1.05, -0.28); back.rotation.x = -0.2; g.add(back);
  for (const s of [-1, 1]) {
    g.add(limb(V(s * 1.0, 0, 0.2), V(s * 1.0, 0.55, 0.2), 0.06, 0x7a4b22, { outline: 0.025 }));
    g.add(limb(V(s * 1.0, 0, -0.2), V(s * 1.0, 1.2, -0.3), 0.06, 0x7a4b22, { outline: 0.025 }));
  }
  return g;
}

function wateringCan() {
  const g = new THREE.Group();
  const body = toonMesh(new THREE.CylinderGeometry(0.2, 0.22, 0.34, 10), 0x3bb84a, { outline: 0.035 });
  g.add(body);
  g.add(limb(V(0.15, 0.0, 0), V(0.45, 0.25, 0), 0.035, 0x3bb84a, { outline: 0.015 }));
  const rose = toonMesh(new THREE.SphereGeometry(0.07, 8, 6), 0x2f9f3a, { outline: 0.015 });
  rose.position.set(0.47, 0.26, 0); g.add(rose);
  const handle = toonMesh(new THREE.TorusGeometry(0.14, 0.03, 6, 12, Math.PI), 0x3bb84a, { outline: 0.012 });
  handle.position.set(-0.05, 0.17, 0); g.add(handle);
  // Wasserstrahl (beim Gießen sichtbar)
  const jet = new THREE.Group();
  for (let i = 0; i < 5; i++) {
    const drop = toonMesh(new THREE.SphereGeometry(0.035, 6, 5), 0x7fd8ff, { outline: 0.012 });
    drop.position.set(0.5 + i * 0.1, 0.22 - i * i * 0.03, (i % 2 ? 0.04 : -0.04)); jet.add(drop);
  }
  jet.visible = false; g.add(jet); g.userData.jet = jet;
  return g;
}

function hoe() {
  const g = new THREE.Group();
  g.add(limb(V(0, 0, 0), V(0, 1.5, 0), 0.035, 0xd8a85a, { outline: 0.02 }));
  const blade = toonMesh(new THREE.BoxGeometry(0.3, 0.16, 0.04), 0x555566, { outline: 0.02 });
  blade.position.set(0, 0.02, 0.15); blade.rotation.x = 0.9; g.add(blade);
  return g;
}

// ---------- Mentor: alter Schluffi — grauer Zopf + Bart, Strohhut, verblichenes Hawaiihemd, Sandalen ----------
function fadedShirtTexture() {
  const c = document.createElement('canvas'); c.width = 256; c.height = 256;
  const ctx = c.getContext('2d');
  ctx.fillStyle = '#a9c8d8'; ctx.fillRect(0, 0, 256, 256);
  const rand = rng(23);
  for (let i = 0; i < 12; i++) {
    const x = rand() * 256, y = rand() * 256;
    ctx.fillStyle = i % 2 ? '#e8e0c8' : '#d4b8c8';
    for (let k = 0; k < 5; k++) { ctx.beginPath(); ctx.arc(x + Math.cos(k * 1.26) * 14, y + Math.sin(k * 1.26) * 14, 9, 0, 7); ctx.fill(); }
  }
  const tex = new THREE.CanvasTexture(c); tex.colorSpace = THREE.SRGBColorSpace;
  return tex;
}

export function mentor() {
  const root = new THREE.Group();
  const skin = 0xd9a06e;
  const hipY = 1.0;
  const legs = [];
  for (const s of [-1, 1]) {
    const leg = new THREE.Group();
    leg.position.set(s * 0.28, hipY, 0);
    const fx = s * 0.55 - s * 0.28;
    leg.add(limb(V(fx * 0.9, 0.25 - hipY, -0.05), V(0, 0, 0), 0.11, skin, { outline: 0.04 }));
    const shorts = toonMesh(new THREE.CylinderGeometry(0.2, 0.23, 0.45, 12), 0x8b5a2b, { outline: 0.04 });
    shorts.position.set(0, -0.15, 0); leg.add(shorts);
    const shoe = sandal(skin, s < 0 ? 'L' : 'R');
    shoe.position.set(fx, -hipY, 0); shoe.rotation.y = s * 0.6; leg.add(shoe);
    root.add(leg); legs.push(leg);
  }
  const tg = new THREE.SphereGeometry(0.5, 16, 12); tg.scale(1, 1.0, 0.85);
  const torso = toonMesh(tg, toon(0xffffff, { map: fadedShirtTexture() }), { outline: 0.05 });
  torso.position.set(0, hipY + 0.42, 0.04); root.add(torso);
  const belly = toonMesh(new THREE.SphereGeometry(0.3, 12, 9), skin, { outline: 0.035 });
  belly.position.set(0, hipY + 0.2, 0.36); root.add(belly);
  const shoulderY = hipY + 0.68;
  const arms = [];
  for (const s of [-1, 1]) {
    const arm = new THREE.Group();
    arm.position.set(s * 0.48, shoulderY, 0.04);
    arm.add(limb(V(0, 0, 0), V(s * 0.2, -0.8, 0.1), 0.1, skin, { outline: 0.04 }));
    const sl = toonMesh(new THREE.CylinderGeometry(0.15, 0.16, 0.3, 10), 0xa9c8d8, { outline: 0.035 });
    sl.position.set(s * 0.03, -0.1, 0.02); sl.rotation.z = -s * 0.3; arm.add(sl);
    const hand = toonMesh(new THREE.SphereGeometry(0.19, 12, 9), skin, { outline: 0.04 });
    hand.position.set(s * 0.24, -0.92, 0.12); arm.add(hand);
    root.add(arm); arms.push(arm);
  }
  // Werkzeug: Hacke rechts, Gießkanne links
  const h = hoe(); h.position.set(0.24, -1.0, 0.25); h.rotation.set(-0.5, 0, -0.2); arms[1].add(h);
  const can = wateringCan(); can.position.set(-0.3, -1.1, 0.15); arms[0].add(can);
  // Hals + Kopf
  const neckY = shoulderY + 0.15;
  root.add(limb(V(0, neckY - 0.2, 0), V(0, neckY + 0.3, 0), 0.14, skin, { outline: 0.035 }));
  const head = new THREE.Group();
  head.position.set(0, neckY + 0.75, 0.1); head.rotation.set(0.12, 0, 0.08); root.add(head);
  const shape = (geo) => { geo.scale(1, 1.1, 1); };
  const hg = new THREE.SphereGeometry(0.55, 28, 20); shape(hg);
  head.add(toonMesh(hg, skin, { outline: 0.05 }));
  head.add(faceDecal(face('kunde', 'selig', { skin: '#d9a06e', beard: true, haare: 'weiss', seed: 77, beardColor: '#d8d8e0' }), 0.557, shape));
  const nose = toonMesh(new THREE.SphereGeometry(0.15, 10, 8), 0xc98a5a, { outline: 0.03 });
  nose.position.set(0, -0.06, 0.56); head.add(nose);
  for (const s of [-1, 1]) {
    const ear = toonMesh(new THREE.SphereGeometry(0.11, 8, 6), skin, { outline: 0.03 });
    ear.position.set(s * 0.56, 0, 0); head.add(ear);
  }
  // graues Haar mit Zopf, Strohhut, runde Brille
  const hair = toonMesh(new THREE.SphereGeometry(0.57, 16, 10, 0, Math.PI * 2, 0, Math.PI * 0.5), 0xd8d8e0, { outline: 0.045 });
  hair.position.set(0, 0.1, -0.05); hair.rotation.x = -0.3; head.add(hair);
  const tail = toonMesh(new THREE.CylinderGeometry(0.1, 0.06, 0.8, 8), 0xd8d8e0, { outline: 0.03 });
  tail.position.set(0, -0.2, -0.6); tail.rotation.x = 0.5; head.add(tail);
  const hatTop = toonMesh(new THREE.CylinderGeometry(0.45, 0.5, 0.32, 14), 0xe3b04b, { outline: 0.04 });
  hatTop.position.set(0, 0.66, 0); hatTop.rotation.z = 0.1; head.add(hatTop);
  const brim = toonMesh(new THREE.CylinderGeometry(0.92, 0.92, 0.05, 18), 0xe3b04b, { outline: 0.04 });
  deform(brim.geometry, (v) => { v.y += 0.08 * Math.sin(Math.atan2(v.z, v.x) * 3); });
  brim.position.set(0, 0.52, 0); brim.rotation.z = 0.1; head.add(brim);
  for (const s of [-1, 1]) {
    const lens = toonMesh(new THREE.TorusGeometry(0.13, 0.025, 6, 14), 0xffd54a, { outline: 0.012 });
    lens.position.set(s * 0.2, 0.05, 0.5); head.add(lens);
  }
  root.userData.parts = { legs, arms, head, can, hoe: h };
  return root;
}

// Mentor abends an der Bangi Bar: rechter Hocker der Bar (props.beachBar: Hocker bei (0.5, 1.9) lokal,
// Sitzhöhe 0.75), Bar-Skala aus logic. Rückgabe { x, y, z, yaw } (Blick zum Tresen, -z).
export function mentorBarSpot() {
  const b = BUILDING_POS.bar, s = buildingScale('bar');
  return { x: b.x + 0.5 * s, y: 0.75 * s, z: b.z + 1.9 * s, yaw: Math.PI };
}

/**
 * Baut den Hügel in `parent` und schiebt die Collider in `colliders`.
 * Rückgabe: { spots, update(t), height(x, z), mentor, mentorAnBar(an), mentorBarSpot } — update(t) animiert Mentor und Rauch (t in Sekunden),
 * height(x, z) ist die Bodenhöhe für Spieler/Kamera (0 außerhalb der Zone).
 */
export function buildHuegel(parent, colliders) {
  const rand = rng(47);
  const add = (o) => { parent.add(o); return o; };
  add(terrain());
  // auf die Kuppe setzen: y = H
  const onTop = (o, x, z, rot = 0) => { o.position.set(x, huegelHeight(x, z), z); o.rotation.y = rot; return add(o); };

  // Mentor-Hütte (Stroh, Maßstab 2.1) mit krummem Ofenrohr und Rauchringen
  const hutObj = hut({ w: 3, h: 2.4, d: 2.6, lean: 0.35, wall: 0x8b5a2b, straw: true, seed: 8 });
  hutObj.scale.setScalar(buildingScale('mentor'));
  onTop(hutObj, HUETTE.x, HUETTE.z, HUETTE.rot);
  const pipe = limb(V(0.6, 3.1, -0.5), V(0.9, 4.6, -0.55), 0.14, 0x555566, { outline: 0.04 }); hutObj.add(pipe);
  // Rauchringe über dem Ofenrohr (Rohrspitze lokal (0.9, 4.6, -0.55), Hütte gedreht + skaliert)
  const S2 = buildingScale('mentor'), cr = Math.cos(HUETTE.rot), sr = Math.sin(HUETTE.rot);
  const pipeTop = V(HUETTE.x + (0.9 * cr - 0.55 * sr) * S2, H + 4.6 * S2, HUETTE.z + (-0.9 * sr - 0.55 * cr) * S2);
  const smoke = [];
  for (let i = 0; i < 3; i++) {
    const ring = toonMesh(new THREE.TorusGeometry(0.35, 0.1, 8, 16), 0xf4f4f4, { outline: 0.06, shadow: false, basic: true });
    ring.rotation.x = Math.PI / 2 + 0.3; ring.userData.phase = i / 3;
    ring.position.copy(pipeTop); ring.userData.noFade = true;
    smoke.push(add(ring));
  }
  // Garten
  const zaun = fence(); zaun.position.y = H; add(zaun); // Zaun in Weltkoordinaten, Kuppe ist flach
  for (const b of BEETE) onTop(bed(b.w, b.d, Math.round(Math.abs(b.x * 3 + b.z))), b.x, b.z, b.rot);
  const hp = herbPot(); hp.scale.setScalar(1.4); onTop(hp, ZAUN.maxX - 1.2, ZAUN.maxZ - 1.2);
  for (const [x, z, k, col] of [[-40.5, -54, 1, 0xfff5e0], [-33, -58.5, 3, 0xd9a84a]]) {
    const hen = chicken(col, k); hen.scale.setScalar(1.1); onTop(hen, x, z);
  }
  // Kleinkram
  let mentorObj = null;
  for (const p of PROPS) {
    if (p.kind === 'vogelscheuche') onTop(scarecrow(), p.x, p.z, 0.3);
    else if (p.kind === 'bank') onTop(bench(), p.x, p.z, p.rot);
    else if (p.kind === 'schild') {
      const s = new THREE.Group();
      s.add(limb(V(0, 0, 0), V(0.1, 2.0, 0), 0.07, 0x7a4b22, { outline: 0.03 }));
      const b = plate('NICHT MIT TURNSCHUHEN', 2.2, 0.5, { font: 'bold 60px sans-serif', tw: 1024, th: 160, thick: 0.06 });
      b.position.set(0.1, 2.1, 0); b.rotation.set(0, 0.4, 0.06); s.add(b);
      const b2 = plate('↓ STRAND 25 s', 1.6, 0.38, { bg: '#e8c57a', font: 'bold 64px sans-serif', tw: 768, th: 128, thick: 0.06 });
      b2.position.set(0.05, 1.55, 0); b2.rotation.set(0, 0.6, -0.05); s.add(b2);
      onTop(s, p.x, p.z);
    } else if (p.kind === 'mentor') {
      mentorObj = mentor(); mentorObj.scale.setScalar(0.95);
      onTop(mentorObj, p.x, p.z, p.rot);
    }
  }
  // Büsche am Hangfuß und Steine am Weg
  for (let i = 0; i < 9; i++) {
    const a = -0.3 + i * 0.42, rx = 24 + rand() * 4, rz = 21 + rand() * 3;
    const x = -44 + Math.cos(a) * rx, z = -58 + Math.sin(a) * rz;
    if (x < -66 || x > -20 || z > -27) continue;
    const r = 1.3 + rand() * 0.8;
    const bg = new THREE.SphereGeometry(r, 10, 7); bg.scale(1, 0.75, 1.1);
    const bush = toonMesh(bg, rand() > 0.5 ? 0x3f9d37 : 0x4cae3c, { outline: 0.06 });
    onTop(bush, x, z); bush.position.y += r * 0.45;
    colliders.push({ x, z, r: r * 0.8 });
  }
  for (const c of huegelColliders()) colliders.push(c);

  const P = mentorObj?.userData.parts;
  // Idle: 0–4 s hacken, 4–7.5 s gießen, 7.5–10 s Pause (Kopf kratzen, aufs Meer schauen)
  function update(t) {
    for (const r of smoke) {
      const u = ((t * 0.25) + r.userData.phase) % 1;
      r.position.y = pipeTop.y + 0.3 + u * 3.5; r.scale.setScalar(0.5 + u * 1.2);
      r.rotation.z = u * 2;
    }
    if (!P) return;
    const c = t % 10;
    const armR = P.arms[1], armL = P.arms[0];
    armR.rotation.set(0, 0, 0); armL.rotation.set(0, 0, 0); P.head.rotation.set(0.12, 0, 0.08);
    P.can.userData.jet.visible = false;
    if (c < 4) { // hacken: rechter Arm schwingt, Oberkörper nickt mit
      const s = Math.sin(c * Math.PI * 1.8);
      armR.rotation.x = -0.9 + 0.7 * s; armR.rotation.z = -0.2;
      P.head.rotation.x = 0.25 + 0.1 * s;
    } else if (c < 7.5) { // gießen: linker Arm hoch, Kanne kippt, Strahl an
      const u = Math.min(1, (c - 4) / 0.6);
      armL.rotation.x = -1.1 * u; armL.rotation.z = 0.5 * u;
      P.can.rotation.z = -0.9 * u; P.can.userData.jet.visible = u > 0.8;
      P.head.rotation.x = 0.35 * u; P.head.rotation.y = -0.3 * u;
    } else { // Pause: Kopf kratzen, dann Blick übers Meer
      const u = Math.min(1, (c - 7.5) / 0.5);
      armR.rotation.x = -2.6 * u; armR.rotation.z = -0.6 * u + 0.1 * Math.sin(c * 14);
      P.head.rotation.y = 0.5 * u; P.head.rotation.x = -0.1 * u;
    }
  }
  update(0);
  // Mentor zwischen Garten (tagsüber, mit Hacke/Gießkanne) und Bar-Hocker (abends, sitzend mit Kokosnuss) umsetzen
  const garten = { x: mentorObj.position.x, y: mentorObj.position.y, z: mentorObj.position.z, yaw: mentorObj.rotation.y };
  let nut = null;
  function mentorAnBar(an) {
    if (!P) return;
    if (an) {
      const b = mentorBarSpot();
      const { offsetY } = pose(mentorObj, 'sitzen');
      mentorObj.position.set(b.x, b.y + offsetY, b.z); mentorObj.rotation.y = b.yaw;
      P.hoe.visible = false; P.can.visible = false;
      if (!nut) { nut = coconut(true); nut.scale.setScalar(0.8); nut.position.set(0.3, -0.95, 0.25); P.arms[1].add(nut); }
      nut.visible = true;
      P.arms[1].rotation.x = -1.2; P.arms[1].rotation.z = -0.3; // hält die Nuss hoch
    } else {
      pose(mentorObj, 'stehen');
      mentorObj.position.set(garten.x, garten.y, garten.z); mentorObj.rotation.y = garten.yaw;
      P.hoe.visible = true; P.can.visible = true;
      if (nut) nut.visible = false;
    }
    mentorObj.userData.anBar = !!an;
  }
  const baseUpdate = update;
  return { spots: HUEGEL_SPOTS, update: (t) => { if (mentorObj?.userData.anBar) { for (const r of smoke) r.visible = false; return; } baseUpdate(t); }, height: huegelHeight, mentor: mentorObj, mentorAnBar, mentorBarSpot };
}
