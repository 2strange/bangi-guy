// ereignisse-logik.js — Bewegungen der Ereignis-Requisiten als reine Zeitfunktionen (kein Three.js).
// Möwe mit Beutel: Flugbahn vom Start steil hoch und aufs Meer hinaus. Regenwolke: zieht über den Strand.
// Kreuzfahrtschiff: wandert am Horizont. Alle liefern Position + Zustand zur Zeit t (Sekunden seit Start).

export const MOEWE = { dauer: 5, hoehe: 9, weite: 30 };
// t seit Start, from {x, z}: fliegt in Richtung dir (Standard: aufs Meer, +z), erst steil hoch, dann flach weg
export function moeweFlug(t, from = { x: 0, z: 0 }, dir = { x: 0.3, z: 1 }) {
  const u = Math.max(0, Math.min(1, t / MOEWE.dauer));
  const len = Math.hypot(dir.x, dir.z) || 1, dx = dir.x / len, dz = dir.z / len;
  const s = u * u * (3 - 2 * u);
  const dist = MOEWE.weite * s;
  const y = 1.2 + MOEWE.hoehe * Math.sin(Math.min(1, u * 1.6) * Math.PI / 2) + 0.25 * Math.sin(t * 9);
  return { x: from.x + dx * dist, y, z: from.z + dz * dist, yaw: Math.atan2(dx, dz), fertig: t >= MOEWE.dauer, flap: Math.sin(t * 14) };
}

export const WOLKE = { dauer: 45, x0: -80, x1: 80, z: -6, y: 18 };
// Regenwolke zieht von Westen nach Osten über den Strand; regen = 0…1 (blendet am Anfang/Ende aus)
export function wolkenPos(t) {
  const u = Math.max(0, Math.min(1, t / WOLKE.dauer));
  const regen = u < 0.1 ? u / 0.1 : u > 0.9 ? (1 - u) / 0.1 : 1;
  return { x: WOLKE.x0 + (WOLKE.x1 - WOLKE.x0) * u, y: WOLKE.y + 0.4 * Math.sin(t * 0.7), z: WOLKE.z + 3 * Math.sin(t * 0.3), regen, fertig: t >= WOLKE.dauer };
}

export const SCHIFF = { dauer: 240, x0: 190, x1: -190, z: 150 };
// Kreuzfahrtschiff am Horizont, von Osten nach Westen, leichtes Schaukeln
export function schiffPos(t) {
  const u = Math.max(0, Math.min(1, t / SCHIFF.dauer));
  return { x: SCHIFF.x0 + (SCHIFF.x1 - SCHIFF.x0) * u, z: SCHIFF.z, roll: 0.015 * Math.sin(t * 0.8), fertig: t >= SCHIFF.dauer, horn: (t % 60) < 2 };
}

// Kerzenflackern: 0.7…1.0, je Kerze anders
export const flackern = (t, i = 0) => 0.85 + 0.15 * Math.sin(t * 11 + i * 1.7) * Math.sin(t * 5.3 + i);
