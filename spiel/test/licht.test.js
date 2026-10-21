// Tests des Tagesablaufs (Palette, Sonnenstand): node --test spiel/test/
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { KEYS, SONNE, tageszeitPalette, lerpColor, nachtAnteil, sonnenstand, sunOffset, sonnenPosition, sonnenStimmung } from '../js/licht-palette.js';

const ch = (c) => [(c >> 16) & 255, (c >> 8) & 255, c & 255];
const lum = (c) => { const [r, g, b] = ch(c); return 0.299 * r + 0.587 * g + 0.114 * b; };

test('Stützstellen: aufsteigend, 0 und 1 identisch (Nacht), Farben gültig', () => {
  for (let i = 1; i < KEYS.length; i++) assert.ok(KEYS[i].t > KEYS[i - 1].t);
  assert.equal(KEYS[0].t, 0); assert.equal(KEYS[KEYS.length - 1].t, 1);
  for (const k of ['sky', 'fog', 'sun', 'hemiSky', 'hemiGround']) assert.equal(KEYS[0][k], KEYS[KEYS.length - 1][k]);
  for (const k of KEYS) for (const c of ['sky', 'fog', 'sun', 'hemiSky', 'hemiGround']) assert.ok(k[c] >= 0 && k[c] <= 0xffffff);
});

test('lerpColor: Endpunkte exakt, Mitte dazwischen', () => {
  assert.equal(lerpColor(0x000000, 0xffffff, 0), 0x000000);
  assert.equal(lerpColor(0x000000, 0xffffff, 1), 0xffffff);
  assert.equal(lerpColor(0x000000, 0xffffff, 0.5), 0x808080);
  assert.equal(lerpColor(0xff0000, 0x0000ff, 0.5), 0x800080);
});

test('Palette: stetig über den Tag (kein Sprung > 40 pro Kanal bei dt = 0.005), Mittag am hellsten, Nacht spielbar hell', () => {
  let prev = tageszeitPalette(0);
  for (let t = 0.005; t <= 1.0001; t += 0.005) {
    const p = tageszeitPalette(t);
    for (const k of ['sky', 'fog', 'sun']) {
      const a = ch(prev[k]), b = ch(p[k]);
      for (let i = 0; i < 3; i++) assert.ok(Math.abs(a[i] - b[i]) <= 40, `Sprung in ${k} bei t=${t.toFixed(3)}`);
    }
    assert.ok(Math.abs(p.sunI - prev.sunI) < 0.1);
    prev = p;
  }
  const mittag = tageszeitPalette(0.5), nacht = tageszeitPalette(0.02), morgen = tageszeitPalette(0.25), abend = tageszeitPalette(0.74);
  assert.ok(mittag.sunI >= 1.8 && mittag.lights === 0);
  assert.ok(nacht.sunI >= 0.4 && nacht.hemiI >= 0.6, 'Nacht zu dunkel zum Spielen');
  assert.ok(lum(nacht.sky) < lum(mittag.sky) && lum(nacht.sky) > 25, 'Nachthimmel nicht blau-dunkel aber lesbar');
  const [mr, mg, mb] = ch(morgen.sky); assert.ok(mr > mg && mr > mb && mb > 150, 'Morgen nicht rosa');
  const [ar, ag, ab] = ch(abend.sky); assert.ok(ar > ag && ag > ab, 'Abend nicht orange');
  const [nr, ng, nb] = ch(nacht.sky); assert.ok(nb > nr && nb > ng, 'Nacht nicht blau');
  assert.ok(nacht.lights === 1 && abend.lights > 0.4 && morgen.lights < 0.5);
  // Wrap: 1.0 == 0.0 und negative t
  assert.deepEqual(tageszeitPalette(1.0), tageszeitPalette(0.0));
  assert.deepEqual(tageszeitPalette(-0.25), tageszeitPalette(0.75));
});

test('Sonnenstand: unter dem Horizont nachts, Höhe 1 mittags, Lauf Ost → West; Lichtversatz nie unter der Spielfläche', () => {
  assert.equal(sonnenstand(0.05).oben, false);
  assert.equal(sonnenstand(0.9).oben, false);
  const mittag = sonnenstand((SONNE.auf + SONNE.unter) / 2);
  assert.ok(mittag.oben && Math.abs(mittag.hoehe - 1) < 1e-9);
  assert.ok(sunOffset(SONNE.auf + 0.01).x > 30, 'Sonne geht nicht im Osten auf');
  assert.ok(sunOffset(SONNE.unter - 0.01).x < -30, 'Sonne geht nicht im Westen unter');
  for (let t = 0; t <= 1; t += 0.01) assert.ok(sunOffset(t).y >= 10, `Licht zu flach bei t=${t.toFixed(2)}`);
  assert.equal(sonnenPosition(0.5).sichtbar, true);
  assert.equal(sonnenPosition(0.95).sichtbar, false);
  assert.ok(sonnenPosition(0.5).y > sonnenPosition(0.3).y);
  assert.ok(nachtAnteil(0.5) === 0 && nachtAnteil(0.02) === 1 && nachtAnteil(0.82) > 0 && nachtAnteil(0.82) < 1);
});

test('Sonnenstimmung: morgens und abends müde, mittags selig, nachts schlafend', () => {
  assert.equal(sonnenStimmung(0.25), 'muede');
  assert.equal(sonnenStimmung(0.5), 'selig');
  assert.equal(sonnenStimmung(0.72), 'muede');
  assert.equal(sonnenStimmung(0.95), 'schlaeft');
});
