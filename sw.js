// =============================================
// けもケット PWA Service Worker（自動更新＋オフライン対応版）
// index.htmlを更新するだけでOK！（ネットワーク優先で取得し、成功したらキャッシュを更新）
// スコープ: このファイルが置かれたディレクトリ配下のみ
//   GitHub Pages のサブパス（例: /kemoke17/）でも動くよう、URLはすべてこのファイル基準の相対指定にする
// =============================================

const CACHE_NAME = 'kemoket-v3';
const BASE = new URL('./', self.location.href);           // 例: https://xxx.github.io/kemoke17/
const INDEX_URL = new URL('./index.html', BASE).href;
// インストール時に必ずキャッシュしておくもの（アプリの画像・アイコン・フォントはすべて index.html に内蔵）
const PRECACHE_URLS = [BASE.href, INDEX_URL, new URL('./manifest.json', BASE).href];
// 会場の通信混雑対策：この時間内にネットワークが応答しなければキャッシュを先に返す
// （ネットワーク側の取得は裏で続け、成功すればキャッシュを更新して次回に反映）
const NETWORK_TIMEOUT_MS = 5000;

self.addEventListener('install', event => {
  event.waitUntil(
    caches.open(CACHE_NAME).then(cache =>
      Promise.all(PRECACHE_URLS.map(url =>
        fetch(url, { cache: 'reload' })
          .then(res => { if (res && res.ok) return cache.put(url, res); })
          .catch(() => {})   // 1件失敗しても他はキャッシュする（通常はページ表示直後なので取得できる）
      ))
    ).then(() => self.skipWaiting())
  );
});

self.addEventListener('activate', event => {
  event.waitUntil(
    caches.keys().then(names =>
      Promise.all(names.filter(n => n !== CACHE_NAME).map(n => caches.delete(n)))
    ).then(() => self.clients.claim())
  );
});

self.addEventListener('fetch', event => {
  const req = event.request;
  if (req.method !== 'GET') return;
  let url;
  try { url = new URL(req.url); } catch (e) { return; }
  if (url.origin !== self.location.origin) return;   // 外部サイト（X・pixiv等のリンク先）はSWで扱わない
  const isNav = req.mode === 'navigate' || req.destination === 'document';
  event.respondWith(networkFirst(req, isNav));
});

async function networkFirst(req, isNav) {
  const cache = await caches.open(CACHE_NAME);
  // cache:'no-store' でブラウザのHTTPキャッシュを経由させず、常に最新を取りに行く
  const networkPromise = fetch(req, { cache: 'no-store' }).then(res => {
    if (res && res.ok) cache.put(req, res.clone()).catch(() => {});
    return res;
  });
  networkPromise.catch(() => {});   // 未処理のrejectionにしない（下で個別に扱う）

  let res = null;
  try {
    res = await Promise.race([
      networkPromise,
      new Promise(resolve => setTimeout(() => resolve(null), NETWORK_TIMEOUT_MS)),
    ]);
  } catch (e) {
    res = null;   // オフライン等でネットワーク失敗
  }
  if (res) return res;

  const cached = await matchCache(cache, req, isNav);
  if (cached) return cached;

  // キャッシュが無い（初回オフライン等）ときだけ、時間がかかってもネットワークを待つ
  try {
    return await networkPromise;
  } catch (e) {
    return new Response(
      'オフラインです。一度オンラインの状態でアプリを開いておくと、次回からオフラインでも利用できます。',
      { status: 503, headers: { 'Content-Type': 'text/plain; charset=utf-8' } }
    );
  }
}

async function matchCache(cache, req, isNav) {
  let hit = await cache.match(req, { ignoreSearch: true });
  if (hit) return hit;
  if (isNav) {
    // ページ本体は index.html / ルートのどちらのURLで開かれてもキャッシュから返す
    hit = await cache.match(INDEX_URL) || await cache.match(BASE.href);
  }
  return hit || null;
}
