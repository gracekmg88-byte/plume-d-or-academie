import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { cn } from "@/lib/utils";

interface FormData {
  title: string;
  description: string;
  category: string;
}

interface Props {
  form: FormData;
  onChange: (updates: Partial<FormData>) => void;
  touched: Record<string, boolean>;
  onBlur: (field: string) => void;
}

function fieldState(value: string, touched: boolean) {
  if (!touched) return "idle";
  return value.trim().length > 0 ? "valid" : "invalid";
}

function inputClass(state: "idle" | "valid" | "invalid") {
  if (state === "valid") return "border-[hsl(var(--success))] focus-visible:ring-[hsl(var(--success))]";
  if (state === "invalid") return "border-destructive focus-visible:ring-destructive";
  return "";
}

export function SubmissionStepDetails({ form, onChange, touched, onBlur }: Props) {
  const titleState = fieldState(form.title, !!touched.title);

  return (
    <div className="space-y-5 animate-in fade-in slide-in-from-right-4 duration-300">
      <div className="space-y-2">
        <Label htmlFor="title">Titre du mémoire *</Label>
        <Input
          id="title"
          required
          maxLength={300}
          value={form.title}
          onChange={(e) => onChange({ title: e.target.value })}
          onBlur={() => onBlur("title")}
          placeholder="Étude sur l'impact de l'IA..."
          className={cn("transition-colors", inputClass(titleState))}
        />
        {titleState === "invalid" && (
          <p className="text-xs text-destructive animate-in fade-in duration-200">
            Ce champ est requis
          </p>
        )}
      </div>

      <div className="space-y-2">
        <Label htmlFor="category">Catégorie *</Label>
        <Select
          value={form.category}
          onValueChange={(val) => onChange({ category: val })}
        >
          <SelectTrigger className={cn("transition-colors", form.category ? "border-[hsl(var(--success))]" : "")}>
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
        <Label htmlFor="description">Description <span className="text-muted-foreground text-xs">(optionnel)</span></Label>
        <Textarea
          id="description"
          maxLength={2000}
          rows={4}
          value={form.description}
          onChange={(e) => onChange({ description: e.target.value })}
          placeholder="Décrivez brièvement votre travail..."
          className={cn("transition-colors", form.description.trim() ? "border-[hsl(var(--success))]" : "")}
        />
        <p className="text-xs text-muted-foreground text-right">
          {form.description.length}/2000
        </p>
      </div>
    </div>
  );
}
