<!-- 자동 생성 파일 — 직접 고치지 말고 `node tools/codemap.mjs` 를 다시 실행하세요 -->
# CODEMAP — 코드 색인

생성일 2026-09-06 · 모듈 24개 · 합계 7,308줄

진입점은 `index.html` → `src/main.js`. 아래 표는 **의존 순서**로 정렬돼 있습니다 —
위에 있는 모듈은 아래 모듈을 모릅니다(순환이 있는 곳은 함수 호출 시점에만 서로를 봅니다).

## 모듈 지도

| 모듈 | 하는 일 | 줄 | 기대는 곳 |
|---|---|---:|---|
| [`state.js`](../src/state.js) | 여러 모듈이 값을 바꾸는 공유 상태 | 133 | — |
| [`dims.js`](../src/dims.js) | 세계 치수와 좌표 계산 (의존성 없음) | 10 | — |
| [`queues.js`](../src/queues.js) | 시뮬레이션 대기열 (의존성 없음) | 26 | — |
| [`boot.js`](../src/boot.js) | 부팅 가드 · 환경 판별 | 26 | state |
| [`blocks.js`](../src/blocks.js) | 블록 정의 · 모양 · 성질 | 257 | state |
| [`atlas.js`](../src/atlas.js) | 텍스처 아틀라스 (코드로 그리는 16×16 도트) | 485 | blocks |
| [`world.js`](../src/world.js) | 월드 데이터 · 지형 생성 | 463 | state · queues · dims · blocks · atlas |
| [`light.js`](../src/light.js) | 광원 — 햇빛과 블록광 BFS | 182 | state · dims · blocks · world · mesh · player |
| [`fluids.js`](../src/fluids.js) | 물 흐름 · 낙하 블록 · 잎 부패 | 518 | state · queues · dims · blocks · world · light · mesh · scene · audio · player · edit |
| [`mesh.js`](../src/mesh.js) | 면 데이터 + 청크 메싱 | 272 | dims · blocks · atlas · world · light |
| [`scene.js`](../src/scene.js) | three.js 씬 · 셰이더 · 파티클 | 393 | dims · boot · blocks · atlas · world · mesh |
| [`daynight.js`](../src/daynight.js) | 낮과 밤 | 83 | state · world · scene |
| [`settings.js`](../src/settings.js) | 설정 | 40 | state · boot · scene |
| [`player.js`](../src/player.js) | 플레이어 · 충돌 · 레이캐스트 | 319 | state · dims · blocks · world · scene |
| [`audio.js`](../src/audio.js) | 소리 | 222 | state · blocks · daynight · settings |
| [`save.js`](../src/save.js) | 저장 · 불러오기 | 235 | state · dims · blocks · world · player · hud |
| [`edit.js`](../src/edit.js) | 편집 · 되돌리기 · 도전 과제 | 492 | state · settings · save · dims · blocks · world · light · fluids · mesh · player · audio · hud · sky |
| [`hud.js`](../src/hud.js) | HUD · 핫바 · 블록 고르기 · 미니맵 | 425 | state · version · dims · blocks · atlas · world · player · hand · input |
| [`hand.js`](../src/hand.js) | 1인칭 손과 들고 있는 블록 | 157 | state · boot · blocks · atlas · world · mesh · scene · player · dims · light · daynight |
| [`input.js`](../src/input.js) | 입력 (키보드 · 마우스 · 터치) | 1160 | state · mesh · light · boot · blocks · scene · daynight · settings · player · audio · save · cloud · edit · hud · hand · mine · sky · loop |
| [`mine.js`](../src/mine.js) | 캐기 · 놓기 | 169 | state · mobs · fluids · dims · blocks · world · scene · player · audio · edit · hud · hand · input |
| [`sky.js`](../src/sky.js) | 해와 달과 별 · 날씨 · 앰비언트 생물 | 351 | state · audio · dims · atlas · world · scene · daynight · player |
| [`loop.js`](../src/loop.js) | 게임 루프 | 684 | state · input · mobs · queues · dims · boot · blocks · atlas · world · light · fluids · mesh · scene · daynight · settings · player · audio · save · edit · hud · hand · mine · sky |
| [`main.js`](../src/main.js) | 조립과 시작 | 206 | state · mobs · atlas · queues · dims · blocks · world · light · fluids · mesh · scene · daynight · settings · player · audio · save · cloud · edit · hud · hand · input · mine · sky · loop |

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
| `hardnessOf(b)` | 111 |
| `isUnbreakable(b)` | 114 |
| `isCross(b)` | 132 |
| `needsFloor(b)` | 133 |
| `isItem(b)` | 144 |
| `isConnecting(b)` | 148 |
| `isClimbable(b)` | 150 |
| `isOpenable(b)` | 152 |
| `isFlammable(b)` | 154 |
| `connectsTo(self, other)` | 160 |
| `isLog(b)` | 167 |
| `isLeaf(b)` | 168 |
| `isWallShape(sh)` | 184 |
| `isStairShape(sh)` | 186 |
| `wallShapeFor(nx, nz)` | 189 |
| `crossOffset(sh)` | 196 |
| `faceKindFor(sh, f, base)` | 226 |
| `isAxisShape(sh)` | 231 |
| `isLiquid(b)` | 233 |
| `isTransparent(b)` | 234 |
| `isSolid(b)` | 235 |
| `blocksLight(b)` | 236 |
| `lightPass(b)` | 237 |
| `categoryOf(b)` | 247 |

내보내는 값 — `AIR` · `TNT` · `WOOL0` · `WOOL_COLORS` · `TILES` · `NAMES` · `NAMES_EN` · `HARDNESS` · `EMIT` · `CROSS` · `ALL_BLOCKS` · `ITEMS` · `DEFAULT_BAR` · `DEFAULT_BAR2` · `SH_FULL` · `SH_UP_OFF` · `SH_SLAB_UP` · `SH_AXIS_X` · `SH_WALL_N` · `WALL_DIR` · `SHAPE_BOXES` · `SHAPE_NAMES`

### `atlas.js` — 텍스처 아틀라스 (코드로 그리는 16×16 도트)

| 함수 | 줄 |
|---|---:|
| `tileOrigin(i)` | 9 |
| `makeRng(seed)` | 11 |
| `paint(index, fn)` | 21 |
| `pick(rng, list)` | 29 |
| `orePaint(tint1, tint2)` | 124 |
| `tileAvg(i)` | 394 |
| `tileSwatch(i)` | 409 |
| `animateLiquids(t)` | 480 |

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
| `enqueueFreeze(x, y, z)` | 209 |
| `freezeTick(budget)` | 215 |
| `dryTick(budget)` | 239 |
| `get2(i, dx, dy, dz)` | 264 |
| `fedSideways(i, y, lvl)` | 270 |
| `removeWater(i, y)` | 281 |
| `ignite(x, y, z)` | 296 |
| `grassTick(px, py, pz, tries)` | 329 |
| `lavaTick(px, py, pz, tries)` | 368 |
| `fireTick(budget)` | 388 |
| `primeTNT(x, y, z, fuse)` | 462 |
| `primeTick(dt)` | 473 |
| `explode(cx, cy, cz, radius)` | 488 |

내보내는 값 — `MAXFLOW` · `DECAY_R` · `FIRE_LIFE` · `FIRE_REACH` · `GRASS_REACH` · `LAVA_REACH` · `BLAST_R` · `TNT_FUSE`

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
| `burst(x, y, z, blockId, count)` | 293 |
| `updateParticles(dt)` | 314 |
| `updateEdge(px, pz)` | 371 |
| `updateSelectionBox(b)` | 387 |

내보내는 값 — `matOpaque` · `scene` · `stage` · `VOX_VS` · `VOX_FS` · `voxUniforms` · `skyUniforms` · `sky` · `FREE_DIST` · `chunkFreed` · `cloudMat` · `cloudMatHigh` · `cloudGroup` · `cloudGroupHigh` · `HL_EDGES` · `HL_GEO` · `HL_CROSS` · `SHAPE_BOUNDS` · `PRIMED_MAX` · `primedMat` · `primedBoxes` · `highlight` · `crackMat` · `crackMesh` · `PMAX` · `pPos` · `pVel` · `pCount` · `pGeo` · `pMat` · `particles` · `edgeMat` · `edgeGroup` · `selMat` · `selBox`

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
| `slotKey(n)` | 15 |
| `curKey()` | 16 |
| `slotInfo(n)` | 17 |
| `hasSave()` | 28 |
| `encodeArrB64(arr)` | 34 |
| `decodeArrB64(b64, arr, len)` | 53 |
| `encodeWorldB64()` | 73 |
| `decodeWorldB64(b64)` | 74 |
| `encodeWorld()` | 75 |
| `decodeWorld(runs, dst, len)` | 84 |
| `liftLegacy(src, dst, asRuns)` | 99 |
| `saveGame()` | 114 |
| `loadGame()` | 137 |
| `clearSave()` | 178 |
| `backupKey(n)` | 185 |
| `pushBackup()` | 188 |
| `hasBackup()` | 195 |
| `restoreBackup()` | 198 |
| `exportWorld()` | 208 |
| `importWorldText(text)` | 224 |

내보내는 값 — `SAVE_KEY` · `OLD_KEY` · `SLOTS`

### `edit.js` — 편집 · 되돌리기 · 도전 과제

| 함수 | 줄 |
|---|---:|
| `applyEdit(x, y, z, to, record, sh)` | 48 |
| `beginBatch()` | 97 |
| `endBatch(label)` | 98 |
| `undo()` | 121 |
| `redo()` | 130 |
| `refreshAchList()` | 175 |
| `refreshStats()` | 187 |
| `achCount()` | 205 |
| `unlock(id)` | 210 |
| `selectionBounds()` | 235 |
| `selectionSize()` | 236 |
| `fillSelection(block, sh)` | 243 |
| `clearSelection()` | 258 |
| `copySelection()` | 270 |
| `pasteClip(px, py, pz)` | 287 |
| `completeCommand(prefix)` | 332 |
| `runCommand(line)` | 339 |
| `loadBlueprints()` | 448 |
| `saveBlueprint(name)` | 451 |
| `useBlueprint(name)` | 464 |
| `blueprintNames()` | 472 |
| `selectionCounts()` | 475 |

내보내는 값 — `HISTORY_MAX` · `ACHIEVEMENTS` · `achGrid` · `statGrid` · `REGION_MAX` · `CMD_HELP` · `CMD_LIST` · `BP_KEY`

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
| `toggleHelp(on)` | 292 |
| `setHelpTab(showAch)` | 305 |
| `bootProgress(msg, frac)` | 320 |
| `bootDone()` | 325 |
| `noteBlockUse(b)` | 336 |
| `sortPickByRecent()` | 342 |
| `refreshPickFilter()` | 352 |
| `openCmd()` | 379 |
| `closeCmd()` | 386 |
| `cmdSay(msg)` | 391 |
| `drawPreview()` | 396 |

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
| `tutLine(i)` | 58 |
| `refreshHint()` | 59 |
| `advanceTut(step)` | 62 |
| `agoText(ms)` | 73 |
| `refreshSlots()` | 81 |
| `cloudSay(msg, kind)` | 204 |
| `refreshCloud()` | 209 |
| `refreshTerrain()` | 314 |
| `refreshBindLabels()` | 340 |
| `hintText(base)` | 348 |
| `refreshKeyButtons()` | 355 |
| `bindConflict(act, code)` | 388 |
| `shareLink()` | 425 |
| `refreshMenu()` | 437 |
| `beginPlay()` | 449 |
| `endPlay()` | 475 |
| `useDragMode()` | 494 |
| `goFullscreen()` | 496 |
| `requestPlay()` | 513 |
| `hashSeed(str)` | 547 |
| `applyLook(dx, dy)` | 569 |
| `cycleTime()` | 589 |
| `pickBlock()` | 601 |
| `setStick(dx, dy)` | 920 |
| `bindHold(id, onDown, onUp)` | 1020 |
| `bindOpt(inputId, outId, key, fmt)` | 1053 |
| `pollGamepad(dt)` | 1116 |

내보내는 값 — `overlay` · `goBtn` · `altBtn` · `seedIn` · `canvas` · `isTouch` · `HINT_LOCK` · `HINT_DRAG` · `hintEl` · `TUT` · `TUT_TOUCH` · `slotsEl` · `copySeedBtn` · `expBtn` · `impBtn` · `resBtn` · `fileIn` · `terrainEl` · `KEY_LABEL` · `keysEl` · `RESERVED` · `copyLinkBtn` · `lookLast` · `stickZone` · `stickBase` · `stickKnob` · `STICK_R` · `padState`

### `mine.js` — 캐기 · 놓기

| 함수 | 줄 |
|---|---:|
| `mineAt(hit)` | 16 |
| `upperFromHit(hit)` | 40 |
| `canPlaceAt(px, py, pz)` | 47 |
| `tryInteract(hit)` | 59 |
| `place(repeating)` | 102 |

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

### `loop.js` — 게임 루프

| 함수 | 줄 |
|---|---:|
| `newWorld(seed)` | 34 |
| `step(dt)` | 68 |
| `animate()` | 572 |
| `autoTuneFar(fps)` | 648 |
| `farNow()` | 666 |
| `refreshPerf()` | 668 |

내보내는 값 — `GRAVITY` · `PLACE_DELAY` · `SNEAK_MUL` · `AIR_CONTROL` · `fwd` · `clock`
