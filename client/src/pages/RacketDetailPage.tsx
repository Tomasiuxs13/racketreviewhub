import { Link, useLocation } from "wouter";
import { useQuery } from "@tanstack/react-query";
import { useLocalizedQuery } from "@/hooks/useLocalizedQuery";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { RatingMetrics } from "@/components/RatingBar";
import { RatingRadar } from "@/components/RatingRadar";
import { ArrowLeft, ExternalLink, User } from "lucide-react";
import { cleanReviewContent, getRacketSlug } from "@/lib/utils";
import type { Racket, Author, Guide } from "@shared/schema";
import SEO from "@/components/SEO";
import { Breadcrumbs } from "@/components/Breadcrumbs";
import { useEffect } from "react";
import { SITE_URL } from "@/lib/seo";
import { useI18n } from "@/i18n/useI18n";
import { trackAffiliateClick } from "@/lib/analytics";
import { PriceHistoryChart } from "@/components/PriceHistoryChart";
import { ShareButtons } from "@/components/ShareButtons";
import { TableOfContents } from "@/components/TableOfContents";
import { upscaleProductserveUrl } from "@shared/utils";

function isUuid(value: string | undefined): boolean {
  if (!value) return false;
  return /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(value);
}

export default function RacketDetailPage() {
  const [location, setLocation] = useLocation();
  // Extract the racket id/slug from the path, supporting both /rackets/:id and /:locale/rackets/:id
  const racketIdMatch = location.match(/\/rackets\/([^/?#]+)/);
  const routeParam = racketIdMatch ? decodeURIComponent(racketIdMatch[1]) : undefined;
  const treatAsId = isUuid(routeParam);

  // Legacy path: detail URLs that still use the raw ID
  const { data: racketById, isLoading: isLoadingById } = useLocalizedQuery<Racket>({
    queryKey: [`/api/rackets/${routeParam}`],
    enabled: !!routeParam && treatAsId,
  });

  // New path: name-based URLs (slug derived from brand + model)
  // Uses dedicated slug endpoint to avoid fetching all rackets
  const { data: racketBySlug, isLoading: isLoadingBySlug } = useLocalizedQuery<Racket>({
    queryKey: [`/api/rackets/slug/${routeParam}`],
    enabled: !!routeParam && !treatAsId,
  });

  const racket = treatAsId ? racketById : racketBySlug;
  const isLoading = treatAsId ? isLoadingById : isLoadingBySlug;

  // Redirect UUID URLs to SEO-friendly slug URLs
  useEffect(() => {
    if (treatAsId && racket && !isLoading) {
      const seoSlug = getRacketSlug(racket);
      // Replace URL without adding to browser history (for SEO redirect)
      setLocation(`/rackets/${seoSlug}`, { replace: true });
    }
  }, [treatAsId, racket, isLoading, setLocation]);

  const { data: relatedRackets } = useLocalizedQuery<Racket[]>({
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

  // Fetch recent guides for internal linking
  const { data: recentGuides } = useLocalizedQuery<Guide[]>({
    queryKey: ["/api/guides/recent"],
    enabled: !!racket,
  });

  const { locale, t } = useI18n();

  // SEO data - calculate even when racket is loading/undefined to keep hooks consistent
  const seoTitle = racket
    ? t("racket.seo.title", {
      brand: racket.brand,
      model: racket.model,
      year: racket.year || "",
    }) || `${racket.brand} ${racket.model} ${racket.year || ""} Review - Expert Analysis & Best Price`
    : t("racket.seo.defaultTitle") || "Padel Racket Review";
  const seoDescription = racket
    ? t("racket.seo.description", {
      brand: racket.brand,
      model: racket.model,
      year: racket.year || "",
      rating: racket.overallRating,
    }) || `Expert review of the ${racket.brand} ${racket.model} ${racket.year || ""} padel racket. Detailed ratings for power, control, and performance. Overall rating: ${racket.overallRating}/100. Find the best price with our affiliate links.`
    : t("racket.seo.defaultDescription") || "Expert padel racket review with detailed ratings and best price comparison";
  const canonicalPath = racket ? `/rackets/${getRacketSlug(racket)}` : "/rackets";
  const seoData = {
    title: seoTitle,
    description: seoDescription,
    image: racket?.imageUrl || undefined,
    url: canonicalPath,
    canonical: canonicalPath,
    type: "article" as const,
  };

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

  const currentPriceValue = Number(racket.currentPrice);
  const hasCurrentPrice = Number.isFinite(currentPriceValue);
  const formattedCurrentPrice = hasCurrentPrice ? `€${currentPriceValue.toFixed(2)}` : null;
  const originalPriceValue = Number(racket.originalPrice);
  const hasOriginalPrice = Number.isFinite(originalPriceValue);
  const discountPercentage =
    hasOriginalPrice && hasCurrentPrice && originalPriceValue > currentPriceValue
      ? Math.round(((originalPriceValue - currentPriceValue) / originalPriceValue) * 100)
      : 0;
  const hasAffiliateLink = Boolean(racket.affiliateLink || racket.titleUrl);
  const showStickyCta = Boolean(formattedCurrentPrice);

  return (
    <>
      {seoElement}
      <div className="min-h-screen bg-background">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 pt-8 sm:pt-10 pb-28 lg:pb-12">
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
              {t("racket.detail.backToRackets")}
            </Button>
          </Link>

          {/* Main Content */}
          <div className="grid lg:grid-cols-5 gap-8 lg:gap-12 mb-16">
            {/* Main Content Area - Image and Review */}
            <div className="lg:col-span-3 space-y-8">
              {/* Image */}
              <Card className="border-border/40 premium-shadow overflow-hidden">
                <CardContent className="p-6 sm:p-10 bg-gradient-to-br from-muted/30 to-muted/5">
                  <div className="aspect-square flex items-center justify-center mix-blend-multiply dark:mix-blend-normal">
                    {racket.imageUrl ? (
                      <img
                        src={upscaleProductserveUrl(racket.imageUrl) ?? racket.imageUrl}
                        alt={`${racket.brand} ${racket.model} ${racket.year || ""} ${racket.shape || "padel"} padel racket`}
                        className="max-w-full max-h-full object-contain drop-shadow-2xl"
                        loading="eager"
                        fetchPriority="high"
                        decoding="async"
                        data-testid="img-racket-detail"
                      />
                    ) : (
                      <div className="w-full h-full flex items-center justify-center bg-muted/50 rounded-md">
                        <span className="text-muted-foreground font-medium">{t("racket.detail.noImage")}</span>
                      </div>
                    )}
                  </div>
                </CardContent>
              </Card>

              {/* Review Article */}
              <Card className="border-border/40 premium-shadow">
                <CardContent className="p-6 sm:p-10">
                  {racket.reviewContent ? (
                    <div className="prose prose-sm lg:prose max-w-none">
                      {author && (
                        <div className="flex items-center gap-3 text-sm text-muted-foreground mb-6 pb-6 border-b border-border/50 not-prose">
                          <div className="h-10 w-10 rounded-full bg-primary/10 flex items-center justify-center text-primary">
                            <User className="h-5 w-5" />
                          </div>
                          <div>
                            <span className="block text-xs uppercase tracking-wider font-semibold">{t("racket.detail.reviewBy")}</span>
                            <Link
                              href={`/authors/${author.slug}`}
                              className="text-foreground hover:text-primary transition-colors font-bold text-base"
                            >
                              {author.name}
                            </Link>
                          </div>
                        </div>
                      )}
                      <div
                        dangerouslySetInnerHTML={{
                          __html: cleanReviewContent(racket.reviewContent)
                        }}
                        data-testid="text-review-content"
                        className="prose-headings:font-heading prose-headings:font-bold prose-h2:text-2xl prose-h3:text-xl prose-p:leading-relaxed prose-a:text-primary hover:prose-a:text-primary/80"
                      />
                    </div>
                  ) : (
                    <div className="text-center py-10">
                      <p className="text-muted-foreground text-lg">
                        {t("racket.detail.reviewComingSoon")} <span className="font-semibold text-foreground">{racket.brand} {racket.model}</span>.
                      </p>
                    </div>
                  )}
                </CardContent>
              </Card>

              {/* Price & CTA (Mobile Only basically, or duplicate) */}
              <Card className="border-2 border-primary/30 bg-gradient-to-br from-primary/10 via-background to-background premium-shadow relative overflow-hidden lg:hidden">
                <div className="absolute top-0 right-0 w-32 h-32 bg-primary/20 blur-[50px] rounded-full pointer-events-none" />
                <CardContent className="p-6 space-y-5 relative z-10">
                  <div className="space-y-2">
                    {hasOriginalPrice && originalPriceValue > currentPriceValue ? (
                      <>
                        <div className="flex items-center gap-2 flex-wrap">
                          <p className="text-sm font-medium text-muted-foreground">{t("racket.detail.previousPrice")}</p>
                          {hasOriginalPrice && (
                            <span className="text-lg text-muted-foreground line-through decoration-destructive/50">
                              €{originalPriceValue.toFixed(2)}
                            </span>
                          )}
                        </div>
                        <div className="flex flex-wrap items-baseline gap-3">
                          <p className="text-sm font-medium text-muted-foreground whitespace-nowrap">{t("racket.detail.currentPrice")}</p>
                          <span className="text-4xl sm:text-5xl font-heading font-extrabold text-gradient" data-testid="text-price">
                            {formattedCurrentPrice}
                          </span>
                          <Badge variant="destructive" className="font-bold whitespace-nowrap text-sm px-2.5 py-1">
                            {t("racket.detail.save", { percent: String(discountPercentage) })}
                          </Badge>
                        </div>
                      </>
                    ) : (
                      <>
                        {formattedCurrentPrice && (
                          <div className="flex items-baseline gap-2">
                            <span className="text-4xl sm:text-5xl font-heading font-extrabold text-gradient" data-testid="text-price">
                              {formattedCurrentPrice}
                            </span>
                          </div>
                        )}
                        <p className="text-sm font-medium text-muted-foreground">{t("racket.detail.currentPriceShort")}</p>
                      </>
                    )}
                  </div>

                  <div className="pt-4 border-t border-border/50 space-y-3">
                    {/* Padel Nuestro link (primary) */}
                    {(racket.affiliateLink || racket.titleUrl) ? (
                      <Button
                        asChild
                        size="lg"
                        variant={racket.inStock ? "default" : "outline"}
                        className={`w-full py-6 text-lg ${racket.inStock ? "font-bold shadow-lg shadow-primary/20 hover:shadow-primary/40 hover:-translate-y-0.5 transition-all" : ""}`}
                        data-testid="button-buy-now-pn"
                      >
                        <a href={racket.affiliateLink || racket.titleUrl || "#"} target="_blank" rel="sponsored noopener noreferrer" onClick={() => trackAffiliateClick({ racketId: racket.id, brand: racket.brand, model: racket.model, partner: "padel_nuestro", source: "racket_detail", price: Number(racket.currentPrice), inStock: racket.inStock })}>
                          {t("racket.detail.buyFromPN")} {!racket.inStock && t("racket.detail.checkAvailability")}
                          <ExternalLink className="ml-2 h-5 w-5" />
                        </a>
                      </Button>
                    ) : null}

                    {/* Padel Market link (alternative or primary if PN is out of stock) */}
                    {racket.padelMarketAffiliateLink ? (
                      <Button
                        asChild
                        size="lg"
                        variant={(racket.affiliateLink || racket.titleUrl) && racket.inStock ? "outline" : racket.padelMarketInStock ? "default" : "outline"}
                        className={`w-full py-6 text-lg ${!(racket.affiliateLink || racket.titleUrl) || !racket.inStock ? "font-bold shadow-lg shadow-primary/20 hover:shadow-primary/40 hover:-translate-y-0.5 transition-all" : ""}`}
                        data-testid="button-buy-now-pm"
                      >
                        <a href={racket.padelMarketAffiliateLink} target="_blank" rel="sponsored noopener noreferrer" onClick={() => trackAffiliateClick({ racketId: racket.id, brand: racket.brand, model: racket.model, partner: "padel_market", source: "racket_detail", price: Number(racket.currentPrice), inStock: racket.padelMarketInStock })}>
                          {t("racket.detail.buyFromPM")} {!racket.padelMarketInStock && t("racket.detail.checkAvailability")}
                          <ExternalLink className="ml-2 h-5 w-5" />
                        </a>
                      </Button>
                    ) : null}

                    {/* Show "Not Available" only if neither link exists */}
                    {!(racket.affiliateLink || racket.titleUrl) &&
                      !racket.padelMarketAffiliateLink ? (
                      <Button size="lg" className="w-full py-6 text-lg" disabled>
                        {t("racket.detail.notAvailable")}
                      </Button>
                    ) : null}

                    <p className="text-xs text-muted-foreground/80 text-center mt-3 font-medium">
                      {t("racket.detail.affiliateDisclaimer")}
                    </p>
                  </div>
                </CardContent>
              </Card>
            </div>

            {/* Sidebar - Specs & Purchase */}
            <div className="lg:col-span-2 space-y-6">
              {/* Title & Brand */}
              <div className="bg-card p-6 rounded-2xl border border-border/40 premium-shadow">
                <div className="flex flex-wrap items-center gap-2.5 mb-3">
                  <Link href={`/brands/${racket.brand.toLowerCase().replace(/[^a-z0-9]+/g, "-")}`}>
                    <Badge className="cursor-pointer hover:bg-primary/80 uppercase tracking-widest text-[10px] px-2" data-testid="badge-brand">{racket.brand}</Badge>
                  </Link>
                  <Badge variant="secondary" className="uppercase tracking-widest text-[10px] px-2">{racket.year}</Badge>
                  {racket.year >= new Date().getFullYear() && (
                    <Badge variant="outline" className="border-emerald-500 text-emerald-600 dark:text-emerald-400 uppercase tracking-widest text-[10px] px-2">New</Badge>
                  )}
                </div>
                <h1 className="font-heading font-extrabold text-4xl sm:text-5xl tracking-tight leading-tight mb-2 text-foreground" data-testid="text-racket-title">
                  {racket.model}
                </h1>
                <p className="text-muted-foreground font-medium capitalize mb-5 text-lg">
                  {t("racket.detail.shape", { shape: racket.shape || "" })}
                </p>
                {/* Author */}
                <div className="flex items-center gap-2 text-sm text-muted-foreground font-medium bg-muted/40 p-3 rounded-lg w-fit mb-5">
                  <User className="h-4 w-4 text-primary" />
                  {author ? (
                    <Link
                      href={`/authors/${author.slug}`}
                      className="hover:text-primary transition-colors text-foreground"
                      data-testid="link-author"
                    >
                      {author.name}
                    </Link>
                  ) : (
                    <Link
                      href="/authors/carlos-rodriguez"
                      className="hover:text-primary transition-colors text-foreground"
                      data-testid="link-author-default"
                    >
                      Padel Racket Reviews
                    </Link>
                  )}
                </div>
                {/* Share Buttons */}
                <ShareButtons
                  title={`${racket.brand} ${racket.model} Review`}
                  url={`/rackets/${getRacketSlug(racket)}`}
                />
              </div>

              {/* Overall Rating */}
              <Card className="border-primary/20 bg-gradient-to-br from-primary/10 via-background to-background premium-shadow">
                <CardContent className="p-6 text-center">
                  <p className="text-xs font-bold tracking-[0.2em] uppercase text-primary/80 mb-2">{t("racket.detail.overallScore")}</p>
                  <div className="text-6xl sm:text-7xl font-heading font-extrabold text-gradient drop-shadow-sm mb-1" data-testid="text-overall-rating">
                    {racket.overallRating}
                  </div>
                  <p className="text-sm font-medium text-muted-foreground">{t("racket.detail.outOf100")}</p>
                </CardContent>
              </Card>

              {/* Price & CTA SIDEBAR */}
              <Card className="border-2 border-primary/30 bg-gradient-to-br from-primary/10 via-background to-background premium-shadow relative overflow-hidden hidden lg:block">
                <div className="absolute top-0 right-0 w-32 h-32 bg-primary/20 blur-[50px] rounded-full pointer-events-none" />
                <CardContent className="p-6 space-y-5 relative z-10">
                  <div className="space-y-2">
                    {hasOriginalPrice && originalPriceValue > currentPriceValue ? (
                      <>
                        <div className="flex items-center gap-2 flex-wrap">
                          <p className="text-sm font-medium text-muted-foreground">{t("racket.detail.previousPrice")}</p>
                          {hasOriginalPrice && (
                            <span className="text-lg text-muted-foreground line-through decoration-destructive/50">
                              €{originalPriceValue.toFixed(2)}
                            </span>
                          )}
                        </div>
                        <div className="flex flex-wrap items-baseline gap-3">
                          <p className="text-sm font-medium text-muted-foreground whitespace-nowrap">{t("racket.detail.currentPrice")}</p>
                          <span className="text-4xl xl:text-5xl font-heading font-extrabold text-gradient" data-testid="text-price-sidebar">
                            {formattedCurrentPrice}
                          </span>
                          <Badge variant="destructive" className="font-bold whitespace-nowrap text-sm px-2.5 py-1">
                            {t("racket.detail.save", { percent: String(discountPercentage) })}
                          </Badge>
                        </div>
                      </>
                    ) : (
                      <>
                        {formattedCurrentPrice && (
                          <div className="flex items-baseline gap-2">
                            <span className="text-4xl xl:text-5xl font-heading font-extrabold text-gradient" data-testid="text-price-sidebar">
                              {formattedCurrentPrice}
                            </span>
                          </div>
                        )}
                        <p className="text-sm font-medium text-muted-foreground">{t("racket.detail.currentPriceShort")}</p>
                      </>
                    )}
                  </div>

                  <div className="pt-4 border-t border-border/50 space-y-3">
                    {/* Padel Nuestro link (primary) */}
                    {(racket.affiliateLink || racket.titleUrl) ? (
                      <Button
                        asChild
                        size="lg"
                        variant={racket.inStock ? "default" : "outline"}
                        className={`w-full py-6 text-lg ${racket.inStock ? "font-bold shadow-lg shadow-primary/20 hover:shadow-primary/40 hover:-translate-y-0.5 transition-all" : ""}`}
                        data-testid="button-buy-now-sidebar"
                      >
                        <a href={racket.affiliateLink || racket.titleUrl || "#"} target="_blank" rel="sponsored noopener noreferrer" onClick={() => trackAffiliateClick({ racketId: racket.id, brand: racket.brand, model: racket.model, partner: "padel_nuestro", source: "racket_detail_sidebar", price: Number(racket.currentPrice), inStock: racket.inStock })}>
                          {t("racket.detail.buyFromPN")} {!racket.inStock && t("racket.detail.checkAvailability")}
                          <ExternalLink className="ml-2 h-5 w-5" />
                        </a>
                      </Button>
                    ) : null}

                    {/* Padel Market link (alternative or primary if PN is out of stock) */}
                    {racket.padelMarketAffiliateLink ? (
                      <Button
                        asChild
                        size="lg"
                        variant={(racket.affiliateLink || racket.titleUrl) && racket.inStock ? "outline" : racket.padelMarketInStock ? "default" : "outline"}
                        className={`w-full py-6 text-lg ${!(racket.affiliateLink || racket.titleUrl) || !racket.inStock ? "font-bold shadow-lg shadow-primary/20 hover:shadow-primary/40 hover:-translate-y-0.5 transition-all" : ""}`}
                        data-testid="button-buy-now-sidebar-pm"
                      >
                        <a href={racket.padelMarketAffiliateLink} target="_blank" rel="sponsored noopener noreferrer" onClick={() => trackAffiliateClick({ racketId: racket.id, brand: racket.brand, model: racket.model, partner: "padel_market", source: "racket_detail_sidebar", price: Number(racket.currentPrice), inStock: racket.padelMarketInStock })}>
                          {t("racket.detail.buyFromPM")} {!racket.padelMarketInStock && t("racket.detail.checkAvailability")}
                          <ExternalLink className="ml-2 h-5 w-5" />
                        </a>
                      </Button>
                    ) : null}

                    {/* Show "Not Available" only if neither link exists */}
                    {!(racket.affiliateLink || racket.titleUrl) &&
                      !racket.padelMarketAffiliateLink ? (
                      <Button size="lg" className="w-full py-6 text-lg" disabled>
                        Not Available
                      </Button>
                    ) : null}

                    <p className="text-xs text-muted-foreground/80 text-center mt-3 font-medium">
                      We earn a commission from purchases made through affiliate links at no extra cost to you.
                    </p>
                  </div>
                </CardContent>
              </Card>

              {/* Performance Ratings */}
              <Card>
                <CardContent className="p-6">
                  <h3 className="font-semibold mb-4">{t("racket.detail.performanceMetrics")}</h3>
                  <RatingRadar
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
                  <h3 className="font-semibold mb-4">{t("racket.detail.specifications")}</h3>
                  <dl className="grid grid-cols-1 rounded-lg border overflow-hidden">
                    <div className="flex items-center justify-between p-3 bg-muted/30 border-b last:border-0">
                      <dt className="text-sm font-medium text-muted-foreground w-1/3">{t("racket.detail.specs.brand")}</dt>
                      <dd className="text-sm font-semibold w-2/3 text-right" data-testid="spec-brand">{racket.brand || "-"}</dd>
                    </div>
                    <div className="flex items-center justify-between p-3 border-b last:border-0">
                      <dt className="text-sm font-medium text-muted-foreground w-1/3">{t("racket.detail.specs.color")}</dt>
                      <dd className="text-sm font-semibold w-2/3 text-right">{racket.color || "-"}</dd>
                    </div>
                    <div className="flex items-center justify-between p-3 bg-muted/30 border-b last:border-0">
                      <dt className="text-sm font-medium text-muted-foreground w-1/3">{t("racket.detail.specs.balance")}</dt>
                      <dd className="text-sm font-semibold w-2/3 text-right">{racket.balance || "-"}</dd>
                    </div>
                    <div className="flex items-center justify-between p-3 border-b last:border-0">
                      <dt className="text-sm font-medium text-muted-foreground w-1/3">{t("racket.detail.specs.surface")}</dt>
                      <dd className="text-sm font-semibold w-2/3 text-right">{racket.surface || "-"}</dd>
                    </div>
                    <div className="flex items-center justify-between p-3 bg-muted/30 border-b last:border-0">
                      <dt className="text-sm font-medium text-muted-foreground w-1/3">{t("racket.detail.specs.hardness")}</dt>
                      <dd className="text-sm font-semibold w-2/3 text-right">{racket.hardness || "-"}</dd>
                    </div>
                    <div className="flex items-center justify-between p-3 border-b last:border-0">
                      <dt className="text-sm font-medium text-muted-foreground w-1/3">{t("racket.detail.specs.finish")}</dt>
                      <dd className="text-sm font-semibold w-2/3 text-right">{racket.finish || "-"}</dd>
                    </div>
                    <div className="flex items-center justify-between p-3 bg-muted/30 border-b last:border-0">
                      <dt className="text-sm font-medium text-muted-foreground w-1/3">{t("racket.detail.specs.collection")}</dt>
                      <dd className="text-sm font-semibold w-2/3 text-right">{racket.playersCollection || "-"}</dd>
                    </div>
                    <div className="flex items-center justify-between p-3 border-b last:border-0">
                      <dt className="text-sm font-medium text-muted-foreground w-1/3">{t("racket.detail.specs.core")}</dt>
                      <dd className="text-sm font-semibold w-2/3 text-right">{racket.core || "-"}</dd>
                    </div>
                    <div className="flex items-center justify-between p-3 bg-muted/30 border-b last:border-0">
                      <dt className="text-sm font-medium text-muted-foreground w-1/3">{t("racket.detail.specs.gameLevel")}</dt>
                      <dd className="text-sm font-semibold w-2/3 text-right">{racket.gameLevel || "-"}</dd>
                    </div>
                    <div className="flex items-center justify-between p-3 border-b last:border-0">
                      <dt className="text-sm font-medium text-muted-foreground w-1/3">{t("racket.detail.specs.shape")}</dt>
                      <dd className="text-sm font-semibold w-2/3 text-right capitalize">{racket.shape || "-"}</dd>
                    </div>
                    <div className="flex items-center justify-between p-3 bg-muted/30 border-b last:border-0">
                      <dt className="text-sm font-medium text-muted-foreground w-1/3">{t("racket.detail.specs.gameType")}</dt>
                      <dd className="text-sm font-semibold w-2/3 text-right">{racket.gameType || "-"}</dd>
                    </div>
                    <div className="flex items-center justify-between p-3 border-b last:border-0">
                      <dt className="text-sm font-medium text-muted-foreground w-1/3">{t("racket.detail.specs.player")}</dt>
                      <dd className="text-sm font-semibold w-2/3 text-right capitalize">{racket.player || "-"}</dd>
                    </div>
                  </dl>
                </CardContent>
              </Card>

              {/* Table of Contents - sticky below Specifications */}
              {racket.reviewContent && (
                <div className="sticky top-24">
                  <TableOfContents contentHtml={racket.reviewContent} />
                </div>
              )}

              {/* Price History Chart */}
              <PriceHistoryChart racketId={racket.id} currentPrice={racket.currentPrice} />
            </div>
          </div>

          {/* Related Guides */}
          {recentGuides && recentGuides.length > 0 && (
            <div className="mb-12">
              <h2 className="font-heading font-semibold text-2xl mb-4">{t("racket.detail.helpfulGuides")}</h2>
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
                {recentGuides.slice(0, 3).map((guide) => (
                  <Link key={guide.id} href={`/guides/${guide.slug}`}>
                    <Card className="h-full hover-elevate active-elevate-2 transition-all cursor-pointer">
                      <CardContent className="p-4">
                        <Badge variant="secondary" className="mb-2 text-xs">{guide.category}</Badge>
                        <h3 className="font-semibold line-clamp-2 mb-1">{guide.title}</h3>
                        <p className="text-sm text-muted-foreground line-clamp-2">{guide.excerpt}</p>
                      </CardContent>
                    </Card>
                  </Link>
                ))}
              </div>
            </div>
          )}

          {/* Related Rackets */}
          {relatedRackets && relatedRackets.length > 0 && (
            <div>
              <h2 className="font-heading font-semibold text-3xl mb-6">{t("racket.detail.relatedRackets")}</h2>
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
                        <Badge className="mb-2 w-fit">{relatedRacket.brand}</Badge>
                        <h3 className="font-semibold line-clamp-2 mb-2 group-hover:text-primary transition-colors">
                          <span className="sr-only">Read review for</span>
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
        {showStickyCta && (
          <div
            className="lg:hidden fixed bottom-0 left-0 right-0 border-t bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/80 shadow-lg z-40 px-4"
            style={{ paddingTop: "0.75rem", paddingBottom: "calc(env(safe-area-inset-bottom, 0px) + 0.75rem)" }}
          >
            <div className="max-w-7xl mx-auto flex items-center gap-4">
              <div className="flex flex-col">
                <span className="text-xs uppercase tracking-wide text-muted-foreground">{t("racket.detail.currentPriceShort")}</span>
                <span className="text-2xl font-bold leading-tight text-primary">
                  {formattedCurrentPrice}
                </span>
                {discountPercentage > 0 && (
                  <span className="text-xs font-semibold text-destructive">{t("racket.detail.save", { percent: String(discountPercentage) })}</span>
                )}
              </div>
              {(racket.affiliateLink || racket.titleUrl) ? (
                <Button asChild size="lg" className="flex-1 min-h-[48px]" data-testid="button-sticky-buy">
                  <a href={racket.affiliateLink || racket.titleUrl || "#"} target="_blank" rel="sponsored noopener noreferrer" onClick={() => trackAffiliateClick({ racketId: racket.id, brand: racket.brand, model: racket.model, partner: "padel_nuestro", source: "racket_detail_sticky", price: Number(racket.currentPrice), inStock: racket.inStock })}>
                    {t("racket.detail.buyFromPN")} {!racket.inStock && t("racket.detail.checkShort")}
                    <ExternalLink className="ml-2 h-4 w-4" />
                  </a>
                </Button>
              ) : racket.padelMarketAffiliateLink ? (
                <Button asChild size="lg" className="flex-1 min-h-[48px]" data-testid="button-sticky-buy-pm">
                  <a href={racket.padelMarketAffiliateLink} target="_blank" rel="sponsored noopener noreferrer" onClick={() => trackAffiliateClick({ racketId: racket.id, brand: racket.brand, model: racket.model, partner: "padel_market", source: "racket_detail_sticky", price: Number(racket.currentPrice), inStock: racket.padelMarketInStock })}>
                    {t("racket.detail.buyFromPM")} {!racket.padelMarketInStock && t("racket.detail.checkShort")}
                    <ExternalLink className="ml-2 h-4 w-4" />
                  </a>
                </Button>
              ) : (
                <Button size="lg" className="flex-1 min-h-[48px]" disabled>
                  {t("racket.detail.notAvailable")}
                </Button>
              )}
            </div>
          </div>
        )}
      </div>
    </>
  );
}
