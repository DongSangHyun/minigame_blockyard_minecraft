// input.js — 입력 (키보드 · 마우스 · 터치)
import { S } from "./state.js";
import { markX, markY, markName, markZ } from "./world.js";
import { resetQueues } from "./queues.js";
import { seedMobs } from "./mobs.js";
import { WX, WY, WZ } from "./dims.js";
import { markAllDirty, buildBudget } from "./mesh.js";
import { relightAll } from "./light.js";
import { IS_TOUCH } from "./boot.js";
import { SH_SLAB, SH_SLAB_UP, isStairShape, NAMES , isItem} from "./blocks.js";
import { camera, crackMesh, renderer } from "./scene.js";
import { applyTime } from "./daynight.js";
import { applyOpts, applyFov, applyTbtn, applyUi, opts, saveOpts } from "./settings.js";
import { EYE, currentShape, player, raycast, spawn, stats } from "./player.js";
import { ac, setAudioAwake, startAmbient, tone } from "./audio.js";
import { renameSlot, clearSave, SLOTS, exportWorld, hasBackup, hasSave, importWorldText, loadGame, restoreBackup, saveGame, slotInfo , rememberSlot} from "./save.js";
import { checkToken, isLinked, listWorlds, normalizeName, pullWorld, pushWorld, setToken, setWorldName, unlink, worldName } from "./cloud.js";
import { undoEmptyWhy, lastEditLabel, blueprintList, deleteBlueprint, useBlueprint, mirrorClip, rotateClip, selectionBounds, REGION_MAX, clearSelection, completeCommand, copySelection, fillSelection, pasteClip, redo, refreshAchList, refreshStats, runCommand, selectionSize, undo, unlock } from "./edit.js";
import { helpOpen, closeCmd, closePicker, cmdIn, cmdSay, drawMinimap, drawPreview, openCmd, openPicker, perfEl, refreshBar, refreshSlot, selectSlot, setHelpTab, showHud, toast, toggleHelp } from "./hud.js";
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
// 폰 전용 — HINT_DRAG 를 폰에 띄우면 여섯 조작 중 여섯 개가 폰에 없는 것이었다
export var HINT_TOUCH = '왼쪽 <b>스틱</b> 걷기 · 오른쪽 화면 끌어 <b>둘러보기</b> · <b>캐기</b>/<b>놓기</b> 길게 누르면 계속 · <b>목록</b> 재료 고르기 · <b>되돌리기</b> · <b>메뉴</b>';
export var hintEl = document.getElementById("hint");

export var TUT = [
  '먼저 <b>좌클릭을 길게</b> 눌러 블록을 캐보세요',
  '이번엔 <b>우클릭</b>으로 블록을 놓아보세요',
  '<b>E</b> 를 눌러 블록 목록에서 다른 재료를 골라보세요',
  '<b>{shape}</b> 로 반블록·계단으로 바꿔 지어보세요',
  '<b>9</b> 번 <b>횃불</b>로 어두운 굴을 밝혀보세요',
  '<b>Alt</b>+클릭으로 영역을 고르고 <b>Ctrl</b>+<b>F</b> 로 한 번에 채워보세요',
  '<b>{help}</b> 를 누르면 나머지 조작이 전부 나옵니다'
];
// 터치용 튜토리얼 — 단계 번호는 TUT 와 같게 맞춘다 (advanceTut 이 같은 인덱스를 쓴다).
// 폰에는 마우스도 Alt 도 없으니 문구가 달라야 하고, 이 줄이 480px 아래에서 숨겨져 있어 평생 안 보였다.
export var TUT_TOUCH = [
  '먼저 <b>캐기</b> 버튼을 길게 눌러 블록을 캐보세요',
  '이번엔 <b>놓기</b> 버튼으로 블록을 놓아보세요',
  '<b>목록</b> 버튼으로 다른 재료를 골라보세요',
  '<b>놓기</b>를 누른 채 화면을 끌면 줄이 그어집니다',
  '핫바의 <b>횃불</b>을 골라 어두운 곳을 밝혀보세요',
  '왼쪽 <b>스틱</b>으로 걷고, 오른쪽 화면을 끌어 둘러보세요',
  '<b>웅크림</b> 버튼을 누른 채면 모서리에서 떨어지지 않습니다'
];
export function tutLine(i) { return (isTouch ? TUT_TOUCH : TUT)[i]; }
var hintFade = 0;
export function refreshHint() {
  // 다 배웠으면 접는다 (v99) — 튜토리얼 7단계는 2~3분이면 끝나는데
  // 그 뒤 **57분 동안** 같은 문장이 화면 왼쪽 아래에 붙어 있었다.
  // "다 배웠다" 는 신호가 없어, 게임이 아직 나를 초보로 보는 느낌이 내내 갔다.
  // 메뉴에서 돌아오거나 도움말을 닫으면 잠깐 다시 뜬다(이 함수가 그때 불린다)
  hintEl.innerHTML = hintText(S.tut < TUT.length ? tutLine(S.tut)
    : (isTouch ? HINT_TOUCH : (S.lockMode ? HINT_LOCK : HINT_DRAG)));
  if (!S.hudHidden && !S.photoMode) hintEl.hidden = false;
  clearTimeout(hintFade);
  if (S.tut >= (isTouch ? TUT_TOUCH.length : TUT.length)) {
    hintFade = setTimeout(function () { if (hintEl) hintEl.hidden = true; }, 9000);
  }
}
// 폰에서 3·5·6 단계가 각각 G 키·Ctrl+F·H 키에만 걸려 있어, 네 번째 줄에서 영영 멈췄다.
// 그 뒤 세 줄(줄 긋기·스틱·웅크림)은 아무도 못 봤다.
// TUT_TOUCH 의 문구가 요구하는 동작으로 각각 이어 준다.
export function advanceTutTouch(step) { if (isTouch) advanceTut(step); }
export function advanceTut(step) {
  if (S.tut !== step) return;
  S.tut = step + 1;
  S.worldDirty = true;
  refreshHint();
}


// 저장 슬롯 — 세계를 셋까지 따로 둔다
export var slotsEl = document.getElementById("slots");
// "3시간 전" — 어제 하던 세계를 찾을 수 있게
export function agoText(ms) {
  if (!ms) return "";
  var d = Date.now() - ms;
  if (d < 60000) return "방금";
  if (d < 3600000) return Math.floor(d / 60000) + "분 전";
  if (d < 86400000) return Math.floor(d / 3600000) + "시간 전";
  return Math.floor(d / 86400000) + "일 전";
}
// 사람이 지은 이름을 마크업에 끼우므로 반드시 막는다 (청사진 목록에서 배운 것 · v63)
var ESC_MAP = { "&": "&amp;", "<": "&lt;", ">": "&gt;", "\u0022": "&quot;" };
function esc(t) {
  // 정규식 안에 **큰따옴표를 글자 그대로 쓰지 않는다** — tools/tidy-imports.mjs 의
  // 문자열 제거기가 그 따옴표를 문자열 시작으로 읽어 파일을 통째로 오해한다.
  // (실제로 input.js 의 import 를 84개 지워 게임이 안 켜졌다)
  return String(t).replace(/[&<>\u0022]/g, function (c) { return ESC_MAP[c]; });
}
export function refreshSlots() {
  if (!slotsEl) return;
  var html = "";
  for (var n = 1; n <= SLOTS; n++) {
    var info = slotInfo(n);
    // 이름을 붙였으면 그것으로 부른다 — 시드 번호로는 "성 지은 게 1번인지 2번인지" 를 못 외운다
    var title = info ? (info.name || ("SEED " + info.seed)) : "비어 있음";
    var label = info ? (info.mins + "분" + (info.at ? " · " + agoText(info.at) : "")) : "";
    html += '<button type="button" data-slot="' + n + '" aria-current="' +
            (S.slot === n ? "true" : "false") + '"><b>' + n + ' ' + esc(title) + '</b>' + label +
            (info ? '<i class="ren" data-ren="' + n + '" title="이름 붙이기">✎</i>' +
                    '<i class="del" data-del="' + n + '" title="이 슬롯 지우기">✕</i>' : '') +
            '</button>';
  }
  slotsEl.innerHTML = html;
}
if (slotsEl) {
  slotsEl.addEventListener("click", function (e) {
    // 이름 붙이기 — 지우기와 달리 되돌릴 수 있으니 한 번에 연다
    var ren = e.target.closest("i[data-ren]");
    if (ren) {
      e.stopPropagation();
      var rn = parseInt(ren.getAttribute("data-ren"), 10);
      var cur = (slotInfo(rn) || {}).name || "";
      var got = window.prompt("슬롯 " + rn + " 의 이름 (비우면 시드로 돌아갑니다)", cur);
      if (got === null) return;
      renameSlot(rn, got.slice(0, 24));
      refreshSlots();
      return;
    }
    // 지우기 — 파괴적 조작이라 두 번 눌러야 한다 (규칙 8)
    var del = e.target.closest("i[data-del]");
    if (del) {
      e.stopPropagation();
      var dn = parseInt(del.getAttribute("data-del"), 10);
      if (S.delArm === dn && Date.now() - S.delArmAt < 4000) {
        var keep = S.slot;
        S.slot = dn; clearSave(); S.slot = keep;
        S.delArm = 0;
        toast("슬롯 " + dn + " 을 지웠습니다");
        refreshSlots(); refreshMenu();
      } else {
        S.delArm = dn; S.delArmAt = Date.now();
        toast("슬롯 " + dn + " 을 지우려면 4초 안에 한 번 더");
      }
      return;
    }
    var btn = e.target.closest("button[data-slot]");
    if (!btn) return;
    e.stopPropagation();
    var n = parseInt(btn.getAttribute("data-slot"), 10);
    if (n === S.slot) return;
    if (S.worldDirty) saveGame();
    S.slot = n;
    rememberSlot(n);        // 다음에 열 때 이 슬롯부터 (v99)
    if (hasSave() && loadGame()) {
      afterWorldSwap("슬롯 " + n + " 을 불러왔습니다", true);
    } else {
      // 빈 슬롯도 SEED 칸에 적어 둔 값을 쓴다 — 예전엔 무조건 무작위였다
      var typed = (seedIn && seedIn.value || "").trim();
      newWorld(typed ? hashSeed(typed) : ((Math.random() * 100000) | 0));
      toast("슬롯 " + n + " · 새 세계 · SEED " + S.worldSeed + " — 옛 세계는 설정 › 직전으로 되돌리기 에");
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

// 조준한 칸 — 블록을 맞히면 그 칸, 허공이면 시선 4칸 앞.
// 예전에는 허공에 Alt+클릭하면 아무 일도 안 일어나 20칸 탑 자리를 고르려면
// 임시 블록을 놓고 찍고 지우기를 반복해야 했다.
// strict 를 주면 **안 맞았을 때 null** 을 돌려준다.
// 기본값(눈앞 4칸 허공)은 "늘 성공한 것처럼" 보이게 해서,
// 20칸 앞 탑 모서리를 겨눠도 코앞 허공이 찍히고 Ctrl+F 를 누른 뒤에야 알았다.
export function aimCell(reach, strict) {
  var h = raycast(reach || 6);
  if (h) return [h.x, h.y, h.z];
  if (strict) return null;
  var d = new THREE.Vector3();
  camera.getWorldDirection(d);
  var ex = player.pos.x + d.x * 4;
  var ey = player.pos.y + EYE + d.y * 4;
  var ez = player.pos.z + d.z * 4;
  var cx = Math.floor(ex), cy = Math.floor(ey), cz = Math.floor(ez);
  if (cx < 0 || cx >= WX || cy < 0 || cy >= WY || cz < 0 || cz >= WZ) return null;
  return [cx, cy, cz];
}
// 건축에서 필요한 숫자는 칸수가 아니라 가로×높이×세로다
export function selectionText() {
  var b = selectionBounds();
  if (!b) return "0칸";
  return (b.x1 - b.x0 + 1) + "×" + (b.y1 - b.y0 + 1) + "×" + (b.z1 - b.z0 + 1) +
         " · " + selectionSize().toLocaleString("ko-KR") + "칸";
}

// ── 세계 파일 · 백업
export var expBtn = document.getElementById("w-export");
export var impBtn = document.getElementById("w-import");
export var resBtn = document.getElementById("w-restore");
export var fileIn = document.getElementById("w-file");

// 세계를 갈아타는 **모든** 경로(슬롯 · 파일 가져오기 · 클라우드 내려받기 · 백업 복원)가
// 여기 하나를 거친다. 예전에는 넷이 각자 반쪽씩 해서, 세계 A 의 되돌리기 기록이
// 세계 B 로 따라와 Ctrl+Z 한 번에 599칸을 도려내는 일이 있었다 (자문 6차 실측).
export function afterWorldSwap(msg, loaded) {
  // 지난 세계의 세션 상태를 전부 버린다 — newWorld() 가 하는 것과 같은 청소다
  S.history.length = 0; S.future.length = 0;
  S.clip = null; S.selA = null; S.selB = null;
  S.primed.length = 0; S.fireOrigins.length = 0;
  S.walked = 0; S.achPrevX = null; S.achPrevZ = null;   // 걸은 거리도 이 세계 것부터 다시 센다
  S.growDirty = true;                                   // 불러온 세계의 묘목을 큐에 다시 담는다
  S.weatherLock = false;                                // 날씨 잠금도 이 세계 것이 아니다
  // 담긴 양동이도 이 세계 것이 아니다 (v96) — newWorld 경로에만 있어서,
  // 세계 A 에서 뜬 용암이 슬롯을 갈아타면 세계 B 로 따라왔다
  if (S.fillBar) { for (var fq = 0; fq < S.fillBar.length; fq++) S.fillBar[fq] = 0; }
  if (S.fillBarAlt) { for (var fq2 = 0; fq2 < S.fillBarAlt.length; fq2++) S.fillBarAlt[fq2] = 0; }
  S.mobSwatHinted = false;                              // 새 세계에서는 안내를 한 번 더 한다
  resetQueues();

  relightAll(false); markAllDirty(); buildBudget(70);
  // 예전 저장에는 동물이 없다 — 그때만 새로 뿌린다
  if (!S.mobsRestored) seedMobs();
  // 저장에서 불러왔으면 그 자리를 지킨다 — 짓던 탑 꼭대기에 있었든 갱도 바닥이었든
  // 섬 한가운데 지표로 떨어뜨리면 집을 매번 다시 찾아야 한다
  if (!loaded) spawn();
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
    afterWorldSwap("세계를 가져왔습니다", true);
  };
  rd.readAsText(f);
});
if (resBtn) resBtn.addEventListener("click", function (e) {
  e.stopPropagation();
  if (!hasBackup()) { toast("되돌릴 백업이 없습니다"); return; }
  if (restoreBackup()) afterWorldSwap("직전 저장으로 되돌렸습니다", true);
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
    afterWorldSwap("클라우드에서 '" + r.name + "' 세계를 불러왔습니다", true);
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

// 청사진 목록 — 저장해 놓고 /bp list 를 쳐야만 보이면 저장한 보람이 없다
export function refreshBlueprints() {
  var grid = document.getElementById("bpgrid");
  if (!grid) return;
  var list = blueprintList();
  grid.textContent = "";
  if (!list.length) {
    var p0 = document.createElement("p");
    p0.className = "empty";
    p0.textContent = "저장된 청사진이 없습니다";
    grid.appendChild(p0);
    return;
  }
  for (var i = 0; i < list.length; i++) grid.appendChild(bpRow(list[i]));
}
// 한 줄을 만든다. innerHTML 로 이름을 끼워 넣으면 사람이 지은 이름이 마크업이 된다.
function bpRow(bp) {
  var row = document.createElement("div");
  row.className = "bp";
  var nameEl = document.createElement("b");
  nameEl.textContent = bp.name;
  var sizeEl = document.createElement("span");
  sizeEl.textContent = bp.w + "×" + bp.h + "×" + bp.d + " · " + bp.cells.toLocaleString("en-US") + "칸";
  var use = document.createElement("button");
  use.type = "button"; use.textContent = "불러오기";
  use.addEventListener("click", function (e) {
    e.stopPropagation();
    var err = useBlueprint(bp.name);
    toast(err || ("청사진 준비됨: " + bp.name + " — Ctrl+V 로 붙여넣기"));
  });
  var del = document.createElement("button");
  del.type = "button"; del.className = "del"; del.textContent = "지우기";
  del.addEventListener("click", function (e) {
    e.stopPropagation();
    // 되돌릴 수 없는 삭제다 — 단추 하나로 사라지면 안 된다 (CLAUDE.md 2절 8번)
    if (!window.confirm("청사진 '" + bp.name + "' 을(를) 지웁니다. 되돌릴 수 없습니다.")) return;
    var err = deleteBlueprint(bp.name);
    toast(err || ("청사진 지움: " + bp.name));
    refreshBlueprints();
  });
  row.appendChild(nameEl); row.appendChild(sizeEl);
  row.appendChild(use); row.appendChild(del);
  return row;
}

// 시작 화면의 "이어서 짓던 곳" — 3일 만에 열었을 때 "내가 뭘 하고 있었지" 에 답한다.
// 이름·플레이 시간·마지막 시각·섬 그림·표식이 전부 저장에 있는데 접힌 설정 안에만 있었다.
export function refreshResume() {
  var box = document.getElementById("resume");
  if (!box) return "";
  var lede = document.querySelector(".lede");
  var info = slotInfo(S.slot);
  if (!info) {
    box.hidden = true;
    if (lede) lede.hidden = false;      // 처음 온 사람에게는 이 게임이 뭔지부터
    return "";
  }
  box.hidden = false;
  // 돌아온 사람에게 다섯 줄짜리 소개문은 소음이다 — 마크도 월드 목록이 첫 화면이다
  if (lede) lede.hidden = true;
  var shot = document.getElementById("resume-shot");
  if (shot) drawPreview(shot);
  var nm = document.getElementById("resume-name");
  var meta = document.getElementById("resume-meta");
  var mk = document.getElementById("resume-marks");
  if (nm) nm.textContent = info.name || ("SEED " + info.seed);
  if (meta) {
    meta.textContent = (info.at ? agoText(info.at) + " · " : "") +
      info.mins + "분 플레이 · 놓음 " + info.placed.toLocaleString("ko-KR") +
      " · 캔 " + info.mined.toLocaleString("ko-KR");
  }
  if (mk) {
    // 표식이 있으면 어디를 찍어 뒀는지도 알려 준다 — 돌아갈 곳이 곧 "하던 일" 이다
    var names = [];
    for (var i = 0; i < S.marks.length && names.length < 4; i++) {
      var n = markName(S.marks[i]);
      if (n) names.push(n);
    }
    mk.textContent = S.marks.length
      ? ("표식 " + S.marks.length + "개" + (names.length ? " — " + names.join(" · ") : ""))
      : "";
    mk.hidden = !S.marks.length;
  }
  return nm ? nm.textContent : "";
}

export function refreshMenu() {
  refreshWorldPills();          // 지금 시각·날씨를 단추에 표시한다
  refreshResume();
  refreshSlots();
  refreshBlueprints();
  drawPreview();
  refreshTerrain();
  refreshKeyButtons();
  refreshCloud();
  if (S.started) goBtn.textContent = "계속하기";
  else if (hasSave()) goBtn.textContent = "이어하기";
  else goBtn.textContent = "플레이";
  altBtn.textContent = "새 세계";
}

export function beginPlay() {
  // 사진 모드로 들어간 채 일시정지 화면을 거쳐 돌아오면, 아래 showHud(true) 가
  // HUD 를 통째로 되켜서 **사진 모드가 반만 켜진 상태**가 됐다 (v97).
  // 설정 안의 「사진 모드」 단추가 유일한 폰 진입점이라 늘 이 길을 탄다
  if (S.active) return;
  if (!S.started) {
    S.started = true;
    if (S.savedPos) {
      player.pos.copy(S.savedPos);
      player.yaw = S.savedYaw; player.pitch = S.savedPitch;
    }
    try {
      if (!localStorage.getItem("blockyard.seen")) {
        localStorage.setItem("blockyard.seen", "1");
        setTimeout(function () {
          toast(isTouch ? "캐고 · 놓고 · 지어 보세요 · 버튼을 길게 누르면 계속됩니다"
                        : "캐고 · 놓고 · 지어 보세요 · H 로 조작 전체");
        }, 600);
      }
    } catch (e) {}
  }
  S.active = true;
  overlay.hidden = true;
  showHud(!S.photoMode && !S.hudHidden);
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

// **선언이 IIFE 보다 먼저여야 한다** — `var` 는 끌어올려지지만 **대입은 그 자리에서** 돈다.
// 뒤에 두면 IIFE 가 넣은 함수를 빈 함수가 덮어쓴다.
export var refreshWorldPills = function () {};
// 설정의 시간·날씨 단추 — 폰에는 `T`·`K` 가 없어 밤을 넘길 길이 없었다 (v91).
// 키보드와 **같은 길**(applyTime·setWeather)을 탄다.
(function bindWorldPills() {
  var tRow = document.getElementById("row-time");
  var wRow = document.getElementById("row-weather");
  function markTime() {
    if (!tRow) return;
    for (var i = 0; i < tRow.children.length; i++) {
      var b = tRow.children[i];
      var v = parseFloat(b.getAttribute("data-time"));
      b.setAttribute("aria-current", Math.abs(S.timeOfDay - v) < 0.02 ? "true" : "false");
    }
  }
  function markWeather() {
    if (!wRow) return;
    for (var j = 0; j < wRow.children.length; j++) {
      var wb = wRow.children[j];
      wb.setAttribute("aria-current",
        (parseInt(wb.getAttribute("data-weather"), 10) === S.weather) ? "true" : "false");
    }
  }
  if (tRow) tRow.addEventListener("click", function (e) {
    var b = e.target.closest ? e.target.closest("button") : null;
    if (!b) return;
    S.timeOfDay = parseFloat(b.getAttribute("data-time"));
    applyTime(); markTime();
    S.worldDirty = true;
  });
  if (wRow) wRow.addEventListener("click", function (e) {
    var b2 = e.target.closest ? e.target.closest("button") : null;
    if (!b2) return;
    setWeather(parseInt(b2.getAttribute("data-weather"), 10));
    S.weatherLock = true;           // 손으로 고른 날씨는 저절로 안 바뀐다 (K 와 같다)
    markWeather();
    S.worldDirty = true;
  });
  // 시점 (v96) — F5·F6 이 keydown 안에만 있어서, **v92 가 만든 몸을 폰 사용자는
  // 한 번도 못 봤다.** 과제 「사진사」도 F2 뿐이라 폰에서는 39/40 이 상한이었다.
  var vRow = document.getElementById("row-view");
  function markView() {
    if (!vRow) return;
    for (var k = 0; k < vRow.children.length; k++) {
      var vb = vRow.children[k];
      var dv = vb.getAttribute("data-view");
      if (dv === null) { vb.setAttribute("aria-current", S.photoMode ? "true" : "false"); continue; }
      vb.setAttribute("aria-current",
        (parseInt(dv, 10) === S.thirdPerson && !S.photoMode) ? "true" : "false");
    }
  }
  if (vRow) vRow.addEventListener("click", function (e) {
    var b3 = e.target.closest ? e.target.closest("button") : null;
    if (!b3) return;
    if (b3.id === "btn-photo") { setPhotoMode(!S.photoMode); markView(); return; }
    S.thirdPerson = parseInt(b3.getAttribute("data-view"), 10) || 0;
    markView();
  });
  refreshWorldPills = function () { markTime(); markWeather(); markView(); };
})();

// 사진 모드를 한 곳에서 켜고 끈다 (v96) — F6 도, 설정의 단추도, 미니 바도 이 길을 탄다
export function setPhotoMode(on) {
  S.photoMode = !!on;
  showHud(!S.photoMode && !S.hudHidden);
  if (S.photoMode) {
    player.flying = true;
    if (S.uiOpen) closePicker(true);
    if (helpOpen()) toggleHelp(false);
  }
  toast(S.photoMode ? "사진 모드 — F2 저장 · F5 3인칭 · F6 나가기" : "사진 모드 끔");
}

// 사진 모드 미니 바 — 저장 · 시점 · 나가기
(function bindPhotoBar() {
  var shot = document.getElementById("pb-shot");
  var view = document.getElementById("pb-view");
  var exit = document.getElementById("pb-exit");
  if (shot) shot.addEventListener("click", function (e) { e.stopPropagation(); S.wantShot = true; });
  if (view) view.addEventListener("click", function (e) {
    e.stopPropagation();
    S.thirdPerson = (S.thirdPerson + 1) % 3;
    toast(["1인칭", "3인칭 (뒤)", "3인칭 (앞)"][S.thirdPerson]);
  });
  if (exit) exit.addEventListener("click", function (e) { e.stopPropagation(); setPhotoMode(false); });
})();

// 모양을 바꾼다 — **지금 칸에 기억시킨다** (v82).
// 이 한 함수를 거치지 않는 대입이 하나라도 남으면 그 경로에서만 모양이 안 남는다.
export function setShapeMode(m) {
  S.shapeMode = ((m % 3) + 3) % 3;
  if (S.shapeBar) S.shapeBar[S.selected] = S.shapeMode;
  refreshBar();                      // 칸에 붙은 모양 글리프를 바로 고쳐 그린다
}

// 표식을 찍거나 지운다 — `B` 키와 폰의 "지도 탭" 이 같은 길을 탄다 (v83).
// 폰에는 표식을 찍을 길이 하나도 없었는데, v80 의 굴 어귀 점과 v81 의 ▲n/▼n 이
// 전부 "표식을 찍을 수 있다" 는 전제 위에 서 있었다.
// 지금 선 자리에 이미 있는 표식의 번호 — 없으면 -1
// **`toggleMark` 과 같은 것을 골라야 한다** — 3칸 안에 표식이 둘이면
// 길게 눌러 이름 붙인 것과 탭해서 지운 것이 서로 달라진다. 둘 다 **마지막** 것을 쓴다.
export function markHere() {
  var mx = Math.round(player.pos.x), mz = Math.round(player.pos.z);
  var near = -1;
  for (var mi = 0; mi < S.marks.length; mi++)
    if (Math.abs(S.marks[mi][0] - mx) < 3 && Math.abs(markZ(S.marks[mi]) - mz) < 3) near = mi;
  return near;
}
// 그 표식에 이름을 단다 (또는 지운다)
export function renameMarkHere() {
  var i = markHere();
  if (i < 0) return false;
  var m = S.marks[i];
  var nm = (window.prompt("표식 이름 (비우면 번호만)", markName(m) || "") || "").slice(0, 16);
  if (m.length >= 4) m[3] = nm;
  else S.marks[i] = [markX(m), markY(m), markZ(m), nm];
  S.worldDirty = true;
  toast(nm ? ("표식 이름 · " + nm) : "표식 이름 지움");
  tone(680, 0.07, "triangle", 0.05);
  return true;
}

export function toggleMark(named) {
  var mx = Math.round(player.pos.x), my = Math.round(player.pos.y), mz = Math.round(player.pos.z);
  var near = markHere();
  if (near >= 0) { S.marks.splice(near, 1); toast("표식 지움"); }
  else if (S.marks.length >= 12) toast("표식은 12개까지입니다");
  else {
    // 높이까지 담는다 — 지하 갱도 입구와 지상 탑이 지도에서 같은 점이었다.
    // 예전 저장의 [x, z] 두 원소도 그대로 읽히게, 길이로 구분한다 (저장 버전은 v5 그대로).
    // 이름을 붙이면 번호 대신 이름이 지도에 뜬다 — 사흘 뒤에 3번이 뭐였는지는 모른다.
    var nm = named ? (window.prompt("표식 이름 (비우면 번호만)", "") || "").slice(0, 16) : "";
    S.marks.push([mx, my, mz, nm]);
    // 좌표를 알려 준다 — 안 그러면 /tp 에 넣을 숫자를 알 길이 없다
    toast("표식 " + S.marks.length + (nm ? " · " + nm : "") + " · " + mx + " " + my + " " + mz);
    if (S.marks.length >= 5) unlock("explorer");
  }
  S.worldDirty = true;
  tone(620, 0.08, "triangle", 0.05);
}

// 미니맵 확대 — `[` `]` 와 폰의 "지도 길게 누르기" 가 같은 길을 탄다
export var MM_ZOOMS = [1, 2, 3, 4];
// 지상과 지하가 **각자** 배율을 기억한다 — 굴에서 ×4 로 올려놓고 올라오면
// 지상 지도가 24칸만 보였고, 다시 내려가면 또 맞춰야 했다 (자문 16차 #4).
export function cycleMinimapZoom(dir) {
  var under = S.mmUnder;
  var cur = under ? S.mmZoomUnder : S.mmZoom;
  var zi = MM_ZOOMS.indexOf(cur);
  if (zi < 0) zi = 0;
  zi = (zi + (dir > 0 ? 1 : MM_ZOOMS.length - 1)) % MM_ZOOMS.length;
  var next = MM_ZOOMS[zi];
  if (under) { S.mmZoomUnder = next; opts.mmzoomunder = next; }
  else { S.mmZoom = next; opts.mmzoom = next; }
  saveOpts();                               // 배율은 설정이다 — 껐다 켜도 남는다
  toast((under ? "단면 지도 ×" : "미니맵 ×") + next);
  tone(700 + next * 40, 0.05, "square", 0.04);
}

// 핫바 두 쪽을 맞바꾼다 — Tab 과 터치의 "목록 길게 누르기" 가 같은 길을 탄다
export function swapBarPage() {
  // 쪽마다 칸의 모양도 따로 기억한다 — 블록만 바꾸고 모양을 안 바꾸면
  // 2쪽으로 넘어갔을 때 1쪽의 계단이 따라온다
  if (S.shapeBar) S.shapeBar[S.selected] = S.shapeMode;
  var swapShape = S.shapeBar;
  S.shapeBar = S.shapeBarAlt;
  S.shapeBarAlt = swapShape;
  // 양동이에 담긴 것도 쪽마다 따라간다 (v90)
  var swapFill = S.fillBar;
  S.fillBar = S.fillBarAlt;
  S.fillBarAlt = swapFill;
  var swapBar = S.bar;
  S.bar = S.barAlt;
  S.barAlt = swapBar;
  S.barPage = S.barPage === 1 ? 2 : 1;
  refreshBar();
  S.worldDirty = true;
  if (S.shapeBar) S.shapeMode = S.shapeBar[S.selected] | 0;
  refreshBar();            // **모양을 되돌린 뒤에** 그린다 — 순서가 바뀌면 글리프가 지난 쪽 값으로 굳는다
  updateHandBlock();
  toast("핫바 " + S.barPage + "쪽");
  tone(520 + S.barPage * 90, 0.06, "square", 0.04);
}

export function pickBlock() {
  var hit = raycast(6);
  if (!hit) return;
  // 모양까지 가져온다 — 계단을 복사했는데 풀블록이 들리면 손이 헛돈다.
  // 계단 방향은 currentShape() 가 시선으로 정하므로 갈래만 맞추면 된다 (마크와 같다)
  var psh = hit.shape;
  var mode = (psh === SH_SLAB || psh === SH_SLAB_UP) ? 1 : (isStairShape(psh) ? 2 : 0);
  // 블록이 같아도 **모양 갈래가 다르면** 가져와야 한다.
  // 손에 온전한 돌을 들고 이미 놓은 돌계단을 복사하는 것이 계단을 잇는 가장 흔한 순간인데,
  // 예전에는 여기서 그냥 나가 버려 그 절반이 통과했다.
  if (S.bar[S.selected] === hit.block && S.shapeMode === mode) { toast(NAMES[hit.block]); return; }
  S.bar[S.selected] = hit.block;
  setShapeMode(mode);
  refreshSlot(S.selected);
  updateHandBlock();
  S.worldDirty = true;
  toast(NAMES[hit.block] + " 복사 · " + ["전체", "반블록", "계단"][S.shapeMode]);
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
    // 도움말도 S.uiOpen 을 세우므로(v67) 어느 창이 열렸는지 보고 닫는다 —
    // 안 그러면 closePicker 만 불러 도움말이 열린 채로 잠금만 풀린다
    if (helpOpen()) { toggleHelp(false); return; }
    if (S.uiOpen) { closePicker(true); return; }
    if (!S.lockMode && S.active) { endPlay(); return; }
    return;
  }
  if (!S.active) return;

  if (e.code === "KeyE") { e.preventDefault(); if (S.uiOpen) closePicker(true); else openPicker(); return; }
  // 도움말은 자기 키로 닫을 수 있어야 한다 — 아래 조기 반환보다 먼저 본다
  if (e.code === S.binds.help && helpOpen()) { toggleHelp(false); return; }
  if (S.uiOpen) {
    // 목록이 열린 동안에도 숫자키는 산다 — 어느 칸에 넣을지 고르는 데 쓴다.
    // 이것이 없으면 목록을 여닫으며 칸을 옮겨야 해서 팔레트를 짤 수가 없다.
    if (e.code.indexOf("Digit") === 0) {
      e.preventDefault();
      var dn = parseInt(e.code.slice(5), 10);
      selectSlot(dn === 0 ? 9 : dn - 1);
      refreshBar();
    }
    // 쪽 넘김도 산다 (v97) — 숫자키만 살려 두어서, 2쪽 열 칸을 채우려면
    // E→고르고→E→Tab→E 를 반복해야 했다. 건축 팔레트는 **20칸을 한 번에** 짜는 일이다
    if (e.code === "Tab") {
      e.preventDefault();
      swapBarPage();
      refreshBar();
    }
    return;
  }

  if (e.ctrlKey || e.metaKey) {
    // ── 영역 도구
    if (e.code === "KeyF") {
      e.preventDefault();
      // Shift 를 같이 누르면 채우는 대신 비운다 — 산을 깎을 때 쓴다
      var wipe = e.shiftKey;
      // 큰 영역은 한 프레임을 통째로 먹는다 — 왜 멈췄는지는 보여 준다
      var size = selectionSize();
      var blockPick = S.bar[S.selected], shapePick = currentShape(false);
      // 도구(양동이·부싯돌)를 든 채면 applyEdit 이 0칸을 돌려주는데, 화면에는
      // 엉뚱하게 "먼저 영역을 고르세요" 가 떴다 (영역은 골라 놨는데) — v98
      if (!wipe && isItem(blockPick)) { toast("도구는 채울 수 없습니다 — 블록을 고르세요"); return; }
      function doFill() {
        var n = wipe ? clearSelection() : fillSelection(blockPick, shapePick);
        toast(n < 0 ? ("영역이 너무 큽니다 (최대 " + REGION_MAX.toLocaleString("ko-KR") + "칸)")
                    : (n ? n.toLocaleString("ko-KR") + "칸을 " + (wipe ? "비웠습니다" : "채웠습니다")
                         : "먼저 영역을 고르세요"));
      }
      if (size > 6000) {
        // "…중" 과 채우기를 같은 태스크에서 하면 **그리기가 한 번도 안 일어난다** —
        // 첫 줄이 둘째 줄에 덮여 사라지고, 사람은 까닭 없는 멈춤만 겪는다.
        // 한 프레임 건너뛰어 첫 줄을 실제로 화면에 올린 뒤에 판다.
        toast(size.toLocaleString("ko-KR") + "칸 " + (wipe ? "비우는" : "채우는") + " 중…");
        requestAnimationFrame(function () { requestAnimationFrame(doFill); });
      } else doFill();
      return;
    }
    if (e.code === "KeyC") {
      e.preventDefault();
      var c = copySelection();
      toast(c < 0 ? "영역이 너무 큽니다" : (c ? c.toLocaleString("ko-KR") + "칸을 복사했습니다"
                                            : "먼저 영역을 고르세요"));
      return;
    }
    // Ctrl+R — 복사한 것을 90도 돌린다. 대칭 건물의 반대쪽을 손으로 다시 짓지 않게.
    // (R 단독은 새 세계라 못 쓰고, Alt+휠은 비행 속도라 겹친다)
    if (e.code === "KeyR") {
      e.preventDefault();
      // Shift 를 같이 누르면 거울 — 대칭 건물의 반대쪽이 이 한 번으로 나온다
      if (e.shiftKey) {
        if (!mirrorClip()) { toast("먼저 Ctrl+C 로 복사하세요"); return; }
        toast("복사한 것을 좌우로 뒤집었습니다");
        return;
      }
      if (!rotateClip()) { toast("먼저 Ctrl+C 로 복사하세요"); return; }
      toast("복사한 것을 90도 돌렸습니다 — " + S.clip.w + "×" + S.clip.h + "×" + S.clip.d);
      return;
    }
    if (e.code === "KeyV") {
      e.preventDefault();
      var hitV = raycast(6);
      if (!hitV) { toast("붙여넣을 자리를 조준하세요"); return; }
      // Shift 를 같이 누르면 **빈칸까지** 붙여넣는다 (v97) — 속을 비운 집을 옮길 때
      var withAir = e.shiftKey;
      var pn = pasteClip(hitV.x + hitV.nx, hitV.y + hitV.ny, hitV.z + hitV.nz, withAir);
      toast(pn ? (pn.toLocaleString("ko-KR") + "칸을 붙여넣었습니다" +
                  (withAir ? " (빈칸까지)" : ""))
               : "복사한 것이 없습니다");
      return;
    }
    if (e.code === "KeyD") {
      e.preventDefault();
      // 영역이 이미 없으면 **복사한 것까지** 비운다 (v97).
      // 한 번 Ctrl+C 하면 20×6×20 철사 상자가 조준선에 붙어 세션 내내 따라다녔고,
      // 떼어 낼 길이 세계를 갈아타는 것뿐이었다 (프레임마다 raycast 도 한 번 더 돌았다)
      if (!S.selA && !S.selB && S.clip) {
        S.clip = null;
        toast("복사한 것을 비웠습니다");
        return;
      }
      S.selA = S.selB = null;
      toast(S.clip ? "영역 선택 해제 — 한 번 더 누르면 복사한 것도 비웁니다"
                   : "영역 선택 해제");
      return;
    }
    if (e.code === "KeyZ") {
      e.preventDefault();
      var ok = e.shiftKey ? redo() : undo();
      var what = ok ? lastEditLabel : "";
      toast(ok ? ((e.shiftKey ? "다시하기" : "되돌리기") + (what ? " — " + what : ""))
               : (undoEmptyWhy || "더 없음"));
      return;
    }
    if (e.code === "KeyY") { e.preventDefault(); toast(redo() ? "다시하기" : "더 없음"); return; }
    return;
  }

  if (e.code.indexOf("Digit") === 0) {
    var n = parseInt(e.code.slice(5), 10);
    selectSlot(n === 0 ? 9 : n - 1);
  }
  if (e.code === "Tab") { e.preventDefault(); swapBarPage(); }
  if (e.code === S.binds.pick) pickBlock();
  if (e.code === S.binds.fly) {
    player.flying = !player.flying; player.vel.y = 0;
    tone(player.flying ? 660 : 330, 0.09, "square", 0.05);
    toast(player.flying ? "비행 모드" : "걷기 모드");
  }
  if (e.code === S.binds.shape) {
    setShapeMode(S.shapeMode + 1);
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
  if (e.code === "KeyB") toggleMark(e.shiftKey);
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
    // 3인칭을 끄지 않는다 — 사진 모드는 주인공을 찍는 자리이기도 하다 (v92)
    setPhotoMode(!S.photoMode);
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
    opts.mmcontour = S.contour ? 1 : 0; saveOpts();
    toast(S.contour ? "미니맵 등고선 켬" : "미니맵 등고선 끔");
  }
  if (e.code === "BracketLeft" || e.code === "BracketRight")
    cycleMinimapZoom(e.code === "BracketRight" ? 1 : -1);
  if (e.code === S.binds.help) { toggleHelp(true); setHelpTab(false); refreshAchList(); S.achListStale = false; advanceTut(6); }
  if (e.code === "KeyT") cycleTime();
  if (e.code === "KeyK") {
    setWeather((S.weather + 1) % 3);
    // 손으로 고른 순간 잠근다 — 다시 K 를 눌러야 바뀐다.
    // 노을에 사진을 찍으려고 맑음을 골랐는데 2분 뒤 비가 오면 사진 모드가 헛것이 된다.
    S.weatherLock = true;
    toast(["맑음", "비", "눈"][S.weather] + " (고정)");
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
      // 되돌릴 길이 있다는 것을 말해 준다 — 앞단은 R 두 번으로 막았지만
      // 뒷단(직전으로 되돌리기)이 있다는 걸 모르면 안전망이 없는 것과 같다
      toast("새 세계 · SEED " + S.worldSeed + " — 옛 세계는 설정 › 직전으로 되돌리기 에 있습니다");
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
    // 영역 찍기만 사거리가 길다 — 40×20 집터의 두 모서리를 잡으려고
    // 거기까지 날아갔다 돌아올 이유가 없다 (월드에디트 나무도끼도 보이는 데까지 찍힌다).
    var hs = aimCell(64, true);
    if (!hs) { toast("찍을 블록이 없습니다 — 지형을 겨누세요"); return; }
    if (e.button === 0) { S.selA = [hs[0], hs[1], hs[2]]; toast("영역 시작"); }
    else if (e.button === 2) {
      S.selB = [hs[0], hs[1], hs[2]];
      toast("영역 " + selectionText());
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
  // 튜토리얼 6번째 줄("스틱으로 걷고 화면을 끌어 둘러보세요") — 실제로 스틱을 밀면 넘어간다
  if (Math.abs(S.stick.x) + Math.abs(S.stick.z) > 0.4) advanceTutTouch(5);
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

// 시점 제스처는 **캔버스에서 시작한 것만** 잡혔다. 그런데 시점 영역(오른쪽 58%)의
// 38% 가 캔버스가 아니다 — 터치 단추 147×276 · 지도 105×123(화면 위 한가운데) · 핫바 402×46.
// 그 위에서 시작한 쓸기는 시점에 **영영 안 갔다** (v85 의 "움직이면 탭을 접는다" 는
// 탭만 접었지 넘겨주지는 못했다 — preventDefault 와 이벤트 라우팅은 무관하다).
// 임자 없는 터치가 8px 넘게 움직이면 그때 시점으로 **승격**시킨다 (자문 16차 #2).
var pendingTouch = {};
var LOOK_SLOP = 8;
// 제 몫의 끌기 제스처가 있는 UI 는 승격에서 뺀다 —
// 터치 단추는 **누른 채 반복**(캐기·놓기)이고 핫바는 **좌우로 쓸면 칸이 바뀐다.**
// 그 위에서 손가락이 조금 흔들렸다고 시점까지 같이 돌면 둘 다 어그러진다.
function ownsDrag(el) {
  for (var n = el; n; n = n.parentNode) {
    if (n.id === "tbtns" || n.id === "hotbar" || n.id === "stickzone" ||
        n.id === "photobar" || n.id === "regionbar") return true;   // 미니 바들도 임자가 있다 (v97·v99)
  }
  return false;
}
window.addEventListener("touchstart", function (e) {
  for (var pi = 0; pi < e.changedTouches.length; pi++) {
    var pt = e.changedTouches[pi];
    if (pt.target && pt.target.nodeType === 1 && ownsDrag(pt.target)) continue;
    pendingTouch[pt.identifier] = { x: pt.clientX, y: pt.clientY };
  }
}, { passive: true });
function promoteLook(e) {
  if (!S.active || S.uiOpen || S.lookId !== null) return;
  for (var i = 0; i < e.changedTouches.length; i++) {
    var t = e.changedTouches[i];
    if (t.identifier === S.stickId) continue;
    var st = pendingTouch[t.identifier];
    if (!st) continue;
    if (st.x <= window.innerWidth * 0.42) continue;        // 왼쪽은 스틱 자리다
    if (Math.abs(t.clientX - st.x) + Math.abs(t.clientY - st.y) <= LOOK_SLOP) continue;
    S.lookId = t.identifier;
    lookLast.x = t.clientX; lookLast.y = t.clientY;
    return;
  }
}

window.addEventListener("touchmove", function (e) {
  if (!S.active) return;
  promoteLook(e);
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
    // 데스크톱과 같은 사거리로 본다 (v98) — 터치만 6칸이라
    // 20×20 집터를 잡으려면 모서리마다 날아가야 했다
    var cell = aimCell(64, true);
    if (!cell) return;
    if (!S.selA || (S.selA && S.selB)) { S.selA = cell.slice(); S.selB = null; toast("영역 시작 — 모양 단추를 길게 눌러 도구를"); }
    else { S.selB = cell.slice(); toast("영역 " + selectionText() + " — 모양 단추를 길게"); }
  }, { passive: true });
})();

function endTouch(e) {
  for (var i = 0; i < e.changedTouches.length; i++) {
    var t = e.changedTouches[i];
    delete pendingTouch[t.identifier];
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
// 놓기는 눌러 두면 반복된다 — 벽 한 줄에 100번 탭하지 않게 (키보드와 같은 경로를 탄다)
bindHold("tb-place", function () { S.touchPlace = true; S.placeCooldown = 0; S.lastPlaceCell = -1; },
                     function () { S.touchPlace = false; });
bindHold("tb-jump", function () { S.keys.Space = true; }, function () { S.keys.Space = false; });
// 폰에는 픽블록이 없었다 — 이미 놓은 블록을 하나 더 놓으려면 55칸짜리 목록을 열어
// 찾아 누르는 길밖에 없었다. 크리에이티브 건축에서 가장 자주 쓰는 조작이다 (자문 12차 #5).
// 짧게 = 픽블록, **길게 = 시점 전환** (v96). 폰에는 F5 가 없어
// v92 가 만든 3인칭 몸을 볼 길이 아예 없었다
var pickHold = 0, pickLong = false;
bindHold("tb-pick", function () {
  pickLong = false;
  clearTimeout(pickHold);
  pickHold = setTimeout(function () {
    pickLong = true;
    S.thirdPerson = (S.thirdPerson + 1) % 3;
    toast(["1인칭", "3인칭 (뒤)", "3인칭 (앞)"][S.thirdPerson]);
  }, 450);
}, function () {
  clearTimeout(pickHold);
  if (pickLong) { pickLong = false; return; }
  pickBlock();
});
// 목록을 **길게 누르면** 핫바 2쪽 — 울타리·문·사다리·유리판·TNT·부싯돌 열 종이
// 폰에서는 아예 핫바로 못 나왔다. 짧게 누르면 예전처럼 목록이 열린다.
var listHold = 0, listHeld = false;
bindHold("tb-list", function () {
  listHeld = false;
  clearTimeout(listHold);
  listHold = setTimeout(function () { listHeld = true; swapBarPage(); }, 450);
}, function () {
  clearTimeout(listHold);
  if (listHeld) { listHeld = false; return; }
  if (S.uiOpen) closePicker(true); else openPicker();
});
bindHold("tb-sneak", function () {
  S.keys.ShiftLeft = true;
  advanceTutTouch(6);            // 마지막 줄("웅크림 버튼을 누른 채면 안 떨어집니다")
}, function () { S.keys.ShiftLeft = false; });
bindHold("tb-fly", function () {
  player.flying = !player.flying; player.vel.y = 0;
  toast(player.flying ? "비행 모드" : "걷기 모드");
});
// 폰에는 ESC 도 Ctrl+Z 도 없었다 — 설정·저장 슬롯·청사진·새 세계가 전부 메뉴 안인데
// 거기로 가는 길이 한 줄도 없어서, [플레이]를 누르면 그 세션은 끝까지 갇혔다.
// 메뉴는 짧게, **화면 표시 끄기는 길게** (v91).
// 폰에는 `F1` 이 없어 끌 수 없는 HUD 가 화면의 28.1% 를 먹었고,
// 과제 40개 중 "사진사" 하나만 기기 때문에 영영 안 열렸다.
var menuHold = 0, menuLong = false;
bindHold("tb-menu", function () {
  menuLong = false;
  clearTimeout(menuHold);
  menuHold = setTimeout(function () {
    menuLong = true;
    S.hudHidden = !S.hudHidden;
    showHud(!S.hudHidden);
    toast(S.hudHidden ? "화면 표시 끔 — 메뉴를 길게 눌러 되돌립니다" : "화면 표시 켬");
  }, 450);
}, function () {
  clearTimeout(menuHold);
  if (menuLong) { menuLong = false; return; }
  if (helpOpen()) { toggleHelp(false); return; }
  if (S.uiOpen) { closePicker(true); return; }
  endPlay();
});
// 폰에는 G 키가 없어 **반블록·계단에 갈 길이 화면에 하나도 없었다** —
// 30분을 지어도 나오는 건 네모 상자뿐이었다. 계단 모서리(v66)를 폰은 본 적이 없다.
// 짧게 = 모양 순환, **길게 = 영역 도구 바** (v98).
// 두 손가락 탭으로 영역은 찍히는데 그 영역으로 할 수 있는 일이 폰에 하나도 없었다 —
// 채우기·비우기·복사·붙여넣기가 단추에도 메뉴에도 없고 명령창도 못 열었다.
// 도움말은 "영역 도구는 키보드에서만" 이라는데 코드는 터치로 찍게 해 두었다
var shapeHold = 0, shapeLong = false;
bindHold("tb-shape", function () {
  shapeLong = false;
  clearTimeout(shapeHold);
  shapeHold = setTimeout(function () {
    shapeLong = true;
    toggleRegionBar();
  }, 450);
}, function () {
  clearTimeout(shapeHold);
  if (shapeLong) { shapeLong = false; return; }
  setShapeMode(S.shapeMode + 1);
  toast(["전체 블록", "반블록", "계단"][S.shapeMode]);
  updateHandBlock();
  advanceTutTouch(3);
});

export function toggleRegionBar(on) {
  S.regionBarOpen = (on === undefined) ? !S.regionBarOpen : !!on;
  showHud(!S.hudHidden && !S.photoMode);
  if (S.regionBarOpen) {
    toast(S.selA && S.selB ? ("영역 " + selectionText())
                           : "두 손가락으로 모서리 두 곳을 탭해 영역을 고르세요");
  }
}

// 영역 도구 바 — 키보드(Ctrl+F·Shift+F·C·V·D)와 **같은 길**을 탄다
(function bindRegionBar() {
  function say(n, done) {
    toast(n < 0 ? ("영역이 너무 큽니다 (최대 " + REGION_MAX.toLocaleString("ko-KR") + "칸)")
                : (n ? n.toLocaleString("ko-KR") + "칸을 " + done : "먼저 영역을 고르세요"));
  }
  function on(id, fn) {
    var el = document.getElementById(id);
    if (el) el.addEventListener("click", function (e) { e.stopPropagation(); fn(); });
  }
  on("rb-fill", function () {
    var b = S.bar[S.selected];
    if (isItem(b)) { toast("도구는 채울 수 없습니다 — 블록을 고르세요"); return; }
    say(fillSelection(b, currentShape(false)), "채웠습니다");
  });
  on("rb-wipe", function () { say(clearSelection(), "비웠습니다"); });
  on("rb-copy", function () { say(copySelection(), "복사했습니다"); });
  on("rb-paste", function () {
    // 키보드(Ctrl+V)와 같이 **맞은 면 바깥**에 놓는다 (v99).
    // aimCell 은 맞은 칸 자체라, 폰에서만 붙여넣기가 한 칸 안쪽으로 박혔다
    var h = raycast(64);
    if (!h) { toast("붙여넣을 자리를 조준하세요"); return; }
    var n = pasteClip(h.x + h.nx, h.y + h.ny, h.z + h.nz);
    toast(n ? n.toLocaleString("ko-KR") + "칸을 붙여넣었습니다" : "복사한 것이 없습니다");
  });
  on("rb-clear", function () {
    if (!S.selA && !S.selB && S.clip) { S.clip = null; toast("복사한 것을 비웠습니다"); return; }
    S.selA = S.selB = null;
    toggleRegionBar(false);
    toast("영역 선택 해제");
  });
})();
// 되돌리기는 짧게, **다시하기는 길게** (v91).
// 폰에는 `Ctrl+Y` 가 없어 되돌리기의 짝이 아예 없었다 — 메뉴를 누르려다 손이
// 한 칸 위로 가면 TNT 한 방(158칸)이 통째로 사라지고 되돌릴 길이 없었다.
var undoHold = 0, undoLong = false;
bindHold("tb-undo", function () {
  undoLong = false;
  clearTimeout(undoHold);
  undoHold = setTimeout(function () {
    undoLong = true;
    var re = redo();
    toast(re ? ("다시하기" + (lastEditLabel ? " — " + lastEditLabel : "")) : "다시할 것이 없습니다");
    tone(re ? 720 : 300, 0.07, "square", 0.04);
  }, 450);
}, function () {
  clearTimeout(undoHold);
  if (undoLong) { undoLong = false; return; }
  var ok = undo();
  toast(ok ? ("되돌리기" + (lastEditLabel ? " — " + lastEditLabel : ""))
           : (undoEmptyWhy || "더 없음"));
});

// ── 폰: 미니맵을 조작으로 쓴다 (v83)
// 폰에는 표식(B)도 시작 지점(V)도 확대([ ])도 갈 길이 하나도 없었다.
// 지도 자체가 그 셋의 자리다 — 탭하면 표식, 길게 누르면 확대.
// (#minimap 은 pointer-events:none 이라 CSS 에서 이 기기에만 켠다)
(function bindMinimapTouch() {
  var mm = document.getElementById("minimap");
  if (!mm || !IS_TOUCH) return;
  var held = 0, longed = false, moved = false, sx = 0, sy = 0;
  // **움직였으면 탭이 아니다.** 지도는 시점 영역(오른쪽 58%) 안에 통째로 들어앉아 있어서,
  // 위를 올려다보려고 쓸다 손가락이 지도에 닿으면 시점이 1도도 안 돌고 표식만 찍혔다.
  // 8px 넘게 움직이면 탭을 접고 **그 제스처를 시점에 넘긴다**(preventDefault 를 안 한다).
  var SLOP = 8;
  mm.addEventListener("touchstart", function (e) {
    var t = e.changedTouches && e.changedTouches[0];
    sx = t ? t.clientX : 0; sy = t ? t.clientY : 0;
    moved = false; longed = false;
    clearTimeout(held);
    held = setTimeout(function () {
      if (moved) return;
      longed = true;
      // 이미 표식이 선 자리에서 길게 누르면 **이름을 단다** (v87).
      // 폰에는 Shift+B 가 없어 표식 열두 개가 전부 똑같은 금색 점이었다 —
      // 코드가 스스로 그 문제를 적어 놓고도(hud.js) 폰에서만 안 지켜지고 있었다.
      // **`>= 0` 으로 본다.** 첫 표식의 번호는 0 이고, 0 은 거짓이다 —
      // 그냥 `if (markHere())` 로 두면 1번 표식부터만 이름이 붙는다.
      if (markHere() >= 0) renameMarkHere();
      else cycleMinimapZoom(1);
    }, 450);
  }, { passive: true });
  mm.addEventListener("touchmove", function (e) {
    if (moved) return;
    var t = e.changedTouches && e.changedTouches[0];
    if (!t) return;
    if (Math.abs(t.clientX - sx) + Math.abs(t.clientY - sy) > SLOP) {
      moved = true;
      clearTimeout(held);
    }
  }, { passive: true });
  mm.addEventListener("touchend", function (e) {
    clearTimeout(held);
    if (moved) { moved = false; longed = false; return; }   // 시점 쪽이 이미 처리했다
    if (longed) { longed = false; e.preventDefault(); return; }
    if (!S.active || S.uiOpen) return;
    e.preventDefault();
    toggleMark(false);
  }, { passive: false });
  mm.addEventListener("touchcancel", function () {
    clearTimeout(held); longed = false; moved = false;
  });
})();

window.addEventListener("resize", function () {
  camera.aspect = window.innerWidth / window.innerHeight;
  applyFov();                       // 좁은 창에서 가로 시야를 지킨다 (v93)
  S.fovNow = camera.fov;            // 달리기 보간이 옛 각도로 되돌리지 않게
  handCam.aspect = camera.aspect;
  handCam.fov = camera.aspect < 1 ? 74 : 52;
  handCam.updateProjectionMatrix();
  renderer.setSize(window.innerWidth, window.innerHeight);
  applyTbtn();                      // 단추가 화면 밖으로 자라지 않게 다시 잰다 (v93)
  applyUi();                        // HUD 도 화면에 맞춰 다시 잰다 (v96)
  // 화면 배율이 다른 모니터로 옮겨 갔을 수 있다 — 부팅 때 한 번 잡고 마는 값이었다
  renderer.setPixelRatio(Math.min(2, window.devicePixelRatio || 1));
});

window.addEventListener("beforeunload", function () { if (S.worldDirty) saveGame(); });
document.addEventListener("visibilitychange", function () {
  if (document.hidden && S.worldDirty) saveGame();
  // 탭을 뒤로 보내면 소리도 재운다 (v93) — rAF 가 멎어도 앰비언트 루프는
  // 마지막 게인 그대로 계속 울어서, 다른 탭에 가 있어도 스피커 아이콘이 켜져 있었다
  setAudioAwake(!document.hidden);
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
bindOpt("s-dig", "o-dig", "dig", function (v) { return ["보통", "빠름", "즉시"][v] || "보통"; });
// 켬/끔 설정 하나를 붙인다. 같은 다섯 줄을 설정마다 베껴 쓰면 새 설정에서 한 줄을 빠뜨린다.
// needApply — 화면에 바로 반영해야 하는 것(고대비·왼손잡이)만 applyOpts 를 부른다.
function bindCheck(id, outId, key, needApply) {
  var el = document.getElementById(id), out = document.getElementById(outId);
  if (!el) return;
  el.checked = !!opts[key];
  if (out) out.textContent = opts[key] ? "켬" : "끔";
  el.addEventListener("change", function () {
    opts[key] = el.checked ? 1 : 0;
    if (out) out.textContent = el.checked ? "켬" : "끔";
    if (needApply) applyOpts();
    saveOpts();
  });
  el.addEventListener("click", function (e) { e.stopPropagation(); });
}
bindCheck("s-inv", "o-inv", "invertY", false);
bindCheck("s-lefty", "o-lefty", "lefty", true);
bindCheck("s-hc", "o-hc", "contrast", true);
// 멀미 배려 — 머리 흔들림·달리기 시야각·구름 흐름을 한꺼번에 멈춘다
bindCheck("s-steady", "o-steady", "steady", false);
// 손목 배려 — Shift 를 붙들지 않고 눌러서 켜고 끈다
bindCheck("s-sneaktog", "o-sneaktog", "sneaktog", false);
// 불 번짐 — 끄면 붙인 불이 그 자리에서만 탄다 (마크의 doFireTick).
// 번진 불은 되돌리기가 못 잡으므로, 짓는 사람은 대개 꺼 두고 싶어 한다.
bindCheck("s-fire", "o-fire", "firespread", false);

// ══════════════════════════════════════════════════════════════
//  게임패드 — 마우스·키보드가 어려운 사람도 놀 수 있게
// ══════════════════════════════════════════════════════════════
export var padState = { on: false, lx: 0, ly: 0, rx: 0, ry: 0 };
var padPrev = {};
var padHeld = {};   // 패드가 지난 프레임에 실제로 누르고 있었는가

// 시작 화면에서도 패드를 읽는다 — A 를 눌러도 아무 일이 없으면 패드만으로는 못 들어온다.
// 여기서는 A 하나만 본다 (시점·이동은 플레이 중에만).
export function pollGamepadMenu() {
  if (S.active || !navigator.getGamepads) return;
  var pads = navigator.getGamepads(), g = null;
  for (var i = 0; i < pads.length; i++) if (pads[i] && pads[i].connected) { g = pads[i]; break; }
  if (!g) { padPrev[0] = false; return; }
  var now = !!(g.buttons[0] && g.buttons[0].pressed), was = padPrev[0];
  padPrev[0] = now;
  if (now && !was) requestPlay();
}

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
  // 베드락 기본 배치에 맞춘다 — RT 캐기 · LT 놓기 · LB/RB 핫바 · Y 목록 · 메뉴 일시정지
  var mine = pressed(7);                           // RT — 캐기 (RB 는 핫바로 넘겼다)
  if (mine) S.mouseDown[0] = true;
  else if (padHeld[7]) S.mouseDown[0] = false;
  // 놓기는 누르고 있으면 반복된다 — 마우스·터치와 같은 PLACE_DELAY/REPEAT 경로를 탄다
  var lay = pressed(6);
  if (lay && !padHeld[6]) { S.placeCooldown = 0; S.lastPlaceCell = -1; }
  if (lay) S.touchPlace = true;
  else if (padHeld[6]) S.touchPlace = false;
  // 왼스틱 클릭 — 달리기
  if (pressed(10)) S.keys.ControlLeft = true;
  else if (padHeld[10]) S.keys.ControlLeft = false;
  padHeld[0] = pressed(0); padHeld[1] = pressed(1);
  padHeld[6] = lay; padHeld[7] = pressed(7); padHeld[10] = pressed(10);

  if (tapped(4)) selectSlot(S.selected - 1);       // LB — 핫바 왼쪽
  if (tapped(5)) selectSlot(S.selected + 1);       // RB — 핫바 오른쪽
  if (tapped(2)) pickBlock();                      // X — 복사
  if (tapped(3)) { if (S.uiOpen) closePicker(true); else openPicker(); }   // Y — 블록 목록
  if (tapped(14)) selectSlot(S.selected - 1);      // 십자 좌
  if (tapped(15)) selectSlot(S.selected + 1);      // 십자 우
  // A 두 번 — 비행 토글 (마우스의 Space×2 와 같은 300ms 판정)
  if (tapped(0)) {
    var nowA = (window.performance && performance.now) ? performance.now() : Date.now();
    if (nowA - (S.padFlyTap || 0) < 300) { player.flying = !player.flying; player.vel.y = 0; S.padFlyTap = 0; }
    else S.padFlyTap = nowA;
  }
  if (tapped(9)) endPlay();                        // 메뉴 — 시작 화면으로
  return true;
}
