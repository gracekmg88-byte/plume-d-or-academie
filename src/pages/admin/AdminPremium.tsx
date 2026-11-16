// Espace admin — Abonnement Premium (renouvellement manuel).
// Formules et prix, abonnés, abonnements expirés, paiements, erreurs de paiement,
// livres réservés aux abonnés et réglage d'activation du contrôle Premium.
// Toutes les écritures sensibles passent par des fonctions serveur qui vérifient le rôle admin.
import { useMemo, useState } from "react";
import { BACK_TO_DASHBOARD_STATE } from "@/lib/admin-nav";
import { Link } from "react-router-dom";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { format, differenceInCalendarDays } from "date-fns";
import { fr } from "date-fns/locale";
import { AlertTriangle, ArrowLeft, Crown, Loader2, Lock, Pencil, Plus, Search, Unlock } from "lucide-react";
import { toast } from "sonner";
import { Layout } from "@/components/layout/Layout";
import { SEO } from "@/components/seo/SEO";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Switch } from "@/components/ui/switch";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { supabase } from "@/integrations/supabase/client";
import { useAdminUsers } from "@/hooks/useSubscription";
import {
  type AdminSubscription,
  type SubscriptionPlan,
  useAdminPaymentEvents,
  useAdminPayments,
  useAdminSubscriptions,
  useGrantPremium,
  useReminderSettings,
  useReminders,
  useRunReminders,
  useSetReminderSetting,
  type ReminderRunResult,
  usePlans,
  usePremiumEnforced,
  useRevokePremium,
  useSavePlan,
  useSetPremiumEnforced,
  useSetPublicationAccess,
} from "@/hooks/usePremium";

const fmt = (d: string | null | undefined) => (d ? format(new Date(d), "d MMM yyyy à HH:mm", { locale: fr }) : "—");
const fmtDay = (d: string | null | undefined) => (d ? format(new Date(d), "d MMM yyyy", { locale: fr }) : "—");
const money = (v: number | null | undefined, cur?: string | null) =>
  v == null ? "—" : `${Number(v).toLocaleString("fr-FR", { minimumFractionDigits: 0, maximumFractionDigits: 2 })} ${cur || ""}`.trim();
const providerLabel: Record<string, string> = { google_play: "Google Play", opt_gateway: "Carte (OPT Gateway)", admin: "Attribué par l'admin" };
const errMsg = (e: unknown) => (e instanceof Error ? e.message : (e as { message?: string })?.message || String(e));

export default function AdminPremium() {
  return (
    <Layout>
      <SEO title="Abonnement Premium" description="Gestion des abonnements Premium" path="/admin/premium" noindex />
      <div className="container py-8 md:py-12 space-y-6">
        <Link to="/admin/dashboard" state={BACK_TO_DASHBOARD_STATE} className="inline-flex items-center gap-2 text-sm text-muted-foreground hover:text-foreground">
          <ArrowLeft className="h-4 w-4" /> Retour au tableau de bord
        </Link>
        <div className="flex items-center gap-3">
          <Crown className="h-8 w-8 text-amber-500" />
          <div>
            <h1 className="font-serif text-2xl md:text-3xl font-bold">Abonnement Premium</h1>
            <p className="text-sm text-muted-foreground">Renouvellement manuel : aucun prélèvement automatique.</p>
          </div>
        </div>

        <Tabs defaultValue="abonnes" className="space-y-4">
          <TabsList className="flex flex-wrap h-auto gap-1">
            <TabsTrigger value="abonnes">Abonnés</TabsTrigger>
            <TabsTrigger value="expires">Expirés</TabsTrigger>
            <TabsTrigger value="paiements">Paiements</TabsTrigger>
            <TabsTrigger value="erreurs">Erreurs</TabsTrigger>
            <TabsTrigger value="notifications">Notifications</TabsTrigger>
            <TabsTrigger value="formules">Formules & prix</TabsTrigger>
            <TabsTrigger value="livres">Livres Premium</TabsTrigger>
            <TabsTrigger value="reglages">Réglages</TabsTrigger>
          </TabsList>
          <TabsContent value="abonnes"><SubscribersTab /></TabsContent>
          <TabsContent value="expires"><ExpiredTab /></TabsContent>
          <TabsContent value="paiements"><PaymentsTab /></TabsContent>
          <TabsContent value="erreurs"><ErrorsTab /></TabsContent>
          <TabsContent value="notifications"><RemindersTab /></TabsContent>
          <TabsContent value="formules"><PlansTab /></TabsContent>
          <TabsContent value="livres"><BooksTab /></TabsContent>
          <TabsContent value="reglages"><SettingsTab /></TabsContent>
        </Tabs>
      </div>
    </Layout>
  );
}

// ─── Abonnés actifs ─────────────────────────────────────────────────────────────────────
interface ActiveRow {
  user_id: string;
  email: string | null;
  full_name: string | null;
  started_at: string;
  expires_at: string | null; // null = sans date de fin
  periods: AdminSubscription[];
}

function useActiveSubscribers() {
  const { data: subs = [], isLoading } = useAdminSubscriptions();
  const rows = useMemo<ActiveRow[]>(() => {
    const now = Date.now();
    const map = new Map<string, ActiveRow>();
    for (const s of subs) {
      if (s.status !== "active") continue;
      if (s.expires_at && new Date(s.expires_at).getTime() <= now) continue;
      const r = map.get(s.user_id) ?? { user_id: s.user_id, email: s.email, full_name: s.full_name, started_at: s.started_at, expires_at: s.expires_at, periods: [] };
      r.periods.push(s);
      if (new Date(s.started_at) < new Date(r.started_at)) r.started_at = s.started_at;
      if (r.expires_at !== null) r.expires_at = s.expires_at === null ? null : (new Date(s.expires_at) > new Date(r.expires_at) ? s.expires_at : r.expires_at);
      map.set(s.user_id, r);
    }
    return [...map.values()].sort((a, b) => (a.expires_at ?? "9999").localeCompare(b.expires_at ?? "9999"));
  }, [subs]);
  return { rows, isLoading, subs };
}

function SubscribersTab() {
  const { rows, isLoading } = useActiveSubscribers();
  const grant = useGrantPremium();
  const revoke = useRevokePremium();
  const [q, setQ] = useState("");
  const [grantOpen, setGrantOpen] = useState(false);
  const [confirmRevoke, setConfirmRevoke] = useState<string | null>(null);

  const filtered = rows.filter((r) => !q.trim() || `${r.email} ${r.full_name}`.toLowerCase().includes(q.trim().toLowerCase()));

  const extend = async (userId: string, days: number) => {
    try {
      await grant.mutateAsync({ userId, days, note: `Prolongation admin de ${days} jours` });
      toast.success(`Abonnement prolongé de ${days} jours`);
    } catch (e) { toast.error("Échec", { description: errMsg(e) }); }
  };
  const doRevoke = async (userId: string) => {
    try {
      await revoke.mutateAsync({ userId, note: "Retrait depuis Admin → Premium" });
      toast.success("Premium retiré");
      setConfirmRevoke(null);
    } catch (e) { toast.error("Échec", { description: errMsg(e) }); }
  };

  return (
    <div className="space-y-4">
      <div className="flex flex-col sm:flex-row gap-3 justify-between">
        <div className="relative flex-1 max-w-md">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input className="pl-9" placeholder="Rechercher un abonné…" value={q} onChange={(e) => setQ(e.target.value)} />
        </div>
        <Button onClick={() => setGrantOpen(true)}><Plus className="h-4 w-4 mr-1" /> Attribuer le Premium</Button>
      </div>
      <p className="text-sm text-muted-foreground">{rows.length} abonné{rows.length > 1 ? "s" : ""} Premium actif{rows.length > 1 ? "s" : ""}.</p>
      {isLoading ? <Spinner /> : (
        <div className="grid grid-cols-1 gap-3">
          {filtered.map((r) => {
            const left = r.expires_at ? differenceInCalendarDays(new Date(r.expires_at), new Date()) : null;
            const providers = [...new Set(r.periods.map((p) => providerLabel[p.payment_provider]))].join(", ");
            return (
              <div key={r.user_id} className="rounded-xl border border-border bg-card p-4 flex flex-col md:flex-row md:items-center gap-3">
                <div className="flex-1 min-w-0">
                  <div className="font-semibold truncate">{r.full_name || r.email || r.user_id}</div>
                  <div className="text-xs text-muted-foreground truncate">{r.email}</div>
                  <div className="text-xs text-muted-foreground mt-1">
                    Depuis le {fmtDay(r.started_at)} · {r.expires_at ? <>jusqu'au <strong>{fmtDay(r.expires_at)}</strong> ({left} j restants)</> : <strong>sans date de fin</strong>} · {providers}
                  </div>
                </div>
                {left !== null && left <= 7 && <Badge variant="destructive">Expire bientôt</Badge>}
                <div className="flex flex-wrap gap-2">
                  <Button size="sm" variant="outline" disabled={grant.isPending} onClick={() => extend(r.user_id, 30)}>+30 j</Button>
                  <Button size="sm" variant="outline" disabled={grant.isPending} onClick={() => extend(r.user_id, 365)}>+365 j</Button>
                  {confirmRevoke === r.user_id ? (
                    <>
                      <Button size="sm" variant="destructive" disabled={revoke.isPending} onClick={() => doRevoke(r.user_id)}>Confirmer le retrait</Button>
                      <Button size="sm" variant="ghost" onClick={() => setConfirmRevoke(null)}>Annuler</Button>
                    </>
                  ) : (
                    <Button size="sm" variant="ghost" className="text-destructive" onClick={() => setConfirmRevoke(r.user_id)}>Retirer</Button>
                  )}
                </div>
              </div>
            );
          })}
          {filtered.length === 0 && <Empty text="Aucun abonné Premium actif." />}
        </div>
      )}
      {grantOpen && <GrantDialog onClose={() => setGrantOpen(false)} />}
    </div>
  );
}

function GrantDialog({ onClose }: { onClose: () => void }) {
  const { users = [] } = useAdminUsers();
  const grant = useGrantPremium();
  const [q, setQ] = useState("");
  const [userId, setUserId] = useState<string | null>(null);
  const [days, setDays] = useState("30");
  const [unlimited, setUnlimited] = useState(false);
  const [note, setNote] = useState("");
  const matches = users.filter((u) => q.trim().length >= 2 && `${u.email} ${u.full_name ?? ""}`.toLowerCase().includes(q.trim().toLowerCase())).slice(0, 8);
  const chosen = users.find((u) => u.user_id === userId);

  const submit = async () => {
    if (!userId) return;
    const n = unlimited ? null : Number(days);
    if (n !== null && (!Number.isInteger(n) || n < 1 || n > 3660)) { toast.error("Durée invalide (1 à 3660 jours)"); return; }
    try {
      await grant.mutateAsync({ userId, days: n, note: note || "Attribution admin" });
      toast.success("Premium attribué");
      onClose();
    } catch (e) { toast.error("Échec", { description: errMsg(e) }); }
  };

  return (
    <Dialog open onOpenChange={(o) => { if (!o) onClose(); }}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Attribuer le Premium</DialogTitle>
          <DialogDescription>Ajoute une période à l'abonnement du compte (les jours restants sont conservés).</DialogDescription>
        </DialogHeader>
        <div className="space-y-4">
          <div className="space-y-2">
            <Label>Compte</Label>
            {chosen ? (
              <div className="flex items-center justify-between rounded-md border p-2 text-sm">
                <span className="truncate">{chosen.full_name ? `${chosen.full_name} · ` : ""}{chosen.email}</span>
                <Button size="sm" variant="ghost" onClick={() => setUserId(null)}>Changer</Button>
              </div>
            ) : (
              <>
                <Input placeholder="E-mail ou nom (2 lettres minimum)" value={q} onChange={(e) => setQ(e.target.value)} />
                <div className="grid gap-1">
                  {matches.map((u) => (
                    <button key={u.user_id} type="button" className="text-left text-sm rounded px-2 py-1 hover:bg-muted" onClick={() => setUserId(u.user_id)}>
                      {u.full_name ? `${u.full_name} · ` : ""}{u.email}
                    </button>
                  ))}
                </div>
              </>
            )}
          </div>
          <div className="flex items-center gap-3">
            <Switch checked={unlimited} onCheckedChange={setUnlimited} id="unl" />
            <Label htmlFor="unl">Sans date de fin</Label>
          </div>
          {!unlimited && (
            <div className="space-y-2">
              <Label htmlFor="days">Durée (jours)</Label>
              <Input id="days" type="number" min={1} max={3660} value={days} onChange={(e) => setDays(e.target.value)} />
            </div>
          )}
          <div className="space-y-2">
            <Label htmlFor="note">Motif (facultatif)</Label>
            <Input id="note" maxLength={300} value={note} onChange={(e) => setNote(e.target.value)} placeholder="Ex. paiement reçu par Mobile Money" />
          </div>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={onClose}>Annuler</Button>
          <Button disabled={!userId || grant.isPending} onClick={submit}>{grant.isPending && <Loader2 className="h-4 w-4 mr-1 animate-spin" />}Attribuer</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

// ─── Abonnements expirés ou retirés ─────────────────────────────────────────────────────
function ExpiredTab() {
  const { rows: active, subs, isLoading } = useActiveSubscribers();
  const activeIds = new Set(active.map((r) => r.user_id));
  // Dernière période de chaque compte qui n'a plus d'abonnement actif.
  const last = new Map<string, AdminSubscription>();
  for (const s of subs) {
    if (activeIds.has(s.user_id)) continue;
    const prev = last.get(s.user_id);
    if (!prev || (s.expires_at ?? s.updated_at) > (prev.expires_at ?? prev.updated_at)) last.set(s.user_id, s);
  }
  const rows = [...last.values()].sort((a, b) => (b.expires_at ?? b.updated_at).localeCompare(a.expires_at ?? a.updated_at));
  if (isLoading) return <Spinner />;
  return (
    <div className="grid grid-cols-1 gap-3">
      {rows.map((s) => (
        <div key={s.id} className="rounded-xl border border-border bg-card p-4 flex flex-col sm:flex-row sm:items-center gap-2">
          <div className="flex-1 min-w-0">
            <div className="font-semibold truncate">{s.full_name || s.email}</div>
            <div className="text-xs text-muted-foreground">{s.email} · {s.plan_name || providerLabel[s.payment_provider]}</div>
          </div>
          <div className="text-sm text-muted-foreground">{s.status === "revoked" ? "Retiré" : "Expiré"} le {fmtDay(s.status === "revoked" ? s.updated_at : s.expires_at)}</div>
        </div>
      ))}
      {rows.length === 0 && <Empty text="Aucun abonnement expiré." />}
    </div>
  );
}

// ─── Paiements ──────────────────────────────────────────────────────────────────────────
const statusBadge: Record<string, { label: string; variant: "default" | "secondary" | "destructive" | "outline" }> = {
  succeeded: { label: "Confirmé", variant: "default" },
  pending: { label: "En attente", variant: "secondary" },
  failed: { label: "Échoué", variant: "destructive" },
  cancelled: { label: "Annulé", variant: "outline" },
  refunded: { label: "Remboursé", variant: "outline" },
};

function PaymentsTab() {
  const { data = [], isLoading } = useAdminPayments();
  const { data: plans = [] } = usePlans();
  const planName = new Map(plans.map((p) => [p.id, p.name]));
  if (isLoading) return <Spinner />;
  return (
    <div className="grid grid-cols-1 gap-2">
      {data.map((p) => (
        <div key={p.id} className="rounded-lg border border-border bg-card p-3 flex flex-col md:flex-row md:items-center gap-2 text-sm">
          <Badge variant={statusBadge[p.status]?.variant ?? "outline"}>{statusBadge[p.status]?.label ?? p.status}</Badge>
          <div className="flex-1 min-w-0 truncate">{p.email} · {p.plan_id ? planName.get(p.plan_id) : "—"}</div>
          <div className="font-semibold">{money(p.amount, p.currency)}</div>
          <div className="text-muted-foreground">{providerLabel[p.payment_provider]}</div>
          <div className="text-muted-foreground">{fmt(p.confirmed_at || p.created_at)}</div>
          <div className="text-xs text-muted-foreground font-mono truncate max-w-[14rem]" title={p.provider_reference}>{p.provider_reference}</div>
        </div>
      ))}
      {data.length === 0 && <Empty text="Aucun paiement pour l'instant. Ils apparaîtront ici dès que Google Play et le paiement par carte seront branchés." />}
    </div>
  );
}

function ErrorsTab() {
  const { data: payments = [], isLoading: l1 } = useAdminPayments();
  const { data: events = [], isLoading: l2 } = useAdminPaymentEvents();
  const failed = payments.filter((p) => p.status === "failed");
  const badEvents = events.filter((e) => e.processing_error || e.signature_valid === false);
  if (l1 || l2) return <Spinner />;
  return (
    <div className="space-y-6">
      <section className="space-y-2">
        <h3 className="font-semibold">Paiements échoués ({failed.length})</h3>
        {failed.map((p) => (
          <div key={p.id} className="rounded-lg border border-destructive/30 bg-destructive/5 p-3 text-sm">
            <div className="flex flex-wrap gap-2 justify-between"><span>{p.email} · {providerLabel[p.payment_provider]}</span><span className="text-muted-foreground">{fmt(p.created_at)}</span></div>
            <div className="text-destructive mt-1">{p.failure_reason || "Motif non communiqué"}</div>
          </div>
        ))}
        {failed.length === 0 && <Empty text="Aucun paiement échoué." />}
      </section>
      <section className="space-y-2">
        <h3 className="font-semibold">Notifications de paiement rejetées ou en erreur ({badEvents.length})</h3>
        {badEvents.map((e) => (
          <div key={e.id} className="rounded-lg border border-amber-500/30 bg-amber-500/5 p-3 text-sm">
            <div className="flex flex-wrap gap-2 justify-between"><span>{providerLabel[e.payment_provider]} · {e.event_type || "événement"}</span><span className="text-muted-foreground">{fmt(e.received_at)}</span></div>
            <div className="mt-1">{e.signature_valid === false ? "Signature invalide (notification ignorée)" : e.processing_error}</div>
          </div>
        ))}
        {badEvents.length === 0 && <Empty text="Aucune erreur." />}
      </section>
    </div>
  );
}

// ─── Formules et prix ───────────────────────────────────────────────────────────────────
function PlansTab() {
  const { data: plans = [], isLoading } = usePlans();
  const [editing, setEditing] = useState<Partial<SubscriptionPlan> | null>(null);
  if (isLoading) return <Spinner />;
  return (
    <div className="space-y-4">
      <div className="flex justify-between items-center">
        <p className="text-sm text-muted-foreground">Une formule n'est proposée aux clients que si elle est active (un prix est alors obligatoire).</p>
        <Button size="sm" onClick={() => setEditing({ code: "", name: "", duration_days: 30, currency: "USD", is_active: false, sort_order: plans.length + 1 })}>
          <Plus className="h-4 w-4 mr-1" /> Nouvelle formule
        </Button>
      </div>
      <div className="grid gap-3 md:grid-cols-2">
        {plans.map((p) => (
          <div key={p.id} className="rounded-xl border border-border bg-card p-4 space-y-2">
            <div className="flex items-center justify-between gap-2">
              <div className="font-semibold">{p.name}</div>
              <Badge variant={p.is_active ? "default" : "secondary"}>{p.is_active ? "Proposée" : "Désactivée"}</Badge>
            </div>
            <div className="text-2xl font-bold">{money(p.price_amount, p.currency)}</div>
            <div className="text-sm text-muted-foreground">{p.duration_days} jours · code {p.code}</div>
            <div className="text-xs text-muted-foreground">Google Play : {p.google_play_product_id ? `${p.google_play_product_id} / ${p.google_play_base_plan_id ?? "?"}` : "non configuré"}</div>
            <Button size="sm" variant="outline" onClick={() => setEditing(p)}><Pencil className="h-4 w-4 mr-1" /> Modifier</Button>
          </div>
        ))}
      </div>
      {editing && <PlanDialog plan={editing} onClose={() => setEditing(null)} />}
    </div>
  );
}

function PlanDialog({ plan, onClose }: { plan: Partial<SubscriptionPlan>; onClose: () => void }) {
  const save = useSavePlan();
  const [f, setF] = useState({
    code: plan.code ?? "",
    name: plan.name ?? "",
    description: plan.description ?? "",
    duration_days: String(plan.duration_days ?? 30),
    price_amount: plan.price_amount == null ? "" : String(plan.price_amount),
    currency: plan.currency ?? "USD",
    google_play_product_id: plan.google_play_product_id ?? "",
    google_play_base_plan_id: plan.google_play_base_plan_id ?? "",
    is_active: plan.is_active ?? false,
    sort_order: String(plan.sort_order ?? 0),
  });
  const set = (k: keyof typeof f, v: string | boolean) => setF((x) => ({ ...x, [k]: v }));

  const submit = async () => {
    const price = f.price_amount.trim() === "" ? null : Number(f.price_amount.replace(",", "."));
    const days = Number(f.duration_days);
    if (!plan.id && !/^[a-z0-9_]{2,40}$/.test(f.code)) return toast.error("Code : lettres minuscules, chiffres et _ (2 à 40)");
    if (!f.name.trim()) return toast.error("Nom obligatoire");
    if (!Number.isInteger(days) || days < 1 || days > 3660) return toast.error("Durée invalide (1 à 3660 jours)");
    if (price !== null && (!Number.isFinite(price) || price < 0)) return toast.error("Prix invalide");
    if (f.is_active && price === null) return toast.error("Indiquez un prix avant d'activer la formule");
    if (!/^[A-Z]{3}$/.test(f.currency.toUpperCase())) return toast.error("Devise : code à 3 lettres (USD, CDF, EUR…)");
    try {
      await save.mutateAsync({
        id: plan.id,
        ...(plan.id ? {} : { code: f.code }),
        name: f.name.trim(),
        description: f.description.trim() || null,
        duration_days: days,
        price_amount: price,
        currency: f.currency.toUpperCase(),
        google_play_product_id: f.google_play_product_id.trim() || null,
        google_play_base_plan_id: f.google_play_base_plan_id.trim() || null,
        is_active: f.is_active,
        sort_order: Number(f.sort_order) || 0,
      });
      toast.success("Formule enregistrée");
      onClose();
    } catch (e) { toast.error("Enregistrement impossible", { description: errMsg(e) }); }
  };

  return (
    <Dialog open onOpenChange={(o) => { if (!o) onClose(); }}>
      <DialogContent className="max-w-lg max-h-[90vh] overflow-y-auto">
        <DialogHeader><DialogTitle>{plan.id ? "Modifier la formule" : "Nouvelle formule"}</DialogTitle></DialogHeader>
        <div className="grid grid-cols-1 gap-3">
          {!plan.id && <Field label="Code interne" value={f.code} onChange={(v) => set("code", v.toLowerCase())} placeholder="premium_trimestriel" />}
          <Field label="Nom affiché" value={f.name} onChange={(v) => set("name", v)} />
          <div className="space-y-1"><Label>Description</Label><Textarea rows={2} value={f.description} onChange={(e) => set("description", e.target.value)} /></div>
          <div className="grid grid-cols-3 gap-2">
            <Field label="Durée (jours)" value={f.duration_days} onChange={(v) => set("duration_days", v)} type="number" />
            <Field label="Prix" value={f.price_amount} onChange={(v) => set("price_amount", v)} placeholder="5" />
            <Field label="Devise" value={f.currency} onChange={(v) => set("currency", v.toUpperCase())} />
          </div>
          <Field label="Google Play : identifiant du produit" value={f.google_play_product_id} onChange={(v) => set("google_play_product_id", v)} placeholder="kmg_premium" />
          <Field label="Google Play : identifiant du forfait prépayé" value={f.google_play_base_plan_id} onChange={(v) => set("google_play_base_plan_id", v)} placeholder="mensuel-prepaye" />
          <Field label="Ordre d'affichage" value={f.sort_order} onChange={(v) => set("sort_order", v)} type="number" />
          <div className="flex items-center gap-3"><Switch id="act" checked={f.is_active} onCheckedChange={(v) => set("is_active", v)} /><Label htmlFor="act">Proposer cette formule aux clients</Label></div>
          <p className="text-xs text-muted-foreground">Sur Android, le prix payé est celui configuré dans la Play Console (Google l'affiche dans la devise du client).</p>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={onClose}>Annuler</Button>
          <Button disabled={save.isPending} onClick={submit}>{save.isPending && <Loader2 className="h-4 w-4 mr-1 animate-spin" />}Enregistrer</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

// ─── Livres réservés aux abonnés ────────────────────────────────────────────────────────
function BooksTab() {
  const setAccess = useSetPublicationAccess();
  const [q, setQ] = useState("");
  const [busyId, setBusyId] = useState<string | null>(null);
  const { data: pubs = [], isLoading, error: loadError, refetch } = useQuery({
    queryKey: ["admin-premium-publications"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("publications")
        .select("id,title,author,category,access_level,file_url,premium_file_path,is_published")
        .order("title");
      if (error) throw error;
      return data;
    },
  });
  const filtered = pubs.filter((p) => !q.trim() || `${p.title} ${p.author}`.toLowerCase().includes(q.trim().toLowerCase()));
  const premiumCount = pubs.filter((p) => p.access_level === "premium").length;

  const toggle = async (id: string, premium: boolean) => {
    setBusyId(id);
    try {
      await setAccess.mutateAsync({ publicationId: id, accessLevel: premium ? "premium" : "free" });
      toast.success(premium ? "Réservé aux abonnés : PDF déplacé dans le stockage privé" : "Redevenu gratuit : PDF de nouveau public");
    } catch (e) { toast.error("Changement impossible", { description: errMsg(e) }); }
    finally { setBusyId(null); }
  };

  return (
    <div className="space-y-4">
      <div className="rounded-lg border border-amber-500/40 bg-amber-500/5 p-3 text-sm space-y-1">
        <p className="font-medium">
          Pour réserver un livre aux abonnés : appuyez sur « Réserver aux abonnés » à côté du livre.
        </p>
        <p className="text-muted-foreground">
          {premiumCount} publication{premiumCount > 1 ? "s" : ""} réservée{premiumCount > 1 ? "s" : ""} aux abonnés. Les non-abonnés ne
          peuvent plus lire un livre réservé : son PDF est déplacé dans un stockage privé, lisible seulement par un lien temporaire délivré
          par le serveur aux abonnés. « Rendre gratuit » annule l'opération.
        </p>
      </div>
      <div className="relative max-w-md">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
        <Input className="pl-9" placeholder="Rechercher une publication…" value={q} onChange={(e) => setQ(e.target.value)} />
      </div>
      {isLoading ? <Spinner /> : loadError ? (
        <div className="rounded-lg border border-destructive/40 bg-destructive/5 p-4 text-sm space-y-2">
          <p className="font-medium">La liste des livres n'a pas pu être chargée.</p>
          <p className="text-muted-foreground">{errMsg(loadError)}</p>
          <Button size="sm" variant="outline" onClick={() => refetch()}>Réessayer</Button>
        </div>
      ) : (
        <div className="grid grid-cols-1 gap-2">
          {filtered.map((p) => {
            const premium = p.access_level === "premium";
            return (
              <div key={p.id} className={`min-w-0 rounded-lg border p-3 flex flex-wrap sm:flex-nowrap items-center gap-3 ${premium ? "border-amber-500/50 bg-amber-500/5" : "border-border bg-card"}`}>
                {premium ? <Lock className="h-4 w-4 text-amber-600 shrink-0" /> : <Unlock className="h-4 w-4 text-muted-foreground shrink-0" />}
                <div className="flex-1 min-w-0">
                  <div className="font-medium truncate">{p.title}</div>
                  <div className="text-xs text-muted-foreground truncate">{p.author} · {p.category}{!p.is_published ? " · non publiée" : ""}</div>
                </div>
                <div className="flex items-center gap-2 w-full sm:w-auto justify-end">
                  <span className={`text-xs font-medium ${premium ? "text-amber-700 dark:text-amber-400" : "text-muted-foreground"}`}>
                    {premium ? "Réservé aux abonnés" : "Gratuit"}
                  </span>
                  {!p.file_url && !p.premium_file_path ? (
                    <span className="text-xs text-muted-foreground">(aucun PDF)</span>
                  ) : (
                    <Button
                      size="sm"
                      variant={premium ? "outline" : "default"}
                      className="gap-1.5"
                      disabled={!!busyId}
                      onClick={() => toggle(p.id, !premium)}
                    >
                      {busyId === p.id ? <Loader2 className="h-4 w-4 animate-spin" /> : premium ? <Unlock className="h-4 w-4" /> : <Lock className="h-4 w-4" />}
                      {premium ? "Rendre gratuit" : "Réserver aux abonnés"}
                    </Button>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}

// ─── Réglages ───────────────────────────────────────────────────────────────────────────
function SettingsTab() {
  const { data: enforced, isLoading } = usePremiumEnforced();
  const setEnforced = useSetPremiumEnforced();
  const [confirm, setConfirm] = useState(false);
  const apply = async (v: boolean) => {
    try {
      await setEnforced.mutateAsync(v);
      toast.success(v ? "Contrôle Premium activé" : "Contrôle Premium désactivé : tout le monde peut lire");
      setConfirm(false);
    } catch (e) { toast.error("Échec", { description: errMsg(e) }); }
  };
  if (isLoading) return <Spinner />;
  return (
    <div className="space-y-6 max-w-2xl">
      <div className="rounded-xl border border-border bg-card p-5 space-y-3">
        <div className="flex items-center justify-between gap-4">
          <div>
            <div className="font-semibold">Réserver les livres Premium aux abonnés</div>
            <div className="text-sm text-muted-foreground">
              Désactivé : tout le monde lit tout, comme aujourd'hui. Activé : le serveur refuse les livres Premium aux comptes non abonnés.
            </div>
          </div>
          <Switch checked={!!enforced} disabled={setEnforced.isPending} onCheckedChange={(v) => (v ? setConfirm(true) : apply(false))} />
        </div>
        {confirm && (
          <div className="rounded-lg border border-amber-500/40 bg-amber-500/5 p-3 text-sm space-y-2">
            <div className="flex items-start gap-2"><AlertTriangle className="h-4 w-4 text-amber-600 mt-0.5" />
              <span>Activez ce réglage seulement quand les clients peuvent payer (Google Play et/ou carte). Sinon, les livres Premium deviendront illisibles pour tous les comptes non abonnés.</span>
            </div>
            <div className="flex gap-2"><Button size="sm" onClick={() => apply(true)}>Activer quand même</Button><Button size="sm" variant="ghost" onClick={() => setConfirm(false)}>Annuler</Button></div>
          </div>
        )}
      </div>
      <CardPaymentSetting />
      <GooglePlaySetting />
    </div>
  );
}

// ─── Paiement par carte (OPTGateway) ────────────────────────────────────────────────────
const WEBHOOK_URL = "https://bwepnibdlmuwtcacyyec.supabase.co/functions/v1/opt-webhook";

function CardPaymentSetting() {
  const qc = useQueryClient();
  const [confirm, setConfirm] = useState(false);
  const { data: open, isLoading } = useQuery({
    queryKey: ["site-setting", "opt_gateway_enabled"],
    queryFn: async () => {
      const { data } = await supabase.from("site_settings").select("value").eq("key", "opt_gateway_enabled").maybeSingle();
      return data?.value === "true";
    },
  });
  const save = async (v: boolean) => {
    const { error } = await supabase.from("site_settings").update({ value: v ? "true" : "false" }).eq("key", "opt_gateway_enabled");
    if (error) { toast.error("Échec", { description: error.message }); return; }
    qc.invalidateQueries({ queryKey: ["site-setting", "opt_gateway_enabled"] });
    setConfirm(false);
    toast.success(v ? "Paiement par carte ouvert aux clients" : "Paiement par carte réservé aux tests admin");
  };
  if (isLoading) return null;
  return (
    <div className="rounded-xl border border-border bg-card p-5 space-y-3">
      <div className="flex items-center justify-between gap-4">
        <div>
          <div className="font-semibold">Paiement par carte sur le site (OPTGateway)</div>
          <div className="text-sm text-muted-foreground">
            Désactivé : seuls les administrateurs voient le bouton « Payer » (pour tester avec la clé de test). Activé : tous les clients du site peuvent payer.
          </div>
        </div>
        <Switch checked={!!open} onCheckedChange={(v) => (v ? setConfirm(true) : save(false))} />
      </div>
      {confirm && (
        <div className="rounded-lg border border-amber-500/40 bg-amber-500/5 p-3 text-sm space-y-2">
          <p>Ouvrez le paiement seulement avec la clé réelle (sk_live_…), le webhook configuré et des formules actives. Confirmer ?</p>
          <div className="flex gap-2"><Button size="sm" onClick={() => save(true)}>Ouvrir le paiement</Button><Button size="sm" variant="ghost" onClick={() => setConfirm(false)}>Annuler</Button></div>
        </div>
      )}
      <div className="text-xs text-muted-foreground space-y-1">
        <div>Adresse du webhook à déclarer dans l'espace marchand OPTGateway (page Webhooks) :</div>
        <code className="block break-all rounded bg-muted px-2 py-1">{WEBHOOK_URL}</code>
      </div>
    </div>
  );
}

// ─── Paiement Google Play (application Android) ─────────────────────────────────────────
function GooglePlaySetting() {
  const qc = useQueryClient();
  const [confirm, setConfirm] = useState(false);
  const { data: open, isLoading } = useQuery({
    queryKey: ["site-setting", "google_play_enabled"],
    queryFn: async () => {
      const { data } = await supabase.from("site_settings").select("value").eq("key", "google_play_enabled").maybeSingle();
      return data?.value === "true";
    },
  });
  const save = async (v: boolean) => {
    const { error } = await supabase.from("site_settings").update({ value: v ? "true" : "false" }).eq("key", "google_play_enabled");
    if (error) { toast.error("Échec", { description: error.message }); return; }
    qc.invalidateQueries({ queryKey: ["site-setting"] });
    setConfirm(false);
    toast.success(v ? "Paiement Google Play ouvert aux clients" : "Paiement Google Play réservé aux tests admin");
  };
  if (isLoading) return null;
  return (
    <div className="rounded-xl border border-border bg-card p-5 space-y-3">
      <div className="flex items-center justify-between gap-4">
        <div>
          <div className="font-semibold">Paiement Google Play dans l'application Android</div>
          <div className="text-sm text-muted-foreground">
            Désactivé : seuls les administrateurs voient le bouton (achats gratuits avec un compte « testeur de licence »). Activé : tous les utilisateurs de l'appli Android peuvent s'abonner.
          </div>
        </div>
        <Switch checked={!!open} onCheckedChange={(v) => (v ? setConfirm(true) : save(false))} />
      </div>
      {confirm && (
        <div className="rounded-lg border border-amber-500/40 bg-amber-500/5 p-3 text-sm space-y-2">
          <p>Ouvrez seulement après un achat de test réussi, avec l'abonnement et ses forfaits actifs dans la Play Console et des formules actives ici. Confirmer ?</p>
          <div className="flex gap-2"><Button size="sm" onClick={() => save(true)}>Ouvrir le paiement Google Play</Button><Button size="sm" variant="ghost" onClick={() => setConfirm(false)}>Annuler</Button></div>
        </div>
      )}
      <p className="text-xs text-muted-foreground">Play Console : abonnement « kmg_premium », forfaits prépayés « mensuel-prepaye » et « annuel-prepaye ».</p>
    </div>
  );
}

// ─── Rappels d'expiration ───────────────────────────────────────────────────────────────
const kindLabel: Record<string, string> = { j7: "J-7", j3: "J-3", j0: "Jour J", expired: "Expiré" };
const channelLabel: Record<string, string> = { in_app: "Appli / site", push: "Push", email: "E-mail" };

function RemindersTab() {
  const { data: reminders = [], isLoading } = useReminders();
  const { data: settings } = useReminderSettings();
  const setSetting = useSetReminderSetting();
  const run = useRunReminders();
  const [last, setLast] = useState<ReminderRunResult | null>(null);
  const [confirmRun, setConfirmRun] = useState(false);
  const [confirmEmail, setConfirmEmail] = useState(false);

  const launch = async (dryRun: boolean) => {
    try {
      const r = await run.mutateAsync(dryRun);
      setLast(r);
      setConfirmRun(false);
      toast.success(dryRun ? `Simulation : ${r.sent} rappel(s) seraient envoyés` : `${r.sent} rappel(s) envoyé(s)`);
    } catch (e) { toast.error("Échec", { description: errMsg(e) }); }
  };
  const toggle = async (key: "premium_reminders_push" | "premium_reminders_email", value: boolean) => {
    try { await setSetting.mutateAsync({ key, value }); setConfirmEmail(false); toast.success("Réglage enregistré"); }
    catch (e) { toast.error("Échec", { description: errMsg(e) }); }
  };

  return (
    <div className="space-y-6">
      <div className="rounded-xl border border-border bg-card p-5 space-y-4 max-w-2xl">
        <p className="text-sm text-muted-foreground">
          Chaque jour à 8 h (heure de Kinshasa), les abonnés dont l'abonnement payé arrive à échéance reçoivent un rappel
          7 jours avant, 3 jours avant et le jour même — une seule fois chacun. La notification dans l'appli et sur le site est
          toujours envoyée. Les abonnements sans date de fin ne reçoivent pas de rappel.
        </p>
        <div className="flex items-center justify-between gap-4">
          <div><div className="font-medium">Notification push sur le téléphone</div><div className="text-xs text-muted-foreground">Appareils sur lesquels l'abonné a installé l'application.</div></div>
          <Switch checked={!!settings?.push} disabled={setSetting.isPending} onCheckedChange={(v) => toggle("premium_reminders_push", v)} />
        </div>
        <div className="flex items-center justify-between gap-4">
          <div><div className="font-medium">E-mail de rappel</div><div className="text-xs text-muted-foreground">Uniquement aux adresses vérifiées.</div></div>
          <Switch checked={!!settings?.email} disabled={setSetting.isPending} onCheckedChange={(v) => (v ? setConfirmEmail(true) : toggle("premium_reminders_email", false))} />
        </div>
        {confirmEmail && (
          <div className="rounded-lg border border-amber-500/40 bg-amber-500/5 p-3 text-sm space-y-2">
            <p>Des e-mails réels partiront automatiquement vers les abonnés concernés. Confirmer ?</p>
            <div className="flex gap-2"><Button size="sm" onClick={() => toggle("premium_reminders_email", true)}>Activer les e-mails</Button><Button size="sm" variant="ghost" onClick={() => setConfirmEmail(false)}>Annuler</Button></div>
          </div>
        )}
        <div className="flex flex-wrap gap-2 pt-2">
          <Button variant="outline" disabled={run.isPending} onClick={() => launch(true)}>{run.isPending && <Loader2 className="h-4 w-4 mr-1 animate-spin" />}Simuler (rien n'est envoyé)</Button>
          {confirmRun ? (
            <>
              <Button disabled={run.isPending} onClick={() => launch(false)}>Confirmer l'envoi</Button>
              <Button variant="ghost" onClick={() => setConfirmRun(false)}>Annuler</Button>
            </>
          ) : (
            <Button disabled={run.isPending} onClick={() => setConfirmRun(true)}>Lancer maintenant</Button>
          )}
        </div>
        {last && (
          <div className="rounded-lg bg-muted/50 p-3 text-sm">
            {last.dry_run ? "Simulation" : "Exécution"} : {last.checked} compte(s) avec abonnement, {last.due} à l'approche de l'échéance, {last.sent} rappel(s) {last.dry_run ? "à envoyer" : "envoyé(s)"}.
          </div>
        )}
      </div>

      <section className="space-y-2">
        <h3 className="font-semibold">Rappels envoyés</h3>
        {isLoading ? <Spinner /> : reminders.map((r) => (
          <div key={r.id} className="rounded-lg border border-border bg-card p-3 flex flex-col md:flex-row md:items-center gap-2 text-sm">
            <Badge variant="secondary">{kindLabel[r.kind] ?? r.kind}</Badge>
            <div className="flex-1 min-w-0 truncate">{r.email ?? r.user_id}</div>
            <div className="text-muted-foreground">échéance {fmtDay(r.expires_at)}</div>
            <div className="text-muted-foreground">{r.channels.map((c) => channelLabel[c] ?? c).join(", ") || "aucun canal"}</div>
            <div className="text-muted-foreground">{fmt(r.sent_at)}</div>
            {r.error && <div className="text-destructive text-xs w-full">{r.error}</div>}
          </div>
        ))}
        {!isLoading && reminders.length === 0 && <Empty text="Aucun rappel envoyé pour l'instant." />}
      </section>
    </div>
  );
}

// ─── Petits composants ──────────────────────────────────────────────────────────────────
function Field({ label, value, onChange, type = "text", placeholder }: { label: string; value: string; onChange: (v: string) => void; type?: string; placeholder?: string }) {
  return (
    <div className="space-y-1">
      <Label>{label}</Label>
      <Input type={type} value={value} placeholder={placeholder} onChange={(e) => onChange(e.target.value)} />
    </div>
  );
}
const Spinner = () => <div className="flex justify-center py-12"><Loader2 className="h-6 w-6 animate-spin text-muted-foreground" /></div>;
const Empty = ({ text }: { text: string }) => <p className="text-center text-muted-foreground py-8 text-sm">{text}</p>;
