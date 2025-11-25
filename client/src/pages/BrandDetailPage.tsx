import { useRoute, Link } from "wouter";
import { useQuery } from "@tanstack/react-query";
import { useLocalizedQuery } from "@/hooks/useLocalizedQuery";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { RacketCard } from "@/components/RacketCard";
import { ArrowLeft, User } from "lucide-react";
import type { Brand, Racket } from "@shared/schema";
import { getRacketSlug } from "@/lib/utils";
import { StructuredData } from "@/components/StructuredData";
import { Breadcrumbs } from "@/components/Breadcrumbs";
import { useMemo } from "react";
import SEO from "@/components/SEO";
import { SITE_URL } from "@/lib/seo";
import DOMPurify from "isomorphic-dompurify";
import { useI18n } from "@/i18n/useI18n";

function buildBrandArticleTitle(brand: Brand, racketCount: number, year: number): string {
  return `Best ${brand.name} Padel Rackets ${year} - Top ${racketCount || 10} Reviews & Buying Guide`;
}

function buildBrandSeoArticleIntro(brand: Brand, rackets: Racket[]): string {
  const year = new Date().getFullYear();
  const count = rackets.length;

  const safeDescription =
    brand.description ||
    `Discover the best padel rackets from ${brand.name}, from powerful attacking frames to easy-to-play control models for every level of player.`;

  const title = buildBrandArticleTitle(brand, count, year);

  return `
<h2>${title}</h2>
<p>${safeDescription}</p>
<p>If you are thinking about buying a ${brand.name} padel racket, this guide walks you through the strongest models in the current range, who they are for, and how to choose the right one for your style of play.</p>
`;
}

function buildBrandSeoArticleRest(brand: Brand, rackets: Racket[]): string {
  const count = rackets.length;

  if (count === 0) {
    return `
<h3>${brand.name} padel rackets overview</h3>
<p>We are still adding ${brand.name} rackets to our database. Check back soon for a complete ranking of the best models, including detailed ratings for power, control, comfort and value.</p>
`;
  }

  const overviewItems = rackets
    .map((racket, index) => {
      const slug = getRacketSlug(racket);
      const url = `/rackets/${slug}`;
      const title = `${racket.brand} ${racket.model} ${racket.year ?? ""}`.trim();
      const shape = racket.shape ? racket.shape.charAt(0).toUpperCase() + racket.shape.slice(1) : "";
      return `<li><strong><a href="${url}">${index + 1}. ${title}</a></strong> – ${shape.toLowerCase()} shape, overall rating ${racket.overallRating}/100, ideal for players looking for a blend of power and control.</li>`;
    })
    .join("\n");

  const overviewSection = `
<h3>Quick overview: top ${count} ${brand.name} padel rackets</h3>
<ol>
${overviewItems}
</ol>
`;

  const howToChooseSection = `
<h3>How to choose a ${brand.name} padel racket</h3>
<p>When choosing a ${brand.name} racket, start by being honest about your level and playing style. More advanced, aggressive players often benefit from diamond or teardrop shaped rackets with higher balance and stiffer cores, while beginners and intermediate players usually progress faster with round shapes that prioritise control and comfort.</p>
<p>Pay close attention to the racket's balance, weight and hardness. A head-heavy racket will give you extra power on smashes but can feel demanding on the arm, whereas a more even-balanced control model gives you better placement in defence and at the net. If you struggle with elbow or shoulder pain, look for softer cores and more flexible faces in the ${brand.name} range.</p>
`;

  const ratingsSection = `
<h3>${brand.name} racket rankings explained</h3>
<p>Every racket in our ${brand.name} ranking is scored on a 0–100 scale for power, control, rebound, manoeuvrability and sweet spot size. The overall rating you see in the list above is the average of those five metrics, so you can quickly compare different models and find the right balance for your game.</p>
<p>Click through to the full review of each racket to see a detailed breakdown of strengths, weaknesses, recommended player profiles, and our verdict on who will benefit most from that specific ${brand.name} model.</p>
`;

  const conclusion = `
<h3>Which ${brand.name} padel racket should you buy?</h3>
<p>If you are still unsure which ${brand.name} racket fits you best, start by shortlisting two or three options from the top of our ranking that match your level and budget, then read the full reviews. Focus on how each model behaves in defence, at the net and on smashes, not just the marketing claims, and you will end up with a racket that genuinely helps you play better padel.</p>
`;

  return [overviewSection, howToChooseSection, ratingsSection, conclusion].join("\n");
}

export default function BrandDetailPage() {
  const [, params] = useRoute("/brands/:slug");
  const slug = params?.slug;

  const { data: brand, isLoading: brandLoading } = useLocalizedQuery<Brand>({
    queryKey: [`/api/brands/${slug}`],
    enabled: !!slug,
  });

  const { data: allRackets, isLoading: racketsLoading } = useLocalizedQuery<Racket[]>({
    queryKey: [`/api/brands/${slug}/rackets`],
    enabled: !!slug,
  });

  // Get top 3 rackets for cards above Quick overview
  const top3Rackets = useMemo(() => allRackets?.slice(0, 3) || [], [allRackets]);
  // Get top 10 rackets for the article section
  const top10Rackets = useMemo(() => allRackets?.slice(0, 10) || [], [allRackets]);

  const { locale } = useI18n();

  // SEO data - calculate even when brand is loading/undefined to keep hooks consistent
  const year = new Date().getFullYear();
  const racketCount = top10Rackets.length;
  const articleTitle = brand
    ? buildBrandArticleTitle(brand, racketCount, year)
    : "Padel Racket Brand";
  const canonicalPath = brand ? `/brands/${brand.slug}` : "/brands";
  const seoDescription = brand
    ? brand.description ||
      `Discover the best ${brand.name} padel rackets in ${year}. Expert reviews, ratings, and buying guide for top ${
        racketCount || 10
      } models. Find your perfect racket today.`
    : "Padel racket brand page";
  const seoData = {
    title: articleTitle,
    description: seoDescription,
    image: brand?.logoUrl,
    url: canonicalPath,
    canonical: canonicalPath,
    type: "article" as const,
  };

  // Structured data - must be called before conditional returns
  const structuredData = useMemo(() => {
    if (!brand) return [];

    const siteUrl = SITE_URL;
    const brandUrl = `${siteUrl}/brands/${brand.slug}`;
    const publishedDate = brand.createdAt ? new Date(brand.createdAt).toISOString() : new Date().toISOString();

    const schemas = [];

    // Organization schema for the brand
    schemas.push({
      "@context": "https://schema.org",
      "@type": "Organization",
      "name": brand.name,
      "description": brand.description,
      "url": brandUrl,
      "logo": brand.logoUrl || undefined,
    });

    // Article schema - use the actual H2 heading as headline for consistency
    const articleHeadline = buildBrandArticleTitle(brand, top10Rackets.length, year);
    const articleSchema: any = {
      "@context": "https://schema.org",
      "@type": "Article",
      "headline": articleHeadline,
      "description": seoDescription,
      "image": brand.logoUrl ? [brand.logoUrl] : undefined,
      "inLanguage": locale,
      "datePublished": publishedDate,
      "dateModified": publishedDate,
      "author": {
        "@type": "Organization",
        "name": "Padel Racket Reviews",
      },
      "publisher": {
        "@type": "Organization",
        "name": "Padel Racket Reviews",
        "logo": {
          "@type": "ImageObject",
          "url": `${siteUrl}/favicon.png`,
        },
      },
      "mainEntityOfPage": {
        "@type": "WebPage",
        "@id": brandUrl,
      },
    };

    // Add product references if rackets exist
    if (top10Rackets.length > 0) {
      articleSchema.mentions = top10Rackets.slice(0, 10).map((racket) => ({
        "@type": "Product",
        "name": `${racket.brand} ${racket.model} ${racket.year || ""}`.trim(),
        "brand": {
          "@type": "Brand",
          "name": racket.brand,
        },
        "aggregateRating": {
          "@type": "AggregateRating",
          "ratingValue": racket.overallRating,
          "bestRating": 100,
          "worstRating": 0,
        },
        "offers": {
          "@type": "Offer",
          "price": racket.currentPrice,
          "priceCurrency": "EUR",
          "availability": "https://schema.org/InStock",
          "url": racket.affiliateLink || racket.titleUrl || `${siteUrl}/rackets/${getRacketSlug(racket)}`,
        },
      }));
    }

    schemas.push(articleSchema);

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
          "name": "Brands",
          "item": `${siteUrl}/brands`,
        },
        {
          "@type": "ListItem",
          "position": 3,
          "name": brand.name,
          "item": brandUrl,
        },
      ],
    });

    return schemas;
  }, [brand, top10Rackets, seoDescription, year, locale]);

  const seoElement = <SEO {...seoData} />;

  const { sanitizedIntro, sanitizedRest } = useMemo(() => {
    if (!brand) {
      return { sanitizedIntro: null, sanitizedRest: null };
    }

    const trimmedArticle = brand.articleContent?.trim();
    if (trimmedArticle?.length) {
      return {
        sanitizedIntro: null,
        sanitizedRest: DOMPurify.sanitize(trimmedArticle),
      };
    }

    const articleIntroHtml = buildBrandSeoArticleIntro(brand, top10Rackets);
    const articleRestHtml = buildBrandSeoArticleRest(brand, top10Rackets);

    return {
      sanitizedIntro: articleIntroHtml ? DOMPurify.sanitize(articleIntroHtml) : null,
      sanitizedRest: articleRestHtml ? DOMPurify.sanitize(articleRestHtml) : null,
    };
  }, [brand, top10Rackets]);

  if (brandLoading) {
    return (
      <>
        {seoElement}
        <div className="min-h-screen bg-background">
        <div className="max-w-7xl mx-auto px-6 py-8">
          <Skeleton className="h-10 w-32 mb-8" />
          <Skeleton className="h-32 w-full mb-8" />
          <Skeleton className="h-96 w-full" />
        </div>
      </div>
      </>
    );
  }

  if (!brand) {
    return (
      <>
        {seoElement}
        <div className="min-h-screen bg-background flex items-center justify-center">
        <Card>
          <CardContent className="p-12 text-center">
            <p className="text-muted-foreground mb-4">Brand not found</p>
            <Link href="/brands">
              <Button>Back to Brands</Button>
            </Link>
          </CardContent>
        </Card>
      </div>
      </>
    );
  }

  return (
    <>
      {seoElement}
      <div className="min-h-screen bg-background">
      <div className="max-w-7xl mx-auto px-6 py-8">
        <StructuredData data={structuredData} />

        {/* Breadcrumbs */}
        <Breadcrumbs
          items={[
            { label: "Brands", href: "/brands" },
            { label: brand.name },
          ]}
        />

        {/* Back Button */}
        <Link href="/brands" data-testid="link-back-to-brands">
          <Button variant="ghost" className="mb-8 -ml-3" data-testid="button-back">
            <ArrowLeft className="mr-2 h-4 w-4" />
            Back to Brands
          </Button>
        </Link>

        {/* Brand Header */}
        <div className="mb-12">
          <div className="flex items-center gap-6 mb-6">
            {brand.logoUrl && (
              <div className="w-24 h-24 flex items-center justify-center">
                <img
                  src={brand.logoUrl}
                  alt={`${brand.name} logo`}
                  className="max-w-full max-h-full object-contain"
                  loading="lazy"
                  decoding="async"
                  data-testid="img-brand-logo"
                />
              </div>
            )}
            <div>
              <h1 className="font-heading font-bold text-4xl md:text-5xl mb-2" data-testid="text-brand-name">
                {brand.name}
              </h1>
              {/* Author */}
              <div className="flex items-center gap-2 text-sm text-muted-foreground mb-2">
                <User className="h-4 w-4" />
                <Link
                  href="/authors/carlos-rodriguez"
                  className="hover:text-primary hover:underline transition-colors"
                  data-testid="link-author"
                >
                  Padel Racket Reviews
                </Link>
              </div>
              <p className="text-muted-foreground text-lg">
                {brand.description}
              </p>
            </div>
          </div>
        </div>

        {/* Brand SEO Article with Top 3 Racket Cards */}
        <Card className="mb-12">
          <CardContent className="p-8 md:p-12">
            <article>
              {/* Article Intro - only show if using generated content */}
              {sanitizedIntro && (
                <div
                  className="prose prose-lg max-w-none mb-8"
                  dangerouslySetInnerHTML={{ __html: sanitizedIntro }}
                  data-testid="text-brand-article-intro"
                />
              )}

            {/* Top 3 Racket Cards */}
            {top3Rackets.length > 0 && (
              <div className="mb-8">
                {racketsLoading ? (
                  <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6">
                    {Array.from({ length: 3 }).map((_, i) => (
                      <Card key={i}>
                        <CardContent className="p-0">
                          <Skeleton className="aspect-[3/4] w-full" />
                          <div className="p-6 space-y-3">
                            <Skeleton className="h-4 w-3/4" />
                            <Skeleton className="h-6 w-full" />
                            <Skeleton className="h-20 w-full" />
                          </div>
                        </CardContent>
                      </Card>
                    ))}
                  </div>
                ) : (
                  <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6">
                    {top3Rackets.map((racket) => (
                      <RacketCard key={racket.id} racket={racket} />
                    ))}
                  </div>
                )}
              </div>
            )}

              {/* Article Content - use existing articleContent from database if available */}
              {sanitizedRest && (
                <div
                  className="prose prose-lg max-w-none prose-headings:font-heading prose-a:text-primary prose-a:no-underline hover:prose-a:underline prose-strong:font-semibold prose-img:rounded-lg prose-img:shadow-md prose-img:my-8 prose-img:object-cover prose-img:object-top mb-12"
                  dangerouslySetInnerHTML={{ __html: sanitizedRest }}
                  data-testid="text-brand-article-rest"
                />
              )}
            </article>

            {/* Top 10 Rackets within Article */}
            {top10Rackets.length > 0 && (
              <>
                <h2 className="font-heading font-semibold text-3xl mb-6">
                  Top {top10Rackets.length} rackets from {brand.name}
                </h2>
                <p className="text-muted-foreground text-lg mb-8">
                  These cards summarise the same rackets discussed in the article above. Click through to read the full review for each model.
                </p>

                {racketsLoading ? (
                  <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6">
                    {Array.from({ length: 10 }).map((_, i) => (
                      <Card key={i}>
                        <CardContent className="p-0">
                          <Skeleton className="aspect-square w-full" />
                          <div className="p-6 space-y-3">
                            <Skeleton className="h-4 w-3/4" />
                            <Skeleton className="h-6 w-full" />
                            <Skeleton className="h-20 w-full" />
                          </div>
                        </CardContent>
                      </Card>
                    ))}
                  </div>
                ) : (
                  <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6">
                    {top10Rackets.map((racket) => (
                      <RacketCard key={racket.id} racket={racket} />
                    ))}
                  </div>
                )}
              </>
            )}
          </CardContent>
        </Card>

        {/* All Rackets from Brand */}
        {allRackets && allRackets.length > 10 && (
          <div>
            <h2 className="font-heading font-semibold text-3xl mb-6" data-testid="text-top-rackets-title">
              All Rackets from {brand.name}
            </h2>

            {racketsLoading ? (
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6">
                {Array.from({ length: 8 }).map((_, i) => (
                  <Card key={i}>
                    <CardContent className="p-0">
                      <Skeleton className="aspect-[3/4] w-full" />
                      <div className="p-6 space-y-3">
                        <Skeleton className="h-4 w-3/4" />
                        <Skeleton className="h-6 w-full" />
                        <Skeleton className="h-20 w-full" />
                      </div>
                    </CardContent>
                  </Card>
                ))}
              </div>
            ) : allRackets.length > 0 ? (
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6">
                {allRackets.map((racket) => (
                  <RacketCard key={racket.id} racket={racket} />
                ))}
              </div>
            ) : (
              <Card>
                <CardContent className="flex flex-col items-center justify-center py-16">
                  <p className="text-muted-foreground text-center">
                    No rackets available from {brand.name} yet.
                  </p>
                </CardContent>
              </Card>
            )}
          </div>
        )}
      </div>
    </div>
    </>
  );
}
