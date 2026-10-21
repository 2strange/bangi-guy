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
  // Standard-Gierung: Kamera im Norden (-z), schaut nach Süden aufs Meer; „hoch“ läuft Richtung Meer
  let c3 = { ...cam };
  for (let i = 0; i < 600; i++) c3 = followCamera(c3, p, 1 / 60, DEFAULT_CAM_YAW);
  close(c3.z, 5 - CAM_OFFSET.back, 1e-3); close(c3.tz, 5 + CAM_OFFSET.lookAhead, 1e-3);
  const up = inputToDir({ up: true }, DEFAULT_CAM_YAW);
  close(up.x, 0, 1e-9); close(up.z, 1, 1e-9);
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

// ---------- Verdeckung ----------
import { segmentPointDistance, isOccluder, cameraTargetPos } from '../js/logic.js';

test('segmentPointDistance: auf, neben und hinter der Strecke', () => {
  const a = { x: 0, y: 0, z: 0 }, b = { x: 10, y: 0, z: 0 };
  close(segmentPointDistance(a, b, { x: 5, y: 0, z: 0 }), 0);
  close(segmentPointDistance(a, b, { x: 5, y: 3, z: 4 }), 5);
  close(segmentPointDistance(a, b, { x: 13, y: 0, z: 4 }), 5, 1e-6, 'hinter dem Ende: Abstand zum Endpunkt');
});

test('isOccluder: Objekt auf der Sichtlinie ja, daneben nein, direkt vor der Linse ja', () => {
  const cam = { x: 0, y: 13, z: -13 }, target = { x: 0, y: 1.4, z: 0 };
  assert.equal(isOccluder(cam, target, { x: 0, y: 6, z: -6.5, r: 1.5 }), true, 'mitten auf der Linie');
  assert.equal(isOccluder(cam, target, { x: 6, y: 6, z: -6.5, r: 1.5 }), false, 'seitlich daneben');
  assert.equal(isOccluder(cam, target, { x: 2, y: 12, z: -12, r: 0.5 }), true, 'direkt vor der Linse');
  // der Spieler selbst (am Zielpunkt) zählt nicht, weil die Strecke vorher endet
  assert.equal(isOccluder(cam, target, { x: 0, y: 1.4, z: 0, r: 0.6 }), false, 'Ziel selbst');
});

test('isOccluder: Szene „mitte“ — Wegweiser steht NICHT zwischen Kamera und Spieler', () => {
  // Spieler bei (6, 5), Kamera im Norden (Standard-Gierung), Wegweiser bei (4, -1), Bretter bis ~2.6 hoch
  const player = { x: 6, z: 5 };
  const cam = cameraTargetPos(player, DEFAULT_CAM_YAW);
  close(cam.z, 5 - CAM_OFFSET.back);
  const target = { x: 6, y: 1.4, z: 5 };
  const signpost = { x: 4, y: 1.5, z: -1, r: 1.4 };
  assert.equal(isOccluder(cam, target, signpost), false, 'Strahl läuft hoch über dem Wegweiser');
  // ein Wegweiser direkt vor dem Spieler ist bei 45° Kamera noch 3 Einheiten unter dem Strahl → auch kein Verdecker
  assert.equal(isOccluder(cam, target, { x: 6, y: 1.5, z: 1.5, r: 1.4 }), false);
  // eine Palmenkrone (Mitte 5 hoch) auf der Sichtlinie verdeckt
  assert.equal(isOccluder(cam, target, { x: 6, y: 5, z: 1.0, r: 1.5 }), true);
});

// ---------- Gebäudemaßstab ----------
import { FIGURE_HEIGHT, BUILDING_SCALES, BUILDING_BASE, buildingHeight, doorHeight, scaledRect, scaledCircle } from '../js/logic.js';

test('Gebäude sind mindestens 1,5 × Figurenhöhe, Türen figurengroß', () => {
  assert.deepEqual(Object.keys(BUILDING_SCALES).sort(), Object.keys(BUILDING_BASE).sort(), 'jeder Typ hat Skala + Basis');
  assert.equal(BUILDING_SCALES.bar, 1.5); assert.equal(BUILDING_SCALES.hotel, 1.5);
  assert.equal(BUILDING_SCALES.rental, 2.1); assert.equal(BUILDING_SCALES.hut, 2.1);
  for (const name of Object.keys(BUILDING_BASE)) {
    assert.ok(buildingHeight(name) >= 1.5 * FIGURE_HEIGHT, `${name}: ${buildingHeight(name)} < ${1.5 * FIGURE_HEIGHT}`);
    if (BUILDING_BASE[name].door > 0) assert.ok(doorHeight(name) >= FIGURE_HEIGHT, `${name}: Tür ${doorHeight(name)} zu niedrig`);
  }
});

test('scaledRect/scaledCircle: Offsets und Maße wachsen mit dem Gebäude', () => {
  const o = { x: -28, z: -6 };
  assert.deepEqual(scaledRect(o, 1.5, 0, 0.4, 5, 2.2), { x: -28, z: -5.4, w: 7.5, d: 3.3000000000000003 });
  const c = scaledCircle(o, 1.5, -2.1, -1.1, 0.25);
  close(c.x, -31.15); close(c.z, -7.65); close(c.r, 0.375);
});

test('isOccluder: Palmenkrone neben der Sichtlinie — Kugel mit Blattlängen-Radius fängt sie, kleine Kugel nicht', () => {
  // Szene „dorf“ (alter Punkt) mit Kamera von Süden: Spieler (0, −16), Kamera (0, 13, −3); Palme bei (2, −9),
  // Krone ca. (2.8, 6.3, −7.7) — im Bild hing sie massiv vor der Figur, Abstand zur Sichtlinie 3.6
  const cam = { x: 0, y: 13, z: -3 }, head = { x: 0, y: 2.5, z: -16 };
  const crown = { x: 2.8, y: 6.3, z: -7.7, r: 4.8 };
  assert.equal(isOccluder(cam, head, { ...crown, r: 2.0 }, { margin: 0.4 }), false, 'als kompakter Ball kein Verdecker');
  assert.equal(isOccluder(cam, head, crown, { margin: 0.4 }), true, 'mit Blattlängen-Radius ein Verdecker');
  // weit abseits bleibt sie unsichtbar für die Regel
  assert.equal(isOccluder(cam, head, { ...crown, x: 20 }, { margin: 0.4 }), false);
});

// ---------- Welt-Grenze gegen das Dorf-Layout ----------
import { DORF } from '../js/zone-dorf-layout.js';
import { WORLD_MIN_Z as MARKT_MIN_Z, MARKT, POSTEN } from '../js/zone-markt-layout.js';
test('WORLD.minZ reicht bis Posten 7 (Markt-Layout) und damit über Dorf und Markt hinaus', () => {
  assert.equal(WORLD.minZ, MARKT_MIN_Z, 'Nordgrenze = Markt-Layout');
  assert.ok(WORLD.minZ <= DORF.minZ && WORLD.minZ <= MARKT.minZ, 'Dorf und Markt liegen innerhalb');
  assert.ok(WORLD.minZ <= POSTEN.gebaeude.z - POSTEN.gebaeude.d / 2, 'Posten-Gebäude innerhalb');
});

// ---------- Gebäude vs. Promenade, Joystick ----------
import { PROMENADE, BUILDING_POS, buildingFootprints, rectsOverlap, joystickInput, rotateDir } from '../js/logic.js';

test('kein Gebäude-Collider schneidet die Promenade', () => {
  for (const f of buildingFootprints()) {
    assert.equal(rectsOverlap(f, PROMENADE), false, `${f.name} liegt auf dem Weg (z ${f.z - f.d / 2}…${f.z + f.d / 2})`);
  }
  // Gegenprobe: der alte Verleih-Standort (z −7) hätte den Weg geschnitten
  const alt = buildingFootprints({ ...BUILDING_POS, rental: { x: -52, z: -7 } });
  assert.equal(rectsOverlap(alt.find((f) => f.name === 'rental'), PROMENADE), true);
});

test('rectsOverlap: Kante berührt = kein Schnitt, Überlappung = Schnitt', () => {
  const a = { x: 0, z: 0, w: 4, d: 2 };
  assert.equal(rectsOverlap(a, { x: 4, z: 0, w: 4, d: 2 }), false, 'nur berührt');
  assert.equal(rectsOverlap(a, { x: 3, z: 0.5, w: 4, d: 2 }), true);
  assert.equal(rectsOverlap(a, { minX: -10, maxX: 10, minZ: 0.9, maxZ: 3 }), true);
  assert.equal(rectsOverlap(a, { minX: -10, maxX: 10, minZ: 1.0, maxZ: 3 }), false);
});

test('joystickInput: Totzone, Normierung, Rennen bei weiter Auslenkung, oben = vor', () => {
  assert.deepEqual(joystickInput(3, -2), { x: 0, z: 0, mag: 0, active: false, run: false });
  const j = joystickInput(0, -40, { radius: 60 });
  close(j.x, 0); close(j.z, -1); close(j.mag, 40 / 60); assert.equal(j.run, false); assert.equal(j.active, true);
  const r = joystickInput(60, 60, { radius: 60 });
  close(Math.hypot(r.x, r.z), 1); assert.equal(r.mag, 1); assert.equal(r.run, true);
  const d = joystickInput(30, 0, { radius: 60, runAt: 0.4 });
  assert.equal(d.run, true);
});

test('rotateDir: entspricht inputToDir mit Kamera-Gierung', () => {
  const r = rotateDir({ x: 0, z: -1 }, Math.PI / 2);
  const k = inputToDir({ up: true }, Math.PI / 2);
  close(r.x, k.x); close(r.z, k.z);
  assert.deepEqual(rotateDir({ x: 1, z: 0 }, 0), { x: 1, z: 0 });
});

// ---------- Pool-Leiter ----------
import { poolLadderCollider, pointInCollider, POOL_LADDER_OFFSET } from '../js/logic.js';
test('Pool-Leiter (außen am Ostrand des Beckens) liegt in einem Collider, aber nicht auf der Promenade', () => {
  const ladder = { x: BUILDING_POS.pool.x + 9.5, z: BUILDING_POS.pool.z }; // Leiter aus props.js: lokal +8…+10 bei Skala 1.2
  const c = poolLadderCollider();
  assert.ok(pointInCollider(ladder, c), 'Leiterfuß im Kreis');
  assert.ok(pointInCollider({ x: ladder.x + 1, z: ladder.z }, c), 'Gestell (+1) noch im Kreis');
  assert.equal(pointInCollider({ x: ladder.x + 2, z: ladder.z }, c), false);
  // Kreis als Rechteck-Hülle gegen den Weg
  assert.equal(rectsOverlap({ x: c.x, z: c.z, w: c.r * 2, d: c.r * 2 }, PROMENADE), false);
  assert.equal(POOL_LADDER_OFFSET.dx, 9.5);
});

// ---------- Ankerplätze ----------
import { ANCHORS, assignAnchors, ZIVI_MIN_DIST, zoneSequence, ZONES, ZONE_MIX } from '../js/logic.js';
test('assignAnchors: jeder Platz einmal, Zivis halten ≥ 8 Abstand zu allen anderen Kunden, deterministisch', () => {
  const ks = [{ id: 'a' }, { id: 'b' }, { id: 'c' }, { id: 'd' }, { id: 'e' }, { id: 'z1', zivi: true }, { id: 'z2', zivi: true }];
  for (let day = 1; day <= 4; day++) {
    const m = assignAnchors(ks, ANCHORS, { day });
    const ids = Object.values(m).map((a) => a.id);
    assert.equal(new Set(ids).size, ks.length, `Tag ${day}: Plätze eindeutig`);
    for (const z of ['z1', 'z2']) for (const k of ks) {
      if (k.id === z) continue;
      const d = Math.hypot(m[z].x - m[k.id].x, m[z].z - m[k.id].z);
      assert.ok(d >= ZIVI_MIN_DIST, `Tag ${day}: ${z} zu nah an ${k.id} (${d.toFixed(1)})`);
    }
    assert.deepEqual(assignAnchors(ks, ANCHORS, { day }), m, 'deterministisch');
  }
  assert.notEqual(assignAnchors(ks, ANCHORS, { day: 1 }).a.id, assignAnchors(ks, ANCHORS, { day: 2 }).a.id, 'andere Tage, andere Plätze');
  // Anker tragen Tätigkeit und Radius
  for (const a of ANCHORS) assert.ok(['sitzt', 'telefoniert', 'fotografiert', 'schaut', 'steht'].includes(a.activity) && a.r > 0);
});
test('assignAnchors: zu wenig Plätze → Notnagel mit größtem Abstand, nichts stürzt ab', () => {
  const few = ANCHORS.slice(0, 3);
  const m = assignAnchors([{ id: 'a' }, { id: 'b' }, { id: 'z', zivi: true }, { id: 'c' }], few, { day: 1 });
  assert.equal(Object.keys(m).length, 4);
  assert.ok(few.includes(m.z));
});

test('Anker tragen eine Zone; zoneSequence mischt nach Gewichten und rotiert pro Tag', () => {
  for (const a of ANCHORS) assert.ok(ZONES.includes(a.zone), `${a.id} ohne Zone`);
  const seq = zoneSequence(7, ANCHORS, { day: 1 });
  const count = (z) => seq.filter((x) => x === z).length;
  // strand 4 : dorf 2 : markt 2 → bei 7 Kunden 3–4 Strand, 1–2 Dorf, 1–2 Markt
  assert.ok(count('strand') >= 3 && count('strand') <= 4, `strand ${count('strand')}`);
  assert.ok(count('dorf') >= 1 && count('dorf') <= 2, `dorf ${count('dorf')}`);
  assert.ok(count('markt') >= 1 && count('markt') <= 2, `markt ${count('markt')}`);
  assert.notDeepEqual(zoneSequence(7, ANCHORS, { day: 2 }), seq, 'anderer Tag, andere Reihenfolge');
  // ohne Markt-Plätze verschwindet der Markt aus der Mischung
  const ohneMarkt = ANCHORS.filter((a) => a.zone !== 'markt');
  assert.equal(zoneSequence(8, ohneMarkt, { day: 1 }).filter((z) => z === 'markt').length, 0);
  assert.ok(ANCHORS.filter((a) => a.zone === 'markt').length >= 6, 'Markt-Plätze aus dem Layout übernommen');
  assert.deepEqual(zoneSequence(3, [], { day: 1 }), [null, null, null]);
});

test('assignAnchors: pro Tag eine Mischung über Strand und Dorf, Zivi-Abstand gilt zonenübergreifend', () => {
  const ks = [{ id: 'a' }, { id: 'b' }, { id: 'c' }, { id: 'd' }, { id: 'e' }, { id: 'z1', zivi: true }, { id: 'z2', zivi: true }];
  for (let day = 1; day <= 5; day++) {
    const m = assignAnchors(ks, ANCHORS, { day });
    const zones = new Set(Object.values(m).map((a) => a.zone));
    assert.ok(zones.has('strand') && zones.has('dorf') && zones.has('markt'), `Tag ${day}: alle drei Zonen besetzt (${[...zones]})`);
    assert.equal(new Set(Object.values(m).map((a) => a.id)).size, ks.length, 'Plätze eindeutig');
    for (const z of ['z1', 'z2']) for (const k of ks) {
      if (k.id === z) continue;
      assert.ok(Math.hypot(m[z].x - m[k.id].x, m[z].z - m[k.id].z) >= ZIVI_MIN_DIST, `Tag ${day}: ${z} zu nah an ${k.id}`);
    }
  }
  // Mischung ändert sich über die Tage (nicht immer dieselben Kunden im Dorf)
  const dorfIds = (day) => Object.entries(assignAnchors(ks, ANCHORS, { day })).filter(([, a]) => a.zone === 'dorf').map(([id]) => id).sort().join();
  assert.notEqual(dorfIds(1), dorfIds(2));
});

// ---------- Ambience ----------
import { zoneMix } from '../js/logic.js';
test('zoneMix: Strand überall ≥ 0.2 und am Strand 1, Zonen fallen linear mit dem Abstand, fehlende Zonen = 0', () => {
  const defs = { markt: { x: 60, z: -90, r: 20 }, posten: { x: 20, z: -84, r: 15 } };
  const beach = zoneMix({ x: 0, z: 5 }, defs);
  close(beach.strand, 1); close(beach.markt, 0); close(beach.posten, 0);
  const atMarkt = zoneMix({ x: 60, z: -90 }, defs);
  close(atMarkt.markt, 1); close(atMarkt.strand, 0.2, 1e-9, 'weit im Norden nur Grundrauschen');
  const half = zoneMix({ x: 70, z: -90 }, defs);
  close(half.markt, 0.5);
  const mid = zoneMix({ x: 0, z: -39 }, defs);
  close(mid.strand, 0.5);
  assert.deepEqual(zoneMix({ x: 0, z: 0 }, { markt: null }), { strand: 1, markt: 0 });
  assert.deepEqual(zoneMix({ x: 0, z: 0 }), { strand: 1 });
});

// ---------- Streife ----------
import { patrolStart, patrolStep, seesTarget, PATROL_SPEED } from '../js/logic.js';
test('patrolStep: läuft die Route ab, kehrt an den Enden um, wartet dort, ist deterministisch', () => {
  const route = [{ x: 0, z: 0 }, { x: 10, z: 0 }, { x: 10, z: 10 }];
  let p = patrolStart(route);
  let t = 0;
  const seen = new Set();
  for (let i = 0; i < 60 * 40; i++) { p = patrolStep(p, route, 1 / 60); t += 1 / 60; if (p.wait > 0) seen.add(`${Math.round(p.x)},${Math.round(p.z)}`); }
  // nach 40 s ist sie mindestens einmal hin und zurück (20 Einheiten bei 2.2/s ≈ 9 s + Pausen): an beiden Enden gewartet
  assert.ok(seen.has('0,0') && seen.has('10,10'), `an beiden Enden gewartet (${[...seen]})`);
  // Geschwindigkeit: in 1 s ≈ PATROL_SPEED Einheiten
  let q = patrolStart(route);
  for (let i = 0; i < 60; i++) q = patrolStep(q, route, 1 / 60);
  close(q.x, PATROL_SPEED, 0.05); close(q.yaw, Math.PI / 2, 1e-6, 'Blick nach +x');
  assert.ok(q.moving && q.phase > 0);
  // Pause: während wait keine Bewegung
  const w = patrolStep({ ...q, wait: 1 }, route, 0.5);
  close(w.x, q.x); assert.equal(w.moving, false); close(w.wait, 0.5);
  assert.deepEqual(patrolStep(patrolStart(route), route, 0.1), patrolStep(patrolStart(route), route, 0.1));
  assert.equal(patrolStep(patrolStart([{ x: 0, z: 0 }]), [{ x: 0, z: 0 }], 1).moving, false);
});

test('seesTarget: vorne im Kegel ja, hinter dem Rücken nein, außerhalb der Reichweite nein', () => {
  const g = { x: 0, z: 0, yaw: 0 }; // schaut nach +z
  assert.equal(seesTarget(g, { x: 0, z: 8 }), true);
  assert.equal(seesTarget(g, { x: 5, z: 5 }), true, '45° seitlich');
  assert.equal(seesTarget(g, { x: 8, z: 1 }), false, '83° seitlich, außerhalb ±60°');
  assert.equal(seesTarget(g, { x: 0, z: -8 }), false, 'hinter ihr');
  assert.equal(seesTarget(g, { x: 0, z: 13 }), false, 'zu weit');
  assert.equal(seesTarget({ ...g, yaw: Math.PI }, { x: 0, z: -8 }), true, 'umgedreht');
});

// ---------- Verfolgung ----------
import { chaseStep, inHideout, CHASE_SPEED, CHASE_LOSE_AFTER, WALK_SPEED as WALK } from '../js/logic.js';
const ROUTE = [{ x: 0, z: 0 }, { x: 20, z: 0 }];
const sim = (st, player, seconds, opts) => {
  let events = [];
  for (let t = 0; t < seconds - 1e-9; t += 1 / 60) { const r = chaseStep(st, ROUTE, player, 1 / 60, opts); st = r.st; if (r.event) events.push(r.event); }
  return { st, events };
};
test('Verfolgung beginnt nur bei Sicht UND Heat ≥ 2; die Streife ist langsamer als der Spieler zu Fuß', () => {
  const start = patrolStart(ROUTE);
  assert.equal(chaseStep(start, ROUTE, { x: 5, z: 5 }, 1 / 60, { sees: true, heat: 1 }).st.mode, 'patrol');
  assert.equal(chaseStep(start, ROUTE, { x: 5, z: 5 }, 1 / 60, { sees: false, heat: 3 }).st.mode, 'patrol');
  const r = chaseStep(start, ROUTE, { x: 5, z: 5 }, 1 / 60, { sees: true, heat: 2 });
  assert.equal(r.event, 'chase_start'); assert.equal(r.st.mode, 'chase');
  assert.ok(CHASE_SPEED < WALK, 'Sandalen');
});
test('Verfolgung: folgt dem Spieler, fängt ihn in Reichweite (caught), verliert ihn nach 6 s ohne Sicht und kehrt zur Route zurück', () => {
  let st = { ...patrolStart(ROUTE), mode: 'chase', lastSeen: { x: 10, z: 0 }, lost: 0 };
  const far = sim(st, { x: 10, z: 0 }, 2, { sees: true, heat: 2 });
  assert.ok(far.st.x > 5 && far.st.x < 10, `läuft hin (${far.st.x.toFixed(1)})`);
  const c = sim(far.st, { x: 10, z: 0 }, 3, { sees: true, heat: 2 });
  assert.ok(c.events.includes('caught'), 'gefangen');
  // ohne Sicht: nach CHASE_LOSE_AFTER Sekunden verloren, dann zurück zur Route und wieder Streife
  let l = sim({ ...st, x: 0, z: 0 }, { x: 10, z: 0 }, CHASE_LOSE_AFTER + 0.5, { sees: false, heat: 2 });
  assert.ok(l.events.includes('lost'), 'verloren'); assert.equal(l.st.mode, 'return');
  l = sim(l.st, { x: 50, z: 50 }, 8, { sees: false, heat: 2 });
  assert.equal(l.st.mode, 'patrol', 'wieder Streife');
  assert.ok(!l.events.includes('caught'));
});
test('Verstecke: im Gedränge/Bettlaken ist der Spieler unsichtbar, die Verfolgung läuft aus', () => {
  const hideouts = [{ x: 10, z: 0, r: 2 }];
  assert.equal(inHideout({ x: 11, z: 0.5 }, hideouts), true);
  assert.equal(inHideout({ x: 13, z: 0 }, hideouts), false);
  const st = { ...patrolStart(ROUTE), mode: 'chase', lastSeen: { x: 10, z: 0 }, lost: 0 };
  const r = sim(st, { x: 10, z: 0 }, CHASE_LOSE_AFTER + 0.5, { sees: true, heat: 3, hideouts });
  assert.ok(r.events.includes('lost') && !r.events.includes('caught'), 'im Versteck nicht gefangen');
  // ohne Versteck wird derselbe Spieler gefangen
  const r2 = sim(st, { x: 10, z: 0 }, CHASE_LOSE_AFTER + 0.5, { sees: true, heat: 3 });
  assert.ok(r2.events.includes('caught'));
});
