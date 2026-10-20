// game.js — Mechanik v0 als reine Funktionen (kein Three.js, kein DOM): Spielzustand (Geld, Ware, Heat, Tag),
// Kundschaft-Normalisierung, Verkaufen/Ablehnen, Verhaftung + neuer Tag, Gesprächs-Zustandsautomat,
// Schlendern der Kunden, Hinschau-Kamera. Getestet mit `node --test`.

export const START_WARE = 5;
export const MAX_HEAT = 3;
export const TALK_DIST = 3.2;     // so nah muss man ran für E/F
export const SHOES = ['sandale', 'flipflop', 'turnschuh', 'barfuss', 'gummistiefel'];
export const SHIRTS = ['hawaii', 'polo_sauber', 'tanktop', 'ohne', 'uniform_versteckt', 'hawaii_neu', 'kittel', 'trikot'];
export const ACCESSORIES = [null, 'cap', 'ohrknopf', 'hund', 'rucksack', 'sonnenbrille', 'kamera', 'surfbrett', 'gehstock', 'handy', 'kopfhoerer'];
// optionale Content-Felder (alles darf fehlen)
export const PANTS = ['shorts', 'badehose', 'chino', 'jogginghose', 'rock', 'lang'];
export const SKINTONES = ['hell', 'mittel', 'dunkel', 'sonnenbrand'];
export const BEARDS = ['keiner', 'stoppel', 'schnauzer', 'vollbart'];
export const GLASSES = ['keine', 'lesebrille', 'sonnenbrille', 'sportbrille'];
export const HAIRS = ['kurz', 'lang', 'lockig', 'dutt', 'weiss', 'glatze'];
export const MOODS = ['neutral', 'misstrauisch', 'erschrocken', 'zufrieden', 'selig'];
export const EXTRAS = ['socken', 'preisschild', 'stirnband', 'halstuch_hund', 'funkgeraet', 'strohhut', 'cocktail', 'rollator', 'einkaufskorb', 'pulsuhr', 'buegelfalte', 'nass', 'bändchen', 'baendchen', 'schwitzt', 'notizblock'];
export const SPAWNS = ['K1', 'K2', 'K3', 'K4', 'K5', 'K6'];

export function initialState() {
  return { geld: 0, ware: START_WARE, heat: 0, tag: 1, status: {}, verhaftet: false };
}

// ---------- Kundschaft: fehlende/kaputte Felder robust auffüllen ----------
const DEFAULT_SAETZE = {
  gruss: ['Hey.'], kauf: ['Danke, Mann.'], ablehnung: ['Auch gut.'], reveal: ['Zentrale, Zielperson hat angebissen.'],
};
export function normalizeKunde(raw, i = 0) {
  const k = raw && typeof raw === 'object' ? raw : {};
  const arr = (v, fallback) => (Array.isArray(v) && v.length && v.every((s) => typeof s === 'string') ? v : fallback);
  const s = k.saetze && typeof k.saetze === 'object' ? k.saetze : {};
  const heat = Number.isFinite(k.heat) ? Math.max(0, Math.min(MAX_HEAT, Math.round(k.heat))) : (k.zivi ? 2 : 0);
  const pick = (v, list, fallback) => (list.includes(v) ? v : fallback);
  const extras = Array.isArray(k.extras) ? k.extras.filter((e) => typeof e === 'string' && EXTRAS.includes(e)) : [];
  const tempo = Number.isFinite(k.tempo) ? Math.max(0.3, Math.min(2, k.tempo)) : 1;
  return {
    name: typeof k.name === 'string' && k.name.trim() ? k.name.trim() : null,
    hose: pick(k.hose, PANTS, null),
    hautton: pick(k.hautton, SKINTONES, 'mittel'),
    bart: pick(k.bart, BEARDS, 'keiner'),
    brille: pick(k.brille, GLASSES, 'keine'),
    haare: pick(k.haare, HAIRS, 'kurz'),
    extras,
    stimmung_start: pick(k.stimmung_start, MOODS, 'neutral'),
    tempo,
    spawn: pick(k.spawn, SPAWNS, null),
    id: typeof k.id === 'string' && k.id ? k.id : `kunde_${i + 1}`,
    typ: typeof k.typ === 'string' && k.typ ? k.typ : 'Strandgast',
    schuhe: SHOES.includes(k.schuhe) ? k.schuhe : 'sandale',
    hemd: SHIRTS.includes(k.hemd) ? k.hemd : 'hawaii',
    accessoire: ACCESSORIES.includes(k.accessoire) ? k.accessoire : null,
    zivi: k.zivi === true,
    zahlt: Number.isFinite(k.zahlt) ? Math.max(0, Math.round(k.zahlt)) : 20,
    heat,
    saetze: {
      gruss: arr(s.gruss, DEFAULT_SAETZE.gruss),
      kauf: arr(s.kauf, DEFAULT_SAETZE.kauf),
      ablehnung: arr(s.ablehnung, DEFAULT_SAETZE.ablehnung),
      reveal: arr(s.reveal, DEFAULT_SAETZE.reveal),
    },
  };
}
export function normalizeKatalog(json) {
  const list = json && Array.isArray(json.kunden) ? json.kunden : Array.isArray(json) ? json : [];
  const seen = new Set();
  return list.map((raw, i) => {
    const k = normalizeKunde(raw, i);
    while (seen.has(k.id)) k.id += '_';
    seen.add(k.id);
    return k;
  });
}

// deterministische Satzwahl: idx wird vom Aufrufer gezählt (Tests) oder zufällig gegeben
export function pickLine(list, idx = 0) {
  if (!list || !list.length) return '';
  return list[((idx % list.length) + list.length) % list.length];
}

// ---------- Verkauf / Ablehnen / Heat ----------
export function kundeStatus(state, id) { return state.status[id] || 'neutral'; }

export function sell(state, kunde, lineIdx = 0) {
  if (state.verhaftet) return { state, result: 'verhaftet', text: '' };
  if (kundeStatus(state, kunde.id) !== 'neutral') return { state, result: 'schon_erledigt', text: '' };
  if (state.ware <= 0) return { state, result: 'keine_ware', text: 'Alles leer, Mann. Morgen wieder.' };
  if (kunde.zivi) {
    const heat = Math.min(MAX_HEAT, state.heat + Math.max(1, kunde.heat));
    const next = { ...state, heat, status: { ...state.status, [kunde.id]: 'misstrauisch' }, verhaftet: heat >= MAX_HEAT };
    return { state: next, result: 'reveal', text: pickLine(kunde.saetze.reveal, lineIdx), heatPlus: heat - state.heat };
  }
  const next = {
    ...state, geld: state.geld + kunde.zahlt, ware: state.ware - 1,
    status: { ...state.status, [kunde.id]: 'zufrieden' },
  };
  return { state: next, result: 'kauf', text: pickLine(kunde.saetze.kauf, lineIdx), geldPlus: kunde.zahlt };
}

export function decline(state, kunde, lineIdx = 0) {
  if (kundeStatus(state, kunde.id) !== 'neutral') return { state, result: 'schon_erledigt', text: '' };
  const next = { ...state, status: { ...state.status, [kunde.id]: 'abgelehnt' } };
  return { state: next, result: 'ablehnung', text: pickLine(kunde.saetze.ablehnung, lineIdx) };
}

export const isArrested = (state) => state.heat >= MAX_HEAT || state.verhaftet;

// Verhaftung mild: Tag verloren, Ware weg, Geld bleibt, alle Kunden wieder neutral
export function newDay(state) {
  return { geld: state.geld, ware: START_WARE, heat: 0, tag: state.tag + 1, status: {}, verhaftet: false };
}

// Heat als Text/Icons für das HUD
export function heatLabel(heat) {
  const n = Math.max(0, Math.min(MAX_HEAT, heat));
  return '🚨'.repeat(n) + '·'.repeat(MAX_HEAT - n);
}

// ---------- Gespräch (Zustandsautomat) ----------
// phase: 'gruss' → 'wahl' → 'ergebnis' → (Ende)
export function startDialog(kunde, state, lineIdx = 0) {
  const st = kundeStatus(state, kunde.id);
  if (st !== 'neutral') {
    const text = st === 'zufrieden' ? 'Alles gut bei mir, Mann.' : st === 'misstrauisch' ? '…' : pickLine(kunde.saetze.ablehnung, lineIdx);
    return { kundeId: kunde.id, phase: 'ergebnis', text, options: [], result: 'schon_erledigt' };
  }
  return { kundeId: kunde.id, phase: 'gruss', text: pickLine(kunde.saetze.gruss, lineIdx), options: ['Weiter'] };
}
export function advanceDialog(dialog) {
  if (!dialog) return null;
  if (dialog.phase === 'gruss') return { ...dialog, phase: 'wahl', text: 'Was läuft?', options: ['Verkaufen', 'Lieber nicht'] };
  if (dialog.phase === 'ergebnis') return null; // Gespräch zu Ende
  return dialog;
}
export function chooseOption(state, dialog, kunde, option, lineIdx = 0) {
  if (!dialog || dialog.phase !== 'wahl') return { state, dialog };
  const r = option === 'Verkaufen' || option === 0 ? sell(state, kunde, lineIdx) : decline(state, kunde, lineIdx);
  return { state: r.state, dialog: { ...dialog, phase: 'ergebnis', text: r.text, options: ['Weiter'], result: r.result, geldPlus: r.geldPlus, heatPlus: r.heatPlus } };
}

// Stimmung des Kunden aus Status (für Mimik: setMood)
export function moodFor(status) {
  return { zufrieden: 'zufrieden', misstrauisch: 'misstrauisch', abgelehnt: 'neutral', neutral: 'neutral' }[status] || 'neutral';
}

// ---------- Nähe ----------
export function nearestKunde(player, kunden, maxDist = TALK_DIST) {
  let best = null, bestD = maxDist;
  for (const k of kunden) {
    const d = Math.hypot(k.x - player.x, k.z - player.z);
    if (d < bestD) { best = k; bestD = d; }
  }
  return best;
}

// ---------- Schlendern zwischen 2–3 Punkten, mit Pausen ----------
// npc: { x, z, yaw, points: [{x,z}], idx, pause, speed }
export function wanderStep(npc, dt, { pauseTime = 2.5, arrive = 0.3 } = {}) {
  if (!npc.points || npc.points.length < 2) return { ...npc, moving: false };
  if (npc.pause > 0) return { ...npc, pause: Math.max(0, npc.pause - dt), moving: false };
  const p = npc.points[npc.idx % npc.points.length];
  const dx = p.x - npc.x, dz = p.z - npc.z;
  const d = Math.hypot(dx, dz);
  if (d <= arrive) return { ...npc, idx: (npc.idx + 1) % npc.points.length, pause: pauseTime, moving: false };
  const step = Math.min(d, npc.speed * dt);
  return { ...npc, x: npc.x + (dx / d) * step, z: npc.z + (dz / d) * step, yaw: Math.atan2(dx, dz), moving: true };
}

// ---------- Hinschau-Kamera: vor der Figur, Füße bis Kopf im Bild ----------
export function inspectCamera(npc, viewer, { dist = 5.4, height = 1.8, targetY = 1.4, angle = 1.1 } = {}) {
  // Richtung Spieler, aber um `angle` zur Seite gedreht: sonst steht die Kamera hinter dem Spieler und sieht
  // dessen Rücken statt des Kunden
  let dx = viewer.x - npc.x, dz = viewer.z - npc.z;
  const d = Math.hypot(dx, dz);
  if (d < 1e-6) { dx = Math.sin(npc.yaw); dz = Math.cos(npc.yaw); } else { dx /= d; dz /= d; }
  const c = Math.cos(angle), s = Math.sin(angle);
  const rx = dx * c - dz * s, rz = dx * s + dz * c;
  return {
    x: npc.x + rx * dist, y: height, z: npc.z + rz * dist,
    tx: npc.x, ty: targetY, tz: npc.z,
  };
}
// Kopf des Kunden Richtung Spieler, wenn nah (sonst Blick geradeaus)
export function kundeLookYaw(k, player, maxDist = 7, maxTurn = 1.0) {
  const d = Math.hypot(player.x - k.x, player.z - k.z);
  if (d > maxDist) return 0;
  const want = Math.atan2(player.x - k.x, player.z - k.z) - k.yaw;
  const rel = Math.atan2(Math.sin(want), Math.cos(want));
  return Math.max(-maxTurn, Math.min(maxTurn, rel));
}

// ---------- Auswahl der Kundschaft für den Strand: n Kunden, davon mindestens minZivi Zivis (falls vorhanden) ----------
export const KUNDEN_PRO_TAG = 7;
export function pickKunden(katalog, n = KUNDEN_PRO_TAG, minZivi = 2, day = 1) {
  const zivis = katalog.filter((k) => k.zivi);
  const others = katalog.filter((k) => !k.zivi);
  const take = Math.min(n, katalog.length);
  // Zivis rotieren pro Tag (Tag 1: z1+z2, Tag 2: z2+z3, …), damit man über die Tage alle Fallen sieht
  const zCount = Math.min(minZivi, take, zivis.length);
  const start = zivis.length ? ((day - 1) % zivis.length + zivis.length) % zivis.length : 0;
  const z = [];
  for (let i = 0; i < zCount; i++) z.push(zivis[(start + i) % zivis.length]);
  const o = others.slice(0, take - z.length);
  // bei zu wenig Unbedenklichen mit weiteren Zivis auffüllen
  const rest = zivis.filter((k) => !z.includes(k)).slice(0, take - z.length - o.length);
  const chosen = [...o, ...z, ...rest];
  // Reihenfolge wie im Katalog beibehalten (Spawn-Plätze folgen der Katalogreihenfolge)
  return katalog.filter((k) => chosen.includes(k));
}

// Stabiler Seed aus der Kunden-id (gleicher Kunde = gleiches Gesicht/Statur, auch wenn sich die Reihenfolge ändert)
export function idSeed(id) {
  let h = 2166136261;
  for (const ch of String(id)) { h ^= ch.charCodeAt(0); h = Math.imul(h, 16777619) >>> 0; }
  return (h % 100000) + 1;
}
