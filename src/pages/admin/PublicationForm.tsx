import { useState, useEffect } from "react";
import { useNavigate, useParams, Link } from "react-router-dom";
import { ArrowLeft, Upload, Save, Loader2, Sparkles, RefreshCw } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { useAuth } from "@/hooks/useAuth";
import { usePublication, useCreatePublication, useUpdatePublication } from "@/hooks/usePublications";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { compressImage } from "@/lib/compress-image";

const categories = [
  { value: "livre", label: "Livre" },
  { value: "memoire", label: "Mémoire" },
  { value: "tfc", label: "TFC" },
  { value: "article", label: "Article" },
];

export default function PublicationForm() {
  const { id } = useParams<{ id: string }>();
  const isEditing = id && id !== "nouvelle";
  const navigate = useNavigate();
  const { user, isAdmin, loading: authLoading } = useAuth();
  
  const { data: existingPublication, isLoading: publicationLoading } = usePublication(isEditing ? id : "");
  const createPublication = useCreatePublication();
  const updatePublication = useUpdatePublication();

  const [formData, setFormData] = useState({
    title: "",
    author: "",
    description: "",
    category: "livre" as "livre" | "memoire" | "tfc" | "article",
    is_published: false,
  });
  const [coverFile, setCoverFile] = useState<File | null>(null);
  const [pdfFile, setPdfFile] = useState<File | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [coverPreview, setCoverPreview] = useState<string | null>(null);
  const [isGeneratingCover, setIsGeneratingCover] = useState(false);
  const [aiCoverUrl, setAiCoverUrl] = useState<string | null>(null);

  useEffect(() => {
    if (existingPublication) {
      setFormData({
        title: existingPublication.title,
        author: existingPublication.author,
        description: existingPublication.description || "",
        category: existingPublication.category as typeof formData.category,
        is_published: existingPublication.is_published,
      });
      if (existingPublication.cover_image_url) {
        setCoverPreview(existingPublication.cover_image_url);
      }
    }
  }, [existingPublication]);

  const uploadFile = async (file: File, folder: string) => {
    const fileExt = file.name.split(".").pop();
    const fileName = `${folder}/${Date.now()}.${fileExt}`;
    
    const { error } = await supabase.storage
      .from("publications")
      .upload(fileName, file);

    if (error) throw error;

    const { data } = supabase.storage
      .from("publications")
      .getPublicUrl(fileName);

    return data.publicUrl;
  };

  const handleCoverChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      setCoverFile(file);
      setAiCoverUrl(null);
      setCoverPreview(URL.createObjectURL(file));
    }
  };

  const handleGenerateCover = async () => {
    if (!formData.title || !formData.author) {
      toast.error("Veuillez remplir le titre et l'auteur avant de générer la couverture");
      return;
    }

    setIsGeneratingCover(true);
    try {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) throw new Error("Non authentifié");

      const response = await supabase.functions.invoke("generate-cover", {
        body: {
          title: formData.title,
          author: formData.author,
          category: formData.category,
        },
      });

      if (response.error) throw new Error(response.error.message);
      
      const result = response.data;
      if (result.error) throw new Error(result.error);

      setCoverPreview(result.coverUrl);
      setAiCoverUrl(result.coverUrl);
      setCoverFile(null);
      toast.success("Couverture générée avec succès !");
    } catch (error: any) {
      console.error("AI cover error:", error);
      toast.error(error.message || "Erreur lors de la génération de la couverture");
    } finally {
      setIsGeneratingCover(false);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsSubmitting(true);

    try {
      let coverImageUrl = existingPublication?.cover_image_url || null;
      let fileUrl = existingPublication?.file_url || null;

      if (aiCoverUrl) {
        coverImageUrl = aiCoverUrl;
      } else if (coverFile) {
        const compressed = await compressImage(coverFile, { maxWidth: 800, maxHeight: 1200, quality: 0.75 });
        coverImageUrl = await uploadFile(compressed, "covers");
      }

      if (pdfFile) {
        fileUrl = await uploadFile(pdfFile, "files");
      }

      const publicationData = {
        ...formData,
        cover_image_url: coverImageUrl,
        file_url: fileUrl,
      };

      if (isEditing) {
        await updatePublication.mutateAsync({ id, ...publicationData });
        toast.success("Publication mise à jour");
      } else {
        await createPublication.mutateAsync(publicationData);
        toast.success("Publication créée");
      }

      navigate("/admin/dashboard");
    } catch (error: any) {
      toast.error(error.message || "Une erreur est survenue");
    } finally {
      setIsSubmitting(false);
    }
  };

  if (authLoading || (isEditing && publicationLoading)) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }

  if (!user || !isAdmin) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background p-4">
        <div className="text-center">
          <h1 className="font-serif text-2xl font-bold text-foreground mb-4">
            Accès non autorisé
          </h1>
          <Link to="/admin">
            <Button>Se connecter</Button>
          </Link>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background">
      {/* Header */}
      <header className="sticky top-0 z-50 bg-card border-b border-border">
        <div className="container flex h-16 items-center gap-4">
          <Link to="/admin/dashboard" className="text-muted-foreground hover:text-foreground">
            <ArrowLeft className="h-5 w-5" />
          </Link>
          <h1 className="font-serif text-xl font-bold text-foreground">
            {isEditing ? "Modifier la publication" : "Nouvelle publication"}
          </h1>
        </div>
      </header>

      <div className="container py-8">
        <form onSubmit={handleSubmit} className="max-w-2xl mx-auto space-y-8">
          {/* Basic Info */}
          <div className="bg-card rounded-xl border border-border p-6 space-y-6">
            <h2 className="font-serif text-lg font-semibold text-foreground">
              Informations générales
            </h2>

            <div className="space-y-2">
              <Label htmlFor="title">Titre *</Label>
              <Input
                id="title"
                value={formData.title}
                onChange={(e) => setFormData({ ...formData, title: e.target.value })}
                placeholder="Titre de la publication"
                required
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="author">Auteur *</Label>
              <Input
                id="author"
                value={formData.author}
                onChange={(e) => setFormData({ ...formData, author: e.target.value })}
                placeholder="Nom de l'auteur"
                required
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="category">Catégorie *</Label>
              <Select
                value={formData.category}
                onValueChange={(value: typeof formData.category) =>
                  setFormData({ ...formData, category: value })
                }
              >
                <SelectTrigger>
                  <SelectValue placeholder="Sélectionner une catégorie" />
                </SelectTrigger>
                <SelectContent>
                  {categories.map((cat) => (
                    <SelectItem key={cat.value} value={cat.value}>
                      {cat.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-2">
              <Label htmlFor="description">Description</Label>
              <Textarea
                id="description"
                value={formData.description}
                onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                placeholder="Description de la publication..."
                rows={5}
              />
            </div>
          </div>

          {/* Files */}
          <div className="bg-card rounded-xl border border-border p-6 space-y-6">
            <h2 className="font-serif text-lg font-semibold text-foreground">
              Fichiers
            </h2>

            {/* Cover Image */}
            <div className="space-y-3">
              <Label>Image de couverture</Label>
              
              {coverPreview && (
                <div className="flex items-start gap-4">
                  <div className="w-32 h-44 rounded-lg overflow-hidden bg-muted shrink-0 border border-border shadow-sm">
                    <img src={coverPreview} alt="Couverture" className="w-full h-full object-cover" />
                  </div>
                  <div className="flex flex-col gap-2 pt-1">
                    <p className="text-xs text-muted-foreground">
                      {aiCoverUrl ? "✨ Générée par IA" : "📁 Image téléversée"}
                    </p>
                    {aiCoverUrl && (
                      <Button
                        type="button"
                        variant="outline"
                        size="sm"
                        onClick={handleGenerateCover}
                        disabled={isGeneratingCover}
                        className="gap-1.5"
                      >
                        <RefreshCw className={`h-3.5 w-3.5 ${isGeneratingCover ? "animate-spin" : ""}`} />
                        Régénérer
                      </Button>
                    )}
                  </div>
                </div>
              )}

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                {/* Option 1: Upload manual */}
                <label className="flex flex-col items-center justify-center w-full h-28 border-2 border-dashed border-border rounded-lg cursor-pointer hover:bg-accent transition-colors">
                  <Upload className="h-6 w-6 text-muted-foreground mb-1.5" />
                  <p className="text-sm font-medium text-muted-foreground">Téléverser</p>
                  <p className="text-xs text-muted-foreground">PNG, JPG (max 5MB)</p>
                  <input
                    type="file"
                    accept="image/*"
                    className="hidden"
                    onChange={handleCoverChange}
                  />
                </label>

                {/* Option 2: AI Generation */}
                <button
                  type="button"
                  onClick={handleGenerateCover}
                  disabled={isGeneratingCover || !formData.title || !formData.author}
                  className="flex flex-col items-center justify-center w-full h-28 border-2 border-dashed border-primary/40 rounded-lg hover:bg-primary/5 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  {isGeneratingCover ? (
                    <>
                      <Loader2 className="h-6 w-6 text-primary animate-spin mb-1.5" />
                      <p className="text-sm font-medium text-primary">Génération en cours...</p>
                      <p className="text-xs text-muted-foreground">~15-30 secondes</p>
                    </>
                  ) : (
                    <>
                      <Sparkles className="h-6 w-6 text-primary mb-1.5" />
                      <p className="text-sm font-medium text-primary">Générer avec l'IA</p>
                      <p className="text-xs text-muted-foreground">Couverture automatique</p>
                    </>
                  )}
                </button>
              </div>
              {(!formData.title || !formData.author) && (
                <p className="text-xs text-muted-foreground italic">
                  💡 Remplissez le titre et l'auteur pour activer la génération IA
                </p>
              )}
            </div>

            {/* PDF File */}
            <div className="space-y-2">
              <Label>Fichier PDF</Label>
              <label className="flex flex-col items-center justify-center w-full h-32 border-2 border-dashed border-border rounded-lg cursor-pointer hover:bg-accent transition-colors">
                <div className="flex flex-col items-center justify-center py-4">
                  <Upload className="h-8 w-8 text-muted-foreground mb-2" />
                  {pdfFile ? (
                    <p className="text-sm text-foreground font-medium">{pdfFile.name}</p>
                  ) : existingPublication?.file_url ? (
                    <p className="text-sm text-muted-foreground">Fichier existant - Cliquer pour remplacer</p>
                  ) : (
                    <>
                      <p className="text-sm text-muted-foreground">
                        Cliquer pour téléverser un PDF
                      </p>
                      <p className="text-xs text-muted-foreground">
                        PDF (max 50MB)
                      </p>
                    </>
                  )}
                </div>
                <input
                  type="file"
                  accept=".pdf"
                  className="hidden"
                  onChange={(e) => setPdfFile(e.target.files?.[0] || null)}
                />
              </label>
            </div>
          </div>

          {/* Publishing */}
          <div className="bg-card rounded-xl border border-border p-6">
            <div className="flex items-center justify-between">
              <div>
                <Label htmlFor="published" className="text-base">Publier</Label>
                <p className="text-sm text-muted-foreground">
                  Rendre cette publication visible sur le site
                </p>
              </div>
              <Switch
                id="published"
                checked={formData.is_published}
                onCheckedChange={(checked) => setFormData({ ...formData, is_published: checked })}
              />
            </div>
          </div>

          {/* Submit */}
          <div className="flex gap-4">
            <Link to="/admin/dashboard" className="flex-1">
              <Button type="button" variant="outline" className="w-full">
                Annuler
              </Button>
            </Link>
            <Button type="submit" className="flex-1 gap-2" disabled={isSubmitting}>
              {isSubmitting ? (
                <Loader2 className="h-4 w-4 animate-spin" />
              ) : (
                <Save className="h-4 w-4" />
              )}
              {isEditing ? "Mettre à jour" : "Créer"}
            </Button>
          </div>
        </form>
      </div>
    </div>
  );
}
