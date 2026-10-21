// ereignisse.js — Requisiten für Tages-Ereignisse, je als An/Aus mit Zeitfunktion (Bewegung: ereignisse-logik.js):
//   moeweMitBeutel()  → Möwe schnappt sich den Beutel und fliegt aufs Meer hinaus: start({x, z}, dir), update(t)
//   regenwolke()      → dunkle Wolke mit Schauer zieht von West nach Ost über den Strand: start(), update(t)
//   kreuzfahrtschiff() → weißer Dampfer wandert am Horizont, nachts mit Lichtern: start(), update(t)
// Jede Gruppe hat userData.an (bool), userData.start(…), userData.stop(), userData.update(t) mit t in Sekunden
// (absolute Uhr; der Startzeitpunkt wird intern gemerkt). Party am Posten: zone-markt.js (party(an)),
// dunkle Bar bei Stromausfall: licht.js (stromausfall(an)).
import * as THREE from 'three';
import { mergeGeometries } from 'three/addons/utils/BufferGeometryUtils.js';
import { toonMesh, toon, deform, rng, textTexture, BLACK } from './toon.js';
import { limb, gull } from './props.js';
import { moeweFlug, wolkenPos, schiffPos } from './ereignisse-logik.js';

const V = (x, y, z) => new THREE.Vector3(x, y, z);

function ereignis(g, { onStart, onUpdate, onStop }) {
  g.userData.an = false; g.userData.t0 = 0; g.visible = false;
  g.userData.start = (...args) => { g.userData.an = true; g.userData.t0 = null; g.userData.args = args; g.visible = true; onStart?.(...args); };
  g.userData.stop = () => { g.userData.an = false; g.visible = false; onStop?.(); };
  g.userData.update = (t) => {
    if (!g.userData.an) return false;
    if (g.userData.t0 === null) g.userData.t0 = t;
    const fertig = onUpdate(t - g.userData.t0, t);
    if (fertig) g.userData.stop();
    return !fertig;
  };
  return g;
}

// ---------- Möwe mit Beutel ----------
export function moeweMitBeutel() {
  const g = new THREE.Group();
  const bird = gull(); bird.scale.setScalar(1.6); g.add(bird);
  const wings = bird.children.filter((m) => m.geometry?.type === 'BoxGeometry');
  // zweiter Flügel + Beutel im Schnabel
  const wing2 = toonMesh(new THREE.BoxGeometry(0.4, 0.04, 0.2), 0xc9cfdc, { outline: 0.015 }); wing2.position.set(-0.05, 0.08, 0); bird.add(wing2); wings.push(wing2);
  wings.forEach((w, i) => { w.position.z = i === 0 ? 0.12 : -0.12; w.geometry = new THREE.BoxGeometry(0.5, 0.04, 0.24); w.geometry.translate(0, 0, i === 0 ? 0.12 : -0.12); w.position.z = 0; });
  const bag = toonMesh(new THREE.SphereGeometry(0.16, 10, 8), 0x8b5a2b, { outline: 0.03 }); bag.geometry.scale(1, 1.3, 1); bag.position.set(0.5, -0.1, 0); bird.add(bag);
  const knot = toonMesh(new THREE.SphereGeometry(0.06, 6, 5), 0x5a3b1a, { outline: 0.015 }); knot.position.set(0.47, 0.12, 0); bird.add(knot);
  const schrei = new THREE.Mesh(new THREE.PlaneGeometry(1.6, 0.6), new THREE.MeshBasicMaterial({ map: textTexture('KRÄÄH!', { bg: 'rgba(0,0,0,0)', fg: '#1a1a1a', font: 'bold 100px sans-serif', w: 512, h: 190 }), transparent: true, depthWrite: false }));
  schrei.position.set(0.3, 0.9, 0.2); g.add(schrei);
  g.userData.noFade = true;
  let from = { x: 0, z: 0 }, dir = { x: 0.3, z: 1 };
  return ereignis(g, {
    onStart: (f, d) => { from = f ?? from; dir = d ?? dir; },
    onUpdate: (t) => {
      const p = moeweFlug(t, from, dir);
      g.position.set(p.x, p.y, p.z); g.rotation.y = p.yaw - Math.PI / 2;
      wings.forEach((w, i) => { w.rotation.x = (i === 0 ? -1 : 1) * 0.7 * p.flap; });
      g.rotation.z = 0.15 * p.flap;
      schrei.visible = t < 1.6; schrei.lookAt(g.position.x, g.position.y + 10, g.position.z - 20);
      return p.fertig;
    },
  });
}

// ---------- Regenwolke mit Schauer ----------
export function regenwolke() {
  const g = new THREE.Group();
  const rand = rng(83);
  const blobs = [[0, 0, 0, 2.6], [2.6, 0.4, 0.3, 2.0], [-2.7, 0.2, -0.2, 1.9], [1.0, 1.4, 0, 1.7], [-1.0, 1.3, 0.2, 1.5], [4.2, -0.2, 0.1, 1.4], [-4.3, -0.1, -0.1, 1.3]];
  for (const [x, y, z, r] of blobs) { const b = toonMesh(new THREE.SphereGeometry(r * (0.9 + rand() * 0.2), 14, 10), 0x7a8294, { outline: 0.1, shadow: false, basic: true }); b.position.set(x, y, z); g.add(b); }
  const base = toonMesh(new THREE.SphereGeometry(1, 18, 8), 0x626a7c, { outline: 0.1, shadow: false, basic: true }); base.geometry.scale(5.5, 0.9, 1.6); base.position.y = -1.0; g.add(base);
  // Regen: viele dünne Striche als eine Geometrie, laufen in einer Schleife nach unten
  const drops = [];
  for (let i = 0; i < 220; i++) {
    const d = new THREE.CylinderGeometry(0.02, 0.02, 0.9 + rand() * 0.6, 3);
    d.translate((rand() - 0.5) * 10, -rand() * 16, (rand() - 0.5) * 3.2); drops.push(d);
  }
  const rain = new THREE.Mesh(mergeGeometries(drops, false), new THREE.MeshBasicMaterial({ color: 0xbfe6ff, transparent: true, opacity: 0.7, depthWrite: false }));
  rain.position.y = -1.5; g.add(rain);
  const rain2 = rain.clone(); rain2.position.y = -1.5 - 16; g.add(rain2);
  // Pfütze/Spritzer am Boden: flacher heller Ring, folgt der Wolke
  const splash = new THREE.Mesh(new THREE.RingGeometry(1.5, 5.5, 24), new THREE.MeshBasicMaterial({ color: 0xbfe6ff, transparent: true, opacity: 0.25, depthWrite: false, side: THREE.DoubleSide }));
  splash.rotation.x = -Math.PI / 2; g.add(splash);
  g.userData.noFade = true;
  return ereignis(g, {
    onUpdate: (t) => {
      const p = wolkenPos(t);
      g.position.set(p.x, p.y, p.z);
      const off = (t * 9) % 16;
      rain.position.y = -1.5 - off; rain2.position.y = -1.5 - off + 16;
      rain.material.opacity = rain2.material.opacity = 0.7 * p.regen;
      splash.position.y = -p.y + 0.08; splash.material.opacity = 0.25 * p.regen; splash.scale.setScalar(1 + 0.06 * Math.sin(t * 7));
      return p.fertig;
    },
  });
}

// ---------- Kreuzfahrtschiff am Horizont ----------
export function kreuzfahrtschiff() {
  const g = new THREE.Group();
  const hullGeo = new THREE.BoxGeometry(26, 4, 7, 8, 1, 1);
  deform(hullGeo, (v) => { const t = (v.x + 13) / 26; if (t > 0.8) v.z *= 1 - 0.8 * (t - 0.8) / 0.2; if (v.y < 0) v.z *= 0.6; if (t > 0.92) v.y += 0.8; });
  const hull = toonMesh(hullGeo, 0x2a3f8f, { outline: 0.12, shadow: false }); hull.position.y = 1.5; g.add(hull);
  const decks = [[22, 2.2, 6.4, 4.6], [18, 2.0, 5.6, 6.7], [13, 1.8, 4.8, 8.6]];
  for (const [w, h, d, y] of decks) {
    const deck = toonMesh(new THREE.BoxGeometry(w, h, d), 0xffffff, { outline: 0.1, shadow: false }); deck.position.set(-1, y, 0); g.add(deck);
    for (const s of [-1, 1]) for (let i = 0; i < Math.floor(w / 1.3); i++) {
      const win = toonMesh(new THREE.BoxGeometry(0.6, 0.6, 0.1), 0x7fd8ff, { outline: 0, shadow: false });
      win.position.set(-1 - w / 2 + 0.9 + i * 1.3, y, s * (d / 2 + 0.05)); win.userData.nachtlicht = { color: 0xffe08a, staerke: 1.0, tag: 0x7fd8ff }; g.add(win);
    }
  }
  const funnel = toonMesh(new THREE.CylinderGeometry(1.0, 1.2, 3.2, 10), 0xe8463a, { outline: 0.1, shadow: false }); funnel.position.set(-6, 11.2, 0); funnel.rotation.z = 0.1; g.add(funnel);
  const band = toonMesh(new THREE.CylinderGeometry(1.05, 1.05, 0.5, 10), 0x111111, { outline: 0.05, shadow: false }); band.position.set(-6, 12.6, 0); g.add(band);
  const bridge = toonMesh(new THREE.BoxGeometry(5, 1.6, 5.2), 0xffffff, { outline: 0.08, shadow: false }); bridge.position.set(5, 10.5, 0); g.add(bridge);
  g.add(limb(V(9, 11.2, 0), V(9.2, 15.5, 0), 0.12, 0x555566, { outline: 0.05 }));
  const flag = toonMesh(new THREE.BoxGeometry(2.0, 1.2, 0.08), 0xffd54a, { outline: 0.05, shadow: false }); flag.position.set(8.1, 14.6, 0); g.add(flag);
  const smoke = [];
  for (let i = 0; i < 3; i++) { const p = toonMesh(new THREE.SphereGeometry(0.9, 8, 6), 0xd8d8e0, { outline: 0.08, shadow: false, basic: true }); p.userData.phase = i / 3; g.add(p); smoke.push(p); }
  const horn = new THREE.Mesh(new THREE.PlaneGeometry(7, 2.6), new THREE.MeshBasicMaterial({ map: textTexture('TUUUUUT', { bg: 'rgba(0,0,0,0)', fg: '#1a1a1a', font: 'bold 110px sans-serif', w: 512, h: 190 }), transparent: true, depthWrite: false }));
  horn.position.set(-6, 17, 0); horn.visible = false; g.add(horn);
  g.userData.noFade = true;
  return ereignis(g, {
    onUpdate: (t) => {
      const p = schiffPos(t);
      g.position.set(p.x, 0, p.z); g.rotation.z = p.roll; g.rotation.y = Math.PI; // fährt nach Westen, Bug voran
      smoke.forEach((s) => { const u = ((t * 0.3) + s.userData.phase) % 1; s.position.set(-6 - u * 6, 13 + u * 4, 0); s.scale.setScalar(0.6 + u * 1.6); });
      horn.visible = p.horn; horn.rotation.y = Math.PI;
      return p.fertig;
    },
  });
}
