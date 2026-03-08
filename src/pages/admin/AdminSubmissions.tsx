import { useState } from "react";
import { Link } from "react-router-dom";
import {
  Feather, LogOut, GraduationCap, ArrowLeft, Check, X, Eye,
  FileText, Clock, CheckCircle, XCircle,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Textarea } from "@/components/ui/textarea";
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from "@/components/ui/table";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter,
} from "@/components/ui/dialog";
import { useAuth } from "@/hooks/useAuth";
import { useAdminSubmissions, useUpdateSubmissionStatus, type Submission } from "@/hooks/useSubmissions";
import { useCreatePublication } from "@/hooks/usePublications";
import { toast } from "sonner";
import { format } from "date-fns";
import { fr } from "date-fns/locale";
import { cn } from "@/lib/utils";

const statusConfig: Record<string, { label: string; icon: typeof Clock; className: string }> = {
  pending: { label: "En attente", icon: Clock, className: "bg-amber-500/10 text-amber-600" },
  approved: { label: "Approuvé", icon: CheckCircle, className: "bg-green-500/10 text-green-600" },
  rejected: { label: "Refusé", icon: XCircle, className: "bg-destructive/10 text-destructive" },
};

export default function AdminSubmissions() {
  const { user, isAdmin, loading, signOut } = useAuth();
  const { data: submissions = [], isLoading } = useAdminSubmissions();
  const updateStatus = useUpdateSubmissionStatus();
  const createPublication = useCreatePublication();
  const [selected, setSelected] = useState<Submission | null>(null);
  const [adminNote, setAdminNote] = useState("");
  const [action, setAction] = useState<"approve" | "reject" | null>(null);

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background">
        <div className="animate-pulse text-muted-foreground">Chargement...</div>
      </div>
    );
  }

  if (!user || !isAdmin) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background p-4">
        <div className="text-center">
          <h1 className="font-serif text-2xl font-bold mb-4">Accès non autorisé</h1>
          <Link to="/admin"><Button>Se connecter</Button></Link>
        </div>
      </div>
    );
  }

  const handleAction = async () => {
    if (!selected || !action) return;

    try {
      await updateStatus.mutateAsync({
        id: selected.id,
        status: action === "approve" ? "approved" : "rejected",
        admin_note: adminNote || undefined,
      });

      // If approved, auto-create publication
      if (action === "approve") {
        await createPublication.mutateAsync({
          title: selected.title,
          author: selected.student_name,
          description: selected.description || `${selected.university} — ${selected.faculty} (${selected.academic_year})`,
          category: selected.category as "memoire" | "tfc" | "article",
          file_url: selected.file_url,
          is_published: true,
        });
        toast.success("Soumission approuvée et publiée !");
      } else {
        toast.success("Soumission refusée.");
      }

      setSelected(null);
      setAdminNote("");
      setAction(null);
    } catch {
      toast.error("Erreur lors du traitement.");
    }
  };

  const pendingCount = submissions.filter((s) => s.status === "pending").length;

  return (
    <div className="min-h-screen bg-background">
      <header className="sticky top-0 z-50 bg-secondary border-b border-border">
        <div className="container flex h-16 items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="h-9 w-9 rounded-full bg-primary text-primary-foreground flex items-center justify-center">
              <Feather className="h-5 w-5" />
            </div>
            <span className="font-serif font-bold text-secondary-foreground">
              Soumissions
            </span>
          </div>
          <div className="flex items-center gap-4">
            <Link to="/admin/dashboard" className="text-secondary-foreground/70 hover:text-secondary-foreground text-sm flex items-center gap-1">
              <ArrowLeft className="h-4 w-4" />
              Dashboard
            </Link>
          </div>
        </div>
      </header>

      <div className="container py-8">
        <div className="flex items-center justify-between mb-6">
          <h1 className="font-serif text-2xl font-bold text-foreground flex items-center gap-3">
            <GraduationCap className="h-6 w-6 text-primary" />
            Soumissions étudiantes
            {pendingCount > 0 && (
              <Badge className="bg-amber-500/10 text-amber-600">{pendingCount} en attente</Badge>
            )}
          </h1>
        </div>

        <div className="bg-card rounded-xl border border-border overflow-hidden">
          {isLoading ? (
            <div className="p-8 text-center text-muted-foreground">Chargement...</div>
          ) : submissions.length === 0 ? (
            <div className="p-8 text-center text-muted-foreground">
              <GraduationCap className="h-12 w-12 mx-auto mb-4 opacity-30" />
              <p>Aucune soumission pour le moment.</p>
            </div>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Titre</TableHead>
                  <TableHead>Étudiant</TableHead>
                  <TableHead>Université</TableHead>
                  <TableHead>Catégorie</TableHead>
                  <TableHead className="text-center">Statut</TableHead>
                  <TableHead>Date</TableHead>
                  <TableHead className="text-right">Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {submissions.map((sub) => {
                  const st = statusConfig[sub.status] || statusConfig.pending;
                  const StIcon = st.icon;
                  return (
                    <TableRow key={sub.id}>
                      <TableCell className="font-medium max-w-[200px] truncate">
                        {sub.title}
                      </TableCell>
                      <TableCell className="text-muted-foreground">{sub.student_name}</TableCell>
                      <TableCell className="text-muted-foreground text-sm">{sub.university}</TableCell>
                      <TableCell>
                        <Badge variant="outline" className="text-xs">
                          {sub.category === "memoire" ? "Mémoire" : sub.category === "tfc" ? "TFC" : "Article"}
                        </Badge>
                      </TableCell>
                      <TableCell className="text-center">
                        <Badge className={cn("gap-1", st.className)}>
                          <StIcon className="h-3 w-3" />
                          {st.label}
                        </Badge>
                      </TableCell>
                      <TableCell className="text-muted-foreground text-sm">
                        {format(new Date(sub.created_at), "dd/MM/yyyy", { locale: fr })}
                      </TableCell>
                      <TableCell className="text-right">
                        <div className="flex items-center justify-end gap-1">
                          {sub.file_url && (
                            <a href={sub.file_url} target="_blank" rel="noopener noreferrer">
                              <Button variant="ghost" size="icon" title="Voir le fichier">
                                <Eye className="h-4 w-4" />
                              </Button>
                            </a>
                          )}
                          {sub.status === "pending" && (
                            <>
                              <Button
                                variant="ghost"
                                size="icon"
                                className="text-green-600"
                                onClick={() => {
                                  setSelected(sub);
                                  setAction("approve");
                                }}
                              >
                                <Check className="h-4 w-4" />
                              </Button>
                              <Button
                                variant="ghost"
                                size="icon"
                                className="text-destructive"
                                onClick={() => {
                                  setSelected(sub);
                                  setAction("reject");
                                }}
                              >
                                <X className="h-4 w-4" />
                              </Button>
                            </>
                          )}
                        </div>
                      </TableCell>
                    </TableRow>
                  );
                })}
              </TableBody>
            </Table>
          )}
        </div>
      </div>

      {/* Approve/Reject Dialog */}
      <Dialog open={!!selected && !!action} onOpenChange={() => { setSelected(null); setAction(null); setAdminNote(""); }}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>
              {action === "approve" ? "Approuver la soumission" : "Refuser la soumission"}
            </DialogTitle>
          </DialogHeader>
          {selected && (
            <div className="space-y-4">
              <div className="bg-muted/50 rounded-lg p-4 space-y-1 text-sm">
                <p><strong>Titre :</strong> {selected.title}</p>
                <p><strong>Étudiant :</strong> {selected.student_name}</p>
                <p><strong>Université :</strong> {selected.university}</p>
                <p><strong>Faculté :</strong> {selected.faculty}</p>
                <p><strong>Année :</strong> {selected.academic_year}</p>
              </div>
              <div className="space-y-2">
                <label className="text-sm font-medium">Note (optionnelle)</label>
                <Textarea
                  value={adminNote}
                  onChange={(e) => setAdminNote(e.target.value)}
                  placeholder={
                    action === "approve"
                      ? "Félicitations pour votre travail..."
                      : "Raison du refus..."
                  }
                  maxLength={500}
                />
              </div>
            </div>
          )}
          <DialogFooter>
            <Button variant="outline" onClick={() => { setSelected(null); setAction(null); }}>
              Annuler
            </Button>
            <Button
              onClick={handleAction}
              disabled={updateStatus.isPending || createPublication.isPending}
              className={action === "reject" ? "bg-destructive hover:bg-destructive/90" : ""}
            >
              {updateStatus.isPending
                ? "Traitement..."
                : action === "approve"
                ? "Approuver et publier"
                : "Refuser"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
