// fluids.js — 물 흐름 · 낙하 블록 · 잎 부패
import { S } from "./state.js";
import { Q } from "./queues.js";
import { DIRS, PLANE, SEA, WX, WY, WZ, idx, inside } from "./dims.js";
import { AIR, GRAVEL, LEAVES, LOG, SAND, SH_FULL, WATER, isCross, isLiquid, isSolid } from "./blocks.js";
import { get, refreshTop, shape, world, waterLvl } from "./world.js";
import { relightLocal } from "./light.js";
import { touch } from "./mesh.js";
import { burst } from "./scene.js";
import { crunch } from "./audio.js";
import { applyEdit, unlock } from "./edit.js";

export var MAXFLOW = 3; // 근원에서 옆으로 뻗을 수 있는 칸 수

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
        if (world[idx(ax, ay, az)] === LOG) { dist[li(ax, ay, az)] = 1; q.push(ax, ay, az); }

  while (head < q.length) {
    var cx = q[head++], cy = q[head++], cz = q[head++];
    var dc = dist[li(cx, cy, cz)];
    if (dc > DECAY_R) continue;
    for (var d = 0; d < 6; d++) {
      var nx = cx + DIRS[d][0], ny = cy + DIRS[d][1], nz = cz + DIRS[d][2];
      if (nx < x0 || nx > x1 || ny < y0 || ny > y1 || nz < z0 || nz > z1) continue;
      if (world[idx(nx, ny, nz)] !== LEAVES) continue;
      var l = li(nx, ny, nz);
      if (dist[l] !== 0 && dist[l] <= dc + 1) continue;
      dist[l] = dc + 1;
      q.push(nx, ny, nz);
    }
  }

  for (var ex = x0; ex <= x1; ex++)
    for (var ey = y0; ey <= y1; ey++)
      for (var ez = z0; ez <= z1; ez++)
        if (world[idx(ex, ey, ez)] === LEAVES && dist[li(ex, ey, ez)] === 0)
          Q.decayQ.push(idx(ex, ey, ez));
}

export function decayTick(budget) {
  budget = budget || 3;
  var gone = 0;
  while (Q.decayHead < Q.decayQ.length && gone < budget) {
    var i = Q.decayQ[Q.decayHead++];
    if (world[i] !== LEAVES) continue;
    var y = (i / PLANE) | 0, rem = i - y * PLANE;
    var z = (rem / WX) | 0, x = rem - z * WX;
    burst(x, y, z, LEAVES, 5);
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
      for (var h = 0; h < 6; h++) {
        if (DIRS[h][1] !== 0) continue;  // 옆으로만
        var nx2 = x + DIRS[h][0], nz2 = z + DIRS[h][2];
        if (get(nx2, y, nz2) !== WATER) continue;
        // 단단한 바닥을 딛고 있는 물만 옆으로 퍼진다 — 떨어지는 물기둥은 퍼지지 않는다
        if (!isSolid(get(nx2, y - 1, nz2))) continue;
        var cand = waterLvl[idx(nx2, y, nz2)] + 1;
        if (cand > MAXFLOW) continue;
        if (lvl < 0 || cand < lvl) lvl = cand;
      }
    }
    if (lvl < 0) continue;

    world[i] = WATER;
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
