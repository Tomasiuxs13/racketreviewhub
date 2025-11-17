import { useRoute, Link } from "wouter";
import { useQuery } from "@tanstack/react-query";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { Calendar, User, Activity } from "lucide-react";
import type { Author, BlogPost, Racket as RacketType, Guide, Brand } from "@shared/schema";
import SEO from "@/components/SEO";
import { StructuredData } from "@/components/StructuredData";
import { Breadcrumbs } from "@/components/Breadcrumbs";
import { getRacketSlug } from "@/lib/utils";
import { SITE_URL } from "@/lib/seo";

type AuthorWithContent = Author & {
  blogPosts?: BlogPost[];
  guides?: Guide[];
  rackets?: RacketType[];
  brands?: Brand[];
};

export default function AuthorPage() {
  const [, params] = useRoute("/authors/:slug");
  const slug = params?.slug;

  const { data: authorData, isLoading } = useQuery<AuthorWithContent>({
    queryKey: [`/api/authors/${slug}`],
    enabled: !!slug,
  });

  const canonicalPath = authorData ? `/authors/${authorData.slug}` : "/authors";
  const seoData = {
    title: authorData
      ? `${authorData.name} - Padel Expert & Reviewer`
      : "Author Profile",
    description: authorData?.bio || "Expert padel equipment reviewer and writer",
    url: canonicalPath,
    canonical: canonicalPath,
    type: "profile" as const,
  };

  // Structured data
  const structuredData = authorData
    ? {
        "@context": "https://schema.org",
        "@type": "Person",
        name: authorData.name,
        description: authorData.bio,
        image: authorData.avatarUrl,
        url: `${SITE_URL}${canonicalPath}`,
      }
    : null;

  const seoElement = <SEO {...seoData} />;

  if (isLoading) {
    return (
      <>
        {seoElement}
        <div className="min-h-screen bg-background">
        <div className="max-w-7xl mx-auto px-6 py-8">
          <Skeleton className="h-10 w-32 mb-8" />
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
            <div className="lg:col-span-1">
              <Skeleton className="h-64 w-full" />
            </div>
            <div className="lg:col-span-2 space-y-6">
              <Skeleton className="h-12 w-3/4" />
              <Skeleton className="h-32 w-full" />
            </div>
          </div>
        </div>
      </div>
      </>
    );
  }

  if (!authorData) {
    return (
      <>
        {seoElement}
        <div className="min-h-screen bg-background flex items-center justify-center">
        <Card>
          <CardContent className="p-12 text-center">
            <p className="text-muted-foreground mb-4">Author not found</p>
            <Link href="/blog">
              <button className="text-primary hover:underline">Back to Blog</button>
            </Link>
          </CardContent>
        </Card>
      </div>
      </>
    );
  }

  const blogPosts = authorData.blogPosts || [];
  const guides = authorData.guides || [];
  const rackets = authorData.rackets || [];
  const brands = authorData.brands || [];

  return (
    <>
      {seoElement}
      {structuredData && <StructuredData data={structuredData} />}
      <div className="min-h-screen bg-background">
        <div className="max-w-7xl mx-auto px-6 py-8">
          {/* Breadcrumbs */}
          <Breadcrumbs
            items={[
              { label: "Authors", href: "/authors" },
              { label: authorData.name },
            ]}
          />

          {/* Author Header */}
          <div className="mb-12">
            <div className="flex flex-col md:flex-row gap-8 items-start md:items-center mb-8">
              {/* Author Avatar */}
              <div className="flex-shrink-0">
                {authorData.avatarUrl ? (
                  <div className="w-24 h-24 rounded-full overflow-hidden">
                    <img
                      src={authorData.avatarUrl}
                      alt={authorData.name}
                      className="w-full h-full object-cover"
                    />
                  </div>
                ) : (
                  <div className="w-24 h-24 rounded-full bg-muted flex items-center justify-center">
                    <User className="h-12 w-12 text-muted-foreground" />
                  </div>
                )}
              </div>
              
              {/* Author Info */}
              <div className="flex-1">
                <h1 className="font-heading font-bold text-4xl md:text-5xl mb-3">
                  {authorData.name}
                </h1>
                {authorData.bio && (
                  <p className="text-muted-foreground text-lg leading-relaxed max-w-2xl">
                    {authorData.bio}
                  </p>
                )}
              </div>
            </div>

            {/* Stats */}
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
              <Card>
                <CardContent className="p-4 text-center">
                  <div className="text-2xl md:text-3xl font-bold text-primary mb-1">
                    {blogPosts.length}
                  </div>
                  <div className="text-xs md:text-sm text-muted-foreground">Articles</div>
                </CardContent>
              </Card>
              <Card>
                <CardContent className="p-4 text-center">
                  <div className="text-2xl md:text-3xl font-bold text-primary mb-1">
                    {guides.length}
                  </div>
                  <div className="text-xs md:text-sm text-muted-foreground">Guides</div>
                </CardContent>
              </Card>
              <Card>
                <CardContent className="p-4 text-center">
                  <div className="text-2xl md:text-3xl font-bold text-primary mb-1">
                    {rackets.length}
                  </div>
                  <div className="text-xs md:text-sm text-muted-foreground">Reviews</div>
                </CardContent>
              </Card>
              <Card>
                <CardContent className="p-4 text-center">
                  <div className="text-2xl md:text-3xl font-bold text-primary mb-1">
                    {brands.length}
                  </div>
                  <div className="text-xs md:text-sm text-muted-foreground">Brands</div>
                </CardContent>
              </Card>
            </div>
          </div>

          {/* Articles Section */}
          {blogPosts.length > 0 && (
            <div className="mb-12">
              <h2 className="font-heading font-semibold text-3xl mb-6">Articles</h2>
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                {blogPosts.map((post) => (
                  <Link key={post.id} href={`/blog/${post.slug}`}>
                    <Card className="h-full hover-elevate active-elevate-2 transition-all cursor-pointer">
                      <CardContent className="p-0">
                        {post.featuredImage ? (
                          <div className="aspect-video w-full overflow-hidden">
                            <img
                              src={post.featuredImage}
                              alt={post.title}
                              className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300"
                              loading="lazy"
                            />
                          </div>
                        ) : (
                          <div className="aspect-video w-full bg-muted" />
                        )}
                        <div className="p-6 space-y-3">
                          <h3 className="font-semibold text-xl line-clamp-2">
                            {post.title}
                          </h3>
                          <p className="text-sm text-muted-foreground line-clamp-3">
                            {post.excerpt}
                          </p>
                          <div className="flex items-center gap-2 text-xs text-muted-foreground pt-2 border-t">
                            <Calendar className="h-3 w-3" />
                            <time dateTime={post.publishedAt.toString()}>
                              {new Date(post.publishedAt).toLocaleDateString("en-US", {
                                month: "short",
                                day: "numeric",
                                year: "numeric",
                              })}
                            </time>
                          </div>
                        </div>
                      </CardContent>
                    </Card>
                  </Link>
                ))}
              </div>
            </div>
          )}

          {/* Guides Section */}
          {guides.length > 0 && (
            <div className="mb-12">
              <h2 className="font-heading font-semibold text-3xl mb-6">Guides</h2>
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                {guides.map((guide) => (
                  <Link key={guide.id} href={`/guides/${guide.slug}`}>
                    <Card className="h-full hover-elevate active-elevate-2 transition-all cursor-pointer">
                      <CardContent className="p-0">
                        {guide.featuredImage ? (
                          <div className="aspect-video w-full overflow-hidden">
                            <img
                              src={guide.featuredImage}
                              alt={guide.title}
                              className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300"
                              loading="lazy"
                            />
                          </div>
                        ) : (
                          <div className="aspect-video w-full bg-muted" />
                        )}
                        <div className="p-6 space-y-3">
                          <Badge variant="secondary" className="capitalize">
                            {guide.category}
                          </Badge>
                          <h3 className="font-semibold text-xl line-clamp-2">
                            {guide.title}
                          </h3>
                          <p className="text-sm text-muted-foreground line-clamp-3">
                            {guide.excerpt}
                          </p>
                          <div className="flex items-center gap-2 text-xs text-muted-foreground pt-2 border-t">
                            <Calendar className="h-3 w-3" />
                            <time dateTime={guide.publishedAt.toString()}>
                              {new Date(guide.publishedAt).toLocaleDateString("en-US", {
                                month: "short",
                                day: "numeric",
                                year: "numeric",
                              })}
                            </time>
                          </div>
                        </div>
                      </CardContent>
                    </Card>
                  </Link>
                ))}
              </div>
            </div>
          )}

          {/* Reviews Section */}
          {rackets.length > 0 && (
            <div>
              <h2 className="font-heading font-semibold text-3xl mb-6">Racket Reviews</h2>
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6">
                {rackets.map((racket) => (
                  <Link
                    key={racket.id}
                    href={`/rackets/${getRacketSlug(racket)}`}
                  >
                    <Card className="h-full hover-elevate active-elevate-2 transition-all cursor-pointer">
                      <CardContent className="p-4">
                        <div className="aspect-square mb-3 flex items-center justify-center">
                          {racket.imageUrl ? (
                            <img
                              src={racket.imageUrl}
                              alt={`${racket.brand} ${racket.model}`}
                              className="max-w-full max-h-full object-contain"
                              loading="lazy"
                            />
                          ) : (
                            <div className="w-full h-full bg-muted rounded-md flex items-center justify-center">
                              <Activity className="h-12 w-12 text-muted-foreground" />
                            </div>
                          )}
                        </div>
                        <Badge className="mb-2">{racket.brand}</Badge>
                        <h3 className="font-semibold line-clamp-2 mb-2">
                          {racket.model}
                        </h3>
                        <div className="flex items-center justify-between">
                          <p className="text-lg font-bold">
                            €{Number(racket.currentPrice).toFixed(0)}
                          </p>
                          <Badge variant="secondary" className="text-xs">
                            {racket.overallRating}/100
                          </Badge>
                        </div>
                      </CardContent>
                    </Card>
                  </Link>
                ))}
              </div>
            </div>
          )}

          {/* Brands Section */}
          {brands.length > 0 && (
            <div className="mb-12">
              <h2 className="font-heading font-semibold text-3xl mb-6">Brand Pages</h2>
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                {brands.map((brand) => (
                  <Link key={brand.id} href={`/brands/${brand.slug}`}>
                    <Card className="h-full hover-elevate active-elevate-2 transition-all cursor-pointer">
                      <CardContent className="p-6">
                        {brand.logoUrl && (
                          <div className="aspect-video w-full mb-4 flex items-center justify-center">
                            <img
                              src={brand.logoUrl}
                              alt={`${brand.name} logo`}
                              className="max-w-full max-h-full object-contain"
                              loading="lazy"
                            />
                          </div>
                        )}
                        <h3 className="font-semibold text-xl mb-2">
                          {brand.name}
                        </h3>
                        <p className="text-sm text-muted-foreground line-clamp-3">
                          {brand.description}
                        </p>
                      </CardContent>
                    </Card>
                  </Link>
                ))}
              </div>
            </div>
          )}

          {/* Empty State */}
          {blogPosts.length === 0 && guides.length === 0 && rackets.length === 0 && brands.length === 0 && (
            <Card>
              <CardContent className="p-12 text-center">
                <p className="text-muted-foreground">
                  No articles, guides, reviews, or brand pages yet from {authorData.name}.
                </p>
              </CardContent>
            </Card>
          )}
        </div>
      </div>
    </>
  );
}

