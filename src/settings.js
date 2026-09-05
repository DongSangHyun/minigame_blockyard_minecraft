// settings.js — 설정
import { S } from "./state.js";
import { IS_TOUCH } from "./boot.js";
import { camera, voxUniforms } from "./scene.js";

export var OPT_KEY = "blockyard.opts.v1";
export var opts = IS_TOUCH
  ? { sens: 100, fov: 78, far: 72, vol: 60, invertY: 0, day: 10, bright: 30 }
  : { sens: 100, fov: 72, far: 120, vol: 60, invertY: 0, day: 10, bright: 30 };
(function loadOpts() {
  try {
    var raw = localStorage.getItem(OPT_KEY);
    if (!raw) return;
    var d = JSON.parse(raw);
    ["sens", "fov", "far", "vol", "invertY", "day"].forEach(function (k) {
      if (typeof d[k] === "number" && isFinite(d[k])) opts[k] = d[k];
    });
  } catch (e) { /* 기본값 사용 */ }
})();
export function saveOpts() {
  try { localStorage.setItem(OPT_KEY, JSON.stringify(opts)); } catch (e) {}
}
export function applyOpts() {
  // 밝기 — 값이 클수록 어두운 곳이 밝아진다 (감마 지수는 반대로 간다)
  voxUniforms.uGamma.value = 1 / (0.7 + opts.bright / 100);
  camera.fov = opts.fov;
  camera.updateProjectionMatrix();
  voxUniforms.uFogFar.value = opts.far;
  voxUniforms.uFogNear.value = Math.max(8, opts.far * 0.35);
  if (S.masterGain) S.masterGain.gain.value = opts.vol / 100;
}
