// Tests der Ambient-Logik: node --test spiel/test/
import test from 'node:test';
import assert from 'node:assert/strict';
import { handtuchPlan, HANDTUCH_FARBEN } from '../js/ambient-logik.js';

test('Handtuchplan: deterministisch je Tag, Liegen-Indizes gültig, nie alle und nie keine belegt', () => {
  for (let tag = 1; tag <= 7; tag++) {
    const a = handtuchPlan(4, tag), b = handtuchPlan(4, tag);
    assert.deepEqual(a, b, 'gleicher Tag, gleicher Plan');
    assert.ok(a.length >= 1 && a.length < 4, `Tag ${tag}: ${a.length} von 4 belegt`);
    for (const e of a) { assert.ok(e.liege >= 0 && e.liege < 4); assert.ok(HANDTUCH_FARBEN.includes(e.farben)); assert.ok(e.wurfZeit > 0); }
    const zeiten = a.map((e) => e.wurfZeit); assert.deepEqual(zeiten, [...zeiten].sort((x, y) => x - y), 'Würfe in Reihenfolge');
  }
  assert.notDeepEqual(handtuchPlan(4, 1), handtuchPlan(4, 2), 'andere Tage, andere Pläne');
});
