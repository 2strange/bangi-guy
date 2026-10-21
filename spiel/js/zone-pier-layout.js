// zone-pier-layout.js — Grundriss der Zone „Tuk-Tuk-Pier“ (Z4, Hafen) als reine Daten (kein Three.js).
// Lage: östlich des Markts hinter der Absperrung „TUK-TUK-PIER“, am Ostende des Strands (x 66…100). Die Zufahrt
// führt vom Markt südlich am Kokoshain-Hügel vorbei zum Hafenplatz; der Steg geht ins Meer (Ufer bei z ≈ 12).
// Die Fähre kommt alle FERRY_PERIOD Sekunden von Osten, tutet, legt am Steg an und fährt wieder.
// Koordinaten wie logic.js: x nach Osten, z nach Süden (Meer).

export const LANE_WIDTH = 3;
export const WORLD_MAX_X = 100;                       // neue Ostgrenze
export const PIER = { minX: 66, maxX: 100, minZ: -56, maxZ: 30 };
export const HAFENPLATZ = { x: 79, z: -5, w: 22, d: 20 }; // gepflasterter Hafenplatz
export const SHORE_Z = 12;                            // Uferlinie im Osten (shoreZ(x) für x ≥ 66)

// Kokoshain-Hügel (world.js hill2) — Vorschlag: Mitte (92, -66); als zwei Kreise unbegehbar
export const HUEGEL_OST = { x: 92, z: -66, circles: [{ x: 84, z: -66, r: 20 }, { x: 100, z: -66, r: 20 }] };

// Wege (Mittellinien): Zufahrt vom Markt, Anschluss an die Promenade (Absperrung „PROMENADE – im Bau“ bei x 64.5)
// (Schlüssel zonenweit eindeutig — die Tests legen die Wege aller Zonen in ein Objekt)
export const LANES = {
  markt_quer: [[46, -40], [54, -45], [59, -50], [64.5, -51]],   // quer über den Marktplatz zur Absperrung
  hafen_zufahrt: [[64.5, -51], [70, -48], [74, -40], [74, -14]],
  hafen_platz: [[74, -14], [74, -8], [84, 0], [84, 4]],
  hafen_promenade: [[64.5, -10.8], [74, -8]],
  hafen_steg: [[84, 4], [84, 10]],
};

// Steg: Holzpier vom Hafenplatz ins Wasser (begehbar; eigenes Collider-Paar links/rechts hält den Spieler drauf)
export const STEG = { x: 84, z0: 4, z1: 28, w: 4.4 };
// Fähre: Anleger am Stegende, kommt von Osten
export const FERRY = { dockX: 92, dockZ: 25, farX: 140, period: 60, approach: 12, wait: 16, leave: 12 };
export const FERRY_SPAWN = { x: 84, z: 16 };          // auf dem Steg: hier steigen Backpacker und Zivi P3 aus

// Furt F2 (Untiefe Hotelstrand ↔ Pier): nur mit Sandalen/barfuß; Turnschuhe bleiben an der Wasserkante
export const FURT = { x0: 58, x1: 74, maxZ: 22, stones: [[60, 15], [63, 17], [66, 18.5], [69, 17.5], [72, 15.5]] };

// Kulissen mit Collidern
export const PROPS = [
  { kind: 'tuktuk', x: 70, z: -2, rot: 0.5, w: 3.2, d: 2.0 },
  { kind: 'boot', x: 80, z: -14, rot: 0.3, w: 2.8, d: 1.4 },
  { kind: 'boot', x: 90, z: -12, rot: -0.9, w: 2.8, d: 1.4 },
  { kind: 'kisten', x: 70, z: 1, rot: 0.2, r: 1.1 },
  { kind: 'kisten', x: 88, z: 0, rot: -0.4, r: 1.0 },
  { kind: 'netz', x: 68, z: -14, r: 0.3 },
  { kind: 'poller', x: 82.0, z: 5, r: 0.25 },
  { kind: 'poller', x: 86.0, z: 5, r: 0.25 },
  { kind: 'fischer', x: 86.2, z: 22, r: 0.6, rot: Math.PI / 2 },
  { kind: 'schild', x: 76, z: 7, r: 0.3 },
  { kind: 'laterne', x: 66, z: -3, r: 0.3 },
  { kind: 'laterne', x: 90, z: -2, r: 0.3 },
];

export const EXITS = {
  insel: { x: 98.5, z: -5, rot: Math.PI / 2, text: 'NACHBARINSEL – nur per Fähre', w: 1.5, d: 6.5 },
};

export const PIER_SPOTS = {
  pier: { x: 79, z: -3, yaw: Math.PI },
  steg: { x: 84, z: 14, yaw: 0 },
  tuktuk: { x: 74, z: -4, yaw: -Math.PI / 2 },
  furt: { x: 66, z: 11, yaw: Math.PI / 2 },
  zufahrt: { x: 74, z: -30, yaw: Math.PI },
};

// Ankerplätze für Kunden (Zone „pier“), frei von Kulissen
export const PIER_ANCHORS = [
  { zone: 'pier', id: 'pier_faehre', x: 88, z: 9, r: 1.0, activity: 'steht', blick: 0 },
  { zone: 'pier', id: 'pier_kiste', x: 72, z: 3.5, r: 0.8, activity: 'sitzt', blick: Math.PI },
  { zone: 'pier', id: 'pier_boot', x: 84, z: -9, r: 1.0, activity: 'fotografiert', blick: 0.4 },
  { zone: 'pier', id: 'pier_netz', x: 70, z: -12, r: 1.0, activity: 'telefoniert', blick: -2.5 },
  { zone: 'pier', id: 'pier_steg', x: 84, z: 17, r: 1.0, activity: 'schaut', blick: 0 },
  { zone: 'pier', id: 'pier_furt', x: 66, z: 9, r: 1.0, activity: 'schaut', blick: 1.2 },
];

export function aabb(x, z, w, d, rot = 0, margin = 0.1) {
  const hw = w / 2 + margin, hd = d / 2 + margin, c = Math.abs(Math.cos(rot)), s = Math.abs(Math.sin(rot));
  return { x, z, w: 2 * (hw * c + hd * s), d: 2 * (hd * c + hw * s) };
}

// Collider der Zone (ohne den Hügel, der kommt als eigene Kreise dazu)
export function pierColliders() {
  const out = [];
  for (const p of PROPS) out.push(p.r !== undefined ? { x: p.x, z: p.z, r: p.r } : aabb(p.x, p.z, p.w, p.d, p.rot));
  for (const e of Object.values(EXITS)) out.push({ x: e.x, z: e.z, w: e.w, d: e.d });
  // Steg-Geländer links/rechts (dünne Rechtecke), damit man nicht seitlich ins Wasser fällt
  const S = STEG;
  out.push({ x: S.x - S.w / 2 - 0.2, z: (S.z0 + S.z1) / 2, w: 0.3, d: S.z1 - S.z0 });
  out.push({ x: S.x + S.w / 2 + 0.2, z: (S.z0 + S.z1) / 2, w: 0.3, d: S.z1 - S.z0 });
  out.push({ x: S.x, z: S.z1 + 0.3, w: S.w + 1, d: 0.4 }); // Stegende
  return out;
}
export function allColliders() { return [...pierColliders(), ...HUEGEL_OST.circles]; }

// Fähre zur Zeit t: Position, Blickrichtung, Zustand (approach | docked | leave | away), Tut-Signal
export function ferryAt(t) {
  const F = FERRY;
  const k = ((t % F.period) + F.period) % F.period;
  const ease = (u) => { const v = Math.max(0, Math.min(1, u)); return v * v * (3 - 2 * v); };
  if (k < F.approach) {
    const u = ease(k / F.approach);
    return { x: F.farX + (F.dockX - F.farX) * u, z: F.dockZ + 6 * (1 - u), yaw: Math.PI, state: 'approach', horn: k > F.approach - 2.5 && k < F.approach - 0.5 };
  }
  if (k < F.approach + F.wait) return { x: F.dockX, z: F.dockZ, yaw: Math.PI, state: 'docked', horn: false };
  if (k < F.approach + F.wait + F.leave) {
    const u = ease((k - F.approach - F.wait) / F.leave);
    return { x: F.dockX + (F.farX - F.dockX) * u, z: F.dockZ + 6 * u, yaw: 0, state: 'leave', horn: u < 0.15 };
  }
  return { x: F.farX, z: F.dockZ + 6, yaw: 0, state: 'away', horn: false };
}
export const ferryDocked = (t) => ferryAt(t).state === 'docked';

// Furt: bis zu welchem z darf man bei x ins Wasser? (nur Sandalen/barfuß; Turnschuhe bleiben bei WADE_DEPTH)
export function furtDepthLimit(x, shore = SHORE_Z, wade = 1.6) {
  if (x < FURT.x0 || x > FURT.x1) return shore + wade;
  return FURT.maxZ;
}

// Steg begehbar: Spieler darf auf dem Steg über die Uferlinie hinaus (bis Stegende)
export function stegDepthLimit(x, shore = SHORE_Z, wade = 1.6) {
  if (Math.abs(x - STEG.x) <= STEG.w / 2) return STEG.z1;
  return shore + wade;
}

export function laneLength(lanes = LANES) {
  let sum = 0;
  for (const pts of Object.values(lanes)) for (let i = 1; i < pts.length; i++) sum += Math.hypot(pts[i][0] - pts[i - 1][0], pts[i][1] - pts[i - 1][1]);
  return sum;
}
