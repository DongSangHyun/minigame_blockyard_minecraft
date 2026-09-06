// blocks.js — 블록 정의 · 모양 · 성질
import { S } from "./state.js";

export var AIR = 0, GRASS = 1, DIRT = 2, STONE = 3, SAND = 4, LOG = 5, LEAVES = 6,
    PLANKS = 7, GLASS = 8, BRICK = 9, WATER = 10, COBBLE = 11, COAL = 12,
    IRON = 13, SNOW = 14, LAMP = 15, GRAVEL = 16, BEDROCK = 17,
    LAVA = 18, ICE = 19,
    TALLGRASS = 20, FLOWER_R = 21, FLOWER_Y = 22, TORCH = 23,
    CACTUS = 24, DEADBUSH = 25, DRYGRASS = 26,
    BIRCH_LOG = 27, BIRCH_LEAVES = 28, SPRUCE_LEAVES = 29,
    GOLD = 30, DIAMOND = 31,
    FENCE = 32, GATE = 33, PANE = 34, LADDER = 35;
// 양털 16색 — 건축의 팔레트. 36~51 을 연속으로 쓴다.
export var TNT = 52, FIRE = 53, FLINT = 54;
export var WOOL0 = 36, WOOL_COUNT = 16;
export var WOOL_COLORS = [
  ["흰색", "#e9ecec"], ["연회색", "#8e8e86"], ["회색", "#3e4447"], ["검정", "#1d1c21"],
  ["빨강", "#b02e26"], ["주황", "#f9801d"], ["노랑", "#fed83d"], ["연두", "#80c71f"],
  ["초록", "#5e7c16"], ["청록", "#169c9c"], ["하늘", "#3ab3da"], ["파랑", "#3c44aa"],
  ["보라", "#8932b8"], ["자홍", "#c74ebd"], ["분홍", "#f38baa"], ["갈색", "#835432"]
];
export function isWool(b) { return b >= WOOL0 && b < WOOL0 + WOOL_COUNT; }

export var TILES = {};
TILES[GRASS]  = [0, 1, 2];
TILES[DIRT]   = [2, 2, 2];
TILES[STONE]  = [3, 3, 3];
TILES[SAND]   = [4, 4, 4];
TILES[LOG]    = [6, 5, 6];
TILES[LEAVES] = [7, 7, 7];
TILES[PLANKS] = [8, 8, 8];
TILES[GLASS]  = [9, 9, 9];
TILES[BRICK]  = [10, 10, 10];
TILES[WATER]  = [11, 11, 11];
TILES[COBBLE] = [12, 12, 12];
TILES[COAL]   = [13, 13, 13];
TILES[IRON]   = [14, 14, 14];
TILES[SNOW]   = [15, 17, 2];
TILES[LAMP]   = [16, 16, 16];
TILES[GRAVEL] = [18, 18, 18];
TILES[BEDROCK] = [19, 19, 19];
TILES[LAVA]    = [20, 20, 20];
TILES[ICE]     = [21, 21, 21];
TILES[TALLGRASS] = [22, 22, 22];
TILES[FLOWER_R]  = [23, 23, 23];
TILES[FLOWER_Y]  = [24, 24, 24];
TILES[TORCH]     = [25, 25, 25];
TILES[CACTUS]    = [27, 26, 27];
TILES[DEADBUSH]  = [28, 28, 28];
TILES[DRYGRASS]  = [29, 29, 29];
TILES[BIRCH_LOG]    = [31, 30, 31];
TILES[BIRCH_LEAVES] = [32, 32, 32];
TILES[SPRUCE_LEAVES]= [33, 33, 33];
TILES[GOLD]      = [34, 34, 34];
TILES[DIAMOND]   = [35, 35, 35];
TILES[FENCE]     = [8, 8, 8];      // 나무판자 결을 그대로 쓴다
TILES[GATE]      = [8, 8, 8];
TILES[PANE]      = [9, 9, 9];      // 유리
TILES[LADDER]    = [36, 36, 36];
TILES[TNT]       = [54, 53, 54];
TILES[FIRE]      = [55, 55, 55];
TILES[FLINT]     = [56, 56, 56];

export var NAMES = {};
// 이름은 그 블록이 무슨 물건인지 알려 주는 유일한 설명이다 — 한국어로 적는다.
// 영어 이름은 NAMES_EN 에 남겨 목록 검색이 둘 다 알아듣게 한다.
export var NAMES_EN = {};
function nm(b, ko, en) { NAMES[b] = ko; NAMES_EN[b] = en; }
nm(GRASS, "잔디", "GRASS"); nm(DIRT, "흙", "DIRT"); nm(STONE, "돌", "STONE");
nm(SAND, "모래", "SAND"); nm(LOG, "참나무 원목", "LOG"); nm(LEAVES, "참나무 잎", "LEAVES");
nm(PLANKS, "나무판자", "PLANKS"); nm(GLASS, "유리", "GLASS"); nm(BRICK, "벽돌", "BRICK");
nm(COBBLE, "조약돌", "COBBLE"); nm(COAL, "석탄 광석", "COAL"); nm(IRON, "철 광석", "IRON");
nm(SNOW, "눈", "SNOW"); nm(LAMP, "조명", "LAMP"); nm(WATER, "물", "WATER");
nm(GRAVEL, "자갈", "GRAVEL"); nm(BEDROCK, "기반암", "BEDROCK");
nm(LAVA, "용암", "LAVA"); nm(ICE, "얼음", "ICE");
nm(TALLGRASS, "풀", "GRASS TUFT"); nm(FLOWER_R, "양귀비", "POPPY");
nm(FLOWER_Y, "민들레", "DANDELION"); nm(TORCH, "횃불", "TORCH");
nm(CACTUS, "선인장", "CACTUS"); nm(DEADBUSH, "죽은 덤불", "DEAD BUSH");
nm(DRYGRASS, "마른 풀", "DRY GRASS");
nm(BIRCH_LOG, "자작나무 원목", "BIRCH"); nm(BIRCH_LEAVES, "자작나무 잎", "BIRCH LEAVES");
nm(SPRUCE_LEAVES, "가문비 잎", "SPRUCE LEAVES");
nm(GOLD, "금 광석", "GOLD"); nm(DIAMOND, "다이아 광석", "DIAMOND");
nm(TNT, "TNT", "TNT"); nm(FIRE, "불", "FIRE"); nm(FLINT, "부싯돌", "FLINT");
nm(FENCE, "울타리", "FENCE"); nm(GATE, "울타리 문", "GATE");
nm(PANE, "유리판", "GLASS PANE"); nm(LADDER, "사다리", "LADDER");

// 캐는 데 걸리는 시간(초)
export var HARDNESS = {};
HARDNESS[LEAVES] = 0.18; HARDNESS[GLASS] = 0.22; HARDNESS[SNOW] = 0.24;
HARDNESS[SAND] = 0.30; HARDNESS[GRASS] = 0.38; HARDNESS[DIRT] = 0.38;
HARDNESS[LAMP] = 0.45; HARDNESS[PLANKS] = 0.62; HARDNESS[LOG] = 0.78;
HARDNESS[BRICK] = 1.05; HARDNESS[COBBLE] = 1.05; HARDNESS[STONE] = 1.25;
HARDNESS[COAL] = 1.55; HARDNESS[IRON] = 1.95; HARDNESS[GRAVEL] = 0.55;
HARDNESS[ICE] = 0.40;
HARDNESS[TALLGRASS] = 0.05; HARDNESS[FLOWER_R] = 0.05;
HARDNESS[FLOWER_Y] = 0.05; HARDNESS[TORCH] = 0.06;
HARDNESS[CACTUS] = 0.34; HARDNESS[DEADBUSH] = 0.05; HARDNESS[DRYGRASS] = 0.05;
HARDNESS[GOLD] = 2.35; HARDNESS[DIAMOND] = 2.9;
HARDNESS[TNT] = 0.30; HARDNESS[FIRE] = 0.02; HARDNESS[FLINT] = 0.20;
HARDNESS[FENCE] = 0.55; HARDNESS[GATE] = 0.55;
HARDNESS[PANE] = 0.20; HARDNESS[LADDER] = 0.24;
HARDNESS[BIRCH_LOG] = 0.78; HARDNESS[BIRCH_LEAVES] = 0.18; HARDNESS[SPRUCE_LEAVES] = 0.18;
// 양털 16색을 표·이름·굳기에 한꺼번에 등록한다
for (var wi = 0; wi < WOOL_COUNT; wi++) {
  TILES[WOOL0 + wi] = [37 + wi, 37 + wi, 37 + wi];
  NAMES[WOOL0 + wi] = WOOL_COLORS[wi][0] + " 양털";
  NAMES_EN[WOOL0 + wi] = "WOOL " + WOOL_COLORS[wi][0];
  HARDNESS[WOOL0 + wi] = 0.42;
}

export function hardnessOf(b) { return HARDNESS[b] || 0.5; }

// 캘 수 없는 블록 — 세계의 바닥이라는 걸 눈으로 알려 준다
export function isUnbreakable(b) { return b === BEDROCK; }

// 스스로 빛을 내는 블록
export var EMIT = {};
EMIT[LAMP] = 15;
EMIT[LAVA] = 15;      // 동굴의 주광원 — 멀리서 오렌지빛이 새어 나온다
EMIT[TORCH] = 14;
EMIT[FIRE] = 13;     // 길을 막지 않는 광원 — 좁은 굴에 툭툭 박아 쓴다

// X 자 교차 쿼드로 그리는 얇은 블록 — 통과할 수 있고 빛을 막지 않는다
export var CROSS = {};
CROSS[TALLGRASS] = { w: 0.46, h: 0.92, sway: 0.55 };
CROSS[FLOWER_R]  = { w: 0.42, h: 0.82, sway: 0.40 };
CROSS[FLOWER_Y]  = { w: 0.42, h: 0.82, sway: 0.40 };
CROSS[TORCH]     = { w: 0.26, h: 0.62, sway: 0 };
CROSS[DEADBUSH]  = { w: 0.44, h: 0.86, sway: 0.30 };
CROSS[DRYGRASS]  = { w: 0.46, h: 0.80, sway: 0.50 };
CROSS[FIRE]      = { w: 0.50, h: 0.96, sway: 0.85 };
export function isCross(b) { return CROSS[b] !== undefined; }
export function needsFloor(b) { return isCross(b); }

export var ALL_BLOCKS = [GRASS, DIRT, STONE, COBBLE, SAND, GRAVEL, SNOW, LOG,
                  LEAVES, PLANKS, GLASS, BRICK, LAMP, TORCH, COAL, IRON, ICE,
                  WATER, LAVA, CACTUS, TALLGRASS, FLOWER_R, FLOWER_Y,
                  DEADBUSH, DRYGRASS, BIRCH_LOG, BIRCH_LEAVES, SPRUCE_LEAVES,
                  GOLD, DIAMOND, FENCE, GATE, PANE, LADDER, TNT];

// 도구 — 목록에는 나오지만 "놓는 블록" 이 아니다.
// ALL_BLOCKS 에 넣으면 "수집가"(모든 블록 놓기) 과제가 영영 불가능해진다.
export var ITEMS = [FLINT];
export function isItem(b) { return ITEMS.indexOf(b) >= 0; }
for (var wj = 0; wj < WOOL_COUNT; wj++) ALL_BLOCKS.push(WOOL0 + wj);

// ── 이웃에 따라 모양이 바뀌는 블록 (울타리 · 유리판)
export function isConnecting(b) { return b === FENCE || b === PANE; }
// 얇지만 통과할 수 있는 블록 (사다리)
export function isClimbable(b) { return b === LADDER; }
// 우클릭으로 여닫는 블록
export function isOpenable(b) { return b === GATE; }
// 불에 타는 것들 — 불이 옮겨 붙는다
export function isFlammable(b) {
  return b === LOG || b === BIRCH_LOG || b === PLANKS || b === LEAVES ||
         b === BIRCH_LEAVES || b === SPRUCE_LEAVES || b === TALLGRASS ||
         b === DRYGRASS || b === DEADBUSH || b === FENCE || b === GATE || isWool(b);
}
// 울타리·유리판이 이어 붙는 상대인가
export function connectsTo(self, other) {
  if (other === AIR || isLiquid(other) || isCross(other)) return false;
  if (self === PANE) return other === PANE || other === GLASS || isSolid(other);
  return other === FENCE || other === GATE || isSolid(other);
}

// 원목·잎으로 묶어 두면 잎 부패와 축 회전이 종류를 안 가린다
export function isLog(b) { return b === LOG || b === BIRCH_LOG; }
export function isLeaf(b) { return b === LEAVES || b === BIRCH_LEAVES || b === SPRUCE_LEAVES; }
export var DEFAULT_BAR = [GRASS, DIRT, STONE, COBBLE, SAND, LOG, PLANKS, GLASS, TORCH, LAMP];
// 2쪽 — 건축 부품과 도구
export var DEFAULT_BAR2 = [BRICK, SNOW, ICE, FENCE, GATE, PANE, LADDER, TNT, FLINT, WOOL0];

// 모양 — 0 전체 · 1 반블록(아래) · 2~5 계단(높은 쪽이 -Z/+X/+Z/-X)
//        6 반블록(위) · 7~10 반전 계단 (아래·위가 뒤집힌 것, 처마와 아치용)
//        위 변형은 아래 변형 + SH_UP_OFF 로 얻는다
export var SH_FULL = 0, SH_SLAB = 1, SH_STAIR_N = 2, SH_STAIR_E = 3, SH_STAIR_S = 4, SH_STAIR_W = 5;
export var SH_UP_OFF = 5;
export var SH_SLAB_UP = 6, SH_STAIR_NU = 7, SH_STAIR_EU = 8, SH_STAIR_SU = 9, SH_STAIR_WU = 10;
// 11~12 는 모양이 아니라 **축**이다 — 온전한 상자이지만 면 텍스처가 돌아간다 (원목 등)
export var SH_AXIS_X = 11, SH_AXIS_Z = 12;
// 13~16 은 벽에 붙은 얇은 블록 — 벽이 어느 쪽에 있는지를 담는다
export var SH_WALL_N = 13, SH_WALL_E = 14, SH_WALL_S = 15, SH_WALL_W = 16;
export var WALL_DIR = { 13: [0, 0, -1], 14: [1, 0, 0], 15: [0, 0, 1], 16: [-1, 0, 0] };
export function isWallShape(sh) { return sh >= SH_WALL_N && sh <= SH_WALL_W; }
// 계단 갈래인가 — 아래 계단(2~5)과 반전 계단(7~10) 을 한꺼번에 본다
export function isStairShape(sh) {
  return (sh >= SH_STAIR_N && sh <= SH_STAIR_W) || (sh >= SH_STAIR_NU && sh <= SH_STAIR_WU);
}
export function wallShapeFor(nx, nz) {
  if (nx > 0) return SH_WALL_W;      // +X 면에 붙었다 = 벽은 -X 쪽
  if (nx < 0) return SH_WALL_E;
  if (nz > 0) return SH_WALL_N;
  return SH_WALL_S;
}
// 얇은 블록이 칸 안에서 놓이는 자리 (벽에 붙으면 벽 쪽으로 밀고 살짝 올린다)
export function crossOffset(sh) {
  var d = WALL_DIR[sh];
  if (!d) return [0, 0, 0];
  return [d[0] * 0.30, 0.20, d[2] * 0.30];
}
export var SHAPE_BOXES = [
  [[0, 0, 0, 1, 1, 1]],
  [[0, 0, 0, 1, 0.5, 1]],
  [[0, 0, 0, 1, 0.5, 1], [0, 0.5, 0, 1, 1, 0.5]],
  [[0, 0, 0, 1, 0.5, 1], [0.5, 0.5, 0, 1, 1, 1]],
  [[0, 0, 0, 1, 0.5, 1], [0, 0.5, 0.5, 1, 1, 1]],
  [[0, 0, 0, 1, 0.5, 1], [0, 0.5, 0, 0.5, 1, 1]],
  [[0, 0.5, 0, 1, 1, 1]],
  [[0, 0.5, 0, 1, 1, 1], [0, 0, 0, 1, 0.5, 0.5]],
  [[0, 0.5, 0, 1, 1, 1], [0.5, 0, 0, 1, 0.5, 1]],
  [[0, 0.5, 0, 1, 1, 1], [0, 0, 0.5, 1, 0.5, 1]],
  [[0, 0.5, 0, 1, 1, 1], [0, 0, 0, 0.5, 0.5, 1]],
  [[0, 0, 0, 1, 1, 1]],
  [[0, 0, 0, 1, 1, 1]],
  [[0, 0, 0, 1, 1, 1]],
  [[0, 0, 0, 1, 1, 1]],
  [[0, 0, 0, 1, 1, 1]],
  [[0, 0, 0, 1, 1, 1]]
];
export var SHAPE_NAMES = ["전체", "반블록", "계단", "계단", "계단", "계단",
                   "반블록(위)", "계단(뒤집힘)", "계단(뒤집힘)", "계단(뒤집힘)", "계단(뒤집힘)",
                   "눕힘(동서)", "눕힘(남북)",
                   "벽(북)", "벽(동)", "벽(남)", "벽(서)"];

// 축이 돌아간 블록의 면 종류 — 0 윗면(나이테) · 1 옆면 · 2 밑면
export function faceKindFor(sh, f, base) {
  if (sh === SH_AXIS_X) return (f === 0 || f === 1) ? 0 : 1;
  if (sh === SH_AXIS_Z) return (f === 4 || f === 5) ? 0 : 1;
  return base;
}
export function isAxisShape(sh) { return sh === SH_AXIS_X || sh === SH_AXIS_Z; }

export function isLiquid(b) { return b === WATER || b === LAVA; }
export function isTransparent(b) { return b === GLASS || b === WATER || b === ICE || b === PANE; }
export function isSolid(b) { return b !== AIR && !isLiquid(b) && !isCross(b) && b !== LADDER; }
export function blocksLight(b) { return b !== AIR && !isTransparent(b) && !isCross(b); }
export function lightPass(b) {
  return b === AIR || b === WATER || b === GLASS || b === ICE || b === PANE ||
         b === FENCE || b === GATE || b === LADDER || isCross(b);
}


S.bar = DEFAULT_BAR.slice();
S.barAlt = DEFAULT_BAR2.slice();   // state.js 는 import 를 하지 않으므로 여기서 채운다

// ── 블록 갈래 — 목록이 35종을 넘어가면 분류가 필요하다
export function categoryOf(b) {
  if (isWool(b)) return "color";
  if (b === WATER || b === LAVA || b === LAMP || b === TORCH || b === FIRE ||
      b === ICE || b === FLINT) return "light";
  if (b === GRASS || b === DIRT || b === STONE || b === SAND || b === GRAVEL || b === SNOW ||
      b === LOG || b === BIRCH_LOG || b === LEAVES || b === BIRCH_LEAVES || b === SPRUCE_LEAVES ||
      b === COAL || b === IRON || b === GOLD || b === DIAMOND || b === CACTUS ||
      isCross(b)) return "nature";
  return "build";
}
