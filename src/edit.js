// edit.js — 편집 · 되돌리기 · 도전 과제
import { S } from "./state.js";
import { SLOTS } from "./save.js";
import { DIRS, idx, inside } from "./dims.js";
import { AIR, ALL_BLOCKS, EMIT, ICE, SH_FULL, WALL_DIR, WATER, isCross, isLog, isSolid, isUnbreakable, isWallShape } from "./blocks.js";
import { BIOME_NAMES, refreshTop, shape, waterLvl, world } from "./world.js";
import { relightLocal } from "./light.js";
import { enqueueDryAround, enqueueFall, enqueueWaterAround, queueLeafDecay } from "./fluids.js";
import { touch } from "./mesh.js";
import { player, stats } from "./player.js";
import { tone } from "./audio.js";
import { toast } from "./hud.js";
import { localBiome } from "./sky.js";

export var HISTORY_MAX = 240;

// 광원 주변 2칸 안의 얼음을 물로 되돌린다
function meltIceAround(x, y, z) {
  for (var dx = -2; dx <= 2; dx++)
    for (var dy = -2; dy <= 2; dy++)
      for (var dz = -2; dz <= 2; dz++) {
        if (!inside(x + dx, y + dy, z + dz)) continue;
        var i = idx(x + dx, y + dy, z + dz);
        if (world[i] !== ICE) continue;
        world[i] = WATER;
        touch(x + dx, y + dy, z + dz);
        refreshTop(x + dx, z + dz);
        relightLocal(x + dx, y + dy, z + dz);
        enqueueWaterAround(x + dx, y + dy, z + dz);
      }
}

// 받침이 사라진 얇은 블록을 떨군다. wall 이 주어지면 그 방향 벽에 붙은 것만.
function dropCross(x, y, z, wall) {
  if (!inside(x, y, z)) return;
  var i = idx(x, y, z);
  if (!isCross(world[i])) return;
  if (wall) {
    var d = WALL_DIR[shape[i]];
    if (!d || d[0] !== wall[0] || d[2] !== wall[2]) return;
  } else if (isWallShape(shape[i])) return;   // 벽 횃불은 아래가 비어도 남는다
  world[i] = AIR; shape[i] = SH_FULL;
  touch(x, y, z); refreshTop(x, z); relightLocal(x, y, z);
}

export function applyEdit(x, y, z, to, record, sh) {
  if (!inside(x, y, z)) return false;
  if (y === 0) return false;                 // 바닥은 손대지 않는다
  if (isUnbreakable(world[idx(x, y, z)])) return false;
  var i = idx(x, y, z);
  var from = world[i], fromSh = shape[i];
  var toSh = (to === AIR) ? SH_FULL : (sh || SH_FULL);
  if (from === to && fromSh === toSh) return false;

  world[i] = to;
  shape[i] = toSh;
  if (to === WATER) waterLvl[i] = 0;       // 손으로 놓은 물은 언제나 근원
  else if (from === WATER) waterLvl[i] = 0;
  if (to === WATER) enqueueWaterAround(x, y, z);
  if (from === WATER && to !== WATER) enqueueDryAround(x, y, z);
  enqueueFall(x, y, z);        // 놓은 블록 자신도 떨어질 수 있다
  enqueueFall(x, y + 1, z);    // 위에 얹혀 있던 것도
  touch(x, y, z);
  refreshTop(x, z);
  relightLocal(x, y, z);
  if (to === AIR) enqueueWaterAround(x, y, z);
  // 밝은 광원 옆의 얼음은 녹아 물이 된다
  if ((EMIT[to] || 0) >= 12) meltIceAround(x, y, z);
  if (isLog(from) && from !== to) queueLeafDecay(x, y, z);
  // 받치던 바닥이 사라지면 위에 얹힌 풀·꽃·횃불도 함께 사라진다
  if (!isSolid(to)) {
    if (inside(x, y + 1, z)) dropCross(x, y + 1, z, null);
    // 옆에 붙어 있던 벽 횃불도 함께 떨어진다
    for (var wd = 0; wd < 6; wd++) {
      if (DIRS[wd][1] !== 0) continue;
      dropCross(x + DIRS[wd][0], y, z + DIRS[wd][2], [-DIRS[wd][0], 0, -DIRS[wd][2]]);
    }
  }
  S.worldDirty = true;

  if (record) {
    var rec = { x: x, y: y, z: z, from: from, to: to, fromSh: fromSh, toSh: toSh };
    if (S.batch) { S.batch.push(rec); return true; }     // 묶음 편집 중이면 모아 둔다
    S.history.push(rec);
    if (S.history.length > HISTORY_MAX) S.history.shift();
    S.future.length = 0;
  }
  return true;
}

// 대량 편집(채우기·붙여넣기)은 한 덩어리로 묶어 한 번에 되돌린다
export function beginBatch() { S.batch = []; }
export function endBatch(label) {
  var b = S.batch;
  S.batch = null;
  if (!b || !b.length) return 0;
  S.history.push({ batch: b, label: label || "대량 편집" });
  if (b.length >= 100) unlock("build100");
  if (S.history.length > HISTORY_MAX) S.history.shift();
  S.future.length = 0;
  return b.length;
}

function applyCell(e, toSide) {
  var i = idx(e.x, e.y, e.z);
  world[i] = toSide ? e.to : e.from;
  shape[i] = (toSide ? e.toSh : e.fromSh) || SH_FULL;
  touch(e.x, e.y, e.z); refreshTop(e.x, e.z); relightLocal(e.x, e.y, e.z);
  if (world[i] === AIR) enqueueWaterAround(e.x, e.y, e.z);
}

export function undo() {
  var e = S.history.pop();
  if (!e) return false;
  if (e.batch) { for (var i = e.batch.length - 1; i >= 0; i--) applyCell(e.batch[i], false); }
  else applyCell(e, false);
  S.future.push(e);
  S.worldDirty = true;
  return true;
}
export function redo() {
  var e = S.future.pop();
  if (!e) return false;
  if (e.batch) { for (var i = 0; i < e.batch.length; i++) applyCell(e.batch[i], true); }
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
  { id: "explorer", name: "탐험가", desc: "미니맵 표식을 5개 찍는다" }
];
export var achGrid = document.getElementById("achgrid");

export function refreshAchList() {
  var html = "";
  for (var i = 0; i < ACHIEVEMENTS.length; i++) {
    var a = ACHIEVEMENTS[i];
    html += '<div class="ach' + (S.earned[a.id] ? " got" : "") + '">' +
            '<b>' + (S.earned[a.id] ? "\u2714" : "\u2022") + '</b>' +
            '<span>' + a.name + ' · ' + a.desc + '</span></div>';
  }
  achGrid.innerHTML = html;
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
  toast("도전 과제 · " + found.name + "  (" + achCount() + "/" + ACHIEVEMENTS.length + ")");
  tone(880, 0.09, "triangle", 0.05);
  setTimeout(function () { tone(1320, 0.12, "triangle", 0.045); }, 110);
  refreshAchList();
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

export function copySelection() {
  var b = bounds();
  if (!b) return 0;
  if (selectionSize() > REGION_MAX) return -1;
  var w = b.x1 - b.x0 + 1, h = b.y1 - b.y0 + 1, d = b.z1 - b.z0 + 1;
  var blocks = new Uint8Array(w * h * d), shapes = new Uint8Array(w * h * d);
  var n = 0;
  for (var y = 0; y < h; y++)
    for (var z = 0; z < d; z++)
      for (var x = 0; x < w; x++) {
        var i = idx(b.x0 + x, b.y0 + y, b.z0 + z);
        blocks[n] = world[i]; shapes[n] = shape[i]; n++;
      }
  S.clip = { w: w, h: h, d: d, blocks: blocks, shapes: shapes };
  return w * h * d;
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
        n++;
        if (b === AIR) continue;                 // 빈칸은 덮어쓰지 않는다
        applyEdit(px + x, py + y, pz + z, b, true, sh);
      }
  return endBatch("붙여넣기");
}
