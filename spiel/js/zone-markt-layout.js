// zone-markt-layout.js — Grundriss von Mango-Markt (Z3) und Posten 7 (Z5) als reine Daten (kein Three.js).
// Lage im echten Layout: der Markt liegt ÖSTLICH des Dorfs (x 38…64, hinter dem Ausgang der Marktgasse),
// Posten 7 NÖRDLICH am Ende der Nordgasse (z < -74). Eine Ringstraße verbindet Posten und Markt.
// Koordinaten wie logic.js: x nach Osten, z nach Süden (Meer). Der Kokoshain-Hügel muss dafür nach Osten
// hinter die Bühnenkante rücken (world.js: hill2 auf x ≈ 88, z ≈ -62).

export const LANE_WIDTH = 3;
export const WORLD_MIN_Z = -98;                         // neue Nordgrenze (Posten 7 + Absperrung)
export const MARKT = { minX: 38, maxX: 64, minZ: -64, maxZ: -34 };
export const PLATZ = { x: 51, z: -51, w: 22, d: 22 };     // gepflasterter Marktplatz

// Stände: Tischfläche 3.4 × 1.6, mit Sonnensegel-Pfosten ≈ 3.8 × 2.4 Grundfläche; rot: Gierung, Kundenseite = +z lokal
export const STAENDE = [
  { id: 'mango', x: 44, z: -44, rot: 3 * Math.PI / 4, kind: 'mango', sign: 'MANGOS · 3 = 1', cloth: ['#ffd54a', '#ffffff'] },
  { id: 'fisch', x: 58, z: -42, rot: -3 * Math.PI / 4, kind: 'fisch', sign: 'FISCH · FAST FRISCH', cloth: ['#3a7bd5', '#ffffff'] },
  { id: 'ramsch', x: 60, z: -56, rot: -1.06, kind: 'ramsch', sign: 'ECHTE ROLEX · 5 MANGOS', cloth: ['#e8463a', '#fff5e0'] },
  { id: 'hemden', x: 42, z: -57, rot: 0.98, kind: 'hemden', sign: 'HAWAIIHEMDEN · NEU!', cloth: ['#3bb84a', '#ffffff'] },
  { id: 'kokos', x: 52, z: -61.5, rot: -0.1, kind: 'kokos', sign: 'KOKOS · MIT STROHHALM', cloth: ['#ff7f3f', '#fff1c2'] },
];
export const STAND_FOOT = { w: 3.8, d: 2.4, margin: 0.1 };

// Gedränge-Kulisse (Versteck V3): Menge um die Mitte, als ein Kreis-Collider
export const GEDRAENGE = { x: 51, z: -50, r: 3.2, n: 7 };

// Katze (Gag 10): läuft eine Runde um das Gedränge, immer vor dem Polizisten her
export const CAT_PATH = [[47, -46], [55, -46], [56, -55], [47, -56], [47, -46]];

// Wege (Mittellinien): Zufahrt von der Marktgasse, Ringstraße zum Posten, Straße am Posten nach Norden
export const LANES = {
  zufahrt: [[34.5, -35.5], [41, -35.5], [46, -40]],
  ring: [[46, -62], [40, -68], [30, -78], [8, -78]],
  posten: [[8, -69.5], [8, -93]],
};

export const EXITS = {
  pier: { x: 64.5, z: -51, rot: Math.PI / 2, text: 'TUK-TUK-PIER – Fähre tutet', w: 1.5, d: 6.5 },
  stadt: { x: 8, z: -95.5, rot: 0, text: 'STADT – 2 Tage Fußmarsch', w: 6.5, d: 1.5 },
};

// Posten 7: Gebäude (Maßstab 1.5, Grundriss 10 × 7 skaliert → 15 × 10.5), Tür nach Osten zur Straße
export const POSTEN = {
  gebaeude: { x: -2, z: -84, rot: Math.PI / 2, w: 10 * 1.5, d: 7 * 1.5 },
  wagen: { x: 16, z: -91.5, rot: -0.3, w: 4.6, d: 2.2 }, // östlich der Straße, gut sichtbar
  stand: { x: 15.5, z: -82, rot: -Math.PI / 2, kind: 'mango', sign: '1 MANGO = 1 GNADE', cloth: ['#ffd54a', '#2a3f8f'] },
  pong: { x: 5.5, z: -84, r: 0.6, rot: Math.PI / 2 },
  fahne: { x: 4.5, z: -79, r: 0.2 },
  bank: { x: 12.5, z: -88, w: 2.6, d: 1.0, rot: 0.1 },
};

export const MARKT_SPOTS = {
  markt: { x: 47, z: -42, yaw: Math.PI },
  marktmitte: { x: 51, z: -57, yaw: Math.PI },
  posten: { x: 8, z: -82, yaw: Math.PI },
  ring: { x: 30, z: -78, yaw: Math.PI },
};

// Ankerplätze für Kunden (Format wie logic.ANCHORS): 8 Plätze für die Zone „markt“, frei von Ständen/Gedränge
export const MARKT_ANCHORS = [
  { zone: 'markt', id: 'markt_mango', x: 47, z: -41, r: 1.0, activity: 'steht', blick: -2.4 },
  { zone: 'markt', id: 'markt_fisch', x: 54.5, z: -41, r: 1.0, activity: 'schaut', blick: 2.4 },
  { zone: 'markt', id: 'markt_ramsch', x: 56.5, z: -57.5, r: 1.0, activity: 'telefoniert', blick: 1.1 },
  { zone: 'markt', id: 'markt_hemden', x: 45.5, z: -55, r: 1.0, activity: 'steht', blick: -1.0 },
  { zone: 'markt', id: 'markt_kokos', x: 49, z: -59, r: 1.0, activity: 'fotografiert', blick: 0.1 },
  { zone: 'markt', id: 'markt_rand', x: 49.5, z: -45.5, r: 1.0, activity: 'steht', blick: Math.PI },
  { zone: 'markt', id: 'markt_palme', x: 60.5, z: -49, r: 1.0, activity: 'schaut', blick: -Math.PI / 2 },
  { zone: 'markt', id: 'posten_bank', x: 12.5, z: -86.5, r: 0.8, activity: 'sitzt', blick: Math.PI },
];

// Posten-Sicht: Kreis um den Vorplatz (Heat zählt hier doppelt) und der Bestechungs-Mango-Stand
export const POSTEN_SICHT = { x: 8, z: -84, r: 14 };
export const MANGO_STAND = { x: POSTEN.stand.x, z: POSTEN.stand.z };

export function aabb(x, z, w, d, rot = 0, margin = 0.1) {
  const hw = w / 2 + margin, hd = d / 2 + margin, c = Math.abs(Math.cos(rot)), s = Math.abs(Math.sin(rot));
  return { x, z, w: 2 * (hw * c + hd * s), d: 2 * (hd * c + hw * s) };
}

export function standCollider(s) { return aabb(s.x, s.z, STAND_FOOT.w, STAND_FOOT.d, s.rot, STAND_FOOT.margin); }

// Alle Collider beider Bereiche
export function marktColliders(exits = { pier: true, stadt: true }) {
  const out = STAENDE.map(standCollider);
  out.push({ x: GEDRAENGE.x, z: GEDRAENGE.z, r: GEDRAENGE.r });
  const P = POSTEN;
  out.push(aabb(P.gebaeude.x, P.gebaeude.z, P.gebaeude.w, P.gebaeude.d, P.gebaeude.rot));
  out.push(aabb(P.wagen.x, P.wagen.z, P.wagen.w, P.wagen.d, P.wagen.rot));
  out.push(standCollider(P.stand));
  out.push({ x: P.pong.x, z: P.pong.z, r: P.pong.r });
  out.push({ x: P.fahne.x, z: P.fahne.z, r: P.fahne.r });
  out.push(aabb(P.bank.x, P.bank.z, P.bank.w, P.bank.d, P.bank.rot));
  for (const [name, e] of Object.entries(EXITS)) if (exits[name] !== false) out.push({ x: e.x, z: e.z, w: e.w, d: e.d });
  return out;
}

export function laneLength(lanes = LANES) {
  let sum = 0;
  for (const pts of Object.values(lanes)) for (let i = 1; i < pts.length; i++) sum += Math.hypot(pts[i][0] - pts[i - 1][0], pts[i][1] - pts[i - 1][1]);
  return sum;
}

// Position + Blickrichtung der Katze zur Zeit t (Runde in Sekunden)
export function catAt(t, speed = 1.6, path = CAT_PATH) {
  const segs = [];
  let total = 0;
  for (let i = 1; i < path.length; i++) { const l = Math.hypot(path[i][0] - path[i - 1][0], path[i][1] - path[i - 1][1]); segs.push(l); total += l; }
  let s = ((t * speed) % total + total) % total;
  for (let i = 0; i < segs.length; i++) {
    if (s <= segs[i]) {
      const u = s / segs[i], [ax, az] = path[i], [bx, bz] = path[i + 1];
      return { x: ax + (bx - ax) * u, z: az + (bz - az) * u, yaw: Math.atan2(bx - ax, bz - az) };
    }
    s -= segs[i];
  }
  return { x: path[0][0], z: path[0][1], yaw: 0 };
}
