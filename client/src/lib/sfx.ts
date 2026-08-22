'use client';

import { isAudioMuted, masterVolume } from './audioManager';

let ctx: AudioContext | null = null;

function context(): AudioContext | null {
  if (typeof window === 'undefined') return null;
  if (!ctx) {
    const Ctor = window.AudioContext ?? (window as unknown as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;
    if (!Ctor) return null;
    ctx = new Ctor();
  }
  if (ctx.state === 'suspended') void ctx.resume();
  return ctx;
}

function tone(freq: number, start: number, duration: number, gainValue = 0.06, type: OscillatorType = 'sine') {
  const audio = context();
  if (!audio) return;
  const osc = audio.createOscillator();
  const gain = audio.createGain();
  osc.type = type;
  osc.frequency.setValueAtTime(freq, audio.currentTime + start);
  gain.gain.setValueAtTime(0, audio.currentTime + start);
  gain.gain.linearRampToValueAtTime(gainValue * masterVolume(), audio.currentTime + start + 0.02);
  gain.gain.exponentialRampToValueAtTime(0.0001, audio.currentTime + start + duration);
  osc.connect(gain).connect(audio.destination);
  osc.start(audio.currentTime + start);
  osc.stop(audio.currentTime + start + duration + 0.05);
}

export function playSfx(kind: 'flip' | 'night' | 'day' | 'stamp' | 'death' | 'click' | 'gunshot' | 'paper') {
  try {
    if (isAudioMuted()) return;
    switch (kind) {
      case 'click':
        tone(1150, 0, 0.045, 0.028, 'square');
        tone(760, 0.03, 0.055, 0.022, 'triangle');
        break;
      case 'flip':
        tone(320, 0, 0.12, 0.05, 'triangle');
        tone(480, 0.1, 0.16, 0.05, 'triangle');
        break;
      case 'night':
        tone(220, 0, 0.5, 0.05, 'sine');
        tone(165, 0.25, 0.6, 0.05, 'sine');
        break;
      case 'day':
        tone(392, 0, 0.2, 0.05, 'triangle');
        tone(523, 0.15, 0.3, 0.05, 'triangle');
        break;
      case 'stamp':
        tone(110, 0, 0.12, 0.09, 'square');
        tone(70, 0.05, 0.15, 0.07, 'square');
        break;
      case 'death':
        tone(196, 0, 0.4, 0.06, 'sawtooth');
        tone(147, 0.2, 0.5, 0.05, 'sawtooth');
        break;
      case 'gunshot':
        noiseBurst(0.14, 0.35, 900);
        tone(90, 0, 0.18, 0.12, 'square');
        break;
      case 'paper':
        noiseBurst(0.09, 0.08, 3200);
        noiseBurst(0.07, 0.06, 2600);
        break;
    }
  } catch {
    /* audio unavailable */
  }
}

function noiseBurst(start: number, duration: number, cutoffHz: number) {
  const audio = context();
  if (!audio) return;
  const length = Math.max(1, Math.floor(audio.sampleRate * duration));
  const buffer = audio.createBuffer(1, length, audio.sampleRate);
  const data = buffer.getChannelData(0);
  for (let i = 0; i < data.length; i += 1) {
    data[i] = (Math.random() * 2 - 1) * masterVolume();
  }
  const src = audio.createBufferSource();
  const filter = audio.createBiquadFilter();
  const gain = audio.createGain();
  src.buffer = buffer;
  filter.type = 'lowpass';
  filter.frequency.value = cutoffHz;
  gain.gain.setValueAtTime(0.001, audio.currentTime + start);
  gain.gain.exponentialRampToValueAtTime(0.0001, audio.currentTime + start + duration);
  src.connect(filter).connect(gain).connect(audio.destination);
  src.start(audio.currentTime + start);
}

/* --- Ambient rain engine (looping filtered noise bed) --- */

let ambientNodes: { src: AudioBufferSourceNode; gain: GainNode; poll: number } | null = null;

export function startAmbientRain() {
  if (ambientNodes || typeof window === 'undefined') return;
  if (isAudioMuted()) return;
  const audio = context();
  if (!audio) return;
  try {
    const seconds = 2.4;
    const buffer = audio.createBuffer(1, Math.floor(audio.sampleRate * seconds), audio.sampleRate);
    const data = buffer.getChannelData(0);
    for (let i = 0; i < data.length; i += 1) {
      data[i] = Math.random() * 2 - 1;
    }
    const src = audio.createBufferSource();
    const filter = audio.createBiquadFilter();
    const gain = audio.createGain();
    src.buffer = buffer;
    src.loop = true;
    filter.type = 'lowpass';
    filter.frequency.value = 850;
    filter.Q.value = 0.4;
    gain.gain.setValueAtTime(0, audio.currentTime);
    gain.gain.linearRampToValueAtTime(0.045 * masterVolume(), audio.currentTime + 2);
    src.connect(filter).connect(gain).connect(audio.destination);
    src.start();
    // Live mute/volume toggle support without restarting the loop.
    const poll = window.setInterval(() => {
      if (!ambientNodes || typeof window === 'undefined') return;
      ambientNodes.gain.gain.setTargetAtTime(0.045 * masterVolume(), ctx?.currentTime ?? 0, 0.3);
      if (isAudioMuted()) stopAmbientRain();
    }, 1500);
    ambientNodes = { src, gain, poll };
  } catch {
    /* audio unavailable */
  }
}

export function stopAmbientRain() {
  if (!ambientNodes) return;
  try {
    if (typeof window !== 'undefined') window.clearInterval(ambientNodes.poll);
    ambientNodes.gain.gain.setTargetAtTime(0, ctx?.currentTime ?? 0, 0.25);
    const nodes = ambientNodes;
    window.setTimeout(() => {
      try {
        nodes.src.stop();
      } catch {
        /* already stopped */
      }
    }, 700);
  } catch {
    /* ignore */
  }
  ambientNodes = null;
}

let clickSfxBound = false;

/* --- Night ambience: looping mp3 bed (rain / distant howls) --- */

let nightAudio: HTMLAudioElement | null = null;
let nightMutePoll: number | null = null;

export function startNightAmbient() {
  if (nightAudio || typeof window === 'undefined') return;
  if (isAudioMuted()) return;
  try {
    const audio = new Audio('/assets/sounds/night_ambient.mp3');
    audio.loop = true;
    audio.volume = 0.5 * masterVolume();
    void audio.play().catch(() => {});
    nightAudio = audio;
    nightMutePoll = window.setInterval(() => {
      if (!nightAudio) return;
      if (isAudioMuted()) {
        stopNightAmbient();
        return;
      }
      nightAudio.volume = 0.5 * masterVolume();
    }, 1500);
  } catch {
    /* audio unavailable */
  }
}

export function stopNightAmbient() {
  if (nightMutePoll !== null && typeof window !== 'undefined') {
    window.clearInterval(nightMutePoll);
    nightMutePoll = null;
  }
  if (!nightAudio) return;
  const audio = nightAudio;
  nightAudio = null;
  try {
    audio.volume = 0;
    audio.pause();
    audio.currentTime = 0;
  } catch {
    /* already dead */
  }
}

/**
 * Delegated button SFX: one listener gives every <button> on every screen
 * the exact same tactile click, honouring the global mute flag.
 */
export function initGlobalSfx() {
  if (clickSfxBound || typeof window === 'undefined' || typeof document === 'undefined') return;
  clickSfxBound = true;
  document.addEventListener(
    'pointerdown',
    (event) => {
      const target = event.target as Element | null;
      if (!target || typeof target.closest !== 'function') return;
      const control = target.closest('button, [role="button"]');
      if (!control) return;
      if (control.hasAttribute('disabled') || control.getAttribute('aria-disabled') === 'true') return;
      playSfx('click');
    },
    { capture: true },
  );
}
