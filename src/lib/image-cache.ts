import { Capacitor } from "@capacitor/core";
import { Filesystem, Directory } from "@capacitor/filesystem";
import { Preferences } from "@capacitor/preferences";

const CACHE_DIR = "cached-covers";
const CACHE_INDEX_KEY = "image_cache_index";

// In-memory fast lookup (survives only the session)
const memoryCache = new Map<string, string>();

// Persistent index loaded once at startup
let indexCache: Record<string, string> | null = null;
let indexLoadPromise: Promise<Record<string, string>> | null = null;

// Dedup in-flight downloads
const inflightDownloads = new Map<string, Promise<string | null>>();

const isNative = Capacitor.isNativePlatform();

function urlToFilename(url: string): string {
  let hash = 0;
  for (let i = 0; i < url.length; i++) {
    const char = url.charCodeAt(i);
    hash = ((hash << 5) - hash + char) | 0;
  }
  const ext = url.includes(".webp") ? ".webp" : url.includes(".png") ? ".png" : ".jpg";
  return `img_${Math.abs(hash).toString(36)}${ext}`;
}

/**
 * Load index once, then keep in memory
 */
async function getIndex(): Promise<Record<string, string>> {
  if (indexCache) return indexCache;
  if (indexLoadPromise) return indexLoadPromise;
  indexLoadPromise = (async () => {
    try {
      const { value } = await Preferences.get({ key: CACHE_INDEX_KEY });
      indexCache = value ? JSON.parse(value) : {};
    } catch {
      indexCache = {};
    }
    return indexCache!;
  })();
  return indexLoadPromise;
}

async function saveIndex(): Promise<void> {
  if (indexCache) {
    await Preferences.set({ key: CACHE_INDEX_KEY, value: JSON.stringify(indexCache) });
  }
}

let dirCreated = false;
async function ensureDir(): Promise<void> {
  if (dirCreated) return;
  try {
    await Filesystem.mkdir({ path: CACHE_DIR, directory: Directory.Cache, recursive: true });
  } catch { /* already exists */ }
  dirCreated = true;
}

/**
 * Warm up cache index at app startup for instant lookups
 */
export async function warmUpCache(): Promise<void> {
  if (!isNative) return;
  const index = await getIndex();
  // Resolve all cached URIs into memory for instant access
  const entries = Object.entries(index);
  await Promise.all(
    entries.map(async ([remoteUrl, filename]) => {
      if (memoryCache.has(remoteUrl)) return;
      try {
        const result = await Filesystem.getUri({
          path: `${CACHE_DIR}/${filename}`,
          directory: Directory.Cache,
        });
        memoryCache.set(remoteUrl, Capacitor.convertFileSrc(result.uri));
      } catch {
        // File was deleted, clean up index
        delete index[remoteUrl];
      }
    })
  );
  await saveIndex();
}

/**
 * Get a cached local URI for a remote image URL.
 */
export async function getCachedUri(remoteUrl: string): Promise<string | null> {
  if (!isNative) return null;

  // Fast path: memory cache
  if (memoryCache.has(remoteUrl)) {
    return memoryCache.get(remoteUrl)!;
  }

  try {
    const index = await getIndex();
    const filename = index[remoteUrl];
    if (!filename) return null;

    const result = await Filesystem.getUri({
      path: `${CACHE_DIR}/${filename}`,
      directory: Directory.Cache,
    });

    const uri = Capacitor.convertFileSrc(result.uri);
    memoryCache.set(remoteUrl, uri);
    return uri;
  } catch {
    return null;
  }
}

/**
 * Download and cache with deduplication
 */
export async function cacheImage(remoteUrl: string): Promise<string | null> {
  if (!isNative) return null;

  // Already in memory
  if (memoryCache.has(remoteUrl)) return memoryCache.get(remoteUrl)!;

  // Already downloading
  if (inflightDownloads.has(remoteUrl)) return inflightDownloads.get(remoteUrl)!;

  const downloadPromise = (async (): Promise<string | null> => {
    // Check disk cache
    const existing = await getCachedUri(remoteUrl);
    if (existing) return existing;

    try {
      await ensureDir();
      const filename = urlToFilename(remoteUrl);

      const response = await fetch(remoteUrl);
      if (!response.ok) return null;
      const blob = await response.blob();

      const base64 = await new Promise<string>((resolve, reject) => {
        const reader = new FileReader();
        reader.onloadend = () => {
          const result = reader.result as string;
          resolve(result.split(",")[1]);
        };
        reader.onerror = reject;
        reader.readAsDataURL(blob);
      });

      await Filesystem.writeFile({
        path: `${CACHE_DIR}/${filename}`,
        data: base64,
        directory: Directory.Cache,
      });

      const index = await getIndex();
      index[remoteUrl] = filename;
      await saveIndex();

      const result = await Filesystem.getUri({
        path: `${CACHE_DIR}/${filename}`,
        directory: Directory.Cache,
      });

      const uri = Capacitor.convertFileSrc(result.uri);
      memoryCache.set(remoteUrl, uri);
      return uri;
    } catch (e) {
      console.warn("Image cache write failed:", e);
      return null;
    } finally {
      inflightDownloads.delete(remoteUrl);
    }
  })();

  inflightDownloads.set(remoteUrl, downloadPromise);
  return downloadPromise;
}

/**
 * Preload and cache multiple images concurrently
 */
export function preloadAndCacheImages(urls: string[]): void {
  if (!isNative) return;
  // Process up to 4 at a time for speed
  const batch = urls.filter((url) => url && !memoryCache.has(url));
  batch.forEach((url) => cacheImage(url).catch(() => {}));
}
