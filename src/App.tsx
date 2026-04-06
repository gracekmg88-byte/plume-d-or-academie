import { Toaster } from "@/components/ui/toaster";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Routes, Route, useLocation, useNavigationType } from "react-router-dom";

import { lazy, Suspense, useEffect, useRef } from "react";
import { warmUpCache } from "@/lib/image-cache";
import { preloadImage } from "@/components/ui/cached-image";
import heroImage from "@/assets/hero-library.webp";
import heroBiblioImage from "@/assets/hero-bibliotheque.webp";
import heroContactImage from "@/assets/hero-contact.webp";
import heroAProposImage from "@/assets/hero-apropos.webp";
import { PushNotificationInit } from "@/components/PushNotificationInit";
import { ThemeProvider } from "@/contexts/ThemeContext";
import { LanguageProvider } from "@/contexts/LanguageContext";

// Eager-load the home page for instant first paint
import Index from "./pages/Index";

// Lazy-load all other pages for code-splitting
const Bibliotheque = lazy(() => import("./pages/Bibliotheque"));
const Publication = lazy(() => import("./pages/Publication"));
const APropos = lazy(() => import("./pages/APropos"));
const Contact = lazy(() => import("./pages/Contact"));
const Auth = lazy(() => import("./pages/Auth"));
const ResetPassword = lazy(() => import("./pages/ResetPassword"));
const Profil = lazy(() => import("./pages/Profil"));
const Abonnement = lazy(() => import("./pages/Abonnement"));
const AdminLogin = lazy(() => import("./pages/admin/AdminLogin"));
const AdminDashboard = lazy(() => import("./pages/admin/AdminDashboard"));
const AdminMessages = lazy(() => import("./pages/admin/AdminMessages"));
const AdminSettings = lazy(() => import("./pages/admin/AdminSettings"));
const AdminUsers = lazy(() => import("./pages/admin/AdminUsers"));
const PublicationForm = lazy(() => import("./pages/admin/PublicationForm"));
const AdminDevices = lazy(() => import("./pages/admin/AdminDevices"));
const AdminSubmissions = lazy(() => import("./pages/admin/AdminSubmissions"));
const DepotMemoire = lazy(() => import("./pages/DepotMemoire"));
const Chat = lazy(() => import("./pages/Chat"));
const InstallApp = lazy(() => import("./pages/InstallApp"));
const NotFound = lazy(() => import("./pages/NotFound"));

const queryClient = new QueryClient();

// Pre-load image cache index at startup for instant lookups on native
warmUpCache().catch(() => {});

// Preload all hero images at startup for instant display
[heroImage, heroBiblioImage, heroContactImage, heroAProposImage].forEach(src => {
  preloadImage(src).catch(() => {});
});

function ScrollManager() {
  const { pathname } = useLocation();
  const navType = useNavigationType();
  const prevPathRef = useRef(pathname);
  const isRestoringRef = useRef(false);

  useEffect(() => {
    const prev = prevPathRef.current;
    prevPathRef.current = pathname;

    if (prev !== pathname && prev) {
      // Save scroll position for the page we're LEAVING before anything else
      sessionStorage.setItem(`scroll:${prev}`, String(window.scrollY));
    }

    if (navType === "POP") {
      // Restore scroll position
      const saved = sessionStorage.getItem(`scroll:${pathname}`);
      if (saved) {
        const y = parseInt(saved, 10);
        if (y > 0) {
          isRestoringRef.current = true;
          const delays = [0, 50, 150, 300, 500, 800, 1200];
          delays.forEach((delay) => {
            setTimeout(() => {
              if (Math.abs(window.scrollY - y) > 50) {
                window.scrollTo({ top: y, left: 0, behavior: "instant" });
              }
            }, delay);
          });
          setTimeout(() => { isRestoringRef.current = false; }, 1500);
        }
      }
    } else if (prev !== pathname) {
      // Forward navigation: scroll to top
      window.scrollTo({ top: 0, left: 0, behavior: "instant" });
    }
  }, [pathname, navType]);

  // Continuously save scroll position, but not during restoration
  useEffect(() => {
    const handleScroll = () => {
      if (!isRestoringRef.current) {
        sessionStorage.setItem(`scroll:${pathname}`, String(window.scrollY));
      }
    };
    window.addEventListener("scroll", handleScroll, { passive: true });
    return () => window.removeEventListener("scroll", handleScroll);
  }, [pathname]);

  return null;
}

function PageLoader() {
  return (
    <div className="min-h-screen flex items-center justify-center">
      <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary" />
    </div>
  );
}

function AnimatedRoutes() {
  const location = useLocation();
  return (
    <Suspense fallback={<PageLoader />}>
      <Routes location={location} key={location.pathname}>
        <Route path="/" element={<Index />} />
        <Route path="/bibliotheque" element={<Bibliotheque />} />
        <Route path="/publication/:id" element={<Publication />} />
        <Route path="/a-propos" element={<APropos />} />
        <Route path="/contact" element={<Contact />} />
        <Route path="/auth" element={<Auth />} />
        <Route path="/reset-password" element={<ResetPassword />} />
        <Route path="/profil" element={<Profil />} />
        <Route path="/abonnement" element={<Abonnement />} />
        <Route path="/admin" element={<AdminLogin />} />
        <Route path="/admin/dashboard" element={<AdminDashboard />} />
        <Route path="/admin/messages" element={<AdminMessages />} />
        <Route path="/admin/settings" element={<AdminSettings />} />
        <Route path="/admin/users" element={<AdminUsers />} />
        <Route path="/admin/publication/:id" element={<PublicationForm />} />
        <Route path="/admin/devices" element={<AdminDevices />} />
        <Route path="/admin/submissions" element={<AdminSubmissions />} />
        <Route path="/depot-memoire" element={<DepotMemoire />} />
        <Route path="/chat" element={<Chat />} />
        <Route path="/installer" element={<InstallApp />} />
        <Route path="*" element={<NotFound />} />
      </Routes>
    </Suspense>
  );
}

const App = () => (
  <QueryClientProvider client={queryClient}>
    <ThemeProvider>
      <LanguageProvider>
        <TooltipProvider>
          <Toaster />
          <Sonner />
          <PushNotificationInit />
          <BrowserRouter>
            <ScrollManager />
            <AnimatedRoutes />
          </BrowserRouter>
        </TooltipProvider>
      </LanguageProvider>
    </ThemeProvider>
  </QueryClientProvider>
);

export default App;
