import { useState, useEffect } from "react";
import { Layout } from "@/components/layout/Layout";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Download, Smartphone, CheckCircle2, Share, MoreVertical } from "lucide-react";
import { useLanguage } from "@/contexts/LanguageContext";

interface BeforeInstallPromptEvent extends Event {
  prompt: () => Promise<void>;
  userChoice: Promise<{ outcome: "accepted" | "dismissed" }>;
}

export default function InstallApp() {
  const { t } = useLanguage();
  const [deferredPrompt, setDeferredPrompt] = useState<BeforeInstallPromptEvent | null>(null);
  const [isInstalled, setIsInstalled] = useState(false);
  const [isIOS, setIsIOS] = useState(false);

  useEffect(() => {
    // Check if already installed
    if (window.matchMedia("(display-mode: standalone)").matches) {
      setIsInstalled(true);
    }

    // Detect iOS
    const ua = navigator.userAgent;
    setIsIOS(/iPad|iPhone|iPod/.test(ua) && !(window as any).MSStream);

    const handler = (e: Event) => {
      e.preventDefault();
      setDeferredPrompt(e as BeforeInstallPromptEvent);
    };

    window.addEventListener("beforeinstallprompt", handler);
    return () => window.removeEventListener("beforeinstallprompt", handler);
  }, []);

  const handleInstall = async () => {
    if (!deferredPrompt) return;
    await deferredPrompt.prompt();
    const { outcome } = await deferredPrompt.userChoice;
    if (outcome === "accepted") {
      setIsInstalled(true);
    }
    setDeferredPrompt(null);
  };

  return (
    <Layout>
      <section className="container py-16 md:py-24">
        <div className="max-w-2xl mx-auto text-center space-y-6">
          <div className="inline-flex items-center justify-center w-20 h-20 rounded-2xl bg-primary/10 mb-4">
            <Smartphone className="h-10 w-10 text-primary" />
          </div>

          <h1 className="font-serif text-3xl md:text-4xl font-bold text-foreground">
            {t("install.title")}
          </h1>
          <p className="text-lg text-muted-foreground">
            {t("install.description")}
          </p>

          {isInstalled ? (
            <Card className="border-green-500/30 bg-green-500/5">
              <CardContent className="flex items-center justify-center gap-3 py-6">
                <CheckCircle2 className="h-6 w-6 text-green-500" />
                <span className="text-lg font-medium text-green-600 dark:text-green-400">
                  {t("install.alreadyInstalled")}
                </span>
              </CardContent>
            </Card>
          ) : deferredPrompt ? (
            <Button size="lg" onClick={handleInstall} className="gap-2 text-lg px-8 py-6">
              <Download className="h-5 w-5" />
              {t("install.installButton")}
            </Button>
          ) : isIOS ? (
            <Card>
              <CardContent className="py-6 space-y-4">
                <p className="font-medium text-foreground">{t("install.iosTitle")}</p>
                <ol className="text-left space-y-3 text-muted-foreground">
                  <li className="flex items-start gap-3">
                    <span className="flex-shrink-0 w-6 h-6 rounded-full bg-primary/10 text-primary text-sm flex items-center justify-center font-bold">1</span>
                    <span className="flex items-center gap-1">
                      {t("install.iosStep1")} <Share className="h-4 w-4 inline" />
                    </span>
                  </li>
                  <li className="flex items-start gap-3">
                    <span className="flex-shrink-0 w-6 h-6 rounded-full bg-primary/10 text-primary text-sm flex items-center justify-center font-bold">2</span>
                    <span>{t("install.iosStep2")}</span>
                  </li>
                  <li className="flex items-start gap-3">
                    <span className="flex-shrink-0 w-6 h-6 rounded-full bg-primary/10 text-primary text-sm flex items-center justify-center font-bold">3</span>
                    <span>{t("install.iosStep3")}</span>
                  </li>
                </ol>
              </CardContent>
            </Card>
          ) : (
            <Card>
              <CardContent className="py-6 space-y-4">
                <p className="font-medium text-foreground">{t("install.androidTitle")}</p>
                <ol className="text-left space-y-3 text-muted-foreground">
                  <li className="flex items-start gap-3">
                    <span className="flex-shrink-0 w-6 h-6 rounded-full bg-primary/10 text-primary text-sm flex items-center justify-center font-bold">1</span>
                    <span className="flex items-center gap-1">
                      {t("install.androidStep1")} <MoreVertical className="h-4 w-4 inline" />
                    </span>
                  </li>
                  <li className="flex items-start gap-3">
                    <span className="flex-shrink-0 w-6 h-6 rounded-full bg-primary/10 text-primary text-sm flex items-center justify-center font-bold">2</span>
                    <span>{t("install.androidStep2")}</span>
                  </li>
                </ol>
              </CardContent>
            </Card>
          )}

          {/* Features */}
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 pt-8">
            {["install.feature1", "install.feature2", "install.feature3"].map((key, i) => (
              <Card key={i} className="text-center">
                <CardContent className="py-4">
                  <p className="text-sm font-medium text-foreground">{t(key as any)}</p>
                </CardContent>
              </Card>
            ))}
          </div>
        </div>
      </section>
    </Layout>
  );
}
