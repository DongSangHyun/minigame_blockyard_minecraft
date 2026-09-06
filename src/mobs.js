// mobs.js — 걸어 다니는 동물. 세계에 "살아 있는 것" 을 하나 넣는다.
import { SEA, WX, WY, WZ, idx } from "./dims.js";
import { shapeAt, topMap, world } from "./world.js";
import { FENCE, GATE, AIR, ICE, LAVA, WATER, isSolid } from "./blocks.js";
import { scene } from "./scene.js";
import { player } from "./player.js";
import { crunch, tone } from "./audio.js";

export var MOB_COUNT = 14;
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
           turn: 0, walk: 0, phase: Math.random() * 6, cry: 3 + Math.random() * 12, follow: 0 };
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
    var below = world[idx(Math.floor(x), y - 1, Math.floor(z))];
    if (!isSolid(below)) continue;
    if (below === WATER || below === LAVA || below === ICE) continue;   // 물·용암은 피한다
    if (world[idx(Math.floor(x), y, Math.floor(z))] !== AIR) continue;
    m.x = x; m.y = y; m.z = z;
    m.yaw = Math.random() * Math.PI * 2;
    m.turn = 1 + Math.random() * 3;
    m.follow = 0;
    m.walk = Math.random() < 0.6 ? 1 : 0;
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

export function updateMobs(dt) {
  if (!mobs.length) return;
  var px = player.pos.x, pz = player.pos.z;
  for (var i = 0; i < mobs.length; i++) {
    var m = mobs[i], k = MOB_KINDS[m.kind];

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
      var ny = groundAt(nx, nz);
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
        if (b !== GATE) return false;
        return shapeAt(cx, cy, cz) !== 1;
      }
      var fy = Math.max(0, ny - 1), hy = Math.max(0, Math.round(m.y));
      var penned = blocks(footB, Math.floor(nx), fy, Math.floor(nz)) ||
                   blocks(headB, Math.floor(nx), hy, Math.floor(nz));
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
    if (dx * dx + dz * dz > 46 * 46 && !anyMobNear(px, pz, 40)) { placeMob(m, false); continue; }

    m.cry -= dt;
    if (m.cry <= 0) {
      m.cry = 9 + Math.random() * 22;
      var near = Math.max(0, 1 - Math.sqrt(dx * dx + dz * dz) / 24);
      if (near > 0.05) {
        tone(k.cry * (0.9 + Math.random() * 0.2), 0.22, "triangle", 0.045 * near);
        crunch(0.10, 0.03 * near, 900);
      }
    }

    m.g.position.set(m.x, m.y, m.z);
    m.g.rotation.y = m.yaw;
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
  tone(k.cry * 1.35, 0.16, "triangle", 0.06);
  return true;
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
