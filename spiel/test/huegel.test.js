// Tests des Mentor-Hügels (Kiffer-Kuppe): node --test spiel/test/
import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  H, PLATEAU, RAMP, RAMP_H, HECKE_LUECKE, HUETTE, BEETE, ZAUN, PROPS, HUEGEL_SPOTS,
  huegelHeight, moundHeight, rampHeight, rampNearest, slopeBetween, rampLength, huegelColliders,
} from '../js/zone-huegel-layout.js';
import { resolveCollisions, PLAYER_RADIUS } from '../js/logic.js';
import { segmentColliderDistance, LANE_WIDTH, EDGES } from '../js/zone-dorf-layout.js';

test('Höhe: 0 am Strand und außerhalb, H auf der Kuppe, dazwischen monoton fallend', () => {
  assert.equal(huegelHeight(0, 0), 0);
  assert.equal(huegelHeight(-20, -10), 0);
  assert.ok(Math.abs(huegelHeight(PLATEAU.x, PLATEAU.z) - H) < 1e-9);
  assert.ok(Math.abs(huegelHeight(PLATEAU.x + 8, PLATEAU.z) - H) < 1e-9, 'Kuppe ist flach');
  let last = H;
  for (let x = PLATEAU.x; x >= PLATEAU.x - 40; x -= 1) {
    const h = moundHeight(x, PLATEAU.z);
    assert.ok(h <= last + 1e-9 && h >= 0, `Hang steigt wieder bei x=${x}`);
    last = h;
  }
  assert.equal(moundHeight(PLATEAU.x - 40, PLATEAU.z), 0);
});

test('Serpentine: beginnt in der Heckenlücke am Boden, endet auf der Kuppe, Weghöhe steigt', () => {
  const [x0, z0] = RAMP[0];
  assert.ok(x0 > HECKE_LUECKE.from && x0 < HECKE_LUECKE.to, 'Weg beginnt nicht in der Lücke');
  assert.equal(RAMP_H[0], 0);
  assert.equal(RAMP_H[RAMP_H.length - 1], H);
  for (let i = 1; i < RAMP_H.length; i++) assert.ok(RAMP_H[i] >= RAMP_H[i - 1]);
  const [xe, ze] = RAMP[RAMP.length - 1];
  assert.ok(Math.abs(huegelHeight(xe, ze) - H) < 1e-9, 'Wegende liegt nicht auf der Kuppe');
  assert.ok(rampHeight(x0, z0 + 5) === 0, 'neben dem Anfang ist Boden');
});

test('Serpentine: Steigung entlang des Weges bleibt gehbar (< 0.35) und nirgends geht es bergab', () => {
  const step = 0.5;
  for (let i = 1; i < RAMP.length; i++) {
    const [ax, az] = RAMP[i - 1], [bx, bz] = RAMP[i];
    const len = Math.hypot(bx - ax, bz - az);
    for (let s = 0; s + step <= len + 1e-9; s += step) {
      const a = [ax + (bx - ax) * s / len, az + (bz - az) * s / len];
      const b = [ax + (bx - ax) * (s + step) / len, az + (bz - az) * (s + step) / len];
      const sl = slopeBetween(a, b);
      assert.ok(sl >= -1e-6, `bergab bei (${b[0].toFixed(1)}, ${b[1].toFixed(1)}): ${sl.toFixed(3)}`);
      assert.ok(sl < 0.35, `zu steil bei (${b[0].toFixed(1)}, ${b[1].toFixed(1)}): ${sl.toFixed(3)}`);
    }
  }
  const len = rampLength();
  assert.ok(len > 40 && len < 90, `Weglänge ${len.toFixed(0)}`); // ≈ 10–22 s gehen
});

test('Weg ist quer zur Laufrichtung eben genug (kein Kippen über die Böschung in Wegmitte)', () => {
  for (let i = 1; i < RAMP.length; i++) {
    const [ax, az] = RAMP[i - 1], [bx, bz] = RAMP[i];
    const mx = (ax + bx) / 2, mz = (az + bz) / 2;
    const n = rampNearest(mx, mz);
    assert.ok(n.dist < 1e-6);
    const len = Math.hypot(bx - ax, bz - az), nx = -(bz - az) / len, nz = (bx - ax) / len;
    const hl = huegelHeight(mx + nx * 1.5, mz + nz * 1.5), hr = huegelHeight(mx - nx * 1.5, mz - nz * 1.5), hm = huegelHeight(mx, mz);
    assert.ok(Math.abs(hl - hm) < 0.6 && Math.abs(hr - hm) < 0.6, `Weg kippt bei Abschnitt ${i}`);
  }
});

test('Hütte, Beete, Zaun und Kleinkram stehen auf der Kuppe', () => {
  const onTop = (x, z, what) => assert.ok(huegelHeight(x, z) > H - 0.05, `${what} (${x}, ${z}) steht am Hang: ${huegelHeight(x, z).toFixed(2)}`);
  onTop(HUETTE.x, HUETTE.z, 'Hütte');
  for (const b of BEETE) onTop(b.x, b.z, 'Beet');
  for (const [x, z] of [[ZAUN.minX, ZAUN.minZ], [ZAUN.maxX, ZAUN.minZ], [ZAUN.maxX, ZAUN.maxZ], [ZAUN.minX, ZAUN.maxZ]]) onTop(x, z, 'Zaunecke');
  for (const p of PROPS) onTop(p.x, p.z, p.kind);
  for (const [name, s] of Object.entries(HUEGEL_SPOTS)) if (name !== 'serpentine') onTop(s.x, s.z, `Spot ${name}`);
});

test('Kuppe ist erreichbar: Wegende und Spots nicht blockiert, Weg hält Abstand zu Collidern', () => {
  const colliders = huegelColliders();
  const world = { minX: -66, maxX: 66, minZ: -80 };
  for (const [x, z] of RAMP) {
    const q = resolveCollisions({ x, z }, PLAYER_RADIUS, colliders, world);
    assert.ok(Math.hypot(q.x - x, q.z - z) < 1e-6, `Wegpunkt (${x}, ${z}) blockiert`);
  }
  for (const [name, s] of Object.entries(HUEGEL_SPOTS)) {
    const q = resolveCollisions({ x: s.x, z: s.z }, PLAYER_RADIUS, colliders, world);
    assert.ok(Math.hypot(q.x - s.x, q.z - s.z) < 1e-6, `Spot ${name} blockiert`);
  }
  for (let i = 1; i < RAMP.length; i++) {
    for (const c of colliders) {
      const d = segmentColliderDistance(RAMP[i - 1], RAMP[i], c);
      assert.ok(d >= LANE_WIDTH / 2, `Serpentine Abschnitt ${i} zu nah an ${JSON.stringify(c)}: ${d.toFixed(2)}`);
    }
  }
  // Heckenlücke der Serpentine ist nicht von den Dorf-Rändern zugebaut
  for (const e of EDGES) {
    const d = segmentColliderDistance(RAMP[0], RAMP[1], e);
    assert.ok(d >= 1.0, `Heckenrand ${JSON.stringify(e)} blockiert die Serpentine`);
  }
});

test('Garten: Beete liegen im Zaun, Mentor und Vogelscheuche auch, Tor frei', () => {
  for (const b of BEETE) assert.ok(b.x > ZAUN.minX + 1 && b.x < ZAUN.maxX - 1 && b.z > ZAUN.minZ + 1 && b.z < ZAUN.maxZ - 1, 'Beet außerhalb');
  const vs = PROPS.find((p) => p.kind === 'vogelscheuche');
  assert.ok(vs.x > ZAUN.minX && vs.x < ZAUN.maxX && vs.z > ZAUN.minZ && vs.z < ZAUN.maxZ);
  assert.ok(ZAUN.gate.z1 - ZAUN.gate.z0 >= 2.4, 'Tor zu schmal');
});
