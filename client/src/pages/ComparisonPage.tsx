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
import { formatRacketDisplayName } from "@shared/utils";

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

  // Sync URL state to useCompare hook storage and migrate UUIDs to slugs
  useEffect(() => {
    if (!allRackets) return;

    // 1. Sync URL IDs to storage
    if (urlIds.length > 0) {
      urlIds.forEach(id => {
        // If it's a UUID, try to find the slug and add that instead
        const racket = allRackets.find(r => r.id === id);
        const slugToAdd = racket ? getRacketSlug(racket) : id;

        if (!storedIds.includes(slugToAdd)) {
          addToCompare(slugToAdd);
        }
      });
    }

    // 2. Local migration: if storage has UUIDs, convert them to slugs
    storedIds.forEach(id => {
      // Very simple UUID check
      if (id.length === 36 && id.includes('-')) {
        const racket = allRackets.find(r => r.id === id);
        if (racket) {
          removeFromCompare(id);
          addToCompare(getRacketSlug(racket));
        }
      }
    });
  }, [urlIds, storedIds, addToCompare, removeFromCompare, allRackets]);

  // Find rackets by slug from the comma-separated URL param
  const rackets = useMemo(() => {
    if (!allRackets) return [];

    const result: Racket[] = [];
    const seenSlugs = new Set<string>();

    // We iterate through ids to maintain the order the user expects
    ids.forEach(id => {
      // Find the best match for this ID (slug or UUID)
      const match = allRackets.find(r => getRacketSlug(r) === id || r.id === id);
      if (match) {
        const slug = getRacketSlug(match);
        if (!seenSlugs.has(slug)) {
          seenSlugs.add(slug);
          result.push(match);
        }
      }
    });

    return result;
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

  // Canonical URL: sort slugs alphabetically so /compare/a,b and /compare/b,a share a canonical
  const canonicalCompareSlugs = useMemo(() => {
    return [...ids].sort().join(",");
  }, [ids]);

  const seoData = {
    title: rackets.length >= 2
      ? `${rackets[0].brand} ${rackets[0].model} vs ${rackets[1].brand} ${rackets[1].model} - Comparison`
      : "Racket Comparison",
    description: "Compare padel rackets side by side - ratings, specs, and prices.",
    url: canonicalCompareSlugs ? `/compare/${canonicalCompareSlugs}` : "/compare",
    canonical: canonicalCompareSlugs ? `/compare/${canonicalCompareSlugs}` : "/compare",
    noindex: true,
  };

  if (isLoading) {
    return (
      <div className="min-h-screen bg-background">
        <div className="max-w-7xl mx-auto px-4 py-8">
          <Skeleton className="h-10 w-48 mb-8" />
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-6">
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

  const columnCount = Math.max(2, rackets.length + (rackets.length < 3 ? 1 : 0));
  const gridTemplate = `14rem repeat(${columnCount}, minmax(0, 1fr))`;

  return (
    <>
      <SEO {...seoData} />

      <div className={`fixed top-14 left-0 right-0 z-40 bg-background/95 backdrop-blur border-b shadow-md transition-all duration-300 ${isSticky ? "translate-y-0" : "-translate-y-full opacity-0"}`}>
        <div className="max-w-[1600px] mx-auto px-4 h-16 flex items-center">
          <div className="flex-1 overflow-x-auto no-scrollbar">
            <div className="grid items-center h-full" style={{ gridTemplateColumns: gridTemplate }}>
              <div className="font-black text-xs uppercase text-primary tracking-widest pl-4 border-r mr-6 h-full flex items-center">Compare</div>
              {rackets.map(r => (
                <div key={r.id} className="flex items-center gap-3 px-4 min-w-[200px] border-r border-border/30 last:border-r-0">
                  <img src={getOptimizedImageUrl(r.imageUrl || "", 80)} className="w-8 h-8 object-contain" alt={`${r.brand} ${r.model}`} />
                  <div className="min-w-0">
                    <p className="font-bold text-xs truncate uppercase tracking-tighter leading-none mb-1">{r.model}</p>
                    <p className="text-[10px] font-black text-primary bg-primary/10 rounded px-1 w-fit">SCORE: {r.overallRating}</p>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>

      <div className="min-h-screen bg-muted/20">
        <div className="max-w-[1600px] mx-auto px-4 sm:px-8 py-10">
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

          <div className="overflow-x-auto pb-8 -mx-4 px-4 sm:mx-0 sm:px-0 no-scrollbar">
            <div className="min-w-[640px] grid gap-1">
              {/* Header Grid */}
              <div className="grid items-stretch" style={{ gridTemplateColumns: gridTemplate }}>
                {/* Spacer for label column */}
                <div className="pr-8 py-6 flex flex-col justify-end">
                  <Badge variant="outline" className="w-fit mb-4 border-primary text-primary font-black animate-pulse">LIVE COMPARISON</Badge>
                  <h2 className="text-sm font-black uppercase tracking-widest text-muted-foreground opacity-50 italic">Quick View</h2>
                </div>

                {rackets.map((racket) => (
                  <Card key={racket.id} className="relative overflow-hidden group border-none bg-transparent shadow-none hover:bg-background/40 transition-colors">
                    <button
                      onClick={() => handleRemoveRacket(getRacketSlug(racket))}
                      className="absolute top-2 right-2 z-10 p-1.5 rounded-full bg-black/5 hover:bg-black/10 transition-colors opacity-0 group-hover:opacity-100"
                    >
                      <X className="h-4 w-4" />
                    </button>
                    <CardContent className="p-6 flex flex-col items-center">
                      <div className="w-full aspect-square mb-6 flex items-center justify-center max-h-48 group-hover:scale-105 transition-all duration-700 ease-out">
                        <img
                          src={getOptimizedImageUrl(racket.imageUrl || "", 400)}
                          alt={`${racket.brand} ${racket.model}`}
                          className="max-w-full max-h-full object-contain mx-auto drop-shadow-2xl"
                        />
                      </div>
                      <Badge variant="secondary" className="mb-2 bg-primary/10 text-primary border-none text-[10px] font-black uppercase tracking-tighter">{racket.brand}</Badge>
                      <h2 className="font-heading font-black text-lg mb-4 h-14 overflow-hidden leading-tight text-center">
                        <Link href={`/rackets/${getRacketSlug(racket)}`} className="hover:text-primary transition-colors decoration-primary/30 underline-offset-4 hover:underline">
                          {racket.model}
                        </Link>
                      </h2>
                      <div className="flex flex-col items-center gap-4">
                        <div className="flex items-center justify-center gap-2">
                          <span className="text-2xl font-black text-foreground tracking-tighter">€{Math.round(Number(racket.currentPrice))}</span>
                          {racket.originalPrice && Number(racket.originalPrice) > Number(racket.currentPrice) && (
                            <span className="text-xs text-muted-foreground line-through opacity-60">€{Math.round(Number(racket.originalPrice))}</span>
                          )}
                        </div>
                        {(racket.affiliateLink || racket.padelMarketAffiliateLink) && (
                          <Button asChild size="sm" className="w-full bg-primary hover:bg-primary/90 font-black shadow-lg shadow-primary/20 text-[10px] uppercase tracking-widest">
                            <a href={racket.affiliateLink || racket.padelMarketAffiliateLink || "#"} target="_blank" rel="sponsored nofollow noopener noreferrer">
                              Shop Best Price <ExternalLink className="ml-1 h-3 w-3" />
                            </a>
                          </Button>
                        )}
                      </div>
                    </CardContent>
                  </Card>
                ))}

                {rackets.length < 3 && (
                  <Card className="border-dashed border-2 flex flex-col items-center justify-center p-6 text-center min-h-[400px] bg-background/20 border-border/50">
                    {!showSearch ? (
                      <>
                        <div className="w-12 h-12 rounded-full bg-muted flex items-center justify-center mb-4">
                          <Plus className="h-6 w-6 text-muted-foreground opacity-30" />
                        </div>
                        <h3 className="font-black text-xs uppercase tracking-widest opacity-40 mb-2">Add Comparison</h3>
                        <Button variant="outline" size="sm" onClick={() => setShowSearch(true)} className="text-[10px] font-black uppercase tracking-widest">Search Racket</Button>
                      </>
                    ) : (
                      <div className="w-full space-y-4">
                        <div className="relative">
                          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-3 w-3 text-muted-foreground opacity-50" />
                          <Input
                            placeholder="Type brand/model..."
                            className="pl-8 h-8 text-xs font-bold bg-background/50 border-none"
                            autoFocus
                            value={searchQuery}
                            onChange={(e) => setSearchQuery(e.target.value)}
                          />
                        </div>
                        <div className="text-left space-y-1 bg-background/80 rounded-lg overflow-hidden p-1 shadow-inner">
                          {searchResults.map(r => (
                            <button
                              key={r.id}
                              onClick={() => handleAddRacket(getRacketSlug(r))}
                              className="w-full flex items-center gap-3 p-2 rounded hover:bg-primary/5 transition-colors text-xs font-bold"
                            >
                              <img src={getOptimizedImageUrl(r.imageUrl || "", 100)} className="w-6 h-6 object-contain" alt={`${r.brand} ${r.model}`} />
                              <span className="truncate">{`${r.brand} ${formatRacketDisplayName(r.brand, r.model, r.year)}`}</span>
                            </button>
                          ))}
                        </div>
                        <Button variant="ghost" size="sm" onClick={() => setShowSearch(false)} className="text-[10px] font-black uppercase">Cancel</Button>
                      </div>
                    )}
                  </Card>
                )}
              </div>

              {/* Unified Combined Card for Data */}
              <Card className="border-none shadow-2xl overflow-hidden bg-background/60 backdrop-blur-xl ring-1 ring-border/50">
                <div className="divide-y divide-border/30">
                  {/* Performance Ratings Section */}
                  <div className="bg-primary/5 p-4 flex items-center gap-2">
                    <Trophy className="h-4 w-4 text-primary" />
                    <span className="text-[10px] font-black uppercase tracking-[0.2em] text-primary">Performance Stats</span>
                  </div>
                  {ratingFields.map((field) => {
                    const values = rackets.map(r => Number(r[field.key]));
                    const maxVal = Math.max(...values);
                    const minVal = Math.min(...values);
                    const isDifferential = maxVal !== minVal;

                    return (
                      <div
                        key={field.key}
                        className={`grid items-center p-6 gap-6 transition-all duration-300 ${highlightDifferences && !isDifferential ? "opacity-20 translate-x-1" : "opacity-100"}`}
                        style={{ gridTemplateColumns: gridTemplate }}
                      >
                        <div className="space-y-1 border-r border-border/20">
                          <span className="font-black text-[11px] uppercase tracking-widest text-muted-foreground/60">{field.label}</span>
                          {highlightDifferences && isDifferential && (
                            <p className="text-[9px] text-primary font-black uppercase tracking-tighter shadow-sm w-fit bg-primary/5 rounded px-1">Varying</p>
                          )}
                        </div>
                        {rackets.map((racket, i) => {
                          const val = values[i];
                          const isWinner = isDifferential && val === maxVal;
                          return (
                            <div key={racket.id} className="relative px-4 group/item">
                              <div className="flex items-center gap-4">
                                <div className="flex-1 opacity-80 group-hover/item:opacity-100 transition-opacity">
                                  <RatingBar label="" value={val} abbreviation="" showLabel={false} />
                                </div>
                              </div>
                              {isWinner && (
                                <div className="absolute -top-7 right-4">
                                  <Badge className="bg-primary hover:bg-primary shadow-lg shadow-primary/20 text-[9px] font-black uppercase tracking-widest px-2 py-0">BEST IN CLASS</Badge>
                                </div>
                              )}
                            </div>
                          );
                        })}
                      </div>
                    );
                  })}

                  {/* Tech Specs Section */}
                  <div className="bg-muted/50 p-4 flex items-center gap-2">
                    <Info className="h-4 w-4 text-muted-foreground" />
                    <span className="text-[10px] font-black uppercase tracking-[0.2em] text-muted-foreground">Technical Specs</span>
                  </div>
                  {specFields.map((field) => {
                    const values = rackets.map(r => (r as any)[field.key] || "-");
                    const allSame = values.every((v, _, arr) => v === arr[0]);

                    return (
                      <div
                        key={field.key}
                        className={`grid items-center p-6 gap-6 transition-all duration-300 ${highlightDifferences && allSame ? "opacity-20" : "opacity-100"}`}
                        style={{ gridTemplateColumns: gridTemplate }}
                      >
                        <span className="font-black text-[11px] uppercase tracking-widest text-muted-foreground/60 border-r border-border/20 h-full flex items-center">{field.label}</span>
                        {rackets.map((racket, i) => (
                          <span key={racket.id} className={`text-sm font-black tracking-tight px-4 ${!allSame ? "text-primary" : "text-muted-foreground/80"}`}>
                            {values[i]}
                          </span>
                        ))}
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
