// tree.js — 나무 한 그루의 모양
// 세계 생성과 (앞으로 들어올) 묘목 자람이 같은 그림을 쓰게 하려고 따로 뺐다.
// 여기서는 아무것도 import 하지 않는다 — 블록 번호도 부르는 쪽이 넘긴다.
// 그래야 생성(set)과 편집(applyEdit)이 같은 함수를 쓸 수 있다.

// x,y,z — 줄기가 설 자리(땅 바로 위 칸이 y+1 이 되도록 y 는 땅 높이)
// kind  — 0 참나무 · 1 자작나무 · 2 가문비나무
// logB·leafB — 이 종류가 쓸 원목·잎 블록 번호
// rnd   — 0~1 난수 함수 (생성은 시드 난수, 묘목은 Math.random)
// peek  — peek(x,y,z) 현재 블록 (경계 밖은 아무 값이나. 잎은 AIR 자리에만 놓는다)
// put   — put(x,y,z,블록) 놓는 방법 (생성은 set, 묘목은 applyEdit)
// air   — "빈 칸" 블록 번호
// maxY  — 세계 높이. 우듬지가 여기 닿으면 심지 않는다
// 돌려주는 값 — 심었으면 true
export function growTree(x, y, z, kind, logB, leafB, rnd, peek, put, air, maxY) {
  var spruce = kind === 2;
  var trunk = spruce ? 5 + Math.floor(rnd() * 3)
            : (kind === 1 ? 5 + Math.floor(rnd() * 3) : 4 + Math.floor(rnd() * 3));
  if (y + trunk + 4 >= maxY) return false;
  var crown = y + trunk;
  if (spruce) {
    // 아래로 갈수록 넓어지는 원뿔
    for (var sy = 0; sy <= 4; sy++) {
      var srad = sy >= 3 ? 0 : (sy >= 1 ? 1 : 2);
      for (var sx = -srad; sx <= srad; sx++)
        for (var sz = -srad; sz <= srad; sz++) {
          if (Math.abs(sx) === srad && Math.abs(sz) === srad && srad > 1) continue;
          var cy = crown - 2 + sy;
          if (peek(x + sx, cy, z + sz) === air) put(x + sx, cy, z + sz, leafB);
        }
    }
  } else {
    for (var ly = -2; ly <= 1; ly++) {
      var rad = (ly >= 0) ? 1 : 2;
      for (var lx = -rad; lx <= rad; lx++) {
        for (var lz = -rad; lz <= rad; lz++) {
          // 모서리는 절반쯤 비운다 — 네모난 잎덩이가 되지 않게
          if (Math.abs(lx) === rad && Math.abs(lz) === rad && rnd() < 0.65) continue;
          if (peek(x + lx, crown + ly, z + lz) === air) put(x + lx, crown + ly, z + lz, leafB);
        }
      }
    }
  }
  for (var k = 1; k <= trunk; k++) put(x, y + k, z, logB);
  return true;
}
