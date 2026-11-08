# Migration KMG Bibliothèque hors de Lovable

Branche : `migration-infra`. Rien de ce dossier n'agit sur la production tant qu'il n'est pas exécuté manuellement.

## Orientations validées (08/11/2026)

1. Services gérés : Supabase Cloud (organisation KMG, formule Pro) + Cloudflare Pages + DNS Cloudflare.
2. Domaine conservé (`www.kmgbibliotheque.com`), bascule **sans interruption**.
3. Projets **Firebase** et **Google Play** existants conservés (identifiant d'application `app.lovable.d11bc5d4512e4b5f9f8a79e7ee7ad869` inchangé).
4. Certificats : anciens QR codes conservés et vérifiables, nouveaux certificats sur le même système.

## Architecture cible

| Couche | Service |
|---|---|
| Site web (Vite, prérendu) | Cloudflare Pages, build depuis GitHub |
| DNS, HTTPS, redirections 301 | Cloudflare (zone `kmgbibliotheque.com`) |
| Base, Auth, Storage, Realtime, fonctions Edge, pg_cron | Supabase Cloud, nouveau projet Pro |
| IA (résumés, couvertures) | API Google Gemini (`GEMINI_API_KEY`) |
| E-mails | Resend, domaine vérifié + SMTP personnalisé pour Auth |
| Notifications push | Firebase Cloud Messaging, projet existant |
| Search Console | API Google directe, compte de service |

## Variables et secrets

**Site (Cloudflare Pages, variables de build)** : `VITE_SUPABASE_URL`, `VITE_SUPABASE_PUBLISHABLE_KEY`, `VITE_SUPABASE_PROJECT_ID`, `VITE_SITE_URL`.

**Fonctions Edge (`supabase secrets set`)** :

| Secret | Usage | Source |
|---|---|---|
| `SITE_URL` | liens de vérification, sitemap, GSC | `https://www.kmgbibliotheque.com` |
| `GEMINI_API_KEY` | summarize-publication, generate-cover | Google AI Studio |
| `GEMINI_TEXT_MODEL`, `GEMINI_IMAGE_MODEL` | facultatif | défauts : `gemini-3-flash-preview`, `gemini-3-pro-image-preview` |
| `RESEND_API_KEY` | notify-admin-*, send-newsletter | Resend |
| `EMAIL_FROM` | expéditeur | ex. `KMG Bibliothèque <noreply@kmgbibliotheque.com>` (domaine vérifié) |
| `FCM_SERVICE_ACCOUNT_JSON` | send-push-notification, send-chat-push | **projet Firebase existant**, nouvelle clé de compte de service |
| `GSC_SERVICE_ACCOUNT_JSON` | gsc-admin | Google Cloud, compte de service ajouté propriétaire dans Search Console |

`SUPABASE_URL`, `SUPABASE_ANON_KEY`, `SUPABASE_SERVICE_ROLE_KEY` sont fournis automatiquement par Supabase.

**Vault (base de données)** : `project_url`, `service_role_key` — voir `sql/01_backend_urls_via_vault.sql`.

**Plus utilisés** : `LOVABLE_API_KEY`, `GOOGLE_SEARCH_CONSOLE_API_KEY` (connecteur Lovable).

## Certificats : compatibilité

QR codes existants (export du 08/11/2026) :

| Certificats | URL encodée dans le QR |
|---|---|
| CERT-2026-001 à 014 | `https://plume-d-or-academie.lovable.app/publication/<KMG-…>` |
| KMG-MEM-2026-001 | `https://plume-d-or-academie.lovable.app/verify/KMG-MEM-2026-001` |
| CERT-2026-015 | `https://www.kmgbibliotheque.com/publication/<KMG-…>` |

- Le nouveau site accepte `/publication/<numéro>` et `/verify/<numéro>` avec un numéro de **publication ou de certificat** (repli sur la table `certificates`).
- Nouveaux certificats : `SITE_URL/publication/<numéro>` (format inchangé).
- **Domaine `plume-d-or-academie.lovable.app`** : seul Lovable peut le servir. On y laisse publiée une version du site dont `index.html` redirige vers `www.kmgbibliotheque.com` en conservant le chemin (liste `LEGACY`). C'est la seule dépendance résiduelle à Lovable ; si ce domaine disparaissait un jour, la vérification resterait possible par saisie du numéro sur `/verification`.

## Bascule sans interruption (principe)

1. Nouveau backend prêt et testé en parallèle ; ancien backend inchangé.
2. TTL DNS abaissé à 300 s 48 h avant ; domaine ajouté à Cloudflare Pages et certificat HTTPS émis à l'avance.
3. Application Android publiée **avant** la bascule (nouvelle URL backend), même identifiant, même projet Firebase, même clé d'upload Play.
4. Jour J : courte pause des actions admin (pas de publication), dump final, import différentiel, réécriture des URL de fichiers, tests rapides, bascule DNS.
5. Second import différentiel des tables utilisateur (lignes créées/modifiées après T) une fois la propagation DNS terminée.
6. Ancien backend conservé intact plusieurs semaines (retour arrière = DNS).

## Étapes suivantes (phase 2, après validation)

- [ ] Créer l'organisation et le projet Supabase (région proche des utilisateurs), formule Pro.
- [ ] Appliquer le schéma (migrations du dépôt + `20260607080140` de l'export), puis `sql/01_…`.
- [ ] Importer `auth.users` + `auth.identities` (test sur 3 comptes), puis les tables `public`.
- [ ] Recréer les buckets, téléverser les 202 fichiers référencés, vérifier les SHA-256.
- [ ] Réécrire les URL de fichiers dans la nouvelle base ; reporter `KMG-MEM-2026-001` sur sa publication.
- [ ] Déployer les fonctions Edge et les secrets ; configurer Auth (Google, SMTP, URL de redirection).
- [ ] Déployer le site sur une URL de test Cloudflare Pages ; dérouler le plan de tests.
