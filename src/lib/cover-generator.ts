/**
 * Générateur de couvertures sans IA (gratuit, instantané, dans le navigateur).
 * Utilisé par l'admin quand la création d'images par IA n'est pas disponible (facturation Google
 * non activée, quota, panne). 800 × 1200, comme les autres couvertures du site.
 *
 * Quatre styles (ceux proposés pour l'IA) : classique, minimaliste, coloré, futuriste ;
 * la couleur d'accent dépend de la catégorie (livre, mémoire, TFC, article).
 */

export type CoverStyle = "classique" | "minimaliste" | "colore" | "futuriste";

const W = 800;
const H = 1200;

const CATEGORY: Record<string, { label: string; accent: string; deep: string }> = {
  livre: { label: "LIVRE", accent: "#d4a017", deep: "#4a2a0a" },
  memoire: { label: "MÉMOIRE", accent: "#4f8ef7", deep: "#0d2350" },
  tfc: { label: "TFC", accent: "#2fb67c", deep: "#08362a" },
  article: { label: "ARTICLE", accent: "#a370f0", deep: "#2a1250" },
};

const SERIF = '"Roboto Slab", Georgia, "Times New Roman", serif';
const SANS = 'Roboto, "Segoe UI", Arial, sans-serif';

/** Coupe le texte en lignes ; réduit la taille si nécessaire pour tenir en `maxLines`. */
function fitText(
  ctx: CanvasRenderingContext2D,
  text: string,
  font: (size: number) => string,
  maxWidth: number,
  startSize: number,
  minSize: number,
  maxLines: number,
): { lines: string[]; size: number } {
  const words = text.trim().split(/\s+/);
  for (let size = startSize; size >= minSize; size -= 2) {
    ctx.font = font(size);
    const lines: string[] = [];
    let line = "";
    for (const w of words) {
      const test = line ? `${line} ${w}` : w;
      if (ctx.measureText(test).width <= maxWidth || !line) line = test;
      else { lines.push(line); line = w; }
    }
    if (line) lines.push(line);
    if (lines.length <= maxLines && lines.every((l) => ctx.measureText(l).width <= maxWidth)) return { lines, size };
  }
  // Dernier recours : taille minimale, texte tronqué avec « … ».
  ctx.font = font(minSize);
  const lines: string[] = [];
  let line = "";
  for (const w of words) {
    const test = line ? `${line} ${w}` : w;
    if (ctx.measureText(test).width <= maxWidth || !line) line = test;
    else { lines.push(line); line = w; }
  }
  if (line) lines.push(line);
  const kept = lines.slice(0, maxLines);
  if (lines.length > maxLines) {
    let last = kept[maxLines - 1];
    while (last.length > 1 && ctx.measureText(`${last}…`).width > maxWidth) last = last.slice(0, -1);
    kept[maxLines - 1] = `${last}…`;
  }
  return { lines: kept, size: minSize };
}

function drawLines(
  ctx: CanvasRenderingContext2D,
  lines: string[],
  x: number,
  centerY: number,
  lineHeight: number,
  align: CanvasTextAlign,
) {
  ctx.textAlign = align;
  ctx.textBaseline = "middle";
  const top = centerY - ((lines.length - 1) * lineHeight) / 2;
  lines.forEach((l, i) => ctx.fillText(l, x, top + i * lineHeight));
  return { top: top - lineHeight / 2, bottom: top + (lines.length - 1) * lineHeight + lineHeight / 2 };
}

function noise(ctx: CanvasRenderingContext2D, alpha: number) {
  // Léger grain, comme du papier.
  const img = ctx.getImageData(0, 0, W, H);
  const d = img.data;
  for (let i = 0; i < d.length; i += 4) {
    const n = (Math.random() - 0.5) * 255 * alpha;
    d[i] += n; d[i + 1] += n; d[i + 2] += n;
  }
  ctx.putImageData(img, 0, 0);
}

function drawClassique(ctx: CanvasRenderingContext2D, title: string, author: string, cat: typeof CATEGORY[string]) {
  const g = ctx.createLinearGradient(0, 0, 0, H);
  g.addColorStop(0, "#1b2340");
  g.addColorStop(1, "#0b1022");
  ctx.fillStyle = g;
  ctx.fillRect(0, 0, W, H);
  noise(ctx, 0.04);
  // double cadre doré
  ctx.strokeStyle = "#c9a227";
  ctx.lineWidth = 6;
  ctx.strokeRect(40, 40, W - 80, H - 80);
  ctx.lineWidth = 2;
  ctx.strokeRect(58, 58, W - 116, H - 116);
  // ornements
  const orn = (y: number) => {
    ctx.beginPath(); ctx.moveTo(220, y); ctx.lineTo(370, y); ctx.moveTo(430, y); ctx.lineTo(580, y); ctx.stroke();
    ctx.beginPath(); ctx.arc(400, y, 9, 0, Math.PI * 2); ctx.fillStyle = "#c9a227"; ctx.fill();
  };
  ctx.fillStyle = "#c9a227";
  ctx.font = `600 26px ${SERIF}`;
  ctx.textAlign = "center"; ctx.textBaseline = "middle";
  ctx.fillText(cat.label.split("").join(" "), W / 2, 170);
  orn(225);
  ctx.fillStyle = "#f3e7c4";
  const t = fitText(ctx, title, (s) => `700 ${s}px ${SERIF}`, W - 200, 72, 34, 6);
  ctx.font = `700 ${t.size}px ${SERIF}`;
  const box = drawLines(ctx, t.lines, W / 2, 560, t.size * 1.22, "center");
  orn(Math.max(box.bottom + 50, 800));
  ctx.fillStyle = "#e8d9b0";
  const a = fitText(ctx, author, (s) => `400 ${s}px ${SERIF}`, W - 220, 34, 20, 3);
  ctx.font = `400 ${a.size}px ${SERIF}`;
  drawLines(ctx, a.lines, W / 2, 960, a.size * 1.3, "center");
  ctx.fillStyle = "#c9a227";
  ctx.font = `500 22px ${SERIF}`;
  ctx.fillText("KMG Bibliothèque", W / 2, H - 110);
}

function drawMinimaliste(ctx: CanvasRenderingContext2D, title: string, author: string, cat: typeof CATEGORY[string]) {
  ctx.fillStyle = "#f6f2ea";
  ctx.fillRect(0, 0, W, H);
  noise(ctx, 0.025);
  ctx.fillStyle = cat.accent;
  ctx.fillRect(90, 150, 14, 120);
  ctx.fillStyle = "#555";
  ctx.font = `500 24px ${SANS}`;
  ctx.textAlign = "left"; ctx.textBaseline = "middle";
  ctx.fillText(cat.label, 130, 210);
  ctx.fillStyle = "#151515";
  const t = fitText(ctx, title, (s) => `700 ${s}px ${SERIF}`, W - 190, 76, 34, 7);
  ctx.font = `700 ${t.size}px ${SERIF}`;
  const box = drawLines(ctx, t.lines, 90, 560, t.size * 1.18, "left");
  ctx.fillStyle = cat.accent;
  ctx.fillRect(90, box.bottom + 40, 160, 6);
  ctx.fillStyle = "#333";
  const a = fitText(ctx, author, (s) => `400 ${s}px ${SANS}`, W - 190, 32, 20, 3);
  ctx.font = `400 ${a.size}px ${SANS}`;
  drawLines(ctx, a.lines, 90, H - 220, a.size * 1.3, "left");
  ctx.fillStyle = "#888";
  ctx.font = `500 20px ${SANS}`;
  ctx.fillText("KMG Bibliothèque", 90, H - 110);
}

function drawColore(ctx: CanvasRenderingContext2D, title: string, author: string, cat: typeof CATEGORY[string]) {
  const g = ctx.createLinearGradient(0, 0, W, H);
  g.addColorStop(0, cat.accent);
  g.addColorStop(0.55, "#e2496b");
  g.addColorStop(1, "#f59e0b");
  ctx.fillStyle = g;
  ctx.fillRect(0, 0, W, H);
  // cercles décoratifs
  const circles: [number, number, number, number][] = [[650, 180, 230, 0.18], [120, 1040, 260, 0.15], [700, 900, 120, 0.2], [140, 260, 80, 0.22]];
  for (const [x, y, r, o] of circles) { ctx.beginPath(); ctx.arc(x, y, r, 0, Math.PI * 2); ctx.fillStyle = `rgba(255,255,255,${o})`; ctx.fill(); }
  // bandeau catégorie
  ctx.fillStyle = "rgba(255,255,255,0.92)";
  ctx.beginPath();
  if (typeof ctx.roundRect === "function") ctx.roundRect(80, 120, 230, 60, 30);
  else ctx.rect(80, 120, 230, 60); // anciens navigateurs
  ctx.fill();
  ctx.fillStyle = "#222";
  ctx.font = `700 24px ${SANS}`;
  ctx.textAlign = "center"; ctx.textBaseline = "middle";
  ctx.fillText(cat.label, 195, 151);
  ctx.fillStyle = "#ffffff";
  ctx.shadowColor = "rgba(0,0,0,0.25)"; ctx.shadowBlur = 18;
  const t = fitText(ctx, title, (s) => `800 ${s}px ${SERIF}`, W - 160, 80, 36, 6);
  ctx.font = `800 ${t.size}px ${SERIF}`;
  drawLines(ctx, t.lines, 80, 580, t.size * 1.15, "left");
  ctx.shadowBlur = 0;
  const a = fitText(ctx, author, (s) => `500 ${s}px ${SANS}`, W - 160, 34, 20, 3);
  ctx.font = `500 ${a.size}px ${SANS}`;
  drawLines(ctx, a.lines, 80, H - 200, a.size * 1.3, "left");
  ctx.font = `500 20px ${SANS}`;
  ctx.fillStyle = "rgba(255,255,255,0.85)";
  ctx.fillText("KMG Bibliothèque", 80, H - 100);
}

function drawFuturiste(ctx: CanvasRenderingContext2D, title: string, author: string, cat: typeof CATEGORY[string]) {
  const g = ctx.createRadialGradient(W * 0.7, H * 0.3, 50, W / 2, H / 2, H * 0.8);
  g.addColorStop(0, cat.deep);
  g.addColorStop(1, "#05060f");
  ctx.fillStyle = g;
  ctx.fillRect(0, 0, W, H);
  // grille en perspective
  ctx.strokeStyle = "rgba(0, 229, 255, 0.18)";
  ctx.lineWidth = 1.5;
  for (let i = -10; i <= 10; i++) { ctx.beginPath(); ctx.moveTo(W / 2 + i * 22, 820); ctx.lineTo(W / 2 + i * 120, H); ctx.stroke(); }
  for (let y = 840, step = 14; y < H; y += step, step *= 1.25) { ctx.beginPath(); ctx.moveTo(0, y); ctx.lineTo(W, y); ctx.stroke(); }
  // lignes lumineuses
  ctx.strokeStyle = "#00e5ff"; ctx.lineWidth = 3; ctx.shadowColor = "#00e5ff"; ctx.shadowBlur = 20;
  ctx.beginPath(); ctx.moveTo(80, 200); ctx.lineTo(300, 200); ctx.stroke();
  ctx.shadowBlur = 0;
  ctx.fillStyle = "#00e5ff";
  ctx.font = `700 24px ${SANS}`;
  ctx.textAlign = "left"; ctx.textBaseline = "middle";
  ctx.fillText(cat.label.split("").join(" "), 80, 160);
  ctx.fillStyle = "#ffffff"; ctx.shadowColor = "rgba(0,229,255,0.6)"; ctx.shadowBlur = 16;
  // Titre à partir du haut, puis l'auteur et la ligne lumineuse juste en dessous (jamais superposés).
  const t = fitText(ctx, title.toUpperCase(), (s) => `800 ${s}px ${SANS}`, W - 160, 70, 30, 5);
  ctx.font = `800 ${t.size}px ${SANS}`;
  const tl = t.size * 1.18;
  const box = drawLines(ctx, t.lines, 80, 250 + tl / 2 + ((t.lines.length - 1) * tl) / 2, tl, "left");
  ctx.shadowBlur = 0;
  ctx.fillStyle = "#c7d2fe";
  const a = fitText(ctx, author, (s) => `400 ${s}px ${SANS}`, W - 160, 32, 20, 2);
  ctx.font = `400 ${a.size}px ${SANS}`;
  const al = a.size * 1.3;
  const abox = drawLines(ctx, a.lines, 80, box.bottom + 40 + al / 2 + ((a.lines.length - 1) * al) / 2, al, "left");
  const lineY = Math.min(abox.bottom + 40, 800);
  ctx.strokeStyle = cat.accent; ctx.shadowColor = cat.accent; ctx.shadowBlur = 20; ctx.lineWidth = 3;
  ctx.beginPath(); ctx.moveTo(80, lineY); ctx.lineTo(W - 80, lineY); ctx.stroke();
  ctx.shadowBlur = 0;
  ctx.fillStyle = "rgba(199,210,254,0.7)";
  ctx.font = `500 20px ${SANS}`;
  ctx.fillText("KMG Bibliothèque", 80, H - 70);
}

function toBlob(canvas: HTMLCanvasElement, type: string, quality: number) {
  return new Promise<Blob | null>((r) => canvas.toBlob(r, type, quality));
}

/** Crée une couverture 800 × 1200 et la renvoie comme fichier image (WebP, ou JPEG si WebP indisponible). */
export async function generateLocalCover(opts: {
  title: string;
  author: string;
  category?: string;
  style?: string;
}): Promise<File> {
  const cat = CATEGORY[opts.category ?? ""] ?? CATEGORY.livre;
  const style = (["classique", "minimaliste", "colore", "futuriste"].includes(opts.style ?? "") ? opts.style : "classique") as CoverStyle;
  // Les polices du site doivent être chargées avant de dessiner, sinon le navigateur prend une police de secours.
  try {
    await Promise.all([
      document.fonts.load(`700 40px "Roboto Slab"`),
      document.fonts.load(`800 40px "Roboto Slab"`),
      document.fonts.load(`700 40px Roboto`),
      document.fonts.load(`400 40px Roboto`),
    ]);
  } catch { /* police de secours */ }

  const canvas = document.createElement("canvas");
  canvas.width = W;
  canvas.height = H;
  const ctx = canvas.getContext("2d");
  if (!ctx) throw new Error("Canvas indisponible");
  const draw = { classique: drawClassique, minimaliste: drawMinimaliste, colore: drawColore, futuriste: drawFuturiste }[style];
  draw(ctx, opts.title, opts.author, cat);

  let blob = await toBlob(canvas, "image/webp", 0.85);
  if (!blob || blob.type !== "image/webp") blob = await toBlob(canvas, "image/jpeg", 0.88);
  if (!blob) throw new Error("Impossible de créer l'image");
  const ext = blob.type === "image/webp" ? "webp" : "jpg";
  return new File([blob], `couverture-${style}.${ext}`, { type: blob.type });
}
