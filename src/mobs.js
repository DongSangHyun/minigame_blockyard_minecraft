// mobs.js — 걸어 다니는 동물. 세계에 "살아 있는 것" 을 하나 넣는다.
import { WX, WZ, WY, idx } from "./dims.js";
import { topMap, world } from "./world.js";
import { isSolid, AIR } from "./blocks.js";
import { scene } from "./scene.js";
import { player } from "./player.js";
import { crunch, tone } from "./audio.js";

export var MOB_COUNT = 14;

// 종류 — 몸 색 · 머리 색 · 크기 · 우는 소리 높이
export var MOB_KINDS = [
  { name: "양",   body: 0xe6e4dc, head: 0xd9c6ae, w: 0.62, h: 0.56, cry: 520 },
  { name: "돼지", body: 0xd98a92, head: 0xe0a0a6, w: 0.58, h: 0.50, cry: 300 },
  { name: "소",   body: 0x40352b, head: 0xe8e4dc, w: 0.70, h: 0.62, cry: 190 }
];

export var mobs = [];
export var mobGroup = new THREE.Group();
scene.add(mobGroup);

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
           turn: 0, walk: 0, phase: Math.random() * 6, cry: 3 + Math.random() * 12 };
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
    if (!isSolid(world[idx(Math.floor(x), y - 1, Math.floor(z))])) continue;
    if (world[idx(Math.floor(x), y, Math.floor(z))] !== AIR) continue;
    m.x = x; m.y = y; m.z = z;
    m.yaw = Math.random() * Math.PI * 2;
    m.turn = 1 + Math.random() * 3;
    m.walk = Math.random() < 0.6 ? 1 : 0;
    return true;
  }
  return false;
}

export function updateMobs(dt) {
  if (!mobs.length) return;
  var px = player.pos.x, pz = player.pos.z;
  for (var i = 0; i < mobs.length; i++) {
    var m = mobs[i], k = MOB_KINDS[m.kind];

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
      if (nx > 1 && nx < WX - 1 && nz > 1 && nz < WZ - 1 && Math.abs(ny - m.y) <= 1) {
        m.x = nx; m.z = nz; m.y += (ny - m.y) * Math.min(1, dt * 8);
      } else {
        m.yaw += 1.6 + Math.random();
      }
      m.phase += dt * 7;
    } else {
      m.phase += dt * 0.6;
    }

    // 너무 멀어지면 플레이어 주변으로 다시 데려온다
    var dx = m.x - px, dz = m.z - pz;
    if (dx * dx + dz * dz > 46 * 46) { placeMob(m, false); continue; }

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

export function setMobsVisible(on) { mobGroup.visible = on; }
