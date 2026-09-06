import { launch, openGame, stopServer } from "../tests/harness.mjs";
const browser = await launch();
const { page, errors } = await openGame(browser);
const out = await page.evaluate(async () => {
  const H = window.__blockyard, S = H.S, B = H.B;
  const r = {};
  H.generate(1234);
  // 세계 전체를 마른 돌판으로
  const gy=30;
  for(let x=0;x<H.WX;x++) for(let z=0;z<H.WZ;z++) for(let y=1;y<H.WY;y++) H.set(x,y,z, y<gy?B.STONE:B.AIR);
  H.refreshAllTops();
  // 목장은 (18,18), 플레이어는 (80,80) — 거리 87
  const cx=18, cz=18;
  H.player.pos.set(cx+0.5, gy, cz+0.5);
  for(let d=-3;d<=3;d++){
    H.set(cx+d, gy, cz-3, B.FENCE); H.set(cx+d, gy, cz+3, B.FENCE);
    H.set(cx-3, gy, cz+d, B.FENCE); H.set(cx+3, gy, cz+d, B.FENCE);
  }
  H.refreshAllTops();
  H.seedMobs();
  for(let i=0;i<H.mobs.length;i++){ H.mobs[i].x=cx+0.5+(i%3)*0.8; H.mobs[i].z=cz+0.5+((i/3)|0)*0.5; H.mobs[i].y=gy; }
  const inPen = () => H.mobs.filter(m => Math.abs(m.x-cx-0.5)<3.5 && Math.abs(m.z-cz-0.5)<3.5).length;
  r.penStart = inPen();
  H.player.pos.set(80.5, gy, 80.5);
  for(let t=0;t<50;t++) H.updateMobs(0.1);
  r.after5s = inPen();
  for(let t=0;t<600;t++) H.updateMobs(0.1);
  r.after65s = inPen();
  r.nearPlayer = H.mobs.filter(m=>Math.hypot(m.x-80.5,m.z-80.5)<40).length;
  return r;
});
console.log(JSON.stringify(out,null,1));
if (errors.length) console.log("ERRORS", errors.slice(0,8));
await browser.close(); stopServer();
