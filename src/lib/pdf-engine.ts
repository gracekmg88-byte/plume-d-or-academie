import { pdfjs } from "react-pdf";
// Moteur PDF servi par le site lui-même (fichier du build, mis en cache 1 an) au lieu d'un CDN
// extérieur : l'ouverture du premier livre n'attend plus un téléchargement lent depuis unpkg.com,
// et l'appli Android l'embarque (lecture possible sans réseau pour ce fichier).
import pdfWorkerUrl from "pdfjs-dist/build/pdf.worker.min.mjs?url";

pdfjs.GlobalWorkerOptions.workerSrc = pdfWorkerUrl;

// Tables de caractères et polices standard, copiées dans public/pdfjs au build
// (scripts/copy-pdfjs-assets.mjs). Chargées seulement si un document en a besoin.
const base = import.meta.env.BASE_URL.replace(/\/$/, "");
export const PDF_CMAP_URL = `${base}/pdfjs/cmaps/`;
export const PDF_STANDARD_FONTS_URL = `${base}/pdfjs/standard_fonts/`;

let warmed = false;
/** Télécharge le moteur PDF en avance (dès l'arrivée sur la fiche d'un livre). */
export function preloadPdfEngine() {
  if (warmed || typeof window === "undefined") return;
  warmed = true;
  try {
    const link = document.createElement("link");
    link.rel = "prefetch";
    link.href = pdfWorkerUrl;
    document.head.appendChild(link);
  } catch {
    /* sans gravité : le moteur sera chargé à l'ouverture du lecteur */
  }
}

export { pdfjs };
