// @ts-nocheck
import { createClient } from "npm:@supabase/supabase-js@2";
import { corsHeaders } from "npm:@supabase/supabase-js@2/cors";
import QRCode from "npm:qrcode@1.5.4";
import { PDFDocument, StandardFonts, rgb } from "npm:pdf-lib@1.17.1";

const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
const SUPABASE_ANON_KEY = Deno.env.get("SUPABASE_ANON_KEY")!;

// URL publique principale (page de vérification)
const PUBLIC_BASE_URL = "https://plume-d-or-academie.lovable.app";

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });

  try {
    // --- Auth: vérifier que c'est un admin ---
    const authHeader = req.headers.get("Authorization");
    if (!authHeader) {
      return json({ error: "Non authentifié" }, 401);
    }

    const userClient = createClient(SUPABASE_URL, SUPABASE_ANON_KEY, {
      global: { headers: { Authorization: authHeader } },
    });
    const { data: userData, error: userErr } = await userClient.auth.getUser();
    if (userErr || !userData.user) return json({ error: "Session invalide" }, 401);
    const userId = userData.user.id;

    const admin = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);

    const { data: roleRow } = await admin
      .from("user_roles")
      .select("role")
      .eq("user_id", userId)
      .eq("role", "admin")
      .maybeSingle();
    if (!roleRow) return json({ error: "Accès réservé aux administrateurs" }, 403);

    // --- Récupérer publication_id ---
    const body = await req.json().catch(() => ({}));
    const publicationId = body?.publication_id;
    if (!publicationId || typeof publicationId !== "string") {
      return json({ error: "publication_id requis" }, 400);
    }

    // Empêcher doublon
    const { data: existing } = await admin
      .from("certificates")
      .select("id, certificate_number")
      .eq("publication_id", publicationId)
      .maybeSingle();
    if (existing) {
      return json({ error: "Cette publication possède déjà un certificat", certificate: existing }, 409);
    }

    // Charger publication
    const { data: pub, error: pubErr } = await admin
      .from("publications")
      .select("*")
      .eq("id", publicationId)
      .maybeSingle();
    if (pubErr || !pub) return json({ error: "Publication introuvable" }, 404);

    if (!pub.is_published) {
      return json({ error: "La publication doit être publiée avant certification" }, 400);
    }

    // Marquer en attente
    await admin
      .from("publications")
      .update({ certification_status: "pending" })
      .eq("id", publicationId);

    // Numéro
    const { data: numData, error: numErr } = await admin
      .rpc("next_certificate_number", { _category: pub.category });
    if (numErr || !numData) throw new Error("Erreur génération numéro: " + numErr?.message);
    const certificateNumber: string = numData;
    const publicationNumber = certificateNumber; // même format
    const verificationUrl = `${PUBLIC_BASE_URL}/verify/${certificateNumber}`;

    // QR code (PNG)
    const qrDataUrl = await QRCode.toDataURL(verificationUrl, {
      errorCorrectionLevel: "H",
      margin: 1,
      width: 512,
      color: { dark: "#0B1B33", light: "#FFFFFF" },
    });
    const qrBytes = Uint8Array.from(atob(qrDataUrl.split(",")[1]), (c) => c.charCodeAt(0));

    const qrPath = `${certificateNumber}/qr.png`;
    const { error: qrUpErr } = await admin.storage
      .from("certificates")
      .upload(qrPath, qrBytes, { contentType: "image/png", upsert: true });
    if (qrUpErr) throw qrUpErr;
    const { data: qrPublic } = admin.storage.from("certificates").getPublicUrl(qrPath);
    const qrCodeUrl = qrPublic.publicUrl;

    // PDF certificat
    const pdfBytes = await buildCertificatePdf({
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
    const { error: pdfUpErr } = await admin.storage
      .from("certificates")
      .upload(pdfPath, pdfBytes, { contentType: "application/pdf", upsert: true });
    if (pdfUpErr) throw pdfUpErr;
    const { data: pdfPublic } = admin.storage.from("certificates").getPublicUrl(pdfPath);
    const certificatePdfUrl = pdfPublic.publicUrl;

    // Insertion
    const { data: cert, error: insErr } = await admin
      .from("certificates")
      .insert({
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
      })
      .select()
      .single();
    if (insErr) throw insErr;

    await admin
      .from("publications")
      .update({ certification_status: "certified" })
      .eq("id", publicationId);

    // Audit
    await admin.from("audit_log").insert({
      user_id: userId,
      action: "generate_certificate",
      table_name: "certificates",
      record_id: cert.id,
      new_value: certificateNumber,
    });

    return json({ success: true, certificate: cert });
  } catch (e) {
    console.error("generate-certificate error", e);
    return json({ error: e instanceof Error ? e.message : "Erreur inconnue" }, 500);
  }
});

function json(data: unknown, status = 200) {
  return new Response(JSON.stringify(data), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
}

async function buildCertificatePdf(opts: {
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

  const navy = rgb(0.043, 0.106, 0.2); // #0B1B33
  const gold = rgb(0.83, 0.69, 0.22); // #D4AF37
  const dark = rgb(0.15, 0.15, 0.15);

  // Bordure
  page.drawRectangle({ x: 20, y: 20, width: width - 40, height: height - 40, borderColor: gold, borderWidth: 3 });
  page.drawRectangle({ x: 30, y: 30, width: width - 60, height: height - 60, borderColor: navy, borderWidth: 1 });

  // En-tête
  const headerY = height - 80;
  drawCentered(page, "PLUME D'OR KMG", width / 2, headerY, 26, helvBold, navy);
  drawCentered(page, "Académie & Bibliothèque Numérique", width / 2, headerY - 22, 12, helvItal, dark);

  // Titre
  drawCentered(page, "CERTIFICAT DE PUBLICATION", width / 2, headerY - 70, 22, helvBold, gold);

  // Corps
  drawCentered(page, "Nous certifions que la publication intitulée :", width / 2, headerY - 110, 12, helv, dark);
  drawCentered(page, truncate(opts.title, 80), width / 2, headerY - 145, 18, helvBold, navy);
  drawCentered(page, `de ${opts.author}`, width / 2, headerY - 170, 13, helvItal, dark);
  drawCentered(page, `Catégorie : ${opts.category.toUpperCase()}`, width / 2, headerY - 195, 11, helv, dark);
  drawCentered(page,
    `a été officiellement enregistrée et certifiée par Plume d'Or KMG`,
    width / 2, headerY - 225, 11, helv, dark);

  // Numéros (bas gauche)
  const infoX = 70;
  let infoY = 180;
  const line = (label: string, value: string) => {
    page.drawText(label, { x: infoX, y: infoY, size: 10, font: helvBold, color: navy });
    page.drawText(value, { x: infoX + 130, y: infoY, size: 10, font: helv, color: dark });
    infoY -= 18;
  };
  line("N° Publication :", opts.publicationNumber);
  line("N° Certificat :", opts.certificateNumber);
  line("Date publication :", new Date(opts.publicationDate).toLocaleDateString("fr-FR"));
  line("Date émission :", new Date().toLocaleDateString("fr-FR"));
  line("Vérification :", opts.verificationUrl);

  // QR code (bas droit)
  const qrImg = await doc.embedPng(opts.qrBytes);
  const qrSize = 130;
  page.drawImage(qrImg, { x: width - qrSize - 70, y: 70, width: qrSize, height: qrSize });
  drawCentered(page, "Scannez pour vérifier", width - qrSize / 2 - 70, 60, 9, helvItal, dark);

  return await doc.save();
}

function drawCentered(page: any, text: string, cx: number, y: number, size: number, font: any, color: any) {
  const w = font.widthOfTextAtSize(text, size);
  page.drawText(text, { x: cx - w / 2, y, size, font, color });
}
function truncate(s: string, n: number) { return s.length > n ? s.slice(0, n - 1) + "…" : s; }
