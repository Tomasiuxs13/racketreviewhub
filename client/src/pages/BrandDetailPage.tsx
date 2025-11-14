import { useRoute, Link } from "wouter";
import { useQuery } from "@tanstack/react-query";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { RacketCard } from "@/components/RacketCard";
import { ArrowLeft } from "lucide-react";
import type { Brand, Racket } from "@shared/schema";

export default function BrandDetailPage() {
  const [, params] = useRoute("/brands/:slug");
  const slug = params?.slug;

  const { data: brand, isLoading: brandLoading } = useQuery<Brand>({
    queryKey: [`/api/brands/${slug}`],
    enabled: !!slug,
  });

  const { data: topRackets, isLoading: racketsLoading } = useQuery<Racket[]>({
    queryKey: [`/api/brands/${slug}/rackets`],
    enabled: !!slug,
  });

  if (brandLoading) {
    return (
      <div className="min-h-screen bg-background">
        <div className="max-w-7xl mx-auto px-6 py-8">
          <Skeleton className="h-10 w-32 mb-8" />
          <Skeleton className="h-32 w-full mb-8" />
          <Skeleton className="h-96 w-full" />
        </div>
      </div>
    );
  }

  if (!brand) {
    return (
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
    );
  }

  return (
    <div className="min-h-screen bg-background">
      <div className="max-w-7xl mx-auto px-6 py-8">
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
                  data-testid="img-brand-logo"
                />
              </div>
            )}
            <div>
              <h1 className="font-heading font-bold text-4xl md:text-5xl mb-2" data-testid="text-brand-name">
                {brand.name}
              </h1>
              <p className="text-muted-foreground text-lg">
                {brand.description}
              </p>
            </div>
          </div>
        </div>

        {/* Brand Article */}
        {brand.articleContent && (
          <Card className="mb-12">
            <CardContent className="p-8 md:p-12">
              <h2 className="font-heading font-semibold text-3xl mb-6">About {brand.name}</h2>
              <div
                className="prose prose-lg max-w-none"
                dangerouslySetInnerHTML={{ __html: brand.articleContent }}
                data-testid="text-brand-article"
              />
            </CardContent>
          </Card>
        )}

        {/* Top Rackets from Brand */}
        <div>
          <h2 className="font-heading font-semibold text-3xl mb-6" data-testid="text-top-rackets-title">
            Top Rackets from {brand.name}
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
          ) : topRackets && topRackets.length > 0 ? (
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6">
              {topRackets.map((racket) => (
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
      </div>
    </div>
  );
}
