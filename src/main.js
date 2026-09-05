// main.js — 조립과 시작
import { S } from "./state.js";
import { Q } from "./queues.js";
import { CH, CX, CY, CZ, LEGACY_WY, N, SEA, WX, WY, WZ, idx, inside } from "./dims.js";
import { AIR, ALL_BLOCKS, BEDROCK, BRICK, COAL, COBBLE, CROSS, DIRT, FLOWER_R, FLOWER_Y, GLASS, GRASS, GRAVEL, ICE, IRON, LAMP, LAVA, LEAVES, LOG, NAMES, PLANKS, SAND, SHAPE_BOXES, SHAPE_NAMES, SH_FULL, SH_SLAB, SH_STAIR_E, SH_STAIR_N, SH_STAIR_S, SH_STAIR_W, SNOW, STONE, TALLGRASS, TILES, TORCH, WATER, blocksLight, hardnessOf, isCross, isLiquid, isSolid, isTransparent, isUnbreakable, lightPass } from "./blocks.js";
import { biomeMap, generate, get, heightMap, refreshAllTops, refreshTop, set, shape, shapeAt, topMap, world, waterLvl } from "./world.js";
import { lightBlk, lightSky, relightAll, relightLocal } from "./light.js";
import { MAXFLOW, decayTick, dryTick, enqueueDryAround, enqueueFall, enqueueWaterAround, fallTick, isFalling, queueLeafDecay, waterTick } from "./fluids.js";
import { FACE_UV, buildBudget, buildChunk, chunkCX, chunkCY, chunkCZ, chunkFilled, chunkId, dirty, glassMeshes, markAllDirty, opaqueMeshes, rebuildAll } from "./mesh.js";
import { HL_GEO, camera, highlight, updateChunkVisibility } from "./scene.js";
import { applyTime, clockText, dayLight } from "./daynight.js";
import { applyOpts, opts } from "./settings.js";
import { EYE, STEP_UP, boxHitsWorld, currentShape, footSupported, moveAxis, moveHorizontal, player, rayBox, raycast, spawn } from "./player.js";
import { breakSound, miningSound, placeSound } from "./audio.js";
import { OLD_KEY, SAVE_KEY, clearSave, decodeArrB64, decodeWorld, decodeWorldB64, encodeArrB64, encodeWorld, encodeWorldB64, hasSave, liftLegacy, loadGame, saveGame } from "./save.js";
import { ACHIEVEMENTS, achCount, applyEdit, redo, refreshAchList, refreshStats, undo, unlock } from "./edit.js";
import { drawIcon, drawMinimap, facingText, mmCap, refreshBar, selectSlot } from "./hud.js";
import { makeBlockGeometry, triggerSwing, updateHand } from "./hand.js";
import { beginPlay, endPlay, hashSeed, pickBlock, refreshMenu } from "./input.js";
import { canPlaceAt, place, upperFromHit } from "./mine.js";
import { HIDE_Y, columnTop, rPos, seedCreatures, setWeather, updateCreatures, updateSkyBodies, updateWeather, wDraw, wPos } from "./sky.js";
import { SNEAK_MUL, SPRINT, WALK, animate, step } from "./loop.js";

applyOpts();
S.loadedFromSave = hasSave() && loadGame();
if (!S.loadedFromSave) generate((Math.random() * 100000) | 0);
relightAll(false);
markAllDirty();
buildBudget(70);          // 첫 화면에 보이는 만큼만 먼저 굽고 나머지는 프레임마다
refreshBar();
selectSlot(0);
applyTime();
mmCap.textContent = "SEED " + S.worldSeed;
drawMinimap();
refreshAchList();
refreshStats();
refreshMenu();
if (!S.loadedFromSave) spawn();

S.savedPos = player.pos.clone(); S.savedYaw = player.yaw; S.savedPitch = player.pitch;
seedCreatures();

// 시작 화면 뒤로 보이는 풍경 — 섬을 내려다보는 위치
player.pos.set(WX / 2 - 26, 34 - EYE, WZ / 2 + 30);
player.yaw = -0.72; player.pitch = -0.42;

// ── 테스트 훅 (헤드리스 검증용)
window.__blockyard = {
  WX: WX, WY: WY, WZ: WZ, CH: CH, CX: CX, CY: CY, CZ: CZ, SEA: SEA, N: N,
  B: { AIR: AIR, GRASS: GRASS, DIRT: DIRT, STONE: STONE, SAND: SAND, LOG: LOG,
       LEAVES: LEAVES, PLANKS: PLANKS, GLASS: GLASS, BRICK: BRICK, WATER: WATER,
       COBBLE: COBBLE, COAL: COAL, IRON: IRON, SNOW: SNOW, LAMP: LAMP, GRAVEL: GRAVEL,
       BEDROCK: BEDROCK, LAVA: LAVA, ICE: ICE, TALLGRASS: TALLGRASS,
       FLOWER_R: FLOWER_R, FLOWER_Y: FLOWER_Y, TORCH: TORCH },
  world: world, lightSky: lightSky, lightBlk: lightBlk,
  topMap: topMap, heightMap: heightMap, biomeMap: biomeMap,
  idx: idx, get: get, set: set, inside: inside, lightPass: lightPass,
  isSolid: isSolid, hardnessOf: hardnessOf,
  generate: generate, relightAll: relightAll, rebuildAll: rebuildAll,
  buildChunk: buildChunk, chunkId: chunkId, chunkCX: chunkCX, chunkCY: chunkCY, chunkCZ: chunkCZ,
  opaqueMeshes: opaqueMeshes, glassMeshes: glassMeshes, dirty: dirty,
  raycast: raycast, boxHitsWorld: boxHitsWorld, moveAxis: moveAxis, moveHorizontal: moveHorizontal,
  player: player, camera: camera, spawn: spawn, refreshTop: refreshTop, refreshAllTops: refreshAllTops,
  applyEdit: applyEdit, undo: undo, redo: redo, history: S.history, future: S.future,
  encodeWorld: encodeWorld, decodeWorld: decodeWorld,
  encodeWorldB64: encodeWorldB64, decodeWorldB64: decodeWorldB64,
  relightLocal: relightLocal, markAllDirty: markAllDirty, buildBudget: buildBudget,
  shape: shape, shapeAt: shapeAt, SHAPE_BOXES: SHAPE_BOXES, FACE_UV: FACE_UV,
  SH: { FULL: SH_FULL, SLAB: SH_SLAB, N: SH_STAIR_N, E: SH_STAIR_E, S: SH_STAIR_S, W: SH_STAIR_W },
  encodeArrB64: encodeArrB64, decodeArrB64: decodeArrB64,
  fallTick: fallTick, enqueueFall: enqueueFall, isFalling: isFalling,
  rayBox: rayBox, canPlaceAt: canPlaceAt, chunkFilled: chunkFilled,
  updateChunkVisibility: updateChunkVisibility, drawMinimap: drawMinimap,
  ACHIEVEMENTS: ACHIEVEMENTS, unlock: unlock, achCount: achCount,
  getEarned: function () { return S.earned; },
  resetAch: function () { S.earned = {}; S.placedKinds = {}; S.lampsPlaced = 0; refreshAchList(); },
  setShapeMode: function (m) { S.shapeMode = m; }, currentShape: currentShape,
  setWeather: function (w) { setWeather(w); }, getWeather: function () { return S.weather; },
  updateWeather: updateWeather, updateCreatures: updateCreatures, updateSkyBodies: updateSkyBodies,
  SAVE_KEY: SAVE_KEY, OLD_KEY: OLD_KEY,
  saveGame: saveGame, loadGame: loadGame, clearSave: clearSave, hasSave: hasSave,
  waterTick: waterTick, enqueueWaterAround: enqueueWaterAround,
  hashSeed: hashSeed, makeBlockGeometry: makeBlockGeometry, drawIcon: drawIcon,
  dayLight: dayLight, clockText: clockText, TILES: TILES, NAMES: NAMES, ALL_BLOCKS: ALL_BLOCKS,
  getBar: function () { return S.bar; },
  setTime: function (t) { S.timeOfDay = t; applyTime(); },
  seed: function () { return S.worldSeed; },
  opts: opts,

  // ── 개선 v5 에서 추가된 것들
  isUnbreakable: isUnbreakable, columnTop: columnTop, facingText: facingText,
  isCross: isCross, isLiquid: isLiquid, isTransparent: isTransparent,
  waterLvl: waterLvl, MAXFLOW: MAXFLOW, dryTick: dryTick, enqueueDryAround: enqueueDryAround,
  decayTick: decayTick, queueLeafDecay: queueLeafDecay, decayQ: Q.decayQ,
  decayPending: function () { return Q.decayQ.length - Q.decayHead; },
  CROSS: CROSS, SHAPE_NAMES: SHAPE_NAMES, upperFromHit: upperFromHit,
  liftLegacy: liftLegacy, LEGACY_WY: LEGACY_WY, blocksLight: blocksLight,
  STEP_UP: STEP_UP, SNEAK_MUL: SNEAK_MUL, WALK: WALK, SPRINT: SPRINT,
  HL_GEO: HL_GEO, highlight: highlight, breaking: S.breaking,
  wPos: wPos, wDraw: wDraw, rPos: rPos, HIDE_Y: HIDE_Y,
  setSneak: function (v) { S.sneaking = !!v; },
  getSneak: function () { return S.sneaking; },
  getSprinting: function () { return S.sprintingNow; },
  setKey: function (code, v) { S.keys[code] = !!v; },
  step: step, footSupported: footSupported,
  placeSound: placeSound, miningSound: miningSound, breakSound: breakSound,
  updateHand: updateHand, getSwing: function () { return S.swing; },
  beginPlay: beginPlay, endPlay: endPlay,
  setPaused: function (v) { S.loopPaused = !!v; },
  isActive: function () { return S.active; },
  triggerSwing: triggerSwing, place: place, pickBlock: pickBlock,
  getSelected: function () { return S.selected; }
};

S.booted = true;
animate();
