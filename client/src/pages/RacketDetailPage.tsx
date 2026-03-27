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
import { ArrowLeft, ExternalLink, User, Scale, ChevronDown } from "lucide-react";
import { cleanReviewContent, getRacketSlug, extractProsConsFromHtml, extractFaqFromHtml, generateWhoShouldBuy } from "@/lib/utils";
import type { Racket, Author, Guide } from "@shared/schema";
import SEO from "@/components/SEO";
import { Breadcrumbs } from "@/components/Breadcrumbs";
import { useEffect, useState } from "react";
import { useI18n } from "@/i18n/useI18n";
import { trackAffiliateClick } from "@/lib/analytics";
import { PriceHistoryChart } from "@/components/PriceHistoryChart";
import { ShareButtons } from "@/components/ShareButtons";
import { TableOfContents } from "@/components/TableOfContents";
import { upscaleProductserveUrl } from "@shared/utils";
import { useCompare } from "@/hooks/useCompare";
import { getOptimizedImageUrl } from "@/lib/utils";

function isUuid(value: string | undefined): boolean {
  if (!value) return false;
  return /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(value);
}

export default function RacketDetailPage() {
  const [location, setLocation] = useLocation();
  const [expandedFaqIndex, setExpandedFaqIndex] = useState<number | null>(null);
  const { addToCompare, isInCompare, removeFromCompare, compareIds } = useCompare();

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

  // Structured data is handled server-side by seoInjector.ts to avoid
  // duplicate schemas in the DOM. The server injects comprehensive Product,
  // Review, and Offer schemas with correct rating scales.

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

  // Extract pros/cons and FAQ from review content
  const { pros, cons } = extractProsConsFromHtml(racket.reviewContent || "");
  const faqItems = extractFaqFromHtml(racket.reviewContent || "");
  const whoShouldBuy = generateWhoShouldBuy(racket);

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

          {/* Back Button and Compare Button */}
          <div className="flex items-center justify-between mb-6 sm:mb-8">
            <Link href="/rackets" data-testid="link-back-to-rackets">
              <Button variant="ghost" className="-ml-2 sm:-ml-3" data-testid="button-back">
                <ArrowLeft className="mr-2 h-4 w-4" />
                {t("racket.detail.backToRackets")}
              </Button>
            </Link>
            {racket && (
              <div className="flex items-center gap-3">
                {(() => {
                  const slug = getRacketSlug(racket);
                  return isInCompare(slug) ? (
                    <Button
                      variant="outline"
                      className="border-primary/20 bg-primary/10 text-primary"
                      onClick={() => removeFromCompare(slug)}
                    >
                      <Scale className="mr-2 h-4 w-4" />
                      Remove from Compare
                    </Button>
                  ) : (
                    <Button
                      variant="outline"
                      className="border-primary/20 hover:bg-primary/5 text-primary"
                      onClick={() => {
                        addToCompare(slug);
                        const newIds = compareIds.includes(slug) ? compareIds : [...compareIds, slug];
                        const localePrefix = location.match(/^\/[a-z]{2}(?=\/|$)/)?.[0] || "";
                        setLocation(`${localePrefix}/compare/${newIds.join(",")}`);
                      }}
                    >
                      <Scale className="mr-2 h-4 w-4" />
                      {t("racket.detail.compareButton")}
                    </Button>
                  );
                })()}
              </div>
            )}
          </div>

          {/* HERO SECTION */}
          <div className="review-hero-section mb-16">
            {/* Left: Content */}
            <div className="review-hero-content">
              {/* Title, Badges, Score, Quote, Author */}
              <div className="flex flex-col justify-start space-y-6 lg:space-y-8">
                {/* Badges */}
                <div className="flex flex-wrap items-center gap-2">
                  <Link href={`/brands/${racket.brand.toLowerCase().replace(/[^a-z0-9]+/g, "-")}`}>
                    <Badge className="cursor-pointer hover:bg-primary/80 uppercase tracking-widest text-[10px] px-3" data-testid="badge-brand">
                      {racket.brand}
                    </Badge>
                  </Link>
                  <Badge variant="secondary" className="uppercase tracking-widest text-[10px] px-3">
                    {racket.year}
                  </Badge>
                  {racket.year >= new Date().getFullYear() && (
                    <Badge variant="outline" className="border-emerald-500 text-emerald-600 dark:text-emerald-400 uppercase tracking-widest text-[10px] px-3">
                      New
                    </Badge>
                  )}
                </div>

                {/* Title */}
                <div>
                  <h1 className="review-title text-4xl sm:text-5xl lg:text-6xl font-heading font-extrabold leading-tight mb-2" data-testid="text-racket-title">
                    {racket.model}
                  </h1>
                  <p className="text-muted-foreground font-medium text-lg capitalize">
                    {t("racket.detail.shape", { shape: racket.shape || "" })}
                  </p>
                </div>

                {/* Score Badge + Quote (Horizontal Layout) */}
                <div className="flex items-start gap-4">
                  {/* Score Badge - Green with white text */}
                  <div className="bg-primary text-white px-4 py-2 rounded-xl flex flex-col items-center flex-shrink-0">
                    <span className="text-3xl font-black">{racket.overallRating}</span>
                    <span className="text-[10px] font-bold tracking-widest uppercase">Score</span>
                  </div>

                  {/* Editorial Quote - next to score */}
                  {racket.reviewContent && (
                    <div className="review-quote font-medium max-w-xs text-muted-foreground">
                      "A standout choice for players seeking a balance of power and control with exceptional build quality."
                    </div>
                  )}
                </div>

                {/* Pricing Card */}
                <div className="bg-surface-container-lowest p-6 rounded-xl shadow-sm border border-outline-variant/10">
                  <div className="flex flex-col gap-4">
                    <div className="flex items-center justify-between">
                      <span className="text-sm font-label font-bold tracking-widest text-secondary uppercase">Starting at</span>
                      <span className="text-2xl font-black text-foreground">€249.00</span>
                    </div>
                    <Button className="w-full bg-gradient-to-br from-primary to-primary-container text-white font-bold rounded-xl shadow-lg hover:shadow-primary-container/20 transition-all active:scale-95 py-4 h-auto">
                      BUY NOW AT PADEL NUESTRO
                    </Button>
                    <div className="pt-4 border-t border-surface-variant flex flex-col gap-3">
                      <div className="flex justify-between items-center">
                        <span className="text-sm font-medium">Padel Market</span>
                        <span className="text-sm font-bold">€254.50</span>
                      </div>
                      <div className="flex justify-between items-center">
                        <span className="text-sm font-medium">Tennis-Point</span>
                        <span className="text-sm font-bold">€259.00</span>
                      </div>
                    </div>
                  </div>
                </div>

                {/* Author Info */}
                {author && (
                  <div className="flex items-center gap-3 text-sm">
                    <div className="h-12 w-12 rounded-full bg-primary/10 flex items-center justify-center text-primary flex-shrink-0">
                      {author.avatarUrl ? (
                        <img src={author.avatarUrl} alt={author.name} className="w-full h-full rounded-full object-cover" />
                      ) : (
                        <User className="h-5 w-5" />
                      )}
                    </div>
                    <div>
                      <span className="block text-xs uppercase tracking-wider font-semibold text-muted-foreground">
                        {t("racket.detail.reviewBy")}
                      </span>
                      <Link href={`/authors/${author.slug}`} className="text-foreground hover:text-primary transition-colors font-bold">
                        {author.name}
                      </Link>
                    </div>
                  </div>
                )}
              </div>
            </div>

            {/* Right: Product Image with Glow */}
            <div className="review-hero-image">
              {racket.imageUrl ? (
                <div className="relative flex items-center justify-center aspect-square">
                  {/* Glow effect */}
                  <div className="absolute inset-0 rounded-2xl bg-gradient-to-br from-primary/20 via-transparent to-transparent blur-3xl" />
                  {/* Image */}
                  <div className="relative z-10">
                    <img
                      src={getOptimizedImageUrl(upscaleProductserveUrl(racket.imageUrl), 800)}
                      srcSet={`${getOptimizedImageUrl(upscaleProductserveUrl(racket.imageUrl), 400)} 400w, ${getOptimizedImageUrl(upscaleProductserveUrl(racket.imageUrl), 800)} 800w`}
                      sizes="(max-width: 768px) 100vw, 800px"
                      alt={`${racket.brand} ${racket.model}`}
                      className="max-w-[85%] max-h-[85%] object-contain drop-shadow-2xl hover:scale-105 transition-transform duration-500"
                      fetchPriority="high"
                      data-testid="img-racket-detail"
                    />
                  </div>
                </div>
              ) : (
                <div className="aspect-square flex items-center justify-center bg-muted/30 rounded-2xl">
                  <span className="text-muted-foreground font-medium">{t("racket.detail.noImage")}</span>
                </div>
              )}
            </div>
          </div>

          {/* BENTO GRID: Performance Radar + Specs */}
          <div className="review-bento-grid mb-16">
            {/* Left: Performance Radar */}
            <div className="review-radar-box">
              <Card className="border-border/40 h-full">
                <CardContent className="p-6 sm:p-8">
                  <h2 className="font-heading font-bold text-xl sm:text-2xl mb-6">
                    {t("racket.detail.performanceMetrics")}
                  </h2>
                  <RatingRadar
                    power={racket.powerRating}
                    control={racket.controlRating}
                    rebound={racket.reboundRating}
                    maneuverability={racket.maneuverabilityRating}
                    sweetSpot={racket.sweetSpotRating}
                  />
                </CardContent>
              </Card>
            </div>

            {/* Right: Technical Specs */}
            <div className="review-specs-box">
              <div className="review-specs-box-dark rounded-2xl p-6 sm:p-8 h-full">
                <h2 className="font-heading font-bold text-xl sm:text-2xl text-white mb-6">
                  {t("racket.detail.specifications")}
                </h2>
                <dl className="space-y-4">
                  <div className="flex justify-between items-center border-b border-white/10 pb-3 last:border-0">
                    <dt className="text-xs uppercase tracking-wider font-semibold text-white/70">{t("racket.detail.specs.balance")}</dt>
                    <dd className="text-sm font-semibold text-white">{racket.balance || "-"}</dd>
                  </div>
                  <div className="flex justify-between items-center border-b border-white/10 pb-3 last:border-0">
                    <dt className="text-xs uppercase tracking-wider font-semibold text-white/70">{t("racket.detail.specs.surface")}</dt>
                    <dd className="text-sm font-semibold text-white">{racket.surface || "-"}</dd>
                  </div>
                  <div className="flex justify-between items-center border-b border-white/10 pb-3 last:border-0">
                    <dt className="text-xs uppercase tracking-wider font-semibold text-white/70">{t("racket.detail.specs.core")}</dt>
                    <dd className="text-sm font-semibold text-white">{racket.core || "-"}</dd>
                  </div>
                  <div className="flex justify-between items-center border-b border-white/10 pb-3 last:border-0">
                    <dt className="text-xs uppercase tracking-wider font-semibold text-white/70">{t("racket.detail.specs.hardness")}</dt>
                    <dd className="text-sm font-semibold text-white">{racket.hardness || "-"}</dd>
                  </div>
                  <div className="flex justify-between items-center border-b border-white/10 pb-3 last:border-0">
                    <dt className="text-xs uppercase tracking-wider font-semibold text-white/70">{t("racket.detail.specs.gameLevel")}</dt>
                    <dd className="text-sm font-semibold text-white">{racket.gameLevel || "-"}</dd>
                  </div>
                  <div className="flex justify-between items-center border-b border-white/10 pb-3 last:border-0">
                    <dt className="text-xs uppercase tracking-wider font-semibold text-white/70">{t("racket.detail.specs.gameType")}</dt>
                    <dd className="text-sm font-semibold text-white">{racket.gameType || "-"}</dd>
                  </div>
                </dl>
              </div>
            </div>
          </div>

          {/* DEEP DIVE: 2-Column Layout (Article + Sidebar) */}
          <div className="review-deep-dive mb-16">
            {/* Left: Article Content */}
            <div className="review-article">
              {racket.reviewContent ? (
                <div className="space-y-12">
                  {/* Review prose */}
                  <div className="prose prose-sm lg:prose max-w-none">
                    <div
                      dangerouslySetInnerHTML={{
                        __html: cleanReviewContent(racket.reviewContent)
                      }}
                      data-testid="text-review-content"
                      className="prose-headings:font-heading prose-headings:font-bold prose-h2:text-2xl prose-h3:text-xl prose-p:leading-relaxed prose-a:text-primary hover:prose-a:text-primary/80"
                    />
                  </div>

                  {/* Pros & Cons Grid */}
                  {(pros.length > 0 || cons.length > 0) && (
                    <div className="review-pros-cons">
                      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                        {/* Pros */}
                        {pros.length > 0 && (
                          <div className="review-pro-box">
                            <div className="flex items-center gap-3 mb-4">
                              <svg className="w-5 h-5 text-green-500" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                              </svg>
                              <h3 className="font-heading font-bold text-lg">Pros</h3>
                            </div>
                            <ul className="space-y-2">
                              {pros.map((pro, idx) => (
                                <li key={idx} className="text-sm text-foreground/80">
                                  • {pro}
                                </li>
                              ))}
                            </ul>
                          </div>
                        )}

                        {/* Cons */}
                        {cons.length > 0 && (
                          <div className="review-con-box">
                            <div className="flex items-center gap-3 mb-4">
                              <svg className="w-5 h-5 text-red-500" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                              </svg>
                              <h3 className="font-heading font-bold text-lg">Cons</h3>
                            </div>
                            <ul className="space-y-2">
                              {cons.map((con, idx) => (
                                <li key={idx} className="text-sm text-foreground/80">
                                  • {con}
                                </li>
                              ))}
                            </ul>
                          </div>
                        )}
                      </div>
                    </div>
                  )}

                  {/* Author Bio */}
                  {author && (
                    <div className="mt-12 pt-8 border-t border-border/50">
                      <div className="bg-muted/30 rounded-2xl p-6 sm:p-8 flex flex-col sm:flex-row gap-6 items-center sm:items-start text-center sm:text-left">
                        <div className="h-24 w-24 shrink-0 rounded-full bg-primary/10 flex items-center justify-center text-primary overflow-hidden border-2 border-primary/20">
                          {author.avatarUrl ? (
                            <img src={author.avatarUrl} alt={author.name} className="w-full h-full object-cover" />
                          ) : (
                            <User className="h-10 w-10" />
                          )}
                        </div>
                        <div className="flex-grow">
                          <h3 className="font-heading font-bold text-xl mb-2 flex items-center justify-center sm:justify-start gap-2">
                            {author.name}
                            <span className="text-xs font-normal tracking-widest uppercase bg-primary/10 text-primary px-2 py-0.5 rounded-full">
                              Expert Reviewer
                            </span>
                          </h3>
                          {author.bio && (
                            <p className="text-muted-foreground text-sm leading-relaxed mb-4">
                              {author.bio}
                            </p>
                          )}
                          <Button asChild variant="outline" size="sm" className="rounded-full">
                            <Link href={`/authors/${author.slug}`}>
                              Read Full Profile
                            </Link>
                          </Button>
                        </div>
                      </div>
                    </div>
                  )}
                </div>
              ) : (
                <div className="text-center py-10">
                  <p className="text-muted-foreground text-lg">
                    {t("racket.detail.reviewComingSoon")} <span className="font-semibold text-foreground">{racket.brand} {racket.model}</span>.
                  </p>
                </div>
              )}
            </div>

            {/* Right: Sidebar */}
            <div className="review-sidebar space-y-6">
              {/* Who Should Buy Callout */}
              <div className="review-callout-box">
                <div className="review-callout-title">Who Should Buy</div>
                <p className="text-sm text-foreground/80 leading-relaxed">
                  {whoShouldBuy}
                </p>
              </div>

              {/* FAQ Accordion */}
              {faqItems.length > 0 && (
                <div className="review-faq">
                  <h3 className="font-heading font-bold text-lg mb-4">Frequently Asked Questions</h3>
                  <div className="space-y-2">
                    {faqItems.map((item, idx) => (
                      <div key={idx} className="review-faq-item border border-border/40 rounded-lg overflow-hidden">
                        <button
                          onClick={() => setExpandedFaqIndex(expandedFaqIndex === idx ? null : idx)}
                          className="review-faq-summary w-full p-4 text-left font-medium text-sm hover:bg-muted/30 transition-colors flex items-center justify-between group"
                        >
                          <span>{item.question}</span>
                          <ChevronDown className={`h-4 w-4 transition-transform group-open:rotate-180 ${expandedFaqIndex === idx ? 'rotate-180' : ''}`} />
                        </button>
                        {expandedFaqIndex === idx && (
                          <div className="px-4 py-3 bg-muted/20 border-t border-border/40 text-sm text-foreground/80">
                            {item.answer}
                          </div>
                        )}
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* Table of Contents */}
              {racket.reviewContent && (
                <div>
                  <TableOfContents contentHtml={racket.reviewContent} />
                </div>
              )}

              {/* Price History Chart */}
              <PriceHistoryChart racketId={racket.id} currentPrice={racket.currentPrice} />

              {/* Share Buttons */}
              <ShareButtons
                title={`${racket.brand} ${racket.model} Review`}
                url={`/rackets/${getRacketSlug(racket)}`}
              />
            </div>
          </div>

          {/* Price & CTA Card (Desktop - in sidebar during deep dive, shown as card below on mobile) */}
          <div className="hidden lg:block mb-16">
            <Card className="border-2 border-primary/30 bg-gradient-to-br from-primary/10 via-background to-background premium-shadow relative overflow-hidden">
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
