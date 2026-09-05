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
