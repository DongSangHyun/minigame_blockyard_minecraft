// cloud.js — 기기 사이 이어하기 (GitHub Gist 에 세계를 올리고 내려받는다)
// 서버도 라이브러리도 쓰지 않는다. api.github.com 이 CORS 를 열어 두어 브라우저가 직접 부른다.
import { S } from "./state.js";
import { curKey, importWorldText, saveGame } from "./save.js";

export var API = "https://api.github.com";
export var MARK = "blockyard-cloud-v1";        // 내 gist 를 알아보는 표시
export var INDEX_FILE = "index.json";
export var TOKEN_KEY = "blockyard.cloud.token";
export var GIST_KEY = "blockyard.cloud.gist";
export var NAME_KEY = "blockyard.cloud.world";
export var BASE_KEY = "blockyard.cloud.base";  // 이 기기가 마지막으로 본 판 번호
export var DEV_KEY = "blockyard.cloud.device";

function lsGet(k) { try { return localStorage.getItem(k); } catch (e) { return null; } }
function lsSet(k, v) { try { localStorage.setItem(k, v); return true; } catch (e) { return false; } }
function lsDel(k) { try { localStorage.removeItem(k); } catch (e) {} }

export function getToken() { return lsGet(TOKEN_KEY) || ""; }
export function setToken(t) {
  t = String(t || "").trim();
  if (t) lsSet(TOKEN_KEY, t); else lsDel(TOKEN_KEY);
  return t;
}
export function isLinked() { return !!getToken(); }

// 연결 해제 — 이 기기에서 토큰과 흔적을 지운다 (gist 는 그대로 남는다)
export function unlink() {
  lsDel(TOKEN_KEY); lsDel(GIST_KEY); lsDel(BASE_KEY);
}

// 세계 이름 — 진행을 나누는 이름표다. 잠금장치가 아니다.
export function normalizeName(n) {
  n = String(n == null ? "" : n).toLowerCase().replace(/[^a-z0-9_-]/g, "");
  return n.slice(0, 24) || "main";
}
export function worldName() { return normalizeName(lsGet(NAME_KEY) || "main"); }
export function setWorldName(n) { var v = normalizeName(n); lsSet(NAME_KEY, v); return v; }

// 기기 이름 — 어느 기기가 마지막으로 올렸는지 보여 주려고만 쓴다
export function deviceName() {
  var d = lsGet(DEV_KEY);
  if (d) return d;
  var ua = (navigator.userAgent || "");
  var kind = /iPhone|iPad/.test(ua) ? "아이폰" : /Android/.test(ua) ? "안드로이드"
           : /Macintosh/.test(ua) ? "맥" : /Windows/.test(ua) ? "윈도우" : "기기";
  d = kind + "-" + Math.random().toString(36).slice(2, 5);
  lsSet(DEV_KEY, d);
  return d;
}

// 이 기기가 마지막으로 본 판 번호 — 이게 있어야 "남이 먼저 올렸다" 를 알아챈다
export function baseRev(name) {
  try { return (JSON.parse(lsGet(BASE_KEY) || "{}") || {})[name] || 0; } catch (e) { return 0; }
}
export function setBaseRev(name, rev) {
  var m = {};
  try { m = JSON.parse(lsGet(BASE_KEY) || "{}") || {}; } catch (e) { m = {}; }
  m[name] = rev;
  lsSet(BASE_KEY, JSON.stringify(m));
}

// ── 통신 ────────────────────────────────────────────────
// 테스트는 S.netFetch 를 갈아 끼워 진짜 GitHub 을 부르지 않는다
function netFetch(url, init) {
  var f = S.netFetch || (typeof fetch === "function" ? fetch : null);
  if (!f) return Promise.reject(new Error("이 브라우저는 네트워크 호출을 지원하지 않습니다"));
  return f(url, init);
}

export function httpMessage(status) {
  if (status === 401) return "토큰이 올바르지 않습니다 (gist 권한을 확인하세요)";
  if (status === 403 || status === 429) return "요청이 너무 잦습니다 — 잠시 뒤 다시 시도하세요";
  if (status === 404) return "저장소를 찾지 못했습니다";
  if (status === 422) return "GitHub 이 내용을 받아들이지 않았습니다";
  return "GitHub 응답 오류 (" + status + ")";
}

export function req(method, path, body) {
  var token = getToken();
  if (!token) return Promise.reject(new Error("먼저 토큰을 연결하세요"));
  var init = {
    method: method,
    headers: {
      "Authorization": "Bearer " + token,
      "Accept": "application/vnd.github+json",
      "Content-Type": "application/json"
    }
  };
  if (body) init.body = JSON.stringify(body);
  return netFetch(API + path, init).then(function (res) {
    if (!res.ok) throw new Error(httpMessage(res.status));
    if (res.status === 204) return null;
    return res.json();
  });
}

// 토큰이 살아 있는지 확인하고 계정 이름을 돌려준다
export function checkToken() {
  return req("GET", "/user").then(function (u) { return (u && u.login) || "?"; });
}

// ── gist 찾기 · 만들기 ───────────────────────────────────
function emptyIndex() { return { v: 1, worlds: {} }; }

export function findGist() {
  var id = lsGet(GIST_KEY);
  if (id) {
    return req("GET", "/gists/" + id).then(function (g) { return g; })
      .catch(function () { lsDel(GIST_KEY); return searchGist(); });
  }
  return searchGist();
}
function searchGist() {
  return req("GET", "/gists?per_page=100").then(function (list) {
    if (!Array.isArray(list)) return null;
    for (var i = 0; i < list.length; i++) {
      if (list[i] && list[i].description === MARK) {
        lsSet(GIST_KEY, list[i].id);
        return req("GET", "/gists/" + list[i].id);
      }
    }
    return null;
  });
}
export function ensureGist() {
  return findGist().then(function (g) {
    if (g) return g;
    var files = {};
    files[INDEX_FILE] = { content: JSON.stringify(emptyIndex(), null, 1) };
    return req("POST", "/gists", { description: MARK, public: false, files: files })
      .then(function (ng) { if (ng && ng.id) lsSet(GIST_KEY, ng.id); return ng; });
  });
}

// gist 안의 파일 내용 — 1MB 를 넘으면 잘려 오므로 raw 주소로 다시 받는다
export function fileContent(gist, name) {
  var f = gist && gist.files && gist.files[name];
  if (!f) return Promise.resolve(null);
  if (!f.truncated) return Promise.resolve(f.content);
  return netFetch(f.raw_url, {}).then(function (r) { return r.text(); });
}
export function readIndex(gist) {
  return fileContent(gist, INDEX_FILE).then(function (txt) {
    if (!txt) return emptyIndex();
    try {
      var d = JSON.parse(txt);
      if (!d || typeof d !== "object" || !d.worlds) return emptyIndex();
      return d;
    } catch (e) { return emptyIndex(); }
  });
}

// ── 올리기 · 내려받기 ────────────────────────────────────
// 세계 목록 — 이름 · 판 번호 · 마지막으로 올린 기기와 시각
export function listWorlds() {
  if (!getToken()) return Promise.reject(new Error("먼저 토큰을 연결하세요"));
  return ensureGist().then(readIndex).then(function (ix) {
    var out = [];
    for (var k in ix.worlds) {
      if (!Object.prototype.hasOwnProperty.call(ix.worlds, k)) continue;
      var w = ix.worlds[k];
      out.push({ name: k, rev: w.rev || 0, at: w.at || "", device: w.device || "",
                 seed: w.seed || 0, mins: w.mins || 0, mine: baseRev(k) });
    }
    out.sort(function (a, b) { return String(a.at) < String(b.at) ? 1 : -1; });
    return out;
  });
}

// force 가 아니면, 다른 기기가 먼저 올린 판을 덮지 않고 알려 준다
export function pushWorld(force) {
  if (!getToken()) return Promise.reject(new Error("먼저 토큰을 연결하세요"));
  var name = worldName();
  saveGame();                        // 올리기 전에 반드시 지금 세계를 저장한다 —
                                     // 안 그러면 슬롯에 남아 있던 예전 세계가 올라간다
  var raw = lsGet(curKey());
  if (!raw) return Promise.reject(new Error("올릴 세계가 없습니다"));
  var meta = {};
  try {
    var d = JSON.parse(raw);
    meta = { seed: d.seed >>> 0, mins: Math.round((d.secs || 0) / 60) };
  } catch (e) { meta = { seed: 0, mins: 0 }; }

  return ensureGist().then(function (g) {
    return readIndex(g).then(function (ix) {
      var cur = ix.worlds[name];
      var remote = cur ? (cur.rev || 0) : 0;
      if (!force && remote > baseRev(name)) {
        return { conflict: true, name: name, rev: remote,
                 at: cur.at || "", device: cur.device || "" };
      }
      var rev = remote + 1;
      ix.worlds[name] = { rev: rev, at: new Date().toISOString(),
                          device: deviceName(), seed: meta.seed, mins: meta.mins };
      var files = {};
      files[name + ".json"] = { content: raw };
      files[INDEX_FILE] = { content: JSON.stringify(ix, null, 1) };
      return req("PATCH", "/gists/" + g.id, { files: files }).then(function () {
        setBaseRev(name, rev);
        return { conflict: false, name: name, rev: rev, bytes: raw.length };
      });
    });
  });
}

// 내려받기 — 형식을 확인한 뒤에만 지금 슬롯을 덮는다 (importWorldText 가 백업을 남긴다)
export function pullWorld(which) {
  if (!getToken()) return Promise.reject(new Error("먼저 토큰을 연결하세요"));
  var name = normalizeName(which || worldName());
  return ensureGist().then(function (g) {
    return readIndex(g).then(function (ix) {
      var cur = ix.worlds[name];
      if (!cur) throw new Error("클라우드에 '" + name + "' 세계가 없습니다");
      return fileContent(g, name + ".json").then(function (txt) {
        if (!txt) throw new Error("세계 파일을 읽지 못했습니다");
        var err = importWorldText(txt);
        if (err) throw new Error(err);
        setBaseRev(name, cur.rev || 0);
        setWorldName(name);
        return { name: name, rev: cur.rev || 0, device: cur.device || "", at: cur.at || "" };
      });
    });
  });
}
