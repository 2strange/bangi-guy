// logic.js — reine Spiel-Logik ohne Three.js/DOM: Eingabe → Richtung, Bewegung, Kollision,
// Uferlinie, Welt-Grenzen, Folge-Kamera, Watschel-Phase. Wird mit `node --test` getestet.
// Koordinaten: x nach Osten, z nach Süden (zum Meer), y nach oben. 1 Laufsekunde ≈ 4 Einheiten.

export const WALK_SPEED = 4.0;      // Einheiten/s
export const RUN_SPEED = 5.4;       // Sandalen: „rennen“ ist nur ein bisschen schneller
export const PLAYER_RADIUS = 0.6;
export const TURN_RATE = 10;        // rad/s Richtung Zielwinkel (exponentiell)
export const WADE_DEPTH = 1.6;      // so weit darf er ins Wasser (knöcheltief)

// Spielfläche der Zone (Bühne). Nord = -z (Hügel), Süd = +z (Meer).
// Nordgrenze = Nordrand des Dorfs Krummgassen (zone-dorf-layout.js: DORF.minZ, Test sichert die Übereinstimmung)
export const WORLD_MIN_Z = -74;
export const WORLD = { minX: -66, maxX: 66, minZ: WORLD_MIN_Z };

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

// ---------- Gebäude-Grundrisse + Promenade (reine Daten, damit ein Test Überschneidungen prüfen kann) ----------
export const PROMENADE = { minX: -64, maxX: 66, minZ: -12.6, maxZ: -9.0 }; // Weg am Nordrand des Strands (inkl. Wellen ±0.4)
export const BUILDING_POS = {
  bar: { x: -28, z: -6 },
  rental: { x: -52, z: 0 },   // Verleih südlich der Promenade (stand vorher mit z −7 auf dem Weg)
  hotel: { x: 34, z: -19 },
  pool: { x: 52, z: -18.5 },  // Pool nördlich der Promenade (stand vorher mit z −16 bis −10.75 auf dem Weg)
};
// Collider-Rechtecke der Gebäude in Weltkoordinaten (Maße/Offsets wie in world.js verwendet)
export function buildingFootprints(pos = BUILDING_POS, scales = BUILDING_SCALES) {
  return [
    { name: 'bar', ...scaledRect(pos.bar, scales.bar, 0, 0.4, 5.0, 2.2) },
    { name: 'rental', ...scaledRect(pos.rental, scales.rental, 0, 0, 4.2, 3.4) },
    { name: 'rental_rack', ...scaledRect(pos.rental, scales.rental, 3.8, 1.0, 3.4, 1.0) },
    { name: 'hotel', ...scaledRect(pos.hotel, scales.hotel, 0.3, 0, 15.2, 7.4) },
    { name: 'pool', x: pos.pool.x, z: pos.pool.z, w: 13.5, d: 10.5 },
  ];
}
// Rutschen-Leiter + Gestell stehen außen am Ostrand des Beckens (relativ zum Pool, Skala 1.2 → ca. +9.5 in x)
export const POOL_LADDER_OFFSET = { dx: 9.5, dz: 0 };
export function poolLadderCollider(pos = BUILDING_POS) {
  return { x: pos.pool.x + POOL_LADDER_OFFSET.dx, z: pos.pool.z + POOL_LADDER_OFFSET.dz, r: 1.2 };
}
export function pointInCollider(p, c) {
  if (c.r !== undefined) return Math.hypot(p.x - c.x, p.z - c.z) <= c.r;
  return Math.abs(p.x - c.x) <= c.w / 2 && Math.abs(p.z - c.z) <= c.d / 2;
}
export function rectsOverlap(a, b) {
  const ax0 = a.x - a.w / 2, ax1 = a.x + a.w / 2, az0 = a.z - a.d / 2, az1 = a.z + a.d / 2;
  const bx0 = b.minX ?? b.x - b.w / 2, bx1 = b.maxX ?? b.x + b.w / 2, bz0 = b.minZ ?? b.z - b.d / 2, bz1 = b.maxZ ?? b.z + b.d / 2;
  return ax0 < bx1 && ax1 > bx0 && az0 < bz1 && az1 > bz0;
}

// ---------- Virtueller Joystick (Touch): Auslenkung in Pixeln → Richtung, Rennen bei weiter Auslenkung ----------
export function joystickInput(dx, dy, { radius = 60, dead = 0.15, runAt = 0.8 } = {}) {
  const mag = Math.min(1, Math.hypot(dx, dy) / radius);
  if (mag < dead) return { x: 0, z: 0, mag: 0, active: false, run: false };
  const len = Math.hypot(dx, dy) || 1;
  // Bildschirm oben (dy < 0) = „vor“ (z −1), wie die W-Taste
  return { x: dx / len, z: dy / len, mag, active: true, run: mag >= runAt };
}
// Richtung um die Kamera-Gierung drehen (dieselbe Drehung wie in inputToDir)
export function rotateDir(dir, camYaw = 0) {
  if (!camYaw) return { x: dir.x, z: dir.z };
  const c = Math.cos(camYaw), s = Math.sin(camYaw);
  return { x: dir.x * c + dir.z * s, z: -dir.x * s + dir.z * c };
}

// ---------- Ankerplätze für die Kundschaft: fester Ort + Tätigkeit, kein Kreisen ----------
// Tätigkeiten: sitzt | telefoniert | fotografiert | schaut | steht. `blick` = Blickrichtung (yaw), sonst zum Meer (+z).
// Zonen der Ankerplätze; Mischung pro Tag über ZONE_MIX (Anteile, nur Zonen mit vorhandenen Plätzen zählen)
export const ZONES = ['strand', 'dorf', 'markt'];
export const ZONE_MIX = { strand: 4, dorf: 2, markt: 2 };
export const ANCHORS = [
  { zone: 'strand', id: 'liege_1', x: 28, z: -3.2, r: 0.4, activity: 'sitzt', blick: 0 },
  { zone: 'strand', id: 'liege_2', x: 31.8, z: -1.8, r: 0.4, activity: 'sitzt', blick: 0 },
  { zone: 'strand', id: 'liege_3', x: 39.4, z: -1.8, r: 0.4, activity: 'sitzt', blick: 0 },
  { zone: 'strand', id: 'hocker_bar', x: -29.6, z: -1.2, r: 0.5, activity: 'sitzt', blick: Math.PI },
  { zone: 'strand', id: 'bar_vorn', x: -25.5, z: 1.5, r: 1.0, activity: 'telefoniert', blick: 2.6 },
  { zone: 'strand', id: 'steg', x: -33, z: 10.5, r: 1.0, activity: 'fotografiert', blick: 0.3 },
  { zone: 'strand', id: 'palme_mitte', x: 4, z: 7, r: 1.2, activity: 'schaut', blick: 0 },
  { zone: 'strand', id: 'palme_west', x: -17, z: 9.5, r: 1.2, activity: 'steht', blick: 0.5 }, // vor den Hängematten-Palmen, nicht darunter
  { zone: 'strand', id: 'ufer_ost', x: 50, z: 10, r: 1.2, activity: 'schaut', blick: 0 },
  { zone: 'strand', id: 'dorfecke', x: -3, z: -20, r: 1.2, activity: 'telefoniert', blick: 0.2 },
  { zone: 'strand', id: 'verleih', x: -46, z: 6, r: 1.2, activity: 'steht', blick: -0.4 },
  { zone: 'strand', id: 'ufer_mitte', x: 16, z: 11, r: 1.2, activity: 'fotografiert', blick: 0 },
  // Dorf Krummgassen (Plätze auf Gassen/Platz, frei von Wäscheleinen-Verstecken)
  { zone: 'dorf', id: 'dorf_platz', x: 6, z: -43, r: 1.2, activity: 'steht', blick: Math.PI },
  { zone: 'dorf', id: 'dorf_brunnen', x: 3.5, z: -40, r: 1.0, activity: 'telefoniert', blick: 0.4 },
  { zone: 'dorf', id: 'dorf_hunde', x: 7.5, z: -50, r: 1.2, activity: 'fotografiert', blick: Math.PI },
  { zone: 'dorf', id: 'dorf_ost', x: 26, z: -35.5, r: 1.2, activity: 'schaut', blick: -Math.PI / 2 },
  { zone: 'dorf', id: 'dorf_nord', x: 8, z: -62, r: 1.2, activity: 'steht', blick: Math.PI },
];
export const ZIVI_MIN_DIST = 8;
const dist2 = (a, b) => Math.hypot(a.x - b.x, a.z - b.z);
/**
 * Verteilt die Kunden eines Tages auf Ankerplätze: jeder Platz nur einmal, Zivis mit Abstand ≥ minDist zu allen
 * anderen Kunden (damit Verkaufen „vor dem Zivi“ nicht der Normalfall ist). Reihenfolge deterministisch über day.
 * Gibt { [kundeId]: anchor } zurück; sind mehr Kunden als Plätze, teilen sich die letzten einen Platz versetzt.
 */
// Zonen-Reihenfolge für einen Tag: gewichtete Rundumverteilung (strand 4 : dorf 2 : markt 2), pro Tag rotiert,
// nur Zonen mit Plätzen. Ergebnis: Liste von Zonen-Namen in Vergabereihenfolge (Länge n).
export function zoneSequence(n, anchors = ANCHORS, { day = 1, mix = ZONE_MIX } = {}) {
  const zones = ZONES.filter((z) => anchors.some((a) => a.zone === z) && (mix[z] || 0) > 0);
  if (!zones.length) return Array(n).fill(null);
  const total = zones.reduce((acc, z) => acc + mix[z], 0);
  const seq = [];
  const credit = Object.fromEntries(zones.map((z) => [z, 0]));
  for (let i = 0; i < n; i++) {
    for (const z of zones) credit[z] += mix[z] / total;
    let best = zones[0];
    for (const z of zones) if (credit[z] > credit[best] + 1e-9) best = z;
    credit[best] -= 1;
    seq.push(best);
  }
  // pro Tag rotieren, damit andere Kunden in die Nebenzonen kommen (Anteile bleiben gleich)
  const k = n ? (day - 1) % n : 0;
  return seq.slice(k).concat(seq.slice(0, k));
}
export function assignAnchors(kunden, anchors = ANCHORS, { minDist = ZIVI_MIN_DIST, day = 1, mix = ZONE_MIX } = {}) {
  const out = {};
  const taken = [];
  const free = (zone) => anchors.filter((a) => !taken.includes(a) && (!zone || a.zone === zone));
  const rot = (list, n) => list.slice(n % Math.max(1, list.length)).concat(list.slice(0, n % Math.max(1, list.length)));
  const pick = (k, cands) => {
    const a = cands[0] || anchors[(taken.length + day) % anchors.length];
    taken.push(a);
    out[k.id] = a;
  };
  // Unbedenkliche zuerst: Zone aus der Tagesmischung, darin reihum; dann Zivis mit Abstand (zonenübergreifend)
  const others = kunden.filter((k) => !k.zivi), zivis = kunden.filter((k) => k.zivi);
  const seq = zoneSequence(kunden.length, anchors, { day, mix });
  others.forEach((k, i) => {
    const zone = seq[i];
    const cands = free(zone).length ? free(zone) : free();
    pick(k, rot(cands, day + i));
  });
  zivis.forEach((z, j) => {
    const zone = seq[others.length + j];
    const inZone = free(zone).length ? free(zone) : free();
    const ok = inZone.filter((a) => taken.every((t) => dist2(a, t) >= minDist));
    const okAny = ok.length ? ok : free().filter((a) => taken.every((t) => dist2(a, t) >= minDist));
    // Notnagel: der Platz mit dem größten Mindestabstand
    const best = okAny.length ? rot(okAny, day) : free().sort((a, b) => Math.min(...taken.map((t) => dist2(b, t))) - Math.min(...taken.map((t) => dist2(a, t))));
    pick(z, best);
  });
  return out;
}
