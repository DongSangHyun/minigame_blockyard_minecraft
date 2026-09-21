// survival.js — 모으기 모드: 가방 · 캐면 얻기 · 곡괭이 단계 · 제작대/화로 제작 · 목표 한 줄
import { S } from "./state.js";
import { AIR, GRASS, DIRT, STONE, COBBLE, SAND, GRAVEL, LOG, BIRCH_LOG, SPRUCE_LOG, LEAVES, BIRCH_LEAVES, SPRUCE_LEAVES, PLANKS, GLASS, BRICK, COAL, IRON, GOLD, DIAMOND, ICE, FIRE, WATER, LAVA, TALLGRASS, DRYGRASS, DEADBUSH, SAPLING, SAPLING_BIRCH, SAPLING_SPRUCE, TORCH, LAMP, DOOR, FENCE, GATE, LADDER, PANE, BOOKSHELF, POT, FRAME, BUCKET, FLINT, SANDSTONE, STONEBRICK, CRAFT_TABLE, FURNACE, STICK, PICK_WOOD, PICK_STONE, PICK_IRON, PICK_DIAMOND, IRON_INGOT, GOLD_INGOT, COAL_LUMP, DIAMOND_GEM, NAMES, WOOL0, CARPET0, STAINED0, FLOWER_R, FLOWER_Y } from "./blocks.js";
import { get } from "./world.js";
import { player } from "./player.js";
import { inside } from "./dims.js";
import { refreshBar, toast } from "./hud.js";
import { isTouch, refreshHint } from "./input.js";

// 받침에 맞는 조사 — 「곡괭이은(는)」 같은 말을 안 쓰게 (자문 37차 #5)
export function josa(word, withFinal, withoutFinal) {
  var c = String(word || "").charCodeAt(String(word || "").length - 1);
  if (c < 0xac00 || c > 0xd7a3) return withoutFinal;
  return ((c - 0xac00) % 28) ? withFinal : withoutFinal;
}
export function isPick(b) { return PICKS.indexOf(b) >= 0; }

// ── 가방
export function invCount(b) { return (S.inv && S.inv[b]) | 0; }

// 원목 세 종은 한 재료로 친다 — 판자를 만들 때 "참나무 원목이 없습니다" 는 아이에게 이상하다
var LOGS = -1;
var GROUPS = {};
GROUPS[LOGS] = [LOG, BIRCH_LOG, SPRUCE_LOG];
function haveOf(id) {
  if (GROUPS[id]) { var n = 0; for (var i = 0; i < GROUPS[id].length; i++) n += invCount(GROUPS[id][i]); return n; }
  return invCount(id);
}
function takeOf(id, n) {
  if (!GROUPS[id]) { removeItem(id, n); return; }
  var g = GROUPS[id];
  for (var i = 0; i < g.length && n > 0; i++) {
    var k = Math.min(n, invCount(g[i]));
    if (k > 0) { removeItem(g[i], k); n -= k; }
  }
}
function labelOf(id) { return id === LOGS ? "원목" : NAMES[id]; }

// 새로 얻은 것은 **빈 칸(맨손)에 알아서 들어간다** — 마크도 주운 것이 핫바 빈 칸부터 채운다.
// 이미 핫바(두 쪽 어디든)에 있으면 그대로 둔다
// **1쪽 먼저, 그다음 2쪽** (자문 36차 #9) — 보이는 쪽에만 넣었더니 2쪽을 보다 주운 것이
// 1쪽으로 돌아오면 핫바에 없었다. 둘 다 꽉 차면 거짓을 돌려 「가방에 있어요」 라고 말하게 한다
function autoSlot(b) {
  if (S.bar.indexOf(b) >= 0 || (S.barAlt && S.barAlt.indexOf(b) >= 0)) return true;
  var first = S.barPage === 2 ? S.barAlt : S.bar, second = S.barPage === 2 ? S.bar : S.barAlt;
  var i = first ? first.indexOf(AIR) : -1;
  if (i >= 0) { first[i] = b; return true; }
  var j = second ? second.indexOf(AIR) : -1;
  if (j >= 0) { second[j] = b; return true; }
  return false;
}
export function addItem(b, n) {
  if (!S.inv) S.inv = {};
  S.inv[b] = invCount(b) + (n || 1);
  var slotted = autoSlot(b);
  S.worldDirty = true;
  refreshBar();
  return slotted;
}
// 다 쓰면 핫바에서도 빠진다 — 빈 칸(맨손)이 된다. 두 쪽 모두 본다
export function removeItem(b, n) {
  if (!S.inv) S.inv = {};
  var left = invCount(b) - (n || 1);
  if (left > 0) { S.inv[b] = left; }
  else {
    delete S.inv[b];
    for (var i = 0; i < S.bar.length; i++) if (S.bar[i] === b) S.bar[i] = AIR;
    if (S.barAlt) for (var j = 0; j < S.barAlt.length; j++) if (S.barAlt[j] === b) S.barAlt[j] = AIR;
  }
  S.worldDirty = true;
  refreshBar();
}

// ── 캐면 무엇이 나오나 — 마크와 같게, 아이가 잃어버렸다고 느낄 것만 조금 너그럽게
// (유리·유리판·얼음은 마크에선 사라지지만 여기선 유리·유리판은 돌려준다 — 창문을 잘못 깬 아이가 운다)
export function dropOf(b) {
  if (b === STONE) return COBBLE;
  if (b === GRASS) return DIRT;
  if (b === COAL) return COAL_LUMP;
  if (b === DIAMOND) return DIAMOND_GEM;
  if (b === LEAVES) return Math.random() < 0.08 ? SAPLING : AIR;
  if (b === BIRCH_LEAVES) return Math.random() < 0.08 ? SAPLING_BIRCH : AIR;
  if (b === SPRUCE_LEAVES) return Math.random() < 0.08 ? SAPLING_SPRUCE : AIR;
  if (b === ICE || b === FIRE || b === WATER || b === LAVA || b === TALLGRASS || b === DRYGRASS) return AIR;
  if (b === DEADBUSH) return STICK;
  return b;
}

// ── 곡괭이 단계 — 가진 것 중 **가장 좋은 곡괭이**를 저절로 쓴다.
// 아이가 캘 때마다 곡괭이로 바꿔 드는 것은 폰에서 특히 번거롭다 (마크는 손에 들어야 한다)
var PICKS = [PICK_WOOD, PICK_STONE, PICK_IRON, PICK_DIAMOND];
export function toolTier() {
  for (var i = PICKS.length - 1; i >= 0; i--) if (invCount(PICKS[i]) > 0) return i + 1;
  return 0;
}
// 0 손 · 1 나무 · 2 돌 · 3 철
export function needTier(b) {
  if (b === GOLD || b === DIAMOND) return 3;
  if (b === IRON) return 2;
  if (b === STONE || b === COBBLE || b === COAL || b === BRICK || b === SANDSTONE || b === STONEBRICK ||
      b === FURNACE) return 1;
  return 0;
}
var TIER_NAME = ["", "나무 곡괭이", "돌 곡괭이", "철 곡괭이", "다이아 곡괭이"];
export function canMine(b) { return !S.survival || toolTier() >= needTier(b); }
export function needText(b) {
  // 곡괭이 레시피는 **제작대 옆에서만** 뜬다 — 제작대가 멀면 E 를 눌러도 곡괭이가 없다 (자문 37차 #2)
  var where = stationsNear().table ? "E 에서 만드세요"
            : (invCount(CRAFT_TABLE) ? "제작대를 옆에 놓고 E 에서 만드세요"
                                     : "판자 4개로 제작대를 만들어 옆에 놓고 E 에서 만드세요");
  var t = TIER_NAME[needTier(b)] + "가 필요합니다 — " + touchWords(where);
  // 원목도 곡괭이도 없으면 만들 수가 없다 — 어디로 가야 하는지 말한다 (자문 36차 #10)
  if (!toolTier() && !haveOf(LOGS) && !invCount(PLANKS)) t += " · 먼저 위로 올라가 나무부터 (못 나오면 F 로 날기)";
  return t;
}
// 곡괭이는 돌 종류를 빨리 캔다. 손으로 캐는 흙·나무는 그대로
export function mineSpeed(b) {
  if (!needTier(b)) return 1;
  return [1, 1, 1.6, 2.4, 3.4][toolTier()];
}

// ── 레시피 — at: 어디서 만드나 (hand 어디서나 · table 제작대 옆 · furnace 화로 옆)
export var RECIPES = [
  { out: PLANKS, n: 4, need: [[LOGS, 1]], at: "hand" },
  { out: STICK, n: 4, need: [[PLANKS, 2]], at: "hand" },
  { out: CRAFT_TABLE, n: 1, need: [[PLANKS, 4]], at: "hand" },
  { out: TORCH, n: 4, need: [[STICK, 1], [COAL_LUMP, 1]], at: "hand" },
  { out: PICK_WOOD, n: 1, need: [[PLANKS, 3], [STICK, 2]], at: "table" },
  { out: PICK_STONE, n: 1, need: [[COBBLE, 3], [STICK, 2]], at: "table" },
  { out: FURNACE, n: 1, need: [[COBBLE, 8]], at: "table" },
  { out: PICK_IRON, n: 1, need: [[IRON_INGOT, 3], [STICK, 2]], at: "table" },
  { out: PICK_DIAMOND, n: 1, need: [[DIAMOND_GEM, 3], [STICK, 2]], at: "table" },
  { out: DOOR, n: 3, need: [[PLANKS, 6]], at: "table" },
  // 색 — 짓는 재미의 절반이다 (자문 36차 #5). 양털은 맨손으로 양을 우클릭해 얻는다
  { out: WOOL0 + 4, n: 1, need: [[WOOL0, 1], [FLOWER_R, 1]], at: "hand" },
  { out: WOOL0 + 6, n: 1, need: [[WOOL0, 1], [FLOWER_Y, 1]], at: "hand" },
  { out: CARPET0, n: 3, need: [[WOOL0, 2]], at: "table" },
  { out: CARPET0 + 4, n: 3, need: [[WOOL0 + 4, 2]], at: "table" },
  { out: CARPET0 + 6, n: 3, need: [[WOOL0 + 6, 2]], at: "table" },
  { out: FENCE, n: 3, need: [[PLANKS, 4], [STICK, 2]], at: "table" },
  { out: GATE, n: 1, need: [[PLANKS, 2], [STICK, 4]], at: "table" },
  { out: LADDER, n: 3, need: [[STICK, 7]], at: "table" },
  { out: BOOKSHELF, n: 1, need: [[PLANKS, 6]], at: "table" },
  { out: FRAME, n: 1, need: [[STICK, 8]], at: "table" },
  { out: STONEBRICK, n: 4, need: [[STONE, 4]], at: "table" },
  { out: SANDSTONE, n: 1, need: [[SAND, 4]], at: "table" },
  { out: PANE, n: 16, need: [[GLASS, 6]], at: "table" },
  { out: LAMP, n: 1, need: [[GLASS, 4], [TORCH, 1]], at: "table" },
  { out: POT, n: 1, need: [[BRICK, 3]], at: "table" },
  { out: BUCKET, n: 1, need: [[IRON_INGOT, 3]], at: "table" },
  { out: FLINT, n: 1, need: [[IRON_INGOT, 1], [GRAVEL, 1]], at: "table" },
  { out: IRON_INGOT, n: 1, need: [[IRON, 1], [COAL_LUMP, 1]], at: "furnace" },
  { out: GOLD_INGOT, n: 1, need: [[GOLD, 1], [COAL_LUMP, 1]], at: "furnace" },
  { out: GLASS, n: 1, need: [[SAND, 1], [COAL_LUMP, 1]], at: "furnace" },
  { out: STONE, n: 1, need: [[COBBLE, 1], [COAL_LUMP, 1]], at: "furnace" },
  { out: BRICK, n: 1, need: [[DIRT, 1], [SAND, 1], [COAL_LUMP, 1]], at: "furnace" },
  { out: STAINED0 + 4, n: 1, need: [[GLASS, 1], [FLOWER_R, 1]], at: "furnace" },
  { out: STAINED0 + 6, n: 1, need: [[GLASS, 1], [FLOWER_Y, 1]], at: "furnace" },
  // 숯 — 석탄을 못 찾은 아이도 횃불까지 간다 (마크의 숯 자리)
  { out: COAL_LUMP, n: 1, need: [[LOGS, 1], [PLANKS, 1]], at: "furnace" }
];

export function needLine(r) {
  var parts = [];
  for (var i = 0; i < r.need.length; i++) parts.push(labelOf(r.need[i][0]) + " " + r.need[i][1]);
  return parts.join(" + ");
}
export function canCraft(r) {
  for (var i = 0; i < r.need.length; i++) if (haveOf(r.need[i][0]) < r.need[i][1]) return false;
  return true;
}
export function craft(r) {
  if (!canCraft(r)) return false;
  for (var i = 0; i < r.need.length; i++) takeOf(r.need[i][0], r.need[i][1]);
  addItem(r.out, r.n);
  svEvent("craft:" + r.out);
  return true;
}

// 제작대·화로가 가까이(4칸) 있나 — 오른쪽 클릭으로 열 때도, E 로 열 때도 같은 규칙
export function stationsNear() {
  var st = { table: false, furnace: false };
  var px = Math.floor(player.pos.x), py = Math.floor(player.pos.y + 1), pz = Math.floor(player.pos.z);
  for (var dx = -4; dx <= 4; dx++) for (var dy = -3; dy <= 3; dy++) for (var dz = -4; dz <= 4; dz++) {
    var x = px + dx, y = py + dy, z = pz + dz;
    if (!inside(x, y, z)) continue;
    var b = get(x, y, z);
    if (b === CRAFT_TABLE) st.table = true;
    else if (b === FURNACE) st.furnace = true;
  }
  return st;
}
export function recipesFor(st) {
  var out = [];
  for (var i = 0; i < RECIPES.length; i++) {
    var r = RECIPES[i];
    if (r.at === "hand" || (r.at === "table" && st.table) || (r.at === "furnace" && st.furnace)) out.push(r);
  }
  return out;
}

// ── 목표 한 줄 — 모으기 모드의 튜토리얼. 마크를 처음 하는 아이가 막히는 순서 그대로
export var SV_GOALS = [
  { key: "get:" + LOG, text: "<b>나무</b>를 좌클릭으로 <b>누르고 있어</b> 원목을 모으세요" },
  { key: "craft:" + PLANKS, text: "<b>E</b>(목록)를 눌러 원목으로 <b>나무판자</b>를 만드세요" },
  { key: "craft:" + CRAFT_TABLE, text: "판자 4개로 <b>제작대</b>를 만드세요" },
  { key: "place:" + CRAFT_TABLE, text: "<b>제작대</b>를 땅에 놓으세요 — 그 옆에서 더 많이 만듭니다" },
  { key: "craft:" + PICK_WOOD, text: "제작대 옆에서 <b>나무 곡괭이</b>를 만드세요 (막대기도 필요해요)" },
  { key: "get:" + COBBLE, text: "곡괭이로 <b>돌</b>을 캐서 조약돌을 모으세요" },
  { key: "craft:" + PICK_STONE, text: "조약돌 3개와 막대기 2개로 <b>돌 곡괭이</b>를 만드세요 — 철을 캘 수 있어요" },
  { key: "craft:" + FURNACE, text: "조약돌 8개로 <b>화로</b>를 만드세요" },
  { key: "place:" + FURNACE, text: "<b>화로</b>를 땅에 놓으세요 — 그 옆에서 광석을 녹입니다" },
  { key: "craft:" + IRON_INGOT, text: "철 광석과 석탄을 화로에서 녹여 <b>철괴</b>를 만드세요" },
  { key: "craft:" + PICK_IRON, text: "철괴 3개와 막대기 2개로 <b>철 곡괭이</b>를 만드세요 — 다이아몬드를 캘 수 있어요" },
  { key: "get:" + DIAMOND_GEM, text: "깊은 땅속에서 <b>다이아몬드</b>를 찾으세요!" },
  { key: "craft:" + PICK_DIAMOND, text: "다이아몬드 3개와 막대기 2개로 <b>다이아 곡괭이</b>를 만드세요" }
];
export function svGoalText() {
  var st = S.svStep | 0;
  if (st >= SV_GOALS.length) return "";
  return touchWords(SV_GOALS[st].text);
}
// 폰에는 좌클릭도 E 도 없다 — 버튼 이름으로 말한다 (v135)
export function touchWords(t) {
  if (!isTouch) return t;
  return t.replace("좌클릭으로", "<b>캐기</b> 버튼으로").replace("<b>E</b>(목록)를 눌러", "<b>목록</b> 버튼을 눌러")
          .replace(/E 에서/g, "목록에서");
}
// 일어난 일을 알려 받는다 — 지금 목표와 같으면 한 칸 나아간다.
// 이미 앞서 해 둔 것(곡괭이를 먼저 만든 아이)도 **뒤따라 넘어가게** 가방을 본다
export function svEvent(key) {
  if (!S.survival) return;
  // 일어난 일은 **모두 적어 둔다** (자문 36차 #2) — 화로를 먼저 만들어 놓아 버린 아이는
  // 가방에 화로가 없어서, 그 목표에 오면 영영 안 넘어갔다
  if (!S.svSeen) S.svSeen = {};
  S.svSeen[key] = 1;
  var moved = false;
  while ((S.svStep | 0) < SV_GOALS.length) {
    var g = SV_GOALS[S.svStep | 0];
    var done = g.key === key || alreadyDone(g.key);
    if (!done) break;
    S.svStep = (S.svStep | 0) + 1;
    moved = true;
  }
  if (moved) {
    S.worldDirty = true;
    refreshHint();
    var next = svGoalText();
    toast(next ? "잘했어요! 다음: " + next.replace(/<[^>]+>/g, "") : "모든 목표를 이뤘어요! 이제 마음껏 지어 보세요");
  }
}
function alreadyDone(key) {
  if (S.svSeen && S.svSeen[key]) return true;
  var p = key.split(":"), id = parseInt(p[1], 10);
  if (p[0] === "place") {
    var st = stationsNear();
    return id === CRAFT_TABLE ? st.table : st.furnace;
  }
  if (id === LOG) return haveOf(LOGS) > 0;
  return invCount(id) > 0 && (p[0] === "get" || PICKS.indexOf(id) >= 0 || id === FURNACE || id === CRAFT_TABLE);
}

// 캐서 얻는다 — mineAt 이 부른다. 원목 세 종은 목표에서 한 가지로 친다
export function collect(b) {
  if (!S.survival) return AIR;
  var d = dropOf(b);
  if (d === AIR) return AIR;
  S.lastSlotted = addItem(d, 1);
  svEvent("get:" + (GROUPS[LOGS].indexOf(d) >= 0 ? LOG : d));
  return d;
}

// 저절로 진 잎 — 가끔 묘목 (자문 36차 #6). 기둥만 베고 떠나도 숲을 되살릴 씨앗이 남는다
// **내 둘레(8칸)에서 진 잎만** (v135·자문 37차) — 새 세계의 잎 부패 큐에는 마을 터를 고르며 잘린
// 나무의 뜬 잎이 섬 곳곳에 들어 있어, 나무 한 그루를 벤 사이에 묘목이 열몇 개씩 쏟아졌다
export function leafDrop(b, x, y, z) {
  if (!S.survival || Math.random() >= 0.05) return;
  if (x !== undefined) {
    var dx = x + 0.5 - player.pos.x, dy = y - player.pos.y, dz = z + 0.5 - player.pos.z;
    if (dx * dx + dz * dz > 64 || Math.abs(dy) > 10) return;
  }
  var d = b === BIRCH_LEAVES ? SAPLING_BIRCH : (b === SPRUCE_LEAVES ? SAPLING_SPRUCE : SAPLING);
  addItem(d, 1);
}

// 새 모으기 세계 — 빈손 · 빈 가방
export function resetSurvival(on) {
  S.survival = !!on;
  S.inv = {};
  S.svStep = 0;
  S.svSeen = {};
  S.giftDay = -1;
  refreshHint();
  if (on) {
    for (var i = 0; i < S.bar.length; i++) S.bar[i] = AIR;
    if (S.barAlt) for (var j = 0; j < S.barAlt.length; j++) S.barAlt[j] = AIR;
  }
}
