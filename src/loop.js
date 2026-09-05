// loop.js — 게임 루프
import { S } from "./state.js";
import { Q, resetQueues } from "./queues.js";
import { WX, WY, WZ, idx } from "./dims.js";
import { reduceMotion } from "./boot.js";
import { DEFAULT_BAR, ICE, LAVA, WATER, hardnessOf, isCross, isUnbreakable } from "./blocks.js";
import { crackTex } from "./atlas.js";
import { crossBase, generate, get, set, shape } from "./world.js";
import { lightAtPlayer, lightSky, relightAll } from "./light.js";
import { decayTick, dryTick, fallTick, waterTick } from "./fluids.js";
import { buildBudget, markAllDirty } from "./mesh.js";
import { HL_CROSS, HL_GEO, SHAPE_BOUNDS, burst, camera, cloudGroup, crackMat, crackMesh, highlight, renderer, scene, sky, updateChunkVisibility, updateParticles, voxUniforms } from "./scene.js";
import { applyTime, clockText, dayLight } from "./daynight.js";
import { opts } from "./settings.js";
import { EYE, moveAxis, moveHorizontal, player, raycast, spawn, stats } from "./player.js";
import { crunch, lavaHiss, lavaPop, miningSound, stepSound, tone, updateAmbient } from "./audio.js";
import { saveGame } from "./save.js";
import { refreshAchList, refreshStats, unlock } from "./edit.js";
import { drawMinimap, facingText, mmCap, refreshBar, tBlocks, tFace, tFps, tLight, tMode, tPos, tShape, tTime, toast, toastEl, underwaterEl } from "./hud.js";
import { ghostMesh, handCam, handScene, triggerSwing, updateGhost, updateHand, updateHandBlock } from "./hand.js";
import { canPlaceAt, mineAt, place, upperFromHit } from "./mine.js";
import { localBiome, seedCreatures, setWeather, updateCreatures, updateSkyBodies, updateWeather } from "./sky.js";

export var GRAVITY = 26, JUMP = 8.4, WALK = 4.6, SPRINT = 6.0, FLY = 12;
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
  refreshAchList(); refreshStats();
  S.timeOfDay = 0.30;
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
  var eyeInWater = eyeBlock === WATER;
  var eyeInLava = eyeBlock === LAVA;
  var eyeInLiquid = eyeInWater || eyeInLava;
  var feetInWater = feetBlock === WATER || feetBlock === LAVA;   // 용암은 물보다 더 끈적하다
  var thick = feetBlock === LAVA;

  if (opts.day > 0) S.timeOfDay = (S.timeOfDay + dt / (opts.day * 60)) % 1;
  applyTime();
  voxUniforms.uTime.value += dt;

  if (playing) {
    fwd.set(-Math.sin(player.yaw), 0, -Math.cos(player.yaw));
    right.set(Math.cos(player.yaw), 0, -Math.sin(player.yaw));

    var ix = ((S.keys.KeyD || S.keys.ArrowRight) ? 1 : 0) - ((S.keys.KeyA || S.keys.ArrowLeft) ? 1 : 0);
    var iz = ((S.keys.KeyW || S.keys.ArrowUp) ? 1 : 0) - ((S.keys.KeyS || S.keys.ArrowDown) ? 1 : 0);
    if (S.stick.x || S.stick.z) { ix = S.stick.x; iz = S.stick.z; }
    // Shift 는 웅크리기(마크식) · 달리기는 Ctrl 또는 W 더블탭
    var crouchKey = !!(S.keys.ShiftLeft || S.keys.ShiftRight);
    S.sneaking = crouchKey && !player.flying;
    if (iz <= 0.1) S.sprintTap = false;                    // 전진을 멈추면 더블탭 달리기 해제
    var sprinting = !S.sneaking && iz > 0.1 &&
                    (S.sprintTap || !!(S.keys.ControlLeft || S.keys.ControlRight));
    S.sprintingNow = sprinting;

    var speed = player.flying ? FLY
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
      player.vel.y = ((S.keys.Space ? 1 : 0) - (crouchKey ? 1 : 0)) * FLY;
    } else {
      player.vel.y -= GRAVITY * dt * (feetInWater ? (thick ? 0.14 : 0.22) : 1);
      if (feetInWater) {
        player.vel.y = Math.max(player.vel.y, thick ? -1.4 : -2.6);
        // 수면 위로 계속 튀어 오르지 않도록 — 눈이 물 밖이면 상승을 억제한다
        if (S.keys.Space) player.vel.y = eyeInLiquid ? (thick ? 2.4 : 4.4) : 0.9;
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

    if (player.onGround && !S.wasOnGround && fallSpeed < -6 && !feetInWater) {
      crunch(0.12, Math.min(0.22, Math.abs(fallSpeed) * 0.014), 700);
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
        stepSound(get(Math.floor(player.pos.x), Math.floor(player.pos.y - 0.1), Math.floor(player.pos.z)));
      }
    }
    S.bobPhase = S.stepPhase;

    S.placeCooldown -= dt;
    if (S.lockMode && S.mouseDown[2] && S.placeCooldown <= 0) { place(); S.placeCooldown = 0.2; }
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
  camera.rotation.z = bobX * 0.12;
  sky.position.copy(camera.position);
  updateHand(dt);
  updateSkyBodies();
  updateWeather(dt);
  updateCreatures(dt);

  if (!reduceMotion) {
    cloudGroup.position.x += dt * 0.9;
    if (cloudGroup.position.x > 220) cloudGroup.position.x -= 440;
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
    voxUniforms.uFogNear.value = Math.max(8, opts.far * 0.35 * wf);
    voxUniforms.uFogFar.value = opts.far * wf;
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

  // 용암이 가까우면 주기적으로 뽀글거린다 — 지하에서 "저쪽에 용암이 있다"를 귀로 알려 준다
  S.lavaTimer -= dt;
  if (S.lavaTimer <= 0) {
    S.lavaTimer = 0.4 + Math.random() * 0.6;
    if (playing) {
      var lx = Math.floor(player.pos.x), ly = Math.floor(player.pos.y), lz = Math.floor(player.pos.z);
      var near = 0;
      for (var ax = -5; ax <= 5; ax++)
        for (var ay = -4; ay <= 4; ay += 2)
          for (var az = -5; az <= 5; az++)
            if (get(lx + ax, ly + ay, lz + az) === LAVA) near++;
      if (near > 0) { lavaPop(Math.min(1, 0.25 + near / 30)); unlock("lava"); }
    }
  }
  if (thick && !S.wasInLavaFeet) lavaHiss();
  S.wasInLavaFeet = thick;

  // 바닷물 흐름
  S.waterTimer += dt;
  if (S.waterTimer > 0.15) {
    S.waterTimer = 0;
    dryTick(300);
    waterTick(300);
    fallTick(200);
  }

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
  buildBudget(8);
  updateChunkVisibility(eyeInLiquid ? 26 : opts.far);

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
      var lb = localBiome();
      if (lb === 1) unlock("snow");
      if (lb === 2) unlock("desert");
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
    if (S.saveTimer > 20) { saveGame(); S.saveTimer = 0; }
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
  step(dt);

  renderer.render(scene, camera);
  renderer.autoClear = false;
  renderer.clearDepth();
  renderer.render(handScene, handCam);
  renderer.autoClear = true;

  S.fpsAccum += dt; S.fpsFrames++; S.hudTimer += dt; S.mmTimer += dt;
  if (S.hudTimer > 0.25) {
    tPos.textContent = Math.floor(player.pos.x) + " · " + Math.floor(player.pos.y) + " · " + Math.floor(player.pos.z);
    tTime.textContent = clockText();
    tFace.textContent = facingText();
    tLight.textContent = lightAtPlayer() + " / 15";
    tMode.textContent = player.flying ? "비행" : (S.wasUnderwater ? "헤엄" : "걷기");
    tShape.textContent = ["전체", "반블록", "계단"][S.shapeMode];
    tBlocks.innerHTML = "놓음 <b>" + stats.placed + "</b> · 캔 <b>" + stats.mined + "</b>";
    tFps.textContent = Math.round(S.fpsFrames / S.fpsAccum);
    S.fpsAccum = 0; S.fpsFrames = 0; S.hudTimer = 0;
  }
  if (S.mmTimer > 0.2 && S.active) {
    drawMinimap();
    mmCap.textContent = S.mmUnder ? ("단면 Y" + Math.floor(player.pos.y)) : ("SEED " + S.worldSeed);
    S.mmTimer = 0;
  }
}
