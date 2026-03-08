import { Toaster } from "@/components/ui/toaster";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Routes, Route, useLocation, useNavigationType } from "react-router-dom";
import { AnimatePresence } from "framer-motion";
import { useEffect } from "react";
import { warmUpCache } from "@/lib/image-cache";
import { preloadImage } from "@/components/ui/cached-image";
import heroImage from "@/assets/hero-library.webp";
import heroBiblioImage from "@/assets/hero-bibliotheque.webp";
import heroContactImage from "@/assets/hero-contact.webp";
import heroAProposImage from "@/assets/hero-apropos.webp";
import { PushNotificationInit } from "@/components/PushNotificationInit";
import { ThemeProvider } from "@/contexts/ThemeContext";
import { LanguageProvider } from "@/contexts/LanguageContext";
import Index from "./pages/Index";
import Bibliotheque from "./pages/Bibliotheque";
import Publication from "./pages/Publication";
import APropos from "./pages/APropos";
import Contact from "./pages/Contact";
import Auth from "./pages/Auth";
import Profil from "./pages/Profil";
import Abonnement from "./pages/Abonnement";
import AdminLogin from "./pages/admin/AdminLogin";
import AdminDashboard from "./pages/admin/AdminDashboard";
import AdminMessages from "./pages/admin/AdminMessages";
import AdminSettings from "./pages/admin/AdminSettings";
import AdminUsers from "./pages/admin/AdminUsers";
import PublicationForm from "./pages/admin/PublicationForm";
import AdminDevices from "./pages/admin/AdminDevices";
import AdminSubmissions from "./pages/admin/AdminSubmissions";
import DepotMemoire from "./pages/DepotMemoire";
import NotFound from "./pages/NotFound";

const queryClient = new QueryClient();

// Pre-load image cache index at startup for instant lookups on native
warmUpCache().catch(() => {});

// Preload all hero images at startup for instant display
[heroImage, heroBiblioImage, heroContactImage, heroAProposImage].forEach(src => {
  preloadImage(src).catch(() => {});
});

function AnimatedRoutes() {
  const location = useLocation();
  return (
    <AnimatePresence mode="wait">
      <Routes location={location} key={location.pathname}>
        <Route path="/" element={<Index />} />
        <Route path="/bibliotheque" element={<Bibliotheque />} />
        <Route path="/publication/:id" element={<Publication />} />
        <Route path="/a-propos" element={<APropos />} />
        <Route path="/contact" element={<Contact />} />
        <Route path="/auth" element={<Auth />} />
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
        <Route path="*" element={<NotFound />} />
      </Routes>
    </AnimatePresence>
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
            <AnimatedRoutes />
          </BrowserRouter>
        </TooltipProvider>
      </LanguageProvider>
    </ThemeProvider>
  </QueryClientProvider>
);

export default App;
