import { Check, Home, Sparkles, Newspaper, Library, Loader2 } from "lucide-react";
import { cn } from "@/lib/utils";
import { useHomepageLayout, HOMEPAGE_LAYOUT_OPTIONS, type HomepageLayout } from "@/hooks/useHomepageLayout";
import { toast } from "sonner";

const ICONS: Record<HomepageLayout, typeof Home> = {
  complet: Home,
  epure: Sparkles,
  magazine: Newspaper,
  "focus-catalogue": Library,
};

function Preview({ variant }: { variant: HomepageLayout }) {
  if (variant === "complet") {
    return (
      <div className="space-y-1">
        <div className="h-4 rounded-sm bg-muted" />
        <div className="h-3 rounded-sm bg-muted/70" />
        <div className="grid grid-cols-4 gap-1">
          {Array.from({ length: 4 }).map((_, i) => (
            <div key={i} className="h-3 rounded-sm bg-muted" />
          ))}
        </div>
        <div className="grid grid-cols-3 gap-1">
          {Array.from({ length: 3 }).map((_, i) => (
            <div key={i} className="h-4 rounded-sm bg-muted" />
          ))}
        </div>
      </div>
    );
  }
  if (variant === "epure") {
    return (
      <div className="space-y-1.5">
        <div className="h-5 rounded-sm bg-muted" />
        <div className="grid grid-cols-4 gap-1">
          {Array.from({ length: 4 }).map((_, i) => (
            <div key={i} className="aspect-[3/4] rounded-sm bg-muted" />
          ))}
        </div>
      </div>
    );
  }
  if (variant === "magazine") {
    return (
      <div className="space-y-1.5">
        <div className="h-4 rounded-sm bg-muted" />
        <div className="aspect-[16/9] rounded-sm bg-muted" />
        <div className="grid grid-cols-3 gap-1">
          {Array.from({ length: 3 }).map((_, i) => (
            <div key={i} className="aspect-[3/4] rounded-sm bg-muted" />
          ))}
        </div>
      </div>
    );
  }
  // focus-catalogue
  return (
    <div className="space-y-1.5">
      <div className="h-3 rounded-sm bg-muted" />
      <div className="grid grid-cols-4 gap-1">
        {Array.from({ length: 8 }).map((_, i) => (
          <div key={i} className="aspect-[3/4] rounded-sm bg-muted" />
        ))}
      </div>
    </div>
  );
}

export function HomepageLayoutSettings() {
  const { layout, isLoading, setLayout } = useHomepageLayout();

  const handlePick = async (next: HomepageLayout) => {
    if (next === layout) return;
    try {
      await setLayout.mutateAsync(next);
      toast.success("Disposition de la page d'accueil mise à jour");
    } catch (err: any) {
      toast.error("Erreur : " + (err?.message ?? "inconnue"));
    }
  };

  return (
    <div className="bg-card rounded-xl border border-border p-6 mb-8">
      <div className="flex items-center justify-between mb-4 gap-3 flex-wrap">
        <div>
          <h2 className="font-serif text-xl font-bold text-foreground flex items-center gap-2">
            <Home className="h-5 w-5 text-primary" />
            Disposition de la page d'accueil
          </h2>
          <p className="text-sm text-muted-foreground">
            Choisissez la structure et le rythme des sections vues par les visiteurs.
          </p>
        </div>
        {(isLoading || setLayout.isPending) && (
          <Loader2 className="h-4 w-4 animate-spin text-muted-foreground" />
        )}
      </div>

      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
        {HOMEPAGE_LAYOUT_OPTIONS.map((opt) => {
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
