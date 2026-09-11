// settings.js — 설정
import { S } from "./state.js";
import { IS_TOUCH, reduceMotion } from "./boot.js";
import { camera, voxUniforms } from "./scene.js";

export var OPT_KEY = "blockyard.opts.v1";
export var opts = IS_TOUCH
  ? { sens: 100, fov: 78, far: 72, vol: 60, invertY: 0, day: 20, bright: 30, ui: 110, contrast: 0, lefty: 0, tbtn: 100, autosave: 20, undo: 240, steady: 0, sneaktog: 0, dig: 1, firespread: 1, mmzoom: 1, mmzoomunder: 3, mmcontour: 1 }
  : { sens: 100, fov: 72, far: 120, vol: 60, invertY: 0, day: 20, bright: 30, ui: 100, contrast: 0, lefty: 0, tbtn: 100, autosave: 20, undo: 240, steady: 0, sneaktog: 0, dig: 1, firespread: 1, mmzoom: 1, mmzoomunder: 3, mmcontour: 1 };
(function loadOpts() {
  try {
    var raw = localStorage.getItem(OPT_KEY);
    if (!raw) return;
    var d = JSON.parse(raw);
    // 목록을 따로 두면 설정을 늘릴 때마다 빠뜨린다 — 기본값에 있는 키를 전부 읽는다
    Object.keys(opts).forEach(function (k) {
      if (typeof d[k] === "number" && isFinite(d[k])) opts[k] = d[k];
    });
  } catch (e) { /* 기본값 사용 */ }
})();
// 화면이 흔들려도 되는가 — OS 의 "동작 줄이기" 와 게임 안 설정을 한자리에서 본다.
// 흩어져 있으면 새 흔들림을 넣을 때마다 한쪽을 빠뜨린다.
export function calmMotion() { return reduceMotion || !!opts.steady; }
export function saveOpts() {
  try { localStorage.setItem(OPT_KEY, JSON.stringify(opts)); } catch (e) {}
}
export function applyOpts() {
  // 지도 배율과 등고선은 **설정**이다 — 세계마다 다를 이유가 없다.
  // 저장을 안 하면 폰에서 매 세션 450ms 길게 누르기부터 해야 한다 (자문 15차 #7).
  // 지상과 지하는 **다른 축척**이 필요하다 — 지하는 밝히는 반경이 8칸인데 ×1 은 96칸을
  // 다 그린다(폰에서 한 칸 0.875px). 갱도를 통째로 걸어도 잉크가 9~11% 였다.
  // 한 값을 나눠 쓰면 오르내릴 때마다 다시 맞춰야 한다 (자문 16차 #4).
  S.mmZoom = [1, 2, 3, 4].indexOf(opts.mmzoom) >= 0 ? opts.mmzoom : 1;
  S.mmZoomUnder = [1, 2, 3, 4].indexOf(opts.mmzoomunder) >= 0 ? opts.mmzoomunder : 3;
  S.contour = !!opts.mmcontour;
  // 밝기 — 값이 클수록 어두운 곳이 밝아진다 (감마 지수는 반대로 간다)
  voxUniforms.uGamma.value = 1 / (0.7 + opts.bright / 100);
  applyUi();
  S.farNow = opts.far;      // 슬라이더를 움직이면 자동 조절도 거기서 다시 시작한다
  // 고대비 — UI 테두리와 글자를 또렷하게 (밝은 곳·색약 배려)
  document.documentElement.classList.toggle("hc", !!opts.contrast);
  // 「화면 흔들림·번쩍임 줄이기」를 CSS 도 보게 한다 (v113) —
  // 예전에는 prefers-reduced-motion 블록이 **OS 설정에만** 걸려 있어서,
  // 게임 안 체크박스를 켠 사람은 토스트·스틱 트랜지션 감속을 못 받았다
  document.documentElement.classList.toggle("steady", calmMotion());
  document.documentElement.classList.toggle("lefty", !!opts.lefty);
  applyTbtn();
  applyFov();
  voxUniforms.uFogFar.value = opts.far;
  voxUniforms.uFogNear.value = Math.max(8, opts.far * 0.35);
  if (S.masterGain) S.masterGain.gain.value = opts.vol / 100;
}

// 화면 표시 크기 — 폰에서 HUD 가 작다는 불평을 설정으로 푼다.
// v96 부터 **화면에 맞춰 자른다**: 힌트 띠가 핫바를 덮는 것이 데스크톱 110%·폰 120% 부터고,
// 폰 160% 부터는 **미니맵이 조준선을 삼켰다**(844×390 에서 지도가 화면 정중앙으로 내려온다).
// 「화면 표시 크기」는 글자가 작다는 사람이 먼저 만지는 손잡이인데, 끝까지 올리면
// 조준을 못 하게 됐다 — v93 이 터치 단추에서 고친 것과 같은 모양이다.
// 상한의 기준 높이 — 390px(가로 폰)에서 1.30, 640px 창에서 2.13 이 된다.
// v96 이 470 으로 잡았더니 **폰 기본값 110% 가 100% 로 깎였다**(390/470 = 0.83 → 1.00).
// HUD 를 키우려고 만든 슬라이더가 폰에서 오히려 작게 만들면 안 된다 (v97).
export var UI_MIN_H = 300;
export function applyUi() {
  var want = (opts.ui || 100) / 100;
  var h = window.innerHeight || 800;
  var cap = Math.max(1.1, h / UI_MIN_H);
  // **잘린 값을 남긴다** (v113) — 폰 844×390 에서 슬라이더를 150% 로 올려도 1.30 에서
  // 잘리는데, 출력칸은 "150%" 라고 그대로 썼다. 눈금의 위쪽 28%가 아무 일도 안 하면서
  // 안 하는 티도 안 냈다. 고를 수 있는데 안 듣는 눈금을 남기지 않는다 (마크의 GUI Scale).
  S.uiScale = Math.min(want, cap);
  document.documentElement.style.setProperty("--ui", S.uiScale.toFixed(2));
}

// 터치 단추 크기 — 슬라이더(80~160%)를 화면 높이로 **잘라서** 먹인다 (v93).
// #tbtns 는 bottom 기준으로 붙어 있고 zoom 은 위로 자란다. 폰 844×390 에서
// 기본 100% 일 때 위 여유가 18px 뿐이라, 110% 만 되어도 「캐기·놓기」가 화면 밖으로
// 나갔고 160% 에서는 캐기·놓기·점프·비행 넷이 통째로 사라졌다 — 슬라이더의 위쪽 절반이
// 게임을 못 하게 만들고 있었다. 커지면 잘리는 대신 **더 안 커진다.**
export function applyTbtn() {
  var want = (opts.tbtn || 100) / 100;
  var el = document.getElementById("tbtns");
  var root = document.documentElement;
  if (!el) { root.style.setProperty("--tbtn", want.toFixed(2)); return; }
  // 배율 1 일 때의 제 높이를 잰다 (zoom 이 걸린 채로 재면 이미 커진 값이 나온다)
  var prev = el.style.zoom;
  el.style.zoom = "1";
  var natural = el.offsetHeight;
  el.style.zoom = prev;
  if (!natural) { root.style.setProperty("--tbtn", want.toFixed(2)); return; }
  // 아래 여백(54~84px + 안전영역)과 위쪽 핫바·계기판 자리를 남긴다
  var bottom = parseFloat(getComputedStyle(el).bottom) || 84;
  var avail = window.innerHeight - bottom - TBTN_TOP_KEEP;
  var maxZoom = avail / natural;
  S.tbtnScale = Math.max(0.8, Math.min(want, maxZoom));      // 잘린 값을 설정 화면이 읽는다 (v113)
  root.style.setProperty("--tbtn", S.tbtnScale.toFixed(2));
}
export var TBTN_TOP_KEEP = 12;   // 화면 위쪽에 남겨 두는 여백(px)

// 시야각 — 슬라이더는 **가로** 화각으로 읽히는데 three 의 fov 는 세로다 (v93).
// 그대로 박으면 창 모양에 따라 보이는 세상이 2.7배로 흔들렸다:
// 1600×900 에서 수평 104.5° 인 설정이 700×1100 반쪽 창에서는 49.6° 였다.
// 16:9 를 기준으로 삼고, 그보다 좁은 창에서는 세로 화각을 키워 가로를 지킨다(hor+).
export var FOV_BASE_ASPECT = 16 / 9;
export function fovForAspect(fovDeg, aspect) {
  if (!aspect || aspect >= FOV_BASE_ASPECT) return fovDeg;
  var half = fovDeg * Math.PI / 360;
  var hHalf = Math.atan(Math.tan(half) * FOV_BASE_ASPECT);      // 기준 창의 가로 반각
  var vHalf = Math.atan(Math.tan(hHalf) / aspect);              // 지금 창에서 그 가로를 내려면
  return Math.min(118, vHalf * 360 / Math.PI);
}
export function applyFov() {
  camera.fov = fovForAspect(opts.fov, camera.aspect);
  camera.updateProjectionMatrix();
}
