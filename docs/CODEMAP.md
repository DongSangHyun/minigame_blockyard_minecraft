<!-- 자동 생성 파일 — 직접 고치지 말고 `node tools/codemap.mjs` 를 다시 실행하세요 -->
# CODEMAP — 코드 색인

생성일 2026-09-05 · 모듈 24개 · 합계 4,397줄

진입점은 `index.html` → `src/main.js`. 아래 표는 **의존 순서**로 정렬돼 있습니다 —
위에 있는 모듈은 아래 모듈을 모릅니다(순환이 있는 곳은 함수 호출 시점에만 서로를 봅니다).

## 모듈 지도

| 모듈 | 하는 일 | 줄 | 기대는 곳 |
|---|---|---:|---|
| [`state.js`](../src/state.js) | 여러 모듈이 값을 바꾸는 공유 상태 | 86 | — |
| [`dims.js`](../src/dims.js) | 세계 치수와 좌표 계산 (의존성 없음) | 10 | — |
| [`queues.js`](../src/queues.js) | 시뮬레이션 대기열 (의존성 없음) | 23 | — |
| [`boot.js`](../src/boot.js) | 부팅 가드 · 환경 판별 | 26 | state |
| [`blocks.js`](../src/blocks.js) | 블록 정의 · 모양 · 성질 | 122 | state |
| [`atlas.js`](../src/atlas.js) | 텍스처 아틀라스 (코드로 그리는 16×16 도트) | 365 | blocks |
| [`world.js`](../src/world.js) | 월드 데이터 · 지형 생성 | 276 | state · queues · dims · blocks · atlas |
| [`light.js`](../src/light.js) | 광원 — 햇빛과 블록광 BFS | 182 | state · dims · blocks · world · mesh · player |
| [`fluids.js`](../src/fluids.js) | 물 흐름 · 낙하 블록 · 잎 부패 | 274 | state · queues · dims · blocks · world · light · mesh · scene · audio · edit |
| [`mesh.js`](../src/mesh.js) | 면 데이터 + 청크 메싱 | 254 | dims · blocks · atlas · world · light |
| [`scene.js`](../src/scene.js) | three.js 씬 · 셰이더 · 파티클 | 292 | dims · boot · blocks · atlas · world · mesh |
| [`daynight.js`](../src/daynight.js) | 낮과 밤 | 55 | state · world · scene |
| [`settings.js`](../src/settings.js) | 설정 | 30 | state · boot · scene |
| [`player.js`](../src/player.js) | 플레이어 · 충돌 · 레이캐스트 | 216 | state · dims · blocks · world · scene |
| [`audio.js`](../src/audio.js) | 소리 | 147 | state · blocks · daynight · settings |
| [`save.js`](../src/save.js) | 저장 · 불러오기 | 157 | state · dims · blocks · world · player · hud |
| [`edit.js`](../src/edit.js) | 편집 · 되돌리기 · 도전 과제 | 165 | state · dims · blocks · world · light · fluids · mesh · player · audio · hud · sky |
| [`hud.js`](../src/hud.js) | HUD · 핫바 · 블록 고르기 · 미니맵 | 221 | state · version · dims · blocks · atlas · world · player · hand · input |
| [`hand.js`](../src/hand.js) | 1인칭 손과 들고 있는 블록 | 136 | state · boot · blocks · atlas · world · mesh · scene · player |
| [`input.js`](../src/input.js) | 입력 (키보드 · 마우스 · 터치) | 455 | state · boot · blocks · scene · daynight · settings · player · audio · save · edit · hud · hand · mine · sky · loop |
| [`mine.js`](../src/mine.js) | 캐기 · 놓기 | 95 | state · dims · blocks · world · scene · player · audio · edit · hud · hand · input |
| [`sky.js`](../src/sky.js) | 해와 달과 별 · 날씨 · 앰비언트 생물 | 262 | state · dims · atlas · world · scene · daynight · player |
| [`loop.js`](../src/loop.js) | 게임 루프 | 424 | state · queues · dims · boot · blocks · atlas · world · light · fluids · mesh · scene · daynight · settings · player · audio · save · edit · hud · hand · mine · sky |
| [`main.js`](../src/main.js) | 조립과 시작 | 124 | state · atlas · queues · dims · blocks · world · light · fluids · mesh · scene · daynight · settings · player · audio · save · edit · hud · hand · input · mine · sky · loop |

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
| `hardnessOf(b)` | 62 |
| `isUnbreakable(b)` | 65 |
| `isCross(b)` | 81 |
| `needsFloor(b)` | 82 |
| `isLiquid(b)` | 112 |
| `isTransparent(b)` | 113 |
| `isSolid(b)` | 114 |
| `blocksLight(b)` | 115 |
| `lightPass(b)` | 116 |

내보내는 값 — `AIR` · `TILES` · `NAMES` · `HARDNESS` · `EMIT` · `CROSS` · `ALL_BLOCKS` · `DEFAULT_BAR` · `SH_FULL` · `SH_UP_OFF` · `SH_SLAB_UP` · `SHAPE_BOXES` · `SHAPE_NAMES`

### `atlas.js` — 텍스처 아틀라스 (코드로 그리는 16×16 도트)

| 함수 | 줄 |
|---|---:|
| `tileOrigin(i)` | 9 |
| `makeRng(seed)` | 11 |
| `paint(index, fn)` | 21 |
| `pick(rng, list)` | 29 |
| `orePaint(tint1, tint2)` | 124 |
| `tileAvg(i)` | 292 |
| `animateLiquids(t)` | 360 |

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
| `refreshAllTops()` | 50 |
| `hash2(x, y, seed)` | 54 |
| `hash3(x, y, z, seed)` | 59 |
| `smooth(t)` | 65 |
| `lerp(a, b, t)` | 66 |
| `noise2(x, y, seed)` | 68 |
| `noise3(x, y, z, seed)` | 75 |
| `generate(seed)` | 85 |

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
| `applyGeo(mesh, pos, uv, col, lit, ind)` | 207 |
| `markDirty(x, y, z)` | 221 |
| `touch(x, y, z)` | 227 |
| `rebuildAll()` | 231 |
| `markAllDirty()` | 236 |
| `buildBudget(ms)` | 239 |

내보내는 값 — `FACES` · `FACE_UV` · `AO_LEVELS` · `opaqueMeshes` · `chunkFilled` · `chunkCenters` · `CROSS_PLANES` · `dirty`

### `scene.js` — three.js 씬 · 셰이더 · 파티클

| 함수 | 줄 |
|---|---:|
| `voxMaterial(extra)` | 87 |
| `updateChunkVisibility(farDist)` | 127 |
| `burst(x, y, z, blockId, count)` | 245 |
| `updateParticles(dt)` | 263 |

내보내는 값 — `matOpaque` · `scene` · `stage` · `VOX_VS` · `VOX_FS` · `voxUniforms` · `skyUniforms` · `sky` · `cloudMat` · `cloudGroup` · `HL_EDGES` · `HL_GEO` · `HL_CROSS` · `SHAPE_BOUNDS` · `highlight` · `crackMat` · `crackMesh` · `PMAX` · `pPos` · `pVel` · `pCount` · `pGeo` · `pMat` · `particles`

### `daynight.js` — 낮과 밤

| 함수 | 줄 |
|---|---:|
| `sampleSky(t)` | 18 |
| `dayLight(t)` | 31 |
| `applyTime()` | 36 |
| `clockText()` | 50 |

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
| `boxHitsWorld(px, py, pz)` | 39 |
| `moveAxis(axis, amount)` | 63 |
| `footSupported(px, py, pz)` | 87 |
| `moveHorizontal(dx, dz)` | 93 |
| `rayBox(o, d, mn, mx, maxT)` | 140 |
| `raycast(maxDist)` | 157 |

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
| `lavaPop(vol)` | 125 |
| `lavaHiss()` | 130 |
| `placeSound(b)` | 135 |
| `miningSound(b)` | 142 |

내보내는 값 — `SOFT`

### `save.js` — 저장 · 불러오기

| 함수 | 줄 |
|---|---:|
| `hasSave()` | 13 |
| `encodeArrB64(arr)` | 19 |
| `decodeArrB64(b64, arr, len)` | 38 |
| `encodeWorldB64()` | 58 |
| `decodeWorldB64(b64)` | 59 |
| `encodeWorld()` | 60 |
| `decodeWorld(runs, dst, len)` | 69 |
| `liftLegacy(src, dst, asRuns)` | 84 |
| `saveGame()` | 99 |
| `loadGame()` | 120 |
| `clearSave()` | 154 |

내보내는 값 — `SAVE_KEY` · `OLD_KEY`

### `edit.js` — 편집 · 되돌리기 · 도전 과제

| 함수 | 줄 |
|---|---:|
| `applyEdit(x, y, z, to, record, sh)` | 32 |
| `undo()` | 74 |
| `redo()` | 85 |
| `refreshAchList()` | 124 |
| `refreshStats()` | 135 |
| `achCount()` | 148 |
| `unlock(id)` | 153 |

내보내는 값 — `HISTORY_MAX` · `ACHIEVEMENTS` · `achGrid` · `statGrid`

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
| `showHud(on)` | 157 |
| `toast(msg)` | 163 |
| `drawMinimap()` | 171 |

내보내는 값 — `hotbarEl` · `slotCanvases` · `pickerEl` · `pickGrid` · `FACING` · `tFace` · `tPos` · `underwaterEl` · `minimapEl` · `mmCap` · `touchEl` · `hudEls` · `toastEl` · `mmCanvas` · `mmCtx` · `mmImage` · `stampEl`

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
| `refreshHint()` | 42 |
| `advanceTut(step)` | 45 |
| `refreshMenu()` | 53 |
| `beginPlay()` | 60 |
| `endPlay()` | 77 |
| `useDragMode()` | 96 |
| `goFullscreen()` | 98 |
| `requestPlay()` | 115 |
| `hashSeed(str)` | 138 |
| `applyLook(dx, dy)` | 160 |
| `cycleTime()` | 180 |
| `pickBlock()` | 192 |
| `setStick(dx, dy)` | 337 |
| `endTouch(e)` | 372 |
| `bindHold(id, onDown, onUp)` | 398 |
| `bindOpt(inputId, outId, key, fmt)` | 427 |

내보내는 값 — `overlay` · `goBtn` · `altBtn` · `seedIn` · `canvas` · `isTouch` · `HINT_LOCK` · `HINT_DRAG` · `hintEl` · `TUT` · `lookLast` · `stickZone` · `stickBase` · `stickKnob` · `STICK_R`

### `mine.js` — 캐기 · 놓기

| 함수 | 줄 |
|---|---:|
| `mineAt(hit)` | 14 |
| `upperFromHit(hit)` | 28 |
| `canPlaceAt(px, py, pz)` | 35 |
| `place()` | 46 |

### `sky.js` — 해와 달과 별 · 날씨 · 앰비언트 생물

| 함수 | 줄 |
|---|---:|
| `discTexture(size, stops)` | 10 |
| `updateSkyBodies()` | 63 |
| `columnTop(fx, fz)` | 109 |
| `seedWeather()` | 115 |
| `setWeather(w)` | 124 |
| `localBiome()` | 140 |
| `updateWeather(dt)` | 146 |
| `seedCreatures()` | 214 |
| `placeCreature(i)` | 222 |
| `updateCreatures(dt)` | 232 |

내보내는 값 — `sunMat` · `sunSprite` · `moonMat` · `moonSprite` · `starMat` · `stars` · `WCOUNT` · `wPos` · `wDraw` · `HIDE_Y` · `wGeo` · `wMat` · `weatherPoints` · `rPos` · `rGeo` · `rainLines` · `CCOUNT` · `cPos` · `cSeed` · `cGeo` · `cMat` · `creatures`

### `loop.js` — 게임 루프

| 함수 | 줄 |
|---|---:|
| `newWorld(seed)` | 30 |
| `step(dt)` | 58 |
| `animate()` | 394 |

내보내는 값 — `GRAVITY` · `SNEAK_MUL` · `AIR_CONTROL` · `fwd` · `clock`
