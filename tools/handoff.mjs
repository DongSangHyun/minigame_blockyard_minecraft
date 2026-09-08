// docs/HANDOFF.md — 세션과 세션 사이를 잇는 색인.
// 실행: node tools/handoff.mjs [--check]
//
// 왜 도구인가 — 인계 문서의 숫자(판 번호·시험 수·백로그 개수)를 손으로 적으면
// 반드시 어긋난다(v58 에서 배운 것). git·시험 파일·백로그에서 읽어 쓴다.
// 사람이 채울 자리(진행 중·다음 후보·함정)는 표식으로 남겨 두고, --check 가 빈 자리를 잡는다.
import fs from "node:fs";
import path from "node:path";
import { execSync } from "node:child_process";
import { fileURLToPath } from "node:url";

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const OUT = path.join(ROOT, "docs", "HANDOFF.md");
const CHECK = process.argv.includes("--check");
const MARK = "여기를 채우세요";

function git(cmd, fallback = "") {
  try { return execSync("git " + cmd, { cwd: ROOT, encoding: "utf8" }).trim(); }
  catch { return fallback; }
}
function read(rel) {
  try { return fs.readFileSync(path.join(ROOT, rel), "utf8"); } catch { return ""; }
}

// ── 코드에서 읽는 숫자들
const tests = (read("tests/run.mjs").match(/^test\(/gm) || []).length;
const phoneTests = (read("tests/run.mjs").match(/^phoneTest\(/gm) || []).length;
const modules = fs.readdirSync(path.join(ROOT, "src")).filter((n) => n.endsWith(".js")).length;
const srcLines = fs.readdirSync(path.join(ROOT, "src")).filter((n) => n.endsWith(".js"))
  .reduce((a, n) => a + read("src/" + n).split("\n").length, 0);
const saveV = (read("src/save.js").match(/v:\s*(\d+),\s*seed/) || [, "?"])[1];
// 마지막 커밋이 "도장 갱신" 이면 판 제목을 잃는다 — 최근 이력에서 진짜 제목을 찾는다
const allTitles = git("log --format=%s -30").split("\n").filter(Boolean);
const title = allTitles.find((t) => !/^도장 갱신/.test(t)) || allTitles[0] || "";
const ver = (title.match(/\(v(\d+)/) ||
             (allTitles.join("\n").match(/\(v(\d+)/) || []) || [, "?"])[1] || "?";
const when = git("log -1 --format=%cI").slice(0, 16).replace("T", " ");

// 이번 세션에 무엇을 했나 — 도장 갱신 커밋은 빼고 제목만 모은다
const log = git('log --format=%s -40').split("\n")
  .filter((l) => l && !/^도장 갱신/.test(l));
const recent = log.slice(0, 12);
// 판 제목 전부 — 자문에게 "이미 처리된 것" 으로 넘긴다. 없으면 같은 제안을 또 받는다.
const done = log.filter((l) => /\(v\d+/.test(l)).map((l) => l.replace(/\s*\(v\d+[^)]*\)\s*$/, ""));

// 백로그 — 표의 줄 수를 센다
const backlog = read("docs/BACKLOG.md");
const backlogRows = (backlog.match(/^\| \*\*/gm) || []).length;
// 항목 이름과 난이도만 뽑는다 — 새 세션이 "뭐가 남았나" 를 세 장 안에서 닫을 수 있게
const backlogList = (backlog.match(/^\| \*\*[^|]+\|[^|]*\|[^|]*\|/gm) || [])
  .map((row) => {
    const cells = row.split("|").map((c) => c.trim());
    const name = cells[1].replace(/\*\*/g, "");
    const size = cells[3] || "";
    const gist = cells[2].replace(/`/g, "").slice(0, 90);
    return `- **${name}** (${size}) — ${gist}…`;
  }).join("\n");

const old = read("docs/HANDOFF.md");
function keep(section, fallback) {
  // 사람이 채운 부분은 다시 쓰지 않는다 — 도구가 덮으면 손으로 적을 이유가 없다
  const re = new RegExp("<!-- keep:" + section + " -->([\\s\\S]*?)<!-- \\/keep:" + section + " -->");
  const m = old.match(re);
  const body = m && m[1].trim() && !m[1].includes(MARK) ? m[1] : "\n" + fallback + "\n";
  return "<!-- keep:" + section + " -->" + body + "<!-- /keep:" + section + " -->";
}

const doc = `# HANDOFF — 세션 인계

> **새 세션은 \`CLAUDE.md\` → \`docs/INDEX.md\` → 이 파일** 순으로 읽으면 이어집니다.
> 이 문서는 \`node tools/handoff.mjs\` 가 다시 씁니다. 숫자는 손으로 고치지 마세요.
> 사람이 채우는 자리는 \`<!-- keep:… -->\` 로 감싸 두었고 도구가 덮지 않습니다.

## 지금 상태
| | |
|---|---|
| 마지막 판 | **v${ver}** — ${title} |
| 마지막 커밋 | ${when} |
| 회귀 시험 | **${tests}항목** + 폰 화면 ${phoneTests}항목 (러너는 오류 검사 2개를 더해 ${tests + phoneTests + 2} 로 찍습니다) |
| 전체 10회 | 약 5~7분 — 커밋 전 게이트입니다 |
| 코드 | 모듈 ${modules}개 · ${srcLines.toLocaleString("en-US")}줄 |
| 저장 포맷 | v${saveV} |
| 백로그 | ${backlogRows}건 |
| 공개 주소 | https://dongsanghyun.github.io/minigame_blockyard_minecraft/ |

## 이미 처리된 것 (자문을 띄울 때 **이 목록을 프롬프트에 넣으세요** — 중복 제안 방지)
${done.map((l) => "- " + l).join("\n")}

## 마지막 세션이 한 일 (새것부터)
${recent.map((l) => "- " + l).join("\n")}

## 진행 중이던 것
${keep("wip", "(없음 — 마지막 판까지 전부 커밋·배포됨)")}

## 백로그 전체 (\`docs/BACKLOG.md\` 에서 뽑음)
${backlogList || "(없음)"}

## 다음에 할 후보
${keep("next", "`docs/BACKLOG.md` 를 보세요.")}

## 이 세션에서 데인 자리 (다음 세션이 또 밟지 않게)
${keep("traps", MARK)}

## 더 알아야 하면
| 궁금한 것 | 볼 곳 |
|---|---|
| 지금까지 뭘 했나 (시간순 원문) | \`memory.md\` — **맨 아래부터** 읽으세요 |
| 다음에 뭘 하지 | \`docs/BACKLOG.md\` |
| 그 함수 어느 파일이지 | \`docs/CODEMAP.md\` |
| 이 게임이 뭘 할 수 있나 | \`docs/GAMEPLAY.md\` |
| 어떻게 검증하나 | \`docs/TESTING.md\` → \`node tests/run.mjs 10\` |
| 왜 이렇게 돼 있지 | \`docs/DECISIONS.md\` |

## 자문을 띄우는 프롬프트 틀 (\`작업해줘\` 의 1단계)
\`general-purpose\` 서브에이전트에 이 틀로 띄웁니다. **"이미 처리된 것" 목록을 꼭 붙이세요.**

\`\`\`
당신은 10년차, 매일 8시간씩 실제 마인크래프트만 해 온 고인물 플레이어입니다.
코드 리뷰어가 아니라 플레이어 감각으로 판단하세요.

검토 대상: <저장소 경로> — three.js r128 웹 복셀 샌드박스 (크리에이티브 전용 · 1인용)
읽는 순서: CLAUDE.md → docs/GAMEPLAY.md → docs/BACKLOG.md(여기 있는 것은 제안 금지)
          → memory.md 의 마지막 1/5 → src/*.js 직접

헤드리스로 직접 재현·계측해 주세요 (tests/harness.mjs 의 launch·serve, 폰은 PHONE).
**저장소 파일은 절대 수정하지 마세요** — 모듈을 깨뜨려 봐야 하면
ctx.route("**/src/x.js", r => r.abort()) 로 네트워크를 가로채세요. (CLAUDE.md 규칙 9)

이미 처리된 것 (다시 제안 금지): <위 "이미 처리된 것" 목록을 그대로 붙임>
백로그에 이미 있는 것 (제안 금지): <위 백로그 목록>
범위 밖: 서바이벌/체력 · 멀티플레이 · 새 외부 라이브러리 · 빌드 단계

보완할 사항 10가지를 우선순위대로. 각 항목마다
증상(플레이어가 겪는 장면) · 마크는 어떤가 · 왜 중요한가 · 어디를 볼까(src/파일.js) · 크기(소/중/대).
"소" 를 최소 5개 포함하세요.
\`\`\`

## 시험 이름 필터 (\`node tests/run.mjs 1 "필터"\`)
이름 앞머리로 걸립니다 — 최근 판일수록 뒤 번호입니다.
\`v76\`(오두막) · \`v75\`(바다) · \`v74\`(소품) · \`v73\`(소리) · \`v72\`(불) · \`v70\`(재굽기) ·
\`v69\`(모래 되돌리기) · \`v66\`(계단 모서리) · \`v62\`(묘목) · \`폰 ·\`(폰 화면 전부).
전체 목록은 \`grep -n '^test(' tests/run.mjs\` · 갈래별 개수는 \`docs/TESTING.md\`.

## 반드시 지킬 것 (자세한 건 \`CLAUDE.md\`)
- **빌드 단계를 만들지 않는다.** three.js r128 CDN 외 라이브러리 금지. ES5 문체.
- 월드를 바꿀 때는 항상 \`applyEdit\` — \`world[]\` 를 직접 쓰지 않는다.
- 새 기능에는 회귀 시험을 같이 넣는다. 커밋 전 \`node tests/run.mjs 10\`.
- 도구(\`tidy-imports\` 등)를 돌린 뒤에는 **시험을 한 번 더** 돌린다 (v67 사고).
- 임시 스크립트가 \`src/\` 를 고쳤다 되돌리게 하지 않는다 (v68·v69 사고).
- push 뒤에는 \`node tools/check-live.mjs\` 로 **배포본이 진짜 켜지는지** 본다.
`;

if (CHECK) {
  const cur = read("docs/HANDOFF.md");
  const problems = [];
  if (!cur) problems.push("docs/HANDOFF.md 가 없습니다 — node tools/handoff.mjs 를 먼저 돌리세요");
  if (cur.includes(MARK)) problems.push("아직 안 채운 자리가 있습니다 (" + MARK + ")");
  for (const m of cur.match(/`([^`]+\.(?:md|mjs|js))`/g) || []) {
    let rel = m.replace(/`/g, "");
    if (rel.startsWith("http")) continue;
    // "node tools/x.mjs 10" 처럼 명령으로 적힌 것은 파일 부분만 본다
    const parts = rel.split(/\s+/).filter((t) => /\.(md|mjs|js)$/.test(t));
    if (!parts.length) continue;
    rel = parts[0];
    // 본문에서는 "input.js" 처럼 짧게 부르기도 한다 — src/ 안도 본다
    const found = fs.existsSync(path.join(ROOT, rel)) ||
                  fs.existsSync(path.join(ROOT, "src", rel)) ||
                  fs.existsSync(path.join(ROOT, "docs", rel)) ||
                  fs.existsSync(path.join(ROOT, "tools", rel));
    if (!found) problems.push("가리키는 파일이 없습니다: " + rel);
  }
  const n = (cur.match(/\*\*(\d+)항목\*\*/) || [, "0"])[1];
  if (+n !== tests) problems.push(`시험 수가 어긋납니다 — 문서 ${n} · 실제 ${tests}`);
  const v = (cur.match(/\*\*v(\d+)\*\*/) || [, "?"])[1];
  if (v !== ver) problems.push(`판 번호가 어긋납니다 — 문서 v${v} · 실제 v${ver}`);
  if (problems.length) {
    console.log("인계 정합성 — 문제 " + problems.length + "건");
    problems.forEach((p) => console.log("  ! " + p));
    process.exit(1);
  }
  console.log(`인계 정합성 — 이상 없음 (v${ver} · 시험 ${tests}항목 · 링크 전부 살아 있음)`);
} else {
  fs.writeFileSync(OUT, doc);
  console.log(`docs/HANDOFF.md 갱신 — v${ver} · 시험 ${tests}항목 · 최근 ${recent.length}건`);
}
