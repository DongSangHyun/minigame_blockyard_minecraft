import { launch, openGame, stopServer } from "../tests/harness.mjs";
const browser = await launch();
const { page, errors } = await openGame(browser);
const out = await page.evaluate(async () => {
  const H = window.__blockyard, B = H.B;
  const res = {};
  for (const sd of [4242, 90210, 1234]) {
    H.generate(sd); H.refreshAllTops(); H.relightAll(false);
    const hs = new Array(16).fill(0), hb = new Array(16).fill(0), hm = new Array(16).fill(0);
    let deep = 0, deepDark = 0;
    for(let x=0;x<H.WX;x++) for(let z=0;z<H.WZ;z++){
      const h=H.heightMap[z*H.WX+x];
      for(let y=1;y<h-2;y++){ const i=H.idx(x,y,z); if(H.world[i]!==B.AIR) continue;
        hs[H.lightSky[i]]++; hb[H.lightBlk[i]]++; hm[Math.max(H.lightSky[i],H.lightBlk[i])]++;
        if (y<=8) { deep++; if (Math.max(H.lightSky[i],H.lightBlk[i])<4) deepDark++; }
      }
    }
    res[sd] = { sky: hs, blk: hb, max: hm, deep, deepDark };
  }
  res.EMIT_LAVA = null;
  return res;
});
console.log(JSON.stringify(out));
if (errors.length) console.log("ERRORS", errors.slice(0,5));
await browser.close(); stopServer();
