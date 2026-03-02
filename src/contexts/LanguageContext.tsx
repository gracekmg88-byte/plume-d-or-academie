import { createContext, useContext, useState, useEffect, ReactNode } from "react";

type Language = "fr" | "en";

const translations = {
  fr: {
    // Nav
    "nav.home": "Accueil",
    "nav.library": "Bibliothèque",
    "nav.about": "À propos",
    "nav.contact": "Contact",
    "nav.profile": "Profil",
    "nav.admin": "Admin",
    "nav.login": "Connexion",
    "nav.myProfile": "Mon profil",
    "nav.administration": "Administration",

    // Index hero
    "hero.badge": "Bibliothèque Académique Numérique",
    "hero.title": "Plume d'Or",
    "hero.titleAccent": "KMG",
    "hero.description": "Votre passerelle vers le savoir. Explorez notre collection de livres, mémoires, TFC et articles académiques.",
    "hero.cta": "Explorer la bibliothèque",
    "hero.learnMore": "En savoir plus",

    // Stats
    "stats.books": "Livres",
    "stats.memoirs": "Mémoires",
    "stats.tfc": "TFC",
    "stats.articles": "Articles",

    // Features
    "features.title": "Pourquoi Plume d'Or KMG ?",
    "features.subtitle": "Une plateforme dédiée à la diffusion du savoir académique et à la valorisation des travaux de recherche.",
    "features.freeAccess": "Accès libre",
    "features.freeAccessDesc": "Consultez gratuitement tous nos contenus académiques sans inscription.",
    "features.resources": "Ressources académiques",
    "features.resourcesDesc": "Mémoires, TFC et articles rédigés par des étudiants et chercheurs.",
    "features.quality": "Qualité garantie",
    "features.qualityDesc": "Tous les contenus sont vérifiés et validés avant publication.",

    // Recent publications
    "recent.title": "Publications récentes",
    "recent.subtitle": "Découvrez les dernières additions à notre bibliothèque.",
    "recent.viewAll": "Voir tout",
    "recent.empty": "Aucune publication disponible pour le moment.",

    // CTA
    "cta.title": "Prêt à explorer ?",
    "cta.description": "Accédez à notre collection complète de ressources académiques et enrichissez vos connaissances.",
    "cta.button": "Parcourir la bibliothèque",

    // Bibliotheque
    "library.title": "Bibliothèque",
    "library.description": "Explorez notre collection de livres, mémoires, TFC et articles académiques.",
    "library.offline": "Mode hors ligne — Affichage des publications déjà consultées",
    "library.found_one": "publication trouvée",
    "library.found_many": "publications trouvées",
    "library.noResults": "Aucune publication trouvée",
    "library.noResultsOffline": "Consultez des publications en ligne pour les rendre disponibles hors connexion.",
    "library.noResultsSearch": "Aucun résultat pour \"{search}\". Essayez avec d'autres termes.",
    "library.noResultsCategory": "Aucune publication disponible dans cette catégorie.",
  },
  en: {
    // Nav
    "nav.home": "Home",
    "nav.library": "Library",
    "nav.about": "About",
    "nav.contact": "Contact",
    "nav.profile": "Profile",
    "nav.admin": "Admin",
    "nav.login": "Sign In",
    "nav.myProfile": "My Profile",
    "nav.administration": "Administration",

    // Index hero
    "hero.badge": "Academic Digital Library",
    "hero.title": "Plume d'Or",
    "hero.titleAccent": "KMG",
    "hero.description": "Your gateway to knowledge. Explore our collection of books, theses, research papers and academic articles.",
    "hero.cta": "Explore the library",
    "hero.learnMore": "Learn more",

    // Stats
    "stats.books": "Books",
    "stats.memoirs": "Theses",
    "stats.tfc": "Papers",
    "stats.articles": "Articles",

    // Features
    "features.title": "Why Plume d'Or KMG?",
    "features.subtitle": "A platform dedicated to spreading academic knowledge and showcasing research work.",
    "features.freeAccess": "Free Access",
    "features.freeAccessDesc": "Browse all our academic content for free, no registration needed.",
    "features.resources": "Academic Resources",
    "features.resourcesDesc": "Theses, papers and articles written by students and researchers.",
    "features.quality": "Guaranteed Quality",
    "features.qualityDesc": "All content is reviewed and validated before publication.",

    // Recent publications
    "recent.title": "Recent Publications",
    "recent.subtitle": "Discover the latest additions to our library.",
    "recent.viewAll": "View all",
    "recent.empty": "No publications available at the moment.",

    // CTA
    "cta.title": "Ready to explore?",
    "cta.description": "Access our complete collection of academic resources and enrich your knowledge.",
    "cta.button": "Browse the library",

    // Bibliotheque
    "library.title": "Library",
    "library.description": "Explore our collection of books, theses, research papers and academic articles.",
    "library.offline": "Offline mode — Showing previously viewed publications",
    "library.found_one": "publication found",
    "library.found_many": "publications found",
    "library.noResults": "No publications found",
    "library.noResultsOffline": "View publications online to make them available offline.",
    "library.noResultsSearch": "No results for \"{search}\". Try different terms.",
    "library.noResultsCategory": "No publications available in this category.",
  },
} as const;

type TranslationKey = keyof typeof translations.fr;

interface LanguageContextType {
  language: Language;
  setLanguage: (lang: Language) => void;
  t: (key: TranslationKey, vars?: Record<string, string>) => string;
}

const LanguageContext = createContext<LanguageContextType | undefined>(undefined);

export function LanguageProvider({ children }: { children: ReactNode }) {
  const [language, setLanguage] = useState<Language>(() => {
    const saved = localStorage.getItem("plume-lang");
    return (saved === "en" || saved === "fr") ? saved : "fr";
  });

  useEffect(() => {
    localStorage.setItem("plume-lang", language);
    document.documentElement.lang = language;
  }, [language]);

  const t = (key: TranslationKey, vars?: Record<string, string>): string => {
    let text: string = translations[language][key] || translations.fr[key] || key;
    if (vars) {
      Object.entries(vars).forEach(([k, v]) => {
        text = text.replace(`{${k}}`, v);
      });
    }
    return text;
  };

  return (
    <LanguageContext.Provider value={{ language, setLanguage, t }}>
      {children}
    </LanguageContext.Provider>
  );
}

export function useLanguage() {
  const context = useContext(LanguageContext);
  if (!context) throw new Error("useLanguage must be used within LanguageProvider");
  return context;
}
