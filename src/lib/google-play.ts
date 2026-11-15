// Paiement Google Play dans l'application Android (forfaits PRÉPAYÉS : pas de renouvellement
// automatique, le client recharge lui-même). Bibliothèque : @capgo/native-purchases.
//
// L'application ne décide jamais du Premium : elle transmet le jeton d'achat au serveur
// (fonction google-play-verify), qui le vérifie auprès de Google, active la période et confirme
// l'achat à Google. Les achats ne sont donc PAS confirmés par l'appli (autoAcknowledgePurchases:false).
import { Capacitor } from "@capacitor/core";
import { NativePurchases, PURCHASE_TYPE } from "@capgo/native-purchases";
import { supabase } from "@/integrations/supabase/client";

export const isAndroidApp = () => Capacitor.isNativePlatform() && Capacitor.getPlatform() === "android";

export interface PlayOffer {
  productId: string;
  basePlanId: string;
  offerToken: string | null;
  priceString: string;
}

/** Même empreinte que le serveur (google-play-verify) : lie l'achat Google au compte KMG. */
export async function accountHash(userId: string): Promise<string> {
  const d = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(`kmg-premium:${userId}`));
  return [...new Uint8Array(d)].map((b) => b.toString(16).padStart(2, "0")).join("").slice(0, 64);
}

/** Offres disponibles chez Google Play pour les produits demandés (vide si indisponible). */
export async function loadPlayOffers(productIds: string[]): Promise<PlayOffer[]> {
  if (!isAndroidApp() || productIds.length === 0) return [];
  try {
    const { isBillingSupported } = await NativePurchases.isBillingSupported();
    if (!isBillingSupported) return [];
    const { products } = await NativePurchases.getProducts({
      productIdentifiers: [...new Set(productIds)],
      productType: PURCHASE_TYPE.SUBS,
    });
    // Pour un abonnement : Product.identifier = forfait de base, Product.planIdentifier = produit Play.
    return (products ?? []).map((p) => ({
      productId: (p as { planIdentifier?: string }).planIdentifier ?? p.identifier,
      basePlanId: p.identifier,
      offerToken: (p as { offerToken?: string }).offerToken ?? null,
      priceString: p.priceString,
    }));
  } catch (e) {
    console.warn("[google-play] offres indisponibles", e);
    return [];
  }
}

export interface VerifyResult {
  success: boolean;
  plan?: string;
  premium_expires_at?: string | null;
  test?: boolean;
  error?: string;
}

async function verifyOnServer(purchaseToken: string): Promise<VerifyResult> {
  const { data, error } = await supabase.functions.invoke("google-play-verify", { body: { purchase_token: purchaseToken } });
  if (error) {
    let message = "La vérification de l'achat a échoué. Réessayez : votre achat n'est pas perdu.";
    const ctx = (error as { context?: Response }).context;
    if (ctx && typeof ctx.json === "function") { try { message = (await ctx.json())?.error || message; } catch { /* corps illisible */ } }
    return { success: false, error: message };
  }
  return data as VerifyResult;
}

/** Lance l'achat Google Play puis la vérification serveur. */
export async function buyWithGooglePlay(offer: PlayOffer, userId: string): Promise<VerifyResult> {
  const tx = await NativePurchases.purchaseProduct({
    productIdentifier: offer.productId,
    planIdentifier: offer.basePlanId,
    ...(offer.offerToken ? { offerToken: offer.offerToken } : {}),
    productType: PURCHASE_TYPE.SUBS,
    quantity: 1,
    appAccountToken: await accountHash(userId),
    autoAcknowledgePurchases: false,
  });
  const token = tx.purchaseToken ?? tx.transactionId;
  if (!token) return { success: false, error: "Google Play n'a pas renvoyé de preuve d'achat." };
  return verifyOnServer(token);
}

/**
 * Récupération : renvoie au serveur les achats Google Play non encore confirmés (appli fermée
 * pendant la vérification, coupure réseau…). Sans risque de double activation (idempotent).
 */
export async function recoverPlayPurchases(): Promise<number> {
  if (!isAndroidApp()) return 0;
  try {
    const { purchases } = await NativePurchases.getPurchases({ productType: PURCHASE_TYPE.SUBS });
    let n = 0;
    for (const p of purchases ?? []) {
      const token = p.purchaseToken ?? p.transactionId;
      if (!token || (p as { isAcknowledged?: boolean }).isAcknowledged) continue;
      const r = await verifyOnServer(token);
      if (r.success) n++;
    }
    return n;
  } catch (e) {
    console.warn("[google-play] récupération impossible", e);
    return 0;
  }
}
