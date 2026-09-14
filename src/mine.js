// mine.js — 캐기 · 놓기
import { S } from "./state.js";
import { MOB_MAX, aimedMob, feedNearbyMob, isTrader, mobOccupies } from "./mobs.js";
import { primeTNT, ignite } from "./fluids.js";
import { WY, idx, inside } from "./dims.js";
import { BOOKSHELF, CARPET0, LAMP, PLANKS, POT, SAPLING, STAINED0, WOOL0, NAMES, BUCKET, FRAME, FIRE, DOOR, doorFacing, doorOpen, doorShapeFor, GOLD, DIAMOND, ICE, WATER, AIR, COAL, FLINT, FLOWER_R, FLOWER_Y, IRON, LADDER, SH_AXIS_X, SH_AXIS_Z, SH_FULL, SH_SLAB, SH_SLAB_UP, TALLGRASS, TNT, TORCH, isCross, isFlammable, isItem, isLiquid, isLog, isOpenable, isSolid, needsFloor, wallShapeFor } from "./blocks.js";
import { get, shape } from "./world.js";
import { lightSky } from "./light.js";
import { burst } from "./scene.js";
import { BODY, HALF, currentShape, player, raycast, stats } from "./player.js";
import { breakSound, crunch, placeSound, tone } from "./audio.js";
import { notePlaced, applyEdit, beginBatch, endBatch, unlock } from "./edit.js";
import { noteBlockUse, refreshSlot, toast } from "./hud.js";
import { triggerSwing, updateHandBlock } from "./hand.js";
import { advanceTut } from "./input.js";

export function mineAt(hit) {
  // 얼음을 깨면 물이 남는다 (마크) — 언 호수를 뚫고 들어가는 그림이 나온다
  var leaves = (hit.block === ICE) ? WATER : AIR;
  // 문은 반쪽만 남으면 안 된다 — 나머지 칸도 함께 걷는다
  // 문의 두 칸은 한 묶음이다 — Ctrl+Z 한 번에 반쪽만 돌아오면 문이 아니다
  var doy = (hit.block === DOOR) ? doorOther(hit.x, hit.y, hit.z) : -1;
  if (doy >= 0) beginBatch(8);
  var mined = applyEdit(hit.x, hit.y, hit.z, leaves, true);
  if (mined && doy >= 0) applyEdit(hit.x, doy, hit.z, AIR, true);
  if (doy >= 0) endBatch("문 캐기");
  if (!mined) return;
  stats.mined++;
  unlock("firstMine");
  advanceTut(0);
  if (hit.block === COAL) unlock("coal");
  if (hit.block === IRON) unlock("iron");
  if (hit.block === GOLD) unlock("gold");
  if (hit.block === DIAMOND) {
    // 채굴의 마지막 보상 — 마크의 "DIAMONDS!" 처럼 한 옥타브 위 세 음으로 따로 기념한다
    unlock("diamond");
    // 음정이 뜻인 소리다 — 무작위 피치를 태우면 화음이 아니라 잡음이 된다 (v106)
    tone(1320, 0.10, "triangle", 0.06, null, true);
    setTimeout(function () { tone(1568, 0.10, "triangle", 0.06, null, true); }, 110);
    setTimeout(function () { tone(2093, 0.18, "triangle", 0.07, null, true); }, 220);
  }
  if (stats.mined >= 100) unlock("mine100");
  burst(hit.x, hit.y, hit.z, hit.block, 24);
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
  // 동물이 선 칸에도 놓지 않는다 (v94) — 예전에는 플레이어 몸만 봐서
  // 양을 돌 두 칸으로 산 채로 묻을 수 있었다. 마크와 같은 규칙이다
  if (mobOccupies(px, py, pz)) return false;
  return true;
}

// 우클릭이 "쓰기" 인가 "놓기" 인가 — 마크와 같이 웅크리면 언제나 놓기다
// 상인이 파는 것 (v115) — 크리에이티브라 "산다" 는 말은 안 쓴다. **선물**이다.
// 아이가 우클릭 한 번으로 새 재료를 손에 넣고, 그 재료가 뭘 짓게 만든다.
export var TRADER_GIFTS = [
  STAINED0 + 11, STAINED0 + 4, STAINED0 + 6, STAINED0 + 8,   // 색 유리 넉 장
  LAMP, BOOKSHELF, POT, CARPET0 + 12, WOOL0 + 14, SAPLING, PLANKS
];
export var TRADER_LINES = [
  "어서 오세요! 이건 선물이에요",
  "오늘은 이게 잘 나가요",
  "집 짓는 데 쓰세요",
  "저기 광산도 가 보셨어요?",
  "묘목을 심으면 나무가 자란답니다"
];
// 상인과 이야기한다 — 선물은 **0번 칸**에 넣는다.
// 지금 든 것을 덮으면 짓던 것이 끊긴다 (아이가 손에 든 블록이 갑자기 바뀌면 놀란다)
export function tradeWith() {
  var n = (S.tradeCount || 0);
  S.tradeCount = n + 1;
  var gift = TRADER_GIFTS[n % TRADER_GIFTS.length];
  var line = TRADER_LINES[n % TRADER_LINES.length];
  S.bar[9] = gift;
  refreshSlot(9);
  noteBlockUse(gift);
  toast("상인: \u201c" + line + "\u201d — 0번 칸에 " + NAMES[gift]);
  advanceTut(3);                       // 튜토리얼 4번째 줄은 **상인에게 말을 거는 것**이다 (v118)
  tone(720, 0.08, "triangle", 0.05);
  tone(960, 0.09, "triangle", 0.045);
  triggerSwing();
  unlock("trade");
  return true;
}

// 조준선이 향한 **살아 있는 것**과의 상호작용 — 상인·먹이 주기.
// **블록이 없어도 된다** (v118): `place()` 가 `raycast` 로 블록을 못 찾으면 그냥 돌아가서,
// 들판 한가운데 선 양에게는 꽃을 줄 수도, 상인에게 말을 걸 수도 없었다.
// 마을 가판에서만 되던 이유가 상인 **뒤에 가판 판자**가 있었기 때문이다
export function tryInteractMob(repeating) {
  if (repeating || S.sneaking) return false;
  var am = aimedMob();
  if (!am) return false;
  // 상인이 먼저다 (v115) — 가판 앞에서 블록을 놓으려다 상인을 가리면 말을 걸 수가 없다
  if (isTrader(am.mob)) return tradeWith();
  // 꽃을 들고 동물에게 우클릭하면 잠시 따라온다
  if (S.bar[S.selected] === FLOWER_R || S.bar[S.selected] === FLOWER_Y ||
      S.bar[S.selected] === TALLGRASS) {
    var fed = feedNearbyMob(player.pos);
    // -1 은 "상한이라 못 받는다" — JS 에서 -1 은 참이라 그냥 두면 과제까지 뜬다
    if (fed === -1) { toast("동물이 " + MOB_MAX + "마리로 꽉 찼습니다"); return true; }
    if (fed) {
      triggerSwing();
      unlock("feed");
      advanceTut(4);                   // 5번째 줄 — 꽃을 들고 동물에게 (v118)
      return true;
    }
  }
  return false;
}

export function tryInteract(hit) {
  if (!hit || S.sneaking) return false;
  if (tryInteractMob(false)) return true;
  // 여닫는 블록이 먼저다 — 횃불을 들었다고 문에 불을 붙이면 문을 쓸 수가 없다
  if (isOpenable(hit.block)) return tryInteractGate(hit);
  // 횃불을 들고 TNT 를 우클릭하면 터진다 (마크의 부싯돌 자리)
  if (hit.block === TNT && S.bar[S.selected] === FLINT) {
    // 즉시 터뜨리지 않는다 — 도화선 4초. 피할 시간을 준다 (마크와 같다)
    if (primeTNT(hit.x, hit.y, hit.z)) toast("도화선에 불이 붙었습니다 — 피하세요");
    triggerSwing();                      // "쾅" 과제는 터질 때 준다 (explode 에서)
    return true;
  }
  // 횃불로 탈 것에 불을 붙인다
  if (S.bar[S.selected] === FLINT && isFlammable(hit.block)) {
    if (ignite(hit.x + hit.nx, hit.y + hit.ny, hit.z + hit.nz)) {
      crunch(0.2, 0.10, 1400);
      triggerSwing();
      unlock("fire");
      return true;
    }
  }
  return tryInteractGate(hit);
}

// 문의 다른 쪽 반쪽 — 밑칸이 문이면 내가 위쪽이다
export function doorOther(x, y, z) {
  if (get(x, y - 1, z) === DOOR) return y - 1;
  if (get(x, y + 1, z) === DOOR) return y + 1;
  return -1;
}

function tryInteractGate(hit) {
  if (!hit || S.sneaking) return false;
  if (!isOpenable(hit.block)) return false;
  var i = idx(hit.x, hit.y, hit.z);
  if (hit.block === DOOR) {
    // 두 칸이 함께 열리고 닫힌다 — 반쪽만 열리면 문이 아니다
    var sh0 = shape[i];
    var want = doorShapeFor(doorFacing(sh0), !doorOpen(sh0));
    var oy = doorOther(hit.x, hit.y, hit.z);
    // 여닫기는 편집이 아니라 상태 토글이다 — 되돌리기 기록을 먹으면 안 된다
    applyEdit(hit.x, hit.y, hit.z, DOOR, false, want);
    if (oy >= 0) applyEdit(hit.x, oy, hit.z, DOOR, false, want);
    tone(doorOpen(sh0) ? 300 : 420, 0.10, "square", 0.05);
    triggerSwing();
    return true;
  }
  applyEdit(hit.x, hit.y, hit.z, hit.block, false, shape[i] === 1 ? 0 : 1);
  tone(shape[i] === 1 ? 420 : 300, 0.09, "square", 0.05);
  triggerSwing();
  return true;
}

// repeating — 우클릭을 누르고 있어 자동으로 반복되는 호출인가.
// 반복 중에는 상호작용(문·점화·먹이)을 하지 않는다.
// 양동이 — 물·용암을 한 칸씩 걷어낸다. 근원을 걷으면 흘러 나간 것은 dryTick 이 물린다.
// **되돌리기에 실린다** (v78 의 S.fluidOwner 가 뒤따르는 마름까지 그 편집에 담는다).
export function scoopLiquid(repeating) {
  var hit = raycast(6, true);            // 액체도 맞히는 조준 — 평소 조준선은 액체를 건너뛴다
  if (!hit || !isLiquid(hit.block)) {
    if (!repeating) toast("물이나 용암을 조준하세요");
    return;
  }
  var name = hit.block === WATER ? "물" : "용암";
  // 누르고 있는 동안 푼 것은 **한 묶음**이다 — 초당 5칸이 따로따로 쌓이면
  // 3×3 웅덩이를 지우고 되돌리는 데 Ctrl+Z 를 아홉 번 쳐야 한다.
  // 이 게임의 자랑이 "밀려든 물 192칸도 Ctrl+Z 한 번"(v78)인데 양동이만 그 밖이었다.
  var own = !S.batch;
  if (own) beginBatch(64);
  if (!applyEdit(hit.x, hit.y, hit.z, AIR, true)) { if (own) endBatch("물 퍼내기"); return; }
  triggerSwing();
  crunch(0.18, 0.09, hit.block === WATER ? 900 : 420);
  if (own) endBatch(name + " 퍼내기");
  // 담는다 — 다음 우클릭이면 붓는다
  if (S.fillBar) { S.fillBar[S.selected] = hit.block; refreshSlot(S.selected); updateHandBlock(); }
  if (!repeating) toast(name + "을 펐습니다 — 우클릭으로 붓습니다");
  S.worldDirty = true;
}

// 담긴 것을 붓는다 — 한 번 부으면 양동이가 빈다 (홀드로 연달아 붓지 않는다)
export function pourLiquid(hit, repeating) {
  if (repeating) return;                       // 붓기는 한 번이다
  var liq = S.fillBar[S.selected];
  var name = liq === WATER ? "물" : "용암";
  if (!hit) { toast("부을 자리를 조준하세요"); return; }
  var onCross = isCross(hit.block);
  var px = onCross ? hit.x : hit.x + hit.nx;
  var py = onCross ? hit.y : hit.y + hit.ny;
  var pz = onCross ? hit.z : hit.z + hit.nz;
  if (!canPlaceAt(px, py, pz)) { toast("여기에는 부을 수 없습니다"); return; }
  if (!applyEdit(px, py, pz, liq, true)) return;
  S.fillBar[S.selected] = 0;
  refreshSlot(S.selected);
  updateHandBlock();
  triggerSwing();
  placeSound(liq);
  toast(name + "을 부었습니다");
  S.worldDirty = true;
}

export function place(repeating) {
  // 양동이는 조준선이 액체를 건너뛰므로 평소 hit 로는 물을 영영 못 집는다 — 따로 쏜다.
  // 다만 **문·울타리문이 먼저다.** 물을 퍼서 돌아왔는데 제 집 문이 안 열리면 안 된다 —
  // 같은 도구인 부싯돌은 `tryInteract` 안에 있어 문이 열렸다. 도구 둘의 규칙을 맞춘다.
  if (S.bar[S.selected] === BUCKET) {
    var bh = raycast(6);
    if (!repeating && bh && isOpenable(bh.block) && !S.sneaking) {
      if (tryInteract(bh)) return;
    }
    // 담긴 것이 있으면 **붓는다** — 마크의 양동이는 하나가 담고 붓는다 (v90).
    // 담기만 하던 때는 연못을 만들려고 목록(E)에서 "물" 을 찾아 핫바에 넣어야 했다.
    if (S.fillBar && S.fillBar[S.selected]) { pourLiquid(bh, repeating); return; }
    scoopLiquid(repeating);
    return;
  }
  var hit = raycast(6);
  // **블록보다 살아 있는 것이 먼저** (v118) — 상인·동물은 조준선이 닿으면 잡는다.
  // 예전에는 `if (!hit) return;` 이 먼저라, 뒤에 벽이 없는 자리에서는
  // 상인에게 말을 걸 수도 동물에게 꽃을 줄 수도 없었다
  if (!repeating && tryInteractMob(false)) return;
  if (!hit) return;
  if (!repeating && tryInteract(hit)) return;
  // (v118 에서 폰 4번째 줄도 「상인」으로 바뀌었다 — 줄 긋기는 도움말에 남아 있다)
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
  if (!canPlaceAt(px, py, pz)) {
    // 세계의 천장에 닿았으면 그렇다고 말한다 (v83).
    // 지형이 12칸 올라가면서(v79) 지을 하늘이 45칸에서 33칸으로 줄었는데,
    // 천장에서는 **토스트도 소리도 없이** 아무 일이 안 일어나 마우스만 계속 누르게 됐다.
    if (py >= WY) toast("세계의 천장입니다 — 여기보다 위에는 놓을 수 없습니다");
    return;
  }

  if (isItem(b)) { toast("부싯돌은 놓는 물건이 아닙니다 — 탈 것을 우클릭하세요"); return; }
  if (needsFloor(b) && isLiquid(get(px, py, pz))) {
    // 꽃·묘목까지 "꺼집니다" 라고 하면 무슨 말인지 알 수가 없다
    toast((b === TORCH || b === FIRE) ? "물속에서는 꺼집니다" : "물속에는 놓을 수 없습니다");
    return;
  }
  // 횃불은 벽에도 붙는다 — 옆면을 클릭했고 그 벽이 단단하면 벽 횃불
  var wallSh = 0;
  if ((b === TORCH || b === LADDER || b === FRAME) && !onCross &&
      (hit.nx !== 0 || hit.nz !== 0) && isSolid(hit.block)) {
    wallSh = wallShapeFor(hit.nx, hit.nz);
  }
  if ((b === LADDER || b === FRAME) && !wallSh) { toast("벽에 붙여야 합니다"); return; }
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
  // 문은 두 칸을 함께 쓴다 — 위칸이 비어 있어야 하고, 서 있는 쪽을 바라보게 놓인다
  if (b === DOOR) {
    if (!canPlaceAt(px, py + 1, pz)) { toast("문은 두 칸이 필요합니다"); return; }
    var ddx = player.pos.x - (px + 0.5), ddz = player.pos.z - (pz + 0.5);
    var facing = (Math.abs(ddx) > Math.abs(ddz)) ? (ddx > 0 ? 1 : 3) : (ddz > 0 ? 2 : 0);
    sh = doorShapeFor(facing, false);
    beginBatch(8);
    var put = applyEdit(px, py, pz, DOOR, true, sh);
    if (put) applyEdit(px, py + 1, pz, DOOR, true, sh);
    endBatch("문 놓기");
    if (!put) return;
  } else
  if (!applyEdit(px, py, pz, b, true, sh)) return;
  notePlaced(b, sh, 1);
  advanceTut(1);
  // 4단계는 **어두운 곳에** 꽂았을 때만 (v110) — 06:00 대낮 잔디밭에서 통과하면
  // 시작 화면이 자랑한 "빛이 닿지 않는 곳은 정말로 캄캄합니다" 를 볼 일이 없다
  if (b === TORCH && lightSky[idx(px, py, pz)] < 8) advanceTut(5);
  noteBlockUse(b);
  burst(px, py, pz, b, 5);
  placeSound(b);
  triggerSwing();
}
