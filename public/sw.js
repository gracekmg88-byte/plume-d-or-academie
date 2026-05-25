self.addEventListener("install", (event) => {
  event.waitUntil(self.skipWaiting());
});

self.addEventListener("activate", (event) => {
  event.waitUntil((async () => {
    await self.clients.claim();
    const cacheNames = await caches.keys();
    await Promise.all(cacheNames.map((cacheName) => caches.delete(cacheName)));

    const clients = await self.clients.matchAll({ type: "window", includeUncontrolled: true });
    await Promise.all(
      clients.map(async (client) => {
        try {
          const url = new URL(client.url);
          url.searchParams.set("sw-cleanup", Date.now().toString());
          await client.navigate(url.toString());
        } catch {
          return undefined;
        }
      }),
    );

    await self.registration.unregister();
  })());
});