/**
 * Client-side cache for fetched PDF binaries using the Cache Storage API.
 * Lets the PDF viewer reload documents instantly across navigations and reloads.
 */
const CACHE_NAME = "pdf-binary-cache-v1";
const MAX_BYTES = 80 * 1024 * 1024; // ~80MB cap to stay polite on mobile

async function openCache(): Promise<Cache | null> {
  if (typeof caches === "undefined") return null;
  try {
    return await caches.open(CACHE_NAME);
  } catch {
    return null;
  }
}

/** Returns a Response object for the PDF, served from cache when possible. */
export async function getCachedPdfBlobUrl(url: string): Promise<string> {
  const cache = await openCache();
  if (!cache) return url;

  try {
    const cached = await cache.match(url);
    if (cached) {
      const blob = await cached.blob();
      return URL.createObjectURL(blob);
    }

    // Fetch + store
    const res = await fetch(url, { credentials: "omit" });
    if (!res.ok) return url;
    const clone = res.clone();
    // Best-effort eviction before storing
    await ensureCapacity(cache, MAX_BYTES);
    try { await cache.put(url, clone); } catch { /* quota: ignore */ }
    const blob = await res.blob();
    return URL.createObjectURL(blob);
  } catch {
    return url;
  }
}

/**
 * PDF déjà gardé sur l'appareil : renvoie son contenu (lecture locale, quasi instantanée),
 * sinon null. Ne télécharge rien.
 */
export async function readCachedPdf(url: string): Promise<Uint8Array | null> {
  const cache = await openCache();
  if (!cache) return null;
  try {
    const cached = await cache.match(url);
    if (!cached) return null;
    return new Uint8Array(await cached.arrayBuffer());
  } catch {
    return null;
  }
}

/**
 * Garde une copie du PDF sur l'appareil pour les prochaines ouvertures. À lancer une fois la
 * première page affichée, pour ne pas ralentir son téléchargement.
 */
export async function storePdfInCache(url: string): Promise<void> {
  const cache = await openCache();
  if (!cache) return;
  try {
    if (await cache.match(url)) return;
    const res = await fetch(url, { credentials: "omit" });
    if (!res.ok) return;
    await ensureCapacity(cache, MAX_BYTES);
    await cache.put(url, res);
  } catch {
    /* quota ou réseau : sans gravité */
  }
}

async function ensureCapacity(cache: Cache, limit: number) {
  try {
    const keys = await cache.keys();
    let total = 0;
    const sizes: { req: Request; size: number }[] = [];
    for (const req of keys) {
      const r = await cache.match(req);
      if (!r) continue;
      const size = Number(r.headers.get("content-length") || 0);
      sizes.push({ req, size });
      total += size;
    }
    // Evict oldest entries until we're under limit
    while (total > limit && sizes.length) {
      const evict = sizes.shift()!;
      await cache.delete(evict.req);
      total -= evict.size;
    }
  } catch {
    /* ignore */
  }
}
