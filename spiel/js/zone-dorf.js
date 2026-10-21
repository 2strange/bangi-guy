// zone-dorf.js — Zone „Krummgassen“: schiefes Dorf nördlich der Hecke. Verwinkelte Gassen zwischen bunten
// krummen Häusern, Wäscheleinen quer über die Gassen (Fluchtroute Wäschegasse, Bettlaken-Versteck), Oma auf
// dem Balkon, Hunde, Katzen, Hühner, Brunnen, Briefkästen. Grundriss + Collider-Daten: zone-dorf-layout.js.
// Einbau: buildDorf(gruppe, colliders, { exits }) — hängt alle Props als direkte Kinder an `gruppe` (so greift die
// Verdeckungs-Ausblendung je Prop) und schiebt die Collider in `colliders`.
import * as THREE from 'three';
import { RoundedBoxGeometry } from 'three/addons/geometries/RoundedBoxGeometry.js';
import { toonMesh, toon, deform, rng, textTexture, stripeTexture, BLACK } from './toon.js';
import { limb, mailbox, barrier, lamp } from './props.js';
import { sneaker } from './figures.js';
import { face, faceDecal } from './faces.js';
import { BUILDING_BASE, buildingScale } from './logic.js';
import { HOUSES, LANES, EXITS, PROPS, EDGES, DORF_SPOTS, footprintAABB } from './zone-dorf-layout.js';

const V = (x, y, z) => new THREE.Vector3(x, y, z);
const UP = new THREE.Vector3(0, 1, 0);
const SCALE = buildingScale('hut');

// Haus schief hinstellen: Position + Drehung + Skalierung, dazu eine Scherung (x' = x + kx·y, z' = z + kz·y),
// die das ganze Haus samt Dach zur Seite kippt. Der Grundriss bei y = 0 bleibt, der Collider stimmt weiter.
function placeCrooked(obj, x, z, rot, scale, kx, kz) {
  const shear = new THREE.Matrix4().set(1, kx, 0, 0, 0, 1, 0, 0, 0, kz, 1, 0, 0, 0, 0, 1);
  obj.matrix.compose(V(x, 0, z), new THREE.Quaternion().setFromAxisAngle(UP, rot), V(scale, scale, scale)).multiply(shear);
  obj.matrixAutoUpdate = false;
  obj.matrixWorldNeedsUpdate = true;
}

// Krumme Fernsehantenne fürs Dach
export function antenna() {
  const g = new THREE.Group();
  g.add(limb(V(0, 0, 0), V(0.15, 1.6, 0.08), 0.04, 0x555566, { outline: 0.02 }));
  for (let i = 0; i < 3; i++) {
    const bar = toonMesh(new THREE.BoxGeometry(0.9 - i * 0.2, 0.04, 0.04), 0x555566, { outline: 0.02 });
    bar.position.set(0.08 + i * 0.03, 0.9 + i * 0.3, 0.04); bar.rotation.set(0, 0.3 + i * 0.2, 0.08 * (i % 2 ? 1 : -1)); g.add(bar);
  }
  return g;
}
const tint = (hex, k) => new THREE.Color(hex).lerp(new THREE.Color(0xffffff), k).getHex();

// ---------- Canvas-Texturen (keine Fremd-Assets) ----------
function canvasTex(w, h, draw, { repeat = false } = {}) {
  const c = document.createElement('canvas'); c.width = w; c.height = h;
  draw(c.getContext('2d'));
  const tex = new THREE.CanvasTexture(c);
  tex.colorSpace = THREE.SRGBColorSpace;
  if (repeat) tex.wrapS = tex.wrapT = THREE.RepeatWrapping;
  return tex;
}

// Kopfsteinpflaster: versetzte Reihen runder Steine, Fugen nur angedeutet
export function cobbleTexture() {
  return canvasTex(256, 256, (ctx) => {
    ctx.fillStyle = '#cdb28a'; ctx.fillRect(0, 0, 256, 256);
    const rand = rng(5);
    const shades = ['#d9c09a', '#d2b78e', '#c9ae84', '#dcc4a0'];
    for (let row = 0; row < 8; row++) {
      for (let col = 0; col < 8; col++) {
        const x = col * 32 + (row % 2 ? 16 : 0) + (rand() - 0.5) * 5, y = row * 32 + 16 + (rand() - 0.5) * 4;
        ctx.fillStyle = shades[Math.floor(rand() * shades.length)];
        ctx.beginPath(); ctx.ellipse(x, y, 13 + rand() * 3, 11 + rand() * 3, (rand() - 0.5) * 0.6, 0, Math.PI * 2); ctx.fill();
      }
    }
  }, { repeat: true });
}

// Bettlaken mit zwei Augenlöchern (Gag „Gespenster-Cop im Laken“)
function ghostTexture() {
  return canvasTex(256, 256, (ctx) => {
    ctx.fillStyle = '#f6f6fa'; ctx.fillRect(0, 0, 256, 256);
    ctx.fillStyle = '#111';
    ctx.beginPath(); ctx.ellipse(92, 100, 22, 30, 0.1, 0, Math.PI * 2); ctx.fill();
    ctx.beginPath(); ctx.ellipse(166, 104, 22, 30, -0.1, 0, Math.PI * 2); ctx.fill();
  });
}

// Blümchen (Omas Rock) und Herzchen (Unterhose)
function floralTexture(bg = '#c9a0ff') {
  return canvasTex(256, 256, (ctx) => {
    ctx.fillStyle = bg; ctx.fillRect(0, 0, 256, 256);
    const rand = rng(17);
    for (let i = 0; i < 12; i++) {
      const x = 20 + rand() * 216, y = 20 + rand() * 216;
      ctx.fillStyle = '#ffffff';
      for (let k = 0; k < 5; k++) { ctx.beginPath(); ctx.arc(x + Math.cos(k * 1.257) * 9, y + Math.sin(k * 1.257) * 9, 6, 0, 7); ctx.fill(); }
      ctx.fillStyle = '#ffd54a'; ctx.beginPath(); ctx.arc(x, y, 4, 0, 7); ctx.fill();
    }
  });
}
function heartTexture() {
  return canvasTex(256, 256, (ctx) => {
    ctx.fillStyle = '#e8463a'; ctx.fillRect(0, 0, 256, 256);
    ctx.fillStyle = '#ffffff';
    for (let row = 0; row < 3; row++) for (let col = 0; col < 3; col++) {
      const x = 44 + col * 84 + (row % 2) * 30, y = 50 + row * 80;
      ctx.beginPath(); ctx.moveTo(x, y + 18);
      ctx.bezierCurveTo(x - 24, y - 6, x - 10, y - 26, x, y - 10);
      ctx.bezierCurveTo(x + 10, y - 26, x + 24, y - 6, x, y + 18); ctx.fill();
    }
  });
}

// Schild mit Text auf Vorder- und Rückseite
export function plate(text, w, h, { bg = '#fff1c2', fg = '#2b1b0b', font = 'bold 56px sans-serif', tw = 768, th = 128, thick = 0.06 } = {}) {
  const tex = textTexture(text, { bg, fg, font, w: tw, h: th });
  const plain = toon(new THREE.Color(bg).getHex());
  const lit = toon(0xffffff, { map: tex });
  return toonMesh(new THREE.BoxGeometry(w, h, thick), [plain, plain, plain, plain, lit, lit], { outline: 0.03 });
}

// ---------- Kleinkram ----------
export function flowerBox(width = 1.0, seed = 1) {
  const g = new THREE.Group();
  const rand = rng(seed);
  const box = toonMesh(new THREE.BoxGeometry(width, 0.28, 0.34), 0x8b5a2b, { outline: 0.035 });
  box.position.y = 0.14; g.add(box);
  const colors = [0xe8463a, 0xffd54a, 0xff5fa2, 0xffffff, 0xff7f3f];
  for (let i = 0; i < 4; i++) {
    const leaf = toonMesh(new THREE.SphereGeometry(0.12, 8, 6), 0x3bb84a, { outline: 0.025 });
    leaf.geometry.scale(1.3, 0.8, 1);
    leaf.position.set(-width * 0.38 + i * width * 0.25, 0.32, (rand() - 0.5) * 0.1); g.add(leaf);
    const f = toonMesh(new THREE.SphereGeometry(0.1 + rand() * 0.04, 8, 6), colors[(i + seed) % colors.length], { outline: 0.025 });
    f.position.set(-width * 0.38 + i * width * 0.25 + (rand() - 0.5) * 0.1, 0.48 + rand() * 0.08, (rand() - 0.5) * 0.12); g.add(f);
  }
  return g;
}

// Omas Kräuter: Topf mit spitzen Blättern (plus Schildchen)
export function herbPot() {
  const g = new THREE.Group();
  const pot = toonMesh(new THREE.CylinderGeometry(0.2, 0.15, 0.3, 10), 0xc47a3a, { outline: 0.03 });
  pot.position.y = 0.15; g.add(pot);
  for (let i = 0; i < 7; i++) {
    const a = i * 0.9, lean = 0.25 + (i % 3) * 0.12;
    const leaf = toonMesh(new THREE.ConeGeometry(0.06, 0.55 + (i % 2) * 0.2, 5), i % 2 ? 0x3bb84a : 0x2f9f3a, { outline: 0.02 });
    leaf.position.set(Math.cos(a) * 0.08, 0.5 + (i % 2) * 0.1, Math.sin(a) * 0.08);
    leaf.rotation.set(Math.sin(a) * lean, 0, -Math.cos(a) * lean);
    g.add(leaf);
  }
  const sign = plate('BASILIKUM', 0.5, 0.14, { font: 'bold 72px sans-serif', tw: 512, th: 128, thick: 0.02 });
  sign.position.set(0, 0.42, 0.26); sign.rotation.set(-0.3, 0, 0.08); g.add(sign);
  return g;
}

function well() {
  const g = new THREE.Group();
  const ring = toonMesh(new THREE.CylinderGeometry(1.2, 1.3, 0.9, 12), 0x8d8fa0, { outline: 0.05 });
  ring.position.y = 0.45; g.add(ring);
  const hole = toonMesh(new THREE.CylinderGeometry(0.95, 0.95, 0.06, 12), 0x1b2a44, { outline: 0, basic: true });
  hole.position.y = 0.9; g.add(hole);
  g.add(limb(V(-1.0, 0.8, 0), V(-1.08, 2.5, 0.06), 0.1, 0x7a4b22, { outline: 0.035 }));
  g.add(limb(V(1.0, 0.8, 0), V(1.1, 2.45, -0.05), 0.1, 0x7a4b22, { outline: 0.035 }));
  g.add(limb(V(-1.08, 2.3, 0.06), V(1.1, 2.25, -0.05), 0.07, 0x7a4b22, { outline: 0.03 }));
  const roof = toonMesh(new THREE.ConeGeometry(1.75, 0.9, 6), 0xe3b04b, { outline: 0.05 });
  roof.position.set(0.05, 2.95, 0); roof.rotation.z = 0.07; g.add(roof);
  const bucket = toonMesh(new THREE.CylinderGeometry(0.2, 0.16, 0.3, 8), 0x5a3b1a, { outline: 0.03 });
  bucket.position.set(0.2, 1.55, 0); g.add(bucket);
  g.add(limb(V(0.2, 1.7, 0), V(0.1, 2.27, 0), 0.02, 0xfff1c2, { outline: 0.012 }));
  g.add(limb(V(1.1, 2.3, -0.05), V(1.4, 2.5, -0.05), 0.04, 0x555566, { outline: 0.02 }));
  const knob = toonMesh(new THREE.SphereGeometry(0.08, 8, 6), 0xe8463a, { outline: 0.02 });
  knob.position.set(1.4, 2.5, -0.05); g.add(knob);
  return g;
}

function crates() {
  const g = new THREE.Group();
  for (const [x, y, z, ry] of [[0, 0.55, 0, 0], [0.15, 1.62, -0.1, 0.4]]) {
    const b = toonMesh(new RoundedBoxGeometry(1.1, 1.05, 1.1, 3, 0.06), 0xd8a85a, { outline: 0.04 });
    b.position.set(x, y, z); b.rotation.y = ry; g.add(b);
    for (const dy of [-0.3, 0.3]) {
      const slat = toonMesh(new THREE.BoxGeometry(1.0, 0.05, 0.05), BLACK, { outline: 0, shadow: false, basic: true });
      slat.position.set(0, dy, 0.54); b.add(slat);
    }
  }
  const sign = plate('MANGOS', 0.8, 0.26, { bg: '#ffd54a', font: 'bold 80px sans-serif', tw: 512, th: 128, thick: 0.03 });
  sign.position.set(0.05, 0.55, 0.58); sign.rotation.z = 0.08; g.add(sign);
  return g;
}

function barrel() {
  const g = new THREE.Group();
  const b = toonMesh(new THREE.CylinderGeometry(0.52, 0.48, 1.1, 12), 0x8b5a2b, { outline: 0.04 });
  b.position.y = 0.55; g.add(b);
  for (const y of [0.3, 0.85]) {
    const hoop = toonMesh(new THREE.TorusGeometry(0.54, 0.04, 6, 16), 0x555566, { outline: 0.02 });
    hoop.position.y = y; hoop.rotation.x = Math.PI / 2; g.add(hoop);
  }
  g.rotation.z = 0.06;
  return g;
}

// Wegweiser mit beidseitig lesbaren Brettern
function signpost(items) {
  const g = new THREE.Group();
  g.add(limb(V(0, 0, 0), V(0.2, 2.7, 0.05), 0.1, 0x7a4b22, { outline: 0.04 }));
  items.forEach(([txt, rot], i) => {
    const y = 2.4 - i * 0.5;
    const board = plate(txt, 1.9, 0.4, { bg: '#e8c57a', font: 'bold 66px sans-serif', tw: 640, th: 128, thick: 0.08 });
    deform(board.geometry, (v) => { if (v.x > 0.8) v.y *= 0.55; });
    board.position.set(0.2 * (y / 2.7), y, 0);
    board.rotation.set(0, rot, (i % 2 ? -1 : 1) * 0.07);
    g.add(board);
  });
  return g;
}

// ---------- Tiere ----------
// Hund, stehend, Blick nach +x
function dog(color = 0xa66b38) {
  const g = new THREE.Group();
  const body = toonMesh(new RoundedBoxGeometry(1.05, 0.52, 0.48, 3, 0.15), color, { outline: 0.04 });
  body.position.set(0, 0.72, 0); g.add(body);
  for (const [x, z] of [[-0.38, -0.17], [-0.38, 0.17], [0.36, -0.17], [0.36, 0.17]]) {
    g.add(limb(V(x, 0.05, z), V(x, 0.72, z), 0.075, color, { outline: 0.03 }));
    const paw = toonMesh(new THREE.SphereGeometry(0.09, 8, 6), color, { outline: 0.025 });
    paw.geometry.scale(1.2, 0.6, 1.1); paw.position.set(x + 0.03, 0.06, z); g.add(paw);
  }
  const head = toonMesh(new THREE.SphereGeometry(0.3, 14, 10), color, { outline: 0.04 });
  head.geometry.scale(1.1, 1, 1); head.position.set(0.62, 1.0, 0); g.add(head);
  const snout = toonMesh(new RoundedBoxGeometry(0.34, 0.22, 0.26, 3, 0.08), tint(color, 0.35), { outline: 0.03 });
  snout.position.set(0.9, 0.92, 0); g.add(snout);
  const nose = toonMesh(new THREE.SphereGeometry(0.08, 8, 6), BLACK, { outline: 0, basic: true });
  nose.position.set(1.07, 0.99, 0); g.add(nose);
  const tongue = toonMesh(new THREE.BoxGeometry(0.1, 0.03, 0.2), 0xff7b9c, { outline: 0.015 });
  tongue.position.set(1.0, 0.8, 0.05); tongue.rotation.x = 0.4; g.add(tongue);
  for (const s of [-1, 1]) {
    const eye = toonMesh(new THREE.SphereGeometry(0.07, 8, 6), 0xffffff, { outline: 0.02 });
    eye.position.set(0.82, 1.12, s * 0.14); g.add(eye);
    const pupil = toonMesh(new THREE.SphereGeometry(0.035, 6, 5), BLACK, { outline: 0, basic: true });
    pupil.position.set(0.055, 0, s * 0.01); eye.add(pupil);
    const ear = toonMesh(new THREE.SphereGeometry(0.14, 8, 6), tint(color, 0.15), { outline: 0.03 });
    ear.geometry.scale(0.6, 1.4, 0.35);
    ear.position.set(0.5, 0.98, s * 0.3); ear.rotation.x = s * 0.35; ear.rotation.z = 0.2; g.add(ear);
  }
  g.add(limb(V(-0.52, 0.8, 0), V(-0.8, 1.25, 0.1), 0.05, color, { outline: 0.025, taper: 0.6 }));
  const collar = toonMesh(new THREE.TorusGeometry(0.25, 0.05, 6, 16), 0xe8463a, { outline: 0.02 });
  collar.position.set(0.42, 0.93, 0); collar.rotation.y = Math.PI / 2; g.add(collar);
  const tag = toonMesh(new THREE.SphereGeometry(0.05, 6, 5), 0xffd54a, { outline: 0.015 });
  tag.position.set(0.44, 0.68, 0); g.add(tag);
  return g;
}

// Katze, sitzend, Blick nach +z
export function cat(color = 0x333344) {
  const g = new THREE.Group();
  const body = toonMesh(new THREE.SphereGeometry(0.24, 12, 9), color, { outline: 0.03 });
  body.geometry.scale(1, 1.25, 0.9); body.position.y = 0.32; g.add(body);
  for (const s of [-1, 1]) g.add(limb(V(s * 0.1, 0.02, 0.15), V(s * 0.1, 0.35, 0.12), 0.05, color, { outline: 0.02 }));
  const head = toonMesh(new THREE.SphereGeometry(0.2, 12, 9), color, { outline: 0.03 });
  head.position.set(0, 0.7, 0.08); g.add(head);
  for (const s of [-1, 1]) {
    const ear = toonMesh(new THREE.ConeGeometry(0.07, 0.16, 4), color, { outline: 0.02 });
    ear.position.set(s * 0.12, 0.88, 0.04); ear.rotation.z = -s * 0.3; g.add(ear);
    const eye = toonMesh(new THREE.SphereGeometry(0.045, 8, 6), 0x7ddc5a, { outline: 0.015 });
    eye.position.set(s * 0.08, 0.73, 0.24); g.add(eye);
    const slit = toonMesh(new THREE.BoxGeometry(0.015, 0.06, 0.02), BLACK, { outline: 0, basic: true });
    slit.position.set(0, 0, 0.04); eye.add(slit);
  }
  const nose = toonMesh(new THREE.SphereGeometry(0.025, 6, 5), 0xff9ec4, { outline: 0.01 });
  nose.position.set(0, 0.66, 0.27); g.add(nose);
  const curve = new THREE.CatmullRomCurve3([V(0, 0.15, -0.2), V(0.25, 0.1, -0.32), V(0.42, 0.3, -0.18), V(0.36, 0.56, -0.04)]);
  g.add(toonMesh(new THREE.TubeGeometry(curve, 10, 0.045, 6, false), color, { outline: 0.02 }));
  return g;
}

// Huhn, Blick nach +x
export function chicken(color = 0xfff5e0, seed = 1) {
  const g = new THREE.Group();
  const body = toonMesh(new THREE.SphereGeometry(0.26, 12, 9), color, { outline: 0.03 });
  body.geometry.scale(1.25, 1, 0.9); body.position.y = 0.42; g.add(body);
  const tail = toonMesh(new THREE.ConeGeometry(0.12, 0.32, 5), 0xd9a84a, { outline: 0.02 });
  tail.position.set(-0.32, 0.6, 0); tail.rotation.z = 0.9; g.add(tail);
  const head = toonMesh(new THREE.SphereGeometry(0.14, 10, 8), color, { outline: 0.025 });
  head.position.set(0.3, 0.68, 0); g.add(head);
  const beak = toonMesh(new THREE.ConeGeometry(0.05, 0.15, 5), 0xff9f1c, { outline: 0.015 });
  beak.position.set(0.46, 0.66, 0); beak.rotation.z = -Math.PI / 2; g.add(beak);
  for (let i = 0; i < 3; i++) {
    const comb = toonMesh(new THREE.SphereGeometry(0.05, 6, 5), 0xe8463a, { outline: 0.015 });
    comb.position.set(0.24 + i * 0.06, 0.8 + (i % 2) * 0.02, 0); g.add(comb);
  }
  const wattle = toonMesh(new THREE.SphereGeometry(0.04, 6, 5), 0xe8463a, { outline: 0.012 });
  wattle.position.set(0.38, 0.56, 0); g.add(wattle);
  for (const s of [-1, 1]) {
    const eye = toonMesh(new THREE.SphereGeometry(0.025, 6, 5), BLACK, { outline: 0, basic: true });
    eye.position.set(0.37, 0.72, s * 0.1); g.add(eye);
    g.add(limb(V(0.05, 0, s * 0.1), V(0.05, 0.25, s * 0.1), 0.025, 0xff9f1c, { outline: 0.012 }));
  }
  g.rotation.y = seed * 1.7;
  return g;
}

// ---------- Oma: Blümchenrock, Strickjacke, Dutt, Brille, Hausschuhe, Gießkanne. Blick nach +z ----------
function oma() {
  const g = new THREE.Group();
  const skin = 0xf2c7a8;
  for (const s of [-1, 1]) {
    const slipper = toonMesh(new RoundedBoxGeometry(0.4, 0.2, 0.75, 3, 0.08), 0xff9ec4, { outline: 0.035 });
    slipper.position.set(s * 0.28, 0.1, 0.12); slipper.rotation.y = s * 0.25; g.add(slipper);
    const pom = toonMesh(new THREE.SphereGeometry(0.1, 8, 6), 0xffffff, { outline: 0.02 });
    pom.position.set(0, 0.12, 0.3); slipper.add(pom);
  }
  const skirt = toonMesh(new THREE.CylinderGeometry(0.42, 0.74, 1.3, 16), toon(0xffffff, { map: floralTexture() }), { outline: 0.045 });
  skirt.position.y = 0.7; g.add(skirt);
  const hem = toonMesh(new THREE.TorusGeometry(0.74, 0.04, 6, 20), 0xffffff, { outline: 0.02 });
  hem.position.y = 0.06; hem.rotation.x = Math.PI / 2; g.add(hem);
  const torso = toonMesh(new THREE.SphereGeometry(0.46, 14, 10), 0xb48ee0, { outline: 0.045 });
  torso.geometry.scale(1, 0.95, 0.85); torso.position.set(0, 1.72, 0); g.add(torso);
  const beads = toonMesh(new THREE.TorusGeometry(0.2, 0.035, 6, 18), 0xfff5e0, { outline: 0.015 });
  beads.position.set(0, 2.1, 0.08); beads.rotation.x = Math.PI / 2 + 0.3; g.add(beads);
  // Arme: links hängt, rechts hält die Gießkanne
  g.add(limb(V(-0.42, 1.95, 0), V(-0.55, 1.3, 0.3), 0.09, 0xb48ee0, { outline: 0.035 }));
  const handL = toonMesh(new THREE.SphereGeometry(0.13, 10, 8), skin, { outline: 0.03 });
  handL.position.set(-0.56, 1.25, 0.33); g.add(handL);
  g.add(limb(V(0.42, 1.95, 0), V(0.55, 1.45, 0.42), 0.09, 0xb48ee0, { outline: 0.035 }));
  const handR = toonMesh(new THREE.SphereGeometry(0.13, 10, 8), skin, { outline: 0.03 });
  handR.position.set(0.57, 1.42, 0.45); g.add(handR);
  const can = toonMesh(new THREE.CylinderGeometry(0.2, 0.22, 0.34, 10), 0x3bb84a, { outline: 0.035 });
  can.position.set(0.72, 1.2, 0.55); can.rotation.z = -0.2; g.add(can);
  g.add(limb(V(0.85, 1.2, 0.6), V(1.12, 1.45, 0.75), 0.035, 0x3bb84a, { outline: 0.015 }));
  const rose = toonMesh(new THREE.SphereGeometry(0.07, 8, 6), 0x2f9f3a, { outline: 0.015 });
  rose.position.set(1.14, 1.46, 0.76); g.add(rose);
  const handle = toonMesh(new THREE.TorusGeometry(0.14, 0.03, 6, 12, Math.PI), 0x3bb84a, { outline: 0.012 });
  handle.position.set(0.66, 1.38, 0.55); g.add(handle);
  // Hals + Kopf
  g.add(limb(V(0, 2.05, 0), V(0, 2.3, 0), 0.13, skin, { outline: 0.03 }));
  const head = new THREE.Group();
  head.position.set(0, 2.55, 0.05); head.rotation.set(0.08, -0.15, 0.06); g.add(head);
  head.add(toonMesh(new THREE.SphereGeometry(0.42, 24, 18), skin, { outline: 0.045 }));
  head.add(faceDecal(face('kunde', 'zufrieden', { skin: '#f2c7a8', glasses: true, wrinkles: true, seed: 21 }), 0.426, null));
  const nose = toonMesh(new THREE.SphereGeometry(0.1, 8, 6), 0xe8a98a, { outline: 0.025 });
  nose.position.set(0, -0.06, 0.4); head.add(nose);
  for (const s of [-1, 1]) {
    const ear = toonMesh(new THREE.SphereGeometry(0.09, 8, 6), skin, { outline: 0.025 });
    ear.position.set(s * 0.42, 0, 0); head.add(ear);
    const ring = toonMesh(new THREE.TorusGeometry(0.05, 0.015, 6, 10), 0xffd54a, { outline: 0.01 });
    ring.position.set(s * 0.43, -0.12, 0); head.add(ring);
  }
  const hair = toonMesh(new THREE.SphereGeometry(0.45, 16, 10, 0, Math.PI * 2, 0, Math.PI * 0.55), 0xd8d8e0, { outline: 0.04 });
  hair.position.set(0, 0.04, -0.04); hair.rotation.x = -0.25; head.add(hair);
  const bun = toonMesh(new THREE.SphereGeometry(0.2, 10, 8), 0xd8d8e0, { outline: 0.035 });
  bun.position.set(0, 0.42, -0.2); head.add(bun);
  g.add(limb(V(-0.12, 2.95, -0.2), V(0.22, 3.12, -0.3), 0.02, 0x7a4b22, { outline: 0.01 })); // Haarnadel
  g.userData.parts = { head };
  return g;
}

// ---------- Dorfhaus: eine Etage, Grundriss wie hut() (3.2 × 3.0), aber hohes verzogenes Dach mit welligem
// Überhang, Gaube auf manchen, krummer Schornstein — damit es auch von oben schief aussieht ----------
function cottage({ wall = 0xf08ac4, roofColor = 0x2fa9b9, lean = 0.4, seed = 2, sign = null } = {}) {
  const g = new THREE.Group();
  const rand = rng(seed);
  const w = 3.2, d = 3.0, h = 2.3 + (seed % 3) * 0.3, flare = 1.12, twist = (seed % 2 ? 1 : -1) * 0.06;
  const wallGeo = new THREE.BoxGeometry(w, h, d);
  deform(wallGeo, (v) => { if (v.y > 0) { v.x = v.x * flare + lean; v.z = v.z * 1.06 + lean * 0.25; } });
  wallGeo.translate(0, h / 2, 0);
  g.add(toonMesh(wallGeo, wall, { outline: 0.06 }));
  const frontZ = (t) => (d / 2) * (1 - t) + (d / 2 * 1.06 + lean * 0.25) * t;
  const frontX = (t, x) => x * (1 + (flare - 1) * t) + lean * t;
  // Tür, Klinke, Schild
  const doorH = BUILDING_BASE.hut.door;
  const door = toonMesh(new THREE.BoxGeometry(0.95, doorH, 0.12), 0x4a2e1a, { outline: 0.04 });
  door.position.set(frontX(0.3, -0.55), doorH / 2, frontZ(0.35) + 0.02); door.rotation.z = 0.06; g.add(door);
  const knob = toonMesh(new THREE.SphereGeometry(0.07, 8, 6), 0xffd54a, { outline: 0.02 });
  knob.position.set(0.28, 0, 0.1); door.add(knob);
  if (sign) {
    const sp = plate(sign, 1.0, 0.17, { font: 'bold 60px sans-serif', tw: 1024, th: 112, thick: 0.03 });
    sp.position.set(frontX(0.3, -0.55), doorH * 0.8, frontZ(0.35) + 0.1); sp.rotation.z = 0.1; g.add(sp);
  }
  // Fenster mit Läden, einer hängt; Blumenkasten darunter
  const wx = frontX(0.62, 0.75), wy = h * 0.62, wz = frontZ(0.62) + 0.04;
  const win = new THREE.Group();
  win.add(toonMesh(new THREE.BoxGeometry(0.85, 0.8, 0.14), 0xfff4d6, { outline: 0.04 }));
  win.add(toonMesh(new THREE.BoxGeometry(0.62, 0.58, 0.16), 0x7fd8ff, { outline: 0.02 }));
  for (const sd of [-1, 1]) {
    const sh = toonMesh(new THREE.BoxGeometry(0.28, 0.86, 0.08), roofColor, { outline: 0.03 });
    sh.position.set(sd * 0.58, sd > 0 ? -0.05 : 0, -0.02); sh.rotation.z = sd > 0 ? 0.16 : 0; win.add(sh);
  }
  win.position.set(wx, wy, wz); win.rotation.z = -0.07; g.add(win);
  const fb = flowerBox(0.95, seed); fb.position.set(wx, wy - 0.58, wz + 0.22); g.add(fb);
  // Dach: hohe Pyramide, Spitze weit verzogen, Traufe wellig, Überhang, schräg aufgesetzt
  const rr = w * flare * 0.8, roofH = 2.0 + (seed % 2) * 0.5;
  const roofGeo = new THREE.ConeGeometry(rr, roofH, 4);
  roofGeo.rotateY(Math.PI / 4 + twist);
  deform(roofGeo, (v) => { if (v.y > 0.4) { v.x += lean * 1.5; v.z += lean * 0.4; } else { v.y -= 0.16 * Math.abs(Math.sin(v.x * 2.2 + 0.5)); } });
  roofGeo.scale(1, 1, (d * 1.06) / (w * flare));
  const roof = toonMesh(roofGeo, roofColor, { outline: 0.06 });
  roof.position.set(lean * 0.9, h + roofH / 2 - 0.18, lean * 0.2); roof.rotation.set(0.03, 0, 0.06); g.add(roof);
  // Gaube vorn auf jedem zweiten Haus
  if (seed % 3 === 1) {
    const dormer = toonMesh(new THREE.BoxGeometry(0.8, 0.7, 0.9), wall, { outline: 0.04 });
    dormer.position.set(lean * 0.8 - 0.3, h + 0.55, d * 0.3); dormer.rotation.z = 0.05; g.add(dormer);
    const dw = toonMesh(new THREE.BoxGeometry(0.45, 0.4, 0.1), 0x7fd8ff, { outline: 0.025 });
    dw.position.set(0, 0.02, 0.46); dormer.add(dw);
    const dr = toonMesh(new THREE.ConeGeometry(0.75, 0.6, 4), roofColor, { outline: 0.04 });
    dr.geometry.rotateY(Math.PI / 4); dr.position.set(0, 0.6, 0); dr.rotation.z = 0.08; dormer.add(dr);
  }
  // Schornstein krumm, Antenne auf jedem dritten Haus
  const cx = w * 0.3 - lean * 0.3, cz = -d * 0.2;
  g.add(limb(V(cx, h + 0.4, cz), V(cx + 0.4, h + 1.9 + (seed % 2) * 0.3, cz + 0.1), 0.15, 0x555566, { outline: 0.04 }));
  const cap = toonMesh(new THREE.CylinderGeometry(0.24, 0.24, 0.12, 10), 0x333344, { outline: 0.03 });
  cap.position.set(cx + 0.42, h + 1.96 + (seed % 2) * 0.3, cz + 0.1); cap.rotation.z = 0.2; g.add(cap);
  if (seed % 3 === 0) { const a = antenna(); a.position.set(-0.7, h + 1.0, -0.4); a.rotation.z = 0.2; g.add(a); }
  void rand;
  return g;
}

// ---------- Stadthaus: zwei Etagen, Balkon, Fensterläden, Blumenkästen (Grundriss wie hut: 3.2 × 3.0) ----------
function townhouse({ wall = 0x9fd8ff, roofColor = 0xffd54a, lean = 0.3, seed = 4 } = {}) {
  const g = new THREE.Group();
  const rand = rng(seed);
  // Höhen je Haus verschieden, Obergeschoss gegen das Erdgeschoss verdreht und weiter ausgestellt
  const w = 3.2, d = 3.0, h1 = 2.2 + (seed % 3) * 0.3, h2 = 1.9 + (seed % 2) * 0.5, flare = 1.1, twist = (seed % 2 ? 1 : -1) * 0.07;
  const f1 = new THREE.BoxGeometry(w, h1, d);
  deform(f1, (v) => { if (v.y > 0) { v.x = v.x * flare + lean * 0.6; v.z = v.z * 1.04 + lean * 0.15; } });
  f1.translate(0, h1 / 2, 0);
  g.add(toonMesh(f1, wall, { outline: 0.06 }));
  const w2 = w * flare, d2 = d * 1.04;
  const f2 = new THREE.BoxGeometry(w2, h2, d2);
  deform(f2, (v) => { if (v.y > 0) { v.x = v.x * flare + lean * 0.8; v.z = v.z * 1.06 + lean * 0.2; } });
  f2.rotateY(twist);
  f2.translate(lean * 0.6, h1 + h2 / 2, lean * 0.15);
  g.add(toonMesh(f2, tint(wall, 0.35), { outline: 0.06 }));
  const band = toonMesh(new THREE.BoxGeometry(w2 + 0.16, 0.14, d2 + 0.16), 0x5a3b1a, { outline: 0.035 });
  band.position.set(lean * 0.6, h1, lean * 0.15); band.rotation.set(0.02, twist, 0.03); g.add(band);
  // Dach: hohe Pyramide mit Überhang, Spitze weit verzogen, insgesamt schräg aufgesetzt
  const rr = w2 * flare * 0.82;
  const roofH = 1.9 + (seed % 3) * 0.3;
  const roofGeo = new THREE.ConeGeometry(rr, roofH, 4);
  roofGeo.rotateY(Math.PI / 4 + twist);
  deform(roofGeo, (v) => { if (v.y > 0.5) { v.x += lean * 1.6; v.z += lean * 0.5; } else { v.y -= 0.12 * Math.abs(Math.sin(v.x * 2.5)); } });
  roofGeo.scale(1, 1, (d2 * 1.06) / (w2 * flare));
  const roof = toonMesh(roofGeo, roofColor, { outline: 0.06 });
  roof.position.set(lean * 1.0, h1 + h2 + roofH / 2 - 0.1, lean * 0.2); roof.rotation.set(0.04, 0, 0.07); g.add(roof);
  const topY = h1 + h2 + roofH * 0.35;
  g.add(limb(V(-w * 0.3, topY - 0.3, -d * 0.2), V(-w * 0.3 - 0.45, topY + 1.3, -d * 0.2 + 0.1), 0.15, 0x555566, { outline: 0.04 }));
  const cap = toonMesh(new THREE.CylinderGeometry(0.24, 0.24, 0.12, 10), 0x333344, { outline: 0.03 });
  cap.position.set(-w * 0.3 - 0.47, topY + 1.36, -d * 0.2 + 0.1); cap.rotation.z = 0.25; g.add(cap);
  if (seed % 2) { const a = antenna(); a.position.set(w * 0.35, topY + 0.1, d * 0.15); a.rotation.z = -0.15; g.add(a); }

  const frontZ1 = (t) => (d / 2) * (1 + 0.03 * t);
  const frontZ2 = (t) => (d2 / 2) * (1 + 0.04 * t);
  // Tür unten
  const doorH = BUILDING_BASE.hut.door;
  const door = toonMesh(new THREE.BoxGeometry(0.95, doorH, 0.12), 0x4a2e1a, { outline: 0.04 });
  door.position.set(-0.6 + lean * 0.15, doorH / 2, frontZ1(0.4) + 0.02); door.rotation.z = -0.05; g.add(door);
  const knob = toonMesh(new THREE.SphereGeometry(0.07, 8, 6), 0xffd54a, { outline: 0.02 });
  knob.position.set(0.3, 0, 0.1); door.add(knob);
  // Fenster mit Läden (einer hängt schief)
  const win = (x, y, z, shutter, tilt = 0) => {
    const wg = new THREE.Group();
    wg.add(toonMesh(new THREE.BoxGeometry(0.8, 0.8, 0.14), 0xfff4d6, { outline: 0.04 }));
    const pane = toonMesh(new THREE.BoxGeometry(0.6, 0.6, 0.16), 0x7fd8ff, { outline: 0.02 });
    wg.add(pane);
    for (const s of [-1, 1]) {
      const sh = toonMesh(new THREE.BoxGeometry(0.28, 0.86, 0.08), shutter, { outline: 0.03 });
      sh.position.set(s * 0.56, s > 0 ? -0.04 : 0, -0.02); sh.rotation.z = s > 0 ? tilt : 0; wg.add(sh);
    }
    wg.position.set(x, y, z);
    g.add(wg);
    return wg;
  };
  win(0.85 + lean * 0.2, h1 * 0.6, frontZ1(0.6) + 0.04, roofColor, 0.18);
  win(1.05 + lean * 0.6, h1 + h2 * 0.55, frontZ2(0.55) + 0.04, roofColor, -0.12);
  const fb1 = flowerBox(0.95, seed); fb1.position.set(0.85 + lean * 0.2, h1 * 0.6 - 0.6, frontZ1(0.6) + 0.22); g.add(fb1);
  const fb2 = flowerBox(0.95, seed + 3); fb2.position.set(1.05 + lean * 0.6, h1 + h2 * 0.55 - 0.6, frontZ2(0.55) + 0.22); g.add(fb2);
  // Seitenfenster oben
  const side = win(0, h1 + h2 * 0.5, 0, roofColor, 0.1);
  side.position.set(-(w2 / 2 + lean * 0.1) - 0.02, h1 + h2 * 0.5, 0.3); side.rotation.y = -Math.PI / 2;
  // Balkon oben links mit Balkontür
  const bz = frontZ2(0.45);
  const bdoor = toonMesh(new THREE.BoxGeometry(0.9, 1.7, 0.1), 0x4a2e1a, { outline: 0.035 });
  bdoor.position.set(-0.55 + lean * 0.5, h1 + 0.9, bz + 0.02); g.add(bdoor);
  const slab = toonMesh(new THREE.BoxGeometry(2.0, 0.14, 1.0), 0xfff1f6, { outline: 0.04 });
  slab.position.set(-0.4 + lean * 0.5, h1 + 0.05, bz + 0.5); slab.rotation.z = 0.02; g.add(slab);
  const railY = h1 + 0.95, rz = bz + 0.98;
  for (let i = 0; i <= 5; i++) {
    const x = -1.4 + lean * 0.5 + i * 0.4;
    g.add(limb(V(x, h1 + 0.1, rz), V(x + (rand() - 0.5) * 0.06, railY, rz), 0.035, 0xffffff, { outline: 0.02 }));
  }
  const rail = toonMesh(new THREE.BoxGeometry(2.0, 0.08, 0.08), 0xffffff, { outline: 0.03 });
  rail.position.set(-0.4 + lean * 0.5, railY, rz); rail.rotation.z = 0.02; g.add(rail);
  for (const s of [-1, 1]) {
    const sideRail = toonMesh(new THREE.BoxGeometry(0.08, 0.08, 1.0), 0xffffff, { outline: 0.03 });
    sideRail.position.set(-0.4 + lean * 0.5 + s * 1.0, railY, bz + 0.5); g.add(sideRail);
    g.add(limb(V(-0.4 + lean * 0.5 + s * 1.0, h1 + 0.1, bz + 0.05), V(-0.4 + lean * 0.5 + s * 1.0, railY, bz + 0.05), 0.035, 0xffffff, { outline: 0.02 }));
  }
  g.userData.balcony = V(-0.4 + lean * 0.5, h1 + 0.12, bz + 0.45);
  g.userData.railing = V(-0.4 + lean * 0.5, railY, rz);
  return g;
}

// ---------- Wäscheleine zwischen zwei Punkten, mit Kleidungsstücken (t = Position auf der Leine) ----------
function laundry(a, b, items, { sag = 0.7, seed = 1 } = {}) {
  const g = new THREE.Group();
  const rand = rng(seed);
  const mid = V((a.x + b.x) / 2, (a.y + b.y) / 2 - sag * 2, (a.z + b.z) / 2);
  const curve = new THREE.QuadraticBezierCurve3(a, mid, b);
  g.add(toonMesh(new THREE.TubeGeometry(curve, 14, 0.04, 6, false), 0xfff1c2, { outline: 0.02 }));
  const dir = new THREE.Vector3().subVectors(b, a).setY(0).normalize();
  const yaw = Math.atan2(-dir.z, dir.x);
  const hideouts = [];
  for (const it of items) {
    const p = curve.getPointAt(it.t);
    const cloth = new THREE.Group();
    cloth.position.copy(p);
    cloth.rotation.y = yaw + (rand() - 0.5) * 0.15;
    const peg = (x) => { const pg = toonMesh(new THREE.BoxGeometry(0.07, 0.16, 0.08), 0xd8a85a, { outline: 0.012 }); pg.position.set(x, -0.02, 0); cloth.add(pg); };
    const hang = (geo, color, w, h, dx = 0) => {
      const m = toonMesh(geo, color, { outline: 0.03 });
      m.position.set(dx, -h / 2 - 0.02, 0); cloth.add(m); return m;
    };
    switch (it.kind) {
      case 'shirt': {
        hang(new THREE.BoxGeometry(0.9, 1.0, 0.06), it.color ?? 0x3a7bd5, 0.9, 1.0);
        for (const s of [-1, 1]) {
          const sl = toonMesh(new THREE.BoxGeometry(0.3, 0.5, 0.06), it.color ?? 0x3a7bd5, { outline: 0.03 });
          sl.position.set(s * 0.58, -0.3, 0); sl.rotation.z = -s * 0.35; cloth.add(sl);
        }
        peg(-0.3); peg(0.3); break;
      }
      case 'pants': {
        for (const s of [-1, 1]) hang(new THREE.BoxGeometry(0.32, 1.15, 0.06), it.color ?? 0xd9c08a, 0.32, 1.15, s * 0.2);
        const band = toonMesh(new THREE.BoxGeometry(0.74, 0.22, 0.07), it.color ?? 0xd9c08a, { outline: 0.03 });
        band.position.set(0, -0.13, 0); cloth.add(band);
        peg(-0.25); peg(0.25); break;
      }
      case 'sock': {
        hang(new THREE.BoxGeometry(0.24, 0.5, 0.06), it.color ?? 0xffffff, 0.24, 0.5);
        const foot = toonMesh(new THREE.BoxGeometry(0.36, 0.2, 0.06), it.color ?? 0xffffff, { outline: 0.03 });
        foot.position.set(0.08, -0.6, 0); cloth.add(foot);
        peg(0); break;
      }
      case 'towel': {
        const tex = stripeTexture(it.stripes ?? ['#ff6f61', '#fff1c2', '#ff6f61', '#fff1c2', '#ff6f61'], { vertical: false });
        hang(new THREE.BoxGeometry(1.2, 0.9, 0.06), toon(0xffffff, { map: tex }), 1.2, 0.9);
        peg(-0.4); peg(0.4); break;
      }
      case 'shorts': {
        hang(new THREE.BoxGeometry(0.72, 0.55, 0.06), toon(0xffffff, { map: heartTexture() }), 0.72, 0.55);
        peg(-0.25); peg(0.25); break;
      }
      case 'sheet': case 'ghost': {
        const geo = new THREE.BoxGeometry(2.6, 2.5, 0.06, 10, 1, 1);
        deform(geo, (v) => { v.z += 0.09 * Math.sin(v.x * 3.2 + 1); if (v.y < 0) v.y += 0.1 * Math.sin(v.x * 4); });
        const mat = it.kind === 'ghost' ? toon(0xffffff, { map: ghostTexture() }) : toon(0xf4f4f8);
        hang(geo, mat, 2.6, 2.5);
        peg(-1.0); peg(-0.3); peg(0.4); peg(1.0);
        hideouts.push({ x: p.x, z: p.z, r: 1.4 });
        break;
      }
      case 'sneakers': { // Turnschuhe an den Schnürsenkeln über die Leine geworfen
        for (const s of [-1, 1]) {
          const sh = sneaker(it.color ?? 0xe8463a, s < 0 ? 'L' : 'R');
          sh.scale.setScalar(0.85);
          sh.position.set(s * 0.22, -0.95, s * 0.08);
          sh.rotation.set(Math.PI + s * 0.3, s * 0.5, 0.2);
          cloth.add(sh);
          cloth.add(limb(V(0, 0, 0), V(s * 0.2, -0.75, s * 0.06), 0.015, 0xffffff, { outline: 0.008 }));
        }
        break;
      }
    }
    g.add(cloth);
  }
  g.userData.hideouts = hideouts;
  return g;
}

// ---------- Boden: Gassen mit Pflastertextur, Platz ----------
export function paving(parent, cobble, lanes = LANES, platz = { x: 6, z: -41, w: 13, d: 12 }) {
  const strip = (ax, az, bx, bz, width) => {
    const len = Math.hypot(bx - ax, bz - az);
    const tex = cobble.clone(); tex.repeat.set((len + width) / 3.4, width / 3.4); tex.needsUpdate = true;
    const geo = new THREE.PlaneGeometry(len + width, width);
    geo.rotateX(-Math.PI / 2);
    const m = toonMesh(geo, toon(0xffffff, { map: tex }), { outline: 0, shadow: false });
    m.receiveShadow = true;
    m.position.set((ax + bx) / 2, 0.03, (az + bz) / 2);
    m.rotation.y = Math.atan2(-(bz - az), bx - ax);
    m.userData.noFade = true;
    parent.add(m);
  };
  for (const pts of Object.values(lanes)) for (let i = 1; i < pts.length; i++) strip(pts[i - 1][0], pts[i - 1][1], pts[i][0], pts[i][1], 3.4);
  // Platz
  if (!platz) return;
  const tex = cobble.clone(); tex.repeat.set(platz.w / 3.4, platz.d / 3.4); tex.needsUpdate = true;
  const geo = new THREE.PlaneGeometry(platz.w, platz.d); geo.rotateX(-Math.PI / 2);
  const pm = toonMesh(geo, toon(0xffffff, { map: tex }), { outline: 0, shadow: false });
  pm.receiveShadow = true; pm.position.set(platz.x, 0.028, platz.z); pm.userData.noFade = true;
  parent.add(pm);
}

/**
 * Baut das Dorf in `parent` (Gruppe oder Szene) und schiebt die Collider in `colliders`.
 * Gibt Startpunkte, Bettlaken-Verstecke und die nötige Nordgrenze zurück (WORLD.minZ muss auf bounds.minZ).
 */
export function buildDorf(parent, colliders, { exits = { markt: true, posten: true } } = {}) {
  const rand = rng(31);
  const add = (o) => { parent.add(o); return o; };
  const cobble = cobbleTexture();
  paving(parent, cobble);

  // ----- Häuser -----
  const houseObjs = {};
  for (const h of HOUSES) {
    const lean = h.seed % 2 ? 0.4 : -0.4;
    let obj;
    if (h.kind === 'town') {
      obj = townhouse({ wall: h.wall, roofColor: h.roof, lean: lean * 0.8, seed: h.seed });
      if (h.balcony === 'oma') {
        const o = oma();
        o.scale.setScalar(0.85 / SCALE);
        o.position.copy(obj.userData.balcony).add(V(0.25, 0, -0.2));
        o.rotation.y = 0.35;
        obj.add(o);
        for (const dx of [-0.6, 0.6]) {
          const hp = herbPot(); hp.scale.setScalar(0.9);
          hp.position.copy(obj.userData.railing).add(V(dx, 0.04, 0)); obj.add(hp);
        }
      } else if (h.id === 'J') {
        const c = cat(0xff8c42); c.scale.setScalar(1 / SCALE * 1.1);
        c.position.copy(obj.userData.railing).add(V(0.5, 0.04, 0)); c.rotation.y = 0.4; obj.add(c);
      } else {
        const towel = toonMesh(new THREE.BoxGeometry(0.7, 0.5, 0.12), toon(0xffffff, { map: stripeTexture(['#3a7bd5', '#ffffff', '#3a7bd5', '#ffffff'], { vertical: false }) }), { outline: 0.03 });
        towel.position.copy(obj.userData.railing).add(V(-0.4, -0.2, 0.02)); obj.add(towel);
      }
    } else {
      obj = cottage({ wall: h.wall, roofColor: h.roof, lean: lean * (1 + (h.seed % 2) * 0.3), seed: h.seed, sign: h.sign });
    }
    // ganzes Haus zur Seite kippen (Scherung 4–9 %), Richtung je Haus anders
    const r2 = rng(100 + h.seed);
    placeCrooked(obj, h.x, h.z, h.rot, SCALE, (r2() - 0.5) * 0.18, (r2() - 0.5) * 0.14);
    add(obj);
    houseObjs[h.id] = obj;
    colliders.push(footprintAABB(h));
  }

  // ----- Wäscheleinen (Weltkoordinaten: Wandpunkte der Häuser, Höhe über Türen und Köpfen) -----
  const hideouts = [];
  const lines = [
    [V(-1.9, 5.0, -29.0), V(2.9, 5.2, -29.4), [{ t: 0.5, kind: 'ghost' }], { sag: 0.5, seed: 1 }],
    [V(-1.9, 4.7, -32.6), V(2.9, 5.0, -32.1), [{ t: 0.2, kind: 'shirt', color: 0xff7f3f }, { t: 0.5, kind: 'pants' }, { t: 0.8, kind: 'towel' }], { sag: 0.35, seed: 2 }],
    [V(6.3, 5.0, -50.5), V(9.8, 5.3, -51.5), [{ t: 0.3, kind: 'shirt', color: 0x3bb84a }, { t: 0.72, kind: 'sock' }], { sag: 0.3, seed: 3 }],
    [V(27.0, 5.1, -33.3), V(28.5, 5.4, -37.7), [{ t: 0.22, kind: 'pants', color: 0x2a3f8f }, { t: 0.55, kind: 'shorts' }, { t: 0.82, kind: 'sock', color: 0xffd54a }], { sag: 0.4, seed: 4 }],
    [V(23.5, 5.0, -55.3), V(26.0, 5.3, -60.7), [{ t: 0.5, kind: 'sheet' }], { sag: 0.6, seed: 5 }],
    [V(5.2, 5.1, -62.0), V(10.8, 5.4, -63.5), [{ t: 0.2, kind: 'shirt', color: 0xff5fa2 }, { t: 0.48, kind: 'sneakers' }, { t: 0.72, kind: 'sock' }, { t: 0.86, kind: 'sock', color: 0xe8463a }], { sag: 0.45, seed: 6 }],
  ];
  for (const [a, b, items, opts] of lines) {
    const l = add(laundry(a, b, items, opts));
    hideouts.push(...l.userData.hideouts);
  }

  // ----- Kleinkram mit Collider -----
  for (const p of PROPS) {
    let o;
    switch (p.kind) {
      case 'well': o = well(); o.scale.setScalar(1.15); break;
      case 'lamp': o = lamp(); o.scale.setScalar(1.4); o.rotation.y = rand() * 0.5; break;
      case 'mailbox': o = mailbox(); o.scale.setScalar(1.2); break;
      case 'dog': o = dog(p.color); o.scale.setScalar(1.15); break;
      case 'crates': o = crates(); break;
      case 'barrel': o = barrel(); o.scale.setScalar(1.1); break;
    }
    o.position.set(p.x, 0, p.z);
    if (p.rot) o.rotation.y = p.rot;
    add(o);
    colliders.push({ x: p.x, z: p.z, r: p.r });
  }
  // Katzen: auf den Kisten, auf dem Brunnendach
  const c1 = cat(0x333344); c1.position.set(21.4, 2.17, -39.0); c1.rotation.y = 2.6; c1.scale.setScalar(1.1); add(c1);
  const c2 = cat(0xffffff); c2.position.set(2.2, 3.85, -41.3); c2.rotation.y = -0.6; c2.scale.setScalar(1.1); add(c2);
  // Hühner-Ecke mit Schild (Gag „Hühner-Alarm“)
  for (const [x, z, k, col] of [[33, -43, 1, 0xfff5e0], [34, -44.2, 2, 0xd9a84a], [32.2, -44.5, 3, 0xfff5e0]]) {
    const hen = chicken(col, k); hen.position.set(x, 0, z); hen.scale.setScalar(1.1); add(hen);
  }
  {
    const s = new THREE.Group();
    s.add(limb(V(0, 0, 0), V(0.08, 1.5, 0), 0.05, 0x7a4b22, { outline: 0.025 }));
    const b = plate('HÜHNER – NICHT RENNEN', 1.8, 0.4, { font: 'bold 60px sans-serif', tw: 1024, th: 160, thick: 0.05 });
    b.position.set(0.08, 1.6, 0); b.rotation.set(0, 0.3, -0.08); s.add(b);
    s.position.set(33.6, 0, -41.8); add(s);
  }
  // Wegweiser am Platz
  const sp = signpost([['MARKT  →', 0.0], ['← STRAND', 0.35], ['POSTEN 7  ↑', -0.2]]);
  sp.position.set(11.3, 0, -37.2); sp.rotation.y = 0.2; sp.scale.setScalar(1.25); add(sp);
  // Büsche am Hang (Westen) und am Hügelfuß (Osten)
  for (const [x, z, r] of [[-3.2, -38, 1.8], [-3.6, -45, 2.1], [-3.4, -53, 1.7], [-3.8, -60, 2.0], [-3.2, -68, 1.8], [35.6, -40, 1.6], [36.2, -50, 1.9], [35.8, -58, 1.7], [36.4, -67, 1.9]]) {
    const bg = new THREE.SphereGeometry(r, 10, 7); bg.scale(1, 0.75, 1.1);
    const b = toonMesh(bg, rand() > 0.5 ? 0x3f9d37 : 0x4cae3c, { outline: 0.06 });
    b.position.set(x + (rand() - 0.5) * 0.6, r * 0.5, z + (rand() - 0.5) * 1.0); add(b);
  }
  // Absperrungen an den Ausgängen
  // Absperrungen an den Ausgängen — entfallen, sobald die Nachbarzone (zone-markt.js) eingehängt ist
  for (const [name, e] of Object.entries(EXITS)) {
    if (exits[name] === false) continue;
    const b = barrier(e.text); b.position.set(e.x, 0, e.z); b.rotation.y = e.rot; b.scale.setScalar(1.3); add(b);
    colliders.push({ x: e.x, z: e.z, w: e.w, d: e.d });
  }
  for (const e of EDGES) colliders.push({ ...e });

  return { spots: DORF_SPOTS, hideouts, bounds: { minZ: -74 }, houses: houseObjs };
}
