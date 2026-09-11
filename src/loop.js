// loop.js — 게임 루프
import { S } from "./state.js";
import { padState, pollGamepad, pollGamepadMenu , selectionText} from "./input.js";
import { breedTick, MOB_KINDS, aimedMob, removeMob, pushOutOfMobs, seedFlocks, seedMobs, updateFlocks, updateMobs } from "./mobs.js";
import { Q, resetQueues } from "./queues.js";
import { CH, CX, CZ, SEA, WX, WY, WZ, idx, inside } from "./dims.js";
import { FIRE, isStairShape, SH_FULL, SH_SLAB, AIR, DEFAULT_BAR, ICE, LAVA, SNOW, TORCH, WATER, hardnessOf, isClimbable, isCross, isItem, isSolid, isUnbreakable } from "./blocks.js";
import { animateLiquids, crackTex } from "./atlas.js";
import { boxesAt, seenRatio, BIOME_NAMES, biomeMap, crossBase, generate, get, isTouched, set, shape, topMap, world } from "./world.js";
import { lightAtPlayer, lightBlk, lightSky, relightAll } from "./light.js";
import { growTick, lavaFlowTick, lavaDryTick, grassTick, lavaTick, primeTick, TNT_FUSE, decayTick, dryTick, fallTick, fireTick, freezeTick, waterTick } from "./fluids.js";
import { buildBudget, dirty, markAllDirty, opaqueMeshes, setBuildFocus } from "./mesh.js";
import { DEEP_UNDER, dynamicHighlight, updatePasteBox, updateOuterSea, primedBoxes, HL_CROSS, HL_GEO, SHAPE_BOUNDS, burst, camera, cloudGroup, cloudGroupHigh, crackMat, crackMesh, highlight, renderer, scene, sky, updateChunkVisibility, updateEdge, updateParticles, updateSelectionBox, voxUniforms } from "./scene.js";
import { applyTime, clockText, dayLight } from "./daynight.js";
import { calmMotion, fovForAspect, opts } from "./settings.js";
import { EYE, HALF, moveAxis, moveHorizontal, player, pointSolid, raycast, spawn, stats, unstick } from "./player.js";
import { splash, waterLap, fireCrackle, at, caveSound, crunch, lavaHiss, lavaPop, listenAt, miningSound, moodChord, setMuffle, stepSound, tone, updateAmbient } from "./audio.js";
import { pushPrev, saveGame } from "./save.js";
import { checkBuildAchievements, checkFoundAchievements, ACHIEVEMENTS, achCount, applyEdit, refreshAchList, refreshStats, selectionBounds, unlock } from "./edit.js";
import { refreshMouthDots, refreshMinimapCap, tAim, airBar, airEl, drawMinimap, facingText, perfEl, refreshBar, tAch, tBiome, tBlocks, tFace, tFps, tLight, tMode, tPos, tShape, tTime, toast, toastEl, inblockEl, underwaterEl } from "./hud.js";
import { ghostMesh, handCam, handScene, triggerSwing, updateGhost, updateHand, updateHandBlock } from "./hand.js";
import { updateBody } from "./body.js";
import { canPlaceAt, mineAt, place, upperFromHit } from "./mine.js";
import { localBiome, seedCreatures, setWeather, updateCreatures, updateSkyBodies, updateStorm, updateWeather } from "./sky.js";

export var GRAVITY = 26, JUMP = 8.4, WALK = 4.6, SPRINT = 6.0, FLY = 12;

// 청크 기둥(16×16)마다 그 안에서 가장 낮은 지표 — 발밑 지하 청크를 걸러내는 데 쓴다 (v80).
// scene.js 가 world.js 를 import 하지 않도록 여기서 재어 넘긴다.
export var chunkFloor = new Int16Array(CX * CZ);
export function refreshChunkFloor() {
  var k;
  for (k = 0; k < chunkFloor.length; k++) chunkFloor[k] = 30000;
  for (var z = 0; z < WZ; z++) {
    var cz = (z / CH) | 0;
    for (var x = 0; x < WX; x++) {
      var t = topMap[z * WX + x];
      k = cz * CX + ((x / CH) | 0);
      if (t < chunkFloor[k]) chunkFloor[k] = t;
    }
  }
  S.floorReady = true;
}
// 우클릭을 누르고 있을 때 — 두 번째가 나가기까지 뜸(초) · 그 뒤 반복 간격(초)
// 반복 간격은 오래 0.35 였다. 그렇게 늦춘 까닭은 "조준한 칸이 바뀌면 쿨다운을 건너뛰어
// 손이 조금만 떨려도 한 번 누른 것이 여러 개로 놓이던 것" 이었는데, **원인은 건너뛴 것이지
// 간격이 짧은 것이 아니었다.** 지금은 늘 간격을 지키므로 마크(4틱 = 0.20초)에 맞춘다.
// 20칸 줄이 7.15초에서 4.4초로 줄어든다 (자문 12차 #7).
// 첫 뜸(PLACE_DELAY)은 그대로 둔다 — 한 번 톡 누른 것이 둘로 늘어나지 않게 하는 자리다.
export var PLACE_DELAY = 0.50, PLACE_REPEAT = 0.20;
export var SNEAK_MUL = 0.32; // 웅크릴 때 이동 배율
export var AIR_CONTROL = 0.24; // 공중에서는 방향을 거의 못 바꾼다
export var fwd = new THREE.Vector3(), right = new THREE.Vector3();
export var clock = new THREE.Clock();

export function newWorld(seed) {
  pushPrev();                 // 갈아엎기 직전의 세계를 자동 저장이 못 덮는 자리에 둔다
  generate(seed);
  relightAll(false);
  markAllDirty();
  buildBudget(70);
  stats.placed = 0; stats.mined = 0;
  S.bar = DEFAULT_BAR.slice();
  refreshBar();
  S.history.length = 0; S.future.length = 0;
  resetQueues();
  S.earned = {}; S.placedKinds = {}; S.lampsPlaced = 0; S.playSeconds = 0; S.tut = 0;
  // 횃불 카운터도 함께 지운다 (v93) — 램프만 지우고 있어서, 지난 세계에서 횃불을 꽂아 봤다면
  // **새 세계에 횃불 하나만 꽂아도 「횃불 10개」 과제가 그 자리에서 열렸다.**
  // 저장은 lamps·torches 를 한 쌍으로 싣고 내린다 — 어긋난 곳은 여기 한 군데였다.
  S.torchesPlaced = 0;
  S.everEdited = false;    // 되돌리기 안내(undoEmptyWhy)가 새 세계에서 옛말을 하지 않게
  // 걸은 거리도 새 세계에서 다시 센다 — 안 지우면 지난 세계에서 걸은 거리 때문에
  // 새 사막에 스폰하자마자 "사막" 이 뜬다 (v60 에서 막은 그 장면이 두 번째 세계에서 되살아난다)
  S.walked = 0; S.achPrevX = null; S.achPrevZ = null;
  S.growDirty = true;      // 새 세계의 묘목을 큐에 다시 담는다
  S.shapeMode = 0;
  if (S.shapeBar) { for (var sq = 0; sq < S.shapeBar.length; sq++) S.shapeBar[sq] = 0; }
  if (S.shapeBarAlt) { for (var sq2 = 0; sq2 < S.shapeBarAlt.length; sq2++) S.shapeBarAlt[sq2] = 0; }
  if (S.fillBar) { for (var fq = 0; fq < S.fillBar.length; fq++) S.fillBar[fq] = 0; }
  if (S.fillBarAlt) { for (var fq2 = 0; fq2 < S.fillBarAlt.length; fq2++) S.fillBarAlt[fq2] = 0; }
  S.stepLift = 0;
  S.spawnPoint = null;
  S.marks = [];
  S.selA = S.selB = null;
  S.clip = null;
  seedMobs();
  seedFlocks();
  refreshAchList(); refreshStats();
  S.timeOfDay = 0.25;      // 06:00 — 첫 노을까지 10분(하루 20분 기준). 07:12 시작은 튜토리얼 도중 밤이 왔다
  applyTime();
  spawn();
  if (S.savedPos) { S.savedPos.copy(player.pos); S.savedYaw = player.yaw; S.savedPitch = player.pitch; }
  S.loadedFromSave = false;
  setWeather(0);
  S.weatherLock = false;      // 새 세계는 날씨도 다시 저절로 돈다
  seedCreatures();
  S.worldDirty = true;
  saveGame();
  refreshMinimapCap();
  drawMinimap();
  toast("새 세계 · SEED " + S.worldSeed);
  tone(300, 0.16, "sine", 0.05);
}

export function step(dt) {
  var playing = S.active && !S.uiOpen;
  var eyeY = player.pos.y + EYE;
  var eyeBlock = get(Math.floor(player.pos.x), Math.floor(eyeY), Math.floor(player.pos.z));
  var feetBlock = get(Math.floor(player.pos.x), Math.floor(player.pos.y + 0.3), Math.floor(player.pos.z));
  // 물 윗면은 0.12칸 낮춰 그리므로 판정도 거기에 맞춘다 — 안 그러면 전환이 어긋난다
  var surfaceGap = (get(Math.floor(player.pos.x), Math.floor(eyeY) + 1,
                        Math.floor(player.pos.z)) === WATER) ? 0 : 0.12;
  var eyeInWater = eyeBlock === WATER && (eyeY - Math.floor(eyeY)) < 1 - surfaceGap;
  var eyeInLava = eyeBlock === LAVA;
  var eyeInLiquid = eyeInWater || eyeInLava;
  var feetInWater = feetBlock === WATER || feetBlock === LAVA;   // 용암은 물보다 더 끈적하다
  var thick = feetBlock === LAVA;

  // 시작 화면에서는 시계를 멈춘다 — 소개문 읽고 시드 넣는 2~3분이 그대로 낮에서 빠졌다
  if (opts.day > 0 && S.started && S.active) {
    var prevDay = S.timeOfDay;
    S.timeOfDay = (S.timeOfDay + dt / (opts.day * 60)) % 1;
    if (S.timeOfDay < prevDay) S.moonDay++;      // 자정을 넘기면 달 위상이 바뀐다
  }
  applyTime(dt);
  voxUniforms.uTime.value += dt;

  if (playing) {
    // 몸이 블록에 묻혔으면 먼저 빼낸다 — 안 그러면 어떤 조작으로도 움직일 수 없다
    if (unstick()) toast("블록에서 빠져나왔습니다");

    fwd.set(-Math.sin(player.yaw), 0, -Math.cos(player.yaw));
    right.set(Math.cos(player.yaw), 0, -Math.sin(player.yaw));

    // 게임패드가 있으면 왼쪽 스틱이 이동을 대신한다
    var padOn = pollGamepad(dt);
    var ix = ((S.keys.KeyD || S.keys.ArrowRight) ? 1 : 0) - ((S.keys.KeyA || S.keys.ArrowLeft) ? 1 : 0);
    var iz = ((S.keys.KeyW || S.keys.ArrowUp) ? 1 : 0) - ((S.keys.KeyS || S.keys.ArrowDown) ? 1 : 0);
    if (S.stick.x || S.stick.z) { ix = S.stick.x; iz = S.stick.z; }
    if (padOn && (padState.lx || padState.ly)) { ix = padState.lx; iz = -padState.ly; }
    // Shift 는 웅크리기(마크식) · 달리기는 Ctrl 또는 W 더블탭
    var crouchKey = !!(S.keys.ShiftLeft || S.keys.ShiftRight);
    if (opts.sneaktog) {
      // 전환식 — 누를 때마다 켜고 끈다. Shift 를 계속 붙들고 다리를 놓는 건 손목이 버틴다.
      if (crouchKey && !S.crouchWas) S.sneakLatch = !S.sneakLatch;
      S.sneaking = S.sneakLatch && !player.flying;
    } else {
      S.sneakLatch = false;
      S.sneaking = crouchKey && !player.flying;
    }
    S.crouchWas = crouchKey;
    if (iz <= 0.1) S.sprintTap = false;                    // 전진을 멈추면 더블탭 달리기 해제
    // 스틱을 **끝까지** 밀고 있으면 달린다 — 폰에는 Ctrl 도 W 더블탭도 없어서
    // 96칸 섬을 늘 4.6b/s 로 걸었고, 비행 2배(flySprint)에도 갈 길이 없었다 (자문 17차 #3).
    // 베드락도 조이스틱을 바깥 테두리까지 밀면 달린다.
    var stickFull = Math.sqrt(S.stick.x * S.stick.x + S.stick.z * S.stick.z) > 0.9;
    var sprinting = !S.sneaking && iz > 0.1 &&
                    (S.sprintTap || stickFull ||
                     !!(S.keys.ControlLeft || S.keys.ControlRight));
    S.sprintingNow = sprinting;

    // 날면서도 달린다 (마크와 같이 약 2배) — 96칸 섬을 가로지르려고
    // Alt+휠로 배율을 올렸다 내렸다 할 일이 없어진다. 재료는 이미 다 계산돼 있었다.
    var flySprint = (sprinting || stickFull ||
                     !!(S.keys.ControlLeft || S.keys.ControlRight)) ? 2 : 1;
    var speed = player.flying ? FLY * S.flySpeed * flySprint
              : (S.sneaking ? WALK * SNEAK_MUL : (sprinting ? SPRINT : WALK));
    if (feetInWater && !player.flying) speed *= thick ? 0.30 : 0.55;

    var mx = fwd.x * iz + right.x * ix;
    var mz = fwd.z * iz + right.z * ix;
    var len = Math.hypot(mx, mz);
    if (len > 0.001) { mx = mx / len * speed; mz = mz / len * speed; } else { mx = 0; mz = 0; len = 0; }

    // 관성 — 목표 속도로 붙되 지상은 빠르게, 공중에서는 거의 못 바꾼다
    // 얼음 위에서는 붙는 힘도 마찰도 확 낮아진다 — 얼음의 유일한 정체성
    var ground = get(Math.floor(player.pos.x), Math.floor(player.pos.y - 0.1),
                     Math.floor(player.pos.z));
    var slick = (ground === ICE && player.onGround && !player.flying) ? 0.14 : 1;
    var control = player.flying ? 1 : (player.onGround ? 1 : AIR_CONTROL);
    var grab = Math.min(1, dt * (player.flying ? 16 : 24) * control * slick);
    player.vel.x += (mx - player.vel.x) * grab;
    player.vel.z += (mz - player.vel.z) * grab;
    if (len === 0 && (player.onGround || player.flying)) {
      var fric = Math.max(0, 1 - dt * (player.flying ? 9 : 12) * slick);
      player.vel.x *= fric; player.vel.z *= fric;
    }
    if (Math.abs(player.vel.x) < 0.02) player.vel.x = 0;
    if (Math.abs(player.vel.z) < 0.02) player.vel.z = 0;

    if (player.flying) {
      // 수직도 같이 빨라진다 — 마크와 같다. 안 그러면 높이 뜨는 데만 시간이 걸린다
      player.vel.y = ((S.keys.Space ? 1 : 0) - (crouchKey ? 1 : 0)) * FLY * S.flySpeed * flySprint;
    } else {
      // 사다리 — 몸이 사다리에 걸쳐 있으면 천천히 오르내린다
      var onLadder = isClimbable(get(Math.floor(player.pos.x),
                                     Math.floor(player.pos.y + 0.6),
                                     Math.floor(player.pos.z)));
      if (onLadder) {
        // 웅크리면 사다리에 매달려 멈춘다 — 마크에서 가장 많이 쓰는 손버릇이다.
        // (예전에는 오히려 두 배로 빨리 미끄러져 내려갔다)
        var up = crouchKey ? 0 : (S.keys.Space ? 1 : (len > 0 ? 0.75 : 0));
        player.vel.y = crouchKey ? 0 : (up ? up * 3.2 : -1.6);
        if (up > 0 && Math.random() < dt * 6) crunch(0.05, 0.03, 900);
      } else
      player.vel.y -= GRAVITY * dt * (feetInWater ? (thick ? 0.14 : 0.22) : 1);
      if (feetInWater) {
        player.vel.y = Math.max(player.vel.y, thick ? -1.4 : -2.6);
        if (S.keys.Space) {
          // 잠수 중에는 꾸준히 떠오르고, 수면에서는 한 칸 물가로 뛰어오를 힘을 준다
          if (eyeInLiquid) player.vel.y = thick ? 2.4 : 4.4;
          else player.vel.y = Math.max(player.vel.y, thick ? 2.4 : JUMP * 0.8);
        }
      } else if (S.keys.Space && player.onGround) {
        player.vel.y = JUMP;
        player.onGround = false;
      }
      player.vel.y = Math.max(player.vel.y, -48);
    }

    var fallSpeed = player.vel.y;
    player.onGround = false;
    moveAxis("y", player.vel.y * dt);
    moveHorizontal(player.vel.x * dt, player.vel.z * dt);
    // 동물을 뚫고 지나가지 않는다
    var push = pushOutOfMobs(player.pos.x, player.pos.z, HALF);
    if (push[0] || push[2]) moveHorizontal(push[0] * 0.5, push[1] * 0.5);

    // 물에 들어가는 순간 첨벙 — 6칸 위에서 바다로 뛰어들어도 아무 소리가 없었다
    if (feetInWater && !S.wasFeetInWater) {
      splash(Math.min(1, 0.35 + Math.abs(fallSpeed) * 0.06));
    }
    S.wasFeetInWater = feetInWater;

    if (player.onGround && !S.wasOnGround && fallSpeed < -6 && !feetInWater) {
      crunch(0.12, Math.min(0.22, Math.abs(fallSpeed) * 0.014), 700);
      // 착지 먼지 — 세게 떨어질수록 많이 인다
      var landB = get(Math.floor(player.pos.x), Math.floor(player.pos.y - 0.1),
                      Math.floor(player.pos.z));
      if (landB) burst(player.pos.x - 0.5, player.pos.y - 0.35, player.pos.z - 0.5,
                       landB, Math.min(10, 2 + Math.floor(Math.abs(fallSpeed) / 4)));
    }
    S.wasOnGround = player.onGround;

    player.pos.x = Math.max(0.35, Math.min(WX - 0.35, player.pos.x));
    player.pos.z = Math.max(0.35, Math.min(WZ - 0.35, player.pos.z));
    if (player.pos.y < -20) spawn();

    // 미끄러지는 동안에도 발소리와 흔들림이 이어지도록 실제 속도를 본다
    var hSpeed = Math.hypot(player.vel.x, player.vel.z);
    var moving = hSpeed > 0.7 && player.onGround && !player.flying;
    var target = moving ? Math.min(1, hSpeed / SPRINT) : 0;
    S.bobAmount += (target - S.bobAmount) * Math.min(1, dt * 9);
    if (moving) {
      var prev = S.stepPhase;
      S.stepPhase += dt * (1.8 + hSpeed * 1.6);
      if (Math.floor(prev / Math.PI) !== Math.floor(S.stepPhase / Math.PI)) {
        var bodyCell = get(Math.floor(player.pos.x), Math.floor(player.pos.y + 0.4),
                           Math.floor(player.pos.z));
        stepSound(get(Math.floor(player.pos.x), Math.floor(player.pos.y - 0.1),
                      Math.floor(player.pos.z)), isCross(bodyCell));
      }
    }
    S.bobPhase = S.stepPhase;

    // 우클릭 홀드 — 키보드 자동 반복처럼 "한 번 놓고 · 뜸을 들이고 · 천천히 반복"
    // 예전에는 조준한 칸이 바뀌면 쿨다운을 건너뛰었는데, 클릭하며 손이 조금만 떨려도
    // 한 번 누른 것이 여러 개로 놓였다. 간격은 항상 지킨다.
    S.placeCooldown -= dt;
    if ((S.lockMode && S.mouseDown[2]) || S.touchPlace) {
      if (S.placeCooldown <= 0) {
        var firstTap = S.lastPlaceCell === -1;
        // 홀드로 반복될 때는 문 여닫기·점화·먹이 주기를 하지 않는다.
        // 그러지 않으면 문 앞에서 우클릭을 누르고 있는 동안 계속 여닫힌다.
        place(!firstTap);
        S.lastPlaceCell = 0;                     // 누르고 있는 중이라는 표시
        S.placeCooldown = firstTap ? PLACE_DELAY : PLACE_REPEAT;
      }
    } else S.lastPlaceCell = -1;
  }

  if (!playing) { S.sneaking = false; S.sneakLatch = false; S.sprintingNow = false; }

  // 카메라
  var calm = calmMotion();
  var bobY = 0, bobX = 0;
  if (!calm && S.bobAmount > 0.001) {
    bobY = Math.sin(S.bobPhase) * 0.055 * S.bobAmount;
    bobX = Math.cos(S.bobPhase * 0.5) * 0.035 * S.bobAmount;
  }
  var sneakTarget = (S.sneaking && player.onGround) ? 0.22 : 0;
  S.sneakEye += (sneakTarget - S.sneakEye) * Math.min(1, dt * 12);
  // 스텝업으로 올라선 높이를 0 으로 녹인다 — 계단 여섯 단이 딸깍 여섯 번이 아니라
  // 한 줄기 경사로 읽힌다 (자문 12차 #2)
  if (S.stepLift > 0.002) S.stepLift -= S.stepLift * Math.min(1, dt * 16);
  else S.stepLift = 0;

  // 달리는 중이라는 유일한 시각 신호 — 시야각이 살짝 넓어진다
  // 좁은 창에서는 세로 화각이 커진다 — 달리기 +5.5° 도 그 보정을 타야 한다 (v93)
  var fovTarget = fovForAspect(opts.fov + ((S.sprintingNow && !calm) ? 5.5 : 0), camera.aspect);
  if (S.fovNow === 0) S.fovNow = camera.fov;
  if (Math.abs(S.fovNow - fovTarget) > 0.02) {
    S.fovNow += (fovTarget - S.fovNow) * Math.min(1, dt * 8);
    camera.fov = S.fovNow;
    camera.updateProjectionMatrix();
  }

  camera.position.set(player.pos.x + bobX * 0.4,
                      player.pos.y + EYE - S.sneakEye - S.stepLift + bobY, player.pos.z);
  camera.rotation.y = player.yaw;
  camera.rotation.x = player.pitch;

  // F5 — 3인칭. 벽에 파묻히지 않게 시선 반대쪽으로 조금씩 물러난다
  if (S.thirdPerson) {
    var back = S.thirdPerson === 1 ? 1 : -1;
    var vx = Math.sin(player.yaw) * Math.cos(player.pitch) * back;
    var vy = -Math.sin(player.pitch) * back;
    var vz = Math.cos(player.yaw) * Math.cos(player.pitch) * back;
    var reach = 0;
    for (var s3 = 0.25; s3 <= 4; s3 += 0.25) {
      if (isSolid(get(Math.floor(camera.position.x + vx * s3),
                      Math.floor(camera.position.y + vy * s3),
                      Math.floor(camera.position.z + vz * s3)))) break;
      reach = s3 - 0.25;
    }
    camera.position.x += vx * reach;
    camera.position.y += vy * reach;
    camera.position.z += vz * reach;
    if (S.thirdPerson === 2) {
      camera.rotation.y = player.yaw + Math.PI;
      camera.rotation.x = -player.pitch;
    }
  }
  camera.rotation.z = bobX * 0.12;
  sky.position.copy(camera.position);
  updateHand(dt);
  updateBody(dt);
  updateSkyBodies();
  updateWeather(dt);
  updateStorm(dt);
  updateEdge(player.pos.x, player.pos.z);
  updateSelectionBox(selectionBounds(), S.selA && !S.selB ? S.selA : (S.selB && !S.selA ? S.selB : null));
  // 복사한 것이 있으면 조준한 자리에 놓일 상자를 미리 그린다
  if (playing && S.clip) {
    var ph2 = raycast(6);
    updatePasteBox(S.clip, ph2 ? [ph2.x + ph2.nx, ph2.y + ph2.ny, ph2.z + ph2.nz] : null);
  } else updatePasteBox(null, null);
  updateCreatures(dt);
  updateMobs(dt);
  if (breedTick(dt)) unlock("breed");
  updateFlocks(dt);

  if (!calmMotion()) {
    cloudGroup.position.x += dt * 0.9;
    if (cloudGroup.position.x > 220) cloudGroup.position.x -= 440;
    cloudGroupHigh.position.x += dt * 2.1;      // 높은 층이 더 빨리 흐른다
    if (cloudGroupHigh.position.x > 220) cloudGroupHigh.position.x -= 440;
  }

  // 눈이 블록에 파묻혔을 때 — 세계의 뒷면(옆이 뚫려 보이는 화면) 대신 어둠으로 덮는다
  var eyeBuried = S.active && pointSolid(player.pos.x, player.pos.y + EYE, player.pos.z);
  if (eyeBuried !== S.wasBuried) {
    inblockEl.hidden = !eyeBuried;
    S.wasBuried = eyeBuried;
  }

  // 물속
  if (eyeInLiquid !== S.wasUnderwater || eyeInLava !== S.wasInLava) {
    underwaterEl.hidden = !eyeInLiquid;
    underwaterEl.classList.toggle("lava", eyeInLava);
    S.wasUnderwater = eyeInLiquid;
    S.wasInLava = eyeInLava;
  }
  if (eyeInLava) {
    voxUniforms.uFogNear.value = 0.05;
    voxUniforms.uFogFar.value = 2.6;
    voxUniforms.uFogColor.value.setRGB(0.72, 0.22, 0.05);
  } else if (eyeInWater) {
    voxUniforms.uFogNear.value = 0.1;
    voxUniforms.uFogFar.value = 22;
    voxUniforms.uFogColor.value.setRGB(0.10, 0.28, 0.46);
  } else {
    var wf = S.weather ? (S.weather === 1 ? 0.55 : 0.62) : 1;
    voxUniforms.uFogNear.value = Math.max(8, farNow() * 0.35 * wf);
    voxUniforms.uFogFar.value = farNow() * wf;
  }

  // 조준 + 캐기 진행
  updateHandBlock();
  var hit = playing ? raycast(6) : null;
  // 조준 면을 남겨 둔다 — HUD 는 animate() 에 있어 이 지역 변수를 못 본다
  S.aimFace = hit ? [hit.x + hit.nx, hit.y + hit.ny, hit.z + hit.nz] : null;
  S.aimHit = hit ? [hit.x, hit.y, hit.z] : null;   // 겨눈 칸 자체 (계기판 「조준」· v93)
  if (hit) {
    highlight.visible = true;
    if (isCross(hit.block)) {
      highlight.geometry = HL_CROSS[hit.block] || HL_GEO[0];
      highlight.position.set(hit.x, crossBase(hit.x, hit.y, hit.z), hit.z);
    } else {
      // 모서리 계단은 이웃에 따라 모양이 달라져 미리 만들어 둘 수가 없다 —
      // 조준한 그 칸의 실제 상자로 테두리를 만든다. 안 그러면 직선 외곽선이 떠 어긋난다.
      highlight.geometry = isStairShape(hit.shape)
        ? dynamicHighlight(boxesAt(hit.block, hit.shape, hit.x, hit.y, hit.z))
        : (HL_GEO[hit.shape] || HL_GEO[0]);
      highlight.position.set(hit.x, hit.y, hit.z);
    }
    var gx = hit.x + hit.nx, gy = hit.y + hit.ny, gz = hit.z + hit.nz;
    // 놓을 수 없는 물건(도구)에는 배치 미리보기를 안 띄운다 —
    // 양동이를 들고 땅을 겨누면 "양동이 블록" 의 반투명 상자가 떴다 (자문 17차 #5)
    if (!isItem(S.bar[S.selected]) && canPlaceAt(gx, gy, gz))
      updateGhost(gx, gy, gz, upperFromHit(hit));
    else ghostMesh.visible = false;
  } else {
    highlight.visible = false;
    ghostMesh.visible = false;
  }

  // 크리에이티브인데 돌 하나에 1.25초, 철광석에 1.95초다 — 굳기 표는 서바이벌 수치다.
  // 잘못 놓은 벽 한 줄(20칸)을 헐려면 25초를 붙잡고 있어야 한다.
  // 균열 4단계·팔 스윙·"턱-턱" 소리는 이 게임이 잘 만든 부분이라 살리고, 배율만 둔다.
  // 0 보통 · 1 빠름(4배) · 2 즉시. "즉시" 도 완전한 0 은 아니다 —
  // 0 이면 누르고 있는 동안 초당 60칸이 사라져 손이 못 따라간다. 0.08초면 사람 눈엔 즉시고,
  // 쓸어 캘 때는 초당 12칸으로 멎는다.
  var DIG_INSTANT = 0.08;
  function digNeed(b) {
    var h = hardnessOf(b);
    if (opts.dig === 2) return Math.min(h, DIG_INSTANT);
    if (opts.dig === 1) return h / 4;
    return h;
  }

  var wantBreak = playing && (S.touchBreak || (S.lockMode ? S.mouseDown[0]
                              : (S.dragging && S.dragBtn === 0 && S.dragDist < 7)));
  // 좌클릭이 동물을 향하면 동물이 먼저다 (v95) — 마크 크리에이티브와 같다.
  // 누른 채로 있으면 근처 동물이 줄줄이 사라지므로 **한 번 누르면 한 마리**다
  if (!wantBreak) S.mobSwatted = false;
  else if (!S.mobSwatted) {
    var am = aimedMob();
    if (am) {
      // 동물보다 가까운 블록이 있으면 블록을 캔다 — 울타리 너머의 양이 벽을 뚫고 잡히면 안 된다
      var eyeY = player.pos.y + EYE;
      var hd = hit ? Math.sqrt((hit.x + 0.5 - player.pos.x) * (hit.x + 0.5 - player.pos.x) +
                               (hit.y + 0.5 - eyeY) * (hit.y + 0.5 - eyeY) +
                               (hit.z + 0.5 - player.pos.z) * (hit.z + 0.5 - player.pos.z)) : 99;
      if (am.dist <= hd) {
        var kindName = MOB_KINDS[am.mob.kind].name;
        if (removeMob(am.mob)) {
          S.mobSwatted = true;
          triggerSwing();
          // 되돌릴 수 없는 일이다 — 처음 한 번은 그렇게 말해 준다
          toast(S.mobSwatHinted ? (kindName + "을(를) 보냈습니다")
                                : (kindName + "을(를) 보냈습니다 — 동물은 되돌리기로 안 돌아옵니다"));
          S.mobSwatHinted = true;
          S.breaking.on = false;
          crackMesh.visible = false;
        }
      }
    }
  }
  if (wantBreak && hit && hit.y > 0 && !isUnbreakable(hit.block) && !S.mobSwatted) {
    if (!S.breaking.on || S.breaking.x !== hit.x || S.breaking.y !== hit.y || S.breaking.z !== hit.z) {
      S.breaking.on = true; S.breaking.x = hit.x; S.breaking.y = hit.y; S.breaking.z = hit.z;
      S.breaking.t = 0; S.breaking.need = digNeed(hit.block); S.breaking.stage = -1;
      S.breaking.sw = 0;
    }
    S.breaking.t += dt;
    // 캐는 내내 팔을 휘두르고 "턱-턱" 소리를 반복한다 — 마크 채굴감의 핵심
    S.breaking.sw -= dt;
    if (S.breaking.sw <= 0) {
      S.breaking.sw = 0.28;
      triggerSwing();
      miningSound(hit.block);
    }
    if (S.breaking.t >= S.breaking.need) {
      mineAt(hit);
      S.breaking.on = false;
      crackMesh.visible = false;
    } else {
      var stage = Math.min(3, Math.floor(S.breaking.t / S.breaking.need * 4));
      if (stage !== S.breaking.stage) {
        S.breaking.stage = stage;
        crackMat.map = crackTex[stage];
        crackMat.needsUpdate = true;
      }
      crackMesh.visible = true;
      // 반블록·계단·상단슬랩 모두 실제 겉면에 맞춰 금이 가게 한다
      var bd = SHAPE_BOUNDS[hit.shape] || SHAPE_BOUNDS[0];
      crackMesh.scale.set(bd.mx[0] - bd.mn[0], bd.mx[1] - bd.mn[1], bd.mx[2] - bd.mn[2]);
      crackMesh.position.set(hit.x + (bd.mn[0] + bd.mx[0]) / 2,
                             hit.y + (bd.mn[1] + bd.mx[1]) / 2,
                             hit.z + (bd.mn[2] + bd.mx[2]) / 2);
      if (S.breaking.t % 0.22 < dt) burst(hit.x, hit.y, hit.z, hit.block, 1);
    }
  } else {
    S.breaking.on = false;
    crackMesh.visible = false;
  }

  updateParticles(dt);
  updateAmbient(dt);
  setMuffle(eyeInLiquid);
  listenAt(camera.position.x, camera.position.y, camera.position.z,
           -Math.sin(player.yaw), -Math.cos(player.yaw));

  // 산소 — 물속에서 줄고 나오면 빠르게 찬다. 다 떨어지면 숨이 차서 떠오른다.
  if (playing) {
    if (eyeInWater && !player.flying) S.oxygen = Math.max(0, S.oxygen - dt / 18);
    else if (S.oxygen < 1) {
      if (S.oxygen === 0) { crunch(0.35, 0.14, 1200); tone(320, 0.25, "sine", 0.05); }
      S.oxygen = Math.min(1, S.oxygen + dt / 2.5);
    }
    // 숨이 차면 **한 번** 떠오른다 — 매 프레임 밀어 올리면 수면과 바닥을 7초 주기로
    // 영원히 오르내리게 되어 **바다 밑 건축이 통째로 막힌다**(실측 60초 내내 반복).
    // 완전한 크리에이티브를 표방하는 게임에서 그러면 안 된다 (자문 18차 #3).
    // 한 번 밀어 올린 뒤에는 웅크리기(가라앉기)로 다시 내려갈 수 있다.
    if (eyeInWater && S.oxygen <= 0) {
      if (!S.gasped) { S.gasped = true; player.vel.y = Math.max(player.vel.y, 3.4); }
    } else if (!eyeInWater) S.gasped = false;
    var showAir = eyeInWater || S.oxygen < 0.999;
    if (airEl.hidden === showAir) airEl.hidden = !showAir;
    if (showAir) {
      airBar.style.width = (S.oxygen * 100).toFixed(1) + "%";
      airEl.classList.toggle("low", S.oxygen < 0.3);
    }
  } else if (!airEl.hidden) airEl.hidden = true;

  // 배경음 — 아주 드물게
  S.moodTimer -= dt;
  if (S.moodTimer <= 0) {
    S.moodTimer = 75 + Math.random() * 110;
    if (playing) moodChord(dayLight(S.timeOfDay) < 0.35, 1);
  }

  // 동굴 울림 — 깊고 어두운 곳에서만.
  // **절대 높이가 아니라 "머리 위에 흙이 얼마나 있느냐"** 로 잰다 (v79).
  // y < 22 로 못 박아 두면 판 2(지표 27 언저리)에서 굴을 19칸 파고 내려가도록
  // 완전한 무음이고, 겨우 들리기 시작하는 y=20 에서도 음량이 y=4 의 1/9 이다.
  // 지하 두께가 판마다 다르니 분모도 그 두께로 잡는다.
  S.caveTimer -= dt;
  if (S.caveTimer <= 0) {
    S.caveTimer = 7 + Math.random() * 12;
    if (playing && lightAtPlayer() <= 4) {
      var cvx = Math.floor(player.pos.x), cvz = Math.floor(player.pos.z);
      var roof = (cvx >= 0 && cvx < WX && cvz >= 0 && cvz < WZ)
        ? topMap[cvz * WX + cvx] : -1;
      var under = roof - player.pos.y;          // 머리 위 흙 두께
      if (under > 5) {
        caveSound(Math.min(1, (under - 5) / Math.max(6, SEA * 0.6)));
        S.caveHeard++;                       // 시험이 "울렸나" 를 셀 수 있게 (소리는 헤드리스에서 안 들린다)
      }
    }
  }

  // 횃불에서 불티가 올라간다 — 파티클 시스템은 이미 있는데 편집 때만 쓰고 있었다
  S.torchFxTimer -= dt;
  if (S.torchFxTimer <= 0 && playing) {
    S.torchFxTimer = 0.16;
    var tx = Math.floor(player.pos.x), ty = Math.floor(player.pos.y), tz = Math.floor(player.pos.z);
    for (var fx = -6; fx <= 6; fx += 2)
      for (var fy = -3; fy <= 3; fy++)
        for (var fz = -6; fz <= 6; fz += 2) {
          if (Math.random() > 0.06) continue;
          if (get(tx + fx, ty + fy, tz + fz) !== TORCH) continue;
          burst(tx + fx, ty + fy + 0.25, tz + fz, TORCH, 1);
        }
  }

  // 액체 텍스처를 흘린다 (아틀라스 두 타일만 다시 칠한다)
  S.liquidTimer += dt;
  if (S.liquidTimer > 0.14) { S.liquidTimer = 0; animateLiquids(voxUniforms.uTime.value); }

  // 용암이 가까우면 주기적으로 뽀글거린다 — 지하에서 "저쪽에 용암이 있다"를 귀로 알려 준다
  // 둘레에서 그 블록을 찾아 가장 가까운 칸에서 소리를 낸다 (용암 뽀글에서 쓰던 모양)
  function ambientNear(cx, cy, cz, block, r, play) {
    var n = 0, best = 1e9, px = 0, py = 0, pz = 0;
    for (var ax = -r; ax <= r; ax++)
      for (var ay = -4; ay <= 4; ay += 2)      // 0 을 반드시 포함한다 — 눈높이 칸이 빠지면 옆에 있어도 안 들린다
        for (var az = -r; az <= r; az++)
          if (get(cx + ax, cy + ay, cz + az) === block) {
            n++;
            var dd = ax * ax + ay * ay + az * az;
            if (dd < best) { best = dd; px = cx + ax; py = cy + ay; pz = cz + az; }
          }
    if (n > 0) play(n, at(px + 0.5, py + 0.5, pz + 0.5));
  }

  S.lavaTimer -= dt;
  if (S.lavaTimer <= 0) {
    S.lavaTimer = 0.4 + Math.random() * 0.6;
    if (playing) {
      var lx = Math.floor(player.pos.x), ly = Math.floor(player.pos.y), lz = Math.floor(player.pos.z);
      var near = 0, bestD = 1e9, bx = 0, by = 0, bz = 0;
      for (var ax = -5; ax <= 5; ax++)
        for (var ay = -4; ay <= 4; ay += 2)
          for (var az = -5; az <= 5; az++)
            if (get(lx + ax, ly + ay, lz + az) === LAVA) {
              near++;
              // 가장 가까운 용암 칸을 기억한다 — 소리가 그 자리에서 나야 방향을 안다
              var dd = ax * ax + ay * ay + az * az;
              if (dd < bestD) { bestD = dd; bx = lx + ax; by = ly + ay; bz = lz + az; }
            }
      if (near > 0) {
        lavaPop(Math.min(1, 0.25 + near / 30), at(bx + 0.5, by + 0.5, bz + 0.5));
        unlock("lava");
      }
      // 물과 불도 같은 틀로 — 세계에서 가장 넓은 것(바다)과 가장 눈에 띄는 것(불)이
      // 둘 다 귀에는 없었다. 방향까지 맞는 패너를 그대로 쓴다.
      ambientNear(lx, ly, lz, WATER, 6, function (n, node) {
        waterLap(Math.min(1, 0.2 + n / 60), node);
      });
      ambientNear(lx, ly, lz, FIRE, 5, function (n, node) {
        fireCrackle(Math.min(1, 0.35 + n / 8), node);
      });
    }
  }
  if (thick && !S.wasInLavaFeet) lavaHiss();
  S.wasInLavaFeet = thick;

  // TNT 도화선 — 매 프레임 태우고, 남은 시간에 맞춰 빠르게 깜빡인다
  if (S.primed.length) {
    primeTick(dt);
    S.primedBeep -= dt;
    if (S.primedBeep <= 0) {
      S.primedBeep = 0.5;
      var p0 = S.primed[0];                 // 치직 소리는 도화선 자리에서
      crunch(0.12, 0.04, 2200, at(p0.x + 0.5, p0.y + 0.5, p0.z + 0.5));
    }
  } else S.primedBeep = 0;
  for (var pi = 0; pi < primedBoxes.length; pi++) {
    var pp = S.primed[pi];
    if (!pp) { primedBoxes[pi].visible = false; continue; }
    // 터질 때가 가까울수록 빠르게 깜빡인다
    var rate = 3 + (1 - Math.min(1, pp.t / TNT_FUSE)) * 12;
    primedBoxes[pi].position.set(pp.x + 0.5, pp.y + 0.5, pp.z + 0.5);
    primedBoxes[pi].visible = Math.sin(S.playSeconds * rate * 6.283) > 0;
  }

  // 바닷물 흐름 — **ESC 로 나가 있으면 세계가 멈춘다** (v99).
  // 예전에는 액체·불·낙하·시계가 playing 을 안 봐서, 불을 붙여 둔 채 메뉴를 30초 열어
  // 두면 판자 집에서 184칸이 탔다. 게다가 그 틱들이 worldDirty 를 켜므로
  // **자동 저장이 그 피해를 저장까지** 했다. 마크도 싱글은 ESC 에 세계가 통째로 멈춘다.
  // 기준은 S.active 다 — playing(= active && !uiOpen)을 쓰면 블록 목록만 열어도
  // 물이 멈춰 과하다. 큐는 그대로 남아 돌아오면 이어진다
  S.waterTimer += dt;
  if (S.active && S.waterTimer > 0.15) {
    S.waterTimer = 0;
    dryTick(300);
    fireTick(40);
    // 용암은 물의 4분의 1 속도로 흐른다 — 걸어서 피할 수 있어야 한다
    Q.lavaTimer++;
    if (Q.lavaTimer >= 4) { Q.lavaTimer = 0; lavaFlowTick(120); lavaDryTick(120); }
    if (playing) lavaTick(player.pos.x, player.pos.y, player.pos.z, 24);
    // 잔디는 훨씬 느리게 — 2초에 한 번만 훑는다
    S.grassTimer = (S.grassTimer || 0) + 0.15;
    if (playing && S.grassTimer > 2) {
      S.grassTimer = 0;
      grassTick(player.pos.x, player.pos.y, player.pos.z, 12);
    }
    waterTick(300);
    fallTick(200);
  }

  // 묘목은 프레임마다 부른다. 위의 0.15초 블록 안에 두면 dt 가 그 안에서만 쌓여
  // 실제로는 9배 느려진다 (평균 12초로 잡은 것이 110초가 됐다).
  // 큐가 비어 있으면 바로 돌아오니 프레임마다 불러도 공짜다.
  if (playing) growTick(dt);

  // 눈이 얹힐 수 있는 겉면인가 — 이미 하얀 것·액체·얼음·풀꽃 위에는 안 쌓인다.
// 이미 눈이면 건너뛰므로 **스스로 멈춘다** (한 겹 덮고 나면 더 두꺼워지지 않는다).
function snowSticksTo(b) {
  if (b === SNOW || b === ICE || b === WATER || b === LAVA) return false;
  return isSolid(b) && !isCross(b);
}

// 눈이 오면 주변 지표에 조금씩 쌓인다 (비가 오면 다시 녹는다)
  if (playing && S.weatherMix > 0.4) {
    S.snowTimer -= dt;
    if (S.snowTimer <= 0) {
      S.snowTimer = 0.45;
      var sx0 = Math.floor(player.pos.x), sz0 = Math.floor(player.pos.z);
      for (var t2 = 0; t2 < 10; t2++) {
        var ax3 = sx0 + ((Math.random() * 33) | 0) - 16;
        var az3 = sz0 + ((Math.random() * 33) | 0) - 16;
        if (ax3 < 0 || ax3 >= WX || az3 < 0 || az3 >= WZ) continue;
        var ty3 = topMap[az3 * WX + ax3];
        if (ty3 < 0 || ty3 + 1 >= WY) continue;
        var tb3 = world[idx(ax3, ty3, az3)];
        // 사람이 손댄 칸은 날씨가 건드리지 않는다 — 크리에이티브에서
        // 세계가 내 건축물을 말없이 개조하는 것만큼 신뢰를 깨는 게 없다
        if (isTouched(ax3, ty3, az3)) continue;
        // 눈은 드러난 것 위라면 어디에나 쌓인다 — 풀·흙만 하얘지면 설원(지도의 30%)은
        // 겉이 이미 눈이라 5분을 서 있어도 세계가 31칸밖에 안 바뀌었다.
        // 돌 봉우리·자갈길·모래톱이 하얘지는 것이 "눈이 왔다" 의 실체다 (자문 12차 #9).
        if (S.weather === 2 && snowSticksTo(tb3) && shape[idx(ax3, ty3, az3)] === SH_FULL) {
          // 위에 얹는다 (덮어쓰지 않는다)
          if (ty3 + 1 < WY && world[idx(ax3, ty3 + 1, az3)] === AIR)
            // record=false — 날씨가 되돌리기 기록을 먹으면 안 되고, markTouched 를 찍으면
            // 자기가 쌓은 눈을 자기가 "사람이 손댄 칸" 으로 보고 영영 못 녹인다
            applyEdit(ax3, ty3 + 1, az3, SNOW, false, SH_SLAB);   // 반블록 두께 — 걸어서 넘는다
        } else if (S.weather === 1 && tb3 === SNOW && biomeMap[az3 * WX + ax3] !== 1) {
          applyEdit(ax3, ty3, az3, AIR, false);      // 쌓인 눈만 녹는다
        }
      }
    }
  }

  // 설원 수면은 몇 초 뒤에 언다
  S.freezeTimer += dt;
  if (S.freezeTimer > 2.2) { S.freezeTimer = 0; freezeTick(200); }

  // 잎은 시차를 두고 조금씩 떨어진다
  if (Q.decayHead < Q.decayQ.length) {
    Q.decayTimer += dt;
    if (Q.decayTimer > 0.22) { Q.decayTimer = 0; decayTick(3); }
  }

  // 빛 전체 재계산이 예약된 경우에만 (평소엔 편집 시 국소 계산이 처리한다)
  if (S.relightQueued) {
    S.relightQueued = false;
    relightAll(true);
  }

  // 청크 재생성 — 프레임당 8ms 예산
  setBuildFocus(camera.position);
  buildBudget(8);
  // 청크 기둥마다 "그 16×16 안에서 가장 낮은 지표" 를 1초에 한 번 다시 잰다 —
  // 9,216칸을 훑어도 0.05ms 다. 그 사이 잠깐 낡아도 눈에 안 보인다.
  S.floorTimer = (S.floorTimer || 0) + dt;
  if (S.floorTimer > 1 || !S.floorReady) { S.floorTimer = 0; refreshChunkFloor(); }
  // 굴 어귀 덩어리 — 2초에 한 번 다시 묶는다 (9,216 기둥 훑기 · 1ms 남짓)
  S.mouthTimer = (S.mouthTimer || 0) + dt;
  if (S.mouthTimer > 2 || !S.mouthReady) {
    S.mouthTimer = 0; S.mouthReady = true; refreshMouthDots();
  }
  var eyeCx = Math.floor(camera.position.x), eyeCz = Math.floor(camera.position.z);
  var eyeTop = (eyeCx >= 0 && eyeCx < WX && eyeCz >= 0 && eyeCz < WZ)
    ? topMap[eyeCz * WX + eyeCx] : -1;
  updateChunkVisibility(eyeInLiquid ? 26 : farNow(), chunkFloor,
                        camera.position.y > eyeTop + 1,
                        eyeTop - camera.position.y > DEEP_UNDER);
  updateOuterSea(camera.position.y);      // 물속에서는 바깥 바다 판을 감춘다

  // 플레이 시간과 상황별 도전 과제
  if (playing) {
    S.playSeconds += dt;
    S.achTimer -= dt;
    if (S.achTimer <= 0) {
      S.achTimer = 0.5;
      // 걸은 거리를 0.5초마다 모은다. 20칸이 넘는 도약은 순간이동이라 세지 않는다.
      if (S.achPrevX !== null) {
        var mvx = player.pos.x - S.achPrevX, mvz = player.pos.z - S.achPrevZ;
        var mvd = Math.sqrt(mvx * mvx + mvz * mvz);
        if (mvd < 20) S.walked += mvd;
      }
      S.achPrevX = player.pos.x; S.achPrevZ = player.pos.z;
      // 첫 과제가 "가만히 서 있었더니 열렸다" 면 과제를 안 믿게 된다 —
      // 발밑을 보는 과제는 스폰 자리에서 8칸은 움직인 뒤부터 센다
      var moved = S.walked >= 8;

      if (player.pos.y < 3) unlock("deep");
      if (moved && get(Math.floor(player.pos.x), Math.floor(player.pos.y - 0.1),
              Math.floor(player.pos.z)) === ICE) unlock("ice");
      // 꼭대기 — **딛고 서야** 한다. 예전에는 "높이 50 위" 라 크리에이티브에서는
      // 그냥 위로 날면 열렸고, 반대로 산은 아무리 올라도 안 열렸다
      // (최고봉이 판 1 은 20~32 · 판 2 는 32~44 다). 해수면 기준으로 옮긴다.
      // 스폰 높이가 26~36 이라 `SEA + 9`(32)는 **시작하자마자 저절로 열렸다** —
      // 8시드 중 2개가 선 자리에서 이미 달성이었다. 게임이 처음 건네는 말이
      // 가만히 서 있는 것에 대한 상장이면 안 된다 (자문 17차 #9).
      // 걸어야 하고(`moved`) 최고봉(32~44) 언저리여야 한다.
      if (moved && !player.flying && player.onGround && player.pos.y > SEA + 15) unlock("high");
      if (!S.earned.cartographer && seenRatio() > 0.8) unlock("cartographer");
      var lb = localBiome();
      if (moved && lb === 1) unlock("snow");
      if (moved && lb === 2) unlock("desert");
      // 지은 것을 보는 과제는 훨씬 무거우니 10초에 한 번만
      S.buildAchTimer = (S.buildAchTimer || 0) + 0.5;
      if (S.buildAchTimer >= 10) {
        S.buildAchTimer = 0;
        checkBuildAchievements();
        checkFoundAchievements();     // 세계가 지어 둔 것을 찾았나 (v83)
      }
      if (dayLight(S.timeOfDay) < 0.2) {
        var ax2 = Math.max(0, Math.min(WX - 1, Math.floor(player.pos.x)));
        var az2 = Math.max(0, Math.min(WZ - 1, Math.floor(player.pos.z)));
        var ay2 = Math.max(0, Math.min(WY - 1, Math.floor(player.pos.y + 1)));
        if (lightSky[idx(ax2, ay2, az2)] === 15) unlock("night");
      }
    }
  }

  if (S.worldDirty) {
    S.saveTimer += dt;
    if (S.saveTimer > (opts.autosave || 20)) { saveGame(); S.saveTimer = 0; }
  } else S.saveTimer = 0;

  if (S.toastTimer > 0) {
    S.toastTimer -= dt;
    if (S.toastTimer <= 0) toastEl.classList.remove("on");
  }
}

export function animate() {
  requestAnimationFrame(animate);
  var dt = Math.min(clock.getDelta(), 0.05);
  if (S.loopPaused) return;
  pollGamepadMenu();          // 시작 화면에서 A 로 들어올 수 있게
  step(dt);

  renderer.render(scene, camera);
  // F2 — 지금 그린 화면을 그대로 저장한다 (렌더 직후에만 버퍼가 살아 있다)
  if (S.wantShot) {
    S.wantShot = false;
    try {
      // 스크린샷에 시드와 좌표를 새겨 둔다 — 나중에 그 자리를 다시 찾을 수 있게
      var src = renderer.domElement;
      var cv = document.createElement("canvas");
      cv.width = src.width; cv.height = src.height;
      var cc = cv.getContext("2d");
      cc.drawImage(src, 0, 0);
      var pad = Math.max(10, Math.round(cv.height * 0.018));
      cc.font = Math.max(11, Math.round(cv.height * 0.020)) + "px ui-monospace, monospace";
      cc.textBaseline = "bottom";
      var stampTxt = "SEED " + S.worldSeed + "   " +
        Math.floor(player.pos.x) + " " + Math.floor(player.pos.y) + " " + Math.floor(player.pos.z) +
        "   " + clockText();
      cc.fillStyle = "rgba(0,0,0,.55)";
      var w = cc.measureText(stampTxt).width;
      cc.fillRect(pad - 6, cv.height - pad - 22, w + 12, 26);
      cc.fillStyle = "#f0ece1";
      cc.fillText(stampTxt, pad, cv.height - pad);

      var a = document.createElement("a");
      a.href = cv.toDataURL("image/png");
      a.download = "blockyard-" + Date.now() + ".png";
      a.click();
      toast("화면을 저장했습니다");
      if (S.photoMode) unlock("photo");
    } catch (e) { toast("화면 저장에 실패했습니다"); }
  }

  if (!S.thirdPerson) {
    renderer.autoClear = false;
    renderer.clearDepth();
    renderer.render(handScene, handCam);
    renderer.autoClear = true;
  }

  S.fpsAccum += dt; S.fpsFrames++; S.hudTimer += dt; S.mmTimer += dt;
  // 최근 1초의 최악 프레임 — 평균 FPS 는 한 번 턱 걸리는 것을 뭉갠다
  var ms = dt * 1000;
  if (ms > S.worstAcc) S.worstAcc = ms;
  if (S.hudTimer > 0.25) { S.worstMs = Math.max(S.worstMs * 0.5, S.worstAcc); S.worstAcc = 0; }
  if (S.hudTimer > 0.25) {
    tPos.textContent = Math.floor(player.pos.x) + " · " + Math.floor(player.pos.y) + " · " + Math.floor(player.pos.z);
    // 저장이 실패한 채면 시각 대신 그것부터 말한다 (v100) — 1.6초 토스트는 놓친다
    tTime.textContent = S.saveFailed ? "⚠ 저장 안 됨" : clockText();
    tFace.textContent = facingText();
    tBiome.textContent = BIOME_NAMES[localBiome()] + " · 청크 " +
      ((player.pos.x / CH) | 0) + "," + ((player.pos.z / CH) | 0);
    // 조준한 칸의 밝기까지 보여 준다 — 서 있는 자리 값만으로는
    // 저 구석이 어두운지 알 수가 없어 횃불을 어디 달지 못 정한다
    // 조준한 칸 **앞면**의 밝기 — 거기가 횃불을 놓을 자리다.
    // 이 프레임에서 이미 쏜 hit 을 쓴다 (레이캐스트를 두 번 할 이유가 없다)
    var af = S.aimFace;
    if (af && inside(af[0], af[1], af[2])) {
      var ai = idx(af[0], af[1], af[2]);
      tLight.textContent = lightAtPlayer() + " / 15 · 조준 " +
        Math.max(lightSky[ai] || 0, lightBlk[ai] || 0);
    } else tLight.textContent = lightAtPlayer() + " / 15";
    // 조준한 칸의 **좌표** (v93) — 내 좌표는 있는데 겨누는 칸의 좌표가 없어서,
    // 기둥 두 개를 x=30·50 에 맞추려면 거기까지 날아가 읽고 돌아와야 했다.
    // 영역·청사진·미러가 다 칸 좌표로 도는데 화면이 그 단위를 안 알려 줬다.
    // 앞의 것이 놓일 자리(af), 괄호 안이 겨눈 블록이다
    if (tAim) {
      var hitNow = S.aimHit;
      tAim.textContent = af
        ? (af[0] + " · " + af[1] + " · " + af[2] +
           (hitNow ? "  (" + hitNow[0] + " · " + hitNow[1] + " · " + hitNow[2] + ")" : ""))
        : "—";
    }
    // 고른 영역의 크기 — 토스트 2.5초가 지나면 어디에도 안 남아 있었다 (v98).
    // 20×20 인지 21×20 인지 알려면 모서리를 다시 찍어야 했다
    if (S.selA || S.selB) tMode.textContent = "영역 " + selectionText();
    else tMode.textContent = player.flying ? "비행" : (S.wasUnderwater ? "헤엄" : "걷기");
    tShape.textContent = ["전체", "반블록", "계단"][S.shapeMode];
    tBlocks.innerHTML = "놓음 <b>" + stats.placed + "</b> · 캔 <b>" + stats.mined + "</b>";
    tAch.innerHTML = "<b>" + achCount() + "</b> / " + ACHIEVEMENTS.length;
    var fps = Math.round(S.fpsFrames / S.fpsAccum);
    tFps.textContent = fps;
    autoTuneFar(fps);
    S.fpsAccum = 0; S.fpsFrames = 0; S.hudTimer = 0;
    if (S.showPerf) refreshPerf();
  }
  if (S.mmTimer > 0.2 && S.active) {
    drawMinimap();
    refreshMinimapCap();
    S.mmTimer = 0;
  }
}

// 성능 정보 (F3) — 눈으로 확인할 수 있게 따로 떼어 두었다
// 프레임이 계속 낮으면 시야거리를 스스로 줄이고, 넉넉해지면 되돌린다
// 자동 조절은 **이번 실행에만** 적용한다. `opts.far` 를 건드려 저장하면
// 세션마다 한 단계씩 영구히 깎여 되돌아오지 못한다 (실제로 그랬다).
export function autoTuneFar(fps) {
  if (!S.autoPerf) return;
  var want = opts.far;                      // 사용자가 슬라이더로 정한 값 — 절대 안 바꾼다
  if (S.farNow <= 0) S.farNow = want;
  if (S.farNow > want) S.farNow = want;
  if (fps < 32 && S.farNow > 40) {
    S.perfDrop = (S.perfDrop || 0) + 1;
    if (S.perfDrop >= 3) {
      S.perfDrop = 0;
      S.farNow = Math.max(40, S.farNow - 15);
      toast("프레임이 낮아 시야거리를 " + S.farNow + "m 로 줄였습니다 (설정은 그대로)");
    }
  } else if (fps > 55 && S.farNow < want) {
    S.perfDrop = 0;
    S.farNow = Math.min(want, S.farNow + 10);
  } else S.perfDrop = 0;
}
// 지금 실제로 쓰는 시야 거리
export function farNow() { return S.farNow > 0 ? Math.min(S.farNow, opts.far) : opts.far; }

export function refreshPerf() {
  var vis = 0, tris = 0;
  for (var pi = 0; pi < opaqueMeshes.length; pi++) {
    if (!opaqueMeshes[pi].visible) continue;
    vis++;
    var ix = opaqueMeshes[pi].geometry.getIndex();
    if (ix) tris += ix.count / 3;
  }
  perfEl.innerHTML =
    "청크   <b>" + vis + "</b> / " + opaqueMeshes.length + "\n" +
    "삼각형 <b>" + tris.toLocaleString("ko-KR") + "</b>\n" +
    "굽는중 <b>" + dirty.size + "</b>\n" +
    "물     <b>" + (Q.waterQ.length - Q.waterHead) + "</b>  낙하 " + (Q.fallQ.length - Q.fallHead) + "\n" +
    "잎     <b>" + (Q.decayQ.length - Q.decayHead) + "</b>\n" +
    // 자동 조절이 줄여 놓았는데 설정값을 찍으면, 원인을 보러 연 화면이 원인을 가린다.
    // ("120m 인데 왜 이렇게 뿌옇지" 가 된다)
    "시야   <b>" + Math.round(farNow()) + "</b>m" +
      (Math.round(farNow()) < opts.far ? " (자동 · 설정 " + opts.far + ")" : "") +
      "  DPR " + renderer.getPixelRatio().toFixed(2) + "\n" +
    // 사람이 성능을 느끼는 단위는 평균 FPS 가 아니라 **한 번 멈추는 순간**이다.
    // 0.25초 평균은 117ms 짜리 한 프레임을 58 FPS 로 뭉갠다.
    "최악   <b>" + Math.round(S.worstMs) + "</b>ms (최근 1초)";
}
