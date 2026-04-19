import { ReactNode } from "react";
import { Header } from "./Header";
import { Footer } from "./Footer";
import { ThemeSuggestionBanner } from "./ThemeSuggestionBanner";
import { PageTransition } from "./PageTransition";
import { AppDownloadBanner } from "./AppDownloadBanner";
import { ScrollToTopButton } from "@/components/ui/scroll-to-top-button";

interface LayoutProps {
  children: ReactNode;
}

export function Layout({ children }: LayoutProps) {
  return (
    <div className="flex min-h-screen flex-col">
      <AppDownloadBanner />
      <Header />
      <ThemeSuggestionBanner />
      <main className="flex-1">
        <PageTransition>{children}</PageTransition>
      </main>
      <Footer />
      <ScrollToTopButton />
    </div>
  );
}
