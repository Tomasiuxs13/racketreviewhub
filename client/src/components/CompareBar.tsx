import { Link } from "wouter";
import { Button } from "@/components/ui/button";
import { X, ArrowRight } from "lucide-react";
import { useCompare } from "@/hooks/useCompare";

export function CompareBar() {
  const { compareIds, removeFromCompare, clearCompare, compareUrl, compareCount } = useCompare();

  if (compareCount === 0) return null;

  return (
    <div className="fixed bottom-0 left-0 right-0 z-50 border-t bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/80 shadow-lg px-4 py-3">
      <div className="max-w-7xl mx-auto flex items-center justify-between gap-4">
        <div className="flex items-center gap-3 flex-1 min-w-0">
          <span className="text-sm font-medium whitespace-nowrap">
            Compare ({compareCount})
          </span>
          <div className="flex gap-2 overflow-x-auto">
            {compareIds.map((slug) => (
              <span
                key={slug}
                className="inline-flex items-center gap-1 text-xs bg-muted rounded-full px-2.5 py-1 whitespace-nowrap"
              >
                {slug.replace(/-/g, " ")}
                <button
                  onClick={() => removeFromCompare(slug)}
                  className="text-muted-foreground hover:text-foreground"
                  aria-label={`Remove ${slug} from comparison`}
                >
                  <X className="h-3 w-3" />
                </button>
              </span>
            ))}
          </div>
        </div>
        <div className="flex items-center gap-2">
          <Button variant="ghost" size="sm" onClick={clearCompare}>
            Clear
          </Button>
          {compareUrl ? (
            <Link href={compareUrl}>
              <Button size="sm">
                Compare <ArrowRight className="ml-1 h-4 w-4" />
              </Button>
            </Link>
          ) : (
            <Button size="sm" disabled>
              Select 2+ rackets
            </Button>
          )}
        </div>
      </div>
    </div>
  );
}
