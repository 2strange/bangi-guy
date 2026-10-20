// ui.js — HTML-Overlay im Comic-Look: HUD (Geld, Ware, Heat), Hinweis-Prompt, Sprechblase mit Optionen,
// Vollbild-Karten („Verhaftet“, Tagesbilanz) und die Touch-Steuerung (Joystick + große Buttons).
// Keine Spiel-Logik hier, nur Anzeige und Eingabe-Weiterleitung.
import { heatLabel, MAX_HEAT } from './game.js';

export function isTouchDevice() {
  return (typeof window !== 'undefined') && (('ontouchstart' in window) || (navigator.maxTouchPoints || 0) > 0);
}

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
      <span class="hud-item${state.ware === 0 ? ' empty' : ''}">🌿 <b>${state.ware}</b></span>
      <span class="hud-item heat-${state.heat}">Heat <b>${heatLabel(state.heat)}</b></span>`;
  }

  function showPrompt(text) {
    if (!prompt) return;
    if (!text) { prompt.style.display = 'none'; return; }
    prompt.textContent = text;
    prompt.style.display = 'block';
  }

  /** dialog: { text, options[] }, speaker: Name/Typ; selected: markierte Option */
  function showBubble(dialog, speaker, selected = 0) {
    if (!bubble) return;
    const opts = (dialog.options || []).map((o, i) =>
      `<button class="opt${i === selected ? ' sel' : ''}" data-i="${i}"><span class="key">${i + 1}</span> ${escapeHtml(o)}</button>`).join('');
    bubble.innerHTML = `<div class="who">${escapeHtml(speaker)}</div><div class="say">${escapeHtml(dialog.text)}</div><div class="opts">${opts}</div>`;
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

  // Vollbild-Karte (Verhaftet / Tagesbilanz)
  function showCard({ titel, zeilen = [], klein = null, button = 'Weiter', rot = false }) {
    if (!arrest) return;
    arrest.innerHTML = `<div class="card"><h1 class="${rot ? 'rot' : ''}">${escapeHtml(titel)}</h1>
      ${zeilen.map((z) => `<p>${escapeHtml(z)}</p>`).join('')}
      ${klein ? `<p class="small">${escapeHtml(klein)}</p>` : ''}
      <button class="opt sel" data-i="0"><span class="key">⏎</span> ${escapeHtml(button)}</button></div>`;
    arrest.style.display = 'flex';
  }
  function showArrest(state, button = 'Neuer Tag') {
    showCard({
      titel: 'VERHAFTET.', rot: true,
      zeilen: [`Tag ${state.tag} verloren. Ware weg.`, `Geld bleibt: 💰 ${state.geld}`],
      klein: `Heat ${heatLabel(MAX_HEAT)} — „Turnschuhe, Mann. Ich hab's dir gesagt.“`, button,
    });
  }
  function hideCard() { if (arrest) arrest.style.display = 'none'; }

  function onOptionClick(handler) {
    for (const el of [bubble, arrest]) {
      if (!el) continue;
      el.addEventListener('click', (e) => {
        const b = e.target.closest('button.opt');
        if (b) handler(parseInt(b.dataset.i, 10), el === arrest ? 'card' : 'bubble');
      });
    }
  }

  // ---------- Touch-Steuerung ----------
  /**
   * handlers: { onJoystick(dx, dy) | onJoystick(null) beim Loslassen, onTalk, onLook, onCamLeft, onCamRight }
   * Zeigt sich nur nach show(); Joystick-Mathe steckt in logic.joystickInput (rein, getestet).
   */
  function createTouchControls(handlers) {
    const root = document.getElementById('touch');
    if (!root) return { show() {}, hide() {}, radius: 60 };
    root.innerHTML = `
      <div id="joy"><div id="joy-base"><div id="joy-knob"></div></div></div>
      <div id="touch-buttons">
        <button id="btn-cam-l" class="tbtn small" aria-label="Kamera links">↺</button>
        <button id="btn-cam-r" class="tbtn small" aria-label="Kamera rechts">↻</button>
        <button id="btn-look" class="tbtn" aria-label="Schauen">👀<span>Schauen</span></button>
        <button id="btn-talk" class="tbtn" aria-label="Reden">💬<span>Reden</span></button>
      </div>`;
    const joy = root.querySelector('#joy'), base = root.querySelector('#joy-base'), knob = root.querySelector('#joy-knob');
    const radius = 60;
    let pointerId = null, cx = 0, cy = 0;
    const setKnob = (dx, dy) => { knob.style.transform = `translate(${dx}px, ${dy}px)`; };
    joy.addEventListener('pointerdown', (e) => {
      pointerId = e.pointerId;
      const r = base.getBoundingClientRect();
      cx = r.left + r.width / 2; cy = r.top + r.height / 2;
      joy.setPointerCapture(pointerId);
      e.preventDefault();
    });
    const move = (e) => {
      if (e.pointerId !== pointerId) return;
      let dx = e.clientX - cx, dy = e.clientY - cy;
      const len = Math.hypot(dx, dy);
      if (len > radius) { dx *= radius / len; dy *= radius / len; }
      setKnob(dx, dy);
      handlers.onJoystick?.(dx, dy);
      e.preventDefault();
    };
    const end = (e) => {
      if (e.pointerId !== pointerId) return;
      pointerId = null; setKnob(0, 0);
      handlers.onJoystick?.(null);
    };
    joy.addEventListener('pointermove', move);
    joy.addEventListener('pointerup', end);
    joy.addEventListener('pointercancel', end);
    const bind = (id, fn, repeat = false) => {
      const b = root.querySelector(id);
      let timer = null;
      b.addEventListener('pointerdown', (e) => { e.preventDefault(); fn(true); if (repeat) timer = setInterval(() => fn(true), 16); });
      const stop = () => { if (timer) { clearInterval(timer); timer = null; } fn(false); };
      b.addEventListener('pointerup', stop); b.addEventListener('pointercancel', stop); b.addEventListener('pointerleave', stop);
    };
    bind('#btn-talk', (down) => { if (down) handlers.onTalk?.(); });
    bind('#btn-look', (down) => { if (down) handlers.onLook?.(); });
    bind('#btn-cam-l', (down) => handlers.onCamLeft?.(down));
    bind('#btn-cam-r', (down) => handlers.onCamRight?.(down));
    return {
      radius,
      show() { root.style.display = 'block'; document.body.classList.add('touch'); },
      hide() { root.style.display = 'none'; document.body.classList.remove('touch'); },
    };
  }

  return { setHud, showPrompt, showBubble, hideBubble, placeBubble, showCard, showArrest, hideCard, hideArrest: hideCard, onOptionClick, createTouchControls };
}

function escapeHtml(s) {
  return String(s).replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
}
