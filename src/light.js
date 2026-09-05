// light.js — 광원 — 햇빛과 블록광 BFS
import { S } from "./state.js";
import { CH, DIRS, N, PLANE, WX, WY, WZ, idx } from "./dims.js";
import { EMIT, lightPass } from "./blocks.js";
import { set, world } from "./world.js";
import { markDirty } from "./mesh.js";
import { player } from "./player.js";

export var lightSky = new Uint8Array(N), lightBlk = new Uint8Array(N);
export var prevSky = new Uint8Array(N), prevBlk = new Uint8Array(N);

export function idx3(x, y, z) {
  return (x < 0 || x >= WX || y < 0 || y >= WY || z < 0 || z >= WZ) ? -1 : idx(x, y, z);
}

// 빛이 바뀐 칸이 속한 청크(와 경계라면 이웃 청크)를 다시 굽도록 표시
export function markLightCell(i) {
  var y = (i / PLANE) | 0, rem = i - y * PLANE, z = (rem / WX) | 0, x = rem - z * WX;
  markDirty(x, y, z);
  if (x % CH === 0) markDirty(x - 1, y, z);
  if (x % CH === CH - 1) markDirty(x + 1, y, z);
  if (y % CH === 0) markDirty(x, y - 1, z);
  if (y % CH === CH - 1) markDirty(x, y + 1, z);
  if (z % CH === 0) markDirty(x, y, z - 1);
  if (z % CH === CH - 1) markDirty(x, y, z + 1);
}

export function spreadLight(arr, queue, track) {
  var head = 0;
  while (head < queue.length) {
    var i = queue[head++];
    var L = arr[i];
    if (L <= 1) continue;
    var y = (i / PLANE) | 0;
    var rem = i - y * PLANE;
    var z = (rem / WX) | 0;
    var x = rem - z * WX;
    for (var d = 0; d < 6; d++) {
      var nx = x + DIRS[d][0], ny = y + DIRS[d][1], nz = z + DIRS[d][2];
      if (nx < 0 || nx >= WX || ny < 0 || ny >= WY || nz < 0 || nz >= WZ) continue;
      var ni = idx(nx, ny, nz);
      if (!lightPass(world[ni])) continue;
      if (arr[ni] < L - 1) {
        arr[ni] = L - 1;
        if (track) markLightCell(ni);
        queue.push(ni);
      }
    }
  }
}

// 빛을 지우면서, 바깥에서 다시 흘러들 수 있는 칸들을 모아 돌려준다
export function removeLightBFS(arr, start, track) {
  var isSky = (arr === lightSky);
  var q = [start], lv = [arr[start]], relight = [], head = 0;
  arr[start] = 0;
  if (track) markLightCell(start);
  while (head < q.length) {
    var i = q[head], L = lv[head];
    head++;
    var y = (i / PLANE) | 0, rem = i - y * PLANE, z = (rem / WX) | 0, x = rem - z * WX;
    for (var d = 0; d < 6; d++) {
      var nx = x + DIRS[d][0], ny = y + DIRS[d][1], nz = z + DIRS[d][2];
      if (nx < 0 || nx >= WX || ny < 0 || ny >= WY || nz < 0 || nz >= WZ) continue;
      var ni = idx(nx, ny, nz);
      var nl = arr[ni];
      if (nl === 0) continue;
      // 햇빛은 아래로 감쇠 없이 내려오므로 같은 15여도 함께 지운다
      var sunColumn = isSky && L === 15 && DIRS[d][1] === -1 && nl === 15;
      if (nl < L || sunColumn) {
        arr[ni] = 0;
        if (track) markLightCell(ni);
        q.push(ni); lv.push(nl);
      } else {
        relight.push(ni);
      }
    }
  }
  return relight;
}

// 한 칸이 바뀌었을 때의 국소 재계산 — 전체 재계산과 결과가 같아야 한다
export function relightLocal(x, y, z) {
  var i = idx3(x, y, z);
  if (i < 0) return;
  var d, n;

  // 블록광
  var addB = lightBlk[i] > 0 ? removeLightBFS(lightBlk, i, true) : [];
  var emit = EMIT[world[i]] || 0;
  if (emit) { lightBlk[i] = emit; markLightCell(i); addB.push(i); }
  for (d = 0; d < 6; d++) {
    n = idx3(x + DIRS[d][0], y + DIRS[d][1], z + DIRS[d][2]);
    if (n >= 0 && lightBlk[n] > 0) addB.push(n);
  }
  if (addB.length) spreadLight(lightBlk, addB, true);

  // 햇빛
  var addS = lightSky[i] > 0 ? removeLightBFS(lightSky, i, true) : [];
  if (lightPass(world[i])) {
    var aboveIdx = idx3(x, y + 1, z);
    var openAbove = (aboveIdx < 0) ||
                    (lightPass(world[aboveIdx]) && lightSky[aboveIdx] === 15);
    if (openAbove) {
      var yy = y;
      while (yy >= 0 && lightPass(world[idx(x, yy, z)])) {
        var ci = idx(x, yy, z);
        if (lightSky[ci] !== 15) { lightSky[ci] = 15; markLightCell(ci); addS.push(ci); }
        yy--;
      }
    }
  }
  for (d = 0; d < 6; d++) {
    n = idx3(x + DIRS[d][0], y + DIRS[d][1], z + DIRS[d][2]);
    if (n >= 0 && lightSky[n] > 0) addS.push(n);
  }
  if (addS.length) spreadLight(lightSky, addS, true);
}

// markChanges 를 주면 값이 바뀐 칸이 속한 청크만 다시 굽는다
export function relightAll(markChanges) {
  if (markChanges) { prevSky.set(lightSky); prevBlk.set(lightBlk); }
  lightSky.fill(0); lightBlk.fill(0);

  var q = [];
  for (var x = 0; x < WX; x++) {
    for (var z = 0; z < WZ; z++) {
      for (var y = WY - 1; y >= 0; y--) {
        var i = idx(x, y, z);
        if (!lightPass(world[i])) break;
        lightSky[i] = 15;
        q.push(i);
      }
    }
  }
  spreadLight(lightSky, q);

  var q2 = [];
  for (var k = 0; k < N; k++) {
    var e = EMIT[world[k]];
    if (e) { lightBlk[k] = e; q2.push(k); }
  }
  spreadLight(lightBlk, q2);

  if (markChanges) {
    for (var j = 0; j < N; j++) {
      if (lightSky[j] === prevSky[j] && lightBlk[j] === prevBlk[j]) continue;
      var yy = (j / PLANE) | 0;
      var rr = j - yy * PLANE;
      var zz = (rr / WX) | 0;
      var xx = rr - zz * WX;
      markDirty(xx, yy, zz);
      if (xx % CH === 0) markDirty(xx - 1, yy, zz);
      if (xx % CH === CH - 1) markDirty(xx + 1, yy, zz);
      if (yy % CH === 0) markDirty(xx, yy - 1, zz);
      if (yy % CH === CH - 1) markDirty(xx, yy + 1, zz);
      if (zz % CH === 0) markDirty(xx, yy, zz - 1);
      if (zz % CH === CH - 1) markDirty(xx, yy, zz + 1);
    }
  }
}

export function relightSoon() { S.relightQueued = true; }

export function lightAtPlayer() {
  var i = idx(
    Math.min(WX - 1, Math.max(0, Math.floor(player.pos.x))),
    Math.min(WY - 1, Math.max(0, Math.floor(player.pos.y + 1))),
    Math.min(WZ - 1, Math.max(0, Math.floor(player.pos.z)))
  );
  return Math.max(lightSky[i], lightBlk[i]);
}
