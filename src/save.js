// save.js — 저장 · 불러오기
import { S } from "./state.js";
import { LEGACY_WY, WX, WZ, idx } from "./dims.js";
import { DEFAULT_BAR, SH_FULL } from "./blocks.js";
import { refreshAllTops, set, shape, world, waterLvl } from "./world.js";

import { player, stats } from "./player.js";
import { toast } from "./hud.js";

export var SAVE_KEY = "blockyard.save";
export var OLD_KEY = "blockyard.save.v2";
export var SLOTS = 3;

// 슬롯 — 1번은 기존 키를 그대로 써서 예전 세계를 잃지 않는다
export function slotKey(n) { return n <= 1 ? SAVE_KEY : SAVE_KEY + "." + n; }
export function curKey() { return slotKey(S.slot); }
export function slotInfo(n) {
  try {
    var raw = localStorage.getItem(slotKey(n));
    if (!raw) return null;
    var d = JSON.parse(raw);
    return { seed: d.seed >>> 0, mins: Math.round((d.secs || 0) / 60),
             placed: d.s ? d.s[0] : 0, mined: d.s ? d.s[1] : 0 };
  } catch (e) { return null; }
}

export function hasSave() {
  try { return !!(localStorage.getItem(curKey()) || (S.slot <= 1 && localStorage.getItem(OLD_KEY))); }
  catch (e) { return false; }
}

// RLE + varint + base64 — JSON 숫자 배열보다 훨씬 작다
export function encodeArrB64(arr) {
  var N = arr.length;
  var out = [], prev = arr[0], count = 1;
  function emit(v, c) {
    out.push(v);
    while (c > 127) { out.push((c & 127) | 128); c = c >>> 7; }
    out.push(c);
  }
  for (var i = 1; i < N; i++) {
    if (arr[i] === prev) { count++; continue; }
    emit(prev, count); prev = arr[i]; count = 1;
  }
  emit(prev, count);
  var str = "", CHUNK = 8192;
  for (var k = 0; k < out.length; k += CHUNK) {
    str += String.fromCharCode.apply(null, out.slice(k, k + CHUNK));
  }
  return btoa(str);
}
export function decodeArrB64(b64, arr, len) {
  var N = (typeof len === "number") ? len : arr.length;
  var bin;
  try { bin = atob(b64); } catch (e) { return false; }
  var p = 0, w = 0;
  while (p < bin.length) {
    var v = bin.charCodeAt(p++);
    var c = 0, shift = 0, byte;
    do {
      if (p >= bin.length) return false;
      byte = bin.charCodeAt(p++);
      c |= (byte & 127) << shift;
      shift += 7;
    } while (byte & 128);
    if (!(c > 0)) return false;
    if (w + c > N) return false;
    for (var k = 0; k < c; k++) arr[w++] = v;
  }
  return w === N;
}
export function encodeWorldB64() { return encodeArrB64(world); }
export function decodeWorldB64(b64) { return decodeArrB64(b64, world); }
export function encodeWorld() {
  var runs = [], prev = world[0], count = 1;
  for (var i = 1; i < N; i++) {
    if (world[i] === prev && count < 65535) count++;
    else { runs.push(prev, count); prev = world[i]; count = 1; }
  }
  runs.push(prev, count);
  return runs;
}
export function decodeWorld(runs, dst, len) {
  dst = dst || world;
  len = (typeof len === "number") ? len : N;
  var p = 0;
  for (var i = 0; i < runs.length; i += 2) {
    var val = runs[i], n = runs[i + 1];
    if (!(n > 0)) return false;
    for (var k = 0; k < n; k++) {
      if (p >= len) return false;
      dst[p++] = val;
    }
  }
  return p === len;
}
// v4 이전 저장은 세계 높이가 48 이었다 — 아래에서부터 그대로 옮겨 담는다
export function liftLegacy(src, dst, asRuns) {
  var tmp = new Uint8Array(WX * LEGACY_WY * WZ);
  var ok = asRuns ? decodeWorld(src, tmp, tmp.length)
                  : decodeArrB64(src, tmp, tmp.length);
  if (!ok) return false;
  dst.fill(0);
  for (var y = 0; y < LEGACY_WY; y++) {
    for (var z = 0; z < WZ; z++) {
      var srcRow = (y * WZ + z) * WX, dstRow = idx(0, y, z);
      for (var x = 0; x < WX; x++) dst[dstRow + x] = tmp[srcRow + x];
    }
  }
  return true;
}

export function saveGame() {
  try {
    localStorage.setItem(curKey(), JSON.stringify({
      v: 5, seed: S.worldSeed, w: encodeWorldB64(), sh: encodeArrB64(shape),
      wl: encodeArrB64(waterLvl),
      p: [player.pos.x, player.pos.y, player.pos.z],
      r: [player.yaw, player.pitch],
      s: [stats.placed, stats.mined],
      t: S.timeOfDay, f: player.flying, bar: S.bar,
      ach: S.earned, kinds: S.placedKinds, lamps: S.lampsPlaced,
      secs: Math.round(S.playSeconds), tut: S.tut
    }));
    try { localStorage.removeItem(OLD_KEY); } catch (e2) {}
    S.worldDirty = false;
    S.saveWarned = false;
    return true;
  } catch (e) {
    if (!S.saveWarned) { S.saveWarned = true; toast("저장 공간이 부족합니다"); }
    return false;
  }
}
export function loadGame() {
  try {
    var raw = localStorage.getItem(curKey()) || (S.slot <= 1 ? localStorage.getItem(OLD_KEY) : null);
    if (!raw) return false;
    var d = JSON.parse(raw);
    if (!d || !d.w) return false;
    // v5 부터 세계 높이가 64 · v2~v4 는 48 이었으므로 아래에서부터 옮겨 담는다
    if (d.v === 5) { if (!decodeWorldB64(d.w)) return false; }
    else if (d.v === 4 || d.v === 3) { if (!liftLegacy(d.w, world, false)) return false; }
    else if (d.v === 2) { if (!liftLegacy(d.w, world, true)) return false; }
    else return false;
    waterLvl.fill(0);
    if (d.v === 5 && d.wl) decodeArrB64(d.wl, waterLvl);
    shape.fill(SH_FULL);
    if (d.sh) {
      var shOk = (d.v === 5) ? decodeArrB64(d.sh, shape) : liftLegacy(d.sh, shape, false);
      if (!shOk) { shape.fill(SH_FULL); return false; }
    }
    S.worldSeed = d.seed >>> 0;
    player.pos.set(d.p[0], d.p[1], d.p[2]);
    player.yaw = d.r[0]; player.pitch = d.r[1];
    stats.placed = d.s[0]; stats.mined = d.s[1];
    S.timeOfDay = typeof d.t === "number" ? d.t : 0.3;
    player.flying = !!d.f;
    if (Array.isArray(d.bar) && d.bar.length === DEFAULT_BAR.length) S.bar = d.bar.slice();
    S.earned = (d.ach && typeof d.ach === "object") ? d.ach : {};
    S.placedKinds = (d.kinds && typeof d.kinds === "object") ? d.kinds : {};
    S.lampsPlaced = d.lamps || 0;
    S.playSeconds = d.secs || 0;
    S.tut = typeof d.tut === "number" ? d.tut : 0;
    refreshAllTops();
    return true;
  } catch (e) { return false; }
}
export function clearSave() {
  try { localStorage.removeItem(curKey()); if (S.slot <= 1) localStorage.removeItem(OLD_KEY); } catch (e) {}
}
