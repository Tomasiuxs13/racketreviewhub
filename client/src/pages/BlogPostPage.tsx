import { useRoute, Link } from "wouter";
import { useQuery } from "@tanstack/react-query";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { ArrowLeft, Calendar, User } from "lucide-react";
import type { BlogPost, Author } from "@shared/schema";
import SEO from "@/components/SEO";
import { StructuredData } from "@/components/StructuredData";
import { PromotionalBanner } from "@/components/PromotionalBanner";
import { MentionedRackets } from "@/components/MentionedRackets";
import { SITE_URL } from "@/lib/seo";

export default function BlogPostPage() {
  const [, params] = useRoute("/blog/:slug");
  const slug = params?.slug;

  const { data: post, isLoading } = useQuery<BlogPost>({
    queryKey: [`/api/blog/${slug}`],
    enabled: !!slug,
  });

  // Fetch author if authorId exists
  const { data: authors } = useQuery<Author[]>({
    queryKey: ["/api/authors"],
    enabled: !!post?.authorId,
  });

  const author = post?.authorId
    ? authors?.find((a) => a.id === post.authorId)
    : null;

  const canonicalPath = post ? `/blog/${post.slug}` : "/blog";
  const seoData = {
    title: post?.title,
    description: post?.excerpt,
    image: post?.featuredImage,
    url: canonicalPath,
    canonical: canonicalPath,
    type: "article" as const,
    author: post?.author,
    publishedTime: post?.publishedAt ? new Date(post.publishedAt).toISOString() : undefined,
    modifiedTime: post?.updatedAt ? new Date(post.updatedAt).toISOString() : undefined,
  };

  // Structured Data for Article
  const articleStructuredData = post
    ? {
        "@context": "https://schema.org",
        "@type": "BlogPosting",
        headline: post.title,
        description: post.excerpt,
        image: post.featuredImage ? [post.featuredImage] : [],
        datePublished: new Date(post.publishedAt).toISOString(),
        dateModified: new Date(post.updatedAt).toISOString(),
        author: {
          "@type": "Person",
          name: post.author,
        },
        publisher: {
          "@type": "Organization",
          name: "Padel Racket Reviews",
        },
        mainEntityOfPage: {
          "@type": "WebPage",
          "@id": `${SITE_URL}${canonicalPath}`,
        },
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
          <div className="grid grid-cols-1 lg:grid-cols-12 gap-8">
            <div className="lg:col-span-8 space-y-8">
              <Skeleton className="h-64 w-full" />
              <Skeleton className="h-12 w-3/4" />
              <Skeleton className="h-96 w-full" />
            </div>
            <div className="lg:col-span-4">
              <Skeleton className="h-64 w-full" />
            </div>
          </div>
        </div>
      </div>
      </>
    );
  }

  if (!post) {
    return (
      <>
        {seoElement}
        <div className="min-h-screen bg-background flex items-center justify-center">
        <Card>
          <CardContent className="p-12 text-center">
            <p className="text-muted-foreground mb-4">Blog post not found</p>
            <Link href="/blog">
              <Button>Back to Blog</Button>
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
      {/* Structured Data */}
      {articleStructuredData && <StructuredData data={articleStructuredData} />}

      <div className="min-h-screen bg-background">
        <div className="max-w-7xl mx-auto px-6 py-8">
          {/* Back Button */}
          <Link href="/blog" data-testid="link-back-to-blog">
            <Button variant="ghost" className="mb-8 -ml-3" data-testid="button-back">
              <ArrowLeft className="mr-2 h-4 w-4" />
              Back to Blog
            </Button>
          </Link>

          {/* Main Content Layout with Sidebar */}
          <div className="grid grid-cols-1 lg:grid-cols-12 gap-8">
            {/* Main Content */}
            <article className="lg:col-span-8">
              {/* Featured Image */}
              {post.featuredImage && (
                <div className="aspect-video w-full overflow-hidden rounded-lg mb-8">
                  <img
                    src={post.featuredImage}
                    alt={post.title}
                    className="w-full h-full object-cover"
                    loading="lazy"
                    decoding="async"
                    data-testid="img-post-featured"
                  />
                </div>
              )}

              {/* Header */}
              <header className="mb-8">
                <h1 className="font-heading font-bold text-4xl md:text-5xl mb-4" data-testid="text-post-title">
                  {post.title}
                </h1>
                <div className="flex flex-wrap items-center gap-4 text-muted-foreground">
                  <div className="flex items-center gap-2">
                    <User className="h-4 w-4" />
                    {author ? (
                      <Link
                        href={`/authors/${author.slug}`}
                        className="hover:text-primary hover:underline transition-colors"
                        data-testid="link-author"
                      >
                        {author.name}
                      </Link>
                    ) : (
                      <span data-testid="text-author">{post.author || "Padel Racket Reviews"}</span>
                    )}
                  </div>
                  <div className="flex items-center gap-2">
                    <Calendar className="h-4 w-4" />
                    <time dateTime={post.publishedAt.toString()} data-testid="text-publish-date">
                      {new Date(post.publishedAt).toLocaleDateString("en-US", {
                        year: "numeric",
                        month: "long",
                        day: "numeric",
                      })}
                    </time>
                  </div>
                </div>
              </header>

              {/* Content */}
              <Card>
                <CardContent className="p-8 md:p-12">
                  <div
                    className="prose prose-lg max-w-none prose-headings:font-heading prose-a:text-primary prose-a:no-underline hover:prose-a:underline prose-strong:font-semibold prose-img:rounded-lg prose-img:shadow-md"
                    dangerouslySetInnerHTML={{ __html: post.content }}
                    data-testid="text-post-content"
                  />
                  <MentionedRackets content={post.content} />
                </CardContent>
              </Card>
            </article>

            {/* Sidebar */}
            <aside className="lg:col-span-4">
              <div className="sticky top-8 space-y-6">
                {/* Promotional Banner */}
                <PromotionalBanner />

                {/* Additional Sidebar Content can be added here */}
              </div>
            </aside>
          </div>
        </div>
      </div>
    </>
  );
}
