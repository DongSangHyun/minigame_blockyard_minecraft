// Blockyard 헤드리스 테스트 하네스
// 실행:  node tests/run.mjs            (전체 스위트 1회)
//        node tests/run.mjs 10         (10회 반복)
// 브라우저: playwright-core + 로컬에 캐시된 Chrome for Testing (WebGL은 SwiftShader)
import { createRequire } from "node:module";
import { fileURLToPath, pathToFileURL } from "node:url";
import path from "node:path";
import fs from "node:fs";
import os from "node:os";

const HERE = path.dirname(fileURLToPath(import.meta.url));
export const ROOT = path.resolve(HERE, "..");
export const GAME = path.join(ROOT, "index.html");

const SCRATCH = process.env.BY_SCRATCH ||
  "/private/tmp/claude-501/-Users-masterd-Documents-Claude-Document-Minigame/7f39fe21-d743-4b9b-b93a-6aaf67f2a3bd/scratchpad";
const require = createRequire(path.join(SCRATCH, "package.json"));
const { chromium } = require("playwright-core");

const CHROME = process.env.BY_CHROME || path.join(
  os.homedir(),
  "Library/Caches/ms-playwright/chromium-1228/chrome-mac-arm64",
  "Google Chrome for Testing.app/Contents/MacOS/Google Chrome for Testing");

export async function launch() {
  if (!fs.existsSync(CHROME)) throw new Error("Chrome 실행 파일을 찾을 수 없습니다: " + CHROME);
  return chromium.launch({
    executablePath: CHROME,
    args: ["--use-gl=angle", "--use-angle=swiftshader", "--enable-unsafe-swiftshader",
           "--disable-lcd-text", "--no-sandbox"]
  });
}

// ES 모듈은 file:// 에서 CORS 로 막히므로 정적 서버를 띄운다.
const MIME = { ".html": "text/html; charset=utf-8", ".js": "text/javascript; charset=utf-8",
  ".css": "text/css; charset=utf-8", ".json": "application/json; charset=utf-8",
  ".webmanifest": "application/manifest+json", ".png": "image/png", ".ico": "image/x-icon" };

let server = null, origin = null;
export async function serve() {
  if (origin) return origin;
  const http = await import("node:http");
  server = http.createServer((req, res) => {
    const rel = decodeURIComponent(req.url.split("?")[0]).replace(/^\/+/, "") || "index.html";
    const file = path.join(ROOT, rel);
    if (!file.startsWith(ROOT) || !fs.existsSync(file) || fs.statSync(file).isDirectory()) {
      res.writeHead(404).end("not found"); return;
    }
    res.writeHead(200, { "content-type": MIME[path.extname(file)] || "application/octet-stream" });
    fs.createReadStream(file).pipe(res);
  });
  await new Promise(r => server.listen(0, "127.0.0.1", r));
  origin = "http://127.0.0.1:" + server.address().port;
  return origin;
}
export function stopServer() { if (server) { server.close(); server = null; origin = null; } }

export async function openGame(browser) {
  const base = await serve();
  const ctx = await browser.newContext({ viewport: { width: 1024, height: 640 } });
  const page = await ctx.newPage();
  const errors = [];
  page.on("pageerror", e => errors.push("pageerror: " + e.message));
  page.on("console", m => { if (m.type() === "error") errors.push("console: " + m.text()); });
  await page.goto(base + "/index.html", { waitUntil: "load" });
  await page.waitForFunction("window.__blockyard && window.__blockyard.booted !== false", null,
    { timeout: 30000 });
  return { page, ctx, errors };
}

// ── 아주 작은 테스트 러너 ────────────────────────────────
export function makeSuite() {
  const cases = [];
  return {
    test: (name, fn) => cases.push({ name, fn }),
    cases
  };
}

export function assert(cond, msg) {
  if (!cond) throw new Error(msg || "assert 실패");
}
export function eq(a, b, msg) {
  if (a !== b) throw new Error((msg || "값이 다릅니다") + ` — 기대 ${JSON.stringify(b)}, 실제 ${JSON.stringify(a)}`);
}
export function near(a, b, tol, msg) {
  if (!(Math.abs(a - b) <= tol)) throw new Error((msg || "근사값 불일치") + ` — 기대 ${b}±${tol}, 실제 ${a}`);
}
