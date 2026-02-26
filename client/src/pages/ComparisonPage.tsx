import { Link, useLocation } from "wouter";
import { useQuery } from "@tanstack/react-query";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { ArrowLeft, ExternalLink, Scale, X, Search, Info, Trophy, Plus, ChevronRight, RotateCcw } from "lucide-react";
import { RatingBar } from "@/components/RatingBar";
import type { Racket } from "@shared/schema";
import { getRacketSlug, getOptimizedImageUrl } from "@/lib/utils";
import SEO from "@/components/SEO";
import { Breadcrumbs } from "@/components/Breadcrumbs";
import { trackAffiliateClick } from "@/lib/analytics";
import { useState, useEffect, useMemo } from "react";
import { Input } from "@/components/ui/input";
import { Switch } from "@/components/ui/switch";
import { Label } from "@/components/ui/label";
import { useCompare } from "@/hooks/useCompare";
import { useI18n } from "@/i18n/useI18n";

export default function ComparisonPage() {
  const [location, setLocation] = useLocation();
  const { compareIds: storedIds, addToCompare, removeFromCompare, clearCompare } = useCompare();
  const { t, locale } = useI18n();
  const [highlightDifferences, setHighlightDifferences] = useState(false);
  const [isSticky, setIsSticky] = useState(false);
  const [searchQuery, setSearchQuery] = useState("");
  const [showSearch, setShowSearch] = useState(false);

  // Extract ids from the path, supporting both /compare/:ids and /:locale/compare/:ids
  const compareMatch = location.match(/\/compare\/([^/?#]+)/);
  const urlIds = compareMatch ? decodeURIComponent(compareMatch[1]).split(",") : [];

  // Use URL ids if present, otherwise fallback to stored ids. Deduplicate.
  const ids = useMemo(() => {
    const combined = urlIds.length > 0 ? urlIds : storedIds;
    return Array.from(new Set(combined));
  }, [urlIds, storedIds]);

  const { data: allRackets, isLoading } = useQuery<Racket[]>({
    queryKey: ["/api/rackets"],
  });

  // Handle sticky header on scroll
  useEffect(() => {
    const handleScroll = () => {
      setIsSticky(window.scrollY > 300);
    };
    window.addEventListener("scroll", handleScroll);
    return () => window.removeEventListener("scroll", handleScroll);
  }, []);

  // Sync URL state to useCompare hook storage
  useEffect(() => {
    if (urlIds.length > 0) {
      urlIds.forEach(id => {
        if (!storedIds.includes(id)) {
          addToCompare(id);
        }
      });
    }
  }, [urlIds, storedIds, addToCompare]);

  // Find rackets by slug from the comma-separated URL param
  const rackets = useMemo(() => {
    if (!allRackets) return [];
    // Only match by slug to avoid duplication when both UUID and slug appear
    return allRackets.filter((r) => ids.includes(getRacketSlug(r)));
  }, [allRackets, ids]);

  const searchResults = useMemo(() => {
    if (!searchQuery.trim() || !allRackets) return [];
    const lowerQuery = searchQuery.toLowerCase();
    return allRackets
      .filter(r => !ids.includes(getRacketSlug(r)))
      .filter(r =>
        r.brand.toLowerCase().includes(lowerQuery) ||
        r.model.toLowerCase().includes(lowerQuery)
      )
      .slice(0, 5);
  }, [searchQuery, allRackets, ids]);

  const ratingFields = [
    { key: "overallRating" as const, label: "Overall" },
    { key: "powerRating" as const, label: "Power" },
    { key: "controlRating" as const, label: "Control" },
    { key: "reboundRating" as const, label: "Rebound" },
    { key: "maneuverabilityRating" as const, label: "Maneuverability" },
    { key: "sweetSpotRating" as const, label: "Sweet Spot" },
  ];

  const specFields = [
    { key: "shape" as const, label: "Shape" },
    { key: "balance" as const, label: "Balance" },
    { key: "hardness" as const, label: "Hardness" },
    { key: "gameLevel" as const, label: "Game Level" },
    { key: "gameType" as const, label: "Game Type" },
    { key: "player" as const, label: "Player" },
    { key: "surface" as const, label: "Surface" },
    { key: "core" as const, label: "Core" },
  ];

  const seoData = {
    title: rackets.length >= 2
      ? `${rackets[0].brand} ${rackets[0].model} vs ${rackets[1].brand} ${rackets[1].model} - Comparison`
      : "Racket Comparison",
    description: "Compare padel rackets side by side - ratings, specs, and prices.",
    url: "/compare",
  };

  if (isLoading) {
    return (
      <div className="min-h-screen bg-background">
        <div className="max-w-7xl mx-auto px-4 py-8">
          <Skeleton className="h-10 w-48 mb-8" />
          <div className="grid grid-cols-2 gap-6">
            <Skeleton className="h-96" />
            <Skeleton className="h-96" />
          </div>
        </div>
      </div>
    );
  }

  if (rackets.length === 0) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center p-4">
        <Card className="max-w-md w-full text-center p-8">
          <Scale className="h-12 w-12 mx-auto mb-4 text-primary" />
          <h1 className="text-2xl font-bold mb-2">Compare Rackets</h1>
          <p className="text-muted-foreground mb-6">Select two or more rackets to compare them side by side.</p>
          <Link href="/rackets">
            <Button className="w-full">Browse Rackets</Button>
          </Link>
        </Card>
      </div>
    );
  }

  const handleAddRacket = (slug: string) => {
    const newIds = [...ids, slug];
    const localePrefix = location.match(/^\/[a-z]{2}(?=\/|$)/)?.[0] || "";
    addToCompare(slug);
    setLocation(`${localePrefix}/compare/${newIds.join(",")}`);
    setShowSearch(false);
    setSearchQuery("");
  };

  const handleRemoveRacket = (slug: string) => {
    const newIds = ids.filter(id => id !== slug);
    const localePrefix = location.match(/^\/[a-z]{2}(?=\/|$)/)?.[0] || "";
    removeFromCompare(slug);
    if (newIds.length === 0) {
      setLocation(`${localePrefix}/compare`);
    } else {
      setLocation(`${localePrefix}/compare/${newIds.join(",")}`);
    }
  };

  return (
    <>
      <SEO {...seoData} />

      {/* Sticky Header */}
      <div className={`fixed top-14 left-0 right-0 z-40 bg-background/95 backdrop-blur border-b shadow-md transition-all duration-300 ${isSticky ? "translate-y-0" : "-translate-y-full opacity-0"}`}>
        <div className="max-w-7xl mx-auto px-4 h-16 flex items-center gap-4">
          <div className="w-32 flex-shrink-0 font-bold text-xs uppercase text-muted-foreground mr-4">Compare</div>
          <div className="flex-1 flex gap-4 overflow-x-auto no-scrollbar">
            {rackets.map(r => (
              <div key={r.id} className="flex-1 min-w-[200px] flex items-center gap-3">
                <img src={getOptimizedImageUrl(r.imageUrl || "", 100)} className="w-10 h-10 object-contain" alt="" />
                <div className="min-w-0">
                  <p className="font-bold text-sm truncate">{r.model}</p>
                  <p className="text-xs text-primary font-bold">{r.overallRating}</p>
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>

      <div className="min-h-screen bg-muted/30">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 py-8">
          <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 mb-8">
            <div className="flex items-center gap-4">
              <Link href={locale === "en" ? "/rackets" : `/${locale}/rackets`}>
                <Button variant="ghost" size="icon" className="rounded-full">
                  <ArrowLeft className="h-5 w-5" />
                </Button>
              </Link>
              <div>
                <Breadcrumbs items={[{ label: t("header.menu.rackets"), href: "/rackets" }, { label: t("header.menu.compare") }]} />
                <h1 className="font-heading font-extrabold text-3xl mt-1">Racket Comparison</h1>
              </div>
            </div>

            <div className="flex flex-wrap items-center gap-4">
              <Button
                variant="ghost"
                size="sm"
                onClick={() => {
                  clearCompare();
                  setLocation(locale === "en" ? "/compare" : `/${locale}/compare`);
                }}
                className="text-muted-foreground hover:text-destructive transition-colors"
                data-testid="button-clear-compare"
              >
                <RotateCcw className="h-4 w-4 mr-2" />
                {t("common.clear_all")}
              </Button>

              {rackets.length >= 2 && (
                <div className="flex items-center gap-3 bg-background p-2 px-3 rounded-full border border-border/50 shadow-sm">
                  <Switch
                    id="highlight-diffs"
                    checked={highlightDifferences}
                    onCheckedChange={setHighlightDifferences}
                  />
                  <Label htmlFor="highlight-diffs" className="text-xs font-bold cursor-pointer whitespace-nowrap">Highlight Differences</Label>
                </div>
              )}
            </div>
          </div>

          <div className="overflow-x-auto pb-4 -mx-4 px-4 sm:mx-0 sm:px-0 no-scrollbar">
            <div className="min-w-[800px] md:min-w-0 grid gap-6">
              {/* Header Cards */}
              <div className="grid gap-4" style={{ gridTemplateColumns: `repeat(${Math.max(2, rackets.length)}, minmax(0, 1fr))` }}>
                {rackets.map((racket) => (
                  <Card key={racket.id} className="relative overflow-hidden group border-none shadow-xl">
                    <button
                      onClick={() => handleRemoveRacket(getRacketSlug(racket))}
                      className="absolute top-2 right-2 z-10 p-1 rounded-full bg-black/10 hover:bg-black/20 transition-colors"
                    >
                      <X className="h-4 w-4" />
                    </button>
                    <CardContent className="p-6 text-center">
                      <div className="aspect-square mb-6 flex items-center justify-center max-h-48 group-hover:scale-105 transition-transform duration-500">
                        <img
                          src={getOptimizedImageUrl(racket.imageUrl || "", 400)}
                          alt={`${racket.brand} ${racket.model}`}
                          className="max-w-full max-h-full object-contain drop-shadow-2xl"
                        />
                      </div>
                      <Badge variant="secondary" className="mb-2 bg-primary/10 text-primary border-none">{racket.brand}</Badge>
                      <h2 className="font-heading font-bold text-xl mb-4 h-14 overflow-hidden">
                        <Link href={`/rackets/${getRacketSlug(racket)}`} className="hover:text-primary transition-colors">
                          {racket.model}
                        </Link>
                      </h2>
                      <div className="flex items-center justify-center gap-2 mb-6">
                        <span className="text-3xl font-black text-foreground">€{Math.round(Number(racket.currentPrice))}</span>
                        {racket.originalPrice && Number(racket.originalPrice) > Number(racket.currentPrice) && (
                          <span className="text-sm text-muted-foreground line-through">€{Math.round(Number(racket.originalPrice))}</span>
                        )}
                      </div>
                      {(racket.affiliateLink || racket.padelMarketAffiliateLink) && (
                        <Button asChild className="w-full bg-primary hover:bg-primary/90 font-bold shadow-lg shadow-primary/20">
                          <a href={racket.affiliateLink || racket.padelMarketAffiliateLink || "#"} target="_blank" rel="sponsored">
                            View Price <ExternalLink className="ml-2 h-4 w-4" />
                          </a>
                        </Button>
                      )}
                    </CardContent>
                  </Card>
                ))}

                {rackets.length < 4 && (
                  <Card className="border-dashed border-2 flex flex-col items-center justify-center p-6 text-center min-h-[400px] bg-background/50">
                    {!showSearch ? (
                      <>
                        <div className="w-16 h-16 rounded-full bg-muted flex items-center justify-center mb-4">
                          <Plus className="h-8 w-8 text-muted-foreground" />
                        </div>
                        <h3 className="font-bold mb-2">Add Comparison</h3>
                        <p className="text-sm text-muted-foreground mb-6 max-w-[200px]">Add another racket to see how they compare.</p>
                        <Button variant="outline" onClick={() => setShowSearch(true)}>Search Racket</Button>
                      </>
                    ) : (
                      <div className="w-full space-y-4">
                        <div className="relative">
                          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                          <Input
                            placeholder="Search brand or model..."
                            className="pl-9"
                            autoFocus
                            value={searchQuery}
                            onChange={(e) => setSearchQuery(e.target.value)}
                          />
                        </div>
                        <div className="text-left space-y-1">
                          {searchResults.map(r => (
                            <button
                              key={r.id}
                              onClick={() => handleAddRacket(getRacketSlug(r))}
                              className="w-full flex items-center gap-3 p-2 rounded hover:bg-muted transition-colors text-sm"
                            >
                              <img src={getOptimizedImageUrl(r.imageUrl || "", 100)} className="w-8 h-8 object-contain" alt="" />
                              <span className="font-medium">{r.brand} {r.model}</span>
                              <ChevronRight className="h-4 w-4 ml-auto opacity-50" />
                            </button>
                          ))}
                          {searchQuery && searchResults.length === 0 && (
                            <p className="text-xs text-muted-foreground p-4 text-center">No results found.</p>
                          )}
                        </div>
                        <Button variant="ghost" size="sm" onClick={() => setShowSearch(false)}>Cancel</Button>
                      </div>
                    )}
                  </Card>
                )}
              </div>

              {/* Performance Ratings */}
              <h3 className="font-heading font-bold text-xl flex items-center gap-2 mt-4 ml-2">
                <Trophy className="h-5 w-5 text-yellow-500" />
                Performance Ratings
              </h3>
              <Card className="border-none shadow-lg overflow-hidden">
                <div className="divide-y divide-border/50">
                  {ratingFields.map((field) => {
                    const values = rackets.map(r => Number(r[field.key]));
                    const maxVal = Math.max(...values);
                    const minVal = Math.min(...values);
                    const isDifferential = maxVal !== minVal;

                    return (
                      <div
                        key={field.key}
                        className={`grid items-center p-6 gap-6 transition-opacity duration-300 ${highlightDifferences && !isDifferential ? "opacity-30" : "opacity-100"}`}
                        style={{ gridTemplateColumns: `12rem repeat(${Math.max(2, rackets.length)}, minmax(0, 1fr))` }}
                      >
                        <div className="space-y-1">
                          <span className="font-bold text-sm uppercase tracking-wider text-muted-foreground">{field.label}</span>
                          {highlightDifferences && isDifferential && (
                            <p className="text-[10px] text-primary font-bold uppercase tracking-tighter">Varying Stats</p>
                          )}
                        </div>
                        {rackets.map((racket, i) => {
                          const val = values[i];
                          const isWinner = isDifferential && val === maxVal;
                          return (
                            <div key={racket.id} className="relative">
                              <div className="flex items-center gap-4">
                                <div className="flex-1">
                                  <RatingBar label="" value={val} abbreviation="" showLabel={false} />
                                </div>
                                <span className={`text-lg font-black w-8 text-right ${isWinner ? "text-primary" : "text-muted-foreground"}`}>
                                  {val}
                                </span>
                              </div>
                              {isWinner && (
                                <div className="absolute -top-6 right-0">
                                  <Badge className="bg-primary text-[10px] font-black uppercase tracking-widest px-2 py-0">Best</Badge>
                                </div>
                              )}
                            </div>
                          );
                        })}
                        {rackets.length === 1 && <div className="text-center text-muted-foreground/30 font-bold">-</div>}
                      </div>
                    );
                  })}
                </div>
              </Card>

              {/* Technical Specifications */}
              <h3 className="font-heading font-bold text-xl flex items-center gap-2 mt-4 ml-2">
                <Info className="h-5 w-5 text-primary" />
                Technical Specifications
              </h3>
              <Card className="border-none shadow-lg overflow-hidden">
                <div className="divide-y divide-border/50">
                  {specFields.map((field) => {
                    const values = rackets.map(r => (r as any)[field.key] || "-");
                    const allSame = values.every((v, _, arr) => v === arr[0]);

                    return (
                      <div
                        key={field.key}
                        className={`grid items-center p-6 gap-6 transition-opacity duration-300 ${highlightDifferences && allSame ? "opacity-30" : "opacity-100"}`}
                        style={{ gridTemplateColumns: `12rem repeat(${Math.max(2, rackets.length)}, minmax(0, 1fr))` }}
                      >
                        <span className="font-bold text-sm uppercase tracking-wider text-muted-foreground">{field.label}</span>
                        {rackets.map((racket, i) => (
                          <span key={racket.id} className={`text-sm font-bold capitalize ${!allSame ? "text-foreground" : "text-muted-foreground/80"}`}>
                            {values[i]}
                          </span>
                        ))}
                        {rackets.length === 1 && <div className="text-center text-muted-foreground/30 font-bold">-</div>}
                      </div>
                    );
                  })}
                </div>
              </Card>
            </div>
          </div>
        </div>
      </div>
    </>
  );
}
