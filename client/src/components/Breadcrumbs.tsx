import { Link } from "wouter";
import { ChevronRight, Home } from "lucide-react";
import { useI18n } from "@/i18n/useI18n";

export interface BreadcrumbItem {
  label: string;
  href?: string;
}

interface BreadcrumbsProps {
  items: BreadcrumbItem[];
}

export function Breadcrumbs({ items }: BreadcrumbsProps) {
  const { t } = useI18n();
  const allItems = [{ label: t("breadcrumbs.home"), href: "/" }, ...items];

  return (
    <nav aria-label="Breadcrumb" className="mb-6">
      <ol className="flex items-center gap-2 text-sm text-muted-foreground flex-wrap">
        {allItems.map((item, index) => {
          const isLast = index === allItems.length - 1;
          return (
            <li key={index} className="flex items-center gap-2">
              {index === 0 ? (
                <Link href={item.href || "#"} className="flex items-center">
                  <Home className="h-4 w-4" aria-hidden="true" />
                  <span className="sr-only">{item.label}</span>
                </Link>
              ) : (
                <>
                  <ChevronRight className="h-4 w-4" aria-hidden="true" />
                  {isLast ? (
                    <span className="text-foreground font-medium" aria-current="page">
                      {item.label}
                    </span>
                  ) : item.href ? (
                    <Link href={item.href} className="hover:text-foreground transition-colors">
                      {item.label}
                    </Link>
                  ) : (
                    <span>{item.label}</span>
                  )}
                </>
              )}
            </li>
          );
        })}
      </ol>
    </nav>
  );
}

