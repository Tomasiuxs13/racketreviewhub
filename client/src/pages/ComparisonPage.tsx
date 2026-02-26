import { Link, useLocation } from "wouter";
import { useQuery } from "@tanstack/react-query";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { useCompare } from "@/hooks/useCompare";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { ArrowLeft, ExternalLink, Scale } from "lucide-react";
import { RatingBar } from "@/components/RatingBar";
import type { Racket } from "@shared/schema";
import { getRacketSlug, getOptimizedImageUrl } from "@/lib/utils";
import SEO from "@/components/SEO";
import { Breadcrumbs } from "@/components/Breadcrumbs";
import { trackAffiliateClick } from "@/lib/analytics";

export default function ComparisonPage() {
  const [location] = useLocation();
  const { compareIds: storedIds } = useCompare();
  // Extract ids from the path, supporting both /compare/:ids and /:locale/compare/:ids
  const compareMatch = location.match(/\/compare\/([^/?#]+)/);
  const urlIds = compareMatch ? decodeURIComponent(compareMatch[1]).split(",") : [];

  // Use URL ids if present, otherwise fallback to stored ids
  const ids = urlIds.length > 0 ? urlIds : storedIds;

  const { data: allRackets, isLoading } = useQuery<Racket[]>({
    queryKey: ["/api/rackets"],
  });

  // Find rackets by slug from the comma-separated URL param
  const rackets = (allRackets || []).filter((r) => {
    const slug = getRacketSlug(r);
    return ids.includes(slug) || ids.includes(r.id);
  });

  const seoData = {
    title:
      rackets.length >= 2
        ? `${rackets[0].brand} ${rackets[0].model} vs ${rackets[1].brand} ${rackets[1].model} - Comparison`
        : "Racket Comparison",
    description: "Compare padel rackets side by side - ratings, specs, and prices.",
    url: "/compare",
  };

  if (isLoading) {
    return (
      <>
        <SEO {...seoData} />
        <div className="min-h-screen bg-background">
          <div className="max-w-7xl mx-auto px-4 sm:px-6 py-8">
            <Skeleton className="h-10 w-48 mb-8" />
            <div className="grid grid-cols-2 gap-6">
              <Skeleton className="h-96" />
              <Skeleton className="h-96" />
            </div>
          </div>
        </div>
      </>
    );
  }

  if (rackets.length === 0) {
    return (
      <>
        <SEO {...seoData} />
        <div className="min-h-screen bg-background">
          <div className="max-w-7xl mx-auto px-4 sm:px-6 py-8">
            <Breadcrumbs items={[{ label: "Rackets", href: "/rackets" }, { label: "Compare" }]} />
            <Card className="mt-8">
              <CardContent className="p-12 text-center">
                <h1 className="text-2xl font-bold mb-4">Compare Rackets</h1>
                <p className="text-muted-foreground mb-6">
                  Select two or more rackets to compare them side by side.
                </p>
                <Link href="/rackets">
                  <Button>Browse Rackets</Button>
                </Link>
              </CardContent>
            </Card>
          </div>
        </div>
      </>
    );
  }

  const ratingFields = [
    { key: "overallRating" as const, label: "Overall" },
    { key: "powerRating" as const, label: "Power" },
    { key: "controlRating" as const, label: "Control" },
    { key: "reboundRating" as const, label: "Rebound" },
    { key: "maneuverabilityRating" as const, label: "Maneuverability" },
    { key: "sweetSpotRating" as const, label: "Sweet Spot" },
  ];

  const specFields = [
    { key: "shape" as const, label: "Shape" },
    { key: "balance" as const, label: "Balance" },
    { key: "hardness" as const, label: "Hardness" },
    { key: "gameLevel" as const, label: "Game Level" },
    { key: "gameType" as const, label: "Game Type" },
    { key: "player" as const, label: "Player" },
    { key: "surface" as const, label: "Surface" },
    { key: "core" as const, label: "Core" },
  ];

  return (
    <>
      <SEO {...seoData} />
      <div className="min-h-screen bg-background">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 py-8">
          <Breadcrumbs items={[{ label: "Rackets", href: "/rackets" }, { label: "Compare" }]} />

          <Link href="/rackets">
            <Button variant="ghost" className="mb-6 -ml-2">
              <ArrowLeft className="mr-2 h-4 w-4" />
              Back to Rackets
            </Button>
          </Link>

          <h1 className="font-heading font-bold text-2xl sm:text-3xl mb-8">
            {rackets.length >= 2
              ? `${rackets[0].brand} ${rackets[0].model} vs ${rackets[1].brand} ${rackets[1].model}`
              : `Compare ${rackets[0].brand} ${rackets[0].model}`}
          </h1>

          {/* Header Row - Images & Basic Info */}
          <div className="grid gap-4" style={{ gridTemplateColumns: `repeat(${Math.max(2, rackets.length)}, 1fr)` }}>
            {rackets.map((racket) => (
              <Card key={racket.id}>
                <CardContent className="p-4 text-center">
                  <div className="aspect-square mb-3 flex items-center justify-center max-h-48">
                    {racket.imageUrl ? (
                      <img
                        src={getOptimizedImageUrl(racket.imageUrl, 400)}
                        srcSet={`${getOptimizedImageUrl(racket.imageUrl, 200)} 200w, ${getOptimizedImageUrl(racket.imageUrl, 400)} 400w`}
                        sizes="(max-width: 640px) 200px, 400px"
                        alt={`${racket.brand} ${racket.model}`}
                        className="max-w-full max-h-full object-contain"
                      />
                    ) : (
                      <div className="w-full h-full bg-muted rounded-md flex items-center justify-center">
                        <span className="text-muted-foreground text-sm">No image</span>
                      </div>
                    )}
                  </div>
                  <Badge className="mb-1">{racket.brand}</Badge>
                  <h2 className="font-semibold text-lg">
                    <Link href={`/rackets/${getRacketSlug(racket)}`} className="hover:text-primary transition-colors">
                      {racket.model}
                    </Link>
                  </h2>
                  <p className="text-sm text-muted-foreground capitalize">{racket.shape} shape - {racket.year}</p>
                  <p className="text-2xl font-bold text-primary mt-2">
                    €{Number(racket.currentPrice).toFixed(2)}
                  </p>
                  {(racket.affiliateLink || racket.titleUrl || racket.padelMarketAffiliateLink) && (
                    <Button asChild size="sm" className="mt-3 w-full">
                      <a
                        href={racket.affiliateLink || racket.titleUrl || racket.padelMarketAffiliateLink || "#"}
                        target="_blank"
                        rel="sponsored noopener noreferrer"
                        onClick={() =>
                          trackAffiliateClick({
                            racketId: racket.id,
                            brand: racket.brand,
                            model: racket.model,
                            partner: racket.affiliateLink || racket.titleUrl ? "padel_nuestro" : "padel_market",
                            source: "comparison",
                            price: Number(racket.currentPrice),
                            inStock: racket.inStock,
                          })
                        }
                      >
                        Buy Now <ExternalLink className="ml-1 h-3 w-3" />
                      </a>
                    </Button>
                  )}
                </CardContent>
              </Card>
            ))}
            {rackets.length === 1 && (
              <Card className="flex flex-col items-center justify-center p-6 text-center border-dashed min-h-[400px]">
                <div className="rounded-full bg-muted p-4 mb-4">
                  <Scale className="h-8 w-8 text-muted-foreground" />
                </div>
                <h3 className="font-bold mb-2">Add another racket</h3>
                <p className="text-sm text-muted-foreground mb-4">Select a second racket to compare side-by-side.</p>
                <Link href="/rackets">
                  <Button variant="outline">Browse Rackets</Button>
                </Link>
              </Card>
            )}
          </div>

          {/* Ratings Comparison */}
          <Card className="mt-6">
            <CardContent className="p-4 sm:p-6">
              <h3 className="font-semibold text-lg mb-4">Performance Ratings</h3>
              <div className="space-y-4">
                {ratingFields.map((field) => {
                  const values = rackets.map((r) => r[field.key]);
                  const maxVal = Math.max(...values);
                  return (
                    <div key={field.key}>
                      <p className="text-sm font-medium text-muted-foreground mb-1">{field.label}</p>
                      <div className="grid gap-2" style={{ gridTemplateColumns: `repeat(${Math.max(2, rackets.length)}, 1fr)` }}>
                        {rackets.map((racket, i) => {
                          const val = values[i];
                          const isBest = val === maxVal && values.filter((v) => v === maxVal).length === 1;
                          return (
                            <div key={racket.id} className="flex items-center gap-2">
                              <div className="flex-1">
                                <RatingBar label="" value={val} abbreviation="" showLabel={false} />
                              </div>
                              <span className={`text-sm font-semibold min-w-[2.5rem] text-right ${isBest ? "text-primary" : ""}`}>
                                {val}
                              </span>
                            </div>
                          );
                        })}
                        {rackets.length === 1 && (
                          <div className="flex items-center justify-center opacity-50">
                            <span className="text-sm text-muted-foreground">-</span>
                          </div>
                        )}
                      </div>
                    </div>
                  );
                })}
              </div>
            </CardContent>
          </Card>

          {/* Specs Comparison */}
          <Card className="mt-6">
            <CardContent className="p-4 sm:p-6">
              <h3 className="font-semibold text-lg mb-4">Specifications</h3>
              <div className="divide-y">
                {specFields.map((field) => (
                  <div key={field.key} className="grid py-3 items-center" style={{ gridTemplateColumns: `8rem repeat(${Math.max(2, rackets.length)}, 1fr)` }}>
                    <span className="text-sm font-medium text-muted-foreground">{field.label}</span>
                    {rackets.map((racket) => (
                      <span key={racket.id} className="text-sm capitalize">
                        {(racket as any)[field.key] || "-"}
                      </span>
                    ))}
                    {rackets.length === 1 && (
                      <span className="text-sm text-center text-muted-foreground">-</span>
                    )}
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>
        </div>
      </div>
    </>
  );
}
