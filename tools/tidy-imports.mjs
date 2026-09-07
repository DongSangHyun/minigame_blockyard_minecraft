// src/*.js 의 import 목록에서 실제로 쓰이지 않는 이름을 지운다.
// 실행: node tools/tidy-imports.mjs [--check]
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const SRC = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..", "src");
const CHECK = process.argv.includes("--check");
const FORCE = process.argv.includes("--force");

function stripCode(t) {
  return t.replace(/"(?:[^"\\]|\\.)*"/g, '""')
          .replace(/'(?:[^'\\]|\\.)*'/g, "''")
          .replace(/`(?:[^`\\]|\\.)*`/g, "``")
          .replace(/\/\*[\s\S]*?\*\//g, "")
          .replace(/^\s*\/\/.*$/gm, "");
}

let changed = 0, removed = 0, skipped = 0;
for (const f of fs.readdirSync(SRC).filter(n => n.endsWith(".js"))) {
  const p = path.join(SRC, f);
  const text = fs.readFileSync(p, "utf8");
  const importLines = [...text.matchAll(/^import \{ ([^}]+) \} from "([^"]+)";$/gm)];
  if (!importLines.length) continue;

  const bodyStart = text.lastIndexOf("\nimport ") >= 0
    ? text.indexOf("\n", text.lastIndexOf("\nimport ") + 1) : 0;
  const raw = text.slice(bodyStart);
  const body = stripCode(raw);
  // 안전장치 ① — 문자열 제거기가 어긋나면 본문이 통째로 사라지고, 그러면
  // "아무것도 안 쓰인다" 로 읽혀 import 를 몽땅 지운다. 실제로 그래서 게임이 안 켜졌다:
  // 정규식 리터럴 안의 큰따옴표(/"/g) 하나가 이후 모든 따옴표 짝을 밀어 버렸다.
  // 본문의 절반 넘게가 사라졌으면 그 파일은 건드리지 않는다.
  if (body.length < raw.length * 0.5) {
    console.log(`  ! ${f} — 문자열 제거기가 본문의 ` +
      `${Math.round(100 - body.length / raw.length * 100)}% 를 삼켰습니다. 건너뜁니다 ` +
      `(정규식 안의 따옴표나 짝 안 맞는 따옴표를 찾아보세요)`);
    skipped++;
    continue;
  }
  const used = new Set(body.match(/\b[A-Za-z_$][\w$]*\b/g) || []);

  let out = text;
  let fileRemoved = 0;
  for (const m of importLines) {
    const names = m[1].split(",").map(s => s.trim());
    const keep = names.filter(n => used.has(n));
    fileRemoved += names.length - keep.length;
    const line = keep.length ? `import { ${keep.join(", ")} } from "${m[2]}";` : "";
    out = out.replace(m[0] + "\n", line ? line + "\n" : "");
  }
  // 안전장치 ② — 한 파일에서 열 개 넘게 지우는 것은 정상적인 정리가 아니다.
  // 진짜로 그만큼 남았다면 --force 로 한 번 더 부른다.
  if (fileRemoved > 10 && !FORCE) {
    console.log(`  ! ${f} — 한 번에 ${fileRemoved}개를 지우려 합니다. 건너뜁니다 ` +
      `(정말이면 --force 를 붙이세요)`);
    skipped++;
    continue;
  }
  removed += fileRemoved;
  if (out !== text) {
    changed++;
    if (!CHECK) fs.writeFileSync(p, out);
  }
}
console.log(CHECK
  ? `쓰이지 않는 import ${removed}개 (파일 ${changed}개) — --check 모드라 고치지 않았습니다`
  : `쓰이지 않는 import ${removed}개를 지웠습니다 (파일 ${changed}개)`);
if (skipped) {
  console.log(`건너뛴 파일 ${skipped}개 — 위 경고를 먼저 보세요.`);
  process.exitCode = 1;
}
