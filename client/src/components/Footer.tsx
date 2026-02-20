import { Link } from "wouter";
import { useI18n } from "@/i18n/useI18n";
import { NewsletterSignup } from "./NewsletterSignup";

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
              <Link href="/brands/babolat">
                <span className="text-sm text-muted-foreground hover:text-foreground transition-colors cursor-pointer">Babolat</span>
              </Link>
              <Link href="/brands/bullpadel">
                <span className="text-sm text-muted-foreground hover:text-foreground transition-colors cursor-pointer">Bullpadel</span>
              </Link>
              <Link href="/brands/head">
                <span className="text-sm text-muted-foreground hover:text-foreground transition-colors cursor-pointer">Head</span>
              </Link>
              <Link href="/brands/adidas">
                <span className="text-sm text-muted-foreground hover:text-foreground transition-colors cursor-pointer">Adidas</span>
              </Link>
              <Link href="/brands/nox">
                <span className="text-sm text-muted-foreground hover:text-foreground transition-colors cursor-pointer">Nox</span>
              </Link>
            </div>
          </div>

          {/* Newsletter Signup */}
          <div>
            <h3 className="font-heading font-semibold text-lg mb-4">
              Stay Updated
            </h3>
            <p className="text-sm text-muted-foreground mb-4">
              Get notified about price drops and new reviews.
            </p>
            <NewsletterSignup source="footer" compact />
          </div>
        </div>

        {/* Bottom Section */}
        <div className="mt-10 sm:mt-12 pt-8 border-t">
          <div className="text-sm text-muted-foreground text-center md:text-left">
            <p className="mb-2">
              {t("footer.legal.rights", { year: currentYear })}
            </p>
            <p className="text-xs">{t("footer.legal.disclaimer")}</p>
          </div>
        </div>
      </div>
    </footer>
  );
}
