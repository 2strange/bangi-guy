// game.js — Mechanik v0 als reine Funktionen (kein Three.js, kein DOM): Spielzustand (Geld, Ware, Heat, Tag),
// Kundschaft-Normalisierung, Verkaufen/Ablehnen, Verhaftung + neuer Tag, Gesprächs-Zustandsautomat,
// Schlendern der Kunden, Hinschau-Kamera. Getestet mit `node --test`.

export const START_WARE = 5;
export const MAX_WARE = 15; // Taschen-Maximum: darüber gibt der Mentor nichts mehr („voll“)
// Nimmt ein Zivi beim „Verkauf“ den Beutel mit (Ware −1, Bilanz „an die Polizei“)? Entscheid steht noch aus —
// ein Wert zum Umschalten. sell() nimmt die Option auch pro Aufruf entgegen, damit Tests beide Fälle prüfen.
export const ZIVI_BESCHLAGNAHMT = true;
export const MAX_HEAT = 3;
export const TALK_DIST = 3.2;     // so nah muss man ran für E/F
export const SHOES = ['sandale', 'flipflop', 'turnschuh', 'barfuss', 'gummistiefel'];
export const SHIRTS = ['hawaii', 'polo_sauber', 'tanktop', 'ohne', 'uniform_versteckt', 'hawaii_neu', 'kittel', 'trikot'];
export const ACCESSORIES = [null, 'cap', 'ohrknopf', 'hund', 'rucksack', 'sonnenbrille', 'kamera', 'surfbrett', 'gehstock', 'handy', 'kopfhoerer', 'fischkiste', 'bierdose'];
// optionale Content-Felder (alles darf fehlen)
export const PANTS = ['shorts', 'badehose', 'chino', 'jogginghose', 'rock', 'lang'];
export const SKINTONES = ['hell', 'mittel', 'dunkel', 'sonnenbrand'];
export const BEARDS = ['keiner', 'stoppel', 'schnauzer', 'vollbart'];
export const GLASSES = ['keine', 'lesebrille', 'sonnenbrille', 'sportbrille'];
export const HAIRS = ['kurz', 'lang', 'lockig', 'dutt', 'weiss', 'glatze'];
export const MOODS = ['neutral', 'misstrauisch', 'erschrocken', 'zufrieden', 'selig'];
export const EXTRAS = ['socken', 'preisschild', 'stirnband', 'halstuch_hund', 'funkgeraet', 'strohhut', 'cocktail', 'rollator', 'einkaufskorb', 'pulsuhr', 'buegelfalte', 'nass', 'bändchen', 'baendchen', 'schwitzt', 'notizblock',
  'schuerze', 'fischgeruch', 'bauchtasche', 'sonnenbrand_streifen', 'riesenhut', 'faecher', 'kreuzfahrt_baendchen', 'rucksack_leer', 'faehrenticket', 'handschellen_umriss'];
export const SPAWNS = ['K1', 'K2', 'K3', 'K4', 'K5', 'K6'];

export function initialState() {
  return { geld: 0, ware: START_WARE, heat: 0, tag: 1, status: {}, verhaftet: false, verkauftHeute: 0, geldHeute: 0, anZivisHeute: 0, mangos: 0, tageOhneVorfall: 0 };
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
    stimme: typeof k.stimme === 'string' && k.stimme.trim() ? k.stimme.trim() : null,
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

export function sell(state, kunde, lineIdx = 0, { beschlagnahmt = ZIVI_BESCHLAGNAHMT, posten = null, pos = null } = {}) {
  if (state.verhaftet) return { state, result: 'verhaftet', text: '' };
  if (kundeStatus(state, kunde.id) !== 'neutral') return { state, result: 'schon_erledigt', text: '' };
  if (state.ware <= 0) return { state, result: 'keine_ware', text: pickLine(state.texte?.ausverkauft_kunde, lineIdx) || 'Alles leer, Mann. Morgen wieder.' };
  if (kunde.zivi) {
    // Der Beutel ist weg (an die Polizei), Geld gibt es keins; in Sichtweite des Postens doppelt Heat
    const mult = posten && pos && inPostenSicht(pos, posten) ? 2 : 1;
    const heat = Math.min(MAX_HEAT, state.heat + Math.max(1, kunde.heat) * mult);
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
// Streife P2 (Hotelstrand ↔ Furt ↔ Pier) läuft erst ab Tag 2, damit Tag 1 ruhiger bleibt
export const STREIFE_P2_AB_TAG = 2;
export const streifeP2Aktiv = (state) => (state.tag || 1) >= STREIFE_P2_AB_TAG;

// Verhaftung mild: Tag verloren, Ware weg, Geld bleibt, alle Kunden wieder neutral
export const NACHT_ABKUEHLUNG = { bar: 2, haengematte: 1 };
export function newDay(state, { nacht = 'bar' } = {}) {
  // Tafel „Tage ohne Vorfall“: zählt hoch, springt bei einer Verhaftung auf 0
  const tageOhneVorfall = isArrested(state) ? 0 : (state.tageOhneVorfall || 0) + 1;
  // Über Nacht kühlt der Heat: Bar −2, Hängematte −1; nach einer Verhaftung ist er ohnehin abgegolten (0)
  const heat = isArrested(state) ? 0 : Math.max(0, state.heat - (NACHT_ABKUEHLUNG[nacht] ?? NACHT_ABKUEHLUNG.bar));
  // Restware bleibt über Nacht in der Tasche (Nachschub gibt es morgens beim Mentor obendrauf); nach einer Verhaftung ist sie weg
  const ware = isArrested(state) ? 0 : state.ware;
  return { ...state, geld: state.geld, ware, heat, tag: state.tag + 1, status: {}, verhaftet: false, verkauftHeute: 0, geldHeute: 0, anZivisHeute: 0, tageOhneVorfall };
}

// Heat als Text/Icons für das HUD
export function heatLabel(heat) {
  const n = Math.max(0, Math.min(MAX_HEAT, heat));
  return '🚨'.repeat(n) + '·'.repeat(MAX_HEAT - n);
}

// ---------- Gespräch (Zustandsautomat) ----------
// phase: 'gruss' → 'wahl' → 'ergebnis' → (Ende)
export function startDialog(kunde, state, lineIdx = 0, texte = null) {
  const T = texte || DEFAULT_TEXTE;
  const st = kundeStatus(state, kunde.id);
  if (st !== 'neutral') {
    const text = st === 'zufrieden' ? 'Alles gut bei mir, Mann.' : st === 'misstrauisch' ? '…' : pickLine(kunde.saetze.ablehnung, lineIdx);
    return { kundeId: kunde.id, phase: 'ergebnis', text, options: [], result: 'schon_erledigt' };
  }
  return { kundeId: kunde.id, phase: 'gruss', text: pickLine(kunde.saetze.gruss, lineIdx), options: [T.dialog.weiter] };
}
export function advanceDialog(dialog, texte = null) {
  const T = texte || DEFAULT_TEXTE;
  if (!dialog) return null;
  if (dialog.phase === 'gruss') return { ...dialog, phase: 'wahl', text: T.dialog.was_laeuft, options: [T.dialog.verkaufen, T.dialog.lieber_nicht] };
  if (dialog.phase === 'ergebnis') return null; // Gespräch zu Ende
  return dialog;
}
// option: Index (0 = verkaufen) oder Beschriftung — Index ist sprachunabhängig
export function chooseOption(state, dialog, kunde, option, lineIdx = 0, sellOpts = undefined, texte = null) {
  const T = texte || DEFAULT_TEXTE;
  if (!dialog || dialog.phase !== 'wahl') return { state, dialog };
  const verkaufen = option === 0 || option === T.dialog.verkaufen || option === 'Verkaufen';
  const r = verkaufen ? sell(state, kunde, lineIdx, sellOpts) : decline(state, kunde, lineIdx);
  return { state: r.state, dialog: { ...dialog, phase: 'ergebnis', text: r.text, options: [T.dialog.weiter], result: r.result, geldPlus: r.geldPlus, heatPlus: r.heatPlus } };
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
  bilanz: ['Tag {tag}: {weg} Beutel weg{polizei}, {geldHeute} Münzen dazu.', 'Kasse: {geld} · Heat: {heatLabel}', 'Tage ohne Vorfall: {tage}'],
  polizei: ' ({anZivis} an die Polizei 🙈)',
  titel: { feierabend: 'Feierabend.', verhaftet: 'VERHAFTET.' },
  optionen: { tag_beenden: 'Tag beenden', weiter: 'Weiterbummeln', neuer_tag: 'Neuer Tag' },
  dialog: { was_laeuft: 'Was läuft?', verkaufen: 'Verkaufen', lieber_nicht: 'Lieber nicht', weiter: 'Weiter', hinschauen: 'Genau hinschauen', beenden: 'Beenden' },
  heat_label: { 0: 'kalt', 1: 'lauwarm', 2: 'heiß', 3: 'FAHNDUNG' },
  // Optionen-Menü (⚙): Oberflächen-Beschriftungen, Content kann sie unter ui.menue{} übersetzen
  menue: { titel: 'Optionen', sprache: 'Textsprache', beschlagnahme: 'Zivi nimmt die Ware ab', musik: 'Musik', ton: 'Ton', an: 'an', aus: 'aus', schliessen: 'Schließen', hinweis: 'Stimmen bleiben Englisch.' },
  // Startkarte bei vorhandenem Spielstand
  start: { titel: 'Bangi Beach', stand: 'Spielstand: Tag {tag} · {geld} Münzen · {ware} Beutel', weiter: 'Weiter', neu: 'Neues Spiel' },
  reveal_gags: [],
};
const strList = (v, fallback) => (Array.isArray(v) && v.length && v.every((x) => typeof x === 'string' && x.trim()) ? v : fallback);
const str = (v, fallback) => (typeof v === 'string' && v.trim() ? v : fallback);
// Oberflächen-Texte liegen in texte.json unter ui{} (ältere Dateien: oben) — beide Orte werden gelesen
export function normalizeTexte(json) {
  const t = json && typeof json === 'object' ? json : {};
  const u = t.ui && typeof t.ui === 'object' ? t.ui : {};
  const pick = (key) => (u[key] !== undefined ? u[key] : t[key]);
  const obj = (v) => (v && typeof v === 'object' ? v : {});
  const te = obj(t.tagesende);
  const op = obj(pick('optionen')), ti = obj(pick('titel')), di = obj(pick('dialog')), hl = obj(pick('heat_label')), me = obj(pick('menue')), sta = obj(pick('start'));
  const tagesende = {};
  for (const l of LAGEN) tagesende[l] = strList(te[l], DEFAULT_TEXTE.tagesende[l]);
  const strMap = (src, defaults) => Object.fromEntries(Object.keys(defaults).map((k) => [k, str(src[k], defaults[k])]));
  return {
    ausverkauft: strList(t.ausverkauft, DEFAULT_TEXTE.ausverkauft),
    ausverkauft_kunde: strList(pick('ausverkauft_kunde'), DEFAULT_TEXTE.ausverkauft_kunde),
    tagesende,
    bilanz: strList(pick('bilanz'), DEFAULT_TEXTE.bilanz),
    polizei: str(pick('polizei'), DEFAULT_TEXTE.polizei),
    reveal_gags: normalizeGags(t.reveal_gags),
    titel: strMap(ti, DEFAULT_TEXTE.titel),
    optionen: strMap(op, DEFAULT_TEXTE.optionen),
    dialog: strMap(di, DEFAULT_TEXTE.dialog),
    heat_label: strMap(hl, DEFAULT_TEXTE.heat_label),
    menue: strMap(me, DEFAULT_TEXTE.menue),
    start: strMap(sta, DEFAULT_TEXTE.start),
  };
}

// ---------- Sprache: zweite Datei je Quelle (texte.en.json, kunden.en.json), Deep-Merge mit DE als Fallback ----------
export const SPRACHEN = ['de', 'en'];
/** EN-Knoten ersetzen DE-Knoten nur, wo sie passen: Strings 1:1, String-Listen gleicher Länge komplett (Zeilenzähler
 *  bleibt synchron), Objekte rekursiv; Zahlen/Booleans/ids/fehlende Zweige bleiben DE. */
export function mergeTexte(de, en) {
  if (en === undefined || en === null) return de;
  if (typeof de === 'string') return typeof en === 'string' && en.trim() ? en : de;
  if (Array.isArray(de)) {
    if (!Array.isArray(en) || en.length !== de.length) return de;
    if (de.every((x) => typeof x === 'string')) return en.every((x) => typeof x === 'string' && x.trim()) ? en : de;
    return de.map((x, i) => mergeTexte(x, en[i]));
  }
  if (de && typeof de === 'object') {
    if (!en || typeof en !== 'object' || Array.isArray(en)) return de;
    const out = { ...de };
    for (const k of Object.keys(de)) if (k !== 'id' && k !== '_schema') out[k] = mergeTexte(de[k], en[k]);
    return out;
  }
  return de; // Zahlen, Booleans, null: nie aus EN
}
/** kunden.json (Array) + kunden.en.json ({ kunden: { <id>: { name, typ, tells, saetze } } }) → Array mit EN-Texten */
export function mergeKundenKatalog(deJson, enJson) {
  const list = deJson && Array.isArray(deJson.kunden) ? deJson.kunden : Array.isArray(deJson) ? deJson : [];
  const en = enJson && typeof enJson === 'object' && enJson.kunden && typeof enJson.kunden === 'object' && !Array.isArray(enJson.kunden) ? enJson.kunden : {};
  const out = list.map((k) => {
    const e = k && typeof k === 'object' && typeof k.id === 'string' ? en[k.id] : null;
    if (!e || typeof e !== 'object') return k;
    const m = { ...k };
    for (const key of ['name', 'typ', 'tells', 'saetze']) if (e[key] !== undefined && k[key] !== undefined) m[key] = mergeTexte(k[key], e[key]);
    return m;
  });
  return deJson && Array.isArray(deJson.kunden) ? { ...deJson, kunden: out } : out;
}

// ---------- Spielstand: automatisch am Tagesende (Morgenstand des neuen Tages), „Weiter“/„Neues Spiel“ beim Start ----------
export const SAVE_VERSION = 1;
export const SAVE_FELDER = ['tag', 'geld', 'ware', 'heat', 'mangos', 'tageOhneVorfall'];
/** Nur das, was über Nacht zählt: Tag, Kasse, Tasche, Heat, Mangos, Tafel. Tagesinternes (status, verkauftHeute …) ist morgens ohnehin frisch. */
export function toSave(state) {
  const n = (v, d = 0) => (Number.isFinite(v) ? v : d);
  return { version: SAVE_VERSION, tag: Math.max(1, Math.round(n(state.tag, 1))), geld: Math.max(0, n(state.geld)), ware: Math.max(0, Math.min(MAX_WARE, n(state.ware))), heat: Math.max(0, Math.min(MAX_HEAT, n(state.heat))), mangos: Math.max(0, n(state.mangos)), tageOhneVorfall: Math.max(0, n(state.tageOhneVorfall)) };
}
/** Gespeicherter Stand → Spielzustand (auf initialState gelegt); null bei fremder Version, Müll oder Tag 1 ohne Fortschritt. */
export function fromSave(json) {
  if (!json || typeof json !== 'object' || json.version !== SAVE_VERSION) return null;
  if (!Number.isFinite(json.tag) || json.tag < 1) return null;
  const clean = toSave(json);
  const base = initialState();
  const out = { ...base };
  for (const f of SAVE_FELDER) out[f] = clean[f];
  return out;
}
export const hatFortschritt = (json) => { const s = fromSave(json); return !!s && (s.tag > 1 || s.geld > 0 || s.mangos > 0); };

// ---------- Optionen (⚙): Textsprache, Zivi-Beschlagnahme, Musik, Ton — Ablage im Browser, robust gegen Müll ----------
export const DEFAULT_OPTIONEN = { sprache: 'de', beschlagnahme: ZIVI_BESCHLAGNAHMT, musik: true, ton: true };
export function normalizeOptionen(json) {
  const o = json && typeof json === 'object' ? json : {};
  const bool = (v, d) => (typeof v === 'boolean' ? v : d);
  return {
    sprache: SPRACHEN.includes(o.sprache) ? o.sprache : DEFAULT_OPTIONEN.sprache,
    beschlagnahme: bool(o.beschlagnahme, DEFAULT_OPTIONEN.beschlagnahme),
    musik: bool(o.musik, DEFAULT_OPTIONEN.musik),
    ton: bool(o.ton, DEFAULT_OPTIONEN.ton),
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
  return { tag: state.tag, verkauft, anZivis, weg: verkauft + anZivis, uebrig: state.ware, geldHeute: state.geldHeute || 0, geld: state.geld, heat: state.heat, heatLabel: heatLabel(state.heat), verhaftet: isArrested(state), tage: isArrested(state) ? 0 : (state.tageOhneVorfall || 0) };
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

// ---------- Stimmen & Barks (data/stimmen.json): kurze englische Ausrufe als kleine Blase über dem Kopf ----------
export const BARK_KINDS = ['gruss', 'kauf', 'ablehnung', 'zivi_verdaechtig'];
export function normalizeStimmen(json) {
  const t = json && typeof json === 'object' ? json : {};
  const zuordnung = {};
  if (t.zuordnung && typeof t.zuordnung === 'object') for (const [id, slug] of Object.entries(t.zuordnung)) if (typeof slug === 'string' && slug) zuordnung[id] = slug;
  const stimmen = {};
  if (t.stimmen && typeof t.stimmen === 'object') {
    for (const [slug, v] of Object.entries(t.stimmen)) {
      const b = v && typeof v === 'object' && v.barks && typeof v.barks === 'object' ? v.barks : {};
      const barks = {};
      for (const kind of Object.keys(b)) barks[kind] = strList(b[kind], []);
      stimmen[slug] = { barks };
    }
  }
  return { zuordnung, stimmen };
}
// Slug eines Kunden: zuordnung gewinnt, dann das stimme-Feld, dann die id
export const stimmeSlug = (st, kunde) => st?.zuordnung?.[kunde.id] ?? kunde.stimme ?? kunde.id;
// Barks einer Art; leer, wenn es keine gibt (dann keine Blase)
export function barksFor(st, kunde, kind) {
  const slug = stimmeSlug(st, kunde);
  return st?.stimmen?.[slug]?.barks?.[kind] || [];
}
// Nie zweimal hintereinander dieselbe Zeile: nächste Zeile ungleich der vorigen (prev = Index oder -1)
export function pickBark(list, prev = -1, seed = 0) {
  if (!list || !list.length) return null;
  if (list.length === 1) return { text: list[0], idx: 0 };
  let idx = ((seed % list.length) + list.length) % list.length;
  if (idx === prev) idx = (idx + 1) % list.length;
  return { text: list[idx], idx };
}

// ---------- Mentor-Szene (data/texte.json → mentor_szene + mentor[]): einmal pro Tag auf der Kuppe ----------
export const DEFAULT_MENTOR_SZENE = {
  ankunft: ['Setz dich. Nein, nicht auf die Beete.'],
  schritte: [
    { id: 'ankunft', wer: 'mentor', text: '@ankunft', weiter: 'lektion' },
    { id: 'lektion', wer: 'mentor', quelle: 'mentor[tag]', blasen: ['einleitung', 'regel', 'pointe'], weiter: 'nachschub' },
    { id: 'nachschub', wer: 'mentor', text: ['Hier. Frisch aus dem Garten.'], aktion: 'ware_auffuellen', menge: START_WARE, weiter: 'abschied' },
    { id: 'abschied', wer: 'mentor', text: ['Geh verkaufen, Mann.'], aktion: 'heat_minus', wert: 1, weiter: null },
  ],
  schon_geholt: ['Den Beutel für heute hast du schon, Mann.'],
  voll: ['Deine Taschen sind voll. Geh runter und leer sie.'],
  ausgelernt: ['Heute keine Weisheit. Nur Gras und Schweigen.'],
  giessen: ['Gieß ordentlich.'],
};
export const MENTOR_AKTIONEN = ['ware_auffuellen', 'ware_plus', 'heat_minus']; // ware_plus = Alias für ware_auffuellen
export function normalizeMentorSzene(json) {
  const t = json && typeof json === 'object' ? json : {};
  const m = t.mentor_szene && typeof t.mentor_szene === 'object' ? t.mentor_szene : {};
  const D = DEFAULT_MENTOR_SZENE;
  const schritte = Array.isArray(m.schritte) && m.schritte.length ? m.schritte : D.schritte;
  const out = {
    ankunft: strList(m.ankunft, D.ankunft),
    schon_geholt: strList(m.schon_geholt, D.schon_geholt),
    voll: strList(m.voll, D.voll),
    ausgelernt: strList(m.ausgelernt, D.ausgelernt),
    giessen: strList(m.giessen, D.giessen),
    schritte: schritte.filter((st) => st && typeof st === 'object' && typeof st.id === 'string').map((st) => ({
      id: st.id,
      text: typeof st.text === 'string' ? st.text : strList(st.text, []),
      quelle: typeof st.quelle === 'string' ? st.quelle : null,
      blasen: strList(st.blasen, []),
      aktion: MENTOR_AKTIONEN.includes(st.aktion) ? st.aktion : null,
      menge: Number.isFinite(st.menge) ? st.menge : START_WARE,
      wert: Number.isFinite(st.wert) ? st.wert : 1,
      weiter: typeof st.weiter === 'string' ? st.weiter : null,
    })),
    // Weisheiten des Tages (mentor[]): Tag 1 → erste, …; danach ausgelernt
    weisheiten: (Array.isArray(t.mentor) ? t.mentor : []).filter((w) => w && typeof w === 'object').map((w) => ({
      id: str(w.id, ''), titel: str(w.titel, ''), einleitung: str(w.einleitung, ''), regel: str(w.regel, ''), pointe: str(w.pointe, ''),
    })),
  };
  return out;
}
// Aktion anwenden: ware_auffuellen/ware_plus = `menge` obendrauf (gedeckelt bei MAX_WARE), heat_minus = Heat um `wert` kühlen
export function applyMentorAktion(state, aktion, value) {
  if (aktion === 'ware_auffuellen' || aktion === 'ware_plus') return { ...state, ware: Math.min(MAX_WARE, state.ware + value) };
  if (aktion === 'heat_minus') return { ...state, heat: Math.max(0, state.heat - value), verhaftet: false };
  return state;
}
export const mentorBesucht = (state) => state.mentorTag === state.tag;
/**
 * Blasenfolge für den Besuch beim Mentor: [{ id, text, aktion?, value?, bark }]. Einmal pro Tag die volle Szene
 * (Ankunft → Lektion → Nachschub → Abschied); nochmal am selben Tag: schon_geholt; mit voller Tasche (MAX_WARE): voll.
 */
export function mentorSzene(state, sz, lineIdx = 0) {
  const S = sz || normalizeMentorSzene(null);
  if (mentorBesucht(state)) return [{ id: 'schon_geholt', text: pickLine(S.schon_geholt, lineIdx), bark: 'gruss' }];
  if (state.ware >= MAX_WARE) return [{ id: 'voll', text: pickLine(S.voll, lineIdx), bark: 'gruss' }];
  const out = [];
  let step = S.schritte[0];
  const byId = Object.fromEntries(S.schritte.map((st) => [st.id, st]));
  let guard = 0;
  while (step && guard++ < 20) {
    const bark = { ankunft: 'gruss', lektion: 'lektion', nachschub: 'nachschub', abschied: 'abschied' }[step.id] || 'gruss';
    if (step.quelle === 'mentor[tag]') {
      const w = S.weisheiten[state.tag - 1];
      if (w) for (const key of step.blasen) { if (w[key]) out.push({ id: `${step.id}:${key}`, text: w[key], titel: w.titel, bark }); }
      else out.push({ id: 'ausgelernt', text: pickLine(S.ausgelernt, lineIdx), bark });
    } else {
      const list = step.text === '@ankunft' ? S.ankunft : Array.isArray(step.text) ? step.text : [step.text];
      const entry = { id: step.id, text: pickLine(list, lineIdx), bark };
      if (step.aktion) { entry.aktion = step.aktion; entry.value = step.aktion === 'heat_minus' ? step.wert : step.menge; }
      out.push(entry);
    }
    step = step.weiter ? byId[step.weiter] : null;
  }
  return out;
}
// Besuch abschließen: Aktionen der Folge anwenden und den Tag als besucht markieren
export function finishMentor(state, folge) {
  let next = state;
  for (const e of folge) if (e.aktion) next = applyMentorAktion(next, e.aktion, e.value);
  return { ...next, mentorTag: state.tag };
}

// ---------- Posten 7: Polizei-Präsenz als Heat-Zone, Mangos als Gnade ----------
// Position/Radius kommen aus dem Markt-Layout (zone-markt-layout.js), bis dahin dieser Platzhalter nördlich des Dorfs
export const POSTEN_DEFAULT = { x: 20, z: -84, r: 15 };
export const inPostenSicht = (pos, posten = POSTEN_DEFAULT) => Math.hypot(pos.x - posten.x, pos.z - posten.z) <= posten.r;
export const MANGO_PREIS = 10;
// Mango am Markt-Stand kaufen (Geld −, Mango +); zu wenig Geld → unverändert
export function buyMango(state, preis = MANGO_PREIS) {
  if (state.geld < preis) return { state, result: 'kein_geld' };
  return { state: { ...state, geld: state.geld - preis, mangos: (state.mangos || 0) + 1 }, result: 'gekauft' };
}
// Mango am Posten abgeben: Heat −1, einmal pro Tag, nur mit Mango
export function giveMango(state) {
  if (!(state.mangos > 0)) return { state, result: 'keine_mango' };
  if (state.mangoTag === state.tag) return { state, result: 'schon_heute' };
  if (state.heat <= 0) return { state, result: 'kein_heat' };
  return { state: { ...state, mangos: state.mangos - 1, heat: state.heat - 1, mangoTag: state.tag }, result: 'gnade' };
}
export const mangoAbgegeben = (state) => state.mangoTag === state.tag;
// Text der Tafel am Posten
export const tafelText = (state) => `TAGE OHNE VORFALL: ${isArrested(state) ? 0 : (state.tageOhneVorfall || 0)}`;

// ---------- Posten 7: Texte (data/texte.json → posten7{}) ----------
export const DEFAULT_POSTEN7 = {
  mango: {
    gnaedig: ['Pong nimmt die Mango. „Ich hab dich heute nicht gesehen.“'],
    schon_gehabt: ['„Eine Mango pro Tag. Zwei wären Bestechung.“'],
    keine_mango: ['„Keine Mango, keine Gnade. Der Markt ist da drüben.“'],
    kein_heat: ['„Du bist sauber. Iss sie selbst.“'],
  },
  tafel: { zeile1: 'Tage ohne Vorfall: {tage}', zeile2: { 0: 'Heute alles ruhig.', 1: 'Jemand hat was gesehen.', 2: 'Streife verstärkt.', 3: 'FAHNDUNG.' }, nachts: ['Posten geschlossen.'] },
  pong: { heat_0: ['„Schöner Tag. Bleib sauber.“'], heat_1: ['„Ich hab was gehört.“'], heat_2: ['„Ich kenn deinen Namen.“'], heat_3: ['„Mitkommen.“'] },
};
export function normalizePosten7(json) {
  const t = json && typeof json === 'object' && json.posten7 && typeof json.posten7 === 'object' ? json.posten7 : {};
  const D = DEFAULT_POSTEN7;
  const m = t.mango && typeof t.mango === 'object' ? t.mango : {};
  const ta = t.tafel && typeof t.tafel === 'object' ? t.tafel : {};
  const z2 = ta.zeile2 && typeof ta.zeile2 === 'object' ? ta.zeile2 : {};
  const po = t.pong && typeof t.pong === 'object' ? t.pong : {};
  const zeile2 = {};
  for (let h = 0; h <= MAX_HEAT; h++) zeile2[h] = str(z2[String(h)], D.tafel.zeile2[h]);
  const pong = {};
  for (let h = 0; h <= MAX_HEAT; h++) pong[`heat_${h}`] = strList(po[`heat_${h}`], D.pong[`heat_${h}`]);
  return {
    mango: {
      gnaedig: strList(m.gnaedig, D.mango.gnaedig), schon_gehabt: strList(m.schon_gehabt, D.mango.schon_gehabt),
      keine_mango: strList(m.keine_mango, D.mango.keine_mango), kein_heat: strList(m.kein_heat, D.mango.kein_heat),
    },
    tafel: { zeile1: str(ta.zeile1, D.tafel.zeile1), zeile2, nachts: strList(ta.nachts, D.tafel.nachts) },
    pong,
  };
}
// Ergebnis von giveMango → Textliste aus posten7.mango
export const MANGO_TEXT_KEY = { gnade: 'gnaedig', schon_heute: 'schon_gehabt', keine_mango: 'keine_mango', kein_heat: 'kein_heat' };
export function mangoText(p7, result, lineIdx = 0) {
  const key = MANGO_TEXT_KEY[result];
  return key ? pickLine((p7 || DEFAULT_POSTEN7).mango[key], lineIdx) : '';
}
// Pong ansprechen: Spruch nach Heat-Stufe
export const pongText = (p7, state, lineIdx = 0) => pickLine((p7 || DEFAULT_POSTEN7).pong[`heat_${Math.max(0, Math.min(MAX_HEAT, state.heat))}`], lineIdx);
// Tafel: zwei Zeilen (Zähler + Heat-Stufe)
export function tafelLines(p7, state) {
  const P = p7 || DEFAULT_POSTEN7;
  const tage = isArrested(state) ? 0 : (state.tageOhneVorfall || 0);
  return [fillText(P.tafel.zeile1, { tage }), P.tafel.zeile2[Math.max(0, Math.min(MAX_HEAT, state.heat))]];
}

// ---------- Streife: sieht den Spieler. Beim Verkauf in Sicht: Heat +1 (gedeckelt) ----------
export function patrolSpotted(state, { selling = false } = {}) {
  if (!selling) return { state, result: 'gesehen' };
  const heat = Math.min(MAX_HEAT, state.heat + 1);
  return { state: { ...state, heat, verhaftet: heat >= MAX_HEAT }, result: 'erwischt', heatPlus: heat - state.heat };
}

// Von der Streife gefangen: Verhaftung (Heat voll), Tag verloren — mild wie bisher (Geld bleibt, newDay regelt den Rest)
export function arrestNow(state) {
  return { ...state, heat: MAX_HEAT, verhaftet: true };
}

// ---------- Tuk-Tuk-Express (F3): Fahrt zur Bar, beendet eine Verfolgung. Preis laut Schild 20 Mangos, sonst Geld ----------
export const TUKTUK_PREIS_MANGOS = 20;
export const TUKTUK_PREIS_GELD = 40;
export function tukTukRide(state, { mangos = TUKTUK_PREIS_MANGOS, geld = TUKTUK_PREIS_GELD } = {}) {
  if (state.verhaftet) return { state, result: 'verhaftet' };
  if ((state.mangos || 0) >= mangos) return { state: { ...state, mangos: state.mangos - mangos }, result: 'mangos', ziel: 'bar' };
  if (state.geld >= geld) return { state: { ...state, geld: state.geld - geld }, result: 'geld', ziel: 'bar' };
  return { state, result: 'zu_arm' };
}

// ---------- Tagesuhr: ein Tag ≈ 7 Minuten Spielzeit, Phasen morgen / mittag / abend / nacht ----------
export const DAY_LENGTH = 420;            // Sekunden Spielzeit pro Tag
export const PHASES = ['morgen', 'mittag', 'abend', 'nacht'];
export const PHASE_AT = { mittag: 0.28, abend: 0.66, nacht: 0.9 }; // Anteile des Tages (t01)
// Lichtpalette (licht.js) ist 24-h-basiert (0 = Mitternacht, 0.25 = 06:00, 0.5 = Mittag, ~0.74 = Sonnenuntergang);
// die Spieluhr läuft 06:00–24:00 als 0…1. Umrechnung Uhr-t → Palette-t.
export const lichtT = (t01) => 0.25 + Math.max(0, Math.min(1, t01)) * 0.75;
export const phaseFor = (t01) => (t01 >= PHASE_AT.nacht ? 'nacht' : t01 >= PHASE_AT.abend ? 'abend' : t01 >= PHASE_AT.mittag ? 'mittag' : 'morgen');
export const initialClock = () => ({ t01: 0 });
// Uhr weiterdrehen (läuft nur im freien Spiel; in Gesprächen/Karten pausiert der Aufrufer)
export function clockStep(clock, dt, dayLength = DAY_LENGTH) {
  return { ...clock, t01: Math.min(1, clock.t01 + dt / dayLength) };
}
// Anzeige: 06:00 (Morgen) … 24:00 (Nacht) plus Sonnen-/Mond-Symbol
export function clockLabel(t01) {
  const h = 6 + 18 * Math.max(0, Math.min(1, t01));
  const hh = Math.floor(h), mm = Math.floor((h - hh) * 60);
  const sym = { morgen: '🌅', mittag: '☀️', abend: '🌇', nacht: '🌙' }[phaseFor(t01)];
  return `${sym} ${String(hh).padStart(2, '0')}:${String(mm).padStart(2, '0')}`;
}
// Abends darf man den Tag in der Bar beenden; nachts endet er von allein (Hängematte)
export const abendBeginnt = (prev, next) => phaseFor(prev) !== 'abend' && phaseFor(next) === 'abend';
export const nachtBeginnt = (prev, next) => phaseFor(prev) !== 'nacht' && phaseFor(next) === 'nacht';
export const barBeendetTag = (t01) => phaseFor(t01) === 'abend' || phaseFor(t01) === 'nacht';
export const inBar = (pos, bar, r = 4) => Math.hypot(pos.x - bar.x, pos.z - bar.z) <= r;
export const DEFAULT_ABEND = {
  sonnenuntergang: ['Sonne geht unter. Ab in die Bangi Bar, Mann.'],
  barkeeper: { name: 'Nong', gruss: ['Das Übliche?'], zwischenruf: ['Chef, runter vom Tresen.'], letzte_runde: ['Letzte Runde.'], gute_nacht: ['Gute Nacht. Die Möwe schließt ab.'] },
  mentor: {
    gut: ['Guter Tag. Du hast gelesen, nicht geredet. So geht das.'],
    heat: ['Pong hat nach dir gefragt. Dreimal. Morgen gießt du erst mal.'],
    nichts: ['Nichts verkauft? Auch eine Art, nicht verhaftet zu werden.'],
    verhaftet: ['Erwischt. Die Sandalen-Regel, Mann. Die SANDALEN-Regel.'],
  },
  einschlafen: ['Zu spät für die Bar. Die Hängematte hat dich.'],
};
export function normalizeAbend(json) {
  const t = json && typeof json === 'object' && json.abend_bar && typeof json.abend_bar === 'object' ? json.abend_bar : {};
  const D = DEFAULT_ABEND;
  const bk = t.barkeeper && typeof t.barkeeper === 'object' ? t.barkeeper : {};
  const m = t.mentor && typeof t.mentor === 'object' ? t.mentor : {};
  const mentor = {};
  for (const l of LAGEN) mentor[l] = strList(m[l], D.mentor[l]);
  const ein = t.einschlafen && typeof t.einschlafen === 'object' ? t.einschlafen : {};
  return {
    sonnenuntergang: strList(t.sonnenuntergang, D.sonnenuntergang),
    barkeeper: {
      name: str(bk.name, D.barkeeper.name), gruss: strList(bk.gruss, D.barkeeper.gruss), zwischenruf: strList(bk.zwischenruf, D.barkeeper.zwischenruf),
      letzte_runde: strList(bk.letzte_runde, D.barkeeper.letzte_runde), gute_nacht: strList(bk.gute_nacht, D.barkeeper.gute_nacht),
    },
    mentor,
    einschlafen: strList(Array.isArray(ein) ? ein : ein.text, D.einschlafen),
  };
}
// Abend in der Bar: Barkeeper-Gruß → Mentor-Rückblick nach Lage → letzte Runde; danach die Bilanz-Karte (gute Nacht als Fußzeile).
// Nach einer Verhaftung sitzt der Spieler abends trotzdem an der Bar (Pong bringt ihn vorbei) und der Mentor kommentiert.
export function barAbend(state, abend, lineIdx = 0) {
  const A = abend || DEFAULT_ABEND;
  const rep = dayReport(state);
  const lage = lageFor(rep);
  return [
    { id: 'gruss', wer: 'barkeeper', text: pickLine(A.barkeeper.gruss, lineIdx), bark: 'gruss' },
    { id: 'rueckblick', wer: 'mentor', text: fillText(pickLine(A.mentor[lage], lineIdx), rep), bark: 'abend', lage },
    { id: 'letzte_runde', wer: 'barkeeper', text: pickLine(A.barkeeper.letzte_runde, lineIdx), bark: 'letzte_runde' },
    // Nach dem Gespräch fragt Nong „Feierabend?“ — Ja = Bilanz, sonst zurück an den Strand. Nach einer Verhaftung gibt es keine Wahl.
    ...(lage === 'verhaftet' ? [] : [{ id: 'feierabend', wer: 'barkeeper', text: FEIERABEND_FRAGE, frage: true, optionen: ['Feierabend', 'Noch nicht'] }]),
  ];
}
export const FEIERABEND_FRAGE = 'Feierabend?';
export const guteNacht = (abend, lineIdx = 0) => pickLine((abend || DEFAULT_ABEND).barkeeper.gute_nacht, lineIdx);
export const sonnenuntergangLine = (abend, lineIdx = 0) => pickLine((abend || DEFAULT_ABEND).sonnenuntergang, lineIdx);
export const zwischenrufLine = (abend, lineIdx = 0) => pickLine((abend || DEFAULT_ABEND).barkeeper.zwischenruf, lineIdx); // Nong tagsüber am Tresen
export const einschlafenLine = (abend, lineIdx = 0) => pickLine((abend || DEFAULT_ABEND).einschlafen, lineIdx);
