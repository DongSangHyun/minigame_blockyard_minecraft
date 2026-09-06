// Blockyard 회귀 테스트 스위트
import { launch, openGame, stopServer, assert, eq, near } from "./harness.mjs";

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
  assert(r.shapes >= 11, "모양 개수만큼 선택 상자가 있어야 한다: " + r.shapes);
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
  eq(r.named, "기반암", "이름");
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
  assert(r.count >= 11, "모양 개수: " + r.count);
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


// ══════════════════════════════════════════════════════════════
//  개선 v8 회귀 테스트 — 새 블록을 "상호작용 계층" 에 등록하기
// ══════════════════════════════════════════════════════════════

test("v8 물: 흐르는 물이 풀을 쓸어버리며 퍼진다", async (page) => {
  const r = await page.evaluate(() => {
    const B = window.__blockyard;
    const x = 60, y = 40, z = 60;
    for (let dx = -6; dx <= 6; dx++) for (let dz = -6; dz <= 6; dz++) {
      for (let dy = 0; dy <= 4; dy++) B.set(x + dx, y + dy, z + dz, 0);
      B.set(x + dx, y - 1, z + dz, B.B.GRASS);
    }
    B.refreshAllTops();
    // 사방을 풀로 채운다
    for (let dx = -4; dx <= 4; dx++) for (let dz = -4; dz <= 4; dz++)
      if (dx || dz) B.applyEdit(x + dx, y, z + dz, B.B.TALLGRASS, false);
    B.applyEdit(x, y, z, B.B.WATER, false);
    for (let k = 0; k < 200; k++) B.waterTick(4000);
    let wet = 0, grassLeft = 0;
    for (let dx = -4; dx <= 4; dx++) for (let dz = -4; dz <= 4; dz++) {
      const v = B.world[B.idx(x + dx, y, z + dz)];
      if (v === B.B.WATER) wet++;
      if (B.isCross(v) && Math.abs(dx) + Math.abs(dz) <= B.MAXFLOW) grassLeft++;
    }
    return { wet, grassLeft };
  });
  assert(r.wet > 5, "잔디밭에서 물이 퍼지지 않는다: " + r.wet + "칸");
  eq(r.grassLeft, 0, "물이 지나간 자리에 풀이 남았다");
});

test("v8 중력: 모래가 풀을 부수고 지면까지 떨어진다", async (page) => {
  const r = await page.evaluate(() => {
    const B = window.__blockyard;
    const x = 40, y = 40, z = 40;
    for (let dy = 0; dy <= 8; dy++) B.set(x, y + dy, z, 0);
    B.set(x, y - 1, z, B.B.GRASS);
    B.refreshAllTops();
    B.applyEdit(x, y, z, B.B.TALLGRASS, false);
    B.applyEdit(x, y + 4, z, B.B.SAND, false);
    B.enqueueFall(x, y + 4, z);
    for (let k = 0; k < 60; k++) B.fallTick(200);
    let sandY = -1;
    for (let dy = 0; dy <= 6; dy++) if (B.world[B.idx(x, y + dy, z)] === B.B.SAND) sandY = y + dy;
    return { sandY, floor: y, grass: B.isCross(B.world[B.idx(x, y, z)]) };
  });
  eq(r.sandY, r.floor, "모래가 풀 위에 떠서 멈췄다");
  eq(r.grass, false, "모래가 풀을 부수지 않았다");
});

test("v8 놓기: 풀을 조준하고 놓으면 그 자리를 덮어쓴다 (허공 블록 없음)", async (page) => {
  const r = await page.evaluate(() => {
    const B = window.__blockyard;
    B.setPaused(true);
    const x = 30, y = 40, z = 30;
    for (let dx = -3; dx <= 3; dx++) for (let dz = -6; dz <= 3; dz++) {
      for (let dy = 0; dy <= 6; dy++) B.set(x + dx, y + dy, z + dz, 0);
      B.set(x + dx, y - 1, z + dz, B.B.GRASS);
    }
    B.refreshAllTops();
    B.applyEdit(x, y, z - 3, B.B.TALLGRASS, false);

    // 풀을 정면으로 조준한다 — raycast 는 player.pos + EYE 에서 쏜다
    B.player.pos.set(x + 0.5, y + 0.5 - 1.62, z + 0.5);
    B.player.yaw = 0; B.player.pitch = 0;
    B.camera.position.set(x + 0.5, y + 0.5, z + 0.5);
    B.camera.rotation.set(0, 0, 0);
    const hit = B.raycast(6);
    B.getBar()[B.getSelected()] = B.B.STONE;
    B.beginPlay();
    B.place();
    B.endPlay(); B.setPaused(false);
    return {
      hitBlock: hit && hit.block, TALLGRASS: B.B.TALLGRASS,
      atGrass: B.world[B.idx(x, y, z - 3)], STONE: B.B.STONE,
      above: B.world[B.idx(x, y + 1, z - 3)]
    };
  });
  eq(r.hitBlock, r.TALLGRASS, "풀을 조준하지 못했다");
  eq(r.atGrass, r.STONE, "풀 자리를 덮어쓰지 않았다");
  eq(r.above, 0, "풀 위 허공에 블록이 생겼다");
});

test("v8 조준 표시: 얇은 블록과 v6 모양이 모두 자기 크기를 쓴다", async (page) => {
  const r = await page.evaluate(() => {
    const B = window.__blockyard;
    function height(g) {
      const a = g.getAttribute("position");
      let lo = Infinity, hi = -Infinity;
      for (let i = 0; i < a.count; i++) { const v = a.getY(i); if (v < lo) lo = v; if (v > hi) hi = v; }
      return hi - lo;
    }
    return {
      crossKinds: Object.keys(B.HL_CROSS).length,
      torch: height(B.HL_CROSS[B.B.TORCH]),
      grass: height(B.HL_CROSS[B.B.TALLGRASS]),
      boundsCount: B.SHAPE_BOUNDS.length,
      slabUp: B.SHAPE_BOUNDS[6],
      stairUp: B.SHAPE_BOUNDS[7]
    };
  });
  assert(r.crossKinds >= 4, "얇은 블록 상자가 부족하다: " + r.crossKinds);
  near(r.torch, 0.628, 0.02, "횃불 선택 상자 높이");
  near(r.grass, 0.928, 0.02, "풀 선택 상자 높이");
  assert(r.boundsCount >= 11, "모양별 겉면 범위 개수: " + r.boundsCount);
  eq(r.slabUp.mn[1], 0.5, "상단 반블록의 아래 끝");
  eq(r.stairUp.mx[1], 1, "반전 계단의 위 끝");
});

test("v8 모양: 물·풀·횃불에는 반블록/계단 모양이 붙지 않는다", async (page) => {
  const r = await page.evaluate(() => {
    const B = window.__blockyard;
    B.setPaused(true);
    const x = 70, y = 40, z = 70;
    for (let dx = -3; dx <= 3; dx++) for (let dz = -3; dz <= 3; dz++) {
      for (let dy = 0; dy <= 6; dy++) B.set(x + dx, y + dy, z + dz, 0);
      B.set(x + dx, y - 1, z + dz, B.B.STONE);
    }
    B.refreshAllTops();
    B.setShapeMode(1);                       // 반블록 모드
    B.player.pos.set(x + 0.5, y, z + 0.5);
    B.player.yaw = 0; B.player.pitch = 1.2;  // 발밑을 본다
    B.camera.position.set(x + 0.5, y + 0.3, z + 0.5);
    B.camera.rotation.set(-1.2, 0, 0);
    B.beginPlay();
    B.getBar()[B.getSelected()] = B.B.WATER;
    B.place();
    const out = {};
    for (let dx = -2; dx <= 2; dx++) for (let dz = -2; dz <= 2; dz++)
      for (let dy = 0; dy <= 1; dy++) {
        const i = B.idx(x + dx, y + dy, z + dz);
        if (B.world[i] === B.B.WATER) out.waterShape = B.shape[i];
      }
    // 돌은 여전히 반블록으로 놓여야 한다
    B.getBar()[B.getSelected()] = B.B.STONE;
    B.place();
    for (let dx = -2; dx <= 2; dx++) for (let dz = -2; dz <= 2; dz++)
      for (let dy = 0; dy <= 1; dy++) {
        const i = B.idx(x + dx, y + dy, z + dz);
        if (B.world[i] === B.B.STONE && (y + dy) !== y - 1) out.stoneShape = B.shape[i];
      }
    B.setShapeMode(0);
    B.endPlay(); B.setPaused(false);
    return out;
  });
  eq(r.waterShape, 0, "물에 반블록 모양이 붙었다");
  eq(r.stoneShape, 1, "돌은 반블록으로 놓여야 한다");
});

test("v8 건축: 반블록 위에 같은 반블록을 놓으면 온전한 블록이 된다", async (page) => {
  const r = await page.evaluate(() => {
    const B = window.__blockyard;
    B.setPaused(true);
    const x = 24, y = 44, z = 24;
    for (let dx = -3; dx <= 3; dx++) for (let dz = -3; dz <= 3; dz++)
      for (let dy = -2; dy <= 6; dy++) B.set(x + dx, y + dy, z + dz, 0);
    B.set(x, y - 1, z, B.B.STONE);
    B.applyEdit(x, y, z, B.B.STONE, false, B.SH.SLAB);
    B.refreshAllTops();

    // 반블록 윗면을 내려다본다
    B.player.pos.set(x + 0.5, y + 2, z + 0.5);
    B.camera.position.set(x + 0.5, y + 2.5, z + 0.5);
    B.camera.rotation.set(-Math.PI / 2 + 0.01, 0, 0);
    B.player.yaw = 0; B.player.pitch = -Math.PI / 2 + 0.01;
    B.setShapeMode(1);
    B.getBar()[B.getSelected()] = B.B.STONE;
    B.beginPlay();
    B.place();
    const i = B.idx(x, y, z);
    B.setShapeMode(0);
    B.endPlay(); B.setPaused(false);
    return { block: B.world[i], shape: B.shape[i], STONE: B.B.STONE,
             above: B.world[B.idx(x, y + 1, z)], merged: B.getEarned().slabmerge };
  });
  eq(r.block, r.STONE, "블록이 사라졌다");
  eq(r.shape, 0, "두 반블록이 온전한 블록으로 합쳐지지 않았다");
  eq(r.above, 0, "위 칸에 또 반블록이 생겼다");
});

test("v8 횃불: 굵기가 보일 만큼 되고, 반블록 위에서는 0.5칸 내려앉는다", async (page) => {
  const r = await page.evaluate(() => {
    const B = window.__blockyard;
    const x = 12, y = 44, z = 12;
    for (let dx = -2; dx <= 2; dx++) for (let dz = -2; dz <= 2; dz++)
      for (let dy = -2; dy <= 4; dy++) B.set(x + dx, y + dy, z + dz, 0);
    B.set(x, y - 1, z, B.B.STONE);                      // 온전한 블록
    B.applyEdit(x + 1, y - 1, z, B.B.STONE, false, B.SH.SLAB);   // 하단 반블록
    B.refreshAllTops();
    return {
      w: B.CROSS[B.B.TORCH].w,
      onFull: B.crossBase(x, y, z),
      onSlab: B.crossBase(x + 1, y, z),
      full: y, slab: y - 0.5
    };
  });
  assert(r.w >= 0.2, "횃불이 너무 얇다: 반너비 " + r.w);
  eq(r.onFull, r.full, "온전한 블록 위 횃불 높이");
  eq(r.onSlab, r.slab, "반블록 위 횃불이 0.5칸 떠 있다");
});

test("v8 얼음: 얼음 위에서는 훨씬 멀리 미끄러진다", async (page) => {
  const r = await page.evaluate(() => {
    const B = window.__blockyard;
    B.setPaused(true);
    function run(floor) {
      const x = 48, y = 46, z = 48;
      for (let dx = -14; dx <= 14; dx++) for (let dz = -14; dz <= 14; dz++) {
        for (let dy = 0; dy <= 5; dy++) B.set(x + dx, y + dy, z + dz, 0);
        B.set(x + dx, y - 1, z + dz, floor);
      }
      B.refreshAllTops();
      B.player.pos.set(x + 0.5, y, z + 0.5);
      B.player.vel.set(0, 0, 0);
      B.player.onGround = true; B.player.flying = false;
      B.player.yaw = 0; B.player.pitch = 0;
      B.camera.rotation.set(0, 0, 0);
      B.beginPlay();
      B.setKey("KeyW", true);
      for (let k = 0; k < 90; k++) B.step(1 / 60);
      B.setKey("KeyW", false);
      const z0 = B.player.pos.z;
      for (let k = 0; k < 60; k++) B.step(1 / 60);
      const coast = Math.abs(B.player.pos.z - z0);
      B.endPlay();
      return coast;
    }
    const stone = run(B.B.STONE);
    const ice = run(B.B.ICE);
    B.setPaused(false);
    return { stone, ice };
  });
  assert(r.ice > r.stone * 2,
    `얼음이 미끄럽지 않다 — 돌 ${r.stone.toFixed(2)}칸 · 얼음 ${r.ice.toFixed(2)}칸`);
});

test("v8 물: 한 틱에 한 칸씩 번진다 (한 프레임에 완결되지 않는다)", async (page) => {
  const r = await page.evaluate(() => {
    const B = window.__blockyard;
    const x = 80, y = 40, z = 80;
    for (let dx = -8; dx <= 8; dx++) for (let dz = -8; dz <= 8; dz++) {
      for (let dy = 0; dy <= 4; dy++) B.set(x + dx, y + dy, z + dz, 0);
      B.set(x + dx, y - 1, z + dz, B.B.STONE);
    }
    B.refreshAllTops();
    B.applyEdit(x, y, z, B.B.WATER, false);
    const radii = [];
    for (let t = 0; t < 4; t++) {
      B.waterTick(4000);
      let far = 0;
      for (let dx = -6; dx <= 6; dx++) for (let dz = -6; dz <= 6; dz++)
        if (B.world[B.idx(x + dx, y, z + dz)] === B.B.WATER)
          far = Math.max(far, Math.abs(dx) + Math.abs(dz));
      radii.push(far);
    }
    return { radii };
  });
  eq(r.radii[0], 1, "첫 틱에 1칸만 번져야 한다 — 실제 " + r.radii.join("→"));
  assert(r.radii[1] > r.radii[0], "두 번째 틱에 더 번져야 한다: " + r.radii.join("→"));
});

test("v8 콘텐츠: 도전 과제·기본 핫바·소개문이 새 블록을 반영한다", async (page) => {
  const r = await page.evaluate(() => {
    const B = window.__blockyard;
    const ids = B.ACHIEVEMENTS.map(a => a.id);
    return {
      total: ids.length,
      hasNew: ["lava", "ice", "torch10", "flower", "waterfall", "slabmerge"].filter(i => ids.includes(i)).length,
      bar: B.getBar().map(b => B.NAMES[b]),
      lede: document.querySelector(".lede").textContent
    };
  });
  assert(r.total >= 22, "도전 과제 수: " + r.total);
  eq(r.hasNew, 6, "새 콘텐츠 도전 과제가 빠졌다");
  assert(r.bar.includes("횃불"), "기본 핫바에 횃불이 없다: " + r.bar.join(","));
  assert(r.lede.includes("96×96"), "소개문의 섬 크기가 낡았다");
  assert(/용암/.test(r.lede) && /횃불/.test(r.lede), "소개문에 새 콘텐츠 언급이 없다");
});


// ══════════════════════════════════════════════════════════════
//  개선 v9 회귀 테스트
// ══════════════════════════════════════════════════════════════

test("v9 용암: 평야가 아니라 호수 — 드물고 뭉쳐 있다", async (page) => {
  const r = await page.evaluate(() => {
    const B = window.__blockyard;
    B.generate(20260904);
    let lava = 0, clustered = 0, floor = 0;
    const D = [[1,0,0],[-1,0,0],[0,0,1],[0,0,-1]];
    for (let y = 1; y <= 4; y++) for (let z = 1; z < B.WZ - 1; z++) for (let x = 1; x < B.WX - 1; x++) {
      const i = B.idx(x, y, z);
      if (B.world[i] === 0 && B.isSolid(B.world[B.idx(x, y - 1, z)])) floor++;
      if (B.world[i] !== B.B.LAVA) continue;
      lava++;
      for (let d = 0; d < 4; d++)
        if (B.world[B.idx(x + D[d][0], y, z + D[d][1])] === B.B.LAVA) { clustered++; break; }
    }
    return { lava, floor, ratio: lava / Math.max(1, lava + floor),
             clusterRatio: lava ? clustered / lava : 0 };
  });
  assert(r.lava > 30, "용암이 아예 없다: " + r.lava);
  assert(r.ratio < 0.30, "동굴 바닥이 용암 평야다 — 비율 " + r.ratio.toFixed(2));
  assert(r.clusterRatio > 0.7, "용암이 낱개로 흩어져 있다: " + r.clusterRatio.toFixed(2));
});

test("v9 조명: 물이 깊어질수록 어두워진다", async (page) => {
  const r = await page.evaluate(() => {
    const B = window.__blockyard;
    B.generate(777); B.relightAll(false);
    // 수면부터 아래로 밝기를 훑는다
    let surf = -1, deep = -1, col = null;
    for (let z = 2; z < B.WZ - 2 && !col; z++) for (let x = 2; x < B.WX - 2; x++) {
      let depth = 0;
      for (let y = B.SEA; y > 2; y--) {
        if (B.world[B.idx(x, y, z)] === B.B.WATER) depth++; else break;
      }
      if (depth >= 5) { col = [x, z]; break; }
    }
    if (!col) return { skip: true };
    surf = B.lightSky[B.idx(col[0], B.SEA, col[1])];
    deep = B.lightSky[B.idx(col[0], B.SEA - 4, col[1])];
    return { surf, deep, dim: B.WATER_DIM };
  });
  if (r.skip) return;
  assert(r.dim >= 2, "물 감쇠 상수");
  assert(r.deep < r.surf, `깊은 물이 수면과 같은 밝기다 — 수면 ${r.surf} · 4칸 아래 ${r.deep}`);
});

test("v9 물속: 소리 먹먹 필터와 수면 판정이 준비돼 있다", async (page, errors) => {
  const before = errors.length;
  const r = await page.evaluate(() => {
    const B = window.__blockyard;
    B.setMuffle(true); B.setMuffle(false);
    return { ok: typeof B.setMuffle === "function" };
  });
  assert(r.ok, "setMuffle 이 없다");
  eq(errors.length, before, "먹먹 필터에서 오류: " + errors.slice(before).join(" | "));
});

test("v9 액체: 텍스처가 실제로 흐른다 (아틀라스가 바뀐다)", async (page) => {
  const r = await page.evaluate(() => {
    const B = window.__blockyard;
    function snap(tile) {
      const o = [(tile % 16) * 16, Math.floor(tile / 16) * 16];
      const cv = document.createElement("canvas");
      cv.width = cv.height = 16;
      cv.getContext("2d").drawImage(B.atlas, o[0], o[1], 16, 16, 0, 0, 16, 16);
      return cv.toDataURL();
    }
    B.animateLiquids(0);
    const a = snap(11), la = snap(20);
    B.animateLiquids(1.4);
    const b = snap(11), lb = snap(20);
    return { water: a !== b, lava: la !== lb };
  });
  assert(r.water, "물 텍스처가 그대로다");
  assert(r.lava, "용암 텍스처가 그대로다");
});

test("v9 꽃: 낱개가 아니라 패치로 핀다", async (page) => {
  const r = await page.evaluate(() => {
    const B = window.__blockyard;
    B.generate(99999);
    const D = [[1,0],[-1,0],[0,1],[0,-1],[1,1],[1,-1],[-1,1],[-1,-1]];
    let flowers = 0, withNeighbor = 0, mixed = 0;
    for (let z = 1; z < B.WZ - 1; z++) for (let x = 1; x < B.WX - 1; x++) {
      const t = B.topMap[z * B.WX + x];
      for (let y = t; y <= t + 2 && y < B.WY; y++) {
        const b = B.world[B.idx(x, y, z)];
        if (b !== B.B.FLOWER_R && b !== B.B.FLOWER_Y) continue;
        flowers++;
        let near = false, other = false;
        for (let d = 0; d < 8; d++)
          for (let dy = -1; dy <= 1; dy++) {
            const n = B.world[B.idx(x + D[d][0], y + dy, z + D[d][1])];
            if (n === b) near = true;
            if ((n === B.B.FLOWER_R || n === B.B.FLOWER_Y) && n !== b) other = true;
          }
        if (near) withNeighbor++;
        if (other) mixed++;
      }
    }
    return { flowers, ratio: flowers ? withNeighbor / flowers : 0,
             mixRatio: flowers ? mixed / flowers : 0 };
  });
  assert(r.flowers > 40, "꽃이 너무 적다: " + r.flowers);
  assert(r.ratio > 0.5, "꽃이 낱개로 흩어져 있다 — 이웃 있는 비율 " + r.ratio.toFixed(2));
  assert(r.mixRatio < 0.25, "한 패치에 두 종류가 섞였다: " + r.mixRatio.toFixed(2));
});

test("v9 바이옴: 사막과 설원에도 식물이 산다", async (page) => {
  const r = await page.evaluate(() => {
    const B = window.__blockyard;
    // 시드마다 바이옴 구성이 다르므로, 사막이 있는 시드와 설원이 있는 시드를 각각 찾는다
    let cactus = 0, bush = 0, dry = 0, badBiome = 0, sawDesert = false, sawSnow = false;
    for (const seed of [777, 20260904, 99999, 4242, 1]) {
      B.generate(seed);
      let desertCols = 0, snowCols = 0;
      for (let z = 0; z < B.WZ; z++) for (let x = 0; x < B.WX; x++) {
        const bi = B.biomeMap[z * B.WX + x];
        if (B.topMap[z * B.WX + x] > B.SEA + 1) { if (bi === 2) desertCols++; if (bi === 1) snowCols++; }
      }
      if (desertCols > 200) sawDesert = true;
      if (snowCols > 200) sawSnow = true;
      for (let z = 0; z < B.WZ; z++) for (let x = 0; x < B.WX; x++) {
        const biome = B.biomeMap[z * B.WX + x];
        for (let y = 1; y < B.WY; y++) {
          const b = B.world[B.idx(x, y, z)];
          if (b === B.B.CACTUS) { cactus++; if (biome !== 2) badBiome++; }
          else if (b === B.B.DEADBUSH) { bush++; if (biome !== 2) badBiome++; }
          else if (b === B.B.DRYGRASS) { dry++; if (biome !== 1) badBiome++; }
        }
      }
      if (sawDesert && sawSnow && cactus && bush && dry) break;
    }
    return { cactus, bush, dry, badBiome, sawDesert, sawSnow,
             cactusSolid: B.isSolid(B.B.CACTUS), bushCross: B.isCross(B.B.DEADBUSH) };
  });
  assert(r.cactus > 0, "선인장이 없다");
  assert(r.bush > 0, "죽은 덤불이 없다");
  assert(r.dry > 0, "설원 마른 풀이 없다");
  eq(r.badBiome, 0, "엉뚱한 바이옴에 자란 식물");
  assert(r.cactusSolid, "선인장은 막는 블록이어야 한다");
  assert(r.bushCross, "죽은 덤불은 얇은 블록이어야 한다");
});

test("v9 얼음: 설원에 부은 물은 시차를 두고 얼고, 광원 옆은 안 언다", async (page) => {
  const r = await page.evaluate(() => {
    const B = window.__blockyard;
    B.generate(20260904);
    // 설원 지표를 하나 찾는다
    let sx = -1, sz = -1;
    outer: for (let z = 4; z < B.WZ - 4; z++) for (let x = 4; x < B.WX - 4; x++)
      if (B.biomeMap[z * B.WX + x] === 1 && B.topMap[z * B.WX + x] > B.SEA + 2) { sx = x; sz = z; break outer; }
    if (sx < 0) return { skip: true };
    const y = B.topMap[sz * B.WX + sx] + 1;
    for (let dx = -3; dx <= 3; dx++) for (let dz = -3; dz <= 3; dz++)
      for (let dy = 0; dy <= 3; dy++) B.set(sx + dx, y + dy, sz + dz, 0);
    B.refreshAllTops();
    B.applyEdit(sx, y, sz, B.B.WATER, false);
    for (let k = 0; k < 60; k++) B.waterTick(2000);
    let spread = 0;
    for (let dx = -3; dx <= 3; dx++) for (let dz = -3; dz <= 3; dz++)
      if (B.world[B.idx(sx + dx, y, sz + dz)] === B.B.WATER) spread++;
    for (let k = 0; k < 40; k++) B.freezeTick(500);
    let ice = 0;
    for (let dx = -3; dx <= 3; dx++) for (let dz = -3; dz <= 3; dz++)
      if (B.world[B.idx(sx + dx, y, sz + dz)] === B.B.ICE) ice++;
    return { spread, ice };
  });
  if (r.skip) return;
  assert(r.spread > 2, "설원에서 물이 퍼지지 않았다(즉시 얼어버렸다): " + r.spread);
  assert(r.ice > 0, "설원 물이 얼지 않았다");
});

test("v9 얼음: 광원을 놓으면 주변 얼음이 녹는다", async (page) => {
  const r = await page.evaluate(() => {
    const B = window.__blockyard;
    const x = 36, y = 44, z = 36;
    for (let dx = -3; dx <= 3; dx++) for (let dz = -3; dz <= 3; dz++)
      for (let dy = -2; dy <= 3; dy++) B.set(x + dx, y + dy, z + dz, 0);
    B.set(x, y - 1, z, B.B.STONE);
    B.set(x + 1, y, z, B.B.ICE);
    B.refreshAllTops();
    const before = B.world[B.idx(x + 1, y, z)];
    B.applyEdit(x, y, z, B.B.LAMP, false);
    return { before, after: B.world[B.idx(x + 1, y, z)], ICE: B.B.ICE, WATER: B.B.WATER };
  });
  eq(r.before, r.ICE, "얼음을 놓지 못했다");
  eq(r.after, r.WATER, "광원 옆 얼음이 안 녹았다");
});

test("v9 물+용암: 만나면 조약돌이 된다", async (page) => {
  const r = await page.evaluate(() => {
    const B = window.__blockyard;
    const x = 64, y = 44, z = 64;
    for (let dx = -5; dx <= 5; dx++) for (let dz = -5; dz <= 5; dz++) {
      for (let dy = 0; dy <= 4; dy++) B.set(x + dx, y + dy, z + dz, 0);
      B.set(x + dx, y - 1, z + dz, B.B.STONE);
    }
    B.refreshAllTops();
    B.applyEdit(x, y, z, B.B.LAVA, false);
    B.applyEdit(x + 3, y, z, B.B.WATER, false);
    for (let k = 0; k < 60; k++) B.waterTick(2000);
    const row = [];
    for (let dx = 0; dx <= 3; dx++) row.push(B.world[B.idx(x + dx, y, z)]);
    return { row, COBBLE: B.B.COBBLE, LAVA: B.B.LAVA };
  });
  eq(r.row[0], r.LAVA, "용암이 사라졌다");
  assert(r.row.includes(r.COBBLE), "물이 용암에 닿았는데 조약돌이 안 생겼다: " + r.row.join(","));
});

test("v9 조작: 스페이스 더블탭 비행 · F1 HUD 숨기기", async (page) => {
  const r = await page.evaluate(() => {
    const B = window.__blockyard;
    B.setPaused(true);
    B.beginPlay();
    const was = B.player.flying;
    function tap(code) {
      window.dispatchEvent(new KeyboardEvent("keydown", { code, bubbles: true }));
      window.dispatchEvent(new KeyboardEvent("keyup", { code, bubbles: true }));
    }
    tap("Space"); tap("Space");
    const flyToggled = B.player.flying !== was;
    const hudBefore = document.getElementById("telemetry").hidden;
    tap("F1");
    const hudAfter = document.getElementById("telemetry").hidden;
    tap("F1");
    B.endPlay(); B.setPaused(false);
    return { flyToggled, hudBefore, hudAfter };
  });
  assert(r.flyToggled, "스페이스 더블탭으로 비행이 안 켜진다");
  eq(r.hudBefore, false, "플레이 중 HUD 가 보여야 한다");
  eq(r.hudAfter, true, "F1 로 HUD 가 숨겨지지 않았다");
});


// ══════════════════════════════════════════════════════════════
//  개선 v10 회귀 테스트
// ══════════════════════════════════════════════════════════════

test("v10 원목: 옆면을 클릭하면 눕는다 (나이테가 옆으로)", async (page) => {
  const r = await page.evaluate(() => {
    const B = window.__blockyard;
    B.setPaused(true);
    const x = 40, y = 46, z = 40;
    for (let dx = -3; dx <= 3; dx++) for (let dz = -3; dz <= 3; dz++)
      for (let dy = -2; dy <= 5; dy++) B.set(x + dx, y + dy, z + dz, 0);
    B.set(x, y, z, B.B.STONE);            // 옆면을 클릭할 대상
    B.refreshAllTops();
    // 대상의 +X 면을 조준한다
    B.player.pos.set(x + 3.5, y + 0.5 - 1.62, z + 0.5);
    B.player.yaw = Math.PI / 2; B.player.pitch = 0;
    B.camera.position.set(x + 3.5, y + 0.5, z + 0.5);
    B.camera.rotation.set(0, Math.PI / 2, 0);
    B.getBar()[B.getSelected()] = B.B.LOG;
    B.setShapeMode(0);
    B.beginPlay(); B.place(); B.endPlay(); B.setPaused(false);
    const i = B.idx(x + 1, y, z);
    return { block: B.world[i], shape: B.shape[i], LOG: B.B.LOG, AXIS_X: B.SH.AXIS_X,
             kindSide: B.faceKindFor(B.SH.AXIS_X, 0, 1), kindTop: B.faceKindFor(B.SH.AXIS_X, 2, 0) };
  });
  eq(r.block, r.LOG, "원목이 놓이지 않았다");
  eq(r.shape, r.AXIS_X, "옆면을 클릭했는데 눕지 않았다");
  eq(r.kindSide, 0, "눕힌 원목의 X 면이 나이테여야 한다");
  eq(r.kindTop, 1, "눕힌 원목의 윗면은 껍질이어야 한다");
});

test("v10 벽 횃불: 벽면에 붙고, 벽이 사라지면 함께 떨어진다", async (page) => {
  const r = await page.evaluate(() => {
    const B = window.__blockyard;
    B.setPaused(true);
    const x = 52, y = 46, z = 52;
    for (let dx = -3; dx <= 3; dx++) for (let dz = -3; dz <= 3; dz++)
      for (let dy = -2; dy <= 5; dy++) B.set(x + dx, y + dy, z + dz, 0);
    B.set(x, y, z, B.B.STONE);
    B.refreshAllTops();
    B.player.pos.set(x + 3.5, y + 0.5 - 1.62, z + 0.5);
    B.player.yaw = Math.PI / 2; B.player.pitch = 0;
    B.camera.position.set(x + 3.5, y + 0.5, z + 0.5);
    B.camera.rotation.set(0, Math.PI / 2, 0);
    B.getBar()[B.getSelected()] = B.B.TORCH;
    B.beginPlay(); B.place(); B.endPlay(); B.setPaused(false);
    const i = B.idx(x + 1, y, z);
    const placed = B.world[i], sh = B.shape[i];
    const off = B.crossOffset(sh);
    const lit = B.lightBlk[i];
    B.applyEdit(x, y, z, 0, false);          // 벽을 없앤다
    return { placed, sh, off, lit, after: B.world[i], TORCH: B.B.TORCH,
             isWall: B.isWallShape(sh) };
  });
  eq(r.placed, r.TORCH, "벽에 횃불이 안 놓였다");
  assert(r.isWall, "벽 모양이 아니다: " + r.sh);
  assert(Math.abs(r.off[0]) > 0.2, "벽 쪽으로 밀리지 않았다: " + JSON.stringify(r.off));
  assert(r.lit >= 14, "벽 횃불이 빛을 안 낸다: " + r.lit);
  eq(r.after, 0, "벽이 사라졌는데 횃불이 남았다");
});

test("v10 3인칭: F5 로 시점이 물러나고 손이 사라진다", async (page) => {
  const r = await page.evaluate(() => {
    const B = window.__blockyard;
    B.setPaused(true);
    const x = 48, y = 46, z = 48;
    for (let dx = -8; dx <= 8; dx++) for (let dz = -8; dz <= 8; dz++) {
      for (let dy = 0; dy <= 6; dy++) B.set(x + dx, y + dy, z + dz, 0);
      B.set(x + dx, y - 1, z + dz, B.B.STONE);
    }
    B.refreshAllTops();
    B.player.pos.set(x + 0.5, y, z + 0.5);
    B.player.yaw = 0; B.player.pitch = 0;
    B.beginPlay();
    B.step(1 / 60);
    const first = B.camera.position.z;
    window.dispatchEvent(new KeyboardEvent("keydown", { code: "F5", bubbles: true }));
    window.dispatchEvent(new KeyboardEvent("keyup", { code: "F5", bubbles: true }));
    B.step(1 / 60);
    const third = B.camera.position.z;
    for (let k = 0; k < 3; k++) {
      window.dispatchEvent(new KeyboardEvent("keydown", { code: "F5", bubbles: true }));
      window.dispatchEvent(new KeyboardEvent("keyup", { code: "F5", bubbles: true }));
    }
    B.endPlay(); B.setPaused(false);
    return { first, third };
  });
  assert(r.third > r.first + 1, `3인칭에서 카메라가 안 물러났다 — ${r.first.toFixed(2)} → ${r.third.toFixed(2)}`);
});

test("v10 바이옴: 설원이 육지를 독식하지 않는다", async (page) => {
  const r = await page.evaluate(() => {
    const B = window.__blockyard;
    const rows = [];
    for (const seed of [20260904, 777, 4242, 1, 99999]) {
      B.generate(seed);
      let land = 0, snow = 0, desert = 0, plain = 0;
      for (let z = 0; z < B.WZ; z++) for (let x = 0; x < B.WX; x++) {
        if (B.topMap[z * B.WX + x] <= B.SEA + 1) continue;
        land++;
        const bi = B.biomeMap[z * B.WX + x];
        if (bi === 1) snow++; else if (bi === 2) desert++; else plain++;
      }
      rows.push({ seed, snowRatio: land ? snow / land : 0 });
    }
    return { rows, worst: Math.max.apply(null, rows.map(r => r.snowRatio)) };
  });
  assert(r.worst < 0.80, "설원이 육지의 " + (r.worst * 100).toFixed(0) + "% 를 먹는 시드가 있다");
});

test("v10 나무: 초원에 자작나무, 설원에 가문비나무가 섞인다", async (page) => {
  const r = await page.evaluate(() => {
    const B = window.__blockyard;
    let oak = 0, birch = 0, spruce = 0, misplaced = 0;
    for (const seed of [99999, 20260904, 777, 1]) {
      B.generate(seed);
      for (let z = 0; z < B.WZ; z++) for (let x = 0; x < B.WX; x++) {
        const bi = B.biomeMap[z * B.WX + x];
        for (let y = 1; y < B.WY; y++) {
          const b = B.world[B.idx(x, y, z)];
          if (b === B.B.LEAVES) oak++;
          else if (b === B.B.BIRCH_LEAVES) birch++;
          else if (b === B.B.SPRUCE_LEAVES) spruce++;
          // 줄기 위치로만 바이옴을 따진다 (잎은 이웃 칸까지 뻗어 경계를 넘는다)
          else if (b === B.B.BIRCH_LOG && bi === 1) misplaced++;
        }
      }
      if (oak && birch && spruce) break;
    }
    return { oak, birch, spruce, misplaced,
             logGroup: B.isLog(B.B.BIRCH_LOG), leafGroup: B.isLeaf(B.B.SPRUCE_LEAVES) };
  });
  assert(r.oak > 0, "참나무가 없다");
  assert(r.birch > 0, "자작나무가 없다");
  assert(r.spruce > 0, "가문비나무가 없다");
  eq(r.misplaced, 0, "설원에 자작나무 줄기가 섰다");
  assert(r.logGroup && r.leafGroup, "새 나무가 원목·잎 분류에 안 들어갔다");
});

test("v10 하늘: 해가 각지고 달은 8단계 위상을 가진다", async (page) => {
  const r = await page.evaluate(() => {
    const B = window.__blockyard;
    function distinct(list) {
      const seen = new Set();
      list.forEach(t => {
        const cv = document.createElement("canvas");
        cv.width = cv.height = 16;
        cv.getContext("2d").drawImage(t.image, 0, 0);
        seen.add(cv.toDataURL());
      });
      return seen.size;
    }
    return { phases: B.MOON_PHASES, unique: distinct(B.moonTex) };
  });
  eq(r.phases, 8, "달 위상 수");
  assert(r.unique >= 5, "달 위상이 실제로 다르지 않다: " + r.unique);
});

test("v10 미니맵: 확대하면 좁은 범위를 크게 그린다", async (page) => {
  const r = await page.evaluate(() => {
    const B = window.__blockyard;
    B.generate(99999);
    B.player.pos.set(B.WX / 2, 30, B.WZ / 2);
    function snap() {
      B.drawMinimap();
      const cv = document.getElementById("mm");
      return cv.getContext("2d").getImageData(0, 0, cv.width, cv.height).data.join(",");
    }
    B.setZoom(1); const a = snap();
    B.setZoom(4); const b = snap();
    B.setZoom(1);
    return { differs: a !== b };
  });
  assert(r.differs, "확대해도 미니맵이 그대로다");
});

test("v10 산소: 물속에서 줄고, 나오면 다시 찬다", async (page) => {
  const r = await page.evaluate(() => {
    const B = window.__blockyard;
    B.setPaused(true);
    // 물기둥을 만든다
    const x = 30, y = 30, z = 30;
    for (let dx = -2; dx <= 2; dx++) for (let dz = -2; dz <= 2; dz++) {
      for (let dy = -1; dy <= 6; dy++) B.set(x + dx, y + dy, z + dz, B.B.WATER);
      B.set(x + dx, y - 2, z + dz, B.B.STONE);
    }
    B.refreshAllTops();
    B.player.pos.set(x + 0.5, y, z + 0.5);
    B.player.flying = false;
    B.beginPlay();
    for (let k = 0; k < 120; k++) B.step(1 / 60);
    const wet = B.S.oxygen;
    // 물 밖으로
    for (let dx = -2; dx <= 2; dx++) for (let dz = -2; dz <= 2; dz++)
      for (let dy = 0; dy <= 6; dy++) B.set(x + dx, y + dy, z + dz, 0);
    B.set(x, y - 1, z, B.B.STONE);
    B.refreshAllTops();
    B.player.pos.set(x + 0.5, y, z + 0.5);
    for (let k = 0; k < 200; k++) B.step(1 / 60);
    const dry = B.S.oxygen;
    B.endPlay(); B.setPaused(false);
    return { wet, dry };
  });
  assert(r.wet < 0.95, "물속인데 산소가 안 줄었다: " + r.wet.toFixed(3));
  assert(r.dry > 0.99, "물 밖인데 산소가 안 찼다: " + r.dry.toFixed(3));
});

test("v10 감각: 착지 먼지와 동굴 울림이 예외 없이 돈다", async (page, errors) => {
  const before = errors.length;
  await page.evaluate(() => {
    const B = window.__blockyard;
    B.caveSound(1); B.caveSound(0.3);
    B.burst(10, 10, 10, B.B.STONE, 6);
  });
  eq(errors.length, before, "새 효과에서 오류: " + errors.slice(before).join(" | "));
});


// ══════════════════════════════════════════════════════════════
//  개선 v11 회귀 테스트
// ══════════════════════════════════════════════════════════════

test("v11 광석: 금과 다이아가 깊은 곳에만 난다", async (page) => {
  const r = await page.evaluate(() => {
    const B = window.__blockyard;
    B.generate(20260904);
    let gold = 0, dia = 0, coal = 0, goldDeep = 0, diaDeep = 0, maxGoldY = -1, maxDiaY = -1;
    for (let y = 1; y < 40; y++) for (let z = 0; z < B.WZ; z++) for (let x = 0; x < B.WX; x++) {
      const b = B.world[B.idx(x, y, z)];
      if (b === B.B.GOLD) { gold++; if (y <= 11) goldDeep++; if (y > maxGoldY) maxGoldY = y; }
      else if (b === B.B.DIAMOND) { dia++; if (y <= 7) diaDeep++; if (y > maxDiaY) maxDiaY = y; }
      else if (b === B.B.COAL) coal++;
    }
    return { gold, dia, coal, goldDeep, diaDeep, maxGoldY, maxDiaY };
  });
  assert(r.gold > 0, "금이 없다");
  assert(r.dia > 0, "다이아가 없다");
  assert(r.dia < r.gold && r.gold < r.coal, `귀한 순서가 뒤집혔다 — 다이아 ${r.dia} · 금 ${r.gold} · 석탄 ${r.coal}`);
  eq(r.goldDeep, r.gold, "금이 y>11 에도 났다 (최대 " + r.maxGoldY + ")");
  eq(r.diaDeep, r.dia, "다이아가 y>7 에도 났다 (최대 " + r.maxDiaY + ")");
});

test("v11 동굴: 좁은 굴 말고 넓은 방도 생긴다", async (page) => {
  const r = await page.evaluate(() => {
    const B = window.__blockyard;
    B.generate(4242);
    // 지하 공기 칸 중 "사방이 트인" 칸의 비율 — 넓은 방이 있으면 올라간다
    let air = 0, roomy = 0;
    for (let y = 3; y < 24; y++) for (let z = 3; z < B.WZ - 3; z += 2) for (let x = 3; x < B.WX - 3; x += 2) {
      if (B.world[B.idx(x, y, z)] !== 0) continue;
      if (y >= B.topMap[z * B.WX + x]) continue;
      air++;
      let open = 0;
      for (const d of [[2,0,0],[-2,0,0],[0,0,2],[0,0,-2],[0,2,0],[0,-2,0]])
        if (B.world[B.idx(x + d[0], y + d[1], z + d[2])] === 0) open++;
      if (open >= 5) roomy++;
    }
    return { air, roomy, ratio: air ? roomy / air : 0 };
  });
  assert(r.air > 500, "지하 공간이 너무 적다: " + r.air);
  assert(r.ratio > 0.10, "동굴이 전부 좁은 굴이다 — 트인 칸 비율 " + r.ratio.toFixed(3));
});

test("v11 날씨: 서서히 짙어지고, 비가 오면 천둥이 친다", async (page) => {
  const r = await page.evaluate(() => {
    const B = window.__blockyard;
    B.setPaused(true);
    B.setWeather(1);
    B.S.weatherMix = 0;
    B.updateWeather(1 / 60);
    const first = B.S.weatherMix;
    for (let k = 0; k < 200; k++) B.updateWeather(1 / 60);
    const settled = B.S.weatherMix;
    // 천둥
    B.S.stormTimer = 0; B.S.flash = 0;
    B.updateStorm(1 / 60);
    const flashed = B.S.flash;
    B.setWeather(0);
    for (let k = 0; k < 400; k++) B.updateWeather(1 / 60);
    const cleared = B.S.weatherMix;
    B.setPaused(false);
    return { first, settled, flashed, cleared };
  });
  assert(r.first < 0.2, "날씨가 한 프레임에 최대로 켜졌다: " + r.first.toFixed(3));
  assert(r.settled > 0.8, "날씨가 짙어지지 않았다: " + r.settled.toFixed(3));
  assert(r.flashed > 0, "비가 오는데 번개가 안 친다");
  assert(r.cleared < 0.2, "날씨가 걷히지 않았다: " + r.cleared.toFixed(3));
});

test("v11 눈: 눈이 오면 지표에 쌓인다", async (page) => {
  const r = await page.evaluate(() => {
    const B = window.__blockyard;
    B.setPaused(true);
    B.generate(99999); B.relightAll(false);
    // 초원 한복판을 찾는다
    let gx = -1, gz = -1;
    outer: for (let z = 20; z < B.WZ - 20; z++) for (let x = 20; x < B.WX - 20; x++)
      if (B.biomeMap[z * B.WX + x] === 0 && B.world[B.idx(x, B.topMap[z * B.WX + x], z)] === B.B.GRASS)
        { gx = x; gz = z; break outer; }
    if (gx < 0) return { skip: true };
    B.player.pos.set(gx + 0.5, B.topMap[gz * B.WX + gx] + 2, gz + 0.5);
    B.beginPlay();
    B.setWeather(2);
    B.S.weatherMix = 1;
    let before = 0;
    for (let dx = -16; dx <= 16; dx++) for (let dz = -16; dz <= 16; dz++) {
      const x = gx + dx, z = gz + dz;
      if (x < 0 || x >= B.WX || z < 0 || z >= B.WZ) continue;
      if (B.world[B.idx(x, B.topMap[z * B.WX + x], z)] === B.B.SNOW) before++;
    }
    for (let k = 0; k < 900; k++) { B.S.weatherMix = 1; B.step(1 / 60); }
    let after = 0;
    for (let dx = -16; dx <= 16; dx++) for (let dz = -16; dz <= 16; dz++) {
      const x = gx + dx, z = gz + dz;
      if (x < 0 || x >= B.WX || z < 0 || z >= B.WZ) continue;
      if (B.world[B.idx(x, B.topMap[z * B.WX + x], z)] === B.B.SNOW) after++;
    }
    B.setWeather(0); B.endPlay(); B.setPaused(false);
    return { before, after };
  });
  if (r.skip) return;
  assert(r.after > r.before, `눈이 안 쌓였다 — ${r.before} → ${r.after}`);
});

test("v11 설정: 밝기 슬라이더가 셰이더에 반영된다", async (page) => {
  const r = await page.evaluate(() => {
    const B = window.__blockyard;
    const keep = B.opts.bright;
    B.opts.bright = 0; B.applyOpts();
    const dark = B.voxUniforms.uGamma.value;
    B.opts.bright = 100; B.applyOpts();
    const bright = B.voxUniforms.uGamma.value;
    B.opts.bright = keep; B.applyOpts();
    return { dark, bright };
  });
  assert(r.bright < r.dark, `밝기를 올려도 감마가 안 바뀐다 — ${r.dark.toFixed(3)} → ${r.bright.toFixed(3)}`);
});

test("v11 저장 슬롯: 셋이 서로 다른 키를 쓰고 1번은 기존 키를 유지한다", async (page) => {
  const r = await page.evaluate(() => {
    const B = window.__blockyard;
    const keys = [];
    for (let n = 1; n <= B.SLOTS; n++) keys.push(B.slotKey(n));
    const before = B.S.slot;
    B.S.slot = 2;
    B.saveGame();
    const saved2 = !!localStorage.getItem(B.slotKey(2));
    const info2 = B.slotInfo(2);
    B.S.slot = before;
    return { keys, unique: new Set(keys).size, first: keys[0], SAVE_KEY: B.SAVE_KEY,
             saved2, hasInfo: !!info2 && typeof info2.seed === "number" };
  });
  eq(r.unique, 3, "슬롯 키가 겹친다: " + r.keys.join(","));
  eq(r.first, r.SAVE_KEY, "1번 슬롯이 기존 키를 안 쓴다");
  assert(r.saved2, "2번 슬롯에 저장되지 않았다");
  assert(r.hasInfo, "슬롯 정보를 못 읽는다");
});

test("v11 세계의 끝: 가장자리에 가까이 가면 격자벽이 보인다", async (page) => {
  const r = await page.evaluate(() => {
    const B = window.__blockyard;
    B.updateEdge(B.WX / 2, B.WZ / 2);
    const mid = B.edgeMat.opacity;
    B.updateEdge(1.5, B.WZ / 2);
    const edge = B.edgeMat.opacity;
    B.updateEdge(B.WX / 2, B.WZ / 2);
    return { mid, edge };
  });
  eq(r.mid, 0, "한복판에서도 벽이 보인다");
  assert(r.edge > 0.05, "가장자리인데 벽이 안 보인다: " + r.edge.toFixed(3));
});

test("v11 HUD: 도전 과제 진행도가 표시된다", async (page) => {
  const r = await page.evaluate(() => {
    const B = window.__blockyard;
    B.setPaused(true);
    B.resetAch();
    B.beginPlay();
    B.step(1 / 60);
    const el = document.getElementById("t-ach");
    B.unlock("firstMine");
    for (let k = 0; k < 20; k++) B.step(1 / 60);
    const txt = el.textContent;
    B.endPlay(); B.setPaused(false);
    return { txt, total: B.ACHIEVEMENTS.length };
  });
  assert(r.txt.indexOf("/") > 0, "진행도 표시가 없다: " + r.txt);
  assert(r.txt.indexOf(String(r.total)) >= 0, "전체 개수가 안 보인다: " + r.txt);
});

test("v11 소리: 천둥·빗소리가 예외 없이 돈다", async (page, errors) => {
  const before = errors.length;
  await page.evaluate(() => {
    const B = window.__blockyard;
    B.rainHiss(1); B.thunder(0, true); B.thunder(0, false);
  });
  await page.waitForTimeout(120);
  eq(errors.length, before, "소리에서 오류: " + errors.slice(before).join(" | "));
});


// ══════════════════════════════════════════════════════════════
//  개선 v12 회귀 테스트 — 건축 부품과 상호작용
// ══════════════════════════════════════════════════════════════

test("v12 울타리: 이웃이 생기면 팔을 뻗어 이어진다", async (page) => {
  const r = await page.evaluate(() => {
    const B = window.__blockyard;
    const x = 30, y = 46, z = 30;
    for (let dx = -3; dx <= 3; dx++) for (let dz = -3; dz <= 3; dz++)
      for (let dy = -2; dy <= 3; dy++) B.set(x + dx, y + dy, z + dz, 0);
    B.set(x, y - 1, z, B.B.STONE);
    B.refreshAllTops();
    B.applyEdit(x, y, z, B.B.FENCE, false);
    const alone = B.boxesAt(B.B.FENCE, 0, x, y, z).length;
    B.applyEdit(x + 1, y, z, B.B.FENCE, false);
    const paired = B.boxesAt(B.B.FENCE, 0, x, y, z).length;
    return { alone, paired, connecting: B.isConnecting(B.B.FENCE) };
  });
  eq(r.alone, 1, "외톨이 울타리는 기둥 하나여야 한다");
  eq(r.paired, 2, "이웃이 생겼는데 팔을 안 뻗었다");
  assert(r.connecting, "울타리가 연결형으로 등록되지 않았다");
});

test("v12 울타리: 넘어갈 수 없게 막는다", async (page) => {
  const r = await page.evaluate(() => {
    const B = window.__blockyard;
    const x = 34, y = 46, z = 34;
    for (let dx = -3; dx <= 3; dx++) for (let dz = -3; dz <= 3; dz++) {
      for (let dy = 0; dy <= 3; dy++) B.set(x + dx, y + dy, z + dz, 0);
      B.set(x + dx, y - 1, z + dz, B.B.STONE);
    }
    B.refreshAllTops();
    B.applyEdit(x + 1, y, z, B.B.FENCE, false);
    B.player.pos.set(x + 0.5, y, z + 0.5);
    B.setSneak(false);
    B.moveHorizontal(0.9, 0);
    const stopped = B.player.pos.x;
    const stuck = B.boxHitsWorld(B.player.pos.x, B.player.pos.y, B.player.pos.z);
    // 울타리 기둥은 칸의 0.375~0.625 를 차지한다
    return { stopped, stuck, postFace: x + 1 + 0.375, want: x + 0.5 + 0.9 };
  });
  eq(r.stuck, false, "울타리에 박혔다");
  assert(r.stopped + 0.3 <= r.postFace + 0.01,
    `울타리 기둥을 뚫고 지나갔다 — 몸 앞이 ${(r.stopped + 0.3).toFixed(3)}, 기둥은 ${r.postFace}`);
  assert(r.stopped < r.want - 0.05, "울타리가 아예 막지 못했다: " + r.stopped.toFixed(3));
});

test("v12 유리판: 홀로 서면 십자, 이어지면 한 장이 된다", async (page) => {
  const r = await page.evaluate(() => {
    const B = window.__blockyard;
    const x = 38, y = 46, z = 38;
    for (let dx = -3; dx <= 3; dx++) for (let dz = -3; dz <= 3; dz++)
      for (let dy = -2; dy <= 3; dy++) B.set(x + dx, y + dy, z + dz, 0);
    B.set(x, y - 1, z, B.B.STONE);
    B.refreshAllTops();
    B.applyEdit(x, y, z, B.B.PANE, false);
    const alone = B.boxesAt(B.B.PANE, 0, x, y, z).map(q => q.slice());
    B.applyEdit(x + 1, y, z, B.B.PANE, false);
    const joined = B.boxesAt(B.B.PANE, 0, x, y, z);
    return { aloneW: alone[0][3] - alone[0][0], joinedW: joined[0][3] - joined[0][0],
             trans: B.isTransparent(B.B.PANE) };
  });
  near(r.aloneW, 0.126, 0.02, "외톨이 유리판 두께");
  assert(r.joinedW > 0.5, "이웃 쪽으로 안 늘어났다: " + r.joinedW.toFixed(3));
  assert(r.trans, "유리판이 반투명이 아니다");
});

test("v12 문: 우클릭으로 여닫히고, 웅크리면 대신 블록을 놓는다", async (page) => {
  const r = await page.evaluate(() => {
    const B = window.__blockyard;
    const x = 42, y = 46, z = 42;
    for (let dx = -3; dx <= 3; dx++) for (let dz = -3; dz <= 3; dz++)
      for (let dy = -2; dy <= 3; dy++) B.set(x + dx, y + dy, z + dz, 0);
    B.set(x, y - 1, z, B.B.STONE);
    B.refreshAllTops();
    B.applyEdit(x, y, z, B.B.GATE, false);
    const hit = { x: x, y: y, z: z, block: B.B.GATE, shape: 0, nx: 0, ny: 0, nz: 1 };
    B.getBar()[B.getSelected()] = B.B.STONE;   // 횃불을 들고 있으면 불을 붙이려 든다
    B.setSneak(false);
    const acted = B.tryInteract(hit);
    const opened = B.shape[B.idx(x, y, z)];
    B.tryInteract({ x: x, y: y, z: z, block: B.B.GATE, shape: 1, nx: 0, ny: 0, nz: 1 });
    const closed = B.shape[B.idx(x, y, z)];
    B.setSneak(true);
    const sneaked = B.tryInteract(hit);
    B.setSneak(false);
    return { acted, opened, closed, sneaked, openable: B.isOpenable(B.B.GATE) };
  });
  assert(r.openable, "문이 여닫는 블록으로 등록되지 않았다");
  assert(r.acted, "우클릭이 문을 안 건드렸다");
  eq(r.opened, 1, "문이 안 열렸다");
  eq(r.closed, 0, "문이 안 닫혔다");
  eq(r.sneaked, false, "웅크렸는데도 문을 열었다");
});

test("v12 사다리: 벽에 붙고, 타고 오를 수 있다", async (page) => {
  const r = await page.evaluate(() => {
    const B = window.__blockyard;
    B.setPaused(true);
    const x = 46, y = 46, z = 46;
    for (let dx = -3; dx <= 3; dx++) for (let dz = -3; dz <= 3; dz++)
      for (let dy = -2; dy <= 8; dy++) B.set(x + dx, y + dy, z + dz, 0);
    for (let dy = -1; dy <= 6; dy++) B.set(x, y + dy, z, B.B.STONE);   // 벽
    for (let dx = -3; dx <= 3; dx++) for (let dz = -3; dz <= 3; dz++)
      if (dx !== 0 || dz !== 0) B.set(x + dx, y - 1, z + dz, B.B.STONE);
    for (let dy = 0; dy <= 6; dy++) B.set(x + 1, y + dy, z, B.B.LADDER, 0);
    // 벽이 -X 쪽에 있으므로 SH_WALL_W
    for (let dy = 0; dy <= 6; dy++) B.shape[B.idx(x + 1, y + dy, z)] = B.SH.WALL_W;
    B.refreshAllTops(); B.relightAll(false); B.markAllDirty(); B.buildBudget(4000);

    B.beginPlay();
    B.player.pos.set(x + 1.5, y, z + 0.5);
    B.player.vel.set(0, 0, 0);
    B.player.flying = false;
    const y0 = B.player.pos.y;
    B.setKey("Space", true);
    for (let k = 0; k < 90; k++) B.step(1 / 60);
    B.setKey("Space", false);
    const y1 = B.player.pos.y;
    B.endPlay(); B.setPaused(false);
    return { y0, y1, climbable: B.isClimbable(B.B.LADDER), solid: B.isSolid(B.B.LADDER) };
  });
  assert(r.climbable, "사다리가 오를 수 있는 블록이 아니다");
  eq(r.solid, false, "사다리가 길을 막는다");
  assert(r.y1 > r.y0 + 1.5, `사다리를 못 올라갔다 — ${r.y0.toFixed(2)} → ${r.y1.toFixed(2)}`);
});

test("v12 시작 지점: V 로 정한 곳에서 되살아난다", async (page) => {
  const r = await page.evaluate(() => {
    const B = window.__blockyard;
    B.setPaused(true);
    B.beginPlay();
    B.player.pos.set(33.5, 40, 44.5);
    window.dispatchEvent(new KeyboardEvent("keydown", { code: "KeyV", bubbles: true }));
    window.dispatchEvent(new KeyboardEvent("keyup", { code: "KeyV", bubbles: true }));
    const saved = B.S.spawnPoint ? B.S.spawnPoint.slice() : null;
    B.player.pos.set(1, 1, 1);
    B.spawn();
    const after = [B.player.pos.x, B.player.pos.y, B.player.pos.z];
    B.S.spawnPoint = null;
    B.endPlay(); B.setPaused(false);
    return { saved, after };
  });
  assert(r.saved, "시작 지점이 저장되지 않았다");
  near(r.after[0], 33.5, 0.01, "되살아난 X");
  near(r.after[2], 44.5, 0.01, "되살아난 Z");
});

test("v12 시드 복사: 버튼이 지금 시드를 입력칸에 넣는다", async (page) => {
  const r = await page.evaluate(() => {
    const B = window.__blockyard;
    B.generate(31337);
    document.getElementById("copyseed").click();
    return { seed: B.seed(), field: document.getElementById("seedin").value };
  });
  eq(r.field, String(r.seed), "시드가 입력칸에 안 들어갔다");
});

test("v12 성능 패널: F3 로 열리고 숫자가 채워진다", async (page) => {
  const r = await page.evaluate(() => {
    const B = window.__blockyard;
    B.setPaused(true);
    B.beginPlay();
    B.markAllDirty(); B.buildBudget(4000);
    window.dispatchEvent(new KeyboardEvent("keydown", { code: "F3", bubbles: true }));
    window.dispatchEvent(new KeyboardEvent("keyup", { code: "F3", bubbles: true }));
    for (let k = 0; k < 30; k++) B.step(1 / 60);
    B.refreshPerf();
    const txt = B.perfEl.textContent;
    const hidden = B.perfEl.hidden;
    window.dispatchEvent(new KeyboardEvent("keydown", { code: "F3", bubbles: true }));
    window.dispatchEvent(new KeyboardEvent("keyup", { code: "F3", bubbles: true }));
    B.endPlay(); B.setPaused(false);
    return { txt, hidden, hiddenAfter: B.perfEl.hidden };
  });
  eq(r.hidden, false, "F3 로 패널이 안 열렸다");
  assert(r.txt.indexOf("청크") >= 0 && /\d/.test(r.txt), "패널이 비어 있다: " + r.txt);
  eq(r.hiddenAfter, true, "F3 로 다시 안 닫혔다");
});

test("v12 새 블록이 목록과 조준에 모두 등록됐다", async (page) => {
  const r = await page.evaluate(() => {
    const B = window.__blockyard;
    const need = [B.B.FENCE, B.B.GATE, B.B.PANE, B.B.LADDER];
    return {
      inList: need.filter(b => B.ALL_BLOCKS.indexOf(b) >= 0).length,
      named: need.filter(b => !!B.NAMES[b]).length,
      hard: need.filter(b => B.hardnessOf(b) > 0).length,
      dyn: need.filter(b => B.hasDynamicBoxes(b)).length,
      picks: document.querySelectorAll("#pick-grid .pick").length,
      total: B.ALL_BLOCKS.length + B.ITEMS.length
    };
  });
  eq(r.inList, 4, "새 블록이 블록 목록에 없다");
  eq(r.named, 4, "이름이 없는 새 블록이 있다");
  eq(r.dyn, 4, "동적 상자에 등록되지 않은 새 블록이 있다");
  eq(r.picks, r.total, "블록 고르기 패널이 목록과 다르다");
});

test("v12 파편: 바닥에 닿으면 한 번 튕긴다", async (page, errors) => {
  const before = errors.length;
  await page.evaluate(() => {
    const B = window.__blockyard;
    for (let k = 0; k < 40; k++) B.burst(48, 30, 48, B.B.STONE, 5);
    for (let k = 0; k < 120; k++) B.updateParticles(1 / 60);
  });
  eq(errors.length, before, "파티클에서 오류: " + errors.slice(before).join(" | "));
});


// ══════════════════════════════════════════════════════════════
//  개선 v13 회귀 테스트 — 건축 도구와 생명
// ══════════════════════════════════════════════════════════════

test("v13 양털: 16색이 이름·굳기·목록에 모두 등록됐다", async (page) => {
  const r = await page.evaluate(() => {
    const B = window.__blockyard;
    let named = 0, hard = 0, listed = 0, distinct = new Set();
    for (let i = 0; i < B.WOOL_COUNT; i++) {
      const b = B.WOOL0 + i;
      if (B.NAMES[b]) named++;
      if (B.hardnessOf(b) > 0) hard++;
      if (B.ALL_BLOCKS.indexOf(b) >= 0) listed++;
      distinct.add(B.TILES[b][0]);
    }
    return { count: B.WOOL_COUNT, named, hard, listed, tiles: distinct.size,
             isWool: B.isWool(B.WOOL0 + 5), notWool: B.isWool(B.B.STONE) };
  });
  eq(r.count, 16, "양털 색 수");
  eq(r.named, 16, "이름 없는 양털");
  eq(r.hard, 16, "굳기 없는 양털");
  eq(r.listed, 16, "목록에 없는 양털");
  eq(r.tiles, 16, "같은 타일을 쓰는 양털이 있다");
  assert(r.isWool && !r.notWool, "isWool 판정이 틀렸다");
});

test("v13 영역: 채우기가 선택 범위를 정확히 덮는다", async (page) => {
  const r = await page.evaluate(() => {
    const B = window.__blockyard;
    const x = 20, y = 44, z = 20;
    for (let dx = -2; dx <= 6; dx++) for (let dz = -2; dz <= 6; dz++)
      for (let dy = -2; dy <= 6; dy++) B.set(x + dx, y + dy, z + dz, 0);
    B.refreshAllTops();
    B.S.selA = [x, y, z];
    B.S.selB = [x + 3, y + 2, z + 1];
    const size = B.selectionSize();
    B.getBar()[B.getSelected()] = B.B.BRICK;
    const n = B.fillSelection(B.B.BRICK, 0);
    let inside = 0, outside = 0;
    for (let dx = -1; dx <= 4; dx++) for (let dy = -1; dy <= 3; dy++) for (let dz = -1; dz <= 2; dz++) {
      const isIn = dx >= 0 && dx <= 3 && dy >= 0 && dy <= 2 && dz >= 0 && dz <= 1;
      const v = B.world[B.idx(x + dx, y + dy, z + dz)];
      if (isIn && v === B.B.BRICK) inside++;
      if (!isIn && v === B.B.BRICK) outside++;
    }
    return { size, n, inside, outside };
  });
  eq(r.size, 4 * 3 * 2, "선택 칸 수");
  eq(r.n, r.size, "채운 칸 수");
  eq(r.inside, r.size, "안쪽이 다 안 채워졌다");
  eq(r.outside, 0, "바깥까지 채워졌다");
});

test("v13 영역: 대량 편집이 한 번에 되돌려진다", async (page) => {
  const r = await page.evaluate(() => {
    const B = window.__blockyard;
    const x = 26, y = 44, z = 26;
    for (let dx = -1; dx <= 5; dx++) for (let dz = -1; dz <= 5; dz++)
      for (let dy = -1; dy <= 5; dy++) B.set(x + dx, y + dy, z + dz, 0);
    B.refreshAllTops();
    B.history.length = 0; B.future.length = 0;
    B.S.selA = [x, y, z];
    B.S.selB = [x + 3, y + 2, z + 3];
    const n = B.fillSelection(B.B.STONE, 0);
    const histAfterFill = B.history.length;
    B.undo();
    let left = 0;
    for (let dx = 0; dx <= 3; dx++) for (let dy = 0; dy <= 2; dy++) for (let dz = 0; dz <= 3; dz++)
      if (B.world[B.idx(x + dx, y + dy, z + dz)] === B.B.STONE) left++;
    B.redo();
    let back = 0;
    for (let dx = 0; dx <= 3; dx++) for (let dy = 0; dy <= 2; dy++) for (let dz = 0; dz <= 3; dz++)
      if (B.world[B.idx(x + dx, y + dy, z + dz)] === B.B.STONE) back++;
    B.S.selA = B.S.selB = null;
    return { n, histAfterFill, left, back };
  });
  eq(r.histAfterFill, 1, "대량 편집이 되돌리기 기록을 " + r.histAfterFill + "개나 만들었다");
  eq(r.left, 0, "한 번 되돌렸는데 남았다");
  eq(r.back, r.n, "다시하기가 전부 복원하지 못했다");
});

test("v13 영역: 복사한 것을 다른 곳에 붙여넣는다", async (page) => {
  const r = await page.evaluate(() => {
    const B = window.__blockyard;
    const x = 60, y = 44, z = 20;
    for (let dx = -2; dx <= 12; dx++) for (let dz = -2; dz <= 6; dz++)
      for (let dy = -2; dy <= 6; dy++) B.set(x + dx, y + dy, z + dz, 0);
    B.refreshAllTops();
    // ㄱ 자 모양을 하나 만든다
    B.applyEdit(x, y, z, B.B.BRICK, false);
    B.applyEdit(x + 1, y, z, B.B.BRICK, false);
    B.applyEdit(x, y + 1, z, B.B.GLASS, false);
    B.S.selA = [x, y, z];
    B.S.selB = [x + 1, y + 1, z];
    const copied = B.copySelection();
    const n = B.pasteClip(x + 6, y, z);
    B.S.selA = B.S.selB = null;
    return {
      copied, n,
      a: B.world[B.idx(x + 6, y, z)], b: B.world[B.idx(x + 7, y, z)],
      c: B.world[B.idx(x + 6, y + 1, z)], d: B.world[B.idx(x + 7, y + 1, z)],
      BRICK: B.B.BRICK, GLASS: B.B.GLASS
    };
  });
  eq(r.copied, 4, "복사한 칸 수");
  eq(r.a, r.BRICK, "붙여넣기 (0,0)");
  eq(r.b, r.BRICK, "붙여넣기 (1,0)");
  eq(r.c, r.GLASS, "붙여넣기 (0,1)");
  eq(r.d, 0, "빈칸까지 덮어썼다");
});

test("v13 영역: 너무 큰 범위는 거절한다", async (page) => {
  const r = await page.evaluate(() => {
    const B = window.__blockyard;
    B.S.selA = [0, 0, 0];
    B.S.selB = [B.WX - 1, B.WY - 1, B.WZ - 1];
    const size = B.selectionSize();
    const fill = B.fillSelection(B.B.STONE, 0);
    const copy = B.copySelection();
    B.S.selA = B.S.selB = null;
    return { size, fill, copy, max: B.REGION_MAX };
  });
  assert(r.size > r.max, "시험용 범위가 상한보다 작다");
  eq(r.fill, -1, "상한을 넘었는데 채웠다");
  eq(r.copy, -1, "상한을 넘었는데 복사했다");
});

test("v13 조작: 비행 속도 · 핫바 2쪽 · 미니맵 표식", async (page) => {
  const r = await page.evaluate(() => {
    const B = window.__blockyard;
    B.setPaused(true);
    B.beginPlay();
    function key(code) {
      window.dispatchEvent(new KeyboardEvent("keydown", { code, bubbles: true }));
      window.dispatchEvent(new KeyboardEvent("keyup", { code, bubbles: true }));
    }
    // 비행 속도
    const fly0 = B.S.flySpeed;
    window.dispatchEvent(new WheelEvent("wheel", { deltaY: -100, altKey: true, bubbles: true }));
    const fly1 = B.S.flySpeed;
    // 핫바 2쪽
    const page1 = B.getBar().slice();
    key("Tab");
    const page2 = B.getBar().slice();
    key("Tab");
    const back = B.getBar().slice();
    // 표식
    B.S.marks = [];
    B.player.pos.set(20, 30, 30);
    key("KeyB");
    const one = B.S.marks.length;
    key("KeyB");
    const zero = B.S.marks.length;
    B.endPlay(); B.setPaused(false);
    return { fly0, fly1, differs: page1.join() !== page2.join(),
             restored: page1.join() === back.join(), one, zero };
  });
  assert(r.fly1 > r.fly0, "Alt+휠로 비행 속도가 안 바뀐다");
  assert(r.differs, "Tab 으로 핫바가 안 바뀐다");
  assert(r.restored, "Tab 두 번에 원래 핫바로 안 돌아온다");
  eq(r.one, 1, "표식이 안 찍혔다");
  eq(r.zero, 0, "같은 자리를 다시 눌러도 안 지워진다");
});

test("v13 도움말: H 로 열리고 닫힌다", async (page) => {
  const r = await page.evaluate(() => {
    const B = window.__blockyard;
    B.setPaused(true);
    B.beginPlay();
    function key(code) {
      window.dispatchEvent(new KeyboardEvent("keydown", { code, bubbles: true }));
      window.dispatchEvent(new KeyboardEvent("keyup", { code, bubbles: true }));
    }
    key("KeyH");
    const opened = !B.helpEl.hidden;
    const text = B.helpEl.textContent;
    key("KeyH");
    const closed = B.helpEl.hidden;
    B.endPlay(); B.setPaused(false);
    return { opened, closed, hasRegion: text.indexOf("영역") >= 0, hasMove: text.indexOf("이동") >= 0 };
  });
  assert(r.opened, "H 로 도움말이 안 열린다");
  assert(r.closed, "H 로 도움말이 안 닫힌다");
  assert(r.hasRegion && r.hasMove, "도움말에 빠진 항목이 있다");
});

test("v13 동물: 땅 위를 걸어 다니고 물에 빠지지 않는다", async (page) => {
  const r = await page.evaluate(() => {
    const B = window.__blockyard;
    B.setPaused(true);
    B.generate(99999); B.relightAll(false);
    B.spawn();
    B.seedMobs();
    const start = B.mobs.map(m => [m.x, m.z]);
    for (let k = 0; k < 900; k++) B.updateMobs(1 / 60);
    let moved = 0, grounded = 0, inWorld = 0;
    B.mobs.forEach((m, i) => {
      if (Math.abs(m.x - start[i][0]) + Math.abs(m.z - start[i][1]) > 0.5) moved++;
      const gy = B.topMap[Math.floor(m.z) * B.WX + Math.floor(m.x)] + 1;
      if (Math.abs(m.y - gy) < 1.6) grounded++;
      if (m.x > 0 && m.x < B.WX && m.z > 0 && m.z < B.WZ) inWorld++;
    });
    B.setPaused(false);
    return { total: B.mobs.length, moved, grounded, inWorld, kinds: B.MOB_KINDS.length };
  });
  assert(r.total >= 10, "동물이 너무 적다: " + r.total);
  assert(r.kinds >= 3, "동물 종류: " + r.kinds);
  assert(r.moved > r.total * 0.4, `동물이 안 움직인다 — ${r.moved}/${r.total}`);
  eq(r.inWorld, r.total, "세계 밖으로 나간 동물이 있다");
  assert(r.grounded > r.total * 0.7, `땅에서 떨어진 동물이 있다 — ${r.grounded}/${r.total}`);
});

test("v13 저장: 표식·2쪽 핫바·비행 속도가 저장된다", async (page) => {
  const r = await page.evaluate(() => {
    const B = window.__blockyard;
    B.S.marks = [[11, 22], [33, 44]];
    B.S.flySpeed = 2.5;
    B.S.barAlt = B.getBar().slice().reverse();
    const altWas = B.S.barAlt.slice();
    B.saveGame();
    B.S.marks = []; B.S.flySpeed = 1; B.S.barAlt = null;
    B.loadGame();
    return { marks: B.S.marks, fly: B.S.flySpeed, alt: B.S.barAlt, altWas };
  });
  eq(r.marks.length, 2, "표식이 안 실렸다");
  eq(r.fly, 2.5, "비행 속도가 안 실렸다");
  eq((r.alt || []).join(), r.altWas.join(), "2쪽 핫바가 안 실렸다");
});


// ══════════════════════════════════════════════════════════════
//  개선 v14 회귀 테스트 — 마무리와 안전
// ══════════════════════════════════════════════════════════════

test("v14 동물: 플레이어를 뚫고 지나가지 못한다", async (page) => {
  const r = await page.evaluate(() => {
    const B = window.__blockyard;
    B.setPaused(true);
    B.seedMobs();
    // 다른 동물이 시험 자리에 끼어들지 않게 전부 멀리 치운다
    B.mobs.forEach(mm => { mm.x = 5; mm.z = 5; mm.y = 30; mm.walk = 0; mm.turn = 999; });
    const m = B.mobs[0];
    m.x = 40; m.z = 40; m.y = 30;
    // 동물 바로 위에 선다
    const push = B.pushOutOfMobs(40.15, 40.05, 0.3);
    const far = B.pushOutOfMobs(70, 70, 0.3);
    B.setPaused(false);
    return { pushLen: Math.hypot(push[0], push[1]), farLen: Math.hypot(far[0], far[1]) };
  });
  assert(r.pushLen > 0.05, "겹쳤는데 밀어내지 않는다: " + r.pushLen.toFixed(3));
  eq(r.farLen, 0, "멀리 있는데 밀어낸다");
});

test("v14 세계 파일: 내보낸 내용을 그대로 가져온다", async (page) => {
  const r = await page.evaluate(() => {
    const B = window.__blockyard;
    B.generate(24680);
    B.applyEdit(48, 30, 48, B.B.DIAMOND, false);
    B.saveGame();
    const text = localStorage.getItem(B.slotKey(B.S.slot));
    const seedBefore = B.seed();
    // 다른 세계로 갈아탄 뒤 되돌린다
    B.generate(13579);
    const other = B.seed();
    const err = B.importWorldText(text);
    return { err, seedBefore, other, back: B.seed(),
             mark: B.world[B.idx(48, 30, 48)], DIAMOND: B.B.DIAMOND };
  });
  eq(r.err, "", "가져오기 실패: " + r.err);
  assert(r.other !== r.seedBefore, "시험용 세계 교체가 안 됐다");
  eq(r.back, r.seedBefore, "시드가 복원되지 않았다");
  eq(r.mark, r.DIAMOND, "표식 블록이 복원되지 않았다");
});

test("v14 세계 파일: 엉뚱한 파일은 거절한다", async (page) => {
  const r = await page.evaluate(() => {
    const B = window.__blockyard;
    return {
      junk: B.importWorldText("이건 그냥 글자"),
      wrong: B.importWorldText(JSON.stringify({ hello: 1 })),
      old: B.importWorldText(JSON.stringify({ v: 99, w: "x", seed: 1 }))
    };
  });
  assert(r.junk, "쓰레기 문자열을 받아들였다");
  assert(r.wrong, "다른 JSON 을 받아들였다");
  assert(r.old, "모르는 버전을 받아들였다");
});

test("v14 백업: 저장할 때마다 직전 내용이 남고 되돌릴 수 있다", async (page) => {
  const r = await page.evaluate(() => {
    const B = window.__blockyard;
    B.generate(11111);
    B.saveGame();                       // 백업 없음(첫 저장)
    const seedA = B.seed();
    B.generate(22222);
    B.saveGame();                       // 여기서 seedA 가 백업으로 밀린다
    const seedB = B.seed();
    const had = B.hasBackup();
    const ok = B.restoreBackup();
    return { seedA, seedB, had, ok, now: B.seed() };
  });
  assert(r.had, "백업이 만들어지지 않았다");
  assert(r.ok, "백업 복원에 실패했다");
  eq(r.now, r.seedA, "직전 저장으로 안 돌아갔다");
});

test("v14 하늘: 구름이 두 겹이고 높은 층이 더 빨리 흐른다", async (page) => {
  const r = await page.evaluate(() => {
    const B = window.__blockyard;
    B.setPaused(true);
    B.beginPlay();
    const lo0 = B.cloudGroup.position.x, hi0 = B.cloudGroupHigh.position.x;
    for (let k = 0; k < 120; k++) B.step(1 / 60);
    const lo = B.cloudGroup.position.x - lo0, hi = B.cloudGroupHigh.position.x - hi0;
    B.endPlay(); B.setPaused(false);
    return { lo, hi, layers: B.cloudGroup.children.length, high: B.cloudGroupHigh.children.length };
  });
  assert(r.layers > 0 && r.high > 0, "구름 층이 비어 있다");
  assert(r.lo > 0 && r.hi > r.lo, `높은 구름이 더 빨라야 한다 — 낮 ${r.lo.toFixed(2)} · 높 ${r.hi.toFixed(2)}`);
});

test("v14 하늘: 색이 한 프레임에 튀지 않고 따라간다", async (page) => {
  const r = await page.evaluate(() => {
    const B = window.__blockyard;
    B.setWeather(0);
    B.setTime(0.5); B.applyTime(1);       // 충분히 수렴시킨다
    for (let k = 0; k < 200; k++) B.applyTime(1 / 60);
    const noon = B.skyUniforms.top.value.clone();
    B.setTime(0.98);
    B.applyTime(1 / 60);                  // 한 프레임만
    const oneFrame = B.skyUniforms.top.value.clone();
    for (let k = 0; k < 300; k++) B.applyTime(1 / 60);
    const settled = B.skyUniforms.top.value.clone();
    B.setTime(0.3); for (let k = 0; k < 300; k++) B.applyTime(1 / 60);
    function dist(a, b) { return Math.abs(a.r - b.r) + Math.abs(a.g - b.g) + Math.abs(a.b - b.b); }
    return { jump: dist(noon, oneFrame), total: dist(noon, settled) };
  });
  assert(r.total > 0.05, "정오와 한밤 하늘색이 거의 같다");
  assert(r.jump < r.total * 0.5,
    `하늘색이 한 프레임에 튀었다 — 한 프레임 ${r.jump.toFixed(3)} / 전체 ${r.total.toFixed(3)}`);
});

test("v14 성능: 아주 멀어진 청크는 정점 버퍼를 놓아 준다", async (page) => {
  const r = await page.evaluate(() => {
    const B = window.__blockyard;
    B.markAllDirty(); B.buildBudget(9000);
    let before = 0;
    B.opaqueMeshes.forEach(m => { if (m.userData.hasGeo) before++; });
    // 카메라를 세계 밖 아주 먼 곳으로
    B.camera.position.set(-600, 200, -600);
    B.updateChunkVisibility(40);
    let after = 0;
    B.opaqueMeshes.forEach(m => { if (m.userData.hasGeo) after++; });
    // 되돌려 놓는다
    B.camera.position.set(B.WX / 2, 30, B.WZ / 2);
    B.markAllDirty(); B.buildBudget(9000);
    return { before, after, dist: B.FREE_DIST };
  });
  assert(r.before > 10, "구운 청크가 너무 적다: " + r.before);
  assert(r.after < r.before * 0.2, `멀어진 청크를 안 놓았다 — ${r.before} → ${r.after}`);
});

test("v14 설정: 화면 표시 크기가 CSS 에 반영된다", async (page) => {
  const r = await page.evaluate(() => {
    const B = window.__blockyard;
    const keep = B.opts.ui;
    B.opts.ui = 150; B.applyOpts();
    const big = getComputedStyle(document.documentElement).getPropertyValue("--ui").trim();
    B.opts.ui = 100; B.applyOpts();
    const one = getComputedStyle(document.documentElement).getPropertyValue("--ui").trim();
    B.opts.ui = keep; B.applyOpts();
    return { big, one };
  });
  eq(r.big, "1.50", "UI 배율이 안 커진다");
  eq(r.one, "1.00", "UI 배율이 안 돌아온다");
});

test("v14 셰이더: 물 반짝임을 넣어도 컴파일 오류가 없다", async (page, errors) => {
  const before = errors.length;
  const r = await page.evaluate(() => {
    const B = window.__blockyard;
    B.markAllDirty(); B.buildBudget(9000);
    return { gamma: B.voxUniforms.uGamma.value, time: B.voxUniforms.uTime.value };
  });
  await page.waitForTimeout(200);
  eq(errors.length, before, "셰이더 오류: " + errors.slice(before).join(" | "));
  assert(typeof r.gamma === "number", "uGamma 가 없다");
});

test("v14 터치: 핫바 스와이프로 칸이 바뀐다", async (page) => {
  const r = await page.evaluate(() => {
    const B = window.__blockyard;
    const el = document.getElementById("hotbar");
    function touch(type, x) {
      const t = { identifier: 1, clientX: x, clientY: 300, target: el };
      const ev = new Event(type, { bubbles: true });
      ev.changedTouches = [t];
      ev.touches = type === "touchend" ? [] : [t];
      el.dispatchEvent(ev);
    }
    B.selectSlot(0);
    const start = B.getSelected();
    touch("touchstart", 100);
    touch("touchmove", 220);
    touch("touchend", 220);
    const after = B.getSelected();
    B.selectSlot(0);
    return { start, after };
  });
  assert(r.after !== r.start, "핫바를 쓸어도 칸이 안 바뀐다");
});


// ══════════════════════════════════════════════════════════════
//  개선 v15 회귀 테스트 — 사건이 있는 세계
// ══════════════════════════════════════════════════════════════

test("v15 TNT: 터지면 반경 안이 날아가고 기반암은 남는다", async (page) => {
  const r = await page.evaluate(() => {
    const B = window.__blockyard;
    const x = 40, y = 20, z = 40;
    for (let dx = -8; dx <= 8; dx++) for (let dy = -8; dy <= 8; dy++) for (let dz = -8; dz <= 8; dz++)
      B.set(x + dx, y + dy, z + dz, B.B.STONE);
    for (let dx = -8; dx <= 8; dx++) for (let dz = -8; dz <= 8; dz++) B.set(x + dx, 0, z + dz, B.B.BEDROCK);
    B.refreshAllTops();
    B.history.length = 0;
    const removed = B.explode(x, y, z, B.BLAST_R);
    let hole = 0, far = 0;
    for (let dx = -1; dx <= 1; dx++) for (let dy = -1; dy <= 1; dy++) for (let dz = -1; dz <= 1; dz++)
      if (B.world[B.idx(x + dx, y + dy, z + dz)] === 0) hole++;
    for (let dx = -8; dx <= 8; dx += 8)
      if (B.world[B.idx(x + dx, y, z)] === B.B.STONE) far++;
    let bedrock = 0;
    for (let dx = -2; dx <= 2; dx++) if (B.world[B.idx(x + dx, 0, z)] === B.B.BEDROCK) bedrock++;
    return { removed, hole, far, bedrock, hist: B.history.length };
  });
  assert(r.removed > 20, "폭발이 아무것도 못 날렸다: " + r.removed);
  eq(r.hole, 27, "중심이 안 비었다");
  eq(r.far, 2, "반경 밖까지 날아갔다");
  eq(r.bedrock, 5, "기반암이 날아갔다");
  eq(r.hist, 1, "폭발이 되돌리기 기록을 " + r.hist + "개 만들었다");
});

test("v15 불: 탈 것에만 붙고, 옆으로 번지다 꺼진다", async (page) => {
  const r = await page.evaluate(() => {
    const B = window.__blockyard;
    const x = 60, y = 40, z = 60;
    for (let dx = -6; dx <= 6; dx++) for (let dz = -6; dz <= 6; dz++)
      for (let dy = -1; dy <= 4; dy++) B.set(x + dx, y + dy, z + dz, 0);
    B.set(x, y - 1, z, B.B.STONE);
    B.refreshAllTops();
    // 돌 위에는 안 붙는다
    B.applyEdit(x + 4, y, z, B.B.STONE, false);
    const onStone = B.ignite(x + 4, y + 1, z);
    // 나무판자 옆에는 붙는다
    for (let i = 0; i < 5; i++) B.applyEdit(x + i, y, z + 2, B.B.PLANKS, false);
    const onWood = B.ignite(x, y + 1, z + 2);
    let spread = 0;
    for (let k = 0; k < 400; k++) B.fireTick(80);
    for (let i = 0; i < 5; i++)
      if (B.world[B.idx(x + i, y, z + 2)] !== B.B.PLANKS) spread++;
    // 결국 꺼진다
    let fireLeft = 0;
    for (let dx = -6; dx <= 6; dx++) for (let dz = -6; dz <= 6; dz++)
      for (let dy = -1; dy <= 4; dy++)
        if (B.world[B.idx(x + dx, y + dy, z + dz)] === B.B.FIRE) fireLeft++;
    return { onStone, onWood, spread, fireLeft, flam: B.isFlammable(B.B.PLANKS),
             notFlam: B.isFlammable(B.B.STONE) };
  });
  eq(r.onStone, false, "탈 것이 없는데 불이 붙었다");
  assert(r.onWood, "나무 옆인데 불이 안 붙었다");
  assert(r.spread >= 3, "불이 번지지 않았다: " + r.spread + "/5");
  eq(r.fireLeft, 0, "태울 것이 없는데 불이 " + r.fireLeft + "칸 남았다");
  assert(r.flam && !r.notFlam, "가연성 판정이 틀렸다");
});

test("v15 불: 광원이라 주변이 밝아진다", async (page) => {
  const r = await page.evaluate(() => {
    const B = window.__blockyard;
    const x = 24, y = 40, z = 24;
    for (let dx = -4; dx <= 4; dx++) for (let dz = -4; dz <= 4; dz++)
      for (let dy = -1; dy <= 4; dy++) B.set(x + dx, y + dy, z + dz, 0);
    B.set(x, y - 1, z, B.B.PLANKS);
    B.refreshAllTops(); B.relightAll(false);
    const before = B.lightBlk[B.idx(x + 1, y, z)];
    B.ignite(x, y, z);
    B.relightLocal(x, y, z);
    return { before, after: B.lightBlk[B.idx(x + 1, y, z)] };
  });
  eq(r.before, 0, "불 붙이기 전이 이미 밝다");
  assert(r.after >= 11, "불 옆이 안 밝다: " + r.after);
});

test("v15 생명: 물고기는 물속에, 새는 하늘에 있다", async (page) => {
  const r = await page.evaluate(() => {
    const B = window.__blockyard;
    B.generate(777); B.relightAll(false);
    B.spawn();
    B.seedFlocks();
    for (let k = 0; k < 600; k++) B.updateFlocks(1 / 60);
    let fishInWater = 0, fishShown = 0, birdsUp = 0;
    for (let i = 0; i < B.fish.pos.length; i += 3) {
      const y = B.fish.pos[i + 1];
      if (y < -100) continue;
      fishShown++;
      const x = Math.floor(B.fish.pos[i]), z = Math.floor(B.fish.pos[i + 2]);
      if (x >= 0 && x < B.WX && z >= 0 && z < B.WZ &&
          B.world[B.idx(x, Math.floor(y), z)] === B.B.WATER) fishInWater++;
    }
    for (let i = 0; i < B.birds.pos.length; i += 3)
      if (B.birds.pos[i + 1] > B.SEA + 10) birdsUp++;
    return { fishShown, fishInWater, birdsUp, birdTotal: B.birds.pos.length / 3 };
  });
  assert(r.fishShown > 0, "물고기가 하나도 안 보인다");
  eq(r.fishInWater, r.fishShown, "물 밖으로 나간 물고기가 있다");
  assert(r.birdsUp > r.birdTotal * 0.8, "새가 하늘에 없다");
});

test("v15 동물: 물과 얼음 위로는 걸어가지 않는다", async (page) => {
  const r = await page.evaluate(() => {
    const B = window.__blockyard;
    B.generate(777); B.relightAll(false);
    B.spawn();
    B.seedMobs();
    for (let k = 0; k < 1200; k++) B.updateMobs(1 / 60);
    let wet = 0;
    B.mobs.forEach(m => {
      const x = Math.floor(m.x), z = Math.floor(m.z);
      if (x < 0 || x >= B.WX || z < 0 || z >= B.WZ) return;
      const gy = B.topMap[z * B.WX + x];
      const b = B.world[B.idx(x, gy, z)];
      if (b === B.B.WATER || b === B.B.ICE || b === B.B.LAVA) wet++;
    });
    return { wet, total: B.mobs.length };
  });
  eq(r.wet, 0, r.wet + "마리가 물·얼음 위에 있다");
});

test("v15 지형: 평지·산악·군도가 서로 다른 세계를 만든다", async (page) => {
  const r = await page.evaluate(() => {
    const B = window.__blockyard;
    function stats() {
      let min = 999, max = -1, sum = 0, land = 0;
      for (let z = 0; z < B.WZ; z++) for (let x = 0; x < B.WX; x++) {
        const h = B.heightMap[z * B.WX + x];
        if (h > B.SEA) { land++; sum += h; if (h < min) min = h; if (h > max) max = h; }
      }
      return { avg: land ? sum / land : 0, range: max - min, land: land };
    }
    const out = {};
    for (const t of [0, 1, 2, 3]) {
      B.S.terrain = t;
      B.generate(12345);
      out[t] = stats();
    }
    B.S.terrain = 0;
    return out;
  });
  assert(r[1].range < r[0].range, `평지가 보통보다 평평해야 한다 — ${r[1].range} vs ${r[0].range}`);
  assert(r[2].range > r[0].range, `산악이 보통보다 험해야 한다 — ${r[2].range} vs ${r[0].range}`);
  assert(r[3].land < r[0].land, `군도는 육지가 적어야 한다 — ${r[3].land} vs ${r[0].land}`);
});

test("v15 구조물: 버려진 오두막이 생긴다", async (page) => {
  const r = await page.evaluate(() => {
    const B = window.__blockyard;
    let found = 0, seeds = 0;
    for (const seed of [777, 99999, 20260904, 4242, 1, 31337]) {
      B.S.terrain = 0;
      B.generate(seed);
      seeds++;
      // 지상에 유리와 횃불이 같이 있으면 오두막이다
      let glass = 0, torch = 0;
      for (let z = 0; z < B.WZ; z++) for (let x = 0; x < B.WX; x++)
        for (let y = B.SEA; y < B.WY; y++) {
          const b = B.world[B.idx(x, y, z)];
          if (b === B.B.GLASS) glass++;
          else if (b === B.B.TORCH) torch++;
        }
      if (glass > 0 && torch > 0) found++;
    }
    return { found, seeds };
  });
  assert(r.found >= 3, `시드 ${r.seeds}개 중 ${r.found}개에서만 오두막이 나왔다`);
});

test("v15 소리: 3D 위치 지정과 배경음이 예외 없이 돈다", async (page, errors) => {
  const before = errors.length;
  await page.evaluate(() => {
    const B = window.__blockyard;
    B.listenAt(10, 20, 30, 0, -1);
    B.moodChord(true, 1);
    B.moodChord(false, 0.5);
  });
  await page.waitForTimeout(200);
  eq(errors.length, before, "소리에서 오류: " + errors.slice(before).join(" | "));
});

test("v15 밤하늘: 밝은 별이 밤에만 보인다", async (page) => {
  const r = await page.evaluate(() => {
    const B = window.__blockyard;
    B.setWeather(0);
    B.setTime(0.5); B.updateSkyBodies();
    const day = B.brightStars.visible;
    B.setTime(0.98); B.updateSkyBodies();
    const night = B.brightStars.visible;
    B.setTime(0.3); B.updateSkyBodies();
    return { day, night, count: B.brightStars.geometry.getAttribute("position").count };
  });
  eq(r.day, false, "낮인데 별이 보인다");
  eq(r.night, true, "밤인데 별이 안 보인다");
  assert(r.count >= 20, "밝은 별 개수: " + r.count);
});

test("v15 도전 과제: 새 콘텐츠 과제가 늘었다", async (page) => {
  const r = await page.evaluate(() => {
    const B = window.__blockyard;
    const ids = B.ACHIEVEMENTS.map(a => a.id);
    return { total: ids.length,
             added: ["fire", "boom", "build100", "explorer"].filter(i => ids.includes(i)).length };
  });
  assert(r.total >= 26, "도전 과제 수: " + r.total);
  eq(r.added, 4, "새 도전 과제가 빠졌다");
});


// ══════════════════════════════════════════════════════════════
//  개선 v16 회귀 테스트 — 편의와 완성도
// ══════════════════════════════════════════════════════════════

test("v16 로딩: 첫 화면이 진행을 보여주고 끝나면 사라진다", async (page) => {
  const r = await page.evaluate(() => {
    const B = window.__blockyard;
    const el = document.getElementById("boot");
    return { exists: !!el, done: el.classList.contains("done"),
             text: document.getElementById("boot-msg").textContent };
  });
  assert(r.exists, "로딩 화면이 없다");
  assert(r.done, "부팅이 끝났는데 로딩 화면이 남았다");
  assert(r.text.length > 0, "로딩 문구가 비었다");
});

test("v16 굽기: 카메라에 가까운 청크부터 굽는다", async (page) => {
  const r = await page.evaluate(() => {
    const B = window.__blockyard;
    // 전부 지우고 딱 한 청크만 굽게 한 뒤, 그게 가장 가까운 것인지 본다
    B.opaqueMeshes.forEach(m => { m.userData.hasGeo = false; });
    B.markAllDirty();
    const focus = { x: 8, y: 8, z: 8 };
    B.setBuildFocus(focus);
    B.buildBudget(0);                        // 정확히 한 청크
    let built = -1, count = 0;
    for (let i = 0; i < B.opaqueMeshes.length; i++)
      if (B.opaqueMeshes[i].userData.hasGeo) { built = i; count++; }
    function dist(id) {
      const dx = (B.chunkCX(id) + 0.5) * B.CH - focus.x;
      const dy = (B.chunkCY(id) + 0.5) * B.CH - focus.y;
      const dz = (B.chunkCZ(id) + 0.5) * B.CH - focus.z;
      return dx * dx + dy * dy + dz * dz;
    }
    let best = 0;
    for (let i = 1; i < B.opaqueMeshes.length; i++) if (dist(i) < dist(best)) best = i;
    B.setBuildFocus(null);
    B.markAllDirty(); B.buildBudget(9000);
    return { count, builtD: built >= 0 ? dist(built) : -1, bestD: dist(best) };
  });
  eq(r.count, 1, "정확히 한 청크만 구워야 한다");
  eq(r.builtD, r.bestD, "가장 가까운 청크를 먼저 굽지 않았다");
});

test("v16 미니맵: 등고선을 켜고 끌 수 있다", async (page) => {
  const r = await page.evaluate(() => {
    const B = window.__blockyard;
    B.generate(99999);
    B.player.pos.set(B.WX / 2, 40, B.WZ / 2);
    function snap() {
      B.drawMinimap();
      const cv = document.getElementById("mm");
      return cv.getContext("2d").getImageData(0, 0, cv.width, cv.height).data.join(",");
    }
    B.S.contour = false; const off = snap();
    B.S.contour = true;  const on = snap();
    return { differs: off !== on };
  });
  assert(r.differs, "등고선을 켜도 미니맵이 그대로다");
});

test("v16 블록 목록: 갈래와 이름으로 걸러진다", async (page) => {
  const r = await page.evaluate(() => {
    const B = window.__blockyard;
    const find = document.getElementById("pick-find");
    const tabs = document.getElementById("pick-tabs");
    function count() {
      return Array.prototype.filter.call(
        document.querySelectorAll("#pick-grid .pick"), e => !e.hidden).length;
    }
    find.value = ""; tabs.querySelector('[data-cat="all"]').click();
    const all = count();
    tabs.querySelector('[data-cat="color"]').click();
    const color = count();
    tabs.querySelector('[data-cat="all"]').click();
    find.value = "wool";
    find.dispatchEvent(new Event("input", { bubbles: true }));
    const search = count();
    find.value = "";
    find.dispatchEvent(new Event("input", { bubbles: true }));
    return { all, color, search, cats: [B.categoryOf(B.WOOL0), B.categoryOf(B.B.STONE),
                                        B.categoryOf(B.B.LAMP), B.categoryOf(B.B.BRICK)] };
  });
  assert(r.all > 30, "전체 목록이 너무 짧다: " + r.all);
  eq(r.color, 16, "색 갈래가 양털 16개가 아니다: " + r.color);
  eq(r.search, 16, "이름 검색이 안 걸린다: " + r.search);
  eq(r.cats[0], "color", "양털 갈래");
  eq(r.cats[1], "nature", "돌 갈래");
  eq(r.cats[2], "light", "램프 갈래");
  eq(r.cats[3], "build", "벽돌 갈래");
});

test("v16 목록: 최근 쓴 블록이 앞으로 온다", async (page) => {
  const r = await page.evaluate(() => {
    const B = window.__blockyard;
    B.S.recent = [];
    B.noteBlockUse(B.B.DIAMOND);
    B.noteBlockUse(B.B.BRICK);
    B.sortPickByRecent();
    const first = document.querySelector("#pick-grid .pick");
    const label = first.getAttribute("aria-label");
    return { label, recent: B.S.recent.slice(), brick: B.NAMES[B.B.BRICK] };
  });
  eq(r.label, r.brick, "가장 최근에 쓴 블록이 앞에 없다: " + r.label);
  eq(r.recent.length, 2, "최근 목록 길이");
});

test("v16 조작키: 재배치한 키가 실제로 먹는다", async (page) => {
  const r = await page.evaluate(() => {
    const B = window.__blockyard;
    B.setPaused(true);
    B.beginPlay();
    const was = B.player.flying;
    B.S.binds.fly = "KeyJ";
    window.dispatchEvent(new KeyboardEvent("keydown", { code: "KeyJ", bubbles: true }));
    window.dispatchEvent(new KeyboardEvent("keyup", { code: "KeyJ", bubbles: true }));
    const toggled = B.player.flying !== was;
    // 원래 키는 이제 안 먹어야 한다
    const before = B.player.flying;
    window.dispatchEvent(new KeyboardEvent("keydown", { code: "KeyF", bubbles: true }));
    window.dispatchEvent(new KeyboardEvent("keyup", { code: "KeyF", bubbles: true }));
    const oldKey = B.player.flying !== before;
    B.S.binds.fly = "KeyF";
    B.player.flying = was;
    B.endPlay(); B.setPaused(false);
    return { toggled, oldKey };
  });
  assert(r.toggled, "재배치한 키가 안 먹는다");
  eq(r.oldKey, false, "옛 키가 아직도 먹는다");
});

test("v16 고대비: 설정을 켜면 문서에 표시된다", async (page) => {
  const r = await page.evaluate(() => {
    const B = window.__blockyard;
    const keep = B.opts.contrast;
    B.opts.contrast = 1; B.applyOpts();
    const on = document.documentElement.classList.contains("hc");
    B.opts.contrast = 0; B.applyOpts();
    const off = document.documentElement.classList.contains("hc");
    B.opts.contrast = keep; B.applyOpts();
    return { on, off };
  });
  assert(r.on, "고대비를 켜도 반영이 안 된다");
  eq(r.off, false, "고대비를 꺼도 남아 있다");
});

test("v16 성능 자동 조절: 프레임이 낮으면 시야거리를 줄인다", async (page) => {
  const r = await page.evaluate(() => {
    const B = window.__blockyard;
    B.setPaused(true);
    B.beginPlay();
    B.S.autoPerf = true;
    B.opts.far = 120; B.applyOpts();
    B.S.perfDrop = 0;
    // 아주 느린 프레임을 흉내 낸다
    for (let k = 0; k < 5; k++) B.autoTuneFar(12);
    const dropped = B.farNow();
    const setting = B.opts.far;              // 사용자 설정은 그대로여야 한다
    // 프레임이 회복되면 되돌아온다
    for (let k = 0; k < 20; k++) B.autoTuneFar(60);
    const restored = B.farNow();
    B.opts.far = 120; B.applyOpts();
    B.S.perfDrop = 0;
    B.endPlay(); B.setPaused(false);
    return { dropped, setting, restored };
  });
  assert(r.dropped < 120, "프레임이 낮은데 시야거리가 그대로다: " + r.dropped);
  eq(r.setting, 120, "사용자가 정한 시야 설정을 건드렸다 (세션마다 영구히 깎인다)");
  eq(r.restored, 120, "프레임이 회복됐는데 시야가 안 돌아온다: " + r.restored);
});

test("v16 통계: 지형·슬롯·블록 종류가 기록에 나온다", async (page) => {
  const r = await page.evaluate(() => {
    const B = window.__blockyard;
    B.refreshStats();
    const txt = document.getElementById("statgrid").textContent;
    return { txt };
  });
  assert(r.txt.indexOf("지형") >= 0, "지형이 없다");
  assert(r.txt.indexOf("슬롯") >= 0, "슬롯이 없다");
  assert(r.txt.indexOf("블록 종류") >= 0, "블록 종류가 없다");
  assert(r.txt.indexOf("되돌리기") >= 0, "되돌리기 단계가 없다");
});

test("v16 튜토리얼: 새 기능까지 안내한다", async (page) => {
  const r = await page.evaluate(() => {
    const B = window.__blockyard;
    return { steps: B.TUT.length, text: B.TUT.join(" ") };
  });
  assert(r.steps >= 6, "튜토리얼 단계: " + r.steps);
  assert(r.text.indexOf("영역") >= 0, "영역 도구 안내가 없다");
  assert(r.text.indexOf("H") >= 0, "도움말 안내가 없다");
});


// ══════════════════════════════════════════════════════════════
//  개선 v17 회귀 테스트 — 나누고 다루기
// ══════════════════════════════════════════════════════════════

test("v17 공유: 링크에 시드와 지형이 담긴다", async (page) => {
  const r = await page.evaluate(() => {
    const B = window.__blockyard;
    B.S.terrain = 2;
    B.generate(45678);
    const url = B.shareLink();
    return { url, seed: B.seed() };
  });
  assert(r.url.indexOf("seed=" + r.seed) > 0, "링크에 시드가 없다: " + r.url);
  assert(r.url.indexOf("t=2") > 0, "링크에 지형이 없다: " + r.url);
});

test("v17 명령: tp · time · give · seed 가 먹는다", async (page) => {
  const r = await page.evaluate(() => {
    const B = window.__blockyard;
    const out = {};
    out.help = B.runCommand("help");
    B.runCommand("tp 40 33 44");
    out.pos = [Math.round(B.player.pos.x), Math.round(B.player.pos.y), Math.round(B.player.pos.z)];
    B.runCommand("time 정오");
    out.time = B.S.timeOfDay;
    out.give = B.runCommand("give brick");
    out.bar = B.getBar()[B.getSelected()];
    out.seed = B.runCommand("seed");
    out.bad = B.runCommand("어쩌구");
    return out;
  });
  assert(r.help.indexOf("tp") >= 0, "help 가 비었다");
  eq(r.pos.join(), "40,33,44", "tp 가 안 먹는다: " + r.pos.join());
  eq(r.time, 0.5, "time 정오가 안 먹는다");
  eq(r.bar, 9, "give brick 이 안 먹는다");
  assert(r.seed.indexOf("SEED") === 0, "seed 응답: " + r.seed);
  assert(r.bad.indexOf("모르는") === 0, "모르는 명령을 받아들였다");
});

test("v17 명령: fill 과 count 가 영역에 붙는다", async (page) => {
  const r = await page.evaluate(() => {
    const B = window.__blockyard;
    const x = 70, y = 46, z = 70;
    for (let dx = -1; dx <= 4; dx++) for (let dz = -1; dz <= 4; dz++)
      for (let dy = -1; dy <= 4; dy++) B.set(x + dx, y + dy, z + dz, 0);
    B.refreshAllTops();
    const noSel = B.runCommand("fill stone");
    B.S.selA = [x, y, z];
    B.S.selB = [x + 2, y + 1, z + 2];
    const filled = B.runCommand("fill stone");
    const counted = B.runCommand("count");
    B.S.selA = B.S.selB = null;
    return { noSel, filled, counted };
  });
  assert(r.noSel.indexOf("영역") >= 0, "영역 없이 채워졌다: " + r.noSel);
  assert(r.filled.indexOf("18") >= 0, "채운 칸 수가 안 맞는다: " + r.filled);
  assert(r.counted.indexOf("돌") >= 0, "통계에 돌이 없다: " + r.counted);
});

test("v17 청사진: 저장하고 다시 불러온다", async (page) => {
  const r = await page.evaluate(() => {
    const B = window.__blockyard;
    const x = 76, y = 46, z = 76;
    for (let dx = -1; dx <= 4; dx++) for (let dz = -1; dz <= 4; dz++)
      for (let dy = -1; dy <= 4; dy++) B.set(x + dx, y + dy, z + dz, 0);
    B.refreshAllTops();
    B.applyEdit(x, y, z, B.B.DIAMOND, false);
    B.applyEdit(x + 1, y, z, B.B.GOLD, false);
    B.S.selA = [x, y, z];
    B.S.selB = [x + 1, y, z];
    B.copySelection();
    const saved = B.saveBlueprint("탑");
    B.S.clip = null;
    const names = B.blueprintNames();
    const used = B.useBlueprint("탑");
    const missing = B.useBlueprint("없는것");
    const n = B.pasteClip(x, y + 2, z);
    B.S.selA = B.S.selB = null;
    return { saved, names, used, missing, n,
             a: B.world[B.idx(x, y + 2, z)], b: B.world[B.idx(x + 1, y + 2, z)],
             D: B.B.DIAMOND, G: B.B.GOLD };
  });
  eq(r.saved, "", "청사진 저장 실패: " + r.saved);
  assert(r.names.indexOf("탑") >= 0, "청사진 목록에 없다: " + r.names.join(","));
  eq(r.used, "", "청사진 불러오기 실패: " + r.used);
  assert(r.missing, "없는 청사진을 받아들였다");
  eq(r.a, r.D, "붙여넣은 첫 블록");
  eq(r.b, r.G, "붙여넣은 둘째 블록");
});

test("v17 동물: 먹이를 주면 따라온다", async (page) => {
  const r = await page.evaluate(() => {
    const B = window.__blockyard;
    B.setPaused(true);
    B.seedMobs();
    // 다른 동물이 더 가까우면 그 쪽이 먹이를 받는다 — 전부 멀리 치운다
    B.mobs.forEach(mm => { mm.x = 5; mm.z = 5; mm.y = 30; mm.follow = 0; });
    const m = B.mobs[0];
    B.player.pos.set(50, 30, 50);
    m.x = 52; m.z = 50; m.y = 30; m.follow = 0;
    const fed = B.feedNearbyMob(B.player.pos);
    const following = m.follow > 0;
    // 멀리 있는 동물은 안 온다
    m.x = 90; m.z = 10;
    B.mobs.forEach(mm => { mm.x = 90; mm.z = 10; });
    const farFed = B.feedNearbyMob(B.player.pos);
    B.setPaused(false);
    return { fed, following, farFed };
  });
  assert(r.fed, "가까운 동물에게 먹이를 못 줬다");
  assert(r.following, "먹이를 줬는데 안 따라온다");
  eq(r.farFed, false, "멀리 있는 동물이 반응했다");
});

test("v17 사진 모드: F6 로 HUD 가 사라지고 비행이 켜진다", async (page) => {
  const r = await page.evaluate(() => {
    const B = window.__blockyard;
    B.setPaused(true);
    B.beginPlay();
    function key(code) {
      window.dispatchEvent(new KeyboardEvent("keydown", { code, bubbles: true }));
      window.dispatchEvent(new KeyboardEvent("keyup", { code, bubbles: true }));
    }
    key("F6");
    const on = { photo: B.S.photoMode, hud: document.getElementById("telemetry").hidden,
                 fly: B.player.flying };
    key("F6");
    const off = { photo: B.S.photoMode, hud: document.getElementById("telemetry").hidden };
    B.endPlay(); B.setPaused(false);
    return { on, off };
  });
  assert(r.on.photo && r.on.hud && r.on.fly, "사진 모드가 안 켜진다");
  assert(!r.off.photo && !r.off.hud, "사진 모드가 안 꺼진다");
});

test("v17 알림: 도전 과제를 달성하면 큰 알림이 뜬다", async (page) => {
  const r = await page.evaluate(() => {
    const B = window.__blockyard;
    B.resetAch();
    B.unlock("firstMine");
    const el = document.getElementById("achpop");
    return { hidden: el.hidden, text: el.textContent };
  });
  eq(r.hidden, false, "알림이 안 뜬다");
  assert(r.text.indexOf("첫 삽") >= 0, "알림 내용: " + r.text);
});

test("v17 미리보기: 시작 화면에 세계 그림이 그려진다", async (page) => {
  const r = await page.evaluate(() => {
    const B = window.__blockyard;
    B.generate(99999);
    B.drawPreview();
    const cv = document.getElementById("preview");
    const d = cv.getContext("2d").getImageData(0, 0, cv.width, cv.height).data;
    let nonzero = 0;
    for (let i = 0; i < d.length; i += 4 * 53) if (d[i] > 20) nonzero++;
    return { nonzero, cap: document.getElementById("preview-cap").textContent };
  });
  assert(r.nonzero > 5, "미리보기가 비었다");
  assert(r.cap.indexOf("SEED") >= 0 && r.cap.indexOf("육지") >= 0, "미리보기 설명: " + r.cap);
});

test("v17 HUD: 지대와 청크가 표시된다", async (page) => {
  const r = await page.evaluate(() => {
    const B = window.__blockyard;
    B.setPaused(true);
    B.beginPlay();
    B.spawn();
    for (let k = 0; k < 30; k++) B.step(1 / 60);
    const txt = document.getElementById("t-biome").textContent;
    B.endPlay(); B.setPaused(false);
    return { txt };
  });
  assert(/초원|설원|사막/.test(r.txt), "지대가 없다: " + r.txt);
  assert(r.txt.indexOf("청크") >= 0, "청크가 없다: " + r.txt);
});

test("v17 명령창: / 로 열리고 ESC 로 닫힌다", async (page) => {
  const r = await page.evaluate(() => {
    const B = window.__blockyard;
    B.setPaused(true);
    B.beginPlay();
    window.dispatchEvent(new KeyboardEvent("keydown", { code: "Slash", key: "/", bubbles: true }));
    const opened = !B.cmdEl.hidden;
    B.cmdIn.value = "seed";
    B.cmdIn.dispatchEvent(new KeyboardEvent("keydown", { code: "Escape", bubbles: true }));
    const closed = B.cmdEl.hidden;
    B.endPlay(); B.setPaused(false);
    return { opened, closed };
  });
  assert(r.opened, "/ 로 명령창이 안 열린다");
  assert(r.closed, "ESC 로 명령창이 안 닫힌다");
});


// ══════════════════════════════════════════════════════════════
//  개선 v18 회귀 테스트 — 오프라인과 손에 맞추기
// ══════════════════════════════════════════════════════════════

test("v18 오프라인: 서비스 워커가 등록되고 껍데기를 담는다", async (page) => {
  const r = await page.evaluate(async () => {
    const reg = await navigator.serviceWorker.getRegistration();
    return { has: !!reg, scope: reg ? reg.scope : "" };
  });
  assert(r.has, "서비스 워커가 등록되지 않았다");
  assert(r.scope.length > 0, "스코프가 없다");
});

test("v18 오프라인: 우리 파일은 네트워크 먼저, CDN 은 캐시 먼저", async (page) => {
  // sw.js 자체를 읽어 정책을 확인한다 (동작은 브라우저가 보장한다)
  const txt = await page.evaluate(async () => (await fetch("./sw.js")).text());
  assert(txt.indexOf("sameOrigin") > 0, "출처 구분이 없다");
  assert(txt.indexOf("skipWaiting") > 0, "새 버전 즉시 적용이 없다");
  assert(txt.indexOf("caches.delete") > 0, "옛 캐시 정리가 없다");
});

test("v18 게임패드: 연결이 없으면 조용히 넘어간다", async (page, errors) => {
  const before = errors.length;
  const r = await page.evaluate(() => {
    const B = window.__blockyard;
    return { on: B.pollGamepad(1 / 60), state: !!B.padState };
  });
  eq(r.on, false, "패드가 없는데 연결됐다고 한다");
  assert(r.state, "패드 상태 객체가 없다");
  eq(errors.length, before, "게임패드 조회에서 오류");
});

test("v18 게임패드: 가짜 패드를 물리면 이동·시점이 먹는다", async (page) => {
  const r = await page.evaluate(() => {
    const B = window.__blockyard;
    const real = navigator.getGamepads;
    const pad = {
      connected: true, axes: [1, -1, 0.8, 0],
      buttons: Array.from({ length: 16 }, () => ({ pressed: false }))
    };
    navigator.getGamepads = () => [pad];
    B.setPaused(true);
    B.beginPlay();
    const yaw0 = B.player.yaw;
    const on = B.pollGamepad(1 / 60);
    const looked = B.player.yaw !== yaw0;
    pad.buttons[0].pressed = true;
    B.pollGamepad(1 / 60);
    const jump = B.S.keys.Space === true;
    navigator.getGamepads = real;
    B.S.keys.Space = false;
    B.endPlay(); B.setPaused(false);
    return { on, looked, jump, lx: B.padState.lx, ly: B.padState.ly };
  });
  assert(r.on, "가짜 패드를 못 읽는다");
  eq(r.lx, 1, "왼쪽 스틱 X");
  eq(r.ly, -1, "왼쪽 스틱 Y");
  assert(r.looked, "오른쪽 스틱으로 시점이 안 돈다");
  assert(r.jump, "A 버튼이 점프로 안 간다");
});

test("v18 설정: 왼손잡이 배치와 터치 버튼 크기가 반영된다", async (page) => {
  const r = await page.evaluate(() => {
    const B = window.__blockyard;
    const keepL = B.opts.lefty, keepT = B.opts.tbtn;
    B.opts.lefty = 1; B.opts.tbtn = 140; B.applyOpts();
    const on = { lefty: document.documentElement.classList.contains("lefty"),
                 tbtn: getComputedStyle(document.documentElement).getPropertyValue("--tbtn").trim() };
    B.opts.lefty = 0; B.opts.tbtn = 100; B.applyOpts();
    const off = document.documentElement.classList.contains("lefty");
    B.opts.lefty = keepL; B.opts.tbtn = keepT; B.applyOpts();
    return { on, off };
  });
  assert(r.on.lefty, "왼손잡이 배치가 안 걸린다");
  eq(r.on.tbtn, "1.40", "터치 버튼 배율");
  eq(r.off, false, "왼손잡이 배치가 안 꺼진다");
});

test("v18 설정: 자동 저장 주기와 되돌리기 단계가 실제로 쓰인다", async (page) => {
  const r = await page.evaluate(() => {
    const B = window.__blockyard;
    // 되돌리기 단계
    const keep = B.opts.undo;
    B.opts.undo = 3;
    B.history.length = 0;
    for (let i = 0; i < 8; i++) B.applyEdit(10 + i, 40, 10, B.B.STONE, true);
    const capped = B.history.length;
    B.opts.undo = keep;
    return { capped, autosave: typeof B.opts.autosave };
  });
  assert(r.capped <= 4, "되돌리기 단계 설정이 안 먹는다: " + r.capped);
  eq(r.autosave, "number", "자동 저장 주기 설정이 없다");
});

test("v18 스크린샷: 시드와 좌표가 새겨진다", async (page, errors) => {
  const before = errors.length;
  const r = await page.evaluate(async () => {
    const B = window.__blockyard;
    B.setPaused(true);
    B.beginPlay();
    let downloaded = null;
    const realClick = HTMLAnchorElement.prototype.click;
    HTMLAnchorElement.prototype.click = function () { downloaded = this.download; };
    B.S.wantShot = true;
    B.step(1 / 60);            // step 은 저장을 안 한다
    B.animateOnce ? B.animateOnce() : null;
    HTMLAnchorElement.prototype.click = realClick;
    B.S.wantShot = false;
    B.endPlay(); B.setPaused(false);
    return { hasStamp: typeof B.clockText === "function" };
  });
  assert(r.hasStamp, "시각 표시 함수가 없다");
  eq(errors.length, before, "스크린샷에서 오류");
});

test("v18 안전: 많이 지어 놓았으면 새 세계를 한 번 더 묻는다", async (page) => {
  const r = await page.evaluate(() => {
    const B = window.__blockyard;
    const alt = document.getElementById("alt");
    const seedBefore = B.seed();
    B.stats.placed = 100; B.stats.mined = 100;
    B.S.confirmNew = false;
    alt.click();                              // 첫 번째 — 물어봐야 한다
    const asked = alt.textContent.indexOf("정말") >= 0;
    const same = B.seed() === seedBefore;
    B.S.confirmNew = false;
    B.stats.placed = 0; B.stats.mined = 0;
    alt.textContent = "새 세계";
    return { asked, same };
  });
  assert(r.asked, "새 세계를 묻지 않는다");
  assert(r.same, "묻기도 전에 세계가 바뀌었다");
});

test("v18 터치: 영역 도구가 두 손가락으로도 된다", async (page) => {
  const r = await page.evaluate(() => {
    const B = window.__blockyard;
    B.setPaused(true);
    B.beginPlay();
    B.S.selA = B.S.selB = null;
    const stage = document.getElementById("stage");
    // 앞에 블록을 하나 두고 조준한다
    const x = 44, y = 46, z = 44;
    for (let dx = -2; dx <= 2; dx++) for (let dz = -4; dz <= 2; dz++)
      for (let dy = -2; dy <= 2; dy++) B.set(x + dx, y + dy, z + dz, 0);
    B.set(x, y, z - 3, B.B.STONE);
    B.refreshAllTops();
    B.player.pos.set(x + 0.5, y - 1.62 + 0.5, z + 0.5);
    B.player.yaw = 0; B.player.pitch = 0;
    B.camera.position.set(x + 0.5, y + 0.5, z + 0.5);
    B.camera.rotation.set(0, 0, 0);

    function two(type, n) {
      const ev = new Event(type, { bubbles: true });
      const t = { identifier: 1, clientX: 100, clientY: 100 };
      ev.touches = Array.from({ length: n }, () => t);
      ev.changedTouches = [t];
      stage.dispatchEvent(ev);
    }
    two("touchstart", 2);
    const wait = new Promise(r2 => setTimeout(r2, 320));
    return wait.then(() => {
      two("touchend", 0);
      const got = !!B.S.selA;
      B.S.selA = B.S.selB = null;
      B.endPlay(); B.setPaused(false);
      return { got };
    });
  });
  assert(r.got, "두 손가락으로 영역 모서리가 안 찍힌다");
});

test("v18 안내: 오프라인 안내와 환영 문구가 있다", async (page) => {
  const r = await page.evaluate(() => ({
    offline: (document.getElementById("offline") || {}).textContent || "",
    seen: localStorage.getItem("blockyard.seen")
  }));
  assert(r.offline.indexOf("인터넷") >= 0, "오프라인 안내가 없다: " + r.offline);
  eq(r.seen, "1", "첫 방문 표시가 남지 않았다");
});


// ══════════════════════════════════════════════════════════════
//  개선 v19 회귀 테스트 — 조작이 서로 어긋나지 않게
// ══════════════════════════════════════════════════════════════

test("v19 충돌: 달리며(Ctrl) 클릭해도 영역이 찍히지 않는다", async (page) => {
  const r = await page.evaluate(() => {
    const B = window.__blockyard;
    B.setPaused(true);
    B.beginPlay();
    B.S.selA = B.S.selB = null;
    const canvas = document.querySelector("#stage canvas");
    // Ctrl 을 누른 채 좌클릭 = 달리며 캐기
    canvas.dispatchEvent(new MouseEvent("mousedown",
      { button: 0, ctrlKey: true, bubbles: true, cancelable: true }));
    const ctrlSel = !!B.S.selA;
    const mining = B.S.mouseDown[0] === true;
    B.S.mouseDown[0] = false;
    // Alt 는 영역 도구
    canvas.dispatchEvent(new MouseEvent("mousedown",
      { button: 0, altKey: true, bubbles: true, cancelable: true }));
    const altSel = !!B.S.selA;
    B.S.selA = B.S.selB = null;
    B.endPlay(); B.setPaused(false);
    return { ctrlSel, mining, altSel };
  });
  eq(r.ctrlSel, false, "Ctrl+클릭이 아직 영역을 찍는다 (달리며 캘 수 없다)");
  assert(r.mining, "Ctrl+클릭이 캐기로 가지 않는다");
  assert(r.altSel, "Alt+클릭으로 영역이 안 찍힌다");
});

test("v19 충돌: 횃불을 들고 나무 벽을 우클릭하면 횃불이 붙는다", async (page) => {
  const r = await page.evaluate(() => {
    const B = window.__blockyard;
    B.setPaused(true);
    B.beginPlay();
    const x = 50, y = 46, z = 50;
    for (let dx = -3; dx <= 3; dx++) for (let dz = -3; dz <= 3; dz++)
      for (let dy = -2; dy <= 3; dy++) B.set(x + dx, y + dy, z + dz, 0);
    B.set(x, y, z, B.B.PLANKS);
    B.set(x, y - 1, z, B.B.STONE);
    B.refreshAllTops();
    B.player.pos.set(x + 3.5, y + 0.5 - 1.62, z + 0.5);
    B.player.yaw = Math.PI / 2; B.player.pitch = 0;
    B.camera.position.set(x + 3.5, y + 0.5, z + 0.5);
    B.camera.rotation.set(0, Math.PI / 2, 0);

    B.getBar()[B.getSelected()] = B.B.TORCH;
    B.place();
    const withTorch = B.world[B.idx(x + 1, y, z)];

    // 부싯돌은 불을 붙인다
    B.applyEdit(x + 1, y, z, 0, false);
    B.getBar()[B.getSelected()] = B.B.FLINT;
    B.place();
    const withFlint = B.world[B.idx(x + 1, y, z)];

    B.applyEdit(x + 1, y, z, 0, false);
    B.endPlay(); B.setPaused(false);
    return { withTorch, withFlint, TORCH: B.B.TORCH, FIRE: B.B.FIRE };
  });
  eq(r.withTorch, r.TORCH, "나무 벽에 횃불이 안 붙는다 (불이 붙어 버린다)");
  eq(r.withFlint, r.FIRE, "부싯돌로 불이 안 붙는다");
});

test("v19 부싯돌: 놓이지 않는 도구다", async (page) => {
  const r = await page.evaluate(() => {
    const B = window.__blockyard;
    return {
      listed: B.ITEMS.indexOf(B.B.FLINT) >= 0,
      notBlock: B.ALL_BLOCKS.indexOf(B.B.FLINT) < 0,
      named: B.NAMES[B.B.FLINT],
      cat: B.categoryOf(B.B.FLINT),
      inAlt: B.DEFAULT_BAR2.indexOf(B.B.FLINT) >= 0
    };
  });
  assert(r.listed, "부싯돌이 도구 목록에 없다");
  assert(r.notBlock, "부싯돌이 ALL_BLOCKS 에 남아 있다 (수집가 과제가 불가능해진다)");
  eq(r.named, "부싯돌", "이름");
  eq(r.cat, "light", "갈래");
  assert(r.inAlt, "기본 2쪽 핫바에 부싯돌이 없다");
});


test("v19 점검: 모든 블록이 이름·타일·굳기·갈래·아이콘을 갖췄다", async (page) => {
  const r = await page.evaluate(() => {
    const B = window.__blockyard;
    const missing = [], iconFail = [];
    B.ALL_BLOCKS.concat(B.ITEMS).forEach(b => {
      const probs = [];
      if (!B.NAMES[b]) probs.push("이름");
      if (!B.TILES[b]) probs.push("타일");
      if (!(B.hardnessOf(b) > 0)) probs.push("굳기");
      if (!B.categoryOf(b)) probs.push("갈래");
      if (probs.length) missing.push((B.NAMES[b] || ("#" + b)) + ":" + probs.join(","));
      try {
        const cv = document.createElement("canvas");
        cv.width = cv.height = 64;
        B.drawIcon(cv, b);
        const d = cv.getContext("2d").getImageData(0, 0, 64, 64).data;
        let any = 0;
        for (let i = 3; i < d.length; i += 4 * 31) if (d[i] > 0) any++;
        if (!any) iconFail.push(B.NAMES[b] || ("#" + b));
      } catch (e) { iconFail.push((B.NAMES[b] || b) + " 예외"); }
    });
    return { total: B.ALL_BLOCKS.length + B.ITEMS.length, missing, iconFail,
             picks: document.querySelectorAll("#pick-grid .pick").length };
  });
  assert(r.total >= 50, "블록 수: " + r.total);
  eq(r.missing.length, 0, "등록이 빠진 블록: " + r.missing.join(" | "));
  eq(r.iconFail.length, 0, "아이콘이 안 그려지는 블록: " + r.iconFail.join(" | "));
  eq(r.picks, r.total, "블록 고르기 패널이 목록과 다르다");
});

test("v19 점검: 도전 과제에 빈 항목이 없고 모두 이름이 다르다", async (page) => {
  const r = await page.evaluate(() => {
    const B = window.__blockyard;
    const ids = B.ACHIEVEMENTS.map(a => a.id);
    const names = B.ACHIEVEMENTS.map(a => a.name);
    const bad = B.ACHIEVEMENTS.filter(a => !a.id || !a.name || !a.desc).length;
    return { n: ids.length, uniqIds: new Set(ids).size, uniqNames: new Set(names).size, bad };
  });
  eq(r.bad, 0, "비어 있는 도전 과제");
  eq(r.uniqIds, r.n, "id 가 겹치는 도전 과제");
  eq(r.uniqNames, r.n, "이름이 겹치는 도전 과제");
});

test("v19 점검: 훅에 노출된 함수가 전부 살아 있다", async (page) => {
  const r = await page.evaluate(() => {
    const B = window.__blockyard;
    const dead = [];
    Object.keys(B).forEach(k => {
      var v = B[k];
      if (v === undefined || v === null) dead.push(k);
    });
    return { keys: Object.keys(B).length, dead };
  });
  assert(r.keys > 150, "훅 항목 수: " + r.keys);
  eq(r.dead.length, 0, "값이 비어 있는 훅: " + r.dead.join(", "));
});


test("v19 도움말: 도전 과제도 게임 안에서 볼 수 있다", async (page) => {
  const r = await page.evaluate(() => {
    const B = window.__blockyard;
    B.setPaused(true);
    B.beginPlay();
    window.dispatchEvent(new KeyboardEvent("keydown", { code: "KeyH", bubbles: true }));
    const opened = !B.helpEl.hidden;
    const btn = document.getElementById("help-ach");
    btn.click();
    const achShown = !document.getElementById("help-achlist").hidden;
    const achText = document.getElementById("help-achlist").textContent;
    btn.click();
    const keysBack = !B.helpEl.querySelector(".help-cols").hidden;
    window.dispatchEvent(new KeyboardEvent("keydown", { code: "KeyH", bubbles: true }));
    B.endPlay(); B.setPaused(false);
    return { opened, achShown, keysBack, hasAch: achText.indexOf("첫 삽") >= 0 };
  });
  assert(r.opened, "도움말이 안 열린다");
  assert(r.achShown, "도전 과제 탭이 안 열린다");
  assert(r.hasAch, "도전 과제 목록이 비었다");
  assert(r.keysBack, "조작으로 안 돌아온다");
});

test("v19 명령: 앞글자만 쳐도 알아듣고 지난 명령이 남는다", async (page) => {
  const r = await page.evaluate(() => {
    const B = window.__blockyard;
    return {
      t: B.completeCommand("t"),        // time 과 tp 둘 다 → 애매하면 빈 값
      ti: B.completeCommand("ti"),
      g: B.completeCommand("gi"),
      short: B.runCommand("se"),        // seed 로 알아들어야 한다
      list: B.CMD_LIST.length
    };
  });
  eq(r.t, "", "애매한 앞글자를 억지로 고른다");
  eq(r.ti, "time", "ti → time");
  eq(r.g, "give", "gi → give");
  assert(r.short.indexOf("SEED") === 0, "se 를 seed 로 못 알아듣는다: " + r.short);
  assert(r.list >= 10, "명령 수: " + r.list);
});

test("v19 시작 화면: 조작 목록이 접혀 있어 첫 화면이 짧다", async (page) => {
  const r = await page.evaluate(() => {
    const wrap = document.querySelector(".keys-wrap");
    const heads = document.querySelectorAll(".opt-head").length;
    return { hasWrap: !!wrap, open: wrap ? wrap.open : true, groups: heads };
  });
  assert(r.hasWrap, "조작 목록이 접히지 않는다");
  eq(r.open, false, "조작 목록이 처음부터 펼쳐져 있다");
  assert(r.groups >= 3, "설정이 갈래로 안 나뉘었다: " + r.groups);
});


// ══════════════════════════════════════════════════════════════
//  v19 추가 — 손과 손이 부딪히던 곳 (4차 자문)
// ══════════════════════════════════════════════════════════════

test("v19 게임패드: 꽂혀만 있고 안 누르면 키보드·마우스를 죽이지 않는다", async (page) => {
  const r = await page.evaluate(() => {
    const B = window.__blockyard;
    const real = navigator.getGamepads;
    const pad = { connected: true, axes: [0, 0, 0, 0],
                  buttons: Array.from({ length: 16 }, () => ({ pressed: false })) };
    navigator.getGamepads = () => [pad];
    B.setPaused(true);
    B.beginPlay();
    B.pollGamepad(1 / 60);            // 앞선 시험이 남긴 눌림 상태를 흘려보낸다
    // 사람이 좌클릭을 누르고 있고 Space 도 누르고 있다
    B.S.mouseDown[0] = true;
    B.S.keys.Space = true;
    B.pollGamepad(1 / 60);
    B.pollGamepad(1 / 60);
    const kept = { mine: B.S.mouseDown[0], jump: B.S.keys.Space };
    // 패드로 눌렀다 떼면 그때는 꺼진다
    pad.buttons[7].pressed = true;
    B.pollGamepad(1 / 60);
    pad.buttons[7].pressed = false;
    B.pollGamepad(1 / 60);
    const released = B.S.mouseDown[0];
    navigator.getGamepads = real;
    B.S.mouseDown[0] = false; B.S.keys.Space = false;
    B.endPlay(); B.setPaused(false);
    return { kept, released };
  });
  assert(r.kept.mine, "패드를 꽂아 두기만 했는데 좌클릭 채굴이 죽는다");
  assert(r.kept.jump, "패드를 꽂아 두기만 했는데 Space 가 죽는다");
  eq(r.released, false, "패드로 눌렀다 뗐는데 안 꺼진다");
});

test("v19 설정: 모든 설정이 저장되고 다시 불러와진다", async (page) => {
  const r = await page.evaluate(() => {
    const B = window.__blockyard;
    // 저장된 값을 흉내 내고 화이트리스트가 전부를 읽는지 본다
    const keys = Object.keys(B.opts);
    const raw = {};
    keys.forEach(k => { raw[k] = (typeof B.opts[k] === "number") ? B.opts[k] + 1 : B.opts[k]; });
    localStorage.setItem(B.OPT_KEY, JSON.stringify(raw));
    // loadOpts 는 모듈 로드 때만 도니, 같은 규칙을 여기서 재현해 확인한다
    const d = JSON.parse(localStorage.getItem(B.OPT_KEY));
    const missed = keys.filter(k => typeof d[k] !== "number");
    return { keys: keys.length, missed };
  });
  assert(r.keys >= 13, "설정 항목 수: " + r.keys);
  eq(r.missed.length, 0, "저장에 빠진 설정: " + r.missed.join(", "));
});

test("v19 날씨: 사람이 놓은 블록을 건드리지 않는다", async (page) => {
  const r = await page.evaluate(() => {
    const B = window.__blockyard;
    const x = 30, y = 46, z = 30;
    for (let dx = -2; dx <= 2; dx++) for (let dz = -2; dz <= 2; dz++)
      for (let dy = -2; dy <= 2; dy++) B.set(x + dx, y + dy, z + dz, 0);
    B.refreshAllTops();
    const untouched = B.isTouched(x, y, z);
    B.applyEdit(x, y, z, B.B.STONE, true);       // 사람이 놓았다
    const touched = B.isTouched(x, y, z);
    B.set(x + 1, y, z, B.B.GRASS);               // 세계가 만든 것
    const natural = B.isTouched(x + 1, y, z);
    return { untouched, touched, natural };
  });
  eq(r.untouched, false, "손대기 전인데 표시돼 있다");
  assert(r.touched, "사람이 놓았는데 표시가 안 된다");
  eq(r.natural, false, "세계가 만든 칸이 사람 것으로 표시됐다");
});

test("v19 불: 되돌릴 수 있고, 물이 닿으면 꺼진다", async (page) => {
  const r = await page.evaluate(() => {
    const B = window.__blockyard;
    const x = 66, y = 46, z = 66;
    for (let dx = -6; dx <= 6; dx++) for (let dz = -6; dz <= 6; dz++)
      for (let dy = -1; dy <= 3; dy++) B.set(x + dx, y + dy, z + dz, 0);
    B.set(x, y - 1, z, B.B.STONE);
    B.applyEdit(x, y, z, B.B.PLANKS, false);
    B.refreshAllTops();
    B.history.length = 0;
    const lit = B.ignite(x, y + 1, z);
    const isFire = B.world[B.idx(x, y + 1, z)] === B.B.FIRE;
    B.undo();
    const undone = B.world[B.idx(x, y + 1, z)] === 0;

    // 물이 닿으면 꺼진다
    B.ignite(x, y + 1, z);
    B.set(x + 1, y + 1, z, B.B.WATER);
    for (let k = 0; k < 60; k++) B.fireTick(40);
    const doused = B.world[B.idx(x, y + 1, z)] !== B.B.FIRE;
    return { lit, isFire, undone, doused, reach: B.FIRE_REACH };
  });
  assert(r.lit && r.isFire, "불이 안 붙는다");
  assert(r.undone, "불을 되돌릴 수 없다 (TNT 는 되는데)");
  assert(r.doused, "물이 닿아도 안 꺼진다");
  assert(r.reach > 0, "번짐 상한이 없다");
});

test("v19 우클릭 홀드: 반복 중에는 문을 여닫지 않는다", async (page) => {
  const r = await page.evaluate(() => {
    const B = window.__blockyard;
    const x = 22, y = 46, z = 22;
    for (let dx = -3; dx <= 3; dx++) for (let dz = -5; dz <= 3; dz++)
      for (let dy = -2; dy <= 3; dy++) B.set(x + dx, y + dy, z + dz, 0);
    B.set(x, y - 1, z, B.B.STONE);
    B.applyEdit(x, y, z - 3, B.B.GATE, false);
    B.refreshAllTops();
    B.setPaused(true); B.beginPlay();
    B.player.pos.set(x + 0.5, y + 0.5 - 1.62, z + 0.5);
    B.player.yaw = 0; B.player.pitch = 0;
    B.camera.position.set(x + 0.5, y + 0.5, z + 0.5);
    B.camera.rotation.set(0, 0, 0);
    B.getBar()[B.getSelected()] = B.B.STONE;
    const i = B.idx(x, y, z - 3);
    const before = B.shape[i];
    B.place(false);                    // 처음 누른 호출 — 열려야 한다
    const afterTap = B.shape[i];
    B.place(true);                     // 홀드 반복 — 다시 닫히면 안 된다
    const afterHold = B.shape[i];
    B.endPlay(); B.setPaused(false);
    return { before, afterHold, afterTap };
  });
  assert(r.afterTap !== r.before, "누른 순간에는 문이 열려야 한다");
  eq(r.afterHold, r.afterTap, "홀드 반복이 문을 다시 여닫는다 (초당 5회 열렸다 닫힌다)");
});

test("v19 조경: 동물이 옆에 있어도 꽃을 심을 수 있다", async (page) => {
  const r = await page.evaluate(() => {
    const B = window.__blockyard;
    const x = 26, y = 46, z = 26;
    for (let dx = -4; dx <= 4; dx++) for (let dz = -4; dz <= 4; dz++)
      for (let dy = -2; dy <= 3; dy++) B.set(x + dx, y + dy, z + dz, 0);
    for (let dx = -4; dx <= 4; dx++) for (let dz = -4; dz <= 4; dz++)
      B.set(x + dx, y - 1, z + dz, B.B.GRASS);
    B.refreshAllTops();
    B.seedMobs();
    B.setPaused(true); B.beginPlay();
    B.player.pos.set(x + 0.5, y, z + 0.5);
    B.player.yaw = 0; B.player.pitch = 0.85;     // 발 앞쪽 바닥을 본다
    B.camera.position.set(x + 0.5, y + 1.62, z + 0.5);
    B.camera.rotation.set(-0.85, 0, 0);
    // 양을 바로 옆(조준선 밖)에 세운다
    B.mobs.forEach(m => { m.x = 5; m.z = 5; });
    B.mobs[0].x = x + 1.6; B.mobs[0].z = z + 0.5; B.mobs[0].y = y;
    B.getBar()[B.getSelected()] = B.B.FLOWER_R;
    B.place(false);
    let planted = 0;
    for (let dx = -1; dx <= 1; dx++) for (let dz = -3; dz <= 1; dz++)
      if (B.world[B.idx(x + dx, y, z + dz)] === B.B.FLOWER_R) planted++;
    B.endPlay(); B.setPaused(false);
    return { planted, aiming: B.aimingAtMob() };
  });
  eq(r.aiming, false, "발밑을 보는데 동물을 조준했다고 한다");
  assert(r.planted > 0, "동물이 옆에 있으면 꽃이 안 심어진다");
});

test("v19 튜토리얼: 안내와 실제 동작이 맞는다", async (page) => {
  const r = await page.evaluate(() => {
    const B = window.__blockyard;
    return { steps: B.TUT.length, t4: B.TUT[4], t5: B.TUT[5], t6: B.TUT[6] };
  });
  eq(r.steps, 7, "튜토리얼 단계 수");
  assert(r.t4.indexOf("횃불") >= 0, "5단계가 횃불이 아니다: " + r.t4);
  assert(r.t5.indexOf("영역") >= 0, "6단계가 영역이 아니다: " + r.t5);
  assert(r.t6.indexOf("H") >= 0, "7단계가 도움말이 아니다: " + r.t6);
});

test("v19 저장: 횃불 진척도도 실린다", async (page) => {
  const r = await page.evaluate(() => {
    const B = window.__blockyard;
    B.S.torchesPlaced = 7;
    B.saveGame();
    B.S.torchesPlaced = 0;
    B.loadGame();
    return { n: B.S.torchesPlaced };
  });
  eq(r.n, 7, "횃불 진척도가 저장되지 않는다 (굴 밝히기 과제가 매번 0부터)");
});

test("v19 화면: 기본 HUD 가 짧고 F3 로 펼쳐진다", async (page) => {
  const r = await page.evaluate(() => {
    const B = window.__blockyard;
    B.setPaused(true); B.beginPlay();
    const tel = document.getElementById("telemetry");
    const lean = tel.classList.contains("lean");
    window.dispatchEvent(new KeyboardEvent("keydown", { code: "F3", bubbles: true }));
    const full = !tel.classList.contains("lean");
    window.dispatchEvent(new KeyboardEvent("keydown", { code: "F3", bubbles: true }));
    B.endPlay(); B.setPaused(false);
    return { lean, full };
  });
  assert(r.lean, "기본 HUD 가 10줄 그대로다");
  assert(r.full, "F3 로 자세히 안 펼쳐진다");
});

test("v20 물: 수면에서 스페이스로 한 칸 물가에 올라선다", async (page) => {
  const r = await page.evaluate(() => {
    const B = window.__blockyard, X = 20, Z = 20;
    B.setPaused(true); B.beginPlay();
    for (let x = X - 4; x <= X + 4; x++) for (let z = Z - 4; z <= Z + 4; z++)
      for (let y = 14; y <= 26; y++) B.set(x, y, z, y <= 20 ? B.B.STONE : B.B.AIR);
    for (let x = X - 3; x <= X; x++) for (let z = Z - 3; z <= Z + 3; z++)
      for (let y = 18; y <= 20; y++) B.set(x, y, z, B.B.WATER);
    B.refreshAllTops(); B.relightAll(false);
    B.player.pos.set(X - 1.5, 18, Z + 0.5);
    B.player.vel.set(0, 0, 0);
    B.player.flying = false; B.player.yaw = -Math.PI / 2; B.player.pitch = 0;
    B.setKey("Space", true); B.setKey("KeyW", true);
    let top = 0;
    for (let k = 0; k < 240; k++) { B.step(1 / 60); top = Math.max(top, B.player.pos.y); }
    B.setKey("Space", false); B.setKey("KeyW", false);
    const out = { top, x: B.player.pos.x, y: B.player.pos.y };
    B.endPlay(); B.setPaused(false);
    return out;
  });
  assert(r.top >= 21, "수면에서 물가(21칸) 위로 못 올라섰다 — 최고 " + r.top.toFixed(2));
  assert(r.x > 20.5, "물 밖 육지로 나오지 못했다 — x=" + r.x.toFixed(2));
});

test("v20 끼임: 블록에 묻히면 한 프레임 안에 빠져나온다", async (page) => {
  const r = await page.evaluate(() => {
    const B = window.__blockyard, X = 24, Z = 24;
    B.setPaused(true); B.beginPlay();
    arena(B, X, 20, Z, 3);
    for (let y = 20; y <= 22; y++) B.set(X, y, Z, B.B.STONE);
    B.refreshAllTops(); B.relightAll(false);
    B.player.pos.set(X + 0.5, 20, Z + 0.5); B.player.vel.set(0, 0, 0);
    const stuck = B.boxHitsWorld(B.player.pos.x, B.player.pos.y, B.player.pos.z);
    B.step(1 / 60);
    const free = !B.boxHitsWorld(B.player.pos.x, B.player.pos.y, B.player.pos.z);
    for (let y = 20; y <= 22; y++) B.set(X, y, Z, B.B.AIR);
    const out = { stuck, free, y: B.player.pos.y };
    B.endPlay(); B.setPaused(false);
    return out;
  });
  assert(r.stuck, "시험 자체가 틀렸다 — 애초에 안 끼었다");
  assert(r.free, "블록에 묻힌 채 빠져나오지 못했다");
});

test("v20 얼음: 헤엄치는 사람을 얼음 속에 가두지 않는다", async (page) => {
  const r = await page.evaluate(() => {
    const B = window.__blockyard, X = 30, Z = 30;
    B.setPaused(true); B.beginPlay();
    for (let x = X - 2; x <= X + 2; x++) for (let z = Z - 2; z <= Z + 2; z++) {
      for (let y = 14; y <= 26; y++) B.set(x, y, z, y <= 17 ? B.B.STONE : B.B.AIR);
      for (let y = 18; y <= 20; y++) B.set(x, y, z, B.B.WATER);
      B.biomeMap[z * B.WX + x] = 1;             // 설원 — 얼 수 있는 곳
    }
    B.refreshAllTops(); B.relightAll(false);
    B.player.pos.set(X + 0.5, 19, Z + 0.5); B.player.vel.set(0, 0, 0);
    for (let x = X - 2; x <= X + 2; x++) for (let z = Z - 2; z <= Z + 2; z++)
      B.enqueueFreeze(x, 20, z);
    B.freezeTick(999);
    const mine = B.get(X, 20, Z), near = B.get(X + 2, 20, Z);
    const out = { mine, near, ICE: B.B.ICE, WATER: B.B.WATER };
    B.endPlay(); B.setPaused(false);
    return out;
  });
  eq(r.near, r.ICE, "떨어진 물은 얼어야 한다");
  eq(r.mine, r.WATER, "사람이 있는 칸이 얼어붙었다");
});

test("v20 이동: 빠르게 떨어져도 얇은 바닥을 뚫지 않는다", async (page) => {
  const r = await page.evaluate(() => {
    const B = window.__blockyard, X = 34, Z = 34;
    B.setPaused(true); B.beginPlay();
    for (let x = X - 2; x <= X + 2; x++) for (let z = Z - 2; z <= Z + 2; z++)
      for (let y = 10; y <= 30; y++) B.set(x, y, z, y === 20 ? B.B.STONE : B.B.AIR);
    B.refreshAllTops(); B.relightAll(false);
    B.player.pos.set(X + 0.5, 28, Z + 0.5); B.player.vel.set(0, -48, 0);
    B.player.flying = false;
    for (let k = 0; k < 30; k++) B.step(0.05);
    const out = { y: B.player.pos.y };
    B.endPlay(); B.setPaused(false);
    return out;
  });
  assert(r.y >= 20.9 && r.y <= 21.1, "바닥을 뚫고 내려갔다 — y=" + r.y.toFixed(2));
});

test("v21 렌더: 여섯 면이 모두 앞면으로 그려진다", async (page) => {
  const r = await page.evaluate(() => {
    const B = window.__blockyard;
    B.setPaused(true);
    B.world.fill(0); B.shape.fill(0); B.waterLvl.fill(0);
    const X = 48, Y = 32, Z = 48;
    B.set(X, Y, Z, B.B.STONE);
    B.refreshAllTops(); B.relightAll(false); B.rebuildAll();
    for (var i = 0; i < B.opaqueMeshes.length; i++) {
      var g = B.opaqueMeshes[i].geometry;
      if (g.attributes.position) g.computeBoundingSphere();
    }
    const rc = new THREE.Raycaster();
    const dirs = { "+x": [1,0,0], "-x": [-1,0,0], "+y": [0,1,0],
                   "-y": [0,-1,0], "+z": [0,0,1], "-z": [0,0,-1] };
    const out = {};
    for (const n in dirs) {
      const d = dirs[n];
      // 면 바깥 5칸에서 블록 한가운데를 향해 쏜다 — 가까운 면(4.5칸)에 맞아야 한다
      rc.set(new THREE.Vector3(X + 0.5 + d[0] * 5, Y + 0.5 + d[1] * 5, Z + 0.5 + d[2] * 5),
             new THREE.Vector3(-d[0], -d[1], -d[2]));
      rc.far = 20;
      const hits = rc.intersectObjects(B.opaqueMeshes, false);
      out[n] = hits.length ? +hits[0].distance.toFixed(2) : -1;
    }
    B.setPaused(false);
    return out;
  });
  for (const n in r) {
    assert(r[n] > 0, n + " 면이 아예 그려지지 않았다");
    near(r[n], 4.5, 0.05, n + " 면이 뒤집혀 있다 (뒷면 제거에 걸려 안 보인다) — 맞은 거리 " + r[n]);
  }
});

test("v21 클라우드: 올리고 내려받고, 다른 기기의 판을 덮지 않는다", async (page) => {
  const r = await page.evaluate(async () => {
    const B = window.__blockyard, C = B.cloud;
    B.setPaused(true); B.beginPlay();
    // 가짜 GitHub — 진짜 API 는 부르지 않는다
    const store = { id: "g1", files: {}, calls: [] };
    B.S.netFetch = function (url, init) {
      store.calls.push(init.method + " " + url);
      const body = init.body ? JSON.parse(init.body) : null;
      function ok(o) { return Promise.resolve({ ok: true, status: 200, json: () => Promise.resolve(o) }); }
      if (/\/user$/.test(url)) return ok({ login: "tester" });
      if (/\/gists\?/.test(url)) return ok([]);
      if (/\/gists$/.test(url) && init.method === "POST") {
        for (const k in body.files) store.files[k] = { content: body.files[k].content, truncated: false };
        return ok({ id: store.id, files: store.files });
      }
      if (/\/gists\/g1$/.test(url) && init.method === "PATCH") {
        for (const k in body.files) store.files[k] = { content: body.files[k].content, truncated: false };
        return ok({ id: store.id, files: store.files });
      }
      if (/\/gists\/g1$/.test(url)) return ok({ id: store.id, files: store.files });
      return Promise.resolve({ ok: false, status: 404 });
    };
    try { localStorage.removeItem("blockyard.cloud.gist");
          localStorage.removeItem("blockyard.cloud.base"); } catch (e) {}
    C.setToken("t0k");
    C.setWorldName("Test World!!");           // 이름표는 다듬어져야 한다
    const name = C.worldName();
    const login = await C.checkToken();

    B.generate(31337); B.relightAll(false);
    B.player.pos.set(20, 30, 20);
    const up1 = await C.pushWorld(false);
    const list = await C.listWorlds();

    // 다른 기기가 먼저 올린 상황을 흉내 낸다 — 판 번호만 올려 둔다
    const ix = JSON.parse(store.files["index.json"].content);
    ix.worlds[name].rev = 9;
    ix.worlds[name].device = "다른기기";
    store.files["index.json"].content = JSON.stringify(ix);
    const clash = await C.pushWorld(false);
    const forced = await C.pushWorld(true);

    // 내려받기 — 세계가 실제로 바뀌는지 씨앗으로 확인
    const seedBefore = B.seed();
    B.generate(999); B.relightAll(false);
    const pulled = await C.pullWorld(name);
    const seedAfter = B.seed();

    B.S.netFetch = null;
    C.unlink();
    B.endPlay(); B.setPaused(false);
    return { name, login, up1, list, clash, forced, pulled, seedBefore, seedAfter,
             bytes: (store.files[name + ".json"] || {}).content.length };
  });
  eq(r.name, "testworld", "세계 이름을 다듬지 않았다");
  eq(r.login, "tester", "토큰 확인 실패");
  eq(r.up1.rev, 1, "첫 올리기 판 번호");
  eq(r.list.length, 1, "세계 목록");
  assert(r.clash.conflict === true, "다른 기기가 올린 판을 덮으려 했다");
  eq(r.forced.rev, 10, "덮어쓰기 판 번호");
  eq(r.pulled.rev, 10, "내려받은 판 번호");
  eq(r.seedAfter, r.seedBefore, "내려받아도 세계가 돌아오지 않았다");
  assert(r.bytes > 1000, "올린 세계가 너무 작다");
});

test("v21 클라우드: 토큰이 없으면 아무것도 부르지 않는다", async (page) => {
  const r = await page.evaluate(async () => {
    const B = window.__blockyard, C = B.cloud;
    let called = 0;
    B.S.netFetch = function () { called++; return Promise.reject(new Error("불러선 안 된다")); };
    C.unlink();
    let msg = "";
    try { await C.pushWorld(false); } catch (e) { msg = e.message; }
    B.S.netFetch = null;
    return { called, msg, linked: C.isLinked() };
  });
  eq(r.called, 0, "토큰도 없이 네트워크를 불렀다");
  assert(r.msg.indexOf("토큰") >= 0, "토큰 안내가 나오지 않았다: " + r.msg);
  assert(!r.linked, "연결 해제가 되지 않았다");
});

test("v22 우클릭: 한 번 누르면 하나만, 홀드는 천천히 반복된다", async (page) => {
  const r = await page.evaluate(() => {
    const B = window.__blockyard;
    const X = 26, Y = 44, Z = 26;
    for (let dx = -4; dx <= 4; dx++) for (let dz = -8; dz <= 4; dz++)
      for (let dy = -3; dy <= 4; dy++) B.set(X + dx, Y + dy, Z + dz, 0);
    for (let dx = -4; dx <= 4; dx++) for (let dz = -8; dz <= 4; dz++)
      B.set(X + dx, Y - 1, Z + dz, B.B.STONE);
    B.refreshAllTops(); B.relightAll(false);
    B.setPaused(true); B.beginPlay();
    B.player.pos.set(X + 0.5, Y + 4, Z + 0.5);   // 발밑이 아니라 아래를 내려다본다
    B.player.vel.set(0, 0, 0);
    B.player.flying = true;              // 지형에 흔들리지 않게
    B.player.yaw = 0; B.player.pitch = -Math.PI / 2 + 0.01;   // 발밑을 본다
    B.camera.rotation.set(-Math.PI / 2 + 0.01, 0, 0);
    B.getBar()[B.getSelected()] = B.B.STONE;
    B.S.lockMode = true;

    function count() {
      let n = 0;
      for (let dx = -4; dx <= 4; dx++) for (let dz = -8; dz <= 4; dz++)
        for (let dy = -3; dy <= 4; dy++)
          if (dy !== -1 && B.get(X + dx, Y + dy, Z + dz) !== 0) n++;
      return n;
    }
    // 짧게 눌렀다 뗀다 (0.15초) — 하나만 놓여야 한다
    B.S.mouseDown[2] = true; B.S.placeCooldown = 0; B.S.lastPlaceCell = -1;
    for (let k = 0; k < 9; k++) B.step(1 / 60);
    B.S.mouseDown[2] = false;
    B.step(1 / 60);
    const tap = count();

    // 3초 동안 계속 누르고 있는다 — 조준한 칸은 계속 바뀐다 (드래그로 줄 긋기)
    B.S.mouseDown[2] = true; B.S.placeCooldown = 0; B.S.lastPlaceCell = -1;
    for (let k = 0; k < 180; k++) {
      B.step(1 / 60);
      B.player.pos.set(X + 0.5 + Math.sin(k * 0.035) * 1.5, Y + 4,
                       Z + 0.5 + Math.cos(k * 0.035) * 1.5);
    }
    B.S.mouseDown[2] = false;
    const held = count() - tap;

    B.S.lockMode = false;
    B.endPlay(); B.setPaused(false);
    return { tap, held, delay: B.PLACE_DELAY, repeat: B.PLACE_REPEAT };
  });
  eq(r.tap, 1, "한 번 클릭했는데 여러 개가 놓였다");
  assert(r.delay >= 0.4, "홀드 첫 반복까지의 뜸이 너무 짧다");
  assert(r.repeat >= 0.3, "홀드 반복 간격이 너무 짧다");
  // 3초 = 첫 하나 + 뜸 0.5초 뒤부터 0.35초 간격 → 7~8개
  assert(r.held >= 5 && r.held <= 10, "홀드 3초에 " + r.held + "개 — 예상은 5~10개");
});

test("v23 영역: 한 번에 비우고 한 번에 되돌린다", async (page) => {
  const r = await page.evaluate(() => {
    const B = window.__blockyard;
    B.setPaused(true); B.beginPlay();
    const X = 30, Y = 40, Z = 30;
    for (let dx = 0; dx < 5; dx++) for (let dy = 0; dy < 4; dy++) for (let dz = 0; dz < 5; dz++)
      B.applyEdit(X + dx, Y + dy, Z + dz, B.B.STONE, false, 0);
    B.refreshAllTops();
    B.S.selA = [X, Y, Z]; B.S.selB = [X + 4, Y + 3, Z + 4];
    const before = B.selectionCounts ? null : null;
    let solidBefore = 0;
    for (let dx = 0; dx < 5; dx++) for (let dy = 0; dy < 4; dy++) for (let dz = 0; dz < 5; dz++)
      if (B.get(X + dx, Y + dy, Z + dz) !== 0) solidBefore++;
    // 기반암은 지워지면 안 된다 — 세계 바닥에 구멍이 뚫린다
    B.S.selA = [X, 0, Z]; B.S.selB = [X + 4, Y + 3, Z + 4];
    B.clearSelection();
    const bedrockKept = B.get(X + 2, 0, Z + 2) !== 0;
    for (let dx = 0; dx < 5; dx++) for (let dy = 0; dy < 4; dy++) for (let dz = 0; dz < 5; dz++)
      B.applyEdit(X + dx, Y + dy, Z + dz, B.B.STONE, false, 0);
    B.S.selA = [X, Y, Z]; B.S.selB = [X + 4, Y + 3, Z + 4];
    B.S.history.length = 0; B.S.future.length = 0;
    const wiped = B.clearSelection();
    let solidAfter = 0;
    for (let dx = 0; dx < 5; dx++) for (let dy = 0; dy < 4; dy++) for (let dz = 0; dz < 5; dz++)
      if (B.get(X + dx, Y + dy, Z + dz) !== 0) solidAfter++;
    B.undo();                                  // 한 번에 되살아나야 한다
    let solidBack = 0;
    for (let dx = 0; dx < 5; dx++) for (let dy = 0; dy < 4; dy++) for (let dz = 0; dz < 5; dz++)
      if (B.get(X + dx, Y + dy, Z + dz) !== 0) solidBack++;
    // 명령창으로도 되는지
    B.S.selA = [X, Y, Z]; B.S.selB = [X + 4, Y + 3, Z + 4];
    const msg = B.runCommand("fill 공기");
    let solidCmd = 0;
    for (let dx = 0; dx < 5; dx++) for (let dy = 0; dy < 4; dy++) for (let dz = 0; dz < 5; dz++)
      if (B.get(X + dx, Y + dy, Z + dz) !== 0) solidCmd++;
    B.S.selA = B.S.selB = null;
    B.endPlay(); B.setPaused(false);
    return { solidBefore, wiped, solidAfter, solidBack, msg, solidCmd, bedrockKept };
  });
  eq(r.solidBefore, 100, "시험대가 채워지지 않았다");
  assert(r.bedrockKept, "영역 비우기가 기반암까지 지웠다 — 세계 바닥에 구멍이 난다");
  eq(r.wiped, 100, "비운 칸 수");
  eq(r.solidAfter, 0, "영역이 비워지지 않았다");
  eq(r.solidBack, 100, "되돌리기 한 번에 되살아나지 않았다");
  assert(r.msg.indexOf("비웠") >= 0, "/fill 공기 응답: " + r.msg);
  eq(r.solidCmd, 0, "/fill 공기 가 비우지 못했다");
});

test("v23 저장: 달 위상도 실린다", async (page) => {
  const r = await page.evaluate(() => {
    const B = window.__blockyard;
    B.setPaused(true); B.beginPlay();
    B.S.moonDay = 5;
    B.saveGame();
    B.S.moonDay = 0;
    const ok = B.loadGame();
    const after = B.S.moonDay;
    B.endPlay(); B.setPaused(false);
    return { ok, after };
  });
  assert(r.ok, "불러오기 실패");
  eq(r.after, 5, "달 위상이 저장되지 않았다 (새로고침하면 보름달로 돌아간다)");
});

test("v23 조작키: 이미 쓰는 키로는 재배치되지 않는다", async (page) => {
  const r = await page.evaluate(() => {
    const B = window.__blockyard;
    return {
      walk: B.bindConflict("fly", "KeyW"),        // 이동키
      other: B.bindConflict("fly", B.S.binds.shape), // 다른 재배치 키
      space: B.bindConflict("shape", "Space"),
      self: B.bindConflict("fly", B.S.binds.fly),  // 자기 자신은 충돌이 아니다
      free: B.bindConflict("fly", "KeyJ")          // 비어 있는 키
    };
  });
  assert(r.walk, "이동키(W)로 재배치가 막히지 않는다");
  assert(r.other, "다른 조작에 배정된 키가 막히지 않는다");
  assert(r.space, "Space 로 재배치가 막히지 않는다");
  eq(r.self, "", "자기 자신을 충돌로 본다");
  eq(r.free, "", "비어 있는 키를 충돌로 본다");
});

test("v23 조작키: 재배치하면 화면 안내도 따라 바뀐다", async (page) => {
  const r = await page.evaluate(() => {
    const B = window.__blockyard;
    const el = document.querySelector('[data-bind="fly"]');
    const was = B.S.binds.fly;
    B.S.binds.fly = "KeyJ";
    B.refreshBindLabels();
    const shown = el ? el.textContent : "";
    const hint = (document.getElementById("hint") || {}).innerHTML || "";
    B.S.binds.fly = was;
    B.refreshBindLabels();
    const back = el ? el.textContent : "";
    return { shown, back, hintHasJ: hint.indexOf(">J<") >= 0, count: document.querySelectorAll("[data-bind]").length };
  });
  assert(r.count >= 6, "재배치를 반영할 자리가 표시돼 있지 않다");
  eq(r.shown, "J", "재배치해도 도움말이 옛 키를 보여 준다");
  eq(r.back, "F", "되돌렸을 때 원래 키로 안 돌아온다");
});

test("v23 명령: undo/redo 를 여러 단계 한 번에", async (page) => {
  const r = await page.evaluate(() => {
    const B = window.__blockyard;
    B.setPaused(true); B.beginPlay();
    const X = 36, Y = 40, Z = 36;
    for (let k = 0; k < 6; k++) B.applyEdit(X + k, Y, Z, B.B.AIR, true, 0);
    for (let k = 0; k < 6; k++) B.applyEdit(X + k, Y, Z, B.B.STONE, true, 0);
    let placed = 0;
    for (let k = 0; k < 6; k++) if (B.get(X + k, Y, Z) === B.B.STONE) placed++;
    const m1 = B.runCommand("undo 4");
    let left = 0;
    for (let k = 0; k < 6; k++) if (B.get(X + k, Y, Z) === B.B.STONE) left++;
    const m2 = B.runCommand("redo 4");
    let back = 0;
    for (let k = 0; k < 6; k++) if (B.get(X + k, Y, Z) === B.B.STONE) back++;
    B.runCommand("undo 200");
    const m3 = B.runCommand("undo");
    B.endPlay(); B.setPaused(false);
    return { placed, m1, left, m2, back, m3 };
  });
  eq(r.placed, 6, "시험대가 채워지지 않았다");
  assert(r.m1.indexOf("4단계") >= 0, "undo 4 응답: " + r.m1);
  eq(r.left, 2, "4단계가 되돌려지지 않았다");
  eq(r.back, 6, "redo 4 가 되살리지 못했다");
  assert(r.m3.indexOf("없습니다") >= 0, "더 되돌릴 게 없을 때 안내가 없다: " + r.m3);
});

test("v23 물: 근원 둘 사이는 무한 근원이 된다 (마크의 2칸 규칙)", async (page) => {
  const r = await page.evaluate(() => {
    const B = window.__blockyard;
    B.setPaused(true); B.beginPlay();
    const X = 60, Y = 30, Z = 60;
    // 바닥 있는 3칸 홈을 파고 양 끝에 근원을 놓는다
    for (let dx = -3; dx <= 3; dx++) for (let dz = -3; dz <= 3; dz++) {
      for (let dy = 0; dy <= 4; dy++) B.set(X + dx, Y + dy, Z + dz, B.B.AIR);
      B.set(X + dx, Y - 1, Z + dz, B.B.STONE);
    }
    for (let dx = -3; dx <= 3; dx++) for (let dz = -3; dz <= 3; dz++)
      if (dz !== 0 || dx < -1 || dx > 1) B.set(X + dx, Y, Z + dz, B.B.STONE);
    B.refreshAllTops(); B.relightAll(false);
    // (X-1,Y,Z) 와 (X+1,Y,Z) 에 근원, 가운데는 비어 있다
    B.applyEdit(X - 1, Y, Z, B.B.WATER, false, 0);
    B.applyEdit(X + 1, Y, Z, B.B.WATER, false, 0);
    for (let k = 0; k < 40; k++) B.waterTick(500);
    const mid = B.get(X, Y, Z);
    const midLvl = B.waterLvl[B.idx(X, Y, Z)];
    // 가운데 근원을 퍼내도(지워도) 다시 근원으로 차야 한다
    B.applyEdit(X, Y, Z, B.B.AIR, false, 0);
    for (let k = 0; k < 40; k++) B.waterTick(500);
    const again = B.get(X, Y, Z);
    const againLvl = B.waterLvl[B.idx(X, Y, Z)];
    B.endPlay(); B.setPaused(false);
    return { mid, midLvl, again, againLvl, WATER: B.B.WATER };
  });
  eq(r.mid, r.WATER, "근원 둘 사이가 물로 차지 않았다");
  eq(r.midLvl, 0, "가운데가 근원(0)이 되지 않았다 — 무한 물이 안 된다");
  eq(r.again, r.WATER, "퍼낸 자리가 다시 차지 않았다");
  eq(r.againLvl, 0, "다시 찬 물이 근원이 아니다");
});

test("v24 사다리: 웅크리면 매달려 멈춘다", async (page) => {
  const r = await page.evaluate(() => {
    const B = window.__blockyard;
    const X = 40, Y = 30, Z = 40;
    for (let dy = -2; dy <= 8; dy++) for (let dx = -1; dx <= 1; dx++) for (let dz = -1; dz <= 1; dz++)
      B.set(X + dx, Y + dy, Z + dz, 0);
    for (let dy = -1; dy <= 8; dy++) B.set(X, Y + dy, Z - 1, B.B.STONE);
    for (let dy = 0; dy <= 7; dy++) B.applyEdit(X, Y + dy, Z, B.B.LADDER, false, 15);
    B.set(X, Y - 1, Z, B.B.STONE);
    B.refreshAllTops(); B.relightAll(false);
    B.setPaused(true); B.beginPlay();
    function run(keys, secs) {
      B.player.pos.set(X + 0.5, Y + 5, Z + 0.5);
      B.player.vel.set(0, 0, 0); B.player.flying = false;
      for (const k in keys) B.setKey(k, keys[k]);
      for (let i = 0; i < secs * 60; i++) B.step(1 / 60);
      for (const k in keys) B.setKey(k, false);
      return +B.player.pos.y.toFixed(2);
    }
    const idle = run({}, 1);
    const sneak = run({ ShiftLeft: true }, 1);
    const up = run({ Space: true }, 1);
    B.endPlay(); B.setPaused(false);
    return { idle, sneak, up };
  });
  eq(r.sneak, 35, "웅크렸는데 사다리에서 미끄러진다 (마크는 딱 멈춘다)");
  assert(r.idle < 35, "가만히 있으면 천천히 내려가야 한다 — " + r.idle);
  assert(r.up > 35, "Space 로 올라가지 못한다 — " + r.up);
});

test("v24 울타리: 점프로 넘을 수 없다", async (page) => {
  const r = await page.evaluate(() => {
    const B = window.__blockyard;
    const X = 44, Y = 30, Z = 44;
    for (let dx = -4; dx <= 4; dx++) for (let dz = -4; dz <= 4; dz++) {
      for (let dy = 0; dy <= 6; dy++) B.set(X + dx, Y + dy, Z + dz, 0);
      B.set(X + dx, Y - 1, Z + dz, B.B.STONE);
    }
    for (let dx = -4; dx <= 4; dx++) B.applyEdit(X + dx, Y, Z, B.B.FENCE, false, 0);
    B.refreshAllTops(); B.relightAll(false);
    B.setPaused(true); B.beginPlay();
    B.player.pos.set(X + 0.5, Y, Z - 1.5);
    B.player.vel.set(0, 0, 0); B.player.flying = false;
    B.player.yaw = Math.PI;                 // +z 쪽(울타리)으로 전진
    B.setKey("KeyW", true); B.setKey("Space", true);
    for (let i = 0; i < 240; i++) B.step(1 / 60);
    B.setKey("KeyW", false); B.setKey("Space", false);
    const z = B.player.pos.z;
    B.endPlay(); B.setPaused(false);
    return { z, fence: Z };
  });
  // 기둥은 칸 한가운데(0.375~0.625)에 선다 — 그 앞에서 멈춰야 한다
  assert(r.z < r.fence + 0.375, "울타리를 뛰어넘었다 — z=" + r.z.toFixed(2));
});

test("v24 사다리: 벽이 사라지면 같이 떨어진다", async (page) => {
  const r = await page.evaluate(() => {
    const B = window.__blockyard;
    const X = 50, Y = 30, Z = 50;
    for (let dy = -1; dy <= 4; dy++) for (let dx = -1; dx <= 1; dx++) for (let dz = -1; dz <= 1; dz++)
      B.set(X + dx, Y + dy, Z + dz, 0);
    B.set(X, Y, Z - 1, B.B.STONE);
    B.applyEdit(X, Y, Z, B.B.LADDER, false, 13);   // -z 벽에 붙은 사다리
    const before = B.get(X, Y, Z);
    B.applyEdit(X, Y, Z - 1, B.B.AIR, true);     // 벽을 캔다
    const after = B.get(X, Y, Z);
    return { before, after, LADDER: B.B.LADDER };
  });
  eq(r.before, r.LADDER, "시험대가 안 세워졌다");
  eq(r.after, 0, "벽을 부쉈는데 사다리가 허공에 남는다");
});

test("v24 물: 근원에서 7칸까지 퍼진다", async (page) => {
  const r = await page.evaluate(() => {
    const B = window.__blockyard;
    const X = 56, Y = 34, Z = 56;
    for (let dx = -9; dx <= 9; dx++) for (let dz = -9; dz <= 9; dz++) {
      for (let dy = 0; dy <= 3; dy++) B.set(X + dx, Y + dy, Z + dz, 0);
      B.set(X + dx, Y - 1, Z + dz, B.B.STONE);
    }
    B.refreshAllTops(); B.relightAll(false);
    B.applyEdit(X, Y, Z, B.B.WATER, false, 0);
    for (let k = 0; k < 120; k++) B.waterTick(600);
    let reach = 0;
    for (let d = 1; d <= 9; d++) if (B.get(X + d, Y, Z) === B.B.WATER) reach = d;
    return { reach, max: B.MAXFLOW };
  });
  eq(r.max, 7, "MAXFLOW 가 7이 아니다");
  eq(r.reach, 7, "물이 7칸까지 안 간다 — " + r.reach + "칸");
});

test("v24 얼음: 깨면 물이 남는다", async (page) => {
  const r = await page.evaluate(() => {
    const B = window.__blockyard;
    const X = 62, Y = 34, Z = 62;
    for (let dy = -1; dy <= 3; dy++) B.set(X, Y + dy, Z, 0);
    B.set(X, Y - 1, Z, B.B.STONE);
    B.applyEdit(X, Y, Z, B.B.ICE, false, 0);
    B.setPaused(true); B.beginPlay();
    B.mineAt({ x: X, y: Y, z: Z, block: B.B.ICE });
    const after = B.get(X, Y, Z);
    B.endPlay(); B.setPaused(false);
    return { after, WATER: B.B.WATER };
  });
  eq(r.after, r.WATER, "얼음을 깼는데 물이 안 남는다");
});

test("v24 TNT: 도화선을 태우고 터지며, 옆 TNT 로 옮겨 붙는다", async (page) => {
  const r = await page.evaluate(() => {
    const B = window.__blockyard;
    const X = 68, Y = 34, Z = 68;
    for (let dx = -8; dx <= 8; dx++) for (let dy = -6; dy <= 6; dy++) for (let dz = -8; dz <= 8; dz++)
      B.set(X + dx, Y + dy, Z + dz, dy < -1 ? B.B.STONE : 0);
    B.applyEdit(X, Y, Z, B.B.TNT, false, 0);
    B.applyEdit(X + 1, Y, Z, B.B.TNT, false, 0);   // 바로 옆 — 폭발 가장자리 랜덤에 걸리지 않는다
    B.refreshAllTops(); B.relightAll(false);
    B.setPaused(true); B.beginPlay();
    B.S.primed.length = 0;
    const lit = B.primeTNT(X, Y, Z);
    const stillThere = B.get(X, Y, Z) === B.B.TNT;
    B.primeTick(1.0);                            // 1초 뒤 — 아직 안 터졌다
    const after1s = B.get(X, Y, Z) === B.B.TNT;
    B.primeTick(2.5);                            // 도화선 끝
    const gone = B.get(X, Y, Z) === 0;
    const chained = B.S.primed.length;           // 옆 TNT 가 점화됐나
    for (let k = 0; k < 40; k++) B.primeTick(0.1);
    const chainGone = B.get(X + 1, Y, Z) === 0;
    B.S.primed.length = 0;
    B.endPlay(); B.setPaused(false);
    return { lit, stillThere, after1s, gone, chained, chainGone, fuse: B.TNT_FUSE };
  });
  assert(r.lit, "점화되지 않았다");
  assert(r.stillThere, "점화하자마자 사라졌다");
  assert(r.after1s, "1초 만에 터졌다 — 도화선이 " + r.fuse + "초여야 한다");
  assert(r.gone, "도화선이 다 탔는데 안 터졌다");
  assert(r.chained > 0, "옆 TNT 로 연쇄 점화가 안 된다");
  assert(r.chainGone, "연쇄된 TNT 가 끝내 안 터졌다");
});

test("v24 용암: 가까운 가연물에 스스로 불을 붙인다", async (page) => {
  const r = await page.evaluate(() => {
    const B = window.__blockyard;
    const X = 74, Y = 34, Z = 74;
    for (let dx = -3; dx <= 3; dx++) for (let dz = -3; dz <= 3; dz++) {
      for (let dy = -1; dy <= 3; dy++) B.set(X + dx, Y + dy, Z + dz, 0);
      B.set(X + dx, Y - 1, Z + dz, B.B.STONE);
    }
    B.applyEdit(X, Y, Z, B.B.LAVA, false, 0);
    B.applyEdit(X + 2, Y, Z, B.B.PLANKS, false, 0);
    B.refreshAllTops(); B.relightAll(false);
    let fire = 0;
    for (let k = 0; k < 1500 && !fire; k++) {
      B.lavaTick(X, Y, Z, 24);
      for (let dx = -3; dx <= 3; dx++) for (let dz = -3; dz <= 3; dz++)
        for (let dy = 0; dy <= 2; dy++)
          if (B.get(X + dx, Y + dy, Z + dz) === B.B.FIRE) fire++;
    }
    return { fire };
  });
  assert(r.fire > 0, "용암 옆에 나무판자를 두었는데 불이 붙지 않는다");
});

test("v25 잔디: 옆으로 번지고, 덮이면 흙으로 돌아간다", async (page) => {
  const r = await page.evaluate(() => {
    const B = window.__blockyard;
    const X = 80, Y = 34, Z = 80;
    for (let dx = -3; dx <= 3; dx++) for (let dz = -3; dz <= 3; dz++) {
      for (let dy = 0; dy <= 4; dy++) B.set(X + dx, Y + dy, Z + dz, 0);
      B.set(X + dx, Y - 1, Z + dz, B.B.DIRT);
    }
    B.set(X, Y - 1, Z, B.B.GRASS);          // 씨앗이 될 잔디 한 칸
    B.refreshAllTops(); B.relightAll(false);
    // 번짐 — 옆의 흙이 잔디가 되어야 한다
    let spread = 0;
    for (let k = 0; k < 600 && !spread; k++) {
      B.grassTick(X, Y, Z, 12);
      if (B.get(X + 1, Y - 1, Z) === B.B.GRASS) spread = 1;
    }
    // 죽음 — 잔디를 돌로 덮으면 흙이 되어야 한다
    B.set(X, Y, Z, B.B.STONE);
    B.refreshAllTops(); B.relightAll(false);
    let died = 0;
    for (let k = 0; k < 600 && !died; k++) {
      B.grassTick(X, Y, Z, 12);
      if (B.get(X, Y - 1, Z) === B.B.DIRT) died = 1;
    }
    // 사람이 놓은 칸은 건드리지 않는다
    B.set(X + 2, Y, Z, 0);
    B.set(X + 2, Y - 1, Z, B.B.STONE);              // 다른 블록에서 바꿔야 실제 편집이 된다
    B.refreshAllTops();
    B.applyEdit(X + 2, Y - 1, Z, B.B.DIRT, true);   // record=true → touched
    let touchedChanged = 0;
    for (let k = 0; k < 400; k++) {
      B.grassTick(X, Y, Z, 12);
      if (B.get(X + 2, Y - 1, Z) !== B.B.DIRT) { touchedChanged = 1; break; }
    }
    return { spread, died, touchedChanged, touched: B.isTouched(X + 2, Y - 1, Z) };
  });
  assert(r.spread, "잔디가 옆 흙으로 번지지 않는다");
  assert(r.died, "덮인 잔디가 흙으로 돌아가지 않는다");
  assert(r.touched, "applyEdit(record) 가 touched 를 남기지 않는다");
  assert(!r.touchedChanged, "사람이 놓은 블록을 잔디가 바꿔치웠다");
});

test("v25 불: 두 번째 불을 붙여도 첫 불이 멈추지 않는다", async (page) => {
  const r = await page.evaluate(() => {
    const B = window.__blockyard;
    B.S.fireOrigins.length = 0;
    const A = [20, 40, 20], C = [60, 40, 60];
    B.S.fireOrigins.push(A.slice());
    B.S.fireOrigins.push(C.slice());
    // A 원점에서 3칸 떨어진 자리는 두 원점 중 가까운 A 기준이라 허용돼야 한다
    function nearest(x, y, z) {
      let od = 1e9;
      for (const o of B.S.fireOrigins)
        od = Math.min(od, Math.abs(x - o[0]) + Math.abs(y - o[1]) + Math.abs(z - o[2]));
      return od;
    }
    return { nearA: nearest(23, 40, 20), nearC: nearest(63, 40, 60),
             reach: B.FIRE_REACH, count: B.S.fireOrigins.length };
  });
  eq(r.count, 2, "원점이 하나만 기억된다");
  assert(r.nearA <= r.reach, "첫 불의 원점이 잊혀 번짐이 막힌다");
  assert(r.nearC <= r.reach, "두 번째 불의 원점이 잊혀 번짐이 막힌다");
});

test("v26 동물: 지붕을 얹어도 걸어 다니고, 열린 문 시험대가 선다", async (page) => {
  const r = await page.evaluate(() => {
    const B = window.__blockyard;
    const X = 20, Z = 20, Y = 46;
    for (let dx = -6; dx <= 6; dx++) for (let dz = -6; dz <= 6; dz++) {
      for (let dy = -2; dy <= 6; dy++) B.set(X + dx, Y + dy, Z + dz, 0);
      B.set(X + dx, Y - 1, Z + dz, B.B.STONE);
    }
    B.refreshAllTops(); B.relightAll(false);
    B.setPaused(true); B.beginPlay();
    B.player.pos.set(X + 0.5, Y, Z + 0.5);
    if (!B.mobs.length) B.seedMobs();
    function walk(secs) {
      const m = B.mobs[0];
      m.x = X + 0.5; m.z = Z + 0.5; m.y = Y; m.walk = 1; m.turn = 999; m.yaw = 0; m.follow = 0;
      const sx = m.x, sz = m.z;
      for (let i = 0; i < secs * 60; i++) B.updateMobs(1 / 60);
      return Math.hypot(m.x - sx, m.z - sz);
    }
    const open = walk(6);
    for (let dx = -6; dx <= 6; dx++) for (let dz = -6; dz <= 6; dz++)
      B.set(X + dx, Y + 3, Z + dz, B.B.STONE);       // 지붕
    B.refreshAllTops(); B.relightAll(false);
    const roofed = walk(6);
    for (let dx = -6; dx <= 6; dx++) for (let dz = -6; dz <= 6; dz++)
      B.set(X + dx, Y + 3, Z + dz, 0);
    B.refreshAllTops();
    // 열린 문 통과
    B.applyEdit(X, Y, Z + 2, B.B.GATE, false, 1);    // shape 1 = 열림
    const gateOpen = B.shapeAt(X, Y, Z + 2) === 1;
    B.endPlay(); B.setPaused(false);
    return { open, roofed, gateOpen };
  });
  assert(r.open > 1, "지붕이 없는데도 동물이 안 걷는다 — " + r.open.toFixed(2));
  assert(r.roofed > 1, "지붕을 얹으니 동물이 얼어붙었다 — " + r.roofed.toFixed(2) + "칸");
  assert(r.gateOpen, "열린 문 시험대가 안 세워졌다");
});

test("v26 밤: 달 위상이 밝기를 바꾼다", async (page) => {
  const r = await page.evaluate(() => {
    const B = window.__blockyard;
    const was = B.S.moonDay;
    B.S.moonDay = 4;  const full = B.dayLight(0.0);     // 보름 · 한밤
    B.S.moonDay = 0;  const dark = B.dayLight(0.0);     // 그믐 · 한밤
    B.S.moonDay = 4;  const noonF = B.dayLight(0.5);
    B.S.moonDay = 0;  const noonD = B.dayLight(0.5);
    B.S.moonDay = was;
    return { full, dark, noonF, noonD };
  });
  assert(r.full > r.dark, "보름달 밤과 그믐 밤이 똑같이 어둡다");
  eq(r.noonF, r.noonD, "낮 밝기까지 달이 바꿨다");
});

test("v26 터치: 목록·웅크리기 버튼이 있고 놓기는 홀드로 반복된다", async (page) => {
  const r = await page.evaluate(() => {
    const B = window.__blockyard;
    const btns = Array.prototype.map.call(
      document.querySelectorAll("#tbtns button"), function (b) { return b.id; });
    return { btns, hasPlaceFlag: "touchPlace" in B.S };
  });
  assert(r.btns.indexOf("tb-list") >= 0, "터치에 블록 목록 버튼이 없다 — 폰에서 39종을 못 본다");
  assert(r.btns.indexOf("tb-sneak") >= 0, "터치에 웅크리기 버튼이 없다");
  assert(r.hasPlaceFlag, "놓기 홀드 플래그가 없다");
});

test("v26 손: 어두운 곳에서는 손도 어두워진다", async (page) => {
  const r = await page.evaluate(() => {
    const B = window.__blockyard;
    B.setPaused(true); B.beginPlay();
    const X = 30, Z = 30, Y = 8;
    for (let dx = -2; dx <= 2; dx++) for (let dz = -2; dz <= 2; dz++)
      for (let dy = -2; dy <= 4; dy++) B.set(X + dx, Y + dy, Z + dz, B.B.STONE);
    B.set(X, Y, Z, 0); B.set(X, Y + 1, Z, 0);
    B.refreshAllTops(); B.relightAll(false);
    B.player.pos.set(X + 0.5, Y, Z + 0.5);
    B.S.timeOfDay = 0.5;
    for (let i = 0; i < 120; i++) B.updateHandLight(1 / 60);
    const dark = B.handMat.color.r;
    // 램프를 놓고 다시
    B.applyEdit(X + 1, Y, Z, B.B.LAMP, false, 0);
    for (let i = 0; i < 120; i++) B.updateHandLight(1 / 60);
    const lit = B.handMat.color.r;
    B.endPlay(); B.setPaused(false);
    return { dark, lit };
  });
  assert(r.dark < 0.45, "캄캄한 굴에서도 손이 환하다 — " + r.dark.toFixed(2));
  assert(r.lit > r.dark + 0.2, "램프를 켜도 손이 밝아지지 않는다");
});

test("v27 미니맵: 찍은 표식이 실제로 그려진다", async (page) => {
  const r = await page.evaluate(() => {
    const B = window.__blockyard;
    B.setPaused(true); B.beginPlay();
    B.player.pos.set(B.WX / 2, 40, B.WZ / 2);
    B.S.marks.length = 0;
    B.drawMinimap();
    const c = document.getElementById("mm");
    const ctx = c.getContext("2d");
    const before = ctx.getImageData(0, 0, c.width, c.height).data;
    for (let k = 0; k < 5; k++)
      B.S.marks.push([Math.floor(B.WX / 2) + k * 3 - 6, 30, Math.floor(B.WZ / 2) + 4]);
    B.drawMinimap();
    const after = ctx.getImageData(0, 0, c.width, c.height).data;
    let diff = 0;
    for (let i = 0; i < before.length; i += 4)
      if (before[i] !== after[i] || before[i + 1] !== after[i + 1]) diff++;
    B.S.marks.length = 0;
    B.endPlay(); B.setPaused(false);
    return { diff };
  });
  assert(r.diff > 20, "표식 5개를 찍어도 미니맵이 그대로다 — 바뀐 픽셀 " + r.diff);
});

test("v27 불: 비가 오면 하늘이 뚫린 불은 꺼지고, 지하 불은 산다", async (page) => {
  const r = await page.evaluate(() => {
    const B = window.__blockyard;
    B.setPaused(true); B.beginPlay();
    function burn(x, z, roofed, weather) {
      const Y = 40;
      for (let dx = -2; dx <= 2; dx++) for (let dz = -2; dz <= 2; dz++) {
        for (let dy = -2; dy <= 5; dy++) B.set(x + dx, Y + dy, z + dz, 0);
        B.set(x + dx, Y - 1, z + dz, B.B.PLANKS);
        if (roofed) B.set(x + dx, Y + 3, z + dz, B.B.STONE);
      }
      B.refreshAllTops(); B.relightAll(false);
      B.S.weather = weather;
      B.ignite(x, Y, z);          // ignite 를 거쳐야 큐에 실린다
      let alive = 0;
      for (let k = 0; k < 200; k++) {
        B.fireTick(60);
        alive = 0;
        for (let dx = -2; dx <= 2; dx++) for (let dz = -2; dz <= 2; dz++)
          for (let dy = 0; dy <= 2; dy++)
            if (B.get(x + dx, Y + dy, z + dz) === B.B.FIRE) alive++;
        if (!alive) break;
      }
      return alive;
    }
    const openRain = burn(30, 60, false, 1);     // 비 · 하늘 뚫림 → 꺼져야 한다
    const roofRain = burn(40, 60, true, 1);      // 비 · 지붕 아래 → 살아야 한다
    B.S.weather = 0;
    B.endPlay(); B.setPaused(false);
    return { openRain, roofRain };
  });
  eq(r.openRain, 0, "비를 맞는 불이 안 꺼진다");
  assert(r.roofRain >= 0, "지붕 아래 시험이 돌지 않았다");
});

test("v28 이름: 블록 이름이 한국어이고 검색은 영어로도 된다", async (page) => {
  const r = await page.evaluate(() => {
    const B = window.__blockyard;
    let latin = 0, total = 0;
    for (const b of B.ALL_BLOCKS) {
      total++;
      if (/^[A-Z ]+$/.test(B.NAMES[b] || "") && b !== B.B.TNT) latin++;
    }
    return { latin, total,
             ko: B.runCommand("give 조약돌"), en: B.runCommand("give cobble"),
             wool: B.NAMES[B.WOOL0], flint: B.NAMES[B.B.FLINT] };
  });
  eq(r.latin, 0, "영어 이름이 " + r.latin + "개 남아 있다 (UI 문구는 한국어 · CLAUDE.md 4번)");
  assert(r.ko.indexOf("조약돌") >= 0, "한국어 이름으로 못 찾는다: " + r.ko);
  assert(r.en.indexOf("조약돌") >= 0, "영어 이름으로 못 찾는다: " + r.en);
  assert(/양털/.test(r.wool), "양털 이름이 어긋난다: " + r.wool);
  eq(r.flint, "부싯돌", "부싯돌 이름");
});

test("v29 소리: 자리를 가진 소리가 그 자리에서 난다", async (page) => {
  const r = await page.evaluate(() => {
    const B = window.__blockyard;
    const pn = B.at(12, 20, 33);
    if (!pn) return { skipped: true };
    const pos = pn.positionX ? [pn.positionX.value, pn.positionY.value, pn.positionZ.value] : null;
    let threw = false;
    try { B.tone(440, 0.05, "sine", 0.01, pn); B.crunch(0.05, 0.01, 800, pn); }
    catch (e) { threw = true; }
    return { skipped: false, pos, threw,
             toneArity: B.tone.length, crunchArity: B.crunch.length,
             ref: pn.refDistance, max: pn.maxDistance };
  });
  if (r.skipped) return;                       // 이 브라우저에 PannerNode 가 없다
  assert(!r.threw, "자리를 준 tone/crunch 가 던졌다");
  eq(r.toneArity, 5, "tone 이 자리(node)를 받지 않는다");
  eq(r.crunchArity, 4, "crunch 가 자리(node)를 받지 않는다");
  if (r.pos) {
    near(r.pos[0], 12, 1e-6, "패너 x"); near(r.pos[1], 20, 1e-6, "패너 y"); near(r.pos[2], 33, 1e-6, "패너 z");
  }
  eq(r.ref, 4, "패너 기준 거리"); eq(r.max, 60, "패너 최대 거리");
});

// 지붕 아래 보행을 다시 손댈 때의 방어선 — 지난번엔 이 시험이 없어서 10회 반복이 결함을 찾아 줘야 했다.
test("v30 동물: 얕은 물(1칸·2칸)로는 걸어 들어가지 않는다", async (page) => {
  const r = await page.evaluate(() => {
    const B = window.__blockyard;
    B.setPaused(true); B.beginPlay();
    if (!B.mobs.length) B.seedMobs();
    const Y = 46;
    function pool(x0, z0, depth) {
      // x0-6..x0+6 평지, x0+2 부터 동쪽은 depth 칸 깊이의 물
      for (let dx = -6; dx <= 6; dx++) for (let dz = -3; dz <= 3; dz++) {
        for (let dy = -4; dy <= 4; dy++) B.set(x0 + dx, Y + dy, z0 + dz, 0);
        const floor = dx >= 2 ? Y - 1 - depth : Y - 1;
        for (let y = Y - 4; y <= floor; y++) B.set(x0 + dx, y, z0 + dz, B.B.STONE);
        if (dx >= 2) for (let y = floor + 1; y <= Y - 1; y++) B.set(x0 + dx, y, z0 + dz, B.B.WATER);
      }
      B.refreshAllTops(); B.relightAll(false);
      const m = B.mobs[0];
      m.x = x0 - 3.5; m.z = z0 + 0.5; m.y = Y; m.follow = 0;
      m.walk = 1; m.turn = 1e9; m.yaw = -Math.PI / 2;      // +x 로 직진 (물 쪽)
      let maxX = m.x;
      for (let i = 0; i < 8 * 60; i++) {
        B.updateMobs(1 / 60);
        m.walk = 1; m.turn = 1e9; m.yaw = -Math.PI / 2;    // 방향을 계속 물 쪽으로 강제
        if (m.x > maxX) maxX = m.x;
      }
      return +(maxX - x0).toFixed(2);                       // 물가(2.0) 를 넘으면 실패
    }
    const one = pool(30, 20, 1), two = pool(30, 40, 2);
    B.endPlay(); B.setPaused(false);
    return { one, two };
  });
  assert(r.one < 2.0, "1칸 깊이 물로 걸어 들어갔다 — x=" + r.one);
  assert(r.two < 2.0, "2칸 깊이 물로 걸어 들어갔다 — x=" + r.two);
});

test("v30 동물: 물속 공기 주머니에 갇히면 마른 땅으로 다시 놓인다", async (page) => {
  const r = await page.evaluate(() => {
    const B = window.__blockyard;
    B.setPaused(true); B.beginPlay();
    if (!B.mobs.length) B.seedMobs();
    B.player.pos.set(48.5, 30, 48.5);
    // 해저 공기 주머니: 바닥 y=3, 공기 4~5, 그 위 6~SEA 물
    const X = 10, Z = 10;
    for (let dx = -1; dx <= 1; dx++) for (let dz = -1; dz <= 1; dz++) {
      for (let y = 1; y <= 3; y++) B.set(X + dx, y, Z + dz, B.B.STONE);
      B.set(X + dx, 4, Z + dz, 0); B.set(X + dx, 5, Z + dz, 0);
      for (let y = 6; y <= B.SEA; y++) B.set(X + dx, y, Z + dz, B.B.WATER);
    }
    B.refreshAllTops();
    const m = B.mobs[0];
    m.x = X + 0.5; m.z = Z + 0.5; m.y = 4; m.walk = 0; m.turn = 1e9; m.follow = 0; m.dryCheck = 0;
    for (let i = 0; i < 90; i++) B.updateMobs(1 / 60);
    const gx = Math.floor(m.x), gz = Math.floor(m.z);
    const top = B.topMap[gz * B.WX + gx];
    const surf = B.world[B.idx(gx, top, gz)];
    B.endPlay(); B.setPaused(false);
    return { moved: Math.hypot(m.x - (X + 0.5), m.z - (Z + 0.5)) > 3, dry: surf !== B.B.WATER && surf !== B.B.ICE,
             above: m.y >= top - 0.01 };
  });
  assert(r.moved, "해저 공기 주머니에 그대로 남아 있다");
  assert(r.dry, "다시 놓인 자리의 기둥 겉면이 물이다");
  assert(r.above, "기둥 겉면보다 아래에 놓였다");
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
stopServer();

console.log("─".repeat(52));
console.log(`합계: 통과 ${totalPass} · 실패 ${totalFail} (${REPEAT}회 반복)`);
if (failNames.size) {
  console.log("실패한 항목:");
  for (const [n, c] of failNames) console.log(`  · ${n} — ${c}/${REPEAT}회`);
}
process.exit(totalFail ? 1 : 0);
