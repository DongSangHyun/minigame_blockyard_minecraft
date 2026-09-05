// audio.js — 소리
import { S } from "./state.js";
import { DIRT, FLOWER_R, FLOWER_Y, GLASS, GRASS, LAMP, LEAVES, LOG, PLANKS, SAND, SNOW, TALLGRASS, TORCH } from "./blocks.js";
import { dayLight } from "./daynight.js";
import { opts } from "./settings.js";

export function ac() {
  if (!S.audioCtx) {
    try {
      S.audioCtx = new (window.AudioContext || window.webkitAudioContext)();
      S.masterGain = S.audioCtx.createGain();
      S.masterGain.gain.value = opts.vol / 100;
      S.masterGain.connect(S.audioCtx.destination);
    } catch (e) { return null; }
  }
  if (S.audioCtx.state === "suspended") S.audioCtx.resume();
  return S.audioCtx;
}
export function tone(freq, dur, type, gain) {
  if (S.muted || opts.vol <= 0) return;
  var c = ac(); if (!c) return;
  try {
    var o = c.createOscillator(), g = c.createGain();
    o.type = type; o.frequency.value = freq;
    o.frequency.exponentialRampToValueAtTime(Math.max(30, freq * 0.55), c.currentTime + dur);
    g.gain.value = gain;
    g.gain.exponentialRampToValueAtTime(0.0001, c.currentTime + dur);
    o.connect(g); g.connect(S.masterGain);
    o.start(); o.stop(c.currentTime + dur);
  } catch (e) {}
}
export function crunch(dur, gain, cutoff) {
  if (S.muted || opts.vol <= 0) return;
  var c = ac(); if (!c) return;
  try {
    var n = Math.floor(c.sampleRate * dur);
    var buf = c.createBuffer(1, n, c.sampleRate);
    var d = buf.getChannelData(0);
    for (var i = 0; i < n; i++) d[i] = (Math.random() * 2 - 1) * (1 - i / n);
    var src = c.createBufferSource(); src.buffer = buf;
    var flt = c.createBiquadFilter(); flt.type = "lowpass"; flt.frequency.value = cutoff;
    var g = c.createGain(); g.gain.value = gain;
    g.gain.exponentialRampToValueAtTime(0.0001, c.currentTime + dur);
    src.connect(flt); flt.connect(g); g.connect(S.masterGain);
    src.start();
  } catch (e) {}
}

export function startAmbient() {
  var c = ac();
  if (!c || S.ambient) return;
  try {
    var n = Math.floor(c.sampleRate * 4);
    var buf = c.createBuffer(1, n, c.sampleRate);
    var d = buf.getChannelData(0), last = 0;
    for (var i = 0; i < n; i++) {
      last = last * 0.96 + (Math.random() * 2 - 1) * 0.04;
      d[i] = last * 3.2;
    }
    var src = c.createBufferSource(); src.buffer = buf; src.loop = true;
    var flt = c.createBiquadFilter(); flt.type = "lowpass"; flt.frequency.value = 380;
    var g = c.createGain(); g.gain.value = 0;
    src.connect(flt); flt.connect(g); g.connect(S.masterGain);
    src.start();
    S.ambient = { gain: g, filter: flt };
  } catch (e) { S.ambient = null; }
}
export function updateAmbient(dt) {
  if (!S.ambient) return;
  var target = (!S.active || S.muted || opts.vol <= 0) ? 0
             : (S.weather === 1 ? 0.10 : S.weather === 2 ? 0.045 : 0.020);
  var g = S.ambient.gain.gain;
  g.value += (target - g.value) * Math.min(1, dt * 1.5);
  S.ambient.filter.frequency.value = S.weather === 1 ? 1500 : 380;

  if (S.active && !S.weather && !S.muted && dayLight(S.timeOfDay) < 0.35) {
    S.cricketTimer -= dt;
    if (S.cricketTimer <= 0) {
      S.cricketTimer = 1.8 + Math.random() * 3.4;
      var base = 2100 + Math.random() * 480;
      for (var k = 0; k < 3; k++) {
        (function (f, delay) {
          setTimeout(function () { tone(f, 0.04, "triangle", 0.010); }, delay);
        })(base, k * 95);
      }
    }
  }
}

export var SOFT = {};
SOFT[GRASS] = 1; SOFT[DIRT] = 1; SOFT[SAND] = 1; SOFT[LEAVES] = 1; SOFT[SNOW] = 1;
SOFT[TALLGRASS] = 1; SOFT[FLOWER_R] = 1; SOFT[FLOWER_Y] = 1; SOFT[TORCH] = 1;
export function breakSound(b) {
  if (SOFT[b]) crunch(0.16, 0.16, 900);
  else if (b === GLASS || b === LAMP) { tone(1400, 0.09, "square", 0.05); crunch(0.1, 0.1, 4200); }
  else if (b === LOG || b === PLANKS) crunch(0.14, 0.15, 1500);
  else crunch(0.2, 0.2, 2600);
}
export function stepSound(b) {
  if (!b) return;
  crunch(0.07, SOFT[b] ? 0.045 : 0.055, SOFT[b] ? 700 : 1800);
}
// 놓는 소리 — 캐는 소리보다 짧고 낮게, 재질은 그대로 구분한다
// 용암 — 가까이 가면 "뽀글" 소리로 존재를 알린다. 지하의 유일한 긴장 요소.
export function lavaPop(vol) {
  tone(70 + Math.random() * 50, 0.22, "sine", 0.10 * vol);
  crunch(0.18, 0.05 * vol, 320);
}
// 용암에 발을 담글 때의 치익 소리
export function lavaHiss() {
  crunch(0.55, 0.22, 900);
  tone(180, 0.5, "sawtooth", 0.05);
}

export function placeSound(b) {
  if (SOFT[b]) crunch(0.09, 0.10, 850);
  else if (b === GLASS || b === LAMP) { tone(1180, 0.05, "square", 0.035); crunch(0.06, 0.06, 3600); }
  else if (b === LOG || b === PLANKS) crunch(0.08, 0.10, 1400);
  else crunch(0.10, 0.12, 2300);
}
// 캐는 중 반복해서 나는 "턱-턱" 소리
export function miningSound(b) {
  if (SOFT[b]) crunch(0.05, 0.045, 700);
  else if (b === LOG || b === PLANKS) crunch(0.05, 0.05, 1200);
  else crunch(0.055, 0.055, 2000);
}
