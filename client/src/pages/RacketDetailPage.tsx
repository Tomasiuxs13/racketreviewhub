import { useRoute, Link } from "wouter";
import { useQuery } from "@tanstack/react-query";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { RatingMetrics } from "@/components/RatingBar";
import { ArrowLeft, ExternalLink, User } from "lucide-react";
import { cleanReviewContent, getRacketSlug } from "@/lib/utils";
import type { Racket, Author } from "@shared/schema";
import SEO from "@/components/SEO";
import { StructuredData } from "@/components/StructuredData";
import { Breadcrumbs } from "@/components/Breadcrumbs";
import { useMemo } from "react";
import { SITE_URL } from "@/lib/seo";

function isUuid(value: string | undefined): boolean {
  if (!value) return false;
  return /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(value);
}

export default function RacketDetailPage() {
  const [, params] = useRoute("/rackets/:id");
  const routeParam = params?.id;
  const treatAsId = isUuid(routeParam);

  // Legacy path: detail URLs that still use the raw ID
  const { data: racketById, isLoading: isLoadingById } = useQuery<Racket>({
    queryKey: [`/api/rackets/${routeParam}`],
    enabled: !!routeParam && treatAsId,
  });

  // New path: name-based URLs (slug derived from brand + model)
  const { data: allRackets, isLoading: isLoadingAll } = useQuery<Racket[]>({
    queryKey: ["/api/rackets"],
    enabled: !!routeParam && !treatAsId,
  });

  const racketFromSlug = allRackets?.find(
    (candidate) => getRacketSlug(candidate) === routeParam
  );

  const racket = treatAsId ? racketById : racketFromSlug;
  const isLoading = treatAsId ? isLoadingById : isLoadingAll;

  const { data: relatedRackets } = useQuery<Racket[]>({
    queryKey: [`/api/rackets/related/${racket?.id ?? "unknown"}`],
    enabled: !!racket?.id,
  });

  // Fetch authors to map authorIds
  const { data: authors } = useQuery<Author[]>({
    queryKey: ["/api/authors"],
    enabled: !!racket?.authorId,
  });

  const author = racket?.authorId
    ? authors?.find((a) => a.id === racket.authorId)
    : null;

  // SEO data - calculate even when racket is loading/undefined to keep hooks consistent
  const seoTitle = racket
    ? `${racket.brand} ${racket.model} ${racket.year || ""} Review - Expert Analysis & Best Price`
    : "Padel Racket Review";
  const seoDescription = racket
    ? `Expert review of the ${racket.brand} ${racket.model} ${racket.year || ""} padel racket. Detailed ratings for power, control, and performance. Overall rating: ${racket.overallRating}/100. Find the best price with our affiliate links.`
    : "Expert padel racket review with detailed ratings and best price comparison";
  const canonicalPath = racket ? `/rackets/${getRacketSlug(racket)}` : "/rackets";
  const seoData = {
    title: seoTitle,
    description: seoDescription,
    image: racket?.imageUrl,
    url: canonicalPath,
    canonical: canonicalPath,
    type: "article" as const,
  };

  // Structured data - must be called before conditional returns
  const structuredData = useMemo(() => {
    if (!racket) return [];

    const siteUrl = SITE_URL;
    const racketUrl = `${siteUrl}/rackets/${getRacketSlug(racket)}`;
    const schemas = [];

    // Product schema
    const productSchema: any = {
      "@context": "https://schema.org",
      "@type": "Product",
      "name": `${racket.brand} ${racket.model} ${racket.year || ""}`.trim(),
      "description": seoDescription,
      "image": racket.imageUrl ? [racket.imageUrl] : undefined,
      "brand": {
        "@type": "Brand",
        "name": racket.brand,
      },
      "aggregateRating": {
        "@type": "AggregateRating",
        "ratingValue": racket.overallRating,
        "bestRating": 100,
        "worstRating": 0,
        "ratingCount": 1,
      },
    };

    // Add offers (affiliate links)
    if (racket.affiliateLink || racket.titleUrl) {
      productSchema.offers = {
        "@type": "Offer",
        "price": racket.currentPrice,
        "priceCurrency": "EUR",
        "availability": "https://schema.org/InStock",
        "url": racket.affiliateLink || racket.titleUrl,
        "seller": {
          "@type": "Organization",
          "name": "External Retailer",
        },
      };
    }

    schemas.push(productSchema);

    // Review schema (separate from Product)
    if (racket.reviewContent) {
      schemas.push({
        "@context": "https://schema.org",
        "@type": "Review",
        "itemReviewed": {
          "@type": "Product",
          "name": `${racket.brand} ${racket.model} ${racket.year || ""}`.trim(),
          "brand": {
            "@type": "Brand",
            "name": racket.brand,
          },
        },
        "reviewRating": {
          "@type": "Rating",
          "ratingValue": racket.overallRating,
          "bestRating": 100,
          "worstRating": 0,
        },
        "author": author
          ? {
              "@type": "Person",
              "name": author.name,
              "url": `${SITE_URL}/authors/${author.slug}`,
            }
          : {
          "@type": "Organization",
          "name": "Padel Racket Reviews",
            },
        "reviewBody": cleanReviewContent(racket.reviewContent).replace(/<[^>]*>/g, "").substring(0, 500),
        "datePublished": racket.createdAt ? new Date(racket.createdAt).toISOString() : new Date().toISOString(),
      });
    }

    // BreadcrumbList schema
    schemas.push({
      "@context": "https://schema.org",
      "@type": "BreadcrumbList",
      "itemListElement": [
        {
          "@type": "ListItem",
          "position": 1,
          "name": "Home",
          "item": siteUrl,
        },
        {
          "@type": "ListItem",
          "position": 2,
          "name": "Rackets",
          "item": `${siteUrl}/rackets`,
        },
        {
          "@type": "ListItem",
          "position": 3,
          "name": `${racket.brand} ${racket.model}`,
          "item": racketUrl,
        },
      ],
    });

    return schemas;
  }, [racket, seoDescription, author]);

  const seoElement = <SEO {...seoData} />;

  if (isLoading) {
    return (
      <>
        {seoElement}
        <div className="min-h-screen bg-background">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 py-8 sm:py-10">
          <Skeleton className="h-10 w-32 mb-8" />
          <div className="grid lg:grid-cols-2 gap-8 lg:gap-12">
            <Skeleton className="aspect-square w-full" />
            <div className="space-y-6">
              <Skeleton className="h-12 w-3/4" />
              <Skeleton className="h-48 w-full" />
              <Skeleton className="h-16 w-full" />
            </div>
          </div>
        </div>
      </div>
      </>
    );
  }

  if (!racket) {
    return (
      <>
        {seoElement}
        <div className="min-h-screen bg-background flex items-center justify-center px-4">
        <Card>
          <CardContent className="p-12 text-center">
            <p className="text-muted-foreground mb-4">Racket not found</p>
            <Link href="/rackets">
              <Button>Back to Rackets</Button>
            </Link>
          </CardContent>
        </Card>
      </div>
      </>
    );
  }

  const discountPercentage = racket.originalPrice
    ? Math.round(((Number(racket.originalPrice) - Number(racket.currentPrice)) / Number(racket.originalPrice)) * 100)
    : 0;

  return (
    <>
      {seoElement}
      <StructuredData data={structuredData} />
      <div className="min-h-screen bg-background">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 py-8 sm:py-10">
          {/* Breadcrumbs */}
          <Breadcrumbs
            items={[
              { label: "Rackets", href: "/rackets" },
              { label: racket ? `${racket.brand} ${racket.model}` : "Racket" },
            ]}
          />

          {/* Back Button */}
          <Link href="/rackets" data-testid="link-back-to-rackets">
          <Button variant="ghost" className="mb-6 sm:mb-8 -ml-2 sm:-ml-3" data-testid="button-back">
            <ArrowLeft className="mr-2 h-4 w-4" />
            Back to Rackets
          </Button>
        </Link>

        {/* Main Content */}
        <div className="grid lg:grid-cols-5 gap-8 lg:gap-12 mb-16">
          {/* Main Content Area - Image and Review */}
          <div className="lg:col-span-3 space-y-8">
            {/* Image */}
            <Card>
              <CardContent className="p-6 sm:p-10">
                <div className="aspect-square flex items-center justify-center">
                  {racket.imageUrl ? (
                    <img
                      src={racket.imageUrl}
                      alt={`${racket.brand} ${racket.model}`}
                      className="max-w-full max-h-full object-contain"
                      loading="lazy"
                      decoding="async"
                      data-testid="img-racket-detail"
                    />
                  ) : (
                    <div className="w-full h-full flex items-center justify-center bg-muted rounded-md">
                      <span className="text-muted-foreground">No image available</span>
                    </div>
                  )}
                </div>
              </CardContent>
            </Card>

            {/* Review Article */}
            <Card>
              <CardContent className="p-5 sm:p-8 prose prose-sm sm:prose lg:prose-lg max-w-none">
                {racket.reviewContent ? (
                  <>
                    {author && (
                      <div className="flex items-center gap-2 text-sm text-muted-foreground mb-4 pb-4 border-b">
                        <User className="h-4 w-4" />
                        <span>Review by </span>
                        <Link
                          href={`/authors/${author.slug}`}
                          className="hover:text-primary hover:underline transition-colors font-medium"
                        >
                          {author.name}
                        </Link>
                      </div>
                    )}
                    <div 
                      dangerouslySetInnerHTML={{ 
                        __html: cleanReviewContent(racket.reviewContent)
                      }} 
                      data-testid="text-review-content" 
                    />
                  </>
                ) : (
                  <p className="text-muted-foreground">
                    Full review coming soon for the {racket.brand} {racket.model}.
                  </p>
                )}
              </CardContent>
            </Card>

            {/* Price & CTA */}
            <Card className="border-2 border-primary/20 bg-gradient-to-br from-primary/5 to-primary/10">
              <CardContent className="p-4 space-y-3">
                <div className="space-y-2">
                  {racket.originalPrice && Number(racket.originalPrice) > Number(racket.currentPrice) ? (
                    <>
                      <div className="flex items-center gap-2 flex-wrap">
                        <p className="text-xs text-muted-foreground">Previous price:</p>
                        <span className="text-lg text-muted-foreground line-through">
                          €{Number(racket.originalPrice).toFixed(2)}
                        </span>
                      </div>
                      <div className="flex flex-wrap items-baseline gap-2">
                        <p className="text-xs text-muted-foreground whitespace-nowrap">Current price:</p>
                        <span className="text-3xl sm:text-4xl font-bold text-primary" data-testid="text-price">
                          €{Number(racket.currentPrice).toFixed(2)}
                        </span>
                        <Badge variant="destructive" className="font-semibold whitespace-nowrap text-xs">
                          Save {discountPercentage}%
                        </Badge>
                      </div>
                    </>
                  ) : (
                    <>
                      <div className="flex items-baseline gap-2">
                        <span className="text-3xl sm:text-4xl font-bold text-primary" data-testid="text-price">
                          €{Number(racket.currentPrice).toFixed(2)}
                        </span>
                      </div>
                      <p className="text-xs text-muted-foreground">Current price</p>
                    </>
                  )}
                </div>

                    <div className="pt-2 border-t">
                  {racket.affiliateLink || racket.titleUrl ? (
                    <Button
                      asChild
                      size="default"
                      className="w-full font-semibold"
                      data-testid="button-buy-now"
                    >
                      <a href={racket.affiliateLink || racket.titleUrl || "#"} target="_blank" rel="noopener noreferrer">
                        Buy Now
                        <ExternalLink className="ml-2 h-4 w-4" />
                      </a>
                    </Button>
                  ) : (
                    <Button size="default" className="w-full" disabled>
                      Not Available
                    </Button>
                  )}

                  <p className="text-xs text-muted-foreground text-center mt-2 leading-relaxed">
                    As an Amazon Associate, we earn from qualifying purchases
                  </p>
                </div>
              </CardContent>
            </Card>
          </div>

          {/* Sidebar - Specs & Purchase */}
          <div className="lg:col-span-2 space-y-6">
            {/* Title & Brand */}
            <div>
              <div className="flex flex-wrap items-center gap-2 mb-2">
                <Badge data-testid="badge-brand">{racket.brand}</Badge>
                <Badge variant="secondary">{racket.year}</Badge>
                {racket.year >= new Date().getFullYear() && (
                  <Badge variant="outline">New</Badge>
                )}
              </div>
              <h1 className="font-heading font-bold text-3xl sm:text-4xl mb-2" data-testid="text-racket-title">
                {racket.model}
              </h1>
              <p className="text-muted-foreground capitalize mb-3">
                {racket.shape} shape
              </p>
              {/* Author */}
              <div className="flex items-center gap-2 text-sm text-muted-foreground">
                <User className="h-4 w-4" />
                {author ? (
                  <Link
                    href={`/authors/${author.slug}`}
                    className="hover:text-primary hover:underline transition-colors"
                    data-testid="link-author"
                  >
                    {author.name}
                  </Link>
                ) : (
                  <Link
                    href="/authors/carlos-rodriguez"
                    className="hover:text-primary hover:underline transition-colors"
                    data-testid="link-author-default"
                  >
                    Padel Racket Reviews
                  </Link>
                )}
              </div>
            </div>

            {/* Overall Rating */}
            <Card className="bg-primary/5 border-primary/20">
              <CardContent className="p-4 text-center">
                <p className="text-xs text-muted-foreground mb-1">Overall Rating</p>
                <div className="text-4xl font-bold text-primary" data-testid="text-overall-rating">
                  {racket.overallRating}
                </div>
                <p className="text-xs text-muted-foreground mt-0.5">out of 100</p>
              </CardContent>
            </Card>

            {/* Price & CTA */}
            <Card className="border-2 border-primary/20 bg-gradient-to-br from-primary/5 to-primary/10">
              <CardContent className="p-4 space-y-3">
                <div className="space-y-2">
                  {racket.originalPrice && Number(racket.originalPrice) > Number(racket.currentPrice) ? (
                    <>
                      <div className="flex items-center gap-2 flex-wrap">
                        <p className="text-xs text-muted-foreground">Previous price:</p>
                        <span className="text-lg text-muted-foreground line-through">
                          €{Number(racket.originalPrice).toFixed(2)}
                        </span>
                      </div>
                      <div className="flex flex-wrap items-baseline gap-2">
                        <p className="text-xs text-muted-foreground whitespace-nowrap">Current price:</p>
                        <span className="text-3xl sm:text-4xl font-bold text-primary" data-testid="text-price-sidebar">
                          €{Number(racket.currentPrice).toFixed(2)}
                        </span>
                        <Badge variant="destructive" className="font-semibold whitespace-nowrap text-xs">
                          Save {discountPercentage}%
                        </Badge>
                      </div>
                    </>
                  ) : (
                    <>
                      <div className="flex items-baseline gap-2">
                        <span className="text-3xl sm:text-4xl font-bold text-primary" data-testid="text-price-sidebar">
                          €{Number(racket.currentPrice).toFixed(2)}
                        </span>
                      </div>
                      <p className="text-xs text-muted-foreground">Current price</p>
                    </>
                  )}
                </div>

                <div className="pt-2 border-t">
                  {racket.affiliateLink || racket.titleUrl ? (
                    <Button
                      asChild
                      size="default"
                      className="w-full font-semibold"
                      data-testid="button-buy-now-sidebar"
                    >
                      <a href={racket.affiliateLink || racket.titleUrl || "#"} target="_blank" rel="noopener noreferrer">
                        Buy Now
                        <ExternalLink className="ml-2 h-4 w-4" />
                      </a>
                    </Button>
                  ) : (
                    <Button size="default" className="w-full" disabled>
                      Not Available
                    </Button>
                  )}

                  <p className="text-xs text-muted-foreground text-center mt-2 leading-relaxed">
                    As an Amazon Associate, we earn from qualifying purchases
                  </p>
                </div>
              </CardContent>
            </Card>

            {/* Performance Ratings */}
            <Card>
              <CardContent className="p-6">
                <h3 className="font-semibold mb-4">Performance Metrics</h3>
                <RatingMetrics
                  power={racket.powerRating}
                  control={racket.controlRating}
                  rebound={racket.reboundRating}
                  maneuverability={racket.maneuverabilityRating}
                  sweetSpot={racket.sweetSpotRating}
                />
              </CardContent>
            </Card>

            {/* Specifications */}
            <Card>
              <CardContent className="p-6">
                <h3 className="font-semibold mb-4">Specifications</h3>
                <dl className="grid grid-cols-1 sm:grid-cols-2 gap-x-6 gap-y-3">
                  <div>
                    <dt className="text-sm font-medium text-muted-foreground mb-1">Brand</dt>
                    <dd className="text-base" data-testid="spec-brand">{racket.brand || "-"}</dd>
                  </div>
                  <div>
                    <dt className="text-sm font-medium text-muted-foreground mb-1">Color</dt>
                    <dd className="text-base">{racket.color || "-"}</dd>
                  </div>
                  <div>
                    <dt className="text-sm font-medium text-muted-foreground mb-1">Balance</dt>
                    <dd className="text-base">{racket.balance || "-"}</dd>
                  </div>
                  <div>
                    <dt className="text-sm font-medium text-muted-foreground mb-1">Surface</dt>
                    <dd className="text-base">{racket.surface || "-"}</dd>
                  </div>
                  <div>
                    <dt className="text-sm font-medium text-muted-foreground mb-1">Hardness</dt>
                    <dd className="text-base">{racket.hardness || "-"}</dd>
                  </div>
                  <div>
                    <dt className="text-sm font-medium text-muted-foreground mb-1">Finish</dt>
                    <dd className="text-base">{racket.finish || "-"}</dd>
                  </div>
                  <div>
                    <dt className="text-sm font-medium text-muted-foreground mb-1">Players Collection</dt>
                    <dd className="text-base">{racket.playersCollection || "-"}</dd>
                  </div>
                  <div>
                    <dt className="text-sm font-medium text-muted-foreground mb-1">Product</dt>
                    <dd className="text-base">{racket.product || "-"}</dd>
                  </div>
                  <div>
                    <dt className="text-sm font-medium text-muted-foreground mb-1">Core</dt>
                    <dd className="text-base">{racket.core || "-"}</dd>
                  </div>
                  <div>
                    <dt className="text-sm font-medium text-muted-foreground mb-1">Format</dt>
                    <dd className="text-base">{racket.format || "-"}</dd>
                  </div>
                  <div>
                    <dt className="text-sm font-medium text-muted-foreground mb-1">Game Level</dt>
                    <dd className="text-base">{racket.gameLevel || "-"}</dd>
                  </div>
                  <div>
                    <dt className="text-sm font-medium text-muted-foreground mb-1">Shape</dt>
                    <dd className="text-base capitalize">{racket.shape || "-"}</dd>
                  </div>
                  <div>
                    <dt className="text-sm font-medium text-muted-foreground mb-1">Game Type</dt>
                    <dd className="text-base">{racket.gameType || "-"}</dd>
                  </div>
                  <div>
                    <dt className="text-sm font-medium text-muted-foreground mb-1">Player</dt>
                    <dd className="text-base capitalize">{racket.player || "-"}</dd>
                  </div>
                </dl>
              </CardContent>
            </Card>
          </div>
        </div>

        {/* Related Rackets */}
              {relatedRackets && relatedRackets.length > 0 && (
          <div>
            <h2 className="font-heading font-semibold text-3xl mb-6">Related Rackets</h2>
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6">
              {relatedRackets.slice(0, 4).map((relatedRacket) => (
                <Link
                  key={relatedRacket.id}
                  href={`/rackets/${getRacketSlug(relatedRacket)}`}
                  data-testid={`link-related-racket-${relatedRacket.id}`}
                >
                  <Card className="h-full hover-elevate active-elevate-2 transition-all cursor-pointer" data-testid={`card-related-racket-${relatedRacket.id}`}>
                    <CardContent className="p-4">
                      <div className="aspect-square mb-3 flex items-center justify-center">
                        {relatedRacket.imageUrl ? (
                          <img
                            src={relatedRacket.imageUrl}
                            alt={`${relatedRacket.brand} ${relatedRacket.model}`}
                            className="max-w-full max-h-full object-contain"
                            loading="lazy"
                          />
                        ) : (
                          <div className="w-full h-full bg-muted rounded-md" />
                        )}
                      </div>
                      <Badge className="mb-2">{relatedRacket.brand}</Badge>
                      <h3 className="font-semibold line-clamp-2 mb-2">
                        {relatedRacket.model}
                      </h3>
                      <p className="text-lg font-bold">
                        €{Number(relatedRacket.currentPrice).toFixed(2)}
                      </p>
                    </CardContent>
                  </Card>
                </Link>
              ))}
            </div>
          </div>
        )}
        </div>
      </div>
    </>
  );
}
