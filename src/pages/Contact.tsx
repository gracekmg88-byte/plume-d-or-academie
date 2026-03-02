import { Phone, Mail, MessageSquare, Clock, Send } from "lucide-react";

import { Layout } from "@/components/layout/Layout";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { useState } from "react";
import { toast } from "sonner";
import { useSubmitContactMessage } from "@/hooks/useContactMessages";
import { useLanguage } from "@/contexts/LanguageContext";
import heroContactImage from "@/assets/hero-contact.jpg";

export default function Contact() {
  const { t } = useLanguage();
  
  const [formData, setFormData] = useState({ name: "", email: "", subject: "", message: "" });
  const submitMessage = useSubmitContactMessage();

  const contactInfo = [
    { icon: Phone, labelKey: "contact.phone" as const, value: "+243 998 102 000", href: "tel:+243998102000" },
    { icon: Mail, labelKey: "contact.email" as const, value: "kmgmultiservices98@gmail.com", href: "mailto:kmgmultiservices98@gmail.com" },
    { icon: Clock, labelKey: "contact.hours" as const, value: t("contact.hoursValue"), href: null as string | null },
  ];

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      await submitMessage.mutateAsync(formData);
      toast.success(t("contact.success"), { description: t("contact.successDesc") });
      setFormData({ name: "", email: "", subject: "", message: "" });
    } catch {
      toast.error(t("contact.error"), { description: t("contact.errorDesc") });
    }
  };

  return (
    <Layout>
      <section className="relative overflow-hidden py-12 md:py-16">
        <div className="absolute inset-0">
          <img src={heroContactImage} alt="" className="h-full w-full object-cover" loading="eager" fetchPriority="high" decoding="sync" />
          <div className="absolute inset-0 bg-gradient-to-r from-secondary/95 via-secondary/85 to-secondary/70" />
        </div>
        <div className="relative container">
          <div className="max-w-3xl animate-slide-up">
            <h1 className="font-serif text-3xl md:text-4xl lg:text-5xl font-bold text-secondary-foreground mb-6">
              {t("contact.title")}
            </h1>
            <p className="text-secondary-foreground/80 text-lg md:text-xl leading-relaxed">
              {t("contact.description")}
            </p>
          </div>
        </div>
      </section>

      <section className="py-16 md:py-24 bg-background">
        <div className="container">
          <div className="grid lg:grid-cols-5 gap-12">
            <div className="lg:col-span-2 space-y-8">
              <div>
                <h2 className="font-serif text-2xl font-bold text-foreground mb-4">{t("contact.infoTitle")}</h2>
                <p className="text-muted-foreground leading-relaxed">{t("contact.infoDesc")}</p>
              </div>
              <div className="space-y-4">
                {contactInfo.map((info) => {
                  const Icon = info.icon;
                  const content = (
                    <div className="flex items-start gap-4 p-4 rounded-xl bg-card border border-border hover:shadow-elegant transition-all duration-300">
                      <div className="h-12 w-12 rounded-lg bg-primary/10 flex items-center justify-center shrink-0">
                        <Icon className="h-6 w-6 text-primary" />
                      </div>
                      <div>
                        <div className="text-sm text-muted-foreground mb-1">{t(info.labelKey)}</div>
                        <div className="font-medium text-foreground">{info.value}</div>
                      </div>
                    </div>
                  );
                  return info.href ? (
                    <a key={info.labelKey} href={info.href} className="block">{content}</a>
                  ) : (
                    <div key={info.labelKey}>{content}</div>
                  );
                })}
              </div>
            </div>

            <div className="lg:col-span-3">
              <div className="bg-card rounded-2xl border border-border p-6 md:p-8 shadow-elegant">
                <div className="flex items-center gap-3 mb-6">
                  <MessageSquare className="h-6 w-6 text-primary" />
                  <h2 className="font-serif text-2xl font-bold text-foreground">{t("contact.formTitle")}</h2>
                </div>
                <form onSubmit={handleSubmit} className="space-y-6">
                  <div className="grid sm:grid-cols-2 gap-4">
                    <div className="space-y-2">
                      <Label htmlFor="name">{t("contact.name")}</Label>
                      <Input id="name" value={formData.name} onChange={(e) => setFormData({ ...formData, name: e.target.value })} placeholder={t("contact.namePlaceholder")} required />
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="email">{t("contact.email")}</Label>
                      <Input id="email" type="email" value={formData.email} onChange={(e) => setFormData({ ...formData, email: e.target.value })} placeholder={t("contact.emailPlaceholder")} required />
                    </div>
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="subject">{t("contact.subject")}</Label>
                    <Input id="subject" value={formData.subject} onChange={(e) => setFormData({ ...formData, subject: e.target.value })} placeholder={t("contact.subjectPlaceholder")} required />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="message">{t("contact.message")}</Label>
                    <Textarea id="message" value={formData.message} onChange={(e) => setFormData({ ...formData, message: e.target.value })} placeholder={t("contact.messagePlaceholder")} rows={6} required />
                  </div>
                  <Button type="submit" size="lg" className="w-full gap-2" disabled={submitMessage.isPending}>
                    <Send className="h-4 w-4" />
                    {submitMessage.isPending ? t("contact.sending") : t("contact.send")}
                  </Button>
                </form>
              </div>
            </div>
          </div>
        </div>
      </section>
    </Layout>
  );
}
