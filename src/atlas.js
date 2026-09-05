// atlas.js — 텍스처 아틀라스 (코드로 그리는 16×16 도트)
import { TILES } from "./blocks.js";

export var TILE = 16, COLS = 16;
export var atlas = document.createElement("canvas");
atlas.width = atlas.height = TILE * COLS;
export var actx = atlas.getContext("2d");

export function tileOrigin(i) { return [(i % COLS) * TILE, Math.floor(i / COLS) * TILE]; }

export function makeRng(seed) {
  var s = seed >>> 0;
  return function () {
    s = (s + 0x6D2B79F5) >>> 0;
    var t = Math.imul(s ^ (s >>> 15), 1 | s);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

export function paint(index, fn) {
  var o = tileOrigin(index);
  var rng = makeRng(index * 7919 + 13);
  fn(function (x, y, color) {
    actx.fillStyle = color;
    actx.fillRect(o[0] + x, o[1] + y, 1, 1);
  }, rng);
}
export function pick(rng, list) { return list[Math.floor(rng() * list.length)]; }

paint(0, function (p, r) {   // 잔디 윗면
  var c = ["#5d8f3a", "#4e7d31", "#699c42", "#568636", "#618f3c"];
  for (var y = 0; y < 16; y++) for (var x = 0; x < 16; x++) p(x, y, pick(r, c));
});
paint(1, function (p, r) {   // 잔디 옆면
  var g = ["#5d8f3a", "#4e7d31", "#699c42"];
  var d = ["#6b4f34", "#5c432c", "#78593c", "#63482f"];
  for (var y = 0; y < 16; y++) for (var x = 0; x < 16; x++) p(x, y, y < 4 ? pick(r, g) : pick(r, d));
  for (var x2 = 0; x2 < 16; x2++) {
    var n = Math.floor(r() * 3);
    for (var k = 0; k < n; k++) p(x2, 4 + k, pick(r, g));
  }
});
paint(2, function (p, r) {   // 흙
  var d = ["#6b4f34", "#5c432c", "#78593c", "#63482f", "#7d5e40"];
  for (var y = 0; y < 16; y++) for (var x = 0; x < 16; x++) p(x, y, pick(r, d));
  for (var i = 0; i < 14; i++) p(Math.floor(r() * 16), Math.floor(r() * 16), "#4b3623");
});
paint(3, function (p, r) {   // 돌
  var s = ["#7d7d7d", "#727272", "#888888", "#6c6c6c", "#818181"];
  for (var y = 0; y < 16; y++) for (var x = 0; x < 16; x++) p(x, y, pick(r, s));
  for (var i = 0; i < 18; i++) p(Math.floor(r() * 16), Math.floor(r() * 16), "#5e5e5e");
  for (var j = 0; j < 6; j++) p(Math.floor(r() * 16), Math.floor(r() * 16), "#9a9a9a");
});
paint(4, function (p, r) {   // 모래
  var s = ["#d9cb8e", "#cfbf7d", "#e3d79c", "#d3c485"];
  for (var y = 0; y < 16; y++) for (var x = 0; x < 16; x++) p(x, y, pick(r, s));
  for (var i = 0; i < 10; i++) p(Math.floor(r() * 16), Math.floor(r() * 16), "#c0ae6b");
});
paint(5, function (p, r) {   // 통나무 옆면
  for (var x = 0; x < 16; x++) {
    var base = pick(r, ["#6b4f2a", "#5c4223", "#7a5c31"]);
    for (var y = 0; y < 16; y++) p(x, y, r() < 0.22 ? "#4d3719" : base);
  }
});
paint(6, function (p, r) {   // 통나무 윗면
  for (var y = 0; y < 16; y++) for (var x = 0; x < 16; x++) {
    var d = Math.max(Math.abs(x - 7.5), Math.abs(y - 7.5));
    var ring = Math.floor(d) % 2 === 0 ? "#a1793f" : "#8a6634";
    p(x, y, d < 1.6 ? "#6d4f27" : (r() < 0.12 ? "#7c5c2e" : ring));
  }
});
paint(7, function (p, r) {   // 나뭇잎
  var g = ["#3f7a2e", "#356b26", "#498c35", "#2e5c22"];
  for (var y = 0; y < 16; y++) for (var x = 0; x < 16; x++) p(x, y, pick(r, g));
  for (var i = 0; i < 26; i++) p(Math.floor(r() * 16), Math.floor(r() * 16), "#24491a");
});
paint(8, function (p, r) {   // 나무판자
  for (var y = 0; y < 16; y++) {
    var band = Math.floor(y / 4);
    for (var x = 0; x < 16; x++) {
      p(x, y, y % 4 === 3 ? "#7d5c30" : pick(r, ["#b0854a", "#a67c43", "#bb9053"]));
    }
    var joint = band % 2 === 0 ? 5 : 11;
    for (var k = 0; k < 3; k++) p(joint, band * 4 + k, "#7d5c30");
  }
});
paint(9, function (p, r) {   // 유리
  for (var y = 0; y < 16; y++) for (var x = 0; x < 16; x++) {
    var edge = x === 0 || y === 0 || x === 15 || y === 15;
    p(x, y, edge ? "rgba(214,238,246,0.62)" : "rgba(196,226,236,0.13)");
  }
  for (var i = 0; i < 6; i++) p(3 + i, 3 + i, "rgba(255,255,255,0.30)");
  for (var j = 0; j < 4; j++) p(6 + j, 3 + j, "rgba(255,255,255,0.22)");
});
paint(10, function (p, r) {  // 벽돌
  for (var y = 0; y < 16; y++) for (var x = 0; x < 16; x++) p(x, y, "#b9b0a4");
  for (var row = 0; row < 4; row++) {
    var off = row % 2 === 0 ? 0 : 8;
    for (var b = 0; b < 2; b++) {
      var bx = (off + b * 8) % 16;
      for (var yy = 0; yy < 3; yy++) for (var xx = 0; xx < 7; xx++) {
        p((bx + xx) % 16, row * 4 + yy, pick(r, ["#9c4b38", "#8d4231", "#a85440"]));
      }
    }
  }
});
paint(11, function (p, r) {  // 물
  for (var y = 0; y < 16; y++) for (var x = 0; x < 16; x++) {
    p(x, y, r() < 0.12 ? "rgba(66,131,196,0.76)" : "rgba(47,111,176,0.72)");
  }
});
paint(12, function (p, r) {  // 조약돌
  for (var y = 0; y < 16; y++) for (var x = 0; x < 16; x++) p(x, y, "#5a5a5a");
  for (var i = 0; i < 16; i++) {
    var cx = Math.floor(r() * 14) + 1, cy = Math.floor(r() * 14) + 1;
    var w = 2 + Math.floor(r() * 3), h = 2 + Math.floor(r() * 3);
    var tone = pick(r, ["#8b8b8b", "#7c7c7c", "#949494", "#6f6f6f"]);
    for (var yy = 0; yy < h; yy++) for (var xx = 0; xx < w; xx++) {
      if (cx + xx < 16 && cy + yy < 16) p(cx + xx, cy + yy, tone);
    }
  }
});
export function orePaint(tint1, tint2) {
  return function (p, r) {
    var s = ["#7d7d7d", "#727272", "#888888", "#6c6c6c"];
    for (var y = 0; y < 16; y++) for (var x = 0; x < 16; x++) p(x, y, pick(r, s));
    for (var i = 0; i < 5; i++) {
      var cx = 2 + Math.floor(r() * 11), cy = 2 + Math.floor(r() * 11);
      for (var yy = 0; yy < 3; yy++) for (var xx = 0; xx < 3; xx++) {
        if (r() < 0.25) continue;
        p(cx + xx, cy + yy, r() < 0.45 ? tint1 : tint2);
      }
    }
  };
}
paint(13, orePaint("#1c1c1c", "#2c2c2c"));   // 석탄
paint(14, orePaint("#d8a17c", "#c48a67"));   // 철
paint(15, function (p, r) {  // 눈 윗면
  var s = ["#f4f8fb", "#e9f0f6", "#fdfefe", "#dfe9f2"];
  for (var y = 0; y < 16; y++) for (var x = 0; x < 16; x++) p(x, y, pick(r, s));
  for (var i = 0; i < 8; i++) p(Math.floor(r() * 16), Math.floor(r() * 16), "#cfdce8");
});
paint(16, function (p, r) {  // 램프 — 격자 사이로 빛이 새는 느낌
  for (var y = 0; y < 16; y++) for (var x = 0; x < 16; x++) {
    var grid = (x % 5 === 0 || y % 5 === 0);
    p(x, y, grid ? "#6d5426" : pick(r, ["#ffe9a8", "#ffd977", "#fff3c9", "#ffcf5e"]));
  }
  for (var i = 0; i < 10; i++) p(Math.floor(r() * 16), Math.floor(r() * 16), "#fffbe8");
});
paint(18, function (p, r) {  // 자갈
  var g = ["#8a8580", "#7b7671", "#98938d", "#6f6b66"];
  for (var y = 0; y < 16; y++) for (var x = 0; x < 16; x++) p(x, y, pick(r, g));
  for (var i = 0; i < 22; i++) {
    var cx = Math.floor(r() * 15), cy = Math.floor(r() * 15);
    var tone = pick(r, ["#5e5a56", "#a8a39d", "#6b6763"]);
    p(cx, cy, tone); p(cx + 1, cy, tone); p(cx, cy + 1, tone);
  }
});
paint(34, orePaint("#f2c14a", "#d9a327"));   // 금
paint(35, orePaint("#57e0d8", "#2fb9b1"));   // 다이아

paint(30, function (p, r) {  // 자작나무 옆면 — 흰 껍질과 검은 옹이
  var w = ["#e8e4d8", "#dcd7c8", "#f1eee4", "#d2ccbc"];
  for (var y = 0; y < 16; y++) for (var x = 0; x < 16; x++) p(x, y, pick(r, w));
  for (var k = 0; k < 7; k++) {
    var sy = Math.floor(r() * 16), sx = Math.floor(r() * 13);
    var len = 2 + Math.floor(r() * 4);
    for (var i = 0; i < len; i++) p(sx + i, sy, r() < 0.5 ? "#3a352c" : "#4a4438");
  }
});

paint(31, function (p, r) {  // 자작나무 윗면
  var base = ["#d8c9a4", "#cbbb95", "#e2d5b3"];
  for (var y = 0; y < 16; y++) for (var x = 0; x < 16; x++) p(x, y, pick(r, base));
  for (var y2 = 0; y2 < 16; y2++) for (var x2 = 0; x2 < 16; x2++) {
    var d = Math.max(Math.abs(x2 - 7.5), Math.abs(y2 - 7.5));
    if (Math.floor(d) % 3 === 0) p(x2, y2, "#b3a17c");
  }
});

paint(32, function (p, r) {  // 자작나무 잎 — 밝은 연둣빛
  var g = ["#7fae4a", "#8fbc57", "#6f9d3f", "#98c463"];
  for (var y = 0; y < 16; y++) for (var x = 0; x < 16; x++) {
    if (r() < 0.06) continue;                 // 잎 사이 틈
    p(x, y, pick(r, g));
  }
});

paint(33, function (p, r) {  // 가문비나무 잎 — 짙고 푸른 녹색
  var g = ["#2f5a35", "#274c2c", "#38683d", "#1f3f24"];
  for (var y = 0; y < 16; y++) for (var x = 0; x < 16; x++) {
    if (r() < 0.07) continue;
    p(x, y, pick(r, g));
  }
});

paint(26, function (p, r) {  // 선인장 옆면 — 세로 골과 가시
  var g = ["#3f7a34", "#356b2c", "#498c3d", "#2e5c26"];
  for (var y = 0; y < 16; y++) for (var x = 0; x < 16; x++) p(x, y, pick(r, g));
  for (var y2 = 0; y2 < 16; y2++) { p(1, y2, "#28511f"); p(14, y2, "#28511f"); }
  for (var k = 0; k < 9; k++) {
    var sy = 1 + Math.floor(r() * 14);
    p(0, sy, "#d9dfae"); p(15, sy, "#d9dfae");
    p(7 + Math.floor(r() * 2), sy, "#cfd6a2");
  }
});

paint(27, function (p, r) {  // 선인장 윗면
  var g = ["#4e8c42", "#448038", "#579a4b"];
  for (var y = 0; y < 16; y++) for (var x = 0; x < 16; x++) p(x, y, pick(r, g));
  for (var y2 = 4; y2 < 12; y2++) for (var x2 = 4; x2 < 12; x2++) p(x2, y2, "#2e5c26");
});

paint(28, function (p, r) {  // 죽은 덤불 — 마른 가지
  var b = ["#7a5a2e", "#8d6a37", "#694d27"];
  for (var k = 0; k < 5; k++) {
    var bx = 3 + Math.floor(r() * 10);
    var top = 3 + Math.floor(r() * 6);
    for (var y = 15; y > top; y--) {
      var lean = Math.floor((15 - y) * (r() < 0.5 ? 0.22 : -0.22));
      p(bx + lean, y, pick(r, b));
    }
    p(bx - 1, top + 2, pick(r, b)); p(bx + 1, top + 3, pick(r, b));
  }
});

paint(29, function (p, r) {  // 마른 풀 — 설원의 누런 포기
  var g = ["#a89a63", "#93864f", "#bdae76", "#7e7343"];
  for (var b2 = 0; b2 < 7; b2++) {
    var bx = 1 + Math.floor(r() * 14);
    var top = 4 + Math.floor(r() * 6);
    for (var y = 15; y > top; y--) {
      var lean = Math.floor((15 - y) * (r() < 0.5 ? 0.18 : -0.18));
      p(bx + lean, y, g[Math.min(3, Math.floor((15 - y) / 4))]);
    }
  }
});

paint(22, function (p, r) {  // 풀 포기 — 아래는 짙고 위로 갈수록 밝다
  var g = ["#5d8f3a", "#4e7d31", "#699c42", "#74a94a"];
  for (var b2 = 0; b2 < 7; b2++) {
    var bx = 1 + Math.floor(r() * 14);
    var top = 3 + Math.floor(r() * 6);
    for (var y = 15; y > top; y--) {
      var lean = Math.floor((15 - y) * (r() < 0.5 ? 0.16 : -0.16));
      p(bx + lean, y, g[Math.min(3, Math.floor((15 - y) / 4))]);
    }
  }
});

paint(23, function (p, r) {  // 양귀비 — 붉은 꽃
  for (var y = 15; y > 6; y--) p(7, y, y > 11 ? "#3f7a2e" : "#4e8c39");
  p(5, 9, "#4e8c39"); p(10, 10, "#4e8c39");
  var petal = ["#d0402f", "#e05446", "#b73325"];
  var cells = [[6,3],[7,3],[8,3],[5,4],[6,4],[7,4],[8,4],[9,4],
               [5,5],[6,5],[8,5],[9,5],[6,6],[7,6],[8,6]];
  for (var i = 0; i < cells.length; i++) p(cells[i][0], cells[i][1], pick(r, petal));
  p(7, 5, "#f0d774");
});

paint(24, function (p, r) {  // 민들레 — 노란 꽃
  for (var y = 15; y > 6; y--) p(8, y, y > 11 ? "#3f7a2e" : "#4e8c39");
  p(6, 10, "#4e8c39"); p(11, 11, "#4e8c39");
  var petal = ["#e8c53a", "#f2d95c", "#d4ad25"];
  var cells = [[7,3],[8,3],[9,3],[6,4],[7,4],[8,4],[9,4],[10,4],
               [6,5],[7,5],[8,5],[9,5],[10,5],[7,6],[8,6],[9,6]];
  for (var i = 0; i < cells.length; i++) p(cells[i][0], cells[i][1], pick(r, petal));
});

paint(25, function (p, r) {  // 횃불 — 나무 막대 + 타는 머리
  for (var y = 15; y >= 6; y--) { p(7, y, "#6b4f2a"); p(8, y, "#7d5e33"); }
  p(7, 5, "#c98a2e"); p(8, 5, "#d99a35");
  p(6, 4, "#e8a33a"); p(7, 4, "#ffcf6b"); p(8, 4, "#ffd97e"); p(9, 4, "#e8a33a");
  p(7, 3, "#fff0b8"); p(8, 3, "#ffe89a");
  p(7, 2, "#ffd97e");
});

paint(20, function (p, r) {  // 용암 — 어두운 겉껍질 사이로 밝은 속이 비친다
  var crust = ["#8a2f10", "#7a2a0e", "#a03b14", "#6d240c"];
  for (var y = 0; y < 16; y++) for (var x = 0; x < 16; x++) p(x, y, pick(r, crust));
  for (var k = 0; k < 26; k++) {
    var cx = Math.floor(r() * 15), cy = Math.floor(r() * 15);
    var hot = pick(r, ["#ff9a3c", "#ffc45e", "#ff7a1f", "#ffe08a"]);
    p(cx, cy, hot); p(cx + 1, cy, hot);
    if (r() < 0.6) p(cx, cy + 1, hot);
  }
});

paint(21, function (p, r) {  // 얼음 — 살짝 비치는 창백한 푸른빛
  for (var y = 0; y < 16; y++) for (var x = 0; x < 16; x++) {
    p(x, y, r() < 0.15 ? "rgba(198,232,246,0.80)" : "rgba(158,206,234,0.72)");
  }
  for (var k = 0; k < 5; k++) {
    var sx = Math.floor(r() * 12) + 2, sy = Math.floor(r() * 12) + 2;
    var len = 3 + Math.floor(r() * 5), dx = r() < 0.5 ? 1 : -1;
    for (var i = 0; i < len; i++) p(sx + i * dx, sy + i, "rgba(236,250,255,0.88)");
  }
});

paint(19, function (p, r) {  // 기반암 — 얼룩덜룩한 검은 돌, "여기가 끝"
  var g = ["#2b2b30", "#1d1d21", "#3a3a41", "#141417", "#33333a"];
  for (var y = 0; y < 16; y++) for (var x = 0; x < 16; x++) {
    p(x, y, pick(r, g));
  }
  for (var k = 0; k < 22; k++) {
    var cx = Math.floor(r() * 15), cy = Math.floor(r() * 15);
    var tone2 = r() < 0.5 ? "#0c0c0e" : "#474751";
    p(cx, cy, tone2); p(cx + 1, cy, tone2);
    p(cx, cy + 1, tone2); p(cx + 1, cy + 1, tone2);
  }
});

paint(17, function (p, r) {  // 눈 옆면 — 위는 눈, 아래는 흙
  var s = ["#f4f8fb", "#e9f0f6", "#fdfefe"];
  var d = ["#6b4f34", "#5c432c", "#78593c", "#63482f"];
  for (var y = 0; y < 16; y++) for (var x = 0; x < 16; x++) p(x, y, y < 5 ? pick(r, s) : pick(r, d));
  for (var x2 = 0; x2 < 16; x2++) {
    var n = Math.floor(r() * 3);
    for (var k = 0; k < n; k++) p(x2, 5 + k, pick(r, s));
  }
});

export var atlasTex = new THREE.CanvasTexture(atlas);
atlasTex.magFilter = THREE.NearestFilter;
atlasTex.minFilter = THREE.NearestFilter;
atlasTex.generateMipmaps = false;
atlasTex.wrapS = atlasTex.wrapT = THREE.ClampToEdgeWrapping;

export function tileAvg(i) {
  var o = tileOrigin(i);
  var d = actx.getImageData(o[0], o[1], TILE, TILE).data;
  var r = 0, g = 0, b = 0, n = 0;
  for (var k = 0; k < d.length; k += 4) {
    var a = d[k + 3] / 255;
    if (a < 0.05) continue;
    r += d[k] * a; g += d[k + 1] * a; b += d[k + 2] * a; n += a;
  }
  if (!n) return [140, 160, 180];
  return [r / n, g / n, b / n];
}
export var AVG_TOP = {}, AVG_SIDE = {};
Object.keys(TILES).forEach(function (id) {
  AVG_TOP[id] = tileAvg(TILES[id][0]);
  AVG_SIDE[id] = tileAvg(TILES[id][1]);
});

export var crackTex = [];
(function () {
  for (var s = 0; s < 4; s++) {
    var cv = document.createElement("canvas");
    cv.width = cv.height = TILE;
    var c = cv.getContext("2d");
    var rng = makeRng(99 + s);
    c.fillStyle = "rgba(0,0,0,0.62)";
    for (var i = 0, strokes = 3 + s * 4; i < strokes; i++) {
      var x = Math.floor(rng() * 14) + 1, y = Math.floor(rng() * 14) + 1;
      var len = 3 + Math.floor(rng() * (3 + s * 2));
      var dx = rng() < 0.5 ? 1 : -1, dy = rng() < 0.5 ? 1 : -1;
      for (var k = 0; k < len; k++) {
        if (x < 0 || y < 0 || x > 15 || y > 15) break;
        c.fillRect(x, y, 1, 1);
        if (rng() < 0.6) x += dx; else y += dy;
      }
    }
    var t = new THREE.CanvasTexture(cv);
    t.magFilter = t.minFilter = THREE.NearestFilter;
    t.generateMipmaps = false;
    crackTex.push(t);
  }
})();

// ── 액체 애니메이션 — 물과 용암 타일을 세로로 흘려 정지 화면을 면한다.
// 셰이더를 건드리지 않고 아틀라스의 두 타일만 다시 칠한다 (16×16 두 장이라 값이 싸다).
var LIQUID_TILES = [11, 20];        // 물 · 용암
var liquidSrc = {};
LIQUID_TILES.forEach(function (i) {
  var o = tileOrigin(i);
  liquidSrc[i] = actx.getImageData(o[0], o[1], TILE, TILE);
});

function scrollTile(i, shift, boost) {
  var src = liquidSrc[i].data, o = tileOrigin(i);
  var out = actx.createImageData(TILE, TILE), dst = out.data;
  for (var y = 0; y < TILE; y++) {
    var sy = ((y + shift) % TILE + TILE) % TILE;
    for (var x = 0; x < TILE; x++) {
      var d = (y * TILE + x) * 4, s2 = (sy * TILE + x) * 4;
      dst[d] = Math.min(255, src[s2] * boost);
      dst[d + 1] = Math.min(255, src[s2 + 1] * boost);
      dst[d + 2] = Math.min(255, src[s2 + 2] * boost);
      dst[d + 3] = src[s2 + 3];
    }
  }
  actx.putImageData(out, o[0], o[1]);
}

export function animateLiquids(t) {
  scrollTile(11, Math.floor(t * 6) % TILE, 1);
  scrollTile(20, Math.floor(t * 2.5) % TILE, 0.94 + 0.10 * Math.sin(t * 3.1));
  atlasTex.needsUpdate = true;
}
