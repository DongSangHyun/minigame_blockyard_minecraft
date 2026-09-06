// hand.js — 1인칭 손과 들고 있는 블록
import { S } from "./state.js";
import { calmMotion } from "./settings.js";
import { CROSS, SHAPE_BOXES, SH_FULL, TILES, faceKindFor, isCross } from "./blocks.js";
import { TILE, atlas, atlasTex, tileOrigin } from "./atlas.js";
import { set } from "./world.js";
import { CROSS_PLANES, FACES, FACE_UV } from "./mesh.js";
import { scene } from "./scene.js";
import { currentShape, player } from "./player.js";
import { idx, inside } from "./dims.js";
import { lightBlk, lightSky } from "./light.js";
import { dayLight } from "./daynight.js";

export var handScene = new THREE.Scene();
export var handCam = new THREE.PerspectiveCamera(
  window.innerWidth < window.innerHeight ? 74 : 52,
  window.innerWidth / window.innerHeight, 0.01, 12);
export var handGroup = new THREE.Group();
handScene.add(handGroup);

export function makeBlockGeometry(b, sh) {
  var pos = [], uv = [], col = [], ind = [];
  if (isCross(b)) {
    var cg = CROSS[b];
    var cto = tileOrigin(TILES[b][0]);
    var cu0 = cto[0] / atlas.width, cv0 = 1 - (cto[1] + TILE) / atlas.height;
    var cus = TILE / atlas.width;
    for (var pl = 0; pl < 2; pl++) {
      var pdx = CROSS_PLANES[pl][0] * cg.w, pdz = CROSS_PLANES[pl][1] * cg.w;
      for (var side = 0; side < 2; side++) {
        var cb = pos.length / 3;
        var sgn = side === 0 ? 1 : -1;
        var xs = [-pdx * sgn, pdx * sgn, pdx * sgn, -pdx * sgn];
        var zs = [-pdz * sgn, pdz * sgn, pdz * sgn, -pdz * sgn];
        var ys = [-0.5, -0.5, -0.5 + cg.h, -0.5 + cg.h];
        var uus = [0, 1, 1, 0], vvs = [0, 0, 1, 1];
        for (var v2 = 0; v2 < 4; v2++) {
          pos.push(xs[v2], ys[v2], zs[v2]);
          uv.push(cu0 + uus[v2] * cus, cv0 + vvs[v2] * cus);
          col.push(1, 1, 1);
        }
        ind.push(cb, cb + 1, cb + 2, cb, cb + 2, cb + 3);
      }
    }
    var cgeo = new THREE.BufferGeometry();
    cgeo.setAttribute("position", new THREE.BufferAttribute(new Float32Array(pos), 3));
    cgeo.setAttribute("uv", new THREE.BufferAttribute(new Float32Array(uv), 2));
    cgeo.setAttribute("color", new THREE.BufferAttribute(new Float32Array(col), 3));
    cgeo.setIndex(ind);
    return cgeo;
  }
  var boxes = SHAPE_BOXES[sh || SH_FULL] || SHAPE_BOXES[0];
  for (var bi = 0; bi < boxes.length; bi++) {
    var box = boxes[bi];
    for (var f = 0; f < 6; f++) {
      var face = FACES[f], uvi = FACE_UV[f];
      var to = tileOrigin(TILES[b][faceKindFor(sh || SH_FULL, f, face.kind)]);
      var u0 = to[0] / atlas.width, v0 = 1 - (to[1] + TILE) / atlas.height;
      var us = TILE / atlas.width;
      var base = pos.length / 3;
      for (var v = 0; v < 4; v++) {
        var cd = face.c[v];
        var lx = cd[0] === 0 ? box[0] : box[3];
        var ly = cd[1] === 0 ? box[1] : box[4];
        var lz = cd[2] === 0 ? box[2] : box[5];
        var local = [lx, ly, lz];
        pos.push(lx - 0.5, ly - 0.5, lz - 0.5);
        var uu = local[uvi.uAxis], vv = local[uvi.vAxis];
        if (uvi.uFlip) uu = 1 - uu;
        if (uvi.vFlip) vv = 1 - vv;
        uv.push(u0 + uu * us, v0 + vv * us);
        col.push(face.shade, face.shade, face.shade);
      }
      ind.push(base, base + 1, base + 2, base + 2, base + 1, base + 3);
    }
  }
  var g = new THREE.BufferGeometry();
  g.setAttribute("position", new THREE.BufferAttribute(new Float32Array(pos), 3));
  g.setAttribute("uv", new THREE.BufferAttribute(new Float32Array(uv), 2));
  g.setAttribute("color", new THREE.BufferAttribute(new Float32Array(col), 3));
  g.setIndex(ind);
  return g;
}

export var handMat = new THREE.MeshBasicMaterial({ map: atlasTex, vertexColors: true, transparent: true });
export var heldMesh = new THREE.Mesh(makeBlockGeometry(S.bar[0]), handMat);
heldMesh.scale.setScalar(0.20);
heldMesh.position.set(0.62, -0.40, -1.10);
heldMesh.rotation.set(0.20, -0.62, 0.10);
handGroup.add(heldMesh);

export var armMat = new THREE.MeshBasicMaterial({ color: 0xc8956b });
export var arm = new THREE.Mesh(new THREE.BoxGeometry(0.13, 0.13, 0.58), armMat);
arm.position.set(0.70, -0.52, -1.02);
arm.rotation.set(0.28, -0.24, 0);
handGroup.add(arm);

export function updateHandBlock() {
  var b = S.bar[S.selected];
  var sh = currentShape(false);
  var key = b * 16 + sh;
  if (key === S.heldKey) return;
  S.heldKey = key;
  heldMesh.geometry.dispose();
  heldMesh.geometry = makeBlockGeometry(b, sh);
}

// ── 놓을 자리 미리보기
export var ghostMat = new THREE.MeshBasicMaterial({
  map: atlasTex, vertexColors: true, transparent: true,
  opacity: 0.40, depthWrite: false
});
export var ghostMesh = new THREE.Mesh(new THREE.BufferGeometry(), ghostMat);
ghostMesh.scale.setScalar(0.99);
ghostMesh.visible = false;
ghostMesh.renderOrder = 4;
scene.add(ghostMesh);
export function updateGhost(px, py, pz, upper) {
  var b = S.bar[S.selected], sh = currentShape(upper);
  var key = b * 16 + sh;
  if (key !== S.ghostKey) {
    S.ghostKey = key;
    ghostMesh.geometry.dispose();
    ghostMesh.geometry = makeBlockGeometry(b, sh);
  }
  ghostMesh.position.set(px + 0.5, py + 0.5, pz + 0.5);
  ghostMesh.visible = true;
}

export function triggerSwing() { S.swing = 1; }
// 손과 든 블록도 서 있는 칸의 밝기를 받는다 — 캄캄한 굴에서 팔만 형광등처럼
// 환하면 어둠의 긴장이 다 새어 나간다 (자문 2차 7번)
export function updateHandLight(dt) {
  var px = Math.floor(player.pos.x), pz = Math.floor(player.pos.z);
  var py = Math.floor(player.pos.y + 1);
  var lv = 0;
  if (inside(px, py, pz)) {
    var li = idx(px, py, pz);
    lv = Math.max(lightSky[li] * dayLight(S.timeOfDay), lightBlk[li]) / 15;
  } else lv = dayLight(S.timeOfDay);
  var target = Math.max(0.14, Math.min(1, 0.12 + lv * 0.95));
  S.handLight += (target - S.handLight) * Math.min(1, dt * 4);
  var L = S.handLight;
  handMat.color.setScalar(L);
  armMat.color.setRGB(0.78 * L, 0.58 * L, 0.42 * L);
}

export function updateHand(dt) {
  updateHandLight(dt);
  if (S.swing > 0) S.swing = Math.max(0, S.swing - dt * 4.2);
  var s = S.swing > 0 ? Math.sin(S.swing * Math.PI) : 0;
  var calm = calmMotion();
  var bobY = calm ? 0 : Math.sin(S.bobPhase) * 0.018 * S.bobAmount;
  var bobX = calm ? 0 : Math.cos(S.bobPhase * 0.5) * 0.02 * S.bobAmount;
  handGroup.position.set(bobX, bobY - s * 0.16, s * 0.10);
  handGroup.rotation.set(-s * 0.62, 0, 0);
}
