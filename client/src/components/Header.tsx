import { Link, useLocation } from "wouter";
import { Search, Menu, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { useState } from "react";

export function Header() {
  const [location] = useLocation();
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const [searchQuery, setSearchQuery] = useState("");

  const menuItems = [
    { label: "Padel Rackets", path: "/rackets" },
    { label: "Guides", path: "/guides" },
    { label: "Brands", path: "/brands" },
    { label: "Blog", path: "/blog" },
  ];

  const isActive = (path: string) => location === path;

  return (
    <header className="sticky top-0 z-50 w-full border-b bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/60">
      <div className="max-w-7xl mx-auto px-6">
        <div className="flex h-16 items-center justify-between gap-4">
          {/* Logo */}
          <Link href="/">
            <div className="flex items-center gap-2 hover-elevate rounded-md px-3 py-2 -ml-3 cursor-pointer" data-testid="link-home">
              <div className="flex items-center gap-2">
                <div className="w-8 h-8 rounded-md bg-primary flex items-center justify-center">
                  <span className="text-primary-foreground font-bold text-lg">P</span>
                </div>
                <span className="font-heading font-bold text-xl hidden sm:inline">PadelPro</span>
              </div>
            </div>
          </Link>

          {/* Desktop Navigation */}
          <nav className="hidden md:flex items-center gap-1">
            {menuItems.map((item) => (
              <Link key={item.path} href={item.path}>
                <div
                  className={`px-4 py-2 rounded-md text-sm font-medium transition-colors hover-elevate cursor-pointer ${
                    isActive(item.path)
                      ? "bg-accent text-accent-foreground"
                      : "text-foreground/80 hover:text-foreground"
                  }`}
                  data-testid={`link-${item.label.toLowerCase().replace(" ", "-")}`}
                >
                  {item.label}
                </div>
              </Link>
            ))}
          </nav>

          {/* Right Section */}
          <div className="flex items-center gap-3">
            {/* Search Bar - Desktop */}
            <div className="hidden lg:flex items-center relative">
              <Search className="absolute left-3 h-4 w-4 text-muted-foreground" />
              <Input
                type="search"
                placeholder="Search rackets..."
                className="pl-9 w-64"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                data-testid="input-search"
              />
            </div>

            {/* Trust Badge */}
            <Badge variant="secondary" className="hidden xl:flex">
              1,200+ Rackets Reviewed
            </Badge>

            {/* Admin Link */}
            <Link href="/admin" data-testid="link-admin">
              <Button
                variant="outline"
                size="sm"
                className="hidden md:flex"
                data-testid="button-admin"
              >
                Admin
              </Button>
            </Link>

            {/* Mobile Menu Button */}
            <Button
              variant="ghost"
              size="icon"
              className="md:hidden"
              onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
              data-testid="button-menu-toggle"
            >
              {mobileMenuOpen ? <X className="h-5 w-5" /> : <Menu className="h-5 w-5" />}
            </Button>
          </div>
        </div>

        {/* Mobile Menu */}
        {mobileMenuOpen && (
          <div className="md:hidden py-4 border-t">
            {/* Mobile Search */}
            <div className="mb-4 relative">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <Input
                type="search"
                placeholder="Search rackets..."
                className="pl-9"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                data-testid="input-search-mobile"
              />
            </div>

            {/* Mobile Navigation */}
            <nav className="flex flex-col gap-2">
              {menuItems.map((item) => (
                <Link key={item.path} href={item.path}>
                  <div
                    className={`px-4 py-3 rounded-md text-sm font-medium transition-colors hover-elevate cursor-pointer ${
                      isActive(item.path)
                        ? "bg-accent text-accent-foreground"
                        : "text-foreground/80 hover:text-foreground"
                    }`}
                    onClick={() => setMobileMenuOpen(false)}
                    data-testid={`link-mobile-${item.label.toLowerCase().replace(" ", "-")}`}
                  >
                    {item.label}
                  </div>
                </Link>
              ))}
              <Link href="/admin">
                <div
                  className="px-4 py-3 rounded-md text-sm font-medium text-foreground/80 hover:text-foreground hover-elevate cursor-pointer"
                  onClick={() => setMobileMenuOpen(false)}
                  data-testid="link-mobile-admin"
                >
                  Admin
                </div>
              </Link>
            </nav>
          </div>
        )}
      </div>
    </header>
  );
}
