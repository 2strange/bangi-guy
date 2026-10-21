// licht-palette.js — Tagesablauf als reine Daten + Interpolation (kein Three.js). t01 = Tageszeit 0…1
// (0 = Mitternacht, 0.25 = Morgen, 0.5 = Mittag, 0.75 = Sonnenuntergang). Farben als Hex-Zahlen.
// Nacht bleibt spielbar hell (blau), Morgen rosa, Mittag hell, Abend orange → lila.

// Stützstellen: t, Himmel, Nebel, Sonnenfarbe, Sonnenstärke, Hemisphäre oben/unten/Stärke, Lichter an (0…1)
export const KEYS = [
  { t: 0.00, sky: 0x1b2a5e, fog: 0x22346b, sun: 0x8fa8ff, sunI: 0.45, hemiSky: 0x3a4f8f, hemiGround: 0x1b2a3a, hemiI: 0.7, lights: 1 },
  { t: 0.18, sky: 0x5b4a7a, fog: 0x6a5a8a, sun: 0xffb08a, sunI: 0.7, hemiSky: 0x8a7aa8, hemiGround: 0x6a5a4a, hemiI: 0.7, lights: 1 },
  { t: 0.25, sky: 0xffb6c8, fog: 0xffc6d4, sun: 0xffc9a0, sunI: 1.3, hemiSky: 0xffd6e0, hemiGround: 0xd9b27a, hemiI: 0.75, lights: 0.3 },
  { t: 0.35, sky: 0x9fe0ff, fog: 0xaee8ff, sun: 0xfff1d0, sunI: 1.7, hemiSky: 0xcfeeff, hemiGround: 0xd9b27a, hemiI: 0.75, lights: 0 },
  { t: 0.50, sky: 0x8fe0ff, fog: 0x9fe6ff, sun: 0xfff4d6, sunI: 1.9, hemiSky: 0xcfeeff, hemiGround: 0xd9b27a, hemiI: 0.75, lights: 0 },
  { t: 0.65, sky: 0x8fd8ff, fog: 0xa8e0ff, sun: 0xffe9b8, sunI: 1.7, hemiSky: 0xcfeeff, hemiGround: 0xd9b27a, hemiI: 0.75, lights: 0 },
  { t: 0.74, sky: 0xff8c5a, fog: 0xffa07a, sun: 0xff9a4a, sunI: 1.4, hemiSky: 0xffb088, hemiGround: 0x8a5a4a, hemiI: 0.8, lights: 0.6 },
  { t: 0.80, sky: 0x7a4a8a, fog: 0x8a5a9a, sun: 0xc47aa0, sunI: 0.9, hemiSky: 0x9a6aa8, hemiGround: 0x4a3a5a, hemiI: 0.75, lights: 1 },
  { t: 0.88, sky: 0x1b2a5e, fog: 0x22346b, sun: 0x8fa8ff, sunI: 0.45, hemiSky: 0x3a4f8f, hemiGround: 0x1b2a3a, hemiI: 0.7, lights: 1 },
  { t: 1.00, sky: 0x1b2a5e, fog: 0x22346b, sun: 0x8fa8ff, sunI: 0.45, hemiSky: 0x3a4f8f, hemiGround: 0x1b2a3a, hemiI: 0.7, lights: 1 },
];

export const SONNE = { auf: 0.22, unter: 0.78 }; // Sonne über dem Horizont zwischen auf und unter

export const wrap01 = (t) => ((t % 1) + 1) % 1;

export function lerpColor(a, b, u) {
  const ch = (s) => [(s >> 16) & 255, (s >> 8) & 255, s & 255];
  const [ar, ag, ab] = ch(a), [br, bg, bb] = ch(b);
  const r = Math.round(ar + (br - ar) * u), g = Math.round(ag + (bg - ag) * u), bl = Math.round(ab + (bb - ab) * u);
  return (r << 16) | (g << 8) | bl;
}

// Interpolierte Palette zur Tageszeit (stetig, 0 und 1 sind dieselbe Nacht)
export function tageszeitPalette(t01) {
  const t = wrap01(t01);
  let i = 0;
  while (i < KEYS.length - 2 && KEYS[i + 1].t <= t) i++;
  const a = KEYS[i], b = KEYS[i + 1];
  const u = (t - a.t) / (b.t - a.t);
  const num = (k) => a[k] + (b[k] - a[k]) * u;
  const col = (k) => lerpColor(a[k], b[k], u);
  return {
    sky: col('sky'), fog: col('fog'), sun: col('sun'), sunI: num('sunI'),
    hemiSky: col('hemiSky'), hemiGround: col('hemiGround'), hemiI: num('hemiI'),
    lights: num('lights'), nacht: nachtAnteil(t),
  };
}

// Wie „Nacht“ ist es (0 = Tag, 1 = Nacht), weich
export function nachtAnteil(t01) {
  const t = wrap01(t01);
  const s = (x) => { const v = Math.max(0, Math.min(1, x)); return v * v * (3 - 2 * v); };
  if (t < SONNE.auf) return 1 - s((t - (SONNE.auf - 0.08)) / 0.1);
  if (t > SONNE.unter) return s((t - SONNE.unter) / 0.1);
  return 0;
}

// Sonnenstand: Höhe 0…1 über dem Horizont und Lauf von Osten (+x) nach Westen (−x)
export function sonnenstand(t01) {
  const t = wrap01(t01);
  if (t < SONNE.auf || t > SONNE.unter) return { oben: false, hoehe: 0, lauf: t < SONNE.auf ? 0 : 1 };
  const u = (t - SONNE.auf) / (SONNE.unter - SONNE.auf);
  return { oben: true, hoehe: Math.sin(u * Math.PI), lauf: u };
}

// Versatz des Sonnenlichts relativ zum Spieler (für sunLight.position = spieler + sunOffset(t));
// nachts leuchtet der Mond flach von Westen
export function sunOffset(t01) {
  const s = sonnenstand(t01);
  if (!s.oben) return { x: -24, y: 30, z: 14 };
  const dx = Math.cos(s.lauf * Math.PI) * 38;
  return { x: dx, y: 10 + 34 * s.hoehe, z: 14 };
}

// Position der Sonnen-Kulisse am Himmel (weit weg, Bogen Ost → West); sichtbar nur wenn oben
export function sonnenPosition(t01, { radius = 190, hoehe = 70, z = -170 } = {}) {
  const s = sonnenstand(t01);
  const x = Math.cos(s.lauf * Math.PI) * radius;
  return { x, y: 6 + hoehe * s.hoehe, z, sichtbar: s.oben && s.hoehe > 0.02 };
}

// Stimmung der Sonne: morgens verpennt, mittags selig, abends müde; nachts schläft (der Mond)
export function sonnenStimmung(t01) {
  const t = wrap01(t01);
  if (t < SONNE.auf || t > SONNE.unter) return 'schlaeft';
  if (t < 0.32) return 'muede';
  if (t > 0.66) return 'muede';
  return 'selig';
}
