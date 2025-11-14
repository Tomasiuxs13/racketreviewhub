import { Link } from "wouter";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { RatingMetrics } from "./RatingBar";
import type { Racket } from "@shared/schema";

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
    <Link href={`/rackets/${racket.id}`} data-testid={`link-racket-${racket.id}`}>
      <Card className="group overflow-hidden hover-elevate active-elevate-2 transition-all duration-300 h-full cursor-pointer" data-testid={`card-racket-${racket.id}`}>
        <CardContent className="p-0">
          {/* Image Container */}
          <div className="relative aspect-[3/4] bg-card overflow-hidden">
            <div className="absolute inset-0 flex items-center justify-center p-6">
              {racket.imageUrl ? (
                <img
                  src={racket.imageUrl}
                  alt={`${racket.brand} ${racket.model}`}
                  className="w-full h-full object-contain group-hover:scale-105 transition-transform duration-300"
                  data-testid={`img-racket-${racket.id}`}
                />
              ) : (
                <div className="w-full h-full flex items-center justify-center bg-muted rounded-md">
                  <span className="text-muted-foreground text-sm">No image</span>
                </div>
              )}
            </div>

            {/* Brand Badge */}
            <Badge className="absolute top-3 left-3 font-medium" data-testid={`badge-brand-${racket.id}`}>
              {racket.brand}
            </Badge>

            {/* Overall Rating Badge */}
            <div className="absolute top-3 right-3">
              <div className={`w-12 h-12 rounded-full bg-background/90 backdrop-blur-sm border-2 border-primary flex items-center justify-center ${getRatingColor(racket.overallRating)}`}>
                <span className="text-xl font-bold" data-testid={`text-overall-rating-${racket.id}`}>
                  {racket.overallRating}
                </span>
              </div>
            </div>

            {/* Year Badge */}
            {racket.year >= new Date().getFullYear() && (
              <Badge variant="secondary" className="absolute bottom-3 left-3">
                New {racket.year}
              </Badge>
            )}
          </div>

          {/* Content */}
          <div className="p-6 space-y-4">
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
            <div className="flex items-baseline gap-3 pt-2 border-t">
              {racket.originalPrice && Number(racket.originalPrice) > Number(racket.currentPrice) && (
                <>
                  <span className="text-sm text-muted-foreground line-through">
                    €{Number(racket.originalPrice).toFixed(0)}
                  </span>
                  <Badge variant="destructive" className="text-xs">
                    -{discountPercentage}%
                  </Badge>
                </>
              )}
              <span className="text-2xl font-bold ml-auto" data-testid={`text-price-${racket.id}`}>
                €{Number(racket.currentPrice).toFixed(0)}
              </span>
            </div>
          </div>
        </CardContent>
      </Card>
    </Link>
  );
}
