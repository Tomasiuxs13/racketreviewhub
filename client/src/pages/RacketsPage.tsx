import { useState, useMemo, useEffect } from "react";
import { useQuery } from "@tanstack/react-query";
import { Slider } from "@/components/ui/slider";
import { X, SlidersHorizontal, ChevronLeft, ChevronRight, PackageCheck, Circle, Diamond, Droplet } from "lucide-react";
import { RacketCard } from "@/components/RacketCard";
import type { Racket } from "@shared/schema";
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
  SheetTrigger,
} from "@/components/ui/sheet";
import { isValidBrandName, getRacketSlug } from "@/lib/utils";
import SEO from "@/components/SEO";
import { StructuredData } from "@/components/StructuredData";
import { Breadcrumbs } from "@/components/Breadcrumbs";
import { SITE_URL } from "@/lib/seo";

const ITEMS_PER_PAGE = 12;

const SHAPE_ICONS: Record<string, React.ReactNode> = {
  round: <Circle className="h-3.5 w-3.5" />,
  diamond: <Diamond className="h-3.5 w-3.5" />,
  teardrop: <Droplet className="h-3.5 w-3.5" />,
};

export default function RacketsPage() {
  const [selectedBrands, setSelectedBrands] = useState<string[]>([]);
  const [selectedShapes, setSelectedShapes] = useState<string[]>([]);
  const [selectedGenders, setSelectedGenders] = useState<string[]>([]);
  const [selectedLevels, setSelectedLevels] = useState<string[]>([]);
  const [priceRange, setPriceRange] = useState<number[]>([0, 500]);
  const [minRating, setMinRating] = useState<number>(0);
  const [inStockOnly, setInStockOnly] = useState<boolean>(false);
  const [sortBy, setSortBy] = useState<string>("rating");
  const [mobileFiltersOpen, setMobileFiltersOpen] = useState(false);
  const [currentPage, setCurrentPage] = useState<number>(1);

  // Use compact mode to exclude reviewContent (reduces payload significantly)
  const { data: rackets, isLoading } = useQuery<Racket[]>({
    queryKey: ["/api/rackets?fields=compact"],
  });

  // Get unique brands
  const brands = Array.from(new Set((rackets || []).map((r) => r.brand).filter(isValidBrandName))).sort();

  // Get top 5 most common shapes dynamically
  const shapeCounts = rackets?.reduce((acc, racket) => {
    const shape = racket.shape?.toLowerCase();
    if (shape) {
      acc[shape] = (acc[shape] || 0) + 1;
    }
    return acc;
  }, {} as Record<string, number>) || {};

  const gameLevels = ["Beginner", "Intermediate", "Advanced", "Professional"];

  const topShapes = Object.entries(shapeCounts)
    .sort(([, a], [, b]) => b - a)
    .slice(0, 5)
    .map(([shape]) => shape);

  // Filter and sort rackets
  const filteredRackets = rackets
    ?.filter((racket) => {
      if (selectedBrands.length > 0 && !selectedBrands.includes(racket.brand)) return false;
      if (selectedShapes.length > 0 && !selectedShapes.includes(racket.shape?.toLowerCase())) return false;
      if (selectedGenders.length > 0) {
        let racketGender = racket.player?.toLowerCase().trim() || "";

        if (
          racketGender === "both" ||
          racketGender === "unisex" ||
          racketGender.includes("and") ||
          racketGender.includes("&")
        ) {
          racketGender = "unisex";
        } else if (racketGender.includes("woman") || racketGender.includes("women") || racketGender === "female") {
          racketGender = "woman";
        } else if (racketGender.includes("man") || racketGender.includes("men") || racketGender === "male") {
          racketGender = "man";
        }

        if (!racketGender || !selectedGenders.includes(racketGender)) {
          return false;
        }
      }
      if (selectedLevels.length > 0) {
        if (!racket.gameLevel || !selectedLevels.includes(racket.gameLevel)) return false;
      }
      const price = Number(racket.currentPrice) || 0;
      if (price < priceRange[0] || price > priceRange[1]) return false;

      if (racket.overallRating < minRating) return false;
      if (inStockOnly && !(racket.inStock || racket.padelMarketInStock)) return false;
      return true;
    })
    .sort((a, b) => {
      // Always sort in-stock items first
      const aInStock = a.inStock || a.padelMarketInStock ? 1 : 0;
      const bInStock = b.inStock || b.padelMarketInStock ? 1 : 0;
      if (bInStock !== aInStock) return bInStock - aInStock;

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

  // Pagination calculations
  const totalRackets = filteredRackets?.length || 0;
  const totalPages = Math.ceil(totalRackets / ITEMS_PER_PAGE);
  const startIndex = (currentPage - 1) * ITEMS_PER_PAGE;
  const endIndex = startIndex + ITEMS_PER_PAGE;
  const paginatedRackets = filteredRackets?.slice(startIndex, endIndex) || [];

  // Reset to page 1 when filters change
  useEffect(() => {
    setCurrentPage(1);
  }, [selectedBrands, selectedShapes, selectedGenders, selectedLevels, priceRange, minRating, inStockOnly, sortBy]);

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

  const toggleGender = (gender: string) => {
    setSelectedGenders((prev) =>
      prev.includes(gender) ? prev.filter((g) => g !== gender) : [...prev, gender]
    );
  };

  const toggleLevel = (level: string) => {
    setSelectedLevels((prev) =>
      prev.includes(level) ? prev.filter((l) => l !== level) : [...prev, level]
    );
  };

  const clearFilters = () => {
    setSelectedBrands([]);
    setSelectedShapes([]);
    setSelectedGenders([]);
    setSelectedLevels([]);
    setPriceRange([0, 500]);
    setMinRating(0);
    setInStockOnly(false);
  };

  const hasActiveFilters = selectedBrands.length > 0 || selectedShapes.length > 0 || selectedGenders.length > 0 || selectedLevels.length > 0 || minRating > 0 || inStockOnly || priceRange[0] > 0 || priceRange[1] < 500;

  const seoData = {
    title: "Padel Racket Reviews - Compare Expert Ratings & Find Best Prices",
    description:
      "Compare padel racket reviews from expert testers. Detailed ratings for power, control, and performance. Find the best prices with our affiliate links to top retailers.",
    url: "/rackets",
    canonical: "/rackets",
  };

  // Structured data
  const structuredData = useMemo(() => {
    const siteUrl = SITE_URL;
    const schemas = [];

    schemas.push({
      "@context": "https://schema.org",
      "@type": "CollectionPage",
      "name": "Padel Racket Reviews",
      "description": seoData.description,
      "url": seoData.canonical,
    });

    if (filteredRackets && filteredRackets.length > 0) {
      schemas.push({
        "@context": "https://schema.org",
        "@type": "ItemList",
        "itemListElement": filteredRackets.slice(0, 20).map((racket, index) => {
          const overall100 = Number(racket.overallRating) || 0;
          const rating5 = overall100 > 0 ? Math.round((overall100 / 20) * 10) / 10 : 0;
          const priceNum = Number(racket.currentPrice) || 0;
          return {
            "@type": "ListItem",
            "position": index + 1,
            "item": {
              "@type": "Product",
              "name": `${racket.brand} ${racket.model} ${racket.year || ""}`.trim(),
              "description": `Expert review of the ${racket.brand} ${racket.model} padel racket.`,
              "url": `${siteUrl}/rackets/${getRacketSlug(racket)}`,
              ...(racket.imageUrl ? { "image": racket.imageUrl } : {}),
              "brand": {
                "@type": "Brand",
                "name": racket.brand,
              },
              ...(rating5 > 0 ? {
                "aggregateRating": {
                  "@type": "AggregateRating",
                  "ratingValue": rating5,
                  "bestRating": 5,
                  "worstRating": 0,
                  "ratingCount": 1,
                  "reviewCount": 1,
                },
              } : {}),
              ...(priceNum > 0 ? {
                "offers": {
                  "@type": "Offer",
                  "price": priceNum.toFixed(2),
                  "priceCurrency": "EUR",
                  "availability": "https://schema.org/InStock",
                  "url": racket.affiliateLink || racket.titleUrl || `${siteUrl}/rackets/${getRacketSlug(racket)}`,
                },
              } : {}),
            },
          };
        }),
      });
    }

    schemas.push({
      "@context": "https://schema.org",
      "@type": "BreadcrumbList",
      "itemListElement": [
        {
          "@type": "ListItem",
          "position": 1,
          "name": "Home",
          "item": siteUrl,
        },
        {
          "@type": "ListItem",
          "position": 2,
          "name": "Rackets",
          "item": seoData.canonical,
        },
      ],
    });

    return schemas;
  }, [filteredRackets, seoData.canonical, seoData.description]);

  // Count in-stock rackets for display
  const inStockCount = rackets?.filter(r => r.inStock || r.padelMarketInStock).length || 0;

  const activeFilterCount = selectedBrands.length + selectedShapes.length + selectedGenders.length + selectedLevels.length + (minRating > 0 ? 1 : 0) + (inStockOnly ? 1 : 0) + ((priceRange[0] > 0 || priceRange[1] < 500) ? 1 : 0);

  const FilterContent = () => (
    <div className="space-y-8">
      {/* Brand Filter — Dropdown */}
      <div className="space-y-3">
        <label className="ds-label">Brand</label>
        <select
          multiple
          value={selectedBrands}
          onChange={(e) => setSelectedBrands(Array.from(e.target.selectedOptions, option => option.value))}
          className="w-full bg-white border border-ds-outline-variant/20 rounded-xl text-xs font-medium py-2 px-3 focus:ring-2 focus:ring-ds-primary-container cursor-pointer text-ds-on-surface"
          size={Math.min(6, brands.length + 1)}
          data-testid="select-brands"
        >
          <option value="">-- All Brands --</option>
          {brands.map((brand) => (
            <option key={brand} value={brand} data-testid={`option-brand-${brand}`}>
              {brand}
            </option>
          ))}
        </select>
      </div>

      {/* Price Range */}
      <div className="space-y-3">
        <label className="ds-label">Price Range</label>
        <div className="px-2">
          <Slider
            min={0}
            max={500}
            step={10}
            value={priceRange}
            onValueChange={setPriceRange}
            className="my-2"
          />
          <div className="flex justify-between mt-2 text-[11px] text-ds-on-surface-variant font-medium">
            <span>€{priceRange[0]}</span>
            <span>€{priceRange[1]}+</span>
          </div>
        </div>
      </div>

      {/* Racket Shape — Icon Buttons */}
      <div className="space-y-3">
        <label className="ds-label">Racket Shape</label>
        <div className="grid grid-cols-2 gap-2">
          {topShapes.map((shape) => (
            <button
              key={shape}
              onClick={() => toggleShape(shape)}
              className={`flex items-center gap-2 p-2.5 rounded-xl text-xs font-medium transition-all ${
                selectedShapes.includes(shape)
                  ? "bg-ds-primary text-white"
                  : "bg-white border border-ds-outline-variant/20 hover:border-ds-primary-container text-ds-on-surface"
              }`}
              data-testid={`checkbox-shape-${shape}`}
            >
              {SHAPE_ICONS[shape] || <Circle className="h-3.5 w-3.5" />}
              <span className="capitalize">{shape}</span>
            </button>
          ))}
        </div>
      </div>

      {/* Player Level — Checkboxes */}
      <div className="space-y-3">
        <label className="ds-label">Level</label>
        <div className="space-y-2.5">
          {gameLevels.map((level) => (
            <label key={level} className="flex items-center gap-3 cursor-pointer group">
              <input
                type="checkbox"
                checked={selectedLevels.includes(level)}
                onChange={() => toggleLevel(level)}
                className="rounded-sm border-ds-outline-variant text-ds-primary focus:ring-ds-primary-container h-3.5 w-3.5"
                data-testid={`checkbox-level-${level}`}
              />
              <span className="text-xs text-ds-on-surface-variant group-hover:text-ds-on-surface transition-colors">
                {level}
              </span>
            </label>
          ))}
        </div>
      </div>

      {/* Gender Filter */}
      <div className="space-y-3">
        <label className="ds-label">Gender</label>
        <div className="space-y-2.5">
          {["man", "woman", "unisex"].map((gender) => (
            <label key={gender} className="flex items-center gap-3 cursor-pointer group">
              <input
                type="checkbox"
                checked={selectedGenders.includes(gender)}
                onChange={() => toggleGender(gender)}
                className="rounded-sm border-ds-outline-variant text-ds-primary focus:ring-ds-primary-container h-3.5 w-3.5"
                data-testid={`checkbox-gender-${gender}`}
              />
              <span className="text-xs text-ds-on-surface-variant group-hover:text-ds-on-surface transition-colors capitalize">
                {gender}
              </span>
            </label>
          ))}
        </div>
      </div>

      {/* Minimum Rating */}
      <div className="space-y-3">
        <label className="ds-label">Minimum Rating</label>
        <div className="flex flex-wrap gap-2">
          {[0, 75, 80, 85, 90].map((rating) => (
            <button
              key={rating}
              onClick={() => setMinRating(rating)}
              className={`px-3 py-1 text-xs rounded-full font-medium transition-colors ${
                minRating === rating
                  ? "bg-ds-primary text-white"
                  : "bg-ds-surface-highest text-ds-on-surface hover:bg-ds-surface-high"
              }`}
              data-testid={rating === 0 ? "select-rating-all" : `select-rating-${rating}`}
            >
              {rating === 0 ? "All" : `${rating}+`}
            </button>
          ))}
        </div>
      </div>

      {/* In Stock Toggle */}
      <div className="space-y-3">
        <label className="ds-label">Availability</label>
        <button
          onClick={() => setInStockOnly(!inStockOnly)}
          className={`flex items-center gap-2 px-3 py-2 rounded-xl text-xs font-medium transition-all w-full ${
            inStockOnly
              ? "bg-ds-primary text-white"
              : "bg-white border border-ds-outline-variant/20 hover:border-ds-primary-container text-ds-on-surface"
          }`}
        >
          <PackageCheck className="h-3.5 w-3.5" />
          In Stock Only
          <span className={`ml-auto text-[10px] ${inStockOnly ? "text-white/70" : "text-ds-secondary"}`}>
            ({inStockCount})
          </span>
        </button>
      </div>

      {/* Reset Filters */}
      {hasActiveFilters && (
        <button
          onClick={clearFilters}
          className="w-full py-3 bg-ds-inverse-surface text-ds-inverse-on-surface rounded-xl font-bold text-xs uppercase tracking-[0.15em] hover:opacity-90 transition-opacity"
          data-testid="button-clear-filters"
        >
          Reset Filters
        </button>
      )}
    </div>
  );

  // Generate pagination numbers
  const paginationPages = useMemo(() => {
    const pages: (number | "ellipsis")[] = [];
    if (totalPages <= 5) {
      for (let i = 1; i <= totalPages; i++) pages.push(i);
    } else {
      pages.push(1);
      if (currentPage > 3) pages.push("ellipsis");
      for (let i = Math.max(2, currentPage - 1); i <= Math.min(totalPages - 1, currentPage + 1); i++) {
        pages.push(i);
      }
      if (currentPage < totalPages - 2) pages.push("ellipsis");
      pages.push(totalPages);
    }
    return pages;
  }, [currentPage, totalPages]);

  return (
    <>
      <SEO {...seoData} />
      <StructuredData data={structuredData} />
      <div className="min-h-screen bg-ds-surface">
        <main className="max-w-7xl mx-auto px-4 sm:px-6 py-6 sm:py-8 flex flex-col lg:flex-row gap-8">
          {/* Breadcrumbs — full width above the flex layout */}
          <div className="w-full lg:hidden">
            <Breadcrumbs items={[{ label: "Rackets" }]} />
          </div>

          {/* Desktop Sidebar Filters */}
          <aside className="hidden lg:block w-72 shrink-0">
            <div className="sticky top-24 space-y-8">
              {/* Breadcrumbs in sidebar area on desktop */}
              <Breadcrumbs items={[{ label: "Rackets" }]} />
              <div>
                <h3 className="font-heading font-extrabold text-sm uppercase tracking-[0.15em] text-ds-on-surface mb-6">
                  Refine Selection
                </h3>
                <FilterContent />
              </div>
            </div>
          </aside>

          {/* Main Content */}
          <section className="flex-1 min-w-0">
            {/* Header & Sorting */}
            <div className="flex flex-col md:flex-row md:items-end justify-between mb-6 sm:mb-8 gap-4">
              <div>
                <span className="ds-label text-ds-primary tracking-[0.2em]">
                  Elite Performance Editorial
                </span>
                <h1
                  className="text-3xl sm:text-4xl font-heading font-black tracking-tighter mt-1 text-ds-on-surface"
                  data-testid="text-page-title"
                >
                  Padel Rackets {new Date().getFullYear()}
                </h1>
              </div>
              <div className="flex items-center gap-4">
                {/* Mobile Filter Button */}
                <Sheet open={mobileFiltersOpen} onOpenChange={setMobileFiltersOpen}>
                  <SheetTrigger asChild>
                    <button className="lg:hidden flex items-center gap-2 px-4 py-2 bg-white rounded-xl text-xs font-bold text-ds-on-surface" data-testid="button-mobile-filters">
                      <SlidersHorizontal className="h-4 w-4" />
                      Filters
                      {activeFilterCount > 0 && (
                        <span className="bg-ds-primary text-white text-[10px] rounded-full w-5 h-5 flex items-center justify-center font-bold">
                          {activeFilterCount}
                        </span>
                      )}
                    </button>
                  </SheetTrigger>
                  <SheetContent side="left" className="w-full max-w-xs sm:max-w-sm bg-ds-surface">
                    <SheetHeader>
                      <SheetTitle className="font-heading font-extrabold text-sm uppercase tracking-[0.15em]">
                        Refine Selection
                      </SheetTitle>
                    </SheetHeader>
                    <div className="mt-6 pb-6 overflow-y-auto h-[calc(100vh-5rem)]">
                      <FilterContent />
                    </div>
                  </SheetContent>
                </Sheet>

                {!isLoading && (
                  <span className="text-xs font-medium text-ds-on-surface-variant" data-testid="text-results-count">
                    Showing {totalRackets} results
                  </span>
                )}
                <select
                  value={sortBy}
                  onChange={(e) => setSortBy(e.target.value)}
                  className="bg-white border-none rounded-xl text-xs font-bold py-2.5 pl-4 pr-10 focus:ring-2 focus:ring-ds-primary-container cursor-pointer text-ds-on-surface"
                  data-testid="select-sort"
                >
                  <option value="rating">Top Rated First</option>
                  <option value="price-low">Price: Low to High</option>
                  <option value="price-high">Price: High to Low</option>
                  <option value="newest">Newest Arrival</option>
                </select>
              </div>
            </div>

            {/* Active Filter Badges */}
            {hasActiveFilters && (
              <div className="flex items-center gap-2 flex-wrap mb-6">
                {selectedBrands.map((brand) => (
                  <span key={brand} className="inline-flex items-center gap-1 px-3 py-1 bg-ds-primary/10 text-ds-primary text-xs font-medium rounded-full" data-testid={`badge-filter-${brand}`}>
                    {brand}
                    <button onClick={() => toggleBrand(brand)} className="hover:text-ds-on-surface">
                      <X className="h-3 w-3" />
                    </button>
                  </span>
                ))}
                {selectedShapes.map((shape) => (
                  <span key={shape} className="inline-flex items-center gap-1 px-3 py-1 bg-ds-primary/10 text-ds-primary text-xs font-medium rounded-full capitalize" data-testid={`badge-filter-${shape}`}>
                    {shape}
                    <button onClick={() => toggleShape(shape)} className="hover:text-ds-on-surface">
                      <X className="h-3 w-3" />
                    </button>
                  </span>
                ))}
                {selectedGenders.map((gender) => (
                  <span key={gender} className="inline-flex items-center gap-1 px-3 py-1 bg-ds-primary/10 text-ds-primary text-xs font-medium rounded-full capitalize" data-testid={`badge-filter-gender-${gender}`}>
                    {gender}
                    <button onClick={() => toggleGender(gender)} className="hover:text-ds-on-surface">
                      <X className="h-3 w-3" />
                    </button>
                  </span>
                ))}
                {selectedLevels.map((level) => (
                  <span key={level} className="inline-flex items-center gap-1 px-3 py-1 bg-ds-primary/10 text-ds-primary text-xs font-medium rounded-full" data-testid={`badge-filter-level-${level}`}>
                    {level}
                    <button onClick={() => toggleLevel(level)} className="hover:text-ds-on-surface">
                      <X className="h-3 w-3" />
                    </button>
                  </span>
                ))}
                {(priceRange[0] > 0 || priceRange[1] < 500) && (
                  <span className="inline-flex items-center gap-1 px-3 py-1 bg-ds-primary/10 text-ds-primary text-xs font-medium rounded-full" data-testid="badge-filter-price">
                    €{priceRange[0]} - €{priceRange[1]}
                    <button onClick={() => setPriceRange([0, 500])} className="hover:text-ds-on-surface">
                      <X className="h-3 w-3" />
                    </button>
                  </span>
                )}
                {minRating > 0 && (
                  <span className="inline-flex items-center gap-1 px-3 py-1 bg-ds-primary/10 text-ds-primary text-xs font-medium rounded-full" data-testid="badge-filter-rating">
                    Rating {minRating}+
                    <button onClick={() => setMinRating(0)} className="hover:text-ds-on-surface">
                      <X className="h-3 w-3" />
                    </button>
                  </span>
                )}
                {inStockOnly && (
                  <span className="inline-flex items-center gap-1 px-3 py-1 bg-ds-primary/10 text-ds-primary text-xs font-medium rounded-full">
                    In Stock Only
                    <button onClick={() => setInStockOnly(false)} className="hover:text-ds-on-surface">
                      <X className="h-3 w-3" />
                    </button>
                  </span>
                )}
                <button
                  onClick={clearFilters}
                  className="text-xs font-bold text-ds-error hover:underline ml-1"
                >
                  Clear all
                </button>
              </div>
            )}

            {/* Rackets Grid */}
            {isLoading ? (
              <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-6">
                {Array.from({ length: 12 }).map((_, i) => (
                  <div key={i} className="bg-white rounded-3xl overflow-hidden animate-pulse">
                    <div className="h-72 sm:h-80 bg-ds-surface-low" />
                    <div className="p-6 space-y-4">
                      <div className="h-5 bg-ds-surface-low rounded w-3/4" />
                      <div className="h-3 bg-ds-surface-low rounded w-1/2" />
                      <div className="space-y-3">
                        <div className="h-1.5 bg-ds-surface-low rounded-full" />
                        <div className="h-1.5 bg-ds-surface-low rounded-full" />
                      </div>
                      <div className="grid grid-cols-3 gap-3">
                        <div className="h-12 bg-ds-surface-low rounded-xl" />
                        <div className="h-12 bg-ds-surface-low rounded-xl" />
                        <div className="h-12 bg-ds-surface-low rounded-xl" />
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            ) : filteredRackets && filteredRackets.length > 0 ? (
              <>
                <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-6">
                  {paginatedRackets.map((racket) => (
                    <RacketCard key={racket.id} racket={racket} />
                  ))}
                </div>

                {/* Pagination */}
                {totalPages > 1 && (
                  <div className="mt-12 flex flex-col items-center gap-6">
                    <div className="flex items-center gap-1">
                      <button
                        onClick={() => setCurrentPage((prev) => Math.max(1, prev - 1))}
                        disabled={currentPage === 1}
                        className="w-10 h-10 flex items-center justify-center rounded-xl bg-ds-surface-high text-ds-on-surface hover:bg-ds-surface-dim transition-colors disabled:opacity-40"
                      >
                        <ChevronLeft className="h-4 w-4" />
                      </button>
                      {paginationPages.map((page, idx) =>
                        page === "ellipsis" ? (
                          <span key={`ellipsis-${idx}`} className="px-2 text-ds-on-surface-variant">...</span>
                        ) : (
                          <button
                            key={page}
                            onClick={() => setCurrentPage(page)}
                            className={`w-10 h-10 flex items-center justify-center rounded-xl font-bold text-sm transition-colors ${
                              currentPage === page
                                ? "bg-ds-primary text-white"
                                : "bg-white text-ds-on-surface hover:bg-ds-surface-high"
                            }`}
                          >
                            {page}
                          </button>
                        )
                      )}
                      <button
                        onClick={() => setCurrentPage((prev) => Math.min(totalPages, prev + 1))}
                        disabled={currentPage === totalPages}
                        className="w-10 h-10 flex items-center justify-center rounded-xl bg-ds-surface-high text-ds-on-surface hover:bg-ds-surface-dim transition-colors disabled:opacity-40"
                      >
                        <ChevronRight className="h-4 w-4" />
                      </button>
                    </div>
                  </div>
                )}
              </>
            ) : (
              <div className="bg-white rounded-3xl p-16 text-center">
                <p className="text-ds-on-surface-variant mb-4">
                  No rackets found matching your filters
                </p>
                {hasActiveFilters && (
                  <button
                    onClick={clearFilters}
                    className="ds-btn-primary"
                    data-testid="button-clear-filters-empty"
                  >
                    Clear Filters
                  </button>
                )}
              </div>
            )}
          </section>
        </main>
      </div>
    </>
  );
}
