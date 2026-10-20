// Tests der reinen Spiel-Logik: node --test spiel/test/
import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  inputToDir, dirToTarget, stepPlayer, resolveCollisions, pushOutCircle, pushOutRect,
  followCamera, waddlePose, npcHeadYaw, shoreZ, angleLerp,
  WALK_SPEED, RUN_SPEED, PLAYER_RADIUS, WADE_DEPTH, WORLD, CAM_OFFSET, DEFAULT_CAM_YAW,
} from '../js/logic.js';

const close = (a, b, eps = 1e-6, msg) => assert.ok(Math.abs(a - b) < eps, msg ?? `${a} ≈ ${b}`);

// Mehrere Schritte simulieren
function run(state, input, seconds, colliders = [], dt = 1 / 60) {
  let s = state;
  for (let t = 0; t < seconds - 1e-9; t += dt) s = stepPlayer(s, input, dt, colliders);
  return s;
}
const idle = { x: 0, z: 0, yaw: 0, phase: 0, speed: 0 };

test('inputToDir: Achsen, Diagonale normiert, Kamera-Gierung', () => {
  assert.deepEqual(inputToDir({}), { x: 0, z: 0 });
  assert.deepEqual(inputToDir({ right: true }), { x: 1, z: 0 });
  assert.deepEqual(inputToDir({ up: true }), { x: 0, z: -1 });
  const d = inputToDir({ right: true, down: true });
  close(Math.hypot(d.x, d.z), 1);
  // Gegensätze heben sich auf
  assert.deepEqual(inputToDir({ left: true, right: true }), { x: 0, z: 0 });
  // Kamera um 90° gedreht: „vor“ zeigt dann nach -x
  const r = inputToDir({ up: true }, Math.PI / 2);
  close(r.x, -1); close(r.z, 0);
});

test('stepPlayer: Gehen legt ~WALK_SPEED Einheiten pro Sekunde zurück, Rennen mehr', () => {
  const w = run(idle, { dir: { x: 1, z: 0 }, run: false }, 3);
  // Anlaufphase kostet ein paar Zehntel, danach konstant
  assert.ok(w.x > WALK_SPEED * 3 - 1.0 && w.x <= WALK_SPEED * 3 + 1e-6, `gegangen: ${w.x}`);
  const r = run(idle, { dir: { x: 1, z: 0 }, run: true }, 3);
  assert.ok(r.x > w.x, 'rennen ist schneller');
  assert.ok(r.x <= RUN_SPEED * 3 + 1e-6);
  assert.ok(RUN_SPEED / WALK_SPEED < 1.5, 'Sandalen: rennen ist nur ein bisschen schneller');
});

test('stepPlayer: dreht sich in Laufrichtung, steht ohne Eingabe still', () => {
  const s = run(idle, { dir: { x: 1, z: 0 }, run: false }, 1);
  close(s.yaw, Math.PI / 2, 1e-3, 'Blick nach +x');
  const t = run(s, { dir: null, run: false }, 1);
  close(t.x, s.x, 1e-3); close(t.z, s.z, 1e-3);
  assert.equal(t.moving, false);
  close(t.speed, 0, 1e-3);
});

test('stepPlayer: Phase läuft nur beim Gehen weiter', () => {
  const s = run(idle, { dir: { x: 0, z: 1 }, run: false }, 1);
  assert.ok(s.phase > 1, 'Phase gewachsen');
  const t = run(s, { dir: null, run: false }, 1);
  assert.ok(t.phase - s.phase < 0.5, 'Phase im Stand (fast) konstant');
});

test('pushOutCircle: außerhalb unverändert, innen auf den Rand gedrückt', () => {
  const c = { x: 0, z: 0, r: 1 };
  assert.deepEqual(pushOutCircle({ x: 3, z: 0 }, 0.5, c), { x: 3, z: 0 });
  const p = pushOutCircle({ x: 0.5, z: 0 }, 0.5, c);
  close(p.x, 1.5); close(p.z, 0);
  const q = pushOutCircle({ x: 0, z: 0 }, 0.5, c); // exakt im Zentrum: irgendwohin raus
  close(Math.hypot(q.x, q.z), 1.5);
});

test('pushOutRect: Kanten, Ecken und Innenfall', () => {
  const b = { x: 0, z: 0, w: 4, d: 2 };
  assert.deepEqual(pushOutRect({ x: 5, z: 0 }, 0.5, b), { x: 5, z: 0 });
  const p = pushOutRect({ x: 2.2, z: 0 }, 0.5, b); // rechte Kante bei x=2
  close(p.x, 2.5); close(p.z, 0);
  const e = pushOutRect({ x: 2.2, z: 1.2 }, 0.5, b); // Ecke (2,1)
  close(Math.hypot(e.x - 2, e.z - 1), 0.5);
  const i = pushOutRect({ x: 1.8, z: 0.2 }, 0.5, b); // innen, rechte Kante am nächsten
  close(i.x, 2.5); close(i.z, 0.2);
});

test('resolveCollisions: Spieler bleibt vor Palme und Hütte stehen', () => {
  const colliders = [{ x: 5, z: 0, r: 0.5 }, { x: 0, z: -8, w: 6, d: 4 }];
  const s = run(idle, { dir: { x: 1, z: 0 }, run: true }, 3, colliders);
  close(s.x, 5 - 0.5 - PLAYER_RADIUS, 1e-6, 'vor der Palme');
  const n = run(idle, { dir: { x: 0, z: -1 }, run: false }, 3, colliders);
  close(n.z, -6 + PLAYER_RADIUS, 1e-6, 'vor der Hütte');
});

test('resolveCollisions: an der Hütte entlang rutschen statt kleben', () => {
  const b = { x: 0, z: -8, w: 6, d: 4 };
  let s = { ...idle, z: -5 };
  for (let i = 0; i < 120; i++) {
    s = stepPlayer(s, { dir: { x: 0.7071, z: -0.7071 }, run: false }, 1 / 60, [b]);
    // nie eindringen: Abstand zum Rechteck mindestens Spielerradius
    const cx = Math.max(b.x - 3, Math.min(s.x, b.x + 3)), cz = Math.max(b.z - 2, Math.min(s.z, b.z + 2));
    assert.ok(Math.hypot(s.x - cx, s.z - cz) >= PLAYER_RADIUS - 1e-6, `Schritt ${i}: in der Hütte`);
  }
  assert.ok(s.x > 3, 'seitlich weitergekommen (um die Ecke herum)');
});

test('Ufer: bis knöcheltief ins Wasser, nicht weiter; Welt-Grenzen halten', () => {
  const s = run(idle, { dir: { x: 0, z: 1 }, run: true }, 10);
  close(s.z, shoreZ(s.x) + WADE_DEPTH, 1e-6, 'an der Wasserkante');
  const w = run(idle, { dir: { x: -1, z: 0 }, run: true }, 30);
  close(w.x, WORLD.minX + PLAYER_RADIUS);
  const n = run(idle, { dir: { x: 0, z: -1 }, run: true }, 30);
  close(n.z, WORLD.minZ + PLAYER_RADIUS);
});

test('shoreZ: Sichel — Mitte weiter im Land als die Ränder, stetig', () => {
  const mid = shoreZ(0), left = shoreZ(WORLD.minX), right = shoreZ(WORLD.maxX);
  assert.ok(mid > left && mid > right);
  for (let x = WORLD.minX; x < WORLD.maxX; x += 0.5) assert.ok(Math.abs(shoreZ(x + 0.5) - shoreZ(x)) < 0.3);
});

test('dirToTarget: Richtung normiert, null am Ziel', () => {
  const d = dirToTarget({ x: 0, z: 0 }, { x: 3, z: 4 });
  close(d.x, 0.6); close(d.z, 0.8);
  assert.equal(dirToTarget({ x: 3, z: 4 }, { x: 3.1, z: 4 }), null);
  assert.equal(dirToTarget({ x: 0, z: 0 }, null), null);
});

test('Klick-Ziel: Spieler kommt an und bleibt stehen', () => {
  let s = idle;
  const target = { x: 6, z: 3 };
  for (let i = 0; i < 600; i++) s = stepPlayer(s, { dir: dirToTarget(s, target), run: false }, 1 / 60);
  assert.ok(Math.hypot(s.x - target.x, s.z - target.z) < 0.4);
  close(s.speed, 0, 1e-3);
});

test('followCamera: konvergiert auf Offset hinter/über dem Spieler, schaut aufs Ziel', () => {
  let cam = { x: 0, y: 0, z: 0, tx: 0, ty: 0, tz: 0 };
  const p = { x: 10, z: 5 };
  for (let i = 0; i < 600; i++) cam = followCamera(cam, p, 1 / 60);
  close(cam.x, 10, 1e-3); close(cam.z, 5 + CAM_OFFSET.back, 1e-3); close(cam.y, CAM_OFFSET.up, 1e-3);
  close(cam.tx, 10, 1e-3); close(cam.tz, 5 - CAM_OFFSET.lookAhead, 1e-3);
  // mit Kamera-Gierung 90°: Kamera steht seitlich
  let c2 = { ...cam };
  for (let i = 0; i < 600; i++) c2 = followCamera(c2, p, 1 / 60, Math.PI / 2);
  close(c2.x, 10 + CAM_OFFSET.back, 1e-3); close(c2.z, 5, 1e-3);
  // Standard-Gierung: Kamera im Süden (+z), schaut nach Norden; „hoch“ läuft nach Norden (Karte oben)
  let c3 = { ...cam };
  for (let i = 0; i < 600; i++) c3 = followCamera(c3, p, 1 / 60, DEFAULT_CAM_YAW);
  close(c3.z, 5 + CAM_OFFSET.back, 1e-3); close(c3.tz, 5 - CAM_OFFSET.lookAhead, 1e-3);
  const up = inputToDir({ up: true }, DEFAULT_CAM_YAW);
  close(up.x, 0, 1e-9); close(up.z, -1, 1e-9);
});

test('followCamera: sanft — ein Schritt bewegt nur einen Teil', () => {
  const cam = { x: 0, y: 0, z: 0, tx: 0, ty: 0, tz: 0 };
  const c = followCamera(cam, { x: 100, z: 0 }, 1 / 60);
  assert.ok(c.x > 0 && c.x < 100 * 0.2);
});

test('waddlePose: Beine gegenläufig, im Stand alles null', () => {
  const still = waddlePose(1.2, 0);
  close(still.legL, 0); close(still.bob, 0); close(still.sway, 0);
  const p = waddlePose(Math.PI / 2, WALK_SPEED);
  close(p.legL, -p.legR); close(p.armL, -p.armR);
  assert.ok(p.legL > 0.3);
  const r = waddlePose(Math.PI / 2, RUN_SPEED, true);
  assert.ok(r.legL > p.legL && r.lean > p.lean, 'rennen = mehr Ausschlag, mehr Vorlage');
});

test('npcHeadYaw: dreht zum Spieler, aber nicht über die Schulter hinaus', () => {
  const npc = { x: 0, z: 0, yaw: 0 }; // schaut nach +z
  close(npcHeadYaw(npc, { x: 0, z: 10 }), 0);
  close(npcHeadYaw(npc, { x: 5, z: 5 }), Math.PI / 4);
  close(npcHeadYaw(npc, { x: 0, z: -10 }), 1.1, 1e-6, 'hinter ihm: Anschlag');
  close(npcHeadYaw(npc, { x: -10, z: 0.001 }), -1.1);
});

test('angleLerp: nimmt den kurzen Weg über ±π', () => {
  const a = angleLerp(Math.PI - 0.1, -Math.PI + 0.1, 0.5);
  close(Math.abs(Math.atan2(Math.sin(a), Math.cos(a))), Math.PI, 1e-6);
});
