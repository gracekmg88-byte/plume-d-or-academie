import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { generateImage, GeminiError } from "../_shared/gemini.ts";

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
    // Verify admin
    const authHeader = req.headers.get("Authorization");
    if (!authHeader) throw new Error("Non autorisé");

    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const supabase = createClient(supabaseUrl, supabaseKey);

    const token = authHeader.replace("Bearer ", "");
    const { data: { user }, error: userError } = await supabase.auth.getUser(token);
    if (userError || !user) throw new Error("Non autorisé");

    const { data: roleData } = await supabase
      .from("user_roles")
      .select("role")
      .eq("user_id", user.id)
      .eq("role", "admin")
      .single();

    if (!roleData) throw new Error("Accès réservé aux administrateurs");

    const { title, author, category, style } = await req.json();
    if (!title || !author) throw new Error("Titre et auteur requis");

    const categoryLabels: Record<string, string> = {
      livre: "Book",
      memoire: "Academic Thesis",
      tfc: "Final Year Project",
      article: "Academic Article",
    };

    const stylePrompts: Record<string, string> = {
      minimaliste: "Minimalist design with lots of whitespace, single accent color, clean sans-serif typography, geometric simplicity. Very clean and modern.",
      colore: "Vibrant and colorful design with bold gradients, rich saturated hues, energetic composition, eye-catching color combinations. Lively and dynamic.",
      classique: "Elegant academic design with rich colors (deep navy blue, gold accents), classic serif typography, refined borders and ornamental details. Traditional and prestigious.",
      futuriste: "Futuristic sci-fi inspired design with neon accents, dark background, holographic effects, sleek lines, tech-inspired patterns. Modern and innovative.",
    };

    const catLabel = categoryLabels[category] || "Book";
    const styleDesc = stylePrompts[style] || stylePrompts["classique"];

    const prompt = `Generate a professional book cover design for a ${catLabel}. 
Title: "${title}" by ${author}.
Style: ${styleDesc}
The title "${title}" must be prominently displayed in large, readable text.
The author name "${author}" should appear at the bottom in smaller text.
Portrait/vertical format. Professional publishing quality.
On a clean background with no extra text or watermarks.`;

    let image: { bytes: Uint8Array; mimeType: string };
    try {
      image = await generateImage(prompt);
    } catch (e) {
      if (e instanceof GeminiError && (e.status === 429 || e.status === 402)) {
        const msg = e.status === 429
          ? "Trop de requêtes, réessayez dans quelques instants."
          : e.message;
        // code lu par l'admin pour basculer sur le générateur de couvertures sans IA
        const code = e.status === 429 ? "rate_limited" : "billing_required";
        return new Response(JSON.stringify({ error: msg, code }), {
          status: e.status,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
      throw e;
    }

    // Upload to storage (same path scheme as before: covers/ai-<timestamp>.<ext>)
    const ext = image.mimeType === "image/jpeg" ? "jpg" : image.mimeType === "image/webp" ? "webp" : "png";
    const fileName = `covers/ai-${Date.now()}.${ext}`;
    const { error: uploadError } = await supabase.storage
      .from("publications")
      .upload(fileName, image.bytes, {
        contentType: image.mimeType,
        upsert: false,
      });

    if (uploadError) throw uploadError;

    const { data: urlData } = supabase.storage
      .from("publications")
      .getPublicUrl(fileName);

    return new Response(
      JSON.stringify({ success: true, coverUrl: urlData.publicUrl }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (error: any) {
    console.error("Generate cover error:", error);
    return new Response(
      JSON.stringify({ error: error.message || "Erreur inconnue" }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
