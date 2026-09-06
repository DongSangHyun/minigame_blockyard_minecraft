<!-- 자동 생성 파일 — 직접 고치지 말고 `node tools/codemap.mjs` 를 다시 실행하세요 -->
# CODEMAP — 코드 색인

생성일 2026-09-06 · 모듈 27개 · 합계 8,720줄

진입점은 `index.html` → `src/main.js`. 아래 표는 **의존 순서**로 정렬돼 있습니다 —
위에 있는 모듈은 아래 모듈을 모릅니다(순환이 있는 곳은 함수 호출 시점에만 서로를 봅니다).

## 모듈 지도

| 모듈 | 하는 일 | 줄 | 기대는 곳 |
|---|---|---:|---|
| [`state.js`](../src/state.js) | 여러 모듈이 값을 바꾸는 공유 상태 | 137 | — |
| [`dims.js`](../src/dims.js) | 세계 치수와 좌표 계산 (의존성 없음) | 10 | — |
| [`queues.js`](../src/queues.js) | 시뮬레이션 대기열 (의존성 없음) | 33 | — |
| [`boot.js`](../src/boot.js) | 부팅 가드 · 환경 판별 | 26 | state |
| [`blocks.js`](../src/blocks.js) | 블록 정의 · 모양 · 성질 | 269 | state |
| [`atlas.js`](../src/atlas.js) | 텍스처 아틀라스 (코드로 그리는 16×16 도트) | 496 | blocks |
| [`world.js`](../src/world.js) | 월드 데이터 · 지형 생성 | 530 | state · queues · dims · blocks · atlas |
| [`light.js`](../src/light.js) | 광원 — 햇빛과 블록광 BFS | 182 | state · dims · blocks · world · mesh · player |
| [`fluids.js`](../src/fluids.js) | 물 흐름 · 낙하 블록 · 잎 부패 | 633 | state · queues · dims · blocks · world · light · mesh · scene · audio · player · edit |
| [`mesh.js`](../src/mesh.js) | 면 데이터 + 청크 메싱 | 272 | dims · blocks · atlas · world · light |
| [`scene.js`](../src/scene.js) | three.js 씬 · 셰이더 · 파티클 | 477 | dims · boot · blocks · atlas · world · mesh |
| [`daynight.js`](../src/daynight.js) | 낮과 밤 | 83 | state · world · scene |
| [`settings.js`](../src/settings.js) | 설정 | 40 | state · boot · scene |
| [`player.js`](../src/player.js) | 플레이어 · 충돌 · 레이캐스트 | 319 | state · dims · blocks · world · scene |
| [`audio.js`](../src/audio.js) | 소리 | 222 | state · blocks · daynight · settings |
| [`save.js`](../src/save.js) | 저장 · 불러오기 | 245 | state · dims · blocks · world · player · mobs · hud |
| [`edit.js`](../src/edit.js) | 편집 · 되돌리기 · 도전 과제 | 708 | state · settings · save · dims · blocks · world · light · fluids · mesh · player · audio · hud · sky |
| [`hud.js`](../src/hud.js) | HUD · 핫바 · 블록 고르기 · 미니맵 | 443 | state · version · dims · blocks · atlas · world · player · hand · input |
| [`hand.js`](../src/hand.js) | 1인칭 손과 들고 있는 블록 | 157 | state · boot · blocks · atlas · world · mesh · scene · player · dims · light · daynight |
| [`input.js`](../src/input.js) | 입력 (키보드 · 마우스 · 터치) | 1228 | state · queues · mobs · dims · mesh · light · boot · blocks · scene · daynight · settings · player · audio · save · cloud · edit · hud · hand · mine · sky · loop |
| [`mine.js`](../src/mine.js) | 캐기 · 놓기 | 207 | state · mobs · fluids · dims · blocks · world · scene · player · audio · edit · hud · hand · input |
| [`mobs.js`](../src/mobs.js) | 걸어 다니는 동물. 세계에 "살아 있는 것" 을 하나 넣는다. | 502 | dims · world · blocks · scene · player · audio |
| [`sky.js`](../src/sky.js) | 해와 달과 별 · 날씨 · 앰비언트 생물 | 351 | state · audio · dims · atlas · world · scene · daynight · player |
| [`cloud.js`](../src/cloud.js) | 기기 사이 이어하기 (GitHub Gist 에 세계를 올리고 내려받는다) | 226 | state · save |
| [`loop.js`](../src/loop.js) | 게임 루프 | 696 | state · input · mobs · queues · dims · boot · blocks · atlas · world · light · fluids · mesh · scene · daynight · settings · player · audio · save · edit · hud · hand · mine · sky |
| [`version.js`](../src/version.js) | 빌드 도장 (자동 생성) | 8 | — |
| [`main.js`](../src/main.js) | 조립과 시작 | 220 | state · mobs · atlas · queues · dims · blocks · world · light · fluids · mesh · scene · daynight · settings · player · audio · save · cloud · edit · hud · hand · input · mine · sky · loop |

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
| `resetQueues()` | 23 |

내보내는 값 — `Q`

### `boot.js` — 부팅 가드 · 환경 판별

| 함수 | 줄 |
|---|---:|
| `bail(msg)` | 4 |

내보내는 값 — `reduceMotion` · `IS_TOUCH`

### `blocks.js` — 블록 정의 · 모양 · 성질

| 함수 | 줄 |
|---|---:|
| `isWool(b)` | 23 |
| `hardnessOf(b)` | 113 |
| `isUnbreakable(b)` | 116 |
| `isCross(b)` | 134 |
| `needsFloor(b)` | 135 |
| `isItem(b)` | 146 |
| `isConnecting(b)` | 150 |
| `isClimbable(b)` | 152 |
| `isOpenable(b)` | 154 |
| `isFlammable(b)` | 156 |
| `connectsTo(self, other)` | 162 |
| `isLog(b)` | 169 |
| `isLeaf(b)` | 170 |
| `isDoorShape(sh)` | 190 |
| `doorOpen(sh)` | 191 |
| `doorFacing(sh)` | 192 |
| `doorShapeFor(facing, open)` | 193 |
| `isWallShape(sh)` | 196 |
| `isStairShape(sh)` | 198 |
| `wallShapeFor(nx, nz)` | 201 |
| `crossOffset(sh)` | 208 |
| `faceKindFor(sh, f, base)` | 238 |
| `isAxisShape(sh)` | 243 |
| `isLiquid(b)` | 245 |
| `isTransparent(b)` | 246 |
| `isSolid(b)` | 247 |
| `blocksLight(b)` | 248 |
| `lightPass(b)` | 249 |
| `categoryOf(b)` | 259 |

내보내는 값 — `AIR` · `TNT` · `DOOR` · `WOOL0` · `WOOL_COLORS` · `TILES` · `NAMES` · `NAMES_EN` · `HARDNESS` · `EMIT` · `CROSS` · `ALL_BLOCKS` · `ITEMS` · `DEFAULT_BAR` · `DEFAULT_BAR2` · `SH_FULL` · `SH_UP_OFF` · `SH_SLAB_UP` · `SH_AXIS_X` · `SH_WALL_N` · `WALL_DIR` · `SH_DOOR_N` · `SH_DOOR_OPEN_OFF` · `SHAPE_BOXES` · `SHAPE_NAMES`

### `atlas.js` — 텍스처 아틀라스 (코드로 그리는 16×16 도트)

| 함수 | 줄 |
|---|---:|
| `tileOrigin(i)` | 9 |
| `makeRng(seed)` | 11 |
| `paint(index, fn)` | 21 |
| `pick(rng, list)` | 29 |
| `orePaint(tint1, tint2)` | 124 |
| `tileAvg(i)` | 405 |
| `tileSwatch(i)` | 420 |
| `animateLiquids(t)` | 491 |

내보내는 값 — `TILE` · `atlas` · `actx` · `atlasTex` · `SWATCH_N` · `AVG_TOP` · `crackTex`

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
| `hasDynamicBoxes(b)` | 109 |
| `boxesAt(b, sh, x, y, z)` | 113 |
| `markSeen(px, pz, r)` | 123 |
| `seenRatio()` | 136 |
| `markTouched(x, y, z)` | 142 |
| `isTouched(x, y, z)` | 145 |
| `refreshAllTops()` | 149 |
| `hash2(x, y, seed)` | 153 |
| `hash3(x, y, z, seed)` | 158 |
| `smooth(t)` | 164 |
| `lerp(a, b, t)` | 165 |
| `noise2(x, y, seed)` | 167 |
| `noise3(x, y, z, seed)` | 174 |
| `generate(seed)` | 184 |

내보내는 값 — `world` · `shape` · `heightMap` · `topMap` · `biomeMap` · `waterLvl` · `BIOME_NAMES` · `touched` · `seenMap`

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
| `enqueueFreeze(x, y, z)` | 209 |
| `freezeTick(budget)` | 215 |
| `dryTick(budget)` | 239 |
| `get2(i, dx, dy, dz)` | 264 |
| `fedSideways(i, y, lvl)` | 270 |
| `removeWater(i, y)` | 281 |
| `ignite(x, y, z)` | 296 |
| `grassTick(px, py, pz, tries)` | 329 |
| `enqueueLava(x, y, z)` | 370 |
| `enqueueLavaAround(x, y, z)` | 375 |
| `enqueueLavaDry(x, y, z)` | 379 |
| `enqueueLavaDryAround(x, y, z)` | 383 |
| `lavaFlowTick(budget)` | 401 |
| `lavaDryTick(budget)` | 453 |
| `lavaTick(px, py, pz, tries)` | 483 |
| `fireTick(budget)` | 503 |
| `primeTNT(x, y, z, fuse)` | 577 |
| `primeTick(dt)` | 588 |
| `explode(cx, cy, cz, radius)` | 603 |

내보내는 값 — `MAXFLOW` · `DECAY_R` · `FIRE_LIFE` · `FIRE_REACH` · `GRASS_REACH` · `LAVA_FLOW` · `LAVA_REACH` · `BLAST_R` · `TNT_FUSE`

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
| `updateOuterSea(camY)` | 203 |
| `updateChunkVisibility(farDist)` | 222 |
| `burst(x, y, z, blockId, count)` | 377 |
| `updateParticles(dt)` | 398 |
| `updateEdge(px, pz)` | 455 |
| `updateSelectionBox(b)` | 471 |

내보내는 값 — `matOpaque` · `scene` · `stage` · `VOX_VS` · `VOX_FS` · `voxUniforms` · `skyUniforms` · `sky` · `OUTER_SEA_Y` · `outerSea` · `FREE_DIST` · `chunkFreed` · `cloudMat` · `cloudMatHigh` · `cloudGroup` · `cloudGroupHigh` · `HL_EDGES` · `HL_GEO` · `HL_CROSS` · `SHAPE_BOUNDS` · `PRIMED_MAX` · `primedMat` · `primedBoxes` · `highlight` · `crackMat` · `crackMesh` · `PMAX` · `pPos` · `pVel` · `pCount` · `pGeo` · `pMat` · `particles` · `edgeMat` · `edgeGroup` · `selMat` · `selBox`

### `daynight.js` — 낮과 밤

| 함수 | 줄 |
|---|---:|
| `sampleSky(t)` | 18 |
| `moonFullness()` | 33 |
| `dayLight(t)` | 37 |
| `applyTime(dt)` | 46 |
| `clockText()` | 78 |

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
| `boxHitsWorld(px, py, pz, ignoreTall)` | 68 |
| `moveAxis(axis, amount)` | 104 |
| `moveAxisStep(axis, amount)` | 115 |
| `pointSolid(px, py, pz)` | 139 |
| `playerOccupies(x, y, z)` | 157 |
| `unstick()` | 167 |
| `footSupported(px, py, pz)` | 187 |
| `moveHorizontal(dx, dz)` | 193 |
| `rayBox(o, d, mn, mx, maxT)` | 240 |
| `raycast(maxDist)` | 257 |

내보내는 값 — `HALF` · `player` · `stats` · `SWEEP` · `STEP_UP` · `_ro` · `_oA`

### `audio.js` — 소리

| 함수 | 줄 |
|---|---:|
| `ac()` | 7 |
| `tone(freq, dur, type, gain, node)` | 26 |
| `crunch(dur, gain, cutoff, node)` | 39 |
| `startAmbient()` | 56 |
| `updateAmbient(dt)` | 75 |
| `breakSound(b)` | 101 |
| `stepSound(b, through)` | 107 |
| `setMuffle(on)` | 117 |
| `rainHiss(vol)` | 127 |
| `thunder(delayMs, near)` | 131 |
| `moodChord(night, vol)` | 142 |
| `caveSound(depthMix)` | 155 |
| `at(x, y, z)` | 168 |
| `listenAt(x, y, z, fx, fz)` | 184 |
| `lavaPop(vol, node)` | 200 |
| `lavaHiss()` | 205 |
| `placeSound(b)` | 210 |
| `miningSound(b)` | 217 |

내보내는 값 — `SOFT`

### `save.js` — 저장 · 불러오기

| 함수 | 줄 |
|---|---:|
| `slotKey(n)` | 16 |
| `curKey()` | 17 |
| `slotInfo(n)` | 18 |
| `hasSave()` | 29 |
| `encodeArrB64(arr)` | 35 |
| `decodeArrB64(b64, arr, len)` | 54 |
| `encodeWorldB64()` | 74 |
| `decodeWorldB64(b64)` | 75 |
| `encodeWorld()` | 76 |
| `decodeWorld(runs, dst, len)` | 85 |
| `liftLegacy(src, dst, asRuns)` | 100 |
| `saveGame()` | 115 |
| `loadGame()` | 141 |
| `clearSave()` | 188 |
| `backupKey(n)` | 195 |
| `pushBackup()` | 198 |
| `hasBackup()` | 205 |
| `restoreBackup()` | 208 |
| `exportWorld()` | 218 |
| `importWorldText(text)` | 234 |

내보내는 값 — `SAVE_KEY` · `OLD_KEY` · `SLOTS`

### `edit.js` — 편집 · 되돌리기 · 도전 과제

| 함수 | 줄 |
|---|---:|
| `applyEdit(x, y, z, to, record, sh)` | 63 |
| `beginBatch()` | 117 |
| `settleWorld()` | 121 |
| `endBatch(label)` | 136 |
| `undo()` | 162 |
| `redo()` | 175 |
| `refreshAchList()` | 233 |
| `checkBuildAchievements()` | 257 |
| `refreshStats()` | 357 |
| `achCount()` | 375 |
| `unlock(id)` | 380 |
| `selectionBounds()` | 405 |
| `selectionSize()` | 406 |
| `fillSelection(block, sh)` | 413 |
| `clearSelection()` | 428 |
| `copySelection()` | 440 |
| `pasteClip(px, py, pz)` | 460 |
| `completeCommand(prefix)` | 511 |
| `runCommand(line)` | 518 |
| `loadBlueprints()` | 664 |
| `saveBlueprint(name)` | 667 |
| `useBlueprint(name)` | 680 |
| `blueprintNames()` | 688 |
| `selectionCounts()` | 691 |

내보내는 값 — `HISTORY_MAX` · `BATCH_RELIGHT_ALL` · `ACHIEVEMENTS` · `achGrid` · `BUILD_R` · `BUILD_IDS` · `statGrid` · `REGION_MAX` · `CMD_HELP` · `CMD_LIST` · `BP_KEY`

### `hud.js` — HUD · 핫바 · 블록 고르기 · 미니맵

| 함수 | 줄 |
|---|---:|
| `drawIcon(cv, blockId)` | 15 |
| `refreshSlot(i)` | 71 |
| `refreshBar()` | 78 |
| `selectSlot(i)` | 82 |
| `openPicker()` | 121 |
| `closePicker(resume)` | 132 |
| `facingText()` | 145 |
| `showAchPop(name, desc)` | 156 |
| `showHud(on)` | 186 |
| `toast(msg)` | 192 |
| `drawMinimap()` | 200 |
| `toggleHelp(on)` | 310 |
| `setHelpTab(showAch)` | 323 |
| `bootProgress(msg, frac)` | 338 |
| `bootDone()` | 343 |
| `noteBlockUse(b)` | 354 |
| `sortPickByRecent()` | 360 |
| `refreshPickFilter()` | 370 |
| `openCmd()` | 397 |
| `closeCmd()` | 404 |
| `cmdSay(msg)` | 409 |
| `drawPreview()` | 414 |

내보내는 값 — `hotbarEl` · `slotCanvases` · `pickerEl` · `pickGrid` · `pickBtns` · `FACING` · `tFace` · `tAch` · `tBiome` · `achPop` · `tPos` · `underwaterEl` · `inblockEl` · `airEl` · `perfEl` · `airBar` · `minimapEl` · `mmCap` · `touchEl` · `hudEls` · `toastEl` · `mmCanvas` · `mmCtx` · `mmImage` · `stampEl` · `helpEl` · `helpAchBtn` · `helpAchList` · `helpCols` · `bootEl` · `bootMsg` · `bootBar` · `pickFind` · `pickTabs` · `pickCat` · `cmdEl` · `cmdIn` · `cmdMsg` · `previewEl` · `previewCap`

### `hand.js` — 1인칭 손과 들고 있는 블록

| 함수 | 줄 |
|---|---:|
| `makeBlockGeometry(b, sh)` | 21 |
| `updateHandBlock()` | 98 |
| `updateGhost(px, py, pz, upper)` | 118 |
| `triggerSwing()` | 130 |
| `updateHandLight(dt)` | 133 |
| `updateHand(dt)` | 148 |

내보내는 값 — `handScene` · `handCam` · `handGroup` · `handMat` · `heldMesh` · `armMat` · `arm` · `ghostMat` · `ghostMesh`

### `input.js` — 입력 (키보드 · 마우스 · 터치)

| 함수 | 줄 |
|---|---:|
| `tutLine(i)` | 61 |
| `refreshHint()` | 62 |
| `advanceTut(step)` | 65 |
| `agoText(ms)` | 76 |
| `refreshSlots()` | 84 |
| `aimCell(reach)` | 156 |
| `selectionText()` | 169 |
| `afterWorldSwap(msg, loaded)` | 185 |
| `cloudSay(msg, kind)` | 240 |
| `refreshCloud()` | 245 |
| `refreshTerrain()` | 350 |
| `refreshBindLabels()` | 376 |
| `hintText(base)` | 384 |
| `refreshKeyButtons()` | 391 |
| `bindConflict(act, code)` | 424 |
| `shareLink()` | 461 |
| `refreshMenu()` | 473 |
| `beginPlay()` | 485 |
| `endPlay()` | 511 |
| `useDragMode()` | 530 |
| `goFullscreen()` | 532 |
| `requestPlay()` | 549 |
| `hashSeed(str)` | 583 |
| `applyLook(dx, dy)` | 605 |
| `cycleTime()` | 625 |
| `pickBlock()` | 637 |
| `setStick(dx, dy)` | 959 |
| `bindHold(id, onDown, onUp)` | 1059 |
| `bindOpt(inputId, outId, key, fmt)` | 1092 |
| `pollGamepadMenu()` | 1157 |
| `pollGamepad(dt)` | 1167 |

내보내는 값 — `overlay` · `goBtn` · `altBtn` · `seedIn` · `canvas` · `isTouch` · `HINT_LOCK` · `HINT_DRAG` · `hintEl` · `TUT` · `TUT_TOUCH` · `slotsEl` · `copySeedBtn` · `expBtn` · `impBtn` · `resBtn` · `fileIn` · `terrainEl` · `KEY_LABEL` · `keysEl` · `RESERVED` · `copyLinkBtn` · `lookLast` · `stickZone` · `stickBase` · `stickKnob` · `STICK_R` · `padState`

### `mine.js` — 캐기 · 놓기

| 함수 | 줄 |
|---|---:|
| `mineAt(hit)` | 16 |
| `upperFromHit(hit)` | 45 |
| `canPlaceAt(px, py, pz)` | 52 |
| `tryInteract(hit)` | 64 |
| `doorOther(x, y, z)` | 101 |
| `place(repeating)` | 131 |

### `mobs.js` — 걸어 다니는 동물. 세계에 "살아 있는 것" 을 하나 넣는다.

| 함수 | 줄 |
|---|---:|
| `dumpMobs()` | 76 |
| `loadMobs(arr)` | 85 |
| `seedMobs()` | 102 |
| `anyMobNear(px, pz, r)` | 177 |
| `updateMobs(dt)` | 206 |
| `pushOutOfMobs(px, pz, half)` | 334 |
| `aimingAtMob()` | 352 |
| `feedNearbyMob(pos)` | 371 |
| `breedTick(dt)` | 395 |
| `setMobsVisible(on)` | 423 |
| `seedFlocks()` | 444 |
| `updateFlocks(dt)` | 461 |

내보내는 값 — `LOVE_HINT` · `MOB_COUNT` · `MOB_MAX` · `FISH_COUNT` · `BIRD_COUNT` · `MOB_KINDS` · `mobs` · `mobGroup` · `fish` · `birds`

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
| `seedCreatures()` | 303 |
| `placeCreature(i)` | 311 |
| `updateCreatures(dt)` | 321 |

내보내는 값 — `sunMat` · `sunSprite` · `MOON_PHASES` · `moonTex` · `moonMat` · `moonSprite` · `brightMat` · `brightStars` · `starMat` · `stars` · `WCOUNT` · `wPos` · `wDraw` · `HIDE_Y` · `wGeo` · `wMat` · `weatherPoints` · `rPos` · `rGeo` · `rainLines` · `CCOUNT` · `cPos` · `cSeed` · `cGeo` · `cMat` · `creatures`

### `cloud.js` — 기기 사이 이어하기 (GitHub Gist 에 세계를 올리고 내려받는다)

| 함수 | 줄 |
|---|---:|
| `getToken()` | 19 |
| `setToken(t)` | 20 |
| `isLinked()` | 25 |
| `unlink()` | 28 |
| `normalizeName(n)` | 33 |
| `worldName()` | 37 |
| `setWorldName(n)` | 38 |
| `deviceName()` | 41 |
| `baseRev(name)` | 53 |
| `setBaseRev(name, rev)` | 56 |
| `httpMessage(status)` | 71 |
| `req(method, path, body)` | 79 |
| `checkToken()` | 99 |
| `findGist()` | 106 |
| `ensureGist()` | 126 |
| `fileContent(gist, name)` | 137 |
| `readIndex(gist)` | 143 |
| `listWorlds()` | 156 |
| `pushWorld(force)` | 172 |
| `pullWorld(which)` | 208 |

내보내는 값 — `API` · `MARK` · `INDEX_FILE` · `TOKEN_KEY` · `GIST_KEY` · `NAME_KEY` · `BASE_KEY` · `DEV_KEY`

### `loop.js` — 게임 루프

| 함수 | 줄 |
|---|---:|
| `newWorld(seed)` | 34 |
| `step(dt)` | 68 |
| `animate()` | 583 |
| `autoTuneFar(fps)` | 660 |
| `farNow()` | 678 |
| `refreshPerf()` | 680 |

내보내는 값 — `GRAVITY` · `PLACE_DELAY` · `SNEAK_MUL` · `AIR_CONTROL` · `fwd` · `clock`

### `version.js` — 빌드 도장 (자동 생성)

내보내는 값 — `BUILD`
