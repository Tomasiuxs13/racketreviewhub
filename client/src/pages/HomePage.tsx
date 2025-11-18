import { Link } from "wouter";
import { useQuery } from "@tanstack/react-query";
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

export default function HomePage() {
  const { data: recentRackets, isLoading: racketsLoading } = useQuery<Racket[]>({
    queryKey: ["/api/rackets/recent"],
  });

  const { data: recentGuides, isLoading: guidesLoading } = useQuery<Guide[]>({
    queryKey: ["/api/guides/recent"],
  });

  const seoData = {
    title: "Padel Racket Reviews - Expert Reviews & Best Price Comparisons",
    description:
      "Expert padel racket reviews with detailed ratings, performance analysis, and affiliate links to the best prices. Compare top rackets from leading brands and find your perfect match.",
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
      "name": "Padel Racket Reviews",
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
      "name": "Padel Racket Reviews",
      "description": "Expert padel racket reviews and buying guides",
      "url": siteUrl,
      "logo": `${siteUrl}/favicon.png`,
      "sameAs": [],
    });

    // CollectionPage schema for homepage
    schemas.push({
      "@context": "https://schema.org",
      "@type": "CollectionPage",
      "name": "Padel Racket Reviews - Home",
      "description": seoData.description,
      "url": siteUrl,
    });

    return schemas;
  }, [seoData.description]);

  return (
    <>
      <SEO {...seoData} />
      <StructuredData data={structuredData} />
      <div className="min-h-screen">
      {/* Hero Section */}
      <section className="relative min-h-[500px] lg:min-h-[600px] flex items-center justify-center overflow-hidden">
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
        <div className="relative z-10 max-w-4xl mx-auto px-6 text-center">
          <h1 className="font-heading font-bold text-5xl md:text-6xl lg:text-7xl text-white mb-6" data-testid="text-hero-title">
            Find Your Perfect Padel Racket
          </h1>
          <p className="text-xl md:text-2xl text-white/90 mb-8 max-w-2xl mx-auto">
            Expert reviews, detailed ratings, and the best prices for players of all levels
          </p>
          <div className="flex flex-col sm:flex-row items-center justify-center gap-4">
            <Link href="/rackets" data-testid="link-browse-rackets">
              <Button
                size="lg"
                className="bg-primary text-primary-foreground hover:bg-primary/90 backdrop-blur-sm text-lg px-8"
                data-testid="button-browse-rackets"
              >
                Browse All Rackets
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
                Buying Guides
              </Button>
            </Link>
          </div>

          {/* Trust Indicators */}
          <div className="mt-12 flex flex-wrap items-center justify-center gap-8 text-white/80">
            <div className="flex items-center gap-2">
              <Star className="h-5 w-5 text-yellow-400" />
              <span className="text-sm font-medium">1,200+ Reviews</span>
            </div>
            <div className="flex items-center gap-2">
              <TrendingUp className="h-5 w-5 text-green-400" />
              <span className="text-sm font-medium">Updated Daily</span>
            </div>
            <div className="flex items-center gap-2">
              <Shield className="h-5 w-5 text-blue-400" />
              <span className="text-sm font-medium">Expert Analysis</span>
            </div>
          </div>
        </div>
      </section>

      {/* Recent Reviews Section */}
      <section className="py-16 bg-background">
        <div className="max-w-7xl mx-auto px-6">
          <div className="flex items-center justify-between mb-8">
            <div>
              <h2 className="font-heading font-semibold text-3xl md:text-4xl mb-2" data-testid="text-recent-reviews-title">
                Latest Racket Reviews
              </h2>
              <p className="text-muted-foreground">
                Our newest expert reviews and ratings
              </p>
            </div>
            <Link href="/rackets" data-testid="link-view-all-reviews">
              <Button variant="outline" data-testid="button-view-all-reviews">
                View All
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
                  No rackets available yet. Check back soon!
                </p>
              </CardContent>
            </Card>
          )}
        </div>
      </section>

      {/* CTA Section */}
      <section className="py-16 bg-primary text-primary-foreground">
        <div className="max-w-4xl mx-auto px-6 text-center">
          <h2 className="font-heading font-bold text-3xl md:text-4xl mb-4" data-testid="text-cta-title">
            Getting Started with Padel?
          </h2>
          <p className="text-xl text-primary-foreground/90 mb-8">
            Discover the best rackets for beginners with our comprehensive buying guide. Learn what to look for and find the perfect racket for your skill level.
          </p>
          <Link href="/guides/best-padel-rackets-for-beginners-2025">
            <Button
              size="lg"
              variant="secondary"
              className="bg-white text-primary hover:bg-white/90"
              data-testid="button-cta-beginner-guide"
            >
              Best Rackets for Beginners
              <ArrowRight className="ml-2 h-5 w-5" />
            </Button>
          </Link>
        </div>
      </section>

      {/* Recent Guides Section */}
      <section className="py-16 bg-background">
        <div className="max-w-7xl mx-auto px-6">
          <div className="flex items-center justify-between mb-8">
            <div>
              <h2 className="font-heading font-semibold text-3xl md:text-4xl mb-2" data-testid="text-recent-guides-title">
                Latest Buying Guides
              </h2>
              <p className="text-muted-foreground">
                Expert advice to help you choose the right racket
              </p>
            </div>
            <Link href="/guides" data-testid="link-view-all-guides">
              <Button variant="outline" data-testid="button-view-all-guides">
                View All
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
                  No guides available yet. Check back soon!
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
