import { useState } from "react";
import { MessageSquarePlus, Trash2, Edit3, Check, X, StickyNote } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { ScrollArea } from "@/components/ui/scroll-area";
import { useAnnotations, type Annotation } from "@/hooks/useAnnotations";
import { useAuth } from "@/hooks/useAuth";
import { toast } from "sonner";
import { cn } from "@/lib/utils";

const NOTE_COLORS = [
  { value: "#FDE047", label: "Jaune" },
  { value: "#86EFAC", label: "Vert" },
  { value: "#93C5FD", label: "Bleu" },
  { value: "#FCA5A5", label: "Rouge" },
  { value: "#C4B5FD", label: "Violet" },
];

interface AnnotationsPanelProps {
  publicationId: string;
  currentPage: number;
}

export function AnnotationsPanel({ publicationId, currentPage }: AnnotationsPanelProps) {
  const { user } = useAuth();
  const { annotations, getPageAnnotations, addAnnotation, updateAnnotation, deleteAnnotation } = useAnnotations(publicationId);
  const [newNote, setNewNote] = useState("");
  const [selectedColor, setSelectedColor] = useState("#FDE047");
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editContent, setEditContent] = useState("");
  const [showAllPages, setShowAllPages] = useState(false);

  if (!user) {
    return (
      <div className="bg-card border border-border rounded-xl p-4 text-center space-y-3">
        <StickyNote className="h-8 w-8 mx-auto text-muted-foreground/50" />
        <p className="text-sm text-muted-foreground">
          Prenez des notes et annotations sur chaque page pour enrichir votre lecture.
        </p>
        <a
          href="/auth"
          className="inline-flex items-center gap-2 rounded-md bg-primary px-4 py-2 text-sm font-medium text-primary-foreground hover:bg-primary/90 transition-colors"
        >
          Se connecter pour annoter
        </a>
      </div>
    );
  }

  const displayAnnotations = showAllPages ? annotations : getPageAnnotations(currentPage);

  const handleAdd = async () => {
    if (!newNote.trim()) return;
    try {
      await addAnnotation.mutateAsync({ pageNumber: currentPage, content: newNote.trim(), color: selectedColor });
      setNewNote("");
      toast.success("Note ajoutée");
    } catch {
      toast.error("Erreur lors de l'ajout");
    }
  };

  const handleUpdate = async (id: string) => {
    if (!editContent.trim()) return;
    try {
      await updateAnnotation.mutateAsync({ id, content: editContent.trim() });
      setEditingId(null);
      toast.success("Note modifiée");
    } catch {
      toast.error("Erreur lors de la modification");
    }
  };

  const handleDelete = async (id: string) => {
    try {
      await deleteAnnotation.mutateAsync(id);
      toast.success("Note supprimée");
    } catch {
      toast.error("Erreur lors de la suppression");
    }
  };

  return (
    <div className="bg-card border border-border rounded-xl overflow-hidden">
      <div className="px-4 py-3 border-b border-border flex items-center justify-between">
        <h3 className="font-semibold text-sm flex items-center gap-2">
          <StickyNote className="h-4 w-4 text-primary" />
          Notes & Annotations
        </h3>
        <button
          onClick={() => setShowAllPages(!showAllPages)}
          className="text-xs text-muted-foreground hover:text-foreground transition-colors"
        >
          {showAllPages ? "Page actuelle" : `Toutes (${annotations.length})`}
        </button>
      </div>

      {/* New note form */}
      <div className="p-3 border-b border-border space-y-2">
        <Textarea
          value={newNote}
          onChange={(e) => setNewNote(e.target.value)}
          placeholder={`Note pour la page ${currentPage}...`}
          className="min-h-[60px] text-sm resize-none"
          rows={2}
        />
        <div className="flex items-center justify-between">
          <div className="flex gap-1">
            {NOTE_COLORS.map((c) => (
              <button
                key={c.value}
                onClick={() => setSelectedColor(c.value)}
                className={cn(
                  "w-5 h-5 rounded-full border-2 transition-transform",
                  selectedColor === c.value ? "scale-125 border-foreground" : "border-transparent hover:scale-110"
                )}
                style={{ backgroundColor: c.value }}
                title={c.label}
              />
            ))}
          </div>
          <Button size="sm" onClick={handleAdd} disabled={!newNote.trim() || addAnnotation.isPending} className="gap-1.5 h-7 text-xs">
            <MessageSquarePlus className="h-3 w-3" />
            Ajouter
          </Button>
        </div>
      </div>

      {/* Notes list */}
      <ScrollArea className="max-h-[300px]">
        {displayAnnotations.length === 0 ? (
          <div className="p-4 text-center text-xs text-muted-foreground">
            Aucune note {showAllPages ? "" : `pour la page ${currentPage}`}
          </div>
        ) : (
          <div className="divide-y divide-border">
            {displayAnnotations.map((note) => (
              <NoteItem
                key={note.id}
                note={note}
                isEditing={editingId === note.id}
                editContent={editContent}
                onStartEdit={() => { setEditingId(note.id); setEditContent(note.content); }}
                onCancelEdit={() => setEditingId(null)}
                onSaveEdit={() => handleUpdate(note.id)}
                onEditChange={setEditContent}
                onDelete={() => handleDelete(note.id)}
                showPage={showAllPages}
              />
            ))}
          </div>
        )}
      </ScrollArea>
    </div>
  );
}

function NoteItem({
  note, isEditing, editContent, onStartEdit, onCancelEdit, onSaveEdit, onEditChange, onDelete, showPage,
}: {
  note: Annotation; isEditing: boolean; editContent: string;
  onStartEdit: () => void; onCancelEdit: () => void; onSaveEdit: () => void;
  onEditChange: (v: string) => void; onDelete: () => void; showPage: boolean;
}) {
  return (
    <div className="p-3 group">
      <div className="flex items-start gap-2">
        <div className="w-2.5 h-2.5 rounded-full mt-1.5 shrink-0" style={{ backgroundColor: note.color }} />
        <div className="flex-1 min-w-0">
          {showPage && (
            <span className="text-[10px] text-muted-foreground font-medium">Page {note.page_number}</span>
          )}
          {isEditing ? (
            <div className="space-y-1.5">
              <Textarea value={editContent} onChange={(e) => onEditChange(e.target.value)} className="min-h-[50px] text-sm" rows={2} />
              <div className="flex gap-1">
                <Button size="sm" variant="ghost" onClick={onSaveEdit} className="h-6 w-6 p-0"><Check className="h-3 w-3" /></Button>
                <Button size="sm" variant="ghost" onClick={onCancelEdit} className="h-6 w-6 p-0"><X className="h-3 w-3" /></Button>
              </div>
            </div>
          ) : (
            <p className="text-sm text-foreground whitespace-pre-wrap break-words">{note.content}</p>
          )}
        </div>
        {!isEditing && (
          <div className="flex gap-0.5 opacity-0 group-hover:opacity-100 transition-opacity shrink-0">
            <Button size="sm" variant="ghost" onClick={onStartEdit} className="h-6 w-6 p-0"><Edit3 className="h-3 w-3" /></Button>
            <Button size="sm" variant="ghost" onClick={onDelete} className="h-6 w-6 p-0 text-destructive"><Trash2 className="h-3 w-3" /></Button>
          </div>
        )}
      </div>
    </div>
  );
}
