# INDEX — 컨텍스트 색인

> 새 세션은 `CLAUDE.md` → 이 파일 순으로 읽습니다.
> 아래 표에서 **지금 하려는 일에 해당하는 줄만** 펼치세요. 전부 읽을 필요 없습니다.

## 계층
```
CLAUDE.md          지침 · 절대 규칙 · 작업 루프          (항상 읽음)
docs/INDEX.md      이 파일 — 어디를 볼지 알려주는 색인   (항상 읽음)
├── memory.md          개발 진행내역(시간순 로그)        ← "지금까지 뭘 했나"
├── docs/CODEMAP.md    코드 색인(자동 생성)              ← "그 함수 몇 번째 줄이지"
├── docs/GAMEPLAY.md   기능 명세 · 조작 · 블록 표         ← "이 게임이 뭘 할 수 있나"
├── docs/DECISIONS.md  설계 결정과 그 이유               ← "왜 이렇게 돼 있지"
├── docs/TESTING.md    테스트 실행법 · 항목 목록          ← "어떻게 검증하나"
└── docs/BACKLOG.md    아직 안 한 것 (우선순위 포함)      ← "다음에 뭘 하지"
```

## 목적별 진입점

| 하려는 일 | 먼저 볼 곳 |
|---|---|
| 이어서 개발한다 | `memory.md` 맨 아래 → `docs/BACKLOG.md` |
| 특정 기능을 고친다 | `docs/CODEMAP.md` 섹션 지도 → `index.html` 해당 줄 |
| 새 블록을 추가한다 | `docs/GAMEPLAY.md` "블록 추가 체크리스트" |
| 조작을 바꾼다 | `docs/GAMEPLAY.md` "조작" → `index.html` 16. 입력 |
| 왜 이렇게 만들었는지 궁금하다 | `docs/DECISIONS.md` |
| 검증한다 | `docs/TESTING.md` → `node tests/run.mjs 10` |
| 게임 감각을 판단해야 한다 | `CLAUDE.md` 1절 — 고인물 자문 에이전트 호출 |

## 파일 배치

| 경로 | 역할 |
|---|---|
| `index.html` | **게임 전부.** GitHub Pages 진입점 |
| `manifest.webmanifest` · `icon-*.png` | 홈 화면 추가(PWA)용 |
| `tools/make-icons.mjs` | 아이콘 생성기 (게임 아틀라스를 그대로 씀) |
| `tests/harness.mjs` | 헤드리스 브라우저 기동 · 단언 헬퍼 |
| `tests/run.mjs` | 회귀 테스트 스위트 (반복 실행 지원) |
| `tests/index.mjs` | `docs/CODEMAP.md` 자동 생성기 |
| `docs/` | 이 색인이 가리키는 문서들 |
| `memory.md` | 개발 진행내역 |

## 현재 상태 한 줄

**v5 — 마크 감각 보정 10건 반영 완료 · 회귀 테스트 36항목 전부 통과.**
자세한 건 `memory.md` 최신 항목.
