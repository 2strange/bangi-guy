import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { zeitT, normalizeSzenen, szeneHeute, szenenDesTages, szenenAktiv, szeneLaeuft, szeneSchritte, szeneAnsprechen, szenenWirkung, inStolperZone, DEFAULT_SZENEN } from '../js/szenen.js';
import { DAY_LENGTH } from '../js/game.js';

test('zeitT: "13:00"/"13:30" und Stunden → Uhr-t der 06–24-Uhr-Spieluhr; 0…1 direkt; Müll → null', () => {
  assert.ok(Math.abs(zeitT('13:00') - 7 / 18) < 1e-9); assert.ok(Math.abs(zeitT('13:30') - 7.5 / 18) < 1e-9); assert.equal(zeitT('06:00'), 0); assert.equal(zeitT(24), 1);
  assert.equal(zeitT(0.4), 0.4); assert.equal(zeitT('03:00'), 0, 'vor 06:00 geklemmt'); assert.equal(zeitT('nachts'), null); assert.equal(zeitT(undefined), null);
});

test('normalizeSzenen: Fenster, Ort (Spot oder {x,z,r}), Figuren, Schritte sortiert mit Dauer, Wirkung gefiltert, ab_tag ≥ 2; Datei lädt; Defaults', () => {
  const S = normalizeSzenen({ szenen: [
    { id: 'kinder', titel: 'Kinder', fenster: { von: '17:00', bis: '09:00' }, chance: 0.7, ab_tag: 1, ort: { x: 1, z: 2 }, tage: [2, 4, 'x'],
      figuren: [{ slug: 'kind_1', start: 'strand', stimme: 'kind' }, { nix: 1 }],
      schritte: [{ t: 8, wer: 'streife', aktion: 'pose', pose: 'stolpern', dauer: 5 }, { t: 0, wer: 'kind_1', aktion: 'sag', text: 'Rennen.', bark: 'WATER WAR!', dauer: 8 }, { t: 1, aktion: 'tanzen' }, 'kaputt'],
      ende: 'schritte', loop: false, ansprechen: ['Hast du Eis?', 'Mama hat recht.', 3], folge: { abends_haengematte_belegt: true, nix: false },
      wirkung: { streife_stolpert: true, verstecke: [{ spot: 'strand', r: 4 }, { x: 3, z: 4 }, 'nix'], quatsch: 1 }, requisite: ['eimer'], sound: ['kreischen'], kommentar: { wer: 'mentor', text: 'Kinder.' } },
    { id: '', titel: 'kaputt' },
  ] });
  assert.equal(S.length, 1);
  const k = S[0];
  assert.ok(k.fenster.von < k.fenster.bis); assert.equal(k.chance, 0.7); assert.equal(k.ab_tag, 2, 'nie Tag 1'); assert.deepEqual(k.ort, { x: 1, z: 2, r: 5 }); assert.deepEqual(k.tage, [2, 4]);
  assert.deepEqual(k.figuren.map((f) => [f.slug, f.start, f.stimme]), [['kind_1', 'strand', 'kind']]);
  assert.deepEqual(k.schritte.map((a) => [a.t, a.dauer, a.wer, a.aktion]), [[0, 8, 'kind_1', 'sag'], [8, 5, 'streife', 'pose']]); assert.equal(k.dauer, 13); assert.equal(k.ende, 'schritte'); assert.equal(k.loop, false);
  assert.deepEqual(k.wirkung, { streife_stolpert: true, verstecke: [{ spot: 'strand', r: 4 }, { x: 3, z: 4, r: 3 }] }); assert.deepEqual(k.ansprechen, ['Hast du Eis?', 'Mama hat recht.']);
  assert.equal(szeneAnsprechen(k, 3), 'Mama hat recht.'); assert.deepEqual(k.kommentar, { wer: 'mentor', text: 'Kinder.' }); assert.deepEqual(k.folge, { abends_haengematte_belegt: true });
  assert.equal(normalizeSzenen({ szenen: [{ id: 'x', folge: 'einmal' }] })[0].folge.einmal, true); assert.equal(normalizeSzenen({ szenen: [{ id: 'x', folge: {} }] })[0].folge, null);
  const D = normalizeSzenen(null); assert.equal(D[0].id, 'pong_mittag'); assert.deepEqual(D[0].wirkung, { streife_p1: 'schlaeft' }); assert.ok(Math.abs(D[0].fenster.von - 7 / 18) < 1e-9); assert.equal(D[0].loop, true);
  assert.deepEqual(normalizeSzenen({ szenen: [{ id: '' }] }).map((s) => s.id), DEFAULT_SZENEN.map((s) => s.id));
  const echt = normalizeSzenen(JSON.parse(readFileSync(new URL('../data/szenen.json', import.meta.url), 'utf8')));
  assert.ok(echt.length >= 6); const pong = echt.find((s) => s.id === 'pong_mittag');
  assert.ok(pong && pong.wirkung.streife_p1 === 'schlaeft' && pong.loop && pong.schritte.length >= 6 && pong.ansprechen.length >= 1 && pong.ort === 'posten');
  assert.deepEqual(echt.find((s) => s.id === 'betrunkener')?.folge, { abends_haengematte_belegt: true }); assert.equal(echt.find((s) => s.id === 'ehepaar')?.kommentar?.wer, 'barkeeper');
  assert.ok(echt.every((s) => s.ab_tag >= 2 && s.fenster.von < s.fenster.bis && s.schritte.length && s.dauer > 0));
});

test('Tagesplan: ab_tag/tage/Chance deterministisch; aktiv nur im Fenster (ende schritte endet früher); Schritte einmal bzw. im Loop; Wirkung gesammelt', () => {
  const mk = (id, extra = {}) => ({ id, ort: 'strand', fenster: { von: '09:00', bis: '17:00' }, ab_tag: 2, chance: 1, loop: true, schritte: [{ t: 0, wer: 'x', aktion: 'sag', text: 't', dauer: 10 }, { t: 10, wer: 'y', aktion: 'bark', bark: 'u', dauer: 5 }], ...extra });
  const S = normalizeSzenen({ szenen: [mk('a'), mk('b', { tage: [3, 5] }), mk('c', { chance: 0.5 }), mk('d', { chance: 0 }), mk('e', { ende: 'schritte', loop: false }), mk('pong_mittag', { ort: 'posten', fenster: { von: '13:00', bis: '14:00' }, wirkung: { streife_p1: 'schlaeft' } })] });
  const by = Object.fromEntries(S.map((s) => [s.id, s]));
  assert.equal(szeneHeute(by.a, { tag: 1 }), false); assert.equal(szeneHeute(by.a, { tag: 2 }), true);
  assert.equal(szeneHeute(by.b, { tag: 3 }), true); assert.equal(szeneHeute(by.b, { tag: 4 }), false); assert.equal(szeneHeute(by.d, { tag: 5 }), false);
  let ja = 0; for (let seed = 1; seed <= 100; seed++) { const h = szeneHeute(by.c, { seed, tag: 2 }); assert.equal(h, szeneHeute(by.c, { seed, tag: 2 }), 'deterministisch'); if (h) ja++; }
  assert.ok(ja > 25 && ja < 75, `Chance 0.5 ≈ halb (${ja}/100)`);
  assert.deepEqual(szenenDesTages(S, { seed: 1, tag: 1 }), [], 'Tag 1 nie'); assert.ok(szenenDesTages(S, { seed: 1, tag: 2 }).map((s) => s.id).includes('a'));
  // aktiv im Fenster, seitSek, ende 'schritte'
  const heute = [by.a, by.e, by.pong_mittag];
  assert.deepEqual(szenenAktiv(heute, zeitT('08:00')).map((x) => x.szene.id), []);
  assert.deepEqual(szenenAktiv(heute, zeitT('09:00')).map((x) => x.szene.id), ['a', 'e']);
  assert.deepEqual(szenenAktiv(heute, zeitT('13:30')).map((x) => x.szene.id), ['a', 'pong_mittag'], 'e (15 s Schritte, kein Loop) ist vorbei');
  assert.ok(Math.abs(szenenAktiv(heute, zeitT('13:30'))[1].seitSek - DAY_LENGTH * 0.5 / 18) < 1e-6); assert.deepEqual(szenenAktiv(heute, zeitT('14:00')).map((x) => x.szene.id), ['a'], 'bis exklusiv');
  assert.equal(szeneLaeuft(by.e, 14), true); assert.equal(szeneLaeuft(by.e, 16), false); assert.equal(szeneLaeuft(by.a, 999), true);
  // Schritte: Loop alle 15 s (0, 10, 15, 25, 30 …), ohne Loop nur einmal
  assert.deepEqual(szeneSchritte(by.a, -1, 0).map((s) => [s.t, s.runde]), [[0, 0]]); assert.equal(szeneSchritte(by.a, 0, 9.9).length, 0);
  assert.deepEqual(szeneSchritte(by.a, 9.9, 30.1).map((s) => [s.wer, s.runde]), [['y', 0], ['x', 1], ['y', 1], ['x', 2]]); assert.deepEqual(szeneSchritte(by.a, 5, 5), []);
  assert.deepEqual(szeneSchritte(by.e, -1, 100).map((s) => s.wer), ['x', 'y']);
  // Wirkung: Spots aufgelöst, Stolper-Zone am Ort, Verstecke, Faktoren multipliziert
  const orte = (o) => (typeof o === 'object' ? o : { strand: { x: 6, z: 5 }, posten: { x: 8, z: -82 } }[o] || null);
  const K = normalizeSzenen({ szenen: [mk('k', { wirkung: { streife_stolpert: true, verstecke: [{ spot: 'strand', r: 4 }, { x: 1, z: 1, r: 2 }], liegen_belegt: true, kunden_faktor: 0.5, preis_faktor: 1.2 } }), mk('m', { ort: { x: 0, z: 0, r: 9 }, wirkung: { preis_faktor: 1.5 } })] });
  const w = szenenWirkung(szenenAktiv([by.pong_mittag, ...K], zeitT('13:30')), orte);
  assert.equal(w.streife_p1, 'schlaeft'); assert.equal(w.liegen_belegt, true); assert.deepEqual(w.verstecke, [{ x: 6, z: 5, r: 4 }, { x: 1, z: 1, r: 2 }]); assert.deepEqual(w.ids, ['pong_mittag', 'k', 'm']);
  assert.deepEqual(w.stolpern, [{ x: 6, z: 5, r: 5 }]); assert.equal(inStolperZone(w, { x: 8, z: 7 }), true); assert.equal(inStolperZone(w, { x: 30, z: 5 }), false);
  assert.equal(w.kunden_faktor, 0.5); assert.ok(Math.abs(w.preis_faktor - 1.8) < 1e-9);
  const leer = szenenWirkung([]); assert.equal(leer.streife_p1, null); assert.equal(leer.preis_faktor, 1);
});
