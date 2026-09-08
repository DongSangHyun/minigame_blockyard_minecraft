// dims.js — 세계 치수와 좌표 계산 (의존성 없음)
export var WX = 96, WY = 64, WZ = 96, CH = 16;
export var LEGACY_WY = 48;                     // 저장 포맷 v4 까지의 세계 높이
export var CX = WX / CH, CY = WY / CH, CZ = WZ / CH;
export var N = WX * WY * WZ, PLANE = WX * WZ;
// 해수면 — **세계마다 다르다.** v78 까지는 11 고정이었는데, 그러면 지표에서 기반암까지가
// 13~15칸뿐이라 "내려갈수록 좋은 것" 이라는 사다리가 설 자리가 없었다
// (최고점 위로는 30~38칸이 늘 빈 하늘이었다). v79 부터 새 세계는 바다를 23 으로 올려
// 같은 64칸 안에서 지하를 두 배로 쓴다. **예전 저장은 11 그대로 열린다.**
// 저장에 담기는 것은 지형 판(GEN) 하나뿐이고, 해수면은 거기서 따라온다.
export var SEA_V1 = 11;      // v78 까지 만든 세계
export var SEA_V2 = 23;      // v79 부터 만드는 세계
export var GEN_LATEST = 2;
export var GEN = 1;
export var SEA = 11;
// dims.js 는 아무것도 import 하지 않는 뿌리 모듈이다 (CLAUDE.md 2.5절).
// 그래서 값을 바꾸는 함수도 여기 둔다 — `export var` 는 라이브 바인딩이라
// import 한 쪽은 다시 읽지 않아도 새 값을 본다.
export function setGen(g) {
  GEN = (g | 0) >= 2 ? 2 : 1;
  SEA = GEN >= 2 ? SEA_V2 : SEA_V1;
}
// 새 세계가 예전 판보다 얼마나 들려 있는가 — 지형 생성이 이 값만큼 위로 민다
export function seaLift() { return SEA - SEA_V1; }
export function idx(x, y, z) { return (y * WZ + z) * WX + x; }
export function inside(x, y, z) { return x >= 0 && x < WX && y >= 0 && y < WY && z >= 0 && z < WZ; }
export var DIRS = [[1,0,0],[-1,0,0],[0,1,0],[0,-1,0],[0,0,1],[0,0,-1]];
