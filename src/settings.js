// settings.js — 설정
import { S } from "./state.js";
import { IS_TOUCH, reduceMotion } from "./boot.js";
import { camera, voxUniforms } from "./scene.js";

export var OPT_KEY = "blockyard.opts.v1";
export var opts = IS_TOUCH
  ? { sens: 100, fov: 78, far: 72, vol: 60, invertY: 0, day: 20, bright: 30, ui: 110, contrast: 0, lefty: 0, tbtn: 100, autosave: 20, undo: 240, steady: 0, sneaktog: 0 }
  : { sens: 100, fov: 72, far: 120, vol: 60, invertY: 0, day: 20, bright: 30, ui: 100, contrast: 0, lefty: 0, tbtn: 100, autosave: 20, undo: 240, steady: 0, sneaktog: 0 };
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
  // 밝기 — 값이 클수록 어두운 곳이 밝아진다 (감마 지수는 반대로 간다)
  voxUniforms.uGamma.value = 1 / (0.7 + opts.bright / 100);
  // 화면 표시 크기 — 폰에서 HUD 가 작다는 불평을 설정으로 푼다
  document.documentElement.style.setProperty("--ui", (opts.ui / 100).toFixed(2));
  S.farNow = opts.far;      // 슬라이더를 움직이면 자동 조절도 거기서 다시 시작한다
  // 고대비 — UI 테두리와 글자를 또렷하게 (밝은 곳·색약 배려)
  document.documentElement.classList.toggle("hc", !!opts.contrast);
  document.documentElement.classList.toggle("lefty", !!opts.lefty);
  document.documentElement.style.setProperty("--tbtn", ((opts.tbtn || 100) / 100).toFixed(2));
  camera.fov = opts.fov;
  camera.updateProjectionMatrix();
  voxUniforms.uFogFar.value = opts.far;
  voxUniforms.uFogNear.value = Math.max(8, opts.far * 0.35);
  if (S.masterGain) S.masterGain.gain.value = opts.vol / 100;
}
