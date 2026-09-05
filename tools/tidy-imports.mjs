// src/*.js 의 import 목록에서 실제로 쓰이지 않는 이름을 지운다.
// 실행: node tools/tidy-imports.mjs [--check]
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const SRC = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..", "src");
const CHECK = process.argv.includes("--check");

function stripCode(t) {
  return t.replace(/"(?:[^"\\]|\\.)*"/g, '""')
          .replace(/'(?:[^'\\]|\\.)*'/g, "''")
          .replace(/`(?:[^`\\]|\\.)*`/g, "``")
          .replace(/\/\*[\s\S]*?\*\//g, "")
          .replace(/^\s*\/\/.*$/gm, "");
}

let changed = 0, removed = 0;
for (const f of fs.readdirSync(SRC).filter(n => n.endsWith(".js"))) {
  const p = path.join(SRC, f);
  const text = fs.readFileSync(p, "utf8");
  const importLines = [...text.matchAll(/^import \{ ([^}]+) \} from "([^"]+)";$/gm)];
  if (!importLines.length) continue;

  const bodyStart = text.lastIndexOf("\nimport ") >= 0
    ? text.indexOf("\n", text.lastIndexOf("\nimport ") + 1) : 0;
  const body = stripCode(text.slice(bodyStart));
  const used = new Set(body.match(/\b[A-Za-z_$][\w$]*\b/g) || []);

  let out = text;
  for (const m of importLines) {
    const names = m[1].split(",").map(s => s.trim());
    const keep = names.filter(n => used.has(n));
    removed += names.length - keep.length;
    const line = keep.length ? `import { ${keep.join(", ")} } from "${m[2]}";` : "";
    out = out.replace(m[0] + "\n", line ? line + "\n" : "");
  }
  if (out !== text) {
    changed++;
    if (!CHECK) fs.writeFileSync(p, out);
  }
}
console.log(CHECK
  ? `쓰이지 않는 import ${removed}개 (파일 ${changed}개) — --check 모드라 고치지 않았습니다`
  : `쓰이지 않는 import ${removed}개를 지웠습니다 (파일 ${changed}개)`);
