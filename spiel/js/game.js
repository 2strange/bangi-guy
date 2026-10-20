// game.js — Mechanik v0 als reine Funktionen (kein Three.js, kein DOM): Spielzustand (Geld, Ware, Heat, Tag),
// Kundschaft-Normalisierung, Verkaufen/Ablehnen, Verhaftung + neuer Tag, Gesprächs-Zustandsautomat,
// Schlendern der Kunden, Hinschau-Kamera. Getestet mit `node --test`.

export const START_WARE = 5;
// Nimmt ein Zivi beim „Verkauf“ den Beutel mit (Ware −1, Bilanz „an die Polizei“)? Entscheid steht noch aus —
// ein Wert zum Umschalten. sell() nimmt die Option auch pro Aufruf entgegen, damit Tests beide Fälle prüfen.
export const ZIVI_BESCHLAGNAHMT = true;
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
  return { geld: 0, ware: START_WARE, heat: 0, tag: 1, status: {}, verhaftet: false, verkauftHeute: 0, geldHeute: 0, anZivisHeute: 0 };
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

export function sell(state, kunde, lineIdx = 0, { beschlagnahmt = ZIVI_BESCHLAGNAHMT } = {}) {
  if (state.verhaftet) return { state, result: 'verhaftet', text: '' };
  if (kundeStatus(state, kunde.id) !== 'neutral') return { state, result: 'schon_erledigt', text: '' };
  if (state.ware <= 0) return { state, result: 'keine_ware', text: pickLine(state.texte?.ausverkauft_kunde, lineIdx) || 'Alles leer, Mann. Morgen wieder.' };
  if (kunde.zivi) {
    // Der Beutel ist weg (an die Polizei), Geld gibt es keins
    const heat = Math.min(MAX_HEAT, state.heat + Math.max(1, kunde.heat));
    const next = {
      ...state, heat,
      ware: beschlagnahmt ? state.ware - 1 : state.ware,
      anZivisHeute: (state.anZivisHeute || 0) + (beschlagnahmt ? 1 : 0),
      status: { ...state.status, [kunde.id]: 'misstrauisch' }, verhaftet: heat >= MAX_HEAT,
    };
    return { state: next, result: 'reveal', text: pickLine(kunde.saetze.reveal, lineIdx), heatPlus: heat - state.heat };
  }
  const next = {
    ...state, geld: state.geld + kunde.zahlt, ware: state.ware - 1,
    verkauftHeute: (state.verkauftHeute || 0) + 1, geldHeute: (state.geldHeute || 0) + kunde.zahlt,
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
  return { ...state, geld: state.geld, ware: START_WARE, heat: 0, tag: state.tag + 1, status: {}, verhaftet: false, verkauftHeute: 0, geldHeute: 0, anZivisHeute: 0 };
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

// ---------- Texte (data/texte.json, robust mit Platzhaltern) ----------
// Schema der Datei: ausverkauft[] · tagesende{gut[], heat[], nichts[], verhaftet[]} (Bilanz-Spruch nach Lage) ·
// reveal_gags[] und mentor[] (hier noch nicht genutzt). Alles optional, Unbekanntes fällt auf Standardtexte zurück.
export const LAGEN = ['gut', 'heat', 'nichts', 'verhaftet'];
export const DEFAULT_TEXTE = {
  ausverkauft: ['Ausverkauft! Ab zum Mentor auf die Kuppe – oder Feierabend an der Bar.'],
  ausverkauft_kunde: ['Alles leer, Mann. Morgen wieder.'],
  tagesende: {
    gut: ['Guter Tag. Kasse voll, Heat kalt.'],
    heat: ['Tag überstanden. Aber die Streife kennt jetzt deine Sandalen.'],
    nichts: ['Null verkauft. Immerhin: null verhaftet.'],
    verhaftet: ['Tag verloren. Die Ware ist weg, das Geld bleibt.'],
  },
  bilanz: ['Tag {tag}: {weg} Beutel weg{polizei}, {geldHeute} Münzen dazu.', 'Kasse: {geld} · Heat: {heatLabel}'],
  polizei: ' ({anZivis} an die Polizei 🙈)',
  titel: { feierabend: 'Feierabend.', verhaftet: 'VERHAFTET.' },
  optionen: { tag_beenden: 'Tag beenden', weiter: 'Weiterbummeln', neuer_tag: 'Neuer Tag' },
  reveal_gags: [],
};
const strList = (v, fallback) => (Array.isArray(v) && v.length && v.every((x) => typeof x === 'string' && x.trim()) ? v : fallback);
const str = (v, fallback) => (typeof v === 'string' && v.trim() ? v : fallback);
export function normalizeTexte(json) {
  const t = json && typeof json === 'object' ? json : {};
  const te = t.tagesende && typeof t.tagesende === 'object' ? t.tagesende : {};
  const op = t.optionen && typeof t.optionen === 'object' ? t.optionen : {};
  const ti = t.titel && typeof t.titel === 'object' ? t.titel : {};
  const tagesende = {};
  for (const l of LAGEN) tagesende[l] = strList(te[l], DEFAULT_TEXTE.tagesende[l]);
  return {
    ausverkauft: strList(t.ausverkauft, DEFAULT_TEXTE.ausverkauft),
    ausverkauft_kunde: strList(t.ausverkauft_kunde, DEFAULT_TEXTE.ausverkauft_kunde),
    tagesende,
    bilanz: strList(t.bilanz, DEFAULT_TEXTE.bilanz),
    polizei: str(t.polizei, DEFAULT_TEXTE.polizei),
    reveal_gags: normalizeGags(t.reveal_gags),
    titel: { feierabend: str(ti.feierabend, DEFAULT_TEXTE.titel.feierabend), verhaftet: str(ti.verhaftet, DEFAULT_TEXTE.titel.verhaftet) },
    optionen: {
      tag_beenden: str(op.tag_beenden, DEFAULT_TEXTE.optionen.tag_beenden),
      weiter: str(op.weiter, DEFAULT_TEXTE.optionen.weiter),
      neuer_tag: str(op.neuer_tag, DEFAULT_TEXTE.optionen.neuer_tag),
    },
  };
}
// Reveal-Gags (gags.js spielt sie): id, wann (kauf|ablehnung|immer), gag, mood, extra, dauer_s — kaputte Einträge fliegen raus
export const GAG_WANN = ['kauf', 'ablehnung', 'immer'];
export function normalizeGags(list) {
  if (!Array.isArray(list)) return [];
  return list.filter((g) => g && typeof g === 'object' && typeof g.id === 'string' && g.id && GAG_WANN.includes(g.wann))
    .map((g) => ({
      id: g.id, wann: g.wann, gag: str(g.gag, ''), mood: MOODS.includes(g.mood) ? g.mood : null,
      extra: typeof g.extra === 'string' && g.extra ? g.extra : null,
      dauer_s: Number.isFinite(g.dauer_s) && g.dauer_s > 0 ? Math.min(10, g.dauer_s) : 1.5,
    }));
}
export const gagFor = (texte, id, wann) => (texte?.reveal_gags || []).find((g) => g.id === id && g.wann === wann) || null;
// Idle-Gag-Takt: alle 6–10 s (deterministisch aus Zähler)
export const nextIdleGagDelay = (n = 0) => 6 + ((n * 7919) % 400) / 100;
// Platzhalter {name} füllen; unbekannte bleiben stehen
export function fillText(tpl, vars) {
  return String(tpl).replace(/\{(\w+)\}/g, (m, k) => (vars[k] !== undefined ? String(vars[k]) : m));
}
// Tagesbilanz als Variablen für die Texte
export function dayReport(state) {
  const verkauft = state.verkauftHeute || 0, anZivis = state.anZivisHeute || 0;
  return { tag: state.tag, verkauft, anZivis, weg: verkauft + anZivis, uebrig: state.ware, geldHeute: state.geldHeute || 0, geld: state.geld, heat: state.heat, heatLabel: heatLabel(state.heat), verhaftet: isArrested(state) };
}
// Lage für den Bilanz-Spruch: verhaftet > nichts verkauft > Heat 2+ > gut
export function lageFor(report) {
  if (report.verhaftet) return 'verhaftet';
  if (!report.verkauft) return 'nichts';
  if (report.heat >= 2) return 'heat';
  return 'gut';
}
// Fertige Tagesend-Karte: Titel, Lage-Spruch, Bilanzzeilen, Button
export function dayEndCard(state, texte, lineIdx = 0) {
  const t = texte || DEFAULT_TEXTE;
  const vars = dayReport(state);
  vars.polizei = vars.anZivis > 0 ? fillText(t.polizei, vars) : '';
  const lage = lageFor(vars);
  return {
    titel: lage === 'verhaftet' ? t.titel.verhaftet : t.titel.feierabend,
    spruch: fillText(pickLine(t.tagesende[lage], lineIdx), vars),
    zeilen: t.bilanz.map((z) => fillText(z, vars)),
    button: t.optionen.neuer_tag,
    lage,
  };
}
// Ausverkauft-Dialog (Sprechblase des Spielers selbst): Tag beenden oder weiterbummeln
export function soldOutDialog(texte, lineIdx = 0) {
  const t = texte || DEFAULT_TEXTE;
  return { kundeId: null, phase: 'ausverkauft', text: pickLine(t.ausverkauft, lineIdx), options: [t.optionen.tag_beenden, t.optionen.weiter] };
}
export const isSoldOut = (state) => state.ware <= 0;

// ---------- Outfits ohne Wiederholung pro Tag ----------
export const SHIRT_PATTERNS = ['blumen', 'streifen', 'punkte', 'palmen'];
export const SHIRT_COLORS = ['#3a7bd5', '#3bb84a', '#9b59b6', '#e8463a', '#ffd54a', '#3dd6e0'];
// Zahl der Varianten je Hemd-Typ (Muster × Farbe bzw. nur Farbe)
export function variantCount(hemd) {
  return hemd === 'hawaii' || hemd === 'hawaii_neu' ? SHIRT_PATTERNS.length * SHIRT_COLORS.length : SHIRT_COLORS.length;
}
export function variantOf(hemd, idx) {
  const n = variantCount(hemd);
  const i = ((idx % n) + n) % n;
  if (hemd === 'hawaii' || hemd === 'hawaii_neu') return { pattern: SHIRT_PATTERNS[i % SHIRT_PATTERNS.length], color: SHIRT_COLORS[Math.floor(i / SHIRT_PATTERNS.length)] };
  return { pattern: 'uni', color: SHIRT_COLORS[i] };
}
/** Weist den Kunden eines Tages Varianten zu: gleicher Hemd-Typ → verschiedene Varianten (solange es genug gibt). */
export function assignOutfits(kunden, day = 1) {
  const used = {}; // hemd -> Set(idx)
  const out = {};
  for (const k of kunden) {
    const n = variantCount(k.hemd);
    const taken = used[k.hemd] || (used[k.hemd] = new Set());
    let idx = (idSeed(k.id) + day * 7) % n;
    for (let tries = 0; tries < n && taken.has(idx); tries++) idx = (idx + 1) % n;
    taken.add(idx);
    out[k.id] = { idx, ...variantOf(k.hemd, idx) };
  }
  return out;
}
// Schlüssel „Hemd-Typ + Farbe/Muster + Accessoire“ — pro Tag eindeutig
export const outfitKey = (k, o) => `${k.hemd}|${o.pattern}|${o.color}|${k.accessoire}`;
