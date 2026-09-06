// scene.js — three.js 씬 · 셰이더 · 파티클
import { SEA, CH, CX, CY, CZ, WX, WY, WZ } from "./dims.js";
import { IS_TOUCH, bail } from "./boot.js";
import { CROSS, SHAPE_BOXES, isSolid } from "./blocks.js";
import { SWATCH_SIDE, AVG_SIDE, atlasTex, crackTex, makeRng } from "./atlas.js";
import { get, set } from "./world.js";
import { chunkCX, chunkCY, chunkCZ, chunkCenters, dirty, glassMeshes, opaqueMeshes } from "./mesh.js";

export var matOpaque, matGlass;
export var scene, camera, renderer;
export var stage = document.getElementById("stage");

try {
  renderer = new THREE.WebGLRenderer({ antialias: false, powerPreference: "high-performance" });
} catch (err) {
  bail(String(err && err.message || err));
  throw err;
}
if (!renderer) {
  bail("WebGL 컨텍스트를 만들 수 없습니다.");
  throw new Error("no webgl");
}
// DPR 3 인 폰에서 2배로 그리면 프레임이 무너진다 — 터치 기기는 1.25 로 묶는다
renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, IS_TOUCH ? 1.25 : 2));
renderer.setSize(window.innerWidth, window.innerHeight);
stage.appendChild(renderer.domElement);

scene = new THREE.Scene();
camera = new THREE.PerspectiveCamera(72, window.innerWidth / window.innerHeight, 0.08, 600);
camera.rotation.order = "YXZ";

export var VOX_VS = [
  "attribute vec3 acol;",
  "attribute vec3 alight;",
  "uniform float uTime;",
  "varying vec3 vCol;",
  "varying vec3 vLight;",
  "varying vec2 vUvv;",
  "varying float vFogDepth;",
  "void main() {",
  "  vCol = acol;",
  "  vLight = alight;",
  "  vUvv = uv;",
  "  vec3 wp = position;",
  "  wp.y += alight.z * sin(uTime * 1.7 + position.x * 0.8 + position.z * 0.6) * 0.045;",
  "  vec4 mv = modelViewMatrix * vec4(wp, 1.0);",
  "  vFogDepth = -mv.z;",
  "  gl_Position = projectionMatrix * mv;",
  "}"
].join("\n");

export var VOX_FS = [
  "uniform sampler2D map;",
  "uniform float uDay;",
  "uniform vec3 uNight;",
  "uniform vec3 uFogColor;",
  "uniform float uFogNear;",
  "uniform float uFogFar;",
  "uniform float uGamma;",
  "uniform float uTime;",
  "varying vec3 vCol;",
  "varying vec3 vLight;",
  "varying vec2 vUvv;",
  "varying float vFogDepth;",
  "void main() {",
  "  vec4 t = texture2D(map, vUvv);",
  "  if (t.a < 0.02) discard;",
  "  float sky = vLight.x * uDay;",
  "  float blk = vLight.y;",
  "  float l = max(sky, blk);",
  "  float litness = 0.045 + 0.955 * pow(l, 1.30);",
  "  vec3 tint = mix(uNight, vec3(1.0), clamp(sky * 1.25, 0.0, 1.0));",
  "  vec3 c = t.rgb * vCol * litness * tint;",
  "  c += t.rgb * vCol * blk * blk * vec3(0.20, 0.11, 0.02);",
  "  if (vLight.z > 0.5) {",
  "    float sp = sin(vUvv.x * 90.0 + uTime * 1.6) * sin(vUvv.y * 74.0 - uTime * 1.1);",
  "    c += vec3(0.10, 0.14, 0.16) * max(0.0, sp - 0.72) * 3.0 * sky;",
  "  }",
  "  float f = smoothstep(uFogNear, uFogFar, vFogDepth);",
  "  c = pow(max(c, 0.0), vec3(uGamma));",
  "  gl_FragColor = vec4(mix(c, uFogColor, f), t.a);",
  "}"
].join("\n");

export var voxUniforms = {
  map: { value: atlasTex },
  uDay: { value: 1 },
  uTime: { value: 0 },
  uNight: { value: new THREE.Color(0.40, 0.50, 0.86) },
  uFogColor: { value: new THREE.Color(0x9fbecd) },
  uFogNear: { value: 42 },
  uFogFar: { value: 120 },
  uGamma: { value: 1 }
};
export function voxMaterial(extra) {
  var opts = {
    uniforms: voxUniforms,
    vertexShader: VOX_VS,
    fragmentShader: VOX_FS,
    fog: false
  };
  for (var k in extra) if (Object.prototype.hasOwnProperty.call(extra, k)) opts[k] = extra[k];
  return new THREE.ShaderMaterial(opts);
}
matOpaque = voxMaterial({});
matGlass = voxMaterial({ transparent: true, depthWrite: false, side: THREE.DoubleSide });

export var skyUniforms = {
  top: { value: new THREE.Color(0x2b5f96) },
  low: { value: new THREE.Color(0xa8c5d4) }
};
export var sky = new THREE.Mesh(
  new THREE.SphereGeometry(300, 20, 14),
  new THREE.ShaderMaterial({
    side: THREE.BackSide, depthWrite: false, fog: false,
    uniforms: skyUniforms,
    vertexShader: "varying float h; void main(){ h = normalize(position).y; gl_Position = projectionMatrix * modelViewMatrix * vec4(position,1.0); }",
    fragmentShader: "uniform vec3 top; uniform vec3 low; varying float h; void main(){ gl_FragColor = vec4(mix(low, top, clamp(h*1.5+0.12,0.0,1.0)), 1.0); }"
  })
);
scene.add(sky);

// 위치 속성만 가진 두 지오메트리를 잇는다 (three r128 에는 mergeBufferGeometries 가 번들에 없다)
function mergeGeo(a, b) {
  var pa = a.attributes.position.array, pb = b.attributes.position.array;
  var ia = a.index ? a.index.array : null, ib = b.index ? b.index.array : null;
  var pos = new Float32Array(pa.length + pb.length);
  pos.set(pa, 0); pos.set(pb, pa.length);
  var out = new THREE.BufferGeometry();
  out.setAttribute("position", new THREE.BufferAttribute(pos, 3));
  if (ia && ib) {
    var off = pa.length / 3;
    var idxArr = new Uint32Array(ia.length + ib.length);
    idxArr.set(ia, 0);
    for (var k = 0; k < ib.length; k++) idxArr[ia.length + k] = ib[k] + off;
    out.setIndex(new THREE.BufferAttribute(idxArr, 1));
  }
  return out;
}

// ── 바깥 바다 — 세계 끝에서 물이 일직선으로 잘리고 그 위가 안개판이면
// 섬이 아니라 디오라마가 된다. 수평선을 만들어 준다.
// 가운데를 뚫어 두어 진짜 물 블록과 z-fighting 이 없다.
export var OUTER_SEA_Y = SEA + 1 - 0.12;      // 물 윗면 보정은 mesh.js 와 같은 값
export var outerSea = (function () {
  // 구멍 뚫린 Shape 은 삼각분할이 겹쳐 동일 평면 z-fighting(대각선 줄무늬)을 낸다.
  // 섬을 둘러싸는 판 네 장으로 만든다 — 겹치지 않고 삼각형도 8장뿐이다.
  var R = 700;
  var geos = [];
  function strip(x0, z0, x1, z1) {
    var g = new THREE.PlaneGeometry(x1 - x0, z1 - z0);
    g.rotateX(-Math.PI / 2);
    g.translate((x0 + x1) / 2, 0, (z0 + z1) / 2);
    geos.push(g);
  }
  strip(-R, -R, R, 0);                        // 북
  strip(-R, WZ, R, R);                        // 남
  strip(-R, 0, 0, WZ);                        // 서
  strip(WX, 0, R, WZ);                        // 동
  var geo = geos[0];
  for (var gi = 1; gi < geos.length; gi++) {  // 하나로 합친다 (three r128 에 merge 유틸이 없다)
    geo = mergeGeo(geo, geos[gi]);
  }
  var mat = new THREE.ShaderMaterial({
    uniforms: voxUniforms,                    // 안개는 지형과 같은 값을 그대로 쓴다
    fog: false, depthWrite: true,
    // 안개를 정점에서 보간하면 700칸짜리 삼각형 몇 장에 이음새가 줄무늬로 드러난다.
    // 픽셀마다 카메라와의 거리를 직접 잰다.
    vertexShader: [
      "varying vec3 vW;",
      "void main() {",
      "  vec4 wp = modelMatrix * vec4(position, 1.0);",
      "  vW = wp.xyz;",
      "  gl_Position = projectionMatrix * viewMatrix * wp;",
      "}"
    ].join("\n"),
    fragmentShader: [
      "uniform vec3 uFogColor;",
      "uniform float uFogNear;",
      "uniform float uFogFar;",
      "uniform float uDay;",
      "uniform float uTime;",
      "varying vec3 vW;",
      "void main() {",
      "  float d = length(vW - cameraPosition);",
      "  vec3 water = vec3(0.13, 0.30, 0.47) * (0.35 + 0.65 * uDay);",
      // 잔물결 — 완전히 평평하면 판때기로 보인다. 가까울수록만 보이게 한다
      "  float w = sin(vW.x * 0.09 + uTime * 0.7) * sin(vW.z * 0.11 - uTime * 0.5);",
      "  water += vec3(0.020, 0.028, 0.034) * w * (1.0 - smoothstep(0.0, 90.0, d));",
      "  float f = smoothstep(uFogNear, uFogFar, d);",
      "  gl_FragColor = vec4(mix(water, uFogColor, f), 1.0);",
      "}"
    ].join("\n")
  });
  var m = new THREE.Mesh(geo, mat);
  m.position.y = OUTER_SEA_Y;
  m.frustumCulled = false;
  m.renderOrder = 1;                          // 하늘 뒤 · 반투명(유리 2) 앞
  scene.add(m);
  return m;
})();
// 물 아래에서는 그리지 않는다 — 잠수 중에 머리 위로 판이 지나가면 안 된다
export function updateOuterSea(camY) {
  outerSea.visible = camY > OUTER_SEA_Y;
}

for (var mi = 0; mi < CX * CY * CZ; mi++) {
  var mo = new THREE.Mesh(new THREE.BufferGeometry(), matOpaque);
  var mg = new THREE.Mesh(new THREE.BufferGeometry(), matGlass);
  mg.renderOrder = 2;
  scene.add(mo); scene.add(mg);
  opaqueMeshes.push(mo); glassMeshes.push(mg);
}

for (var ci2 = 0; ci2 < CX * CY * CZ; ci2++) {
  chunkCenters.push(new THREE.Vector3(
    (chunkCX(ci2) + 0.5) * CH, (chunkCY(ci2) + 0.5) * CH, (chunkCZ(ci2) + 0.5) * CH));
}
export var FREE_DIST = 2.4;    // 시야의 이 배를 넘어가면 지오메트리를 놓아 준다
export var chunkFreed = 0;

export function updateChunkVisibility(farDist) {
  var lim = farDist + CH * 1.8;
  var lim2 = lim * lim;
  var free2 = (lim * FREE_DIST) * (lim * FREE_DIST);
  var px = camera.position.x, py = camera.position.y, pz = camera.position.z;
  for (var id = 0; id < chunkCenters.length; id++) {
    var c = chunkCenters[id];
    var dx = c.x - px, dy = c.y - py, dz = c.z - pz;
    var d2 = dx * dx + dy * dy + dz * dz;
    var near = d2 < lim2;
    opaqueMeshes[id].visible = near && opaqueMeshes[id].userData.hasGeo === true;
    glassMeshes[id].visible = near && glassMeshes[id].userData.hasGeo === true;
    // 아주 멀어진 청크는 정점 버퍼를 놓아 준다 — 다시 다가오면 dirty 로 굽는다
    if (d2 > free2 && opaqueMeshes[id].userData.hasGeo === true) {
      opaqueMeshes[id].geometry.dispose();
      glassMeshes[id].geometry.dispose();
      opaqueMeshes[id].geometry = new THREE.BufferGeometry();
      glassMeshes[id].geometry = new THREE.BufferGeometry();
      opaqueMeshes[id].userData.hasGeo = false;
      glassMeshes[id].userData.hasGeo = false;
      opaqueMeshes[id].visible = glassMeshes[id].visible = false;
      dirty.add(id);
      chunkFreed++;
    }
  }
}

export var cloudMat = new THREE.MeshBasicMaterial({ color: 0xf2f6f8, fog: false, transparent: true, opacity: 0.88 });
export var cloudMatHigh = new THREE.MeshBasicMaterial({
  color: 0xe8eef2, fog: false, transparent: true, opacity: 0.52 });
export var cloudGroup = new THREE.Group();      // 낮은 층 — 크고 느리다
export var cloudGroupHigh = new THREE.Group();  // 높은 층 — 얇고 빠르다
(function makeClouds() {
  var rng = makeRng(4242);
  function layer(group, n, mat, yBase, ySpread, scale) {
    for (var c = 0; c < n; c++) {
      var g = new THREE.Group();
      for (var p = 0, puffs = 3 + Math.floor(rng() * 4); p < puffs; p++) {
        var m = new THREE.Mesh(new THREE.BoxGeometry(
          (8 + rng() * 14) * scale, 3 * scale, (8 + rng() * 12) * scale), mat);
        m.position.set(rng() * 16 - 8, rng() * 2, rng() * 16 - 8);
        g.add(m);
      }
      g.position.set(rng() * 400 - 200, yBase + rng() * ySpread, rng() * 400 - 200);
      group.add(g);
    }
  }
  layer(cloudGroup, 22, cloudMat, 58, 14, 1);
  layer(cloudGroupHigh, 16, cloudMatHigh, 92, 18, 1.7);
})();
scene.add(cloudGroup);
scene.add(cloudGroupHigh);

// 모양마다 하나씩 미리 만들어 두는 선택 상자 — 반블록을 조준하면 납작하게 감싼다
export var HL_EDGES = [[0,1],[1,2],[2,3],[3,0],[4,5],[5,6],[6,7],[7,4],[0,4],[1,5],[2,6],[3,7]];
export var HL_GEO = (function () {
  var out = [];
  for (var si = 0; si < SHAPE_BOXES.length; si++) {
    var boxes = SHAPE_BOXES[si], pts = [];
    for (var bi = 0; bi < boxes.length; bi++) {
      var q = boxes[bi], e = 0.004;
      var c = [
        [q[0] - e, q[1] - e, q[2] - e], [q[3] + e, q[1] - e, q[2] - e],
        [q[3] + e, q[1] - e, q[5] + e], [q[0] - e, q[1] - e, q[5] + e],
        [q[0] - e, q[4] + e, q[2] - e], [q[3] + e, q[4] + e, q[2] - e],
        [q[3] + e, q[4] + e, q[5] + e], [q[0] - e, q[4] + e, q[5] + e]
      ];
      for (var k = 0; k < HL_EDGES.length; k++) {
        var a = c[HL_EDGES[k][0]], b2 = c[HL_EDGES[k][1]];
        pts.push(a[0], a[1], a[2], b2[0], b2[1], b2[2]);
      }
    }
    var g = new THREE.BufferGeometry();
    g.setAttribute("position", new THREE.Float32BufferAttribute(pts, 3));
    out.push(g);
  }
  return out;
})();
// 풀·꽃·횃불은 SHAPE_BOXES 가 아니라 CROSS 치수로 상자를 만든다
export var HL_CROSS = (function () {
  var out = {};
  Object.keys(CROSS).forEach(function (key) {
    var cfg = CROSS[key], e = 0.004;
    var lo = 0.5 - cfg.w - e, hi = 0.5 + cfg.w + e;
    var c = [
      [lo, -e, lo], [hi, -e, lo], [hi, -e, hi], [lo, -e, hi],
      [lo, cfg.h + e, lo], [hi, cfg.h + e, lo], [hi, cfg.h + e, hi], [lo, cfg.h + e, hi]
    ];
    var pts = [];
    for (var k = 0; k < HL_EDGES.length; k++) {
      var a = c[HL_EDGES[k][0]], b = c[HL_EDGES[k][1]];
      pts.push(a[0], a[1], a[2], b[0], b[1], b[2]);
    }
    var g = new THREE.BufferGeometry();
    g.setAttribute("position", new THREE.Float32BufferAttribute(pts, 3));
    out[key] = g;
  });
  return out;
})();

// 모양별 겉면 범위 — 균열 오버레이를 실제 블록 크기에 맞추는 데 쓴다
export var SHAPE_BOUNDS = SHAPE_BOXES.map(function (boxes) {
  var mn = [1, 1, 1], mx = [0, 0, 0];
  boxes.forEach(function (q) {
    for (var a = 0; a < 3; a++) {
      if (q[a] < mn[a]) mn[a] = q[a];
      if (q[a + 3] > mx[a]) mx[a] = q[a + 3];
    }
  });
  return { mn: mn, mx: mx };
});

// 점화된 TNT 를 감싸 하얗게 깜빡이는 상자 — 마크의 "곧 터진다" 신호
export var PRIMED_MAX = 8;
export var primedMat = new THREE.MeshBasicMaterial({
  color: 0xffffff, fog: false, transparent: true, opacity: 0.55, depthWrite: false
});
export var primedBoxes = [];
for (var pb = 0; pb < PRIMED_MAX; pb++) {
  var pm = new THREE.Mesh(new THREE.BoxGeometry(1.06, 1.06, 1.06), primedMat);
  pm.visible = false;
  pm.renderOrder = 3;
  scene.add(pm);
  primedBoxes.push(pm);
}

export var highlight = new THREE.LineSegments(
  HL_GEO[0],
  new THREE.LineBasicMaterial({ color: 0x0d1114, fog: false, transparent: true, opacity: 0.85 })
);
highlight.visible = false;
scene.add(highlight);

export var crackMat = new THREE.MeshBasicMaterial({
  map: crackTex[0], transparent: true, depthWrite: false, fog: false,
  polygonOffset: true, polygonOffsetFactor: -4, polygonOffsetUnits: -4
});
export var crackMesh = new THREE.Mesh(new THREE.BoxGeometry(1.002, 1.002, 1.002), crackMat);
crackMesh.visible = false;
crackMesh.renderOrder = 3;
scene.add(crackMesh);

// ── 파편
export var PMAX = 220;
export var pPos = new Float32Array(PMAX * 3), pCol = new Float32Array(PMAX * 3);
export var pVel = new Float32Array(PMAX * 3), pLife = new Float32Array(PMAX);
export var pCount = 0;
export var pGeo = new THREE.BufferGeometry();
pGeo.setAttribute("position", new THREE.BufferAttribute(pPos, 3));
pGeo.setAttribute("color", new THREE.BufferAttribute(pCol, 3));
export var pMat = new THREE.PointsMaterial({ size: 0.14, vertexColors: true, sizeAttenuation: true });
export var particles = new THREE.Points(pGeo, pMat);
particles.frustumCulled = false;
scene.add(particles);

export function burst(x, y, z, blockId, count) {
  var sw = SWATCH_SIDE[blockId];
  var avg = AVG_SIDE[blockId] || [160, 160, 160];
  for (var i = 0; i < count && pCount < PMAX; i++) {
    var k = pCount++;
    // 파편마다 그 블록 텍스처의 다른 픽셀을 쓴다 — 재질이 튀는 느낌이 채굴 타격감의 절반이다
    var c = (sw && sw.length) ? sw[(Math.random() * sw.length) | 0] : avg;
    pPos[k * 3] = x + 0.5 + (Math.random() - 0.5) * 0.8;
    pPos[k * 3 + 1] = y + 0.5 + (Math.random() - 0.5) * 0.8;
    pPos[k * 3 + 2] = z + 0.5 + (Math.random() - 0.5) * 0.8;
    pVel[k * 3] = (Math.random() - 0.5) * 3.2;
    pVel[k * 3 + 1] = Math.random() * 3.4 + 0.6;
    pVel[k * 3 + 2] = (Math.random() - 0.5) * 3.2;
    var j = 0.82 + Math.random() * 0.36;
    pCol[k * 3] = Math.min(1, c[0] / 255 * j);
    pCol[k * 3 + 1] = Math.min(1, c[1] / 255 * j);
    pCol[k * 3 + 2] = Math.min(1, c[2] / 255 * j);
    pLife[k] = 0.5 + Math.random() * 0.45;
  }
}

export function updateParticles(dt) {
  for (var k = 0; k < pCount; k++) {
    pLife[k] -= dt;
    if (pLife[k] <= 0) {
      var last = --pCount;
      if (k !== last) {
        for (var c = 0; c < 3; c++) {
          pPos[k * 3 + c] = pPos[last * 3 + c];
          pVel[k * 3 + c] = pVel[last * 3 + c];
          pCol[k * 3 + c] = pCol[last * 3 + c];
        }
        pLife[k] = pLife[last];
      }
      k--; continue;
    }
    pVel[k * 3 + 1] -= 11 * dt;
    pPos[k * 3] += pVel[k * 3] * dt;
    pPos[k * 3 + 1] += pVel[k * 3 + 1] * dt;
    pPos[k * 3 + 2] += pVel[k * 3 + 2] * dt;
    if (isSolid(get(Math.floor(pPos[k * 3]), Math.floor(pPos[k * 3 + 1]), Math.floor(pPos[k * 3 + 2])))) {
      pPos[k * 3 + 1] = Math.floor(pPos[k * 3 + 1]) + 1.02;
      // 바닥에 닿으면 한 번 튕기고 잦아든다 — 툭 떨어져 멈추는 것보다 살아 있다
      pVel[k * 3 + 1] = pVel[k * 3 + 1] < -1.6 ? -pVel[k * 3 + 1] * 0.32 : 0;
      pVel[k * 3] *= 0.55; pVel[k * 3 + 2] *= 0.55;
    }
  }
  pGeo.attributes.position.needsUpdate = true;
  pGeo.attributes.color.needsUpdate = true;
  pGeo.setDrawRange(0, pCount);
  particles.visible = pCount > 0;
}

// ── 세계의 끝 — 보이지 않는 벽 대신, 가까이 가면 옅은 격자벽이 보인다
export var edgeMat = new THREE.MeshBasicMaterial({
  color: 0x7ec850, transparent: true, opacity: 0, fog: false,
  side: THREE.DoubleSide, depthWrite: false, wireframe: true
});
export var edgeGroup = new THREE.Group();
(function () {
  var seg = 12;
  var planes = [
    { w: WZ, h: WY, pos: [0, WY / 2, WZ / 2], rot: [0, Math.PI / 2, 0] },
    { w: WZ, h: WY, pos: [WX, WY / 2, WZ / 2], rot: [0, Math.PI / 2, 0] },
    { w: WX, h: WY, pos: [WX / 2, WY / 2, 0], rot: [0, 0, 0] },
    { w: WX, h: WY, pos: [WX / 2, WY / 2, WZ], rot: [0, 0, 0] }
  ];
  planes.forEach(function (p) {
    var m = new THREE.Mesh(new THREE.PlaneGeometry(p.w, p.h, seg, seg), edgeMat);
    m.position.set(p.pos[0], p.pos[1], p.pos[2]);
    m.rotation.set(p.rot[0], p.rot[1], p.rot[2]);
    edgeGroup.add(m);
  });
})();
edgeGroup.renderOrder = 5;
scene.add(edgeGroup);

// 가장자리에서 얼마나 가까운지에 따라 진해진다
export function updateEdge(px, pz) {
  var d = Math.min(px, WX - px, pz, WZ - pz);
  var near = Math.max(0, 1 - d / 10);
  edgeMat.opacity = near * near * 0.34;
  edgeGroup.visible = edgeMat.opacity > 0.005;
}

// ── 영역 선택 상자 — 두 모서리를 찍으면 초록 테두리가 뜬다
export var selMat = new THREE.LineBasicMaterial({ color: 0x7ec850, fog: false,
  transparent: true, opacity: 0.9 });
export var selBox = new THREE.LineSegments(
  new THREE.EdgesGeometry(new THREE.BoxGeometry(1, 1, 1)), selMat);
selBox.visible = false;
selBox.renderOrder = 6;
scene.add(selBox);

export function updateSelectionBox(b) {
  if (!b) { selBox.visible = false; return; }
  selBox.visible = true;
  selBox.scale.set(b.x1 - b.x0 + 1.02, b.y1 - b.y0 + 1.02, b.z1 - b.z0 + 1.02);
  selBox.position.set((b.x0 + b.x1 + 1) / 2, (b.y0 + b.y1 + 1) / 2, (b.z0 + b.z1 + 1) / 2);
}
