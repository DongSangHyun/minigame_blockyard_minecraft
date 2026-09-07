// 배포된 주소를 진짜 브라우저로 열어 "정말 켜지는가" 를 본다.
// 실행: node tools/check-live.mjs [주소]
//
// 왜 필요한가 — 로컬 시험 275항목이 전부 통과해도, 잘못된 판을 한 번 올리면
// 사람 브라우저에는 그것이 남는다(v68). 시험은 저장소를 보고, 이 도구는 **배포본**을 본다.
import { launch } from "../tests/harness.mjs";

const URL_ = process.argv[2] || "https://dongsanghyun.github.io/minigame_blockyard_minecraft/";
const browser = await launch();
const ctx = await browser.newContext({ viewport: { width: 1024, height: 640 } });
const page = await ctx.newPage();
const bad = [];
page.on("pageerror", (e) => bad.push("오류: " + e.message));
page.on("console", (m) => { if (m.type() === "error") bad.push("콘솔: " + m.text()); });
page.on("requestfailed", (r) => bad.push("못 받음: " + r.url()));

let booted = false, why = "";
try {
  await page.goto(URL_, { waitUntil: "load", timeout: 45000 });
  await page.waitForFunction("window.__blockyard && window.__blockyard.booted !== false",
    null, { timeout: 25000 });
  booted = true;
} catch (e) { why = e.message.split("\n")[0]; }

// 부팅 감시견이 떠 있으면 그 문구를 그대로 보여 준다 — 사람이 보는 것과 같은 말이다
const seen = await page.evaluate(() => {
  const box = document.getElementById("boot-fail");
  return {
    failShown: !!(box && !box.hidden),
    why: (document.getElementById("boot-why") || {}).textContent || "",
    msg: (document.getElementById("boot-msg") || {}).textContent || ""
  };
}).catch(() => ({ failShown: false, why: "", msg: "" }));

await browser.close();

console.log(URL_);
console.log(booted ? "  켜집니다 ✓" : "  안 켜집니다 ✗  " + why);
if (seen.failShown) console.log("  화면에 뜬 안내: " + seen.msg + " — " + seen.why);
if (bad.length) console.log("  " + bad.slice(0, 5).join("\n  "));
process.exit(booted && !bad.length ? 0 : 1);
