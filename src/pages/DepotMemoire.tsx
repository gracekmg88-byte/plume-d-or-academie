import { useState } from "react";
import { Link } from "react-router-dom";
import { GraduationCap, ArrowLeft, ArrowRight, CheckCircle } from "lucide-react";
import { Layout } from "@/components/layout/Layout";
import { Button } from "@/components/ui/button";
import { useAuth } from "@/hooks/useAuth";
import { useCreateSubmission, useMySubmissions } from "@/hooks/useSubmissions";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";

import { SubmissionStepper } from "@/components/submissions/SubmissionStepper";
import { SubmissionStepPersonal } from "@/components/submissions/SubmissionStepPersonal";
import { SubmissionStepDetails } from "@/components/submissions/SubmissionStepDetails";
import { SubmissionStepFiles } from "@/components/submissions/SubmissionStepFiles";
import { SubmissionsList } from "@/components/submissions/SubmissionsList";

const STEPS = [
  { label: "Identité", description: "Vos informations" },
  { label: "Travail", description: "Titre & description" },
  { label: "Fichiers", description: "PDF & couverture" },
];

export default function DepotMemoire() {
  const { user, loading } = useAuth();
  const createSubmission = useCreateSubmission();
  const { data: mySubmissions = [] } = useMySubmissions();

  const [step, setStep] = useState(0);
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
  const [coverUploading, setCoverUploading] = useState(false);
  const [coverUrl, setCoverUrl] = useState("");
  const [coverPreview, setCoverPreview] = useState("");
  const [submitted, setSubmitted] = useState(false);
  const [touched, setTouched] = useState<Record<string, boolean>>({});

  const updateForm = (updates: Partial<typeof form>) => {
    setForm((prev) => ({ ...prev, ...updates }));
  };

  const handleBlur = (field: string) => {
    setTouched((prev) => ({ ...prev, [field]: true }));
  };

  if (loading) {
    return (
      <Layout>
        <div className="container py-16 text-center">
          <div className="h-8 w-8 mx-auto animate-spin rounded-full border-2 border-primary border-t-transparent" />
        </div>
      </Layout>
    );
  }

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

  const canGoNext = () => {
    if (step === 0) {
      return form.student_name && form.university && form.faculty && form.academic_year;
    }
    if (step === 1) {
      return form.title && form.category;
    }
    return true;
  };

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
    const { error } = await supabase.storage.from("publications").upload(fileName, file);

    if (error) {
      toast.error("Erreur lors du téléversement.");
      setUploading(false);
      return;
    }

    const { data: urlData } = supabase.storage.from("publications").getPublicUrl(fileName);
    setFileUrl(urlData.publicUrl);
    setUploading(false);
    toast.success("Fichier téléversé !");
  };

  const handleCoverUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    if (!file.type.startsWith("image/")) {
      toast.error("Seuls les fichiers image sont acceptés.");
      return;
    }
    if (file.size > 5 * 1024 * 1024) {
      toast.error("L'image ne doit pas dépasser 5 Mo.");
      return;
    }

    setCoverUploading(true);

    // Compress cover image before upload (WebP, max 800x1200, 75% quality)
    let optimizedFile = file;
    try {
      const { compressImage } = await import("@/lib/compress-image");
      optimizedFile = await compressImage(file, { maxWidth: 800, maxHeight: 1200, quality: 0.75 });
    } catch (err) {
      console.warn("Compression failed, uploading original:", err);
    }

    const fileName = `submissions/${user.id}/covers/${Date.now()}-${optimizedFile.name}`;
    const { error } = await supabase.storage.from("publications").upload(fileName, optimizedFile);

    if (error) {
      toast.error("Erreur lors du téléversement de la couverture.");
      setCoverUploading(false);
      return;
    }

    const { data: urlData } = supabase.storage.from("publications").getPublicUrl(fileName);
    setCoverUrl(urlData.publicUrl);
    setCoverPreview(URL.createObjectURL(file));
    setCoverUploading(false);
    toast.success("Page de couverture téléversée !");
  };

  const handleSubmit = async () => {
    if (!fileUrl) {
      toast.error("Veuillez téléverser votre fichier PDF.");
      return;
    }
    try {
      await createSubmission.mutateAsync({
        ...form,
        file_url: fileUrl,
        cover_url: coverUrl || undefined,
      });
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
            <Button variant="outline" onClick={() => { setSubmitted(false); setStep(0); setFileUrl(""); setCoverUrl(""); setCoverPreview(""); }}>
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

        <div className="mb-6">
          <h1 className="font-serif text-3xl font-bold text-foreground flex items-center gap-3">
            <GraduationCap className="h-8 w-8 text-primary" />
            Déposer un mémoire
          </h1>
          <p className="text-muted-foreground mt-2">
            Soumettez votre travail académique pour qu'il soit publié dans la bibliothèque.
          </p>
        </div>

        <SubmissionStepper steps={STEPS} currentStep={step} />

        <div className="min-h-[280px]">
          {step === 0 && <SubmissionStepPersonal form={form} onChange={updateForm} touched={touched} onBlur={handleBlur} />}
          {step === 1 && <SubmissionStepDetails form={form} onChange={updateForm} touched={touched} onBlur={handleBlur} />}
          {step === 2 && (
            <SubmissionStepFiles
              fileUrl={fileUrl}
              uploading={uploading}
              coverPreview={coverPreview}
              coverUploading={coverUploading}
              onFileUpload={handleFileUpload}
              onCoverUpload={handleCoverUpload}
            />
          )}
        </div>

        {/* Navigation buttons */}
        <div className="flex justify-between mt-8 gap-3">
          <Button
            type="button"
            variant="outline"
            onClick={() => setStep((s) => s - 1)}
            disabled={step === 0}
            className="gap-2"
          >
            <ArrowLeft className="h-4 w-4" />
            Précédent
          </Button>

          {step < 2 ? (
            <Button
              type="button"
              onClick={() => setStep((s) => s + 1)}
              disabled={!canGoNext()}
              className="gap-2"
            >
              Suivant
              <ArrowRight className="h-4 w-4" />
            </Button>
          ) : (
            <Button
              type="button"
              onClick={handleSubmit}
              disabled={createSubmission.isPending || !fileUrl}
              className="gap-2"
            >
              <GraduationCap className="h-4 w-4" />
              {createSubmission.isPending ? "Envoi en cours..." : "Soumettre"}
            </Button>
          )}
        </div>

        <SubmissionsList submissions={mySubmissions} />
      </div>
    </Layout>
  );
}
