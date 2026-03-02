import { Capacitor } from "@capacitor/core";
import { Filesystem, Directory } from "@capacitor/filesystem";
import { Preferences } from "@capacitor/preferences";

const CACHE_DIR = "cached-covers";
const CACHE_INDEX_KEY = "image_cache_index";

// In-memory fast lookup (survives only the session)
const memoryCache = new Map<string, string>();

// Whether we're running on a native platform
const isNative = Capacitor.isNativePlatform();

/**
 * Generate a safe filename from a URL
 */
function urlToFilename(url: string): string {
  // Use a simple hash to avoid filesystem-unsafe characters
  let hash = 0;
  for (let i = 0; i < url.length; i++) {
    const char = url.charCodeAt(i);
    hash = ((hash << 5) - hash + char) | 0;
  }
  const ext = url.includes(".webp") ? ".webp" : url.includes(".png") ? ".png" : ".jpg";
  return `img_${Math.abs(hash).toString(36)}${ext}`;
}

/**
 * Load the cache index from Preferences
 */
async function loadIndex(): Promise<Record<string, string>> {
  try {
    const { value } = await Preferences.get({ key: CACHE_INDEX_KEY });
    return value ? JSON.parse(value) : {};
  } catch {
    return {};
  }
}

/**
 * Save the cache index to Preferences
 */
async function saveIndex(index: Record<string, string>): Promise<void> {
  await Preferences.set({ key: CACHE_INDEX_KEY, value: JSON.stringify(index) });
}

/**
 * Ensure the cache directory exists (no-op if it does)
 */
let dirCreated = false;
async function ensureDir(): Promise<void> {
  if (dirCreated) return;
  try {
    await Filesystem.mkdir({ path: CACHE_DIR, directory: Directory.Cache, recursive: true });
  } catch {
    // already exists
  }
  dirCreated = true;
}

/**
 * Get a cached local URI for a remote image URL.
 * Returns the local URI if cached, or null.
 */
export async function getCachedUri(remoteUrl: string): Promise<string | null> {
  if (!isNative) return null;

  // Fast path: memory cache
  if (memoryCache.has(remoteUrl)) {
    return memoryCache.get(remoteUrl)!;
  }

  try {
    const index = await loadIndex();
    const filename = index[remoteUrl];
    if (!filename) return null;

    const result = await Filesystem.getUri({
      path: `${CACHE_DIR}/${filename}`,
      directory: Directory.Cache,
    });

    // Store in memory for instant subsequent access
    const uri = Capacitor.convertFileSrc(result.uri);
    memoryCache.set(remoteUrl, uri);
    return uri;
  } catch {
    return null;
  }
}

/**
 * Download a remote image and cache it locally.
 * Returns the local URI.
 */
export async function cacheImage(remoteUrl: string): Promise<string | null> {
  if (!isNative) return null;

  // Already cached?
  const existing = await getCachedUri(remoteUrl);
  if (existing) return existing;

  try {
    await ensureDir();
    const filename = urlToFilename(remoteUrl);

    // Fetch the image as a blob, then write as base64
    const response = await fetch(remoteUrl);
    if (!response.ok) return null;
    const blob = await response.blob();

    const base64 = await new Promise<string>((resolve, reject) => {
      const reader = new FileReader();
      reader.onloadend = () => {
        const result = reader.result as string;
        resolve(result.split(",")[1]); // strip data:... prefix
      };
      reader.onerror = reject;
      reader.readAsDataURL(blob);
    });

    await Filesystem.writeFile({
      path: `${CACHE_DIR}/${filename}`,
      data: base64,
      directory: Directory.Cache,
    });

    // Update index
    const index = await loadIndex();
    index[remoteUrl] = filename;
    await saveIndex(index);

    // Get local URI
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
  }
}

/**
 * Preload and cache multiple images (fire-and-forget).
 */
export function preloadAndCacheImages(urls: string[]): void {
  if (!isNative) return;
  urls.forEach((url) => {
    if (url) cacheImage(url).catch(() => {});
  });
}
