import { useState } from "react";
import { Eye, Loader2, Minus, Plus } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import { supabase } from "@/integrations/supabase/client";
import { useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";

interface AdjustViewsButtonProps {
  publicationId: string;
  currentViews: number;
}

export function AdjustViewsButton({ publicationId, currentViews }: AdjustViewsButtonProps) {
  const [open, setOpen] = useState(false);
  const [absolute, setAbsolute] = useState<string>(String(currentViews));
  const [delta, setDelta] = useState<string>("10");
  const [saving, setSaving] = useState(false);
  const queryClient = useQueryClient();

  const persist = async (newValue: number) => {
    if (!Number.isFinite(newValue) || newValue < 0) {
      toast.error("Nombre de vues invalide");
      return;
    }
    const value = Math.floor(newValue);
    setSaving(true);
    try {
      const { error } = await supabase
        .from("publications")
        .update({ views_count: value })
        .eq("id", publicationId);
      if (error) throw error;

      // Audit log (best-effort)
      const { data: { user } } = await supabase.auth.getUser();
      if (user) {
        await supabase.from("audit_log").insert({
          user_id: user.id,
          action: "Ajustement manuel des vues",
          table_name: "publications",
          record_id: publicationId,
          old_value: String(currentViews),
          new_value: String(value),
        });
      }

      await Promise.all([
        queryClient.invalidateQueries({ queryKey: ["publications"] }),
        queryClient.invalidateQueries({ queryKey: ["admin-publications"] }),
        queryClient.invalidateQueries({ queryKey: ["publication", publicationId] }),
        queryClient.invalidateQueries({ queryKey: ["featured-publications"] }),
      ]);
      toast.success(`Vues mises à jour : ${value}`);
      setOpen(false);
      setAbsolute(String(value));
    } catch (err: any) {
      toast.error("Erreur : " + (err?.message ?? "inconnue"));
    } finally {
      setSaving(false);
    }
  };

  const applyDelta = (sign: 1 | -1) => {
    const n = Number(delta);
    if (!Number.isFinite(n)) return;
    persist(currentViews + sign * n);
  };

  return (
    <Popover open={open} onOpenChange={(o) => { setOpen(o); if (o) setAbsolute(String(currentViews)); }}>
      <TooltipProvider>
        <Tooltip>
          <TooltipTrigger asChild>
            <PopoverTrigger asChild>
              <Button variant="ghost" size="icon" className="text-blue-600">
                <Eye className="h-4 w-4" />
              </Button>
            </PopoverTrigger>
          </TooltipTrigger>
          <TooltipContent>
            <p>Ajuster le nombre de consultations</p>
          </TooltipContent>
        </Tooltip>
      </TooltipProvider>

      <PopoverContent className="w-72 space-y-4" align="end">
        <div className="space-y-1">
          <p className="text-sm font-semibold text-foreground">Ajuster les vues</p>
          <p className="text-xs text-muted-foreground">
            Actuel : <span className="font-medium text-foreground">{currentViews}</span>
          </p>
        </div>

        <div className="space-y-2">
          <Label className="text-xs">Ajouter / retirer</Label>
          <div className="flex items-center gap-2">
            <Button
              variant="outline"
              size="icon"
              onClick={() => applyDelta(-1)}
              disabled={saving}
            >
              <Minus className="h-4 w-4" />
            </Button>
            <Input
              type="number"
              min={1}
              value={delta}
              onChange={(e) => setDelta(e.target.value)}
              className="text-center"
            />
            <Button
              variant="outline"
              size="icon"
              onClick={() => applyDelta(1)}
              disabled={saving}
            >
              <Plus className="h-4 w-4" />
            </Button>
          </div>
        </div>

        <div className="space-y-2">
          <Label className="text-xs">Définir une valeur exacte</Label>
          <div className="flex items-center gap-2">
            <Input
              type="number"
              min={0}
              value={absolute}
              onChange={(e) => setAbsolute(e.target.value)}
            />
            <Button
              size="sm"
              onClick={() => persist(Number(absolute))}
              disabled={saving}
            >
              {saving ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : "OK"}
            </Button>
          </div>
        </div>
      </PopoverContent>
    </Popover>
  );
}
