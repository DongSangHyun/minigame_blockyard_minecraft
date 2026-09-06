// daynight.js — 낮과 밤
import { S } from "./state.js";
import { lerp } from "./world.js";
import { cloudMat, pMat, skyUniforms, voxUniforms } from "./scene.js";

export var DAY_LEN = 300;
export var SKY_STOPS = [
  { t: 0.00, top: 0x050810, low: 0x0d1424 },
  { t: 0.22, top: 0x243a63, low: 0x8a5f5a },
  { t: 0.30, top: 0x2f6398, low: 0xe0a878 },
  { t: 0.50, top: 0x2b5f96, low: 0xa8c5d4 },
  { t: 0.72, top: 0x2c5182, low: 0xd98a55 },
  { t: 0.82, top: 0x16233f, low: 0x4a3a52 },
  { t: 1.00, top: 0x050810, low: 0x0d1424 }
];
export var _cA = new THREE.Color(), _cB = new THREE.Color();

export function sampleSky(t) {
  for (var i = 0; i < SKY_STOPS.length - 1; i++) {
    var a = SKY_STOPS[i], b = SKY_STOPS[i + 1];
    if (t >= a.t && t <= b.t) {
      var f = (t - a.t) / (b.t - a.t);
      _cA.setHex(a.top).lerp(_cB.setHex(b.top), f);
      skyUniforms.top.value.copy(_cA);
      _cA.setHex(a.low).lerp(_cB.setHex(b.low), f);
      skyUniforms.low.value.copy(_cA);
      return;
    }
  }
}
// 밤의 하한을 달 위상이 정한다 — 보름달 밤은 돌아다닐 만하고 그믐밤은 코앞도 안 보인다.
// (달 위상은 v23 부터 저장되는데 그동안 순수 장식이었다)
export function moonFullness() {
  var phase = ((Math.floor(S.moonDay) % 8) + 8) % 8;
  return 1 - Math.abs(phase - 4) / 4;          // 보름 1 · 그믐 0
}
export function dayLight(t) {
  var s = Math.sin((t - 0.25) * Math.PI * 2);
  var floor = 0.10 + 0.09 * moonFullness();
  return Math.max(floor, Math.min(1, s * 1.15 + 0.42));
}
export var _grey = new THREE.Color(0x8b949c);
var _white = new THREE.Color(0xf2f6ff);
var _skyTop = new THREE.Color(), _skyLow = new THREE.Color(), _skyInit = false;

export function applyTime(dt) {
  sampleSky(S.timeOfDay);
  var L = dayLight(S.timeOfDay);
  if (S.weather) {
    // 흐린 날은 어둡고 하늘이 잿빛으로 가라앉는다
    L *= S.weather === 1 ? 0.68 : 0.78;
    skyUniforms.top.value.lerp(_grey, 0.45);
    skyUniforms.low.value.lerp(_grey, 0.55);
  }
  // 번개가 치면 하늘과 지형이 함께 번쩍인다
  if (S.flash > 0) {
    var f = S.flash * S.flash;
    skyUniforms.top.value.lerp(_white, f * 0.85);
    skyUniforms.low.value.lerp(_white, f * 0.85);
    L = Math.min(1, L + f * 0.8);
  }
  // 날씨·번개로 목표색이 튀므로, 실제 하늘색은 목표를 부드럽게 좇는다
  if (!_skyInit) {
    _skyTop.copy(skyUniforms.top.value); _skyLow.copy(skyUniforms.low.value);
    _skyInit = true;
  } else {
    var k = Math.min(1, (dt || 0.016) * 6);
    _skyTop.lerp(skyUniforms.top.value, k);
    _skyLow.lerp(skyUniforms.low.value, k);
    skyUniforms.top.value.copy(_skyTop);
    skyUniforms.low.value.copy(_skyLow);
  }
  voxUniforms.uDay.value = L;
  voxUniforms.uFogColor.value.copy(skyUniforms.low.value);
  cloudMat.color.setRGB(L * 0.95, L * 0.96, L);
  pMat.color.setRGB(0.35 + L * 0.65, 0.35 + L * 0.65, 0.35 + L * 0.65);
}
export function clockText() {
  var mins = Math.floor(S.timeOfDay * 1440);
  var hh = Math.floor(mins / 60), mm = mins % 60;
  return (hh < 10 ? "0" : "") + hh + ":" + (mm < 10 ? "0" : "") + mm;
}
