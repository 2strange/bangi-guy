// logic.js — reine Spiel-Logik ohne Three.js/DOM: Eingabe → Richtung, Bewegung, Kollision,
// Uferlinie, Welt-Grenzen, Folge-Kamera, Watschel-Phase. Wird mit `node --test` getestet.
// Koordinaten: x nach Osten, z nach Süden (zum Meer), y nach oben. 1 Laufsekunde ≈ 4 Einheiten.

export const WALK_SPEED = 4.0;      // Einheiten/s
export const RUN_SPEED = 5.4;       // Sandalen: „rennen“ ist nur ein bisschen schneller
export const PLAYER_RADIUS = 0.6;
export const TURN_RATE = 10;        // rad/s Richtung Zielwinkel (exponentiell)
export const WADE_DEPTH = 1.6;      // so weit darf er ins Wasser (knöcheltief)

// Spielfläche der Zone (Bühne). Nord = -z (Hügel), Süd = +z (Meer).
export const WORLD = { minX: -66, maxX: 66, minZ: -24 };

// Uferlinie: Sichelbucht, in der Mitte reicht das Meer am weitesten ins Land.
export function shoreZ(x) {
  const t = Math.max(0, Math.min(1, (x - WORLD.minX) / (WORLD.maxX - WORLD.minX)));
  return 12 + 5 * Math.sin(t * Math.PI) - 1.5 * Math.sin(t * Math.PI * 3);
}

// Tasten → Richtungsvektor in Weltkoordinaten (x, z), um die Kamera-Gierung gedreht.
export function inputToDir(keys, camYaw = 0) {
  let x = 0, z = 0;
  if (keys.left) x -= 1;
  if (keys.right) x += 1;
  if (keys.up) z -= 1;
  if (keys.down) z += 1;
  const len = Math.hypot(x, z);
  if (len === 0) return { x: 0, z: 0 };
  x /= len; z /= len;
  if (camYaw) {
    const c = Math.cos(camYaw), s = Math.sin(camYaw);
    return { x: x * c + z * s, z: -x * s + z * c };
  }
  return { x, z };
}

// Richtung zu einem Klick-Ziel; null wenn angekommen.
export function dirToTarget(pos, target, stopDist = 0.35) {
  if (!target) return null;
  const dx = target.x - pos.x, dz = target.z - pos.z;
  const d = Math.hypot(dx, dz);
  if (d <= stopDist) return null;
  return { x: dx / d, z: dz / d };
}

export function angleLerp(a, b, t) {
  let d = ((b - a + Math.PI) % (Math.PI * 2) + Math.PI * 2) % (Math.PI * 2) - Math.PI;
  return a + d * t;
}

// Kreis gegen Kreis-Collider rausdrücken
export function pushOutCircle(p, r, c) {
  const dx = p.x - c.x, dz = p.z - c.z;
  const d = Math.hypot(dx, dz);
  const min = r + c.r;
  if (d >= min) return p;
  if (d < 1e-6) return { x: c.x + min, z: c.z };
  const k = min / d;
  return { x: c.x + dx * k, z: c.z + dz * k };
}

// Kreis gegen achsenparalleles Rechteck {x, z, w, d} (Mittelpunkt, Breite in x, Tiefe in z)
export function pushOutRect(p, r, b) {
  const hw = b.w / 2, hd = b.d / 2;
  const cx = Math.max(b.x - hw, Math.min(p.x, b.x + hw));
  const cz = Math.max(b.z - hd, Math.min(p.z, b.z + hd));
  const dx = p.x - cx, dz = p.z - cz;
  const d = Math.hypot(dx, dz);
  if (d >= r) return p;
  if (d > 1e-6) {
    const k = r / d;
    return { x: cx + dx * k, z: cz + dz * k };
  }
  // Mittelpunkt liegt im Rechteck: zur nächsten Kante raus
  const toL = p.x - (b.x - hw), toR = (b.x + hw) - p.x, toT = p.z - (b.z - hd), toB = (b.z + hd) - p.z;
  const m = Math.min(toL, toR, toT, toB);
  if (m === toL) return { x: b.x - hw - r, z: p.z };
  if (m === toR) return { x: b.x + hw + r, z: p.z };
  if (m === toT) return { x: p.x, z: b.z - hd - r };
  return { x: p.x, z: b.z + hd + r };
}

// Alle Collider + Welt-Grenzen + Ufer; zwei Durchgänge, damit Ecken sauber werden
export function resolveCollisions(p, r, colliders, world = WORLD) {
  let q = { x: p.x, z: p.z };
  for (let pass = 0; pass < 2; pass++) {
    for (const c of colliders) {
      q = c.r !== undefined ? pushOutCircle(q, r, c) : pushOutRect(q, r, c);
    }
    q.x = Math.max(world.minX + r, Math.min(world.maxX - r, q.x));
    q.z = Math.max(world.minZ + r, q.z);
    const limit = shoreZ(q.x) + WADE_DEPTH;
    if (q.z > limit) q.z = limit;
  }
  return q;
}

/**
 * Ein Simulationsschritt für den Spieler.
 * state: { x, z, yaw, phase, speed }  input: { dir:{x,z}|null, run:boolean }
 * Gibt einen neuen State zurück (keine Mutation).
 */
export function stepPlayer(state, input, dt, colliders = [], world = WORLD) {
  const dir = input.dir;
  const moving = !!dir && (dir.x !== 0 || dir.z !== 0);
  const target = moving ? (input.run ? RUN_SPEED : WALK_SPEED) : 0;
  // Beschleunigen/Bremsen weich, damit das Watscheln nicht abrupt anfängt
  const accel = moving ? 18 : 24;
  let speed = state.speed ?? 0;
  speed += Math.max(-accel * dt, Math.min(accel * dt, target - speed));
  let x = state.x, z = state.z, yaw = state.yaw;
  if (moving) {
    const wantYaw = Math.atan2(dir.x, dir.z); // 0 = Blick nach +z (Süden/Meer)
    yaw = angleLerp(yaw, wantYaw, 1 - Math.exp(-TURN_RATE * dt));
    x += dir.x * speed * dt;
    z += dir.z * speed * dt;
  }
  const q = resolveCollisions({ x, z }, PLAYER_RADIUS, colliders, world);
  const moved = Math.hypot(q.x - state.x, q.z - state.z);
  // Phase läuft mit der tatsächlich zurückgelegten Strecke (Schrittlänge ≈ 1.6 Einheiten pro Doppelschritt)
  const phase = (state.phase ?? 0) + moved * (Math.PI * 2 / 1.6);
  return { x: q.x, z: q.z, yaw, phase, speed, moving: moved > 1e-4 && moving, running: moving && input.run };
}

/**
 * Folge-Kamera schräg von oben (nicht Ego): Zielposition = Spieler + fester Offset, um camYaw gedreht,
 * sanft nachgezogen (exponentiell). cam: { x, y, z, tx, ty, tz }
 */
export const CAM_OFFSET = { back: 13, up: 13, lookAhead: 3.0, targetY: 1.0 };
export const DEFAULT_CAM_YAW = Math.PI; // Kamera steht im Norden und schaut übers Land aufs Meer (Q/E dreht)
export function followCamera(cam, player, dt, camYaw = 0, k = 4) {
  const c = Math.cos(camYaw), s = Math.sin(camYaw);
  const ox = s * CAM_OFFSET.back, oz = c * CAM_OFFSET.back;
  const want = { x: player.x + ox, y: CAM_OFFSET.up, z: player.z + oz };
  const wantT = { x: player.x - s * CAM_OFFSET.lookAhead, y: CAM_OFFSET.targetY, z: player.z - c * CAM_OFFSET.lookAhead };
  const t = 1 - Math.exp(-k * dt);
  const lerp = (a, b) => a + (b - a) * t;
  return {
    x: lerp(cam.x, want.x), y: lerp(cam.y, want.y), z: lerp(cam.z, want.z),
    tx: lerp(cam.tx, wantT.x), ty: lerp(cam.ty, wantT.y), tz: lerp(cam.tz, wantT.z),
  };
}

// Watschel-Pose aus Phase + Tempo: Werte für Beine, Arme, Körper (Radiant / Einheiten)
export function waddlePose(phase, speed, running = false) {
  const k = Math.min(1, speed / WALK_SPEED);
  const amp = (running ? 0.75 : 0.55) * k;
  const sw = Math.sin(phase);
  return {
    legL: sw * amp,
    legR: -sw * amp,
    armL: -sw * amp * 0.6,
    armR: sw * amp * 0.6,
    bob: Math.abs(Math.cos(phase)) * 0.09 * k,
    sway: Math.sin(phase) * 0.09 * k,       // seitliches Kippen (Schlurfen)
    lean: 0.1 * k + (running ? 0.12 : 0),   // nach vorn lehnen
    footDrag: Math.max(0, -Math.sin(phase)) * 0.35 * k, // Fuß hängt beim Nachziehen
  };
}

// Kopf des NPC Richtung Spieler drehen, begrenzt auf ±maxTurn relativ zum Körper
export function npcHeadYaw(npc, player, maxTurn = 1.1) {
  const want = Math.atan2(player.x - npc.x, player.z - npc.z) - npc.yaw;
  const rel = Math.atan2(Math.sin(want), Math.cos(want));
  return Math.max(-maxTurn, Math.min(maxTurn, rel));
}

// ---------- Verdeckung: welche Objekte stehen zwischen Kamera und Spieler? ----------
// Abstand eines Punkts p zur Strecke a→b (3D)
export function segmentPointDistance(a, b, p) {
  const abx = b.x - a.x, aby = b.y - a.y, abz = b.z - a.z;
  const apx = p.x - a.x, apy = p.y - a.y, apz = p.z - a.z;
  const len2 = abx * abx + aby * aby + abz * abz;
  const t = len2 === 0 ? 0 : Math.max(0, Math.min(1, (apx * abx + apy * aby + apz * abz) / len2));
  const dx = apx - abx * t, dy = apy - aby * t, dz = apz - abz * t;
  return Math.hypot(dx, dy, dz);
}

/**
 * true, wenn die Kugel {x,y,z,r} die Sichtlinie Kamera→Ziel schneidet (um `margin` vor dem Ziel verkürzt,
 * damit der Spieler selbst bzw. der Boden unter ihm nicht zählt) oder näher als `near` an der Kamera liegt.
 */
export function isOccluder(cam, target, sphere, { near = 2.5, margin = 0.8 } = {}) {
  const dx = target.x - cam.x, dy = target.y - cam.y, dz = target.z - cam.z;
  const len = Math.hypot(dx, dy, dz);
  if (len < 1e-6) return false;
  const k = Math.max(0, len - margin) / len;
  const end = { x: cam.x + dx * k, y: cam.y + dy * k, z: cam.z + dz * k };
  if (segmentPointDistance(cam, end, sphere) < sphere.r) return true;
  return Math.hypot(sphere.x - cam.x, sphere.y - cam.y, sphere.z - cam.z) < sphere.r + near;
}

// Kamera-Weltposition aus Spieler + Gierung (dieselbe Formel wie followCamera, ohne Nachziehen)
export function cameraTargetPos(player, camYaw) {
  const c = Math.cos(camYaw), s = Math.sin(camYaw);
  return { x: player.x + s * CAM_OFFSET.back, y: CAM_OFFSET.up, z: player.z + c * CAM_OFFSET.back };
}

// ---------- Maßstab der Gebäude (50 % größer als ursprünglich, Figuren bleiben) ----------
export const FIGURE_HEIGHT = 2.75;   // Schluffi mit Haaren, Einheiten
// Skalierung je Gebäudetyp (einzeln drehbar): Bar/Hotel 1.5, Verleih/Dorfhäuser/Mentor-Hütte 2.1
export const BUILDING_SCALES = { bar: 1.5, hotel: 1.5, rental: 2.1, hut: 2.1, mentor: 2.1 };
// Basishöhen (unskaliert) der Bauteile aus props.js: Dachspitze über dem Boden bzw. Türhöhe
export const BUILDING_BASE = {
  bar: { height: 4.55, door: 0 },
  hut: { height: 4.1, door: 1.9 },
  mentor: { height: 4.1, door: 1.9 },
  rental: { height: 4.0, door: 1.9 },
  hotel: { height: 7.35, door: 2.6 },
};
export const buildingScale = (name) => BUILDING_SCALES[name];
export const buildingHeight = (name) => BUILDING_BASE[name].height * BUILDING_SCALES[name];
export const doorHeight = (name) => BUILDING_BASE[name].door * BUILDING_SCALES[name];

// Collider eines skalierten Gebäudes: Offsets/Maße relativ zur Gebäude-Position mitskalieren
export function scaledRect(origin, scale, dx, dz, w, d) {
  return { x: origin.x + dx * scale, z: origin.z + dz * scale, w: w * scale, d: d * scale };
}
export function scaledCircle(origin, scale, dx, dz, r) {
  return { x: origin.x + dx * scale, z: origin.z + dz * scale, r: r * scale };
}
