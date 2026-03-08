import { Link } from "react-router-dom";
import { Feather, Mail, Phone } from "lucide-react";
import { useLanguage } from "@/contexts/LanguageContext";
import { NewsletterForm } from "@/components/layout/NewsletterForm";

export function Footer() {
  const { t } = useLanguage();

  return (
    <footer className="bg-secondary text-secondary-foreground">
      <div className="container py-12 md:py-16">
        <div className="grid grid-cols-1 gap-8 md:grid-cols-2 lg:grid-cols-4">
          <div className="space-y-4">
            <Link to="/" className="flex items-center gap-2">
              <div className="flex h-10 w-10 items-center justify-center rounded-full bg-primary text-primary-foreground">
                <Feather className="h-5 w-5" />
              </div>
              <div className="flex flex-col">
                <span className="font-serif text-lg font-bold leading-tight">Plume d'Or</span>
                <span className="text-[10px] font-medium uppercase tracking-widest opacity-70">KMG</span>
              </div>
            </Link>
            <p className="text-sm opacity-80 leading-relaxed max-w-xs">{t("footer.description")}</p>
          </div>

          <div>
            <h3 className="font-serif text-lg font-semibold mb-4">{t("footer.navigation")}</h3>
            <ul className="space-y-2 text-sm opacity-80">
              <li><Link to="/" className="hover:text-primary transition-colors">{t("nav.home")}</Link></li>
              <li><Link to="/bibliotheque" className="hover:text-primary transition-colors">{t("nav.library")}</Link></li>
              <li><Link to="/a-propos" className="hover:text-primary transition-colors">{t("nav.about")}</Link></li>
              <li><Link to="/contact" className="hover:text-primary transition-colors">{t("nav.contact")}</Link></li>
            </ul>
          </div>

          <div>
            <h3 className="font-serif text-lg font-semibold mb-4">{t("footer.categories")}</h3>
            <ul className="space-y-2 text-sm opacity-80">
              <li><Link to="/bibliotheque?categorie=livre" className="hover:text-primary transition-colors">{t("footer.books")}</Link></li>
              <li><Link to="/bibliotheque?categorie=memoire" className="hover:text-primary transition-colors">{t("footer.memoirs")}</Link></li>
              <li><Link to="/bibliotheque?categorie=tfc" className="hover:text-primary transition-colors">{t("footer.tfc")}</Link></li>
              <li><Link to="/bibliotheque?categorie=article" className="hover:text-primary transition-colors">{t("footer.articles")}</Link></li>
            </ul>
          </div>

          <div>
            <h3 className="font-serif text-lg font-semibold mb-4">{t("footer.contact")}</h3>
            <ul className="space-y-3 text-sm opacity-80">
              <li className="flex items-center gap-2">
                <Phone className="h-4 w-4 text-primary" />
                <a href="tel:+243998102000" className="hover:text-primary transition-colors">+243 998 102 000</a>
              </li>
              <li className="flex items-center gap-2">
                <Mail className="h-4 w-4 text-primary" />
                <a href="mailto:kmgmultiservices98@gmail.com" className="hover:text-primary transition-colors">kmgmultiservices98@gmail.com</a>
              </li>
            </ul>
          </div>
        </div>

        <div className="mt-12 pt-8 border-t border-secondary-foreground/10">
          <p className="text-center text-sm opacity-60">
            © {new Date().getFullYear()} Plume d'Or KMG. {t("footer.rights")}
          </p>
          <p className="text-center text-xs opacity-40 mt-1">v1.0.9</p>
        </div>
      </div>
    </footer>
  );
}
