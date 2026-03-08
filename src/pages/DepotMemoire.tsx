import { useState } from "react";
import { useNavigate, Link } from "react-router-dom";
import { GraduationCap, Upload, ArrowLeft, FileText, CheckCircle } from "lucide-react";
import { Layout } from "@/components/layout/Layout";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { useAuth } from "@/hooks/useAuth";
import { useCreateSubmission, useMySubmissions } from "@/hooks/useSubmissions";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { format } from "date-fns";
import { fr } from "date-fns/locale";
import { cn } from "@/lib/utils";

const statusLabels: Record<string, { label: string; className: string }> = {
  pending: { label: "En attente", className: "bg-amber-500/10 text-amber-600" },
  approved: { label: "Approuvé", className: "bg-green-500/10 text-green-600" },
  rejected: { label: "Refusé", className: "bg-destructive/10 text-destructive" },
};

export default function DepotMemoire() {
  const { user } = useAuth();
  const navigate = useNavigate();
  const createSubmission = useCreateSubmission();
  const { data: mySubmissions = [], isLoading: loadingSubs } = useMySubmissions();

  const [form, setForm] = useState({
    student_name: "",
    university: "",
    faculty: "",
    academic_year: "",
    title: "",
    description: "",
    category: "memoire",
  });
  const [uploading, setUploading] = useState(false);
  const [fileUrl, setFileUrl] = useState("");
  const [submitted, setSubmitted] = useState(false);

  if (!user) {
    return (
      <Layout>
        <div className="container py-16 text-center">
          <GraduationCap className="mx-auto mb-4 h-12 w-12 text-muted-foreground/30" />
          <h1 className="font-serif text-2xl font-bold text-foreground mb-3">
            Déposez votre mémoire
          </h1>
          <p className="text-muted-foreground mb-6">
            Connectez-vous pour soumettre votre travail académique.
          </p>
          <Link to="/auth">
            <Button>Se connecter</Button>
          </Link>
        </div>
      </Layout>
    );
  }

  const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    if (file.type !== "application/pdf") {
      toast.error("Seuls les fichiers PDF sont acceptés.");
      return;
    }
    if (file.size > 20 * 1024 * 1024) {
      toast.error("Le fichier ne doit pas dépasser 20 Mo.");
      return;
    }

    setUploading(true);
    const fileName = `submissions/${user.id}/${Date.now()}-${file.name}`;
    const { error } = await supabase.storage
      .from("publications")
      .upload(fileName, file);

    if (error) {
      toast.error("Erreur lors du téléversement.");
      setUploading(false);
      return;
    }

    const { data: urlData } = supabase.storage
      .from("publications")
      .getPublicUrl(fileName);

    setFileUrl(urlData.publicUrl);
    setUploading(false);
    toast.success("Fichier téléversé !");
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!fileUrl) {
      toast.error("Veuillez téléverser votre fichier PDF.");
      return;
    }
    try {
      await createSubmission.mutateAsync({ ...form, file_url: fileUrl });
      setSubmitted(true);
      toast.success("Soumission envoyée avec succès !");
    } catch {
      toast.error("Erreur lors de la soumission.");
    }
  };

  if (submitted) {
    return (
      <Layout>
        <div className="container py-16 text-center max-w-lg mx-auto">
          <CheckCircle className="mx-auto mb-4 h-16 w-16 text-green-500" />
          <h1 className="font-serif text-2xl font-bold text-foreground mb-3">
            Soumission envoyée !
          </h1>
          <p className="text-muted-foreground mb-6">
            Votre travail a été soumis et sera examiné par l'administrateur.
            Vous serez notifié de la décision.
          </p>
          <div className="flex gap-3 justify-center">
            <Button variant="outline" onClick={() => setSubmitted(false)}>
              Soumettre un autre
            </Button>
            <Link to="/bibliotheque">
              <Button>Voir la bibliothèque</Button>
            </Link>
          </div>
        </div>
      </Layout>
    );
  }

  return (
    <Layout>
      <div className="container py-8 md:py-12 max-w-2xl mx-auto">
        <Link
          to="/bibliotheque"
          className="inline-flex items-center gap-2 text-muted-foreground hover:text-foreground transition-colors mb-8"
        >
          <ArrowLeft className="h-4 w-4" />
          Retour
        </Link>

        <div className="mb-8">
          <h1 className="font-serif text-3xl font-bold text-foreground flex items-center gap-3">
            <GraduationCap className="h-8 w-8 text-primary" />
            Déposer un mémoire
          </h1>
          <p className="text-muted-foreground mt-2">
            Soumettez votre travail académique pour qu'il soit publié dans la bibliothèque.
          </p>
        </div>

        <form onSubmit={handleSubmit} className="space-y-5">
          <div className="grid sm:grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label htmlFor="student_name">Nom complet *</Label>
              <Input
                id="student_name"
                required
                maxLength={100}
                value={form.student_name}
                onChange={(e) => setForm({ ...form, student_name: e.target.value })}
                placeholder="Jean Mukadi"
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="university">Université *</Label>
              <Input
                id="university"
                required
                maxLength={200}
                value={form.university}
                onChange={(e) => setForm({ ...form, university: e.target.value })}
                placeholder="Université de Kinshasa"
              />
            </div>
          </div>

          <div className="grid sm:grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label htmlFor="faculty">Faculté *</Label>
              <Input
                id="faculty"
                required
                maxLength={200}
                value={form.faculty}
                onChange={(e) => setForm({ ...form, faculty: e.target.value })}
                placeholder="Sciences Informatiques"
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="academic_year">Année académique *</Label>
              <Input
                id="academic_year"
                required
                maxLength={20}
                value={form.academic_year}
                onChange={(e) => setForm({ ...form, academic_year: e.target.value })}
                placeholder="2025-2026"
              />
            </div>
          </div>

          <div className="space-y-2">
            <Label htmlFor="title">Titre du mémoire *</Label>
            <Input
              id="title"
              required
              maxLength={300}
              value={form.title}
              onChange={(e) => setForm({ ...form, title: e.target.value })}
              placeholder="Étude sur l'impact de l'IA..."
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="category">Catégorie *</Label>
            <Select
              value={form.category}
              onValueChange={(val) => setForm({ ...form, category: val })}
            >
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="memoire">Mémoire</SelectItem>
                <SelectItem value="tfc">TFC</SelectItem>
                <SelectItem value="article">Article</SelectItem>
              </SelectContent>
            </Select>
          </div>

          <div className="space-y-2">
            <Label htmlFor="description">Description</Label>
            <Textarea
              id="description"
              maxLength={2000}
              rows={4}
              value={form.description}
              onChange={(e) => setForm({ ...form, description: e.target.value })}
              placeholder="Décrivez brièvement votre travail..."
            />
          </div>

          <div className="space-y-2">
            <Label>Fichier PDF * (max 20 Mo)</Label>
            <div className="border-2 border-dashed border-border rounded-lg p-6 text-center">
              {fileUrl ? (
                <div className="flex items-center justify-center gap-2 text-green-600">
                  <FileText className="h-5 w-5" />
                  <span className="text-sm font-medium">Fichier téléversé</span>
                </div>
              ) : (
                <>
                  <Upload className="mx-auto h-8 w-8 text-muted-foreground/40 mb-2" />
                  <label className="cursor-pointer">
                    <span className="text-sm text-primary font-medium hover:underline">
                      {uploading ? "Téléversement..." : "Choisir un fichier"}
                    </span>
                    <input
                      type="file"
                      accept=".pdf"
                      className="hidden"
                      onChange={handleFileUpload}
                      disabled={uploading}
                    />
                  </label>
                </>
              )}
            </div>
          </div>

          <Button
            type="submit"
            className="w-full gap-2"
            disabled={createSubmission.isPending || !fileUrl}
          >
            <GraduationCap className="h-4 w-4" />
            {createSubmission.isPending ? "Envoi en cours..." : "Soumettre"}
          </Button>
        </form>

        {/* Previous submissions */}
        {mySubmissions.length > 0 && (
          <div className="mt-12">
            <h2 className="font-serif text-xl font-semibold text-foreground mb-4">
              Mes soumissions
            </h2>
            <div className="space-y-3">
              {mySubmissions.map((sub) => {
                const st = statusLabels[sub.status] || statusLabels.pending;
                return (
                  <div
                    key={sub.id}
                    className="bg-card border border-border rounded-lg p-4"
                  >
                    <div className="flex items-start justify-between gap-3">
                      <div className="min-w-0 flex-1">
                        <p className="font-medium text-foreground truncate">{sub.title}</p>
                        <p className="text-xs text-muted-foreground mt-1">
                          {format(new Date(sub.created_at), "d MMMM yyyy", { locale: fr })}
                        </p>
                      </div>
                      <Badge className={cn("shrink-0", st.className)}>
                        {st.label}
                      </Badge>
                    </div>
                    {sub.admin_note && (
                      <p className="mt-2 text-sm text-muted-foreground bg-muted/50 rounded px-3 py-2">
                        Note admin : {sub.admin_note}
                      </p>
                    )}
                  </div>
                );
              })}
            </div>
          </div>
        )}
      </div>
    </Layout>
  );
}
