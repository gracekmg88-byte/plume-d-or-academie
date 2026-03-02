/**
 * Offline storage for publications: metadata + PDF files.
 * Uses Capacitor Filesystem + Preferences on native, localStorage on web.
 */
import { Capacitor } from "@capacitor/core";
import { Filesystem, Directory } from "@capacitor/filesystem";
import { Preferences } from "@capacitor/preferences";

const OFFLINE_PUBS_KEY = "offline_publications";
const OFFLINE_PDF_DIR = "offline-pdfs";

const isNative = Capacitor.isNativePlatform();

export interface OfflinePublication {
  id: string;
  title: string;
  author: string;
  description: string | null;
  category: string;
  cover_image_url: string | null;
  file_url: string | null;
  views_count: number;
  created_at: string;
  updated_at: string;
  is_published: boolean;
  // Local PDF path (native only)
  local_pdf_uri?: string;
  cached_at: number;
}

// In-memory cache
let pubsCache: Record<string, OfflinePublication> | null = null;

async function loadPubs(): Promise<Record<string, OfflinePublication>> {
  if (pubsCache) return pubsCache;
  try {
    if (isNative) {
      const { value } = await Preferences.get({ key: OFFLINE_PUBS_KEY });
      pubsCache = value ? JSON.parse(value) : {};
    } else {
      const value = localStorage.getItem(OFFLINE_PUBS_KEY);
      pubsCache = value ? JSON.parse(value) : {};
    }
  } catch {
    pubsCache = {};
  }
  return pubsCache!;
}

async function savePubs(): Promise<void> {
  if (!pubsCache) return;
  const json = JSON.stringify(pubsCache);
  if (isNative) {
    await Preferences.set({ key: OFFLINE_PUBS_KEY, value: json });
  } else {
    localStorage.setItem(OFFLINE_PUBS_KEY, json);
  }
}

let pdfDirCreated = false;
async function ensurePdfDir(): Promise<void> {
  if (pdfDirCreated || !isNative) return;
  try {
    await Filesystem.mkdir({ path: OFFLINE_PDF_DIR, directory: Directory.Data, recursive: true });
  } catch { /* exists */ }
  pdfDirCreated = true;
}

/**
 * Save a publication for offline reading.
 * Also downloads the PDF if available (native only).
 */
export async function savePublicationOffline(pub: {
  id: string;
  title: string;
  author: string;
  description: string | null;
  category: string;
  cover_image_url: string | null;
  file_url: string | null;
  views_count: number;
  created_at: string;
  updated_at: string;
  is_published: boolean;
}): Promise<void> {
  const pubs = await loadPubs();

  const offlinePub: OfflinePublication = {
    ...pub,
    cached_at: Date.now(),
  };

  // Download PDF on native
  if (isNative && pub.file_url) {
    try {
      await ensurePdfDir();
      const filename = `pdf_${pub.id}.pdf`;

      const response = await fetch(pub.file_url);
      if (response.ok) {
        const blob = await response.blob();
        const base64 = await new Promise<string>((resolve, reject) => {
          const reader = new FileReader();
          reader.onloadend = () => resolve((reader.result as string).split(",")[1]);
          reader.onerror = reject;
          reader.readAsDataURL(blob);
        });

        await Filesystem.writeFile({
          path: `${OFFLINE_PDF_DIR}/${filename}`,
          data: base64,
          directory: Directory.Data,
        });

        const result = await Filesystem.getUri({
          path: `${OFFLINE_PDF_DIR}/${filename}`,
          directory: Directory.Data,
        });

        offlinePub.local_pdf_uri = Capacitor.convertFileSrc(result.uri);
      }
    } catch (e) {
      console.warn("Failed to cache PDF offline:", e);
    }
  }

  pubs[pub.id] = offlinePub;
  await savePubs();
}

/**
 * Get a single cached publication
 */
export async function getOfflinePublication(id: string): Promise<OfflinePublication | null> {
  const pubs = await loadPubs();
  return pubs[id] || null;
}

/**
 * Get all cached publications
 */
export async function getAllOfflinePublications(): Promise<OfflinePublication[]> {
  const pubs = await loadPubs();
  return Object.values(pubs).sort((a, b) => b.cached_at - a.cached_at);
}

/**
 * Check if a publication is cached
 */
export async function isPublicationCached(id: string): Promise<boolean> {
  const pubs = await loadPubs();
  return !!pubs[id];
}

/**
 * Remove a publication from offline cache
 */
export async function removeOfflinePublication(id: string): Promise<void> {
  const pubs = await loadPubs();
  if (pubs[id]) {
    // Delete PDF file if exists
    if (isNative) {
      try {
        await Filesystem.deleteFile({
          path: `${OFFLINE_PDF_DIR}/pdf_${id}.pdf`,
          directory: Directory.Data,
        });
      } catch { /* file may not exist */ }
    }
    delete pubs[id];
    await savePubs();
  }
}
