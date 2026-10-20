// ui.js — HTML-Overlay im Comic-Look: HUD (Geld, Ware, Heat), Hinweis-Prompt, Sprechblase mit Optionen,
// „Verhaftet“-Bildschirm. Keine Spiel-Logik hier, nur Anzeige.
import { heatLabel, MAX_HEAT } from './game.js';

export function createUI() {
  const hud = document.getElementById('hud');
  const prompt = document.getElementById('prompt');
  const bubble = document.getElementById('bubble');
  const arrest = document.getElementById('arrest');

  function setHud(state) {
    if (!hud) return;
    hud.innerHTML = `
      <span class="hud-item"><b>Tag ${state.tag}</b></span>
      <span class="hud-item">💰 <b>${state.geld}</b></span>
      <span class="hud-item">🌿 <b>${state.ware}</b></span>
      <span class="hud-item heat-${state.heat}">Heat <b>${heatLabel(state.heat)}</b></span>`;
  }

  function showPrompt(text) {
    if (!prompt) return;
    if (!text) { prompt.style.display = 'none'; return; }
    prompt.textContent = text;
    prompt.style.display = 'block';
  }

  /** dialog: { text, options[], selected }, speaker: Name/Typ; anchor: Bildschirmposition des Kopfs */
  function showBubble(dialog, speaker, selected = 0) {
    if (!bubble) return;
    const opts = (dialog.options || []).map((o, i) =>
      `<button class="opt${i === selected ? ' sel' : ''}" data-i="${i}"><span class="key">${i + 1}</span> ${o}</button>`).join('');
    bubble.innerHTML = `<div class="who">${speaker}</div><div class="say">${escapeHtml(dialog.text)}</div><div class="opts">${opts}</div>`;
    bubble.style.display = 'block';
  }
  function hideBubble() { if (bubble) bubble.style.display = 'none'; }
  function placeBubble(sx, sy) {
    if (!bubble) return;
    const w = bubble.offsetWidth || 320, h = bubble.offsetHeight || 120;
    const x = Math.max(12, Math.min(window.innerWidth - w - 12, sx - w / 2));
    const y = Math.max(12, Math.min(window.innerHeight - h - 12, sy - h - 26));
    bubble.style.left = `${x}px`;
    bubble.style.top = `${y}px`;
  }

  function showArrest(state) {
    if (!arrest) return;
    arrest.innerHTML = `<div class="card"><h1>VERHAFTET.</h1><p>Tag ${state.tag} verloren. Ware weg.<br>Geld bleibt: 💰 ${state.geld}</p>
      <p class="small">Heat ${heatLabel(MAX_HEAT)} — „Turnschuhe, Mann. Ich hab's dir gesagt.“</p>
      <button class="opt sel" data-i="0"><span class="key">⏎</span> Neuer Tag</button></div>`;
    arrest.style.display = 'flex';
  }
  function hideArrest() { if (arrest) arrest.style.display = 'none'; }

  function onOptionClick(handler) {
    for (const el of [bubble, arrest]) {
      if (!el) continue;
      el.addEventListener('click', (e) => {
        const b = e.target.closest('button.opt');
        if (b) handler(parseInt(b.dataset.i, 10), el === arrest ? 'arrest' : 'bubble');
      });
    }
  }

  return { setHud, showPrompt, showBubble, hideBubble, placeBubble, showArrest, hideArrest, onOptionClick };
}

function escapeHtml(s) {
  return String(s).replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
}
