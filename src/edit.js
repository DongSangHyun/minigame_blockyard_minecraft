// edit.js — 편집 · 되돌리기 · 도전 과제
import { S } from "./state.js";
import { opts } from "./settings.js";
import { encodeArrB64, decodeArrB64, SLOTS } from "./save.js";
import { SEA, DIRS, WX, WY, WZ, idx, inside } from "./dims.js";
import { SH_STAIR_N, SH_STAIR_W, SH_STAIR_NU, SH_STAIR_WU, SH_WALL_N, SH_WALL_W, SH_DOOR_N, SH_AXIS_X, SH_AXIS_Z, TORCH, isWool, DOOR, LAVA, AIR, ALL_BLOCKS, EMIT, ICE, NAMES, NAMES_EN, SH_FULL, WALL_DIR, WATER, isClimbable, isCross, isItem, isLog, isSolid, isUnbreakable, isWallShape } from "./blocks.js";
import { topMap, refreshAllTops, touched, get, BIOME_NAMES, markTouched, refreshTop, shape, waterLvl, world } from "./world.js";
import { relightAll, relightLocal } from "./light.js";
import { enqueueLavaAround, enqueueLavaDryAround, enqueueDryAround, enqueueFall, enqueueWaterAround, queueLeafDecay } from "./fluids.js";
import { markAllDirty, touch } from "./mesh.js";
import { player, stats } from "./player.js";
import { tone } from "./audio.js";
import { helpAchList, showAchPop } from "./hud.js";
import { setWeather, localBiome } from "./sky.js";

export var HISTORY_MAX = 240;

// 광원 주변 2칸 안의 얼음을 물로 되돌린다
function meltIceAround(x, y, z, record, depth) {
  for (var dx = -2; dx <= 2; dx++)
    for (var dy = -2; dy <= 2; dy++)
      for (var dz = -2; dz <= 2; dz++) {
        if (!inside(x + dx, y + dy, z + dz)) continue;
        var i = idx(x + dx, y + dy, z + dz);
        if (world[i] !== ICE) continue;
        applyEdit(x + dx, y + dy, z + dz, WATER, record, SH_FULL, (depth || 0) + 1);
      }
}

// 받침이 사라진 얇은 블록을 떨군다. wall 이 주어지면 그 방향 벽에 붙은 것만.
// record — 사람의 편집 때문에 딸려 사라지는 것도 되돌리기에 남는다.
// 예전에는 world[] 를 직접 써서, 받침돌을 캐고 Ctrl+Z 하면 돌만 돌아오고 횃불은 영영 사라졌다.
// (CLAUDE.md 6절 1번이 경고하는 바로 그 실수였다)
// depth — applyEdit → dropCross → applyEdit 재귀의 상한. 사다리 탑이 아무리 높아도 8이면 넉넉하다.
function dropCross(x, y, z, wall, record, depth) {
  if (!inside(x, y, z)) return;
  if ((depth || 0) > 8) return;
  var i = idx(x, y, z);
  // 사다리도 벽 횃불과 같은 규칙이다 — 벽이 사라지면 같이 떨어진다.
  // 문도 받칠 바닥이 필요하다(needsFloor) — 밑을 캐면 허공에 뜨면 안 된다.
  var db = world[i];
  if (!isCross(db) && !isClimbable(db) && db !== DOOR) return;
  if (db === DOOR) {
    if (wall) return;                          // 문은 벽이 아니라 바닥에 선다
    if (world[idx(x, y - 1, z)] === DOOR) return;   // 아래가 문이면 내가 윗쪽 — 아래가 판단한다
    if (isSolid(get(x, y - 1, z))) return;
    if (get(x, y + 1, z) === DOOR) {           // 윗칸도 함께 걷는다
      applyEdit(x, y + 1, z, AIR, record, SH_FULL, (depth || 0) + 1);
    }
    applyEdit(x, y, z, AIR, record, SH_FULL, (depth || 0) + 1);
    return;
  }
  if (wall) {
    var d = WALL_DIR[shape[i]];
    if (!d || d[0] !== wall[0] || d[2] !== wall[2]) return;
  } else if (isWallShape(shape[i])) return;   // 벽 횃불은 아래가 비어도 남는다
  applyEdit(x, y, z, AIR, record, SH_FULL, (depth || 0) + 1);
}

// depth — 딸려 사라지는 것들(dropCross·meltIce)이 다시 applyEdit 을 부르는 재귀의 깊이
export function applyEdit(x, y, z, to, record, sh, depth) {
  if (!inside(x, y, z)) return false;
  if (y === 0) return false;                 // 바닥은 손대지 않는다
  if (isUnbreakable(world[idx(x, y, z)])) return false;
  var i = idx(x, y, z);
  var from = world[i], fromSh = shape[i], fromWl = waterLvl[i];
  var toSh = (to === AIR) ? SH_FULL : (sh || SH_FULL);
  if (from === to && fromSh === toSh) return false;
  if (isItem(to)) return false;        // 도구는 세계에 놓이지 않는다 (fill·명령도 막는다)

  // 사람의 편집 하나 = 되돌리기 하나. 딸려 사라지는 것(dropCross·meltIceAround)이 따로 기록되면
  // Ctrl+Z 를 한 번 눌렀을 때 받침만 돌아오고 위에 얹혔던 횃불은 잃는다 — 한 묶음으로 담는다.
  var ownBatch = false;
  if (record && !S.batch && !depth) { beginBatch(8); ownBatch = true; }

  world[i] = to;
  shape[i] = toSh;
  if (to === WATER) waterLvl[i] = 0;       // 손으로 놓은 물은 언제나 근원
  else if (from === WATER) waterLvl[i] = 0;
  if (to === WATER) enqueueWaterAround(x, y, z);
  if (from === WATER && to !== WATER) enqueueDryAround(x, y, z);
  // 용암도 물처럼 흐른다 — 놓으면 퍼지고, 근원을 캐면 흘러 나간 것이 물러난다
  if (to === LAVA) { waterLvl[i] = 0; enqueueLavaAround(x, y, z); }
  if (from === LAVA && to !== LAVA) enqueueLavaDryAround(x, y, z);
  if (to === AIR) enqueueLavaAround(x, y, z);
  enqueueFall(x, y, z);        // 놓은 블록 자신도 떨어질 수 있다
  enqueueFall(x, y + 1, z);    // 위에 얹혀 있던 것도
  // 묶음 편집(채우기·비우기·붙여넣기·폭발) 중에는 칸마다 조명 BFS·기둥 스캔·메시 표시를 하지 않는다.
  // 32,768칸을 채울 때 그것들이 411ms 중 대부분이었다 — 끝에 한 번만 한다 (endBatch).
  if (S.batch) S.batchCells++;
  else { touch(x, y, z); refreshTop(x, z); relightLocal(x, y, z); }
  if (to === AIR) enqueueWaterAround(x, y, z);
  // 밝은 광원 옆의 얼음은 녹아 물이 된다
  if ((EMIT[to] || 0) >= 12) meltIceAround(x, y, z, record, depth);
  if (isLog(from) && from !== to) queueLeafDecay(x, y, z);
  // 받치던 바닥이 사라지면 위에 얹힌 풀·꽃·횃불도 함께 사라진다
  if (!isSolid(to)) {
    if (inside(x, y + 1, z)) dropCross(x, y + 1, z, null, record, depth);
    // 옆에 붙어 있던 벽 횃불도 함께 떨어진다
    for (var wd = 0; wd < 6; wd++) {
      if (DIRS[wd][1] !== 0) continue;
      dropCross(x + DIRS[wd][0], y, z + DIRS[wd][2], [-DIRS[wd][0], 0, -DIRS[wd][2]], record, depth);
    }
  }
  S.worldDirty = true;

  if (record) {
    markTouched(x, y, z);          // 되돌리기에 남는 편집 = 사람이 손댄 자리
    // wl — 편집 전 물 레벨. 없으면 흐르는 물을 캔 뒤 되돌릴 때 근원(0)으로 되살아나 무한 물이 생긴다
    if (S.batch) batchPush(S.batch, x, y, z, from, to, fromSh, toSh, fromWl);  // 묶음 중이면 모아 둔다
    else {
      var rec = { x: x, y: y, z: z, from: from, to: to, fromSh: fromSh, toSh: toSh, wl: fromWl };
      S.history.push(rec);
      if (S.history.length > (opts.undo || HISTORY_MAX)) S.history.shift();
      S.future.length = 0;
    }
  }
  if (ownBatch) endBatch("편집");
  return true;
}

// 묶음 기록은 칸마다 객체를 만들면 32,768칸에 3만 개가 쌓인다 — 그 할당이 채우기 시간의 절반이었다.
// 좌표·블록·모양·물레벨이 전부 8~16비트라 타입 배열에 그대로 담긴다.
function makeBatch(cap) {
  return { n: 0, cap: cap,
           x: new Uint16Array(cap), y: new Uint16Array(cap), z: new Uint16Array(cap),
           from: new Uint8Array(cap), to: new Uint8Array(cap),
           fromSh: new Uint8Array(cap), toSh: new Uint8Array(cap), wl: new Uint8Array(cap) };
}
function batchGrow(b) {
  var cap = b.cap * 2, keys = ["x", "y", "z", "from", "to", "fromSh", "toSh", "wl"];
  var big = makeBatch(cap);
  for (var k = 0; k < keys.length; k++) big[keys[k]].set(b[keys[k]]);
  big.n = b.n;
  for (var k2 = 0; k2 < keys.length; k2++) b[keys[k2]] = big[keys[k2]];
  b.cap = cap;
}
function batchPush(b, x, y, z, from, to, fromSh, toSh, wl) {
  if (b.n === b.cap) batchGrow(b);
  var i = b.n++;
  b.x[i] = x; b.y[i] = y; b.z[i] = z;
  b.from[i] = from; b.to[i] = to;
  b.fromSh[i] = fromSh; b.toSh[i] = toSh; b.wl[i] = wl;
}

// 대량 편집(채우기·붙여넣기)은 한 덩어리로 묶어 한 번에 되돌린다
export function beginBatch(cap) { S.batch = makeBatch(cap || 1024); S.batchCells = 0; }
// 묶음이 끝나면 조명과 기둥 높이를 한 번에 맞춘다.
// 400칸이 넘으면 세계 전체를 다시 켜는 게 칸마다 BFS 를 도는 것보다 싸다 (relightAll 은 25ms 고정).
export var BATCH_RELIGHT_ALL = 400;
export function settleWorld() {
  refreshAllTops();
  relightAll(true);
  markAllDirty();          // 조명이 통째로 바뀌었으니 메시도 전부 다시 굽는다
}
function settleBatch(cells, list) {
  if (!cells) return;
  if (cells > BATCH_RELIGHT_ALL) { settleWorld(); return; }
  for (var i = 0; i < list.n; i++) {
    touch(list.x[i], list.y[i], list.z[i]);
    refreshTop(list.x[i], list.z[i]);
    relightLocal(list.x[i], list.y[i], list.z[i]);
  }
}
export function endBatch(label) {
  var b = S.batch;
  var cells = S.batchCells;
  S.batch = null; S.batchCells = 0;
  settleBatch(cells, b || { n: 0 });
  if (!b || !b.n) return 0;
  S.history.push({ batch: b, label: label || "대량 편집" });
  if (b.n >= 100) unlock("build100");
  if (S.history.length > (opts.undo || HISTORY_MAX)) S.history.shift();
  S.future.length = 0;
  return b.n;
}

// 묶음(타입 배열)의 i 번째를 되돌린다 — 객체를 만들지 않는다
function applyCellAt(b, i, toSide, defer) {
  var x = b.x[i], y = b.y[i], z = b.z[i];
  var w = idx(x, y, z);
  world[w] = toSide ? b.to[i] : b.from[i];
  shape[w] = (toSide ? b.toSh[i] : b.fromSh[i]) || SH_FULL;
  waterLvl[w] = toSide ? 0 : b.wl[i];
  if (!defer) { touch(x, y, z); refreshTop(x, z); relightLocal(x, y, z); }
  if (world[w] === AIR) enqueueWaterAround(x, y, z);
  if (b.from[i] === WATER || b.to[i] === WATER) { enqueueDryAround(x, y, z); enqueueWaterAround(x, y, z); }
}

function applyCell(e, toSide, defer) {
  var i = idx(e.x, e.y, e.z);
  world[i] = toSide ? e.to : e.from;
  shape[i] = (toSide ? e.toSh : e.fromSh) || SH_FULL;
  // 물 레벨도 그 순간으로 — 되돌리기가 세계를 딴 상태로 두면 되돌리기를 못 믿게 된다
  waterLvl[i] = toSide ? 0 : (e.wl || 0);
  // defer — 큰 묶음을 되돌릴 때는 조명·기둥·메시를 칸마다 하지 않는다 (끝에 한 번)
  if (!defer) { touch(e.x, e.y, e.z); refreshTop(e.x, e.z); relightLocal(e.x, e.y, e.z); }
  if (world[i] === AIR) enqueueWaterAround(e.x, e.y, e.z);
  // 근원을 되돌려 없애면 거기서 퍼진 물이 말라야 하고, 되살리면 다시 퍼져야 한다
  if (e.from === WATER || e.to === WATER) { enqueueDryAround(e.x, e.y, e.z); enqueueWaterAround(e.x, e.y, e.z); }
}

export function undo() {
  var e = S.history.pop();
  if (!e) return false;
  if (e.batch) {
    var big = e.batch.n > BATCH_RELIGHT_ALL;
    for (var i = e.batch.n - 1; i >= 0; i--) applyCellAt(e.batch, i, false, big);
    if (big) settleWorld();
  }
  else applyCell(e, false);
  S.future.push(e);
  S.worldDirty = true;
  return true;
}
export function redo() {
  var e = S.future.pop();
  if (!e) return false;
  if (e.batch) {
    var big2 = e.batch.n > BATCH_RELIGHT_ALL;
    for (var i = 0; i < e.batch.n; i++) applyCellAt(e.batch, i, true, big2);
    if (big2) settleWorld();
  }
  else applyCell(e, true);
  S.history.push(e);
  S.worldDirty = true;
  return true;
}

//  13.5 도전 과제
export var ACHIEVEMENTS = [
  { id: "firstMine", name: "첫 삽", desc: "블록을 하나 캐낸다" },
  { id: "firstPlace", name: "첫 벽돌", desc: "블록을 하나 놓는다" },
  { id: "mine100", name: "광부", desc: "블록 100개를 캔다" },
  { id: "place100", name: "건축가", desc: "블록 100개를 놓는다" },
  { id: "coal", name: "검은 돌", desc: "석탄 광석을 캔다" },
  { id: "iron", name: "쇠맛", desc: "철 광석을 캔다" },
  { id: "deep", name: "깊은 곳", desc: "높이 3 아래로 내려간다" },
  { id: "high", name: "꼭대기", desc: "높이 50 위로 올라간다" },
  { id: "lamp10", name: "등대지기", desc: "램프를 10개 놓는다" },
  { id: "flood", name: "수문장", desc: "바닷물을 끌어들인다" },
  { id: "gravity", name: "사태", desc: "모래나 자갈을 무너뜨린다" },
  { id: "night", name: "밤샘", desc: "한밤중에 바깥에 서 있는다" },
  { id: "snow", name: "설원", desc: "설원에 발을 딛는다" },
  { id: "desert", name: "사막", desc: "사막에 발을 딛는다" },
  { id: "stair", name: "계단공", desc: "계단을 놓는다" },
  { id: "collector", name: "수집가", desc: "모든 종류의 블록을 놓아본다" },
  { id: "lava", name: "불의 강", desc: "지하에서 용암을 마주친다" },
  { id: "ice", name: "살얼음", desc: "얼음 위에 올라선다" },
  { id: "torch10", name: "굴 밝히기", desc: "횃불을 10개 놓는다" },
  { id: "flower", name: "꽃다발", desc: "꽃을 심는다" },
  { id: "waterfall", name: "폭포", desc: "높은 곳에서 물을 떨어뜨린다" },
  { id: "slabmerge", name: "빈틈없이", desc: "반블록 두 장을 겹쳐 한 블록으로 만든다" },
  { id: "fire", name: "불장난", desc: "횃불로 무언가에 불을 붙인다" },
  { id: "boom", name: "쾅", desc: "TNT 를 터뜨린다" },
  { id: "build100", name: "대공사", desc: "영역 채우기로 100칸 이상을 한 번에 짓는다" },
  { id: "explorer", name: "탐험가", desc: "미니맵 표식을 5개 찍는다" },
  { id: "feed", name: "친구", desc: "동물에게 꽃을 준다" },
  { id: "photo", name: "사진사", desc: "사진 모드로 화면을 저장한다" },
  { id: "gold", name: "금맥", desc: "금 광석을 캔다" },
  { id: "diamond", name: "다이아몬드!", desc: "다이아몬드 광석을 캔다" },
  { id: "breed", name: "목장주", desc: "동물 둘에게 꽃을 주어 새끼를 얻는다" },
  // 여기부터는 "기능을 만져 봤나" 가 아니라 **지은 것**을 본다.
  // 크리에이티브에서 "다음에 뭐 하지" 를 막아 주는 건 이것뿐이다.
  { id: "room", name: "내 집", desc: "문이 달린 방을 짓는다 (27칸 이상 · 밖이 안 보이게)" },
  { id: "tower", name: "전망대", desc: "20칸 높이로 쌓아 올린다" },
  { id: "bridge", name: "다리", desc: "물 위로 20칸을 잇는다" },
  { id: "mineshaft", name: "갱도", desc: "지하 깊이 200칸을 파고 횃불 10개를 단다" },
  { id: "palette", name: "색칠", desc: "한자리에 양털 여덟 빛깔을 쓴다" },
  { id: "cartographer", name: "지도장이", desc: "섬의 8할을 걸어서 지도에 밝힌다" }
];
export var achGrid = document.getElementById("achgrid");

export function refreshAchList() {
  var html = "";
  // 아직 안 딴 것 셋을 맨 위에 "다음에 해 볼 것" 으로 보여 준다 —
  // 30개를 거의 다 딴 사람이 화면에서 목표를 잃지 않게
  var todo = [];
  for (var t = 0; t < ACHIEVEMENTS.length && todo.length < 3; t++)
    if (!S.earned[ACHIEVEMENTS[t].id]) todo.push(ACHIEVEMENTS[t]);
  if (todo.length) {
    html += '<div class="ach next"><b>\u25b8</b><span>다음에 해 볼 것 — ' +
            todo.map(function (a) { return a.name; }).join(" · ") + '</span></div>';
  }
  for (var i = 0; i < ACHIEVEMENTS.length; i++) {
    var a = ACHIEVEMENTS[i];
    html += '<div class="ach' + (S.earned[a.id] ? " got" : "") + '">' +
            '<b>' + (S.earned[a.id] ? "\u2714" : "\u2022") + '</b>' +
            '<span>' + a.name + ' · ' + a.desc + '</span></div>';
  }
  achGrid.innerHTML = html;
  if (helpAchList) helpAchList.innerHTML = html;
}
// ── 지은 것을 보는 과제 — 사람이 손댄 칸(touched)만 센다.
// 자연 지형이 우연히 조건을 채워 과제를 주면 "내가 지었다" 는 느낌이 사라진다.
export var BUILD_R = 32;          // 플레이어 주변 이만큼만 본다 (44만 칸을 다 볼 이유가 없다)
export var BUILD_IDS = ["room", "tower", "bridge", "mineshaft", "palette"];
export function checkBuildAchievements() {
  // 다섯을 다 땄으면 아예 돌지 않는다 — 이 검사는 10초에 한 번이지만 최악 8ms 다
  var left = false;
  for (var q = 0; q < BUILD_IDS.length && !left; q++) if (!S.earned[BUILD_IDS[q]]) left = true;
  if (!left) return;

  var px = Math.floor(player.pos.x), pz = Math.floor(player.pos.z);
  var x0 = Math.max(1, px - BUILD_R), x1 = Math.min(WX - 2, px + BUILD_R);
  var z0 = Math.max(1, pz - BUILD_R), z1 = Math.min(WZ - 2, pz + BUILD_R);
  var x, y, z, i;

  // 탑 — 한 기둥에 사람이 쌓은 블록이 20칸 연속
  // 다리 — 물 위(해수면 위)로 사람이 놓은 블록이 20칸 이어짐
  var wools = {}, woolN = 0;
  for (x = x0; x <= x1; x++) {
    for (z = z0; z <= z1; z++) {
      var run = 0, bridgeRun = 0;
      for (y = 1; y < WY - 1; y++) {
        i = idx(x, y, z);
        var b = world[i];
        var mine = touched[i] === 1 && b !== AIR;
        run = mine ? run + 1 : 0;
        if (run >= 20) unlock("tower");
        if (isWool(b) && touched[i] === 1 && !wools[b]) { wools[b] = 1; woolN++; }
      }
      // 다리는 가로로 잰다 — 이 기둥의 해수면 위 첫 사람 블록이 물 위에 떠 있는가
      var over = false;
      for (y = SEA + 2; y < WY - 1 && !over; y++) {
        i = idx(x, y, z);
        if (touched[i] !== 1 || world[i] === AIR) continue;
        // 아래로 훑어 바닥이 물이면 물 위에 놓인 것이다
        for (var dy = y - 1; dy > 0; dy--) {
          var ub = world[idx(x, dy, z)];
          if (ub === WATER) { over = true; break; }
          if (ub !== AIR) break;
        }
      }
      bridgeSpan = over ? bridgeSpan + 1 : 0;
      if (bridgeSpan >= 20) unlock("bridge");
    }
    bridgeSpan = 0;                       // 기둥 줄이 바뀌면 이어짐이 끊긴다
  }
  if (woolN >= 8) unlock("palette");

  // 갱도 — 지하(y ≤ 8)에서 사람이 파낸 칸 200개 + 횃불 10개
  var dug = 0, torches = 0;
  if (!S.earned.mineshaft)
  for (y = 1; y <= 8; y++)
    for (x = x0; x <= x1; x++)
      for (z = z0; z <= z1; z++) {
        i = idx(x, y, z);
        if (touched[i] !== 1) continue;
        if (world[i] === AIR) dug++;
        else if (world[i] === TORCH) torches++;
      }
  if (dug >= 200 && torches >= 10) unlock("mineshaft");

  // 방 — 문이 있고, 그 문에서 시작한 공기가 밖으로 새지 않는 27칸 이상의 공간
  checkRoom(x0, x1, z0, z1);
}
var bridgeSpan = 0;

// 문 옆 공기에서 6방향으로 번져 본다. 상한(600칸) 안에서 갇히면 방이다.
function checkRoom(x0, x1, z0, z1) {
  if (S.earned.room) return;
  for (var x = x0; x <= x1; x++)
    for (var z = z0; z <= z1; z++)
      for (var y = 1; y < WY - 2; y++) {
        if (world[idx(x, y, z)] !== DOOR) continue;
        // DIRS 는 앞 4개에 수직이 섞여 있다 — 6개를 다 훑고 수직만 건너뛴다.
        // 4개만 돌면 문의 ±z 이웃을 아예 못 봐서 방을 영영 못 찾는다.
        for (var d = 0; d < 6; d++) {
          if (DIRS[d][1] !== 0) continue;             // 문 양옆(수평)에서 시작한다
          var sx = x + DIRS[d][0], sy = y, sz = z + DIRS[d][2];
          if (!inside(sx, sy, sz) || world[idx(sx, sy, sz)] !== AIR) continue;
          if (floodEnclosed(sx, sy, sz) >= 27) { unlock("room"); return; }
        }
      }
}
// 밖으로 새지 않으면 칸 수를, 새면 0 을 돌려준다
function floodEnclosed(sx, sy, sz) {
  var seen = {}, stack = [[sx, sy, sz]], n = 0;
  while (stack.length) {
    var c = stack.pop();
    var cx = c[0], cy = c[1], cz = c[2];
    if (!inside(cx, cy, cz)) return 0;                 // 세계 밖으로 샜다
    var key = idx(cx, cy, cz);
    if (seen[key]) continue;
    var b = world[key];
    if (b !== AIR) continue;                           // 벽·문에 막힌다 (문도 벽으로 친다)
    // 빛이 아니라 **막혀 있는가**를 본다. 유리 지붕(채광창)은 빛이 15로 그대로 내려와
    // "야외" 로 오판됐다 — 창문 달린 집이 집이다.
    if (topMap[cz * WX + cx] <= cy) return 0;          // 위에 아무것도 없으면 야외다
    seen[key] = 1;
    if (++n > 600) return 0;                           // 너무 크면 방이 아니라 동굴이다
    for (var d = 0; d < 6; d++)
      stack.push([cx + DIRS[d][0], cy + DIRS[d][1], cz + DIRS[d][2]]);
  }
  return n;
}

export var statGrid = document.getElementById("statgrid");
export function refreshStats() {
  var mm = Math.floor(S.playSeconds / 60), ss = Math.floor(S.playSeconds % 60);
  statGrid.innerHTML =
    "<dt>플레이</dt><dd>" + mm + "분 " + (ss < 10 ? "0" : "") + ss + "초</dd>" +
    "<dt>시드</dt><dd>" + S.worldSeed + "</dd>" +
    "<dt>캔 블록</dt><dd>" + stats.mined + "</dd>" +
    "<dt>놓은 블록</dt><dd>" + stats.placed + "</dd>" +
    "<dt>위치</dt><dd>" + Math.floor(player.pos.x) + " · " +
      Math.floor(player.pos.y) + " · " + Math.floor(player.pos.z) + "</dd>" +
    "<dt>지형</dt><dd>" + BIOME_NAMES[localBiome()] + "</dd>" +
    "<dt>램프</dt><dd>" + S.lampsPlaced + "</dd>" +
    "<dt>과제</dt><dd>" + achCount() + " / " + ACHIEVEMENTS.length + "</dd>" +
    "<dt>지형</dt><dd>" + ["보통", "평지", "산악", "군도"][S.terrain | 0] + "</dd>" +
    "<dt>슬롯</dt><dd>" + S.slot + " / " + SLOTS + "</dd>" +
    "<dt>표식</dt><dd>" + S.marks.length + "개</dd>" +
    "<dt>블록 종류</dt><dd>" + Object.keys(S.placedKinds).length + " / " + ALL_BLOCKS.length + "</dd>" +
    "<dt>되돌리기</dt><dd>" + S.history.length + "단계</dd>";
}
export function achCount() {
  var n = 0;
  for (var i = 0; i < ACHIEVEMENTS.length; i++) if (S.earned[ACHIEVEMENTS[i].id]) n++;
  return n;
}
export function unlock(id) {
  if (S.earned[id]) return;
  var found = null;
  for (var i = 0; i < ACHIEVEMENTS.length; i++) if (ACHIEVEMENTS[i].id === id) found = ACHIEVEMENTS[i];
  if (!found) return;
  S.earned[id] = 1;
  S.worldDirty = true;
  // 팝업에 진척도를 같이 실어 토스트를 아낀다 — 토스트는 직전 안내를 덮어 지운다
  showAchPop(found.name, found.desc + "  ·  " + achCount() + " / " + ACHIEVEMENTS.length);
  tone(880, 0.09, "triangle", 0.05);
  setTimeout(function () { tone(1320, 0.12, "triangle", 0.045); }, 110);
  // 목록 DOM 은 여기서 다시 그리지 않는다 — 36개짜리 innerHTML 두 번이 106ms 였고,
  // 과제를 딸 때마다 화면이 멈췄다. 목록은 H 를 눌러 열 때 갱신된다.
  S.achListStale = true;
}

// ══════════════════════════════════════════════════════════════
//  영역 도구 — 크리에이티브 건축의 채우기 · 복사 · 붙여넣기
// ══════════════════════════════════════════════════════════════
function bounds() {
  if (!S.selA || !S.selB) return null;
  return {
    x0: Math.min(S.selA[0], S.selB[0]), x1: Math.max(S.selA[0], S.selB[0]),
    y0: Math.min(S.selA[1], S.selB[1]), y1: Math.max(S.selA[1], S.selB[1]),
    z0: Math.min(S.selA[2], S.selB[2]), z1: Math.max(S.selA[2], S.selB[2])
  };
}
export function selectionBounds() { return bounds(); }
export function selectionSize() {
  var b = bounds();
  if (!b) return 0;
  return (b.x1 - b.x0 + 1) * (b.y1 - b.y0 + 1) * (b.z1 - b.z0 + 1);
}
export var REGION_MAX = 40000;   // 한 번에 다룰 수 있는 칸 수

export function fillSelection(block, sh) {
  var b = bounds();
  if (!b) return 0;
  if (selectionSize() > REGION_MAX) return -1;
  beginBatch();
  for (var y = b.y0; y <= b.y1; y++)
    for (var z = b.z0; z <= b.z1; z++)
      for (var x = b.x0; x <= b.x1; x++)
        applyEdit(x, y, z, block, true, sh || SH_FULL);
  return endBatch("채우기");
}

// 영역 비우기 — 채우기와 같은 길을 쓰되 되돌리기 이름만 다르다.
// AIR 를 ALL_BLOCKS 에 넣으면 "수집가" 과제가 영영 불가능해지므로 (v19 교훈)
// 여기서 AIR 를 직접 넘긴다.
export function clearSelection() {
  var b = bounds();
  if (!b) return 0;
  if (selectionSize() > REGION_MAX) return -1;
  beginBatch();
  for (var y = b.y0; y <= b.y1; y++)
    for (var z = b.z0; z <= b.z1; z++)
      for (var x = b.x0; x <= b.x1; x++)
        applyEdit(x, y, z, AIR, true, SH_FULL);
  return endBatch("비우기");
}

export function copySelection() {
  var b = bounds();
  if (!b) return 0;
  if (selectionSize() > REGION_MAX) return -1;
  var w = b.x1 - b.x0 + 1, h = b.y1 - b.y0 + 1, d = b.z1 - b.z0 + 1;
  var blocks = new Uint8Array(w * h * d), shapes = new Uint8Array(w * h * d);
  // 물·용암 레벨도 함께 담는다 — 안 담으면 붙여넣은 물이 전부 근원(0)이 되어
  // 연못 하나를 복제했을 뿐인데 근원 백여 개가 각각 7칸씩 뻗는다
  var levels = new Uint8Array(w * h * d);
  var n = 0;
  for (var y = 0; y < h; y++)
    for (var z = 0; z < d; z++)
      for (var x = 0; x < w; x++) {
        var i = idx(b.x0 + x, b.y0 + y, b.z0 + z);
        blocks[n] = world[i]; shapes[n] = shape[i]; levels[n] = waterLvl[i]; n++;
      }
  S.clip = { w: w, h: h, d: d, blocks: blocks, shapes: shapes, levels: levels };
  return w * h * d;
}

// 모양도 함께 돌린다 — 계단·벽·문·원목 축은 방향을 품고 있어서 그냥 옮기면 어긋난다
function rotShape(sh) {
  function turn(base, v) { return base + ((v - base + 1) & 3); }        // N→E→S→W
  if (sh >= SH_STAIR_N && sh <= SH_STAIR_W) return turn(SH_STAIR_N, sh);
  if (sh >= SH_STAIR_NU && sh <= SH_STAIR_WU) return turn(SH_STAIR_NU, sh);
  if (sh >= SH_WALL_N && sh <= SH_WALL_W) return turn(SH_WALL_N, sh);
  if (sh >= SH_DOOR_N && sh <= SH_DOOR_N + 3) return turn(SH_DOOR_N, sh);
  if (sh >= SH_DOOR_N + 4 && sh <= SH_DOOR_N + 7) return turn(SH_DOOR_N + 4, sh);
  if (sh === SH_AXIS_X) return SH_AXIS_Z;
  if (sh === SH_AXIS_Z) return SH_AXIS_X;
  return sh;
}
// 거울 — X 를 뒤집는다. 계단·벽·문의 동↔서만 맞바꾸면 된다(북·남은 그대로).
function mirrorShape(sh) {
  function flip(base, v) { var k = v - base; return base + (k === 1 ? 3 : (k === 3 ? 1 : k)); }
  if (sh >= SH_STAIR_N && sh <= SH_STAIR_W) return flip(SH_STAIR_N, sh);
  if (sh >= SH_STAIR_NU && sh <= SH_STAIR_WU) return flip(SH_STAIR_NU, sh);
  if (sh >= SH_WALL_N && sh <= SH_WALL_W) return flip(SH_WALL_N, sh);
  if (sh >= SH_DOOR_N && sh <= SH_DOOR_N + 3) return flip(SH_DOOR_N, sh);
  if (sh >= SH_DOOR_N + 4 && sh <= SH_DOOR_N + 7) return flip(SH_DOOR_N + 4, sh);
  return sh;                                  // 원목 축은 X 뒤집기에 안 바뀐다
}
export function mirrorClip() {
  var c = S.clip;
  if (!c) return false;
  var w = c.w, h = c.h, d = c.d;
  var nb = new Uint8Array(w * h * d), ns = new Uint8Array(w * h * d), nl = new Uint8Array(w * h * d);
  for (var y = 0; y < h; y++)
    for (var z = 0; z < d; z++)
      for (var x = 0; x < w; x++) {
        var src = (y * d + z) * w + x;
        var dst = (y * d + z) * w + (w - 1 - x);
        nb[dst] = c.blocks[src];
        ns[dst] = mirrorShape(c.shapes[src]);
        nl[dst] = c.levels ? c.levels[src] : 0;
      }
  S.clip = { w: w, h: h, d: d, blocks: nb, shapes: ns, levels: nl };
  return true;
}

// 복사한 것을 Y축으로 90도 돌린다 — 대칭 건물을 손으로 다시 짓지 않게
export function rotateClip() {
  var c = S.clip;
  if (!c) return false;
  var w = c.w, h = c.h, d = c.d;
  var nb = new Uint8Array(w * h * d), ns = new Uint8Array(w * h * d), nl = new Uint8Array(w * h * d);
  for (var y = 0; y < h; y++)
    for (var z = 0; z < d; z++)
      for (var x = 0; x < w; x++) {
        var src = (y * d + z) * w + x;
        // (x,z) → (d-1-z, x) · 새 가로는 옛 세로다
        var nx = d - 1 - z, nz = x;
        var dst = (y * w + nz) * d + nx;
        nb[dst] = c.blocks[src];
        ns[dst] = rotShape(c.shapes[src]);
        nl[dst] = c.levels ? c.levels[src] : 0;
      }
  S.clip = { w: d, h: h, d: w, blocks: nb, shapes: ns, levels: nl };
  return true;
}

export function pasteClip(px, py, pz) {
  var c = S.clip;
  if (!c) return 0;
  beginBatch();
  var n = 0;
  for (var y = 0; y < c.h; y++)
    for (var z = 0; z < c.d; z++)
      for (var x = 0; x < c.w; x++) {
        var b = c.blocks[n], sh = c.shapes[n];
        var lv = c.levels ? c.levels[n] : 0;
        n++;
        if (b === AIR) continue;                 // 빈칸은 덮어쓰지 않는다
        if (!applyEdit(px + x, py + y, pz + z, b, true, sh)) continue;
        // 흐르던 물은 붙여넣어도 흐르는 물이어야 한다 (applyEdit 은 손으로 놓은 물을 근원으로 본다)
        if ((b === WATER || b === LAVA) && lv > 0) {
          waterLvl[idx(px + x, py + y, pz + z)] = lv;
          enqueueDryAround(px + x, py + y, pz + z);
        }
      }
  return endBatch("붙여넣기");
}

// ── 명령 처리 — 짧은 이름 하나로 알아듣게
export var CMD_HELP =
  "tp <x> <y> <z> · time <아침|정오|노을|밤|0~1> · weather <맑음|비|눈> · " +
  "fill <블록|공기> · expand <±dx> <±dy> <±dz> · clone <dx> <dy> <dz> · give <블록> · count · bp <save|use|list> <이름> · undo <n> · redo <n> · seed · gm <속도> · help";

// 한국어 이름과 영어 이름을 둘 다 알아듣는다 — "조약돌" 도 "cobble" 도 된다
function findBlock(name) {
  if (!name) return -1;
  var q = String(name).toLowerCase();
  function label(b) {
    return ((NAMES[b] || "") + " " + (NAMES_EN[b] || "")).toLowerCase();
  }
  for (var i = 0; i < ALL_BLOCKS.length; i++) {
    var b = ALL_BLOCKS[i];
    var parts = label(b).split(" ");
    for (var p = 0; p < parts.length; p++) {
      if (parts[p] && parts[p] === q) return b;
    }
    if (label(b).replace(/\s+/g, "") === q.replace(/\s+/g, "")) return b;
  }
  for (var j = 0; j < ALL_BLOCKS.length; j++) {
    var b2 = ALL_BLOCKS[j];
    if (label(b2).indexOf(q) >= 0) return b2;
  }
  return -1;
}

export var CMD_LIST = ["tp", "time", "weather", "fill", "expand", "clone", "give", "count", "bp", "undo", "redo", "seed", "gm", "help"];
// 앞글자만 쳐도 알아듣게 — 명령이 열 개나 되면 오타 한 번에 막힌다
export function completeCommand(prefix) {
  var q = String(prefix || "").trim().toLowerCase();
  if (!q) return "";
  var hit = CMD_LIST.filter(function (c) { return c.indexOf(q) === 0; });
  return hit.length === 1 ? hit[0] : "";
}

export function runCommand(line) {
  var parts = String(line).trim().split(/\s+/);
  var cmd = (parts[0] || "").toLowerCase();
  if (!cmd) return "";
  if (CMD_LIST.indexOf(cmd) < 0) {
    var guess = completeCommand(cmd);
    if (guess) cmd = guess;
  }
  if (cmd === "help" || cmd === "?") return CMD_HELP;

  if (cmd === "tp") {
    var x = parseFloat(parts[1]), y = parseFloat(parts[2]), z = parseFloat(parts[3]);
    if (!isFinite(x) || !isFinite(y) || !isFinite(z)) return "tp <x> <y> <z>";
    player.pos.set(Math.max(0.4, Math.min(WX - 0.4, x)),
                   Math.max(1, Math.min(WY - 2, y)),
                   Math.max(0.4, Math.min(WZ - 0.4, z)));
    player.vel.set(0, 0, 0);
    return "이동: " + Math.floor(player.pos.x) + " " + Math.floor(player.pos.y) + " " + Math.floor(player.pos.z);
  }

  if (cmd === "time") {
    var w = (parts[1] || "").toLowerCase();
    var map = { "아침": 0.26, "정오": 0.5, "노을": 0.74, "밤": 0.98,
                "morning": 0.26, "noon": 0.5, "sunset": 0.74, "night": 0.98 };
    var t = map[w];
    if (t === undefined) t = parseFloat(w);
    if (!isFinite(t)) return "time <아침|정오|노을|밤|0~1>";
    S.timeOfDay = ((t % 1) + 1) % 1;
    return "시각: " + (S.timeOfDay * 24).toFixed(1) + "시";
  }

  if (cmd === "weather") {
    var wm = { "맑음": 0, "비": 1, "눈": 2, "clear": 0, "rain": 1, "snow": 2 };
    var wv = wm[(parts[1] || "").toLowerCase()];
    if (wv === undefined) return "weather <맑음|비|눈>";
    setWeather(wv);        // 상태만 바꾸면 비도 눈도 안 보이는데 눈은 쌓인다
    return "날씨: " + parts[1];
  }

  if (cmd === "give") {
    var gb = findBlock(parts.slice(1).join(" "));
    if (gb < 0) return "그런 블록이 없습니다";
    S.bar[S.selected] = gb;
    return "핫바에 " + NAMES[gb];
  }

  if (cmd === "fill") {
    var fname = parts.slice(1).join(" ");
    // "공기" 는 블록 목록에 없다 — 비우기로 알아듣는다
    if (/^(공기|빈칸|air|없음)$/i.test(fname.trim())) {
      var nc = clearSelection();
      if (nc < 0) return "영역이 너무 큽니다";
      if (!nc) return "먼저 Alt+클릭으로 영역을 고르세요";
      return nc.toLocaleString("ko-KR") + "칸을 비웠습니다";
    }
    var fb = findBlock(fname);
    if (fb < 0) return "그런 블록이 없습니다";
    var n = fillSelection(fb, SH_FULL);
    if (n < 0) return "영역이 너무 큽니다";
    if (!n) return "먼저 Alt+클릭으로 영역을 고르세요";
    return n.toLocaleString("ko-KR") + "칸을 " + NAMES[fb] + " 로";
  }

  if (cmd === "gm") {
    var sp = parseFloat(parts[1]);
    if (!isFinite(sp)) return "gm <0.5~4>";
    S.flySpeed = Math.max(0.5, Math.min(4, sp));
    return "비행 속도 ×" + S.flySpeed.toFixed(2);
  }

  if (cmd === "bp") {
    var sub = (parts[1] || "").toLowerCase();
    var nm = parts.slice(2).join(" ");
    if (sub === "save") { var e1 = saveBlueprint(nm); return e1 || ("청사진 저장: " + nm); }
    if (sub === "use") { var e2 = useBlueprint(nm); return e2 || ("청사진 준비됨: " + nm + " — Ctrl+V 로 붙여넣기"); }
    if (sub === "list") { var ns = blueprintNames(); return ns.length ? ns.join(", ") : "저장된 청사진이 없습니다"; }
    return "bp <save|use|list> <이름>";
  }

  if (cmd === "count") {
    var cl = selectionCounts();
    if (!cl) return "먼저 Alt+클릭으로 영역을 고르세요";
    if (!cl.length) return "영역이 비어 있습니다";
    return cl.slice(0, 4).map(function (e) { return e.name + " " + e.n; }).join(" · ")
           + (cl.length > 4 ? " …" : "");
  }

  // 되돌리기를 한 번에 여러 단계 — 대량 편집을 시험하다 망쳤을 때 손이 덜 아프다
  if (cmd === "undo" || cmd === "redo") {
    var times = parseInt(parts[1], 10);
    if (!isFinite(times) || times < 1) times = 1;
    times = Math.min(times, 200);
    var done = 0;
    for (var u = 0; u < times; u++) {
      if (!(cmd === "undo" ? undo() : redo())) break;
      done++;
    }
    if (!done) return cmd === "undo" ? "되돌릴 것이 없습니다" : "다시 실행할 것이 없습니다";
    return done + "단계를 " + (cmd === "undo" ? "되돌렸습니다" : "다시 실행했습니다");
  }

  // 고른 상자를 여섯 방향으로 늘린다 — 사거리가 6칸이라 30칸 영역은 두 모서리로 날아가야 했다.
  // 양수는 +쪽으로, 음수는 −쪽으로 늘어난다. `/expand 0 20 0` 위로 20칸 · `/expand 0 -5 0` 아래로 5칸.
  if (cmd === "expand") {
    var sx2 = parseInt(parts[1], 10), sy2 = parseInt(parts[2], 10), sz2 = parseInt(parts[3], 10);
    if (!isFinite(sx2) || !isFinite(sy2) || !isFinite(sz2)) return "expand <±dx> <±dy> <±dz> — 양수는 +쪽, 음수는 −쪽으로 늘린다";
    var sb = bounds();
    if (!sb) return "먼저 Alt+클릭으로 영역을 고르세요";
    function grow(lo, hi, d, max) {
      if (d >= 0) hi += d; else lo += d;         // 양수는 +쪽으로, 음수는 −쪽으로 늘린다
      lo = Math.max(0, Math.min(max - 1, lo));
      hi = Math.max(0, Math.min(max - 1, hi));
      if (lo > hi) { var t2 = lo; lo = hi; hi = t2; }
      return [lo, hi];
    }
    var gx2 = grow(sb.x0, sb.x1, sx2, WX);
    var gy2 = grow(sb.y0, sb.y1, sy2, WY);
    var gz2 = grow(sb.z0, sb.z1, sz2, WZ);
    S.selA = [gx2[0], gy2[0], gz2[0]];
    S.selB = [gx2[1], gy2[1], gz2[1]];
    return "영역 " + (gx2[1] - gx2[0] + 1) + "×" + (gy2[1] - gy2[0] + 1) + "×" + (gz2[1] - gz2[0] + 1) +
           " · " + selectionSize().toLocaleString("ko-KR") + "칸";
  }

  // 고른 영역을 그대로 한 벌 더 — 계단·기둥처럼 되풀이되는 것을 손으로 다시 짓지 않게
  if (cmd === "clone") {
    var ox = parseInt(parts[1], 10), oy = parseInt(parts[2], 10), oz = parseInt(parts[3], 10);
    if (!isFinite(ox) || !isFinite(oy) || !isFinite(oz)) return "clone <dx> <dy> <dz>";
    var bb = selectionBounds();
    if (!bb) return "먼저 Alt+클릭으로 영역을 고르세요";
    var cn = copySelection();
    if (cn < 0) return "영역이 너무 큽니다";
    if (!cn) return "영역이 비어 있습니다";
    var pn2 = pasteClip(bb.x0 + ox, bb.y0 + oy, bb.z0 + oz);
    if (!pn2) return "붙여넣지 못했습니다";
    return pn2.toLocaleString("ko-KR") + "칸을 복제했습니다";
  }

  if (cmd === "seed") return "SEED " + S.worldSeed;

  return "모르는 명령: " + cmd + "  (help)";
}

// ── 청사진 — 복사한 영역을 이름 붙여 두고 나중에 다시 쓴다
export var BP_KEY = "blockyard.blueprints";

export function loadBlueprints() {
  try { return JSON.parse(localStorage.getItem(BP_KEY) || "{}"); } catch (e) { return {}; }
}
export function saveBlueprint(name) {
  if (!S.clip) return "복사한 것이 없습니다";
  if (!name) return "이름을 적어 주세요";
  var all = loadBlueprints();
  // 숫자 배열을 그대로 JSON 에 넣으면 15,376칸이 63KB 다 — 세계 저장 3슬롯과
  // localStorage 를 나눠 쓰는데 청사진 몇 개면 밀어낸다. 세계 저장과 같은 RLE+Base64 로.
  all[name] = {
    v: 2, w: S.clip.w, h: S.clip.h, d: S.clip.d,
    be: encodeArrB64(S.clip.blocks),
    se: encodeArrB64(S.clip.shapes),
    le: encodeArrB64(S.clip.levels || new Uint8Array(S.clip.blocks.length))
  };
  try { localStorage.setItem(BP_KEY, JSON.stringify(all)); }
  catch (e) { return "저장 공간이 부족합니다"; }
  return "";
}
export function useBlueprint(name) {
  var all = loadBlueprints();
  var bp = all[name];
  if (!bp) return "그런 청사진이 없습니다";
  var n = bp.w * bp.h * bp.d;
  var blocks = new Uint8Array(n), shapes = new Uint8Array(n), levels = new Uint8Array(n);
  if (bp.v === 2) {                       // RLE+Base64 (v2)
    if (!decodeArrB64(bp.be, blocks) || !decodeArrB64(bp.se, shapes)) return "청사진을 읽지 못했습니다";
    if (bp.le) decodeArrB64(bp.le, levels);
  } else {                                // 예전 청사진(숫자 배열) 도 그대로 읽는다
    blocks.set(bp.b.slice(0, n));
    shapes.set(bp.s.slice(0, n));
  }
  S.clip = { w: bp.w, h: bp.h, d: bp.d, blocks: blocks, shapes: shapes, levels: levels };
  return "";
}
export function blueprintNames() { return Object.keys(loadBlueprints()); }

// ── 영역 안 블록 통계 — 무엇으로 지었는지 세어 준다
export function selectionCounts() {
  var b = selectionBounds();
  if (!b) return null;
  var counts = {};
  for (var y = b.y0; y <= b.y1; y++)
    for (var z = b.z0; z <= b.z1; z++)
      for (var x = b.x0; x <= b.x1; x++) {
        var v = world[idx(x, y, z)];
        if (v === AIR) continue;
        counts[v] = (counts[v] || 0) + 1;
      }
  var list = Object.keys(counts).map(function (k) {
    return { block: +k, name: NAMES[+k] || ("#" + k), n: counts[k] };
  });
  list.sort(function (a, b2) { return b2.n - a.n; });
  return list;
}
