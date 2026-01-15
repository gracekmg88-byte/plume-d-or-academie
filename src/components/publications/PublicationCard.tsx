import { Link } from "react-router-dom";
import { Book, FileText, GraduationCap, Newspaper, Eye } from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";

type Category = "livre" | "memoire" | "tfc" | "article";

interface PublicationCardProps {
  id: string;
  title: string;
  author: string;
  description?: string;
  category: Category;
  coverImageUrl?: string;
  viewsCount: number;
}

const categoryConfig: Record<Category, { label: string; icon: typeof Book; className: string }> = {
  livre: { label: "Livre", icon: Book, className: "bg-primary/10 text-primary" },
  memoire: { label: "Mémoire", icon: GraduationCap, className: "bg-blue-500/10 text-blue-600" },
  tfc: { label: "TFC", icon: FileText, className: "bg-green-500/10 text-green-600" },
  article: { label: "Article", icon: Newspaper, className: "bg-purple-500/10 text-purple-600" },
};

export function PublicationCard({
  id,
  title,
  author,
  description,
  category,
  coverImageUrl,
  viewsCount,
}: PublicationCardProps) {
  const config = categoryConfig[category];
  const Icon = config.icon;

  return (
    <Link to={`/publication/${id}`}>
      <Card className="group h-full overflow-hidden transition-all duration-300 hover:shadow-elegant hover:-translate-y-1 bg-card border-border/50">
        {/* Cover Image */}
        <div className="relative aspect-[3/4] overflow-hidden bg-muted">
          {coverImageUrl ? (
            <img
              src={coverImageUrl}
              alt={title}
              className="h-full w-full object-cover transition-transform duration-500 group-hover:scale-105"
            />
          ) : (
            <div className="flex h-full w-full items-center justify-center bg-gradient-to-br from-muted to-accent">
              <Icon className="h-16 w-16 text-muted-foreground/30" />
            </div>
          )}
          <Badge className={cn("absolute top-3 left-3", config.className)}>
            <Icon className="h-3 w-3 mr-1" />
            {config.label}
          </Badge>
        </div>

        {/* Content */}
        <CardContent className="p-4">
          <h3 className="font-serif text-lg font-semibold leading-tight line-clamp-2 group-hover:text-primary transition-colors">
            {title}
          </h3>
          <p className="mt-1 text-sm text-muted-foreground">{author}</p>
          {description && (
            <p className="mt-2 text-sm text-muted-foreground line-clamp-2 leading-relaxed">
              {description}
            </p>
          )}
          <div className="mt-3 flex items-center gap-1 text-xs text-muted-foreground">
            <Eye className="h-3 w-3" />
            <span>{viewsCount} consultations</span>
          </div>
        </CardContent>
      </Card>
    </Link>
  );
}
