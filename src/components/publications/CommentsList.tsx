import { useState } from "react";
import { MessageSquare, Send, Trash2, User as UserIcon } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { useComments } from "@/hooks/useComments";
import { useAuth } from "@/hooks/useAuth";
import { formatDistanceToNow } from "date-fns";
import { fr } from "date-fns/locale";
import { toast } from "sonner";
import { cn } from "@/lib/utils";
import { Link } from "react-router-dom";

interface CommentsListProps {
  publicationId: string;
}

export function CommentsList({ publicationId }: CommentsListProps) {
  const { user } = useAuth();
  const { comments, isLoading, addComment, isAdding, deleteComment, canDelete } =
    useComments(publicationId);
  const [newComment, setNewComment] = useState("");

  const handleSubmit = async () => {
    const trimmed = newComment.trim();
    if (!trimmed) return;
    if (trimmed.length > 1000) {
      toast.error("Le commentaire ne doit pas dépasser 1000 caractères.");
      return;
    }
    try {
      await addComment(trimmed);
      setNewComment("");
      toast.success("Commentaire ajouté !");
    } catch {
      toast.error("Erreur lors de l'ajout du commentaire.");
    }
  };

  const handleDelete = (commentId: string) => {
    deleteComment(commentId);
    toast.success("Commentaire supprimé.");
  };

  return (
    <div className="space-y-6">
      <h2 className="font-serif text-xl font-semibold text-foreground flex items-center gap-2">
        <MessageSquare className="h-5 w-5 text-primary" />
        Commentaires
        {comments.length > 0 && (
          <span className="text-sm font-normal text-muted-foreground">
            ({comments.length})
          </span>
        )}
      </h2>

      {/* Add comment form */}
      {user ? (
        <div className="space-y-3">
          <Textarea
            placeholder="Écrire un commentaire..."
            value={newComment}
            onChange={(e) => setNewComment(e.target.value)}
            maxLength={1000}
            className="min-h-[80px] resize-none"
          />
          <div className="flex items-center justify-between">
            <span className="text-xs text-muted-foreground">
              {newComment.length}/1000
            </span>
            <Button
              onClick={handleSubmit}
              disabled={!newComment.trim() || isAdding}
              size="sm"
              className="gap-2"
            >
              <Send className="h-3.5 w-3.5" />
              {isAdding ? "Envoi..." : "Publier"}
            </Button>
          </div>
        </div>
      ) : (
        <div className="rounded-lg border border-border bg-muted/30 px-4 py-3 text-center text-sm text-muted-foreground">
          <Link to="/auth" className="text-primary hover:underline font-medium">
            Connectez-vous
          </Link>{" "}
          pour laisser un commentaire.
        </div>
      )}

      {/* Comments list */}
      {isLoading ? (
        <div className="space-y-4">
          {[1, 2].map((i) => (
            <div key={i} className="animate-pulse space-y-2">
              <div className="h-4 w-1/3 rounded bg-muted" />
              <div className="h-3 w-full rounded bg-muted" />
            </div>
          ))}
        </div>
      ) : comments.length === 0 ? (
        <div className="py-8 text-center">
          <MessageSquare className="mx-auto mb-2 h-8 w-8 text-muted-foreground/20" />
          <p className="text-sm text-muted-foreground">
            Aucun commentaire pour le moment. Soyez le premier !
          </p>
        </div>
      ) : (
        <div className="space-y-4">
          {comments.map((comment) => (
            <div
              key={comment.id}
              className={cn(
                "rounded-lg border border-border bg-card p-4 transition-colors",
                user?.id === comment.user_id && "border-primary/20 bg-primary/5"
              )}
            >
              <div className="flex items-start justify-between gap-3">
                <div className="flex items-center gap-2">
                  <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-primary/10">
                    <UserIcon className="h-4 w-4 text-primary" />
                  </div>
                  <div>
                    <p className="text-sm font-medium text-foreground">
                      {comment.user_name}
                    </p>
                    <p className="text-[10px] text-muted-foreground">
                      {formatDistanceToNow(new Date(comment.created_at), {
                        addSuffix: true,
                        locale: fr,
                      })}
                    </p>
                  </div>
                </div>
                {canDelete(comment) && (
                  <Button
                    variant="ghost"
                    size="icon"
                    className="h-7 w-7 text-muted-foreground hover:text-destructive"
                    onClick={() => handleDelete(comment.id)}
                  >
                    <Trash2 className="h-3.5 w-3.5" />
                  </Button>
                )}
              </div>
              <p className="mt-3 text-sm text-foreground/90 whitespace-pre-wrap leading-relaxed">
                {comment.content}
              </p>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
