// island.js — die Insel als „Bühne": lumpige Sandscheibe im Wasser, Graspatch, Hügel, Felsen, Schaum.
import * as THREE from 'three';
import { toonMesh, toon, deform, rng } from './toon.js';

export const WATER_Y = -0.35;

// Radialer Faktor nach Winkel → unregelmäßiger Inselrand (deterministisch)
function lumpFactor(a, k = 1) {
  return 1 + 0.10 * Math.sin(3 * a + 1.3 * k) + 0.06 * Math.sin(7 * a + 0.4 * k) + 0.035 * Math.sin(12 * a + 2.1 * k);
}
function lumpify(geometry, k = 1) {
  return deform(geometry, (v) => {
    const r = Math.hypot(v.x, v.z);
    if (r < 1e-3) return;
    const a = Math.atan2(v.z, v.x);
    const f = lumpFactor(a, k);
    v.x *= f; v.z *= f;
  });
}

export function buildIsland() {
  const g = new THREE.Group();
  g.name = 'island';
  const rand = rng(7);

  // Wasser: riesige Scheibe, eine Toon-Stufe = flache Farbe
  const water = toonMesh(new THREE.CircleGeometry(320, 64), 0x1d9be6, { outline: 0, shadow: false });
  water.rotation.x = -Math.PI / 2;
  water.position.y = WATER_Y;
  water.receiveShadow = true;
  g.add(water);

  // Inselkörper: oben Sand, Seite Erdbraun, unten egal
  const body = new THREE.CylinderGeometry(13, 11.2, 1.7, 72, 1);
  lumpify(body, 1);
  body.scale(1, 1, 0.78);
  body.translate(0, -0.85, 0);
  const sand = toon(0xf7d984);
  const earth = toon(0xb9733c);
  const island = toonMesh(body, [earth, sand, earth], { outline: 0.06 });
  g.add(island);

  // Schaumkranz ums Ufer (gleiche Lumpen-Funktion)
  const foamGeo = new THREE.RingGeometry(12.75, 13.45, 72, 1);
  foamGeo.rotateX(-Math.PI / 2);
  lumpify(foamGeo, 1);
  foamGeo.scale(1, 1, 0.78);
  const foam = toonMesh(foamGeo, 0xeaf9ff, { outline: 0, shadow: false, basic: true });
  foam.position.y = WATER_Y + 0.01;
  g.add(foam);

  // Wellenringe im Wasser
  for (let i = 0; i < 9; i++) {
    const r = 15.5 + i * 2.6 + rand() * 1.2;
    const start = rand() * Math.PI * 2;
    const len = 0.5 + rand() * 1.2;
    const wave = new THREE.RingGeometry(r, r + 0.16, 32, 1, start, len);
    wave.rotateX(-Math.PI / 2);
    wave.scale(1.1, 1, 0.8);
    const m = toonMesh(wave, 0xdff4ff, { outline: 0, shadow: false, basic: true });
    m.position.y = WATER_Y + 0.01;
    g.add(m);
  }

  // Graspatch hinten
  const grassGeo = new THREE.CylinderGeometry(7.4, 7.9, 0.32, 56, 1);
  lumpify(grassGeo, 3);
  grassGeo.scale(1.3, 1, 0.72);
  const grass = toonMesh(grassGeo, [toon(0x4cae3c), toon(0x5fc74a), toon(0x4cae3c)], { outline: 0.05 });
  grass.position.set(-0.5, 0.16, -4.8);
  g.add(grass);

  // Hügel hinten links
  const hillGeo = new THREE.SphereGeometry(4.2, 22, 14);
  hillGeo.scale(1.35, 0.6, 1.0);
  const hill = toonMesh(hillGeo, 0x3f9d37, { outline: 0.06 });
  hill.position.set(-7, 0.1, -6.3);
  g.add(hill);

  // Felsen (kantig, low-poly)
  const rockSpots = [[11.5, -2.5, 0.9], [10.8, -4.2, 0.6], [-11.6, -3.5, 1.0], [-12.2, 2, 0.5]];
  for (const [x, z, s] of rockSpots) {
    const rg = new THREE.SphereGeometry(s, 6, 5);
    deform(rg, (v) => { v.multiplyScalar(0.85 + 0.3 * rand()); });
    rg.scale(1.2, 0.8, 1);
    const rock = toonMesh(rg, 0x8d8fa0, { outline: 0.05 });
    rock.position.set(x, 0.1, z);
    rock.rotation.y = rand() * 3;
    g.add(rock);
  }

  // Sandhaufen / Buckel am Strand
  for (const [x, z, s] of [[-3.5, 7.2, 1.1], [4.5, 7.6, 0.8], [-6.5, 6.5, 0.9]]) {
    const sg = new THREE.SphereGeometry(s, 14, 8);
    sg.scale(1.4, 0.35, 1);
    const mound = toonMesh(sg, 0xf7d984, { outline: 0.04 });
    mound.position.set(x, -0.05, z);
    g.add(mound);
  }

  return g;
}
