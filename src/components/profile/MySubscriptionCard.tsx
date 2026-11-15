// Profil → « Mon abonnement » : formule, statut, dates, jours restants, historique des paiements
// et bouton « Renouveler mon abonnement ». Renouvellement manuel : rien n'est prélevé
// automatiquement.
import { Link } from "react-router-dom";
import { format } from "date-fns";
import { fr } from "date-fns/locale";
import { AlertTriangle, CalendarClock, Crown, History, RefreshCw } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Progress } from "@/components/ui/progress";
import { availablePaymentProvider, formatPrice, useMySubscription } from "@/hooks/useMySubscription";

const day = (d: Date | string | null | undefined) => (d ? format(new Date(d), "d MMMM yyyy", { locale: fr }) : "—");
const providerLabel: Record<string, string> = { google_play: "Google Play", opt_gateway: "Carte bancaire", admin: "Attribué par KMG Bibliothèque" };
const paymentStatus: Record<string, string> = { succeeded: "Confirmé", pending: "En attente", failed: "Échoué", cancelled: "Annulé", refunded: "Remboursé" };

export function MySubscriptionCard() {
  const { data, isLoading } = useMySubscription();
  if (isLoading || !data) return null;

  const provider = availablePaymentProvider();
  const canPay = !!provider && data.activePlans.length > 0;
  const hasHistory = data.periods.length > 0;
  // Rien à montrer : jamais abonné et aucune formule disponible ici.
  if (!hasHistory && !canPay) return null;

  const planById = new Map(data.plans.map((p) => [p.id, p]));
  const totalDays = data.currentPlan?.duration_days ?? 30;
  const progress = data.daysLeft != null ? Math.min(100, Math.round((data.daysLeft / Math.max(totalDays, data.daysLeft)) * 100)) : 100;
  const soon = data.isActive && data.daysLeft != null && data.daysLeft <= 7;

  return (
    <section id="abonnement" aria-labelledby="abonnement-titre" className="rounded-xl border border-border bg-card p-5 space-y-5 text-left scroll-mt-24">
      <div className="flex items-center justify-between gap-3">
        <h2 id="abonnement-titre" className="font-serif text-xl font-semibold flex items-center gap-2">
          <Crown className="h-5 w-5 text-amber-500" /> Mon abonnement
        </h2>
        {data.isActive ? (
          <Badge className="bg-amber-500 hover:bg-amber-500 text-white">Premium actif</Badge>
        ) : (
          <Badge variant="secondary">{hasHistory ? "Expiré" : "Gratuit"}</Badge>
        )}
      </div>

      {soon && (
        <div className="flex items-start gap-2 rounded-lg border border-amber-500/40 bg-amber-500/10 p-3 text-sm">
          <AlertTriangle className="h-4 w-4 text-amber-600 mt-0.5 shrink-0" />
          <span>
            {data.daysLeft === 0 ? "Votre abonnement expire aujourd'hui." : `Votre abonnement expire dans ${data.daysLeft} jour${data.daysLeft! > 1 ? "s" : ""}.`}{" "}
            Renouvelez-le pour ne pas perdre l'accès : les jours restants s'ajoutent à la nouvelle période.
          </span>
        </div>
      )}

      {data.isActive ? (
        <div className="grid gap-3 sm:grid-cols-2 text-sm">
          <Info label="Formule" value={data.currentPlan?.name ?? (data.isUnlimited ? "Premium" : "Premium")} />
          <Info label="Début" value={day(data.startedAt)} />
          <Info label="Expiration" value={data.isUnlimited ? "Sans date de fin" : day(data.expiresAt)} />
          <Info label="Jours restants" value={data.isUnlimited ? "—" : `${data.daysLeft} jour${data.daysLeft! > 1 ? "s" : ""}`} />
          {!data.isUnlimited && <Progress value={progress} className="sm:col-span-2 h-2" aria-label="Jours restants" />}
        </div>
      ) : (
        <p className="text-sm text-muted-foreground">
          {hasHistory && data.lastExpiredAt
            ? `Votre abonnement Premium a expiré le ${day(data.lastExpiredAt)}. Votre compte, votre historique de lecture et vos favoris sont conservés.`
            : "Abonnez-vous pour lire les livres réservés aux abonnés Premium."}
        </p>
      )}

      {canPay ? (
        <Button asChild className="w-full gap-2">
          <Link to="/abonnement/payer"><RefreshCw className="h-4 w-4" />{data.isActive || hasHistory ? "Renouveler mon abonnement" : "Choisir une formule"}</Link>
        </Button>
      ) : (
        hasHistory && !data.isUnlimited && (
          <p className="text-xs text-muted-foreground flex items-center gap-1">
            <CalendarClock className="h-3 w-3" /> Le renouvellement en ligne sera bientôt disponible ici.
          </p>
        )
      )}
      <p className="text-xs text-muted-foreground">Aucun renouvellement automatique : vous ne payez que lorsque vous choisissez de renouveler.</p>

      {data.payments.length > 0 && (
        <div className="space-y-2">
          <h3 className="text-sm font-semibold flex items-center gap-2"><History className="h-4 w-4" /> Historique des paiements</h3>
          <ul className="divide-y divide-border rounded-lg border border-border text-sm">
            {data.payments.map((p) => (
              <li key={p.id} className="flex flex-wrap items-center gap-2 justify-between p-3">
                <span>{day(p.confirmed_at || p.created_at)} · {p.plan_id ? planById.get(p.plan_id)?.name : "Premium"}</span>
                <span className="text-muted-foreground">{providerLabel[p.payment_provider] ?? p.payment_provider}</span>
                <span className="font-medium">{formatPrice(p.amount, p.currency)}</span>
                <Badge variant={p.status === "succeeded" ? "default" : p.status === "failed" ? "destructive" : "secondary"}>{paymentStatus[p.status] ?? p.status}</Badge>
              </li>
            ))}
          </ul>
        </div>
      )}
    </section>
  );
}

function Info({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-lg bg-muted/50 p-3">
      <div className="text-xs text-muted-foreground">{label}</div>
      <div className="font-medium text-foreground">{value}</div>
    </div>
  );
}
