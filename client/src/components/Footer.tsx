import { Link } from "wouter";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Facebook, Twitter, Instagram, Youtube } from "lucide-react";

export function Footer() {
  return (
    <footer className="border-t bg-card mt-24">
      <div className="max-w-7xl mx-auto px-6 py-16">
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-12">
          {/* About */}
          <div>
            <h3 className="font-heading font-semibold text-lg mb-4">About PadelPro</h3>
            <p className="text-sm text-muted-foreground leading-relaxed">
              Expert padel racket reviews with detailed ratings, honest comparisons, and the best prices. 
              Helping players find their perfect racket since 2024.
            </p>
          </div>

          {/* Quick Links */}
          <div>
            <h3 className="font-heading font-semibold text-lg mb-4">Quick Links</h3>
            <nav className="flex flex-col gap-2">
              <Link href="/rackets">
                <span className="text-sm text-muted-foreground hover:text-foreground transition-colors cursor-pointer" data-testid="footer-link-rackets">
                  All Rackets
                </span>
              </Link>
              <Link href="/guides">
                <span className="text-sm text-muted-foreground hover:text-foreground transition-colors cursor-pointer" data-testid="footer-link-guides">
                  Buying Guides
                </span>
              </Link>
              <Link href="/brands">
                <span className="text-sm text-muted-foreground hover:text-foreground transition-colors cursor-pointer" data-testid="footer-link-brands">
                  Brands
                </span>
              </Link>
              <Link href="/blog">
                <span className="text-sm text-muted-foreground hover:text-foreground transition-colors cursor-pointer" data-testid="footer-link-blog">
                  Blog
                </span>
              </Link>
            </nav>
          </div>

          {/* Popular Brands */}
          <div>
            <h3 className="font-heading font-semibold text-lg mb-4">Popular Brands</h3>
            <div className="flex flex-col gap-2">
              <span className="text-sm text-muted-foreground">Babolat</span>
              <span className="text-sm text-muted-foreground">Bullpadel</span>
              <span className="text-sm text-muted-foreground">Head</span>
              <span className="text-sm text-muted-foreground">Adidas</span>
              <span className="text-sm text-muted-foreground">Nox</span>
            </div>
          </div>

          {/* Newsletter */}
          <div>
            <h3 className="font-heading font-semibold text-lg mb-4">Newsletter</h3>
            <p className="text-sm text-muted-foreground mb-4">
              Get the latest reviews and deals delivered to your inbox.
            </p>
            <div className="flex gap-2">
              <Input
                type="email"
                placeholder="Your email"
                className="flex-1"
                data-testid="input-newsletter-email"
              />
              <Button data-testid="button-newsletter-subscribe">Subscribe</Button>
            </div>
            <p className="text-xs text-muted-foreground mt-3">
              Join 25,000+ players
            </p>
          </div>
        </div>

        {/* Bottom Section */}
        <div className="mt-12 pt-8 border-t flex flex-col md:flex-row items-center justify-between gap-4">
          <div className="text-sm text-muted-foreground text-center md:text-left">
            <p className="mb-2">
              © 2024 PadelPro. All rights reserved.
            </p>
            <p className="text-xs">
              As an Amazon Associate, we earn from qualifying purchases.
            </p>
          </div>

          {/* Social Links */}
          <div className="flex items-center gap-4">
            <a
              href="#"
              className="text-muted-foreground hover:text-foreground transition-colors hover-elevate p-2 rounded-md"
              aria-label="Facebook"
              data-testid="link-social-facebook"
            >
              <Facebook className="h-5 w-5" />
            </a>
            <a
              href="#"
              className="text-muted-foreground hover:text-foreground transition-colors hover-elevate p-2 rounded-md"
              aria-label="Twitter"
              data-testid="link-social-twitter"
            >
              <Twitter className="h-5 w-5" />
            </a>
            <a
              href="#"
              className="text-muted-foreground hover:text-foreground transition-colors hover-elevate p-2 rounded-md"
              aria-label="Instagram"
              data-testid="link-social-instagram"
            >
              <Instagram className="h-5 w-5" />
            </a>
            <a
              href="#"
              className="text-muted-foreground hover:text-foreground transition-colors hover-elevate p-2 rounded-md"
              aria-label="Youtube"
              data-testid="link-social-youtube"
            >
              <Youtube className="h-5 w-5" />
            </a>
          </div>
        </div>
      </div>
    </footer>
  );
}
