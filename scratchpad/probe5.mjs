import { launch, openGame, stopServer } from "../tests/harness.mjs";

const browser = await launch();
const { page, errors } = await openGame(browser);

const seeds = [101, 2025, 4242, 7777, 31337, 555, 90210, 1234];
const out = await page.evaluate(async (seeds) => {
  const H = window.__blockyard;
  const { WX, WY, WZ, idx, get, B } = H;
  const res = [];
  for (const sd of seeds) {
    H.generate(sd);
    H.refreshAllTops();
    H.relightAll(false);
    const w = H.world;
    // 1) 동굴 공기 셀: y<지표-2 이면서 AIR
    let caveCells = 0;
    const cave = new Uint8Array(WX*WY*WZ);
    for (let x=0;x<WX;x++) for (let z=0;z<WZ;z++) {
      const h = H.heightMap[z*WX+x];
      for (let y=1;y<h-2;y++) { const i=idx(x,y,z); if (w[i]===B.AIR) { cave[i]=1; caveCells++; } }
    }
    // 2) 연결 성분 (6방향 flood)
    const comp = new Int32Array(WX*WY*WZ).fill(-1);
    const sizes = [];
    const D=[[1,0,0],[-1,0,0],[0,1,0],[0,-1,0],[0,0,1],[0,0,-1]];
    for (let x=0;x<WX;x++) for (let y=1;y<WY;y++) for (let z=0;z<WZ;z++) {
      const i0=idx(x,y,z); if(!cave[i0]||comp[i0]>=0) continue;
      const id=sizes.length; let n=0; const st=[[x,y,z]]; comp[i0]=id;
      while(st.length){ const [cx,cy,cz]=st.pop(); n++;
        for(const d of D){ const nx=cx+d[0],ny=cy+d[1],nz=cz+d[2];
          if(nx<0||ny<0||nz<0||nx>=WX||ny>=WY||nz>=WZ) continue;
          const j=idx(nx,ny,nz); if(cave[j]&&comp[j]<0){comp[j]=id;st.push([nx,ny,nz]);} } }
      sizes.push(n);
    }
    sizes.sort((a,b)=>b-a);
    // 3) 지표 입구: 동굴 셀 중 위로 쭉 올라가 하늘까지 뚫린 것 (y=지표+ 이상 AIR)
    let mouths = 0;
    const mouthComp = new Set();
    for (let x=0;x<WX;x++) for (let z=0;z<WZ;z++) {
      const h = H.heightMap[z*WX+x];
      // 지표에서 아래로 내려가며 첫 공기 기둥이 동굴에 닿는가
      let y=h;
      if (w[idx(x,y,z)]!==B.AIR) continue;
      while(y>0 && w[idx(x,y,z)]===B.AIR) y--;
      y++;
      if (y<h-2) { mouths++; const c=comp[idx(x,y,z)]; if(c>=0) mouthComp.add(c); }
    }
    // 연결된 입구가 있는 성분 크기 합
    let reachable = 0;
    for (const c of mouthComp) reachable += sizes[c] !== undefined ? 0 : 0;
    // sizes 는 정렬돼서 인덱스가 어긋남 — 다시 센다
    const rawSizes = [];
    { const comp2 = comp; const cnt = {};
      for (let i=0;i<comp2.length;i++){ const c=comp2[i]; if(c>=0) cnt[c]=(cnt[c]||0)+1; }
      for (const c of mouthComp) reachable += cnt[c]||0;
    }
    // 4) 광석 수 + 노출 광석(공기에 면한 것)
    const ores = {COAL:0,IRON:0,GOLD:0,DIAMOND:0};
    const exposed = {COAL:0,IRON:0,GOLD:0,DIAMOND:0};
    const names = {[B.COAL]:"COAL",[B.IRON]:"IRON",[B.GOLD]:"GOLD",[B.DIAMOND]:"DIAMOND"};
    for (let x=0;x<WX;x++) for (let y=1;y<WY;y++) for (let z=0;z<WZ;z++) {
      const i=idx(x,y,z); const nm=names[w[i]]; if(!nm) continue; ores[nm]++;
      let ex=false;
      for(const d of D){ const nx=x+d[0],ny=y+d[1],nz=z+d[2];
        if(nx<0||ny<0||nz<0||nx>=WX||ny>=WY||nz>=WZ) continue;
        if(w[idx(nx,ny,nz)]===B.AIR){ex=true;break;} }
      if(ex) exposed[nm]++;
    }
    // 5) 용암 칸
    let lava=0; for(let i=0;i<w.length;i++) if(w[i]===B.LAVA) lava++;
    res.push({ seed: sd, caveCells, comps: sizes.length, big: sizes.slice(0,3), mouths,
               mouthComps: mouthComp.size, reachable, ores, exposed, lava });
  }
  return res;
}, seeds);
console.log(JSON.stringify(out, null, 1));
if (errors.length) console.log("ERRORS", errors.slice(0,5));
await browser.close(); stopServer();
