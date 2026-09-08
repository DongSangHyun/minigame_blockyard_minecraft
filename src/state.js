// state.js — 여러 모듈이 값을 바꾸는 공유 상태
// 읽기만 하는 값은 각 모듈이 그대로 export 한다 (ES 모듈 라이브 바인딩).
export const S = {
  booted: false,
  worldSeed: 0,
  terrain: 0,
  urlSeed: null,
  slot: 1,
  worldDirty: false,
  saveTimer: 0,
  netFetch: null,          // 클라우드 통신 갈아 끼우기 (테스트용)
  cloudBusy: false,
  wasBuried: false,
  primed: [],           // 점화된 TNT — {x,y,z,t}
  primedBeep: 0,
  timeOfDay: 0.25,      // 06:00 — newWorld 만 고쳐 놨더니 처음 온 사람은 07:12 로 시작했다
  moonDay: 0,
  bar: null,
  barAlt: null,
  barPage: 1,
  flySpeed: 1,
  earned: {},
  placedKinds: {},
  lampsPlaced: 0,
  torchesPlaced: 0,
  playSeconds: 0,
  tut: 0,
  muted: false,
  relightQueued: false,
  shapeMode: 0, // 0 전체 · 1 반블록 · 2 계단
  bobPhase: 0,
  bobAmount: 0,
  stepPhase: 0,
  loadedFromSave: false,
  placeCooldown: 0,
  savedPos: null,
  savedYaw: 0,
  savedPitch: 0,
  lastRTap: -1e9, // R 오폭으로 세계가 날아가지 않도록
  loopPaused: false, // 테스트에서 시뮬레이션을 멈춰 세울 때만 쓴다
  weatherTimer: 40 + Math.random() * 60,
  mmTimer: 0,
  toastTimer: 0,
  selected: 0,
  active: false,
  started: false,
  lockMode: true,
  uiOpen: false,
  keys: Object.create(null),
  // 이번 프레임에 조준한 칸의 "앞면" 좌표 — F3 이 밝기를 읽는다.
  // step() 이 이미 쏜 레이캐스트 결과를 animate() 로 넘기는 통로다 (두 번 쏘지 않으려고).
  aimFace: null,
  noSeaDecor: false,
  noHuts: false,          // 시험용 — 오두막을 빼고 생성한다      // 시험용 — 바다 장식을 빼고 생성한다
  worldName: "",          // 사람이 붙인 세계 이름 (없으면 시드로 부른다)
  weather: 0,
  weatherLock: false,      // K 로 손수 고른 날씨는 저절로 안 바뀐다
  sneaking: false,
  sneakLatch: false,        // 전환식 웅크리기가 켜져 있나
  crouchWas: false,         // 지난 프레임에 Shift 가 눌려 있었나 (누른 순간만 잡는다)
  sprintTap: false, // W 더블탭으로 걸린 달리기
  sprintingNow: false,
  lastFwdTap: 0,
  lastSpaceTap: 0,
  lastPlaceCell: -1,
  hudHidden: false,
  autoPerf: true,
  perfDrop: 0,
  farNow: 0,
  fireOrigin: null,
  fireOrigins: [],
  grassTimer: 0,
  handLight: 1,
  touchPlace: false,
  padFlyTap: 0,
  delArm: 0,
  delArmAt: 0,      // 불을 붙인 자리들 — 번짐 상한을 불마다 따로 잰다
  wantShot: false,
  showPerf: false,
  spawnPoint: null,
  thirdPerson: 0,
  photoMode: false,
  confirmNew: false,
  swing: 0,
  heldKey: -1,
  ghostKey: -1,
  sneakEye: 0, // 웅크릴 때 눈높이가 부드럽게 내려간다
  // 계단·반블록을 걸어 오를 때 눈이 한 프레임에 0.5칸 순간이동하던 것을 녹인다.
  // 올라선 높이를 여기 담아 두고 카메라에서 빼면, 몇 프레임에 걸쳐 따라 올라온다.
  stepLift: 0,
  fovNow: 0, // 달릴 때 시야각 킥
  hudTimer: 0,
  fpsAccum: 0,
  fpsFrames: 0,
  waterTimer: 0,
  // 최근 1초에서 가장 오래 걸린 프레임 — F3 이 "지금 왜 뻑뻑한지" 를 말하는 데 쓴다
  everEdited: false,      // 이번 판에서 사람이 한 번이라도 편집했나 (되돌리기 안내에 쓴다)
  worstMs: 0,
  worstAcc: 0,
  achTimer: 0,
  buildAchTimer: 0,
  // 걸은 거리 — "발을 딛는다" 류 과제가 스폰 자리에 서 있기만 해도 열리는 걸 막는다
  walked: 0,
  achPrevX: null,
  achPrevZ: null,
  mobsRestored: false,
  // 묘목 큐를 세계 전체에서 다시 채워야 하나 — 저장을 불러오거나 세계를 갈아탄 뒤 한 번.
  // 큐는 저장하지 않으므로, 이 신호가 없으면 불러온 세계의 묘목이 영영 안 자란다.
  growDirty: false,
  batchCells: 0,
  // 방금 닫힌 사람의 편집 묶음 — 그 편집 때문에 떨어지는 모래·자갈을 여기에 같이 담는다.
  // 안 담으면 "되돌리기 — 모래 놓기" 라고 말해 놓고 떨어진 모래는 그대로 남는다.
  fallOwner: null,
  // 붙인 불이 연 묶음 — 번짐과 타 없어짐을 여기에 담아야 Ctrl+Z 한 번에 집이 돌아온다.
  // v69 는 "번짐 끄기" 설정으로 막았고, 이건 켜 둔 채로도 되돌아가게 한다.
  fireOwner: null,
  // 물·용암이 스스로 흐르고 마르는 것도 그것을 일으킨 편집에 실린다 (자문 12차 #1).
  // 없으면 "되돌리기 — 돌 캐기" 라고 말해 놓고 밀려든 물 192칸은 그대로 남는다.
  fluidOwner: null,
  wasFeetInWater: false,   // 물에 막 들어간 순간을 잡는다 (첨벙)
  achListStale: false,
  lavaTimer: 0,
  caveTimer: 6,
  caveHeard: 0,        // 동굴 울림이 몇 번 났나 (시험용 계수기)
  moodTimer: 40,
  oxygen: 1,
  mmZoom: 1,
  contour: true,
  liquidTimer: 0,
  freezeTimer: 0,
  floorTimer: 0,
  floorReady: false,   // 청크 기둥 바닥을 한 번이라도 쟀나 (v80)
  torchFxTimer: 0,
  wasInLavaFeet: false,   // 용암에 발을 담그는 순간 치익 소리를 내려고
  wasUnderwater: false,
  wasInLava: false,
  wasOnGround: true,
  creaturePhase: 0,
  mmUnder: false,
  weatherPhase: 0,
  weatherMix: 0,
  rainTimer: 0,
  snowTimer: 0,
  stormTimer: 8,
  flash: 0,
  cricketTimer: 0,
  saveWarned: false,
  dragging: false,
  dragBtn: -1,
  dragDist: 0,
  dragStart: 0,
  touchBreak: false,
  stickId: null,
  lookId: null,
  breaking: { on: false, x: 0, y: 0, z: 0, t: 0, need: 1, stage: -1, sw: 0 },
  audioCtx: null,
  masterGain: null,
  muffle: null,
  ambient: null,
  history: [],
  batch: null,
  selA: null,
  selB: null,
  clip: null,
  marks: [],
  recent: [],
  cmdHist: [],
  cmdAt: 0,
  binds: { fly: "KeyF", shape: "KeyG", pick: "KeyQ", help: "KeyH" },
  future: [],
  stick: { x: 0, z: 0 },
  mouseDown: [false, false, false],
};
