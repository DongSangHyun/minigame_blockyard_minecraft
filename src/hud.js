// hud.js — HUD · 핫바 · 블록 고르기 · 미니맵
import { S } from "./state.js";
import { BUILD } from "./version.js";
import { SEA, WX, WY, WZ, idx } from "./dims.js";
import { AIR, ALL_BLOCKS, FENCE, LOG, PLANKS, BOOKSHELF, LAMP, GLASS, ITEMS, NAMES, NAMES_EN, TILES, WATER, categoryOf, isCross, isLeaf } from "./blocks.js";
import { AVG_TOP, TILE, atlas, tileOrigin } from "./atlas.js";
import { SEEN_TOP, SEEN_UNDER_ALL, UNDER_BANDS, underBand, isTouched, heightMap, markX, markY, markZ, markName, seenMap, markSeen, topMap, world } from "./world.js";
import { player } from "./player.js";
import { updateHandBlock } from "./hand.js";
import { advanceTut, canvas, isTouch } from "./input.js";

export var hotbarEl = document.getElementById("hotbar");
export var slotCanvases = [];

export function drawIcon(cv, blockId) {
  var c = cv.getContext("2d");
  c.clearRect(0, 0, 64, 64);
  c.imageSmoothingEnabled = false;
  var cx = 32, top = 9, hw = 22, hh = 11, sh = 22;
  var t = TILES[blockId];

  if (isCross(blockId)) {
    var co = tileOrigin(t[0]);
    c.drawImage(atlas, co[0], co[1], TILE, TILE, 8, 8, 48, 48);
    return;
  }

  function face(tileIdx, O, U, V, shade) {
    var o = tileOrigin(tileIdx);
    c.save();
    c.beginPath();
    c.moveTo(O[0], O[1]);
    c.lineTo(O[0] + U[0], O[1] + U[1]);
    c.lineTo(O[0] + U[0] + V[0], O[1] + U[1] + V[1]);
    c.lineTo(O[0] + V[0], O[1] + V[1]);
    c.closePath();
    c.clip();
    if (blockId === GLASS || blockId === WATER) { c.fillStyle = "#2a3a40"; c.fill(); }
    c.setTransform(U[0] / TILE, U[1] / TILE, V[0] / TILE, V[1] / TILE, O[0], O[1]);
    c.drawImage(atlas, o[0], o[1], TILE, TILE, 0, 0, TILE, TILE);
    c.setTransform(1, 0, 0, 1, 0, 0);
    if (shade < 1) {
      c.fillStyle = "rgba(0,0,0," + (1 - shade).toFixed(2) + ")";
      c.fillRect(0, 0, 64, 64);
    }
    c.restore();
  }
  face(t[0], [cx - hw, top + hh], [hw, -hh], [hw, hh], 1.0);
  face(t[1], [cx - hw, top + hh], [hw, hh], [0, sh], 0.60);
  face(t[1], [cx, top + 2 * hh], [hw, -hh], [0, sh], 0.82);
}

for (var si = 0; si < S.bar.length; si++) {
  (function (i) {
    var slot = document.createElement("button");
    slot.className = "slot";
    slot.type = "button";
    var key = document.createElement("span");
    key.className = "key"; key.textContent = i === 9 ? "0" : String(i + 1);
    var cv = document.createElement("canvas");
    cv.width = cv.height = 64;
    var name = document.createElement("span");
    name.className = "name";
    var shp = document.createElement("span");
    shp.className = "shape";
    slot.appendChild(key); slot.appendChild(cv); slot.appendChild(name); slot.appendChild(shp);
    slot.addEventListener("click", function (e) { e.preventDefault(); selectSlot(i); });
    hotbarEl.appendChild(slot);
    slotCanvases.push(cv);
  })(si);
}

// 칸에 딸린 모양을 글리프로 — ▄ 반블록 · ◱ 계단. 전체 블록이면 아무것도 안 그린다.
export var SHAPE_GLYPH = ["", "▄", "◱"];
export var SHAPE_WORD = ["전체 블록", "반블록", "계단"];
export function refreshSlot(i) {
  var b = S.bar[i];
  drawIcon(slotCanvases[i], b);
  var slot = hotbarEl.children[i];
  var m = (S.shapeBar && i !== S.selected) ? (S.shapeBar[i] | 0) : S.shapeMode;
  if (i !== S.selected && !S.shapeBar) m = 0;
  var g = SHAPE_GLYPH[m] || "";
  slot.setAttribute("aria-label", NAMES[b] + (g ? " · " + SHAPE_WORD[m] : ""));
  slot.querySelector(".name").textContent = NAMES[b];
  var sp = slot.querySelector(".shape");
  if (sp) sp.textContent = g;
}
export function refreshBar() {
  for (var i = 0; i < S.bar.length; i++) refreshSlot(i);
  updateHandBlock();
}
export function selectSlot(i) {
  // 떠나는 칸의 모양을 그 칸에 남기고, 새 칸이 기억하던 모양을 꺼내 온다 (v82).
  // 이게 없으면 G 로 고른 모양이 전역 하나라 칸을 바꿔도 계단이 따라온다.
  if (S.shapeBar) S.shapeBar[S.selected] = S.shapeMode;
  var wasShape = S.shapeMode;
  S.selected = ((i % S.bar.length) + S.bar.length) % S.bar.length;
  if (S.shapeBar) S.shapeMode = S.shapeBar[S.selected] | 0;
  for (var k = 0; k < hotbarEl.children.length; k++) {
    hotbarEl.children[k].setAttribute("aria-current", k === S.selected ? "true" : "false");
  }
  refreshBar();                       // 칸마다 붙은 모양 글리프를 다시 그린다
  // 칸을 옮겨 모양이 **실제로 바뀌었을 때만** 알린다 — 안 그러면 첫 한 번은 늘 틀리게 놓는다
  if (S.shapeMode !== wasShape) toast(SHAPE_WORD[S.shapeMode]);
  updateHandBlock();
}

// ── 블록 고르기 패널
export var pickerEl = document.getElementById("picker");
export var pickGrid = document.getElementById("pick-grid");

export var pickBtns = [];
ALL_BLOCKS.concat(ITEMS).forEach(function (b) {
  var btn = document.createElement("button");
  btn.className = "pick";
  btn.type = "button";
  btn.setAttribute("aria-label", NAMES[b]);
  var cv = document.createElement("canvas");
  cv.width = cv.height = 64;
  drawIcon(cv, b);
  var cap = document.createElement("figcaption");
  cap.textContent = NAMES[b];
  btn.appendChild(cv); btn.appendChild(cap);
  btn.addEventListener("click", function () {
    // 닫지 않는다 — 핫바 열 칸을 양털 색으로 갈아 끼우려면
    // 예전엔 E→클릭→숫자→E→클릭→… 스무 번을 눌러야 했다.
    // 마크의 크리에이티브 인벤토리도 열린 채로 여러 칸을 채운다.
    // 닫기는 E·ESC·바깥 클릭이 이미 있다.
    S.bar[S.selected] = b;
    refreshSlot(S.selected);
    updateHandBlock();
    S.worldDirty = true;
    toast(NAMES[b] + " → " + (S.selected === 9 ? "0" : (S.selected + 1)) + "번 칸");
  });
  pickGrid.appendChild(btn);
  // 한국어 이름과 영어 이름을 둘 다 검색어로 둔다 — "조약돌" 도 "cobble" 도 잡힌다
  pickBtns.push({ el: btn, block: b,
                  name: ((NAMES[b] || "") + " " + (NAMES_EN[b] || "")).trim(),
                  cat: categoryOf(b) });
});

export function openPicker() {
  if (S.uiOpen) return;
  sortPickByRecent();
  refreshPickFilter();
  S.uiOpen = true;
  pickerEl.hidden = false;
  if (document.pointerLockElement === canvas) document.exitPointerLock();
  advanceTut(2);
  var first = pickGrid.querySelector(".pick");
  if (first && first.focus) first.focus();
}
export function closePicker(resume) {
  if (!S.uiOpen) return;
  S.uiOpen = false;
  pickerEl.hidden = true;
  if (resume && S.active && S.lockMode && canvas.requestPointerLock) {
    try { canvas.requestPointerLock(); } catch (e) {}
  }
}
pickerEl.addEventListener("click", function (e) {
  if (e.target === pickerEl) closePicker(true);
});

export var FACING = ["북 N", "서 W", "남 S", "동 E"];
export function facingText() {
  var q = Math.round(player.yaw / (Math.PI / 2)) % 4;
  return FACING[((q % 4) + 4) % 4];
}
export var tFace = document.getElementById("t-face");
export var tAch = document.getElementById("t-ach");
export var tBiome = document.getElementById("t-biome");

// 도전 과제 달성 알림 — 토스트보다 눈에 띄게
export var achPop = document.getElementById("achpop");
var achPopTimer = null;
export function showAchPop(name, desc) {
  if (!achPop) return;
  achPop.hidden = false;
  achPop.querySelector("b").textContent = "도전 과제 달성";
  achPop.querySelector("span").textContent = name + " — " + desc;
  requestAnimationFrame(function () { achPop.classList.add("on"); });
  clearTimeout(achPopTimer);
  achPopTimer = setTimeout(function () {
    achPop.classList.remove("on");
    setTimeout(function () { achPop.hidden = true; }, 350);
  }, 2600);
}
export var tPos = document.getElementById("t-pos"),
    tTime = document.getElementById("t-time"),
    tLight = document.getElementById("t-light"),
    tMode = document.getElementById("t-mode"),
    tBlocks = document.getElementById("t-blocks"),
    tShape = document.getElementById("t-shape"),
    tFps = document.getElementById("t-fps");

export var underwaterEl = document.getElementById("underwater");
export var inblockEl = document.getElementById("inblock");
export var airEl = document.getElementById("air");
export var perfEl = document.getElementById("perf");
export var airBar = airEl ? airEl.querySelector("i") : null;
export var minimapEl = document.getElementById("minimap");
export var mmCap = document.getElementById("mm-cap");
export var touchEl = document.getElementById("touch");
export var hudEls = [document.getElementById("reticle"), document.getElementById("telemetry"),
              minimapEl, hotbarEl, document.getElementById("hint")];
export function showHud(on) {
  hudEls.forEach(function (el) { el.hidden = !on; });
  touchEl.hidden = !(on && isTouch);
}

export var toastEl = document.getElementById("toast");
export function toast(msg) { toastEl.textContent = msg; toastEl.classList.add("on"); S.toastTimer = 1.6; }

// ── 미니맵
export var mmCanvas = document.getElementById("mm");
mmCanvas.width = WX; mmCanvas.height = WZ;
export var mmCtx = mmCanvas.getContext("2d");
export var mmImage = mmCtx.createImageData(WX, WZ);

// 미니맵 캡션 — 이름을 붙였으면 그것으로, 아니면 시드로 부른다.
// animate() 안에 박혀 있으면 시험이 닿을 수가 없어 따로 뺐다.
export function refreshMinimapCap() {
  if (!mmCap) return "";
  mmCap.textContent = (S.mmUnder ? ("단면 Y" + Math.floor(player.pos.y))
                                 : (S.worldName || ("SEED " + S.worldSeed)))
                      + (S.mmZoom > 1 ? "  ×" + S.mmZoom : "");
  return mmCap.textContent;
}

// 머리 위로 이만큼 넘게 덮여 있어야 "지하" 다.
export var UNDER_ROOF = 4;
// 머리 위의 첫 **자연 고체** 높이 — 없으면 -1.
// 나뭇잎과 **사람이 놓은 것**은 지붕으로 치지 않는다. 그러지 않으면
// 나무 밑으로 걸어 들어가거나 제 집에 들어가는 것만으로 지상 지도가 통째로 꺼진다.
export function naturalRoof(x, z, y) {
  if (x < 0 || x >= WX || z < 0 || z >= WZ) return -1;
  var top = topMap[z * WX + x];
  for (var yy = top; yy > y; yy--) {
    var b = world[idx(x, yy, z)];
    if (b === AIR || isCross(b) || isLeaf(b)) continue;
    if (isTouched(x, yy, z)) continue;          // 내가 얹은 지붕은 지하가 아니다
    return yy;
  }
  return -1;
}

// ── 굴 어귀 점 (v85)
// 예전에는 어귀 **칸마다** 주황을 칠했다. 실측: 어귀 칸의 절반 이상이 한 칸짜리 점(폰에서 0.875px)이고,
// 협곡 하나가 89~233칸을 통째로 주황으로 칠해 "어귀 천지" 로 읽혔다.
// 지도는 **셀 수 있는 개수**여야 읽힌다 — 덩어리로 묶어 **한 어귀당 점 하나**만 찍는다.
// 그리기 계층만 손대므로 지형은 한 비트도 안 달라진다.
// 갱도가 쓰는 재료 — 자연 동굴에는 안 나오는 것들
function isMineMat(b) {
  return b === FENCE || b === LOG || b === PLANKS || b === BOOKSHELF || b === LAMP;
}
export var MOUTH_MIN = 3;        // 이보다 작은 덩어리는 굴 입이 아니라 지형 주름이다
export var mouthDots = [];
function isMouthCol(x, z) {
  var i = z * WX + x;
  var h = heightMap[i], t = topMap[i];
  return h > SEA && t >= 0 && h - t >= 4;
}
export function refreshMouthDots() {
  mouthDots.length = 0;
  var seen = new Uint8Array(WX * WZ);
  var qx = [], qz = [];
  var DX = [1, -1, 0, 0], DZ = [0, 0, 1, -1];
  for (var z = 1; z < WZ - 1; z++) {
    for (var x = 1; x < WX - 1; x++) {
      var i0 = z * WX + x;
      if (seen[i0] || !isMouthCol(x, z)) continue;
      qx.length = 0; qz.length = 0;
      qx.push(x); qz.push(z); seen[i0] = 1;
      var n = 0, sx = 0, sz = 0;
      for (var h2 = 0; h2 < qx.length; h2++) {
        var cx = qx[h2], cz = qz[h2];
        n++; sx += cx; sz += cz;
        for (var d = 0; d < 4; d++) {
          var nx = cx + DX[d], nz = cz + DZ[d];
          if (nx < 1 || nx >= WX - 1 || nz < 1 || nz >= WZ - 1) continue;
          var ni = nz * WX + nx;
          if (seen[ni] || !isMouthCol(nx, nz)) continue;
          seen[ni] = 1; qx.push(nx); qz.push(nz);
        }
      }
      if (n >= MOUTH_MIN) mouthDots.push([Math.round(sx / n), Math.round(sz / n), n]);
    }
  }
  return mouthDots.length;
}

export function drawMinimap() {
  var d = mmImage.data;
  // 걸어온 만큼 지도가 열린다. 지하에서는 시야가 좁고, 밝히는 층도 따로다.
  var pxc = Math.max(0, Math.min(WX - 1, Math.floor(player.pos.x)));
  var pzc = Math.max(0, Math.min(WZ - 1, Math.floor(player.pos.z)));
  var py = Math.max(0, Math.min(WY - 1, Math.floor(player.pos.y)));
  // 지상인지 지하인지를 먼저 정한다 — 뒤에 정하면 한 프레임 늦은 값으로 엉뚱한 층을 밝힌다
  // 지하인가 — **"머리 위에 뭐라도 있는가" 가 아니라 "돌 밑에 있는가"** 다 (v85).
  // topMap 은 나뭇잎도 내가 얹은 지붕도 센다. 2.5칸으로 잡아 두니
  // 나무 밑으로 걸어 들어가는 것만으로 지상 지도가 통째로 꺼졌고(잎 기둥의 51%),
  // 그동안 **가 본 적 없는 가장 깊은 층의 지도가 "밝혀짐" 으로 칠해졌다.**
  // 지도 기억이 오염되면 되돌릴 길이 없다.
  // v80 이 동굴 울림에서 이미 같은 답을 냈다 — 머리 위 두께로 잰다.
  var roofTop = naturalRoof(pxc, pzc, player.pos.y);
  S.mmUnder = roofTop >= 0 && roofTop - player.pos.y > UNDER_ROOF;
  // 지하는 지금 서 있는 **층**만 밝힌다 (v81) — 한 장으로 쓰면 위층에서 밝힌 자리가
  // 아래층 지도에 통돌로 뜬다. 밝히는 반경도 6 → 8 로 — 지하가 두 배가 됐는데
  // 반경이 그대로면 같은 지도를 채우는 데 두 배로 걸어야 한다.
  var seenBit = S.mmUnder ? underBand(py) : SEEN_TOP;
  markSeen(player.pos.x, player.pos.z, S.mmUnder ? 8 : 14, seenBit);

  // 확대 — 보이는 칸 수를 줄이고 한 칸을 여러 픽셀로 그린다
  var zoom = S.mmZoom;
  var spanX = Math.max(8, Math.round(WX / zoom));
  var spanZ = Math.max(8, Math.round(WZ / zoom));
  var x0 = Math.max(0, Math.min(WX - spanX, pxc - (spanX >> 1)));
  var z0 = Math.max(0, Math.min(WZ - spanZ, pzc - (spanZ >> 1)));

  for (var oz = 0; oz < WZ; oz++) {
    var z = z0 + Math.floor(oz * spanZ / WZ);
    for (var ox = 0; ox < WX; ox++) {
      var x = x0 + Math.floor(ox * spanX / WX);
      var o = (oz * WX + ox) * 4;
      d[o + 3] = 255;
      // 안 가 본 칸은 흰 종이로 둔다 — 지도는 걸어서 채운다.
      // 지하에서는 **다른 층에서 밝힌 것도 흐리게 남긴다** (v83).
      // 층만 보고 지우면, 굴 하나를 걷는데 바닥이 한 칸 오르내릴 때마다
      // 지도가 통째로 하얘졌다 다시 찬다 — 실측 15걸음에 한 번, 초당 최대 5번.
      // 고친 문제(위층 굴이 아래층에 통돌로 뜨는 것)보다 새 문제가 더 자주 눈에 띄었다.
      var seenHere = seenMap[z * WX + x];
      var faded = false;
      if (!(seenHere & seenBit)) {
        if (S.mmUnder && (seenHere & SEEN_UNDER_ALL)) faded = true;   // 다른 층에서 본 자리
        else { d[o] = 12; d[o + 1] = 16; d[o + 2] = 20; continue; }
      }
      var b = AIR, shade = 1, hollow = false, made = false, lastY = py;
      if (S.mmUnder) {
        // 지하에서는 지금 높이의 단면을 본다.
        // 훑는 깊이는 층 두께를 따라간다 — 5칸 고정이면 지하가 26칸이 된 뒤
        // 천장이 높은 방에서 바닥을 못 찾아 "밝힌 곳" 이 배경색으로 그려진다.
        var deep = Math.max(4, Math.round((SEA + 2) / UNDER_BANDS));
        for (var k = 0; k <= deep; k++) {
          var yq = py - k;
          if (yq < 0) break;
          var bb = world[idx(x, yq, z)];
          if (bb !== AIR) { b = bb; lastY = yq; shade = 1 - Math.min(0.68, k * 0.17); break; }
        }
        if (b === AIR) hollow = true;      // 밝혔는데 아래가 통째로 비었다 (넓은 방·벼랑)
        // 사람 손이 닿은 자리(갱도) — 자연 동굴 바닥과 색이 12단계밖에 안 달라
        // 걸어 본 갱도가 지도에 아무 자국도 안 남았다 (자문 15차 #5).
        // **내가 지은 것과 가른다** — `touched` 가 그 잣대다 (v83 의 findMine 과 같다).
        if (b !== AIR && !isTouched(x, py - (py - lastY), z) && isMineMat(b)) made = true;
      } else {
        var y = topMap[z * WX + x];
        if (y >= 0) {
          b = world[idx(x, y, z)];
          shade = 0.62 + (y / WY) * 0.72;
          // 굴 어귀는 이제 **칸마다 칠하지 않는다** — 아래에서 덩어리 중심에 점 하나만 찍는다.
          // 등고선 — 일정 높이마다 한 줄씩 어둡게 해 높낮이를 읽게 한다
          if (S.contour && y > SEA) {
            var west = topMap[z * WX + Math.max(0, x - 1)];
            if (Math.floor(y / 4) !== Math.floor(west / 4)) shade *= 0.72;
          }
        }
      }
      // 밝혔는데 아래가 빈 칸 — 안 가 본 곳과 **같은 색이면 안 된다**.
      // 실측 밝혀진 칸의 15~17%가 배경색으로 그려져, "밝힌 것을 기억해 준다" 는
      // 약속이 화면에서 안 지켜졌다 (자문 14차 #8).
      if (b === AIR) {
        if (!hollow) { d[o] = 12; d[o + 1] = 16; d[o + 2] = 20; continue; }
        d[o] = 34; d[o + 1] = 42; d[o + 2] = 50;                 // 지나온 빈 자리 — 흐린 회색
        if (faded) { d[o] = 20; d[o + 1] = 25; d[o + 2] = 30; }
        continue;
      }
      var dim = faded ? 0.45 : 1;
      if (made) {                        // 사람 손이 닿은 자리(갱도) — 따뜻한 나무색
        d[o] = 196 * dim; d[o + 1] = 138 * dim; d[o + 2] = 78 * dim;
        continue;
      }
      var c = AVG_TOP[b] || [120, 120, 120];
      d[o] = Math.min(255, c[0] * shade * dim);
      d[o + 1] = Math.min(255, c[1] * shade * dim);
      d[o + 2] = Math.min(255, c[2] * shade * dim);
    }
  }
  mmCtx.putImageData(mmImage, 0, 0);

  // 표식(B) — 찍어 놓고 화면에 안 보이면 있으나 마나다
  var sx = WX / spanX, sz = WZ / spanZ;

  // 굴 어귀 — **한 어귀당 점 하나.** 덩어리가 클수록 점도 크다.
  // 지하에서는 그 기둥 둘레(±4칸)에 실제로 공기가 있을 때만 찍는다 —
  // 층과 무관한 기둥 성질이라, 안 그러면 25칸 위의 구멍이 발밑 통돌에 찍힌다.
  for (var mo = 0; mo < mouthDots.length; mo++) {
    var md = mouthDots[mo];
    var mdi = md[1] * WX + md[0];
    var mseen = seenMap[mdi] & (S.mmUnder ? SEEN_UNDER_ALL : SEEN_TOP);
    if (!mseen) continue;
    if (S.mmUnder) {
      var hasAir = false;
      for (var ay = Math.max(1, py - 4); ay <= Math.min(WY - 1, py + 4) && !hasAir; ay++)
        if (world[idx(md[0], ay, md[1])] === AIR) hasAir = true;
      if (!hasAir) continue;
    }
    var mdx = (md[0] - x0) * sx, mdz = (md[1] - z0) * sz;
    if (mdx < -2 || mdz < -2 || mdx > WX + 2 || mdz > WZ + 2) continue;
    mmCtx.beginPath();
    mmCtx.arc(mdx, mdz, md[2] >= 24 ? 2.6 : (md[2] >= 8 ? 2.0 : 1.5), 0, Math.PI * 2);
    mmCtx.fillStyle = "#e89640";
    mmCtx.fill();
    mmCtx.lineWidth = 0.8;
    mmCtx.strokeStyle = "rgba(20,14,8,.8)";
    mmCtx.stroke();
  }
  for (var mi = 0; mi < S.marks.length; mi++) {
    var mk = S.marks[mi];
    // marks 는 예전 [x, z] 와 지금 [x, y, z, 이름] 두 모양이다 — markX/markZ 로만 읽는다.
    // (v58 에서 mk[2] 를 직접 읽어 NaN 이 되고 캔버스가 조용히 아무것도 안 그렸다)
    var mxp = (markX(mk) - x0) * sx, mzp = (markZ(mk) - z0) * sz;
    var edge = mxp < 2 || mzp < 2 || mxp > WX - 2 || mzp > WZ - 2;
    mxp = Math.max(2, Math.min(WX - 2, mxp));
    mzp = Math.max(2, Math.min(WZ - 2, mzp));
    mmCtx.beginPath();
    mmCtx.arc(mxp, mzp, edge ? 1.6 : 2.4, 0, Math.PI * 2);
    mmCtx.fillStyle = "#e0c060";
    mmCtx.fill();
    mmCtx.lineWidth = 1;
    mmCtx.strokeStyle = "rgba(255,255,255,.85)";
    mmCtx.stroke();
    // 번호를 옆에 적는다 — 열두 개가 전부 똑같은 금색 점이면
    // "집·채석장·나무농장" 이 구별이 안 돼 다섯 개째부터 찍을 이유가 없어진다
    if (!edge) {
      mmCtx.font = "7px monospace";
      mmCtx.textAlign = "left";
      mmCtx.textBaseline = "middle";
      // 이름을 붙였으면 번호 대신 이름 — 지우면 뒤 번호가 전부 밀려 번호만으로는 못 외운다
      var tag = markName(mk) || String(mi + 1);
      // 지하 단면에서는 **그 표식이 이 층에 있는지**가 이름보다 급하다 —
      // 지하가 26층이 되면서 위층 표식과 아래층 표식이 똑같이 그려졌다 (자문 13차 #10)
      if (S.mmUnder) {
        var dy = markY(mk) - Math.floor(player.pos.y);
        if (dy >= 3) tag += " ▲" + dy;
        else if (dy <= -3) tag += " ▼" + (-dy);
      }
      mmCtx.fillStyle = "rgba(10,14,16,.85)";
      mmCtx.fillText(tag, mxp + 4, mzp + 1);
      mmCtx.fillStyle = "#f0d888";
      mmCtx.fillText(tag, mxp + 3, mzp);
    }
  }

  // 직접 정한 시작 지점(V) — 집 자리를 찍어 놨는데 지도에 안 나오면 찍은 보람이 없다
  if (S.spawnPoint) {
    var hx = (S.spawnPoint[0] - x0) * sx, hz = (S.spawnPoint[2] - z0) * sz;
    if (hx > -2 && hz > -2 && hx < WX + 2 && hz < WZ + 2) {
      mmCtx.beginPath();
      mmCtx.arc(Math.max(2, Math.min(WX - 2, hx)), Math.max(2, Math.min(WZ - 2, hz)), 2.6, 0, Math.PI * 2);
      mmCtx.fillStyle = "#5aa8e0";
      mmCtx.fill();
      mmCtx.lineWidth = 1;
      mmCtx.strokeStyle = "rgba(255,255,255,.9)";
      mmCtx.stroke();
    }
  }

  var px = (player.pos.x - x0) * (WX / spanX);
  var pz = (player.pos.z - z0) * (WZ / spanZ);
  var arrow = 3.2 * Math.min(3, zoom);
  var dirX = -Math.sin(player.yaw), dirZ = -Math.cos(player.yaw);
  mmCtx.fillStyle = "#e07a3a";
  mmCtx.beginPath();
  mmCtx.moveTo(px + dirX * arrow, pz + dirZ * arrow);
  mmCtx.lineTo(px - dirZ * (arrow * 0.62) - dirX * (arrow * 0.44),
               pz + dirX * (arrow * 0.62) - dirZ * (arrow * 0.44));
  mmCtx.lineTo(px + dirZ * (arrow * 0.62) - dirX * (arrow * 0.44),
               pz - dirX * (arrow * 0.62) - dirZ * (arrow * 0.44));
  mmCtx.closePath();
  mmCtx.fill();
}


// 시작 화면 오른쪽 위 — 마지막 업데이트가 언제인지 한눈에 보이게
export var stampEl = document.getElementById("stamp");
if (stampEl) {
  stampEl.innerHTML = "마지막 업데이트 <b>" + BUILD.updated + "</b>";
  stampEl.title = BUILD.iso;
}

// ── 조작 도움말 (H)
export var helpEl = document.getElementById("help");
// 도움말도 목록·명령창과 같이 **마우스 잠금을 풀고 S.uiOpen 을 세운다.**
// 안 그러면 판 뒤에서 시점이 계속 돌고, 왼쪽을 누르면 안 보이는 블록이 캐지고,
// 휠은 핫바를 넘긴다 — 조작을 배우려다 자기 집을 뚫는다.
// 튜토리얼 마지막 줄이 "H 를 누르면 나머지 조작이 전부 나옵니다" 인데 그 화면이 그랬다.
// 도움말이 열려 있나 — 여러 곳에서 "지금 어느 창이 열렸나" 를 물어본다
export function helpOpen() { return !!(helpEl && !helpEl.hidden); }
export function toggleHelp(on) {
  if (!helpEl) return;
  var want = on === undefined ? helpEl.hidden : on;
  helpEl.hidden = !want;
  S.uiOpen = want;
  if (want) {
    if (document.pointerLockElement === canvas) document.exitPointerLock();
  } else if (S.active && S.lockMode && canvas.requestPointerLock) {
    try { canvas.requestPointerLock(); } catch (e) {}
  }
}
if (helpEl) helpEl.addEventListener("click", function (e) {
  if (e.target === helpEl) toggleHelp(false);         // 바깥을 눌렀을 때만 닫는다
});

// 도움말 안에서 도전 과제도 볼 수 있게 — 지금까지는 메뉴에만 있었다
export var helpAchBtn = document.getElementById("help-ach");
export var helpAchList = document.getElementById("help-achlist");
// 조작 안내는 키보드용·터치용 두 벌이다 (자문 12차 #6) — querySelector 하나만 잡으면
// 도전 과제 탭으로 넘어갔을 때 나머지 한 벌이 그대로 남는다
export var helpCols = helpEl ? helpEl.querySelectorAll(".help-cols") : [];
export function setHelpTab(showAch) {
  if (!helpCols.length || !helpAchList) return;
  for (var hc = 0; hc < helpCols.length; hc++) helpCols[hc].hidden = showAch;
  helpAchList.hidden = !showAch;
  if (helpAchBtn) helpAchBtn.textContent = showAch ? "조작 보기" : "도전 과제 보기";
}
if (helpAchBtn) helpAchBtn.addEventListener("click", function (e) {
  e.stopPropagation();
  setHelpTab(helpAchList.hidden);
});

// ── 첫 로딩 화면 — 세계를 만들고 굽는 동안 멈춘 것처럼 보이지 않게
export var bootEl = document.getElementById("boot");
export var bootMsg = document.getElementById("boot-msg");
export var bootBar = document.getElementById("boot-bar");
export function bootProgress(msg, frac) {
  if (!bootEl) return;
  if (msg && bootMsg) bootMsg.textContent = msg;
  if (bootBar) bootBar.style.width = Math.round(Math.max(0, Math.min(1, frac)) * 100) + "%";
}
export function bootDone() {
  if (!bootEl) return;
  bootEl.classList.add("done");
  setTimeout(function () { bootEl.style.display = "none"; }, 400);
}

// ── 블록 목록 걸러 보기
export var pickFind = document.getElementById("pick-find");
export var pickTabs = document.getElementById("pick-tabs");
export var pickCat = "all";
// 최근 쓴 블록 — 목록을 열면 맨 앞에 온다
export function noteBlockUse(b) {
  var i = S.recent.indexOf(b);
  if (i >= 0) S.recent.splice(i, 1);
  S.recent.unshift(b);
  if (S.recent.length > 12) S.recent.length = 12;
}
export function sortPickByRecent() {
  var order = pickBtns.slice().sort(function (a, b) {
    var ai = S.recent.indexOf(a.block), bi = S.recent.indexOf(b.block);
    if (ai < 0) ai = 999;
    if (bi < 0) bi = 999;
    return ai - bi;
  });
  for (var i = 0; i < order.length; i++) pickGrid.appendChild(order[i].el);
}

export function refreshPickFilter() {
  var q = (pickFind && pickFind.value || "").trim().toLowerCase();
  var shown = 0;
  for (var i = 0; i < pickBtns.length; i++) {
    var e = pickBtns[i];
    var ok = (pickCat === "all" || e.cat === pickCat) &&
             (!q || e.name.toLowerCase().indexOf(q) >= 0);
    e.el.hidden = !ok;
    if (ok) shown++;
  }
  return shown;
}
if (pickFind) pickFind.addEventListener("input", refreshPickFilter);
if (pickTabs) pickTabs.addEventListener("click", function (ev) {
  var btn = ev.target.closest("button[data-cat]");
  if (!btn) return;
  pickCat = btn.getAttribute("data-cat");
  var bs = pickTabs.querySelectorAll("button");
  for (var i = 0; i < bs.length; i++)
    bs[i].setAttribute("aria-current", bs[i] === btn ? "true" : "false");
  refreshPickFilter();
});

// ── 명령창 — 한 줄로 세계를 조작한다 (`/` 로 연다)
export var cmdEl = document.getElementById("cmd");
export var cmdIn = document.getElementById("cmd-in");
export var cmdMsg = document.getElementById("cmd-msg");
export function openCmd() {
  if (!cmdEl) return;
  cmdEl.hidden = false;
  cmdIn.value = "";
  if (cmdMsg) cmdMsg.textContent = "";
  cmdIn.focus();
}
export function closeCmd() {
  if (!cmdEl) return;
  cmdEl.hidden = true;
  cmdIn.blur();
}
export function cmdSay(msg) { if (cmdMsg) cmdMsg.textContent = msg; }

// ── 시작 화면 세계 미리보기 — 어떤 섬인지 들어가기 전에 보인다
export var previewEl = document.getElementById("preview");
export var previewCap = document.getElementById("preview-cap");
// target 을 주면 그 캔버스에 그린다 — 시작 화면의 "이어서 짓던 곳" 이 같은 그림을 쓴다
export function drawPreview(target) {
  var into = target || previewEl;
  if (!into) return;
  var c = into.getContext("2d");
  var img = c.createImageData(WX, WZ);
  var d = img.data;
  var land = 0, high = 0;
  for (var z = 0; z < WZ; z++) for (var x = 0; x < WX; x++) {
    var o = (z * WX + x) * 4;
    var y = topMap[z * WX + x];
    d[o + 3] = 255;
    if (y < 0) { d[o] = 12; d[o + 1] = 16; d[o + 2] = 20; continue; }
    if (y > SEA) land++;
    // "산" 은 해수면에서 얼마나 솟았느냐다 — 24 로 못 박아 두면 판 2(바다 23)에서
    // 평지도 전부 산이 되어, 어느 시드를 뽑아도 캡션이 "산 90%" 로 굳는다.
    if (y > SEA + 13) high++;
    var b = world[idx(x, y, z)];
    var col = AVG_TOP[b] || [120, 120, 120];
    var sh = 0.6 + (y / WY) * 0.8;
    d[o] = Math.min(255, col[0] * sh);
    d[o + 1] = Math.min(255, col[1] * sh);
    d[o + 2] = Math.min(255, col[2] * sh);
  }
  into.width = WX; into.height = WZ;
  c.putImageData(img, 0, 0);
  if (!target && previewCap) {
    previewCap.innerHTML = "SEED <b>" + S.worldSeed + "</b><br>" +
      "육지 " + Math.round(land / (WX * WZ) * 100) + "% · 산 " +
      Math.round(high / Math.max(1, land) * 100) + "%<br>" +
      ["보통", "평지", "산악", "군도"][S.terrain | 0];
  }
}
