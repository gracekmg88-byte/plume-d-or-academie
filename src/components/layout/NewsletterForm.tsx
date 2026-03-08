import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Mail, CheckCircle2, Loader2 } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useLanguage } from "@/contexts/LanguageContext";
import { toast } from "@/hooks/use-toast";

export function NewsletterForm() {
  const { t } = useLanguage();
  const [email, setEmail] = useState("");
  const [name, setName] = useState("");
  const [loading, setLoading] = useState(false);
  const [subscribed, setSubscribed] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!email) return;

    setLoading(true);
    try {
      const { error } = await supabase
        .from("newsletter_subscribers" as any)
        .insert([{ email, name: name || null }] as any);

      if (error) {
        if (error.code === "23505") {
          toast({ title: t("newsletter.alreadySubscribed") });
        } else {
          throw error;
        }
      }

      setSubscribed(true);
      setEmail("");
      setName("");
    } catch (err: any) {
      toast({ title: t("newsletter.error"), variant: "destructive" });
    } finally {
      setLoading(false);
    }
  };

  if (subscribed) {
    return (
      <div className="flex items-center gap-2 text-primary">
        <CheckCircle2 className="h-5 w-5" />
        <span className="text-sm font-medium">{t("newsletter.success")}</span>
      </div>
    );
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-2">
      <Input
        type="text"
        placeholder={t("newsletter.namePlaceholder")}
        value={name}
        onChange={(e) => setName(e.target.value)}
        className="h-9 bg-background/10 border-secondary-foreground/20 text-secondary-foreground placeholder:text-secondary-foreground/50"
      />
      <div className="flex gap-2">
        <Input
          type="email"
          required
          placeholder={t("newsletter.emailPlaceholder")}
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          className="h-9 bg-background/10 border-secondary-foreground/20 text-secondary-foreground placeholder:text-secondary-foreground/50"
        />
        <Button type="submit" size="sm" disabled={loading} className="h-9 gap-1 shrink-0">
          {loading ? <Loader2 className="h-4 w-4 animate-spin" /> : <Mail className="h-4 w-4" />}
          {t("newsletter.subscribe")}
        </Button>
      </div>
    </form>
  );
}
