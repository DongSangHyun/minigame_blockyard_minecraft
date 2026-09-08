<!-- 자동 생성 파일 — 직접 고치지 말고 `node tools/codemap.mjs` 를 다시 실행하세요 -->
# CODEMAP — 코드 색인

생성일 2026-09-08 · 모듈 28개 · 합계 9,870줄

진입점은 `index.html` → `src/main.js`. 아래 표는 **의존 순서**로 정렬돼 있습니다 —
위에 있는 모듈은 아래 모듈을 모릅니다(순환이 있는 곳은 함수 호출 시점에만 서로를 봅니다).

## 모듈 지도

| 모듈 | 하는 일 | 줄 | 기대는 곳 |
|---|---|---:|---|
| [`state.js`](../src/state.js) | 여러 모듈이 값을 바꾸는 공유 상태 | 163 | — |
| [`dims.js`](../src/dims.js) | 세계 치수와 좌표 계산 (의존성 없음) | 10 | — |
| [`queues.js`](../src/queues.js) | 시뮬레이션 대기열 (의존성 없음) | 36 | — |
| [`boot.js`](../src/boot.js) | 부팅 가드 · 환경 판별 | 26 | state |
| [`blocks.js`](../src/blocks.js) | 블록 정의 · 모양 · 성질 | 285 | state |
| [`tree.js`](../src/tree.js) | 나무 한 그루의 모양 | 47 | — |
| [`atlas.js`](../src/atlas.js) | 텍스처 아틀라스 (코드로 그리는 16×16 도트) | 554 | blocks |
| [`world.js`](../src/world.js) | 월드 데이터 · 지형 생성 | 599 | state · tree · queues · dims · blocks · atlas |
| [`light.js`](../src/light.js) | 광원 — 햇빛과 블록광 BFS | 182 | state · dims · blocks · world · mesh · player |
| [`fluids.js`](../src/fluids.js) | 물 흐름 · 낙하 블록 · 잎 부패 | 748 | state · settings · queues · dims · blocks · world · tree · light · mesh · scene · audio · player · edit |
| [`mesh.js`](../src/mesh.js) | 면 데이터 + 청크 메싱 | 272 | dims · blocks · atlas · world · light |
| [`scene.js`](../src/scene.js) | three.js 씬 · 셰이더 · 파티클 | 537 | dims · boot · blocks · atlas · world · mesh |
| [`daynight.js`](../src/daynight.js) | 낮과 밤 | 83 | state · world · scene |
| [`settings.js`](../src/settings.js) | 설정 | 43 | state · boot · scene |
| [`player.js`](../src/player.js) | 플레이어 · 충돌 · 레이캐스트 | 319 | state · dims · blocks · world · scene |
| [`audio.js`](../src/audio.js) | 소리 | 257 | state · blocks · daynight · settings |
| [`save.js`](../src/save.js) | 저장 · 불러오기 | 291 | state · dims · blocks · world · player · mobs · hud · sky |
| [`edit.js`](../src/edit.js) | 편집 · 되돌리기 · 도전 과제 | 976 | state · queues · settings · save · dims · blocks · world · light · fluids · mesh · player · audio · hud · sky |
| [`hud.js`](../src/hud.js) | HUD · 핫바 · 블록 고르기 · 미니맵 | 487 | state · version · dims · blocks · atlas · world · player · hand · input |
| [`hand.js`](../src/hand.js) | 1인칭 손과 들고 있는 블록 | 165 | state · settings · blocks · atlas · world · mesh · scene · player · dims · light · daynight |
| [`input.js`](../src/input.js) | 입력 (키보드 · 마우스 · 터치) | 1425 | state · world · queues · mobs · dims · mesh · light · boot · blocks · scene · daynight · settings · player · audio · save · cloud · edit · hud · hand · mine · sky · loop |
| [`mine.js`](../src/mine.js) | 캐기 · 놓기 | 219 | state · mobs · fluids · dims · blocks · world · scene · player · audio · edit · hud · hand · input |
| [`mobs.js`](../src/mobs.js) | 걸어 다니는 동물. 세계에 "살아 있는 것" 을 하나 넣는다. | 502 | dims · world · blocks · scene · player · audio |
| [`sky.js`](../src/sky.js) | 해와 달과 별 · 날씨 · 앰비언트 생물 | 365 | state · audio · dims · atlas · world · scene · daynight · player |
| [`cloud.js`](../src/cloud.js) | 기기 사이 이어하기 (GitHub Gist 에 세계를 올리고 내려받는다) | 226 | state · save |
| [`loop.js`](../src/loop.js) | 게임 루프 | 802 | state · input · mobs · queues · dims · blocks · atlas · world · light · fluids · mesh · scene · daynight · settings · player · audio · save · edit · hud · hand · mine · sky |
| [`version.js`](../src/version.js) | 빌드 도장 (자동 생성) | 8 | — |
| [`main.js`](../src/main.js) | 조립과 시작 | 243 | state · tree · mobs · atlas · queues · dims · blocks · world · light · fluids · mesh · scene · daynight · settings · player · audio · save · cloud · edit · hud · hand · input · mine · sky · loop |

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
| `resetQueues()` | 25 |

내보내는 값 — `Q`

### `boot.js` — 부팅 가드 · 환경 판별

| 함수 | 줄 |
|---|---:|
| `bail(msg)` | 4 |

내보내는 값 — `reduceMotion` · `IS_TOUCH`

### `blocks.js` — 블록 정의 · 모양 · 성질

| 함수 | 줄 |
|---|---:|
| `isWool(b)` | 27 |
| `hardnessOf(b)` | 124 |
| `isUnbreakable(b)` | 127 |
| `isCross(b)` | 146 |
| `needsFloor(b)` | 147 |
| `isItem(b)` | 158 |
| `isConnecting(b)` | 162 |
| `isClimbable(b)` | 164 |
| `isOpenable(b)` | 166 |
| `isFlammable(b)` | 168 |
| `connectsTo(self, other)` | 175 |
| `isLog(b)` | 182 |
| `isLeaf(b)` | 183 |
| `isDoorShape(sh)` | 203 |
| `doorOpen(sh)` | 204 |
| `doorFacing(sh)` | 205 |
| `doorShapeFor(facing, open)` | 206 |
| `isWallShape(sh)` | 209 |
| `isStairShape(sh)` | 211 |
| `wallShapeFor(nx, nz)` | 214 |
| `crossOffset(sh)` | 221 |
| `faceKindFor(sh, f, base)` | 251 |
| `isAxisShape(sh)` | 256 |
| `isLiquid(b)` | 258 |
| `isTransparent(b)` | 259 |
| `isSolid(b)` | 260 |
| `isThin(b)` | 262 |
| `blocksLight(b)` | 263 |
| `lightPass(b)` | 264 |
| `categoryOf(b)` | 274 |

내보내는 값 — `AIR` · `TNT` · `DOOR` · `SAPLING` · `BOOKSHELF` · `WOOL0` · `WOOL_COLORS` · `TILES` · `NAMES` · `NAMES_EN` · `HARDNESS` · `EMIT` · `CROSS` · `ALL_BLOCKS` · `ITEMS` · `DEFAULT_BAR` · `DEFAULT_BAR2` · `SH_FULL` · `SH_UP_OFF` · `SH_SLAB_UP` · `SH_AXIS_X` · `SH_WALL_N` · `WALL_DIR` · `SH_DOOR_N` · `SH_DOOR_OPEN_OFF` · `SHAPE_BOXES` · `SHAPE_NAMES`

### `tree.js` — 나무 한 그루의 모양

| 함수 | 줄 |
|---|---:|
| `growTree(x, y, z, kind, logB, leafB, rnd, peek, put, air, maxY)` | 15 |

### `atlas.js` — 텍스처 아틀라스 (코드로 그리는 16×16 도트)

| 함수 | 줄 |
|---|---:|
| `tileOrigin(i)` | 9 |
| `makeRng(seed)` | 11 |
| `paint(index, fn)` | 21 |
| `pick(rng, list)` | 29 |
| `orePaint(tint1, tint2)` | 124 |
| `tileAvg(i)` | 451 |
| `tileSwatch(i)` | 466 |
| `atlasSample(i)` | 540 |
| `animateLiquids(t)` | 547 |

내보내는 값 — `TILE` · `atlas` · `actx` · `atlasTex` · `SWATCH_N` · `AVG_TOP` · `crackTex`

### `world.js` — 월드 데이터 · 지형 생성

| 함수 | 줄 |
|---|---:|
| `get(x, y, z)` | 18 |
| `set(x, y, z, b)` | 23 |
| `shapeAt(x, y, z)` | 26 |
| `refreshTop(x, z)` | 28 |
| `surfaceTop(x, y, z)` | 37 |
| `crossBase(x, y, z)` | 49 |
| `dynamicBoxes(b, x, y, z)` | 56 |
| `hasDynamicBoxes(b)` | 118 |
| `boxesAt(b, sh, x, y, z)` | 191 |
| `markX(m)` | 206 |
| `markY(m)` | 207 |
| `markZ(m)` | 208 |
| `markName(m)` | 209 |
| `markSeen(px, pz, r, bit)` | 213 |
| `seenRatio()` | 228 |
| `markTouched(x, y, z)` | 234 |
| `isTouched(x, y, z)` | 237 |
| `refreshAllTops()` | 241 |
| `hash2(x, y, seed)` | 245 |
| `hash3(x, y, z, seed)` | 250 |
| `smooth(t)` | 256 |
| `lerp(a, b, t)` | 257 |
| `noise2(x, y, seed)` | 259 |
| `noise3(x, y, z, seed)` | 266 |
| `generate(seed)` | 276 |

내보내는 값 — `world` · `shape` · `heightMap` · `topMap` · `biomeMap` · `waterLvl` · `BIOME_NAMES` · `touched` · `SEEN_TOP` · `seenMap`

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
| `enqueueWater(x, y, z)` | 18 |
| `enqueueDry(x, y, z)` | 22 |
| `enqueueDryAround(x, y, z)` | 26 |
| `enqueueWaterAround(x, y, z)` | 30 |
| `queueLeafDecay(x, y, z)` | 39 |
| `decayTick(budget)` | 77 |
| `isFalling(b)` | 94 |
| `enqueueFall(x, y, z)` | 95 |
| `fallTick(budget)` | 99 |
| `waterTick(budget)` | 147 |
| `enqueueFreeze(x, y, z)` | 222 |
| `freezeTick(budget)` | 228 |
| `dryTick(budget)` | 252 |
| `get2(i, dx, dy, dz)` | 277 |
| `fedSideways(i, y, lvl)` | 283 |
| `removeWater(i, y)` | 294 |
| `ignite(x, y, z)` | 321 |
| `grassTick(px, py, pz, tries)` | 355 |
| `enqueueLava(x, y, z)` | 396 |
| `enqueueLavaAround(x, y, z)` | 401 |
| `enqueueLavaDry(x, y, z)` | 405 |
| `enqueueLavaDryAround(x, y, z)` | 409 |
| `lavaFlowTick(budget)` | 427 |
| `lavaDryTick(budget)` | 479 |
| `lavaTick(px, py, pz, tries)` | 509 |
| `fireTick(budget)` | 529 |
| `primeTNT(x, y, z, fuse)` | 609 |
| `primeTick(dt)` | 620 |
| `explode(cx, cy, cz, radius)` | 635 |
| `enqueueGrow(x, y, z)` | 673 |
| `growTick(dt)` | 695 |

내보내는 값 — `MAXFLOW` · `DECAY_R` · `FIRE_LIFE` · `FIRE_REACH` · `GRASS_REACH` · `LAVA_FLOW` · `LAVA_REACH` · `BLAST_R` · `TNT_FUSE` · `GROW_EVERY` · `GROW_CHANCE` · `GROW_LIGHT`

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
| `boxesToEdges(boxes)` | 278 |
| `dynamicHighlight(boxes)` | 300 |
| `burst(x, y, z, blockId, count)` | 407 |
| `updateParticles(dt)` | 428 |
| `updateEdge(px, pz)` | 485 |
| `updatePasteBox(c, p)` | 513 |
| `updateSelectionBox(b, anchor)` | 523 |

내보내는 값 — `matOpaque` · `scene` · `stage` · `VOX_VS` · `VOX_FS` · `voxUniforms` · `skyUniforms` · `sky` · `OUTER_SEA_Y` · `outerSea` · `FREE_DIST` · `chunkFreed` · `cloudMat` · `cloudMatHigh` · `cloudGroup` · `cloudGroupHigh` · `HL_EDGES` · `HL_GEO` · `HL_CROSS` · `SHAPE_BOUNDS` · `PRIMED_MAX` · `primedMat` · `primedBoxes` · `highlight` · `crackMat` · `crackMesh` · `PMAX` · `pPos` · `pVel` · `pCount` · `pGeo` · `pMat` · `particles` · `edgeMat` · `edgeGroup` · `SEL_DONE` · `selMat` · `selBox` · `pasteMat` · `pasteBox`

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
| `calmMotion()` | 23 |
| `saveOpts()` | 24 |
| `applyOpts()` | 27 |

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
| `breakSound(b)` | 111 |
| `stepSound(b, through)` | 117 |
| `setMuffle(on)` | 127 |
| `rainHiss(vol)` | 137 |
| `thunder(delayMs, near)` | 141 |
| `moodChord(night, vol)` | 152 |
| `caveSound(depthMix)` | 165 |
| `at(x, y, z)` | 178 |
| `listenAt(x, y, z, fx, fz)` | 194 |
| `lavaPop(vol, node)` | 210 |
| `splash(vol, node)` | 215 |
| `waterLap(vol, node)` | 222 |
| `birdCall(node)` | 228 |
| `fireCrackle(vol, node)` | 234 |
| `lavaHiss()` | 240 |
| `placeSound(b)` | 245 |
| `miningSound(b)` | 252 |

내보내는 값 — `SOFT`

### `save.js` — 저장 · 불러오기

| 함수 | 줄 |
|---|---:|
| `slotKey(n)` | 17 |
| `curKey()` | 18 |
| `slotInfo(n)` | 19 |
| `renameSlot(n, name)` | 32 |
| `hasSave()` | 44 |
| `encodeArrB64(arr)` | 50 |
| `decodeArrB64(b64, arr, len)` | 69 |
| `encodeWorldB64()` | 89 |
| `decodeWorldB64(b64)` | 90 |
| `encodeWorld()` | 91 |
| `decodeWorld(runs, dst, len)` | 100 |
| `liftLegacy(src, dst, asRuns)` | 115 |
| `saveGame()` | 130 |
| `loadGame()` | 162 |
| `clearSave()` | 220 |
| `backupKey(n)` | 227 |
| `pushBackup()` | 230 |
| `prevKey(n)` | 240 |
| `pushPrev()` | 241 |
| `hasBackup()` | 248 |
| `restoreBackup()` | 253 |
| `exportWorld()` | 264 |
| `importWorldText(text)` | 280 |

내보내는 값 — `SAVE_KEY` · `OLD_KEY` · `SLOTS`

### `edit.js` — 편집 · 되돌리기 · 도전 과제

| 함수 | 줄 |
|---|---:|
| `applyEdit(x, y, z, to, record, sh, depth)` | 62 |
| `batchPush(b, x, y, z, from, to, fromSh, toSh, wl)` | 140 |
| `beginBatch(cap)` | 149 |
| `ownFire()` | 156 |
| `settleWorld(list)` | 168 |
| `endBatch(label)` | 203 |
| `editLabel(e)` | 248 |
| `undo()` | 268 |
| `redo()` | 287 |
| `refreshAchList()` | 347 |
| `checkBuildAchievements()` | 371 |
| `refreshStats()` | 473 |
| `achCount()` | 491 |
| `unlock(id)` | 496 |
| `selectionBounds()` | 523 |
| `selectionSize()` | 524 |
| `fillSelection(block, sh, only)` | 534 |
| `clearSelection()` | 553 |
| `copySelection()` | 567 |
| `mirrorClip()` | 609 |
| `rotateClip()` | 628 |
| `pasteClip(px, py, pz)` | 648 |
| `completeCommand(prefix)` | 699 |
| `runCommand(line)` | 706 |
| `loadBlueprints()` | 901 |
| `saveBlueprint(name)` | 904 |
| `useBlueprint(name)` | 920 |
| `blueprintNames()` | 936 |
| `blueprintList()` | 939 |
| `deleteBlueprint(name)` | 949 |
| `selectionCounts()` | 959 |

내보내는 값 — `HISTORY_MAX` · `FIRE_UNDO_MAX` · `BATCH_RELIGHT_ALL` · `HISTORY_CELLS_MAX` · `lastEditLabel` · `undoEmptyWhy` · `ACHIEVEMENTS` · `achGrid` · `BUILD_R` · `BUILD_IDS` · `statGrid` · `REGION_MAX` · `CMD_HELP` · `CMD_LIST` · `BP_KEY`

### `hud.js` — HUD · 핫바 · 블록 고르기 · 미니맵

| 함수 | 줄 |
|---|---:|
| `drawIcon(cv, blockId)` | 15 |
| `refreshSlot(i)` | 71 |
| `refreshBar()` | 78 |
| `selectSlot(i)` | 82 |
| `openPicker()` | 124 |
| `closePicker(resume)` | 135 |
| `facingText()` | 148 |
| `showAchPop(name, desc)` | 159 |
| `showHud(on)` | 189 |
| `toast(msg)` | 195 |
| `refreshMinimapCap()` | 205 |
| `drawMinimap()` | 213 |
| `helpOpen()` | 345 |
| `toggleHelp(on)` | 346 |
| `setHelpTab(showAch)` | 365 |
| `bootProgress(msg, frac)` | 380 |
| `bootDone()` | 385 |
| `noteBlockUse(b)` | 396 |
| `sortPickByRecent()` | 402 |
| `refreshPickFilter()` | 412 |
| `openCmd()` | 439 |
| `closeCmd()` | 446 |
| `cmdSay(msg)` | 451 |
| `drawPreview(target)` | 457 |

내보내는 값 — `hotbarEl` · `slotCanvases` · `pickerEl` · `pickGrid` · `pickBtns` · `FACING` · `tFace` · `tAch` · `tBiome` · `achPop` · `tPos` · `underwaterEl` · `inblockEl` · `airEl` · `perfEl` · `airBar` · `minimapEl` · `mmCap` · `touchEl` · `hudEls` · `toastEl` · `mmCanvas` · `mmCtx` · `mmImage` · `stampEl` · `helpEl` · `helpAchBtn` · `helpAchList` · `helpCols` · `bootEl` · `bootMsg` · `bootBar` · `pickFind` · `pickTabs` · `pickCat` · `cmdEl` · `cmdIn` · `cmdMsg` · `previewEl` · `previewCap`

### `hand.js` — 1인칭 손과 들고 있는 블록

| 함수 | 줄 |
|---|---:|
| `makeBlockGeometry(b, sh, only)` | 21 |
| `updateHandBlock()` | 100 |
| `updateGhost(px, py, pz, upper)` | 120 |
| `triggerSwing()` | 137 |
| `updateHandLight(dt)` | 140 |
| `updateHand(dt)` | 155 |

내보내는 값 — `handScene` · `handCam` · `handGroup` · `handMat` · `heldMesh` · `armMat` · `arm` · `ghostMat` · `ghostMesh`

### `input.js` — 입력 (키보드 · 마우스 · 터치)

| 함수 | 줄 |
|---|---:|
| `tutLine(i)` | 64 |
| `refreshHint()` | 65 |
| `advanceTutTouch(step)` | 72 |
| `advanceTut(step)` | 73 |
| `agoText(ms)` | 84 |
| `refreshSlots()` | 100 |
| `aimCell(reach, strict)` | 189 |
| `selectionText()` | 203 |
| `afterWorldSwap(msg, loaded)` | 219 |
| `cloudSay(msg, kind)` | 277 |
| `refreshCloud()` | 282 |
| `refreshTerrain()` | 387 |
| `refreshBindLabels()` | 413 |
| `hintText(base)` | 421 |
| `refreshKeyButtons()` | 428 |
| `bindConflict(act, code)` | 461 |
| `shareLink()` | 498 |
| `refreshBlueprints()` | 511 |
| `refreshResume()` | 557 |
| `refreshMenu()` | 596 |
| `beginPlay()` | 610 |
| `endPlay()` | 636 |
| `useDragMode()` | 655 |
| `goFullscreen()` | 657 |
| `requestPlay()` | 674 |
| `hashSeed(str)` | 708 |
| `applyLook(dx, dy)` | 730 |
| `cycleTime()` | 750 |
| `pickBlock()` | 762 |
| `setStick(dx, dy)` | 1138 |
| `bindHold(id, onDown, onUp)` | 1240 |
| `bindOpt(inputId, outId, key, fmt)` | 1296 |
| `pollGamepadMenu()` | 1354 |
| `pollGamepad(dt)` | 1364 |

내보내는 값 — `overlay` · `goBtn` · `altBtn` · `seedIn` · `canvas` · `isTouch` · `HINT_LOCK` · `HINT_DRAG` · `HINT_TOUCH` · `hintEl` · `TUT` · `TUT_TOUCH` · `slotsEl` · `copySeedBtn` · `expBtn` · `impBtn` · `resBtn` · `fileIn` · `terrainEl` · `KEY_LABEL` · `keysEl` · `RESERVED` · `copyLinkBtn` · `lookLast` · `stickZone` · `stickBase` · `stickKnob` · `STICK_R` · `padState`

### `mine.js` — 캐기 · 놓기

| 함수 | 줄 |
|---|---:|
| `mineAt(hit)` | 16 |
| `upperFromHit(hit)` | 47 |
| `canPlaceAt(px, py, pz)` | 54 |
| `tryInteract(hit)` | 66 |
| `doorOther(x, y, z)` | 103 |
| `place(repeating)` | 133 |

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
| `applyWeather()` | 191 |
| `localBiome()` | 205 |
| `updateStorm(dt)` | 212 |
| `updateWeather(dt)` | 223 |
| `seedCreatures()` | 317 |
| `placeCreature(i)` | 325 |
| `updateCreatures(dt)` | 335 |

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
| `newWorld(seed)` | 33 |
| `step(dt)` | 73 |
| `animate()` | 671 |
| `autoTuneFar(fps)` | 759 |
| `farNow()` | 777 |
| `refreshPerf()` | 779 |

내보내는 값 — `GRAVITY` · `PLACE_DELAY` · `SNEAK_MUL` · `AIR_CONTROL` · `fwd` · `clock`

### `version.js` — 빌드 도장 (자동 생성)

내보내는 값 — `BUILD`
