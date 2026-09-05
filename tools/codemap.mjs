// docs/CODEMAP.md 자동 생성 — src/*.js 를 훑어 모듈 지도와 함수 색인을 만든다.
// 실행: node tools/codemap.mjs
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const SRC = path.join(ROOT, "src");
const OUT = path.join(ROOT, "docs", "CODEMAP.md");

// 읽는 순서 = 의존 순서. 위에 있을수록 아래를 모른다.
const ORDER = ["state", "dims", "queues", "boot", "blocks", "atlas", "world", "light",
  "fluids", "mesh", "scene", "daynight", "settings", "player", "audio", "save",
  "edit", "hud", "hand", "input", "mine", "sky", "loop", "main"];

const mods = [];
for (const name of ORDER) {
  const file = path.join(SRC, name + ".js");
  if (!fs.existsSync(file)) continue;
  const text = fs.readFileSync(file, "utf8");
  const lines = text.split("\n");
  const title = (lines[0].match(/^\/\/\s*[\w.]+\s*—\s*(.+)$/) || [, name])[1];
  const imports = [...text.matchAll(/^import .* from "\.\/([\w]+)\.js";$/gm)].map(m => m[1]);
  const fns = [];
  const vars = [];
  lines.forEach((L, i) => {
    const f = L.match(/^export function ([A-Za-z_$][\w$]*)\s*\(([^)]*)\)/);
    if (f) { fns.push({ name: f[1], args: f[2].trim(), line: i + 1 }); return; }
    const v = L.match(/^export (?:var|const|let) ([A-Za-z_$][\w$]*)/);
    if (v) vars.push(v[1]);
  });
  mods.push({ name, title, lines: lines.length, imports, fns, vars });
}

const total = mods.reduce((a, m) => a + m.lines, 0);
const stamp = new Date().toISOString().slice(0, 10);

let out = `<!-- 자동 생성 파일 — 직접 고치지 말고 \`node tools/codemap.mjs\` 를 다시 실행하세요 -->
# CODEMAP — 코드 색인

생성일 ${stamp} · 모듈 ${mods.length}개 · 합계 ${total.toLocaleString("ko-KR")}줄

진입점은 \`index.html\` → \`src/main.js\`. 아래 표는 **의존 순서**로 정렬돼 있습니다 —
위에 있는 모듈은 아래 모듈을 모릅니다(순환이 있는 곳은 함수 호출 시점에만 서로를 봅니다).

## 모듈 지도

| 모듈 | 하는 일 | 줄 | 기대는 곳 |
|---|---|---:|---|
`;
for (const m of mods) {
  out += `| [\`${m.name}.js\`](../src/${m.name}.js) | ${m.title} | ${m.lines} | ${m.imports.join(" · ") || "—"} |\n`;
}

out += `\n## 모듈별 공개 함수\n`;
for (const m of mods) {
  if (!m.fns.length && !m.vars.length) continue;
  out += `\n### \`${m.name}.js\` — ${m.title}\n`;
  if (m.fns.length) {
    out += "\n| 함수 | 줄 |\n|---|---:|\n";
    for (const f of m.fns) out += `| \`${f.name}(${f.args})\` | ${f.line} |\n`;
  }
  if (m.vars.length) out += `\n내보내는 값 — ${m.vars.map(v => "`" + v + "`").join(" · ")}\n`;
}

fs.mkdirSync(path.dirname(OUT), { recursive: true });
fs.writeFileSync(OUT, out);
console.log(`CODEMAP 갱신 — 모듈 ${mods.length} · 함수 ${mods.reduce((a, m) => a + m.fns.length, 0)} → ${path.relative(ROOT, OUT)}`);
