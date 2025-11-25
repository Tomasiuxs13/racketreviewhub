import { useQuery } from "@tanstack/react-query";
import { Link } from "wouter";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { ExternalLink } from "lucide-react";
import type { Racket } from "@shared/schema";
import { getRacketSlug } from "@/lib/utils";

interface MentionedRacketsProps {
  content: string;
  variant?: "default" | "sidebar";
}

/**
 * Extracts potential racket mentions from HTML content
 * Looks for patterns like "Brand Model", "Brand Model Year", etc.
 */
function extractRacketMentions(content: string): Array<{ brand: string; model: string }> {
  if (!content) return [];
  
  // Remove HTML tags to work with plain text
  const textContent = content.replace(/<[^>]*>/g, " ");
  
  // Get all rackets from the API to match against
  // This will be done in the component via useQuery
  
  // For now, return empty array - matching will happen in the component
  return [];
}

/**
 * Matches text content against racket brand/model combinations
 */
function findMentionedRackets(
  content: string,
  allRackets: Racket[]
): Racket[] {
  if (!content || !allRackets.length) return [];
  
  // Remove HTML tags and normalize whitespace
  const textContent = content
    .replace(/<[^>]*>/g, " ")
    .replace(/\s+/g, " ")
    .toLowerCase();
  
  const mentioned: Racket[] = [];
  const seen = new Set<string>();
  
  // Group rackets by brand for better matching
  const racketsByBrand = new Map<string, Racket[]>();
  for (const racket of allRackets) {
    const brand = racket.brand.toLowerCase();
    if (!racketsByBrand.has(brand)) {
      racketsByBrand.set(brand, []);
    }
    racketsByBrand.get(brand)!.push(racket);
  }
  
  // Check each racket
  for (const racket of allRackets) {
    if (seen.has(racket.id)) continue;
    
    const brandLower = racket.brand.toLowerCase();
    const modelLower = racket.model.toLowerCase();
    
    // Escape special regex characters in brand and model
    const escapeRegex = (str: string) => str.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
    const escapedBrand = escapeRegex(brandLower);
    const escapedModel = escapeRegex(modelLower);
    
    // Pattern 1: "Brand Model" (exact match)
    const brandModelPattern = new RegExp(`\\b${escapedBrand}\\s+${escapedModel}\\b`, "i");
    
    // Pattern 2: "Model" when brand is mentioned nearby (within 50 chars)
    // This handles cases where brand is mentioned separately from model
    const brandPattern = new RegExp(`\\b${escapedBrand}\\b`, "i");
    const modelPattern = new RegExp(`\\b${escapedModel}\\b`, "i");
    
    // Check for exact brand+model match
    if (brandModelPattern.test(textContent)) {
      mentioned.push(racket);
      seen.add(racket.id);
      continue;
    }
    
    // Check if model is mentioned and brand appears nearby
    if (modelPattern.test(textContent)) {
      const modelMatches = [...textContent.matchAll(new RegExp(`\\b${escapedModel}\\b`, "gi"))];
      
      for (const match of modelMatches) {
        const modelIndex = match.index || 0;
        const beforeText = textContent.substring(Math.max(0, modelIndex - 100), modelIndex);
        const afterText = textContent.substring(modelIndex + match[0].length, Math.min(textContent.length, modelIndex + match[0].length + 100));
        
        // Check if brand appears within 100 characters of the model mention
        if (brandPattern.test(beforeText + afterText)) {
          // Additional check: make sure this model isn't too generic
          // Only include if it's a specific model name (more than 3 characters)
          if (modelLower.length > 3) {
            mentioned.push(racket);
            seen.add(racket.id);
            break;
          }
        }
      }
    }
  }
  
  // Limit to top 6 most relevant (by overall rating, then by year)
  return mentioned
    .sort((a, b) => {
      if (b.overallRating !== a.overallRating) {
        return b.overallRating - a.overallRating;
      }
      return b.year - a.year;
    })
    .slice(0, 6);
}

export function MentionedRackets({ content, variant = "default" }: MentionedRacketsProps) {
  // Fetch all rackets to match against
  const { data: allRackets } = useQuery<Racket[]>({
    queryKey: ["/api/rackets"],
  });

  if (!allRackets || !content) return null;

  const mentionedRackets = findMentionedRackets(content, allRackets);

  if (mentionedRackets.length === 0) return null;

  if (variant === "sidebar") {
    return (
      <Card>
        <CardContent className="p-6">
          <h3 className="font-semibold text-lg mb-4">Mentioned Rackets</h3>
          <div className="space-y-4">
            {mentionedRackets.map((racket) => (
              <div key={racket.id} className="flex gap-3 pb-4 border-b last:border-0 last:pb-0">
                {/* Image */}
                <div className="flex-shrink-0 w-16 h-16 bg-muted rounded-md overflow-hidden flex items-center justify-center">
                  {racket.imageUrl ? (
                    <img
                      src={racket.imageUrl}
                      alt={`${racket.brand} ${racket.model}`}
                      className="w-full h-full object-contain"
                      loading="lazy"
                    />
                  ) : (
                    <div className="text-muted-foreground text-xs text-center p-1">
                      No image
                    </div>
                  )}
                </div>
                
                {/* Info */}
                <div className="flex-1 min-w-0">
                  <div className="mb-1">
                    <Badge variant="secondary" className="text-xs mb-1">
                      {racket.brand}
                    </Badge>
                    <h4 className="font-semibold text-sm line-clamp-1">
                      {racket.model}
                    </h4>
                  </div>
                  
                  <div className="mt-2">
                    <div className="text-base font-bold text-primary mb-1">
                      €{Number(racket.currentPrice).toFixed(2)}
                    </div>
                    <div className="text-xs text-muted-foreground mb-2">
                      Rating: {racket.overallRating}/100
                    </div>
                    
                    <div className="flex flex-col gap-1.5">
                      <Link href={`/rackets/${getRacketSlug(racket)}`}>
                        <Button variant="outline" size="sm" className="text-xs h-7 w-full">
                          Review
                        </Button>
                      </Link>
                      {(racket.affiliateLink || racket.titleUrl) && (
                        <Button
                          size="sm"
                          className="text-xs h-7 w-full"
                          onClick={(e) => {
                            e.preventDefault();
                            window.open(
                              racket.affiliateLink || racket.titleUrl || "#",
                              "_blank",
                              "noopener,noreferrer"
                            );
                          }}
                        >
                          Buy Now
                          <ExternalLink className="ml-1 h-3 w-3" />
                        </Button>
                      )}
                    </div>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </CardContent>
      </Card>
    );
  }

  return (
    <div className="mt-8 pt-8 border-t">
      <h3 className="font-semibold text-xl mb-4">Mentioned Rackets</h3>
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
        {mentionedRackets.map((racket) => (
          <Card key={racket.id} className="overflow-hidden">
            <CardContent className="p-4">
              <div className="flex gap-3">
                {/* Image */}
                <div className="flex-shrink-0 w-20 h-20 bg-muted rounded-md overflow-hidden flex items-center justify-center">
                  {racket.imageUrl ? (
                    <img
                      src={racket.imageUrl}
                      alt={`${racket.brand} ${racket.model}`}
                      className="w-full h-full object-contain"
                      loading="lazy"
                    />
                  ) : (
                    <div className="text-muted-foreground text-xs text-center p-1">
                      No image
                    </div>
                  )}
                </div>
                
                {/* Info */}
                <div className="flex-1 min-w-0">
                  <div className="mb-1">
                    <Badge variant="secondary" className="text-xs mb-1">
                      {racket.brand}
                    </Badge>
                    <h4 className="font-semibold text-sm line-clamp-1">
                      {racket.model}
                    </h4>
                  </div>
                  
                  <div className="flex items-center justify-between gap-2 mt-2">
                    <div>
                      <div className="text-lg font-bold text-primary">
                        €{Number(racket.currentPrice).toFixed(2)}
                      </div>
                      <div className="text-xs text-muted-foreground">
                        Rating: {racket.overallRating}/100
                      </div>
                    </div>
                    
                    <div className="flex flex-col gap-1">
                      <Link href={`/rackets/${getRacketSlug(racket)}`}>
                        <Button variant="outline" size="sm" className="text-xs h-7">
                          Review
                        </Button>
                      </Link>
                      {(racket.affiliateLink || racket.titleUrl) && (
                        <Button
                          size="sm"
                          className="text-xs h-7"
                          onClick={(e) => {
                            e.preventDefault();
                            window.open(
                              racket.affiliateLink || racket.titleUrl || "#",
                              "_blank",
                              "noopener,noreferrer"
                            );
                          }}
                        >
                          Buy Now
                          <ExternalLink className="ml-1 h-3 w-3" />
                        </Button>
                      )}
                    </div>
                  </div>
                </div>
              </div>
            </CardContent>
          </Card>
        ))}
      </div>
    </div>
  );
}

