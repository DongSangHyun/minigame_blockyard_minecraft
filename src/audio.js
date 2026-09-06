// audio.js — 소리
import { S } from "./state.js";
import { DEADBUSH, DIRT, DRYGRASS, FLOWER_R, FLOWER_Y, GLASS, GRASS, ICE, LAMP, LEAVES, LOG, PLANKS, SAND, SNOW, TALLGRASS, TORCH } from "./blocks.js";
import { dayLight } from "./daynight.js";
import { opts } from "./settings.js";

export function ac() {
  if (!S.audioCtx) {
    try {
      S.audioCtx = new (window.AudioContext || window.webkitAudioContext)();
      S.masterGain = S.audioCtx.createGain();
      S.masterGain.gain.value = opts.vol / 100;
      // 잠수하면 이 필터의 차단 주파수를 내려 소리를 먹먹하게 만든다
      S.muffle = S.audioCtx.createBiquadFilter();
      S.muffle.type = "lowpass";
      S.muffle.frequency.value = 20000;
      S.masterGain.connect(S.muffle);
      S.muffle.connect(S.audioCtx.destination);
    } catch (e) { return null; }
  }
  if (S.audioCtx.state === "suspended") S.audioCtx.resume();
  return S.audioCtx;
}
// node — 소리가 나갈 자리. 비우면 정중앙(masterGain), at(x,y,z) 를 주면 그 자리에서 난다.
// 패너는 한 번 쓰고 버린다 — 소리가 끝나면 그래프에서 알아서 떨어진다.
export function tone(freq, dur, type, gain, node) {
  if (S.muted || opts.vol <= 0) return;
  var c = ac(); if (!c) return;
  try {
    var o = c.createOscillator(), g = c.createGain();
    o.type = type; o.frequency.value = freq;
    o.frequency.exponentialRampToValueAtTime(Math.max(30, freq * 0.55), c.currentTime + dur);
    g.gain.value = gain;
    g.gain.exponentialRampToValueAtTime(0.0001, c.currentTime + dur);
    o.connect(g); g.connect(node || S.masterGain);
    o.start(); o.stop(c.currentTime + dur);
  } catch (e) {}
}
export function crunch(dur, gain, cutoff, node) {
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
    src.connect(flt); flt.connect(g); g.connect(node || S.masterGain);
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
SOFT[DEADBUSH] = 1; SOFT[DRYGRASS] = 1;
export function breakSound(b) {
  if (SOFT[b]) crunch(0.16, 0.16, 900);
  else if (b === GLASS || b === LAMP) { tone(1400, 0.09, "square", 0.05); crunch(0.1, 0.1, 4200); }
  else if (b === LOG || b === PLANKS) crunch(0.14, 0.15, 1500);
  else crunch(0.2, 0.2, 2600);
}
export function stepSound(b, through) {
  // 풀숲을 헤치고 지나가면 바스락 소리가 먼저 난다
  if (through) crunch(0.06, 0.05, 620);
  if (!b) return;
  if (b === ICE) { tone(1650 + Math.random() * 250, 0.05, "triangle", 0.03);
                   crunch(0.05, 0.035, 3200); return; }
  crunch(0.07, SOFT[b] ? 0.045 : 0.055, SOFT[b] ? 700 : 1800);
}
// 놓는 소리 — 캐는 소리보다 짧고 낮게, 재질은 그대로 구분한다
// 물·용암에 잠기면 소리가 멀어진다
export function setMuffle(on) {
  if (!S.muffle || !S.audioCtx) return;
  var target = on ? 420 : 20000;
  var f = S.muffle.frequency;
  if (Math.abs(f.value - target) < 1) return;
  try { f.setTargetAtTime(target, S.audioCtx.currentTime, 0.08); }
  catch (e) { f.value = target; }
}

// 빗소리 — 날씨가 켜져 있는 동안 낮게 깔린다
export function rainHiss(vol) {
  crunch(0.9, 0.05 * vol, 2600);
}
// 천둥 — 번쩍인 뒤 거리만큼 늦게 울린다
export function thunder(delayMs, near) {
  setTimeout(function () {
    crunch(1.6, near ? 0.30 : 0.16, near ? 700 : 320);
    tone(46, 1.9, "sine", near ? 0.10 : 0.05);
  }, delayMs);
}

// 배경음 — 몇 분에 한 번, 세 음짜리 화음이 스치듯 지나간다.
// 루프 음악이 아니라 "가끔 들리는 것" 이라야 오래 켜 둬도 질리지 않는다.
var MOOD_DAY = [[262, 330, 392], [294, 370, 440], [220, 277, 330]];
var MOOD_NIGHT = [[196, 233, 294], [175, 220, 262], [147, 185, 220]];
export function moodChord(night, vol) {
  var set = night ? MOOD_NIGHT : MOOD_DAY;
  var ch = set[(Math.random() * set.length) | 0];
  for (var i = 0; i < ch.length; i++) {
    (function (f, k) {
      setTimeout(function () {
        tone(f, 3.4 + Math.random(), "sine", 0.020 * vol);
      }, k * (240 + Math.random() * 260));
    })(ch[i], i);
  }
}

// 동굴 울림 — 깊고 어두운 곳에서 가끔 낮게 울린다 (마크의 동굴 소리)
export function caveSound(depthMix) {
  var f = 90 + Math.random() * 120;
  tone(f, 1.6 + Math.random(), "sine", 0.030 * depthMix);
  if (Math.random() < 0.35) {
    // 물방울
    setTimeout(function () {
      tone(900 + Math.random() * 700, 0.10, "sine", 0.035 * depthMix);
    }, 400 + Math.random() * 900);
  }
}

// 용암 — 가까이 가면 "뽀글" 소리로 존재를 알린다. 지하의 유일한 긴장 요소.
// 소리가 나는 자리를 지정한다 (없으면 머리 위)
export function at(x, y, z) {
  var c = ac();
  if (!c || !c.createPanner) return null;
  var pn = c.createPanner();
  pn.panningModel = "equalpower";
  pn.distanceModel = "inverse";
  pn.refDistance = 4;
  pn.maxDistance = 60;
  pn.rolloffFactor = 1.4;
  if (pn.positionX) {
    pn.positionX.value = x; pn.positionY.value = y; pn.positionZ.value = z;
  } else pn.setPosition(x, y, z);
  pn.connect(S.masterGain);
  return pn;
}
// 듣는 사람의 자리와 방향을 매 프레임 알려 준다
export function listenAt(x, y, z, fx, fz) {
  var c = S.audioCtx;
  if (!c || !c.listener) return;
  var L = c.listener;
  try {
    if (L.positionX) {
      L.positionX.value = x; L.positionY.value = y; L.positionZ.value = z;
      L.forwardX.value = fx; L.forwardY.value = 0; L.forwardZ.value = fz;
      L.upX.value = 0; L.upY.value = 1; L.upZ.value = 0;
    } else {
      L.setPosition(x, y, z);
      L.setOrientation(fx, 0, fz, 0, 1, 0);
    }
  } catch (e) {}
}

export function lavaPop(vol, node) {
  tone(70 + Math.random() * 50, 0.22, "sine", 0.10 * vol, node);
  crunch(0.18, 0.05 * vol, 320, node);
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
