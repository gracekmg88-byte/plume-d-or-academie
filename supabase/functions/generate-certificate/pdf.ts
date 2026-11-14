// @ts-nocheck
// Certificat de publication KMG Bibliothèque — modèle « grande bibliothèque ».
// Une seule mise en page solennelle pour toutes les catégories (comme les attestations
// de la BnF, de la Library of Congress ou de la British Library) :
//   papier ivoire, rosace guillochée, double cadre à frise ondulée, médaillon du logo,
//   titres à empattements, notice d'enregistrement, signature manuscrite du Directeur
//   général, sceau doré à rubans, QR de vérification et micro-texte de sécurité.
// Seule la couleur d'accent (rubans du sceau, nature de l'œuvre) change selon la catégorie.
import { PDFDocument, rgb, degrees } from "https://esm.sh/pdf-lib@1.17.1";
import fontkit from "https://esm.sh/@pdf-lib/fontkit@1.1.1";
import { SIGNATURE_PNG_B64, LOGO_JPG_B64 } from "./assets.ts";

// Polices statiques (versions figées) — Cinzel (capitales lapidaires), Crimson Text (texte,
// famille Garamond), Playfair Display (titre de l'œuvre), DejaVu (secours pour les caractères rares).
// NB : EB Garamond et Cormorant ont été écartées — fontkit perd leurs glyphes (lettres manquantes).
const F = "https://cdn.jsdelivr.net/npm";
const FONT_URLS = {
  cinzel:     `${F}/@expo-google-fonts/cinzel@0.2.3/Cinzel_400Regular.ttf`,
  cinzelBold: `${F}/@expo-google-fonts/cinzel@0.2.3/Cinzel_700Bold.ttf`,
  garamond:   `${F}/@expo-google-fonts/crimson-text@0.2.3/CrimsonText_400Regular.ttf`,
  garamondIt: `${F}/@expo-google-fonts/crimson-text@0.2.3/CrimsonText_400Regular_Italic.ttf`,
  title:      `${F}/@expo-google-fonts/playfair-display@0.2.3/PlayfairDisplay_700Bold.ttf`,
  titleIt:    `${F}/@expo-google-fonts/crimson-text@0.2.3/CrimsonText_600SemiBold_Italic.ttf`,
  fallback:   `${F}/dejavu-fonts-ttf@2.37.3/ttf/DejaVuSans.ttf`,
} as const;
type FontKey = keyof typeof FONT_URLS;

const fontCache: Partial<Record<FontKey, Uint8Array>> = {};
async function fetchFont(key: FontKey): Promise<Uint8Array> {
  if (fontCache[key]) return fontCache[key]!;
  let lastErr: unknown;
  for (let i = 0; i < 3; i++) {
    try {
      const r = await fetch(FONT_URLS[key]);
      if (!r.ok) throw new Error(`Police indisponible (${r.status})`);
      const b = new Uint8Array(await r.arrayBuffer());
      fontCache[key] = b;
      return b;
    } catch (e) { lastErr = e; }
  }
  throw lastErr;
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

/** Nature de l'œuvre, en toutes lettres, telle qu'elle figure sur le certificat. */
export function natureLabel(cat: string): string {
  const c = cat?.toLowerCase();
  if (c === "livre") return "Ouvrage — Livre";
  if (c === "memoire") return "Mémoire de fin d'études";
  if (c === "tfc") return "Travail de fin de cycle";
  if (c === "article") return "Article scientifique";
  return "Publication";
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
  /** Date de délivrance (conservée lors d'une régénération). Par défaut : maintenant. */
  issuedAt?: string;
}

// ─── Palette ───────────────────────────────────────────────────────────────
const C = {
  paper:    rgb(0.984, 0.972, 0.937),
  navy:     rgb(0.051, 0.106, 0.200),
  ink:      rgb(0.13, 0.13, 0.16),
  muted:    rgb(0.38, 0.36, 0.32),
  gold:     rgb(0.722, 0.565, 0.247),
  goldDark: rgb(0.50, 0.37, 0.12),
  goldPale: rgb(0.86, 0.76, 0.52),
  sealHi:   rgb(0.86, 0.71, 0.36),
  white:    rgb(1, 1, 1),
};
function accentFor(t: Template) {
  if (t === "premium") return rgb(0.47, 0.11, 0.16);   // bordeaux — livres
  if (t === "academique") return rgb(0.10, 0.23, 0.46); // bleu roi — mémoires / TFC
  return rgb(0.11, 0.35, 0.27);                          // vert — articles
}

function b64ToBytes(b64: string) { return Uint8Array.from(atob(b64), (c) => c.charCodeAt(0)); }

function fmtLong(d: string | Date) {
  return new Date(d).toLocaleDateString("fr-FR", {
    day: "numeric", month: "long", year: "numeric", timeZone: "Africa/Kinshasa",
  });
}

// ─── Texte : glyphes manquants, interlettrage, retour à la ligne ──────────
type Fonts = Record<FontKey, any>;
const charsets = new WeakMap<any, Set<number>>();
function charset(font: any): Set<number> {
  let s = charsets.get(font);
  if (!s) { s = new Set(font.getCharacterSet()); charsets.set(font, s); }
  return s;
}
/** Choisit la police capable d'écrire le texte ; retire les caractères qu'aucune ne sait dessiner (emojis…). */
function prepare(text: string, font: any, fallback: any): { text: string; font: any } {
  const t = (text ?? "").replace(/\s+/g, " ").trim();
  const main = charset(font), fb = charset(fallback);
  const cps = [...t].map((ch) => ch.codePointAt(0)!);
  if (cps.every((cp) => main.has(cp) || cp === 32)) return { text: t, font };
  const useFb = cps.some((cp) => !main.has(cp) && fb.has(cp));
  const f = useFb ? fallback : font, set = useFb ? fb : main;
  const kept = [...t].filter((ch) => ch === " " || set.has(ch.codePointAt(0)!)).join("").replace(/\s+/g, " ").trim();
  return { text: kept || "—", font: f };
}
function spacedWidth(text: string, font: any, size: number, tracking: number) {
  const chars = [...text];
  return font.widthOfTextAtSize(text, size) + tracking * Math.max(0, chars.length - 1);
}
function drawSpaced(page: any, text: string, cx: number, y: number, size: number, font: any, color: any, tracking = 0, opacity = 1) {
  if (!tracking) {
    page.drawText(text, { x: cx - font.widthOfTextAtSize(text, size) / 2, y, size, font, color, opacity });
    return;
  }
  let x = cx - spacedWidth(text, font, size, tracking) / 2;
  for (const ch of text) {
    page.drawText(ch, { x, y, size, font, color, opacity });
    x += font.widthOfTextAtSize(ch, size) + tracking;
  }
}
function wrap(text: string, font: any, size: number, maxW: number): string[] {
  const words = text.split(" ");
  const lines: string[] = [];
  let cur = "";
  for (const w of words) {
    const next = cur ? `${cur} ${w}` : w;
    if (font.widthOfTextAtSize(next, size) <= maxW || !cur) cur = next;
    else { lines.push(cur); cur = w; }
  }
  if (cur) lines.push(cur);
  // Mot isolé trop long : coupe par caractères
  return lines.flatMap((l) => {
    if (font.widthOfTextAtSize(l, size) <= maxW) return [l];
    const out: string[] = []; let part = "";
    for (const ch of l) {
      if (font.widthOfTextAtSize(part + ch, size) > maxW && part) { out.push(part); part = ch; } else part += ch;
    }
    if (part) out.push(part);
    return out;
  });
}
/** Ajuste la taille pour tenir en `maxLines` lignes ; tronque proprement en dernier recours. */
function fitLines(text: string, font: any, maxSize: number, minSize: number, maxW: number, maxLines: number) {
  for (let s = maxSize; s >= minSize; s -= 0.5) {
    const lines = wrap(text, font, s, maxW);
    if (lines.length <= maxLines) return { lines, size: s };
  }
  const lines = wrap(text, font, minSize, maxW).slice(0, maxLines);
  let last = lines[maxLines - 1];
  while (font.widthOfTextAtSize(last + "…", minSize) > maxW && last.length > 1) last = last.slice(0, -1);
  lines[maxLines - 1] = last.trimEnd() + "…";
  return { lines, size: minSize };
}

// ─── Ornements vectoriels ──────────────────────────────────────────────────
/** Rosace guillochée (courbes polaires entrelacées), dessinée très pâle en fond. */
function drawRosette(page: any, cx: number, cy: number, H: number) {
  const curves = 18, steps = 360;
  for (let k = 0; k < curves; k++) {
    const phase = (k / curves) * Math.PI * 2;
    let d = "";
    for (let i = 0; i <= steps; i++) {
      const t = (i / steps) * Math.PI * 2;
      const r = 150 + 34 * Math.sin(12 * t + phase) + 10 * Math.sin(5 * t - phase);
      const x = cx + r * Math.cos(t), y = cy + r * 0.78 * Math.sin(t);
      d += `${i ? "L" : "M"}${x.toFixed(2)} ${(H - y).toFixed(2)} `;
    }
    page.drawSvgPath(d + "Z", { x: 0, y: H, borderColor: C.gold, borderWidth: 0.3, borderOpacity: 0.16 });
  }
}
/** Frise ondulée entrelacée entre deux cadres (motif de billet de banque). */
function drawWaveBand(page: any, x0: number, y0: number, x1: number, y1: number, H: number) {
  const amp = 4.2, wl = 14;
  const side = (ax: number, ay: number, bx: number, by: number, phase: number) => {
    const len = Math.hypot(bx - ax, by - ay), ux = (bx - ax) / len, uy = (by - ay) / len;
    const nx = -uy, ny = ux, n = Math.ceil(len / 1.5);
    let d = "";
    for (let i = 0; i <= n; i++) {
      const s = (i / n) * len, o = amp * Math.sin((s / wl) * Math.PI * 2 + phase);
      const x = ax + ux * s + nx * o, y = ay + uy * s + ny * o;
      d += `${i ? "L" : "M"}${x.toFixed(2)} ${(H - y).toFixed(2)} `;
    }
    page.drawSvgPath(d, { x: 0, y: H, borderColor: C.gold, borderWidth: 0.45, borderOpacity: 0.9 });
  };
  for (const phase of [0, Math.PI, Math.PI / 2, (3 * Math.PI) / 2]) {
    side(x0, y0, x1, y0, phase); side(x0, y1, x1, y1, phase);
    side(x0, y0, x0, y1, phase); side(x1, y0, x1, y1, phase);
  }
}
function drawCornerBlock(page: any, cx: number, cy: number) {
  page.drawRectangle({ x: cx - 10, y: cy - 10, width: 20, height: 20, color: C.paper, borderColor: C.gold, borderWidth: 0.9 });
  page.drawRectangle({ x: cx - 7, y: cy - 7, width: 14, height: 14, borderColor: C.goldPale, borderWidth: 0.4 });
  diamond(page, cx, cy, 4.5, C.navy);
}
function diamond(page: any, cx: number, cy: number, r: number, color: any) {
  page.drawSvgPath(`M0 ${-r} L${r} 0 L0 ${r} L${-r} 0 Z`, { x: cx, y: cy, color });
}
function ornamentRule(page: any, cx: number, y: number, half: number) {
  page.drawLine({ start: { x: cx - half, y }, end: { x: cx - 12, y }, color: C.gold, thickness: 0.7 });
  page.drawLine({ start: { x: cx + 12, y }, end: { x: cx + half, y }, color: C.gold, thickness: 0.7 });
  page.drawLine({ start: { x: cx - half + 20, y: y - 2.5 }, end: { x: cx - 18, y: y - 2.5 }, color: C.goldPale, thickness: 0.35 });
  page.drawLine({ start: { x: cx + 18, y: y - 2.5 }, end: { x: cx + half - 20, y: y - 2.5 }, color: C.goldPale, thickness: 0.35 });
  diamond(page, cx, y, 4, C.gold);
  diamond(page, cx - 9, y, 1.8, C.gold);
  diamond(page, cx + 9, y, 1.8, C.gold);
}
function star(page: any, cx: number, cy: number, R: number, r: number, color: any) {
  let d = "";
  for (let i = 0; i < 10; i++) {
    const a = -Math.PI / 2 + (i * Math.PI) / 5, rad = i % 2 ? r : R;
    d += `${i ? "L" : "M"}${(rad * Math.cos(a)).toFixed(2)} ${(rad * Math.sin(a)).toFixed(2)} `;
  }
  page.drawSvgPath(d + "Z", { x: cx, y: cy, color });
}
/** Texte disposé sur un cercle (sens horaire, en partant du haut). */
function circleText(page: any, text: string, cx: number, cy: number, radius: number, size: number, font: any, color: any, tracking: number) {
  const total = spacedWidth(text, font, size, tracking);
  let a = -(total / radius) / 2; // centré en haut
  for (const ch of text) {
    const w = font.widthOfTextAtSize(ch, size);
    const mid = a + w / 2 / radius;
    const px = cx + radius * Math.sin(mid), py = cy + radius * Math.cos(mid);
    const x = px - (w / 2) * Math.cos(mid), y = py + (w / 2) * Math.sin(mid);
    page.drawText(ch, { x, y, size, font, color, rotate: degrees((-mid * 180) / Math.PI) });
    a += (w + tracking) / radius;
  }
}
/** Sceau doré dentelé avec rubans. */
function drawSeal(page: any, cx: number, cy: number, f: Fonts, accent: any, year: string) {
  // Rubans (derrière le sceau)
  const ribbon = (dir: number) => {
    const d = `M${dir * 6} 0 L${dir * 26} 44 L${dir * 19} 38 L${dir * 12} 47 L${dir * -6} 8 Z`;
    page.drawSvgPath(d, { x: cx, y: cy - 20, color: accent });
    page.drawSvgPath(d, { x: cx, y: cy - 20, borderColor: C.goldDark, borderWidth: 0.4 });
  };
  ribbon(-1); ribbon(1);
  // Bord dentelé
  const teeth = 56, R = 47, r = 43.5;
  let d = "";
  for (let i = 0; i < teeth * 2; i++) {
    const a = (i * Math.PI) / teeth, rad = i % 2 ? r : R;
    d += `${i ? "L" : "M"}${(rad * Math.cos(a)).toFixed(2)} ${(rad * Math.sin(a)).toFixed(2)} `;
  }
  page.drawSvgPath(d + "Z", { x: cx, y: cy, color: C.gold, borderColor: C.goldDark, borderWidth: 0.5 });
  page.drawCircle({ x: cx, y: cy, size: 40, color: C.sealHi, borderColor: C.goldDark, borderWidth: 0.8 });
  page.drawCircle({ x: cx, y: cy, size: 37.5, borderColor: C.goldDark, borderWidth: 0.35 });
  page.drawCircle({ x: cx, y: cy, size: 24, color: C.gold, borderColor: C.goldDark, borderWidth: 0.6 });
  page.drawCircle({ x: cx, y: cy, size: 21.5, borderColor: C.goldDark, borderWidth: 0.3 });
  circleText(page, "KMG BIBLIOTHÈQUE", cx, cy, 28.5, 5.9, f.cinzelBold, C.navy, 0.8);
  // Bas du sceau : « REGISTRE OFFICIEL » lu de gauche à droite
  const bottom = "REGISTRE OFFICIEL";
  const total = spacedWidth(bottom, f.cinzelBold, 5.6, 1);
  let a = Math.PI + total / 31 / 2;
  for (const ch of bottom) {
    const w = f.cinzelBold.widthOfTextAtSize(ch, 5.6);
    const mid = a - w / 2 / 31;
    const px = cx + 31 * Math.sin(mid), py = cy + 31 * Math.cos(mid);
    const x = px + (w / 2) * Math.cos(mid), y = py - (w / 2) * Math.sin(mid);
    page.drawText(ch, { x, y, size: 5.6, font: f.cinzelBold, color: C.navy, rotate: degrees(180 - (mid * 180) / Math.PI) });
    a -= (w + 1) / 31;
  }
  diamond(page, cx - 31, cy, 1.6, C.navy);
  diamond(page, cx + 31, cy, 1.6, C.navy);
  star(page, cx, cy + 9, 5, 2.1, C.navy);
  drawSpaced(page, year, cx, cy - 3.5, 10, f.cinzelBold, C.navy, 0.6);
  drawSpaced(page, "CERTIFIÉ", cx, cy - 12.5, 4.6, f.cinzelBold, C.navy, 0.8);
}

// ─── Construction ──────────────────────────────────────────────────────────
export async function buildCertificatePdf(opts: CertificatePdfInput): Promise<Uint8Array> {
  const doc = await PDFDocument.create();
  doc.registerFontkit(fontkit);
  const keys = Object.keys(FONT_URLS) as FontKey[];
  const bytes = await Promise.all(keys.map(fetchFont));
  const f = {} as Fonts;
  for (let i = 0; i < keys.length; i++) f[keys[i]] = await doc.embedFont(bytes[i], { subset: true });
  const qrImg = await doc.embedPng(opts.qrBytes);
  const sigImg = await doc.embedPng(b64ToBytes(SIGNATURE_PNG_B64));
  const logoImg = await doc.embedJpg(b64ToBytes(LOGO_JPG_B64));

  const accent = accentFor(opts.template);
  const issuedAt = opts.issuedAt ?? new Date().toISOString();

  doc.setTitle(`Certificat de publication ${opts.certificateNumber}`);
  doc.setAuthor("KMG Bibliothèque — Direction générale");
  doc.setSubject(`${opts.title} — ${opts.author}`);
  doc.setKeywords([opts.certificateNumber, opts.publicationNumber, "KMG Bibliothèque", "certificat"]);
  doc.setCreator("KMG Bibliothèque");
  doc.setProducer("KMG Bibliothèque — Registre officiel des publications");
  doc.setCreationDate(new Date(issuedAt));

  const page = doc.addPage([842, 595]);
  const { width: W, height: H } = page.getSize();
  const cx = W / 2;

  // Papier, rosace, cadres
  page.drawRectangle({ x: 0, y: 0, width: W, height: H, color: C.paper });
  drawRosette(page, cx, 290, H);
  page.drawRectangle({ x: 16, y: 16, width: W - 32, height: H - 32, borderColor: C.navy, borderWidth: 1.8 });
  page.drawRectangle({ x: 20, y: 20, width: W - 40, height: H - 40, borderColor: C.gold, borderWidth: 0.5 });
  drawWaveBand(page, 31, 31, W - 31, H - 31, H);
  page.drawRectangle({ x: 41, y: 41, width: W - 82, height: H - 82, borderColor: C.gold, borderWidth: 0.9 });
  page.drawRectangle({ x: 44.5, y: 44.5, width: W - 89, height: H - 89, borderColor: C.navy, borderWidth: 0.4 });
  for (const [x, y] of [[31, 31], [W - 31, 31], [31, H - 31], [W - 31, H - 31]]) drawCornerBlock(page, x, y);

  // En-tête : médaillon du logo + nom de l'institution
  page.drawCircle({ x: cx, y: 520, size: 27.5, color: C.paper, borderColor: C.gold, borderWidth: 1.3 });
  page.drawImage(logoImg, { x: cx - 25, y: 495, width: 50, height: 50 });
  page.drawCircle({ x: cx, y: 520, size: 25.2, borderColor: C.gold, borderWidth: 0.8 });
  page.drawCircle({ x: cx, y: 520, size: 30.5, borderColor: C.goldPale, borderWidth: 0.4 });
  drawSpaced(page, "KMG BIBLIOTHÈQUE", cx, 470, 19, f.cinzelBold, C.navy, 3);
  drawSpaced(page, "BIBLIOTHÈQUE NUMÉRIQUE ACADÉMIQUE  ·  DIRECTION GÉNÉRALE", cx, 456, 6.6, f.cinzel, C.goldDark, 1.6);
  ornamentRule(page, cx, 444, 150);

  // Titre du document
  drawSpaced(page, "CERTIFICAT DE PUBLICATION", cx, 412, 25, f.cinzelBold, C.navy, 2.2);
  drawSpaced(page, "Certificate of Publication  ·  Registre officiel des publications", cx, 396, 10.5, f.garamondIt, C.muted);

  // Formule d'attestation
  const att = "Le Directeur général de KMG Bibliothèque certifie que l'œuvre désignée ci-dessous a été déposée, " +
    "enregistrée et conservée dans le Registre officiel des publications de la Bibliothèque, " +
    "où elle demeure consultable sous les références indiquées.";
  let y = 374;
  for (const line of wrap(att, f.garamondIt, 11.5, 560)) {
    drawSpaced(page, line, cx, y, 11.5, f.garamondIt, C.ink);
    y -= 14.5;
  }

  // Nature de l'œuvre
  y -= 8;
  const nature = natureLabel(opts.category).toUpperCase();
  const nw = spacedWidth(nature, f.cinzelBold, 7.8, 1.6);
  page.drawLine({ start: { x: cx - nw / 2 - 40, y: y + 2.6 }, end: { x: cx - nw / 2 - 10, y: y + 2.6 }, color: accent, thickness: 0.6 });
  page.drawLine({ start: { x: cx + nw / 2 + 10, y: y + 2.6 }, end: { x: cx + nw / 2 + 40, y: y + 2.6 }, color: accent, thickness: 0.6 });
  drawSpaced(page, nature, cx, y, 7.8, f.cinzelBold, accent, 1.6);

  // Titre de l'œuvre + auteur : le bloc doit tenir entre la nature de l'œuvre et la notice
  // (baseline de l'auteur ≥ 254). Taille du titre ajustée (1 à 3 lignes), bloc centré verticalement.
  const a = prepare(opts.author, f.titleIt, f.fallback);
  const aSize = a.font === f.titleIt ? 17 : 12.5;
  const aFit = fitLines(a.text, a.font, aSize, aSize - 4, 560, 1);
  const zoneTop = y - 6, zoneBottom = 254;
  const t = prepare(opts.title, f.title, f.fallback);
  const tMax = t.font === f.title ? 26 : 19, tMin = t.font === f.title ? 14 : 11;
  const blockH = (n: number, s: number) => s * 0.95 + (n - 1) * s * 1.12 + 10 + aFit.size * 0.75;
  let fit = fitLines(t.text, t.font, tMax, tMin, 640, 3);
  while (fit.size > tMin && blockH(fit.lines.length, fit.size) > zoneTop - zoneBottom) {
    fit = fitLines(t.text, t.font, fit.size - 0.5, tMin, 640, 3);
  }
  const slack = Math.max(0, zoneTop - zoneBottom - blockH(fit.lines.length, fit.size));
  y = zoneTop - slack / 2 - fit.size * 0.95;
  fit.lines.forEach((line, i) => {
    drawSpaced(page, line, cx, y, fit.size, t.font, C.navy);
    if (i < fit.lines.length - 1) y -= fit.size * 1.12;
  });

  // Auteur
  y -= 10 + aFit.size * 0.75;
  const par = "par ";
  const pw = f.garamondIt.widthOfTextAtSize(par, 11.5), aw = a.font.widthOfTextAtSize(aFit.lines[0], aFit.size);
  const ax = cx - (pw + aw) / 2;
  page.drawText(par, { x: ax, y, size: 11.5, font: f.garamondIt, color: C.muted });
  page.drawText(aFit.lines[0], { x: ax + pw, y, size: aFit.size, font: a.font, color: C.ink });

  // Notice d'enregistrement (4 cases)
  const nx0 = 92, nx1 = W - 92, ny = 206, nh = 34, cellW = (nx1 - nx0) / 4;
  page.drawRectangle({ x: nx0, y: ny, width: nx1 - nx0, height: nh, color: C.white, opacity: 0.55 });
  page.drawLine({ start: { x: nx0, y: ny + nh }, end: { x: nx1, y: ny + nh }, color: C.gold, thickness: 0.9 });
  page.drawLine({ start: { x: nx0, y: ny + nh - 2.2 }, end: { x: nx1, y: ny + nh - 2.2 }, color: C.goldPale, thickness: 0.35 });
  page.drawLine({ start: { x: nx0, y: ny }, end: { x: nx1, y: ny }, color: C.gold, thickness: 0.9 });
  page.drawLine({ start: { x: nx0, y: ny + 2.2 }, end: { x: nx1, y: ny + 2.2 }, color: C.goldPale, thickness: 0.35 });
  const cells: [string, string][] = [
    ["N° DE CERTIFICAT", opts.certificateNumber],
    ["N° DE PUBLICATION", opts.publicationNumber],
    ["DATE DE DÉPÔT", fmtLong(opts.publicationDate)],
    ["DATE DE DÉLIVRANCE", fmtLong(issuedAt)],
  ];
  cells.forEach(([label, value], i) => {
    const ccx = nx0 + cellW * i + cellW / 2;
    if (i) page.drawLine({ start: { x: nx0 + cellW * i, y: ny + 7 }, end: { x: nx0 + cellW * i, y: ny + nh - 7 }, color: C.goldPale, thickness: 0.5 });
    drawSpaced(page, label, ccx, ny + 22, 5.8, f.cinzelBold, C.goldDark, 1.1);
    const v = prepare(value, f.garamond, f.fallback);
    const vs = Math.min(11.5, (cellW - 14) / Math.max(1, v.font.widthOfTextAtSize(v.text, 1)));
    drawSpaced(page, v.text, ccx, ny + 8.5, vs, v.font, C.navy);
  });

  // Signature (gauche)
  const sx = 175;
  drawSpaced(page, `Fait à Kinshasa, le ${fmtLong(issuedAt)}`, sx, 186, 9.5, f.garamondIt, C.muted);
  const sigW = 128, sigH = (sigImg.height / sigImg.width) * sigW;
  page.drawImage(sigImg, { x: sx - sigW / 2 + 6, y: 104, width: sigW, height: sigH });
  page.drawLine({ start: { x: sx - 92, y: 108 }, end: { x: sx + 92, y: 108 }, color: C.navy, thickness: 0.5 });
  drawSpaced(page, "GRÂCE KOT MUNON", sx, 95, 9, f.cinzelBold, C.navy, 1.4);
  drawSpaced(page, "Directeur général de KMG Bibliothèque", sx, 83, 9.5, f.garamondIt, C.ink);

  // Sceau (centre)
  drawSeal(page, cx, 132, f, accent, new Date(issuedAt).getFullYear().toString());

  // QR de vérification (droite)
  const qx = W - 175, qs = 80;
  page.drawRectangle({ x: qx - qs / 2 - 5, y: 103, width: qs + 10, height: qs + 10, color: C.white, borderColor: C.gold, borderWidth: 0.9 });
  page.drawRectangle({ x: qx - qs / 2 - 2.5, y: 105.5, width: qs + 5, height: qs + 5, borderColor: C.goldPale, borderWidth: 0.35 });
  page.drawImage(qrImg, { x: qx - qs / 2, y: 108, width: qs, height: qs });
  drawSpaced(page, "VÉRIFICATION D'AUTHENTICITÉ", qx, 92, 5.8, f.cinzelBold, C.goldDark, 1);
  const shortUrl = opts.verificationUrl.replace(/^https?:\/\/(www\.)?/, "");
  const uf = prepare(shortUrl, f.garamond, f.fallback);
  const us = Math.min(8.5, 170 / Math.max(1, uf.font.widthOfTextAtSize(uf.text, 1)));
  drawSpaced(page, uf.text, qx, 81, us, uf.font, C.ink);

  // Mention légale + micro-texte de sécurité
  drawSpaced(page,
    "Certificat délivré sous forme électronique. Toute modification le rend nul. Authenticité vérifiable par le code QR ou sur www.kmgbibliotheque.com/verification",
    cx, 58, 7, f.garamondIt, C.muted);
  const micro = `KMG BIBLIOTHÈQUE · ${opts.certificateNumber} · DOCUMENT AUTHENTIQUE · `;
  let line = "";
  while (f.cinzel.widthOfTextAtSize(line + micro, 3) < W - 100) line += micro;
  drawSpaced(page, line.trim(), cx, 49, 3, f.cinzel, C.gold);

  return await doc.save();
}
