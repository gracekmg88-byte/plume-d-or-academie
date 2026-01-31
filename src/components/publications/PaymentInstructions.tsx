import { Phone, Building2, MessageCircle, Lock } from "lucide-react";
import { Button } from "@/components/ui/button";
import { usePaymentSettings } from "@/hooks/usePaymentSettings";

export function PaymentInstructions() {
  const { settings, isLoading } = usePaymentSettings();

  const whatsappLink = `https://wa.me/${settings.payment_whatsapp.replace(/\s/g, "").replace("+", "")}?text=${encodeURIComponent(
    "Bonjour, j'ai effectué le paiement pour le téléchargement d'un document. Voici ma preuve de paiement :"
  )}`;

  if (isLoading) {
    return (
      <div className="bg-gradient-to-br from-amber-50 to-orange-50 dark:from-amber-950/30 dark:to-orange-950/30 rounded-2xl border border-amber-200 dark:border-amber-800 p-6">
        <div className="animate-pulse space-y-4">
          <div className="h-6 bg-amber-200 dark:bg-amber-800 rounded w-1/3"></div>
          <div className="h-20 bg-amber-200 dark:bg-amber-800 rounded"></div>
        </div>
      </div>
    );
  }

  return (
    <div className="bg-gradient-to-br from-amber-50 to-orange-50 dark:from-amber-950/30 dark:to-orange-950/30 rounded-2xl border border-amber-200 dark:border-amber-800 p-6 space-y-6">
      <div className="flex items-center gap-3">
        <div className="h-12 w-12 rounded-xl bg-amber-500/20 flex items-center justify-center">
          <Lock className="h-6 w-6 text-amber-600" />
        </div>
        <div>
          <h3 className="font-serif text-xl font-bold text-foreground">
            Téléchargement payant
          </h3>
          <p className="text-amber-700 dark:text-amber-400 font-semibold text-lg">
            {settings.payment_amount} USD
          </p>
        </div>
      </div>

      <p className="text-muted-foreground">
        La lecture en ligne est gratuite. Pour télécharger ce document, veuillez effectuer le paiement via l'une des méthodes ci-dessous.
      </p>

      <div className="grid gap-4">
        {/* Mobile Money */}
        <div className="bg-white dark:bg-card rounded-xl border border-border p-4">
          <div className="flex items-start gap-3">
            <div className="h-10 w-10 rounded-lg bg-green-500/10 flex items-center justify-center shrink-0">
              <Phone className="h-5 w-5 text-green-600" />
            </div>
            <div>
              <h4 className="font-semibold text-foreground mb-1">Mobile Money</h4>
              <p className="text-foreground font-medium">{settings.payment_mobile_number}</p>
              <p className="text-muted-foreground text-sm">Nom bénéficiaire : <span className="font-medium">{settings.payment_mobile_name}</span></p>
            </div>
          </div>
        </div>

        {/* Banque */}
        <div className="bg-white dark:bg-card rounded-xl border border-border p-4">
          <div className="flex items-start gap-3">
            <div className="h-10 w-10 rounded-lg bg-blue-500/10 flex items-center justify-center shrink-0">
              <Building2 className="h-5 w-5 text-blue-600" />
            </div>
            <div>
              <h4 className="font-semibold text-foreground mb-1">Virement bancaire</h4>
              <p className="text-muted-foreground text-sm">Banque : <span className="font-medium text-foreground">{settings.payment_bank_name}</span></p>
              <p className="text-muted-foreground text-sm">Compte : <span className="font-medium text-foreground">{settings.payment_bank_account}</span></p>
              <p className="text-muted-foreground text-sm">Bénéficiaire : <span className="font-medium text-foreground">{settings.payment_bank_beneficiary}</span></p>
            </div>
          </div>
        </div>
      </div>

      {/* Instructions après paiement */}
      <div className="bg-primary/5 rounded-xl p-4 border border-primary/20">
        <h4 className="font-semibold text-foreground mb-2 flex items-center gap-2">
          <MessageCircle className="h-4 w-4 text-primary" />
          Après le paiement
        </h4>
        <p className="text-muted-foreground text-sm mb-3">
          Envoyez votre preuve de paiement via WhatsApp. Après vérification, vous recevrez le lien de téléchargement.
        </p>
        <a href={whatsappLink} target="_blank" rel="noopener noreferrer">
          <Button className="w-full gap-2 bg-green-600 hover:bg-green-700">
            <MessageCircle className="h-4 w-4" />
            Envoyer la preuve sur WhatsApp
          </Button>
        </a>
      </div>
    </div>
  );
}
