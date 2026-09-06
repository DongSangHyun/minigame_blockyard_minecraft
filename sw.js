// sw.js — 오프라인 플레이. 게임은 정적 파일뿐이라 캐시만으로 완전히 돈다.
// 원칙: 우리 파일은 "네트워크 먼저"(항상 최신을 먼저 시도하고 실패하면 캐시),
//       CDN 은 "캐시 먼저"(버전이 박혀 있어 바뀌지 않는다).
// 이렇게 해야 새로 배포한 버전이 캐시에 갇히지 않는다.
var VERSION = "blockyard-v1";
var SHELL = [
  "./", "./index.html", "./manifest.webmanifest",
  "./icon-192.png", "./icon-512.png",
  "./src/main.js"
];

self.addEventListener("install", function (e) {
  self.skipWaiting();
  e.waitUntil(caches.open(VERSION).then(function (c) {
    return c.addAll(SHELL).catch(function () {});
  }));
});

self.addEventListener("activate", function (e) {
  e.waitUntil(caches.keys().then(function (keys) {
    return Promise.all(keys.map(function (k) {
      return k === VERSION ? null : caches.delete(k);
    }));
  }).then(function () { return self.clients.claim(); }));
});

self.addEventListener("fetch", function (e) {
  var req = e.request;
  if (req.method !== "GET") return;
  var url = new URL(req.url);
  var sameOrigin = url.origin === self.location.origin;

  if (sameOrigin) {
    // 네트워크 먼저 — 배포한 새 버전이 바로 반영된다
    e.respondWith(
      fetch(req).then(function (res) {
        var copy = res.clone();
        caches.open(VERSION).then(function (c) { c.put(req, copy); });
        return res;
      }).catch(function () {
        return caches.match(req).then(function (hit) {
          return hit || caches.match("./index.html");
        });
      })
    );
    return;
  }

  // CDN(three.js·폰트) — 캐시 먼저, 없으면 받아서 담아 둔다
  e.respondWith(
    caches.match(req).then(function (hit) {
      if (hit) return hit;
      return fetch(req).then(function (res) {
        var copy = res.clone();
        caches.open(VERSION).then(function (c) { c.put(req, copy); });
        return res;
      }).catch(function () { return hit; });
    })
  );
});
