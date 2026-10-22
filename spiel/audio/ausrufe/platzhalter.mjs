// Platzhalter-Clips für die Ausrufe erzeugen (WAV, mono, 11 kHz, kurze Blips) — bis echte Aufnahmen da sind.
// Aufruf aus dem Ordner spiel/: node audio/ausrufe/platzhalter.mjs
// Erzeugt für jeden Eintrag in manifest.json → clips[] mit "platzhalter": true die Datei(en) aus "dateien"/"datei" (nur .wav).
import { readFileSync, writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const here = dirname(fileURLToPath(import.meta.url));
const manifest = JSON.parse(readFileSync(join(here, 'manifest.json'), 'utf8'));
const RATE = 11025;

// Einfacher Hash → stabile, aber je id verschiedene Tonfolge
const hash = (s) => { let h = 2166136261; for (const c of s) { h ^= c.charCodeAt(0); h = Math.imul(h, 16777619); } return h >>> 0; };

function blipClip(id) {
  const h = hash(id);
  const n = 2 + (h % 3);                    // 2–4 Blips
  const seg = 0.11 + ((h >> 4) % 5) * 0.02;  // Blip-Länge
  const total = n * seg + 0.08;
  const len = Math.floor(total * RATE);
  const pcm = new Float32Array(len);
  for (let b = 0; b < n; b++) {
    const f = 300 + (((h >> (b * 5)) % 9) * 60);
    const t0 = b * seg;
    for (let i = 0; i < seg * RATE; i++) {
      const t = i / RATE;
      const env = Math.min(1, t / 0.008) * Math.exp(-t * 14);
      const idx = Math.floor((t0 + t) * RATE);
      if (idx < len) pcm[idx] += 0.6 * env * (Math.sin(2 * Math.PI * f * t) + 0.3 * Math.sin(2 * Math.PI * f * 2 * t));
    }
  }
  return pcm;
}

function wav(pcm) {
  const buf = Buffer.alloc(44 + pcm.length * 2);
  buf.write('RIFF', 0); buf.writeUInt32LE(36 + pcm.length * 2, 4); buf.write('WAVE', 8);
  buf.write('fmt ', 12); buf.writeUInt32LE(16, 16); buf.writeUInt16LE(1, 20); buf.writeUInt16LE(1, 22);
  buf.writeUInt32LE(RATE, 24); buf.writeUInt32LE(RATE * 2, 28); buf.writeUInt16LE(2, 32); buf.writeUInt16LE(16, 34);
  buf.write('data', 36); buf.writeUInt32LE(pcm.length * 2, 40);
  for (let i = 0; i < pcm.length; i++) buf.writeInt16LE(Math.max(-32768, Math.min(32767, Math.round(pcm[i] * 32767))), 44 + i * 2);
  return buf;
}

let n = 0;
for (const e of manifest.clips) {
  if (!e.platzhalter) continue;
  const files = e.dateien || (e.datei ? [e.datei] : []);
  for (const f of files) {
    if (!f.endsWith('.wav')) continue;
    writeFileSync(join(here, f), wav(blipClip(e.id)));
    n++;
  }
}
console.log(`${n} Platzhalter-Clips geschrieben`);
