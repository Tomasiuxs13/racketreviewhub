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

