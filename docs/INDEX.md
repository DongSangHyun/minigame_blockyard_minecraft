# INDEX — 컨텍스트 색인

> 새 세션은 `CLAUDE.md` → 이 파일 순으로 읽습니다.
> 아래에서 **지금 하려는 일에 해당하는 줄만** 펼치세요. 전부 읽을 필요 없습니다.

## 계층
```
CLAUDE.md          지침 · 절대 규칙 · 모듈 규칙 · 작업 루프    (항상 읽음)
docs/INDEX.md      이 파일 — 어디를 볼지 알려주는 색인        (항상 읽음)
├── memory.md          개발 진행내역(시간순)              ← "지금까지 뭘 했나"
├── docs/CODEMAP.md    모듈 지도 · 함수 색인 (자동 생성)   ← "그 함수 어느 파일이지"
├── docs/GAMEPLAY.md   기능 명세 · 조작 · 블록 표          ← "이 게임이 뭘 할 수 있나"
├── docs/DECISIONS.md  설계 결정과 그 이유                ← "왜 이렇게 돼 있지"
├── docs/TESTING.md    테스트 실행법 · 항목 목록           ← "어떻게 검증하나"
└── docs/BACKLOG.md    아직 안 한 것 (우선순위 포함)       ← "다음에 뭘 하지"
```

## 목적별 진입점

| 하려는 일 | 먼저 볼 곳 |
|---|---|
| 이어서 개발한다 | `memory.md` 맨 아래 → `docs/BACKLOG.md` |
| 특정 기능을 고친다 | `docs/CODEMAP.md` 모듈 지도 → 해당 `src/*.js` |
| 새 블록을 추가한다 | `docs/GAMEPLAY.md` "블록 추가 체크리스트" |
| 조작을 바꾼다 | `docs/GAMEPLAY.md` "조작" → `src/input.js` |
| 왜 이렇게 만들었는지 궁금하다 | `docs/DECISIONS.md` |
| 검증한다 | `docs/TESTING.md` → `node tests/run.mjs 10` |
| 게임 감각을 판단해야 한다 | `CLAUDE.md` 1절 — 고인물 자문 에이전트 호출 |

## 파일 배치

| 경로 | 역할 |
|---|---|
| `index.html` | 마크업 + CSS. GitHub Pages 진입점 |
| `src/main.js` | 조립과 시작 · `window.__blockyard` 테스트 훅 |
| `src/*.js` | 게임 코드 (모듈 24개 — `docs/CODEMAP.md` 참고) |
| `manifest.webmanifest` · `icon-*.png` | 홈 화면 추가(PWA) |
| `tests/harness.mjs` | 헤드리스 브라우저 · 정적 서버 · 단언 헬퍼 |
| `tests/run.mjs` | 회귀 테스트 50항목 |
| `tools/codemap.mjs` | `docs/CODEMAP.md` 생성 |
| `tools/tidy-imports.mjs` | 안 쓰는 import 정리 |
| `tools/make-icons.mjs` | PWA 아이콘 생성 |
| `tools/stamp.mjs` | `src/version.js` — 시작 화면의 "마지막 업데이트" 도장 |
| `docs/` | 이 색인이 가리키는 문서들 |
| `memory.md` | 개발 진행내역 |

## 읽는 순서 (처음 코드를 볼 때)
```
state · dims · queues   아무것도 import 하지 않는 뿌리
blocks · atlas          블록 정의와 텍스처
world · light · fluids  세계 데이터와 시뮬레이션
mesh · scene            그리기
player · mine · sky     플레이어와 상호작용
hud · hand · input      화면과 조작
loop · main             매 프레임과 조립
```

## 현재 상태 한 줄

**v10 — 건축·시점·분위기 · 회귀 테스트 79항목 전부 통과.**
공개 주소 https://dongsanghyun.github.io/minigame_blockyard_minecraft/
