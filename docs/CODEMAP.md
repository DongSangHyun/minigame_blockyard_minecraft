<!-- 자동 생성 파일 — 직접 고치지 말고 `node tools/codemap.mjs` 를 다시 실행하세요 -->
# CODEMAP — 코드 색인

생성일 2026-09-14 · 모듈 30개 · 합계 14,458줄

진입점은 `index.html` → `src/main.js`. 아래 표는 **의존 순서**로 정렬돼 있습니다 —
위에 있는 모듈은 아래 모듈을 모릅니다(순환이 있는 곳은 함수 호출 시점에만 서로를 봅니다).

## 모듈 지도

| 모듈 | 하는 일 | 줄 | 기대는 곳 |
|---|---|---:|---|
| [`state.js`](../src/state.js) | 여러 모듈이 값을 바꾸는 공유 상태 | 216 | — |
| [`dims.js`](../src/dims.js) | 세계 치수와 좌표 계산 (의존성 없음) | 33 | — |
| [`queues.js`](../src/queues.js) | 시뮬레이션 대기열 (의존성 없음) | 36 | — |
| [`boot.js`](../src/boot.js) | 부팅 가드 · 환경 판별 | 29 | state |
| [`blocks.js`](../src/blocks.js) | 블록 정의 · 모양 · 성질 | 375 | state |
| [`tree.js`](../src/tree.js) | 나무 한 그루의 모양 | 47 | — |
| [`atlas.js`](../src/atlas.js) | 텍스처 아틀라스 (코드로 그리는 16×16 도트) | 764 | blocks |
| [`world.js`](../src/world.js) | 월드 데이터 · 지형 생성 | 1216 | state · tree · village · queues · dims · blocks · atlas |
| [`light.js`](../src/light.js) | 광원 — 햇빛과 블록광 BFS | 182 | state · dims · blocks · world · mesh · player |
| [`fluids.js`](../src/fluids.js) | 물 흐름 · 낙하 블록 · 잎 부패 | 900 | state · atlas · settings · queues · dims · blocks · world · tree · light · mesh · scene · audio · player · edit |
| [`mesh.js`](../src/mesh.js) | 면 데이터 + 청크 메싱 | 428 | dims · blocks · atlas · world · light |
| [`scene.js`](../src/scene.js) | three.js 씬 · 셰이더 · 파티클 | 648 | dims · boot · blocks · atlas · world · mesh |
| [`daynight.js`](../src/daynight.js) | 낮과 밤 | 88 | state · world · scene |
| [`settings.js`](../src/settings.js) | 설정 | 115 | state · boot · scene |
| [`player.js`](../src/player.js) | 플레이어 · 충돌 · 레이캐스트 | 383 | state · dims · blocks · world · scene |
| [`audio.js`](../src/audio.js) | 소리 | 356 | state · blocks · daynight · settings |
| [`save.js`](../src/save.js) | 저장 · 불러오기 | 435 | state · dims · blocks · world · player · mobs · hud · sky |
| [`village.js`](../src/village.js) | 시작 마을. 세계를 켜면 **이미 누가 살고 있는 자리**에서 시작한다. | 415 | dims · state · blocks · world |
| [`edit.js`](../src/edit.js) | 편집 · 되돌리기 · 도전 과제 | 1433 | state · queues · settings · save · dims · blocks · world · light · fluids · mesh · player · audio · hud · sky |
| [`hud.js`](../src/hud.js) | HUD · 핫바 · 블록 고르기 · 미니맵 | 804 | state · version · dims · blocks · atlas · world · player · settings · hand · input |
| [`hand.js`](../src/hand.js) | 1인칭 손과 들고 있는 블록 | 201 | state · settings · blocks · atlas · world · mesh · scene · player · dims · light · daynight |
| [`body.js`](../src/body.js) | 3인칭에서 보이는 플레이어 몸 | 200 | state · settings · scene · player · atlas · hand · blocks |
| [`input.js`](../src/input.js) | 입력 (키보드 · 마우스 · 터치) | 2017 | state · world · queues · mobs · dims · mesh · light · boot · blocks · scene · daynight · settings · player · audio · save · cloud · edit · hud · hand · mine · sky · loop |
| [`mine.js`](../src/mine.js) | 캐기 · 놓기 | 318 | state · mobs · fluids · dims · blocks · world · light · scene · player · audio · edit · hud · hand · input |
| [`mobs.js`](../src/mobs.js) | 걸어 다니는 동물. 세계에 "살아 있는 것" 을 하나 넣는다. | 723 | dims · world · blocks · scene · player · audio · light · daynight · state |
| [`sky.js`](../src/sky.js) | 해와 달과 별 · 날씨 · 앰비언트 생물 | 500 | state · audio · dims · atlas · blocks · world · scene · daynight · settings · player |
| [`cloud.js`](../src/cloud.js) | 기기 사이 이어하기 (GitHub Gist 에 세계를 올리고 내려받는다) | 243 | state · save |
| [`loop.js`](../src/loop.js) | 게임 루프 | 1025 | state · input · mobs · queues · dims · blocks · atlas · world · light · village · fluids · mesh · scene · daynight · settings · player · audio · save · edit · hud · hand · body · mine · sky |
| [`version.js`](../src/version.js) | 빌드 도장 (자동 생성) | 8 | — |
| [`main.js`](../src/main.js) | 조립과 시작 | 320 | state · village · tree · mobs · atlas · queues · dims · blocks · world · light · fluids · mesh · scene · daynight · settings · player · audio · save · cloud · edit · hud · hand · body · input · mine · sky · loop |

## 모듈별 공개 함수

### `state.js` — 여러 모듈이 값을 바꾸는 공유 상태

내보내는 값 — `S`

### `dims.js` — 세계 치수와 좌표 계산 (의존성 없음)

| 함수 | 줄 |
|---|---:|
| `setGen(g)` | 24 |
| `seaLift()` | 29 |
| `idx(x, y, z)` | 30 |
| `inside(x, y, z)` | 31 |

내보내는 값 — `WX` · `MARK_MAX` · `LEGACY_WY` · `CX` · `N` · `SEA_V1` · `SEA_V2` · `GEN_LATEST` · `GEN` · `SEA` · `DIRS`

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
| `isStained(b)` | 44 |
| `isSapling(b)` | 47 |
| `isCarpet(b)` | 50 |
| `isWool(b)` | 58 |
| `hardnessOf(b)` | 180 |
| `isUnbreakable(b)` | 183 |
| `isCross(b)` | 204 |
| `needsFloor(b)` | 205 |
| `needsWall(b)` | 207 |
| `isItem(b)` | 220 |
| `isConnecting(b)` | 240 |
| `isClimbable(b)` | 242 |
| `isOpenable(b)` | 244 |
| `isFlammable(b)` | 246 |
| `connectsTo(self, other)` | 254 |
| `isLog(b)` | 261 |
| `isLeaf(b)` | 262 |
| `isDoorShape(sh)` | 282 |
| `doorOpen(sh)` | 283 |
| `doorFacing(sh)` | 284 |
| `doorShapeFor(facing, open)` | 285 |
| `isWallShape(sh)` | 288 |
| `isStairShape(sh)` | 290 |
| `wallShapeFor(nx, nz)` | 293 |
| `crossOffset(sh)` | 300 |
| `faceKindFor(sh, f, base)` | 330 |
| `isAxisShape(sh)` | 335 |
| `isLiquid(b)` | 337 |
| `isTransparent(b)` | 338 |
| `isSolid(b)` | 339 |
| `isThin(b)` | 341 |
| `blocksLight(b)` | 342 |
| `lightPass(b)` | 345 |
| `categoryOf(b)` | 362 |

내보내는 값 — `AIR` · `TNT` · `DOOR` · `SAPLING` · `BOOKSHELF` · `CARPET0` · `POT` · `BUCKET` · `SAPLING_BIRCH` · `SPRUCE_LOG` · `STAINED0` · `SANDSTONE` · `WOOL0` · `WOOL_COLORS` · `TILES` · `BUCKET_TILE` · `NAMES` · `NAMES_EN` · `HARDNESS` · `EMIT` · `CROSS` · `ALL_BLOCKS` · `ITEMS` · `DEFAULT_BAR` · `DEFAULT_BAR2` · `SH_FULL` · `SH_UP_OFF` · `SH_SLAB_UP` · `SH_AXIS_X` · `SH_WALL_N` · `WALL_DIR` · `SH_DOOR_N` · `SH_DOOR_OPEN_OFF` · `SHAPE_BOXES` · `SHAPE_NAMES`

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
| `tileAvg(i)` | 661 |
| `tileSwatch(i)` | 676 |
| `atlasSample(i)` | 750 |
| `animateLiquids(t)` | 757 |

내보내는 값 — `TILE` · `atlas` · `actx` · `painted` · `atlasTex` · `SWATCH_N` · `AVG_TOP` · `crackTex`

### `world.js` — 월드 데이터 · 지형 생성

| 함수 | 줄 |
|---|---:|
| `get(x, y, z)` | 19 |
| `set(x, y, z, b, sh)` | 27 |
| `shapeAt(x, y, z)` | 30 |
| `refreshTop(x, z)` | 32 |
| `surfaceTop(x, y, z)` | 41 |
| `crossBase(x, y, z)` | 53 |
| `dynamicBoxes(b, x, y, z)` | 60 |
| `hasDynamicBoxes(b)` | 135 |
| `boxesAt(b, sh, x, y, z)` | 209 |
| `markX(m)` | 224 |
| `markY(m)` | 225 |
| `markZ(m)` | 226 |
| `markName(m)` | 227 |
| `underBand(y)` | 239 |
| `expandLegacySeen()` | 247 |
| `markSeen(px, pz, r, bit)` | 252 |
| `seenRatio()` | 270 |
| `markTouched(x, y, z)` | 280 |
| `isTouched(x, y, z)` | 283 |
| `setTouched(x, y, z, on)` | 289 |
| `refreshAllTops()` | 293 |
| `snapshotSeaCol()` | 303 |
| `hash2(x, y, seed)` | 310 |
| `hash3(x, y, z, seed)` | 315 |
| `smooth(t)` | 321 |
| `lerp(a, b, t)` | 322 |
| `noise2(x, y, seed)` | 324 |
| `noise3(x, y, z, seed)` | 331 |
| `oreCeil()` | 342 |
| `lavaTop()` | 348 |
| `generate(seed, gen)` | 350 |

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
| `applyUi()` | 63 |
| `applyTbtn()` | 79 |
| `fovForAspect(fovDeg, aspect)` | 104 |
| `applyFov()` | 111 |

내보내는 값 — `OPT_KEY` · `opts` · `UI_MIN_H` · `TBTN_TOP_KEEP` · `FOV_BASE_ASPECT`

### `player.js` — 플레이어 · 충돌 · 레이캐스트

| 함수 | 줄 |
|---|---:|
| `currentShape(upper)` | 17 |
| `spawn()` | 34 |
| `bestView(sx, sy, sz)` | 101 |
| `boxHitsWorld(px, py, pz, ignoreTall)` | 122 |
| `moveAxis(axis, amount)` | 158 |
| `moveAxisStep(axis, amount)` | 169 |
| `pointSolid(px, py, pz)` | 193 |
| `playerOccupies(x, y, z)` | 211 |
| `unstick()` | 221 |
| `footSupported(px, py, pz)` | 241 |
| `moveHorizontal(dx, dz)` | 247 |
| `rayBox(o, d, mn, mx, maxT)` | 298 |
| `raycast(maxDist, wantLiquid)` | 318 |

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
| `breakSound(b)` | 164 |
| `stepSound(b, through)` | 177 |
| `setMuffle(on)` | 188 |
| `rainHiss(vol)` | 203 |
| `setAudioAwake(on)` | 222 |
| `thunder(delayMs, near)` | 235 |
| `moodChord(night, vol)` | 246 |
| `caveSound(depthMix)` | 259 |
| `at(x, y, z)` | 272 |
| `listenAt(x, y, z, fx, fz)` | 291 |
| `lavaPop(vol, node)` | 307 |
| `splash(vol, node)` | 312 |
| `waterLap(vol, node)` | 319 |
| `birdCall(node)` | 325 |
| `fireCrackle(vol, node)` | 331 |
| `lavaHiss()` | 337 |
| `placeSound(b)` | 342 |
| `miningSound(b)` | 350 |

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
| `loadGame()` | 233 |
| `clearSave()` | 313 |
| `backupKey(n)` | 320 |
| `pushBackup()` | 323 |
| `prevKey(n)` | 333 |
| `pushPrev()` | 334 |
| `hasBackup()` | 341 |
| `backupCandidates()` | 350 |
| `backupLabel()` | 384 |
| `restoreBackup()` | 390 |
| `exportWorld()` | 405 |
| `importWorldText(text)` | 421 |

내보내는 값 — `SAVE_KEY` · `OLD_KEY` · `SLOTS` · `LAST_SLOT_KEY` · `LOCK_PREFIX` · `LOCK_STALE` · `sessionId`

### `village.js` — 시작 마을. 세계를 켜면 **이미 누가 살고 있는 자리**에서 시작한다.

| 함수 | 줄 |
|---|---:|
| `villageMarks(v)` | 338 |
| `buildVillage(rng)` | 348 |

내보내는 값 — `village`

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
| `achProgress(a)` | 456 |
| `refreshAchList()` | 467 |
| `checkFoundAchievements()` | 495 |
| `checkBuildAchievements()` | 521 |
| `refreshStats()` | 652 |
| `achCount()` | 670 |
| `unlock(id)` | 675 |
| `selectionBounds()` | 702 |
| `selectionSize()` | 703 |
| `fillSelection(block, sh, only)` | 713 |
| `clearSelection()` | 732 |
| `shellSelection(block, sh, mode)` | 750 |
| `roundSelection(block, sh, r, h, hollow, kind)` | 780 |
| `copySelection()` | 812 |
| `mirrorClip()` | 854 |
| `rotateClip()` | 873 |
| `pasteClip(px, py, pz, withAir)` | 897 |
| `completeCommand(prefix)` | 955 |
| `runCommand(line)` | 962 |
| `loadBlueprints()` | 1304 |
| `saveBlueprint(name)` | 1307 |
| `useBlueprint(name)` | 1333 |
| `exportBlueprint(name)` | 1353 |
| `importBlueprint(text)` | 1368 |
| `blueprintNames()` | 1393 |
| `blueprintList()` | 1396 |
| `deleteBlueprint(name)` | 1406 |
| `selectionCounts()` | 1416 |

내보내는 값 — `HISTORY_MAX` · `FIRE_UNDO_MAX` · `FLUID_UNDO_MAX` · `BATCH_RELIGHT_ALL` · `HISTORY_CELLS_MAX` · `lastEditLabel` · `undoEmptyWhy` · `ACHIEVEMENTS` · `achGrid` · `BUILD_R` · `BUILD_IDS` · `FOUND_IDS` · `FOUND_R` · `ROOM_MAX` · `statGrid` · `REGION_MAX` · `CMD_HELP` · `CMD_LIST` · `BP_KEY` · `BP_TAG`

### `hud.js` — HUD · 핫바 · 블록 고르기 · 미니맵

| 함수 | 줄 |
|---|---:|
| `drawIcon(cv, blockId, tileOverride)` | 17 |
| `slotName(i)` | 86 |
| `refreshSlot(i)` | 92 |
| `refreshBar()` | 109 |
| `selectSlot(i)` | 113 |
| `openPicker()` | 164 |
| `closePicker(resume)` | 177 |
| `facingText()` | 190 |
| `showAchPop(name, desc)` | 201 |
| `showHud(on)` | 237 |
| `toast(msg)` | 247 |
| `mmZoomNow()` | 268 |
| `refreshMinimapCap()` | 269 |
| `roofDepth(x, z, y)` | 292 |
| `naturalRoof(x, z, y)` | 308 |
| `refreshMouthDots()` | 344 |
| `bigMapOpen()` | 383 |
| `drawBigMap()` | 385 |
| `toggleBigMap(on)` | 386 |
| `drawMinimap()` | 400 |
| `drawMinimapTo(ctx, scale, full)` | 404 |
| `helpOpen()` | 654 |
| `toggleHelp(on)` | 655 |
| `setHelpTab(showAch)` | 676 |
| `bootProgress(msg, frac)` | 691 |
| `bootDone()` | 696 |
| `noteBlockUse(b)` | 707 |
| `sortPickByRecent()` | 716 |
| `refreshPickFilter()` | 727 |
| `openCmd()` | 754 |
| `closeCmd()` | 761 |
| `cmdSay(msg)` | 766 |
| `drawPreview(target)` | 772 |

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
| `tutDone()` | 99 |
| `agoText(ms)` | 107 |
| `refreshSlots()` | 123 |
| `aimCell(reach, strict)` | 226 |
| `selectionText()` | 240 |
| `afterWorldSwap(msg, loaded)` | 256 |
| `cloudSay(msg, kind)` | 342 |
| `refreshCloud()` | 347 |
| `refreshTerrain()` | 457 |
| `refreshBindLabels()` | 485 |
| `hintText(base)` | 493 |
| `refreshKeyButtons()` | 500 |
| `bindConflict(act, code)` | 536 |
| `shareLink()` | 573 |
| `refreshBlueprints()` | 586 |
| `refreshResume()` | 632 |
| `refreshMenu()` | 678 |
| `beginPlay()` | 693 |
| `endPlay()` | 730 |
| `useDragMode()` | 749 |
| `goFullscreen()` | 751 |
| `requestPlay()` | 768 |
| `hashSeed(str)` | 805 |
| `arrowLookTick(dt)` | 831 |
| `applyLook(dx, dy)` | 840 |
| `cycleTime()` | 860 |
| `setPhotoMode(on)` | 952 |
| `setShapeMode(m)` | 979 |
| `markHere()` | 991 |
| `renameMarkHere()` | 999 |
| `toggleMark(named)` | 1012 |
| `cycleMinimapZoom(dir)` | 1037 |
| `swapBarPage()` | 1052 |
| `pickBlock()` | 1076 |
| `setStick(dx, dy)` | 1464 |
| `bindHold(id, onDown, onUp)` | 1609 |
| `toggleRegionBar(on)` | 1703 |
| `bindOpt(inputId, outId, key, fmt)` | 1844 |
| `refreshScaleLabels()` | 1874 |
| `pollGamepadMenu()` | 1919 |
| `pollGamepad(dt)` | 1929 |

내보내는 값 — `overlay` · `goBtn` · `altBtn` · `seedIn` · `canvas` · `isTouch` · `HINT_LOCK` · `HINT_DRAG` · `HINT_TOUCH` · `hintEl` · `TUT` · `TUT_TOUCH` · `TUT_KEY` · `TUT_LEN` · `slotsEl` · `copySeedBtn` · `expBtn` · `impBtn` · `resBtn` · `fileIn` · `relearnBtn` · `terrainEl` · `KEY_LABEL` · `keysEl` · `RESERVED` · `copyLinkBtn` · `refreshWorldPills` · `MM_ZOOMS` · `lookLast` · `stickZone` · `stickBase` · `stickKnob` · `STICK_R` · `padState`

### `mine.js` — 캐기 · 놓기

| 함수 | 줄 |
|---|---:|
| `mineAt(hit)` | 17 |
| `upperFromHit(hit)` | 49 |
| `canPlaceAt(px, py, pz)` | 56 |
| `tradeWith()` | 86 |
| `tryInteract(hit)` | 102 |
| `doorOther(x, y, z)` | 143 |
| `scoopLiquid(repeating)` | 175 |
| `pourLiquid(hit, repeating)` | 198 |
| `place(repeating)` | 218 |

내보내는 값 — `TRADER_GIFTS` · `TRADER_LINES`

### `mobs.js` — 걸어 다니는 동물. 세계에 "살아 있는 것" 을 하나 넣는다.

| 함수 | 줄 |
|---|---:|
| `isTrader(m)` | 30 |
| `disposeMob(m)` | 94 |
| `dumpMobs()` | 105 |
| `loadMobs(arr)` | 114 |
| `wildKinds()` | 135 |
| `seedMobs()` | 140 |
| `seedVillage(v)` | 164 |
| `anyMobNear(px, pz, r)` | 285 |
| `updateMobs(dt)` | 318 |
| `pushOutOfMobs(px, pz, half)` | 487 |
| `mobOccupies(x, y, z)` | 507 |
| `aimedMob(maxDist)` | 523 |
| `aimingAtMob()` | 541 |
| `removeMob(m)` | 546 |
| `feedNearbyMob(pos)` | 562 |
| `breedTick(dt)` | 606 |
| `setMobsVisible(on)` | 641 |
| `seedFlocks()` | 662 |
| `updateFlocks(dt)` | 679 |

내보내는 값 — `LOVE_HINT` · `MOB_COUNT` · `MOB_MAX` · `FISH_COUNT` · `BIRD_COUNT` · `MOB_KINDS` · `mobs` · `mobGroup` · `HERD` · `fish` · `birds`

### `sky.js` — 해와 달과 별 · 날씨 · 앰비언트 생물

| 함수 | 줄 |
|---|---:|
| `discTexture(size, stops)` | 13 |
| `updateSkyBodies()` | 119 |
| `columnTop(fx, fz)` | 177 |
| `seedWeather()` | 183 |
| `setWeather(w)` | 192 |
| `applyWeather()` | 200 |
| `setSkyHidden(on)` | 221 |
| `localBiome()` | 232 |
| `strikeBolt(fx, fz)` | 254 |
| `updateStorm(dt)` | 295 |
| `updateWeather(dt)` | 339 |
| `seedCreatures()` | 436 |
| `placeCreature(i)` | 448 |
| `updateCreatures(dt)` | 470 |

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
| `refreshChunkFloor()` | 32 |
| `newWorld(seed)` | 60 |
| `step(dt)` | 121 |
| `animate()` | 873 |
| `autoTuneFar(fps)` | 982 |
| `farNow()` | 1000 |
| `refreshPerf()` | 1002 |

내보내는 값 — `GRAVITY` · `chunkFloor` · `PLACE_DELAY` · `SNEAK_MUL` · `AIR_CONTROL` · `fwd` · `clock`

### `version.js` — 빌드 도장 (자동 생성)

내보내는 값 — `BUILD`
