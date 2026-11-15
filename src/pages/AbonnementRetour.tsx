// Retour après la page de paiement OPTGateway (/abonnement/retour?ref=…).
// L'adresse de retour NE prouve rien : le statut affiché vient du serveur, qui vérifie le
// paiement auprès d'OPTGateway avant d'activer le Premium.
import { useEffect, useRef, useState } from "react";
import { Link, useParams, useSearchParams } from "react-router-dom";
import { useQueryClient } from "@tanstack/react-query";
import { format } from "date-fns";
import { fr } from "date-fns/locale";
import { CheckCircle2, Clock, Loader2, XCircle } from "lucide-react";
import { Layout } from "@/components/layout/Layout";
import { SEO } from "@/components/seo/SEO";
import { Button } from "@/components/ui/button";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { formatPrice } from "@/hooks/useMySubscription";

interface StatusResponse {
  status: "succeeded" | "pending" | "failed" | "cancelled" | "refunded";
  amount: number | null;
  currency: string | null;
  plan: string | null;
  premium_expires_at: string | null;
}

const MAX_TRIES = 40; // ~2 minutes (toutes les 3 s)

export default function AbonnementRetour() {
  const [params] = useSearchParams();
  const { ref: refParam } = useParams<{ ref?: string }>();
  // /abonnement/retour/<référence>[/annule] (ou ancien format ?ref=…)
  const reference = refParam ?? params.get("ref") ?? "";
  const { user, authReady } = useAuth();
  const qc = useQueryClient();
  const [state, setState] = useState<StatusResponse | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [tries, setTries] = useState(0);
  const timer = useRef<number | null>(null);

  useEffect(() => {
    if (!authReady || !user || !reference) return;
    let stopped = false;
    const check = async (n: number) => {
      const { data, error: err } = await supabase.functions.invoke("opt-payment-status", { body: { reference } });
      if (stopped) return;
      if (err) { setError("Impossible de vérifier le paiement pour le moment."); return; }
      const r = data as StatusResponse;
      setState(r);
      setTries(n);
      if (r.status === "succeeded") {
        qc.invalidateQueries({ queryKey: ["my-subscription"] });
        qc.invalidateQueries({ queryKey: ["user-profile"] });
        qc.invalidateQueries({ queryKey: ["reading-url"] });
        return;
      }
      if (r.status === "pending" && n < MAX_TRIES) timer.current = window.setTimeout(() => check(n + 1), 3000);
    };
    void check(1);
    return () => { stopped = true; if (timer.current) window.clearTimeout(timer.current); };
  }, [authReady, user, reference, qc]);

  const status = state?.status;
  return (
    <Layout>
      <SEO title="Vérification du paiement" description="Vérification du paiement Premium" path="/abonnement/retour" noindex />
      <div className="container max-w-lg py-12 md:py-16 text-center space-y-5">
        {!reference ? (
          <p className="text-muted-foreground">Aucun paiement à vérifier.</p>
        ) : authReady && !user ? (
          <>
            <p>Connectez-vous avec le compte utilisé pour le paiement afin de voir son statut.</p>
            <Button asChild><Link to="/auth">Se connecter</Link></Button>
          </>
        ) : error ? (
          <>
            <XCircle className="h-12 w-12 mx-auto text-destructive" />
            <p>{error}</p>
            <Button asChild variant="outline"><Link to="/profil#abonnement">Voir mon abonnement</Link></Button>
          </>
        ) : status === "succeeded" ? (
          <>
            <CheckCircle2 className="h-14 w-14 mx-auto text-emerald-600" />
            <h1 className="font-serif text-2xl font-bold">Paiement confirmé</h1>
            <p className="text-muted-foreground">
              {state?.plan ? `${state.plan} — ` : ""}{formatPrice(state?.amount, state?.currency)}.
              {state?.premium_expires_at && state.premium_expires_at !== "infinity"
                ? ` Votre accès Premium est actif jusqu'au ${format(new Date(state.premium_expires_at), "d MMMM yyyy", { locale: fr })}.`
                : " Votre accès Premium est actif."}
            </p>
            <div className="flex flex-wrap justify-center gap-2">
              <Button asChild><Link to="/bibliotheque">Lire maintenant</Link></Button>
              <Button asChild variant="outline"><Link to="/profil#abonnement">Mon abonnement</Link></Button>
            </div>
          </>
        ) : status === "failed" || status === "cancelled" ? (
          <>
            <XCircle className="h-14 w-14 mx-auto text-destructive" />
            <h1 className="font-serif text-2xl font-bold">{status === "cancelled" ? "Paiement annulé" : "Paiement non abouti"}</h1>
            <p className="text-muted-foreground">Aucun montant n'a été validé pour cet abonnement. Vous pouvez réessayer.</p>
            <Button asChild><Link to="/abonnement/payer">Réessayer</Link></Button>
          </>
        ) : status === "pending" && tries >= MAX_TRIES ? (
          <>
            <Clock className="h-14 w-14 mx-auto text-amber-600" />
            <h1 className="font-serif text-2xl font-bold">Paiement en cours de traitement</h1>
            <p className="text-muted-foreground">La confirmation peut prendre quelques minutes. Votre abonnement sera activé automatiquement dès qu'elle arrivera : inutile de payer une seconde fois.</p>
            <Button asChild variant="outline"><Link to="/profil#abonnement">Voir mon abonnement</Link></Button>
          </>
        ) : (
          <>
            <Loader2 className="h-12 w-12 mx-auto animate-spin text-muted-foreground" />
            <h1 className="font-serif text-2xl font-bold">Vérification du paiement…</h1>
            <p className="text-muted-foreground">Nous confirmons votre paiement auprès de la banque. Ne fermez pas cette page.</p>
          </>
        )}
        {reference && <p className="text-xs text-muted-foreground font-mono">Référence : {reference}</p>}
      </div>
    </Layout>
  );
}
