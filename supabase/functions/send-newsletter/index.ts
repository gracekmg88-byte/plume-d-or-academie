import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { getAuthUser, isAdmin, isServiceRoleRequest, unauthorized, forbidden } from "../_shared/auth.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type",
};

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    // Auth: allow internal/service-role callers (cron) or admins only.
    if (!isServiceRoleRequest(req)) {
      const user = await getAuthUser(req);
      if (!user) return unauthorized(corsHeaders);
      if (!(await isAdmin(user.userId))) return forbidden(corsHeaders, "Admin only");
    }

    const RESEND_API_KEY = Deno.env.get("RESEND_API_KEY");
    if (!RESEND_API_KEY) throw new Error("RESEND_API_KEY not configured");

    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const supabase = createClient(supabaseUrl, supabaseKey);

    // Get publications from the last 7 days
    const sevenDaysAgo = new Date();
    sevenDaysAgo.setDate(sevenDaysAgo.getDate() - 7);

    const { data: publications, error: pubError } = await supabase
      .from("publications")
      .select("id, title, author, category, cover_image_url, created_at")
      .eq("is_published", true)
      .gte("created_at", sevenDaysAgo.toISOString())
      .order("created_at", { ascending: false });

    if (pubError) throw pubError;

    if (!publications || publications.length === 0) {
      return new Response(
        JSON.stringify({ message: "No new publications this week, skipping newsletter." }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Get active subscribers
    const { data: subscribers, error: subError } = await supabase
      .from("newsletter_subscribers")
      .select("email, name")
      .eq("is_active", true);

    if (subError) throw subError;

    if (!subscribers || subscribers.length === 0) {
      return new Response(
        JSON.stringify({ message: "No active subscribers." }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const categoryLabels: Record<string, string> = {
      livre: "📖 Livre",
      memoire: "📝 Mémoire",
      tfc: "📄 TFC",
      article: "📰 Article",
    };

    const siteUrl = "https://plume-d-or-academie.lovable.app";

    // Build email HTML
    const publicationsList = publications
      .map(
        (pub) => `
        <tr>
          <td style="padding: 16px 0; border-bottom: 1px solid #e5e7eb;">
            <table cellpadding="0" cellspacing="0" border="0" width="100%">
              <tr>
                <td style="vertical-align: top;">
                  <span style="display: inline-block; background: #d4a574; color: #1a1a2e; font-size: 11px; font-weight: 600; padding: 2px 8px; border-radius: 4px; margin-bottom: 6px;">
                    ${categoryLabels[pub.category] || pub.category}
                  </span>
                  <h3 style="margin: 6px 0 4px; font-size: 16px; color: #1a1a2e;">
                    <a href="${siteUrl}/publication/${pub.id}" style="color: #1a1a2e; text-decoration: none;">${pub.title}</a>
                  </h3>
                  <p style="margin: 0; font-size: 13px; color: #6b7280;">par ${pub.author}</p>
                </td>
              </tr>
            </table>
          </td>
        </tr>`
      )
      .join("");

    const emailHtml = `
    <!DOCTYPE html>
    <html>
    <head><meta charset="utf-8"></head>
    <body style="margin: 0; padding: 0; background-color: #ffffff; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;">
      <table cellpadding="0" cellspacing="0" border="0" width="100%" style="background-color: #ffffff;">
        <tr>
          <td align="center" style="padding: 40px 20px;">
            <table cellpadding="0" cellspacing="0" border="0" width="600" style="max-width: 600px;">
              <!-- Header -->
              <tr>
                <td style="background: linear-gradient(135deg, #1a1a2e, #16213e); padding: 32px; border-radius: 12px 12px 0 0; text-align: center;">
                  <h1 style="margin: 0; color: #d4a574; font-size: 28px;">✨ KMG Bibliothèque</h1>
                  <p style="margin: 8px 0 0; color: #94a3b8; font-size: 14px;">Newsletter hebdomadaire</p>
                </td>
              </tr>

              <!-- Content -->
              <tr>
                <td style="background: #f8fafc; padding: 32px; border: 1px solid #e5e7eb; border-top: none;">
                  <h2 style="margin: 0 0 8px; font-size: 20px; color: #1a1a2e;">📚 Nouvelles publications</h2>
                  <p style="margin: 0 0 24px; font-size: 14px; color: #6b7280;">
                    ${publications.length} nouvelle${publications.length > 1 ? "s" : ""} publication${publications.length > 1 ? "s" : ""} cette semaine
                  </p>

                  <table cellpadding="0" cellspacing="0" border="0" width="100%">
                    ${publicationsList}
                  </table>

                  <!-- CTA -->
                  <table cellpadding="0" cellspacing="0" border="0" width="100%" style="margin-top: 32px;">
                    <tr>
                      <td align="center">
                        <a href="${siteUrl}/bibliotheque" style="display: inline-block; background: #d4a574; color: #1a1a2e; font-weight: 600; padding: 12px 32px; border-radius: 8px; text-decoration: none; font-size: 14px;">
                          Explorer la bibliothèque →
                        </a>
                      </td>
                    </tr>
                  </table>
                </td>
              </tr>

              <!-- Footer -->
              <tr>
                <td style="padding: 24px; text-align: center; border: 1px solid #e5e7eb; border-top: none; border-radius: 0 0 12px 12px; background: #f1f5f9;">
                  <p style="margin: 0; font-size: 12px; color: #9ca3af;">
                    Vous recevez cet email car vous êtes abonné à la newsletter KMG Bibliothèque.
                  </p>
                  <p style="margin: 8px 0 0; font-size: 12px;">
                    <a href="${siteUrl}" style="color: #d4a574;">Visiter le site</a>
                  </p>
                </td>
              </tr>
            </table>
          </td>
        </tr>
      </table>
    </body>
    </html>`;

    // Send emails via Resend (batch, max 100 per call)
    const batchSize = 50;
    let sentCount = 0;

    for (let i = 0; i < subscribers.length; i += batchSize) {
      const batch = subscribers.slice(i, i + batchSize);

      const emails = batch.map((sub) => ({
        from: "KMG Bibliothèque <onboarding@resend.dev>",
        to: sub.email,
        subject: `📚 ${publications.length} nouvelle${publications.length > 1 ? "s" : ""} publication${publications.length > 1 ? "s" : ""} cette semaine - KMG Bibliothèque`,
        html: emailHtml,
      }));

      const res = await fetch("https://api.resend.com/emails/batch", {
        method: "POST",
        headers: {
          Authorization: `Bearer ${RESEND_API_KEY}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify(emails),
      });

      if (!res.ok) {
        const errorText = await res.text();
        console.error(`Resend batch error: ${errorText}`);
      } else {
        sentCount += batch.length;
      }
    }

    return new Response(
      JSON.stringify({
        success: true,
        publications: publications.length,
        emailsSent: sentCount,
      }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (error) {
    console.error("Newsletter error:", error);
    return new Response(
      JSON.stringify({ error: error.message }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
