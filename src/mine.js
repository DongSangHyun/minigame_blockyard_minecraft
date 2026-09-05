// mine.js — 캐기 · 놓기
import { S } from "./state.js";
import { feedNearbyMob } from "./mobs.js";
import { explode, ignite, BLAST_R } from "./fluids.js";
import { idx, inside } from "./dims.js";
import { AIR, ALL_BLOCKS, COAL, FLOWER_R, FLOWER_Y, IRON, LADDER, LAMP, SH_AXIS_X, SH_AXIS_Z, SH_FULL, SH_SLAB, SH_SLAB_UP, SH_STAIR_E, SH_STAIR_N, SH_STAIR_NU, SH_STAIR_S, SH_STAIR_W, TALLGRASS, TNT, TORCH, isCross, isFlammable, isLiquid, isLog, isOpenable, isSolid, needsFloor, wallShapeFor } from "./blocks.js";
import { get, shape } from "./world.js";
import { burst } from "./scene.js";
import { BODY, HALF, currentShape, player, raycast, stats } from "./player.js";
import { breakSound, crunch, placeSound, tone } from "./audio.js";
import { applyEdit, unlock } from "./edit.js";
import { noteBlockUse, toast } from "./hud.js";
import { triggerSwing } from "./hand.js";
import { advanceTut } from "./input.js";

export function mineAt(hit) {
  if (!applyEdit(hit.x, hit.y, hit.z, AIR, true)) return;
  stats.mined++;
  unlock("firstMine");
  advanceTut(0);
  if (hit.block === COAL) unlock("coal");
  if (hit.block === IRON) unlock("iron");
  if (stats.mined >= 100) unlock("mine100");
  burst(hit.x, hit.y, hit.z, hit.block, 14);
  breakSound(hit.block);
  triggerSwing();
}

// 마크 규칙 — 밑면을 클릭했거나 옆면의 윗쪽 절반을 클릭하면 "위" 변형
export function upperFromHit(hit) {
  if (!hit) return false;
  if (hit.ny > 0) return false;          // 윗면 → 아래 변형
  if (hit.ny < 0) return true;           // 밑면(천장) → 위 변형
  return ((hit.hitY || hit.y) - hit.y) > 0.5;
}

export function canPlaceAt(px, py, pz) {
  if (!inside(px, py, pz)) return false;
  var cur = get(px, py, pz);
  if (cur !== AIR && !isLiquid(cur) && !isCross(cur)) return false;
  var p = player.pos;
  if (p.x + HALF > px && p.x - HALF < px + 1 &&
      p.y + BODY > py && p.y < py + 1 &&
      p.z + HALF > pz && p.z - HALF < pz + 1) return false;
  return true;
}

// 우클릭이 "쓰기" 인가 "놓기" 인가 — 마크와 같이 웅크리면 언제나 놓기다
export function tryInteract(hit) {
  if (!hit || S.sneaking) return false;
  // 꽃을 들고 동물에게 우클릭하면 잠시 따라온다
  if ((S.bar[S.selected] === FLOWER_R || S.bar[S.selected] === FLOWER_Y ||
       S.bar[S.selected] === TALLGRASS) && feedNearbyMob(player.pos)) {
    triggerSwing();
    unlock("feed");
    return true;
  }
  // 여닫는 블록이 먼저다 — 횃불을 들었다고 문에 불을 붙이면 문을 쓸 수가 없다
  if (isOpenable(hit.block)) return tryInteractGate(hit);
  // 횃불을 들고 TNT 를 우클릭하면 터진다 (마크의 부싯돌 자리)
  if (hit.block === TNT && S.bar[S.selected] === TORCH) {
    explode(hit.x, hit.y, hit.z, BLAST_R);
    triggerSwing();
    unlock("boom");
    return true;
  }
  // 횃불로 탈 것에 불을 붙인다
  if (S.bar[S.selected] === TORCH && isFlammable(hit.block)) {
    if (ignite(hit.x + hit.nx, hit.y + hit.ny, hit.z + hit.nz)) {
      crunch(0.2, 0.10, 1400);
      triggerSwing();
      unlock("fire");
      return true;
    }
  }
  return tryInteractGate(hit);
}

function tryInteractGate(hit) {
  if (!hit || S.sneaking) return false;
  if (!isOpenable(hit.block)) return false;
  var i = idx(hit.x, hit.y, hit.z);
  applyEdit(hit.x, hit.y, hit.z, hit.block, true, shape[i] === 1 ? 0 : 1);
  tone(shape[i] === 1 ? 420 : 300, 0.09, "square", 0.05);
  triggerSwing();
  return true;
}

export function place() {
  var hit = raycast(6);
  if (!hit) return;
  if (tryInteract(hit)) return;
  var b = S.bar[S.selected];

  // 반블록 두 장을 겹치면 온전한 블록이 된다 — 건축가가 제일 먼저 시도하는 것
  var hitSh = hit.shape;
  var wantSh = currentShape(upperFromHit(hit));
  if (hit.block === b && !isLiquid(b) && !isCross(b) &&
      ((hitSh === SH_SLAB && wantSh === SH_SLAB && hit.ny > 0) ||
       (hitSh === SH_SLAB_UP && wantSh === SH_SLAB_UP && hit.ny < 0))) {
    if (!applyEdit(hit.x, hit.y, hit.z, b, true, SH_FULL)) return;
    stats.placed++;
    unlock("slabmerge");
    burst(hit.x, hit.y, hit.z, b, 5);
    placeSound(b);
    triggerSwing();
    return;
  }

  // 풀·꽃·횃불을 조준했으면 그 자리를 덮어쓴다 (마크의 replaceable 블록)
  var onCross = isCross(hit.block);
  var px = onCross ? hit.x : hit.x + hit.nx;
  var py = onCross ? hit.y : hit.y + hit.ny;
  var pz = onCross ? hit.z : hit.z + hit.nz;
  if (!canPlaceAt(px, py, pz)) return;

  if (needsFloor(b) && isLiquid(get(px, py, pz))) { toast("물속에서는 꺼집니다"); return; }
  // 횃불은 벽에도 붙는다 — 옆면을 클릭했고 그 벽이 단단하면 벽 횃불
  var wallSh = 0;
  if ((b === TORCH || b === LADDER) && !onCross &&
      (hit.nx !== 0 || hit.nz !== 0) && isSolid(hit.block)) {
    wallSh = wallShapeFor(hit.nx, hit.nz);
  }
  if (b === LADDER && !wallSh) { toast("벽에 붙여야 합니다"); return; }
  if (needsFloor(b) && !wallSh && !isSolid(get(px, py - 1, pz))) {
    toast("받칠 바닥이 필요합니다"); return;
  }
  // 물·용암·풀·횃불에는 반블록·계단 모양을 붙이지 않는다 (반쪽짜리 물덩이 방지)
  var sh = (isLiquid(b) || isCross(b)) ? SH_FULL : wantSh;
  // 원목은 클릭한 면 방향으로 눕는다 (마크와 같다)
  if (isLog(b) && sh === SH_FULL && !onCross) {
    if (hit.nx !== 0) sh = SH_AXIS_X;
    else if (hit.nz !== 0) sh = SH_AXIS_Z;
  }
  if (wallSh) sh = wallSh;
  if (!applyEdit(px, py, pz, b, true, sh)) return;
  stats.placed++;
  unlock("firstPlace");
  advanceTut(1);
  if (stats.placed >= 100) unlock("place100");
  if (b === LAMP && ++S.lampsPlaced >= 10) unlock("lamp10");
  if (b === TORCH && ++S.torchesPlaced >= 10) unlock("torch10");
  if (b === FLOWER_R || b === FLOWER_Y) unlock("flower");
  if (sh === SH_STAIR_N || sh === SH_STAIR_E || sh === SH_STAIR_S || sh === SH_STAIR_W ||
      sh >= SH_STAIR_NU) unlock("stair");
  S.placedKinds[b] = 1;
  noteBlockUse(b);
  var allKinds = true;
  for (var ak = 0; ak < ALL_BLOCKS.length; ak++) if (!S.placedKinds[ALL_BLOCKS[ak]]) allKinds = false;
  if (allKinds) unlock("collector");
  burst(px, py, pz, b, 5);
  placeSound(b);
  triggerSwing();
}
