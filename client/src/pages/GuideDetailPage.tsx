import { useRoute, Link } from "wouter";
import { useQuery } from "@tanstack/react-query";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { ArrowLeft, Calendar } from "lucide-react";
import type { Guide } from "@shared/schema";

export default function GuideDetailPage() {
  const [, params] = useRoute("/guides/:slug");
  const slug = params?.slug;

  const { data: guide, isLoading } = useQuery<Guide>({
    queryKey: ["/api/guides", slug],
    enabled: !!slug,
  });

  if (isLoading) {
    return (
      <div className="min-h-screen bg-background">
        <div className="max-w-4xl mx-auto px-6 py-8">
          <Skeleton className="h-10 w-32 mb-8" />
          <Skeleton className="h-64 w-full mb-8" />
          <Skeleton className="h-12 w-3/4 mb-4" />
          <Skeleton className="h-96 w-full" />
        </div>
      </div>
    );
  }

  if (!guide) {
    return (
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
    );
  }

  return (
    <div className="min-h-screen bg-background">
      <div className="max-w-4xl mx-auto px-6 py-8">
        {/* Back Button */}
        <Link href="/guides" data-testid="link-back-to-guides">
          <Button variant="ghost" className="mb-8 -ml-3" data-testid="button-back">
            <ArrowLeft className="mr-2 h-4 w-4" />
            Back to Guides
          </Button>
        </Link>

        {/* Featured Image */}
        {guide.featuredImage && (
          <div className="aspect-video w-full overflow-hidden rounded-lg mb-8">
            <img
              src={guide.featuredImage}
              alt={guide.title}
              className="w-full h-full object-cover"
              data-testid="img-guide-featured"
            />
          </div>
        )}

        {/* Header */}
        <div className="mb-8">
          <Badge variant="secondary" className="mb-4 capitalize" data-testid="badge-category">
            {guide.category}
          </Badge>
          <h1 className="font-heading font-bold text-4xl md:text-5xl mb-4" data-testid="text-guide-title">
            {guide.title}
          </h1>
          <div className="flex items-center gap-2 text-muted-foreground">
            <Calendar className="h-4 w-4" />
            <time dateTime={guide.publishedAt.toString()} data-testid="text-publish-date">
              {new Date(guide.publishedAt).toLocaleDateString("en-US", {
                year: "numeric",
                month: "long",
                day: "numeric",
              })}
            </time>
          </div>
        </div>

        {/* Content */}
        <Card>
          <CardContent className="p-8 md:p-12">
            <div
              className="prose prose-lg max-w-none"
              dangerouslySetInnerHTML={{ __html: guide.content }}
              data-testid="text-guide-content"
            />
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
