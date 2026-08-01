// =============================================
// けもケット PWA Service Worker（自動更新版）
// index.htmlを更新するだけでOK！
// このファイルの編集は不要です
// =============================================

// インストール即有効化
self.addEventListener('install', event => {
  self.skipWaiting();
});

const CACHE_NAME = 'kemoket-v2';

self.addEventListener('activate', event => {
  event.waitUntil(
    caches.keys().then(names =>
      Promise.all(names.filter(n => n !== CACHE_NAME).map(n => caches.delete(n)))
    ).then(() => self.clients.claim())
  );
});

self.addEventListener('fetch', event => {
  // API呼び出し（AI機能）はネットワークのみ
  if (event.request.url.includes('api.anthropic.com')) {
    event.respondWith(
      fetch(event.request).catch(() => {
        return new Response(JSON.stringify({ error: { message: 'オフラインです' } }), {
          headers: { 'Content-Type': 'application/json' }
        });
      })
    );
    return;
  }

  // ネットワーク優先 → 成功したらキャッシュ更新 → オフラインならキャッシュ
  // cache:'no-store' でブラウザのHTTPキャッシュも経由させず、常に最新を取りに行く
  event.respondWith(
    fetch(event.request, { cache: 'no-store' }).then(response => {
      if (response.ok) {
        const clone = response.clone();
        caches.open(CACHE_NAME).then(cache => cache.put(event.request, clone));
      }
      return response;
    }).catch(() => {
      return caches.match(event.request).then(cached => {
        return cached || new Response('オフラインです', { status: 503 });
      });
    })
  );
});
