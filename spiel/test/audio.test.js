// Tests der reinen Audio-Helfer (ohne WebAudio): Silben, Gebrabbel-Plan, Stimmprofile, Musik-Pattern
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import {
  syllables, babblePlan, normalizeStimme, normalizeStimmen, STIL, DEFAULT_STIMME, slugFor, pickBark, bark,
  musicPattern, PROGRESSION, BARS, STEPS_PER_BAR, BPM, stepSeconds, nextGullDelay, rng, hashStr, midiToFreq, SFX_NAMES,
  babble, sfx, setMuted, isMuted, ambience, music, stimmeFor, setStimmen, normalizePan, VOL,
  ZONES, normalizeZones, pseudoWords, nextRufDelay, nextFunkDelay, sputterTimes, normalizeSfxOpts,
  MOODS, normalizeMood, nextBpm, setMood, getMood, cricketBurst, nextClinkDelay, frogCall, nextFrogDelay, JINGLES,
  WETTER, normalizeWetter, nextDropDelay, duoPlan, DUO_TONHOEHE, DUO_VERSATZ, EREIGNIS_SOUNDS, ereignisAktionen, ereignis,
  normalizeManifest, pickAusruf, clipRate, ausrufeFor, setAusrufe, getAusrufe, ausruf, clipStatus, preloadAusrufe, mergeAusrufe,
  GESAENGE, gesangPlan, gesang,
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
  // lallend: gedehnter, rutscht stärker ab und wackelt mehr als schluffig
  assert.ok(STIL.lallend && STIL.lallend.len > STIL.schluffig.len && STIL.lallend.glide < STIL.schluffig.glide && STIL.lallend.vib > STIL.schluffig.vib);
  const lall = babblePlan({ stil: 'lallend' }, 'Hey man, whassup.'), nuech = babblePlan({ stil: 'schluffig' }, 'Hey man, whassup.');
  assert.ok(lall.duration > nuech.duration * 1.3, 'lallend dauert länger');
  for (const n of lall.notes) assert.ok(n.freqEnd < n.freq, 'jede Silbe rutscht ab');
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
  setStimmen(db);
  for (const [slug, sits] of Object.entries(db.barks)) for (const [sit, list] of Object.entries(sits)) for (const t of list) {
    const p = babblePlan(db.stimmen[slug], t);
    if (!/[a-zäöü]/i.test(t)) { assert.equal(p.duration, 0, `${slug}/${sit} „${t}“ ist stumm (nur Satzzeichen)`); continue; } // „…“ = sagt nichts, zulässig
    assert.ok(p.duration > 0.1 && p.duration < 4, `${slug}/${sit} „${t}“: ${p.duration}`);
  }
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

test('Zonen: normalizeZones clampt, ignoriert Unbekanntes, null = Strand; Pseudo-Wörter brabbelbar', async () => {
  assert.deepEqual(ZONES, ['strand', 'markt', 'posten', 'pier', 'bar', 'reisfeld']);
  const Z = (o) => ({ strand: 0, markt: 0, posten: 0, pier: 0, bar: 0, reisfeld: 0, ...o });
  assert.deepEqual(normalizeZones(null), Z({ strand: 1 }));
  assert.deepEqual(normalizeZones({}), Z({}));
  assert.deepEqual(normalizeZones({ strand: 1, markt: 0.3 }), Z({ strand: 1, markt: 0.3 }));
  assert.deepEqual(normalizeZones({ strand: 7, markt: -1, posten: 'x', disco: 1 }), Z({ strand: 1 }));
  assert.deepEqual(normalizeZones({ posten: '0.4', pier: 0.9, bar: 1, reisfeld: 0.5 }), Z({ posten: 0.4, pier: 0.9, bar: 1, reisfeld: 0.5 }));
  // Frösche: 1–3 Quaker, tief, Trill 18–32 Hz, Pausen 0.8–3 s
  for (let i = 0; i < 20; i++) { const c = frogCall(rng(i)); assert.ok(c.n >= 1 && c.n <= 3 && c.freq >= 110 && c.freq <= 220 && c.gap >= 0.22 && c.trill >= 18 && c.trill <= 32, JSON.stringify(c)); }
  assert.equal(nextFrogDelay(() => 0), 0.8); assert.equal(nextFrogDelay(() => 1), 3);
  // Jingles: Umfang sinnvoll, ziel/morgen steigen, fail fällt chromatisch
  for (const m of [...JINGLES.ziel, ...JINGLES.morgen, ...JINGLES.woche_fail, ...JINGLES.woche_gut.flat()]) assert.ok(m >= 55 && m <= 96, `MIDI ${m}`);
  for (let i = 1; i < JINGLES.ziel.length; i++) assert.ok(JINGLES.ziel[i] > JINGLES.ziel[i - 1]);
  for (let i = 1; i < JINGLES.woche_fail.length; i++) assert.ok(JINGLES.woche_fail[i] < JINGLES.woche_fail[i - 1]);
  assert.equal(JINGLES.woche_gut.length, 4); for (const c of JINGLES.woche_gut) assert.equal(c.length, 3);
  // mittel: kürzer als gut, endet nicht auf der Tonika (G), bleibt offen
  assert.equal(JINGLES.woche_mittel.length, 2); for (const c of JINGLES.woche_mittel) { assert.equal(c.length, 3); for (const m of c) assert.ok(m >= 55 && m <= 96); }
  assert.notEqual(JINGLES.woche_mittel[1][0] % 12, 67 % 12, 'kein G-Grundton am Ende');
  assert.deepEqual(JINGLES.woche_gut[3], [79, 83, 86], 'gut endet auf G');
  // Grillen-Schwall und Klirren-Abstand im Bereich
  const cb = cricketBurst(rng(1));
  assert.ok(cb.pulses >= 6 && cb.pulses <= 17 && cb.gap > 1 / 40 && cb.gap < 1 / 26 && cb.pause >= 0.25 && cb.freq >= 3900);
  assert.equal(nextClinkDelay(() => 0), 2); assert.equal(nextClinkDelay(() => 1), 7);
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
  setStimmen(JSON.parse(await readFile(new URL('../data/stimmen.json', import.meta.url), 'utf8')));
  assert.equal(stimmeFor('mentor', { stil: 'piepsig' }).stil, 'knarzig', 'Datei gewinnt');
});

test('Stimmung: abend ohne Kick, weniger Shaker, mehr Lick, langsamer; tag unverändert; Tempo gleitet', () => {
  assert.equal(normalizeMood('abend'), 'abend'); assert.equal(normalizeMood('x'), 'tag'); assert.equal(normalizeMood(undefined), 'tag');
  assert.ok(MOODS.abend.bpm < MOODS.tag.bpm && MOODS.abend.reverb > MOODS.tag.reverb && MOODS.abend.drums < MOODS.tag.drums);
  for (let b = 0; b < BARS; b++) {
    const tag = musicPattern(b, 'tag'), ab = musicPattern(b, 'abend');
    assert.deepEqual(tag, musicPattern(b), 'tag = Standard');
    assert.ok(!ab.events.some((e) => e.type === 'kick'), 'abends kein Kick');
    const sh = (p) => p.events.filter((e) => e.type === 'shaker');
    assert.ok(sh(ab).length < sh(tag).length && sh(ab).every((e) => e.step % 4 === 2), 'abends nur Offbeat-Shaker');
    assert.ok(ab.events.some((e) => e.type === 'skank') && ab.events.some((e) => e.type === 'bass') && ab.events.some((e) => e.type === 'rim'), 'Skank, Bass, Rimshot bleiben');
    for (const e of ab.events) assert.ok(e.step >= 0 && e.step < STEPS_PER_BAR);
    for (const e of ab.events.filter((x) => x.type === 'lead')) assert.ok(e.note >= 48 && e.note <= 90, `Lead-Ton ${e.note}`);
  }
  const leads = (m) => { let n = 0; for (let b = 0; b < BARS; b++) n += musicPattern(b, m).events.filter((e) => e.type === 'lead').length; return n; };
  assert.ok(leads('abend') > leads('tag'), 'abends mehr Melodie');
  assert.deepEqual(musicPattern(3, 'abend'), musicPattern(3 + BARS, 'abend'), 'Loop wickelt');
  // Tempo-Gleiten: monoton, kommt an, springt nie
  let bpm = MOODS.tag.bpm; let steps = 0;
  while (bpm !== MOODS.abend.bpm && steps < 500) { const n = nextBpm(bpm, MOODS.abend.bpm); assert.ok(n < bpm && bpm - n < 1, 'kleine Schritte abwärts'); bpm = n; steps++; }
  assert.equal(bpm, MOODS.abend.bpm); assert.ok(steps > 16 && steps < 200, `in ${steps} 16teln (1–12 Takte)`);
  assert.equal(nextBpm(70, 70), 70);
  close(stepSeconds(), 60 / BPM / 4); close(stepSeconds(60), 0.25);
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
  for (const n of ['kasse', 'ablehnen', 'heat', 'verhaftet', 'ausverkauft', 'schritt_sand', 'ui_klick', 'hinschauen', 'pfeife', 'mango', 'funk', 'tuten', 'tuktuk_abwuergen', 'gaehnen',
    'ui_oeffnen', 'ui_schliessen', 'ui_umschalten', 'ui_schritt', 'ziel', 'morgen', 'woche_gut', 'woche_fail', 'woche_mittel',
    'schiffshorn_fern', 'moewe_klaut', 'party', 'stromausfall',
    'kinder_fern', 'wasserpistole', 'streit', 'selfie', 'schnarchen', 'handtuch', 'dose_oeffnen', 'feuerwerk']) assert.ok(SFX_NAMES.includes(n), n);
  assert.equal(SFX_NAMES.length, 35);
  // Stimmen dürfen nicht wieder leise werden (Hörtest): Voice-Bus hoch, Clips extra, Kokos extra
  assert.ok(VOL.voice >= 0.85 && VOL.clip >= 1.5 && VOL.kokos >= 1.3, JSON.stringify({ voice: VOL.voice, clip: VOL.clip, kokos: VOL.kokos }));
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
  assert.deepEqual(ambience.setZone({ markt: 0.5 }), { strand: 0, markt: 0.5, posten: 0, pier: 0, bar: 0, reisfeld: 0 });
  assert.deepEqual(ambience.getZone(), { strand: 0, markt: 0.5, posten: 0, pier: 0, bar: 0, reisfeld: 0 });
  // Stimmung ohne Audio: wird gemerkt, Unsinn → tag
  assert.equal(setMood('abend'), 'abend'); assert.equal(getMood(), 'abend'); assert.equal(music.getMood(), 'abend'); assert.equal(ambience.getMood(), 'abend');
  assert.equal(music.getBpm(), MOODS.abend.bpm);
  assert.equal(setMood('nacht'), 'tag'); assert.equal(getMood(), 'tag');
  // Wetter ohne Audio: gemerkt, Unsinn → klar
  assert.deepEqual(WETTER, ['klar', 'regen']);
  assert.equal(normalizeWetter('regen'), 'regen'); assert.equal(normalizeWetter('schnee'), 'klar'); assert.equal(normalizeWetter(undefined), 'klar');
  assert.equal(ambience.setWetter('regen'), 'regen'); assert.equal(ambience.getWetter(), 'regen');
  assert.equal(ambience.setWetter('hagel'), 'klar'); assert.equal(ambience.getWetter(), 'klar');
  assert.equal(nextDropDelay(() => 0), 0.02); close(nextDropDelay(() => 1), 0.12);
  // Ereignis-Slugs aus texte.json: jeder bekannte Slug gemappt, Aktionen zeigen auf existierende SFX/Wetter, Ende hebt Zustand auf
  assert.deepEqual(ereignisAktionen('moewen'), [['sfx', 'moewe_klaut']]);
  assert.deepEqual(ereignisAktionen('regen'), [['wetter', 'regen']]); assert.deepEqual(ereignisAktionen('regen', 'ende'), [['wetter', 'klar']]);
  assert.deepEqual(ereignisAktionen('klick'), [['sfx', 'stromausfall'], ['musik_aus']]); assert.deepEqual(ereignisAktionen('klick', 'ende'), [['musik_an']]);
  assert.deepEqual(ereignisAktionen('stille'), []); assert.deepEqual(ereignisAktionen('stille', 'ende'), []);
  assert.equal(ereignisAktionen('erdbeben'), null);
  for (const slug of Object.keys(EREIGNIS_SOUNDS)) for (const ph of ['start', 'ende']) for (const [art, arg, arg2] of ereignisAktionen(slug, ph)) {
    if (art === 'sfx') assert.ok(SFX_NAMES.includes(arg), `${slug}: SFX ${arg}`);
    if (art === 'wetter') assert.ok(WETTER.includes(arg), `${slug}: Wetter ${arg}`);
    if (art === 'bark') assert.ok(typeof arg === 'string' && typeof arg2 === 'string', `${slug}: bark braucht Slug + Situation`);
  }
  assert.deepEqual(ereignisAktionen('lallen'), [['bark', 'betrunkener', 'lallen']]);
  assert.deepEqual(ereignisAktionen('schnarchen_pong'), [['sfx', 'schnarchen']]);
  assert.equal(ereignis('regen'), 0); assert.equal(ambience.getWetter(), 'regen'); ereignis('regen', 'ende'); assert.equal(ambience.getWetter(), 'klar');
  assert.equal(ereignis('stille'), 0); assert.equal(ereignis('erdbeben'), 0); assert.equal(ereignis('horn', 'start', { gain: 0.5 }), 0);
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
  // Duo: zweite Stimme höher, versetzt, gleiche Silbenzahl; Dauer wächst um den Versatz; Feld oder Option, ungültig → aus
  const solo = babblePlan({ tonhoehe: 1 }, 'We are two!'), duo = duoPlan({ tonhoehe: 1 }, 'We are two!');
  assert.equal(duo.notes.length, solo.notes.length);
  for (let i = 0; i < solo.notes.length; i++) { close(duo.notes[i].freq / solo.notes[i].freq, DUO_TONHOEHE, 1e-9); close(duo.notes[i].t - solo.notes[i].t, DUO_VERSATZ, 1e-9); }
  close(duo.duration - solo.duration, DUO_VERSATZ, 1e-9);
  close(babble({ tonhoehe: 1, duo: true }, 'We are two!'), duo.duration, 1e-9);
  close(babble({ tonhoehe: 1 }, 'We are two!', { duo: true }), duo.duration, 1e-9);
  close(babble({ tonhoehe: 1 }, 'We are two!'), solo.duration, 1e-9);
  assert.equal(normalizeStimme({ duo: true }).duo, true); assert.equal(normalizeStimme({ duo: 'ja' }).duo, false); assert.equal(normalizeStimme({}).duo, false);
  assert.equal(babble({ duo: true }, ''), 0);
  assert.equal(normalizePan(undefined), 0); assert.equal(normalizePan('x'), 0); assert.equal(normalizePan(NaN), 0);
  assert.equal(normalizePan(-3), -1); assert.equal(normalizePan(2), 1); assert.equal(normalizePan(0.25), 0.25); assert.equal(normalizePan('-0.5'), -0.5);
});
const d0 = (t) => babble('zivi_polo', t);

test('texte.json + szenen.json (Content): jeder Sound-Slug ist in audio.js gemappt; bark-Slugs haben Stimme + Situation', async () => {
  const t = JSON.parse(await readFile(new URL('../data/texte.json', import.meta.url), 'utf8'));
  const e = t.ereignisse; const liste = Array.isArray(e) ? e : (e && e.liste) || [];
  assert.ok(liste.length >= 1, 'Ereignisse vorhanden');
  for (const x of liste) if (x.sound) assert.ok(ereignisAktionen(x.sound) !== null, `Ereignis ${x.id}: Sound-Slug „${x.sound}“ unbekannt`);
  let szenen = [];
  try { const z = JSON.parse(await readFile(new URL('../data/szenen.json', import.meta.url), 'utf8')); szenen = Array.isArray(z) ? z : (z.szenen && (Array.isArray(z.szenen) ? z.szenen : z.szenen.liste)) || []; } catch (err) { /* keine Szenen-Datei → nichts zu prüfen */ }
  const db = normalizeStimmen(JSON.parse(await readFile(new URL('../data/stimmen.json', import.meta.url), 'utf8')));
  for (const sz of szenen) for (const slug of (Array.isArray(sz.sound) ? sz.sound : sz.sound ? [sz.sound] : [])) {
    const acts = ereignisAktionen(slug);
    assert.ok(acts !== null, `Szene ${sz.id}: Sound-Slug „${slug}“ unbekannt`);
    for (const [art, a1, a2] of acts) if (art === 'bark') assert.ok(db.stimmen[a1] && (db.barks[a1] || {})[a2], `Szene ${sz.id}: bark ${a1}/${a2} fehlt in stimmen.json`);
  }
});

test('Ausrufe (rein): Manifest normalisieren, Clip-Wahl (eigene immer, allgemeine zu 50 %, nie doppelt), Rate begrenzt', () => {
  const m = normalizeManifest({ ausrufe: [
    { id: 'dude', text: 'Dude!', datei: 'dude.wav', stimme: null, situation: ['gruss', 'kauf'] },
    { id: 'far_out', text: 'Far out.', dateien: ['far_out.ogg', 'far_out.mp3'], stimme: 'stammkunde', situation: 'kauf', tonhoehe_aufnahme: 0.8 },
    { id: 'far_out', text: 'doppelt' }, { id: 'Böse Id' }, { id: 'ohne_text' }, null,
  ] });
  assert.deepEqual(m.map((e) => e.id), ['dude', 'far_out', 'ohne_text']);
  assert.deepEqual(m[1].dateien, ['far_out.ogg', 'far_out.mp3']); assert.deepEqual(m[1].situation, ['kauf']); assert.equal(m[1].tonhoehe_aufnahme, 0.8);
  assert.equal(m[2].text, 'ohne_text', 'Fallback-Text = id'); assert.equal(m[2].stimme, null); assert.deepEqual(m[2].dateien, []);
  assert.deepEqual(normalizeManifest(null), []);
  // eigene Stimme: immer der eigene Clip, auch wenn der Zufall gegen allgemeine entscheidet
  assert.equal(pickAusruf(m, 'stammkunde', 'kauf', null, () => 0.99).id, 'far_out');
  // nur allgemein: zu 50 %
  assert.equal(pickAusruf(m, 'surfer', 'gruss', null, () => 0.1).id, 'dude');
  assert.equal(pickAusruf(m, 'surfer', 'gruss', null, () => 0.9), null);
  assert.equal(pickAusruf(m, 'surfer', 'ablehnung', null, () => 0), null, 'keine Situation → kein Clip');
  // nie derselbe zweimal, wenn Auswahl da ist
  const two = normalizeManifest([{ id: 'a', stimme: 'x', situation: 'g' }, { id: 'b', stimme: 'x', situation: 'g' }]);
  for (let i = 0; i < 10; i++) assert.equal(pickAusruf(two, 'x', 'g', 'a', rng(i)).id, 'b');
  assert.equal(pickAusruf(two.slice(0, 1), 'x', 'g', 'a', () => 0).id, 'a', 'einziger Clip darf wiederholt werden');
  assert.deepEqual(ausrufeFor(m, 'stammkunde').map((e) => e.id), ['dude', 'far_out', 'ohne_text']);
  assert.deepEqual(ausrufeFor(m, 'surfer').map((e) => e.id), ['dude', 'ohne_text']);
  close(clipRate({ tonhoehe: 1.2 }, 0.8), 1.5); assert.equal(clipRate({ tonhoehe: 2.5 }, 0.5), 1.8); assert.equal(clipRate({ tonhoehe: 0.4 }, 1), 0.6); assert.equal(clipRate(null), 1);
});

test('Ausrufe ohne WebAudio: Fallback Gebrabbel, bark nutzt Clip-Text, Status-API', async () => {
  setStimmen(JSON.parse(await readFile(new URL('../data/stimmen.json', import.meta.url), 'utf8')));
  setAusrufe({ ausrufe: [{ id: 'far_out', text: 'Far out.', stimme: 'stammkunde', situation: 'kauf' }] }, { clips: [{ id: 'far_out', datei: 'x.wav' }] });
  assert.equal(getAusrufe().length, 1);
  const r = ausruf('far_out', 'stammkunde');
  assert.ok(r && r.echt === false && r.dauer > 0.1, 'ohne Audio: Gebrabbel-Fallback mit Dauer');
  assert.equal(ausruf('gibtsnicht'), null);
  assert.equal(clipStatus('far_out'), 'unbekannt'); assert.equal(preloadAusrufe('alle'), 0, 'ohne Context nichts zu laden');
  const b = bark('stammkunde_1', 'kauf');
  assert.ok(b && b.clip === 'far_out' && b.text === 'Far out.' && b.echt === false && b.dauer > 0);
  const b2 = bark('stammkunde_1', 'kauf', { nurBrabbeln: true });
  assert.ok(b2 && !b2.clip, 'nurBrabbeln umgeht den Clip');
  setAusrufe(null); assert.equal(getAusrufe().length, 0);
  assert.ok(bark('stammkunde_1', 'kauf') && !bark('stammkunde_1', 'kauf').clip);
});

test('Ausrufe (rein): Liste + Manifest zusammenführen — Liste bestimmt Text/Stimme/Situation, Manifest die Dateien', () => {
  const data = { ausrufe: [{ id: 'a', text: 'A!', stimme: null, situation: 'gruss' }, { id: 'b', text: 'B.', stimme: 'mentor', situation: ['lektion', 'abend'] }] };
  const man = { clips: [{ id: 'a', dateien: ['a.ogg', 'a.mp3'], tonhoehe_aufnahme: 0.7 }, { id: 'b', datei: 'b.wav', platzhalter: true }, { id: 'fremd', datei: 'x.wav' }] };
  const m = mergeAusrufe(data, man);
  assert.deepEqual(m.map((e) => e.id), ['a', 'b'], 'Clip ohne Listeneintrag wird ignoriert');
  assert.deepEqual(m[0].dateien, ['a.ogg', 'a.mp3']); assert.equal(m[0].tonhoehe_aufnahme, 0.7); assert.equal(m[0].platzhalter, false);
  assert.deepEqual(m[1].dateien, ['b.wav']); assert.equal(m[1].platzhalter, true); assert.deepEqual(m[1].situation, ['lektion', 'abend']);
  const ohne = mergeAusrufe(data, null);
  assert.deepEqual(ohne.map((e) => e.dateien), [[], []], 'ohne Manifest keine Dateien → immer Gebrabbel');
  assert.deepEqual(mergeAusrufe(null, man), []);
});

test('data/ausrufe.json + audio/ausrufe/manifest.json: konsistent — Stimmen bekannt, Text+Situation da, Manifest-ids in der Liste, Dateien vorhanden', async () => {
  const dir = new URL('../audio/ausrufe/', import.meta.url);
  const data = JSON.parse(await readFile(new URL('../data/ausrufe.json', import.meta.url), 'utf8'));
  const man = JSON.parse(await readFile(new URL('manifest.json', dir), 'utf8'));
  const db = normalizeStimmen(JSON.parse(await readFile(new URL('../data/stimmen.json', import.meta.url), 'utf8')));
  const m = mergeAusrufe(data, man);
  assert.equal(m.length, data.ausrufe.length, 'kein Listeneintrag verworfen (id-Format/Doppel)');
  const ids = new Set(m.map((e) => e.id));
  for (const c of man.clips) assert.ok(ids.has(c.id), `Manifest-Clip ${c.id} ohne Eintrag in data/ausrufe.json`);
  let mitClip = 0;
  for (const e of m) {
    assert.ok(e.text && e.text !== e.id, `${e.id}: Text als Fallback`);
    assert.ok(e.situation.length >= 1, `${e.id}: Situation`);
    if (e.stimme) assert.ok(db.stimmen[e.stimme], `${e.id}: Stimme ${e.stimme} unbekannt`);
    for (const f of e.dateien) { assert.match(f, /^[a-z0-9_]+\.(wav|mp3|ogg)$/, `${e.id}: Dateiname ${f}`); await readFile(new URL(f, dir)); }
    if (e.dateien.length) mitClip++;
    // Fallback-Garantie: jeder Ausruf ist brabbelbar
    assert.ok(babblePlan(e.stimme ? db.stimmen[e.stimme] : db.stimmen.default, e.text).duration > 0.05, `${e.id} brabbelbar`);
  }
  assert.ok(mitClip >= 1, 'mindestens ein Clip (Platzhalter) zum Testen');
});

test('Gesang: feste Melodie je Silbe, tonhoehe/tempo aus dem Profil, Kokos-Ruf endet hoch und rutscht leicht ab', () => {
  const k = GESAENGE.kokos_ruf;
  assert.equal(k.silben.length, 4); assert.equal(k.silben.map((s) => s.text).join('-'), 'co-co-nut-juice');
  const p = gesangPlan({ tonhoehe: 1, tempo: 1 }, k.silben);
  assert.equal(p.notes.length, 4);
  close(p.notes[0].freq, 220); close(p.notes[1].freq, 220); assert.ok(p.notes[2].freq > p.notes[1].freq);
  close(p.notes[3].freq / p.notes[0].freq, Math.pow(2, 7 / 12), 1e-9, 'juice eine Quinte höher');
  assert.ok(p.notes[3].freqEnd < p.notes[3].freq, 'am Ende abfallend'); assert.ok(p.notes[3].dur > p.notes[2].dur, 'juice lang');
  assert.ok(p.duration > 1.8 && p.duration < 2.6, `Dauer ${p.duration}`);
  for (let i = 1; i < p.notes.length; i++) assert.ok(p.notes[i].t >= p.notes[i - 1].t + p.notes[i - 1].dur - 1e-9, 'keine Überlappung');
  const hoch = gesangPlan({ tonhoehe: 1.5, tempo: 2 }, k.silben);
  close(hoch.notes[0].freq, 330); assert.ok(hoch.duration < p.duration / 1.9, 'tempo verkürzt');
  assert.equal(gesangPlan(null, []).duration, 0);
  // ohne WebAudio: Dauer kommt trotzdem, unbekannte id → null; Profil-Fallback default, wenn der Slug fehlt
  const r = gesang('kokos_ruf', { pan: -0.5 }); assert.ok(r && r.echt === false && r.dauer > 1.8);
  assert.equal(gesang('wassermelone'), null);
  // sfx('kokos_ruf') leitet an gesang weiter (gleiche Dauer), unbekannte Namen bleiben 0
  close(sfx('kokos_ruf', { pan: 0.2, gain: 0.5 }), r.dauer, 1e-9); assert.equal(sfx('wassermelone'), 0);
});
