// player.js — 플레이어 · 충돌 · 레이캐스트
import { S } from "./state.js";
import { WX, WY, WZ, idx, inside } from "./dims.js";
import { AIR, CROSS, SH_FULL, SH_SLAB, SH_SLAB_UP, SH_STAIR_E, SH_STAIR_N, SH_STAIR_S, SH_STAIR_W, SH_UP_OFF, crossOffset, isCross, isLiquid, isSolid } from "./blocks.js";
import { boxesAt, crossBase, get, hasDynamicBoxes, set, shape, shapeAt, world } from "./world.js";
import { camera } from "./scene.js";

export var HALF = 0.3, BODY = 1.78, EYE = 1.62;
export var player = {
  pos: new THREE.Vector3(WX / 2, 30, WZ / 2),
  vel: new THREE.Vector3(),
  yaw: 0, pitch: 0,
  onGround: false, flying: false
};
export var stats = { placed: 0, mined: 0 };
// upper — 블록 윗쪽 절반을 클릭했거나 천장에 붙일 때는 위 변형으로
export function currentShape(upper) {
  if (S.shapeMode === 1) return upper ? SH_SLAB_UP : SH_SLAB;
  if (S.shapeMode === 2) {
    var fx = -Math.sin(player.yaw), fz = -Math.cos(player.yaw);
    var base;
    if (Math.abs(fx) > Math.abs(fz)) base = fx > 0 ? SH_STAIR_W : SH_STAIR_E;
    else base = fz > 0 ? SH_STAIR_N : SH_STAIR_S;
    return upper ? base + SH_UP_OFF : base;
  }
  return SH_FULL;
}

export function spawn() {
  // 직접 정해 둔 시작 지점이 있으면 거기로 (V 키)
  if (S.spawnPoint) {
    player.pos.set(S.spawnPoint[0], S.spawnPoint[1], S.spawnPoint[2]);
    player.vel.set(0, 0, 0);
    player.flying = false;
    return;
  }
  var sx = Math.floor(WX / 2), sz = Math.floor(WZ / 2);
  var top = WY - 1;
  while (top > 0 && get(sx, top, sz) === AIR) top--;
  player.pos.set(sx + 0.5, top + 1.2, sz + 0.5);
  player.vel.set(0, 0, 0);
  player.yaw = Math.PI * 0.25; player.pitch = -0.15;
  player.flying = false;
}

export function boxHitsWorld(px, py, pz) {
  var x0 = Math.floor(px - HALF), x1 = Math.floor(px + HALF);
  var y0 = Math.floor(py), y1 = Math.floor(py + BODY);
  var z0 = Math.floor(pz - HALF), z1 = Math.floor(pz + HALF);
  var aX = px - HALF, bX = px + HALF, aY = py, bY = py + BODY, aZ = pz - HALF, bZ = pz + HALF;
  for (var x = x0; x <= x1; x++) {
    for (var y = y0; y <= y1; y++) {
      for (var z = z0; z <= z1; z++) {
        var cb = get(x, y, z);
        if (!isSolid(cb)) continue;
        var sh = shapeAt(x, y, z);
        if (sh === SH_FULL && !hasDynamicBoxes(cb)) return true;
        var boxes = boxesAt(cb, sh, x, y, z);
        for (var k = 0; k < boxes.length; k++) {
          var q = boxes[k];
          if (bX > x + q[0] && aX < x + q[3] &&
              bY > y + q[1] && aY < y + q[4] &&
              bZ > z + q[2] && aZ < z + q[5]) return true;
        }
      }
    }
  }
  return false;
}

// 한 번에 크게 밀면 얇은 바닥·벽을 그대로 통과해 버린다 (도착지만 비어 있으면 통과)
// 0.4칸씩 끊어서 밀어 낙하 중 지형을 뚫고 지하에 갇히는 일을 막는다
export var SWEEP = 0.4;
export function moveAxis(axis, amount) {
  if (amount === 0) return;
  if (Math.abs(amount) <= SWEEP) { moveAxisStep(axis, amount); return; }
  var n = Math.ceil(Math.abs(amount) / SWEEP), part = amount / n;
  for (var i = 0; i < n; i++) {
    var was = player.pos[axis];
    moveAxisStep(axis, part);
    if (Math.abs(player.pos[axis] - was) < Math.abs(part) - 1e-9) return;   // 막혔으면 거기까지
  }
}

export function moveAxisStep(axis, amount) {
  if (amount === 0) return;
  var p = player.pos;
  var before = p[axis];
  p[axis] += amount;
  if (!boxHitsWorld(p.x, p.y, p.z)) return;

  p[axis] = before;
  var step = amount > 0 ? 0.001 : -0.001;
  var guard = 0;
  while (guard++ < 2000) {
    p[axis] += step;
    if (boxHitsWorld(p.x, p.y, p.z)) { p[axis] -= step; break; }
    if (Math.abs(p[axis] - before) >= Math.abs(amount)) break;
  }
  if (axis === "y") {
    if (amount < 0) player.onGround = true;
    player.vel.y = 0;
  } else {
    player.vel[axis] = 0;
  }
}

// 한 점이 단단한 블록 안에 있는가 — 눈이 블록에 파묻혔는지 보는 데 쓴다
export function pointSolid(px, py, pz) {
  var x = Math.floor(px), y = Math.floor(py), z = Math.floor(pz);
  if (!inside(x, y, z)) return false;
  var b = world[idx(x, y, z)];
  if (!isSolid(b)) return false;
  var sh = shapeAt(x, y, z);
  if (sh === SH_FULL && !hasDynamicBoxes(b)) return true;
  var boxes = boxesAt(b, sh, x, y, z);
  for (var k = 0; k < boxes.length; k++) {
    var q = boxes[k];
    if (px > x + q[0] && px < x + q[3] &&
        py > y + q[1] && py < y + q[4] &&
        pz > z + q[2] && pz < z + q[5]) return true;
  }
  return false;
}

// 플레이어 몸이 이 칸을 차지하고 있는가 — 물이 얼거나 모래가 내려앉을 때 몸을 덮지 않게 한다
export function playerOccupies(x, y, z) {
  if (!S.active) return false;
  var p = player.pos;
  return x + 1 > p.x - HALF && x < p.x + HALF &&
         z + 1 > p.z - HALF && z < p.z + HALF &&
         y + 1 > p.y && y < p.y + BODY;
}

// 블록에 묻혔을 때 빠져나오기 — 물이 얼거나 모래가 덮치거나 반쯤 겹친 자리에 놓이면
// moveAxis 가 모든 축을 막아 영영 못 움직인다. 가장 가까운 빈 자리로 밀어낸다
export function unstick() {
  var p = player.pos;
  if (!boxHitsWorld(p.x, p.y, p.z)) return false;
  for (var up = 0.1; up <= 3.001; up += 0.1) {            // 1) 위 — 가장 흔한 탈출로
    if (!boxHitsWorld(p.x, p.y + up, p.z)) { p.y += up; player.vel.set(0, 0, 0); return true; }
  }
  var dirs = [[1, 0], [-1, 0], [0, 1], [0, -1], [1, 1], [1, -1], [-1, 1], [-1, -1]];
  for (var d = 0.2; d <= 1.601; d += 0.2) {               // 2) 옆
    for (var i = 0; i < dirs.length; i++) {
      var nx = p.x + dirs[i][0] * d, nz = p.z + dirs[i][1] * d;
      if (!boxHitsWorld(nx, p.y, nz)) { p.x = nx; p.z = nz; player.vel.set(0, 0, 0); return true; }
    }
  }
  for (var dn = 0.1; dn <= 3.001; dn += 0.1) {            // 3) 아래 — 마지막 수단
    if (!boxHitsWorld(p.x, p.y - dn, p.z)) { p.y -= dn; player.vel.set(0, 0, 0); return true; }
  }
  return false;
}

// 발밑을 살짝 낮춰 봐서 딛을 것이 있는지 — 웅크리기 낙하 방지에 쓴다
export function footSupported(px, py, pz) {
  return boxHitsWorld(px, py - 0.08, pz);
}

export var STEP_UP = 0.6; // 마크와 같은 스텝 높이 — 반블록·계단은 걸어서, 1블록은 점프해서

export function moveHorizontal(dx, dz) {
  var p = player.pos;
  var fromX = p.x, fromZ = p.z, fromY = p.y;

  // 웅크리기 — 딛고 선 면 밖으로는 발을 내밀지 않는다
  if (S.sneaking && player.onGround && !player.flying && footSupported(p.x, p.y, p.z)) {
    var keepX = p.x;
    moveAxis("x", dx);
    if (!footSupported(p.x, p.y, p.z)) { p.x = keepX; player.vel.x = 0; }
    var keepZ = p.z;
    moveAxis("z", dz);
    if (!footSupported(p.x, p.y, p.z)) { p.z = keepZ; player.vel.z = 0; }
    return;
  }

  moveAxis("x", dx);
  moveAxis("z", dz);
  var blocked = (Math.abs(dx) > 0.0001 && Math.abs(p.x - fromX) < Math.abs(dx) * 0.5) ||
                (Math.abs(dz) > 0.0001 && Math.abs(p.z - fromZ) < Math.abs(dz) * 0.5);
  if (!blocked || player.flying || !player.onGround) return;

  var tryX = p.x, tryZ = p.z;
  p.x = fromX; p.z = fromZ; p.y = fromY + STEP_UP;
  if (boxHitsWorld(p.x, p.y, p.z)) { p.x = tryX; p.z = tryZ; p.y = fromY; return; }
  moveAxis("x", dx);
  moveAxis("z", dz);
  var wantX = Math.abs(dx), wantZ = Math.abs(dz);
  var okX = wantX <= 0.0001 || Math.abs(p.x - fromX) >= wantX * 0.9;
  var okZ = wantZ <= 0.0001 || Math.abs(p.z - fromZ) >= wantZ * 0.9;
  if (!okX || !okZ) {          // 올라서고도 여전히 막혀 있으면 없던 일로
    p.x = tryX; p.z = tryZ; p.y = fromY;
    return;
  }
  // 올라선 뒤에는 딛는 면까지 도로 내려 붙인다 — 0.1칸 떠 있다 툭 떨어지는 튐을 없앤다
  var settle = p.y;
  while (settle - 0.005 > fromY) {
    settle -= 0.005;
    if (boxHitsWorld(p.x, settle, p.z)) { settle += 0.005; break; }
  }
  p.y = settle;
  player.onGround = true;
  player.vel.y = 0;
}

export var _ro = new THREE.Vector3(), _rd = new THREE.Vector3();
export var _oA = [0, 0, 0], _dA = [0, 0, 0], _mn = [0, 0, 0], _mx = [0, 0, 0];

export function rayBox(o, d, mn, mx, maxT) {
  var tmin = 0, tmax = maxT, hitAxis = -1, hitSign = 0;
  for (var a = 0; a < 3; a++) {
    if (Math.abs(d[a]) < 1e-9) {
      if (o[a] < mn[a] || o[a] > mx[a]) return null;
      continue;
    }
    var inv = 1 / d[a];
    var t1 = (mn[a] - o[a]) * inv, t2 = (mx[a] - o[a]) * inv;
    if (t1 > t2) { var tmp = t1; t1 = t2; t2 = tmp; }
    if (t1 > tmin) { tmin = t1; hitAxis = a; hitSign = d[a] > 0 ? -1 : 1; }
    if (t2 < tmax) tmax = t2;
    if (tmin > tmax) return null;
  }
  if (hitAxis < 0) return null;
  return { t: tmin, axis: hitAxis, sign: hitSign };
}
export function raycast(maxDist) {
  camera.getWorldDirection(_rd);
  _ro.copy(player.pos); _ro.y += EYE;

  var x = Math.floor(_ro.x), y = Math.floor(_ro.y), z = Math.floor(_ro.z);
  var sx = _rd.x > 0 ? 1 : -1, sy = _rd.y > 0 ? 1 : -1, sz = _rd.z > 0 ? 1 : -1;
  var dx = Math.abs(1 / _rd.x), dy = Math.abs(1 / _rd.y), dz = Math.abs(1 / _rd.z);
  var mx = (_rd.x > 0 ? (x + 1 - _ro.x) : (_ro.x - x)) * dx;
  var my = (_rd.y > 0 ? (y + 1 - _ro.y) : (_ro.y - y)) * dy;
  var mz = (_rd.z > 0 ? (z + 1 - _ro.z) : (_ro.z - z)) * dz;
  var nx = 0, ny = 0, nz = 0, t = 0;

  while (t <= maxDist) {
    if (inside(x, y, z)) {
      var ci = idx(x, y, z);
      var b = world[ci];
      if (b !== AIR && !isLiquid(b)) {
        var sh = shape[ci];
        if (isCross(b)) {
          var cg = CROSS[b];
          _oA[0] = _ro.x; _oA[1] = _ro.y; _oA[2] = _ro.z;
          _dA[0] = _rd.x; _dA[1] = _rd.y; _dA[2] = _rd.z;
          // 조준 상자는 실제로 그려지는 자리와 같아야 한다 (반블록 위·벽 붙임 포함)
          var co = crossOffset(sh);
          var cyb = co[1] ? y + co[1] : crossBase(x, y, z);
          _mn[0] = x + 0.5 + co[0] - cg.w; _mn[1] = cyb; _mn[2] = z + 0.5 + co[2] - cg.w;
          _mx[0] = x + 0.5 + co[0] + cg.w; _mx[1] = cyb + cg.h; _mx[2] = z + 0.5 + co[2] + cg.w;
          var rc = rayBox(_oA, _dA, _mn, _mx, maxDist);
          if (rc) {
            var nc = [0, 0, 0];
            nc[rc.axis] = rc.sign;
            return { x: x, y: y, z: z, nx: nc[0], ny: nc[1], nz: nc[2], block: b, shape: sh,
                     t: rc.t, hitY: _ro.y + _rd.y * rc.t, cross: true };
          }
        } else if (sh === SH_FULL && !hasDynamicBoxes(b)) {
          return { x: x, y: y, z: z, nx: nx, ny: ny, nz: nz, block: b, shape: sh,
                   t: t, hitY: _ro.y + _rd.y * t };
        }
        _oA[0] = _ro.x; _oA[1] = _ro.y; _oA[2] = _ro.z;
        _dA[0] = _rd.x; _dA[1] = _rd.y; _dA[2] = _rd.z;
        var boxes = boxesAt(b, sh, x, y, z), best = null;
        for (var bb = 0; bb < boxes.length; bb++) {
          var q = boxes[bb];
          _mn[0] = x + q[0]; _mn[1] = y + q[1]; _mn[2] = z + q[2];
          _mx[0] = x + q[3]; _mx[1] = y + q[4]; _mx[2] = z + q[5];
          var r = rayBox(_oA, _dA, _mn, _mx, maxDist);
          if (r && (!best || r.t < best.t)) best = r;
        }
        if (best) {
          var nn = [0, 0, 0];
          nn[best.axis] = best.sign;
          return { x: x, y: y, z: z, nx: nn[0], ny: nn[1], nz: nn[2], block: b, shape: sh,
                   t: best.t, hitY: _ro.y + _rd.y * best.t };
        }
      }
    }
    if (mx < my && mx < mz) { x += sx; t = mx; mx += dx; nx = -sx; ny = 0; nz = 0; }
    else if (my < mz) { y += sy; t = my; my += dy; nx = 0; ny = -sy; nz = 0; }
    else { z += sz; t = mz; mz += dz; nx = 0; ny = 0; nz = -sz; }
  }
  return null;
}
