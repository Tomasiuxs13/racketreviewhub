import { Link } from "wouter";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { RatingMetrics } from "./RatingBar";
import { ExternalLink, CheckCircle, GitCompareArrows } from "lucide-react";
import type { Racket } from "@shared/schema";
import { getRacketSlug, getOptimizedImageUrl } from "@/lib/utils";
import { openAffiliateLink } from "@/lib/analytics";
import { useCompare } from "@/hooks/useCompare";

interface RacketCardProps {
  racket: Racket;
}

export function RacketCard({ racket }: RacketCardProps) {
  const { addToCompare, removeFromCompare, isInCompare } = useCompare();
  const racketSlug = getRacketSlug(racket);
  const inCompare = isInCompare(racketSlug);

  const discountPercentage = racket.originalPrice
    ? Math.round(((Number(racket.originalPrice) - Number(racket.currentPrice)) / Number(racket.originalPrice)) * 100)
    : 0;

  const isAvailable = racket.inStock || racket.padelMarketInStock;

  const getRatingColor = (rating: number) => {
    if (rating >= 85) return "text-primary";
    if (rating >= 75) return "text-chart-2";
    return "text-muted-foreground";
  };

  return (
    <Link href={`/rackets/${getRacketSlug(racket)}`} data-testid={`link-racket-${racket.id}`}>
      <Card className={`group overflow-hidden hover:-translate-y-1 premium-shadow-hover transition-all duration-500 h-full cursor-pointer border-border/40 hover:border-primary/30 bg-card ${!isAvailable ? "opacity-70" : ""}`} data-testid={`card-racket-${racket.id}`}>
        <CardContent className="p-0">
          {/* Image Container */}
          <div className={`relative aspect-[4/3] bg-gradient-to-br from-muted/50 to-muted/10 overflow-hidden ${!isAvailable ? "grayscale-[30%]" : ""}`}>
            <div className="absolute inset-0 flex items-center justify-center p-6 mix-blend-multiply dark:mix-blend-normal">
              {racket.imageUrl ? (
                <img
                  src={getOptimizedImageUrl(racket.imageUrl, 400)}
                  srcSet={`${getOptimizedImageUrl(racket.imageUrl, 200)} 200w, ${getOptimizedImageUrl(racket.imageUrl, 400)} 400w`}
                  sizes="(max-width: 640px) 200px, 400px"
                  alt={`${racket.brand} ${racket.model}`}
                  className="w-full h-full object-contain group-hover:scale-110 drop-shadow-xl transition-transform duration-700 ease-out"
                  loading="lazy"
                  data-testid={`img-racket-${racket.id}`}
                />
              ) : (
                <div className="w-full h-full flex items-center justify-center bg-muted/50 rounded-md">
                  <span className="text-muted-foreground text-sm font-medium">No image</span>
                </div>
              )}
            </div>

            {/* Compare Toggle */}
            <button
              className={`absolute top-3 left-3 z-10 w-9 h-9 rounded-full flex items-center justify-center transition-all duration-300 ${inCompare
                ? "bg-primary text-primary-foreground shadow-lg shadow-primary/25"
                : "bg-white/80 dark:bg-black/50 backdrop-blur-md text-foreground/70 hover:bg-white dark:hover:bg-black hover:text-foreground border border-border/50"
                }`}
              onClick={(e) => {
                e.preventDefault();
                e.stopPropagation();
                if (inCompare) {
                  removeFromCompare(racketSlug);
                } else {
                  addToCompare(racketSlug);
                }
              }}
              aria-label={inCompare ? "Remove from comparison" : "Add to comparison"}
              title={inCompare ? "Remove from comparison" : "Compare"}
            >
              <GitCompareArrows className="h-4 w-4" />
            </button>

            {/* Overall Rating Badge */}
            <div className="absolute top-3 right-3">
              <div className={`w-12 h-12 rounded-full glass border border-white/40 dark:border-white/10 shadow-lg flex items-center justify-center ${getRatingColor(racket.overallRating)}`}>
                <span className="text-xl font-heading font-extrabold" data-testid={`text-overall-rating-${racket.id}`}>
                  {racket.overallRating}
                </span>
              </div>
            </div>

            {/* Stock Status Badge */}
            {isAvailable ? (
              <div className="absolute bottom-4 right-4 z-10">
                <Badge variant="default" className="text-[10px] px-2 py-0.5 bg-emerald-500 hover:bg-emerald-600 shadow-sm border-0">
                  <span className="relative flex h-2 w-2 mr-1.5">
                    <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-white opacity-75"></span>
                    <span className="relative inline-flex rounded-full h-2 w-2 bg-white"></span>
                  </span>
                  In Stock
                </Badge>
              </div>
            ) : (
              <div className="absolute bottom-4 right-4 z-10">
                <Badge variant="secondary" className="text-[10px] px-2 py-0.5 glass border-0 text-foreground/80">
                  Out of Stock
                </Badge>
              </div>
            )}

            {/* Year Ribbon */}
            {racket.year >= new Date().getFullYear() && (
              <div className="absolute top-5 -left-8 z-10 -rotate-45">
                <div className="bg-gradient-to-r from-primary to-emerald-500 text-primary-foreground px-10 py-1 text-[10px] font-bold tracking-wider shadow-lg whitespace-nowrap uppercase">
                  New {racket.year}
                </div>
              </div>
            )}
          </div>

          {/* Content */}
          <div className="px-5 sm:px-6 pt-5 pb-5 sm:pb-6 flex flex-col gap-4">
            {/* Title */}
            <div>
              <p className="text-xs font-semibold tracking-wider text-muted-foreground mb-1.5 uppercase">
                {racket.brand} <span className="text-border/60 mx-1">•</span> {racket.year}
              </p>
              <h3 className="font-heading font-bold text-xl leading-snug line-clamp-2 group-hover:text-primary transition-colors duration-300" data-testid={`text-model-${racket.id}`}>
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
                      €{Number(racket.originalPrice).toFixed(2)}
                    </span>
                    <Badge variant="destructive" className="text-xs font-semibold">
                      -{discountPercentage}%
                    </Badge>
                  </div>
                  <div className="flex flex-wrap items-center justify-between gap-3">
                    <span className="text-2xl font-bold text-primary" data-testid={`text-price-${racket.id}`}>
                      €{Number(racket.currentPrice).toFixed(2)}
                    </span>
                    <div className="flex flex-col gap-1.5 shrink-0 w-full sm:w-auto">
                      {racket.inStock && (racket.affiliateLink || racket.titleUrl) ? (
                        <Button
                          size="default"
                          className="w-full sm:w-auto px-4"
                          onClick={(e) => {
                            e.stopPropagation();
                            openAffiliateLink(racket.affiliateLink || racket.titleUrl || "#", {
                              racketId: racket.id, brand: racket.brand, model: racket.model,
                              partner: "padel_nuestro", source: "racket_card",
                              price: Number(racket.currentPrice), inStock: racket.inStock,
                            });
                          }}
                          data-testid={`button-buy-now-pn-${racket.id}`}
                        >
                          Buy from Padel Nuestro
                          <ExternalLink className="ml-1 h-3 w-3" />
                        </Button>
                      ) : null}
                      {racket.padelMarketInStock && racket.padelMarketAffiliateLink ? (
                        <Button
                          size="default"
                          variant={racket.inStock && (racket.affiliateLink || racket.titleUrl) ? "outline" : "default"}
                          className="w-full sm:w-auto px-4"
                          onClick={(e) => {
                            e.stopPropagation();
                            openAffiliateLink(racket.padelMarketAffiliateLink || "#", {
                              racketId: racket.id, brand: racket.brand, model: racket.model,
                              partner: "padel_market", source: "racket_card",
                              price: Number(racket.currentPrice), inStock: racket.padelMarketInStock,
                            });
                          }}
                          data-testid={`button-buy-now-pm-${racket.id}`}
                        >
                          Buy from Padel Market
                          <ExternalLink className="ml-1 h-3 w-3" />
                        </Button>
                      ) : null}
                    </div>
                  </div>
                </div>
              ) : (
                <div className="flex flex-wrap items-center justify-between gap-3">
                  <span className="text-2xl font-bold text-primary" data-testid={`text-price-${racket.id}`}>
                    €{Number(racket.currentPrice).toFixed(2)}
                  </span>
                  <div className="flex flex-col gap-1.5 shrink-0 w-full sm:w-auto">
                    {racket.inStock && (racket.affiliateLink || racket.titleUrl) ? (
                      <Button
                        size="default"
                        className="w-full sm:w-auto"
                        onClick={(e) => {
                          e.stopPropagation();
                          openAffiliateLink(racket.affiliateLink || racket.titleUrl || "#", {
                            racketId: racket.id, brand: racket.brand, model: racket.model,
                            partner: "padel_nuestro", source: "racket_card",
                            price: Number(racket.currentPrice), inStock: racket.inStock,
                          });
                        }}
                        data-testid={`button-buy-now-pn-${racket.id}`}
                      >
                        Buy from Padel Nuestro
                        <ExternalLink className="ml-1 h-3 w-3" />
                      </Button>
                    ) : null}
                    {racket.padelMarketInStock && racket.padelMarketAffiliateLink ? (
                      <Button
                        size="default"
                        variant={racket.inStock && (racket.affiliateLink || racket.titleUrl) ? "outline" : "default"}
                        className="w-full sm:w-auto"
                        onClick={(e) => {
                          e.stopPropagation();
                          openAffiliateLink(racket.padelMarketAffiliateLink || "#", {
                            racketId: racket.id, brand: racket.brand, model: racket.model,
                            partner: "padel_market", source: "racket_card",
                            price: Number(racket.currentPrice), inStock: racket.padelMarketInStock,
                          });
                        }}
                        data-testid={`button-buy-now-pm-${racket.id}`}
                      >
                        Buy from Padel Market
                        <ExternalLink className="ml-1 h-3 w-3" />
                      </Button>
                    ) : null}
                  </div>
                </div>
              )}
            </div>
          </div>
        </CardContent>
      </Card>
    </Link>
  );
}
