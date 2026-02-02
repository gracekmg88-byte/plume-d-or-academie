import { billingConfig } from "@/config/billing";

/**
 * Hook to access billing configuration throughout the app.
 * Centralizes billing state for easy future Google Play Billing integration.
 */
export function useBillingConfig() {
  const { billingEnabled, comingSoonMessage, playStoreProducts } = billingConfig;

  return {
    /** Whether billing/premium features should be displayed */
    billingEnabled,
    
    /** Whether to hide all premium UI (inverse of billingEnabled) */
    hidePremiumUI: !billingEnabled,
    
    /** Neutral message for coming soon features */
    comingSoonMessage,
    
    /** Google Play product IDs (for future use) */
    playStoreProducts,
  };
}
