import { useState, useMemo } from "react";
import { Link } from "wouter";
import { useQuery } from "@tanstack/react-query";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import type { Guide } from "@shared/schema";
import SEO from "@/components/SEO";
import { StructuredData } from "@/components/StructuredData";
import { Breadcrumbs } from "@/components/Breadcrumbs";
import { SITE_URL } from "@/lib/seo";

export default function GuidesPage() {
  const [selectedCategory, setSelectedCategory] = useState("All");
  
  const { data: guides, isLoading } = useQuery<Guide[]>({
    queryKey: ["/api/guides"],
  });

  const guidesWithSlugs = useMemo(
    () => (guides || []).filter((guide) => Boolean(guide.slug?.trim())),
    [guides],
  );

  const categories = ["All", "Beginners", "Intermediate", "Advanced", "General"];

  const filteredGuides = guidesWithSlugs.filter(
    (guide) => selectedCategory === "All" || guide.category.toLowerCase() === selectedCategory.toLowerCase()
  );

  const seoData = {
    title: "Padel Racket Buying Guides - Expert Advice & Reviews",
    description:
      "Comprehensive padel racket buying guides for players of all levels. Expert advice on choosing the perfect racket, understanding shapes, ratings, and finding the best models for your game.",
    url: "/guides",
    canonical: "/guides",
  };

  // Structured data
  const structuredData = useMemo(() => {
    const siteUrl = SITE_URL;
    const schemas = [];

    // CollectionPage schema
    schemas.push({
      "@context": "https://schema.org",
      "@type": "CollectionPage",
      "name": "Padel Racket Buying Guides",
      "description": seoData.description,
      "url": seoData.canonical,
    });

    // ItemList schema for guides
    if (filteredGuides && filteredGuides.length > 0) {
      schemas.push({
        "@context": "https://schema.org",
        "@type": "ItemList",
        "itemListElement": filteredGuides.slice(0, 20).map((guide, index) => ({
          "@type": "ListItem",
          "position": index + 1,
          "item": {
            "@type": "Article",
            "headline": guide.title,
            "description": guide.excerpt,
            "url": `${siteUrl}/guides/${guide.slug}`,
            "image": guide.featuredImage || undefined,
            "datePublished": guide.publishedAt ? new Date(guide.publishedAt).toISOString() : undefined,
          },
        })),
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
          "name": "Guides",
          "item": seoData.canonical,
        },
      ],
    });

    return schemas;
  }, [filteredGuides, seoData.canonical, seoData.description]);

  return (
    <div className="min-h-screen bg-background">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 py-8 sm:py-10">
        <SEO {...seoData} />
        <StructuredData data={structuredData} />

        {/* Breadcrumbs */}
        <Breadcrumbs items={[{ label: "Guides" }]} />

        {/* Header */}
        <div className="mb-8">
          <h1 className="font-heading font-bold text-3xl sm:text-4xl md:text-5xl mb-3" data-testid="text-page-title">
            Buying Guides
          </h1>
          <p className="text-muted-foreground text-base sm:text-lg">
            Expert advice to help you choose the perfect padel racket for your playing style and level
          </p>
        </div>

        {/* Category Filter */}
        <div className="flex flex-wrap gap-2 mb-8">
          {categories.map((category) => (
            <Badge
              key={category}
              variant={selectedCategory === category ? "default" : "outline"}
              className="cursor-pointer hover-elevate px-4 py-2"
              onClick={() => setSelectedCategory(category)}
              data-testid={`badge-category-filter-${category.toLowerCase()}`}
            >
              {category}
            </Badge>
          ))}
        </div>

        {/* Guides Grid */}
        {isLoading ? (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {Array.from({ length: 6 }).map((_, i) => (
              <Card key={i}>
                <CardContent className="p-0">
                  <Skeleton className="aspect-video w-full" />
                  <div className="p-6 space-y-3">
                    <Skeleton className="h-4 w-20" />
                    <Skeleton className="h-6 w-full" />
                    <Skeleton className="h-20 w-full" />
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
        ) : filteredGuides && filteredGuides.length > 0 ? (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {filteredGuides.map((guide) => (
              <Link key={guide.id} href={`/guides/${guide.slug}`} data-testid={`link-guide-${guide.id}`}>
                <Card className="h-full hover-elevate active-elevate-2 transition-all cursor-pointer" data-testid={`card-guide-${guide.id}`}>
                  <CardContent className="p-0">
                    {guide.featuredImage ? (
                      <div className="aspect-video w-full overflow-hidden">
                        <img
                          src={guide.featuredImage}
                          alt={`${guide.title} - Featured image`}
                          className="w-full h-full object-cover object-top group-hover:scale-105 transition-transform duration-300"
                          loading="lazy"
                          data-testid={`img-guide-${guide.id}`}
                        />
                      </div>
                    ) : (
                      <div className="aspect-video w-full bg-muted" />
                    )}
                    <div className="p-6 space-y-3">
                      <Badge variant="secondary" className="capitalize">
                        {guide.category}
                      </Badge>
                      <h3 className="font-semibold text-xl line-clamp-2" data-testid={`text-guide-title-${guide.id}`}>
                        {guide.title}
                      </h3>
                      <p className="text-sm text-muted-foreground line-clamp-3">
                        {guide.excerpt}
                      </p>
                      <p className="text-xs text-muted-foreground">
                        {new Date(guide.publishedAt).toLocaleDateString("en-US", {
                          year: "numeric",
                          month: "long",
                          day: "numeric",
                        })}
                      </p>
                    </div>
                  </CardContent>
                </Card>
              </Link>
            ))}
          </div>
        ) : (
          <Card>
            <CardContent className="flex flex-col items-center justify-center py-16">
              <p className="text-muted-foreground text-center">
                No guides found in this category
              </p>
            </CardContent>
          </Card>
        )}
      </div>
    </div>
  );
}
