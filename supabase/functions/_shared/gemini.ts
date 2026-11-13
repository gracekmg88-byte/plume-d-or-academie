// Accès direct à l'API Google Gemini (remplace la passerelle IA Lovable).
// Secrets : GEMINI_API_KEY (obligatoire), GEMINI_TEXT_MODEL / GEMINI_IMAGE_MODEL (facultatifs).
// Mêmes modèles que l'ancienne configuration Lovable par défaut.

const API = "https://generativelanguage.googleapis.com/v1beta/models";
export const TEXT_MODEL = Deno.env.get("GEMINI_TEXT_MODEL") ?? "gemini-3-flash-preview";
export const IMAGE_MODEL = Deno.env.get("GEMINI_IMAGE_MODEL") ?? "gemini-3-pro-image-preview";

/** Erreur portant un statut HTTP à renvoyer au client (429 quota, 402 facturation). */
export class GeminiError extends Error {
  constructor(message: string, public status: number) {
    super(message);
  }
}

type Part = { text?: string; inlineData?: { mimeType: string; data: string } };

async function generate(model: string, body: Record<string, unknown>): Promise<Part[]> {
  const key = Deno.env.get("GEMINI_API_KEY");
  if (!key) throw new GeminiError("GEMINI_API_KEY non configurée", 500);
  const res = await fetch(`${API}/${model}:generateContent`, {
    method: "POST",
    headers: { "x-goog-api-key": key, "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
  if (!res.ok) {
    const detail = await res.text();
    console.error("Gemini error:", res.status, detail);
    // Formule gratuite de Google sans droit à ce modèle (« limit: 0 ») : ce n'est pas une limite
    // passagère, il faut activer la facturation du compte Google (Google AI Studio).
    if (res.status === 429 && /limit:\s*0|free_tier/i.test(detail)) {
      throw new GeminiError("La création d'images par IA nécessite d'activer la facturation du compte Google (Google AI Studio).", 402);
    }
    if (res.status === 429) throw new GeminiError("Limite de requêtes atteinte, réessayez plus tard.", 429);
    if (res.status === 403 || /billing|quota/i.test(detail)) throw new GeminiError("Crédits ou quota IA insuffisants.", 402);
    throw new GeminiError("Erreur du service IA", 502);
  }
  const data = await res.json();
  return data?.candidates?.[0]?.content?.parts ?? [];
}

export async function generateText(system: string, prompt: string): Promise<string> {
  const parts = await generate(TEXT_MODEL, {
    systemInstruction: { parts: [{ text: system }] },
    contents: [{ role: "user", parts: [{ text: prompt }] }],
  });
  return parts.map((p) => p.text ?? "").join("").trim();
}

export async function generateImage(prompt: string): Promise<{ bytes: Uint8Array; mimeType: string }> {
  const parts = await generate(IMAGE_MODEL, {
    contents: [{ role: "user", parts: [{ text: prompt }] }],
    generationConfig: { responseModalities: ["TEXT", "IMAGE"] },
  });
  const img = parts.find((p) => p.inlineData?.data);
  if (!img?.inlineData) throw new GeminiError("Aucune image générée par l'IA", 502);
  const bytes = Uint8Array.from(atob(img.inlineData.data), (c) => c.charCodeAt(0));
  return { bytes, mimeType: img.inlineData.mimeType || "image/png" };
}
