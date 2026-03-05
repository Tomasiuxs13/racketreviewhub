import { Link, useLocation } from "wouter";
import { useQuery } from "@tanstack/react-query";
import { useLocalizedQuery } from "@/hooks/useLocalizedQuery";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { ArrowLeft, Calendar, ExternalLink, TrendingUp, User } from "lucide-react";
import type { Guide } from "@shared/schema";
import SEO from "@/components/SEO";
import { StructuredData } from "@/components/StructuredData";
import { Breadcrumbs } from "@/components/Breadcrumbs";
import { MentionedRackets } from "@/components/MentionedRackets";
import { useMemo } from "react";
import { SITE_URL } from "@/lib/seo";
import { useI18n } from "@/i18n/useI18n";

export default function GuideDetailPage() {
  const [location] = useLocation();
  // Extract slug from the path, supporting both /guides/:slug and /:locale/guides/:slug
  const guideSlugMatch = location.match(/\/guides\/([^/?#]+)/);
  const slug = guideSlugMatch ? decodeURIComponent(guideSlugMatch[1]) : undefined;

  const { data: guide, isLoading } = useLocalizedQuery<Guide>({
    queryKey: [`/api/guides/${slug}`],
    enabled: !!slug,
  });

  const { data: relatedGuides } = useLocalizedQuery<Guide[]>({
    queryKey: [`/api/guides/${slug}/related`],
    enabled: !!slug && !!guide,
  });

  const { locale } = useI18n();

  const publishedDate = guide?.publishedAt ? new Date(guide.publishedAt).toISOString() : undefined;
  const modifiedDate = guide?.updatedAt ? new Date(guide.updatedAt).toISOString() : publishedDate;
  const canonicalPath = guide ? `/guides/${guide.slug}` : "/guides";
  const seoData = {
    title: guide ? guide.title : "Padel Racket Guide",
    description: guide
      ? (guide.excerpt && guide.excerpt.length > 30 && !/^author:\s/i.test(guide.excerpt)
        ? guide.excerpt
        : `${guide.title}. Expert padel guide with tips and buying advice for all levels.`)
      : "Expert padel racket buying guides and advice",
    image: guide?.featuredImage || undefined,
    url: canonicalPath,
    canonical: canonicalPath,
    type: "article" as const,
    author: "Padel Racket Reviews",
    publishedTime: publishedDate,
    modifiedTime: modifiedDate,
  };

  // Structured data - must be called before conditional returns
  const structuredData = useMemo(() => {
    if (!guide) return [];

    const siteUrl = SITE_URL;
    const guideUrl = `${siteUrl}/guides/${guide.slug}`;
    const publishedDate = guide.publishedAt ? new Date(guide.publishedAt).toISOString() : new Date().toISOString();
    const modifiedDate = guide.updatedAt ? new Date(guide.updatedAt).toISOString() : publishedDate;

    const schemas = [];

    // Article schema
    const articleSchema: any = {
      "@context": "https://schema.org",
      "@type": "Article",
      "headline": guide.title,
      "description": guide.excerpt,
      "image": guide.featuredImage ? [guide.featuredImage] : undefined,
      "inLanguage": locale,
      "datePublished": publishedDate,
      "dateModified": modifiedDate,
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
        "@id": guideUrl,
      },
      "articleSection": guide.category,
      "keywords": `padel racket, ${guide.category}, buying guide, padel equipment`,
    };

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
          "name": "Guides",
          "item": `${siteUrl}/guides`,
        },
        {
          "@type": "ListItem",
          "position": 3,
          "name": guide.title,
          "item": guideUrl,
        },
      ],
    });

    return schemas;
  }, [guide, locale]);

  // Remove duplicate H1 title from content if it exists - must be called before conditional returns
  const cleanedContent = useMemo(() => {
    if (!guide || !guide.content || typeof document === 'undefined') return guide?.content || '';

    const content = guide.content;
    const title = guide.title;

    try {
      // Create a temporary div to parse the HTML
      const tempDiv = document.createElement('div');
      tempDiv.innerHTML = content;

      // Find the first h1 element
      const firstH1 = tempDiv.querySelector('h1');
      if (firstH1 && title) {
        // Check if the H1 text matches or is similar to the guide title
        const h1Text = firstH1.textContent?.trim() || '';
        const titleText = title.trim();

        // If they match (case-insensitive, allowing for slight variations), remove the H1
        if (h1Text.toLowerCase() === titleText.toLowerCase() ||
          h1Text.toLowerCase().includes(titleText.toLowerCase()) ||
          titleText.toLowerCase().includes(h1Text.toLowerCase())) {
          firstH1.remove();
          return tempDiv.innerHTML;
        }
      }
    } catch (error) {
      // If parsing fails, return original content
      console.warn('Failed to clean guide content:', error);
    }

    return content;
  }, [guide?.content, guide?.title]);

  const seoElement = <SEO {...seoData} />;

  if (isLoading) {
    return (
      <>
        {seoElement}
        <div className="min-h-screen bg-background">
          <div className="max-w-4xl mx-auto px-6 py-8">
            <Skeleton className="h-10 w-32 mb-8" />
            <Skeleton className="h-64 w-full mb-8" />
            <Skeleton className="h-12 w-3/4 mb-4" />
            <Skeleton className="h-96 w-full" />
          </div>
        </div>
      </>
    );
  }

  if (!guide) {
    return (
      <>
        {seoElement}
        <div className="min-h-screen bg-background flex items-center justify-center">
          <Card>
            <CardContent className="p-12 text-center">
              <p className="text-muted-foreground mb-4">Guide not found</p>
              <Link href="/guides">
                <Button>Back to Guides</Button>
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
              { label: "Guides", href: "/guides" },
              { label: guide.title },
            ]}
          />

          {/* Back Button */}
          <Link href="/guides" data-testid="link-back-to-guides">
            <Button variant="ghost" className="mb-8 -ml-3" data-testid="button-back">
              <ArrowLeft className="mr-2 h-4 w-4" />
              Back to Guides
            </Button>
          </Link>

          <div className="flex flex-col lg:flex-row gap-10 lg:gap-16">
            {/* Main Content */}
            <div className="flex-1 min-w-0">
              {/* Featured Image */}
              {guide.featuredImage && (
                <div className="aspect-video w-full overflow-hidden rounded-2xl mb-10 premium-shadow relative group">
                  <div className="absolute inset-0 bg-primary/10 mix-blend-overlay z-10 pointer-events-none" />
                  <img
                    src={guide.featuredImage}
                    alt={`${guide.title} - Featured image`}
                    className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-700 ease-out"
                    loading="lazy"
                    data-testid="img-guide-featured"
                  />
                </div>
              )}

              {/* Header */}
              <div className="mb-10 text-center lg:text-left">
                <Badge variant="secondary" className="mb-5 capitalize px-3 py-1 text-xs tracking-widest" data-testid="badge-category">
                  {guide.category}
                </Badge>
                <h1 className="font-heading font-extrabold text-4xl md:text-5xl lg:text-6xl mb-6 tracking-tight text-foreground leading-tight" data-testid="text-guide-title">
                  {guide.title}
                </h1>
                <div className="flex flex-wrap items-center justify-center lg:justify-start gap-4 text-muted-foreground font-medium">
                  <div className="flex items-center gap-2 bg-muted/40 px-3 py-1.5 rounded-full">
                    <User className="h-4 w-4 text-primary" />
                    <Link
                      href="/authors/carlos-rodriguez"
                      className="hover:text-primary transition-colors text-foreground text-sm"
                      data-testid="link-author"
                    >
                      Padel Racket Reviews
                    </Link>
                  </div>
                  <div className="flex items-center gap-2 text-sm">
                    <Calendar className="h-4 w-4 opacity-70" />
                    <time dateTime={guide.publishedAt.toString()} data-testid="text-publish-date">
                      {new Date(guide.publishedAt).toLocaleDateString("en-US", {
                        year: "numeric",
                        month: "long",
                        day: "numeric",
                      })}
                    </time>
                  </div>
                </div>
              </div>

              {/* Content */}
              <Card className="border-border/40 premium-shadow">
                <CardContent className="p-8 md:p-12 lg:p-16">
                  <article>
                    <div
                      className="prose prose-lg md:prose-xl max-w-none prose-headings:font-heading prose-headings:font-bold prose-h2:text-3xl prose-h2:mt-12 prose-h2:mb-6 prose-h3:text-2xl prose-h3:mt-8 prose-h3:mb-4 prose-p:leading-relaxed prose-p:text-muted-foreground prose-a:text-primary prose-a:font-semibold prose-a:no-underline hover:prose-a:text-emerald-500 hover:prose-a:underline prose-strong:font-bold prose-strong:text-foreground prose-img:rounded-2xl prose-img:shadow-xl prose-img:my-10 prose-img:object-cover prose-blockquote:border-l-4 prose-blockquote:border-primary prose-blockquote:pl-6 prose-blockquote:font-medium prose-blockquote:italic prose-blockquote:text-foreground/80 prose-li:text-muted-foreground"
                      dangerouslySetInnerHTML={{ __html: cleanedContent }}
                      data-testid="text-guide-content"
                    />
                  </article>
                </CardContent>
              </Card>
            </div>

            {/* Sidebar */}
            <aside className="lg:w-96 flex-shrink-0">
              <div className="sticky top-24 space-y-6">
                {/* Promotional Banner */}
                <Card className="bg-gradient-to-br from-primary/10 via-background to-background border-primary/20 premium-shadow relative overflow-hidden">
                  <div className="absolute top-0 right-0 w-32 h-32 bg-primary/20 blur-[50px] rounded-full pointer-events-none" />
                  <CardContent className="p-8 relative z-10">
                    <div className="flex items-start gap-4 mb-6">
                      <div className="p-3 bg-primary/10 rounded-xl">
                        <TrendingUp className="h-6 w-6 text-primary" />
                      </div>
                      <div className="flex-1">
                        <h3 className="font-heading font-bold text-2xl mb-2 leading-tight">Find Your Perfect Racket</h3>
                        <p className="text-sm text-muted-foreground leading-relaxed">
                          Browse our comprehensive collection of padel rackets with detailed reviews, ratings, and best prices.
                        </p>
                      </div>
                    </div>
                    <Link href="/rackets">
                      <Button className="w-full py-6 text-lg shadow-lg shadow-primary/20 hover:shadow-primary/40 hover:-translate-y-0.5 transition-all" size="lg">
                        Browse All Rackets
                        <ExternalLink className="ml-2 h-5 w-5" />
                      </Button>
                    </Link>
                  </CardContent>
                </Card>

                {/* Mentioned Rackets */}
                <MentionedRackets content={cleanedContent} variant="sidebar" />

                {/* Quick Links */}
                <Card>
                  <CardContent className="p-6">
                    <h3 className="font-semibold mb-4">Popular Guides</h3>
                    <div className="space-y-3">
                      <Link href="/guides" className="block">
                        <div className="text-sm hover:text-primary transition-colors">
                          <div className="font-medium">All Buying Guides</div>
                          <div className="text-muted-foreground text-xs mt-1">
                            Expert advice for every level
                          </div>
                        </div>
                      </Link>
                      {guide.category !== "beginners" && (
                        <Link href="/guides?category=beginners" className="block">
                          <div className="text-sm hover:text-primary transition-colors">
                            <div className="font-medium">Beginner Guides</div>
                            <div className="text-muted-foreground text-xs mt-1">
                              Perfect for new players
                            </div>
                          </div>
                        </Link>
                      )}
                      {guide.category !== "intermediate" && (
                        <Link href="/guides?category=intermediate" className="block">
                          <div className="text-sm hover:text-primary transition-colors">
                            <div className="font-medium">Intermediate Guides</div>
                            <div className="text-muted-foreground text-xs mt-1">
                              Level up your game
                            </div>
                          </div>
                        </Link>
                      )}
                    </div>
                  </CardContent>
                </Card>
              </div>
            </aside>
          </div>

          {/* Related Guides Section */}
          {relatedGuides && relatedGuides.length > 0 && (
            <div className="mt-16">
              <h2 className="font-heading font-bold text-3xl mb-8">Related Guides</h2>
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                {relatedGuides.map((relatedGuide) => (
                  <Link
                    key={relatedGuide.id}
                    href={`/guides/${relatedGuide.slug}`}
                    data-testid={`link-related-guide-${relatedGuide.id}`}
                  >
                    <Card className="h-full hover-elevate active-elevate-2 transition-all cursor-pointer">
                      <CardContent className="p-0">
                        {relatedGuide.featuredImage ? (
                          <div className="aspect-video w-full overflow-hidden">
                            <img
                              src={relatedGuide.featuredImage}
                              alt={`${relatedGuide.title} - Featured image`}
                              className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300"
                              loading="lazy"
                              data-testid={`img-related-guide-${relatedGuide.id}`}
                            />
                          </div>
                        ) : (
                          <div className="aspect-video w-full bg-muted" />
                        )}
                        <div className="p-6 space-y-3">
                          <Badge variant="secondary" className="capitalize">
                            {relatedGuide.category}
                          </Badge>
                          <h3 className="font-semibold text-xl line-clamp-2" data-testid={`text-related-guide-title-${relatedGuide.id}`}>
                            {relatedGuide.title}
                          </h3>
                          <p className="text-sm text-muted-foreground line-clamp-3">
                            {relatedGuide.excerpt}
                          </p>
                          <p className="text-xs text-muted-foreground">
                            {new Date(relatedGuide.publishedAt).toLocaleDateString("en-US", {
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
            </div>
          )}
        </div>
      </div>
    </>
  );
}
