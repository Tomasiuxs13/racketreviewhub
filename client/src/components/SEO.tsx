import { Helmet } from "react-helmet-async";
import { absoluteUrl, SITE_URL } from "@/lib/seo";

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

const SITE_NAME = "Padel Racket Reviews";
const DEFAULT_TITLE = `${SITE_NAME} - Find Your Perfect Racket`;
const DEFAULT_DESCRIPTION =
  "Expert padel racket reviews with detailed ratings, best prices, and buying guides for players of all levels.";
const DEFAULT_IMAGE = "/favicon.png";

function formatTitle(title?: string) {
  if (!title) {
    return DEFAULT_TITLE;
  }

  if (title.includes(SITE_NAME)) {
    return title;
  }

  return `${title} | ${SITE_NAME}`;
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
  const metaTitle = formatTitle(title);
  const metaDescription = description || DEFAULT_DESCRIPTION;
  const pageUrl = url ? absoluteUrl(url) : SITE_URL;
  const canonicalUrl = canonical ? absoluteUrl(canonical) : pageUrl;
  const imageUrl = absoluteUrl(image);

  return (
    <Helmet>
      <title>{metaTitle}</title>
      <meta name="description" content={metaDescription} />
      <meta name="author" content={author || SITE_NAME} />

      <meta property="og:title" content={metaTitle} />
      <meta property="og:description" content={metaDescription} />
      <meta property="og:type" content={type} />
      <meta property="og:url" content={pageUrl} />
      <meta property="og:image" content={imageUrl} />
      <meta property="og:site_name" content={SITE_NAME} />

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
    </Helmet>
  );
}

export default SEO;


