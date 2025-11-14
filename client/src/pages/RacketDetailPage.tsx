import { useRoute, Link } from "wouter";
import { useQuery } from "@tanstack/react-query";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { RatingMetrics } from "@/components/RatingBar";
import { ArrowLeft, ExternalLink } from "lucide-react";
import type { Racket } from "@shared/schema";

export default function RacketDetailPage() {
  const [, params] = useRoute("/rackets/:id");
  const racketId = params?.id;

  const { data: racket, isLoading } = useQuery<Racket>({
    queryKey: ["/api/rackets", racketId],
    enabled: !!racketId,
  });

  const { data: relatedRackets } = useQuery<Racket[]>({
    queryKey: ["/api/rackets/related", racketId],
    enabled: !!racketId && !!racket,
  });

  if (isLoading) {
    return (
      <div className="min-h-screen bg-background">
        <div className="max-w-7xl mx-auto px-6 py-8">
          <Skeleton className="h-10 w-32 mb-8" />
          <div className="grid lg:grid-cols-2 gap-12">
            <Skeleton className="aspect-square w-full" />
            <div className="space-y-6">
              <Skeleton className="h-12 w-3/4" />
              <Skeleton className="h-48 w-full" />
              <Skeleton className="h-16 w-full" />
            </div>
          </div>
        </div>
      </div>
    );
  }

  if (!racket) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <Card>
          <CardContent className="p-12 text-center">
            <p className="text-muted-foreground mb-4">Racket not found</p>
            <Link href="/rackets">
              <Button>Back to Rackets</Button>
            </Link>
          </CardContent>
        </Card>
      </div>
    );
  }

  const discountPercentage = racket.originalPrice
    ? Math.round(((Number(racket.originalPrice) - Number(racket.currentPrice)) / Number(racket.originalPrice)) * 100)
    : 0;

  return (
    <div className="min-h-screen bg-background">
      <div className="max-w-7xl mx-auto px-6 py-8">
        {/* Back Button */}
        <Link href="/rackets" data-testid="link-back-to-rackets">
          <Button variant="ghost" className="mb-8 -ml-3" data-testid="button-back">
            <ArrowLeft className="mr-2 h-4 w-4" />
            Back to Rackets
          </Button>
        </Link>

        {/* Main Content */}
        <div className="grid lg:grid-cols-5 gap-12 mb-16">
          {/* Image */}
          <div className="lg:col-span-3">
            <Card>
              <CardContent className="p-12">
                <div className="aspect-square flex items-center justify-center">
                  {racket.imageUrl ? (
                    <img
                      src={racket.imageUrl}
                      alt={`${racket.brand} ${racket.model}`}
                      className="max-w-full max-h-full object-contain"
                      data-testid="img-racket-detail"
                    />
                  ) : (
                    <div className="w-full h-full flex items-center justify-center bg-muted rounded-md">
                      <span className="text-muted-foreground">No image available</span>
                    </div>
                  )}
                </div>
              </CardContent>
            </Card>
          </div>

          {/* Specs & Purchase */}
          <div className="lg:col-span-2 space-y-6">
            {/* Title & Brand */}
            <div>
              <div className="flex items-center gap-2 mb-2">
                <Badge data-testid="badge-brand">{racket.brand}</Badge>
                <Badge variant="secondary">{racket.year}</Badge>
                {racket.year >= new Date().getFullYear() && (
                  <Badge variant="outline">New</Badge>
                )}
              </div>
              <h1 className="font-heading font-bold text-4xl mb-2" data-testid="text-racket-title">
                {racket.model}
              </h1>
              <p className="text-muted-foreground capitalize">
                {racket.shape} shape
              </p>
            </div>

            {/* Overall Rating */}
            <Card className="bg-primary/5 border-primary/20">
              <CardContent className="p-6 text-center">
                <p className="text-sm text-muted-foreground mb-2">Overall Rating</p>
                <div className="text-5xl font-bold text-primary" data-testid="text-overall-rating">
                  {racket.overallRating}
                </div>
                <p className="text-xs text-muted-foreground mt-1">out of 100</p>
              </CardContent>
            </Card>

            {/* Performance Ratings */}
            <Card>
              <CardContent className="p-6">
                <h3 className="font-semibold mb-4">Performance Metrics</h3>
                <RatingMetrics
                  power={racket.powerRating}
                  control={racket.controlRating}
                  rebound={racket.reboundRating}
                  maneuverability={racket.maneuverabilityRating}
                  sweetSpot={racket.sweetSpotRating}
                />
              </CardContent>
            </Card>

            {/* Price & CTA */}
            <Card className="border-2 border-primary/20">
              <CardContent className="p-6 space-y-4">
                <div>
                  <p className="text-sm text-muted-foreground mb-2">Price</p>
                  <div className="flex items-baseline gap-3">
                    {racket.originalPrice && Number(racket.originalPrice) > Number(racket.currentPrice) && (
                      <>
                        <span className="text-lg text-muted-foreground line-through">
                          €{Number(racket.originalPrice).toFixed(0)}
                        </span>
                        <Badge variant="destructive">
                          Save {discountPercentage}%
                        </Badge>
                      </>
                    )}
                  </div>
                  <div className="text-4xl font-bold mt-2" data-testid="text-price">
                    €{Number(racket.currentPrice).toFixed(0)}
                  </div>
                </div>

                {racket.affiliateLink ? (
                  <Button
                    asChild
                    size="lg"
                    className="w-full"
                    data-testid="button-buy-now"
                  >
                    <a href={racket.affiliateLink} target="_blank" rel="noopener noreferrer">
                      Buy Now
                      <ExternalLink className="ml-2 h-4 w-4" />
                    </a>
                  </Button>
                ) : (
                  <Button size="lg" className="w-full" disabled>
                    Not Available
                  </Button>
                )}

                <p className="text-xs text-muted-foreground text-center">
                  As an Amazon Associate, we earn from qualifying purchases
                </p>
              </CardContent>
            </Card>
          </div>
        </div>

        {/* Tabs */}
        <Tabs defaultValue="review" className="mb-16">
          <TabsList className="grid w-full max-w-md grid-cols-2">
            <TabsTrigger value="review" data-testid="tab-review">Full Review</TabsTrigger>
            <TabsTrigger value="specs" data-testid="tab-specs">Specifications</TabsTrigger>
          </TabsList>

          <TabsContent value="review" className="mt-8">
            <Card>
              <CardContent className="p-8 prose prose-lg max-w-none">
                {racket.reviewContent ? (
                  <div dangerouslySetInnerHTML={{ __html: racket.reviewContent }} data-testid="text-review-content" />
                ) : (
                  <p className="text-muted-foreground">
                    Full review coming soon for the {racket.brand} {racket.model}.
                  </p>
                )}
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="specs" className="mt-8">
            <Card>
              <CardContent className="p-8">
                <dl className="grid grid-cols-1 md:grid-cols-2 gap-6">
                  <div>
                    <dt className="text-sm font-medium text-muted-foreground mb-1">Brand</dt>
                    <dd className="text-lg" data-testid="spec-brand">{racket.brand}</dd>
                  </div>
                  <div>
                    <dt className="text-sm font-medium text-muted-foreground mb-1">Model</dt>
                    <dd className="text-lg" data-testid="spec-model">{racket.model}</dd>
                  </div>
                  <div>
                    <dt className="text-sm font-medium text-muted-foreground mb-1">Year</dt>
                    <dd className="text-lg" data-testid="spec-year">{racket.year}</dd>
                  </div>
                  <div>
                    <dt className="text-sm font-medium text-muted-foreground mb-1">Shape</dt>
                    <dd className="text-lg capitalize" data-testid="spec-shape">{racket.shape}</dd>
                  </div>
                  <div>
                    <dt className="text-sm font-medium text-muted-foreground mb-1">Power Rating</dt>
                    <dd className="text-lg" data-testid="spec-power">{racket.powerRating}/100</dd>
                  </div>
                  <div>
                    <dt className="text-sm font-medium text-muted-foreground mb-1">Control Rating</dt>
                    <dd className="text-lg" data-testid="spec-control">{racket.controlRating}/100</dd>
                  </div>
                  <div>
                    <dt className="text-sm font-medium text-muted-foreground mb-1">Rebound Rating</dt>
                    <dd className="text-lg" data-testid="spec-rebound">{racket.reboundRating}/100</dd>
                  </div>
                  <div>
                    <dt className="text-sm font-medium text-muted-foreground mb-1">Maneuverability</dt>
                    <dd className="text-lg" data-testid="spec-maneuverability">{racket.maneuverabilityRating}/100</dd>
                  </div>
                  <div>
                    <dt className="text-sm font-medium text-muted-foreground mb-1">Sweet Spot</dt>
                    <dd className="text-lg" data-testid="spec-sweetspot">{racket.sweetSpotRating}/100</dd>
                  </div>
                  <div>
                    <dt className="text-sm font-medium text-muted-foreground mb-1">Overall Rating</dt>
                    <dd className="text-lg font-bold text-primary" data-testid="spec-overall">{racket.overallRating}/100</dd>
                  </div>
                </dl>
              </CardContent>
            </Card>
          </TabsContent>
        </Tabs>

        {/* Related Rackets */}
        {relatedRackets && relatedRackets.length > 0 && (
          <div>
            <h2 className="font-heading font-semibold text-3xl mb-6">Related Rackets</h2>
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6">
              {relatedRackets.slice(0, 4).map((relatedRacket) => (
                <Link key={relatedRacket.id} href={`/rackets/${relatedRacket.id}`} data-testid={`link-related-racket-${relatedRacket.id}`}>
                  <Card className="h-full hover-elevate active-elevate-2 transition-all cursor-pointer" data-testid={`card-related-racket-${relatedRacket.id}`}>
                    <CardContent className="p-4">
                      <div className="aspect-square mb-3 flex items-center justify-center">
                        {relatedRacket.imageUrl ? (
                          <img
                            src={relatedRacket.imageUrl}
                            alt={`${relatedRacket.brand} ${relatedRacket.model}`}
                            className="max-w-full max-h-full object-contain"
                          />
                        ) : (
                          <div className="w-full h-full bg-muted rounded-md" />
                        )}
                      </div>
                      <Badge className="mb-2">{relatedRacket.brand}</Badge>
                      <h3 className="font-semibold line-clamp-2 mb-2">
                        {relatedRacket.model}
                      </h3>
                      <p className="text-lg font-bold">
                        €{Number(relatedRacket.currentPrice).toFixed(0)}
                      </p>
                    </CardContent>
                  </Card>
                </Link>
              ))}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
