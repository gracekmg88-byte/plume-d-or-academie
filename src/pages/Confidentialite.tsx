import { Shield, Lock, UserCheck, Database, Mail, AlertTriangle, Cookie, Globe } from "lucide-react";
import { Layout } from "@/components/layout/Layout";
import { SEO } from "@/components/seo/SEO";

export default function Confidentialite() {
  const sections = [
    {
      icon: UserCheck,
      title: "Authentification & accès",
      body: (
        <>
          <p>
            L'accès au compte se fait par email/mot de passe ou via Google. Les mots de passe sont
            stockés par notre fournisseur d'authentification sous forme de hash sécurisé — nous n'y
            avons jamais accès en clair. Une vérification anti-fuite (HIBP) peut être activée pour
            refuser les mots de passe compromis.
          </p>
          <p>
            Les actions sensibles (espace d'administration, dépôts de mémoires, commentaires) sont
            protégées côté serveur par des règles d'accès au niveau ligne (RLS) en plus des contrôles
            d'interface.
          </p>
        </>
      ),
    },
    {
      icon: Database,
      title: "Données collectées",
      body: (
        <>
          <p>Nous collectons uniquement les données nécessaires au fonctionnement de la bibliothèque :</p>
          <ul className="list-disc pl-6 space-y-1">
            <li>Profil : nom, email, préférences de langue et de thème.</li>
            <li>Activité : historique de lecture, favoris, annotations, commentaires.</li>
            <li>Soumissions : fichiers déposés (mémoires, TFC, articles) et métadonnées associées.</li>
            <li>Notifications : tokens d'appareils utilisés pour les notifications push.</li>
          </ul>
          <p>
            Aucune donnée n'est vendue. Les contenus académiques restent la propriété de leurs
            auteurs.
          </p>
        </>
      ),
    },
    {
      icon: Lock,
      title: "Protection des contenus",
      body: (
        <>
          <p>
            Les PDF sont diffusés via un lecteur protégé (désactivation du clic droit, de la
            sélection et téléchargement, filigrane). Le téléchargement est contrôlé globalement et
            par publication par l'équipe administrative.
          </p>
        </>
      ),
    },
    {
      icon: Cookie,
      title: "Cookies & stockage local",
      body: (
        <>
          <p>
            Nous utilisons le stockage local du navigateur pour conserver votre session, vos
            préférences (thème, langue) et permettre la lecture hors-ligne. Aucun cookie publicitaire
            ni traqueur tiers n'est utilisé.
          </p>
        </>
      ),
    },
    {
      icon: Globe,
      title: "Sous-traitants",
      body: (
        <>
          <p>Nous nous appuyons sur des prestataires sélectionnés pour faire fonctionner le service :</p>
          <ul className="list-disc pl-6 space-y-1">
            <li>Hébergement applicatif et base de données.</li>
            <li>Envoi d'emails transactionnels (notifications administrateur, newsletter).</li>
            <li>Notifications push mobiles (FCM).</li>
          </ul>
          <p>Ces prestataires n'accèdent qu'aux données strictement nécessaires à leur mission.</p>
        </>
      ),
    },
    {
      icon: Shield,
      title: "Conservation & suppression",
      body: (
        <>
          <p>
            Les données de compte sont conservées tant que le compte est actif. Vous pouvez nous
            demander à tout moment l'export ou la suppression de vos données personnelles par email.
            Les contenus déposés peuvent être retirés sur demande de leur auteur.
          </p>
        </>
      ),
    },
    {
      icon: AlertTriangle,
      title: "Signalement de vulnérabilité",
      body: (
        <>
          <p>
            Si vous identifiez une faille de sécurité, merci de nous contacter en privé à l'adresse
            ci-dessous avant toute divulgation publique. Nous accusons réception et traitons les
            rapports dans les meilleurs délais.
          </p>
        </>
      ),
    },
    {
      icon: Mail,
      title: "Contact",
      body: (
        <>
          <p>
            Pour toute question relative à vos données, à la sécurité ou à la confidentialité :{" "}
            <a
              href="mailto:kmgmultiservices98@gmail.com"
              className="text-primary hover:underline font-medium"
            >
              kmgmultiservices98@gmail.com
            </a>
          </p>
        </>
      ),
    },
  ];

  return (
    <Layout>
      <SEO
        title="Confidentialité & sécurité — KMG Bibliothèque"
        description="Page maintenue par KMG Multi Services expliquant comment Plume d'Or KMG protège vos données, vos lectures et vos contenus déposés."
        path="/confidentialite"
      />

      <section className="bg-gradient-to-b from-secondary/90 to-background py-12 md:py-16">
        <div className="container max-w-4xl">
          <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-primary/10 text-primary text-sm font-medium mb-4">
            <Shield className="h-4 w-4" />
            Confiance & confidentialité
          </div>
          <h1 className="font-serif text-3xl md:text-4xl lg:text-5xl font-bold text-foreground mb-4">
            Confidentialité & sécurité
          </h1>
          <p className="text-muted-foreground text-base md:text-lg leading-relaxed">
            Cette page est maintenue par <strong>KMG Multi Services</strong>, éditeur de Plume d'Or
            KMG, pour répondre aux questions courantes sur la sécurité, la confidentialité et la
            gestion des données dans la bibliothèque. Elle décrit les pratiques actuelles de
            l'application et ne constitue pas une certification indépendante.
          </p>
        </div>
      </section>

      <section className="py-10 md:py-14">
        <div className="container max-w-4xl space-y-6">
          {sections.map(({ icon: Icon, title, body }) => (
            <article
              key={title}
              className="rounded-2xl border border-border bg-card p-6 md:p-8 shadow-sm"
            >
              <div className="flex items-start gap-4">
                <div className="shrink-0 h-11 w-11 rounded-xl bg-primary/10 text-primary flex items-center justify-center">
                  <Icon className="h-5 w-5" />
                </div>
                <div className="flex-1 min-w-0">
                  <h2 className="font-serif text-xl md:text-2xl font-semibold text-foreground mb-3">
                    {title}
                  </h2>
                  <div className="space-y-3 text-sm md:text-base text-muted-foreground leading-relaxed">
                    {body}
                  </div>
                </div>
              </div>
            </article>
          ))}

          <p className="text-xs text-muted-foreground text-center pt-4">
            Dernière mise à jour : {new Date().toLocaleDateString("fr-FR", { year: "numeric", month: "long" })}.
          </p>
        </div>
      </section>
    </Layout>
  );
}
