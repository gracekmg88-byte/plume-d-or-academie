import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { getAuthUser, unauthorized } from "../_shared/auth.ts";
import { generateText, GeminiError } from "../_shared/gemini.ts";

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

    const summary = await generateText(
      "Tu es un assistant académique spécialisé dans la rédaction de résumés de publications universitaires et littéraires pour la bibliothèque KMG KMG Bibliothèque.",
      prompt,
    );

    return new Response(JSON.stringify({ summary }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (e) {
    console.error("summarize error:", e);
    const status = e instanceof GeminiError && (e.status === 429 || e.status === 402) ? e.status : 500;
    return new Response(JSON.stringify({ error: e instanceof Error ? e.message : "Erreur inconnue" }), {
      status, headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
