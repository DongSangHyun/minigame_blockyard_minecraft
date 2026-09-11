<!-- 자동 생성 파일 — 직접 고치지 말고 `node tools/codemap.mjs` 를 다시 실행하세요 -->
# CODEMAP — 코드 색인

생성일 2026-09-10 · 모듈 29개 · 합계 12,165줄

진입점은 `index.html` → `src/main.js`. 아래 표는 **의존 순서**로 정렬돼 있습니다 —
위에 있는 모듈은 아래 모듈을 모릅니다(순환이 있는 곳은 함수 호출 시점에만 서로를 봅니다).

## 모듈 지도

| 모듈 | 하는 일 | 줄 | 기대는 곳 |
|---|---|---:|---|
| [`state.js`](../src/state.js) | 여러 모듈이 값을 바꾸는 공유 상태 | 195 | — |
| [`dims.js`](../src/dims.js) | 세계 치수와 좌표 계산 (의존성 없음) | 28 | — |
| [`queues.js`](../src/queues.js) | 시뮬레이션 대기열 (의존성 없음) | 36 | — |
| [`boot.js`](../src/boot.js) | 부팅 가드 · 환경 판별 | 29 | state |
| [`blocks.js`](../src/blocks.js) | 블록 정의 · 모양 · 성질 | 352 | state |
| [`tree.js`](../src/tree.js) | 나무 한 그루의 모양 | 47 | — |
| [`atlas.js`](../src/atlas.js) | 텍스처 아틀라스 (코드로 그리는 16×16 도트) | 711 | blocks |
| [`world.js`](../src/world.js) | 월드 데이터 · 지형 생성 | 1077 | state · tree · queues · dims · blocks · atlas |
| [`light.js`](../src/light.js) | 광원 — 햇빛과 블록광 BFS | 182 | state · dims · blocks · world · mesh · player |
| [`fluids.js`](../src/fluids.js) | 물 흐름 · 낙하 블록 · 잎 부패 | 785 | state · settings · queues · dims · blocks · world · tree · light · mesh · scene · audio · player · edit |
| [`mesh.js`](../src/mesh.js) | 면 데이터 + 청크 메싱 | 279 | dims · blocks · atlas · world · light |
| [`scene.js`](../src/scene.js) | three.js 씬 · 셰이더 · 파티클 | 594 | dims · boot · blocks · atlas · world · mesh |
| [`daynight.js`](../src/daynight.js) | 낮과 밤 | 84 | state · world · scene |
| [`settings.js`](../src/settings.js) | 설정 | 104 | state · boot · scene |
| [`player.js`](../src/player.js) | 플레이어 · 충돌 · 레이캐스트 | 356 | state · dims · blocks · world · scene |
| [`audio.js`](../src/audio.js) | 소리 | 301 | state · blocks · daynight · settings |
| [`save.js`](../src/save.js) | 저장 · 불러오기 | 317 | state · dims · blocks · world · player · mobs · hud · sky |
| [`edit.js`](../src/edit.js) | 편집 · 되돌리기 · 도전 과제 | 1054 | state · queues · settings · save · dims · blocks · world · light · fluids · mesh · player · audio · hud · sky |
| [`hud.js`](../src/hud.js) | HUD · 핫바 · 블록 고르기 · 미니맵 | 713 | state · version · dims · blocks · atlas · world · player · hand · input |
| [`hand.js`](../src/hand.js) | 1인칭 손과 들고 있는 블록 | 197 | state · settings · blocks · atlas · world · mesh · scene · player · dims · light · daynight |
| [`body.js`](../src/body.js) | 3인칭에서 보이는 플레이어 몸 | 200 | state · settings · scene · player · atlas · hand · blocks |
| [`input.js`](../src/input.js) | 입력 (키보드 · 마우스 · 터치) | 1739 | state · world · queues · mobs · dims · mesh · light · boot · blocks · scene · daynight · settings · player · audio · save · cloud · edit · hud · hand · mine · sky · loop |
| [`mine.js`](../src/mine.js) | 캐기 · 놓기 | 287 | state · mobs · fluids · dims · blocks · world · scene · player · audio · edit · hud · hand · input |
| [`mobs.js`](../src/mobs.js) | 걸어 다니는 동물. 세계에 "살아 있는 것" 을 하나 넣는다. | 612 | dims · world · blocks · scene · player · audio |
| [`sky.js`](../src/sky.js) | 해와 달과 별 · 날씨 · 앰비언트 생물 | 441 | state · audio · dims · atlas · world · scene · daynight · player |
| [`cloud.js`](../src/cloud.js) | 기기 사이 이어하기 (GitHub Gist 에 세계를 올리고 내려받는다) | 226 | state · save |
| [`loop.js`](../src/loop.js) | 게임 루프 | 940 | state · input · mobs · queues · dims · blocks · atlas · world · light · fluids · mesh · scene · daynight · settings · player · audio · save · edit · hud · hand · body · mine · sky |
| [`version.js`](../src/version.js) | 빌드 도장 (자동 생성) | 8 | — |
| [`main.js`](../src/main.js) | 조립과 시작 | 271 | state · tree · mobs · atlas · queues · dims · blocks · world · light · fluids · mesh · scene · daynight · settings · player · audio · save · cloud · edit · hud · hand · body · input · mine · sky · loop |

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
| `refreshAllTops()` | 286 |
| `hash2(x, y, seed)` | 290 |
| `hash3(x, y, z, seed)` | 295 |
| `smooth(t)` | 301 |
| `lerp(a, b, t)` | 302 |
| `noise2(x, y, seed)` | 304 |
| `noise3(x, y, z, seed)` | 311 |
| `oreCeil()` | 322 |
| `lavaTop()` | 328 |
| `generate(seed, gen)` | 330 |

내보내는 값 — `world` · `shape` · `heightMap` · `topMap` · `biomeMap` · `waterLvl` · `BIOME_NAMES` · `touched` · `SEEN_TOP` · `UNDER_BANDS` · `SEEN_UNDER_ALL` · `seenMap` · `MOUTH_DEPTH` · `MOUTH_W` · `MINE_W`

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
| `waterTick(budget)` | 168 |
| `enqueueFreeze(x, y, z)` | 246 |
| `freezeTick(budget)` | 252 |
| `dryTick(budget)` | 276 |
| `get2(i, dx, dy, dz)` | 302 |
| `fedSideways(i, y, lvl)` | 308 |
| `removeWater(i, y)` | 319 |
| `ignite(x, y, z)` | 347 |
| `grassTick(px, py, pz, tries)` | 381 |
| `enqueueLava(x, y, z)` | 422 |
| `enqueueLavaAround(x, y, z)` | 427 |
| `enqueueLavaDry(x, y, z)` | 431 |
| `enqueueLavaDryAround(x, y, z)` | 435 |
| `lavaFlowTick(budget)` | 453 |
| `lavaDryTick(budget)` | 508 |
| `lavaTick(px, py, pz, tries)` | 540 |
| `fireTick(budget)` | 560 |
| `primeTNT(x, y, z, fuse)` | 640 |
| `primeTick(dt)` | 651 |
| `explode(cx, cy, cz, radius)` | 666 |
| `enqueueGrow(x, y, z)` | 704 |
| `growTick(dt)` | 727 |

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
| `markDirty(x, y, z)` | 231 |
| `touch(x, y, z)` | 237 |
| `rebuildAll()` | 241 |
| `markAllDirty()` | 246 |
| `setBuildFocus(v)` | 251 |
| `buildBudget(ms)` | 253 |

내보내는 값 — `FACES` · `FACE_UV` · `AO_LEVELS` · `opaqueMeshes` · `chunkFilled` · `chunkCenters` · `CROSS_PLANES` · `dirty` · `buildFocus`

### `scene.js` — three.js 씬 · 셰이더 · 파티클

| 함수 | 줄 |
|---|---:|
| `voxMaterial(extra)` | 101 |
| `outerSeaY()` | 152 |
| `updateOuterSea(camY)` | 218 |
| `updateChunkVisibility(farDist, floor, aboveGround, deepUnder)` | 260 |
| `boxesToEdges(boxes)` | 335 |
| `dynamicHighlight(boxes)` | 357 |
| `burst(x, y, z, blockId, count)` | 464 |
| `updateParticles(dt)` | 485 |
| `updateEdge(px, pz)` | 542 |
| `updatePasteBox(c, p)` | 570 |
| `updateSelectionBox(b, anchor)` | 580 |

내보내는 값 — `matOpaque` · `scene` · `stage` · `VOX_VS` · `VOX_FS` · `voxUniforms` · `skyUniforms` · `sky` · `outerSea` · `FREE_DIST` · `chunkFreed` · `BURIED_KEEP` · `UNDER_SPAN` · `chunkBuried` · `DEEP_UNDER` · `cloudMat` · `cloudMatHigh` · `cloudGroup` · `cloudGroupHigh` · `HL_EDGES` · `HL_GEO` · `HL_CROSS` · `SHAPE_BOUNDS` · `PRIMED_MAX` · `primedMat` · `primedBoxes` · `highlight` · `crackMat` · `crackMesh` · `PMAX` · `pPos` · `pVel` · `pCount` · `pGeo` · `pMat` · `particles` · `edgeMat` · `edgeGroup` · `SEL_DONE` · `selMat` · `selBox` · `pasteMat` · `pasteBox`

### `daynight.js` — 낮과 밤

| 함수 | 줄 |
|---|---:|
| `sampleSky(t)` | 18 |
| `moonFullness()` | 33 |
| `dayLight(t)` | 37 |
| `applyTime(dt)` | 46 |
| `clockText()` | 79 |

내보내는 값 — `DAY_LEN` · `SKY_STOPS` · `_cA` · `_grey`

### `settings.js` — 설정

| 함수 | 줄 |
|---|---:|
| `calmMotion()` | 23 |
| `saveOpts()` | 24 |
| `applyOpts()` | 27 |
| `applyUi()` | 56 |
| `applyTbtn()` | 69 |
| `fovForAspect(fovDeg, aspect)` | 93 |
| `applyFov()` | 100 |

내보내는 값 — `OPT_KEY` · `opts` · `UI_MIN_H` · `TBTN_TOP_KEEP` · `FOV_BASE_ASPECT`

### `player.js` — 플레이어 · 충돌 · 레이캐스트

| 함수 | 줄 |
|---|---:|
| `currentShape(upper)` | 17 |
| `spawn()` | 29 |
| `bestView(sx, sy, sz)` | 74 |
| `boxHitsWorld(px, py, pz, ignoreTall)` | 95 |
| `moveAxis(axis, amount)` | 131 |
| `moveAxisStep(axis, amount)` | 142 |
| `pointSolid(px, py, pz)` | 166 |
| `playerOccupies(x, y, z)` | 184 |
| `unstick()` | 194 |
| `footSupported(px, py, pz)` | 214 |
| `moveHorizontal(dx, dz)` | 220 |
| `rayBox(o, d, mn, mx, maxT)` | 271 |
| `raycast(maxDist, wantLiquid)` | 291 |

내보내는 값 — `HALF` · `player` · `stats` · `VIEW_RAYS` · `SWEEP` · `STEP_UP` · `_ro` · `_oA`

### `audio.js` — 소리

| 함수 | 줄 |
|---|---:|
| `ac()` | 7 |
| `tone(freq, dur, type, gain, node)` | 26 |
| `noiseBuffer(c)` | 45 |
| `crunch(dur, gain, cutoff, node)` | 53 |
| `startAmbient()` | 70 |
| `updateAmbient(dt)` | 89 |
| `breakSound(b)` | 127 |
| `stepSound(b, through)` | 133 |
| `setMuffle(on)` | 143 |
| `rainHiss(vol)` | 158 |
| `setAudioAwake(on)` | 177 |
| `thunder(delayMs, near)` | 185 |
| `moodChord(night, vol)` | 196 |
| `caveSound(depthMix)` | 209 |
| `at(x, y, z)` | 222 |
| `listenAt(x, y, z, fx, fz)` | 238 |
| `lavaPop(vol, node)` | 254 |
| `splash(vol, node)` | 259 |
| `waterLap(vol, node)` | 266 |
| `birdCall(node)` | 272 |
| `fireCrackle(vol, node)` | 278 |
| `lavaHiss()` | 284 |
| `placeSound(b)` | 289 |
| `miningSound(b)` | 296 |

내보내는 값 — `NOISE_SEC` · `SOFT`

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
| `loadGame()` | 170 |
| `clearSave()` | 246 |
| `backupKey(n)` | 253 |
| `pushBackup()` | 256 |
| `prevKey(n)` | 266 |
| `pushPrev()` | 267 |
| `hasBackup()` | 274 |
| `restoreBackup()` | 279 |
| `exportWorld()` | 290 |
| `importWorldText(text)` | 306 |

내보내는 값 — `SAVE_KEY` · `OLD_KEY` · `SLOTS`

### `edit.js` — 편집 · 되돌리기 · 도전 과제

| 함수 | 줄 |
|---|---:|
| `applyEdit(x, y, z, to, record, sh, depth)` | 71 |
| `batchPush(b, x, y, z, from, to, fromSh, toSh, wl, toWl)` | 152 |
| `beginBatch(cap)` | 161 |
| `ownFire()` | 170 |
| `settleWorld(list)` | 182 |
| `endBatch(label)` | 217 |
| `editLabel(e)` | 267 |
| `undo()` | 287 |
| `redo()` | 306 |
| `refreshAchList()` | 371 |
| `checkFoundAchievements()` | 399 |
| `checkBuildAchievements()` | 425 |
| `refreshStats()` | 532 |
| `achCount()` | 550 |
| `unlock(id)` | 555 |
| `selectionBounds()` | 582 |
| `selectionSize()` | 583 |
| `fillSelection(block, sh, only)` | 593 |
| `clearSelection()` | 612 |
| `copySelection()` | 626 |
| `mirrorClip()` | 668 |
| `rotateClip()` | 687 |
| `pasteClip(px, py, pz)` | 707 |
| `completeCommand(prefix)` | 762 |
| `runCommand(line)` | 769 |
| `loadBlueprints()` | 979 |
| `saveBlueprint(name)` | 982 |
| `useBlueprint(name)` | 998 |
| `blueprintNames()` | 1014 |
| `blueprintList()` | 1017 |
| `deleteBlueprint(name)` | 1027 |
| `selectionCounts()` | 1037 |

내보내는 값 — `HISTORY_MAX` · `FIRE_UNDO_MAX` · `FLUID_UNDO_MAX` · `BATCH_RELIGHT_ALL` · `HISTORY_CELLS_MAX` · `lastEditLabel` · `undoEmptyWhy` · `ACHIEVEMENTS` · `achGrid` · `BUILD_R` · `BUILD_IDS` · `FOUND_IDS` · `FOUND_R` · `statGrid` · `REGION_MAX` · `CMD_HELP` · `CMD_LIST` · `BP_KEY`

### `hud.js` — HUD · 핫바 · 블록 고르기 · 미니맵

| 함수 | 줄 |
|---|---:|
| `drawIcon(cv, blockId, tileOverride)` | 16 |
| `slotName(i)` | 84 |
| `refreshSlot(i)` | 90 |
| `refreshBar()` | 107 |
| `selectSlot(i)` | 111 |
| `openPicker()` | 161 |
| `closePicker(resume)` | 172 |
| `facingText()` | 185 |
| `showAchPop(name, desc)` | 196 |
| `showHud(on)` | 231 |
| `toast(msg)` | 240 |
| `mmZoomNow()` | 257 |
| `refreshMinimapCap()` | 258 |
| `roofDepth(x, z, y)` | 281 |
| `naturalRoof(x, z, y)` | 297 |
| `refreshMouthDots()` | 333 |
| `drawMinimap()` | 362 |
| `helpOpen()` | 567 |
| `toggleHelp(on)` | 568 |
| `setHelpTab(showAch)` | 589 |
| `bootProgress(msg, frac)` | 604 |
| `bootDone()` | 609 |
| `noteBlockUse(b)` | 620 |
| `sortPickByRecent()` | 626 |
| `refreshPickFilter()` | 636 |
| `openCmd()` | 663 |
| `closeCmd()` | 670 |
| `cmdSay(msg)` | 675 |
| `drawPreview(target)` | 681 |

내보내는 값 — `hotbarEl` · `slotCanvases` · `SHAPE_GLYPH` · `SHAPE_COLOR` · `SHAPE_WORD` · `pickerEl` · `pickGrid` · `pickBtns` · `FACING` · `tFace` · `tAch` · `tBiome` · `achPop` · `tAim` · `tPos` · `underwaterEl` · `inblockEl` · `airEl` · `perfEl` · `airBar` · `minimapEl` · `mmCap` · `touchEl` · `hudEls` · `photoBar` · `toastEl` · `mmCanvas` · `mmCtx` · `mmImage` · `UNDER_ROOF` · `ROOF_R` · `SURROUND_ROOF` · `MOUTH_MIN` · `mouthDots` · `stampEl` · `helpEl` · `helpAchBtn` · `helpAchList` · `helpCols` · `bootEl` · `bootMsg` · `bootBar` · `pickFind` · `pickTabs` · `pickCat` · `cmdEl` · `cmdIn` · `cmdMsg` · `previewEl` · `previewCap`

### `hand.js` — 1인칭 손과 들고 있는 블록

| 함수 | 줄 |
|---|---:|
| `makeBlockGeometry(b, sh, only, tileOverride)` | 21 |
| `updateHandBlock()` | 130 |
| `updateGhost(px, py, pz, upper)` | 152 |
| `triggerSwing()` | 169 |
| `updateHandLight(dt)` | 172 |
| `updateHand(dt)` | 187 |

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
| `refreshHint()` | 65 |
| `advanceTutTouch(step)` | 72 |
| `advanceTut(step)` | 73 |
| `agoText(ms)` | 84 |
| `refreshSlots()` | 100 |
| `aimCell(reach, strict)` | 189 |
| `selectionText()` | 203 |
| `afterWorldSwap(msg, loaded)` | 219 |
| `cloudSay(msg, kind)` | 282 |
| `refreshCloud()` | 287 |
| `refreshTerrain()` | 392 |
| `refreshBindLabels()` | 418 |
| `hintText(base)` | 426 |
| `refreshKeyButtons()` | 433 |
| `bindConflict(act, code)` | 466 |
| `shareLink()` | 503 |
| `refreshBlueprints()` | 516 |
| `refreshResume()` | 562 |
| `refreshMenu()` | 601 |
| `beginPlay()` | 616 |
| `endPlay()` | 642 |
| `useDragMode()` | 661 |
| `goFullscreen()` | 663 |
| `requestPlay()` | 680 |
| `hashSeed(str)` | 714 |
| `applyLook(dx, dy)` | 736 |
| `cycleTime()` | 756 |
| `setPhotoMode(on)` | 831 |
| `setShapeMode(m)` | 858 |
| `markHere()` | 870 |
| `renameMarkHere()` | 878 |
| `toggleMark(named)` | 891 |
| `cycleMinimapZoom(dir)` | 914 |
| `swapBarPage()` | 929 |
| `pickBlock()` | 953 |
| `setStick(dx, dy)` | 1294 |
| `bindHold(id, onDown, onUp)` | 1436 |
| `bindOpt(inputId, outId, key, fmt)` | 1610 |
| `pollGamepadMenu()` | 1668 |
| `pollGamepad(dt)` | 1678 |

내보내는 값 — `overlay` · `goBtn` · `altBtn` · `seedIn` · `canvas` · `isTouch` · `HINT_LOCK` · `HINT_DRAG` · `HINT_TOUCH` · `hintEl` · `TUT` · `TUT_TOUCH` · `slotsEl` · `copySeedBtn` · `expBtn` · `impBtn` · `resBtn` · `fileIn` · `terrainEl` · `KEY_LABEL` · `keysEl` · `RESERVED` · `copyLinkBtn` · `refreshWorldPills` · `MM_ZOOMS` · `lookLast` · `stickZone` · `stickBase` · `stickKnob` · `STICK_R` · `padState`

### `mine.js` — 캐기 · 놓기

| 함수 | 줄 |
|---|---:|
| `mineAt(hit)` | 16 |
| `upperFromHit(hit)` | 47 |
| `canPlaceAt(px, py, pz)` | 54 |
| `tryInteract(hit)` | 69 |
| `doorOther(x, y, z)` | 106 |
| `scoopLiquid(repeating)` | 138 |
| `pourLiquid(hit, repeating)` | 161 |
| `place(repeating)` | 181 |

### `mobs.js` — 걸어 다니는 동물. 세계에 "살아 있는 것" 을 하나 넣는다.

| 함수 | 줄 |
|---|---:|
| `disposeMob(m)` | 77 |
| `dumpMobs()` | 88 |
| `loadMobs(arr)` | 97 |
| `seedMobs()` | 116 |
| `anyMobNear(px, pz, r)` | 213 |
| `updateMobs(dt)` | 246 |
| `pushOutOfMobs(px, pz, half)` | 380 |
| `mobOccupies(x, y, z)` | 400 |
| `aimedMob(maxDist)` | 416 |
| `aimingAtMob()` | 434 |
| `removeMob(m)` | 439 |
| `feedNearbyMob(pos)` | 452 |
| `breedTick(dt)` | 495 |
| `setMobsVisible(on)` | 530 |
| `seedFlocks()` | 551 |
| `updateFlocks(dt)` | 568 |

내보내는 값 — `LOVE_HINT` · `MOB_COUNT` · `MOB_MAX` · `FISH_COUNT` · `BIRD_COUNT` · `MOB_KINDS` · `mobs` · `mobGroup` · `HERD` · `fish` · `birds`

### `sky.js` — 해와 달과 별 · 날씨 · 앰비언트 생물

| 함수 | 줄 |
|---|---:|
| `discTexture(size, stops)` | 11 |
| `updateSkyBodies()` | 117 |
| `columnTop(fx, fz)` | 169 |
| `seedWeather()` | 175 |
| `setWeather(w)` | 184 |
| `applyWeather()` | 192 |
| `localBiome()` | 211 |
| `strikeBolt(fx, fz)` | 233 |
| `updateStorm(dt)` | 269 |
| `updateWeather(dt)` | 299 |
| `seedCreatures()` | 393 |
| `placeCreature(i)` | 401 |
| `updateCreatures(dt)` | 411 |

내보내는 값 — `sunMat` · `sunSprite` · `MOON_PHASES` · `moonTex` · `moonMat` · `moonSprite` · `brightMat` · `brightStars` · `starMat` · `stars` · `WCOUNT` · `wPos` · `wDraw` · `HIDE_Y` · `wGeo` · `wMat` · `weatherPoints` · `rPos` · `rGeo` · `rainLines` · `BOLT_SEG` · `boltMesh` · `boltAt` · `CCOUNT` · `cPos` · `cSeed` · `cGeo` · `cMat` · `creatures`

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
| `refreshChunkFloor()` | 31 |
| `newWorld(seed)` | 56 |
| `step(dt)` | 106 |
| `animate()` | 798 |
| `autoTuneFar(fps)` | 897 |
| `farNow()` | 915 |
| `refreshPerf()` | 917 |

내보내는 값 — `GRAVITY` · `chunkFloor` · `PLACE_DELAY` · `SNEAK_MUL` · `AIR_CONTROL` · `fwd` · `clock`

### `version.js` — 빌드 도장 (자동 생성)

내보내는 값 — `BUILD`
