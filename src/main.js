// main.js — 조립과 시작
import { S } from "./state.js";
import { MOB_KINDS, birds, fish, mobs, pushOutOfMobs, seedFlocks, seedMobs, updateFlocks, updateMobs } from "./mobs.js";
import { animateLiquids, atlas } from "./atlas.js";
import { Q } from "./queues.js";
import { CH, CX, CY, CZ, LEGACY_WY, N, SEA, WX, WY, WZ, idx, inside } from "./dims.js";
import { AIR, ALL_BLOCKS, BEDROCK, BIRCH_LEAVES, BIRCH_LOG, BRICK, CACTUS, COAL, COBBLE, CROSS, DEADBUSH, DIAMOND, DIRT, DRYGRASS, FENCE, FIRE, FLOWER_R, FLOWER_Y, GATE, GLASS, GOLD, GRASS, GRAVEL, ICE, IRON, LADDER, LAMP, LAVA, LEAVES, LOG, NAMES, PANE, PLANKS, SAND, SHAPE_BOXES, SHAPE_NAMES, SH_AXIS_X, SH_AXIS_Z, SH_FULL, SH_SLAB, SH_STAIR_E, SH_STAIR_N, SH_STAIR_S, SH_STAIR_W, SH_WALL_E, SH_WALL_N, SH_WALL_S, SH_WALL_W, SNOW, SPRUCE_LEAVES, STONE, TALLGRASS, TILES, TNT, TORCH, WATER, WOOL0, WOOL_COLORS, WOOL_COUNT, blocksLight, connectsTo, crossOffset, faceKindFor, hardnessOf, isClimbable, isConnecting, isCross, isFlammable, isLeaf, isLiquid, isLog, isOpenable, isSolid, isTransparent, isUnbreakable, isWallShape, isWool, lightPass, wallShapeFor } from "./blocks.js";
import { biomeMap, boxesAt, crossBase, dynamicBoxes, generate, get, hasDynamicBoxes, heightMap, refreshAllTops, refreshTop, set, shape, shapeAt, surfaceTop, topMap, waterLvl, world } from "./world.js";
import { WATER_DIM, lightBlk, lightSky, relightAll, relightLocal } from "./light.js";
import { BLAST_R, MAXFLOW, decayTick, dryTick, enqueueDryAround, enqueueFall, enqueueWaterAround, explode, fallTick, fireTick, freezeTick, ignite, isFalling, queueLeafDecay, waterTick } from "./fluids.js";
import { FACE_UV, buildBudget, buildChunk, chunkCX, chunkCY, chunkCZ, chunkFilled, chunkId, dirty, glassMeshes, markAllDirty, opaqueMeshes, rebuildAll } from "./mesh.js";
import { FREE_DIST, HL_CROSS, HL_GEO, SHAPE_BOUNDS, burst, camera, cloudGroup, cloudGroupHigh, edgeMat, highlight, skyUniforms, updateChunkVisibility, updateEdge, updateParticles, updateSelectionBox, voxUniforms } from "./scene.js";
import { applyTime, clockText, dayLight } from "./daynight.js";
import { applyOpts, opts } from "./settings.js";
import { EYE, STEP_UP, boxHitsWorld, currentShape, footSupported, moveAxis, moveHorizontal, player, rayBox, raycast, spawn } from "./player.js";
import { breakSound, caveSound, lavaHiss, lavaPop, listenAt, miningSound, moodChord, placeSound, rainHiss, setMuffle, thunder } from "./audio.js";
import { OLD_KEY, SAVE_KEY, SLOTS, backupKey, clearSave, decodeArrB64, decodeWorld, decodeWorldB64, encodeArrB64, encodeWorld, encodeWorldB64, exportWorld, hasBackup, hasSave, importWorldText, liftLegacy, loadGame, pushBackup, restoreBackup, saveGame, slotInfo, slotKey } from "./save.js";
import { ACHIEVEMENTS, REGION_MAX, achCount, applyEdit, beginBatch, copySelection, endBatch, fillSelection, pasteClip, redo, refreshAchList, refreshStats, selectionBounds, selectionSize, undo, unlock } from "./edit.js";
import { airEl, drawIcon, drawMinimap, facingText, helpEl, mmCap, perfEl, refreshBar, selectSlot, showHud, toggleHelp } from "./hud.js";
import { makeBlockGeometry, triggerSwing, updateHand } from "./hand.js";
import { beginPlay, endPlay, hashSeed, pickBlock, refreshMenu, refreshSlots, refreshTerrain } from "./input.js";
import { canPlaceAt, place, tryInteract, upperFromHit } from "./mine.js";
import { HIDE_Y, MOON_PHASES, brightStars, columnTop, moonTex, rPos, seedCreatures, setWeather, updateCreatures, updateSkyBodies, updateStorm, updateWeather, wDraw, wPos } from "./sky.js";
import { SNEAK_MUL, SPRINT, WALK, animate, refreshPerf, step } from "./loop.js";

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
       FLOWER_R: FLOWER_R, FLOWER_Y: FLOWER_Y, TORCH: TORCH,
       CACTUS: CACTUS, DEADBUSH: DEADBUSH, DRYGRASS: DRYGRASS,
       BIRCH_LOG: BIRCH_LOG, BIRCH_LEAVES: BIRCH_LEAVES, SPRUCE_LEAVES: SPRUCE_LEAVES,
       GOLD: GOLD, DIAMOND: DIAMOND, FENCE: FENCE, GATE: GATE,
       PANE: PANE, LADDER: LADDER, TNT: TNT, FIRE: FIRE },
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
  SH: { FULL: SH_FULL, SLAB: SH_SLAB, N: SH_STAIR_N, E: SH_STAIR_E, S: SH_STAIR_S, W: SH_STAIR_W,
        AXIS_X: SH_AXIS_X, AXIS_Z: SH_AXIS_Z, WALL_N: SH_WALL_N, WALL_E: SH_WALL_E,
        WALL_S: SH_WALL_S, WALL_W: SH_WALL_W },
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
  opts: opts, applyOpts: applyOpts, voxUniforms: voxUniforms,

  // ── 개선 v5 에서 추가된 것들
  isUnbreakable: isUnbreakable, columnTop: columnTop, facingText: facingText,
  isCross: isCross, isLiquid: isLiquid, isTransparent: isTransparent,
  atlas: atlas, crossBase: crossBase, surfaceTop: surfaceTop,
  freezeTick: freezeTick, animateLiquids: animateLiquids, setMuffle: setMuffle,
  isLog: isLog, isLeaf: isLeaf, isWallShape: isWallShape, wallShapeFor: wallShapeFor,
  updateStorm: updateStorm, updateEdge: updateEdge, edgeMat: edgeMat,
  updateParticles: updateParticles, boxesAt: boxesAt, dynamicBoxes: dynamicBoxes, hasDynamicBoxes: hasDynamicBoxes,
  skyUniforms: skyUniforms, selectSlot: selectSlot,
  cloudGroup: cloudGroup, applyTime: applyTime,
  explode: explode, ignite: ignite, fireTick: fireTick, BLAST_R: BLAST_R,
  isFlammable: isFlammable, seedFlocks: seedFlocks, updateFlocks: updateFlocks,
  fish: fish, birds: birds, moodChord: moodChord, listenAt: listenAt,
  brightStars: brightStars, refreshTerrain: refreshTerrain,
  isWool: isWool, WOOL0: WOOL0, WOOL_COUNT: WOOL_COUNT, WOOL_COLORS: WOOL_COLORS,
  pushOutOfMobs: pushOutOfMobs, exportWorld: exportWorld, importWorldText: importWorldText,
  hasBackup: hasBackup, restoreBackup: restoreBackup, pushBackup: pushBackup, backupKey: backupKey,
  cloudGroupHigh: cloudGroupHigh, FREE_DIST: FREE_DIST,
  fillSelection: fillSelection, copySelection: copySelection, pasteClip: pasteClip,
  selectionBounds: selectionBounds, selectionSize: selectionSize, REGION_MAX: REGION_MAX,
  beginBatch: beginBatch, endBatch: endBatch, updateSelectionBox: updateSelectionBox,
  mobs: mobs, updateMobs: updateMobs, seedMobs: seedMobs, MOB_KINDS: MOB_KINDS,
  toggleHelp: toggleHelp, helpEl: helpEl,
  isConnecting: isConnecting, isClimbable: isClimbable, isOpenable: isOpenable,
  connectsTo: connectsTo, tryInteract: tryInteract, perfEl: perfEl,
  refreshPerf: refreshPerf,
  slotKey: slotKey, slotInfo: slotInfo, SLOTS: SLOTS, refreshSlots: refreshSlots,
  thunder: thunder, rainHiss: rainHiss,
  crossOffset: crossOffset, faceKindFor: faceKindFor, caveSound: caveSound,
  moonTex: moonTex, MOON_PHASES: MOON_PHASES, airEl: airEl,
  S: S, setZoom: function (z) { S.mmZoom = z; }, burst: burst,
  WATER_DIM: WATER_DIM, showHud: showHud,
  HL_CROSS: HL_CROSS, SHAPE_BOUNDS: SHAPE_BOUNDS,
  lavaPop: lavaPop, lavaHiss: lavaHiss,
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
