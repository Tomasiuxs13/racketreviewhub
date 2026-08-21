import { Link } from "wouter";
import { ExternalLink, GitCompareArrows, Plus, Check } from "lucide-react";
import type { Racket } from "@shared/schema";
import { getRacketSlug, getOptimizedImageUrl } from "@/lib/utils";
import { openAffiliateLink } from "@/lib/analytics";
import { useCompare } from "@/hooks/useCompare";
import { formatRacketDisplayName } from "@shared/utils";

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

  // Build descriptor line: Shape • Level
  const descriptors = [
    racket.shape,
    racket.gameLevel,
  ].filter(Boolean).join(" \u2022 ");

  return (
    <Link href={`/rackets/${getRacketSlug(racket)}`} data-testid={`link-racket-${racket.id}`}>
      <div
        className={`ds-card group h-full cursor-pointer ${!isAvailable ? "opacity-70" : ""}`}
        data-testid={`card-racket-${racket.id}`}
      >
        {/* Image Area */}
        <div className="relative w-full h-72 sm:h-80 bg-ds-surface-low flex items-center justify-center overflow-hidden">
          {/* Subtle gradient overlay */}
          <div className="absolute inset-0 bg-gradient-to-br from-ds-primary/5 to-transparent" />
          {/* Soft glow behind racket */}
          <div className="absolute w-48 h-48 bg-ds-primary-container/10 blur-3xl rounded-full" />

          {racket.imageUrl ? (
            <img
              src={getOptimizedImageUrl(racket.imageUrl, 400)}
              srcSet={`${getOptimizedImageUrl(racket.imageUrl, 200)} 200w, ${getOptimizedImageUrl(racket.imageUrl, 400)} 400w`}
              sizes="(max-width: 640px) 200px, 400px"
              alt={`${racket.brand} ${racket.model}`}
              className="relative z-10 h-[80%] w-full object-contain mix-blend-multiply group-hover:scale-110 transition-transform duration-500"
              loading="lazy"
              data-testid={`img-racket-${racket.id}`}
            />
          ) : (
            <div className="w-full h-full flex items-center justify-center">
              <span className="text-ds-secondary text-sm font-medium">No image</span>
            </div>
          )}

          {/* Badges — top left */}
          <div className="absolute top-0 left-0 p-4 flex flex-col gap-1.5 z-20">
            {racket.year >= new Date().getFullYear() && (
              <span className="ds-badge-new">New {racket.year}</span>
            )}
            {isAvailable ? (
              <span className="ds-badge-stock">In Stock</span>
            ) : (
              <span className="ds-badge-stock opacity-60">Out of Stock</span>
            )}
          </div>

          {/* Compare Button — top right */}
          <button
            className={`absolute top-4 right-4 z-20 ds-compare-btn ${inCompare ? "active" : ""}`}
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
            {inCompare ? (
              <Check className="h-3.5 w-3.5" />
            ) : (
              <Plus className="h-3.5 w-3.5" />
            )}
            <span className="text-[10px] font-black uppercase tracking-wider">
              {inCompare ? "Added" : "Compare"}
            </span>
          </button>
        </div>

        {/* Content */}
        <div className="p-5 sm:p-6 flex flex-col flex-1">
          {/* Title + Score */}
          <div className="mb-4 sm:mb-6">
            <div className="flex justify-between items-start mb-1.5 gap-2">
              <h3
                className="font-heading font-black text-lg sm:text-xl tracking-tight leading-tight text-ds-on-surface group-hover:text-ds-primary transition-colors duration-300 line-clamp-2"
                data-testid={`text-model-${racket.id}`}
              >
                {`${racket.brand} ${formatRacketDisplayName(racket.brand, racket.model, racket.year)}`}
              </h3>
              <span className="ds-score shrink-0" data-testid={`text-overall-rating-${racket.id}`}>
                {racket.overallRating}
              </span>
            </div>
            {descriptors && (
              <p className="text-[11px] text-ds-on-surface-variant font-semibold uppercase tracking-wider">
                {descriptors}
              </p>
            )}
          </div>

          {/* Performance Bars — Power & Control */}
          <div className="space-y-3 sm:space-y-4 mb-6 sm:mb-8">
            <PerformanceBar label="Power" abbr="PWR" value={racket.powerRating} />
            <PerformanceBar label="Control" abbr="CTL" value={racket.controlRating} />

            {/* Stat Chips — RBD, MAN, SS */}
            <div className="grid grid-cols-3 gap-2 sm:gap-3 pt-2">
              <StatChip label="RBD" value={racket.reboundRating} />
              <StatChip label="MAN" value={racket.maneuverabilityRating} />
              <StatChip label="SS" value={racket.sweetSpotRating} />
            </div>
          </div>

          {/* Price + Buy Buttons */}
          <div className="mt-auto flex flex-col gap-3">
            <div className="flex items-end justify-between gap-3">
              <div className="flex flex-col">
                <div className="flex items-center gap-2">
                  <span className="text-2xl font-black text-ds-on-surface" data-testid={`text-price-${racket.id}`}>
                    €{Number(racket.currentPrice).toFixed(0)}
                  </span>
                  {discountPercentage > 0 && (
                    <span className="bg-ds-error text-white px-1.5 py-0.5 rounded text-[10px] font-bold">
                      -{discountPercentage}%
                    </span>
                  )}
                </div>
                {racket.originalPrice && Number(racket.originalPrice) > Number(racket.currentPrice) ? (
                  <span className="text-[11px] text-ds-on-surface-variant/60 line-through font-medium">
                    €{Number(racket.originalPrice).toFixed(2)}
                  </span>
                ) : (
                  <span className="text-[11px] text-ds-on-surface-variant/60 font-medium">List Price</span>
                )}
              </div>
            </div>

            {/* Affiliate Buttons */}
            <div className="flex flex-col gap-2">
              {racket.inStock && (racket.affiliateLink || racket.titleUrl) && (
                <button
                  className="ds-btn-primary w-full flex items-center justify-center gap-1.5"
                  onClick={(e) => {
                    e.preventDefault();
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
                  <ExternalLink className="h-3 w-3" />
                </button>
              )}
              {racket.padelMarketInStock && racket.padelMarketAffiliateLink && (
                <button
                  className={`${racket.inStock && (racket.affiliateLink || racket.titleUrl) ? "ds-btn-secondary" : "ds-btn-primary"} w-full flex items-center justify-center gap-1.5`}
                  onClick={(e) => {
                    e.preventDefault();
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
                  <ExternalLink className="h-3 w-3" />
                </button>
              )}
            </div>
          </div>
        </div>
      </div>
    </Link>
  );
}

function PerformanceBar({ label, abbr, value }: { label: string; abbr: string; value: number }) {
  const pct = Math.min(100, Math.max(0, value * 10));
  return (
    <div className="space-y-1.5">
      <div className="flex justify-between text-[10px] font-bold uppercase tracking-[0.15em] text-ds-secondary">
        <span>{label} ({abbr})</span>
        <span className="text-ds-on-surface">{(value / 10).toFixed(1)}</span>
      </div>
      <div className="ds-bar-track">
        <div className="ds-bar-fill" style={{ width: `${pct}%` }} />
      </div>
    </div>
  );
}

function StatChip({ label, value }: { label: string; value: number }) {
  return (
    <div className="ds-stat-chip">
      <p className="text-[9px] font-bold text-ds-secondary uppercase tracking-tight">{label}</p>
      <p className="text-xs font-black text-ds-on-surface">{(value / 10).toFixed(1)}</p>
    </div>
  );
}
