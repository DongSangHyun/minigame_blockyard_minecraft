// boot.js — 부팅 가드 · 환경 판별
import { S } from "./state.js";

export function bail(msg) {
  var card = document.querySelector(".card");
  if (!card) return;
  card.innerHTML = '<p class="eyebrow">VOXEL SANDBOX</p><h1>BLOCKYARD</h1>' +
    '<p class="lede">이 브라우저에서 3D(WebGL)를 시작할 수 없습니다.<br>' +
    '하드웨어 가속을 켠 최신 Chrome, Edge, Safari, Firefox에서 열어주세요.</p>' +
    '<p class="fineprint">' + msg + '</p>';
}
if (typeof THREE === "undefined") {
  bail("three.js를 불러오지 못했습니다.");
  throw new Error("three.js missing");
}

window.addEventListener("error", function (ev) {
  if (!S.booted) bail("초기화 오류 · " + ev.message + " (line " + ev.lineno + ")");
});

export var reduceMotion = window.matchMedia("(prefers-reduced-motion: reduce)").matches;

// 터치 기기 판별 — 렌더 해상도·기본 설정·전체화면 요청이 모두 이 값을 본다
export var IS_TOUCH = window.matchMedia("(hover: none)").matches ||
               (navigator.maxTouchPoints || 0) > 0 || "ontouchstart" in window;
