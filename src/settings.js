// settings.js — 설정
import { S } from "./state.js";
import { IS_TOUCH } from "./boot.js";
import { camera, voxUniforms } from "./scene.js";

export var OPT_KEY = "blockyard.opts.v1";
export var opts = IS_TOUCH
  ? { sens: 100, fov: 78, far: 72, vol: 60, invertY: 0, day: 10 }
  : { sens: 100, fov: 72, far: 120, vol: 60, invertY: 0, day: 10 };
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
  camera.fov = opts.fov;
  camera.updateProjectionMatrix();
  voxUniforms.uFogFar.value = opts.far;
  voxUniforms.uFogNear.value = Math.max(8, opts.far * 0.35);
  if (S.masterGain) S.masterGain.gain.value = opts.vol / 100;
}
