<!-- 자동 생성 파일 — 직접 고치지 말고 `node tools/codemap.mjs` 를 다시 실행하세요 -->
# CODEMAP — 코드 색인

생성일 2026-09-11 · 모듈 29개 · 합계 13,338줄

진입점은 `index.html` → `src/main.js`. 아래 표는 **의존 순서**로 정렬돼 있습니다 —
위에 있는 모듈은 아래 모듈을 모릅니다(순환이 있는 곳은 함수 호출 시점에만 서로를 봅니다).

## 모듈 지도

| 모듈 | 하는 일 | 줄 | 기대는 곳 |
|---|---|---:|---|
| [`state.js`](../src/state.js) | 여러 모듈이 값을 바꾸는 공유 상태 | 203 | — |
| [`dims.js`](../src/dims.js) | 세계 치수와 좌표 계산 (의존성 없음) | 28 | — |
| [`queues.js`](../src/queues.js) | 시뮬레이션 대기열 (의존성 없음) | 36 | — |
| [`boot.js`](../src/boot.js) | 부팅 가드 · 환경 판별 | 29 | state |
| [`blocks.js`](../src/blocks.js) | 블록 정의 · 모양 · 성질 | 352 | state |
| [`tree.js`](../src/tree.js) | 나무 한 그루의 모양 | 47 | — |
| [`atlas.js`](../src/atlas.js) | 텍스처 아틀라스 (코드로 그리는 16×16 도트) | 711 | blocks |
| [`world.js`](../src/world.js) | 월드 데이터 · 지형 생성 | 1206 | state · tree · queues · dims · blocks · atlas |
| [`light.js`](../src/light.js) | 광원 — 햇빛과 블록광 BFS | 182 | state · dims · blocks · world · mesh · player |
| [`fluids.js`](../src/fluids.js) | 물 흐름 · 낙하 블록 · 잎 부패 | 900 | state · atlas · settings · queues · dims · blocks · world · tree · light · mesh · scene · audio · player · edit |
| [`mesh.js`](../src/mesh.js) | 면 데이터 + 청크 메싱 | 428 | dims · blocks · atlas · world · light |
| [`scene.js`](../src/scene.js) | three.js 씬 · 셰이더 · 파티클 | 648 | dims · boot · blocks · atlas · world · mesh |
| [`daynight.js`](../src/daynight.js) | 낮과 밤 | 88 | state · world · scene |
| [`settings.js`](../src/settings.js) | 설정 | 106 | state · boot · scene |
| [`player.js`](../src/player.js) | 플레이어 · 충돌 · 레이캐스트 | 361 | state · dims · blocks · world · scene |
| [`audio.js`](../src/audio.js) | 소리 | 354 | state · blocks · daynight · settings |
| [`save.js`](../src/save.js) | 저장 · 불러오기 | 377 | state · dims · blocks · world · player · mobs · hud · sky |
| [`edit.js`](../src/edit.js) | 편집 · 되돌리기 · 도전 과제 | 1285 | state · queues · settings · save · dims · blocks · world · light · fluids · mesh · player · audio · hud · sky |
| [`hud.js`](../src/hud.js) | HUD · 핫바 · 블록 고르기 · 미니맵 | 761 | state · version · dims · blocks · atlas · world · player · hand · input |
| [`hand.js`](../src/hand.js) | 1인칭 손과 들고 있는 블록 | 201 | state · settings · blocks · atlas · world · mesh · scene · player · dims · light · daynight |
| [`body.js`](../src/body.js) | 3인칭에서 보이는 플레이어 몸 | 200 | state · settings · scene · player · atlas · hand · blocks |
| [`input.js`](../src/input.js) | 입력 (키보드 · 마우스 · 터치) | 1888 | state · world · queues · mobs · dims · mesh · light · boot · blocks · scene · daynight · settings · player · audio · save · cloud · edit · hud · hand · mine · sky · loop |
| [`mine.js`](../src/mine.js) | 캐기 · 놓기 | 283 | state · mobs · fluids · dims · blocks · world · light · scene · player · audio · edit · hud · hand · input |
| [`mobs.js`](../src/mobs.js) | 걸어 다니는 동물. 세계에 "살아 있는 것" 을 하나 넣는다. | 643 | dims · world · blocks · scene · player · audio · light · daynight · state |
| [`sky.js`](../src/sky.js) | 해와 달과 별 · 날씨 · 앰비언트 생물 | 486 | state · audio · dims · atlas · blocks · world · scene · daynight · player |
| [`cloud.js`](../src/cloud.js) | 기기 사이 이어하기 (GitHub Gist 에 세계를 올리고 내려받는다) | 243 | state · save |
| [`loop.js`](../src/loop.js) | 게임 루프 | 993 | state · input · mobs · queues · dims · blocks · atlas · world · light · fluids · mesh · scene · daynight · settings · player · audio · save · edit · hud · hand · body · mine · sky |
| [`version.js`](../src/version.js) | 빌드 도장 (자동 생성) | 8 | — |
| [`main.js`](../src/main.js) | 조립과 시작 | 291 | state · tree · mobs · atlas · queues · dims · blocks · world · light · fluids · mesh · scene · daynight · settings · player · audio · save · cloud · edit · hud · hand · body · input · mine · sky · loop |

## 모듈별 공개 함수

### `state.js` — 여러 모듈이 값을 바꾸는 공유 상태

내보내는 값 — `S`

### `dims.js` — 세계 치수와 좌표 계산 (의존성 없음)

| 함수 | 줄 |
|---|---:|
| `setGen(g)` | 19 |
| `seaLift()` | 24 |
| `idx(x, y, z)` | 25 |
| `inside(x, y, z)` | 26 |

내보내는 값 — `WX` · `LEGACY_WY` · `CX` · `N` · `SEA_V1` · `SEA_V2` · `GEN_LATEST` · `GEN` · `SEA` · `DIRS`

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
| `isSapling(b)` | 39 |
| `isCarpet(b)` | 42 |
| `isWool(b)` | 50 |
| `hardnessOf(b)` | 166 |
| `isUnbreakable(b)` | 169 |
| `isCross(b)` | 190 |
| `needsFloor(b)` | 191 |
| `needsWall(b)` | 193 |
| `isItem(b)` | 206 |
| `isConnecting(b)` | 218 |
| `isClimbable(b)` | 220 |
| `isOpenable(b)` | 222 |
| `isFlammable(b)` | 224 |
| `connectsTo(self, other)` | 232 |
| `isLog(b)` | 239 |
| `isLeaf(b)` | 240 |
| `isDoorShape(sh)` | 260 |
| `doorOpen(sh)` | 261 |
| `doorFacing(sh)` | 262 |
| `doorShapeFor(facing, open)` | 263 |
| `isWallShape(sh)` | 266 |
| `isStairShape(sh)` | 268 |
| `wallShapeFor(nx, nz)` | 271 |
| `crossOffset(sh)` | 278 |
| `faceKindFor(sh, f, base)` | 308 |
| `isAxisShape(sh)` | 313 |
| `isLiquid(b)` | 315 |
| `isTransparent(b)` | 316 |
| `isSolid(b)` | 317 |
| `isThin(b)` | 319 |
| `blocksLight(b)` | 320 |
| `lightPass(b)` | 323 |
| `categoryOf(b)` | 340 |

내보내는 값 — `AIR` · `TNT` · `DOOR` · `SAPLING` · `BOOKSHELF` · `CARPET0` · `POT` · `BUCKET` · `SAPLING_BIRCH` · `SPRUCE_LOG` · `WOOL0` · `WOOL_COLORS` · `TILES` · `BUCKET_TILE` · `NAMES` · `NAMES_EN` · `HARDNESS` · `EMIT` · `CROSS` · `ALL_BLOCKS` · `ITEMS` · `DEFAULT_BAR` · `DEFAULT_BAR2` · `SH_FULL` · `SH_UP_OFF` · `SH_SLAB_UP` · `SH_AXIS_X` · `SH_WALL_N` · `WALL_DIR` · `SH_DOOR_N` · `SH_DOOR_OPEN_OFF` · `SHAPE_BOXES` · `SHAPE_NAMES`

### `tree.js` — 나무 한 그루의 모양

| 함수 | 줄 |
|---|---:|
| `growTree(x, y, z, kind, logB, leafB, rnd, peek, put, air, maxY)` | 15 |

### `atlas.js` — 텍스처 아틀라스 (코드로 그리는 16×16 도트)

| 함수 | 줄 |
|---|---:|
| `tileOrigin(i)` | 9 |
| `makeRng(seed)` | 11 |
| `paint(index, fn)` | 25 |
| `pick(rng, list)` | 37 |
| `orePaint(tint1, tint2)` | 132 |
| `tileAvg(i)` | 608 |
| `tileSwatch(i)` | 623 |
| `atlasSample(i)` | 697 |
| `animateLiquids(t)` | 704 |

내보내는 값 — `TILE` · `atlas` · `actx` · `painted` · `atlasTex` · `SWATCH_N` · `AVG_TOP` · `crackTex`

### `world.js` — 월드 데이터 · 지형 생성

| 함수 | 줄 |
|---|---:|
| `get(x, y, z)` | 18 |
| `set(x, y, z, b, sh)` | 26 |
| `shapeAt(x, y, z)` | 29 |
| `refreshTop(x, z)` | 31 |
| `surfaceTop(x, y, z)` | 40 |
| `crossBase(x, y, z)` | 52 |
| `dynamicBoxes(b, x, y, z)` | 59 |
| `hasDynamicBoxes(b)` | 134 |
| `boxesAt(b, sh, x, y, z)` | 208 |
| `markX(m)` | 223 |
| `markY(m)` | 224 |
| `markZ(m)` | 225 |
| `markName(m)` | 226 |
| `underBand(y)` | 238 |
| `expandLegacySeen()` | 246 |
| `markSeen(px, pz, r, bit)` | 251 |
| `seenRatio()` | 269 |
| `markTouched(x, y, z)` | 279 |
| `isTouched(x, y, z)` | 282 |
| `setTouched(x, y, z, on)` | 288 |
| `refreshAllTops()` | 292 |
| `snapshotSeaCol()` | 302 |
| `hash2(x, y, seed)` | 309 |
| `hash3(x, y, z, seed)` | 314 |
| `smooth(t)` | 320 |
| `lerp(a, b, t)` | 321 |
| `noise2(x, y, seed)` | 323 |
| `noise3(x, y, z, seed)` | 330 |
| `oreCeil()` | 341 |
| `lavaTop()` | 347 |
| `generate(seed, gen)` | 349 |

내보내는 값 — `world` · `shape` · `heightMap` · `topMap` · `biomeMap` · `waterLvl` · `BIOME_NAMES` · `touched` · `SEEN_TOP` · `UNDER_BANDS` · `SEEN_UNDER_ALL` · `seenMap` · `seaCol` · `MOUTH_DEPTH` · `MOUTH_W` · `MINE_W` · `BOULDER_MIN` · `boulderCells`

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
| `enqueueWater(x, y, z)` | 19 |
| `enqueueDry(x, y, z)` | 23 |
| `enqueueDryAround(x, y, z)` | 27 |
| `enqueueWaterAround(x, y, z)` | 31 |
| `queueLeafDecay(x, y, z)` | 40 |
| `decayTick(budget)` | 82 |
| `isFalling(b)` | 115 |
| `enqueueFall(x, y, z)` | 116 |
| `fallTick(budget)` | 120 |
| `isSeaColumn(x, y, z)` | 192 |
| `sweepSeaCache()` | 215 |
| `isSeaCell(x, y, z)` | 220 |
| `waterTick(budget)` | 257 |
| `enqueueFreeze(x, y, z)` | 346 |
| `freezeTick(budget)` | 352 |
| `dryTick(budget)` | 376 |
| `get2(i, dx, dy, dz)` | 405 |
| `fedSideways(i, y, lvl)` | 411 |
| `removeWater(i, y)` | 422 |
| `ignite(x, y, z)` | 450 |
| `grassTick(px, py, pz, tries)` | 484 |
| `enqueueLava(x, y, z)` | 525 |
| `enqueueLavaAround(x, y, z)` | 530 |
| `enqueueLavaDry(x, y, z)` | 534 |
| `enqueueLavaDryAround(x, y, z)` | 538 |
| `lavaFlowTick(budget)` | 556 |
| `lavaDryTick(budget)` | 611 |
| `lavaTick(px, py, pz, tries)` | 643 |
| `fireTick(budget)` | 663 |
| `primeTNT(x, y, z, fuse)` | 743 |
| `primeTick(dt)` | 754 |
| `explode(cx, cy, cz, radius)` | 769 |
| `enqueueGrow(x, y, z)` | 807 |
| `growTick(dt)` | 830 |

내보내는 값 — `MAXFLOW` · `DECAY_R` · `FIRE_LIFE` · `FIRE_REACH` · `GRASS_REACH` · `LAVA_FLOW` · `LAVA_REACH` · `BLAST_R` · `TNT_FUSE` · `GROW_EVERY` · `GROW_CHANCE` · `GROW_LIGHT`

### `mesh.js` — 면 데이터 + 청크 메싱

| 함수 | 줄 |
|---|---:|
| `aoValue(s1, s2, cor)` | 44 |
| `chunkId(cx, cy, cz)` | 50 |
| `chunkCX(id)` | 51 |
| `chunkCZ(id)` | 52 |
| `chunkCY(id)` | 53 |
| `buildChunk(cx, cy, cz)` | 92 |
| `emitCross(P, U, C, L, I, x, y, z, b, ci, T)` | 320 |
| `applyGeo(mesh, pos, uv, col, lit, ind, tile)` | 354 |
| `markDirty(x, y, z)` | 380 |
| `touch(x, y, z)` | 386 |
| `rebuildAll()` | 390 |
| `markAllDirty()` | 395 |
| `setBuildFocus(v)` | 400 |
| `buildBudget(ms)` | 402 |

내보내는 값 — `FACES` · `FACE_UV` · `AO_LEVELS` · `opaqueMeshes` · `chunkFilled` · `chunkCenters` · `CROSS_PLANES` · `dirty` · `buildFocus`

### `scene.js` — three.js 씬 · 셰이더 · 파티클

| 함수 | 줄 |
|---|---:|
| `voxMaterial(extra)` | 120 |
| `outerSeaY()` | 171 |
| `updateOuterSea(camY)` | 247 |
| `updateChunkVisibility(farDist, floor, aboveGround, deepUnder)` | 289 |
| `boxesToEdges(boxes)` | 364 |
| `dynamicHighlight(boxes)` | 386 |
| `burst(x, y, z, blockId, count)` | 493 |
| `updateParticles(dt)` | 514 |
| `updateEdge(px, pz)` | 596 |
| `updatePasteBox(c, p)` | 624 |
| `updateSelectionBox(b, anchor)` | 634 |

내보내는 값 — `matOpaque` · `scene` · `stage` · `VOX_VS` · `VOX_FS` · `voxUniforms` · `skyUniforms` · `sky` · `outerSea` · `FREE_DIST` · `chunkFreed` · `BURIED_KEEP` · `UNDER_SPAN` · `chunkBuried` · `DEEP_UNDER` · `cloudMat` · `cloudMatHigh` · `cloudGroup` · `cloudGroupHigh` · `HL_EDGES` · `HL_GEO` · `HL_CROSS` · `SHAPE_BOUNDS` · `PRIMED_MAX` · `primedMat` · `primedBoxes` · `highlight` · `crackMat` · `crackMesh` · `PMAX` · `pPos` · `pVel` · `pCount` · `pGeo` · `pMat` · `particles` · `edgeMat` · `edgeGroup` · `SEL_DONE` · `selMat` · `selBox` · `pasteMat` · `pasteBox`

### `daynight.js` — 낮과 밤

| 함수 | 줄 |
|---|---:|
| `sampleSky(t)` | 19 |
| `moonFullness()` | 34 |
| `dayLight(t)` | 38 |
| `applyTime(dt)` | 47 |
| `clockText()` | 83 |

내보내는 값 — `DAY_LEN` · `SKY_STOPS` · `_cA` · `_grey`

### `settings.js` — 설정

| 함수 | 줄 |
|---|---:|
| `calmMotion()` | 23 |
| `saveOpts()` | 24 |
| `applyOpts()` | 27 |
| `applyUi()` | 59 |
| `applyTbtn()` | 71 |
| `fovForAspect(fovDeg, aspect)` | 95 |
| `applyFov()` | 102 |

내보내는 값 — `OPT_KEY` · `opts` · `UI_MIN_H` · `TBTN_TOP_KEEP` · `FOV_BASE_ASPECT`

### `player.js` — 플레이어 · 충돌 · 레이캐스트

| 함수 | 줄 |
|---|---:|
| `currentShape(upper)` | 17 |
| `spawn()` | 34 |
| `bestView(sx, sy, sz)` | 79 |
| `boxHitsWorld(px, py, pz, ignoreTall)` | 100 |
| `moveAxis(axis, amount)` | 136 |
| `moveAxisStep(axis, amount)` | 147 |
| `pointSolid(px, py, pz)` | 171 |
| `playerOccupies(x, y, z)` | 189 |
| `unstick()` | 199 |
| `footSupported(px, py, pz)` | 219 |
| `moveHorizontal(dx, dz)` | 225 |
| `rayBox(o, d, mn, mx, maxT)` | 276 |
| `raycast(maxDist, wantLiquid)` | 296 |

내보내는 값 — `HALF` · `player` · `stats` · `VIEW_RAYS` · `SWEEP` · `STEP_UP` · `_ro` · `_oA`

### `audio.js` — 소리

| 함수 | 줄 |
|---|---:|
| `ac()` | 7 |
| `tone(freq, dur, type, gain, node, exact)` | 30 |
| `noiseBuffer(c)` | 50 |
| `crunch(dur, gain, cutoff, node)` | 58 |
| `startAmbient()` | 77 |
| `updateAmbient(dt)` | 96 |
| `breakSound(b)` | 162 |
| `stepSound(b, through)` | 175 |
| `setMuffle(on)` | 186 |
| `rainHiss(vol)` | 201 |
| `setAudioAwake(on)` | 220 |
| `thunder(delayMs, near)` | 233 |
| `moodChord(night, vol)` | 244 |
| `caveSound(depthMix)` | 257 |
| `at(x, y, z)` | 270 |
| `listenAt(x, y, z, fx, fz)` | 289 |
| `lavaPop(vol, node)` | 305 |
| `splash(vol, node)` | 310 |
| `waterLap(vol, node)` | 317 |
| `birdCall(node)` | 323 |
| `fireCrackle(vol, node)` | 329 |
| `lavaHiss()` | 335 |
| `placeSound(b)` | 340 |
| `miningSound(b)` | 348 |

내보내는 값 — `NOISE_SEC` · `SOFT` · `WOOD` · `CLOTH` · `GLASSY`

### `save.js` — 저장 · 불러오기

| 함수 | 줄 |
|---|---:|
| `slotKey(n)` | 17 |
| `curKey()` | 18 |
| `lockKey(n)` | 34 |
| `touchLock()` | 35 |
| `lockHeldByOther(n)` | 42 |
| `releaseLock()` | 52 |
| `rememberSlot(n)` | 58 |
| `lastSlot()` | 61 |
| `slotInfo(n)` | 68 |
| `renameSlot(n, name)` | 81 |
| `hasSave()` | 93 |
| `encodeArrB64(arr)` | 99 |
| `decodeArrB64(b64, arr, len)` | 118 |
| `encodeWorldB64()` | 138 |
| `decodeWorldB64(b64)` | 139 |
| `encodeWorld()` | 140 |
| `decodeWorld(runs, dst, len)` | 149 |
| `liftLegacy(src, dst, asRuns)` | 164 |
| `saveGame()` | 179 |
| `loadGame()` | 229 |
| `clearSave()` | 306 |
| `backupKey(n)` | 313 |
| `pushBackup()` | 316 |
| `prevKey(n)` | 326 |
| `pushPrev()` | 327 |
| `hasBackup()` | 334 |
| `restoreBackup()` | 339 |
| `exportWorld()` | 350 |
| `importWorldText(text)` | 366 |

내보내는 값 — `SAVE_KEY` · `OLD_KEY` · `SLOTS` · `LAST_SLOT_KEY` · `LOCK_PREFIX` · `LOCK_STALE` · `sessionId`

### `edit.js` — 편집 · 되돌리기 · 도전 과제

| 함수 | 줄 |
|---|---:|
| `applyEdit(x, y, z, to, record, sh, depth)` | 71 |
| `batchPush(b, x, y, z, from, to, fromSh, toSh, wl, toWl, fromT)` | 154 |
| `beginBatch(cap)` | 164 |
| `ownFire()` | 173 |
| `settleWorld(list)` | 185 |
| `notePlaced(b, sh, n)` | 224 |
| `liftIfBuried()` | 243 |
| `endBatch(label, credit)` | 265 |
| `editLabel(e)` | 342 |
| `undo()` | 362 |
| `redo()` | 385 |
| `achProgress(a)` | 454 |
| `refreshAchList()` | 465 |
| `checkFoundAchievements()` | 493 |
| `checkBuildAchievements()` | 519 |
| `refreshStats()` | 647 |
| `achCount()` | 665 |
| `unlock(id)` | 670 |
| `selectionBounds()` | 697 |
| `selectionSize()` | 698 |
| `fillSelection(block, sh, only)` | 708 |
| `clearSelection()` | 727 |
| `shellSelection(block, sh, mode)` | 745 |
| `copySelection()` | 771 |
| `mirrorClip()` | 813 |
| `rotateClip()` | 832 |
| `pasteClip(px, py, pz, withAir)` | 856 |
| `completeCommand(prefix)` | 912 |
| `runCommand(line)` | 919 |
| `loadBlueprints()` | 1200 |
| `saveBlueprint(name)` | 1203 |
| `useBlueprint(name)` | 1229 |
| `blueprintNames()` | 1245 |
| `blueprintList()` | 1248 |
| `deleteBlueprint(name)` | 1258 |
| `selectionCounts()` | 1268 |

내보내는 값 — `HISTORY_MAX` · `FIRE_UNDO_MAX` · `FLUID_UNDO_MAX` · `BATCH_RELIGHT_ALL` · `HISTORY_CELLS_MAX` · `lastEditLabel` · `undoEmptyWhy` · `ACHIEVEMENTS` · `achGrid` · `BUILD_R` · `BUILD_IDS` · `FOUND_IDS` · `FOUND_R` · `ROOM_MAX` · `statGrid` · `REGION_MAX` · `CMD_HELP` · `CMD_LIST` · `BP_KEY`

### `hud.js` — HUD · 핫바 · 블록 고르기 · 미니맵

| 함수 | 줄 |
|---|---:|
| `drawIcon(cv, blockId, tileOverride)` | 16 |
| `slotName(i)` | 84 |
| `refreshSlot(i)` | 90 |
| `refreshBar()` | 107 |
| `selectSlot(i)` | 111 |
| `openPicker()` | 162 |
| `closePicker(resume)` | 172 |
| `facingText()` | 185 |
| `showAchPop(name, desc)` | 196 |
| `showHud(on)` | 232 |
| `toast(msg)` | 242 |
| `mmZoomNow()` | 259 |
| `refreshMinimapCap()` | 260 |
| `roofDepth(x, z, y)` | 283 |
| `naturalRoof(x, z, y)` | 299 |
| `refreshMouthDots()` | 335 |
| `bigMapOpen()` | 374 |
| `drawBigMap()` | 376 |
| `toggleBigMap(on)` | 377 |
| `drawMinimap()` | 391 |
| `drawMinimapTo(ctx, scale, full)` | 395 |
| `helpOpen()` | 615 |
| `toggleHelp(on)` | 616 |
| `setHelpTab(showAch)` | 637 |
| `bootProgress(msg, frac)` | 652 |
| `bootDone()` | 657 |
| `noteBlockUse(b)` | 668 |
| `sortPickByRecent()` | 674 |
| `refreshPickFilter()` | 684 |
| `openCmd()` | 711 |
| `closeCmd()` | 718 |
| `cmdSay(msg)` | 723 |
| `drawPreview(target)` | 729 |

내보내는 값 — `hotbarEl` · `slotCanvases` · `SHAPE_GLYPH` · `SHAPE_COLOR` · `SHAPE_WORD` · `pickerEl` · `pickGrid` · `pickBtns` · `FACING` · `tFace` · `tAch` · `tBiome` · `achPop` · `tAim` · `tPos` · `underwaterEl` · `inblockEl` · `airEl` · `perfEl` · `airBar` · `minimapEl` · `mmCap` · `touchEl` · `hudEls` · `photoBar` · `regionBar` · `toastEl` · `mmCanvas` · `mmCtx` · `mmImage` · `UNDER_ROOF` · `ROOF_R` · `SURROUND_ROOF` · `MOUTH_MIN` · `mouthDots` · `BIG_K` · `bigMapEl` · `stampEl` · `helpEl` · `helpAchBtn` · `helpAchList` · `helpCols` · `bootEl` · `bootMsg` · `bootBar` · `pickFind` · `pickTabs` · `pickCat` · `cmdEl` · `cmdIn` · `cmdMsg` · `previewEl` · `previewCap`

### `hand.js` — 1인칭 손과 들고 있는 블록

| 함수 | 줄 |
|---|---:|
| `makeBlockGeometry(b, sh, only, tileOverride)` | 21 |
| `updateHandBlock()` | 130 |
| `updateGhost(px, py, pz, upper)` | 152 |
| `triggerSwing()` | 169 |
| `updateHandLight(dt)` | 172 |
| `updateHand(dt)` | 191 |

내보내는 값 — `handScene` · `handCam` · `handGroup` · `handMat` · `heldMesh` · `armMat` · `arm` · `ghostMat` · `ghostMesh`

### `body.js` — 3인칭에서 보이는 플레이어 몸

| 함수 | 줄 |
|---|---:|
| `updateBody(dt)` | 115 |

내보내는 값 — `LEG_H` · `litParts` · `bodyRoot` · `legL` · `upper` · `armL` · `neck` · `heldBlock`

### `input.js` — 입력 (키보드 · 마우스 · 터치)

| 함수 | 줄 |
|---|---:|
| `tutLine(i)` | 64 |
| `refreshHint()` | 66 |
| `advanceTutTouch(step)` | 86 |
| `advanceTut(step)` | 87 |
| `agoText(ms)` | 98 |
| `refreshSlots()` | 114 |
| `aimCell(reach, strict)` | 204 |
| `selectionText()` | 218 |
| `afterWorldSwap(msg, loaded)` | 234 |
| `cloudSay(msg, kind)` | 297 |
| `refreshCloud()` | 302 |
| `refreshTerrain()` | 412 |
| `refreshBindLabels()` | 438 |
| `hintText(base)` | 446 |
| `refreshKeyButtons()` | 453 |
| `bindConflict(act, code)` | 486 |
| `shareLink()` | 523 |
| `refreshBlueprints()` | 536 |
| `refreshResume()` | 582 |
| `refreshMenu()` | 628 |
| `beginPlay()` | 643 |
| `endPlay()` | 672 |
| `useDragMode()` | 691 |
| `goFullscreen()` | 693 |
| `requestPlay()` | 710 |
| `hashSeed(str)` | 747 |
| `applyLook(dx, dy)` | 769 |
| `cycleTime()` | 789 |
| `setPhotoMode(on)` | 881 |
| `setShapeMode(m)` | 908 |
| `markHere()` | 920 |
| `renameMarkHere()` | 928 |
| `toggleMark(named)` | 942 |
| `cycleMinimapZoom(dir)` | 967 |
| `swapBarPage()` | 982 |
| `pickBlock()` | 1006 |
| `setStick(dx, dy)` | 1380 |
| `bindHold(id, onDown, onUp)` | 1525 |
| `toggleRegionBar(on)` | 1619 |
| `bindOpt(inputId, outId, key, fmt)` | 1759 |
| `pollGamepadMenu()` | 1817 |
| `pollGamepad(dt)` | 1827 |

내보내는 값 — `overlay` · `goBtn` · `altBtn` · `seedIn` · `canvas` · `isTouch` · `HINT_LOCK` · `HINT_DRAG` · `HINT_TOUCH` · `hintEl` · `TUT` · `TUT_TOUCH` · `slotsEl` · `copySeedBtn` · `expBtn` · `impBtn` · `resBtn` · `fileIn` · `terrainEl` · `KEY_LABEL` · `keysEl` · `RESERVED` · `copyLinkBtn` · `refreshWorldPills` · `MARK_MAX` · `MM_ZOOMS` · `lookLast` · `stickZone` · `stickBase` · `stickKnob` · `STICK_R` · `padState`

### `mine.js` — 캐기 · 놓기

| 함수 | 줄 |
|---|---:|
| `mineAt(hit)` | 17 |
| `upperFromHit(hit)` | 49 |
| `canPlaceAt(px, py, pz)` | 56 |
| `tryInteract(hit)` | 71 |
| `doorOther(x, y, z)` | 108 |
| `scoopLiquid(repeating)` | 140 |
| `pourLiquid(hit, repeating)` | 163 |
| `place(repeating)` | 183 |

### `mobs.js` — 걸어 다니는 동물. 세계에 "살아 있는 것" 을 하나 넣는다.

| 함수 | 줄 |
|---|---:|
| `disposeMob(m)` | 86 |
| `dumpMobs()` | 97 |
| `loadMobs(arr)` | 106 |
| `seedMobs()` | 125 |
| `anyMobNear(px, pz, r)` | 222 |
| `updateMobs(dt)` | 255 |
| `pushOutOfMobs(px, pz, half)` | 411 |
| `mobOccupies(x, y, z)` | 431 |
| `aimedMob(maxDist)` | 447 |
| `aimingAtMob()` | 465 |
| `removeMob(m)` | 470 |
| `feedNearbyMob(pos)` | 483 |
| `breedTick(dt)` | 526 |
| `setMobsVisible(on)` | 561 |
| `seedFlocks()` | 582 |
| `updateFlocks(dt)` | 599 |

내보내는 값 — `LOVE_HINT` · `MOB_COUNT` · `MOB_MAX` · `FISH_COUNT` · `BIRD_COUNT` · `MOB_KINDS` · `mobs` · `mobGroup` · `HERD` · `fish` · `birds`

### `sky.js` — 해와 달과 별 · 날씨 · 앰비언트 생물

| 함수 | 줄 |
|---|---:|
| `discTexture(size, stops)` | 12 |
| `updateSkyBodies()` | 118 |
| `columnTop(fx, fz)` | 176 |
| `seedWeather()` | 182 |
| `setWeather(w)` | 191 |
| `applyWeather()` | 199 |
| `setSkyHidden(on)` | 220 |
| `localBiome()` | 231 |
| `strikeBolt(fx, fz)` | 253 |
| `updateStorm(dt)` | 294 |
| `updateWeather(dt)` | 325 |
| `seedCreatures()` | 422 |
| `placeCreature(i)` | 434 |
| `updateCreatures(dt)` | 456 |

내보내는 값 — `sunMat` · `sunSprite` · `MOON_PHASES` · `moonTex` · `moonMat` · `moonSprite` · `brightMat` · `brightStars` · `starMat` · `stars` · `WCOUNT` · `wPos` · `wDraw` · `HIDE_Y` · `wGeo` · `wMat` · `weatherPoints` · `rPos` · `rGeo` · `rainLines` · `skyHidden` · `BOLT_SEG` · `boltMesh` · `boltAt` · `CCOUNT` · `cPos` · `cSeed` · `cGeo` · `cMat` · `creatures`

### `cloud.js` — 기기 사이 이어하기 (GitHub Gist 에 세계를 올리고 내려받는다)

| 함수 | 줄 |
|---|---:|
| `getToken()` | 19 |
| `setToken(t)` | 20 |
| `isLinked()` | 25 |
| `unlink()` | 28 |
| `normalizeName(n)` | 33 |
| `slotNameKey()` | 44 |
| `worldName()` | 45 |
| `setWorldName(n)` | 48 |
| `deviceName()` | 51 |
| `baseRev(name)` | 63 |
| `setBaseRev(name, rev)` | 66 |
| `httpMessage(status)` | 81 |
| `req(method, path, body)` | 89 |
| `checkToken()` | 109 |
| `findGist()` | 116 |
| `ensureGist()` | 136 |
| `fileContent(gist, name)` | 147 |
| `readIndex(gist)` | 153 |
| `listWorlds()` | 166 |
| `pushWorld(force)` | 182 |
| `pullWorld(which)` | 225 |

내보내는 값 — `API` · `MARK` · `INDEX_FILE` · `TOKEN_KEY` · `GIST_KEY` · `NAME_KEY` · `BASE_KEY` · `DEV_KEY`

### `loop.js` — 게임 루프

| 함수 | 줄 |
|---|---:|
| `refreshChunkFloor()` | 31 |
| `newWorld(seed)` | 59 |
| `step(dt)` | 109 |
| `animate()` | 843 |
| `autoTuneFar(fps)` | 950 |
| `farNow()` | 968 |
| `refreshPerf()` | 970 |

내보내는 값 — `GRAVITY` · `chunkFloor` · `PLACE_DELAY` · `SNEAK_MUL` · `AIR_CONTROL` · `fwd` · `clock`

### `version.js` — 빌드 도장 (자동 생성)

내보내는 값 — `BUILD`
