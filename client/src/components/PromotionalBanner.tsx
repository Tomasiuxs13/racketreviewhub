import { Link } from "wouter";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { ArrowRight, Star, TrendingUp } from "lucide-react";

interface PromotionalBannerProps {
  variant?: "default" | "compact";
  className?: string;
}

export function PromotionalBanner({ variant = "default", className = "" }: PromotionalBannerProps) {
  return (
    <Card className={`bg-gradient-to-br from-primary/10 via-primary/5 to-background border-primary/20 ${className}`}>
      <CardContent className="p-6">
        <div className="space-y-4">
          {/* Header */}
          <div className="flex items-start justify-between gap-3">
            <div className="flex-1">
              <div className="flex items-center gap-2 mb-2">
                <Badge variant="secondary" className="bg-primary/20 text-primary">
                  <TrendingUp className="h-3 w-3 mr-1" />
                  Featured
                </Badge>
              </div>
              <h3 className="font-semibold text-lg mb-1">
                Find Your Perfect Racket
              </h3>
              <p className="text-sm text-muted-foreground">
                Browse our curated collection of expert-reviewed padel rackets with detailed ratings and best prices.
              </p>
            </div>
          </div>

          {/* Features */}
          {variant === "default" && (
            <div className="space-y-2 pt-2 border-t">
              <div className="flex items-center gap-2 text-sm">
                <Star className="h-4 w-4 text-primary fill-primary" />
                <span>Expert reviews & ratings</span>
              </div>
              <div className="flex items-center gap-2 text-sm">
                <Star className="h-4 w-4 text-primary fill-primary" />
                <span>Best prices guaranteed</span>
              </div>
              <div className="flex items-center gap-2 text-sm">
                <Star className="h-4 w-4 text-primary fill-primary" />
                <span>Detailed specifications</span>
              </div>
            </div>
          )}

          {/* CTA */}
          <Link href="/rackets">
            <Button className="w-full group" size={variant === "compact" ? "sm" : "default"}>
              Explore Rackets
              <ArrowRight className="ml-2 h-4 w-4 group-hover:translate-x-1 transition-transform" />
            </Button>
          </Link>

          {/* Additional Links */}
          {variant === "default" && (
            <div className="flex flex-wrap gap-3 pt-2 text-xs text-muted-foreground">
              <Link href="/guides" className="hover:text-foreground transition-colors">
                Buying Guides
              </Link>
              <span>•</span>
              <Link href="/brands" className="hover:text-foreground transition-colors">
                Browse Brands
              </Link>
            </div>
          )}
        </div>
      </CardContent>
    </Card>
  );
}

