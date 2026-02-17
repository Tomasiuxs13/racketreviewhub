declare global {
  interface Window {
    gtag?: (...args: any[]) => void;
  }
}

type AffiliatePartner = "padel_nuestro" | "padel_market";
type ClickSource = "racket_card" | "racket_detail" | "racket_detail_sidebar" | "racket_detail_sticky" | "mentioned_rackets" | "comparison";

interface AffiliateClickParams {
  racketId: string;
  brand: string;
  model: string;
  partner: AffiliatePartner;
  source: ClickSource;
  price?: number;
  inStock?: boolean;
}

export function trackAffiliateClick(params: AffiliateClickParams) {
  if (typeof window.gtag === "function") {
    window.gtag("event", "affiliate_click", {
      event_category: "affiliate",
      event_label: `${params.brand} ${params.model}`,
      racket_id: params.racketId,
      brand: params.brand,
      model: params.model,
      partner: params.partner,
      source: params.source,
      price: params.price,
      in_stock: params.inStock,
    });
  }
}

export function openAffiliateLink(url: string, params: AffiliateClickParams) {
  trackAffiliateClick(params);
  window.open(url, "_blank", "noopener,noreferrer");
}
