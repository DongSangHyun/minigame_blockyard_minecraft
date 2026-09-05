// mesh.js — 면 데이터 + 청크 메싱
import { CH, CX, CY, CZ, DIRS, WX, WY, WZ, idx, inside } from "./dims.js";
import { AIR, CROSS, SHAPE_BOXES, SH_FULL, TILES, WATER, blocksLight, isCross, isTransparent, lightPass } from "./blocks.js";
import { TILE, atlas, tileOrigin } from "./atlas.js";
import { crossBase, get, shape, shapeAt, world } from "./world.js";
import { lightBlk, lightSky } from "./light.js";

export var FACES = [
  { dir: [1, 0, 0],  shade: 0.80, kind: 1, c: [[1,1,0,1,1],[1,0,0,1,0],[1,1,1,0,1],[1,0,1,0,0]] },
  { dir: [-1, 0, 0], shade: 0.66, kind: 1, c: [[0,1,1,1,1],[0,0,1,1,0],[0,1,0,0,1],[0,0,0,0,0]] },
  { dir: [0, 1, 0],  shade: 1.00, kind: 0, c: [[0,1,1,0,1],[1,1,1,1,1],[0,1,0,0,0],[1,1,0,1,0]] },
  { dir: [0, -1, 0], shade: 0.50, kind: 2, c: [[1,0,1,1,0],[0,0,1,0,0],[1,0,0,1,1],[0,0,0,0,1]] },
  { dir: [0, 0, 1],  shade: 0.88, kind: 1, c: [[0,0,1,0,0],[1,0,1,1,0],[0,1,1,0,1],[1,1,1,1,1]] },
  { dir: [0, 0, -1], shade: 0.72, kind: 1, c: [[1,0,0,0,0],[0,0,0,1,0],[1,1,0,0,1],[0,1,0,1,1]] }
];
export var FACE_UV = (function () {
  var list = [];
  for (var f = 0; f < 6; f++) {
    var face = FACES[f];
    var na = face.dir[0] !== 0 ? 0 : (face.dir[1] !== 0 ? 1 : 2);
    var info = { na: na, uAxis: -1, uFlip: false, vAxis: -1, vFlip: false };
    for (var slot = 0; slot < 2; slot++) {
      var col = slot === 0 ? 3 : 4;
      for (var a = 0; a < 3; a++) {
        if (a === na) continue;
        var direct = true, flip = true;
        for (var v = 0; v < 4; v++) {
          if (face.c[v][col] !== face.c[v][a]) direct = false;
          if (face.c[v][col] !== 1 - face.c[v][a]) flip = false;
        }
        if (direct || flip) {
          if (slot === 0) { info.uAxis = a; info.uFlip = !direct; }
          else { info.vAxis = a; info.vFlip = !direct; }
        }
      }
    }
    list.push(info);
  }
  return list;
})();

export var AO_LEVELS = [0.52, 0.70, 0.85, 1.0];
export function aoValue(s1, s2, cor) { return (s1 && s2) ? 0 : 3 - (s1 + s2 + cor); }

export var opaqueMeshes = [], glassMeshes = [];
export var chunkFilled = new Uint8Array(CX * CY * CZ);
export var chunkCenters = [];

export function chunkId(cx, cy, cz) { return (cy * CZ + cz) * CX + cx; }
export function chunkCX(id) { return id % CX; }
export function chunkCZ(id) { return ((id / CX) | 0) % CZ; }
export function chunkCY(id) { return (id / (CX * CZ)) | 0; }

export function buildChunk(cx, cy, cz) {
  var pos = [], uv = [], col = [], lit = [], ind = [];
  var tpos = [], tuv = [], tcol = [], tlit = [], tind = [];
  var x0 = cx * CH, y0 = cy * CH, z0 = cz * CH;

  for (var x = x0; x < x0 + CH; x++) {
    for (var z = z0; z < z0 + CH; z++) {
      for (var y = y0; y < y0 + CH; y++) {
        var ci = idx(x, y, z);
        var b = world[ci];
        if (b === AIR) continue;

        // 풀·꽃·횃불 — 두 장의 판이 X 자로 교차한다 (양면 모두 그린다)
        if (isCross(b)) {
          emitCross(pos, uv, col, lit, ind, x, y, z, b, ci);
          continue;
        }

        var sh = shape[ci];
        var boxes = SHAPE_BOXES[sh] || SHAPE_BOXES[0];

        var trans = isTransparent(b);
        var P = trans ? tpos : pos, U = trans ? tuv : uv,
            C = trans ? tcol : col, L = trans ? tlit : lit, I = trans ? tind : ind;
        var waterTop = (b === WATER && get(x, y + 1, z) !== WATER) ? 1 : 0;

        for (var bi = 0; bi < boxes.length; bi++) {
          var box = boxes[bi];
          for (var f = 0; f < 6; f++) {
            var face = FACES[f];
            var uvi = FACE_UV[f];
            var na = uvi.na;
            var positive = face.dir[na] > 0;
            var flush = positive ? (box[na + 3] === 1) : (box[na] === 0);

            var ax = x + face.dir[0], ay = y + face.dir[1], az = z + face.dir[2];
            if (flush && (ax < 0 || ax >= WX || az < 0 || az >= WZ)) continue;

            if (flush) {
              var n = get(ax, ay, az);
              if (n !== AIR && !isCross(n)) {
                var nFull = shapeAt(ax, ay, az) === SH_FULL;
                if (nFull && (!isTransparent(n) || n === b)) continue;
              }
            }

            var to = tileOrigin(TILES[b][face.kind]);
            var u0 = to[0] / atlas.width, v0 = 1 - (to[1] + TILE) / atlas.height;
            var us = TILE / atlas.width;

            var base = P.length / 3;
            var ta = (na + 1) % 3, tb = (na + 2) % 3;

            for (var v = 0; v < 4; v++) {
              var cd = face.c[v];
              // 단위 큐브의 0/1 대신 상자의 최소·최대를 쓴다
              var lx = cd[0] === 0 ? box[0] : box[3];
              var ly = cd[1] === 0 ? box[1] : box[4];
              var lz = cd[2] === 0 ? box[2] : box[5];
              var local = [lx, ly, lz];

              var isTopVert = waterTop && ly === 1;
              P.push(x + lx, y + ly - (isTopVert ? 0.12 : 0), z + lz);

              var uu = local[uvi.uAxis], vv = local[uvi.vAxis];
              if (uvi.uFlip) uu = 1 - uu;
              if (uvi.vFlip) vv = 1 - vv;
              U.push(u0 + uu * us, v0 + vv * us);

              var off = [0, 0, 0];
              off[na] = face.dir[na];
              var da = cd[ta] === 1 ? 1 : -1, db = cd[tb] === 1 ? 1 : -1;
              var o1 = off.slice(); o1[ta] += da;
              var o2 = off.slice(); o2[tb] += db;
              var oc = off.slice(); oc[ta] += da; oc[tb] += db;

              var s1 = blocksLight(get(x + o1[0], y + o1[1], z + o1[2])) ? 1 : 0;
              var s2 = blocksLight(get(x + o2[0], y + o2[1], z + o2[2])) ? 1 : 0;
              var sc = blocksLight(get(x + oc[0], y + oc[1], z + oc[2])) ? 1 : 0;
              var lum = face.shade * AO_LEVELS[aoValue(s1, s2, sc)];
              C.push(lum, lum, lum);

              var skySum = 0, blkSum = 0, cnt = 0;
              var cells = [[ax, ay, az],
                           [x + o1[0], y + o1[1], z + o1[2]],
                           [x + o2[0], y + o2[1], z + o2[2]],
                           [x + oc[0], y + oc[1], z + oc[2]]];
              for (var q = 0; q < 4; q++) {
                var cxx = cells[q][0], cyy = cells[q][1], czz = cells[q][2];
                if (!inside(cxx, cyy, czz)) {
                  if (cyy >= WY) { skySum += 15; cnt++; }
                  continue;
                }
                var li = idx(cxx, cyy, czz);
                if (!lightPass(world[li])) continue;
                skySum += lightSky[li]; blkSum += lightBlk[li]; cnt++;
              }
              if (cnt === 0) {
                if (inside(ax, ay, az)) {
                  var ai = idx(ax, ay, az);
                  skySum = lightSky[ai]; blkSum = lightBlk[ai];
                } else if (ay >= WY) { skySum = 15; blkSum = 0; }
                cnt = 1;
              }
              L.push(skySum / cnt / 15, blkSum / cnt / 15, isTopVert ? 1 : 0);
            }
            I.push(base, base + 1, base + 2, base + 2, base + 1, base + 3);
          }
        }
      }
    }
  }

  var id = chunkId(cx, cy, cz);
  applyGeo(opaqueMeshes[id], pos, uv, col, lit, ind);
  applyGeo(glassMeshes[id], tpos, tuv, tcol, tlit, tind);
  chunkFilled[id] = ind.length > 0 || tind.length > 0;
}

// X 자 두 판 × 앞뒷면 = 쿼드 4장. 빛은 자기 칸의 값을 그대로 쓴다.
export var CROSS_PLANES = [[1, 1], [1, -1]];
export function emitCross(P, U, C, L, I, x, y, z, b, ci) {
  var cfg = CROSS[b];
  var to = tileOrigin(TILES[b][0]);
  var u0 = to[0] / atlas.width, v0 = 1 - (to[1] + TILE) / atlas.height;
  var us = TILE / atlas.width;
  var sky = lightSky[ci] / 15, blk = lightBlk[ci] / 15;
  var cxw = x + 0.5, czw = z + 0.5;
  var yb = crossBase(x, y, z);

  for (var pl = 0; pl < 2; pl++) {
    var dx = CROSS_PLANES[pl][0] * cfg.w, dz = CROSS_PLANES[pl][1] * cfg.w;
    var ax0 = cxw - dx, az0 = czw - dz;
    var ax1 = cxw + dx, az1 = czw + dz;
    for (var side = 0; side < 2; side++) {
      var base = P.length / 3;
      // 아래 왼 · 아래 오른 · 위 오른 · 위 왼
      var xs = side === 0 ? [ax0, ax1, ax1, ax0] : [ax1, ax0, ax0, ax1];
      var zs = side === 0 ? [az0, az1, az1, az0] : [az1, az0, az0, az1];
      var ys = [yb, yb, yb + cfg.h, yb + cfg.h];
      var uus = side === 0 ? [0, 1, 1, 0] : [1, 0, 0, 1];
      var vvs = [0, 0, 1, 1];
      for (var v = 0; v < 4; v++) {
        P.push(xs[v], ys[v], zs[v]);
        U.push(u0 + uus[v] * us, v0 + vvs[v] * us);
        C.push(1, 1, 1);
        L.push(sky, blk, vvs[v] === 1 ? cfg.sway : 0);
      }
      I.push(base, base + 1, base + 2, base, base + 2, base + 3);
    }
  }
}

export function applyGeo(mesh, pos, uv, col, lit, ind) {
  var g = mesh.geometry;
  g.setAttribute("position", new THREE.BufferAttribute(new Float32Array(pos), 3));
  g.setAttribute("uv", new THREE.BufferAttribute(new Float32Array(uv), 2));
  g.setAttribute("acol", new THREE.BufferAttribute(new Float32Array(col), 3));
  g.setAttribute("alight", new THREE.BufferAttribute(new Float32Array(lit), 3));
  g.setIndex(ind.length > 65000 ? new THREE.BufferAttribute(new Uint32Array(ind), 1)
                                : new THREE.BufferAttribute(new Uint16Array(ind), 1));
  g.computeBoundingSphere();
  mesh.userData.hasGeo = ind.length > 0;
  mesh.visible = mesh.userData.hasGeo;
}

export var dirty = new Set();
export function markDirty(x, y, z) {
  var cx = (x / CH) | 0, cy = (y / CH) | 0, cz = (z / CH) | 0;
  if (x < 0 || y < 0 || z < 0) return;
  if (cx >= CX || cy >= CY || cz >= CZ) return;
  dirty.add(chunkId(cx, cy, cz));
}
export function touch(x, y, z) {
  markDirty(x, y, z);
  for (var d = 0; d < 6; d++) markDirty(x + DIRS[d][0], y + DIRS[d][1], z + DIRS[d][2]);
}
export function rebuildAll() {
  for (var id = 0; id < CX * CY * CZ; id++) buildChunk(chunkCX(id), chunkCY(id), chunkCZ(id));
  dirty.clear();
}
// 한 프레임에 몰아 굽지 않고 예산에 맞춰 나눠 굽는다
export function markAllDirty() {
  for (var id = 0; id < CX * CY * CZ; id++) dirty.add(id);
}
export function buildBudget(ms) {
  if (!dirty.size) return 0;
  var t0 = (window.performance && performance.now) ? performance.now() : Date.now();
  var ids = [];
  dirty.forEach(function (id) { ids.push(id); });
  var built = 0;
  for (var k = 0; k < ids.length; k++) {
    buildChunk(chunkCX(ids[k]), chunkCY(ids[k]), chunkCZ(ids[k]));
    dirty.delete(ids[k]);
    built++;
    var now = (window.performance && performance.now) ? performance.now() : Date.now();
    if (now - t0 > ms) break;
  }
  return built;
}
