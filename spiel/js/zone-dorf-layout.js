// zone-dorf-layout.js — Grundriss der Zone „Krummgassen“ als reine Daten + Geometrie-Helfer (kein Three.js, kein DOM).
// Wird von zone-dorf.js gebaut und von test/dorf.test.js geprüft: Häuser überlappen nicht, jede Gasse bleibt
// LANE_WIDTH breit, das Wegenetz hängt zusammen, nichts steht im Hügel.
// Koordinaten wie logic.js: x nach Osten, z nach Süden; das Dorf liegt nördlich der Hecke (z < -26).
// Die Bühne ist dort schmal: die Kuppe im Westen reicht bis x ≈ -2, der Kokoshain-Hügel im Osten bis x ≈ 35.

export const LANE_WIDTH = 3;
export const DORF = { minX: -9, maxX: 38, minZ: -73, maxZ: -26 }; // im Süden (Heckennähe) etwas breiter, siehe hillHeight()

// Grundriss eines Hauses bei Gebäudeskala 2.1 (hut(): 3.2 × 3.0 → 6.72 × 6.3) plus Rand
export const HOUSE = { w: 6.72, d: 6.3, margin: 0.12 };

// kind: 'hut' (eine Etage, Kegeldach) | 'town' (zwei Etagen, Balkon). rot: Gierung, 0 = Tür nach Süden (+z).
export const HOUSES = [
  { id: 'A', x: -5, z: -30, rot: Math.PI / 2 + 0.05, kind: 'hut', wall: 0xf08ac4, roof: 0x2fa9b9, seed: 2, sign: 'KLINGEL KAPUTT – RUFEN' },
  { id: 'B', x: 6, z: -30, rot: -Math.PI / 2 - 0.05, kind: 'hut', wall: 0xffb347, roof: 0xd62e2e, seed: 3 },
  { id: 'C', x: 16, z: -41, rot: -Math.PI / 2 + 0.1, kind: 'town', wall: 0x9fd8ff, roof: 0xffd54a, seed: 4, balcony: 'oma' },
  { id: 'D', x: 28, z: -30, rot: Math.PI + 0.12, kind: 'hut', wall: 0xc9a0ff, roof: 0x3bb84a, seed: 5 },
  { id: 'E', x: 28, z: -41, rot: -0.1, kind: 'hut', wall: 0x9fe6c8, roof: 0xe8463a, seed: 6 },
  { id: 'F', x: 2, z: -52, rot: 0.1, kind: 'hut', wall: 0xffe14a, roof: 0x2a3f8f, seed: 7 },
  { id: 'G', x: 13, z: -52, rot: -Math.PI / 2 + 0.08, kind: 'town', wall: 0xff8c69, roof: 0x2fa9b9, seed: 8 },
  { id: 'H', x: 24, z: -52, rot: Math.PI - 0.1, kind: 'hut', wall: 0xc5e86c, roof: 0x8b5a2b, seed: 9 },
  { id: 'I', x: 2, z: -63, rot: Math.PI / 2 + 0.1, kind: 'hut', wall: 0x7fd8ff, roof: 0xd62e2e, seed: 10 },
  { id: 'J', x: 14, z: -64, rot: -Math.PI / 2 - 0.05, kind: 'town', wall: 0xfff1c2, roof: 0xff5fa2, seed: 11 },
  { id: 'K', x: 27, z: -64, rot: 0.08, kind: 'hut', wall: 0xe8463a, roof: 0x2a3f8f, seed: 12 },
];

// Gassen als Polylinien (Mittellinie). Eingang = Heckenlücke bei (0, -26), Ausgänge Markt (Osten) und Posten 7 (Norden).
export const LANES = {
  waesche: [[0, -24], [0, -35.5]],                       // F1 Wäschegasse: schmaler Durchstich zum Strand
  platz: [[0, -35.5], [6, -40], [6, -46.5]],             // Dorfplatz mit Brunnen
  markt: [[0, -35.5], [34.5, -35.5]],                    // Marktgasse → Ausgang Osten
  quer1: [[0, -46.5], [32, -46.5]],
  hunde: [[7.5, -46.5], [7.5, -57.5]],                   // Hundegasse
  mitte: [[18.5, -46.5], [18.5, -57.5]],
  quer2: [[0, -57.5], [32, -57.5]],
  nord: [[8, -57.5], [8, -69.5]],                        // → Ausgang Posten 7
};

// Absperrungen an den Ausgängen (Kollisionsrechteck wie in world.js: 6.5 × 1.5, skaliert 1.3)
export const EXITS = {
  markt: { x: 37, z: -35.5, rot: Math.PI / 2, text: 'MANGO-MARKT – Mangos aus', w: 1.5, d: 6.5 },
  posten: { x: 8, z: -72, rot: 0, text: 'POSTEN 7 – Streife frühstückt', w: 6.5, d: 1.5 },
};

// Kleinkram mit Kreis-Collider (Deko ohne Collider steht direkt in zone-dorf.js)
export const PROPS = [
  { kind: 'well', x: 2, z: -41.5, r: 1.7 },
  { kind: 'lamp', x: 10, z: -38, r: 0.3 },
  { kind: 'lamp', x: 31.5, z: -55.2, r: 0.3 },
  { kind: 'mailbox', x: 9.5, z: -44.4, r: 0.45, rot: 0.3 },
  { kind: 'mailbox', x: 23, z: -59.6, r: 0.45, rot: -0.4 },
  { kind: 'mailbox', x: -2.5, z: -37.5, r: 0.45, rot: 1.2 },
  { kind: 'dog', x: 9, z: -41, r: 0.8, rot: -2.2, color: 0xa66b38 },
  { kind: 'dog', x: 31, z: -51, r: 0.8, rot: 2.6, color: 0x8d8fa0 },
  { kind: 'crates', x: 21.5, z: -39, r: 1.0, rot: 0.4 },
  { kind: 'barrel', x: 32, z: -61, r: 0.6 },
];

// Unbegehbare Ränder: Hecke (mit Lücke), Hang der Kuppe im Westen, Hügelfuß im Osten
export const EDGES = [
  { x: -35, z: -25.5, w: 62, d: 3 },
  { x: 35, z: -25.5, w: 62, d: 3 },
  { x: -12, z: -53, w: 20, d: 36 },
  { x: 43, z: -55, w: 14, d: 34 },
];

// Snap-/Startpunkte (Kamera steht im Norden → yaw ≈ π schaut zur Kamera)
export const DORF_SPOTS = {
  dorf: { x: 0, z: -29, yaw: Math.PI },
  platz: { x: 6, z: -43, yaw: Math.PI },
  waesche: { x: 0, z: -31.5, yaw: 0 },
  hunde: { x: 7.5, z: -50, yaw: Math.PI },
  nord: { x: 8, z: -62, yaw: Math.PI },
  ost: { x: 26, z: -35.5, yaw: -Math.PI / 2 },
};

// ---------- Geometrie ----------
// Achsenparalleler Umriss eines gedrehten Grundrisses (so sieht ihn pushOutRect)
export function footprintAABB(h, fp = HOUSE) {
  const hw = fp.w / 2 + fp.margin, hd = fp.d / 2 + fp.margin;
  const c = Math.abs(Math.cos(h.rot)), s = Math.abs(Math.sin(h.rot));
  return { x: h.x, z: h.z, w: 2 * (hw * c + hd * s), d: 2 * (hd * c + hw * s) };
}

export function rectsOverlap(a, b) {
  return Math.abs(a.x - b.x) < (a.w + b.w) / 2 && Math.abs(a.z - b.z) < (a.d + b.d) / 2;
}

// Abstand Punkt → Strecke (2D)
export function pointSegmentDistance(p, a, b) {
  const abx = b[0] - a[0], abz = b[1] - a[1];
  const len2 = abx * abx + abz * abz;
  const t = len2 === 0 ? 0 : Math.max(0, Math.min(1, ((p[0] - a[0]) * abx + (p[1] - a[1]) * abz) / len2));
  return Math.hypot(p[0] - (a[0] + abx * t), p[1] - (a[1] + abz * t));
}

function cross(ax, az, bx, bz) { return ax * bz - az * bx; }
function segmentsIntersect(a, b, c, d) {
  const d1 = cross(d[0] - c[0], d[1] - c[1], a[0] - c[0], a[1] - c[1]);
  const d2 = cross(d[0] - c[0], d[1] - c[1], b[0] - c[0], b[1] - c[1]);
  const d3 = cross(b[0] - a[0], b[1] - a[1], c[0] - a[0], c[1] - a[1]);
  const d4 = cross(b[0] - a[0], b[1] - a[1], d[0] - a[0], d[1] - a[1]);
  return ((d1 > 0) !== (d2 > 0)) && ((d3 > 0) !== (d4 > 0));
}

// Abstand Strecke → Strecke (2D)
export function segmentSegmentDistance(a, b, c, d) {
  if (segmentsIntersect(a, b, c, d)) return 0;
  return Math.min(pointSegmentDistance(a, c, d), pointSegmentDistance(b, c, d), pointSegmentDistance(c, a, b), pointSegmentDistance(d, a, b));
}

// Abstand Strecke → Collider (Rechteck {x,z,w,d} oder Kreis {x,z,r}); 0 = berührt/schneidet
export function segmentColliderDistance(a, b, c) {
  if (c.r !== undefined) return Math.max(0, pointSegmentDistance([c.x, c.z], a, b) - c.r);
  const hw = c.w / 2, hd = c.d / 2;
  const inside = (p) => Math.abs(p[0] - c.x) < hw && Math.abs(p[1] - c.z) < hd;
  if (inside(a) || inside(b)) return 0;
  const x0 = c.x - hw, x1 = c.x + hw, z0 = c.z - hd, z1 = c.z + hd;
  const edges = [[[x0, z0], [x1, z0]], [[x1, z0], [x1, z1]], [[x1, z1], [x0, z1]], [[x0, z1], [x0, z0]]];
  return Math.min(...edges.map(([p, q]) => segmentSegmentDistance(a, b, p, q)));
}

// Alle Collider des Dorfs (ohne Ränder): Häuser als AABB, Kleinkram als Kreise, Absperrungen als Rechtecke
export function dorfColliders() {
  const out = HOUSES.map((h) => footprintAABB(h));
  for (const p of PROPS) out.push({ x: p.x, z: p.z, r: p.r });
  for (const e of Object.values(EXITS)) out.push({ x: e.x, z: e.z, w: e.w, d: e.d });
  return out;
}

// Engste Stelle: kleinster Abstand irgendeiner Gassen-Mittellinie zu irgendeinem Collider (soll ≥ LANE_WIDTH / 2)
export function laneClearance(colliders = dorfColliders(), lanes = LANES) {
  let best = { dist: Infinity, lane: null, collider: null };
  for (const [name, pts] of Object.entries(lanes)) {
    for (let i = 1; i < pts.length; i++) {
      for (const c of colliders) {
        const dist = segmentColliderDistance(pts[i - 1], pts[i], c);
        if (dist < best.dist) best = { dist, lane: name, collider: c };
      }
    }
  }
  return best;
}

// Gesamtlänge aller Gassen (Einheiten) — Laufzeit bei 4 Einheiten/s
export function laneLength(lanes = LANES) {
  let sum = 0;
  for (const pts of Object.values(lanes)) for (let i = 1; i < pts.length; i++) sum += Math.hypot(pts[i][0] - pts[i - 1][0], pts[i][1] - pts[i - 1][1]);
  return sum;
}

// Hängt das Wegenetz zusammen? Knoten = Wegpunkte; Kanten = Polylinien-Abschnitte; Wegpunkte, die auf einem
// anderen Abschnitt liegen (Abstand < eps), sind damit verbunden. Gibt die vom Start erreichbaren Knoten zurück.
export function reachableWaypoints(start, lanes = LANES, eps = 0.6) {
  const nodes = [], segs = [];
  for (const pts of Object.values(lanes)) {
    for (let i = 0; i < pts.length; i++) {
      nodes.push(pts[i]);
      if (i > 0) segs.push([pts[i - 1], pts[i]]);
    }
  }
  const adj = nodes.map(() => new Set());
  const idx = (p) => nodes.findIndex((n) => n === p);
  for (const [a, b] of segs) { adj[idx(a)].add(idx(b)); adj[idx(b)].add(idx(a)); }
  for (let i = 0; i < nodes.length; i++) {
    for (const [a, b] of segs) {
      if (pointSegmentDistance(nodes[i], a, b) < eps) { adj[i].add(idx(a)); adj[i].add(idx(b)); adj[idx(a)].add(i); adj[idx(b)].add(i); }
    }
  }
  let s = nodes.findIndex((n) => Math.hypot(n[0] - start[0], n[1] - start[1]) < eps);
  if (s < 0) return [];
  const seen = new Set([s]);
  const queue = [s];
  while (queue.length) { const i = queue.shift(); for (const j of adj[i]) if (!seen.has(j)) { seen.add(j); queue.push(j); } }
  return [...seen].map((i) => nodes[i]);
}

// Hügel-Höhe der Nachbarzone (Spiegel der beiden Kulissen-Hügel aus world.js: Kugeln, skaliert, Mitte y = -2).
// Dient nur der Prüfung, dass kein Haus im Hang steht; ändern sich die Hügel dort, hier nachziehen.
const HILLS = [
  { x: -45, z: -52, rx: 44, ry: 14, rz: 30 },
  { x: 60, z: -48, rx: 26.4, ry: 7, rz: 21 },
];
export function hillHeight(x, z) {
  let y = 0;
  for (const h of HILLS) {
    const q = 1 - ((x - h.x) / h.rx) ** 2 - ((z - h.z) / h.rz) ** 2;
    if (q > 0) y = Math.max(y, -2 + h.ry * Math.sqrt(q));
  }
  return y;
}

// Ecken eines gedrehten Grundrisses (Weltkoordinaten)
export function footprintCorners(h, fp = HOUSE) {
  const hw = fp.w / 2, hd = fp.d / 2;
  const c = Math.cos(h.rot), s = Math.sin(h.rot);
  return [[-hw, -hd], [hw, -hd], [hw, hd], [-hw, hd]].map(([x, z]) => [h.x + x * c + z * s, h.z - x * s + z * c]);
}
