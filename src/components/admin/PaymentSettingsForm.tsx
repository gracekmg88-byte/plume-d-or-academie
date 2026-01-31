import { useState, useEffect } from "react";
import { Phone, Building2, MessageCircle, DollarSign, Save } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { usePaymentSettings, PaymentSettings } from "@/hooks/usePaymentSettings";

export function PaymentSettingsForm() {
  const { settings, isLoading, updateAllSettings } = usePaymentSettings();
  const [formData, setFormData] = useState<PaymentSettings>(settings);

  useEffect(() => {
    setFormData(settings);
  }, [settings]);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    updateAllSettings.mutate(formData);
  };

  if (isLoading) {
    return (
      <div className="bg-card rounded-xl border border-border p-6">
        <div className="animate-pulse space-y-4">
          <div className="h-6 bg-muted rounded w-1/3"></div>
          <div className="h-10 bg-muted rounded"></div>
          <div className="h-10 bg-muted rounded"></div>
        </div>
      </div>
    );
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-6">
      {/* Montant */}
      <div className="bg-card rounded-xl border border-border p-6">
        <div className="flex items-center gap-3 mb-4">
          <DollarSign className="h-5 w-5 text-primary" />
          <h3 className="font-semibold text-foreground">Montant</h3>
        </div>
        <div className="space-y-2">
          <Label htmlFor="payment_amount">Prix de l'abonnement (USD)</Label>
          <Input
            id="payment_amount"
            value={formData.payment_amount}
            onChange={(e) => setFormData({ ...formData, payment_amount: e.target.value })}
            placeholder="5"
          />
        </div>
      </div>

      {/* Mobile Money */}
      <div className="bg-card rounded-xl border border-border p-6">
        <div className="flex items-center gap-3 mb-4">
          <Phone className="h-5 w-5 text-green-600" />
          <h3 className="font-semibold text-foreground">Mobile Money</h3>
        </div>
        <div className="grid gap-4">
          <div className="space-y-2">
            <Label htmlFor="payment_mobile_number">Numéro de téléphone</Label>
            <Input
              id="payment_mobile_number"
              value={formData.payment_mobile_number}
              onChange={(e) => setFormData({ ...formData, payment_mobile_number: e.target.value })}
              placeholder="+243 998 102 000"
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="payment_mobile_name">Nom du bénéficiaire</Label>
            <Input
              id="payment_mobile_name"
              value={formData.payment_mobile_name}
              onChange={(e) => setFormData({ ...formData, payment_mobile_name: e.target.value })}
              placeholder="Kot Gracia"
            />
          </div>
        </div>
      </div>

      {/* Banque */}
      <div className="bg-card rounded-xl border border-border p-6">
        <div className="flex items-center gap-3 mb-4">
          <Building2 className="h-5 w-5 text-blue-600" />
          <h3 className="font-semibold text-foreground">Virement bancaire</h3>
        </div>
        <div className="grid gap-4">
          <div className="space-y-2">
            <Label htmlFor="payment_bank_name">Nom de la banque</Label>
            <Input
              id="payment_bank_name"
              value={formData.payment_bank_name}
              onChange={(e) => setFormData({ ...formData, payment_bank_name: e.target.value })}
              placeholder="Equity BCDC"
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="payment_bank_account">Numéro de compte</Label>
            <Input
              id="payment_bank_account"
              value={formData.payment_bank_account}
              onChange={(e) => setFormData({ ...formData, payment_bank_account: e.target.value })}
              placeholder="500005286303929"
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="payment_bank_beneficiary">Nom du bénéficiaire</Label>
            <Input
              id="payment_bank_beneficiary"
              value={formData.payment_bank_beneficiary}
              onChange={(e) => setFormData({ ...formData, payment_bank_beneficiary: e.target.value })}
              placeholder="KOT MUNON GRÂCE"
            />
          </div>
        </div>
      </div>

      {/* WhatsApp */}
      <div className="bg-card rounded-xl border border-border p-6">
        <div className="flex items-center gap-3 mb-4">
          <MessageCircle className="h-5 w-5 text-green-600" />
          <h3 className="font-semibold text-foreground">WhatsApp</h3>
        </div>
        <div className="space-y-2">
          <Label htmlFor="payment_whatsapp">Numéro WhatsApp (sans espaces)</Label>
          <Input
            id="payment_whatsapp"
            value={formData.payment_whatsapp}
            onChange={(e) => setFormData({ ...formData, payment_whatsapp: e.target.value })}
            placeholder="+243998102000"
          />
          <p className="text-xs text-muted-foreground">
            Format: +243998102000 (sans espaces pour le lien WhatsApp)
          </p>
        </div>
      </div>

      <Button type="submit" className="w-full gap-2" disabled={updateAllSettings.isPending}>
        <Save className="h-4 w-4" />
        {updateAllSettings.isPending ? "Enregistrement..." : "Enregistrer les modifications"}
      </Button>
    </form>
  );
}
