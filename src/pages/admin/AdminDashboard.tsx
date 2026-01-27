import { useState } from "react";
import { useNavigate, Link } from "react-router-dom";
import { 
  Feather, LogOut, Plus, Book, FileText, GraduationCap, Newspaper, 
  Eye, LayoutDashboard, Settings, Trash2, Edit, ToggleLeft, ToggleRight,
  MessageSquare, Mail, Copy, Download
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog";
import { useAuth } from "@/hooks/useAuth";
import { useAdminPublications, useDeletePublication, useUpdatePublication } from "@/hooks/usePublications";
import { toast } from "sonner";
import { cn } from "@/lib/utils";
import { format } from "date-fns";
import { fr } from "date-fns/locale";

type Category = "livre" | "memoire" | "tfc" | "article";

const categoryConfig: Record<Category, { label: string; icon: typeof Book; className: string }> = {
  livre: { label: "Livre", icon: Book, className: "bg-primary/10 text-primary" },
  memoire: { label: "Mémoire", icon: GraduationCap, className: "bg-blue-500/10 text-blue-600" },
  tfc: { label: "TFC", icon: FileText, className: "bg-green-500/10 text-green-600" },
  article: { label: "Article", icon: Newspaper, className: "bg-purple-500/10 text-purple-600" },
};

export default function AdminDashboard() {
  const { user, isAdmin, loading, signOut } = useAuth();
  const { data: publications, isLoading } = useAdminPublications();
  const deletePublication = useDeletePublication();
  const updatePublication = useUpdatePublication();
  const navigate = useNavigate();

  const handleSignOut = async () => {
    await signOut();
    navigate("/admin");
  };

  const handleDelete = async (id: string) => {
    try {
      await deletePublication.mutateAsync(id);
      toast.success("Publication supprimée");
    } catch {
      toast.error("Erreur lors de la suppression");
    }
  };

  const handleTogglePublish = async (id: string, currentStatus: boolean) => {
    try {
      await updatePublication.mutateAsync({ id, is_published: !currentStatus });
      toast.success(currentStatus ? "Publication retirée" : "Publication publiée");
    } catch {
      toast.error("Erreur lors de la mise à jour");
    }
  };

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
          <h1 className="font-serif text-2xl font-bold text-foreground mb-4">
            Accès non autorisé
          </h1>
          <p className="text-muted-foreground mb-6">
            Vous devez être administrateur pour accéder à cette page.
          </p>
          <Link to="/admin">
            <Button>Se connecter</Button>
          </Link>
        </div>
      </div>
    );
  }

  const stats = {
    total: publications?.length || 0,
    published: publications?.filter((p) => p.is_published).length || 0,
    views: publications?.reduce((acc, p) => acc + p.views_count, 0) || 0,
  };

  return (
    <div className="min-h-screen bg-background">
      {/* Header */}
      <header className="sticky top-0 z-50 bg-secondary border-b border-border">
        <div className="container flex h-16 items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="h-9 w-9 rounded-full bg-primary text-primary-foreground flex items-center justify-center">
              <Feather className="h-5 w-5" />
            </div>
            <div>
              <span className="font-serif font-bold text-secondary-foreground">Administration</span>
              <span className="text-secondary-foreground/60 text-sm ml-2">Plume d'Or KMG</span>
            </div>
          </div>

          <div className="flex items-center gap-4">
            <Link to="/" className="text-secondary-foreground/70 hover:text-secondary-foreground text-sm">
              Voir le site
            </Link>
            <Button variant="ghost" size="sm" onClick={handleSignOut} className="text-secondary-foreground gap-2">
              <LogOut className="h-4 w-4" />
              Déconnexion
            </Button>
          </div>
        </div>
      </header>

      <div className="container py-8">
        {/* Stats */}
        <div className="grid sm:grid-cols-3 gap-4 mb-8">
          <div className="bg-card rounded-xl border border-border p-6">
            <div className="flex items-center gap-4">
              <div className="h-12 w-12 rounded-lg bg-primary/10 flex items-center justify-center">
                <LayoutDashboard className="h-6 w-6 text-primary" />
              </div>
              <div>
                <div className="text-2xl font-bold text-foreground">{stats.total}</div>
                <div className="text-sm text-muted-foreground">Publications totales</div>
              </div>
            </div>
          </div>
          <div className="bg-card rounded-xl border border-border p-6">
            <div className="flex items-center gap-4">
              <div className="h-12 w-12 rounded-lg bg-green-500/10 flex items-center justify-center">
                <Book className="h-6 w-6 text-green-600" />
              </div>
              <div>
                <div className="text-2xl font-bold text-foreground">{stats.published}</div>
                <div className="text-sm text-muted-foreground">Publiées</div>
              </div>
            </div>
          </div>
          <div className="bg-card rounded-xl border border-border p-6">
            <div className="flex items-center gap-4">
              <div className="h-12 w-12 rounded-lg bg-blue-500/10 flex items-center justify-center">
                <Eye className="h-6 w-6 text-blue-600" />
              </div>
              <div>
                <div className="text-2xl font-bold text-foreground">{stats.views}</div>
                <div className="text-sm text-muted-foreground">Consultations</div>
              </div>
            </div>
          </div>
        </div>

        {/* Quick Links */}
        <div className="grid sm:grid-cols-3 gap-4 mb-8">
          <Link to="/admin/messages" className="block">
            <div className="bg-card rounded-xl border border-border p-6 hover:shadow-elegant transition-all">
              <div className="flex items-center gap-4">
                <div className="h-12 w-12 rounded-lg bg-primary/10 flex items-center justify-center">
                  <MessageSquare className="h-6 w-6 text-primary" />
                </div>
                <div>
                  <div className="font-semibold text-foreground">Messages</div>
                  <div className="text-sm text-muted-foreground">Voir les demandes</div>
                </div>
              </div>
            </div>
          </Link>
          <Link to="/admin/users" className="block">
            <div className="bg-card rounded-xl border border-border p-6 hover:shadow-elegant transition-all">
              <div className="flex items-center gap-4">
                <div className="h-12 w-12 rounded-lg bg-blue-500/10 flex items-center justify-center">
                  <Mail className="h-6 w-6 text-blue-600" />
                </div>
                <div>
                  <div className="font-semibold text-foreground">Utilisateurs</div>
                  <div className="text-sm text-muted-foreground">Gérer les abonnements</div>
                </div>
              </div>
            </div>
          </Link>
          <Link to="/admin/settings" className="block">
            <div className="bg-card rounded-xl border border-border p-6 hover:shadow-elegant transition-all">
              <div className="flex items-center gap-4">
                <div className="h-12 w-12 rounded-lg bg-muted flex items-center justify-center">
                  <Settings className="h-6 w-6 text-muted-foreground" />
                </div>
                <div>
                  <div className="font-semibold text-foreground">Paramètres</div>
                  <div className="text-sm text-muted-foreground">Changer le mot de passe</div>
                </div>
              </div>
            </div>
          </Link>
        </div>

        {/* Actions */}
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 mb-6">
          <h1 className="font-serif text-2xl font-bold text-foreground">
            Gestion des publications
          </h1>
          <Link to="/admin/publication/nouvelle">
            <Button className="gap-2">
              <Plus className="h-4 w-4" />
              Nouvelle publication
            </Button>
          </Link>
        </div>

        {/* Publications Table */}
        <div className="bg-card rounded-xl border border-border overflow-hidden">
          {isLoading ? (
            <div className="p-8 text-center text-muted-foreground">Chargement...</div>
          ) : publications && publications.length > 0 ? (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Titre</TableHead>
                  <TableHead>Catégorie</TableHead>
                  <TableHead>Auteur</TableHead>
                  <TableHead className="text-center">Vues</TableHead>
                  <TableHead className="text-center">Statut</TableHead>
                  <TableHead>Date</TableHead>
                  <TableHead className="text-right">Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {publications.map((pub) => {
                  const config = categoryConfig[pub.category as Category];
                  const Icon = config.icon;
                  return (
                    <TableRow key={pub.id}>
                      <TableCell className="font-medium max-w-[200px] truncate">
                        {pub.title}
                      </TableCell>
                      <TableCell>
                        <Badge className={cn("gap-1", config.className)}>
                          <Icon className="h-3 w-3" />
                          {config.label}
                        </Badge>
                      </TableCell>
                      <TableCell className="text-muted-foreground">{pub.author}</TableCell>
                      <TableCell className="text-center">{pub.views_count}</TableCell>
                      <TableCell className="text-center">
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => handleTogglePublish(pub.id, pub.is_published)}
                          className={cn(
                            "gap-1",
                            pub.is_published ? "text-green-600" : "text-muted-foreground"
                          )}
                        >
                          {pub.is_published ? (
                            <>
                              <ToggleRight className="h-4 w-4" />
                              Publié
                            </>
                          ) : (
                            <>
                              <ToggleLeft className="h-4 w-4" />
                              Brouillon
                            </>
                          )}
                        </Button>
                      </TableCell>
                      <TableCell className="text-muted-foreground text-sm">
                        {format(new Date(pub.created_at), "dd/MM/yyyy", { locale: fr })}
                      </TableCell>
                      <TableCell className="text-right">
                        <div className="flex items-center justify-end gap-1">
                          {pub.file_url && (
                            <TooltipProvider>
                              <Tooltip>
                                <TooltipTrigger asChild>
                                  <Button
                                    variant="ghost"
                                    size="icon"
                                    className="text-green-600"
                                    onClick={() => {
                                      navigator.clipboard.writeText(pub.file_url!);
                                      toast.success("Lien de téléchargement copié !");
                                    }}
                                  >
                                    <Download className="h-4 w-4" />
                                  </Button>
                                </TooltipTrigger>
                                <TooltipContent>
                                  <p>Copier le lien de téléchargement</p>
                                </TooltipContent>
                              </Tooltip>
                            </TooltipProvider>
                          )}
                          <Link to={`/admin/publication/${pub.id}`}>
                            <Button variant="ghost" size="icon">
                              <Edit className="h-4 w-4" />
                            </Button>
                          </Link>
                          <AlertDialog>
                            <AlertDialogTrigger asChild>
                              <Button variant="ghost" size="icon" className="text-destructive">
                                <Trash2 className="h-4 w-4" />
                              </Button>
                            </AlertDialogTrigger>
                            <AlertDialogContent>
                              <AlertDialogHeader>
                                <AlertDialogTitle>Supprimer cette publication ?</AlertDialogTitle>
                                <AlertDialogDescription>
                                  Cette action est irréversible. La publication sera définitivement supprimée.
                                </AlertDialogDescription>
                              </AlertDialogHeader>
                              <AlertDialogFooter>
                                <AlertDialogCancel>Annuler</AlertDialogCancel>
                                <AlertDialogAction
                                  onClick={() => handleDelete(pub.id)}
                                  className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
                                >
                                  Supprimer
                                </AlertDialogAction>
                              </AlertDialogFooter>
                            </AlertDialogContent>
                          </AlertDialog>
                        </div>
                      </TableCell>
                    </TableRow>
                  );
                })}
              </TableBody>
            </Table>
          ) : (
            <div className="p-8 text-center text-muted-foreground">
              <Book className="h-12 w-12 mx-auto mb-4 opacity-30" />
              <p>Aucune publication pour le moment.</p>
              <Link to="/admin/publication/nouvelle" className="mt-4 inline-block">
                <Button size="sm" className="gap-2">
                  <Plus className="h-4 w-4" />
                  Créer une publication
                </Button>
              </Link>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
