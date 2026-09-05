// hud.js — HUD · 핫바 · 블록 고르기 · 미니맵
import { S } from "./state.js";
import { BUILD } from "./version.js";
import { SEA, WX, WY, WZ, idx } from "./dims.js";
import { AIR, ALL_BLOCKS, GLASS, NAMES, TILES, WATER, categoryOf, isCross } from "./blocks.js";
import { AVG_TOP, TILE, atlas, tileOrigin } from "./atlas.js";
import { topMap, world } from "./world.js";
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
    slot.appendChild(key); slot.appendChild(cv); slot.appendChild(name);
    slot.addEventListener("click", function (e) { e.preventDefault(); selectSlot(i); });
    hotbarEl.appendChild(slot);
    slotCanvases.push(cv);
  })(si);
}

export function refreshSlot(i) {
  var b = S.bar[i];
  drawIcon(slotCanvases[i], b);
  var slot = hotbarEl.children[i];
  slot.setAttribute("aria-label", NAMES[b]);
  slot.querySelector(".name").textContent = NAMES[b];
}
export function refreshBar() {
  for (var i = 0; i < S.bar.length; i++) refreshSlot(i);
  updateHandBlock();
}
export function selectSlot(i) {
  S.selected = ((i % S.bar.length) + S.bar.length) % S.bar.length;
  for (var k = 0; k < hotbarEl.children.length; k++) {
    hotbarEl.children[k].setAttribute("aria-current", k === S.selected ? "true" : "false");
  }
  updateHandBlock();
}

// ── 블록 고르기 패널
export var pickerEl = document.getElementById("picker");
export var pickGrid = document.getElementById("pick-grid");

export var pickBtns = [];
ALL_BLOCKS.forEach(function (b) {
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
    S.bar[S.selected] = b;
    refreshSlot(S.selected);
    updateHandBlock();
    S.worldDirty = true;
    closePicker(true);
    toast(NAMES[b]);
  });
  pickGrid.appendChild(btn);
  pickBtns.push({ el: btn, block: b, name: NAMES[b] || "", cat: categoryOf(b) });
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
export var tPos = document.getElementById("t-pos"),
    tTime = document.getElementById("t-time"),
    tLight = document.getElementById("t-light"),
    tMode = document.getElementById("t-mode"),
    tBlocks = document.getElementById("t-blocks"),
    tShape = document.getElementById("t-shape"),
    tFps = document.getElementById("t-fps");

export var underwaterEl = document.getElementById("underwater");
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

export function drawMinimap() {
  var d = mmImage.data;
  var pxc = Math.max(0, Math.min(WX - 1, Math.floor(player.pos.x)));
  var pzc = Math.max(0, Math.min(WZ - 1, Math.floor(player.pos.z)));
  var py = Math.max(0, Math.min(WY - 1, Math.floor(player.pos.y)));
  S.mmUnder = topMap[pzc * WX + pxc] > player.pos.y + 2.5;

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
      var b = AIR, shade = 1;
      if (S.mmUnder) {
        // 지하에서는 지금 높이의 단면을 본다
        for (var k = 0; k <= 4; k++) {
          var yq = py - k;
          if (yq < 0) break;
          var bb = world[idx(x, yq, z)];
          if (bb !== AIR) { b = bb; shade = 1 - k * 0.17; break; }
        }
      } else {
        var y = topMap[z * WX + x];
        if (y >= 0) {
          b = world[idx(x, y, z)];
          shade = 0.62 + (y / WY) * 0.72;
          // 등고선 — 일정 높이마다 한 줄씩 어둡게 해 높낮이를 읽게 한다
          if (S.contour && y > SEA) {
            var west = topMap[z * WX + Math.max(0, x - 1)];
            if (Math.floor(y / 4) !== Math.floor(west / 4)) shade *= 0.72;
          }
        }
      }
      if (b === AIR) { d[o] = 12; d[o + 1] = 16; d[o + 2] = 20; continue; }
      var c = AVG_TOP[b] || [120, 120, 120];
      d[o] = Math.min(255, c[0] * shade);
      d[o + 1] = Math.min(255, c[1] * shade);
      d[o + 2] = Math.min(255, c[2] * shade);
    }
  }
  mmCtx.putImageData(mmImage, 0, 0);

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
export function toggleHelp(on) {
  if (!helpEl) return;
  var want = on === undefined ? helpEl.hidden : on;
  helpEl.hidden = !want;
}
if (helpEl) helpEl.addEventListener("click", function () { helpEl.hidden = true; });

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
