import { pdfjs } from "react-pdf";

/**
 * Lecture d'un PDF « par morceaux » depuis le stockage Supabase.
 *
 * Le stockage accepte les demandes partielles (Range), mais ne laisse pas le navigateur lire
 * l'en-tête « Accept-Ranges » depuis une autre adresse que la sienne. pdf.js en conclut à tort que
 * la lecture par morceaux est impossible et télécharge le fichier entier avant d'afficher la
 * première page (44,7 Mo pour « Méthodes et pratiques de la langue française »).
 *
 * Ici, on demande nous-mêmes la taille du fichier (Content-Length, lisible) puis on fournit à pdf.js
 * un transport qui ne télécharge que les morceaux nécessaires à la page affichée.
 */

type RangeTransport = InstanceType<typeof pdfjs.PDFDataRangeTransport>;

const FIRST_CHUNK = 65_536;
const SETUP_TIMEOUT_MS = 10_000;
const CHUNK_TIMEOUT_MS = 30_000;
const CHUNK_RETRIES = 3;

function fetchWithTimeout(url: string, init: RequestInit, ms: number, outer?: AbortSignal) {
  const ctrl = new AbortController();
  const timer = setTimeout(() => ctrl.abort(), ms);
  const onAbort = () => ctrl.abort();
  outer?.addEventListener("abort", onAbort);
  return fetch(url, { ...init, signal: ctrl.signal }).finally(() => {
    clearTimeout(timer);
    outer?.removeEventListener("abort", onAbort);
  });
}

class SupabaseRangeTransport extends pdfjs.PDFDataRangeTransport {
  private readonly url: string;
  private readonly abortAll = new AbortController();
  private readonly onFatal: () => void;
  private failed = false;

  constructor(url: string, length: number, initialData: Uint8Array | null, onFatal: () => void) {
    super(length, initialData);
    this.url = url;
    this.onFatal = onFatal;
  }

  requestDataRange(begin: number, end: number) {
    void this.load(begin, end, 0);
  }

  private async load(begin: number, end: number, attempt: number): Promise<void> {
    if (this.abortAll.signal.aborted || this.failed) return;
    try {
      const res = await fetchWithTimeout(
        this.url,
        { credentials: "omit", headers: { Range: `bytes=${begin}-${end - 1}` } },
        CHUNK_TIMEOUT_MS,
        this.abortAll.signal,
      );
      if (res.status !== 206 && res.status !== 200) throw new Error(`HTTP ${res.status}`);
      let chunk = new Uint8Array(await res.arrayBuffer());
      // Serveur qui ignore la demande partielle : on découpe le morceau voulu dans la réponse complète.
      if (res.status === 200) chunk = chunk.subarray(begin, end);
      if (!this.abortAll.signal.aborted) this.onDataRange(begin, chunk);
    } catch {
      if (this.abortAll.signal.aborted) return;
      if (attempt < CHUNK_RETRIES) {
        await new Promise((r) => setTimeout(r, 1000 * 2 ** attempt));
        return this.load(begin, end, attempt + 1);
      }
      // Morceau impossible à obtenir : le lecteur affichera « Impossible de charger » + Réessayer.
      this.failed = true;
      this.onFatal();
    }
  }

  abort() {
    this.abortAll.abort();
  }
}

export type PdfRangeSource = { range: RangeTransport; length: number };

/**
 * Prépare la lecture par morceaux. Renvoie null si le serveur ne s'y prête pas (taille inconnue,
 * demande partielle refusée, réseau trop lent) : le lecteur reprend alors le chargement classique.
 */
export async function openPdfRangeSource(url: string, onFatal: () => void, signal?: AbortSignal): Promise<PdfRangeSource | null> {
  try {
    const [head, first] = await Promise.all([
      fetchWithTimeout(url, { method: "HEAD", credentials: "omit" }, SETUP_TIMEOUT_MS, signal),
      fetchWithTimeout(url, { credentials: "omit", headers: { Range: `bytes=0-${FIRST_CHUNK - 1}` } }, SETUP_TIMEOUT_MS, signal),
    ]);
    const length = Number(head.headers.get("content-length") || 0);
    if (!head.ok || !Number.isFinite(length) || length <= 0 || first.status !== 206) {
      void first.body?.cancel().catch(() => {});
      return null;
    }
    const initial = new Uint8Array(await first.arrayBuffer());
    if (initial.length === 0 || initial.length > length) return null;
    const transport = new SupabaseRangeTransport(url, length, initial, onFatal);
    transport.transportReady();
    return { range: transport, length };
  } catch {
    return null;
  }
}
