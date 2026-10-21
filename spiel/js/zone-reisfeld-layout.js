// zone-reisfeld-layout.js — Grundriss von Reisfeld (Bauer Nok) und Kokoshain als reine Daten (kein Three.js).
// Reisfeld: nördlich der Kuppe, westlich von Posten 7 (x -63…-13, z -84…-97); sechs Wasserfelder in zwei Reihen,
// dazwischen Dämme mit Bambusstegen als Wege. Zufahrt vom Posten-Weg südlich am Gebäude vorbei.
// Kokoshain: Palmenwäldchen östlich der Pier-Zufahrt (x 77…97, z -54…-26) mit Kokos-Kletterer, als Versteck.
// Koordinaten wie logic.js: x nach Osten, z nach Süden.

export const LANE_WIDTH = 3;
export const REISFELD = { minX: -65.5, maxX: -8, minZ: -97.5, maxZ: -73 };

// Wasserfelder (Collider: man geht auf den Dämmen, nicht durchs Wasser)
const COLS = [-55.5, -39.3, -23.1], ROWS = [{ z: -87.6, d: 3.8 }, { z: -94.65, d: 3.9 }];
export const FELDER = [];
for (const r of ROWS) for (const x of COLS) FELDER.push({ x, z: r.z, w: 13, d: r.d });

// Dämme = Wege (Mittellinien), 3.2 breit mit Bambusplanken obendrauf
export const DAMM_BREITE = 3.2;
export const LANES = {
  reis_zufahrt: [[8, -74.5], [-12, -74.5], [-12, -84]],
  damm_sued: [[-12, -84], [-63.6, -84]],
  damm_mitte: [[-63.6, -91.1], [-14.5, -91.1]],
  damm_1: [[-47.4, -84], [-47.4, -96.6]],
  damm_2: [[-31.2, -84], [-31.2, -96.6]],
  damm_ost: [[-14.5, -84], [-14.5, -96.6]],
  damm_west: [[-63.6, -84], [-63.6, -96.6]],
};

// Figuren und Kulissen
export const NOK = { x: -36, z: -94.6, rot: 0.3 };                 // Bauer Nok, steht im Feld (Reihe B, Mitte)
export const BUEFFEL = { x: -56, z: -87.4, rot: 0.2, r: 1.8 };      // Wasserbüffel im Feld (Reihe A, West)
export const VOGELSCHEUCHE = { x: -39.3, z: -87.6, rot: -0.2 };    // Noks Vogelscheuche (Reihe A, Mitte)
export const HUETTE = { x: -18, z: -79, rot: 0.3, w: 4, d: 3 };     // Noks Schuppen
export const PROPS = [
  { kind: 'pumpe', x: -22.5, z: -80.5, r: 0.5 },
  { kind: 'schild', x: -9.5, z: -82, r: 0.3 },
  { kind: 'koerbe', x: -25, z: -80.5, r: 0.9 },
];

export const REISFELD_SPOTS = {
  reisfeld: { x: -31.2, z: -84, yaw: Math.PI },
  nok: { x: -36, z: -91.1, yaw: 0 },
  bueffel: { x: -55, z: -91.1, yaw: Math.PI },
};
export const REISFELD_ANCHORS = [
  { zone: 'reisfeld', id: 'reis_damm', x: -47.4, z: -86.5, r: 1.0, activity: 'schaut', blick: Math.PI / 2 },
  { zone: 'reisfeld', id: 'reis_ecke', x: -20, z: -84, r: 1.0, activity: 'steht', blick: Math.PI },
  { zone: 'reisfeld', id: 'reis_mitte', x: -31.2, z: -91.1, r: 1.0, activity: 'fotografiert', blick: 0 },
];

// ---------- Kokoshain ----------
export const KOKOSHAIN = { minX: 76, maxX: 98, minZ: -55, maxZ: -25 };
export const PALMEN = [
  { x: 79, z: -46, lean: [1.1, 0, -0.4], seed: 31 }, { x: 84, z: -50, lean: [-0.6, 0, 0.9], seed: 32, kletterer: true },
  { x: 90, z: -48, lean: [0.8, 0, 0.5], seed: 33 }, { x: 95, z: -38, lean: [-1.0, 0, 0.3], seed: 34 },
  { x: 92, z: -30, lean: [0.5, 0, -0.9], seed: 35 }, { x: 84, z: -28, lean: [-0.9, 0, -0.5], seed: 36 },
  { x: 78, z: -32, lean: [1.2, 0, 0.2], seed: 37 }, { x: 86, z: -42, lean: [0.3, 0, 1.0], seed: 38 },
];
export const PALME_R = 0.63;
export const HAIN_LANES = { hain: [[74, -40], [80, -38], [88, -34], [94, -42]] };
export const HAIN_VERSTECK = { x: 85, z: -45.5, r: 3.0 };
export const HAIN_PROPS = [
  { kind: 'schild', x: 81.5, z: -41.5, r: 0.3 },
  { kind: 'helm', x: 83, z: -47.5, r: 0 },
];
export const HAIN_SPOTS = {
  hain: { x: 84, z: -37, yaw: Math.PI },
  kletterer: { x: 82, z: -46.5, yaw: Math.PI },
};
export const HAIN_ANCHORS = [
  { zone: 'pier', id: 'hain_schatten', x: 82, z: -36, r: 1.0, activity: 'schaut', blick: 0.3 },
  { zone: 'pier', id: 'hain_palme', x: 90.5, z: -40.5, r: 1.0, activity: 'sitzt', blick: -0.8 },
];

export function aabb(x, z, w, d, rot = 0, margin = 0.1) {
  const hw = w / 2 + margin, hd = d / 2 + margin, c = Math.abs(Math.cos(rot)), s = Math.abs(Math.sin(rot));
  return { x, z, w: 2 * (hw * c + hd * s), d: 2 * (hd * c + hw * s) };
}

export function reisfeldColliders() {
  const out = FELDER.map((f) => ({ x: f.x, z: f.z, w: f.w, d: f.d }));
  out.push(aabb(HUETTE.x, HUETTE.z, HUETTE.w, HUETTE.d, HUETTE.rot));
  for (const p of PROPS) if (p.r) out.push({ x: p.x, z: p.z, r: p.r });
  return out;
}
export function hainColliders() {
  const out = PALMEN.map((p) => ({ x: p.x, z: p.z, r: PALME_R }));
  for (const p of HAIN_PROPS) if (p.r) out.push({ x: p.x, z: p.z, r: p.r });
  return out;
}

// Liegt ein Punkt in einem Wasserfeld? (Nok, Büffel, Vogelscheuche stehen im Wasser)
export function inFeld(x, z) {
  return FELDER.some((f) => Math.abs(x - f.x) < f.w / 2 && Math.abs(z - f.z) < f.d / 2);
}

export function laneLength(lanes = LANES) {
  let sum = 0;
  for (const pts of Object.values(lanes)) for (let i = 1; i < pts.length; i++) sum += Math.hypot(pts[i][0] - pts[i - 1][0], pts[i][1] - pts[i - 1][1]);
  return sum;
}
