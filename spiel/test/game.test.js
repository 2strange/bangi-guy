// Tests der Mechanik v0: node --test "spiel/test/**/*.test.js"
import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  initialState, normalizeKunde, normalizeKatalog, pickLine, sell, decline, isArrested, newDay, heatLabel,
  startDialog, advanceDialog, chooseOption, moodFor, nearestKunde, wanderStep, inspectCamera, kundeLookYaw,
  START_WARE, MAX_HEAT, pickKunden, idSeed,
  DEFAULT_TEXTE, normalizeTexte, fillText, dayReport, soldOutDialog, isSoldOut, assignOutfits, outfitKey, variantCount, lageFor, dayEndCard,
} from '../js/game.js';

const close = (a, b, eps = 1e-6, msg) => assert.ok(Math.abs(a - b) < eps, msg ?? `${a} ≈ ${b}`);
const schluffi = normalizeKunde({ id: 'k1', schuhe: 'sandale', hemd: 'hawaii', zivi: false, zahlt: 20, heat: 0,
  saetze: { gruss: ['Duuude.'], kauf: ['Heiliger.'], ablehnung: ['Okay.'], reveal: [] } });
const zivi = normalizeKunde({ id: 'z1', schuhe: 'turnschuh', hemd: 'polo_sauber', accessoire: 'ohrknopf', zivi: true, zahlt: 50, heat: 2,
  saetze: { gruss: ['Hallo!'], kauf: ['Interessant.'], ablehnung: ['Schade.'], reveal: ['Zentrale, angebissen.'] } });

test('normalizeKunde: fehlende und kaputte Felder bekommen Defaults', () => {
  const k = normalizeKunde({ schuhe: 'stiefel', zahlt: 'viel', saetze: { gruss: [] } }, 3);
  assert.equal(k.id, 'kunde_4');
  assert.equal(k.schuhe, 'sandale');
  assert.equal(k.hemd, 'hawaii');
  assert.equal(k.accessoire, null);
  assert.equal(k.zivi, false);
  assert.equal(k.zahlt, 20);
  assert.equal(k.heat, 0);
  assert.ok(k.saetze.gruss.length > 0 && k.saetze.reveal.length > 0);
  const n = normalizeKunde(null);
  assert.equal(n.id, 'kunde_1');
  // Zivi ohne heat-Angabe bekommt 2, heat wird auf 0..3 geklemmt
  assert.equal(normalizeKunde({ zivi: true }).heat, 2);
  assert.equal(normalizeKunde({ heat: 9 }).heat, 3);
});

test('normalizeKatalog: Liste aus {kunden:[]} oder Array, doppelte ids werden eindeutig', () => {
  const list = normalizeKatalog({ kunden: [{ id: 'a' }, { id: 'a' }, null] });
  assert.deepEqual(list.map((k) => k.id), ['a', 'a_', 'kunde_3']);
  assert.equal(normalizeKatalog(undefined).length, 0);
  assert.equal(normalizeKatalog([{ id: 'x' }]).length, 1);
});

test('pickLine: zyklisch, leer → leerer String', () => {
  assert.equal(pickLine(['a', 'b'], 0), 'a');
  assert.equal(pickLine(['a', 'b'], 3), 'b');
  assert.equal(pickLine([], 5), '');
  assert.equal(pickLine(['a'], -1), 'a');
});

test('sell an Unbedenklichen: +Geld, Ware −1, Status zufrieden, Zustand unverändert (immutabel)', () => {
  const s0 = initialState();
  const r = sell(s0, schluffi);
  assert.equal(r.result, 'kauf');
  assert.equal(r.text, 'Heiliger.');
  assert.equal(r.state.geld, 20);
  assert.equal(r.state.ware, START_WARE - 1);
  assert.equal(r.state.status.k1, 'zufrieden');
  assert.equal(s0.geld, 0, 'Original nicht mutiert');
  // zweiter Verkauf an denselben Kunden geht nicht
  assert.equal(sell(r.state, schluffi).result, 'schon_erledigt');
});

test('sell an Zivi: Heat steigt um seinen Wert, kein Geld, Ware bleibt, Reveal-Satz, misstrauisch', () => {
  const r = sell(initialState(), zivi);
  assert.equal(r.result, 'reveal');
  assert.equal(r.text, 'Zentrale, angebissen.');
  assert.equal(r.state.heat, 2);
  assert.equal(r.heatPlus, 2);
  assert.equal(r.state.geld, 0);
  assert.equal(r.state.ware, START_WARE);
  assert.equal(r.state.status.z1, 'misstrauisch');
  assert.equal(isArrested(r.state), false);
});

test('Heat 3 = verhaftet; Heat ist auf MAX_HEAT gedeckelt; Zivi mit heat 0 gibt trotzdem +1', () => {
  let s = initialState();
  s = sell(s, zivi).state;
  const z2 = { ...zivi, id: 'z2' };
  s = sell(s, z2).state;
  assert.equal(s.heat, MAX_HEAT);
  assert.ok(isArrested(s));
  assert.equal(sell(s, schluffi).result, 'verhaftet', 'nach Verhaftung kein Verkauf mehr');
  const z0 = { ...zivi, id: 'z0', heat: 0 };
  assert.equal(sell(initialState(), z0).state.heat, 1);
});

test('keine Ware: Verkauf scheitert mit Hinweis, Status bleibt neutral', () => {
  const s = { ...initialState(), ware: 0 };
  const r = sell(s, schluffi);
  assert.equal(r.result, 'keine_ware');
  assert.equal(r.state.status.k1, undefined);
});

test('decline: Status abgelehnt, Ablehnungssatz, kein Geld/Heat', () => {
  const r = decline(initialState(), zivi);
  assert.equal(r.result, 'ablehnung');
  assert.equal(r.text, 'Schade.');
  assert.equal(r.state.heat, 0);
  assert.equal(r.state.status.z1, 'abgelehnt');
});

test('newDay: Geld bleibt, Ware voll, Heat 0, Tag +1, Kunden wieder neutral', () => {
  let s = sell(initialState(), schluffi).state;
  s = { ...s, heat: 3, verhaftet: true };
  const n = newDay(s);
  assert.equal(n.geld, 20);
  assert.equal(n.ware, START_WARE);
  assert.equal(n.heat, 0);
  assert.equal(n.tag, 2);
  assert.deepEqual(n.status, {});
  assert.equal(isArrested(n), false);
});

test('heatLabel: so viele Sirenen wie Heat', () => {
  assert.equal(heatLabel(0), '···');
  assert.equal(heatLabel(2), '🚨🚨·');
  assert.equal(heatLabel(7), '🚨🚨🚨');
});

test('Gespräch: Gruß → Wahl → Ergebnis → Ende, Verkaufen wirkt auf den Zustand', () => {
  let s = initialState();
  let d = startDialog(schluffi, s);
  assert.equal(d.phase, 'gruss');
  assert.equal(d.text, 'Duuude.');
  d = advanceDialog(d);
  assert.equal(d.phase, 'wahl');
  assert.deepEqual(d.options, ['Verkaufen', 'Lieber nicht']);
  // in der Wahl-Phase ändert advance nichts
  assert.equal(advanceDialog(d).phase, 'wahl');
  const r = chooseOption(s, d, schluffi, 'Verkaufen');
  s = r.state; d = r.dialog;
  assert.equal(d.phase, 'ergebnis');
  assert.equal(d.result, 'kauf');
  assert.equal(d.geldPlus, 20);
  assert.equal(s.geld, 20);
  assert.equal(advanceDialog(d), null, 'Ergebnis → Ende');
  // nochmal ansprechen: schon erledigt, direkt Ergebnis
  const d2 = startDialog(schluffi, s);
  assert.equal(d2.phase, 'ergebnis');
  assert.equal(d2.result, 'schon_erledigt');
});

test('Gespräch: Lieber nicht → Ablehnungssatz, Zustand unverändert; chooseOption außerhalb der Wahl ignoriert', () => {
  const s = initialState();
  const d = advanceDialog(startDialog(zivi, s));
  const r = chooseOption(s, d, zivi, 'Lieber nicht');
  assert.equal(r.dialog.result, 'ablehnung');
  assert.equal(r.state.heat, 0);
  const g = startDialog(zivi, s);
  assert.equal(chooseOption(s, g, zivi, 'Verkaufen').dialog.phase, 'gruss');
});

test('moodFor: Status → Stimmung', () => {
  assert.equal(moodFor('zufrieden'), 'zufrieden');
  assert.equal(moodFor('misstrauisch'), 'misstrauisch');
  assert.equal(moodFor('abgelehnt'), 'neutral');
  assert.equal(moodFor(undefined), 'neutral');
});

test('nearestKunde: nächster innerhalb der Reichweite, sonst null', () => {
  const ks = [{ id: 'a', x: 0, z: 5 }, { id: 'b', x: 2, z: 0 }, { id: 'c', x: 10, z: 10 }];
  assert.equal(nearestKunde({ x: 0, z: 0 }, ks).id, 'b');
  assert.equal(nearestKunde({ x: 20, z: 20 }, ks), null);
  assert.equal(nearestKunde({ x: 0, z: 0 }, ks, 1), null);
});

test('wanderStep: läuft zum Punkt, pausiert, wechselt den Punkt, bewegt sich nicht ohne Punkte', () => {
  let n = { x: 0, z: 0, yaw: 0, points: [{ x: 4, z: 0 }, { x: 0, z: 0 }], idx: 0, pause: 0, speed: 2 };
  n = wanderStep(n, 0.5);
  close(n.x, 1); assert.equal(n.moving, true); close(n.yaw, Math.PI / 2);
  for (let i = 0; i < 4; i++) n = wanderStep(n, 0.5); // 3 Schritte bis x=4, einer zum Umschalten
  assert.equal(n.idx, 1, 'Punkt erreicht → nächster');
  assert.ok(n.pause > 0 && n.moving === false, 'pausiert');
  for (let i = 0; i < 4; i++) n = wanderStep(n, 0.5);
  close(n.x, 4, 1e-9, 'während der Pause keine Bewegung');
  for (let i = 0; i < 3; i++) n = wanderStep(n, 0.5);
  assert.ok(n.x < 4, 'läuft zurück');
  const still = wanderStep({ x: 1, z: 1, yaw: 0, points: [{ x: 1, z: 1 }], idx: 0, pause: 0, speed: 1 }, 1);
  assert.equal(still.moving, false); close(still.x, 1);
});

test('inspectCamera: seitlich versetzt auf der Spielerseite, Blick auf Körpermitte, Spieler nicht im Weg', () => {
  const npc = { x: 10, z: 10, yaw: 0 };
  const viewer = { x: 10, z: 12.4 };
  const c = inspectCamera(npc, viewer);
  close(c.y, 1.8); close(c.tx, 10); close(c.tz, 10); close(c.ty, 1.4);
  close(Math.hypot(c.x - npc.x, c.z - npc.z), 5.4, 1e-6, 'Abstand');
  // Winkel zwischen Kamera-Richtung und Spieler-Richtung ≈ 0.9 rad → Spieler steht nicht in der Sichtlinie
  const a = Math.atan2(c.x - npc.x, c.z - npc.z);
  close(Math.abs(a), 1.1, 1e-6);
  const distToLine = Math.abs((viewer.x - npc.x) * (c.z - npc.z) - (viewer.z - npc.z) * (c.x - npc.x)) / 5.4;
  assert.ok(distToLine > 1.5, 'Spieler mindestens 1.5 neben der Sichtlinie');
  // ohne Winkel: direkt auf der Spielerseite
  const c0 = inspectCamera(npc, { x: 10, z: 20 }, { angle: 0 });
  close(c0.x, 10); close(c0.z, 15.4);
  // Spieler exakt auf dem Kunden: Blickrichtung des Kunden als Ersatz
  const c2 = inspectCamera({ x: 0, z: 0, yaw: Math.PI / 2 }, { x: 0, z: 0 }, { angle: 0 });
  close(c2.x, 5.4); close(c2.z, 0);
});

test('kundeLookYaw: schaut nur in der Nähe zum Spieler, mit Anschlag', () => {
  const k = { x: 0, z: 0, yaw: 0 };
  close(kundeLookYaw(k, { x: 0, z: 50 }), 0, 1e-9, 'zu weit weg');
  close(kundeLookYaw(k, { x: 3, z: 3 }), Math.PI / 4);
  close(kundeLookYaw(k, { x: 0, z: -5 }), 1.0, 1e-9, 'Anschlag');
});

test('pickKunden: 7 Kunden pro Tag, 2 Zivis, die pro Tag rotieren; Katalogreihenfolge bleibt', () => {
  const kat = [
    { id: 'a' }, { id: 'b' }, { id: 'c' }, { id: 'd' }, { id: 'e' }, { id: 'f' }, { id: 'g' },
    { id: 'z1', zivi: true }, { id: 'z2', zivi: true }, { id: 'z3', zivi: true },
  ];
  const p = pickKunden(kat);
  assert.equal(p.length, 7);
  assert.equal(p.filter((k) => k.zivi).length, 2);
  assert.deepEqual(p.map((k) => k.id), ['a', 'b', 'c', 'd', 'e', 'z1', 'z2']);
  assert.deepEqual(pickKunden(kat, 7, 2, 2).filter((k) => k.zivi).map((k) => k.id), ['z2', 'z3'], 'Tag 2');
  assert.deepEqual(pickKunden(kat, 7, 2, 3).filter((k) => k.zivi).map((k) => k.id), ['z1', 'z3'], 'Tag 3 (zyklisch, Katalogreihenfolge)');
  assert.deepEqual(pickKunden(kat, 7, 2, 4).filter((k) => k.zivi).map((k) => k.id), ['z1', 'z2'], 'Tag 4 = Tag 1');
  // alle drei Zivis kommen innerhalb von drei Tagen dran
  const seen = new Set([1, 2, 3].flatMap((d) => pickKunden(kat, 7, 2, d).filter((k) => k.zivi).map((k) => k.id)));
  assert.deepEqual([...seen].sort(), ['z1', 'z2', 'z3']);
  const p6 = pickKunden(kat, 6, 2);
  assert.deepEqual(p6.map((k) => k.id), ['a', 'b', 'c', 'd', 'z1', 'z2']);
  // kleiner Katalog: alles nehmen
  assert.equal(pickKunden([{ id: 'x' }, { id: 'y', zivi: true }], 6, 2).length, 2);
  // keine Zivis vorhanden: trotzdem n Kunden
  assert.equal(pickKunden(kat.slice(0, 7), 6, 2).length, 6);
  // nur Zivis: n Zivis
  assert.equal(pickKunden(kat.slice(7), 6, 2).length, 3);
});

test('normalizeKunde: erweiterte Enums und optionale Content-Felder, Unbekanntes fällt sauber zurück', () => {
  const k = normalizeKunde({ hemd: 'kittel', accessoire: 'gehstock', hose: 'rock', hautton: 'dunkel', bart: 'vollbart',
    brille: 'lesebrille', haare: 'weiss', extras: ['socken', 'preisschild', 'quatsch', 42], stimmung_start: 'misstrauisch',
    tempo: 0.3, spawn: 'K4', name: '  Oma Lek ' });
  assert.equal(k.hemd, 'kittel'); assert.equal(k.accessoire, 'gehstock'); assert.equal(k.hose, 'rock');
  assert.equal(k.hautton, 'dunkel'); assert.equal(k.bart, 'vollbart'); assert.equal(k.brille, 'lesebrille');
  assert.equal(k.haare, 'weiss'); assert.deepEqual(k.extras, ['socken', 'preisschild']);
  assert.equal(k.stimmung_start, 'misstrauisch'); assert.equal(k.tempo, 0.3); assert.equal(k.spawn, 'K4');
  assert.equal(k.name, 'Oma Lek');
  const d = normalizeKunde({ hemd: 'smoking', accessoire: 'laser', hose: 'latz', hautton: 'blau', bart: 7, brille: 'x',
    haare: null, extras: 'socken', stimmung_start: 'wütend', tempo: 99, spawn: 'K9', name: '' });
  assert.equal(d.hemd, 'hawaii'); assert.equal(d.accessoire, null); assert.equal(d.hose, null);
  assert.equal(d.hautton, 'mittel'); assert.equal(d.bart, 'keiner'); assert.equal(d.brille, 'keine');
  assert.equal(d.haare, 'kurz'); assert.deepEqual(d.extras, []); assert.equal(d.stimmung_start, 'neutral');
  assert.equal(d.tempo, 2); assert.equal(d.spawn, null); assert.equal(d.name, null);
});

test('idSeed: stabil, positiv, verschieden für verschiedene ids', () => {
  assert.equal(idSeed('zivi_1'), idSeed('zivi_1'));
  assert.ok(idSeed('zivi_1') > 0 && Number.isInteger(idSeed('zivi_1')));
  assert.notEqual(idSeed('zivi_1'), idSeed('zivi_2'));
  assert.notEqual(idSeed('a'), idSeed('b'));
});

// ---------- Ausverkauft / Tagesende / Texte ----------
test('Tagesbilanz zählt Verkäufe und Geld des Tages; newDay setzt sie zurück, Geld bleibt', () => {
  let s = initialState();
  s = sell(s, schluffi).state;
  s = sell(s, { ...schluffi, id: 'k2', zahlt: 30 }).state;
  const r = dayReport(s);
  assert.equal(r.verkauft, 2); assert.equal(r.geldHeute, 50); assert.equal(r.geld, 50); assert.equal(r.tag, 1);
  const n = newDay(s);
  assert.equal(n.verkauftHeute, 0); assert.equal(n.geldHeute, 0); assert.equal(n.geld, 50);
});

test('isSoldOut + soldOutDialog: bei Ware 0 Meldung mit „Tag beenden“ / „Weiter“', () => {
  let s = initialState();
  for (let i = 0; i < START_WARE; i++) s = sell(s, { ...schluffi, id: 'k' + i }).state;
  assert.ok(isSoldOut(s));
  const d = soldOutDialog(normalizeTexte(null));
  assert.equal(d.phase, 'ausverkauft');
  assert.deepEqual(d.options, ['Tag beenden', 'Weiterbummeln']);
  assert.ok(d.text.length > 10);
  // Verkauf bei Ware 0 nutzt den Kundensatz aus den Texten, falls im State hinterlegt
  const r = sell({ ...s, texte: normalizeTexte({ ausverkauft_kunde: ['Leer, Digga.'] }) }, { ...schluffi, id: 'neu' });
  assert.equal(r.result, 'keine_ware'); assert.equal(r.text, 'Leer, Digga.');
});

test('normalizeTexte: Defaults bei fehlender/kaputter Datei, Schema der Content-Datei (tagesende nach Lage), fillText', () => {
  assert.deepEqual(normalizeTexte(undefined), DEFAULT_TEXTE);
  const t = normalizeTexte({ ausverkauft: ['A', 'B'], tagesende: { gut: ['Top.'], heat: 7, nichts: [] }, optionen: { weiter: 42 }, reveal_gags: [], mentor: [] });
  assert.deepEqual(t.ausverkauft, ['A', 'B']);
  assert.deepEqual(t.tagesende.gut, ['Top.']);
  assert.deepEqual(t.tagesende.heat, DEFAULT_TEXTE.tagesende.heat, 'kaputt → Default');
  assert.deepEqual(t.tagesende.nichts, DEFAULT_TEXTE.tagesende.nichts, 'leer → Default');
  assert.deepEqual(t.tagesende.verhaftet, DEFAULT_TEXTE.tagesende.verhaftet, 'fehlt → Default');
  assert.equal(t.optionen.weiter, 'Weiterbummeln');
  assert.equal(fillText('Tag {tag}: {verkauft} Beutel, {unbekannt}', { tag: 3, verkauft: 5 }), 'Tag 3: 5 Beutel, {unbekannt}');
});

test('lageFor + dayEndCard: Lage aus der Bilanz, Spruch und Zeilen mit Zahlen gefüllt', () => {
  assert.equal(lageFor({ verkauft: 0, heat: 0, verhaftet: false }), 'nichts');
  assert.equal(lageFor({ verkauft: 3, heat: 2, verhaftet: false }), 'heat');
  assert.equal(lageFor({ verkauft: 3, heat: 1, verhaftet: false }), 'gut');
  assert.equal(lageFor({ verkauft: 3, heat: 3, verhaftet: true }), 'verhaftet');
  let s = initialState();
  s = sell(s, schluffi).state;
  const t = normalizeTexte({ tagesende: { gut: ['Guter Tag {tag}.'] } });
  const c = dayEndCard(s, t);
  assert.equal(c.lage, 'gut'); assert.equal(c.titel, 'Feierabend.'); assert.equal(c.spruch, 'Guter Tag 1.');
  assert.deepEqual(c.zeilen, ['Tag 1: 1 Beutel verkauft, 20 Münzen dazu.', 'Kasse: 20 · Heat: ···']);
  const v = dayEndCard({ ...s, heat: 3, verhaftet: true }, t);
  assert.equal(v.lage, 'verhaftet'); assert.equal(v.titel, 'VERHAFTET.');
});

// ---------- Outfits ----------
test('assignOutfits: gleicher Hemd-Typ bekommt verschiedene Varianten, Schlüssel pro Tag eindeutig, deterministisch', () => {
  const ks = [];
  for (let i = 0; i < 6; i++) ks.push(normalizeKunde({ id: 'h' + i, hemd: 'hawaii', accessoire: 'cap' }));
  for (let i = 0; i < 6; i++) ks.push(normalizeKunde({ id: 'p' + i, hemd: 'polo_sauber', accessoire: null }));
  const o = assignOutfits(ks, 1);
  const keys = ks.map((k) => outfitKey(k, o[k.id]));
  assert.equal(new Set(keys).size, keys.length, 'keine Doppel-Outfits');
  assert.deepEqual(assignOutfits(ks, 1), o, 'deterministisch');
  assert.notDeepEqual(assignOutfits(ks, 2), o, 'anderer Tag, andere Zuteilung');
  // mehr Polos als Farben: Wiederholung erst, wenn alle Varianten vergeben sind
  const many = [];
  for (let i = 0; i < variantCount('polo_sauber') + 1; i++) many.push(normalizeKunde({ id: 'q' + i, hemd: 'polo_sauber' }));
  const om = assignOutfits(many, 1);
  const colors = many.map((k) => om[k.id].color);
  assert.equal(new Set(colors).size, variantCount('polo_sauber'));
  // Hawaii-Varianten haben Muster + Farbe
  assert.ok(['blumen', 'streifen', 'punkte', 'palmen'].includes(o.h0.pattern));
  assert.equal(o.p0.pattern, 'uni');
});

test('Invariante: Ware + heute verkauft = Startware — ein Zivi nimmt keinen Beutel (er zahlt nicht, nichts wird übergeben)', () => {
  let s = initialState();
  const seq = [schluffi, zivi, { ...schluffi, id: 'k2' }, { ...schluffi, id: 'k3' }]; // ein Zivi (Heat 2), kein Verhaften
  for (const k of seq) {
    s = sell(s, k).state;
    assert.equal(s.ware + s.verkauftHeute, START_WARE, `nach ${k.id}`);
    const r = dayReport(s);
    assert.equal(r.verkauft + s.ware, START_WARE);
  }
  // Ablehnen ändert nichts an der Bilanz
  s = decline(s, { ...schluffi, id: 'k4' }).state;
  assert.equal(s.ware + s.verkauftHeute, START_WARE);
  // alles verkauft: Ware 0 heißt verkauft = 5
  for (const id of ['k5', 'k6']) s = sell(s, { ...schluffi, id }).state;
  assert.equal(s.ware, 0); assert.equal(dayReport(s).verkauft, START_WARE);
  assert.equal(sell(s, { ...schluffi, id: 'k7' }).result, 'keine_ware');
});
