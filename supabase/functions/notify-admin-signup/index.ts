import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { Resend } from "https://esm.sh/resend@2.0.0";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const resend = new Resend(Deno.env.get("RESEND_API_KEY"));
const ADMIN_EMAIL = "kmgmultiservices98@gmail.com";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

interface SignupPayload {
  type: "INSERT";
  table: "user_profiles";
  record: {
    id: string;
    user_id: string;
    email: string;
    full_name: string | null;
    subscription_type: string;
    created_at: string;
  };
}

const handler = async (req: Request): Promise<Response> => {
  console.log("Notify admin signup function called");

  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const payload: SignupPayload = await req.json();
    console.log("Received payload:", JSON.stringify(payload));

    const { record } = payload;
    
    if (!record || !record.email) {
      console.log("No valid record found in payload");
      return new Response(JSON.stringify({ error: "Invalid payload" }), {
        status: 400,
        headers: { "Content-Type": "application/json", ...corsHeaders },
      });
    }

    const userName = record.full_name || "Non spécifié";
    const userEmail = record.email;
    const signupDate = new Date(record.created_at).toLocaleString("fr-FR", {
      dateStyle: "full",
      timeStyle: "short",
    });

    console.log(`Sending notification for new user: ${userEmail}`);

    const emailResponse = await resend.emails.send({
      from: "Plume d'Or <noreply@resend.dev>",
      to: [ADMIN_EMAIL],
      subject: "🎉 Nouveau membre inscrit sur Plume d'Or Académie",
      html: `
        <!DOCTYPE html>
        <html>
        <head>
          <meta charset="utf-8">
          <style>
            body { font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif; margin: 0; padding: 0; background-color: #f4f4f4; }
            .container { max-width: 600px; margin: 20px auto; background: white; border-radius: 12px; overflow: hidden; box-shadow: 0 4px 12px rgba(0,0,0,0.1); }
            .header { background: linear-gradient(135deg, #d4a574, #8b6914); padding: 30px; text-align: center; }
            .header h1 { color: white; margin: 0; font-size: 24px; }
            .content { padding: 30px; }
            .info-box { background: #fdf8f3; border-left: 4px solid #d4a574; padding: 15px; margin: 20px 0; border-radius: 0 8px 8px 0; }
            .info-row { margin: 10px 0; }
            .label { color: #666; font-size: 14px; }
            .value { color: #333; font-weight: 600; font-size: 16px; }
            .cta { text-align: center; margin: 30px 0; }
            .cta a { background: #d4a574; color: white; padding: 12px 30px; text-decoration: none; border-radius: 8px; font-weight: 600; }
            .footer { background: #f9f9f9; padding: 20px; text-align: center; color: #888; font-size: 12px; }
          </style>
        </head>
        <body>
          <div class="container">
            <div class="header">
              <h1>🎓 Plume d'Or Académie</h1>
            </div>
            <div class="content">
              <h2 style="color: #333; margin-bottom: 20px;">Nouveau membre inscrit !</h2>
              <p style="color: #666;">Un nouvel utilisateur vient de s'inscrire sur votre plateforme.</p>
              
              <div class="info-box">
                <div class="info-row">
                  <div class="label">👤 Nom</div>
                  <div class="value">${userName}</div>
                </div>
                <div class="info-row">
                  <div class="label">📧 Email</div>
                  <div class="value">${userEmail}</div>
                </div>
                <div class="info-row">
                  <div class="label">📅 Date d'inscription</div>
                  <div class="value">${signupDate}</div>
                </div>
                <div class="info-row">
                  <div class="label">🎫 Type de compte</div>
                  <div class="value" style="color: #888;">Gratuit (par défaut)</div>
                </div>
              </div>
              
              <div class="cta">
                <a href="https://plume-d-or-academie.lovable.app/admin/users">Gérer les utilisateurs</a>
              </div>
            </div>
            <div class="footer">
              <p>Cet email a été envoyé automatiquement par Plume d'Or Académie.</p>
              <p>© ${new Date().getFullYear()} Plume d'Or KMG. Tous droits réservés.</p>
            </div>
          </div>
        </body>
        </html>
      `,
    });

    console.log("Email sent successfully:", emailResponse);

    return new Response(JSON.stringify({ success: true, emailResponse }), {
      status: 200,
      headers: { "Content-Type": "application/json", ...corsHeaders },
    });
  } catch (error: any) {
    console.error("Error in notify-admin-signup function:", error);
    return new Response(
      JSON.stringify({ error: error.message }),
      {
        status: 500,
        headers: { "Content-Type": "application/json", ...corsHeaders },
      }
    );
  }
};

serve(handler);
