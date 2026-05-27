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

// Les helpers PDF (templates, polices Unicode, dessin) sont dans ./pdf.ts

