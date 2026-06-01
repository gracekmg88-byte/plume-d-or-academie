import { Check, LayoutGrid, LayoutList, Rows3, Newspaper, Loader2 } from "lucide-react";
import { cn } from "@/lib/utils";
import { useLibraryLayout, LIBRARY_LAYOUT_OPTIONS, type LibraryLayout } from "@/hooks/useLibraryLayout";
import { toast } from "sonner";

const ICONS: Record<LibraryLayout, typeof LayoutGrid> = {
  grid: LayoutGrid,
  compact: Rows3,
  list: LayoutList,
  magazine: Newspaper,
};

function Preview({ variant }: { variant: LibraryLayout }) {
  if (variant === "grid") {
    return (
      <div className="grid grid-cols-3 gap-1.5">
        {Array.from({ length: 6 }).map((_, i) => (
          <div key={i} className="aspect-[3/4] rounded-sm bg-muted" />
        ))}
      </div>
    );
  }
  if (variant === "compact") {
    return (
      <div className="grid grid-cols-5 gap-1">
        {Array.from({ length: 10 }).map((_, i) => (
          <div key={i} className="aspect-[3/4] rounded-sm bg-muted" />
        ))}
      </div>
    );
  }
  if (variant === "list") {
    return (
      <div className="space-y-1.5">
        {Array.from({ length: 4 }).map((_, i) => (
          <div key={i} className="flex gap-2">
            <div className="h-10 w-8 rounded-sm bg-muted shrink-0" />
            <div className="flex-1 space-y-1 py-1">
              <div className="h-2 w-3/4 rounded bg-muted" />
              <div className="h-2 w-1/2 rounded bg-muted/70" />
            </div>
          </div>
        ))}
      </div>
    );
  }
  // magazine
  return (
    <div className="space-y-1.5">
      <div className="aspect-[16/9] rounded-sm bg-muted" />
      <div className="grid grid-cols-4 gap-1">
        {Array.from({ length: 4 }).map((_, i) => (
          <div key={i} className="aspect-[3/4] rounded-sm bg-muted" />
        ))}
      </div>
    </div>
  );
}

export function LibraryLayoutSettings() {
  const { layout, isLoading, setLayout } = useLibraryLayout();

  const handlePick = async (next: LibraryLayout) => {
    if (next === layout) return;
    try {
      await setLayout.mutateAsync(next);
      toast.success("Disposition de la bibliothèque mise à jour");
    } catch (err: any) {
      toast.error("Erreur : " + (err?.message ?? "inconnue"));
    }
  };

  return (
    <div className="bg-card rounded-xl border border-border p-6 mb-8">
      <div className="flex items-center justify-between mb-4 gap-3 flex-wrap">
        <div>
          <h2 className="font-serif text-xl font-bold text-foreground flex items-center gap-2">
            <LayoutGrid className="h-5 w-5 text-primary" />
            Disposition des documents
          </h2>
          <p className="text-sm text-muted-foreground">
            Choisissez comment les publications sont affichées dans la bibliothèque publique.
          </p>
        </div>
        {(isLoading || setLayout.isPending) && (
          <Loader2 className="h-4 w-4 animate-spin text-muted-foreground" />
        )}
      </div>

      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
        {LIBRARY_LAYOUT_OPTIONS.map((opt) => {
          const Icon = ICONS[opt.value];
          const active = layout === opt.value;
          return (
            <button
              key={opt.value}
              type="button"
              onClick={() => handlePick(opt.value)}
              disabled={setLayout.isPending}
              className={cn(
                "text-left rounded-lg border p-3 transition-all hover:shadow-elegant",
                active
                  ? "border-primary ring-2 ring-primary/40 bg-primary/5"
                  : "border-border bg-background"
              )}
            >
              <div className="flex items-center justify-between mb-2">
                <div className="flex items-center gap-2">
                  <Icon className="h-4 w-4 text-primary" />
                  <span className="text-sm font-semibold text-foreground">{opt.label}</span>
                </div>
                {active && <Check className="h-4 w-4 text-primary" />}
              </div>
              <div className="rounded-md border border-border/60 bg-background p-2 mb-2">
                <Preview variant={opt.value} />
              </div>
              <p className="text-[11px] leading-snug text-muted-foreground">{opt.description}</p>
            </button>
          );
        })}
      </div>
    </div>
  );
}
