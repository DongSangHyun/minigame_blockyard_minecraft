// mesh.js — 면 데이터 + 청크 메싱
import { CH, CX, CY, CZ, DIRS, WX, WY, WZ, idx, inside } from "./dims.js";
import { AIR, CROSS, SH_FULL, TILES, WATER, blocksLight, crossOffset, faceKindFor, isCross, isTransparent, lightPass } from "./blocks.js";
import { TILE, atlas, tileOrigin } from "./atlas.js";
import { boxesAt, crossBase, get, hasDynamicBoxes, shape, shapeAt, world } from "./world.js";
import { lightBlk, lightSky } from "./light.js";

export var FACES = [
  // x 면의 두 정점 순서가 뒤집혀 있어 뒷면 제거에 걸려 통째로 안 보였다 (v21)
  { dir: [1, 0, 0],  shade: 0.80, kind: 1, c: [[1,1,0,1,1],[1,1,1,0,1],[1,0,0,1,0],[1,0,1,0,0]] },
  { dir: [-1, 0, 0], shade: 0.66, kind: 1, c: [[0,1,1,1,1],[0,1,0,0,1],[0,0,1,1,0],[0,0,0,0,0]] },
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


// ── 면 병합 (greedy meshing · v102)
// 평평한 바닥·벽은 같은 면 수백 장이 나란히 선다. 네 정점의 빛·AO·타일이 **전부 같을 때만**
// 이어 붙여 큰 쿼드 하나로 만든다 (다르면 그림이 달라지므로 붙이면 안 된다).
// 붙일 수 있는 것은 **전체 큐브·불투명·모양 없음**뿐이다 — 반블록·계단·유리·물·풀은
// 기존 길로 간다. 아틀라스를 늘려 쓸 수 없어서 UV 를 타일 안 0..w 로 넘기고
// 셰이더가 fract 로 되풀이한다 (VOX_FS).
// 평면 매핑 — f 0,1 은 x 축(i=z · j=y) · 2,3 은 y 축(i=x · j=z) · 4,5 는 z 축(i=x · j=y)
var MERGE_IAXIS = [2, 2, 0, 0, 0, 0];
var MERGE_JAXIS = [1, 1, 2, 2, 1, 1];
var PLANES = 6 * CH;
var mHas = new Uint8Array(PLANES * CH * CH);
var mTile = new Float32Array(PLANES * CH * CH * 2);
var mLum = new Float32Array(PLANES * CH * CH * 4);
var mSky = new Float32Array(PLANES * CH * CH * 4);
var mBlk = new Float32Array(PLANES * CH * CH * 4);
var MERGE_LIGHT_STEPS = 31;
function mergeSlot(f, slice, i, j) {
  return ((f * CH + slice) * CH + j) * CH + i;
}
// 두 면이 **그림까지 똑같은가**. 타일과 네 정점의 빛·AO 를 낱낱이 견준다 —
// 32비트 서명으로 줄여도 봤지만 오히려 덜 붙었고(값을 잃는다) 빨라지지도 않았다
function sameFace(a, b) {
  if (mHas[b] !== 1) return false;
  if (mTile[a * 2] !== mTile[b * 2] || mTile[a * 2 + 1] !== mTile[b * 2 + 1]) return false;
  for (var v = 0; v < 4; v++) {
    if (mLum[a * 4 + v] !== mLum[b * 4 + v]) return false;
    if (mSky[a * 4 + v] !== mSky[b * 4 + v]) return false;
    if (mBlk[a * 4 + v] !== mBlk[b * 4 + v]) return false;
  }
  return true;
}
// 한 면 안에서 값을 담아 두는 자리 — 면마다 배열을 새로 만들면 병합이 메싱보다 비싸진다
var fX = [0, 0, 0, 0], fY = [0, 0, 0, 0], fZ = [0, 0, 0, 0];
var fU = [0, 0, 0, 0], fV = [0, 0, 0, 0], fTop = [0, 0, 0, 0];
var fLum = [0, 0, 0, 0], fAo = [0, 0, 0, 0], fSky = [0, 0, 0, 0], fBlk = [0, 0, 0, 0];

export function buildChunk(cx, cy, cz) {
  // 들어올 때 마스크를 비운다 (v103) — 내보내기 단계의 곁효과로만 지워지고 있어서,
  // 굽는 도중 예외가 나면 앞 청크의 면이 다음 청크에 유령으로 남는다
  mHas.fill(0);
  var pos = [], uv = [], col = [], lit = [], ind = [], tl = [];
  var tpos = [], tuv = [], tcol = [], tlit = [], tind = [], ttl = [];
  var x0 = cx * CH, y0 = cy * CH, z0 = cz * CH;

  for (var x = x0; x < x0 + CH; x++) {
    for (var z = z0; z < z0 + CH; z++) {
      for (var y = y0; y < y0 + CH; y++) {
        var ci = idx(x, y, z);
        var b = world[ci];
        if (b === AIR) continue;

        // 풀·꽃·횃불 — 두 장의 판이 X 자로 교차한다 (양면 모두 그린다)
        if (isCross(b)) {
          emitCross(pos, uv, col, lit, ind, x, y, z, b, ci, tl);
          continue;
        }

        var sh = shape[ci];
        var boxes = boxesAt(b, sh, x, y, z);

        // 붙일 수 있는 면인가 — 전체 큐브 · 불투명 · 이웃을 안 타는 모양 (v102)
        var mergeable = (sh === SH_FULL) && !isTransparent(b) && !hasDynamicBoxes(b);
        var trans = isTransparent(b);
        var P = trans ? tpos : pos, U = trans ? tuv : uv,
            C = trans ? tcol : col, L = trans ? tlit : lit, I = trans ? tind : ind,
            T = trans ? ttl : tl;
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
                var nFull = shapeAt(ax, ay, az) === SH_FULL && !hasDynamicBoxes(n);
                if (nFull && (!isTransparent(n) || n === b)) continue;
              }
            }

            var to = tileOrigin(TILES[b][faceKindFor(sh, f, face.kind)]);
            var u0 = to[0] / atlas.width, v0 = 1 - (to[1] + TILE) / atlas.height;

            // 붙일 수 있으면 지금 그리지 않고 평면 마스크에 담아 둔다 (v102)
            var slot = -1;
            if (mergeable) {
              var sliceIdx = na === 0 ? (x - x0) : (na === 1 ? (y - y0) : (z - z0));
              var mi = MERGE_IAXIS[f] === 0 ? (x - x0) : (MERGE_IAXIS[f] === 1 ? (y - y0) : (z - z0));
              var mj = MERGE_JAXIS[f] === 0 ? (x - x0) : (MERGE_JAXIS[f] === 1 ? (y - y0) : (z - z0));
              slot = mergeSlot(f, sliceIdx, mi, mj);
              mHas[slot] = 1;
              mTile[slot * 2] = u0; mTile[slot * 2 + 1] = v0;
            }
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
              fX[v] = x + lx; fY[v] = y + ly - (isTopVert ? 0.12 : 0); fZ[v] = z + lz;
              fTop[v] = isTopVert ? 1 : 0;

              var uu = local[uvi.uAxis], vv = local[uvi.vAxis];
              if (uvi.uFlip) uu = 1 - uu;
              if (uvi.vFlip) vv = 1 - vv;
              fU[v] = uu; fV[v] = vv;

              var off = [0, 0, 0];
              off[na] = face.dir[na];
              var da = cd[ta] === 1 ? 1 : -1, db = cd[tb] === 1 ? 1 : -1;
              var o1 = off.slice(); o1[ta] += da;
              var o2 = off.slice(); o2[tb] += db;
              var oc = off.slice(); oc[ta] += da; oc[tb] += db;

              var s1 = blocksLight(get(x + o1[0], y + o1[1], z + o1[2])) ? 1 : 0;
              var s2 = blocksLight(get(x + o2[0], y + o2[1], z + o2[2])) ? 1 : 0;
              var sc = blocksLight(get(x + oc[0], y + oc[1], z + oc[2])) ? 1 : 0;
              var aov = aoValue(s1, s2, sc);
              fAo[v] = aov;
              fLum[v] = face.shade * AO_LEVELS[aov];

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
              fSky[v] = skySum / cnt / 15;
              fBlk[v] = blkSum / cnt / 15;
            }

            // **면 하나 안에서 네 모서리가 같을 때만** 붙일 수 있다 (v103).
            // 이웃끼리 서명이 같은지만 보면 AO 그라데이션이 통째로 늘어난다 —
            // 울타리 옆 그늘이 사라지고 그 앞 것이 두 배 폭으로 늘어났다.
            // 빛은 이웃한 두 칸이 같은 네 칸을 표본으로 삼아 서명이 같으면 균일이 강제되지만,
            // AO 는 그 연속성이 없다
            if (slot >= 0 &&
                !(fAo[0] === fAo[1] && fAo[1] === fAo[2] && fAo[2] === fAo[3])) {
              mHas[slot] = 0;
              slot = -1;
            }
            if (slot >= 0) {
              for (var mq = 0; mq < 4; mq++) {
                mLum[slot * 4 + mq] = fLum[mq];
                // 빛은 32단계로 재서 담는다 — 15단계 값을 네 칸 평균한 것이라 종류가 많고,
                // 소수점 끝자리가 다르다는 이유로 안 붙으면 평평한 벽이 낱장으로 남는다.
                // 원래 광원 단계(15)의 절반 눈금이라 눈으로는 차이를 못 본다
                mSky[slot * 4 + mq] = Math.round(fSky[mq] * MERGE_LIGHT_STEPS) / MERGE_LIGHT_STEPS;
                mBlk[slot * 4 + mq] = Math.round(fBlk[mq] * MERGE_LIGHT_STEPS) / MERGE_LIGHT_STEPS;
              }
            } else {
              for (var eq = 0; eq < 4; eq++) {
                P.push(fX[eq], fY[eq], fZ[eq]);
                U.push(fU[eq], fV[eq]);
                T.push(u0, v0);
                C.push(fLum[eq], fLum[eq], fLum[eq]);
                L.push(fSky[eq], fBlk[eq], fTop[eq]);
              }
              I.push(base, base + 1, base + 2, base + 2, base + 1, base + 3);
            }
          }
        }
      }
    }
  }

  // ── 모아 둔 면을 이어 붙여 큰 쿼드로 낸다 (v102)
  for (var mf = 0; mf < 6; mf++) {
    var mface = FACES[mf], muvi = FACE_UV[mf];
    var mna = muvi.na;
    var iAx = MERGE_IAXIS[mf], jAx = MERGE_JAXIS[mf];
    for (var msl = 0; msl < CH; msl++) {
      for (var mjj = 0; mjj < CH; mjj++) {
        for (var mii = 0; mii < CH; mii++) {
          var a0 = mergeSlot(mf, msl, mii, mjj);
          if (!mHas[a0]) continue;
          // 가로로 늘린다
          var w = 1;
          while (mii + w < CH && sameFace(a0, mergeSlot(mf, msl, mii + w, mjj))) w++;
          // 세로로 늘린다 — 한 줄이 통째로 같아야 한다
          var h = 1, canGrow = true;
          while (mjj + h < CH && canGrow) {
            for (var kk = 0; kk < w; kk++) {
              if (!sameFace(a0, mergeSlot(mf, msl, mii + kk, mjj + h))) { canGrow = false; break; }
            }
            if (canGrow) h++;
          }
          // 쓴 자리를 지운다
          for (var cj = 0; cj < h; cj++)
            for (var cw = 0; cw < w; cw++) mHas[mergeSlot(mf, msl, mii + cw, mjj + cj)] = 0;

          // 기준 칸의 월드 좌표
          var bcoord = [0, 0, 0];
          bcoord[mna] = (mna === 0 ? x0 : (mna === 1 ? y0 : z0)) + msl;
          bcoord[iAx] = (iAx === 0 ? x0 : (iAx === 1 ? y0 : z0)) + mii;
          bcoord[jAx] = (jAx === 0 ? x0 : (jAx === 1 ? y0 : z0)) + mjj;

          var mbase = pos.length / 3;
          for (var mv = 0; mv < 4; mv++) {
            var mcd = mface.c[mv];
            var vx = bcoord[0], vy = bcoord[1], vz = bcoord[2];
            var vv3 = [vx, vy, vz];
            vv3[mna] += mcd[mna];
            vv3[iAx] += mcd[iAx] ? w : 0;
            vv3[jAx] += mcd[jAx] ? h : 0;
            pos.push(vv3[0], vv3[1], vv3[2]);

            var uSpan = muvi.uAxis === iAx ? w : h;
            var vSpan = muvi.vAxis === iAx ? w : h;
            var muu = mcd[muvi.uAxis] ? uSpan : 0;
            var mvv = mcd[muvi.vAxis] ? vSpan : 0;
            if (muvi.uFlip) muu = uSpan - muu;
            if (muvi.vFlip) mvv = vSpan - mvv;
            uv.push(muu, mvv);
            tl.push(mTile[a0 * 2], mTile[a0 * 2 + 1]);

            var ml = mLum[a0 * 4 + mv];
            col.push(ml, ml, ml);
            lit.push(mSky[a0 * 4 + mv], mBlk[a0 * 4 + mv], 0);
          }
          ind.push(mbase, mbase + 1, mbase + 2, mbase + 2, mbase + 1, mbase + 3);
        }
      }
    }
  }

  var id = chunkId(cx, cy, cz);
  applyGeo(opaqueMeshes[id], pos, uv, col, lit, ind, tl);
  applyGeo(glassMeshes[id], tpos, tuv, tcol, tlit, tind, ttl);
  chunkFilled[id] = ind.length > 0 || tind.length > 0;
}

// X 자 두 판 × 앞뒷면 = 쿼드 4장. 빛은 자기 칸의 값을 그대로 쓴다.
export var CROSS_PLANES = [[1, 1], [1, -1]];
export function emitCross(P, U, C, L, I, x, y, z, b, ci, T) {
  var cfg = CROSS[b];
  var to = tileOrigin(TILES[b][0]);
  var u0 = to[0] / atlas.width, v0 = 1 - (to[1] + TILE) / atlas.height;
  var sky = lightSky[ci] / 15, blk = lightBlk[ci] / 15;
  var cxw = x + 0.5, czw = z + 0.5;
  var off = crossOffset(shape[ci]);
  var yb = off[1] ? y + off[1] : crossBase(x, y, z);
  cxw += off[0]; czw += off[2];

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
        U.push(uus[v], vvs[v]);
        if (T) T.push(u0, v0);
        C.push(1, 1, 1);
        L.push(sky, blk, vvs[v] === 1 ? cfg.sway : 0);
      }
      I.push(base, base + 1, base + 2, base, base + 2, base + 3);
    }
  }
}

export function applyGeo(mesh, pos, uv, col, lit, ind, tile) {
  var g = mesh.geometry;
  // 갈아 끼우기 전에 예전 버퍼를 놓아 준다 (v93).
  // three r128 은 attribute 객체를 키로 하는 WeakMap 으로 WebGLBuffer 를 잡는다 —
  // 새 BufferAttribute 로 덮으면 예전 것은 GC 되고 그 버퍼는 **영영 지울 수 없는 고아**가 된다.
  // 초당 두 블록씩 10분을 지으면 재업로드 1,200회 × 40KB ≈ 48MB 가 돌아오지 않았다.
  // (scene.js updateChunkVisibility 와 hand.js updateGhost 는 이미 이렇게 한다 —
  //  수천 번 도는 바로 이 함수만 빠져 있었다.)
  g.dispose();
  g.setAttribute("position", new THREE.BufferAttribute(new Float32Array(pos), 3));
  g.setAttribute("uv", new THREE.BufferAttribute(new Float32Array(uv), 2));
  g.setAttribute("acol", new THREE.BufferAttribute(new Float32Array(col), 3));
  g.setAttribute("alight", new THREE.BufferAttribute(new Float32Array(lit), 3));
  // atile 이 없거나 짧으면 그 정점들은 조용히 아틀라스 (0,0) 을 샘플링한다 —
  // 프래그먼트가 타일 원점을 여기서만 받기 때문이다. 길이를 맞춰 준다 (v103)
  var tiles = tile && tile.length === (pos.length / 3) * 2 ? tile : new Array((pos.length / 3) * 2);
  if (tiles !== tile) for (var tz = 0; tz < tiles.length; tz++) tiles[tz] = tile && tz < tile.length ? tile[tz] : 0;
  g.setAttribute("atile", new THREE.BufferAttribute(new Float32Array(tiles), 2));
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
// 굽는 순서를 카메라와의 거리로 정한다 — 눈앞이 먼저 채워져야 기다림이 짧게 느껴진다
export var buildFocus = null;
export function setBuildFocus(v) { buildFocus = v; }    // 여기에 가까운 청크부터 굽는다 (보통 카메라)

export function buildBudget(ms) {
  if (!dirty.size) return 0;
  var t0 = (window.performance && performance.now) ? performance.now() : Date.now();
  var ids = [];
  dirty.forEach(function (id) { ids.push(id); });
  // 눈앞이 먼저 채워져야 기다림이 짧게 느껴진다
  if (buildFocus && ids.length > 1) {
    var fx = buildFocus.x, fy = buildFocus.y, fz = buildFocus.z;
    ids.sort(function (a, b) {
      var ax = (chunkCX(a) + 0.5) * CH - fx, ay = (chunkCY(a) + 0.5) * CH - fy,
          az = (chunkCZ(a) + 0.5) * CH - fz;
      var bx = (chunkCX(b) + 0.5) * CH - fx, by = (chunkCY(b) + 0.5) * CH - fy,
          bz = (chunkCZ(b) + 0.5) * CH - fz;
      return (ax * ax + ay * ay + az * az) - (bx * bx + by * by + bz * bz);
    });
  }
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
