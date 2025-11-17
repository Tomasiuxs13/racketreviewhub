import { Link } from "wouter";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { RatingMetrics } from "./RatingBar";
import { ExternalLink } from "lucide-react";
import type { Racket } from "@shared/schema";
import { getRacketSlug } from "@/lib/utils";

interface RacketCardProps {
  racket: Racket;
}

export function RacketCard({ racket }: RacketCardProps) {
  const discountPercentage = racket.originalPrice
    ? Math.round(((Number(racket.originalPrice) - Number(racket.currentPrice)) / Number(racket.originalPrice)) * 100)
    : 0;

  const getRatingColor = (rating: number) => {
    if (rating >= 85) return "text-primary";
    if (rating >= 75) return "text-chart-2";
    return "text-muted-foreground";
  };

  return (
    <Link href={`/rackets/${getRacketSlug(racket)}`} data-testid={`link-racket-${racket.id}`}>
      <Card className="group overflow-hidden hover-elevate active-elevate-2 transition-all duration-300 h-full cursor-pointer" data-testid={`card-racket-${racket.id}`}>
        <CardContent className="p-0">
          {/* Image Container */}
          <div className="relative aspect-square bg-card overflow-hidden">
            <div className="absolute inset-0 flex items-center justify-center p-4">
              {racket.imageUrl ? (
                <img
                  src={racket.imageUrl}
                  alt={`${racket.brand} ${racket.model}`}
                  className="w-full h-full object-contain group-hover:scale-105 transition-transform duration-300"
                  loading="lazy"
                  data-testid={`img-racket-${racket.id}`}
                />
              ) : (
                <div className="w-full h-full flex items-center justify-center bg-muted rounded-md">
                  <span className="text-muted-foreground text-sm">No image</span>
                </div>
              )}
            </div>

            {/* Overall Rating Badge */}
            <div className="absolute top-3 right-3">
              <div className={`w-12 h-12 rounded-full bg-background/90 backdrop-blur-sm border-2 border-primary flex items-center justify-center ${getRatingColor(racket.overallRating)}`}>
                <span className="text-xl font-bold" data-testid={`text-overall-rating-${racket.id}`}>
                  {racket.overallRating}
                </span>
              </div>
            </div>

            {/* Year Ribbon */}
            {racket.year >= new Date().getFullYear() && (
              <div className="absolute top-4 -left-5 z-10 -rotate-45">
                <div className="bg-primary text-primary-foreground px-6 py-1 text-xs font-semibold shadow-lg whitespace-nowrap">
                New {racket.year}
                </div>
              </div>
            )}
          </div>

          {/* Content */}
          <div className="px-6 pt-0 pb-6 space-y-4">
            {/* Title */}
            <div>
              <p className="text-sm text-muted-foreground mb-1">
                {racket.brand} / {racket.year}
              </p>
              <h3 className="font-semibold text-xl leading-tight line-clamp-2" data-testid={`text-model-${racket.id}`}>
                {racket.model}
              </h3>
            </div>

            {/* Ratings */}
            <RatingMetrics
              power={racket.powerRating}
              control={racket.controlRating}
              rebound={racket.reboundRating}
              maneuverability={racket.maneuverabilityRating}
              sweetSpot={racket.sweetSpotRating}
              compact
            />

            {/* Price */}
            <div className="pt-3 border-t space-y-2">
              {racket.originalPrice && Number(racket.originalPrice) > Number(racket.currentPrice) ? (
                <div className="space-y-1.5">
                  <div className="flex items-center gap-2 flex-wrap">
                    <span className="text-sm text-muted-foreground line-through">
                      €{Number(racket.originalPrice).toFixed(0)}
                    </span>
                    <Badge variant="destructive" className="text-xs font-semibold">
                      -{discountPercentage}%
                    </Badge>
                  </div>
                  <div className="flex items-center justify-between gap-2">
                    <span className="text-2xl font-bold text-primary" data-testid={`text-price-${racket.id}`}>
                      €{Number(racket.currentPrice).toFixed(0)}
                    </span>
                    {racket.affiliateLink || racket.titleUrl ? (
                      <Button
                        size="default"
                        className="shrink-0 px-4"
                        onClick={(e) => {
                          e.stopPropagation();
                          window.open(racket.affiliateLink || racket.titleUrl || "#", "_blank", "noopener,noreferrer");
                        }}
                        data-testid={`button-buy-now-${racket.id}`}
                      >
                        Buy Now
                        <ExternalLink className="ml-1 h-3 w-3" />
                      </Button>
                    ) : null}
                  </div>
                </div>
              ) : (
                <div className="flex items-center justify-between gap-2">
                  <span className="text-2xl font-bold text-primary" data-testid={`text-price-${racket.id}`}>
                    €{Number(racket.currentPrice).toFixed(0)}
                  </span>
                  {racket.affiliateLink || racket.titleUrl ? (
                    <Button
                      size="sm"
                      className="shrink-0"
                      onClick={(e) => {
                        e.stopPropagation();
                        window.open(racket.affiliateLink || racket.titleUrl || "#", "_blank", "noopener,noreferrer");
                      }}
                      data-testid={`button-buy-now-${racket.id}`}
                    >
                      Buy Now
                      <ExternalLink className="ml-1 h-3 w-3" />
                    </Button>
                  ) : null}
                </div>
              )}
            </div>
          </div>
        </CardContent>
      </Card>
    </Link>
  );
}
