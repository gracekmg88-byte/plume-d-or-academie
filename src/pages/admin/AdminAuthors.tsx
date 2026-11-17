// Espace admin — profils des auteurs : biographie et photo affichées sur /auteur/<slug>
// et utilisées par le référencement (JSON-LD Person, image de partage).
// La liste des auteurs vient des publications (champ « auteur ») ; un profil est rattaché
// par le slug du nom, exactement comme l'adresse de la page auteur.
import { useMemo, useRef, useState } from "react";
import { BACK_TO_DASHBOARD_STATE } from "@/lib/admin-nav";
import { Link } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import { ArrowLeft, ExternalLink, ImagePlus, Loader2, Pencil, Search, Trash2, User, Users } from "lucide-react";
import { toast } from "sonner";
import { Layout } from "@/components/layout/Layout";
import { SEO } from "@/components/seo/SEO";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { supabase } from "@/integrations/supabase/client";
import { slugifyAuthor, buildAuthorPath } from "@/lib/slug";
import {
  type AuthorProfile,
  removeAuthorPhoto,
  uploadAuthorPhoto,
  useAuthorProfiles,
  useDeleteAuthorProfile,
  useSaveAuthorProfile,
} from "@/hooks/useAuthorProfiles";

const BIO_MAX = 10000;

interface AuthorRow {
  slug: string;
  name: string;
  total: number;
  published: number;
  profile?: AuthorProfile;
}

function useAuthorNames() {
  return useQuery({
    queryKey: ["admin-author-names"],
    queryFn: async () => {
      const { data, error } = await supabase.from("publications").select("author,is_published").limit(10000);
      if (error) throw error;
      return data || [];
    },
  });
}

export default function AdminAuthors() {
  const { data: pubs = [], isLoading: loadingPubs } = useAuthorNames();
  const { data: profiles = [], isLoading: loadingProfiles, error: profilesError } = useAuthorProfiles();
  const [q, setQ] = useState("");
  const [filter, setFilter] = useState<"tous" | "sans" | "avec">("tous");
  const [editing, setEditing] = useState<AuthorRow | null>(null);

  const rows = useMemo<AuthorRow[]>(() => {
    const bySlug = new Map<string, AuthorRow>();
    for (const p of pubs) {
      const name = (p.author || "").replace(/\s+/g, " ").trim();
      if (!name) continue;
      const slug = slugifyAuthor(name);
      const row = bySlug.get(slug) ?? { slug, name, total: 0, published: 0 };
      row.total++;
      if (p.is_published) row.published++;
      bySlug.set(slug, row);
    }
    for (const prof of profiles) {
      const row = bySlug.get(prof.slug);
      if (row) row.profile = prof;
    }
    return [...bySlug.values()].sort((a, b) => a.name.localeCompare(b.name, "fr"));
  }, [pubs, profiles]);

  const filtered = useMemo(() => {
    const term = q.trim().toLowerCase();
    return rows.filter((r) => {
      if (term && !r.name.toLowerCase().includes(term)) return false;
      const has = !!(r.profile?.biography || r.profile?.photo_url);
      if (filter === "sans") return !has;
      if (filter === "avec") return has;
      return true;
    });
  }, [rows, q, filter]);

  const withProfile = rows.filter((r) => r.profile?.biography || r.profile?.photo_url).length;
  const loading = loadingPubs || loadingProfiles;

  return (
    <Layout>
      <SEO title="Profils des auteurs" description="Biographies et photos des auteurs" path="/admin/authors" noindex />
      <div className="container py-8 md:py-12 space-y-6">
        <Link to="/admin/dashboard" state={BACK_TO_DASHBOARD_STATE} className="inline-flex items-center gap-2 text-sm text-muted-foreground hover:text-foreground">
          <ArrowLeft className="h-4 w-4" /> Retour au tableau de bord
        </Link>

        <div className="flex items-center gap-3">
          <Users className="h-8 w-8 text-primary" />
          <div>
            <h1 className="font-serif text-2xl md:text-3xl font-bold">Profils des auteurs</h1>
            <p className="text-sm text-muted-foreground">
              {rows.length} auteur{rows.length > 1 ? "s" : ""} · {withProfile} avec biographie ou photo
            </p>
          </div>
        </div>

        <p className="text-sm text-muted-foreground max-w-3xl">
          La biographie et la photo s'affichent sur la page publique de l'auteur et aident Google à le
          reconnaître. N'indiquez que des informations exactes ; la photo doit être libre de droits ou
          fournie par l'auteur.
        </p>

        {profilesError && (
          <div className="rounded-lg border border-destructive/40 bg-destructive/5 p-4 text-sm text-destructive">
            Les profils ne peuvent pas être lus : {(profilesError as Error).message}
          </div>
        )}

        <div className="flex flex-col sm:flex-row gap-3">
          <div className="relative flex-1">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <Input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Rechercher un auteur…" className="pl-9" />
          </div>
          <div className="flex gap-2">
            {(["tous", "sans", "avec"] as const).map((f) => (
              <Button key={f} size="sm" variant={filter === f ? "default" : "outline"} onClick={() => setFilter(f)}>
                {f === "tous" ? "Tous" : f === "sans" ? "Sans profil" : "Avec profil"}
              </Button>
            ))}
          </div>
        </div>

        {loading ? (
          <div className="flex justify-center py-16"><Loader2 className="h-6 w-6 animate-spin text-muted-foreground" /></div>
        ) : (
          <div className="grid grid-cols-1 gap-3">
            {filtered.map((r) => (
              // grid-cols-1 + min-w-0 : sur téléphone, un nom long n'élargit plus la ligne (le bouton
              // « Modifier » sortait de l'écran) ; les boutons passent à la ligne si besoin.
              <div key={r.slug} className="min-w-0 flex flex-wrap sm:flex-nowrap items-center gap-3 sm:gap-4 rounded-xl border border-border bg-card p-4">
                {r.profile?.photo_url ? (
                  <img src={r.profile.photo_url} alt={`Photo de ${r.name}`} className="h-12 w-12 rounded-full object-cover shrink-0" />
                ) : (
                  <div className="h-12 w-12 rounded-full bg-primary/10 flex items-center justify-center shrink-0">
                    <User className="h-6 w-6 text-primary" />
                  </div>
                )}
                <div className="min-w-0 flex-1">
                  <div className="font-semibold text-foreground truncate">{r.name}</div>
                  <div className="flex flex-wrap items-center gap-2 text-xs text-muted-foreground mt-1">
                    <span>{r.published} publiée{r.published > 1 ? "s" : ""}{r.total > r.published ? ` · ${r.total - r.published} non publiée${r.total - r.published > 1 ? "s" : ""}` : ""}</span>
                    {r.profile?.biography && <Badge variant="secondary">Biographie</Badge>}
                    {r.profile?.photo_url && <Badge variant="secondary">Photo</Badge>}
                  </div>
                </div>
                <div className="flex items-center gap-2 ml-auto shrink-0">
                {r.published > 0 && (
                  <Button asChild size="icon" variant="ghost" title="Voir la page publique">
                    <a href={buildAuthorPath(r.name)} target="_blank" rel="noreferrer"><ExternalLink className="h-4 w-4" /></a>
                  </Button>
                )}
                <Button size="sm" variant="outline" onClick={() => setEditing(r)}>
                  <Pencil className="h-4 w-4 mr-1" /> Modifier
                </Button>
                </div>
              </div>
            ))}
            {filtered.length === 0 && <p className="text-center text-muted-foreground py-10">Aucun auteur trouvé.</p>}
          </div>
        )}
      </div>

      {editing && <AuthorDialog row={editing} onClose={() => setEditing(null)} />}
    </Layout>
  );
}

function AuthorDialog({ row, onClose }: { row: AuthorRow; onClose: () => void }) {
  const save = useSaveAuthorProfile();
  const remove = useDeleteAuthorProfile();
  const [biography, setBiography] = useState(row.profile?.biography ?? "");
  const [photoUrl, setPhotoUrl] = useState<string | null>(row.profile?.photo_url ?? null);
  const [uploading, setUploading] = useState(false);
  const [confirmDelete, setConfirmDelete] = useState(false);
  const uploadedThisSession = useRef<string[]>([]);
  const fileInput = useRef<HTMLInputElement>(null);

  const busy = save.isPending || remove.isPending || uploading;

  const onPickPhoto = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    e.target.value = "";
    if (!file) return;
    if (!file.type.startsWith("image/")) {
      toast.error("Choisissez une image (JPG, PNG ou WebP).");
      return;
    }
    if (file.size > 15 * 1024 * 1024) {
      toast.error("Image trop lourde (15 Mo maximum).");
      return;
    }
    setUploading(true);
    try {
      const url = await uploadAuthorPhoto(file, row.slug);
      uploadedThisSession.current.push(url);
      setPhotoUrl(url);
    } catch (err) {
      toast.error("Envoi de la photo impossible", { description: err instanceof Error ? err.message : String(err) });
    } finally {
      setUploading(false);
    }
  };

  const cleanupUnused = async (kept: string | null) => {
    for (const url of uploadedThisSession.current) if (url !== kept) await removeAuthorPhoto(url);
    uploadedThisSession.current = [];
  };

  const handleCancel = async () => {
    await cleanupUnused(row.profile?.photo_url ?? null);
    onClose();
  };

  const handleSave = async () => {
    try {
      await save.mutateAsync({ slug: row.slug, name: row.name, biography, photo_url: photoUrl });
      const previous = row.profile?.photo_url ?? null;
      if (previous && previous !== photoUrl) await removeAuthorPhoto(previous);
      await cleanupUnused(photoUrl);
      toast.success("Profil enregistré", { description: "La page publique sera à jour d'ici 10 minutes." });
      onClose();
    } catch (err) {
      toast.error("Enregistrement impossible", { description: err instanceof Error ? err.message : String(err) });
    }
  };

  const handleDelete = async () => {
    if (!row.profile) return;
    try {
      await remove.mutateAsync(row.profile);
      await cleanupUnused(null);
      toast.success("Profil supprimé");
      onClose();
    } catch (err) {
      toast.error("Suppression impossible", { description: err instanceof Error ? err.message : String(err) });
    }
  };

  return (
    <Dialog open onOpenChange={(open) => { if (!open && !busy) void handleCancel(); }}>
      <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="font-serif">{row.name}</DialogTitle>
          <DialogDescription>
            Page publique : <span className="font-mono text-xs">{buildAuthorPath(row.name)}</span>
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-5">
          <div className="space-y-2">
            <Label>Photo</Label>
            <div className="flex items-center gap-4">
              {photoUrl ? (
                <img src={photoUrl} alt={`Photo de ${row.name}`} className="h-24 w-24 rounded-full object-cover border" />
              ) : (
                <div className="h-24 w-24 rounded-full bg-muted flex items-center justify-center"><User className="h-10 w-10 text-muted-foreground" /></div>
              )}
              <div className="flex flex-col gap-2">
                <input ref={fileInput} type="file" accept="image/jpeg,image/png,image/webp" className="hidden" onChange={onPickPhoto} />
                <Button type="button" variant="outline" size="sm" disabled={busy} onClick={() => fileInput.current?.click()}>
                  {uploading ? <Loader2 className="h-4 w-4 mr-1 animate-spin" /> : <ImagePlus className="h-4 w-4 mr-1" />}
                  {photoUrl ? "Changer la photo" : "Ajouter une photo"}
                </Button>
                {photoUrl && (
                  <Button type="button" variant="ghost" size="sm" disabled={busy} onClick={() => setPhotoUrl(null)}>
                    Retirer la photo
                  </Button>
                )}
                <p className="text-xs text-muted-foreground">Format carré conseillé ; l'image est réduite et compressée automatiquement.</p>
              </div>
            </div>
          </div>

          <div className="space-y-2">
            <Label htmlFor="bio">Biographie</Label>
            <Textarea
              id="bio"
              value={biography}
              maxLength={BIO_MAX}
              onChange={(e) => setBiography(e.target.value)}
              rows={9}
              placeholder="Parcours, formation, domaines de recherche, ouvrages… Laissez une ligne vide entre deux paragraphes."
            />
            <p className="text-xs text-muted-foreground text-right">{biography.length} / {BIO_MAX}</p>
          </div>
        </div>

        <DialogFooter className="flex-col-reverse sm:flex-row sm:justify-between gap-2">
          <div>
            {row.profile && (confirmDelete ? (
              <div className="flex items-center gap-2">
                <span className="text-sm text-destructive">Supprimer biographie et photo ?</span>
                <Button size="sm" variant="destructive" disabled={busy} onClick={handleDelete}>Oui, supprimer</Button>
                <Button size="sm" variant="ghost" disabled={busy} onClick={() => setConfirmDelete(false)}>Non</Button>
              </div>
            ) : (
              <Button size="sm" variant="ghost" className="text-destructive" disabled={busy} onClick={() => setConfirmDelete(true)}>
                <Trash2 className="h-4 w-4 mr-1" /> Supprimer le profil
              </Button>
            ))}
          </div>
          <div className="flex gap-2 justify-end">
            <Button variant="outline" disabled={busy} onClick={handleCancel}>Annuler</Button>
            <Button disabled={busy} onClick={handleSave}>
              {save.isPending && <Loader2 className="h-4 w-4 mr-1 animate-spin" />} Enregistrer
            </Button>
          </div>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
