import { Link } from "wouter";
import { useQuery } from "@tanstack/react-query";
import { useLocalizedQuery } from "@/hooks/useLocalizedQuery";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { Calendar, User } from "lucide-react";
import type { BlogPost, Author } from "@shared/schema";
import SEO from "@/components/SEO";
import { StructuredData } from "@/components/StructuredData";
import { Breadcrumbs } from "@/components/Breadcrumbs";
import { useMemo } from "react";
import { SITE_URL } from "@/lib/seo";

export default function BlogPage() {
  const { data: posts, isLoading, error } = useLocalizedQuery<BlogPost[]>({
    queryKey: ["/api/blog"],
  });

  // Fetch authors to map authorIds
  const { data: authors } = useQuery<Author[]>({
    queryKey: ["/api/authors"],
  });

  const postsWithSlugs = useMemo(
    () => {
      if (!posts) return [];
      return posts.filter((post) => Boolean(post?.slug?.trim()));
    },
    [posts],
  );

  // SEO data
  const seoData = {
    title: "Padel Blog - News, Tips & Insights",
    description:
      "Latest news, tips, and insights from the padel world. Expert advice, equipment reviews, and buying guides to help you improve your game.",
    url: "/blog",
    canonical: "/blog",
  };

  // Structured data
  const structuredData = useMemo(() => {
    const siteUrl = SITE_URL;
    const schemas = [];

    // CollectionPage schema
    schemas.push({
      "@context": "https://schema.org",
      "@type": "CollectionPage",
      "name": "Padel Blog",
      "description": seoData.description,
      "url": seoData.canonical,
    });

    // ItemList schema for blog posts
    if (postsWithSlugs.length > 0) {
      schemas.push({
        "@context": "https://schema.org",
        "@type": "ItemList",
        "itemListElement": postsWithSlugs.slice(0, 20).map((post, index) => ({
          "@type": "ListItem",
          "position": index + 1,
          "item": {
            "@type": "BlogPosting",
            "headline": post.title,
            "description": post.excerpt,
            "url": `${siteUrl}/blog/${post.slug}`,
            "image": post.featuredImage || undefined,
            "datePublished": new Date(post.publishedAt).toISOString(),
            "dateModified": new Date(post.updatedAt).toISOString(),
            "author": {
              "@type": "Person",
              "name": post.author,
            },
            "publisher": {
              "@type": "Organization",
              "name": "Padel Racket Reviews",
            },
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
          "name": "Blog",
          "item": `${siteUrl}${seoData.canonical}`,
        },
      ],
    });

    return schemas;
  }, [postsWithSlugs, seoData.canonical, seoData.description]);

  return (
    <>
      <SEO {...seoData} />
      <StructuredData data={structuredData} />
      <div className="min-h-screen bg-background">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 py-8 sm:py-10">
          {/* Breadcrumbs */}
          <Breadcrumbs items={[{ label: "Blog" }]} />

          {/* Header */}
          <div className="mb-8">
          <h1 className="font-heading font-bold text-3xl sm:text-4xl md:text-5xl mb-3" data-testid="text-page-title">
            Blog
          </h1>
          <p className="text-muted-foreground text-base sm:text-lg">
            Latest news, tips, and insights from the padel world
          </p>
        </div>

        {/* Blog Posts Grid */}
        {isLoading ? (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {Array.from({ length: 6 }).map((_, i) => (
              <Card key={i}>
                <CardContent className="p-0">
                  <Skeleton className="aspect-video w-full" />
                  <div className="p-6 space-y-3">
                    <Skeleton className="h-6 w-full" />
                    <Skeleton className="h-20 w-full" />
                    <Skeleton className="h-4 w-32" />
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
        ) : postsWithSlugs.length > 0 ? (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {postsWithSlugs.map((post) => (
              <Link key={post.id} href={`/blog/${post.slug}`} data-testid={`link-post-${post.id}`}>
                <Card className="h-full hover-elevate active-elevate-2 transition-all cursor-pointer" data-testid={`card-post-${post.id}`}>
                  <CardContent className="p-0">
                    {post.featuredImage ? (
                      <div className="aspect-video w-full overflow-hidden">
                        <img
                          src={post.featuredImage}
                          alt={post.title}
                          className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300"
                          loading="lazy"
                          data-testid={`img-post-${post.id}`}
                        />
                      </div>
                    ) : (
                      <div className="aspect-video w-full bg-muted" />
                    )}
                    <div className="p-6 space-y-3">
                      <h3 className="font-semibold text-xl line-clamp-2" data-testid={`text-post-title-${post.id}`}>
                        {post.title}
                      </h3>
                      <p className="text-sm text-muted-foreground line-clamp-3">
                        {post.excerpt}
                      </p>
                      <div className="flex items-center gap-4 text-xs text-muted-foreground pt-2 border-t">
                        <div className="flex items-center gap-1">
                          <User className="h-3 w-3" />
                          {post.authorId && authors ? (
                            (() => {
                              const author = authors.find((a) => a.id === post.authorId);
                              return author ? (
                                <Link
                                  href={`/authors/${author.slug}`}
                                  className="hover:text-primary hover:underline transition-colors"
                                  onClick={(e) => e.stopPropagation()}
                                >
                                  {author.name}
                                </Link>
                              ) : (
                                <span>{post.author || "Padel Racket Reviews"}</span>
                              );
                            })()
                          ) : (
                            <span>{post.author || "Padel Racket Reviews"}</span>
                          )}
                        </div>
                        <div className="flex items-center gap-1">
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
                    </div>
                  </CardContent>
                </Card>
              </Link>
            ))}
          </div>
        ) : error ? (
          <Card>
            <CardContent className="flex flex-col items-center justify-center py-16">
              <p className="text-muted-foreground text-center">
                Error loading blog posts. Please try again later.
              </p>
            </CardContent>
          </Card>
        ) : (
          <Card>
            <CardContent className="flex flex-col items-center justify-center py-16">
              <p className="text-muted-foreground text-center">
                {postsWithSlugs.length === 0 
                  ? "No blog posts available yet. Check back soon!"
                  : `No blog posts found. ${postsWithSlugs.length} post(s) available.`}
              </p>
            </CardContent>
          </Card>
        )}
        </div>
      </div>
    </>
  );
}
