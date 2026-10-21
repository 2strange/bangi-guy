// Tests der Zone Tuk-Tuk-Pier: node --test spiel/test/
import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  PIER, LANES, EXITS, PROPS, STEG, FERRY, FERRY_SPAWN, FURT, PIER_SPOTS, PIER_ANCHORS, WORLD_MAX_X, LANE_WIDTH, SHORE_Z, HUEGEL_OST,
  pierColliders, allColliders, ferryAt, ferryDocked, furtDepthLimit, stegDepthLimit, laneLength,
} from '../js/zone-pier-layout.js';
import { segmentColliderDistance, reachableWaypoints, LANES as DORF_LANES } from '../js/zone-dorf-layout.js';
import { LANES as MARKT_LANES, EXITS as MARKT_EXITS } from '../js/zone-markt-layout.js';
import { resolveCollisions, PLAYER_RADIUS, WADE_DEPTH } from '../js/logic.js';

test('Wege bleiben ≥ 3 breit (Kulissen + Hügelkreise), Zufahrt beginnt an der Markt-Absperrung', () => {
  const colliders = allColliders();
  for (const [name, pts] of Object.entries(LANES)) {
    for (let i = 1; i < pts.length; i++) for (const c of colliders) {
      const d = segmentColliderDistance(pts[i - 1], pts[i], c);
      assert.ok(d >= LANE_WIDTH / 2, `Engstelle in „${name}“ Abschnitt ${i}: ${d.toFixed(2)} zu ${JSON.stringify(c)}`);
    }
  }
  assert.deepEqual(LANES.hafen_zufahrt[0], [MARKT_EXITS.pier.x, MARKT_EXITS.pier.z]);
  const len = laneLength();
  assert.ok(len > 60 && len < 130, `Weglänge ${len.toFixed(0)}`); // ≈ 25 s gehen inkl. Platzquerung
});

test('Wegenetz: Pier hängt über die Markt-Zufahrt am Dorf', () => {
  const all = { ...DORF_LANES, ...MARKT_LANES, ...LANES };
  const reach = reachableWaypoints([0, -24], all);
  const total = Object.values(all).flat().length;
  assert.equal(reach.length, total, `nur ${reach.length} von ${total} Wegpunkten erreichbar`);
});

test('Spots, Anker, Wegpunkte und Fähren-Spawn sind frei und liegen in der Zone', () => {
  const colliders = allColliders();
  const world = { minX: -66, maxX: WORLD_MAX_X, minZ: -98 };
  const free = (x, z, what) => {
    const q = resolveCollisions({ x, z }, PLAYER_RADIUS, colliders, world);
    assert.ok(Math.hypot(q.x - x, q.z - z) < 1e-6, `${what} (${x}, ${z}) blockiert`);
  };
  for (const pts of Object.values(LANES)) for (const [x, z] of pts) if (z < SHORE_Z) free(x, z, 'Wegpunkt');
  for (const [name, s] of Object.entries(PIER_SPOTS)) if (s.z < SHORE_Z) free(s.x, s.z, `Spot ${name}`);
  for (const a of PIER_ANCHORS) {
    assert.equal(a.zone, 'pier');
    if (a.z < SHORE_Z) free(a.x, a.z, `Anker ${a.id}`);
    assert.ok(a.x >= PIER.minX && a.x <= PIER.maxX, `Anker ${a.id} außerhalb`);
  }
  assert.equal(new Set(PIER_ANCHORS.map((a) => a.id)).size, PIER_ANCHORS.length);
  // Fähren-Spawn liegt im Wasserbereich (Steg) — nur gegen Collider prüfen, die Ufer-Klammer regelt stegDepthLimit
  for (const c of colliders) {
    const d = c.r !== undefined ? Math.hypot(c.x - FERRY_SPAWN.x, c.z - FERRY_SPAWN.z) - c.r
      : Math.hypot(Math.max(0, Math.abs(FERRY_SPAWN.x - c.x) - c.w / 2), Math.max(0, Math.abs(FERRY_SPAWN.z - c.z) - c.d / 2));
    assert.ok(d >= PLAYER_RADIUS, `Fähren-Spawn steckt in ${JSON.stringify(c)}`);
  }
  for (const p of PROPS) assert.ok(p.x >= PIER.minX && p.x <= PIER.maxX && p.z >= PIER.minZ && p.z <= PIER.maxZ, `${p.kind} außerhalb`);
  for (const e of Object.values(EXITS)) assert.ok(e.x < WORLD_MAX_X);
});

test('Fähre: kommt von Osten, legt am Steg an, tutet vorher, fährt wieder, ist dazwischen weg; Bewegung stetig', () => {
  const F = FERRY;
  assert.equal(ferryAt(0).state, 'approach');
  assert.ok(ferryAt(0).x > F.dockX + 30);
  assert.equal(ferryAt(F.approach + 1).state, 'docked');
  assert.ok(ferryDocked(F.approach + F.wait / 2));
  assert.ok(ferryAt(F.approach - 1.5).horn, 'tutet nicht vor dem Anlegen');
  assert.equal(ferryAt(F.approach + F.wait + F.leave + 1).state, 'away');
  // Anleger liegt am Stegende, Spawn auf dem Steg
  assert.ok(Math.abs(F.dockZ - STEG.z1) < 4 && F.dockX > STEG.x);
  assert.ok(Math.abs(FERRY_SPAWN.x - STEG.x) <= STEG.w / 2 + 2.5 && FERRY_SPAWN.z > STEG.z0 && FERRY_SPAWN.z < STEG.z1);
  let last = ferryAt(0);
  for (let t = 0.1; t <= F.period + 0.1; t += 0.1) {
    const f = ferryAt(t);
    const d = Math.hypot(f.x - last.x, f.z - last.z);
    assert.ok(d < 2.0, `Sprung bei t=${t.toFixed(1)}: ${d.toFixed(2)}`);
    last = f;
  }
});

test('Furt und Steg: Sandalen dürfen bei der Furt tiefer, auf dem Steg bis zum Stegende, sonst knöcheltief', () => {
  assert.equal(furtDepthLimit(50), SHORE_Z + WADE_DEPTH);
  assert.equal(furtDepthLimit((FURT.x0 + FURT.x1) / 2), FURT.maxZ);
  assert.ok(FURT.maxZ > SHORE_Z + WADE_DEPTH);
  for (const [x, z] of FURT.stones) assert.ok(x >= FURT.x0 && x <= FURT.x1 && z > SHORE_Z && z <= FURT.maxZ, 'Trittstein außerhalb der Furt');
  assert.equal(stegDepthLimit(STEG.x), STEG.z1);
  assert.equal(stegDepthLimit(STEG.x + STEG.w), SHORE_Z + WADE_DEPTH);
  // Steg-Geländer halten den Spieler auf dem Steg
  const colliders = pierColliders();
  const q = resolveCollisions({ x: STEG.x + STEG.w / 2 - 0.05, z: 16 }, PLAYER_RADIUS, colliders, { minX: -66, maxX: WORLD_MAX_X, minZ: -98 });
  assert.ok(q.x < STEG.x + STEG.w / 2 - 0.4, 'Geländer hält nicht');
  const mid = resolveCollisions({ x: STEG.x, z: 16 }, PLAYER_RADIUS, colliders, { minX: -66, maxX: WORLD_MAX_X, minZ: -98 });
  assert.ok(Math.abs(mid.x - STEG.x) < 1e-9, 'Stegmitte wird verschoben');
});

test('Hügelkreise decken den Kokoshain-Hügel ab und lassen die Zufahrt frei', () => {
  for (const c of HUEGEL_OST.circles) assert.ok(Math.abs(c.z - HUEGEL_OST.z) < 1e-9);
  const span = Math.max(...HUEGEL_OST.circles.map((c) => c.x + c.r)) - Math.min(...HUEGEL_OST.circles.map((c) => c.x - c.r));
  assert.ok(span >= 50, 'Hügel zu schmal abgedeckt');
});
