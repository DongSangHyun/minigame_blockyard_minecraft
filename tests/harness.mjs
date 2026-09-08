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

// playwright-core 는 저장소 밖(세션 스크래치패드)에 있다 — node_modules 를 저장소에 두지 않는다.
// **경로를 하나만 박아 두면 안 된다.** 그 임시 폴더는 청소되면 사라지고, 그러면
// 시험이 통째로 안 돈다 (실제로 한 번 겪었다 — 낡은 세션 폴더가 비워졌다).
// 후보를 차례로 짚어 **실제로 불러와지는 첫 번째**를 쓴다.
const SCRATCH_ROOT = "/private/tmp/claude-501/-Users-masterd-Documents-Claude-Document-Minigame";
function scratchCandidates() {
  const out = [];
  if (process.env.BY_SCRATCH) out.push(process.env.BY_SCRATCH);
  try {
    // 최근에 손댄 세션 폴더부터 본다
    const dirs = fs.readdirSync(SCRATCH_ROOT)
      .map((d) => path.join(SCRATCH_ROOT, d, "scratchpad"))
      .filter((d) => fs.existsSync(path.join(d, "node_modules")))
      .sort((a, b) => fs.statSync(b).mtimeMs - fs.statSync(a).mtimeMs);
    out.push.apply(out, dirs);
  } catch (e) {}
  out.push(ROOT);                     // 저장소에 직접 깔아 뒀다면 그것도
  return out;
}
let chromium = null, SCRATCH = null;
for (const cand of scratchCandidates()) {
  try {
    const req = createRequire(path.join(cand, "package.json"));
    chromium = req("playwright-core").chromium;
    SCRATCH = cand;
    break;
  } catch (e) { /* 다음 후보 */ }
}
if (!chromium) {
  throw new Error("playwright-core 를 찾을 수 없습니다. 후보: " +
    scratchCandidates().join(", ") + "\n" +
    "스크래치패드에서 `npm i playwright-core` 하거나 BY_SCRATCH 로 경로를 주세요.");
}

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

// 폰 화면(아이폰 가로) — 회귀 시험이 전부 데스크톱 폭으로만 돌아서
// "폰에서만 잘려 보이는" 것은 아무도 못 잡고 있었다 (자문 9차 실측: 블록 54칸 중 33칸이 화면 밖).
export const PHONE = {
  viewport: { width: 844, height: 390 },      // viewport 는 중첩 키다 — 펼쳐 쓰면 조용히 기본값이 된다
  isMobile: true, hasTouch: true, deviceScaleFactor: 3
};

export async function openGame(browser, opts) {
  const base = await serve();
  const ctx = await browser.newContext((opts && opts.phone)
    ? PHONE
    : { viewport: { width: 1024, height: 640 } });
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
