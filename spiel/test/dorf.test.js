// Tests des Dorf-Grundrisses (Krummgassen): node --test spiel/test/
import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  HOUSES, LANES, EXITS, PROPS, DORF, LANE_WIDTH, DORF_SPOTS,
  footprintAABB, footprintCorners, rectsOverlap, segmentColliderDistance, pointSegmentDistance,
  dorfColliders, laneClearance, laneLength, reachableWaypoints, hillHeight,
} from '../js/zone-dorf-layout.js';
import { resolveCollisions, PLAYER_RADIUS } from '../js/logic.js';

test('footprintAABB: ungedreht = Grundriss + Rand, um 90° gedreht tauschen Breite und Tiefe', () => {
  const a = footprintAABB({ x: 0, z: 0, rot: 0 }, { w: 6, d: 4, margin: 0 });
  assert.deepEqual(a, { x: 0, z: 0, w: 6, d: 4 });
  const b = footprintAABB({ x: 0, z: 0, rot: Math.PI / 2 }, { w: 6, d: 4, margin: 0 });
  assert.ok(Math.abs(b.w - 4) < 1e-9 && Math.abs(b.d - 6) < 1e-9);
  // leichte Drehung macht den Umriss größer, nie kleiner
  const c = footprintAABB({ x: 0, z: 0, rot: 0.1 }, { w: 6, d: 4, margin: 0 });
  assert.ok(c.w > 6 && c.d > 4);
});

test('segmentColliderDistance: Rechteck und Kreis, innen = 0', () => {
  const r = { x: 0, z: 0, w: 4, d: 2 };
  assert.equal(segmentColliderDistance([-5, 0], [5, 0], r), 0);          // schneidet
  assert.equal(segmentColliderDistance([-1, 0], [1, 0], r), 0);          // liegt drin
  assert.ok(Math.abs(segmentColliderDistance([-5, 3], [5, 3], r) - 2) < 1e-9); // parallel oberhalb
  assert.ok(Math.abs(segmentColliderDistance([5, 5], [6, 5], { x: 0, z: 0, r: 1 }) - (Math.hypot(5, 5) - 1)) < 1e-9);
  assert.ok(Math.abs(pointSegmentDistance([0, 1], [-1, 0], [1, 0]) - 1) < 1e-9);
});

test('Häuser überlappen sich nicht (als achsenparallele Umrisse, wie sie der Collider sieht)', () => {
  const boxes = HOUSES.map((h) => ({ id: h.id, ...footprintAABB(h) }));
  for (let i = 0; i < boxes.length; i++) {
    for (let j = i + 1; j < boxes.length; j++) {
      assert.ok(!rectsOverlap(boxes[i], boxes[j]), `${boxes[i].id} überlappt ${boxes[j].id}`);
    }
  }
});

test('Häuser und Kleinkram liegen im Dorf-Rechteck und nicht im Hügel', () => {
  for (const h of HOUSES) {
    for (const [x, z] of footprintCorners(h)) {
      assert.ok(x >= DORF.minX - 0.6 && x <= DORF.maxX && z >= DORF.minZ && z <= DORF.maxZ, `${h.id} ragt aus dem Dorf (${x}, ${z})`);
      assert.ok(hillHeight(x, z) < 1.2, `${h.id} steht im Hang bei (${x.toFixed(1)}, ${z.toFixed(1)}): ${hillHeight(x, z).toFixed(2)}`);
    }
  }
  for (const p of PROPS) assert.ok(hillHeight(p.x, p.z) < 0.6, `${p.kind} bei (${p.x}, ${p.z}) steht im Hang`);
  for (const e of Object.values(EXITS)) assert.ok(hillHeight(e.x, e.z) < 0.6, `Absperrung ${e.text} steht im Hang`);
});

test('Kleinkram steht nicht in einem Haus', () => {
  const boxes = HOUSES.map((h) => ({ id: h.id, ...footprintAABB(h) }));
  for (const p of PROPS) {
    for (const b of boxes) {
      const dx = Math.max(0, Math.abs(p.x - b.x) - b.w / 2), dz = Math.max(0, Math.abs(p.z - b.z) - b.d / 2);
      assert.ok(Math.hypot(dx, dz) >= p.r, `${p.kind} (${p.x}, ${p.z}) steckt in Haus ${b.id}`);
    }
  }
});

test(`jede Gasse bleibt mindestens ${LANE_WIDTH} Einheiten breit`, () => {
  const c = laneClearance();
  assert.ok(c.dist >= LANE_WIDTH / 2, `Engstelle in Gasse „${c.lane}“: ${c.dist.toFixed(2)} zu ${JSON.stringify(c.collider)}`);
});

test('Wegenetz hängt zusammen: vom Eingang sind alle Wegpunkte und beide Ausgänge erreichbar', () => {
  const reach = reachableWaypoints([0, -24]);
  const all = Object.values(LANES).flat();
  assert.equal(reach.length, all.length, `nur ${reach.length} von ${all.length} Wegpunkten erreichbar`);
  const near = (p, q) => Math.hypot(p[0] - q[0], p[1] - q[1]) < 3;
  assert.ok(reach.some((p) => near(p, [EXITS.markt.x, EXITS.markt.z])), 'Ausgang Markt nicht am Netz');
  assert.ok(reach.some((p) => near(p, [EXITS.posten.x, EXITS.posten.z])), 'Ausgang Posten 7 nicht am Netz');
});

test('Gesamtlänge der Gassen: in 30–50 s durchlaufbar (4 Einheiten/s)', () => {
  const len = laneLength();
  assert.ok(len >= 120 && len <= 200, `Gassenlänge ${len.toFixed(0)} Einheiten`);
});

test('Spieler passt auf jeden Wegpunkt, ohne rausgedrückt zu werden', () => {
  const colliders = dorfColliders();
  const world = { minX: -66, maxX: 66, minZ: -80 };
  for (const [name, pts] of Object.entries(LANES)) {
    for (const [x, z] of pts) {
      const q = resolveCollisions({ x, z }, PLAYER_RADIUS, colliders, world);
      assert.ok(Math.hypot(q.x - x, q.z - z) < 1e-6, `Wegpunkt (${x}, ${z}) in „${name}“ ist blockiert`);
    }
  }
  for (const [name, s] of Object.entries(DORF_SPOTS)) {
    const q = resolveCollisions({ x: s.x, z: s.z }, PLAYER_RADIUS, colliders, world);
    assert.ok(Math.hypot(q.x - s.x, q.z - s.z) < 1e-6, `Startpunkt „${name}“ ist blockiert`);
  }
});
