import { INITIAL_CONCEPTS, SUBJECTS } from '../data/curriculumData';

export const PUBLIC_URL = 'https://learnx-hgso.onrender.com/';
export const PUBLIC_TITLE = 'LearnX — Personalized Learning Platform';
export const PUBLIC_COPYRIGHT_YEAR = new Date().getUTCFullYear();

/**
 * Public values are deliberately kept separate from the authenticated app
 * state.  These values may be embedded in anonymous HTML, so callers should
 * only pass information that is intended to be public.
 */
export interface PublicContact {
  email?: string;
  phone?: string;
  creatorUrl?: string;
  creatorLabel?: string;
}

export interface PublicSiteConfig {
  lastUpdated?: string;
  phrase?: string;
  contact?: PublicContact;
}

export interface PublicEnvironmentValues {
  PUBLIC_LAST_UPDATED?: string;
  PUBLIC_SITE_PHRASE?: string;
  PUBLIC_CONTACT_EMAIL?: string;
  PUBLIC_CONTACT_PHONE?: string;
  PUBLIC_CREATOR_URL?: string;
  PUBLIC_CREATOR_LABEL?: string;
}

export const PUBLIC_UTM_STORAGE_KEY = 'learnx_public_utm';

function cleanPublicValue(value?: string): string | undefined {
  const trimmed = value?.trim();
  if (!trimmed || /[\u0000-\u001f\u007f]/.test(trimmed)) return undefined;
  return trimmed;
}

function cleanPublicUrl(value?: string): string | undefined {
  const candidate = cleanPublicValue(value);
  if (!candidate) return undefined;
  try {
    const parsed = new URL(candidate);
    return parsed.protocol === 'http:' || parsed.protocol === 'https:'
      ? parsed.username || parsed.password ? undefined : parsed.href
      : undefined;
  } catch {
    return undefined;
  }
}

/** Accept only a real, non-future public date supplied by the deployment. */
export function normalizePublicDate(value?: string): string | undefined {
  const candidate = cleanPublicValue(value);
  if (!candidate) return undefined;
  const dateOnly = /^\d{4}-\d{2}-\d{2}$/.test(candidate);
  const parsed = dateOnly ? new Date(`${candidate}T00:00:00.000Z`) : new Date(candidate);
  if (Number.isNaN(parsed.getTime()) || parsed.getTime() > Date.now()) return undefined;
  if (dateOnly && parsed.toISOString().slice(0, 10) !== candidate) return undefined;
  return candidate;
}

function cleanPublicEmail(value?: string): string | undefined {
  const candidate = cleanPublicValue(value);
  return candidate && /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(candidate) ? candidate : undefined;
}

function cleanPublicPhone(value?: string): string | undefined {
  const candidate = cleanPublicValue(value);
  return candidate && /^[+()\d][+()\d\s.-]{2,31}$/.test(candidate) ? candidate : undefined;
}

export function getPublicSiteConfig(values: PublicEnvironmentValues = {}): PublicSiteConfig {
  const email = cleanPublicEmail(values.PUBLIC_CONTACT_EMAIL);
  const phone = cleanPublicPhone(values.PUBLIC_CONTACT_PHONE);
  const creatorUrl = cleanPublicUrl(values.PUBLIC_CREATOR_URL);
  const creatorLabel = cleanPublicValue(values.PUBLIC_CREATOR_LABEL);
  const contact = email || phone || creatorUrl
    ? { email, phone, creatorUrl, creatorLabel }
    : undefined;

  return {
    lastUpdated: normalizePublicDate(values.PUBLIC_LAST_UPDATED),
    phrase: cleanPublicValue(values.PUBLIC_SITE_PHRASE),
    contact,
  };
}

function getVitePublicEnvironment(): PublicEnvironmentValues {
  try {
    const env = (import.meta as ImportMeta & { env?: Record<string, string | undefined> }).env || {};
    return {
      PUBLIC_LAST_UPDATED: env.VITE_PUBLIC_LAST_UPDATED,
      PUBLIC_SITE_PHRASE: env.VITE_PUBLIC_SITE_PHRASE,
      PUBLIC_CONTACT_EMAIL: env.VITE_PUBLIC_CONTACT_EMAIL,
      PUBLIC_CONTACT_PHONE: env.VITE_PUBLIC_CONTACT_PHONE,
      PUBLIC_CREATOR_URL: env.VITE_PUBLIC_CREATOR_URL,
      PUBLIC_CREATOR_LABEL: env.VITE_PUBLIC_CREATOR_LABEL,
    };
  } catch {
    // The server bundle has no Vite import-meta environment. Its explicit
    // public config is supplied by src/public-site/server.tsx instead.
    return {};
  }
}

export function getClientPublicSiteConfig(): PublicSiteConfig {
  return getPublicSiteConfig(getVitePublicEnvironment());
}

export function getPublicSiteConfigFromData(
  data: { [key: string]: string | undefined },
): PublicSiteConfig {
  return getPublicSiteConfig({
    PUBLIC_LAST_UPDATED: data.publicLastUpdated,
    PUBLIC_SITE_PHRASE: data.publicSitePhrase,
    PUBLIC_CONTACT_EMAIL: data.publicContactEmail,
    PUBLIC_CONTACT_PHONE: data.publicContactPhone,
    PUBLIC_CREATOR_URL: data.publicCreatorUrl,
    PUBLIC_CREATOR_LABEL: data.publicCreatorLabel,
  });
}

/**
 * UTM support retains only well-formed campaign keys and values that do not
 * look like credentials or contain control data before they reach
 * sessionStorage or an outbound link.
 */
export type PublicUtmParams = Record<string, string>;

function isPublicUtmKey(key: string): boolean {
  return /^utm_[a-z0-9_]+$/.test(key)
    && !/(?:token|secret|password|api[_-]?key)/i.test(key);
}

function isSafePublicUtmValue(value: string): boolean {
  return value.length > 0
    && value.length <= 200
    && !/[\u0000-\u001f\u007f<>"'`]/.test(value)
    && !/(?:bearer\s|eyJ[a-zA-Z0-9_-]{10,}\.|(?:token|secret|password|api[_-]?key)\s*[:=])/i.test(value);
}

export function collectPublicUtmParameters(search: string): PublicUtmParams {
  const result: PublicUtmParams = {};
  try {
    const params = new URLSearchParams(search);
    for (const [rawKey, rawValue] of params.entries()) {
      const key = rawKey.toLowerCase();
      const value = rawValue.trim();
      if (isPublicUtmKey(key) && isSafePublicUtmValue(value)) {
        result[key] = value;
      }
    }
  } catch {
    return {};
  }
  return result;
}

export function parseStoredPublicUtm(value: string | null): PublicUtmParams {
  if (!value) return {};
  try {
    const parsed = JSON.parse(value) as Record<string, unknown>;
    const result: PublicUtmParams = {};
    for (const [rawKey, rawValue] of Object.entries(parsed)) {
      const key = rawKey.toLowerCase();
      if (isPublicUtmKey(key) && typeof rawValue === 'string' && isSafePublicUtmValue(rawValue)) {
        result[key] = rawValue;
      }
    }
    return result;
  } catch {
    return {};
  }
}

/** Add remembered campaign parameters only to absolute HTTP(S) destinations. */
export function appendPublicUtmParameters(href: string, params: PublicUtmParams): string {
  if (!/^https?:\/\//i.test(href) || !Object.keys(params).length) return href;
  try {
    const url = new URL(href);
    for (const [key, value] of Object.entries(params)) {
      if (!url.searchParams.has(key) && isPublicUtmKey(key) && isSafePublicUtmValue(value)) {
        url.searchParams.set(key, value);
      }
    }
    return url.toString();
  } catch {
    return href;
  }
}

const subjectNames = `${SUBJECTS.slice(0, -1).join(', ')}, and ${SUBJECTS.at(-1)}`;

export const PUBLIC_DESCRIPTION =
  `Explore LearnX's ${subjectNames} curriculum, concept prerequisites, guided lessons, and mastery checks. Sign in to save learning progress.`;

// Explicitly project curriculum content. Seeded mastery, answers, analytics,
// student records, and teacher-created/private curriculum are not public data.
export const PUBLIC_CURRICULUM = SUBJECTS.map((subject) => ({
  subject,
  concepts: INITIAL_CONCEPTS[subject].map((concept) => ({
    id: concept.id,
    title: concept.title,
    description: concept.description,
    prerequisites: concept.prerequisites.map((id) =>
      INITIAL_CONCEPTS[subject].find((candidate) => candidate.id === id)?.title || id,
    ),
  })),
}));

export const PUBLIC_FAQ_ITEMS = [
  {
    question: 'What is LearnX?',
    answer:
      'LearnX is an interactive learning platform with a curriculum graph, concept prerequisites, guided lessons, and mastery checks.',
  },
  {
    question: 'Which subjects are available?',
    answer: `The public curriculum covers ${subjectNames} concepts.`,
  },
  {
    question: 'Do I need an account to explore LearnX?',
    answer:
      'You can browse the public curriculum without an account. Sign in to save progress and use authenticated, personalized learning features.',
  },
] as const;

export interface PublicAuthor {
  name: string;
  bio: string;
}

export function getPublicAuthor(name?: string, bio?: string): PublicAuthor | undefined {
  // A name alone is not a biography. Publish only explicitly supplied public
  // values, with no inferred role, credentials, affiliation, or authorship.
  if (!name?.trim() || !bio?.trim()) return undefined;
  return { name: name.trim(), bio: bio.trim() };
}

export const NOT_FOUND_TITLE = 'Page not found | LearnX';
export const NOT_FOUND_DESCRIPTION =
  'The requested LearnX page could not be found. Return to the homepage to explore the curriculum.';

export function getPublicMetadata(isNotFound: boolean) {
  return isNotFound
    ? {
        title: NOT_FOUND_TITLE,
        description: NOT_FOUND_DESCRIPTION,
        robots: 'noindex, follow',
        canonical: undefined,
      }
    : {
        title: PUBLIC_TITLE,
        description: PUBLIC_DESCRIPTION,
        robots: 'index, follow',
        canonical: PUBLIC_URL,
      };
}

export function getPublicStructuredData() {
  // The homepage has no hierarchical breadcrumb. A fragment link to its FAQ
  // is in-page navigation, not another page or a BreadcrumbList.
  return [
    {
      id: 'website-structured-data',
      data: {
        '@context': 'https://schema.org',
        '@type': 'WebSite',
        name: 'LearnX',
        url: PUBLIC_URL,
        description: PUBLIC_DESCRIPTION,
      },
    },
    {
      id: 'faq-structured-data',
      data: {
        '@context': 'https://schema.org',
        '@type': 'FAQPage',
        mainEntity: PUBLIC_FAQ_ITEMS.map((item) => ({
          '@type': 'Question',
          name: item.question,
          acceptedAnswer: { '@type': 'Answer', text: item.answer },
        })),
      },
    },
  ];
}

export function serializeStructuredData(data: unknown): string {
  // Keep JSON valid without allowing a future text value to terminate a script
  // element. Server hashes and client updates use these exact same bytes.
  return JSON.stringify(data)
    .replace(/</g, '\\u003c')
    .replace(/>/g, '\\u003e')
    .replace(/&/g, '\\u0026')
    .replace(/\u2028/g, '\\u2028')
    .replace(/\u2029/g, '\\u2029');
}
