// audio.js — 소리
import { S } from "./state.js";
import { CARPET, CARPET0, CARPET_COUNT, SAPLING, SAPLING_BIRCH, SAPLING_SPRUCE, DEADBUSH, DIRT, DRYGRASS, FLOWER_R, FLOWER_Y, GLASS, GRASS, ICE, LAMP, LEAVES, LOG, PLANKS, SAND, SNOW, TALLGRASS, TORCH , BIRCH_LOG, SPRUCE_LOG, BIRCH_LEAVES, SPRUCE_LEAVES, FENCE, GATE, DOOR, LADDER, BOOKSHELF, FRAME, PANE, WOOL0, WOOL_COUNT} from "./blocks.js";
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
  // 재웠으면 깨우지 않는다 (v106) — 예약된 소리가 잠금을 뒤에서 풀었다
  if (!S.audioAsleep && S.audioCtx.state === "suspended") S.audioCtx.resume();
  return S.audioCtx;
}
// node — 소리가 나갈 자리. 비우면 정중앙(masterGain), at(x,y,z) 를 주면 그 자리에서 난다.
// 패너는 한 번 쓰고 버린다 — 소리가 끝나면 그래프에서 알아서 떨어진다.
// 음높이를 매번 조금씩 흔든다 (v106) — 유리 온실 한 채(200장)를 짓는 동안
// **똑같은 1180Hz 를 200번** 들었다. 마크의 효과음은 전부 ±10% 무작위 피치다.
// 음정이 뜻인 것(다이아 팡파르)은 exact 로 뺀다
export function tone(freq, dur, type, gain, node, exact) {
  if (S.muted || opts.vol <= 0) return;
  if (!exact) freq *= 0.94 + Math.random() * 0.12;
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
// 잡음 한 벌을 부팅 때 한 번만 굽는다 (v93).
// 예전에는 crunch 를 부를 때마다 createBuffer + Math.random() 루프를 돌았다 —
// 물가에 서서 비를 맞으며 60초를 재니 **19.3MB 를 굽고 버렸다**(분당 500만 번의 난수).
// 캐고 놓을 때마다 도는 소리다. 이제 2초짜리 한 벌에서 **아무 데나 잘라 쓴다.**
export var NOISE_SEC = 2;
var noiseBuf = null;
export function noiseBuffer(c) {
  if (noiseBuf && noiseBuf.sampleRate === c.sampleRate) return noiseBuf;
  var n = Math.floor(c.sampleRate * NOISE_SEC);
  noiseBuf = c.createBuffer(1, n, c.sampleRate);
  var d = noiseBuf.getChannelData(0);
  for (var i = 0; i < n; i++) d[i] = Math.random() * 2 - 1;
  return noiseBuf;
}
export function crunch(dur, gain, cutoff, node) {
  if (S.muted || opts.vol <= 0) return;
  cutoff *= 0.92 + Math.random() * 0.16;        // 잡음도 매번 조금씩 다르게 (v106)
  gain *= 0.92 + Math.random() * 0.16;
  var c = ac(); if (!c) return;
  try {
    var buf = noiseBuffer(c);
    var src = c.createBufferSource(); src.buffer = buf;
    // 시작점을 매번 옮겨 같은 잡음이 반복으로 들리지 않게 한다
    var off = Math.random() * Math.max(0.01, NOISE_SEC - dur);
    var flt = c.createBiquadFilter(); flt.type = "lowpass"; flt.frequency.value = cutoff;
    var g = c.createGain(); g.gain.value = gain;
    g.gain.exponentialRampToValueAtTime(0.0001, c.currentTime + dur);
    src.connect(flt); flt.connect(g); g.connect(node || S.masterGain);
    src.start(0, off, dur);
    src.stop(c.currentTime + dur);      // 노드를 제때 놓아 준다
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

  // 자연음 — 밤에는 귀뚜라미, 낮에는 새. 예전에는 이 블록이 밤 조건 안에만 있어서
  // **낮에는 설계상 아무 소리도 나지 않았다** (실측: 맑은 낮 20초에 1개 · 밤 20초에 5개).
  // 혼자 오래 짓는 사람이 게임을 끄는 이유는 대개 "심심해서" 가 아니라 "적막해서" 다.
  // 눈에도 새는 운다 (v106) — 조건이 !S.weather 라 **비·눈 동안에는 새도 귀뚜라미도
  // 한 마리도 안 울었다**(60초 0회). 조용해야 할 것은 비지 눈이 아니다
  if (S.active && S.weather !== 1 && !S.muted) {
    var night = dayLight(S.timeOfDay) < 0.35;
    S.cricketTimer -= dt;
    if (S.cricketTimer <= 0) {
      if (night) {
        S.cricketTimer = 1.8 + Math.random() * 3.4;
        var base = 2100 + Math.random() * 480;
        for (var k = 0; k < 3; k++) {
          (function (f, delay) {
            setTimeout(function () { tone(f, 0.04, "triangle", 0.010); }, delay);
          })(base, k * 95);
        }
      } else {
        // 낮은 조금 더 뜸하게 — 지저귐이 잦으면 짓는 데 방해가 된다
        S.cricketTimer = 3.2 + Math.random() * 5.0;
        birdCall();
      }
    }
  }
}

export var SOFT = {};
SOFT[GRASS] = 1; SOFT[DIRT] = 1; SOFT[SAND] = 1; SOFT[LEAVES] = 1; SOFT[SNOW] = 1;
SOFT[TALLGRASS] = 1; SOFT[FLOWER_R] = 1; SOFT[FLOWER_Y] = 1; SOFT[TORCH] = 1;
SOFT[DEADBUSH] = 1; SOFT[DRYGRASS] = 1; SOFT[CARPET] = 1;   // 카펫은 발소리가 푹신하다
SOFT[SAPLING] = 1; SOFT[SAPLING_BIRCH] = 1; SOFT[SAPLING_SPRUCE] = 1;   // 묘목 세 종 (v92)
for (var ci = 0; ci < CARPET_COUNT; ci++) SOFT[CARPET0 + ci] = 1;   // 색 카펫도 (v84)

// 나무와 천을 돌에서 떼어낸다 (v106).
// 78종 중 **43종이 똑같은 「돌」 소리**였다 — 양털 16색도, 문도 울타리도 사다리도 책장도,
// **자작나무와 가문비 원목**까지. v92·v96 이 묘목 세 종과 가문비 원목을 넣으며
// "한눈에 갈라져야 한다" 고 아틀라스를 새로 그렸는데 **귀로는 참나무만 나무**였다.
// 발소리도 이 표를 보므로 내가 깐 판자 바닥과 돌바닥 소리가 같았다
export var WOOD = {};
WOOD[LOG] = 1; WOOD[PLANKS] = 1; WOOD[BIRCH_LOG] = 1; WOOD[SPRUCE_LOG] = 1;
WOOD[FENCE] = 1; WOOD[GATE] = 1; WOOD[DOOR] = 1; WOOD[LADDER] = 1;
WOOD[BOOKSHELF] = 1; WOOD[FRAME] = 1;
export var CLOTH = {};
for (var wi2 = 0; wi2 < WOOL_COUNT; wi2++) CLOTH[WOOL0 + wi2] = 1;
export var GLASSY = {};
GLASSY[GLASS] = 1; GLASSY[LAMP] = 1; GLASSY[PANE] = 1; GLASSY[ICE] = 1;
// 잎 넷은 푹신한 쪽이다 (참나무 잎만 SOFT 에 있었다)
SOFT[BIRCH_LEAVES] = 1; SOFT[SPRUCE_LEAVES] = 1;
// 연달아 캘 때는 소리를 깎는다 (v106) — 「캐기 속도: 즉시」로 벽을 쓸면
// 초당 14.5개가 게인 0.20 으로 한꺼번에 나 통째로 굉음이었다
var lastBreakAt = -99, breakRun = 0;
function breakDuck() {
  var now = (S.audioCtx && S.audioCtx.currentTime) || 0;
  if (now - lastBreakAt < 0.12) breakRun = Math.min(6, breakRun + 1);
  else breakRun = 0;
  lastBreakAt = now;
  return 1 / (1 + breakRun * 0.55);
}
export function breakSound(b) {
  var duck = breakDuck();
  if (duck < 0.99) {
    // 쓸어 캐는 중 — 짧고 작게 한 번만
    crunch(0.07, 0.09 * duck, SOFT[b] ? 900 : (WOOD[b] ? 1500 : 2600));
    return;
  }
  if (SOFT[b]) crunch(0.16, 0.16, 900);
  else if (GLASSY[b]) { tone(1400, 0.09, "square", 0.05); crunch(0.1, 0.1, 4200); }
  else if (CLOTH[b]) crunch(0.15, 0.13, 560);          // 양털 — 게임에서 가장 푹신하다
  else if (WOOD[b]) crunch(0.14, 0.15, 1500);
  else crunch(0.2, 0.2, 2600);
}
export function stepSound(b, through) {
  // 풀숲을 헤치고 지나가면 바스락 소리가 먼저 난다
  if (through) crunch(0.06, 0.05, 620);
  if (!b) return;
  if (b === ICE) { tone(1650 + Math.random() * 250, 0.05, "triangle", 0.03);
                   crunch(0.05, 0.035, 3200); return; }
  crunch(0.07, (SOFT[b] || CLOTH[b]) ? 0.045 : 0.055,
         CLOTH[b] ? 520 : (SOFT[b] ? 700 : (WOOD[b] ? 1150 : 1800)));
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
// 빗소리 — **끊김 없는 루프**다 (v93).
// 예전에는 0.9초짜리 잡음 버스트를 0.8초마다 겹쳐 틀어, 페이드아웃이 서로 물리며
// "쉬—… 쉬—…" 하고 1.25Hz 로 맥동했다. 마크의 비는 이어진 소리다.
// 이제 루프를 하나 깔아 두고 **게인만** 오르내린다.
var rainNode = null;
export function rainHiss(vol) {
  var c = ac(); if (!c) return;
  try {
    if (!rainNode) {
      var src = c.createBufferSource();
      src.buffer = noiseBuffer(c); src.loop = true;
      var flt = c.createBiquadFilter(); flt.type = "bandpass";
      flt.frequency.value = 2600; flt.Q.value = 0.35;
      var g = c.createGain(); g.gain.value = 0;
      src.connect(flt); flt.connect(g); g.connect(S.masterGain);
      src.start();
      rainNode = { gain: g };
    }
    var target = (S.muted || opts.vol <= 0) ? 0 : 0.05 * vol;
    rainNode.gain.gain.setTargetAtTime(target, c.currentTime, 0.35);
  } catch (e) {}
}
// 탭을 나가면 rAF 가 멎어 rainHiss 도 안 불린다 — 마지막 게인 그대로 영원히 운다.
// 소리를 통째로 재우고 깨우는 길 (v93)
export function setAudioAwake(on) {
  // 깃발을 세워 둔다 (v106) — ac() 가 무조건 resume() 하기 때문에,
  // 탭을 숨긴 뒤 예약돼 있던 천둥(최대 2.6초)·화음·귀뚜라미가 깨어나면서
  // **v93 이 고친 "마지막 게인 그대로 영원히 운다" 가 되살아났다.**
  // rAF 가 없으니 updateAmbient 도 rainHiss 도 그 게인을 안 내려 준다
  S.audioAsleep = !on;
  var c = S.audioCtx; if (!c) return;
  try {
    if (on) { if (c.state === "suspended") c.resume(); }
    else if (c.state === "running") c.suspend();
  } catch (e) {}
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
        tone(f, 3.4 + Math.random(), "sine", 0.020 * vol, null, true);
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
  // 음소거면 패너도 안 만든다 (v106) — 끈 채 60초를 두어도 createPanner 가 17회 돌았고,
  // 그 안의 ac() 가 AudioContext 까지 깨웠다
  if (S.muted || opts.vol <= 0) return null;
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
// 물에 뛰어들 때의 첨벙 — 세계 지표의 63~80%가 바다인데 완전한 무음이었다
export function splash(vol, node) {
  var v = vol === undefined ? 1 : vol;
  crunch(0.35, 0.20 * v, 1100, node);
  tone(320, 0.16, "sine", 0.05 * v, node);
  tone(180, 0.28, "sine", 0.04 * v, node);
}
// 물가에서 나는 잔물결 — 용암 뽀글과 같은 틀(방향까지 맞는 패너)을 쓴다
export function waterLap(vol, node) {
  var v = vol === undefined ? 1 : vol;
  crunch(0.42, 0.035 * v, 620, node);
  tone(240 + Math.random() * 90, 0.30, "sine", 0.018 * v, node);
}
// 낮의 새소리 — 낮에는 설계상 아무 소리도 안 났다 (자연음이 밤 조건 안에만 있었다)
export function birdCall(node) {
  var f = 900 + Math.random() * 700;
  tone(f, 0.09, "sine", 0.035, node);
  setTimeout(function () { tone(f * 1.28, 0.07, "sine", 0.028, node); }, 90);
}
// 불이 타는 소리 — 붙여 놓고 귀에는 아무것도 없었다
export function fireCrackle(vol, node) {
  var v = vol === undefined ? 1 : vol;
  crunch(0.16, 0.055 * v, 1500, node);
  if (Math.random() < 0.4) tone(120 + Math.random() * 80, 0.10, "sawtooth", 0.022 * v, node);
}
// 용암에 발을 담글 때의 치익 소리
export function lavaHiss() {
  crunch(0.55, 0.22, 900);
  tone(180, 0.5, "sawtooth", 0.05);
}

export function placeSound(b) {
  if (SOFT[b]) crunch(0.09, 0.10, 850);
  else if (GLASSY[b]) { tone(1180, 0.05, "square", 0.035); crunch(0.06, 0.06, 3600); }
  else if (CLOTH[b]) crunch(0.09, 0.09, 520);
  else if (WOOD[b]) crunch(0.08, 0.10, 1400);
  else crunch(0.10, 0.12, 2300);
}
// 캐는 중 반복해서 나는 "턱-턱" 소리
export function miningSound(b) {
  if (SOFT[b]) crunch(0.05, 0.045, 700);
  else if (CLOTH[b]) crunch(0.05, 0.04, 480);
  else if (WOOD[b]) crunch(0.05, 0.05, 1200);
  else crunch(0.055, 0.055, 2000);
}
