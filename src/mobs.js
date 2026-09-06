// mobs.js — 걸어 다니는 동물. 세계에 "살아 있는 것" 을 하나 넣는다.
import { SEA, WX, WY, WZ, idx } from "./dims.js";
import { shapeAt, topMap, world } from "./world.js";
import { WOOL0, DOOR, doorOpen, FENCE, GATE, AIR, ICE, LAVA, WATER, isSolid } from "./blocks.js";
import { burst, scene } from "./scene.js";
import { player } from "./player.js";
import { at, crunch, tone } from "./audio.js";

// 하트 파티클 — 분홍 양털의 색을 빌려 쓴다 (새 텍스처를 만들지 않는다)
export var LOVE_HINT = WOOL0 + 6;
export var MOB_COUNT = 14;      // 처음 뿌리는 수
export var MOB_MAX = 24;        // 번식으로 늘어날 수 있는 상한
export var FISH_COUNT = 18;
export var BIRD_COUNT = 10;

// 종류 — 몸 색 · 머리 색 · 크기 · 우는 소리 높이
export var MOB_KINDS = [
  { name: "양",   body: 0xe6e4dc, head: 0xd9c6ae, w: 0.62, h: 0.56, cry: 520 },
  { name: "돼지", body: 0xd98a92, head: 0xe0a0a6, w: 0.58, h: 0.50, cry: 300 },
  { name: "소",   body: 0x40352b, head: 0xe8e4dc, w: 0.70, h: 0.62, cry: 190 }
];

export var mobs = [];
export var mobGroup = new THREE.Group();
scene.add(mobGroup);

// 동물이 딛는 땅. 지붕 아래에서 얼어붙는 문제(자문 2차 3번)를 고치려고
// "지금 높이 언저리를 훑는" 방식을 넣어 봤으나, 얕은 물의 바닥돌을 땅으로 보고
// 동물이 물 위를 걸어 들어가는 회귀가 10회 반복에서 2~4회 나왔다. 되돌렸다.
// 다시 손댈 때는 `물 회피`와 `지붕 아래 보행`을 한 판정으로 묶어야 한다.
function groundAt(x, z) {
  var gx = Math.max(0, Math.min(WX - 1, Math.floor(x)));
  var gz = Math.max(0, Math.min(WZ - 1, Math.floor(z)));
  return topMap[gz * WX + gx] + 1;
}

function makeMob(kind) {
  var k = MOB_KINDS[kind];
  var g = new THREE.Group();
  var body = new THREE.Mesh(
    new THREE.BoxGeometry(k.w, k.h, k.w * 1.5),
    new THREE.MeshBasicMaterial({ color: k.body }));
  body.position.y = k.h * 0.5 + 0.28;
  g.add(body);
  var head = new THREE.Mesh(
    new THREE.BoxGeometry(k.w * 0.62, k.h * 0.62, k.w * 0.62),
    new THREE.MeshBasicMaterial({ color: k.head }));
  head.position.set(0, k.h * 0.72 + 0.28, -k.w * 0.86);
  g.add(head);
  // 발밑 그림자 — 땅에 붙어 있다는 느낌을 만든다
  var shadow = new THREE.Mesh(
    new THREE.CircleGeometry(k.w * 0.85, 10),
    new THREE.MeshBasicMaterial({ color: 0x000000, transparent: true,
                                  opacity: 0.22, depthWrite: false, fog: false }));
  shadow.rotation.x = -Math.PI / 2;
  shadow.position.y = 0.02;
  g.add(shadow);

  var legMat = new THREE.MeshBasicMaterial({ color: 0x4a4038 });
  var legs = [];
  for (var i = 0; i < 4; i++) {
    var leg = new THREE.Mesh(new THREE.BoxGeometry(0.13, 0.30, 0.13), legMat);
    leg.position.set((i % 2 ? 1 : -1) * k.w * 0.30, 0.15,
                     (i < 2 ? -1 : 1) * k.w * 0.46);
    g.add(leg);
    legs.push(leg);
  }
  mobGroup.add(g);
  return { g: g, legs: legs, kind: kind, x: 0, y: 0, z: 0, yaw: 0,
           turn: 0, walk: 0, phase: Math.random() * 6, cry: 3 + Math.random() * 12,
           follow: 0, love: 0, baby: 0 };
}

// ── 저장 · 복원 — 동물이 저장에 없어서, 목장을 만들어도 탭을 닫으면 빈 우리가 됐다.
// 좌표는 0.25칸 단위로 반올림해 담는다 (24마리 × 6수 ≈ 200바이트)
export function dumpMobs() {
  var out = [];
  for (var i = 0; i < mobs.length; i++) {
    var m = mobs[i];
    out.push([Math.round(m.x * 4), Math.round(m.y * 4), Math.round(m.z * 4),
              m.kind, Math.round(m.yaw * 100), Math.round(m.baby || 0)]);
  }
  return out;
}
export function loadMobs(arr) {
  if (!Array.isArray(arr) || !arr.length) return false;
  while (mobs.length) { mobGroup.remove(mobs.pop().g); }
  for (var i = 0; i < arr.length && mobs.length < MOB_MAX; i++) {
    var a = arr[i];
    if (!a || a.length < 4) continue;
    var kind = a[3] | 0;
    if (kind < 0 || kind >= MOB_KINDS.length) kind = 0;
    var m = makeMob(kind);
    m.x = a[0] / 4; m.y = a[1] / 4; m.z = a[2] / 4;
    m.yaw = (a[4] || 0) / 100;
    m.baby = a[5] || 0;
    mobs.push(m);
  }
  return mobs.length > 0;
}

export function seedMobs() {
  while (mobs.length < MOB_COUNT) mobs.push(makeMob((Math.random() * MOB_KINDS.length) | 0));
  for (var i = 0; i < mobs.length; i++) placeMob(mobs[i], true);
}

function placeMob(m, far) {
  // 플레이어 주변, 물이 아닌 마른 땅에 놓는다
  for (var t = 0; t < 24; t++) {
    var a = Math.random() * Math.PI * 2;
    var d = far ? 8 + Math.random() * 22 : 18 + Math.random() * 12;
    var x = player.pos.x + Math.cos(a) * d;
    var z = player.pos.z + Math.sin(a) * d;
    if (x < 2 || x > WX - 2 || z < 2 || z > WZ - 2) continue;
    var y = groundAt(x, z);
    if (y < 2 || y >= WY - 2) continue;
    var gx = Math.floor(x), gz = Math.floor(z);
    var below = world[idx(gx, y - 1, gz)];
    if (!isSolid(below)) continue;
    if (below === WATER || below === LAVA || below === ICE) continue;   // 물·용암은 피한다
    if (world[idx(gx, y, gz)] !== AIR || world[idx(gx, y + 1, gz)] !== AIR) continue;
    // 기둥의 겉면이 젖어 있으면 그 기둥은 바다다 — topMap 이 아직 물을 못 받은 순간에
    // 바다 밑 모래를 "마른 땅" 으로 보고 양을 해저에 놓는 일이 있었다 (v30 진단)
    var surf = world[idx(gx, topMap[gz * WX + gx], gz)];
    if (surf === WATER || surf === LAVA || surf === ICE) continue;
    var sea = SEA;
    if (y <= sea) {                          // 해수면 아래면 위로 하늘까지 물이 없어야 한다
      var wetAbove = false;
      for (var wy2 = y; wy2 <= sea + 1 && !wetAbove; wy2++)
        if (world[idx(gx, wy2, gz)] === WATER) wetAbove = true;
      if (wetAbove) continue;
    }
    m.x = x; m.y = y; m.z = z;
    m.yaw = Math.random() * Math.PI * 2;
    m.turn = 1 + Math.random() * 3;
    m.follow = 0;
    m.walk = Math.random() < 0.6 ? 1 : 0;
    return true;
  }
  return false;
}

// 울타리·문에 둘러싸여 있는가 — 부딪힌 기억(pennedAt)만 믿으면
// 한 번도 안 부딪힌 동물을 첫 프레임에 데려가 버린다
function nearPen(m) {
  var gx = Math.floor(m.x), gy = Math.max(0, Math.floor(m.y)), gz = Math.floor(m.z);
  for (var dx = -4; dx <= 4; dx++)
    for (var dz = -4; dz <= 4; dz++) {
      var x = gx + dx, z = gz + dz;
      if (x < 0 || x >= WX || z < 0 || z >= WZ) continue;
      var b = world[idx(x, gy, z)];
      if (b === FENCE || b === GATE || b === DOOR) return true;
    }
  return false;
}

// 우리 안에서 마른 자리를 찾아 한 칸 밀어 준다 (못 찾으면 false)
function nudgeToDry(m) {
  var gy = Math.max(1, Math.floor(m.y));
  for (var r = 1; r <= 4; r++)
    for (var dx = -r; dx <= r; dx++)
      for (var dz = -r; dz <= r; dz++) {
        if (Math.max(Math.abs(dx), Math.abs(dz)) !== r) continue;
        var nx = Math.floor(m.x) + dx, nz = Math.floor(m.z) + dz;
        if (nx < 1 || nx >= WX - 1 || nz < 1 || nz >= WZ - 1) continue;
        var below = world[idx(nx, gy - 1, nz)];
        if (!isSolid(below) || below === ICE) continue;
        if (world[idx(nx, gy, nz)] !== AIR) continue;
        if (gy + 1 < WY && world[idx(nx, gy + 1, nz)] !== AIR) continue;
        m.x = nx + 0.5; m.z = nz + 0.5; m.y = gy;
        return true;
      }
  return false;
}

// 플레이어 주변에 동물이 한 마리라도 있는가
export function anyMobNear(px, pz, r) {
  var r2 = r * r;
  for (var i = 0; i < mobs.length; i++) {
    var dx = mobs[i].x - px, dz = mobs[i].z - pz;
    if (dx * dx + dz * dz <= r2) return true;
  }
  return false;
}

// 서 있는 기둥이 물·용암·얼음이거나 기둥 겉면보다 아래(물속 공기 주머니·해저)에 있으면
// 그 자리는 동물이 있을 곳이 아니다 — 놓인 뒤에 물이 차거나 topMap 이 늦게 갱신된 경우다
function strandedAt(m) {
  var gx = Math.floor(m.x), gz = Math.floor(m.z);
  if (gx < 0 || gx >= WX || gz < 0 || gz >= WZ) return true;
  var top = topMap[gz * WX + gx];
  var tb = world[idx(gx, top, gz)];
  // 기둥 겉면이 물·용암·얼음이고 그 아래에 있다 = 물속(해저 공기 주머니 포함)
  if ((tb === WATER || tb === LAVA || tb === ICE) && m.y < top + 1) return true;
  // 발밑 한 칸이 물인 것은 좌초가 아니다 — 마크의 소는 발목 물에 서 있고,
  // 우리 안 물구유 하나로 동물이 20칸 밖으로 날아가면 목장을 지을 수가 없다.
  // 몸이 잠겼거나 발밑이 용암·얼음일 때만 좌초로 본다.
  var fy = Math.max(0, Math.floor(m.y) - 1), by = Math.min(WY - 1, Math.floor(m.y));
  var fb = world[idx(gx, fy, gz)], bb = world[idx(gx, by, gz)];
  if (fb === LAVA || fb === ICE) return true;
  if (bb === WATER || bb === LAVA) return true;
  // 단단한 지붕 아래는 갇힌 게 아니다 — 여기서 true 를 돌리면 헛간의 양이 0.5초마다 밖으로 튄다
  return false;
}

export function updateMobs(dt) {
  if (!mobs.length) return;
  var px = player.pos.x, pz = player.pos.z;
  for (var i = 0; i < mobs.length; i++) {
    var m = mobs[i], k = MOB_KINDS[m.kind];

    // 물속·해저·얼음 위에 서 있으면 마른 땅으로 다시 놓는다 (0.5초마다 한 번만 본다)
    m.dryCheck = (m.dryCheck || 0) - dt;
    if (m.dryCheck <= 0) {
      m.dryCheck = 0.5;
      // 가까운 자리(18~30칸)를 못 찾으면 더 넓게(8~30칸) 한 번 더 — 물가에선 24번이 다 물에 떨어질 수 있다
      if (strandedAt(m)) {
        // 가둬 둔 동물은 멀리 보내지 않는다 — 주변 4칸의 마른 자리로 한 칸만 밀어 준다.
        // v42 가 "데려가기" 에만 울타리 예외를 넣고 좌초 재배치에는 안 넣었다.
        if (nearPen(m) || m.pennedAt > 0) { if (nudgeToDry(m)) continue; }
        if (!placeMob(m, false)) placeMob(m, true);
        continue;
      }
    }

    // 먹이를 받은 동물은 플레이어 쪽을 본다
    if (m.follow > 0) {
      m.follow -= dt;
      var fdx = player.pos.x - m.x, fdz = player.pos.z - m.z;
      var fd = Math.hypot(fdx, fdz);
      if (fd > 2.2) {
        m.yaw = Math.atan2(-fdx, -fdz);
        m.walk = 1;
        m.turn = 0.4;
      } else { m.walk = 0; m.turn = 0.6; }
    }

    m.turn -= dt;
    if (m.turn <= 0) {
      m.turn = 1.5 + Math.random() * 4;
      m.walk = Math.random() < 0.62 ? 1 : 0;
      m.yaw += (Math.random() - 0.5) * 2.4;
    }

    if (m.walk) {
      var sp = 1.15 * dt;
      var nx = m.x - Math.sin(m.yaw) * sp, nz = m.z - Math.cos(m.yaw) * sp;
      // 딛을 자리를 지금 높이 언저리에서 찾는다 — topMap(기둥 최고점) 을 쓰면 지붕·나뭇잎이
      // "땅" 이 되어 헛간 안에서 얼어붙는다. 단, 딛는 돌 위의 몸 칸이 물·용암·얼음이거나
      // 딛는 것이 얼음이면 땅이 아니다 — 지난번엔 이 조건이 없어 얕은 물의 바닥돌을 땅으로 봤다.
      var cx = Math.floor(nx), cz = Math.floor(nz), ny = -1;
      for (var sy = Math.floor(m.y) + 1; sy >= Math.floor(m.y) - 2; sy--) {
        if (sy < 1 || sy + 1 >= WY) continue;
        var gb = world[idx(cx, sy, cz)], ab = world[idx(cx, sy + 1, cz)];
        if (!isSolid(gb) || gb === ICE) continue;
        if (isSolid(ab) || ab === WATER || ab === LAVA || ab === ICE) continue;
        ny = sy + 1; break;
      }
      if (ny < 0) { m.yaw += 1.6 + Math.random(); m.phase += dt * 7; continue; }
      // 한 칸 넘게 오르내리는 곳은 가지 않는다 — 절벽에서 떨어지지 않게
      var footB = world[idx(Math.floor(nx), Math.max(0, ny - 1), Math.floor(nz))];
      // 발밑 한 칸만 보면 얕은 물을 못 알아본다 — 바닥이 두 칸 아래 돌이면
      // footB 가 돌이라 물 위를 걸어 들어갔다. 서 있던 높이까지 기둥을 훑는다.
      var wet = false;
      var wTop = Math.max(ny, Math.floor(m.y));
      for (var wy = Math.max(0, ny - 1); wy <= wTop && !wet; wy++) {
        if (wy >= WY) break;
        var wb = world[idx(Math.floor(nx), wy, Math.floor(nz))];
        if (wb === WATER || wb === LAVA || wb === ICE) wet = true;
      }
      // 울타리·문은 못 넘는다 — 이게 없으면 울타리를 아무리 높여도 목장이 성립하지 않는다
      var headB = world[idx(Math.floor(nx), Math.max(0, Math.round(m.y)), Math.floor(nz))];
      // 열린 문(shape 1)은 지나갈 수 있다 — 문을 여는 이유가 정확히 이것이다
      function blocks(b, cx, cy, cz) {
        if (b === FENCE) return true;
        if (b === DOOR) return !doorOpen(shapeAt(cx, cy, cz));   // 닫힌 문도 동물을 막는다
        if (b !== GATE) return false;
        return shapeAt(cx, cy, cz) !== 1;
      }
      var fy = Math.max(0, ny - 1), hy = Math.max(0, Math.round(m.y));
      var penned = blocks(footB, Math.floor(nx), fy, Math.floor(nz)) ||
                   blocks(headB, Math.floor(nx), hy, Math.floor(nz));
      // 울타리에 부딪힌 기억을 12초 들고 다닌다 — 가둔 동물을 게임이 몰래 데려가지 않게
      if (penned) m.pennedAt = 12;
      if (!wet && !penned && nx > 1 && nx < WX - 1 && nz > 1 && nz < WZ - 1 && Math.abs(ny - m.y) <= 1) {
        m.x = nx; m.z = nz; m.y += (ny - m.y) * Math.min(1, dt * 8);
      } else {
        m.yaw += 1.6 + Math.random();
      }
      m.phase += dt * 7;
    } else {
      m.phase += dt * 0.6;
    }

    // 멀어졌다고 끌어오지 않는다 — 가둬 둔 무리가 따라오면 목장이 성립하지 않는다.
    // 다만 주변이 완전히 비었을 때만 한 마리씩 데려온다 (허허벌판 방지)
    var dx = m.x - px, dz = m.z - pz;
    m.pennedAt = Math.max(0, (m.pennedAt || 0) - dt);
    if (dx * dx + dz * dz > 46 * 46 && !anyMobNear(px, pz, 40) &&
        m.pennedAt <= 0 && !nearPen(m)) {
      placeMob(m, false); continue;
    }

    m.cry -= dt;
    if (m.cry <= 0) {
      m.cry = 9 + Math.random() * 22;
      var near = Math.max(0, 1 - Math.sqrt(dx * dx + dz * dz) / 24);
      if (near > 0.05) {
        // 동물 자리에서 난다 — 어느 쪽에 양이 있는지 귀로 안다
        var pn = at(m.x, m.y + 0.6, m.z);
        tone(k.cry * (0.9 + Math.random() * 0.2), 0.22, "triangle", 0.045 * near, pn);
        crunch(0.10, 0.03 * near, 900, pn);
      }
    }

    m.g.position.set(m.x, m.y, m.z);
    m.g.rotation.y = m.yaw;
    // 새끼는 60초 동안 작다 — 자라는 게 눈에 보여야 번식이 사건이 된다
    if (m.baby > 0) {
      m.baby -= dt;
      var grow = 0.5 + 0.5 * (1 - Math.max(0, m.baby) / 60);
      m.g.scale.setScalar(grow);
    } else if (m.g.scale.x !== 1) m.g.scale.setScalar(1);
    var sw = m.walk ? Math.sin(m.phase) * 0.5 : 0;
    for (var l = 0; l < 4; l++) {
      m.legs[l].rotation.x = (l === 0 || l === 3) ? sw : -sw;
      m.legs[l].position.y = 0.15 - Math.abs(sw) * 0.02;
    }
    m.g.position.y += m.walk ? Math.abs(Math.sin(m.phase)) * 0.03 : 0;
  }
}

// 플레이어가 동물을 뚫고 지나가지 못하게 부드럽게 밀어낸다
export function pushOutOfMobs(px, pz, half) {
  var dx = 0, dz = 0;
  for (var i = 0; i < mobs.length; i++) {
    var m = mobs[i], k = MOB_KINDS[m.kind];
    var r = k.w * 0.75 + half;
    var ax = px - m.x, az = pz - m.z;
    var d2 = ax * ax + az * az;
    if (d2 > r * r || d2 < 1e-6) continue;
    var d = Math.sqrt(d2);
    var push = (r - d) / d;
    dx += ax * push; dz += az * push;
    // 동물도 밀린다
    m.x -= ax * push * 0.45; m.z -= az * push * 0.45;
  }
  return [dx, dz];
}

// 조준선이 동물을 향하고 있는가 — 아니면 우클릭은 그냥 블록 놓기다
export function aimingAtMob() {
  var eye = player.pos.y + 1.62;
  var fx = -Math.sin(player.yaw) * Math.cos(player.pitch);
  var fy = -Math.sin(player.pitch);
  var fz = -Math.cos(player.yaw) * Math.cos(player.pitch);
  for (var t = 0.6; t <= 4.2; t += 0.3) {
    var px = player.pos.x + fx * t, py = eye + fy * t, pz = player.pos.z + fz * t;
    for (var i = 0; i < mobs.length; i++) {
      var m = mobs[i], k = MOB_KINDS[m.kind];
      if (Math.abs(px - m.x) > k.w && Math.abs(pz - m.z) > k.w) continue;
      if (Math.abs(px - m.x) > k.w || Math.abs(pz - m.z) > k.w) continue;
      if (py < m.y - 0.1 || py > m.y + k.h + 0.5) continue;
      return true;
    }
  }
  return false;
}

// 먹이를 주면 잠깐 따라온다
export function feedNearbyMob(pos) {
  // 상한에 걸리면 하트도 소리도 내지 않는다 — 안 그러면 "짝이 안 맞았나" 하며 꽃만 계속 준다.
  // -1 을 돌려 부른 쪽(mine.js)이 안내하게 한다 (v46 에서 unlock 을 부른 쪽에 맡긴 것과 같다)
  if (mobs.length >= MOB_MAX) return -1;
  var best = -1, bestD = 25;
  for (var i = 0; i < mobs.length; i++) {
    var m = mobs[i];
    if (m.follow > 0) continue;                       // 이미 따라오는 동물은 건너뛴다
    var dx = m.x - pos.x, dy = m.y - pos.y, dz = m.z - pos.z;
    if (Math.abs(dy) > 3) continue;                    // 위아래 층은 세지 않는다
    var d = dx * dx + dz * dz;
    if (d < bestD) { bestD = d; best = i; }
  }
  if (best < 0) return false;
  var mm = mobs[best], k = MOB_KINDS[mm.kind];
  mm.follow = 22 + Math.random() * 14;
  mm.love = 20;                        // 20초 안에 같은 처지의 짝을 만나면 새끼가 난다
  burst(mm.x, mm.y + 0.8, mm.z, LOVE_HINT, 5);
  tone(k.cry * 1.35, 0.16, "triangle", 0.06, at(mm.x, mm.y + 0.6, mm.z));
  return true;
}

// 꽃을 받은 두 마리가 가까이 있으면 새끼가 난다 — 우리를 채울 유일한 방법이다.
// 목장을 지어 놓고 채울 방법이 없으면 목장을 지을 이유도 없다.
export function breedTick(dt) {
  var born = 0;
  for (var i = 0; i < mobs.length; i++) {
    var a = mobs[i];
    if (!(a.love > 0)) continue;
    a.love -= dt;
    if (a.baby > 0) { a.love = 0; continue; }          // 새끼는 번식하지 않는다
    if (mobs.length >= MOB_MAX) continue;
    for (var j = i + 1; j < mobs.length; j++) {
      var b2 = mobs[j];
      if (!(b2.love > 0) || b2.baby > 0) continue;
      if (b2.kind !== a.kind) continue;                // 같은 종끼리만
      var dx = a.x - b2.x, dy = a.y - b2.y, dz = a.z - b2.z;
      if (Math.abs(dy) > 2 || dx * dx + dz * dz > 9) continue;   // 3칸 안
      a.love = 0; b2.love = 0;
      var kid = makeMob(a.kind);
      kid.x = (a.x + b2.x) / 2; kid.y = a.y; kid.z = (a.z + b2.z) / 2;
      kid.yaw = a.yaw; kid.baby = 60;                  // 60초 동안 작다
      mobs.push(kid);
      burst(kid.x, kid.y + 0.6, kid.z, LOVE_HINT, 8);
      tone(MOB_KINDS[a.kind].cry * 1.7, 0.18, "triangle", 0.05, at(kid.x, kid.y + 0.5, kid.z));
      born++;       // 과제는 부른 쪽(loop)이 판단한다 — mobs 가 도전 과제를 알 이유가 없다
      break;
    }
  }
  return born;
}

export function setMobsVisible(on) { mobGroup.visible = on; }

// ══════════════════════════════════════════════════════════════
//  물고기와 새 — 점으로 그려 값싸게 생명감을 더한다
// ══════════════════════════════════════════════════════════════
function makePoints(count, size, color, opacity) {
  var pos = new Float32Array(count * 3);
  var geo = new THREE.BufferGeometry();
  geo.setAttribute("position", new THREE.BufferAttribute(pos, 3));
  var pts = new THREE.Points(geo, new THREE.PointsMaterial({
    color: color, size: size, sizeAttenuation: true,
    transparent: true, opacity: opacity, depthWrite: false, fog: true
  }));
  scene.add(pts);
  return { pos: pos, geo: geo, pts: pts };
}

export var fish = makePoints(FISH_COUNT, 0.22, 0xa8d8e8, 0.9);
export var birds = makePoints(BIRD_COUNT, 0.26, 0x2b2f33, 0.85);
var fishState = [], birdState = [];

export function seedFlocks() {
  fishState.length = 0; birdState.length = 0;
  for (var i = 0; i < FISH_COUNT; i++) fishState.push({ x: 0, y: -900, z: 0, a: Math.random() * 6.3, t: 0 });
  for (var j = 0; j < BIRD_COUNT; j++) birdState.push({ x: 0, y: -900, z: 0, a: Math.random() * 6.3, t: 0 });
}

function findWater(near) {
  for (var t = 0; t < 90; t++) {
    var x = Math.floor(player.pos.x + (Math.random() - 0.5) * near);
    var z = Math.floor(player.pos.z + (Math.random() - 0.5) * near);
    if (x < 1 || x >= WX - 1 || z < 1 || z >= WZ - 1) continue;
    for (var y = SEA; y >= 2; y--)
      if (world[idx(x, y, z)] === WATER) return [x + 0.5, y + 0.5, z + 0.5];
  }
  return null;
}

export function updateFlocks(dt) {
  var i, s2;
  for (i = 0; i < fishState.length; i++) {
    s2 = fishState[i];
    s2.t -= dt;
    var dxf = s2.x - player.pos.x, dzf = s2.z - player.pos.z;
    if (s2.t <= 0 || dxf * dxf + dzf * dzf > 34 * 34) {
      var spot = findWater(56);
      s2.t = 6 + Math.random() * 10;
      if (!spot) { s2.y = -900; }
      else { s2.x = spot[0]; s2.y = spot[1]; s2.z = spot[2]; s2.a = Math.random() * 6.3; }
    } else {
      s2.a += (Math.random() - 0.5) * dt * 3;
      var nx = s2.x - Math.sin(s2.a) * dt * 1.4, nz = s2.z - Math.cos(s2.a) * dt * 1.4;
      if (world[idx(Math.floor(nx), Math.floor(s2.y), Math.floor(nz))] === WATER) { s2.x = nx; s2.z = nz; }
      else s2.a += 2.2;
    }
    fish.pos[i * 3] = s2.x; fish.pos[i * 3 + 1] = s2.y; fish.pos[i * 3 + 2] = s2.z;
  }
  fish.geo.attributes.position.needsUpdate = true;

  for (i = 0; i < birdState.length; i++) {
    s2 = birdState[i];
    s2.t -= dt;
    var dxb = s2.x - player.pos.x, dzb = s2.z - player.pos.z;
    if (s2.t <= 0 || dxb * dxb + dzb * dzb > 60 * 60) {
      s2.t = 14 + Math.random() * 16;
      s2.x = player.pos.x + (Math.random() - 0.5) * 60;
      s2.z = player.pos.z + (Math.random() - 0.5) * 60;
      s2.y = 34 + Math.random() * 16;
      s2.a = Math.random() * 6.3;
    } else {
      s2.a += (Math.random() - 0.5) * dt * 1.2;
      s2.x -= Math.sin(s2.a) * dt * 4.2;
      s2.z -= Math.cos(s2.a) * dt * 4.2;
      s2.y += Math.sin(s2.t * 1.7) * dt * 1.2;
    }
    birds.pos[i * 3] = s2.x; birds.pos[i * 3 + 1] = s2.y; birds.pos[i * 3 + 2] = s2.z;
  }
  birds.geo.attributes.position.needsUpdate = true;
}
