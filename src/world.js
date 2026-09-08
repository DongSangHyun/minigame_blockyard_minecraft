// world.js — 월드 데이터 · 지형 생성
import { S } from "./state.js";
import { growTree } from "./tree.js";
import { resetQueues } from "./queues.js";
import { DIRS, N, PLANE, SEA, GEN_LATEST, setGen, seaLift, WX, WY, WZ, idx, inside } from "./dims.js";
import { DOOR, doorFacing, doorOpen, AIR, BEDROCK, BIRCH_LEAVES, BIRCH_LOG, CACTUS, COAL, COBBLE, DEADBUSH, DIAMOND, DIRT, DRYGRASS, FENCE, FLOWER_R, FLOWER_Y, GATE, GLASS, GOLD, GRASS, GRAVEL, ICE, IRON, LADDER, LAMP, LAVA, LEAVES, LOG, PANE, PLANKS, SAND, BRICK, BOOKSHELF, CARPET, SH_SLAB, SHAPE_BOXES, SH_FULL, SH_STAIR_N, SH_STAIR_E, SH_STAIR_S, SH_STAIR_W, SH_STAIR_NU, SH_STAIR_EU, SH_STAIR_SU, SH_STAIR_WU, isStairShape, SNOW, SPRUCE_LEAVES, STONE, TALLGRASS, TORCH, WALL_DIR, WATER, connectsTo, isCross, isSolid } from "./blocks.js";
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
  if (b === CARPET) {
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
  if (b === LADDER) {
    var d = WALL_DIR[shape[idx(x, y, z)]] || [0, 0, -1];
    if (d[0]) return _dynBoxes.push(d[0] > 0 ? [0.86, 0, 0, 1, 1, 1] : [0, 0, 0, 0.14, 1, 1]), _dynBoxes;
    return _dynBoxes.push(d[2] > 0 ? [0, 0, 0.86, 1, 1, 1] : [0, 0, 0, 1, 1, 0.14]), _dynBoxes;
  }
  return null;
}
export function hasDynamicBoxes(b) {
  return b === FENCE || b === PANE || b === GATE || b === DOOR || b === LADDER || b === CARPET;
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

export var SEEN_TOP = 1, SEEN_UNDER = 2;
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
// 지도장이 과제는 "걸어서 밝힌 지상" 만 센다 — 굴만 파고 다녀서 받는 상이 아니다
export function seenRatio() {
  var n = 0;
  for (var i = 0; i < seenMap.length; i++) if (seenMap[i] & SEEN_TOP) n++;
  return n / seenMap.length;
}

export function markTouched(x, y, z) {
  if (inside(x, y, z)) touched[idx(x, y, z)] = 1;
}
export function isTouched(x, y, z) {
  return inside(x, y, z) ? touched[idx(x, y, z)] === 1 : false;
}

export function refreshAllTops() {
  for (var x = 0; x < WX; x++) for (var z = 0; z < WZ; z++) refreshTop(x, z);
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
          if (noise3(x * 0.105, y * 0.17, z * 0.105, S.worldSeed + 55) > 0.66) carve = true;
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

  // 용암 웅덩이 — 세계 바닥의 동굴 바닥에 고인다. 지하 탐험의 유일한 시각 목표.
  for (var lx2 = 0; lx2 < WX; lx2++) {
    for (var lz2 = 0; lz2 < WZ; lz2++) {
      // 낮은 주파수 + 높은 임계값 = 드문드문한 "호수". 예전 값(0.09/0.52)은
      // 동굴 바닥의 절반을 용암으로 만들어 찾아내는 재미가 없었다.
      if (noise2(lx2 * 0.055, lz2 * 0.055, S.worldSeed + 900) < 0.74) continue;
      for (var ly2 = 1; ly2 <= 4; ly2++) {
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
          if (ob === LOG || ob === BIRCH_LOG) { tooClose = true; break; }
        }
      if (tooClose) continue;
      // 종류 — 설원은 가문비나무(짙은 잎·뾰족한 수형), 초원은 참나무와 자작나무가 섞인다
      var spruce = tb === 1;
      var birch = !spruce && rng() < 0.34;
      // 나무 모양은 tree.js 한 곳에만 둔다 — 묘목이 들어와도 같은 그림을 심는다.
      // rng 부르는 차례가 곧 시드다. 순서를 바꾸면 같은 시드가 다른 세계가 된다.
      growTree(tx, th, tz, spruce ? 2 : (birch ? 1 : 0),
               birch ? BIRCH_LOG : LOG,
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

  // 가라앉힌 뒤 받침을 잃은 풀·꽃·덤불을 걷어낸다.
  // 동굴이 지표를 뚫은 자리에서는 장식을 얹은 **뒤에** 모래가 내려앉아,
  // 얹혔던 것이 허공에 남는다 (시드 99999 에서 죽은 덤불 3개).
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

  refreshAllTops();
}

// 버려진 오두막 — 크기·재료·지붕·창·안에 놓인 것을 뽑아 채마다 다르게 짓는다.
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
