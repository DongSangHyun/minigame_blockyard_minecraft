// save.js — 저장 · 불러오기
import { S } from "./state.js";
import { LEGACY_WY, GEN, setGen, MARK_MAX, WX, WZ, idx } from "./dims.js";
import { DEFAULT_BAR, SH_FULL } from "./blocks.js";
import { seenMap, expandLegacySeen, touched, refreshAllTops, snapshotSeaCol, set, shape, world, waterLvl } from "./world.js";

import { player, stats } from "./player.js";
import { dumpMobs, loadMobs, mobs, isTrader } from "./mobs.js";
import { villageAt } from "./village.js";
import { toast } from "./hud.js";
import { applyWeather } from "./sky.js";

export var SAVE_KEY = "blockyard.save";
export var OLD_KEY = "blockyard.save.v2";
export var SLOTS = 3;

// 슬롯 — 1번은 기존 키를 그대로 써서 예전 세계를 잃지 않는다
export function slotKey(n) { return n <= 1 ? SAVE_KEY : SAVE_KEY + "." + n; }
export function curKey() { return slotKey(S.slot); }

// 마지막으로 논 슬롯을 기억한다 (v99).
// 예전에는 S.slot 이 localStorage 에 한 번도 안 쓰여서, 슬롯 2에서 한 시간을 짓고
// 닫으면 **다시 열 때 슬롯 1** 로 떨어졌다 — 「이어서 짓던 곳」 카드가 큰 글씨로
// "0분 플레이" 라고 하니 처음에는 세계가 날아간 줄 안다. 슬롯 셋을 쓰는 사람은
// **매번** 이 길을 지난다
export var LAST_SLOT_KEY = "blockyard.slot";

// ── 탭 잠금 (v101) — 세이브는 localStorage **한 벌**뿐이라 두 탭이 같은 슬롯을 열면
// 나중에 저장한 쪽이 조용히 이깁니다. 탭 A(한 시간 건축) → 탭 B 에서 새 세계 →
// 탭 A 가 자동 저장하면 **탭 B 의 세계는 .bak 한 벌만 남고 다음 저장에 덮입니다.**
// 한 시간 놀다 탭을 안 닫고 내일 새 탭에서 또 여는 것이 정확히 이 모양입니다.
export var LOCK_PREFIX = "blockyard.lock.";
export var LOCK_STALE = 20000;      // 이만큼 심장박동이 없으면 죽은 탭으로 본다
export var sessionId = String(Date.now()) + "." + Math.floor(Math.random() * 1000000);
export function lockKey(n) { return LOCK_PREFIX + (n || S.slot); }
export function touchLock() {
  try {
    localStorage.setItem(lockKey(S.slot),
      JSON.stringify({ id: sessionId, at: Date.now() }));
  } catch (e) {}
}
// 다른 살아 있는 탭이 이 슬롯을 쥐고 있으면 그 정보를, 아니면 null
export function lockHeldByOther(n) {
  try {
    var raw = localStorage.getItem(lockKey(n));
    if (!raw) return null;
    var d = JSON.parse(raw);
    if (!d || d.id === sessionId) return null;
    if (Date.now() - (d.at || 0) > LOCK_STALE) return null;   // 죽은 탭이다
    return d;
  } catch (e) { return null; }
}
export function releaseLock() {
  try {
    var raw = localStorage.getItem(lockKey(S.slot));
    if (raw && JSON.parse(raw).id === sessionId) localStorage.removeItem(lockKey(S.slot));
  } catch (e) {}
}
export function rememberSlot(n) {
  try { localStorage.setItem(LAST_SLOT_KEY, String(n)); } catch (e) {}
}
export function lastSlot() {
  try {
    var v = parseInt(localStorage.getItem(LAST_SLOT_KEY), 10);
    if (v >= 1 && v <= SLOTS) return v;
  } catch (e) {}
  return 1;
}
export function slotInfo(n) {
  try {
    var raw = localStorage.getItem(slotKey(n));
    if (!raw) return null;
    var d = JSON.parse(raw);
    return { seed: d.seed >>> 0, mins: Math.round((d.secs || 0) / 60),
             at: d.at || 0, name: typeof d.nm === "string" ? d.nm : "",
             placed: d.s ? d.s[0] : 0, mined: d.s ? d.s[1] : 0 };
  } catch (e) { return null; }
}

// 슬롯 이름 바꾸기 — 그 슬롯의 저장 JSON 에서 nm 만 갈아 끼운다.
// 세계를 통째로 다시 쓰지 않으므로 지금 놀고 있는 슬롯이 아니어도 안전하다.
export function renameSlot(n, name) {
  try {
    var raw = localStorage.getItem(slotKey(n));
    if (!raw) return false;
    var d = JSON.parse(raw);
    d.nm = String(name || "").slice(0, 24);
    localStorage.setItem(slotKey(n), JSON.stringify(d));
    if (n === S.slot) S.worldName = d.nm;      // 지금 슬롯이면 메모리 쪽도 맞춘다
    return true;
  } catch (e) { return false; }
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
  // **링크로 받은 세계는 남의 슬롯을 안 덮는다** (v116) — `?seed=` 로 열면 슬롯은
  // 기본 1 인 채 세계만 갈리고, 자동 저장(기본 20초) 한 번에 슬롯 1 의 세계가 사라졌다.
  // 화면은 그때까지 옛 세계 이름으로 「이어하기」라고 말한다. 사람이 잘못한 것이 하나도 없는 사고다
  if (S.noSave) return false;
  rememberSlot(S.slot);
  touchLock();
  try {
    pushBackup();
    localStorage.setItem(curKey(), JSON.stringify({
      v: 5, seed: S.worldSeed, w: encodeWorldB64(), sh: encodeArrB64(shape),
      wl: encodeArrB64(waterLvl),
      p: [player.pos.x, player.pos.y, player.pos.z],
      r: [player.yaw, player.pitch],
      s: [stats.placed, stats.mined],
      t: S.timeOfDay, md: S.moonDay, f: player.flying, bar: S.bar,
      ach: S.earned, kinds: S.placedKinds, lamps: S.lampsPlaced, torches: S.torchesPlaced,
      secs: Math.round(S.playSeconds), tut: S.tut, at: Date.now(),   // at — 슬롯 목록의 "3시간 전"
      tc: encodeArrB64(touched),   // 사람이 손댄 칸 — 없으면 이어하기 때 날씨·잔디가 내 건축물을 다시 건드린다
      mb: dumpMobs(),              // 동물 — 없으면 목장이 탭 하나 닫으면 빈 우리가 된다
      mm: encodeArrB64(seenMap),   // 걸어서 밝힌 지도 — 칸마다 0~3 이라 몇 백 바이트다
      sp: S.spawnPoint, marks: S.marks, bar2: S.barAlt, fly: S.flySpeed, tt: S.terrain,
      // 마을의 자리와 상인과 나눈 말의 수 (v122) — 필드만 늘어 `v` 는 그대로다.
      // (`tc` 는 이미 touched 가 쓰고 있어 `trc` 다)
      vg: S.village ? [S.village.x, S.village.z, S.village.h] : 0,
      trc: S.tradeCount | 0,
      // 날씨는 시각(t)·달 위상(md)과 한 짝인데 혼자 빠져 있었다 —
      // 눈 오는 밤 사진을 찍으려고 K 로 잠가 놓아도 탭을 닫으면 맑음으로 돌아왔다.
      wt: S.weather, wk: S.weatherLock ? 1 : 0,
      nm: S.worldName || "",       // 세계 이름 — 시드 번호로 "성 지은 게 1번인지 2번인지" 를 기억할 순 없다
      // G 로 고른 모양도 손에 든 것의 일부다.
      // sb·sb2 — 칸마다 기억한 모양 (v82). 없으면 sm 하나로 읽는 예전 저장이다.
      sm: S.shapeMode,
      sb: S.shapeBar ? S.shapeBar.slice() : null,
      sb2: S.shapeBarAlt ? S.shapeBarAlt.slice() : null,
      // 지형 판 — 이 세계의 해수면이 여기서 따라온다 (없으면 1 = v78 까지의 바다 11).
      // 세계 데이터는 그대로 담기므로 저장 버전(v5)은 올리지 않는다.
      gn: GEN,
      // 밝힌 지도의 판 — 2 부터 지하가 세 겹이다 (v81). 없으면 1(지하 한 장)로 읽고 펼친다.
      mv: 2
    }));
    try { localStorage.removeItem(OLD_KEY); } catch (e2) {}
    S.worldDirty = false;
    S.saveWarned = false;
    S.saveFailed = false;
    return true;
  } catch (e) {
    // 실패는 **상태**로 남긴다 (v100) — 예전에는 토스트 1.6초 한 번이 전부라,
    // 40분 동안 120번을 내리 실패해도 화면 어디에도 표시가 없었다.
    // 세이브는 localStorage 한 벌뿐이라 모르는 채로 한 시간을 더 짓는다
    S.saveFailed = true;
    if (!S.saveWarned) {
      S.saveWarned = true;
      toast("저장 공간이 부족합니다 — 메뉴 › 세계를 파일로 내보내기 로 지키세요");
    }
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
    // **자고 일어났다** (v122) — 세 시간 넘게 지나 다시 켜면 아침에서 시작한다.
    // 어젯밤 20:24 에 끈 세계가 그대로 깜깜하게 열렸고, 첫 안내는 기기당 한 번뿐이라
    // 둘째 날에는 아무도 말을 걸지 않았다
    S.welcomeBack = false;
    if (d.at && Date.now() - d.at > 3 * 3600 * 1000) {
      S.timeOfDay = 0.25;
      S.welcomeBack = true;
    }
    S.moonDay = (d.md | 0) || 0;          // 달 위상 — 없던 저장은 0(보름달)에서 시작한다
    touched.fill(0);
    if (d.tc) decodeArrB64(d.tc, touched);   // 0/1 이라 RLE 가 잘 먹어 몇 KB 안 된다
    // 예전 저장(mb 없음)은 부를 때 새로 뿌린다 — 호출부가 판단하게 결과를 남긴다
    S.mobsRestored = loadMobs(d.mb);
    // **마을을 되살린다** (v122) — 예전에는 `S.village` 가 생성기 안에서만 채워져서,
    // 다시 켠 세계에서는 「마을로」·`/tp 마을`·마을 불 보호·상인 고정이 전부 꺼졌다.
    // v115~v121 저장에는 `vg` 가 없다 — **상인이 선 자리에서 거꾸로** 구한다
    // (가판은 늘 중심에서 (−4.5, +1, +2.5) 에 선다 · 자문 31차 실측으로 맞음을 확인)
    S.village = null;
    if (Array.isArray(d.vg) && d.vg.length === 3) {
      S.village = villageAt(d.vg[0] | 0, d.vg[1] | 0, d.vg[2] | 0);
    } else {
      for (var ti = 0; ti < mobs.length; ti++) {
        if (!isTrader(mobs[ti])) continue;
        var tm = mobs[ti];
        S.village = villageAt(Math.round(tm.x + 4.5), Math.round(tm.z - 2.5), Math.round(tm.y) - 1);
        break;
      }
    }
    if (S.village) {
      for (var tj = 0; tj < mobs.length; tj++) {
        if (isTrader(mobs[tj])) mobs[tj].home = S.village.stall.slice();   // 가판을 다시 지킨다
      }
    }
    S.tradeCount = d.trc | 0;             // 상인이 어제 한 말을 기억한다 — 같은 첫마디를 되풀이하지 않게
    // 자람 큐는 저장하지 않는다 — 불러온 세계의 묘목을 다시 주워 담으라고 여기서 신호한다.
    // 호출부(부팅 복원·슬롯 전환·백업 되살리기·파일 가져오기) 넷 중 하나라도 빠뜨리면
    // 그 경로로 들어온 사람의 묘목만 영영 안 자란다 — 그래서 모두가 지나는 여기에 둔다.
    S.growDirty = true;
    seenMap.fill(0);
    if (d.mm) decodeArrB64(d.mm, seenMap);   // 예전 저장은 흰 종이에서 다시 시작한다
    // 지하를 한 장으로 밝히던 저장(v80 까지) — 세 겹으로 펼쳐 밝혀 둔 것을 잃지 않는다.
    // 층 정보는 원래 없었으니 "어느 층에서 봤는지" 는 복원할 수 없다. 전부 봤다고 친다.
    if (!((d.mv | 0) >= 2)) expandLegacySeen();
    player.flying = !!d.f;
    if (Array.isArray(d.bar) && d.bar.length === DEFAULT_BAR.length) S.bar = d.bar.slice();
    S.earned = (d.ach && typeof d.ach === "object") ? d.ach : {};
    S.placedKinds = (d.kinds && typeof d.kinds === "object") ? d.kinds : {};
    S.lampsPlaced = d.lamps || 0;
    S.torchesPlaced = d.torches || 0;
    S.playSeconds = d.secs || 0;
    S.tut = typeof d.tut === "number" ? d.tut : 0;
    S.spawnPoint = Array.isArray(d.sp) && d.sp.length === 3 ? d.sp.slice() : null;
    // 상한을 **한 곳에서** 본다 (v114) — v111 이 24 로 올렸는데 여기가 12 에 남아
    // 저장에는 스물넷이 실린 채 불러올 때 절반이 잘려 나갔다.
    // 표식은 "3일 만에 다시 켠 사람" 을 위한 기능인데 다시 켤 때 반이 사라졌다
    S.marks = Array.isArray(d.marks) ? d.marks.slice(0, MARK_MAX) : [];
    if (Array.isArray(d.bar2) && d.bar2.length === DEFAULT_BAR.length) S.barAlt = d.bar2.slice();
    S.flySpeed = typeof d.fly === "number" ? Math.max(0.5, Math.min(4, d.fly)) : 1;
    S.terrain = (d.tt | 0) || 0;
    // 없으면 예전 저장 — 기본값으로 둔다 (저장 버전은 v5 그대로)
    S.weather = (d.wt | 0) || 0;
    S.weatherLock = !!d.wk;
    S.shapeMode = (d.sm | 0) || 0;
    // 칸마다 기억한 모양 — 없으면 예전 저장이다. 그때 쓰던 모양 하나를
    // **고른 칸에만** 넣는다 (전부에 넣으면 다음 칸이 계단으로 나온다).
    function liftShapes(arr, from, cur, sel) {
      var out = [];
      for (var i = 0; i < arr.length; i++) out.push(0);
      if (Array.isArray(from) && from.length === arr.length) {
        for (var j = 0; j < from.length; j++) out[j] = ((from[j] | 0) % 3 + 3) % 3;
      } else if (cur) out[sel] = cur;
      return out;
    }
    if (S.shapeBar) S.shapeBar = liftShapes(S.shapeBar, d.sb, S.shapeMode, S.selected);
    if (S.shapeBarAlt) S.shapeBarAlt = liftShapes(S.shapeBarAlt, d.sb2, 0, 0);
    // 지형 판을 먼저 세운다 — SEA 가 여기서 정해지고, 물·얼음·동물·미니맵이 전부 그것을 본다.
    // 예전 저장에는 gn 이 없다 → 1 → 바다 11 → 그 세계가 만들어졌을 때 그대로다.
    setGen(d.gn | 0);
    S.worldName = typeof d.nm === "string" ? d.nm : "";
    S.weatherMix = S.weather ? 1 : 0;      // 불러오자마자 그 날씨로 보이게
    applyWeather();                        // 빗줄기·눈송이를 실제로 켠다 (S.weather 만 넣으면 안 보인다)
    refreshAllTops();
    snapshotSeaCol();      // 어디가 바다였는지 다시 찍는다 (액체가 이걸 본다)
    return true;
  } catch (e) { return false; }
}
export function clearSave() {
  try { localStorage.removeItem(curKey()); if (S.slot <= 1) localStorage.removeItem(OLD_KEY); } catch (e) {}
}

// ══════════════════════════════════════════════════════════════
//  세계 내보내기 · 가져오기 · 자동 백업
// ══════════════════════════════════════════════════════════════
export function backupKey(n) { return slotKey(n) + ".bak"; }

// 저장할 때마다 직전 내용을 백업으로 밀어 둔다 — 실수로 덮어써도 되돌릴 수 있다
export function pushBackup() {
  try {
    var cur = localStorage.getItem(curKey());
    if (cur) localStorage.setItem(backupKey(S.slot), cur);
    return !!cur;
  } catch (e) { return false; }
}
// 세계를 **갈아타기 직전**의 한 벌 — 자동 저장이 못 덮는 자리에 따로 둔다.
// 예전에는 백업이 saveGame 마다 밀려, 새 세계를 만들면 자동 저장(기본 20초) 한 번에
// 옛 세계가 사라졌다. "직전으로 되돌리기" 를 누르러 설정을 펼치는 사이에 이미 늦는다.
export function prevKey(n) { return slotKey(n) + ".prev"; }
export function pushPrev() {
  try {
    var cur = localStorage.getItem(curKey());
    if (cur) localStorage.setItem(prevKey(S.slot), cur);
    return !!cur;
  } catch (e) { return false; }
}
export function hasBackup() {
  try {
    return !!(localStorage.getItem(prevKey(S.slot)) || localStorage.getItem(backupKey(S.slot)));
  } catch (e) { return false; }
}
// 되살릴 후보 — `.prev`(갈아타기 직전)와 `.bak`(저장마다 밀리는 것) 두 벌.
// **저장 시각이 새 쪽**을 고른다 (v116). 예전에는 언제나 `.prev` 를 먼저 봐서,
// A → 새 세계 B → 사고 C 일 때 복구 단추가 **B 가 아니라 A** 를 되살렸고,
// 그 A 가 다음 자동 저장에서 `.bak`(B)을 덮어 **20초 뒤 B 를 완전히 없앴다.**
export function backupCandidates() {
  var out = [];
  var keys = [[prevKey(S.slot), "갈아타기 직전"], [backupKey(S.slot), "저장 직전"]];
  for (var i = 0; i < keys.length; i++) {
    try {
      var raw = localStorage.getItem(keys[i][0]);
      if (!raw) continue;
      var d = JSON.parse(raw);
      out.push({ key: keys[i][0], why: keys[i][1], raw: raw,
                 seed: d.seed >>> 0, at: d.at || 0,
                 name: typeof d.nm === "string" ? d.nm : "",
                 mins: Math.round((d.secs || 0) / 60) });
    } catch (e) {}
  }
  // **고르는 순서** — 「갈아타기 직전(.prev)」이 지금 세계와 **다른 세계**면 그것이 먼저다.
  // 그게 "사람이 방금 잃은 그 세계" 이기 때문이다 (새 세계·가져오기·내려받기가 여기로 민다).
  // 같은 세계(내 세계를 내가 덮어썼다)면 `.bak`(저장 직전)이 답이다.
  // 시각만 보고 새것을 고르면, 새 세계를 만든 20초 뒤 `.bak` 이 새 세계가 되어
  // **지금 놀고 있는 세계로 "되돌리는"** 헛일을 한다 (v69 가 막아 둔 자리다)
  // **지금 놀고 있는 세계**와 견준다 — 저장된 것과 견주면, 아직 저장하지 않은
  // 새 세계에서 옛 저장을 "지금 세계" 로 착각한다 (v14 시험이 그렇게 깨졌다)
  var mine = S.worldSeed >>> 0;
  // **지금 놀고 있는 세계가 아닌 것 중에서 새것**을 고른다.
  // ① 같은 세계를 되살리는 것은 헛일이다 — 새 세계를 만든 20초 뒤에는 `.bak` 이
  //    새 세계가 되어 있다(v69 가 `.prev` 를 만든 이유).
  // ② 그다음은 시각이 새 쪽 — 한 시간 전에 갈아탄 것보다 1분 전에 덮어쓴 것이 급하다(v14).
  out.sort(function (a, b) {
    var am = (a.seed !== mine) ? 1 : 0, bm = (b.seed !== mine) ? 1 : 0;
    if (am !== bm) return bm - am;
    return b.at - a.at;
  });
  return out;
}
// 무엇을 되살릴지 한 줄로 — 눌러 보기 전에 알 수 있어야 한다
export function backupLabel() {
  var c = backupCandidates();
  if (!c.length) return "";
  var top = c[0];
  return (top.name || ("SEED " + top.seed)) + " · " + top.mins + "분 · " + top.why;
}
export function restoreBackup() {
  try {
    var c = backupCandidates();
    if (!c.length) return false;
    // **되돌리기의 되돌리기** — 지금 세계를 `.prev` 로 밀어 두고 바꾼다.
    // 안 그러면 잘못 눌렀을 때 지금 것이 그 자리에서 사라진다
    var cur = localStorage.getItem(curKey());
    localStorage.setItem(curKey(), c[0].raw);
    var ok = loadGame();
    if (ok && cur) localStorage.setItem(prevKey(S.slot), cur);
    return ok;
  } catch (e) { return false; }
}

// 파일로 내보내기 — 브라우저 밖으로 세계를 꺼낼 유일한 길
export function exportWorld() {
  try {
    if (S.worldDirty) saveGame();
    var raw = localStorage.getItem(curKey());
    if (!raw) return false;
    var blob = new Blob([raw], { type: "application/json" });
    var a = document.createElement("a");
    a.href = URL.createObjectURL(blob);
    a.download = "blockyard-seed" + S.worldSeed + "-" + Date.now() + ".json";
    a.click();
    setTimeout(function () { URL.revokeObjectURL(a.href); }, 4000);
    return true;
  } catch (e) { return false; }
}

// 파일에서 가져오기 — 형태를 확인한 뒤에만 덮어쓴다
export function importWorldText(text) {
  // 가져오기도 **갈아타기**다 (v116) — 예전에는 pushPrev 를 안 지나서
  // 지금 세계의 마지막 사본이 20초짜리 `.bak` 뿐이었다
  pushPrev();
  var d;
  try { d = JSON.parse(text); } catch (e) { return "형식이 올바르지 않습니다"; }
  if (!d || !d.w || typeof d.seed !== "number") return "블록야드 세계 파일이 아닙니다";
  if (!(d.v >= 2 && d.v <= 5)) return "지원하지 않는 저장 버전입니다 (v" + d.v + ")";
  try {
    pushBackup();
    localStorage.setItem(curKey(), text);
  } catch (e) { return "저장 공간이 부족합니다"; }
  return loadGame() ? "" : "세계를 읽지 못했습니다";
}
