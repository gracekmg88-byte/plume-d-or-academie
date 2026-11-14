// Profils des auteurs (table `authors`) : biographie et photo.
// Lecture publique ; écriture réservée aux administrateurs (RLS côté base).
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { compressImage } from "@/lib/compress-image";

export interface AuthorProfile {
  id: string;
  slug: string;
  name: string;
  biography: string | null;
  photo_url: string | null;
  updated_at: string;
}

const COLUMNS = "id,slug,name,biography,photo_url,updated_at";
const PHOTO_FOLDER = "authors";

/** Profil d'un auteur (null s'il n'a pas encore de biographie ni de photo). */
export function useAuthorProfile(slug: string | undefined) {
  return useQuery({
    queryKey: ["author-profile", slug],
    enabled: !!slug,
    staleTime: 5 * 60 * 1000,
    queryFn: async (): Promise<AuthorProfile | null> => {
      const { data, error } = await supabase.from("authors").select(COLUMNS).eq("slug", slug!).maybeSingle();
      // Profil facultatif : une erreur ne doit pas empêcher d'afficher la page auteur.
      if (error) {
        console.warn("[auteur] profil indisponible", error.message);
        return null;
      }
      return data as AuthorProfile | null;
    },
  });
}

/** Tous les profils (espace admin). */
export function useAuthorProfiles() {
  return useQuery({
    queryKey: ["author-profiles"],
    queryFn: async (): Promise<AuthorProfile[]> => {
      const { data, error } = await supabase.from("authors").select(COLUMNS).order("name");
      if (error) throw error;
      return (data || []) as AuthorProfile[];
    },
  });
}

/** Compresse puis envoie la photo dans le bucket public « publications », dossier authors/. */
export async function uploadAuthorPhoto(file: File, slug: string): Promise<string> {
  let toUpload = file;
  try {
    toUpload = await compressImage(file, { maxWidth: 600, maxHeight: 600, quality: 0.82 });
  } catch (err) {
    console.warn("[auteur] compression de la photo impossible, envoi de l'original", err);
  }
  const ext = (toUpload.name.split(".").pop() || "webp").toLowerCase();
  // Nom unique (horodatage) : le fichier ne change jamais, le navigateur peut le garder 1 an.
  const path = `${PHOTO_FOLDER}/${slug}-${Date.now()}.${ext}`;
  const { error } = await supabase.storage.from("publications").upload(path, toUpload, {
    cacheControl: "31536000",
    contentType: toUpload.type || undefined,
  });
  if (error) throw error;
  return supabase.storage.from("publications").getPublicUrl(path).data.publicUrl;
}

/** Supprime une ancienne photo d'auteur du stockage (uniquement dans le dossier authors/). */
export async function removeAuthorPhoto(publicUrl: string | null | undefined) {
  if (!publicUrl) return;
  const marker = `/storage/v1/object/public/publications/${PHOTO_FOLDER}/`;
  const i = publicUrl.indexOf(marker);
  if (i === -1) return;
  const path = `${PHOTO_FOLDER}/${decodeURIComponent(publicUrl.slice(i + marker.length).split("?")[0])}`;
  const { error } = await supabase.storage.from("publications").remove([path]);
  if (error) console.warn("[auteur] ancienne photo non supprimée", error.message);
}

export function useSaveAuthorProfile() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (input: { slug: string; name: string; biography: string | null; photo_url: string | null }) => {
      const { data: auth } = await supabase.auth.getUser();
      const { data, error } = await supabase
        .from("authors")
        .upsert(
          {
            slug: input.slug,
            name: input.name,
            biography: input.biography?.trim() ? input.biography.trim() : null,
            photo_url: input.photo_url,
            updated_by: auth.user?.id ?? null,
          },
          { onConflict: "slug" },
        )
        .select(COLUMNS)
        .single();
      if (error) throw error;
      return data as AuthorProfile;
    },
    onSuccess: (profile) => {
      qc.invalidateQueries({ queryKey: ["author-profiles"] });
      qc.invalidateQueries({ queryKey: ["author-profile", profile.slug] });
    },
  });
}

export function useDeleteAuthorProfile() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (profile: AuthorProfile) => {
      const { error } = await supabase.from("authors").delete().eq("id", profile.id);
      if (error) throw error;
      await removeAuthorPhoto(profile.photo_url);
      return profile;
    },
    onSuccess: (profile) => {
      qc.invalidateQueries({ queryKey: ["author-profiles"] });
      qc.invalidateQueries({ queryKey: ["author-profile", profile.slug] });
    },
  });
}
