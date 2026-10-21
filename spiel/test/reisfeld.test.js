// Tests von Reisfeld + Kokoshain: node --test spiel/test/
import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  REISFELD, FELDER, LANES, NOK, BUEFFEL, VOGELSCHEUCHE, HUETTE, PROPS, REISFELD_SPOTS, REISFELD_ANCHORS, LANE_WIDTH,
  KOKOSHAIN, PALMEN, PALME_R, HAIN_LANES, HAIN_VERSTECK, HAIN_SPOTS, HAIN_ANCHORS,
  reisfeldColliders, hainColliders, inFeld, laneLength,
} from '../js/zone-reisfeld-layout.js';
import { rectsOverlap, segmentColliderDistance, reachableWaypoints, LANES as DORF_LANES } from '../js/zone-dorf-layout.js';
import { LANES as MARKT_LANES, POSTEN, WORLD_MIN_Z } from '../js/zone-markt-layout.js';
import { LANES as PIER_LANES, pierColliders } from '../js/zone-pier-layout.js';
import { huegelHeight } from '../js/zone-huegel-layout.js';
import { resolveCollisions, PLAYER_RADIUS } from '../js/logic.js';

const world = { minX: -66, maxX: 100, minZ: WORLD_MIN_Z };
const free = (colliders, x, z, what) => {
  const q = resolveCollisions({ x, z }, PLAYER_RADIUS, colliders, world);
  assert.ok(Math.hypot(q.x - x, q.z - z) < 1e-6, `${what} (${x}, ${z}) blockiert`);
};

test('Reisfeld: Felder überlappen nicht, liegen flach (kein Hang) und in den Bounds; Nok, Büffel, Vogelscheuche stehen im Wasser', () => {
  for (let i = 0; i < FELDER.length; i++) {
    for (let j = i + 1; j < FELDER.length; j++) assert.ok(!rectsOverlap(FELDER[i], FELDER[j]), `Felder ${i}/${j} überlappen`);
    const f = FELDER[i];
    for (const [x, z] of [[f.x - f.w / 2, f.z - f.d / 2], [f.x + f.w / 2, f.z + f.d / 2]]) {
      assert.ok(x >= REISFELD.minX && x <= REISFELD.maxX && z >= REISFELD.minZ && z <= REISFELD.maxZ, `Feld ${i} ragt aus den Bounds`);
      assert.ok(huegelHeight(x, z) < 0.05, `Feld ${i} liegt am Hang bei (${x}, ${z})`);
      assert.ok(z > WORLD_MIN_Z + 1, `Feld ${i} liegt außerhalb der Welt`);
    }
  }
  assert.ok(inFeld(NOK.x, NOK.z) && inFeld(BUEFFEL.x, BUEFFEL.z) && inFeld(VOGELSCHEUCHE.x, VOGELSCHEUCHE.z));
  assert.ok(!inFeld(HUETTE.x, HUETTE.z));
});

test('Reisfeld: Dämme ≥ 3 breit, Zufahrt läuft am Posten vorbei, Netz hängt am Posten-Weg', () => {
  // Posten-Gebäude und Pier-Kulissen zählen als Nachbar-Collider mit
  const posten = { x: POSTEN.gebaeude.x, z: POSTEN.gebaeude.z, w: POSTEN.gebaeude.d + 0.2, d: POSTEN.gebaeude.w + 0.2 }; // rot π/2: w/d getauscht
  const colliders = [...reisfeldColliders(), posten, { x: POSTEN.pong.x, z: POSTEN.pong.z, r: POSTEN.pong.r }];
  for (const [name, pts] of Object.entries(LANES)) {
    for (let i = 1; i < pts.length; i++) for (const c of colliders) {
      const d = segmentColliderDistance(pts[i - 1], pts[i], c);
      assert.ok(d >= LANE_WIDTH / 2, `Engstelle in „${name}“ Abschnitt ${i}: ${d.toFixed(2)} zu ${JSON.stringify(c)}`);
    }
  }
  const all = { ...DORF_LANES, ...MARKT_LANES, ...PIER_LANES, ...LANES, ...HAIN_LANES };
  const reach = reachableWaypoints([0, -24], all);
  const total = Object.values(all).flat().length;
  assert.equal(reach.length, total, `nur ${reach.length} von ${total} Wegpunkten erreichbar`);
  const len = laneLength();
  assert.ok(len > 150 && len < 260, `Dammlänge ${len.toFixed(0)}`);
});

test('Reisfeld: Spots, Anker und Wegpunkte frei', () => {
  const colliders = reisfeldColliders();
  for (const pts of Object.values(LANES)) for (const [x, z] of pts) free(colliders, x, z, 'Wegpunkt');
  for (const [n, s] of Object.entries(REISFELD_SPOTS)) free(colliders, s.x, s.z, `Spot ${n}`);
  for (const a of REISFELD_ANCHORS) { assert.equal(a.zone, 'reisfeld'); free(colliders, a.x, a.z, `Anker ${a.id}`); }
  assert.equal(new Set(REISFELD_ANCHORS.map((a) => a.id)).size, REISFELD_ANCHORS.length);
  for (const p of PROPS) assert.ok(p.x >= REISFELD.minX - 1 && p.x <= REISFELD.maxX + 1);
});

test('Kokoshain: Palmen in der Ecke, Weg hält Abstand, Versteck liegt zwischen den Palmen, einer klettert', () => {
  const colliders = [...hainColliders(), ...pierColliders()];
  for (const p of PALMEN) assert.ok(p.x >= KOKOSHAIN.minX && p.x <= KOKOSHAIN.maxX && p.z >= KOKOSHAIN.minZ && p.z <= KOKOSHAIN.maxZ, `Palme (${p.x}, ${p.z}) außerhalb`);
  for (let i = 0; i < PALMEN.length; i++) for (let j = i + 1; j < PALMEN.length; j++) assert.ok(Math.hypot(PALMEN[i].x - PALMEN[j].x, PALMEN[i].z - PALMEN[j].z) > 3, 'Palmen zu dicht');
  for (const [name, pts] of Object.entries(HAIN_LANES)) {
    for (let i = 1; i < pts.length; i++) for (const c of colliders) {
      const d = segmentColliderDistance(pts[i - 1], pts[i], c);
      assert.ok(d >= LANE_WIDTH / 2, `Engstelle in „${name}“ Abschnitt ${i}: ${d.toFixed(2)} zu ${JSON.stringify(c)}`);
    }
  }
  const V = HAIN_VERSTECK;
  const near = PALMEN.filter((p) => Math.hypot(p.x - V.x, p.z - V.z) < V.r + 4).length;
  assert.ok(near >= 3, 'Versteck liegt nicht zwischen Palmen');
  for (const p of PALMEN) assert.ok(Math.hypot(p.x - V.x, p.z - V.z) > PALME_R + 1.0, 'Palme steht im Versteck');
  free(colliders, V.x, V.z, 'Versteck');
  for (const [n, s] of Object.entries(HAIN_SPOTS)) free(colliders, s.x, s.z, `Spot ${n}`);
  for (const a of HAIN_ANCHORS) free(colliders, a.x, a.z, `Anker ${a.id}`);
  assert.equal(PALMEN.filter((p) => p.kletterer).length, 1);
});
