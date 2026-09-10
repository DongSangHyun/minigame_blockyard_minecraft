// sw.js — 오프라인 플레이. 게임은 정적 파일뿐이라 캐시만으로 완전히 돈다.
// 원칙: 우리 파일은 "네트워크 먼저"(항상 최신을 먼저 시도하고 실패하면 캐시),
//       CDN 은 "캐시 먼저"(버전이 박혀 있어 바뀌지 않는다).
// 이렇게 해야 새로 배포한 버전이 캐시에 갇히지 않는다.
// 배포할 때마다 바뀐다 — tools/stamp.mjs 가 이 줄을 다시 쓴다.
// 고정값이면 activate 의 옛 캐시 청소가 **한 번도 안 돈다**.
var VERSION = "blockyard-20260910T1502";
var SHELL = [
  "./", "./index.html", "./manifest.webmanifest",
  "./icon-192.png", "./icon-512.png",
  "./src/main.js"
];

self.addEventListener("install", function (e) {
  self.skipWaiting();
  // cache:"reload" — 껍데기를 담을 때 **브라우저 HTTP 캐시를 건너뛴다.**
  // 안 그러면 깨진 판이 캐시에 있을 때 그것을 그대로 다시 담는다.
  e.waitUntil(caches.open(VERSION).then(function (c) {
    return Promise.all(SHELL.map(function (u) {
      return fetch(new Request(u, { cache: "reload" }))
        .then(function (r) { return r.ok ? c.put(u, r) : null; })
        .catch(function () {});
    }));
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
    // 네트워크 먼저 — 배포한 새 버전이 바로 반영된다.
    // cache:"no-cache" 를 붙여야 **브라우저 HTTP 캐시까지 건너뛰고** 서버에 물어본다.
    // 이게 없으면 "네트워크 먼저" 라도 HTTP 캐시의 옛 파일이 돌아온다 —
    // 잠깐 깨진 판을 올렸다 내리면, 그 사이에 연 사람은 캐시가 만료될 때까지 계속 깨진 것을 본다.
    e.respondWith(
      fetch(new Request(req, { cache: "no-cache" })).then(function (res) {
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
