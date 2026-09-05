<!-- 자동 생성 파일 — 직접 고치지 말고 `node tools/codemap.mjs` 를 다시 실행하세요 -->
# CODEMAP — 코드 색인

생성일 2026-09-05 · 모듈 24개 · 합계 5,302줄

진입점은 `index.html` → `src/main.js`. 아래 표는 **의존 순서**로 정렬돼 있습니다 —
위에 있는 모듈은 아래 모듈을 모릅니다(순환이 있는 곳은 함수 호출 시점에만 서로를 봅니다).

## 모듈 지도

| 모듈 | 하는 일 | 줄 | 기대는 곳 |
|---|---|---:|---|
| [`state.js`](../src/state.js) | 여러 모듈이 값을 바꾸는 공유 상태 | 108 | — |
| [`dims.js`](../src/dims.js) | 세계 치수와 좌표 계산 (의존성 없음) | 10 | — |
| [`queues.js`](../src/queues.js) | 시뮬레이션 대기열 (의존성 없음) | 23 | — |
| [`boot.js`](../src/boot.js) | 부팅 가드 · 환경 판별 | 26 | state |
| [`blocks.js`](../src/blocks.js) | 블록 정의 · 모양 · 성질 | 214 | state |
| [`atlas.js`](../src/atlas.js) | 텍스처 아틀라스 (코드로 그리는 16×16 도트) | 431 | blocks |
| [`world.js`](../src/world.js) | 월드 데이터 · 지형 생성 | 365 | state · queues · dims · blocks · atlas |
| [`light.js`](../src/light.js) | 광원 — 햇빛과 블록광 BFS | 182 | state · dims · blocks · world · mesh · player |
| [`fluids.js`](../src/fluids.js) | 물 흐름 · 낙하 블록 · 잎 부패 | 274 | state · queues · dims · blocks · world · light · mesh · scene · audio · edit |
| [`mesh.js`](../src/mesh.js) | 면 데이터 + 청크 메싱 | 256 | dims · blocks · atlas · world · light |
| [`scene.js`](../src/scene.js) | three.js 씬 · 셰이더 · 파티클 | 345 | dims · boot · blocks · atlas · world · mesh |
| [`daynight.js`](../src/daynight.js) | 낮과 밤 | 63 | state · world · scene |
| [`settings.js`](../src/settings.js) | 설정 | 32 | state · boot · scene |
| [`player.js`](../src/player.js) | 플레이어 · 충돌 · 레이캐스트 | 227 | state · dims · blocks · world · scene |
| [`audio.js`](../src/audio.js) | 소리 | 171 | state · blocks · daynight · settings |
| [`save.js`](../src/save.js) | 저장 · 불러오기 | 176 | state · dims · blocks · world · player · hud |
| [`edit.js`](../src/edit.js) | 편집 · 되돌리기 · 도전 과제 | 261 | state · dims · blocks · world · light · fluids · mesh · player · audio · hud · sky |
| [`hud.js`](../src/hud.js) | HUD · 핫바 · 블록 고르기 · 미니맵 | 248 | state · version · dims · blocks · atlas · world · player · hand · input |
| [`hand.js`](../src/hand.js) | 1인칭 손과 들고 있는 블록 | 136 | state · boot · blocks · atlas · world · mesh · scene · player |
| [`input.js`](../src/input.js) | 입력 (키보드 · 마우스 · 터치) | 606 | state · mesh · light · boot · blocks · scene · daynight · settings · player · audio · save · edit · hud · hand · mine · sky · loop |
| [`mine.js`](../src/mine.js) | 캐기 · 놓기 | 122 | state · dims · blocks · world · scene · player · audio · edit · hud · hand · input |
| [`sky.js`](../src/sky.js) | 해와 달과 별 · 날씨 · 앰비언트 생물 | 322 | state · audio · dims · atlas · world · scene · daynight · player |
| [`loop.js`](../src/loop.js) | 게임 루프 | 557 | state · mobs · queues · dims · boot · blocks · atlas · world · light · fluids · mesh · scene · daynight · settings · player · audio · save · edit · hud · hand · mine · sky |
| [`main.js`](../src/main.js) | 조립과 시작 | 147 | state · mobs · atlas · queues · dims · blocks · world · light · fluids · mesh · scene · daynight · settings · player · audio · save · edit · hud · hand · input · mine · sky · loop |

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
| `resetQueues()` | 16 |

내보내는 값 — `Q`

### `boot.js` — 부팅 가드 · 환경 판별

| 함수 | 줄 |
|---|---:|
| `bail(msg)` | 4 |

내보내는 값 — `reduceMotion` · `IS_TOUCH`

### `blocks.js` — 블록 정의 · 모양 · 성질

| 함수 | 줄 |
|---|---:|
| `isWool(b)` | 21 |
| `hardnessOf(b)` | 99 |
| `isUnbreakable(b)` | 102 |
| `isCross(b)` | 118 |
| `needsFloor(b)` | 119 |
| `isConnecting(b)` | 129 |
| `isClimbable(b)` | 131 |
| `isOpenable(b)` | 133 |
| `connectsTo(self, other)` | 135 |
| `isLog(b)` | 142 |
| `isLeaf(b)` | 143 |
| `isWallShape(sh)` | 157 |
| `wallShapeFor(nx, nz)` | 158 |
| `crossOffset(sh)` | 165 |
| `faceKindFor(sh, f, base)` | 195 |
| `isAxisShape(sh)` | 200 |
| `isLiquid(b)` | 202 |
| `isTransparent(b)` | 203 |
| `isSolid(b)` | 204 |
| `blocksLight(b)` | 205 |
| `lightPass(b)` | 206 |

내보내는 값 — `AIR` · `WOOL0` · `WOOL_COLORS` · `TILES` · `NAMES` · `HARDNESS` · `EMIT` · `CROSS` · `ALL_BLOCKS` · `DEFAULT_BAR` · `SH_FULL` · `SH_UP_OFF` · `SH_SLAB_UP` · `SH_AXIS_X` · `SH_WALL_N` · `WALL_DIR` · `SHAPE_BOXES` · `SHAPE_NAMES`

### `atlas.js` — 텍스처 아틀라스 (코드로 그리는 16×16 도트)

| 함수 | 줄 |
|---|---:|
| `tileOrigin(i)` | 9 |
| `makeRng(seed)` | 11 |
| `paint(index, fn)` | 21 |
| `pick(rng, list)` | 29 |
| `orePaint(tint1, tint2)` | 124 |
| `tileAvg(i)` | 358 |
| `animateLiquids(t)` | 426 |

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
| `refreshAllTops()` | 106 |
| `hash2(x, y, seed)` | 110 |
| `hash3(x, y, z, seed)` | 115 |
| `smooth(t)` | 121 |
| `lerp(a, b, t)` | 122 |
| `noise2(x, y, seed)` | 124 |
| `noise3(x, y, z, seed)` | 131 |
| `generate(seed)` | 141 |

내보내는 값 — `world` · `shape` · `heightMap` · `topMap` · `biomeMap` · `waterLvl` · `BIOME_NAMES`

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
| `enqueueWater(x, y, z)` | 15 |
| `enqueueDry(x, y, z)` | 19 |
| `enqueueDryAround(x, y, z)` | 23 |
| `enqueueWaterAround(x, y, z)` | 27 |
| `queueLeafDecay(x, y, z)` | 36 |
| `decayTick(budget)` | 74 |
| `isFalling(b)` | 91 |
| `enqueueFall(x, y, z)` | 92 |
| `fallTick(budget)` | 96 |
| `waterTick(budget)` | 133 |
| `freezeTick(budget)` | 201 |
| `dryTick(budget)` | 224 |
| `get2(i, dx, dy, dz)` | 249 |
| `fedSideways(i, y, lvl)` | 255 |
| `removeWater(i, y)` | 266 |

내보내는 값 — `MAXFLOW` · `DECAY_R`

### `mesh.js` — 면 데이터 + 청크 메싱

| 함수 | 줄 |
|---|---:|
| `aoValue(s1, s2, cor)` | 43 |
| `chunkId(cx, cy, cz)` | 49 |
| `chunkCX(id)` | 50 |
| `chunkCZ(id)` | 51 |
| `chunkCY(id)` | 52 |
| `buildChunk(cx, cy, cz)` | 54 |
| `emitCross(P, U, C, L, I, x, y, z, b, ci)` | 175 |
| `applyGeo(mesh, pos, uv, col, lit, ind)` | 209 |
| `markDirty(x, y, z)` | 223 |
| `touch(x, y, z)` | 229 |
| `rebuildAll()` | 233 |
| `markAllDirty()` | 238 |
| `buildBudget(ms)` | 241 |

내보내는 값 — `FACES` · `FACE_UV` · `AO_LEVELS` · `opaqueMeshes` · `chunkFilled` · `chunkCenters` · `CROSS_PLANES` · `dirty`

### `scene.js` — three.js 씬 · 셰이더 · 파티클

| 함수 | 줄 |
|---|---:|
| `voxMaterial(extra)` | 90 |
| `updateChunkVisibility(farDist)` | 130 |
| `burst(x, y, z, blockId, count)` | 248 |
| `updateParticles(dt)` | 266 |
| `updateEdge(px, pz)` | 323 |
| `updateSelectionBox(b)` | 339 |

내보내는 값 — `matOpaque` · `scene` · `stage` · `VOX_VS` · `VOX_FS` · `voxUniforms` · `skyUniforms` · `sky` · `cloudMat` · `cloudGroup` · `HL_EDGES` · `HL_GEO` · `HL_CROSS` · `SHAPE_BOUNDS` · `highlight` · `crackMat` · `crackMesh` · `PMAX` · `pPos` · `pVel` · `pCount` · `pGeo` · `pMat` · `particles` · `edgeMat` · `edgeGroup` · `selMat` · `selBox`

### `daynight.js` — 낮과 밤

| 함수 | 줄 |
|---|---:|
| `sampleSky(t)` | 18 |
| `dayLight(t)` | 31 |
| `applyTime()` | 37 |
| `clockText()` | 58 |

내보내는 값 — `DAY_LEN` · `SKY_STOPS` · `_cA` · `_grey`

### `settings.js` — 설정

| 함수 | 줄 |
|---|---:|
| `saveOpts()` | 20 |
| `applyOpts()` | 23 |

내보내는 값 — `OPT_KEY` · `opts`

### `player.js` — 플레이어 · 충돌 · 레이캐스트

| 함수 | 줄 |
|---|---:|
| `currentShape(upper)` | 17 |
| `spawn()` | 29 |
| `boxHitsWorld(px, py, pz)` | 46 |
| `moveAxis(axis, amount)` | 71 |
| `footSupported(px, py, pz)` | 95 |
| `moveHorizontal(dx, dz)` | 101 |
| `rayBox(o, d, mn, mx, maxT)` | 148 |
| `raycast(maxDist)` | 165 |

내보내는 값 — `HALF` · `player` · `stats` · `STEP_UP` · `_ro` · `_oA`

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
| `caveSound(depthMix)` | 137 |
| `lavaPop(vol)` | 149 |
| `lavaHiss()` | 154 |
| `placeSound(b)` | 159 |
| `miningSound(b)` | 166 |

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
| `loadGame()` | 135 |
| `clearSave()` | 173 |

내보내는 값 — `SAVE_KEY` · `OLD_KEY` · `SLOTS`

### `edit.js` — 편집 · 되돌리기 · 도전 과제

| 함수 | 줄 |
|---|---:|
| `applyEdit(x, y, z, to, record, sh)` | 45 |
| `beginBatch()` | 91 |
| `endBatch(label)` | 92 |
| `undo()` | 110 |
| `redo()` | 119 |
| `refreshAchList()` | 156 |
| `refreshStats()` | 167 |
| `achCount()` | 180 |
| `unlock(id)` | 185 |
| `selectionBounds()` | 209 |
| `selectionSize()` | 210 |
| `fillSelection(block, sh)` | 217 |
| `copySelection()` | 229 |
| `pasteClip(px, py, pz)` | 246 |

내보내는 값 — `HISTORY_MAX` · `ACHIEVEMENTS` · `achGrid` · `statGrid` · `REGION_MAX`

### `hud.js` — HUD · 핫바 · 블록 고르기 · 미니맵

| 함수 | 줄 |
|---|---:|
| `drawIcon(cv, blockId)` | 15 |
| `refreshSlot(i)` | 71 |
| `refreshBar()` | 78 |
| `selectSlot(i)` | 82 |
| `openPicker()` | 116 |
| `closePicker(resume)` | 125 |
| `facingText()` | 138 |
| `showHud(on)` | 161 |
| `toast(msg)` | 167 |
| `drawMinimap()` | 175 |
| `toggleHelp(on)` | 242 |

내보내는 값 — `hotbarEl` · `slotCanvases` · `pickerEl` · `pickGrid` · `FACING` · `tFace` · `tAch` · `tPos` · `underwaterEl` · `airEl` · `perfEl` · `airBar` · `minimapEl` · `mmCap` · `touchEl` · `hudEls` · `toastEl` · `mmCanvas` · `mmCtx` · `mmImage` · `stampEl` · `helpEl`

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
| `refreshHint()` | 44 |
| `advanceTut(step)` | 47 |
| `refreshSlots()` | 57 |
| `refreshMenu()` | 108 |
| `beginPlay()` | 116 |
| `endPlay()` | 133 |
| `useDragMode()` | 152 |
| `goFullscreen()` | 154 |
| `requestPlay()` | 171 |
| `hashSeed(str)` | 194 |
| `applyLook(dx, dy)` | 216 |
| `cycleTime()` | 236 |
| `pickBlock()` | 248 |
| `setStick(dx, dy)` | 487 |
| `endTouch(e)` | 522 |
| `bindHold(id, onDown, onUp)` | 548 |
| `bindOpt(inputId, outId, key, fmt)` | 577 |

내보내는 값 — `overlay` · `goBtn` · `altBtn` · `seedIn` · `canvas` · `isTouch` · `HINT_LOCK` · `HINT_DRAG` · `hintEl` · `TUT` · `slotsEl` · `copySeedBtn` · `lookLast` · `stickZone` · `stickBase` · `stickKnob` · `STICK_R`

### `mine.js` — 캐기 · 놓기

| 함수 | 줄 |
|---|---:|
| `mineAt(hit)` | 14 |
| `upperFromHit(hit)` | 28 |
| `canPlaceAt(px, py, pz)` | 35 |
| `tryInteract(hit)` | 47 |
| `place()` | 57 |

### `sky.js` — 해와 달과 별 · 날씨 · 앰비언트 생물

| 함수 | 줄 |
|---|---:|
| `discTexture(size, stops)` | 11 |
| `updateSkyBodies()` | 96 |
| `columnTop(fx, fz)` | 145 |
| `seedWeather()` | 151 |
| `setWeather(w)` | 160 |
| `localBiome()` | 176 |
| `updateStorm(dt)` | 183 |
| `updateWeather(dt)` | 194 |
| `seedCreatures()` | 274 |
| `placeCreature(i)` | 282 |
| `updateCreatures(dt)` | 292 |

내보내는 값 — `sunMat` · `sunSprite` · `MOON_PHASES` · `moonTex` · `moonMat` · `moonSprite` · `starMat` · `stars` · `WCOUNT` · `wPos` · `wDraw` · `HIDE_Y` · `wGeo` · `wMat` · `weatherPoints` · `rPos` · `rGeo` · `rainLines` · `CCOUNT` · `cPos` · `cSeed` · `cGeo` · `cMat` · `creatures`

### `loop.js` — 게임 루프

| 함수 | 줄 |
|---|---:|
| `newWorld(seed)` | 31 |
| `step(dt)` | 64 |
| `animate()` | 491 |
| `refreshPerf()` | 541 |

내보내는 값 — `GRAVITY` · `SNEAK_MUL` · `AIR_CONTROL` · `fwd` · `clock`
