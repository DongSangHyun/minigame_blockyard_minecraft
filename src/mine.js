// mine.js — 캐기 · 놓기
import { S } from "./state.js";
import { inside } from "./dims.js";
import { AIR, ALL_BLOCKS, COAL, FLOWER_R, FLOWER_Y, IRON, LAMP, SH_FULL, SH_SLAB, SH_SLAB_UP, SH_STAIR_E, SH_STAIR_N, SH_STAIR_NU, SH_STAIR_S, SH_STAIR_W, TORCH, isCross, isLiquid, isSolid, needsFloor } from "./blocks.js";
import { get } from "./world.js";
import { burst } from "./scene.js";
import { BODY, HALF, currentShape, player, raycast, stats } from "./player.js";
import { breakSound, placeSound } from "./audio.js";
import { applyEdit, unlock } from "./edit.js";
import { toast } from "./hud.js";
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

export function place() {
  var hit = raycast(6);
  if (!hit) return;
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

  if (needsFloor(b) && !isSolid(get(px, py - 1, pz))) { toast("받칠 바닥이 필요합니다"); return; }
  // 물·용암·풀·횃불에는 반블록·계단 모양을 붙이지 않는다 (반쪽짜리 물덩이 방지)
  var sh = (isLiquid(b) || isCross(b)) ? SH_FULL : wantSh;
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
  var allKinds = true;
  for (var ak = 0; ak < ALL_BLOCKS.length; ak++) if (!S.placedKinds[ALL_BLOCKS[ak]]) allKinds = false;
  if (allKinds) unlock("collector");
  burst(px, py, pz, b, 5);
  placeSound(b);
  triggerSwing();
}
