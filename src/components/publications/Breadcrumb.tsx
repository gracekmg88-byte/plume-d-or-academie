import { Link } from "react-router-dom";
import { ChevronRight, Home } from "lucide-react";

export interface BreadcrumbItem {
  label: string;
  to?: string;
}

interface BreadcrumbProps {
  items: BreadcrumbItem[];
}

export function Breadcrumb({ items }: BreadcrumbProps) {
  return (
    <nav
      aria-label="Fil d'Ariane"
      className="mb-6 flex items-center gap-1.5 text-sm text-muted-foreground overflow-x-auto"
    >
      <Link
        to="/"
        className="inline-flex items-center gap-1 hover:text-foreground transition-colors"
        aria-label="Accueil"
      >
        <Home className="h-3.5 w-3.5" />
      </Link>
      {items.map((item, i) => (
        <span key={i} className="flex items-center gap-1.5 whitespace-nowrap">
          <ChevronRight className="h-3.5 w-3.5 opacity-50" />
          {item.to && i < items.length - 1 ? (
            <Link to={item.to} className="hover:text-foreground transition-colors">
              {item.label}
            </Link>
          ) : (
            <span className="text-foreground font-medium line-clamp-1 max-w-[60vw]">
              {item.label}
            </span>
          )}
        </span>
      ))}
    </nav>
  );
}
