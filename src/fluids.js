// fluids.js — 물 흐름 · 낙하 블록 · 잎 부패
import { S } from "./state.js";
import { Q } from "./queues.js";
import { DIRS, N, PLANE, SEA, WX, WY, WZ, idx, inside } from "./dims.js";
import { BIRCH_LEAVES, BIRCH_LOG, LEAVES, LOG, SAPLING, SNOW, SPRUCE_LEAVES, DIRT, GRASS, blocksLight, AIR, COBBLE, FIRE, GRAVEL, ICE, LAVA, SAND, SH_FULL, STONE, TNT, WATER, isCross, isFlammable, isLeaf, isLiquid, isLog, isSolid, isUnbreakable } from "./blocks.js";
import { topMap, isTouched, biomeMap, get, refreshTop, shape, waterLvl, world } from "./world.js";
import { growTree } from "./tree.js";
import { lightSky, lightBlk, relightLocal } from "./light.js";
import { touch } from "./mesh.js";
import { burst } from "./scene.js";
import { at, crunch, lavaHiss, tone } from "./audio.js";
import { playerOccupies } from "./player.js";
import { applyEdit, beginBatch, endBatch, unlock } from "./edit.js";

export var MAXFLOW = 7; // 근원에서 옆으로 뻗을 수 있는 칸 수 (마크와 같은 7칸)

export function enqueueWater(x, y, z) {
  if (!inside(x, y, z)) return;
  Q.waterQ.push(idx(x, y, z));
}
export function enqueueDry(x, y, z) {
  if (!inside(x, y, z)) return;
  Q.dryQ.push(idx(x, y, z));
}
export function enqueueDryAround(x, y, z) {
  for (var d = 0; d < 6; d++) enqueueDry(x + DIRS[d][0], y + DIRS[d][1], z + DIRS[d][2]);
}

export function enqueueWaterAround(x, y, z) {
  enqueueWater(x, y, z);
  for (var d = 0; d < 6; d++) enqueueWater(x + DIRS[d][0], y + DIRS[d][1], z + DIRS[d][2]);
}

// ── 중력 블록: 모래와 자갈은 받칠 게 없으면 떨어진다
// ── 잎 부패 — 원목과 이어지지 않은 잎은 몇 초에 걸쳐 스스로 떨어진다
export var DECAY_R = 5; // 원목에서 이만큼까지 이어진 잎은 산다

export function queueLeafDecay(x, y, z) {
  var R = DECAY_R + 1;
  var x0 = Math.max(0, x - R), x1 = Math.min(WX - 1, x + R);
  var y0 = Math.max(0, y - R), y1 = Math.min(WY - 1, y + R);
  var z0 = Math.max(0, z - R), z1 = Math.min(WZ - 1, z + R);
  var w = x1 - x0 + 1, dz2 = z1 - z0 + 1;
  var dist = new Uint8Array(w * (y1 - y0 + 1) * dz2);
  function li(px, py, pz) { return ((py - y0) * dz2 + (pz - z0)) * w + (px - x0); }

  // 남아 있는 원목에서 잎을 타고 퍼져 나간다
  var q = [], head = 0;
  for (var ax = x0; ax <= x1; ax++)
    for (var ay = y0; ay <= y1; ay++)
      for (var az = z0; az <= z1; az++)
        if (isLog(world[idx(ax, ay, az)])) { dist[li(ax, ay, az)] = 1; q.push(ax, ay, az); }

  while (head < q.length) {
    var cx = q[head++], cy = q[head++], cz = q[head++];
    var dc = dist[li(cx, cy, cz)];
    if (dc > DECAY_R) continue;
    for (var d = 0; d < 6; d++) {
      var nx = cx + DIRS[d][0], ny = cy + DIRS[d][1], nz = cz + DIRS[d][2];
      if (nx < x0 || nx > x1 || ny < y0 || ny > y1 || nz < z0 || nz > z1) continue;
      if (!isLeaf(world[idx(nx, ny, nz)])) continue;
      var l = li(nx, ny, nz);
      if (dist[l] !== 0 && dist[l] <= dc + 1) continue;
      dist[l] = dc + 1;
      q.push(nx, ny, nz);
    }
  }

  for (var ex = x0; ex <= x1; ex++)
    for (var ey = y0; ey <= y1; ey++)
      for (var ez = z0; ez <= z1; ez++)
        if (isLeaf(world[idx(ex, ey, ez)]) && dist[li(ex, ey, ez)] === 0)
          Q.decayQ.push(idx(ex, ey, ez));
}

export function decayTick(budget) {
  budget = budget || 3;
  var gone = 0;
  while (Q.decayHead < Q.decayQ.length && gone < budget) {
    var i = Q.decayQ[Q.decayHead++];
    if (!isLeaf(world[i])) continue;
    var y = (i / PLANE) | 0, rem = i - y * PLANE;
    var z = (rem / WX) | 0, x = rem - z * WX;
    burst(x, y, z, world[i], 5);
    applyEdit(x, y, z, AIR, false);
    gone++;
  }
  if (gone) crunch(0.09, 0.05, 850);
  if (Q.decayHead > 2048 && Q.decayHead === Q.decayQ.length) { Q.decayQ.length = 0; Q.decayHead = 0; }
  return gone;
}

export function isFalling(b) { return b === SAND || b === GRAVEL; }
export function enqueueFall(x, y, z) {
  if (!inside(x, y, z)) return;
  Q.fallQ.push(idx(x, y, z));
}
export function fallTick(budget) {
  budget = budget || 200;
  var moved = 0;
  // 이번 틱에 들어와 있던 것까지만 처리한다 —
  // 그러지 않으면 새로 밀어 넣은 이웃까지 같은 호출에서 다 처리해 순간이동처럼 보인다
  var end = Q.fallQ.length;
  while (Q.fallHead < end && budget-- > 0) {
    var i = Q.fallQ[Q.fallHead++];
    var b = world[i];
    if (!isFalling(b) || shape[i] !== SH_FULL) continue;
    var y = (i / PLANE) | 0;
    if (y <= 1) continue;
    var rem = i - y * PLANE;
    var z = (rem / WX) | 0;
    var x = rem - z * WX;
    var below = get(x, y - 1, z);
    // 떨어지는 모래·자갈은 풀·꽃·횃불을 부수고 지나간다
    if (below !== AIR && !isLiquid(below) && !isCross(below)) continue;

    world[i] = AIR; shape[i] = SH_FULL;
    var bi = idx(x, y - 1, z);
    world[bi] = b; shape[bi] = SH_FULL;
    moved++;
    touch(x, y, z); touch(x, y - 1, z);
    refreshTop(x, z);
    relightLocal(x, y, z);
    relightLocal(x, y - 1, z);
    enqueueWaterAround(x, y, z);
    enqueueFall(x, y - 1, z);
    enqueueFall(x, y + 1, z);
    S.worldDirty = true;
  }
  if (Q.fallHead > 4096 && Q.fallHead === Q.fallQ.length) { Q.fallQ.length = 0; Q.fallHead = 0; }
  if (moved) unlock("gravity");
  return moved;
}

export function waterTick(budget) {
  budget = budget || 300;
  var changed = 0;
  var end = Q.waterQ.length;          // 한 틱에 한 칸씩만 번진다
  while (Q.waterHead < end && budget-- > 0) {
    var i = Q.waterQ[Q.waterHead++];
    // 흐르는 물은 풀·꽃·횃불을 쓸어버린다 (마크와 같다)
    if (world[i] !== AIR && !isCross(world[i])) continue;
    var y = (i / PLANE) | 0;
    var rem = i - y * PLANE;
    var z = (rem / WX) | 0;
    var x = rem - z * WX;

    var lvl = -1;
    if (y <= SEA) {
      // 해수면 아래 — 바다와 이어지면 그냥 잠긴다 (기존 동작)
      for (var d = 0; d < 6 && lvl < 0; d++) {
        if (get(x + DIRS[d][0], y + DIRS[d][1], z + DIRS[d][2]) === WATER) lvl = 0;
      }
    } else if (get(x, y + 1, z) === WATER) {
      lvl = 0;                          // 위에서 떨어지는 물은 다시 근원이 된다
      unlock("waterfall");
    } else {
      var srcCount = 0;
      for (var h = 0; h < 6; h++) {
        if (DIRS[h][1] !== 0) continue;  // 옆으로만
        var nx2 = x + DIRS[h][0], nz2 = z + DIRS[h][2];
        if (get(nx2, y, nz2) !== WATER) continue;
        // 단단한 바닥을 딛고 있는 물만 옆으로 퍼진다 — 떨어지는 물기둥은 퍼지지 않는다
        if (!isSolid(get(nx2, y - 1, nz2))) continue;
        var nlvl = waterLvl[idx(nx2, y, nz2)];
        if (nlvl === 0) srcCount++;
        var cand = nlvl + 1;
        if (cand > MAXFLOW) continue;
        if (lvl < 0 || cand < lvl) lvl = cand;
      }
      // 마크의 무한 물 — 근원 둘에 맞닿고 바닥이 단단하면 자기도 근원이 된다.
      // 양동이가 없는 게임이라, 이게 없으면 옮긴 물은 쓸수록 줄기만 한다.
      if (srcCount >= 2 && isSolid(get(x, y - 1, z))) lvl = 0;
    }
    if (lvl < 0) continue;

    // 물이 용암에 닿으면 굳어 조약돌이 된다 — 마크의 고전
    var meltsLava = false;
    for (var m = 0; m < 6; m++) {
      if (get(x + DIRS[m][0], y + DIRS[m][1], z + DIRS[m][2]) === LAVA) { meltsLava = true; break; }
    }
    if (meltsLava) {
      world[i] = COBBLE; shape[i] = SH_FULL; waterLvl[i] = 0;
      touch(x, y, z); refreshTop(x, z); relightLocal(x, y, z);
      burst(x, y, z, COBBLE, 6);
      lavaHiss();
      S.worldDirty = true;
      changed++;
      continue;
    }

    world[i] = WATER;
    // 설원의 노출된 수면은 잠시 뒤 얼어붙는다 (바로 얼리면 물이 퍼지지도 못한다)
    enqueueFreeze(x, y, z);
    waterLvl[i] = lvl;
    changed++;
    touch(x, y, z);
    refreshTop(x, z);
    for (var d2 = 0; d2 < 6; d2++) {
      enqueueWater(x + DIRS[d2][0], y + DIRS[d2][1], z + DIRS[d2][2]);
    }
  }
  if (Q.waterHead > 4096 && Q.waterHead === Q.waterQ.length) { Q.waterQ.length = 0; Q.waterHead = 0; }
  if (changed) unlock("flood");
  return changed;
}

// 설원 수면 얼리기 — waterTick 과 분리해 시차를 둔다
// 설원의 노출된 수면만 얼린다 — 얼릴 후보를 큐에 넣는다
export function enqueueFreeze(x, y, z) {
  if (!inside(x, y, z)) return;
  var i = idx(x, y, z);
  if (world[i] === WATER && biomeMap[z * WX + x] === 1 && y >= SEA) Q.freezeQ.push(i);
}

export function freezeTick(budget) {
  budget = budget || 200;
  var frozen = 0;
  var end = Q.freezeQ.length;
  while (Q.freezeHead < end && budget-- > 0) {
    var i = Q.freezeQ[Q.freezeHead++];
    if (world[i] !== WATER) continue;
    var y = (i / PLANE) | 0, rem = i - y * PLANE;
    var z = (rem / WX) | 0, x = rem - z * WX;
    if (biomeMap[z * WX + x] !== 1) continue;
    if (get(x, y + 1, z) !== AIR) continue;          // 덮인 물은 얼지 않는다
    if (playerOccupies(x, y, z)) continue;           // 헤엄치는 사람을 얼음 속에 가두지 않는다
    if (lightBlk[i] >= 12) continue;                 // 광원 옆은 안 언다
    world[i] = ICE; shape[i] = SH_FULL; waterLvl[i] = 0;
    touch(x, y, z); refreshTop(x, z); relightLocal(x, y, z);
    frozen++;
    S.worldDirty = true;
  }
  if (Q.freezeHead > 2048 && Q.freezeHead === Q.freezeQ.length) {
    Q.freezeQ.length = 0; Q.freezeHead = 0;
  }
  return frozen;
}

export function dryTick(budget) {
  budget = budget || 300;
  var dried = 0;
  var end = Q.dryQ.length;
  while (Q.dryHead < end && budget-- > 0) {
    var i = Q.dryQ[Q.dryHead++];
    if (world[i] !== WATER) continue;
    var y = (i / PLANE) | 0;
    if (y <= SEA) continue;                    // 바다는 마르지 않는다
    var lvl = waterLvl[i];
    if (lvl === 0 && get2(i, 0, 1, 0) !== WATER) {
      // 위에서 떨어지던 물이 끊긴 근원 — 옆에서 받쳐 주지 않으면 사라진다
      if (!fedSideways(i, y, MAXFLOW)) { removeWater(i, y); dried++; }
      continue;
    }
    if (lvl === 0) continue;
    if (get2(i, 0, 1, 0) === WATER) continue;
    if (fedSideways(i, y, lvl)) continue;
    removeWater(i, y);
    dried++;
  }
  if (Q.dryHead > 4096 && Q.dryHead === Q.dryQ.length) { Q.dryQ.length = 0; Q.dryHead = 0; }
  return dried;
}

export function get2(i, dx, dy, dz) {
  var y = (i / PLANE) | 0, rem = i - y * PLANE;
  var z = (rem / WX) | 0, x = rem - z * WX;
  return get(x + dx, y + dy, z + dz);
}
// 옆에서 나보다 근원에 가까운 물이 대 주고 있는가
export function fedSideways(i, y, lvl) {
  var rem = i - y * PLANE, z = (rem / WX) | 0, x = rem - z * WX;
  for (var h = 0; h < 6; h++) {
    if (DIRS[h][1] !== 0) continue;
    var nx = x + DIRS[h][0], nz = z + DIRS[h][2];
    if (get(nx, y, nz) !== WATER) continue;
    if (!isSolid(get(nx, y - 1, nz))) continue;
    if (waterLvl[idx(nx, y, nz)] < lvl) return true;
  }
  return false;
}
export function removeWater(i, y) {
  var rem = i - y * PLANE, z = (rem / WX) | 0, x = rem - z * WX;
  world[i] = AIR; waterLvl[i] = 0;
  touch(x, y, z); refreshTop(x, z); relightLocal(x, y, z);
  enqueueDryAround(x, y, z);
  enqueueFall(x, y + 1, z);
  S.worldDirty = true;
}

// ══════════════════════════════════════════════════════════════
//  불과 폭발
// ══════════════════════════════════════════════════════════════
export var FIRE_LIFE = 6;          // 불 한 칸이 버티는 대략적인 틱 수
export var FIRE_REACH = 9;         // 처음 붙인 자리에서 이만큼까지만 번진다

export function ignite(x, y, z) {
  if (!inside(x, y, z)) return false;
  var i = idx(x, y, z);
  if (world[i] !== AIR && !isCross(world[i])) return false;
  // 붙을 것이 옆에 있어야 한다
  var fuel = false;
  for (var d = 0; d < 6 && !fuel; d++) {
    if (isFlammable(get(x + DIRS[d][0], y + DIRS[d][1], z + DIRS[d][2]))) fuel = true;
  }
  if (!fuel) return false;
  // applyEdit 을 거쳐야 Ctrl+Z 로 되돌릴 수 있다 (TNT 는 되는데 불은 안 됐다)
  if (!applyEdit(x, y, z, FIRE, true)) return false;
  Q.fireQ.push(i);
  // 원점을 하나만 두면, 두 번째로 불을 붙인 순간 첫 불이 새 원점 기준으로 상한을 재
  // 갑자기 번지기를 멈춘다. 불마다 원점을 따로 기억한다.
  S.fireOrigin = [x, y, z];
  var far = true;
  for (var oi = 0; oi < S.fireOrigins.length; oi++) {
    var o = S.fireOrigins[oi];
    if (Math.abs(o[0] - x) + Math.abs(o[1] - y) + Math.abs(o[2] - z) <= 3) { far = false; break; }
  }
  if (far) {
    S.fireOrigins.push([x, y, z]);
    if (S.fireOrigins.length > 12) S.fireOrigins.shift();
  }
  return true;
}

// 잔디는 옆의 흙으로 번지고, 덮이면 흙으로 돌아간다 — 마크에서 지형을 메우고
// 며칠 뒤 다시 오는 그 맛이다. 사람이 손댄 칸(isTouched)은 절대 건드리지 않는다.
// (v19 의 "날씨가 내 건축물을 개조한다" 사고를 되풀이하지 않기 위해)
// 기둥을 뽑고 그 기둥의 지표만 본다 — 허공을 헛짚지 않아 표본 하나하나가 후보가 된다
export var GRASS_REACH = 12;
export function grassTick(px, py, pz, tries) {
  tries = tries || 12;
  var changed = 0;
  for (var t = 0; t < tries; t++) {
    var x = Math.floor(px + (Math.random() - 0.5) * GRASS_REACH * 2);
    var z = Math.floor(pz + (Math.random() - 0.5) * GRASS_REACH * 2);
    if (x < 0 || x >= WX || z < 0 || z >= WZ) continue;
    var y = topMap[z * WX + x];
    if (!inside(x, y, z)) continue;
    if (isTouched(x, y, z)) continue;
    // 덮인 잔디는 지표 바로 아래에 있다 — 그 한 칸을 먼저 본다
    if (world[idx(x, y, z)] !== AIR && blocksLight(world[idx(x, y, z)]) &&
        y > 0 && world[idx(x, y - 1, z)] === GRASS && !isTouched(x, y - 1, z)) {
      if (applyEdit(x, y - 1, z, DIRT, false)) { changed++; continue; }
    }
    var i = idx(x, y, z), b = world[i];
    if (b === GRASS) {
      // 위가 빛을 막으면 잔디가 죽어 흙이 된다
      if (!blocksLight(get(x, y + 1, z))) continue;
      if (applyEdit(x, y, z, DIRT, false)) changed++;
    } else if (b === DIRT) {
      if (get(x, y + 1, z) !== AIR) continue;
      if (lightSky[idx(x, y + 1, z)] < 9) continue;
      var near = false;                       // 옆에 잔디가 있어야 번진다
      for (var d = 0; d < 6 && !near; d++) {
        var g = get(x + DIRS[d][0], y + DIRS[d][1], z + DIRS[d][2]);
        if (g === GRASS) near = true;
      }
      if (!near) continue;
      if (applyEdit(x, y, z, GRASS, false)) changed++;
    }
  }
  return changed;
}

// ══════════════════════════════════════════════════════════════
//  용암 흐르기 — 물과 같은 규칙이되 절반만 뻗고 네 배 느리다.
//  절벽 위에 부은 용암이 그 자리에 네모나게 떠 있으면 "붓는다" 는 행동에 의미가 없다.
// ══════════════════════════════════════════════════════════════
export var LAVA_FLOW = 2;              // 마크 오버월드는 4칸. 96칸 섬 스케일에 맞춰 절반.

export function enqueueLava(x, y, z) {
  if (!inside(x, y, z)) return;
  var i = idx(x, y, z);
  if (world[i] === AIR || isCross(world[i])) Q.lavaQ.push(i);
}
export function enqueueLavaAround(x, y, z) {
  enqueueLava(x, y, z);
  for (var d = 0; d < 6; d++) enqueueLava(x + DIRS[d][0], y + DIRS[d][1], z + DIRS[d][2]);
}
export function enqueueLavaDry(x, y, z) {
  if (!inside(x, y, z)) return;
  if (world[idx(x, y, z)] === LAVA) Q.lavaDryQ.push(idx(x, y, z));
}
export function enqueueLavaDryAround(x, y, z) {
  enqueueLavaDry(x, y, z);
  for (var d = 0; d < 6; d++) enqueueLavaDry(x + DIRS[d][0], y + DIRS[d][1], z + DIRS[d][2]);
}

// 옆에서 나보다 근원에 가까운 용암이 대 주고 있는가 (물의 fedSideways 와 같은 판정)
function lavaFedSideways(i, y, lvl) {
  var rem = i - y * PLANE, z = (rem / WX) | 0, x = rem - z * WX;
  for (var h = 0; h < 6; h++) {
    if (DIRS[h][1] !== 0) continue;
    var nx = x + DIRS[h][0], nz = z + DIRS[h][2];
    if (get(nx, y, nz) !== LAVA) continue;
    if (!isSolid(get(nx, y - 1, nz))) continue;
    if (waterLvl[idx(nx, y, nz)] < lvl) return true;
  }
  return false;
}

export function lavaFlowTick(budget) {
  budget = budget || 120;
  var changed = 0;
  var end = Q.lavaQ.length;
  while (Q.lavaHead < end && budget-- > 0) {
    var i = Q.lavaQ[Q.lavaHead++];
    if (world[i] !== AIR && !isCross(world[i])) continue;   // 흐르는 용암도 풀·꽃을 쓸어버린다
    var y = (i / PLANE) | 0, rem = i - y * PLANE;
    var z = (rem / WX) | 0, x = rem - z * WX;

    var lvl = -1;
    if (get(x, y + 1, z) === LAVA) {
      lvl = 0;                                   // 위에서 떨어지는 용암은 다시 근원
    } else {
      for (var h2 = 0; h2 < 6; h2++) {
        if (DIRS[h2][1] !== 0) continue;
        var nx2 = x + DIRS[h2][0], nz2 = z + DIRS[h2][2];
        if (get(nx2, y, nz2) !== LAVA) continue;
        if (!isSolid(get(nx2, y - 1, nz2))) continue;
        var cand = waterLvl[idx(nx2, y, nz2)] + 1;
        if (cand > LAVA_FLOW) continue;
        if (lvl < 0 || cand < lvl) lvl = cand;
      }
    }
    if (lvl < 0) continue;

    // 물에 닿으면 굳어 조약돌 — 물 쪽(waterTick)과 대칭이다
    var wet = false;
    for (var m = 0; m < 6; m++) {
      if (get(x + DIRS[m][0], y + DIRS[m][1], z + DIRS[m][2]) === WATER) { wet = true; break; }
    }
    if (wet) {
      world[i] = COBBLE; shape[i] = SH_FULL; waterLvl[i] = 0;
      touch(x, y, z); refreshTop(x, z); relightLocal(x, y, z);
      burst(x, y, z, COBBLE, 6);
      lavaHiss();
      S.worldDirty = true; changed++;
      continue;
    }

    world[i] = LAVA; waterLvl[i] = lvl;
    changed++;
    touch(x, y, z); refreshTop(x, z); relightLocal(x, y, z);   // 용암은 광원이라 조명도 다시
    for (var d3 = 0; d3 < 6; d3++)
      enqueueLava(x + DIRS[d3][0], y + DIRS[d3][1], z + DIRS[d3][2]);
    S.worldDirty = true;
  }
  if (Q.lavaHead > 4096 && Q.lavaHead === Q.lavaQ.length) { Q.lavaQ.length = 0; Q.lavaHead = 0; }
  return changed;
}

// 근원이 사라지면 흘러 나간 용암도 물러난다 — 안 그러면 캔 자리에 자국이 영영 남는다
export function lavaDryTick(budget) {
  budget = budget || 120;
  var dried = 0;
  var end = Q.lavaDryQ.length;
  while (Q.lavaDryHead < end && budget-- > 0) {
    var i = Q.lavaDryQ[Q.lavaDryHead++];
    if (world[i] !== LAVA) continue;
    var y = (i / PLANE) | 0;
    var lvl = waterLvl[i];
    if (lvl === 0) continue;                       // 근원은 마르지 않는다
    if (get2(i, 0, 1, 0) === LAVA) continue;       // 위에서 대 주고 있다
    if (lavaFedSideways(i, y, lvl)) continue;
    var rem2 = i - y * PLANE, z2 = (rem2 / WX) | 0, x2 = rem2 - z2 * WX;
    world[i] = AIR; waterLvl[i] = 0;
    touch(x2, y, z2); refreshTop(x2, z2); relightLocal(x2, y, z2);
    enqueueLavaDryAround(x2, y, z2);
    enqueueFall(x2, y + 1, z2);
    S.worldDirty = true;
    dried++;
  }
  if (Q.lavaDryHead > 4096 && Q.lavaDryHead === Q.lavaDryQ.length) {
    Q.lavaDryQ.length = 0; Q.lavaDryHead = 0;
  }
  return dried;
}

// 용암은 가까운 가연물에 스스로 불을 붙인다 — 마크에서 용암을 붓는다는 건
// "무언가를 시작한다" 는 뜻이다. 이게 없으면 용암은 주황색 벽돌일 뿐이다.
// 큐 없이 플레이어 주변만 드문드문 훑는다 (44만 칸을 다 볼 이유가 없다)
export var LAVA_REACH = 10;
export function lavaTick(px, py, pz, tries) {
  tries = tries || 24;
  var lit = 0;
  for (var t = 0; t < tries; t++) {
    var x = Math.floor(px + (Math.random() - 0.5) * LAVA_REACH * 2);
    var y = Math.floor(py + (Math.random() - 0.5) * 8);
    var z = Math.floor(pz + (Math.random() - 0.5) * LAVA_REACH * 2);
    if (!inside(x, y, z)) continue;
    if (world[idx(x, y, z)] !== LAVA) continue;
    // 용암 칸의 이웃(윗면은 두 칸까지)에서 불이 설 자리를 찾는다
    for (var d = 0; d < 6; d++) {
      var nx = x + DIRS[d][0], ny = y + DIRS[d][1], nz = z + DIRS[d][2];
      if (ignite(nx, ny, nz)) { lit++; break; }
    }
    if (lit) break;                        // 한 틱에 하나면 충분하다
  }
  return lit;
}

// 불이 옆으로 옮겨 붙고, 태울 것이 없으면 꺼진다
export function fireTick(budget) {
  budget = budget || 60;
  var acted = 0;
  // 비가 오면 하늘이 뚫린 자리의 불은 꺼지고 새로 붙지도 않는다 —
  // 방화 실수를 하늘이 수습해 준다. 지하 굴의 불은 그대로 산다 (마크와 같다).
  var raining = S.weather === 1;
  var end = Q.fireQ.length;
  while (Q.fireHead < end && budget-- > 0) {
    var i = Q.fireQ[Q.fireHead++];
    if (world[i] !== FIRE) continue;
    var y = (i / PLANE) | 0, rem = i - y * PLANE;
    var z = (rem / WX) | 0, x = rem - z * WX;

    // 태울 것을 하나 고른다
    var burned = false;
    for (var d = 0; d < 6; d++) {
      var nx = x + DIRS[d][0], ny = y + DIRS[d][1], nz = z + DIRS[d][2];
      if (!inside(nx, ny, nz)) continue;
      if (!isFlammable(get(nx, ny, nz))) continue;
      if (Math.random() > 0.30) continue;
      if (raining && ny > topMap[nz * WX + nx] - 0.5) continue;   // 비 맞는 자리엔 안 붙는다
      // 처음 붙인 자리에서 너무 멀리 번지지 않게 — 집이 통째로 사라지면 복구가 없다
      if (S.fireOrigins.length) {
        var od = 1e9;                       // 가장 가까운 원점까지의 거리로 잰다
        for (var oj = 0; oj < S.fireOrigins.length; oj++) {
          var og = S.fireOrigins[oj];
          var dd = Math.abs(nx - og[0]) + Math.abs(ny - og[1]) + Math.abs(nz - og[2]);
          if (dd < od) od = dd;
        }
        if (od > FIRE_REACH) continue;
      }
      // 물이 닿아 있으면 불이 옮겨 붙지 않는다
      var wet = false;
      for (var wd = 0; wd < 6 && !wet; wd++) {
        if (get(nx + DIRS[wd][0], ny + DIRS[wd][1], nz + DIRS[wd][2]) === WATER) wet = true;
      }
      if (wet) continue;
      var ni = idx(nx, ny, nz);
      applyEdit(nx, ny, nz, FIRE, false);      // 번짐은 세계가 하는 일 — 되돌리기 기록을 먹지 않는다
      Q.fireQ.push(ni);
      burned = true;
      acted++;
    }

    // 옆에 태울 것이 없으면 사그라진다
    var fuel = false;
    for (var d2 = 0; d2 < 6 && !fuel; d2++) {
      if (isFlammable(get(x + DIRS[d2][0], y + DIRS[d2][1], z + DIRS[d2][2]))) fuel = true;
    }
    // 물이 닿으면 즉시 꺼진다
    var doused = false;
    for (var qd = 0; qd < 6 && !doused; qd++) {
      if (get(x + DIRS[qd][0], y + DIRS[qd][1], z + DIRS[qd][2]) === WATER) doused = true;
    }
    if (raining && y > topMap[z * WX + x] - 0.5 && Math.random() < 0.25) doused = true;
    if (doused || (!fuel && Math.random() < 0.5)) {
      applyEdit(x, y, z, AIR, false);        // 꺼지는 것도 마찬가지
      burst(x, y, z, FIRE, 3);
      if (doused) crunch(0.3, 0.10, 1800);
      acted++;
    } else {
      Q.fireQ.push(i);       // 아직 살아 있으면 반드시 다시 큐에 넣는다 (안 그러면 영영 안 꺼진다)
    }
    S.worldDirty = true;
  }
  if (Q.fireHead > 4096 && Q.fireHead === Q.fireQ.length) { Q.fireQ.length = 0; Q.fireHead = 0; }
  return acted;
}

// TNT — 반경 안을 날려 버린다. 기반암은 남는다.
export var BLAST_R = 4;
// ── TNT 도화선 — 마크처럼 점화하고 4초 뒤에 터진다.
// 즉시 터지면 반경 4칸 안에 있는 플레이어가 매번 휘말려 TNT 를 쓸 수가 없다.
export var TNT_FUSE = 3.0;
export function primeTNT(x, y, z, fuse) {
  if (!inside(x, y, z)) return false;
  if (get(x, y, z) !== TNT) return false;
  for (var i = 0; i < S.primed.length; i++) {
    if (S.primed[i].x === x && S.primed[i].y === y && S.primed[i].z === z) return false;
  }
  S.primed.push({ x: x, y: y, z: z, t: (typeof fuse === "number" ? fuse : TNT_FUSE) });
  crunch(0.25, 0.08, 1800, at(x + 0.5, y + 0.5, z + 0.5));
  return true;
}
// 매 프레임 도화선을 태운다. 다 타면 그 자리를 지우고 터뜨린다.
export function primeTick(dt) {
  var fired = 0;
  for (var i = S.primed.length - 1; i >= 0; i--) {
    var p = S.primed[i];
    p.t -= dt;
    if (get(p.x, p.y, p.z) !== TNT) { S.primed.splice(i, 1); continue; }  // 누가 캐 갔다
    if (p.t > 0) continue;
    S.primed.splice(i, 1);
    applyEdit(p.x, p.y, p.z, AIR, true);      // 터지는 자기 자신부터 치운다
    explode(p.x, p.y, p.z, BLAST_R);
    fired++;
  }
  return fired;
}

export function explode(cx, cy, cz, radius) {
  var R = radius || BLAST_R;
  unlock("boom");                        // 도화선을 넣었으니 과제도 터지는 순간에
  beginBatch();
  var removed = 0;
  for (var dx = -R; dx <= R; dx++)
    for (var dy = -R; dy <= R; dy++)
      for (var dz = -R; dz <= R; dz++) {
        var d = Math.sqrt(dx * dx + dy * dy + dz * dz);
        if (d > R) continue;
        if (d > 1.8 && Math.random() < (d / R) * 0.55) continue;   // 가장자리만 너덜너덜하게
        var x = cx + dx, y = cy + dy, z = cz + dz;
        if (!inside(x, y, z)) continue;
        var b = get(x, y, z);
        if (b === AIR || isUnbreakable(b)) continue;
        // 연쇄 폭발 — 옆의 TNT 는 지우지 않고 짧은 도화선에 불을 붙인다
        if (b === TNT) { primeTNT(x, y, z, 0.3 + Math.random() * 0.5); continue; }
        if (applyEdit(x, y, z, AIR, true)) removed++;
      }
  endBatch("폭발");
  for (var k = 0; k < 26; k++) {
    burst(cx + (Math.random() - 0.5) * R, cy + (Math.random() - 0.5) * R,
          cz + (Math.random() - 0.5) * R, STONE, 5);
  }
  // 폭발은 터진 자리에서 — 멀리서 들리면 어느 쪽인지 안다
  var boomAt = at(cx + 0.5, cy + 0.5, cz + 0.5);
  crunch(0.9, 0.34, 420, boomAt);
  tone(52, 1.2, "sine", 0.12, boomAt);
  return removed;
}

// ── 묘목 ─────────────────────────────────────────────────────
// 나무를 베면 끝이던 것을 되돌린다 — 심어 두면 자란다.
// 마크의 뼛가루가 없으니(도구 체계가 없다) 시간만이 자라게 하는 유일한 방법이다.
export var GROW_EVERY = 1.0;      // 1초에 한 번 큐를 돌아본다
export var GROW_CHANCE = 0.08;    // 한 번에 8% — 평균 12초쯤이면 심고 돌아설 만하다
export var GROW_LIGHT = 9;        // 마크와 같이 빛 9 이상이어야 자란다

export function enqueueGrow(x, y, z) {
  if (!inside(x, y, z)) return;
  if (world[idx(x, y, z)] !== SAPLING) return;
  Q.growQ.push(idx(x, y, z));
}

// 저장을 불러오거나 세계를 갈아타면 큐가 비어 있다 — 세계에서 묘목을 다시 주워 담는다.
// 큐를 저장 포맷에 넣지 않는 대신 여기서 한 번 훑는다 (589,824칸에 1ms 남짓).
function reseedGrow() {
  Q.growQ.length = 0;
  for (var i = 0; i < N; i++) if (world[i] === SAPLING) Q.growQ.push(i);
  S.growDirty = false;
}

// 이 자리에서 자랄 나무의 종류 — 그 땅에 원래 서 있던 나무를 따른다.
// 심는 사람이 종류를 고르게 하려면 묘목이 세 종류여야 하는데,
// 크리에이티브에서 목록만 세 칸 늘고 얻는 게 없다 (자문 7차).
function saplingKind(x, z) {
  if (biomeMap[z * WX + x] === 1) return 2;          // 설원 → 가문비
  return (Math.random() < 0.34) ? 1 : 0;             // 초원 → 자작 34% · 참나무
}

export function growTick(dt) {
  if (S.growDirty) reseedGrow();
  if (!Q.growQ.length) return 0;
  Q.growTimer += dt;
  if (Q.growTimer < GROW_EVERY) return 0;
  Q.growTimer = 0;
  var grown = 0, keep = [];
  for (var k = 0; k < Q.growQ.length; k++) {
    var i = Q.growQ[k];
    if (world[i] !== SAPLING) continue;              // 캐 갔거나 덮였다 — 큐에서 빠진다
    var y = (i / PLANE) | 0, rem = i - y * PLANE;
    var z = (rem / WX) | 0, x = rem - z * WX;
    var floorB = get(x, y - 1, z);
    // 흙 위에서만 자란다. 돌·유리 위의 묘목은 남아 있되 자라지 않는다 (마크와 같다)
    if (floorB !== GRASS && floorB !== DIRT && floorB !== SAND && floorB !== SNOW) { keep.push(i); continue; }
    if (lightSky[i] < GROW_LIGHT && lightBlk[i] < GROW_LIGHT) { keep.push(i); continue; }
    // 위가 막혀 있으면 자라지 않는다 — 천장을 뚫고 올라오면 지어 둔 집이 부서진다.
    // 가장 짧은 나무가 줄기 4칸 + 잎이라, 6칸이 비어 있는지만 본다 (마크도 비슷하게 본다)
    var clear = true;
    for (var uy = 1; uy <= 6 && clear; uy++)
      if (!inside(x, y + uy, z) || get(x, y + uy, z) !== AIR) clear = false;
    if (!clear) { keep.push(i); continue; }
    if (Math.random() > GROW_CHANCE) { keep.push(i); continue; }
    var kind = saplingKind(x, z);
    var logB = (kind === 1) ? BIRCH_LOG : LOG;
    var leafB = (kind === 2) ? SPRUCE_LEAVES : (kind === 1 ? BIRCH_LEAVES : LEAVES);
    // 묘목 자리를 먼저 비운다 — 줄기 첫 칸이 여기 서야 한다
    applyEdit(x, y, z, AIR, false, SH_FULL);
    // 한 그루가 한 번에 되돌려지도록 묶는다 (Ctrl+Z 한 번에 나무 하나)
    beginBatch(64);
    var ok = growTree(x, y - 1, z, kind, logB, leafB, Math.random,
                      get, function (bx, by, bz, b) { applyEdit(bx, by, bz, b, true, SH_FULL); },
                      AIR, WY);
    endBatch("나무 자람");
    if (!ok) { applyEdit(x, y, z, SAPLING, false, SH_FULL); keep.push(i); continue; }
    // 옆에 서 있다가 나무가 소리 없이 솟으면 무슨 일이 난 건지 모른다.
    // 잎이 터지는 소리와 잎조각 — 무엇이 어디서 자랐는지 눈과 귀로 알린다.
    var voice = at(x + 0.5, y + 2, z + 0.5);
    burst(x, y + 2, z, leafB, 12);
    tone(180, 0.20, "triangle", 0.05, voice);
    tone(240, 0.26, "triangle", 0.04, voice);
    grown++;
  }
  Q.growQ = keep;
  if (grown) { S.worldDirty = true; unlock("sapling"); }
  return grown;
}
