// Page de paiement Premium : choix de la formule, récapitulatif clair (montant, durée, dates de
// la nouvelle période) et confirmation. Le Premium n'est JAMAIS activé par cette page : il l'est
// uniquement par le serveur, après vérification du paiement auprès de Google Play ou d'OPT Gateway.
import { useMemo, useState } from "react";
import { Link, Navigate, useSearchParams } from "react-router-dom";
import { addDays, format } from "date-fns";
import { fr } from "date-fns/locale";
import { ArrowLeft, Check, CreditCard, Crown, Loader2, Lock, ShieldCheck } from "lucide-react";
import { Layout } from "@/components/layout/Layout";
import { SEO } from "@/components/seo/SEO";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { useAuth } from "@/hooks/useAuth";
import { availablePaymentProvider, formatPrice, useMySubscription } from "@/hooks/useMySubscription";

const day = (d: Date) => format(d, "d MMMM yyyy", { locale: fr });

export default function AbonnementPaiement() {
  const { user, loading } = useAuth();
  const [params, setParams] = useSearchParams();
  const { data, isLoading } = useMySubscription();
  const [accepted, setAccepted] = useState(false);
  const provider = availablePaymentProvider();

  const plans = data?.activePlans ?? [];
  const selected = useMemo(() => plans.find((p) => p.code === params.get("formule")) ?? plans[0] ?? null, [plans, params]);

  if (!loading && !user) return <Navigate to="/auth" replace />;

  // Nouvelle période : commence à la fin de l'abonnement en cours (jours restants conservés),
  // sinon maintenant — même règle que le serveur (apply_paid_period).
  const start = data?.isActive && data.expiresAt ? data.expiresAt : new Date();
  const end = selected ? addDays(start, selected.duration_days) : null;

  return (
    <Layout>
      <SEO title="Paiement Premium" description="Renouvellement de l'abonnement Premium" path="/abonnement/payer" noindex />
      <div className="container max-w-2xl py-8 md:py-12 space-y-6">
        <Link to="/profil#abonnement" className="inline-flex items-center gap-2 text-sm text-muted-foreground hover:text-foreground">
          <ArrowLeft className="h-4 w-4" /> Retour à mon abonnement
        </Link>
        <h1 className="font-serif text-2xl md:text-3xl font-bold flex items-center gap-2"><Crown className="h-7 w-7 text-amber-500" /> Abonnement Premium</h1>

        {isLoading || loading ? (
          <div className="flex justify-center py-16"><Loader2 className="h-6 w-6 animate-spin text-muted-foreground" /></div>
        ) : plans.length === 0 ? (
          <div className="rounded-xl border border-border bg-card p-6 text-center text-muted-foreground">
            Les formules Premium seront bientôt disponibles.
          </div>
        ) : (
          <>
            <fieldset className="grid gap-3 sm:grid-cols-2">
              <legend className="text-sm font-medium mb-2">1. Choisissez votre formule</legend>
              {plans.map((p) => {
                const on = selected?.id === p.id;
                return (
                  <button
                    key={p.id}
                    type="button"
                    aria-pressed={on}
                    onClick={() => { setParams({ formule: p.code }, { replace: true }); setAccepted(false); }}
                    className={`text-left rounded-xl border-2 p-4 transition ${on ? "border-amber-500 bg-amber-500/5" : "border-border hover:border-amber-500/50"}`}
                  >
                    <div className="flex items-center justify-between">
                      <span className="font-semibold">{p.name}</span>
                      {on && <Check className="h-5 w-5 text-amber-600" />}
                    </div>
                    <div className="text-2xl font-bold mt-2">{formatPrice(p.price_amount, p.currency)}</div>
                    <div className="text-sm text-muted-foreground">{p.duration_days} jours d'accès</div>
                    {p.description && <p className="text-xs text-muted-foreground mt-2">{p.description}</p>}
                  </button>
                );
              })}
            </fieldset>

            {selected && end && (
              <div className="rounded-xl border border-border bg-card p-5 space-y-3">
                <h2 className="text-sm font-medium">2. Vérifiez et confirmez</h2>
                <dl className="grid grid-cols-[auto_1fr] gap-x-4 gap-y-2 text-sm">
                  <dt className="text-muted-foreground">Formule</dt><dd className="font-medium">{selected.name}</dd>
                  <dt className="text-muted-foreground">Montant</dt><dd className="font-bold text-lg">{formatPrice(selected.price_amount, selected.currency)}</dd>
                  <dt className="text-muted-foreground">Période</dt>
                  <dd>du {day(start)} au <strong>{day(end)}</strong>{data?.isActive && !data.isUnlimited ? " (ajoutée à la fin de votre abonnement actuel)" : ""}</dd>
                  <dt className="text-muted-foreground">Compte</dt><dd className="truncate">{user?.email}</dd>
                </dl>
                <label className="flex items-start gap-2 text-sm cursor-pointer pt-2">
                  <Checkbox checked={accepted} onCheckedChange={(v) => setAccepted(v === true)} className="mt-0.5" />
                  <span>J'ai compris : paiement unique de {formatPrice(selected.price_amount, selected.currency)}, sans renouvellement automatique. Je renouvellerai moi-même si je le souhaite.</span>
                </label>

                {provider ? (
                  <Button className="w-full gap-2" disabled={!accepted} onClick={() => { /* branché aux étapes Google Play / OPT Gateway */ }}>
                    {provider === "google_play" ? <ShieldCheck className="h-4 w-4" /> : <CreditCard className="h-4 w-4" />}
                    Payer {formatPrice(selected.price_amount, selected.currency)}
                  </Button>
                ) : (
                  <div className="rounded-lg bg-muted/60 p-3 text-sm text-muted-foreground">
                    Le paiement en ligne n'est pas encore ouvert. Il sera disponible très prochainement.
                  </div>
                )}
                <p className="text-xs text-muted-foreground flex items-center gap-1"><Lock className="h-3 w-3" /> Votre abonnement est activé uniquement après confirmation du paiement par notre serveur. Aucun numéro de carte n'est conservé par KMG Bibliothèque.</p>
              </div>
            )}
          </>
        )}
      </div>
    </Layout>
  );
}
