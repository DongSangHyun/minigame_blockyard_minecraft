// npc.js — 혼자 나무를 베고 집을 짓고 돌아다니는 건축가 NPC 한 명.
//
// 동물(mobs.js)과 **따로** 둔다: 동물 배열에 넣으면 상한·번식·털·좌클릭 제거·저장 칸이 전부
// 이 사람에게도 걸린다. 여기는 한 명뿐이라 자기 상태(`npc`)만 들고 있다.
//
// 하는 일: 나무를 베어 재료(나무)를 모으고 → 빈 터를 골라 집을 **블록 한 칸씩** 올리고
//         → 낮에는 돌아다니며 또 베고 → 밤이면 제 집에 들어가 쉰다.
// 세계를 바꿀 때는 언제나 `applyEdit(…, record=false)` — 되돌리기에 안 쌓이고(자연의 일이 아니라
// 사람의 편집 틀을 쓰지 않는다 · v140 교훈), 조명·메시·저장이 어긋나지 않는다.
// 지은 칸은 `markNpcBuilt`(값 2) — 「사람이 손댄 칸」(1)이 아니라서 과제 판정이 NPC 의 집을 내 건축으로 세지 않는다.
//
// 규칙: 플레이어가 손댄 칸(`isTouched`)은 건드리지 않는다. 플레이어 몸이 있는 칸에는 안 놓는다.
import { SEA, WX, WY, WZ, idx } from "./dims.js";
import { shapeAt, topMap, world, worldGen, isBuilt, isTouched, markNpcBuilt } from "./world.js";
import { AIR, BIRCH_LOG, CARPET0, CRAFT_TABLE, DIRT, DOOR, GLASS, GRASS, GRAVEL, ICE, LAVA, LOG, PLANKS, SAND, SAPLING, SAPLING_BIRCH, SAPLING_SPRUCE, SNOW, SPRUCE_LOG, STONE, TORCH, WATER, doorShapeFor, isLeaf, isLog, isSolid, isUnbreakable } from "./blocks.js";
import { applyEdit } from "./edit.js";
import { mobGroup } from "./mobs.js";
import { player, BODY } from "./player.js";
import { at, crunch, tone } from "./audio.js";
import { lightBlk, lightSky } from "./light.js";
import { dayLight } from "./daynight.js";
import { toast } from "./hud.js";
import { S } from "./state.js";

export var NPC_NAMES = ["하람", "이든", "서윤", "도윤", "나래", "보람"];
export var NPC_SPEED = 2.3;          // 칸/초 — 사람 걸음(4.6)의 절반
export var NPC_MAX_HOUSES = 3;       // 한 세계에 지어 주는 집은 셋까지 — 섬이 집으로 덮이지 않게
export var NPC_WOOD0 = 30;           // 처음 가진 재료 — 베기 전에도 바닥을 깔 수 있게
export var NPC_WOOD_PER_LOG = 5;     // 원목 하나가 주는 재료
export var BUILD_GAP = 0.32;         // 블록 한 칸 놓는 간격(초)
export var DIG_GAP = 0.07;           // 터를 고르는 간격(초) — 깎고 메우는 일은 빨리 한다
export var CHOP_GAP = 0.5;           // 원목 한 개 베는 간격(초)

export var npc = null;
var pending = null;                  // 저장에서 읽은 상태 — 처음 켜질 때 풀어낸다

var npcGroup = new THREE.Group();
mobGroup.add(npcGroup);              // 동물과 같이 숨는다(사진 모드·시작 화면 규칙을 그대로 따른다)

// ── 몸 ─────────────────────────────────────────────
function litMat(color) {
  var m = new THREE.MeshBasicMaterial({ color: color });
  m.userData.base = new THREE.Color(color);
  return m;
}
function part(w, h, d, color, py) {
  var m = new THREE.Mesh(new THREE.BoxGeometry(w, h, d), litMat(color));
  m.position.y = py;
  return m;
}
function nameTag(text) {
  var cv = document.createElement("canvas");
  cv.width = 256; cv.height = 64;
  var c = cv.getContext("2d");
  c.fillStyle = "rgba(0,0,0,0.5)";
  c.fillRect(0, 8, 256, 48);
  c.font = "bold 30px sans-serif";
  c.textAlign = "center"; c.textBaseline = "middle";
  c.fillStyle = "#ffffff";
  c.fillText(text, 128, 33);
  var sp = new THREE.Sprite(new THREE.SpriteMaterial({
    map: new THREE.CanvasTexture(cv), transparent: true, fog: false, depthWrite: false }));
  sp.scale.set(1.5, 0.375, 1);
  sp.position.y = 2.3;
  return sp;
}
function makeBody(name) {
  var g = new THREE.Group();
  g.add(part(0.52, 0.72, 0.28, 0x3f8f5f, 1.08));                    // 몸 — 초록 윗옷(상인 보라와 다르게)
  var head = part(0.42, 0.42, 0.42, 0xe0b48a, 1.65); g.add(head);
  g.add(part(0.45, 0.14, 0.45, 0x4a3320, 1.9));                     // 머리카락
  var fringe = part(0.34, 0.06, 0.04, 0x4a3320, 1.72);               // 앞머리
  fringe.position.z = -0.215;
  g.add(fringe);
  var legs = [], arms = [];
  for (var i = 0; i < 2; i++) {
    var sx = i ? 1 : -1;
    var lg = part(0.22, 0.72, 0.24, 0x35507a, 0);
    lg.geometry.translate(0, -0.36, 0);
    lg.position.set(sx * 0.13, 0.72, 0);
    g.add(lg); legs.push(lg);
    var ar = part(0.18, 0.66, 0.2, 0xe0b48a, 0);
    ar.geometry.translate(0, -0.29, 0);
    ar.position.set(sx * 0.35, 1.42, 0);
    g.add(ar); arms.push(ar);
  }
  var shadow = new THREE.Mesh(new THREE.CircleGeometry(0.42, 10),
    new THREE.MeshBasicMaterial({ color: 0x000000, transparent: true, opacity: 0.22, depthWrite: false, fog: false }));
  shadow.rotation.x = -Math.PI / 2; shadow.position.y = 0.02;
  g.add(shadow);
  g.add(nameTag("건축가 " + name));
  npcGroup.add(g);
  return { g: g, legs: legs, arms: arms };
}
export function disposeNpc() {
  if (!npc) return;
  npcGroup.remove(npc.g);
  npc.g.traverse(function (o) {
    if (o.geometry) o.geometry.dispose();
    if (o.material) { if (o.material.map) o.material.map.dispose(); if (o.material.dispose) o.material.dispose(); }
  });
  npc = null;
}

// ── 땅 읽기 ────────────────────────────────────────
// 내 집(짓는 중인 집도) 지붕 칸 — 언덕에서 지붕으로 걸어 올라가 집을 넘어가지 않게 바닥으로 안 친다
function isRoofCell(x, y, z) {
  var n = npc;
  if (!n) return false;
  var i, h;
  for (i = 0; i < n.houses.length; i++) {
    h = n.houses[i];
    if (y === h[2] + 4 && Math.abs(x - h[0]) <= 2 && Math.abs(z - h[1]) <= 2) return true;
  }
  h = n.plan;
  return !!h && y === h.g + 4 && Math.abs(x - h.x) <= 2 && Math.abs(z - h.z) <= 2;
}
function free(b) { return (!isSolid(b) && b !== WATER && b !== LAVA) || b === DOOR; }   // 문은 열고 지나간다
function floorOk(b) { return isSolid(b) && b !== DOOR && b !== ICE && !isLeaf(b); }
// 그 칸 기둥에서 서 있을 수 있는 높이(발이 닿는 y) — fromY 근처를 훑는다. 없으면 -1
export function standAt(cx, cz, fromY) {
  if (cx < 1 || cz < 1 || cx >= WX - 1 || cz >= WZ - 1) return -1;
  var hi = Math.min(WY - 3, Math.floor(fromY) + 1), lo = Math.max(1, Math.floor(fromY) - 3);
  for (var sy = hi; sy >= lo; sy--) {
    if (!floorOk(world[idx(cx, sy, cz)]) || isRoofCell(cx, sy, cz)) continue;
    if (!free(world[idx(cx, sy + 1, cz)]) || !free(world[idx(cx, sy + 2, cz)])) continue;
    return sy + 1;
  }
  return -1;
}
// 기둥 전체에서 위에서부터 — 텔레포트·첫 자리용. 잎 위는 땅이 아니다
function groundDeep(cx, cz) {
  for (var sy = Math.min(WY - 4, topMap[cz * WX + cx]); sy >= 1; sy--) {
    if (!floorOk(world[idx(cx, sy, cz)]) || isRoofCell(cx, sy, cz)) continue;
    if (!free(world[idx(cx, sy + 1, cz)]) || !free(world[idx(cx, sy + 2, cz)])) continue;
    return sy + 1;
  }
  return -1;
}
// 가까운 서 있을 자리 — 나선으로 훑는다. [x, y, z] 또는 null
function standNear(x, z, r) {
  var bx = Math.floor(x), bz = Math.floor(z);
  for (var d = 0; d <= r; d++) {
    for (var dz = -d; dz <= d; dz++) for (var dx = -d; dx <= d; dx++) {
      if (Math.max(Math.abs(dx), Math.abs(dz)) !== d) continue;
      var gy = groundDeep(bx + dx, bz + dz);
      if (gy > SEA) return [bx + dx + 0.5, gy, bz + dz + 0.5];
    }
  }
  return null;
}
function teleportTo(n, p) { n.x = p[0]; n.y = p[1]; n.z = p[2]; n.wps = []; n.stuck = 0; n.sx = n.x; n.sz = n.z; }

// ── 집 설계 ────────────────────────────────────────
// 5×5 바닥 · 높이 3 벽 · 평평한 지붕. 중심 (cx, cz) · 바닥 높이 g(땅 위 첫 블록 자리, 땅을 덮는다).
// 단계 = [x, y, z, 블록, 모양, 방식, 재료비]  방식: 0 놓기 · 1 치우기(없으면 건너뜀) · 2 비면 흙으로 메우기
// **지형이 아니라 (cx, cz, g) 만으로 정해진다** — 저장에는 몇 번째까지 했는지만 담는다.
// 집은 네 방향으로 돌려 지을 수 있다(r = 0 남 · 1 서 · 2 북 · 3 동 — 문이 보는 쪽). 설계는 늘 남향으로 그리고 돌린다
export function rot(x, z, r) {
  return r === 1 ? [-z, x] : (r === 2 ? [-x, -z] : (r === 3 ? [z, -x] : [x, z]));
}
export function planSteps(cx, cz, g, r) {
  r = r | 0;
  var out = [], x, z, y;
  var s = { push: function (a) {                  // 좌표만 돌려 담는다 — 아래 설계는 남향 그대로 읽힌다
    var q = rot(a[0] - cx, a[2] - cz, r);
    out.push([cx + q[0], a[1], cz + q[1], a[3], a[4], a[5], a[6]]);
  } };
  // 터 5×5 와 문 앞 길(남쪽 세 줄 × 세 칸)을 같은 높이로 고른다 — 문밖이 비탈이면 못 나온다
  for (z = -2; z <= 5; z++) for (x = -2; x <= 2; x++) {
    if (z > 2 && Math.abs(x) > 1) continue;
    for (y = g + 6; y > g; y--) s.push([cx + x, y, cz + z, AIR, 0, 1, 0]);
    for (y = g - 3; y < g; y++) s.push([cx + x, y, cz + z, DIRT, 0, 2, 0]);
  }
  for (z = -2; z <= 2; z++) for (x = -2; x <= 2; x++) s.push([cx + x, g, cz + z, PLANKS, 0, 0, 1]);
  for (y = 1; y <= 3; y++) for (z = -2; z <= 2; z++) for (x = -2; x <= 2; x++) {
    if (Math.abs(x) !== 2 && Math.abs(z) !== 2) continue;                    // 둘레만
    var corner = Math.abs(x) === 2 && Math.abs(z) === 2;
    if (!corner && x === 0 && z === 2 && y <= 2) continue;                   // 문 자리
    if (!corner && y === 2 && ((x === -2 && z === 0) || (x === 2 && z === 0) || (x === 0 && z === -2)))
      s.push([cx + x, g + y, cz + z, GLASS, 0, 0, 0]);                       // 창 셋
    else s.push([cx + x, g + y, cz + z, corner ? LOG : PLANKS, 0, 0, 1]);
  }
  for (z = -2; z <= 2; z++) for (x = -2; x <= 2; x++) s.push([cx + x, g + 4, cz + z, PLANKS, 0, 0, 1]);
  s.push([cx, g + 1, cz + 2, DOOR, doorShapeFor((2 + r) % 4, false), 0, 2]);
  s.push([cx, g + 2, cz + 2, DOOR, doorShapeFor((2 + r) % 4, false), 0, 0]);
  s.push([cx - 1, g + 1, cz - 1, TORCH, 0, 0, 0]);
  s.push([cx + 1, g + 1, cz - 1, CRAFT_TABLE, 0, 0, 0]);
  s.push([cx, g + 1, cz, CARPET0 + 14, 0, 0, 0]);
  return out;
}

// 집 지을 터 — 평평하고, 땅이고, 사람 손이 안 닿았고, 마을 광장·다른 집과 떨어진 곳
var GROUND_OK = {};
GROUND_OK[GRASS] = 1; GROUND_OK[DIRT] = 1; GROUND_OK[SAND] = 1; GROUND_OK[SNOW] = 1;
GROUND_OK[STONE] = 1; GROUND_OK[GRAVEL] = 1;
// 안쪽 5×5 는 땅이고 손 안 닿은 곳이어야 하고, 높이 차이는 4 이내(깎고 메운다).
// 바깥 한 겹은 따지지 않는다 — 나무가 곁에 서 있어도, 물가여도 지을 수 있다(문 앞만 물이 아니면).
// 돌려주는 값: [점수, 바닥 높이 g] · 못 지으면 null
function siteScore(cx, cz, n, r) {
  if (cx < 6 || cz < 6 || cx > WX - 7 || cz > WZ - 7) return null;
  var lo = 999, hi = -999, sum = 0, cnt = 0;
  for (var dz = -3; dz <= 3; dz++) for (var dx = -3; dx <= 3; dx++) {
    var x = cx + dx, z = cz + dz, t = topMap[z * WX + x];
    if (Math.abs(dx) > 2 || Math.abs(dz) > 2) continue;          // 바깥 겹은 아래에서 따로 본다
    if (t <= SEA) return null;                                   // 물가·물속은 피한다
    if (!GROUND_OK[world[idx(x, t, z)]]) return null;            // 나무·잎·물·돌집은 터가 아니다
    if (isBuilt(x, t, z)) return null;
    if (t < lo) lo = t;
    if (t > hi) hi = t;
    sum += t; cnt++;
  }
  if (hi - lo > 4) return null;
  var g = Math.round(sum / cnt);
  // 문 앞(남쪽 세·네 번째 칸)은 걸어 들어올 수 있는 높이여야 한다 — 다른 겹은 물가여도 된다.
  // (벼랑을 마주 보는 문이 한 번 나왔다: 문밖이 8칸 높은 비탈이라 못 나갔다 — 깎고 메울 수 있는 만큼만)
  for (var fz = 3; fz <= 4; fz++) {
    var fq = rot(0, fz, r), ft = topMap[(cz + fq[1]) * WX + cx + fq[0]];
    if (ft <= SEA || ft < g - 3 || ft > g + 5) return null;
  }
  var v = S.village;
  if (v && Math.max(Math.abs(cx - v.x), Math.abs(cz - v.z)) < 16) return null;     // 마을 광장 밖
  for (var i = 0; i < n.houses.length; i++)
    if (Math.max(Math.abs(cx - n.houses[i][0]), Math.abs(cz - n.houses[i][1])) < 9) return null;
  if (g + 7 >= WY || g - 3 < 1) return null;
  return [10 - (hi - lo) * 2 - Math.hypot(cx - n.ax, cz - n.az) * 0.05, g, r];
}
export function pickSite(n) {
  var best = null, bs = -1e9, k, r, q;
  function tryAt(cx, cz) {
    for (var d = 0; d < 4; d++) {
      q = siteScore(cx, cz, n, d);
      if (q && q[0] > bs) { bs = q[0]; best = [cx, cz, q[1], d]; }
    }
  }
  for (k = 0; k < 90; k++) {
    var ang = Math.random() * Math.PI * 2, rr = 12 + Math.random() * 22;
    tryAt(Math.round(n.ax + Math.cos(ang) * rr), Math.round(n.az + Math.sin(ang) * rr));
  }
  if (best) return best;
  // 무작위로 못 찾았다 — 섬 전체를 성기게 훑는다(가까운 곳일수록 점수가 높다)
  for (var z = 6; z <= WZ - 7; z += 2) for (var x = 6; x <= WX - 7; x += 2) tryAt(x, z);
  return best;
}

// ── 나무 ───────────────────────────────────────────
// 가장 가까운 자연 나무 — 기둥 밑동에서 이어진 원목을 다 모은다. 누가 쌓은 원목(사람·건축가가 지은 칸)은 건드리지 않는다
function findTree(n) {
  var cx = Math.floor(n.x), cz = Math.floor(n.z), best = null, bd = 1e9;
  for (var z = Math.max(2, cz - 40); z <= Math.min(WZ - 3, cz + 40); z++)
    for (var x = Math.max(2, cx - 40); x <= Math.min(WX - 3, cx + 40); x++) {
      var t = topMap[z * WX + x];
      if (t < 1) continue;
      var tb = world[idx(x, t, z)];
      if (!isLeaf(tb) && !isLog(tb)) continue;
      var y = t;
      while (y > 1 && isLeaf(world[idx(x, y, z)])) y--;
      if (!isLog(world[idx(x, y, z)])) continue;
      while (y > 1 && isLog(world[idx(x, y - 1, z)])) y--;           // 밑동
      var key = z * WX + x;
      if (n.ban.indexOf(key) >= 0) continue;
      var d = Math.hypot(x - n.x, z - n.z);
      if (d < bd) { bd = d; best = [x, y, z]; }
    }
  if (!best) return null;
  var logs = [], seen = {}, q = [best];
  seen[idx(best[0], best[1], best[2])] = 1;
  while (q.length && logs.length < 80) {
    var c = q.pop();
    if (isBuilt(c[0], c[1], c[2])) return { base: best, logs: [], mine: true };     // 누가 쌓은 원목(내 집 기둥 포함)은 나무가 아니다
    logs.push(c);
    for (var dz2 = -1; dz2 <= 1; dz2++) for (var dy = -1; dy <= 1; dy++) for (var dx2 = -1; dx2 <= 1; dx2++) {
      var nx = c[0] + dx2, ny = c[1] + dy, nz = c[2] + dz2;
      if (nx < 0 || nz < 0 || ny < 1 || nx >= WX || nz >= WZ || ny >= WY) continue;
      var ni = idx(nx, ny, nz);
      if (seen[ni] || !isLog(world[ni])) continue;
      seen[ni] = 1; q.push([nx, ny, nz]);
    }
  }
  logs.sort(function (a, b) { return b[1] - a[1]; });                  // 위에서부터 벤다
  return { base: best, logs: logs };
}

// ── 밝기 · 소리 ────────────────────────────────────
function tint(n) {
  var gx = Math.max(0, Math.min(WX - 1, Math.floor(n.x)));
  var gz = Math.max(0, Math.min(WZ - 1, Math.floor(n.z)));
  var gy = Math.max(0, Math.min(WY - 1, Math.floor(n.y + 0.5)));
  var li = idx(gx, gy, gz);
  var lv = Math.max(lightSky[li] * dayLight(S.timeOfDay), lightBlk[li]) / 15;
  var lt = Math.max(0.14, Math.min(1, 0.12 + lv * 0.95));
  if (Math.abs(lt - n.lit) < 0.02) return;
  n.lit = lt;
  n.g.traverse(function (o) {
    var bc = o.material && o.material.userData && o.material.userData.base;
    if (bc) o.material.color.setRGB(bc.r * lt, bc.g * lt, bc.b * lt);
  });
}
function thock(n, x, y, z, low) {
  var cd = Math.hypot(x - player.pos.x, z - player.pos.z);
  if (cd > 30) return;
  var pn = at(x, y + 0.5, z), far = pn ? 1 : Math.max(0.08, 1 - cd / 30);
  crunch(0.07, 0.07 * far, low ? 500 : 800, pn);
  if (!low) tone(260 + Math.random() * 60, 0.05, "square", 0.025 * far, pn);
}

// ── 만들기 · 저장 ──────────────────────────────────
function newState(x, y, z, yaw, name) {
  var b = makeBody(NPC_NAMES[name]);
  return { g: b.g, legs: b.legs, arms: b.arms, nameIdx: name, lit: -1, gen: worldGen,
           x: x, y: y, z: z, yaw: yaw, ax: x, az: z,
           act: "idle", timer: 3, wps: [], stuck: 0, sx: x, sz: z, sTimer: 0,
           phase: 0, swing: 0, work: 0, wood: NPC_WOOD0, houses: [], plan: null,
           cool: 6, ban: [], fails: 0, tree: null, chopI: 0, night: false, doorT: 0, buriedT: 0, lastCost: 0 };
}
export function resetNpc() { disposeNpc(); pending = null; }
export function loadNpc(o) { resetNpc(); if (o && typeof o === "object") pending = o; }
export function dumpNpc() {
  if (!npc) return pending || 0;
  return { x: Math.round(npc.x * 4), y: Math.round(npc.y * 4), z: Math.round(npc.z * 4),
           yw: Math.round(npc.yaw * 100), wd: npc.wood | 0, nm: npc.nameIdx,
           h: npc.houses.map(function (h) { return h.slice(); }),
           b: npc.plan ? [npc.plan.x, npc.plan.z, npc.plan.g, npc.plan.i, npc.plan.r | 0] : 0,
           cl: Math.round(npc.cool), an: [Math.round(npc.ax), Math.round(npc.az)] };
}
// 처음 켜질 때 — 저장이 있으면 풀고, 없으면 마을 곁(마을이 없으면 내 곁)에 세운다
function ensureNpc() {
  var n;
  if (pending) {
    var p = pending; pending = null;
    var nm = ((p.nm | 0) % NPC_NAMES.length + NPC_NAMES.length) % NPC_NAMES.length;
    n = newState((p.x || 0) / 4, (p.y || 0) / 4, (p.z || 0) / 4, (p.yw || 0) / 100, nm);
    n.wood = Math.max(0, Math.min(999, p.wd | 0));
    if (Array.isArray(p.h)) for (var i = 0; i < p.h.length && i < NPC_MAX_HOUSES; i++)
      if (Array.isArray(p.h[i]) && p.h[i].length >= 3) n.houses.push([p.h[i][0] | 0, p.h[i][1] | 0, p.h[i][2] | 0, (p.h[i][3] | 0) & 3]);
    if (Array.isArray(p.b) && p.b.length >= 4) {
      var pr = (p.b[4] | 0) & 3;
      n.plan = { x: p.b[0] | 0, z: p.b[1] | 0, g: p.b[2] | 0, r: pr, i: p.b[3] | 0, steps: planSteps(p.b[0] | 0, p.b[1] | 0, p.b[2] | 0, pr) };
    }
    n.cool = p.cl | 0;
    if (Array.isArray(p.an)) { n.ax = p.an[0] | 0; n.az = p.an[1] | 0; }
    // 저장된 자리가 막혀 있으면(그 사이 무언가 놓였다) 가까운 자리로
    if (standAt(Math.floor(n.x), Math.floor(n.z), n.y) < 0) {
      var sp = standNear(n.x, n.z, 8); if (sp) teleportTo(n, sp);
    }
    npc = n; npcGroup.add(n.g);
    return;
  }
  var v = S.village, bx = v ? v.spawn[0] : player.pos.x, bz = v ? v.spawn[2] : player.pos.z;
  var name = Math.abs(S.worldSeed | 0) % NPC_NAMES.length;
  var at0 = standNear(bx + 4, bz + 4, 10) || standNear(player.pos.x + 3, player.pos.z + 3, 12);
  if (!at0) return;                            // 땅이 아직 없다 — 다음 프레임에 다시
  n = newState(at0[0], at0[1], at0[2], 0, name);
  npc = n; npcGroup.add(n.g);
}

// ── 움직임 ─────────────────────────────────────────
// 한 걸음 — 앞 칸이 서 있을 만하면 {x,y,z}, 아니면 null. 한 칸 넘는 오름·두 칸 넘는 내림은 안 간다
function tryStep(n, yaw, sp) {
  var nx = n.x - Math.sin(yaw) * sp, nz = n.z - Math.cos(yaw) * sp;
  var ny = standAt(Math.floor(nx), Math.floor(nz), n.y);
  if (ny < 0 || ny - n.y > 1.01 || n.y - ny > 4.01) return null;   // 한 칸 넘는 오름은 못 간다 · 네 칸 아래까지는 뛰어내린다
  return { x: nx, y: ny, z: nz };
}
var OFFS = [0, 0.6, -0.6, 1.3, -1.3, 2.0, -2.0];
// 길표(n.wps)를 따라 간다 — 1 도착 · 0 가는 중 · -1 막혀서 못 감
function walk(n, dt) {
  var w = n.wps[0];
  if (!w) return 1;
  var dx = w[0] - n.x, dz = w[1] - n.z, d = Math.hypot(dx, dz);
  if (d < (w[2] || 0.45)) { n.wps.shift(); return n.wps.length ? 0 : 1; }
  var base = Math.atan2(-dx, -dz), sp = Math.min(d, NPC_SPEED * dt), st = null;
  for (var i = 0; i < OFFS.length && !st; i++) {
    var o = OFFS[i];
    if (i && n.turnPref) o *= n.turnPref;                    // 한 번 고른 쪽으로 돌아 나간다 — 좌우로 떨지 않게
    st = tryStep(n, base + o, sp);
    if (st) { n.yaw += angDiff(n.yaw, base + o) * Math.min(1, dt * 10); if (i) n.turnPref = o < 0 ? -1 : 1; }
  }
  if (st) {
    n.x = st.x; n.z = st.z; n.y += (st.y - n.y) * Math.min(1, dt * 10);
    n.walkNow = 1;
    if (!n.turnPref || Math.abs(angDiff(n.yaw, base)) < 0.2) n.turnPref = 0;
  }
  // 2초에 0.8칸도 못 갔으면 막힌 것
  n.sTimer += dt;
  if (n.sTimer >= 2) {
    n.sTimer = 0;
    if (Math.hypot(n.x - n.sx, n.z - n.sz) < 0.8) n.stuck++; else n.stuck = 0;
    n.sx = n.x; n.sz = n.z;
    if (n.stuck >= 2) { n.stuck = 0; return -1; }
  }
  return 0;
}
function angDiff(a, b) {
  var d = (b - a) % (Math.PI * 2);
  if (d > Math.PI) d -= Math.PI * 2;
  if (d < -Math.PI) d += Math.PI * 2;
  return d;
}

// 문 앞 · 문 칸 · 집 안 — 집 하나의 길표 점들
function houseDoor(h) {
  var f = rot(0, 4, h[3] | 0), d = rot(0, 2, h[3] | 0);
  return { fx: h[0] + 0.5 + f[0], fz: h[1] + 0.5 + f[1], dx: h[0] + 0.5 + d[0], dz: h[1] + 0.5 + d[1],
           ix: h[0] + 0.5, iz: h[1] + 0.5, cx: h[0] + d[0], cz: h[1] + d[1] };
}
function insideHouse(n) {
  for (var i = 0; i < n.houses.length; i++) {
    var h = n.houses[i];
    if (Math.abs(n.x - (h[0] + 0.5)) < 2.4 && Math.abs(n.z - (h[1] + 0.5)) < 2.4 && Math.abs(n.y - (h[2] + 1)) < 1.6) return i;
  }
  return -1;
}
// 어디로 가든 집 안에 있으면 문으로 먼저 나온다. 안으로 가려면 문으로 들어간다
function routeTo(n, tx, tz, intoHouse) {
  var w = [], cur = insideHouse(n);
  if (cur >= 0 && cur !== intoHouse) { var d0 = houseDoor(n.houses[cur]); w.push([d0.dx, d0.dz, 0.4], [d0.fx, d0.fz, 0.5]); }
  if (intoHouse >= 0 && cur !== intoHouse) {
    var d1 = houseDoor(n.houses[intoHouse]), hh = n.houses[intoHouse];
    // 집을 가로지를 수는 없다 — 둘레(네모난 고리)를 따라 문 앞까지 돌아간다
    var ring = [[4.6, 0], [4.6, 4.6], [0, 4.6], [-4.6, 4.6], [-4.6, 0], [-4.6, -4.6], [0, -4.6], [4.6, -4.6]];
    var near = function (px, pz) {
      var bi = 0, bd = 1e9;
      for (var q = 0; q < 8; q++) { var dd = Math.hypot(hh[0] + 0.5 + ring[q][0] - px, hh[1] + 0.5 + ring[q][1] - pz); if (dd < bd) { bd = dd; bi = q; } }
      return bi;
    };
    var a = near(n.x, n.z), b = near(d1.fx, d1.fz);
    var fwd = (b - a + 8) % 8, step = fwd <= 4 ? 1 : -1, cnt = Math.min(fwd, 8 - fwd);
    for (var k = 0, q2 = a; k <= cnt; k++, q2 = (q2 + step + 8) % 8)
      w.push([hh[0] + 0.5 + ring[q2][0], hh[1] + 0.5 + ring[q2][1], 0.9]);
    w.push([d1.fx, d1.fz, 0.5], [d1.dx, d1.dz, 0.4]);
  }
  w.push([tx, tz, intoHouse >= 0 ? 0.3 : 0.6]);
  n.wps = w; n.stuck = 0; n.sx = n.x; n.sz = n.z; n.sTimer = 0;
}

// 문은 가까이 오면 열리고 멀어지면 닫힌다
function tickDoors(n) {
  for (var i = 0; i < n.houses.length; i++) {
    var h = n.houses[i], hd = houseDoor(h), dx = hd.cx, dz = hd.cz, y1 = h[2] + 1, y2 = h[2] + 2;
    if (world[idx(dx, y1, dz)] !== DOOR) continue;                         // 헐렸거나 아직 안 지었다
    var near = Math.hypot(n.x - (dx + 0.5), n.z - (dz + 0.5)) < 2.0 && Math.abs(n.y - (h[2] + 1)) < 2;
    var want = doorShapeFor((2 + (h[3] | 0)) % 4, near);
    if (shapeAt(dx, y1, dz) !== want) applyEdit(dx, y1, dz, DOOR, false, want);
    if (world[idx(dx, y2, dz)] === DOOR && shapeAt(dx, y2, dz) !== want) applyEdit(dx, y2, dz, DOOR, false, want);
  }
}

// ── 일 고르기 ──────────────────────────────────────
function isNightNow(n) {
  var l = dayLight(S.timeOfDay);
  if (n.night) { if (l > 0.5) n.night = false; } else if (l < 0.3) n.night = true;
  return n.night;
}
function randomSpot(n) {
  for (var k = 0; k < 12; k++) {
    var ang = Math.random() * Math.PI * 2, r = 4 + Math.random() * 12;
    var p = standNear(n.x + Math.cos(ang) * r, n.z + Math.sin(ang) * r, 2);
    if (p && Math.hypot(p[0] - n.ax, p[2] - n.az) < 34) return p;
  }
  return null;
}
function decide(n) {
  n.walkNow = 0;
  if (isNightNow(n)) {
    if (n.houses.length) {
      var h = n.houses[0], d = houseDoor(h);
      n.act = "home"; routeTo(n, d.ix, d.iz, 0); return;
    }
    n.act = "idle"; n.timer = 6; return;
  }
  if (n.plan) {
    var st = n.plan.steps[n.plan.i];
    if (st && st[6] > n.wood) { startGather(n); return; }          // 재료가 모자라면 나무부터
    n.act = "build"; n.timer = 0; n.spotFor = -1; return;
  }
  if (n.houses.length < NPC_MAX_HOUSES && n.cool <= 0) {
    var site = pickSite(n);
    if (site) { n.plan = { x: site[0], z: site[1], g: site[2], r: site[3], i: 0, steps: planSteps(site[0], site[1], site[2], site[3]) }; return decide(n); }
    n.cool = 60;                                                    // 터가 없다 — 한참 뒤에 다시
  }
  if (n.wood < 60 && Math.random() < 0.5) { startGather(n); return; }
  var sp = randomSpot(n);
  if (sp) { n.act = "wander"; n.timer = 4 + Math.random() * 8; routeTo(n, sp[0], sp[2], -1); }
  else { n.act = "idle"; n.timer = 2; }
}
// 자꾸 못 가면 갇힌 것이다 — 마을 곁(처음 선 자리)으로 돌아가 숨을 돌린다
function strandedCheck(n) {
  if (++n.fails < 3) return;
  n.fails = 0; n.ban.length = 0;
  var sp = standNear(n.ax, n.az, 10);
  if (sp) teleportTo(n, sp);
}
function startGather(n) {
  var t = findTree(n);
  if (t && t.mine) { n.ban.push(t.base[2] * WX + t.base[0]); n.act = "idle"; n.timer = 0.2; return; }
  if (!t) {
    // 베어 낼 나무가 없다 — 한참 돌아다닌 끝에 쓸 만한 가지를 주워 온다
    n.wood += 12; n.act = "idle"; n.timer = 4; return;
  }
  n.tree = t; n.chopI = 0;
  n.act = "toTree"; n.timer = 40;
  routeTo(n, t.base[0] + 0.5, t.base[2] + 0.5, -1);
  n.wps[n.wps.length - 1][2] = 2.2;                                  // 밑동 두 칸 앞이면 도끼가 닿는다
}

// ── 일하기 ─────────────────────────────────────────
function playerInCell(x, y, z) {
  return Math.abs(player.pos.x - (x + 0.5)) < 0.8 && Math.abs(player.pos.z - (z + 0.5)) < 0.8 &&
         player.pos.y < y + 1 && player.pos.y + BODY > y;
}
// 한 단계 — 0 건너뜀(안 놓고 넘어감) · 1 놓았음 · 2 지금은 못 놓음(기다린다)
function doStep(s) {
  var x = s[0], y = s[1], z = s[2], b = s[3], sh = s[4], mode = s[5];
  if (y < 1 || y >= WY) return 0;
  var i = idx(x, y, z), cur = world[i];
  if (mode === 1) {
    if (cur === AIR || isUnbreakable(cur) || isTouched(x, y, z) || cur === WATER || cur === LAVA) return 0;
    applyEdit(x, y, z, AIR, false);
    return 1;
  }
  if (mode === 2) {
    if (isSolid(cur) || cur === WATER || cur === LAVA || isTouched(x, y, z)) return 0;
    applyEdit(x, y, z, DIRT, false);
    return 1;
  }
  if (cur === b && shapeAt(x, y, z) === sh) return 0;
  if (cur !== AIR && isTouched(x, y, z) && cur !== b) return 0;      // 사람이 손댄 칸은 그대로 둔다
  if (cur === WATER || cur === LAVA) return 0;
  if (isSolid(b) && playerInCell(x, y, z)) return 2;
  if (!applyEdit(x, y, z, b, false, sh)) return 0;
  markNpcBuilt(x, y, z);
  return 1;
}
// 놓을 칸을 닿을 만한 곳에서 — 칸이 있는 쪽의 집 둘레
function buildSpot(p, s) {
  var dx = s[0] - p.x, dz = s[2] - p.z, m = Math.max(Math.abs(dx), Math.abs(dz));
  if (m < 1) { dx = 0; dz = 1; m = 1; }
  var k = 3.6 / m;
  return [p.x + 0.5 + dx * k, p.z + 0.5 + dz * k];
}
function finishHouse(n) {
  var p = n.plan;
  n.houses.push([p.x, p.z, p.g, p.r | 0]);
  n.plan = null; n.cool = 150; n.act = "idle"; n.timer = 2;
  if (Math.hypot(player.pos.x - p.x, player.pos.z - p.z) < 60)
    toast("건축가 " + NPC_NAMES[n.nameIdx] + "이(가) 새 집을 다 지었어요");
}

export function updateNpc(dt) {
  // 세계가 새로 만들어졌는데(generate) 옛 건축가가 남아 있으면 — 옛 세계의 집·재료를 들고 일하지 않게 버린다
  if (npc && npc.gen !== worldGen) disposeNpc();
  if (!npc) { ensureNpc(); if (!npc) return; }
  var n = npc;
  dt = Math.min(dt, 0.1);
  n.walkNow = 0;
  n.cool = Math.max(0, n.cool - dt);
  n.swing = Math.max(0, n.swing - dt);

  // 파묻혔으면(누가 머리 위에 블록을 놓았다) 가까운 자리로 — 0.5초마다 본다
  n.buriedT -= dt;
  if (n.buriedT <= 0) {
    n.buriedT = 0.5;
    var fx = Math.floor(n.x), fz = Math.floor(n.z), fy = Math.floor(n.y + 0.05);
    var hb = world[idx(fx, Math.min(WY - 1, fy + 1), fz)], fb = world[idx(fx, fy, fz)];
    if ((isSolid(fb) && fb !== DOOR) || (isSolid(hb) && hb !== DOOR) || fy < 1) {
      var sp = standNear(n.x, n.z, 6);
      if (sp) teleportTo(n, sp);
    }
  }
  n.doorT -= dt;
  if (n.doorT <= 0) { n.doorT = 0.2; tickDoors(n); }

  var r;
  switch (n.act) {
    case "idle":
      n.timer -= dt;
      if (n.timer <= 0) decide(n);
      break;
    case "wander":
    case "home":
      n.timer -= dt;
      r = walk(n, dt);
      if (r === 1) { n.homeTried = false; n.act = n.act === "home" ? "sleep" : "idle"; n.timer = n.act === "sleep" ? 1 : 1.5 + Math.random() * 3; }
      else if (r === -1) {
        if (n.act === "home" && n.houses.length) {
          // 길이 막혔다 — 먼저 문 앞으로 옮겨 걸어 들어가게 하고, 그래도 안 되면 집 안 바닥으로 옮긴다
          // (바닥은 위에서 훑으면 지붕이 나오니 높이를 집에서 읽는다)
          var hh = n.houses[0], hd = houseDoor(hh);
          if (!n.homeTried) {
            n.homeTried = true;
            teleportTo(n, [hd.fx, hh[2] + 1, hd.fz]);
            routeTo(n, hd.ix, hd.iz, 0);
          } else {
            n.homeTried = false;
            teleportTo(n, [hd.ix, hh[2] + 1, hd.iz]);
            n.act = "sleep"; n.timer = 1;
          }
        } else { n.act = "idle"; n.timer = 1; strandedCheck(n); }
      } else if (n.act === "wander" && n.timer < -8) { n.act = "idle"; n.timer = 1; }
      break;
    case "sleep":
      n.timer -= dt;
      if (n.timer <= 0) { n.timer = 1; if (!isNightNow(n)) decide(n); }
      break;
    case "toTree":
      n.timer -= dt;
      r = walk(n, dt);
      if (r === 1 || (n.tree && Math.hypot(n.tree.base[0] + 0.5 - n.x, n.tree.base[2] + 0.5 - n.z) < 2.4)) {
        n.act = "chop"; n.timer = CHOP_GAP; n.wps = []; n.fails = 0;
      } else if (r === -1 || n.timer <= 0) {
        if (n.tree) n.ban.push(n.tree.base[2] * WX + n.tree.base[0]);   // 못 닿는 나무는 잊는다
        n.tree = null; n.act = "idle"; n.timer = 0.5;
        strandedCheck(n);
      }
      break;
    case "chop":
      n.timer -= dt;
      var t = n.tree;
      if (t) n.yaw += angDiff(n.yaw, Math.atan2(-(t.base[0] + 0.5 - n.x), -(t.base[2] + 0.5 - n.z))) * Math.min(1, dt * 8);
      if (n.timer <= 0) {
        n.timer = CHOP_GAP;
        if (!t || n.chopI >= t.logs.length) {
          // 다 베었다 — 밑동에 묘목을 심는다(섬의 숲이 줄지 않게)
          if (t) {
            var bx = t.base[0], by = t.base[1], bz = t.base[2], below = world[idx(bx, by - 1, bz)];
            if (world[idx(bx, by, bz)] === AIR && (below === GRASS || below === DIRT)) {
              var lg = t.logKind === SPRUCE_LOG ? SAPLING_SPRUCE : (t.logKind === BIRCH_LOG ? SAPLING_BIRCH : SAPLING);
              applyEdit(bx, by, bz, lg, false);
            }
          }
          n.tree = null; n.act = "idle"; n.timer = 1;
          break;
        }
        var lgp = t.logs[n.chopI++];
        var cb = world[idx(lgp[0], lgp[1], lgp[2])];
        if (isLog(cb)) {
          if (!t.logKind) t.logKind = cb;
          applyEdit(lgp[0], lgp[1], lgp[2], AIR, false);
          n.wood += NPC_WOOD_PER_LOG;
          n.swing = 0.35;
          thock(n, lgp[0] + 0.5, lgp[1], lgp[2] + 0.5, true);
        }
      }
      break;
    case "build":
      var p = n.plan;
      if (!p) { n.act = "idle"; n.timer = 1; break; }
      if (p.i >= p.steps.length) { finishHouse(n); break; }
      var s = p.steps[p.i];
      // 건너뛸 칸(이미 있는 것·치울 게 없는 것)은 시간 없이 넘어간다
      var skipGuard = 0;
      while (p.i < p.steps.length && skipGuard++ < 60) {
        s = p.steps[p.i];
        if (s[6] > n.wood) break;
        if (!stepNeeded(s)) { p.i++; continue; }
        break;
      }
      if (p.i >= p.steps.length) { finishHouse(n); break; }
      if (s[6] > n.wood) { startGather(n); break; }                   // 재료가 떨어졌다
      var spot = buildSpot(p, s);
      // 팔이 닿는 데(4.6칸)에 있고 집터 밖이면 걷지 않고 바로 놓는다 — 한 칸마다 둘레를 도는 건 너무 느리다
      var bdx = s[0] + 0.5 - n.x, bdz = s[2] + 0.5 - n.z;
      var inFoot = Math.abs(n.x - (p.x + 0.5)) < 2.9 && Math.abs(n.z - (p.z + 0.5)) < 2.9;
      var reach = Math.hypot(bdx, bdz) <= 4.6 && !inFoot;
      var sd = reach ? 0 : Math.hypot(spot[0] - n.x, spot[1] - n.z);
      if (sd > 1.2) {
        if (!n.wps.length) routeTo(n, spot[0], spot[1], -1);
        n.buildWalk = (n.buildWalk || 0) + dt;
        r = walk(n, dt);
        if (r === -1 || n.buildWalk > 8) {                            // 못 간다 — 가까운 서 있을 자리로 옮겨 간다
          var tp = standNear(spot[0], spot[1], 4);
          if (tp) teleportTo(n, tp);
          n.buildWalk = 0;
        }
        break;
      }
      n.buildWalk = 0; n.wps = [];
      n.yaw += angDiff(n.yaw, Math.atan2(-(s[0] + 0.5 - n.x), -(s[2] + 0.5 - n.z))) * Math.min(1, dt * 10);
      n.timer -= dt;
      if (n.timer > 0) break;
      var res = doStep(s);
      if (res === 2) { n.timer = 0.5; break; }                        // 사람이 서 있다 — 잠깐 기다린다
      if (res === 1) {
        n.wood -= s[6];
        n.swing = 0.3;
        thock(n, s[0] + 0.5, s[1], s[2] + 0.5, false);
        n.timer = s[5] === 0 ? BUILD_GAP : DIG_GAP;
      }
      p.i++;
      break;
    default:
      n.act = "idle"; n.timer = 1;
  }

  animate(n, dt);
}
// 이 단계가 할 일이 있는가 — 없으면 시간 없이 지나간다
function stepNeeded(s) {
  var x = s[0], y = s[1], z = s[2], mode = s[5];
  if (y < 1 || y >= WY) return false;
  var cur = world[idx(x, y, z)];
  if (mode === 1) return !(cur === AIR || isUnbreakable(cur) || isTouched(x, y, z) || cur === WATER || cur === LAVA);
  if (mode === 2) return !(isSolid(cur) || cur === WATER || cur === LAVA || isTouched(x, y, z));
  if (cur === s[3] && shapeAt(x, y, z) === s[4]) return false;
  if (cur !== AIR && isTouched(x, y, z)) return false;
  if (cur === WATER || cur === LAVA) return false;
  return true;
}

function animate(n, dt) {
  var moving = n.walkNow;
  n.phase += dt * (moving ? 8 : 1.2);
  var sw = moving ? Math.sin(n.phase) * 0.7 : 0;
  n.legs[0].rotation.x = sw; n.legs[1].rotation.x = -sw;
  n.arms[0].rotation.x = -sw * 0.8;
  if (n.swing > 0) n.arms[1].rotation.x = -1.2 + Math.sin(n.phase * 4 + n.swing * 20) * 0.9;   // 도끼질·망치질
  else n.arms[1].rotation.x = sw * 0.8;
  n.g.position.set(n.x, n.y + (moving ? Math.abs(Math.sin(n.phase)) * 0.04 : Math.sin(n.phase) * 0.01), n.z);
  n.g.rotation.y = n.yaw;
  tint(n);
}

// 지도에 찍을 자리 — 없으면 null
export function npcMapPos() { return npc ? [npc.x, npc.z] : null; }
