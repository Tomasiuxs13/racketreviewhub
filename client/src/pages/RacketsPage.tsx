import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Skeleton } from "@/components/ui/skeleton";
import { Badge } from "@/components/ui/badge";
import { X, SlidersHorizontal } from "lucide-react";
import { RacketCard } from "@/components/RacketCard";
import type { Racket } from "@shared/schema";
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
  SheetTrigger,
} from "@/components/ui/sheet";

export default function RacketsPage() {
  const [selectedBrands, setSelectedBrands] = useState<string[]>([]);
  const [selectedShapes, setSelectedShapes] = useState<string[]>([]);
  const [minRating, setMinRating] = useState<number>(0);
  const [sortBy, setSortBy] = useState<string>("newest");
  const [mobileFiltersOpen, setMobileFiltersOpen] = useState(false);

  const { data: rackets, isLoading } = useQuery<Racket[]>({
    queryKey: ["/api/rackets"],
  });

  // Get unique brands and shapes
  const brands = [...new Set(rackets?.map((r) => r.brand) || [])].sort();
  const shapes = ["diamond", "round", "teardrop"];

  // Filter and sort rackets
  const filteredRackets = rackets
    ?.filter((racket) => {
      if (selectedBrands.length > 0 && !selectedBrands.includes(racket.brand)) return false;
      if (selectedShapes.length > 0 && !selectedShapes.includes(racket.shape)) return false;
      if (racket.overallRating < minRating) return false;
      return true;
    })
    .sort((a, b) => {
      switch (sortBy) {
        case "price-low":
          return Number(a.currentPrice) - Number(b.currentPrice);
        case "price-high":
          return Number(b.currentPrice) - Number(a.currentPrice);
        case "rating":
          return b.overallRating - a.overallRating;
        case "newest":
        default:
          return b.year - a.year || new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime();
      }
    });

  const toggleBrand = (brand: string) => {
    setSelectedBrands((prev) =>
      prev.includes(brand) ? prev.filter((b) => b !== brand) : [...prev, brand]
    );
  };

  const toggleShape = (shape: string) => {
    setSelectedShapes((prev) =>
      prev.includes(shape) ? prev.filter((s) => s !== shape) : [...prev, shape]
    );
  };

  const clearFilters = () => {
    setSelectedBrands([]);
    setSelectedShapes([]);
    setMinRating(0);
  };

  const hasActiveFilters = selectedBrands.length > 0 || selectedShapes.length > 0 || minRating > 0;

  const FilterContent = () => (
    <div className="space-y-6">
      {/* Shape Filter */}
      <div>
        <h3 className="font-semibold mb-3">Shape</h3>
        <div className="space-y-2">
          {shapes.map((shape) => (
            <div key={shape} className="flex items-center gap-2">
              <Checkbox
                id={`shape-${shape}`}
                checked={selectedShapes.includes(shape)}
                onCheckedChange={() => toggleShape(shape)}
                data-testid={`checkbox-shape-${shape}`}
              />
              <Label htmlFor={`shape-${shape}`} className="capitalize cursor-pointer">
                {shape}
              </Label>
            </div>
          ))}
        </div>
      </div>

      {/* Rating Filter */}
      <div>
        <h3 className="font-semibold mb-3">Minimum Rating</h3>
        <Select value={minRating.toString()} onValueChange={(v) => setMinRating(Number(v))}>
          <SelectTrigger data-testid="select-min-rating">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="0" data-testid="select-rating-all">All Ratings</SelectItem>
            <SelectItem value="75" data-testid="select-rating-75">75+</SelectItem>
            <SelectItem value="80" data-testid="select-rating-80">80+</SelectItem>
            <SelectItem value="85" data-testid="select-rating-85">85+</SelectItem>
            <SelectItem value="90" data-testid="select-rating-90">90+</SelectItem>
          </SelectContent>
        </Select>
      </div>

      {/* Brand Filter */}
      <div>
        <h3 className="font-semibold mb-3">Brand</h3>
        <div className="space-y-2 max-h-64 overflow-y-auto">
          {brands.map((brand) => (
            <div key={brand} className="flex items-center gap-2">
              <Checkbox
                id={`brand-${brand}`}
                checked={selectedBrands.includes(brand)}
                onCheckedChange={() => toggleBrand(brand)}
                data-testid={`checkbox-brand-${brand}`}
              />
              <Label htmlFor={`brand-${brand}`} className="cursor-pointer">
                {brand}
              </Label>
            </div>
          ))}
        </div>
      </div>
    </div>
  );

  return (
    <div className="min-h-screen bg-background">
      <div className="max-w-7xl mx-auto px-6 py-8">
        {/* Header */}
        <div className="mb-8">
          <h1 className="font-heading font-bold text-4xl md:text-5xl mb-3" data-testid="text-page-title">
            Padel Racket Reviews
          </h1>
          <p className="text-muted-foreground text-lg">
            Discover padel rackets from renowned brands with detailed ratings and expert reviews
          </p>
        </div>

        <div className="flex gap-8">
          {/* Desktop Sidebar Filters */}
          <aside className="hidden lg:block w-64 flex-shrink-0">
            <Card className="sticky top-24">
              <CardContent className="p-6">
                <div className="flex items-center justify-between mb-4">
                  <h2 className="font-semibold text-lg">Filters</h2>
                  {hasActiveFilters && (
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={clearFilters}
                      data-testid="button-clear-filters"
                    >
                      Clear All
                    </Button>
                  )}
                </div>
                <FilterContent />
              </CardContent>
            </Card>
          </aside>

          {/* Main Content */}
          <div className="flex-1">
            {/* Toolbar */}
            <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 mb-6">
              <div className="flex items-center gap-3 flex-wrap">
                {/* Mobile Filter Button */}
                <Sheet open={mobileFiltersOpen} onOpenChange={setMobileFiltersOpen}>
                  <SheetTrigger asChild>
                    <Button variant="outline" className="lg:hidden" data-testid="button-mobile-filters">
                      <SlidersHorizontal className="h-4 w-4 mr-2" />
                      Filters
                      {hasActiveFilters && (
                        <Badge variant="secondary" className="ml-2">
                          {selectedBrands.length + selectedShapes.length + (minRating > 0 ? 1 : 0)}
                        </Badge>
                      )}
                    </Button>
                  </SheetTrigger>
                  <SheetContent side="left">
                    <SheetHeader>
                      <SheetTitle>Filters</SheetTitle>
                    </SheetHeader>
                    <div className="mt-6">
                      <FilterContent />
                    </div>
                  </SheetContent>
                </Sheet>

                {/* Active Filters */}
                {selectedBrands.map((brand) => (
                  <Badge key={brand} variant="secondary" className="gap-1" data-testid={`badge-filter-${brand}`}>
                    {brand}
                    <button onClick={() => toggleBrand(brand)} className="ml-1 hover:text-foreground">
                      <X className="h-3 w-3" />
                    </button>
                  </Badge>
                ))}
                {selectedShapes.map((shape) => (
                  <Badge key={shape} variant="secondary" className="gap-1 capitalize" data-testid={`badge-filter-${shape}`}>
                    {shape}
                    <button onClick={() => toggleShape(shape)} className="ml-1 hover:text-foreground">
                      <X className="h-3 w-3" />
                    </button>
                  </Badge>
                ))}
                {minRating > 0 && (
                  <Badge variant="secondary" className="gap-1" data-testid="badge-filter-rating">
                    Rating {minRating}+
                    <button onClick={() => setMinRating(0)} className="ml-1 hover:text-foreground">
                      <X className="h-3 w-3" />
                    </button>
                  </Badge>
                )}
              </div>

              {/* Sort */}
              <div className="flex items-center gap-2">
                <span className="text-sm text-muted-foreground">Sort by:</span>
                <Select value={sortBy} onValueChange={setSortBy}>
                  <SelectTrigger className="w-40" data-testid="select-sort">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="newest" data-testid="select-sort-newest">Newest</SelectItem>
                    <SelectItem value="rating" data-testid="select-sort-rating">Highest Rated</SelectItem>
                    <SelectItem value="price-low" data-testid="select-sort-price-low">Price: Low to High</SelectItem>
                    <SelectItem value="price-high" data-testid="select-sort-price-high">Price: High to Low</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>

            {/* Results Count */}
            {!isLoading && (
              <p className="text-sm text-muted-foreground mb-6" data-testid="text-results-count">
                {filteredRackets?.length || 0} racket{filteredRackets?.length !== 1 ? "s" : ""} found
              </p>
            )}

            {/* Rackets Grid */}
            {isLoading ? (
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6">
                {Array.from({ length: 12 }).map((_, i) => (
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
            ) : filteredRackets && filteredRackets.length > 0 ? (
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6">
                {filteredRackets.map((racket) => (
                  <RacketCard key={racket.id} racket={racket} />
                ))}
              </div>
            ) : (
              <Card>
                <CardContent className="flex flex-col items-center justify-center py-16">
                  <p className="text-muted-foreground text-center mb-4">
                    No rackets found matching your filters
                  </p>
                  {hasActiveFilters && (
                    <Button onClick={clearFilters} data-testid="button-clear-filters-empty">
                      Clear Filters
                    </Button>
                  )}
                </CardContent>
              </Card>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
