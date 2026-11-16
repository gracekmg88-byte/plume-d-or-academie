// Page de paiement Premium : choix de la formule, récapitulatif clair (montant, durée, dates de
// la nouvelle période) et confirmation. Le Premium n'est JAMAIS activé par cette page : il l'est
// uniquement par le serveur, après vérification du paiement auprès de Google Play ou d'OPT Gateway.
import { useMemo, useState } from "react";
import { Capacitor } from "@capacitor/core";
import { Link, Navigate, useNavigate, useSearchParams } from "react-router-dom";
import { addDays, format } from "date-fns";
import { fr } from "date-fns/locale";
import { ArrowLeft, Check, CreditCard, Crown, Loader2, Lock, ShieldCheck, Smartphone } from "lucide-react";
import { Input } from "@/components/ui/input";
import { Layout } from "@/components/layout/Layout";
import { SEO } from "@/components/seo/SEO";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { useAuth } from "@/hooks/useAuth";
import { formatPrice, useMySubscription, usePaymentProvider } from "@/hooks/useMySubscription";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { buyWithGooglePlay, loadPlayOffers, recoverPlayPurchases, type PlayOffer } from "@/lib/google-play";

const day = (d: Date) => format(d, "d MMMM yyyy", { locale: fr });

export default function AbonnementPaiement() {
  const { user, loading } = useAuth();
  const [params, setParams] = useSearchParams();
  const { data, isLoading } = useMySubscription();
  const [accepted, setAccepted] = useState(false);
  const [starting, setStarting] = useState(false);
  // Site : carte bancaire ou mobile money (M-Pesa, Orange Money, Airtel Money) via OPTGateway.
  const [payMethod, setPayMethod] = useState<"mobile_money" | "card">("mobile_money");
  const [phone, setPhone] = useState("");
  const navigate = useNavigate();
  const phoneOk = /^(\+?243|0)?[89]\d{8}$/.test(phone.replace(/[\s.-]/g, ""));
  const { provider, adminTest } = usePaymentProvider();

  const qc = useQueryClient();
  const [playDone, setPlayDone] = useState<string | null>(null);

  // Un administrateur peut tester les formules encore désactivées (le serveur vérifie le rôle).
  const basePlans = adminTest ? (data?.plans ?? []).filter((p) => p.price_amount != null) : data?.activePlans ?? [];

  // Google Play : seules les formules dont le forfait existe réellement dans la Play Console.
  const playIds = [...new Set(basePlans.map((p) => p.google_play_product_id).filter(Boolean) as string[])];
  const { data: offers = [], isLoading: offersLoading } = useQuery({
    queryKey: ["play-offers", playIds.join(",")],
    enabled: provider === "google_play" && playIds.length > 0,
    staleTime: 5 * 60_000,
    queryFn: () => loadPlayOffers(playIds),
  });
  const offerFor = (p: { google_play_product_id: string | null; google_play_base_plan_id: string | null }): PlayOffer | undefined =>
    offers.find((o) => o.productId === p.google_play_product_id && o.basePlanId === p.google_play_base_plan_id);
  const plans = provider === "google_play" ? basePlans.filter((p) => offerFor(p)) : basePlans;

  const payWithPlay = async (offer: PlayOffer) => {
    if (!user) return;
    setStarting(true);
    try {
      const r = await buyWithGooglePlay(offer, user.id);
      if (!r.success) throw new Error(r.error || "Achat non validé.");
      qc.invalidateQueries({ queryKey: ["my-subscription"] });
      qc.invalidateQueries({ queryKey: ["user-profile"] });
      qc.invalidateQueries({ queryKey: ["reading-url"] });
      setPlayDone(r.premium_expires_at && r.premium_expires_at !== "infinity"
        ? `Votre accès Premium est actif jusqu'au ${day(new Date(r.premium_expires_at))}.`
        : "Votre accès Premium est actif.");
    } catch (e) {
      const msg = e instanceof Error ? e.message : String(e);
      // Achat abandonné dans la fenêtre Google : pas une erreur à afficher en rouge.
      if (/cancel|annul/i.test(msg)) toast.info("Achat annulé : aucun montant n'a été débité.");
      else toast.error(msg);
    } finally {
      setStarting(false);
    }
  };

  const restore = async () => {
    setStarting(true);
    const n = await recoverPlayPurchases();
    qc.invalidateQueries({ queryKey: ["my-subscription"] });
    setStarting(false);
    toast.info(n > 0 ? `${n} achat(s) récupéré(s) et validé(s).` : "Aucun achat en attente de validation.");
  };

  const startPayment = async (planCode: string) => {
    setStarting(true);
    try {
      const { data: res, error } = await supabase.functions.invoke("opt-create-checkout", {
        body: payMethod === "mobile_money" ? { plan_code: planCode, method: "mobile_money", phone } : { plan_code: planCode, method: "card" },
      });
      const r = res as { url?: string | null; reference?: string; method?: string } | null;
      if (!error && r?.method === "mobile_money" && r.reference) {
        // Mobile money : le client confirme sur son téléphone ; la page de retour suit le paiement.
        navigate(`/abonnement/retour/${encodeURIComponent(r.reference)}`, { state: { mobileMoney: true } });
        return;
      }
      if (error || !r?.url) {
        let message = "Le paiement n'a pas pu être lancé. Réessayez dans quelques instants.";
        const ctx = (error as { context?: Response } | null)?.context;
        if (ctx && typeof ctx.json === "function") { try { message = (await ctx.json())?.error || message; } catch { /* corps illisible */ } }
        throw new Error(message);
      }
      // Redirection vers la page sécurisée OPTGateway (saisie de la carte chez le prestataire).
      window.location.href = (res as { url: string }).url;
    } catch (e) {
      toast.error(e instanceof Error ? e.message : String(e));
      setStarting(false);
    }
  };
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

        {playDone ? (
          <div className="rounded-xl border border-emerald-500/40 bg-emerald-500/5 p-6 text-center space-y-3">
            <Check className="h-10 w-10 mx-auto text-emerald-600" />
            <p className="font-semibold">Paiement confirmé</p>
            <p className="text-sm text-muted-foreground">{playDone}</p>
            <div className="flex flex-wrap justify-center gap-2">
              <Button asChild><Link to="/bibliotheque">Lire maintenant</Link></Button>
              <Button asChild variant="outline"><Link to="/profil#abonnement">Mon abonnement</Link></Button>
            </div>
          </div>
        ) : isLoading || loading || (provider === "google_play" && offersLoading) ? (
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
                    <div className="text-2xl font-bold mt-2">{provider === "google_play" ? offerFor(p)?.priceString : formatPrice(p.price_amount, p.currency)}</div>
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
                  <dt className="text-muted-foreground">Montant</dt><dd className="font-bold text-lg">{provider === "google_play" ? offerFor(selected)?.priceString : formatPrice(selected.price_amount, selected.currency)}</dd>
                  <dt className="text-muted-foreground">Période</dt>
                  <dd>du {day(start)} au <strong>{day(end)}</strong>{data?.isActive && !data.isUnlimited ? " (ajoutée à la fin de votre abonnement actuel)" : ""}</dd>
                  <dt className="text-muted-foreground">Compte</dt><dd className="truncate">{user?.email}</dd>
                </dl>
                <label className="flex items-start gap-2 text-sm cursor-pointer pt-2">
                  <Checkbox checked={accepted} onCheckedChange={(v) => setAccepted(v === true)} className="mt-0.5" />
                  <span>J'ai compris : paiement unique de {provider === "google_play" ? offerFor(selected)?.priceString : formatPrice(selected.price_amount, selected.currency)}, sans renouvellement automatique. Je renouvellerai moi-même si je le souhaite.</span>
                </label>

                {provider === "opt_gateway" ? (
                  <>
                    {adminTest && (
                      <p className="rounded-lg border border-amber-500/40 bg-amber-500/5 p-2 text-xs">
                        Mode administrateur : le paiement par carte n'est pas encore ouvert aux clients. Avec une clé de test, aucun argent réel n'est débité.
                      </p>
                    )}
                    <div className="grid grid-cols-2 gap-2" role="radiogroup" aria-label="Moyen de paiement">
                      {([
                        { v: "mobile_money" as const, icon: Smartphone, label: "Mobile money", sub: "M-Pesa · Orange · Airtel" },
                        { v: "card" as const, icon: CreditCard, label: "Carte bancaire", sub: "Visa · Mastercard" },
                      ]).map((m) => (
                        <button
                          key={m.v}
                          type="button"
                          role="radio"
                          aria-checked={payMethod === m.v}
                          onClick={() => setPayMethod(m.v)}
                          className={`rounded-lg border-2 p-3 text-left transition ${payMethod === m.v ? "border-amber-500 bg-amber-500/5" : "border-border hover:border-amber-500/50"}`}
                        >
                          <m.icon className="h-5 w-5 mb-1 text-amber-600" />
                          <div className="text-sm font-semibold">{m.label}</div>
                          <div className="text-[11px] text-muted-foreground">{m.sub}</div>
                        </button>
                      ))}
                    </div>
                    {payMethod === "mobile_money" ? (
                      <>
                        <label className="block text-sm font-medium" htmlFor="mm-phone">Numéro mobile money (RDC)</label>
                        <Input
                          id="mm-phone"
                          type="tel"
                          inputMode="tel"
                          autoComplete="tel"
                          placeholder="Ex. 0812345678"
                          value={phone}
                          onChange={(e) => setPhone(e.target.value)}
                        />
                        <Button className="w-full gap-2" disabled={!accepted || starting || !phoneOk} onClick={() => startPayment(selected.code)}>
                          {starting ? <Loader2 className="h-4 w-4 animate-spin" /> : <Smartphone className="h-4 w-4" />}
                          Payer {formatPrice(selected.price_amount, selected.currency)} par mobile money
                        </Button>
                        <p className="text-xs text-muted-foreground text-center">Vous recevrez une demande de paiement sur ce téléphone : confirmez-la avec votre code PIN. Des frais de l'opérateur peuvent s'ajouter.</p>
                      </>
                    ) : (
                      <>
                        <Button className="w-full gap-2" disabled={!accepted || starting} onClick={() => startPayment(selected.code)}>
                          {starting ? <Loader2 className="h-4 w-4 animate-spin" /> : <CreditCard className="h-4 w-4" />}
                          Payer {formatPrice(selected.price_amount, selected.currency)} par carte
                        </Button>
                        <p className="text-xs text-muted-foreground text-center">Visa ou Mastercard — vous saisirez votre carte sur la page sécurisée de notre prestataire.</p>
                      </>
                    )}
                  </>
                ) : provider === "google_play" && offerFor(selected) ? (
                  <>
                    {adminTest && (
                      <p className="rounded-lg border border-amber-500/40 bg-amber-500/5 p-2 text-xs">
                        Mode administrateur : le paiement Google Play n'est pas encore ouvert aux clients. Avec un compte « testeur de licence », l'achat est gratuit.
                      </p>
                    )}
                    <Button className="w-full gap-2" disabled={!accepted || starting} onClick={() => payWithPlay(offerFor(selected)!)}>
                      {starting ? <Loader2 className="h-4 w-4 animate-spin" /> : <ShieldCheck className="h-4 w-4" />}
                      Payer {offerFor(selected)!.priceString} avec Google Play
                    </Button>
                    <button type="button" className="w-full text-xs text-muted-foreground underline" disabled={starting} onClick={restore}>
                      Achat déjà effectué ? Récupérer mes achats Google Play
                    </button>
                  </>
                ) : (
                  <div className="rounded-lg bg-muted/60 p-3 text-sm text-muted-foreground space-y-2">
                    {Capacitor.isNativePlatform() ? (
                      <p>Le paiement n'est pas encore ouvert dans l'application. Il sera disponible très prochainement.</p>
                    ) : (
                      <>
                        <p>Le paiement par carte sur le site sera ouvert très prochainement. Vous pouvez dès maintenant vous abonner depuis l'application Android (paiement sécurisé Google Play), avec le même compte.</p>
                        <Button asChild variant="outline" size="sm" className="w-full">
                          <a href="https://play.google.com/store/apps/details?id=app.lovable.d11bc5d4512e4b5f9f8a79e7ee7ad869" target="_blank" rel="noopener noreferrer">
                            Ouvrir l'application sur Google Play
                          </a>
                        </Button>
                      </>
                    )}
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
