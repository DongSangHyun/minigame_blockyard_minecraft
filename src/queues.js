// queues.js — 시뮬레이션 대기열 (의존성 없음)
export const Q = {
  waterQ: [],
  waterHead: 0,
  dryQ: [],
  dryHead: 0,
  decayQ: [],
  decayHead: 0,
  decayTimer: 0,
  freezeQ: [],
  freezeHead: 0,
  fireQ: [],
  fireHead: 0,
  fallQ: [],
  fallHead: 0,
  lavaQ: [],
  lavaHead: 0,
  lavaDryQ: [],
  lavaDryHead: 0,
  lavaTimer: 0,
  growQ: [],          // 자라기를 기다리는 묘목
  growTimer: 0,
};

export function resetQueues() {
  Q.waterQ.length = 0; Q.waterHead = 0;
  Q.dryQ.length = 0; Q.dryHead = 0;
  Q.decayQ.length = 0; Q.decayHead = 0; Q.decayTimer = 0;
  Q.freezeQ.length = 0; Q.freezeHead = 0;
  Q.fireQ.length = 0; Q.fireHead = 0;
  Q.fallQ.length = 0; Q.fallHead = 0;
  Q.lavaQ.length = 0; Q.lavaHead = 0;
  Q.lavaDryQ.length = 0; Q.lavaDryHead = 0; Q.lavaTimer = 0;
  Q.growQ.length = 0; Q.growTimer = 0;
}
