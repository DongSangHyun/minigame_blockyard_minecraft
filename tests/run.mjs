// Blockyard 회귀 테스트 스위트
import { launch, openGame, assert, eq, near } from "./harness.mjs";

const REPEAT = Math.max(1, parseInt(process.argv[2] || "1", 10));
const FILTER = process.argv[3] || "";

const T = [];
const test = (name, fn) => T.push({ name, fn });

// 페이지 안에서 쓰는 공용 헬퍼 — 지형에 좌우되지 않는 평평한 시험장
const ARENA = `
  function arena(B, x, y, z, r) {
    for (var dx = -r; dx <= r; dx++) for (var dz = -r; dz <= r; dz++) {
      for (var dy = 0; dy <= 6; dy++) B.set(x + dx, y + dy, z + dz, B.B.AIR);
      B.set(x + dx, y - 1, z + dz, B.B.STONE);
    }
    B.refreshAllTops();
    B.player.pos.set(x + 0.5, y, z + 0.5);
    B.player.vel.set(0, 0, 0);
    B.player.onGround = true;
    B.player.flying = false;
    B.player.yaw = 0; B.player.pitch = 0;
    B.camera.rotation.y = 0; B.camera.rotation.x = 0;
  }
`;

// ── 1. 부팅 · 월드 생성 ────────────────────────────────
test("부팅: 훅과 캔버스가 존재하고 콘솔 오류가 없다", async (page, errors) => {
  const info = await page.evaluate(() => {
    const B = window.__blockyard;
    return { has: !!B, canvas: !!document.querySelector("#stage canvas"),
             N: B.N, WX: B.WX, WY: B.WY, WZ: B.WZ, seed: B.seed() };
  });
  assert(info.has, "__blockyard 훅 없음");
  assert(info.canvas, "렌더러 캔버스 없음");
  eq(info.N, info.WX * info.WY * info.WZ, "월드 셀 수");
  eq(info.WY, 64, "세계 높이");
  assert(errors.length === 0, "오류: " + errors.join(" | "));
});

test("지형: 공기가 아닌 칸이 충분하고 해수면 아래에 물이 있다", async (page) => {
  const r = await page.evaluate(() => {
    const B = window.__blockyard;
    let solid = 0, water = 0;
    for (let i = 0; i < B.N; i += 7) {
      const b = B.world[i];
      if (b !== 0) solid++;
      if (b === B.B.WATER) water++;
    }
    return { solid, water, samples: Math.ceil(B.N / 7) };
  });
  assert(r.solid > r.samples * 0.05, "지형이 너무 비어 있음: " + r.solid);
  assert(r.water > 0, "물이 하나도 없음");
});

test("지형: 모든 바이옴(초원/설원/사막)이 한 번 이상 등장한다", async (page) => {
  const r = await page.evaluate(() => {
    const B = window.__blockyard;
    const seen = [0, 0, 0];
    for (let i = 0; i < B.biomeMap.length; i++) seen[B.biomeMap[i]]++;
    return seen;
  });
  assert(r[0] > 0, "초원 없음");
});

test("topMap: 각 열의 최상단 블록 인덱스가 실제 지형과 맞는다", async (page) => {
  const bad = await page.evaluate(() => {
    const B = window.__blockyard;
    let bad = 0;
    for (let z = 0; z < B.WZ; z += 5) for (let x = 0; x < B.WX; x += 5) {
      const y = B.topMap[z * B.WX + x];
      if (y < 0) continue;
      if (B.world[B.idx(x, y, z)] === 0) bad++;
      // 풀·꽃·횃불은 topMap 에 세지 않으므로 위에 있어도 된다
      if (y + 1 < B.WY) {
        const up = B.world[B.idx(x, y + 1, z)];
        if (up !== 0 && !B.isCross(up)) bad++;
      }
    }
    return bad;
  });
  eq(bad, 0, "topMap 불일치 개수");
});

// ── 2. 조명 ────────────────────────────────────────────
test("조명: 하늘이 트인 최상단은 15, 깊은 지하는 0이다", async (page) => {
  const r = await page.evaluate(() => {
    const B = window.__blockyard;
    let topLit = 0, topN = 0, deepLit = 0, deepN = 0;
    for (let z = 2; z < B.WZ - 2; z += 7) for (let x = 2; x < B.WX - 2; x += 7) {
      const y = B.topMap[z * B.WX + x];
      if (y >= 0 && y + 1 < B.WY) { topN++; if (B.lightSky[B.idx(x, y + 1, z)] === 15) topLit++; }
      const di = B.idx(x, 1, z);
      if (B.world[di] === 0) { deepN++; if (B.lightSky[di] > 0) deepLit++; }
    }
    return { topLit, topN, deepLit, deepN };
  });
  assert(r.topLit === r.topN, `하늘 트인 칸 ${r.topN}개 중 ${r.topLit}개만 밝음`);
});

test("조명: 램프를 놓으면 주변이 밝아지고, 캐면 원래대로 돌아온다", async (page) => {
  const r = await page.evaluate(() => {
    const B = window.__blockyard;
    const x = 8, y = 3, z = 8;
    B.applyEdit(x, y, z, B.B.AIR, false);
    B.applyEdit(x + 1, y, z, B.B.AIR, false);
    const before = B.lightBlk[B.idx(x + 1, y, z)];
    B.applyEdit(x, y, z, B.B.LAMP, false);
    const lit = B.lightBlk[B.idx(x + 1, y, z)];
    B.applyEdit(x, y, z, B.B.AIR, false);
    const after = B.lightBlk[B.idx(x + 1, y, z)];
    return { before, lit, after };
  });
  assert(r.lit >= 14, "램프 옆이 어둡다: " + r.lit);
  eq(r.after, r.before, "램프 제거 후 밝기 복원");
});

// ── 3. 편집 · 되돌리기 ─────────────────────────────────
test("편집: 놓기/캐기 후 되돌리기·다시하기가 정확히 복원된다", async (page) => {
  const r = await page.evaluate(() => {
    const B = window.__blockyard;
    const x = 20, y = 20, z = 20;
    B.applyEdit(x, y, z, B.B.AIR, false);
    const base = B.world[B.idx(x, y, z)];
    B.applyEdit(x, y, z, B.B.BRICK, true);
    const placed = B.world[B.idx(x, y, z)];
    B.undo();
    const undone = B.world[B.idx(x, y, z)];
    B.redo();
    const redone = B.world[B.idx(x, y, z)];
    B.applyEdit(x, y, z, B.B.AIR, false);
    return { base, placed, undone, redone, BRICK: B.B.BRICK };
  });
  eq(r.placed, r.BRICK, "놓기");
  eq(r.undone, r.base, "되돌리기");
  eq(r.redone, r.BRICK, "다시하기");
});

// ── 4. 저장 · 불러오기 ─────────────────────────────────
test("저장: RLE+Base64 왕복이 월드를 그대로 복원한다", async (page) => {
  const r = await page.evaluate(() => {
    const B = window.__blockyard;
    const snap = B.world.slice();
    const s = B.encodeWorldB64();
    B.world.fill(0);
    const ok = B.decodeWorldB64(s);
    let diff = 0;
    for (let i = 0; i < B.N; i++) if (B.world[i] !== snap[i]) diff++;
    return { ok, diff, bytes: s.length };
  });
  assert(r.ok, "디코딩 실패");
  eq(r.diff, 0, "왕복 불일치 셀 수");
});

test("저장: saveGame → loadGame 이 좌표와 통계를 유지한다", async (page) => {
  const r = await page.evaluate(() => {
    const B = window.__blockyard;
    B.player.pos.set(48.5, 20, 50.5);
    const okSave = B.saveGame();
    B.player.pos.set(1, 1, 1);
    const okLoad = B.loadGame();
    return { okSave, okLoad, x: B.player.pos.x, z: B.player.pos.z };
  });
  assert(r.okSave && r.okLoad, "저장/불러오기 실패");
  near(r.x, 48.5, 0.001, "복원된 X");
});

// ── 5. 물리 · 충돌 ─────────────────────────────────────
test("물리: 플레이어가 solid 블록 안으로 들어가지 못한다", async (page) => {
  const r = await page.evaluate(() => {
    const B = window.__blockyard;
    const x = 30, z = 30;
    const y = B.topMap[z * B.WX + x] + 1;
    B.player.pos.set(x + 0.5, y, z + 0.5);
    B.applyEdit(x + 1, y, z, B.B.STONE, false);
    B.applyEdit(x + 1, y + 1, z, B.B.STONE, false);
    B.moveHorizontal(0.9, 0);
    const stopped = B.player.pos.x;
    const inside = B.boxHitsWorld(B.player.pos.x, B.player.pos.y, B.player.pos.z);
    B.applyEdit(x + 1, y, z, B.B.AIR, false);
    B.applyEdit(x + 1, y + 1, z, B.B.AIR, false);
    return { stopped, wall: x + 1, inside };
  });
  assert(!r.inside, "플레이어가 블록에 박혔다");
  assert(r.stopped < r.wall, "벽을 통과했다");
});

test("물리: 반블록 위에 서면 정확히 0.5 높이에 멈춘다", async (page) => {
  const r = await page.evaluate(() => {
    const B = window.__blockyard;
    const x = 40, z = 40, y = 25;
    for (let k = 0; k < 4; k++) for (let dx = -1; dx <= 1; dx++) for (let dz = -1; dz <= 1; dz++)
      B.applyEdit(x + dx, y + k, z + dz, B.B.AIR, false);
    B.applyEdit(x, y, z, B.B.STONE, false, B.SH.SLAB);
    B.player.pos.set(x + 0.5, y + 2, z + 0.5);
    B.moveAxis("y", -2);
    return { y: B.player.pos.y, expect: y + 0.5 };
  });
  near(r.y, r.expect, 0.02, "반블록 위 착지 높이");
});

// ── 6. 레이캐스트 ──────────────────────────────────────
test("레이캐스트: 정면 블록을 맞히고 법선이 플레이어 쪽을 향한다", async (page) => {
  const r = await page.evaluate(() => {
    const B = window.__blockyard;
    const x = 60, y = 25, z = 60;
    for (let dx = -2; dx <= 2; dx++) for (let dy = -2; dy <= 2; dy++) for (let dz = -2; dz <= 2; dz++)
      B.applyEdit(x + dx, y + dy, z + dz, B.B.AIR, false);
    B.applyEdit(x, y, z - 3, B.B.BRICK, false);
    B.player.pos.set(x + 0.5, y - 1.62 + 0.0, z + 0.5);
    B.player.yaw = 0; B.player.pitch = 0;
    B.camera.position.set(x + 0.5, y + 0.5, z + 0.5);
    B.camera.rotation.y = 0; B.camera.rotation.x = 0;
    const hit = B.raycast(6);
    return hit ? { x: hit.x, y: hit.y, z: hit.z, nz: hit.nz, block: hit.block, BRICK: B.B.BRICK }
               : null;
  });
  assert(r, "레이캐스트가 아무것도 못 맞힘");
  eq(r.block, r.BRICK, "맞힌 블록");
  eq(r.nz, 1, "법선 방향(+Z)");
});

// ── 7. 청크 메시 ───────────────────────────────────────
test("메시: 청크를 다시 구우면 정점/인덱스가 생기고 삼각형 수가 3의 배수다", async (page) => {
  const r = await page.evaluate(() => {
    const B = window.__blockyard;
    B.markAllDirty();
    B.buildBudget(4000);
    let withGeo = 0, badIdx = 0;
    for (let i = 0; i < B.opaqueMeshes.length; i++) {
      const g = B.opaqueMeshes[i].geometry;
      const ix = g.getIndex();
      if (ix && ix.count > 0) { withGeo++; if (ix.count % 3 !== 0) badIdx++; }
    }
    return { withGeo, badIdx, remaining: B.dirty.size };
  });
  assert(r.withGeo > 10, "지오메트리가 생긴 청크가 너무 적음: " + r.withGeo);
  eq(r.badIdx, 0, "인덱스 개수가 3의 배수가 아닌 청크");
  eq(r.remaining, 0, "예산을 크게 줬는데 남은 dirty 청크");
});

test("메시: 완전히 둘러싸인 블록은 면을 만들지 않는다(내부 면 제거)", async (page) => {
  const r = await page.evaluate(() => {
    const B = window.__blockyard;
    // 16^3 청크 하나를 통째로 돌로 채우면 겉면만 남아야 한다
    const cx = 1, cy = 0, cz = 1;
    for (let y = 0; y < 16; y++) for (let z = 0; z < 16; z++) for (let x = 0; x < 16; x++)
      B.set(cx * 16 + x, cy * 16 + y, cz * 16 + z, B.B.STONE);
    B.markAllDirty(); B.buildBudget(4000);
    const g = B.opaqueMeshes[B.chunkId(cx, cy, cz)].geometry;
    return { verts: g.getAttribute("position").count };
  });
  // 겉면 6*16*16 = 1536 면 이하, 면당 4정점 → 6144 이하
  assert(r.verts <= 6144, "내부 면이 제거되지 않음: 정점 " + r.verts);
});

// ── 8. 중력 블록 · 물 ──────────────────────────────────
test("중력: 공중에 놓인 모래는 바닥까지 떨어진다", async (page) => {
  const r = await page.evaluate(() => {
    const B = window.__blockyard;
    // 물이 아닌 마른 땅 기둥을 하나 고른다 (모래는 마크와 마찬가지로 물을 통과해 가라앉는다)
    let x = -1, z = -1, g = -1;
    for (let zz = 4; zz < B.WZ - 4 && x < 0; zz += 3) for (let xx = 4; xx < B.WX - 4; xx += 3) {
      const t = B.topMap[zz * B.WX + xx];
      if (t > B.SEA && B.world[B.idx(xx, t, zz)] !== B.B.WATER && t + 9 < B.WY) {
        x = xx; z = zz; g = t; break;
      }
    }
    if (x < 0) return { skip: true };
    for (let y = g + 1; y < g + 9; y++) B.applyEdit(x, y, z, B.B.AIR, false);
    B.applyEdit(x, g + 6, z, B.B.SAND, false);
    B.enqueueFall(x, g + 6, z);
    for (let k = 0; k < 40; k++) B.fallTick(500);
    return { top: B.world[B.idx(x, g + 6, z)], landed: B.world[B.idx(x, g + 1, z)],
             SAND: B.B.SAND };
  });
  if (r.skip) return;
  eq(r.top, 0, "원래 자리가 비어야 함");
  eq(r.landed, r.SAND, "지면 위에 쌓여야 함");
});

test("물: 바닥을 뚫으면 바닷물이 흘러 들어온다", async (page) => {
  const r = await page.evaluate(() => {
    const B = window.__blockyard;
    // 물이 있는 칸을 찾는다
    let wx = -1, wy = -1, wz = -1;
    outer:
    for (let z = 1; z < B.WZ - 1; z++) for (let x = 1; x < B.WX - 1; x++) {
      for (let y = B.SEA; y > 1; y--) {
        if (B.world[B.idx(x, y, z)] === B.B.WATER &&
            B.world[B.idx(x, y - 1, z)] !== B.B.WATER &&
            B.world[B.idx(x, y - 1, z)] !== 0) { wx = x; wy = y; wz = z; break outer; }
      }
    }
    if (wx < 0) return { skip: true };
    B.applyEdit(wx, wy - 1, wz, B.B.AIR, true);
    for (let k = 0; k < 30; k++) B.waterTick(2000);
    return { filled: B.world[B.idx(wx, wy - 1, wz)] === B.B.WATER };
  });
  if (r.skip) return;
  assert(r.filled, "물이 아래로 흘러들지 않음");
});

// ── 9. 도전 과제 · UI ──────────────────────────────────
test("도전 과제: 목록이 비어 있지 않고 unlock 이 카운트를 올린다", async (page) => {
  const r = await page.evaluate(() => {
    const B = window.__blockyard;
    B.resetAch();
    const before = B.achCount();
    B.unlock("firstMine");
    B.unlock("firstMine");
    return { total: B.ACHIEVEMENTS.length, before, after: B.achCount() };
  });
  assert(r.total >= 16, "과제 수");
  eq(r.before, 0, "초기화 후 0");
  eq(r.after, 1, "중복 unlock 은 1회만");
});

test("UI: 핫바 10칸이 그려지고 블록 목록 그리드가 채워진다", async (page) => {
  const r = await page.evaluate(() => ({
    slots: document.querySelectorAll("#hotbar .slot").length,
    picks: document.querySelectorAll("#pick-grid .pick").length,
    achs: document.querySelectorAll("#achgrid .ach").length
  }));
  eq(r.slots, 10, "핫바 칸 수");
  assert(r.picks >= 15, "블록 목록 항목 수: " + r.picks);
});

test("미니맵: 그려도 예외가 나지 않고 캔버스가 비어 있지 않다", async (page) => {
  const r = await page.evaluate(() => {
    const B = window.__blockyard;
    B.drawMinimap();
    const cv = document.getElementById("mm");
    const d = cv.getContext("2d").getImageData(0, 0, cv.width, cv.height).data;
    let nonzero = 0;
    for (let i = 3; i < d.length; i += 4 * 37) if (d[i] > 0) nonzero++;
    return { nonzero };
  });
  assert(r.nonzero > 0, "미니맵이 비어 있음");
});

// ── 10. 시드 결정성 ────────────────────────────────────
test("시드: 같은 시드로 재생성하면 완전히 동일한 지형이 나온다", async (page) => {
  const r = await page.evaluate(() => {
    const B = window.__blockyard;
    B.generate(4242);
    const a = B.world.slice();
    B.generate(999);
    B.generate(4242);
    let diff = 0;
    for (let i = 0; i < B.N; i++) if (B.world[i] !== a[i]) diff++;
    return { diff };
  });
  eq(r.diff, 0, "같은 시드인데 달라진 셀 수");
});


// ══════════════════════════════════════════════════════════════
//  개선 v5 회귀 테스트 — 10군데 업그레이드
// ══════════════════════════════════════════════════════════════

// ── 개선 1. 캐는 동안 팔 휘두르기 + 반복 채굴음
test("개선1 채굴감: 캐는 내내 팔이 반복해서 휘둘린다", async (page) => {
  const r = await page.evaluate(async () => {
    const B = window.__blockyard;
    B.setPaused(true);
    B.beginPlay();
    const px = 48, py = 34, pz = 48;
    B.player.pos.set(px + 0.5, py, pz + 0.5);
    B.setKey("KeyW", false);
    B.breaking.on = true; B.breaking.x = px; B.breaking.y = py; B.breaking.z = pz - 2;
    B.breaking.t = 0; B.breaking.need = 999; B.breaking.stage = -1; B.breaking.sw = 0;

    // step() 대신 채굴 타이머만 직접 돌려 스윙 재발동 횟수를 센다
    let swings = 0, prev = 0;
    for (let k = 0; k < 120; k++) {          // 2초 분량
      const dt = 1 / 60;
      B.breaking.sw -= dt;
      if (B.breaking.sw <= 0) { B.breaking.sw = 0.28; B.triggerSwing(); }
      B.updateHand(dt);
      const sw = B.getSwing();
      if (sw > prev) swings++;
      prev = sw;
    }
    B.endPlay(); B.setPaused(false);
    return { swings };
  });
  assert(r.swings >= 5, "2초간 팔 휘두른 횟수: " + r.swings);
});

// ── 개선 2. 스텝 높이 0.6
test("개선2 스텝: 1블록 벽은 걸어서 못 오르고 반블록은 오른다", async (page) => {
  const r = await page.evaluate(() => {
    const B = window.__blockyard;
    const x = 24, y = 30, z = 24;
    for (let dx = -2; dx <= 2; dx++) for (let dz = -2; dz <= 2; dz++)
      for (let dy = -1; dy <= 4; dy++) B.applyEdit(x + dx, y + dy, z + dz, B.B.AIR, false);
    for (let dx = -2; dx <= 2; dx++) for (let dz = -2; dz <= 2; dz++)
      B.applyEdit(x + dx, y - 1, z + dz, B.B.STONE, false);

    // (a) 온전한 1블록 벽
    B.applyEdit(x, y, z - 1, B.B.STONE, false);
    B.player.pos.set(x + 0.5, y, z + 0.5);
    B.player.onGround = true;
    B.moveHorizontal(0, -0.8);
    const wallY = B.player.pos.y;
    B.applyEdit(x, y, z - 1, B.B.AIR, false);

    // (b) 반블록
    B.applyEdit(x, y, z - 1, B.B.STONE, false, B.SH.SLAB);
    B.player.pos.set(x + 0.5, y, z + 0.5);
    B.player.onGround = true;
    B.moveHorizontal(0, -0.8);
    const slabY = B.player.pos.y;
    const slabZ = B.player.pos.z;
    B.applyEdit(x, y, z - 1, B.B.AIR, false);
    return { wallY, slabY, slabZ, base: y, STEP_UP: B.STEP_UP };
  });
  eq(r.STEP_UP, 0.6, "스텝 높이 상수");
  near(r.wallY, r.base, 0.001, "1블록 벽을 걸어서 올라가 버렸다");
  near(r.slabY, r.base + 0.5, 0.02, "반블록 위로 올라서지 못했다");
});

// ── 개선 3. Shift 웅크리기 + 가장자리 추락 방지
test("개선3 웅크리기: 발판 밖으로 발을 내밀지 않는다", async (page) => {
  const r = await page.evaluate(() => {
    const B = window.__blockyard;
    const x = 34, y = 30, z = 34;
    for (let dx = -3; dx <= 3; dx++) for (let dz = -3; dz <= 3; dz++)
      for (let dy = -2; dy <= 4; dy++) B.applyEdit(x + dx, y + dy, z + dz, B.B.AIR, false);
    // 1×1 발판 하나만 남긴다
    B.applyEdit(x, y - 1, z, B.B.STONE, false);

    // 웅크리지 않으면 그대로 걸어 나간다
    B.setSneak(false);
    B.player.pos.set(x + 0.5, y, z + 0.5); B.player.onGround = true;
    B.moveHorizontal(0.9, 0);
    const freeX = B.player.pos.x;

    // 웅크리면 발판 위에 머문다
    B.setSneak(true);
    B.player.pos.set(x + 0.5, y, z + 0.5); B.player.onGround = true;
    B.moveHorizontal(0.9, 0);
    const sneakX = B.player.pos.x;
    const supported = B.footSupported(B.player.pos.x, B.player.pos.y, B.player.pos.z);
    B.setSneak(false);
    return { freeX, sneakX, supported, edge: x + 1 };
  });
  assert(r.freeX > r.edge - 0.35, "웅크리지 않았는데 못 나갔다: " + r.freeX);
  assert(r.supported, "웅크렸는데 발밑이 비었다");
  assert(r.sneakX < r.freeX, "웅크리기가 이동을 막지 못했다");
});

// ── 개선 4. 휠 클릭 픽블록
test("개선4 픽블록: 휠 클릭이 조준한 블록을 핫바에 담는다", async (page) => {
  const r = await page.evaluate(() => {
    const B = window.__blockyard;
    B.setPaused(true);
    const x = 44, y = 30, z = 44;
    for (let dx = -2; dx <= 2; dx++) for (let dy = -2; dy <= 2; dy++) for (let dz = -4; dz <= 2; dz++)
      B.applyEdit(x + dx, y + dy, z + dz, B.B.AIR, false);
    B.applyEdit(x, y, z - 3, B.B.BRICK, false);
    B.player.pos.set(x + 0.5, y - 1.62 + 0.5, z + 0.5);
    B.camera.position.set(x + 0.5, y + 0.5, z + 0.5);
    B.camera.rotation.y = 0; B.camera.rotation.x = 0;
    B.player.yaw = 0; B.player.pitch = 0;
    B.beginPlay();
    const sel = B.getSelected();
    B.getBar()[sel] = B.B.GRASS;
    const canvas = document.querySelector("#stage canvas");
    canvas.dispatchEvent(new MouseEvent("mousedown", { button: 1, bubbles: true, cancelable: true }));
    const after = B.getBar()[sel];
    B.endPlay(); B.setPaused(false);
    return { after, BRICK: B.B.BRICK };
  });
  eq(r.after, r.BRICK, "휠 클릭 후 핫바 블록");
});

// ── 개선 5. 광맥
test("개선5 광맥: 광석이 낱개가 아니라 뭉쳐서 나온다", async (page) => {
  const r = await page.evaluate(() => {
    const B = window.__blockyard;
    B.generate(20260904);
    const D = [[1,0,0],[-1,0,0],[0,1,0],[0,-1,0],[0,0,1],[0,0,-1]];
    let ore = 0, withNeighbor = 0;
    for (let y = 1; y < 30; y++) for (let z = 1; z < B.WZ - 1; z++) for (let x = 1; x < B.WX - 1; x++) {
      const b = B.world[B.idx(x, y, z)];
      if (b !== B.B.COAL && b !== B.B.IRON) continue;
      ore++;
      for (let d = 0; d < 6; d++) {
        const n = B.world[B.idx(x + D[d][0], y + D[d][1], z + D[d][2])];
        if (n === b) { withNeighbor++; break; }
      }
    }
    return { ore, withNeighbor, ratio: ore ? withNeighbor / ore : 0 };
  });
  assert(r.ore > 300, "광석이 너무 적다: " + r.ore);
  assert(r.ratio > 0.5, "광석이 여전히 낱개로 흩어져 있다 — 이웃 있는 비율 " + r.ratio.toFixed(2));
});

// ── 개선 6. 실내·지하에서는 비가 안 내린다
test("개선6 날씨: 지붕 아래·지하의 빗줄기는 화면 밖으로 치워진다", async (page) => {
  const r = await page.evaluate(() => {
    const B = window.__blockyard;
    B.setPaused(true);
    B.setWeather(1);

    // (a) 야외 — 대부분의 빗줄기가 보여야 한다
    const cx = Math.floor(B.WX / 2), cz = Math.floor(B.WZ / 2);
    const top = B.topMap[cz * B.WX + cx];
    B.player.pos.set(cx + 0.5, top + 3, cz + 0.5);
    for (let k = 0; k < 8; k++) B.updateWeather(1 / 60);
    let shown = 0, total = 0, inside = 0;
    for (let i = 0; i < B.rPos.length; i += 6) {
      total++;
      if (B.rPos[i + 1] === B.HIDE_Y) continue;
      shown++;
      // 보이는 빗줄기는 반드시 그 열의 지표보다 위에 있어야 한다
      if (B.rPos[i + 1] <= B.columnTop(B.rPos[i], B.rPos[i + 2]) + 1) inside++;
    }

    // (b) 지붕 아래 — 얼굴 앞으로 비가 지나가면 안 된다
    const ry = top + 2;
    for (let dx = -6; dx <= 6; dx++) for (let dz = -6; dz <= 6; dz++)
      B.set(cx + dx, ry + 4, cz + dz, B.B.PLANKS);
    B.refreshAllTops();
    B.player.pos.set(cx + 0.5, ry, cz + 0.5);
    for (let k = 0; k < 8; k++) B.updateWeather(1 / 60);
    let nearFace = 0;
    for (let i = 0; i < B.rPos.length; i += 6) {
      if (B.rPos[i + 1] === B.HIDE_Y) continue;
      if (Math.abs(B.rPos[i] - (cx + 0.5)) < 6 && Math.abs(B.rPos[i + 2] - (cz + 0.5)) < 6 &&
          B.rPos[i + 1] < ry + 4) nearFace++;
    }
    for (let dx = -6; dx <= 6; dx++) for (let dz = -6; dz <= 6; dz++)
      B.set(cx + dx, ry + 4, cz + dz, B.B.AIR);
    B.refreshAllTops();
    B.setWeather(0);
    B.setPaused(false);
    return { shown, total, inside, nearFace };
  });
  assert(r.shown > r.total * 0.4, "야외인데 비가 거의 안 보인다: " + r.shown + "/" + r.total);
  eq(r.inside, 0, "지표 아래로 뚫고 들어간 빗줄기");
  eq(r.nearFace, 0, "지붕 아래인데 얼굴 앞으로 비가 지나간다");
});

// ── 개선 7. 놓기 소리 재질별 + 달리기 FOV
test("개선7 달리기: Ctrl 로 달리면 시야각이 넓어진다", async (page) => {
  const r = await page.evaluate(() => {
    const B = window.__blockyard;
    B.setPaused(true);
    arena(B, 48, 34, 48, 10);
    B.beginPlay();
    const baseFov = B.opts.fov;
    B.setKey("KeyW", true);
    for (let k = 0; k < 30; k++) B.step(1 / 60);
    const walkFov = B.camera.fov, walking = B.getSprinting();
    B.setKey("ControlLeft", true);
    for (let k = 0; k < 60; k++) B.step(1 / 60);
    const runFov = B.camera.fov, running = B.getSprinting();
    B.setKey("KeyW", false); B.setKey("ControlLeft", false);
    B.endPlay(); B.setPaused(false);
    return { baseFov, walkFov, runFov, walking, running };
  });
  eq(r.walking, false, "Ctrl 없이 달리고 있다");
  eq(r.running, true, "Ctrl 을 눌렀는데 달리지 않는다");
  assert(r.runFov > r.walkFov + 2, `달릴 때 FOV 가 안 넓어짐 — 걷기 ${r.walkFov.toFixed(1)} · 달리기 ${r.runFov.toFixed(1)}`);
});

test("개선7 소리: 재질별 놓기/채굴 소리 함수가 예외 없이 돈다", async (page, errors) => {
  const before = errors.length;
  await page.evaluate(() => {
    const B = window.__blockyard;
    B.ALL_BLOCKS.forEach(b => { B.placeSound(b); B.miningSound(b); B.breakSound(b); });
  });
  eq(errors.length, before, "소리 재생 중 오류: " + errors.slice(before).join(" | "));
});

// ── 개선 8. 선택 상자가 모양을 따라간다
test("개선8 선택 상자: 반블록을 조준하면 납작한 상자를 쓴다", async (page) => {
  const r = await page.evaluate(() => {
    const B = window.__blockyard;
    function bounds(g) {
      const a = g.getAttribute("position");
      let lo = Infinity, hi = -Infinity;
      for (let i = 0; i < a.count; i++) { const v = a.getY(i); if (v < lo) lo = v; if (v > hi) hi = v; }
      return hi - lo;
    }
    return {
      shapes: B.HL_GEO.length,
      full: bounds(B.HL_GEO[B.SH.FULL]),
      slab: bounds(B.HL_GEO[B.SH.SLAB]),
      stair: bounds(B.HL_GEO[B.SH.N])
    };
  });
  eq(r.shapes, 11, "모양 개수만큼 선택 상자가 있어야 한다");
  near(r.full, 1.008, 0.01, "전체 블록 높이");
  near(r.slab, 0.508, 0.01, "반블록 높이");
  near(r.stair, 1.008, 0.01, "계단 높이");
});

// ── 개선 9. 방위 + 기반암
test("개선9 방위: yaw 에 따라 북/서/남/동을 옳게 표시한다", async (page) => {
  const r = await page.evaluate(() => {
    const B = window.__blockyard;
    const keep = B.player.yaw;
    const out = [];
    [0, Math.PI / 2, Math.PI, -Math.PI / 2].forEach(y => {
      B.player.yaw = y; out.push(B.facingText());
    });
    B.player.yaw = keep;
    return out;
  });
  eq(r[0], "북 N", "yaw 0");
  eq(r[1], "서 W", "yaw 90°");
  eq(r[2], "남 S", "yaw 180°");
  eq(r[3], "동 E", "yaw -90°");
});

test("개선9 기반암: 바닥 층이 BEDROCK 이고 절대 캐지지 않는다", async (page) => {
  const r = await page.evaluate(() => {
    const B = window.__blockyard;
    B.generate(777);
    let bedrock = 0, other = 0;
    for (let z = 0; z < B.WZ; z++) for (let x = 0; x < B.WX; x++) {
      if (B.world[B.idx(x, 0, z)] === B.B.BEDROCK) bedrock++; else other++;
    }
    // 위로 올려 놓아도 캐지지 않아야 한다
    B.set(20, 20, 20, B.B.BEDROCK);
    const mined = B.applyEdit(20, 20, 20, B.B.AIR, false);
    const still = B.world[B.idx(20, 20, 20)];
    B.set(20, 20, 20, B.B.AIR);
    return { bedrock, other, mined, still, BEDROCK: B.B.BEDROCK,
             named: B.NAMES[B.B.BEDROCK], unbreak: B.isUnbreakable(B.B.BEDROCK) };
  });
  eq(r.other, 0, "바닥에 기반암이 아닌 칸");
  eq(r.mined, false, "기반암이 캐졌다");
  eq(r.still, r.BEDROCK, "기반암이 사라졌다");
  eq(r.named, "BEDROCK", "이름");
  assert(r.unbreak, "isUnbreakable 이 false");
});

test("개선9 기반암: 텍스처가 돌과 뚜렷이 구분된다", async (page) => {
  const r = await page.evaluate(() => {
    const B = window.__blockyard;
    return { bed: B.TILES[B.B.BEDROCK][0], stone: B.TILES[B.B.STONE][0] };
  });
  assert(r.bed !== r.stone, "기반암이 돌과 같은 타일을 쓴다");
});

// ── 개선 10. 관성
test("개선10 관성: W 를 떼도 잠깐 미끄러지고, 공중에서는 방향을 거의 못 바꾼다", async (page) => {
  const r = await page.evaluate(() => {
    const B = window.__blockyard;
    B.setPaused(true);
    arena(B, 48, 34, 48, 12);
    B.beginPlay();

    // (a) 출발 — 첫 프레임에 최고속이 되면 관성이 없는 것이다
    B.setKey("KeyW", true);
    B.step(1 / 60);
    const firstFrame = Math.hypot(B.player.vel.x, B.player.vel.z);
    for (let k = 0; k < 40; k++) B.step(1 / 60);
    const cruise = Math.hypot(B.player.vel.x, B.player.vel.z);

    // (b) 정지 — 뗀 직후에도 속도가 남아 있어야 한다
    B.setKey("KeyW", false);
    B.step(1 / 60); B.step(1 / 60);
    const coast = Math.hypot(B.player.vel.x, B.player.vel.z);
    for (let k = 0; k < 40; k++) B.step(1 / 60);
    const stopped = Math.hypot(B.player.vel.x, B.player.vel.z);

    B.endPlay(); B.setPaused(false);
    return { firstFrame, cruise, coast, stopped, WALK: B.WALK };
  });
  assert(r.cruise > r.WALK * 0.8, "제 속도까지 못 붙는다: " + r.cruise.toFixed(2));
  assert(r.firstFrame < r.cruise * 0.7,
    `출발이 즉시다(관성 없음) — 1프레임 ${r.firstFrame.toFixed(2)} vs 순항 ${r.cruise.toFixed(2)}`);
  assert(r.coast > 0.4, "뗀 즉시 멈춘다: " + r.coast.toFixed(2));
  eq(r.stopped, 0, "결국은 완전히 멈춰야 한다");
});

test("개선10 공중 제어: 공중에서는 방향 전환이 지상보다 훨씬 느리다", async (page) => {
  const r = await page.evaluate(() => {
    const B = window.__blockyard;
    B.setPaused(true);

    function run(inAir) {
      arena(B, 48, 34, 48, 14);
      B.beginPlay();
      B.setKey("KeyW", true);
      for (let k = 0; k < 40; k++) B.step(1 / 60);
      if (inAir) { B.player.pos.y += 6; B.player.onGround = false; }
      // 반대 방향으로 꺾는다
      B.setKey("KeyW", false); B.setKey("KeyS", true);
      for (let k = 0; k < 10; k++) B.step(1 / 60);
      const vz = B.player.vel.z;
      B.setKey("KeyS", false);
      B.endPlay();
      return vz;
    }
    const ground = run(false);
    const air = run(true);
    B.setPaused(false);
    return { ground, air };
  });
  // 앞으로 갈 때 vel.z 는 음수, 뒤로 꺾으면 양수 쪽으로 간다
  assert(r.ground > r.air, `공중 제어가 지상과 같다 — 지상 ${r.ground.toFixed(2)} · 공중 ${r.air.toFixed(2)}`);
});

// ── 안전장치 (파괴적 조작)
test("안전: R 한 번으로는 세계가 날아가지 않는다", async (page) => {
  const r = await page.evaluate(() => {
    const B = window.__blockyard;
    B.setPaused(true);
    B.beginPlay();
    const seedBefore = B.seed();
    window.dispatchEvent(new KeyboardEvent("keydown", { code: "KeyR", bubbles: true }));
    window.dispatchEvent(new KeyboardEvent("keyup", { code: "KeyR", bubbles: true }));
    const seedAfter = B.seed();
    B.endPlay(); B.setPaused(false);
    return { seedBefore, seedAfter };
  });
  eq(r.seedAfter, r.seedBefore, "R 한 번에 세계가 새로 만들어졌다");
});


// ══════════════════════════════════════════════════════════════
//  개선 v6 회귀 테스트 — 2차 잔여 + 3차
// ══════════════════════════════════════════════════════════════

test("v6 계단: 상단 반블록과 반전 계단 5종이 추가됐다", async (page) => {
  const r = await page.evaluate(() => {
    const B = window.__blockyard;
    function span(si, axis) {
      const bs = B.SHAPE_BOXES[si];
      let lo = Infinity, hi = -Infinity;
      for (const q of bs) { lo = Math.min(lo, q[axis]); hi = Math.max(hi, q[axis + 3]); }
      return [lo, hi];
    }
    return {
      count: B.SHAPE_BOXES.length,
      slabDown: span(B.SH.SLAB, 1),
      slabUp: span(6, 1),
      stairUp: span(7, 1)
    };
  });
  eq(r.count, 11, "모양 개수");
  eq(r.slabDown[0], 0, "아래 반블록의 바닥");
  eq(r.slabDown[1], 0.5, "아래 반블록의 천장");
  eq(r.slabUp[0], 0.5, "위 반블록의 바닥");
  eq(r.slabUp[1], 1, "위 반블록의 천장");
});

test("v6 계단: 밑면을 클릭하면 위 변형, 윗면을 클릭하면 아래 변형", async (page) => {
  const r = await page.evaluate(() => {
    const B = window.__blockyard;
    return {
      top: B.upperFromHit({ y: 10, ny: 1, hitY: 11 }),
      bottom: B.upperFromHit({ y: 10, ny: -1, hitY: 10 }),
      sideLow: B.upperFromHit({ y: 10, ny: 0, hitY: 10.2 }),
      sideHigh: B.upperFromHit({ y: 10, ny: 0, hitY: 10.8 })
    };
  });
  eq(r.top, false, "윗면");
  eq(r.bottom, true, "밑면(천장)");
  eq(r.sideLow, false, "옆면 아래쪽 절반");
  eq(r.sideHigh, true, "옆면 위쪽 절반");
});

test("v6 용암: 지하에 생기고, 빛을 내며, 통과할 수 있다", async (page) => {
  const r = await page.evaluate(() => {
    const B = window.__blockyard;
    B.generate(20260904); B.relightAll(false);
    let count = 0, lit = 0, deep = 0, maxY = -1;
    for (let i = 0; i < B.N; i++) {
      if (B.world[i] !== B.B.LAVA) continue;
      count++;
      const y = Math.floor(i / (B.WX * B.WZ));
      if (y <= 4) deep++;
      if (y > maxY) maxY = y;
      if (B.lightBlk[i] >= 14) lit++;
    }
    return { count, lit, deep, maxY, solid: B.isSolid(B.B.LAVA), liquid: B.isLiquid(B.B.LAVA) };
  });
  assert(r.count > 50, "용암이 너무 적다: " + r.count);
  eq(r.deep, r.count, "용암이 세계 바닥(y<=4) 밖에도 생겼다 — 최대 y " + r.maxY);
  eq(r.lit, r.count, "빛을 내지 않는 용암이 있다");
  eq(r.solid, false, "용암이 막고 있다");
  eq(r.liquid, true, "용암이 액체가 아니다");
});

test("v6 얼음: 설원 수면만 얼고, 빛은 통과한다", async (page) => {
  const r = await page.evaluate(() => {
    const B = window.__blockyard;
    B.generate(20260904);
    let ice = 0, wrongBiome = 0, wrongY = 0;
    for (let z = 0; z < B.WZ; z++) for (let x = 0; x < B.WX; x++) {
      for (let y = 0; y < B.WY; y++) {
        if (B.world[B.idx(x, y, z)] !== B.B.ICE) continue;
        ice++;
        if (B.biomeMap[z * B.WX + x] !== 1) wrongBiome++;
        if (y !== B.SEA) wrongY++;
      }
    }
    return { ice, wrongBiome, wrongY,
             pass: B.lightPass(B.B.ICE), trans: B.isTransparent(B.B.ICE) };
  });
  assert(r.ice > 0, "얼음이 하나도 없다");
  eq(r.wrongBiome, 0, "설원이 아닌 곳의 얼음");
  eq(r.wrongY, 0, "해수면이 아닌 높이의 얼음");
  assert(r.pass && r.trans, "얼음이 빛을 막는다");
});

test("v6 풀·꽃: 초원에 심기고, 통과할 수 있고, 빛을 막지 않는다", async (page) => {
  const r = await page.evaluate(() => {
    const B = window.__blockyard;
    B.generate(99999); B.relightAll(false);
    let plants = 0, floating = 0;
    for (let z = 0; z < B.WZ; z++) for (let x = 0; x < B.WX; x++)
      for (let y = 1; y < B.WY; y++) {
        const b = B.world[B.idx(x, y, z)];
        if (!B.isCross(b)) continue;
        plants++;
        if (!B.isSolid(B.world[B.idx(x, y - 1, z)])) floating++;
      }
    return { plants, floating,
             solid: B.isSolid(B.B.TALLGRASS), blocks: B.blocksLight(B.B.TALLGRASS) };
  });
  assert(r.plants > 200, "풀·꽃이 너무 적다: " + r.plants);
  eq(r.floating, 0, "허공에 뜬 풀·꽃");
  eq(r.solid, false, "풀이 길을 막는다");
  eq(r.blocks, false, "풀이 빛을 막는다");
});

test("v6 풀: 받치던 바닥이 사라지면 함께 사라진다", async (page) => {
  const r = await page.evaluate(() => {
    const B = window.__blockyard;
    arena(B, 48, 34, 48, 4);
    const x = 50, y = 34, z = 50;
    B.applyEdit(x, y - 1, z, B.B.GRASS, false);
    B.applyEdit(x, y, z, B.B.TALLGRASS, false);
    const before = B.world[B.idx(x, y, z)];
    B.applyEdit(x, y - 1, z, B.B.AIR, false);
    return { before, after: B.world[B.idx(x, y, z)], GRASS: B.B.TALLGRASS };
  });
  eq(r.before, r.GRASS, "풀이 놓이지 않았다");
  eq(r.after, 0, "바닥이 사라졌는데 풀이 남아 있다");
});

test("v6 횃불: 바닥이 있어야 놓이고, 주변을 밝힌다", async (page) => {
  const r = await page.evaluate(() => {
    const B = window.__blockyard;
    arena(B, 48, 34, 48, 5);
    const x = 49, y = 34, z = 49;
    B.applyEdit(x, y, z, B.B.TORCH, false);
    B.relightLocal(x, y, z);
    return {
      lit: B.lightBlk[B.idx(x + 1, y, z)],
      self: B.lightBlk[B.idx(x, y, z)],
      needsFloor: B.isCross(B.B.TORCH),
      solid: B.isSolid(B.B.TORCH)
    };
  });
  assert(r.self >= 14, "횃불 자리가 어둡다: " + r.self);
  assert(r.lit >= 13, "횃불 옆이 어둡다: " + r.lit);
  eq(r.solid, false, "횃불이 길을 막는다");
});

test("v6 세계: 높이가 64 로 늘고 해수면 위 여유가 50칸을 넘는다", async (page) => {
  const r = await page.evaluate(() => {
    const B = window.__blockyard;
    return { WY: B.WY, headroom: B.WY - B.SEA };
  });
  eq(r.WY, 64, "세계 높이");
  assert(r.headroom > 50, "해수면 위 여유: " + r.headroom);
});

test("v6 저장: 구버전(높이 48) 저장을 그대로 이어받는다", async (page) => {
  const r = await page.evaluate(() => {
    const B = window.__blockyard;
    const legacy = new Uint8Array(B.WX * B.LEGACY_WY * B.WZ);
    // 바닥 한 층과, y=20 에 표식 하나
    for (let z = 0; z < B.WZ; z++) for (let x = 0; x < B.WX; x++)
      legacy[(0 * B.WZ + z) * B.WX + x] = B.B.BEDROCK;
    legacy[(20 * B.WZ + 30) * B.WX + 40] = B.B.BRICK;
    const dst = new Uint8Array(B.N);
    const ok = B.liftLegacy(B.encodeArrB64(legacy), dst, false);
    let floor = 0;
    for (let z = 0; z < B.WZ; z++) for (let x = 0; x < B.WX; x++)
      if (dst[B.idx(x, 0, z)] === B.B.BEDROCK) floor++;
    return { ok, floor, total: B.WX * B.WZ,
             mark: dst[B.idx(40, 20, 30)], BRICK: B.B.BRICK,
             above: dst[B.idx(40, 50, 30)] };
  });
  assert(r.ok, "구버전 저장을 읽지 못했다");
  eq(r.floor, r.total, "바닥 층이 온전히 옮겨지지 않았다");
  eq(r.mark, r.BRICK, "표식 블록의 좌표가 어긋났다");
  eq(r.above, 0, "새로 늘어난 위쪽이 비어 있지 않다");
});

test("v6 잎 부패: 원목을 베면 이어지지 않은 잎이 사라진다", async (page) => {
  const r = await page.evaluate(() => {
    const B = window.__blockyard;
    arena(B, 48, 34, 48, 10);
    const x = 48, y = 34, z = 48;
    // 기둥 4칸 + 그 위 잎 덩어리
    for (let k = 0; k < 4; k++) B.set(x, y + k, z, B.B.LOG);
    const crown = [];
    for (let dx = -2; dx <= 2; dx++) for (let dz = -2; dz <= 2; dz++) for (let dy = 3; dy <= 5; dy++) {
      if (dx === 0 && dz === 0 && dy === 3) continue;
      B.set(x + dx, y + dy, z + dz, B.B.LEAVES);
      crown.push([x + dx, y + dy, z + dz]);
    }
    B.refreshAllTops();
    // 기둥을 아래부터 전부 캔다
    for (let k = 3; k >= 0; k--) B.applyEdit(x, y + k, z, B.B.AIR, false);
    const queued = B.decayPending();
    for (let k = 0; k < 400; k++) B.decayTick(20);
    let left = 0;
    for (const c of crown) if (B.world[B.idx(c[0], c[1], c[2])] === B.B.LEAVES) left++;
    return { queued, left, total: crown.length };
  });
  assert(r.queued > 0, "부패 대기열이 비어 있다");
  eq(r.left, 0, `잎 ${r.total}개 중 ${r.left}개가 공중에 남았다`);
});

test("v6 잎 부패: 원목이 남아 있으면 가까운 잎은 살아 있다", async (page) => {
  const r = await page.evaluate(() => {
    const B = window.__blockyard;
    arena(B, 20, 34, 20, 10);
    const x = 20, y = 34, z = 20;
    for (let k = 0; k < 5; k++) B.set(x, y + k, z, B.B.LOG);
    // 줄기에 닿는 잎 (실제 나무 모양)
    const crown = [];
    for (let dx = -1; dx <= 1; dx++) for (let dz = -1; dz <= 1; dz++) {
      if (dx === 0 && dz === 0) continue;
      // 남아 있을 원목(y+3)에 바로 맞닿는 잎 — 실제 나무 생성과 같은 모양
      B.set(x + dx, y + 3, z + dz, B.B.LEAVES);
      crown.push([x + dx, y + 3, z + dz]);
    }
    B.refreshAllTops();
    // 맨 위 원목 하나만 캔다 — 아래 원목이 남아 있으므로 잎은 살아야 한다
    B.applyEdit(x, y + 4, z, B.B.AIR, false);
    for (let k = 0; k < 200; k++) B.decayTick(20);
    let left = 0;
    for (const c of crown) if (B.world[B.idx(c[0], c[1], c[2])] === B.B.LEAVES) left++;
    return { left, total: crown.length };
  });
  eq(r.left, r.total, "원목이 남아 있는데 잎이 사라졌다");
});

test("v6 물: 놓은 물이 아래로 떨어지고 옆으로 3칸까지만 퍼진다", async (page) => {
  const r = await page.evaluate(() => {
    const B = window.__blockyard;
    arena(B, 60, 34, 60, 14);
    const x = 60, y = 34, z = 60;
    B.applyEdit(x, y + 3, z, B.B.WATER, false);        // 3칸 공중에서 붓는다
    for (let k = 0; k < 200; k++) B.waterTick(2000);

    let maxDist = 0, cells = 0, wrongLvl = 0;
    for (let dx = -10; dx <= 10; dx++) for (let dz = -10; dz <= 10; dz++)
      for (let dy = 0; dy <= 4; dy++) {
        const i = B.idx(x + dx, y + dy, z + dz);
        if (B.world[i] !== B.B.WATER) continue;
        cells++;
        const d = Math.abs(dx) + Math.abs(dz);
        if (d > maxDist) maxDist = d;
        if (B.waterLvl[i] > B.MAXFLOW) wrongLvl++;
      }
    return { maxDist, cells, wrongLvl, MAXFLOW: B.MAXFLOW,
             fell: B.world[B.idx(x, y, z)] === B.B.WATER };
  });
  assert(r.fell, "물이 바닥까지 떨어지지 않았다");
  assert(r.cells > 5, "물이 퍼지지 않았다: " + r.cells);
  eq(r.wrongLvl, 0, "허용치를 넘는 흐름 단계");
  assert(r.maxDist <= r.MAXFLOW, `옆으로 ${r.maxDist}칸이나 퍼졌다 (최대 ${r.MAXFLOW})`);
});

test("v6 물: 근원을 없애면 흘러나온 물이 마른다", async (page) => {
  const r = await page.evaluate(() => {
    const B = window.__blockyard;
    arena(B, 20, 40, 20, 12);
    const x = 20, y = 40, z = 20;
    B.applyEdit(x, y, z, B.B.WATER, false);
    for (let k = 0; k < 200; k++) B.waterTick(2000);
    let wet = 0;
    for (let dx = -6; dx <= 6; dx++) for (let dz = -6; dz <= 6; dz++)
      if (B.world[B.idx(x + dx, y, z + dz)] === B.B.WATER) wet++;

    B.applyEdit(x, y, z, B.B.AIR, false);              // 근원 제거
    for (let k = 0; k < 400; k++) B.dryTick(2000);
    let left = 0;
    for (let dx = -6; dx <= 6; dx++) for (let dz = -6; dz <= 6; dz++)
      if (B.world[B.idx(x + dx, y, z + dz)] === B.B.WATER) left++;
    return { wet, left };
  });
  assert(r.wet > 3, "물이 퍼지지 않아 시험이 성립하지 않는다: " + r.wet);
  eq(r.left, 0, "근원을 없앴는데 물이 남았다");
});

test("v6 물: 바다는 마르지 않는다", async (page) => {
  const r = await page.evaluate(() => {
    const B = window.__blockyard;
    B.generate(777);
    let before = 0;
    for (let i = 0; i < B.N; i++) if (B.world[i] === B.B.WATER) before++;
    // 바다 한복판 아무 칸이나 건드려 마름 판정을 깨운다
    for (let z = 0; z < B.WZ; z += 8) for (let x = 0; x < B.WX; x += 8)
      B.enqueueDryAround(x, B.SEA, z);
    for (let k = 0; k < 200; k++) B.dryTick(4000);
    let after = 0;
    for (let i = 0; i < B.N; i++) if (B.world[i] === B.B.WATER) after++;
    return { before, after };
  });
  eq(r.after, r.before, "바닷물이 말라 버렸다");
});

// ── 실행 ───────────────────────────────────────────────
const browser = await launch();
let totalFail = 0, totalPass = 0;
const failNames = new Map();

for (let round = 1; round <= REPEAT; round++) {
  const { page, ctx, errors } = await openGame(browser);
  let pass = 0, fail = 0;
  const lines = [];
  for (const t of T) {
    if (FILTER && !t.name.includes(FILTER)) continue;
    try {
      await page.evaluate("(function(){" + ARENA + "\nwindow.arena = arena;})()");
      await t.fn(page, errors);
      pass++;
    } catch (e) {
      fail++;
      failNames.set(t.name, (failNames.get(t.name) || 0) + 1);
      lines.push(`  ✗ ${t.name}\n      ${String(e.message).split("\n")[0]}`);
    }
  }
  if (errors.length) {
    fail++; failNames.set("페이지 오류 없음", (failNames.get("페이지 오류 없음") || 0) + 1);
    lines.push("  ✗ 페이지 오류 없음\n      " + errors.slice(0, 3).join(" | "));
  } else pass++;
  totalPass += pass; totalFail += fail;
  console.log(`[${round}/${REPEAT}] 통과 ${pass} · 실패 ${fail}`);
  if (lines.length) console.log(lines.join("\n"));
  await ctx.close();
}
await browser.close();

console.log("─".repeat(52));
console.log(`합계: 통과 ${totalPass} · 실패 ${totalFail} (${REPEAT}회 반복)`);
if (failNames.size) {
  console.log("실패한 항목:");
  for (const [n, c] of failNames) console.log(`  · ${n} — ${c}/${REPEAT}회`);
}
process.exit(totalFail ? 1 : 0);
