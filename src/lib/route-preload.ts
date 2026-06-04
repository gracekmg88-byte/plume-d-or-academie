export const loadBibliothequePage = () => import("@/pages/Bibliotheque");
export const loadPublicationPage = () => import("@/pages/Publication");
export const loadAProposPage = () => import("@/pages/APropos");
export const loadContactPage = () => import("@/pages/Contact");
export const loadAuthPage = () => import("@/pages/Auth");
export const loadResetPasswordPage = () => import("@/pages/ResetPassword");
export const loadProfilPage = () => import("@/pages/Profil");
export const loadAbonnementPage = () => import("@/pages/Abonnement");
export const loadAdminLoginPage = () => import("@/pages/admin/AdminLogin");
export const loadAdminDashboardPage = () => import("@/pages/admin/AdminDashboard");
export const loadAdminMessagesPage = () => import("@/pages/admin/AdminMessages");
export const loadAdminSettingsPage = () => import("@/pages/admin/AdminSettings");
export const loadAdminUsersPage = () => import("@/pages/admin/AdminUsers");
export const loadPublicationFormPage = () => import("@/pages/admin/PublicationForm");
export const loadAdminDevicesPage = () => import("@/pages/admin/AdminDevices");
export const loadAdminSubmissionsPage = () => import("@/pages/admin/AdminSubmissions");
export const loadDepotMemoirePage = () => import("@/pages/DepotMemoire");
export const loadChatPage = () => import("@/pages/Chat");
export const loadInstallAppPage = () => import("@/pages/InstallApp");
export const loadNotFoundPage = () => import("@/pages/NotFound");

export function preloadCommonRoutes() {
  void Promise.allSettled([
    loadBibliothequePage(),
    loadPublicationPage(),
    loadProfilPage(),
    loadAProposPage(),
    loadContactPage(),
    loadAuthPage(),
    loadAbonnementPage(),
    loadChatPage(),
    loadDepotMemoirePage(),
    loadInstallAppPage(),
    loadResetPasswordPage(),
    loadNotFoundPage(),
  ]);
}

export function preloadPublicationFlow() {
  void Promise.allSettled([
    loadPublicationPage(),
    loadBibliothequePage(),
  ]);
}