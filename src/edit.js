// edit.js — 편집 · 되돌리기 · 도전 과제
import { S } from "./state.js";
import { opts } from "./settings.js";
import { SLOTS } from "./save.js";
import { DIRS, WX, WY, WZ, idx, inside } from "./dims.js";
import { LAVA, AIR, ALL_BLOCKS, EMIT, ICE, NAMES, NAMES_EN, SH_FULL, WALL_DIR, WATER, isClimbable, isCross, isItem, isLog, isSolid, isUnbreakable, isWallShape } from "./blocks.js";
import { BIOME_NAMES, markTouched, refreshTop, shape, waterLvl, world } from "./world.js";
import { relightLocal } from "./light.js";
import { enqueueLavaAround, enqueueLavaDryAround, enqueueDryAround, enqueueFall, enqueueWaterAround, queueLeafDecay } from "./fluids.js";
import { touch } from "./mesh.js";
import { player, stats } from "./player.js";
import { tone } from "./audio.js";
import { helpAchList, showAchPop, toast } from "./hud.js";
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
  // 사다리도 벽 횃불과 같은 규칙이다 — 벽이 사라지면 같이 떨어진다
  if (!isCross(world[i]) && !isClimbable(world[i])) return;
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
  var from = world[i], fromSh = shape[i], fromWl = waterLvl[i];
  var toSh = (to === AIR) ? SH_FULL : (sh || SH_FULL);
  if (from === to && fromSh === toSh) return false;
  if (isItem(to)) return false;        // 도구는 세계에 놓이지 않는다 (fill·명령도 막는다)

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
    markTouched(x, y, z);          // 되돌리기에 남는 편집 = 사람이 손댄 자리
    // wl — 편집 전 물 레벨. 없으면 흐르는 물을 캔 뒤 되돌릴 때 근원(0)으로 되살아나 무한 물이 생긴다
    var rec = { x: x, y: y, z: z, from: from, to: to, fromSh: fromSh, toSh: toSh, wl: fromWl };
    if (S.batch) { S.batch.push(rec); return true; }     // 묶음 편집 중이면 모아 둔다
    S.history.push(rec);
    if (S.history.length > (opts.undo || HISTORY_MAX)) S.history.shift();
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
  if (S.history.length > (opts.undo || HISTORY_MAX)) S.history.shift();
  S.future.length = 0;
  return b.length;
}

function applyCell(e, toSide) {
  var i = idx(e.x, e.y, e.z);
  world[i] = toSide ? e.to : e.from;
  shape[i] = (toSide ? e.toSh : e.fromSh) || SH_FULL;
  // 물 레벨도 그 순간으로 — 되돌리기가 세계를 딴 상태로 두면 되돌리기를 못 믿게 된다
  waterLvl[i] = toSide ? 0 : (e.wl || 0);
  touch(e.x, e.y, e.z); refreshTop(e.x, e.z); relightLocal(e.x, e.y, e.z);
  if (world[i] === AIR) enqueueWaterAround(e.x, e.y, e.z);
  // 근원을 되돌려 없애면 거기서 퍼진 물이 말라야 하고, 되살리면 다시 퍼져야 한다
  if (e.from === WATER || e.to === WATER) { enqueueDryAround(e.x, e.y, e.z); enqueueWaterAround(e.x, e.y, e.z); }
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
  { id: "explorer", name: "탐험가", desc: "미니맵 표식을 5개 찍는다" },
  { id: "feed", name: "친구", desc: "동물에게 꽃을 준다" },
  { id: "photo", name: "사진사", desc: "사진 모드로 화면을 저장한다" },
  { id: "gold", name: "금맥", desc: "금 광석을 캔다" },
  { id: "diamond", name: "다이아몬드!", desc: "다이아몬드 광석을 캔다" }
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
  if (helpAchList) helpAchList.innerHTML = html;
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
  showAchPop(found.name, found.desc);
  toast("도전 과제 " + achCount() + " / " + ACHIEVEMENTS.length);
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

// ── 명령 처리 — 짧은 이름 하나로 알아듣게
export var CMD_HELP =
  "tp <x> <y> <z> · time <아침|정오|노을|밤|0~1> · weather <맑음|비|눈> · " +
  "fill <블록|공기> · clone <dx> <dy> <dz> · give <블록> · count · bp <save|use|list> <이름> · undo <n> · redo <n> · seed · gm <속도> · help";

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

export var CMD_LIST = ["tp", "time", "weather", "fill", "clone", "give", "count", "bp", "undo", "redo", "seed", "gm", "help"];
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
    S.weather = wv;
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
  all[name] = {
    w: S.clip.w, h: S.clip.h, d: S.clip.d,
    b: Array.prototype.slice.call(S.clip.blocks),
    s: Array.prototype.slice.call(S.clip.shapes)
  };
  try { localStorage.setItem(BP_KEY, JSON.stringify(all)); }
  catch (e) { return "저장 공간이 부족합니다"; }
  return "";
}
export function useBlueprint(name) {
  var all = loadBlueprints();
  var bp = all[name];
  if (!bp) return "그런 청사진이 없습니다";
  S.clip = { w: bp.w, h: bp.h, d: bp.d,
             blocks: new Uint8Array(bp.b), shapes: new Uint8Array(bp.s) };
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
