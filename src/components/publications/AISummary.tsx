import { useState } from "react";
import { Bot, Loader2, RefreshCw, Sparkles } from "lucide-react";
import { Button } from "@/components/ui/button";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { cn } from "@/lib/utils";

interface AISummaryProps {
  publicationId: string;
  title: string;
  author: string;
  category: string;
  description?: string;
  existingSummary?: string | null;
  isAdmin?: boolean;
}

export function AISummary({ publicationId, title, author, category, description, existingSummary, isAdmin }: AISummaryProps) {
  const [summary, setSummary] = useState(existingSummary || "");
  const [isGenerating, setIsGenerating] = useState(false);
  const [isExpanded, setIsExpanded] = useState(!!existingSummary);

  const generateSummary = async () => {
    setIsGenerating(true);
    try {
      const response = await supabase.functions.invoke("summarize-publication", {
        body: { title, author, category, description },
      });

      if (response.error) throw new Error(response.error.message);
      const result = response.data;
      if (result.error) throw new Error(result.error);

      setSummary(result.summary);
      setIsExpanded(true);

      // Save to DB
      const { error } = await supabase
        .from("publications")
        .update({ summary: result.summary } as any)
        .eq("id", publicationId);

      if (error) console.error("Save summary error:", error);
      toast.success("Résumé généré avec succès !");
    } catch (error: any) {
      console.error("Summary error:", error);
      toast.error(error.message || "Erreur lors de la génération du résumé");
    } finally {
      setIsGenerating(false);
    }
  };

  if (!summary && !isAdmin) return null;

  return (
    <div className="bg-card border border-border rounded-xl overflow-hidden">
      <div className="px-4 py-3 border-b border-border flex items-center justify-between">
        <h3 className="font-serif font-semibold text-sm flex items-center gap-2">
          <Bot className="h-4 w-4 text-primary" />
          Résumé IA
        </h3>
        <div className="flex items-center gap-2">
          {summary && (
            <button
              onClick={() => setIsExpanded(!isExpanded)}
              className="text-xs text-muted-foreground hover:text-foreground transition-colors"
            >
              {isExpanded ? "Réduire" : "Voir"}
            </button>
          )}
          {(isAdmin || !summary) && (
            <Button
              size="sm"
              variant="outline"
              onClick={generateSummary}
              disabled={isGenerating}
              className="gap-1.5 h-7 text-xs"
            >
              {isGenerating ? (
                <Loader2 className="h-3 w-3 animate-spin" />
              ) : summary ? (
                <RefreshCw className="h-3 w-3" />
              ) : (
                <Sparkles className="h-3 w-3" />
              )}
              {summary ? "Régénérer" : "Générer"}
            </Button>
          )}
        </div>
      </div>

      {isGenerating && (
        <div className="p-6 flex items-center justify-center gap-3">
          <Loader2 className="h-5 w-5 animate-spin text-primary" />
          <span className="text-sm text-muted-foreground">Analyse et rédaction du résumé…</span>
        </div>
      )}

      {isExpanded && summary && !isGenerating && (
        <div className="p-4">
          <div className="prose prose-sm max-w-none text-muted-foreground leading-relaxed whitespace-pre-wrap">
            {summary}
          </div>
          <p className="text-[10px] text-muted-foreground/60 mt-3 flex items-center gap-1">
            <Sparkles className="h-2.5 w-2.5" />
            Résumé généré automatiquement par l'intelligence artificielle
          </p>
        </div>
      )}
    </div>
  );
}
