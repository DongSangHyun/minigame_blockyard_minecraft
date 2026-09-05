// PWA 아이콘 생성 — 게임이 코드로 그리는 아틀라스를 그대로 써서 잔디 블록 아이콘을 만든다.
// 실행: node tools/make-icons.mjs
import fs from "node:fs";
import path from "node:path";
import { launch, openGame, ROOT } from "../tests/harness.mjs";

const SIZES = [192, 512];
const browser = await launch();
const { page } = await openGame(browser);

for (const size of SIZES) {
  const dataUrl = await page.evaluate((size) => {
    const B = window.__blockyard;
    const src = document.createElement("canvas");
    src.width = src.height = 64;
    B.drawIcon(src, B.B.GRASS);

    const cv = document.createElement("canvas");
    cv.width = cv.height = size;
    const c = cv.getContext("2d");
    c.fillStyle = "#0f1316";
    c.fillRect(0, 0, size, size);
    c.imageSmoothingEnabled = false;
    // maskable 안전영역(가운데 80%)에 넉넉히 들어가도록 62% 크기로 가운데 정렬
    const d = Math.round(size * 0.62);
    const o = Math.round((size - d) / 2);
    c.drawImage(src, o, o, d, d);
    return cv.toDataURL("image/png");
  }, size);

  const buf = Buffer.from(dataUrl.split(",")[1], "base64");
  const out = path.join(ROOT, `icon-${size}.png`);
  fs.writeFileSync(out, buf);
  console.log(`icon-${size}.png — ${(buf.length / 1024).toFixed(1)} KB`);
}

await browser.close();
