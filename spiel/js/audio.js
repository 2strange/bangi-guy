// audio.js — Sound für Bangi Beach, komplett prozedural mit WebAudio (keine Dateien, keine Bibliotheken).
// Aufbau: reine Helfer oben (Silbenplan fürs Gebrabbel, Musik-Pattern, Stimmprofile) sind ohne Browser testbar;
// darunter der WebAudio-Teil (Busse, Limiter, SFX, Ambience, Musik-Loop, Gebrabbel, Mute).
//
// Kurz-API (alles no-op, solange initAudio() noch nicht lief bzw. der Nutzer noch nicht geklickt hat):
//   initAudio()                     einmal beim Start; wartet selbst auf die erste Geste (iOS: resume)
//   setMuted(bool) / isMuted()      Mute mit localStorage
//   sfx('kasse' | 'ablehnen' | 'heat' | 'verhaftet' | 'ausverkauft' | 'schritt_sand' | 'ui_klick' | 'hinschauen')
//   ambience.start() / .stop()      Brandung + Möwe
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
  moewe: 0.35,
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
/** Events eines Taktes (bar ≥ 0, wird modulo BARS gewickelt). Deterministisch. */
export function musicPattern(bar) {
  const b = ((bar % BARS) + BARS) % BARS;
  const chord = CHORD[PROGRESSION[b]];
  const r = rng(1000 + b);
  const ev = [];
  const push = (step, type, extra = {}) => ev.push({ step, type, ...extra });
  // Shaker: alle Achtel, Offbeats lauter
  for (let s = 0; s < 16; s += 2) push(s, 'shaker', { vel: s % 4 === 2 ? 0.9 : 0.45 });
  // One-Drop
  const dubDrop = b === 7 || b === 15;         // Dub: Kick fällt weg, Rimshot bleibt + Echo-Gefühl
  if (!dubDrop) push(8, 'kick', { vel: 1 });
  push(8, 'rim', { vel: 1 });
  if (b % 4 === 3) push(14, 'rim', { vel: 0.6 });  // kleiner Fill am Blockende
  // Skank (Offbeats), auf Takt 15 nur zwei Anschläge, Platz für den Lick
  const skankSteps = b === 15 ? [2, 10] : [2, 6, 10, 14];
  for (const s of skankSteps) push(s, 'skank', { notes: chord.skank, vel: s === 6 || s === 14 ? 0.85 : 1, len: 2 });
  if (b % 4 === 1 && r() < 0.6) push(15, 'skank', { notes: chord.skank, vel: 0.5, len: 1 }); // Vorschlag vor Takt 1
  // Bass: Grundton auf 1 (lang), Grundton auf 3, Quinte vor der 1; in Dub-Takten erst ab der 3
  const root = chord.bass, fifth = root + 7, third = root + (PROGRESSION[b] === 'Em' ? 3 : 4);
  if (!dubDrop) push(0, 'bass', { note: root, len: 6, vel: 1 });
  push(8, 'bass', { note: root, len: 3, vel: 0.9 });
  if (b % 4 === 3) { push(11, 'bass', { note: third, len: 2, vel: 0.7 }); push(13, 'bass', { note: fifth, len: 2, vel: 0.8 }); }
  else push(12, 'bass', { note: fifth, len: 2, vel: 0.75 });
  // Steel-Drum-Lick in den letzten vier Takten, leise
  if (b >= 12) for (const [s, semi] of LICKS[b - 12]) push(s, 'lead', { note: chord.skank[0] + semi, vel: 0.6, len: 3 });
  ev.sort((x, y) => x.step - y.step);
  return { bar: b, chord: PROGRESSION[b], events: ev };
}
export const stepSeconds = () => 60 / BPM / 4;

/** Möwen-Abstand in Sekunden (8–22 s), rng = Funktion 0..1 */
export const nextGullDelay = (r) => 8 + r() * 14;

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
const warned = new Set();
/** Spielt einen Effekt. Gibt die ungefähre Dauer in Sekunden zurück (0, wenn Audio nicht läuft). */
export function sfx(name) {
  if (!SFX[name]) { if (!warned.has(name)) { warned.add(name); console.warn('audio: unbekannter Effekt', name); } return 0; }
  if (!ready()) return 0;
  const out = ctx.createGain(); out.gain.value = VOL[name] ?? 1; out.connect(bus.sfx);
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
export const ambience = {
  start() {
    if (!ready() || amb) return;
    const out = bus.ambience;
    // Brandung: Rauschen → Lowpass, Cutoff und Lautstärke wabern mit einer langsamen Welle (≈ alle 9 s)
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
    const fade = ctx.createGain(); fade.gain.setValueAtTime(0.0001, now()); fade.gain.exponentialRampToValueAtTime(1, now() + 2.5);
    n.connect(lp); lp.connect(swell); swell.connect(fade);
    n2.connect(hp); hp.connect(foam); foam.connect(fade);
    fade.connect(out);
    n.start(); n2.start(); lfo.start(); lfo2.start(now() + 2.2);
    amb = { nodes: [n, n2, lfo, lfo2], fade, gullTimer: null };
    const scheduleGull = () => {
      amb.gullTimer = setTimeout(() => { if (!amb) return; if (ready() && !muted) gull(now() + 0.05, out); scheduleGull(); }, nextGullDelay(Math.random) * 1000);
    };
    amb.gullTimer = setTimeout(scheduleGull, 2500);
  },
  stop() {
    if (!amb) return;
    const a = amb; amb = null;
    clearTimeout(a.gullTimer);
    a.fade.gain.setTargetAtTime(0.0001, now(), 0.4);
    setTimeout(() => { stopAt(a.nodes, 0); a.fade.disconnect(); }, 2000);
  },
  isPlaying: () => !!amb,
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
let mus = null; // { timer, nextStep, nextTime, out, skank, delay }
const LOOKAHEAD = 0.18, TICK_MS = 50;
function scheduleStep(stepAbs, t) {
  const bar = Math.floor(stepAbs / STEPS_PER_BAR), step = stepAbs % STEPS_PER_BAR;
  const pat = musicPattern(bar);
  const sec = stepSeconds();
  for (const e of pat.events) {
    if (e.step !== step) continue;
    const len = (e.len || 1) * sec;
    switch (e.type) {
      case 'skank': for (const m of e.notes) steelDrum(t, m, e.vel * 0.55, len * 0.6, mus.skank); break;
      case 'lead': steelDrum(t, e.note + 12, e.vel * 0.7, len, mus.skank); break;
      case 'bass': bassNote(t, e.note, e.vel, len, mus.out); break;
      case 'kick': kick(t, e.vel, mus.out); break;
      case 'rim': rimshot(t, e.vel, mus.skank); break;
      case 'shaker': shaker(t, e.vel, mus.out); break;
      default: break;
    }
  }
}
export const music = {
  start() {
    if (!ready() || mus || !musicEnabled) return;
    const out = ctx.createGain(); out.gain.value = 1; out.connect(bus.music);
    // Skank + Rimshot gehen zusätzlich durch ein leises Dub-Echo (punktierte Achtel)
    const skank = ctx.createGain(); skank.connect(out);
    const delay = ctx.createDelay(1.0); delay.delayTime.value = stepSeconds() * 3;
    const fb = ctx.createGain(); fb.gain.value = 0.3; const wet = ctx.createGain(); wet.gain.value = 0.22;
    const dlp = filt('lowpass', 1800, 0.7);
    skank.connect(delay); delay.connect(dlp); dlp.connect(fb); fb.connect(delay); dlp.connect(wet); wet.connect(out);
    mus = { timer: null, nextStep: 0, nextTime: now() + 0.1, out, skank, delay };
    const tick = () => {
      if (!mus) return;
      while (mus.nextTime < now() + LOOKAHEAD) {
        if (!muted) scheduleStep(mus.nextStep, mus.nextTime);
        mus.nextStep++;
        mus.nextTime += stepSeconds();
      }
    };
    mus.timer = setInterval(tick, TICK_MS);
    tick();
  },
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
/** Profil für Kunden-id (z. B. 'zivi_1') oder Slug ('mentor', 'spieler'); unbekannt → default */
export const stimmeFor = (id) => stimmen.stimmen[slugFor(stimmen, id)];
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
  const st = STIL[plan.stimme.stil];
  const t0 = now() + 0.02;
  const g = ctx.createGain(); g.gain.value = plan.stimme.laut;
  // Position links/rechts (nur wenn gewünscht; Mitte spart den Panner)
  if (panPos) { const p = pan(panPos); g.connect(p); p.connect(bus.voice); } else g.connect(bus.voice);
  const nodes = [];
  // leichter Hall-Ersatz: nichts; Stimmen bleiben trocken, damit sie über der Ambience sitzen
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
  speaking = { gain: g, nodes, until: t0 + plan.duration };
  setTimeout(() => { if (speaking && speaking.gain === g) { speaking = null; g.disconnect(); } }, (plan.duration + 0.3) * 1000);
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
