// Tests der reinen Audio-Helfer (ohne WebAudio): Silben, Gebrabbel-Plan, Stimmprofile, Musik-Pattern
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import {
  syllables, babblePlan, normalizeStimme, normalizeStimmen, STIL, DEFAULT_STIMME, slugFor, pickBark, bark,
  musicPattern, PROGRESSION, BARS, STEPS_PER_BAR, BPM, stepSeconds, nextGullDelay, rng, hashStr, midiToFreq, SFX_NAMES,
  babble, sfx, setMuted, isMuted, ambience, music, stimmeFor, setStimmen, normalizePan,
  ZONES, normalizeZones, pseudoWords, nextRufDelay, nextFunkDelay, sputterTimes, normalizeSfxOpts,
} from '../js/audio.js';

const close = (a, b, eps = 1e-6, msg) => assert.ok(Math.abs(a - b) < eps, msg ?? `${a} ≈ ${b}`);

test('syllables: eine Gruppe je Vokalgruppe, Satzzeichen weg', () => {
  assert.deepEqual(syllables('banana'), ['ba', 'na', 'na']);
  assert.deepEqual(syllables('strand'), ['strand']);
  assert.deepEqual(syllables('Hey!'), ['hey']);
  assert.deepEqual(syllables('dude,'), ['du', 'de']);
  assert.deepEqual(syllables('...'), []);
  assert.deepEqual(syllables('tsk'), ['tsk']); // keine Vokale: trotzdem eine Silbe
  // Konsonantenwüste wird zerteilt, nichts geht verloren
  assert.equal(syllables('schtschrrmpf').join(''), 'schtschrrmpf');
});

test('babblePlan: leer → 0, länger → länger, deterministisch', () => {
  assert.equal(babblePlan(DEFAULT_STIMME, '').duration, 0);
  assert.equal(babblePlan(DEFAULT_STIMME, '   ').notes.length, 0);
  const a = babblePlan(DEFAULT_STIMME, 'Hey dude.');
  const b = babblePlan(DEFAULT_STIMME, 'Hey dude, got any of the good stuff?');
  assert.ok(a.duration > 0.2 && a.duration < 1.5, `kurz: ${a.duration}`);
  assert.ok(b.duration > a.duration, 'mehr Text = länger');
  assert.ok(b.duration < 4, `nicht ewig: ${b.duration}`);
  assert.deepEqual(babblePlan(DEFAULT_STIMME, 'Hey dude.'), a, 'gleicher Satz, gleicher Plan');
  // Noten liegen nacheinander, keine Überlappung
  for (let i = 1; i < b.notes.length; i++) assert.ok(b.notes[i].t >= b.notes[i - 1].t + b.notes[i - 1].dur - 1e-9);
});

test('babblePlan: tonhoehe skaliert die Frequenz, tempo die Dauer', () => {
  const text = 'Totally relaxed, man.';
  const lo = babblePlan({ tonhoehe: 0.6, tempo: 1, stil: 'brummig' }, text);
  const hi = babblePlan({ tonhoehe: 1.6, tempo: 1, stil: 'piepsig' }, text);
  const avg = (p) => p.notes.reduce((s, n) => s + n.freq, 0) / p.notes.length;
  assert.ok(avg(hi) > avg(lo) * 2, `hoch ${avg(hi)} > tief ${avg(lo)}`);
  assert.ok(avg(lo) > 80 && avg(hi) < 900, 'im sinnvollen Stimmbereich');
  const slow = babblePlan({ tempo: 0.7 }, text), fast = babblePlan({ tempo: 1.4 }, text);
  assert.ok(slow.duration > fast.duration * 1.6, `langsam ${slow.duration} vs schnell ${fast.duration}`);
});

test('babblePlan: Frage endet oben, Aussage unten, Ausruf lauter', () => {
  const q = babblePlan(DEFAULT_STIMME, 'Any good stuff?');
  const s = babblePlan(DEFAULT_STIMME, 'Any good stuff.');
  const lastQ = q.notes[q.notes.length - 1], lastS = s.notes[s.notes.length - 1];
  assert.ok(lastQ.freq > lastS.freq * 1.3, 'Frage am Ende höher');
  const e = babblePlan(DEFAULT_STIMME, 'Cops!');
  const n = babblePlan(DEFAULT_STIMME, 'Cops.');
  assert.ok(e.notes[0].gain > n.notes[0].gain, 'Ausruf lauter');
});

test('normalizeStimme: Defaults, Clamp, unbekannter Stil → schluffig', () => {
  const d = normalizeStimme(null);
  assert.equal(d.stil, 'schluffig'); assert.equal(d.tonhoehe, 1); assert.equal(d.tempo, 1);
  const x = normalizeStimme({ tonhoehe: 99, tempo: 0.01, stil: 'opernsänger', vibrato: 7 });
  assert.equal(x.tonhoehe, 2.5); assert.equal(x.tempo, 0.4); assert.equal(x.stil, 'schluffig'); assert.equal(x.vibrato, 1);
  for (const k of Object.keys(STIL)) assert.equal(normalizeStimme({ stil: k }).stil, k);
  // Content-Form (charakter + barks + zuordnung) und flache Form
  const m = normalizeStimmen({ _schema: 'x', zuordnung: { zivi_1: 'zivi_polo' }, stimmen: { zivi_polo: { charakter: { tonhoehe: 1.1, stil: 'zackig', laut: 1.2 }, barks: { gruss: ['Hello.', 'Hi.'] } } } });
  assert.equal(m.stimmen.zivi_polo.stil, 'zackig'); assert.equal(m.stimmen.zivi_polo.laut, 1.2); assert.ok(m.stimmen.default);
  assert.deepEqual(m.barks.zivi_polo.gruss, ['Hello.', 'Hi.']);
  assert.equal(normalizeStimmen({ oma_1: { stil: 'piepsig' } }).stimmen.oma_1.stil, 'piepsig');
  setStimmen(m);
  assert.equal(stimmeFor('zivi_1').stil, 'zackig', 'über zuordnung');
  assert.equal(stimmeFor('zivi_polo').stil, 'zackig', 'direkt per Slug');
  assert.equal(stimmeFor('gibtsnicht').stil, 'schluffig');
  assert.equal(slugFor(m, 'zivi_1'), 'zivi_polo'); assert.equal(slugFor(m, 'x'), 'default');
});

test('stimmen.json (Content): alle Slugs valide, jede Kunden-id hat eine Stimme, Barks nie doppelt hintereinander', async () => {
  const db = normalizeStimmen(JSON.parse(await readFile(new URL('../data/stimmen.json', import.meta.url), 'utf8')));
  for (const id of Object.keys(db.zuordnung)) assert.ok(db.stimmen[db.zuordnung[id]], `Slug für ${id}: ${db.zuordnung[id]}`);
  assert.ok(db.stimmen.mentor && db.stimmen.spieler, 'feste Slugs');
  const kunden = JSON.parse(await readFile(new URL('../data/kunden.json', import.meta.url), 'utf8')).kunden;
  for (const k of kunden) assert.notEqual(slugFor(db, k.id), 'default', `Kunde ${k.id} hat eine eigene Stimme`);
  // Stile sind alle bekannt (normalizeStimme fällt sonst still auf schluffig zurück → hier explizit prüfen)
  const raw = JSON.parse(await readFile(new URL('../data/stimmen.json', import.meta.url), 'utf8')).stimmen;
  for (const [slug, v] of Object.entries(raw)) assert.ok(STIL[v.charakter.stil], `${slug}: Stil ${v.charakter.stil}`);
  // Bark-Wahl: nie zweimal hintereinander derselbe, alle Texte brabbelbar (Dauer > 0)
  let last = null;
  const r = rng(7);
  for (let i = 0; i < 40; i++) { const t = pickBark(db, 'surfer', 'kauf', last, r); assert.ok(t && t !== last); last = t; }
  assert.equal(pickBark(db, 'surfer', 'gibtsnicht'), null);
  assert.equal(pickBark(db, 'default', 'gruss'), null, 'default hat keine Barks');
  for (const [slug, sits] of Object.entries(db.barks)) for (const [sit, list] of Object.entries(sits)) for (const t of list) {
    const p = babblePlan(db.stimmen[slug], t);
    assert.ok(p.duration > 0.1 && p.duration < 4, `${slug}/${sit} „${t}“: ${p.duration}`);
  }
  setStimmen(db);
  const b = bark('zivi_1', 'gruss');
  assert.ok(b && b.text && b.dauer > 0, 'bark liefert Text + Dauer auch ohne WebAudio');
  assert.equal(bark('zivi_1', 'gibtsnicht'), null);
  assert.equal(bark('spieler', 'gruss'), null);
});

test('musicPattern: 16 Takte, Skank nur auf Offbeats, One-Drop, Bass im Keller, deterministisch', () => {
  assert.equal(PROGRESSION.length, BARS);
  close(stepSeconds(), 60 / BPM / 4);
  for (let b = 0; b < BARS; b++) {
    const p = musicPattern(b);
    assert.equal(p.events.length > 0, true);
    for (const e of p.events) assert.ok(e.step >= 0 && e.step < STEPS_PER_BAR && Number.isInteger(e.step));
    const skank = p.events.filter((e) => e.type === 'skank');
    assert.ok(skank.length >= 2, 'Skank da');
    for (const e of skank) assert.ok(e.step % 4 === 2 || e.step === 15, `Skank auf Offbeat/Vorschlag, nicht step ${e.step}`);
    assert.ok(p.events.some((e) => e.type === 'rim' && e.step === 8), 'Rimshot auf der 3');
    for (const e of p.events.filter((x) => x.type === 'bass')) assert.ok(e.note >= 36 && e.note <= 62, `Bass tief: ${e.note}`);
    for (const e of p.events.filter((x) => x.type === 'skank')) for (const n of e.notes) assert.ok(n >= 60 && n <= 84);
    assert.deepEqual(musicPattern(b), musicPattern(b + BARS), 'Loop wickelt');
  }
  // Variation: Dub-Takte ohne Kick, Lick am Ende, aber kein Takt leer
  assert.ok(!musicPattern(7).events.some((e) => e.type === 'kick'));
  assert.ok(musicPattern(0).events.some((e) => e.type === 'kick'));
  assert.ok(musicPattern(14).events.some((e) => e.type === 'lead'));
  assert.ok(!musicPattern(3).events.some((e) => e.type === 'lead'));
  assert.notDeepEqual(musicPattern(0).events, musicPattern(3).events, 'Fill am Blockende');
  // Sortiert nach step
  const ev = musicPattern(5).events; for (let i = 1; i < ev.length; i++) assert.ok(ev[i].step >= ev[i - 1].step);
});

test('Zonen: normalizeZones clampt, ignoriert Unbekanntes, null = Strand; Pseudo-Wörter brabbelbar', () => {
  assert.deepEqual(ZONES, ['strand', 'markt', 'posten', 'pier']);
  assert.deepEqual(normalizeZones(null), { strand: 1, markt: 0, posten: 0, pier: 0 });
  assert.deepEqual(normalizeZones({}), { strand: 0, markt: 0, posten: 0, pier: 0 });
  assert.deepEqual(normalizeZones({ strand: 1, markt: 0.3 }), { strand: 1, markt: 0.3, posten: 0, pier: 0 });
  assert.deepEqual(normalizeZones({ strand: 7, markt: -1, posten: 'x', bar: 1 }), { strand: 1, markt: 0, posten: 0, pier: 0 });
  assert.deepEqual(normalizeZones({ posten: '0.4', pier: 0.9 }), { strand: 0, markt: 0, posten: 0.4, pier: 0.9 });
  // Abwürgen: Zündungen werden langsamer, Puff kommt nach der letzten, Gesamtlänge ~1–2 s
  const sp = sputterTimes();
  assert.equal(sp.pops[0], 0);
  for (let i = 2; i < sp.pops.length; i++) assert.ok(sp.pops[i] - sp.pops[i - 1] > sp.pops[i - 1] - sp.pops[i - 2], 'Abstand wächst');
  assert.ok(sp.puff > sp.pops[sp.pops.length - 1] && sp.puff > 0.8 && sp.puff < 2.5, `Puff bei ${sp.puff}`);
  assert.deepEqual(sputterTimes(3, 0.1, 2), { pops: [0, 0.1, 0.30000000000000004], puff: 0.7000000000000001 });
  const r = rng(3);
  const t = pseudoWords(r, 5);
  assert.equal(t.split(' ').length, 5);
  assert.match(t, /^[a-z ]+$/);
  assert.equal(pseudoWords(rng(3), 5), t, 'deterministisch');
  const p = babblePlan(DEFAULT_STIMME, t);
  assert.ok(p.notes.length >= 5 && p.duration > 0.3, 'jedes Wort mindestens eine Silbe');
  assert.equal(pseudoWords(r, 0), '');
  assert.equal(nextRufDelay(() => 0), 6); assert.equal(nextRufDelay(() => 1), 15);
  assert.equal(nextFunkDelay(() => 0), 10); assert.equal(nextFunkDelay(() => 1), 25);
  // stimmeFor mit Fallback: unbekannter Slug → Fallback-Profil, bekannter → aus stimmen.json
  assert.equal(stimmeFor('haendler_gibtsnicht', { stil: 'knarzig', tonhoehe: 0.9 }).stil, 'knarzig');
  assert.equal(stimmeFor('mentor', { stil: 'piepsig' }).stil, 'knarzig', 'Datei gewinnt');
});

test('Helfer: rng deterministisch im Bereich, hash stabil, Möwenpause 8–22 s, midi', () => {
  const r1 = rng(42), r2 = rng(42);
  for (let i = 0; i < 100; i++) { const v = r1(); assert.equal(v, r2()); assert.ok(v >= 0 && v < 1); }
  assert.equal(hashStr('bangi'), hashStr('bangi'));
  assert.notEqual(hashStr('bangi'), hashStr('bangu'));
  assert.equal(nextGullDelay(() => 0), 8); assert.equal(nextGullDelay(() => 1), 22);
  close(midiToFreq(69), 440); close(midiToFreq(57), 220);
});

test('ohne WebAudio: alles no-op, nichts wirft, babble liefert trotzdem die Dauer', () => {
  for (const n of ['kasse', 'ablehnen', 'heat', 'verhaftet', 'ausverkauft', 'schritt_sand', 'ui_klick', 'hinschauen', 'pfeife', 'mango', 'funk', 'tuten', 'tuktuk_abwuergen']) assert.ok(SFX_NAMES.includes(n), n);
  assert.equal(SFX_NAMES.length, 13);
  for (const n of SFX_NAMES) assert.equal(sfx(n), 0);
  assert.equal(sfx('gibtsnicht'), 0);
  assert.equal(sfx('tuktuk_abwuergen', { gain: 0.5, pan: -0.3 }), 0, 'Optionen ohne Audio: no-op');
  // Optionen: Standard 1/Mitte, geclampt, Unsinn → Standard
  assert.deepEqual(normalizeSfxOpts(undefined), { gain: 1, pan: 0 });
  assert.deepEqual(normalizeSfxOpts({}), { gain: 1, pan: 0 });
  assert.deepEqual(normalizeSfxOpts({ gain: 0.4, pan: 0.6 }), { gain: 0.4, pan: 0.6 });
  assert.deepEqual(normalizeSfxOpts({ gain: 3, pan: -5 }), { gain: 1, pan: -1 });
  assert.deepEqual(normalizeSfxOpts({ gain: -1 }), { gain: 0, pan: 0 });
  assert.deepEqual(normalizeSfxOpts({ gain: 'x', pan: NaN }), { gain: 1, pan: 0 });
  assert.deepEqual(normalizeSfxOpts({ gain: 0 }), { gain: 0, pan: 0 }, '0 bleibt 0 (außer Hörweite), nicht Standard');
  assert.deepEqual(normalizeSfxOpts({ gain: '0.25' }), { gain: 0.25, pan: 0 });
  ambience.start(); ambience.stop(); music.start(); music.stop();
  assert.equal(ambience.isPlaying(), false); assert.equal(music.isPlaying(), false);
  assert.equal(ambience.ruf(), 0); assert.equal(ambience.funk(), 0);
  assert.deepEqual(ambience.setZone({ markt: 0.5 }), { strand: 0, markt: 0.5, posten: 0, pier: 0 });
  assert.deepEqual(ambience.getZone(), { strand: 0, markt: 0.5, posten: 0, pier: 0 });
  ambience.setZone(null);
  setMuted(true); assert.equal(isMuted(), true); setMuted(false); assert.equal(isMuted(), false);
  const d = babble('zivi_polo', 'Nice shoes. Where did you get them?');
  assert.ok(d > 1 && d < 5, `Dauer ${d}`);
  assert.equal(babble({ tonhoehe: 1 }, ''), 0);
  // Pan-Option: rückwärtskompatibel (ohne, leer, ungültig) und geclampt
  assert.equal(babble('zivi_polo', 'Nice shoes.', { pan: -0.7 }), d0('Nice shoes.'));
  assert.equal(babble('zivi_polo', 'Nice shoes.', {}), d0('Nice shoes.'));
  assert.equal(babble('zivi_polo', 'Nice shoes.', null), d0('Nice shoes.'));
  assert.ok(bark('zivi_1', 'gruss', { pan: 1 }).dauer > 0);
  assert.equal(normalizePan(undefined), 0); assert.equal(normalizePan('x'), 0); assert.equal(normalizePan(NaN), 0);
  assert.equal(normalizePan(-3), -1); assert.equal(normalizePan(2), 1); assert.equal(normalizePan(0.25), 0.25); assert.equal(normalizePan('-0.5'), -0.5);
});
const d0 = (t) => babble('zivi_polo', t);
