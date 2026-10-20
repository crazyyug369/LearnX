import type { AppTab } from '../types';
import {
  getPublicMetadata,
  getPublicStructuredData,
  serializeStructuredData,
} from '../public-site/content';

function setMeta(attribute: 'name' | 'property', key: string, content?: string): void {
  const existing = [...document.head.querySelectorAll<HTMLMetaElement>(`meta[${attribute}="${key}"]`)];
  const first = existing.shift();
  existing.forEach((element) => element.remove());
  if (content === undefined) {
    first?.remove();
    return;
  }
  const meta = first || document.createElement('meta');
  meta.setAttribute(attribute, key);
  meta.content = content;
  if (!first) document.head.appendChild(meta);
}

export function updateSeoMetadata({ isNotFoundPath }: {
  // Kept for existing callers; tabs do not create documents or change the
  // indexability/canonical of /. Public content stays visible in every tab.
  activeTab?: AppTab;
  isNotFoundPath: boolean;
}): void {
  if (typeof document === 'undefined') return;
  const metadata = getPublicMetadata(isNotFoundPath);
  document.title = metadata.title;
  setMeta('name', 'description', metadata.description);
  setMeta('name', 'robots', metadata.robots);

  const canonicals = [...document.head.querySelectorAll<HTMLLinkElement>('link[rel="canonical"]')];
  const firstCanonical = canonicals.shift();
  canonicals.forEach((canonical) => canonical.remove());
  if (metadata.canonical) {
    const canonical = firstCanonical || document.createElement('link');
    canonical.rel = 'canonical';
    canonical.href = metadata.canonical;
    if (!firstCanonical) document.head.appendChild(canonical);
  } else {
    firstCanonical?.remove();
  }

  setMeta('property', 'og:type', metadata.canonical ? 'website' : undefined);
  setMeta('property', 'og:title', metadata.canonical ? metadata.title : undefined);
  setMeta('property', 'og:description', metadata.canonical ? metadata.description : undefined);
  setMeta('property', 'og:url', metadata.canonical);
  setMeta('property', 'og:site_name', metadata.canonical ? 'LearnX' : undefined);
  setMeta('name', 'twitter:card', metadata.canonical ? 'summary' : undefined);
  setMeta('name', 'twitter:title', metadata.canonical ? metadata.title : undefined);
  setMeta('name', 'twitter:description', metadata.canonical ? metadata.description : undefined);

  document.getElementById('breadcrumb-structured-data')?.remove();
  for (const { id, data } of getPublicStructuredData()) {
    const existing = document.getElementById(id);
    if (isNotFoundPath) {
      existing?.remove();
      continue;
    }
    const script = existing || document.createElement('script');
    script.id = id;
    script.setAttribute('type', 'application/ld+json');
    const json = serializeStructuredData(data);
    if (script.textContent !== json) script.textContent = json;
    if (!existing) document.head.appendChild(script);
  }
}
