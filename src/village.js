// village.js — 시작 마을. 세계를 켜면 **이미 누가 살고 있는 자리**에서 시작한다.
//
// 왜 만드나: 지금까지 이 게임은 "빈 섬에 혼자 떨어지는" 시작이었다. 오두막 3~6채가
// 섬 어딘가에 흩어져 있지만 스폰 자리에서는 안 보이고, 갱도는 지하 어딘가라 못 찾는다.
// 처음 켜는 사람(특히 아이)에게 첫 화면은 **할 일이 보이는 자리**여야 한다 —
// 집·나무·동물·상인·광산 입구·개울이 한눈에 들어오면 첫 30초에 물어볼 것이 생긴다.
//
// 규칙 셋:
//  1. **별도 난수 줄기**를 쓴다 (v61·v75·v81 교훈) — 기존 시드의 땅이 한 비트도 안 밀린다.
//  2. `heightMap` 을 안 고친다. 광장은 지표 **위에** 얹고 파낸다.
//  3. 생성기 안에서만 돈다 — `set()` 으로 직접 쓰고, 끝나면 생성기가 톱맵을 다시 잰다.
import { SEA, WX, WY, WZ, idx } from "./dims.js";
import { S } from "./state.js";
import { AIR, BOOKSHELF, BRICK, CARPET0, COBBLE, DIRT, DOOR, FENCE, FLOWER_R, FLOWER_Y, LAVA, FRAME, GATE, GLASS, GRASS, GRAVEL, LADDER, LAMP, LEAVES, LOG, PLANKS, POT, SAND, SAPLING, SH_FULL, SH_SLAB, STAINED0, STONEBRICK, TALLGRASS, TORCH, WATER, WOOL0, doorShapeFor, isSolid, wallShapeFor } from "./blocks.js";
import { heightMap, set, world } from "./world.js";

// 마을이 놓인 자리 — 스폰·동물·상인이 이 값을 본다 (생성기가 채운다)
export var village = null;

function fill(x0, y0, z0, x1, y1, z1, b, sh) {
  for (var y = y0; y <= y1; y++)
    for (var z = z0; z <= z1; z++)
      for (var x = x0; x <= x1; x++) {
        if (x < 0 || z < 0 || y < 1 || x >= WX || z >= WZ || y >= WY) continue;
        set(x, y, z, b, sh || SH_FULL);
      }
}

// 광장 자리 고르기 — 세계 한가운데에서 나선으로, 바다에서 넉넉히 뜬 평평한 곳.
// 못 찾으면 가운데를 깎아서라도 만든다. **첫 화면은 시드 운에 맡기지 않는다.**
function pickSite(rng, half) {
  var cx = WX >> 1, cz = WZ >> 1;
  var best = null, bestScore = -1e9;
  for (var r = 0; r <= 22; r += 2) {
    for (var a = 0; a < 12; a++) {
      var ang = (a / 12) * Math.PI * 2 + rng() * 0.4;
      var x = Math.round(cx + Math.cos(ang) * r);
      var z = Math.round(cz + Math.sin(ang) * r);
      if (x - half < 3 || z - half < 3 || x + half >= WX - 3 || z + half >= WZ - 3) continue;
      var lo = 999, hi = -999, sum = 0, n = 0;
      for (var dx = -half; dx <= half; dx += 2)
        for (var dz = -half; dz <= half; dz += 2) {
          var h = heightMap[(z + dz) * WX + (x + dx)];
          if (h < lo) lo = h;
          if (h > hi) hi = h;
          sum += h; n++;
        }
      var avg = sum / n;
      if (avg <= SEA + 1) continue;                    // 물속에는 안 짓는다
      // 평평할수록 · 가운데에 가까울수록 · 바다에서 너무 높지 않을수록 좋다
      var score = -(hi - lo) * 3 - r * 0.5 - Math.abs(avg - (SEA + 4)) * 0.8;
      if (score > bestScore) { bestScore = score; best = [x, z, Math.round(avg)]; }
    }
    if (best && bestScore > -8) break;                 // 충분히 좋으면 더 안 찾는다
  }
  if (!best) best = [cx, cz, Math.max(SEA + 3, heightMap[cz * WX + cx])];
  // **해수면 바로 위로 못 박는다** — 개울의 수면이 SEA 라, 광장이 높으면 마을 옆에
  // 개울이 아니라 협곡이 생긴다. 4칸 위면 다리에서 물이 내려다보인다
  best[2] = Math.max(SEA + 3, Math.min(SEA + 5, best[2]));
  return best;
}

// 광장을 깎고 메운다 — 위는 비우고 아래는 흙으로 채운다
function levelPlaza(x0, z0, x1, z1, h) {
  for (var z = z0; z <= z1; z++)
    for (var x = x0; x <= x1; x++) {
      if (x < 1 || z < 1 || x >= WX - 1 || z >= WZ - 1) continue;
      for (var y = h + 1; y <= h + 12; y++) set(x, y, z, AIR);      // 머리 위를 튼다
      set(x, h, z, GRASS);
      for (var y2 = h - 1; y2 >= h - 3; y2--) {
        if (!isSolid(world[idx(x, y2, z)])) set(x, y2, z, DIRT);    // 발밑을 메운다
      }
    }
}

// 광장 둘레 — 밖으로 갈수록 한 칸씩 높아지는 테를 둘러 **깎은 자국**을 지운다.
// 안 두르면 27×27 을 파낸 자리가 수직 절벽으로 서서 "누가 파낸 구덩이" 로 보인다
function bowlRim(cx, cz, half, h) {
  for (var r = 1; r <= 5; r++) {
    var top = h + r;
    for (var x = cx - half - r; x <= cx + half + r; x++)
      for (var z = cz - half - r; z <= cz + half + r; z++) {
        if (x < 1 || z < 1 || x >= WX - 1 || z >= WZ - 1) continue;
        var ring = Math.max(Math.abs(x - cx) - half, Math.abs(z - cz) - half);
        if (ring !== r) continue;
        for (var y = top + 1; y <= h + 14; y++) set(x, y, z, AIR);   // 위로 솟은 것만 깎는다
        if (!isSolid(world[idx(x, top, z)]) && isSolid(world[idx(x, top - 1, z)]))
          set(x, top, z, GRASS);
      }
  }
}

// 집 한 채 — 문·창·지붕·안의 살림. 벽 재료만 바꾸면 다른 집이 된다.
function buildHouse(rng, x, z, w, d, h, wall, roof) {
  var floorB = wall === PLANKS ? PLANKS : COBBLE;
  fill(x, h, z, x + w - 1, h, z + d - 1, floorB);
  for (var wx = 0; wx < w; wx++)
    for (var wz = 0; wz < d; wz++) {
      var edge = wx === 0 || wz === 0 || wx === w - 1 || wz === d - 1;
      if (!edge) { fill(x + wx, h + 1, z + wz, x + wx, h + 3, z + wz, AIR); continue; }
      for (var wy = 1; wy <= 3; wy++) set(x + wx, h + wy, z + wz, wall);
      // 모서리는 원목 기둥으로 — 통짜 벽보다 집처럼 보인다
      if ((wx === 0 || wx === w - 1) && (wz === 0 || wz === d - 1))
        for (var cy = 1; cy <= 3; cy++) set(x + wx, h + cy, z + wz, LOG);
    }
  // 지붕 — 처마를 한 칸 내밀고 반블록으로 얇게 두른다
  for (var rx = -1; rx <= w; rx++)
    for (var rz = -1; rz <= d; rz++) {
      var outer = rx < 0 || rz < 0 || rx >= w || rz >= d;
      set(x + rx, h + 4, z + rz, roof, outer ? SH_SLAB : SH_FULL);
    }
  // 문 — 남쪽(+z) 한가운데. 두 칸이 함께 열린다
  var dxp = x + (w >> 1), dzp = z + d - 1;
  set(dxp, h + 1, dzp, DOOR, doorShapeFor(2, false));
  set(dxp, h + 2, dzp, DOOR, doorShapeFor(2, false));
  set(dxp, h, dzp + 1, GRAVEL);                       // 문 앞 디딤돌
  // 창 — 옆벽 둘에 유리, 앞쪽에는 색 유리 한 장 (아이 눈에 먼저 든다)
  set(x, h + 2, z + (d >> 1), GLASS);
  set(x + w - 1, h + 2, z + (d >> 1), GLASS);
  set(dxp - 1, h + 2, dzp, STAINED0 + 10);
  set(dxp + 1, h + 2, dzp, STAINED0 + 6);
  // 살림 — 램프·책장·카펫·화분·액자. 방이 비어 있으면 들어갈 이유가 없다
  set(x + 1, h + 3, z + 1, LAMP);
  set(x + 1, h + 1, z + d - 2, BOOKSHELF);
  set(x + 2, h + 1, z + 1, CARPET0 + ((rng() * 16) | 0));
  set(x + w - 2, h + 1, z + 1, POT);
  set(x + w - 2, h + 2, z, FRAME, wallShapeFor(0, 1));   // 북쪽 벽에 걸린 액자
  // 침대 자리 — 양털 두 장으로 시늉한다 (침대 블록은 없다)
  set(x + 1, h + 1, z + 1, WOOL0 + 4);
  set(x + 1, h + 1, z + 2, WOOL0 + 0);
  // 문 옆 벽 횃불 — 밤에 집이 보인다
  set(dxp + 1, h + 3, dzp, TORCH, wallShapeFor(0, 1));
}

// 우물 — 마을 한가운데. 물 한 칸과 지붕, 두레박 대신 울타리 기둥
function buildWell(x, z, h) {
  fill(x - 1, h, z - 1, x + 1, h, z + 1, COBBLE);
  fill(x, h - 2, z, x, h, z, WATER);
  fill(x - 1, h - 3, z - 1, x + 1, h - 3, z + 1, STONEBRICK);
  // 기둥을 두 칸으로 — 지붕이 h+2 면 **눈높이(1.62)에 걸려** 첫 화면이 나무판이었다
  var posts = [[-1, -1], [1, -1], [-1, 1], [1, 1]];
  for (var pi = 0; pi < 4; pi++) {
    set(x + posts[pi][0], h + 1, z + posts[pi][1], FENCE);
    set(x + posts[pi][0], h + 2, z + posts[pi][1], FENCE);
  }
  fill(x - 1, h + 3, z - 1, x + 1, h + 3, z + 1, PLANKS, SH_SLAB);
  set(x + 1, h + 1, z, TORCH);
}

// 밭 — 흙 이랑에 꽃과 키큰풀. 울타리로 둘러 "가꾼 자리" 로 보이게
function buildFarm(rng, x, z, w, d, h) {
  for (var fx = 0; fx < w; fx++)
    for (var fz = 0; fz < d; fz++) {
      var edge = fx === 0 || fz === 0 || fx === w - 1 || fz === d - 1;
      if (edge) { set(x + fx, h + 1, z + fz, FENCE); continue; }
      set(x + fx, h, z + fz, DIRT);
      var r = rng();
      if (r < 0.34) set(x + fx, h + 1, z + fz, TALLGRASS);
      else if (r < 0.56) set(x + fx, h + 1, z + fz, FLOWER_R);
      else if (r < 0.76) set(x + fx, h + 1, z + fz, FLOWER_Y);
    }
  set(x + (w >> 1), h + 1, z + d - 1, GATE);          // 드나드는 문
}

// 동물 우리 — 울타리와 울타리문. 안에 풀을 남겨 둔다 (동물은 seedMobs 가 넣는다)
function buildPen(x, z, w, d, h) {
  for (var px = 0; px < w; px++)
    for (var pz = 0; pz < d; pz++) {
      var edge = px === 0 || pz === 0 || px === w - 1 || pz === d - 1;
      if (edge) set(x + px, h + 1, z + pz, FENCE);
      set(x + px, h, z + pz, GRASS);
    }
  // 문은 **스폰 쪽(남쪽)** 에 단다 (v117) — 북쪽에 달아 두니 아이가 우리를 빙 돌아야 했고,
  // 눈앞의 울타리를 좌클릭으로 뚫는 것이 첫 동작이 됐다
  set(x + (w >> 1), h + 1, z + d - 1, GATE);
  set(x + 1, h + 1, z + 1, TALLGRASS);
  set(x + w - 2, h + 1, z + d - 2, TALLGRASS);
}

// 시장 가판 — 기둥 넷에 판자 지붕, 앞에 반블록 매대. 상인이 그 뒤에 선다
function buildStall(x, z, h) {
  fill(x, h, z, x + 3, h, z + 2, PLANKS);
  set(x, h + 1, z, FENCE); set(x + 3, h + 1, z, FENCE);
  set(x, h + 2, z, FENCE); set(x + 3, h + 2, z, FENCE);
  set(x, h + 1, z + 2, FENCE); set(x + 3, h + 1, z + 2, FENCE);
  set(x, h + 2, z + 2, FENCE); set(x + 3, h + 2, z + 2, FENCE);
  // 차양은 **가판만큼만** — 한 칸씩 내밀었더니 코앞에서 화면 위쪽을 통째로 덮었다
  fill(x, h + 3, z, x + 3, h + 3, z + 2, WOOL0 + 4, SH_SLAB);
  // 매대 — 앞줄에 반블록 카운터와 팔 물건
  fill(x, h + 1, z, x + 3, h + 1, z, PLANKS, SH_SLAB);
  set(x + 1, h + 2, z, POT);
  set(x + 2, h + 2, z, LAMP);
  set(x + 1, h + 1, z + 1, AIR);
  set(x + 2, h + 1, z + 1, AIR);
  // 뒤쪽(+z) 울타리 기둥에 붙인다 — 예전엔 -x 쪽 허공에 붙어 생성 마지막에 걷혔다 (v132)
  set(x, h + 2, z + 1, TORCH, wallShapeFor(0, -1));
  return [x + 1.5, h + 1, z + 1.5];                   // 상인이 설 자리
}

// 광산 입구 — 조약돌 테두리에 사다리 한 줄. 밑에는 횃불 켜진 짧은 갱도.
// **아이가 걸어서 내려갈 수 있어야 한다** — 지하 갱도는 찾아야 나오지만 이건 눈앞에 있다.
function buildMineEntrance(x, z, h) {
  var depth = Math.min(14, h - 6);
  if (depth < 6) depth = 6;
  var by = h - depth;
  // 입구 테두리
  fill(x - 2, h, z - 2, x + 2, h, z + 2, COBBLE);
  fill(x - 1, h + 1, z - 1, x + 1, h + 1, z + 1, AIR);
  set(x - 2, h + 1, z - 2, LOG); set(x + 2, h + 1, z - 2, LOG);
  set(x - 2, h + 1, z + 2, LOG); set(x + 2, h + 1, z + 2, LOG);
  set(x - 2, h + 2, z - 2, LOG); set(x + 2, h + 2, z - 2, LOG);
  fill(x - 2, h + 2, z - 2, x + 2, h + 2, z + 2, AIR);
  set(x - 2, h + 1, z, TORCH, wallShapeFor(1, 0));
  set(x + 2, h + 1, z, TORCH, wallShapeFor(-1, 0));
  // 수직 통로 — 사다리를 벽에 붙인다
  for (var y = by; y <= h; y++) {
    fill(x - 1, y, z - 1, x + 1, y, z + 1, AIR);
    set(x, y, z - 2, COBBLE);                          // 사다리가 붙을 벽
    set(x, y, z - 1, LADDER, wallShapeFor(0, 1));
    // 통로 횃불은 +x 암벽에 붙인다 (v132) — 바닥 없는 통로 한가운데에 서 있다가 걷혔다.
    // 암벽이 동굴이면 조약돌 한 칸을 댄다
    if ((y - by) % 4 === 0) {
      if (!isSolid(world[idx(x + 2, y, z + 1)])) set(x + 2, y, z + 1, COBBLE);
      set(x + 1, y, z + 1, TORCH, wallShapeFor(-1, 0));
    }
  }
  // 밑바닥 방과 갱도 한 줄기 — 조약돌 바닥에 원목 들보
  fill(x - 3, by, z - 3, x + 3, by + 2, z + 3, AIR);
  fill(x - 3, by - 1, z - 3, x + 3, by - 1, z + 3, COBBLE);
  // **사다리 밑 세 칸을 다시 깐다** — 바로 위의 방 파기가 `by`~`by+2` 의 사다리와
  // 그것이 붙을 벽을 지웠다. 열 시드 모두 밑에서 세 칸이 비어, 떨어져 들어간 아이가
  // 점프로는 못 올라오고(최고 y +1.4) **어두운 돌방에 갇혔다.**
  // 되돌리기도 비행도 안 배운 첫 30분에 일어나는 가장 나쁜 결말이다
  for (var ry = by; ry <= by + 2; ry++) {
    set(x, ry, z - 2, COBBLE);
    set(x, ry, z - 1, LADDER, wallShapeFor(0, 1));
  }
  // 방 횃불 — 동쪽은 갱도 입구(z-1..z+1)라 벽이 없다. 한 칸 비켜 z-2 에 붙인다 (v132).
  // 벽이 동굴이면 조약돌을 댄다
  if (!isSolid(world[idx(x - 4, by + 1, z)])) set(x - 4, by + 1, z, COBBLE);
  if (!isSolid(world[idx(x + 4, by + 1, z - 2)])) set(x + 4, by + 1, z - 2, COBBLE);
  set(x - 3, by + 1, z, TORCH, wallShapeFor(1, 0));
  set(x + 3, by + 1, z - 2, TORCH, wallShapeFor(-1, 0));
  // 용암 위에 방을 파지 않는다 (자문 30차 실측: 열 시드 중 넷에서 바닥 밑 3칸에 용암) —
  // 아이가 바닥을 파면 용암이 올라온다. 바닥 두 겹을 조약돌로 막는다
  for (var lz = -3; lz <= 3; lz++)
    for (var lx = -3; lx <= 3; lx++) {
      if (world[idx(x + lx, by - 2, z + lz)] === LAVA) set(x + lx, by - 2, z + lz, COBBLE);
      if (world[idx(x + lx, by - 3, z + lz)] === LAVA) set(x + lx, by - 3, z + lz, COBBLE);
    }
  for (var t = 1; t <= 14; t++) {                      // 옆으로 뻗는 갱도
    var tx = x + 3 + t;
    if (tx >= WX - 2) break;
    fill(tx, by, z - 1, tx, by + 2, z + 1, AIR);
    fill(tx, by - 1, z - 1, tx, by - 1, z + 1, COBBLE);
    for (var tz = -1; tz <= 1; tz++)
      if (world[idx(tx, by - 2, z + tz)] === LAVA) set(tx, by - 2, z + tz, COBBLE);
    if (t % 5 === 0) {                                 // 버팀목
      set(tx, by, z - 1, FENCE); set(tx, by + 1, z - 1, FENCE);
      set(tx, by, z + 1, FENCE); set(tx, by + 1, z + 1, FENCE);
      fill(tx, by + 2, z - 1, tx, by + 2, z + 1, LOG);
      set(tx, by, z, TORCH);                          // 바닥에 세운다 — by+1 은 공중이라 걷혔다 (v132)
    }
  }
  return [x, by + 1, z];
}

// 개울 — 바다에서 마을 앞까지 끌어 온다. **바닥을 해수면 아래로** 파야 마르지 않는다
// (`isSeaColumn` 이 수면까지 물로 이어진 기둥만 바다로 친다 · v110).
// 물길은 광장 가장자리를 지나가고, 그 위로 판자 다리를 놓는다.
function carveStream(x0, z0, h, startAt) {
  // 가장 가까운 바다 방향을 찾는다 — 네 방향으로 훑어 물을 먼저 만나는 쪽
  var dirs = [[1, 0], [-1, 0], [0, 1], [0, -1]];
  var best = null, bestD = 1e9;
  for (var i = 0; i < 4; i++) {
    for (var s = 4; s < 60; s++) {
      var qx = x0 + dirs[i][0] * s, qz = z0 + dirs[i][1] * s;
      if (qx < 2 || qz < 2 || qx >= WX - 2 || qz >= WZ - 2) break;
      if (heightMap[qz * WX + qx] <= SEA - 1) { if (s < bestD) { bestD = s; best = i; } break; }
    }
  }
  if (best === null) return null;
  var dx = dirs[best][0], dz = dirs[best][1];
  var wob = 0;
  // **광장 밖에서 시작한다** — 0 부터 파면 수로가 마을 한가운데를 지나며
  // 우물도 길도 통째로 걷어 간다 (실제로 처음 판이 그랬다)
  for (var t = startAt; t <= bestD + 2; t++) {
    var cx = x0 + dx * t, cz = z0 + dz * t;
    if (t % 5 === 0) wob += (t % 10 === 0 ? 1 : -1);          // 곧은 수로는 도랑처럼 보인다
    var ox = dz * wob, oz = dx * wob;                          // 진행 방향과 직각으로 흔든다
    for (var w = -1; w <= 1; w++) {
      var px = cx + ox + dz * w, pz = cz + oz + dx * w;
      if (px < 1 || pz < 1 || px >= WX - 1 || pz >= WZ - 1) continue;
      // 바닥은 해수면 −2, 물은 해수면까지
      fill(px, SEA - 2, pz, px, SEA, pz, WATER);
      set(px, SEA - 3, pz, SAND);
      fill(px, SEA + 1, pz, px, h + 8, pz, AIR);               // 물 위를 튼다
      // 강변 — 물가 한 줄은 모래
      for (var b = -1; b <= 1; b += 2) {
        var bx = px + dz * b * 2, bz = pz + dx * b * 2;
        if (bx < 1 || bz < 1 || bx >= WX - 1 || bz >= WZ - 1) continue;
        if (world[idx(bx, SEA + 1, bz)] === AIR && isSolid(world[idx(bx, SEA, bz)]))
          set(bx, SEA, bz, SAND);
      }
    }
  }
  return [x0 + dx * startAt, z0 + dz * startAt, dx, dz];   // 다리는 개울이 시작하는 자리에
}

// 다리 — 개울을 건너간다. 난간은 울타리
function buildBridge(x, z, dx, dz, h) {
  // 상판은 **광장 높이**다 — 물(SEA)에서 서너 칸 위라 건널 때 아래로 물이 보인다
  for (var t = -4; t <= 4; t++) {
    var bx = x + dx * t, bz = z + dz * t;
    for (var w = -1; w <= 1; w++) {
      var px = bx + dz * w, pz = bz + dx * w;
      if (px < 1 || pz < 1 || px >= WX - 1 || pz >= WZ - 1) continue;
      set(px, h, pz, PLANKS);
      fill(px, h + 1, pz, px, h + 4, pz, AIR);
    }
    // 난간 — 양옆 한 줄
    var rx = bx + dz * 2, rz = bz + dx * 2;
    var lx = bx - dz * 2, lz = bz - dx * 2;
    if (rx > 0 && rz > 0 && rx < WX - 1 && rz < WZ - 1) { set(rx, h, rz, PLANKS); set(rx, h + 1, rz, FENCE); }
    if (lx > 0 && lz > 0 && lx < WX - 1 && lz < WZ - 1) { set(lx, h, lz, PLANKS); set(lx, h + 1, lz, FENCE); }
  }
  set(x + dx * 4, h + 1, z + dz * 4, TORCH);      // 다리 끝에 등불
}

// 나무 몇 그루 — 마을 둘레에. 생성기의 숲과 달리 **보이는 자리**에 선다
function plantTree(x, z, h) {
  var th = 4 + ((x + z) % 2);
  for (var y = 1; y <= th; y++) set(x, h + y, z, LOG);
  for (var ly = th - 1; ly <= th + 1; ly++) {
    var r = ly === th + 1 ? 1 : 2;
    for (var lx = -r; lx <= r; lx++)
      for (var lz = -r; lz <= r; lz++) {
        if (Math.abs(lx) === r && Math.abs(lz) === r) continue;
        if (lx === 0 && lz === 0 && ly <= th) continue;
        if (world[idx(x + lx, h + ly, z + lz)] === AIR) set(x + lx, h + ly, z + lz, LEAVES);
      }
  }
  set(x, h + th + 2, z, LEAVES);
}

// 지도에 찍어 둘 표식 (v115) — 아이가 길을 잃어도 미니맵에 이름이 뜬다.
// 사람이 찍은 표식과 같은 그릇(S.marks)을 쓰므로 지우거나 옮길 수 있다
export function villageMarks(v) {
  if (!v) return [];
  return [
    [Math.round(v.stall[0]), Math.round(v.stall[1]), Math.round(v.stall[2]), "시장"],
    // 수직 통로 **밖** 남쪽 테두리 (v130) — 한가운데에 찍으면 `/tp 광산` 이 통로로 떨어뜨렸다
    [v.mine[0], v.h + 1, v.mine[2] + 3, "광산"],
    [Math.round(v.pen[0]), Math.round(v.pen[1]), Math.round(v.pen[2]), "우리"]
  ];
}

// ── 마을 짓기 ────────────────────────────────────────────
export function buildVillage(rng) {
  village = null;
  var HALF = 13;
  var site = pickSite(rng, HALF);
  var cx = site[0], cz = site[1], h = site[2];

  levelPlaza(cx - HALF, cz - HALF, cx + HALF, cz + HALF, h);
  bowlRim(cx, cz, HALF, h);

  // 길 — 십자로. 자갈이라 잔디와 구별된다
  fill(cx - HALF, h, cz - 1, cx + HALF, h, cz + 1, GRAVEL);
  fill(cx - 1, h, cz - HALF, cx + 1, h, cz + HALF, GRAVEL);

  // 가로등 — 울타리 기둥 둘에 횃불 하나. 밤에 마을이 **보이는** 것과
  // 안 보이는 것의 차이가 아이에게는 "무섭다/괜찮다" 다
  var lamps = [[-4, -4], [4, -4], [-4, 4], [4, 4], [-10, 0], [10, 0], [0, -12], [0, 12]];
  for (var li = 0; li < lamps.length; li++) {
    var lx = cx + lamps[li][0], lz = cz + lamps[li][1];
    if (lx < 1 || lz < 1 || lx >= WX - 1 || lz >= WZ - 1) continue;
    set(lx, h + 1, lz, FENCE);
    set(lx, h + 2, lz, FENCE);
    set(lx, h + 3, lz, TORCH);
  }

  buildWell(cx, cz, h);

  // 집 둘 — 길 양쪽에. 하나는 판자집, 하나는 벽돌집
  buildHouse(rng, cx - 11, cz - 10, 7, 6, h, PLANKS, LOG);
  buildHouse(rng, cx + 4, cz - 10, 7, 6, h, BRICK, COBBLE);

  buildFarm(rng, cx - 11, cz + 4, 7, 6, h);
  buildPen(cx + 4, cz + 4, 7, 6, h);
  // 가판 — 우물 서쪽, 길과 밭 **사이**. cx-8 은 밭(cx-11~cx-5)과 겹쳐서 꽃밭 위에 섰다
  var stall = buildStall(cx - 6, cz + 1, h);
  var mine = buildMineEntrance(cx + 9, cz - 2, h);

  // 나무 — 광장 네 귀퉁이 밖에 한 그루씩
  plantTree(cx - 9, cz - 2, h);
  plantTree(cx + 10, cz + 8, h);
  plantTree(cx - 5, cz + 11, h);
  set(cx + 6, h + 1, cz + 11, SAPLING);            // 심어 볼 묘목도 하나

  // 개울과 다리
  // 개울 — 광장 테(HALF + 2) 밖에서 시작해 바다로 흘러 나간다
  var st = carveStream(cx, cz, h, HALF + 2);
  if (st) buildBridge(st[0], st[1], st[2], st[3], h);

  // 스폰은 **남쪽 길 끝** — 앞으로 우물과 집, 왼쪽에 시장과 밭, 오른쪽에 우리와 광산.
  // 우물 코앞에 세웠더니 첫 화면이 우물 지붕 한 장이었다 (실제로 그렇게 나왔다)
  // 길 **옆** 잔디에 선다 — 자갈길 한가운데면 "스폰은 잔디·흙·모래·눈 위" 라는
  // 규칙(v33)을 깬다. 두 걸음 오른쪽일 뿐 보이는 것은 같다
  // 울타리에서 한 칸 더 물린다 (v117) — 조준선이 첫 화면에서 **울타리**를 겨눠서,
  // 튜토리얼 첫 줄("좌클릭으로 캐보세요")이 곧 우리를 뚫는 일이 됐다
  // 길 서쪽 잔디 — 우리(동쪽) 울타리에서 멀고, 다리(개울)와도 안 겹친다.
  // cz+11.5 로 물렸더니 개울 다리 판자 위에 섰다 (v33 규칙: 스폰은 자연 블록 위)
  // (스폰 자리는 villageAt 이 정한다 — cx-2.5 는 가판 기둥이 정면 5.5칸에 섰다)
  village = villageAt(cx, cz, h);
  village.stall = stall;
  village.mine = mine;
  S.village = village;
  return village;
}

// 마을의 **자리표** — 중심(cx, cz)과 광장 높이(h)만 알면 나머지는 늘 같은 자리다.
// **다시 켤 때 이걸로 되살린다** (v122): `S.village` 는 생성기 안에서만 채워지고
// 저장에 없어서, 새로고침한 세계에서는 「마을로」·`/tp 마을`·마을 불 보호·상인 고정이
// **전부 꺼졌다.** 이틀 전 공개한 판에서 둘째 날부터 그랬다
export function villageAt(cx, cz, h) {
  var depth = Math.min(14, h - 6);
  if (depth < 6) depth = 6;
  return {
    x: cx, z: cz, h: h,
    spawn: [cx - 1.5, h + 1, cz + 9.5],
    stall: [cx - 4.5, h + 1, cz + 2.5],           // buildStall(cx-6, cz+1) 의 안쪽
    mine: [cx + 9, h - depth + 1, cz - 2],         // buildMineEntrance(cx+9, cz-2) 의 바닥
    pen: [cx + 7.5, h + 1, cz + 7.5],
    penBox: [cx + 5, cz + 5, cx + 9, cz + 9]
  };
}
