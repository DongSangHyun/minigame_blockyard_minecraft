// world.js — 월드 데이터 · 지형 생성
import { S } from "./state.js";
import { growTree } from "./tree.js";
import { resetQueues } from "./queues.js";
import { DIRS, N, PLANE, SEA, GEN_LATEST, setGen, seaLift, WX, WY, WZ, idx, inside } from "./dims.js";
import { DOOR, doorFacing, doorOpen, isLog, AIR, BEDROCK, BIRCH_LEAVES, BIRCH_LOG, SPRUCE_LOG, CACTUS, COAL, COBBLE, DEADBUSH, DIAMOND, DIRT, DRYGRASS, FENCE, FLOWER_R, FLOWER_Y, GATE, GLASS, GOLD, GRASS, GRAVEL, ICE, IRON, LADDER, LAMP, LAVA, LEAVES, LOG, PANE, PLANKS, SAND, BRICK, BOOKSHELF, CARPET, isCarpet, POT, FRAME, SH_SLAB, SHAPE_BOXES, SH_FULL, SH_STAIR_N, SH_STAIR_E, SH_STAIR_S, SH_STAIR_W, SH_STAIR_NU, SH_STAIR_EU, SH_STAIR_SU, SH_STAIR_WU, isStairShape, SNOW, SPRUCE_LEAVES, STONE, TALLGRASS, TORCH, WALL_DIR, WATER, connectsTo, isCross, isSolid } from "./blocks.js";
import { makeRng } from "./atlas.js";

export var world = new Uint8Array(N);
export var shape = new Uint8Array(N); // 각 칸의 모양 (0 전체 · 1 반블록 · 2~5 계단)
export var heightMap = new Int16Array(PLANE);
export var topMap = new Int16Array(PLANE);
export var biomeMap = new Uint8Array(PLANE);   // 0 초원 · 1 설원 · 2 사막
export var waterLvl = new Uint8Array(N);       // 물 흐름 단계 · 0 = 근원 · 1~3 = 흘러나온 물

export var BIOME_NAMES = ["초원", "설원", "사막"];

export function get(x, y, z) {
  if (y < 0) return STONE;
  if (!inside(x, y, z)) return AIR;
  return world[idx(x, y, z)];
}
// sh 를 주면 그 모양으로 둔다 — 안 주면 통짜다.
// 예전에는 늘 SH_FULL 로 덮어서 **세계 생성이 반블록·계단을 쓸 수가 없었다**
// (오두막 처마를 얇게 얹으려다 발견했다).
export function set(x, y, z, b, sh) {
  if (inside(x, y, z)) { var i = idx(x, y, z); world[i] = b; shape[i] = sh || SH_FULL; }
}
export function shapeAt(x, y, z) { return inside(x, y, z) ? shape[idx(x, y, z)] : SH_FULL; }

export function refreshTop(x, z) {
  if (x < 0 || x >= WX || z < 0 || z >= WZ) return;
  for (var y = WY - 1; y >= 0; y--) {
    var tb = world[idx(x, y, z)];
    if (tb !== AIR && !isCross(tb)) { topMap[z * WX + x] = y; return; }
  }
  topMap[z * WX + x] = -1;
}
// 그 칸이 딛을 수 있는 윗면의 높이 (0 = 딛을 것이 없음)
export function surfaceTop(x, y, z) {
  var b = get(x, y, z);
  if (!isSolid(b)) return 0;
  // boxesAt 을 거친다 — SHAPE_BOXES 를 직접 읽으면 이웃에 따라 달라지는 모양
  // (울타리·유리판·계단 모서리·카펫)이 통짜 1칸으로 읽혀 그 위에 서면 한 칸 떠오른다
  var boxes = boxesAt(b, shapeAt(x, y, z), x, y, z);
  var top = 0;
  for (var i = 0; i < boxes.length; i++) if (boxes[i][4] > top) top = boxes[i][4];
  return top;
}

// 풀·꽃·횃불이 시작하는 y — 반블록 위에서는 0.5칸 내려앉는다
export function crossBase(x, y, z) {
  var st = surfaceTop(x, y - 1, z);
  return (st > 0 && st < 1) ? y - (1 - st) : y;
}

// ── 이웃에 따라 달라지는 상자 —
// 울타리·유리판은 옆에 무엇이 있느냐로 모양이 바뀌므로 SHAPE_BOXES 로는 담을 수 없다.
export function dynamicBoxes(b, x, y, z) {
  var _dynBoxes = [];
  if (b === FENCE) {
    _dynBoxes.push([0.375, 0, 0.375, 0.625, 1, 0.625]);           // 기둥
    if (connectsTo(b, get(x - 1, y, z))) _dynBoxes.push([0, 0.30, 0.437, 0.375, 0.94, 0.563]);
    if (connectsTo(b, get(x + 1, y, z))) _dynBoxes.push([0.625, 0.30, 0.437, 1, 0.94, 0.563]);
    if (connectsTo(b, get(x, y, z - 1))) _dynBoxes.push([0.437, 0.30, 0, 0.563, 0.94, 0.375]);
    if (connectsTo(b, get(x, y, z + 1))) _dynBoxes.push([0.437, 0.30, 0.625, 0.563, 0.94, 1]);
    return _dynBoxes;
  }
  if (b === PANE) {
    var w = connectsTo(b, get(x - 1, y, z)), e = connectsTo(b, get(x + 1, y, z));
    var n = connectsTo(b, get(x, y, z - 1)), s2 = connectsTo(b, get(x, y, z + 1));
    if (!w && !e && !n && !s2) {                                   // 외톨이는 십자로 선다
      _dynBoxes.push([0.437, 0, 0.437, 0.563, 1, 0.563]);
      return _dynBoxes;
    }
    if (w || e) _dynBoxes.push([w ? 0 : 0.437, 0, 0.437, e ? 1 : 0.563, 1, 0.563]);
    if (n || s2) _dynBoxes.push([0.437, 0, n ? 0 : 0.437, 0.563, 1, s2 ? 1 : 0.563]);
    return _dynBoxes;
  }
  if (isCarpet(b)) {
    // 바닥에 깔리는 한 겹 — 딛고 서되 걸리지 않는다 (마크 카펫과 같은 1/16)
    _dynBoxes.push([0, 0, 0, 1, 0.0625, 1]);
    return _dynBoxes;
  }
  if (b === GATE) {
    var open = shape[idx(x, y, z)] === 1;
    var alongX = connectsTo(b, get(x - 1, y, z)) || connectsTo(b, get(x + 1, y, z));
    if (open) {                                                    // 열리면 옆으로 접힌다
      if (alongX) {
        _dynBoxes.push([0, 0.25, 0, 0.18, 1, 0.30]);
        _dynBoxes.push([0.82, 0.25, 0, 1, 1, 0.30]);
      } else {
        _dynBoxes.push([0, 0.25, 0, 0.30, 1, 0.18]);
        _dynBoxes.push([0, 0.25, 0.82, 0.30, 1, 1]);
      }
      return _dynBoxes;
    }
    if (alongX) _dynBoxes.push([0, 0.25, 0.437, 1, 1, 0.563]);
    else _dynBoxes.push([0.437, 0.25, 0, 0.563, 1, 1]);
    return _dynBoxes;
  }
  if (b === DOOR) {
    var dsh = shape[idx(x, y, z)];
    var face = doorFacing(dsh), open2 = doorOpen(dsh);
    // 열리면 90도 돌아 옆벽에 붙는다 — 닫힌 면의 다음 방향으로 접힌다
    var eff = open2 ? ((face + 3) & 3) : face;
    var T = 0.19;
    if (eff === 0) _dynBoxes.push([0, 0, 0, 1, 1, T]);            // 북쪽 면
    else if (eff === 1) _dynBoxes.push([1 - T, 0, 0, 1, 1, 1]);   // 동쪽
    else if (eff === 2) _dynBoxes.push([0, 0, 1 - T, 1, 1, 1]);   // 남쪽
    else _dynBoxes.push([0, 0, 0, T, 1, 1]);                      // 서쪽
    return _dynBoxes;
  }
  if (b === POT) {
    // 바닥에 놓는 작은 토분 — 밟고 넘을 수 있게 낮다
    _dynBoxes.push([0.31, 0, 0.31, 0.69, 0.44, 0.69]);
    return _dynBoxes;
  }
  if (b === FRAME) {
    // 벽에 붙는 얇은 판 — 사다리와 같은 규칙이다
    var fd = WALL_DIR[shape[idx(x, y, z)]] || [0, 0, -1];
    if (fd[0]) return _dynBoxes.push(fd[0] > 0 ? [0.92, 0.1, 0.1, 1, 0.9, 0.9]
                                               : [0, 0.1, 0.1, 0.08, 0.9, 0.9]), _dynBoxes;
    return _dynBoxes.push(fd[2] > 0 ? [0.1, 0.1, 0.92, 0.9, 0.9, 1]
                                    : [0.1, 0.1, 0, 0.9, 0.9, 0.08]), _dynBoxes;
  }
  if (b === LADDER) {
    var d = WALL_DIR[shape[idx(x, y, z)]] || [0, 0, -1];
    if (d[0]) return _dynBoxes.push(d[0] > 0 ? [0.86, 0, 0, 1, 1, 1] : [0, 0, 0, 0.14, 1, 1]), _dynBoxes;
    return _dynBoxes.push(d[2] > 0 ? [0, 0, 0.86, 1, 1, 1] : [0, 0, 0, 1, 1, 0.14]), _dynBoxes;
  }
  return null;
}
export function hasDynamicBoxes(b) {
  return b === FENCE || b === PANE || b === GATE || b === DOOR || b === LADDER ||
         isCarpet(b) || b === POT || b === FRAME;
}
// ── 계단 모서리 ──────────────────────────────────────────────
// 꺾이는 자리마다 네모 반 칸이 툭 튀어나와, 나선계단 층계참과 박공지붕 모서리가 뭉툭했다.
// 마크는 이웃한 계단을 보고 안/바깥 모서리로 저절로 바꾼다 — 플레이어는 그냥 놓기만 한다.
//
// 모서리 모양을 `shape` 에 **저장하지 않는다.** 여기서 이웃을 보고 계산한다.
// 그래서 저장 포맷 v5 를 안 건드리고, 옆 칸을 캐면 모양이 저절로 되돌아온다.
// (울타리·유리판이 connectsTo 로 이미 쓰던 틀을 계단으로 넓힌 셈이다)

// 계단의 "높은 쪽" 방향. 0 이면 계단이 아니다.
var STAIR_R = {};
STAIR_R[SH_STAIR_N] = [0, -1]; STAIR_R[SH_STAIR_E] = [1, 0];
STAIR_R[SH_STAIR_S] = [0, 1];  STAIR_R[SH_STAIR_W] = [-1, 0];
STAIR_R[SH_STAIR_NU] = [0, -1]; STAIR_R[SH_STAIR_EU] = [1, 0];
STAIR_R[SH_STAIR_SU] = [0, 1];  STAIR_R[SH_STAIR_WU] = [-1, 0];
// 뒤집힌 계단인가 (윗칸이 통짜, 아랫칸이 반 칸)
function stairUp(sh) { return sh >= SH_STAIR_NU; }

// 이웃 칸이 같은 반쪽의 계단이고 방향이 직각이면 그 방향을 돌려준다. 아니면 null.
function perpStairAt(x, y, z, up, rx, rz) {
  if (!inside(x, y, z)) return null;
  var i = idx(x, y, z);
  if (world[i] === AIR) return null;
  var sh = shape[i];
  if (!isStairShape(sh) || stairUp(sh) !== up) return null;
  var q = STAIR_R[sh];
  if (!q) return null;
  // 직각일 때만 모서리다 — 같은 축이면 그냥 이어지는 직선 계단이다
  if ((q[0] !== 0) === (rx !== 0)) return null;
  return q;
}

// x·z 한 축의 반쪽 범위 — d 가 0 이면 통짜(0~1)
function half(d) { return d > 0 ? [0.5, 1] : (d < 0 ? [0, 0.5] : [0, 1]); }

function stairBoxes(sh, x, y, z) {
  var r = STAIR_R[sh];
  if (!r) return SHAPE_BOXES[sh] || SHAPE_BOXES[SH_FULL];
  var up = stairUp(sh);
  // 통짜 반쪽(밟는 바닥)과 위에 얹히는 층의 y 범위
  var base = up ? [0.5, 1] : [0, 0.5];
  var top = up ? [0, 0.5] : [0.5, 1];
  var out = [[0, base[0], 0, 1, base[1], 1]];

  // ① 높은 쪽 뒤에 직각 계단이 있으면 **안쪽 모서리** — 윗층이 네 칸 중 세 칸을 덮는다
  var q = perpStairAt(x + r[0], y, z + r[1], up, r[0], r[1]);
  if (q) {
    var hx = half(r[0]), hz = half(r[1]);
    out.push([hx[0], top[0], hz[0], hx[1], top[1], hz[1]]);          // 높은 쪽 반쪽
    // 남은 한 칸 — 높은 쪽의 반대편이면서, 이웃 계단이 높은 쪽. 이 칸이 오목한 자리를 메운다.
    var qx = r[0] !== 0 ? half(-r[0]) : half(q[0]);
    var qz = r[1] !== 0 ? half(-r[1]) : half(q[1]);
    out.push([qx[0], top[0], qz[0], qx[1], top[1], qz[1]]);
    return out;
  }
  // ② 낮은 쪽 앞에 직각 계단이 있으면 **바깥쪽 모서리** — 윗층이 네 칸 중 한 칸만 남는다.
  //    남기는 칸은 이웃의 높은 쪽과 맞닿는 칸이다. 반대로 잡으면 그 자리에 노치가 남는다.
  var q2 = perpStairAt(x - r[0], y, z - r[1], up, r[0], r[1]);
  if (q2) {
    var ox = r[0] !== 0 ? half(r[0]) : half(q2[0]);
    var oz = r[1] !== 0 ? half(r[1]) : half(q2[1]);
    out.push([ox[0], top[0], oz[0], ox[1], top[1], oz[1]]);
    return out;
  }
  // ③ 그냥 직선 계단
  var sx = half(r[0]), sz = half(r[1]);
  out.push([sx[0], top[0], sz[0], sx[1], top[1], sz[1]]);
  return out;
}

// 충돌·조준·메싱이 함께 쓰는 단일 진입점
export function boxesAt(b, sh, x, y, z) {
  if (hasDynamicBoxes(b)) return dynamicBoxes(b, x, y, z);
  if (isStairShape(sh)) return stairBoxes(sh, x, y, z);
  return SHAPE_BOXES[sh] || SHAPE_BOXES[SH_FULL];
}

// 사람이 손댄 칸을 기억한다 — 날씨·자동 변화가 건축물을 건드리지 않게
export var touched = new Uint8Array(N);
// 미니맵에 밝혀진 칸 — 가 본 곳만 지도에 남는다.
// 부팅 3초에 섬 전체가 드러나면 "저 언덕 너머에 뭐가 있지" 가 사라진다.
// 걸어서 밝힌 지도. 한 칸에 두 비트를 쓴다 —
// SEEN_TOP(1) 지상에서 본 자리 · SEEN_UNDER(2) 지하에서 본 자리.
// 한 배열로 쓰면 굴을 파고 지나간 자리의 지상 지형까지 밝혀져, 걸어 본 적 없는 산이 지도에 뜬다.
// 미니맵 표식 — 예전 저장은 [x, z] 두 원소, v67 부터는 [x, y, z, 이름] 이다.
// 저장 버전을 올리지 않으려고 **길이로 구분**한다. 읽는 곳이 여럿이라 여기 모아 둔다.
export function markX(m) { return m[0]; }
export function markY(m) { return m.length >= 3 ? m[1] : -1; }   // -1 = 높이를 모르는 예전 표식
export function markZ(m) { return m.length >= 3 ? m[2] : m[1]; }
export function markName(m) { return (m.length >= 4 && typeof m[3] === "string") ? m[3] : ""; }

// 지하는 **세 겹**으로 나눠 밝힌다 (v81). v79 로 지하가 13칸에서 26칸이 되면서
// 한 장(SEEN_UNDER)이 26층을 나눠 쓰게 됐다 — 위층 굴을 밝혀 놓고 아래층으로 내려가면
// 그 칸들이 "밝혀짐" 인 채 **전부 통돌 회색**으로 그려져, 어느 게 아는 길인지 알 수 없었다
// (실측: y20 에서 633칸을 밝힌 뒤 y4 에서 보면 돌 82% · 공기 0%).
// 비트 1 = 지상 · 2·4·8 = 지하 얕은/중간/깊은 층.
// 예전 저장은 2 만 갖고 있으므로 불러올 때 세 비트로 펼친다 (`save.js` 의 `mv`).
export var SEEN_TOP = 1, SEEN_UNDER = 2;
export var UNDER_BANDS = 3;
export var SEEN_UNDER_ALL = 2 | 4 | 8;
// 층 두께는 세계마다 다르다 — 해수면이 지하 두께를 정한다 (판 1: 4~5칸 · 판 2: 8~9칸)
export function underBand(y) {
  var t = Math.max(1, (SEA + 2) / UNDER_BANDS);
  var b = Math.floor(y / t);
  if (b < 0) b = 0;
  if (b >= UNDER_BANDS) b = UNDER_BANDS - 1;
  return 2 << b;                       // 2 · 4 · 8
}
// 예전 저장(지하가 한 장이던 것)을 세 겹으로 펼친다 — 밝혀 둔 것을 잃지 않는다
export function expandLegacySeen() {
  for (var i = 0; i < seenMap.length; i++)
    if (seenMap[i] & SEEN_UNDER) seenMap[i] |= SEEN_UNDER_ALL;
}
export var seenMap = new Uint8Array(WX * WZ);
export function markSeen(px, pz, r, bit) {
  var b = bit || SEEN_TOP;
  var cx = Math.floor(px), cz = Math.floor(pz), r2 = r * r, n = 0;
  var x0 = Math.max(0, cx - r), x1 = Math.min(WX - 1, cx + r);
  var z0 = Math.max(0, cz - r), z1 = Math.min(WZ - 1, cz + r);
  for (var z = z0; z <= z1; z++)
    for (var x = x0; x <= x1; x++) {
      var dx = x - cx, dz = z - cz;
      if (dx * dx + dz * dz > r2) continue;
      var i = z * WX + x;
      if (!(seenMap[i] & b)) { seenMap[i] |= b; n++; }
    }
  return n;
}
// 지도장이 과제는 "걸어서 밝힌 **뭍**" 만 센다 — 굴만 파고 다녀서 받는 상도,
// 바다 위를 날아다녀 받는 상도 아니다.
// 분모를 지도 전체(9,216칸)로 두던 때는 **뭍이 지도의 23~31%뿐**이라
// 섬을 한 칸도 안 남기고 다 걸어도 30%대에서 멈췄다 — 설명("섬의 8할")과 어긋났다.
export function seenRatio() {
  var n = 0, land = 0;
  for (var i = 0; i < seenMap.length; i++) {
    if (topMap[i] <= SEA) continue;          // 바다 기둥은 안 센다
    land++;
    if (seenMap[i] & SEEN_TOP) n++;
  }
  return land ? n / land : 0;
}

export function markTouched(x, y, z) {
  if (inside(x, y, z)) touched[idx(x, y, z)] = 1;
}
export function isTouched(x, y, z) {
  return inside(x, y, z) ? touched[idx(x, y, z)] === 1 : false;
}
// 되돌릴 때 그 자국도 되돌린다 (v100).
// markTouched 는 찍히는데 되돌리는 길이 없어서, 눈이 영영 안 쌓이고
// 흙이 영영 풀이 안 되는 칸이 **영구히** 남았다 (touched 는 저장에도 실린다)
export function setTouched(x, y, z, on) {
  if (inside(x, y, z)) touched[idx(x, y, z)] = on ? 1 : 0;
}

export function refreshAllTops() {
  for (var x = 0; x < WX; x++) for (var z = 0; z < WZ; z++) refreshTop(x, z);
}

// **자연 바다가 있던 자리** (v110b) — 세계를 만들거나 불러올 때 한 번 찍는다.
// 액체가 "이 물은 바다인가" 를 물을 때 쓴다(`src/fluids.js` 의 `isSeaColumn`).
// 이게 없으면 지표에서 부은 물이 굴로 떨어질 때 **그 물기둥 자체가 수면까지 물이라**
// 바다로 읽혀 동굴이 통째로 잠긴다. 반대로 기둥만 보면 바다 위에 발판을 깐 순간
// 그 밑이 마른다. 바다는 **지형이 정한 자리**지 물이 어디까지 이어졌는가가 아니다.
export var seaCol = new Uint8Array(PLANE);
export function snapshotSeaCol() {
  for (var z = 0; z < WZ; z++) for (var x = 0; x < WX; x++) {
    var b = world[idx(x, SEA, z)];
    seaCol[z * WX + x] = (b === WATER || b === ICE) ? 1 : 0;
  }
}

export function hash2(x, y, seed) {
  var h = Math.imul(x | 0, 374761393) + Math.imul(y | 0, 668265263) + Math.imul(seed | 0, 1274126177);
  h = Math.imul(h ^ (h >>> 13), 1274126177);
  return ((h ^ (h >>> 16)) >>> 0) / 4294967295;
}
export function hash3(x, y, z, seed) {
  var h = Math.imul(x | 0, 374761393) + Math.imul(y | 0, 668265263) +
          Math.imul(z | 0, 1103515245) + Math.imul(seed | 0, 1274126177);
  h = Math.imul(h ^ (h >>> 13), 1274126177);
  return ((h ^ (h >>> 16)) >>> 0) / 4294967295;
}
export function smooth(t) { return t * t * (3 - 2 * t); }
export function lerp(a, b, t) { return a + (b - a) * t; }

export function noise2(x, y, seed) {
  var xi = Math.floor(x), yi = Math.floor(y);
  var xf = smooth(x - xi), yf = smooth(y - yi);
  var a = hash2(xi, yi, seed), b = hash2(xi + 1, yi, seed);
  var c = hash2(xi, yi + 1, seed), d = hash2(xi + 1, yi + 1, seed);
  return lerp(lerp(a, b, xf), lerp(c, d, xf), yf);
}
export function noise3(x, y, z, seed) {
  var xi = Math.floor(x), yi = Math.floor(y), zi = Math.floor(z);
  var xf = smooth(x - xi), yf = smooth(y - yi), zf = smooth(z - zi);
  var x00 = lerp(hash3(xi, yi, zi, seed), hash3(xi + 1, yi, zi, seed), xf);
  var x10 = lerp(hash3(xi, yi + 1, zi, seed), hash3(xi + 1, yi + 1, zi, seed), xf);
  var x01 = lerp(hash3(xi, yi, zi + 1, seed), hash3(xi + 1, yi, zi + 1, seed), xf);
  var x11 = lerp(hash3(xi, yi + 1, zi + 1, seed), hash3(xi + 1, yi + 1, zi + 1, seed), xf);
  return lerp(lerp(x00, x10, yf), lerp(x01, x11, yf), zf);
}

// 광석 깊이 사다리 — 지형 판을 따라간다. 시험도 여기를 읽는다 (숫자를 두 군데 적지 않는다).
export function oreCeil() {
  var deep = SEA > 11;
  return { dia: deep ? 8 : 7, gold: deep ? 14 : 11, iron: deep ? 20 : 16 };
}

// 용암이 고이는 높이 상한 — 지하 두께를 따라간다. 시험도 여기를 읽는다.
export function lavaTop() { return SEA > 11 ? 12 : 4; }

export function generate(seed, gen) {
  S.worldSeed = seed >>> 0;
  world.fill(AIR);
  shape.fill(SH_FULL);
  waterLvl.fill(0);
  touched.fill(0);
  seenMap.fill(0);          // 새 세계는 다시 흰 종이에서 시작한다
  resetQueues();
  var rng = makeRng(S.worldSeed);

  // 바이옴 임계값을 먼저 정한다 — 이 세계의 t 분포에서 30%·65% 지점.
  // 어느 시드든 설원/초원/사막이 대략 30/35/35 로 시작한다 (고정값은 55% 편중이 났다).
  var tSamples = new Float32Array(WX * WZ);
  for (var px2 = 0; px2 < WX; px2++)
    for (var pz2 = 0; pz2 < WZ; pz2++)
      tSamples[pz2 * WX + px2] = noise2(px2 * 0.022, pz2 * 0.022, S.worldSeed + 300);
  var tSorted = Array.prototype.slice.call(tSamples).sort(function (a, b) { return a - b; });
  var BIOME_LO = tSorted[Math.floor(tSorted.length * 0.30)];
  var BIOME_HI = tSorted[Math.floor(tSorted.length * 0.65)];

  // 새로 만드는 세계는 언제나 최신 지형 판이다 — 예전 판은 저장을 불러올 때만 선다.
  // 이 한 줄이 SEA 를 정하고, 아래 LIFT 가 지형 전체를 그만큼 위로 민다.
  // gen 을 주면 그 판으로 만든다 (시험이 예전 판과 견줄 때만 쓴다).
  setGen(gen || GEN_LATEST);
  var LIFT = seaLift();
  // 지표를 뚫고 나오는 굴 어귀의 문턱.
  // 깊은 판에서 0.638 까지 낮춰 봤지만 어귀가 178→189 로 거의 안 늘었다 —
  // 병목은 문턱이 아니라 **바로 아래 칸이 이미 뚫려 있어야 한다(carvedBelow)** 는 조건이다.
  // 지형을 흔들 값이 아니라 그대로 둔다. 대신 지도가 어귀를 표시한다 (자문 13차 #10).
  var SURF_CARVE = 0.66;

  for (var x = 0; x < WX; x++) {
    for (var z = 0; z < WZ; z++) {
      var dx = (x - WX / 2) / (WX / 2), dz = (z - WZ / 2) / (WZ / 2);
      var falloff = 1 - Math.min(1, Math.pow(Math.sqrt(dx * dx + dz * dz) * 1.14, 3.2));

      // 지형 유형 — 0 보통 · 1 평지 · 2 산악 · 3 군도
      var TT = S.terrain | 0;
      var amp = TT === 1 ? 0.34 : (TT === 2 ? 1.7 : 1);
      var base = TT === 1 ? 9 : (TT === 2 ? 4 : 5);
      if (TT === 3) falloff = Math.max(0, falloff *
        (0.45 + 0.85 * noise2(x * 0.028, z * 0.028, S.worldSeed + 4001)));

      var h = base
        + noise2(x * 0.045, z * 0.045, S.worldSeed) * 15 * amp
        + noise2(x * 0.11, z * 0.11, S.worldSeed + 91) * 5 * amp
        + noise2(x * 0.24, z * 0.24, S.worldSeed + 7) * 1.8;
      // 지형·바다를 통째로 LIFT 만큼 올린다 — 물속 깊이도 언덕 높이도 그대로고,
      // 늘어나는 것은 **기반암 위 돌의 두께**뿐이다 (지하 13칸 → 25칸)
      h = Math.floor(2 + h * falloff) + LIFT;
      if (h < 1 + LIFT) h = 1 + LIFT;
      heightMap[z * WX + x] = h;

      // 바이옴 — 큰 스케일 노이즈 + 고도 보정.
      // 임계값은 그 세계의 t 분포 백분위(30%·65%)다. 고정값(0.30/0.62)은 96칸 섬에
      // 노이즈 주기가 두 번밖에 안 들어가 시드에 따라 한 덩어리가 55% 를 먹었다.
      var t = noise2(x * 0.022, z * 0.022, S.worldSeed + 300);
      var biome = 0;
      if (t < BIOME_LO || h > 27 + LIFT) biome = 1;         // 설원 · 진짜 봉우리만 만년설
      else if (t > BIOME_HI && h <= 20 + LIFT) biome = 2;   // 사막
      biomeMap[z * WX + x] = biome;

      var surf = GRASS;
      if (h <= SEA + 1) surf = SAND;
      else if (biome === 1) surf = SNOW;
      else if (biome === 2) surf = SAND;

      var carvedBelow = false;
      for (var y = 0; y <= h; y++) {
        if (y === 0) { set(x, y, z, BEDROCK); carvedBelow = false; continue; }
        // 동굴 — 좁은 굴(고주파) · 넓은 방(저주파) · 세로로 갈라진 협곡
        var carve = false;
        if (y < h - 2) {
          if (noise3(x * 0.105, y * 0.17, z * 0.105, S.worldSeed + 55) > 0.635) carve = true;
          else if (y < h - 5 &&
              noise3(x * 0.042, y * 0.075, z * 0.042, S.worldSeed + 611) > 0.70) carve = true;
          else if (y > 2 && y < 26 + LIFT) {
            var rv = noise2(x * 0.030, z * 0.030, S.worldSeed + 877);
            if (rv > 0.815 && Math.abs(noise2(x * 0.11, z * 0.11, S.worldSeed + 878) - 0.5) < 0.14)
              carve = true;                               // 협곡
          }
        } else if (carvedBelow && h > SEA + 1) {
          // 지표 3칸은 **아래가 이미 뚫렸을 때만** 이어서 뚫는다 — 언덕 옆구리에 입이 벌어진다.
          // 이 조건이 없으면 굴은 어디에도 입구가 없어 아무 데나 파 내려가야 했다.
          if (noise3(x * 0.105, y * 0.17, z * 0.105, S.worldSeed + 55) > SURF_CARVE) carve = true;
        }
        if (carve) { carvedBelow = true; continue; }
        carvedBelow = false;

        var b;
        if (y === h) b = surf;
        else if (y > h - 4) b = (surf === SAND) ? SAND : DIRT;
        else b = STONE;
        set(x, y, z, b);
      }
      for (var w = h + 1; w <= SEA; w++) set(x, w, z, WATER);
    }
  }

  // 광맥 — 낱개로 흩뿌리지 않고 씨앗에서 랜덤워크로 뭉쳐 놓는다.
  // 하나 찾으면 주변을 파헤치게 되는, 마크식 채굴 보상 곡선.
  var c0 = oreCeil();
  var DEEP = LIFT > 0;
  var DIA_MAX = c0.dia, GOLD_MAX = c0.gold, IRON_MAX = c0.iron;
  // 다이아만 깊은 판에서 몫을 줄인다 — 시도 수를 그대로 둬도 세계당 11~27개가
  // 50~60개가 됐다(낮은 층이 통째로 돌이라 씨앗이 안 걸러진다).
  // 0.018 이면 30~40개 · 금의 3분의 1쯤이 되어 "귀한 순서" 가 눈에 보인다.
  var ROLL_DIA = DEEP ? 0.018 : 0.030, ROLL_GOLD = 0.095;
  var LAVA_TOP = lavaTop();
  function growVein(kind, sx0, sy0, sz0, size) {
    var cx = sx0, cy = sy0, cz = sz0, laid = 0;
    for (var s2 = 0; s2 < size * 4 && laid < size; s2++) {
      if (inside(cx, cy, cz) && get(cx, cy, cz) === STONE) {
        set(cx, cy, cz, kind);
        laid++;
      }
      var d2 = (rng() * 6) | 0;
      cx += DIRS[d2][0]; cy += DIRS[d2][1]; cz += DIRS[d2][2];
      if (cy < 1) cy = 1;
    }
    return laid;
  }
  // 시도 횟수는 **깊어져도 그대로 둔다.** 두 배로 올려 봤더니 세계당 다이아가
  // 11~27개에서 65~92개로 불어났다 — 깊은 판은 낮은 층이 통째로 단단한 돌이라
  // 씨앗이 거의 안 걸러진다(예전 판은 절반이 동굴·흙에 떨어져 버려졌다).
  // 시도를 그대로 두면 돌 부피가 1.8배인데 광석은 1.3~2.4배가 되어 균형이 맞는다.
  var veinTries = Math.round(WX * WZ * 0.055);
  for (var vi = 0; vi < veinTries; vi++) {
    var vx = (rng() * WX) | 0, vz = (rng() * WZ) | 0;
    var vTop = heightMap[vz * WX + vx] - 4;
    if (vTop < 3) continue;
    // 깊이에 따라 다른 광물이 난다 — 내려갈수록 보상이 커진다
    var roll = rng();
    var kind, vyMax, size;
    // 깊이 사다리도 지하 두께를 따라 늘어난다 — 예전 판(바다 11)에서는 7·11·16 그대로.
    // 새 판(바다 23)에서는 다이아 8 · 금 14 · 아이언 20 이라, 지표(25 언저리)에서
    // 내려가는 내내 나오는 것이 달라진다.
    if (roll < ROLL_DIA) { kind = DIAMOND; vyMax = Math.min(vTop, DIA_MAX);  size = 2 + ((rng() * 4) | 0); }
    else if (roll < ROLL_GOLD) { kind = GOLD; vyMax = Math.min(vTop, GOLD_MAX); size = 2 + ((rng() * 5) | 0); }
    else if (roll < 0.42)  { kind = IRON; vyMax = Math.min(vTop, IRON_MAX); size = 3 + ((rng() * 6) | 0); }
    else                   { kind = COAL; vyMax = vTop;                     size = 4 + ((rng() * 9) | 0); }
    if (vyMax < 2) continue;
    var vy = 1 + ((rng() * (vyMax - 1)) | 0);
    if (get(vx, vy, vz) !== STONE) continue;
    growVein(kind, vx, vy, vz, size);
  }
  // 다이아 보장 — 3% × 500회가 동굴·용암에 걸러져 0개인 시드가 있었다 (자문 3차 실측 10시드 중 1개).
  // 채굴 보상 곡선의 끝이 비면 깊이 7 아래로 내려갈 이유가 사라진다. 광맥 8개까지 채운다.
  var diaCount = 0;
  for (var di = 0; di < WX * WZ * (DIA_MAX + 1); di++) if (world[di] === DIAMOND) diaCount++;  // 다이아가 날 수 있는 층만 센다
  for (var dt = 0; dt < 600 && diaCount < 8; dt++) {
    var dx2 = (rng() * WX) | 0, dz2 = (rng() * WZ) | 0;
    var dy2 = 1 + ((rng() * DIA_MAX) | 0);
    if (get(dx2, dy2, dz2) !== STONE) continue;
    growVein(DIAMOND, dx2, dy2, dz2, 2 + ((rng() * 4) | 0));
    diaCount++;
  }

  // 다이아·금 광맥 하나쯤은 굴 벽에 드러나게 한다.
  // 실측: 세계당 다이아 11~25개 중 공기에 면한 것이 0~3개뿐이라, 굴을 아무리 걸어도
  // 눈에 보이는 보상이 없어 결국 y=5 에서 삽질을 하게 된다.
  function exposeVeins(kind, want) {
    var seen = 0, cand = [];
    for (var ey = 1; ey <= (DEEP ? 18 : 12); ey++)
      for (var ez = 1; ez < WZ - 1; ez++)
        for (var ex = 1; ex < WX - 1; ex++) {
          if (world[idx(ex, ey, ez)] !== kind) continue;
          var open = false;
          for (var ed = 0; ed < 6 && !open; ed++)
            if (get(ex + DIRS[ed][0], ey + DIRS[ed][1], ez + DIRS[ed][2]) === AIR) open = true;
          if (open) seen++; else cand.push([ex, ey, ez]);
        }
    // 굴 벽에 붙은 돌 한 칸을 걷어 광맥을 드러낸다 (광맥 자체는 그대로 둔다)
    for (var ci = 0; ci < cand.length && seen < want; ci++) {
      var c = cand[ci];
      for (var cd = 0; cd < 6; cd++) {
        var nx3 = c[0] + DIRS[cd][0], ny3 = c[1] + DIRS[cd][1], nz3 = c[2] + DIRS[cd][2];
        if (!inside(nx3, ny3, nz3) || ny3 < 1) continue;
        if (world[idx(nx3, ny3, nz3)] !== STONE) continue;
        // 그 돌 너머가 공기여야 굴 벽이다 — 통돌 한가운데를 파면 의미가 없다
        var fx = nx3 + DIRS[cd][0], fy = ny3 + DIRS[cd][1], fz = nz3 + DIRS[cd][2];
        if (!inside(fx, fy, fz) || get(fx, fy, fz) !== AIR) continue;
        set(nx3, ny3, nz3, AIR); seen++; break;
      }
    }
    return seen;
  }
  exposeVeins(DIAMOND, 6);
  exposeVeins(GOLD, 8);

  // ── 지하 위쪽을 채운다 (v80). 씨앗을 온 지도에 고르게 뿌리면 **바다 기둥이 68% 를 먹는다** —
  // 바다 밑은 얕아서(vTop 7~18) 씨앗이 전부 낮은 층에 떨어지고, 뭍 기둥의
  // 지표 아래 첫 15칸이 텅 빈 회색 돌이 됐다 (자문 13차: 석탄의 80% · 철의 82% 가 아래 12칸).
  // "내려갈수록 좋은 것" 이 아니라 "한참 아무것도 없다가 바닥에서 몰아서" 였다.
  //
  // **별도 난수 줄기**를 쓴다 — 위의 rng 를 이어 쓰면 호출 차례가 밀려
  // 나무·풀·오두막·바다 장식이 전부 달라진다 (v61·v75 교훈).
  if (DEEP) {
    var upRng = makeRng(S.worldSeed + 5150);
    var upLo = DIA_MAX + 1;                       // 다이아 천장 위 — 비어 있던 구간이 여기부터다
    var upTries = Math.round(WX * WZ * 0.075);
    for (var ut = 0; ut < upTries; ut++) {
      var ux = (upRng() * WX) | 0, uz = (upRng() * WZ) | 0;
      var uTop = heightMap[uz * WX + ux] - 4;
      if (uTop <= upLo + 2) continue;             // 바다 밑 기둥은 채울 위쪽이 없다
      var uy = upLo + ((upRng() * (uTop - upLo)) | 0);
      if (get(ux, uy, uz) !== STONE) continue;
      var uroll = upRng(), ukind, usize;
      if (uy <= GOLD_MAX && uroll < 0.10) { ukind = GOLD; usize = 2 + ((upRng() * 5) | 0); }
      else if (uy <= IRON_MAX && uroll < 0.45) { ukind = IRON; usize = 3 + ((upRng() * 6) | 0); }
      else { ukind = COAL; usize = 4 + ((upRng() * 9) | 0); }
      growVein(ukind, ux, uy, uz, usize);
    }
  }

  // 용암 웅덩이 — 세계 바닥의 동굴 바닥에 고인다. 지하 탐험의 유일한 시각 목표.
  for (var lx2 = 0; lx2 < WX; lx2++) {
    for (var lz2 = 0; lz2 < WZ; lz2++) {
      // 낮은 주파수 + 높은 임계값 = 드문드문한 "호수". 예전 값(0.09/0.52)은
      // 동굴 바닥의 절반을 용암으로 만들어 찾아내는 재미가 없었다.
      if (noise2(lx2 * 0.055, lz2 * 0.055, S.worldSeed + 900) < 0.74) continue;
      // 용암 띠도 지하 두께를 따라간다 (v80) — 1~4 로 못 박아 두면 판 2 에서
      // 지하가 26칸인데 용암은 4칸이라, 굴을 걸어도 오렌지빛이 안 보인다.
      // 블록광이 닿는 동굴 공기 비율이 34% 에서 18~25% 로 떨어져 있었다.
      // 판 1 과 같은 몫(지하의 31%)을 유지한다.
      for (var ly2 = 1; ly2 <= LAVA_TOP; ly2++) {
        if (get(lx2, ly2, lz2) !== AIR) continue;
        if (!isSolid(get(lx2, ly2 - 1, lz2))) continue;
        set(lx2, ly2, lz2, LAVA);
      }
    }
  }

  // 나무 — 사막에는 없고, 설원은 드물게
  for (var tx = 3; tx < WX - 3; tx++) {
    for (var tz = 3; tz < WZ - 3; tz++) {
      var tb = biomeMap[tz * WX + tx];
      // 숲 노이즈 — 섬 전체가 균일한 평원이라 나무가 세계당 4~71그루뿐이었다(자문 3차 실측).
      // 숲 덩어리에서는 밀도를 6배로 올려 "저쪽 숲으로 가자" 가 생기게 한다.
      var forest = noise2(tx * 0.06, tz * 0.06, S.worldSeed + 1200);
      var chance = tb === 2 ? 0 : (tb === 1 ? 0.010 : (forest > 0.56 ? 0.20 : 0.010));
      if (rng() > chance) continue;
      var th = heightMap[tz * WX + tx];
      var ground = get(tx, th, tz);
      if (th <= SEA + 1 || (ground !== GRASS && ground !== SNOW)) continue;
      // 줄기끼리 붙지 않게 — 반경 1. 반경 2 로 두면 5×5 당 한 그루가 상한이라
      // 숲 밀도를 아무리 올려도 나무가 늘지 않는다 (실측으로 확인)
      var tooClose = false;
      for (var ox = -1; ox <= 1 && !tooClose; ox++)
        for (var oz = -1; oz <= 1; oz++) {
          var ob = get(tx + ox, th + 1, tz + oz);
          if (isLog(ob)) { tooClose = true; break; }   // 가문비도 센다 (v97)
        }
      if (tooClose) continue;
      // 종류 — 설원은 가문비나무(짙은 잎·뾰족한 수형), 초원은 참나무와 자작나무가 섞인다
      var spruce = tb === 1;
      var birch = !spruce && rng() < 0.34;
      // 나무 모양은 tree.js 한 곳에만 둔다 — 묘목이 들어와도 같은 그림을 심는다.
      // rng 부르는 차례가 곧 시드다. 순서를 바꾸면 같은 시드가 다른 세계가 된다.
      growTree(tx, th, tz, spruce ? 2 : (birch ? 1 : 0),
               spruce ? SPRUCE_LOG : (birch ? BIRCH_LOG : LOG),
               spruce ? SPRUCE_LEAVES : (birch ? BIRCH_LEAVES : LEAVES),
               rng, get, set, AIR, WY);
    }
  }

  // 풀·꽃 — 스폰하고 고개를 들었을 때 "만들다 만 맵" 으로 보이지 않게 하는 것
  for (var px2 = 0; px2 < WX; px2++) {
    for (var pz2 = 0; pz2 < WZ; pz2++) {
      var ph = heightMap[pz2 * WX + px2];
      if (ph <= SEA + 1 || ph + 1 >= WY) continue;
      if (get(px2, ph, pz2) !== GRASS) continue;
      if (get(px2, ph + 1, pz2) !== AIR) continue;
      var pv = rng();
      if (pv < 0.50) { set(px2, ph + 1, pz2, TALLGRASS); continue; }
      // 꽃은 낱개로 흩뿌리지 않고 패치로 핀다 — 한 패치에는 한 종류만
      var fm = noise2(px2 * 0.13, pz2 * 0.13, S.worldSeed + 511);
      if (fm < 0.54) continue;
      if (rng() > (fm - 0.54) * 3.4) continue;
      var kind = noise2(px2 * 0.035, pz2 * 0.035, S.worldSeed + 733) < 0.5
        ? FLOWER_R : FLOWER_Y;
      set(px2, ph + 1, pz2, kind);
    }
  }

  // 버려진 오두막 — 세계에 "누가 있었다" 는 흔적을 남긴다.
  // 예전에는 8~10채가 **문·창·횃불 자리까지 전부 같았다.** 두 번째부터 알아보고
  // 세 번째부터는 안 들어간다 — 지어진 것을 보러 갈 이유가 그것뿐인데 복사본이었다.
  //
  // 난수를 따로 쓴다 — 여기서 뽑는 횟수가 달라지면 뒤따르는 풀·꽃·해변이
  // 모든 시드에서 밀린다 (v61·v75 교훈).
  if (!S.noHuts) buildHuts(makeRng(S.worldSeed + 7777));   // S.noHuts — 시험이 "오두막 없는 세계" 와 견준다

  // 사막의 선인장과 죽은 덤불 · 설원의 마른 풀 —
  // 초원에만 풀이 깔리면 나머지 바이옴이 상대적으로 더 "만들다 만 맵" 으로 보인다
  for (var dx2 = 1; dx2 < WX - 1; dx2++) {
    for (var dz2 = 1; dz2 < WZ - 1; dz2++) {
      var dh = heightMap[dz2 * WX + dx2];
      if (dh <= SEA + 1 || dh + 4 >= WY) continue;
      if (get(dx2, dh + 1, dz2) !== AIR) continue;
      var dbiome = biomeMap[dz2 * WX + dx2];
      var surf2 = get(dx2, dh, dz2);
      if (dbiome === 2 && surf2 === SAND) {
        var dv = rng();
        if (dv < 0.012) {                       // 선인장 — 2~3칸
          var tall = 2 + ((rng() * 2) | 0);
          for (var c2 = 1; c2 <= tall; c2++) set(dx2, dh + c2, dz2, CACTUS);
        } else if (dv < 0.06) {
          set(dx2, dh + 1, dz2, DEADBUSH);
        }
      } else if (dbiome === 1 && surf2 === SNOW) {
        if (rng() < 0.13) set(dx2, dh + 1, dz2, DRYGRASS);
      }
    }
  }

  // 생성 직후 모래·자갈을 미리 가라앉힌다 (동굴 천장에 떠 있지 않도록)
  for (var gx = 0; gx < WX; gx++) {
    for (var gz = 0; gz < WZ; gz++) {
      for (var gy = 2; gy < WY; gy++) {
        var gb = world[idx(gx, gy, gz)];
        if (gb !== SAND && gb !== GRAVEL) continue;
        var yy = gy;
        while (yy > 1) {
          var bi2 = idx(gx, yy - 1, gz);
          var below = world[bi2];
          if (below !== AIR && below !== WATER) break;
          // 물 밑 모래가 마른 동굴로 떨어지면 해저에 구멍이 뚫려 물이 공중에 남는다.
          // 근처를 한 칸이라도 편집하는 순간 갑자기 쏟아져 내린다 (자문 3차 실측 300~1,400칸).
          if (below === AIR && yy + 1 < WY && world[idx(gx, yy + 1, gz)] === WATER) break;
          world[idx(gx, yy, gz)] = below;     // 물이면 자리를 바꿔 위로 올린다
          world[bi2] = gb;
          yy--;
        }
      }
    }
  }

  // 해변 마감
  for (var sx = 0; sx < WX; sx++) for (var sz = 0; sz < WZ; sz++) {
    var sh = heightMap[sz * WX + sx];
    var sb = get(sx, sh, sz);
    if (sh === SEA + 1 && (sb === GRASS || sb === SNOW)) set(sx, sh, sz, SAND);
  }

  // 설원 수면은 언다 — 눈 덮인 해변에 열대 바다가 붙어 있지 않도록
  for (var ix2 = 0; ix2 < WX; ix2++) for (var iz2 = 0; iz2 < WZ; iz2++) {
    if (biomeMap[iz2 * WX + ix2] !== 1) continue;
    if (get(ix2, SEA, iz2) === WATER) set(ix2, SEA, iz2, ICE);
  }

  // ── 바다 — 지표 기둥의 63~80%가 바다인데 그 안에 볼 것이 없었다(자문 11차 실측).
  // 탑에 올라가면 눈에 들어오는 것의 3/4 가 균일한 파랑이다.
  // 세계를 키우지 않고 넓어 보이게 하는 가장 싼 방법이 여기에 눈길 붙일 것을 두는 것이다.
  //
  // **난수를 따로 쓴다.** 위의 rng 를 이어 쓰면 호출 차례가 밀려 기존 시드의 지형이
  // 전부 달라진다(v61 에서 배운 것). 이 줄기만 쓰는 별도 난수라 땅·동굴·나무는 그대로다.
  // S.noSeaDecor — 시험이 "장식을 뺀 세계" 와 견주려고 쓴다.
  // 이 줄기만 쓰는 별도 난수라, 껐다 켜도 땅·동굴·나무는 한 비트도 안 달라진다.
  if (!S.noSeaDecor) decorateSea(makeRng(S.worldSeed + 90210));

  // ── 버려진 갱도 — 지하에 "누가 있었다" 는 흔적을 남긴다.
  // v79 로 동굴 공기가 34,000~58,000칸이 됐는데 굴을 파고 내려가면 볼 것이 광맥뿐이었다.
  // 지상은 오두막(v76)이 그 자리를 채웠는데 지하는 비어 있었다.
  //
  // **난수를 따로 쓴다** — 위의 rng 를 이어 쓰면 호출 차례가 밀려 기존 시드의 땅이
  // 전부 달라진다 (v61·v75 교훈). S.noMines — 시험이 "갱도 없는 세계" 와 견준다.
  // 얕은 판(바다 11)에는 짓지 않는다 — 지하가 13칸뿐이라 통로를 놓을 자리가 없다.
  // ── 굴 어귀를 더 뚫는다. 지하가 3배가 됐는데(v79) 어귀는 그대로라
  // 굴 1,000칸당 어귀가 판 1 의 14~31개에서 2.4~5.2개로 떨어졌다 —
  // 들어갈 데도 나올 데도 없는 굴이 됐다.
  // 지표 카브 문턱(0.66)을 낮춰 봤지만 178→189 로 거의 안 늘었다 (v80 실측) —
  // 병목은 문턱이 아니라 **"바로 아래 칸이 이미 뚫려 있어야 한다"** 는 조건이다.
  // 그래서 아래에서 위로 뚫는 길을 따로 낸다. **별도 난수 줄기**를 쓴다.
  // 바위 노두 — 섬에 **세로**를 준다 (v105). 자문 23차 실측: 일곱 시드의 최고봉이
  // 해발 6~14칸, 뭍 평균 3~5칸이라 어느 시드로 찍어도 동심원 계단 팬케이크가 나왔다.
  // 실루엣에 절벽도 봉우리도 없어, 빛·물·하늘을 다 다듬어 놓고 **찍을 대상이 평평했다.**
  // heightMap 을 한 칸도 안 옮긴다 — 지표 **위에** 얹으므로 공유한 시드 링크가 그대로 열리고
  // 옛 저장도 그대로다. **별도 난수 줄기**를 쓴다 (기존 rng 를 이어 쓰면 모든 땅이 달라진다)
  if (!S.noBoulders) buildBoulders(makeRng(S.worldSeed + 48151));

  // 어귀와 갱도는 **노두 뒤**다 — 앞에 두면 노두가 굴 입구를 덮어
  // 걸어서 드나들 수가 없다 (v105 에서 시험이 잡았다)
  if (DEEP && !S.noMouths) openCaveMouths(makeRng(S.worldSeed + 24680));
  if (DEEP && !S.noMines) buildMines(makeRng(S.worldSeed + 31337));

  // 어귀·갱도가 밑동을 뚫어 **공중에 뜬 노두**를 걷는다 (v105).
  // 노두는 그 둘보다 먼저 서야 어귀가 바위를 뚫고 나오는데(안 그러면 입구를 덮는다),
  // 그러면 이번엔 굴이 바위 밑을 파낸다. 놓은 칸을 기억해 두었다가 **위에서 아래로**
  // 훑어 받침 없는 것을 걷는다
  if (boulderCells.length) {
    // **아래에서 위로** 훑는다 — 밑동이 걷히면 그 위도 줄줄이 걷혀야 한다.
    // 위부터 보면 그때는 아래가 아직 있어서 한 겹밖에 안 걷힌다
    // (맨 마지막 크로스 걷어내기가 같은 이유로 아래에서 위로 돈다)
    boulderCells.sort(function (a, b) { return a - b; });
    for (var bi2 = 0; bi2 < boulderCells.length; bi2++) {
      var bc2 = boulderCells[bi2];
      var by2 = (bc2 / PLANE) | 0, brem = bc2 - by2 * PLANE;
      var bz2 = (brem / WX) | 0, bx2 = brem - bz2 * WX;
      if (world[bc2] !== STONE && world[bc2] !== COBBLE) continue;
      if (by2 < 1) continue;
      if (!isSolid(world[idx(bx2, by2 - 1, bz2)])) set(bx2, by2, bz2, AIR);
    }
    boulderCells.length = 0;
  }

  // ── 받침을 잃은 풀·꽃·덤불·횃불을 걷어낸다. **생성기의 맨 마지막이어야 한다.**
  // 앞에 두면 그 뒤에 오는 것이 받침을 도로 빼 간다 —
  // 모래 가라앉히기가 사막 덤불의 모래를 내려앉히고(v79),
  // 뒤에 판 갱도가 앞선 갱도 횃불의 바닥을 뚫었다(v81).
  // 아래에서 위로 훑으므로 밑동이 사라지면 그 위 선인장까지 줄줄이 걷힌다.
  for (var cx3 = 0; cx3 < WX; cx3++) for (var cz3 = 0; cz3 < WZ; cz3++)
    for (var cy3 = 1; cy3 < WY; cy3++) {
      var ci3 = idx(cx3, cy3, cz3);
      var cb3 = world[ci3];
      // 선인장은 통짜 블록이지만 모래 위에만 서므로 같이 본다 (모래가 내려가면 뜬다)
      if (!isCross(cb3) && cb3 !== CACTUS) continue;
      var un3 = world[idx(cx3, cy3 - 1, cz3)];
      // 같은 것 위에 쌓이는 장식이 생기더라도 밑동부터 판정되어 줄줄이 걷힌다
      if (!isSolid(un3) && un3 !== cb3) set(cx3, cy3, cz3, AIR);
    }


  refreshAllTops();
  snapshotSeaCol();
}

// 갱도 한 줄기 — 통로 2칸 폭 · 3칸 높이. 조약돌 바닥에 울타리 기둥과 원목 들보,
// 버팀목마다 횃불. 마크의 폐광 실루엣을 새 블록 없이 있는 것만으로 만든다.
// 지표 아래에 있는 굴을 하늘로 이어 준다 — 언덕 옆구리에 입이 벌어진다.
// 위에서 아래로 파는 게 아니라 **이미 있는 굴을 찾아 그 위를 뚫는다** —
// 아무 데나 구멍을 내면 자연스럽지 않고, 굴과 안 이어지면 어귀가 아니다.
export var MOUTH_DEPTH = 14;
export var MOUTH_W = 2;                    // 입은 2칸 폭 — 1칸 우물은 걸어 못 나온다
function openCaveMouths(rng) {
  var made = 0, tries = 1500;
  for (var t = 0; t < tries && made < 220; t++) {
    var x = 4 + ((rng() * (WX - 9)) | 0), z = 4 + ((rng() * (WZ - 9)) | 0);
    var h = heightMap[z * WX + x];
    if (h <= SEA + 2 || h + 2 >= WY) continue;          // 뭍만
    if (get(x, h, z) === AIR) continue;                 // 이미 뚫린 자리
    // 지표 아래에서 굴을 찾는다
    var cave = -1;
    for (var d = 3; d <= MOUTH_DEPTH; d++) {
      var y = h - d;
      if (y < 2) break;
      if (get(x, y, z) === AIR) { cave = y; break; }
    }
    if (cave < 0) continue;
    // 비스듬히 올라간다 — **수직 우물이면 들어가면 걸어 못 나온다**
    // (실측 낙차 중앙값 7~9칸 · 최대 15칸 · 5칸 이상이 62~81%).
    // 두 칸에 한 칸씩 옆으로 밀어 계단처럼 만든다. 마크의 동굴 입구는
    // 비탈면에 비스듬히 열려서 걸어 들어가고 걸어 나온다.
    var dir = (rng() * 4) | 0;
    var ddx = [1, -1, 0, 0][dir], ddz = [0, 0, 1, -1][dir];
    var cells = [], cx = x, cz = z, ok = true;
    for (var uy = cave; uy <= h + 1 && ok; uy++) {
      if ((uy - cave) % 2 === 1 && uy > cave) { cx += ddx; cz += ddz; }
      for (var ox = 0; ox < MOUTH_W && ok; ox++)
        for (var oz = 0; oz < MOUTH_W; oz++) {
          var wx2 = cx + ox, wz2 = cz + oz;
          if (wx2 < 2 || wx2 >= WX - 2 || wz2 < 2 || wz2 >= WZ - 2) { ok = false; break; }
          var b2 = get(wx2, uy, wz2);
          // 기둥에 물·용암이 섞이면 그만둔다 — 어귀가 폭포나 용암 굴뚝이 되면 안 된다
          if (b2 === WATER || b2 === LAVA || b2 === ICE) { ok = false; break; }
          if (isUnbreakableGen(b2)) continue;
          cells.push(wx2, uy, wz2);
        }
      // 옆도 젖어 있으면 그만둔다
      for (var dd = 0; dd < 6 && ok; dd++) {
        var nb = get(cx + DIRS[dd][0], uy + DIRS[dd][1], cz + DIRS[dd][2]);
        if (nb === WATER || nb === LAVA) ok = false;
      }
    }
    if (!ok || !cells.length) continue;
    for (var ci = 0; ci < cells.length; ci += 3) set(cells[ci], cells[ci + 1], cells[ci + 2], AIR);
    made++;
  }
  return made;
}
function isUnbreakableGen(b) { return b === BEDROCK; }

// 통로는 **3칸 폭**이다 — 2칸이면 버팀목 기둥 둘이 폭을 통째로 막아 걸어갈 수가 없다.
// 마크의 폐광도 기둥 사이 가운데로 걷는다.
export var MINE_W = 3, MINE_H = 3;
// 갱도는 **꺾이고 층이 어긋나야** 갱도다 (v85).
// 곧은 복도 다섯 개였을 때는 만나서 신나게 걸어도 20초면 벽이었다 —
// 굽이도 갈래도 오르내림도, 다른 줄기와 만나는 일도 없었다.
// 안전 검사(`mineBoxOk`)는 **토막마다 그대로** 건다. 한 토막이라도 못 놓으면 거기서 끊는다.
function buildMines(rng) {
  var tries = 26;                       // 자리 조건이 까다로워 넉넉히 굴려 본다
  var built = 0;
  for (var t = 0; t < tries && built < 5; t++) {
    var axis = rng() < 0.5 ? 0 : 1;                 // 0 = X 를 따라 · 1 = Z 를 따라
    var y = 4 + ((rng() * Math.max(1, SEA - 10)) | 0);   // 지하 아래쪽~중간
    var x0 = 6 + ((rng() * (WX - 24)) | 0);
    var z0 = 6 + ((rng() * (WZ - 24)) | 0);
    if (carveShaft(rng, x0, y, z0, axis) > 0) built++;
  }
  return built;
}

// 한 줄기 — 토막 2~4개를 꺾어 잇는다. 토막마다 축을 바꾸고, 가끔 한 칸 오르내린다.
// branch — 갈래로 뻗은 줄기는 다시 갈라지지 않는다 (재귀 1단)
function carveShaft(rng, x, y, z, axis, branch) {
  var legs = 2 + ((rng() * 3) | 0);               // 2~4 토막
  var laid = 0;
  var lastBx = -1, lastBz = -1, lastAxis = axis, lastY = y, lastLen = 0;
  for (var g = 0; g < legs; g++) {
    var len = 10 + ((rng() * 12) | 0);            // 토막 10~21칸
    // 남쪽/동쪽으로만 뻗으면 한쪽으로 쏠린다 — 방향도 뽑는다
    var back = rng() < 0.45;
    var bx = x, bz = z;
    if (axis === 0 && back) bx = x - len + MINE_W;
    if (axis === 1 && back) bz = z - len + MINE_W;
    if (bx < 3 || bz < 3) break;
    if (!mineFits(bx, y, bz, axis, len)) break;   // 여기서 줄기를 끊는다
    carveMine(rng, bx, y, bz, axis, len);
    laid++;
    lastBx = bx; lastBz = bz; lastAxis = axis; lastY = y; lastLen = len;
    // 갈래 — 토막 중간에서 옆으로 한 줄기 더 뻗는다. 폐광은 갈라져야 폐광이다.
    // 실측: 줄기 다섯이 따로따로였고 통로 총연장 79~146칸(17~32초면 다 걷는다).
    if (!branch && rng() < 0.45) {
      var mid = (len >> 1);
      var jx = axis === 0 ? bx + mid : bx;
      var jz = axis === 0 ? bz : bz + mid;
      carveShaft(rng, jx, y, jz, axis ? 0 : 1, true);
    }
    // 다음 토막의 시작점 — 이 토막의 끝 언저리에서 축을 꺾는다
    if (axis === 0) { x = back ? bx : bx + len - MINE_W; }
    else { z = back ? bz : bz + len - MINE_W; }
    axis = axis ? 0 : 1;
    // 가끔 한 칸 오르내린다 — 층이 어긋나야 "저쪽은 뭐지" 가 생긴다
    if (rng() < 0.45) {
      var ny = y + (rng() < 0.5 ? -1 : 1);
      if (ny >= 4 && ny <= SEA - 6) y = ny;
    }
  }
  // 끝방은 **실제로 놓인 마지막 토막**에 단다.
  // `lastLeg` 를 계획한 토막 수로 정하던 때는 `mineFits` 실패로 줄기가 끊기면
  // 마지막 토막이 영영 안 와서, 세계당 방이 기대 3개 대비 0~2개(평균 1.25)였다.
  if (laid > 0 && !branch && lastBx >= 0)
    endRoom(rng, lastBx, lastY, lastBz, lastAxis, lastLen);
  return laid;
}

// 놓을 수 있는 자리인가 — **물·용암을 뚫으면 세계가 잠기고 되돌릴 사람이 없다.**
// 지표를 뚫어도 안 된다 (하늘이 뚫린 갱도는 갱도가 아니다).
// 상자 하나를 보는 함수로 두어 통로와 끝방이 **같은 잣대**를 쓴다 —
// 통로만 재고 방은 안 재면 방이 물속에 열린다.
function mineBoxOk(bx, y, bz, w, d) {
  for (var ax = -1; ax <= w; ax++)
    for (var az = -1; az <= d; az++) {
      var x = bx + ax, z = bz + az;
      if (x < 2 || x >= WX - 2 || z < 2 || z >= WZ - 2) return false;
      // heightMap 은 동굴을 파기 **전**의 지형 높이다. 지표가 카브로 꺼진 자리를
      // 헛짚지 않게 여유를 넉넉히 둔다 (생성 중에는 topMap 이 아직 낡았다).
      if (heightMap[z * WX + x] < y + MINE_H + 5) return false;
      for (var dy = -1; dy <= MINE_H + 1; dy++) {
        if (y + dy <= 0) return false;                 // 기반암을 안 판다
        var b = get(x, y + dy, z);
        if (b === WATER || b === LAVA || b === ICE) return false;
      }
    }
  return true;
}
function mineFits(x0, y, z0, axis, len) {
  return mineBoxOk(x0, y, z0, axis ? MINE_W : len, axis ? len : MINE_W);
}

function carveMine(rng, x0, y, z0, axis, len) {
  var plankFloor = rng() < 0.4;
  for (var s = 0; s < len; s++) {
    var frame = (s % (4 + ((s * 7) % 3))) === 0;    // 4~6칸마다 버팀목
    for (var w = 0; w < MINE_W; w++) {
      var x = axis ? x0 + w : x0 + s;
      var z = axis ? z0 + s : z0 + w;
      set(x, y - 1, z, plankFloor ? PLANKS : COBBLE);
      for (var dy = 0; dy < MINE_H; dy++) set(x, y + dy, z, AIR);
    }
    if (frame) {
      // 버팀목 — 양옆 기둥(울타리)과 그 위 들보(원목). 가운데는 비워 둔다.
      for (var f = 0; f < MINE_W; f++) {
        var fx = axis ? x0 + f : x0 + s;
        var fz = axis ? z0 + s : z0 + f;
        if (f === 0 || f === MINE_W - 1)
          for (var py2 = 0; py2 < MINE_H - 1; py2++) set(fx, y + py2, fz, FENCE);
        set(fx, y + MINE_H - 1, fz, LOG);
      }
      continue;
    }
    // 횃불 — 버팀목 사이에 서 있는 횃불. 멀리서도 "저기 뭔가 있다" 로 읽힌다.
    // 바닥에 세운다(받침이 조약돌 바닥이다) — 공중에 뜬 횃불은 만들지 않는다.
    if (s % 5 !== 2) continue;
    var mid = MINE_W >> 1;
    var tx = axis ? x0 + mid : x0 + s;
    var tz = axis ? z0 + s : z0 + mid;
    if (get(tx, y, tz) === AIR && isSolid(get(tx, y - 1, tz))) set(tx, y, tz, TORCH);
  }
}

// 끝방 — 줄기 끝에 붙는 방. 여기가 "끝까지 걸어가 볼 이유" 다.
// 5×5 가 안 되면 3×3 으로 물러선다 — 5×5 상자가 통로보다 훨씬 커서 자주 떨어졌다.
// 놓는 것도 하나가 아니라 두세 개 — 끝까지 걸어간 사람에게 주는 것이다.
// len — 토막의 길이. **끝에 붙여야 한다.**
// 길이를 안 받던 때는 방이 토막 **시작 언저리**(x0 + MINE_W)에 생겨,
// 통로 바닥을 조약돌로 다시 깔고 그 자리의 버팀목·횃불을 지웠다 —
// "끝까지 걸어가 볼 이유" 가 없어지고 모든 줄기가 맨 막다른 길로 끝났다.
function endRoom(rng, x0, y, z0, axis, len) {
  if (rng() >= 0.75) return false;
  // 끝 너머 · 끝 언저리 옆구리 두 쪽 — 세 자리를 5×5 · 3×3 으로 대 본다.
  // 끝 너머 하나만 보던 때는 자리가 안 나오는 시드에서 방이 0개였다.
  var sizes = [5, 3];
  for (var si = 0; si < sizes.length; si++) {
    var n = sizes[si];
    var off = (n - MINE_W) >> 1;
    var spots = axis
      ? [[x0 - off, z0 + len], [x0 + MINE_W, z0 + len - n], [x0 - n, z0 + len - n]]
      : [[x0 + len, z0 - off], [x0 + len - n, z0 + MINE_W], [x0 + len - n, z0 - n]];
    for (var sp = 0; sp < spots.length; sp++) {
    var rx = spots[sp][0], rz = spots[sp][1];
    if (!mineBoxOk(rx, y, rz, n, n)) continue;
    for (var ax = 0; ax < n; ax++)
      for (var az = 0; az < n; az++)
        for (var ay = -1; ay < MINE_H; ay++)
          set(rx + ax, y + ay, rz + az, ay === -1 ? COBBLE : AIR);
    var items = 2 + ((rng() * 2) | 0);
    for (var it = 0; it < items; it++) {
      var ix3 = rx + ((rng() * n) | 0), iz3 = rz + ((rng() * n) | 0);
      if (get(ix3, y, iz3) !== AIR) continue;
      var pick = rng();
      set(ix3, y, iz3, pick < 0.34 ? BOOKSHELF : (pick < 0.67 ? LAMP : CARPET));
    }
    var cx3 = rx + (n >> 1), cz3 = rz + (n >> 1);
    set(cx3, y + MINE_H - 1, cz3, LOG);
    if (get(cx3, y + MINE_H - 2, cz3) === AIR) set(cx3, y + MINE_H - 2, cz3, TORCH);
    return true;
    }
  }
  return false;
}

// 버려진 오두막 — 크기·재료·지붕·창·안에 놓인 것을 뽑아 채마다 다르게 짓는다.
// 바위 노두 하나 — 타원 덩어리를 지표 위에 얹는다 (v105)
export var BOULDER_MIN = 12, BOULDER_MAX = 20;
export var boulderCells = [];
function buildBoulders(rng) {
  boulderCells.length = 0;
  var want = BOULDER_MIN + ((rng() * (BOULDER_MAX - BOULDER_MIN + 1)) | 0);
  var made = 0;
  // 큰 봉우리는 **섬에서 가장 높은 뭍**에 세운다 — 낮은 자리에 세우면 실루엣이 안 산다.
  // 후보를 여럿 뽑아 그중 가장 높은 곳을 쓴다 (heightMap 전체를 훑을 이유는 없다)
  var peakX = -1, peakZ = -1, peakH = -1;
  for (var pk = 0; pk < 140; pk++) {
    var px3 = 8 + ((rng() * (WX - 16)) | 0), pz3 = 8 + ((rng() * (WZ - 16)) | 0);
    var qdx = px3 - WX / 2, qdz = pz3 - WZ / 2;
    if (qdx * qdx + qdz * qdz < 18 * 18) continue;       // 스폰 둘레는 비운다
    var ph3 = heightMap[pz3 * WX + px3];
    if (ph3 <= SEA + 2 || ph3 > peakH) { if (ph3 > peakH && ph3 > SEA + 2) { peakH = ph3; peakX = px3; peakZ = pz3; } }
  }
  for (var t = 0; t < want * 14 && made < want; t++) {
    var bx = 6 + ((rng() * (WX - 12)) | 0), bz = 6 + ((rng() * (WZ - 12)) | 0);
    if (made === 0 && peakX >= 0) { bx = peakX; bz = peakZ; }
    // 스폰 자리를 비켜 준다 (v105) — spawn() 이 세계 한가운데에서 나선으로 찾으므로,
    // 그 둘레에 바위를 세우면 **코앞이 벽인 채로 시작**한다 (v91 이 고친 그 장면이다)
    var cdx = bx - WX / 2, cdz = bz - WZ / 2;
    if (cdx * cdx + cdz * cdz < 18 * 18) continue;
    var base = heightMap[bz * WX + bx];
    if (base <= SEA + 1) continue;                       // 바다·물가는 건너뛴다
    var surf = world[idx(bx, base, bz)];
    if (surf !== GRASS && surf !== DIRT && surf !== SAND && surf !== SNOW && surf !== STONE) continue;
    // **세계마다 큰 봉우리 하나** — 실루엣에 세로를 주는 것은 결국 그 하나다.
    // 나머지는 3~5칸짜리 바위, 그중 가끔 6~8칸. 전부 같은 크기면 다시 팬케이크다
    var first = made === 0;
    var tall = rng() < 0.22;
    var h = first ? (11 + ((rng() * 6) | 0))
                  : (tall ? 6 + ((rng() * 3) | 0) : 3 + ((rng() * 3) | 0));
    var rx = first ? (3.0 + rng() * 1.6) : (1.6 + rng() * 1.8);
    var rz = first ? (3.0 + rng() * 1.6) : (1.6 + rng() * 1.8);
    var span = first ? 5 : 3;
    if (base + h + 2 >= WY) continue;
    // 자리가 평평해야 덩어리가 공중에 안 뜬다
    var flat = true;
    var fr = made === 0 ? 3 : 2;
    for (var qx = -fr; qx <= fr && flat; qx++)
      for (var qz = -fr; qz <= fr; qz++) {
        var hx2 = bx + qx, hz2 = bz + qz;
        if (hx2 < 0 || hx2 >= WX || hz2 < 0 || hz2 >= WZ) { flat = false; break; }
        if (Math.abs(heightMap[hz2 * WX + hx2] - base) > (made === 0 ? 3 : 2)) { flat = false; break; }
      }
    if (!flat) continue;
    // 설원은 돌, 사막은 사암 대신 조약돌 — 지금 팔레트로는 돌·조약돌 둘뿐이다
    var rock = rng() < 0.62 ? STONE : COBBLE;
    // **기둥 단위로** 아래부터 쌓는다 — 층 단위로 돌면서 가장자리를 뜯으면
    // 아래를 건너뛰고 위를 놓아 **공중에 뜬 돌**이 생긴다 (v105 에서 실제로 그랬다).
    // 높이는 가운데가 높고 가장자리가 낮다 — 기둥이 아니라 바위로 보이게
    for (var dx = -span; dx <= span; dx++)
      for (var dz = -span; dz <= span; dz++) {
        var nx2 = bx + dx, nz2 = bz + dz;
        if (nx2 < 1 || nx2 >= WX - 1 || nz2 < 1 || nz2 >= WZ - 1) continue;
        var e = (dx * dx) / (rx * rx) + (dz * dz) / (rz * rz);
        if (e > 1) continue;
        var colH = Math.round(h * (1 - e * 0.72));
        if (e > 0.55 && rng() < 0.45) colH -= 1 + ((rng() * 2) | 0);   // 가장자리를 뜯는다
        if (colH < 1) continue;
        // 그 칸의 **제 지표**에서 쌓는다 — 중심 높이만 쓰면 비탈에서 뜬다
        var g2 = heightMap[nz2 * WX + nx2];
        if (g2 <= SEA) continue;
        // 밑칸이 단단해야 얹는다 — 풀·물·동굴 입구 위에 쌓으면 그 받침이
        // 나중에(맨 마지막 크로스 걷어내기·물 채우기) 사라져 돌이 공중에 뜬다
        if (!isSolid(world[idx(nx2, g2, nz2)])) continue;
        for (var dy = 0; dy < colH; dy++) {
          var py2 = g2 + 1 + dy;
          if (py2 >= WY - 1) break;
          if (world[idx(nx2, py2, nz2)] !== AIR) break;   // 막히면 그 기둥은 거기까지
          set(nx2, py2, nz2, rock);
          boulderCells.push(idx(nx2, py2, nz2));
        }
      }
    made++;
  }
  return made;
}

function buildHuts(rng) {
  var tries = 40;
  for (var ht = 0; ht < tries; ht++) {
    var w = 5 + ((rng() * 4) | 0);          // 5~8칸
    var d = 5 + ((rng() * 3) | 0);          // 5~7칸
    var hgt = 3 + ((rng() * 2) | 0);        // 벽 3~4칸
    var hx = 8 + ((rng() * (WX - 12 - w)) | 0), hz = 8 + ((rng() * (WZ - 12 - d)) | 0);
    var hh = heightMap[hz * WX + hx];
    if (hh <= SEA + 2 || hh + hgt + 4 >= WY) continue;
    var flat = true;
    for (var cx2 = 0; cx2 < w && flat; cx2++)
      for (var cz2 = 0; cz2 < d; cz2++)
        if (Math.abs(heightMap[(hz + cz2) * WX + (hx + cx2)] - hh) > 2) { flat = false; break; }
    if (!flat) continue;

    // 재료 세 갈래 — 판자집 · 돌집 · 벽돌집
    var pick3 = rng();
    var wallB = pick3 < 0.45 ? PLANKS : (pick3 < 0.8 ? COBBLE : BRICK);
    var floorB = wallB === PLANKS ? PLANKS : COBBLE;
    var ruin = 0.05 + rng() * 0.22;         // 얼마나 무너졌나 (채마다 다르다)

    for (var wx2 = 0; wx2 < w; wx2++)
      for (var wz2 = 0; wz2 < d; wz2++) {
        var edge = wx2 === 0 || wz2 === 0 || wx2 === w - 1 || wz2 === d - 1;
        set(hx + wx2, hh, hz + wz2, floorB);
        if (!edge) continue;
        for (var wy2 = 1; wy2 <= hgt; wy2++) {
          if (rng() < ruin) continue;
          set(hx + wx2, hh + wy2, hz + wz2, wallB);
        }
      }

    // 문 — 네 벽 중 한 곳에 뚫는다
    var side = (rng() * 4) | 0;
    var dxp = side === 0 ? 1 + ((rng() * (w - 2)) | 0) : (side === 1 ? w - 1 : (side === 2 ? 1 + ((rng() * (w - 2)) | 0) : 0));
    var dzp = side === 1 ? 1 + ((rng() * (d - 2)) | 0) : (side === 3 ? 1 + ((rng() * (d - 2)) | 0) : (side === 2 ? d - 1 : 0));
    set(hx + dxp, hh + 1, hz + dzp, AIR);
    set(hx + dxp, hh + 2, hz + dzp, AIR);

    // 창 — 한두 개를 벽 가장자리에서 뽑는다
    var wins = 1 + ((rng() * 2) | 0);
    for (var wq = 0; wq < wins; wq++) {
      var ws = (rng() * 4) | 0;
      var wxp = ws === 1 ? w - 1 : (ws === 3 ? 0 : 1 + ((rng() * (w - 2)) | 0));
      var wzp = ws === 2 ? d - 1 : (ws === 0 ? 0 : 1 + ((rng() * (d - 2)) | 0));
      if (wxp === dxp && wzp === dzp) continue;              // 문 자리는 비켜 간다
      set(hx + wxp, hh + 2, hz + wzp, GLASS);
    }

    // 지붕 — 평지붕 · 통나무 · 반블록 처마 세 갈래
    var roofKind = (rng() * 3) | 0;
    var roofB = roofKind === 1 ? (wallB === PLANKS ? LOG : COBBLE) : wallB;
    for (var rx2 = -1; rx2 <= w; rx2++)
      for (var rz2 = -1; rz2 <= d; rz2++) {
        if (rng() < 0.10) continue;                          // 뚫린 지붕
        var outer = rx2 < 0 || rz2 < 0 || rx2 >= w || rz2 >= d;
        // 처마는 반블록으로 얹어 두께가 얇아 보이게
        set(hx + rx2, hh + hgt + 1, hz + rz2, roofB,
            (roofKind === 2 && outer) ? SH_SLAB : SH_FULL);
      }

    // 안에 놓인 것 — 채마다 다르다. 여기가 "들어가 볼 이유" 다.
    var ix2 = hx + 1 + ((rng() * Math.max(1, w - 2)) | 0);
    var iz2 = hz + 1 + ((rng() * Math.max(1, d - 2)) | 0);
    var inner = rng();
    if (inner < 0.30) set(ix2, hh + 1, iz2, BOOKSHELF);
    else if (inner < 0.55) set(ix2, hh + 1, iz2, CARPET);
    else if (inner < 0.75) set(ix2, hh + 1, iz2, LAMP);
    // 횃불도 자리를 뽑는다 — 예전에는 늘 같은 모서리였다
    var tx2 = hx + 1 + ((rng() * Math.max(1, w - 2)) | 0);
    var tz2 = hz + 1 + ((rng() * Math.max(1, d - 2)) | 0);
    if (get(tx2, hh + 1, tz2) === AIR) set(tx2, hh + 1, tz2, TORCH);
  }
}

// 바다 바닥을 다양하게 하고, 수면 위로 작은 바위섬·모래톱을 띄운다.
// 새 블록 없이 있는 것만 쓴다 — 물속 교차 쿼드(해초)는 물 면이 갈라져 보인다.
function decorateSea(rng) {
  // ① 해저 — 자갈·돌 무늬를 얼룩덜룩 깔아 잠수했을 때 바닥이 한 색이 아니게
  for (var x = 0; x < WX; x++) {
    for (var z = 0; z < WZ; z++) {
      var h = heightMap[z * WX + x];
      if (h >= SEA) continue;                       // 물 밑만
      var b = get(x, h, z);
      if (b !== SAND && b !== DIRT && b !== GRASS) continue;
      var m = noise2(x * 0.11, z * 0.11, S.worldSeed + 4242);
      if (m > 0.62 && rng() < 0.55) set(x, h, z, GRAVEL);
      else if (m < 0.34 && rng() < 0.35) set(x, h, z, STONE);
    }
  }
  // ② 작은 바위섬·모래톱 — 수평선을 끊어 준다. 섬 본체에서 떨어진 깊은 물에만.
  var tries = 90, made = 0;
  for (var t = 0; t < tries && made < 7; t++) {
    var cx = 6 + ((rng() * (WX - 12)) | 0);
    var cz = 6 + ((rng() * (WZ - 12)) | 0);
    var ch = heightMap[cz * WX + cx];
    if (ch > SEA - 3) continue;                     // 얕은 곳(본섬 주변)은 건너뛴다
    // 본섬과 붙지 않게 — 둘레 6칸에 뭍이 있으면 그만둔다
    var nearLand = false;
    for (var ox = -6; ox <= 6 && !nearLand; ox += 2)
      for (var oz = -6; oz <= 6; oz += 2) {
        var nx = cx + ox, nz = cz + oz;
        if (nx < 0 || nx >= WX || nz < 0 || nz >= WZ) continue;
        if (heightMap[nz * WX + nx] > SEA) { nearLand = true; break; }
      }
    if (nearLand) continue;
    var rad = 2 + ((rng() * 2) | 0);                // 반경 2~3
    var top = SEA + 1 + ((rng() * 2) | 0);          // 수면 위 1~2칸
    var rocky = rng() < 0.45;
    for (var dx = -rad; dx <= rad; dx++) {
      for (var dz = -rad; dz <= rad; dz++) {
        var d2 = dx * dx + dz * dz;
        if (d2 > rad * rad) continue;
        var ix = cx + dx, iz = cz + dz;
        if (ix < 1 || ix >= WX - 1 || iz < 1 || iz >= WZ - 1) continue;
        // 가장자리는 한 칸 낮게 — 네모난 판이 아니라 섬으로 보이게
        var ty = top - (d2 > (rad - 1) * (rad - 1) ? 1 : 0);
        var base = heightMap[iz * WX + ix];
        for (var yy = base; yy <= ty; yy++) {
          if (yy >= WY - 1) break;
          set(ix, yy, iz, rocky ? STONE : SAND);
        }
        // 물기둥을 걷어 낸다
        for (var wy = ty + 1; wy <= SEA + 3 && wy < WY; wy++)
          if (get(ix, wy, iz) === WATER) set(ix, wy, iz, AIR);
        heightMap[iz * WX + ix] = ty;
      }
    }
    // 식물은 심지 않는다 — 마른 덤불은 사막 것이라 "엉뚱한 바이옴의 식물" 이 된다.
    // 맨 바위·모래만으로도 수평선을 끊는 데는 충분하다.
    made++;
  }
}
