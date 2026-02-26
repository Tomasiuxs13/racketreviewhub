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
import { motion } from "framer-motion";

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
        <section className="relative pt-24 pb-16 sm:pt-32 sm:pb-24 lg:pt-40 lg:pb-32 bg-background overflow-hidden">
          <div className="max-w-7xl mx-auto px-4 sm:px-6 flex flex-col-reverse lg:flex-row items-center gap-12 lg:gap-8">
            {/* Hero Content (Left) */}
            <motion.div
              initial={{ opacity: 0, y: 30 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.8, ease: "easeOut" }}
              className="flex-1 text-center lg:text-left z-10 w-full"
            >
              <motion.h1
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.8, delay: 0.1, ease: "easeOut" }}
                className="font-heading font-extrabold text-4xl sm:text-6xl md:text-7xl lg:text-7xl tracking-tight mb-6 text-foreground"
                data-testid="text-hero-title"
              >
                {t("home.hero.title")}
              </motion.h1>

              <motion.p
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                transition={{ duration: 0.8, delay: 0.3 }}
                className="text-base sm:text-lg md:text-xl text-muted-foreground font-medium mb-10 max-w-2xl mx-auto lg:mx-0 leading-relaxed"
              >
                {t("home.hero.subtitle")}
              </motion.p>

              <motion.div
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.8, delay: 0.4 }}
                className="flex flex-col sm:flex-row items-center justify-center lg:justify-start gap-4 mb-12"
              >
                <Link href="/rackets" data-testid="link-browse-rackets">
                  <Button
                    size="lg"
                    className="w-full sm:w-auto bg-primary text-primary-foreground hover:bg-emerald-500 shadow-[0_0_30px_rgba(34,197,94,0.4)] hover:shadow-[0_0_40px_rgba(34,197,94,0.6)] hover:-translate-y-1 transition-all duration-300 text-base sm:text-lg px-6 py-6 sm:px-8 rounded-full"
                    data-testid="button-browse-rackets"
                  >
                    {t("common.actions.browseRackets")}
                    <ArrowRight className="ml-2 h-4 w-4 sm:h-5 sm:w-5" />
                  </Button>
                </Link>
                <Link href="/guides" data-testid="link-buying-guides">
                  <Button
                    size="lg"
                    variant="outline"
                    className="w-full sm:w-auto bg-background text-foreground hover:bg-accent hover:text-accent-foreground border-border hover:-translate-y-1 transition-all duration-300 text-base sm:text-lg px-6 py-6 sm:px-8 rounded-full"
                    data-testid="button-buying-guides"
                  >
                    {t("common.actions.buyingGuides")}
                  </Button>
                </Link>
              </motion.div>

              {/* Trust Indicators */}
              <motion.div
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                transition={{ duration: 1, delay: 0.6 }}
                className="flex flex-col sm:flex-row items-center justify-center lg:justify-start gap-4 sm:gap-6 text-sm"
              >
                <Link href="/quiz">
                  <div className="flex items-center gap-2.5 cursor-pointer group hover:-translate-y-0.5 transition-all duration-300">
                    <div className="p-1.5 sm:p-2 rounded-full bg-yellow-100 dark:bg-yellow-900/40 group-hover:bg-yellow-200 dark:group-hover:bg-yellow-900/60 shadow-[0_0_10px_rgba(250,204,21,0.2)] transition-colors">
                      <Star className="h-4 w-4 text-yellow-600 dark:text-yellow-500 fill-yellow-600/50 dark:fill-yellow-500/50" />
                    </div>
                    <span className="font-bold text-foreground tracking-widest uppercase group-hover:text-primary transition-colors">{t("home.hero.trust.reviews")}</span>
                  </div>
                </Link>
                <div className="hidden sm:block w-px h-6 bg-border" />
                <div className="flex items-center gap-2.5 group hover:-translate-y-0.5 transition-all duration-300 cursor-default">
                  <div className="p-1.5 sm:p-2 rounded-full bg-green-100 dark:bg-green-900/40 shadow-[0_0_10px_rgba(74,222,128,0.2)]">
                    <TrendingUp className="h-4 w-4 text-green-600 dark:text-green-500" />
                  </div>
                  <span className="font-bold text-foreground tracking-widest uppercase">{t("home.hero.trust.updates")}</span>
                </div>
                <div className="hidden sm:block w-px h-6 bg-border" />
                <div className="flex items-center gap-2.5 group hover:-translate-y-0.5 transition-all duration-300 cursor-default">
                  <div className="p-1.5 sm:p-2 rounded-full bg-blue-100 dark:bg-blue-900/40 shadow-[0_0_10px_rgba(96,165,250,0.2)]">
                    <Shield className="h-4 w-4 text-blue-600 dark:text-blue-500" />
                  </div>
                  <span className="font-bold text-foreground tracking-widest uppercase">{t("home.hero.trust.experts")}</span>
                </div>
              </motion.div>
            </motion.div>

            {/* Hero Image / Visuals (Right) */}
            <motion.div
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              transition={{ duration: 0.8, delay: 0.2, ease: "easeOut" }}
              className="flex-1 relative w-full max-w-lg lg:max-w-none mx-auto lg:mr-0"
            >
              {/* Decorative background blur behind image */}
              <div className="absolute -inset-4 bg-gradient-to-tr from-primary/20 via-emerald-500/10 to-blue-500/20 rounded-[3rem] blur-[60px] lg:blur-[80px] -z-10" />

              <div className="relative rounded-3xl overflow-hidden shadow-2xl border border-border/50 bg-muted aspect-[4/3] lg:aspect-square xl:aspect-[4/3] group cursor-default group-hover:shadow-[0_0_40px_rgba(34,197,94,0.3)] transition-all duration-500">
                <img
                  src={heroImage}
                  alt="Padel court"
                  className="w-full h-full object-cover object-center group-hover:scale-105 transition-transform duration-1000 ease-out"
                  fetchPriority="high"
                />
                <div className="absolute inset-0 bg-gradient-to-t from-background/40 to-transparent pointer-events-none" />
              </div>
            </motion.div>
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
            <div className="flex flex-col sm:flex-row items-center justify-center gap-4">
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
              <Link href="/quiz">
                <Button
                  size="lg"
                  variant="outline"
                  className="border-white text-white hover:bg-white/10"
                >
                  Take the Quiz
                  <ArrowRight className="ml-2 h-5 w-5" />
                </Button>
              </Link>
            </div>
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
