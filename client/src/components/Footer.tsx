import { Link } from "wouter";
import { Button } from "@/components/ui/button";
import { Facebook, Twitter, Instagram, Youtube } from "lucide-react";
import { useI18n } from "@/i18n/useI18n";

export function Footer() {
  const { t } = useI18n();
  const currentYear = new Date().getFullYear().toString();

  return (
    <footer className="border-t bg-card mt-16 sm:mt-24">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 py-12 sm:py-16">
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-10 lg:gap-12">
          {/* About */}
          <div>
            <h3 className="font-heading font-semibold text-lg mb-4">
              {t("footer.about.title")}
            </h3>
            <p className="text-sm text-muted-foreground leading-relaxed">
              {t("footer.about.body")}
            </p>
          </div>

          {/* Quick Links */}
          <div>
            <h3 className="font-heading font-semibold text-lg mb-4">
              {t("footer.quickLinks.title")}
            </h3>
            <nav className="flex flex-col gap-2">
              <Link href="/rackets">
                <span className="text-sm text-muted-foreground hover:text-foreground transition-colors cursor-pointer" data-testid="footer-link-rackets">
                  {t("footer.quickLinks.rackets")}
                </span>
              </Link>
              <Link href="/guides">
                <span className="text-sm text-muted-foreground hover:text-foreground transition-colors cursor-pointer" data-testid="footer-link-guides">
                  {t("footer.quickLinks.guides")}
                </span>
              </Link>
              <Link href="/brands">
                <span className="text-sm text-muted-foreground hover:text-foreground transition-colors cursor-pointer" data-testid="footer-link-brands">
                  {t("footer.quickLinks.brands")}
                </span>
              </Link>
              <Link href="/blog">
                <span className="text-sm text-muted-foreground hover:text-foreground transition-colors cursor-pointer" data-testid="footer-link-blog">
                  {t("footer.quickLinks.blog")}
                </span>
              </Link>
            </nav>
          </div>

          {/* Popular Brands */}
          <div>
            <h3 className="font-heading font-semibold text-lg mb-4">
              {t("footer.popularBrands.title")}
            </h3>
            <div className="flex flex-col gap-2">
              <span className="text-sm text-muted-foreground">Babolat</span>
              <span className="text-sm text-muted-foreground">Bullpadel</span>
              <span className="text-sm text-muted-foreground">Head</span>
              <span className="text-sm text-muted-foreground">Adidas</span>
              <span className="text-sm text-muted-foreground">Nox</span>
            </div>
          </div>

          {/* Beginner Guide */}
          <div>
            <h3 className="font-heading font-semibold text-lg mb-4">
              {t("footer.gettingStarted.title")}
            </h3>
            <p className="text-sm text-muted-foreground mb-4">
              {t("footer.gettingStarted.body")}
            </p>
            <Link href="/guides/best-padel-rackets-for-beginners-2025">
              <Button className="w-full" data-testid="button-beginner-guide">
                {t("common.actions.beginnerGuide")}
              </Button>
            </Link>
          </div>
        </div>

        {/* Bottom Section */}
        <div className="mt-10 sm:mt-12 pt-8 border-t flex flex-col md:flex-row items-start md:items-center justify-between gap-4">
          <div className="text-sm text-muted-foreground text-center md:text-left">
            <p className="mb-2">
              {t("footer.legal.rights", { year: currentYear })}
            </p>
            <p className="text-xs">{t("footer.legal.disclaimer")}</p>
          </div>

          {/* Social Links */}
          <div className="flex items-center gap-4">
            <a
              href="#"
              className="text-muted-foreground hover:text-foreground transition-colors hover-elevate p-2 rounded-md"
              aria-label={t("footer.social.facebook")}
              data-testid="link-social-facebook"
            >
              <Facebook className="h-5 w-5" />
            </a>
            <a
              href="#"
              className="text-muted-foreground hover:text-foreground transition-colors hover-elevate p-2 rounded-md"
              aria-label={t("footer.social.twitter")}
              data-testid="link-social-twitter"
            >
              <Twitter className="h-5 w-5" />
            </a>
            <a
              href="#"
              className="text-muted-foreground hover:text-foreground transition-colors hover-elevate p-2 rounded-md"
              aria-label={t("footer.social.instagram")}
              data-testid="link-social-instagram"
            >
              <Instagram className="h-5 w-5" />
            </a>
            <a
              href="#"
              className="text-muted-foreground hover:text-foreground transition-colors hover-elevate p-2 rounded-md"
              aria-label={t("footer.social.youtube")}
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
