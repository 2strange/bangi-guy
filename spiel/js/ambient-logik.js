// ambient-logik.js — reine Logik der Ambient-Szenen (kein Three.js), testbar mit node --test.
export const HANDTUCH_FARBEN = [['#e8463a', '#ffffff'], ['#3a7bd5', '#ffd54a'], ['#3bb84a', '#ffffff'], ['#ff5fa2', '#fff1c2']];

// Deterministischer Zufall wie toon.rng (hier kopiert, damit die Datei ohne Three bleibt)
function rng(seed = 1) {
  let s = seed >>> 0;
  return () => { s = (s + 0x6d2b79f5) >>> 0; let t = s; t = Math.imul(t ^ (t >>> 15), t | 1); t ^= t + Math.imul(t ^ (t >>> 7), t | 61); return ((t ^ (t >>> 14)) >>> 0) / 4294967296; };
}

/** Handtuch-Werfer um 6 Uhr: welche Liegen (Index) ein Handtuch bekommen, Farben und Wurfzeitpunkt (s nach Szenenstart).
 *  Deterministisch je Tag; mindestens eine Liege bleibt frei, mindestens eine wird belegt. */
export function handtuchPlan(liegenAnzahl, tag = 1) {
  const r = rng(700 + tag);
  const out = [];
  for (let i = 0; i < liegenAnzahl; i++) if (r() < 0.75) out.push({ liege: i, farben: HANDTUCH_FARBEN[(i + tag) % HANDTUCH_FARBEN.length], wurfZeit: +(0.8 + i * 0.6 + r() * 0.3).toFixed(2) });
  if (liegenAnzahl >= 2 && out.length === liegenAnzahl) out.pop();
  if (liegenAnzahl >= 1 && out.length === 0) out.push({ liege: 0, farben: HANDTUCH_FARBEN[tag % HANDTUCH_FARBEN.length], wurfZeit: 0.8 });
  return out;
}
