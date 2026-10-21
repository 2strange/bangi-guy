// Tests von Mango-Markt + Posten 7: node --test spiel/test/
import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  STAENDE, GEDRAENGE, CAT_PATH, LANES, EXITS, POSTEN, MARKT, MARKT_SPOTS, MARKT_ANCHORS, POSTEN_SICHT, MANGO_STAND, WORLD_MIN_Z, LANE_WIDTH,
  standCollider, marktColliders, laneLength, catAt,
} from '../js/zone-markt-layout.js';
import { rectsOverlap, segmentColliderDistance, reachableWaypoints, LANES as DORF_LANES, EXITS as DORF_EXITS, dorfColliders } from '../js/zone-dorf-layout.js';
import { resolveCollisions, PLAYER_RADIUS } from '../js/logic.js';
import { huegelHeight } from '../js/zone-huegel-layout.js';

test('Stände überlappen sich nicht und stehen im Marktbereich', () => {
  const boxes = STAENDE.map((s) => ({ id: s.id, ...standCollider(s) }));
  for (let i = 0; i < boxes.length; i++) {
    for (let j = i + 1; j < boxes.length; j++) assert.ok(!rectsOverlap(boxes[i], boxes[j]), `${boxes[i].id} überlappt ${boxes[j].id}`);
    const b = boxes[i];
    assert.ok(b.x - b.w / 2 >= MARKT.minX && b.x + b.w / 2 <= MARKT.maxX && b.z - b.d / 2 >= MARKT.minZ && b.z + b.d / 2 <= MARKT.maxZ, `${b.id} ragt aus dem Markt`);
    const g = GEDRAENGE;
    const dx = Math.max(0, Math.abs(g.x - b.x) - b.w / 2), dz = Math.max(0, Math.abs(g.z - b.z) - b.d / 2);
    assert.ok(Math.hypot(dx, dz) >= g.r + 1.0, `${b.id} steckt im Gedränge`);
  }
});

test('Wege bleiben ≥ 3 breit, auch gegenüber Dorf-Collidern', () => {
  const colliders = [...marktColliders(), ...dorfColliders().filter((c) => c.w === undefined || !(c.x === DORF_EXITS.markt.x || c.x === DORF_EXITS.posten.x))];
  for (const [name, pts] of Object.entries(LANES)) {
    for (let i = 1; i < pts.length; i++) {
      for (const c of colliders) {
        const d = segmentColliderDistance(pts[i - 1], pts[i], c);
        assert.ok(d >= LANE_WIDTH / 2, `Engstelle in „${name}“ Abschnitt ${i}: ${d.toFixed(2)} zu ${JSON.stringify(c)}`);
      }
    }
  }
});

test('Wegenetz: Markt und Posten hängen am Dorf (Marktgasse bzw. Nordgasse) und aneinander (Ring)', () => {
  const all = { ...DORF_LANES, ...LANES };
  const reach = reachableWaypoints([0, -24], all);
  const total = Object.values(all).flat().length;
  assert.equal(reach.length, total, `nur ${reach.length} von ${total} Wegpunkten erreichbar`);
  const near = (p, q) => Math.hypot(p[0] - q[0], p[1] - q[1]) < 3;
  assert.ok(reach.some((p) => near(p, [EXITS.pier.x, EXITS.pier.z])) || reach.some((p) => near(p, [46, -40])), 'Marktplatz nicht am Netz');
  assert.ok(reach.some((p) => near(p, [EXITS.stadt.x, EXITS.stadt.z])), 'Nordausgang nicht am Netz');
  const len = laneLength();
  assert.ok(len > 60 && len < 140, `Weglänge ${len.toFixed(0)}`);
});

test('Spieler passt auf jeden Wegpunkt, Spot und Anker; nichts liegt auf dem Hügel', () => {
  const colliders = marktColliders();
  const world = { minX: -66, maxX: 66, minZ: WORLD_MIN_Z };
  const free = (x, z, what) => {
    const q = resolveCollisions({ x, z }, PLAYER_RADIUS, colliders, world);
    assert.ok(Math.hypot(q.x - x, q.z - z) < 1e-6, `${what} (${x}, ${z}) blockiert`);
  };
  for (const pts of Object.values(LANES)) for (const [x, z] of pts) free(x, z, 'Wegpunkt');
  for (const [name, s] of Object.entries(MARKT_SPOTS)) free(s.x, s.z, `Spot ${name}`);
  assert.ok(MARKT_ANCHORS.length >= 6 && MARKT_ANCHORS.length <= 8);
  for (const a of MARKT_ANCHORS) { free(a.x, a.z, `Anker ${a.id}`); assert.ok(a.zone === 'markt'); }
  assert.equal(new Set(MARKT_ANCHORS.map((a) => a.id)).size, MARKT_ANCHORS.length, 'Anker-ids doppelt');
  // Posten-Sicht deckt Pong, Mango-Stand und Straße vor dem Posten ab
  const inSicht = (x, z) => Math.hypot(x - POSTEN_SICHT.x, z - POSTEN_SICHT.z) <= POSTEN_SICHT.r;
  assert.ok(inSicht(POSTEN.pong.x, POSTEN.pong.z) && inSicht(MANGO_STAND.x, MANGO_STAND.z) && inSicht(8, -78));
  for (const s of STAENDE) assert.ok(huegelHeight(s.x, s.z) === 0);
  assert.ok(POSTEN.gebaeude.z - POSTEN.gebaeude.w / 2 > WORLD_MIN_Z, 'Posten liegt außerhalb der Nordgrenze');
  assert.ok(EXITS.stadt.z > WORLD_MIN_Z, 'Nordabsperrung liegt außerhalb der Welt');
});

test('Katze: läuft ihre Runde frei von Collidern und kommt wieder am Start an', () => {
  const colliders = marktColliders();
  for (let i = 1; i < CAT_PATH.length; i++) {
    for (const c of colliders) {
      const d = segmentColliderDistance(CAT_PATH[i - 1], CAT_PATH[i], c);
      assert.ok(d > 0.2, `Katzenweg Abschnitt ${i} läuft durch ${JSON.stringify(c)}`);
    }
  }
  const a = catAt(0), b = catAt(1000 / 1.6 * 0 + 0.001);
  assert.ok(Math.hypot(a.x - CAT_PATH[0][0], a.z - CAT_PATH[0][1]) < 1e-9);
  assert.ok(Math.hypot(a.x - b.x, a.z - b.z) < 0.01);
  const total = CAT_PATH.slice(1).reduce((acc, p, i) => acc + Math.hypot(p[0] - CAT_PATH[i][0], p[1] - CAT_PATH[i][1]), 0);
  const full = catAt(total / 1.6);
  assert.ok(Math.hypot(full.x - CAT_PATH[0][0], full.z - CAT_PATH[0][1]) < 1e-6, 'Runde endet nicht am Start');
});
