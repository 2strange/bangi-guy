// zone-markt.js — Mango-Markt (Z3) und Posten 7 (Z5). Grundriss/Collider: zone-markt-layout.js.
// Markt: fünf schiefe Stände unter Sonnensegeln (Mango-Pyramide, Fisch mit Fliegen, Ramsch, Hawaiihemden,
// Kokos), Gedränge-Kulisse als Versteck, die Katze läuft ihre Runde (Gag 10). Posten 7: das einzige fast
// gerade Gebäude, Streifenwagen ohne Reifen, Tafel „TAGE OHNE VORFALL: 0“ (Gag 14), Polizist Pong in Sandalen
// mit Trillerpfeife (Gag 13) und Idle-Loop, Mango-Stand „1 MANGO = 1 GNADE“ daneben (Gag 8).
// Einbau: buildMarkt(gruppe, colliders, { exits }) → { spots, update(t), posten {x,z,r}, mangoStand {x,z}, setTafel(text), pong, party(an), hideouts, anchors, bounds }.
import * as THREE from 'three';
import { RoundedBoxGeometry } from 'three/addons/geometries/RoundedBoxGeometry.js';
import { toonMesh, toon, deform, rng, textTexture, stripeTexture, BLACK } from './toon.js';
import { limb, barrier, lamp, palm, coconut } from './props.js';
import { sandal } from './figures.js';
import { face, faceDecal } from './faces.js';
import { shirtTexture } from './kunden.js';
import { plate, cat, cobbleTexture, paving } from './zone-dorf.js';
import { STAENDE, GEDRAENGE, LANES, EXITS, POSTEN, PLATZ, MARKT_SPOTS, MARKT_ANCHORS, POSTEN_SICHT, MANGO_STAND, WORLD_MIN_Z, marktColliders, catAt } from './zone-markt-layout.js';

const V = (x, y, z) => new THREE.Vector3(x, y, z);

// ---------- Marktstand: krummer Tisch, Vorhang, Sonnensegel, Ware, Schild. Kundenseite = +z ----------
export function stand({ kind, sign, cloth, seed = 1 }) {
  const g = new THREE.Group();
  const rand = rng(seed);
  const tex = stripeTexture([cloth[0], cloth[1], cloth[0], cloth[1], cloth[0], cloth[1]], { vertical: true });
  const tableGeo = new THREE.BoxGeometry(3.4, 0.12, 1.6);
  deform(tableGeo, (v) => { v.y += 0.04 * Math.sin(v.x * 3); });
  const table = toonMesh(tableGeo, 0xd8a85a, { outline: 0.04 });
  table.position.y = 0.98; table.rotation.z = 0.03; g.add(table);
  for (const [x, z] of [[-1.5, -0.6], [1.5, -0.6], [-1.5, 0.6], [1.5, 0.6]]) g.add(limb(V(x, 0, z), V(x + (rand() - 0.5) * 0.2, 0.95, z), 0.07, 0x8b5a2b, { outline: 0.03 }));
  const skirt = toonMesh(new THREE.BoxGeometry(3.4, 0.9, 0.06), toon(0xffffff, { map: tex }), { outline: 0.035 });
  deform(skirt.geometry, (v) => { if (v.y < 0) v.z += 0.06 * Math.sin(v.x * 4); });
  skirt.position.set(0, 0.5, 0.8); g.add(skirt);
  // Sonnensegel auf vier Pfosten, hinten höher, Tuch wellig
  for (const [x, z, h] of [[-1.7, -0.9, 2.7], [1.7, -0.9, 2.6], [-1.8, 1.0, 2.2], [1.8, 1.0, 2.25]]) g.add(limb(V(x, 0, z), V(x + (rand() - 0.5) * 0.15, h, z), 0.06, 0x8b5a2b, { outline: 0.03 }));
  const sailGeo = new THREE.BoxGeometry(4.2, 0.06, 2.4, 10, 1, 6);
  deform(sailGeo, (v) => { v.y += 0.12 * Math.sin(v.x * 2.5) * Math.cos(v.z * 2); });
  const sail = toonMesh(sailGeo, toon(0xffffff, { map: tex, side: THREE.DoubleSide }), { outline: 0.04 });
  sail.position.set(0, 2.5, 0.05); sail.rotation.set(0.2, 0, 0.03); g.add(sail);
  if (sign) {
    const s = plate(sign, 2.2, 0.42, { font: 'bold 60px sans-serif', tw: 1024, th: 160, thick: 0.05 });
    s.position.set(0.1, 2.0, 1.05); s.rotation.set(0.1, 0, -0.06); g.add(s);
  }
  // Ware
  const y = 1.06;
  if (kind === 'mango') {
    const colors = [0xffb13b, 0xff8c42, 0xe8a034, 0x9ccf3a];
    let i = 0;
    for (let layer = 0; layer < 3; layer++) for (let r = 0; r < 3 - layer; r++) for (let c = 0; c < 3 - layer; c++) {
      const m = toonMesh(new THREE.SphereGeometry(0.19, 10, 8), colors[i++ % colors.length], { outline: 0.025 });
      m.geometry.scale(1.3, 1, 0.9);
      m.position.set(-0.9 + c * 0.42 + layer * 0.21, y + 0.17 + layer * 0.32, -0.4 + r * 0.42 + layer * 0.21); m.rotation.y = rand(); g.add(m);
    }
    const crate = toonMesh(new RoundedBoxGeometry(0.9, 0.5, 0.7, 3, 0.05), 0xd8a85a, { outline: 0.03 });
    crate.position.set(1.1, y + 0.25, 0.1); crate.rotation.y = 0.2; g.add(crate);
    for (let k = 0; k < 3; k++) { const m = toonMesh(new THREE.SphereGeometry(0.17, 10, 8), 0xffb13b, { outline: 0.025 }); m.geometry.scale(1.3, 1, 0.9); m.position.set(0.9 + k * 0.2, y + 0.58, 0.1 + (k % 2) * 0.2); g.add(m); }
  } else if (kind === 'fisch') {
    const ice = toonMesh(new THREE.BoxGeometry(3.0, 0.16, 1.2), 0xeaf9ff, { outline: 0.03 });
    ice.position.set(0, y + 0.06, 0); g.add(ice);
    for (let k = 0; k < 4; k++) {
      const fish = new THREE.Group();
      const body = toonMesh(new THREE.SphereGeometry(0.28, 10, 8), k % 2 ? 0x8d9fb5 : 0x7fb8c8, { outline: 0.03 });
      body.geometry.scale(1.8, 0.6, 1); fish.add(body);
      const tail = toonMesh(new THREE.ConeGeometry(0.2, 0.3, 4), k % 2 ? 0x8d9fb5 : 0x7fb8c8, { outline: 0.025 });
      tail.position.set(-0.6, 0, 0); tail.rotation.z = Math.PI / 2; fish.add(tail);
      const eye = toonMesh(new THREE.SphereGeometry(0.05, 6, 5), BLACK, { outline: 0, basic: true }); eye.position.set(0.3, 0.08, 0.2); fish.add(eye);
      fish.position.set(-1.1 + k * 0.72, y + 0.3, -0.2 + (k % 2) * 0.4); fish.rotation.y = (rand() - 0.5) * 0.6; g.add(fish);
    }
    // Fliegen (animiert)
    const flies = new THREE.Group();
    for (let k = 0; k < 4; k++) { const f = toonMesh(new THREE.SphereGeometry(0.04, 5, 4), BLACK, { outline: 0, basic: true }); f.userData.phase = k * 1.6; flies.add(f); }
    flies.position.set(0, y + 0.9, 0); g.add(flies); g.userData.flies = flies;
  } else if (kind === 'ramsch') {
    for (let k = 0; k < 3; k++) {
      const sg = new THREE.Group();
      for (const s of [-1, 1]) { const l = toonMesh(new THREE.TorusGeometry(0.12, 0.03, 6, 12), 0x222233, { outline: 0.012 }); l.position.x = s * 0.14; sg.add(l); }
      sg.position.set(-1.2 + k * 0.4, y + 0.08, -0.4); sg.rotation.x = -1.2; g.add(sg);
    }
    for (let k = 0; k < 3; k++) {
      const w = toonMesh(new THREE.TorusGeometry(0.1, 0.035, 6, 12), 0xffd54a, { outline: 0.012 });
      w.position.set(0.2 + k * 0.35, y + 0.05, -0.4); w.rotation.x = Math.PI / 2; g.add(w);
      const dial = toonMesh(new THREE.CylinderGeometry(0.09, 0.09, 0.03, 10), 0xffffff, { outline: 0.01 }); dial.position.set(0.2 + k * 0.35, y + 0.05, -0.4); g.add(dial);
    }
    for (let k = 0; k < 4; k++) {
      const ff = toonMesh(new RoundedBoxGeometry(0.26, 0.05, 0.6, 2, 0.03), [0x3dd6e0, 0xff5fa2, 0xffd54a, 0x3bb84a][k], { outline: 0.015 });
      ff.position.set(-1.3 + k * 0.42, y + 0.03, 0.4); ff.rotation.y = (rand() - 0.5) * 0.5; g.add(ff);
    }
    const hat = toonMesh(new THREE.CylinderGeometry(0.5, 0.5, 0.04, 14), 0xe3b04b, { outline: 0.025 }); hat.position.set(1.2, y + 0.25, 0.2); g.add(hat);
    const top = toonMesh(new THREE.CylinderGeometry(0.26, 0.28, 0.2, 12), 0xe3b04b, { outline: 0.025 }); top.position.set(1.2, y + 0.37, 0.2); g.add(top);
  } else if (kind === 'hemden') {
    // Kleiderstange mit nagelneuen Hawaiihemden — jedes mit Preisschild
    g.add(limb(V(-1.6, 1.0, -0.3), V(1.6, 1.05, -0.3), 0.03, 0x555566, { outline: 0.015 }));
    g.add(limb(V(-1.6, 0.98, -0.3), V(-1.6, 2.1, -0.3), 0.03, 0x555566, { outline: 0.015 }));
    g.add(limb(V(1.6, 0.98, -0.3), V(1.6, 2.1, -0.3), 0.03, 0x555566, { outline: 0.015 }));
    g.add(limb(V(-1.7, 2.1, -0.3), V(1.7, 2.1, -0.3), 0.035, 0x555566, { outline: 0.015 }));
    const patterns = [['#3a7bd5', 0], ['#e8463a', 1], ['#9b59b6', 2], ['#3bb84a', 3]];
    patterns.forEach(([base, pat], k) => {
      const sh = toonMesh(new THREE.BoxGeometry(0.62, 0.8, 0.06), toon(0xffffff, { map: shirtTexture(pat, base) }), { outline: 0.03 });
      sh.position.set(-1.15 + k * 0.76, 1.65, -0.3 + (k % 2) * 0.05); sh.rotation.y = (rand() - 0.5) * 0.3; g.add(sh);
      for (const s of [-1, 1]) { const sl = toonMesh(new THREE.BoxGeometry(0.22, 0.35, 0.06), toon(0xffffff, { map: shirtTexture(pat, base) }), { outline: 0.025 }); sl.position.set(s * 0.4, 0.2, 0); sl.rotation.z = -s * 0.4; sh.add(sl); }
      const tag = plate('49€', 0.22, 0.14, { bg: '#ffffff', fg: '#e8463a', font: 'bold 80px sans-serif', tw: 256, th: 160, thick: 0.02 });
      tag.position.set(0.3, -0.25, 0.06); tag.rotation.z = 0.25; sh.add(tag);
    });
    const mirror = toonMesh(new THREE.BoxGeometry(0.5, 0.9, 0.05), 0xdff4ff, { outline: 0.03 }); mirror.position.set(1.4, 1.5, 0.3); mirror.rotation.y = -0.4; g.add(mirror);
  } else if (kind === 'kokos') {
    for (let k = 0; k < 5; k++) { const c = coconut(k % 2 === 0); c.position.set(-1.2 + k * 0.55, y, (k % 2) * 0.4 - 0.3); c.scale.setScalar(0.9); g.add(c); }
    for (let k = 0; k < 3; k++) {
      const glass = toonMesh(new THREE.CylinderGeometry(0.1, 0.08, 0.3, 10), 0xffb13b, { outline: 0.02 }); glass.position.set(0.9 + k * 0.3, y + 0.15, 0.4); g.add(glass);
      g.add(limb(V(0.9 + k * 0.3, y + 0.2, 0.4), V(0.98 + k * 0.3, y + 0.5, 0.42), 0.015, 0xff5fa2, { outline: 0.008 }));
    }
    const machete = toonMesh(new THREE.BoxGeometry(0.7, 0.03, 0.12), 0x8d8fa0, { outline: 0.015 }); machete.position.set(-0.2, y + 0.02, 0.55); machete.rotation.y = 0.5; g.add(machete);
  }
  return g;
}

// ---------- Gedränge: einfache Leute ohne Gliedmaßen-Animation (Kulisse, Versteck V3) ----------
export function bystander(seed) {
  const g = new THREE.Group();
  const rand = rng(seed);
  const skins = [0xf5c9a0, 0xd9a06e, 0x8d5a3a, 0xf0876a];
  const skin = skins[Math.floor(rand() * skins.length)];
  const shirt = [0x3a7bd5, 0xff5fa2, 0xffd54a, 0x3bb84a, 0xffffff, 0x9b59b6][Math.floor(rand() * 6)];
  for (const s of [-1, 1]) g.add(limb(V(s * 0.22, 0, 0), V(s * 0.22, 1.0, 0), 0.11, 0xd9c08a, { outline: 0.035 }));
  const body = toonMesh(new THREE.CylinderGeometry(0.42, 0.48, 1.1, 12), shirt, { outline: 0.045 });
  body.position.y = 1.5; g.add(body);
  for (const s of [-1, 1]) g.add(limb(V(s * 0.45, 1.95, 0), V(s * 0.55, 1.1, 0.1), 0.09, skin, { outline: 0.035 }));
  // Bauch bei jedem zweiten
  if (seed % 2) { const belly = toonMesh(new THREE.SphereGeometry(0.36, 12, 9), shirt, { outline: 0.04 }); belly.position.set(0, 1.25, 0.3); g.add(belly); }
  // Kopf: Gesicht als Decal (neutral/zufrieden), dazu 3D-Nase und Ohren, damit es auch von oben ein Gesicht ist
  const head = new THREE.Group(); head.position.y = 2.5; head.rotation.set(0.1 + (rand() - 0.5) * 0.2, (rand() - 0.5) * 0.6, (rand() - 0.5) * 0.15); g.add(head);
  const hg = new THREE.SphereGeometry(0.42, 16, 12); hg.scale(1, 1.08, 0.95);
  head.add(toonMesh(hg, skin, { outline: 0.045 }));
  const skinCss = '#' + skin.toString(16).padStart(6, '0');
  const bart = ['keiner', 'keiner', 'stoppel', 'schnauzer'][seed % 4];
  head.add(faceDecal(face('kunde', rand() > 0.5 ? 'neutral' : 'zufrieden', { skin: skinCss, seed: 30 + (seed % 5), bart, haare: seed % 7 === 0 ? 'weiss' : 'kurz' }), 0.427, (geo) => geo.scale(1, 1.08, 0.95)));
  const nose = toonMesh(new THREE.SphereGeometry(0.11, 8, 6), skin, { outline: 0.025 }); nose.position.set(0, -0.06, 0.42); head.add(nose);
  for (const sd of [-1, 1]) { const ear = toonMesh(new THREE.SphereGeometry(0.08, 8, 6), skin, { outline: 0.025 }); ear.position.set(sd * 0.42, -0.02, 0); head.add(ear); }
  const hat = rand();
  if (hat < 0.4) {
    const top = toonMesh(new THREE.CylinderGeometry(0.3, 0.33, 0.25, 12), 0xe3b04b, { outline: 0.03 }); top.position.y = 0.45; head.add(top);
    const brim = toonMesh(new THREE.CylinderGeometry(0.62, 0.62, 0.04, 16), 0xe3b04b, { outline: 0.03 }); brim.position.y = 0.33; brim.rotation.z = 0.08; head.add(brim);
  } else if (hat < 0.75) {
    const cap = toonMesh(new THREE.SphereGeometry(0.44, 14, 8, 0, Math.PI * 2, 0, Math.PI * 0.45), [0x4a2a12, 0x222222, 0xd8d8e0, 0xe8a034][Math.floor(rand() * 4)], { outline: 0.035 });
    cap.position.set(0, 0.1, -0.03); cap.rotation.x = -0.15; head.add(cap);
  } else {
    const shine = toonMesh(new THREE.SphereGeometry(0.07, 6, 5), 0xffffff, { outline: 0 }); shine.position.set(-0.15, 0.36, 0.2); head.add(shine);
  }
  if (seed % 3 === 0) { // Sonnenbrille
    for (const sd of [-1, 1]) { const lens = toonMesh(new THREE.CylinderGeometry(0.13, 0.13, 0.04, 10), 0x111111, { outline: 0.015 }); lens.position.set(sd * 0.16, 0.07, 0.4); lens.rotation.x = Math.PI / 2; head.add(lens); }
  }
  return g;
}

// ---------- Posten 7 ----------
function station() {
  const g = new THREE.Group();
  const w = 10, h = 3.4, d = 7;
  const walls = new THREE.BoxGeometry(w, h, d);
  deform(walls, (v) => { if (v.y > 0) v.x += 0.06; }); // „fast“ gerade
  walls.translate(0, h / 2, 0);
  g.add(toonMesh(walls, 0xdfe8f0, { outline: 0.07 }));
  const roof = toonMesh(new THREE.BoxGeometry(w + 0.6, 0.35, d + 0.6), 0x2a3f8f, { outline: 0.06 });
  roof.position.set(0.05, h + 0.17, 0); roof.rotation.z = 0.008; g.add(roof);
  const parapet = toonMesh(new THREE.BoxGeometry(w + 0.6, 0.5, 0.2), 0x2a3f8f, { outline: 0.04 });
  parapet.position.set(0.05, h + 0.55, d / 2 + 0.2); g.add(parapet);
  // Tür + Schild + Lampe
  const door = toonMesh(new THREE.BoxGeometry(1.3, 2.4, 0.14), 0x2a3f8f, { outline: 0.04 });
  door.position.set(0, 1.2, d / 2 + 0.03); g.add(door);
  const knob = toonMesh(new THREE.SphereGeometry(0.07, 8, 6), 0xffd54a, { outline: 0.02 }); knob.position.set(0.45, 0, 0.1); door.add(knob);
  const sign = plate('POLIZEI · POSTEN 7', 3.6, 0.6, { bg: '#2a3f8f', fg: '#ffffff', font: 'bold 66px sans-serif', tw: 1024, th: 160, thick: 0.08 });
  sign.position.set(0, h - 0.5, d / 2 + 0.1); sign.rotation.z = 0.01; g.add(sign);
  const lampShade = toonMesh(new THREE.ConeGeometry(0.3, 0.2, 10), 0x2a3f8f, { outline: 0.025 }); lampShade.position.set(1.4, 2.75, d / 2 + 0.25); g.add(lampShade);
  const bulb = toonMesh(new THREE.SphereGeometry(0.1, 8, 6), 0xfff1c2, { outline: 0.015 }); bulb.position.set(1.4, 2.62, d / 2 + 0.25); g.add(bulb);
  // vergitterte Fenster vorn und an den Seiten
  const win = (x, z, ry) => {
    const wg = new THREE.Group();
    wg.add(toonMesh(new THREE.BoxGeometry(1.1, 1.0, 0.14), 0xffffff, { outline: 0.035 }));
    const pane = toonMesh(new THREE.BoxGeometry(0.9, 0.8, 0.16), 0x7fd8ff, { outline: 0.02 }); wg.add(pane);
    for (let i = -1; i <= 1; i++) { const bar = toonMesh(new THREE.BoxGeometry(0.05, 0.9, 0.05), 0x333344, { outline: 0.015 }); bar.position.set(i * 0.28, 0, 0.1); wg.add(bar); }
    wg.position.set(x, 2.0, z); wg.rotation.y = ry; g.add(wg);
  };
  win(-3.2, d / 2 + 0.04, 0); win(3.2, d / 2 + 0.04, 0);
  win(-w / 2 - 0.04, 1.5, -Math.PI / 2); win(w / 2 + 0.04, -1.5, Math.PI / 2);
  // Heat-Tafel (Gag 14): Text fest, Zahl tauschbar
  const tafel = plate('TAGE OHNE VORFALL:', 3.2, 0.5, { bg: '#111111', fg: '#ffffff', font: 'bold 60px sans-serif', tw: 1024, th: 160, thick: 0.06 });
  tafel.position.set(-3.1, 0.95, d / 2 + 0.08); tafel.rotation.z = -0.03; g.add(tafel);
  const number = new THREE.Group(); number.position.set(-3.1, 0.42, d / 2 + 0.1); g.add(number);
  // setTafel(text): malt die untere Zeile neu (Zahl oder kurzer Text, z. B. 0, „0 (wieder)“, „∞“)
  let numPlate = null;
  const setTafel = (text) => {
    const str = String(text);
    if (numPlate) { number.remove(numPlate); numPlate.geometry.dispose(); }
    const w = Math.min(3.2, Math.max(1.0, 0.42 * str.length + 0.4));
    numPlate = plate(str, w, 0.5, { bg: '#111111', fg: '#ffd54a', font: 'bold 110px sans-serif', tw: Math.round(w * 320), th: 160, thick: 0.06 });
    numPlate.rotation.z = 0.04; number.add(numPlate);
  };
  setTafel(0);
  g.add(limb(V(-3.1, 0.2, d / 2 + 0.05), V(-3.1, 1.2, d / 2 + 0.05), 0.04, 0x555566, { outline: 0.02 }));
  g.userData.setTafel = setTafel;
  return g;
}

// Streifenwagen ohne Reifen: steht auf Kisten, ein Rad lehnt daneben
function policeCar() {
  const g = new THREE.Group();
  const body = toonMesh(new RoundedBoxGeometry(4.4, 1.0, 2.0, 3, 0.18), 0xffffff, { outline: 0.05 });
  body.position.y = 1.0; g.add(body);
  const cabin = toonMesh(new RoundedBoxGeometry(2.2, 0.9, 1.8, 3, 0.2), 0xffffff, { outline: 0.045 });
  cabin.position.set(-0.2, 1.9, 0); g.add(cabin);
  for (const s of [-1, 1]) {
    const win = toonMesh(new THREE.BoxGeometry(2.0, 0.6, 0.1), 0x7fd8ff, { outline: 0.02 }); win.position.set(-0.2, 1.95, s * 0.88); g.add(win);
    const stripe = plate('POLIZEI', 2.6, 0.36, { bg: '#2a3f8f', fg: '#ffffff', font: 'bold 70px sans-serif', tw: 768, th: 120, thick: 0.04 });
    stripe.position.set(0, 1.0, s * 1.02); stripe.rotation.y = s > 0 ? 0 : Math.PI; g.add(stripe);
    for (const x of [-1.5, 1.5]) { const arch = toonMesh(new THREE.BoxGeometry(0.9, 0.5, 0.3), 0x222233, { outline: 0.02 }); arch.position.set(x, 0.65, s * 0.9); g.add(arch); }
  }
  const front = toonMesh(new THREE.BoxGeometry(0.4, 0.5, 1.6), 0x7fd8ff, { outline: 0.02 }); front.position.set(0.95, 1.95, 0); front.rotation.z = 0.5; g.add(front);
  const bar = toonMesh(new THREE.BoxGeometry(1.0, 0.18, 0.5), 0x3a7bd5, { outline: 0.03 }); bar.position.set(-0.2, 2.45, 0); g.add(bar);
  for (const s of [-1, 1]) { const l = toonMesh(new THREE.BoxGeometry(0.3, 0.2, 0.3), s > 0 ? 0xe8463a : 0x3a7bd5, { outline: 0.02 }); l.position.set(-0.2 + s * 0.3, 2.5, 0); g.add(l); }
  for (const [x, z] of [[-1.5, -0.7], [1.5, -0.7], [-1.5, 0.7], [1.5, 0.7]]) {
    const crate = toonMesh(new RoundedBoxGeometry(0.7, 0.5, 0.6, 3, 0.05), 0xd8a85a, { outline: 0.03 }); crate.position.set(x, 0.25, z); crate.rotation.y = (x + z) * 0.1; g.add(crate);
  }
  const wheel = toonMesh(new THREE.TorusGeometry(0.42, 0.16, 8, 16), 0x222222, { outline: 0.03 });
  wheel.position.set(2.7, 0.45, 0.9); wheel.rotation.set(0.2, 0.4, 0.3); g.add(wheel);
  const hub = toonMesh(new THREE.CylinderGeometry(0.26, 0.26, 0.12, 10), 0x8d8fa0, { outline: 0.02 }); hub.position.copy(wheel.position); hub.rotation.copy(wheel.rotation); hub.rotateX(Math.PI / 2); g.add(hub);
  const antenna = limb(V(-1.6, 2.3, -0.6), V(-1.9, 3.4, -0.7), 0.02, 0x222222, { outline: 0.01 }); g.add(antenna);
  return g;
}

// Polizist Pong: Sandalen (Dienstvorschrift Tropen), Bauch, Mütze, Trillerpfeife. Blick nach +z
export function pong() {
  const root = new THREE.Group();
  const skin = 0xd9a06e, blue = 0x2a3f8f;
  const hipY = 1.05;
  for (const s of [-1, 1]) {
    const leg = new THREE.Group(); leg.position.set(s * 0.26, hipY, 0);
    const fx = s * 0.5 - s * 0.26;
    leg.add(limb(V(fx, 0.3 - hipY, -0.05), V(0, 0, 0), 0.12, skin, { outline: 0.04 }));
    const shorts = toonMesh(new THREE.CylinderGeometry(0.21, 0.25, 0.5, 12), 0x1f2f6f, { outline: 0.04 }); shorts.position.set(0, -0.18, 0); leg.add(shorts);
    const sock = toonMesh(new THREE.CylinderGeometry(0.14, 0.14, 0.3, 12), 0xffffff, { outline: 0.03 }); sock.position.set(fx, 0.42 - hipY, -0.05); leg.add(sock);
    const shoe = sandal(skin, s < 0 ? 'L' : 'R'); shoe.position.set(fx, -hipY, 0); shoe.rotation.y = s * 0.35; leg.add(shoe);
    root.add(leg);
  }
  const tg = new THREE.SphereGeometry(0.58, 16, 12); tg.scale(1, 0.95, 0.9);
  const torso = toonMesh(tg, blue, { outline: 0.05 }); torso.position.set(0, hipY + 0.45, 0.05); root.add(torso);
  for (let i = 0; i < 3; i++) { const btn = toonMesh(new THREE.SphereGeometry(0.04, 6, 5), 0xffd54a, { outline: 0.012 }); btn.position.set(0, hipY + 0.75 - i * 0.25, 0.58 - i * 0.04); root.add(btn); }
  const badge = toonMesh(new THREE.CylinderGeometry(0.1, 0.1, 0.03, 6), 0xffd54a, { outline: 0.015 }); badge.position.set(-0.32, hipY + 0.78, 0.48); badge.rotation.x = Math.PI / 2; root.add(badge);
  const belt = toonMesh(new THREE.CylinderGeometry(0.5, 0.5, 0.12, 14), 0x333333, { outline: 0.03 }); belt.position.set(0, hipY + 0.05, 0); root.add(belt);
  const buckle = toonMesh(new THREE.BoxGeometry(0.16, 0.12, 0.05), 0xffd54a, { outline: 0.02 }); buckle.position.set(0, hipY + 0.05, 0.5); root.add(buckle);
  const shoulderY = hipY + 0.88;
  const arms = [];
  for (const s of [-1, 1]) {
    const arm = new THREE.Group(); arm.position.set(s * 0.55, shoulderY, 0.02);
    arm.add(limb(V(0, 0, 0), V(s * 0.2, -0.85, 0.1), 0.1, skin, { outline: 0.04 }));
    const sl = toonMesh(new THREE.CylinderGeometry(0.16, 0.17, 0.3, 10), blue, { outline: 0.035 }); sl.position.set(s * 0.03, -0.1, 0.02); sl.rotation.z = -s * 0.3; arm.add(sl);
    const hand = toonMesh(new THREE.SphereGeometry(0.19, 12, 9), skin, { outline: 0.04 }); hand.position.set(s * 0.24, -0.97, 0.12); arm.add(hand);
    root.add(arm); arms.push(arm);
  }
  const neckY = shoulderY + 0.15;
  root.add(limb(V(0, neckY - 0.2, 0), V(0, neckY + 0.3, 0), 0.14, skin, { outline: 0.035 }));
  const head = new THREE.Group(); head.position.set(0, neckY + 0.75, 0.05); root.add(head);
  const shape = (geo) => { geo.scale(1.05, 1.1, 1); };
  const hg = new THREE.SphereGeometry(0.55, 28, 20); shape(hg);
  head.add(toonMesh(hg, skin, { outline: 0.05 }));
  head.add(faceDecal(face('kunde', 'misstrauisch', { skin: '#d9a06e', beard: 'schnauzer', seed: 88 }), 0.557, shape));
  const nose = toonMesh(new THREE.SphereGeometry(0.15, 10, 8), 0xc98a5a, { outline: 0.03 }); nose.position.set(0, -0.06, 0.56); head.add(nose);
  for (const s of [-1, 1]) { const ear = toonMesh(new THREE.SphereGeometry(0.11, 8, 6), skin, { outline: 0.03 }); ear.position.set(s * 0.57, 0, 0); head.add(ear); }
  // Mütze
  const capBody = toonMesh(new THREE.CylinderGeometry(0.52, 0.56, 0.32, 14), blue, { outline: 0.04 }); capBody.position.set(0, 0.52, -0.02); head.add(capBody);
  const capTop = toonMesh(new THREE.CylinderGeometry(0.6, 0.52, 0.12, 14), blue, { outline: 0.04 }); capTop.position.set(0, 0.74, -0.02); head.add(capTop);
  const capBrim = toonMesh(new THREE.BoxGeometry(0.55, 0.05, 0.32), 0x111111, { outline: 0.03 }); capBrim.position.set(0, 0.38, 0.58); head.add(capBrim);
  const capBadge = toonMesh(new THREE.SphereGeometry(0.08, 8, 6), 0xffd54a, { outline: 0.02 }); capBadge.position.set(0, 0.56, 0.52); head.add(capBadge);
  // Trillerpfeife an der Kordel, Pfeife im Mund wenn er pfeift
  const whistle = new THREE.Group();
  const wb = toonMesh(new THREE.CylinderGeometry(0.06, 0.06, 0.2, 8), 0xc9cfdc, { outline: 0.015 }); wb.rotation.z = Math.PI / 2; whistle.add(wb);
  const wp = toonMesh(new THREE.SphereGeometry(0.07, 8, 6), 0xc9cfdc, { outline: 0.015 }); wp.position.set(-0.1, 0.02, 0); whistle.add(wp);
  whistle.position.set(0.05, -0.2, 0.6); whistle.visible = false; head.add(whistle);
  root.add(limb(V(0.3, neckY + 0.2, 0.3), V(0.45, hipY + 0.6, 0.5), 0.015, 0xffffff, { outline: 0.008 }));
  const whistleIdle = toonMesh(new THREE.CylinderGeometry(0.06, 0.06, 0.2, 8), 0xc9cfdc, { outline: 0.015 }); whistleIdle.position.set(0.45, hipY + 0.58, 0.52); whistleIdle.rotation.z = Math.PI / 2; root.add(whistleIdle);
  const notes = [];
  for (let i = 0; i < 2; i++) {
    const n = toonMesh(new THREE.SphereGeometry(0.08, 8, 6), BLACK, { outline: 0, basic: true });
    n.geometry.scale(1.2, 0.8, 1); n.visible = false; head.add(n);
    n.add(limb(V(0.08, 0.05, 0), V(0.08, 0.32, 0), 0.02, BLACK, { outline: 0, basic: true }));
    notes.push(n);
  }
  root.userData.parts = { arms, head, whistle, whistleIdle, notes };
  return root;
}

/**
 * Baut Markt + Posten 7 in `parent`, pusht Collider. Rückgabe { spots, update(t), hideouts, setTafel(n), anchors, bounds }.
 */
export function buildMarkt(parent, colliders, { exits = { pier: true, stadt: true } } = {}) {
  const rand = rng(53);
  const add = (o) => { parent.add(o); return o; };
  paving(parent, cobbleTexture(), LANES, PLATZ);

  // ----- Markt -----
  const flies = [];
  STAENDE.forEach((s, i) => {
    const st = stand({ kind: s.kind, sign: s.sign, cloth: s.cloth, seed: 10 + i });
    st.position.set(s.x, 0, s.z); st.rotation.y = s.rot; add(st);
    if (st.userData.flies) flies.push(st.userData.flies);
  });
  for (let i = 0; i < GEDRAENGE.n; i++) {
    const a = i / GEDRAENGE.n * Math.PI * 2 + 0.3, r = GEDRAENGE.r * (0.35 + 0.5 * ((i % 3) / 2));
    const p = bystander(60 + i);
    p.position.set(GEDRAENGE.x + Math.cos(a) * r, 0, GEDRAENGE.z + Math.sin(a) * r);
    p.rotation.y = -a + Math.PI / 2 + (rand() - 0.5) * 1.0; p.scale.setScalar(0.95 + (i % 3) * 0.05);
    add(p);
  }
  const katze = cat(0x333344); katze.scale.setScalar(1.15); add(katze);
  for (const [x, z, l, sd] of [[63, -40, [-1.0, 0, 0.6], 21], [39, -63, [0.9, 0, -0.5], 22]]) {
    const p = palm({ lean: new THREE.Vector3(...l), seed: sd, height: 4.6 }); p.position.set(x, 0, z); p.scale.setScalar(1.4); add(p); colliders.push({ x, z, r: 0.63 });
    const top = p.userData.curve.getPointAt(1).multiplyScalar(1.4); p.userData.crown = { x: x + top.x, y: top.y - 0.6, z: z + top.z, r: 4.8 };
  }
  for (const [x, z] of [[40, -47], [62, -62]]) { const l = lamp(); l.position.set(x, 0, z); l.scale.setScalar(1.4); add(l); colliders.push({ x, z, r: 0.3 }); }
  // Hinweisschild „HIER NICHT SO LAUT“ (Gag 9 – der laute Typ ist ein Kunde)
  {
    const s = new THREE.Group();
    s.add(limb(V(0, 0, 0), V(0.1, 2.3, 0), 0.07, 0x7a4b22, { outline: 0.03 }));
    const b = plate('BITTE NICHT SO LAUT FRAGEN', 2.4, 0.42, { font: 'bold 56px sans-serif', tw: 1024, th: 160, thick: 0.06 });
    b.position.set(0.1, 2.3, 0); b.rotation.set(0, -0.5, 0.05); s.add(b);
    s.position.set(41.5, 0, -40.5); add(s); colliders.push({ x: 41.5, z: -40.5, r: 0.25 });
  }

  // ----- Posten 7 -----
  const P = POSTEN;
  const st = station(); st.scale.setScalar(1.5); st.position.set(P.gebaeude.x, 0, P.gebaeude.z); st.rotation.y = P.gebaeude.rot; add(st);
  const car = policeCar(); car.position.set(P.wagen.x, 0, P.wagen.z); car.rotation.y = P.wagen.rot; add(car);
  const bribe = stand({ kind: 'mango', sign: P.stand.sign, cloth: P.stand.cloth, seed: 31 }); bribe.position.set(P.stand.x, 0, P.stand.z); bribe.rotation.y = P.stand.rot; add(bribe);
  const pongObj = pong(); pongObj.position.set(P.pong.x, 0, P.pong.z); pongObj.rotation.y = P.pong.rot; add(pongObj);
  {
    const f = new THREE.Group();
    f.add(limb(V(0, 0, 0), V(0.05, 6.5, 0), 0.08, 0xeeeeee, { outline: 0.03 }));
    const flag = toonMesh(new THREE.BoxGeometry(0.06, 1.0, 1.4, 1, 4, 6), 0x2a3f8f, { outline: 0.03 });
    deform(flag.geometry, (v) => { v.x += 0.08 * Math.sin(v.z * 4); v.y -= 0.25 * Math.max(0, v.z + 0.3); }); // hängt schlaff
    flag.position.set(0.1, 5.8, 0.7); f.add(flag);
    f.position.set(P.fahne.x, 0, P.fahne.z); add(f);
  }
  {
    const b = new THREE.Group();
    const seat = toonMesh(new THREE.BoxGeometry(2.4, 0.12, 0.6), 0xd8a85a, { outline: 0.035 }); seat.position.y = 0.55; b.add(seat);
    const back = toonMesh(new THREE.BoxGeometry(2.4, 0.5, 0.1), 0xd8a85a, { outline: 0.035 }); back.position.set(0, 1.05, -0.28); back.rotation.x = -0.2; b.add(back);
    for (const s of [-1, 1]) { b.add(limb(V(s, 0, 0.2), V(s, 0.55, 0.2), 0.06, 0x7a4b22, { outline: 0.025 })); b.add(limb(V(s, 0, -0.2), V(s, 1.2, -0.3), 0.06, 0x7a4b22, { outline: 0.025 })); }
    b.position.set(P.bank.x, 0, P.bank.z); b.rotation.y = P.bank.rot; add(b);
  }
  // Absperrungen an den Ausgängen — entfallen, sobald die Nachbarzone eingehängt ist (exits.pier / exits.stadt = false)
  for (const [name, e] of Object.entries(EXITS)) {
    if (exits[name] === false) continue;
    const b = barrier(e.text); b.position.set(e.x, 0, e.z); b.rotation.y = e.rot; b.scale.setScalar(1.3); add(b);
  }
  for (const c of marktColliders(exits)) colliders.push(c);
  const hideouts = [{ x: GEDRAENGE.x, z: GEDRAENGE.z, r: GEDRAENGE.r + 0.8 }];

  // ----- Animation: Katze, Fliegen, Pong (12-s-Loop: pfeifen, Bauch kratzen, umschauen, Hände in die Hüften) -----
  const PP = pongObj.userData.parts;
  function update(t) {
    const c = catAt(t);
    katze.position.set(c.x, 0, c.z); katze.rotation.y = c.yaw;
    katze.position.y = 0.06 * Math.abs(Math.sin(t * 9));
    for (const fl of flies) fl.children.forEach((f) => { const ph = t * 7 + f.userData.phase; f.position.set(Math.cos(ph) * 0.5, Math.sin(ph * 1.7) * 0.25, Math.sin(ph) * 0.4); });
    const k = t % 12;
    const [armL, armR] = PP.arms;
    armL.rotation.set(0, 0, 0); armR.rotation.set(0, 0, 0); PP.head.rotation.set(0, 0, 0);
    PP.whistle.visible = false; PP.whistleIdle.visible = true; PP.notes.forEach((n) => { n.visible = false; });
    if (k < 3) { // pfeift (nur)
      const u = Math.min(1, k / 0.5);
      armR.rotation.x = -2.5 * u; armR.rotation.z = -0.55 * u;
      PP.whistle.visible = u >= 1; PP.whistleIdle.visible = u < 1;
      PP.head.rotation.x = -0.15 * u + 0.08 * Math.sin(k * 25) * (u >= 1 ? 1 : 0);
      PP.notes.forEach((n, i) => { const ph = (k * 1.2 + i * 0.5) % 1; n.visible = u >= 1; n.position.set(0.35 + ph * 0.6, 0.0 + ph * 0.9 + i * 0.1, 0.5); });
    } else if (k < 6) { // Bauch kratzen
      armL.rotation.x = -1.0 + 0.08 * Math.sin(k * 20); armL.rotation.z = 0.6;
      PP.head.rotation.x = 0.2;
    } else if (k < 9) { // umschauen
      PP.head.rotation.y = 0.9 * Math.sin((k - 6) * 1.4);
    } else { // Hände in die Hüften
      armL.rotation.set(0.35, 0, 0.85); armR.rotation.set(0.35, 0, -0.85);
      PP.head.rotation.x = -0.1;
    }
  }
  update(0);
  // ----- Party am Posten 7 (Pong hat Geburtstag): Partyhut, Wimpelgirlande, Luftballons, Schild — party(an) -----
  const partyG = new THREE.Group(); partyG.visible = false; add(partyG);
  {
    const hat = toonMesh(new THREE.ConeGeometry(0.34, 0.9, 10), toon(0xffffff, { map: stripeTexture(['#e8463a', '#ffd54a', '#3dd6e0', '#ff5fa2', '#e8463a', '#ffd54a'], { vertical: false }) }), { outline: 0.03 });
    hat.position.set(0, 0.95, 0); hat.rotation.z = 0.2; PP.head.add(hat); hat.visible = false; partyG.userData.hat = hat;
    const pom = toonMesh(new THREE.SphereGeometry(0.1, 8, 6), 0xffffff, { outline: 0.02 }); pom.position.set(-0.09, 0.46, 0); hat.add(pom);
    // Wimpelgirlande vom Fahnenmast zum Dach des Postens
    const a = V(P.fahne.x, 5.2, P.fahne.z), b = V(P.gebaeude.x + 2, 5.9, P.gebaeude.z - 5), mid = V((a.x + b.x) / 2, 4.6, (a.z + b.z) / 2);
    const curve = new THREE.QuadraticBezierCurve3(a, mid, b);
    partyG.add(toonMesh(new THREE.TubeGeometry(curve, 16, 0.03, 5, false), 0x222222, { outline: 0.012, shadow: false }));
    const cols = [0xe8463a, 0xffd54a, 0x3dd6e0, 0xff5fa2, 0x3bb84a];
    for (let i = 1; i < 14; i++) {
      const pt = curve.getPointAt(i / 14);
      const w = toonMesh(new THREE.ConeGeometry(0.3, 0.6, 3), cols[i % cols.length], { outline: 0.02, shadow: false });
      w.position.copy(pt); w.position.y -= 0.32; w.rotation.y = 0.5; partyG.add(w);
    }
    for (const [x, z, c] of [[P.bank.x - 1.6, P.bank.z, 0xe8463a], [P.bank.x - 1.2, P.bank.z + 0.6, 0xffd54a], [P.bank.x - 1.9, P.bank.z + 0.9, 0x3dd6e0]]) {
      partyG.add(limb(V(x, 0.6, z), V(x + 0.1, 3.2, z), 0.012, 0xffffff, { outline: 0.006 }));
      const bal = toonMesh(new THREE.SphereGeometry(0.42, 12, 9), c, { outline: 0.035, shadow: false }); bal.geometry.scale(1, 1.2, 1); bal.position.set(x + 0.1, 3.6, z); partyG.add(bal);
    }
    const sign = plate('ALLES GUTE, PONG!', 3.6, 0.6, { bg: '#ff5fa2', fg: '#ffffff', font: 'bold 66px sans-serif', tw: 1024, th: 160, thick: 0.06 });
    sign.position.set(P.gebaeude.x + 5.4, 4.4, P.gebaeude.z + 2.6); sign.rotation.set(0, Math.PI / 2, 0.05); partyG.add(sign);
    const cake = new THREE.Group(); cake.position.set(P.bank.x, 0.61, P.bank.z + 0.1);
    cake.add(toonMesh(new THREE.CylinderGeometry(0.35, 0.38, 0.22, 12), 0xffb6c8, { outline: 0.025 }));
    const cream = toonMesh(new THREE.CylinderGeometry(0.36, 0.36, 0.06, 12), 0xffffff, { outline: 0.015 }); cream.position.y = 0.13; cake.add(cream);
    cake.add(limb(V(0, 0.16, 0), V(0, 0.42, 0), 0.025, 0xffd54a, { outline: 0.01 }));
    const flame = toonMesh(new THREE.SphereGeometry(0.05, 6, 5), 0xff9f1c, { outline: 0, basic: true }); flame.position.y = 0.47; cake.add(flame);
    partyG.add(cake);
  }
  function party(an) { partyG.visible = !!an; partyG.userData.hat.visible = !!an; }
  return {
    spots: MARKT_SPOTS, update, hideouts, anchors: MARKT_ANCHORS, bounds: { minZ: WORLD_MIN_Z },
    pong: pongObj, party,                   // Pong-Figur (userData.parts) und Party-Deko an/aus
    posten: { ...POSTEN_SICHT },            // Vorplatz des Postens (Heat zählt hier doppelt)
    mangoStand: { ...MANGO_STAND },         // Bestechungs-Stand „1 MANGO = 1 GNADE“
    setTafel: st.userData.setTafel,         // Tafel „TAGE OHNE VORFALL“: untere Zeile neu malen
  };
}
