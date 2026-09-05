// sky.js — 해와 달과 별 · 날씨 · 앰비언트 생물
import { S } from "./state.js";
import { WX, WZ } from "./dims.js";
import { makeRng } from "./atlas.js";
import { biomeMap, set, topMap } from "./world.js";
import { camera, scene } from "./scene.js";
import { dayLight } from "./daynight.js";
import { player } from "./player.js";

export function discTexture(size, stops) {
  var cv = document.createElement("canvas");
  cv.width = cv.height = size;
  var c = cv.getContext("2d");
  var g = c.createRadialGradient(size / 2, size / 2, 0, size / 2, size / 2, size / 2);
  stops.forEach(function (st) { g.addColorStop(st[0], st[1]); });
  c.fillStyle = g;
  c.fillRect(0, 0, size, size);
  var t = new THREE.CanvasTexture(cv);
  t.generateMipmaps = false;
  t.minFilter = t.magFilter = THREE.LinearFilter;
  return t;
}

// 나머지 텍스처가 전부 16×16 도트인데 해와 달만 매끈한 원반이면 겉돈다.
// 마크처럼 각진 사각형으로, 달은 8단계 위상까지.
function squareTexture(px, draw) {
  var cv = document.createElement("canvas");
  cv.width = cv.height = px;
  var c = cv.getContext("2d");
  c.imageSmoothingEnabled = false;
  draw(c, px);
  var t = new THREE.CanvasTexture(cv);
  t.generateMipmaps = false;
  t.minFilter = t.magFilter = THREE.NearestFilter;
  return t;
}

export var sunMat = new THREE.SpriteMaterial({
  map: squareTexture(16, function (c, px) {
    c.fillStyle = "#ffe9a0"; c.fillRect(0, 0, px, px);
    c.fillStyle = "#fff6d2"; c.fillRect(2, 2, px - 4, px - 4);
    c.fillStyle = "#fffdf0"; c.fillRect(5, 5, px - 10, px - 10);
  }),
  transparent: true, depthWrite: false, fog: false, blending: THREE.AdditiveBlending
});
export var sunSprite = new THREE.Sprite(sunMat);
sunSprite.scale.setScalar(30);
scene.add(sunSprite);

// 달 위상 8단계 — 밤마다 모양이 바뀐다
export var MOON_PHASES = 8;
export var moonTex = [];
for (var mp = 0; mp < MOON_PHASES; mp++) {
  moonTex.push(squareTexture(16, (function (phase) {
    return function (c, px) {
      c.fillStyle = "#e7eefb"; c.fillRect(0, 0, px, px);
      c.fillStyle = "#cfdaf0";
      c.fillRect(3, 4, 3, 3); c.fillRect(9, 8, 4, 3); c.fillRect(6, 12, 3, 2);
      // 위상 — 오른쪽부터 잘라 나간다 (0 보름 · 4 그믐)
      var cut = Math.round(Math.abs(phase - 4) / 4 * px);
      if (cut > 0) {
        c.clearRect(phase <= 4 ? px - cut : 0, 0, cut, px);
      }
    };
  })(mp)));
}
export var moonMat = new THREE.SpriteMaterial({
  map: moonTex[0], transparent: true, depthWrite: false, fog: false
});
export var moonSprite = new THREE.Sprite(moonMat);
moonSprite.scale.setScalar(24);
scene.add(moonSprite);

export var starMat = new THREE.PointsMaterial({
  color: 0xdce6f2, size: 1.5, sizeAttenuation: false,
  transparent: true, opacity: 0, depthWrite: false, fog: false
});
export var stars = (function () {
  var n = 520, pos = new Float32Array(n * 3);
  var rng = makeRng(20260904);
  for (var i = 0; i < n; i++) {
    var u = rng() * 2 - 1, a = rng() * Math.PI * 2, r = Math.sqrt(1 - u * u);
    pos[i * 3] = Math.cos(a) * r * 280;
    pos[i * 3 + 1] = Math.abs(u) * 280;      // 위쪽 반구에만
    pos[i * 3 + 2] = Math.sin(a) * r * 280;
  }
  var g = new THREE.BufferGeometry();
  g.setAttribute("position", new THREE.BufferAttribute(pos, 3));
  var pts = new THREE.Points(g, starMat);
  pts.frustumCulled = false;
  scene.add(pts);
  return pts;
})();

export function updateSkyBodies() {
  // 하루가 지날 때마다 달 위상이 한 칸씩 돈다
  var phase = Math.floor(S.moonDay) % MOON_PHASES;
  if (moonMat.map !== moonTex[phase]) { moonMat.map = moonTex[phase]; moonMat.needsUpdate = true; }
  var th = (S.timeOfDay - 0.25) * Math.PI * 2;
  var R = 236, sx = Math.cos(th) * R, sy = Math.sin(th) * R, sz = -R * 0.30;
  sunSprite.position.set(camera.position.x + sx, camera.position.y + sy, camera.position.z + sz);
  moonSprite.position.set(camera.position.x - sx, camera.position.y - sy, camera.position.z - sz);
  stars.position.copy(camera.position);
  stars.rotation.z = th * 0.35;

  var L = dayLight(S.timeOfDay);
  var clear = S.weather === 0 ? 1 : 0.25;
  starMat.opacity = Math.max(0, Math.min(1, 1.28 - L * 1.7)) * clear;
  sunMat.opacity = Math.max(0, Math.min(1, (sy / R) * 2.4 + 0.30)) * clear;
  moonMat.opacity = Math.max(0, Math.min(1, (-sy / R) * 2.4 + 0.20)) * clear;
  sunSprite.visible = sunMat.opacity > 0.01;
  moonSprite.visible = moonMat.opacity > 0.01;
  stars.visible = starMat.opacity > 0.01;
}

// ── 날씨 (0 맑음 · 1 비 · 2 눈)
export var WCOUNT = 1100;
export var wPos = new Float32Array(WCOUNT * 3);
export var wDraw = new Float32Array(WCOUNT * 3); // 하늘이 막힌 입자는 화면 밖으로 치운다
export var HIDE_Y = -900;
export var wGeo = new THREE.BufferGeometry();
wGeo.setAttribute("position", new THREE.BufferAttribute(wDraw, 3));
export var wMat = new THREE.PointsMaterial({
  color: 0xb9d4e6, size: 0.10, sizeAttenuation: true,
  transparent: true, opacity: 0.75, depthWrite: false
});
export var weatherPoints = new THREE.Points(wGeo, wMat);
weatherPoints.frustumCulled = false;
weatherPoints.visible = false;
scene.add(weatherPoints);

// 비는 점이 아니라 짧은 빗줄기로 그린다
export var rPos = new Float32Array(WCOUNT * 6);
export var rGeo = new THREE.BufferGeometry();
rGeo.setAttribute("position", new THREE.BufferAttribute(rPos, 3));
export var rainLines = new THREE.LineSegments(rGeo, new THREE.LineBasicMaterial({
  color: 0xaecde2, transparent: true, opacity: 0.55, depthWrite: false
}));
rainLines.frustumCulled = false;
rainLines.visible = false;
scene.add(rainLines);

// 그 열에서 가장 높은 블록의 y — 하늘이 뚫려 있는지 판단하는 데 쓴다
export function columnTop(fx, fz) {
  var gx = Math.floor(fx), gz = Math.floor(fz);
  if (gx < 0 || gx >= WX || gz < 0 || gz >= WZ) return -1;
  return topMap[gz * WX + gx];
}

export function seedWeather() {
  for (var i = 0; i < WCOUNT; i++) {
    wPos[i * 3] = player.pos.x + (Math.random() - 0.5) * 44;
    wPos[i * 3 + 1] = player.pos.y + Math.random() * 22 - 4;
    wPos[i * 3 + 2] = player.pos.z + (Math.random() - 0.5) * 44;
  }
  wGeo.attributes.position.needsUpdate = true;
}

export function setWeather(w) {
  if (w === S.weather) return;
  S.weather = w;
  if (S.weather === 0) {
    weatherPoints.visible = false;
    rainLines.visible = false;
    return;
  }
  wMat.color.setHex(0xf2f7fb);
  wMat.size = 0.15;
  wMat.opacity = 0.88;
  seedWeather();
  weatherPoints.visible = S.weather === 2;
  rainLines.visible = S.weather === 1;
}

export function localBiome() {
  var bx = Math.max(0, Math.min(WX - 1, Math.floor(player.pos.x)));
  var bz = Math.max(0, Math.min(WZ - 1, Math.floor(player.pos.z)));
  return biomeMap[bz * WX + bx];
}

export function updateWeather(dt) {
  S.weatherTimer -= dt;
  if (S.weatherTimer <= 0) {
    S.weatherTimer = 60 + Math.random() * 90;
    if (S.weather !== 0) setWeather(0);
    else if (Math.random() < 0.45) setWeather(localBiome() === 1 ? 2 : 1);
  }
  if (!S.weather) return;

  S.weatherPhase += dt;
  var fall = S.weather === 1 ? 24 : 3.4;
  var px = player.pos.x, py = player.pos.y, pz = player.pos.z;
  var rain = S.weather === 1;
  for (var i = 0; i < WCOUNT; i++) {
    var b0 = i * 3;
    wPos[b0 + 1] -= fall * dt;
    if (S.weather === 2) {
      wPos[b0] += Math.sin(S.weatherPhase * 0.8 + i) * 0.9 * dt;
      wPos[b0 + 2] += Math.cos(S.weatherPhase * 0.6 + i * 0.7) * 0.9 * dt;
    }
    var top = columnTop(wPos[b0], wPos[b0 + 2]);
    // 지붕·지면에 닿았거나 너무 멀어지면 다시 하늘에서 떨어뜨린다
    if (wPos[b0 + 1] < top + 1 || wPos[b0 + 1] < py - 7 ||
        Math.abs(wPos[b0] - px) > 23 || Math.abs(wPos[b0 + 2] - pz) > 23) {
      wPos[b0] = px + (Math.random() - 0.5) * 44;
      wPos[b0 + 1] = py + 11 + Math.random() * 11;
      wPos[b0 + 2] = pz + (Math.random() - 0.5) * 44;
      top = columnTop(wPos[b0], wPos[b0 + 2]);
    }
    // 하늘이 막힌 칸(집 안·동굴 안)에서는 그리지 않는다
    var open = wPos[b0 + 1] > top + 1;
    if (rain) {
      var b6 = i * 6;
      if (open) {
        rPos[b6] = wPos[b0]; rPos[b6 + 1] = wPos[b0 + 1]; rPos[b6 + 2] = wPos[b0 + 2];
        rPos[b6 + 3] = wPos[b0] + 0.03;
        rPos[b6 + 4] = wPos[b0 + 1] - 0.55;
        rPos[b6 + 5] = wPos[b0 + 2];
      } else {
        rPos[b6] = rPos[b6 + 3] = 0;
        rPos[b6 + 1] = rPos[b6 + 4] = HIDE_Y;
        rPos[b6 + 2] = rPos[b6 + 5] = 0;
      }
    } else {
      wDraw[b0] = open ? wPos[b0] : 0;
      wDraw[b0 + 1] = open ? wPos[b0 + 1] : HIDE_Y;
      wDraw[b0 + 2] = open ? wPos[b0 + 2] : 0;
    }
  }
  if (rain) rGeo.attributes.position.needsUpdate = true;
  else wGeo.attributes.position.needsUpdate = true;
}

// ── 반딧불이(밤) · 나비(낮)
export var CCOUNT = 54;
export var cPos = new Float32Array(CCOUNT * 3), cCol = new Float32Array(CCOUNT * 3);
export var cSeed = new Float32Array(CCOUNT * 3);
export var cGeo = new THREE.BufferGeometry();
cGeo.setAttribute("position", new THREE.BufferAttribute(cPos, 3));
cGeo.setAttribute("color", new THREE.BufferAttribute(cCol, 3));
export var cMat = new THREE.PointsMaterial({
  size: 0.20, vertexColors: true, sizeAttenuation: true,
  transparent: true, opacity: 0.95, depthWrite: false
});
export var creatures = new THREE.Points(cGeo, cMat);
creatures.frustumCulled = false;
scene.add(creatures);

export function seedCreatures() {
  for (var i = 0; i < CCOUNT; i++) {
    cSeed[i * 3] = Math.random() * 100;
    cSeed[i * 3 + 1] = 0.4 + Math.random() * 0.9;
    cSeed[i * 3 + 2] = Math.random() * 100;
    placeCreature(i);
  }
}
export function placeCreature(i) {
  var x = player.pos.x + (Math.random() - 0.5) * 30;
  var z = player.pos.z + (Math.random() - 0.5) * 30;
  var gx = Math.max(0, Math.min(WX - 1, Math.floor(x)));
  var gz = Math.max(0, Math.min(WZ - 1, Math.floor(z)));
  cPos[i * 3] = x;
  cPos[i * 3 + 1] = topMap[gz * WX + gx] + 1.4 + Math.random() * 2.4;
  cPos[i * 3 + 2] = z;
}

export function updateCreatures(dt) {
  var night = dayLight(S.timeOfDay) < 0.40;
  creatures.visible = S.weather === 0;
  if (!creatures.visible) return;
  S.creaturePhase += dt;

  for (var i = 0; i < CCOUNT; i++) {
    var sp = cSeed[i * 3 + 1];
    cPos[i * 3] += Math.sin(S.creaturePhase * sp + cSeed[i * 3]) * 0.9 * dt;
    cPos[i * 3 + 1] += Math.sin(S.creaturePhase * sp * 1.7 + cSeed[i * 3 + 2]) * 0.5 * dt;
    cPos[i * 3 + 2] += Math.cos(S.creaturePhase * sp * 0.8 + cSeed[i * 3 + 2]) * 0.9 * dt;

    if (Math.abs(cPos[i * 3] - player.pos.x) > 17 ||
        Math.abs(cPos[i * 3 + 2] - player.pos.z) > 17) placeCreature(i);

    if (night) {
      // 반딧불이 — 각자 다른 주기로 깜빡인다
      var blink = 0.35 + 0.65 * Math.max(0, Math.sin(S.creaturePhase * 2.4 + cSeed[i * 3] * 0.7));
      cCol[i * 3] = 1.0 * blink;
      cCol[i * 3 + 1] = 0.92 * blink;
      cCol[i * 3 + 2] = 0.42 * blink;
    } else {
      cCol[i * 3] = 0.98; cCol[i * 3 + 1] = 0.95; cCol[i * 3 + 2] = 0.74;
    }
  }
  cMat.size = night ? 0.20 : 0.13;
  cMat.opacity = night ? 0.95 : 0.55;
  cGeo.attributes.position.needsUpdate = true;
  cGeo.attributes.color.needsUpdate = true;
}
