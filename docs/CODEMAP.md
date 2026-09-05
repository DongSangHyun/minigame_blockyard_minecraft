<!-- 자동 생성 파일 — 직접 고치지 말고 `node tests/index.mjs` 를 다시 실행하세요 -->
# CODEMAP — index.html 코드 색인

생성일 2026-09-05 · 전체 4,318줄 · 섹션 19개 · 훅 181개

## 섹션 지도

| # | 섹션 | 시작 줄 | 길이 | 주요 함수 |
|---|---|---:|---:|---|
| 1 | 블록 정의 | 554 | 111 | `hardnessOf` · `isUnbreakable` · `isCross` · `needsFloor` · `isLiquid` · `isTransparent` · `isSolid` · `blocksLight` · `lightPass` |
| 2 | 텍스처 아틀라스 | 665 | 292 | `tileOrigin` · `makeRng` · `paint` · `pick` · `orePaint` · `tileAvg` |
| 3 | 월드 데이터 · 지형 생성 (바이옴) | 957 | 235 | `idx` · `inside` · `get` · `set` · `shapeAt` · `refreshTop` · `refreshAllTops` · `hash2` · `hash3` · `smooth` · `lerp` · `noise2` · `noise3` · `generate` |
| 4 | 광원 — 햇빛과 블록광을 BFS 로 전파한다 | 1192 | 170 | `idx3` · `markLightCell` · `spreadLight` · `removeLightBFS` · `relightLocal` · `relightAll` · `relightSoon` · `lightAtPlayer` |
| 5 | 바닷물 흐름 — 해수면 아래 빈칸은 바다와 이어지면 잠긴다 | 1362 | 221 | `enqueueWater` · `enqueueDry` · `enqueueDryAround` · `enqueueWaterAround` · `queueLeafDecay` · `decayTick` · `isFalling` · `enqueueFall` · `fallTick` · `waterTick` · `dryTick` · `get2` · `fedSideways` · `removeWater` |
| 6 | 면 데이터 + 청크 메싱 (16×16×16, 광원 포함) | 1583 | 251 | `aoValue` · `chunkId` · `chunkCX` · `chunkCZ` · `chunkCY` · `buildChunk` · `emitCross` · `applyGeo` · `markDirty` · `touch` · `rebuildAll` · `markAllDirty` · `buildBudget` |
| 7 | 씬 · 셰이더 | 1834 | 245 | `voxMaterial` · `updateChunkVisibility` · `burst` · `updateParticles` |
| 8 | 낮과 밤 | 2079 | 54 | `sampleSky` · `dayLight` · `applyTime` · `clockText` |
| 9 | 설정 | 2133 | 28 | `saveOpts` · `applyOpts` |
| 10 | 플레이어 | 2161 | 215 | `currentShape` · `spawn` · `boxHitsWorld` · `moveAxis` · `footSupported` · `moveHorizontal` · `rayBox` · `raycast` |
| 11 | 소리 | 2376 | 115 | `ac` · `tone` · `crunch` · `startAmbient` · `updateAmbient` · `breakSound` · `stepSound` · `placeSound` · `miningSound` |
| 12 | 저장 · 불러오기 | 2491 | 152 | `hasSave` · `encodeArrB64` · `decodeArrB64` · `encodeWorldB64` · `decodeWorldB64` · `encodeWorld` · `decodeWorld` · `liftLegacy` · `saveGame` · `loadGame` · `clearSave` |
| 13 | 편집 · 되돌리기 | 2643 | 135 | `applyEdit` · `undo` · `redo` · `refreshAchList` · `refreshStats` · `achCount` · `unlock` |
| 14 | HUD · 핫바 · 블록 고르기 · 미니맵 | 2778 | 211 | `drawIcon` · `refreshSlot` · `refreshBar` · `selectSlot` · `openPicker` · `closePicker` · `facingText` · `showHud` · `toast` · `drawMinimap` |
| 15 | 1인칭 손과 들고 있는 블록 | 2989 | 132 | `makeBlockGeometry` · `updateHandBlock` · `updateGhost` · `triggerSwing` · `updateHand` |
| 16 | 입력 | 3121 | 433 | `refreshHint` · `advanceTut` · `refreshMenu` · `beginPlay` · `endPlay` · `useDragMode` · `goFullscreen` · `requestPlay` · `hashSeed` · `applyLook` · `cycleTime` · `pickBlock` · `setStick` · `endTouch` · `bindHold` · `bindOpt` |
| 17 | 캐기 · 놓기 | 3554 | 322 | `mineAt` · `upperFromHit` · `canPlaceAt` · `place` · `discTexture` · `updateSkyBodies` · `columnTop` · `seedWeather` · `setWeather` · `localBiome` · `updateWeather` · `seedCreatures` · `placeCreature` · `updateCreatures` |
| 18 | 루프 | 3876 | 345 | `newWorld` · `step` · `animate` |
| 19 | 시작 | 4221 | 97 | — |

## 함수 → 줄번호

| 함수 | 섹션 | 줄 |
|---|---:|---:|
| `ac()` | 11 | 2379 |
| `achCount()` | 13 | 2759 |
| `advanceTut(step)` | 16 | 3153 |
| `animate()` | 18 | 4189 |
| `aoValue(s1, s2, cor)` | 6 | 1620 |
| `applyEdit(x, y, z, to, record, sh)` | 13 | 2648 |
| `applyGeo(mesh, pos, uv, col, lit, ind)` | 6 | 1785 |
| `applyLook(dx, dy)` | 16 | 3273 |
| `applyOpts()` | 9 | 2152 |
| `applyTime()` | 8 | 2112 |
| `beginPlay()` | 16 | 3173 |
| `bindHold(id, onDown, onUp)` | 16 | 3495 |
| `bindOpt(inputId, outId, key, fmt)` | 16 | 3524 |
| `blocksLight(b)` | 1 | 659 |
| `boxHitsWorld(px, py, pz)` | 10 | 2196 |
| `breakSound(b)` | 11 | 2466 |
| `buildBudget(ms)` | 6 | 1817 |
| `buildChunk(cx, cy, cz)` | 6 | 1633 |
| `burst(x, y, z, blockId, count)` | 7 | 2030 |
| `canPlaceAt(px, py, pz)` | 17 | 3579 |
| `chunkCX(id)` | 6 | 1629 |
| `chunkCY(id)` | 6 | 1631 |
| `chunkCZ(id)` | 6 | 1630 |
| `chunkId(cx, cy, cz)` | 6 | 1628 |
| `clearSave()` | 12 | 2638 |
| `clockText()` | 8 | 2126 |
| `closePicker(resume)` | 14 | 2895 |
| `columnTop(fx, fz)` | 17 | 3720 |
| `crunch(dur, gain, cutoff)` | 11 | 2404 |
| `currentShape(upper)` | 10 | 2173 |
| `cycleTime()` | 16 | 3293 |
| `dayLight(t)` | 8 | 2107 |
| `decayTick(budget)` | 5 | 1429 |
| `decodeArrB64(b64, arr, len)` | 12 | 2522 |
| `decodeWorld(runs, dst, len)` | 12 | 2553 |
| `decodeWorldB64(b64)` | 12 | 2543 |
| `discTexture(size, stops)` | 17 | 3620 |
| `drawIcon(cv, blockId)` | 14 | 2784 |
| `drawMinimap()` | 14 | 2944 |
| `dryTick(budget)` | 5 | 1532 |
| `emitCross(P, U, C, L, I, x, y, z, b, ci)` | 6 | 1754 |
| `encodeArrB64(arr)` | 12 | 2503 |
| `encodeWorld()` | 12 | 2544 |
| `encodeWorldB64()` | 12 | 2542 |
| `endPlay()` | 16 | 3190 |
| `endTouch(e)` | 16 | 3469 |
| `enqueueDry(x, y, z)` | 5 | 1373 |
| `enqueueDryAround(x, y, z)` | 5 | 1377 |
| `enqueueFall(x, y, z)` | 5 | 1448 |
| `enqueueWater(x, y, z)` | 5 | 1369 |
| `enqueueWaterAround(x, y, z)` | 5 | 1381 |
| `facingText()` | 14 | 2908 |
| `fallTick(budget)` | 5 | 1452 |
| `fedSideways(i, y, lvl)` | 5 | 1562 |
| `footSupported(px, py, pz)` | 10 | 2244 |
| `generate(seed)` | 3 | 1028 |
| `get(x, y, z)` | 3 | 975 |
| `get2(i, dx, dy, dz)` | 5 | 1556 |
| `goFullscreen()` | 16 | 3211 |
| `hardnessOf(b)` | 1 | 608 |
| `hash2(x, y, seed)` | 3 | 997 |
| `hash3(x, y, z, seed)` | 3 | 1002 |
| `hashSeed(str)` | 16 | 3251 |
| `hasSave()` | 12 | 2497 |
| `idx(x, y, z)` | 3 | 973 |
| `idx3(x, y, z)` | 4 | 1198 |
| `inside(x, y, z)` | 3 | 974 |
| `isCross(b)` | 1 | 625 |
| `isFalling(b)` | 5 | 1447 |
| `isLiquid(b)` | 1 | 656 |
| `isSolid(b)` | 1 | 658 |
| `isTransparent(b)` | 1 | 657 |
| `isUnbreakable(b)` | 1 | 611 |
| `lerp(a, b, t)` | 3 | 1009 |
| `liftLegacy(src, dst, asRuns)` | 12 | 2568 |
| `lightAtPlayer()` | 4 | 1352 |
| `lightPass(b)` | 1 | 660 |
| `loadGame()` | 12 | 2604 |
| `localBiome()` | 17 | 3751 |
| `makeBlockGeometry(b, sh)` | 15 | 2998 |
| `makeRng(seed)` | 2 | 674 |
| `markAllDirty()` | 6 | 1814 |
| `markDirty(x, y, z)` | 6 | 1799 |
| `markLightCell(i)` | 4 | 1203 |
| `mineAt(hit)` | 17 | 3558 |
| `miningSound(b)` | 11 | 2484 |
| `moveAxis(axis, amount)` | 10 | 2220 |
| `moveHorizontal(dx, dz)` | 10 | 2251 |
| `needsFloor(b)` | 1 | 626 |
| `newWorld(seed)` | 18 | 3892 |
| `noise2(x, y, seed)` | 3 | 1011 |
| `noise3(x, y, z, seed)` | 3 | 1018 |
| `openPicker()` | 14 | 2886 |
| `orePaint(tint1, tint2)` | 2 | 787 |
| `paint(index, fn)` | 2 | 684 |
| `pick(rng, list)` | 2 | 692 |
| `pickBlock()` | 16 | 3305 |
| `place()` | 17 | 3590 |
| `placeCreature(i)` | 17 | 3833 |
| `placeSound(b)` | 11 | 2477 |
| `queueLeafDecay(x, y, z)` | 5 | 1391 |
| `rayBox(o, d, mn, mx, maxT)` | 10 | 2298 |
| `raycast(maxDist)` | 10 | 2315 |
| `rebuildAll()` | 6 | 1809 |
| `redo()` | 13 | 2699 |
| `refreshAchList()` | 13 | 2735 |
| `refreshAllTops()` | 3 | 993 |
| `refreshBar()` | 14 | 2847 |
| `refreshHint()` | 16 | 3150 |
| `refreshMenu()` | 16 | 3166 |
| `refreshSlot(i)` | 14 | 2840 |
| `refreshStats()` | 13 | 2746 |
| `refreshTop(x, z)` | 3 | 985 |
| `relightAll(markChanges)` | 4 | 1307 |
| `relightLocal(x, y, z)` | 4 | 1269 |
| `relightSoon()` | 4 | 1350 |
| `removeLightBFS(arr, start, track)` | 4 | 1239 |
| `removeWater(i, y)` | 5 | 1573 |
| `requestPlay()` | 16 | 3228 |
| `sampleSky(t)` | 8 | 2094 |
| `saveGame()` | 12 | 2583 |
| `saveOpts()` | 9 | 2149 |
| `seedCreatures()` | 17 | 3825 |
| `seedWeather()` | 17 | 3726 |
| `selectSlot(i)` | 14 | 2851 |
| `set(x, y, z, b)` | 3 | 980 |
| `setStick(dx, dy)` | 16 | 3434 |
| `setWeather(w)` | 17 | 3735 |
| `shapeAt(x, y, z)` | 3 | 983 |
| `showHud(on)` | 14 | 2927 |
| `smooth(t)` | 3 | 1008 |
| `spawn()` | 10 | 2186 |
| `spreadLight(arr, queue, track)` | 4 | 1214 |
| `startAmbient()` | 11 | 2422 |
| `step(dt)` | 18 | 3921 |
| `stepSound(b)` | 11 | 2472 |
| `tileAvg(i)` | 2 | 913 |
| `tileOrigin(i)` | 2 | 672 |
| `toast(msg)` | 14 | 2934 |
| `tone(freq, dur, type, gain)` | 11 | 2391 |
| `touch(x, y, z)` | 6 | 1805 |
| `triggerSwing()` | 15 | 3110 |
| `undo()` | 13 | 2688 |
| `unlock(id)` | 13 | 2764 |
| `updateAmbient(dt)` | 11 | 2441 |
| `updateChunkVisibility(farDist)` | 7 | 1946 |
| `updateCreatures(dt)` | 17 | 3844 |
| `updateGhost(px, py, pz, upper)` | 15 | 3097 |
| `updateHand(dt)` | 15 | 3111 |
| `updateHandBlock()` | 15 | 3076 |
| `updateParticles(dt)` | 7 | 2048 |
| `updateSkyBodies()` | 17 | 3673 |
| `updateWeather(dt)` | 17 | 3757 |
| `upperFromHit(hit)` | 17 | 3572 |
| `useDragMode()` | 16 | 3209 |
| `voxMaterial(extra)` | 7 | 1906 |
| `waterTick(budget)` | 5 | 1485 |

## 테스트 훅 `window.__blockyard`

`WX` · `WY` · `WZ` · `CH` · `CX` · `CY` · `CZ` · `SEA` · `N` · `B` · `AIR` · `GRASS` · `DIRT` · `STONE` · `SAND` · `LOG` · `LEAVES` · `PLANKS` · `GLASS` · `BRICK` · `WATER` · `COBBLE` · `COAL` · `IRON` · `SNOW` · `LAMP` · `GRAVEL` · `BEDROCK` · `LAVA` · `ICE` · `TALLGRASS` · `FLOWER_R` · `FLOWER_Y` · `TORCH` · `world` · `lightSky` · `lightBlk` · `topMap` · `heightMap` · `biomeMap` · `idx` · `get` · `set` · `inside` · `lightPass` · `isSolid` · `hardnessOf` · `generate` · `relightAll` · `rebuildAll` · `buildChunk` · `chunkId` · `chunkCX` · `chunkCY` · `chunkCZ` · `opaqueMeshes` · `glassMeshes` · `dirty` · `raycast` · `boxHitsWorld` · `moveAxis` · `moveHorizontal` · `player` · `camera` · `spawn` · `refreshTop` · `refreshAllTops` · `applyEdit` · `undo` · `redo` · `history` · `future` · `encodeWorld` · `decodeWorld` · `encodeWorldB64` · `decodeWorldB64` · `relightLocal` · `markAllDirty` · `buildBudget` · `shape` · `shapeAt` · `SHAPE_BOXES` · `FACE_UV` · `SH` · `FULL` · `SLAB` · `E` · `S` · `W` · `encodeArrB64` · `decodeArrB64` · `fallTick` · `enqueueFall` · `isFalling` · `rayBox` · `canPlaceAt` · `chunkFilled` · `updateChunkVisibility` · `drawMinimap` · `ACHIEVEMENTS` · `unlock` · `achCount` · `getEarned` · `resetAch` · `setShapeMode` · `currentShape` · `setWeather` · `getWeather` · `updateWeather` · `updateCreatures` · `updateSkyBodies` · `SAVE_KEY` · `OLD_KEY` · `saveGame` · `loadGame` · `clearSave` · `hasSave` · `waterTick` · `enqueueWaterAround` · `hashSeed` · `makeBlockGeometry` · `drawIcon` · `dayLight` · `clockText` · `TILES` · `NAMES` · `ALL_BLOCKS` · `getBar` · `setTime` · `seed` · `opts` · `isUnbreakable` · `columnTop` · `facingText` · `isCross` · `isLiquid` · `isTransparent` · `waterLvl` · `MAXFLOW` · `dryTick` · `enqueueDryAround` · `decayTick` · `queueLeafDecay` · `decayQ` · `decayPending` · `CROSS` · `SHAPE_NAMES` · `upperFromHit` · `liftLegacy` · `LEGACY_WY` · `blocksLight` · `STEP_UP` · `SNEAK_MUL` · `WALK` · `SPRINT` · `HL_GEO` · `highlight` · `breaking` · `wPos` · `wDraw` · `rPos` · `HIDE_Y` · `setSneak` · `getSneak` · `getSprinting` · `setKey` · `step` · `footSupported` · `placeSound` · `miningSound` · `breakSound` · `updateHand` · `getSwing` · `beginPlay` · `endPlay` · `setPaused` · `isActive` · `triggerSwing` · `place` · `pickBlock` · `getSelected`
