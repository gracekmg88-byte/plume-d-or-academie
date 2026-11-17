// Profil → « Supprimer mon compte » (exigé par Google Play et l'App Store).
// Double confirmation : ouverture d'une fenêtre, puis saisie du mot SUPPRIMER.
import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { useQueryClient } from "@tanstack/react-query";
import { AlertTriangle, Loader2, Trash2 } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { supabase } from "@/integrations/supabase/client";
import { invokeWithTimeout } from "@/lib/invoke-with-timeout";
import { getAllOfflinePublications, removeOfflinePublication } from "@/lib/offline-storage";

async function readError(error: unknown): Promise<string> {
  const ctx = (error as { context?: Response })?.context;
  if (ctx && typeof ctx.json === "function") {
    try {
      const b = await ctx.json();
      if (b?.error) return String(b.error);
    } catch { /* corps illisible */ }
  }
  return error instanceof Error && error.message ? error.message : "La suppression n'a pas pu aboutir. Réessayez.";
}

export function DeleteAccountCard({ isAdmin }: { isAdmin: boolean }) {
  const [open, setOpen] = useState(false);
  const [word, setWord] = useState("");
  const [busy, setBusy] = useState(false);
  const navigate = useNavigate();
  const qc = useQueryClient();
  const ready = word.trim().toUpperCase() === "SUPPRIMER";

  const confirmDelete = async () => {
    if (!ready || busy) return;
    setBusy(true);
    try {
      const { error } = await invokeWithTimeout("delete-account", { confirm: "SUPPRIMER" }, { callMs: 60_000 });
      if (error) throw new Error(await readError(error));

      // Le compte n'existe plus : nettoyage local (session, livres hors ligne, cache).
      try {
        for (const p of await getAllOfflinePublications()) await removeOfflinePublication(p.id);
      } catch { /* sans gravité */ }
      await supabase.auth.signOut({ scope: "local" }).catch(() => {});
      qc.clear();
      setOpen(false);
      toast.success("Votre compte a été supprimé. Merci d'avoir utilisé KMG Bibliothèque.");
      navigate("/", { replace: true });
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "La suppression n'a pas pu aboutir. Réessayez.");
    } finally {
      setBusy(false);
    }
  };

  return (
    <section aria-labelledby="suppression-titre" className="border-t border-border pt-6 text-left">
      <h3 id="suppression-titre" className="font-semibold text-foreground mb-2 flex items-center gap-2">
        <Trash2 className="h-4 w-4 text-destructive" />
        Supprimer mon compte
      </h3>
      {isAdmin ? (
        <p className="text-sm text-muted-foreground">
          Les comptes administrateurs ne peuvent pas être supprimés depuis le profil.
        </p>
      ) : (
        <>
          <p className="text-sm text-muted-foreground mb-4">
            Votre compte et vos données personnelles seront effacés définitivement. Cette action est irréversible.
          </p>
          <Button
            variant="outline"
            className="w-full gap-2 border-destructive/40 text-destructive hover:bg-destructive/10 hover:text-destructive"
            onClick={() => { setWord(""); setOpen(true); }}
          >
            <Trash2 className="h-4 w-4" />
            Supprimer mon compte
          </Button>
        </>
      )}

      <Dialog open={open} onOpenChange={(v) => !busy && setOpen(v)}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2 text-destructive">
              <AlertTriangle className="h-5 w-5" />
              Supprimer définitivement le compte ?
            </DialogTitle>
            <DialogDescription asChild>
              <div className="space-y-3 text-sm text-left">
                <p>Seront effacés :</p>
                <ul className="list-disc pl-5 space-y-1">
                  <li>votre profil et votre adresse e-mail ;</li>
                  <li>vos favoris, votre historique de lecture et vos annotations ;</li>
                  <li>vos commentaires, messages et notifications ;</li>
                  <li>vos dépôts de mémoires ;</li>
                  <li>votre abonnement Premium : les jours restants sont perdus, sans remboursement.</li>
                </ul>
                <p>
                  Les reçus de paiement sont conservés de façon anonyme pour notre comptabilité. Les ouvrages
                  déjà publiés dans la bibliothèque restent en ligne.
                </p>
              </div>
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-2">
            <label htmlFor="confirm-delete" className="text-sm font-medium">
              Pour confirmer, écrivez <span className="font-bold">SUPPRIMER</span>
            </label>
            <Input
              id="confirm-delete"
              value={word}
              onChange={(e) => setWord(e.target.value)}
              autoComplete="off"
              autoCapitalize="characters"
              disabled={busy}
            />
          </div>
          <DialogFooter className="gap-2 sm:gap-0">
            <Button variant="outline" onClick={() => setOpen(false)} disabled={busy}>
              Annuler
            </Button>
            <Button variant="destructive" className="gap-2" onClick={confirmDelete} disabled={!ready || busy}>
              {busy ? <Loader2 className="h-4 w-4 animate-spin" /> : <Trash2 className="h-4 w-4" />}
              Supprimer définitivement
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </section>
  );
}
