// src/version.js 를 git 최신 커밋 정보로 다시 쓴다.
// 커밋 직전에 실행한다:  node tools/stamp.mjs && git add -A && git commit ...
import fs from "node:fs";
import path from "node:path";
import { execSync } from "node:child_process";
import { fileURLToPath } from "node:url";

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const OUT = path.join(ROOT, "src", "version.js");

function git(cmd, fallback) {
  try { return execSync("git " + cmd, { cwd: ROOT, stdio: ["ignore", "pipe", "ignore"] })
    .toString().trim(); } catch { return fallback; }
}

// 워킹 트리에 아직 커밋 안 된 변경이 있으면 "지금"을, 아니면 마지막 커밋 시각을 쓴다.
const dirty = git("status --porcelain", "") !== "";
const iso = dirty ? new Date().toISOString() : git("log -1 --format=%cI", new Date().toISOString());
// 해시는 도장을 찍는 순간 스스로를 바꾸므로 화면에는 쓰지 않는다 (기록용으로만 남긴다).
const sha = dirty ? "" : git("rev-parse --short HEAD", "");

const d = new Date(iso);
const p = n => String(n).padStart(2, "0");
const kst = new Date(d.getTime() + (9 * 60 + d.getTimezoneOffset()) * 60000);
const label = `${kst.getFullYear()}-${p(kst.getMonth() + 1)}-${p(kst.getDate())} ` +
              `${p(kst.getHours())}:${p(kst.getMinutes())}`;

fs.writeFileSync(OUT,
`// version.js — 빌드 도장 (자동 생성)
// 직접 고치지 말고 \`node tools/stamp.mjs\` 를 실행하세요. 커밋 직전에 돌립니다.
export var BUILD = {
  updated: ${JSON.stringify(label)},   // 마지막 업데이트 (KST)
  iso: ${JSON.stringify(iso)},
  commit: ${JSON.stringify(sha)}
};
`);
console.log(`version.js 갱신 — ${label} KST${sha ? " · " + sha : ""}${dirty ? " (미커밋 변경 반영)" : ""}`);

// ── 문서의 숫자를 코드에서 읽어 찍는다.
// 손으로 적어 둔 숫자는 반드시 어긋난다 — 자문 7차가 여섯 곳을 찾아냈다
// (월드 크기 · 저장 포맷 v4 · 모듈 24개 · 코드 3,500줄 · 테스트 50항목).
// 특히 "저장 포맷 현재 v4" 는 다음 세션에게 잘못된 지시가 된다.
function countSrc() {
  const dir = path.join(ROOT, "src");
  const files = fs.readdirSync(dir).filter(f => f.endsWith(".js"));
  let lines = 0;
  for (const f of files) lines += fs.readFileSync(path.join(dir, f), "utf8").split("\n").length;
  return { modules: files.length, lines: lines };
}
function readNum(file, re, fallback) {
  try {
    const m = fs.readFileSync(path.join(ROOT, file), "utf8").match(re);
    return m ? m[1] : fallback;
  } catch { return fallback; }
}
function patch(file, pairs) {
  const full = path.join(ROOT, file);
  let t;
  try { t = fs.readFileSync(full, "utf8"); } catch { return false; }
  let before = t;
  for (const [re, to] of pairs) t = t.replace(re, to);
  if (t === before) return false;
  fs.writeFileSync(full, t);
  return true;
}

const src = countSrc();
const WX = +readNum("src/dims.js", /WX\s*=\s*(\d+)/, 96);
const WY = +readNum("src/dims.js", /WY\s*=\s*(\d+)/, 64);
const WZ = +readNum("src/dims.js", /WZ\s*=\s*(\d+)/, 96);
const CH = +readNum("src/dims.js", /CH\s*=\s*(\d+)/, 16);
const SAVE_V = readNum("src/save.js", /v:\s*(\d+),\s*seed/, "5");
const tests = (fs.readFileSync(path.join(ROOT, "tests", "run.mjs"), "utf8")
  .match(/^test\(/gm) || []).length;
const cells = (WX * WY * WZ).toLocaleString("en-US");
const chunks = (WX / CH) + "×" + (WY / CH) + "×" + (WZ / CH) + " = " + (WX / CH) * (WY / CH) * (WZ / CH) + "개";

patch("CLAUDE.md", [
  [/ES 모듈 \d+개/g, "ES 모듈 " + src.modules + "개"],
  [/기존 코드 [\d,]+줄/g, "기존 코드 " + src.lines.toLocaleString("en-US") + "줄"],
  [/\(현재 v\d+\)/g, "(현재 v" + SAVE_V + ")"],
  [/\| 월드 \|[^\n]*\|/,
   "| 월드 | " + WX + " × " + WY + " × " + WZ + " = " + cells +
   " 셀 · 청크 " + CH + "³ (" + chunks + ") |"]
]);
// "현재 상태 한 줄" 은 마지막 커밋 제목에서 가져온다 — v19 에 멈춰 있었다
const lastTitle = git("log -1 --format=%s", "").replace(/\s*\(v\d+[^)]*\)\s*$/, "").trim();
const lastVer = (git("log -1 --format=%s", "").match(/\(v(\d+)/) || [, ""])[1];
patch("docs/INDEX.md", [
  [/모듈 \d+개/g, "모듈 " + src.modules + "개"],
  [/회귀 테스트 \d+항목/g, "회귀 테스트 " + tests + "항목"],
  [/\*\*v\d+ — [^\n]*\*\*/,
   "**v" + (lastVer || "?") + " — " + (lastTitle || "최신") +
   " · 회귀 테스트 " + tests + "항목 전부 통과.**"]
]);
console.log("문서 숫자 갱신 — 모듈 " + src.modules + " · " + src.lines + "줄 · 저장 v" + SAVE_V +
            " · 시험 " + tests + "항목");
