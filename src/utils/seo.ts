type SeoPayload = {
  title: string;
  description: string;
  keywords?: string;
  canonicalUrl?: string;
  robots?: string;
  ogType?: string;
  jsonLd?: Record<string, any> | Array<Record<string, any>>;
};

const upsertMeta = (selector: string, attrs: Record<string, string>, content: string) => {
  let el = document.head.querySelector(selector) as HTMLMetaElement | null;
  if (!el) {
    el = document.createElement("meta");
    Object.entries(attrs).forEach(([k, v]) => el!.setAttribute(k, v));
    document.head.appendChild(el);
  }
  el.setAttribute("content", content);
};

export const applySeo = (payload: SeoPayload) => {
  document.title = payload.title;

  upsertMeta('meta[name="description"]', { name: "description" }, payload.description);
  upsertMeta('meta[property="og:title"]', { property: "og:title" }, payload.title);
  upsertMeta('meta[property="og:description"]', { property: "og:description" }, payload.description);
  upsertMeta('meta[name="twitter:title"]', { name: "twitter:title" }, payload.title);
  upsertMeta('meta[name="twitter:description"]', { name: "twitter:description" }, payload.description);

  if (payload.keywords) {
    upsertMeta('meta[name="keywords"]', { name: "keywords" }, payload.keywords);
  }
  if (payload.robots) {
    upsertMeta('meta[name="robots"]', { name: "robots" }, payload.robots);
  }
  if (payload.ogType) {
    upsertMeta('meta[property="og:type"]', { property: "og:type" }, payload.ogType);
  }
  if (payload.canonicalUrl) {
    let canonical = document.head.querySelector('link[rel="canonical"]') as HTMLLinkElement | null;
    if (!canonical) {
      canonical = document.createElement("link");
      canonical.setAttribute("rel", "canonical");
      document.head.appendChild(canonical);
    }
    canonical.setAttribute("href", payload.canonicalUrl);
    upsertMeta('meta[property="og:url"]', { property: "og:url" }, payload.canonicalUrl);
  }

  if (payload.jsonLd) {
    const existing = document.getElementById("dynamic-jsonld");
    if (existing) existing.remove();
    const script = document.createElement("script");
    script.id = "dynamic-jsonld";
    script.type = "application/ld+json";
    script.text = JSON.stringify(payload.jsonLd);
    document.head.appendChild(script);
  }
};

