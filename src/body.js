// body.js — 3인칭에서 보이는 플레이어 몸
import { S } from "./state.js";
import { calmMotion } from "./settings.js";
import { scene } from "./scene.js";
import { player } from "./player.js";
import { atlasTex } from "./atlas.js";
import { makeBlockGeometry } from "./hand.js";
import { AIR, SH_FULL } from "./blocks.js";

// 마크 스티브의 비율을 이 게임의 키 1.78 에 맞춰 줄인 값이다.
// 다리 0.68 + 몸통 0.66 + 머리 0.44 = 1.78 — 눈높이 EYE(1.62)가 머리 안에 든다.
export var LEG_H = 0.68, TORSO_H = 0.66, HEAD_S = 0.44, ARM_H = 0.44, HAND_H = 0.18;
var SKIN = 0xbf8f6a, SHIRT = 0x00a3a3, PANTS = 0x3d4ba8, SHOE = 0x30303c, HAIR = 0x33241a;

// 밝기를 받는 파트들 — 발밑 그림자만 빼고 전부 (v95)
export var litParts = [];
// hangTop 이면 피벗을 위쪽 끝(어깨·엉덩이)으로 옮긴다 — 거기서 흔들려야 팔다리로 보인다
function part(w, h, d, color, hangTop) {
  var g = new THREE.BoxGeometry(w, h, d);
  if (hangTop) g.translate(0, -h / 2, 0);
  var m = new THREE.Mesh(g, new THREE.MeshBasicMaterial({ color: color }));
  m.userData.base = new THREE.Color(color);
  litParts.push(m);
  return m;
}

export var bodyRoot = new THREE.Group();
bodyRoot.visible = false;
scene.add(bodyRoot);

// 발밑 그림자 — 동물과 같은 틀이다. 땅에 붙어 있다는 느낌을 만든다
var shadow = new THREE.Mesh(
  new THREE.CircleGeometry(0.34, 12),
  new THREE.MeshBasicMaterial({ color: 0x000000, transparent: true,
                                opacity: 0.22, depthWrite: false, fog: false }));
shadow.rotation.x = -Math.PI / 2;
shadow.position.y = 0.02;
bodyRoot.add(shadow);

function makeLeg(sx) {
  var g = new THREE.Group();
  g.position.set(sx * 0.115, LEG_H, 0);
  g.add(part(0.22, 0.56, 0.22, PANTS, true));
  var shoe = part(0.23, 0.12, 0.24, SHOE);
  shoe.position.y = -0.62;
  g.add(shoe);
  bodyRoot.add(g);
  return g;
}
export var legL = makeLeg(-1), legR = makeLeg(1);

// 허리 위는 통째로 한 그룹이다 — 웅크릴 때 상체만 숙이면 팔·머리가 같이 따라간다
export var upper = new THREE.Group();
upper.position.y = LEG_H;
bodyRoot.add(upper);

var torso = part(0.46, TORSO_H, 0.25, SHIRT);
torso.position.y = TORSO_H * 0.5;
upper.add(torso);

function makeArm(sx) {
  var g = new THREE.Group();
  g.position.set(sx * 0.33, TORSO_H, 0);
  g.add(part(0.20, ARM_H, 0.20, SHIRT, true));
  var hand = part(0.20, HAND_H, 0.20, SKIN);
  hand.position.y = -(ARM_H + HAND_H * 0.5);
  g.add(hand);
  upper.add(g);
  return g;
}
export var armL = makeArm(-1), armR = makeArm(1);

// 목 — 여기서 머리만 따로 돈다 (몸은 늦게 따라온다)
export var neck = new THREE.Group();
neck.position.y = TORSO_H;
neck.rotation.order = "YXZ";
upper.add(neck);

var head = part(HEAD_S, HEAD_S, HEAD_S, SKIN);
head.position.y = HEAD_S * 0.5;
neck.add(head);
var hairTop = part(0.46, 0.12, 0.46, HAIR);
hairTop.position.y = HEAD_S - 0.02;
neck.add(hairTop);
var hairBack = part(0.46, 0.34, 0.06, HAIR);
hairBack.position.set(0, HEAD_S * 0.5, 0.21);
neck.add(hairBack);
// 눈 두 개 — 단색 상자라 얼굴이 없으면 앞뒤를 못 가린다 (앞은 -Z)
for (var e = 0; e < 2; e++) {
  var eye = part(0.08, 0.08, 0.02, 0x2b2f4a);
  eye.position.set((e ? 1 : -1) * 0.10, HEAD_S * 0.58, -(HEAD_S * 0.5 + 0.01));
  neck.add(eye);
}

// 오른손에 든 블록 — 1인칭 손과 같은 것을 3인칭에서도 들고 있어야
// 사진 모드로 찍은 그림에 "무엇을 짓던 중" 이 남는다
// transparent 를 빠뜨리면 횃불·꽃·유리의 비친 픽셀이 **검은 상자**로 나온다 (1인칭 handMat 과 같은 설정)
var heldMat = new THREE.MeshBasicMaterial({ map: atlasTex, vertexColors: true,
                                            transparent: true, alphaTest: 0.5 });
export var heldBlock = new THREE.Mesh(new THREE.BufferGeometry(), heldMat);
heldBlock.scale.setScalar(0.34);
heldBlock.position.set(-0.02, -(ARM_H + HAND_H + 0.10), -0.14);
heldBlock.rotation.set(0.2, 0.5, 0);
armR.add(heldBlock);
var heldKey = -1;

var bodyYaw = 0, phase = 0, prevX = 0, prevZ = 0, prevOk = false, lastLit = -1;

function wrapAngle(a) {
  a = (a + Math.PI) % (Math.PI * 2);
  if (a < 0) a += Math.PI * 2;
  return a - Math.PI;
}

export function updateBody(dt) {
  // 1인칭에서는 머리 안에 있어 시야만 가린다 — 3인칭일 때만 켠다
  if (!S.thirdPerson) {
    bodyRoot.visible = false;
    prevOk = false;
    return;
  }
  bodyRoot.visible = true;

  // 걸음 속도는 실제로 움직인 거리로 잰다 — vel 은 나는 중이나 스텝업에서 어긋난다.
  // 스폰·불러오기처럼 순간이동한 프레임은 prevOk 로 걸러 낸다
  var sp = 0;
  if (prevOk && dt > 0) {
    var dx = player.pos.x - prevX, dz = player.pos.z - prevZ;
    sp = Math.min(9, Math.sqrt(dx * dx + dz * dz) / dt);
  }
  prevX = player.pos.x; prevZ = player.pos.z; prevOk = true;

  var moving = sp > 0.35;
  // 몸통은 시선을 늦게 따라간다 — 서서 둘러볼 때 몸이 팽이처럼 돌면 어지럽다
  var d = wrapAngle(player.yaw - bodyYaw);
  if (moving) bodyYaw += d * Math.min(1, dt * 9);
  else if (Math.abs(d) > 1.05) bodyYaw += d - (d > 0 ? 1.05 : -1.05);
  bodyYaw = wrapAngle(bodyYaw);

  var sneak = S.sneakEye / 0.22;
  bodyRoot.position.set(player.pos.x, player.pos.y - sneak * 0.10, player.pos.z);
  bodyRoot.rotation.y = bodyYaw;
  upper.rotation.x = sneak * 0.5;
  neck.rotation.x = player.pitch - sneak * 0.5;
  neck.rotation.y = Math.max(-1.4, Math.min(1.4, wrapAngle(player.yaw - bodyYaw)));

  var calm = calmMotion();
  var swing = Math.min(0.85, sp * 0.19) * (calm ? 0.5 : 1);
  phase += sp * dt * 2.4;
  var sw = Math.sin(phase) * swing;

  // 비행은 영원히 onGround === false 다 — 예전에는 크리에이티브에서 가장 오래 하는 일이
  // **30분 내내 만세 자세**였다 (v95). 나는 중에는 걷기와 같은 스윙을 태운다
  var airborne = !player.onGround && !player.flying;
  if (!airborne) {
    legL.rotation.x = sw;
    legR.rotation.x = -sw;
    armL.rotation.x = -sw * 0.8;
    armR.rotation.x = sw * 0.8;
  } else {
    // 낙하·점프 — 다리를 벌리고 팔을 조금 든다. 마크에서 뛴 사람은 이 모양이다
    legL.rotation.x = 0.32; legR.rotation.x = -0.32;
    armL.rotation.x = -0.18; armR.rotation.x = -0.18;
  }
  armL.rotation.z = 0.06 + (airborne ? 0.28 : 0);
  armR.rotation.z = -0.06 - (airborne ? 0.28 : 0);

  // 캐고 놓을 때 오른팔이 같이 내려친다 — 1인칭 손(S.swing)과 같은 박자
  if (S.swing > 0) armR.rotation.x -= Math.sin(S.swing * Math.PI) * 1.5;

  // 몸도 서 있는 칸의 밝기를 받는다 (v95).
  // 예전에는 파트 열여섯이 전부 고정 hex 라 **한밤에도 굴 속에서도 정오 색**이었다 —
  // 정작 손에 든 블록만 어두워서, 형광색 팔이 캄캄한 흙덩이를 들고 있었다.
  // 밝기는 1인칭 손이 이미 계산해 둔 값(S.handLight)을 그대로 쓴다.
  var L = Math.max(0.16, S.handLight);
  if (Math.abs(L - lastLit) > 0.004) {
    lastLit = L;
    for (var pi = 0; pi < litParts.length; pi++) {
      var pm = litParts[pi], bc = pm.userData.base;
      pm.material.color.setRGB(bc.r * L, bc.g * L, bc.b * L);
    }
  }

  // 든 블록 — 손이 받는 밝기(S.handLight)를 그대로 쓴다
  var b = S.bar[S.selected];
  if (b === AIR) heldBlock.visible = false;
  else {
    heldBlock.visible = true;
    if (b !== heldKey) {
      heldKey = b;
      heldBlock.geometry.dispose();
      heldBlock.geometry = makeBlockGeometry(b, SH_FULL);
    }
    heldMat.color.setScalar(Math.max(0.2, S.handLight));
  }
}
