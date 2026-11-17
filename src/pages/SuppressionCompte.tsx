// Page publique « Supprimer mon compte » : adresse à indiquer à Google Play et à l'App Store.
import { Link } from "react-router-dom";
import { Trash2, Mail } from "lucide-react";
import { Layout } from "@/components/layout/Layout";
import { SEO } from "@/components/seo/SEO";
import { Button } from "@/components/ui/button";
import { useAuth } from "@/hooks/useAuth";

export default function SuppressionCompte() {
  const { user } = useAuth();
  return (
    <Layout>
      <SEO
        title="Supprimer mon compte — KMG Bibliothèque"
        description="Comment supprimer votre compte KMG Bibliothèque et vos données personnelles, depuis le site ou l'application."
        path="/suppression-compte"
      />
      <section className="py-10 md:py-14">
        <div className="container max-w-2xl space-y-6">
          <h1 className="font-serif text-3xl md:text-4xl font-bold text-foreground flex items-center gap-3">
            <Trash2 className="h-8 w-8 text-destructive shrink-0" />
            Supprimer mon compte
          </h1>
          <p className="text-muted-foreground leading-relaxed">
            Vous pouvez supprimer vous-même votre compte KMG Bibliothèque à tout moment, depuis le site
            www.kmgbibliotheque.com ou depuis l'application.
          </p>

          <article className="rounded-2xl border border-border bg-card p-6 space-y-3">
            <h2 className="font-serif text-xl font-semibold">Comment faire</h2>
            <ol className="list-decimal pl-5 space-y-1 text-sm md:text-base text-muted-foreground">
              <li>Connectez-vous à votre compte.</li>
              <li>Ouvrez <strong>Mon profil</strong>.</li>
              <li>En bas de la page, choisissez <strong>Supprimer mon compte</strong>.</li>
              <li>Écrivez <strong>SUPPRIMER</strong> pour confirmer. La suppression est immédiate.</li>
            </ol>
            <Button asChild className="gap-2 mt-2">
              <Link to={user ? "/profil" : "/auth"}>{user ? "Aller à mon profil" : "Me connecter"}</Link>
            </Button>
          </article>

          <article className="rounded-2xl border border-border bg-card p-6 space-y-3 text-sm md:text-base text-muted-foreground">
            <h2 className="font-serif text-xl font-semibold text-foreground">Données effacées</h2>
            <p>
              Votre profil et votre adresse e-mail, vos favoris, votre historique de lecture, vos annotations,
              vos commentaires et messages, vos notifications, vos dépôts de mémoires et votre abonnement.
            </p>
            <h2 className="font-serif text-xl font-semibold text-foreground pt-2">Données conservées</h2>
            <p>
              Les reçus de paiement sont conservés sans lien avec votre compte, pour nos obligations
              comptables. Les ouvrages déjà publiés dans la bibliothèque restent en ligne.
            </p>
          </article>

          <p className="text-sm text-muted-foreground flex items-start gap-2">
            <Mail className="h-4 w-4 mt-0.5 shrink-0" />
            <span>
              Vous n'arrivez plus à vous connecter ? Écrivez-nous depuis l'adresse de votre compte à{" "}
              <a href="mailto:kmgmultiservices98@gmail.com" className="text-primary hover:underline font-medium">
                kmgmultiservices98@gmail.com
              </a>{" "}
              et nous supprimerons votre compte.
            </span>
          </p>
        </div>
      </section>
    </Layout>
  );
}
