import { Link, useLocation } from "wouter";
import { Search, Menu, X, User, LogOut } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent } from "@/components/ui/card";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { useAuth } from "@/hooks/useAuth";
import { useState, useEffect, useRef } from "react";
import { useQuery } from "@tanstack/react-query";
import type { Racket } from "@shared/schema";
import { apiRequest } from "@/lib/queryClient";
import { getRacketSlug } from "@/lib/utils";
import { useDebounce } from "@/hooks/useDebounce";
import { LanguageSwitcher } from "@/components/LanguageSwitcher";
import { useI18n } from "@/i18n/useI18n";

const NAV_LINKS = [
  { id: "rackets", path: "/rackets", labelKey: "header.menu.rackets" },
  { id: "guides", path: "/guides", labelKey: "header.menu.guides" },
  { id: "brands", path: "/brands", labelKey: "header.menu.brands" },
  { id: "blog", path: "/blog", labelKey: "header.menu.blog" },
];

export function Header() {
  const [location] = useLocation();
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const [searchQuery, setSearchQuery] = useState("");
  const [showSearchResults, setShowSearchResults] = useState(false);
  const searchRef = useRef<HTMLDivElement>(null);
  const { user, isAuthenticated, signOut } = useAuth();
  const debouncedSearch = useDebounce(searchQuery, 300);
  const { t, locale } = useI18n();

  const handleSearchInputChange = (value: string) => {
    setSearchQuery(value);
    setShowSearchResults(value.trim().length > 0);
  };

  // Search query
  const { data: searchResults = [] } = useQuery<Racket[]>({
    queryKey: ["/api/rackets/search", debouncedSearch, locale],
    enabled: debouncedSearch.trim().length > 0,
    queryFn: async () => {
      const response = await apiRequest(
        "GET",
        `/api/rackets/search?q=${encodeURIComponent(debouncedSearch)}&lang=${locale}`,
      );
      return await response.json();
    },
  });

  // Close search results when clicking outside
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (searchRef.current && !searchRef.current.contains(event.target as Node)) {
        setShowSearchResults(false);
      }
    };

    if (showSearchResults) {
      document.addEventListener("mousedown", handleClickOutside);
      return () => document.removeEventListener("mousedown", handleClickOutside);
    }
  }, [showSearchResults]);

  useEffect(() => {
    const originalOverflow = document.body.style.overflow;
    if (mobileMenuOpen) {
      document.body.style.overflow = "hidden";
    } else {
      document.body.style.overflow = "";
    }

    return () => {
      document.body.style.overflow = originalOverflow;
    };
  }, [mobileMenuOpen]);

  useEffect(() => {
    setMobileMenuOpen(false);
  }, [location]);

  const isActive = (path: string) => location === path;

  return (
    <header className="sticky top-0 z-50 w-full border-b bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/60">
      <div className="max-w-7xl mx-auto px-4 sm:px-6">
        <div className="flex h-14 sm:h-16 items-center justify-between gap-4">
          {/* Logo */}
          <Link href="/">
            <div className="flex items-center gap-2 hover-elevate rounded-md px-3 py-2 -ml-1 sm:-ml-3 cursor-pointer" data-testid="link-home">
              <div className="flex items-center gap-2">
                <div className="w-8 h-8 rounded-md bg-primary flex items-center justify-center">
                  <span className="text-primary-foreground font-bold text-lg">P</span>
                </div>
                <span className="font-heading font-bold text-xl hidden sm:inline">
                  {t("common.brandName")}
                </span>
              </div>
            </div>
          </Link>

          {/* Desktop Navigation */}
          <nav className="hidden md:flex items-center gap-1">
            {NAV_LINKS.map((item) => (
              <Link key={item.path} href={item.path}>
                <div
                  className={`px-4 py-2 rounded-md text-sm font-medium transition-colors hover-elevate cursor-pointer ${
                    isActive(item.path)
                      ? "bg-accent text-accent-foreground"
                      : "text-foreground/80 hover:text-foreground"
                  }`}
                  data-testid={`link-${item.id}`}
                >
                  {t(item.labelKey)}
                </div>
              </Link>
            ))}
          </nav>

          {/* Right Section */}
          <div className="flex items-center gap-3">
            {/* Search Bar - Desktop */}
            <div className="hidden lg:flex items-center relative" ref={searchRef}>
              <Search className="absolute left-3 h-4 w-4 text-muted-foreground z-10" />
              <Input
                type="search"
                placeholder={t("header.search.placeholder")}
                className="pl-9 w-64"
                value={searchQuery}
                onChange={(e) => handleSearchInputChange(e.target.value)}
                onFocus={() => setShowSearchResults(true)}
                data-testid="input-search"
              />
              {/* Search Results Dropdown */}
              {showSearchResults && searchQuery.trim().length > 0 && (
                <div className="absolute top-full left-0 right-0 mt-2 bg-background border rounded-lg shadow-lg z-50 max-h-96 overflow-y-auto">
                  {searchResults.length > 0 ? (
                    <div className="p-2">
                      {searchResults.map((racket) => (
                        <Link
                          key={racket.id}
                          href={`/rackets/${getRacketSlug(racket)}`}
                          onClick={() => {
                            setShowSearchResults(false);
                            setSearchQuery("");
                          }}
                        >
                          <Card className="mb-2 hover-elevate cursor-pointer transition-all">
                            <CardContent className="p-3">
                              <div className="flex items-center gap-3">
                                {racket.imageUrl && (
                                  <img
                                    src={racket.imageUrl}
                                    alt={`${racket.brand} ${racket.model}`}
                                    className="w-12 h-12 object-contain"
                                  />
                                )}
                                <div className="flex-1 min-w-0">
                                  <p className="font-semibold truncate">
                                    {racket.brand} {racket.model}
                                  </p>
                                  <p className="text-sm text-muted-foreground">
                                    €{Number(racket.currentPrice).toFixed(2)}
                                  </p>
                                </div>
                              </div>
                            </CardContent>
                          </Card>
                        </Link>
                      ))}
                    </div>
                  ) : (
                    <div className="p-4 text-center text-muted-foreground">
                      {t("header.search.noResults")}
                    </div>
                  )}
                </div>
              )}
            </div>

            <LanguageSwitcher className="hidden md:flex" />

            {/* Trust Badge */}
            <Badge variant="secondary" className="hidden xl:flex">
              {t("header.trustBadge")}
            </Badge>

            {/* Auth Section */}
            {isAuthenticated && (
              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <Button variant="ghost" size="sm" className="hidden md:flex">
                    <User className="h-4 w-4 mr-2" />
                    {user?.email?.split("@")[0] || t("header.auth.userPlaceholder")}
                  </Button>
                </DropdownMenuTrigger>
                <DropdownMenuContent align="end">
                  <DropdownMenuLabel>
                    {user?.email}
                  </DropdownMenuLabel>
                  <DropdownMenuSeparator />
                  <DropdownMenuItem onClick={signOut}>
                    <LogOut className="h-4 w-4 mr-2" />
                    {t("header.auth.logout")}
                  </DropdownMenuItem>
                </DropdownMenuContent>
              </DropdownMenu>
            )}

            {/* Mobile Menu Button */}
            <Button
              variant="ghost"
              size="icon"
              className="md:hidden"
              onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
              data-testid="button-menu-toggle"
              aria-expanded={mobileMenuOpen}
            >
              {mobileMenuOpen ? <X className="h-5 w-5" /> : <Menu className="h-5 w-5" />}
            </Button>
          </div>
        </div>

        {/* Mobile Menu */}
        {mobileMenuOpen && (
          <div className="md:hidden border-t pt-4 pb-6 space-y-4 max-h-[calc(100vh-4rem)] overflow-y-auto overscroll-contain px-1">
            {/* Mobile Search */}
            <div className="relative">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground z-10" />
              <Input
                type="search"
                placeholder={t("header.search.placeholder")}
                className="pl-9"
                value={searchQuery}
                onChange={(e) => handleSearchInputChange(e.target.value)}
                data-testid="input-search-mobile"
              />
              {/* Mobile Search Results */}
              {searchQuery.trim().length > 0 && searchResults.length > 0 && (
                <div className="mt-2 bg-background border rounded-lg shadow-lg max-h-64 overflow-y-auto">
                  {searchResults.map((racket) => (
                    <Link
                      key={racket.id}
                      href={`/rackets/${getRacketSlug(racket)}`}
                      onClick={() => {
                        setSearchQuery("");
                        setMobileMenuOpen(false);
                      }}
                    >
                      <Card className="mb-2 hover-elevate cursor-pointer transition-all">
                        <CardContent className="p-3">
                          <div className="flex items-center gap-3">
                            {racket.imageUrl && (
                              <img
                                src={racket.imageUrl}
                                alt={`${racket.brand} ${racket.model}`}
                                className="w-12 h-12 object-contain"
                              />
                            )}
                            <div className="flex-1 min-w-0">
                              <p className="font-semibold truncate">
                                {racket.brand} {racket.model}
                              </p>
                              <p className="text-sm text-muted-foreground">
                                €{Number(racket.currentPrice).toFixed(2)}
                              </p>
                            </div>
                          </div>
                        </CardContent>
                      </Card>
                    </Link>
                  ))}
                </div>
              )}
            </div>

            {/* Mobile Navigation */}
            <nav className="flex flex-col gap-2">
              {NAV_LINKS.map((item) => (
                <Link key={item.path} href={item.path}>
                  <div
                    className={`px-4 py-3 rounded-md text-sm font-medium transition-colors hover-elevate cursor-pointer ${
                      isActive(item.path)
                        ? "bg-accent text-accent-foreground"
                        : "text-foreground/80 hover:text-foreground"
                    }`}
                    onClick={() => setMobileMenuOpen(false)}
                    data-testid={`link-mobile-${item.id}`}
                  >
                    {t(item.labelKey)}
                  </div>
                </Link>
              ))}
              {isAuthenticated && (
                <div
                  className="px-4 py-3 rounded-md text-sm font-medium text-foreground/80 hover:text-foreground hover-elevate cursor-pointer"
                  onClick={() => {
                    signOut();
                    setMobileMenuOpen(false);
                  }}
                >
                  {t("header.auth.logout")}
                </div>
              )}
            </nav>

            <LanguageSwitcher variant="select" className="pt-2" />
          </div>
        )}
      </div>
    </header>
  );
}
