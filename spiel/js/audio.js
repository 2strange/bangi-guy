// audio.js — Sound für Bangi Beach, komplett prozedural mit WebAudio (keine Dateien, keine Bibliotheken).
// Aufbau: reine Helfer oben (Silbenplan fürs Gebrabbel, Musik-Pattern, Stimmprofile) sind ohne Browser testbar;
// darunter der WebAudio-Teil (Busse, Limiter, SFX, Ambience, Musik-Loop, Gebrabbel, Mute).
//
// Kurz-API (alles no-op, solange initAudio() noch nicht lief bzw. der Nutzer noch nicht geklickt hat):
//   initAudio()                     einmal beim Start; wartet selbst auf die erste Geste (iOS: resume)
//   setMuted(bool) / isMuted()      Mute mit localStorage
//   sfx(name, { gain, pan })        name: kasse | ablehnen | heat | verhaftet | ausverkauft | schritt_sand | ui_klick | hinschauen |
//                                   pfeife | mango | funk | tuten | tuktuk_abwuergen; gain 0..1 = Abstands-Lautstärke, pan -1..1
//   ambience.start() / .stop()      Zonen-Ambience: strand (Brandung + Möwe), markt (Gewirr + Händlerrufe), posten (Funk), pier (Tuk-Tuk-Leerlauf)
//   ambience.setZone({ strand: 1, markt: 0.3 })   Mischung 0..1 je Zone (+ bar: Klirren, Gemurmel), weich; .ruf() / .funk() sofort
//   setMood('tag' | 'abend')        Musik (langsamer, kein Kick, Hall, dunkler) + Ambience (Grillen an, Möwen stumm), weich
//   music.start() / .stop() / .setVolume(0..1) / .setEnabled(bool)   Strand-Loop, ~75 BPM
//   loadStimmen() → stimmeFor(id)   Stimmprofile + Barks aus data/stimmen.json
//   babble(stimmeOderId, text, { pan }) → Dauer in Sekunden; stopBabble()
//   bark(id, situation, { pan }) → { text, dauer } | null   zufälliger englischer Bark aus stimmen.json, gebrabbelt
//   setVoiceMode('babble' | 'tts') / getVoiceMode()   Gebrabbel (Standard) oder Browser-Sprachausgabe (Englisch)

// ---------- Lautstärken (zentral) ----------
export const VOL = {
  master: 0.9,
  sfx: 0.8,
  ambience: 0.3,
  music: 0.18,      // Standard der Musik, sehr leise unter der Ambience
  voice: 0.55,
  // einzelne Effekte relativ zum SFX-Bus
  kasse: 0.8, ablehnen: 0.6, heat: 0.55, verhaftet: 0.5, ausverkauft: 0.6, schritt_sand: 0.18, ui_klick: 0.35, hinschauen: 0.4,
  pfeife: 0.45, mango: 0.6, funk: 0.4, tuten: 0.55, tuktuk_abwuergen: 0.5, gaehnen: 0.5,
  ui_oeffnen: 0.35, ui_schliessen: 0.3, ui_umschalten: 0.3, ui_schritt: 0.45,
  ziel: 0.55, morgen: 0.5, woche_gut: 0.6, woche_fail: 0.5,
  // Ambience-Details (relativ zum Ambience-Bus)
  moewe: 0.35, walla: 0.16, ruf: 0.3, funkspruch: 0.45, tuktuk: 0.22, klirren: 0.2, grillen: 0.1,
  frosch: 0.28, wasser: 0.2,
};
const STORE_MUTE = 'bangi_audio_muted';
const STORE_MUSIC = 'bangi_audio_music';
const STORE_VOICE = 'bangi_audio_voice';

// ---------- kleine Helfer ----------
export const clamp = (v, lo, hi) => Math.max(lo, Math.min(hi, v));
export const midiToFreq = (m) => 440 * Math.pow(2, (m - 69) / 12);
/** Deterministischer Zufall (mulberry32), damit Pläne testbar sind */
export function rng(seed) {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6D2B79F5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}
export function hashStr(s) {
  let h = 2166136261;
  for (let i = 0; i < s.length; i++) { h ^= s.charCodeAt(i); h = Math.imul(h, 16777619); }
  return h >>> 0;
}

// ---------- Stimmprofile ----------
// tonhoehe 0.5–2 (1 = ~220 Hz), tempo 0.6–1.6 (1 = ~8 Silben/s), stil siehe STIL, vibrato 0–1
export const STIL = {
  schluffig: { wave: 'triangle', glide: -0.12, attack: 0.03, q: 2.0, vib: 0.2, jitter: 3, len: 1.1 },
  brummig:   { wave: 'sine',     glide: -0.08, attack: 0.04, q: 1.2, vib: 0.1, jitter: 2, len: 1.25, sub: true },
  knarzig:   { wave: 'sawtooth', glide: -0.05, attack: 0.02, q: 3.5, vib: 0.3, jitter: 4, len: 1.0, rau: true },
  quietschig:{ wave: 'square',   glide: 0.10,  attack: 0.01, q: 4.0, vib: 0.5, jitter: 5, len: 0.85 },
  zackig:    { wave: 'square',   glide: 0.0,   attack: 0.005, q: 2.5, vib: 0.0, jitter: 1, len: 0.7 },
  piepsig:   { wave: 'sine',     glide: 0.06,  attack: 0.015, q: 3.0, vib: 0.4, jitter: 4, len: 0.9 },
  cool:      { wave: 'triangle', glide: -0.03, attack: 0.04, q: 1.5, vib: 0.05, jitter: 1, len: 1.3 },
};
export const DEFAULT_STIMME = { tonhoehe: 1.0, tempo: 1.0, stil: 'schluffig', vibrato: 0.2, laut: 1.0 };
/** Profil-Objekt (flach oder { charakter: {…} }) → vollständiges, geclamptes Profil */
export function normalizeStimme(s) {
  let o = s && typeof s === 'object' ? s : {};
  if (o.charakter && typeof o.charakter === 'object') o = o.charakter;
  const stil = STIL[o.stil] ? o.stil : DEFAULT_STIMME.stil;
  return {
    tonhoehe: clamp(Number(o.tonhoehe) || DEFAULT_STIMME.tonhoehe, 0.4, 2.5),
    tempo: clamp(Number(o.tempo) || DEFAULT_STIMME.tempo, 0.4, 2.0),
    stil,
    vibrato: clamp(o.vibrato === undefined ? STIL[stil].vib : Number(o.vibrato) || 0, 0, 1),
    laut: clamp(Number(o.laut) || DEFAULT_STIMME.laut, 0.5, 1.2),
  };
}
/**
 * stimmen.json → { stimmen: {slug → Profil}, barks: {slug → {situation → [Text]}}, zuordnung: {kundeId → slug} }.
 * Akzeptiert die Content-Form ({ zuordnung, stimmen: { slug: { charakter, barks } } }) und eine flache Form
 * ({ slug: { tonhoehe … } }). Fehlende Datei/Felder → Default.
 */
export function normalizeStimmen(json) {
  const j = json && typeof json === 'object' ? json : {};
  const src = j.stimmen && typeof j.stimmen === 'object' ? j.stimmen : j;
  const out = { stimmen: { default: normalizeStimme(src.default) }, barks: {}, zuordnung: {} };
  for (const k of Object.keys(src)) {
    if (k === '_schema' || k === 'zuordnung') continue;
    out.stimmen[k] = normalizeStimme(src[k]);
    const b = src[k] && src[k].barks;
    if (b && typeof b === 'object') {
      out.barks[k] = {};
      for (const sit of Object.keys(b)) if (Array.isArray(b[sit])) out.barks[k][sit] = b[sit].map(String).filter(Boolean);
    }
  }
  if (j.zuordnung && typeof j.zuordnung === 'object') for (const k of Object.keys(j.zuordnung)) out.zuordnung[k] = String(j.zuordnung[k]);
  // bereits normalisierte Form (barks auf oberster Ebene) → idempotent übernehmen
  if (j.barks && typeof j.barks === 'object') for (const k of Object.keys(j.barks)) if (!out.barks[k]) out.barks[k] = j.barks[k];
  return out;
}
/** Slug einer Kunden-/Figuren-id (zuordnung gewinnt, sonst die id selbst, sonst default) */
export function slugFor(db, id) {
  const s = db.zuordnung[id] || id;
  return db.stimmen[s] ? s : 'default';
}
/**
 * Zufälligen Bark wählen, nie denselben zweimal hintereinander (last = zuletzt gesagter Text). r = Zufall 0..1.
 * Gibt null zurück, wenn es für slug/situation nichts gibt.
 */
export function pickBark(db, slug, situation, last = null, r = Math.random) {
  const list = (db.barks[slug] || {})[situation];
  if (!list || !list.length) return null;
  const pool = list.length > 1 && last ? list.filter((t) => t !== last) : list;
  return pool[Math.floor(r() * pool.length) % pool.length];
}

// ---------- Gebrabbel-Plan (rein) ----------
const VOWELS = 'aeiouyäöü';
// Formant-Mitte je Vokal (Hz) fürs Bandpass — grob, aber unterscheidbar
const FORMANT = { a: 850, e: 550, i: 320, o: 480, u: 350, y: 320, 'ä': 700, 'ö': 500, 'ü': 330 };
/** Zerlegt ein Wort in Silben-Gruppen: jede Vokalgruppe mit den Konsonanten davor; „strand“ → ["strand"], „banana“ → ["ba","na","na"] */
export function syllables(word) {
  const w = word.toLowerCase().replace(/[^a-zäöüß']/g, '');
  if (!w) return [];
  // Konsonanten + folgende Vokalgruppe = eine Silbe; Rest-Konsonanten hängen an die letzte Silbe
  const out = w.match(/[^aeiouyäöü]*[aeiouyäöü]+/g) || [];
  const used = out.join('').length;
  const rest = w.slice(used);
  if (rest) { if (out.length) out[out.length - 1] += rest; else out.push(rest); }
  // sehr lange Gruppen (Konsonantenwüste) teilen
  return out.flatMap((s) => (s.length > 7 ? s.match(/.{1,4}/g) : [s]));
}
const vowelOf = (syl) => { for (const ch of syl) if (FORMANT[ch]) return ch; return 'a'; };

/**
 * Plan fürs Gebrabbel: eine „Note“ je Silbe. Deterministisch über den Text (seed), damit derselbe Satz immer
 * gleich klingt. Ergebnis: { notes: [{ t, dur, freq, freqEnd, gain, vowel }], duration }
 */
export function babblePlan(stimmeIn, text, seed) {
  const stimme = normalizeStimme(stimmeIn);
  const st = STIL[stimme.stil];
  const words = String(text || '').trim().split(/\s+/).filter(Boolean);
  const r = rng(seed === undefined ? hashStr(String(text || '')) : seed);
  const base = 220 * stimme.tonhoehe;
  const sylDur = (0.095 * st.len) / stimme.tempo;  // Silbenlänge
  const gap = 0.025 / stimme.tempo;
  const notes = [];
  let t = 0;
  let semi = 0; // Tonhöhen-Random-Walk in Halbtönen
  for (let wi = 0; wi < words.length; wi++) {
    const word = words[wi];
    const syls = syllables(word);
    const loud = /!/.test(word) ? 1.25 : 1;
    const question = /\?/.test(word);
    const lastWord = wi === words.length - 1;
    for (let si = 0; si < syls.length; si++) {
      // Random-Walk mit Zug zur Mitte, Betonung auf der ersten Silbe
      semi += (r() - 0.5) * 2 * st.jitter - semi * 0.3;
      let s = semi + (si === 0 ? 1.5 : 0);
      if (question && si === syls.length - 1) s += 5;       // Frage: am Ende hoch
      else if (lastWord && si === syls.length - 1) s -= 2;   // Aussage: am Ende runter
      const freq = base * Math.pow(2, clamp(s, -7, 9) / 12);
      const dur = sylDur * (0.8 + r() * 0.5) * (si === syls.length - 1 ? 1.25 : 1);
      notes.push({ t, dur, freq, freqEnd: freq * (1 + st.glide * (question && si === syls.length - 1 ? -1 : 1)), gain: loud * (0.75 + r() * 0.25), vowel: vowelOf(syls[si]) });
      t += dur + gap;
    }
    // Satzzeichen = kleine Pause, Wortgrenze = Mini-Pause
    if (/[.!?]$/.test(word)) t += 0.18 / stimme.tempo;
    else if (/[,;:]$/.test(word)) t += 0.11 / stimme.tempo;
    else t += 0.04 / stimme.tempo;
  }
  return { notes, duration: notes.length ? t : 0, stimme };
}

// ---------- Musik-Pattern (rein) ----------
// 16 Takte, 4/4, 16tel-Raster (step 0..15). Reggae/Dub: Skank auf den Offbeats (2, 6, 10, 14), One-Drop
// (Kick + Rimshot auf Zählzeit 3 = step 8), weicher Bass, Shaker auf den Achteln.
export const BPM = 75;
export const STEPS_PER_BAR = 16;
export const BARS = 16;
// Akkorde als MIDI: Skank-Voicing (G4-Lage) und Bass-Grundton
const CHORD = {
  G:  { skank: [67, 71, 74], bass: 43 },
  C:  { skank: [67, 72, 76], bass: 48 },
  D:  { skank: [66, 69, 74], bass: 50 },
  Em: { skank: [67, 71, 76], bass: 40 },
};
export const PROGRESSION = ['G', 'C', 'G', 'D', 'G', 'C', 'G', 'D', 'Em', 'C', 'G', 'D', 'Em', 'C', 'D', 'D'];
// kleine Steel-Drum-Licks (Halbtöne relativ zum Skank-Grundton) für die Takte 12–15
const LICKS = [
  [[0, 0], [2, 4], [4, 7], [6, 12]],
  [[0, 12], [3, 7], [6, 4], [8, 0]],
  [[2, 7], [6, 9], [10, 7], [12, 4]],
  [[0, 0], [4, 2], [8, 4], [10, 7], [14, 12]],
];
// Stimmungen: tag = Strand-Loop wie gehabt; abend = Bar-Live: langsamer, kein Kick, Shaker nur auf den Offbeats,
// Skank weicher und dunkler, mehr Hall und Echo, Lick in jedem zweiten Block
export const MOODS = {
  tag:   { bpm: 75, drums: 1,   skank: 1,   bass: 1,   lead: 0.6, reverb: 0.08, echo: 0.22, tone: 7000 },
  abend: { bpm: 66, drums: 0.5, skank: 0.75, bass: 0.9, lead: 0.9, reverb: 0.38, echo: 0.32, tone: 2600 },
};
export const normalizeMood = (m) => (MOODS[m] ? m : 'tag');
/** Tempo gleitet pro 16tel ein Stück zum Ziel (kein Sprung beim Stimmungswechsel) */
export const nextBpm = (cur, target) => (Math.abs(target - cur) < 0.05 ? target : cur + (target - cur) * 0.06);
/** Events eines Taktes (bar ≥ 0, wird modulo BARS gewickelt). Deterministisch. mood: tag | abend */
export function musicPattern(bar, mood = 'tag') {
  const b = ((bar % BARS) + BARS) % BARS;
  const abend = normalizeMood(mood) === 'abend';
  const chord = CHORD[PROGRESSION[b]];
  const r = rng(1000 + b);
  const ev = [];
  const push = (step, type, extra = {}) => ev.push({ step, type, ...extra });
  // Shaker: alle Achtel, Offbeats lauter; abends nur die Offbeats, leise
  for (let s = 0; s < 16; s += 2) {
    if (abend && s % 4 !== 2) continue;
    push(s, 'shaker', { vel: abend ? 0.5 : (s % 4 === 2 ? 0.9 : 0.45) });
  }
  // One-Drop; abends kein Kick (Bar-Live, nur Rimshot)
  const dubDrop = b === 7 || b === 15;         // Dub: Kick fällt weg, Rimshot bleibt + Echo-Gefühl
  if (!dubDrop && !abend) push(8, 'kick', { vel: 1 });
  push(8, 'rim', { vel: abend ? 0.6 : 1 });
  if (b % 4 === 3) push(14, 'rim', { vel: abend ? 0.4 : 0.6 });  // kleiner Fill am Blockende
  // Skank (Offbeats), auf Takt 15 nur zwei Anschläge, Platz für den Lick
  const skankSteps = b === 15 ? [2, 10] : [2, 6, 10, 14];
  for (const s of skankSteps) push(s, 'skank', { notes: chord.skank, vel: s === 6 || s === 14 ? 0.85 : 1, len: abend ? 3 : 2 });
  if (b % 4 === 1 && r() < 0.6 && !abend) push(15, 'skank', { notes: chord.skank, vel: 0.5, len: 1 }); // Vorschlag vor Takt 1
  // Bass: Grundton auf 1 (lang), Grundton auf 3, Quinte vor der 1; in Dub-Takten erst ab der 3
  const root = chord.bass, fifth = root + 7, third = root + (PROGRESSION[b] === 'Em' ? 3 : 4);
  if (!dubDrop) push(0, 'bass', { note: root, len: 6, vel: 1 });
  push(8, 'bass', { note: root, len: 3, vel: 0.9 });
  if (b % 4 === 3) { push(11, 'bass', { note: third, len: 2, vel: 0.7 }); push(13, 'bass', { note: fifth, len: 2, vel: 0.8 }); }
  else push(12, 'bass', { note: fifth, len: 2, vel: 0.75 });
  // Steel-Drum-Lick in den letzten vier Takten, leise; abends auch in Takt 4–7 (mehr Melodie, weniger Groove)
  if (b >= 12) for (const [s, semi] of LICKS[b - 12]) push(s, 'lead', { note: chord.skank[0] + semi, vel: 0.6, len: 3 });
  else if (abend && b >= 4 && b < 8) for (const [s, semi] of LICKS[b - 4]) push(s, 'lead', { note: chord.skank[0] + semi - 12, vel: 0.45, len: 4 });
  ev.sort((x, y) => x.step - y.step);
  return { bar: b, chord: PROGRESSION[b], events: ev };
}
export const stepSeconds = (bpm = BPM) => 60 / bpm / 4;

/** Möwen-Abstand in Sekunden (8–22 s), rng = Funktion 0..1 */
export const nextGullDelay = (r) => 8 + r() * 14;
/** Händlerruf 6–15 s, Funkspruch 10–25 s */
export const nextRufDelay = (r) => 6 + r() * 9;
export const nextFunkDelay = (r) => 10 + r() * 15;

// ---------- Zonen (rein) ----------
export const ZONES = ['strand', 'markt', 'posten', 'pier', 'bar', 'reisfeld'];
/** Froschruf: 1–3 „Quak“ mit Grundton 110–220 Hz und Abstand (rein, testbar) */
export function frogCall(r) {
  return { n: 1 + Math.floor(r() * 3), freq: 110 + r() * 110, gap: 0.22 + r() * 0.18, trill: 18 + r() * 14 };
}
/** Nächster Frosch in 0.8–3 s */
export const nextFrogDelay = (r) => 0.8 + r() * 2.2;
// Jingle-Noten (MIDI) — rein, damit Tests prüfen können, dass Tonleiter/Umfang stimmen
export const JINGLES = {
  ziel: [67, 71, 74, 79],                                   // G-Dur-Arpeggio hoch
  morgen: [79, 83, 86, 91, 86],                             // kurzes Steel-Drum-Motiv nach dem Hahn
  woche_gut: [[67, 71, 74], [72, 76, 79], [74, 78, 81], [79, 83, 86]], // G C D G, Akkorde
  woche_fail: [66, 65, 64, 62],                             // „Wah-wah-wah-waaah“ chromatisch runter
};
/** Grillen-Zirpen: ein Schwall aus n Pulsen bei rate Hz, Pause danach (rein, testbar) */
export function cricketBurst(r) {
  const n = 6 + Math.floor(r() * 12), rate = 26 + r() * 14;
  return { pulses: n, gap: 1 / rate, pause: 0.25 + r() * 0.9, freq: 3900 + r() * 900 };
}
/** Gläserklirren an der Bar alle 2–7 s */
export const nextClinkDelay = (r) => 2 + r() * 5;
/** Gewichte 0..1 je Zone; unbekannte Schlüssel ignoriert, fehlende = 0; null/undefined = nur Strand */
export function normalizeZones(g) {
  const out = {};
  for (const z of ZONES) out[z] = 0;
  if (!g || typeof g !== 'object') { out.strand = 1; return out; }
  for (const z of ZONES) out[z] = clamp(Number(g[z]) || 0, 0, 1);
  return out;
}
/** Tuk-Tuk-Abwürgen: Zündungen mit wachsendem Abstand (rein, testbar): Zeitpunkte in s, dann der Puff */
export function sputterTimes(count = 9, first = 0.07, growth = 1.22) {
  const t = []; let at = 0, gap = first;
  for (let i = 0; i < count; i++) { t.push(at); at += gap; gap *= growth; }
  return { pops: t, puff: at };
}
/** Pseudo-Wörter fürs Stimmengewirr (nur Buchstaben, 1–3 Silben je Wort), r = Zufall 0..1 */
const PSEUDO_ON = ['b', 'd', 'g', 'k', 'l', 'm', 'n', 'p', 'r', 's', 't', 'w', 'h', 'j', 'ch', 'st'];
const PSEUDO_VOW = ['a', 'e', 'i', 'o', 'u', 'ai', 'ou', 'ee'];
export function pseudoWords(r, n) {
  const words = [];
  for (let i = 0; i < n; i++) {
    let w = '';
    const syl = 1 + Math.floor(r() * 3);
    for (let s = 0; s < syl; s++) w += PSEUDO_ON[Math.floor(r() * PSEUDO_ON.length)] + PSEUDO_VOW[Math.floor(r() * PSEUDO_VOW.length)];
    words.push(w);
  }
  return words.join(' ');
}

// ---------- WebAudio ----------
let ctx = null;
let master = null, limiter = null, bus = null; // bus: { sfx, ambience, music, voice }
let muted = false;
let armed = false;
const store = {
  get(k) { try { return localStorage.getItem(k); } catch (e) { return null; } },
  set(k, v) { try { localStorage.setItem(k, String(v)); } catch (e) { /* privat/gesperrt */ } },
};
muted = store.get(STORE_MUTE) === '1';
let musicEnabled = store.get(STORE_MUSIC) !== '0';
let musicVolume = VOL.music;
let voiceMode = store.get(STORE_VOICE) === 'tts' ? 'tts' : 'babble';

const now = () => (ctx ? ctx.currentTime : 0);
const ready = () => !!ctx && ctx.state === 'running';

function buildGraph() {
  master = ctx.createGain();
  master.gain.value = muted ? 0 : VOL.master;
  // Kompressor + „Brickwall“: nichts übersteuert, auch wenn Kasse, Musik und Gebrabbel zusammenfallen
  const comp = ctx.createDynamicsCompressor();
  comp.threshold.value = -12; comp.knee.value = 6; comp.ratio.value = 6; comp.attack.value = 0.004; comp.release.value = 0.2;
  limiter = ctx.createDynamicsCompressor();
  limiter.threshold.value = -2; limiter.knee.value = 0; limiter.ratio.value = 20; limiter.attack.value = 0.001; limiter.release.value = 0.1;
  const out = ctx.createGain(); out.gain.value = 0.95;
  master.connect(comp); comp.connect(limiter); limiter.connect(out); out.connect(ctx.destination);
  bus = {};
  for (const [name, v] of [['sfx', VOL.sfx], ['ambience', VOL.ambience], ['music', musicVolume], ['voice', VOL.voice]]) {
    const g = ctx.createGain(); g.gain.value = v; g.connect(master); bus[name] = g;
  }
}

/**
 * Einmal beim Start aufrufen. Legt den AudioContext an; läuft er noch nicht (Autoplay-Sperre, iOS), wird er bei der
 * ersten Geste (pointerdown/touchend/keydown) fortgesetzt. Gibt true zurück, wenn WebAudio verfügbar ist.
 */
export function initAudio() {
  if (typeof window === 'undefined') return false;
  const AC = window.AudioContext || window.webkitAudioContext;
  if (!AC) return false;
  if (!ctx) {
    try { ctx = new AC({ latencyHint: 'interactive' }); } catch (e) { ctx = new AC(); }
    buildGraph();
    // iOS: nach Unterbrechung (Anruf, Tab-Wechsel) wieder aufwecken
    document.addEventListener('visibilitychange', () => { if (!document.hidden && ctx.state !== 'running') ctx.resume().catch(() => {}); });
  }
  if (ctx.state !== 'running') ctx.resume().catch(() => {});
  if (!armed && ctx.state !== 'running') {
    armed = true;
    const wake = () => {
      ctx.resume().then(() => {
        if (ctx.state === 'running') for (const ev of ['pointerdown', 'touchend', 'keydown']) window.removeEventListener(ev, wake, true);
      }).catch(() => {});
    };
    for (const ev of ['pointerdown', 'touchend', 'keydown']) window.addEventListener(ev, wake, true);
  }
  return true;
}
export const getContext = () => ctx;
export const isReady = ready;

export function setMuted(m) {
  muted = !!m;
  store.set(STORE_MUTE, muted ? '1' : '0');
  if (master) master.gain.setTargetAtTime(muted ? 0 : VOL.master, now(), 0.02);
  if (muted && typeof speechSynthesis !== 'undefined') speechSynthesis.cancel();
}
export const isMuted = () => muted;

// ---------- Bausteine ----------
let noiseBuf = null;
function noise() {
  if (!noiseBuf) {
    noiseBuf = ctx.createBuffer(1, ctx.sampleRate * 2, ctx.sampleRate);
    const d = noiseBuf.getChannelData(0);
    for (let i = 0; i < d.length; i++) d[i] = Math.random() * 2 - 1;
  }
  const src = ctx.createBufferSource(); src.buffer = noiseBuf; src.loop = true;
  return src;
}
function osc(type, freq, t) {
  const o = ctx.createOscillator(); o.type = type; o.frequency.setValueAtTime(freq, t); return o;
}
function gainEnv(t, { a = 0.005, peak = 1, d = 0.3, floor = 0.0005, hold = 0 }) {
  const g = ctx.createGain();
  g.gain.setValueAtTime(0.0001, t);
  g.gain.linearRampToValueAtTime(peak, t + a);
  if (hold) g.gain.setValueAtTime(peak, t + a + hold);
  g.gain.exponentialRampToValueAtTime(floor, t + a + hold + d);
  return g;
}
function filt(type, freq, q = 1) { const f = ctx.createBiquadFilter(); f.type = type; f.frequency.value = freq; f.Q.value = q; return f; }
function pan(p) { if (!ctx.createStereoPanner) return ctx.createGain(); const s = ctx.createStereoPanner(); s.pan.value = p; return s; }
const stopAt = (nodes, t) => nodes.forEach((n) => n.stop(t));

// ---------- SFX ----------
const SFX = {
  // Ka-tsching: Münzklimpern (inharmonische Partials + Rauschtick) und ein Glöckchen obendrauf
  kasse(t, out) {
    const coins = 5;
    for (let i = 0; i < coins; i++) {
      const tt = t + i * 0.045 + Math.random() * 0.01;
      const g = gainEnv(tt, { a: 0.002, peak: 0.35, d: 0.12 + Math.random() * 0.08 });
      g.connect(out);
      for (const f of [2370, 3140, 4720, 5900]) {
        const o = osc('sine', f * (0.97 + Math.random() * 0.06), tt);
        const og = ctx.createGain(); og.gain.value = 0.25; o.connect(og); og.connect(g); o.start(tt); o.stop(tt + 0.3);
      }
      const n = noise(); const bp = filt('bandpass', 6000, 2); const ng = gainEnv(tt, { a: 0.001, peak: 0.4, d: 0.03 });
      n.connect(bp); bp.connect(ng); ng.connect(g); n.start(tt); n.stop(tt + 0.05);
    }
    // Glöckchen: Grundton + Partials 2.0 / 3.0 / 4.2
    const tb = t + 0.2;
    const g = gainEnv(tb, { a: 0.003, peak: 0.6, d: 0.9 });
    g.connect(out);
    [[1760, 1], [3520, 0.35], [5280, 0.2], [7392, 0.08]].forEach(([f, v]) => {
      const o = osc('sine', f, tb); const og = ctx.createGain(); og.gain.value = v; o.connect(og); og.connect(g); o.start(tb); o.stop(tb + 1.0);
    });
    return 1.2;
  },
  // „bwomp“: Säge rutscht eine Oktave runter, Filter macht zu
  ablehnen(t, out) {
    const o = osc('sawtooth', 220, t);
    o.frequency.exponentialRampToValueAtTime(95, t + 0.35);
    const lp = filt('lowpass', 900, 4); lp.frequency.exponentialRampToValueAtTime(180, t + 0.4);
    const g = gainEnv(t, { a: 0.01, peak: 0.6, d: 0.45 });
    const o2 = osc('square', 110, t); o2.frequency.exponentialRampToValueAtTime(48, t + 0.35);
    const g2 = ctx.createGain(); g2.gain.value = 0.3;
    o.connect(lp); o2.connect(g2); g2.connect(lp); lp.connect(g); g.connect(out);
    o.start(t); o2.start(t); stopAt([o, o2], t + 0.5);
    return 0.5;
  },
  // kurze Spannung: tiefes Brummen + halbtoniger „dun-DUN“
  heat(t, out) {
    const drone = osc('sawtooth', 55, t); const d2 = osc('sawtooth', 55.8, t);
    const lp = filt('lowpass', 220, 2); lp.frequency.linearRampToValueAtTime(600, t + 0.5);
    const g = gainEnv(t, { a: 0.02, peak: 0.45, d: 0.7 });
    drone.connect(lp); d2.connect(lp); lp.connect(g); g.connect(out);
    drone.start(t); d2.start(t); stopAt([drone, d2], t + 0.8);
    [[0, 164.8], [0.22, 174.6]].forEach(([dt, f]) => {
      const o = osc('triangle', f, t + dt); const og = gainEnv(t + dt, { a: 0.005, peak: 0.5, d: 0.3 });
      o.connect(og); og.connect(out); o.start(t + dt); o.stop(t + dt + 0.35);
    });
    return 0.8;
  },
  // Comic-Sirene: Dreieck wabert zwischen zwei Tönen, Filter „wah“
  verhaftet(t, out) {
    const o = osc('triangle', 700, t);
    const lfo = osc('sine', 2.6, t); const lg = ctx.createGain(); lg.gain.value = 180;
    lfo.connect(lg); lg.connect(o.frequency);
    const bp = filt('bandpass', 900, 2);
    const wah = osc('sine', 5.2, t); const wg = ctx.createGain(); wg.gain.value = 500; wah.connect(wg); wg.connect(bp.frequency);
    const g = gainEnv(t, { a: 0.03, peak: 0.55, d: 1.2, hold: 0.9 });
    o.connect(bp); bp.connect(g); g.connect(out);
    o.start(t); lfo.start(t); wah.start(t); stopAt([o, lfo, wah], t + 2.2);
    return 2.2;
  },
  // Mini-Fanfare: Dreiklang hoch, letzter Ton hält mit Vibrato
  ausverkauft(t, out) {
    const notes = [72, 76, 79, 84];
    notes.forEach((m, i) => {
      const tt = t + i * 0.13;
      const last = i === notes.length - 1;
      const g = gainEnv(tt, { a: 0.01, peak: 0.4, d: last ? 0.7 : 0.18, hold: last ? 0.25 : 0.05 });
      const o = osc('square', midiToFreq(m), tt); const o2 = osc('triangle', midiToFreq(m) * 1.003, tt);
      if (last) { const v = osc('sine', 6, tt); const vg = ctx.createGain(); vg.gain.value = 6; v.connect(vg); vg.connect(o.frequency); vg.connect(o2.frequency); v.start(tt); v.stop(tt + 1.1); }
      const lp = filt('lowpass', 2500, 0.7);
      o.connect(lp); o2.connect(lp); lp.connect(g); g.connect(out);
      o.start(tt); o2.start(tt); stopAt([o, o2], tt + 1.1);
    });
    return 1.5;
  },
  // Sandschritt: kurzer, dumpfer Rauschpuff
  schritt_sand(t, out) {
    const n = noise(); const lp = filt('lowpass', 900 + Math.random() * 400, 0.8); const hp = filt('highpass', 150, 0.7);
    const g = gainEnv(t, { a: 0.004, peak: 0.6, d: 0.06 + Math.random() * 0.03 });
    n.connect(hp); hp.connect(lp); lp.connect(g); g.connect(out); n.start(t); n.stop(t + 0.12);
    return 0.12;
  },
  // UI-Tick
  ui_klick(t, out) {
    const o = osc('sine', 1400, t); o.frequency.exponentialRampToValueAtTime(900, t + 0.03);
    const g = gainEnv(t, { a: 0.001, peak: 0.5, d: 0.04 });
    o.connect(g); g.connect(out); o.start(t); o.stop(t + 0.06);
    const n = noise(); const bp = filt('bandpass', 3000, 3); const ng = gainEnv(t, { a: 0.001, peak: 0.25, d: 0.015 });
    n.connect(bp); bp.connect(ng); ng.connect(out); n.start(t); n.stop(t + 0.03);
    return 0.06;
  },
  // Trillerpfeife: hoher Rechteck-Ton mit schnellem Tremolo (die Kugel in der Pfeife)
  pfeife(t, out) {
    const o = osc('square', 2500, t); o.frequency.linearRampToValueAtTime(2750, t + 0.06);
    const o2 = osc('sine', 2500 * 1.5, t); const o2g = ctx.createGain(); o2g.gain.value = 0.2;
    const trem = ctx.createGain(); trem.gain.value = 0.55;
    const lfo = osc('sine', 38, t); const lg = ctx.createGain(); lg.gain.value = 0.45; lfo.connect(lg); lg.connect(trem.gain);
    const bp = filt('bandpass', 2700, 2.5);
    const g = gainEnv(t, { a: 0.01, peak: 0.5, d: 0.12, hold: 0.42 });
    o.connect(trem); o2.connect(o2g); o2g.connect(trem); trem.connect(bp); bp.connect(g); g.connect(out);
    o.start(t); o2.start(t); lfo.start(t); stopAt([o, o2, lfo], t + 0.6);
    return 0.6;
  },
  // Mango: saftiges „plopp“ — Sinus fällt schnell, dazu ein nasser Rauschklecks und ein kleines Nach-Glucksen
  mango(t, out) {
    const o = osc('sine', 560, t); o.frequency.exponentialRampToValueAtTime(130, t + 0.08);
    const g = gainEnv(t, { a: 0.003, peak: 0.8, d: 0.14 });
    o.connect(g); g.connect(out); o.start(t); o.stop(t + 0.2);
    const n = noise(); const bp = filt('bandpass', 750, 1.5); const ng = gainEnv(t + 0.01, { a: 0.005, peak: 0.35, d: 0.05 });
    n.connect(bp); bp.connect(ng); ng.connect(out); n.start(t); n.stop(t + 0.1);
    const o2 = osc('sine', 320, t + 0.11); o2.frequency.exponentialRampToValueAtTime(190, t + 0.17);
    const g2 = gainEnv(t + 0.11, { a: 0.003, peak: 0.35, d: 0.08 });
    o2.connect(g2); g2.connect(out); o2.start(t + 0.11); o2.stop(t + 0.25);
    return 0.3;
  },
  // Funk-Knacken (Squelch), einzeln als SFX
  funk(t, out) { radioCrackle(t, out, 1, 2 + Math.floor(Math.random() * 3)); return 0.35; },
  // Fährhorn: tiefe Quinte aus zwei Sägezähnen + Sub, langsam an, lang gehalten, am Ende comic-haft absackend
  tuten(t, out) {
    const lp = filt('lowpass', 420, 1.2); lp.frequency.linearRampToValueAtTime(700, t + 0.5); lp.frequency.linearRampToValueAtTime(380, t + 2.2);
    const g = gainEnv(t, { a: 0.18, peak: 0.6, d: 0.6, hold: 1.4 });
    lp.connect(g); g.connect(out);
    const vib = osc('sine', 5.5, t); const vg = ctx.createGain(); vg.gain.value = 1.8; vib.connect(vg);
    [[98, 1, 'sawtooth'], [147, 0.6, 'sawtooth'], [49, 0.5, 'sine'], [99.5, 0.5, 'square']].forEach(([f, v, w]) => {
      const o = osc(w, f, t);
      o.frequency.setValueAtTime(f, t + 1.5); o.frequency.exponentialRampToValueAtTime(f * 0.88, t + 2.2); // Absacken
      vg.connect(o.frequency);
      const og = ctx.createGain(); og.gain.value = v; o.connect(og); og.connect(lp); o.start(t); o.stop(t + 2.4);
    });
    vib.start(t); vib.stop(t + 2.4);
    return 2.4;
  },
  // Tuk-Tuk würgt ab: Zündungen mit wachsendem Abstand, zum Schluss ein dumpfer Puff
  tuktuk_abwuergen(t, out) {
    const { pops, puff } = sputterTimes();
    pops.forEach((dt, i) => {
      const tt = t + dt;
      const o = osc('sine', 95, tt); o.frequency.exponentialRampToValueAtTime(38, tt + 0.05);
      const g = gainEnv(tt, { a: 0.002, peak: 0.55 * (1 - i * 0.04), d: 0.06 });
      o.connect(g); g.connect(out); o.start(tt); o.stop(tt + 0.1);
      const n = noise(); const bp = filt('bandpass', 700 + Math.random() * 300, 1.2); const ng = gainEnv(tt, { a: 0.002, peak: 0.3, d: 0.03 });
      n.connect(bp); bp.connect(ng); ng.connect(out); n.start(tt); n.stop(tt + 0.06);
    });
    // Puff: Lowpass-Rauschwolke + tiefer Seufzer
    const tp = t + puff;
    const n = noise(); const lp = filt('lowpass', 500, 0.7); const ng = gainEnv(tp, { a: 0.02, peak: 0.6, d: 0.35 });
    n.connect(lp); lp.connect(ng); ng.connect(out); n.start(tp); n.stop(tp + 0.5);
    const o = osc('triangle', 70, tp); o.frequency.exponentialRampToValueAtTime(28, tp + 0.4);
    const g = gainEnv(tp, { a: 0.01, peak: 0.4, d: 0.4 });
    o.connect(g); g.connect(out); o.start(tp); o.stop(tp + 0.5);
    return puff + 0.5;
  },
  // Gähnen: Stimme gleitet hoch und müde wieder runter, Formant „aah → ooh“, dazu Atem
  gaehnen(t, out) {
    const o = osc('triangle', 170, t);
    o.frequency.exponentialRampToValueAtTime(250, t + 0.5); o.frequency.exponentialRampToValueAtTime(125, t + 1.3);
    const vib = osc('sine', 5, t + 0.4); const vg = ctx.createGain(); vg.gain.value = 5; vib.connect(vg); vg.connect(o.frequency);
    const bp = filt('bandpass', 600, 2.2);
    bp.frequency.setValueAtTime(600, t); bp.frequency.linearRampToValueAtTime(950, t + 0.5); bp.frequency.linearRampToValueAtTime(420, t + 1.3);
    const lp = filt('lowpass', 2200, 0.7);
    const g = gainEnv(t, { a: 0.25, peak: 0.6, d: 0.55, hold: 0.55 });
    o.connect(bp); bp.connect(lp); lp.connect(g); g.connect(out);
    o.start(t); vib.start(t + 0.4); stopAt([o, vib], t + 1.5);
    const n = noise(); const nb = filt('bandpass', 1400, 0.6); const ng = gainEnv(t, { a: 0.3, peak: 0.12, d: 0.6, hold: 0.4 });
    n.connect(nb); nb.connect(ng); ng.connect(out); n.start(t); n.stop(t + 1.5);
    return 1.5;
  },
  // --- UI: Menü/Tutorial ---
  // Menü öffnen: zwei weiche Blips aufwärts
  ui_oeffnen(t, out) { blip(t, 660, out); blip(t + 0.07, 990, out); return 0.2; },
  // Menü schließen: abwärts
  ui_schliessen(t, out) { blip(t, 990, out); blip(t + 0.07, 660, out); return 0.2; },
  // Option umschalten: ein Tick mit kurzem Rutsch nach oben
  ui_umschalten(t, out) {
    const o = osc('square', 880, t); o.frequency.exponentialRampToValueAtTime(1320, t + 0.05);
    const lp = filt('lowpass', 3000, 0.7); const g = gainEnv(t, { a: 0.002, peak: 0.4, d: 0.07 });
    o.connect(lp); lp.connect(g); g.connect(out); o.start(t); o.stop(t + 0.1);
    return 0.1;
  },
  // Tutorial-Schritt erledigt: „ding-ding“ hoch, zweiter Ton klingt nach
  ui_schritt(t, out) {
    [[0, 1320, 0.12], [0.11, 1980, 0.45]].forEach(([dt, f, d]) => {
      const g = gainEnv(t + dt, { a: 0.003, peak: 0.5, d });
      g.connect(out);
      [[1, 1], [2.76, 0.25]].forEach(([ratio, v]) => { const o = osc('sine', f * ratio, t + dt); const og = ctx.createGain(); og.gain.value = v; o.connect(og); og.connect(g); o.start(t + dt); o.stop(t + dt + d + 0.05); });
    });
    return 0.6;
  },
  // --- Jingles ---
  // Ziel erreicht: Steel-Drum-Arpeggio hoch + Rimshot auf dem letzten Ton
  ziel(t, out) {
    JINGLES.ziel.forEach((m, i) => steelDrum(t + i * 0.11, m, 0.9, i === 3 ? 0.9 : 0.3, out));
    rimshot(t + 0.33, 0.7, out);
    return 1.3;
  },
  // Tagesstart: Hahn („ki-ke-ri-KIII“) und ein kurzes Steel-Drum-Motiv
  morgen(t, out) {
    const bp = filt('bandpass', 1500, 1.5); const lp = filt('lowpass', 3500, 0.7); bp.connect(lp); lp.connect(out);
    [[0, 620, 0.14, 0.75], [0.17, 700, 0.14, 0.8], [0.34, 560, 0.14, 0.75], [0.52, 980, 0.55, 1]].forEach(([dt, f, d, v], i) => {
      const tt = t + dt;
      const o = osc('sawtooth', f, tt);
      if (i === 3) { o.frequency.exponentialRampToValueAtTime(f * 1.12, tt + 0.1); o.frequency.exponentialRampToValueAtTime(f * 0.7, tt + d); } // letzte Silbe kippt müde weg
      else o.frequency.exponentialRampToValueAtTime(f * 1.08, tt + d);
      const vib = osc('sine', 9, tt); const vg = ctx.createGain(); vg.gain.value = 14; vib.connect(vg); vg.connect(o.frequency);
      const g = gainEnv(tt, { a: 0.015, peak: 0.5 * v, d: 0.08, hold: d - 0.05 });
      o.connect(g); g.connect(bp); o.start(tt); vib.start(tt); stopAt([o, vib], tt + d + 0.1);
    });
    JINGLES.morgen.forEach((m, i) => steelDrum(t + 1.25 + i * 0.14, m, 0.7, i === 4 ? 0.8 : 0.3, out));
    return 2.3;
  },
  // Woche geschafft: vier Steel-Drum-Akkorde mit Bass und Rimshots, letzter hält
  woche_gut(t, out) {
    const bassNotes = [43, 48, 50, 43];
    JINGLES.woche_gut.forEach((chord, i) => {
      const tt = t + i * 0.42, last = i === 3;
      chord.forEach((m, k) => steelDrum(tt + k * 0.02, m, 0.8, last ? 1.6 : 0.5, out));
      bassNote(tt, bassNotes[i], 0.9, last ? 1.4 : 0.35, out);
      rimshot(tt + 0.21, 0.5, out);
      if (last) { shaker(tt + 0.21, 0.6, out); shaker(tt + 0.42, 0.6, out); }
    });
    return 3.2;
  },
  // Woche verpatzt: „Wah-wah-wah-waaah“ — Sägezahn mit Wah-Filter, chromatisch runter, letzter Ton sackt ab
  woche_fail(t, out) {
    JINGLES.woche_fail.forEach((m, i) => {
      const tt = t + i * 0.45, last = i === 3, d = last ? 1.3 : 0.4, f = midiToFreq(m);
      const o = osc('sawtooth', f, tt);
      if (last) o.frequency.exponentialRampToValueAtTime(f * 0.84, tt + d);
      const bp = filt('bandpass', 400, 3); bp.frequency.setValueAtTime(400, tt); bp.frequency.linearRampToValueAtTime(1300, tt + 0.12); bp.frequency.linearRampToValueAtTime(500, tt + d);
      const g = gainEnv(tt, { a: 0.03, peak: 0.55, d: 0.2, hold: d - 0.2 });
      o.connect(bp); bp.connect(g); g.connect(out); o.start(tt); o.stop(tt + d + 0.1);
    });
    return 2.9;
  },
  // Zoom-Swoosh: Bandpass-Rauschen fegt hoch
  hinschauen(t, out) {
    const n = noise(); const bp = filt('bandpass', 300, 1.5);
    bp.frequency.setValueAtTime(300, t); bp.frequency.exponentialRampToValueAtTime(3200, t + 0.28);
    const g = gainEnv(t, { a: 0.08, peak: 0.6, d: 0.22 });
    n.connect(bp); bp.connect(g); g.connect(out); n.start(t); n.stop(t + 0.4);
    return 0.35;
  },
};
export const SFX_NAMES = Object.keys(SFX);
// weicher UI-Blip (Sinus + Oktave, kurz)
function blip(t, f, out) {
  const g = gainEnv(t, { a: 0.004, peak: 0.45, d: 0.09 });
  g.connect(out);
  [[1, 1], [2, 0.3]].forEach(([ratio, v]) => { const o = osc('sine', f * ratio, t); const og = ctx.createGain(); og.gain.value = v; o.connect(og); og.connect(g); o.start(t); o.stop(t + 0.15); });
}
const warned = new Set();
/** Spielt einen Effekt. Gibt die ungefähre Dauer in Sekunden zurück (0, wenn Audio nicht läuft). */
/** Optionen für sfx: gain 0..1 (Abstands-Lautstärke, Standard 1), pan -1..1 (Standard Mitte); ungültig → Standard */
export function normalizeSfxOpts(o) {
  const opts = o && typeof o === 'object' ? o : {};
  const g = Number(opts.gain);
  return { gain: Number.isFinite(g) ? clamp(g, 0, 1) : 1, pan: normalizePan(opts.pan) };
}
/** Spielt einen Effekt. opts { gain, pan } optional. Gibt die ungefähre Dauer in Sekunden zurück (0, wenn nichts spielt). */
export function sfx(name, opts) {
  if (!SFX[name]) { if (!warned.has(name)) { warned.add(name); console.warn('audio: unbekannter Effekt', name); } return 0; }
  if (!ready()) return 0;
  const { gain, pan: panPos } = normalizeSfxOpts(opts);
  if (gain <= 0.001) return 0; // außer Hörweite: gar nicht erst Knoten bauen
  const out = ctx.createGain(); out.gain.value = (VOL[name] ?? 1) * gain;
  if (panPos) { const p = pan(panPos); out.connect(p); p.connect(bus.sfx); } else out.connect(bus.sfx);
  const d = SFX[name](now() + 0.005, out);
  setTimeout(() => out.disconnect(), (d + 0.5) * 1000);
  return d;
}

// ---------- Ambience: Brandung + Möwe ----------
let amb = null; // { nodes, gullTimer }
function gull(t, out) {
  // „kee-yaa“: schnell hoch, dann langsam runter, mit Vibrato; 1–3 Rufe
  const calls = 1 + Math.floor(Math.random() * 3);
  const p = pan(Math.random() * 1.6 - 0.8); p.connect(out);
  for (let i = 0; i < calls; i++) {
    const tt = t + i * (0.42 + Math.random() * 0.2);
    const f0 = 1050 + Math.random() * 300;
    const o = osc('sawtooth', f0, tt);
    o.frequency.exponentialRampToValueAtTime(f0 * 1.45, tt + 0.08);
    o.frequency.exponentialRampToValueAtTime(f0 * 0.8, tt + 0.38);
    const v = osc('sine', 28, tt); const vg = ctx.createGain(); vg.gain.value = 40; v.connect(vg); vg.connect(o.frequency);
    const lp = filt('lowpass', 2600, 1); const bp = filt('bandpass', 1800, 1.2);
    const g = gainEnv(tt, { a: 0.03, peak: VOL.moewe * (0.6 + Math.random() * 0.4), d: 0.3, hold: 0.08 });
    o.connect(bp); bp.connect(lp); lp.connect(g); g.connect(p);
    o.start(tt); v.start(tt); stopAt([o, v], tt + 0.5);
  }
}
// --- Zonen-Layer: jede Zone hat einen eigenen Gain, setZone blendet weich (≈ 1 s) ---
// Strand: Brandung + Gischt + Möwe
function layerStrand(out) {
  const n = noise();
  const lp = filt('lowpass', 700, 0.5);
  const swell = ctx.createGain(); swell.gain.value = 0.55;
  const lfo = osc('sine', 1 / 9, now());
  const lfoG = ctx.createGain(); lfoG.gain.value = 0.35; lfo.connect(lfoG); lfoG.connect(swell.gain);
  const lfoF = ctx.createGain(); lfoF.gain.value = 450; lfo.connect(lfoF); lfoF.connect(lp.frequency);
  // Gischt: Hochpass-Zischen, das kurz nach dem Schwall kommt (zweiter LFO, versetzt)
  const n2 = noise(); const hp = filt('highpass', 2500, 0.5);
  const foam = ctx.createGain(); foam.gain.value = 0.08;
  const lfo2 = osc('sine', 1 / 9, now() + 2.2); const l2g = ctx.createGain(); l2g.gain.value = 0.07; lfo2.connect(l2g); l2g.connect(foam.gain);
  n.connect(lp); lp.connect(swell); swell.connect(out);
  n2.connect(hp); hp.connect(foam); foam.connect(out);
  n.start(); n2.start(); lfo.start(); lfo2.start(now() + 2.2);
  return { nodes: [n, n2, lfo, lfo2], timers: [], tick: null };
}
// Markt: Gemurmel-Teppich (zwei Bandpass-Rauschen, die unregelmäßig wabern) + Stimmengewirr + Händlerrufe
const WALLA_VOICES = 4;
function layerMarkt(out) {
  const nodes = [], timers = [];
  const bed = ctx.createGain(); bed.gain.value = 0.5; bed.connect(out);
  [[420, 0.9, 0.37], [1100, 1.2, 0.61]].forEach(([f, q, lf]) => {
    const n = noise(); const bp = filt('bandpass', f, q);
    const g = ctx.createGain(); g.gain.value = 0.12;
    const l = osc('sine', lf, now()); const lg = ctx.createGain(); lg.gain.value = 0.05; l.connect(lg); lg.connect(g.gain);
    n.connect(bp); bp.connect(g); g.connect(bed); n.start(); l.start(); nodes.push(n, l);
  });
  // Stimmengewirr: ein paar leise, gefilterte Brabbel-Stimmen mit Pseudo-Wörtern, jede in eigener Schleife
  const walla = ctx.createGain(); walla.gain.value = VOL.walla; const wlp = filt('lowpass', 1600, 0.7); walla.connect(wlp); wlp.connect(out);
  const layer = { nodes, timers, weight: 0 };
  for (let v = 0; v < WALLA_VOICES; v++) {
    const r = rng(500 + v);
    const p = pan((v / (WALLA_VOICES - 1)) * 1.4 - 0.7); p.connect(walla);
    const loop = () => {
      if (!amb) return;
      let wait = 0.4 + r() * 1.2;
      if (layer.weight > 0.02 && ready() && !muted) {
        const stil = ['schluffig', 'cool', 'brummig', 'quietschig'][Math.floor(r() * 4)];
        const plan = babblePlan({ tonhoehe: 0.7 + r() * 0.8, tempo: 0.8 + r() * 0.5, stil, vibrato: 0.1, laut: 0.5 + r() * 0.3 }, pseudoWords(r, 2 + Math.floor(r() * 4)), Math.floor(r() * 1e9));
        renderPlan(plan, p, now() + 0.02);
        wait += plan.duration;
      }
      timers[v] = setTimeout(loop, wait * 1000);
    };
    timers[v] = setTimeout(loop, 300 + v * 700);
  }
  // Händlerrufe: alle 6–15 s, aus der Ferne (Lowpass), zufällig gepannt
  const rufOut = ctx.createGain(); rufOut.gain.value = VOL.ruf; const rlp = filt('lowpass', 1900, 0.8); rufOut.connect(rlp); rlp.connect(out);
  layer.ruf = () => { const plan = babblePlan(stimmeFor('haendler', HAENDLER_FALLBACK), pickText('haendler', 'ruf', HAENDLER_RUFE)); const p = pan(Math.random() * 1.6 - 0.8); p.connect(rufOut); renderPlan(plan, p, now() + 0.02); return plan.duration; };
  const rufLoop = () => { if (!amb) return; if (layer.weight > 0.05 && ready() && !muted) layer.ruf(); timers[WALLA_VOICES] = setTimeout(rufLoop, nextRufDelay(Math.random) * 1000); };
  timers[WALLA_VOICES] = setTimeout(rufLoop, 4000);
  return layer;
}
// Posten: Funk-Rauschen mit Knacken + gelegentliche Funksprüche durch den Telefon-Filter
function layerPosten(out) {
  const nodes = [], timers = [];
  const n = noise(); const bp = filt('bandpass', 2200, 0.6); const g = ctx.createGain(); g.gain.value = 0.035;
  n.connect(bp); bp.connect(g); g.connect(out); n.start(); nodes.push(n);
  const layer = { nodes, timers, weight: 0 };
  // Knacken: kurze Hochpass-Bursts in unregelmäßigen Abständen
  const crackle = () => { if (!amb) return; if (layer.weight > 0.02 && ready() && !muted) radioCrackle(now() + 0.01, out, 0.5 + Math.random() * 0.5, 1 + Math.floor(Math.random() * 3)); timers[0] = setTimeout(crackle, (0.3 + Math.random() * 1.6) * 1000); };
  timers[0] = setTimeout(crackle, 800);
  // Funkspruch: Squelch auf, Gebrabbel durch 400–2800 Hz, Squelch zu
  const tel = ctx.createGain(); tel.gain.value = VOL.funkspruch;
  const hp = filt('highpass', 420, 0.9); const lp = filt('lowpass', 2700, 0.9); const mid = filt('peaking', 1400, 1.2); mid.gain.value = 6;
  tel.connect(hp); hp.connect(mid); mid.connect(lp); lp.connect(out);
  layer.funk = () => {
    const t = now() + 0.02;
    radioCrackle(t, out, 1, 1);
    const plan = babblePlan(stimmeFor('funk', FUNK_FALLBACK), pickText('funk', 'spruch', FUNK_SPRUECHE));
    renderPlan(plan, tel, t + 0.12);
    radioCrackle(t + 0.12 + plan.duration + 0.05, out, 0.8, 1);
    return plan.duration + 0.3;
  };
  const funkLoop = () => { if (!amb) return; if (layer.weight > 0.05 && ready() && !muted) layer.funk(); timers[1] = setTimeout(funkLoop, nextFunkDelay(Math.random) * 1000); };
  timers[1] = setTimeout(funkLoop, 5000);
  return layer;
}
// Funk-Knacken: n kurze Rauschbursts (auch als SFX 'funk')
function radioCrackle(t, out, vel, count) {
  for (let i = 0; i < count; i++) {
    const tt = t + i * (0.04 + Math.random() * 0.08);
    const n = noise(); const hp = filt('highpass', 2800, 0.7);
    const g = gainEnv(tt, { a: 0.001, peak: 0.5 * vel, d: 0.012 + Math.random() * 0.025 });
    n.connect(hp); hp.connect(g); g.connect(out); n.start(tt); n.stop(tt + 0.06);
  }
}
// Fallbacks, falls stimmen.json die Slugs 'haendler' / 'funk' (noch) nicht hat
const HAENDLER_FALLBACK = { tonhoehe: 0.9, tempo: 1.1, stil: 'knarzig', vibrato: 0.2, laut: 1.1 };
const HAENDLER_RUFE = ['Mango! Sweet mango!', 'Fresh coconut, my friend!', 'Two for one! Only today!', 'Cold drinks! Cold cold drinks!'];
const FUNK_FALLBACK = { tonhoehe: 0.95, tempo: 1.2, stil: 'zackig', vibrato: 0, laut: 0.8 };
const FUNK_SPRUECHE = ['Unit seven, copy.', 'Suspect wears sandals. Over.', 'Ten-four. Lunch break.', 'Nothing to report. Again.'];
const lastText = {};
function pickText(slug, situation, fallback) {
  const t = pickBark(stimmen, slug, situation, lastText[slug]) || pickBark({ barks: { [slug]: { [situation]: fallback } } }, slug, situation, lastText[slug]);
  lastText[slug] = t;
  return t;
}

// Pier: Tuk-Tuk im Leerlauf (Zündfolge ≈ 22 Hz als Sägezahn durch Lowpass + Auspuff-Rauschen im selben Takt, Drehzahl wabert leicht)
function layerPier(out) {
  const g = ctx.createGain(); g.gain.value = VOL.tuktuk; g.connect(out);
  const motor = osc('sawtooth', 22, now()); const mlp = filt('lowpass', 170, 1.5); const mg = ctx.createGain(); mg.gain.value = 0.8;
  motor.connect(mlp); mlp.connect(mg); mg.connect(g);
  const n = noise(); const bp = filt('bandpass', 850, 0.9); const puls = ctx.createGain(); puls.gain.value = 0.12;
  const pl = osc('square', 22, now()); const plg = ctx.createGain(); plg.gain.value = 0.1; pl.connect(plg); plg.connect(puls.gain); // Auspuff pulst im Zündtakt
  n.connect(bp); bp.connect(puls); puls.connect(g);
  const wob = osc('sine', 0.3, now()); const wg = ctx.createGain(); wg.gain.value = 1.6; wob.connect(wg); wg.connect(motor.frequency); wg.connect(pl.frequency);
  motor.start(); n.start(); pl.start(); wob.start();
  return { nodes: [motor, n, pl, wob], timers: [], weight: 0 };
}

// Bar: Gemurmel (dunkler Rauschteppich + zwei Brabbel-Stimmen) und Gläserklirren
function layerBar(out) {
  const nodes = [], timers = [];
  const n = noise(); const bp = filt('bandpass', 380, 1.0); const g = ctx.createGain(); g.gain.value = 0.1;
  const l = osc('sine', 0.23, now()); const lg = ctx.createGain(); lg.gain.value = 0.04; l.connect(lg); lg.connect(g.gain);
  n.connect(bp); bp.connect(g); g.connect(out); n.start(); l.start(); nodes.push(n, l);
  const layer = { nodes, timers, weight: 0 };
  const walla = ctx.createGain(); walla.gain.value = VOL.walla * 0.8; const wlp = filt('lowpass', 1200, 0.7); walla.connect(wlp); wlp.connect(out);
  for (let v = 0; v < 2; v++) {
    const r = rng(700 + v);
    const p = pan(v ? 0.5 : -0.5); p.connect(walla);
    const loop = () => {
      if (!amb) return;
      let wait = 0.8 + r() * 2;
      if (layer.weight > 0.02 && ready() && !muted) {
        const plan = babblePlan({ tonhoehe: 0.7 + r() * 0.5, tempo: 0.7 + r() * 0.3, stil: v ? 'brummig' : 'schluffig', vibrato: 0.1, laut: 0.6 }, pseudoWords(r, 2 + Math.floor(r() * 3)), Math.floor(r() * 1e9));
        renderPlan(plan, p, now() + 0.02);
        wait += plan.duration;
      }
      timers[v] = setTimeout(loop, wait * 1000);
    };
    timers[v] = setTimeout(loop, 500 + v * 900);
  }
  // Gläserklirren: zwei, drei hohe, unharmonische Partials mit Nachklang, zufällig gepannt
  const clink = () => {
    if (!amb) return;
    if (layer.weight > 0.05 && ready() && !muted) {
      const t = now() + 0.02, p = pan(Math.random() * 1.2 - 0.6); p.connect(out);
      const hits = 1 + Math.floor(Math.random() * 2);
      for (let h = 0; h < hits; h++) {
        const tt = t + h * (0.06 + Math.random() * 0.05), f0 = 2600 + Math.random() * 900;
        const g = gainEnv(tt, { a: 0.002, peak: VOL.klirren * (0.6 + Math.random() * 0.4), d: 0.35 + Math.random() * 0.3 });
        g.connect(p);
        [[1, 1], [1.48, 0.5], [2.31, 0.25]].forEach(([ratio, v]) => { const o = osc('sine', f0 * ratio, tt); const og = ctx.createGain(); og.gain.value = v; o.connect(og); og.connect(g); o.start(tt); o.stop(tt + 0.8); });
      }
    }
    timers[2] = setTimeout(clink, nextClinkDelay(Math.random) * 1000);
  };
  timers[2] = setTimeout(clink, 1500);
  return layer;
}
// Abend: Grillen (unabhängig von der Zone, über die Stimmung geblendet). Drei Grillen, je Schwall aus kurzen Pulsen.
function layerGrillen(out) {
  const timers = [];
  const layer = { nodes: [], timers, weight: 0 };
  for (let v = 0; v < 3; v++) {
    const r = rng(900 + v);
    const p = pan([-0.7, 0.2, 0.75][v]); p.connect(out);
    const loop = () => {
      if (!amb) return;
      const b = cricketBurst(r);
      if (layer.weight > 0.02 && ready() && !muted) {
        const t = now() + 0.02;
        const o = osc('sine', b.freq, t); const o2 = osc('sine', b.freq * 1.01, t); const og2 = ctx.createGain(); og2.gain.value = 0.5;
        const g = ctx.createGain(); g.gain.value = 0;
        o.connect(g); o2.connect(og2); og2.connect(g); g.connect(p);
        for (let i = 0; i < b.pulses; i++) {
          const tt = t + i * b.gap;
          g.gain.setValueAtTime(0.0001, tt); g.gain.linearRampToValueAtTime(VOL.grillen, tt + 0.004); g.gain.exponentialRampToValueAtTime(0.0001, tt + b.gap * 0.6);
        }
        const end = t + b.pulses * b.gap + 0.05;
        o.start(t); o2.start(t); stopAt([o, o2], end);
      }
      timers[v] = setTimeout(loop, (b.pulses * b.gap + b.pause) * 1000);
    };
    timers[v] = setTimeout(loop, 400 + v * 300);
  }
  return layer;
}

// Reisfeld: Frösche (Sägezahn mit Trill durch Formant-Bandpass), plätscherndes Wasser, Grillen auch tagsüber leise
function layerReisfeld(out) {
  const nodes = [], timers = [];
  const layer = { nodes, timers, weight: 0 };
  // Wasser: Hochpass-Rauschen, Lautstärke flattert mit zwei nicht ganzzahligen LFOs
  const n = noise(); const bp = filt('bandpass', 2600, 0.8); const wg = ctx.createGain(); wg.gain.value = VOL.wasser;
  [[1.7, 0.08], [0.43, 0.06]].forEach(([f, depth]) => { const l = osc('sine', f, now()); const lg = ctx.createGain(); lg.gain.value = depth; l.connect(lg); lg.connect(wg.gain); l.start(); nodes.push(l); });
  n.connect(bp); bp.connect(wg); wg.connect(out); n.start(); nodes.push(n);
  // Frösche: drei, je eigene Schleife, gepannt
  for (let v = 0; v < 3; v++) {
    const r = rng(1100 + v);
    const p = pan([-0.6, 0.1, 0.7][v]); p.connect(out);
    const loop = () => {
      if (!amb) return;
      const c = frogCall(r);
      if (layer.weight > 0.02 && ready() && !muted) {
        for (let i = 0; i < c.n; i++) {
          const tt = now() + 0.02 + i * c.gap;
          const o = osc('sawtooth', c.freq, tt); o.frequency.exponentialRampToValueAtTime(c.freq * 0.8, tt + 0.16);
          const tr = osc('square', c.trill, tt); const tg = ctx.createGain(); tg.gain.value = 0.5; const am = ctx.createGain(); am.gain.value = 0.5; tr.connect(tg); tg.connect(am.gain);
          const f1 = filt('bandpass', 520, 3); const f2 = filt('lowpass', 1800, 0.7);
          const g = gainEnv(tt, { a: 0.01, peak: VOL.frosch * (0.7 + r() * 0.3), d: 0.08, hold: 0.09 });
          o.connect(am); am.connect(f1); f1.connect(f2); f2.connect(g); g.connect(p);
          o.start(tt); tr.start(tt); stopAt([o, tr], tt + 0.25);
        }
      }
      timers[v] = setTimeout(loop, (c.n * c.gap + nextFrogDelay(r)) * 1000);
    };
    timers[v] = setTimeout(loop, 600 + v * 500);
  }
  // Grillen tagsüber leise (die Abend-Grillen kommen zusätzlich über die Stimmung)
  const gg = ctx.createGain(); gg.gain.value = 0.45; gg.connect(out);
  const gr = layerGrillen(gg);
  layer.sub = gr; // Gewicht wird in setZone mitgezogen
  return layer;
}

const LAYERS = { strand: layerStrand, markt: layerMarkt, posten: layerPosten, pier: layerPier, bar: layerBar, reisfeld: layerReisfeld };
let ambMood = 'tag';
let zoneWeights = normalizeZones(null);
export const ambience = {
  start() {
    if (!ready() || amb) return;
    const out = bus.ambience;
    const fade = ctx.createGain(); fade.gain.setValueAtTime(0.0001, now()); fade.gain.exponentialRampToValueAtTime(1, now() + 2.5);
    fade.connect(out);
    amb = { fade, layers: {}, gains: {}, gullTimer: null };
    for (const z of ZONES) {
      const g = ctx.createGain(); g.gain.value = zoneWeights[z]; g.connect(fade);
      amb.gains[z] = g;
      amb.layers[z] = LAYERS[z](g);
      amb.layers[z].weight = zoneWeights[z];
      if (amb.layers[z].sub) amb.layers[z].sub.weight = zoneWeights[z];
    }
    // Grillen hängen an der Stimmung, nicht an der Zone
    const gg = ctx.createGain(); gg.gain.value = ambMood === 'abend' ? 1 : 0; gg.connect(fade);
    amb.gains.grillen = gg; amb.layers.grillen = layerGrillen(gg); amb.layers.grillen.weight = gg.gain.value;
    const scheduleGull = () => {
      amb.gullTimer = setTimeout(() => { if (!amb) return; if (ready() && !muted && zoneWeights.strand > 0.05 && ambMood !== 'abend') gull(now() + 0.05, amb.gains.strand); scheduleGull(); }, nextGullDelay(Math.random) * 1000);
    };
    amb.gullTimer = setTimeout(scheduleGull, 2500);
  },
  stop() {
    if (!amb) return;
    const a = amb; amb = null;
    clearTimeout(a.gullTimer);
    for (const l of Object.values(a.layers)) { l.timers.forEach(clearTimeout); if (l.sub) l.sub.timers.forEach(clearTimeout); }
    a.fade.gain.setTargetAtTime(0.0001, now(), 0.4);
    setTimeout(() => { for (const l of Object.values(a.layers)) { stopAt(l.nodes, 0); if (l.sub) stopAt(l.sub.nodes, 0); } a.fade.disconnect(); }, 2000);
  },
  isPlaying: () => !!amb,
  /** Stimmung 'tag' | 'abend': abends Grillen an (weich), Möwen verstummen */
  setMood(m) {
    ambMood = normalizeMood(m);
    if (amb) { const w = ambMood === 'abend' ? 1 : 0; amb.gains.grillen.gain.setTargetAtTime(w, now(), 1.2); amb.layers.grillen.weight = w; }
    return ambMood;
  },
  getMood: () => ambMood,
  /** Zonen-Mischung, z. B. { strand: 1, markt: 0.3 }; fehlende Zonen = 0, weich überblendet (~1 s). null = nur Strand. */
  setZone(gewichte) {
    zoneWeights = normalizeZones(gewichte);
    if (!amb) return zoneWeights;
    for (const z of ZONES) {
      amb.gains[z].gain.setTargetAtTime(zoneWeights[z], now(), 0.35);
      amb.layers[z].weight = zoneWeights[z];
      if (amb.layers[z].sub) amb.layers[z].sub.weight = zoneWeights[z];
    }
    return zoneWeights;
  },
  getZone: () => ({ ...zoneWeights }),
  /** Händlerruf / Funkspruch sofort (z. B. beim Betreten), Dauer in s; 0 ohne laufende Ambience */
  ruf: () => (amb && ready() ? amb.layers.markt.ruf() : 0),
  funk: () => (amb && ready() ? amb.layers.posten.funk() : 0),
};

// ---------- Musik: Strand-Loop ----------
// Instrumente
function steelDrum(t, midi, vel, len, out) {
  const f = midiToFreq(midi);
  const g = gainEnv(t, { a: 0.004, peak: 0.5 * vel, d: Math.max(0.25, len * 0.9) });
  const hp = filt('highpass', 180, 0.7);
  g.connect(hp); hp.connect(out);
  // Pan-Charakter: Grundton + Oktave + leicht verstimmte Duodezime, kurzer Pitch-Dip am Anschlag
  [[1, 1, 'sine'], [2.003, 0.45, 'sine'], [3.01, 0.18, 'triangle'], [4.2, 0.06, 'sine']].forEach(([ratio, v, w]) => {
    const o = osc(w, f * ratio * 1.015, t);
    o.frequency.exponentialRampToValueAtTime(f * ratio, t + 0.04);
    const og = ctx.createGain(); og.gain.value = v; o.connect(og); og.connect(g);
    o.start(t); o.stop(t + len + 0.3);
  });
}
function bassNote(t, midi, vel, len, out) {
  const f = midiToFreq(midi);
  const o = osc('sine', f, t); const o2 = osc('triangle', f, t);
  const og2 = ctx.createGain(); og2.gain.value = 0.35;
  const lp = filt('lowpass', 320, 0.8);
  const g = gainEnv(t, { a: 0.012, peak: 0.9 * vel, d: 0.25, hold: Math.max(0.05, len - 0.08) });
  o.connect(lp); o2.connect(og2); og2.connect(lp); lp.connect(g); g.connect(out);
  o.start(t); o2.start(t); stopAt([o, o2], t + len + 0.35);
}
function kick(t, vel, out) {
  const o = osc('sine', 110, t); o.frequency.exponentialRampToValueAtTime(42, t + 0.12);
  const g = gainEnv(t, { a: 0.003, peak: 0.8 * vel, d: 0.22 });
  o.connect(g); g.connect(out); o.start(t); o.stop(t + 0.3);
}
function rimshot(t, vel, out) {
  const o = osc('triangle', 820, t); o.frequency.exponentialRampToValueAtTime(480, t + 0.03);
  const g = gainEnv(t, { a: 0.001, peak: 0.5 * vel, d: 0.05 });
  o.connect(g); g.connect(out); o.start(t); o.stop(t + 0.08);
  const n = noise(); const bp = filt('bandpass', 2200, 4); const ng = gainEnv(t, { a: 0.001, peak: 0.45 * vel, d: 0.035 });
  n.connect(bp); bp.connect(ng); ng.connect(out); n.start(t); n.stop(t + 0.06);
}
function shaker(t, vel, out) {
  const n = noise(); const hp = filt('highpass', 5500, 0.8);
  const g = gainEnv(t, { a: 0.008, peak: 0.22 * vel, d: 0.05 });
  n.connect(hp); hp.connect(g); g.connect(out); n.start(t); n.stop(t + 0.08);
}
let mus = null; // { timer, nextStep, nextTime, out, skank, drums, lead, delay, wet, reverbWet, tone, bpm, barMood }
let mood = 'tag';
const LOOKAHEAD = 0.18, TICK_MS = 50;
// Synthetische Hallfahne (Rauschen mit exponentiellem Abklingen), einmal pro Context
let reverbBuf = null;
function reverbImpulse(seconds = 1.9) {
  if (reverbBuf) return reverbBuf;
  const len = Math.floor(ctx.sampleRate * seconds);
  reverbBuf = ctx.createBuffer(2, len, ctx.sampleRate);
  for (let c = 0; c < 2; c++) {
    const d = reverbBuf.getChannelData(c);
    for (let i = 0; i < len; i++) d[i] = (Math.random() * 2 - 1) * Math.pow(1 - i / len, 2.6);
  }
  return reverbBuf;
}
function scheduleStep(stepAbs, t) {
  const bar = Math.floor(stepAbs / STEPS_PER_BAR), step = stepAbs % STEPS_PER_BAR;
  if (step === 0) mus.barMood = mood; // Pattern wechselt nur an der Taktgrenze
  const pat = musicPattern(bar, mus.barMood);
  const sec = stepSeconds(mus.bpm);
  for (const e of pat.events) {
    if (e.step !== step) continue;
    const len = (e.len || 1) * sec;
    switch (e.type) {
      case 'skank': for (const m of e.notes) steelDrum(t, m, e.vel * 0.55, len * 0.6, mus.skank); break;
      case 'lead': steelDrum(t, e.note + 12, e.vel * 0.7, len, mus.lead); break;
      case 'bass': bassNote(t, e.note, e.vel, len, mus.bass); break;
      case 'kick': kick(t, e.vel, mus.drums); break;
      case 'rim': rimshot(t, e.vel, mus.drums); break;
      case 'shaker': shaker(t, e.vel, mus.drums); break;
      default: break;
    }
  }
}
// Stimmung auf die laufenden Knoten legen (weich, ~2 s); das Tempo gleitet im Scheduler
function applyMood() {
  if (!mus) return;
  const p = MOODS[mood], t = now(), tc = 0.7;
  mus.drums.gain.setTargetAtTime(p.drums, t, tc);
  mus.skank.gain.setTargetAtTime(p.skank, t, tc);
  mus.bass.gain.setTargetAtTime(p.bass, t, tc);
  mus.lead.gain.setTargetAtTime(p.lead / MOODS.tag.lead, t, tc);
  mus.wet.gain.setTargetAtTime(p.echo, t, tc);
  mus.reverbWet.gain.setTargetAtTime(p.reverb, t, tc);
  mus.tone.frequency.setTargetAtTime(p.tone, t, tc);
}
export const music = {
  start() {
    if (!ready() || mus || !musicEnabled) return;
    const out = ctx.createGain(); out.gain.value = 1; out.connect(bus.music);
    const p = MOODS[mood];
    // Klangfarbe: ein Lowpass vor dem Ausgang, abends dunkler
    const tone = filt('lowpass', p.tone, 0.5); tone.connect(out);
    // Gruppen mit eigener Lautstärke je Stimmung
    const skank = ctx.createGain(); skank.gain.value = p.skank; skank.connect(tone);
    const drums = ctx.createGain(); drums.gain.value = p.drums; drums.connect(tone);
    const bass = ctx.createGain(); bass.gain.value = p.bass; bass.connect(tone);
    const lead = ctx.createGain(); lead.gain.value = p.lead / MOODS.tag.lead; lead.connect(tone);
    // Skank, Lead + Drums gehen zusätzlich durch ein leises Dub-Echo (punktierte Achtel)
    const delay = ctx.createDelay(1.0); delay.delayTime.value = stepSeconds(p.bpm) * 3;
    const fb = ctx.createGain(); fb.gain.value = 0.3; const wet = ctx.createGain(); wet.gain.value = p.echo;
    const dlp = filt('lowpass', 1800, 0.7);
    skank.connect(delay); lead.connect(delay); drums.connect(delay); delay.connect(dlp); dlp.connect(fb); fb.connect(delay); dlp.connect(wet); wet.connect(tone);
    // Hall (Bar-Live-Gefühl abends): Convolver mit synthetischer Fahne
    const reverb = ctx.createConvolver(); reverb.buffer = reverbImpulse();
    const reverbWet = ctx.createGain(); reverbWet.gain.value = p.reverb;
    skank.connect(reverb); lead.connect(reverb); drums.connect(reverb); reverb.connect(reverbWet); reverbWet.connect(tone);
    mus = { timer: null, nextStep: 0, nextTime: now() + 0.1, out, skank, drums, bass, lead, delay, wet, reverbWet, tone, bpm: p.bpm, barMood: mood };
    const tick = () => {
      if (!mus) return;
      while (mus.nextTime < now() + LOOKAHEAD) {
        if (!muted) scheduleStep(mus.nextStep, mus.nextTime);
        mus.nextStep++;
        mus.bpm = nextBpm(mus.bpm, MOODS[mood].bpm);
        mus.nextTime += stepSeconds(mus.bpm);
        mus.delay.delayTime.setTargetAtTime(stepSeconds(mus.bpm) * 3, mus.nextTime, 0.3);
      }
    };
    mus.timer = setInterval(tick, TICK_MS);
    tick();
  },
  /** Stimmung 'tag' | 'abend': Tempo gleitet, Drums/Hall/Klangfarbe blenden weich; Pattern wechselt an der Taktgrenze */
  setMood(m) {
    mood = normalizeMood(m);
    applyMood();
    return mood;
  },
  getMood: () => mood,
  getBpm: () => (mus ? mus.bpm : MOODS[mood].bpm),
  stop() {
    if (!mus) return;
    const m = mus; mus = null;
    clearInterval(m.timer);
    m.out.gain.setTargetAtTime(0.0001, now(), 0.3);
    setTimeout(() => m.out.disconnect(), 2500);
  },
  isPlaying: () => !!mus,
  setVolume(v) {
    musicVolume = clamp(Number(v) || 0, 0, 1);
    if (bus) bus.music.gain.setTargetAtTime(musicVolume, now(), 0.05);
  },
  getVolume: () => musicVolume,
  /** Musik generell an/aus (persistent); aus → stoppt sofort */
  setEnabled(on) {
    musicEnabled = !!on;
    store.set(STORE_MUSIC, musicEnabled ? '1' : '0');
    if (!musicEnabled) music.stop();
  },
  isEnabled: () => musicEnabled,
};

// ---------- Gebrabbel ----------
let stimmen = normalizeStimmen(null);
const lastBark = {}; // slug → zuletzt gesagter Text
/** Lädt data/stimmen.json (relativ zur Seite); fehlt sie, bleibt alles Default. */
export async function loadStimmen(url = './data/stimmen.json') {
  try {
    const res = await fetch(url, { cache: 'no-store' });
    if (res.ok) stimmen = normalizeStimmen(await res.json());
  } catch (e) { /* keine Datei → Default-Stimme */ }
  return stimmen;
}
export const setStimmen = (json) => { stimmen = normalizeStimmen(json); return stimmen; };
/** Profil für Kunden-id (z. B. 'zivi_1') oder Slug ('mentor', 'spieler'); unbekannt → fallback (sonst default) */
export const stimmeFor = (id, fallback = null) => {
  const slug = slugFor(stimmen, id);
  return slug === 'default' && fallback ? normalizeStimme(fallback) : stimmen.stimmen[slug];
};
export const stimmenIds = () => Object.keys(stimmen.stimmen);
export const barkSituations = (id) => Object.keys(stimmen.barks[slugFor(stimmen, id)] || {});
/**
 * Bark einer Figur sprechen: wählt einen Text aus stimmen.json (nie zweimal derselbe hintereinander) und
 * brabbelt ihn. Gibt { text, dauer } zurück oder null, wenn es für die Situation keinen Bark gibt.
 * Situationen Kunden: gruss | kauf | ablehnung | zivi_verdaechtig; Mentor: gruss | lektion | nachschub | abschied.
 */
export function bark(id, situation, opts = {}) {
  const slug = slugFor(stimmen, id);
  const text = pickBark(stimmen, slug, situation, lastBark[slug]);
  if (!text) return null;
  lastBark[slug] = text;
  return { text, dauer: babble(slug, text, opts) };
}
/** Pan-Option -1 (links) .. 1 (rechts) → geclampt, ungültig/fehlend → 0 (Mitte) */
export const normalizePan = (p) => clamp(Number(p) || 0, -1, 1);

let speaking = null; // { gain, nodes, until }
export function stopBabble() {
  if (speaking) {
    const s = speaking; speaking = null;
    s.gain.gain.cancelScheduledValues(now());
    s.gain.gain.setTargetAtTime(0.0001, now(), 0.02);
    setTimeout(() => { stopAt(s.nodes, 0); s.gain.disconnect(); }, 150);
  }
  if (typeof speechSynthesis !== 'undefined') speechSynthesis.cancel();
}
export function setVoiceMode(mode) {
  voiceMode = mode === 'tts' && ttsAvailable() ? 'tts' : 'babble';
  store.set(STORE_VOICE, voiceMode);
  stopBabble();
}
export const getVoiceMode = () => voiceMode;
export const ttsAvailable = () => typeof speechSynthesis !== 'undefined' && typeof SpeechSynthesisUtterance !== 'undefined';

function playPlan(plan, panPos = 0) {
  const t0 = now() + 0.02;
  const g = ctx.createGain(); g.gain.value = plan.stimme.laut;
  // Position links/rechts (nur wenn gewünscht; Mitte spart den Panner)
  if (panPos) { const p = pan(panPos); g.connect(p); p.connect(bus.voice); } else g.connect(bus.voice);
  const nodes = renderPlan(plan, g, t0);
  speaking = { gain: g, nodes, until: t0 + plan.duration };
  setTimeout(() => { if (speaking && speaking.gain === g) { speaking = null; g.disconnect(); } }, (plan.duration + 0.3) * 1000);
}
/** Brabbel-Plan ab t0 in dest rendern (auch für Stimmengewirr/Händler/Funk); gibt die gestarteten Quellen zurück */
function renderPlan(plan, dest, t0) {
  const st = STIL[plan.stimme.stil];
  const g = dest;
  const nodes = [];
  // Stimmen bleiben trocken, damit sie über der Ambience sitzen
  for (const n of plan.notes) {
    const t = t0 + n.t;
    const o = osc(st.wave, n.freq, t);
    o.frequency.exponentialRampToValueAtTime(Math.max(40, n.freqEnd), t + n.dur);
    if (plan.stimme.vibrato > 0.05) {
      const v = osc('sine', 7 + plan.stimme.vibrato * 4, t); const vg = ctx.createGain();
      vg.gain.value = n.freq * 0.03 * plan.stimme.vibrato; v.connect(vg); vg.connect(o.frequency); v.start(t); v.stop(t + n.dur + 0.05); nodes.push(v);
    }
    const bp = filt('bandpass', FORMANT[n.vowel] || 600, st.q);
    const lp = filt('lowpass', 2600, 0.7);
    const env = gainEnv(t, { a: st.attack, peak: 0.6 * n.gain, d: 0.04, hold: Math.max(0.01, n.dur - st.attack - 0.04) });
    o.connect(bp); bp.connect(lp); lp.connect(env); env.connect(g);
    o.start(t); o.stop(t + n.dur + 0.06); nodes.push(o);
    if (st.sub) { const s = osc('sine', n.freq / 2, t); const sg = ctx.createGain(); sg.gain.value = 0.5; s.connect(sg); sg.connect(env); s.start(t); s.stop(t + n.dur + 0.06); nodes.push(s); }
    if (st.rau) { const r = noise(); const rb = filt('bandpass', n.freq * 2, 1); const rg = ctx.createGain(); rg.gain.value = 0.12; r.connect(rb); rb.connect(rg); rg.connect(env); r.start(t); r.stop(t + n.dur); nodes.push(r); }
  }
  return nodes;
}
function speakTts(stimme, text) {
  const u = new SpeechSynthesisUtterance(String(text));
  u.lang = 'en-US';
  const voices = speechSynthesis.getVoices ? speechSynthesis.getVoices() : [];
  const v = voices.find((x) => /^en[-_]US/i.test(x.lang)) || voices.find((x) => /^en[-_]GB/i.test(x.lang)) || voices.find((x) => /^en/i.test(x.lang));
  if (v) { u.voice = v; u.lang = v.lang; }
  u.pitch = clamp(stimme.tonhoehe, 0.3, 2);
  u.rate = clamp(0.9 * stimme.tempo, 0.5, 1.8);
  u.volume = muted ? 0 : clamp(VOL.voice * stimme.laut, 0, 1);
  speechSynthesis.cancel();
  speechSynthesis.speak(u);
  return (String(text).length / 14) / u.rate + 0.3; // grobe Schätzung
}
/**
 * Lässt eine Figur „reden“. stimme = Profil-Objekt oder id aus stimmen.json. Gibt die Dauer in Sekunden zurück
 * (auch ohne laufendes Audio, damit Aufrufer Timing planen können). Ein neuer Aufruf unterbricht den vorigen.
 * opts.pan: -1 (links) .. 1 (rechts), Standard Mitte; bei Browser-Sprachausgabe ohne Wirkung.
 */
export function babble(stimme, text, opts = {}) {
  const profil = typeof stimme === 'string' ? stimmeFor(stimme) : normalizeStimme(stimme);
  const plan = babblePlan(profil, text);
  stopBabble();
  if (voiceMode === 'tts' && ttsAvailable()) return speakTts(profil, text);
  if (!ready() || !plan.notes.length) return plan.duration;
  playPlan(plan, normalizePan(opts && opts.pan));
  return plan.duration;
}

// ---------- Stimmung (Musik + Ambience in einem) ----------
/** 'tag' | 'abend' — das Spiel ruft das einmal beim Phasenwechsel; alles blendet weich, nichts springt */
export function setMood(m) {
  music.setMood(m);
  ambience.setMood(m);
  return normalizeMood(m);
}
export const getMood = () => music.getMood();
