import React from 'react';
import { createHash } from 'node:crypto';
import { renderToStaticMarkup, renderToString } from 'react-dom/server';
import type { RequestHandler } from 'express';
import App from '../App';
import {
  getPublicAuthor,
  getPublicMetadata,
  getPublicSiteConfig,
  getPublicStructuredData,
  serializeStructuredData,
  type PublicAuthor,
  type PublicEnvironmentValues,
  type PublicSiteConfig,
} from './content';

const HEAD_MARKER = '<!--learnx-public-head-->';
const APP_MARKER = '<!--learnx-public-app-->';

export interface PublicEnvironment extends PublicEnvironmentValues {
  PUBLIC_AUTHOR_NAME?: string;
  PUBLIC_AUTHOR_BIO?: string;
}

export interface PublicDocument {
  status: 200 | 404;
  html: string;
  /** Exact JSON-LD hashes, already quoted for a CSP script-src directive. */
  cspScriptHashes: string[];
}

export interface PublicRedirect {
  status: 308;
  location: string;
  cspScriptHashes: string[];
}

export type PublicPageResponse = PublicDocument | PublicRedirect;

function Metadata({ isNotFound, author }: { isNotFound: boolean; author?: PublicAuthor }) {
  const metadata = getPublicMetadata(isNotFound);
  return (
    <>
      <title>{metadata.title}</title>
      <meta name="description" content={metadata.description} />
      <meta name="robots" content={metadata.robots} />
      <meta name="theme-color" content="#114B43" />
      {metadata.canonical && (
        <>
          <link rel="canonical" href={metadata.canonical} />
          <meta property="og:type" content="website" />
          <meta property="og:title" content={metadata.title} />
          <meta property="og:description" content={metadata.description} />
          <meta property="og:url" content={metadata.canonical} />
          <meta property="og:site_name" content="LearnX" />
          <meta name="twitter:card" content="summary" />
          <meta name="twitter:title" content={metadata.title} />
          <meta name="twitter:description" content={metadata.description} />
          {author && <meta name="author" content={author.name} />}
          {getPublicStructuredData().map(({ id, data }) => (
            <script
              key={id}
              id={id}
              type="application/ld+json"
              dangerouslySetInnerHTML={{ __html: serializeStructuredData(data) }}
            />
          ))}
        </>
      )}
    </>
  );
}

function resolvePublicEnvironment(environment: PublicEnvironment): PublicEnvironment {
  // The root Express server intentionally passes only its existing author
  // values. Read the additional explicitly-public server values here so the
  // public shell can evolve without touching auth, API, or database wiring.
  const serverEnvironment = typeof process !== 'undefined' ? process.env : {};
  const value = (key: keyof PublicEnvironment): string | undefined =>
    environment[key] ?? serverEnvironment[key];
  return {
    PUBLIC_AUTHOR_NAME: value('PUBLIC_AUTHOR_NAME'),
    PUBLIC_AUTHOR_BIO: value('PUBLIC_AUTHOR_BIO'),
    PUBLIC_LAST_UPDATED: value('PUBLIC_LAST_UPDATED'),
    PUBLIC_SITE_PHRASE: value('PUBLIC_SITE_PHRASE'),
    PUBLIC_CONTACT_EMAIL: value('PUBLIC_CONTACT_EMAIL'),
    PUBLIC_CONTACT_PHONE: value('PUBLIC_CONTACT_PHONE'),
    PUBLIC_CREATOR_URL: value('PUBLIC_CREATOR_URL'),
    PUBLIC_CREATOR_LABEL: value('PUBLIC_CREATOR_LABEL'),
  };
}

function removeStaticMetadataFallbacks(template: string): string {
  return template
    .replace(/\s*<title id="learnx-fallback-title">[\s\S]*?<\/title>/i, '')
    .replace(/\s*<meta id="learnx-fallback-[^"]+"[^>]*\/?\s*>/gi, '');
}

/**
 * Build an anonymous document from Vite's HTML template, preserving its hashed
 * JS/CSS asset links. No request, cookie, user, database, or browser state is
 * accepted here. PUBLIC_* values are explicitly public, opt-in text only.
 */
export function renderPublicDocument(
  template: string,
  pathname: string,
  environment: PublicEnvironment = {},
): PublicDocument {
  if (template.split(HEAD_MARKER).length !== 2 || template.split(APP_MARKER).length !== 2) {
    throw new Error('Public SSR requires the current LearnX index.html template with one head and app marker. Rebuild the frontend.');
  }

  const isNotFound = pathname !== '/';
  const publicEnvironment = resolvePublicEnvironment(environment);
  const author = isNotFound
    ? undefined
    : getPublicAuthor(publicEnvironment.PUBLIC_AUTHOR_NAME, publicEnvironment.PUBLIC_AUTHOR_BIO);
  const publicConfig: PublicSiteConfig = isNotFound ? {} : getPublicSiteConfig(publicEnvironment);
  const app = renderToString(
    <App
      pathname={isNotFound ? '/not-found' : '/'}
      publicAuthor={author}
      publicConfig={publicConfig}
    />,
  );
  // React escapes author values both in the visible biography and in the data
  // attributes used for hydration. No inline executable/bootstrap script.
  const root = renderToStaticMarkup(
    <div
      id="root"
      data-learnx-ssr="anonymous-v1"
      data-learnx-public-config="1"
      data-public-author-name={author?.name}
      data-public-author-bio={author?.bio}
      data-public-last-updated={publicConfig.lastUpdated}
      data-public-site-phrase={publicConfig.phrase}
      data-public-contact-email={publicConfig.contact?.email}
      data-public-contact-phone={publicConfig.contact?.phone}
      data-public-creator-url={publicConfig.contact?.creatorUrl}
      data-public-creator-label={publicConfig.contact?.creatorLabel}
      dangerouslySetInnerHTML={{ __html: app }}
    />,
  );
  const rootPattern = /<div\s+id="root"\s*>\s*<!--learnx-public-app-->\s*<\/div>/;
  if (!rootPattern.test(template)) {
    throw new Error('Public SSR root marker must be inside the empty #root div.');
  }

  const html = removeStaticMetadataFallbacks(
    template
      .replace(HEAD_MARKER, () => renderToStaticMarkup(<Metadata isNotFound={isNotFound} author={author} />))
      .replace(rootPattern, () => root),
  );
  const cspScriptHashes = isNotFound ? [] : getPublicStructuredData().map(({ data }) =>
    `'sha256-${createHash('sha256').update(serializeStructuredData(data)).digest('base64')}'`,
  );
  return { status: isNotFound ? 404 : 200, html, cspScriptHashes };
}

/** Pre-render the two anonymous responses once, independently of request data. */
export function createPublicPageRenderer(
  template: string,
  environment: PublicEnvironment = process.env,
): (requestTarget: string) => PublicPageResponse {
  const home = renderPublicDocument(template, '/', environment);
  const notFound = renderPublicDocument(template, '/not-found');

  return (requestTarget) => {
    const pathname = requestTarget.split(/[?#]/, 1)[0] || '/';
    if (pathname === '/index.html') {
      // Keep useful query parameters, with one same-origin hop to /.
      const query = requestTarget.includes('?') ? requestTarget.slice(requestTarget.indexOf('?')).split('#', 1)[0] : '';
      return { status: 308, location: `/${query}`, cspScriptHashes: [] };
    }
    return pathname === '/' ? home : notFound;
  };
}

export function withPublicScriptHashes(policy: string, hashes: readonly string[]): string {
  if (!hashes.length) return policy;
  const directives = policy.split(';').map((part) => part.trim()).filter(Boolean);
  const index = directives.findIndex((part) => /^script-src\s/i.test(part));
  if (index === -1) {
    // Inherit existing default-src sources, rather than relaxing the policy to
    // all scripts. The deployed policy explicitly supplies script-src 'self'.
    const fallback = directives.find((part) => /^default-src\s/i.test(part));
    const sources = fallback?.replace(/^default-src\s+/i, '') || "'self'";
    directives.push(`script-src ${sources} ${hashes.join(' ')}`);
  } else {
    const present = new Set(directives[index].split(/\s+/));
    directives[index] += hashes.filter((hash) => !present.has(hash)).map((hash) => ` ${hash}`).join('');
  }
  return directives.join('; ');
}

/**
 * Invoke for / and /index.html BEFORE static file resolution and for unknown
 * document paths AFTER allowlisted asset resolution. Never mount ahead of API
 * routes or use it as an all-404 redirect. See INTEGRATION.md in this directory.
 */
export function createPublicPageHandler(
  template: string,
  environment: PublicEnvironment = process.env,
): RequestHandler {
  // Static-only requests (including security-test fixture directories) do not
  // require rendering or parsing an HTML template. Capture only explicit public
  // inputs now and lazily cache both pages at the first document request.
  const publicEnvironment = resolvePublicEnvironment(environment);
  let render: ReturnType<typeof createPublicPageRenderer> | undefined;
  return (req, res, next) => {
    if (!['GET', 'HEAD'].includes(req.method) || /^\/api(?:\/|\?|$)/.test(req.originalUrl)) return next();
    render ||= createPublicPageRenderer(template, publicEnvironment);
    const page = render(req.originalUrl);
    if (page.status === 308) {
      return res.status(308).set('Location', page.location).end();
    }

    const policy = res.getHeader('Content-Security-Policy');
    res.setHeader('Content-Security-Policy', withPublicScriptHashes(
      typeof policy === 'string' ? policy : "script-src 'self'",
      page.cspScriptHashes,
    ));
    res.setHeader('Cache-Control', page.status === 200 ? 'public, max-age=0, must-revalidate' : 'no-store');
    if (page.status === 404) res.setHeader('X-Robots-Tag', 'noindex, follow');
    return res.status(page.status).type('html').send(page.html);
  };
}
