// mine.js — 캐기 · 놓기
import { S } from "./state.js";
import { inside } from "./dims.js";
import { AIR, ALL_BLOCKS, COAL, IRON, LAMP, SH_STAIR_E, SH_STAIR_N, SH_STAIR_NU, SH_STAIR_S, SH_STAIR_W, isCross, isLiquid, isSolid, needsFloor } from "./blocks.js";
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
  var px = hit.x + hit.nx, py = hit.y + hit.ny, pz = hit.z + hit.nz;
  if (!canPlaceAt(px, py, pz)) return;

  var b = S.bar[S.selected];
  if (needsFloor(b) && !isSolid(get(px, py - 1, pz))) { toast("받칠 바닥이 필요합니다"); return; }
  var sh = currentShape(upperFromHit(hit));
  if (!applyEdit(px, py, pz, b, true, sh)) return;
  stats.placed++;
  unlock("firstPlace");
  advanceTut(1);
  if (stats.placed >= 100) unlock("place100");
  if (b === LAMP && ++S.lampsPlaced >= 10) unlock("lamp10");
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
