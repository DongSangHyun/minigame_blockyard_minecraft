<!-- 자동 생성 파일 — 직접 고치지 말고 `node tools/codemap.mjs` 를 다시 실행하세요 -->
# CODEMAP — 코드 색인

생성일 2026-09-06 · 모듈 24개 · 합계 6,791줄

진입점은 `index.html` → `src/main.js`. 아래 표는 **의존 순서**로 정렬돼 있습니다 —
위에 있는 모듈은 아래 모듈을 모릅니다(순환이 있는 곳은 함수 호출 시점에만 서로를 봅니다).

## 모듈 지도

| 모듈 | 하는 일 | 줄 | 기대는 곳 |
|---|---|---:|---|
| [`state.js`](../src/state.js) | 여러 모듈이 값을 바꾸는 공유 상태 | 125 | — |
| [`dims.js`](../src/dims.js) | 세계 치수와 좌표 계산 (의존성 없음) | 10 | — |
| [`queues.js`](../src/queues.js) | 시뮬레이션 대기열 (의존성 없음) | 26 | — |
| [`boot.js`](../src/boot.js) | 부팅 가드 · 환경 판별 | 26 | state |
| [`blocks.js`](../src/blocks.js) | 블록 정의 · 모양 · 성질 | 247 | state |
| [`atlas.js`](../src/atlas.js) | 텍스처 아틀라스 (코드로 그리는 16×16 도트) | 467 | blocks |
| [`world.js`](../src/world.js) | 월드 데이터 · 지형 생성 | 417 | state · queues · dims · blocks · atlas |
| [`light.js`](../src/light.js) | 광원 — 햇빛과 블록광 BFS | 182 | state · dims · blocks · world · mesh · player |
| [`fluids.js`](../src/fluids.js) | 물 흐름 · 낙하 블록 · 잎 부패 | 396 | state · queues · dims · blocks · world · light · mesh · scene · audio · player · edit |
| [`mesh.js`](../src/mesh.js) | 면 데이터 + 청크 메싱 | 272 | dims · blocks · atlas · world · light |
| [`scene.js`](../src/scene.js) | three.js 씬 · 셰이더 · 파티클 | 376 | dims · boot · blocks · atlas · world · mesh |
| [`daynight.js`](../src/daynight.js) | 낮과 밤 | 76 | state · world · scene |
| [`settings.js`](../src/settings.js) | 설정 | 40 | state · boot · scene |
| [`player.js`](../src/player.js) | 플레이어 · 충돌 · 레이캐스트 | 289 | state · dims · blocks · world · scene |
| [`audio.js`](../src/audio.js) | 소리 | 220 | state · blocks · daynight · settings |
| [`save.js`](../src/save.js) | 저장 · 불러오기 | 233 | state · dims · blocks · world · player · hud |
| [`edit.js`](../src/edit.js) | 편집 · 되돌리기 · 도전 과제 | 440 | state · settings · save · dims · blocks · world · light · fluids · mesh · player · audio · hud · sky |
| [`hud.js`](../src/hud.js) | HUD · 핫바 · 블록 고르기 · 미니맵 | 405 | state · version · dims · blocks · atlas · world · player · hand · input |
| [`hand.js`](../src/hand.js) | 1인칭 손과 들고 있는 블록 | 136 | state · boot · blocks · atlas · world · mesh · scene · player |
| [`input.js`](../src/input.js) | 입력 (키보드 · 마우스 · 터치) | 1049 | state · mesh · light · boot · blocks · scene · daynight · settings · player · audio · save · cloud · edit · hud · hand · mine · sky · loop |
| [`mine.js`](../src/mine.js) | 캐기 · 놓기 | 159 | state · mobs · fluids · dims · blocks · world · scene · player · audio · edit · hud · hand · input |
| [`sky.js`](../src/sky.js) | 해와 달과 별 · 날씨 · 앰비언트 생물 | 346 | state · audio · dims · atlas · world · scene · daynight · player |
| [`loop.js`](../src/loop.js) | 게임 루프 | 646 | state · input · mobs · queues · dims · boot · blocks · atlas · world · light · fluids · mesh · scene · daynight · settings · player · audio · save · edit · hud · hand · mine · sky |
| [`main.js`](../src/main.js) | 조립과 시작 | 208 | state · mobs · atlas · queues · dims · blocks · world · light · fluids · mesh · scene · daynight · settings · player · audio · save · cloud · edit · hud · hand · input · mine · sky · loop |

## 모듈별 공개 함수

### `state.js` — 여러 모듈이 값을 바꾸는 공유 상태

내보내는 값 — `S`

### `dims.js` — 세계 치수와 좌표 계산 (의존성 없음)

| 함수 | 줄 |
|---|---:|
| `idx(x, y, z)` | 7 |
| `inside(x, y, z)` | 8 |

내보내는 값 — `WX` · `LEGACY_WY` · `CX` · `N` · `SEA` · `DIRS`

### `queues.js` — 시뮬레이션 대기열 (의존성 없음)

| 함수 | 줄 |
|---|---:|
| `resetQueues()` | 18 |

내보내는 값 — `Q`

### `boot.js` — 부팅 가드 · 환경 판별

| 함수 | 줄 |
|---|---:|
| `bail(msg)` | 4 |

내보내는 값 — `reduceMotion` · `IS_TOUCH`

### `blocks.js` — 블록 정의 · 모양 · 성질

| 함수 | 줄 |
|---|---:|
| `isWool(b)` | 22 |
| `hardnessOf(b)` | 105 |
| `isUnbreakable(b)` | 108 |
| `isCross(b)` | 126 |
| `needsFloor(b)` | 127 |
| `isItem(b)` | 138 |
| `isConnecting(b)` | 142 |
| `isClimbable(b)` | 144 |
| `isOpenable(b)` | 146 |
| `isFlammable(b)` | 148 |
| `connectsTo(self, other)` | 154 |
| `isLog(b)` | 161 |
| `isLeaf(b)` | 162 |
| `isWallShape(sh)` | 178 |
| `wallShapeFor(nx, nz)` | 179 |
| `crossOffset(sh)` | 186 |
| `faceKindFor(sh, f, base)` | 216 |
| `isAxisShape(sh)` | 221 |
| `isLiquid(b)` | 223 |
| `isTransparent(b)` | 224 |
| `isSolid(b)` | 225 |
| `blocksLight(b)` | 226 |
| `lightPass(b)` | 227 |
| `categoryOf(b)` | 237 |

내보내는 값 — `AIR` · `TNT` · `WOOL0` · `WOOL_COLORS` · `TILES` · `NAMES` · `HARDNESS` · `EMIT` · `CROSS` · `ALL_BLOCKS` · `ITEMS` · `DEFAULT_BAR` · `DEFAULT_BAR2` · `SH_FULL` · `SH_UP_OFF` · `SH_SLAB_UP` · `SH_AXIS_X` · `SH_WALL_N` · `WALL_DIR` · `SHAPE_BOXES` · `SHAPE_NAMES`

### `atlas.js` — 텍스처 아틀라스 (코드로 그리는 16×16 도트)

| 함수 | 줄 |
|---|---:|
| `tileOrigin(i)` | 9 |
| `makeRng(seed)` | 11 |
| `paint(index, fn)` | 21 |
| `pick(rng, list)` | 29 |
| `orePaint(tint1, tint2)` | 124 |
| `tileAvg(i)` | 394 |
| `animateLiquids(t)` | 462 |

내보내는 값 — `TILE` · `atlas` · `actx` · `atlasTex` · `AVG_TOP` · `crackTex`

### `world.js` — 월드 데이터 · 지형 생성

| 함수 | 줄 |
|---|---:|
| `get(x, y, z)` | 17 |
| `set(x, y, z, b)` | 22 |
| `shapeAt(x, y, z)` | 25 |
| `refreshTop(x, z)` | 27 |
| `surfaceTop(x, y, z)` | 36 |
| `crossBase(x, y, z)` | 45 |
| `dynamicBoxes(b, x, y, z)` | 52 |
| `hasDynamicBoxes(b)` | 97 |
| `boxesAt(b, sh, x, y, z)` | 101 |
| `markTouched(x, y, z)` | 108 |
| `isTouched(x, y, z)` | 111 |
| `refreshAllTops()` | 115 |
| `hash2(x, y, seed)` | 119 |
| `hash3(x, y, z, seed)` | 124 |
| `smooth(t)` | 130 |
| `lerp(a, b, t)` | 131 |
| `noise2(x, y, seed)` | 133 |
| `noise3(x, y, z, seed)` | 140 |
| `generate(seed)` | 150 |

내보내는 값 — `world` · `shape` · `heightMap` · `topMap` · `biomeMap` · `waterLvl` · `BIOME_NAMES` · `touched`

### `light.js` — 광원 — 햇빛과 블록광 BFS

| 함수 | 줄 |
|---|---:|
| `idx3(x, y, z)` | 12 |
| `markLightCell(i)` | 17 |
| `spreadLight(arr, queue, track)` | 30 |
| `removeLightBFS(arr, start, track)` | 58 |
| `relightLocal(x, y, z)` | 88 |
| `relightAll(markChanges)` | 126 |
| `relightSoon()` | 172 |
| `lightAtPlayer()` | 174 |

내보내는 값 — `lightSky` · `prevSky` · `WATER_DIM`

### `fluids.js` — 물 흐름 · 낙하 블록 · 잎 부패

| 함수 | 줄 |
|---|---:|
| `enqueueWater(x, y, z)` | 16 |
| `enqueueDry(x, y, z)` | 20 |
| `enqueueDryAround(x, y, z)` | 24 |
| `enqueueWaterAround(x, y, z)` | 28 |
| `queueLeafDecay(x, y, z)` | 37 |
| `decayTick(budget)` | 75 |
| `isFalling(b)` | 92 |
| `enqueueFall(x, y, z)` | 93 |
| `fallTick(budget)` | 97 |
| `waterTick(budget)` | 134 |
| `enqueueFreeze(x, y, z)` | 203 |
| `freezeTick(budget)` | 209 |
| `dryTick(budget)` | 233 |
| `get2(i, dx, dy, dz)` | 258 |
| `fedSideways(i, y, lvl)` | 264 |
| `removeWater(i, y)` | 275 |
| `ignite(x, y, z)` | 290 |
| `fireTick(budget)` | 308 |
| `explode(cx, cy, cz, radius)` | 370 |

내보내는 값 — `MAXFLOW` · `DECAY_R` · `FIRE_LIFE` · `FIRE_REACH` · `BLAST_R`

### `mesh.js` — 면 데이터 + 청크 메싱

| 함수 | 줄 |
|---|---:|
| `aoValue(s1, s2, cor)` | 44 |
| `chunkId(cx, cy, cz)` | 50 |
| `chunkCX(id)` | 51 |
| `chunkCZ(id)` | 52 |
| `chunkCY(id)` | 53 |
| `buildChunk(cx, cy, cz)` | 55 |
| `emitCross(P, U, C, L, I, x, y, z, b, ci)` | 176 |
| `applyGeo(mesh, pos, uv, col, lit, ind)` | 210 |
| `markDirty(x, y, z)` | 224 |
| `touch(x, y, z)` | 230 |
| `rebuildAll()` | 234 |
| `markAllDirty()` | 239 |
| `setBuildFocus(v)` | 244 |
| `buildBudget(ms)` | 246 |

내보내는 값 — `FACES` · `FACE_UV` · `AO_LEVELS` · `opaqueMeshes` · `chunkFilled` · `chunkCenters` · `CROSS_PLANES` · `dirty` · `buildFocus`

### `scene.js` — three.js 씬 · 셰이더 · 파티클

| 함수 | 줄 |
|---|---:|
| `voxMaterial(extra)` | 95 |
| `updateChunkVisibility(farDist)` | 138 |
| `burst(x, y, z, blockId, count)` | 279 |
| `updateParticles(dt)` | 297 |
| `updateEdge(px, pz)` | 354 |
| `updateSelectionBox(b)` | 370 |

내보내는 값 — `matOpaque` · `scene` · `stage` · `VOX_VS` · `VOX_FS` · `voxUniforms` · `skyUniforms` · `sky` · `FREE_DIST` · `chunkFreed` · `cloudMat` · `cloudMatHigh` · `cloudGroup` · `cloudGroupHigh` · `HL_EDGES` · `HL_GEO` · `HL_CROSS` · `SHAPE_BOUNDS` · `highlight` · `crackMat` · `crackMesh` · `PMAX` · `pPos` · `pVel` · `pCount` · `pGeo` · `pMat` · `particles` · `edgeMat` · `edgeGroup` · `selMat` · `selBox`

### `daynight.js` — 낮과 밤

| 함수 | 줄 |
|---|---:|
| `sampleSky(t)` | 18 |
| `dayLight(t)` | 31 |
| `applyTime(dt)` | 39 |
| `clockText()` | 71 |

내보내는 값 — `DAY_LEN` · `SKY_STOPS` · `_cA` · `_grey`

### `settings.js` — 설정

| 함수 | 줄 |
|---|---:|
| `saveOpts()` | 21 |
| `applyOpts()` | 24 |

내보내는 값 — `OPT_KEY` · `opts`

### `player.js` — 플레이어 · 충돌 · 레이캐스트

| 함수 | 줄 |
|---|---:|
| `currentShape(upper)` | 17 |
| `spawn()` | 29 |
| `boxHitsWorld(px, py, pz)` | 46 |
| `moveAxis(axis, amount)` | 74 |
| `moveAxisStep(axis, amount)` | 85 |
| `pointSolid(px, py, pz)` | 109 |
| `playerOccupies(x, y, z)` | 127 |
| `unstick()` | 137 |
| `footSupported(px, py, pz)` | 157 |
| `moveHorizontal(dx, dz)` | 163 |
| `rayBox(o, d, mn, mx, maxT)` | 210 |
| `raycast(maxDist)` | 227 |

내보내는 값 — `HALF` · `player` · `stats` · `SWEEP` · `STEP_UP` · `_ro` · `_oA`

### `audio.js` — 소리

| 함수 | 줄 |
|---|---:|
| `ac()` | 7 |
| `tone(freq, dur, type, gain)` | 24 |
| `crunch(dur, gain, cutoff)` | 37 |
| `startAmbient()` | 54 |
| `updateAmbient(dt)` | 73 |
| `breakSound(b)` | 99 |
| `stepSound(b, through)` | 105 |
| `setMuffle(on)` | 115 |
| `rainHiss(vol)` | 125 |
| `thunder(delayMs, near)` | 129 |
| `moodChord(night, vol)` | 140 |
| `caveSound(depthMix)` | 153 |
| `at(x, y, z)` | 166 |
| `listenAt(x, y, z, fx, fz)` | 182 |
| `lavaPop(vol)` | 198 |
| `lavaHiss()` | 203 |
| `placeSound(b)` | 208 |
| `miningSound(b)` | 215 |

내보내는 값 — `SOFT`

### `save.js` — 저장 · 불러오기

| 함수 | 줄 |
|---|---:|
| `slotKey(n)` | 15 |
| `curKey()` | 16 |
| `slotInfo(n)` | 17 |
| `hasSave()` | 27 |
| `encodeArrB64(arr)` | 33 |
| `decodeArrB64(b64, arr, len)` | 52 |
| `encodeWorldB64()` | 72 |
| `decodeWorldB64(b64)` | 73 |
| `encodeWorld()` | 74 |
| `decodeWorld(runs, dst, len)` | 83 |
| `liftLegacy(src, dst, asRuns)` | 98 |
| `saveGame()` | 113 |
| `loadGame()` | 136 |
| `clearSave()` | 176 |
| `backupKey(n)` | 183 |
| `pushBackup()` | 186 |
| `hasBackup()` | 193 |
| `restoreBackup()` | 196 |
| `exportWorld()` | 206 |
| `importWorldText(text)` | 222 |

내보내는 값 — `SAVE_KEY` · `OLD_KEY` · `SLOTS`

### `edit.js` — 편집 · 되돌리기 · 도전 과제

| 함수 | 줄 |
|---|---:|
| `applyEdit(x, y, z, to, record, sh)` | 47 |
| `beginBatch()` | 95 |
| `endBatch(label)` | 96 |
| `undo()` | 115 |
| `redo()` | 124 |
| `refreshAchList()` | 167 |
| `refreshStats()` | 179 |
| `achCount()` | 197 |
| `unlock(id)` | 202 |
| `selectionBounds()` | 227 |
| `selectionSize()` | 228 |
| `fillSelection(block, sh)` | 235 |
| `copySelection()` | 247 |
| `pasteClip(px, py, pz)` | 264 |
| `completeCommand(prefix)` | 302 |
| `runCommand(line)` | 309 |
| `loadBlueprints()` | 396 |
| `saveBlueprint(name)` | 399 |
| `useBlueprint(name)` | 412 |
| `blueprintNames()` | 420 |
| `selectionCounts()` | 423 |

내보내는 값 — `HISTORY_MAX` · `ACHIEVEMENTS` · `achGrid` · `statGrid` · `REGION_MAX` · `CMD_HELP` · `CMD_LIST` · `BP_KEY`

### `hud.js` — HUD · 핫바 · 블록 고르기 · 미니맵

| 함수 | 줄 |
|---|---:|
| `drawIcon(cv, blockId)` | 15 |
| `refreshSlot(i)` | 71 |
| `refreshBar()` | 78 |
| `selectSlot(i)` | 82 |
| `openPicker()` | 118 |
| `closePicker(resume)` | 129 |
| `facingText()` | 142 |
| `showAchPop(name, desc)` | 153 |
| `showHud(on)` | 183 |
| `toast(msg)` | 189 |
| `drawMinimap()` | 197 |
| `toggleHelp(on)` | 272 |
| `setHelpTab(showAch)` | 285 |
| `bootProgress(msg, frac)` | 300 |
| `bootDone()` | 305 |
| `noteBlockUse(b)` | 316 |
| `sortPickByRecent()` | 322 |
| `refreshPickFilter()` | 332 |
| `openCmd()` | 359 |
| `closeCmd()` | 366 |
| `cmdSay(msg)` | 371 |
| `drawPreview()` | 376 |

내보내는 값 — `hotbarEl` · `slotCanvases` · `pickerEl` · `pickGrid` · `pickBtns` · `FACING` · `tFace` · `tAch` · `tBiome` · `achPop` · `tPos` · `underwaterEl` · `inblockEl` · `airEl` · `perfEl` · `airBar` · `minimapEl` · `mmCap` · `touchEl` · `hudEls` · `toastEl` · `mmCanvas` · `mmCtx` · `mmImage` · `stampEl` · `helpEl` · `helpAchBtn` · `helpAchList` · `helpCols` · `bootEl` · `bootMsg` · `bootBar` · `pickFind` · `pickTabs` · `pickCat` · `cmdEl` · `cmdIn` · `cmdMsg` · `previewEl` · `previewCap`

### `hand.js` — 1인칭 손과 들고 있는 블록

| 함수 | 줄 |
|---|---:|
| `makeBlockGeometry(b, sh)` | 18 |
| `updateHandBlock()` | 95 |
| `updateGhost(px, py, pz, upper)` | 115 |
| `triggerSwing()` | 127 |
| `updateHand(dt)` | 128 |

내보내는 값 — `handScene` · `handCam` · `handGroup` · `handMat` · `heldMesh` · `armMat` · `arm` · `ghostMat` · `ghostMesh`

### `input.js` — 입력 (키보드 · 마우스 · 터치)

| 함수 | 줄 |
|---|---:|
| `refreshHint()` | 47 |
| `advanceTut(step)` | 50 |
| `refreshSlots()` | 60 |
| `cloudSay(msg, kind)` | 162 |
| `refreshCloud()` | 167 |
| `refreshTerrain()` | 272 |
| `refreshKeyButtons()` | 296 |
| `shareLink()` | 337 |
| `refreshMenu()` | 349 |
| `beginPlay()` | 361 |
| `endPlay()` | 378 |
| `useDragMode()` | 397 |
| `goFullscreen()` | 399 |
| `requestPlay()` | 416 |
| `hashSeed(str)` | 450 |
| `applyLook(dx, dy)` | 472 |
| `cycleTime()` | 492 |
| `pickBlock()` | 504 |
| `setStick(dx, dy)` | 813 |
| `bindHold(id, onDown, onUp)` | 913 |
| `bindOpt(inputId, outId, key, fmt)` | 942 |
| `pollGamepad(dt)` | 1005 |

내보내는 값 — `overlay` · `goBtn` · `altBtn` · `seedIn` · `canvas` · `isTouch` · `HINT_LOCK` · `HINT_DRAG` · `hintEl` · `TUT` · `slotsEl` · `copySeedBtn` · `expBtn` · `impBtn` · `resBtn` · `fileIn` · `terrainEl` · `KEY_LABEL` · `keysEl` · `copyLinkBtn` · `lookLast` · `stickZone` · `stickBase` · `stickKnob` · `STICK_R` · `padState`

### `mine.js` — 캐기 · 놓기

| 함수 | 줄 |
|---|---:|
| `mineAt(hit)` | 16 |
| `upperFromHit(hit)` | 30 |
| `canPlaceAt(px, py, pz)` | 37 |
| `tryInteract(hit)` | 49 |
| `place(repeating)` | 92 |

### `sky.js` — 해와 달과 별 · 날씨 · 앰비언트 생물

| 함수 | 줄 |
|---|---:|
| `discTexture(size, stops)` | 11 |
| `updateSkyBodies()` | 117 |
| `columnTop(fx, fz)` | 169 |
| `seedWeather()` | 175 |
| `setWeather(w)` | 184 |
| `localBiome()` | 200 |
| `updateStorm(dt)` | 207 |
| `updateWeather(dt)` | 218 |
| `seedCreatures()` | 298 |
| `placeCreature(i)` | 306 |
| `updateCreatures(dt)` | 316 |

내보내는 값 — `sunMat` · `sunSprite` · `MOON_PHASES` · `moonTex` · `moonMat` · `moonSprite` · `brightMat` · `brightStars` · `starMat` · `stars` · `WCOUNT` · `wPos` · `wDraw` · `HIDE_Y` · `wGeo` · `wMat` · `weatherPoints` · `rPos` · `rGeo` · `rainLines` · `CCOUNT` · `cPos` · `cSeed` · `cGeo` · `cMat` · `creatures`

### `loop.js` — 게임 루프

| 함수 | 줄 |
|---|---:|
| `newWorld(seed)` | 32 |
| `step(dt)` | 66 |
| `animate()` | 534 |
| `autoTuneFar(fps)` | 610 |
| `farNow()` | 628 |
| `refreshPerf()` | 630 |

내보내는 값 — `GRAVITY` · `SNEAK_MUL` · `AIR_CONTROL` · `fwd` · `clock`
