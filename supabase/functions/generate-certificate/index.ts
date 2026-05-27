// @ts-nocheck
import { createClient } from "npm:@supabase/supabase-js@2";
import { corsHeaders } from "npm:@supabase/supabase-js@2/cors";
import QRCode from "npm:qrcode@1.5.4";
import { buildCertificatePdf, pickTemplate } from "./pdf.ts";

const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
const SUPABASE_ANON_KEY = Deno.env.get("SUPABASE_ANON_KEY")!;
const PUBLIC_BASE_URL = "https://plume-d-or-academie.lovable.app";

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });

  try {
    const authHeader = req.headers.get("Authorization");
    if (!authHeader) return json({ error: "Non authentifié" }, 401);

    const userClient = createClient(SUPABASE_URL, SUPABASE_ANON_KEY, {
      global: { headers: { Authorization: authHeader } },
    });
    const { data: userData, error: userErr } = await userClient.auth.getUser();
    if (userErr || !userData.user) return json({ error: "Session invalide" }, 401);
    const userId = userData.user.id;

    const admin = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);

    const { data: roleRow } = await admin
      .from("user_roles").select("role")
      .eq("user_id", userId).eq("role", "admin").maybeSingle();
    if (!roleRow) return json({ error: "Accès réservé aux administrateurs" }, 403);

    const body = await req.json().catch(() => ({}));
    const publicationId = body?.publication_id;
    if (!publicationId || typeof publicationId !== "string") {
      return json({ error: "publication_id requis" }, 400);
    }

    const { data: existing } = await admin
      .from("certificates").select("id, certificate_number")
      .eq("publication_id", publicationId).maybeSingle();
    if (existing) {
      return json({ error: "Cette publication possède déjà un certificat", certificate: existing }, 409);
    }

    const { data: pub, error: pubErr } = await admin
      .from("publications").select("*").eq("id", publicationId).maybeSingle();
    if (pubErr || !pub) return json({ error: "Publication introuvable" }, 404);
    if (!pub.is_published) return json({ error: "La publication doit être publiée avant certification" }, 400);

    await admin.from("publications").update({ certification_status: "pending" }).eq("id", publicationId);

    // Numéro de publication (réutilise s'il existe déjà)
    let publicationNumber: string = pub.publication_number;
    if (!publicationNumber) {
      const { data: pubNum, error: pubNumErr } = await admin
        .rpc("next_publication_number", { _category: pub.category });
      if (pubNumErr || !pubNum) throw new Error("Erreur numéro pub: " + pubNumErr?.message);
      publicationNumber = pubNum;
      await admin.from("publications").update({ publication_number: publicationNumber }).eq("id", publicationId);
    }

    // Numéro de certificat distinct (CERT-YYYY-NNN)
    const { data: certNum, error: numErr } = await admin
      .rpc("next_certificate_number", { _category: pub.category });
    if (numErr || !certNum) throw new Error("Erreur numéro cert: " + numErr?.message);
    const certificateNumber: string = certNum;

    // L'URL publique pointe vers la page de la publication par son numéro
    const verificationUrl = `${PUBLIC_BASE_URL}/publication/${publicationNumber}`;

    const qrDataUrl = await QRCode.toDataURL(verificationUrl, {
      errorCorrectionLevel: "H", margin: 1, width: 512,
      color: { dark: "#0B1B33", light: "#FFFFFF" },
    });
    const qrBytes = Uint8Array.from(atob(qrDataUrl.split(",")[1]), (c) => c.charCodeAt(0));

    const qrPath = `${certificateNumber}/qr.png`;
    const { error: qrUpErr } = await admin.storage.from("certificates")
      .upload(qrPath, qrBytes, { contentType: "image/png", upsert: true });
    if (qrUpErr) throw qrUpErr;
    const qrCodeUrl = admin.storage.from("certificates").getPublicUrl(qrPath).data.publicUrl;

    // Choix du modèle selon catégorie
    const template = pickTemplate(pub.category);

    const pdfBytes = await buildCertificatePdf({
      template,
      title: pub.title,
      author: pub.author,
      category: pub.category,
      publicationDate: pub.created_at,
      certificateNumber,
      publicationNumber,
      verificationUrl,
      qrBytes,
    });

    const pdfPath = `${certificateNumber}/certificate.pdf`;
    const { error: pdfUpErr } = await admin.storage.from("certificates")
      .upload(pdfPath, pdfBytes, { contentType: "application/pdf", upsert: true });
    if (pdfUpErr) throw pdfUpErr;
    const certificatePdfUrl = admin.storage.from("certificates").getPublicUrl(pdfPath).data.publicUrl;

    const { data: cert, error: insErr } = await admin
      .from("certificates").insert({
        publication_id: publicationId,
        certificate_number: certificateNumber,
        publication_number: publicationNumber,
        verification_url: verificationUrl,
        qr_code_url: qrCodeUrl,
        certificate_pdf_url: certificatePdfUrl,
        status: "certified",
        publication_title: pub.title,
        publication_author: pub.author,
        publication_category: pub.category,
        publication_date: pub.created_at,
        issued_by: userId,
      }).select().single();
    if (insErr) throw insErr;

    await admin.from("publications").update({ certification_status: "certified" }).eq("id", publicationId);

    await admin.from("audit_log").insert({
      user_id: userId, action: "generate_certificate", table_name: "certificates",
      record_id: cert.id, new_value: `${publicationNumber} / ${certificateNumber}`,
    });

    return json({ success: true, certificate: cert });
  } catch (e) {
    console.error("generate-certificate error", e);
    return json({ error: e instanceof Error ? e.message : "Erreur inconnue" }, 500);
  }
});

function json(data: unknown, status = 200) {
  return new Response(JSON.stringify(data), {
    status, headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
}

type Template = "premium" | "academique" | "standard";

function pickTemplate(category: string): Template {
  const c = category?.toLowerCase();
  if (c === "livre") return "premium";
  if (c === "memoire" || c === "tfc") return "academique";
  return "standard";
}

function categoryLabel(cat: string): string {
  const c = cat?.toLowerCase();
  if (c === "livre") return "LIVRE";
  if (c === "memoire") return "MEMOIRE";
  if (c === "tfc") return "TFC";
  if (c === "article") return "ARTICLE SCIENTIFIQUE";
  return "PUBLICATION";
}

function templateMeta(t: Template) {
  if (t === "premium") return { label: "Certificat Premium", subtitle: "Édition Livre" };
  if (t === "academique") return { label: "Certificat Académique", subtitle: "Mémoire / TFC" };
  return { label: "Certificat Standard", subtitle: "Article scientifique" };
}

async function buildCertificatePdf(opts: {
  template: Template;
  title: string; author: string; category: string;
  publicationDate: string; certificateNumber: string; publicationNumber: string;
  verificationUrl: string; qrBytes: Uint8Array;
}) {
  const doc = await PDFDocument.create();
  const page = doc.addPage([842, 595]); // A4 paysage
  const { width, height } = page.getSize();

  const helv = await doc.embedFont(StandardFonts.Helvetica);
  const helvBold = await doc.embedFont(StandardFonts.HelveticaBold);
  const helvItal = await doc.embedFont(StandardFonts.HelveticaOblique);
  const timesBold = await doc.embedFont(StandardFonts.TimesRomanBold);
  const timesItal = await doc.embedFont(StandardFonts.TimesRomanItalic);

  // Palette selon template
  const navy = rgb(0.043, 0.106, 0.2);     // #0B1B33
  const gold = rgb(0.83, 0.69, 0.22);      // #D4AF37
  const dark = rgb(0.15, 0.15, 0.15);
  const muted = rgb(0.45, 0.45, 0.45);
  const isPremium = opts.template === "premium";
  const accent = isPremium ? gold : (opts.template === "academique" ? rgb(0.10, 0.30, 0.55) : navy);

  // Fond très léger
  page.drawRectangle({ x: 0, y: 0, width, height, color: rgb(0.985, 0.98, 0.96) });

  // Cadres
  page.drawRectangle({ x: 18, y: 18, width: width - 36, height: height - 36, borderColor: accent, borderWidth: isPremium ? 4 : 3 });
  page.drawRectangle({ x: 28, y: 28, width: width - 56, height: height - 56, borderColor: navy, borderWidth: 0.8 });
  if (isPremium) {
    page.drawRectangle({ x: 36, y: 36, width: width - 72, height: height - 72, borderColor: gold, borderWidth: 0.4 });
  }

  // Coins ornementaux (Premium)
  if (isPremium) {
    const cs = 18;
    [[40,40],[width-40-cs,40],[40,height-40-cs],[width-40-cs,height-40-cs]].forEach(([x,y]) => {
      page.drawRectangle({ x, y, width: cs, height: cs, borderColor: gold, borderWidth: 1 });
    });
  }

  // Watermark diagonal "KMG"
  page.drawText("KMG", {
    x: width / 2 - 180, y: height / 2 - 70, size: 220,
    font: helvBold, color: rgb(0.94, 0.93, 0.88),
    rotate: degrees(-20),
  });

  // En-tête
  const headerY = height - 78;
  drawCentered(page, "PLUME D'OR KMG", width / 2, headerY, isPremium ? 30 : 26, timesBold, navy);
  drawCentered(page, "Bibliothèque Numérique Académique", width / 2, headerY - 22, 12, helvItal, muted);
  drawCentered(page, "« Diffuser le savoir, valoriser la recherche »", width / 2, headerY - 38, 10, timesItal, accent);

  // Titre du certificat
  const meta = templateMeta(opts.template);
  drawCentered(page, "CERTIFICAT DE PUBLICATION", width / 2, headerY - 78, 22, timesBold, accent);
  drawCentered(page, meta.label.toUpperCase(), width / 2, headerY - 98, 10, helvBold, muted);

  // Badge catégorie (pill)
  const badgeText = `*  ${categoryLabel(opts.category)}  *`;
  const badgeSize = 11;
  const badgeWidth = helvBold.widthOfTextAtSize(badgeText, badgeSize) + 28;
  const badgeX = width / 2 - badgeWidth / 2;
  const badgeY = headerY - 130;
  page.drawRectangle({ x: badgeX, y: badgeY - 5, width: badgeWidth, height: 22, color: accent });
  page.drawText(badgeText, { x: badgeX + 14, y: badgeY + 1, size: badgeSize, font: helvBold, color: rgb(1, 1, 1) });

  // Corps
  drawCentered(page, "Nous certifions que la publication intitulée :", width / 2, headerY - 165, 12, helv, dark);
  drawCentered(page, truncate(opts.title, 78), width / 2, headerY - 195, 18, timesBold, navy);
  drawCentered(page, `par ${opts.author}`, width / 2, headerY - 218, 13, timesItal, dark);
  drawCentered(page,
    "a été officiellement enregistrée et certifiée dans le registre de Plume d'Or KMG.",
    width / 2, headerY - 245, 11, helv, dark);

  // Bloc infos (gauche)
  const infoX = 60;
  let infoY = 200;
  const line = (label: string, value: string) => {
    page.drawText(label, { x: infoX, y: infoY, size: 10, font: helvBold, color: navy });
    page.drawText(value, { x: infoX + 140, y: infoY, size: 10, font: helv, color: dark });
    infoY -= 17;
  };
  line("N° Publication :", opts.publicationNumber);
  line("N° Certificat :", opts.certificateNumber);
  line("Date publication :", new Date(opts.publicationDate).toLocaleDateString("fr-FR"));
  line("Date certification :", new Date().toLocaleDateString("fr-FR"));
  line("Vérification :", truncate(opts.verificationUrl, 55));

  // Signature numérique (gauche bas)
  const sigY = 90;
  page.drawLine({ start: { x: infoX, y: sigY + 22 }, end: { x: infoX + 220, y: sigY + 22 }, color: muted, thickness: 0.6 });
  page.drawText("SIGNÉ NUMÉRIQUEMENT", { x: infoX, y: sigY + 8, size: 8, font: helvBold, color: navy });
  page.drawText("Direction Plume d'Or KMG", { x: infoX, y: sigY - 4, size: 9, font: timesItal, color: dark });
  page.drawText(
    `${new Date().toLocaleString("fr-FR")} • ID: ${opts.certificateNumber}`,
    { x: infoX, y: sigY - 16, size: 7, font: helv, color: muted }
  );

  // Cachet officiel (centre bas)
  drawStamp(page, width / 2, 115, accent, navy, helvBold, opts.publicationDate);

  // QR code (droite bas)
  const qrImg = await doc.embedPng(opts.qrBytes);
  const qrSize = 120;
  const qrX = width - qrSize - 60;
  page.drawImage(qrImg, { x: qrX, y: 70, width: qrSize, height: qrSize });
  drawCentered(page, "Scannez pour vérifier", qrX + qrSize / 2, 60, 8, helvItal, muted);

  // Mention juridique (pied de page)
  const legal = "Ce certificat atteste la publication officielle de ce document au sein de Plume d'Or KMG. Toute falsification, modification ou reproduction frauduleuse est interdite.";
  drawCentered(page, legal, width / 2, 42, 7, helvItal, muted);

  return await doc.save();
}

function drawStamp(page: any, cx: number, cy: number, accent: any, navy: any, fontBold: any, pubDate: string) {
  const r = 55;
  // Double cercle
  page.drawCircle({ x: cx, y: cy, size: r, borderColor: accent, borderWidth: 2 });
  page.drawCircle({ x: cx, y: cy, size: r - 8, borderColor: accent, borderWidth: 0.6 });

  drawCentered(page, "PLUME D'OR KMG", cx, cy + 18, 8.5, fontBold, navy);
  drawCentered(page, "PUBLICATION", cx, cy + 4, 9, fontBold, accent);
  drawCentered(page, "CERTIFIÉE", cx, cy - 8, 9, fontBold, accent);
  drawCentered(page, new Date(pubDate).getFullYear().toString(), cx, cy - 24, 10, fontBold, navy);
}

function categoryEmoji(cat: string): string {
  // pdf-lib ne supporte pas l'emoji avec les fonts standard → on utilise un texte ASCII
  const c = cat?.toLowerCase();
  if (c === "livre") return "[ LIVRE ]";
  if (c === "memoire") return "[ MEMOIRE ]";
  if (c === "tfc") return "[ TFC ]";
  if (c === "article") return "[ ARTICLE ]";
  return "[ PUB ]";
}

function drawCentered(page: any, text: string, cx: number, y: number, size: number, font: any, color: any) {
  const w = font.widthOfTextAtSize(text, size);
  page.drawText(text, { x: cx - w / 2, y, size, font, color });
}
function truncate(s: string, n: number) { return s.length > n ? s.slice(0, n - 1) + "…" : s; }
