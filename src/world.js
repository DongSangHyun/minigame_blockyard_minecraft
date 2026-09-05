// world.js — 월드 데이터 · 지형 생성
import { S } from "./state.js";
import { resetQueues } from "./queues.js";
import { DIRS, N, PLANE, SEA, WX, WY, WZ, idx, inside } from "./dims.js";
import { AIR, BEDROCK, CACTUS, COAL, DEADBUSH, DIRT, DRYGRASS, FLOWER_R, FLOWER_Y, GRASS, GRAVEL, ICE, IRON, LAVA, LEAVES, LOG, SAND, SHAPE_BOXES, SH_FULL, SNOW, STONE, TALLGRASS, WATER, isCross, isSolid } from "./blocks.js";
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
  resetQueues();
  var rng = makeRng(S.worldSeed);

  for (var x = 0; x < WX; x++) {
    for (var z = 0; z < WZ; z++) {
      var dx = (x - WX / 2) / (WX / 2), dz = (z - WZ / 2) / (WZ / 2);
      var falloff = 1 - Math.min(1, Math.pow(Math.sqrt(dx * dx + dz * dz) * 1.14, 3.2));

      var h = 5
        + noise2(x * 0.045, z * 0.045, S.worldSeed) * 15
        + noise2(x * 0.11, z * 0.11, S.worldSeed + 91) * 5
        + noise2(x * 0.24, z * 0.24, S.worldSeed + 7) * 1.8;
      h = Math.floor(2 + h * falloff);
      if (h < 1) h = 1;
      heightMap[z * WX + x] = h;

      // 바이옴 — 큰 스케일 노이즈 + 고도 보정
      var t = noise2(x * 0.022, z * 0.022, S.worldSeed + 300);
      var biome = 0;
      if (t < 0.36 || h > 25) biome = 1;         // 설원 · 진짜 봉우리만 만년설
      else if (t > 0.68 && h <= 18) biome = 2;   // 사막
      biomeMap[z * WX + x] = biome;

      var surf = GRASS;
      if (h <= SEA + 1) surf = SAND;
      else if (biome === 1) surf = SNOW;
      else if (biome === 2) surf = SAND;

      for (var y = 0; y <= h; y++) {
        if (y === 0) { set(x, y, z, BEDROCK); continue; }
        if (y < h - 2 && noise3(x * 0.105, y * 0.17, z * 0.105, S.worldSeed + 55) > 0.635) continue;

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
    var isIron = rng() < 0.38;
    var vyMax = isIron ? Math.min(vTop, 14) : vTop;
    if (vyMax < 2) continue;
    var vy = 1 + ((rng() * (vyMax - 1)) | 0);
    if (get(vx, vy, vz) !== STONE) continue;
    growVein(isIron ? IRON : COAL, vx, vy, vz,
             isIron ? (3 + ((rng() * 6) | 0)) : (4 + ((rng() * 9) | 0)));
  }

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
      var chance = tb === 2 ? 0 : (tb === 1 ? 0.006 : 0.018);
      if (rng() > chance) continue;
      var th = heightMap[tz * WX + tx];
      var ground = get(tx, th, tz);
      if (th <= SEA + 1 || (ground !== GRASS && ground !== SNOW)) continue;
      var trunk = 4 + Math.floor(rng() * 3);
      if (th + trunk + 3 >= WY) continue;
      var crown = th + trunk;
      for (var ly = -2; ly <= 1; ly++) {
        var rad = (ly >= 0) ? 1 : 2;
        for (var lx = -rad; lx <= rad; lx++) {
          for (var lz = -rad; lz <= rad; lz++) {
            if (Math.abs(lx) === rad && Math.abs(lz) === rad && rng() < 0.65) continue;
            if (get(tx + lx, crown + ly, tz + lz) === AIR) set(tx + lx, crown + ly, tz + lz, LEAVES);
          }
        }
      }
      for (var k = 1; k <= trunk; k++) set(tx, th + k, tz, LOG);
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
