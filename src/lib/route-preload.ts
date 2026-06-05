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
export const loadAdminCertificatesPage = () => import("@/pages/admin/AdminCertificates");
export const loadAdminSeoPage = () => import("@/pages/admin/AdminSeo");
export const loadAdminAuthLogsPage = () => import("@/pages/admin/AdminAuthLogs");
export const loadAuteurPage = () => import("@/pages/Auteur");
export const loadVerifyCertificatePage = () => import("@/pages/VerifyCertificate");
export const loadVerifyHomePage = () => import("@/pages/VerifyHome");

export function preloadAdminRoutes() {
  void Promise.allSettled([
    loadAdminDashboardPage(),
    loadAdminMessagesPage(),
    loadAdminSettingsPage(),
    loadAdminUsersPage(),
    loadAdminDevicesPage(),
    loadAdminSubmissionsPage(),
    loadPublicationFormPage(),
    loadAdminCertificatesPage(),
    loadAdminSeoPage(),
    loadAdminAuthLogsPage(),
  ]);
}

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
    loadAuteurPage(),
    loadVerifyHomePage(),
    loadVerifyCertificatePage(),
  ]);
}

export function preloadPublicationFlow() {
  void Promise.allSettled([
    loadPublicationPage(),
    loadBibliothequePage(),
  ]);
}

// Map a path prefix to its loader. Used by NavLink hover/focus/touch prefetch
// so that any in-app link warms up its bundle before the user clicks.
const PREFIX_LOADERS: Array<[string, () => Promise<unknown>]> = [
  ["/bibliotheque", loadBibliothequePage],
  ["/publication/", loadPublicationPage],
  ["/livre/", loadPublicationPage],
  ["/memoire/", loadPublicationPage],
  ["/tfc/", loadPublicationPage],
  ["/article/", loadPublicationPage],
  ["/auteur/", loadAuteurPage],
  ["/a-propos", loadAProposPage],
  ["/contact", loadContactPage],
  ["/auth", loadAuthPage],
  ["/reset-password", loadResetPasswordPage],
  ["/profil", loadProfilPage],
  ["/abonnement", loadAbonnementPage],
  ["/admin/dashboard", loadAdminDashboardPage],
  ["/admin/messages", loadAdminMessagesPage],
  ["/admin/settings", loadAdminSettingsPage],
  ["/admin/users", loadAdminUsersPage],
  ["/admin/publication/", loadPublicationFormPage],
  ["/admin/devices", loadAdminDevicesPage],
  ["/admin/submissions", loadAdminSubmissionsPage],
  ["/admin/certificates", loadAdminCertificatesPage],
  ["/admin/seo", loadAdminSeoPage],
  ["/admin/auth-logs", loadAdminAuthLogsPage],
  ["/admin", loadAdminLoginPage],
  ["/depot-memoire", loadDepotMemoirePage],
  ["/chat", loadChatPage],
  ["/installer", loadInstallAppPage],
  ["/verify/", loadVerifyCertificatePage],
  ["/verification", loadVerifyHomePage],
];

const warmed = new Set<string>();

export function prefetchRoute(to: string) {
  if (!to || typeof to !== "string") return;
  // Strip query/hash
  const path = to.split("?")[0].split("#")[0];
  if (warmed.has(path)) return;
  // Sort by longest prefix to match most specific route first
  const match = [...PREFIX_LOADERS]
    .sort((a, b) => b[0].length - a[0].length)
    .find(([prefix]) => path === prefix || path.startsWith(prefix));
  if (!match) return;
  warmed.add(path);
  void match[1]().catch(() => {
    warmed.delete(path);
  });
}
