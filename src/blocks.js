// blocks.js — 블록 정의 · 모양 · 성질
import { S } from "./state.js";

export var AIR = 0, GRASS = 1, DIRT = 2, STONE = 3, SAND = 4, LOG = 5, LEAVES = 6,
    PLANKS = 7, GLASS = 8, BRICK = 9, WATER = 10, COBBLE = 11, COAL = 12,
    IRON = 13, SNOW = 14, LAMP = 15, GRAVEL = 16, BEDROCK = 17,
    LAVA = 18, ICE = 19,
    TALLGRASS = 20, FLOWER_R = 21, FLOWER_Y = 22, TORCH = 23,
    CACTUS = 24, DEADBUSH = 25, DRYGRASS = 26;

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

export var NAMES = {};
NAMES[GRASS] = "GRASS"; NAMES[DIRT] = "DIRT"; NAMES[STONE] = "STONE";
NAMES[SAND] = "SAND"; NAMES[LOG] = "LOG"; NAMES[LEAVES] = "LEAVES";
NAMES[PLANKS] = "PLANKS"; NAMES[GLASS] = "GLASS"; NAMES[BRICK] = "BRICK";
NAMES[COBBLE] = "COBBLE"; NAMES[COAL] = "COAL"; NAMES[IRON] = "IRON";
NAMES[SNOW] = "SNOW"; NAMES[LAMP] = "LAMP"; NAMES[WATER] = "WATER";
NAMES[GRAVEL] = "GRAVEL"; NAMES[BEDROCK] = "BEDROCK";
NAMES[LAVA] = "LAVA"; NAMES[ICE] = "ICE";
NAMES[TALLGRASS] = "GRASS TUFT"; NAMES[FLOWER_R] = "POPPY";
NAMES[FLOWER_Y] = "DANDELION"; NAMES[TORCH] = "TORCH";
NAMES[CACTUS] = "CACTUS"; NAMES[DEADBUSH] = "DEAD BUSH"; NAMES[DRYGRASS] = "DRY GRASS";

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
export function hardnessOf(b) { return HARDNESS[b] || 0.5; }

// 캘 수 없는 블록 — 세계의 바닥이라는 걸 눈으로 알려 준다
export function isUnbreakable(b) { return b === BEDROCK; }

// 스스로 빛을 내는 블록
export var EMIT = {};
EMIT[LAMP] = 15;
EMIT[LAVA] = 15;      // 동굴의 주광원 — 멀리서 오렌지빛이 새어 나온다
EMIT[TORCH] = 14;     // 길을 막지 않는 광원 — 좁은 굴에 툭툭 박아 쓴다

// X 자 교차 쿼드로 그리는 얇은 블록 — 통과할 수 있고 빛을 막지 않는다
export var CROSS = {};
CROSS[TALLGRASS] = { w: 0.46, h: 0.92, sway: 0.55 };
CROSS[FLOWER_R]  = { w: 0.42, h: 0.82, sway: 0.40 };
CROSS[FLOWER_Y]  = { w: 0.42, h: 0.82, sway: 0.40 };
CROSS[TORCH]     = { w: 0.26, h: 0.62, sway: 0 };
CROSS[DEADBUSH]  = { w: 0.44, h: 0.86, sway: 0.30 };
CROSS[DRYGRASS]  = { w: 0.46, h: 0.80, sway: 0.50 };
export function isCross(b) { return CROSS[b] !== undefined; }
export function needsFloor(b) { return isCross(b); }

export var ALL_BLOCKS = [GRASS, DIRT, STONE, COBBLE, SAND, GRAVEL, SNOW, LOG,
                  LEAVES, PLANKS, GLASS, BRICK, LAMP, TORCH, COAL, IRON, ICE,
                  WATER, LAVA, CACTUS, TALLGRASS, FLOWER_R, FLOWER_Y,
                  DEADBUSH, DRYGRASS];
export var DEFAULT_BAR = [GRASS, DIRT, STONE, COBBLE, SAND, LOG, PLANKS, GLASS, TORCH, LAMP];

// 모양 — 0 전체 · 1 반블록(아래) · 2~5 계단(높은 쪽이 -Z/+X/+Z/-X)
//        6 반블록(위) · 7~10 반전 계단 (아래·위가 뒤집힌 것, 처마와 아치용)
//        위 변형은 아래 변형 + SH_UP_OFF 로 얻는다
export var SH_FULL = 0, SH_SLAB = 1, SH_STAIR_N = 2, SH_STAIR_E = 3, SH_STAIR_S = 4, SH_STAIR_W = 5;
export var SH_UP_OFF = 5;
export var SH_SLAB_UP = 6, SH_STAIR_NU = 7, SH_STAIR_EU = 8, SH_STAIR_SU = 9, SH_STAIR_WU = 10;
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
  [[0, 0.5, 0, 1, 1, 1], [0, 0, 0, 0.5, 0.5, 1]]
];
export var SHAPE_NAMES = ["전체", "반블록", "계단", "계단", "계단", "계단",
                   "반블록(위)", "계단(뒤집힘)", "계단(뒤집힘)", "계단(뒤집힘)", "계단(뒤집힘)"];

export function isLiquid(b) { return b === WATER || b === LAVA; }
export function isTransparent(b) { return b === GLASS || b === WATER || b === ICE; }
export function isSolid(b) { return b !== AIR && !isLiquid(b) && !isCross(b); }
export function blocksLight(b) { return b !== AIR && !isTransparent(b) && !isCross(b); }
export function lightPass(b) {
  return b === AIR || b === WATER || b === GLASS || b === ICE || isCross(b);
}


S.bar = DEFAULT_BAR.slice();   // state.js 는 import 를 하지 않으므로 여기서 채운다
