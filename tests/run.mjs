// Blockyard 회귀 테스트 스위트
import { launch, openGame, stopServer, assert, eq, near } from "./harness.mjs";

const REPEAT = Math.max(1, parseInt(process.argv[2] || "1", 10));
const FILTER = process.argv[3] || "";

const T = [];
const test = (name, fn) => T.push({ name, fn });
// 폰 화면(844×390 · isMobile)에서만 도는 시험. 데스크톱 폭에서는 절대 안 나는 것들이 있다 —
// 잘려서 못 누르는 단추, 터치로 도달 못 하는 튜토리얼, 터치에만 없는 조작.
const PT = [];
const phoneTest = (name, fn) => PT.push({ name: "폰 · " + name, fn });

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
    // 상한은 world.js 의 lavaTop() 이 정본이다 — 지하 두께를 따라간다(v80).
    // 숫자를 여기 또 적으면 판이 늘 때마다 어긋난다.
    const top = B.lavaTop();
    let count = 0, lit = 0, deep = 0, maxY = -1, meanLand = 0, nLand = 0;
    for (let i = 0; i < B.N; i++) {
      if (B.world[i] !== B.B.LAVA) continue;
      count++;
      const y = Math.floor(i / (B.WX * B.WZ));
      if (y <= top) deep++;
      if (y > maxY) maxY = y;
      if (B.lightBlk[i] >= 14) lit++;
    }
    for (let z = 0; z < B.WZ; z++) for (let x = 0; x < B.WX; x++) {
      const h = B.heightMap[z * B.WX + x];
      if (h > B.SEA) { meanLand += h; nLand++; }
    }
    return { count, lit, deep, maxY, top, meanLand: nLand ? meanLand / nLand : 0,
             solid: B.isSolid(B.B.LAVA), liquid: B.isLiquid(B.B.LAVA) };
  });
  assert(r.count > 50, "용암이 너무 적다: " + r.count);
  eq(r.deep, r.count, "용암이 상한(y<=" + r.top + ") 밖에도 생겼다 — 최대 y " + r.maxY);
  // 지표에서 한참 아래여야 한다 — 걸어 다니다 발밑에서 용암을 만나면 안 된다
  assert(r.maxY <= r.meanLand - 10,
     "용암이 뭍 평균 높이(" + r.meanLand.toFixed(1) + ") 바로 아래 " + r.maxY + " 까지 올라왔다");
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

test("v6 세계: 높이 64 를 하늘과 지하가 나눠 쓴다", async (page) => {
  const r = await page.evaluate(() => {
    const B = window.__blockyard;
    B.generate(31337);
    let sum = 0, n = 0, peak = 0;
    for (let z = 0; z < B.WZ; z++) for (let x = 0; x < B.WX; x++) {
      const h = B.heightMap[z * B.WX + x];
      if (h > peak) peak = h;
      if (h > B.SEA) { sum += h; n++; }
    }
    return { WY: B.WY, SEA: B.SEA, GEN: B.GEN, peak,
             headroom: B.WY - B.SEA, meanLand: n ? sum / n : 0 };
  });
  eq(r.WY, 64, "세계 높이");
  eq(r.GEN, 2, "새로 만든 세계인데 지형 판이 " + r.GEN + " 이다");
  // 지하 — 지표에서 기반암까지. v78 까지는 13~15칸뿐이라 깊이가 보상이 못 됐다
  assert(r.meanLand >= 22,
     "뭍 평균 높이가 " + r.meanLand.toFixed(1) + "칸 — 지하가 그만큼밖에 안 된다");
  // 하늘 — 가장 높은 봉우리 위로도 지을 자리가 남아야 한다
  assert(r.WY - r.peak >= 12,
     "최고봉 " + r.peak + " 위로 " + (r.WY - r.peak) + "칸뿐 — 산 위에 지을 데가 없다");
  assert(r.headroom > 35, "해수면 위 여유: " + r.headroom);
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
    B.S.thirdPerson = 0;      // 3인칭인 채로 두고 가면 뒤 시험이 몸을 본다 (v92)
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
    // 천장 숫자는 world.js 의 oreCeil() 에서 읽는다 — 두 군데에 적으면 반드시 어긋난다
    const c = B.oreCeil();
    let gold = 0, dia = 0, iron = 0, coal = 0;
    let goldDeep = 0, diaDeep = 0, ironDeep = 0;
    let maxGoldY = -1, maxDiaY = -1, maxIronY = -1, coalHigh = 0;
    for (let y = 1; y < B.WY; y++) for (let z = 0; z < B.WZ; z++) for (let x = 0; x < B.WX; x++) {
      const b = B.world[B.idx(x, y, z)];
      if (b === B.B.GOLD) { gold++; if (y <= c.gold) goldDeep++; if (y > maxGoldY) maxGoldY = y; }
      else if (b === B.B.DIAMOND) { dia++; if (y <= c.dia) diaDeep++; if (y > maxDiaY) maxDiaY = y; }
      else if (b === B.B.IRON) { iron++; if (y <= c.iron) ironDeep++; if (y > maxIronY) maxIronY = y; }
      else if (b === B.B.COAL) { coal++; if (y > c.iron) coalHigh++; }
    }
    return { gold, dia, iron, coal, goldDeep, diaDeep, ironDeep,
             maxGoldY, maxDiaY, maxIronY, coalHigh, c, SEA: B.SEA };
  });
  assert(r.gold > 0, "금이 없다");
  assert(r.dia > 0, "다이아가 없다");
  assert(r.dia < r.gold && r.gold < r.coal, `귀한 순서가 뒤집혔다 — 다이아 ${r.dia} · 금 ${r.gold} · 석탄 ${r.coal}`);
  eq(r.goldDeep, r.gold, "금이 y>" + r.c.gold + " 에도 났다 (최대 " + r.maxGoldY + ")");
  eq(r.diaDeep, r.dia, "다이아가 y>" + r.c.dia + " 에도 났다 (최대 " + r.maxDiaY + ")");
  // 철은 광맥이 커서(3~8칸) 랜덤워크가 씨앗 위로 한두 칸 삐져 나온다 — 사다리만 본다
  assert(r.maxIronY <= r.c.iron + 4,
     "철이 y=" + r.maxIronY + " 까지 났다 — 천장 " + r.c.iron + " 에서 너무 멀다");
  assert(r.ironDeep >= r.iron * 0.97,
     "철의 " + Math.round((1 - r.ironDeep / r.iron) * 100) + "% 가 천장 위에 있다");
  // 사다리의 윗칸 — 철 천장 위에서는 석탄만 난다. 그게 "내려갈수록 좋아진다" 의 실체다
  assert(r.coalHigh > 0,
     "철 천장(y=" + r.c.iron + ") 위에 석탄이 하나도 없다 — 얕은 곳에 캘 것이 없다");
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

test("v11 날씨: 서서히 짙어지고, 뇌우면 번개가 친다", async (page) => {
  const r = await page.evaluate(() => {
    const B = window.__blockyard;
    B.setPaused(true);
    B.setWeather(1);
    B.S.weatherMix = 0;
    B.updateWeather(1 / 60);
    const first = B.S.weatherMix;
    for (let k = 0; k < 200; k++) B.updateWeather(1 / 60);
    const settled = B.S.weatherMix;
    // 천둥 — v92 부터 비 셋 중 하나만 뇌우다. 여기서는 뇌우로 못 박고 잰다
    B.S.thundery = 1;
    B.S.stormTimer = 0; B.S.flash = 0;
    B.updateStorm(1 / 60);
    const flashed = B.S.flash;
    B.S.bolt = 0; B.boltMesh.visible = false;
    B.setWeather(0);
    for (let k = 0; k < 400; k++) B.updateWeather(1 / 60);
    const cleared = B.S.weatherMix;
    B.setPaused(false);
    return { first, settled, flashed, cleared };
  });
  assert(r.first < 0.2, "날씨가 한 프레임에 최대로 켜졌다: " + r.first.toFixed(3));
  assert(r.settled > 0.8, "날씨가 짙어지지 않았다: " + r.settled.toFixed(3));
  assert(r.flashed > 0, "뇌우인데 번개가 안 친다");
  assert(r.cleared < 0.2, "날씨가 걷히지 않았다: " + r.cleared.toFixed(3));
});

test("v11 눈: 눈이 오면 지표에 쌓인다", async (page) => {
  const r = await page.evaluate(() => {
    const B = window.__blockyard;
    B.setPaused(true);
    B.generate(99999); B.relightAll(false);
    // 초원 한복판을 찾는다 — "첫 번째 풀칸" 이 아니라 **눈이 쌓일 칸이 가장 많은** 자리다.
    // 첫 칸을 집으면 숲 가장자리나 물가가 걸려 쌓일 곳이 27칸뿐인 자리에서 확률로 실패했다.
    function targetsAt(cx, cz) {
      let n = 0;
      for (let dx = -16; dx <= 16; dx += 2) for (let dz = -16; dz <= 16; dz += 2) {
        const x = cx + dx, z = cz + dz;
        if (x < 0 || x >= B.WX || z < 0 || z >= B.WZ) continue;
        const ty = B.topMap[z * B.WX + x], tb = B.world[B.idx(x, ty, z)];
        if ((tb === B.B.GRASS || tb === B.B.DIRT) && B.get(x, ty + 1, z) === B.B.AIR) n++;
      }
      return n;
    }
    let gx = -1, gz = -1, best = -1;
    for (let z = 20; z < B.WZ - 20; z += 4) for (let x = 20; x < B.WX - 20; x += 4) {
      if (B.biomeMap[z * B.WX + x] !== 0) continue;
      if (B.world[B.idx(x, B.topMap[z * B.WX + x], z)] !== B.B.GRASS) continue;
      const n = targetsAt(x, z);
      if (n > best) { best = n; gx = x; gz = z; }
    }
    if (gx < 0) return { skip: true };
    B.beginPlay();
    // 자리는 beginPlay 뒤에 잡는다 — 첫 beginPlay 는 savedPos 로 사람을 옮긴다
    B.player.pos.set(gx + 0.5, B.topMap[gz * B.WX + gx] + 2, gz + 0.5);
    B.setWeather(2);
    B.S.weatherMix = 1;
    // 눈은 ±16 안에서 무작위로 찍어 쌓는다. 고른 자리가 숲·물가면 찍을 곳이 없어
    // 확률로 실패한다 — 쌓일 수 있는 칸이 충분한지 시험대에서 먼저 못 박는다
    let before = 0, targets = 0;
    for (let dx = -16; dx <= 16; dx++) for (let dz = -16; dz <= 16; dz++) {
      const x = gx + dx, z = gz + dz;
      if (x < 0 || x >= B.WX || z < 0 || z >= B.WZ) continue;
      const ty = B.topMap[z * B.WX + x];
      const tb = B.world[B.idx(x, ty, z)];
      if (tb === B.B.SNOW) before++;
      if ((tb === B.B.GRASS || tb === B.B.DIRT) && B.get(x, ty + 1, z) === B.B.AIR) targets++;
    }
    for (let k = 0; k < 900; k++) { B.S.weatherMix = 1; B.step(1 / 60); }
    let after = 0;
    for (let dx = -16; dx <= 16; dx++) for (let dz = -16; dz <= 16; dz++) {
      const x = gx + dx, z = gz + dz;
      if (x < 0 || x >= B.WX || z < 0 || z >= B.WZ) continue;
      if (B.world[B.idx(x, B.topMap[z * B.WX + x], z)] === B.B.SNOW) after++;
    }
    B.setWeather(0); B.endPlay(); B.setPaused(false);
    return { before, after, targets };
  });
  if (r.skip) return;
  assert(r.targets > 50, `시험대가 잘못 섰다 — 눈이 쌓일 수 있는 칸이 ${r.targets}개뿐이다 (99999 시드의 초원 최대는 86)`);
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
    B.S.weather = 0;          // 비가 오면 하늘 뚫린 불은 꺼진다(v27) — 이 시험은 날씨와 무관해야 한다
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
    // seedMobs 는 모자란 만큼만 채운다 — 앞선 시험이 번식으로 24마리를 남겨 두면
    // 여기서도 24마리가 1200프레임을 돌아 물가에 닿을 확률이 껑충 뛴다 (10회 중 1회 실패)
    B.mobs.length = 0;
    B.seedMobs();
    for (let k = 0; k < 1200; k++) B.updateMobs(1 / 60);
    // v42 에서 "발목 물은 좌초가 아니다" 로 정했다 — 마크의 소도 얕은 물에 서 있고,
    // 우리 안 물구유 하나로 동물이 튀어 나가면 목장을 지을 수가 없다.
    // 그래서 여기서 보는 것은 "바다 위를 걸어 다니는가"(몸이 잠겼는가)다.
    let wet = 0;
    B.mobs.forEach(m => {
      const x = Math.floor(m.x), z = Math.floor(m.z);
      if (x < 0 || x >= B.WX || z < 0 || z >= B.WZ) return;
      const gy = B.topMap[z * B.WX + x];
      const top = B.world[B.idx(x, gy, z)];
      // 기둥 겉면이 물·용암·얼음이고 그 아래에 몸이 있다 = 물속 (mobs.js strandedAt 과 같은 잣대)
      // **"바다 위를 걷는가"** 만 본다 — 물가에 발목이 잠긴 것은 좌초가 아니다(v42).
      // 예전 잣대는 얕은 물에 선 것도 세어 10회 중 1회 흔들렸다.
      // ① 겉면이 액체인데 그 위에 떠 있다 = 물 위를 걷는다
      if ((top === B.B.WATER || top === B.B.LAVA || top === B.B.ICE) && m.y >= gy + 1) wet++;
      // ② 몸도 발밑도 액체다 = 통째로 잠겼다 (발목만 잠긴 것은 뺀다)
      const by = Math.min(B.WY - 1, Math.floor(m.y));
      const body = B.world[B.idx(x, by, z)];
      const under = B.world[B.idx(x, Math.max(0, by - 1), z)];
      if ((body === B.B.WATER || body === B.B.LAVA) &&
          (under === B.B.WATER || under === B.B.LAVA)) wet++;
    });
    return { wet, total: B.mobs.length };
  });
  eq(r.wet, 0, r.wet + "마리가 물·용암에 잠겨 있다 — 바다 위를 걸어 다닌다");
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
    return { all, color, search,
             wools: B.WOOL_COUNT, carpets: B.CARPET_COUNT,
             cats: [B.categoryOf(B.WOOL0), B.categoryOf(B.B.STONE),
                    B.categoryOf(B.B.LAMP), B.categoryOf(B.B.BRICK),
                    B.categoryOf(B.CARPET0)] };
  });
  assert(r.all > 30, "전체 목록이 너무 짧다: " + r.all);
  // 색 갈래 = 양털 16 + 색 카펫 16 (v84). 숫자를 여기 적지 않고 상수에서 유도한다.
  eq(r.color, r.wools + r.carpets,
     "색 갈래가 " + r.color + "개 — 양털 " + r.wools + " + 카펫 " + r.carpets + " 이어야 한다");
  eq(r.cats[4], "color", "색 카펫이 색 갈래에 없다");
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
    return { steps: B.TUT.length, text: B.TUT.map(function (t) { return B.hintText(t); }).join(" ") };
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
    return { steps: B.TUT.length, t4: B.hintText(B.TUT[4]), t5: B.hintText(B.TUT[5]), t6: B.hintText(B.TUT[6]) };
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
    // 얼음은 **해수면 위**의 드러난 물만 언다 — 해수면은 세계마다 다르다(v79).
    // 좌표를 손으로 적으면 예전 판에 굳는다.
    const W = B.SEA + 3, TOP = W + 2;          // 물 W~TOP · 그 아래는 돌
    for (let x = X - 2; x <= X + 2; x++) for (let z = Z - 2; z <= Z + 2; z++) {
      for (let y = W - 4; y <= TOP + 6; y++) B.set(x, y, z, y < W ? B.B.STONE : B.B.AIR);
      for (let y = W; y <= TOP; y++) B.set(x, y, z, B.B.WATER);
      B.biomeMap[z * B.WX + x] = 1;             // 설원 — 얼 수 있는 곳
    }
    B.refreshAllTops(); B.relightAll(false);
    B.player.pos.set(X + 0.5, W + 1, Z + 0.5); B.player.vel.set(0, 0, 0);
    for (let x = X - 2; x <= X + 2; x++) for (let z = Z - 2; z <= Z + 2; z++)
      B.enqueueFreeze(x, TOP, z);
    B.freezeTick(999);
    const mine = B.get(X, TOP, Z), near = B.get(X + 2, TOP, Z);
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
  // 간격은 v78 에서 0.35 → 0.20 으로 옮겼다 (마크는 4틱 = 0.20초).
  // 여기서 지키는 것은 "간격을 지키는가" 지 특정 숫자가 아니다 —
  // 정확한 값은 `v78 놓기` 가 문서와 함께 못 박는다.
  assert(r.repeat >= 0.15, "홀드 반복 간격이 없다시피 하다 — 손이 떨리면 여러 개가 놓인다");
  // 3초 = 첫 하나 + 뜸(PLACE_DELAY) 뒤부터 PLACE_REPEAT 간격
  const cap = 1 + Math.floor((3 - r.delay) / r.repeat);
  assert(r.held <= cap, "홀드 3초에 " + r.held + "개 — 상한 " + cap + "개를 넘었다");
  assert(r.held >= cap * 0.45,
     "홀드 3초에 " + r.held + "개 — 상한 " + cap + "개에 견줘 너무 적다");
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
    // 튜토리얼 문장도 따라가야 한다 — 3단계(모양 키)를 띄운 채 shape 를 K 로 바꿔 본다
    const tutWas = B.S.tut, shapeWas = B.S.binds.shape;
    B.S.tut = 3; B.S.binds.shape = "KeyK"; B.refreshBindLabels();
    const tutHint = (document.getElementById("hint") || {}).innerHTML || "";
    B.S.tut = tutWas; B.S.binds.shape = shapeWas;
    B.S.binds.fly = was;
    B.refreshBindLabels();
    const back = el ? el.textContent : "";
    return { shown, back, hintHasJ: hint.indexOf(">J<") >= 0, tutHasK: tutHint.indexOf(">K<") >= 0, tutHasG: tutHint.indexOf(">G<") >= 0,
             count: document.querySelectorAll("[data-bind]").length };
  });
  assert(r.count >= 6, "재배치를 반영할 자리가 표시돼 있지 않다");
  eq(r.shown, "J", "재배치해도 도움말이 옛 키를 보여 준다");
  eq(r.back, "F", "되돌렸을 때 원래 키로 안 돌아온다");
  assert(r.tutHasK && !r.tutHasG, "튜토리얼 문장이 재배치한 모양 키를 보여 주지 않는다");
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
    // 4초 = 최대 4.6칸 — 13×13 지붕(±6.5) 안에서 끝나야 "걸었다" 를 잴 수 있다. 6초면 걸어서도 벗어난다
    const roofed = walk(4);
    const m0 = B.mobs[0];
    const stayedUnder = Math.abs(m0.x - (X + 0.5)) <= 6.5 && Math.abs(m0.z - (Z + 0.5)) <= 6.5 &&
                        m0.y >= Y - 1 && m0.y <= Y + 1;
    for (let dx = -6; dx <= 6; dx++) for (let dz = -6; dz <= 6; dz++)
      B.set(X + dx, Y + 3, Z + dz, 0);
    B.refreshAllTops();
    // 열린 문 통과
    B.applyEdit(X, Y, Z + 2, B.B.GATE, false, 1);    // shape 1 = 열림
    const gateOpen = B.shapeAt(X, Y, Z + 2) === 1;
    B.endPlay(); B.setPaused(false);
    return { open, roofed, gateOpen, stayedUnder };
  });
  assert(r.stayedUnder, "지붕 아래 동물이 걸은 게 아니라 밖으로 튕겨 나갔다");
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
    // 플레이어 주변 8~30칸이 전부 마른 돌판이어야 다시 놓을 자리가 확실히 있다
    const PX = 48, PZ = 48, PY = 30;
    for (let dx = -32; dx <= 32; dx++) for (let dz = -32; dz <= 32; dz++) {
      const x = PX + dx, z = PZ + dz;
      if (x < 1 || x >= B.WX - 1 || z < 1 || z >= B.WZ - 1) continue;
      for (let y = PY - 1; y <= PY + 12; y++) B.set(x, y, z, y === PY - 1 ? B.B.STONE : 0);
    }
    B.player.pos.set(PX + 0.5, PY, PZ + 0.5);
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
    // 재배치는 0.5초에 한 번, placeMob 은 무작위 시도라 한 번에 성공하지 못할 수 있다.
    // 물 밖으로 나갈 때까지 최대 5초 돌린다 (나가면 즉시 멈춘다).
    for (let i = 0; i < 300; i++) {
      B.updateMobs(1 / 60);
      const gx0 = Math.floor(m.x), gz0 = Math.floor(m.z);
      const t0 = B.topMap[gz0 * B.WX + gx0];
      const s0 = B.world[B.idx(gx0, t0, gz0)];
      if (s0 !== B.B.WATER && s0 !== B.B.ICE && m.y >= t0 - 0.01) break;
    }
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

test("v31 되돌리기: 물 근원을 되돌리면 퍼진 물이 마르고, 흐르던 물은 근원이 되지 않는다", async (page) => {
  const r = await page.evaluate(() => {
    const B = window.__blockyard;
    B.setPaused(true); B.beginPlay();
    const X = 40, Y = 42, Z = 70;
    for (let dx = -9; dx <= 9; dx++) for (let dz = -9; dz <= 9; dz++) {
      for (let dy = 0; dy <= 3; dy++) B.set(X + dx, Y + dy, Z + dz, 0);
      B.set(X + dx, Y - 1, Z + dz, B.B.STONE);
    }
    B.refreshAllTops(); B.relightAll(false);
    B.S.history.length = 0; B.S.future.length = 0;
    function count() { let n = 0;
      for (let dx = -9; dx <= 9; dx++) for (let dz = -9; dz <= 9; dz++) if (B.get(X + dx, Y, Z + dz) === B.B.WATER) n++;
      return n; }
    function settle() { for (let k = 0; k < 120; k++) { B.waterTick(600); B.dryTick(600); } }
    B.applyEdit(X, Y, Z, B.B.WATER, true, 0); settle();
    const spread = count();
    B.undo(); settle();
    const afterUndo = count();
    // 흐르던 물(레벨 3) 한 칸을 캐고 되돌린다 — 레벨이 3 으로 돌아와야 한다
    B.redo(); settle();
    const fx = X + 3;
    const lvlBefore = B.waterLvl[B.idx(fx, Y, Z)];
    B.applyEdit(fx, Y, Z, B.B.AIR, true, 0);
    B.undo();
    const lvlAfter = B.waterLvl[B.idx(fx, Y, Z)];
    B.S.history.length = 0; B.S.future.length = 0;
    B.endPlay(); B.setPaused(false);
    return { spread, afterUndo, lvlBefore, lvlAfter };
  });
  assert(r.spread > 20, "시험대 물이 퍼지지 않았다 — " + r.spread);
  eq(r.afterUndo, 0, "근원을 되돌렸는데 퍼진 물이 남아 있다");
  assert(r.lvlBefore > 0, "시험 칸이 흐르는 물이 아니다 — 레벨 " + r.lvlBefore);
  eq(r.lvlAfter, r.lvlBefore, "되돌리기 한 번에 흐르는 물이 근원(0)이 됐다 — 무한 물이 생긴다");
});

test("v31 과제: '쾅' 은 부싯돌을 댈 때가 아니라 터질 때 뜬다", async (page) => {
  const r = await page.evaluate(() => {
    const B = window.__blockyard;
    B.setPaused(true); B.beginPlay();
    const X = 84, Y = 42, Z = 84;
    for (let dx = -6; dx <= 6; dx++) for (let dy = -3; dy <= 5; dy++) for (let dz = -6; dz <= 6; dz++)
      B.set(X + dx, Y + dy, Z + dz, dy < 0 ? B.B.STONE : 0);
    B.applyEdit(X, Y, Z, B.B.TNT, false, 0);
    B.refreshAllTops(); B.relightAll(false);
    delete B.S.earned.boom;
    B.S.primed.length = 0;
    B.primeTNT(X, Y, Z);
    const atPrime = !!B.S.earned.boom;
    B.primeTick(B.TNT_FUSE + 0.5);
    const atBoom = !!B.S.earned.boom;
    B.S.primed.length = 0;
    B.endPlay(); B.setPaused(false);
    return { atPrime, atBoom };
  });
  assert(!r.atPrime, "부싯돌을 대는 순간 과제가 떴다 (아직 안 터졌다)");
  assert(r.atBoom, "터졌는데 과제가 뜨지 않았다");
});

test("v32 과제: 금·다이아를 캐면 과제가 뜬다", async (page) => {
  const r = await page.evaluate(() => {
    const B = window.__blockyard;
    B.setPaused(true); B.beginPlay();
    const X = 12, Y = 40, Z = 84;
    for (let dy = -1; dy <= 3; dy++) B.set(X, Y + dy, Z, 0); B.set(X, Y - 1, Z, B.B.STONE);
    delete B.S.earned.gold; delete B.S.earned.diamond;
    B.applyEdit(X, Y, Z, B.B.GOLD, false, 0);
    B.mineAt({ x: X, y: Y, z: Z, block: B.B.GOLD });
    const gold = !!B.S.earned.gold;
    B.applyEdit(X, Y, Z, B.B.DIAMOND, false, 0);
    B.mineAt({ x: X, y: Y, z: Z, block: B.B.DIAMOND });
    const dia = !!B.S.earned.diamond;
    const ids = B.ACHIEVEMENTS.map(a => a.id);
    B.endPlay(); B.setPaused(false);
    return { gold, dia, hasGold: ids.indexOf("gold") >= 0, hasDia: ids.indexOf("diamond") >= 0 };
  });
  assert(r.hasGold && r.hasDia, "금·다이아 과제가 목록에 없다");
  assert(r.gold, "금 광석을 캤는데 과제가 안 뜬다");
  assert(r.dia, "다이아몬드를 캤는데 과제가 안 뜬다");
});

test("v33 스폰: 열두 시드 모두 잔디·흙·모래·눈 위, 물 밖에서 시작한다", async (page) => {
  const r = await page.evaluate(() => {
    const B = window.__blockyard;
    const ok = [B.B.GRASS, B.B.DIRT, B.B.SAND, B.B.SNOW];
    const bad = [];
    for (let k = 0; k < 12; k++) {
      B.S.spawnPoint = null;
      B.generate(1000 + k * 7919); B.relightAll(false);
      B.spawn();
      const x = Math.floor(B.player.pos.x), z = Math.floor(B.player.pos.z);
      const y = Math.floor(B.player.pos.y - 0.5);
      const under = B.world[B.idx(x, y, z)];
      if (ok.indexOf(under) < 0 || y <= B.SEA) bad.push({ seed: 1000 + k * 7919, under: B.NAMES[under] || under, y });
    }
    return { bad };
  });
  eq(r.bad.length, 0, "발밑이 스폰 불가 블록인 시드: " + JSON.stringify(r.bad));
});

test("v33 광석: 어느 시드에도 다이아 광맥이 8개 이상 있다", async (page) => {
  const r = await page.evaluate(() => {
    const B = window.__blockyard;
    const counts = [];
    for (let k = 0; k < 8; k++) {
      B.generate(5000 + k * 104729); B.relightAll(false);
      let n = 0;
      for (let y = 0; y < 8; y++) for (let z = 0; z < B.WZ; z++) for (let x = 0; x < B.WX; x++)
        if (B.world[B.idx(x, y, z)] === B.B.DIAMOND) n++;
      counts.push(n);
    }
    return { counts, min: Math.min.apply(null, counts) };
  });
  assert(r.min >= 8, "다이아가 8개 미만인 시드가 있다 — " + JSON.stringify(r.counts));
});

test("v33 튜토리얼: 폰 문구가 따로 있고, 작은 화면에서도 힌트 줄이 보인다", async (page) => {
  const r = await page.evaluate(() => {
    const B = window.__blockyard;
    return { same: B.TUT_TOUCH.length === B.TUT.length,
             touchWords: B.TUT_TOUCH.every(t => /버튼|스틱|화면|핫바/.test(t)),
             noMouse: !B.TUT_TOUCH.some(t => /클릭|Alt|Ctrl|<b>E<\/b>|<b>G<\/b>|<b>H<\/b>/.test(t)) };
  });
  assert(r.same, "터치 튜토리얼 단계 수가 다르다 — advanceTut 인덱스가 어긋난다");
  assert(r.touchWords, "터치 문구에 마우스 밖의 조작이 없다");
  assert(r.noMouse, "터치 문구에 클릭·Alt·키보드 안내가 남아 있다");
  const before = page.viewportSize();
  await page.setViewportSize({ width: 800, height: 400 });      // 가로로 든 폰
  const shown = await page.evaluate(() => {
    const B = window.__blockyard;
    B.setPaused(true); B.beginPlay(); B.S.tut = 0; B.refreshHint();
    const h = document.getElementById("hint");
    const cs = getComputedStyle(h);
    const out = { display: cs.display, size: parseFloat(cs.fontSize), text: h.textContent.length };
    B.endPlay(); B.setPaused(false);
    return out;
  });
  await page.setViewportSize(before);
  assert(shown.display !== "none", "400px 높이에서 튜토리얼 줄이 숨겨진다 — 폰 유저는 평생 못 본다");
  assert(shown.size <= 10 && shown.text > 0, "작은 화면 힌트가 비었거나 크다 — " + JSON.stringify(shown));
});

test("v34 지형: 굴 입구가 뚫리고, 바다 밑에 공중 물이 없고, 바이옴이 한쪽으로 쏠리지 않는다", async (page) => {
  const r = await page.evaluate(() => {
    const B = window.__blockyard;
    const rows = [];
    for (let k = 0; k < 5; k++) {
      B.generate(2000 + k * 7717); B.relightAll(false);
      let trees = 0, hanging = 0, holes = 0;
      const bio = [0, 0, 0];
      for (let z = 1; z < B.WZ - 1; z++) for (let x = 1; x < B.WX - 1; x++) {
        bio[B.biomeMap[z * B.WX + x]]++;
        const h = B.heightMap[z * B.WX + x];
        const surf = B.world[B.idx(x, h, z)];
        const above = B.world[B.idx(x, h + 1, z)];
        if ((surf === B.B.GRASS || surf === B.B.SNOW) && above === 0)
          for (let d = 1; d <= 3; d++) if (B.world[B.idx(x, h - d, z)] === 0) { holes++; break; }
        if (above === B.B.LOG || above === B.B.BIRCH_LOG) trees++;
        // 물 바로 아래가 공기 = 해저에 구멍이 뚫려 물이 공중에 떠 있다
        for (let y = 2; y <= B.SEA; y++)
          if (B.world[B.idx(x, y, z)] === B.B.WATER && B.world[B.idx(x, y - 1, z)] === 0) hanging++;
      }
      const tot = bio[0] + bio[1] + bio[2];
      rows.push({ trees, hanging, holes, maxBio: Math.max.apply(null, bio.map(v => v / tot)) });
    }
    return rows;
  });
  const minTrees = Math.min.apply(null, r.map(o => o.trees));
  const maxHang = Math.max.apply(null, r.map(o => o.hanging));
  const minHoles = Math.min.apply(null, r.map(o => o.holes));
  const maxBio = Math.max.apply(null, r.map(o => o.maxBio));
  eq(maxHang, 0, "바다 밑에 공중 물이 " + maxHang + "칸 남아 있다 (편집하면 갑자기 쏟아진다)");
  assert(minHoles >= 10, "지표에 굴 입구가 없다 — 최소 " + minHoles + "개");
  assert(minTrees >= 20, "숲이 없다 — 나무 최소 " + minTrees + "그루");
  assert(maxBio <= 0.50, "바이옴 하나가 " + Math.round(maxBio * 100) + "% 를 먹었다");
});

test("v35 슬롯: 저장 시각이 실리고, 빈 슬롯이 SEED 를 따르고, 두 번 눌러야 지워진다", async (page) => {
  const r = await page.evaluate(() => {
    const B = window.__blockyard;
    B.setPaused(true); B.beginPlay();
    const keep = B.S.slot;
    B.S.slot = 3; B.clearSave();
    B.generate(4321); B.relightAll(false);
    B.saveGame();
    const info = B.slotInfo(3);
    const ago = B.agoText(Date.now() - 3 * 3600 * 1000);
    // 지우기 — 첫 클릭은 무장만, 두 번째에 지워진다
    B.refreshSlots();
    const del = document.querySelector('#slots i[data-del="3"]');
    const had = !!del;
    if (del) del.click();
    const armed = !!B.slotInfo(3);
    if (del) document.querySelector('#slots i[data-del="3"]').click();
    const gone = !B.slotInfo(3);
    B.S.slot = keep;
    B.endPlay(); B.setPaused(false);
    return { at: info && info.at, seed: info && info.seed, ago, had, armed, gone };
  });
  assert(r.at > 0, "저장에 시각(at)이 실리지 않는다 — 어제 하던 세계를 못 찾는다");
  eq(r.seed, 4321, "슬롯 시드");
  eq(r.ago, "3시간 전", "상대 시각 표기: " + r.ago);
  assert(r.had, "슬롯에 지우기 버튼이 없다");
  assert(r.armed, "한 번 눌렀는데 바로 지워졌다 (파괴적 조작은 두 번)");
  assert(r.gone, "두 번 눌러도 안 지워진다");
});

test("v36 파편: 한 블록의 파편이 여러 색으로 튄다", async (page) => {
  const r = await page.evaluate(() => {
    const B = window.__blockyard;
    const sw = B.SWATCH_SIDE[B.B.GRASS];
    const uniq = new Set(sw.map(c => c.join(",")));
    // 실제로 튀겨 보고 색이 갈라지는지
    B.setPaused(true);
    B.updateParticles(5);                 // 앞선 시험이 남긴 파편을 모두 만료시킨다
    const before = B.pCount();
    B.burst(20, 40, 20, B.B.STONE, 24);
    const cols = new Set();
    const arr = B.pColArray();
    const n = B.pCount();
    for (let i = 0; i < n; i++)
      cols.add([arr[i*3], arr[i*3+1], arr[i*3+2]].map(v => Math.round(v * 40)).join(","));
    B.setPaused(false);
    return { swatch: sw.length, uniq: uniq.size, spawned: n - before, colors: cols.size };
  });
  assert(r.swatch >= 8, "타일 표본이 너무 적다 — " + r.swatch);
  assert(r.uniq >= 3, "표본이 사실상 한 색이다 — 서로 다른 색 " + r.uniq);
  assert(r.spawned >= 20, "파편이 24개 안 나온다 — " + r.spawned);
  assert(r.colors >= 3, "튄 파편이 한 색이다 — 서로 다른 색 " + r.colors);
});

test("v37 게임패드: 베드락 배치로 바뀌고 놓기가 홀드로 반복된다", async (page) => {
  const r = await page.evaluate(() => {
    const B = window.__blockyard;
    B.setPaused(true); B.beginPlay();
    // 가짜 패드 — navigator.getGamepads 를 갈아 끼운다
    const btn = new Array(17).fill(0).map(() => ({ pressed: false }));
    const pad = { connected: true, axes: [0, 0, 0, 0], buttons: btn };
    const real = navigator.getGamepads;
    navigator.getGamepads = function () { return [pad]; };
    function poll(n) { for (let i = 0; i < (n || 1); i++) B.pollGamepad(1 / 60); }
    const was = B.getSelected();
    btn[5].pressed = true; poll(); btn[5].pressed = false; poll();   // RB — 핫바 오른쪽
    const rbMoved = B.getSelected() !== was;
    btn[4].pressed = true; poll(); btn[4].pressed = false; poll();   // LB — 되돌아옴
    const lbBack = B.getSelected() === was;
    btn[7].pressed = true; poll();                                    // RT — 캐기
    const mining = B.S.mouseDown[0] === true;
    btn[7].pressed = false; poll();
    btn[6].pressed = true; poll(3);                                   // LT — 놓기(홀드)
    const placingHeld = B.S.touchPlace === true;
    btn[6].pressed = false; poll();
    const placingOff = B.S.touchPlace === false;
    btn[10].pressed = true; poll();                                   // L스틱 클릭 — 달리기
    const sprint = B.S.keys.ControlLeft === true;
    btn[10].pressed = false; poll();
    const uiWas = B.S.uiOpen;
    btn[3].pressed = true; poll(); btn[3].pressed = false; poll();    // Y — 목록
    const listToggled = B.S.uiOpen !== uiWas;
    if (B.S.uiOpen) { btn[3].pressed = true; poll(); btn[3].pressed = false; poll(); }   // Y 로 다시 닫는다
    navigator.getGamepads = real;
    B.endPlay(); B.setPaused(false);
    return { rbMoved, lbBack, mining, placingHeld, placingOff, sprint, listToggled,
             hasMenuPoll: typeof B.pollGamepadMenu === "function" };
  });
  assert(r.rbMoved && r.lbBack, "LB/RB 가 핫바를 옮기지 않는다 (트리거와 중복이었다)");
  assert(r.mining, "RT 로 캐지 못한다");
  assert(r.placingHeld, "LT 를 누르고 있어도 놓기가 반복되지 않는다");
  assert(r.placingOff, "LT 를 떼도 놓기가 멈추지 않는다");
  assert(r.sprint, "L스틱 클릭이 달리기가 아니다");
  assert(r.listToggled, "Y 가 블록 목록을 열지 않는다");
  assert(r.hasMenuPoll, "시작 화면에서 패드를 읽지 않는다 — A 를 눌러도 못 들어온다");
});

test("v38 용암: 흐르고, 물에 닿으면 굳고, 근원을 캐면 물러난다", async (page) => {
  const r = await page.evaluate(() => {
    const B = window.__blockyard;
    B.setPaused(true); B.beginPlay();
    const X = 20, Y = 44, Z = 84;
    function arena() {
      for (let dx = -8; dx <= 8; dx++) for (let dz = -4; dz <= 4; dz++) {
        for (let dy = 0; dy <= 4; dy++) B.set(X + dx, Y + dy, Z + dz, 0);
        B.set(X + dx, Y - 1, Z + dz, B.B.STONE);
      }
      B.refreshAllTops(); B.relightAll(false);
    }
    function settle(n) { for (let k = 0; k < (n || 200); k++) { B.lavaFlowTick(300); B.lavaDryTick(300); } }
    // 1) 흐른다 — LAVA_FLOW 칸까지
    arena();
    B.applyEdit(X, Y, Z, B.B.LAVA, false, 0);
    settle();
    let reach = 0;
    for (let d = 1; d <= 6; d++) if (B.get(X + d, Y, Z) === B.B.LAVA) reach = d;
    // 2) 근원을 캐면 흘러 나간 것이 물러난다
    B.applyEdit(X, Y, Z, B.B.AIR, false, 0);
    settle();
    let left = 0;
    for (let d = -6; d <= 6; d++) if (B.get(X + d, Y, Z) === B.B.LAVA) left++;
    // 3) 물에 닿으면 조약돌
    arena();
    B.applyEdit(X, Y, Z, B.B.LAVA, false, 0);
    B.applyEdit(X + 2, Y, Z, B.B.WATER, false, 0);
    for (let k = 0; k < 200; k++) { B.lavaFlowTick(300); B.waterTick(300); B.lavaDryTick(300); B.dryTick(300); }
    let cobble = 0;
    for (let d = -3; d <= 3; d++) if (B.get(X + d, Y, Z) === B.B.COBBLE) cobble++;
    // 4) 절벽 아래로 떨어진다 — 화면으로 보다가 이 경우에 시험이 없다는 걸 알았다
    arena();
    for (let dx = 2; dx <= 8; dx++) for (let dz = -4; dz <= 4; dz++) {
      B.set(X + dx, Y - 1, Z + dz, 0);            // 오른쪽을 파서 낭떠러지로
      B.set(X + dx, Y - 4, Z + dz, B.B.STONE);    // 세 칸 아래에 바닥
    }
    B.refreshAllTops(); B.relightAll(false);
    B.applyEdit(X, Y, Z, B.B.LAVA, false, 0);
    settle(400);
    let fell = 0;
    for (let dy = 1; dy <= 3; dy++) if (B.get(X + 2, Y - dy, Z) === B.B.LAVA) fell++;
    const pooled = B.get(X + 2, Y - 3, Z) === B.B.LAVA;   // 바닥에 고였는가

    B.endPlay(); B.setPaused(false);
    return { reach, left, cobble, fell, pooled, max: B.LAVA_FLOW };
  });
  eq(r.max, 2, "LAVA_FLOW 가 2 가 아니다");
  eq(r.reach, 2, "용암이 흐르지 않는다 (제자리에 네모나게 떠 있다) — " + r.reach + "칸");
  eq(r.left, 0, "근원을 캤는데 흘러 나간 용암이 남아 있다 — " + r.left + "칸");
  assert(r.cobble > 0, "용암과 물이 만났는데 조약돌이 안 생긴다");
  assert(r.fell >= 2, "절벽 아래로 흘러내리지 않는다 — 떨어진 칸 " + r.fell);
  assert(r.pooled, "떨어진 용암이 바닥에 고이지 않는다");
});

test("v39 문: 두 칸으로 서고, 함께 열리고, 반쪽만 남지 않는다", async (page) => {
  const r = await page.evaluate(() => {
    const B = window.__blockyard;
    B.setPaused(true); B.beginPlay();
    const X = 60, Y = 44, Z = 20;
    for (let dx = -3; dx <= 3; dx++) for (let dz = -3; dz <= 3; dz++) {
      for (let dy = 0; dy <= 5; dy++) B.set(X + dx, Y + dy, Z + dz, 0);
      B.set(X + dx, Y - 1, Z + dz, B.B.STONE);
    }
    B.refreshAllTops(); B.relightAll(false);
    // 놓기 — 플레이어가 남쪽(+z)에 서서 발밑 앞 칸을 본다
    B.player.pos.set(X + 0.5, Y, Z + 2.5);
    B.getBar()[B.getSelected()] = B.B.DOOR;
    B.applyEdit(X, Y, Z, B.B.DOOR, true, B.doorShapeFor(2, false));
    B.applyEdit(X, Y + 1, Z, B.B.DOOR, true, B.doorShapeFor(2, false));
    const two = B.get(X, Y, Z) === B.B.DOOR && B.get(X, Y + 1, Z) === B.B.DOOR;
    const closedSolid = B.boxHitsWorld(X + 0.5, Y, Z + 0.85);   // 닫힌 문 앞은 막힌다
    // 열기 — 두 칸이 함께 열려야 한다
    B.tryInteract({ x: X, y: Y, z: Z, block: B.B.DOOR, nx: 0, ny: 0, nz: 1, shape: B.shapeAt(X, Y, Z) });
    const lowOpen = B.doorOpen(B.shapeAt(X, Y, Z));
    const highOpen = B.doorOpen(B.shapeAt(X, Y + 1, Z));
    const openPass = !B.boxHitsWorld(X + 0.5, Y, Z + 0.5);      // 열면 지나갈 수 있다
    // 한쪽을 캐면 나머지도 사라진다
    B.mineAt({ x: X, y: Y, z: Z, block: B.B.DOOR });
    const bothGone = B.get(X, Y, Z) === 0 && B.get(X, Y + 1, Z) === 0;
    B.endPlay(); B.setPaused(false);
    return { two, closedSolid, lowOpen, highOpen, openPass, bothGone,
             named: B.NAMES[B.B.DOOR], listed: B.ALL_BLOCKS.indexOf(B.B.DOOR) >= 0 };
  });
  assert(r.two, "문이 두 칸으로 서지 않는다");
  assert(r.closedSolid, "닫힌 문을 그냥 통과한다");
  assert(r.lowOpen && r.highOpen, "두 칸이 함께 열리지 않는다 (반쪽만 열리면 문이 아니다)");
  assert(r.openPass, "열었는데 지나갈 수 없다");
  assert(r.bothGone, "반쪽을 캤는데 나머지가 허공에 남는다");
  eq(r.named, "문", "문 이름");
  assert(r.listed, "블록 목록에 문이 없다");
});

test("v40 명령: clone 이 고른 영역을 그대로 한 벌 더 만든다", async (page) => {
  const r = await page.evaluate(() => {
    const B = window.__blockyard;
    B.setPaused(true); B.beginPlay();
    const X = 70, Y = 44, Z = 30;
    for (let dx = -1; dx <= 12; dx++) for (let dz = -1; dz <= 4; dz++)
      for (let dy = -1; dy <= 4; dy++) B.set(X + dx, Y + dy, Z + dz, 0);
    for (let dx = 0; dx < 3; dx++) for (let dy = 0; dy < 2; dy++) for (let dz = 0; dz < 3; dz++)
      B.applyEdit(X + dx, Y + dy, Z + dz, B.B.BRICK, false, 0);
    B.refreshAllTops();
    B.S.selA = [X, Y, Z]; B.S.selB = [X + 2, Y + 1, Z + 2];
    const noArgs = B.runCommand("clone");
    const msg = B.runCommand("clone 6 0 0");
    let copied = 0;
    for (let dx = 0; dx < 3; dx++) for (let dy = 0; dy < 2; dy++) for (let dz = 0; dz < 3; dz++)
      if (B.get(X + 6 + dx, Y + dy, Z + dz) === B.B.BRICK) copied++;
    B.S.selA = B.S.selB = null;
    const alt = B.DEFAULT_BAR2.indexOf(B.B.DOOR) >= 0;
    const known = B.CMD_LIST.indexOf("clone") >= 0;
    B.endPlay(); B.setPaused(false);
    return { noArgs, msg, copied, alt, known };
  });
  assert(r.noArgs.indexOf("clone <dx>") >= 0, "인자 없이 부르면 쓰는 법을 알려야 한다: " + r.noArgs);
  assert(r.msg.indexOf("복제") >= 0, "clone 응답: " + r.msg);
  eq(r.copied, 18, "복제된 칸 수");
  assert(r.alt, "두 번째 핫바에 문이 없다 — 새 블록을 찾기 어렵다");
  assert(r.known, "clone 이 명령 목록(자동완성)에 없다");
});

test("v41 세계: 새로고침해도 동물·물고기·새가 살아 있다", async (page) => {
  const r = await page.evaluate(() => {
    const B = window.__blockyard;
    // seedMobs 를 부르지 않는다 — 부팅만으로 있어야 한다 (시험이 구멍을 덮지 않게)
    return { mobs: B.mobs.length, fish: B.fish ? 1 : 0, birds: B.birds ? 1 : 0 };
  });
  assert(r.mobs > 0, "부팅 직후 동물이 0마리 — newWorld() 안에서만 뿌리고 있다");
  eq(r.mobs, 14, "동물 수");
});

test("v41 되돌리기: 문 여닫기·눈·불이 기록을 먹지 않는다", async (page) => {
  const r = await page.evaluate(() => {
    const B = window.__blockyard;
    B.setPaused(true); B.beginPlay();
    const X = 24, Y = 42, Z = 74;
    for (let dx = -2; dx <= 2; dx++) for (let dz = -2; dz <= 2; dz++)
      for (let dy = -1; dy <= 4; dy++) B.set(X + dx, Y + dy, Z + dz, dy === -1 ? B.B.STONE : 0);
    B.refreshAllTops(); B.relightAll(false);
    B.applyEdit(X, Y, Z, B.B.DOOR, false, B.doorShapeFor(2, false));
    B.applyEdit(X, Y + 1, Z, B.B.DOOR, false, B.doorShapeFor(2, false));
    B.S.history.length = 0; B.S.future.length = 0;
    for (let k = 0; k < 10; k++)
      B.tryInteract({ x: X, y: Y, z: Z, block: B.B.DOOR, nx: 0, ny: 0, nz: 1, shape: B.shapeAt(X, Y, Z) });
    const afterDoor = B.S.history.length;
    // 불 번짐도 기록을 먹지 않아야 한다
    B.S.weather = 0;
    for (let i = 0; i < 5; i++) B.applyEdit(X - 1 + i % 2, Y, Z + 2, B.B.PLANKS, false, 0);
    B.ignite(X, Y + 1, Z + 2);          // 사람이 직접 붙인 첫 불은 되돌릴 수 있어야 한다 (v19)
    const litByHand = B.S.history.length;
    B.S.history.length = 0;             // 그 뒤 번짐·꺼짐만 센다
    for (let k = 0; k < 200; k++) B.fireTick(80);
    const afterFire = B.S.history.length;
    B.endPlay(); B.setPaused(false);
    return { afterDoor, afterFire, litByHand };
  });
  eq(r.afterDoor, 0, "문을 10번 여닫자 되돌리기 기록이 " + r.afterDoor + "개 쌓였다");
  eq(r.litByHand, 1, "사람이 붙인 불은 되돌릴 수 있어야 한다 (v19)");
  eq(r.afterFire, 0, "불이 번지고 꺼지며 되돌리기 기록을 " + r.afterFire + "개 먹었다");
});

test("v41 저장: 사람이 손댄 칸(touched)이 이어하기까지 살아남는다", async (page) => {
  const r = await page.evaluate(() => {
    const B = window.__blockyard;
    B.setPaused(true); B.beginPlay();
    const X = 34, Y = 42, Z = 74;
    B.set(X, Y, Z, 0);
    B.applyEdit(X, Y, Z, B.B.PLANKS, true, 0);      // record=true → touched
    const before = B.isTouched(X, Y, Z);
    B.saveGame();
    B.touched.fill(0);                               // 새로고침을 흉내
    const wiped = B.isTouched(X, Y, Z);
    const ok = B.loadGame();
    const after = B.isTouched(X, Y, Z);
    B.endPlay(); B.setPaused(false);
    return { before, wiped, ok, after };
  });
  assert(r.before, "시험대가 touched 를 안 남겼다");
  assert(!r.wiped, "지우기가 안 됐다");
  assert(r.ok, "불러오기 실패");
  assert(r.after, "이어하기하니 내 건축물 보호가 풀렸다 (날씨·잔디가 다시 건드린다)");
});

test("v42 복사: 붙여넣은 물이 전부 근원이 되지 않는다", async (page) => {
  const r = await page.evaluate(() => {
    const B = window.__blockyard;
    B.setPaused(true); B.beginPlay();
    const X = 20, Y = 40, Z = 60;
    for (let dx = -2; dx <= 22; dx++) for (let dz = -2; dz <= 8; dz++) {
      for (let dy = 0; dy <= 3; dy++) B.set(X + dx, Y + dy, Z + dz, 0);
      B.set(X + dx, Y - 1, Z + dz, B.B.STONE);
    }
    B.refreshAllTops(); B.relightAll(false);
    B.applyEdit(X, Y, Z, B.B.WATER, false, 0);
    for (let k = 0; k < 150; k++) { B.waterTick(600); B.dryTick(600); }
    function sources(ox) {
      let src = 0, wet = 0;
      for (let dx = -1; dx <= 8; dx++) for (let dz = -1; dz <= 8; dz++)
        if (B.get(X + ox + dx, Y, Z + dz) === B.B.WATER) {
          wet++;
          if (B.waterLvl[B.idx(X + ox + dx, Y, Z + dz)] === 0) src++;
        }
      return { src, wet };
    }
    const before = sources(0);
    B.S.selA = [X - 1, Y, Z - 1]; B.S.selB = [X + 8, Y, Z + 8];
    B.copySelection();
    B.pasteClip(X + 12, Y, Z - 1);
    for (let k = 0; k < 150; k++) { B.waterTick(600); B.dryTick(600); }
    const after = sources(12);
    B.S.selA = B.S.selB = null;
    B.endPlay(); B.setPaused(false);
    return { before, after };
  });
  assert(r.before.wet > 20, "시험대 물이 안 퍼졌다 — " + r.before.wet);
  eq(r.before.src, 1, "원본 근원 수");
  assert(r.after.src <= 3, "붙여넣으니 근원이 " + r.after.src + "개가 됐다 (원본은 1개)");
});

test("v42 동물: 울타리에 가둔 동물을 게임이 데려가지 않는다", async (page) => {
  const r = await page.evaluate(() => {
    const B = window.__blockyard;
    B.setPaused(true); B.beginPlay();
    const X = 14, Y = 46, Z = 14;
    for (let dx = -4; dx <= 4; dx++) for (let dz = -4; dz <= 4; dz++) {
      for (let dy = 0; dy <= 4; dy++) B.set(X + dx, Y + dy, Z + dz, 0);
      B.set(X + dx, Y - 1, Z + dz, B.B.STONE);
    }
    for (let d = -3; d <= 3; d++) {                      // 7×7 울타리
      B.applyEdit(X + d, Y, Z - 3, B.B.FENCE, false, 0);
      B.applyEdit(X + d, Y, Z + 3, B.B.FENCE, false, 0);
      B.applyEdit(X - 3, Y, Z + d, B.B.FENCE, false, 0);
      B.applyEdit(X + 3, Y, Z + d, B.B.FENCE, false, 0);
    }
    B.refreshAllTops(); B.relightAll(false);
    const m = B.mobs[0];
    m.x = X + 0.5; m.z = Z + 0.5; m.y = Y; m.walk = 1; m.turn = 1e9; m.follow = 0; m.pennedAt = 0;
    // 플레이어는 섬 반대편으로
    B.player.pos.set(B.WX - 8, Y, B.WZ - 8);
    for (let i = 0; i < 20 * 60; i++) B.updateMobs(1 / 60);
    const inside = Math.abs(m.x - (X + 0.5)) <= 4 && Math.abs(m.z - (Z + 0.5)) <= 4;
    B.endPlay(); B.setPaused(false);
    return { inside, x: m.x, z: m.z };
  });
  assert(r.inside, "가둔 동물이 목장에서 사라졌다 — (" + r.x.toFixed(1) + ", " + r.z.toFixed(1) + ")");
});

test("v43 영역: 허공에도 찍히고, 가로×높이×세로가 보인다", async (page) => {
  const r = await page.evaluate(() => {
    const B = window.__blockyard;
    B.setPaused(true); B.beginPlay();
    const X = 40, Y = 50, Z = 40;
    // 사방이 빈 하늘 — 조준선에 아무것도 없다
    for (let dx = -8; dx <= 8; dx++) for (let dy = -8; dy <= 8; dy++) for (let dz = -8; dz <= 8; dz++)
      B.set(X + dx, Y + dy, Z + dz, 0);
    B.refreshAllTops();
    B.player.pos.set(X + 0.5, Y, Z + 0.5);
    B.player.yaw = 0; B.player.pitch = 0;
    B.camera.rotation.set(0, 0, 0);
    B.camera.position.set(X + 0.5, Y + 1.62, Z + 0.5);
    B.camera.updateMatrixWorld(true);
    const hitNothing = B.raycast(6) === null;
    const cell = B.aimCell(6);
    B.S.selA = [X, Y, Z]; B.S.selB = [X + 2, Y + 11, Z + 4];
    const text = B.selectionText();
    B.S.selA = B.S.selB = null;
    B.endPlay(); B.setPaused(false);
    return { hitNothing, cell, text };
  });
  assert(r.hitNothing, "시험대가 허공이 아니다 — 조준선에 블록이 있다");
  assert(r.cell !== null, "허공에서는 영역을 못 찍는다 (임시 블록을 놓고 지워야 했다)");
  assert(r.text.indexOf("3×12×5") >= 0, "영역 치수가 안 보인다: " + r.text);
  assert(r.text.indexOf("180") >= 0, "칸수도 함께 보여야 한다: " + r.text);
});

test("v44 문: 밑바닥을 캐면 문이 허공에 뜨지 않는다", async (page) => {
  const r = await page.evaluate(() => {
    const B = window.__blockyard;
    B.setPaused(true); B.beginPlay();
    const X = 78, Y = 44, Z = 30;
    for (let dx = -2; dx <= 2; dx++) for (let dz = -2; dz <= 2; dz++)
      for (let dy = -2; dy <= 4; dy++) B.set(X + dx, Y + dy, Z + dz, dy <= -1 ? B.B.STONE : 0);
    B.refreshAllTops(); B.relightAll(false);
    B.applyEdit(X, Y, Z, B.B.DOOR, false, B.doorShapeFor(2, false));
    B.applyEdit(X, Y + 1, Z, B.B.DOOR, false, B.doorShapeFor(2, false));
    const stood = B.get(X, Y, Z) === B.B.DOOR && B.get(X, Y + 1, Z) === B.B.DOOR;
    B.applyEdit(X, Y - 1, Z, B.B.AIR, true);      // 문 밑바닥을 캔다
    const low = B.get(X, Y, Z), high = B.get(X, Y + 1, Z);
    B.endPlay(); B.setPaused(false);
    return { stood, low, high };
  });
  assert(r.stood, "시험대 문이 안 섰다");
  eq(r.low, 0, "밑을 캤는데 문 아래칸이 허공에 남는다");
  eq(r.high, 0, "밑을 캤는데 문 윗칸이 허공에 남는다");
});

test("v45 광석: 어느 시드에도 굴 벽에 드러난 다이아·금이 있다", async (page) => {
  const r = await page.evaluate(() => {
    const B = window.__blockyard;
    const D = [[1,0,0],[-1,0,0],[0,1,0],[0,-1,0],[0,0,1],[0,0,-1]];
    const rows = [];
    for (let k = 0; k < 5; k++) {
      B.generate(3000 + k * 7919); B.relightAll(false);
      let diaOpen = 0, goldOpen = 0;
      for (let y = 1; y <= 12; y++) for (let z = 1; z < B.WZ - 1; z++) for (let x = 1; x < B.WX - 1; x++) {
        const v = B.world[B.idx(x, y, z)];
        if (v !== B.B.DIAMOND && v !== B.B.GOLD) continue;
        let open = false;
        for (const d of D) if (B.world[B.idx(x + d[0], y + d[1], z + d[2])] === 0) open = true;
        if (!open) continue;
        if (v === B.B.DIAMOND) diaOpen++; else goldOpen++;
      }
      rows.push({ diaOpen, goldOpen });
    }
    return rows;
  });
  const minDia = Math.min.apply(null, r.map(o => o.diaOpen));
  const minGold = Math.min.apply(null, r.map(o => o.goldOpen));
  assert(minDia >= 2, "굴을 걸어도 보이는 다이아가 없다 — 최소 " + minDia + "개");
  assert(minGold >= 2, "굴을 걸어도 보이는 금이 없다 — 최소 " + minGold + "개");
});

test("v46 번식: 꽃을 준 두 마리가 가까이 있으면 새끼가 난다", async (page) => {
  const r = await page.evaluate(() => {
    const B = window.__blockyard;
    B.setPaused(true); B.beginPlay();
    const X = 50, Y = 46, Z = 12;
    for (let dx = -4; dx <= 4; dx++) for (let dz = -4; dz <= 4; dz++) {
      for (let dy = 0; dy <= 3; dy++) B.set(X + dx, Y + dy, Z + dz, 0);
      B.set(X + dx, Y - 1, Z + dz, B.B.STONE);
    }
    B.refreshAllTops(); B.relightAll(false);
    delete B.S.earned.breed;
    // 같은 종 두 마리를 나란히 놓고 둘 다 꽃을 준다
    const a = B.mobs[0];
    let b2 = null;
    for (let i = 1; i < B.mobs.length; i++) if (B.mobs[i].kind === a.kind) { b2 = B.mobs[i]; break; }
    if (!b2) return { skipped: true };
    a.x = X + 0.5; a.z = Z + 0.5; a.y = Y; a.follow = 0; a.love = 0; a.baby = 0;
    b2.x = X + 1.5; b2.z = Z + 0.5; b2.y = Y; b2.follow = 0; b2.love = 0; b2.baby = 0;
    B.player.pos.set(X + 0.5, Y, Z + 0.5);
    const before = B.mobs.length;
    B.feedNearbyMob({ x: a.x, y: a.y, z: a.z });
    B.player.pos.set(X + 1.5, Y, Z + 0.5);
    B.feedNearbyMob({ x: b2.x, y: b2.y, z: b2.z });
    const bothInLove = a.love > 0 && b2.love > 0;
    const born = B.breedTick(1 / 60);      // 과제는 부른 쪽(loop)이 준다 — 여기선 반환값을 본다
    const after = B.mobs.length;
    const kid = B.mobs[B.mobs.length - 1];
    if (born) B.unlock("breed");
    const earned = !!B.S.earned.breed;
    // 새끼는 처음엔 작다
    B.updateMobs(1 / 60);
    const small = kid.g.scale.x < 0.8;
    // 상한을 넘지 않는다
    for (let k = 0; k < 60; k++) {
      for (const m of B.mobs) { m.love = 5; m.baby = 0; m.x = X + 0.5; m.z = Z + 0.5; m.y = Y; }
      B.breedTick(1 / 60);
    }
    const capped = B.mobs.length <= B.MOB_MAX;
    B.endPlay(); B.setPaused(false);
    return { skipped: false, bothInLove, before, after, earned, small, capped,
             cap: B.MOB_MAX, total: B.mobs.length, babyKind: kid.kind === a.kind };
  });
  if (r.skipped) return;
  assert(r.bothInLove, "꽃을 줬는데 사랑에 빠지지 않는다");
  eq(r.after, r.before + 1, "새끼가 나지 않았다");
  assert(r.babyKind, "다른 종이 태어났다");
  assert(r.earned, "'목장주' 과제가 안 뜬다 (breedTick 이 태어난 수를 안 돌려준다)");
  assert(r.small, "새끼가 처음부터 어른 크기다");
  assert(r.capped, "상한 " + r.cap + "을 넘어 " + r.total + "마리가 됐다");
});

test("v47 명령: expand 로 영역을 여섯 방향으로 늘린다", async (page) => {
  const r = await page.evaluate(() => {
    const B = window.__blockyard;
    B.setPaused(true); B.beginPlay();
    const X = 40, Y = 30, Z = 40;
    B.S.selA = [X, Y, Z]; B.S.selB = [X + 2, Y + 2, Z + 2];   // 3×3×3
    const noSel = (function () { B.S.selA = B.S.selB = null; const m = B.runCommand("expand 1 1 1");
                                 B.S.selA = [X, Y, Z]; B.S.selB = [X + 2, Y + 2, Z + 2]; return m; })();
    const usage = B.runCommand("expand");
    const up = B.runCommand("expand 0 20 0");                    // 위로 20칸
    const b1 = B.selectionBounds();
    const down = B.runCommand("expand 0 -5 0");                  // 아래로 5칸 더 늘린다
    const b2 = B.selectionBounds();
    // 세계 밖으로는 안 나간다
    B.runCommand("expand 0 999 0");
    const b3 = B.selectionBounds();
    B.S.selA = B.S.selB = null;
    B.endPlay(); B.setPaused(false);
    return { noSel, usage, up, h1: b1.y1 - b1.y0 + 1, y0a: b1.y0,
             h2: b2.y1 - b2.y0 + 1, y0b: b2.y0, top: b3.y1, WY: B.WY };
  });
  assert(r.usage.indexOf("expand <") >= 0, "인자 없이 부르면 쓰는 법을 알려야 한다: " + r.usage);
  assert(r.noSel.indexOf("영역") >= 0, "영역이 없을 때 안내가 없다: " + r.noSel);
  eq(r.h1, 23, "위로 20칸 늘어나지 않았다 — 높이 " + r.h1);
  eq(r.h2, 28, "아래로 5칸 늘어나지 않았다 — 높이 " + r.h2);
  eq(r.y0b, r.y0a - 5, "음수는 아래 모서리를 내려야 한다");
  assert(r.top < r.WY, "세계 밖으로 넘어갔다 — y1=" + r.top);
});

test("v48 과제: 지은 것을 보는 과제 다섯이 실제로 뜬다", async (page) => {
  const r = await page.evaluate(() => {
    const B = window.__blockyard;
    B.setPaused(true); B.beginPlay();
    const ids = B.ACHIEVEMENTS.map(a => a.id);
    for (const k of ["room", "tower", "bridge", "mineshaft", "palette"]) delete B.S.earned[k];
    const X = 30, Y = 40, Z = 30;
    // 넓은 빈 시험대
    for (let dx = -20; dx <= 20; dx++) for (let dz = -20; dz <= 20; dz++)
      for (let dy = -2; dy <= 26; dy++) B.set(X + dx, Y + dy, Z + dz, dy === -2 ? B.B.STONE : 0);
    B.refreshAllTops(); B.relightAll(false);
    B.player.pos.set(X + 0.5, Y, Z + 0.5);

    // 탑 — 20칸 기둥 (record=true 라야 touched 가 찍힌다)
    for (let dy = 0; dy < 20; dy++) B.applyEdit(X + 10, Y + dy, Z + 10, B.B.COBBLE, true, 0);
    // 색칠 — 양털 8색
    for (let c = 0; c < 8; c++) B.applyEdit(X - 6 + c, Y, Z - 6, B.WOOL0 + c, true, 0);
    B.checkBuildAchievements();
    const tower = !!B.S.earned.tower, palette = !!B.S.earned.palette;

    // 방 — 6×5×6 껍데기, 안쪽 4×3×4 = 48칸 (기준 27칸)
    const RX = X - 12, RY = Y, RZ = Z + 8;
    for (let dx = 0; dx < 6; dx++) for (let dz = 0; dz < 6; dz++) for (let dy = 0; dy < 5; dy++) {
      const edge = dx === 0 || dx === 5 || dz === 0 || dz === 5 || dy === 0 || dy === 4;
      B.applyEdit(RX + dx, RY + dy, RZ + dz, edge ? B.B.PLANKS : B.B.AIR, true, 0);
    }
    B.applyEdit(RX + 2, RY + 1, RZ, B.B.DOOR, true, B.doorShapeFor(2, false));
    B.applyEdit(RX + 2, RY + 2, RZ, B.B.DOOR, true, B.doorShapeFor(2, false));
    B.refreshAllTops(); B.relightAll(false);
    B.checkBuildAchievements();
    const room = !!B.S.earned.room;
    B.endPlay(); B.setPaused(false);
    return { ids, tower, palette, room,
             has: ["room","tower","bridge","mineshaft","palette"].every(k => ids.indexOf(k) >= 0) };
  });
  assert(r.has, "건축 과제 다섯이 목록에 없다");
  assert(r.tower, "20칸을 쌓았는데 '전망대' 가 안 뜬다");
  assert(r.palette, "양털 8색을 썼는데 '색칠' 이 안 뜬다");
  assert(r.room, "문 달린 방을 지었는데 '내 집' 이 안 뜬다");
});

test("v48 과제: 자연 지형만으로는 건축 과제가 뜨지 않는다", async (page) => {
  const r = await page.evaluate(() => {
    const B = window.__blockyard;
    B.setPaused(true); B.beginPlay();
    B.generate(777); B.relightAll(false);          // 사람이 손댄 칸 0
    for (const k of ["room", "tower", "bridge", "mineshaft", "palette"]) delete B.S.earned[k];
    // 산·동굴이 많은 자리를 몇 군데 훑는다
    const spots = [[20, 20], [48, 48], [70, 30], [30, 70]];
    for (const [x, z] of spots) {
      B.player.pos.set(x + 0.5, B.topMap[z * B.WX + x] + 1, z + 0.5);
      B.checkBuildAchievements();
    }
    const got = ["room", "tower", "bridge", "mineshaft", "palette"].filter(k => B.S.earned[k]);
    B.endPlay(); B.setPaused(false);
    return { got };
  });
  eq(r.got.length, 0, "자연 지형이 건축 과제를 줬다: " + r.got.join(", "));
});

test("v49 저장: 동물이 저장되고 그 자리에 되살아난다", async (page) => {
  const r = await page.evaluate(() => {
    const B = window.__blockyard;
    B.setPaused(true); B.beginPlay();
    B.generate(31415); B.relightAll(false);
    // 동물을 알아볼 수 있게 한자리에 모은다
    const X = 40, Y = B.topMap[40 * B.WX + 40] + 1, Z = 40;
    B.mobs.forEach((m, i) => { m.x = X + i * 0.5; m.y = Y; m.z = Z; m.baby = 0; });
    const before = B.mobs.map(m => [+m.x.toFixed(2), m.kind]);
    B.saveGame();
    const keys = Object.keys(JSON.parse(localStorage.getItem("blockyard.save")));
    const bytes = JSON.stringify(JSON.parse(localStorage.getItem("blockyard.save")).mb).length;
    // 세계를 갈아엎고 다시 불러온다
    B.generate(1); B.relightAll(false);
    B.mobs.forEach(m => { m.x = 5; m.z = 5; });
    const ok = B.loadGame();
    const after = B.mobs.map(m => [+m.x.toFixed(2), m.kind]);
    B.endPlay(); B.setPaused(false);
    return { hasKey: keys.indexOf("mb") >= 0, bytes, ok, restored: B.S.mobsRestored,
             count: after.length, saved: before.length,
             same: JSON.stringify(before) === JSON.stringify(after) };
  });
  assert(r.hasKey, "저장에 동물(mb)이 실리지 않는다 — 목장이 탭 하나 닫으면 빈 우리가 된다");
  assert(r.ok && r.restored, "불러오기에서 동물이 되살아나지 않았다");
  // 앞선 시험(v46 번식)이 24마리까지 늘려 놓을 수 있다 — 숫자를 박지 말고 저장한 수와 견준다
  eq(r.count, r.saved, "되살아난 동물 수가 저장한 수와 다르다");
  assert(r.saved >= 14, "시험대 동물이 너무 적다 — " + r.saved);
  assert(r.same, "동물이 저장한 자리로 안 돌아왔다");
  assert(r.bytes < 1200, "동물 저장이 너무 크다 — " + r.bytes + "바이트");
});

test("v49 세계 갈아타기: 되돌리기 기록과 클립보드가 따라오지 않는다", async (page) => {
  const r = await page.evaluate(() => {
    const B = window.__blockyard;
    B.setPaused(true); B.beginPlay();
    B.generate(2718); B.relightAll(false);
    // 세계 A 에서 큰 묶음 편집 + 복사 + 영역 선택
    B.beginBatch();
    for (let i = 0; i < 40; i++) B.applyEdit(30 + i % 8, 40, 30 + ((i / 8) | 0), B.B.GLASS, true, 0);
    B.endBatch("시험");
    B.S.selA = [30, 40, 30]; B.S.selB = [37, 40, 34];
    B.copySelection();
    const hadHistory = B.S.history.length, hadClip = !!B.S.clip;
    B.S.walked = 100;                    // 지난 세계에서 실컷 걸어 다녔다
    B.saveGame();
    // 세계 B 로 갈아탄다 (afterWorldSwap 경로)
    B.generate(1618); B.relightAll(false);
    B.afterWorldSwap("시험 전환", true);
    const out = { hadHistory, hadClip,
                  history: B.S.history.length, future: B.S.future.length,
                  clip: !!B.S.clip, sel: !!(B.S.selA || B.S.selB),
                  walked: B.S.walked };
    B.endPlay(); B.setPaused(false);
    return out;
  });
  assert(r.hadHistory > 0 && r.hadClip, "시험대가 안 만들어졌다");
  eq(r.history, 0, "지난 세계의 되돌리기 기록이 따라왔다 — Ctrl+Z 가 새 세계를 도려낸다");
  eq(r.walked, 0, "지난 세계에서 걸은 거리가 따라왔다 — 새 사막에 스폰하자마자 과제가 뜬다 (v60)");
  eq(r.future, 0, "다시하기 기록이 따라왔다");
  assert(!r.clip, "지난 세계의 복사 버퍼가 따라왔다");
  assert(!r.sel, "지난 세계의 영역 선택이 따라왔다");
});

test("v50 동물: 우리 안 물구유가 있어도 밖으로 튕기지 않는다", async (page) => {
  const r = await page.evaluate(() => {
    const B = window.__blockyard;
    B.setPaused(true); B.beginPlay();
    const X = 48, Y = 46, Z = 48;
    for (let dx = -6; dx <= 6; dx++) for (let dz = -6; dz <= 6; dz++) {
      for (let dy = 0; dy <= 4; dy++) B.set(X + dx, Y + dy, Z + dz, 0);
      B.set(X + dx, Y - 1, Z + dz, B.B.STONE);
    }
    // 3×3 울타리 우리 + 한가운데 물구유 한 칸
    for (let d = -2; d <= 2; d++) {
      B.applyEdit(X + d, Y, Z - 2, B.B.FENCE, false, 0);
      B.applyEdit(X + d, Y, Z + 2, B.B.FENCE, false, 0);
      B.applyEdit(X - 2, Y, Z + d, B.B.FENCE, false, 0);
      B.applyEdit(X + 2, Y, Z + d, B.B.FENCE, false, 0);
    }
    B.applyEdit(X, Y - 1, Z, B.B.WATER, false, 0);      // 발밑 물구유
    B.refreshAllTops(); B.relightAll(false);
    const m = B.mobs[0];
    m.x = X + 0.5; m.z = Z + 0.5; m.y = Y; m.follow = 0; m.pennedAt = 12; m.dryCheck = 0;
    B.player.pos.set(X + 0.5, Y, Z + 0.5);
    for (let i = 0; i < 8 * 60; i++) B.updateMobs(1 / 60);
    const inside = Math.abs(m.x - (X + 0.5)) <= 3 && Math.abs(m.z - (Z + 0.5)) <= 3;
    B.endPlay(); B.setPaused(false);
    return { inside, x: +m.x.toFixed(1), z: +m.z.toFixed(1) };
  });
  assert(r.inside, "물구유 한 칸에 동물이 우리 밖으로 날아갔다 — (" + r.x + ", " + r.z + ")");
});

test("v50 날씨: /weather 가 하늘에도 반영된다", async (page) => {
  const r = await page.evaluate(() => {
    const B = window.__blockyard;
    B.setPaused(true); B.beginPlay();
    B.runCommand("weather 맑음");
    const clearState = B.S.weather;
    B.runCommand("weather 비");
    const rainState = B.S.weather, rainMix = B.S.weatherMix;
    B.runCommand("weather 눈");
    const snowState = B.S.weather;
    B.runCommand("weather 맑음");
    B.endPlay(); B.setPaused(false);
    return { clearState, rainState, snowState, rainMix };
  });
  eq(r.clearState, 0, "맑음");
  eq(r.rainState, 1, "비");
  eq(r.snowState, 2, "눈");
  assert(r.rainMix >= 0, "setWeather 를 거치지 않아 화면 상태가 안 따라온다");
});

test("v51 바다: 세계 밖으로 수평선이 이어지고, 물속에서는 감춰진다", async (page) => {
  const r = await page.evaluate(() => {
    const B = window.__blockyard;
    B.setPaused(true); B.beginPlay();
    const y = B.OUTER_SEA_Y;
    // 물 윗면과 같은 높이여야 진짜 물과 이어져 보인다 (mesh.js 의 0.12 보정과 같은 값)
    const alignsWithWater = Math.abs(y - (B.SEA + 1 - 0.12)) < 1e-6;
    B.updateOuterSea(y + 5);
    const aboveVisible = B.outerSea.visible;
    B.updateOuterSea(y - 5);
    const belowHidden = !B.outerSea.visible;
    // 섬 자리에는 판이 없어야 한다 (겹치면 z-fighting 이 난다)
    const pos = B.outerSea.geometry.attributes.position.array;
    let insideIsland = 0, far = 0;
    for (let i = 0; i < pos.length; i += 3) {
      const px = pos[i], pz = pos[i + 2];
      if (px > 1 && px < B.WX - 1 && pz > 1 && pz < B.WZ - 1) insideIsland++;
      if (Math.abs(px) > 300 || Math.abs(pz) > 300) far++;
    }
    B.updateOuterSea(y + 5);
    B.endPlay(); B.setPaused(false);
    return { alignsWithWater, aboveVisible, belowHidden, insideIsland, far,
             verts: pos.length / 3 };
  });
  assert(r.alignsWithWater, "바깥 바다 높이가 물 윗면과 어긋난다 — 이음새가 보인다");
  assert(r.aboveVisible, "물 위에서 바깥 바다가 안 보인다");
  assert(r.belowHidden, "물속에서 바깥 바다 판이 머리 위로 지나간다");
  eq(r.insideIsland, 0, "섬 자리에도 판이 깔려 있다 — 진짜 물과 z-fighting 이 난다");
  assert(r.far > 0, "판이 시야 밖까지 뻗지 않는다 — 수평선이 안 생긴다");
  assert(r.verts <= 32, "판이 너무 잘게 쪼개져 있다 — " + r.verts + "정점");
});

test("v52 대량 편집: 조명을 칸마다 돌리지 않아 되돌리기가 빨라진다", async (page) => {
  const r = await page.evaluate(() => {
    const B = window.__blockyard;
    B.setPaused(true); B.generate(4242); B.relightAll(false); B.beginPlay();
    const X = 20, Y = 20, Z = 20, N = 28;
    B.S.selA = [X, Y, Z]; B.S.selB = [X + N - 1, Y + N - 1, Z + N - 1];
    B.S.history.length = 0; B.S.future.length = 0;
    let t = performance.now();
    const cells = B.fillSelection(B.B.GLASS, 0);
    const fill = performance.now() - t;
    t = performance.now(); B.undo(); const undo = performance.now() - t;
    t = performance.now(); B.redo(); const redo = performance.now() - t;
    // 결과가 맞아야 한다 — 빠르기만 하고 틀리면 소용없다
    let filled = 0;
    for (let dx = 0; dx < N; dx++) for (let dy = 0; dy < N; dy++) for (let dz = 0; dz < N; dz++)
      if (B.get(X + dx, Y + dy, Z + dz) === B.B.GLASS) filled++;
    B.undo();
    let back = 0;
    for (let dx = 0; dx < N; dx++) for (let dy = 0; dy < N; dy++) for (let dz = 0; dz < N; dz++)
      if (B.get(X + dx, Y + dy, Z + dz) === B.B.GLASS) back++;
    // 조명이 실제로 맞춰졌는가 — 유리 안쪽이 어둡지 않아야 한다(유리는 빛을 통과시킨다)
    B.redo();
    const lit = B.lightSky[B.idx(X + 1, Y + N - 2, Z + 1)];
    B.S.selA = B.S.selB = null; B.S.history.length = 0; B.S.future.length = 0;
    B.endPlay(); B.setPaused(false);
    return { cells, fill: +fill.toFixed(1), undo: +undo.toFixed(1), redo: +redo.toFixed(1),
             filled, back, lit, threshold: B.BATCH_RELIGHT_ALL };
  });
  // 앞 시험이 그 자리에 같은 블록을 남겨 두면 "바뀐 칸 수" 는 몇 개 적을 수 있다.
  // 중요한 건 **끝난 상태** — 전부 유리인가, 되돌리면 전부 사라지는가.
  eq(r.filled, 28 * 28 * 28, "채우기 뒤 전부 유리가 아니다");
  assert(r.cells >= 28 * 28 * 28 - 50, "바뀐 칸 수가 너무 적다 — " + r.cells);
  assert(r.back <= 50, "되돌리기가 원래대로 돌리지 못했다 — 유리 " + r.back + "칸 남음");
  assert(r.lit > 0, "묶음 뒤 조명이 안 맞춰졌다 — settleWorld 가 안 돌았다");
  assert(r.undo < 120, "큰 묶음 되돌리기가 느리다 — " + r.undo + "ms (칸마다 조명을 돌리고 있다)");
  assert(r.redo < 120, "큰 묶음 다시하기가 느리다 — " + r.redo + "ms");
  assert(r.threshold > 0, "묶음 임계값이 없다");
});

test("v53 미니맵: 걸어야 지도가 열리고, 저장에 남는다", async (page) => {
  const r = await page.evaluate(() => {
    const B = window.__blockyard;
    B.setPaused(true); B.beginPlay();
    B.generate(24680); B.relightAll(false);      // 새 세계는 흰 종이
    const fresh = B.seenRatio();
    B.player.pos.set(B.WX / 2, 30, B.WZ / 2);
    B.drawMinimap();
    const afterOne = B.seenRatio();
    // 섬을 가로질러 걸으면 더 열린다
    for (let x = 6; x < B.WX - 6; x += 6) {
      B.player.pos.set(x, 30, B.WZ / 2);
      B.drawMinimap();
    }
    const afterWalk = B.seenRatio();
    // 저장 왕복
    B.saveGame();
    const keys = Object.keys(JSON.parse(localStorage.getItem("blockyard.save")));
    const kept = afterWalk;
    B.generate(1); B.relightAll(false);
    const wiped = B.seenRatio();
    B.loadGame();
    const restored = B.seenRatio();
    B.endPlay(); B.setPaused(false);
    return { fresh, afterOne, afterWalk, hasKey: keys.indexOf("mm") >= 0, wiped, restored, kept };
  });
  eq(r.fresh, 0, "새 세계가 이미 밝혀져 있다 — 저 언덕 너머가 없다");
  assert(r.afterOne > 0 && r.afterOne < 0.25, "한자리에서 너무 많이/적게 열린다 — " + r.afterOne.toFixed(3));
  assert(r.afterWalk > r.afterOne, "걸어도 지도가 안 열린다");
  assert(r.hasKey, "밝힌 지도가 저장에 안 실린다");
  eq(r.wiped, 0, "새 세계가 지도를 안 지운다");
  near(r.restored, r.kept, 0.001, "불러오기 뒤 밝힌 지도가 안 돌아온다");
});

test("v54 붙여넣기: 90도 회전이 모양 방향까지 돌린다", async (page) => {
  const r = await page.evaluate(() => {
    const B = window.__blockyard;
    B.setPaused(true); B.beginPlay();
    const X = 60, Y = 40, Z = 12;
    for (let dx = -2; dx <= 10; dx++) for (let dz = -2; dz <= 10; dz++)
      for (let dy = -1; dy <= 4; dy++) B.set(X + dx, Y + dy, Z + dz, dy === -1 ? B.B.STONE : 0);
    B.refreshAllTops(); B.relightAll(false);
    // 3×1×1 막대 — 회전하면 1×1×3 이 되어야 한다. 끝에 북향 계단을 둔다.
    B.applyEdit(X, Y, Z, B.B.COBBLE, false, 0);
    B.applyEdit(X + 1, Y, Z, B.B.COBBLE, false, 0);
    B.applyEdit(X + 2, Y, Z, B.B.PLANKS, false, B.SH_STAIR_N);
    B.S.selA = [X, Y, Z]; B.S.selB = [X + 2, Y, Z];
    B.copySelection();
    const before = { w: B.S.clip.w, d: B.S.clip.d };
    const ok = B.rotateClip();
    const after = { w: B.S.clip.w, d: B.S.clip.d };
    // 붙여넣어 실제로 세로로 서는지 본다
    B.pasteClip(X, Y + 2, Z + 4);
    let vertical = 0;
    for (let k = 0; k < 3; k++) if (B.get(X, Y + 2, Z + 4 + k) !== 0) vertical++;
    // 계단 방향이 N → E 로 돌았는가
    let stairShape = -1;
    for (let k = 0; k < 3; k++) {
      const b = B.get(X, Y + 2, Z + 4 + k);
      if (b === B.B.PLANKS) stairShape = B.shapeAt(X, Y + 2, Z + 4 + k);
    }
    // 거울 — 동향 계단이 서향이 되어야 한다
    B.S.selA = [X, Y, Z]; B.S.selB = [X + 2, Y, Z];
    B.applyEdit(X + 2, Y, Z, B.B.PLANKS, false, B.SH_STAIR_E);
    B.copySelection();
    B.mirrorClip();
    B.pasteClip(X, Y + 2, Z + 8);
    let mirroredShape = -1, mirroredAt = -1;
    for (let k = 0; k < 3; k++)
      if (B.get(X + k, Y + 2, Z + 8) === B.B.PLANKS) { mirroredShape = B.shapeAt(X + k, Y + 2, Z + 8); mirroredAt = k; }
    const noClip = (function () { B.S.clip = null; return B.rotateClip(); })();
    B.S.selA = B.S.selB = null;
    B.endPlay(); B.setPaused(false);
    return { ok, before, after, vertical, stairShape, mirroredShape, mirroredAt,
             wantStair: B.SH_STAIR_E, wantMirror: B.SH_STAIR_W, noClip };
  });
  assert(r.ok, "회전이 실패했다");
  eq(r.before.w, 3, "복사한 가로");
  eq(r.after.w, 1, "회전 뒤 가로가 안 바뀌었다");
  eq(r.after.d, 3, "회전 뒤 세로가 안 바뀌었다");
  eq(r.vertical, 3, "돌린 것이 세로로 서지 않았다");
  eq(r.stairShape, r.wantStair, "계단 방향이 함께 돌지 않았다 (N → E)");
  eq(r.mirroredShape, r.wantMirror, "거울이 계단 방향을 안 뒤집었다 (E → W)");
  eq(r.mirroredAt, 0, "거울이 자리를 안 뒤집었다 — 끝에 있던 것이 반대쪽 끝으로 가야 한다");
  assert(!r.noClip, "복사한 게 없는데 회전이 성공했다고 한다");
});

test("v55 붙여넣기: 놓일 자리를 미리 보여 준다", async (page) => {
  const r = await page.evaluate(() => {
    const B = window.__blockyard;
    B.setPaused(true); B.beginPlay();
    const X = 34, Y = 40, Z = 66;
    for (let dx = -3; dx <= 8; dx++) for (let dz = -3; dz <= 8; dz++)
      for (let dy = -1; dy <= 6; dy++) B.set(X + dx, Y + dy, Z + dz, dy === -1 ? B.B.STONE : 0);
    B.refreshAllTops(); B.relightAll(false);
    // 복사가 없으면 상자도 없다
    B.S.clip = null;
    B.updatePasteBox(null, null);
    const hiddenNoClip = !B.pasteBox.visible;
    // 3×2×4 클립을 조준 자리에 놓았을 때
    const clip = { w: 3, h: 2, d: 4 };
    B.updatePasteBox(clip, [X, Y, Z]);
    const shown = B.pasteBox.visible;
    const sc = B.pasteBox.scale, po = B.pasteBox.position;
    B.updatePasteBox(clip, null);          // 조준한 곳이 없으면 감춘다
    const hiddenNoAim = !B.pasteBox.visible;
    B.S.clip = null;
    B.endPlay(); B.setPaused(false);
    return { hiddenNoClip, shown, hiddenNoAim,
             sx: +sc.x.toFixed(2), sy: +sc.y.toFixed(2), sz: +sc.z.toFixed(2),
             px: +po.x.toFixed(2), py: +po.y.toFixed(2), pz: +po.z.toFixed(2),
             wantX: X + 1.5, wantY: Y + 1, wantZ: Z + 2 };
  });
  assert(r.hiddenNoClip, "복사한 게 없는데 미리보기 상자가 보인다");
  assert(r.shown, "복사했는데 놓일 자리가 안 보인다");
  assert(r.hiddenNoAim, "허공을 봐도 상자가 남아 있다");
  near(r.sx, 3.04, 0.01, "미리보기 가로");
  near(r.sy, 2.04, 0.01, "미리보기 높이");
  near(r.sz, 4.04, 0.01, "미리보기 세로");
  near(r.px, r.wantX, 0.01, "미리보기 x 자리");
  near(r.py, r.wantY, 0.01, "미리보기 y 자리");
  near(r.pz, r.wantZ, 0.01, "미리보기 z 자리");
});

test("v56 청사진: RLE 로 줄어들고, 예전 청사진도 읽는다", async (page) => {
  const r = await page.evaluate(() => {
    const B = window.__blockyard;
    B.setPaused(true); B.beginPlay();
    const X = 14, Y = 40, Z = 70, N = 16;
    for (let dx = -1; dx <= N; dx++) for (let dz = -1; dz <= N; dz++)
      for (let dy = -1; dy <= N; dy++) B.set(X + dx, Y + dy, Z + dz, 0);
    for (let dx = 0; dx < N; dx++) for (let dy = 0; dy < N; dy++) for (let dz = 0; dz < N; dz++)
      B.applyEdit(X + dx, Y + dy, Z + dz, B.B.BRICK, false, 0);
    B.refreshAllTops();
    B.S.selA = [X, Y, Z]; B.S.selB = [X + N - 1, Y + N - 1, Z + N - 1];
    B.copySelection();
    const cells = B.S.clip.w * B.S.clip.h * B.S.clip.d;
    try { localStorage.removeItem("blockyard.blueprints"); } catch (e) {}
    B.saveBlueprint("시험");
    const raw = localStorage.getItem("blockyard.blueprints");
    const bytes = raw.length;
    // 예전 형식(숫자 배열)도 읽어야 한다
    const old = { w: 2, h: 1, d: 1, b: [B.B.STONE, B.B.GLASS], s: [0, 0] };
    localStorage.setItem("blockyard.blueprints", JSON.stringify({ 시험: JSON.parse(raw).시험, 옛것: old }));
    B.S.clip = null;
    const e1 = B.useBlueprint("시험");
    const newOk = !e1 && B.S.clip.w === N && B.S.clip.blocks[0] === B.B.BRICK;
    B.S.clip = null;
    const e2 = B.useBlueprint("옛것");
    const oldOk = !e2 && B.S.clip.w === 2 && B.S.clip.blocks[1] === B.B.GLASS;
    const names = B.blueprintNames().length;
    try { localStorage.removeItem("blockyard.blueprints"); } catch (e) {}
    B.S.clip = null; B.S.selA = B.S.selB = null;
    B.endPlay(); B.setPaused(false);
    return { cells, bytes, newOk, oldOk, names };
  });
  eq(r.cells, 4096, "복사한 칸 수");
  assert(r.bytes < 3000, "청사진이 여전히 크다 — " + r.bytes + "바이트 (RLE 가 안 먹었다)");
  assert(r.newOk, "새 형식 청사진을 못 읽는다");
  assert(r.oldOk, "예전 형식 청사진을 못 읽는다 — 저장해 둔 것이 사라진다");
  eq(r.names, 2, "청사진 목록");
});

test("v57 대량 편집: 묶음 기록이 객체가 아니라 타입 배열이다", async (page) => {
  const r = await page.evaluate(() => {
    const B = window.__blockyard;
    B.setPaused(true); B.generate(4242); B.relightAll(false); B.beginPlay();
    B.ac();                       // 오디오를 미리 데운다 — 안 그러면 첫 소리 115ms 가 섞인다
    B.tone(440, 0.02, "sine", 0.001);
    const X = 56, Y = 20, Z = 20, N = 28;   // v52 와 다른 자리 (같은 곳이면 서로 남긴 블록에 걸린다)
    B.S.selA = [X, Y, Z]; B.S.selB = [X + N - 1, Y + N - 1, Z + N - 1];
    B.S.history.length = 0; B.S.future.length = 0;
    let t = performance.now();
    B.fillSelection(B.B.GLASS, 0);
    const fill = performance.now() - t;
    const rec = B.S.history[B.S.history.length - 1];
    const typed = !!(rec && rec.batch && rec.batch.x && rec.batch.x.BYTES_PER_ELEMENT);
    const n = rec && rec.batch ? rec.batch.n : -1;
    t = performance.now(); B.undo(); const undo = performance.now() - t;
    let left = 0;
    for (let dx = 0; dx < N; dx++) for (let dy = 0; dy < N; dy++) for (let dz = 0; dz < N; dz++)
      if (B.get(X + dx, Y + dy, Z + dz) === B.B.GLASS) left++;
    B.S.selA = B.S.selB = null; B.S.history.length = 0; B.S.future.length = 0;
    B.endPlay(); B.setPaused(false);
    return { typed, n, fill: +fill.toFixed(1), undo: +undo.toFixed(1), left };
  });
  assert(r.typed, "묶음 기록이 아직 객체 배열이다 — 3만 칸이면 객체 3만 개다");
  // v52 가 같은 자리에 유리를 남겨 두면 "바뀐 칸" 이 몇 개 적다 — 절대값을 박지 않는다
  assert(r.n >= 28 * 28 * 28 - 50, "묶음에 담긴 칸 수가 너무 적다 — " + r.n);
  assert(r.left <= 50, "되돌리기가 원래대로 못 돌렸다 — 유리 " + r.left + "칸 남음");
  assert(r.fill < 120, "채우기가 느리다 — " + r.fill + "ms");
  assert(r.undo < 120, "되돌리기가 느리다 — " + r.undo + "ms");
});

test("v58 미니맵: B 표식이 실제로 그려진다", async (page) => {
  const r = await page.evaluate(() => {
    const B = window.__blockyard;
    B.setPaused(true); B.beginPlay();
    B.player.pos.set(B.WX / 2, 30, B.WZ / 2);
    B.markSeen(B.player.pos.x, B.player.pos.z, 30);   // 안개를 걷어 표식이 가려지지 않게
    B.S.marks.length = 0;
    B.drawMinimap();
    const c = document.getElementById("mm"), ctx = c.getContext("2d");
    function gold() {
      const d = ctx.getImageData(0, 0, c.width, c.height).data;
      let n = 0;
      for (let i = 0; i < d.length; i += 4)
        if (d[i] > 190 && d[i + 1] > 150 && d[i + 1] < 220 && d[i + 2] < 140) n++;
      return n;
    }
    const before = gold();
    for (let k = 0; k < 3; k++) B.S.marks.push([Math.floor(B.WX / 2) + k * 4 - 6, Math.floor(B.WZ / 2) + 3]);
    B.drawMinimap();
    const after = gold();
    B.S.marks.length = 0;
    B.endPlay(); B.setPaused(false);
    return { before, after };
  });
  assert(r.after > r.before, "표식을 찍어도 지도에 한 픽셀도 안 그려진다 — " + r.before + " → " + r.after);
  assert(r.after >= 6, "표식 세 개가 너무 흐리게 그려진다 — 금색 픽셀 " + r.after);
});

test("v58 과제: 유리 지붕(채광창)을 얹어도 '내 집' 이 뜬다", async (page) => {
  const r = await page.evaluate(() => {
    const B = window.__blockyard;
    B.setPaused(true); B.beginPlay();
    function house(X, Z, roof) {
      const Y = 40;
      for (let dx = -1; dx <= 7; dx++) for (let dz = -1; dz <= 7; dz++)
        for (let dy = -1; dy <= 7; dy++) B.set(X + dx, Y + dy, Z + dz, dy === -1 ? B.B.STONE : 0);
      for (let dx = 0; dx < 6; dx++) for (let dz = 0; dz < 6; dz++) for (let dy = 0; dy < 5; dy++) {
        const top = dy === 4;
        const edge = dx === 0 || dx === 5 || dz === 0 || dz === 5 || dy === 0 || top;
        if (!edge) { B.applyEdit(X + dx, Y + dy, Z + dz, B.B.AIR, true, 0); continue; }
        B.applyEdit(X + dx, Y + dy, Z + dz, top ? roof : B.B.PLANKS, true, 0);
      }
      B.applyEdit(X + 2, Y + 1, Z, B.B.DOOR, true, B.doorShapeFor(2, false));
      B.applyEdit(X + 2, Y + 2, Z, B.B.DOOR, true, B.doorShapeFor(2, false));
      B.refreshAllTops(); B.relightAll(false);
      delete B.S.earned.room;
      B.player.pos.set(X + 2.5, Y + 1, Z + 3.5);
      B.checkBuildAchievements();
      return !!B.S.earned.room;
    }
    const wood = house(12, 40, B.B.PLANKS);
    const glass = house(30, 40, B.B.GLASS);
    B.endPlay(); B.setPaused(false);
    return { wood, glass };
  });
  assert(r.wood, "나무 지붕 집도 '내 집' 이 안 뜬다 — 시험대가 틀렸다");
  assert(r.glass, "유리 지붕(채광창)을 얹으면 '내 집' 이 영영 안 뜬다");
});

test("v58 시각: 새 세계는 06:00 에 시작하고 시작 화면에서는 시계가 멈춘다", async (page) => {
  const r = await page.evaluate(() => {
    const B = window.__blockyard;
    B.setPaused(true);
    B.endPlay();                       // 시작 화면 상태
    const wasStarted = B.S.started;
    B.S.started = false;
    B.S.timeOfDay = 0.25;
    for (let i = 0; i < 300; i++) B.step(1 / 60);   // 5초
    const idle = B.S.timeOfDay;
    B.S.started = true;
    for (let i = 0; i < 300; i++) B.step(1 / 60);
    const playing = B.S.timeOfDay;
    B.S.started = wasStarted;
    B.setPaused(false);
    return { idle, playing, dflt: B.DEFAULT_TIME };
  });
  near(r.idle, 0.25, 1e-9, "시작 화면에서 시계가 돈다 — 소개문 읽는 사이 낮이 사라진다");
  assert(r.playing > 0.25, "플레이 중에는 시계가 돌아야 한다");
});

test("v59 되돌리기: 딸려 사라진 것도 함께 되살아난다", async (page) => {
  const r = await page.evaluate(() => {
    const B = window.__blockyard;
    B.setPaused(true); B.beginPlay();
    const X = 76, Y = 44, Z = 76;
    for (let dx = -3; dx <= 3; dx++) for (let dz = -3; dz <= 3; dz++)
      for (let dy = -2; dy <= 5; dy++) B.set(X + dx, Y + dy, Z + dz, 0);
    B.refreshAllTops(); B.relightAll(false);

    // (1) 받침돌 위 횃불 — 돌을 캐면 횃불도 사라진다. 되돌리면 둘 다 돌아와야 한다
    for (let k = -1; k <= 1; k++) B.applyEdit(X + k, Y, Z, B.B.STONE, false, 0);
    for (let k = -1; k <= 1; k++) B.applyEdit(X + k, Y + 1, Z, B.B.TORCH, false, 0);
    B.S.history.length = 0; B.S.future.length = 0;
    B.applyEdit(X, Y, Z, B.B.AIR, true);          // 가운데 받침돌을 캔다
    const torchGone = B.get(X, Y + 1, Z) === 0;
    B.undo();
    const stoneBack = B.get(X, Y, Z) === B.B.STONE;
    const torchBack = B.get(X, Y + 1, Z) === B.B.TORCH;

    // (2) 문 아랫칸만 비우면 두 칸이 사라진다 — 되돌리면 두 칸 다 돌아와야 한다
    for (let dy = 0; dy <= 3; dy++) B.set(X + 2, Y + dy, Z + 2, 0);
    B.set(X + 2, Y - 1, Z + 2, B.B.STONE);
    B.refreshAllTops();
    B.applyEdit(X + 2, Y, Z + 2, B.B.DOOR, false, B.doorShapeFor(2, false));
    B.applyEdit(X + 2, Y + 1, Z + 2, B.B.DOOR, false, B.doorShapeFor(2, false));
    B.S.history.length = 0; B.S.future.length = 0;
    B.applyEdit(X + 2, Y - 1, Z + 2, B.B.AIR, true);   // 문 밑바닥을 캔다
    const bothGone = B.get(X + 2, Y, Z + 2) === 0 && B.get(X + 2, Y + 1, Z + 2) === 0;
    B.undo();
    const lowBack = B.get(X + 2, Y, Z + 2) === B.B.DOOR;
    const highBack = B.get(X + 2, Y + 1, Z + 2) === B.B.DOOR;

    B.S.history.length = 0; B.S.future.length = 0;
    B.endPlay(); B.setPaused(false);
    return { torchGone, stoneBack, torchBack, bothGone, lowBack, highBack };
  });
  assert(r.torchGone, "받침돌을 캤는데 횃불이 안 사라졌다 — 시험대가 틀렸다");
  assert(r.stoneBack, "되돌렸는데 돌이 안 돌아왔다");
  assert(r.torchBack, "딸려 사라진 횃불이 안 돌아온다 — 되돌리기로 물건을 잃는다");
  assert(r.bothGone, "문 밑을 캤는데 두 칸이 안 사라졌다");
  assert(r.lowBack && r.highBack, "되돌리니 반쪽 문만 돌아왔다 — 허공에 반쪽이 남는다");
});

test("v60 배려 설정: 흔들림 줄이기와 웅크리기 전환", async (page) => {
  const r = await page.evaluate(() => {
    const B = window.__blockyard;
    const keepSteady = B.opts.steady, keepTog = B.opts.sneaktog, keepFov = B.opts.fov;
    B.setPaused(true); B.beginPlay();

    // (1) 흔들림 줄이기 — 달려도 시야각이 움직이지 않는다
    B.opts.steady = 0;
    const calmOff = B.calmMotion();
    B.opts.steady = 1;
    const calmOn = B.calmMotion();
    B.S.bobAmount = 1; B.S.sprintingNow = true;
    // v93 부터 세로 화각은 창 모양을 탄다 (좁은 창에서 가로 시야를 지킨다) —
    // 기준은 opts.fov 가 아니라 그 보정을 거친 값이다
    const restFov = B.fovForAspect(B.opts.fov, B.camera.aspect);
    B.S.fovNow = restFov;
    for (let k = 0; k < 40; k++) B.step(1 / 60);
    const fovDrift = Math.abs(B.camera.fov - restFov);
    const bobDrift = Math.abs(B.camera.position.y - (B.player.pos.y + B.EYE - B.S.sneakEye));
    B.opts.steady = 0;

    // (2) 웅크리기 전환 — Shift 를 떼어도 웅크린 채로 남는다
    B.opts.sneaktog = 1;
    B.S.keys.ShiftLeft = false; B.S.crouchWas = false; B.S.sneakLatch = false;
    B.player.flying = false;
    B.S.keys.ShiftLeft = true;  B.step(1 / 60);
    const onWhileHeld = B.getSneak();
    B.S.keys.ShiftLeft = false; B.step(1 / 60);
    const stillOn = B.getSneak();                 // 손을 떼도 유지
    B.S.keys.ShiftLeft = true;  B.step(1 / 60);
    B.S.keys.ShiftLeft = false; B.step(1 / 60);
    const offAgain = B.getSneak();                // 한 번 더 누르면 풀린다

    // (3) 전환을 끄면 예전처럼 누르고 있는 동안만
    B.opts.sneaktog = 0;
    B.S.keys.ShiftLeft = true;  B.step(1 / 60);
    const holdOn = B.getSneak();
    B.S.keys.ShiftLeft = false; B.step(1 / 60);
    const holdOff = B.getSneak();

    B.opts.steady = keepSteady; B.opts.sneaktog = keepTog; B.opts.fov = keepFov;
    B.S.keys.ShiftLeft = false; B.S.sneakLatch = false; B.S.crouchWas = false;
    B.S.bobAmount = 0; B.S.sprintingNow = false;
    B.endPlay(); B.setPaused(false);
    return { calmOff, calmOn, fovDrift, bobDrift, onWhileHeld, stillOn, offAgain, holdOn, holdOff };
  });
  eq(r.calmOff, false, "흔들림 줄이기를 껐는데 켜진 것으로 읽힌다");
  eq(r.calmOn, true, "흔들림 줄이기를 켰는데 안 먹는다");
  assert(r.fovDrift < 0.05, "흔들림을 줄였는데 달릴 때 시야각이 움직인다: " + r.fovDrift);
  assert(r.bobDrift < 1e-6, "흔들림을 줄였는데 머리가 위아래로 흔들린다: " + r.bobDrift);
  assert(r.onWhileHeld, "전환식인데 Shift 를 눌러도 안 웅크린다");
  assert(r.stillOn, "전환식인데 Shift 를 떼자 풀렸다 — 전환이 아니다");
  eq(r.offAgain, false, "전환식인데 한 번 더 눌러도 안 풀린다");
  assert(r.holdOn, "전환을 껐는데 Shift 로 안 웅크린다");
  eq(r.holdOff, false, "전환을 껐는데 Shift 를 떼도 웅크린 채로 남는다");
});

test("v60 과제: 가만히 서 있기만 해서는 발밑 과제가 안 열린다", async (page) => {
  const r = await page.evaluate(() => {
    const B = window.__blockyard;
    B.setPaused(true); B.beginPlay();
    const X = 20, Y = 44, Z = 76;
    for (let dx = -2; dx <= 2; dx++) for (let dz = -2; dz <= 2; dz++)
      for (let dy = -1; dy <= 4; dy++) B.set(X + dx, Y + dy, Z + dz, 0);
    B.applyEdit(X, Y - 1, Z, B.B.ICE, false, 0);
    B.refreshAllTops(); B.relightAll(false);
    B.player.pos.set(X + 0.5, Y, Z + 0.5);
    B.player.vel.set(0, 0, 0); B.player.flying = false;

    delete B.S.earned.ice;
    B.S.walked = 0; B.S.achPrevX = null; B.S.achPrevZ = null;
    for (let k = 0; k < 60; k++) B.step(1 / 60);      // 1초 — 과제 타이머가 두 번 돈다
    const idleEarned = !!B.S.earned.ice;

    B.S.walked = 20;                                   // 실제로 걸어 다녔다면
    B.player.pos.set(X + 0.5, Y, Z + 0.5);
    for (let k = 0; k < 60; k++) B.step(1 / 60);
    const walkedEarned = !!B.S.earned.ice;

    B.endPlay(); B.setPaused(false);
    return { idleEarned, walkedEarned };
  });
  eq(r.idleEarned, false, "스폰 자리에 가만히 서 있었는데 첫 과제가 열렸다");
  assert(r.walkedEarned, "8칸을 걸었는데도 발밑 과제가 안 열린다");
});

test("v60 미니맵: 지하를 걸었다고 지상 지도가 밝혀지지 않는다", async (page) => {
  const r = await page.evaluate(() => {
    const B = window.__blockyard;
    B.setPaused(true); B.beginPlay();
    const X = 40, Z = 40;
    // 지붕을 두껍게 덮은 굴 — 여기 서면 미니맵이 "지하" 로 넘어간다
    for (let dx = -3; dx <= 3; dx++) for (let dz = -3; dz <= 3; dz++) {
      for (let dy = 0; dy <= 3; dy++) B.set(X + dx, 20 + dy, Z + dz, 0);
      for (let dy = 6; dy <= 12; dy++) B.set(X + dx, 20 + dy, Z + dz, B.B.STONE);
    }
    B.refreshAllTops();
    B.seenMap.fill(0);
    B.player.pos.set(X + 0.5, 21, Z + 0.5);
    B.player.vel.set(0, 0, 0); B.player.flying = true;
    B.drawMinimap();
    const under = B.S.mmUnder;
    const cell = B.seenMap[Z * B.WX + X];
    const ratioUnder = B.seenRatio();

    // 지상으로 올라오면 그제야 지상 비트가 켜진다
    B.player.pos.set(X + 0.5, 40, Z + 0.5);
    B.drawMinimap();
    const cell2 = B.seenMap[Z * B.WX + X];
    const ratioTop = B.seenRatio();

    B.player.flying = false;
    B.endPlay(); B.setPaused(false);
    return { under, cell, ratioUnder, cell2, ratioTop,
             TOP: B.SEEN_TOP, UNDER: B.SEEN_UNDER,
             band: B.underBand(21), ALL: B.SEEN_UNDER_ALL, sea: B.SEA };
  });
  assert(r.under, "지붕 아래인데 미니맵이 지하로 안 넘어갔다 — 시험대가 틀렸다");
  // 지하는 세 겹이다 (v81) — 서 있던 **그 층**만 밝혀져야 한다
  eq(r.cell & r.band, r.band, "지하를 걸었는데 그 층의 지도가 안 밝혀졌다");
  eq(r.cell & r.ALL, r.band,
     "한 층만 걸었는데 지하 " + (r.cell & r.ALL).toString(2) + " 층이 밝혀졌다 — 층을 나눈 뜻이 없다");
  eq(r.cell & r.TOP, 0, "굴만 파고 다녔는데 지상 지도가 밝혀졌다 — 가 본 적 없는 산이 보인다");
  eq(r.ratioUnder, 0, "지도장이 과제가 지하만 걸어도 올라간다");
  eq(r.cell2 & r.TOP, r.TOP, "지상으로 올라왔는데 지상 지도가 안 밝혀졌다");
  assert(r.ratioTop > 0, "지상을 걸었는데 지도장이 진척이 0이다");
});

test("v61 나무: 세계 생성과 묘목이 같은 그림을 쓴다", async (page) => {
  const r = await page.evaluate(() => {
    const B = window.__blockyard;
    B.setPaused(true); B.beginPlay();
    const X = 12, Y = 40, Z = 12;
    for (let dx = -4; dx <= 4; dx++) for (let dz = -4; dz <= 4; dz++)
      for (let dy = 0; dy <= 14; dy++) B.set(X + dx, Y + dy, Z + dz, 0);
    B.set(X, Y, Z, B.B.GRASS);
    B.refreshAllTops();

    // tree.js 를 직접 불러 심는다 — 묘목이 자랄 때 탈 바로 그 길이다
    let n = 0;
    const ok = B.growTree(X, Y, Z, 0, B.B.LOG, B.B.LEAVES,
      () => { n++; return 0.5; },                    // 난수를 고정해 결과를 못 박는다
      (x, y, z) => B.get(x, y, z),
      (x, y, z, b) => B.applyEdit(x, y, z, b, false, 0),
      B.B.AIR, B.WY);

    let logs = 0, leaves = 0;
    for (let dx = -3; dx <= 3; dx++) for (let dz = -3; dz <= 3; dz++)
      for (let dy = 1; dy <= 12; dy++) {
        const b = B.get(X + dx, Y + dy, Z + dz);
        if (b === B.B.LOG) logs++;
        if (b === B.B.LEAVES) leaves++;
      }
    const trunkOnSoil = B.get(X, Y + 1, Z) === B.B.LOG;
    // 잎이 줄기 위에 있는가 — 우듬지가 땅에 박히면 나무가 아니다
    const crownAbove = B.get(X, Y + logs, Z) === B.B.LOG && leaves > 0;

    // 천장에 붙은 자리에는 심지 않는다 (묘목이 동굴 천장 밑에서 자라면 안 된다)
    const tall = B.growTree(X, B.WY - 3, Z, 0, B.B.LOG, B.B.LEAVES,
      () => 0.5, (x, y, z) => B.get(x, y, z), () => {}, B.B.AIR, B.WY);

    B.endPlay(); B.setPaused(false);
    return { ok, logs, leaves, trunkOnSoil, crownAbove, tall, rolls: n };
  });
  assert(r.ok, "평지에 나무를 못 심었다");
  assert(r.trunkOnSoil, "줄기가 땅 바로 위에서 시작하지 않는다");
  assert(r.logs >= 4 && r.logs <= 7, "줄기 높이가 4~7 을 벗어난다: " + r.logs);
  assert(r.leaves > 8, "잎이 " + r.leaves + "장뿐이다 — 우듬지가 안 생겼다");
  assert(r.crownAbove, "잎이 줄기 위에 얹히지 않았다");
  eq(r.tall, false, "천장에 닿는 자리인데도 나무를 심었다");
});

test("v62 묘목: 심어 두면 나무가 되고, 되돌리기 한 번에 사라진다", async (page) => {
  const r = await page.evaluate(() => {
    const B = window.__blockyard;
    B.setPaused(true); B.beginPlay();
    const X = 84, Y = 46, Z = 20;
    for (let dx = -5; dx <= 5; dx++) for (let dz = -5; dz <= 5; dz++)
      for (let dy = -1; dy <= 16; dy++) B.set(X + dx, Y + dy, Z + dz, 0);
    for (let dx = -5; dx <= 5; dx++) for (let dz = -5; dz <= 5; dz++)
      B.set(X + dx, Y - 1, Z + dz, B.B.GRASS);
    B.refreshAllTops(); B.relightAll(false);

    // (1) 흙 위에 심으면 자란다
    B.applyEdit(X, Y, Z, B.B.SAPLING, false, 0);
    const planted = B.get(X, Y, Z) === B.B.SAPLING;
    B.S.history.length = 0; B.S.future.length = 0;
    // 앞선 시험이 남긴 파편이 있을 수 있다 — 절대값이 아니라 늘어났는지를 본다 (v36 교훈)
    const puffBefore = B.pCount();
    let ticks = 0;
    while (B.get(X, Y, Z) === B.B.SAPLING && ticks < 400) { B.growTick(1.0); ticks++; }
    const grew = B.get(X, Y, Z) === B.B.LOG || B.get(X, Y, Z) === B.B.BIRCH_LOG;
    let leaves = 0;
    for (let dx = -3; dx <= 3; dx++) for (let dz = -3; dz <= 3; dz++)
      for (let dy = 0; dy <= 12; dy++) {
        const b = B.get(X + dx, Y + dy, Z + dz);
        if (b === B.B.LEAVES || b === B.B.BIRCH_LEAVES || b === B.B.SPRUCE_LEAVES) leaves++;
      }
    // 자란 나무는 한 번에 되돌아온다 (묶음 한 개)
    const hist = B.S.history.length;
    B.undo();
    let leftover = 0;
    for (let dx = -3; dx <= 3; dx++) for (let dz = -3; dz <= 3; dz++)
      for (let dy = 0; dy <= 12; dy++) {
        const b = B.get(X + dx, Y + dy, Z + dz);
        if (b !== B.B.AIR) leftover++;
      }

    // 자란 순간에 잎조각이 튄다 — 옆에 서 있다가 소리 없이 솟으면 무슨 일인지 모른다
    const puffed = B.pCount() > puffBefore;

    // (2) 돌 위에서는 자라지 않는다 (마크와 같다)
    const SX = X + 4;
    B.applyEdit(SX, Y - 1, Z, B.B.STONE, false, 0);
    B.applyEdit(SX, Y, Z, B.B.SAPLING, false, 0);
    for (let k = 0; k < 200; k++) B.growTick(1.0);
    const onStone = B.get(SX, Y, Z) === B.B.SAPLING;

    // (3) 어두운 방에서는 자라지 않는다 — 사방을 막은 방을 짓는다
    const DX = X - 4;
    B.applyEdit(DX, Y, Z, B.B.SAPLING, false, 0);
    for (let dx = -2; dx <= 2; dx++) for (let dz = -2; dz <= 2; dz++) {
      B.applyEdit(DX + dx, Y + 8, Z + dz, B.B.STONE, false, 0);       // 지붕
      if (Math.abs(dx) === 2 || Math.abs(dz) === 2)
        for (let dy = 0; dy < 8; dy++) B.applyEdit(DX + dx, Y + dy, Z + dz, B.B.STONE, false, 0);
    }
    B.relightAll(false);
    const darkLv = Math.max(B.lightSky[B.idx(DX, Y, Z)], B.lightBlk[B.idx(DX, Y, Z)]);
    for (let k = 0; k < 200; k++) B.growTick(1.0);
    const inDark = B.get(DX, Y, Z) === B.B.SAPLING;

    // (5) 밝아도 천장이 낮으면 자라지 않는다 — 뚫고 올라오면 지어 둔 것이 부서진다
    const LX = X, LZ = Z - 4;
    B.applyEdit(LX, Y, LZ, B.B.SAPLING, false, 0);
    B.applyEdit(LX, Y + 3, LZ, B.B.GLASS, false, 0);      // 유리라 빛은 그대로 든다
    B.relightAll(false);
    const lowLv = Math.max(B.lightSky[B.idx(LX, Y, LZ)], B.lightBlk[B.idx(LX, Y, LZ)]);
    for (let k = 0; k < 200; k++) B.growTick(1.0);
    const underRoof = B.get(LX, Y, LZ) === B.B.SAPLING && B.get(LX, Y + 3, LZ) === B.B.GLASS;

    // (4) 진짜 저장→불러오기를 거친 뒤에도 자란다.
    // 큐는 저장하지 않으므로 loadGame 이 다시 담으라고 신호해야 한다.
    // 신호를 손으로 세우면 "부르는 쪽이 세우는가" 를 못 본다 — 실제로 부팅 복원 경로가 빠져 있었다.
    const RX = X, RZ = Z + 4;
    B.applyEdit(RX, Y, RZ, B.B.SAPLING, false, 0);
    const slotKey = B.curKey();          // 진짜 저장 키다 — 손으로 지어내면 남의 슬롯을 덮어쓴다
    const keepSave = localStorage.getItem(slotKey);
    B.saveGame();
    B.resetQueues();                 // 큐를 통째로 비운다 (세계 전환이 하는 것과 같다)
    const emptied = B.Q.growQ.length;
    const loaded = B.loadGame();
    const signalled = B.S.growDirty;
    let ticks2 = 0;
    while (B.get(RX, Y, RZ) === B.B.SAPLING && ticks2 < 400) { B.growTick(1.0); ticks2++; }
    const regrew = B.get(RX, Y, RZ) !== B.B.SAPLING;
    if (keepSave === null) localStorage.removeItem(slotKey);
    else localStorage.setItem(slotKey, keepSave);

    // (5b) 진짜 프레임으로도 시계가 제 속도로 간다.
    // growTick 을 직접 부르는 시험만 있으면, 이걸 0.15초짜리 블록 안에 두어
    // 9배 느려져도 아무도 모른다 (실제로 그랬다).
    const TX = X + 8, TZ = Z;
    for (let dy = 0; dy <= 10; dy++) B.set(TX, Y + dy, TZ, 0);
    B.set(TX, Y - 1, TZ, B.B.GRASS);
    B.refreshAllTops(); B.relightAll(false);
    B.player.pos.set(TX + 9.5, Y, TZ + 9.5);
    B.applyEdit(TX, Y, TZ, B.B.SAPLING, false, 0);
    B.Q.growTimer = 0;
    for (let k = 0; k < 60; k++) B.step(1 / 60);      // 1초
    const clock = B.Q.growTimer;

    // (6) 사람이 그 자리에 서 있으면 자라지 않는다 — 줄기 속에 갇히면 나갈 수가 없다
    const PX = X, PZ = Z + 8;
    for (let dy = 0; dy <= 10; dy++) B.set(PX, Y + dy, PZ, 0);
    B.set(PX, Y - 1, PZ, B.B.GRASS);
    B.refreshAllTops(); B.relightAll(false);
    B.applyEdit(PX, Y, PZ, B.B.SAPLING, false, 0);
    B.player.pos.set(PX + 0.5, Y, PZ + 0.5);
    B.player.vel.set(0, 0, 0); B.player.flying = true;   // 떨어져 벗어나지 않게
    for (let k = 0; k < 300; k++) B.growTick(1.0);
    const onPlayer = B.get(PX, Y, PZ) === B.B.SAPLING;
    // 비켜서면 그제야 자란다
    B.player.pos.set(PX + 6.5, Y, PZ + 6.5);
    let ticks3 = 0;
    while (B.get(PX, Y, PZ) === B.B.SAPLING && ticks3 < 400) { B.growTick(1.0); ticks3++; }
    const afterStepAside = B.get(PX, Y, PZ) !== B.B.SAPLING;
    B.player.flying = false;

    B.S.history.length = 0; B.S.future.length = 0;
    B.endPlay(); B.setPaused(false);
    return { planted, grew, leaves, hist, leftover, onStone, inDark, regrew, ticks, darkLv, lowLv, underRoof, puffed, onPlayer, afterStepAside, clock, emptied, loaded, signalled };
  });
  assert(r.planted, "묘목이 안 놓인다 — 블록 등록이 빠졌다");
  assert(r.grew, `묘목이 ${r.ticks}초를 기다려도 안 자란다`);
  assert(r.leaves > 8, "자란 나무에 잎이 " + r.leaves + "장뿐이다");
  eq(r.hist, 1, "나무 한 그루가 되돌리기 " + r.hist + "개를 먹었다 — Ctrl+Z 한 번이어야 한다");
  eq(r.leftover, 0, "되돌렸는데 " + r.leftover + "칸이 남았다 — 나무가 반쯤 지워졌다");
  assert(r.onStone, "돌 위의 묘목이 자랐다 — 마크에서는 안 자란다");
  assert(r.darkLv < 9, "시험대가 안 어둡다 — 빛이 " + r.darkLv + " 이다");
  assert(r.inDark, "어두운 방인데 묘목이 자랐다 — 빛 조건이 안 걸린다");
  assert(r.lowLv >= 9, "시험대가 어둡다 — 낮은 천장만 보려는데 빛이 " + r.lowLv + " 이다");
  assert(r.underRoof, "천장이 낮은데 묘목이 자랐다 — 나무가 지붕을 뚫는다");
  eq(r.emptied, 0, "시험대가 안 섰다 — 큐를 비웠는데 " + r.emptied + "개가 남았다");
  assert(r.loaded, "저장을 못 불러왔다 — 시험대가 틀렸다");
  assert(r.signalled, "loadGame 이 자람 큐를 다시 담으라고 신호하지 않는다");
  assert(r.regrew, "불러온 세계의 묘목이 영영 안 자란다 — 큐를 다시 안 채웠다");
  assert(r.puffed, "나무가 소리도 잎조각도 없이 솟았다 — 무슨 일이 난 건지 알 수 없다");
  assert(r.onPlayer, "사람이 선 자리에서 나무가 자랐다 — 줄기 속에 갇힌다");
  assert(r.afterStepAside, "비켜섰는데도 안 자란다");
  // 1초를 돌렸으면 시계도 1초 가 있어야 한다. 자라 버렸으면 0으로 돌아가 있으니 그것도 통과.
  assert(r.clock > 0.8 || r.clock === 0,
         "1초를 돌렸는데 자람 시계가 " + r.clock.toFixed(2) + "초만 갔다 — 묘목이 그만큼 느리게 자란다");
});

test("v63 청사진: 메뉴에서 목록을 보고 불러오고 지운다", async (page) => {
  const r = await page.evaluate(() => {
    const B = window.__blockyard;
    B.setPaused(true); B.beginPlay();
    const before = localStorage.getItem("blockyard.blueprints");
    localStorage.removeItem("blockyard.blueprints");

    const X = 30, Y = 44, Z = 62;
    for (let dx = 0; dx < 3; dx++) for (let dy = 0; dy < 2; dy++) for (let dz = 0; dz < 4; dz++)
      B.applyEdit(X + dx, Y + dy, Z + dz, B.B.BRICK, false, 0);
    B.S.selA = [X, Y, Z]; B.S.selB = [X + 2, Y + 1, Z + 3];
    B.copySelection();
    const saved = B.saveBlueprint("작은 집");
    // 이름을 마크업으로 지어도 글자로만 보여야 한다
    B.saveBlueprint("<b>굵게</b>");

    B.refreshBlueprints();
    const grid = document.getElementById("bpgrid");
    const rows = grid.querySelectorAll(".bp");
    const names = [].map.call(grid.querySelectorAll(".bp b"), (e) => e.textContent);
    const injected = grid.querySelectorAll(".bp b b").length;   // 마크업으로 새면 0이 아니다
    const sizeText = grid.querySelector(".bp span").textContent;

    // 불러오기 단추가 실제로 클립보드를 채운다
    B.S.clip = null;
    const useBtn = [].filter.call(grid.querySelectorAll(".bp"),
      (e) => e.querySelector("b").textContent === "작은 집")[0].querySelectorAll("button")[0];
    useBtn.click();
    const clipW = B.S.clip ? B.S.clip.w : -1;
    const clipD = B.S.clip ? B.S.clip.d : -1;

    // 지우면 목록에서 빠진다
    B.deleteBlueprint("<b>굵게</b>");
    B.refreshBlueprints();
    const after = grid.querySelectorAll(".bp").length;

    // 하나도 없으면 안내 문구가 뜬다
    B.deleteBlueprint("작은 집");
    B.refreshBlueprints();
    const emptyText = (grid.querySelector(".empty") || {}).textContent || "";

    if (before === null) localStorage.removeItem("blockyard.blueprints");
    else localStorage.setItem("blockyard.blueprints", before);
    B.S.selA = B.S.selB = null; B.S.clip = null;
    B.S.history.length = 0; B.S.future.length = 0;
    B.endPlay(); B.setPaused(false);
    return { saved, rows: rows.length, names, injected, sizeText, clipW, clipD, after, emptyText };
  });
  eq(r.saved, "", "청사진 저장이 실패했다: " + r.saved);
  eq(r.rows, 2, "메뉴에 청사진이 " + r.rows + "줄 떴다 — 2줄이어야 한다");
  assert(r.names.indexOf("작은 집") >= 0, "저장한 이름이 목록에 없다: " + r.names.join(", "));
  eq(r.injected, 0, "청사진 이름이 마크업으로 새어 들어갔다 — textContent 로 넣어야 한다");
  assert(/3×2×4/.test(r.sizeText), "크기가 안 보인다 — 이름만으로는 어느 건물인지 모른다: " + r.sizeText);
  eq(r.clipW, 3, "불러오기 단추가 클립보드를 안 채운다");
  eq(r.clipD, 4, "불러온 청사진의 깊이가 다르다");
  eq(r.after, 1, "지웠는데 목록이 " + r.after + "줄이다");
  assert(/없습니다/.test(r.emptyText), "청사진이 없을 때 안내 문구가 안 뜬다");
});

test("v63 블록 목록: 새 블록이 화면까지 닿는다", async (page) => {
  const r = await page.evaluate(() => {
    const B = window.__blockyard;
    // ALL_BLOCKS 에 있는 것은 전부 목록에 단추가 있어야 한다 —
    // 등록만 하고 화면에 못 올린 블록은 게임 안에서 존재하지 않는 것과 같다 (v58 부류)
    const listed = B.pickBtns.map((p) => p.block);
    const missing = [];
    for (const id of B.ALL_BLOCKS) if (listed.indexOf(id) < 0) missing.push(B.NAMES[id] || id);
    const btns = B.pickBtns;
    // 갈래 탭에도 실제로 들어가야 한다 — "전체" 에만 있으면 탭으로는 못 찾는다
    const noCat = B.pickBtns.filter((p) => !p.cat).map((p) => p.name);
    // 이름으로 찾기가 되는가
    const find = document.getElementById("pick-find");
    const keep = find.value;
    find.value = "묘목";
    const bySearch = B.refreshPickFilter();       // v92 부터 묘목은 세 종이다
    find.value = "sapling";
    const byEnglish = B.refreshPickFilter();
    find.value = "가문비 묘목";
    const byOne = B.refreshPickFilter();          // 종을 짚어 찾으면 하나만
    find.value = keep;
    B.refreshPickFilter();
    const sap = B.pickBtns.filter((p) => p.block === B.B.SAPLING)[0];
    // 목록에는 도구(부싯돌)도 함께 뜬다 — 놓는 블록은 아니지만 손에 쥘 수는 있다
    const sapCats = [B.B.SAPLING, B.B.SAPLING_BIRCH, B.B.SAPLING_SPRUCE]
      .map((k) => (B.pickBtns.filter((p) => p.block === k)[0] || {}).cat);
    return { missing, total: btns.length, all: B.ALL_BLOCKS.length + B.ITEMS.length, bySearch, byEnglish, byOne, noCat, sapCat: sap && sap.cat, sapCats };
  });
  eq(r.missing.length, 0, "블록 목록에 안 뜨는 블록: " + r.missing.join(", "));
  eq(r.total, r.all, "목록 단추가 " + r.total + "개인데 블록+도구는 " + r.all + "종이다");
  eq(r.bySearch, 3, "이름 '묘목' 으로 찾으니 " + r.bySearch + "개가 나온다 — 세 종이라야 한다");
  eq(r.byEnglish, 3, "영문 'sapling' 으로 찾으니 " + r.byEnglish + "개가 나온다");
  eq(r.byOne, 1, "'가문비 묘목' 으로 찾으니 " + r.byOne + "개가 나온다 — 종을 짚으면 하나라야 한다");
  eq(r.noCat.length, 0, "갈래가 없는 블록: " + r.noCat.join(", "));
  eq(r.sapCat, "nature", "묘목이 '자연' 갈래에 없다 — 탭으로는 못 찾는다");
  assert(r.sapCats.every((c) => c === "nature"),
     "묘목 세 종의 갈래가 갈렸다: " + r.sapCats.join(","));
});

test("v64 묘목 성능: 큐가 프레임을 잡아먹지 않는다", async (page) => {
  const r = await page.evaluate(() => {
    const B = window.__blockyard;
    B.setPaused(true); B.beginPlay();
    function measure(n) {
      for (let k = 0; k < 30; k++) B.step(1 / 60);      // 예열
      const t = performance.now();
      for (let k = 0; k < n; k++) B.step(1 / 60);
      return (performance.now() - t) / n;
    }
    // 앞선 묘목 시험이 안 자란 묘목을 큐에 남겨 둔다 — 세는 양은 첫 줄에서 못 박는다 (교훈 12)
    B.Q.growQ.length = 0;
    // 묘목 60그루를 심는다. 천장을 덮어 자라지 않게 해 큐에 계속 남긴다.
    const X = 20, Y = 40, Z = 20;
    let planted = 0;
    for (let dx = 0; dx < 10 && planted < 60; dx++)
      for (let dz = 0; dz < 6 && planted < 60; dz++) {
        const x = X + dx * 2, z = Z + dz * 2;
        for (let dy = -1; dy <= 6; dy++) B.set(x, Y + dy, z, 0);
        B.set(x, Y - 1, z, B.B.GRASS);
        B.applyEdit(x, Y, z, B.B.SAPLING, false, 0);
        B.applyEdit(x, Y + 2, z, B.B.STONE, false, 0);
        planted++;
      }
    B.refreshAllTops(); B.relightAll(false);
    // 방금 블록 120개를 놓았다 — 청크 재굽기가 가라앉기를 기다린다.
    // 안 기다리면 재굽기 비용이 통째로 얹혀 38배로 읽힌다 (v57 에서 겪은 함정)
    for (let k = 0; k < 400; k++) B.step(1 / 60);
    const withQ = measure(120);
    // 같은 세계에서 큐만 비워 다시 잰다 — 차이가 정말 growTick 인지 본다
    const keepQ = B.Q.growQ.slice();
    B.Q.growQ.length = 0;
    const noQ = measure(120);
    B.Q.growQ = keepQ;
    const q = B.Q.growQ.length;

    // 뒷정리 — 심은 것을 걷어 다음 시험에 남기지 않는다
    for (let dx = 0; dx < 10; dx++) for (let dz = 0; dz < 6; dz++) {
      const x = X + dx * 2, z = Z + dz * 2;
      B.applyEdit(x, Y, z, B.B.AIR, false);
      B.applyEdit(x, Y + 2, z, B.B.AIR, false);
    }
    B.Q.growQ.length = 0;
    B.S.history.length = 0; B.S.future.length = 0;
    B.endPlay(); B.setPaused(false);
    return { withQ: +withQ.toFixed(3), noQ: +noQ.toFixed(3), q, planted };
  });
  eq(r.planted, 60, "시험대가 안 섰다 — 묘목 " + r.planted + "그루만 심혔다");
  eq(r.q, 60, "묘목 " + r.q + "그루만 큐에 남았다 — 천장을 덮었는데 자라 버렸다");
  // 절대 ms 는 기계마다 다르다. 같은 세계에서 큐만 비워 잰 값과 견준다.
  assert(r.withQ - r.noQ < 0.5,
         "묘목 60그루가 프레임에 " + (r.withQ - r.noQ).toFixed(3) + "ms 를 더한다 — 숲을 심으면 끊긴다");
});

test("v65 비행: 날면서도 달린다", async (page) => {
  const r = await page.evaluate(() => {
    const B = window.__blockyard;
    B.setPaused(true); B.beginPlay();
    // 의존하는 양을 여기서 못 박는다 — 앞선 시험이 저장을 불러오면 S.flySpeed 가
    // 1 이 아니게 남는다. 그러면 느린 쪽·빠른 쪽이 둘 다 가속 한계에 눌려
    // 2배 차이가 1.5배로 읽힌다 (단독 통과 + 전체 실패 = 오염, 여덟 번째).
    B.S.flySpeed = 1;
    B.S.sneaking = false; B.S.sneakLatch = false; B.S.sprintTap = false;
    B.S.keys.KeyW = false; B.S.keys.Space = false;
    B.S.keys.ControlLeft = false; B.S.keys.ControlRight = false;
    // 예전에는 (48,45,48) 이 늘 허공이었는데, 지형이 올라가(v79) 산속일 수 있다.
    // 날아갈 길을 손으로 비운다 — 시험대는 지형에 기대지 않는다.
    for (let dx = -4; dx <= 4; dx++) for (let dz = -12; dz <= 12; dz++)
      for (let dy = -4; dy <= 14; dy++) B.set(48 + dx, 45 + dy, 48 + dz, 0);
    B.refreshAllTops(); B.relightAll(false);
    B.player.pos.set(48, 45, 48); B.player.vel.set(0, 0, 0);
    B.player.flying = true; B.player.yaw = 0; B.player.pitch = 0;
    B.S.keys.ControlLeft = false; B.S.sprintTap = false;
    function run(sprint) {
      B.player.pos.set(48, 45, 48); B.player.vel.set(0, 0, 0);
      B.S.keys.KeyW = true; B.S.keys.ControlLeft = !!sprint;
      let far = 0, up = 0;
      const z0 = B.player.pos.z;
      for (let k = 0; k < 30; k++) B.step(1 / 60);
      far = Math.abs(B.player.pos.z - z0);
      // 수직도 같이 빨라지는가
      B.player.pos.set(48, 45, 48); B.player.vel.set(0, 0, 0);
      B.S.keys.KeyW = false; B.S.keys.Space = true;
      const y0 = B.player.pos.y;
      for (let k = 0; k < 30; k++) B.step(1 / 60);
      up = B.player.pos.y - y0;
      B.S.keys.Space = false; B.S.keys.ControlLeft = false;
      return { far, up };
    }
    const slow = run(false);
    const fast = run(true);
    B.S.keys.KeyW = false; B.S.keys.ControlLeft = false; B.S.keys.Space = false;
    B.player.flying = false;
    B.endPlay(); B.setPaused(false);
    return { slow, fast };
  });
  assert(r.slow.far > 1, "시험대가 안 섰다 — 그냥 날 때도 안 움직인다: " + r.slow.far);
  assert(r.fast.far > r.slow.far * 1.6,
         "날면서 Ctrl 을 눌러도 안 빨라진다 — " + r.slow.far.toFixed(1) + " → " + r.fast.far.toFixed(1));
  assert(r.fast.up > r.slow.up * 1.6,
         "수직만 그대로다 — 높이 뜨는 데 시간이 걸린다: " + r.slow.up.toFixed(1) + " → " + r.fast.up.toFixed(1));
});

test("v65 날씨: K 로 고른 날씨는 저절로 안 바뀐다", async (page) => {
  const r = await page.evaluate(() => {
    const B = window.__blockyard;
    B.setPaused(true); B.beginPlay();
    // 손으로 고르면 잠긴다
    B.S.weather = 0; B.S.weatherLock = false; B.S.weatherTimer = 0.01;
    // 진짜 keydown 을 쏜다 — 잠그는 것은 setKey 가 아니라 K 처리기다
    window.dispatchEvent(new KeyboardEvent("keydown", { code: "KeyK", bubbles: true }));
    window.dispatchEvent(new KeyboardEvent("keyup", { code: "KeyK", bubbles: true }));
    const picked = B.S.weather, locked = B.S.weatherLock;
    // 잠긴 채로 한참 돌려도 그대로다 (자동 전환 주기는 60~150초)
    for (let k = 0; k < 400; k++) B.updateWeather(1.0);
    const held = B.S.weather;
    const mix = B.S.weatherMix;
    // 잠금을 풀면 예전처럼 저절로 바뀐다
    B.S.weatherLock = false; B.S.weatherTimer = 0.01;
    let changed = false;
    for (let k = 0; k < 60 && !changed; k++) {
      B.S.weatherTimer = 0.01;
      B.updateWeather(1.0);
      if (B.S.weather !== held) changed = true;
    }
    B.S.weather = 0; B.S.weatherLock = false; B.S.weatherMix = 0; B.S.weatherTimer = 90;
    B.endPlay(); B.setPaused(false);
    return { picked, locked, held, mix, changed };
  });
  eq(r.picked, 1, "K 를 눌렀는데 날씨가 안 바뀐다");
  assert(r.locked, "K 로 고른 뒤 잠기지 않는다");
  eq(r.held, r.picked, "잠갔는데 날씨가 " + r.held + " 로 저절로 바뀌었다");
  assert(r.mix > 0.5, "잠금 때문에 짙어지기가 멈췄다 — 고른 날씨가 화면에 안 나타난다: " + r.mix);
  assert(r.changed, "잠금을 풀었는데도 저절로 안 바뀐다 — 자동 전환이 죽었다");
});

test("v65 영역: 첫 모서리를 찍으면 그 칸이 화면에 남는다", async (page) => {
  const r = await page.evaluate(() => {
    const B = window.__blockyard;
    B.setPaused(true); B.beginPlay();
    B.S.selA = null; B.S.selB = null;
    B.step(1 / 60);
    const noneVisible = B.selBox.visible;

    // A 만 찍힌 상태 — 한 칸짜리 노란 상자가 그 자리에 뜬다
    B.S.selA = [40, 30, 50];
    B.step(1 / 60);
    const anchorOn = B.selBox.visible;
    const anchorColor = B.selMat.color.getHex();
    const ax = B.selBox.position.x, ay = B.selBox.position.y, az = B.selBox.position.z;
    const asize = B.selBox.scale.x;

    // B 까지 찍으면 예전처럼 초록 상자
    B.S.selB = [44, 33, 55];
    B.step(1 / 60);
    const bothColor = B.selMat.color.getHex();
    const bsize = B.selBox.scale.x;

    B.S.selA = B.S.selB = null;
    B.step(1 / 60);
    const clearedOff = B.selBox.visible;
    B.endPlay(); B.setPaused(false);
    return { noneVisible, anchorOn, anchorColor, ax, ay, az, asize,
             bothColor, bsize, clearedOff, DONE: B.SEL_DONE, ANCHOR: B.SEL_ANCHOR };
  });
  eq(r.noneVisible, false, "아무것도 안 찍었는데 상자가 떠 있다");
  assert(r.anchorOn, "첫 모서리를 찍었는데 화면에 아무것도 안 남는다 — 감으로 두 번째를 찍어야 한다");
  eq(r.anchorColor, r.ANCHOR, "첫 모서리 표시가 완성된 영역과 같은 색이다 — 반쪽인 줄 모른다");
  assert(Math.abs(r.ax - 40.5) < 0.01 && Math.abs(r.ay - 30.5) < 0.01 && Math.abs(r.az - 50.5) < 0.01,
         "첫 모서리 표시가 엉뚱한 자리에 있다: " + r.ax + "," + r.ay + "," + r.az);
  assert(Math.abs(r.asize - 1.04) < 0.01, "첫 모서리 표시가 한 칸이 아니다: " + r.asize);
  eq(r.bothColor, r.DONE, "두 모서리를 다 찍었는데 색이 안 돌아온다");
  assert(r.bsize > 4, "두 모서리 상자가 안 커졌다: " + r.bsize);
  eq(r.clearedOff, false, "선택을 해제했는데 상자가 남아 있다");
});

test("v65 되돌리기: 무엇을 되돌렸는지 알려 준다", async (page) => {
  const r = await page.evaluate(() => {
    const B = window.__blockyard;
    B.setPaused(true); B.beginPlay();
    const X = 14, Y = 44, Z = 50;
    for (let dx = -1; dx <= 6; dx++) for (let dz = -1; dz <= 6; dz++)
      for (let dy = -1; dy <= 4; dy++) B.set(X + dx, Y + dy, Z + dz, 0);
    B.refreshAllTops(); B.relightAll(false);
    B.S.history.length = 0; B.S.future.length = 0;

    // 한 칸 놓기
    B.applyEdit(X, Y, Z, B.B.BRICK, true, 0);
    const put = B.editLabel(B.S.history[B.S.history.length - 1]);
    // 한 칸 캐기
    B.applyEdit(X, Y, Z, B.B.AIR, true);
    const dug = B.editLabel(B.S.history[B.S.history.length - 1]);
    // 대량 채우기
    B.S.selA = [X, Y, Z]; B.S.selB = [X + 4, Y + 2, Z + 4];
    B.fillSelection(B.B.GLASS, 0);
    const filled = B.editLabel(B.S.history[B.S.history.length - 1]);

    B.S.selA = B.S.selB = null;
    B.S.history.length = 0; B.S.future.length = 0;
    B.endPlay(); B.setPaused(false);
    return { put, dug, filled };
  });
  assert(/벽돌/.test(r.put) && /놓기/.test(r.put), "놓기 안내가 이상하다: " + r.put);
  assert(/벽돌/.test(r.dug) && /캐기/.test(r.dug), "캐기 안내에 무엇을 캤는지 없다: " + r.dug);
  assert(/칸/.test(r.filled) && /75/.test(r.filled),
         "대량 편집 안내에 칸 수가 없다 — 어디까지 되돌렸는지 모른다: " + r.filled);
});

test("v65 블록 목록: 한 번 열어 열 칸을 채운다", async (page) => {
  const r = await page.evaluate(() => {
    const B = window.__blockyard;
    B.setPaused(true); B.beginPlay();
    const keepBar = B.S.bar.slice();
    B.openPicker();
    const opened = B.S.uiOpen;

    // 목록이 열린 채로 숫자키가 대상 칸을 옮긴다
    function digit(n) {
      window.dispatchEvent(new KeyboardEvent("keydown", { code: "Digit" + n, bubbles: true }));
    }
    digit(3);
    const slotAfterKey = B.S.selected;
    const stillOpenAfterKey = B.S.uiOpen;

    // 클릭해도 안 닫힌다 — 여러 칸을 이어서 채운다
    function clickBlock(id) {
      const p = B.pickBtns.filter((e) => e.block === id)[0];
      p.el.click();
    }
    clickBlock(B.B.BRICK);
    const stillOpenAfterClick = B.S.uiOpen;
    const slot3 = B.S.bar[2];
    digit(5); clickBlock(B.B.GLASS);
    const slot5 = B.S.bar[4];
    digit(7); clickBlock(B.B.LAMP);
    const slot7 = B.S.bar[6];
    const openThroughout = B.S.uiOpen;

    // E 로는 닫힌다
    window.dispatchEvent(new KeyboardEvent("keydown", { code: "KeyE", bubbles: true }));
    const closedByE = !B.S.uiOpen;

    B.S.bar = keepBar; B.refreshBar(); B.selectSlot(0);
    B.endPlay(); B.setPaused(false);
    return { opened, slotAfterKey, stillOpenAfterKey, stillOpenAfterClick,
             slot3, slot5, slot7, openThroughout, closedByE,
             BRICK: B.B.BRICK, GLASS: B.B.GLASS, LAMP: B.B.LAMP };
  });
  assert(r.opened, "목록이 안 열렸다 — 시험대가 틀렸다");
  eq(r.slotAfterKey, 2, "목록이 열린 동안 숫자키가 안 먹는다 — 칸을 옮기려면 닫아야 한다");
  assert(r.stillOpenAfterKey, "숫자키를 눌렀더니 목록이 닫혔다");
  assert(r.stillOpenAfterClick, "블록을 하나 고르자 목록이 닫혔다 — 열 칸 채우려면 스무 번을 눌러야 한다");
  eq(r.slot3, r.BRICK, "3번 칸에 안 들어갔다");
  eq(r.slot5, r.GLASS, "5번 칸에 안 들어갔다");
  eq(r.slot7, r.LAMP, "7번 칸에 안 들어갔다");
  assert(r.openThroughout, "세 칸을 채우는 사이에 목록이 닫혔다");
  assert(r.closedByE, "E 로 닫히지 않는다 — 닫을 길이 없어졌다");
});

test("v66 계단: 꺾이는 자리가 모서리 모양으로 바뀐다", async (page) => {
  const r = await page.evaluate(() => {
    const B = window.__blockyard;
    B.setPaused(true); B.beginPlay();
    const X = 34, Y = 46, Z = 34;
    for (let dx = -4; dx <= 4; dx++) for (let dz = -4; dz <= 4; dz++)
      for (let dy = -1; dy <= 4; dy++) B.set(X + dx, Y + dy, Z + dz, 0);
    B.refreshAllTops(); B.relightAll(false);
    // 윗층(0.5~1) 이 덮는 넓이를 센다 — 직선 1/2 · 안쪽 3/4 · 바깥 1/4
    function topArea(x, y, z) {
      const boxes = B.boxesAt(B.get(x, y, z), B.shapeAt(x, y, z), x, y, z);
      let a = 0;
      for (const bx of boxes) {
        if (bx[1] < 0.49) continue;                 // 밟는 바닥(0~0.5)은 뺀다
        a += (bx[3] - bx[0]) * (bx[5] - bx[2]);
      }
      return +a.toFixed(3);
    }
    function put(x, z, sh) { B.applyEdit(x, Y, z, B.B.STONE, false, sh); }
    function clear() {
      for (let dx = -4; dx <= 4; dx++) for (let dz = -4; dz <= 4; dz++)
        B.applyEdit(X + dx, Y, Z + dz, B.B.AIR, false);
    }

    // ① 외톨이 계단 = 직선 (윗층 절반)
    clear(); put(X, Z, B.SH_STAIR_N);
    const alone = topArea(X, Y, Z);

    // ② 같은 축으로 이어 놓아도 직선 그대로다 (직선 계단 줄이 망가지면 안 된다)
    clear();
    put(X, Z, B.SH_STAIR_N); put(X, Z - 1, B.SH_STAIR_N); put(X, Z + 1, B.SH_STAIR_N);
    const inLine = topArea(X, Y, Z);

    // ③ 높은 쪽(-Z) 뒤에 직각 계단 → 안쪽 모서리 (윗층 3/4)
    clear(); put(X, Z, B.SH_STAIR_N); put(X, Z - 1, B.SH_STAIR_E);
    const inner = topArea(X, Y, Z);

    // ④ 낮은 쪽(+Z) 앞에 직각 계단 → 바깥 모서리 (윗층 1/4)
    clear(); put(X, Z, B.SH_STAIR_N); put(X, Z + 1, B.SH_STAIR_E);
    const outer = topArea(X, Y, Z);
    // 그 한 칸은 이웃의 높은 쪽(+X)과 맞닿아야 한다 — 반대로 잡으면 노치가 남는다
    const ob = B.boxesAt(B.get(X, Y, Z), B.shapeAt(X, Y, Z), X, Y, Z)
                .filter((bx) => bx[1] >= 0.49)[0];
    const outerOnPlusX = ob && ob[0] >= 0.49;

    // ⑤ 뒤집힌 계단도 같은 규칙 — 이번엔 아랫층(0~0.5)이 모양을 바꾼다
    clear(); put(X, Z, B.SH_STAIR_NU); put(X, Z - 1, B.SH_STAIR_EU);
    const boxesU = B.boxesAt(B.get(X, Y, Z), B.shapeAt(X, Y, Z), X, Y, Z);
    let lowArea = 0;
    for (const bx of boxesU) if (bx[4] <= 0.51) lowArea += (bx[3] - bx[0]) * (bx[5] - bx[2]);
    const innerUp = +lowArea.toFixed(3);

    // ⑥ 반쪽이 다르면 모서리가 아니다 (아래 계단 + 뒤집힌 계단)
    clear(); put(X, Z, B.SH_STAIR_N); put(X, Z - 1, B.SH_STAIR_EU);
    const mixedHalf = topArea(X, Y, Z);

    // ⑦ 옆 계단을 캐면 모양이 저절로 돌아온다 (shape 에 저장하지 않는다는 뜻)
    clear(); put(X, Z, B.SH_STAIR_N); put(X, Z - 1, B.SH_STAIR_E);
    const beforeDig = topArea(X, Y, Z);
    B.applyEdit(X, Z === Z ? Y : Y, Z - 1, B.B.AIR, false);
    const afterDig = topArea(X, Y, Z);
    const shapeUnchanged = B.shapeAt(X, Y, Z) === B.SH_STAIR_N;

    clear();
    B.S.history.length = 0; B.S.future.length = 0;
    B.endPlay(); B.setPaused(false);
    return { alone, inLine, inner, outer, outerOnPlusX, innerUp, mixedHalf,
             beforeDig, afterDig, shapeUnchanged };
  });
  eq(r.alone, 0.5, "외톨이 계단의 윗층이 절반이 아니다: " + r.alone);
  eq(r.inLine, 0.5, "직선으로 이어 놓았는데 모양이 바뀌었다 — 계단 줄이 망가진다: " + r.inLine);
  eq(r.inner, 0.75, "안쪽 모서리가 3/4 이 아니다 — 오목한 자리에 노치가 남는다: " + r.inner);
  eq(r.outer, 0.25, "바깥 모서리가 1/4 이 아니다 — 반 칸이 툭 튀어나온다: " + r.outer);
  assert(r.outerOnPlusX, "바깥 모서리가 이웃의 높은 쪽 반대편에 남았다 — 그 자리에 노치가 생긴다");
  eq(r.innerUp, 0.75, "뒤집힌 계단은 모서리가 안 생긴다: " + r.innerUp);
  eq(r.mixedHalf, 0.5, "반쪽이 다른 계단끼리 모서리가 생겼다 — 처마와 계단이 엉킨다: " + r.mixedHalf);
  eq(r.beforeDig, 0.75, "시험대가 안 섰다");
  eq(r.afterDig, 0.5, "옆 계단을 캤는데 모서리가 그대로다 — 모양이 저장돼 버렸다");
  assert(r.shapeUnchanged, "모서리 때문에 shape 값이 바뀌었다 — 저장 포맷이 흔들린다");
});

test("v66 계단: 모서리가 실제로 그려진다", async (page) => {
  const r = await page.evaluate(() => {
    const B = window.__blockyard;
    B.setPaused(true); B.beginPlay();
    // 상자 계산이 맞아도 메시가 그 상자를 안 쓰면 화면은 그대로다 (v21 에서 겪었다).
    // 그래서 boxesAt 이 아니라 **구워진 삼각형**을 직접 센다.
    const X = 34, Y = 46, Z = 34;
    const ccx = (X / B.CH) | 0, ccy = (Y / B.CH) | 0, ccz = (Z / B.CH) | 0;
    const cid = B.chunkId(ccx, ccy, ccz);
    function clear() {
      for (let dx = -4; dx <= 4; dx++) for (let dz = -4; dz <= 4; dz++)
        for (let dy = -1; dy <= 3; dy++) B.applyEdit(X + dx, Y + dy, Z + dz, B.B.AIR, false);
    }
    // 이 한 칸 안에서 위를 보는 삼각형들의 넓이 합
    function upArea() {
      B.buildChunk(ccx, ccy, ccz);
      const m = B.opaqueMeshes[cid];
      if (!m || !m.geometry) return -1;
      const p = m.geometry.getAttribute("position");
      const ia = m.geometry.getIndex();
      let area = 0;
      for (let t = 0; t < ia.count; t += 3) {
        const a = ia.getX(t), b = ia.getX(t + 1), c = ia.getX(t + 2);
        const ax = p.getX(a), ay = p.getY(a), az = p.getZ(a);
        const bx = p.getX(b), by = p.getY(b), bz = p.getZ(b);
        const cx = p.getX(c), cy = p.getY(c), cz = p.getZ(c);
        if (ay !== by || by !== cy) continue;              // 수평면만
        if (Math.min(ax, bx, cx) < X || Math.max(ax, bx, cx) > X + 1) continue;
        if (Math.min(az, bz, cz) < Z || Math.max(az, bz, cz) > Z + 1) continue;
        if (ay < Y || ay > Y + 1) continue;
        const ny = (bz - az) * (cx - ax) - (bx - ax) * (cz - az);
        if (ny <= 0) continue;                             // 위를 보는 것만
        area += Math.abs((bx - ax) * (cz - az) - (bz - az) * (cx - ax)) / 2;
      }
      return +area.toFixed(3);
    }
    function put(x, z, sh) { B.applyEdit(x, Y, z, B.B.STONE, false, sh); }

    clear(); put(X, Z, B.SH_STAIR_N);
    const straight = upArea();
    clear(); put(X, Z, B.SH_STAIR_N); put(X, Z - 1, B.SH_STAIR_E);
    const inner = upArea();
    clear(); put(X, Z, B.SH_STAIR_N); put(X, Z + 1, B.SH_STAIR_E);
    const outer = upArea();

    clear();
    B.S.history.length = 0; B.S.future.length = 0;
    B.endPlay(); B.setPaused(false);
    return { straight, inner, outer };
  });
  // 밟는 바닥의 윗면 1.0 + 윗층이 덮는 만큼. 직선 0.5 · 안쪽 0.75 · 바깥 0.25.
  eq(r.straight, 1.5, "직선 계단이 예전과 다르게 구워졌다: " + r.straight);
  eq(r.inner, 1.75, "안쪽 모서리가 화면에는 안 나온다 — 상자만 고치고 메시가 안 따라왔다: " + r.inner);
  eq(r.outer, 1.25, "바깥 모서리가 화면에는 안 나온다: " + r.outer);
});

test("v66 계단: 놓기 전 미리보기도 모서리로 보인다", async (page) => {
  const r = await page.evaluate(() => {
    const B = window.__blockyard;
    B.setPaused(true); B.beginPlay();
    const X = 62, Y = 46, Z = 26;
    for (let dx = -3; dx <= 3; dx++) for (let dz = -3; dz <= 3; dz++)
      for (let dy = -1; dy <= 3; dy++) B.applyEdit(X + dx, Y + dy, Z + dz, B.B.AIR, false);
    // 미리보기 삼각형 수로 모양을 읽는다 (상자 하나에 12개)
    function ghostTris() {
      B.S.ghostKey = -1;                       // 캐시를 비워 다시 만들게 한다
      B.updateGhost(X, Y, Z, false);
      return B.ghostMesh.geometry.getIndex().count / 3;
    }
    const keepBar = B.S.bar.slice(), keepSel = B.S.selected, keepShape = B.S.shapeMode;
    const keepYaw = B.player.yaw;
    B.S.bar[B.S.selected] = B.B.STONE;
    B.S.shapeMode = 2;                          // 계단 모드
    // 계단 방향은 시선이 정한다 — 안 세우면 어느 쪽이 "높은 쪽" 인지 모른 채 시험한다.
    // 높은 쪽이 -Z(SH_STAIR_N) 가 되게 돌려 놓고, 그렇게 됐는지 못 박는다.
    B.player.yaw = Math.PI;
    const ghostShape = B.currentShape(false);

    const alone = ghostTris();                  // 상자 2개 = 24
    B.applyEdit(X, Y, Z - 1, B.B.STONE, false, B.SH_STAIR_E);
    const nearInner = ghostTris();              // 안쪽 모서리 = 상자 3개 = 36
    B.applyEdit(X, Y, Z - 1, B.B.AIR, false);
    B.applyEdit(X, Y, Z + 1, B.B.STONE, false, B.SH_STAIR_E);
    const nearOuter = ghostTris();              // 바깥 모서리 = 상자 2개 = 24

    B.applyEdit(X, Y, Z + 1, B.B.AIR, false);
    B.S.bar = keepBar; B.S.selected = keepSel; B.S.shapeMode = keepShape;
    B.player.yaw = keepYaw;
    B.S.ghostKey = -1;
    B.S.history.length = 0; B.S.future.length = 0;
    B.endPlay(); B.setPaused(false);
    return { alone, nearInner, nearOuter, ghostShape, N: B.SH_STAIR_N };
  });
  eq(r.ghostShape, r.N, "시험대가 안 섰다 — 미리보기 계단이 -Z 를 높은 쪽으로 잡지 않았다");
  eq(r.alone, 24, "직선 계단 미리보기 삼각형이 " + r.alone + "개다 (상자 2개 = 24)");
  eq(r.nearInner, 36,
     "옆에 직각 계단이 있는데 미리보기가 직선이다 — 놓아 봐야 모서리인 걸 안다: " + r.nearInner);
  eq(r.nearOuter, 24, "바깥 모서리 미리보기가 이상하다: " + r.nearOuter);
});

test("v65 캐기 속도: 설정대로 빨라진다", async (page) => {
  const r = await page.evaluate(() => {
    const B = window.__blockyard;
    B.setPaused(true); B.beginPlay();
    const keep = B.opts.dig, keepYaw = B.player.yaw, keepPitch = B.player.pitch;
    const X = 50, Y = 44, Z = 62;
    function trial(mode) {
      B.opts.dig = mode;
      for (let dx = -2; dx <= 2; dx++) for (let dz = -2; dz <= 2; dz++)
        for (let dy = -1; dy <= 4; dy++) B.applyEdit(X + dx, Y + dy, Z + dz, B.B.AIR, false);
      B.applyEdit(X, Y, Z, B.B.STONE, false, 0);
      B.refreshAllTops(); B.relightAll(false);
      B.player.pos.set(X + 0.5, Y, Z + 3.5);
      B.player.vel.set(0, 0, 0); B.player.flying = true;
      B.player.yaw = 0;
      // raycast 는 player.yaw 가 아니라 **카메라** 방향을 쓴다 (player.js).
      // 눈높이가 1.62 라 정면으로는 블록 위를 지난다 — 맞는 각도를 찾아 카메라까지 돌려 놓는다.
      let best = null;
      for (let pi = 0; pi <= 20 && best === null; pi++) {
        B.player.pitch = -pi * 0.04;
        B.camera.rotation.order = "YXZ";
        B.camera.rotation.y = B.player.yaw;
        B.camera.rotation.x = B.player.pitch;
        B.camera.position.set(B.player.pos.x, B.player.pos.y + B.EYE, B.player.pos.z);
        B.camera.updateMatrixWorld(true);
        const aim = B.raycast(6);
        if (aim && aim.x === X && aim.y === Y && aim.z === Z) best = B.player.pitch;
      }
      if (best === null) return -1;
      B.S.mouseDown[0] = true; B.S.lockMode = true;
      let f = 0;
      while (B.get(X, Y, Z) === B.B.STONE && f < 400) { B.step(1 / 60); f++; }
      B.S.mouseDown[0] = false; B.player.flying = false;
      return B.get(X, Y, Z) === B.B.STONE ? -1 : f;
    }
    const normal = trial(0), fast = trial(1), instant = trial(2);
    B.opts.dig = keep; B.player.yaw = keepYaw; B.player.pitch = keepPitch;
    B.S.mouseDown[0] = false;
    B.S.history.length = 0; B.S.future.length = 0;
    B.endPlay(); B.setPaused(false);
    return { normal, fast, instant };
  });
  // 돌은 굳기 1.25초 = 75프레임. 빠름은 4분의 1, 즉시는 0.08초 상한(≈5프레임).
  assert(r.normal > 0, "시험대가 안 섰다 — 조준이 안 맞아 캐지를 못했다");
  assert(Math.abs(r.normal - 75) <= 3, "보통이 " + r.normal + "프레임이다 (75 여야 한다)");
  assert(r.fast > 0 && Math.abs(r.fast - 19) <= 3, "빠름이 " + r.fast + "프레임이다 (약 19)");
  assert(r.instant > 0 && r.instant <= 8, "즉시가 " + r.instant + "프레임이다 (5 안팎)");
  assert(r.instant >= 2,
         "즉시가 한 프레임 만이다 — 누르고 있으면 초당 60칸이 사라져 손이 못 따라간다");
});

// ══════════════════════════════════════════════════════════════
//  폰 화면 시험 — 844×390 · isMobile. 데스크톱 폭에서는 안 나는 것들.
// ══════════════════════════════════════════════════════════════
phoneTest("블록 목록의 모든 칸을 누를 수 있다", async (page) => {
  const r = await page.evaluate(() => {
    const B = window.__blockyard;
    B.beginPlay();
    B.openPicker();
    const grid = document.getElementById("pick-grid");
    const gr = grid.getBoundingClientRect();
    // 목록이 스크롤되는가 — 안 되면 넘친 칸은 영영 못 누른다
    const scrollable = grid.scrollHeight > grid.clientHeight + 1;
    const canScroll = getComputedStyle(grid).overflowY;
    // 목록 자체가 화면 안에 들어와 있는가
    const gridOnScreen = gr.top >= -1 && gr.bottom <= window.innerHeight + 1;
    const card = document.querySelector(".pick-card").getBoundingClientRect();
    const dbg = { 카드높이: Math.round(card.height), 화면: window.innerHeight };
    let total = 0;
    for (const p of B.pickBtns) if (!p.el.hidden) total++;
    // 맨 위로 밀면 첫 칸이, 맨 아래로 밀면 마지막 칸이 실제로 보여야 한다.
    // 부싯돌은 ITEMS 라 늘 마지막 줄이다 — 불·TNT 를 쓰려면 반드시 거기를 눌러야 한다.
    function seen(el) {
      const b = el.getBoundingClientRect();
      const g = grid.getBoundingClientRect();
      return b.top >= g.top - 1 && b.bottom <= g.bottom + 1 &&
             b.top >= -1 && b.bottom <= window.innerHeight + 1;
    }
    grid.scrollTop = 0;
    const firstSeen = seen(B.pickBtns[0].el);
    const firstName = B.pickBtns[0].name;
    grid.scrollTop = grid.scrollHeight;
    const lastEl = B.pickBtns[B.pickBtns.length - 1];
    const lastSeen = seen(lastEl.el);
    const lastName = lastEl.name;
    B.closePicker(false);
    B.endPlay();
    return { dbg, total, scrollable, canScroll, gridOnScreen,
             firstSeen, firstName, lastSeen, lastName,
             vw: window.innerWidth, vh: window.innerHeight };
  });
  assert(r.vw < 900, "폰 화면이 아니다 — 시험대가 틀렸다: " + r.vw + "×" + r.vh);
  assert(r.total > 40, "목록에 단추가 " + r.total + "개뿐이다 — 시험대가 안 섰다");
  assert(r.canScroll === "auto" || r.canScroll === "scroll",
         "목록이 스크롤되지 않는다(overflow-y: " + r.canScroll + ") — 넘친 칸은 영영 못 누른다");
  assert(r.gridOnScreen, "목록 자체가 화면 밖으로 넘쳐 있다 " + JSON.stringify(r.dbg));
  assert(r.firstSeen, "맨 위로 밀어도 첫 칸(" + r.firstName + ")이 안 보인다");
  assert(r.lastSeen,
     "맨 아래로 밀어도 마지막 칸(" + r.lastName + ")이 안 보인다 — 부싯돌을 못 눌러 불·TNT 를 못 쓴다");
});

phoneTest("도움말을 열면 화면 안에 들어온다", async (page) => {
  const r = await page.evaluate(() => {
    const B = window.__blockyard;
    B.beginPlay();
    B.toggleHelp(true);
    const el = document.getElementById("help");
    const card = el.querySelector(".help-card");
    const scrollable = el.scrollHeight > el.clientHeight + 1;
    el.scrollTop = el.scrollHeight;
    const c = card.getBoundingClientRect();
    const bottomVisible = c.bottom <= window.innerHeight + 1;
    const uiOpen = B.S.uiOpen;
    B.toggleHelp(false);
    const closed = !B.S.uiOpen;
    B.endPlay();
    return { scrollable, bottomVisible, uiOpen, closed,
             overflow: getComputedStyle(el).overflowY, vh: window.innerHeight };
  });
  assert(r.uiOpen, "도움말을 열었는데 S.uiOpen 이 안 섰다 — 뒤에서 블록이 캐진다");
  assert(r.closed, "도움말을 닫았는데 S.uiOpen 이 남았다 — 조작이 전부 막힌다");
  assert(r.overflow === "auto" || r.overflow === "scroll",
         "도움말이 스크롤되지 않는다 — 아래 절반을 못 읽는다");
  assert(r.bottomVisible, "끝까지 밀어도 도움말 아래가 화면 밖이다");
});

phoneTest("메뉴로 돌아가는 길과 되돌리기가 있다", async (page) => {
  const r = await page.evaluate(() => {
    const B = window.__blockyard;
    const menu = document.getElementById("tb-menu");
    const undoBtn = document.getElementById("tb-undo");
    if (!menu || !undoBtn) return { missing: true };
    // 터치 단추가 실제로 화면 안에 있고 누를 만한 크기인가
    B.beginPlay();
    const mr = menu.getBoundingClientRect(), ur = undoBtn.getBoundingClientRect();
    const onScreen = mr.bottom <= window.innerHeight + 1 && mr.top >= -1 &&
                     mr.right <= window.innerWidth + 1 && mr.left >= -1 &&
                     ur.bottom <= window.innerHeight + 1 && ur.top >= -1;
    const bigEnough = Math.min(mr.width, mr.height, ur.width, ur.height) >= 24;

    // 되돌리기 — 블록 하나를 놓고 단추로 되돌린다
    const X = 40, Y = 44, Z = 40;
    for (let dy = -1; dy <= 3; dy++) B.set(X, Y + dy, Z, 0);
    B.refreshAllTops();
    B.S.history.length = 0; B.S.future.length = 0;
    B.applyEdit(X, Y, Z, B.B.BRICK, true, 0);
    const placed = B.get(X, Y, Z) === B.B.BRICK;
    // bindHold 는 touchstart/touchend 를 듣는다 — 포인터 이벤트로는 안 먹는다
    function tap(el) {
      el.dispatchEvent(new TouchEvent("touchstart", { bubbles: true, cancelable: true }));
      el.dispatchEvent(new TouchEvent("touchend", { bubbles: true, cancelable: true }));
    }
    tap(undoBtn);
    const undone = B.get(X, Y, Z) !== B.B.BRICK;

    // 메뉴 — 플레이 중에 누르면 메뉴로 나간다
    const wasActive = B.S.active;
    tap(menu);
    const leftPlay = !B.S.active;

    B.S.history.length = 0; B.S.future.length = 0;
    return { missing: false, onScreen, bigEnough, placed, undone, wasActive, leftPlay };
  });
  assert(!r.missing, "폰에 메뉴·되돌리기 단추가 없다 — 플레이를 누르면 그 세션은 끝까지 갇힌다");
  assert(r.onScreen, "메뉴·되돌리기 단추가 화면 밖에 있다");
  assert(r.bigEnough, "터치 단추가 너무 작다");
  assert(r.placed && r.wasActive, "시험대가 안 섰다");
  assert(r.undone, "되돌리기 단추가 안 먹는다 — 폰에서는 잘못 지운 벽을 손으로 다시 쌓아야 한다");
  assert(r.leftPlay, "메뉴 단추를 눌러도 메뉴로 안 나간다");
});

phoneTest("튜토리얼 일곱 줄을 터치만으로 끝까지 간다", async (page) => {
  const r = await page.evaluate(() => {
    const B = window.__blockyard;
    B.setPaused(true); B.beginPlay();
    B.S.tut = 0;
    const X = 44, Y = 44, Z = 44;
    for (let dx = -3; dx <= 3; dx++) for (let dz = -3; dz <= 3; dz++)
      for (let dy = -2; dy <= 4; dy++) B.set(X + dx, Y + dy, Z + dz, 0);
    for (let dx = -3; dx <= 3; dx++) for (let dz = -3; dz <= 3; dz++)
      B.set(X + dx, Y - 1, Z + dz, B.B.GRASS);
    B.set(X, Y, Z, B.B.STONE);
    B.refreshAllTops(); B.relightAll(false);
    const steps = [];
    function note(what) { steps.push([what, B.S.tut]); }

    B.advanceTut(0); note("캐기");                     // mine.js 가 부르는 것과 같은 자리
    B.advanceTut(1); note("놓기");
    B.openPicker(); B.closePicker(false); note("목록");  // openPicker 안에서 advanceTut(2)

    // 4번째 — 놓기를 누른 채 끌기 (place(repeating))
    B.S.bar[B.S.selected] = B.B.BRICK;
    B.player.pos.set(X + 0.5, Y + 1, Z + 2.5);
    // raycast 는 카메라를 본다 — 각도를 훑어 그 칸을 집을 때까지 맞춘다
    B.player.yaw = 0;
    let aimHit = null;
    for (let pi = 0; pi <= 25 && !aimHit; pi++) {
      B.player.pitch = -pi * 0.05;
      B.camera.rotation.order = "YXZ";
      B.camera.rotation.y = 0; B.camera.rotation.x = B.player.pitch;
      B.camera.position.set(B.player.pos.x, B.player.pos.y + B.EYE, B.player.pos.z);
      B.camera.updateMatrixWorld(true);
      const h = B.raycast(6);
      if (h && h.x === X && h.y === Y && h.z === Z) aimHit = h;
    }
    B.place(true);
    note("줄 긋기");
    const diag = { isTouch: B.isTouch, aim: aimHit ? [aimHit.x, aimHit.y, aimHit.z] : null };

    // 5번째 — 횃불
    B.advanceTut(4); note("횃불");

    // 6번째 — 스틱
    B.setStick(40, -40);
    B.setStick(0, 0);
    note("스틱");

    // 7번째 — 웅크림 단추
    const sneak = document.getElementById("tb-sneak");
    sneak.dispatchEvent(new TouchEvent("touchstart", { bubbles: true, cancelable: true }));
    sneak.dispatchEvent(new TouchEvent("touchend", { bubbles: true, cancelable: true }));
    note("웅크림");

    const done = B.S.tut >= 7;
    const hint = document.getElementById("hint").textContent;
    B.S.tut = 99; B.refreshHint();
    const endHint = document.getElementById("hint").textContent;
    B.S.keys.ShiftLeft = false;
    B.endPlay(); B.setPaused(false);
    return { steps, done, hint, endHint, diag };
  });
  const stuck = r.steps.filter((s, i) => s[1] !== i + 1);
  eq(stuck.length, 0,
     "터치만으로 못 넘어가는 단계가 있다: " + JSON.stringify(stuck) + " / " + JSON.stringify(r.diag));
  assert(r.done, "일곱 줄을 다 지났는데 튜토리얼이 안 끝났다");
  // 끝난 뒤 상시 안내도 폰 조작이어야 한다 — 예전엔 여섯 개 전부 폰에 없는 것이었다
  assert(!/Ctrl|ESC|우클릭|좌클릭/.test(r.endHint),
         "폰인데 상시 안내가 키보드 조작을 말한다: " + r.endHint);
  assert(/스틱|목록|되돌리기|메뉴/.test(r.endHint), "폰 상시 안내가 비었다: " + r.endHint);
});

test("v67 저장: 날씨 잠금·모양·핫바 쪽이 이어진다", async (page) => {
  const r = await page.evaluate(() => {
    const B = window.__blockyard;
    B.setPaused(true); B.beginPlay();
    const slotKey = B.curKey();
    const keepSave = localStorage.getItem(slotKey);
    const keepBar = B.S.bar.slice(), keepAlt = B.S.barAlt.slice();

    // 눈을 골라 잠그고, 계단 모양으로 두고, 핫바를 알아볼 수 있게 바꾼다
    B.S.weather = 0; B.setWeather(2); B.S.weatherLock = true;
    B.S.shapeMode = 2;
    B.S.bar[0] = B.B.LADDER; B.S.barAlt[0] = B.B.SAPLING;
    B.saveGame();

    // 전부 흐트러뜨린 뒤 불러온다
    B.setWeather(0); B.S.weatherLock = false; B.S.shapeMode = 0;
    B.S.bar[0] = B.B.DIRT; B.S.barAlt[0] = B.B.DIRT;
    const loaded = B.loadGame();

    const out = { loaded, weather: B.S.weather, lock: B.S.weatherLock,
                  shape: B.S.shapeMode, bar0: B.S.bar[0], alt0: B.S.barAlt[0],
                  mix: B.S.weatherMix, snowing: B.weatherPoints.visible };

    // 예전 저장(그 세 키가 없는 것)도 읽혀야 한다 — 저장 버전은 v5 그대로다
    const raw = JSON.parse(localStorage.getItem(slotKey));
    delete raw.wt; delete raw.wk; delete raw.sm;
    localStorage.setItem(slotKey, JSON.stringify(raw));
    B.S.weather = 1; B.S.weatherLock = true; B.S.shapeMode = 1;
    const oldOk = B.loadGame();
    out.oldLoaded = oldOk;
    out.oldWeather = B.S.weather; out.oldLock = B.S.weatherLock; out.oldShape = B.S.shapeMode;
    out.ver = raw.v;
    out.LADDER = B.B.LADDER; out.SAPLING = B.B.SAPLING;

    if (keepSave === null) localStorage.removeItem(slotKey);
    else localStorage.setItem(slotKey, keepSave);
    B.S.bar = keepBar; B.S.barAlt = keepAlt; B.refreshBar();
    B.setWeather(0); B.S.weatherLock = false; B.S.shapeMode = 0;
    B.S.history.length = 0; B.S.future.length = 0;
    B.endPlay(); B.setPaused(false);
    return out;
  });
  assert(r.loaded, "저장을 못 불러왔다 — 시험대가 틀렸다");
  eq(r.weather, 2, "고른 날씨가 안 이어진다 — 눈 오는 밤 사진을 여러 세션에 걸쳐 못 찍는다");
  assert(r.lock, "날씨 잠금이 안 이어진다 — 이어하면 2분 뒤 저절로 바뀐다");
  assert(r.snowing, "날씨는 이어졌는데 눈송이가 안 보인다 — S.weather 만 넣으면 화면은 그대로다");
  eq(r.shape, 2, "G 로 고른 모양이 안 이어진다");
  eq(r.bar0, r.LADDER, "핫바 1쪽이 안 이어진다");
  eq(r.alt0, r.SAPLING, "핫바 2쪽이 안 이어진다");
  assert(r.oldLoaded, "그 세 키가 없는 예전 저장을 못 읽는다 — 기존 플레이어의 세계가 사라진다");
  eq(r.ver, 5, "저장 버전이 올라갔다 — 선택 필드만 늘렸으니 v5 여야 한다");
  eq(r.oldWeather, 0, "예전 저장인데 날씨가 기본값(맑음)이 아니다");
  eq(r.oldLock, false, "예전 저장인데 날씨 잠금이 남았다");
  eq(r.oldShape, 0, "예전 저장인데 모양이 기본값이 아니다");
});

test("v67 되돌리기: 칸 수에도 상한이 있다", async (page) => {
  const r = await page.evaluate(() => {
    const B = window.__blockyard;
    B.setPaused(true); B.beginPlay();
    const keepUndo = B.opts.undo;
    B.opts.undo = 2000;                       // 단계 수로는 절대 안 걸리게 해 둔다
    B.S.history.length = 0; B.S.future.length = 0;
    const X = 20, Y = 20, Z = 20, N = 34;     // 34³ = 39,304칸
    B.S.selA = [X, Y, Z]; B.S.selB = [X + N - 1, Y + N - 1, Z + N - 1];
    function cells() {
      let c = 0;
      for (const e of B.S.history) c += e.batch ? e.batch.n : 1;
      return c;
    }
    // 상한(200만 칸)을 넉넉히 넘길 만큼 채운다
    const need = Math.ceil(B.HISTORY_CELLS_MAX / (N * N * N)) + 6;
    let peak = 0;
    for (let k = 0; k < need; k++) {
      B.fillSelection(k % 2 ? B.B.STONE : B.B.GLASS, 0);
      const c = cells();
      if (c > peak) peak = c;
    }
    const held = cells(), entries = B.S.history.length;
    // 상한에 걸려도 되돌리기 자체는 살아 있어야 한다
    const undone = B.undo();

    // 묶음 배열이 딱 맞게 잡히는가 — 안 주면 1024 에서 두 배씩 늘리다 40% 가 빈 채로 남는다
    B.S.history.length = 0; B.S.future.length = 0;
    B.fillSelection(B.B.PLANKS, 0);
    const last = B.S.history[B.S.history.length - 1];
    const slack = last && last.batch ? last.batch.cap - last.batch.n : -1;

    B.S.selA = B.S.selB = null;
    B.opts.undo = keepUndo;
    B.S.history.length = 0; B.S.future.length = 0;
    B.endPlay(); B.setPaused(false);
    return { peak, held, entries, undone, slack, cap: B.HISTORY_CELLS_MAX, fill: N * N * N };
  });
  assert(r.peak > r.cap * 0.5, "시험대가 안 섰다 — 상한 근처까지 안 채웠다: " + r.peak);
  assert(r.held <= r.cap + r.fill,
     "되돌리기가 " + r.held.toLocaleString("en-US") + "칸을 들고 있다 (상한 " +
     r.cap.toLocaleString("en-US") + ") — 단계 수만 세면 폰에서 탭이 죽는다");
  assert(r.entries > 1, "상한에 걸리자 히스토리가 통째로 비었다 — 되돌릴 것이 남아야 한다");
  assert(r.undone, "상한에 걸린 뒤 되돌리기가 안 먹는다");
  assert(r.slack >= 0 && r.slack < r.fill * 0.05,
     "묶음 배열에 " + r.slack + "칸이 빈 채로 남는다 — 크기를 알고 시작해야 한다");
});

test("v67 표식: 좌표·이름이 붙고 거기로 돌아갈 수 있다", async (page) => {
  const r = await page.evaluate(() => {
    const B = window.__blockyard;
    B.setPaused(true); B.beginPlay();
    const keepMarks = B.S.marks.slice();

    // 예전 저장의 [x, z] 두 원소도 그대로 읽혀야 한다 (저장 버전은 v5 그대로)
    B.S.marks = [[30, 40], [50, 22, 60, "채석장"]];
    const oldX = B.markX(B.S.marks[0]), oldZ = B.markZ(B.S.marks[0]), oldY = B.markY(B.S.marks[0]);
    const newX = B.markX(B.S.marks[1]), newY = B.markY(B.S.marks[1]), newZ = B.markZ(B.S.marks[1]);
    const newName = B.markName(B.S.marks[1]), oldName = B.markName(B.S.marks[0]);

    // /tp 로 표식에 간다 — 번호로
    B.player.pos.set(5, 40, 5);
    const byNum = B.runCommand("tp 2");
    const atNum = [Math.round(B.player.pos.x), Math.round(B.player.pos.y), Math.round(B.player.pos.z)];
    // 이름으로
    B.player.pos.set(5, 40, 5);
    B.runCommand("tp 채석장");
    const atName = [Math.round(B.player.pos.x), Math.round(B.player.pos.y), Math.round(B.player.pos.z)];
    // 높이를 모르는 예전 표식은 그 자리 지표로 올려 준다 (땅에 파묻히면 안 된다)
    B.player.pos.set(5, 40, 5);
    B.runCommand("tp 1");
    const atOld = [Math.round(B.player.pos.x), Math.round(B.player.pos.y), Math.round(B.player.pos.z)];
    const groundThere = B.topMap[30 * 0 + 40 * B.WX + 30] !== undefined
      ? B.topMap[40 * B.WX + 30] : -1;
    const missing = B.runCommand("tp 없는이름");

    // 미니맵이 두 모양을 다 그린다 (v58 의 NaN 사고를 다시 안 내려고)
    B.drawMinimap();

    B.S.marks = keepMarks;
    B.endPlay(); B.setPaused(false);
    return { oldX, oldZ, oldY, newX, newY, newZ, newName, oldName,
             byNum, atNum, atName, atOld, groundThere, missing };
  });
  eq(r.oldX, 30, "예전 표식의 x 를 잘못 읽는다");
  eq(r.oldZ, 40, "예전 표식의 z 를 잘못 읽는다 — [x, z] 두 원소다");
  eq(r.oldY, -1, "예전 표식에 없는 높이를 지어냈다");
  eq(r.oldName, "", "예전 표식에 없는 이름을 지어냈다");
  eq(r.newX, 50, "새 표식의 x 가 틀렸다");
  eq(r.newY, 22, "새 표식의 높이가 안 담긴다 — 갱도 입구와 지상 탑이 같은 점이 된다");
  eq(r.newZ, 60, "새 표식의 z 가 틀렸다");
  eq(r.newName, "채석장", "표식 이름이 안 담긴다");
  assert(/이동/.test(r.byNum), "/tp 2 가 안 먹는다: " + r.byNum);
  eq(r.atNum.join(","), "50,22,60", "표식 번호로 간 자리가 다르다: " + r.atNum.join(","));
  eq(r.atName.join(","), "50,22,60", "표식 이름으로 간 자리가 다르다: " + r.atName.join(","));
  eq(r.atOld[0] + "," + r.atOld[2], "30,40", "예전 표식으로 간 자리가 다르다");
  assert(r.atOld[1] > 0, "높이 없는 예전 표식으로 갔더니 y 가 " + r.atOld[1] + " 다 — 땅에 파묻힌다");
  assert(/없습니다/.test(r.missing), "없는 표식 이름에 안내가 없다: " + r.missing);
});

test("v67 저장 슬롯: 이름을 붙여 알아볼 수 있다", async (page) => {
  const r = await page.evaluate(() => {
    const B = window.__blockyard;
    B.setPaused(true); B.beginPlay();
    const slotKey = B.curKey();
    const keepSave = localStorage.getItem(slotKey);
    const keepName = B.S.worldName;

    B.S.worldName = "";
    B.saveGame();
    const before = B.slotInfo(B.S.slot);
    // 이름을 붙인다
    const ok = B.renameSlot(B.S.slot, "돌성");
    const after = B.slotInfo(B.S.slot);
    const memory = B.S.worldName;
    // 목록에 그 이름이 뜨는가
    B.refreshSlots();
    const listed = document.getElementById("slots").textContent;
    // 마크업으로 새면 안 된다 (청사진에서 배운 것)
    B.renameSlot(B.S.slot, "<b>굵게</b>");
    B.refreshSlots();
    const injected = document.getElementById("slots").querySelectorAll("b b").length;
    const escaped = /<b>굵게<\/b>/.test(document.getElementById("slots").textContent);
    // 비우면 시드로 돌아간다
    B.renameSlot(B.S.slot, "");
    B.refreshSlots();
    const backToSeed = /SEED/.test(document.getElementById("slots").textContent);
    // 불러오기에도 실린다
    B.renameSlot(B.S.slot, "돌성");
    B.S.worldName = "";
    B.loadGame();
    const loadedName = B.S.worldName;

    if (keepSave === null) localStorage.removeItem(slotKey);
    else localStorage.setItem(slotKey, keepSave);
    B.S.worldName = keepName;
    B.refreshSlots();
    B.S.history.length = 0; B.S.future.length = 0;
    B.endPlay(); B.setPaused(false);
    return { beforeName: before && before.name, ok, afterName: after && after.name,
             memory, listed, injected, escaped, backToSeed, loadedName };
  });
  eq(r.beforeName, "", "이름 없는 슬롯인데 이름이 있다");
  assert(r.ok, "슬롯 이름 붙이기가 실패했다");
  eq(r.afterName, "돌성", "붙인 이름이 저장에 안 실린다");
  eq(r.memory, "돌성", "지금 놀고 있는 슬롯인데 메모리 쪽이 안 따라왔다");
  assert(/돌성/.test(r.listed), "메뉴 슬롯 목록에 이름이 안 뜬다 — 시드 번호로 기억해야 한다");
  eq(r.injected, 0, "슬롯 이름이 마크업으로 새어 들어갔다");
  assert(r.escaped, "슬롯 이름의 꺾쇠가 글자로 안 보인다");
  assert(r.backToSeed, "이름을 비웠는데 SEED 로 안 돌아간다");
  eq(r.loadedName, "돌성", "불러오기 뒤 이름이 안 이어진다");
});

test("v68 부팅: 실패하면 화면이 말하고 빠져나갈 길을 준다", async (page) => {
  const r = await page.evaluate(() => {
    // 실제로 부팅을 깨뜨릴 수는 없으니(이미 떠 있다), 감시견이 **붙어 있는지**와
    // 눌렀을 때 무엇을 하는지를 본다. 진짜 깨뜨린 확인은 tools 쪽 수동 재현으로 했다.
    const box = document.getElementById("boot-fail");
    const why = document.getElementById("boot-why");
    const btn = document.getElementById("boot-reset");
    if (!box || !why || !btn) return { missing: true };
    const hiddenWhileOk = box.hidden;
    // 부팅이 끝난 뒤에는 오류가 나도 이 판을 띄우지 않아야 한다 (게임 중 오류로 검은 판이 뜨면 안 된다)
    window.dispatchEvent(new ErrorEvent("error", { message: "시험용 가짜 오류" }));
    const stillHidden = box.hidden;
    return { missing: false, hiddenWhileOk, stillHidden,
             booted: window.__blockyard && window.__blockyard.booted !== false };
  });
  assert(!r.missing, "부팅 감시견이 없다 — 실패하면 멈춘 막대만 남는다");
  assert(r.booted, "시험대가 안 섰다");
  assert(r.hiddenWhileOk, "정상인데 실패 안내가 떠 있다");
  assert(r.stillHidden, "부팅이 끝난 뒤의 오류에도 실패 판이 떴다 — 놀다가 검은 화면을 만난다");
});

test("v68 부팅: booted 깃발이 진짜로 서 있다", async (page) => {
  const r = await page.evaluate(() => {
    const B = window.__blockyard;
    return { has: Object.prototype.hasOwnProperty.call(B, "booted"), val: B.booted,
             ready: (document.getElementById("boot-msg") || {}).textContent };
  });
  // 훅에 booted 가 아예 없으면 `booted !== false` 가 undefined 라 **늘 참**이 된다 —
  // 시험도 감시견도 "훅이 생겼나" 만 보고 다 열린 줄 안다 (지형도 안 굽고 조명도 안 켠 때다).
  assert(r.has, "훅에 booted 가 없다 — 부팅 대기 조건이 사실상 아무것도 안 기다린다");
  eq(r.val, true, "부팅이 끝났는데 booted 가 " + r.val + " 다");
});

test("v69 되돌리기: 떨어진 모래까지 되돌아온다", async (page) => {
  const r = await page.evaluate(() => {
    const B = window.__blockyard;
    B.setPaused(true); B.beginPlay();
    const X = 24, Z = 24, Y = 40;
    // 앞선 시험이 낙하 큐에 남긴 것이 있으면 이 칸의 낙하가 예산에 밀린다 (교훈 12)
    B.resetQueues();
    B.S.fallOwner = null;
    for (let yy = 1; yy < B.WY; yy++) B.set(X, yy, Z, 0);
    B.refreshAllTops(); B.relightAll(false);
    function column() {
      let n = 0, lowest = -1;
      for (let yy = 0; yy < B.WY; yy++)
        if (B.get(X, yy, Z) === B.B.SAND) { n++; if (lowest < 0) lowest = yy; }
      return { n, lowest };
    }

    // ① 한 칸 — 놓고 떨어뜨린 뒤 되돌리면 아무 데도 안 남아야 한다
    B.S.history.length = 0; B.S.future.length = 0;
    B.applyEdit(X, Y, Z, B.B.SAND, true, 0);
    const hist = B.S.history.length;
    for (let k = 0; k < 200; k++) B.fallTick(50);
    const fell = column();
    B.undo();
    const afterUndo = column();

    // ② 다시하기도 짝이 맞아야 한다
    B.redo();
    const afterRedo = column();
    B.undo();

    // ③ 기둥 열 칸 — 되돌리기 열 번이면 하나도 안 남아야 한다
    B.S.history.length = 0; B.S.future.length = 0;
    for (let k = 0; k < 10; k++) {
      B.applyEdit(X, Y - k, Z, B.B.SAND, true, 0);
      for (let t = 0; t < 60; t++) B.fallTick(50);
    }
    const tower = column();
    for (let k = 0; k < 10; k++) B.undo();
    const afterAll = column();

    B.S.history.length = 0; B.S.future.length = 0;
    B.endPlay(); B.setPaused(false);
    return { hist, fell, afterUndo, afterRedo, tower, afterAll, top: Y };
  });
  eq(r.hist, 1, "한 칸 놓기가 되돌리기 " + r.hist + "개를 먹었다");
  eq(r.fell.n, 1, "시험대가 안 섰다 — 모래가 " + r.fell.n + "칸이다");
  assert(r.fell.lowest < r.top, "모래가 안 떨어졌다 — 시험대가 틀렸다");
  eq(r.afterUndo.n, 0,
     "되돌렸는데 모래가 " + r.afterUndo.n + "칸 남았다 (y=" + r.afterUndo.lowest + ") — " +
     "토스트는 '모래 놓기를 되돌렸다' 고 말한다");
  eq(r.afterRedo.n, 1, "다시하기로 모래가 안 돌아온다");
  eq(r.tower.n, 10, "시험대가 안 섰다 — 기둥이 " + r.tower.n + "칸이다");
  eq(r.afterAll.n, 0, "열 번 되돌렸는데 " + r.afterAll.n + "칸이 남았다");
});

test("v69 불: 번짐을 끄면 집이 안 탄다", async (page) => {
  const r = await page.evaluate(() => {
    const B = window.__blockyard;
    B.setPaused(true); B.beginPlay();
    const keep = B.opts.firespread, keepW = B.S.weather;
    B.S.weather = 0;                       // 비가 오면 불이 꺼져 시험이 흐려진다
    const X = 70, Y = 40, Z = 70;
    function hut() {
      B.resetQueues();
      B.S.fireOrigins.length = 0;
      for (let dx = -6; dx <= 6; dx++) for (let dz = -6; dz <= 6; dz++)
        for (let dy = -1; dy <= 8; dy++) B.set(X + dx, Y + dy, Z + dz, 0);
      // 12×12×5 판자 오두막 (벽만)
      let n = 0;
      for (let dx = 0; dx < 12; dx++) for (let dz = 0; dz < 12; dz++)
        for (let dy = 0; dy < 5; dy++) {
          if (dx > 0 && dx < 11 && dz > 0 && dz < 11) continue;
          B.set(X + dx, Y + dy, Z + dz, B.B.PLANKS); n++;
        }
      B.refreshAllTops(); B.relightAll(false);
      return n;
    }
    function planks() {
      let n = 0;
      for (let dx = -1; dx <= 13; dx++) for (let dz = -1; dz <= 13; dz++)
        for (let dy = -1; dy <= 8; dy++)
          if (B.get(X + dx, Y + dy, Z + dz) === B.B.PLANKS) n++;
      return n;
    }
    function burn() {
      B.ignite(X - 1, Y, Z);              // 벽 바깥 공기 한 칸에 불을 붙인다
      for (let k = 0; k < 3000; k++) B.fireTick(80);
      return planks();
    }

    B.opts.firespread = 1;
    const built = hut();
    const onLeft = burn();

    B.opts.firespread = 0;
    hut();
    const offLeft = burn();

    B.opts.firespread = keep; B.S.weather = keepW;
    B.resetQueues();
    B.S.fireOrigins.length = 0;
    B.S.history.length = 0; B.S.future.length = 0;
    B.endPlay(); B.setPaused(false);
    return { built, onLeft, offLeft };
  });
  assert(r.built > 200, "시험대가 안 섰다 — 판자가 " + r.built + "장뿐이다");
  assert(r.onLeft < r.built,
     "번짐을 켰는데 한 장도 안 탔다 — 시험대가 틀렸다 (" + r.built + " → " + r.onLeft + ")");
  eq(r.offLeft, r.built,
     "번짐을 껐는데 " + (r.built - r.offLeft) + "장이 탔다 — " +
     "번진 불은 되돌리기가 못 잡으니 이 게임에서 유일하게 영영 사라지는 길이다");
});

test("v69 화면이 말한다: 시야거리·세계 이름·되돌리기 이유·표식 목록", async (page) => {
  const r = await page.evaluate(() => {
    const B = window.__blockyard;
    B.setPaused(true); B.beginPlay();
    const keepFar = B.opts.far, keepName = B.S.worldName, keepMarks = B.S.marks.slice();
    const out = {};

    // ① F3 시야거리 — 자동 조절이 줄여 놓았으면 그 값을 찍어야 한다
    B.opts.far = 120; B.S.farNow = 40;
    B.refreshPerf();
    const perf = document.getElementById("perf").textContent;
    out.saysReal = /40/.test(perf) && /자동/.test(perf);
    out.perf = perf.replace(/\s+/g, " ").slice(0, 120);
    out.hasWorst = /최악/.test(perf);
    B.S.farNow = keepFar; B.opts.far = keepFar;

    // ② 세계 이름이 미니맵 캡션에 뜬다
    B.S.worldName = "언덕 위 성";
    B.S.mmUnder = false;
    out.cap = B.refreshMinimapCap();
    B.S.worldName = "";
    out.capSeed = B.refreshMinimapCap();

    // ③ 이어하기 직후의 빈 되돌리기는 이유를 말한다
    B.S.history.length = 0; B.S.future.length = 0;
    B.S.loadedFromSave = true; B.S.everEdited = false;
    B.undo();
    out.whyLoaded = B.undoEmptyWhy;
    B.S.everEdited = true;
    B.undo();
    out.whyEdited = B.undoEmptyWhy;

    // ④ /marks 가 표식을 글자로 뿌린다
    B.S.marks = [];
    out.empty = B.runCommand("marks");
    B.S.marks = [[30, 40], [50, 22, 60, "채석장"]];
    out.list = B.runCommand("marks");

    B.opts.far = keepFar; B.S.worldName = keepName; B.S.marks = keepMarks;
    B.S.loadedFromSave = false;
    B.endPlay(); B.setPaused(false);
    return out;
  });
  assert(r.saysReal, "F3 이 실제 시야거리를 안 찍는다 — 원인을 보러 연 화면이 원인을 가린다: " + r.perf);
  assert(r.hasWorst, "F3 에 최악 프레임 ms 가 없다 — 평균 FPS 는 한 번 튀는 것을 뭉갠다");
  assert(/언덕 위 성/.test(r.cap), "세계 이름이 미니맵에 안 뜬다: " + r.cap);
  assert(/SEED/.test(r.capSeed), "이름이 없을 때 시드로 안 돌아간다: " + r.capSeed);
  assert(/남지 않습니다/.test(r.whyLoaded),
     "이어하기 직후 빈 되돌리기가 이유를 안 말한다 — 고장 난 줄 안다: " + r.whyLoaded);
  eq(r.whyEdited, "", "이번 판에서 편집했는데도 '이어하기라 비었다' 고 말한다");
  assert(/없습니다/.test(r.empty), "표식이 없을 때 안내가 없다: " + r.empty);
  assert(/채석장/.test(r.list) && /50/.test(r.list),
     "/marks 가 표식을 안 뿌린다 — 96px 미니맵 말고 읽을 곳이 필요하다: " + r.list);
  assert(/\?/.test(r.list), "높이 없는 예전 표식을 '?' 로 안 보여 준다: " + r.list);
});

test("v69 안전망: 새 세계를 만들어도 옛 세계가 20초 만에 안 사라진다", async (page) => {
  const r = await page.evaluate(() => {
    const B = window.__blockyard;
    B.setPaused(true); B.beginPlay();
    const slotK = B.curKey(), prevK = B.prevKey(B.S.slot), bakK = B.backupKey(B.S.slot);
    const keep = [localStorage.getItem(slotK), localStorage.getItem(prevK),
                  localStorage.getItem(bakK)];
    localStorage.removeItem(prevK); localStorage.removeItem(bakK);

    // 옛 세계를 저장해 둔다
    B.generate(15646);
    B.saveGame();
    const oldSeed = B.S.worldSeed;

    // 새 세계로 갈아엎는다
    B.newWorld(999999);
    const rightAfter = JSON.parse(localStorage.getItem(prevK) || "{}").seed;

    // 자동 저장이 여러 번 돌아도 안전망은 그대로여야 한다 (예전엔 한 번에 덮였다)
    for (let k = 0; k < 5; k++) B.saveGame();
    const afterAutosaves = JSON.parse(localStorage.getItem(prevK) || "{}").seed;
    const canRestore = B.hasBackup();

    // 되살리면 옛 세계로 돌아온다
    B.restoreBackup();
    const restored = B.S.worldSeed;

    localStorage.removeItem(prevK); localStorage.removeItem(bakK);
    if (keep[0] === null) localStorage.removeItem(slotK); else localStorage.setItem(slotK, keep[0]);
    if (keep[1] !== null) localStorage.setItem(prevK, keep[1]);
    if (keep[2] !== null) localStorage.setItem(bakK, keep[2]);
    B.S.history.length = 0; B.S.future.length = 0;
    B.endPlay(); B.setPaused(false);
    return { oldSeed, rightAfter, afterAutosaves, canRestore, restored };
  });
  eq(r.oldSeed, 15646, "시험대가 안 섰다");
  eq(r.rightAfter, 15646, "새 세계를 만들었는데 옛 세계가 안전망에 안 담겼다");
  eq(r.afterAutosaves, 15646,
     "자동 저장 다섯 번에 안전망이 " + r.afterAutosaves + " 로 덮였다 — " +
     "설정을 펼치는 사이에 옛 세계가 사라진다");
  assert(r.canRestore, "되살릴 것이 있는데 hasBackup 이 없다고 한다");
  eq(r.restored, 15646, "되살렸는데 " + r.restored + " 로 왔다");
});

test("v70 대량 편집: 손댄 둘레만 다시 굽되 조명은 똑같다", async (page) => {
  const r = await page.evaluate(() => {
    const B = window.__blockyard;
    B.setPaused(true); B.beginPlay();
    const X = 20, Y = 20, Z = 20;
    function hash(a) {                       // 조명 배열 전체의 지문
      let h = 2166136261 >>> 0;
      for (let i = 0; i < a.length; i++) { h ^= a[i]; h = Math.imul(h, 16777619) >>> 0; }
      return h >>> 0;
    }
    function fill(n, block) {
      B.S.selA = [X, Y, Z]; B.S.selB = [X + n - 1, Y + n - 1, Z + n - 1];
      B.fillSelection(block, 0);
      B.S.selA = B.S.selB = null;
    }

    // ① 바닥 한 장(23×23 = 529칸) — 문턱(400)을 갓 넘는 가장 흔한 한 수
    B.dirty.clear();
    B.S.selA = [X, Y, Z]; B.S.selB = [X + 22, Y, Z + 22];
    B.fillSelection(B.B.PLANKS, 0);
    B.S.selA = B.S.selB = null;
    const floorDirty = B.dirty.size;

    // ② 32×32×32 — 큰 편집
    B.dirty.clear();
    fill(32, B.B.GLASS);
    const bigDirty = B.dirty.size;
    const total = B.opaqueMeshes.length;

    // ③ 조명이 세계 전체를 다시 켠 것과 **한 비트도 다르지 않아야** 한다
    const skyA = hash(B.lightSky), blkA = hash(B.lightBlk);
    B.relightAll(false);                     // 정답 — 세계 전체를 처음부터
    const skyB = hash(B.lightSky), blkB = hash(B.lightBlk);

    // ④ 되돌리기도 같은 길을 쓴다
    B.undo();
    const skyC = hash(B.lightSky), blkC = hash(B.lightBlk);
    B.relightAll(false);
    const skyD = hash(B.lightSky), blkD = hash(B.lightBlk);

    B.S.history.length = 0; B.S.future.length = 0;
    B.endPlay(); B.setPaused(false);
    return { floorDirty, bigDirty, total, skyA, skyB, blkA, blkB, skyC, skyD, blkC, blkD };
  });
  eq(r.total, 144, "시험대가 안 섰다 — 청크가 " + r.total + "개다");
  assert(r.floorDirty < r.total,
     "바닥 한 장(529칸)에 " + r.floorDirty + " / " + r.total + " 청크를 다시 굽는다");
  assert(r.bigDirty < r.total,
     "32³ 채우기에 " + r.bigDirty + " / " + r.total + " 청크를 다시 굽는다");
  eq(r.skyA, r.skyB, "햇빛이 세계 전체를 다시 켠 것과 다르다 — 둘레만 켜다 어긋났다");
  eq(r.blkA, r.blkB, "블록광이 세계 전체를 다시 켠 것과 다르다");
  eq(r.skyC, r.skyD, "되돌린 뒤 햇빛이 어긋난다");
  eq(r.blkC, r.blkD, "되돌린 뒤 블록광이 어긋난다");
});

test("v71 시작 화면: 3일 만에 열어도 내 세계가 보인다", async (page) => {
  const r = await page.evaluate(() => {
    const B = window.__blockyard;
    B.beginPlay();
    const slotK = B.curKey();
    const keepSave = localStorage.getItem(slotK);
    const keepName = B.S.worldName, keepMarks = B.S.marks.slice();

    // 펼치지 않고 화면에 실제로 보이는 글자만 읽는다
    function readable(root) {
      let out = "";
      for (const n of root.childNodes) {
        if (n.nodeType === 3) { out += n.textContent; continue; }
        if (n.nodeType !== 1) continue;
        if (n.hidden || n.hasAttribute("hidden")) continue;
        if (getComputedStyle(n).display === "none") continue;
        if (n.tagName === "DETAILS") { out += " " + (n.querySelector("summary") || {}).textContent; continue; }
        out += " " + readable(n);
      }
      return out;
    }
    const card = document.querySelector(".card");

    // ① 저장이 없으면 소개문이 보이고 이어서 짓던 곳은 숨는다
    localStorage.removeItem(slotK);
    B.refreshMenu();
    const fresh = readable(card).replace(/\s+/g, " ");
    const freshHidden = document.getElementById("resume").hidden;

    // ② 세계를 저장하고 3일 전으로 민다
    B.S.worldName = "언덕 위 성";
    B.S.marks = [[30, 20, 40, "채석장"], [50, 22, 60, "나무농장"]];
    B.saveGame();
    B.renameSlot(B.S.slot, "언덕 위 성");
    const d = JSON.parse(localStorage.getItem(slotK));
    d.at = Date.now() - 3 * 86400000;
    d.secs = 45 * 60;
    localStorage.setItem(slotK, JSON.stringify(d));
    B.refreshMenu();
    const back = readable(card).replace(/\s+/g, " ");
    const shot = document.getElementById("resume-shot");
    const px = shot.getContext("2d").getImageData(0, 0, shot.width, shot.height).data;
    let painted = 0;
    for (let i = 0; i < px.length; i += 4) if (px[i] + px[i + 1] + px[i + 2] > 60) painted++;

    if (keepSave === null) localStorage.removeItem(slotK);
    else localStorage.setItem(slotK, keepSave);
    B.S.worldName = keepName; B.S.marks = keepMarks;
    B.refreshMenu();
    B.endPlay();
    return { fresh, freshHidden, back, painted, total: shot.width * shot.height };
  });
  assert(r.freshHidden, "저장이 없는데 '이어서 짓던 곳' 이 떠 있다");
  assert(/96×96 섬/.test(r.fresh), "처음 온 사람에게 소개문이 안 보인다");
  assert(/언덕 위 성/.test(r.back), "3일 만에 열었는데 세계 이름이 안 보인다: " + r.back.slice(0, 120));
  assert(/3일 전/.test(r.back), "마지막으로 논 때가 안 보인다");
  assert(/45분/.test(r.back), "플레이 시간이 안 보인다");
  assert(/채석장/.test(r.back), "표식이 안 보인다 — 돌아갈 곳이 곧 '하던 일' 이다");
  assert(!/96×96 섬/.test(r.back), "돌아온 사람에게 다섯 줄 소개문이 그대로다");
  assert(r.painted > r.total * 0.5,
     "섬 그림이 " + r.painted + "/" + r.total + " 픽셀만 그려졌다");
});

phoneTest("이어서 짓던 곳이 화면 안에 들어온다", async (page) => {
  const r = await page.evaluate(() => {
    const B = window.__blockyard;
    const slotK = B.curKey();
    const keepSave = localStorage.getItem(slotK), keepName = B.S.worldName;
    B.beginPlay();
    B.S.worldName = "언덕 위 성";
    B.saveGame();
    B.renameSlot(B.S.slot, "언덕 위 성");
    B.endPlay();
    B.refreshMenu();
    const box = document.getElementById("resume");
    const b = box.getBoundingClientRect();
    const shot = document.getElementById("resume-shot").getBoundingClientRect();
    const card = document.querySelector(".card").getBoundingClientRect();
    const out = {
      hidden: box.hidden,
      fitsWidth: b.right <= window.innerWidth + 1 && b.left >= -1,
      insideCard: b.right <= card.right + 1,
      shotVisible: shot.width > 20 && shot.height > 20,
      vw: window.innerWidth, vh: window.innerHeight
    };
    if (keepSave === null) localStorage.removeItem(slotK);
    else localStorage.setItem(slotK, keepSave);
    B.S.worldName = keepName;
    B.refreshMenu();
    return out;
  });
  assert(r.vw < 900, "폰 화면이 아니다 — 시험대가 틀렸다");
  assert(!r.hidden, "저장이 있는데 '이어서 짓던 곳' 이 안 뜬다");
  assert(r.fitsWidth, "폰 폭에서 가로로 넘친다");
  assert(r.insideCard, "카드 밖으로 삐져나온다");
  assert(r.shotVisible, "섬 그림이 폰에서 사라졌다");
});

test("v72 불: 번져서 탄 집이 Ctrl+Z 한 번에 돌아온다", async (page) => {
  const r = await page.evaluate(() => {
    const B = window.__blockyard;
    B.setPaused(true); B.beginPlay();
    const keep = B.opts.firespread, keepW = B.S.weather;
    B.opts.firespread = 1;                 // 번짐을 켠 채로도 되돌아가야 한다
    B.S.weather = 0;
    const X = 70, Y = 40, Z = 70;
    B.resetQueues();
    B.S.fireOrigins.length = 0;
    for (let dx = -6; dx <= 6; dx++) for (let dz = -6; dz <= 6; dz++)
      for (let dy = -1; dy <= 8; dy++) B.set(X + dx, Y + dy, Z + dz, 0);
    let built = 0;
    for (let dx = 0; dx < 12; dx++) for (let dz = 0; dz < 12; dz++)
      for (let dy = 0; dy < 5; dy++) {
        if (dx > 0 && dx < 11 && dz > 0 && dz < 11) continue;
        B.set(X + dx, Y + dy, Z + dz, B.B.PLANKS); built++;
      }
    B.refreshAllTops(); B.relightAll(false);
    function planks() {
      let n = 0;
      for (let dx = -2; dx <= 14; dx++) for (let dz = -2; dz <= 14; dz++)
        for (let dy = -1; dy <= 8; dy++)
          if (B.get(X + dx, Y + dy, Z + dz) === B.B.PLANKS) n++;
      return n;
    }
    B.S.history.length = 0; B.S.future.length = 0;
    B.ignite(X - 1, Y, Z);
    const hist = B.S.history.length;
    for (let k = 0; k < 3000; k++) B.fireTick(80);
    const burnt = planks();
    B.undo();
    const back = planks();
    const histAfter = B.S.history.length;

    B.opts.firespread = keep; B.S.weather = keepW;
    B.resetQueues(); B.S.fireOrigins.length = 0;
    B.S.fireOwner = null;
    B.S.history.length = 0; B.S.future.length = 0;
    B.endPlay(); B.setPaused(false);
    return { built, burnt, back, hist, histAfter };
  });
  eq(r.hist, 1, "불 붙이기가 되돌리기 " + r.hist + "개를 먹었다");
  assert(r.burnt < r.built - 20,
     "시험대가 안 섰다 — 번졌는데 " + (r.built - r.burnt) + "장만 탔다");
  eq(r.back, r.built,
     "되돌렸는데 " + (r.built - r.back) + "장이 안 돌아왔다 — " +
     "불은 이 게임에서 유일하게 영영 사라지는 길이었다 (탄 것 " + (r.built - r.burnt) + "장)");
  eq(r.histAfter, 0, "되돌리기 한 번에 다 안 돌아온다");
});

test("v73 소리: 바다·불·낮이 더는 무음이 아니다", async (page) => {
  const r = await page.evaluate(() => {
    const B = window.__blockyard;
    B.setPaused(true); B.beginPlay();
    B.S.muted = false; B.S.weather = 0;
    let out_hasAmbient = false;
    const ac = B.ac();
    // 실제 발음 횟수를 센다 — 자문이 쓴 방식 그대로
    let count = 0;
    const osc = ac.createOscillator.bind(ac), buf = ac.createBufferSource.bind(ac);
    ac.createOscillator = function () { count++; return osc(); };
    ac.createBufferSource = function () { count++; return buf(); };
    // 귀뚜라미는 setTimeout 으로 세 음을 울린다 — 동기 루프에서는 그 발음이 안 잡힌다.
    // "울리기로 했는가" 까지 세야 밤이 조용해졌는지 알 수 있다.
    const st = window.setTimeout;
    window.setTimeout = function (fn, ms) { count++; return st(fn, ms); };
    function measure(fn, secs) {
      count = 0;
      for (let k = 0; k < secs * 60; k++) fn(1 / 60);
      return count;
    }

    const X = 44, Y = 40, Z = 84;
    for (let dx = -7; dx <= 7; dx++) for (let dz = -7; dz <= 7; dz++)
      for (let dy = -3; dy <= 5; dy++) B.set(X + dx, Y + dy, Z + dz, 0);
    for (let dx = -7; dx <= 7; dx++) for (let dz = -7; dz <= 7; dz++)
      B.set(X + dx, Y - 3, Z + dz, B.B.STONE);
    B.refreshAllTops(); B.relightAll(false);
    B.player.pos.set(X + 0.5, Y, Z + 0.5);
    B.player.vel.set(0, 0, 0); B.player.flying = true;

    // ① 바다 옆 — 예전에는 5초에 0개
    for (let dx = -6; dx <= -2; dx++) for (let dz = -6; dz <= 6; dz++)
      for (let dy = -2; dy <= 0; dy++) B.set(X + dx, Y + dy, Z + dz, B.B.WATER);
    B.refreshAllTops();
    B.S.timeOfDay = 0.5;                       // 한낮
    const water = measure((dt) => B.step(dt), 6);

    // ② 불 옆 — 예전에는 정지 화면 + 거의 무음
    for (let dx = -6; dx <= -2; dx++) for (let dz = -6; dz <= 6; dz++)
      for (let dy = -2; dy <= 0; dy++) B.set(X + dx, Y + dy, Z + dz, 0);
    for (let dx = 1; dx <= 3; dx++) for (let dz = -1; dz <= 1; dz++)
      B.set(X + dx, Y, Z + dz, B.B.FIRE);
    B.refreshAllTops();
    const fire = measure((dt) => B.step(dt), 6);
    for (let dx = 1; dx <= 3; dx++) for (let dz = -1; dz <= 1; dz++)
      B.set(X + dx, Y, Z + dz, 0);
    B.refreshAllTops();

    // ③ 한낮의 빈 들판 — 예전에는 20초에 1개.
    // updateAmbient 는 S.ambient 가 있어야 돈다 — 없으면 조용히 0이 나온다
    B.startAmbient();
    out_hasAmbient = !!B.S.ambient;
    B.S.timeOfDay = 0.5;
    B.S.cricketTimer = 0;
    const day = measure((dt) => B.updateAmbient(dt), 20);
    // ④ 밤도 그대로여야 한다
    B.S.timeOfDay = 0.0;
    B.S.cricketTimer = 0;
    const night = measure((dt) => B.updateAmbient(dt), 20);

    // ⑤ 불 타일이 실제로 움직이는가
    const t0 = B.atlasSample(55);
    B.animateLiquids(1.7);
    const t1 = B.atlasSample(55);

    B.player.flying = false;
    ac.createOscillator = osc; ac.createBufferSource = buf; window.setTimeout = st;
    B.S.timeOfDay = 0.25;
    B.S.history.length = 0; B.S.future.length = 0;
    B.endPlay(); B.setPaused(false);
    return { water, fire, day, night, moved: t0 !== t1, hasAmbient: out_hasAmbient };
  });
  assert(r.water > 0, "바다 옆 6초에 소리가 " + r.water + "개다 — 세계의 3/4 가 귀에는 없다");
  assert(r.fire > 0, "불 옆 6초에 소리가 " + r.fire + "개다 — 집이 타는 걸 눈으로만 본다");
  assert(r.hasAmbient, "시험대가 안 섰다 — 배경음이 안 켜져 updateAmbient 가 바로 돌아온다");
  assert(r.day >= 3, "한낮 20초에 소리가 " + r.day + "개다 — 낮이 밤보다 적막하다");
  assert(r.night >= 3, "밤 소리가 " + r.night + "개로 줄었다 — 귀뚜라미가 사라졌다");
  assert(r.moved, "불 타일이 정지 화면이다");
});

phoneTest("반블록·계단에 갈 길이 있다", async (page) => {
  const r = await page.evaluate(() => {
    const B = window.__blockyard;
    B.beginPlay();
    const btn = document.getElementById("tb-shape");
    if (!btn) return { missing: true };
    const rect = btn.getBoundingClientRect();
    const onScreen = rect.bottom <= window.innerHeight + 1 && rect.top >= -1 &&
                     rect.right <= window.innerWidth + 1 && rect.left >= -1;
    const keep = B.S.shapeMode;
    B.S.shapeMode = 0;
    function tap() {
      btn.dispatchEvent(new TouchEvent("touchstart", { bubbles: true, cancelable: true }));
      btn.dispatchEvent(new TouchEvent("touchend", { bubbles: true, cancelable: true }));
      return B.S.shapeMode;
    }
    const seq = [tap(), tap(), tap()];
    B.S.shapeMode = keep;
    B.endPlay();
    return { missing: false, onScreen, seq, big: Math.min(rect.width, rect.height) };
  });
  assert(!r.missing,
     "폰에 모양 단추가 없다 — G 키가 없으니 반블록·계단에 갈 길이 화면에 하나도 없다");
  assert(r.onScreen, "모양 단추가 화면 밖에 있다");
  assert(r.big >= 24, "모양 단추가 너무 작다");
  eq(r.seq.join(","), "1,2,0", "모양이 전체→반블록→계단→전체로 안 돈다: " + r.seq.join(","));
});

test("v74 소품: 책장은 통짜, 카펫은 얇게 깔린다", async (page) => {
  const r = await page.evaluate(() => {
    const B = window.__blockyard;
    B.setPaused(true); B.beginPlay();
    const X = 12, Y = 44, Z = 68;
    for (let dx = -3; dx <= 3; dx++) for (let dz = -3; dz <= 3; dz++)
      for (let dy = -2; dy <= 4; dy++) B.applyEdit(X + dx, Y + dy, Z + dz, B.B.AIR, false);
    for (let dx = -3; dx <= 3; dx++) for (let dz = -3; dz <= 3; dz++)
      B.applyEdit(X + dx, Y - 1, Z + dz, B.B.STONE, false, 0);
    B.refreshAllTops(); B.relightAll(false);

    // ① 카펫은 한 겹 — 딛고 서되 걸리지 않는다
    B.applyEdit(X, Y, Z, B.B.CARPET, false, 0);
    const box = B.boxesAt(B.B.CARPET, B.shapeAt(X, Y, Z), X, Y, Z);
    const thin = box.length === 1 && box[0][4] <= 0.1;
    const top = B.surfaceTop(X, Y, Z);

    // ② 빛을 막지 않는다 — 카펫 한 장에 방이 어두워지면 안 된다
    B.relightAll(false);
    const litUnder = B.lightSky[B.idx(X, Y, Z)];

    // ③ 책장은 통짜 — 빛을 막고 딛고 선다
    B.applyEdit(X + 2, Y, Z, B.B.BOOKSHELF, false, 0);
    B.relightAll(false);
    const shelfBox = B.boxesAt(B.B.BOOKSHELF, B.shapeAt(X + 2, Y, Z), X + 2, Y, Z);
    const shelfFull = shelfBox.length === 1 && shelfBox[0][4] === 1;
    const shelfSolid = B.isSolid(B.B.BOOKSHELF);
    const darkUnder = B.lightSky[B.idx(X + 2, Y - 1, Z)];

    // ④ 받칠 바닥이 없으면 못 놓는다 (허공에 뜬 카펫이 없게)
    const needsIt = B.needsFloor(B.B.CARPET);

    // ⑤ 옆면이 안 뚫린다 — 얇은 블록 옆의 통짜 면이 사라지면 벽이 비쳐 보인다 (v21)
    B.applyEdit(X + 1, Y, Z, B.B.STONE, false, 0);
    const ccx = (X / B.CH) | 0, ccy = (Y / B.CH) | 0, ccz = (Z / B.CH) | 0;
    B.buildChunk(ccx, ccy, ccz);
    const m = B.opaqueMeshes[B.chunkId(ccx, ccy, ccz)];
    const p = m.geometry.getAttribute("position");
    const ia = m.geometry.getIndex();
    let sideArea = 0;
    for (let t = 0; t < ia.count; t += 3) {
      const a = ia.getX(t), b2 = ia.getX(t + 1), c = ia.getX(t + 2);
      const ax = p.getX(a), bx = p.getX(b2), cx = p.getX(c);
      if (ax !== bx || bx !== cx) continue;              // x 면만
      if (Math.abs(ax - (X + 1)) > 0.01) continue;       // 돌의 -x 면
      const ay = p.getY(a), by = p.getY(b2), cy = p.getY(c);
      const az = p.getZ(a), bz = p.getZ(b2), cz = p.getZ(c);
      if (Math.min(ay, by, cy) < Y || Math.max(ay, by, cy) > Y + 1) continue;
      if (Math.min(az, bz, cz) < Z || Math.max(az, bz, cz) > Z + 1) continue;
      sideArea += Math.abs((by - ay) * (cz - az) - (bz - az) * (cy - ay)) / 2;
    }

    for (let dx = -3; dx <= 3; dx++) for (let dz = -3; dz <= 3; dz++)
      for (let dy = -2; dy <= 4; dy++) B.applyEdit(X + dx, Y + dy, Z + dz, B.B.AIR, false);
    B.S.history.length = 0; B.S.future.length = 0;
    B.endPlay(); B.setPaused(false);
    return { thin, top, litUnder, shelfFull, shelfSolid, darkUnder, needsIt, sideArea };
  });
  assert(r.thin, "카펫이 얇지 않다 — 걸려 넘어진다");
  assert(r.top > 0 && r.top <= 0.1, "카펫을 딛고 설 수 없거나 너무 높다: " + r.top);
  eq(r.litUnder, 15, "카펫 한 장이 빛을 막는다 — 방이 어두워진다");
  assert(r.shelfFull, "책장이 통짜가 아니다");
  assert(r.shelfSolid, "책장을 딛고 설 수 없다");
  eq(r.darkUnder, 0, "책장이 빛을 안 막는다 — 통짜 블록이어야 한다");
  assert(r.needsIt, "카펫이 받칠 바닥을 요구하지 않는다 — 허공에 뜬 카펫이 생긴다");
  assert(r.sideArea > 0.9,
     "카펫 옆의 돌 면이 " + r.sideArea.toFixed(2) + " 만 그려졌다 — 얇은 블록 옆이 뚫려 보인다 (v21)");
});

test("v75 바다: 장식을 얹어도 뭍은 한 비트도 안 달라진다", async (page) => {
  const r = await page.evaluate(() => {
    const B = window.__blockyard;
    B.setPaused(true);
    // bound 를 주면 **그 높이까지만** 해시한다 — 두 판을 같은 자로 재야 견줄 수 있다.
    // 안 그러면 새로 생긴 바위섬만큼 더 훑어 "달라졌다" 가 나온다.
    function snap(seed, decor, bound) {
      B.S.noSeaDecor = !decor;
      B.generate(seed);
      const hm = new Int16Array(B.WX * B.WZ);
      hm.set(B.heightMap);
      const lim = bound || hm;
      let h = 2166136261 >>> 0;
      for (let z = 0; z < B.WZ; z++) for (let x = 0; x < B.WX; x++)
        for (let y = 0; y < lim[z * B.WX + x]; y++) {
          h ^= B.world[B.idx(x, y, z)]; h = Math.imul(h, 16777619) >>> 0;
        }
      return { hm, hash: h >>> 0 };
    }
    const out = [];
    for (const seed of [777, 12345, 42]) {
      const plain = snap(seed, false);
      const decorated = snap(seed, true, plain.hm);   // 장식 없는 쪽 높이를 자로 쓴다
      // 뭍(원래 지표가 바다 위)은 높이도 그대로여야 한다
      let landSame = true, landCols = 0, raised = 0, seabedChanged = 0;
      for (let i = 0; i < plain.hm.length; i++) {
        if (plain.hm[i] > B.SEA) {
          landCols++;
          if (plain.hm[i] !== decorated.hm[i]) landSame = false;
        } else if (decorated.hm[i] > plain.hm[i]) raised++;   // 새로 생긴 바위섬
      }
      // 해저가 실제로 다양해졌는가
      let gravel = 0;
      for (let z = 0; z < B.WZ; z++) for (let x = 0; x < B.WX; x++) {
        const hh = plain.hm[z * B.WX + x];
        if (hh > B.SEA) continue;
        if (B.world[B.idx(x, decorated.hm[z * B.WX + x], z)] === B.B.GRAVEL) gravel++;
      }
      out.push({ seed, landSame, landCols, raised, gravel,
                 deepSame: plain.hash === decorated.hash });
    }
    B.S.noSeaDecor = false;
    B.setPaused(false);
    return out;
  });
  for (const o of r) {
    assert(o.landCols > 1500, "시험대가 안 섰다 — 시드 " + o.seed + " 의 뭍이 " + o.landCols + "칸");
    assert(o.landSame,
       "시드 " + o.seed + " 에서 바다 장식이 **뭍의 높이**를 바꿨다 — 기존 세계가 달라진다");
    assert(o.deepSame,
       "시드 " + o.seed + " 에서 지표 아래(동굴·광맥)가 달라졌다 — 난수 줄기가 섞였다");
    assert(o.raised > 5, "시드 " + o.seed + " 에 바위섬이 " + o.raised + "칸뿐이다");
    assert(o.gravel > 100, "시드 " + o.seed + " 의 해저가 " + o.gravel + "칸만 바뀌었다");
  }
});

test("v76 오두막: 채마다 다르고, 난수 줄기가 안 밀린다", async (page) => {
  const r = await page.evaluate(() => {
    const B = window.__blockyard;
    B.setPaused(true);
    // 앞선 지형 시험이 S.terrain 을 남기면 평지가 줄어 오두막이 거의 안 선다 (교훈 12)
    const keepTerrain = B.S.terrain;
    B.S.terrain = 0;
    function surface(seed, huts) {
      B.S.noHuts = !huts;
      B.generate(seed);
      // 지표 한 겹만 찍어 둔다 — 난수 줄기가 밀리면 **온 세계의 풀꽃**이 달라진다
      const top = new Uint8Array(B.WX * B.WZ);
      const hm = new Int16Array(B.WX * B.WZ);
      for (let z = 0; z < B.WZ; z++) for (let x = 0; x < B.WX; x++) {
        const i = z * B.WX + x, t = B.topMap[i];
        hm[i] = B.heightMap[i];
        top[i] = t >= 0 ? B.world[B.idx(x, t, z)] : 0;
      }
      return { top, hm };
    }
    const out = [];
    for (const seed of [777, 12345, 42]) {
      const plain = surface(seed, false);
      const withHuts = surface(seed, true);
      let diff = 0;
      for (let i = 0; i < plain.top.length; i++)
        if (plain.top[i] !== withHuts.top[i] || plain.hm[i] !== withHuts.hm[i]) diff++;

      // 채마다 다른가
      // 훅에 없는 상수와 견주면 undefined 라 늘 거짓이 된다 — 있는지부터 못 박는다
      if (B.SH_SLAB === undefined) return [{ noConst: true }];
      const seen = { shelf: 0, carpet: 0, lamp: 0, torch: 0, brick: 0, slab: 0 };
      for (let z = 0; z < B.WZ; z++) for (let x = 0; x < B.WX; x++)
        for (let y = B.SEA; y < B.WY; y++) {
          const b = B.world[B.idx(x, y, z)];
          if (b === B.B.BOOKSHELF) seen.shelf++;
          else if (b === B.B.CARPET) seen.carpet++;
          else if (b === B.B.LAMP) seen.lamp++;
          else if (b === B.B.TORCH) seen.torch++;
          if (b === B.B.BRICK) seen.brick++;
          if (B.shapeAt(x, y, z) === B.SH_SLAB &&
              (b === B.B.PLANKS || b === B.B.COBBLE || b === B.B.BRICK)) seen.slab++;
        }
      out.push({ seed, diff, seen, cols: plain.top.length });
    }
    B.S.noHuts = false; B.S.terrain = keepTerrain;
    B.setPaused(false);
    return out;
  });
  assert(!r[0].noConst, "훅에 SH_SLAB 이 없다 — 시험이 undefined 와 견주고 있었다");
  let shelf = 0, carpet = 0, lamp = 0, brick = 0, slab = 0;
  for (const o of r) {
    assert(o.diff > 100,
       "시드 " + o.seed + " 에 오두막이 안 지어졌다 — 바뀐 기둥이 " + o.diff + "칸뿐이다");
    // 난수 줄기가 밀렸다면 풀꽃이 온 세계에서 달라져 수천 칸이 바뀐다.
    // 오두막 열 채의 발자국은 기껏해야 몇백 칸이다.
    assert(o.diff < o.cols * 0.12,
       "시드 " + o.seed + " 에서 " + o.diff + " / " + o.cols +
       " 기둥이 바뀌었다 — 오두막 발자국치고 너무 넓다 (난수 줄기가 밀렸다)");
    var marks = o.seen.torch + o.seen.shelf + o.seen.carpet + o.seen.lamp;
    assert(marks >= 3,
       "시드 " + o.seed + " 에 오두막 표시가 " + marks + "개뿐이다 (횃불 " + o.seen.torch + ")");
    shelf += o.seen.shelf; carpet += o.seen.carpet; lamp += o.seen.lamp;
    brick += o.seen.brick; slab += o.seen.slab;
  }
  assert(shelf + carpet + lamp > 0, "오두막 안에 놓인 것이 하나도 없다 — 들어가 볼 이유가 없다");
  assert(brick > 0, "벽돌집이 한 채도 없다 — 재료가 한 갈래다");
  assert(slab > 0, "반블록 처마가 한 채도 없다 — 지붕이 한 갈래다");
});

test("v78 유체: 밀려든 물과 흘러간 용암이 Ctrl+Z 한 번에 걷힌다", async (page) => {
  const r = await page.evaluate(() => {
    const B = window.__blockyard;
    B.setPaused(true); B.beginPlay();
    const X = 60, Y = 30, Z = 60;
    // ── 물: 방을 파고 한쪽에 물통을 두고, 사이 벽 한 장을 캔다
    B.resetQueues();
    B.S.fluidOwner = null; B.S.fallOwner = null;
    for (let dx = -2; dx <= 14; dx++) for (let dz = -2; dz <= 12; dz++)
      for (let dy = -2; dy <= 8; dy++) B.set(X + dx, Y + dy, Z + dz, 0);
    // 돌 상자 하나 — 안쪽만 비운다
    for (let dx = 0; dx <= 12; dx++) for (let dz = 0; dz <= 10; dz++)
      for (let dy = 0; dy <= 5; dy++) {
        const edge = dx === 0 || dx === 12 || dz === 0 || dz === 10 || dy === 0 || dy === 5;
        B.set(X + dx, Y + dy, Z + dz, edge ? B.B.STONE : 0);
      }
    // 왼쪽 칸(dx 1~4)을 물로 채우고, dx=5 를 벽으로 세워 오른쪽과 가른다
    for (let dz = 1; dz <= 9; dz++) for (let dy = 1; dy <= 3; dy++)
      B.set(X + 5, Y + dy, Z + dz, B.B.STONE);
    for (let dx = 1; dx <= 4; dx++) for (let dz = 1; dz <= 9; dz++)
      for (let dy = 1; dy <= 3; dy++) { B.set(X + dx, Y + dy, Z + dz, B.B.WATER); }
    B.refreshAllTops(); B.relightAll(false);
    function water() {
      let n = 0;
      for (let dx = 0; dx <= 12; dx++) for (let dz = 0; dz <= 10; dz++)
        for (let dy = 0; dy <= 5; dy++)
          if (B.get(X + dx, Y + dy, Z + dz) === B.B.WATER) n++;
      return n;
    }
    B.S.history.length = 0; B.S.future.length = 0;
    const before = water();
    // 벽 한 장을 캔다 — 이 한 번의 편집이 뒤이은 범람의 주인이다
    // 바닥에 닿은 층(dy=1)의 벽을 캔다 — 옆으로 퍼지려면 단단한 바닥을 딛어야 한다
    B.applyEdit(X + 5, Y + 1, Z + 5, 0, true);
    const hist = B.S.history.length;
    for (let k = 0; k < 400; k++) { B.waterTick(400); B.dryTick(400); }
    const flooded = water();
    B.undo();
    for (let k = 0; k < 400; k++) { B.waterTick(400); B.dryTick(400); }
    const backW = water();
    const wallBack = B.get(X + 5, Y + 1, Z + 5) === B.B.STONE;
    const histAfter = B.S.history.length;

    // ── 용암: 판 위에 한 칸 놓고 흐르게 뒀다가 되돌린다
    B.resetQueues();
    B.S.fluidOwner = null; B.S.fallOwner = null;
    B.S.history.length = 0; B.S.future.length = 0;
    const LX = 30, LY = 30, LZ = 30;
    for (let dx = -6; dx <= 6; dx++) for (let dz = -6; dz <= 6; dz++)
      for (let dy = -2; dy <= 6; dy++) B.set(LX + dx, LY + dy, LZ + dz, dy === -1 ? B.B.STONE : 0);
    B.refreshAllTops(); B.relightAll(false);
    function lava() {
      let n = 0;
      for (let dx = -6; dx <= 6; dx++) for (let dz = -6; dz <= 6; dz++)
        for (let dy = -2; dy <= 6; dy++)
          if (B.get(LX + dx, LY + dy, LZ + dz) === B.B.LAVA) n++;
      return n;
    }
    B.applyEdit(LX, LY, LZ, B.B.LAVA, true);
    for (let k = 0; k < 600; k++) { B.lavaFlowTick(200); B.lavaDryTick(200); }
    const spread = lava();
    B.undo();
    for (let k = 0; k < 600; k++) { B.lavaFlowTick(200); B.lavaDryTick(200); }
    const backL = lava();

    B.resetQueues();
    B.S.fluidOwner = null; B.S.fallOwner = null;
    B.S.history.length = 0; B.S.future.length = 0;
    B.endPlay(); B.setPaused(false);
    return { before, hist, flooded, backW, wallBack, histAfter, spread, backL };
  });
  eq(r.hist, 1, "벽 한 장 캐기가 되돌리기 " + r.hist + "칸을 먹었다");
  assert(r.flooded > r.before + 20,
     "시험대가 안 섰다 — 벽을 캤는데 물이 " + (r.flooded - r.before) + "칸만 늘었다");
  assert(r.wallBack, "되돌렸는데 벽이 안 돌아왔다");
  eq(r.backW, r.before,
     "되돌린 뒤 물이 " + r.backW + "칸 — 원래 " + r.before + "칸이어야 한다 (" +
     (r.backW - r.before) + "칸이 남았다)");
  eq(r.histAfter, 0, "되돌리기 뒤에도 기록이 " + r.histAfter + "개 남았다");
  assert(r.spread >= 3, "시험대가 안 섰다 — 용암이 " + r.spread + "칸에서 멈췄다");
  eq(r.backL, 0, "되돌린 뒤 용암이 " + r.backL + "칸 남았다");
});

test("v78 유체: 되돌린 물을 다시 하면 근원이 되어 불어나지 않는다", async (page) => {
  const r = await page.evaluate(() => {
    const B = window.__blockyard;
    B.setPaused(true); B.beginPlay();
    const X = 40, Y = 34, Z = 40;
    B.resetQueues();
    B.S.fluidOwner = null; B.S.fallOwner = null;
    for (let dx = -10; dx <= 10; dx++) for (let dz = -10; dz <= 10; dz++)
      for (let dy = -2; dy <= 6; dy++) B.set(X + dx, Y + dy, Z + dz, dy === -1 ? B.B.STONE : 0);
    B.refreshAllTops(); B.relightAll(false);
    function count() {
      let n = 0, src = 0;
      for (let dx = -10; dx <= 10; dx++) for (let dz = -10; dz <= 10; dz++)
        for (let dy = -2; dy <= 6; dy++)
          if (B.get(X + dx, Y + dy, Z + dz) === B.B.WATER) {
            n++;
            if (B.waterLvl[B.idx(X + dx, Y + dy, Z + dz)] === 0) src++;
          }
      return { n: n, src: src };
    }
    B.S.history.length = 0; B.S.future.length = 0;
    B.applyEdit(X, Y, Z, B.B.WATER, true);
    for (let k = 0; k < 400; k++) { B.waterTick(400); B.dryTick(400); }
    const a = count();
    B.undo();
    for (let k = 0; k < 400; k++) { B.waterTick(400); B.dryTick(400); }
    const mid = count();
    B.redo();
    const justRedone = count();
    for (let k = 0; k < 400; k++) { B.waterTick(400); B.dryTick(400); }
    const b = count();

    B.resetQueues();
    B.S.fluidOwner = null; B.S.fallOwner = null;
    B.S.history.length = 0; B.S.future.length = 0;
    B.endPlay(); B.setPaused(false);
    return { a: a, mid: mid, justRedone: justRedone, b: b };
  });
  assert(r.a.n > 5, "시험대가 안 섰다 — 물이 " + r.a.n + "칸만 퍼졌다");
  eq(r.mid.n, 0, "되돌렸는데 물이 " + r.mid.n + "칸 남았다");
  eq(r.justRedone.src, r.a.src,
     "다시 하니 근원이 " + r.justRedone.src + "칸 — 원래 " + r.a.src + "칸이어야 한다");
  eq(r.b.n, r.a.n, "다시 한 뒤 물이 " + r.b.n + "칸 — 원래 " + r.a.n + "칸이어야 한다");
});

test("v78 스텝: 계단을 걸어 올라도 눈이 순간이동하지 않는다", async (page) => {
  const r = await page.evaluate(() => {
    const B = window.__blockyard;
    B.setPaused(true); B.beginPlay();
    const X = 20, Y = 34, Z = 20;
    // 반블록 열두 단짜리 오르막을 깐다 (한 단 0.5칸 = 계단 여섯 단과 같다)
    for (let dx = -3; dx <= 30; dx++) for (let dz = -3; dz <= 3; dz++)
      for (let dy = -2; dy <= 18; dy++) B.set(X + dx, Y + dy, Z + dz, 0);
    for (let dz = -3; dz <= 3; dz++) {
      B.set(X - 1, Y - 1, Z + dz, B.B.STONE);
      B.set(X - 2, Y - 1, Z + dz, B.B.STONE);
      for (let n = 0; n < 26; n++) {
        const bx = X + n, by = Y - 1 + ((n / 2) | 0);
        B.set(bx, by, Z + dz, B.B.STONE, (n % 2 === 0) ? B.SH.SLAB : B.SH.FULL);
      }
    }
    B.refreshAllTops(); B.relightAll(false);
    B.player.pos.set(X - 1.5, Y, Z + 0.5);
    B.player.yaw = -Math.PI / 2; B.player.pitch = 0;
    B.player.vel.set(0, 0, 0);
    B.player.onGround = true; B.player.flying = false;
    B.S.stepLift = 0; B.S.sneakEye = 0;
    B.setKey("KeyW", true);
    let maxFoot = 0, maxEye = 0, prevFoot = B.player.pos.y, prevEye = null, climbed = 0;
    for (let f = 0; f < 200; f++) {
      B.step(1 / 60);
      const foot = B.player.pos.y, eye = B.camera.position.y;
      const df = foot - prevFoot;
      if (df > maxFoot) maxFoot = df;
      if (prevEye !== null) { const de = eye - prevEye; if (de > maxEye) maxEye = de; }
      prevFoot = foot; prevEye = eye;
    }
    climbed = B.player.pos.y - Y;
    B.setKey("KeyW", false);
    B.player.vel.set(0, 0, 0);
    B.S.stepLift = 0;
    B.endPlay(); B.setPaused(false);
    return { maxFoot, maxEye, climbed };
  });
  assert(r.climbed > 2, "시험대가 안 섰다 — 오르막을 " + r.climbed.toFixed(2) + "칸밖에 못 올랐다");
  assert(r.maxFoot > 0.3, "시험대가 안 섰다 — 발이 한 번에 " + r.maxFoot.toFixed(3) + "칸씩만 올랐다");
  assert(r.maxEye < 0.2,
     "눈이 한 프레임에 " + r.maxEye.toFixed(3) + "칸 튀었다 — 순간이동으로 읽힌다");
});

phoneTest("미니맵이 터치 단추에 안 덮인다", async (page) => {
  const r = await page.evaluate(() => {
    const B = window.__blockyard;
    B.beginPlay();
    function box(id) {
      const el = document.getElementById(id);
      if (!el || el.hidden) return null;
      const b = el.getBoundingClientRect();
      return { x: b.left, y: b.top, w: b.width, h: b.height, r: b.right, b: b.bottom };
    }
    const mm = box("minimap"), mc = box("mm"), tb = box("tbtns"), tel = box("telemetry");
    function overlap(a, c) {
      if (!a || !c) return 0;
      const w = Math.max(0, Math.min(a.r, c.r) - Math.max(a.x, c.x));
      const h = Math.max(0, Math.min(a.b, c.b) - Math.max(a.y, c.y));
      return (w * h) / (a.w * a.h);
    }
    return {
      mm: mm, mc: mc, tb: tb,
      onBtns: overlap(mm, tb), canvasOnBtns: overlap(mc, tb), onTel: overlap(mm, tel),
      vw: window.innerWidth, vh: window.innerHeight
    };
  });
  assert(r.mm && r.tb, "미니맵이나 터치 단추가 화면에 없다");
  assert(r.onBtns < 0.01,
     "미니맵의 " + Math.round(r.onBtns * 100) + "% 가 터치 단추에 덮였다 — 둘 다 안 읽힌다");
  assert(r.canvasOnBtns < 0.01,
     "지도 그림의 " + Math.round(r.canvasOnBtns * 100) + "% 가 단추에 덮였다");
  assert(r.onTel < 0.01,
     "미니맵의 " + Math.round(r.onTel * 100) + "% 가 계기판에 겹쳤다");
  assert(r.mm.x >= -0.5 && r.mm.r <= r.vw + 0.5 && r.mm.y >= -0.5 && r.mm.b <= r.vh + 0.5,
     "미니맵이 화면 밖으로 나갔다: " + JSON.stringify(r.mm));
});

test("v78 동물: 같은 종끼리 무리를 지어 나온다", async (page) => {
  const r = await page.evaluate(() => {
    const B = window.__blockyard;
    B.setPaused(true);
    const rows = [];
    for (const seed of [111, 222, 333, 444, 555]) {
      B.generate(seed); B.relightAll(false); B.spawn();
      B.mobs.length = 0;
      B.seedMobs();
      const near = [];
      let pairs3 = 0;
      for (let i = 0; i < B.mobs.length; i++) {
        const a = B.mobs[i];
        let best = 1e9;
        for (let j = 0; j < B.mobs.length; j++) {
          if (i === j) continue;
          const b = B.mobs[j];
          if (b.kind !== a.kind) continue;
          const d = Math.hypot(a.x - b.x, a.z - b.z);
          if (d < best) best = d;
        }
        if (best < 1e8) near.push(best);
        if (best <= 3) pairs3++;
      }
      near.sort((p, q) => p - q);
      rows.push({ seed, n: B.mobs.length, med: near.length ? near[near.length >> 1] : -1, pairs3 });
    }
    B.setPaused(false);
    return rows;
  });
  for (const row of r) {
    eq(row.n, 14, "시드 " + row.seed + " 의 마릿수가 " + row.n + " — 무리로 묶느라 수가 달라졌다");
    assert(row.pairs3 >= 4,
       "시드 " + row.seed + ": 같은 종이 3칸 안에 붙어 있는 동물이 " + row.pairs3 +
       "마리뿐 — 번식 조건(같은 종·3칸)에 닿을 수가 없다");
    assert(row.med <= 6,
       "시드 " + row.seed + ": 같은 종 최근접 거리 중앙값이 " + row.med.toFixed(1) + "칸이다");
  }
});

test("v78 번식: 따라오는 동안에는 사랑이 안 식고, 하트가 계속 뜬다", async (page) => {
  const r = await page.evaluate(() => {
    const B = window.__blockyard;
    B.setPaused(true);
    B.mobs.length = 0;
    B.seedMobs();
    B.mobs.forEach(mm => { mm.x = 5; mm.z = 5; mm.y = 30; mm.follow = 0; mm.love = 0; mm.baby = 0; });
    // 같은 종 **두 마리가 있는 종**을 고른다.
    // mobs[0] 의 종을 그냥 쓰면, 그 종이 한 마리뿐인 판에서 시험이 터진다 (10회 중 1회).
    const byKind = {};
    B.mobs.forEach(m => { (byKind[m.kind] = byKind[m.kind] || []).push(m); });
    let pair = null;
    for (const k in byKind) if (byKind[k].length >= 2) { pair = byKind[k]; break; }
    if (!pair) return { sameKind: false };
    const a = pair[0], b = pair[1];
    B.player.pos.set(50, 30, 50);
    a.x = 51; a.z = 50; a.y = 30;
    const born0 = B.mobs.length;
    B.feedNearbyMob(B.player.pos);
    const followA = a.follow, loveA = a.love;
    // 21초 — 짝을 찾아 끌고 가는 데 걸리는 시간. 예전에는 20초에 사랑이 식어
    // 아직 졸졸 따라오는데 번식 창은 이미 닫혀 있었다.
    let hearts = 0;
    const seen = [];
    for (let k = 0; k < 21 * 60; k++) {
      B.breedTick(1 / 60);
      if (k % 60 === 0) seen.push(a.love > 0);
    }
    hearts = seen.filter(Boolean).length;
    const loveAfter = a.love, followAfter = a.follow;
    // 이제 둘째에게 먹이를 준다 — 첫째 곁으로 데려온 셈이다
    b.x = 51.5; b.z = 50.5; b.y = 30;
    a.x = 51; a.z = 50; a.y = 30;
    const fed2 = B.feedNearbyMob(B.player.pos);
    for (let k = 0; k < 60; k++) B.breedTick(1 / 60);
    const born = B.mobs.length - born0;

    B.mobs.forEach(mm => { mm.follow = 0; mm.love = 0; });
    B.setPaused(false);
    return { followA, loveA, loveAfter, followAfter, hearts, fed2, born, sameKind: !!b };
  });
  assert(r.sameKind, "시험대가 안 섰다 — 같은 종이 둘 이상 없다");
  eq(r.loveA, r.followA, "먹인 직후 사랑(" + r.loveA + ")과 따라오기(" + r.followA + ")가 다르다");
  assert(r.hearts >= 21,
     "21초 중 사랑이 살아 있던 초가 " + r.hearts + "초뿐 — 따라오는 동안 사랑이 식는다");
  assert(r.loveAfter > 0,
     "21초 뒤 사랑이 식었다 — 따라오기는 최소 22초인데 창이 먼저 닫힌다");
  assert(r.fed2, "둘째에게 먹이를 못 줬다");
  eq(r.born, 1, "새끼가 " + r.born + "마리 났다 — 1마리여야 한다");
});

phoneTest("픽블록과 핫바 2쪽에 갈 길이 있다", async (page) => {
  const r = await page.evaluate(async () => {
    const B = window.__blockyard;
    B.setPaused(true); B.beginPlay();
    const X = 46, Y = 46, Z = 46;
    for (let dx = -3; dx <= 3; dx++) for (let dz = -3; dz <= 3; dz++)
      for (let dy = -2; dy <= 4; dy++) B.set(X + dx, Y + dy, Z + dz, 0);
    for (let dx = -3; dx <= 3; dx++) for (let dz = -3; dz <= 3; dz++)
      B.set(X + dx, Y - 1, Z + dz, B.B.GRASS);
    B.set(X, Y, Z, B.B.BRICK, B.SH.SLAB);      // 벽돌 반블록 하나를 세워 둔다
    B.refreshAllTops(); B.relightAll(false);

    const pick = document.getElementById("tb-pick");
    const list = document.getElementById("tb-list");
    const has = { pick: !!pick && !pick.hidden, list: !!list };
    if (!pick) return { has };

    // 단추가 전부 화면 안에 있는가 (뽑기를 더해 한 줄이 늘었다)
    const btns = Array.from(document.querySelectorAll("#tbtns button"));
    let offscreen = 0;
    for (const b of btns) {
      const q = b.getBoundingClientRect();
      if (q.top < -0.5 || q.bottom > window.innerHeight + 0.5 ||
          q.left < -0.5 || q.right > window.innerWidth + 0.5) offscreen++;
    }

    // ── 뽑기: 반블록을 조준하고 단추를 누르면 손에 그 블록·그 모양이 들어와야 한다
    B.S.bar[B.S.selected] = B.B.STONE;
    B.S.shapeMode = 0;
    B.player.pos.set(X + 0.5, Y + 1, Z + 2.5);
    B.player.yaw = 0;
    let aimed = false;
    for (let pi = 0; pi <= 25 && !aimed; pi++) {
      B.player.pitch = -pi * 0.05;
      B.camera.rotation.order = "YXZ";
      B.camera.rotation.y = 0; B.camera.rotation.x = B.player.pitch;
      B.camera.position.set(B.player.pos.x, B.player.pos.y + B.EYE, B.player.pos.z);
      B.camera.updateMatrixWorld(true);
      const h = B.raycast(6);
      if (h && h.x === X && h.y === Y && h.z === Z) aimed = true;
    }
    pick.dispatchEvent(new TouchEvent("touchstart", { bubbles: true, cancelable: true }));
    pick.dispatchEvent(new TouchEvent("touchend", { bubbles: true, cancelable: true }));
    const picked = B.S.bar[B.S.selected], pickedShape = B.S.shapeMode;

    // ── 목록 짧게 누르기 = 목록 열기
    const page0 = B.S.barPage;
    list.dispatchEvent(new TouchEvent("touchstart", { bubbles: true, cancelable: true }));
    list.dispatchEvent(new TouchEvent("touchend", { bubbles: true, cancelable: true }));
    const opened = B.S.uiOpen;
    B.closePicker(true);

    // ── 목록 길게 누르기 = 핫바 2쪽
    const before = B.S.bar.slice();
    list.dispatchEvent(new TouchEvent("touchstart", { bubbles: true, cancelable: true }));
    await new Promise(res => setTimeout(res, 620));
    list.dispatchEvent(new TouchEvent("touchend", { bubbles: true, cancelable: true }));
    const page1 = B.S.barPage;
    const swapped = B.S.bar.some((b, i) => b !== before[i]);
    const openedByHold = B.S.uiOpen;
    if (B.S.uiOpen) B.closePicker(true);
    if (B.S.barPage !== page0) B.swapBarPage();

    B.endPlay(); B.setPaused(false);
    return { has, offscreen, aimed, picked, pickedShape, opened, page0, page1, swapped,
             openedByHold, BRICK: B.B.BRICK };
  });
  assert(r.has.pick, "폰에 픽블록 단추가 없다 — 이미 놓은 블록을 다시 들 길이 목록뿐이다");
  eq(r.offscreen, 0, r.offscreen + "개의 터치 단추가 화면 밖으로 나갔다");
  assert(r.aimed, "시험대가 안 섰다 — 반블록을 조준하지 못했다");
  eq(r.picked, r.BRICK, "뽑기 단추를 눌렀는데 손에 그 블록이 안 들어왔다");
  eq(r.pickedShape, 1, "뽑기가 모양(반블록)까지 안 가져왔다");
  assert(r.opened, "목록 단추를 짧게 눌렀는데 목록이 안 열렸다");
  assert(r.page1 !== r.page0, "목록을 길게 눌렀는데 핫바 쪽이 안 넘어갔다");
  assert(r.swapped, "핫바 쪽은 바뀌었다는데 내용이 그대로다");
  assert(!r.openedByHold, "길게 눌렀는데 목록까지 같이 열렸다");
});

phoneTest("도움말이 터치 조작을 설명한다", async (page) => {
  const r = await page.evaluate(() => {
    const B = window.__blockyard;
    B.beginPlay();
    B.toggleHelp(true);
    const help = document.getElementById("help");
    // 접힌 것은 세지 않는다 — textContent 는 display:none 도 읽는다 (v71 에서 데인 자리)
    function visibleText(root) {
      let out = "";
      const w = document.createTreeWalker(root, NodeFilter.SHOW_TEXT);
      let n;
      while ((n = w.nextNode())) {
        const el = n.parentElement;
        if (el && el.getClientRects().length) out += n.nodeValue + " ";
      }
      return out;
    }
    let body = "";
    help.querySelectorAll(".help-cols").forEach(c => { body += visibleText(c); });
    let kbds = 0;
    help.querySelectorAll("kbd").forEach(k => { if (k.getClientRects().length) kbds++; });
    // 도전 과제 탭으로 넘어가면 조작 안내는 한 벌도 안 남아야 한다
    B.setHelpTab(true);
    let achLeftover = 0;
    help.querySelectorAll(".help-cols").forEach(c => {
      achLeftover += visibleText(c).replace(/\s+/g, "").length;
    });
    B.setHelpTab(false);
    B.toggleHelp(false);

    // 블록 목록의 닫는 안내도 터치여야 한다
    B.openPicker();
    const pickNote = visibleText(document.querySelector(".pick-card"));
    B.closePicker(true);
    B.endPlay();
    return { body, kbds, achLeftover, pickNote };
  });
  assert(r.kbds <= 2,
     "폰 도움말에 키 표시가 " + r.kbds + "개 — 있지도 않은 키 이야기다");
  assert(!/WASD|Ctrl\+|Alt\+|우클릭|좌클릭|휠/.test(r.body),
     "폰 도움말이 키보드·마우스 조작을 말한다");
  const touchWords = ["스틱", "단추", "끌면", "길게"].filter(w => r.body.includes(w));
  assert(touchWords.length >= 3,
     "폰 도움말에 터치 낱말이 " + touchWords.length + "개뿐: " + touchWords.join(","));
  assert(r.body.includes("키보드에서만"),
     "폰에서 못 하는 것(영역 도구·명령창)을 못 한다고 알려 주지 않는다");
  assert(r.achLeftover < 40,
     "도전 과제 탭으로 넘어갔는데 조작 안내가 " + r.achLeftover + "자 남아 있다");
  assert(!/E.{0,3}로 닫기/.test(r.pickNote),
     "블록 목록이 폰에 없는 E 키로 닫으라고 한다: " + r.pickNote.slice(0, 90));
});

test("v78 놓기: 끌어서 줄을 그으면 문서에 적힌 속도로 놓인다", async (page) => {
  const r = await page.evaluate(() => {
    const B = window.__blockyard;
    B.setPaused(true); B.beginPlay();
    const X = 62, Y = 42, Z = 62;
    for (let dx = -8; dx <= 26; dx++) for (let dz = -6; dz <= 6; dz++)
      for (let dy = -2; dy <= 8; dy++) B.set(X + dx, Y + dy, Z + dz, 0);
    for (let dx = -8; dx <= 26; dx++) for (let dz = -6; dz <= 6; dz++)
      B.set(X + dx, Y - 1, Z + dz, B.B.STONE);
    B.refreshAllTops(); B.relightAll(false);
    B.player.flying = true;
    B.player.vel.set(0, 0, 0);
    B.player.yaw = -Math.PI / 2;          // +X 를 본다
    B.player.pitch = -0.95;               // 앞아래 바닥을 훑는다
    B.S.bar[B.S.selected] = B.B.PLANKS;
    B.S.shapeMode = 0;
    function planks() {
      let n = 0;
      for (let dx = -8; dx <= 26; dx++) for (let dz = -6; dz <= 6; dz++)
        for (let dy = -1; dy <= 8; dy++)
          if (B.get(X + dx, Y + dy, Z + dz) === B.B.PLANKS) n++;
      return n;
    }
    // 놓기를 누른 채 5초간 시선을 쓴다 — 벽 밑단에 줄을 긋는 그 동작이다.
    // (loop 의 PLACE_DELAY/REPEAT 경로를 그대로 탄다)
    B.S.touchPlace = true; B.S.placeCooldown = 0; B.S.lastPlaceCell = -1;
    const t0 = planks();
    const SECS = 5;
    for (let k = 0; k < SECS * 60; k++) {
      B.player.pos.set(X - 5 + k * 0.05, Y + 2.2, Z + 0.5);
      B.player.vel.set(0, 0, 0);
      B.step(1 / 60);
    }
    const laid = planks() - t0;
    B.S.touchPlace = false;
    B.player.flying = false;
    B.endPlay(); B.setPaused(false);
    return { laid, secs: SECS, DELAY: B.PLACE_DELAY, REPEAT: B.PLACE_REPEAT };
  });
  eq(r.REPEAT, 0.2, "반복 간격 상수 — docs/GAMEPLAY.md 가 0.2초라고 적어 두었다");
  // 이론 상한: 첫 것 + (남은 시간 / 간격)
  const cap = 1 + Math.floor((r.secs - r.DELAY) / r.REPEAT);
  const rate = r.laid / r.secs;
  // 예전(간격 0.35초)에는 같은 조건에서 1.79칸/초였다 — 마크는 5칸/초다
  assert(rate >= 2.6,
     "줄 긋기가 " + rate.toFixed(2) + "칸/초 — 손은 벌써 끝까지 갔는데 블록이 뒤따라온다");
  assert(r.laid <= cap,
     "5초에 " + r.laid + "칸 — 상한 " + cap + "칸을 넘었다 (쿨다운을 건너뛴다)");
});

test("v78 날씨: 눈이 오면 드러난 땅이 하얘지고, 내 건축물은 그대로다", async (page) => {
  const r = await page.evaluate(() => {
    const B = window.__blockyard;
    B.setPaused(true); B.beginPlay();
    const X = 48, Y = 30, Z = 48;
    // 돌·자갈·모래·판자를 한 겹 깐 평지 — 예전에는 풀·흙 위에만 눈이 쌓였다
    const R = 12;
    for (let dx = -R; dx <= R; dx++) for (let dz = -R; dz <= R; dz++) {
      for (let dy = 0; dy <= 8; dy++) B.set(X + dx, Y + dy, Z + dz, 0);
      const kinds = [B.B.STONE, B.B.GRAVEL, B.B.SAND, B.B.COBBLE];
      B.set(X + dx, Y - 1, Z + dz, kinds[((dx + R) >> 1) % kinds.length]);
    }
    // 사람이 놓은 판자 지붕 한 조각 — 날씨가 여기는 못 건드린다
    const roof = [];
    for (let dx = -2; dx <= 2; dx++) for (let dz = -2; dz <= 2; dz++) {
      B.applyEdit(X + dx, Y + 3, Z + dz, B.B.PLANKS, true);
      roof.push([X + dx, Y + 3, Z + dz]);
    }
    B.refreshAllTops(); B.relightAll(false);
    B.player.pos.set(X + 0.5, Y, Z + 0.5);
    B.player.vel.set(0, 0, 0);
    B.player.flying = false;

    function snowOn() {
      let n = 0;
      for (let dx = -R; dx <= R; dx++) for (let dz = -R; dz <= R; dz++)
        for (let dy = 0; dy <= 2; dy++)
          if (B.get(X + dx, Y + dy, Z + dz) === B.B.SNOW) n++;
      return n;
    }
    function roofIntact() {
      return roof.every(c => B.get(c[0], c[1], c[2]) === B.B.PLANKS);
    }
    const before = snowOn();
    B.setWeather(2); B.S.weatherLock = true;
    for (let k = 0; k < 90 * 60; k++) B.step(1 / 60);
    const snowed = snowOn();
    const roofOk = roofIntact();
    const onRoof = B.get(X, Y + 4, Z) === B.B.SNOW;

    // 개면 녹는다 (설원이 아닌 곳)
    B.setWeather(1);                       // 비
    for (let k = 0; k < 120 * 60; k++) B.step(1 / 60);
    const melted = snowOn();
    B.setWeather(0); B.S.weatherLock = false;
    B.endPlay(); B.setPaused(false);
    return { before, snowed, melted, roofOk, onRoof };
  });
  eq(r.before, 0, "시험대가 안 섰다 — 시작부터 눈이 " + r.before + "칸 있다");
  assert(r.snowed >= 40,
     "90초를 눈이 왔는데 " + r.snowed + "칸만 하얘졌다 — 눈이 세계를 안 바꾼다");
  assert(r.roofOk, "날씨가 사람이 놓은 판자를 바꿨다 — 세계가 내 건축물을 말없이 개조했다");
  assert(r.melted < r.snowed,
     "비가 " + (r.snowed - r.melted) + "칸만 녹였다 — 개도 그대로 하얗다");
});

test("v79 지하: 새 세계는 깊어지고, 예전 저장은 그 바다 그대로 열린다", async (page) => {
  const r = await page.evaluate(() => {
    const B = window.__blockyard;
    B.setPaused(true); B.beginPlay();
    const slotKey = B.curKey();
    const keepSave = localStorage.getItem(slotKey);

    // ── 새 세계 — 지형 판 2 · 바다 23
    B.generate(777); B.relightAll(false);
    const genNew = B.GEN, seaNew = B.SEA;
    function depths() {
      let sum = 0, n = 0, min = 999, caveAir = 0;
      for (let z = 1; z < B.WZ - 1; z++) for (let x = 1; x < B.WX - 1; x++) {
        const h = B.heightMap[z * B.WX + x];
        if (h <= B.SEA) continue;             // 뭍만
        sum += h; n++; if (h < min) min = h;
      }
      for (let y = 1; y < 40; y++) for (let z = 2; z < B.WZ - 2; z += 2)
        for (let x = 2; x < B.WX - 2; x += 2) {
          if (B.world[B.idx(x, y, z)] !== 0) continue;
          if (y >= B.topMap[z * B.WX + x]) continue;
          caveAir++;
        }
      return { mean: n ? sum / n : 0, min, caveAir, land: n };
    }
    const deep = depths();

    // ── 예전 판을 손으로 세워 본다 — SEA 가 11 로 돌아와야 한다
    B.setGen(1);
    const seaOld = B.SEA;
    const ceilOld = B.oreCeil();
    B.setGen(2);
    const ceilNew = B.oreCeil();

    // ── 저장 → 불러오기: 지형 판이 이어지는가
    B.saveGame();
    const raw = JSON.parse(localStorage.getItem(slotKey));
    const savedGn = raw.gn;
    B.setGen(1);                              // 흐트러뜨린다
    B.loadGame();
    const afterLoad = { gen: B.GEN, sea: B.SEA };

    // ── gn 이 없는 **예전 저장** — 바다 11 로 열려야 한다
    delete raw.gn;
    localStorage.setItem(slotKey, JSON.stringify(raw));
    B.setGen(2);
    const oldOk = B.loadGame();
    const afterOld = { gen: B.GEN, sea: B.SEA, ver: raw.v };

    if (keepSave === null) localStorage.removeItem(slotKey);
    else localStorage.setItem(slotKey, keepSave);
    B.loadGame();
    B.endPlay(); B.setPaused(false);
    return { genNew, seaNew, seaOld, ceilOld, ceilNew, deep,
             savedGn, afterLoad, oldOk, afterOld };
  });
  eq(r.genNew, 2, "새로 만든 세계의 지형 판");
  eq(r.seaNew, 23, "새 세계의 해수면");
  eq(r.seaOld, 11, "예전 판의 해수면 — 여기가 흔들리면 옛 세계가 물에 잠긴다");
  // 지하가 실제로 깊어졌는가 — v78 까지는 뭍 평균 높이가 12.5~13.5 였다
  assert(r.deep.mean >= 22,
     "뭍 평균 높이가 " + r.deep.mean.toFixed(1) + " — 지하가 그만큼밖에 안 된다");
  assert(r.deep.min >= 12, "가장 낮은 뭍이 " + r.deep.min + " — 기반암에 너무 가깝다");
  assert(r.deep.caveAir > 800, "지하 공기가 " + r.deep.caveAir + "칸뿐 — 굴이 안 늘었다");
  // 광석 사다리도 같이 늘어난다
  assert(r.ceilNew.dia > r.ceilOld.dia && r.ceilNew.gold > r.ceilOld.gold &&
         r.ceilNew.iron > r.ceilOld.iron,
     "깊어졌는데 광석 사다리는 그대로다: " + JSON.stringify(r.ceilNew));
  assert(r.ceilNew.iron < r.seaNew,
     "철 천장(" + r.ceilNew.iron + ")이 해수면(" + r.seaNew + ") 위다 — 얕은 곳에도 철이 난다");
  // 저장에 실려 이어지는가
  eq(r.savedGn, 2, "저장에 지형 판이 안 실렸다");
  eq(r.afterLoad.gen, 2, "불러왔는데 지형 판이 " + r.afterLoad.gen);
  eq(r.afterLoad.sea, 23, "불러왔는데 해수면이 " + r.afterLoad.sea);
  // 예전 저장 — gn 이 없어도 열리고, 그 세계의 바다로 선다
  assert(r.oldOk, "gn 이 없는 예전 저장을 못 읽었다");
  eq(r.afterOld.gen, 1, "예전 저장을 새 판으로 읽었다 — 그 세계가 통째로 물에 잠긴다");
  eq(r.afterOld.sea, 11, "예전 저장의 해수면이 " + r.afterOld.sea);
  eq(r.afterOld.ver, 5, "저장 버전은 v5 그대로여야 한다 (선택 필드만 늘었다)");
});

test("v79 지하: 카브가 지표를 뚫어도 풀·덤불이 허공에 안 남는다", async (page) => {
  const r = await page.evaluate(() => {
    const B = window.__blockyard;
    let floating = 0, plants = 0, cactus = 0, cactusBad = 0;
    const bad = [];
    for (const seed of [99999, 4242, 777, 20260904]) {
      B.generate(seed);
      for (let z = 0; z < B.WZ; z++) for (let x = 0; x < B.WX; x++)
        for (let y = 1; y < B.WY; y++) {
          const b = B.world[B.idx(x, y, z)];
          const under = B.world[B.idx(x, y - 1, z)];
          // 선인장은 통짜 블록이라 isCross 가 아니다 — 걷어내기에 휩쓸리지 않았는지 따로 센다
          if (b === B.B.CACTUS) {
            cactus++;
            if (!B.isSolid(under) && under !== B.B.CACTUS) cactusBad++;
            continue;
          }
          if (!B.isCross(b)) continue;
          plants++;
          if (!B.isSolid(under) && under !== b) {
            floating++;
            if (bad.length < 4) bad.push({ seed, x, y, z, b, under });
          }
        }
    }
    return { floating, plants, cactus, cactusBad, bad };
  });
  assert(r.plants > 800, "네 시드를 합쳐 풀·꽃이 " + r.plants + "개뿐이다");
  assert(r.cactus > 0, "선인장이 한 그루도 없다 — 걷어내다 같이 지웠다");
  eq(r.cactusBad, 0, "허공에 뜬 선인장이 " + r.cactusBad + "칸");
  eq(r.floating, 0, "허공에 뜬 풀·덤불: " + JSON.stringify(r.bad));
});

test("v79 지하: 예전 판도 그대로 만들어지고, 광석 균형이 안 무너진다", async (page) => {
  const r = await page.evaluate(() => {
    const B = window.__blockyard;
    B.setPaused(true);
    function stats(seed, gen) {
      B.generate(seed, gen); B.refreshAllTops();
      let sum = 0, n = 0, stone = 0;
      const ore = { coal: 0, iron: 0, gold: 0, dia: 0 };
      for (let z = 0; z < B.WZ; z++) for (let x = 0; x < B.WX; x++) {
        const h = B.heightMap[z * B.WX + x];
        if (h > B.SEA) { sum += h; n++; }
      }
      for (let y = 1; y < B.WY; y++) for (let z = 0; z < B.WZ; z++) for (let x = 0; x < B.WX; x++) {
        const b = B.world[B.idx(x, y, z)];
        if (b === B.B.STONE) stone++;
        else if (b === B.B.COAL) ore.coal++;
        else if (b === B.B.IRON) ore.iron++;
        else if (b === B.B.GOLD) ore.gold++;
        else if (b === B.B.DIAMOND) ore.dia++;
      }
      return { sea: B.SEA, gen: B.GEN, mean: n ? sum / n : 0, stone, ore };
    }
    const old = stats(333, 1);
    const neu = stats(333, 2);
    B.setPaused(false);
    return { old, neu };
  });
  // 예전 판을 지정하면 예전 세계가 그대로 나온다 — 불러오기 경로가 이것에 기댄다
  eq(r.old.gen, 1, "판 1 을 지정했는데 " + r.old.gen + " 이 나왔다");
  eq(r.old.sea, 11, "예전 판의 해수면");
  assert(r.old.mean < 20,
     "예전 판인데 뭍 평균이 " + r.old.mean.toFixed(1) + " — 새 판이 새어 들어왔다");
  assert(r.neu.mean > r.old.mean + 8,
     "새 판이 예전 판보다 " + (r.neu.mean - r.old.mean).toFixed(1) + "칸밖에 안 높다");
  assert(r.neu.stone > r.old.stone * 1.4,
     "돌 부피가 " + (r.neu.stone / r.old.stone).toFixed(2) + "배뿐 — 지하가 안 깊어졌다");
  // 귀한 순서 — 깊어졌다고 다이아가 흔해지면 내려갈 이유가 사라진다
  for (const w of ["old", "neu"]) {
    const o = r[w].ore;
    assert(o.dia < o.gold && o.gold < o.iron && o.iron < o.coal,
       w + " 판의 귀한 순서가 뒤집혔다 — " + JSON.stringify(o));
  }
  // 부피는 1.8배인데 다이아가 4배면 귀할 것이 없다
  const volume = r.neu.stone / r.old.stone;
  const dia = r.neu.ore.dia / r.old.ore.dia;
  assert(dia < volume * 1.6,
     "돌이 " + volume.toFixed(2) + "배인데 다이아는 " + dia.toFixed(2) + "배다 — 너무 흔해졌다");
});

test("v80 수평선·구름: 세계를 갈아타면 바다 판과 구름이 따라 올라온다", async (page) => {
  const r = await page.evaluate(() => {
    const B = window.__blockyard;
    B.setPaused(true); B.beginPlay();
    const out = [];
    for (const gen of [1, 2, 1]) {
      B.generate(4242, gen); B.refreshAllTops(); B.relightAll(false);
      B.player.pos.set(4.5, B.SEA + 2, 48.5);
      B.camera.position.set(4.5, B.SEA + 2 + B.EYE, 48.5);
      B.step(1 / 60);
      out.push({ gen, sea: B.SEA,
                 seaPlate: +B.outerSea.position.y.toFixed(2),
                 want: +B.OUTER_SEA_Y.toFixed(2),
                 cloud: +B.cloudGroup.position.y.toFixed(2),
                 cloudHi: +B.cloudGroupHigh.position.y.toFixed(2),
                 visible: B.outerSea.visible });
    }
    B.endPlay(); B.setPaused(false);
    return out;
  });
  for (const o of r) {
    near(o.seaPlate, o.want, 0.01,
       "판 " + o.gen + ": 바깥 바다가 y=" + o.seaPlate + " 인데 해수면은 " + o.sea +
       " — 수평선이 " + (o.want - o.seaPlate).toFixed(1) + "칸 어긋난다");
    assert(o.visible, "판 " + o.gen + ": 물 위에 섰는데 바깥 바다가 안 보인다");
    // 구름은 지형과 함께 올라간다 — 안 그러면 봉우리 위 하늘이 26칸에서 14칸이 된다
    eq(o.cloud, o.sea - 11, "판 " + o.gen + ": 낮은 구름층이 안 따라 올라왔다");
    eq(o.cloudHi, o.sea - 11, "판 " + o.gen + ": 높은 구름층이 안 따라 올라왔다");
  }
  const g2 = r.find(o => o.gen === 2);
  assert(g2.seaPlate > 20, "판 2 에서 바다 판이 여전히 낮은 자리에 있다: " + g2.seaPlate);
});

test("v80 그리기: 지상에서는 발밑 지하 청크를 안 그린다", async (page) => {
  const r = await page.evaluate(() => {
    const B = window.__blockyard;
    B.setPaused(true); B.beginPlay();
    B.S.terrain = 0;      // 앞선 시험이 산악·평지를 남기면 판 1 의 묻힌 청크 수가 달라진다
    function shot() {
      let vis = 0, tris = 0;
      for (const m of B.opaqueMeshes) {
        if (!m.visible) continue;
        vis++;
        const ix = m.geometry.getIndex();
        if (ix) tris += ix.count / 3;
      }
      return { vis, tris };
    }
    const out = [];
    for (const gen of [1, 2]) {
      B.generate(4242, gen); B.refreshAllTops(); B.relightAll(false);
      B.markAllDirty(); B.buildBudget(1e6); B.refreshChunkFloor();
      // 지상 — 걸러내야 한다
      B.camera.position.set(6.5, B.SEA + 3, 6.5);
      B.updateChunkVisibility(120, null, false);
      const plain = shot();
      B.updateChunkVisibility(120, B.chunkFloor, true);
      const culled = shot();
      const buried = B.chunkBuried;
      // 지하 — 한 칸도 걸러내면 안 된다 (굴 안에서 벽이 사라진다)
      B.updateChunkVisibility(120, B.chunkFloor, false);
      const under = shot();
      out.push({ gen, sea: B.SEA, plain, culled, under, buried });
    }
    B.endPlay(); B.setPaused(false);
    return out;
  });
  const g1 = r.find(o => o.gen === 1), g2 = r.find(o => o.gen === 2);
  // 판 1(얕은 세계)은 통째로 묻힌 청크가 거의 없다 — 동작이 안 바뀌어야 한다
  // 판 1(얕은 세계)에는 통째로 묻힌 청크가 거의 없다 — 예전 세계의 그림이 크게 달라지면 안 된다
  assert(g1.culled.tris > g1.plain.tris * 0.93,
     "판 1 에서 삼각형이 " + g1.plain.tris + "→" + g1.culled.tris +
     " 로 줄었다 — 예전 세계의 그림이 달라진다");
  // 판 2 는 발밑 지하를 걷어낸다
  assert(g2.culled.tris < g2.plain.tris * 0.85,
     "판 2 지상에서 삼각형이 " + g2.plain.tris + "→" + g2.culled.tris + " 로 " +
     Math.round(100 * (1 - g2.culled.tris / g2.plain.tris)) + "% 밖에 안 줄었다");
  assert(g2.buried > 0, "묻힌 청크를 하나도 못 찾았다");
  // 지하로 내려가면 전부 돌아와야 한다
  eq(g2.under.vis, g2.plain.vis,
     "지하인데 청크 " + (g2.plain.vis - g2.under.vis) + "개가 안 돌아왔다 — 굴 안에서 벽이 없어진다");
});

test("v80 과제: 갱도가 그 세계의 지하에서 열린다", async (page) => {
  const r = await page.evaluate(() => {
    const B = window.__blockyard;
    B.setPaused(true); B.beginPlay();
    const out = [];
    for (const gen of [1, 2]) {
      B.generate(4242, gen); B.refreshAllTops(); B.relightAll(false);
      // 지하 여러 높이에서 같은 갱도를 파 본다
      for (const y of [4, Math.round(B.SEA * 0.5), B.SEA - 4]) {
        B.S.earned = {}; B.S.history.length = 0; B.S.future.length = 0;
        const X = 20, Z = 20;
        // 통돌로 채운 뒤 200칸을 파고 횃불 10개
        for (let dx = 0; dx < 30; dx++) for (let dz = 0; dz < 12; dz++)
          for (let dy = -1; dy <= 3; dy++) B.set(X + dx, y + dy, Z + dz, B.B.STONE);
        B.refreshAllTops(); B.relightAll(false);
        let dug = 0, lit = 0;
        for (let dz = 0; dz < 12 && dug < 200; dz++)
          for (let dx = 0; dx < 30 && dug < 200; dx++) {
            B.applyEdit(X + dx, y, Z + dz, B.B.AIR, true);
            dug++;
            if (lit < 10 && dug % 15 === 0) { B.applyEdit(X + dx, y, Z + dz, B.B.TORCH, true); lit++; }
          }
        // 과제 검사는 **플레이어 둘레**만 본다 — 판 자리로 옮겨 놓지 않으면 아무것도 안 센다
        B.player.pos.set(X + 15.5, y + 1, Z + 6.5);
        B.checkBuildAchievements();
        out.push({ gen, sea: B.SEA, y, dug, lit, got: !!B.S.earned.mineshaft });
      }
    }
    B.S.earned = {}; B.S.history.length = 0; B.S.future.length = 0;
    B.endPlay(); B.setPaused(false);
    return out;
  });
  for (const o of r) {
    eq(o.lit, 10, "시험대가 안 섰다 — 횃불을 " + o.lit + "개만 달았다");
    assert(o.got,
       "판 " + o.gen + "(바다 " + o.sea + ") 의 y=" + o.y + " 에서 200칸을 파고 횃불 10개를 달았는데 갱도 과제가 안 열렸다");
  }
});

test("v80 미리보기: 시드마다 산 비율이 달라진다", async (page) => {
  const r = await page.evaluate(() => {
    const B = window.__blockyard;
    B.setPaused(true);
    const caps = [];
    for (const gen of [1, 2]) {
      const one = [];
      for (const seed of [333, 1234, 42, 7]) {
        B.generate(seed, gen); B.refreshAllTops();
        B.drawPreview();          // 인자를 주면 캡션을 안 고친다
        one.push(document.getElementById("preview-cap").textContent);
      }
      caps.push({ gen, one });
    }
    B.setPaused(false);
    return caps;
  });
  for (const g of r) {
    const highs = g.one.map(t => {
      const m = /산\s*(\d+)%/.exec(t);
      return m ? +m[1] : -1;
    });
    assert(highs.every(h => h >= 0), "판 " + g.gen + ": 캡션에서 산 비율을 못 읽었다: " + g.one[0]);
    assert(Math.max.apply(null, highs) < 70,
       "판 " + g.gen + ": 산 비율이 " + highs.join("/") + " — 평지도 전부 산으로 세고 있다");
    assert(new Set(highs).size > 1,
       "판 " + g.gen + ": 네 시드의 산 비율이 " + highs.join("/") + " 로 똑같다 — 시드를 고를 이유가 없다");
  }
});

test("v80 소리: 동굴 울림이 머리 위 흙 두께로 걸린다", async (page) => {
  const r = await page.evaluate(() => {
    const B = window.__blockyard;
    B.setPaused(true); B.beginPlay();
    const out = [];
    for (const gen of [1, 2]) {
      B.generate(4242, gen); B.refreshAllTops(); B.relightAll(false);
      const X = 40, Z = 40;
      const surf = B.topMap[Z * B.WX + X];
      for (const depth of [3, 8, 16]) {
        const y = surf - depth;
        if (y < 2) continue;
        // 캄캄한 방을 판다
        for (let dx = -2; dx <= 2; dx++) for (let dz = -2; dz <= 2; dz++)
          for (let dy = -1; dy <= 3; dy++) B.set(X + dx, y + dy, Z + dz, B.B.STONE);
        for (let dx = -1; dx <= 1; dx++) for (let dz = -1; dz <= 1; dz++)
          for (let dy = 0; dy <= 1; dy++) B.set(X + dx, y + dy, Z + dz, 0);
        B.refreshAllTops(); B.relightAll(false);
        B.player.pos.set(X + 0.5, y, Z + 0.5);
        B.player.vel.set(0, 0, 0); B.player.flying = true;
        B.S.caveHeard = 0;
        for (let k = 0; k < 40 * 60; k++) {
          B.S.caveTimer = 0;                 // 뜸을 없애고 조건만 보게 한다
          B.step(1 / 60);
        }
        const heard = B.S.caveHeard;
        out.push({ gen, sea: B.SEA, surf, depth, y, heard });
      }
    }
    B.player.flying = false;
    B.endPlay(); B.setPaused(false);
    return out;
  });
  for (const o of r) {
    if (o.depth <= 3) continue;
    assert(o.heard > 0,
       "판 " + o.gen + ": 지표(" + o.surf + ") 아래 " + o.depth + "칸(y=" + o.y + ")에서 동굴 울림이 한 번도 안 났다");
  }
});

test("v80 지도: 지상 지도가 굴 어귀를 보여 주고, 단면은 표식의 층을 알려 준다", async (page) => {
  const r = await page.evaluate(() => {
    const B = window.__blockyard;
    B.setPaused(true); B.beginPlay();
    B.S.terrain = 0;
    B.generate(1234, 2); B.refreshAllTops(); B.relightAll(false);
    // 지도를 통째로 밝힌다 (걸어서 채우는 부분은 다른 시험이 본다)
    for (let i = 0; i < B.WX * B.WZ; i++) B.seenMap[i] = 3;

    // 어귀가 있는 뭍 기둥을 찾는다
    let mx = -1, mz = -1, mouths = 0;
    for (let z = 0; z < B.WZ; z++) for (let x = 0; x < B.WX; x++) {
      const h = B.heightMap[z * B.WX + x], t = B.topMap[z * B.WX + x];
      if (h > B.SEA && h - t >= 3) { mouths++; if (mx < 0) { mx = x; mz = z; } }
    }
    // 지상에서 그린다
    B.player.pos.set(mx + 0.5, B.topMap[mz * B.WX + mx] + 3, mz + 0.5);
    B.S.mmZoom = 1;
    B.drawMinimap();
    const under1 = B.S.mmUnder;
    const cv = document.getElementById("mm");
    const px = cv.getContext("2d").getImageData(mx, mz, 1, 1).data;

    // 어귀가 아닌 평범한 뭍 칸
    let nx = -1, nz = -1;
    for (let z = 0; z < B.WZ && nx < 0; z++) for (let x = 0; x < B.WX; x++) {
      const h = B.heightMap[z * B.WX + x], t = B.topMap[z * B.WX + x];
      if (h > B.SEA && h - t === 0) { nx = x; nz = z; break; }
    }
    const pn = cv.getContext("2d").getImageData(nx, nz, 1, 1).data;

    // 지하 단면 — 표식의 층이 이름 옆에 나와야 한다
    B.S.marks = [[mx, 40, mz, "위층"], [mx + 2, 6, mz + 2, "아래층"]];
    B.player.pos.set(mx + 0.5, 20, mz + 0.5);
    // 통돌 속에 세워 지하로 인식되게 한다
    for (let dx = -3; dx <= 3; dx++) for (let dz = -3; dz <= 3; dz++)
      for (let dy = 0; dy <= 12; dy++) B.set(mx + dx, 20 + dy, mz + dz, B.B.STONE);
    B.set(mx, 20, mz, 0); B.set(mx, 21, mz, 0);
    B.refreshAllTops();
    B.drawMinimap();
    const under2 = B.S.mmUnder;
    const cap = B.refreshMinimapCap();

    B.S.marks = [];
    B.endPlay(); B.setPaused(false);
    return { mouths, mx, mz, mouthPx: [px[0], px[1], px[2]], plainPx: [pn[0], pn[1], pn[2]],
             under1, under2, cap };
  });
  assert(r.mouths > 30, "굴 어귀가 " + r.mouths + "개뿐이다 — 시험대가 안 섰다");
  assert(!r.under1, "지상에 섰는데 단면 지도로 그렸다");
  // 어귀는 주황 점 — 둘레 땅과 뚜렷이 달라야 한다
  assert(r.mouthPx[0] > 200 && r.mouthPx[2] < 120,
     "굴 어귀가 지도에 안 보인다: rgb(" + r.mouthPx.join(",") + ")");
  const diff = Math.abs(r.mouthPx[0] - r.plainPx[0]) + Math.abs(r.mouthPx[1] - r.plainPx[1]) +
               Math.abs(r.mouthPx[2] - r.plainPx[2]);
  assert(diff > 90,
     "어귀와 평범한 땅의 색이 너무 비슷하다: " + r.mouthPx + " vs " + r.plainPx);
  assert(r.under2, "통돌 속에 섰는데 단면 지도로 안 바뀌었다");
  assert(/단면/.test(r.cap), "단면 캡션이 아니다: " + r.cap);
});

test("v81 갱도: 지하에 사람이 지나간 흔적이 있고, 물·용암을 안 뚫는다", async (page) => {
  const r = await page.evaluate(() => {
    const B = window.__blockyard;
    B.setPaused(true);
    B.S.terrain = 0;
    function survey(seed, gen) {
      // 조명을 새로 켠다 — 안 그러면 아래 lightSky 단언이 **앞 세계의 낡은 값**을 읽는다
      B.generate(seed, gen); B.refreshAllTops(); B.relightAll(false);
      let fence = 0, beam = 0, torch = 0, floor = 0, room = 0;
      let wet = 0, sky = 0, walk = 0;
      for (let y = 1; y < B.WY; y++) for (let z = 1; z < B.WZ - 1; z++) for (let x = 1; x < B.WX - 1; x++) {
        const b = B.world[B.idx(x, y, z)];
        if (y >= B.SEA) continue;
        if (b === B.B.FENCE) {
          fence++;
          // 갱도가 물·용암과 맞닿으면 세계가 잠긴다 — 되돌릴 사람이 없다
          for (const d of [[1,0,0],[-1,0,0],[0,1,0],[0,-1,0],[0,0,1],[0,0,-1]]) {
            const nb = B.world[B.idx(x + d[0], y + d[1], z + d[2])];
            if (nb === B.B.WATER || nb === B.B.LAVA) wet++;
          }
          // 지표를 뚫었나 — 기둥 위로 하늘이 트여 있으면 갱도가 아니다
          if (B.lightSky[B.idx(x, y + 1, z)] === 15) sky++;
        } else if (b === B.B.LOG) beam++;
        else if (b === B.B.TORCH) torch++;
        else if (b === B.B.BOOKSHELF || b === B.B.LAMP || b === B.B.CARPET) room++;
      }
      // 걸어 다닐 수 있나 — 들보 아래 가운데가 뚫려 있어야 한다
      for (let y = 1; y < B.SEA; y++) for (let z = 1; z < B.WZ - 1; z++) for (let x = 1; x < B.WX - 1; x++) {
        if (B.world[B.idx(x, y, z)] !== B.B.LOG) continue;
        for (const d of [[1,0],[-1,0],[0,1],[0,-1]]) {
          const mx = x + d[0], mz = z + d[1];
          if (B.world[B.idx(mx, y, mz)] !== B.B.LOG) continue;   // 들보 줄
        }
        // 들보 두 칸 아래(사람 키)가 비어 있는 칸을 센다
        if (B.world[B.idx(x, y - 1, z)] === 0 && B.world[B.idx(x, y - 2, z)] === 0) walk++;
      }
      return { fence, beam, torch, floor, room, wet, sky, walk };
    }
    const deep = [];
    for (const seed of [333, 1234, 42, 7]) deep.push(Object.assign({ seed }, survey(seed, 2)));
    const shallow = survey(333, 1);

    // 난수 줄기 — 갱도를 껐다 켜도 땅·동굴·나무가 한 비트도 안 달라져야 한다
    function hash() {
      let h = 2166136261;
      for (let i = 0; i < B.N; i += 7) { h ^= B.world[i]; h = Math.imul(h, 16777619); }
      for (let i = 0; i < B.WX * B.WZ; i++) {
        h ^= B.heightMap[i]; h = Math.imul(h, 16777619);
        h ^= B.biomeMap[i]; h = Math.imul(h, 16777619);
      }
      return h >>> 0;
    }
    B.S.noMines = true;  B.generate(4242, 2); B.refreshAllTops(); const off = hash();
    B.S.noMines = false; B.generate(4242, 2); B.refreshAllTops(); const on = hash();
    // 갱도만 빼고 견주려면 갱도 블록을 지운 뒤 견줘야 한다 — 지형만 따로 잰다
    function terrainHash() {
      let h = 2166136261;
      for (let i = 0; i < B.WX * B.WZ; i++) {
        h ^= B.heightMap[i]; h = Math.imul(h, 16777619);
        h ^= B.biomeMap[i]; h = Math.imul(h, 16777619);
      }
      return h >>> 0;
    }
    B.S.noMines = true;  B.generate(4242, 2); B.refreshAllTops(); const tOff = terrainHash();
    B.S.noMines = false; B.generate(4242, 2); B.refreshAllTops(); const tOn = terrainHash();
    B.S.noMines = false;
    B.setPaused(false);
    return { deep, shallow, off, on, tOff, tOn };
  });
  for (const d of r.deep) {
    assert(d.fence >= 24,
       "시드 " + d.seed + ": 갱도 기둥이 " + d.fence + "개뿐 — 지하에 흔적이 없다");
    assert(d.beam >= 20, "시드 " + d.seed + ": 들보가 " + d.beam + "개뿐이다");
    assert(d.torch >= 8, "시드 " + d.seed + ": 갱도 횃불이 " + d.torch + "개뿐 — 캄캄해서 못 찾는다");
    eq(d.wet, 0, "시드 " + d.seed + ": 갱도가 물·용암과 " + d.wet + "칸 맞닿았다 — 세계가 잠긴다");
    eq(d.sky, 0, "시드 " + d.seed + ": 갱도가 지표를 " + d.sky + "칸 뚫었다");
    assert(d.walk >= 15, "시드 " + d.seed + ": 들보 아래로 지나갈 자리가 " + d.walk + "칸뿐이다");
  }
  assert(r.deep.some(d => d.room > 0), "네 시드 어디에도 끝방이 없다 — 끝까지 걸어갈 이유가 없다");
  // 얕은 판(바다 11)에는 안 짓는다 — 지하가 13칸뿐이라 자리가 없다
  eq(r.shallow.fence, 0, "판 1 에 갱도가 생겼다 — 지하 13칸에 통로를 놓을 자리가 없다");
  // 별도 난수 줄기 — 갱도를 껐다 켜도 지형은 그대로
  eq(r.tOn, r.tOff, "갱도를 넣자 지형이 달라졌다 — 난수 줄기를 이어 썼다");
  assert(r.on !== r.off, "갱도를 켰는데 세계가 한 칸도 안 달라졌다 — 시험대가 안 섰다");
});

test("v81 지도: 지하가 세 겹이고, 예전 저장은 펼쳐서 읽는다", async (page) => {
  const r = await page.evaluate(() => {
    const B = window.__blockyard;
    B.setPaused(true); B.beginPlay();
    const slotKey = B.curKey();
    const keepSave = localStorage.getItem(slotKey);
    const X = 40, Z = 40;
    // 세 층에 각각 캄캄한 방을 파고, 한 층씩만 걸어 본다
    const ys = [4, Math.round(B.SEA * 0.45), B.SEA - 3];
    for (const y of ys)
      for (let dx = -4; dx <= 4; dx++) for (let dz = -4; dz <= 4; dz++) {
        for (let dy = 0; dy <= 3; dy++) B.set(X + dx, y + dy, Z + dz, 0);
        for (let dy = 6; dy <= 12; dy++) B.set(X + dx, y + dy, Z + dz, B.B.STONE);
      }
    B.refreshAllTops();
    B.seenMap.fill(0);
    B.player.flying = true; B.player.vel.set(0, 0, 0);

    const bands = ys.map(y => B.underBand(y));
    // 가운데 층만 걷는다
    B.player.pos.set(X + 0.5, ys[1] + 1, Z + 0.5);
    B.drawMinimap();
    const cell = B.seenMap[Z * B.WX + X];
    const underNow = B.S.mmUnder;

    // 다른 층에서 보면 그 칸은 아직 흰 종이여야 한다
    B.player.pos.set(X + 0.5, ys[0] + 1, Z + 0.5);
    B.drawMinimap();
    const cellAfterLow = B.seenMap[Z * B.WX + X];

    // 저장 → 불러오기: 층이 그대로 이어지나
    B.saveGame();
    const raw = JSON.parse(localStorage.getItem(slotKey));
    const mv = raw.mv;
    B.seenMap.fill(0);
    B.loadGame();
    const afterLoad = B.seenMap[Z * B.WX + X];

    // 예전 저장 — mv 가 없고 지하 비트가 한 장뿐이다. 세 겹으로 펼쳐져야 한다.
    delete raw.mv;
    const legacy = new Uint8Array(B.WX * B.WZ);
    legacy[Z * B.WX + X] = B.SEEN_TOP | B.SEEN_UNDER;
    raw.mm = B.encodeArrB64(legacy);
    localStorage.setItem(slotKey, JSON.stringify(raw));
    B.seenMap.fill(0);
    const oldOk = B.loadGame();
    const afterOld = B.seenMap[Z * B.WX + X];

    if (keepSave === null) localStorage.removeItem(slotKey);
    else localStorage.setItem(slotKey, keepSave);
    B.player.flying = false;
    B.endPlay(); B.setPaused(false);
    return { bands, cell, underNow, cellAfterLow, mv, afterLoad, oldOk, afterOld,
             ALL: B.SEEN_UNDER_ALL, TOP: B.SEEN_TOP, ver: raw.v, ys, sea: B.SEA };
  });
  assert(new Set(r.bands).size === 3,
     "세 층이 같은 비트를 쓴다: " + r.bands.join("/") + " (해수면 " + r.sea + " · y " + r.ys.join("/") + ")");
  assert(r.underNow, "지붕 아래인데 지하로 안 넘어갔다");
  eq(r.cell & r.ALL, r.bands[1], "가운데 층을 걸었는데 밝혀진 층이 다르다");
  eq(r.cellAfterLow & r.ALL, r.bands[1] | r.bands[0],
     "아래층으로 내려갔는데 층 표시가 " + (r.cellAfterLow & r.ALL).toString(2) + " 다");
  eq(r.mv, 2, "저장에 지도 판이 안 실렸다");
  eq(r.afterLoad & r.ALL, r.cellAfterLow & r.ALL, "불러오니 층 표시가 달라졌다");
  assert(r.oldOk, "지도 판이 없는 예전 저장을 못 읽었다");
  eq(r.afterOld & r.ALL, r.ALL,
     "예전 저장의 지하 한 장을 세 겹으로 안 펼쳤다 — 밝혀 둔 지도를 잃는다");
  eq(r.afterOld & r.TOP, r.TOP, "예전 저장의 지상 지도가 사라졌다");
  eq(r.ver, 5, "저장 버전은 v5 그대로여야 한다");
});

test("v82 핫바: 모양을 칸마다 기억한다", async (page) => {
  const r = await page.evaluate(() => {
    const B = window.__blockyard;
    B.setPaused(true); B.beginPlay();
    const slotKey = B.curKey();
    const keepSave = localStorage.getItem(slotKey);
    const keepBar = B.S.bar.slice(), keepAlt = B.S.barAlt.slice();

    B.selectSlot(0); B.setShapeMode(2);        // 0번 칸 = 계단
    B.selectSlot(1); B.setShapeMode(0);        // 1번 칸 = 전체
    B.selectSlot(2); B.setShapeMode(1);        // 2번 칸 = 반블록

    B.selectSlot(0); const s0 = B.S.shapeMode;
    B.selectSlot(1); const s1 = B.S.shapeMode;
    B.selectSlot(2); const s2 = B.S.shapeMode;
    // 계단 칸으로 돌아오면 계단이어야 한다
    B.selectSlot(0); const back = B.S.shapeMode;

    // 핫바 2쪽도 각자 기억한다
    const page1 = B.S.barPage;
    B.swapBarPage();
    const altShape = B.S.shapeMode;            // 2쪽 0번 칸은 아직 전체
    B.setShapeMode(1);
    B.swapBarPage();
    const back1 = B.S.shapeMode;               // 1쪽 0번 칸은 여전히 계단
    B.swapBarPage();
    const back2 = B.S.shapeMode;               // 2쪽 0번 칸은 반블록
    B.swapBarPage();

    // 놓을 때 그 칸의 모양이 나오나
    B.selectSlot(2);
    const shapeSlab = B.currentShape(false);
    B.selectSlot(1);
    const shapeFull = B.currentShape(false);

    // 저장 → 불러오기
    B.selectSlot(0);
    B.saveGame();
    B.setShapeMode(0);
    for (let i = 0; i < 10; i++) { B.selectSlot(i); B.setShapeMode(0); }
    B.selectSlot(0);
    B.loadGame();
    B.selectSlot(2); const loaded2 = B.S.shapeMode;
    B.selectSlot(0); const loaded0 = B.S.shapeMode;

    // 예전 저장 — sb 가 없고 sm 하나뿐이다. 고른 칸에만 들어가야 한다.
    const raw = JSON.parse(localStorage.getItem(slotKey));
    delete raw.sb; delete raw.sb2;
    raw.sm = 2;
    localStorage.setItem(slotKey, JSON.stringify(raw));
    B.selectSlot(3);
    const oldOk = B.loadGame();
    const old3 = B.S.shapeMode;
    B.selectSlot(4); const old4 = B.S.shapeMode;

    if (keepSave === null) localStorage.removeItem(slotKey);
    else localStorage.setItem(slotKey, keepSave);
    B.S.bar = keepBar; B.S.barAlt = keepAlt; B.refreshBar();
    for (let i = 0; i < 10; i++) { B.selectSlot(i); B.setShapeMode(0); }
    B.selectSlot(0);
    B.endPlay(); B.setPaused(false);
    return { s0, s1, s2, back, altShape, back1, back2, shapeSlab, shapeFull,
             loaded0, loaded2, oldOk, old3, old4, page1,
             SLAB: B.SH.SLAB, FULL: B.SH.FULL };
  });
  eq(r.s0, 2, "0번 칸이 계단을 안 기억한다");
  eq(r.s1, 0, "1번 칸이 전체를 안 기억한다");
  eq(r.s2, 1, "2번 칸이 반블록을 안 기억한다");
  eq(r.back, 2, "계단 칸으로 돌아왔는데 모양이 " + r.back + " 다");
  // 놓는 모양이 실제로 따라온다
  eq(r.shapeSlab, r.SLAB, "반블록 칸인데 놓이는 모양이 반블록이 아니다");
  eq(r.shapeFull, r.FULL, "전체 칸인데 놓이는 모양이 통짜가 아니다");
  // 핫바 두 쪽이 각자 기억한다
  eq(r.altShape, 0, "2쪽으로 넘어갔는데 1쪽의 계단이 따라왔다");
  eq(r.back1, 2, "1쪽으로 돌아왔는데 계단을 잃었다");
  eq(r.back2, 1, "2쪽으로 다시 갔는데 반블록을 잃었다");
  // 저장에 실린다
  eq(r.loaded0, 2, "불러오니 0번 칸의 계단이 사라졌다");
  eq(r.loaded2, 1, "불러오니 2번 칸의 반블록이 사라졌다");
  // 예전 저장 — 고른 칸에만
  assert(r.oldOk, "칸별 모양이 없는 예전 저장을 못 읽었다");
  eq(r.old3, 2, "예전 저장의 모양이 고른 칸에 안 들어갔다");
  eq(r.old4, 0, "예전 저장의 모양이 다른 칸까지 물들였다");
});

test("v82 과제: 꼭대기는 날아서가 아니라 딛고 서야 열린다", async (page) => {
  const r = await page.evaluate(() => {
    const B = window.__blockyard;
    B.setPaused(true); B.beginPlay();
    const out = [];
    for (const gen of [1, 2]) {
      B.generate(4242, gen); B.refreshAllTops(); B.relightAll(false);
      // 문턱을 SEA+15 로 올렸다 (v88) — 스폰 높이가 26~36 이라 SEA+9 는
      // 시작하자마자 저절로 열렸다. 시험도 그 위에서 재야 한다.
      const X = 30, Z = 30, top = B.SEA + 18;
      for (let dx = -2; dx <= 2; dx++) for (let dz = -2; dz <= 2; dz++)
        for (let dy = -2; dy <= 6; dy++) B.set(X + dx, top + dy, Z + dz, dy === -1 ? B.B.STONE : 0);
      B.refreshAllTops(); B.relightAll(false);

      // (a) 날아서 그 높이에 있어도 안 열린다
      B.S.earned = {}; B.S.walked = 99;
      B.player.pos.set(X + 0.5, top, Z + 0.5); B.player.vel.set(0, 0, 0);
      B.player.flying = true;
      for (let k = 0; k < 130; k++) B.step(1 / 60);
      const flying = !!B.S.earned.high;

      // (b) 딛고 서면 열린다
      B.S.earned = {}; B.S.walked = 99;
      B.player.flying = false;
      B.player.pos.set(X + 0.5, top, Z + 0.5); B.player.vel.set(0, 0, 0);
      for (let k = 0; k < 130; k++) B.step(1 / 60);
      const standing = !!B.S.earned.high;

      // (c) 해수면 근처 땅에서는 안 열린다
      B.S.earned = {}; B.S.walked = 99;
      for (let dx = -2; dx <= 2; dx++) for (let dz = -2; dz <= 2; dz++)
        for (let dy = -2; dy <= 6; dy++)
          B.set(X + dx, B.SEA + 2 + dy, Z + dz, dy === -1 ? B.B.STONE : 0);
      B.refreshAllTops();
      B.player.pos.set(X + 0.5, B.SEA + 2, Z + 0.5); B.player.vel.set(0, 0, 0);
      for (let k = 0; k < 130; k++) B.step(1 / 60);
      const low = !!B.S.earned.high;

      out.push({ gen, sea: B.SEA, top, flying, standing, low });
    }
    B.S.earned = {}; B.player.flying = false;
    B.endPlay(); B.setPaused(false);
    return out;
  });
  for (const o of r) {
    assert(o.standing,
       "판 " + o.gen + ": 해수면(" + o.sea + ")보다 18칸 높은 땅을 딛고 섰는데 꼭대기가 안 열렸다");
    assert(!o.flying, "판 " + o.gen + ": 날고 있는데 꼭대기가 열렸다");
    assert(!o.low, "판 " + o.gen + ": 해수면 바로 위에서 꼭대기가 열렸다");
  }
});

test("v82 굴 어귀: 굴이 지표로 이어지고, 물·용암을 안 뚫는다", async (page) => {
  const r = await page.evaluate(() => {
    const B = window.__blockyard;
    B.setPaused(true);
    B.S.terrain = 0;
    function survey(seed, gen, off) {
      B.S.noMouths = !!off;
      B.generate(seed, gen); B.refreshAllTops();
      let land = 0, mouths = 0, wet = 0;
      for (let z = 1; z < B.WZ - 1; z++) for (let x = 1; x < B.WX - 1; x++) {
        const h = B.heightMap[z * B.WX + x], t = B.topMap[z * B.WX + x];
        if (h <= B.SEA) continue;
        land++;
        if (h - t < 3) continue;
        mouths++;
        // 어귀 기둥에 물·용암이 섞이면 폭포나 용암 굴뚝이 된다
        for (let y = t + 1; y <= h; y++) {
          const b = B.world[B.idx(x, y, z)];
          if (b === B.B.WATER || b === B.B.LAVA) wet++;
        }
      }
      let hh = 2166136261;
      for (let i = 0; i < B.WX * B.WZ; i++) {
        hh ^= B.heightMap[i]; hh = Math.imul(hh, 16777619);
        hh ^= B.biomeMap[i]; hh = Math.imul(hh, 16777619);
      }
      B.S.noMouths = false;
      return { land, mouths, wet, pct: 100 * mouths / land, terrain: hh >>> 0 };
    }
    const rows = [];
    for (const seed of [333, 1234, 42]) {
      rows.push({ seed, on: survey(seed, 2, false), off: survey(seed, 2, true) });
    }
    const shallow = survey(333, 1, false);
    B.setPaused(false);
    return { rows, shallow };
  });
  for (const row of r.rows) {
    assert(row.on.pct >= 6.5,
       "시드 " + row.seed + ": 뭍 기둥의 " + row.on.pct.toFixed(1) +
       "% 만 굴로 이어진다 — 들어갈 데도 나올 데도 없다");
    assert(row.on.mouths > row.off.mouths,
       "시드 " + row.seed + ": 어귀 뚫기를 켰는데 어귀가 " + row.off.mouths +
       "→" + row.on.mouths + " 로 안 늘었다");
    eq(row.on.wet, 0,
       "시드 " + row.seed + ": 어귀 기둥에 물·용암이 " + row.on.wet + "칸 있다");
    // 별도 난수 줄기 — 어귀를 껐다 켜도 땅은 그대로
    eq(row.on.terrain, row.off.terrain,
       "시드 " + row.seed + ": 어귀를 뚫자 지형이 달라졌다 — 난수 줄기를 이어 썼다");
  }
  // 얕은 판은 손대지 않는다
  assert(r.shallow.pct >= 6,
     "판 1 의 어귀 비율이 " + r.shallow.pct.toFixed(1) + "% — 예전 세계를 건드렸다");
});

test("v83 지도: 층이 바뀌어도 백지가 되지 않고, 지하에도 어귀가 찍힌다", async (page) => {
  const r = await page.evaluate(() => {
    const B = window.__blockyard;
    B.setPaused(true); B.beginPlay();
    B.S.terrain = 0;
    B.generate(4242, 2); B.refreshAllTops(); B.relightAll(false);
    const X = 40, Z = 40;
    // 층 경계를 걸치는 굴 하나 — 위 칸과 아래 칸이 다른 층이 되게 고른다
    const t = Math.max(1, (B.SEA + 2) / B.UNDER_BANDS);
    const edge = Math.round(t);                 // 첫 경계
    const lo = edge - 1, hi = edge + 1;
    for (let dx = -6; dx <= 6; dx++) for (let dz = -6; dz <= 6; dz++) {
      for (let dy = lo - 2; dy <= hi + 3; dy++) B.set(X + dx, dy, Z + dz, 0);
      for (let dy = hi + 6; dy <= hi + 16; dy++) B.set(X + dx, dy, Z + dz, B.B.STONE);
      B.set(X + dx, lo - 2, Z + dz, B.B.STONE);
    }
    B.refreshAllTops();
    B.seenMap.fill(0);
    B.player.flying = true; B.player.vel.set(0, 0, 0);

    function inked() {
      const cv = document.getElementById("mm");
      const d = cv.getContext("2d").getImageData(0, 0, B.WX, B.WZ).data;
      let n = 0;
      for (let i = 0; i < B.WX * B.WZ; i++)
        if (!(d[i*4] === 12 && d[i*4+1] === 16 && d[i*4+2] === 20)) n++;
      return n;
    }
    // 아래 층을 걷는다
    B.player.pos.set(X + 0.5, lo, Z + 0.5);
    B.drawMinimap();
    const bandLo = B.underBand(lo), bandHi = B.underBand(hi);
    const inkLo = inked();
    // 한 칸 올라가 층이 바뀐다 — 예전에는 여기서 지도가 통째로 백지가 됐다
    B.player.pos.set(X + 0.5, hi, Z + 0.5);
    B.drawMinimap();
    const inkHi = inked();
    const underNow = B.S.mmUnder;

    B.player.flying = false;
    B.endPlay(); B.setPaused(false);
    return { bandLo, bandHi, inkLo, inkHi, underNow, lo, hi, sea: B.SEA };
  });
  assert(r.bandLo !== r.bandHi,
     "시험대가 안 섰다 — y" + r.lo + " 와 y" + r.hi + " 가 같은 층이다");
  assert(r.underNow, "굴 속인데 단면 지도로 안 바뀌었다");
  assert(r.inkLo > 60, "시험대가 안 섰다 — 아래 층에서 그려진 칸이 " + r.inkLo + "개뿐이다");
  // 층이 바뀌어도 지도가 통째로 사라지면 안 된다 (흐리게라도 남는다)
  assert(r.inkHi > r.inkLo * 0.7,
     "층이 바뀌자 지도가 " + r.inkLo + "→" + r.inkHi + "칸으로 무너졌다 — 한 칸 오르내릴 때마다 백지가 된다");
});

test("v83 지도: 지하 단면에도 굴 어귀가 그려진다 (덩어리마다 하나)", async (page) => {
  const r = await page.evaluate(() => {
    const B = window.__blockyard;
    B.setPaused(true); B.beginPlay();
    B.S.terrain = 0;
    B.generate(777, 2); B.refreshAllTops(); B.relightAll(false);
    for (let i = 0; i < B.WX * B.WZ; i++) B.seenMap[i] = 15;
    const dots = B.refreshMouthDots();
    // 어귀 "칸" 은 훨씬 많다 — 덩어리로 묶었으니 점은 그보다 한참 적어야 한다
    let cells = 0;
    for (let z = 1; z < B.WZ - 1; z++) for (let x = 1; x < B.WX - 1; x++) {
      const h = B.heightMap[z * B.WX + x], t = B.topMap[z * B.WX + x];
      if (h > B.SEA && t >= 0 && h - t >= 4) cells++;
    }
    const cv = document.getElementById("mm");
    B.S.mmZoom = 1; B.S.mmZoomUnder = 1;    // 픽셀을 세계 좌표로 읽으려면 배율 1 이어야 한다
    function px(x, z) {
      const d = cv.getContext("2d").getImageData(x, z, 1, 1).data;
      return [d[0], d[1], d[2]];
    }
    // ── 지상 지도에서 점이 보이나
    B.player.pos.set(48.5, 60, 48.5);
    B.drawMinimap();
    const surfUnder = B.S.mmUnder;
    // 점이 찍힌 자리 둘레에서 주황을 찾는다 (원이라 중심 픽셀이 딱 안 맞을 수 있다)
    function orangeNear(cx, cz) {
      for (let dz = -2; dz <= 2; dz++) for (let dx = -2; dx <= 2; dx++) {
        const p = px(cx + dx, cz + dz);
        if (p[0] > 180 && p[1] > 100 && p[2] < 110 && p[0] > p[2] * 1.6) return true;
      }
      return false;
    }
    let surfSeen = 0;
    for (const dsp of B.mouthDots) if (orangeNear(dsp[0], dsp[1])) surfSeen++;

    // ── 지하 단면 — 그 기둥 둘레에 공기가 있는 어귀만 찍힌다
    const y = Math.max(3, Math.round(B.SEA * 0.4));
    for (let dx = -2; dx <= 2; dx++) for (let dz = -2; dz <= 2; dz++)
      for (let dy = 0; dy <= 14; dy++) B.set(48 + dx, y + dy, 48 + dz, B.B.STONE);
    B.set(48, y, 48, 0); B.set(48, y + 1, 48, 0);
    B.refreshAllTops();
    B.player.flying = true;
    B.player.pos.set(48.5, y, 48.5);
    B.drawMinimap();
    const under = B.S.mmUnder;
    let underSeen = 0, withAir = 0;
    for (const dsp of B.mouthDots) {
      let air = false;
      for (let ay = Math.max(1, y - 4); ay <= y + 4 && !air; ay++)
        if (B.world[B.idx(dsp[0], ay, dsp[1])] === 0) air = true;
      if (!air) continue;
      withAir++;
      if (orangeNear(dsp[0], dsp[1])) underSeen++;
    }
    B.player.flying = false;
    B.endPlay(); B.setPaused(false);
    return { dots, cells, surfUnder, surfSeen, under, underSeen, withAir,
             sizes: B.mouthDots.map(d => d[2]) };
  });
  assert(r.dots > 3, "굴 어귀 덩어리가 " + r.dots + "개뿐이다 — 시험대가 안 섰다");
  assert(r.cells > r.dots * 3,
     "어귀 칸 " + r.cells + "개가 점 " + r.dots + "개로 묶였다 — 덩어리로 안 묶고 있다");
  assert(r.sizes.every(n => n >= 2),
     "한 칸짜리 지형 주름까지 어귀로 셌다: " + r.sizes.join(","));
  assert(!r.surfUnder, "지상에 떠 있는데 단면 지도로 그렸다");
  assert(r.surfSeen > r.dots * 0.6,
     "지상 지도에 어귀 점이 " + r.surfSeen + "/" + r.dots + "개만 보인다");
  assert(r.under, "통돌 속인데 단면 지도로 안 바뀌었다");
  assert(r.withAir === 0 || r.underSeen > 0,
     "지하 단면에 굴 어귀가 하나도 안 그려졌다 — 길을 잃는 화면이 여긴데");
});

test("v83 하늘: 새가 지형을 따라 올라간다", async (page) => {
  const r = await page.evaluate(() => {
    const B = window.__blockyard;
    B.setPaused(true); B.beginPlay();
    const out = [];
    for (const gen of [1, 2]) {
      B.generate(4242, gen); B.refreshAllTops(); B.relightAll(false);
      let peak = 0;
      for (let i = 0; i < B.WX * B.WZ; i++) if (B.heightMap[i] > peak) peak = B.heightMap[i];
      // 봉우리에 선다
      let px = 0, pz = 0;
      for (let z = 0; z < B.WZ; z++) for (let x = 0; x < B.WX; x++)
        if (B.heightMap[z * B.WX + x] === peak) { px = x; pz = z; }
      B.player.pos.set(px + 0.5, peak + 1, pz + 0.5);
      B.player.vel.set(0, 0, 0); B.player.flying = true;
      B.seedFlocks();
      for (let k = 0; k < 400; k++) B.step(1 / 60);
      const eye = B.player.pos.y + B.EYE;
      let below = 0, total = 0;
      const arr = B.birds.pos;      // makePoints 가 { pos, geo, pts } 를 돌려준다
      for (let i = 0; i < arr.length; i += 3) {
        if (arr[i + 1] < -100) continue;             // 아직 안 뿌려진 것
        total++;
        if (arr[i + 1] < eye) below++;
      }
      out.push({ gen, sea: B.SEA, peak, eye, below, total });
    }
    B.player.flying = false;
    B.endPlay(); B.setPaused(false);
    return out;
  });
  for (const o of r) {
    assert(o.total > 0, "판 " + o.gen + ": 새가 한 마리도 안 뿌려졌다");
    const pct = 100 * o.below / o.total;
    assert(pct < 25,
       "판 " + o.gen + "(최고봉 " + o.peak + "): 새의 " + pct.toFixed(0) +
       "% 가 눈높이(" + o.eye.toFixed(1) + ") 아래를 난다");
  }
});

test("v83 짓기: 세계의 천장에 닿으면 그렇다고 말한다", async (page) => {
  const r = await page.evaluate(() => {
    const B = window.__blockyard;
    B.setPaused(true); B.beginPlay();
    const X = 20, Z = 20;
    for (let dx = -2; dx <= 2; dx++) for (let dz = -2; dz <= 2; dz++)
      for (let dy = B.WY - 6; dy < B.WY; dy++) B.set(X + dx, dy, Z + dz, 0);
    for (let dx = -1; dx <= 1; dx++) for (let dz = -1; dz <= 1; dz++)
      B.set(X + dx, B.WY - 1, Z + dz, B.B.STONE);   // 천장 한 판 (조준이 옆으로 새도 맞게)
    B.refreshAllTops(); B.relightAll(false);
    // 천장 위에 놓으려면 맨 윗 블록의 **윗면**을 조준해야 한다 —
    // 그 자리는 세계 밖이라 날아올라 내려다보는 길뿐이다 (비행에는 높이 제한이 없다)
    B.player.pos.set(X + 0.5, B.WY + 3, Z + 0.5);
    B.player.vel.set(0, 0, 0); B.player.flying = true;
    B.player.yaw = 0; B.player.pitch = -Math.PI / 2 + 0.01;   // 곧장 아래를 본다
    B.camera.rotation.order = "YXZ";
    B.camera.rotation.y = 0; B.camera.rotation.x = B.player.pitch;
    B.camera.position.set(B.player.pos.x, B.player.pos.y + B.EYE, B.player.pos.z);
    B.camera.updateMatrixWorld(true);
    B.S.bar[B.S.selected] = B.B.PLANKS;
    const toastEl = document.getElementById("toast");
    toastEl.textContent = "";
    const hit = B.raycast(6);
    B.place(false);
    const msg = toastEl.textContent;
    const dbg = { sel: B.S.bar[B.S.selected], active: B.S.active, uiOpen: B.S.uiOpen };
    B.player.flying = false;
    B.endPlay(); B.setPaused(false);
    return { msg, dbg, aimed: hit ? [hit.x, hit.y, hit.z, hit.ny] : null, WY: B.WY };
  });
  assert(r.aimed, "시험대가 안 섰다 — 천장 블록을 조준하지 못했다");
  assert(/천장/.test(r.msg),
     "천장에 닿았는데 아무 말이 없다 (토스트: \"" + r.msg + "\" · 조준 " +
     JSON.stringify(r.aimed) + " · " + JSON.stringify(r.dbg) + ") — 마우스만 계속 누르게 된다");
});

test("v83 그리기: 시야를 줄이면 실제로 청크가 줄어든다", async (page) => {
  const r = await page.evaluate(() => {
    const B = window.__blockyard;
    B.setPaused(true); B.beginPlay();
    B.S.terrain = 0;
    B.generate(4242, 2); B.refreshAllTops(); B.relightAll(false);
    B.markAllDirty(); B.buildBudget(1e6); B.refreshChunkFloor();
    function shot() {
      let v = 0, t = 0;
      for (const m of B.opaqueMeshes) {
        if (!m.visible) continue;
        v++;
        const ix = m.geometry.getIndex();
        if (ix) t += ix.count / 3;
      }
      return { v, t };
    }
    const out = [];
    // 섬 한가운데 — 예전에는 여기서 far 를 40 으로 줄여도 한 청크도 안 줄었다
    for (const [tag, pos, above, deep] of [
      ["지상", [48.5, 40, 48.5], true, false],
      ["지하", [48.5, 6, 48.5], false, true],
      ["어귀", [48.5, 6, 48.5], false, false]]) {
      B.camera.position.set(pos[0], pos[1], pos[2]);
      B.updateChunkVisibility(120, B.chunkFloor, above, deep);
      const wide = shot();
      B.updateChunkVisibility(40, B.chunkFloor, above, deep);
      const narrow = shot();
      out.push({ tag, wide: wide.v, narrow: narrow.v, wideT: wide.t, narrowT: narrow.t });
    }
    B.endPlay(); B.setPaused(false);
    return out;
  });
  const surf = r.find(o => o.tag === "지상");
  const under = r.find(o => o.tag === "지하");
  const mouth = r.find(o => o.tag === "어귀");
  assert(surf.narrow < surf.wide,
     "지상에서 시야를 120→40 으로 줄였는데 청크가 " + surf.wide + "→" + surf.narrow +
     " 다 — 시야만 뺏고 프레임은 그대로다");
  assert(under.wide < mouth.wide,
     "굴 속(깊이)인데 어귀에 선 것과 같은 " + under.wide + "청크를 그린다 — 위아래 바위 너머를 그린다");
  // 어귀에서는 걸지 않는다 — 먼 산이 사라지면 바로 눈에 띈다
  assert(mouth.wide >= surf.wide,
     "어귀에 섰는데 지상보다 적게 그린다 (" + mouth.wide + " vs " + surf.wide + ") — 밖이 뚫린다");
});

test("v83 과제: 세계가 지어 둔 갱도와 오두막을 찾으면 열린다", async (page) => {
  const r = await page.evaluate(() => {
    const B = window.__blockyard;
    B.setPaused(true); B.beginPlay();
    B.S.terrain = 0;
    B.generate(1234, 2); B.refreshAllTops(); B.relightAll(false);

    // 갱도 기둥 하나를 찾아 그 옆에 선다
    let mine = null, hut = null;
    for (let y = 1; y < B.SEA && !mine; y++)
      for (let z = 2; z < B.WZ - 2 && !mine; z++)
        for (let x = 2; x < B.WX - 2; x++)
          if (B.world[B.idx(x, y, z)] === B.B.FENCE) { mine = [x, y, z]; break; }
    // 오두막 유리 한 장
    for (let y = B.SEA + 1; y < B.WY && !hut; y++)
      for (let z = 2; z < B.WZ - 2 && !hut; z++)
        for (let x = 2; x < B.WX - 2; x++)
          if (B.world[B.idx(x, y, z)] === B.B.GLASS) { hut = [x, y, z]; break; }

    B.S.earned = {};
    B.player.pos.set(mine[0] + 0.5, mine[1], mine[2] + 0.5);
    B.checkFoundAchievements();
    const gotMine = !!B.S.earned.findMine;
    const hutFromMine = !!B.S.earned.findHut;

    B.S.earned = {};
    B.player.pos.set(hut[0] + 0.5, hut[1], hut[2] + 0.5);
    B.checkFoundAchievements();
    const gotHut = !!B.S.earned.findHut;

    // 내가 지은 것으로는 안 열려야 한다 — 사람이 놓은 칸은 안 센다
    B.S.earned = {};
    const X = 8, Z = 8, Y = 4;
    for (let dx = 0; dx < 4; dx++) for (let dz = 0; dz < 4; dz++)
      B.applyEdit(X + dx, Y, Z + dz, B.B.FENCE, true);
    B.player.pos.set(X + 1.5, Y, Z + 1.5);
    B.checkFoundAchievements();
    const mineFromMyBuild = !!B.S.earned.findMine;

    B.S.earned = {}; B.S.history.length = 0; B.S.future.length = 0;
    B.endPlay(); B.setPaused(false);
    return { mine, hut, gotMine, gotHut, hutFromMine, mineFromMyBuild,
             ids: B.ACHIEVEMENTS.map(a => a.id) };
  });
  assert(r.mine, "시험대가 안 섰다 — 갱도 기둥을 못 찾았다");
  assert(r.hut, "시험대가 안 섰다 — 오두막 유리를 못 찾았다");
  assert(r.ids.indexOf("findMine") >= 0 && r.ids.indexOf("findHut") >= 0,
     "찾기 과제가 목록에 없다");
  assert(r.gotMine, "갱도 안에 섰는데 '먼저 온 사람' 이 안 열렸다");
  assert(r.gotHut, "오두막 옆에 섰는데 '빈집' 이 안 열렸다");
  assert(!r.mineFromMyBuild,
     "내가 놓은 울타리로 '먼저 온 사람' 이 열렸다 — 찾은 게 아니라 지은 것이다");
});

phoneTest("지도를 눌러 표식을 찍고, 길게 눌러 확대한다", async (page) => {
  const r = await page.evaluate(async () => {
    const B = window.__blockyard;
    B.setPaused(true); B.beginPlay();
    const mm = document.getElementById("minimap");
    const style = getComputedStyle(mm);
    // 진짜 손가락처럼 좌표를 실어 보낸다 — 좌표가 없으면 "움직였나" 를 못 잰다
    const box = mm.getBoundingClientRect();
    const cx = box.left + box.width / 2, cy = box.top + box.height / 2;
    function touchAt(type, x, y) {
      const t = new Touch({ identifier: 1, target: mm, clientX: x, clientY: y });
      mm.dispatchEvent(new TouchEvent(type, {
        bubbles: true, cancelable: true,
        touches: type === "touchend" ? [] : [t], changedTouches: [t], targetTouches: []
      }));
    }
    B.S.marks = [];
    B.player.pos.set(40.5, 30, 40.5);

    // 탭 = 표식 · 다시 탭하면 지움
    touchAt("touchstart", cx, cy);
    touchAt("touchend", cx, cy);
    const afterTap = B.S.marks.length;
    touchAt("touchstart", cx, cy);
    touchAt("touchend", cx, cy);
    const afterSecond = B.S.marks.length;

    // 표식이 **없는** 자리에서 길게 = 확대
    const zoom0 = B.S.mmUnder ? B.S.mmZoomUnder : B.S.mmZoom;
    touchAt("touchstart", cx, cy);
    await new Promise(res => setTimeout(res, 620));
    touchAt("touchend", cx, cy);
    const zoom1 = B.S.mmUnder ? B.S.mmZoomUnder : B.S.mmZoom;
    const marksAfterHold = B.S.marks.length;

    // 표식이 **있는** 자리에서 길게 = 이름 붙이기 (v87).
    // 폰에는 Shift+B 가 없어 표식 열두 개가 전부 똑같은 금색 점이었다.
    touchAt("touchstart", cx, cy);
    touchAt("touchend", cx, cy);            // 표식 하나
    const promptWas = window.prompt;
    window.prompt = function () { return "채석장"; };
    const zoomBefore = B.S.mmUnder ? B.S.mmZoomUnder : B.S.mmZoom;
    touchAt("touchstart", cx, cy);
    await new Promise(res => setTimeout(res, 620));
    touchAt("touchend", cx, cy);
    window.prompt = promptWas;
    const named = B.S.marks.length === 1 ? B.markName(B.S.marks[0]) : "";
    const zoomAfter = B.S.mmUnder ? B.S.mmZoomUnder : B.S.mmZoom;
    B.S.marks = [];

    // ── 쓸어 넘기면 표식이 아니다 (v85). 지도는 시점 영역 안에 통째로 들어앉아 있어서,
    // 위를 올려다보려고 쓸다 손가락이 지도에 닿으면 표식만 찍히고 시점은 안 돌았다.
    B.S.marks = [];
    touchAt("touchstart", cx, cy);
    touchAt("touchmove", cx + 60, cy);
    touchAt("touchend", cx + 60, cy);
    const afterDrag = B.S.marks.length;

    B.S.marks = []; B.S.mmZoom = zoom0;
    B.endPlay(); B.setPaused(false);
    // 과제 팝업이 지도를 덮으면 그동안 탭이 안 먹는다
    const pop = document.getElementById("achpop");
    const pb = pop.getBoundingClientRect();
    const ov = Math.max(0, Math.min(box.right, pb.right) - Math.max(box.left, pb.left)) *
               Math.max(0, Math.min(box.bottom, pb.bottom) - Math.max(box.top, pb.top));
    const popOverlap = ov / (box.width * box.height);
    const popPE = getComputedStyle(pop).pointerEvents;

    return { pe: style.pointerEvents, afterTap, zoom0, zoom1, marksAfterHold, afterSecond,
             afterDrag, popOverlap, popPE, named, zoomBefore, zoomAfter };
  });
  eq(r.pe, "auto", "폰인데 지도가 터치를 안 받는다 (pointer-events: " + r.pe + ")");
  eq(r.afterTap, 1, "지도를 탭했는데 표식이 안 찍혔다 — 폰에는 B 키가 없다");
  assert(r.zoom1 !== r.zoom0,
     "지도를 길게 눌렀는데 확대가 " + r.zoom0 + "→" + r.zoom1 + " 다 — 폰에는 [ ] 키가 없다");

  eq(r.afterSecond, 0, "같은 자리를 다시 탭했는데 표식이 안 지워졌다");
  eq(r.marksAfterHold, 0, "표식 없는 자리를 길게 눌렀는데 표식이 찍혔다");
  eq(r.afterDrag, 0,
     "지도 위에서 쓸었는데 표식이 찍혔다 — 시점을 돌리려던 손가락을 지도가 먹는다");
  eq(r.named, "채석장",
     "표식 위에서 길게 눌렀는데 이름이 안 붙었다 (\"" + r.named + "\") — 폰에는 Shift+B 가 없다");
  eq(r.zoomAfter, r.zoomBefore,
     "표식 위에서 길게 눌렀는데 배율까지 바뀌었다: " + r.zoomBefore + " → " + r.zoomAfter);
  assert(r.popOverlap < 0.05,
     "과제 팝업이 지도의 " + Math.round(r.popOverlap * 100) + "% 를 덮는다");
  eq(r.popPE, "none", "과제 팝업이 누를 것을 가로챈다 (pointer-events: " + r.popPE + ")");
});

test("v84 색 카펫: 열여섯 색이 양털과 짝을 이루고, 카펫답게 군다", async (page) => {
  const r = await page.evaluate(() => {
    const B = window.__blockyard;
    B.setPaused(true); B.beginPlay();
    const X = 46, Y = 38, Z = 46;
    for (let dx = -2; dx <= 20; dx++) for (let dz = -2; dz <= 6; dz++)
      for (let dy = -2; dy <= 6; dy++) B.set(X + dx, Y + dy, Z + dz, 0);
    for (let dx = -2; dx <= 20; dx++) for (let dz = -2; dz <= 6; dz++)
      B.set(X + dx, Y - 1, Z + dz, B.B.PLANKS);
    B.refreshAllTops(); B.relightAll(false);

    const names = [], tiles = [], cats = [], soft = [];
    for (let i = 0; i < B.CARPET_COUNT; i++) {
      const b = B.CARPET0 + i;
      names.push(B.NAMES[b]);
      tiles.push(B.TILES[b] ? B.TILES[b][0] : -1);
      cats.push(B.categoryOf(b));
      soft.push(!!B.isCarpet(b));
    }
    // 놓아 본다 — 바닥이 있어야 놓이고, 한 겹이라 딛고 서되 걸리지 않는다
    B.applyEdit(X, Y, Z, B.CARPET0 + 4, false);
    const placed = B.get(X, Y, Z);
    // boxesAt(b, sh, x, y, z) — 블록과 모양을 같이 준다
    const boxes = B.boxesAt(placed, B.shapeAt(X, Y, Z), X, Y, Z);
    const thin = boxes && boxes.length === 1 ? boxes[0][4] : -1;
    // 성질은 **원래 카펫과 똑같아야** 한다 — 하나라도 어긋나면 그 색만 다르게 군다
    function traits(b) {
      return [B.isSolid(b), B.blocksLight(b), B.isThin(b), B.lightPass(b),
              B.needsFloor(b), B.isCross(b), B.hardnessOf(b)].join("|");
    }
    const plain = traits(B.B.CARPET);
    const odd = [];
    for (let i = 0; i < B.CARPET_COUNT; i++)
      if (traits(B.CARPET0 + i) !== plain) odd.push(i + ":" + traits(B.CARPET0 + i));
    // 바닥을 빼면 함께 사라진다
    B.applyEdit(X, Y - 1, Z, B.B.AIR, false);
    const afterFloor = B.get(X, Y, Z);
    // 허공에는 못 놓는다 — place() 가 "받칠 바닥이 필요합니다" 로 막는다
    const airNeeds = B.needsFloor(B.CARPET0 + 7);
    // 빛을 막지 않는다
    B.set(X, Y - 1, Z, B.B.PLANKS);
    B.applyEdit(X, Y, Z, B.CARPET0 + 9, false);
    B.relightAll(false);
    const lightUnder = B.lightSky[B.idx(X, Y, Z)];

    // 목록에 다 나오나 · 수집가 과제가 셀 수 있나
    let inAll = 0;
    for (const b of B.ALL_BLOCKS) if (B.isCarpet(b) && b !== B.B.CARPET) inAll++;

    B.endPlay(); B.setPaused(false);
    return { names, tiles, cats, soft, placed, thin, plain, odd, afterFloor, airNeeds,
             lightUnder, inAll, count: B.CARPET_COUNT, wool0: B.WOOL0,
             plainCarpet: B.B.CARPET, first: B.CARPET0 };
  });
  eq(r.count, 16, "색 카펫이 16색이 아니다");
  eq(r.inAll, 16, "블록 목록에 색 카펫이 " + r.inAll + "개만 있다");
  eq(new Set(r.names).size, 16, "이름이 겹친다: " + r.names.join(","));
  eq(new Set(r.tiles).size, 16, "텍스처 타일이 겹친다: " + r.tiles.join(","));
  assert(r.tiles.every(t => t > 0), "타일이 없는 색 카펫이 있다: " + r.tiles.join(","));
  assert(r.cats.every(c => c === "color"), "색 갈래가 아닌 카펫이 있다: " + r.cats.join(","));
  assert(r.soft.every(Boolean), "isCarpet 이 못 알아보는 색 카펫이 있다");
  eq(r.placed, r.first + 4, "색 카펫이 안 놓였다");
  // 한 겹(1/16) — 딛고 서되 걸리지 않는다
  assert(r.thin > 0 && r.thin <= 0.07,
     "색 카펫의 두께가 " + r.thin + " — 한 겹(0.0625)이어야 한다");
  eq(r.odd.length, 0,
     "원래 카펫(" + r.plain + ")과 다르게 구는 색 카펫이 있다: " + r.odd.join(" · "));
  eq(r.afterFloor, 0, "받치던 바닥이 사라졌는데 색 카펫이 남았다");
  eq(r.airNeeds, true, "색 카펫이 바닥 없이도 놓인다");
  eq(r.lightUnder, 15, "색 카펫이 하늘빛을 막는다: " + r.lightUnder);
});

test("v84 저장: 색 카펫이 저장에 실려 돌아온다", async (page) => {
  const r = await page.evaluate(() => {
    const B = window.__blockyard;
    B.setPaused(true); B.beginPlay();
    const slotKey = B.curKey();
    const keepSave = localStorage.getItem(slotKey);
    const X = 60, Y = 36, Z = 60;
    for (let dx = 0; dx < 16; dx++) {
      B.set(X + dx, Y - 1, Z, B.B.PLANKS);
      B.set(X + dx, Y, Z, B.CARPET0 + dx);
      B.set(X + dx, Y + 1, Z, 0);
    }
    B.refreshAllTops();
    B.saveGame();
    for (let dx = 0; dx < 16; dx++) B.set(X + dx, Y, Z, 0);
    const wiped = B.get(X + 3, Y, Z);
    const ok = B.loadGame();
    const back = [];
    for (let dx = 0; dx < 16; dx++) back.push(B.get(X + dx, Y, Z));
    if (keepSave === null) localStorage.removeItem(slotKey);
    else localStorage.setItem(slotKey, keepSave);
    B.endPlay(); B.setPaused(false);
    return { ok, wiped, back, first: B.CARPET0 };
  });
  assert(r.ok, "저장을 못 읽었다");
  eq(r.wiped, 0, "시험대가 안 섰다 — 지우지 못했다");
  for (let i = 0; i < 16; i++)
    eq(r.back[i], r.first + i, i + "번 색 카펫이 안 돌아왔다");
});

test("v84 소품: 화분은 바닥에, 액자는 벽에 붙는다", async (page) => {
  const r = await page.evaluate(() => {
    const B = window.__blockyard;
    B.setPaused(true); B.beginPlay();
    const X = 34, Y = 34, Z = 34;
    for (let dx = -2; dx <= 6; dx++) for (let dz = -2; dz <= 6; dz++)
      for (let dy = -2; dy <= 6; dy++) B.set(X + dx, Y + dy, Z + dz, 0);
    for (let dx = -2; dx <= 6; dx++) for (let dz = -2; dz <= 6; dz++)
      B.set(X + dx, Y - 1, Z + dz, B.B.PLANKS);
    for (let dy = 0; dy <= 3; dy++) B.set(X, Y + dy, Z, B.B.BRICK);   // 벽 한 장
    B.refreshAllTops(); B.relightAll(false);

    // 화분 — 바닥에 놓이고, 낮은 상자라 넘어 다닐 수 있고, 빛을 안 막는다
    B.applyEdit(X + 3, Y, Z + 3, B.POT, false);
    const potThere = B.get(X + 3, Y, Z + 3);
    const potBox = B.boxesAt(B.POT, B.shapeAt(X + 3, Y, Z + 3), X + 3, Y, Z + 3);
    const potH = potBox && potBox.length === 1 ? potBox[0][4] : -1;
    const potFloor = B.needsFloor(B.POT);
    const potWall = B.needsWall(B.POT);
    const potLight = B.blocksLight(B.POT);
    // 바닥을 빼면 걷힌다
    B.applyEdit(X + 3, Y - 1, Z + 3, B.B.AIR, false);
    const potAfter = B.get(X + 3, Y, Z + 3);

    // 액자 — 벽에 붙는다. 벽 모양이 붙어야 얇은 판으로 그려진다.
    B.applyEdit(X + 1, Y + 1, Z, B.FRAME, false, B.wallShapeFor(1, 0));
    const frameThere = B.get(X + 1, Y + 1, Z);
    const frameSh = B.shapeAt(X + 1, Y + 1, Z);
    const frameBox = B.boxesAt(B.FRAME, frameSh, X + 1, Y + 1, Z);
    const frameThin = frameBox && frameBox.length === 1
      ? (frameBox[0][3] - frameBox[0][0]) : -1;
    const frameWall = B.needsWall(B.FRAME);
    const frameLight = B.blocksLight(B.FRAME);

    // 목록·이름·텍스처
    const inAll = B.ALL_BLOCKS.indexOf(B.POT) >= 0 && B.ALL_BLOCKS.indexOf(B.FRAME) >= 0;
    const tiles = [B.TILES[B.POT], B.TILES[B.FRAME]];
    const names = [B.NAMES[B.POT], B.NAMES[B.FRAME]];
    const cats = [B.categoryOf(B.POT), B.categoryOf(B.FRAME)];

    B.endPlay(); B.setPaused(false);
    return { potThere, potH, potFloor, potWall, potLight, potAfter,
             frameThere, frameSh, frameThin, frameWall, frameLight,
             inAll, tiles, names, cats, POT: B.POT, FRAME: B.FRAME, E: B.wallShapeFor(1, 0) };
  });
  eq(r.potThere, r.POT, "화분이 안 놓였다");
  assert(r.potH > 0.2 && r.potH < 0.7, "화분 높이가 " + r.potH + " — 낮은 상자여야 한다");
  eq(r.potFloor, true, "화분이 바닥 없이도 놓인다");
  eq(r.potWall, false, "화분이 벽에 붙는 것으로 돼 있다");
  eq(r.potLight, false, "화분이 빛을 막는다");
  eq(r.potAfter, 0, "받치던 바닥이 사라졌는데 화분이 허공에 남았다");
  eq(r.frameThere, r.FRAME, "액자가 안 놓였다");
  eq(r.frameSh, r.E, "액자에 벽 모양이 안 붙었다");
  assert(r.frameThin > 0 && r.frameThin < 0.2,
     "액자 두께가 " + r.frameThin + " — 벽에 붙는 얇은 판이어야 한다");
  eq(r.frameWall, true, "액자가 벽을 안 찾는다");
  eq(r.frameLight, false, "액자가 빛을 막는다");
  assert(r.inAll, "화분·액자가 블록 목록에 없다");
  assert(r.tiles.every(t => t && t.length === 3), "텍스처가 빠졌다: " + JSON.stringify(r.tiles));
  assert(r.names.every(n => n && n.length), "이름이 빠졌다: " + JSON.stringify(r.names));
  assert(r.cats.every(c => c === "build"), "갈래가 건축이 아니다: " + r.cats.join(","));
});

test("v84 소품: 액자는 벽이 없으면 안 놓이고, 벽이 사라지면 같이 걷힌다", async (page) => {
  const r = await page.evaluate(() => {
    const B = window.__blockyard;
    B.setPaused(true); B.beginPlay();
    const X = 24, Y = 44, Z = 24;
    for (let dx = -3; dx <= 5; dx++) for (let dz = -3; dz <= 5; dz++)
      for (let dy = -2; dy <= 6; dy++) B.set(X + dx, Y + dy, Z + dz, 0);
    for (let dx = -3; dx <= 5; dx++) for (let dz = -3; dz <= 5; dz++)
      B.set(X + dx, Y - 1, Z + dz, B.B.STONE);
    for (let dy = 0; dy <= 3; dy++) B.set(X, Y + dy, Z, B.B.BRICK);
    B.refreshAllTops(); B.relightAll(false);
    B.S.bar[B.S.selected] = B.FRAME;
    B.S.shapeMode = 0;

    // 벽이 아닌 바닥을 조준하고 놓으려 하면 막힌다.
    // 날아서 내려다본다 — 서서 발밑을 보면 그 자리를 내가 차지해 canPlaceAt 에서 먼저 걸린다.
    const toastEl = document.getElementById("toast");
    B.player.flying = true; B.player.vel.set(0, 0, 0);
    B.player.pos.set(X + 3.5, Y + 2, Z + 3.5);
    B.player.yaw = 0; B.player.pitch = -Math.PI / 2 + 0.01;
    B.camera.rotation.order = "YXZ";
    B.camera.rotation.y = 0; B.camera.rotation.x = B.player.pitch;
    B.camera.position.set(B.player.pos.x, B.player.pos.y + B.EYE, B.player.pos.z);
    B.camera.updateMatrixWorld(true);
    toastEl.textContent = "";
    B.place(false);
    const floorMsg = toastEl.textContent;
    const onFloor = B.get(X + 3, Y, Z + 3);

    // 벽에 붙인 액자는 벽을 캐면 같이 걷힌다
    B.applyEdit(X + 1, Y + 1, Z, B.FRAME, false, B.wallShapeFor(1, 0));
    const before = B.get(X + 1, Y + 1, Z);
    B.applyEdit(X, Y + 1, Z, B.B.AIR, false);
    const after = B.get(X + 1, Y + 1, Z);

    B.player.flying = false;
    B.endPlay(); B.setPaused(false);
    return { floorMsg, onFloor, before, after, FRAME: B.FRAME };
  });
  eq(r.onFloor, 0, "벽이 아닌 바닥에 액자가 놓였다");
  assert(/벽/.test(r.floorMsg), "액자를 바닥에 놓으려는데 안내가 없다: \"" + r.floorMsg + "\"");
  eq(r.before, r.FRAME, "시험대가 안 섰다 — 액자가 벽에 안 붙었다");
  eq(r.after, 0, "벽을 캤는데 액자가 허공에 남았다");
});

test("v85 지도: 나무 밑·집 안에서 지상 지도가 안 꺼지고, 지하 기억을 안 더럽힌다", async (page) => {
  const r = await page.evaluate(() => {
    const B = window.__blockyard;
    B.setPaused(true); B.beginPlay();
    B.S.terrain = 0;
    B.generate(333, 2); B.refreshAllTops(); B.relightAll(false);

    // (a) 나뭇잎이 겉면인 기둥에서 지하로 뒤집히나
    let leaf = 0, flipped = 0;
    for (let z = 2; z < B.WZ - 2; z++) for (let x = 2; x < B.WX - 2; x++) {
      const t = B.topMap[z * B.WX + x];
      if (t < 0) continue;
      const b = B.world[B.idx(x, t, z)];
      if (b !== B.B.LEAVES && b !== B.B.BIRCH_LEAVES && b !== B.B.SPRUCE_LEAVES) continue;
      leaf++;
      let ground = t;
      for (let y = t; y >= 1; y--) {
        const bb = B.world[B.idx(x, y, z)];
        if (bb !== 0 && !B.isCross(bb) && !B.isLeaf(bb)) { ground = y + 1; break; }
      }
      B.player.pos.set(x + 0.5, ground, z + 0.5);
      B.drawMinimap();
      if (B.S.mmUnder) flipped++;
    }

    // (b) 지상 한 줄을 걷는 동안 뒤집히나 · 깊은 층 지도가 칠해지나
    B.seenMap.fill(0);
    let flips = 0, prev = null;
    for (let x = 6; x < 90; x++) {
      const t = B.topMap[25 * B.WX + x];
      if (t < 0) continue;
      B.player.pos.set(x + 0.5, t + 1, 25.5);
      B.drawMinimap();
      if (prev !== null && B.S.mmUnder !== prev) flips++;
      prev = B.S.mmUnder;
    }
    let deepPainted = 0;
    for (let i = 0; i < B.WX * B.WZ; i++) if (B.seenMap[i] & 8) deepPainted++;

    // (c) 내가 지은 집 안 — 지붕이 두꺼워도 지하가 아니다
    const X = 12, Y = 34, Z = 12;
    for (let dx = -2; dx <= 6; dx++) for (let dz = -2; dz <= 6; dz++)
      for (let dy = -2; dy <= 12; dy++) B.set(X + dx, Y + dy, Z + dz, 0);
    for (let dx = 0; dx <= 4; dx++) for (let dz = 0; dz <= 4; dz++)
      B.set(X + dx, Y - 1, Z + dz, B.B.PLANKS);
    for (let dy = 0; dy <= 7; dy++)                       // 두꺼운 지붕을 사람이 얹는다
      for (let dx = 0; dx <= 4; dx++) for (let dz = 0; dz <= 4; dz++)
        B.applyEdit(X + dx, Y + 4 + dy, Z + dz, B.B.PLANKS, true);
    B.refreshAllTops();
    B.player.pos.set(X + 2.5, Y, Z + 2.5);
    B.drawMinimap();
    const inHouse = B.S.mmUnder;

    // (d) 진짜 지하에서는 여전히 단면으로 바뀐다
    const CX2 = 60, CY2 = 8, CZ2 = 60;
    for (let dx = -3; dx <= 3; dx++) for (let dz = -3; dz <= 3; dz++)
      for (let dy = 0; dy <= 16; dy++) B.set(CX2 + dx, CY2 + dy, CZ2 + dz, B.B.STONE);
    B.set(CX2, CY2, CZ2, 0); B.set(CX2, CY2 + 1, CZ2, 0);
    B.refreshAllTops();
    B.player.pos.set(CX2 + 0.5, CY2, CZ2 + 0.5);
    B.drawMinimap();
    const inCave = B.S.mmUnder;

    B.S.history.length = 0; B.S.future.length = 0;
    B.endPlay(); B.setPaused(false);
    return { leaf, flipped, flips, deepPainted, inHouse, inCave };
  });
  assert(r.leaf > 100, "시험대가 안 섰다 — 나뭇잎 기둥이 " + r.leaf + "개뿐이다");
  // 사방이 머리 위 8칸 넘게 둘러싸인 자리(깊은 웅덩이·협곡 바닥의 나무)는 단면도가 맞다.
  // v86 에서 "내가 판 굴" 을 살리며 그만큼을 받아들였다 — 1%대면 나무 밑 문제가 아니다.
  assert(r.flipped <= r.leaf * 0.03,
     "나무 밑에 섰을 뿐인데 " + r.flipped + "/" + r.leaf + " 기둥에서 지상 지도가 꺼졌다");
  eq(r.flips, 0, "지상 한 줄을 걷는 동안 지도가 " + r.flips + "번 뒤집혔다");
  eq(r.deepPainted, 0,
     "지상만 걸었는데 가장 깊은 층의 지도 " + r.deepPainted + "칸이 칠해졌다 — 되돌릴 길이 없다");
  assert(!r.inHouse, "내가 지은 집 안에 들어갔는데 지하로 읽혔다");
  assert(r.inCave, "진짜 굴 속인데 단면 지도로 안 바뀌었다");
});

test("v85 지도: 배율과 등고선이 껐다 켜도 남는다", async (page) => {
  const r = await page.evaluate(() => {
    const B = window.__blockyard;
    B.setPaused(true); B.beginPlay();
    const keep = localStorage.getItem(B.OPT_KEY);
    B.S.mmUnder = false;      // 배율은 지상·지하가 따로다 (v87) — 어느 쪽을 재는지 못 박는다
    const z0 = B.S.mmZoom, c0 = B.S.contour;

    B.cycleMinimapZoom(1);
    const z1 = B.S.mmZoom;
    const savedZoom = JSON.parse(localStorage.getItem(B.OPT_KEY)).mmzoom;
    // 흐트러뜨린 뒤 설정을 다시 적용하면 돌아와야 한다
    B.S.mmZoom = 1;
    B.applyOpts();
    const restored = B.S.mmZoom;

    B.opts.mmcontour = 0; B.applyOpts();
    const contourOff = B.S.contour;
    B.opts.mmcontour = 1; B.applyOpts();
    const contourOn = B.S.contour;

    if (keep === null) localStorage.removeItem(B.OPT_KEY);
    else localStorage.setItem(B.OPT_KEY, keep);
    B.opts.mmzoom = z0; B.opts.mmcontour = c0 ? 1 : 0; B.applyOpts();
    B.endPlay(); B.setPaused(false);
    return { z0, z1, savedZoom, restored, contourOff, contourOn };
  });
  assert(r.z1 !== r.z0, "배율이 안 바뀌었다");
  eq(r.savedZoom, r.z1, "배율이 설정에 안 실렸다");
  eq(r.restored, r.z1, "설정을 다시 적용했는데 배율이 " + r.restored + " 다");
  eq(r.contourOff, false, "등고선 설정이 안 먹는다");
  eq(r.contourOn, true, "등고선 설정이 안 먹는다");
});

test("v85 핫바: 칸에 딸린 모양이 칸에서 읽힌다", async (page) => {
  const r = await page.evaluate(() => {
    const B = window.__blockyard;
    B.setPaused(true); B.beginPlay();
    const bar = document.getElementById("hotbar");
    function glyphs() {
      return Array.prototype.map.call(bar.children,
        function (el) { const g = el.querySelector(".shape"); return g ? g.textContent : "?"; });
    }
    function colors() {
      return Array.prototype.map.call(bar.children,
        function (el) { const g = el.querySelector(".shape");
          return g ? getComputedStyle(g).color : "?"; });
    }
    for (let i = 0; i < 10; i++) { B.selectSlot(i); B.setShapeMode(0); }
    B.selectSlot(0); B.setShapeMode(2);      // 계단
    B.selectSlot(2); B.setShapeMode(1);      // 반블록
    B.selectSlot(5);
    const g = glyphs();
    const col = colors();
    const label0 = bar.children[0].getAttribute("aria-label");
    // 고른 칸에도 모양이 나와야 한다 — 손에 든 것이 뭔지가 핫바에 안 나왔다
    B.selectSlot(2);
    const gSel = glyphs()[2];
    // 칸을 옮겨 모양이 바뀌면 알려 준다
    const toastEl = document.getElementById("toast");
    toastEl.textContent = "";
    B.selectSlot(0);
    const movedMsg = toastEl.textContent;
    toastEl.textContent = "";
    B.selectSlot(1);                          // 0(계단) → 1(전체) — 바뀌었으니 알린다
    const msg2 = toastEl.textContent;
    toastEl.textContent = "";
    B.selectSlot(3);                          // 1(전체) → 3(전체) — 안 바뀌었으니 조용
    const quiet = toastEl.textContent;

    for (let i = 0; i < 10; i++) { B.selectSlot(i); B.setShapeMode(0); }
    B.selectSlot(0);
    B.endPlay(); B.setPaused(false);
    return { g, col, gSel, label0, movedMsg, msg2, quiet };
  });
  eq(r.g.length, 10, "핫바가 열 칸이 아니다");
  assert(r.g[0].length > 0, "계단 칸에 모양 표시가 없다: " + JSON.stringify(r.g));
  assert(r.g[2].length > 0, "반블록 칸에 모양 표시가 없다: " + JSON.stringify(r.g));
  eq(r.g[1], "", "전체 블록 칸에 군더더기 표시가 붙었다");
  assert(r.g[0] !== r.g[2], "계단과 반블록이 같은 글자다: " + r.g[0]);
  // 폰 9~11px 에서는 형태보다 색이 먼저 읽힌다 — 색도 갈라야 한다
  assert(r.col[0] !== r.col[2],
     "계단과 반블록이 같은 색이다: " + r.col[0] + " — 폰에서는 둘 다 작은 네모로 보인다");
  assert(r.gSel.length > 0, "고른 칸에는 모양 표시가 없다 — 손에 든 것이 뭔지 안 보인다");
  assert(/계단/.test(r.label0), "칸의 읽어 주는 이름에 모양이 없다: " + r.label0);
  assert(/계단/.test(r.movedMsg), "계단 칸으로 옮겼는데 안 알려 준다: \"" + r.movedMsg + "\"");
  assert(/전체/.test(r.msg2), "모양이 바뀌었는데 안 알려 준다: \"" + r.msg2 + "\"");
  eq(r.quiet, "", "모양이 그대로인데 알림이 떴다: \"" + r.quiet + "\"");
});

test("v85 갱도: 꺾이고 층이 어긋나며, 지도에 자국이 남는다", async (page) => {
  const r = await page.evaluate(() => {
    const B = window.__blockyard;
    B.setPaused(true); B.beginPlay();
    B.S.terrain = 0;
    const rows = [];
    for (const seed of [333, 1234, 42, 7]) {
      B.generate(seed, 2); B.refreshAllTops(); B.relightAll(false);
      const posts = [];
      let wet = 0;
      for (let y = 1; y < B.SEA; y++) for (let z = 1; z < B.WZ - 1; z++) for (let x = 1; x < B.WX - 1; x++) {
        if (B.world[B.idx(x, y, z)] !== B.B.FENCE) continue;
        posts.push([x, y, z]);
        for (const d of [[1,0,0],[-1,0,0],[0,1,0],[0,-1,0],[0,0,1],[0,0,-1]]) {
          const nb = B.world[B.idx(x + d[0], y + d[1], z + d[2])];
          if (nb === B.B.WATER || nb === B.B.LAVA) wet++;
        }
      }
      const levels = new Set(posts.map(p => p[1])).size;
      // 통로 길이와 끝방 소품 — v87 에서 갈래와 끝방을 손봤다.
      // 예전에는 줄기 다섯이 따로따로라 17~32초면 다 걸었고, 끝방은 세계당 0~2개였다.
      let corridor = 0, items = 0;
      for (let y = 1; y < B.SEA; y++) for (let z = 1; z < B.WZ - 1; z++) for (let x = 1; x < B.WX - 1; x++) {
        const b = B.world[B.idx(x, y, z)];
        if ((b === B.B.COBBLE || b === B.B.PLANKS) && y + 2 < B.WY &&
            B.world[B.idx(x, y + 1, z)] === 0 && B.world[B.idx(x, y + 2, z)] === 0) corridor++;
        if (b === B.B.BOOKSHELF || b === B.B.LAMP || B.isCarpet(b)) items++;
      }
      rows.push({ seed, posts: posts.length, levels, wet, corridor, items });
    }
    // 지도에 갱도 자국이 남나 — 자연 돌과 다른 색이어야 한다
    B.generate(333, 2); B.refreshAllTops(); B.relightAll(false);
    let post = null;
    for (let y = 1; y < B.SEA && !post; y++)
      for (let z = 1; z < B.WZ - 1 && !post; z++)
        for (let x = 1; x < B.WX - 1; x++)
          if (B.world[B.idx(x, y, z)] === B.B.FENCE) { post = [x, y, z]; break; }
    for (let i = 0; i < B.WX * B.WZ; i++) B.seenMap[i] = 15;
    B.player.flying = true;
    B.player.pos.set(post[0] + 0.5, post[1], post[2] + 0.5);
    B.S.mmZoom = 1; B.S.mmZoomUnder = 1;    // 픽셀을 세계 좌표로 읽으려면 배율 1 이어야 한다
    B.drawMinimap();
    const under = B.S.mmUnder;
    const cv = document.getElementById("mm");
    const g = cv.getContext("2d");
    const px = g.getImageData(post[0], post[2], 1, 1).data;
    // 자연 돌 바닥 한 칸과 견준다
    // 갱도가 길어져(v87) 가까이에는 자연 돌 바닥이 없을 수 있다 — 지도 안에서 넓게 찾는다
    let stone = null;
    for (let rr = 8; rr <= 40 && !stone; rr += 8)
      for (let dz = -rr; dz <= rr && !stone; dz++) for (let dx = -rr; dx <= rr; dx++) {
        const x = post[0] + dx, z = post[2] + dz;
        if (x < 1 || z < 1 || x >= B.WX - 1 || z >= B.WZ - 1) continue;
        if (B.world[B.idx(x, post[1] - 1, z)] === B.B.STONE &&
            B.world[B.idx(x, post[1], z)] === 0) { stone = [x, z]; break; }
      }
    const sp = stone ? g.getImageData(stone[0], stone[1], 1, 1).data : null;
    B.player.flying = false;
    B.endPlay(); B.setPaused(false);
    return { rows, under, px: [px[0], px[1], px[2]],
             sp: sp ? [sp[0], sp[1], sp[2]] : null };
  });
  for (const row of r.rows) {
    assert(row.posts >= 40, "시드 " + row.seed + ": 갱도 기둥이 " + row.posts + "개뿐이다");
    // 곧은 복도 다섯 개였을 때는 줄기마다 높이가 하나뿐이라 5를 못 넘었다
    assert(row.levels >= 5,
       "시드 " + row.seed + ": 갱도가 " + row.levels + "개 높이에만 있다 — 층이 안 어긋난다");
    eq(row.wet, 0, "시드 " + row.seed + ": 갱도가 물·용암과 " + row.wet + "칸 맞닿았다");
    assert(row.corridor >= 320,
       "시드 " + row.seed + ": 걸을 수 있는 갱도 바닥이 " + row.corridor + "칸뿐 — 금세 벽이다");
    assert(row.items >= 3,
       "시드 " + row.seed + ": 끝방에 놓인 것이 " + row.items + "개뿐 — 끝까지 걸어갈 이유가 없다");
  }
  assert(r.under, "갱도 안인데 단면 지도로 안 바뀌었다");
  assert(r.sp, "견줄 자연 돌 바닥을 못 찾았다");
  const diff = Math.abs(r.px[0] - r.sp[0]) + Math.abs(r.px[1] - r.sp[1]) + Math.abs(r.px[2] - r.sp[2]);
  assert(diff > 60,
     "갱도가 자연 동굴과 같은 색이다 — 갱도 rgb(" + r.px.join(",") + ") vs 돌 rgb(" + r.sp.join(",") + ")");
});

phoneTest("도움말이 지도 조작을 알려 준다", async (page) => {
  const r = await page.evaluate(() => {
    const B = window.__blockyard;
    B.beginPlay();
    B.toggleHelp(true);
    const help = document.getElementById("help");
    function visibleText(root) {
      let out = "";
      const w = document.createTreeWalker(root, NodeFilter.SHOW_TEXT);
      let n;
      while ((n = w.nextNode())) {
        const el = n.parentElement;
        if (el && el.getClientRects().length) out += n.nodeValue + " ";
      }
      return out;
    }
    let body = "";
    help.querySelectorAll(".help-cols").forEach(c => { body += visibleText(c); });
    B.toggleHelp(false);
    B.endPlay();
    return { body };
  });
  assert(/탭하면\s*표식|탭하면.{0,4}표식/.test(r.body),
     "폰 도움말이 '지도를 탭하면 표식' 을 안 알려 준다");
  assert(/길게 누르면 확대/.test(r.body), "폰 도움말이 지도 확대를 안 알려 준다");
  assert(/주황/.test(r.body), "폰 도움말이 지도 기호(주황=굴 어귀)를 안 알려 준다");
  // v83 이 넣은 것을 "안 된다" 고 말하면 안 된다
  assert(!/미니맵 표식은 지금.{0,10}키보드에서만/.test(r.body),
     "폰 도움말이 표식을 키보드 전용이라고 말한다 — v83 이 넣었는데");
});

test("v86 양동이: 물·용암을 걷어내고, 되돌리기에 실린다", async (page) => {
  const r = await page.evaluate(() => {
    const B = window.__blockyard;
    B.setPaused(true); B.beginPlay();
    const X = 52, Y = 34, Z = 52;
    B.resetQueues();
    B.S.fluidOwner = null;
    for (let dx = -3; dx <= 9; dx++) for (let dz = -3; dz <= 9; dz++)
      for (let dy = -2; dy <= 8; dy++) B.set(X + dx, Y + dy, Z + dz, 0);
    for (let dx = -3; dx <= 9; dx++) for (let dz = -3; dz <= 9; dz++)
      B.set(X + dx, Y - 1, Z + dz, B.B.STONE);
    B.refreshAllTops(); B.relightAll(false);
    B.S.history.length = 0; B.S.future.length = 0;

    // 물 한 통을 붓고 퍼지게 둔다
    B.applyEdit(X, Y, Z, B.B.WATER, true);
    for (let k = 0; k < 400; k++) { B.waterTick(400); B.dryTick(400); }
    function water() {
      let n = 0;
      for (let dx = -3; dx <= 9; dx++) for (let dz = -3; dz <= 9; dz++)
        for (let dy = -1; dy <= 4; dy++)
          if (B.get(X + dx, Y + dy, Z + dz) === B.B.WATER) n++;
      return n;
    }
    const spread = water();

    // ── 조준선은 여전히 액체를 건너뛴다 (물속에서 바닥을 캘 수 있어야 한다)
    B.player.flying = true; B.player.vel.set(0, 0, 0);
    B.player.pos.set(X + 0.5, Y + 3, Z + 0.5);
    B.player.yaw = 0; B.player.pitch = -Math.PI / 2 + 0.01;
    B.camera.rotation.order = "YXZ";
    B.camera.rotation.y = 0; B.camera.rotation.x = B.player.pitch;
    B.camera.position.set(B.player.pos.x, B.player.pos.y + B.EYE, B.player.pos.z);
    B.camera.updateMatrixWorld(true);
    const plain = B.raycast(6);
    const liquid = B.raycast(6, true);

    // ── 양동이로 근원을 푼다
    B.S.bar[B.S.selected] = B.BUCKET;
    const histBefore = B.S.history.length;
    B.place(false);
    for (let k = 0; k < 400; k++) { B.waterTick(400); B.dryTick(400); }
    const afterScoop = water();
    const histAfter = B.S.history.length;

    // ── 되돌리면 물이 돌아온다
    B.undo();
    for (let k = 0; k < 400; k++) { B.waterTick(400); B.dryTick(400); }
    const afterUndo = water();

    // ── 용암도 된다
    B.resetQueues(); B.S.fluidOwner = null;
    B.S.history.length = 0; B.S.future.length = 0;
    for (let dx = -3; dx <= 9; dx++) for (let dz = -3; dz <= 9; dz++)
      for (let dy = 0; dy <= 4; dy++) B.set(X + dx, Y + dy, Z + dz, 0);
    B.applyEdit(X, Y, Z, B.B.LAVA, true);
    for (let k = 0; k < 600; k++) { B.lavaFlowTick(200); B.lavaDryTick(200); }
    let lava0 = 0;
    for (let dx = -3; dx <= 9; dx++) for (let dz = -3; dz <= 9; dz++)
      for (let dy = 0; dy <= 4; dy++) if (B.get(X + dx, Y + dy, Z + dz) === B.B.LAVA) lava0++;
    B.place(false);
    for (let k = 0; k < 600; k++) { B.lavaFlowTick(200); B.lavaDryTick(200); }
    let lava1 = 0;
    for (let dx = -3; dx <= 9; dx++) for (let dz = -3; dz <= 9; dz++)
      for (let dy = 0; dy <= 4; dy++) if (B.get(X + dx, Y + dy, Z + dz) === B.B.LAVA) lava1++;

    // ── 놓는 물건이 아니다 (세계에 양동이가 놓이면 안 된다)
    const placed = B.applyEdit(X + 5, Y, Z + 5, B.BUCKET, false);
    const isItem = B.isItem(B.BUCKET);
    const inAll = B.ALL_BLOCKS.indexOf(B.BUCKET) >= 0;

    B.player.flying = false;
    B.resetQueues(); B.S.fluidOwner = null;
    B.S.history.length = 0; B.S.future.length = 0;
    B.endPlay(); B.setPaused(false);
    return { spread, plain: plain ? plain.block : -1, liquid: liquid ? liquid.block : -1,
             afterScoop, histBefore, histAfter, afterUndo, lava0, lava1,
             placed, isItem, inAll, WATER: B.B.WATER, STONE: B.B.STONE };
  });
  assert(r.spread > 5, "시험대가 안 섰다 — 물이 " + r.spread + "칸만 퍼졌다");
  // 평소 조준선은 물을 건너뛴다 — 물속에서 바닥을 캐야 하므로 그대로여야 한다
  eq(r.plain, r.STONE, "평소 조준선이 물에 걸렸다 — 물속에서 바닥을 못 캔다");
  eq(r.liquid, r.WATER, "양동이 조준이 물을 못 맞혔다");
  assert(r.afterScoop < r.spread * 0.5,
     "양동이로 근원을 펐는데 물이 " + r.spread + "→" + r.afterScoop + "칸이다");
  eq(r.histAfter, r.histBefore + 1, "양동이질이 되돌리기에 안 실렸다");
  eq(r.afterUndo, r.spread, "되돌렸는데 물이 " + r.afterUndo + "칸 — 원래 " + r.spread + "칸이다");
  assert(r.lava0 > 3, "시험대가 안 섰다 — 용암이 " + r.lava0 + "칸이다");
  assert(r.lava1 < r.lava0, "양동이로 용암을 못 펐다: " + r.lava0 + " → " + r.lava1);
  eq(r.placed, false, "양동이가 세계에 놓였다 — 도구는 놓는 물건이 아니다");
  eq(r.isItem, true, "양동이가 도구로 등록되지 않았다");
  eq(r.inAll, false, "양동이가 ALL_BLOCKS 에 들어가 '수집가' 과제를 영영 막는다");
});

test("v86 어귀: 굴 입구를 걸어서 드나들 수 있다", async (page) => {
  const r = await page.evaluate(() => {
    const B = window.__blockyard;
    B.setPaused(true);
    B.S.terrain = 0;
    const rows = [];
    for (const seed of [333, 777, 4242]) {
      // 어귀만 떼어 본다 — 달라진 기둥이 v82·v86 이 뚫은 자리다
      B.S.noMouths = true;
      B.generate(seed, 2); B.refreshAllTops();
      const offTop = Int16Array.from(B.topMap);
      B.S.noMouths = false;
      // 조명을 새로 켠다 — 아래에서 lightSky 로 "하늘이 보이나" 를 재는데,
      // 안 켜면 **앞 세계의 낡은 값**을 읽는다 (v81 에서 이미 한 번 데인 자리)
      B.generate(seed, 2); B.refreshAllTops(); B.relightAll(false);
      const cols = [];
      for (let z = 1; z < B.WZ - 1; z++) for (let x = 1; x < B.WX - 1; x++)
        if (B.topMap[z * B.WX + x] !== offTop[z * B.WX + x]) cols.push([x, z]);

      // 어귀 바닥에서 **걸어서** 하늘까지 나올 수 있나 —
      // 한 걸음에 오를 수 있는 높이는 STEP_UP(0.6)이라 1칸이다.
      function floorAt(x, y, z) {          // 그 자리에 설 수 있나 (발밑 고체 + 머리 두 칸 공기)
        if (x < 1 || z < 1 || x >= B.WX - 1 || z >= B.WZ - 1 || y < 1 || y + 1 >= B.WY) return false;
        return B.isSolid(B.world[B.idx(x, y - 1, z)]) &&
               B.world[B.idx(x, y, z)] === 0 && B.world[B.idx(x, y + 1, z)] === 0;
      }
      let tried = 0, walkable = 0;
      for (let ci = 0; ci < cols.length && tried < 24; ci += Math.max(1, (cols.length / 24) | 0)) {
        const [sx, sz] = cols[ci];
        // 그 기둥에서 설 수 있는 가장 낮은 자리
        let start = -1;
        for (let y = 2; y < B.WY - 2; y++) if (floorAt(sx, y, sz)) { start = y; break; }
        if (start < 0) continue;
        tried++;
        // 오르막 너비우선 — 한 걸음에 +1칸까지
        const seen = new Set([sx + "," + start + "," + sz]);
        const qx = [sx], qy = [start], qz = [sz];
        let out = false;
        for (let h = 0; h < qx.length && !out && h < 4000; h++) {
          const cx = qx[h], cy = qy[h], cz = qz[h];
          if (B.lightSky[B.idx(cx, cy, cz)] === 15) { out = true; break; }   // 하늘이 보인다
          for (const d of [[1,0],[-1,0],[0,1],[0,-1]]) {
            for (const dy of [1, 0, -1]) {
              const nx = cx + d[0], ny = cy + dy, nz = cz + d[1];
              const k = nx + "," + ny + "," + nz;
              if (seen.has(k) || !floorAt(nx, ny, nz)) continue;
              seen.add(k); qx.push(nx); qy.push(ny); qz.push(nz);
            }
          }
        }
        if (out) walkable++;
      }
      rows.push({ seed, cols: cols.length, tried, walkable,
                  pct: tried ? Math.round(100 * walkable / tried) : 0 });
    }
    B.S.noMouths = false;
    B.setPaused(false);
    return rows;
  });
  for (const row of r) {
    assert(row.cols > 40, "시드 " + row.seed + ": 어귀 기둥이 " + row.cols + "개뿐이다");
    assert(row.tried >= 8, "시드 " + row.seed + ": 설 수 있는 어귀가 " + row.tried + "곳뿐이다");
    // 예전에는 1칸 수직 우물이라 62~81%가 5칸 이상 낙하였고 사다리 없이는 못 나왔다
    assert(row.pct >= 70,
       "시드 " + row.seed + ": 어귀의 " + row.pct + "% 만 걸어서 나올 수 있다 — 들어가면 갇힌다");
  }
});

phoneTest("지도·핫바·단추 위에서 쓸어도 시점이 돈다", async (page) => {
  const r = await page.evaluate(() => {
    const B = window.__blockyard;
    B.setPaused(true); B.beginPlay();
    B.S.marks = [];
    function box(id) { const e = document.getElementById(id); return e.getBoundingClientRect(); }
    function swipe(target, x, y, dx) {
      B.player.yaw = 0; B.player.pitch = 0;
      B.S.lookId = null; B.S.stickId = null;
      const t0 = new Touch({ identifier: 7, target: target, clientX: x, clientY: y });
      target.dispatchEvent(new TouchEvent("touchstart", {
        bubbles: true, cancelable: true, touches: [t0], changedTouches: [t0], targetTouches: [t0] }));
      let last = 0;
      for (let k = 1; k <= 4; k++) {
        const tk = new Touch({ identifier: 7, target: target,
          clientX: x + (dx * k) / 4, clientY: y });
        // 진짜 손가락처럼 **그 요소에서** 쏜다 — window 에 직접 쏘면 요소의 제 핸들러가 안 돈다
        target.dispatchEvent(new TouchEvent("touchmove", {
          bubbles: true, cancelable: true, touches: [tk], changedTouches: [tk], targetTouches: [tk] }));
        last = tk.clientX;
      }
      const te = new Touch({ identifier: 7, target: target, clientX: last, clientY: y });
      target.dispatchEvent(new TouchEvent("touchend", {
        bubbles: true, cancelable: true, touches: [], changedTouches: [te], targetTouches: [] }));
      return B.player.yaw;
    }
    const mm = document.getElementById("minimap");
    const mb = box("minimap");
    const onMap = swipe(mm, mb.left + mb.width / 2, mb.top + mb.height / 2, 90);
    const marksAfterMap = B.S.marks.length;

    // 핫바와 터치 단추는 **제 몫의 끌기 제스처**가 있다 —
    // 핫바는 좌우로 쓸면 칸이 바뀌고, 단추는 누른 채 반복이다.
    // 그 위에서 손가락이 흔들렸다고 시점까지 돌면 둘 다 어그러진다.
    const hb = box("hotbar");
    const hotEl = document.getElementById("hotbar");
    const selBefore = B.S.selected;
    const onHotbar = swipe(hotEl, Math.max(hb.left + 8, window.innerWidth * 0.6),
                           hb.top + hb.height / 2, 90);
    const selAfter = B.S.selected;
    const btn = document.getElementById("tb-jump");
    const bb = btn.getBoundingClientRect();
    const onButton = swipe(btn, bb.left + bb.width / 2, bb.top + bb.height / 2, 40);
    B.S.keys.Space = false;

    const cv = document.getElementById("stage").querySelector("canvas") ||
               document.querySelector("canvas");
    const onCanvas = swipe(cv, window.innerWidth * 0.75, window.innerHeight * 0.5, 90);

    // 왼쪽(스틱 자리)에서는 시점이 안 돌아야 한다
    const onLeft = swipe(cv, window.innerWidth * 0.2, window.innerHeight * 0.5, 90);

    B.S.marks = []; B.S.lookId = null;
    B.endPlay(); B.setPaused(false);
    return { onMap, onHotbar, onCanvas, onLeft, marksAfterMap,
             onButton, selBefore, selAfter };
  });
  assert(Math.abs(r.onCanvas) > 0.05, "시험대가 안 섰다 — 캔버스에서도 시점이 안 돈다: " + r.onCanvas);
  assert(Math.abs(r.onMap) > 0.05,
     "지도 위에서 쓸었는데 시점이 " + r.onMap.toFixed(4) + " 다 — 위를 볼 때 손이 먼저 닿는 자리다");
  eq(r.marksAfterMap, 0, "지도 위에서 쓸었는데 표식이 찍혔다");
  eq(r.onHotbar, 0,
     "핫바를 쓸었는데 시점까지 돌았다 (" + r.onHotbar.toFixed(4) + ") — 칸 바꾸기와 겹친다");
  assert(r.selAfter !== r.selBefore,
     "핫바를 쓸었는데 칸이 안 바뀌었다: " + r.selBefore + " → " + r.selAfter);
  eq(r.onButton, 0,
     "터치 단추를 누른 채 손이 흔들렸는데 시점이 돌았다 (" + r.onButton.toFixed(4) + ")");
  eq(r.onLeft, 0, "왼쪽(스틱 자리)에서 쓸었는데 시점이 돌았다: " + r.onLeft);
});

test("v89 양동이: 문은 열리고, 누른 채 푼 것은 한 번에 되돌아간다", async (page) => {
  const r = await page.evaluate(() => {
    const B = window.__blockyard;
    B.setPaused(true); B.beginPlay();
    const X = 26, Y = 30, Z = 26;
    B.resetQueues(); B.S.fluidOwner = null;
    for (let dx = -4; dx <= 8; dx++) for (let dz = -4; dz <= 8; dz++)
      for (let dy = -2; dy <= 6; dy++) B.set(X + dx, Y + dy, Z + dz, 0);
    for (let dx = -4; dx <= 8; dx++) for (let dz = -4; dz <= 8; dz++)
      B.set(X + dx, Y - 1, Z + dz, B.B.STONE);
    B.refreshAllTops(); B.relightAll(false);
    B.S.history.length = 0; B.S.future.length = 0;
    B.S.sneaking = false;

    // ── 여닫는 것을 열 수 있나 (양동이를 든 채) — 울타리문이 문보다 시험대가 단순하다
    // 눈높이에 놓는다 — 울타리문 상자는 칸의 0.25~1 이라 눈(발밑+1.62)보다 낮으면 못 맞힌다
    B.set(X, Y, Z, B.B.STONE);
    B.applyEdit(X, Y + 1, Z, B.B.GATE, false);
    const doorThere = B.get(X, Y + 1, Z) === B.B.GATE;
    B.player.flying = true; B.player.vel.set(0, 0, 0);
    B.player.pos.set(X + 0.5, Y, Z + 3.5);
    B.player.yaw = 0; B.player.pitch = 0;
    B.camera.rotation.order = "YXZ";
    B.camera.rotation.y = 0; B.camera.rotation.x = 0;
    B.camera.position.set(B.player.pos.x, B.player.pos.y + B.EYE, B.player.pos.z);
    B.camera.updateMatrixWorld(true);
    const aimed = B.raycast(6);
    const openBefore = B.shapeAt(X, Y + 1, Z);
    B.S.bar[B.S.selected] = B.BUCKET;
    B.place(false);
    const openAfterBucket = B.shapeAt(X, Y + 1, Z);
    B.applyEdit(X, Y + 1, Z, B.B.AIR, false);
    B.set(X, Y, Z, 0);

    // ── 누른 채 푼 물이 한 묶음인가
    B.resetQueues(); B.S.fluidOwner = null;
    B.S.history.length = 0; B.S.future.length = 0;
    for (let i = 0; i < 3; i++) B.set(X + i, Y, Z, B.B.WATER);
    B.refreshAllTops();
    function water() {
      let n = 0;
      for (let dx = -4; dx <= 8; dx++) for (let dz = -4; dz <= 8; dz++)
        for (let dy = 0; dy <= 3; dy++)
          if (B.get(X + dx, Y + dy, Z + dz) === B.B.WATER) n++;
      return n;
    }
    const w0 = water();
    B.player.pos.set(X + 0.5, Y + 3, Z + 0.5);
    B.player.pitch = -Math.PI / 2 + 0.01;
    B.camera.rotation.x = B.player.pitch;
    B.camera.position.set(B.player.pos.x, B.player.pos.y + B.EYE, B.player.pos.z);
    B.camera.updateMatrixWorld(true);
    B.place(false);                       // 첫 번
    B.place(true);                        // 누른 채 반복
    B.place(true);
    const w1 = water();
    const hist = B.S.history.length;
    B.undo();
    const w2 = water();

    // ── 물속에서도 앞을 푼다 (눈이 잠긴 칸만 파지 않는다)
    B.resetQueues(); B.S.fluidOwner = null;
    for (let dx = 0; dx <= 4; dx++) for (let dy = 0; dy <= 2; dy++)
      B.set(X + dx, Y + dy, Z + 4, B.B.WATER);
    B.refreshAllTops();
    B.player.pos.set(X + 0.5, Y, Z + 4.5);   // 물속
    B.player.yaw = -Math.PI / 2; B.player.pitch = 0;
    B.camera.rotation.y = B.player.yaw; B.camera.rotation.x = 0;
    B.camera.position.set(B.player.pos.x, B.player.pos.y + B.EYE, B.player.pos.z);
    B.camera.updateMatrixWorld(true);
    const eyeCell = [Math.floor(B.player.pos.x), Math.floor(B.player.pos.y + B.EYE),
                     Math.floor(B.player.pos.z)];
    const liquidHit = B.raycast(6, true);
    const hitIsEye = liquidHit && liquidHit.x === eyeCell[0] &&
                     liquidHit.y === eyeCell[1] && liquidHit.z === eyeCell[2];

    B.player.flying = false;
    B.resetQueues(); B.S.fluidOwner = null;
    B.S.history.length = 0; B.S.future.length = 0;
    B.endPlay(); B.setPaused(false);
    return { doorThere, aimed: !!aimed, openBefore, openAfterBucket,
             w0, w1, w2, hist, hitIsEye, liquid: liquidHit ? liquidHit.block : -1,
             WATER: B.B.WATER };
  });
  assert(r.doorThere, "시험대가 안 섰다 — 울타리문이 안 놓였다");
  assert(r.aimed, "시험대가 안 섰다 — 울타리문을 조준하지 못했다");
  assert(r.openAfterBucket !== r.openBefore,
     "양동이를 들었더니 울타리문이 안 열린다 — 물을 퍼서 돌아오면 제 집에 못 들어간다");
  assert(r.w1 < r.w0, "양동이로 물을 못 펐다: " + r.w0 + " → " + r.w1);
  eq(r.hist, 1,
     "누른 채 " + (r.w0 - r.w1) + "칸을 펐는데 되돌리기가 " + r.hist + "개다 — 한 묶음이어야 한다");
  eq(r.w2, r.w0, "한 번 되돌렸는데 물이 " + r.w2 + "칸 — 원래 " + r.w0 + "칸이어야 한다");
  eq(r.hitIsEye, false, "물속에서 양동이가 제 눈이 잠긴 칸만 푼다 — 웅덩이를 안에서 못 뺀다");
  eq(r.liquid, r.WATER, "물속에서 앞의 물을 못 맞혔다");
});

test("v89 과제: 꼭대기는 스폰에서 안 열리고, 지도장이는 뭍만 센다", async (page) => {
  const r = await page.evaluate(() => {
    const B = window.__blockyard;
    B.setPaused(true); B.beginPlay();
    B.S.terrain = 0;
    const rows = [];
    for (const seed of [333, 777, 99, 4242]) {
      B.generate(seed, 2); B.refreshAllTops(); B.relightAll(false);
      B.spawn();
      B.S.earned = {}; B.S.walked = 0;
      for (let k = 0; k < 200; k++) B.step(1 / 60);
      rows.push({ seed, y: +B.player.pos.y.toFixed(1), high: !!B.S.earned.high });
    }
    // 지도장이 — 뭍을 다 밟으면 100% 여야 한다
    B.generate(333, 2); B.refreshAllTops();
    B.seenMap.fill(0);
    let land = 0;
    for (let z = 0; z < B.WZ; z++) for (let x = 0; x < B.WX; x++)
      if (B.topMap[z * B.WX + x] > B.SEA) { land++; B.seenMap[z * B.WX + x] |= B.SEEN_TOP; }
    const allLand = B.seenRatio();
    // 절반만 밟으면 절반쯤이어야 한다
    B.seenMap.fill(0);
    let half = 0;
    for (let z = 0; z < B.WZ; z++) for (let x = 0; x < B.WX; x++)
      if (B.topMap[z * B.WX + x] > B.SEA && (half++ % 2 === 0))
        B.seenMap[z * B.WX + x] |= B.SEEN_TOP;
    const halfLand = B.seenRatio();

    B.S.earned = {};
    B.endPlay(); B.setPaused(false);
    return { rows, land, allLand, halfLand };
  });
  for (const row of r.rows)
    assert(!row.high,
       "시드 " + row.seed + ": 스폰(y=" + row.y + ")에 서 있기만 했는데 '꼭대기' 가 열렸다");
  assert(r.land > 1500, "시험대가 안 섰다 — 뭍 기둥이 " + r.land + "개뿐이다");
  assert(r.allLand > 0.99,
     "뭍을 다 밟았는데 지도장이 진척이 " + (r.allLand * 100).toFixed(0) + "% 다 — 걸어서는 못 딴다");
  assert(r.halfLand > 0.4 && r.halfLand < 0.6,
     "뭍의 절반을 밟았는데 " + (r.halfLand * 100).toFixed(0) + "% 다");
});

phoneTest("스틱을 끝까지 밀면 달린다", async (page) => {
  const r = await page.evaluate(() => {
    const B = window.__blockyard;
    B.setPaused(true); B.beginPlay();
    B.S.flySpeed = 1;
    B.S.keys.KeyW = false; B.S.keys.ControlLeft = false; B.S.sprintTap = false;
    // 폰 시험에는 arena 헬퍼가 안 실린다 — 평평한 시험장을 손으로 깐다
    for (let dx = -12; dx <= 12; dx++) for (let dz = -12; dz <= 12; dz++) {
      for (let dy = 0; dy <= 6; dy++) B.set(48 + dx, 34 + dy, 48 + dz, 0);
      B.set(48 + dx, 33, 48 + dz, B.B.STONE);
    }
    B.refreshAllTops(); B.relightAll(false);
    function run(mag) {
      B.player.pos.set(48, 34, 48); B.player.vel.set(0, 0, 0);
      B.player.flying = false; B.player.yaw = 0; B.player.pitch = 0;
      // 스틱 값을 직접 넣는다 — 픽셀 반지름(STICK_R)에 기대지 않는다
      B.S.stick.x = 0; B.S.stick.z = mag;
      for (let k = 0; k < 60; k++) { B.S.stick.x = 0; B.S.stick.z = mag; B.step(1 / 60); }
      const v = Math.hypot(B.player.vel.x, B.player.vel.z);
      const sp = B.S.sprintingNow;
      B.S.stick.x = 0; B.S.stick.z = 0;
      for (let k = 0; k < 30; k++) B.step(1 / 60);
      return { v, sp };
    }
    const half = run(0.5);
    const full = run(1);
    B.endPlay(); B.setPaused(false);
    return { half, full, WALK: B.WALK, SPRINT: B.SPRINT };
  });
  assert(r.half.v > 0.5, "시험대가 안 섰다 — 스틱을 반만 밀었을 때 안 움직인다: " + r.half.v);
  eq(r.half.sp, false, "스틱을 반만 밀었는데 달린다");
  eq(r.full.sp, true, "스틱을 끝까지 밀었는데 안 달린다 — 폰에는 Ctrl 도 W 더블탭도 없다");
  assert(r.full.v > r.half.v * 1.15,
     "달린다는데 속도가 " + r.half.v.toFixed(2) + " → " + r.full.v.toFixed(2) + " 다");
});

test("v90 양동이: 담고 붓는다 — 아이콘·이름·핫바 쪽까지 따라간다", async (page) => {
  const r = await page.evaluate(() => {
    const B = window.__blockyard;
    B.setPaused(true); B.beginPlay();
    const X = 70, Y = 30, Z = 70;
    B.resetQueues(); B.S.fluidOwner = null;
    for (let dx = -4; dx <= 8; dx++) for (let dz = -4; dz <= 8; dz++)
      for (let dy = -2; dy <= 6; dy++) B.set(X + dx, Y + dy, Z + dz, 0);
    for (let dx = -4; dx <= 8; dx++) for (let dz = -4; dz <= 8; dz++)
      B.set(X + dx, Y - 1, Z + dz, B.B.STONE);
    B.set(X, Y, Z, B.B.WATER);
    B.refreshAllTops(); B.relightAll(false);
    B.S.history.length = 0; B.S.future.length = 0;
    B.S.sneaking = false;
    for (let i = 0; i < 10; i++) B.S.fillBar[i] = 0;
    B.S.bar[B.S.selected] = B.BUCKET;
    B.refreshBar();          // S.bar 를 직접 바꾸면 칸은 안 다시 그려진다

    function aimDown(x, y, z) {
      B.player.flying = true; B.player.vel.set(0, 0, 0);
      B.player.pos.set(x + 0.5, y + 3, z + 0.5);
      B.player.yaw = 0; B.player.pitch = -Math.PI / 2 + 0.01;
      B.camera.rotation.order = "YXZ";
      B.camera.rotation.y = 0; B.camera.rotation.x = B.player.pitch;
      B.camera.position.set(B.player.pos.x, B.player.pos.y + B.EYE, B.player.pos.z);
      B.camera.updateMatrixWorld(true);
    }
    const bar = document.getElementById("hotbar");
    const slot = bar.children[B.S.selected];
    const nameEmpty = slot.querySelector(".name").textContent;

    // ── 담는다
    aimDown(X, Y, Z);
    B.place(false);
    const water0 = B.get(X, Y, Z);
    const filled = B.S.fillBar[B.S.selected];
    const nameFull = slot.querySelector(".name").textContent;
    const ariaFull = slot.getAttribute("aria-label");

    // ── 붓는다 — 다른 자리에
    aimDown(X + 3, Y, Z + 3);
    B.place(false);
    const poured = B.get(X + 3, Y, Z + 3);
    const emptied = B.S.fillBar[B.S.selected];
    const nameAfter = slot.querySelector(".name").textContent;

    // ── 빈 양동이로 다시 누르면 담기로 돌아간다 (물이 없으면 안내)
    const toastEl = document.getElementById("toast");
    toastEl.textContent = "";
    aimDown(X + 6, Y, Z + 6);
    B.place(false);
    const emptyMsg = toastEl.textContent;

    // ── 핫바 2쪽으로 넘어가면 담긴 것도 따라간다
    B.S.fillBar[B.S.selected] = B.B.LAVA;
    B.refreshBar();
    const lavaName = slot.querySelector(".name").textContent;
    const page0 = B.S.barPage;
    B.swapBarPage();
    const onPage2 = B.S.fillBar[B.S.selected];
    B.swapBarPage();
    const backPage1 = B.S.fillBar[B.S.selected];

    // ── 새 세계면 비운다
    B.S.fillBar[B.S.selected] = B.B.WATER;
    const beforeNew = B.S.fillBar[B.S.selected];

    for (let i = 0; i < 10; i++) { B.S.fillBar[i] = 0; B.S.fillBarAlt[i] = 0; }
    B.refreshBar();
    B.player.flying = false;
    B.resetQueues(); B.S.fluidOwner = null;
    B.S.history.length = 0; B.S.future.length = 0;
    B.endPlay(); B.setPaused(false);
    return { nameEmpty, water0, filled, nameFull, ariaFull, poured, emptied, nameAfter,
             emptyMsg, lavaName, onPage2, backPage1, beforeNew,
             WATER: B.B.WATER, LAVA: B.B.LAVA };
  });
  eq(r.water0, 0, "양동이를 썼는데 물이 그대로다");
  eq(r.filled, r.WATER, "물을 펐는데 양동이가 안 찼다");
  assert(/물/.test(r.nameFull) && r.nameFull !== r.nameEmpty,
     "담은 뒤 칸 이름이 '" + r.nameFull + "' — 빈 것(" + r.nameEmpty + ")과 같다");
  assert(/물/.test(r.ariaFull), "읽어 주는 이름에 담긴 것이 안 나온다: " + r.ariaFull);
  eq(r.poured, r.WATER, "담긴 양동이로 눌렀는데 물이 안 부어졌다");
  eq(r.emptied, 0, "부었는데 양동이가 안 비었다");
  eq(r.nameAfter, r.nameEmpty, "부은 뒤 칸 이름이 안 돌아왔다: " + r.nameAfter);
  assert(/조준|없/.test(r.emptyMsg) || r.emptyMsg.length > 0,
     "빈 양동이로 허공을 눌렀는데 아무 말이 없다");
  assert(/용암/.test(r.lavaName), "용암 양동이 이름이 '" + r.lavaName + "' 다");
  eq(r.onPage2, 0, "2쪽으로 넘어갔는데 1쪽의 담긴 것이 따라왔다");
  eq(r.backPage1, r.LAVA, "1쪽으로 돌아왔는데 담긴 용암을 잃었다");
});

test("v91 시작: 스폰이 트인 쪽을 보고, 물속에서 영원히 안 떠오른다", async (page) => {
  const r = await page.evaluate(() => {
    const B = window.__blockyard;
    B.setPaused(true); B.beginPlay();
    B.S.terrain = 0;
    // ── 스폰이 벽을 보고 시작하나
    let blocked = 0, total = 0;
    const dists = [];
    for (const seed of [333, 777, 1137, 1959, 2233, 3877, 4242, 88]) {
      B.generate(seed, 2); B.refreshAllTops(); B.relightAll(false);
      B.S.spawnPoint = null;
      B.spawn();
      const sx = Math.floor(B.player.pos.x), sz = Math.floor(B.player.pos.z);
      const sy = Math.floor(B.player.pos.y);
      const fx = -Math.sin(B.player.yaw), fz = -Math.cos(B.player.yaw);
      let d = 0;
      for (let k = 1; k <= 30; k++) {
        const qx = Math.floor(sx + 0.5 + fx * k), qz = Math.floor(sz + 0.5 + fz * k);
        if (!B.inside(qx, sy, qz)) break;
        const b = B.world[B.idx(qx, sy, qz)], b2 = B.world[B.idx(qx, sy + 1, qz)];
        if (b !== 0 && !B.isCross(b) && !B.isLiquid(b)) break;
        if (b2 !== 0 && !B.isCross(b2) && !B.isLiquid(b2)) break;
        d = k;
      }
      dists.push(d);
      total++;
      if (d < 4) blocked++;
    }

    // ── 물속에서 숨이 차도 영원히 오르내리지 않는다
    B.generate(4242, 2); B.refreshAllTops(); B.relightAll(false);
    const X = 40, Z = 40, floorY = 24;
    for (let dx = -3; dx <= 3; dx++) for (let dz = -3; dz <= 3; dz++) {
      for (let dy = -2; dy <= 10; dy++) B.set(X + dx, floorY + dy, Z + dz, 0);
      B.set(X + dx, floorY - 1, Z + dz, B.B.STONE);
      for (let dy = 0; dy <= 6; dy++) B.set(X + dx, floorY + dy, Z + dz, B.B.WATER);
    }
    B.refreshAllTops(); B.relightAll(false);
    B.player.flying = false;
    B.player.pos.set(X + 0.5, floorY, Z + 0.5); B.player.vel.set(0, 0, 0);
    B.S.oxygen = 1; B.S.gasped = false;
    let minY = 999, maxY = -999, rises = 0, prevY = B.player.pos.y;
    for (let k = 0; k < 60 * 60; k++) {
      B.step(1 / 60);
      const y = B.player.pos.y;
      if (y < minY) minY = y;
      if (y > maxY) maxY = y;
      if (y - prevY > 0.05 && B.S.oxygen <= 0.01) rises++;
      prevY = y;
    }
    const gasped = B.S.gasped;

    B.S.oxygen = 1; B.S.gasped = false;
    B.endPlay(); B.setPaused(false);
    return { blocked, total, dists, minY, maxY, rises, gasped, floorY };
  });
  // 24시드 중 5개(21%)가 시야 4칸 안이 막힌 채 시작했다
  assert(r.blocked <= 1,
     r.total + "시드 중 " + r.blocked + "개가 벽을 보고 시작한다 — 거리: " + r.dists.join(","));
  const med = r.dists.slice().sort((a, b) => a - b)[r.dists.length >> 1];
  assert(med >= 10, "스폰에서 보이는 거리 중앙값이 " + med + "칸이다");
  // 숨이 차도 수면과 바닥을 영원히 오르내리면 안 된다
  assert(r.gasped, "시험대가 안 섰다 — 60초를 물속에 있었는데 숨이 안 찼다");
  assert(r.rises < 120,
     "물속에서 " + r.rises + "프레임 동안 밀려 올라갔다 — 수면과 바닥을 영원히 오르내린다");
});

test("v91 동물: 먹이를 받으면 사람을 쫓아오고, 덧먹이면 시간이 채워진다", async (page) => {
  const r = await page.evaluate(() => {
    const B = window.__blockyard;
    B.setPaused(true); B.beginPlay();
    const X = 20, Y = 40, Z = 20;
    for (let dx = -4; dx <= 40; dx++) for (let dz = -6; dz <= 6; dz++) {
      for (let dy = 0; dy <= 6; dy++) B.set(X + dx, Y + dy, Z + dz, 0);
      B.set(X + dx, Y - 1, Z + dz, B.B.GRASS);
    }
    B.refreshAllTops(); B.relightAll(false);
    B.mobs.length = 0; B.seedMobs();
    B.mobs.forEach(mm => { mm.x = 5; mm.z = 5; mm.y = 30; mm.follow = 0; mm.love = 0; });
    const m = B.mobs[0];
    m.x = X + 1.5; m.y = Y; m.z = Z + 0.5; m.follow = 0;
    B.player.pos.set(X + 0.5, Y, Z + 0.5);
    B.player.vel.set(0, 0, 0); B.player.flying = false;
    B.feedNearbyMob(B.player.pos);
    const fed = m.follow > 0;

    // 사람이 20초 동안 걸어간다 — 동물이 얼마나 따라오나
    const x0 = m.x;
    for (let k = 0; k < 20 * 60; k++) {
      B.player.pos.x = Math.min(X + 36, B.player.pos.x + B.WALK / 60);
      B.updateMobs(1 / 60);
    }
    const moved = m.x - x0;
    const gap = Math.hypot(m.x - B.player.pos.x, m.z - B.player.pos.z);

    // 덧먹이면 시간이 채워진다
    m.x = B.player.pos.x + 1.2; m.z = B.player.pos.z; m.y = B.player.pos.y;
    m.follow = 2;
    const again = B.feedNearbyMob(B.player.pos);
    const extended = m.follow > 10;

    B.mobs.forEach(mm => { mm.follow = 0; mm.love = 0; });
    B.endPlay(); B.setPaused(false);
    return { fed, moved, gap, again, extended, WALK: B.WALK };
  });
  assert(r.fed, "먹이를 줬는데 안 따라온다");
  // 예전에는 1.15 b/s 라 20초에 22칸을 가고 **34.7칸까지 벌어졌다.**
  // 지금은 판 끝(36칸)까지 따라와 바짝 붙는다 — 재는 것은 "벌어진 거리" 다.
  assert(r.moved > 25,
     "20초 동안 " + r.moved.toFixed(1) + "칸만 따라왔다 — 걸음(" + r.WALK + " b/s)을 못 쫓는다");
  assert(r.gap < 4,
     "따라오는데 " + r.gap.toFixed(1) + "칸이나 벌어졌다 — 사람이 제자리걸음을 해야 한다");
  assert(r.again, "따라오는 동물에게 다시 먹이를 줬는데 아무 일도 없다");
  assert(r.extended, "덧먹였는데 따라오기가 " + " 안 늘었다 — 섬을 가로지르는 동안 끊긴다");
});

test("v92 3인칭: 몸이 있고, 걸으면 팔다리가 흔들리고, 사진 모드에서도 남는다", async (page) => {
  const r = await page.evaluate(() => {
    const B = window.__blockyard;
    B.setPaused(true);
    const x = 48, y = 46, z = 48;
    for (let dx = -12; dx <= 12; dx++) for (let dz = -12; dz <= 12; dz++) {
      for (let dy = 0; dy <= 8; dy++) B.set(x + dx, y + dy, z + dz, 0);
      B.set(x + dx, y - 1, z + dz, B.B.STONE);
    }
    B.refreshAllTops(); B.relightAll(false);
    B.beginPlay();
    // beginPlay 가 저장된 시점(S.savedYaw)을 되살린다 — 그 뒤에 못 박아야 한다.
    // 시점 모드는 앞 시험이 3인칭인 채로 두고 갈 수 있다 (v10 3인칭)
    B.S.thirdPerson = 0; B.S.photoMode = false;
    B.player.pos.set(x + 0.5, y, z + 0.5); B.player.vel.set(0, 0, 0);
    B.player.yaw = 0; B.player.pitch = 0; B.player.flying = false;
    B.step(1 / 60);
    const firstVisible = B.bodyRoot.visible;

    const f5 = () => {
      window.dispatchEvent(new KeyboardEvent("keydown", { code: "F5", bubbles: true }));
      window.dispatchEvent(new KeyboardEvent("keyup", { code: "F5", bubbles: true }));
    };
    f5();
    B.step(1 / 60);
    const thirdVisible = B.bodyRoot.visible;

    // 몸이 발밑에 서 있나 — 키는 1.78 이어야 한다
    const bb = new THREE.Box3().setFromObject(B.bodyRoot);
    const height = bb.max.y - bb.min.y;
    const footGap = bb.min.y - B.player.pos.y;
    const dx0 = Math.abs(bb.getCenter(new THREE.Vector3()).x - B.player.pos.x);

    // 걸으면 다리가 흔들린다 — 앞으로 걸으며 다리 각의 진폭을 잰다
    let legMin = 9, legMax = -9, armMin = 9, armMax = -9;
    for (let k = 0; k < 90; k++) {
      B.player.yaw = 0;
      B.moveHorizontal(0, -0.06);
      B.step(1 / 60);
      const a = B.bodyParts.legL.rotation.x, b2 = B.bodyParts.armR.rotation.x;
      if (a < legMin) legMin = a; if (a > legMax) legMax = a;
      if (b2 < armMin) armMin = b2; if (b2 > armMax) armMax = b2;
    }
    const legSwing = legMax - legMin, armSwing = armMax - armMin;

    // 서 있으면 멎는다
    for (let k = 0; k < 60; k++) B.step(1 / 60);
    const restLeg = Math.abs(B.bodyParts.legL.rotation.x);

    // 고개를 들면 머리가 따라간다. 몸통은 늦게 따라온다
    B.player.pitch = 0.8;
    B.player.yaw = 1.0;
    B.step(1 / 60);
    const neckPitch = B.bodyParts.neck.rotation.x;
    const neckYaw = B.bodyParts.neck.rotation.y;
    const torsoYaw = B.bodyRoot.rotation.y;

    // 사진 모드가 3인칭을 안 끈다 (v92 이전에는 첫 줄에서 0 으로 박았다)
    const beforePhoto = B.S.thirdPerson;
    window.dispatchEvent(new KeyboardEvent("keydown", { code: "F6", bubbles: true }));
    window.dispatchEvent(new KeyboardEvent("keyup", { code: "F6", bubbles: true }));
    B.step(1 / 60);
    const photoThird = B.S.thirdPerson, photoVisible = B.bodyRoot.visible;
    window.dispatchEvent(new KeyboardEvent("keydown", { code: "F6", bubbles: true }));
    window.dispatchEvent(new KeyboardEvent("keyup", { code: "F6", bubbles: true }));

    // 1인칭으로 돌아오면 다시 숨는다
    f5(); f5();
    B.step(1 / 60);
    const backVisible = B.bodyRoot.visible, backThird = B.S.thirdPerson;

    B.player.pitch = 0; B.player.yaw = 0; B.player.flying = false;
    B.endPlay(); B.setPaused(false);
    return { firstVisible, thirdVisible, height, footGap, dx0, legSwing, armSwing,
             restLeg, neckPitch, neckYaw, torsoYaw, beforePhoto, photoThird,
             photoVisible, backVisible, backThird };
  });
  assert(!r.firstVisible, "1인칭인데 몸이 보인다 — 머리 안에서 시야를 가린다");
  assert(r.thirdVisible, "F5 를 눌렀는데 몸이 없다 — 조준선만 허공에 뜬다");
  assert(Math.abs(r.height - 1.78) < 0.12,
     "몸 키가 " + r.height.toFixed(2) + " 다 — 플레이어(1.78)와 어긋난다");
  assert(Math.abs(r.footGap) < 0.12,
     "발이 땅에서 " + r.footGap.toFixed(2) + " 칸 떠 있거나 묻혔다");
  assert(r.dx0 < 0.15, "몸이 플레이어 자리에서 " + r.dx0.toFixed(2) + " 칸 벗어나 있다");
  assert(r.legSwing > 0.3, "걷는데 다리 진폭이 " + r.legSwing.toFixed(2) + " 라디안뿐이다");
  assert(r.armSwing > 0.2, "걷는데 팔 진폭이 " + r.armSwing.toFixed(2) + " 라디안뿐이다");
  assert(r.restLeg < 0.05, "멈춰 섰는데 다리가 " + r.restLeg.toFixed(2) + " 만큼 벌어져 있다");
  assert(r.neckPitch > 0.5, "고개를 들었는데 머리가 " + r.neckPitch.toFixed(2) + " 만 움직였다");
  assert(Math.abs(r.neckYaw) > 0.2, "옆을 봤는데 머리가 안 돌았다");
  assert(Math.abs(r.torsoYaw) < 0.9,
     "서서 둘러보는데 몸통이 " + r.torsoYaw.toFixed(2) + " 만큼 즉시 따라 돌았다");
  eq(r.photoThird, r.beforePhoto, "사진 모드가 3인칭을 껐다 — 찍을 주인공이 사라진다");
  assert(r.photoVisible, "사진 모드에서 몸이 사라졌다");
  eq(r.backThird, 0, "F5 세 번에 1인칭으로 안 돌아왔다");
  assert(!r.backVisible, "1인칭으로 돌아왔는데 몸이 남아 있다");
});

test("v92 번개: 뇌우일 때만 치고, 볼트가 실제 자리에 떨어진다", async (page) => {
  const r = await page.evaluate(() => {
    const B = window.__blockyard;
    B.setPaused(true); B.beginPlay();
    B.player.pos.set(48.5, 46, 48.5);

    // ── 그냥 비 — 천둥도 번쩍임도 없어야 한다 (v92 이전엔 예외 없이 7~23초마다 쳤다)
    B.S.weatherLock = true;
    B.S.weather = 1; B.S.thundery = 0; B.S.flash = 0; B.S.bolt = 0;
    B.S.stormTimer = 0.1;
    let plainFlash = 0, plainBolt = 0;
    for (let k = 0; k < 60 * 180; k++) {
      B.updateStorm(1 / 60);
      if (B.S.flash > 0.01) plainFlash++;
      if (B.S.bolt > 0) plainBolt++;
    }

    // ── 뇌우 — 볼트가 보이고 하늘이 번쩍인다
    B.S.thundery = 1; B.S.stormTimer = 0.1; B.S.flash = 0; B.S.bolt = 0;
    let strikes = 0, maxFlash = 0, boltSeen = 0, farthest = 0, offGround = 0;
    let prevBolt = 0;
    for (let k = 0; k < 60 * 120; k++) {
      B.updateStorm(1 / 60);
      if (B.S.bolt > prevBolt) {          // 새로 친 순간
        strikes++;
        const bx = B.boltAt[0], by = B.boltAt[1], bz = B.boltAt[2];
        const d = Math.hypot(bx - B.player.pos.x, bz - B.player.pos.z);
        if (d > farthest) farthest = d;
        const top = B.topMap[Math.floor(bz) * B.WX + Math.floor(bx)];
        if (Math.abs(by - (top + 1)) > 0.51) offGround++;
      }
      prevBolt = B.S.bolt;
      if (B.S.flash > maxFlash) maxFlash = B.S.flash;
      if (B.S.bolt > 0 && B.boltMesh.visible) boltSeen++;
    }
    // 볼트가 다 지나가면 치운다
    for (let k = 0; k < 60; k++) B.updateStorm(1 / 60);
    B.S.bolt = 0;
    B.updateStorm(1 / 60);

    // ── 볼트 선분이 하늘까지 뻗어 있나
    B.strikeBolt(50.5, 50.5);
    const pos = B.boltMesh.geometry.attributes.position.array;
    let lo = 1e9, hi = -1e9;
    for (let i = 1; i < pos.length; i += 3) { if (pos[i] < lo) lo = pos[i]; if (pos[i] > hi) hi = pos[i]; }
    const span = hi - lo;

    // ── 뇌우는 그냥 비보다 하늘이 어둡다
    B.S.timeOfDay = 0.5; B.S.bolt = 0; B.S.flash = 0;
    B.S.thundery = 0; B.applyTime(0.016); B.applyTime(0.016);
    const litPlain = B.voxUniforms.uDay.value;
    B.S.thundery = 1; B.applyTime(0.016); B.applyTime(0.016);
    const litStorm = B.voxUniforms.uDay.value;

    B.S.weather = 0; B.S.thundery = 0; B.S.flash = 0; B.S.bolt = 0;
    B.S.weatherLock = false;
    B.boltMesh.visible = false;
    B.endPlay(); B.setPaused(false);
    return { plainFlash, plainBolt, strikes, maxFlash, boltSeen, farthest,
             offGround, span, litPlain, litStorm };
  });
  eq(r.plainFlash, 0, "그냥 비인데 3분 동안 하늘이 " + r.plainFlash + "프레임 번쩍였다");
  eq(r.plainBolt, 0, "그냥 비인데 번개가 떨어졌다");
  assert(r.strikes >= 3 && r.strikes <= 12,
     "뇌우 2분 동안 번개가 " + r.strikes + "번 쳤다 — 3~12번이라야 한다");
  assert(r.maxFlash > 0.2, "뇌우인데 하늘이 안 번쩍였다");
  assert(r.boltSeen > 0, "번개가 쳤는데 볼트가 화면에 안 나왔다 — 하늘 번쩍임뿐이다");
  assert(r.farthest <= 72, "번개가 " + r.farthest.toFixed(0) + "칸 밖에 떨어졌다 — 안 보인다");
  eq(r.offGround, 0, "볼트가 " + r.offGround + "번 땅이 아닌 곳에서 시작했다");
  assert(r.span > 30, "볼트가 " + r.span.toFixed(0) + "칸밖에 안 뻗는다");
  assert(r.litStorm < r.litPlain - 0.02,
     "뇌우가 그냥 비와 같은 밝기다 — " + r.litStorm.toFixed(3) + " vs " + r.litPlain.toFixed(3));
});

test("v92 묘목: 세 종을 골라 심고, 심은 대로 자란다", async (page) => {
  const r = await page.evaluate(() => {
    const B = window.__blockyard;
    B.setPaused(true); B.beginPlay();
    const Y = 46, Z = 60;
    // 설원 한복판에서도 재 본다 — 예전에는 바이옴이 종을 정해서
    // 초원에 가문비를, 설원에 참나무를 심을 방법이 아예 없었다
    const bases = [];
    for (let s = 0; s < 3; s++) {
      const X = 20 + s * 10;
      for (let dx = -5; dx <= 5; dx++) for (let dz = -5; dz <= 5; dz++) {
        for (let dy = -1; dy <= 16; dy++) B.set(X + dx, Y + dy, Z + dz, 0);
        B.set(X + dx, Y - 1, Z + dz, B.B.GRASS);
        B.biomeMap[(Z + dz) * B.WX + (X + dx)] = 1;      // 전부 설원으로 못 박는다
      }
      bases.push(X);
    }
    B.refreshAllTops(); B.relightAll(false);

    const kinds = [B.B.SAPLING, B.B.SAPLING_BIRCH, B.B.SAPLING_SPRUCE];
    const out = [];
    for (let s = 0; s < 3; s++) {
      const X = bases[s];
      B.applyEdit(X, Y, Z, kinds[s], false, 0);
      let ticks = 0;
      while (B.get(X, Y, Z) === kinds[s] && ticks < 500) { B.growTick(1.0); ticks++; }
      const log = B.get(X, Y, Z);
      let leaf = 0, oak = 0, birch = 0, spruce = 0;
      for (let dx = -4; dx <= 4; dx++) for (let dz = -4; dz <= 4; dz++)
        for (let dy = 0; dy <= 14; dy++) {
          const b = B.get(X + dx, Y + dy, Z + dz);
          if (b === B.B.LEAVES) { leaf++; oak++; }
          else if (b === B.B.BIRCH_LEAVES) { leaf++; birch++; }
          else if (b === B.B.SPRUCE_LEAVES) { leaf++; spruce++; }
        }
      out.push({ log, leaf, oak, birch, spruce, ticks });
    }

    // 목록·이름·아이콘이 세 종을 가르나
    const inList = kinds.map((k) => B.ALL_BLOCKS.indexOf(k) >= 0);
    const names = kinds.map((k) => B.NAMES[k]);
    const tiles = kinds.map((k) => B.TILES[k][0]);
    const sapCheck = kinds.map((k) => B.isSapling(k));
    // 아이콘이 실제로 서로 다른 그림인가 — 타일 번호만 다르고 그림이 같으면 못 가른다
    const inks = tiles.map((t) => {
      const cv = document.createElement("canvas");
      cv.width = cv.height = 16;
      const c = cv.getContext("2d");
      c.drawImage(B.atlas, (t % 16) * 16, Math.floor(t / 16) * 16, 16, 16, 0, 0, 16, 16);
      const d = c.getImageData(0, 0, 16, 16).data;
      let sum = 0;
      for (let i = 0; i < d.length; i += 4) sum += (d[i] * 7 + d[i + 1] * 11 + d[i + 2] * 13) * (d[i + 3] ? 1 : 0);
      return sum;
    });

    B.endPlay(); B.setPaused(false);
    return { out, inList, names, tiles, sapCheck, inks, allCount: B.ALL_BLOCKS.length };
  });
  const [oakT, birchT, spruceT] = r.out;
  assert(oakT.log === 5, "참나무 묘목이 참나무로 안 자랐다 — 줄기가 " + oakT.log + " 다");
  assert(oakT.oak > 0 && oakT.birch === 0 && oakT.spruce === 0,
     "참나무 묘목이 낸 잎: 참" + oakT.oak + " 자작" + oakT.birch + " 가문비" + oakT.spruce);
  assert(birchT.log === 27, "자작나무 묘목이 자작으로 안 자랐다 — 줄기가 " + birchT.log + " 다");
  assert(spruceT.log === 5, "가문비 묘목의 줄기가 " + spruceT.log + " 다 — 가문비도 참나무 원목을 쓴다");
  assert(birchT.birch > 0 && birchT.oak === 0 && birchT.spruce === 0,
     "자작 묘목이 낸 잎: 참" + birchT.oak + " 자작" + birchT.birch + " 가문비" + birchT.spruce);
  assert(spruceT.spruce > 0 && spruceT.oak === 0 && spruceT.birch === 0,
     "설원에 심은 가문비 묘목이 낸 잎: 참" + spruceT.oak + " 자작" + spruceT.birch + " 가문비" + spruceT.spruce);
  assert(r.inList.every(Boolean), "묘목 세 종이 블록 목록에 다 있지 않다: " + r.inList.join(","));
  assert(new Set(r.names).size === 3, "묘목 이름이 겹친다: " + r.names.join(" · "));
  assert(new Set(r.tiles).size === 3, "묘목 아틀라스 타일이 겹친다: " + r.tiles.join(","));
  assert(new Set(r.inks).size === 3, "묘목 그림이 서로 같다 — 핫바에서 못 가른다: " + r.inks.join(","));
  assert(r.sapCheck.every(Boolean), "isSapling 이 세 종을 다 못 잡는다");
});

test("v92 새 블록: 타일이 남의 그림을 안 덮고, 이름이 원목을 안 가로챈다", async (page) => {
  const r = await page.evaluate(() => {
    const B = window.__blockyard;
    // (1) 목록에 오른 것들이 **실제로 그려진** 타일을 가리키나.
    // v92 가 묘목을 담긴 양동이(81·82) 위에 그렸는데 시험이 못 잡았다 —
    // 두 그림이 서로 다르기만 하면 통과하는 시험이었다
    const unpainted = [];
    for (const b of B.ALL_BLOCKS.concat(B.ITEMS)) {
      const t = B.TILES[b];
      if (!t) { unpainted.push(B.NAMES[b] + "(타일 없음)"); continue; }
      for (const ti of t) if (!B.painted[ti]) unpainted.push(B.NAMES[b] + "→" + ti);
    }

    // (2) 이름으로 찾을 때 묘목이 원목·잎을 가로채면 안 된다 (findBlock 은 목록 순서를 탄다)
    B.setPaused(true); B.beginPlay();
    const names = ["자작나무", "가문비", "참나무", "자작나무 묘목", "가문비 묘목", "참나무 묘목"];
    const found = names.map((n) => {
      B.runCommand("give " + n);
      return B.S.bar[B.S.selected];
    });

    // (3) 저장에서 되살린 비도 뇌우가 될 수 있어야 한다.
    // 추첨이 setWeather 안에만 있으면, S.weather 를 직접 넣고 applyWeather 만 부르는
    // 불러오기 경로에서 그 세계는 영영 천둥이 없다
    let thundery = 0;
    for (let k = 0; k < 60; k++) {
      B.S.weather = 1; B.S.thundery = null;
      B.applyWeather();
      if (B.S.thundery) thundery++;
    }
    B.S.weather = 0; B.S.thundery = 0; B.applyWeather();
    B.endPlay(); B.setPaused(false);
    return { unpainted, found, thundery };
  });
  eq(r.unpainted.length, 0, "그려지지 않은 타일을 쓰는 블록: " + r.unpainted.join(", "));
  eq(r.found[0], 27, "'자작나무' 가 자작 원목(27)이 아니라 " + r.found[0] + " 을 준다");
  eq(r.found[1], 29, "'가문비' 가 가문비 잎(29)이 아니라 " + r.found[1] + " 을 준다");
  eq(r.found[2], 5, "'참나무' 가 참나무 원목(5)이 아니라 " + r.found[2] + " 을 준다");
  eq(r.found[3], 78, "'자작나무 묘목' 이 " + r.found[3] + " 을 준다");
  eq(r.found[4], 79, "'가문비 묘목' 이 " + r.found[4] + " 을 준다");
  eq(r.found[5], 56, "'참나무 묘목' 이 " + r.found[5] + " 을 준다");
  assert(r.thundery >= 8 && r.thundery <= 32,
     "불러온 비 60판 중 뇌우가 " + r.thundery + "판이다 — 32% 언저리라야 한다");
});

phoneTest("터치 단추를 키워도 화면 밖으로 나가지 않는다 (v93)", async (page) => {
  const r = await page.evaluate(() => {
    const B = window.__blockyard;
    B.setPaused(true); B.beginPlay();
    const keep = B.opts.tbtn;
    const rows = [];
    for (const want of [80, 100, 120, 140, 160]) {
      B.opts.tbtn = want;
      B.applyTbtn();
      const box = document.getElementById("tbtns");
      let worstTop = 1e9, missing = [];
      for (const b of box.querySelectorAll("button")) {
        const rc = b.getBoundingClientRect();
        if (rc.top < worstTop) worstTop = rc.top;
        if (rc.top < 0 || rc.bottom > window.innerHeight ||
            rc.left < 0 || rc.right > window.innerWidth) missing.push(b.id);
      }
      rows.push({ want, worstTop: Math.round(worstTop), missing });
    }
    B.opts.tbtn = keep; B.applyTbtn();
    B.endPlay(); B.setPaused(false);
    return { rows, h: window.innerHeight };
  });
  for (const row of r.rows) {
    eq(row.missing.length, 0,
       "터치 단추 " + row.want + "% — 화면 밖으로 나간 단추: " + row.missing.join(",") +
       " (맨 위 단추 y=" + row.worstTop + " · 화면 높이 " + r.h + ")");
  }
});

test("v93 새는 것: 청크와 동물이 GPU 버퍼를 놓아 준다", async (page) => {
  const r = await page.evaluate(() => {
    const B = window.__blockyard;
    B.setPaused(true);
    // (1) 청크를 다시 구울 때 예전 지오메트리를 dispose 하나
    let disposed = 0;
    const proto = THREE.BufferGeometry.prototype;
    const realDispose = proto.dispose;
    proto.dispose = function () { disposed++; return realDispose.apply(this, arguments); };
    const before = disposed;
    for (let k = 0; k < 6; k++) B.buildChunk(2, 2, 2);
    const chunkDisposed = disposed - before;

    // (2) 세계를 갈아탈 때 동물 메시를 놓아 주나
    B.seedMobs && B.seedMobs();
    const mobsBefore = B.mobs.length;
    const d0 = disposed;
    B.loadMobs([[100, 100, 100, 0, 0, 0]]);
    const mobDisposed = disposed - d0;
    proto.dispose = realDispose;
    return { chunkDisposed, mobDisposed, mobsBefore, mobsAfter: B.mobs.length };
  });
  assert(r.chunkDisposed >= 6,
     "청크를 6번 다시 구웠는데 dispose 가 " + r.chunkDisposed + "번뿐이다 — GPU 버퍼가 고아로 남는다");
  assert(r.mobsBefore > 0, "시험대가 안 섰다 — 동물이 하나도 없다");
  assert(r.mobDisposed >= r.mobsBefore,
     "동물 " + r.mobsBefore + "마리를 치웠는데 dispose 가 " + r.mobDisposed + "번뿐이다");
});

test("v93 화각: 좁은 창에서도 가로 시야를 지킨다", async (page) => {
  const r = await page.evaluate(() => {
    const B = window.__blockyard;
    function horiz(fovDeg, aspect) {
      const v = B.fovForAspect(fovDeg, aspect) * Math.PI / 360;
      return Math.atan(Math.tan(v) * aspect) * 360 / Math.PI;
    }
    const wide = horiz(72, 16 / 9);
    const rows = [[1.778, horiz(72, 1.778)], [1.6, horiz(72, 1.6)],
                  [0.636, horiz(72, 0.636)], [0.553, horiz(72, 0.553)],
                  [2.164, horiz(72, 2.164)]];
    return { wide, rows, tallVert: B.fovForAspect(72, 0.636) };
  });
  // 예전에는 700×1100 창에서 수평 49.6° 였다 (1600×900 의 104.5° 대비 절반 아래)
  // 아주 좁은 창(0.55)에서는 세로 화각 상한(118°)에 걸려 다 못 지킨다 —
  // 그래도 예전의 47%(49.6° / 104.5°)에서 80% 위로 올라와야 한다
  for (const [aspect, h] of r.rows) {
    if (aspect >= 16 / 9) continue;
    assert(h > r.wide * 0.80,
       "aspect " + aspect + " 에서 수평 화각이 " + h.toFixed(1) + "° 다 — 기준은 " + r.wide.toFixed(1) + "°");
  }
  assert(r.tallVert > 72, "좁은 창인데 세로 화각이 안 늘었다: " + r.tallVert.toFixed(1));
});

test("v93 새 세계: 지난 세계의 횃불·편집 기록을 안 물려받는다", async (page) => {
  const r = await page.evaluate(() => {
    const B = window.__blockyard;
    B.setPaused(true); B.beginPlay();
    B.S.torchesPlaced = 12; B.S.lampsPlaced = 30; B.S.everEdited = true;
    B.S.earned = {}; B.S.earned.torch10 = 1;
    B.newWorld();
    const after = { torches: B.S.torchesPlaced, lamps: B.S.lampsPlaced,
                    everEdited: B.S.everEdited, earned: Object.keys(B.S.earned).length };
    B.endPlay(); B.setPaused(false);
    return after;
  });
  eq(r.torches, 0, "새 세계인데 횃불 카운터가 " + r.torches + " 다 — 횃불 하나에 과제가 열린다");
  eq(r.lamps, 0, "새 세계인데 램프 카운터가 " + r.lamps + " 다");
  eq(r.everEdited, false, "새 세계인데 '편집한 적 있음' 이 남아 있다");
  eq(r.earned, 0, "새 세계인데 과제 기록이 남아 있다");
});

test("v93 계기판: 조준한 칸의 좌표를 보여 준다", async (page) => {
  await page.evaluate(() => {
    const B = window.__blockyard;
    B.setPaused(true); B.beginPlay();
    B.S.thirdPerson = 0;
    const X = 70, Y = 40, Z = 70;
    for (let dx = -6; dx <= 6; dx++) for (let dz = -6; dz <= 6; dz++)
      for (let dy = -1; dy <= 6; dy++) B.set(X + dx, Y + dy, Z + dz, 0);
    B.set(X, Y + 1, Z - 4, B.B.STONE);              // 눈높이(pos.y + EYE)에 놓는다
    B.refreshAllTops(); B.relightAll(false);
    B.player.flying = true;
    B.player.pos.set(X + 0.5, Y, Z + 0.5);
    B.player.yaw = 0; B.player.pitch = 0;           // -Z 를 본다
    B.S.showPerf = true;
    // 계기판은 step 이 아니라 animate 안에서 갱신된다 — 실제 프레임을 돌려야 한다
    B.setPaused(false);
  });
  await page.waitForTimeout(400);
  const r = await page.evaluate(() => {
    const B = window.__blockyard;
    const el = document.getElementById("t-aim");
    const text = el ? el.textContent : "(없음)";
    const hit = B.S.aimHit ? B.S.aimHit.slice() : null;
    const face = B.S.aimFace ? B.S.aimFace.slice() : null;
    B.S.showPerf = false;
    B.player.flying = false;
    B.endPlay(); B.setPaused(true); B.setPaused(false);
    return { text, hit, face };
  });
  assert(r.hit, "조준한 칸을 못 잡았다 — 시험대가 안 섰다");
  assert(r.text.indexOf(String(r.hit[0])) >= 0 && r.text.indexOf(String(r.hit[2])) >= 0,
     "계기판 「조준」 이 '" + r.text + "' 인데 겨눈 칸은 " + r.hit.join(",") + " 다");
  assert(r.text.indexOf(String(r.face[2])) >= 0,
     "놓일 자리(" + r.face.join(",") + ")가 「조준」 에 안 보인다: " + r.text);
});

test("v93 소리: 잡음을 매번 굽지 않고, 비는 이어진다", async (page) => {
  const r = await page.evaluate(() => {
    const B = window.__blockyard;
    B.setPaused(true); B.beginPlay();
    const c = B.ac();
    if (!c) return { skipped: true };
    const real = c.createBuffer.bind(c);
    let made = 0;
    c.createBuffer = function () { made++; return real.apply(c, arguments); };
    B.crunch(0.2, 0.05, 900);            // 첫 호출이 한 벌을 굽는다
    const first = made;
    for (let k = 0; k < 120; k++) B.crunch(0.2, 0.05, 900);
    const after = made;
    // 빗소리는 루프 하나다 — 60번 불러도 노드가 늘지 않는다
    const d0 = made;
    for (let k = 0; k < 60; k++) B.rainHiss(0.6);
    const rainMade = made - d0;
    c.createBuffer = real;
    B.endPlay(); B.setPaused(false);
    return { first, after, rainMade };
  });
  if (r.skipped) return;
  assert(r.after - r.first === 0,
     "crunch 120번에 버퍼를 " + (r.after - r.first) + "개 더 구웠다 — 한 벌을 나눠 써야 한다");
  eq(r.rainMade, 0, "빗소리 60번에 버퍼를 " + r.rainMade + "개 구웠다 — 루프 하나라야 한다");
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
  await ctx.close();

  // ── 폰 화면으로 한 번 더 (같은 회차 안에서) ───────────────
  const phoneCases = PT.filter((t) => !FILTER || t.name.includes(FILTER));
  if (phoneCases.length) {
    const ph = await openGame(browser, { phone: true });
    for (const t of phoneCases) {
      try { await t.fn(ph.page, ph.errors); pass++; }
      catch (e) {
        fail++;
        failNames.set(t.name, (failNames.get(t.name) || 0) + 1);
        lines.push(`  ✗ ${t.name}\n      ${String(e.message).split("\n")[0]}`);
      }
    }
    if (ph.errors.length) {
      fail++; failNames.set("폰 · 페이지 오류 없음", (failNames.get("폰 · 페이지 오류 없음") || 0) + 1);
      lines.push("  ✗ 폰 · 페이지 오류 없음\n      " + ph.errors.slice(0, 3).join(" | "));
    } else pass++;
    await ph.ctx.close();
  }

  totalPass += pass; totalFail += fail;
  console.log(`[${round}/${REPEAT}] 통과 ${pass} · 실패 ${fail}`);
  if (lines.length) console.log(lines.join("\n"));
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
