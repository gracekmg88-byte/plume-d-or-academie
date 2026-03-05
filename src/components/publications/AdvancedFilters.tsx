import { useState } from "react";
import { SlidersHorizontal, ArrowUpDown, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useLanguage } from "@/contexts/LanguageContext";

export type SortOption = "date_desc" | "date_asc" | "views_desc" | "views_asc" | "title_asc" | "title_desc";

export interface AdvancedFilterValues {
  author: string;
  sortBy: SortOption;
}

interface AdvancedFiltersProps {
  values: AdvancedFilterValues;
  onChange: (values: AdvancedFilterValues) => void;
  authors: string[];
}

const sortLabels: Record<string, Record<SortOption, string>> = {
  fr: {
    date_desc: "Plus récent",
    date_asc: "Plus ancien",
    views_desc: "Plus consulté",
    views_asc: "Moins consulté",
    title_asc: "Titre A→Z",
    title_desc: "Titre Z→A",
  },
  en: {
    date_desc: "Newest",
    date_asc: "Oldest",
    views_desc: "Most viewed",
    views_asc: "Least viewed",
    title_asc: "Title A→Z",
    title_desc: "Title Z→A",
  },
};

export function AdvancedFilters({ values, onChange, authors }: AdvancedFiltersProps) {
  const [open, setOpen] = useState(false);
  const { language } = useLanguage();
  const labels = sortLabels[language] || sortLabels.fr;

  const hasActiveFilters = values.author !== "" || values.sortBy !== "date_desc";

  const handleReset = () => {
    onChange({ author: "", sortBy: "date_desc" });
  };

  return (
    <div className="space-y-3">
      <div className="flex items-center gap-2">
        <Button
          variant={open ? "default" : "outline"}
          size="sm"
          className="gap-2"
          onClick={() => setOpen(!open)}
        >
          <SlidersHorizontal className="h-4 w-4" />
          {language === "fr" ? "Filtres" : "Filters"}
          {hasActiveFilters && (
            <span className="ml-1 h-2 w-2 rounded-full bg-primary-foreground" />
          )}
        </Button>

        {hasActiveFilters && (
          <Button variant="ghost" size="sm" className="gap-1 text-xs" onClick={handleReset}>
            <X className="h-3 w-3" />
            {language === "fr" ? "Réinitialiser" : "Reset"}
          </Button>
        )}
      </div>

      {open && (
        <div className="flex flex-wrap gap-3 animate-in fade-in slide-in-from-top-2 duration-200">
          {/* Sort */}
          <Select
            value={values.sortBy}
            onValueChange={(v) => onChange({ ...values, sortBy: v as SortOption })}
          >
            <SelectTrigger className="w-[180px] h-9">
              <ArrowUpDown className="h-3.5 w-3.5 mr-2 shrink-0" />
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {Object.entries(labels).map(([key, label]) => (
                <SelectItem key={key} value={key}>
                  {label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>

          {/* Author filter */}
          {authors.length > 0 && (
            <Select
              value={values.author || "__all__"}
              onValueChange={(v) => onChange({ ...values, author: v === "__all__" ? "" : v })}
            >
              <SelectTrigger className="w-[200px] h-9">
                <SelectValue placeholder={language === "fr" ? "Tous les auteurs" : "All authors"} />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="__all__">
                  {language === "fr" ? "Tous les auteurs" : "All authors"}
                </SelectItem>
                {authors.map((a) => (
                  <SelectItem key={a} value={a}>
                    {a}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          )}
        </div>
      )}
    </div>
  );
}
