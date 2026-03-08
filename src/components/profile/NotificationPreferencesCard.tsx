import { Bell } from "lucide-react";
import { Switch } from "@/components/ui/switch";
import { Label } from "@/components/ui/label";
import {
  useNotificationPreferences,
  useToggleNotificationPreference,
} from "@/hooks/useNotificationPreferences";
import { toast } from "sonner";

const CATEGORY_LABELS: Record<string, string> = {
  livre: "📖 Livres",
  memoire: "📝 Mémoires",
  tfc: "🎓 TFC",
  article: "📰 Articles",
  chat: "💬 Chat communautaire",
};

export function NotificationPreferencesCard() {
  const { enabledCategories, isLoading, allCategories } =
    useNotificationPreferences();
  const togglePref = useToggleNotificationPreference();

  const handleToggle = (category: string, enabled: boolean) => {
    togglePref.mutate(
      { category, enabled },
      {
        onSuccess: () => {
          toast.success(
            enabled
              ? `Notifications activées pour les ${CATEGORY_LABELS[category]?.slice(2).toLowerCase()}`
              : `Notifications désactivées pour les ${CATEGORY_LABELS[category]?.slice(2).toLowerCase()}`
          );
        },
      }
    );
  };

  if (isLoading) {
    return (
      <div className="animate-pulse space-y-3">
        <div className="h-5 bg-muted rounded w-40" />
        <div className="h-10 bg-muted rounded" />
        <div className="h-10 bg-muted rounded" />
      </div>
    );
  }

  return (
    <div className="border-t border-border pt-6">
      <h3 className="font-semibold text-foreground mb-1 flex items-center gap-2">
        <Bell className="h-4 w-4" />
        Notifications push
      </h3>
      <p className="text-xs text-muted-foreground mb-4">
        Choisissez les catégories pour lesquelles vous souhaitez recevoir des
        notifications lors de nouvelles publications.
      </p>
      <div className="space-y-3">
        {allCategories.map((cat) => (
          <div
            key={cat}
            className="flex items-center justify-between bg-muted/50 rounded-lg px-4 py-3"
          >
            <Label
              htmlFor={`notif-${cat}`}
              className="text-sm font-medium cursor-pointer"
            >
              {CATEGORY_LABELS[cat] || cat}
            </Label>
            <Switch
              id={`notif-${cat}`}
              checked={enabledCategories[cat]}
              onCheckedChange={(checked) => handleToggle(cat, checked)}
              disabled={togglePref.isPending}
            />
          </div>
        ))}
      </div>
    </div>
  );
}
