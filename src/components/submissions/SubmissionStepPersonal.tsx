import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

interface FormData {
  student_name: string;
  university: string;
  faculty: string;
  academic_year: string;
}

interface Props {
  form: FormData;
  onChange: (updates: Partial<FormData>) => void;
}

export function SubmissionStepPersonal({ form, onChange }: Props) {
  return (
    <div className="space-y-5 animate-in fade-in slide-in-from-right-4 duration-300">
      <div className="grid sm:grid-cols-2 gap-4">
        <div className="space-y-2">
          <Label htmlFor="student_name">Nom complet *</Label>
          <Input
            id="student_name"
            required
            maxLength={100}
            value={form.student_name}
            onChange={(e) => onChange({ student_name: e.target.value })}
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
            onChange={(e) => onChange({ university: e.target.value })}
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
            onChange={(e) => onChange({ faculty: e.target.value })}
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
            onChange={(e) => onChange({ academic_year: e.target.value })}
            placeholder="2025-2026"
          />
        </div>
      </div>
    </div>
  );
}
