// szenen.js — Ambient-Szenen (data/szenen.json): kleine Alltags-Szenen, die in einem Uhrzeit-Fenster an einem Ort laufen
// (Schrittfolge mit Figuren, Blasen, Sounds) und aufs Spiel wirken (Pong schläft, Streife stolpert, Verstecke …).
// Reine Logik: Tagesauswahl (Chance aus dem Seed), aktive Szenen zur Uhrzeit, fällige Schritte, gesammelte Wirkung.
// Darstellung (Figuren, Blasen, Sounds) in main.js.
import { tagesWuerfel, DAY_LENGTH } from './game.js';

export const SZENE_AKTIONEN = ['pose', 'sag', 'bark', 'geh', 'warte', 'sound'];

/** "13:00"/"13:30" (Spieluhr 06–24 Uhr) → Uhr-t 0…1; Zahlen 0…1 direkt, größere als Stunde */
export function zeitT(v) {
  if (Number.isFinite(v)) return v <= 1 ? Math.max(0, v) : Math.max(0, Math.min(1, (v - 6) / 18));
  const m = /^(\d{1,2})(?::(\d{2}))?$/.exec(String(v || '').trim());
  if (!m) return null;
  return Math.max(0, Math.min(1, (Number(m[1]) + Number(m[2] || 0) / 60 - 6) / 18));
}
const str = (v, d) => (typeof v === 'string' && v.trim() ? v : d);
const strList = (v) => (Array.isArray(v) ? v.filter((x) => typeof x === 'string' && x.trim()) : []);
/** folge: Objekt { schluessel: true } oder ein Schlüssel-String → { schluessel: true }; sonst null */
const folgeOk = (f) => (typeof f === 'string' && f.trim() ? { [f]: true } : f && typeof f === 'object' && Object.values(f).some((v) => v === true) ? Object.fromEntries(Object.entries(f).filter(([, v]) => v === true)) : null);
const ortOk = (o) => (typeof o === 'string' && o.trim() ? o : o && typeof o === 'object' && Number.isFinite(o.x) && Number.isFinite(o.z) ? { x: o.x, z: o.z, r: Number.isFinite(o.r) ? o.r : 5 } : null);

export const DEFAULT_SZENEN = [
  {
    id: 'pong_mittag', titel: 'Pongs Mittagsschlaf', fenster: { von: '13:00', bis: '14:00' }, chance: 1, ab_tag: 2, ort: 'posten',
    figuren: [{ slug: 'pong', start: 'posten', stimme: 'pong' }],
    schritte: [
      { t: 0, wer: 'pong', aktion: 'sag', text: 'Dreizehn Uhr. Pong legt die Füße auf den Tisch, die Mütze übers Gesicht.', bark: 'Incidents at two.', dauer: 6 },
      { t: 6, wer: 'pong', aktion: 'sag', text: 'Schnarchen.', dauer: 20 },
      { t: 29, wer: 'pong', aktion: 'sag', text: 'Vierzehn Uhr. Pong wacht auf. Die Streife läuft wieder.', bark: 'Back on duty.', dauer: 5 },
    ],
    ende: 'fenster', loop: true, ansprechen: ['Pong, unter der Mütze: „Ich schlafe. Kein Vorfall. Geh.“'],
    wirkung: { streife_p1: 'schlaeft' }, requisite: [], sound: [],
  },
];

export function normalizeSzenen(json) {
  const raw = json && typeof json === 'object' ? json.szenen : null;
  const list = Array.isArray(raw) && raw.length ? raw : DEFAULT_SZENEN;
  const out = list.filter((s) => s && typeof s === 'object' && typeof s.id === 'string' && s.id).map((s, index) => {
    const f = s.fenster && typeof s.fenster === 'object' ? s.fenster : {};
    const von = zeitT(f.von) ?? 0, bis = zeitT(f.bis) ?? 1;
    const figuren = (Array.isArray(s.figuren) ? s.figuren : []).filter((x) => x && typeof x === 'object' && typeof x.slug === 'string' && x.slug)
      .map((x) => ({ slug: x.slug, start: ortOk(x.start), stimme: str(x.stimme, x.slug), rolle: str(x.rolle, ''), aussehen: x.aussehen && typeof x.aussehen === 'object' ? x.aussehen : null }));
    const schritte = (Array.isArray(s.schritte) ? s.schritte : []).filter((a) => a && typeof a === 'object' && SZENE_AKTIONEN.includes(a.aktion))
      .map((a) => ({ t: Number.isFinite(a.t) && a.t >= 0 ? a.t : 0, wer: str(a.wer, 'streife'), aktion: a.aktion, text: str(a.text, null), bark: str(a.bark, null), pose: str(a.pose, null), ziel: ortOk(a.ziel), dauer: Number.isFinite(a.dauer) && a.dauer > 0 ? a.dauer : 3 }))
      .sort((a, b) => a.t - b.t);
    const dauer = schritte.reduce((m, a) => Math.max(m, a.t + a.dauer), 0);
    const w = s.wirkung && typeof s.wirkung === 'object' ? s.wirkung : {};
    const wirkung = {};
    if (w.streife_p1 === 'schlaeft') wirkung.streife_p1 = 'schlaeft';
    if (w.streife_stolpert === true) wirkung.streife_stolpert = true;
    const verstecke = (Array.isArray(w.verstecke) ? w.verstecke : []).map((v) => (v && typeof v === 'object' ? (typeof v.spot === 'string' ? { spot: v.spot, r: Number.isFinite(v.r) ? v.r : 3 } : Number.isFinite(v.x) && Number.isFinite(v.z) ? { x: v.x, z: v.z, r: Number.isFinite(v.r) ? v.r : 3 } : null) : null)).filter(Boolean);
    if (verstecke.length) wirkung.verstecke = verstecke;
    if (w.liegen_belegt === true) wirkung.liegen_belegt = true;
    if (Number.isFinite(w.kunden_faktor) && w.kunden_faktor > 0) wirkung.kunden_faktor = w.kunden_faktor;
    if (Number.isFinite(w.preis_faktor) && w.preis_faktor > 0) wirkung.preis_faktor = w.preis_faktor;
    const k = s.kommentar && typeof s.kommentar === 'object' && str(s.kommentar.text, null) ? { wer: str(s.kommentar.wer, 'mentor'), text: s.kommentar.text } : null;
    return {
      id: s.id, index, titel: str(s.titel, s.id), fenster: { von: Math.min(von, bis), bis: Math.max(von, bis) },
      tage: Array.isArray(s.tage) ? s.tage.filter(Number.isFinite) : null,
      chance: Number.isFinite(s.chance) ? Math.max(0, Math.min(1, s.chance)) : 1,
      ab_tag: Number.isFinite(s.ab_tag) ? Math.max(2, Math.round(s.ab_tag)) : 2, // nie Tag 1 (Tutorial-Tag)
      ort: ortOk(s.ort) || 'strand', figuren, schritte, dauer,
      ende: s.ende === 'schritte' ? 'schritte' : 'fenster', loop: s.loop === true,
      ansprechen: strList(s.ansprechen), folge: folgeOk(s.folge), wirkung, kommentar: k, requisite: strList(s.requisite), sound: strList(s.sound),
    };
  });
  return out.length ? out : normalizeSzenen({ szenen: DEFAULT_SZENEN });
}

/** Läuft die Szene heute? ab_tag, tage[] (Wochentag 1–7), Chance deterministisch aus Seed/Woche/Tag */
export function szeneHeute(szene, { seed = 1, woche = 1, tag = 1 } = {}) {
  if (tag < szene.ab_tag) return false;
  if (szene.tage && !szene.tage.includes(tag)) return false;
  if (szene.chance >= 1) return true;
  if (szene.chance <= 0) return false;
  return tagesWuerfel(seed, woche, tag, 300 + szene.index) < szene.chance;
}
export const szenenDesTages = (szenen, ctx) => szenen.filter((s) => szeneHeute(s, ctx));
/** Ist die Szene zu seitSek (seit Fensterbeginn) noch im Gang? ende 'schritte' ohne loop: nach dem letzten Schritt vorbei */
export const szeneLaeuft = (szene, seitSek) => szene.ende === 'fenster' || szene.loop || seitSek <= szene.dauer;
/** Aktive Szenen zur Uhrzeit: [{ szene, seitSek }] (seitSek in Spielsekunden seit Fensterbeginn) */
export function szenenAktiv(szenenHeute, t01) {
  return szenenHeute.filter((s) => t01 >= s.fenster.von && t01 < s.fenster.bis)
    .map((s) => ({ szene: s, seitSek: (t01 - s.fenster.von) * DAY_LENGTH })).filter((a) => szeneLaeuft(a.szene, a.seitSek));
}
/** Fällige Schritte zwischen vorherSek (exklusiv) und jetztSek (inklusiv); mit loop wiederholt sich die Folge alle `dauer` Sekunden */
export function szeneSchritte(szene, vorherSek, jetztSek) {
  if (!szene.schritte.length || jetztSek <= vorherSek) return [];
  const out = [];
  if (!szene.loop || szene.dauer <= 0) { for (const st of szene.schritte) if (st.t > vorherSek && st.t <= jetztSek) out.push({ ...st, runde: 0 }); return out; }
  const r0 = Math.floor(Math.max(0, vorherSek) / szene.dauer), r1 = Math.floor(jetztSek / szene.dauer);
  for (let r = r0; r <= r1; r++) for (const st of szene.schritte) { const t = r * szene.dauer + st.t; if (t > vorherSek && t <= jetztSek) out.push({ ...st, runde: r }); }
  return out;
}
/** Zeile beim Ansprechen einer Szenen-Figur (zyklisch per Index) */
export const szeneAnsprechen = (szene, idx = 0) => (szene.ansprechen.length ? szene.ansprechen[((idx % szene.ansprechen.length) + szene.ansprechen.length) % szene.ansprechen.length] : null);
/** Gesammelte Wirkung der aktiven Szenen; orte(ortOderSpot) → { x, z, r } löst Spot-Namen auf */
export function szenenWirkung(aktive, orte = (o) => (typeof o === 'object' ? o : null)) {
  const w = { streife_p1: null, stolpern: [], verstecke: [], liegen_belegt: false, kunden_faktor: 1, preis_faktor: 1, ids: [] };
  for (const { szene } of aktive) {
    const x = szene.wirkung, pos = orte(szene.ort);
    w.ids.push(szene.id);
    if (x.streife_p1) w.streife_p1 = x.streife_p1;
    if (x.streife_stolpert && pos) w.stolpern.push({ x: pos.x, z: pos.z, r: Number.isFinite(pos.r) ? pos.r : 5 });
    for (const v of x.verstecke || []) { const p = v.spot ? orte(v.spot) : v; if (p) w.verstecke.push({ x: p.x, z: p.z, r: v.r }); }
    if (x.liegen_belegt) w.liegen_belegt = true;
    if (x.kunden_faktor) w.kunden_faktor *= x.kunden_faktor;
    if (x.preis_faktor) w.preis_faktor *= x.preis_faktor;
  }
  return w;
}
/** Steht die Position in einer Stolper-Zone (Kinder/Ehepaar im Weg)? */
export const inStolperZone = (wirk, pos) => wirk.stolpern.some((z) => Math.hypot(pos.x - z.x, pos.z - z.z) <= z.r);
