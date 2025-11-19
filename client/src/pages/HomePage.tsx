import { Link } from "wouter";
import { useQuery } from "@tanstack/react-query";
import { useLocalizedQuery } from "@/hooks/useLocalizedQuery";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { ArrowRight, Star, TrendingUp, Shield } from "lucide-react";
import { RacketCard } from "@/components/RacketCard";
import { Skeleton } from "@/components/ui/skeleton";
import type { Racket, Guide } from "@shared/schema";
import heroImage from "@assets/generated_images/Padel_court_hero_background_fd7eb556.png";
import SEO from "@/components/SEO";
import { StructuredData } from "@/components/StructuredData";
import { useMemo } from "react";
import { SITE_URL } from "@/lib/seo";
import { useI18n } from "@/i18n/useI18n";

export default function HomePage() {
  const { data: recentRackets, isLoading: racketsLoading } = useLocalizedQuery<Racket[]>({
    queryKey: ["/api/rackets/recent"],
  });

  const { data: recentGuides, isLoading: guidesLoading } = useLocalizedQuery<Guide[]>({
    queryKey: ["/api/guides/recent"],
  });

  const { t } = useI18n();
  const brandName = t("common.brandName");

  const seoData = {
    title: t("home.seo.title"),
    description: t("home.seo.description"),
    url: "/",
    canonical: "/",
  };

  // Structured data
  const structuredData = useMemo(() => {
    const siteUrl = SITE_URL;
    const schemas = [];

    // WebSite schema with SearchAction
    schemas.push({
      "@context": "https://schema.org",
      "@type": "WebSite",
      "name": brandName,
      "description": seoData.description,
      "url": siteUrl,
      "potentialAction": {
        "@type": "SearchAction",
        "target": {
          "@type": "EntryPoint",
          "urlTemplate": `${siteUrl}/rackets?q={search_term_string}`,
        },
        "query-input": "required name=search_term_string",
      },
    });

    // Organization schema
    schemas.push({
      "@context": "https://schema.org",
      "@type": "Organization",
      "name": brandName,
      "description": seoData.description,
      "url": siteUrl,
      "logo": `${siteUrl}/favicon.png`,
      "sameAs": [],
    });

    // CollectionPage schema for homepage
    schemas.push({
      "@context": "https://schema.org",
      "@type": "CollectionPage",
      "name": seoData.title,
      "description": seoData.description,
      "url": siteUrl,
    });

    return schemas;
  }, [brandName, seoData.description, seoData.title]);

  return (
    <>
      <SEO {...seoData} />
      <StructuredData data={structuredData} />
      <div className="min-h-screen">
      {/* Hero Section */}
      <section className="relative min-h-[420px] sm:min-h-[520px] lg:min-h-[600px] flex items-center justify-center overflow-hidden py-16 sm:py-24">
        {/* Background Image with Dark Overlay */}
        <div className="absolute inset-0">
          <img
            src={heroImage}
            alt="Padel court"
            className="w-full h-full object-cover"
            loading="lazy"
            decoding="async"
          />
          <div className="absolute inset-0 bg-gradient-to-b from-black/60 via-black/50 to-black/70" />
        </div>

        {/* Hero Content */}
        <div className="relative z-10 max-w-4xl mx-auto px-4 sm:px-6 text-center">
          <h1 className="font-heading font-bold text-4xl sm:text-5xl md:text-6xl lg:text-7xl text-white mb-6" data-testid="text-hero-title">
            {t("home.hero.title")}
          </h1>
          <p className="text-lg sm:text-xl md:text-2xl text-white/90 mb-8 max-w-3xl mx-auto">
            {t("home.hero.subtitle")}
          </p>
          <div className="flex flex-col sm:flex-row items-center justify-center gap-4">
            <Link href="/rackets" data-testid="link-browse-rackets">
              <Button
                size="lg"
                className="bg-primary text-primary-foreground hover:bg-primary/90 backdrop-blur-sm text-lg px-8"
                data-testid="button-browse-rackets"
              >
                {t("common.actions.browseRackets")}
                <ArrowRight className="ml-2 h-5 w-5" />
              </Button>
            </Link>
            <Link href="/guides" data-testid="link-buying-guides">
              <Button
                size="lg"
                variant="outline"
                className="bg-white/10 text-white border-white/30 hover:bg-white/20 backdrop-blur-sm text-lg px-8"
                data-testid="button-buying-guides"
              >
                {t("common.actions.buyingGuides")}
              </Button>
            </Link>
          </div>

          {/* Trust Indicators */}
          <div className="mt-10 sm:mt-12 flex flex-wrap items-center justify-center gap-5 sm:gap-8 text-white/80 text-sm sm:text-base">
            <div className="flex items-center gap-2">
              <Star className="h-5 w-5 text-yellow-400" />
              <span className="text-sm font-medium">{t("home.hero.trust.reviews")}</span>
            </div>
            <div className="flex items-center gap-2">
              <TrendingUp className="h-5 w-5 text-green-400" />
              <span className="text-sm font-medium">{t("home.hero.trust.updates")}</span>
            </div>
            <div className="flex items-center gap-2">
              <Shield className="h-5 w-5 text-blue-400" />
              <span className="text-sm font-medium">{t("home.hero.trust.experts")}</span>
            </div>
          </div>
        </div>
      </section>

      {/* Recent Reviews Section */}
      <section className="py-16 bg-background">
        <div className="max-w-7xl mx-auto px-4 sm:px-6">
          <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between mb-8 text-center md:text-left">
            <div className="space-y-2">
              <h2 className="font-heading font-semibold text-3xl md:text-4xl" data-testid="text-recent-reviews-title">
                {t("home.recentReviews.title")}
              </h2>
              <p className="text-muted-foreground">
                {t("home.recentReviews.subtitle")}
              </p>
            </div>
            <Link href="/rackets" data-testid="link-view-all-reviews" className="md:ml-auto">
              <Button variant="outline" className="w-full sm:w-auto" data-testid="button-view-all-reviews">
                {t("common.actions.viewAll")}
                <ArrowRight className="ml-2 h-4 w-4" />
              </Button>
            </Link>
          </div>

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
          ) : recentRackets && recentRackets.length > 0 ? (
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6">
              {recentRackets.slice(0, 8).map((racket) => (
                <RacketCard key={racket.id} racket={racket} />
              ))}
            </div>
          ) : (
            <Card>
              <CardContent className="flex flex-col items-center justify-center py-12">
                <p className="text-muted-foreground text-center">
                  {t("home.recentReviews.empty")}
                </p>
              </CardContent>
            </Card>
          )}
        </div>
      </section>

      {/* CTA Section */}
      <section className="py-16 bg-primary text-primary-foreground">
        <div className="max-w-4xl mx-auto px-4 sm:px-6 text-center">
          <h2 className="font-heading font-bold text-3xl md:text-4xl mb-4" data-testid="text-cta-title">
            {t("home.cta.title")}
          </h2>
          <p className="text-lg sm:text-xl text-primary-foreground/90 mb-8">
            {t("home.cta.subtitle")}
          </p>
          <Link href="/guides/best-padel-rackets-for-beginners-2025">
            <Button
              size="lg"
              variant="secondary"
              className="bg-white text-primary hover:bg-white/90"
              data-testid="button-cta-beginner-guide"
            >
              {t("home.cta.button")}
              <ArrowRight className="ml-2 h-5 w-5" />
            </Button>
          </Link>
        </div>
      </section>

      {/* Recent Guides Section */}
      <section className="py-16 bg-background">
        <div className="max-w-7xl mx-auto px-4 sm:px-6">
          <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between mb-8 text-center md:text-left">
            <div className="space-y-2">
              <h2 className="font-heading font-semibold text-3xl md:text-4xl" data-testid="text-recent-guides-title">
                {t("home.recentGuides.title")}
              </h2>
              <p className="text-muted-foreground">
                {t("home.recentGuides.subtitle")}
              </p>
            </div>
            <Link href="/guides" data-testid="link-view-all-guides" className="md:ml-auto">
              <Button variant="outline" className="w-full sm:w-auto" data-testid="button-view-all-guides">
                {t("common.actions.viewAll")}
                <ArrowRight className="ml-2 h-4 w-4" />
              </Button>
            </Link>
          </div>

          {guidesLoading ? (
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6">
              {Array.from({ length: 8 }).map((_, i) => (
                <Card key={i}>
                  <CardContent className="p-0">
                    <Skeleton className="aspect-video w-full" />
                    <div className="p-6 space-y-3">
                      <Skeleton className="h-4 w-20" />
                      <Skeleton className="h-6 w-full" />
                      <Skeleton className="h-16 w-full" />
                    </div>
                  </CardContent>
                </Card>
              ))}
            </div>
          ) : recentGuides && recentGuides.length > 0 ? (
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6">
              {recentGuides.slice(0, 8).map((guide) => (
                <Link key={guide.id} href={`/guides/${guide.slug}`} data-testid={`link-guide-${guide.id}`}>
                  <Card className="h-full hover-elevate active-elevate-2 transition-all cursor-pointer" data-testid={`card-guide-${guide.id}`}>
                    <CardContent className="p-0">
                      {guide.featuredImage ? (
                        <div className="aspect-video w-full overflow-hidden">
                          <img
                            src={guide.featuredImage}
                            alt={guide.title}
                            className="w-full h-full object-cover"
                            loading="lazy"
                            data-testid={`img-guide-${guide.id}`}
                          />
                        </div>
                      ) : (
                        <div className="aspect-video w-full bg-muted" />
                      )}
                      <div className="p-6 space-y-3">
                        <span className="text-xs font-semibold text-primary uppercase tracking-wide">
                          {guide.category}
                        </span>
                        <h3 className="font-semibold text-lg line-clamp-2" data-testid={`text-guide-title-${guide.id}`}>
                          {guide.title}
                        </h3>
                        <p className="text-sm text-muted-foreground line-clamp-3">
                          {guide.excerpt}
                        </p>
                      </div>
                    </CardContent>
                  </Card>
                </Link>
              ))}
            </div>
          ) : (
            <Card>
              <CardContent className="flex flex-col items-center justify-center py-12">
                <p className="text-muted-foreground text-center">
                  {t("home.recentGuides.empty")}
                </p>
              </CardContent>
            </Card>
          )}
        </div>
      </section>
    </div>
    </>
  );
}
