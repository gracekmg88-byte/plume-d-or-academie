/**
 * Billing Configuration
 * 
 * This file contains the billing feature flag for Google Play Store compliance.
 * 
 * When billingEnabled = false:
 * - All premium/payment UI is hidden
 * - App functions as 100% free
 * - No monetization references visible
 * 
 * When billingEnabled = true:
 * - Premium subscription options will be displayed
 * - Google Play Billing integration will be active (future implementation)
 * 
 * IMPORTANT: Keep billingEnabled = false for initial Google Play Store submission
 * to avoid rejection for external payment references.
 */

export const billingConfig = {
  /**
   * Master switch for billing features.
   * Set to false for Google Play Store compliance (no external payments).
   * Set to true when Google Play Billing is implemented.
   */
  billingEnabled: false,

  /**
   * Message to display when premium features are coming soon.
   * This neutral message is Google Play compliant.
   */
  comingSoonMessage: "Certaines fonctionnalités avancées seront disponibles prochainement.",

  /**
   * Future: Google Play Billing product IDs (to be configured when billing is enabled)
   */
  playStoreProducts: {
    premium: "premium_subscription", // Placeholder for future Google Play Billing
  },
} as const;

// Type exports for type safety
export type BillingConfig = typeof billingConfig;
