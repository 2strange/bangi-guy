// Tests der Mechanik v0: node --test "spiel/test/**/*.test.js"
import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  initialState, normalizeKunde, normalizeKatalog, pickLine, sell, decline, isArrested, newDay, heatLabel,
  startDialog, advanceDialog, chooseOption, moodFor, nearestKunde, wanderStep, inspectCamera, kundeLookYaw,
  START_WARE, MAX_HEAT, pickKunden, idSeed,
  DEFAULT_TEXTE, normalizeTexte, fillText, dayReport, soldOutDialog, isSoldOut, assignOutfits, outfitKey, variantCount, lageFor, dayEndCard, normalizeGags, gagFor, nextIdleGagDelay, ZIVI_BESCHLAGNAHMT,
  normalizeStimmen, stimmeSlug, barksFor, pickBark,
  normalizeMentorSzene, mentorSzene, finishMentor, applyMentorAktion, mentorBesucht,
  POSTEN_DEFAULT, inPostenSicht, buyMango, giveMango, mangoAbgegeben, tafelText, MANGO_PREIS,
  normalizePosten7, mangoText, pongText, tafelLines, DEFAULT_POSTEN7,
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
  assert.deepEqual(c.zeilen, ['Tag 1: 1 Beutel weg, 20 Münzen dazu.', 'Kasse: 20 · Heat: ···']);
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
  assert.equal(n.ware, 5, 'auf 5 aufgefüllt'); assert.equal(n.heat, 1, 'Heat −1'); assert.equal(n.mentorTag, 1);
  assert.ok(mentorBesucht(n));
  // zweiter Besuch am selben Tag: nur schon_geholt, keine Aktion
  const f2 = mentorSzene(n, SZ);
  assert.deepEqual(f2.map((e) => e.id), ['schon_geholt']);
  assert.equal(finishMentor(n, f2).ware, 5);
  // neuer Tag: wieder besuchbar, Lektion 2; Tag 3 ohne Weisheit → ausgelernt
  const d2 = { ...newDay(n), ware: 0 };
  assert.equal(mentorBesucht(d2), false);
  assert.equal(mentorSzene(d2, SZ)[2].text, 'R2');
  const d3 = { ...newDay(d2), ware: 0 };
  assert.deepEqual(mentorSzene(d3, SZ).map((e) => e.id), ['ankunft', 'ausgelernt', 'nachschub', 'abschied']);
});

test('mentorSzene: volle Tasche → nur „voll“; Aktionen füllen nur auf, Heat nicht unter 0; Defaults bei fehlender Datei', () => {
  const s = { ...initialState(), ware: START_WARE };
  assert.deepEqual(mentorSzene(s, SZ).map((e) => e.id), ['voll']);
  assert.equal(applyMentorAktion({ ...s, ware: 3 }, 'ware_auffuellen', 5).ware, 5);
  assert.equal(applyMentorAktion({ ...s, ware: 7 }, 'ware_auffuellen', 5).ware, 7, 'nicht kürzen');
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
