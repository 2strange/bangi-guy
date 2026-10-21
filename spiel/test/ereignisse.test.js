// Tests der Ereignis-Bewegungen: node --test spiel/test/
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { MOEWE, moeweFlug, WOLKE, wolkenPos, SCHIFF, schiffPos, flackern } from '../js/ereignisse-logik.js';

test('Möwe: startet am Beutel, steigt, fliegt in Flugrichtung weg und ist nach dauer fertig', () => {
  const from = { x: -20, z: 3 };
  const a = moeweFlug(0, from);
  assert.ok(Math.abs(a.x - from.x) < 1e-9 && Math.abs(a.z - from.z) < 1e-9 && !a.fertig);
  const m = moeweFlug(MOEWE.dauer / 2, from);
  assert.ok(m.y > a.y + 3, 'steigt nicht');
  const e = moeweFlug(MOEWE.dauer, from);
  assert.ok(e.fertig && e.z > from.z + MOEWE.weite * 0.8, 'fliegt nicht aufs Meer');
  const w = moeweFlug(2, from, { x: -1, z: 0 });
  assert.ok(w.x < from.x && Math.abs(w.yaw - Math.atan2(-1, 0)) < 1e-9, 'Richtung wird nicht beachtet');
  let last = moeweFlug(0, from);
  for (let t = 0.05; t <= MOEWE.dauer; t += 0.05) { const p = moeweFlug(t, from); assert.ok(Math.hypot(p.x - last.x, p.y - last.y, p.z - last.z) < 1.5, `Sprung bei t=${t}`); last = p; }
});

test('Regenwolke: zieht von West nach Ost, Regen blendet ein und aus, Höhe bleibt über den Dächern', () => {
  assert.ok(wolkenPos(0).x <= WOLKE.x0 + 1e-9 && wolkenPos(0).regen === 0);
  assert.ok(wolkenPos(WOLKE.dauer / 2).regen === 1);
  assert.ok(wolkenPos(WOLKE.dauer).x >= WOLKE.x1 - 1e-9 && wolkenPos(WOLKE.dauer).fertig);
  for (let t = 0; t <= WOLKE.dauer; t += 1) assert.ok(wolkenPos(t).y > 15, 'Wolke zu tief');
  assert.ok(wolkenPos(10).x < wolkenPos(20).x);
});

test('Schiff: am Horizont weit draußen, wandert Ost → West, tutet jede Minute kurz', () => {
  assert.ok(schiffPos(0).z >= 120, 'Schiff zu nah');
  assert.ok(schiffPos(0).x > schiffPos(SCHIFF.dauer / 2).x && schiffPos(SCHIFF.dauer / 2).x > schiffPos(SCHIFF.dauer).x);
  assert.ok(schiffPos(SCHIFF.dauer).fertig);
  assert.ok(schiffPos(0.5).horn && !schiffPos(10).horn && schiffPos(60.5).horn);
  assert.ok(Math.abs(schiffPos(3).roll) < 0.05);
});

test('Kerzenflackern bleibt in 0.7…1.0', () => {
  for (let t = 0; t < 20; t += 0.1) for (let i = 0; i < 4; i++) { const f = flackern(t, i); assert.ok(f >= 0.7 - 1e-9 && f <= 1.0 + 1e-9); }
});
