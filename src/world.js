// world.js — 월드 데이터 · 지형 생성
import { S } from "./state.js";
import { resetQueues } from "./queues.js";
import { DIRS, N, PLANE, SEA, WX, WY, WZ, idx, inside } from "./dims.js";
import { DOOR, doorFacing, doorOpen, AIR, BEDROCK, BIRCH_LEAVES, BIRCH_LOG, CACTUS, COAL, COBBLE, DEADBUSH, DIAMOND, DIRT, DRYGRASS, FENCE, FLOWER_R, FLOWER_Y, GATE, GLASS, GOLD, GRASS, GRAVEL, ICE, IRON, LADDER, LAVA, LEAVES, LOG, PANE, PLANKS, SAND, SHAPE_BOXES, SH_FULL, SNOW, SPRUCE_LEAVES, STONE, TALLGRASS, TORCH, WALL_DIR, WATER, connectsTo, isCross, isSolid } from "./blocks.js";
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
export function set(x, y, z, b) {
  if (inside(x, y, z)) { var i = idx(x, y, z); world[i] = b; shape[i] = SH_FULL; }
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
  if (!isSolid(get(x, y, z))) return 0;
  var boxes = SHAPE_BOXES[shapeAt(x, y, z)] || SHAPE_BOXES[SH_FULL];
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
  return b === FENCE || b === PANE || b === GATE || b === DOOR || b === LADDER;
}
// 충돌·조준·메싱이 함께 쓰는 단일 진입점
export function boxesAt(b, sh, x, y, z) {
  if (hasDynamicBoxes(b)) return dynamicBoxes(b, x, y, z);
  return SHAPE_BOXES[sh] || SHAPE_BOXES[SH_FULL];
}

// 사람이 손댄 칸을 기억한다 — 날씨·자동 변화가 건축물을 건드리지 않게
export var touched = new Uint8Array(N);
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

export function generate(seed) {
  S.worldSeed = seed >>> 0;
  world.fill(AIR);
  shape.fill(SH_FULL);
  waterLvl.fill(0);
  touched.fill(0);
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
      h = Math.floor(2 + h * falloff);
      if (h < 1) h = 1;
      heightMap[z * WX + x] = h;

      // 바이옴 — 큰 스케일 노이즈 + 고도 보정.
      // 임계값은 그 세계의 t 분포 백분위(30%·65%)다. 고정값(0.30/0.62)은 96칸 섬에
      // 노이즈 주기가 두 번밖에 안 들어가 시드에 따라 한 덩어리가 55% 를 먹었다.
      var t = noise2(x * 0.022, z * 0.022, S.worldSeed + 300);
      var biome = 0;
      if (t < BIOME_LO || h > 27) biome = 1;         // 설원 · 진짜 봉우리만 만년설
      else if (t > BIOME_HI && h <= 20) biome = 2;   // 사막
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
          else if (y > 2 && y < 26) {
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
  var veinTries = Math.round(WX * WZ * 0.055);   // 총 광석량은 이전과 비슷하게 유지
  for (var vi = 0; vi < veinTries; vi++) {
    var vx = (rng() * WX) | 0, vz = (rng() * WZ) | 0;
    var vTop = heightMap[vz * WX + vx] - 4;
    if (vTop < 3) continue;
    // 깊이에 따라 다른 광물이 난다 — 내려갈수록 보상이 커진다
    var roll = rng();
    var kind, vyMax, size;
    if (roll < 0.030) { kind = DIAMOND; vyMax = Math.min(vTop, 7);  size = 2 + ((rng() * 4) | 0); }
    else if (roll < 0.095) { kind = GOLD; vyMax = Math.min(vTop, 11); size = 2 + ((rng() * 5) | 0); }
    else if (roll < 0.42)  { kind = IRON; vyMax = Math.min(vTop, 16); size = 3 + ((rng() * 6) | 0); }
    else                   { kind = COAL; vyMax = vTop;               size = 4 + ((rng() * 9) | 0); }
    if (vyMax < 2) continue;
    var vy = 1 + ((rng() * (vyMax - 1)) | 0);
    if (get(vx, vy, vz) !== STONE) continue;
    growVein(kind, vx, vy, vz, size);
  }
  // 다이아 보장 — 3% × 500회가 동굴·용암에 걸러져 0개인 시드가 있었다 (자문 3차 실측 10시드 중 1개).
  // 채굴 보상 곡선의 끝이 비면 깊이 7 아래로 내려갈 이유가 사라진다. 광맥 8개까지 채운다.
  var diaCount = 0;
  for (var di = 0; di < WX * WZ * 7; di++) if (world[di] === DIAMOND) diaCount++;   // y 0~6 층만 센다
  for (var dt = 0; dt < 600 && diaCount < 8; dt++) {
    var dx2 = (rng() * WX) | 0, dz2 = (rng() * WZ) | 0;
    var dy2 = 1 + ((rng() * 6) | 0);
    if (get(dx2, dy2, dz2) !== STONE) continue;
    growVein(DIAMOND, dx2, dy2, dz2, 2 + ((rng() * 4) | 0));
    diaCount++;
  }

  // 다이아·금 광맥 하나쯤은 굴 벽에 드러나게 한다.
  // 실측: 세계당 다이아 11~25개 중 공기에 면한 것이 0~3개뿐이라, 굴을 아무리 걸어도
  // 눈에 보이는 보상이 없어 결국 y=5 에서 삽질을 하게 된다.
  function exposeVeins(kind, want) {
    var seen = 0, cand = [];
    for (var ey = 1; ey <= 12; ey++)
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
      var logB = birch ? BIRCH_LOG : LOG;
      var leafB = spruce ? SPRUCE_LEAVES : (birch ? BIRCH_LEAVES : LEAVES);
      var trunk = spruce ? 5 + Math.floor(rng() * 3)
                : (birch ? 5 + Math.floor(rng() * 3) : 4 + Math.floor(rng() * 3));
      if (th + trunk + 4 >= WY) continue;
      var crown = th + trunk;
      if (spruce) {
        // 아래로 갈수록 넓어지는 원뿔
        for (var sy = 0; sy <= 4; sy++) {
          var srad = sy >= 3 ? 0 : (sy >= 1 ? 1 : 2);
          for (var sx2 = -srad; sx2 <= srad; sx2++)
            for (var sz2 = -srad; sz2 <= srad; sz2++) {
              if (Math.abs(sx2) === srad && Math.abs(sz2) === srad && srad > 1) continue;
              var cy2 = crown - 2 + sy;
              if (get(tx + sx2, cy2, tz + sz2) === AIR) set(tx + sx2, cy2, tz + sz2, leafB);
            }
        }
      } else {
        for (var ly = -2; ly <= 1; ly++) {
          var rad = (ly >= 0) ? 1 : 2;
          for (var lx = -rad; lx <= rad; lx++) {
            for (var lz = -rad; lz <= rad; lz++) {
              if (Math.abs(lx) === rad && Math.abs(lz) === rad && rng() < 0.65) continue;
              if (get(tx + lx, crown + ly, tz + lz) === AIR) set(tx + lx, crown + ly, tz + lz, leafB);
            }
          }
        }
      }
      for (var k = 1; k <= trunk; k++) set(tx, th + k, tz, logB);
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

  // 버려진 오두막 — 세계에 "누가 있었다" 는 흔적을 남긴다
  var hutTries = 40;
  for (var ht = 0; ht < hutTries; ht++) {
    var hx = 8 + ((rng() * (WX - 20)) | 0), hz = 8 + ((rng() * (WZ - 20)) | 0);
    var hh = heightMap[hz * WX + hx];
    if (hh <= SEA + 2 || hh + 7 >= WY) continue;
    // 바닥이 고른지 본다
    var flat = true;
    for (var cx2 = 0; cx2 < 6 && flat; cx2++)
      for (var cz2 = 0; cz2 < 6; cz2++)
        if (Math.abs(heightMap[(hz + cz2) * WX + (hx + cx2)] - hh) > 2) { flat = false; break; }
    if (!flat) continue;

    var wallB = rng() < 0.5 ? PLANKS : COBBLE;
    for (var wx2 = 0; wx2 < 6; wx2++)
      for (var wz2 = 0; wz2 < 6; wz2++) {
        var edge = wx2 === 0 || wz2 === 0 || wx2 === 5 || wz2 === 5;
        set(hx + wx2, hh, hz + wz2, PLANKS);                       // 바닥
        if (!edge) continue;
        for (var wy2 = 1; wy2 <= 3; wy2++) {
          if (rng() < 0.16) continue;                              // 무너진 자리
          set(hx + wx2, hh + wy2, hz + wz2, wallB);
        }
      }
    // 문 자리와 창
    set(hx + 2, hh + 1, hz, AIR); set(hx + 2, hh + 2, hz, AIR);
    set(hx + 4, hh + 2, hz, GLASS); set(hx, hh + 2, hz + 3, GLASS);
    // 지붕
    for (var rx2 = -1; rx2 <= 6; rx2++)
      for (var rz2 = -1; rz2 <= 6; rz2++)
        if (rng() > 0.12) set(hx + rx2, hh + 4, hz + rz2, wallB === PLANKS ? LOG : COBBLE);
    // 안에 횃불 하나
    set(hx + 1, hh + 1, hz + 1, TORCH);
  }

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

  refreshAllTops();
}
