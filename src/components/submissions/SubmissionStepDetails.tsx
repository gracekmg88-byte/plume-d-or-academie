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

interface FormData {
  title: string;
  description: string;
  category: string;
}

interface Props {
  form: FormData;
  onChange: (updates: Partial<FormData>) => void;
}

export function SubmissionStepDetails({ form, onChange }: Props) {
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
          placeholder="Étude sur l'impact de l'IA..."
        />
      </div>

      <div className="space-y-2">
        <Label htmlFor="category">Catégorie *</Label>
        <Select
          value={form.category}
          onValueChange={(val) => onChange({ category: val })}
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
          onChange={(e) => onChange({ description: e.target.value })}
          placeholder="Décrivez brièvement votre travail..."
        />
      </div>
    </div>
  );
}
