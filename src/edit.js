// edit.js — 편집 · 되돌리기 · 도전 과제
import { S } from "./state.js";
import { Q } from "./queues.js";
import { opts } from "./settings.js";
import { encodeArrB64, decodeArrB64, SLOTS } from "./save.js";
import { SEA, DIRS, N, PLANE, WX, WY, WZ, idx, inside } from "./dims.js";
import { isCarpet, ITEMS, POT, FRAME, FENCE, GLASS, PLANKS, BRICK, isSapling, SH_STAIR_N, SH_STAIR_E, SH_STAIR_S, SH_STAIR_W, SH_STAIR_NU, LAMP, FLOWER_R, FLOWER_Y, SH_STAIR_WU, SH_WALL_N, SH_WALL_W, SH_DOOR_N, SH_AXIS_X, SH_AXIS_Z, TORCH, isWool, DOOR, LAVA, AIR, ALL_BLOCKS, EMIT, ICE, NAMES, NAMES_EN, SH_FULL, WALL_DIR, WATER, isClimbable, isCross, isItem, isLog, isSolid, isUnbreakable, isWallShape } from "./blocks.js";
import { markX, markY, markZ, markName, topMap, refreshAllTops, touched, get, BIOME_NAMES, markTouched, isTouched, setTouched, refreshTop, shape, waterLvl, world } from "./world.js";
import { relightAll, relightLocal } from "./light.js";
import { enqueueGrow, enqueueLavaAround, enqueueLavaDryAround, enqueueDryAround, enqueueFall, enqueueWaterAround, queueLeafDecay } from "./fluids.js";
import { markAllDirty, touch } from "./mesh.js";
import { boxHitsWorld, player, stats } from "./player.js";
import { tone } from "./audio.js";
import { helpAchList, refreshBar, showAchPop, toast } from "./hud.js";
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
  // 카펫도 바닥이 있어야 한다(needsFloor) — 놓을 때는 막으면서 **밑을 캐면 허공에 떠 있었다**.
  // v74 에서 카펫을 넣을 때 여기 목록에 안 넣은 것이다 (v84 에서 색 카펫 시험이 잡았다).
  if (!isCross(db) && !isClimbable(db) && db !== DOOR &&
      !isCarpet(db) && db !== POT && db !== FRAME) return;
  if (isCarpet(db) || db === POT) {
    if (wall) return;                          // 카펫·화분은 벽이 아니라 바닥에 놓인다
    if (isSolid(get(x, y - 1, z))) return;
    applyEdit(x, y, z, AIR, record, SH_FULL, (depth || 0) + 1);
    return;
  }
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
  if (isSapling(to)) enqueueGrow(x, y, z);   // 심은 묘목은 자라기를 기다린다
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
    var wasTouched = isTouched(x, y, z);   // 되돌릴 때 이 표시도 되돌린다 (v100)
    markTouched(x, y, z);          // 되돌리기에 남는 편집 = 사람이 손댄 자리
    // wl — 편집 전 물 레벨. 없으면 흐르는 물을 캔 뒤 되돌릴 때 근원(0)으로 되살아나 무한 물이 생긴다
    if (S.batch) batchPush(S.batch, x, y, z, from, to, fromSh, toSh, fromWl, 0, wasTouched);  // 묶음 중이면 모아 둔다
    else {
      var rec = { x: x, y: y, z: z, from: from, to: to, fromSh: fromSh, toSh: toSh, wl: fromWl, fromT: wasTouched };
      S.history.push(rec);
      trimHistory();
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
           fromSh: new Uint8Array(cap), toSh: new Uint8Array(cap),
           wl: new Uint8Array(cap), toWl: new Uint8Array(cap),
           fromT: new Uint8Array(cap) };   // 편집 전 '사람이 손댄 칸' 표시 (v100)
}
function batchGrow(b) {
  var cap = b.cap * 2, keys = ["x", "y", "z", "from", "to", "fromSh", "toSh", "wl", "toWl", "fromT"];
  var big = makeBatch(cap);
  for (var k = 0; k < keys.length; k++) big[keys[k]].set(b[keys[k]]);
  big.n = b.n;
  for (var k2 = 0; k2 < keys.length; k2++) b[keys[k2]] = big[keys[k2]];
  b.cap = cap;
}
// toWl — 되돌린 것을 다시 할 때(redo) 돌아갈 물 레벨. 없으면 흐르던 물 192칸이
// 전부 근원(0)으로 되살아나 무한 물이 된다 (자문 12차 #1).
export function batchPush(b, x, y, z, from, to, fromSh, toSh, wl, toWl, fromT) {
  if (b.n === b.cap) batchGrow(b);
  var i = b.n++;
  b.x[i] = x; b.y[i] = y; b.z[i] = z;
  b.from[i] = from; b.to[i] = to;
  b.fromSh[i] = fromSh; b.toSh[i] = toSh; b.wl[i] = wl; b.toWl[i] = toWl || 0;
  b.fromT[i] = fromT ? 1 : 0;
}

// 대량 편집(채우기·붙여넣기)은 한 덩어리로 묶어 한 번에 되돌린다
export function beginBatch(cap) {
  S.batch = makeBatch(cap || 1024); S.batchCells = 0;
  S.fallOwner = null; S.fireOwner = null; S.fluidOwner = null;   // 새 편집이 시작되면 지난 주인은 놓는다
}
// 방금 기록된 편집을 "이 불의 주인" 으로 삼는다 — 번짐과 타 없어짐이 여기에 실린다.
// 불은 오래 타므로 상한을 둔다. 넘으면 그때부터는 기록하지 않는다(대부분은 이미 담겼다).
export var FIRE_UNDO_MAX = 20000;
// 물은 불보다 훨씬 많이 번진다 — 바다를 통째로 끌어들이면 끝이 없으므로 상한을 둔다
export var FLUID_UNDO_MAX = 40000;
export function ownFire() {
  var last = S.history[S.history.length - 1];
  S.fireOwner = (last && last.batch) ? last.batch : null;
}
// 묶음이 끝나면 조명과 기둥 높이를 한 번에 맞춘다.
// 400칸이 넘으면 세계 전체를 다시 켜는 게 칸마다 BFS 를 도는 것보다 싸다 (relightAll 은 25ms 고정).
export var BATCH_RELIGHT_ALL = 400;
// 세계 전체를 다시 켠다 — 부를 곳: 대량 편집 뒤, 세계를 갈아탄 뒤.
// list 를 주면 **바뀐 자리 둘레만** 다시 굽는다.
// relightAll(true) 는 이미 "빛이 실제로 바뀐 청크" 만 표시하므로(light.js),
// 거기에 markAllDirty() 를 얹으면 그 정밀도를 통째로 버린다 —
// 바닥 한 장(23×23 = 529칸)을 깔아도 세계 144청크를 전부 다시 구웠다 (자문 10차 실측).
export function settleWorld(list) {
  if (list && list.n) {
    // 기둥 높이는 손댄 칸의 열만 — 9,216 열을 다 훑을 이유가 없다
    for (var t = 0; t < list.n; t++) refreshTop(list.x[t], list.z[t]);
  } else refreshAllTops();
  relightAll(true);        // 빛이 바뀐 청크는 여기서 스스로 표시된다
  if (list && list.n) {
    // 블록이 바뀐 자리도 다시 구워야 한다 — 빛은 그대로여도 면이 달라진다
    for (var u = 0; u < list.n; u++) touch(list.x[u], list.y[u], list.z[u]);
  } else markAllDirty();
}
function settleBatch(cells, list) {
  if (!cells) return;
  if (cells > BATCH_RELIGHT_ALL) { settleWorld(list); return; }
  for (var i = 0; i < list.n; i++) {
    touch(list.x[i], list.y[i], list.z[i]);
    refreshTop(list.x[i], list.z[i]);
    relightLocal(list.x[i], list.y[i], list.z[i]);
  }
}
// 되돌리기가 먹는 메모리의 상한 — 단계 수만으로는 못 막는다.
// 문 하나 여닫기와 32,768칸 채우기가 같은 한 칸을 먹기 때문이다.
// 40,000칸 채우기를 40번 하면 힙이 23.8MB → 110.5MB 였다(자문 9차 실측, 한 번에 2.2MB).
// opts.undo 는 2000까지 올라가므로 개수만 보면 폰에서 탭이 죽는다.
export var HISTORY_CELLS_MAX = 2000000;
function entryCells(e) { return e && e.batch ? e.batch.n : 1; }
// 오래된 것부터 버려 개수와 칸 수를 둘 다 상한 아래로 맞춘다
function trimHistory() {
  var maxN = opts.undo || HISTORY_MAX;
  while (S.history.length > maxN) S.history.shift();
  var cells = 0;
  for (var i = 0; i < S.history.length; i++) cells += entryCells(S.history[i]);
  while (S.history.length > 1 && cells > HISTORY_CELLS_MAX) cells -= entryCells(S.history.shift());
}

// 놓은 것을 센다 (v97) — 예전에는 이 셈이 **우클릭 한 경로에만** 있어서,
// 영역 채우기·붙여넣기·청사진·/fill·/clone 으로 3,633칸을 지어도
// stats.placed 0 · placedKinds 0/75 · 램프 과제 0 이었다.
// 이 게임이 "마크보다 나은 부분" 이라고 적어 둔 도구를 쓸수록 게임이 나를 안 본 것으로 쳤다
export function notePlaced(b, sh, n) {
  if (b === AIR) return;
  stats.placed += n;
  unlock("firstPlace");
  if (stats.placed >= 100) unlock("place100");
  if (b === LAMP) { S.lampsPlaced += n; if (S.lampsPlaced >= 10) unlock("lamp10"); }
  if (b === TORCH) { S.torchesPlaced += n; if (S.torchesPlaced >= 10) unlock("torch10"); }
  if (b === FLOWER_R || b === FLOWER_Y) unlock("flower");
  if (sh === SH_STAIR_N || sh === SH_STAIR_E || sh === SH_STAIR_S || sh === SH_STAIR_W ||
      sh >= SH_STAIR_NU) unlock("stair");
  S.placedKinds[b] = 1;
  var allKinds = true;
  for (var ak = 0; ak < ALL_BLOCKS.length; ak++) if (!S.placedKinds[ALL_BLOCKS[ak]]) allKinds = false;
  if (allKinds) unlock("collector");
}

// 제 몸이 고체에 잠겼으면 위로 밀어 올린다 (v98).
// Ctrl+F 로 제 발밑을 채우면 걷지도 날지도 못하고 갇혔다 —
// v95 가 /tp 에서 쓴 처방을 편집 쪽에도 둔다 (되돌리기가 있어도 갇힌 채로는 못 누른다)
export function liftIfBuried() {
  // **몸 상자가 실제로 블록과 겹칠 때만** 올린다 (v99).
  // isSolid(get(...)) 는 모양을 못 봐서, 반블록·계단·카펫·눈 위에 선 것까지
  // "묻혔다" 로 읽었다 — endBatch 는 기록되는 편집마다 도니까,
  // 반블록 바닥에서 블록 하나만 놓아도 사람이 한 칸 위로 튀어 올랐다.
  if (!boxHitsWorld(player.pos.x, player.pos.y, player.pos.z)) return false;
  var gy = Math.floor(player.pos.y);
  for (var y2 = gy; y2 < WY - 2; y2++) {
    if (!boxHitsWorld(player.pos.x, y2, player.pos.z)) {
      player.pos.y = y2;
      player.vel.set(0, 0, 0);
      return true;
    }
  }
  return false;
}

// credit 이 참일 때만 통계·과제에 싣는다 (v99).
// v97 이 여기서 무조건 셌더니 ① 손으로 놓은 블록이 **두 번** 세어져
// 「100칸」이 50칸에, 「등대지기」가 램프 5개에 열렸고(문은 3배)
// ② **자란 나무 30칸·번진 불·깬 얼음까지** 사람이 놓은 것으로 쳤다.
// applyEdit 은 기록되는 단일 편집마다 제 묶음을 열기 때문에 기본이 거짓이라야 한다.
export function endBatch(label, credit) {
  var b = S.batch;
  var cells = S.batchCells;
  S.batch = null; S.batchCells = 0;
  settleBatch(cells, b || { n: 0 });
  if (!b || !b.n) return 0;
  S.everEdited = true;
  S.history.push({ batch: b, label: label || "대량 편집" });
  // 이 편집 때문에 떨어질 것이 큐에 남아 있으면, 그 낙하도 이 묶음의 일이다.
  // fallTick 이 여기에 실어야 Ctrl+Z 한 번으로 떨어진 자리까지 되돌아온다.
  S.fallOwner = (Q.fallHead < Q.fallQ.length) ? b : null;
  // 물·용암도 마찬가지다 — 벽 한 장을 캐서 밀려든 물 192칸이 기록에 없으면
  // Ctrl+Z 가 벽만 돌려놓고 물은 그대로 둔다 (자문 12차 #1).
  var fluidPending = Q.waterHead < Q.waterQ.length || Q.dryHead < Q.dryQ.length ||
                     Q.lavaHead < Q.lavaQ.length || Q.lavaDryHead < Q.lavaDryQ.length;
  S.fluidOwner = fluidPending ? b : null;

  // 영역 도구로 지은 것도 통계·과제에 싣는다 (v97).
  // 같은 종류는 한 번만 세지 않고 칸수만큼 센다 — 램프 열 개를 영역으로 깔아도
  // 「등대지기」가 열려야 한다. 종류별로 모아 불러 unlock 검사를 덜 돌린다
  if (b.n && credit) {

    var byKind = {}, ki;
    for (ki = 0; ki < b.n; ki++) {
      var tb = b.to[ki];
      if (tb === AIR) continue;
      var kk = tb * 32 + (b.toSh[ki] | 0);
      byKind[kk] = (byKind[kk] || 0) + 1;
    }
    var placedN = 0;
    for (var kv in byKind) {
      if (!byKind.hasOwnProperty(kv)) continue;
      notePlaced(Math.floor(kv / 32), kv % 32, byKind[kv]);
      placedN += byKind[kv];
    }
    // **짓는 것**만 센다 (v108) — 예전에는 묶음 칸수만 봐서
    // 영역 비우기 144칸도, TNT 169칸도 「대공사(짓는다)」를 열었다.
    // byKind 는 AIR 을 건너뛰므로 여기 남은 수가 "실제로 놓은 칸" 이다
    if (placedN >= 100) unlock("build100");
  }
  trimHistory();
  S.future.length = 0;
  if (liftIfBuried()) toast("몸이 묻혀 위로 올렸습니다");
  return b.n;
}

// 묶음(타입 배열)의 i 번째를 되돌린다 — 객체를 만들지 않는다
function applyCellAt(b, i, toSide, defer) {
  var x = b.x[i], y = b.y[i], z = b.z[i];
  var w = idx(x, y, z);
  world[w] = toSide ? b.to[i] : b.from[i];
  shape[w] = (toSide ? b.toSh[i] : b.fromSh[i]) || SH_FULL;
  waterLvl[w] = toSide ? (b.toWl ? b.toWl[i] : 0) : b.wl[i];
  // 사람이 손댄 자국도 그 순간으로 (v100) — 안 되돌리면 눈이 영영 안 쌓인다
  setTouched(x, y, z, toSide ? 1 : (b.fromT ? b.fromT[i] : 1));
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
  setTouched(e.x, e.y, e.z, toSide ? 1 : !!e.fromT);
  // defer — 큰 묶음을 되돌릴 때는 조명·기둥·메시를 칸마다 하지 않는다 (끝에 한 번)
  if (!defer) { touch(e.x, e.y, e.z); refreshTop(e.x, e.z); relightLocal(e.x, e.y, e.z); }
  if (world[i] === AIR) enqueueWaterAround(e.x, e.y, e.z);
  // 근원을 되돌려 없애면 거기서 퍼진 물이 말라야 하고, 되살리면 다시 퍼져야 한다
  if (e.from === WATER || e.to === WATER) { enqueueDryAround(e.x, e.y, e.z); enqueueWaterAround(e.x, e.y, e.z); }
}

// 무엇을 되돌렸는지 한 줄로 — "채우기 32,768칸" 처럼.
// endBatch 가 라벨을 이미 저장해 두는데 아무도 안 읽고 있었다.
// 안 알려 주면 240단계나 되는 되돌리기를 무서워서 두세 번 이상 못 누른다.
export function editLabel(e) {
  if (!e) return "";
  // v59 부터 사람의 편집 하나도 묶음이다(딸려 사라지는 것을 같이 담으려고).
  // 그래서 "1칸짜리 묶음" 은 대량 편집이 아니라 그냥 한 칸 놓기·캐기다.
  if (e.batch) {
    if (e.batch.n === 1) return cellLabel(e.batch.from[0], e.batch.to[0]);
    return (e.label || "대량 편집") + " " + e.batch.n.toLocaleString("en-US") + "칸";
  }
  return cellLabel(e.from, e.to);
}
function cellLabel(from, to) {
  var name = NAMES[to === AIR ? from : to] || "블록";
  return (to === AIR ? name + " 캐기" : name + " 놓기");
}
export var lastEditLabel = "";

// 되돌릴 것이 없을 때 그 **이유**를 남긴다.
// "더 없음" 만 뜨면, 이어하기 직후에는 되돌리기가 고장 난 줄 안다 —
// 240단계라고 설정에 적어 놓고 껐다 켜면 0인데 그 말을 안 했다.
export var undoEmptyWhy = "";
export function undo() {
  var e = S.history.pop();
  if (!e) {
    undoEmptyWhy = S.loadedFromSave && !S.everEdited
      ? "지난 판의 되돌리기는 남지 않습니다 — 설정 › 직전으로 되돌리기"
      : "";
    return false;
  }
  lastEditLabel = editLabel(e);
  if (e.batch) {
    var big = e.batch.n > BATCH_RELIGHT_ALL;
    for (var i = e.batch.n - 1; i >= 0; i--) applyCellAt(e.batch, i, false, big);
    // **고친 자리만** 다시 굽는다 (v97). 예전에는 400칸이 넘는 묶음이면
    // 어떤 되돌리기든 세계 144청크를 통째로 구웠다 — 441칸을 되돌리는 데
    // 9청크면 될 것을 144청크 굽고, 2,400칸 집을 되돌리면 최악 프레임이 49.8ms 로 튀었다.
    // endBatch 는 이미 목록을 넘겨 9청크로 끝내고 있었다 — 정답이 옆줄에 있었다
    if (big) settleWorld(e.batch);
  }
  else applyCell(e, false);
  S.future.push(e);
  S.worldDirty = true;
  return true;
}
export function redo() {
  var e = S.future.pop();
  if (!e) return false;
  lastEditLabel = editLabel(e);
  if (e.batch) {
    var big2 = e.batch.n > BATCH_RELIGHT_ALL;
    for (var i = 0; i < e.batch.n; i++) applyCellAt(e.batch, i, true, big2);
    if (big2) settleWorld(e.batch);   // 다시하기도 고친 자리만 (v97)
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
  { id: "high", name: "꼭대기", desc: "해수면보다 16칸 높은 곳에 딛고 선다 (날아서는 안 된다)" },
  { id: "lamp10", name: "등대지기", desc: "램프를 10개 놓는다" },
  { id: "flood", name: "수문장", desc: "물을 흘려 퍼뜨린다" },
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
  { id: "fire", name: "불장난", desc: "부싯돌로 무언가에 불을 붙인다" },
  { id: "boom", name: "쾅", desc: "TNT 를 터뜨린다" },
  { id: "build100", name: "대공사", desc: "영역 채우기로 100칸 이상을 한 번에 짓는다" },
  { id: "explorer", name: "탐험가", desc: "미니맵 표식을 5개 찍는다" },
  { id: "feed", name: "친구", desc: "동물에게 꽃을 준다" },
  { id: "photo", name: "사진사", desc: "사진 모드로 화면을 저장한다" },
  { id: "gold", name: "금맥", desc: "금 광석을 캔다" },
  { id: "diamond", name: "다이아몬드!", desc: "다이아몬드 광석을 캔다" },
  { id: "breed", name: "목장주", desc: "동물 둘에게 꽃을 주어 새끼를 얻는다" },
  { id: "sapling", name: "숲지기", desc: "심은 묘목이 나무로 자란다" },
  // 여기부터는 "기능을 만져 봤나" 가 아니라 **지은 것**을 본다.
  // 크리에이티브에서 "다음에 뭐 하지" 를 막아 주는 건 이것뿐이다.
  { id: "room", name: "내 집", desc: "문이 달린 방을 짓는다 (27칸 이상 · 밖이 안 보이게)" },
  { id: "tower", name: "전망대", desc: "20칸 높이로 쌓아 올린다" },
  { id: "bridge", name: "다리", desc: "물 위로 20칸을 잇는다" },
  { id: "mineshaft", name: "내 갱도", desc: "지하 깊이 200칸을 파고 횃불 10개를 단다" },
  // 세계가 만들어 둔 것을 찾는 과제 — v76 오두막과 v81 갱도에 그 고리가 안 달려 있었다.
  // 크리에이티브에서 "다음에 뭐 하지" 를 막아 주는 건 과제뿐인데,
  // 가장 최근에 만든 콘텐츠를 게임이 한 번도 가리키지 않았다 (자문 14차 #7).
  { id: "findMine", name: "먼저 온 사람", desc: "버려진 갱도를 찾아낸다 (지하의 나무 버팀목)" },
  { id: "findHut", name: "빈집", desc: "버려진 오두막을 찾아낸다" },
  { id: "palette", name: "색칠", desc: "한자리에 양털 여덟 빛깔을 쓴다" },
  { id: "cartographer", name: "지도장이", desc: "섬의 8할을 지도에 밝힌다 (날아도 됩니다)" }
];
export var achGrid = document.getElementById("achgrid");

// 진행도가 있는 과제는 숫자를 같이 보여 준다 (v100).
// 「수집가」는 종류가 많은데(v100 당시 76 · v112 에서 94) **무엇이 남았는지 알 길이 없어**
// 40개 중 하나가 죽은 목표였다 — 그중 48종이 색만 다른 것(양털·카펫·색 유리 각 16)이라
// 눈으로 훑기도 어렵다.
// 개수는 S.placedKinds 로 이미 세고 있었다
export function achProgress(a) {
  if (S.earned[a.id]) return "";
  if (a.id === "collector")
    return " (" + Object.keys(S.placedKinds).length + " / " + ALL_BLOCKS.length + ")";
  if (a.id === "lamp10") return " (" + Math.min(10, S.lampsPlaced | 0) + " / 10)";
  if (a.id === "torch10") return " (" + Math.min(10, S.torchesPlaced | 0) + " / 10)";
  if (a.id === "place100") return " (" + Math.min(100, stats.placed) + " / 100)";
  if (a.id === "mine100") return " (" + Math.min(100, stats.mined) + " / 100)";
  return "";
}

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
            '<span>' + a.name + ' · ' + a.desc + achProgress(a) + '</span></div>';
  }
  achGrid.innerHTML = html;
  if (helpAchList) helpAchList.innerHTML = html;
}
// ── 지은 것을 보는 과제 — 사람이 손댄 칸(touched)만 센다.
// 자연 지형이 우연히 조건을 채워 과제를 주면 "내가 지었다" 는 느낌이 사라진다.
export var BUILD_R = 32;          // 플레이어 주변 이만큼만 본다 (44만 칸을 다 볼 이유가 없다)
export var BUILD_IDS = ["room", "tower", "bridge", "mineshaft", "palette"];
// 세계가 지어 둔 것을 찾는 과제 — 사람이 놓지 않은(`touched` 가 아닌) 블록만 센다.
// 그게 "만들어진 것" 과 "내가 지은 것" 을 가르는 유일한 잣대다.
export var FOUND_IDS = ["findMine", "findHut"];
export var FOUND_R = 6;
export function checkFoundAchievements() {
  var left = false;
  for (var q = 0; q < FOUND_IDS.length && !left; q++) if (!S.earned[FOUND_IDS[q]]) left = true;
  if (!left) return;
  var px = Math.floor(player.pos.x), py = Math.floor(player.pos.y), pz = Math.floor(player.pos.z);
  var wood = 0, glass = 0, built = 0;
  for (var y = py - 4; y <= py + 4; y++) {
    if (y < 1 || y >= WY) continue;
    for (var x = px - FOUND_R; x <= px + FOUND_R; x++) {
      if (x < 0 || x >= WX) continue;
      for (var z = pz - FOUND_R; z <= pz + FOUND_R; z++) {
        if (z < 0 || z >= WZ) continue;
        var i = idx(x, y, z);
        if (touched[i] === 1) continue;              // 사람이 놓은 것은 안 센다
        var b = world[i];
        if (y < SEA && b === FENCE) wood++;           // 갱도 버팀목
        else if (y > SEA) {
          if (b === GLASS) glass++;                   // 오두막 창 — 자연에는 없다
          else if (b === PLANKS || b === BRICK) built++;
        }
      }
    }
  }
  if (wood >= 2) unlock("findMine");
  if (glass >= 1 || built >= 24) unlock("findHut");
}
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
  bridgeEW.length = 0;
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
      // SEA + 1 부터 본다 (v97) — 바다를 건너는 다리는 **수면 바로 위 한 칸**에 놓는다.
      // 아무도 2칸을 띄우지 않는데 그 한 칸 때문에 가장 자연스러운 다리가 안 세졌다
      for (y = SEA + 1; y < WY - 1 && !over; y++) {
        i = idx(x, y, z);
        if (touched[i] !== 1 || world[i] === AIR) continue;
        // 아래로 훑어 바닥이 물이면 물 위에 놓인 것이다
        for (var dy = y - 1; dy > 0; dy--) {
          var ub = world[idx(x, dy, z)];
          if (ub === WATER) { over = true; break; }
          if (ub !== AIR) break;
        }
      }
      // **두 축을 다 센다** (v108) — z 루프 안에서만 누적하고 x 한 줄이 끝날 때마다
      // 0 으로 되돌려서, **동서로 놓은 다리는 영원히 20 에 못 닿았다**(기둥마다 1).
      // 방향은 지형이 정하는데 사람은 자기가 뭘 잘못했는지 알 길이 없었다
      bridgeSpan = over ? bridgeSpan + 1 : 0;
      bridgeEW[z] = over ? (bridgeEW[z] || 0) + 1 : 0;
      if (bridgeSpan >= 20 || bridgeEW[z] >= 20) unlock("bridge");
    }
    bridgeSpan = 0;                       // 기둥 줄이 바뀌면 이어짐이 끊긴다
  }
  if (woolN >= 8) unlock("palette");

  // 갱도 — 지하에서 사람이 파낸 칸 200개 + 횃불 10개.
  // 높이 상한은 **해수면을 따라간다** (v79) — 8 로 못 박아 두면 판 2(바다 23)에서
  // 지표 아래 30칸을 파도 안 열린다. 판 1 에서는 SEA-3 이 정확히 예전의 8 이다.
  var dug = 0, torches = 0;
  var digTop = SEA - 3;
  if (!S.earned.mineshaft)
  for (y = 1; y <= digTop; y++)
    for (x = x0; x <= x1; x++)
      for (z = z0; z <= z1; z++) {
        i = idx(x, y, z);
        if (touched[i] !== 1) continue;
        // 횃불을 건 칸도 **파낸 칸**이다 — 안 세면 200칸을 파고 횃불 10개를 달아도
        // 190으로 읽혀 영영 안 열린다 (판 1 에서도 그랬다)
        if (world[i] === AIR) dug++;
        else if (world[i] === TORCH) { torches++; dug++; }
      }
  if (dug >= 200 && torches >= 10) unlock("mineshaft");

  // 방 — 문이 있고, 그 문에서 시작한 공기가 밖으로 새지 않는 27칸 이상의 공간
  checkRoom(x0, x1, z0, z1);
}
var bridgeSpan = 0;
var bridgeEW = [];    // z 줄마다의 **동서** 이어짐 (v108)

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
// 「내 집」이 방으로 인정하는 최대 칸수 (v97) — 20×20×4 집이 1,296칸이다
export var ROOM_MAX = 6000;
// 상한 600 은 **천장 3칸짜리 15×15 집이 이미 넘는 값**이었다 (v97).
// 영역 도구로 20×20 집(1,296칸)을 지은 사람이 정확히 그 이유로 과제를 못 땄다 —
// 작게 지어야 상을 받는 셈이었다. "동굴이 아니다" 는 아래 topMap 검사가 가린다.
// 상한을 열 배로 올리는 만큼 **스택과 방문 표시를 정수로** 바꿨다 (v99) —
// 칸마다 [x,y,z] 배열을 만들고 객체 키를 문자열로 굴리면 그 비용도 열 배가 된다.
var floodSeen = new Uint8Array(N);
var floodStack = new Int32Array(ROOM_MAX * 6 + 8);
var floodMark = 0;
function floodEnclosed(sx, sy, sz) {
  if (++floodMark > 250) { floodSeen.fill(0); floodMark = 1; }   // 표시를 세대로 굴린다
  var top = 0, n = 0;
  floodStack[top++] = idx(sx, sy, sz);
  while (top) {
    var key = floodStack[--top];
    if (floodSeen[key] === floodMark) continue;
    var cy = (key / PLANE) | 0, rem = key - cy * PLANE;
    var cz = (rem / WX) | 0, cx = rem - cz * WX;
    if (world[key] !== AIR) continue;                  // 벽·문에 막힌다 (문도 벽으로 친다)
    // 빛이 아니라 **막혀 있는가**를 본다. 유리 지붕(채광창)은 빛이 15로 그대로 내려와
    // "야외" 로 오판됐다 — 창문 달린 집이 집이다.
    if (topMap[cz * WX + cx] <= cy) return 0;          // 위에 아무것도 없으면 야외다
    floodSeen[key] = floodMark;
    if (++n > ROOM_MAX) return 0;
    for (var d = 0; d < 6; d++) {
      var nx = cx + DIRS[d][0], ny = cy + DIRS[d][1], nz = cz + DIRS[d][2];
      if (!inside(nx, ny, nz)) return 0;               // 세계 밖으로 샜다
      if (top < floodStack.length) floodStack[top++] = idx(nx, ny, nz);
    }
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
    "<dt>세계 모양</dt><dd>" + ["보통", "평지", "산악", "군도"][S.terrain | 0] + "</dd>" +
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

// only — 이 블록인 칸만 바꾼다(음수면 전부). onlyAir — 빈 칸만 채운다.
// 다 지은 벽돌 벽을 조약돌로 바꾸려면 예전에는 200칸을 하나씩 캐고 하나씩 놓아야 했다
// (200 × 1.4초 ≈ 4분 40초). 건축은 짓는 시간보다 고치는 시간이 길다.
export function fillSelection(block, sh, only) {
  var b = bounds();
  if (!b) return 0;
  if (selectionSize() > REGION_MAX) return -1;
  // 크기를 알고 시작한다 — 안 주면 1024 에서 두 배씩 일곱 번 통째로 복사하고,
  // 끝나면 65,536 칸 중 25,536 칸이 빈 채로 히스토리에 남는다 (40,000칸 채우기 실측)
  beginBatch(selectionSize());
  for (var y = b.y0; y <= b.y1; y++)
    for (var z = b.z0; z <= b.z1; z++)
      for (var x = b.x0; x <= b.x1; x++) {
        if (only !== undefined && only >= 0 && world[idx(x, y, z)] !== only) continue;
        applyEdit(x, y, z, block, true, sh || SH_FULL);
      }
  return endBatch(only !== undefined && only >= 0 ? "바꾸기" : "채우기", true);
}

// 영역 비우기 — 채우기와 같은 길을 쓰되 되돌리기 이름만 다르다.
// AIR 를 ALL_BLOCKS 에 넣으면 "수집가" 과제가 영영 불가능해지므로 (v19 교훈)
// 여기서 AIR 를 직접 넘긴다.
export function clearSelection() {
  var b = bounds();
  if (!b) return 0;
  if (selectionSize() > REGION_MAX) return -1;
  // 크기를 알고 시작한다 — 안 주면 1024 에서 두 배씩 일곱 번 통째로 복사하고,
  // 끝나면 65,536 칸 중 25,536 칸이 빈 채로 히스토리에 남는다 (40,000칸 채우기 실측)
  beginBatch(selectionSize());
  for (var y = b.y0; y <= b.y1; y++)
    for (var z = b.z0; z <= b.z1; z++)
      for (var x = b.x0; x <= b.x1; x++)
        applyEdit(x, y, z, AIR, true, SH_FULL);
  return endBatch("비우기", true);
}

// 겉면만 · 속만 (v111) — **30분째에 가장 자주 짓는 모양은 속 빈 상자**다.
// 지금까지는 20×20×20 을 돌로 채운 뒤 속을 비우려면, 안쪽 모서리가 방금 채운 돌 **안**에
// 있어서 조준이 안 닿았다. 벽을 한 칸 캐고 기어들어가 모서리를 찍고 나오는 것이 유일한 길이었다.
// mode — "hollow" 속을 공기로 · "walls" 옆 네 면만 · "shell" 여섯 면 전부
export function shellSelection(block, sh, mode) {
  var b = bounds();
  if (!b) return 0;
  if (selectionSize() > REGION_MAX) return -1;
  beginBatch(selectionSize());
  var n = 0;
  for (var y = b.y0; y <= b.y1; y++)
    for (var z = b.z0; z <= b.z1; z++)
      for (var x = b.x0; x <= b.x1; x++) {
        var onSide = (x === b.x0 || x === b.x1 || z === b.z0 || z === b.z1);
        var onCap = (y === b.y0 || y === b.y1);
        if (mode === "hollow") {
          if (onSide || onCap) continue;            // 껍질 한 겹은 남긴다
          if (applyEdit(x, y, z, AIR, true, SH_FULL)) n++;
        } else if (mode === "walls") {
          if (!onSide) continue;                    // 바닥·천장은 안 건드린다
          if (applyEdit(x, y, z, block, true, sh || SH_FULL)) n++;
        } else {
          if (!onSide && !onCap) continue;
          if (applyEdit(x, y, z, block, true, sh || SH_FULL)) n++;
        }
      }
  endBatch(mode === "hollow" ? "속 비우기" : (mode === "walls" ? "벽 세우기" : "껍질"), true);
  return n;
}

// 원기둥과 구 (v112) — 상자 채우기 말고는 없어서 원형 탑·돔 지붕·아치·연못이 전부 손이었다.
// 마크 건축자가 월드에디트에서 //walls·//hollow 다음으로 배우는 것이 //cyl·//sphere 다.
// 중심은 **선 자리**다 (월드에디트와 같다) — 조준한 칸으로 하면 채운 뒤에는
// 그 칸이 블록 안이라 다시 겨눌 수가 없다 (v111 의 /hollow 가 고친 것과 같은 함정).
export function roundSelection(block, sh, r, h, hollow, kind) {
  r = Math.max(1, Math.min(32, Math.round(r)));
  h = Math.max(1, Math.min(WY, Math.round(h || 1)));
  var cx = Math.floor(player.pos.x), cy = Math.floor(player.pos.y), cz = Math.floor(player.pos.z);
  var size = kind === "sphere" ? (2 * r + 1) * (2 * r + 1) * (2 * r + 1)
                               : (2 * r + 1) * (2 * r + 1) * h;
  if (size > REGION_MAX) return -1;
  var n = 0;
  beginBatch(size);
  var y0 = kind === "sphere" ? cy - r : cy;
  var y1 = kind === "sphere" ? cy + r : cy + h - 1;
  for (var y = Math.max(0, y0); y <= Math.min(WY - 1, y1); y++)
    for (var z = Math.max(0, cz - r); z <= Math.min(WZ - 1, cz + r); z++)
      for (var x = Math.max(0, cx - r); x <= Math.min(WX - 1, cx + r); x++) {
        var dx = x - cx, dz = z - cz, dy = y - cy;
        // 반지름에 0.5 를 더해 재면 마크의 원 템플릿과 같은 모양이 나온다 —
        // 정수로만 재면 지름이 짝수인 원의 옆구리가 납작해진다
        var d2 = kind === "sphere" ? (dx * dx + dy * dy + dz * dz) : (dx * dx + dz * dz);
        var rr = r + 0.5;
        if (d2 > rr * rr) continue;
        if (hollow) {
          // 껍질만 — 한 칸 작은 반지름 안쪽은 건너뛴다.
          // 원기둥은 **옆면만** 껍질이다 (바닥·천장을 덮으면 속에 들어갈 수가 없다)
          var ri = r - 0.5;
          if (d2 <= ri * ri) continue;
        }
        if (applyEdit(x, y, z, block, true, sh || SH_FULL)) n++;
      }
  endBatch(kind === "sphere" ? "구" : "원기둥", true);
  return n;
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

// withAir 면 빈칸까지 붙여넣는다 (v97) — 속을 비운 집을 언덕에 붙여넣으면
// 안쪽 192칸 중 137칸이 흙으로 남아 **들어갈 수 없는 집**이 생겼다.
// 대칭 건물을 짓는 길이 복사 → 거울 → 붙여넣기인데, 목적지가 평지가 아니면
// 그 순간 속이 찬 덩어리가 됐다. 월드에디트도 **빈칸까지가 기본**이다.
export function pasteClip(px, py, pz, withAir) {
  var c = S.clip;
  if (!c) return 0;
  beginBatch(Math.max(1024, c.w * c.h * c.d));
  var n = 0;
  for (var y = 0; y < c.h; y++)
    for (var z = 0; z < c.d; z++)
      for (var x = 0; x < c.w; x++) {
        var b = c.blocks[n], sh = c.shapes[n];
        var lv = c.levels ? c.levels[n] : 0;
        n++;
        if (b === AIR && !withAir) continue;     // 기본은 빈칸을 안 덮는다
        if (!applyEdit(px + x, py + y, pz + z, b, true, sh)) continue;
        // 흐르던 물은 붙여넣어도 흐르는 물이어야 한다 (applyEdit 은 손으로 놓은 물을 근원으로 본다)
        if ((b === WATER || b === LAVA) && lv > 0) {
          waterLvl[idx(px + x, py + y, pz + z)] = lv;
          enqueueDryAround(px + x, py + y, pz + z);
        }
      }
  return endBatch("붙여넣기", true);
}

// ── 명령 처리 — 짧은 이름 하나로 알아듣게
export var CMD_HELP =
  "tp <x y z | 표식 번호|이름> · time <아침|정오|노을|밤|0~1> · weather <맑음|비|눈> · " +
  "marks · marks del <번호> · fill <블록|공기> [바꿀블록] · hollow · walls <블록> · " +
  "cyl <블록> <반지름> [높이] [속빔] · sphere <블록> <반지름> [속빔] · shell <블록> · " +
  "paste [공기] · mirror · rotate · " +
  "expand/contract <±dx> <±dy> <±dz> · shift <dx> <dy> <dz> · clone <dx> <dy> <dz> [횟수] · give <블록> · count · bp <save|use|list|del> <이름> · undo <n> · redo <n> · seed · gm <속도> · help";

// 한국어 이름과 영어 이름을 둘 다 알아듣는다 — "조약돌" 도 "cobble" 도 된다
function findBlock(name) {
  if (!name) return -1;
  var q = String(name).toLowerCase();
  function label(b) {
    return ((NAMES[b] || "") + " " + (NAMES_EN[b] || "")).toLowerCase();
  }
  // 도구(양동이·부싯돌)도 찾는다 (v95) — ALL_BLOCKS 만 훑어서 `/give 양동이` 가
  // "그런 블록이 없습니다" 였다. 핫바 2쪽에 있는 물건을 명령으로는 못 꺼냈다.
  // place() 가 도구를 이미 가로채므로 핫바에 들어가도 안전하다
  var pool = ALL_BLOCKS.concat(ITEMS);
  for (var i = 0; i < pool.length; i++) {
    var b = pool[i];
    var parts = label(b).split(" ");
    for (var p = 0; p < parts.length; p++) {
      if (parts[p] && parts[p] === q) return b;
    }
    if (label(b).replace(/\s+/g, "") === q.replace(/\s+/g, "")) return b;
  }
  for (var j = 0; j < pool.length; j++) {
    var b2 = pool[j];
    if (label(b2).indexOf(q) >= 0) return b2;
  }
  return -1;
}

export var CMD_LIST = ["tp", "marks", "time", "weather", "fill", "hollow", "walls", "shell", "cyl", "sphere", "paste", "mirror", "rotate", "expand", "contract", "shift", "clone", "give", "count", "bp", "undo", "redo", "seed", "gm", "help"];
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

  // 표식 목록 — 96px 미니맵의 7px 글자 말고 **글자로 읽을 곳**이 필요하다.
  // 화면 밖 표식은 가장자리에 눌려 이름도 안 나온다.
  // 표식은 상한이 있는데(12 → v111 에서 24) **멀리 있는 것을 지울 길이 없었다** (v100) —
  // toggleMark 는 내 자리 3칸 안만 보므로, 13번째를 찍으려면 쓸모없어진 표식까지
  // 날아가야 했다. 한 시간이면 굴 어귀·갱도·집·광맥으로 12개는 금방 찬다
  if (cmd === "marks" && parts[1] === "del") {
    var dn2 = parseInt(parts[2], 10);
    if (!(dn2 >= 1 && dn2 <= S.marks.length)) return "/marks del <번호> — 번호는 /marks 로 봅니다";
    var gone = markName(S.marks[dn2 - 1]) || ("표식 " + dn2);
    S.marks.splice(dn2 - 1, 1);
    S.worldDirty = true;
    return gone + " 를 지웠습니다 (남은 표식 " + S.marks.length + "개)";
  }

  if (cmd === "marks") {
    if (!S.marks.length) return "표식이 없습니다 — B 로 찍고, Shift+B 로 이름을 붙입니다";
    var out = [];
    for (var mq = 0; mq < S.marks.length; mq++) {
      var mm2 = S.marks[mq];
      out.push((mq + 1) + " " + (markName(mm2) || "-") + " " +
               markX(mm2) + " " + (markY(mm2) >= 0 ? markY(mm2) : "?") + " " + markZ(mm2));
    }
    return out.join(" · ") + "  (/tp 번호 로 가고, /marks del 번호 로 지웁니다)";
  }

  if (cmd === "tp") {
    var x = parseFloat(parts[1]), y = parseFloat(parts[2]), z = parseFloat(parts[3]);
    // 좌표 대신 표식 번호나 이름 하나만 줘도 된다 — 지도에 점만 찍어 놓고
    // 거기로 돌아갈 방법이 없으면 표식을 찍을 이유가 없다 (자문 9차)
    if (parts.length === 2 && parts[1]) {
      var q = parts[1].toLowerCase(), pick = -1;
      var byNum = parseInt(parts[1], 10);
      if (isFinite(byNum) && byNum >= 1 && byNum <= S.marks.length) pick = byNum - 1;
      else for (var mk = 0; mk < S.marks.length; mk++)
        if (markName(S.marks[mk]).toLowerCase() === q) { pick = mk; break; }
      if (pick < 0) return "그런 표식이 없습니다 — /tp <번호|이름> 또는 /tp <x> <y> <z>";
      var m = S.marks[pick];
      x = markX(m); z = markZ(m);
      // 예전 표식은 높이가 없다 — 그 자리 지표로 올려 준다 (땅에 파묻히지 않게)
      y = markY(m) >= 0 ? markY(m) : (topMap[markZ(m) * WX + markX(m)] + 1);
    }
    if (!isFinite(x) || !isFinite(y) || !isFinite(z)) return "tp <x> <y> <z> · tp <표식 번호|이름>";
    var tx = Math.max(0.4, Math.min(WX - 0.4, x));
    var ty = Math.max(1, Math.min(WY - 2, y));
    var tz = Math.max(0.4, Math.min(WZ - 0.4, z));
    // 돌 한가운데로 보내지 않는다 (v95) — 거기 떨어지면 걸을 수도, 날 수도, 떨어질 수도 없고
    // 조준은 늘 제 머리가 든 칸 하나뿐이라 **한 칸씩 캐서 파 올라가는 것 말고는 길이 없었다.**
    // 좌표를 대충 친 사람이나, 표식 자리를 나중에 벽으로 메운 사람이 그대로 갇혔다.
    // 몸이 들어갈 두 칸이 빌 때까지 위로 훑는다 (spawn 이 쓰는 방법과 같다)
    var gx = Math.floor(tx), gz = Math.floor(tz);
    var lifted = 0;
    for (var ty2 = Math.floor(ty); ty2 < WY - 2; ty2++) {
      if (!isSolid(get(gx, ty2, gz)) && !isSolid(get(gx, ty2 + 1, gz))) { ty = ty2; break; }
      lifted++;
    }
    player.pos.set(tx, ty, tz);
    player.vel.set(0, 0, 0);
    return "이동: " + Math.floor(player.pos.x) + " " + Math.floor(player.pos.y) + " " +
           Math.floor(player.pos.z) + (lifted ? " (막힌 자리라 " + lifted + "칸 올렸습니다)" : "");
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
    // 핫바를 다시 그린다 (v95) — 예전에는 손에 든 건 다이아, 핫바가 보여 주는 건 잔디였다.
    // v85 가 글리프까지 넣어 고친 "핫바를 봐서는 뭘 든지 모른다" 가 명령 경로에만 남아 있었다
    refreshBar();
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
    // "/fill 조약돌 벽돌" — 벽돌인 칸만 조약돌로. 창문·문틀·안쪽 공기는 그대로 둔다.
    var repl = -1, fbName = fname;
    var two = fname.split(/\s+/);
    if (two.length >= 2) {
      var maybe = findBlock(two[two.length - 1]);
      var head = two.slice(0, two.length - 1).join(" ");
      if (maybe >= 0 && findBlock(head) >= 0) { repl = maybe; fbName = head; }
      else if (/^(공기|빈칸|air|없음)$/i.test(two[two.length - 1]) && findBlock(head) >= 0) {
        repl = AIR; fbName = head;
      }
    }
    var fb = findBlock(fbName);
    if (fb < 0) return "그런 블록이 없습니다";
    var n = fillSelection(fb, SH_FULL, repl >= 0 ? repl : undefined);
    if (n < 0) return "영역이 너무 큽니다";
    if (repl >= 0 && !n) return (NAMES[repl] || "그 블록") + " 인 칸이 없습니다";
    if (!n) return "먼저 Alt+클릭으로 영역을 고르세요";
    return n.toLocaleString("ko-KR") + "칸을 " + NAMES[fb] + " 로";
  }

  // 속 비우기 · 벽 세우기 (v111) — 월드에디트의 //hollow · //walls 와 같은 자리.
  // 채우기가 이미 8,000칸을 22ms 에 하는데, **가장 흔한 모양 하나**를 못 만들고 있었다
  if (cmd === "hollow") {
    var hn = shellSelection(AIR, SH_FULL, "hollow");
    if (hn < 0) return "영역이 너무 큽니다";
    if (!hn) return bounds() ? "비울 속이 없습니다 — 세 변이 모두 3칸 이상이라야 합니다"
                             : "먼저 Alt+클릭으로 영역을 고르세요";
    return hn.toLocaleString("ko-KR") + "칸을 비웠습니다 (껍질 한 겹은 남겼습니다)";
  }
  if (cmd === "walls" || cmd === "shell") {
    var wb = findBlock(parts.slice(1).join(" "));
    if (wb < 0) return cmd + " <블록> — 옆 네 면" + (cmd === "shell" ? "과 바닥·천장" : "") + "을 세웁니다";
    var wn = shellSelection(wb, SH_FULL, cmd === "shell" ? "shell" : "walls");
    if (wn < 0) return "영역이 너무 큽니다";
    if (!wn) return bounds() ? "이미 " + NAMES[wb] + " 입니다" : "먼저 Alt+클릭으로 영역을 고르세요";
    return wn.toLocaleString("ko-KR") + "칸을 " + NAMES[wb] + " 로";
  }

  // /cyl <블록> <반지름> [높이] [속빔] · /sphere <블록> <반지름> [속빔]
  if (cmd === "cyl" || cmd === "sphere") {
    var toks = parts.slice(1);
    var hollowWord = false;
    if (toks.length && /^(속빔|속|벽|hollow)$/i.test(toks[toks.length - 1])) {
      hollowWord = true; toks = toks.slice(0, toks.length - 1);
    }
    // 뒤에서부터 숫자를 떼어 낸다 — 블록 이름이 두 낱말일 수 있다 ("빨강 색유리")
    var nums = [];
    while (toks.length && /^-?\d+$/.test(toks[toks.length - 1])) {
      nums.unshift(parseInt(toks.pop(), 10));
    }
    var cb4 = findBlock(toks.join(" "));
    if (cb4 < 0 || !nums.length) {
      return cmd === "cyl" ? "cyl <블록> <반지름> [높이] [속빔] — 선 자리를 중심으로 원기둥"
                           : "sphere <블록> <반지름> [속빔] — 선 자리를 중심으로 구";
    }
    var rad = nums[0], hei = cmd === "cyl" ? (nums.length > 1 ? nums[1] : 1) : 1;
    var rn = roundSelection(cb4, SH_FULL, rad, hei, hollowWord, cmd);
    if (rn < 0) return "너무 큽니다 — 반지름과 높이를 줄이세요 (" + REGION_MAX.toLocaleString("ko-KR") + "칸까지)";
    if (!rn) return "이미 " + NAMES[cb4] + " 입니다";
    return rn.toLocaleString("ko-KR") + "칸을 " + NAMES[cb4] + " 로 (" +
           (cmd === "cyl" ? "원기둥 반지름 " + rad + " · 높이 " + hei : "구 반지름 " + rad) +
           (hollowWord ? " · 속빔" : "") + ")";
  }

  // 세 키 조합에 **명령 대안**을 둔다 (v113) — Ctrl+Shift+V(빈칸까지 붙여넣기)와
  // Ctrl+Shift+R(거울)에는 대안이 하나도 없었다. 한 손으로 치는 사람에게
  // 수식키 둘 + 글자키는 "어렵다" 가 아니라 **불가능**이고,
  // 이 게임이 자랑하는 영역 도구의 절반이 거기 있었다.
  if (cmd === "paste") {
    var withAirCmd = /^(공기|빈칸|air|빈칸까지)$/i.test(parts[1] || "");
    var hitP = S.aimFace;
    if (!hitP) return "붙여넣을 자리를 조준하세요";
    var pn3 = pasteClip(hitP[0], hitP[1], hitP[2], withAirCmd);
    if (!pn3) return "복사한 것이 없습니다";
    return pn3.toLocaleString("ko-KR") + "칸을 붙여넣었습니다" + (withAirCmd ? " (빈칸까지)" : "");
  }
  if (cmd === "mirror" || cmd === "rotate") {
    if (!S.clip) return "먼저 Ctrl+C 또는 영역 도구로 복사하세요";
    if (cmd === "mirror") { mirrorClip(); return "복사한 것을 좌우로 뒤집었습니다"; }
    rotateClip();
    return "복사한 것을 90° 돌렸습니다";
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
    if (sub === "del") { var e3 = deleteBlueprint(nm); return e3 || ("청사진 지움: " + nm); }
    return "bp <save|use|list|del> <이름>";
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

  // 줄이기와 밀기 (v111) — `expand` 만 있고 짝이 없었다. 한 칸 크게 잡으면
  // 다시 두 모서리를 찍는 수밖에 없었고, 같은 크기로 옆칸을 지으려면 처음부터 다시 골랐다.
  if (cmd === "contract" || cmd === "shift") {
    var cx3 = parseInt(parts[1], 10), cy3 = parseInt(parts[2], 10), cz3 = parseInt(parts[3], 10);
    if (!isFinite(cx3) || !isFinite(cy3) || !isFinite(cz3)) {
      return cmd === "contract" ? "contract <±dx> <±dy> <±dz> — 양수는 +쪽에서, 음수는 −쪽에서 줄인다"
                                : "shift <dx> <dy> <dz> — 고른 영역을 통째로 민다 (블록은 그대로)";
    }
    var cb3 = bounds();
    if (!cb3) return "먼저 Alt+클릭으로 영역을 고르세요";
    function clampAxis(v, max) { return Math.max(0, Math.min(max - 1, v)); }
    var nx3, ny3, nz3, nx4, ny4, nz4;
    if (cmd === "shift") {
      nx3 = cb3.x0 + cx3; nx4 = cb3.x1 + cx3;
      ny3 = cb3.y0 + cy3; ny4 = cb3.y1 + cy3;
      nz3 = cb3.z0 + cz3; nz4 = cb3.z1 + cz3;
      // 세계 밖으로 밀면 **크기를 지킨 채** 안으로 되민다 — 잘리면 영역이 조용히 작아진다
      if (nx3 < 0) { nx4 -= nx3; nx3 = 0; } if (nx4 > WX - 1) { nx3 -= nx4 - (WX - 1); nx4 = WX - 1; }
      if (ny3 < 0) { ny4 -= ny3; ny3 = 0; } if (ny4 > WY - 1) { ny3 -= ny4 - (WY - 1); ny4 = WY - 1; }
      if (nz3 < 0) { nz4 -= nz3; nz3 = 0; } if (nz4 > WZ - 1) { nz3 -= nz4 - (WZ - 1); nz4 = WZ - 1; }
      nx3 = clampAxis(nx3, WX); nx4 = clampAxis(nx4, WX);
      ny3 = clampAxis(ny3, WY); ny4 = clampAxis(ny4, WY);
      nz3 = clampAxis(nz3, WZ); nz4 = clampAxis(nz4, WZ);
    } else {
      function shrink(lo, hi, d) {
        if (d >= 0) hi -= d; else lo -= d;    // 양수는 +쪽에서, 음수는 −쪽에서 줄인다
        if (lo > hi) lo = hi = (d >= 0 ? hi : lo);   // 한 칸까지만 줄어든다
        return [lo, hi];
      }
      var rx = shrink(cb3.x0, cb3.x1, cx3), ry = shrink(cb3.y0, cb3.y1, cy3), rz = shrink(cb3.z0, cb3.z1, cz3);
      nx3 = rx[0]; nx4 = rx[1]; ny3 = ry[0]; ny4 = ry[1]; nz3 = rz[0]; nz4 = rz[1];
    }
    S.selA = [nx3, ny3, nz3];
    S.selB = [nx4, ny4, nz4];
    return "영역 " + (nx4 - nx3 + 1) + "×" + (ny4 - ny3 + 1) + "×" + (nz4 - nz3 + 1) +
           " · " + selectionSize().toLocaleString("ko-KR") + "칸";
  }

  // 고른 영역을 그대로 한 벌 더 — 계단·기둥처럼 되풀이되는 것을 손으로 다시 짓지 않게
  if (cmd === "clone") {
    var ox = parseInt(parts[1], 10), oy = parseInt(parts[2], 10), oz = parseInt(parts[3], 10);
    if (!isFinite(ox) || !isFinite(oy) || !isFinite(oz)) return "clone <dx> <dy> <dz> [횟수]";
    var bb = selectionBounds();
    if (!bb) return "먼저 Alt+클릭으로 영역을 고르세요";
    // 횟수 — 회랑 기둥 열둘을 세우려고 같은 명령을 열두 번 치지 않게 (월드에디트 //stack)
    var times = Math.max(1, Math.min(64, parseInt(parts[4], 10) || 1));
    var keepClip = S.clip;                 // Ctrl+C 로 담아 둔 것을 조용히 덮지 않는다
    var cn = copySelection();
    if (cn < 0) { S.clip = keepClip; return "영역이 너무 큽니다"; }
    if (!cn) { S.clip = keepClip; return "영역이 비어 있습니다"; }
    var done = 0, didTimes = 0;
    for (var ci = 1; ci <= times; ci++) {
      var pn2 = pasteClip(bb.x0 + ox * ci, bb.y0 + oy * ci, bb.z0 + oz * ci);
      if (!pn2) break;
      done += pn2; didTimes++;
    }
    S.clip = keepClip;
    if (!done) return "붙여넣지 못했습니다";
    // **실제로 한 횟수**를 돌려준다 (v97) — 천장에 걸려 조용히 실패한 판까지
    // "12번 했다" 고 말해, /undo 12 를 치면 앞의 편집까지 딸려 갔다
    return done.toLocaleString("ko-KR") + "칸을 " + didTimes + "번 복제했습니다" +
           (didTimes < times ? " (" + times + "번 중 — 자리가 모자랍니다)" : "");
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
  // 같은 이름이 있으면 되묻는다 (v97) — 지우기 단추에는 confirm 이 붙어 있는데
  // **덮어쓰기가 곧 삭제**인 이 쪽만 무방비였다. 청사진은 건축 설계가
  // 세션을 넘어 남는 유일한 곳이라, 이름 한 번 잘못 치면 복구가 없다.
  // 취소하면 **취소했다고 답한다** — false 를 돌리면 부르는 쪽이 "저장" 이라 말했다 (v99)
  if (blueprintNames().indexOf(name) >= 0) {
    var ok2 = true;
    try { ok2 = window.confirm("청사진 \"" + name + "\" 이 이미 있습니다. 덮어쓸까요?"); }
    catch (e2) { ok2 = true; }
    if (!ok2) return "취소했습니다 — 청사진은 그대로입니다";
  }
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

// 메뉴 목록용 — 이름만으로는 어느 게 어느 건물인지 모른다. 크기를 같이 준다.
export function blueprintList() {
  var all = loadBlueprints(), out = [];
  var names = Object.keys(all).sort();
  for (var i = 0; i < names.length; i++) {
    var b = all[names[i]];
    out.push({ name: names[i], w: b.w | 0, h: b.h | 0, d: b.d | 0,
               cells: (b.w | 0) * (b.h | 0) * (b.d | 0) });
  }
  return out;
}
export function deleteBlueprint(name) {
  var all = loadBlueprints();
  if (!(name in all)) return "그런 청사진이 없습니다";
  delete all[name];
  try { localStorage.setItem(BP_KEY, JSON.stringify(all)); }
  catch (e) { return "지우지 못했습니다"; }
  return "";
}

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
