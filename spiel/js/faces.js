// faces.js — gemalte Gesichter (Canvas-2D) als Decal auf Kugelköpfen. Simpsons-/Rick-&-Morty-Stil:
// große runde Augen mit dicker Kontur, kleine Pupillen, Lidlinien, Mund + Brauen als Striche.
// Das Decal ist ein vorderes Kugel-Segment (gleiche Verformung wie der Kopf, minimal größer) mit
// transparenter Textur; u=0 = linke Bildseite aus Betrachtersicht, v=1 = oben.
//
// API: face(kind, mood, opts) → gecachte CanvasTexture (faceCanvas() liefert das rohe Canvas, z. B. für 2D-Vorschauen).
//   kind: 'schluffi' | 'runner' | 'sun' | 'kunde'
//   mood: 'neutral' | 'misstrauisch' | 'erschrocken' | 'zufrieden' | 'selig'   (selig = stoned, heutiger Schluffi-Look)
//   opts: skin (CSS-Farbe oder Hex-Zahl, Lidfarbe = Haut), beard (true = Vollbart, 'stoppeln', 'schnauzer'),
//         glasses (true/'lese' = Lesebrille, 'sonnen' = Sonnenbrille, 'sport' = Sportbrille), wrinkles (Oma),
//         seed (kleine Abweichungen bei Augenabstand/-größe und Mundbreite, damit Kunden sich unterscheiden), look [px, py].
//   Katalog-Felder aus data/kunden.json gehen direkt rein: hautton (hell|mittel|dunkel|sonnenbrand), bart
//   (keiner|stoppel|vollbart|schnauzer), brille (keine|sonnenbrille|lesebrille|sportbrille), haare (weiss → graue
//   Brauen + Falten). kundeFace(datensatz, mood) nimmt den ganzen Datensatz; kundeSkin(datensatz) liefert die Kopffarbe.
import * as THREE from 'three';
import { toon, rng } from './toon.js';

const S = 1024;
const INK = '#111111';

export const FACE_KINDS = ['schluffi', 'runner', 'sun', 'kunde'];
export const FACE_MOODS = ['neutral', 'misstrauisch', 'erschrocken', 'zufrieden', 'selig', 'reveal'];

// ---------- Grundformen ----------
function eye(ctx, cx, cy, r, { lid = 0, lidTilt = 0, lidColor = '#f0b98a', pupil = 24, px = 0, py = 0, veins = 0, bag = false, seed = 1, stroke = 16 }) {
  const rand = rng(seed);
  ctx.lineCap = 'round';
  ctx.lineJoin = 'round';
  ctx.fillStyle = '#ffffff';
  ctx.beginPath(); ctx.arc(cx, cy, r, 0, Math.PI * 2); ctx.fill();
  // Äderchen: vom Rand Richtung Pupille, verzweigt
  ctx.strokeStyle = '#d93a3a';
  ctx.lineWidth = 4;
  for (let i = 0; i < veins; i++) {
    const a = rand() * Math.PI * 2;
    const x0 = cx + Math.cos(a) * r * 0.95, y0 = cy + Math.sin(a) * r * 0.95;
    const x1 = cx + Math.cos(a) * r * 0.45 + (rand() - 0.5) * 20, y1 = cy + Math.sin(a) * r * 0.45 + (rand() - 0.5) * 20;
    ctx.beginPath(); ctx.moveTo(x0, y0);
    ctx.quadraticCurveTo((x0 + x1) / 2 + (rand() - 0.5) * 30, (y0 + y1) / 2 + (rand() - 0.5) * 30, x1, y1); ctx.stroke();
    ctx.beginPath(); ctx.moveTo((x0 + x1) / 2, (y0 + y1) / 2);
    ctx.lineTo((x0 + x1) / 2 + (rand() - 0.5) * 40, (y0 + y1) / 2 + (rand() - 0.5) * 40); ctx.stroke();
  }
  // Pupille
  ctx.fillStyle = INK;
  ctx.beginPath(); ctx.arc(cx + px, cy + py, pupil, 0, Math.PI * 2); ctx.fill();
  // Lid: Hautfarbe über dem oberen Teil, geclippt auf den Augapfel, mit dicker Lidlinie
  if (lid > 0) {
    ctx.save();
    ctx.beginPath(); ctx.arc(cx, cy, r, 0, Math.PI * 2); ctx.clip();
    ctx.translate(cx, cy); ctx.rotate(lidTilt);
    const edge = -r + 2 * r * lid;
    ctx.fillStyle = lidColor;
    ctx.fillRect(-r * 1.5, -r * 1.5, r * 3, edge + r * 1.5);
    ctx.strokeStyle = INK; ctx.lineWidth = stroke * 0.8;
    ctx.beginPath(); ctx.moveTo(-r * 1.2, edge); ctx.lineTo(r * 1.2, edge); ctx.stroke();
    ctx.restore();
  }
  if (bag) {
    ctx.strokeStyle = INK; ctx.lineWidth = stroke * 0.5;
    ctx.beginPath(); ctx.arc(cx, cy + r * 0.55, r * 0.75, Math.PI * 0.2, Math.PI * 0.8); ctx.stroke();
  }
  // Kontur
  ctx.strokeStyle = INK; ctx.lineWidth = stroke;
  ctx.beginPath(); ctx.arc(cx, cy, r, 0, Math.PI * 2); ctx.stroke();
}

function strokePath(ctx, pts, width, color = INK) {
  ctx.strokeStyle = color; ctx.lineWidth = width; ctx.lineCap = 'round'; ctx.lineJoin = 'round';
  ctx.beginPath(); ctx.moveTo(pts[0][0], pts[0][1]);
  for (let i = 1; i < pts.length; i++) {
    if (pts[i].length === 4) ctx.quadraticCurveTo(pts[i][0], pts[i][1], pts[i][2], pts[i][3]);
    else ctx.lineTo(pts[i][0], pts[i][1]);
  }
  ctx.stroke();
}

function makeCanvas() {
  const c = document.createElement('canvas');
  c.width = S; c.height = S;
  const ctx = c.getContext('2d');
  ctx.clearRect(0, 0, S, S);
  return [c, ctx];
}

function finish(c) {
  const tex = new THREE.CanvasTexture(c);
  tex.colorSpace = THREE.SRGBColorSpace;
  tex.anisotropy = 4;
  return tex;
}

const cssColor = (c, fallback) => (typeof c === 'number' ? '#' + c.toString(16).padStart(6, '0') : (c ?? fallback));
const pick = (v, i) => (Array.isArray(v) ? v[i] : v);

// Hauttöne des Kundschaft-Katalogs (Hex für den Kopf-Mesh, CSS fürs Gesicht = dieselbe Farbe)
export const SKIN_TONES = { hell: 0xf5c9a0, mittel: 0xd9a06e, dunkel: 0x8d5a3a, sonnenbrand: 0xf0876a };
export const kundeSkin = (k) => SKIN_TONES[k?.hautton] ?? SKIN_TONES.mittel;

// Katalog-Felder → interne Optionen (alte Optionen bleiben gültig und gewinnen, wenn beide gesetzt sind)
const BART = { keiner: false, stoppel: 'stoppeln', vollbart: true, schnauzer: 'schnauzer' };
const BRILLE = { keine: false, sonnenbrille: 'sonnen', lesebrille: 'lese', sportbrille: 'sport' };
function normalize(o) {
  const weiss = o.haare === 'weiss';
  return {
    skin: cssColor(o.skin ?? SKIN_TONES[o.hautton], '#f0b98a'),
    beard: o.beard ?? BART[o.bart] ?? false,
    glasses: o.glasses ?? BRILLE[o.brille] ?? false,
    wrinkles: o.wrinkles ?? weiss,
    seed: o.seed ?? 0,
    look: o.look ?? null,
    beardColor: cssColor(o.beardColor, weiss ? '#d8d8e0' : '#6b4423'),
    browColor: weiss ? '#d8d8e0' : null,
  };
}

// Kleiner stabiler Hash (Kunden-id → seed), damit gleiche Optionen pro Kunde anders streuen
function hashSeed(str) {
  let h = 7;
  for (const ch of String(str)) h = (h * 31 + ch.charCodeAt(0)) >>> 0;
  return 1 + (h % 997);
}

// ---------- Stimmungen: Lid (0 = offen … 1 = zu), Lidneigung (linkes Auge; rechts gespiegelt, + = innen tiefer),
// Pupillengröße (Faktor), Pupillenversatz (je Auge oder gemeinsam), Augengröße ----------
const MOODS = {
  neutral:      { lid: 0.16, tilt: 0,     pupil: 1,    px: 0,         py: 6 },
  misstrauisch: { lid: 0.36, tilt: 0.12,  pupil: 1,    px: -34,       py: 4 },
  erschrocken:  { lid: 0,    tilt: 0,     pupil: 0.55, px: 0,         py: -4, eyeScale: 1.08 },
  zufrieden:    { lid: 0.3,  tilt: -0.12, pupil: 1,    px: 0,         py: 8 },
  selig:        { lid: 0.5,  tilt: -0.06, pupil: 1,    px: [-26, 34], py: [30, 22], veins: 3 },
  // Reveal: kalte Polizistenaugen (schmal, kleine Pupillen, harte Brauen), der Mund lächelt weiter
  reveal:       { lid: 0.42, tilt: 0.1,   pupil: 0.6,  px: 0,         py: 2 },
};

// ---------- Figurentypen: Augenlayout, Mundanker (y = Lippenlinie, grinY = Oberkante des offenen Grinsens),
// feste Eigenheiten (Stoppeln, Tränensäcke, Bäckchen) und Abweichungen einzelner Stimmungen ----------
const KINDS = {
  schluffi: {
    eyes: [[372, 330], [652, 330]], r: 128, pupil: 20, stroke: 16, line: 18, veins: 3, seeds: [3, 4],
    mouth: { x: 525, y: 690, w: 330, grinY: 600, grinW: 410 }, stubble: true,
  },
  runner: {
    eyes: [[352, 330], [672, 330]], r: 136, pupil: 24, stroke: 16, line: 19, bag: true, seeds: [5, 6],
    mouth: { x: 520, y: 680, w: 300 }, cheekbones: true,
    moods: { misstrauisch: { lid: 0.32, tilt: 0.05, px: -48, py: 6 } },
  },
  sun: {
    eyes: [[335, 390], [689, 390]], r: 150, pupil: 38, stroke: 20, line: 26, veins: 7, lid: '#ffd93b', seeds: [7, 8],
    mouth: { x: 512, y: 680, w: 525 }, blush: true, brows: false,
    moods: { selig: { lid: 0.6, tilt: 0.22, px: [20, -45], py: [25, 15] } },
  },
  kunde: {
    eyes: [[362, 330], [662, 330]], r: 130, pupil: 24, stroke: 16, line: 18, seeds: [13, 14],
    mouth: { x: 512, y: 680, w: 320 },
  },
};

// ---------- Brauen ----------
function brows(ctx, mood, eyes, r, width, light = null) {
  if (light) { // helle Brauen: erst Tinte breiter, dann die helle Farbe drüber
    brows(ctx, mood, eyes, r, width + 8);
    const sp = strokePath;
    const lightStroke = (c, pts, w) => sp(c, pts, w, light);
    return browsWith(ctx, mood, eyes, r, width - 2, lightStroke);
  }
  return browsWith(ctx, mood, eyes, r, width, strokePath);
}
function browsWith(ctx, mood, eyes, r, width, strokePath) {
  for (let i = 0; i < 2; i++) {
    const [ex, ey] = eyes[i];
    const s = i === 0 ? 1 : -1; // Spiegelung: innen = Richtung Mitte
    const inner = (k) => ex + s * k * r, outer = (k) => ex - s * k * r;
    switch (mood) {
      case 'misstrauisch': // V-Brauen, innen tief
        strokePath(ctx, [[outer(0.95), ey - 1.5 * r], [inner(0.87), ey - 1.0 * r]], width + 2);
        break;
      case 'reveal': // harte, flache Brauen knapp über dem Auge
        strokePath(ctx, [[outer(0.95), ey - 1.3 * r], [inner(0.9), ey - 1.15 * r]], width + 4);
        break;
      case 'erschrocken': // hoch gerissen
        strokePath(ctx, [[outer(0.9), ey - 1.85 * r], [ex, ey - 2.25 * r, inner(0.9), ey - 1.9 * r]], width);
        break;
      case 'zufrieden': // entspannt, leicht hoch
        strokePath(ctx, [[outer(0.9), ey - 1.5 * r], [ex, ey - 1.9 * r, inner(0.9), ey - 1.55 * r]], width);
        break;
      case 'selig': // hohe, runde, schwere Brauen (Schluffi-Original)
        strokePath(ctx, [[outer(0.86), ey - 0.98 * r], [ex, ey - 1.64 * r, inner(0.86), ey - 1.03 * r]], width);
        break;
      default: // neutral: flacher Bogen
        strokePath(ctx, [[outer(0.85), ey - 1.4 * r], [ex, ey - 1.7 * r, inner(0.85), ey - 1.42 * r]], width);
    }
  }
}

// ---------- Münder ----------
// Offenes, dümmlich-glückliches Grinsen mit Zahnlücke und Zunge (Schluffi-Original bei cx=525, gy=600, k=1)
function grin(ctx, cx, gy, k, stroke) {
  const path = () => {
    ctx.beginPath(); ctx.moveTo(cx - 205 * k, gy);
    ctx.quadraticCurveTo(cx - 5 * k, gy + 40 * k, cx + 205 * k, gy - 14 * k);
    ctx.quadraticCurveTo(cx + 95 * k, gy + 280 * k, cx - 205 * k, gy);
    ctx.closePath();
  };
  ctx.save(); path(); ctx.clip();
  ctx.fillStyle = '#2a0f0f'; ctx.fillRect(cx - 230 * k, gy - 40 * k, 460 * k, 330 * k);
  ctx.fillStyle = '#ff7b9c'; ctx.beginPath(); ctx.ellipse(cx + 45 * k, gy + 190 * k, 130 * k, 60 * k, -0.15, 0, Math.PI * 2); ctx.fill();
  ctx.fillStyle = '#ffffff'; ctx.fillRect(cx - 225 * k, gy - 40 * k, 460 * k, 95 * k);
  ctx.fillStyle = '#2a0f0f'; ctx.fillRect(cx - 33 * k, gy - 40 * k, 40 * k, 110 * k); // Zahnlücke
  ctx.strokeStyle = INK; ctx.lineWidth = 8 * k;
  for (const dx of [-130, -80, 60, 115, 170]) { ctx.beginPath(); ctx.moveTo(cx + dx * k, gy - 25 * k); ctx.lineTo(cx + dx * k, gy + 60 * k); ctx.stroke(); }
  ctx.beginPath(); ctx.moveTo(cx - 225 * k, gy + 55 * k); ctx.lineTo(cx + 235 * k, gy + 55 * k); ctx.stroke();
  ctx.restore();
  ctx.strokeStyle = INK; ctx.lineWidth = stroke; ctx.lineJoin = 'round';
  path(); ctx.stroke();
}

// Erschrockenes „O“ mit Zähnen oben und Zunge unten
function gasp(ctx, cx, cy, rx, ry, stroke) {
  const path = () => { ctx.beginPath(); ctx.ellipse(cx, cy, rx, ry, 0, 0, Math.PI * 2); };
  ctx.save(); path(); ctx.clip();
  ctx.fillStyle = '#2a0f0f'; ctx.fillRect(cx - rx, cy - ry, rx * 2, ry * 2);
  ctx.fillStyle = '#ffffff'; ctx.fillRect(cx - rx, cy - ry, rx * 2, ry * 0.42);
  ctx.strokeStyle = INK; ctx.lineWidth = 6;
  for (const dx of [-0.45, 0, 0.45]) { ctx.beginPath(); ctx.moveTo(cx + dx * rx, cy - ry); ctx.lineTo(cx + dx * rx, cy - ry * 0.58); ctx.stroke(); }
  ctx.fillStyle = '#ff7b9c'; ctx.beginPath(); ctx.ellipse(cx, cy + ry * 0.95, rx * 0.7, ry * 0.45, 0, 0, Math.PI * 2); ctx.fill();
  ctx.restore();
  ctx.strokeStyle = INK; ctx.lineWidth = stroke; path(); ctx.stroke();
}

function mouth(ctx, kind, mood, m, line) {
  const { x, y, w } = m;
  switch (mood) {
    case 'misstrauisch': // zusammengekniffen, ein Mundwinkel runter
      strokePath(ctx, [[x - w / 2, y], [x, y + 12, x + w / 2, y]], line);
      strokePath(ctx, [[x + w / 2, y], [x + w / 2 + 30, y + 28]], line);
      break;
    case 'erschrocken':
      gasp(ctx, x, y + 20, w * 0.28, w * 0.3, line - 2);
      break;
    case 'reveal': // das Touristen-Lächeln bleibt — nur zu breit
    case 'zufrieden': // breites, geschlossenes Lächeln mit Grübchen
      strokePath(ctx, [[x - w * 0.55, y - 20], [x, y + 60, x + w * 0.55, y - 20]], line + 2);
      strokePath(ctx, [[x - w * 0.55, y - 20], [x - w * 0.62, y - 48]], line - 4);
      strokePath(ctx, [[x + w * 0.55, y - 20], [x + w * 0.62, y - 48]], line - 4);
      break;
    case 'selig':
      if (kind === 'sun') { // Sonnen-Original: seliges Grinsen als dicker Bogen
        strokePath(ctx, [[x - 262, y], [x, y + 250, x + 263, y - 20]], line);
        strokePath(ctx, [[x + 263, y - 20], [x + 288, y + 5]], line);
        strokePath(ctx, [[x - 262, y], [x - 280, y + 20]], line);
      } else {
        const gw = m.grinW ?? w * 1.1;
        grin(ctx, x, m.grinY ?? y - 70, gw / 410, 16);
      }
      break;
    default: // neutral: fast gerade, ein Hauch nach unten
      strokePath(ctx, [[x - w / 2, y], [x, y + 14, x + w / 2, y - 6]], line);
  }
}

// ---------- Eigenheiten ----------
function stubble(ctx, m, seed = 9) {
  const rand = rng(seed);
  ctx.fillStyle = 'rgba(80, 45, 20, 0.55)';
  for (let i = 0; i < 140; i++) {
    const x = 300 + rand() * 424, y = 600 + rand() * 300;
    if (Math.hypot(x - 512, y - 560) < 90) continue; // Platz für die 3D-Nase
    if (x > m.x - 205 && x < m.x + 195 && y > 590 && y < 760) continue; // Platz für den Mund
    ctx.beginPath(); ctx.arc(x, y, 3.5 + rand() * 2.5, 0, Math.PI * 2); ctx.fill();
  }
}

// Vollbart: Blob über die untere Gesichtshälfte, hautfarbenes Loch um den Mund, Schnauzer obendrauf
function beard(ctx, m, skin, color, big) {
  ctx.fillStyle = color; ctx.strokeStyle = INK; ctx.lineWidth = 14; ctx.lineJoin = 'round';
  ctx.beginPath();
  ctx.moveTo(150, 360); ctx.quadraticCurveTo(170, 700, 260, 860);
  ctx.quadraticCurveTo(380, 1010, 512, 990); ctx.quadraticCurveTo(644, 1010, 764, 860);
  ctx.quadraticCurveTo(854, 700, 874, 360);
  ctx.quadraticCurveTo(800, 470, 740, 560); ctx.quadraticCurveTo(620, 610, 512, 612);
  ctx.quadraticCurveTo(404, 610, 284, 560); ctx.quadraticCurveTo(224, 470, 150, 360);
  ctx.closePath(); ctx.fill(); ctx.stroke();
  ctx.fillStyle = skin;
  ctx.beginPath(); ctx.ellipse(m.x, m.y + (big ? 40 : 14), m.w * (big ? 0.62 : 0.54), big ? 170 : 84, 0, 0, Math.PI * 2); ctx.fill();
  mustache(ctx, m, color);
}
function mustache(ctx, m, color) {
  ctx.fillStyle = color; ctx.strokeStyle = INK; ctx.lineWidth = 8;
  for (const s of [-1, 1]) {
    ctx.beginPath(); ctx.ellipse(m.x + s * 78, m.y - 50, 98, 34, s * 0.22, 0, Math.PI * 2); ctx.fill(); ctx.stroke();
  }
}

function glasses(ctx, eyes, r, kind = true) {
  const [[lx, ly], [rx, ry]] = eyes;
  ctx.lineCap = 'round';
  if (kind === 'sport') { // Sportbrille: ein breites Visier, orange getönt
    const R = r * 1.3, x0 = lx - R, x1 = rx + R, y0 = ly - r * 0.95, y1 = ly + r * 0.75;
    const band = () => { ctx.beginPath(); ctx.roundRect(x0, y0, x1 - x0, y1 - y0, r * 0.7); };
    ctx.fillStyle = 'rgba(255, 140, 40, 0.6)'; band(); ctx.fill();
    ctx.strokeStyle = INK; ctx.lineWidth = 18; band(); ctx.stroke();
    ctx.strokeStyle = 'rgba(255,255,255,0.85)'; ctx.lineWidth = 10;
    ctx.beginPath(); ctx.moveTo(x0 + 60, y0 + 40); ctx.lineTo(x0 + 190, y0 + 28); ctx.stroke();
    strokePath(ctx, [[x0, ly - 20], [30, ly - 70]], 14);
    strokePath(ctx, [[x1, ly - 20], [S - 30, ly - 70]], 14);
    return;
  }
  if (kind === 'lese') { // Lesebrille: kleine Halbgläser, sitzen tief — der Blick geht über den Rand
    const R = r * 0.95, cy = ly + r * 0.38;
    for (const ex of [lx, rx]) {
      ctx.fillStyle = 'rgba(160, 225, 255, 0.2)';
      ctx.beginPath(); ctx.arc(ex, cy, R, 0, Math.PI); ctx.closePath(); ctx.fill();
      ctx.strokeStyle = INK; ctx.lineWidth = 14;
      ctx.beginPath(); ctx.arc(ex, cy, R, 0, Math.PI); ctx.stroke();
      ctx.beginPath(); ctx.moveTo(ex - R, cy); ctx.lineTo(ex + R, cy); ctx.stroke();
    }
    strokePath(ctx, [[lx + R, cy], [(lx + rx) / 2, cy - 14, rx - R, cy]], 12);
    strokePath(ctx, [[lx - R, cy], [30, cy - 70]], 10);
    strokePath(ctx, [[rx + R, cy], [S - 30, cy - 70]], 10);
    return;
  }
  const R = r * 1.24;
  const sonnen = kind === 'sonnen';
  for (let i = 0; i < 2; i++) {
    const [ex, ey] = eyes[i];
    ctx.fillStyle = sonnen ? 'rgba(20, 20, 40, 0.8)' : 'rgba(160, 225, 255, 0.22)';
    ctx.beginPath(); ctx.arc(ex, ey, R, 0, Math.PI * 2); ctx.fill();
    ctx.strokeStyle = INK; ctx.lineWidth = sonnen ? 22 : 18;
    ctx.beginPath(); ctx.arc(ex, ey, R, 0, Math.PI * 2); ctx.stroke();
    ctx.strokeStyle = 'rgba(255,255,255,0.85)'; ctx.lineWidth = 10;
    ctx.beginPath(); ctx.arc(ex, ey, R * 0.78, Math.PI * 1.15, Math.PI * 1.45); ctx.stroke();
  }
  strokePath(ctx, [[lx + R, ly - 12], [(lx + rx) / 2, ly - 40, rx - R, ry - 12]], 14);
  strokePath(ctx, [[lx - R, ly - 10], [40, ly - 60]], 12);
  strokePath(ctx, [[rx + R, ry - 10], [S - 40, ry - 60]], 12);
}

function wrinkles(ctx, eyes, r, m) {
  ctx.strokeStyle = 'rgba(17,17,17,0.75)';
  for (let i = 0; i < 2; i++) {
    const [ex, ey] = eyes[i];
    const s = i === 0 ? -1 : 1; // außen
    for (let k = -1; k <= 1; k++) strokePath(ctx, [[ex + s * r * 1.15, ey + k * 22], [ex + s * r * 1.5, ey + k * 48]], 7, 'rgba(17,17,17,0.75)');
  }
  strokePath(ctx, [[400, 150], [512, 120, 624, 150]], 7, 'rgba(17,17,17,0.6)');
  strokePath(ctx, [[430, 195], [512, 172, 594, 195]], 6, 'rgba(17,17,17,0.5)');
  strokePath(ctx, [[m.x - m.w * 0.72, m.y - 30], [m.x - m.w * 0.65, m.y + 60]], 6, 'rgba(17,17,17,0.6)');
  strokePath(ctx, [[m.x + m.w * 0.72, m.y - 30], [m.x + m.w * 0.65, m.y + 60]], 6, 'rgba(17,17,17,0.6)');
}

function sweatDrop(ctx, x, y) {
  ctx.fillStyle = '#7fd8ff'; ctx.strokeStyle = INK; ctx.lineWidth = 10; ctx.lineJoin = 'round';
  ctx.beginPath(); ctx.moveTo(x, y - 90);
  ctx.quadraticCurveTo(x + 46, y - 16, x + 38, y + 10);
  ctx.arc(x, y + 10, 38, 0, Math.PI, false);
  ctx.quadraticCurveTo(x - 46, y - 16, x, y - 90);
  ctx.closePath(); ctx.fill(); ctx.stroke();
  ctx.fillStyle = '#ffffff'; ctx.beginPath(); ctx.arc(x - 13, y + 6, 9, 0, Math.PI * 2); ctx.fill();
}

// ---------- Zusammenbau ----------
function paint(kind, mood, o) {
  const K = KINDS[kind] ?? KINDS.kunde;
  const M = { ...MOODS[mood] ?? MOODS.neutral, ...(K.moods?.[mood] ?? {}) };
  const skin = o.skin;
  const rand = rng(1000 + o.seed);
  // Abweichungen per seed (nur wenn gesetzt): Augenabstand, Augengröße, Mundbreite, Pupillengröße
  const vary = o.seed ? 1 : 0;
  const r = K.r * (1 + vary * (rand() - 0.5) * 0.22) * (M.eyeScale ?? 1);
  const dxEyes = vary * (rand() - 0.5) * 50, dyEyes = vary * (rand() - 0.5) * 30;
  const eyes = K.eyes.map(([x, y]) => [x + (x < 512 ? -dxEyes : dxEyes), y + dyEyes]);
  const m = { ...K.mouth, w: K.mouth.w * (1 + vary * (rand() - 0.5) * 0.3) };
  const pupil = K.pupil * M.pupil * (1 + vary * (rand() - 0.5) * 0.3);
  const veins = K.veins ?? M.veins ?? 0;
  const lidColor = K.lid ?? skin;

  const [c, ctx] = makeCanvas();
  if (K.blush) {
    ctx.fillStyle = 'rgba(255, 110, 120, 0.55)';
    ctx.beginPath(); ctx.arc(215, 600, 70, 0, Math.PI * 2); ctx.fill();
    ctx.beginPath(); ctx.arc(809, 600, 70, 0, Math.PI * 2); ctx.fill();
  }
  if (o.beard === true) beard(ctx, m, skin, o.beardColor, mood === 'selig');
  for (let i = 0; i < 2; i++) {
    const look = o.look ? [pick(o.look[0], i), pick(o.look[1], i)] : [pick(M.px, i), pick(M.py, i)];
    eye(ctx, eyes[i][0], eyes[i][1], r, {
      lid: M.lid, lidTilt: i === 0 ? M.tilt : -M.tilt, lidColor, pupil, px: look[0], py: look[1],
      veins, bag: !!K.bag, seed: K.seeds?.[i] ?? 1 + i, stroke: K.stroke,
    });
  }
  if (o.glasses) glasses(ctx, eyes, r, o.glasses);
  if (K.brows !== false) brows(ctx, mood, eyes, r, 20, o.browColor);
  if (K.stubble || o.beard === 'stoppeln') stubble(ctx, m, K.stubble ? 9 : 9 + o.seed);
  if (o.beard === 'schnauzer') mustache(ctx, m, o.beardColor);
  if (K.cheekbones) {
    strokePath(ctx, [[150, 560], [190, 680]], 8);
    strokePath(ctx, [[874, 560], [834, 680]], 8);
  }
  mouth(ctx, kind, mood, m, K.line);
  if (o.wrinkles) wrinkles(ctx, eyes, r, m);
  if (mood === 'erschrocken') sweatDrop(ctx, Math.min(S - 60, eyes[1][0] + r * 1.55), eyes[1][1] - r * 0.3);
  return c;
}

const canvasCache = new Map();
const texCache = new Map();
const key = (kind, mood, o) => `${kind}|${mood}|${o.skin}|${o.beard}|${o.glasses}|${o.wrinkles ? 1 : 0}|${o.seed}|${o.look ? o.look.join(',') : ''}|${o.beardColor}|${o.browColor ?? ''}`;

/** Rohes Canvas (gecacht) — für 2D-Vorschauen oder eigene Texturen. */
export function faceCanvas(kind, mood = 'neutral', opts = {}) {
  const o = normalize(opts);
  const k = key(kind, mood, o);
  if (!canvasCache.has(k)) canvasCache.set(k, paint(kind, mood, o));
  return canvasCache.get(k);
}

/** Gesicht als CanvasTexture (gecacht; gleiche Parameter = dieselbe Textur). */
export function face(kind, mood = 'neutral', opts = {}) {
  const o = normalize(opts);
  const k = key(kind, mood, o);
  if (!texCache.has(k)) texCache.set(k, finish(faceCanvas(kind, mood, o)));
  return texCache.get(k);
}

/** Kundengesicht direkt aus einem Datensatz von data/kunden.json; mood fehlt → stimmung_start. */
export function kundeFace(k, mood = k.stimmung_start ?? 'neutral', extra = {}) {
  return face('kunde', mood, { hautton: k.hautton, bart: k.bart, brille: k.brille, haare: k.haare, seed: hashSeed(k.id ?? k.name ?? 'x'), ...extra });
}

// Bisherige Exporte: die drei Ursprungs-Looks
export const schluffiFace = (skinCss) => face('schluffi', 'selig', { skin: skinCss });
export const runnerFace = (skinCss) => face('runner', 'misstrauisch', { skin: skinCss });
export const sunFace = () => face('sun', 'selig');

/**
 * Decal-Mesh: vorderes Kugel-Segment, Radius r (minimal größer als der Kopf).
 * shape(geometry) wendet dieselben Transformationen an wie beim Kopf (Scale/Deform).
 */
export function faceDecal(texture, r, shape, { basic = false } = {}) {
  const geo = new THREE.SphereGeometry(r, 40, 32, Math.PI / 2 - 1.05, 2.1, Math.PI * 0.22, Math.PI * 0.62);
  if (shape) shape(geo);
  const mat = basic
    ? new THREE.MeshBasicMaterial({ map: texture, transparent: true, alphaTest: 0.02, polygonOffset: true, polygonOffsetFactor: -4, polygonOffsetUnits: -4 })
    : toon(0xffffff, { map: texture, transparent: true, alphaTest: 0.02, polygonOffset: true, polygonOffsetFactor: -4, polygonOffsetUnits: -4 });
  const m = new THREE.Mesh(geo, mat);
  m.castShadow = false;
  m.receiveShadow = true;
  m.name = 'face';
  return m;
}

/** Textur eines vorhandenen Decals tauschen (Stimmungswechsel zur Laufzeit). */
export function setFace(decal, texture) {
  decal.material.map = texture;
  decal.material.needsUpdate = true;
  return decal;
}
