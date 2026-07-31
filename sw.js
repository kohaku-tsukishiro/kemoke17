// =============================================
// けもケット PWA Service Worker（自動更新版）
// index.htmlを更新するだけでOK！
// このファイルの編集は不要です
// =============================================

// インストール即有効化
self.addEventListener('install', event => {
  self.skipWaiting();
});

self.addEventListener('activate', event => {
  event.waitUntil(self.clients.claim());
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
  event.respondWith(
    fetch(event.request).then(response => {
      if (response.ok) {
        const clone = response.clone();
        caches.open('kemoket').then(cache => cache.put(event.request, clone));
      }
      return response;
    }).catch(() => {
      return caches.match(event.request).then(cached => {
        return cached || new Response('オフラインです', { status: 503 });
      });
    })
  );
});
