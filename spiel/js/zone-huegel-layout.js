// zone-huegel-layout.js — Grundriss der Zone „Kiffer-Kuppe“ (Mentor-Hügel) als reine Daten + Höhenfunktion
// (kein Three.js, kein DOM). Flache Bühne: ein Plateau (Höhe H) mit weichem Hang, dazu eine Serpentine als
// Weg vom Strand (Heckenlücke bei x ≈ -50) hinauf. huegelHeight(x, z) ist die Bodenhöhe für Mesh UND Spieler.
// Koordinaten wie logic.js: x nach Osten, z nach Süden.

export const H = 3.5;                                    // Plateau-Höhe
export const PLATEAU = { x: -44, z: -58, rx: 14, rz: 12 }; // flache Kuppe (Ellipse)
export const FALLOFF = 1.0;                              // Hang: normierter Radius 1 → 1 + FALLOFF bis zum Boden
export const RAMP_WIDTH = 2.0;                           // halbe Breite des Weges (voll), danach Böschung
export const RAMP_SLOPE = 1.2;                           // Breite der Böschung
// Serpentine: Wegpunkte [x, z, Höhe]; beginnt in der Heckenlücke, endet auf der Kuppe
export const RAMP = [[-50, -24], [-50, -36], [-30, -44], [-52, -50], [-46, -56]];
export const RAMP_H = [0, 0.4, 1.4, 2.6, H];
// Heckenlücke für die Serpentine (world.js: Hecke in zwei Teilen bauen)
export const HECKE_LUECKE = { from: -54, to: -46 };

// Ausdehnung des Geländes (Heightfield-Mesh)
export const AREA = { minX: -70, maxX: -14, minZ: -82, maxZ: -22 };

// Kleinkram auf der Kuppe (Position, Collider). Hütte: Maßstab 2.1, Grundriss 3.0 × 2.6
export const HUETTE = { x: -49, z: -62, rot: 0.6, w: 3.0 * 2.1, d: 2.6 * 2.1 };
export const BEETE = [
  { x: -39, z: -60.5, w: 3.6, d: 2.4, rot: 0.08 },
  { x: -39, z: -55.5, w: 3.6, d: 2.4, rot: -0.1 },
  { x: -34.5, z: -61, w: 3.6, d: 2.4, rot: -0.06 },
  { x: -34.5, z: -55, w: 3.6, d: 2.4, rot: 0.12 },
];
export const ZAUN = { minX: -42, maxX: -31, minZ: -63.5, maxZ: -52.5, gate: { z0: -59.2, z1: -56.6 } }; // Tor im Westen
export const PROPS = [
  { kind: 'vogelscheuche', x: -39, z: -63.1, r: 0.5 },      // an den Südzaun, wo der Mentor stand
  { kind: 'bank', x: -37, z: -50.5, w: 2.6, d: 1.0, rot: 0.1 },
  { kind: 'schild', x: -43.5, z: -53.5, r: 0.3 },
  { kind: 'mentor', x: -36.7, z: -58, r: 0.7, rot: -Math.PI / 2 }, // mittig zwischen den Beeten, Blick zum Tor im Westen — frei erreichbar über den Mittelgang
];
export const HUEGEL_SPOTS = {
  huegel: { x: -43, z: -57, yaw: Math.PI },
  serpentine: { x: -50, z: -30, yaw: Math.PI },
  garten: { x: -41, z: -58, yaw: -Math.PI / 2 },
  aussicht: { x: -44, z: -51, yaw: 0 },
};

const smooth = (u) => { const v = Math.max(0, Math.min(1, u)); return v * v * (3 - 2 * v); };

// Hang: normierter Abstand zur Kuppen-Ellipse
export function moundHeight(x, z) {
  const r = Math.hypot((x - PLATEAU.x) / PLATEAU.rx, (z - PLATEAU.z) / PLATEAU.rz);
  return H * (1 - smooth((r - 1) / FALLOFF));
}

// Nächster Punkt auf der Serpentine: Abstand + interpolierte Weghöhe
export function rampNearest(x, z) {
  let best = { dist: Infinity, h: 0, t: 0 };
  let acc = 0;
  for (let i = 1; i < RAMP.length; i++) {
    const [ax, az] = RAMP[i - 1], [bx, bz] = RAMP[i];
    const abx = bx - ax, abz = bz - az, len2 = abx * abx + abz * abz;
    const u = Math.max(0, Math.min(1, ((x - ax) * abx + (z - az) * abz) / len2));
    const d = Math.hypot(x - (ax + abx * u), z - (az + abz * u));
    if (d < best.dist) best = { dist: d, h: RAMP_H[i - 1] + (RAMP_H[i] - RAMP_H[i - 1]) * u, t: acc + u * Math.sqrt(len2) };
    acc += Math.sqrt(len2);
  }
  return best;
}

// Höhe des Weges inkl. Böschung (0 außerhalb)
export function rampHeight(x, z) {
  const n = rampNearest(x, z);
  if (n.dist <= RAMP_WIDTH) return n.h;
  if (n.dist >= RAMP_WIDTH + RAMP_SLOPE) return 0;
  return n.h * (1 - smooth((n.dist - RAMP_WIDTH) / RAMP_SLOPE));
}

// Bodenhöhe der Zone: auf dem Weg gilt die Weghöhe (Hohlweg: in den Hang geschnitten bzw. aufgeschüttet),
// die Böschung blendet zum Hang über, sonst Hang
export function huegelHeight(x, z) {
  if (x < AREA.minX || x > AREA.maxX || z < AREA.minZ || z > AREA.maxZ) return 0;
  const m = moundHeight(x, z);
  const n = rampNearest(x, z);
  if (n.dist <= RAMP_WIDTH) return n.h;
  if (n.dist >= RAMP_WIDTH + RAMP_SLOPE) return m;
  return n.h + (m - n.h) * smooth((n.dist - RAMP_WIDTH) / RAMP_SLOPE);
}

// Liegt der Punkt auf dem Weg (für die Bodenfarbe)?
export const onRamp = (x, z) => rampNearest(x, z).dist <= RAMP_WIDTH + 0.3;

// Steigung zwischen zwei Punkten (Höhe pro Strecke)
export function slopeBetween(a, b) {
  const d = Math.hypot(b[0] - a[0], b[1] - a[1]);
  return d === 0 ? 0 : (huegelHeight(b[0], b[1]) - huegelHeight(a[0], a[1])) / d;
}

export function rampLength() {
  let sum = 0;
  for (let i = 1; i < RAMP.length; i++) sum += Math.hypot(RAMP[i][0] - RAMP[i - 1][0], RAMP[i][1] - RAMP[i - 1][1]);
  return sum;
}

// Achsenparalleler Umriss eines gedrehten Rechtecks (wie zone-dorf-layout.footprintAABB)
export function aabb(x, z, w, d, rot = 0, margin = 0.1) {
  const hw = w / 2 + margin, hd = d / 2 + margin, c = Math.abs(Math.cos(rot)), s = Math.abs(Math.sin(rot));
  return { x, z, w: 2 * (hw * c + hd * s), d: 2 * (hd * c + hw * s) };
}

// Alle Collider der Zone: Hütte, Beete, Zaun (ohne Tor), Kleinkram
export function huegelColliders() {
  const out = [aabb(HUETTE.x, HUETTE.z, HUETTE.w, HUETTE.d, HUETTE.rot)];
  for (const b of BEETE) out.push(aabb(b.x, b.z, b.w, b.d, b.rot));
  const Z = ZAUN, t = 0.3;
  out.push({ x: (Z.minX + Z.maxX) / 2, z: Z.minZ, w: Z.maxX - Z.minX, d: t });
  out.push({ x: (Z.minX + Z.maxX) / 2, z: Z.maxZ, w: Z.maxX - Z.minX, d: t });
  out.push({ x: Z.maxX, z: (Z.minZ + Z.maxZ) / 2, w: t, d: Z.maxZ - Z.minZ });
  out.push({ x: Z.minX, z: (Z.minZ + Z.gate.z0) / 2, w: t, d: Z.gate.z0 - Z.minZ });
  out.push({ x: Z.minX, z: (Z.gate.z1 + Z.maxZ) / 2, w: t, d: Z.maxZ - Z.gate.z1 });
  for (const p of PROPS) out.push(p.r !== undefined ? { x: p.x, z: p.z, r: p.r } : aabb(p.x, p.z, p.w, p.d, p.rot));
  return out;
}
