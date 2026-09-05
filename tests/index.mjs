// docs/CODEMAP.md 자동 생성 — index.html 의 섹션 주석과 최상위 함수를 훑어 색인을 만든다.
// 실행: node tests/index.mjs
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const SRC = path.join(ROOT, "index.html");
const OUT = path.join(ROOT, "docs", "CODEMAP.md");

const lines = fs.readFileSync(SRC, "utf8").split("\n");

const sections = [];   // { n, title, line }
const funcs = [];      // { name, line, section }
let cur = null;

for (let i = 0; i < lines.length; i++) {
  const L = lines[i];
  const sec = L.match(/^\s*\/\/\s+([0-9]+(?:\.[0-9]+)?)\.\s+(.+?)\s*$/);
  if (sec) {
    cur = { n: sec[1], title: sec[2], line: i + 1, funcs: [] };
    sections.push(cur);
    continue;
  }
  const fn = L.match(/^\s{2}function\s+([A-Za-z_$][\w$]*)\s*\(([^)]*)\)/);
  if (fn && cur) cur.funcs.push({ name: fn[1], args: fn[2].trim(), line: i + 1 });
}

// window.__blockyard 훅에 노출된 키
const src = lines.join("\n");
const hookStart = src.indexOf("window.__blockyard = {");
const hookKeys = [];
if (hookStart >= 0) {
  const body = src.slice(hookStart, src.indexOf("\n  };", hookStart));
  const re = /(?:^|[\s{,])([A-Za-z_$][\w$]*)\s*:/g;
  let m;
  while ((m = re.exec(body))) if (!hookKeys.includes(m[1])) hookKeys.push(m[1]);
}

const total = lines.length;
const stamp = new Date().toISOString().slice(0, 10);

let out = `<!-- 자동 생성 파일 — 직접 고치지 말고 \`node tests/index.mjs\` 를 다시 실행하세요 -->
# CODEMAP — index.html 코드 색인

생성일 ${stamp} · 전체 ${total.toLocaleString("ko-KR")}줄 · 섹션 ${sections.length}개 · 훅 ${hookKeys.length}개

## 섹션 지도

| # | 섹션 | 시작 줄 | 길이 | 주요 함수 |
|---|---|---:|---:|---|
`;

for (let i = 0; i < sections.length; i++) {
  const s = sections[i];
  const end = i + 1 < sections.length ? sections[i + 1].line : total;
  const names = s.funcs.map(f => `\`${f.name}\``).join(" · ") || "—";
  out += `| ${s.n} | ${s.title} | ${s.line} | ${end - s.line} | ${names} |\n`;
}

out += `\n## 함수 → 줄번호\n\n`;
const all = sections.flatMap(s => s.funcs.map(f => ({ ...f, sec: s.n })));
all.sort((a, b) => a.name.localeCompare(b.name));
out += "| 함수 | 섹션 | 줄 |\n|---|---:|---:|\n";
for (const f of all) out += `| \`${f.name}(${f.args})\` | ${f.sec} | ${f.line} |\n`;

out += `\n## 테스트 훅 \`window.__blockyard\`\n\n`;
out += hookKeys.map(k => `\`${k}\``).join(" · ") + "\n";

fs.mkdirSync(path.dirname(OUT), { recursive: true });
fs.writeFileSync(OUT, out);
console.log(`CODEMAP 갱신 — 섹션 ${sections.length} · 함수 ${all.length} · 훅 ${hookKeys.length} → ${path.relative(ROOT, OUT)}`);
