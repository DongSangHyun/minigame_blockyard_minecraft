import { launch, openGame, stopServer } from "../tests/harness.mjs";
const browser = await launch();
const { page, errors } = await openGame(browser);
const out = await page.evaluate(async () => {
  const H = window.__blockyard, S = H.S, B = H.B;
  const r = {};
  H.generate(4242); H.refreshAllTops(); H.relightAll(false);

  // ── 1) 문 여닫기가 되돌리기 기록을 먹는가
  S.history.length = 0; S.future.length = 0;
  // 평지에 문 놓기
  const px = 40, py = 30, pz = 40;
  for (let y=py-1;y<py+3;y++) for(let dx=-1;dx<=1;dx++) for(let dz=-1;dz<=1;dz++) H.set(px+dx,y,pz+dz,B.AIR);
  H.applyEdit(px, py-1, pz, B.STONE, false);
  const sh = H.doorShapeFor(0,false);
  H.applyEdit(px, py, pz, B.DOOR, true, sh);
  H.applyEdit(px, py+1, pz, B.DOOR, true, sh);
  const before = S.history.length;
  // 문을 10번 여닫는다 (tryInteract 경로)
  for (let k=0;k<10;k++) {
    H.tryInteract({ block: B.DOOR, x: px, y: py, z: pz, shape: H.shapeAt(px,py,pz), nx:0,ny:0,nz:-1 });
  }
  r.doorUndo = { beforeHistory: before, afterHistory: S.history.length, futureCleared: S.future.length };

  // 되돌리기 한 번 하면 무엇이 되돌아가는가
  H.undo();
  r.afterOneUndo_doorOpen = H.doorOpen(H.shapeAt(px,py,pz));

  // ── 2) 울타리문(GATE)도 같은가
  S.history.length = 0;
  H.applyEdit(px+2, py, pz, B.GATE, true, 0);
  const g0 = S.history.length;
  for (let k=0;k<5;k++) H.tryInteract({ block:B.GATE, x:px+2,y:py,z:pz, shape:H.shapeAt(px+2,py,pz), nx:0,ny:0,nz:-1});
  r.gateUndo = { before:g0, after:S.history.length };

  // ── 3) 복사·붙여넣기가 물 레벨을 옮기는가 (흐르는 물 → 근원?)
  H.generate(4242); H.refreshAllTops();
  // 물 근원 하나 놓고 퍼뜨린다
  const wx=50, wy=20, wz=50;
  for (let y=wy-1;y<wy+2;y++) for(let dx=-6;dx<=6;dx++) for(let dz=-6;dz<=6;dz++) H.set(wx+dx,y,wz+dz,y===wy-1?B.STONE:B.AIR);
  H.refreshAllTops();
  H.applyEdit(wx,wy,wz,B.WATER,false);
  H.enqueueWaterAround(wx,wy,wz);
  for(let t=0;t<200;t++) H.waterTick(8);
  let wcount=0, srcCount=0;
  for(let dx=-6;dx<=6;dx++) for(let dz=-6;dz<=6;dz++){ const i=H.idx(wx+dx,wy,wz+dz); if(H.world[i]===B.WATER){wcount++; if(H.waterLvl[i]===0) srcCount++;} }
  r.waterBefore = { cells: wcount, sources: srcCount };
  // 영역을 복사해 옆에 붙인다
  S.selA=[wx-6,wy,wz-6]; S.selB=[wx+6,wy,wz+6];
  H.copySelection();
  H.pasteClip(wx-6, wy+4, wz-6);
  let wc2=0, sc2=0;
  for(let dx=0;dx<=12;dx++) for(let dz=0;dz<=12;dz++){ const i=H.idx(wx-6+dx,wy+4,wz-6+dz); if(H.world[i]===B.WATER){wc2++; if(H.waterLvl[i]===0) sc2++;} }
  r.waterPasted = { cells: wc2, sources: sc2 };

  // ── 4) 지하 밝기
  H.generate(4242); H.refreshAllTops(); H.relightAll(false);
  let dark0=0, cave=0, lit=0;
  for(let x=0;x<H.WX;x++) for(let z=0;z<H.WZ;z++){
    const h=H.heightMap[z*H.WX+x];
    for(let y=1;y<h-2;y++){ const i=H.idx(x,y,z); if(H.world[i]!==B.AIR) continue; cave++;
      const l=Math.max(H.lightSky[i],H.lightBlk[i]); if(l===0) dark0++; else if(l>=4) lit++; }
  }
  r.caveLight = { cave, pitchBlack: dark0, lit4plus: lit };

  // ── 5) 기본 핫바에 뭐가 있나
  r.bar = Array.from(S.bar).map(b=>H.NAMES[b]);
  r.bar2 = H.DEFAULT_BAR2.map(b=>H.NAMES[b]);
  r.achCount = H.ACHIEVEMENTS.length;
  r.regionMax = H.REGION_MAX;
  return r;
});
console.log(JSON.stringify(out,null,1));
if (errors.length) console.log("ERRORS", errors.slice(0,8));
await browser.close(); stopServer();
