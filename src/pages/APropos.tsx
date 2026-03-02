import { BookOpen, Target, Users, Award, Heart, Lightbulb } from "lucide-react";
import { useParallax } from "@/hooks/useParallax";
import { Layout } from "@/components/layout/Layout";
import { useLanguage } from "@/contexts/LanguageContext";
import heroAProposImage from "@/assets/hero-apropos.jpg";

export default function APropos() {
  const { t } = useLanguage();
  const { sectionRef, imgStyle } = useParallax();

  const values = [
    { icon: BookOpen, titleKey: "about.val1Title" as const, descKey: "about.val1Desc" as const },
    { icon: Users, titleKey: "about.val2Title" as const, descKey: "about.val2Desc" as const },
    { icon: Heart, titleKey: "about.val3Title" as const, descKey: "about.val3Desc" as const },
    { icon: Lightbulb, titleKey: "about.val4Title" as const, descKey: "about.val4Desc" as const },
  ];

  return (
    <Layout>
      <section ref={sectionRef} className="relative overflow-hidden py-12 md:py-16">
        <div className="absolute inset-0">
          <img src={heroAProposImage} alt="" className="h-full w-full object-cover" style={imgStyle} loading="eager" fetchPriority="high" decoding="sync" />
          <div className="absolute inset-0 bg-gradient-to-r from-secondary/95 via-secondary/85 to-secondary/70" />
        </div>
        <div className="relative container">
          <div className="max-w-3xl animate-slide-up">
            <h1 className="font-serif text-3xl md:text-4xl lg:text-5xl font-bold text-secondary-foreground mb-6">
              {t("about.title")}
            </h1>
            <p className="text-secondary-foreground/80 text-lg md:text-xl leading-relaxed">
              {t("about.description")}
            </p>
          </div>
        </div>
      </section>

      <section className="py-16 md:py-24 bg-background">
        <div className="container">
          <div className="grid lg:grid-cols-2 gap-12 items-center">
            <div className="space-y-6">
              <div className="inline-flex items-center gap-2 px-4 py-2 rounded-full bg-primary/10 text-primary">
                <Target className="h-4 w-4" />
                <span className="text-sm font-medium">{t("about.missionBadge")}</span>
              </div>
              <h2 className="font-serif text-3xl md:text-4xl font-bold text-foreground">
                {t("about.missionTitle")}
              </h2>
              <div className="space-y-4 text-muted-foreground leading-relaxed">
                <p>{t("about.missionP1")}</p>
                <p>{t("about.missionP2")}</p>
                <p>{t("about.missionP3")}</p>
              </div>
            </div>
            <div className="relative">
              <div className="aspect-square rounded-2xl bg-gradient-to-br from-primary/20 to-accent overflow-hidden">
                <div className="absolute inset-0 flex items-center justify-center">
                  <div className="text-center p-8">
                    <Award className="h-24 w-24 mx-auto text-primary mb-6" />
                    <h3 className="font-serif text-2xl font-bold text-foreground mb-2">
                      {t("about.qualityTitle")}
                    </h3>
                    <p className="text-muted-foreground">{t("about.qualityDesc")}</p>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>

      <section className="py-16 md:py-24 bg-parchment">
        <div className="container">
          <div className="text-center max-w-2xl mx-auto mb-12">
            <h2 className="font-serif text-3xl md:text-4xl font-bold text-foreground mb-4">
              {t("about.valuesTitle")}
            </h2>
            <p className="text-muted-foreground leading-relaxed">{t("about.valuesSubtitle")}</p>
          </div>
          <div className="grid sm:grid-cols-2 lg:grid-cols-4 gap-6">
            {values.map((value) => {
              const Icon = value.icon;
              return (
                <div key={value.titleKey} className="group p-6 rounded-xl bg-card border border-border hover:shadow-elegant transition-all duration-300 text-center">
                  <div className="h-14 w-14 rounded-full bg-primary/10 flex items-center justify-center mx-auto mb-4 group-hover:bg-primary transition-colors">
                    <Icon className="h-7 w-7 text-primary group-hover:text-primary-foreground transition-colors" />
                  </div>
                  <h3 className="font-serif text-lg font-semibold text-foreground mb-2">{t(value.titleKey)}</h3>
                  <p className="text-sm text-muted-foreground leading-relaxed">{t(value.descKey)}</p>
                </div>
              );
            })}
          </div>
        </div>
      </section>

      <section className="py-16 md:py-24 bg-background">
        <div className="container">
          <div className="max-w-3xl mx-auto text-center space-y-6">
            <h2 className="font-serif text-3xl md:text-4xl font-bold text-foreground">
              {t("about.storyTitle")}
            </h2>
            <div className="text-muted-foreground leading-relaxed space-y-4 text-left md:text-center">
              <p>{t("about.storyP1")}</p>
              <p>{t("about.storyP2")}</p>
              <p>{t("about.storyP3")}</p>
            </div>
          </div>
        </div>
      </section>
    </Layout>
  );
}
