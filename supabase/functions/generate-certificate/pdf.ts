// @ts-nocheck
// Génération PDF des certificats — 3 modèles visuellement distincts :
//  • Premium     → Livres        (cadre doré multiple, ornements, typographie large)
//  • Académique  → Mémoires/TFC  (en-tête bleu plein, ruban latéral, mise en page institutionnelle)
//  • Standard    → Articles      (épuré, accent bleu marine, mise en page condensée)
import { PDFDocument, rgb, degrees } from "https://esm.sh/pdf-lib@1.17.1";
import fontkit from "https://esm.sh/@pdf-lib/fontkit@1.1.1";

const DEJAVU_REGULAR_URL = "https://cdn.jsdelivr.net/npm/dejavu-fonts-ttf@2.37.3/ttf/DejaVuSans.ttf";
const DEJAVU_BOLD_URL    = "https://cdn.jsdelivr.net/npm/dejavu-fonts-ttf@2.37.3/ttf/DejaVuSans-Bold.ttf";
const DEJAVU_OBLIQUE_URL = "https://cdn.jsdelivr.net/npm/dejavu-fonts-ttf@2.37.3/ttf/DejaVuSans-Oblique.ttf";
const SCRIPT_URL         = "https://raw.githubusercontent.com/google/fonts/main/ofl/greatvibes/GreatVibes-Regular.ttf";

let cR: Uint8Array | null = null, cB: Uint8Array | null = null, cO: Uint8Array | null = null, cS: Uint8Array | null = null;
async function fetchFont(url: string, get: () => Uint8Array | null, set: (b: Uint8Array) => void) {
  const c = get(); if (c) return c;
  const r = await fetch(url); if (!r.ok) throw new Error(`Police indisponible (${r.status})`);
  const b = new Uint8Array(await r.arrayBuffer()); set(b); return b;
}
async function loadFonts() {
  const [regular, bold, oblique, script] = await Promise.all([
    fetchFont(DEJAVU_REGULAR_URL, () => cR, (b) => (cR = b)),
    fetchFont(DEJAVU_BOLD_URL,    () => cB, (b) => (cB = b)),
    fetchFont(DEJAVU_OBLIQUE_URL, () => cO, (b) => (cO = b)),
    fetchFont(SCRIPT_URL,         () => cS, (b) => (cS = b)),
  ]);
  return { regular, bold, oblique, script };
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
  const fR = await doc.embedFont(regular, { subset: true });
  const fB = await doc.embedFont(bold, { subset: true });
  const fO = await doc.embedFont(oblique, { subset: true });
  const qrImg = await doc.embedPng(opts.qrBytes);

  if (opts.template === "premium")    return await renderPremium(doc, opts, fR, fB, fO, qrImg);
  if (opts.template === "academique") return await renderAcademique(doc, opts, fR, fB, fO, qrImg);
  return await renderStandard(doc, opts, fR, fB, fO, qrImg);
}

// ─── Helpers ───────────────────────────────────────────────────────────────
function drawCentered(page: any, text: string, cx: number, y: number, size: number, font: any, color: any) {
  const w = font.widthOfTextAtSize(text, size);
  page.drawText(text, { x: cx - w / 2, y, size, font, color });
}
function truncate(s: string, n: number) { return s.length > n ? s.slice(0, n - 1) + "…" : s; }
function fmtDate(d: string) { return new Date(d).toLocaleDateString("fr-FR"); }

// ─── MODÈLE PREMIUM (Livres) ───────────────────────────────────────────────
async function renderPremium(doc: any, opts: CertificatePdfInput, fR: any, fB: any, fO: any, qrImg: any) {
  const page = doc.addPage([842, 595]);
  const { width, height } = page.getSize();
  const navy = rgb(0.043, 0.106, 0.2);
  const gold = rgb(0.83, 0.69, 0.22);
  const goldLight = rgb(0.93, 0.85, 0.55);
  const cream = rgb(0.99, 0.97, 0.92);
  const dark = rgb(0.12, 0.12, 0.12);
  const muted = rgb(0.45, 0.42, 0.35);

  // Fond crème
  page.drawRectangle({ x: 0, y: 0, width, height, color: cream });

  // Quadruple cadre doré
  page.drawRectangle({ x: 14, y: 14, width: width - 28, height: height - 28, borderColor: gold, borderWidth: 5 });
  page.drawRectangle({ x: 24, y: 24, width: width - 48, height: height - 48, borderColor: navy, borderWidth: 0.8 });
  page.drawRectangle({ x: 30, y: 30, width: width - 60, height: height - 60, borderColor: gold, borderWidth: 1.2 });
  page.drawRectangle({ x: 36, y: 36, width: width - 72, height: height - 72, borderColor: goldLight, borderWidth: 0.5 });

  // Coins ornés (losanges dorés)
  const corners = [[42, 42], [width - 42, 42], [42, height - 42], [width - 42, height - 42]];
  corners.forEach(([cx, cy]) => {
    page.drawCircle({ x: cx, y: cy, size: 7, color: gold });
    page.drawCircle({ x: cx, y: cy, size: 3.5, color: cream });
  });

  // Filigrane
  page.drawText("KMG", {
    x: width / 2 - 220, y: height / 2 - 80, size: 260,
    font: fB, color: rgb(0.95, 0.91, 0.78), rotate: degrees(-22),
  });

  // En-tête prestigieux
  const headerY = height - 70;
  drawCentered(page, "❦  KMG BIBLIOTHÈQUE  ❦", width / 2, headerY, 14, fO, gold);
  drawCentered(page, "KMG BIBLIOTHÈQUE", width / 2, headerY - 32, 34, fB, navy);
  // Trait doré décoratif
  page.drawLine({ start: { x: width/2 - 140, y: headerY - 44 }, end: { x: width/2 - 30, y: headerY - 44 }, color: gold, thickness: 1.2 });
  page.drawCircle({ x: width/2, y: headerY - 44, size: 3, color: gold });
  page.drawLine({ start: { x: width/2 + 30, y: headerY - 44 }, end: { x: width/2 + 140, y: headerY - 44 }, color: gold, thickness: 1.2 });
  drawCentered(page, "Bibliothèque Numérique Académique", width / 2, headerY - 60, 11, fO, muted);

  drawCentered(page, "CERTIFICAT PREMIUM", width / 2, headerY - 95, 26, fB, gold);
  drawCentered(page, "— ÉDITION LIVRE —", width / 2, headerY - 115, 11, fB, navy);

  // Badge
  const badgeText = `★  ${categoryLabel(opts.category)}  ★`;
  const bw = fB.widthOfTextAtSize(badgeText, 12) + 36;
  const bx = width / 2 - bw / 2, by = headerY - 150;
  page.drawRectangle({ x: bx, y: by - 4, width: bw, height: 24, color: gold });
  page.drawRectangle({ x: bx + 2, y: by - 2, width: bw - 4, height: 20, borderColor: cream, borderWidth: 0.8 });
  drawCentered(page, badgeText, width / 2, by + 3, 12, fB, navy);

  // Corps
  drawCentered(page, "Nous certifions solennellement que l'ouvrage intitulé :", width / 2, headerY - 185, 12, fO, dark);
  drawCentered(page, truncate(opts.title, 70), width / 2, headerY - 215, 20, fB, navy);
  drawCentered(page, `de ${opts.author}`, width / 2, headerY - 240, 14, fO, dark);
  drawCentered(page, "a été officiellement enregistré et certifié dans le registre prestigieux", width / 2, headerY - 268, 11, fR, dark);
  drawCentered(page, "de KMG Bibliothèque, avec tous les droits et garanties associés.", width / 2, headerY - 282, 11, fR, dark);

  // Infos
  const ix = 70; let iy = 195;
  const line = (l: string, v: string) => {
    page.drawText(l, { x: ix, y: iy, size: 10, font: fB, color: gold });
    page.drawText(v, { x: ix + 145, y: iy, size: 10, font: fR, color: dark });
    iy -= 17;
  };
  line("N° Publication :", opts.publicationNumber);
  line("N° Certificat :", opts.certificateNumber);
  line("Date publication :", fmtDate(opts.publicationDate));
  line("Date certification :", fmtDate(new Date().toISOString()));
  line("Vérification :", truncate(opts.verificationUrl, 50));

  // Signature
  const sy = 90;
  page.drawLine({ start: { x: ix, y: sy + 22 }, end: { x: ix + 220, y: sy + 22 }, color: gold, thickness: 0.8 });
  page.drawText("SIGNÉ NUMÉRIQUEMENT", { x: ix, y: sy + 8, size: 8, font: fB, color: navy });
  page.drawText("Direction KMG Bibliothèque", { x: ix, y: sy - 4, size: 9, font: fO, color: dark });
  page.drawText(`${new Date().toLocaleString("fr-FR")} • ${opts.certificateNumber}`, { x: ix, y: sy - 16, size: 7, font: fR, color: muted });

  // Cachet doré
  drawStampPremium(page, width / 2, 115, gold, navy, fB, opts.publicationDate);

  // QR
  const qrSize = 125, qrX = width - qrSize - 55;
  page.drawRectangle({ x: qrX - 5, y: 65, width: qrSize + 10, height: qrSize + 10, borderColor: gold, borderWidth: 1.5 });
  page.drawImage(qrImg, { x: qrX, y: 70, width: qrSize, height: qrSize });
  drawCentered(page, "Scannez pour vérifier", qrX + qrSize / 2, 55, 8, fO, muted);

  drawCentered(page, "Ce certificat atteste la publication officielle de cet ouvrage au sein de KMG Bibliothèque. Toute falsification est interdite.", width / 2, 42, 7, fO, muted);

  return await doc.save();
}

function drawStampPremium(page: any, cx: number, cy: number, gold: any, navy: any, fB: any, pubDate: string) {
  page.drawCircle({ x: cx, y: cy, size: 60, borderColor: gold, borderWidth: 2.5 });
  page.drawCircle({ x: cx, y: cy, size: 53, borderColor: gold, borderWidth: 0.6 });
  page.drawCircle({ x: cx, y: cy, size: 46, borderColor: navy, borderWidth: 0.4 });
  drawCentered(page, "❦", cx, cy + 30, 12, fB, gold);
  drawCentered(page, "KMG BIBLIOTHÈQUE", cx, cy + 14, 8.5, fB, navy);
  drawCentered(page, "LIVRE", cx, cy + 2, 11, fB, gold);
  drawCentered(page, "CERTIFIÉ", cx, cy - 12, 10, fB, gold);
  drawCentered(page, new Date(pubDate).getFullYear().toString(), cx, cy - 28, 10, fB, navy);
}

// ─── MODÈLE ACADÉMIQUE (Mémoires / TFC) ────────────────────────────────────
async function renderAcademique(doc: any, opts: CertificatePdfInput, fR: any, fB: any, fO: any, qrImg: any) {
  const page = doc.addPage([842, 595]);
  const { width, height } = page.getSize();
  const blue = rgb(0.10, 0.30, 0.55);
  const blueDark = rgb(0.06, 0.18, 0.36);
  const blueLight = rgb(0.88, 0.93, 0.98);
  const dark = rgb(0.15, 0.15, 0.15);
  const muted = rgb(0.45, 0.45, 0.45);

  // Fond blanc cassé
  page.drawRectangle({ x: 0, y: 0, width, height, color: rgb(0.985, 0.987, 0.99) });

  // En-tête bleu plein
  page.drawRectangle({ x: 0, y: height - 90, width, height: 90, color: blueDark });
  page.drawRectangle({ x: 0, y: height - 95, width, height: 5, color: blue });

  // Ruban latéral gauche
  page.drawRectangle({ x: 0, y: 0, width: 40, height: height - 95, color: blue });
  page.drawRectangle({ x: 40, y: 0, width: 4, height: height - 95, color: blueDark });

  // Pied bleu
  page.drawRectangle({ x: 0, y: 0, width, height: 32, color: blueDark });

  // Texte en-tête (blanc)
  drawCentered(page, "KMG BIBLIOTHÈQUE", width / 2, height - 40, 24, fB, rgb(1, 1, 1));
  drawCentered(page, "BIBLIOTHÈQUE NUMÉRIQUE ACADÉMIQUE", width / 2, height - 62, 10, fR, rgb(0.85, 0.9, 1));
  drawCentered(page, "Registre Officiel des Travaux de Recherche", width / 2, height - 78, 9, fO, rgb(0.75, 0.82, 0.95));

  // Titre certificat
  const cy = height - 130;
  drawCentered(page, "CERTIFICAT ACADÉMIQUE", width / 2, cy, 22, fB, blueDark);
  page.drawLine({ start: { x: width/2 - 110, y: cy - 8 }, end: { x: width/2 + 110, y: cy - 8 }, color: blue, thickness: 1 });
  drawCentered(page, "MÉMOIRE  •  TFC  •  TRAVAIL UNIVERSITAIRE", width / 2, cy - 22, 9, fB, blue);

  // Badge catégorie (rectangulaire institutionnel)
  const badgeText = categoryLabel(opts.category);
  const bw = fB.widthOfTextAtSize(badgeText, 11) + 40;
  const bx = width / 2 - bw / 2, by = cy - 52;
  page.drawRectangle({ x: bx, y: by - 4, width: bw, height: 22, color: blueLight, borderColor: blue, borderWidth: 1 });
  drawCentered(page, badgeText, width / 2, by + 2, 11, fB, blueDark);

  // Corps
  drawCentered(page, "Le présent document atteste que le travail de recherche intitulé :", width / 2, cy - 90, 11, fR, dark);
  drawCentered(page, truncate(opts.title, 78), width / 2, cy - 115, 17, fB, blueDark);
  drawCentered(page, `présenté par ${opts.author}`, width / 2, cy - 138, 12, fO, dark);
  drawCentered(page, "a été déposé, enregistré et archivé dans le registre académique officiel", width / 2, cy - 165, 10, fR, dark);
  drawCentered(page, "de KMG Bibliothèque conformément aux exigences scientifiques en vigueur.", width / 2, cy - 178, 10, fR, dark);

  // Tableau infos (gauche)
  const ix = 70; let iy = 195;
  page.drawRectangle({ x: ix - 10, y: iy - 90, width: 360, height: 105, color: blueLight, borderColor: blue, borderWidth: 0.8 });
  page.drawRectangle({ x: ix - 10, y: iy + 5, width: 360, height: 18, color: blue });
  page.drawText("INFORMATIONS OFFICIELLES", { x: ix, y: iy + 10, size: 9, font: fB, color: rgb(1,1,1) });
  iy -= 5;
  const row = (l: string, v: string) => {
    page.drawText(l, { x: ix, y: iy, size: 9, font: fB, color: blueDark });
    page.drawText(v, { x: ix + 135, y: iy, size: 9, font: fR, color: dark });
    iy -= 15;
  };
  row("N° Publication", opts.publicationNumber);
  row("N° Certificat", opts.certificateNumber);
  row("Date publication", fmtDate(opts.publicationDate));
  row("Date certification", fmtDate(new Date().toISOString()));
  row("Vérification", truncate(opts.verificationUrl, 48));

  // Signature
  const sy = 65;
  page.drawLine({ start: { x: ix, y: sy + 22 }, end: { x: ix + 200, y: sy + 22 }, color: blue, thickness: 0.8 });
  page.drawText("SIGNÉ NUMÉRIQUEMENT — Direction KMG Bibliothèque", { x: ix, y: sy + 8, size: 8, font: fB, color: blueDark });
  page.drawText(`${new Date().toLocaleString("fr-FR")} • ${opts.certificateNumber}`, { x: ix, y: sy - 4, size: 7, font: fR, color: muted });

  // Cachet académique (bleu)
  drawStampAcademique(page, 540, 130, blue, blueDark, fB, opts.publicationDate);

  // QR
  const qrSize = 115, qrX = width - qrSize - 60;
  page.drawRectangle({ x: qrX - 4, y: 75, width: qrSize + 8, height: qrSize + 8, borderColor: blue, borderWidth: 1 });
  page.drawImage(qrImg, { x: qrX, y: 79, width: qrSize, height: qrSize });
  drawCentered(page, "Vérification publique", qrX + qrSize / 2, 65, 8, fO, muted);

  // Pied
  drawCentered(page, "Document académique officiel — KMG Bibliothèque — Toute reproduction frauduleuse est interdite.", width / 2, 12, 7, fO, rgb(0.85, 0.9, 1));

  return await doc.save();
}

function drawStampAcademique(page: any, cx: number, cy: number, blue: any, blueDark: any, fB: any, pubDate: string) {
  page.drawCircle({ x: cx, y: cy, size: 52, borderColor: blue, borderWidth: 2 });
  page.drawCircle({ x: cx, y: cy, size: 45, borderColor: blue, borderWidth: 0.4 });
  drawCentered(page, "KMG BIBLIOTHÈQUE", cx, cy + 18, 7.5, fB, blueDark);
  drawCentered(page, "ACADÉMIQUE", cx, cy + 4, 8.5, fB, blue);
  drawCentered(page, "CERTIFIÉ", cx, cy - 8, 9, fB, blue);
  drawCentered(page, new Date(pubDate).getFullYear().toString(), cx, cy - 24, 9, fB, blueDark);
}

// ─── MODÈLE STANDARD (Articles) ────────────────────────────────────────────
async function renderStandard(doc: any, opts: CertificatePdfInput, fR: any, fB: any, fO: any, qrImg: any) {
  const page = doc.addPage([842, 595]);
  const { width, height } = page.getSize();
  const navy = rgb(0.043, 0.106, 0.2);
  const accent = rgb(0.15, 0.35, 0.6);
  const dark = rgb(0.15, 0.15, 0.15);
  const muted = rgb(0.5, 0.5, 0.5);
  const lightBg = rgb(0.97, 0.97, 0.98);

  // Fond blanc
  page.drawRectangle({ x: 0, y: 0, width, height, color: rgb(1, 1, 1) });

  // Bande supérieure fine
  page.drawRectangle({ x: 0, y: height - 8, width, height: 8, color: navy });
  page.drawRectangle({ x: 0, y: height - 12, width, height: 4, color: accent });

  // Cadre simple
  page.drawRectangle({ x: 30, y: 30, width: width - 60, height: height - 50, borderColor: navy, borderWidth: 1 });

  // En-tête sobre
  const hy = height - 60;
  page.drawText("KMG BIBLIOTHÈQUE", { x: 60, y: hy, size: 18, font: fB, color: navy });
  page.drawText("Bibliothèque Numérique Académique", { x: 60, y: hy - 16, size: 9, font: fO, color: muted });

  // Bloc titre droite
  drawCentered(page, "CERTIFICAT STANDARD", width - 200, hy, 14, fB, accent);
  drawCentered(page, "Article scientifique", width - 200, hy - 16, 9, fO, muted);

  // Ligne séparation
  page.drawLine({ start: { x: 60, y: hy - 32 }, end: { x: width - 60, y: hy - 32 }, color: accent, thickness: 1 });

  // Titre central
  const ty = hy - 70;
  drawCentered(page, "CERTIFICAT DE PUBLICATION", width / 2, ty, 20, fB, navy);
  drawCentered(page, "Article scientifique certifié", width / 2, ty - 20, 10, fO, muted);

  // Badge minimal
  const badgeText = categoryLabel(opts.category);
  const bw = fB.widthOfTextAtSize(badgeText, 10) + 28;
  const bx = width / 2 - bw / 2, by = ty - 50;
  page.drawRectangle({ x: bx, y: by - 3, width: bw, height: 20, color: navy });
  drawCentered(page, badgeText, width / 2, by + 2, 10, fB, rgb(1, 1, 1));

  // Corps
  drawCentered(page, "Nous certifions que l'article scientifique intitulé :", width / 2, ty - 85, 11, fR, dark);
  drawCentered(page, truncate(opts.title, 80), width / 2, ty - 110, 16, fB, navy);
  drawCentered(page, `par ${opts.author}`, width / 2, ty - 132, 12, fO, dark);
  drawCentered(page, "a été enregistré et certifié dans le registre de KMG Bibliothèque.", width / 2, ty - 158, 10, fR, dark);

  // Bloc infos compact horizontal
  const blockY = 180;
  page.drawRectangle({ x: 60, y: blockY - 60, width: width - 120, height: 75, color: lightBg, borderColor: accent, borderWidth: 0.5 });
  const cells = [
    ["N° Publication", opts.publicationNumber],
    ["N° Certificat", opts.certificateNumber],
    ["Date publication", fmtDate(opts.publicationDate)],
    ["Date certification", fmtDate(new Date().toISOString())],
  ];
  const cellW = (width - 120) / 4;
  cells.forEach(([l, v], i) => {
    const cx = 60 + i * cellW + cellW / 2;
    drawCentered(page, l, cx, blockY - 5, 8, fB, accent);
    drawCentered(page, v, cx, blockY - 22, 10, fB, navy);
  });
  drawCentered(page, `Vérification : ${truncate(opts.verificationUrl, 75)}`, width / 2, blockY - 48, 8, fO, muted);

  // Signature
  const sy = 90;
  page.drawLine({ start: { x: 60, y: sy + 22 }, end: { x: 280, y: sy + 22 }, color: navy, thickness: 0.6 });
  page.drawText("SIGNÉ NUMÉRIQUEMENT", { x: 60, y: sy + 8, size: 8, font: fB, color: navy });
  page.drawText("Direction KMG Bibliothèque", { x: 60, y: sy - 4, size: 9, font: fO, color: dark });
  page.drawText(`${new Date().toLocaleString("fr-FR")} • ${opts.certificateNumber}`, { x: 60, y: sy - 16, size: 7, font: fR, color: muted });

  // Cachet centre
  drawStampStandard(page, width / 2, 95, accent, navy, fB, opts.publicationDate);

  // QR
  const qrSize = 95, qrX = width - qrSize - 70;
  page.drawImage(qrImg, { x: qrX, y: 70, width: qrSize, height: qrSize });
  drawCentered(page, "Scannez pour vérifier", qrX + qrSize / 2, 60, 7, fO, muted);

  drawCentered(page, "Ce certificat atteste la publication officielle de cet article. Toute falsification est interdite.", width / 2, 40, 7, fO, muted);

  return await doc.save();
}

function drawStampStandard(page: any, cx: number, cy: number, accent: any, navy: any, fB: any, pubDate: string) {
  page.drawCircle({ x: cx, y: cy, size: 45, borderColor: accent, borderWidth: 1.5 });
  page.drawCircle({ x: cx, y: cy, size: 39, borderColor: accent, borderWidth: 0.4 });
  drawCentered(page, "KMG BIBLIOTHÈQUE", cx, cy + 14, 7, fB, navy);
  drawCentered(page, "ARTICLE", cx, cy + 2, 8.5, fB, accent);
  drawCentered(page, "CERTIFIÉ", cx, cy - 10, 8.5, fB, accent);
  drawCentered(page, new Date(pubDate).getFullYear().toString(), cx, cy - 22, 8.5, fB, navy);
}
