import { Helmet } from "react-helmet-async";
import { absoluteUrl, SITE_URL, buildHrefLangAlternates, getOgLocale, localizedUrl } from "@/lib/seo";
import { useI18n } from "@/i18n/useI18n";
import { SUPPORTED_LOCALES } from "@/i18n/I18nProvider";

export interface SEOProps {
  title?: string;
  description?: string;
  image?: string;
  url?: string;
  type?: "website" | "article";
  author?: string;
  publishedTime?: string;
  modifiedTime?: string;
  noindex?: boolean;
  canonical?: string;
}

const FALLBACK_SITE_NAME = "Padel Racket Reviews";
const FALLBACK_TAGLINE = "Find Your Perfect Racket";
const DEFAULT_IMAGE = "/favicon.png";

function formatTitle(title: string | undefined, siteName: string, defaultTitle: string) {
  if (!title) {
    return defaultTitle;
  }

  if (title.includes(siteName)) {
    return title;
  }

  return `${title} | ${siteName}`;
}

export function SEO({
  title,
  description,
  image = DEFAULT_IMAGE,
  url,
  type = "website",
  author,
  publishedTime,
  modifiedTime,
  noindex,
  canonical,
}: SEOProps) {
  const { locale, t } = useI18n();
  const siteName = t("common.brandName") || FALLBACK_SITE_NAME;
  const defaultTitle = `${siteName} - ${t("home.hero.title") || FALLBACK_TAGLINE}`;
  const metaTitle = formatTitle(title, siteName, defaultTitle);
  const metaDescription = description || t("home.seo.description");
  const path = url || "/";
  const localizedPageUrl = localizedUrl(path, locale);
  const canonicalPath = canonical || path;
  const canonicalUrl = absoluteUrl(canonicalPath);
  const imageUrl = absoluteUrl(image);
  const ogLocale = getOgLocale(locale);
  const ogAlternateLocales = SUPPORTED_LOCALES.filter((code) => code !== locale);
  const alternateLinks = buildHrefLangAlternates(canonicalPath, SUPPORTED_LOCALES);
  const xDefaultHref = localizedUrl(canonicalPath, "en");

  return (
    <Helmet htmlAttributes={{ lang: locale }}>
      <title>{metaTitle}</title>
      <meta name="description" content={metaDescription} />
      <meta name="author" content={author || siteName} />

      <meta property="og:title" content={metaTitle} />
      <meta property="og:description" content={metaDescription} />
      <meta property="og:type" content={type} />
      <meta property="og:url" content={localizedPageUrl} />
      <meta property="og:image" content={imageUrl} />
      <meta property="og:site_name" content={siteName} />
      <meta property="og:locale" content={ogLocale} />
      {ogAlternateLocales.map((code) => (
        <meta key={`og-locale-${code}`} property="og:locale:alternate" content={getOgLocale(code)} />
      ))}

      <meta name="twitter:card" content="summary_large_image" />
      <meta name="twitter:title" content={metaTitle} />
      <meta name="twitter:description" content={metaDescription} />
      <meta name="twitter:image" content={imageUrl} />

      {noindex ? (
        <meta name="robots" content="noindex, nofollow" />
      ) : (
        <meta name="robots" content="index, follow" />
      )}

      {publishedTime && (
        <meta property="article:published_time" content={publishedTime} />
      )}
      {modifiedTime && (
        <meta property="article:modified_time" content={modifiedTime} />
      )}
      {author && type === "article" && (
        <meta property="article:author" content={author} />
      )}

      <link rel="canonical" href={canonicalUrl} />
      {alternateLinks.map(({ locale: localeCode, href }) => (
        <link key={`alt-${localeCode}`} rel="alternate" hrefLang={localeCode} href={href} />
      ))}
      <link rel="alternate" hrefLang="x-default" href={xDefaultHref} />
    </Helmet>
  );
}

export default SEO;


