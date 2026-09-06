import { launch, openGame, stopServer } from "../tests/harness.mjs";
const browser = await launch();
const { page, errors } = await openGame(browser);
const out = await page.evaluate(async () => {
  const H = window.__blockyard, S = H.S, B = H.B;
  const r = {};
  H.generate(1234); H.refreshAllTops(); H.relightAll(false);
  // 넓은 마른 돌판을 깐다
  const cx=48, cz=48, gy=30;
  for(let x=cx-30;x<=cx+30;x++) for(let z=cz-30;z<=cz+30;z++){
    for(let y=1;y<H.WY;y++) H.set(x,y,z, y<gy?B.STONE:B.AIR);
  }
  H.refreshAllTops();
  H.player.pos.set(cx+0.5, gy, cz+0.5);
  // 6×6 울타리 목장
  for(let d=-3;d<=3;d++){
    H.set(cx+d, gy, cz-3, B.FENCE); H.set(cx+d, gy, cz+3, B.FENCE);
    H.set(cx-3, gy, cz+d, B.FENCE); H.set(cx+3, gy, cz+d, B.FENCE);
  }
  H.refreshAllTops();
  H.seedMobs();
  // 동물 3마리를 목장 안에 강제로 넣는다
  for(let i=0;i<3;i++){ H.mobs[i].x=cx+0.5+i*0.7; H.mobs[i].z=cz+0.5; H.mobs[i].y=gy; }
  // 나머지는 멀리 (플레이어가 목장을 떠난 뒤 anyMobNear 를 흉내내지 않게)
  for(let i=3;i<H.mobs.length;i++){ H.mobs[i].x=6; H.mobs[i].z=6; H.mobs[i].y=H.topMap[6*H.WX+6]+1; }
  const inPen = () => H.mobs.slice(0,3).filter(m => Math.abs(m.x-cx-0.5)<3 && Math.abs(m.z-cz-0.5)<3).length;
  r.penStart = inPen();
  // 60초 동안 목장 안에 머문다
  for(let t=0;t<600;t++) H.updateMobs(0.1);
  r.penAfterStay = inPen();
  // 이제 플레이어가 섬 반대편으로 간다 (50칸 넘게)
  H.player.pos.set(cx+0.5, gy, cz-40 > 2 ? cz-40 : 5);
  for(let t=0;t<300;t++) H.updateMobs(0.1);
  r.penAfterWalkAway = inPen();
  r.mobPositions = H.mobs.slice(0,3).map(m=>[Math.round(m.x),Math.round(m.y),Math.round(m.z)]);
  r.playerPos = [H.player.pos.x, H.player.pos.y, H.player.pos.z];
  return r;
});
console.log(JSON.stringify(out,null,1));
if (errors.length) console.log("ERRORS", errors.slice(0,8));
await browser.close(); stopServer();
