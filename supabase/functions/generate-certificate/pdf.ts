// @ts-nocheck
// Module isolé pour la génération du PDF du certificat.
// Utilise une police Unicode (DejaVu Sans) embarquée via fontkit pour
// éviter les erreurs WinAnsi sur les caractères spéciaux (★, ✅, accents, etc.).
import { PDFDocument, rgb, degrees } from "https://esm.sh/pdf-lib@1.17.1";
import fontkit from "https://esm.sh/@pdf-lib/fontkit@1.1.1";

const DEJAVU_REGULAR_URL =
  "https://cdn.jsdelivr.net/npm/dejavu-fonts-ttf@2.37.3/ttf/DejaVuSans.ttf";
const DEJAVU_BOLD_URL =
  "https://cdn.jsdelivr.net/npm/dejavu-fonts-ttf@2.37.3/ttf/DejaVuSans-Bold.ttf";
const DEJAVU_OBLIQUE_URL =
  "https://cdn.jsdelivr.net/npm/dejavu-fonts-ttf@2.37.3/ttf/DejaVuSans-Oblique.ttf";

let cachedRegular: Uint8Array | null = null;
let cachedBold: Uint8Array | null = null;
let cachedOblique: Uint8Array | null = null;

async function fetchFont(url: string, cacheRef: () => Uint8Array | null, setRef: (b: Uint8Array) => void) {
  const cached = cacheRef();
  if (cached) return cached;
  const res = await fetch(url);
  if (!res.ok) throw new Error(`Police indisponible (${res.status}) : ${url}`);
  const bytes = new Uint8Array(await res.arrayBuffer());
  setRef(bytes);
  return bytes;
}

async function loadFonts() {
  const [regular, bold, oblique] = await Promise.all([
    fetchFont(DEJAVU_REGULAR_URL, () => cachedRegular, (b) => (cachedRegular = b)),
    fetchFont(DEJAVU_BOLD_URL, () => cachedBold, (b) => (cachedBold = b)),
    fetchFont(DEJAVU_OBLIQUE_URL, () => cachedOblique, (b) => (cachedOblique = b)),
  ]);
  return { regular, bold, oblique };
}

export type Template = "premium" | "academique" | "standard";

export function pickTemplate(category: string): Template {
  const c = category?.toLowerCase();
  if (c === "livre") return "premium";
  if (c === "memoire" || c === "tfc") return "academique";
  return "standard";
}

export function categoryLabel(cat: string): string {
  const c = cat?.toLowerCase();
  if (c === "livre") return "LIVRE";
  if (c === "memoire") return "MÉMOIRE";
  if (c === "tfc") return "TFC";
  if (c === "article") return "ARTICLE SCIENTIFIQUE";
  return "PUBLICATION";
}

function templateMeta(t: Template) {
  if (t === "premium") return { label: "Certificat Premium", subtitle: "Édition Livre" };
  if (t === "academique") return { label: "Certificat Académique", subtitle: "Mémoire / TFC" };
  return { label: "Certificat Standard", subtitle: "Article scientifique" };
}

export interface CertificatePdfInput {
  template: Template;
  title: string;
  author: string;
  category: string;
  publicationDate: string;
  certificateNumber: string;
  publicationNumber: string;
  verificationUrl: string;
  qrBytes: Uint8Array;
}

export async function buildCertificatePdf(opts: CertificatePdfInput): Promise<Uint8Array> {
  const doc = await PDFDocument.create();
  doc.registerFontkit(fontkit);

  const { regular, bold, oblique } = await loadFonts();
  const fRegular = await doc.embedFont(regular, { subset: true });
  const fBold = await doc.embedFont(bold, { subset: true });
  const fOblique = await doc.embedFont(oblique, { subset: true });

  const page = doc.addPage([842, 595]); // A4 paysage
  const { width, height } = page.getSize();

  const navy = rgb(0.043, 0.106, 0.2);     // #0B1B33
  const gold = rgb(0.83, 0.69, 0.22);      // #D4AF37
  const dark = rgb(0.15, 0.15, 0.15);
  const muted = rgb(0.45, 0.45, 0.45);
  const isPremium = opts.template === "premium";
  const accent = isPremium ? gold : (opts.template === "academique" ? rgb(0.10, 0.30, 0.55) : navy);

  // Fond
  page.drawRectangle({ x: 0, y: 0, width, height, color: rgb(0.985, 0.98, 0.96) });

  // Cadres
  page.drawRectangle({ x: 18, y: 18, width: width - 36, height: height - 36, borderColor: accent, borderWidth: isPremium ? 4 : 3 });
  page.drawRectangle({ x: 28, y: 28, width: width - 56, height: height - 56, borderColor: navy, borderWidth: 0.8 });
  if (isPremium) {
    page.drawRectangle({ x: 36, y: 36, width: width - 72, height: height - 72, borderColor: gold, borderWidth: 0.4 });
    const cs = 18;
    [[40, 40], [width - 40 - cs, 40], [40, height - 40 - cs], [width - 40 - cs, height - 40 - cs]].forEach(([x, y]) => {
      page.drawRectangle({ x, y, width: cs, height: cs, borderColor: gold, borderWidth: 1 });
    });
  }

  // Filigrane KMG
  page.drawText("KMG", {
    x: width / 2 - 180, y: height / 2 - 70, size: 220,
    font: fBold, color: rgb(0.94, 0.93, 0.88),
    rotate: degrees(-20),
  });

  // En-tête
  const headerY = height - 78;
  drawCentered(page, "PLUME D'OR KMG", width / 2, headerY, isPremium ? 30 : 26, fBold, navy);
  drawCentered(page, "Bibliothèque Numérique Académique", width / 2, headerY - 22, 12, fOblique, muted);
  drawCentered(page, "« Diffuser le savoir, valoriser la recherche »", width / 2, headerY - 38, 10, fOblique, accent);

  const meta = templateMeta(opts.template);
  drawCentered(page, "CERTIFICAT DE PUBLICATION", width / 2, headerY - 78, 22, fBold, accent);
  drawCentered(page, meta.label.toUpperCase(), width / 2, headerY - 98, 10, fBold, muted);

  // Badge catégorie (★ supporté grâce à la police Unicode)
  const badgeText = `★  ${categoryLabel(opts.category)}  ★`;
  const badgeSize = 11;
  const badgeWidth = fBold.widthOfTextAtSize(badgeText, badgeSize) + 28;
  const badgeX = width / 2 - badgeWidth / 2;
  const badgeY = headerY - 130;
  page.drawRectangle({ x: badgeX, y: badgeY - 5, width: badgeWidth, height: 22, color: accent });
  page.drawText(badgeText, { x: badgeX + 14, y: badgeY + 1, size: badgeSize, font: fBold, color: rgb(1, 1, 1) });

  // Corps
  drawCentered(page, "Nous certifions que la publication intitulée :", width / 2, headerY - 165, 12, fRegular, dark);
  drawCentered(page, truncate(opts.title, 78), width / 2, headerY - 195, 18, fBold, navy);
  drawCentered(page, `par ${opts.author}`, width / 2, headerY - 218, 13, fOblique, dark);
  drawCentered(page,
    "a été officiellement enregistrée et certifiée dans le registre de Plume d'Or KMG.",
    width / 2, headerY - 245, 11, fRegular, dark);

  // Bloc infos
  const infoX = 60;
  let infoY = 200;
  const line = (label: string, value: string) => {
    page.drawText(label, { x: infoX, y: infoY, size: 10, font: fBold, color: navy });
    page.drawText(value, { x: infoX + 140, y: infoY, size: 10, font: fRegular, color: dark });
    infoY -= 17;
  };
  line("N° Publication :", opts.publicationNumber);
  line("N° Certificat :", opts.certificateNumber);
  line("Date publication :", new Date(opts.publicationDate).toLocaleDateString("fr-FR"));
  line("Date certification :", new Date().toLocaleDateString("fr-FR"));
  line("Vérification :", truncate(opts.verificationUrl, 55));

  // Signature numérique
  const sigY = 90;
  page.drawLine({ start: { x: infoX, y: sigY + 22 }, end: { x: infoX + 220, y: sigY + 22 }, color: muted, thickness: 0.6 });
  page.drawText("SIGNÉ NUMÉRIQUEMENT", { x: infoX, y: sigY + 8, size: 8, font: fBold, color: navy });
  page.drawText("Direction Plume d'Or KMG", { x: infoX, y: sigY - 4, size: 9, font: fOblique, color: dark });
  page.drawText(
    `${new Date().toLocaleString("fr-FR")} • ID: ${opts.certificateNumber}`,
    { x: infoX, y: sigY - 16, size: 7, font: fRegular, color: muted }
  );

  // Cachet officiel
  drawStamp(page, width / 2, 115, accent, navy, fBold, opts.publicationDate);

  // QR code
  const qrImg = await doc.embedPng(opts.qrBytes);
  const qrSize = 120;
  const qrX = width - qrSize - 60;
  page.drawImage(qrImg, { x: qrX, y: 70, width: qrSize, height: qrSize });
  drawCentered(page, "Scannez pour vérifier", qrX + qrSize / 2, 60, 8, fOblique, muted);

  // Mention juridique
  const legal = "Ce certificat atteste la publication officielle de ce document au sein de Plume d'Or KMG. Toute falsification, modification ou reproduction frauduleuse est interdite.";
  drawCentered(page, legal, width / 2, 42, 7, fOblique, muted);

  return await doc.save();
}

function drawStamp(page: any, cx: number, cy: number, accent: any, navy: any, fontBold: any, pubDate: string) {
  const r = 55;
  page.drawCircle({ x: cx, y: cy, size: r, borderColor: accent, borderWidth: 2 });
  page.drawCircle({ x: cx, y: cy, size: r - 8, borderColor: accent, borderWidth: 0.6 });
  drawCentered(page, "PLUME D'OR KMG", cx, cy + 18, 8.5, fontBold, navy);
  drawCentered(page, "PUBLICATION", cx, cy + 4, 9, fontBold, accent);
  drawCentered(page, "CERTIFIÉE", cx, cy - 8, 9, fontBold, accent);
  drawCentered(page, new Date(pubDate).getFullYear().toString(), cx, cy - 24, 10, fontBold, navy);
}

function drawCentered(page: any, text: string, cx: number, y: number, size: number, font: any, color: any) {
  const w = font.widthOfTextAtSize(text, size);
  page.drawText(text, { x: cx - w / 2, y, size, font, color });
}

function truncate(s: string, n: number) {
  return s.length > n ? s.slice(0, n - 1) + "…" : s;
}
