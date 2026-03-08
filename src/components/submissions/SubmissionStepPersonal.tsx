import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { cn } from "@/lib/utils";

interface FormData {
  student_name: string;
  university: string;
  faculty: string;
  academic_year: string;
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

export function SubmissionStepPersonal({ form, onChange, touched, onBlur }: Props) {
  const fields: { id: keyof FormData; label: string; placeholder: string; maxLength: number }[] = [
    { id: "student_name", label: "Nom complet *", placeholder: "Jean Mukadi", maxLength: 100 },
    { id: "university", label: "Université *", placeholder: "Université de Kinshasa", maxLength: 200 },
    { id: "faculty", label: "Faculté *", placeholder: "Sciences Informatiques", maxLength: 200 },
    { id: "academic_year", label: "Année académique *", placeholder: "2025-2026", maxLength: 20 },
  ];

  return (
    <div className="space-y-5 animate-in fade-in slide-in-from-right-4 duration-300">
      <div className="grid sm:grid-cols-2 gap-4">
        {fields.map((f) => {
          const state = fieldState(form[f.id], !!touched[f.id]);
          return (
            <div key={f.id} className="space-y-2">
              <Label htmlFor={f.id}>{f.label}</Label>
              <Input
                id={f.id}
                required
                maxLength={f.maxLength}
                value={form[f.id]}
                onChange={(e) => onChange({ [f.id]: e.target.value })}
                onBlur={() => onBlur(f.id)}
                placeholder={f.placeholder}
                className={cn("transition-colors", inputClass(state))}
              />
              {state === "invalid" && (
                <p className="text-xs text-destructive animate-in fade-in duration-200">
                  Ce champ est requis
                </p>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}
