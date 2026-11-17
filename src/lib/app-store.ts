// Paiement App Store dans l'application iPhone (abonnements NON RENOUVELABLES : pas de
// prélèvement automatique, le client renouvelle lui-même — comme les forfaits prépayés Google Play).
// Bibliothèque : @capgo/native-purchases (StoreKit 2).
//
// L'application ne décide jamais du Premium : elle transmet la preuve d'achat signée par Apple
// (jwsRepresentation) au serveur (fonction apple-iap-verify), qui la vérifie puis active la période.
import { Capacitor } from "@capacitor/core";
import { NativePurchases, PURCHASE_TYPE } from "@capgo/native-purchases";
import { invokeWithTimeout } from "@/lib/invoke-with-timeout";
import type { PlayOffer, VerifyResult } from "@/lib/google-play";

export const isIOSApp = () => Capacitor.isNativePlatform() && Capacitor.getPlatform() === "ios";

/** Formule KMG → produit App Store (mêmes identifiants que supabase/functions/apple-iap-verify). */
export const APPLE_PRODUCT_BY_PLAN: Record<string, string> = {
  premium_monthly: "com.kmgbibliotheque.premium.mensuel",
  premium_yearly: "com.kmgbibliotheque.premium.annuel",
};

/** Identifiant de compte transmis à Apple (UUID dérivé du compte KMG) — même calcul que le serveur. */
export async function appleAccountToken(userId: string): Promise<string> {
  const d = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(`kmg-premium:${userId}`));
  const h = [...new Uint8Array(d)].map((b) => b.toString(16).padStart(2, "0")).join("").slice(0, 32).split("");
  h[12] = "5";
  h[16] = ((parseInt(h[16], 16) & 0x3) | 0x8).toString(16);
  const s = h.join("");
  return `${s.slice(0, 8)}-${s.slice(8, 12)}-${s.slice(12, 16)}-${s.slice(16, 20)}-${s.slice(20, 32)}`;
}

/** Offres disponibles sur l'App Store pour les formules demandées (vide si indisponible). */
export async function loadAppleOffers(planCodes: string[]): Promise<PlayOffer[]> {
  if (!isIOSApp()) return [];
  const ids = [...new Set(planCodes.map((c) => APPLE_PRODUCT_BY_PLAN[c]).filter(Boolean))];
  if (ids.length === 0) return [];
  try {
    const { products } = await NativePurchases.getProducts({ productIdentifiers: ids, productType: PURCHASE_TYPE.INAPP });
    return (products ?? []).map((p) => ({ productId: p.identifier, basePlanId: "", offerToken: null, priceString: p.priceString }));
  } catch (e) {
    console.warn("[app-store] offres indisponibles", e);
    return [];
  }
}

async function verifyOnServer(jws: string): Promise<VerifyResult> {
  let res;
  try {
    res = await invokeWithTimeout("apple-iap-verify", { jws });
  } catch (e) {
    return { success: false, error: `${e instanceof Error ? e.message : String(e)} Votre achat n'est pas perdu : utilisez « Restaurer mes achats ».` };
  }
  const { data, error } = res;
  if (error) {
    let message = "La vérification de l'achat a échoué. Réessayez : votre achat n'est pas perdu.";
    const ctx = (error as { context?: Response }).context;
    if (ctx && typeof ctx.json === "function") { try { message = (await ctx.json())?.error || message; } catch { /* corps illisible */ } }
    return { success: false, error: message };
  }
  return data as VerifyResult;
}

/** Lance l'achat App Store puis la vérification serveur. */
export async function buyWithAppStore(offer: PlayOffer, userId: string): Promise<VerifyResult> {
  const tx = await NativePurchases.purchaseProduct({
    productIdentifier: offer.productId,
    productType: PURCHASE_TYPE.INAPP,
    quantity: 1,
    appAccountToken: await appleAccountToken(userId),
  });
  const jws = (tx as { jwsRepresentation?: string }).jwsRepresentation;
  if (!jws) return { success: false, error: "L'App Store n'a pas renvoyé de preuve d'achat." };
  return verifyOnServer(jws);
}

/**
 * « Restaurer mes achats » (exigé par Apple) : renvoie au serveur les achats de ce compte.
 * Sans risque de double activation (le serveur reconnaît un achat déjà validé).
 */
export async function restoreAppStorePurchases(userId: string): Promise<number> {
  if (!isIOSApp()) return 0;
  try {
    const token = (await appleAccountToken(userId)).toUpperCase();
    const { purchases } = await NativePurchases.getPurchases({ productType: PURCHASE_TYPE.INAPP, appAccountToken: token });
    let n = 0;
    for (const p of purchases ?? []) {
      const jws = (p as { jwsRepresentation?: string }).jwsRepresentation;
      if (!jws) continue;
      const r = await verifyOnServer(jws);
      if (r.success) n++;
    }
    return n;
  } catch (e) {
    console.warn("[app-store] restauration impossible", e);
    return 0;
  }
}
