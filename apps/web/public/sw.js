// Kill-switch service worker.
// A previous build registered a service worker that is still active in some
// browsers and serves stale, cached JS chunks (causing "phantom" runtime
// errors from code that no longer exists on disk). This replacement worker
// unregisters itself, clears every cache, and reloads any controlled tabs so
// the browser fetches fresh assets from the dev/prod server.
self.addEventListener('install', () => {
  self.skipWaiting()
})

self.addEventListener('activate', (event) => {
  event.waitUntil(
    (async () => {
      try {
        const keys = await caches.keys()
        await Promise.all(keys.map((key) => caches.delete(key)))
      } catch {
        // ignore cache errors
      }
      await self.registration.unregister()
      const clients = await self.clients.matchAll({ type: 'window' })
      for (const client of clients) {
        client.navigate(client.url)
      }
    })(),
  )
})
