import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";
import { format } from "date-fns";
import { fr } from "date-fns/locale";
import type { Submission } from "@/hooks/useSubmissions";

const statusLabels: Record<string, { label: string; className: string }> = {
  pending: { label: "En attente", className: "bg-amber-500/10 text-amber-600" },
  approved: { label: "Approuvé", className: "bg-green-500/10 text-green-600" },
  rejected: { label: "Refusé", className: "bg-destructive/10 text-destructive" },
};

interface Props {
  submissions: Submission[];
}

export function SubmissionsList({ submissions }: Props) {
  if (submissions.length === 0) return null;

  return (
    <div className="mt-12">
      <h2 className="font-serif text-xl font-semibold text-foreground mb-4">
        Mes soumissions
      </h2>
      <div className="space-y-3">
        {submissions.map((sub) => {
          const st = statusLabels[sub.status] || statusLabels.pending;
          return (
            <div
              key={sub.id}
              className="bg-card border border-border rounded-lg p-4"
            >
              <div className="flex items-start justify-between gap-3">
                <div className="min-w-0 flex-1">
                  <p className="font-medium text-foreground truncate">{sub.title}</p>
                  <p className="text-xs text-muted-foreground mt-1">
                    {format(new Date(sub.created_at), "d MMMM yyyy", { locale: fr })}
                  </p>
                </div>
                <Badge className={cn("shrink-0", st.className)}>
                  {st.label}
                </Badge>
              </div>
              {sub.admin_note && (
                <p className="mt-2 text-sm text-muted-foreground bg-muted/50 rounded px-3 py-2">
                  Note admin : {sub.admin_note}
                </p>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}
