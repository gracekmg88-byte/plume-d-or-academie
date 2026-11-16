/** Clé de la position mémorisée du tableau de bord admin (voir AdminDashboard et ScrollManager). */
export const ADMIN_DASHBOARD_SCROLL_KEY = "admin-dashboard";

/** État de navigation des boutons « Retour au tableau de bord » : revenir à la position quittée. */
export const BACK_TO_DASHBOARD_STATE = { restoreScroll: true, returnKey: ADMIN_DASHBOARD_SCROLL_KEY } as const;
