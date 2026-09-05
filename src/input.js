// input.js — 입력 (키보드 · 마우스 · 터치)
import { S } from "./state.js";
import { IS_TOUCH } from "./boot.js";
import { NAMES } from "./blocks.js";
import { camera, crackMesh, renderer } from "./scene.js";
import { applyTime } from "./daynight.js";
import { applyOpts, opts, saveOpts } from "./settings.js";
import { player, raycast } from "./player.js";
import { ac, startAmbient, tone } from "./audio.js";
import { hasSave, saveGame } from "./save.js";
import { redo, refreshStats, undo } from "./edit.js";
import { closePicker, openPicker, refreshSlot, selectSlot, showHud, toast } from "./hud.js";
import { handCam, updateHandBlock } from "./hand.js";
import { place } from "./mine.js";
import { setWeather } from "./sky.js";
import { newWorld } from "./loop.js";

export var overlay = document.getElementById("overlay");
export var goBtn = document.getElementById("go");
export var altBtn = document.getElementById("alt");
export var seedIn = document.getElementById("seedin");
export var canvas = renderer.domElement;

export var isTouch = IS_TOUCH || window.matchMedia("(hover: none)").matches ||
              (navigator.maxTouchPoints || 0) > 0;
if (isTouch) {
  document.getElementById("touchwarn").hidden = false;
  document.getElementById("fineprint").hidden = true;
}

export var HINT_LOCK = '좌클릭 <b>길게 눌러 캐기</b> · 우클릭 <b>놓기</b> · <b>Shift</b> 웅크리기 · <b>Ctrl</b> 달리기 · <b>E</b> 블록 목록 · <b>휠클릭</b> 복사 · <b>Ctrl+Z</b> 되돌리기 · <b>F</b> 비행 · <b>ESC</b> 메뉴';
export var HINT_DRAG = '드래그 <b>둘러보기</b> · 제자리 좌클릭 길게 <b>캐기</b> · 우클릭 <b>놓기</b> · <b>E</b> 블록 목록 · <b>Ctrl+Z</b> 되돌리기 · <b>ESC</b> 메뉴';
export var hintEl = document.getElementById("hint");

export var TUT = [
  '먼저 <b>좌클릭을 길게</b> 눌러 블록을 캐보세요',
  '이번엔 <b>우클릭</b>으로 블록을 놓아보세요',
  '<b>E</b> 를 눌러 블록 목록에서 다른 재료를 골라보세요',
  '<b>G</b> 로 반블록·계단으로 바꿔 지어보세요'
];
export function refreshHint() {
  hintEl.innerHTML = S.tut < TUT.length ? TUT[S.tut] : (S.lockMode ? HINT_LOCK : HINT_DRAG);
}
export function advanceTut(step) {
  if (S.tut !== step) return;
  S.tut = step + 1;
  S.worldDirty = true;
  refreshHint();
}


export function refreshMenu() {
  if (S.started) goBtn.textContent = "계속하기";
  else if (hasSave()) goBtn.textContent = "이어하기";
  else goBtn.textContent = "CLICK TO PLAY";
  altBtn.textContent = "새 세계";
}

export function beginPlay() {
  if (S.active) return;
  if (!S.started) {
    S.started = true;
    if (S.savedPos) {
      player.pos.copy(S.savedPos);
      player.yaw = S.savedYaw; player.pitch = S.savedPitch;
    }
  }
  S.active = true;
  overlay.hidden = true;
  showHud(true);
  refreshHint();
  canvas.style.cursor = S.lockMode ? "none" : "grab";
  refreshMenu();
}

export function endPlay() {
  if (!S.active) return;
  S.active = false;
  S.keys = Object.create(null);
  S.mouseDown[0] = S.mouseDown[1] = S.mouseDown[2] = false;
  S.dragging = false; S.touchBreak = false;
  S.stick.x = 0; S.stick.z = 0;
  S.breaking.on = false;
  crackMesh.visible = false;
  closePicker(false);
  overlay.hidden = false;
  showHud(false);
  canvas.style.cursor = "";
  refreshMenu();
  refreshStats();
  if (S.worldDirty) saveGame();
  if (document.pointerLockElement === canvas) document.exitPointerLock();
}

export function useDragMode() { S.lockMode = false; beginPlay(); }

export function goFullscreen() {
  if (!IS_TOUCH) return;
  var el = document.documentElement;
  var fn = el.requestFullscreen || el.webkitRequestFullscreen;
  if (!fn || document.fullscreenElement) return;
  try {
    var pr = fn.call(el, { navigationUI: "hide" });
    if (pr && typeof pr.catch === "function") pr.catch(function () {});
  } catch (e) {}
  if (screen.orientation && screen.orientation.lock) {
    try {
      var lp = screen.orientation.lock("landscape");
      if (lp && typeof lp.catch === "function") lp.catch(function () {});
    } catch (e2) {}
  }
}

export function requestPlay() {
  ac();
  startAmbient();
  goFullscreen();
  if (isTouch || !S.lockMode || !canvas.requestPointerLock) { useDragMode(); return; }
  var p;
  try { p = canvas.requestPointerLock(); }
  catch (err) { useDragMode(); return; }
  if (p && typeof p.catch === "function") p.catch(useDragMode);
  setTimeout(function () { if (!S.active) useDragMode(); }, 400);
}

goBtn.addEventListener("click", function (e) { e.stopPropagation(); requestPlay(); });
altBtn.addEventListener("click", function (e) {
  e.stopPropagation();
  var raw = (seedIn.value || "").trim();
  var seed = raw === "" ? ((Math.random() * 100000) | 0) : hashSeed(raw);
  newWorld(seed);
  requestPlay();
});
document.querySelector(".card").addEventListener("click", function (e) { e.stopPropagation(); });
overlay.addEventListener("click", requestPlay);

export function hashSeed(str) {
  if (/^\d+$/.test(str)) return parseInt(str, 10) % 1000000;
  var h = 2166136261;
  for (var i = 0; i < str.length; i++) {
    h ^= str.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  return (h >>> 0) % 1000000;
}

document.addEventListener("pointerlockerror", useDragMode);
document.addEventListener("pointerlockchange", function () {
  if (document.pointerLockElement === canvas) {
    S.lockMode = true;
    beginPlay();
    refreshHint();
    canvas.style.cursor = "none";
  } else if (S.lockMode && !S.uiOpen) {
    endPlay();
  }
});

export function applyLook(dx, dy) {
  var s = 0.0022 * (opts.sens / 100);
  player.yaw -= dx * s;
  player.pitch -= dy * s * (opts.invertY ? -1 : 1);
  var lim = Math.PI / 2 - 0.001;
  player.pitch = Math.max(-lim, Math.min(lim, player.pitch));
}

document.addEventListener("mousemove", function (e) {
  if (!S.active || S.uiOpen) return;
  var dx = e.movementX || 0, dy = e.movementY || 0;
  if (S.lockMode) {
    if (document.pointerLockElement !== canvas) return;
    applyLook(dx, dy);
  } else if (S.dragging) {
    applyLook(dx, dy);
    S.dragDist += Math.abs(dx) + Math.abs(dy);
  }
});

export function cycleTime() {
  var quarters = [0.26, 0.50, 0.74, 0.98];
  var labels = ["아침", "정오", "노을", "한밤"];
  var next = quarters[0], label = labels[0];
  for (var i = 0; i < quarters.length; i++) {
    if (S.timeOfDay < quarters[i] - 0.001) { next = quarters[i]; label = labels[i]; break; }
  }
  S.timeOfDay = next;
  applyTime();
  toast(label);
}

export function pickBlock() {
  var hit = raycast(6);
  if (!hit) return;
  if (S.bar[S.selected] === hit.block) { toast(NAMES[hit.block]); return; }
  S.bar[S.selected] = hit.block;
  refreshSlot(S.selected);
  updateHandBlock();
  S.worldDirty = true;
  toast(NAMES[hit.block] + " 복사");
  tone(880, 0.07, "triangle", 0.04);
}

window.addEventListener("keydown", function (e) {
  if (e.target === seedIn) return;                 // 시드 입력 중에는 조작키를 막는다
  var held = e.repeat || !!S.keys[e.code];
  S.keys[e.code] = true;

  // 마크식 달리기 — W 를 두 번 톡톡
  if (!held && (e.code === "KeyW" || e.code === "ArrowUp")) {
    var nowMs = (window.performance && performance.now) ? performance.now() : Date.now();
    if (nowMs - S.lastFwdTap < 280) S.sprintTap = true;
    S.lastFwdTap = nowMs;
  }

  if (e.code === "Escape") {
    if (S.uiOpen) { closePicker(true); return; }
    if (!S.lockMode && S.active) { endPlay(); return; }
    return;
  }
  if (!S.active) return;

  if (e.code === "KeyE") { e.preventDefault(); if (S.uiOpen) closePicker(true); else openPicker(); return; }
  if (S.uiOpen) return;

  if (e.ctrlKey || e.metaKey) {
    if (e.code === "KeyZ") {
      e.preventDefault();
      var ok = e.shiftKey ? redo() : undo();
      toast(ok ? (e.shiftKey ? "다시하기" : "되돌리기") : "더 없음");
      return;
    }
    if (e.code === "KeyY") { e.preventDefault(); toast(redo() ? "다시하기" : "더 없음"); return; }
    return;
  }

  if (e.code.indexOf("Digit") === 0) {
    var n = parseInt(e.code.slice(5), 10);
    selectSlot(n === 0 ? 9 : n - 1);
  }
  if (e.code === "KeyQ") pickBlock();
  if (e.code === "KeyF") {
    player.flying = !player.flying; player.vel.y = 0;
    tone(player.flying ? 660 : 330, 0.09, "square", 0.05);
    toast(player.flying ? "비행 모드" : "걷기 모드");
  }
  if (e.code === "KeyG") {
    S.shapeMode = (S.shapeMode + 1) % 3;
    updateHandBlock();
    toast(["전체 블록", "반블록", "계단"][S.shapeMode]);
    tone(560 + S.shapeMode * 120, 0.06, "square", 0.04);
    advanceTut(3);
  }
  if (e.code === "KeyT") cycleTime();
  if (e.code === "KeyK") {
    setWeather((S.weather + 1) % 3);
    S.weatherTimer = 90 + Math.random() * 60;
    toast(["맑음", "비", "눈"][S.weather]);
  }
  if (e.code === "KeyM") {
    S.muted = !S.muted;
    if (!S.muted) tone(520, 0.08, "square", 0.05);
    toast(S.muted ? "소리 끔" : "소리 켬");
  }
  if (e.code === "KeyR") {
    var nowR = (window.performance && performance.now) ? performance.now() : Date.now();
    if (nowR - S.lastRTap < 2200) {
      S.lastRTap = 0;
      newWorld((Math.random() * 100000) | 0);
    } else {
      S.lastRTap = nowR;
      toast("새 세계를 만들려면 R 을 한 번 더");
    }
  }
  if (e.code === "Space" || e.code.indexOf("Arrow") === 0) e.preventDefault();
});
window.addEventListener("keyup", function (e) {
  S.keys[e.code] = false;
  if (e.code === "KeyW" || e.code === "ArrowUp") S.sprintTap = false;
});

window.addEventListener("wheel", function (e) {
  if (!S.active || S.uiOpen) return;
  selectSlot(S.selected + (e.deltaY > 0 ? 1 : -1));
}, { passive: true });

canvas.addEventListener("contextmenu", function (e) { e.preventDefault(); });

canvas.addEventListener("mousedown", function (e) {
  if (!S.active) { requestPlay(); return; }
  if (S.uiOpen) return;
  if (e.button === 1) { e.preventDefault(); pickBlock(); return; }   // 휠 클릭 = 픽블록
  if (S.lockMode) {
    S.mouseDown[e.button] = true;
    if (e.button === 2) S.placeCooldown = 0;
  } else {
    S.dragging = true; S.dragBtn = e.button; S.dragDist = 0; S.dragStart = performance.now();
    canvas.style.cursor = "grabbing";
    e.preventDefault();
  }
});

window.addEventListener("mouseup", function (e) {
  if (S.lockMode) { S.mouseDown[e.button] = false; return; }
  if (!S.dragging || e.button !== S.dragBtn) return;
  S.dragging = false;
  canvas.style.cursor = S.active ? "grab" : "";
  if (S.active && !S.uiOpen && S.dragDist < 7 && performance.now() - S.dragStart < 450 && S.dragBtn === 2) place();
  S.dragBtn = -1;
});

// ── 터치 조작
export var lookLast = { x: 0, y: 0 };
export var stickZone = document.getElementById("stickzone");
export var stickBase = document.getElementById("stickbase");
export var stickKnob = document.getElementById("stickknob");
export var STICK_R = 52;

export function setStick(dx, dy) {
  var len = Math.hypot(dx, dy);
  if (len > STICK_R) { dx = dx / len * STICK_R; dy = dy / len * STICK_R; len = STICK_R; }
  stickKnob.style.transform = "translate(" + dx + "px," + dy + "px)";
  S.stick.x = dx / STICK_R;
  S.stick.z = -dy / STICK_R;
}

stickZone.addEventListener("touchstart", function (e) {
  if (!S.active) return;
  var t = e.changedTouches[0];
  S.stickId = t.identifier;
  stickBase.style.left = t.clientX + "px";
  stickBase.style.top = t.clientY + "px";
  stickBase.classList.add("on");
  setStick(0, 0);
  e.preventDefault();
}, { passive: false });

window.addEventListener("touchmove", function (e) {
  if (!S.active) return;
  for (var i = 0; i < e.changedTouches.length; i++) {
    var t = e.changedTouches[i];
    if (t.identifier === S.stickId) {
      setStick(t.clientX - parseFloat(stickBase.style.left),
               t.clientY - parseFloat(stickBase.style.top));
      e.preventDefault();
    } else if (t.identifier === S.lookId) {
      applyLook((t.clientX - lookLast.x) * 1.6, (t.clientY - lookLast.y) * 1.6);
      lookLast.x = t.clientX; lookLast.y = t.clientY;
      e.preventDefault();
    }
  }
}, { passive: false });

export function endTouch(e) {
  for (var i = 0; i < e.changedTouches.length; i++) {
    var t = e.changedTouches[i];
    if (t.identifier === S.stickId) {
      S.stickId = null; S.stick.x = 0; S.stick.z = 0;
      stickBase.classList.remove("on");
      stickKnob.style.transform = "";
    } else if (t.identifier === S.lookId) {
      S.lookId = null;
    }
  }
}
window.addEventListener("touchend", endTouch);
window.addEventListener("touchcancel", endTouch);

canvas.addEventListener("touchstart", function (e) {
  if (!S.active) { requestPlay(); e.preventDefault(); return; }
  if (S.uiOpen) return;
  var t = e.changedTouches[0];
  if (S.lookId === null && t.clientX > window.innerWidth * 0.42) {
    S.lookId = t.identifier;
    lookLast.x = t.clientX; lookLast.y = t.clientY;
    e.preventDefault();
  }
}, { passive: false });

export function bindHold(id, onDown, onUp) {
  var el = document.getElementById(id);
  el.addEventListener("touchstart", function (e) { e.preventDefault(); el.classList.add("on"); onDown(); }, { passive: false });
  el.addEventListener("touchend", function (e) { e.preventDefault(); el.classList.remove("on"); if (onUp) onUp(); }, { passive: false });
  el.addEventListener("touchcancel", function () { el.classList.remove("on"); if (onUp) onUp(); });
}
bindHold("tb-mine", function () { S.touchBreak = true; }, function () { S.touchBreak = false; });
bindHold("tb-place", function () { place(); });
bindHold("tb-jump", function () { S.keys.Space = true; }, function () { S.keys.Space = false; });
bindHold("tb-fly", function () {
  player.flying = !player.flying; player.vel.y = 0;
  toast(player.flying ? "비행 모드" : "걷기 모드");
});

window.addEventListener("resize", function () {
  camera.aspect = window.innerWidth / window.innerHeight;
  camera.updateProjectionMatrix();
  handCam.aspect = camera.aspect;
  handCam.fov = camera.aspect < 1 ? 74 : 52;
  handCam.updateProjectionMatrix();
  renderer.setSize(window.innerWidth, window.innerHeight);
});

window.addEventListener("beforeunload", function () { if (S.worldDirty) saveGame(); });
document.addEventListener("visibilitychange", function () {
  if (document.hidden && S.worldDirty) saveGame();
});

// ── 설정 UI
export function bindOpt(inputId, outId, key, fmt) {
  var el = document.getElementById(inputId), out = document.getElementById(outId);
  el.value = opts[key];
  out.textContent = fmt(opts[key]);
  el.addEventListener("input", function () {
    opts[key] = parseFloat(el.value);
    out.textContent = fmt(opts[key]);
    applyOpts();
    saveOpts();
  });
  el.addEventListener("click", function (e) { e.stopPropagation(); });
}
bindOpt("s-sens", "o-sens", "sens", function (v) { return v + "%"; });
bindOpt("s-fov", "o-fov", "fov", function (v) { return v + "°"; });
bindOpt("s-far", "o-far", "far", function (v) { return v + "m"; });
bindOpt("s-vol", "o-vol", "vol", function (v) { return v + "%"; });
bindOpt("s-day", "o-day", "day", function (v) { return v === 0 ? "고정" : v + "분"; });
(function bindInvert() {
  var el = document.getElementById("s-inv"), out = document.getElementById("o-inv");
  el.checked = !!opts.invertY;
  out.textContent = opts.invertY ? "켬" : "끔";
  el.addEventListener("change", function () {
    opts.invertY = el.checked ? 1 : 0;
    out.textContent = opts.invertY ? "켬" : "끔";
    saveOpts();
  });
  el.addEventListener("click", function (e) { e.stopPropagation(); });
})();
