// input.js — 입력 (키보드 · 마우스 · 터치)
import { S } from "./state.js";
import { markAllDirty, buildBudget } from "./mesh.js";
import { relightAll } from "./light.js";
import { IS_TOUCH } from "./boot.js";
import { NAMES } from "./blocks.js";
import { camera, crackMesh, renderer } from "./scene.js";
import { applyTime } from "./daynight.js";
import { applyOpts, opts, saveOpts } from "./settings.js";
import { player, raycast, spawn, stats } from "./player.js";
import { ac, startAmbient, tone } from "./audio.js";
import { SLOTS, exportWorld, hasBackup, hasSave, importWorldText, loadGame, restoreBackup, saveGame, slotInfo } from "./save.js";
import { checkToken, isLinked, listWorlds, normalizeName, pullWorld, pushWorld, setToken, setWorldName, unlink, worldName } from "./cloud.js";
import { REGION_MAX, clearSelection, completeCommand, copySelection, fillSelection, pasteClip, redo, refreshAchList, refreshStats, runCommand, selectionSize, undo, unlock } from "./edit.js";
import { closeCmd, closePicker, cmdIn, cmdSay, drawMinimap, drawPreview, openCmd, openPicker, perfEl, refreshBar, refreshSlot, selectSlot, setHelpTab, showHud, toast, toggleHelp } from "./hud.js";
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

export var HINT_LOCK = '좌클릭 <b>길게 눌러 캐기</b> · 우클릭 <b>놓기</b> · <b>Shift</b> 웅크리기 · <b>Ctrl</b> 달리기 · <b>E</b> 블록 목록 · <b>휠클릭</b> 복사 · <b>Ctrl+Z</b> 되돌리기 · <b>{fly}</b> 비행 · <b>ESC</b> 메뉴';
export var HINT_DRAG = '드래그 <b>둘러보기</b> · 제자리 좌클릭 길게 <b>캐기</b> · 우클릭 <b>놓기</b> · <b>E</b> 블록 목록 · <b>Ctrl+Z</b> 되돌리기 · <b>ESC</b> 메뉴';
export var hintEl = document.getElementById("hint");

export var TUT = [
  '먼저 <b>좌클릭을 길게</b> 눌러 블록을 캐보세요',
  '이번엔 <b>우클릭</b>으로 블록을 놓아보세요',
  '<b>E</b> 를 눌러 블록 목록에서 다른 재료를 골라보세요',
  '<b>G</b> 로 반블록·계단으로 바꿔 지어보세요',
  '<b>9</b> 번 <b>횃불</b>로 어두운 굴을 밝혀보세요',
  '<b>Alt</b>+클릭으로 영역을 고르고 <b>Ctrl</b>+<b>F</b> 로 한 번에 채워보세요',
  '<b>H</b> 를 누르면 나머지 조작이 전부 나옵니다'
];
export function refreshHint() {
  hintEl.innerHTML = S.tut < TUT.length ? TUT[S.tut] : hintText(S.lockMode ? HINT_LOCK : HINT_DRAG);
}
export function advanceTut(step) {
  if (S.tut !== step) return;
  S.tut = step + 1;
  S.worldDirty = true;
  refreshHint();
}


// 저장 슬롯 — 세계를 셋까지 따로 둔다
export var slotsEl = document.getElementById("slots");
export function refreshSlots() {
  if (!slotsEl) return;
  var html = "";
  for (var n = 1; n <= SLOTS; n++) {
    var info = slotInfo(n);
    html += '<button type="button" data-slot="' + n + '" aria-current="' +
            (S.slot === n ? "true" : "false") + '"><b>' + n + '</b>' +
            (info ? ("SEED " + info.seed + " · " + info.mins + "분") : "비어 있음") +
            '</button>';
  }
  slotsEl.innerHTML = html;
}
if (slotsEl) {
  slotsEl.addEventListener("click", function (e) {
    var btn = e.target.closest("button[data-slot]");
    if (!btn) return;
    e.stopPropagation();
    var n = parseInt(btn.getAttribute("data-slot"), 10);
    if (n === S.slot) return;
    if (S.worldDirty) saveGame();
    S.slot = n;
    if (hasSave() && loadGame()) {
      relightAll(false); markAllDirty(); buildBudget(70);
      spawn();
      if (S.savedPos) { S.savedPos.copy(player.pos); S.savedYaw = player.yaw; S.savedPitch = player.pitch; }
      toast("슬롯 " + n + " 을 불러왔습니다");
    } else {
      newWorld((Math.random() * 100000) | 0);
      toast("슬롯 " + n + " · 새 세계");
    }
    refreshSlots();
    refreshMenu();
    refreshStats();
  });
}

// 지금 세계의 시드를 클립보드로
export var copySeedBtn = document.getElementById("copyseed");
if (copySeedBtn) {
  copySeedBtn.addEventListener("click", function (e) {
    e.stopPropagation();
    var txt = String(S.worldSeed);
    seedIn.value = txt;
    try {
      if (navigator.clipboard) navigator.clipboard.writeText(txt);
      else { seedIn.select(); document.execCommand("copy"); }
      toast("시드 " + txt + " 복사됨");
    } catch (err) { toast("시드 " + txt); }
  });
}

// ── 세계 파일 · 백업
export var expBtn = document.getElementById("w-export");
export var impBtn = document.getElementById("w-import");
export var resBtn = document.getElementById("w-restore");
export var fileIn = document.getElementById("w-file");

function afterWorldSwap(msg) {
  relightAll(false); markAllDirty(); buildBudget(70);
  spawn();
  if (S.savedPos) { S.savedPos.copy(player.pos); S.savedYaw = player.yaw; S.savedPitch = player.pitch; }
  refreshBar(); refreshSlots(); refreshMenu(); refreshStats(); refreshAchList();
  drawMinimap();
  toast(msg);
}

if (expBtn) expBtn.addEventListener("click", function (e) {
  e.stopPropagation();
  toast(exportWorld() ? "세계를 파일로 내보냈습니다" : "내보낼 세계가 없습니다");
});
if (impBtn) impBtn.addEventListener("click", function (e) { e.stopPropagation(); fileIn.click(); });
if (fileIn) fileIn.addEventListener("change", function () {
  var f = fileIn.files && fileIn.files[0];
  if (!f) return;
  var rd = new FileReader();
  rd.onload = function () {
    var err = importWorldText(String(rd.result));
    fileIn.value = "";
    if (err) { toast(err); return; }
    afterWorldSwap("세계를 가져왔습니다");
  };
  rd.readAsText(f);
});
if (resBtn) resBtn.addEventListener("click", function (e) {
  e.stopPropagation();
  if (!hasBackup()) { toast("되돌릴 백업이 없습니다"); return; }
  if (restoreBackup()) afterWorldSwap("직전 저장으로 되돌렸습니다");
  else toast("백업을 읽지 못했습니다");
});

// ── 클라우드 이어하기 — 기기가 달라도 같은 세계를 잇는다
// DOM 은 여기서 직접 잡는다 (모듈 순환에 걸려 조용히 건너뛰는 사고를 피한다 · v17)
var cTok = document.getElementById("c-token");
var cWorld = document.getElementById("c-world");
var cState = document.getElementById("c-state");
var cConnect = document.getElementById("c-connect");
var cPush = document.getElementById("c-push");
var cPull = document.getElementById("c-pull");
var cList = document.getElementById("c-list");
var cOff = document.getElementById("c-off");
var MASK = "········";

export function cloudSay(msg, kind) {
  if (!cState) return;
  cState.textContent = msg;
  cState.className = "cloudnote" + (kind ? " " + kind : "");
}
export function refreshCloud() {
  if (!cWorld) return;
  cWorld.value = worldName();
  if (cTok) cTok.value = isLinked() ? MASK : "";
  cloudSay(isLinked() ? "연결됨 — 세계 '" + worldName() + "'" : "연결되지 않음",
           isLinked() ? "on" : "");
}
function cloudBusy(on) {
  S.cloudBusy = on;
  var bs = [cConnect, cPush, cPull, cList, cOff];
  for (var i = 0; i < bs.length; i++) if (bs[i]) bs[i].disabled = on;
}
function cloudFail(e) {
  cloudBusy(false);
  var msg = (e && e.message) ? e.message : "알 수 없는 오류";
  cloudSay(msg, "bad");
  toast(msg);
}

if (cWorld) cWorld.addEventListener("change", function (e) {
  e.stopPropagation();
  cWorld.value = setWorldName(cWorld.value);
  cloudSay("세계 이름 '" + cWorld.value + "'", isLinked() ? "on" : "");
});
if (cWorld) cWorld.addEventListener("click", function (e) { e.stopPropagation(); });
if (cTok) cTok.addEventListener("click", function (e) { e.stopPropagation(); });

if (cConnect) cConnect.addEventListener("click", function (e) {
  e.stopPropagation();
  var v = String((cTok && cTok.value) || "").trim();
  if (!v || v === MASK) { cloudSay("토큰을 붙여 넣으세요 (gist 권한)", "bad"); return; }
  setToken(v);
  cloudBusy(true);
  cloudSay("확인하는 중…");
  checkToken().then(function (login) {
    cloudBusy(false);
    if (cTok) cTok.value = MASK;
    cloudSay("연결됨 — " + login + " · 세계 '" + worldName() + "'", "on");
    toast("클라우드에 연결했습니다");
  }).catch(function (err) { setToken(""); cloudFail(err); });
});

if (cPush) cPush.addEventListener("click", function (e) {
  e.stopPropagation();
  cloudBusy(true); cloudSay("올리는 중…");
  pushWorld(false).then(function (r) {
    cloudBusy(false);
    if (r.conflict) {
      var when = String(r.at).slice(0, 16).replace("T", " ");
      var ok = window.confirm("다른 기기(" + (r.device || "?") + ")가 " + when +
        " 에 올린 판이 있습니다.\n덮어쓸까요? (이전 판은 gist 기록에 남습니다)");
      if (!ok) { cloudSay("올리지 않았습니다 — 먼저 내려받으세요", "bad"); return; }
      cloudBusy(true); cloudSay("덮어쓰는 중…");
      return pushWorld(true).then(function (r2) {
        cloudBusy(false);
        cloudSay("올렸습니다 — 판 " + r2.rev, "on");
        toast("세계를 올렸습니다 (판 " + r2.rev + ")");
      });
    }
    cloudSay("올렸습니다 — 판 " + r.rev + " · " + Math.round(r.bytes / 1024) + "KB", "on");
    toast("세계를 올렸습니다 (판 " + r.rev + ")");
  }).catch(cloudFail);
});

if (cPull) cPull.addEventListener("click", function (e) {
  e.stopPropagation();
  var name = normalizeName(cWorld ? cWorld.value : "");
  if (!window.confirm("클라우드의 '" + name + "' 세계로 지금 슬롯을 덮어씁니다.\n" +
                      "직전 내용은 백업에 남습니다. 계속할까요?")) return;
  cloudBusy(true); cloudSay("내려받는 중…");
  pullWorld(name).then(function (r) {
    cloudBusy(false);
    cloudSay("내려받았습니다 — 판 " + r.rev + " (" + (r.device || "?") + ")", "on");
    afterWorldSwap("클라우드에서 '" + r.name + "' 세계를 불러왔습니다");
    refreshCloud();
  }).catch(cloudFail);
});

if (cList) cList.addEventListener("click", function (e) {
  e.stopPropagation();
  cloudBusy(true); cloudSay("목록을 읽는 중…");
  listWorlds().then(function (ws) {
    cloudBusy(false);
    if (!ws.length) { cloudSay("클라우드에 올린 세계가 없습니다"); return; }
    var lines = [];
    for (var i = 0; i < ws.length; i++) {
      var w = ws[i];
      lines.push(w.name + " · 판 " + w.rev + " · " + w.mins + "분 · " +
                 (w.device || "?") + " · " + String(w.at).slice(0, 16).replace("T", " "));
    }
    cloudSay(lines.join("  /  "));
  }).catch(cloudFail);
});

if (cOff) cOff.addEventListener("click", function (e) {
  e.stopPropagation();
  if (!window.confirm("이 기기에서 토큰을 지웁니다. 클라우드의 세계는 그대로 남습니다.")) return;
  unlink();
  if (cTok) cTok.value = "";
  cloudSay("연결을 해제했습니다");
  toast("클라우드 연결을 해제했습니다");
});

// 지형 유형 고르기 — 다음 "새 세계" 부터 적용된다
export var terrainEl = document.getElementById("terrain");
export function refreshTerrain() {
  if (!terrainEl) return;
  var bs = terrainEl.querySelectorAll("button");
  for (var i = 0; i < bs.length; i++)
    bs[i].setAttribute("aria-current",
      parseInt(bs[i].getAttribute("data-terrain"), 10) === S.terrain ? "true" : "false");
}
if (terrainEl) terrainEl.addEventListener("click", function (e) {
  var btn = e.target.closest("button[data-terrain]");
  if (!btn) return;
  e.stopPropagation();
  S.terrain = parseInt(btn.getAttribute("data-terrain"), 10);
  refreshTerrain();
  toast(["보통", "평지", "산악", "군도"][S.terrain] + " — 새 세계부터 적용됩니다");
});

// ── 조작키 재배치 — 손이 다른 사람들을 위해 핵심 몇 개만 바꿀 수 있게
export var KEY_LABEL = { fly: "비행", shape: "모양", pick: "복사", help: "도움말" };
export var keysEl = document.getElementById("keys");
var waitingFor = null;

function keyName(code) {
  return String(code).replace(/^Key|^Digit/, "").replace("Bracket", "").toUpperCase();
}
// 재배치한 키를 화면 곳곳(도움말·조작 목록·힌트 줄)에 반영한다.
// 여기를 빠뜨리면 "F 비행" 이라 적힌 화면을 보며 다른 키를 눌러야 한다 (v16 잔여)
export function refreshBindLabels() {
  var els = document.querySelectorAll("[data-bind]");
  for (var i = 0; i < els.length; i++) {
    var act = els[i].getAttribute("data-bind");
    if (S.binds[act]) els[i].textContent = keyName(S.binds[act]);
  }
  refreshHint();
}
export function hintText(base) {
  return base.replace("{fly}", keyName(S.binds.fly))
             .replace("{pick}", keyName(S.binds.pick))
             .replace("{shape}", keyName(S.binds.shape))
             .replace("{help}", keyName(S.binds.help));
}

export function refreshKeyButtons() {
  if (!keysEl) return;
  var bs = keysEl.querySelectorAll("button");
  for (var i = 0; i < bs.length; i++) {
    var act = bs[i].getAttribute("data-act");
    bs[i].textContent = KEY_LABEL[act] + " " + keyName(S.binds[act]);
    bs[i].classList.toggle("wait", waitingFor === act);
  }
  refreshBindLabels();
}
if (keysEl) keysEl.addEventListener("click", function (e) {
  var btn = e.target.closest("button[data-act]");
  if (!btn) return;
  e.stopPropagation();
  waitingFor = btn.getAttribute("data-act");
  refreshKeyButtons();
  toast("새 키를 누르세요 (ESC 로 취소)");
});
// 이미 다른 뜻이 있는 키 — 여기에 재배치하면 두 가지가 동시에 일어난다
export var RESERVED = {
  KeyW: "앞으로", KeyA: "왼쪽", KeyS: "뒤로", KeyD: "오른쪽",
  ArrowUp: "앞으로", ArrowDown: "뒤로", ArrowLeft: "왼쪽", ArrowRight: "오른쪽",
  Space: "점프", ShiftLeft: "웅크리기", ShiftRight: "웅크리기",
  ControlLeft: "달리기", ControlRight: "달리기", AltLeft: "영역 도구", AltRight: "영역 도구",
  KeyE: "블록 목록", KeyT: "시간", KeyK: "날씨", KeyM: "소리", KeyR: "새 세계",
  KeyB: "청사진",
  Backslash: "미니맵 등고선",
  BracketLeft: "이전 모양", BracketRight: "다음 모양", Slash: "명령창",
  Escape: "메뉴", Tab: "자동완성", F1: "F1", F2: "화면 담기", F3: "자세히", F5: "F5", F6: "F6",
  Digit1: "핫바", Digit2: "핫바", Digit3: "핫바", Digit4: "핫바", Digit5: "핫바",
  Digit6: "핫바", Digit7: "핫바", Digit8: "핫바", Digit9: "핫바", Digit0: "핫바"
};
// 이미 다른 조작에 배정된 키인지 — 배정된 곳의 이름을 돌려준다
export function bindConflict(act, code) {
  for (var k in S.binds) {
    if (k !== act && S.binds[k] === code) return KEY_LABEL[k] || k;
  }
  return RESERVED[code] || "";
}

window.addEventListener("keydown", function (e) {
  if (!waitingFor) return;
  e.preventDefault();
  e.stopPropagation();
  if (e.code !== "Escape") {
    var clash = bindConflict(waitingFor, e.code);
    if (clash) {
      toast(keyName(e.code) + " 는 이미 '" + clash + "' 입니다 — 다른 키를 누르세요");
      refreshKeyButtons();
      return;                                  // 기다린 채로 둔다
    }
    S.binds[waitingFor] = e.code;
    try { localStorage.setItem("blockyard.binds", JSON.stringify(S.binds)); } catch (err) {}
    toast(KEY_LABEL[waitingFor] + " → " + keyName(e.code));
  }
  waitingFor = null;
  refreshKeyButtons();
}, true);
(function loadBinds() {
  try {
    var raw = localStorage.getItem("blockyard.binds");
    if (raw) {
      var d = JSON.parse(raw);
      for (var k in S.binds) if (d[k]) S.binds[k] = d[k];
    }
  } catch (e) {}
})();

// 지금 세계를 여는 링크 — 친구에게 보내면 같은 지형이 열린다
export var copyLinkBtn = document.getElementById("copylink");
export function shareLink() {
  return location.origin + location.pathname + "?seed=" + S.worldSeed + "&t=" + (S.terrain | 0);
}
if (copyLinkBtn) copyLinkBtn.addEventListener("click", function (e) {
  e.stopPropagation();
  var url = shareLink();
  try {
    if (navigator.clipboard) navigator.clipboard.writeText(url);
    toast("공유 링크를 복사했습니다");
  } catch (err) { toast(url); }
});

export function refreshMenu() {
  refreshSlots();
  drawPreview();
  refreshTerrain();
  refreshKeyButtons();
  refreshCloud();
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
  // 지어 놓은 것이 있으면 한 번 더 묻는다 — 세계는 되돌릴 수 없다
  if (stats.placed + stats.mined > 30 && !S.confirmNew) {
    S.confirmNew = true;
    altBtn.textContent = "정말 새 세계? (다시 누르기)";
    setTimeout(function () {
      S.confirmNew = false;
      altBtn.textContent = "새 세계";
    }, 4000);
    return;
  }
  S.confirmNew = false;
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

// 명령창이 열려 있으면 조작키를 전부 넘긴다
// hud.js 와 input.js 는 서로를 부르므로, 이 파일이 먼저 실행될 때
// hud 의 `cmdIn` 은 아직 비어 있을 수 있다 — DOM 에서 직접 잡는다.
var cmdInput = document.getElementById("cmd-in");
if (cmdInput) cmdInput.addEventListener("keydown", function (e) {
  e.stopPropagation();
  if (e.code === "Escape") { closeCmd(); if (S.lockMode && S.active) canvas.requestPointerLock(); return; }
  // Tab — 명령 이름 자동완성
  if (e.code === "Tab") {
    e.preventDefault();
    var head = cmdInput.value.split(/\s+/)[0];
    var full = completeCommand(head);
    if (full && full !== head) cmdInput.value = cmdInput.value.replace(head, full);
    return;
  }
  // 위/아래 — 지난 명령
  if (e.code === "ArrowUp" || e.code === "ArrowDown") {
    e.preventDefault();
    if (!S.cmdHist.length) return;
    S.cmdAt += (e.code === "ArrowUp" ? -1 : 1);
    S.cmdAt = Math.max(0, Math.min(S.cmdHist.length, S.cmdAt));
    cmdInput.value = S.cmdHist[S.cmdAt] || "";
    return;
  }
  if (e.code !== "Enter") return;
  if (cmdInput.value.trim()) {
    S.cmdHist.push(cmdInput.value.trim());
    if (S.cmdHist.length > 20) S.cmdHist.shift();
    S.cmdAt = S.cmdHist.length;
  }
  var out = runCommand(cmdInput.value);
  cmdSay(out);
  if (out && out.indexOf("모르는") !== 0) {
    applyTime();
    refreshBar();               // /give 로 바꾼 핫바가 바로 보이게 한다
    cmdInput.value = "";
    setTimeout(function () {
      closeCmd();
      if (S.lockMode && S.active && canvas.requestPointerLock) {
        try { canvas.requestPointerLock(); } catch (err) {}
      }
    }, 700);
  }
});

window.addEventListener("keydown", function (e) {
  if (e.target === seedIn || e.target === cmdIn) return;   // 입력 중에는 조작키를 막는다
  var held = e.repeat || !!S.keys[e.code];
  S.keys[e.code] = true;

  // 크리에이티브 관용구 — 스페이스 두 번 톡톡으로 비행 토글
  if (!held && e.code === "Space" && S.active && !S.uiOpen) {
    var nowSp = (window.performance && performance.now) ? performance.now() : Date.now();
    if (nowSp - S.lastSpaceTap < 300) {
      player.flying = !player.flying;
      player.vel.y = 0;
      S.lastSpaceTap = 0;
      tone(player.flying ? 660 : 330, 0.09, "square", 0.05);
      toast(player.flying ? "비행 모드" : "걷기 모드");
    } else S.lastSpaceTap = nowSp;
  }

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
    // ── 영역 도구
    if (e.code === "KeyF") {
      e.preventDefault();
      // Shift 를 같이 누르면 채우는 대신 비운다 — 산을 깎을 때 쓴다
      var wipe = e.shiftKey;
      var n = wipe ? clearSelection() : fillSelection(S.bar[S.selected], currentShape(false));
      toast(n < 0 ? ("영역이 너무 큽니다 (최대 " + REGION_MAX.toLocaleString("ko-KR") + "칸)")
                  : (n ? n.toLocaleString("ko-KR") + "칸을 " + (wipe ? "비웠습니다" : "채웠습니다")
                       : "먼저 영역을 고르세요"));
      return;
    }
    if (e.code === "KeyC") {
      e.preventDefault();
      var c = copySelection();
      toast(c < 0 ? "영역이 너무 큽니다" : (c ? c.toLocaleString("ko-KR") + "칸을 복사했습니다"
                                            : "먼저 영역을 고르세요"));
      return;
    }
    if (e.code === "KeyV") {
      e.preventDefault();
      var hitV = raycast(6);
      if (!hitV) { toast("붙여넣을 자리를 조준하세요"); return; }
      var pn = pasteClip(hitV.x + hitV.nx, hitV.y + hitV.ny, hitV.z + hitV.nz);
      toast(pn ? pn.toLocaleString("ko-KR") + "칸을 붙여넣었습니다" : "복사한 것이 없습니다");
      return;
    }
    if (e.code === "KeyD") {
      e.preventDefault();
      S.selA = S.selB = null;
      toast("영역 선택 해제");
      return;
    }
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
  if (e.code === "Tab") {
    e.preventDefault();
    var swapBar = S.bar;
    S.bar = S.barAlt;
    S.barAlt = swapBar;
    S.barPage = S.barPage === 1 ? 2 : 1;
    refreshBar();
    S.worldDirty = true;
    toast("핫바 " + S.barPage + "쪽");
    tone(520 + S.barPage * 90, 0.06, "square", 0.04);
  }
  if (e.code === S.binds.pick) pickBlock();
  if (e.code === S.binds.fly) {
    player.flying = !player.flying; player.vel.y = 0;
    tone(player.flying ? 660 : 330, 0.09, "square", 0.05);
    toast(player.flying ? "비행 모드" : "걷기 모드");
  }
  if (e.code === S.binds.shape) {
    S.shapeMode = (S.shapeMode + 1) % 3;
    updateHandBlock();
    toast(["전체 블록", "반블록", "계단"][S.shapeMode]);
    tone(560 + S.shapeMode * 120, 0.06, "square", 0.04);
    advanceTut(3);
  }
  if (e.code === "Slash" || (e.key === "/" && !e.ctrlKey && !e.metaKey)) {
    e.preventDefault();
    if (document.pointerLockElement === canvas) document.exitPointerLock();
    openCmd();
    return;
  }
  if (e.code === "F2") { e.preventDefault(); S.wantShot = true; }
  if (e.code === "KeyB") {
    var mx = Math.round(player.pos.x), mz = Math.round(player.pos.z);
    var near = -1;
    for (var mi = 0; mi < S.marks.length; mi++)
      if (Math.abs(S.marks[mi][0] - mx) < 3 && Math.abs(S.marks[mi][1] - mz) < 3) near = mi;
    if (near >= 0) { S.marks.splice(near, 1); toast("표식 지움"); }
    else if (S.marks.length >= 12) toast("표식은 12개까지입니다");
    else {
      S.marks.push([mx, mz]);
      toast("표식 " + S.marks.length + "개");
      if (S.marks.length >= 5) unlock("explorer");
    }
    S.worldDirty = true;
    tone(620, 0.08, "triangle", 0.05);
  }
  if (e.code === "KeyV") {
    S.spawnPoint = [player.pos.x, player.pos.y, player.pos.z];
    S.worldDirty = true;
    toast("여기를 시작 지점으로 정했습니다");
    tone(700, 0.1, "triangle", 0.05);
  }
  if (e.code === "F3") {
    e.preventDefault();
    S.showPerf = !S.showPerf;
    perfEl.hidden = !S.showPerf;
    // F3 는 성능 정보와 함께 자세한 좌표 표시도 켠다 (기본은 세 줄만)
    var tel = document.getElementById("telemetry");
    if (tel) tel.classList.toggle("lean", !S.showPerf);
    toast(S.showPerf ? "자세한 정보 켬" : "자세한 정보 끔");
  }
  if (e.code === "F6") {
    e.preventDefault();
    S.photoMode = !S.photoMode;
    showHud(!S.photoMode && !S.hudHidden);
    if (S.photoMode) { player.flying = true; S.thirdPerson = 0; }
    toast(S.photoMode ? "사진 모드 — F2 로 저장, F6 로 나가기" : "사진 모드 끔");
  }
  if (e.code === "F5") {
    e.preventDefault();
    S.thirdPerson = (S.thirdPerson + 1) % 3;
    toast(["1인칭", "3인칭 (뒤)", "3인칭 (앞)"][S.thirdPerson]);
  }
  if (e.code === "F1") {
    e.preventDefault();
    S.hudHidden = !S.hudHidden;
    showHud(!S.hudHidden);
    toast(S.hudHidden ? "화면 표시 끔" : "화면 표시 켬");
  }
  if (e.code === "Backslash") {
    S.contour = !S.contour;
    toast(S.contour ? "미니맵 등고선 켬" : "미니맵 등고선 끔");
  }
  if (e.code === "BracketLeft" || e.code === "BracketRight") {
    var zs = [1, 2, 4];
    var zi = zs.indexOf(S.mmZoom);
    zi = Math.max(0, Math.min(zs.length - 1, zi + (e.code === "BracketRight" ? 1 : -1)));
    S.mmZoom = zs[zi];
    toast("미니맵 ×" + S.mmZoom);
  }
  if (e.code === S.binds.help) { toggleHelp(); setHelpTab(false); refreshAchList(); advanceTut(6); }
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
  if (e.altKey) {                              // 비행 속도 (Ctrl 은 달리기)
    S.flySpeed = Math.max(0.5, Math.min(4, S.flySpeed * (e.deltaY > 0 ? 0.85 : 1.18)));
    toast("비행 속도 ×" + S.flySpeed.toFixed(2));
    return;
  }
  selectSlot(S.selected + (e.deltaY > 0 ? 1 : -1));
}, { passive: true });

canvas.addEventListener("contextmenu", function (e) { e.preventDefault(); });

canvas.addEventListener("mousedown", function (e) {
  if (!S.active) { requestPlay(); return; }
  if (S.uiOpen) return;
  if (e.button === 1) { e.preventDefault(); pickBlock(); return; }   // 휠 클릭 = 픽블록
  // Alt + 클릭으로 영역의 두 모서리를 찍는다.
  // (Ctrl 은 달리기라, 달리며 캐려고 하면 영역이 찍혀 버렸다)
  if (e.altKey) {
    e.preventDefault();
    var hs = raycast(6);
    if (!hs) return;
    if (e.button === 0) { S.selA = [hs.x, hs.y, hs.z]; toast("영역 시작"); }
    else if (e.button === 2) {
      S.selB = [hs.x, hs.y, hs.z];
      toast("영역 " + selectionSize().toLocaleString("ko-KR") + "칸");
      advanceTut(5);
    }
    return;
  }
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

// 핫바를 좌우로 쓸면 칸이 바뀐다 (폰에서 작은 칸을 정확히 누르기 어렵다)
(function bindHotbarSwipe() {
  var el = document.getElementById("hotbar");
  if (!el) return;
  var startX = 0, startSel = 0, active = false;
  el.addEventListener("touchstart", function (ev) {
    active = true;
    startX = ev.changedTouches[0].clientX;
    startSel = S.selected;
  }, { passive: true });
  el.addEventListener("touchmove", function (ev) {
    if (!active) return;
    var dx = ev.changedTouches[0].clientX - startX;
    selectSlot(startSel + Math.round(dx / 40));
  }, { passive: true });
  el.addEventListener("touchend", function () { active = false; }, { passive: true });
})();

// 터치에서도 영역 도구를 쓸 수 있게 — 두 손가락으로 화면을 누르면 모서리를 찍는다
(function bindTouchRegion() {
  var el = document.getElementById("stage");
  if (!el) return;
  var twoStart = 0;
  el.addEventListener("touchstart", function (ev) {
    if (ev.touches.length !== 2 || !S.active) return;
    twoStart = Date.now();
  }, { passive: true });
  el.addEventListener("touchend", function (ev) {
    if (!twoStart || ev.touches.length > 0) { if (!ev.touches.length) twoStart = 0; return; }
    var held = Date.now() - twoStart;
    twoStart = 0;
    if (held < 220 || held > 1400) return;
    var h = raycast(6);
    if (!h) return;
    if (!S.selA || (S.selA && S.selB)) { S.selA = [h.x, h.y, h.z]; S.selB = null; toast("영역 시작"); }
    else { S.selB = [h.x, h.y, h.z]; toast("영역 " + selectionSize().toLocaleString("ko-KR") + "칸"); }
  }, { passive: true });
})();

function endTouch(e) {
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
bindOpt("s-bright", "o-bright", "bright", function (v) { return v + "%"; });
bindOpt("s-ui", "o-ui", "ui", function (v) { return v + "%"; });
bindOpt("s-tbtn", "o-tbtn", "tbtn", function (v) { return v + "%"; });
bindOpt("s-save", "o-save", "autosave", function (v) { return v + "초"; });
bindOpt("s-undo", "o-undo", "undo", function (v) { return v + "단계"; });
(function bindLefty() {
  var el = document.getElementById("s-lefty"), out = document.getElementById("o-lefty");
  if (!el) return;
  el.checked = !!opts.lefty;
  if (out) out.textContent = opts.lefty ? "켬" : "끔";
  el.addEventListener("change", function () {
    opts.lefty = el.checked ? 1 : 0;
    if (out) out.textContent = el.checked ? "켬" : "끔";
    applyOpts(); saveOpts();
  });
})();
(function bindContrast() {
  var el = document.getElementById("s-hc"), out = document.getElementById("o-hc");
  if (!el) return;
  el.checked = !!opts.contrast;
  if (out) out.textContent = opts.contrast ? "켬" : "끔";
  el.addEventListener("change", function () {
    opts.contrast = el.checked ? 1 : 0;
    if (out) out.textContent = el.checked ? "켬" : "끔";
    applyOpts(); saveOpts();
  });
})();
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

// ══════════════════════════════════════════════════════════════
//  게임패드 — 마우스·키보드가 어려운 사람도 놀 수 있게
// ══════════════════════════════════════════════════════════════
export var padState = { on: false, lx: 0, ly: 0, rx: 0, ry: 0 };
var padPrev = {};
var padHeld = {};   // 패드가 지난 프레임에 실제로 누르고 있었는가

export function pollGamepad(dt) {
  if (!navigator.getGamepads) return false;
  var pads = navigator.getGamepads();
  var g = null;
  for (var i = 0; i < pads.length; i++) if (pads[i] && pads[i].connected) { g = pads[i]; break; }
  if (!g) { padState.on = false; return false; }
  if (!padState.on) { padState.on = true; toast("게임패드 연결됨"); }

  function dead(v) { return Math.abs(v) < 0.18 ? 0 : v; }
  padState.lx = dead(g.axes[0] || 0);
  padState.ly = dead(g.axes[1] || 0);
  padState.rx = dead(g.axes[2] || 0);
  padState.ry = dead(g.axes[3] || 0);

  // 시점 — 오른쪽 스틱
  if (padState.rx || padState.ry) {
    applyLook(padState.rx * 620 * dt, padState.ry * 480 * dt);
  }

  function pressed(n) { return !!(g.buttons[n] && g.buttons[n].pressed); }
  function tapped(n) {
    var now = pressed(n), was = padPrev[n];
    padPrev[n] = now;
    return now && !was;
  }

  // 눌렸을 때만 켠다. 가만히 있는 패드가 키보드·마우스를 끄면 안 된다.
  if (pressed(0)) S.keys.Space = true;
  else if (padHeld[0]) S.keys.Space = false;
  if (pressed(1)) S.keys.ShiftLeft = true;
  else if (padHeld[1]) S.keys.ShiftLeft = false;
  var mine = pressed(7) || pressed(5);             // RT/RB — 캐기
  if (mine) S.mouseDown[0] = true;
  else if (padHeld[7] || padHeld[5]) S.mouseDown[0] = false;
  padHeld[0] = pressed(0); padHeld[1] = pressed(1);
  padHeld[5] = pressed(5); padHeld[7] = pressed(7);
  if (tapped(6) || tapped(4)) place();             // LT/LB — 놓기
  if (tapped(2)) pickBlock();                      // X — 복사
  if (tapped(3)) { player.flying = !player.flying; player.vel.y = 0; }  // Y — 비행
  if (tapped(14)) selectSlot(S.selected - 1);      // 십자 좌
  if (tapped(15)) selectSlot(S.selected + 1);      // 십자 우
  if (tapped(9)) { if (S.uiOpen) closePicker(true); else openPicker(); }  // 시작 — 블록 목록
  return true;
}
