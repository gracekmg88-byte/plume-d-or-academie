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

    // About
    "about.title": "À propos de Plume d'Or KMG",
    "about.description": "Une bibliothèque académique numérique dédiée à la diffusion du savoir et à la valorisation des travaux de recherche.",
    "about.missionBadge": "Notre mission",
    "about.missionTitle": "Démocratiser l'accès au savoir académique",
    "about.missionP1": "Plume d'Or KMG est née de la conviction que le savoir académique doit être accessible à tous. Notre plateforme rassemble des livres, mémoires, TFC et articles scientifiques pour offrir une ressource éducative de qualité.",
    "about.missionP2": "Nous accompagnons les étudiants, chercheurs et passionnés dans leur quête de connaissances en leur donnant accès à une bibliothèque numérique riche et variée.",
    "about.missionP3": "Chaque publication est soigneusement sélectionnée pour garantir la qualité et la pertinence des contenus proposés.",
    "about.qualityTitle": "Qualité garantie",
    "about.qualityDesc": "Tous nos contenus sont vérifiés et validés",
    "about.valuesTitle": "Nos valeurs",
    "about.valuesSubtitle": "Les principes qui guident notre mission de partage du savoir.",
    "about.val1Title": "Excellence académique",
    "about.val1Desc": "Nous promouvons la qualité et la rigueur dans tous les travaux publiés.",
    "about.val2Title": "Accessibilité",
    "about.val2Desc": "Le savoir doit être accessible à tous, sans barrières géographiques ou économiques.",
    "about.val3Title": "Partage du savoir",
    "about.val3Desc": "Nous croyons au pouvoir transformateur de la connaissance partagée.",
    "about.val4Title": "Innovation",
    "about.val4Desc": "Nous encourageons la créativité et les nouvelles perspectives de recherche.",
    "about.storyTitle": "Notre histoire",
    "about.storyP1": "Fondée avec la passion de rendre le savoir accessible, Plume d'Or KMG est le fruit d'une vision simple : créer un espace où les travaux académiques peuvent être partagés et consultés librement.",
    "about.storyP2": "Notre nom évoque la plume d'or, symbole de l'écriture noble et du savoir précieux. Nous aspirons à être cette plume qui trace le chemin de la connaissance pour les générations présentes et futures.",
    "about.storyP3": "Aujourd'hui, nous continuons de développer notre collection pour offrir toujours plus de ressources à notre communauté d'apprenants et de chercheurs.",

    // Contact
    "contact.title": "Contactez-nous",
    "contact.description": "Une question, une suggestion ou une demande de partenariat ? N'hésitez pas à nous contacter.",
    "contact.infoTitle": "Nos coordonnées",
    "contact.infoDesc": "Nous sommes disponibles pour répondre à toutes vos questions concernant notre bibliothèque académique.",
    "contact.phone": "Téléphone",
    "contact.email": "Email",
    "contact.hours": "Horaires",
    "contact.hoursValue": "Lun - Sam : 8h - 18h",
    "contact.formTitle": "Envoyez-nous un message",
    "contact.name": "Nom complet",
    "contact.namePlaceholder": "Votre nom",
    "contact.emailPlaceholder": "votre@email.com",
    "contact.subject": "Sujet",
    "contact.subjectPlaceholder": "Le sujet de votre message",
    "contact.message": "Message",
    "contact.messagePlaceholder": "Votre message...",
    "contact.send": "Envoyer le message",
    "contact.sending": "Envoi en cours...",
    "contact.success": "Message envoyé !",
    "contact.successDesc": "Nous vous répondrons dans les plus brefs délais.",
    "contact.error": "Erreur lors de l'envoi du message",
    "contact.errorDesc": "Veuillez réessayer plus tard.",

    // Publication detail
    "pub.back": "Retour à la bibliothèque",
    "pub.notFound": "Publication non trouvée",
    "pub.notFoundOnline": "Cette publication n'existe pas ou n'est plus disponible.",
    "pub.notFoundOffline": "Cette publication n'a pas été consultée en ligne auparavant et n'est pas disponible hors connexion.",
    "pub.offlineMode": "Mode hors ligne",
    "pub.offlineBanner": "Mode hors ligne — Lecture depuis le cache local",
    "pub.views": "consultations",
    "pub.description": "Description",
    "pub.document": "Document",
    "pub.protected": "Ce document est protégé. La copie est interdite.",
    "pub.download": "Télécharger le document",
    "pub.availableOffline": "Disponible hors ligne",

    // Footer
    "footer.description": "Votre bibliothèque académique numérique pour la publication et la consultation de livres, mémoires et articles scientifiques.",
    "footer.navigation": "Navigation",
    "footer.categories": "Catégories",
    "footer.contact": "Contact",
    "footer.rights": "Tous droits réservés.",
    "footer.books": "Livres",
    "footer.memoirs": "Mémoires",
    "footer.tfc": "TFC",
    "footer.articles": "Articles",
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

    // About
    "about.title": "About Plume d'Or KMG",
    "about.description": "A digital academic library dedicated to spreading knowledge and showcasing research work.",
    "about.missionBadge": "Our mission",
    "about.missionTitle": "Democratizing access to academic knowledge",
    "about.missionP1": "Plume d'Or KMG was born from the conviction that academic knowledge should be accessible to all. Our platform gathers books, theses, papers and scientific articles to provide quality educational resources.",
    "about.missionP2": "We support students, researchers and enthusiasts in their quest for knowledge by giving them access to a rich and diverse digital library.",
    "about.missionP3": "Each publication is carefully selected to ensure the quality and relevance of the content offered.",
    "about.qualityTitle": "Guaranteed Quality",
    "about.qualityDesc": "All our content is reviewed and validated",
    "about.valuesTitle": "Our values",
    "about.valuesSubtitle": "The principles that guide our mission of sharing knowledge.",
    "about.val1Title": "Academic Excellence",
    "about.val1Desc": "We promote quality and rigor in all published works.",
    "about.val2Title": "Accessibility",
    "about.val2Desc": "Knowledge should be accessible to all, without geographic or economic barriers.",
    "about.val3Title": "Knowledge Sharing",
    "about.val3Desc": "We believe in the transformative power of shared knowledge.",
    "about.val4Title": "Innovation",
    "about.val4Desc": "We encourage creativity and new research perspectives.",
    "about.storyTitle": "Our story",
    "about.storyP1": "Founded with a passion for making knowledge accessible, Plume d'Or KMG is the result of a simple vision: creating a space where academic works can be shared and consulted freely.",
    "about.storyP2": "Our name evokes the golden quill, a symbol of noble writing and precious knowledge. We aspire to be that quill that traces the path of knowledge for present and future generations.",
    "about.storyP3": "Today, we continue to develop our collection to offer even more resources to our community of learners and researchers.",

    // Contact
    "contact.title": "Contact Us",
    "contact.description": "A question, a suggestion or a partnership request? Don't hesitate to contact us.",
    "contact.infoTitle": "Our contact details",
    "contact.infoDesc": "We are available to answer all your questions about our academic library.",
    "contact.phone": "Phone",
    "contact.email": "Email",
    "contact.hours": "Hours",
    "contact.hoursValue": "Mon - Sat: 8am - 6pm",
    "contact.formTitle": "Send us a message",
    "contact.name": "Full name",
    "contact.namePlaceholder": "Your name",
    "contact.emailPlaceholder": "your@email.com",
    "contact.subject": "Subject",
    "contact.subjectPlaceholder": "Subject of your message",
    "contact.message": "Message",
    "contact.messagePlaceholder": "Your message...",
    "contact.send": "Send message",
    "contact.sending": "Sending...",
    "contact.success": "Message sent!",
    "contact.successDesc": "We will get back to you as soon as possible.",
    "contact.error": "Error sending message",
    "contact.errorDesc": "Please try again later.",

    // Publication detail
    "pub.back": "Back to library",
    "pub.notFound": "Publication not found",
    "pub.notFoundOnline": "This publication does not exist or is no longer available.",
    "pub.notFoundOffline": "This publication has not been viewed online before and is not available offline.",
    "pub.offlineMode": "Offline mode",
    "pub.offlineBanner": "Offline mode — Reading from local cache",
    "pub.views": "views",
    "pub.description": "Description",
    "pub.document": "Document",
    "pub.protected": "This document is protected. Copying is prohibited.",
    "pub.download": "Download document",
    "pub.availableOffline": "Available offline",

    // Footer
    "footer.description": "Your digital academic library for publishing and accessing books, theses and scientific articles.",
    "footer.navigation": "Navigation",
    "footer.categories": "Categories",
    "footer.contact": "Contact",
    "footer.rights": "All rights reserved.",
    "footer.books": "Books",
    "footer.memoirs": "Theses",
    "footer.tfc": "Papers",
    "footer.articles": "Articles",
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
