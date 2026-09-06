// loop.js — 게임 루프
import { S } from "./state.js";
import { padState, pollGamepad, pollGamepadMenu } from "./input.js";
import { breedTick, pushOutOfMobs, seedFlocks, seedMobs, updateFlocks, updateMobs } from "./mobs.js";
import { Q, resetQueues } from "./queues.js";
import { CH, WX, WY, WZ, idx } from "./dims.js";
import { reduceMotion } from "./boot.js";
import { SH_SLAB, AIR, DEFAULT_BAR, DIRT, GRASS, ICE, LAVA, SNOW, TORCH, WATER, hardnessOf, isClimbable, isCross, isSolid, isUnbreakable } from "./blocks.js";
import { animateLiquids, crackTex } from "./atlas.js";
import { seenRatio, BIOME_NAMES, biomeMap, crossBase, generate, get, isTouched, set, shape, topMap, world } from "./world.js";
import { lightAtPlayer, lightSky, relightAll } from "./light.js";
import { lavaFlowTick, lavaDryTick, grassTick, lavaTick, primeTick, TNT_FUSE, decayTick, dryTick, fallTick, fireTick, freezeTick, waterTick } from "./fluids.js";
import { buildBudget, dirty, markAllDirty, opaqueMeshes, setBuildFocus } from "./mesh.js";
import { updateOuterSea, primedBoxes, HL_CROSS, HL_GEO, SHAPE_BOUNDS, burst, camera, cloudGroup, cloudGroupHigh, crackMat, crackMesh, highlight, renderer, scene, sky, updateChunkVisibility, updateEdge, updateParticles, updateSelectionBox, voxUniforms } from "./scene.js";
import { applyTime, clockText, dayLight } from "./daynight.js";
import { opts } from "./settings.js";
import { EYE, HALF, moveAxis, moveHorizontal, player, pointSolid, raycast, spawn, stats, unstick } from "./player.js";
import { at, caveSound, crunch, lavaHiss, lavaPop, listenAt, miningSound, moodChord, setMuffle, stepSound, tone, updateAmbient } from "./audio.js";
import { saveGame } from "./save.js";
import { checkBuildAchievements, ACHIEVEMENTS, achCount, applyEdit, refreshAchList, refreshStats, selectionBounds, unlock } from "./edit.js";
import { airBar, airEl, drawMinimap, facingText, mmCap, perfEl, refreshBar, tAch, tBiome, tBlocks, tFace, tFps, tLight, tMode, tPos, tShape, tTime, toast, toastEl, inblockEl, underwaterEl } from "./hud.js";
import { ghostMesh, handCam, handScene, triggerSwing, updateGhost, updateHand, updateHandBlock } from "./hand.js";
import { canPlaceAt, mineAt, place, upperFromHit } from "./mine.js";
import { localBiome, seedCreatures, setWeather, updateCreatures, updateSkyBodies, updateStorm, updateWeather } from "./sky.js";

export var GRAVITY = 26, JUMP = 8.4, WALK = 4.6, SPRINT = 6.0, FLY = 12;
// 우클릭을 누르고 있을 때 — 두 번째가 나가기까지 뜸(초) · 그 뒤 반복 간격(초)
export var PLACE_DELAY = 0.50, PLACE_REPEAT = 0.35;
export var SNEAK_MUL = 0.32; // 웅크릴 때 이동 배율
export var AIR_CONTROL = 0.24; // 공중에서는 방향을 거의 못 바꾼다
export var fwd = new THREE.Vector3(), right = new THREE.Vector3();
export var clock = new THREE.Clock();

export function newWorld(seed) {
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
  S.shapeMode = 0;
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
  seedCreatures();
  S.worldDirty = true;
  saveGame();
  mmCap.textContent = "SEED " + S.worldSeed;
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

  if (opts.day > 0) {
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
    S.sneaking = crouchKey && !player.flying;
    if (iz <= 0.1) S.sprintTap = false;                    // 전진을 멈추면 더블탭 달리기 해제
    var sprinting = !S.sneaking && iz > 0.1 &&
                    (S.sprintTap || !!(S.keys.ControlLeft || S.keys.ControlRight));
    S.sprintingNow = sprinting;

    var speed = player.flying ? FLY * S.flySpeed
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
      player.vel.y = ((S.keys.Space ? 1 : 0) - (crouchKey ? 1 : 0)) * FLY * S.flySpeed;
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

  if (!playing) { S.sneaking = false; S.sprintingNow = false; }

  // 카메라
  var bobY = 0, bobX = 0;
  if (!reduceMotion && S.bobAmount > 0.001) {
    bobY = Math.sin(S.bobPhase) * 0.055 * S.bobAmount;
    bobX = Math.cos(S.bobPhase * 0.5) * 0.035 * S.bobAmount;
  }
  var sneakTarget = (S.sneaking && player.onGround) ? 0.22 : 0;
  S.sneakEye += (sneakTarget - S.sneakEye) * Math.min(1, dt * 12);

  // 달리는 중이라는 유일한 시각 신호 — 시야각이 살짝 넓어진다
  var fovTarget = opts.fov + (S.sprintingNow ? 5.5 : 0);
  if (S.fovNow === 0) S.fovNow = camera.fov;
  if (Math.abs(S.fovNow - fovTarget) > 0.02) {
    S.fovNow += (fovTarget - S.fovNow) * Math.min(1, dt * 8);
    camera.fov = S.fovNow;
    camera.updateProjectionMatrix();
  }

  camera.position.set(player.pos.x + bobX * 0.4,
                      player.pos.y + EYE - S.sneakEye + bobY, player.pos.z);
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
  updateSkyBodies();
  updateWeather(dt);
  updateStorm(dt);
  updateEdge(player.pos.x, player.pos.z);
  updateSelectionBox(selectionBounds());
  updateCreatures(dt);
  updateMobs(dt);
  if (breedTick(dt)) unlock("breed");
  updateFlocks(dt);

  if (!reduceMotion) {
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
  if (hit) {
    highlight.visible = true;
    if (isCross(hit.block)) {
      highlight.geometry = HL_CROSS[hit.block] || HL_GEO[0];
      highlight.position.set(hit.x, crossBase(hit.x, hit.y, hit.z), hit.z);
    } else {
      highlight.geometry = HL_GEO[hit.shape] || HL_GEO[0];
      highlight.position.set(hit.x, hit.y, hit.z);
    }
    var gx = hit.x + hit.nx, gy = hit.y + hit.ny, gz = hit.z + hit.nz;
    if (canPlaceAt(gx, gy, gz)) updateGhost(gx, gy, gz, upperFromHit(hit));
    else ghostMesh.visible = false;
  } else {
    highlight.visible = false;
    ghostMesh.visible = false;
  }

  var wantBreak = playing && (S.touchBreak || (S.lockMode ? S.mouseDown[0]
                              : (S.dragging && S.dragBtn === 0 && S.dragDist < 7)));
  if (wantBreak && hit && hit.y > 0 && !isUnbreakable(hit.block)) {
    if (!S.breaking.on || S.breaking.x !== hit.x || S.breaking.y !== hit.y || S.breaking.z !== hit.z) {
      S.breaking.on = true; S.breaking.x = hit.x; S.breaking.y = hit.y; S.breaking.z = hit.z;
      S.breaking.t = 0; S.breaking.need = hardnessOf(hit.block); S.breaking.stage = -1;
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
    if (eyeInWater && S.oxygen <= 0) player.vel.y = Math.max(player.vel.y, 2.4);
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

  // 동굴 울림 — 깊고 어두운 곳에서만
  S.caveTimer -= dt;
  if (S.caveTimer <= 0) {
    S.caveTimer = 7 + Math.random() * 12;
    if (playing && player.pos.y < 22 && lightAtPlayer() <= 4) {
      caveSound(Math.min(1, (22 - player.pos.y) / 18));
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

  // 바닷물 흐름
  S.waterTimer += dt;
  if (S.waterTimer > 0.15) {
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

  // 눈이 오면 주변 지표에 조금씩 쌓인다 (비가 오면 다시 녹는다)
  if (playing && S.weatherMix > 0.4) {
    S.snowTimer -= dt;
    if (S.snowTimer <= 0) {
      S.snowTimer = 0.45;
      var sx0 = Math.floor(player.pos.x), sz0 = Math.floor(player.pos.z);
      for (var t2 = 0; t2 < 6; t2++) {
        var ax3 = sx0 + ((Math.random() * 33) | 0) - 16;
        var az3 = sz0 + ((Math.random() * 33) | 0) - 16;
        if (ax3 < 0 || ax3 >= WX || az3 < 0 || az3 >= WZ) continue;
        var ty3 = topMap[az3 * WX + ax3];
        if (ty3 < 0 || ty3 + 1 >= WY) continue;
        var tb3 = world[idx(ax3, ty3, az3)];
        // 사람이 손댄 칸은 날씨가 건드리지 않는다 — 크리에이티브에서
        // 세계가 내 건축물을 말없이 개조하는 것만큼 신뢰를 깨는 게 없다
        if (isTouched(ax3, ty3, az3)) continue;
        if (S.weather === 2 && (tb3 === GRASS || tb3 === DIRT)) {
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
  updateChunkVisibility(eyeInLiquid ? 26 : farNow());
  updateOuterSea(camera.position.y);      // 물속에서는 바깥 바다 판을 감춘다

  // 플레이 시간과 상황별 도전 과제
  if (playing) {
    S.playSeconds += dt;
    S.achTimer -= dt;
    if (S.achTimer <= 0) {
      S.achTimer = 0.5;
      if (player.pos.y < 3) unlock("deep");
      if (get(Math.floor(player.pos.x), Math.floor(player.pos.y - 0.1),
              Math.floor(player.pos.z)) === ICE) unlock("ice");
      if (player.pos.y > 50) unlock("high");
      if (!S.earned.cartographer && seenRatio() > 0.8) unlock("cartographer");
      var lb = localBiome();
      if (lb === 1) unlock("snow");
      if (lb === 2) unlock("desert");
      // 지은 것을 보는 과제는 훨씬 무거우니 10초에 한 번만
      S.buildAchTimer = (S.buildAchTimer || 0) + 0.5;
      if (S.buildAchTimer >= 10) { S.buildAchTimer = 0; checkBuildAchievements(); }
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
  if (S.hudTimer > 0.25) {
    tPos.textContent = Math.floor(player.pos.x) + " · " + Math.floor(player.pos.y) + " · " + Math.floor(player.pos.z);
    tTime.textContent = clockText();
    tFace.textContent = facingText();
    tBiome.textContent = BIOME_NAMES[localBiome()] + " · 청크 " +
      ((player.pos.x / CH) | 0) + "," + ((player.pos.z / CH) | 0);
    tLight.textContent = lightAtPlayer() + " / 15";
    tMode.textContent = player.flying ? "비행" : (S.wasUnderwater ? "헤엄" : "걷기");
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
    mmCap.textContent = (S.mmUnder ? ("단면 Y" + Math.floor(player.pos.y))
                                   : ("SEED " + S.worldSeed))
                        + (S.mmZoom > 1 ? "  ×" + S.mmZoom : "");
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
    "시야   <b>" + opts.far + "</b>m  DPR " + renderer.getPixelRatio().toFixed(2);
}
