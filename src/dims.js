// dims.js — 세계 치수와 좌표 계산 (의존성 없음)
export var WX = 96, WY = 64, WZ = 96, CH = 16;
export var LEGACY_WY = 48;                     // 저장 포맷 v4 까지의 세계 높이
export var CX = WX / CH, CY = WY / CH, CZ = WZ / CH;
export var N = WX * WY * WZ, PLANE = WX * WZ;
export var SEA = 11;
export function idx(x, y, z) { return (y * WZ + z) * WX + x; }
export function inside(x, y, z) { return x >= 0 && x < WX && y >= 0 && y < WY && z >= 0 && z < WZ; }
export var DIRS = [[1,0,0],[-1,0,0],[0,1,0],[0,-1,0],[0,0,1],[0,0,-1]];
