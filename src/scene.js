// scene.js — three.js 씬 · 셰이더 · 파티클
import { CH, CX, CY, CZ } from "./dims.js";
import { IS_TOUCH, bail } from "./boot.js";
import { CROSS, SHAPE_BOXES, isSolid } from "./blocks.js";
import { AVG_SIDE, atlasTex, crackTex, makeRng } from "./atlas.js";
import { get, set } from "./world.js";
import { chunkCX, chunkCY, chunkCZ, chunkCenters, glassMeshes, opaqueMeshes } from "./mesh.js";

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
  "  float f = smoothstep(uFogNear, uFogFar, vFogDepth);",
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
  uFogFar: { value: 120 }
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
export function updateChunkVisibility(farDist) {
  var lim = farDist + CH * 1.8;
  var lim2 = lim * lim;
  var px = camera.position.x, py = camera.position.y, pz = camera.position.z;
  for (var id = 0; id < chunkCenters.length; id++) {
    var c = chunkCenters[id];
    var dx = c.x - px, dy = c.y - py, dz = c.z - pz;
    var near = (dx * dx + dy * dy + dz * dz) < lim2;
    opaqueMeshes[id].visible = near && opaqueMeshes[id].userData.hasGeo === true;
    glassMeshes[id].visible = near && glassMeshes[id].userData.hasGeo === true;
  }
}

export var cloudMat = new THREE.MeshBasicMaterial({ color: 0xf2f6f8, fog: false, transparent: true, opacity: 0.88 });
export var cloudGroup = new THREE.Group();
(function makeClouds() {
  var rng = makeRng(4242);
  for (var c = 0; c < 22; c++) {
    var g = new THREE.Group();
    for (var p = 0, puffs = 3 + Math.floor(rng() * 4); p < puffs; p++) {
      var m = new THREE.Mesh(new THREE.BoxGeometry(8 + rng() * 14, 3, 8 + rng() * 12), cloudMat);
      m.position.set(rng() * 16 - 8, rng() * 2, rng() * 16 - 8);
      g.add(m);
    }
    g.position.set(rng() * 400 - 200, 58 + rng() * 14, rng() * 400 - 200);
    cloudGroup.add(g);
  }
})();
scene.add(cloudGroup);

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
  var c = AVG_SIDE[blockId] || [160, 160, 160];
  for (var i = 0; i < count && pCount < PMAX; i++) {
    var k = pCount++;
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
      pVel[k * 3] *= 0.4; pVel[k * 3 + 1] = 0; pVel[k * 3 + 2] *= 0.4;
    }
  }
  pGeo.attributes.position.needsUpdate = true;
  pGeo.attributes.color.needsUpdate = true;
  pGeo.setDrawRange(0, pCount);
  particles.visible = pCount > 0;
}
