// edit.js — 편집 · 되돌리기 · 도전 과제
import { S } from "./state.js";
import { DIRS, idx, inside } from "./dims.js";
import { AIR, EMIT, ICE, SH_FULL, WALL_DIR, WATER, isCross, isLog, isSolid, isUnbreakable, isWallShape } from "./blocks.js";
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
    S.history.push({ x: x, y: y, z: z, from: from, to: to, fromSh: fromSh, toSh: toSh });
    if (S.history.length > HISTORY_MAX) S.history.shift();
    S.future.length = 0;
  }
  return true;
}

export function undo() {
  var e = S.history.pop();
  if (!e) return false;
  world[idx(e.x, e.y, e.z)] = e.from;
  shape[idx(e.x, e.y, e.z)] = e.fromSh || SH_FULL;
  touch(e.x, e.y, e.z); refreshTop(e.x, e.z); relightLocal(e.x, e.y, e.z);
  if (e.from === AIR) enqueueWaterAround(e.x, e.y, e.z);
  S.future.push(e);
  S.worldDirty = true;
  return true;
}
export function redo() {
  var e = S.future.pop();
  if (!e) return false;
  world[idx(e.x, e.y, e.z)] = e.to;
  shape[idx(e.x, e.y, e.z)] = e.toSh || SH_FULL;
  touch(e.x, e.y, e.z); refreshTop(e.x, e.z); relightLocal(e.x, e.y, e.z);
  if (e.to === AIR) enqueueWaterAround(e.x, e.y, e.z);
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
  { id: "slabmerge", name: "빈틈없이", desc: "반블록 두 장을 겹쳐 한 블록으로 만든다" }
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
    "<dt>과제</dt><dd>" + achCount() + " / " + ACHIEVEMENTS.length + "</dd>";
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
