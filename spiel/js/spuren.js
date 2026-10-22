// spuren.js — Fußspuren im Sand: ein Pool flacher Ebenen mit Canvas-Texturen je Schuhwerk (Sandale, Turnschuh, Flip-Flop,
// barfuß, Gummistiefel). Logik (wann/wo eine Spur entsteht, Alter) steckt rein in logic.js (spurSchritt, spurAlter);
// hier nur Darstellung: Ringpuffer, Deckkraft verblasst mit dem Alter, Spiegelung für links/rechts.
import * as THREE from 'three';
import { SPUR, spurAlter } from './logic.js';

const ARTEN = ['sandale', 'turnschuh', 'flipflop', 'barfuss', 'gummistiefel'];
const art = (schuhe) => (schuhe === 'sandalen' ? 'sandale' : ARTEN.includes(schuhe) ? schuhe : 'barfuss');

// Abdruck als Textur (Zehen nach unten = Laufrichtung +z nach dem Umklappen der Ebene)
function textur(kind) {
  const c = document.createElement('canvas'); c.width = 64; c.height = 128;
  const g = c.getContext('2d');
  g.fillStyle = '#5b4426';
  const oval = (x, y, rx, ry) => { g.beginPath(); g.ellipse(x, y, rx, ry, 0, 0, Math.PI * 2); g.fill(); };
  const rechteck = (x, y, w, h, r = 10) => { g.beginPath(); g.roundRect(x, y, w, h, r); g.fill(); };
  if (kind === 'barfuss') { oval(32, 50, 17, 36); for (let i = 0; i < 5; i++) oval(14 + i * 9, 104 - Math.abs(i - 1) * 3, 4.5 - i * 0.4, 5.5 - i * 0.4); }
  else if (kind === 'sandale') { oval(32, 64, 20, 50); g.globalCompositeOperation = 'destination-out'; rechteck(8, 40, 48, 7, 2); rechteck(8, 86, 48, 7, 2); g.globalCompositeOperation = 'source-over'; }
  else if (kind === 'flipflop') { oval(32, 64, 21, 52); g.globalCompositeOperation = 'destination-out'; g.lineWidth = 5; g.strokeStyle = '#000'; g.beginPath(); g.moveTo(32, 92); g.lineTo(32, 60); g.lineTo(12, 40); g.moveTo(32, 60); g.lineTo(52, 40); g.stroke(); g.globalCompositeOperation = 'source-over'; }
  else if (kind === 'gummistiefel') { rechteck(10, 8, 44, 112, 14); }
  else { rechteck(12, 6, 40, 116, 16); g.globalCompositeOperation = 'destination-out'; for (let i = 0; i < 6; i++) rechteck(16, 20 + i * 16, 32, 5, 2); g.globalCompositeOperation = 'source-over'; } // Turnschuh: Profilrillen
  const t = new THREE.CanvasTexture(c); t.colorSpace = THREE.SRGBColorSpace; t.needsUpdate = true;
  return t;
}

/** Pool anlegen: add(spur) nimmt eine Spur aus logic.spurSchritt, update(now, groundY) blendet nach Alter aus */
export function createSpuren(scene, { max = SPUR.max } = {}) {
  const texturen = Object.fromEntries(ARTEN.map((k) => [k, textur(k)]));
  const mats = Object.fromEntries(ARTEN.map((k) => [k, new THREE.MeshBasicMaterial({ map: texturen[k], transparent: true, opacity: 0.7, depthWrite: false })]));
  const geo = new THREE.PlaneGeometry(0.42, 0.84); // etwa Fußgröße der Figuren, gut lesbar
  const pool = [];
  for (let i = 0; i < max; i++) {
    const m = new THREE.Mesh(geo, mats.barfuss.clone());
    m.rotation.x = -Math.PI / 2; m.visible = false; m.renderOrder = 1; m.userData.noFade = true;
    const g = new THREE.Group(); g.add(m); g.visible = false; scene.add(g);
    pool.push({ g, m, spur: null });
  }
  let next = 0;
  function add(spur, y = 0) {
    const slot = pool[next]; next = (next + 1) % pool.length;
    slot.spur = spur;
    slot.g.position.set(spur.x, y + 0.012, spur.z); slot.g.rotation.y = spur.yaw; slot.g.visible = true; slot.m.visible = true;
    slot.m.material.map = texturen[art(spur.schuhe)]; slot.m.material.needsUpdate = true;
    slot.m.scale.x = spur.seite < 0 ? -1 : 1; // linker Fuß gespiegelt
  }
  function update(now) {
    for (const slot of pool) {
      if (!slot.spur) continue;
      const a = spurAlter(slot.spur, now);
      if (a >= 1) { slot.spur = null; slot.g.visible = false; continue; }
      slot.m.material.opacity = 0.7 * (1 - a) * (1 - a);
    }
  }
  function clear() { for (const slot of pool) { slot.spur = null; slot.g.visible = false; } }
  return { add, update, clear, pool };
}
