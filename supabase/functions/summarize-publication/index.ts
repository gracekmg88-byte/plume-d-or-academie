import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { getAuthUser, unauthorized } from "../_shared/auth.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  try {
    // Require authenticated user (prevents anonymous AI credit drain).
    const caller = await getAuthUser(req);
    if (!caller) return unauthorized(corsHeaders);

    const { title, author, category, description } = await req.json();
    if (!title) throw new Error("Titre requis");


    const LOVABLE_API_KEY = Deno.env.get("LOVABLE_API_KEY");
    if (!LOVABLE_API_KEY) throw new Error("LOVABLE_API_KEY non configuré");

    const categoryLabels: Record<string, string> = {
      livre: "Livre",
      memoire: "Mémoire académique",
      tfc: "Travail de Fin de Cycle",
      article: "Article scientifique",
    };

    const prompt = `Tu es un bibliothécaire académique expert. Génère un résumé intelligent et structuré pour la publication suivante :

Titre : "${title}"
Auteur : ${author || "Non spécifié"}
Type : ${categoryLabels[category] || category}
${description ? `Description disponible : ${description}` : "Aucune description disponible."}

Instructions :
- Rédige un résumé de 3 à 5 paragraphes en français.
- Adopte un ton académique mais accessible.
- Structure le résumé avec : contexte, thèmes principaux, points clés, et conclusion.
- Si la description est limitée, déduis le contenu probable à partir du titre, de l'auteur et de la catégorie.
- Ne mentionne jamais que tu es une IA ou que tu n'as pas lu le document.
- Sois informatif et donne envie de lire la publication.`;

    const response = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${LOVABLE_API_KEY}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: "google/gemini-3-flash-preview",
        messages: [
          { role: "system", content: "Tu es un assistant académique spécialisé dans la rédaction de résumés de publications universitaires et littéraires pour la bibliothèque KMG KMG Bibliothèque." },
          { role: "user", content: prompt },
        ],
      }),
    });

    if (!response.ok) {
      if (response.status === 429) {
        return new Response(JSON.stringify({ error: "Limite de requêtes atteinte, réessayez plus tard." }), {
          status: 429, headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
      if (response.status === 402) {
        return new Response(JSON.stringify({ error: "Crédits insuffisants." }), {
          status: 402, headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
      const t = await response.text();
      console.error("AI error:", response.status, t);
      throw new Error("Erreur du service IA");
    }

    const result = await response.json();
    const summary = result.choices?.[0]?.message?.content || "";

    return new Response(JSON.stringify({ summary }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (e) {
    console.error("summarize error:", e);
    return new Response(JSON.stringify({ error: e instanceof Error ? e.message : "Erreur inconnue" }), {
      status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
