import { Book, FileText, GraduationCap, Newspaper, LayoutGrid } from "lucide-react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

type Category = "all" | "livre" | "memoire" | "tfc" | "article";

interface CategoryFilterProps {
  selected: Category;
  onChange: (category: Category) => void;
}

const categories: { value: Category; label: string; icon: typeof Book }[] = [
  { value: "all", label: "Tout", icon: LayoutGrid },
  { value: "livre", label: "Livres", icon: Book },
  { value: "memoire", label: "Mémoires", icon: GraduationCap },
  { value: "tfc", label: "TFC", icon: FileText },
  { value: "article", label: "Articles", icon: Newspaper },
];

export function CategoryFilter({ selected, onChange }: CategoryFilterProps) {
  return (
    <div className="flex flex-wrap gap-2">
      {categories.map((category) => {
        const Icon = category.icon;
        const isSelected = selected === category.value;
        
        return (
          <Button
            key={category.value}
            variant={isSelected ? "default" : "outline"}
            size="sm"
            onClick={() => onChange(category.value)}
            className={cn(
              "gap-2 transition-all",
              isSelected && "shadow-md"
            )}
          >
            <Icon className="h-4 w-4" />
            {category.label}
          </Button>
        );
      })}
    </div>
  );
}
