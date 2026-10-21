// Tests der Mechanik v0: node --test "spiel/test/**/*.test.js"
import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  initialState, normalizeKunde, normalizeKatalog, pickLine, sell, decline, isArrested, newDay, heatLabel,
  startDialog, advanceDialog, chooseOption, moodFor, nearestKunde, wanderStep, inspectCamera, kundeLookYaw,
  START_WARE, MAX_WARE, MAX_HEAT, pickKunden, idSeed,
  DEFAULT_TEXTE, normalizeTexte, fillText, dayReport, soldOutDialog, isSoldOut, assignOutfits, outfitKey, variantCount, lageFor, dayEndCard, normalizeGags, gagFor, nextIdleGagDelay, ZIVI_BESCHLAGNAHMT,
  normalizeStimmen, stimmeSlug, barksFor, pickBark,
  normalizeMentorSzene, mentorSzene, finishMentor, applyMentorAktion, mentorBesucht,
  POSTEN_DEFAULT, inPostenSicht, buyMango, giveMango, mangoAbgegeben, tafelText, MANGO_PREIS,
  normalizePosten7, mangoText, pongText, tafelLines, DEFAULT_POSTEN7, patrolSpotted, arrestNow, tukTukRide, TUKTUK_PREIS_MANGOS, TUKTUK_PREIS_GELD,
  DAY_LENGTH, phaseFor, initialClock, clockStep, clockLabel, abendBeginnt, nachtBeginnt, barBeendetTag, inBar, normalizeAbend, barAbend, guteNacht, sonnenuntergangLine, einschlafenLine, zwischenrufLine, DEFAULT_ABEND, NACHT_ABKUEHLUNG,
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

test('sell an Zivi: Heat steigt um seinen Wert, kein Geld, Beutel weg (an die Polizei), Reveal-Satz, misstrauisch', () => {
  const r = sell(initialState(), zivi);
  assert.equal(r.result, 'reveal');
  assert.equal(r.text, 'Zentrale, angebissen.');
  assert.equal(r.state.heat, 2);
  assert.equal(r.heatPlus, 2);
  assert.equal(r.state.geld, 0);
  assert.equal(r.state.ware, START_WARE - 1);
  assert.equal(r.state.anZivisHeute, 1);
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

test('newDay: Geld bleibt, Restware bleibt (nach Verhaftung weg), Heat 0, Tag +1, Kunden wieder neutral', () => {
  let s = sell(initialState(), schluffi).state;
  assert.equal(newDay(s).ware, START_WARE - 1, 'Restware bleibt über Nacht in der Tasche');
  s = { ...s, heat: 3, verhaftet: true };
  const n = newDay(s);
  assert.equal(n.geld, 20);
  assert.equal(n.ware, 0, 'nach der Verhaftung ist die Ware weg');
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
  assert.deepEqual(d.options, ['Verkaufen', 'Mehr verlangen', 'Lieber nicht']);
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
  assert.deepEqual(c.zeilen, ['Tag 1: 1 Beutel weg, 20 Münzen dazu.', 'Kasse: 20 · Heat: ···', 'Tage ohne Vorfall: 0']);
  // mit Zivi: Polizei-Zusatz, Zahlen gehen auf
  const z = dayEndCard(sell(s, zivi).state, t);
  assert.equal(z.zeilen[0], 'Tag 1: 2 Beutel weg (1 an die Polizei 🙈), 20 Münzen dazu.');
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

test('Invariante: verkauft + an Zivis + übrig = Startware, über Verkäufe, Zivi-Reveal und Ablehnung bis Ware 0', () => {
  let s = initialState();
  const check = (label) => {
    const r = dayReport(s);
    assert.equal(r.verkauft + r.anZivis + r.uebrig, START_WARE, label);
    assert.equal(r.weg, r.verkauft + r.anZivis, label + ' (weg)');
  };
  for (const k of [schluffi, zivi, { ...schluffi, id: 'k2' }]) { s = sell(s, k).state; check('nach ' + k.id); }
  s = decline(s, { ...schluffi, id: 'k4' }).state; check('nach Ablehnung');
  for (const id of ['k5', 'k6']) { s = sell(s, { ...schluffi, id }).state; check('nach ' + id); }
  assert.equal(s.ware, 0);
  const r = dayReport(s);
  assert.equal(r.verkauft, 4); assert.equal(r.anZivis, 1); assert.equal(r.weg, START_WARE);
  assert.equal(sell(s, { ...schluffi, id: 'k7' }).result, 'keine_ware');
  // bei Ware 0 scheitert auch der Zivi-„Verkauf“ (kein Beutel, kein Heat)
  assert.equal(sell(s, { ...zivi, id: 'z9' }).result, 'keine_ware');
  assert.equal(sell(s, { ...zivi, id: 'z9' }).state.heat, s.heat);
});

test('normalizeGags/gagFor: gültige Einträge bleiben, kaputte fliegen raus, Dauer gedeckelt; Idle-Takt 6–10 s', () => {
  const t = normalizeTexte({ reveal_gags: [
    { id: 'zivi_1', wann: 'kauf', gag: 'Marke', mood: 'misstrauisch', extra: 'dienstmarke', dauer_s: 1.5 },
    { id: 'zivi_1', wann: 'ablehnung', mood: 'quatsch', dauer_s: 'lang' },
    { id: 'zivi_2', wann: 'manchmal' }, { wann: 'kauf' }, null, { id: 'x', wann: 'immer', dauer_s: 99 },
  ] });
  assert.equal(t.reveal_gags.length, 3);
  assert.equal(gagFor(t, 'zivi_1', 'kauf').extra, 'dienstmarke');
  const ab = gagFor(t, 'zivi_1', 'ablehnung');
  assert.equal(ab.mood, null); assert.equal(ab.dauer_s, 1.5);
  assert.equal(gagFor(t, 'x', 'immer').dauer_s, 10);
  assert.equal(gagFor(t, 'zivi_2', 'kauf'), null);
  assert.deepEqual(normalizeTexte(null).reveal_gags, []);
  for (let n = 0; n < 20; n++) { const d = nextIdleGagDelay(n); assert.ok(d >= 6 && d < 10, `Takt ${d}`); }
});

test('ZIVI_BESCHLAGNAHMT = false: Zivi nimmt keinen Beutel, Ware unverändert, Bilanz ohne Klammerzusatz', () => {
  assert.equal(typeof ZIVI_BESCHLAGNAHMT, 'boolean');
  let s = initialState();
  s = sell(s, schluffi).state;
  const r = sell(s, zivi, 0, { beschlagnahmt: false });
  assert.equal(r.result, 'reveal'); assert.equal(r.state.heat, 2);
  assert.equal(r.state.ware, START_WARE - 1, 'Ware unverändert durch den Zivi');
  assert.equal(r.state.anZivisHeute, 0);
  const rep = dayReport(r.state);
  assert.equal(rep.verkauft + rep.uebrig, START_WARE);
  assert.equal(rep.weg, 1);
  const c = dayEndCard(r.state, normalizeTexte(null));
  assert.equal(c.zeilen[0], 'Tag 1: 1 Beutel weg, 20 Münzen dazu.');
  // Gegenprobe true: Beutel weg, Klammerzusatz
  const t = sell(s, zivi, 0, { beschlagnahmt: true });
  assert.equal(t.state.ware, START_WARE - 2); assert.equal(t.state.anZivisHeute, 1);
  assert.equal(dayEndCard(t.state, normalizeTexte(null)).zeilen[0], 'Tag 1: 2 Beutel weg (1 an die Polizei 🙈), 20 Münzen dazu.');
  // Standard ohne Option = Konstante
  assert.equal(sell(s, zivi).state.ware, ZIVI_BESCHLAGNAHMT ? START_WARE - 2 : START_WARE - 1);
});

test('Stimmen: Lookup zuordnung > stimme > id, Barks je Art, kaputte Daten → keine Blase', () => {
  const st = normalizeStimmen({
    zuordnung: { zivi_1: 'zivi_polo', kaputt: 7 },
    stimmen: { zivi_polo: { charakter: { stil: 'zackig' }, barks: { gruss: ['Hello there.', 'Normal tourist.'], kauf: 'nope', zivi_verdaechtig: ['Hm.'] } },
      surfer: { barks: { gruss: ['Yo.'] } }, default: null },
  });
  assert.equal(stimmeSlug(st, { id: 'zivi_1', stimme: 'x' }), 'zivi_polo', 'zuordnung gewinnt');
  assert.equal(stimmeSlug(st, { id: 'surfer_1', stimme: 'surfer' }), 'surfer', 'stimme-Feld');
  assert.equal(stimmeSlug(st, { id: 'oma_1', stimme: null }), 'oma_1', 'id als Fallback');
  assert.deepEqual(barksFor(st, { id: 'zivi_1' }, 'gruss'), ['Hello there.', 'Normal tourist.']);
  assert.deepEqual(barksFor(st, { id: 'zivi_1' }, 'kauf'), [], 'String statt Liste → leer');
  assert.deepEqual(barksFor(st, { id: 'oma_1', stimme: null }, 'gruss'), [], 'unbekannt → keine Blase');
  assert.deepEqual(normalizeStimmen(undefined), { zuordnung: {}, stimmen: {} });
  // kunden.json-Feld stimme wird normalisiert
  assert.equal(normalizeKunde({ stimme: ' surfer ' }).stimme, 'surfer');
  assert.equal(normalizeKunde({ stimme: 3 }).stimme, null);
});

test('pickBark: nie zweimal hintereinander dieselbe Zeile, eine Zeile darf wiederholen, leer → null', () => {
  const list = ['a', 'b', 'c'];
  let prev = -1;
  for (let i = 0; i < 30; i++) {
    const r = pickBark(list, prev, i * 7);
    assert.notEqual(r.idx, prev, `Runde ${i}`);
    assert.equal(r.text, list[r.idx]);
    prev = r.idx;
  }
  assert.deepEqual(pickBark(['solo'], 0, 5), { text: 'solo', idx: 0 });
  assert.equal(pickBark([], 0), null);
  assert.equal(pickBark(undefined, 0), null);
});

// ---------- Mentor ----------
const SZ = normalizeMentorSzene({
  mentor_szene: {
    ankunft: ['Setz dich.'],
    schritte: [
      { id: 'ankunft', wer: 'mentor', text: '@ankunft', weiter: 'lektion' },
      { id: 'lektion', wer: 'mentor', quelle: 'mentor[tag]', blasen: ['einleitung', 'regel', 'pointe'], weiter: 'nachschub' },
      { id: 'nachschub', wer: 'mentor', text: ['Hier.'], aktion: 'ware_auffuellen', menge: 5, weiter: 'abschied' },
      { id: 'abschied', wer: 'mentor', text: ['Geh.'], aktion: 'heat_minus', wert: 1, weiter: null },
    ],
    schon_geholt: ['Schon geholt.'], voll: ['Voll.'], ausgelernt: ['Ausgelernt.'],
  },
  mentor: [{ id: 'w1', titel: 'Sandalen', einleitung: 'E1', regel: 'R1', pointe: 'P1' }, { id: 'w2', titel: 'Hund', einleitung: 'E2', regel: 'R2', pointe: 'P2' }],
});

test('mentorSzene: volle Folge am ersten Besuch — Ankunft, drei Lektionsblasen, Nachschub (+Ware), Abschied (−Heat)', () => {
  const s = { ...initialState(), ware: 1, heat: 2 };
  const f = mentorSzene(s, SZ);
  assert.deepEqual(f.map((e) => e.id), ['ankunft', 'lektion:einleitung', 'lektion:regel', 'lektion:pointe', 'nachschub', 'abschied']);
  assert.equal(f[0].text, 'Setz dich.'); assert.equal(f[2].text, 'R1'); assert.equal(f[2].titel, 'Sandalen');
  assert.deepEqual(f.map((e) => e.bark), ['gruss', 'lektion', 'lektion', 'lektion', 'nachschub', 'abschied']);
  const n = finishMentor(s, f);
  assert.equal(n.ware, 6, '+5 obendrauf (1 + 5)'); assert.equal(n.heat, 1, 'Heat −1'); assert.equal(n.mentorTag, 1);
  assert.ok(mentorBesucht(n));
  // zweiter Besuch am selben Tag: nur schon_geholt, keine Aktion
  const f2 = mentorSzene(n, SZ);
  assert.deepEqual(f2.map((e) => e.id), ['schon_geholt']);
  assert.equal(finishMentor(n, f2).ware, 6);
  // neuer Tag: wieder besuchbar, Lektion 2; Tag 3 ohne Weisheit → ausgelernt
  const d2 = { ...newDay(n), ware: 0 };
  assert.equal(mentorBesucht(d2), false);
  assert.equal(mentorSzene(d2, SZ)[2].text, 'R2');
  const d3 = { ...newDay(d2), ware: 0 };
  assert.deepEqual(mentorSzene(d3, SZ).map((e) => e.id), ['ankunft', 'ausgelernt', 'nachschub', 'abschied']);
});

test('mentorSzene: volle Tasche (MAX_WARE) → nur „voll“; Nachschub kommt obendrauf, gedeckelt; Heat nicht unter 0; Defaults bei fehlender Datei', () => {
  const s = { ...initialState(), ware: MAX_WARE };
  assert.deepEqual(mentorSzene(s, SZ).map((e) => e.id), ['voll']);
  assert.equal(mentorSzene({ ...s, ware: START_WARE }, SZ).length, 6, 'mit 5 in der Tasche gibt es trotzdem Nachschub');
  assert.equal(applyMentorAktion({ ...s, ware: 3 }, 'ware_auffuellen', 5).ware, 8, '+5 obendrauf');
  assert.equal(applyMentorAktion({ ...s, ware: 7 }, 'ware_plus', 5).ware, 12, 'Alias ware_plus');
  assert.equal(applyMentorAktion({ ...s, ware: 13 }, 'ware_auffuellen', 5).ware, MAX_WARE, 'Taschen-Maximum');
  assert.equal(applyMentorAktion({ ...s, heat: 0 }, 'heat_minus', 1).heat, 0);
  assert.equal(applyMentorAktion(s, 'quatsch', 9), s);
  const D = normalizeMentorSzene(undefined);
  assert.equal(D.schritte.length, 4); assert.deepEqual(D.weisheiten, []);
  assert.deepEqual(mentorSzene({ ...initialState(), ware: 0 }, D).map((e) => e.id), ['ankunft', 'ausgelernt', 'nachschub', 'abschied']);
  // Content-Datei: Zahlen als Strings oder fehlend → Defaults
  const X = normalizeMentorSzene({ mentor_szene: { schritte: [{ id: 'nachschub', text: ['x'], aktion: 'ware_auffuellen', menge: '5', weiter: null }] } });
  assert.equal(X.schritte[0].menge, START_WARE);
});

// ---------- Posten 7 ----------
test('Heat-Zone: Verkauf an einen Zivi in Sichtweite des Postens gibt doppelt Heat (gedeckelt), außerhalb normal', () => {
  const posten = { x: 0, z: 0, r: 15 };
  assert.equal(inPostenSicht({ x: 10, z: 10 }, posten), true);
  assert.equal(inPostenSicht({ x: 11, z: 11 }, posten), false);
  const z1 = { ...zivi, heat: 1 };
  const near = sell(initialState(), z1, 0, { posten, pos: { x: 5, z: 5 } });
  assert.equal(near.state.heat, 2, 'in Sicht: 1 × 2');
  const far = sell(initialState(), z1, 0, { posten, pos: { x: 40, z: 40 } });
  assert.equal(far.state.heat, 1);
  const cap = sell(initialState(), zivi, 0, { posten, pos: { x: 0, z: 0 } }); // 2 × 2 = 4 → 3
  assert.equal(cap.state.heat, MAX_HEAT); assert.ok(isArrested(cap.state));
  // ohne Posten/Position wie bisher
  assert.equal(sell(initialState(), z1).state.heat, 1);
  // Unbedenkliche bleiben Heat-frei, auch in Sicht
  assert.equal(sell(initialState(), schluffi, 0, { posten, pos: { x: 0, z: 0 } }).state.heat, 0);
  assert.equal(inPostenSicht({ x: POSTEN_DEFAULT.x, z: POSTEN_DEFAULT.z }), true);
});

test('Mangos: kaufen kostet Geld, abgeben senkt Heat um 1 — einmal pro Tag, nur mit Mango und Heat', () => {
  let s = { ...initialState(), geld: 25, heat: 2 };
  assert.equal(buyMango({ ...s, geld: 5 }).result, 'kein_geld');
  s = buyMango(s).state;
  assert.equal(s.geld, 25 - MANGO_PREIS); assert.equal(s.mangos, 1);
  s = buyMango(s).state;
  assert.equal(s.mangos, 2); assert.equal(s.geld, 5);
  const g = giveMango(s);
  assert.equal(g.result, 'gnade'); assert.equal(g.state.heat, 1); assert.equal(g.state.mangos, 1);
  assert.ok(mangoAbgegeben(g.state));
  assert.equal(giveMango(g.state).result, 'schon_heute');
  assert.equal(giveMango({ ...g.state, mangos: 0, mangoTag: 0 }).result, 'keine_mango');
  assert.equal(giveMango({ ...g.state, heat: 0, mangoTag: 0 }).result, 'kein_heat');
  // neuer Tag: wieder möglich, Mangos bleiben
  const n = newDay({ ...g.state, heat: 1 });
  assert.equal(n.mangos, 1); assert.equal(giveMango({ ...n, heat: 1 }).result, 'gnade');
});

test('Tafel „Tage ohne Vorfall“: zählt pro Tag hoch, springt bei Verhaftung auf 0', () => {
  let s = initialState();
  assert.equal(tafelText(s), 'TAGE OHNE VORFALL: 0');
  s = newDay(s); s = newDay(s);
  assert.equal(s.tageOhneVorfall, 2); assert.equal(tafelText(s), 'TAGE OHNE VORFALL: 2');
  const arrested = { ...s, heat: MAX_HEAT, verhaftet: true };
  assert.equal(tafelText(arrested), 'TAGE OHNE VORFALL: 0', 'am Tag der Verhaftung sofort 0');
  const after = newDay(arrested);
  assert.equal(after.tageOhneVorfall, 0);
  assert.equal(newDay(after).tageOhneVorfall, 1);
});

test('posten7-Texte: Normalisierung mit Defaults, Mango-Ergebnis → Text, Pong nach Heat, Tafel zweizeilig', () => {
  const p7 = normalizePosten7({ posten7: { mango: { gnaedig: ['G!'], kein_heat: 7 }, tafel: { zeile1: 'Ruhig seit {tage} Tagen', zeile2: { '2': 'Streife!' } }, pong: { heat_3: ['Mitkommen.'] } } });
  assert.equal(mangoText(p7, 'gnade'), 'G!');
  assert.equal(mangoText(p7, 'kein_heat'), DEFAULT_POSTEN7.mango.kein_heat[0], 'kaputt → Default');
  assert.equal(mangoText(p7, 'quatsch'), '');
  assert.equal(pongText(p7, { heat: 3 }), 'Mitkommen.');
  assert.equal(pongText(p7, { heat: 9 }), 'Mitkommen.', 'geklemmt');
  assert.equal(pongText(p7, { heat: 0 }), DEFAULT_POSTEN7.pong.heat_0[0]);
  const s = { ...initialState(), tageOhneVorfall: 4, heat: 2 };
  assert.deepEqual(tafelLines(p7, s), ['Ruhig seit 4 Tagen', 'Streife!']);
  assert.equal(tafelLines(p7, { ...s, heat: 3, verhaftet: true })[0], 'Ruhig seit 0 Tagen');
  assert.deepEqual(normalizePosten7(undefined), normalizePosten7({}));
  // giveMango-Ergebnisse haben alle einen Text
  for (const r of ['gnade', 'schon_heute', 'keine_mango', 'kein_heat']) assert.ok(mangoText(normalizePosten7(null), r).length > 3, r);
});

test('neue Enums (Fischer, lauter Typ, Touristin, Fragesteller): Accessoires und Extras bleiben erhalten', () => {
  const f = normalizeKunde({ schuhe: 'gummistiefel', accessoire: 'fischkiste', extras: ['schuerze', 'fischgeruch', 'quatsch'] });
  assert.equal(f.schuhe, 'gummistiefel'); assert.equal(f.accessoire, 'fischkiste'); assert.deepEqual(f.extras, ['schuerze', 'fischgeruch']);
  assert.equal(normalizeKunde({ accessoire: 'bierdose' }).accessoire, 'bierdose');
  const t = normalizeKunde({ extras: ['riesenhut', 'faecher', 'kreuzfahrt_baendchen'] });
  assert.deepEqual(t.extras, ['riesenhut', 'faecher', 'kreuzfahrt_baendchen']);
  assert.deepEqual(normalizeKunde({ extras: ['rucksack_leer', 'faehrenticket', 'handschellen_umriss'] }).extras, ['rucksack_leer', 'faehrenticket', 'handschellen_umriss']);
});

test('chooseOption reicht Posten-Optionen an sell durch (doppelt Heat in Sicht)', () => {
  const posten = { x: 0, z: 0, r: 15 };
  const d = advanceDialog(startDialog({ ...zivi, heat: 1 }, initialState()));
  const r = chooseOption(initialState(), d, { ...zivi, heat: 1 }, 'Verkaufen', 0, { posten, pos: { x: 1, z: 1 } });
  assert.equal(r.state.heat, 2);
  const far = chooseOption(initialState(), d, { ...zivi, heat: 1 }, 'Verkaufen', 0, { posten, pos: { x: 50, z: 50 } });
  assert.equal(far.state.heat, 1);
});

test('patrolSpotted: nur beim Verkauf in Sicht Heat +1, gedeckelt bis zur Verhaftung', () => {
  const s = { ...initialState(), heat: 1 };
  assert.equal(patrolSpotted(s).result, 'gesehen'); assert.equal(patrolSpotted(s).state.heat, 1);
  const e = patrolSpotted(s, { selling: true });
  assert.equal(e.result, 'erwischt'); assert.equal(e.state.heat, 2); assert.equal(e.heatPlus, 1);
  const v = patrolSpotted({ ...s, heat: 2 }, { selling: true });
  assert.equal(v.state.heat, MAX_HEAT); assert.ok(isArrested(v.state));
});

test('arrestNow: Verhaftung durch die Streife — Heat voll, Tag verloren, Geld bleibt, Tafel springt auf 0', () => {
  const s = { ...initialState(), geld: 40, heat: 2, tageOhneVorfall: 3 };
  const a = arrestNow(s);
  assert.ok(isArrested(a)); assert.equal(a.geld, 40);
  assert.equal(tafelText(a), 'TAGE OHNE VORFALL: 0');
  assert.equal(newDay(a).tageOhneVorfall, 0); assert.equal(newDay(a).geld, 40);
});

test('Tuk-Tuk F3: zahlt zuerst mit Mangos (Schild), sonst mit Geld, sonst nichts; Ziel Bar; nicht nach Verhaftung', () => {
  const rich = { ...initialState(), mangos: 21, geld: 100 };
  const m = tukTukRide(rich);
  assert.equal(m.result, 'mangos'); assert.equal(m.state.mangos, 1); assert.equal(m.state.geld, 100); assert.equal(m.ziel, 'bar');
  const g = tukTukRide({ ...initialState(), mangos: 3, geld: 45 });
  assert.equal(g.result, 'geld'); assert.equal(g.state.geld, 45 - TUKTUK_PREIS_GELD); assert.equal(g.state.mangos, 3);
  const poor = tukTukRide({ ...initialState(), mangos: 0, geld: 10 });
  assert.equal(poor.result, 'zu_arm'); assert.equal(poor.state.geld, 10);
  assert.equal(tukTukRide({ ...rich, verhaftet: true }).result, 'verhaftet');
  assert.equal(TUKTUK_PREIS_MANGOS, 20);
});

// ---------- Tagesuhr ----------
test('Tagesuhr: ein Tag dauert DAY_LENGTH Sekunden, Phasen in fester Reihenfolge, Uhr 06:00 → 24:00', () => {
  assert.ok(DAY_LENGTH >= 360 && DAY_LENGTH <= 480, '6–8 Minuten');
  let c = initialClock();
  const seen = [];
  for (let t = 0; t < DAY_LENGTH + 1; t += 1) { c = clockStep(c, 1); const ph = phaseFor(c.t01); if (seen[seen.length - 1] !== ph) seen.push(ph); }
  assert.deepEqual(seen, ['morgen', 'mittag', 'abend', 'nacht']);
  close(c.t01, 1, 1e-9, 'läuft nicht über 1 hinaus');
  assert.equal(phaseFor(0), 'morgen'); assert.equal(phaseFor(0.5), 'mittag'); assert.equal(phaseFor(0.7), 'abend'); assert.equal(phaseFor(0.95), 'nacht');
  assert.equal(clockLabel(0), '🌅 06:00'); assert.equal(clockLabel(0.5), '☀️ 15:00'); assert.equal(clockLabel(1), '🌙 24:00');
  assert.ok(clockLabel(0.7).startsWith('🌇'));
});
test('Abend: Hinweis-Flanke, Bar beendet den Tag nur abends/nachts, Nacht-Flanke für die Hängematte', () => {
  assert.equal(abendBeginnt(0.65, 0.67), true); assert.equal(abendBeginnt(0.67, 0.68), false);
  assert.equal(nachtBeginnt(0.89, 0.91), true); assert.equal(nachtBeginnt(0.91, 0.92), false);
  assert.equal(barBeendetTag(0.3), false); assert.equal(barBeendetTag(0.7), true); assert.equal(barBeendetTag(0.95), true);
  const bar = { x: -27, z: 2.5 };
  assert.equal(inBar({ x: -25, z: 4 }, bar), true); assert.equal(inBar({ x: -20, z: 4 }, bar), false);
});
test('Bar-Abend: Barkeeper-Gruß → Mentor-Rückblick nach Lage → letzte Runde; keine Aktion; Texte aus abend_bar robust', () => {
  const A = normalizeAbend({ abend_bar: { barkeeper: { name: 'Nong', gruss: ['Das Übliche?'], letzte_runde: 7 }, mentor: { gut: ['Top, Tag {tag}.'] }, einschlafen: { text: ['Zzz.'] }, sonnenuntergang: ['Bar!'] } });
  assert.equal(A.barkeeper.name, 'Nong'); assert.deepEqual(A.barkeeper.letzte_runde, DEFAULT_ABEND.barkeeper.letzte_runde);
  assert.deepEqual(A.einschlafen, ['Zzz.']); assert.equal(sonnenuntergangLine(A), 'Bar!'); assert.equal(einschlafenLine(A), 'Zzz.');
  const s = sell(initialState(), schluffi).state;
  const f = barAbend(s, A);
  assert.deepEqual(f.map((e) => `${e.wer}:${e.id}`), ['barkeeper:gruss', 'mentor:rueckblick', 'barkeeper:letzte_runde', 'barkeeper:feierabend']);
  assert.ok(f[3].frage && f[3].optionen.length === 2, 'zum Schluss die Frage „Feierabend?“ mit Ja/Noch nicht');
  assert.equal(f[1].text, 'Top, Tag 1.'); assert.equal(f[1].lage, 'gut'); assert.equal(f[1].bark, 'abend');
  assert.ok(!f.some((e) => e.aktion), 'kein Nachschub abends');
  const v = barAbend({ ...s, heat: 3, verhaftet: true }, A);
  assert.equal(v[1].lage, 'verhaftet', 'nach Verhaftung kommentiert der Mentor');
  assert.ok(!v.some((e) => e.frage), 'nach Verhaftung keine Feierabend-Frage');
  assert.ok(guteNacht(A).length > 3);
  assert.equal(zwischenrufLine(A, 0), DEFAULT_ABEND.barkeeper.zwischenruf[0], 'Zwischenruf fällt auf Default zurück');
  assert.deepEqual(normalizeAbend(undefined), normalizeAbend({}));
});
test('Über Nacht kühlt der Heat: Bar −2, Hängematte −1, nie unter 0; nach Verhaftung 0', () => {
  assert.deepEqual(NACHT_ABKUEHLUNG, { bar: 2, haengematte: 1 });
  assert.equal(newDay({ ...initialState(), heat: 2 }).heat, 0);
  assert.equal(newDay({ ...initialState(), heat: 2 }, { nacht: 'haengematte' }).heat, 1);
  assert.equal(newDay({ ...initialState(), heat: 1 }).heat, 0);
  assert.equal(newDay({ ...initialState(), heat: 1, verhaftet: true }, { nacht: 'haengematte' }).heat, 0, 'nach Verhaftung ist der Heat abgegolten');
  assert.equal(newDay({ ...initialState(), heat: MAX_HEAT }, { nacht: 'haengematte' }).heat, 0, 'Heat-Max = Verhaftung');
});

import { STREIFE_P2_AB_TAG, streifeP2Aktiv } from '../js/game.js';
test('Streife P2 läuft erst ab Tag 2', () => {
  assert.equal(STREIFE_P2_AB_TAG, 2);
  assert.equal(streifeP2Aktiv(initialState()), false);
  assert.equal(streifeP2Aktiv(newDay(initialState())), true);
  assert.equal(streifeP2Aktiv({ tag: 5 }), true);
});

import { lichtT, PHASE_AT } from '../js/game.js';
test('lichtT: Spieluhr 06:00–24:00 wird auf die 24-h-Lichtpalette abgebildet', () => {
  assert.equal(lichtT(0), 0.25, '06:00 = Morgen');
  assert.equal(lichtT(1), 1, '24:00 = Mitternacht');
  assert.ok(Math.abs(lichtT(PHASE_AT.abend) - 0.745) < 0.01, 'Abend-Phase beginnt beim Sonnenuntergang der Palette (~0.74)');
  assert.equal(lichtT(-1), 0.25); assert.equal(lichtT(2), 1);
});

import { mergeTexte, mergeKundenKatalog, normalizeOptionen, DEFAULT_OPTIONEN, normalizeTexte as nT, startDialog as sD, advanceDialog as aD, chooseOption as cO, ZIVI_BESCHLAGNAHMT as ZB } from '../js/game.js';
test('normalizeTexte liest die Oberflächen-Texte aus ui{} (Dialog-Beschriftungen, Menü), ältere Dateien oben; Defaults bei Lücken', () => {
  const T = nT({ ui: { dialog: { verkaufen: 'Sell', weiter: 'Next' }, titel: { feierabend: 'Closing time.' }, optionen: { tag_beenden: 'End the day' }, menue: { titel: 'Options' } }, bilanz: ['B {tag}'] });
  assert.equal(T.dialog.verkaufen, 'Sell'); assert.equal(T.dialog.lieber_nicht, 'Lieber nicht', 'fehlender Schlüssel → Default');
  assert.equal(T.titel.feierabend, 'Closing time.'); assert.equal(T.optionen.tag_beenden, 'End the day'); assert.equal(T.menue.titel, 'Options');
  assert.deepEqual(T.bilanz, ['B {tag}'], 'oben liegende Felder gelten weiter');
  assert.equal(nT({ ui: { bilanz: ['U'] }, bilanz: ['T'] }).bilanz[0], 'U', 'ui{} gewinnt');
  // Dialog nutzt die Beschriftungen; die Wahl läuft über den Index, nicht über den Text
  const d = aD(sD(schluffi, initialState(), 0, T), T);
  assert.deepEqual(d.options, ['Sell', 'Mehr verlangen', 'Lieber nicht']);
  const r = cO(initialState(), d, schluffi, 0, 0, undefined, T);
  assert.equal(r.dialog.result, 'kauf'); assert.deepEqual(r.dialog.options, ['Next']);
  assert.equal(cO(initialState(), d, schluffi, 'Sell', 0, undefined, T).dialog.result, 'kauf', 'Beschriftung geht auch');
  assert.equal(cO(initialState(), d, schluffi, 2, 0, undefined, T).dialog.result, 'ablehnung');
});
test('mergeTexte: EN ersetzt Strings und gleich lange String-Listen, Objekte rekursiv; Zahlen/ids/fehlende Zweige bleiben DE', () => {
  const de = { a: 'A', l: ['x', 'y'], n: 3, o: { s: 'S', id: 'k1', t: ['1', '2', '3'] }, steps: [{ id: 's', text: ['T'], menge: 5 }] };
  const en = { a: 'EN-A', l: ['ex', 'why'], n: 9, o: { s: 'EN-S', id: 'zz', t: ['one', 'two'] }, steps: [{ id: 'q', text: ['EN-T'], menge: 7 }] };
  const m = mergeTexte(de, en);
  assert.equal(m.a, 'EN-A'); assert.deepEqual(m.l, ['ex', 'why']); assert.equal(m.n, 3, 'Zahl bleibt DE');
  assert.equal(m.o.s, 'EN-S'); assert.equal(m.o.id, 'k1', 'id bleibt DE'); assert.deepEqual(m.o.t, ['1', '2', '3'], 'Liste anderer Länge → DE');
  assert.deepEqual(m.steps, [{ id: 's', text: ['EN-T'], menge: 5 }], 'Objektlisten gleicher Länge elementweise');
  assert.deepEqual(mergeTexte(de, null), de); assert.deepEqual(mergeTexte(de, { a: '', l: 'nope', o: 'nope' }), de, 'leere/kaputte EN-Knoten → DE');
  assert.equal(mergeTexte('A', undefined), 'A');
});
test('mergeKundenKatalog: EN-Datei keyed by id übersetzt name/typ/tells/saetze, Rest (Schuhe, zahlt, heat) bleibt', () => {
  const de = { kunden: [{ id: 'k1', name: 'Kai', typ: 'Surfer', schuhe: 'barfuss', zahlt: 15, tells: ['a', 'b'], saetze: { gruss: ['G1', 'G2'], kauf: ['K'] } }, { id: 'k2', name: 'B', saetze: { gruss: ['x'] } }] };
  const en = { kunden: { k1: { name: 'Kai', typ: 'Surfer dude', schuhe: 'sneaker', zahlt: 99, tells: ['a-en', 'b-en'], saetze: { gruss: ['G1-en'], kauf: ['K-en'] } } } };
  const m = mergeKundenKatalog(de, en);
  assert.equal(m.kunden[0].typ, 'Surfer dude'); assert.equal(m.kunden[0].schuhe, 'barfuss'); assert.equal(m.kunden[0].zahlt, 15);
  assert.deepEqual(m.kunden[0].tells, ['a-en', 'b-en']); assert.deepEqual(m.kunden[0].saetze.gruss, ['G1', 'G2'], 'Länge passt nicht → DE'); assert.deepEqual(m.kunden[0].saetze.kauf, ['K-en']);
  assert.deepEqual(m.kunden[1], de.kunden[1], 'ohne EN-Eintrag unverändert');
  assert.deepEqual(mergeKundenKatalog(de, null), de); assert.deepEqual(mergeKundenKatalog(de.kunden, en)[1], de.kunden[1], 'nacktes Array geht auch');
});
test('normalizeOptionen: Defaults (DE, Beschlagnahme an, Musik/Ton an), nur gültige Werte übernehmen', () => {
  assert.deepEqual(normalizeOptionen(null), DEFAULT_OPTIONEN);
  assert.equal(DEFAULT_OPTIONEN.beschlagnahme, ZB);
  const o = normalizeOptionen({ sprache: 'en', beschlagnahme: false, musik: 'nein', ton: 0, extra: 1 });
  assert.deepEqual(o, { sprache: 'en', beschlagnahme: false, musik: true, ton: true });
  assert.equal(normalizeOptionen({ sprache: 'fr' }).sprache, 'de');
});

import { toSave, fromSave, hatFortschritt, SAVE_VERSION, SAVE_FELDER } from '../js/game.js';
test('Spielstand: toSave/fromSave sind ein Rundlauf über die Nachtfelder; fremde Version, Müll und Tag < 1 → null', () => {
  const s = { ...initialState(), tag: 4, geld: 140, ware: 3, heat: 2, mangos: 7, tageOhneVorfall: 2, verkauftHeute: 5, status: { k1: 'zufrieden' }, texte: { x: 1 } };
  const j = toSave(s);
  assert.deepEqual(Object.keys(j).sort(), ['version', ...SAVE_FELDER].sort(), 'nur Nachtfelder + Version');
  assert.equal(j.version, SAVE_VERSION);
  const r = fromSave(JSON.parse(JSON.stringify(j)));
  assert.equal(r.tag, 4); assert.equal(r.geld, 140); assert.equal(r.ware, 3); assert.equal(r.heat, 2); assert.equal(r.mangos, 7); assert.equal(r.tageOhneVorfall, 2);
  assert.equal(r.verkauftHeute, 0); assert.deepEqual(r.status, {}); assert.equal(r.texte, undefined, 'Tagesinternes und Texte kommen frisch');
  assert.equal(fromSave(null), null); assert.equal(fromSave('x'), null); assert.equal(fromSave({ version: 99, tag: 2 }), null); assert.equal(fromSave({ version: SAVE_VERSION, tag: 0 }), null);
  assert.equal(fromSave({ version: SAVE_VERSION, tag: 'zwei' }), null);
  // Müll in den Feldern wird geklemmt/ersetzt
  const m = fromSave({ version: SAVE_VERSION, tag: 2, geld: -5, ware: 99, heat: 9, mangos: 'x' });
  assert.equal(m.geld, 0); assert.equal(m.ware, MAX_WARE); assert.equal(m.heat, MAX_HEAT); assert.equal(m.mangos, 0); assert.equal(m.tageOhneVorfall, 0);
  assert.equal(hatFortschritt(toSave(initialState())), false, 'Tag 1 ohne Geld = kein Fortschritt');
  assert.equal(hatFortschritt(toSave({ ...initialState(), geld: 5 })), true);
  assert.equal(hatFortschritt(toSave(newDay(initialState()))), true);
  assert.equal(hatFortschritt(null), false);
  assert.equal(nT(null).start.weiter, 'Weiter');
});

import { normalizeTutorial, tutorialStart, tutorialEvent, tutorialSkip, DEFAULT_TUTORIAL, TUTORIAL_TRIGGER } from '../js/game.js';
test('Tutorial: Schritte folgen den Ereignissen, überspringen Zwischenschritte, ignorieren Unbekanntes, enden mit fertig; überspringbar', () => {
  const T = normalizeTutorial({ tutorial: { ueberspringen: 'Skip', schritte: [
    { id: 'a', trigger: 'tag1_start', ziel: 'huegel', text: 'A' }, { id: 'b', trigger: 'mentor_szene_ende', ziel: 'strand', text: 'B' },
    { id: 'c', trigger: 'kunde_in_reichweite', ziel: 'kunde', text: 'C' }, { id: 'd', trigger: 'erste_ablehnung', ziel: 'nix', optional: true, text: 'D' },
    { id: 'e', trigger: 'sonnenuntergang', ziel: 'bar', text: 'E' }, { id: 'kaputt', trigger: 'gibtsnicht', text: 'X' }, { id: 'leer', trigger: 'bar_betreten', text: '  ' },
  ] } });
  assert.equal(T.ueberspringen, 'Skip'); assert.equal(T.fertig, DEFAULT_TUTORIAL.fertig);
  assert.deepEqual(T.schritte.map((s) => s.id), ['a', 'b', 'c', 'd', 'e'], 'kaputte Schritte fliegen raus');
  assert.equal(T.schritte[3].ziel, null); assert.equal(T.schritte[3].optional, true); assert.equal(T.schritte[0].optional, false);
  let tut = tutorialStart();
  let r = tutorialEvent(tut, T, 'tag1_start'); tut = r.tut;
  assert.equal(r.schritt.id, 'a'); assert.equal(tut.idx, 1);
  r = tutorialEvent(tut, T, 'tag1_start'); assert.equal(r.schritt, null, 'gleiches Ereignis nochmal: nichts'); assert.equal(r.tut.idx, 1);
  r = tutorialEvent(tut, T, 'erster_verkauf'); assert.equal(r.schritt, null, 'Ereignis ohne Schritt: nichts');
  r = tutorialEvent(tut, T, 'kunde_in_reichweite'); tut = r.tut;
  assert.equal(r.schritt.id, 'c', 'Spieler war schneller als der Mentor-Schritt → b übersprungen'); assert.equal(tut.idx, 3);
  r = tutorialEvent(tut, T, 'mentor_szene_ende'); assert.equal(r.schritt, null, 'übersprungene Schritte kommen nicht nach');
  r = tutorialEvent(tut, T, 'sonnenuntergang'); tut = r.tut;
  assert.equal(r.schritt.id, 'e'); assert.equal(r.fertig, true); assert.equal(tut.fertig, true, 'optionales d übersprungen, letzter Schritt → fertig');
  assert.equal(tutorialEvent(tut, T, 'bar_betreten').schritt, null, 'fertig: nichts mehr');
  const sk = tutorialSkip(tutorialStart(), T); assert.equal(sk.fertig, true); assert.equal(tutorialEvent(sk, T, 'tag1_start').schritt, null);
  assert.ok(TUTORIAL_TRIGGER.includes('ware_leer'));
  assert.deepEqual(normalizeTutorial(null).schritte, DEFAULT_TUTORIAL.schritte);
  assert.equal(tutorialEvent(null, T, 'tag1_start').schritt, null);
});

import { normalizeWoche, tagesziel, tagModifikator, zielFortschritt, zielErreicht, wocheStand, finaleStufe, hudZiel, DEFAULT_WOCHE, buyMango as bM, decline as dc, mentorSzene as mS, barAbend as bA } from '../js/game.js';
const WOCHE = normalizeWoche({ woche: { titel: 'Hütte', ziel: { text: 'Z', muenzen: 100, mittel_ab: 60 }, intro: ['I1', 'I2'], zwischenstand: ['Noch {rest}. {tage_rest} Tage.'], tage: [
  { tag: 1, titel: 'Mo', ziel: '2 nur Sandalen', zielwert: { verkauft: 2 }, modifikator: { nur_sandalen: true }, mentor: 'M1', geschafft: 'G1', verfehlt: 'V1' },
  { tag: 2, titel: 'Di', ziel: 'Oma', zielwert: { oma: 1 }, mentor: 'M2', geschafft: 'G2', verfehlt: 'V2' },
  { tag: 3, titel: 'Mi', ziel: 'Mango+Zivi', zielwert: { mango: 1, zivi_abgelehnt: 1, ohne_verhaftung: true, kasse: 50, quatsch: 9, verkauft: 'x' }, modifikator: { heat_start: 1, kunden_faktor: 2 }, mentor: 'M3', geschafft: 'G3', verfehlt: 'V3' },
], finale: { gut: { text: ['Nong legt den Schlüssel hin.', 'Deine.'] }, mittel: { text: ['Fast.'] } } } });
test('normalizeWoche: Tage sortiert, nur bekannte Zielwerte/Modifikatoren, Finale mit Defaults; Defaults ohne Datei', () => {
  assert.equal(WOCHE.tage.length, 3); assert.deepEqual(WOCHE.tage[2].zielwert, { mango: 1, zivi_abgelehnt: 1, kasse: 50, ohne_verhaftung: true });
  assert.deepEqual(WOCHE.tage[2].modifikator, { heat_start: 1, kunden_faktor: 2 }); assert.deepEqual(WOCHE.tage[0].modifikator, { nur_sandalen: true });
  assert.deepEqual(WOCHE.finale.fail.text, DEFAULT_WOCHE.finale.fail.text); assert.equal(WOCHE.ziel.mittel_ab, 60);
  assert.equal(normalizeWoche(null).tage.length, 7); assert.equal(tagesziel(WOCHE, 9), null); assert.deepEqual(tagModifikator(WOCHE, 9), {});
});
test('Tagesziel: verkauft (nur Sandalen), Oma, Mango, Zivi abgelehnt, ohne Verhaftung, Kasse — Fortschritt und erreicht', () => {
  const sand = { ...schluffi, id: 's1' }, sneak = { ...schluffi, id: 'n1', schuhe: 'turnschuh' }, oma = { ...schluffi, id: 'oma_1' };
  let s = initialState();
  s = sell(s, sand).state; s = sell(s, sneak).state;
  const t1 = tagesziel(WOCHE, 1);
  assert.deepEqual(zielFortschritt(s, t1), [{ key: 'verkauft', ist: 1, soll: 2, ok: false }], 'Turnschuh zählt bei nur_sandalen nicht');
  s = sell(s, oma).state;
  assert.equal(zielErreicht(s, t1), true, 'Oma kommt barfuß/in Sandalen: zählt');
  assert.equal(zielErreicht(s, tagesziel(WOCHE, 2)), true, 'oma_1 verkauft');
  const t3 = tagesziel(WOCHE, 3);
  let u = { ...initialState(), geld: 60 };
  assert.equal(zielErreicht(u, t3), false);
  u = bM(u, 10).state; u = dc(u, zivi).state;
  assert.equal(u.mangosHeute, 1); assert.equal(u.zivisAbgelehntHeute, 1);
  assert.equal(zielErreicht(u, t3), true, 'Mango, Zivi abgelehnt, nicht verhaftet, Kasse 50');
  assert.equal(zielErreicht({ ...u, verhaftet: true }, t3), false);
  assert.equal(dc(u, schluffi).state.zivisAbgelehntHeute, 1, 'Nicht-Zivi zählt nicht');
  // Tageswechsel setzt die Tageszähler zurück, Modifikator heat_start greift
  const n = newDay(u, { modifikator: tagModifikator(WOCHE, 3) });
  assert.deepEqual([n.verkaeufeHeute, n.zivisAbgelehntHeute, n.mangosHeute], [[], 0, 0]); assert.equal(n.heat, 1, 'Razzia: Heat startet bei 1');
  assert.equal(newDay({ ...u, heat: 3, verhaftet: true }, { modifikator: { heat_start: 1 } }).heat, 1);
  assert.equal(newDay(u, { modifikator: { heat_start: 9 } }).heat, MAX_HEAT - 1, 'nie direkt verhaftet aufwachen');
});
test('Woche: Zwischenstand, Finale-Stufe, HUD-Zeile; Mentor morgens Intro+Tagesziel, Bar abends geschafft/verfehlt + Finale am letzten Tag', () => {
  const s = { ...initialState(), geld: 70, tag: 2 };
  assert.deepEqual(wocheStand(s, WOCHE), { rest: 30, tage_rest: 1, vorbei: false });
  assert.equal(finaleStufe(s, WOCHE), 'mittel'); assert.equal(finaleStufe({ ...s, geld: 100 }, WOCHE), 'gut'); assert.equal(finaleStufe({ ...s, geld: 5 }, WOCHE), 'fail');
  const h = hudZiel(s, WOCHE);
  assert.equal(h.titel, 'Di'); assert.equal(h.fortschritt, '0/1'); assert.equal(h.woche, 'Noch 30. 1 Tage.'); assert.equal(h.erreicht, false);
  assert.equal(hudZiel({ ...s, tag: 4 }, WOCHE), null, 'Woche vorbei: keine Zeile');
  assert.equal(hudZiel({ ...initialState(), tag: 3, verhaftet: true }, WOCHE).fortschritt.includes('✗'), true);
  // Mentor morgens
  const m1 = mS({ ...initialState(), ware: 0 }, SZ, 0, { woche: WOCHE }).map((e) => e.id);
  assert.deepEqual(m1.slice(0, 7), ['ankunft', 'lektion:einleitung', 'lektion:regel', 'lektion:pointe', 'intro:0', 'intro:1', 'tagesziel']);
  const m2 = mS({ ...initialState(), ware: 0, tag: 2 }, SZ, 0, { woche: WOCHE });
  assert.ok(!m2.some((e) => e.id.startsWith('intro:'))); assert.equal(m2.find((e) => e.id === 'tagesziel').text, 'M2');
  assert.ok(!mS({ ...initialState(), ware: 0 }, SZ, 0).some((e) => e.id === 'tagesziel'), 'ohne Woche wie bisher');
  // Bar abends
  const b2 = bA(sell({ ...initialState(), tag: 2 }, { ...schluffi, id: 'oma_1' }).state, DEFAULT_ABEND, 0, { woche: WOCHE });
  assert.equal(b2.find((e) => e.id === 'tagesziel').text, 'G2'); assert.ok(!b2.some((e) => e.id.startsWith('finale')));
  const b3 = bA({ ...initialState(), tag: 3, geld: 100 }, DEFAULT_ABEND, 0, { woche: WOCHE });
  assert.equal(b3.find((e) => e.id === 'tagesziel').text, 'V3');
  assert.deepEqual(b3.filter((e) => e.id.startsWith('finale')).map((e) => `${e.wer}:${e.text}`), ['barkeeper:Nong legt den Schlüssel hin.', 'mentor:Deine.']);
  assert.ok(!bA({ ...initialState(), tag: 3, verhaftet: true, heat: 3 }, DEFAULT_ABEND, 0, { woche: WOCHE }).some((e) => e.id === 'tagesziel'), 'nach Verhaftung kein Tagesziel-Satz');
  // Spielstand nimmt das Finale mit
  assert.equal(fromSave(toSave({ ...s, finale: 'gut' })).finale, 'gut'); assert.equal(fromSave(toSave({ ...s, finale: 'x' })).finale, null);
});

import { verhandeln, verhandlungsPreis, VERHANDLUNG_AUFSCHLAG, normalizeKunde as nK, kundeStatus } from '../js/game.js';
test('Preise je Kundschaft: zahlt aus kunden.json; „Mehr verlangen“ = +50 % mit Risiko (feilschen), Zivi reagiert wie beim Verkauf', () => {
  const k = nK({ id: 'oma_1', zahlt: 60, feilschen: 0.7, saetze: { kauf: ['K'], ablehnung: ['A'] } });
  assert.equal(k.feilschen, 0.7); assert.equal(nK({ id: 'x' }).feilschen, 0.5); assert.equal(nK({ id: 'y', feilschen: 7 }).feilschen, 1);
  assert.equal(verhandlungsPreis(k), 90); assert.equal(VERHANDLUNG_AUFSCHLAG, 0.5);
  const s = initialState();
  const ja = verhandeln(s, k, 0, { wuerfel: 0.2 });
  assert.equal(ja.result, 'kauf'); assert.equal(ja.teuer, true); assert.equal(ja.state.geld, 90); assert.equal(ja.state.ware, START_WARE - 1);
  assert.ok(ja.text.startsWith('Okay') && ja.text.endsWith('K'), 'Verhandlungssatz + Kaufsatz');
  assert.equal(ja.state.verkaeufeHeute[0].preis, 90);
  const nein = verhandeln(s, k, 0, { wuerfel: 0.9 });
  assert.equal(nein.result, 'weg'); assert.equal(nein.state.geld, 0); assert.equal(nein.state.ware, START_WARE, 'keine Ware weg');
  assert.equal(kundeStatus(nein.state, 'oma_1'), 'abgelehnt', 'er ist weg, heute kein zweiter Versuch');
  assert.equal(sell(nein.state, k).result, 'schon_erledigt');
  const g = verhandeln(s, zivi, 0, { wuerfel: 0.1 });
  assert.equal(g.result, 'reveal', 'Zivi: Preis egal'); assert.equal(g.gier, true);
  assert.equal(g.state.heat, sell(s, zivi).state.heat + 1, 'Gier-Falle: ein Heat mehr als beim normalen Verkauf'); assert.equal(g.heatPlus, g.state.heat);
  assert.equal(verhandeln({ ...s, heat: 2 }, zivi, 0, { wuerfel: 0.9 }).state.heat, MAX_HEAT, 'gedeckelt, Verhaftung');
  assert.equal(verhandeln({ ...s, heat: 2 }, zivi, 0, { wuerfel: 0.9 }).state.verhaftet, true);
  assert.equal(verhandeln({ ...s, ware: 0 }, k, 0, { wuerfel: 0.1 }).result, 'keine_ware');
  // über den Dialog: Option 1 = mehr verlangen, Option 2 = lieber nicht
  const d = advanceDialog(startDialog(k, s, 0));
  assert.deepEqual(d.options, ['Verkaufen', 'Mehr verlangen', 'Lieber nicht']);
  const r1 = chooseOption(s, d, k, 1, 0, { wuerfel: 0.1 });
  assert.equal(r1.dialog.result, 'kauf'); assert.equal(r1.dialog.teuer, true); assert.equal(r1.dialog.geldPlus, 90);
  assert.equal(chooseOption(s, d, k, 1, 0, { wuerfel: 0.95 }).dialog.result, 'weg');
  assert.equal(chooseOption(s, d, k, 2, 0).dialog.result, 'ablehnung');
  assert.equal(chooseOption(s, d, k, 0, 0).dialog.geldPlus, 60, 'normaler Verkauf zum Kundenpreis');
  assert.equal(chooseOption(s, d, k, 'Lieber nicht', 0).dialog.result, 'ablehnung', 'Beschriftung geht weiter');
});

import { wochenziel, kalibriereWoche, neueWoche, finaleKarte, WOCHENZIEL, KUNDEN_PRO_TAG as KPT } from '../js/game.js';
import { readFileSync } from 'node:fs';
test('Wochenziel-Kalibrierung: Erlös = Σ Tage (Preise der Harmlosen × Quote − Mango), Ziel = 70 % gerundet auf 50, mittel_ab 60 %', () => {
  const kat = normalizeKatalog({ kunden: [
    { id: 'a', zahlt: 20 }, { id: 'b', zahlt: 30 }, { id: 'c', zahlt: 40 }, { id: 'd', zahlt: 10 }, { id: 'e', zahlt: 50 },
    { id: 'z1', zivi: true, zahlt: 70 }, { id: 'z2', zivi: true, zahlt: 70 },
  ] });
  const W = normalizeWoche({ woche: { tage: [{ tag: 1 }, { tag: 2, modifikator: { kunden_faktor: 2 } }] } });
  // Tag 1: 7 gezogen = alle 5 Harmlosen (150) + 2 Zivis; Tag 2 (×2): wieder alle 5 Harmlosen → 2 × (150 × 0.9 − 10) = 250
  const z = wochenziel(kat, W);
  assert.equal(z.erloes, 250); assert.equal(z.muenzen, 200, '70 % von 250 = 175 → 200'); assert.equal(z.mittel_ab, 100, '60 % von 200 = 120 → 100');
  assert.equal(WOCHENZIEL.anteil, 0.7);
  const K = kalibriereWoche(normalizeWoche({ woche: { ziel: { text: 'Bis Sonntag {muenzen} Münzen.', muenzen: 1000 }, intro: ['{muenzen}!'], tage: W.tage } }), kat);
  assert.equal(K.ziel.muenzen, 200); assert.equal(K.ziel.mittel_ab, 100); assert.equal(K.ziel.text, 'Bis Sonntag 200 Münzen.'); assert.equal(K.intro[0], '200!');
  assert.equal(kalibriereWoche(W, []).ziel.muenzen, W.ziel.muenzen, 'ohne Katalog unverändert');
  const K2 = kalibriereWoche(normalizeWoche({ woche: { tage: [{ tag: 1, ziel: 'Bis abends {muenzen}', zielwert: { kasse: 1000 } }, { tag: 2, zielwert: { verkauft: 3 } }] } }), kat);
  assert.equal(K2.tage[0].zielwert.kasse, K2.ziel.muenzen, 'Kassen-Tagesziel folgt der Kalibrierung'); assert.equal(K2.tage[0].ziel, `Bis abends ${K2.ziel.muenzen}`); assert.deepEqual(K2.tage[1].zielwert, { verkauft: 3 });
  // mit der echten Kundschaft: Rechnung nachvollziehbar und im erwarteten Rahmen
  const echt = normalizeKatalog(JSON.parse(readFileSync(new URL('../data/kunden.json', import.meta.url), 'utf8')));
  const W7 = normalizeWoche(JSON.parse(readFileSync(new URL('../data/texte.json', import.meta.url), 'utf8')));
  const e = wochenziel(echt, W7);
  assert.ok(e.muenzen >= 400 && e.muenzen <= 1000, `Ziel ${e.muenzen} (Erlös ${e.erloes})`);
  assert.equal(e.muenzen % 50, 0); assert.ok(e.mittel_ab < e.muenzen);
});
test('Neue Woche und Finale-Karte: Start auf Tag 1 mit Wochenzähler +1; bei fail steht „Neue Woche“ vorn; Spielstand nimmt woche mit', () => {
  const s = { ...initialState(), tag: 7, geld: 730, ware: 9, heat: 2, finale: 'gut', woche: 1, tageOhneVorfall: 4 };
  const n = neueWoche(s);
  assert.equal(n.tag, 1); assert.equal(n.geld, 0); assert.equal(n.ware, START_WARE); assert.equal(n.heat, 0); assert.equal(n.finale, null); assert.equal(n.woche, 2); assert.equal(n.tageOhneVorfall, 4);
  const W = normalizeWoche(null);
  const kg = finaleKarte(s, W);
  assert.deepEqual(kg.buttons, ['Weiterspielen', 'Neue Woche']); assert.equal(kg.neueWocheIdx, 1); assert.equal(kg.stufe, 'gut');
  const kf = finaleKarte({ ...s, geld: 10, finale: 'fail' }, W);
  assert.deepEqual(kf.buttons, ['Neue Woche', 'Weiterspielen']); assert.equal(kf.neueWocheIdx, 0);
  assert.ok(kf.zeilen[1].includes('10') && kf.zeilen[1].includes(String(W.ziel.muenzen)));
  assert.equal(finaleKarte({ ...s, finale: null, geld: 650 }, W).stufe, 'mittel', 'ohne gesetzte Stufe nach Kasse');
  assert.equal(fromSave(toSave(n)).woche, 2); assert.equal(fromSave(toSave({ ...s, woche: 'x' })).woche, 1);
  assert.equal(nT(null).hud.tag, 'Tag'); assert.equal(nT({ ui: { hud: { tag: 'Day' } } }).hud.tag, 'Day');
});

import { normalizeEreignisse, ereignisFuerTag, tagesWuerfel, ereignisKundenFaktor, ereignisZiviExtra, DEFAULT_EREIGNISSE, EREIGNIS_CHANCE } from '../js/game.js';
test('Ereignisse: deterministisch je Seed/Woche/Tag, nie Tag 1 oder Tutorial, gewichtet, ca. 60 % der Tage; Normalisierung robust', () => {
  const E = normalizeEreignisse({ ereignisse: [
    { id: 'a', titel: 'A', ankuendigung: 'A!', wirkung: { kunden_faktor: 0.5, quatsch: 9, heat: '1' }, gewicht: 3 },
    { id: 'b', titel: 'B', wirkung: { ware: -1 }, ab_tag: 1 }, { id: '', titel: 'kaputt' }, { titel: 'ohne id' },
  ] });
  assert.deepEqual(E.map((e) => e.id), ['a', 'b']); assert.deepEqual(E[0].wirkung, { kunden_faktor: 0.5 }); assert.equal(E[0].gewicht, 3);
  assert.equal(E[1].ab_tag, 2, 'nie vor Tag 2'); assert.equal(E[1].hinweis, 'B', 'Hinweis fällt auf den Titel zurück'); assert.equal(E[1].abends, null);
  assert.deepEqual(normalizeEreignisse(null), normalizeEreignisse({ ereignisse: DEFAULT_EREIGNISSE }));
  assert.equal(E[1].hinweis, 'B'); assert.equal(E[0].abendsWer, 'mentor'); assert.deepEqual(normalizeEreignisse({ ereignisse: [{ id: '' }] }).map((e) => e.id), DEFAULT_EREIGNISSE.map((e) => e.id));
  assert.equal(ereignisFuerTag(E, { seed: 7, woche: 1, tag: 1 }), null, 'Tag 1 nie');
  assert.equal(ereignisFuerTag(E, { seed: 7, woche: 1, tag: 3, tutorial: true }), null, 'Tutorial-Tag nie');
  const a = ereignisFuerTag(E, { seed: 7, woche: 1, tag: 3 }), b = ereignisFuerTag(E, { seed: 7, woche: 1, tag: 3 });
  assert.deepEqual(a, b, 'deterministisch');
  // über viele Tage/Seeds: Trefferquote nahe der Chance, Gewichte spürbar (a dreimal so oft wie b)
  let hits = 0, na = 0, nb = 0, N = 0;
  for (let seed = 1; seed <= 60; seed++) for (let tag = 2; tag <= 8; tag++) { N++; const e = ereignisFuerTag(E, { seed, woche: 1, tag }); if (e) { hits++; if (e.id === 'a') na++; else nb++; } }
  assert.ok(Math.abs(hits / N - EREIGNIS_CHANCE) < 0.08, `Quote ${(hits / N).toFixed(2)}`);
  assert.ok(na > nb * 2, `Gewichte: a ${na}, b ${nb}`);
  assert.equal(ereignisFuerTag(E, { seed: 7, woche: 1, tag: 3, chance: 0 }), null); assert.ok(ereignisFuerTag(E, { seed: 7, woche: 1, tag: 3, chance: 1 }));
  assert.notEqual(tagesWuerfel(1, 1, 2), tagesWuerfel(1, 2, 2), 'andere Woche, anderer Wurf');
  assert.ok(tagesWuerfel(5, 1, 3) >= 0 && tagesWuerfel(5, 1, 3) < 1);
  assert.equal(ereignisKundenFaktor(E[0]), 0.5); assert.equal(ereignisKundenFaktor(null), 1); assert.equal(ereignisZiviExtra({ wirkung: { zivi_extra: 1.4 } }), 1); assert.equal(ereignisZiviExtra(E[1]), 0);
});
test('Ereignis-Wirkung: Heat/Ware am Morgen, Preisfaktor beim Verkauf, Mentor kündigt an, Bar kommentiert abends; Spielstand trägt den Seed', () => {
  const E = normalizeEreignisse(null);
  const moewe = E.find((e) => e.id === 'moewe'), markt = E.find((e) => e.id === 'markttag'), geruecht = E.find((e) => e.id === 'razzia_geruecht'), regen = E.find((e) => e.id === 'regen');
  const s = { ...initialState(), ware: 3, heat: 0 };
  assert.equal(newDay(s, { ereignis: moewe }).ware, 2, 'Möwe klaut einen Beutel'); assert.equal(newDay({ ...s, ware: 0 }, { ereignis: moewe }).ware, 0);
  assert.equal(newDay(s, { ereignis: geruecht }).heat, 1); assert.equal(newDay({ ...s, heat: 2 }, { nacht: 'haengematte', ereignis: geruecht }).heat, 2, 'Nachtkühlung zuerst, dann +1');
  assert.equal(newDay(s, { modifikator: { heat_start: 2 }, ereignis: geruecht }).heat, MAX_HEAT - 1, 'nie direkt verhaftet');
  const m = newDay(s, { ereignis: markt });
  assert.equal(m.ereignis.id, 'markttag'); assert.equal(sell(m, schluffi).state.geld, 26, '20 × 1,3 = 26');
  assert.equal(sell(newDay(s), schluffi).state.geld, 20, 'ohne Ereignis normaler Preis');
  assert.equal(sell(m, { ...schluffi, id: 'x' }, 0, { preis: 30 }).state.geld, 39, 'Verhandlungspreis × Faktor');
  const r = newDay(s, { ereignis: regen });
  assert.ok(mS({ ...r, ware: 0 }, SZ, 0, { woche: normalizeWoche(null) }).some((e) => e.id === 'ereignis' && e.text === regen.ankuendigung), 'Mentor kündigt an');
  assert.ok(!mS({ ...newDay(s), ware: 0 }, SZ, 0).some((e) => e.id === 'ereignis'));
  assert.ok(bA(r, DEFAULT_ABEND, 0).some((e) => e.id === 'ereignis' && e.text === regen.abends), 'abends an der Bar');
  assert.ok(!bA(m, DEFAULT_ABEND, 0).some((e) => e.id === 'ereignis'), 'ohne abends-Satz nichts');
  assert.equal(fromSave(toSave({ ...s, seed: 4242 })).seed, 4242); assert.equal(fromSave(toSave({ ...s, seed: 'x' })).seed, 1);
  assert.equal(fromSave(toSave(r)).ereignis, null, 'Ereignis ist tagesintern, wird morgens neu gewürfelt');
});

import { ACCESSORIES as ACC, EXTRAS as EXT, SPAWNS as SPW } from '../js/game.js';
test('Runde-10-Kunden: neue Accessoires/Extras/Spawns und Felder figuren/zahlt_in überleben die Normalisierung', () => {
  const nok = nK({ id: 'bauer_nok', accessoire: 'kegelhut', extras: ['schlamm_bis_knie', 'reissack', 'hose_hochgekrempelt', 'quatsch'], spawn: 'K7', zahlt_in: 'reis', zahlt: 25 });
  assert.equal(nok.accessoire, 'kegelhut'); assert.deepEqual(nok.extras, ['schlamm_bis_knie', 'reissack', 'hose_hochgekrempelt']); assert.equal(nok.spawn, 'K7'); assert.equal(nok.zahlt_in, 'reis'); assert.equal(nok.figuren, 1);
  const paar = nK({ id: 'paar_1', figuren: 2, extras: ['partnerlook', 'just_married_cap', 'blumenkranz'], spawn: 'K6' });
  assert.equal(paar.figuren, 2); assert.equal(paar.extras.length, 3); assert.equal(nK({ id: 'x', figuren: 7 }).figuren, 1);
  const z5 = nK({ id: 'zivi_5', zivi: true, accessoire: 'sonnenbrille', extras: ['muetzen_streifen', 'pfeife_am_band', 'haltung_gerade'], spawn: 'K6' });
  assert.deepEqual(z5.extras, ['muetzen_streifen', 'pfeife_am_band', 'haltung_gerade']);
  assert.equal(nK({ id: 'k', accessoire: 'helm_delle', extras: ['kokosnuss', 'seil_um_huefte', 'pflaster_stirn'], spawn: 'K8' }).spawn, 'K8');
  assert.ok(ACC.includes('kegelhut') && EXT.includes('blumenkranz') && SPW.includes('K8'));
  assert.equal(nK({ id: 'y', zahlt_in: 3 }).zahlt_in, null);
});

import { heatCap, kundenFuerTag, figurDef, patrolSpotted as pS } from '../js/game.js';
test('Ereignisse nach Content-Schema: liste[], ware_minus, heat_max, tells_verdeckt, kunden_typen_plus, spawn_aus, kommentar{wer}; gewicht 0 nur per Skript', () => {
  const E = normalizeEreignisse({ ereignisse: { _ablauf: 'doc', liste: ['kaputt',
    { id: 'moewe_klaut', gewicht: 3, zeitpunkt: 'mittag', wirkung: { ware_minus: 1 }, ankuendigung: 'Die Möwe. Frag nicht.', kommentar: { wer: 'nong', text: 'Chef war das.' } },
    { id: 'regen', gewicht: 3, zeitpunkt: 'mittag', dauer_s: 120, wirkung: { unter_dach: true, tells_verdeckt: ['schuhe', 'quatsch'] }, ankuendigung: 'Regen!', ende: 'Vorbei.', kommentar: { wer: 'mentor', text: 'Hemden lesen.' } },
    { id: 'schiff', gewicht: 2, wirkung: { kunden_faktor: 1.5, kunden_typen_plus: ['touristin_1', 'paar_1'] } },
    { id: 'pong', gewicht: 1, wirkung: { heat_max: 1, preis_faktor: 1.0 } },
    { id: 'faehre', gewicht: 0, wirkung: { spawn_aus: ['K1'], kunden_faktor: 0.8 } },
  ] } });
  assert.deepEqual(E.map((e) => e.id), ['moewe_klaut', 'regen', 'schiff', 'pong', 'faehre']);
  assert.deepEqual(E[0].wirkung, { ware: -1 }); assert.equal(E[0].abends, 'Chef war das.'); assert.equal(E[0].abendsWer, 'barkeeper'); assert.equal(E[0].hinweis, 'Die Möwe.'); assert.equal(E[0].zeitpunkt, 'mittag');
  assert.deepEqual(E[1].wirkung, { tells_verdeckt: ['schuhe'] }); assert.equal(E[1].ende, 'Vorbei.'); assert.equal(E[1].dauer_s, 120); assert.equal(E[1].abendsWer, 'mentor');
  assert.deepEqual(E[2].wirkung, { kunden_faktor: 1.5, kunden_typen_plus: ['touristin_1', 'paar_1'] });
  assert.deepEqual(E[3].wirkung, { preis_faktor: 1, heat_max: 1 }); assert.deepEqual(E[4].wirkung, { kunden_faktor: 0.8, spawn_aus: ['K1'] });
  // gewicht 0 wird nie gewürfelt
  for (let seed = 1; seed <= 40; seed++) for (let tag = 2; tag <= 8; tag++) { const e = ereignisFuerTag(E, { seed, tag }); assert.ok(!e || e.id !== 'faehre'); }
  // Heat-Deckel: Zivi-Verkauf, Streife und Gier steigen nicht über 1, was drüber ist, bleibt
  const pong = newDay(initialState(), { ereignis: E[3] });
  assert.equal(sell(pong, zivi).state.heat, 1); assert.equal(sell({ ...pong, heat: 1 }, zivi).state.heat, 1); assert.equal(sell({ ...pong, heat: 2 }, zivi).state.heat, 2);
  assert.equal(pS({ ...pong, heat: 1 }, { selling: true }).state.heat, 1); assert.equal(verhandeln(pong, zivi, 0, { wuerfel: 0.1 }).state.heat, 1);
  assert.equal(sell(newDay(initialState()), zivi).state.heat, 2, 'ohne Deckel wie bisher'); assert.equal(heatCap({ heat: 0 }, 3), 3);
  // Kundschaft des Tages: Fähre fällt aus → keine K1-Gäste; Schiff → Touristin und Paar zusätzlich
  const kat = normalizeKatalog({ kunden: [{ id: 'a', spawn: 'K1' }, { id: 'b', spawn: 'K2' }, { id: 'c' }, { id: 'touristin_1', spawn: 'K1' }, { id: 'paar_1' }, { id: 'z', zivi: true }] });
  const ohne = kundenFuerTag(kat, 7, 1, 2, E[4]);
  assert.ok(ohne.every((k) => k.spawn !== 'K1'), 'ohne Fähre keine K1-Gäste'); assert.ok(ohne.length >= 3);
  const schiff = kundenFuerTag(kat, 2, 1, 2, E[2]);
  assert.ok(schiff.some((k) => k.id === 'touristin_1') && schiff.some((k) => k.id === 'paar_1'), 'Schiff bringt die Typen zusätzlich');
  assert.equal(new Set(schiff.map((k) => k.id)).size, schiff.length, 'keine Doppelten');
  assert.deepEqual(kundenFuerTag(kat, 3, 1, 2, null).map((k) => k.id), pickKunden(kat, 3, 1, 2).map((k) => k.id), 'ohne Ereignis wie pickKunden');
  // Regen: Figur in Gummistiefeln, Logik am Original
  const d = normalizeKunde({ id: 's', schuhe: 'sandale', zahlt: 30 });
  assert.equal(figurDef(d, E[1]).schuhe, 'gummistiefel'); assert.equal(figurDef(d, E[0]).schuhe, 'sandale'); assert.equal(figurDef(d, null), d); assert.equal(d.schuhe, 'sandale');
  // Datei-Stand: Content-Liste lädt und hat die Pflichtfelder
  const echt = normalizeEreignisse(JSON.parse(readFileSync(new URL('../data/texte.json', import.meta.url), 'utf8')));
  assert.ok(echt.length >= 5 && echt.every((e) => e.id && e.ankuendigung));
});

import { ereignisFenster, ereignisAktiv, wirkungAktiv, DAY_LENGTH as DL, PHASE_AT as PA } from '../js/game.js';
test('Ereignis-Zeitfenster: morgen = ganzer Tag, mittag + 120 s = Fenster; Wirkung gilt nur im Fenster; zivi_extra darf negativ sein', () => {
  const E = normalizeEreignisse({ ereignisse: [
    { id: 'regen', zeitpunkt: 'mittag', dauer_s: 120, wirkung: { tells_verdeckt: ['schuhe'] } },
    { id: 'strom', zeitpunkt: 'morgen', dauer_s: 0, wirkung: { preis_faktor: 1.2 } },
    { id: 'faehre', wirkung: { zivi_extra: -1 } }, { id: 'abend', zeitpunkt: 'abend', dauer_s: 0, wirkung: { heat_max: 1 } },
  ] });
  assert.deepEqual(ereignisFenster(E[1]), { start: 0, ende: 1 });
  const f = ereignisFenster(E[0]); assert.equal(f.start, PA.mittag); assert.ok(Math.abs(f.ende - (PA.mittag + 120 / DL)) < 1e-9);
  assert.equal(ereignisAktiv(E[0], 0.1), false); assert.equal(ereignisAktiv(E[0], PA.mittag + 0.1), true); assert.equal(ereignisAktiv(E[0], 0.9), false);
  assert.deepEqual(ereignisFenster(E[3]), { start: PA.abend, ende: 1 }); assert.equal(ereignisFenster(null), null);
  // Zustand: morgen-Ereignis sofort aktiv, mittag-Ereignis erst, wenn der Loop es startet
  const strom = newDay(initialState(), { ereignis: E[1] }), regen = newDay(initialState(), { ereignis: E[0] });
  assert.equal(strom.ereignisAktiv, true); assert.equal(regen.ereignisAktiv, false);
  assert.equal(sell(strom, schluffi).state.geld, 24); assert.equal(sell({ ...strom, ereignisAktiv: false }, schluffi).state.geld, 20, 'außerhalb des Fensters normaler Preis');
  assert.deepEqual(wirkungAktiv(regen), {}); assert.deepEqual(wirkungAktiv({ ...regen, ereignisAktiv: true }), { tells_verdeckt: ['schuhe'] });
  assert.equal(heatCap({ ...newDay(initialState(), { ereignis: E[3] }), ereignisAktiv: false }, 3), 3, 'Deckel erst abends');
  assert.equal(ereignisZiviExtra(E[2]), -1);
  const kat = normalizeKatalog({ kunden: [{ id: 'a' }, { id: 'b' }, { id: 'z1', zivi: true }, { id: 'z2', zivi: true }] });
  assert.equal(pickKunden(kat, 4, Math.max(0, 2 + ereignisZiviExtra(E[2])), 2).filter((k) => k.zivi).length >= 1, true);
});
