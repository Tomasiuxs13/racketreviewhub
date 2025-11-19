const FALLBACK_SITE_URL = "https://racketreviewhub.com";

const envSiteUrl = import.meta.env.VITE_SITE_URL?.trim();
const normalizedSiteUrl = envSiteUrl
  ? envSiteUrl.replace(/\/+$/, "")
  : FALLBACK_SITE_URL;

export const SITE_URL = normalizedSiteUrl;

export function absoluteUrl(path = ""): string {
  if (!path) {
    return SITE_URL;
  }

  if (/^https?:\/\//i.test(path)) {
    return path;
  }

  if (path.startsWith("/")) {
    return `${SITE_URL}${path}`;
  }

  return `${SITE_URL}/${path}`;
}

const OG_LOCALE_MAP: Record<string, string> = {
  en: "en_US",
  es: "es_ES",
  pt: "pt_PT",
  it: "it_IT",
  fr: "fr_FR",
};

export function getOgLocale(locale: string): string {
  return OG_LOCALE_MAP[locale as keyof typeof OG_LOCALE_MAP] ?? OG_LOCALE_MAP.en;
}

export function localizedUrl(path = "", locale = "en"): string {
  const url = new URL(absoluteUrl(path || "/"));
  if (locale === "en") {
    url.searchParams.delete("lang");
  } else {
    url.searchParams.set("lang", locale);
  }
  return url.toString();
}

export function buildHrefLangAlternates(path = "", locales: string[]) {
  const uniqueLocales = Array.from(new Set(locales));
  return uniqueLocales.map((locale) => ({
    locale,
    href: localizedUrl(path, locale),
  }));
}

