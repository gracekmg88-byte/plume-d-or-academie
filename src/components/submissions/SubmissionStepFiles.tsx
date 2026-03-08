import { Upload, FileText, ImagePlus, CheckCircle2 } from "lucide-react";
import { Label } from "@/components/ui/label";
import { cn } from "@/lib/utils";

interface Props {
  fileUrl: string;
  uploading: boolean;
  coverPreview: string;
  coverUploading: boolean;
  onFileUpload: (e: React.ChangeEvent<HTMLInputElement>) => void;
  onCoverUpload: (e: React.ChangeEvent<HTMLInputElement>) => void;
}

export function SubmissionStepFiles({
  fileUrl,
  uploading,
  coverPreview,
  coverUploading,
  onFileUpload,
  onCoverUpload,
}: Props) {
  return (
    <div className="space-y-5 animate-in fade-in slide-in-from-right-4 duration-300">
      {/* Page de couverture */}
      <div className="space-y-2">
        <Label>Page de couverture <span className="text-muted-foreground text-xs">(optionnel, max 5 Mo)</span></Label>
        <div
          className={cn(
            "border-2 border-dashed rounded-lg p-6 text-center transition-colors",
            coverPreview ? "border-[hsl(var(--success))] bg-[hsl(var(--success)/0.05)]" : "border-border"
          )}
        >
          {coverPreview ? (
            <div className="flex flex-col items-center gap-3">
              <img
                src={coverPreview}
                alt="Aperçu couverture"
                className="max-h-40 rounded-lg border border-border object-contain"
              />
              <div className="flex items-center gap-1.5 text-sm font-medium text-[hsl(var(--success))]">
                <CheckCircle2 className="h-4 w-4" />
                Couverture téléversée
              </div>
              <label className="cursor-pointer">
                <span className="text-xs text-muted-foreground hover:text-foreground underline">
                  Changer l'image
                </span>
                <input
                  type="file"
                  accept="image/*"
                  className="hidden"
                  onChange={onCoverUpload}
                  disabled={coverUploading}
                />
              </label>
            </div>
          ) : (
            <>
              <ImagePlus className="mx-auto h-8 w-8 text-muted-foreground/40 mb-2" />
              <label className="cursor-pointer">
                <span className="text-sm text-primary font-medium hover:underline">
                  {coverUploading ? "Téléversement..." : "Ajouter une page de couverture"}
                </span>
                <input
                  type="file"
                  accept="image/*"
                  className="hidden"
                  onChange={onCoverUpload}
                  disabled={coverUploading}
                />
              </label>
              <p className="text-xs text-muted-foreground mt-1">JPG, PNG ou WebP</p>
            </>
          )}
        </div>
      </div>

      {/* Fichier PDF */}
      <div className="space-y-2">
        <Label>Fichier PDF * (max 20 Mo)</Label>
        <div
          className={cn(
            "border-2 border-dashed rounded-lg p-6 text-center transition-colors",
            fileUrl ? "border-[hsl(var(--success))] bg-[hsl(var(--success)/0.05)]" : "border-border"
          )}
        >
          {fileUrl ? (
            <div className="flex items-center justify-center gap-2 text-[hsl(var(--success))]">
              <FileText className="h-5 w-5" />
              <span className="text-sm font-medium">Fichier téléversé ✓</span>
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
                  onChange={onFileUpload}
                  disabled={uploading}
                />
              </label>
            </>
          )}
        </div>
        {!fileUrl && (
          <p className="text-xs text-destructive animate-in fade-in duration-200">
            Le fichier PDF est obligatoire pour soumettre
          </p>
        )}
      </div>
    </div>
  );
}
