import { launch, openGame, stopServer } from "../tests/harness.mjs";
const browser = await launch();
const { page, errors } = await openGame(browser);
const out = await page.evaluate(async () => {
  const H = window.__blockyard, S = H.S, B = H.B;
  const r = {};
  H.generate(1234); H.refreshAllTops(); H.relightAll(false);

  // ── 눈이 되돌리기 기록을 먹는가 (그리고 영영 안 녹는가)
  // 평지 잔디 위에 선다
  let fx=-1, fz=-1;
  for (let x=20;x<70&&fx<0;x++) for(let z=20;z<70;z++){
    const h=H.topMap[z*H.WX+x];
    if (H.world[H.idx(x,h,z)]===B.GRASS){ fx=x; fz=z; break; }
  }
  H.player.pos.set(fx+0.5, H.topMap[fz*H.WX+fx]+1, fz+0.5);
  S.history.length=0; S.future.length=0;
  S.weather = 2; S.weatherMix = 1; S.snowTimer = 0;
  S.active = true;
  // step() 을 30초분 돌린다 (0.05s × 600)
  let hist=[];
  for (let i=0;i<600;i++){ H.step(0.05); }
  r.snow = { history: S.history.length, snowPlaced: 0 };
  let sn=0, snTouched=0;
  for(let x=fx-16;x<=fx+16;x++) for(let z=fz-16;z<=fz+16;z++){
    if(x<0||z<0||x>=H.WX||z>=H.WZ) continue;
    const h=H.topMap[z*H.WX+x];
    if(H.world[H.idx(x,h,z)]===B.SNOW){ sn++; if(H.isTouched(x,h,z)) snTouched++; }
  }
  r.snow.snowPlaced = sn; r.snow.snowTouched = snTouched;
  // 이제 비로 바꾸고 30초 — 녹는가?
  S.weather = 1; S.weatherMix = 1;
  for (let i=0;i<600;i++){ H.step(0.05); }
  let sn2=0;
  for(let x=fx-16;x<=fx+16;x++) for(let z=fz-16;z<=fz+16;z++){
    if(x<0||z<0||x>=H.WX||z>=H.WZ) continue;
    const h=H.topMap[z*H.WX+x];
    if(H.world[H.idx(x,h,z)]===B.SNOW) sn2++;
  }
  r.snow.afterRain = sn2;
  r.snow.historyAfterRain = S.history.length;
  return r;
});
console.log(JSON.stringify(out,null,1));
if (errors.length) console.log("ERRORS", errors.slice(0,8));
await browser.close(); stopServer();
