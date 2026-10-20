import { test } from 'node:test';
import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { readFileSync } from 'node:fs';
import React, { StrictMode, act } from 'react';
import { hydrateRoot } from 'react-dom/client';
import { JSDOM } from 'jsdom';
import express from 'express';
import request from 'supertest';
import App from '../src/App';
import {
  PUBLIC_CURRICULUM,
  PUBLIC_DESCRIPTION,
  PUBLIC_FAQ_ITEMS,
  PUBLIC_TITLE,
  PUBLIC_URL,
  getPublicAuthor,
  serializeStructuredData,
} from '../src/public-site/content';
import {
  createPublicPageHandler,
  createPublicPageRenderer,
  renderPublicDocument,
} from '../src/public-site/server';
import { updateSeoMetadata } from '../src/utils/seo';

const template = readFileSync(new URL('../index.html', import.meta.url), 'utf8');
const home = renderPublicDocument(template, '/');

function documentFor(html: string, pathname = '/') {
  // Scripts intentionally do not run: this is the actual crawler/no-JS view.
  return new JSDOM(html, { url: new URL(pathname, PUBLIC_URL).href }).window.document;
}

test('anonymous HTML contains the real React app, every public curriculum topic, and usable no-JS FAQs', () => {
  const document = documentFor(home.html);
  assert.equal(home.status, 200);
  assert.equal(document.querySelector('#root')?.getAttribute('data-learnx-ssr'), 'anonymous-v1');
  assert.ok(document.querySelector('#app-root #btn-start-adaptive-lesson'), 'actual learning app is server-rendered');
  assert.ok(document.querySelector('#app-root #svg-node-math-1'), 'actual graph is server-rendered');
  assert.equal(document.querySelector('#server-rendered-home'), null, 'no handwritten fallback');
  assert.equal(document.querySelector('noscript h1'), null, 'no duplicate no-JS title');
  assert.equal(document.querySelector('#learning-app [style*="opacity:0"]'), null, 'SSR app is not animation-hidden');

  const topics = [...document.querySelectorAll('#curriculum h3')].map((heading) => heading.textContent);
  assert.deepEqual(topics, PUBLIC_CURRICULUM.flatMap(({ concepts }) => concepts.map(({ title }) => title)));
  for (const { concepts } of PUBLIC_CURRICULUM) {
    for (const concept of concepts) {
      assert.ok(document.querySelector('#curriculum')?.textContent?.includes(concept.description));
      assert.equal('masteryScore' in concept, false);
      assert.equal('status' in concept, false);
    }
  }
  assert.equal(document.querySelectorAll('#faq').length, 1);
  assert.equal(document.querySelectorAll('#faq details').length, PUBLIC_FAQ_ITEMS.length);
});

test('public document has one H1, one production canonical, useful metadata and matching social metadata', () => {
  const document = documentFor(home.html);
  assert.equal(document.querySelectorAll('h1').length, 1);
  assert.equal(document.querySelector('h1')?.textContent, PUBLIC_TITLE);
  assert.equal(document.querySelectorAll('link[rel="canonical"]').length, 1);
  assert.equal(document.querySelector('link[rel="canonical"]')?.getAttribute('href'), PUBLIC_URL);
  assert.equal(document.title, PUBLIC_TITLE);
  assert.equal(document.querySelector('meta[name="description"]')?.getAttribute('content'), PUBLIC_DESCRIPTION);
  assert.equal(document.querySelector('meta[name="robots"]')?.getAttribute('content'), 'index, follow');
  assert.equal(document.querySelector('meta[property="og:url"]')?.getAttribute('content'), PUBLIC_URL);
  assert.equal(document.querySelector('meta[property="og:description"]')?.getAttribute('content'), PUBLIC_DESCRIPTION);
  assert.equal(document.querySelector('meta[name="twitter:title"]')?.getAttribute('content'), PUBLIC_TITLE);
});

test('FAQ JSON-LD exactly matches the one visible FAQ; no invented breadcrumb or author is published', () => {
  const document = documentFor(home.html);
  const scripts = [...document.querySelectorAll('script[type="application/ld+json"]')];
  assert.equal(scripts.length, 2);
  const faq = scripts.map((script) => JSON.parse(script.textContent!)).find((data) => data['@type'] === 'FAQPage');
  const visible = [...document.querySelectorAll('#faq details')].map((item) => ({
    question: item.querySelector('summary')?.textContent,
    answer: item.querySelector('p')?.textContent,
  }));
  assert.deepEqual(visible, [...PUBLIC_FAQ_ITEMS]);
  assert.deepEqual(faq.mainEntity.map((item: any) => ({ question: item.name, answer: item.acceptedAnswer.text })), visible);
  assert.equal(document.querySelector('[aria-label="Breadcrumb"]'), null);
  assert.ok(!scripts.some((script) => script.textContent?.includes('BreadcrumbList')));
  assert.equal(document.querySelector('#public-author-heading'), null);
  assert.equal(document.querySelector('meta[name="author"]'), null);
  assert.ok(!home.html.includes('Curriculum Team'));
});

test('SSR never reads browser storage or calls authenticated endpoints, even in a browser-like process', () => {
  const keys = ['window', 'document', 'localStorage', 'sessionStorage', 'fetch'] as const;
  const previous = keys.map((key) => [key, Object.getOwnPropertyDescriptor(globalThis, key)] as const);
  const dom = new JSDOM('', { url: 'http://localhost/' });
  dom.window.sessionStorage.setItem('learnx_active_tab', 'admin');
  const forbidden = new Proxy({}, { get() { throw new Error('SSR must not inspect browser state'); } });
  try {
    Object.defineProperties(globalThis, {
      window: { configurable: true, value: dom.window },
      document: { configurable: true, value: dom.window.document },
      localStorage: { configurable: true, value: forbidden },
      sessionStorage: { configurable: true, value: forbidden },
      fetch: { configurable: true, value: () => { throw new Error('SSR must not fetch session/private data'); } },
    });
    const rendered = renderPublicDocument(template, '/');
    assert.equal(rendered.html, home.html, 'public response is independent of browser state');
    assert.doesNotMatch(rendered.html, /Aarav Sharma|Diya Patel|STU-2026|student\.learnx\.org|learnx_tutor_chat_|masteryScore|correctIndex/);
    assert.equal(documentFor(rendered.html).querySelector('input[type="password"]'), null);
  } finally {
    for (const [key, descriptor] of previous) {
      if (descriptor) Object.defineProperty(globalThis, key, descriptor);
      else Reflect.deleteProperty(globalThis, key);
    }
    dom.window.close();
  }
});

test('author biography is opt-in from both explicit public inputs, escaped in HTML and hydration attributes', () => {
  const name = 'Sam <img src=x onerror="alert(1)"> & "Lee"';
  const bio = '</div><script>alert("bio")</script> I explain algebra & physics.';
  for (const environment of [{ PUBLIC_AUTHOR_NAME: name }, { PUBLIC_AUTHOR_BIO: bio }, {}]) {
    assert.equal(documentFor(renderPublicDocument(template, '/', environment).html).querySelector('#public-author-heading'), null);
  }
  const rendered = renderPublicDocument(template, '/', { PUBLIC_AUTHOR_NAME: name, PUBLIC_AUTHOR_BIO: bio });
  const document = documentFor(rendered.html);
  assert.equal(document.querySelector('#public-author-heading')?.textContent, `About ${name}`);
  assert.equal(document.querySelector('#public-author-bio')?.textContent, bio);
  assert.equal(document.querySelector('#root')?.getAttribute('data-public-author-name'), name);
  assert.equal(document.querySelector('#root')?.getAttribute('data-public-author-bio'), bio);
  assert.equal(document.querySelector('meta[name="author"]')?.getAttribute('content'), name);
  assert.equal(document.querySelector('#public-author-bio script'), null);
  assert.equal(document.querySelectorAll('[onerror]').length, 0);
  assert.equal(document.querySelectorAll('script:not([src]):not([type="application/ld+json"])').length, 0);
  assert.equal(getPublicAuthor(' ', bio), undefined);
});

test('unknown paths have real 404 responses, one not-found H1, no home canonical/schema, and a useful home link', () => {
  const render = createPublicPageRenderer(template, { PUBLIC_AUTHOR_NAME: 'Explicit name', PUBLIC_AUTHOR_BIO: 'Explicit public bio' });
  for (const pathname of ['/missing', '/lesson', '/tutor', '/admin', '/teacher', '/assets/missing.js', '//other.example/']) {
    const response = render(pathname);
    assert.equal(response.status, 404, pathname);
    assert.ok('html' in response);
    const document = documentFor(response.html, pathname);
    assert.equal(document.querySelectorAll('h1').length, 1);
    assert.equal(document.querySelector('h1')?.textContent?.trim(), 'Page not found');
    assert.equal(document.title, 'Page not found | LearnX');
    assert.match(document.querySelector('meta[name="robots"]')?.getAttribute('content') || '', /noindex/);
    assert.equal(document.querySelector('link[rel="canonical"]'), null);
    assert.equal(document.querySelector('script[type="application/ld+json"]'), null);
    assert.equal(document.querySelector('#public-author-bio'), null);
    assert.equal(document.querySelector('#faq'), null);
    assert.equal(document.querySelector('a')?.getAttribute('href'), '/');
    assert.deepEqual(response.cspScriptHashes, []);
  }
});

test('/index.html redirects in a single 308 hop while query-only homepage variants use the real canonical', () => {
  const render = createPublicPageRenderer(template);
  for (const [target, location] of [['/index.html', '/'], ['/index.html?utm_source=course', '/?utm_source=course']]) {
    const response = render(target);
    assert.equal(response.status, 308);
    assert.ok('location' in response);
    assert.equal(response.location, location);
    assert.equal(render(response.location).status, 200);
  }
  const response = render('/?tab=admin');
  assert.equal(response.status, 200);
  assert.ok('html' in response);
  assert.equal(documentFor(response.html).querySelector('link[rel="canonical"]')?.getAttribute('href'), PUBLIC_URL);
});

test('HTML uses external self scripts and stylesheet links, with exact CSP hashes for non-executable JSON-LD', () => {
  const document = documentFor(home.html);
  assert.equal(document.querySelectorAll('[onload], [onclick], [onerror]').length, 0);
  assert.ok(document.querySelector('link[rel="stylesheet"][href^="https://fonts.googleapis.com/"]'));
  assert.equal(document.querySelector('script[src="/early-seo.js"]'), null);
  for (const script of document.querySelectorAll('script:not([type="application/ld+json"])')) {
    assert.ok(script.getAttribute('src')?.startsWith('/'));
    assert.equal(script.textContent, '');
  }
  assert.deepEqual(home.cspScriptHashes, [...document.querySelectorAll('script[type="application/ld+json"]')].map((script) =>
    `'sha256-${createHash('sha256').update(script.textContent!).digest('base64')}'`,
  ));
  const hostile = { text: '</script><script>alert(1)</script> & \u2028\u2029' };
  const serialized = serializeStructuredData(hostile);
  assert.ok(!serialized.includes('<'));
  assert.deepEqual(JSON.parse(serialized), hostile);
});

test('HTTP helper preserves CSP, anonymous bytes, API routing, status and HEAD semantics', async () => {
  const app = express();
  const basePolicy = "default-src 'self'; script-src 'self'; style-src 'self' 'unsafe-inline' https://fonts.googleapis.com; object-src 'none'";
  app.use((_req, res, next) => { res.setHeader('Content-Security-Policy', basePolicy); next(); });
  app.get('/api/ping', (_req, res) => res.json({ ok: true }));
  app.get('*', createPublicPageHandler(template));
  const anonymous = await request(app).get('/');
  const withCookie = await request(app).get('/').set('Cookie', 'token=private-session; user=secret');
  assert.equal(anonymous.status, 200);
  assert.equal(withCookie.text, anonymous.text);
  assert.equal(anonymous.headers['set-cookie'], undefined);
  assert.equal(anonymous.headers['content-type'], 'text/html; charset=utf-8');
  assert.ok(anonymous.headers['content-security-policy'].includes("script-src 'self' 'sha256-"));
  assert.ok(anonymous.headers['content-security-policy'].includes("object-src 'none'"));
  assert.ok(!anonymous.headers['content-security-policy'].includes("script-src 'self' 'unsafe-inline'"));
  const head = await request(app).head('/');
  assert.equal(head.status, 200);
  assert.equal(head.text, undefined);
  assert.equal(head.headers['content-length'], anonymous.headers['content-length']);
  const redirect = await request(app).get('/index.html');
  assert.equal(redirect.status, 308);
  assert.equal(redirect.headers.location, '/');
  assert.equal((await request(app).get(redirect.headers.location)).status, 200);
  const notFound = await request(app).get('/not-a-real-page');
  assert.equal(notFound.status, 404);
  assert.equal(notFound.headers.location, undefined);
  assert.equal(notFound.headers['x-robots-tag'], 'noindex, follow');
  assert.equal(notFound.headers['content-security-policy'], basePolicy);
  assert.equal((await request(app).get('/api/ping')).body.ok, true);
});

test('real hydration retains the SSR public nodes, restores private-tab preferences afterward, and keeps / indexable', async () => {
  const dom = new JSDOM(home.html, { url: PUBLIC_URL, pretendToBeVisual: true });
  const keys = ['window', 'document', 'navigator', 'Event', 'CustomEvent', 'localStorage', 'sessionStorage', 'fetch', 'IS_REACT_ACT_ENVIRONMENT'] as const;
  const previous = keys.map((key) => [key, Object.getOwnPropertyDescriptor(globalThis, key)] as const);
  const errors: unknown[] = [];
  let root: ReturnType<typeof hydrateRoot> | undefined;
  try {
    Object.defineProperties(globalThis, {
      window: { configurable: true, value: dom.window },
      document: { configurable: true, value: dom.window.document },
      navigator: { configurable: true, value: dom.window.navigator },
      Event: { configurable: true, value: dom.window.Event },
      CustomEvent: { configurable: true, value: dom.window.CustomEvent },
      localStorage: { configurable: true, value: dom.window.localStorage },
      sessionStorage: { configurable: true, value: dom.window.sessionStorage },
      fetch: { configurable: true, value: () => new Promise(() => {}) },
      IS_REACT_ACT_ENVIRONMENT: { configurable: true, value: true },
    });
    dom.window.sessionStorage.setItem('learnx_active_tab', 'admin');
    dom.window.localStorage.setItem('learnx_theme_mode', 'dark');
    const mount = dom.window.document.getElementById('root')!;
    const faq = dom.window.document.getElementById('faq');
    const curriculum = dom.window.document.getElementById('curriculum');
    const heading = dom.window.document.getElementById('public-page-heading');
    await act(async () => {
      root = hydrateRoot(mount, <StrictMode><App pathname="/" /></StrictMode>, {
        onRecoverableError: (error) => errors.push(error),
      });
    });
    assert.deepEqual(errors, [], 'React must hydrate rather than replace mismatched server content');
    assert.equal(dom.window.document.getElementById('faq'), faq);
    assert.equal(dom.window.document.getElementById('curriculum'), curriculum);
    assert.equal(dom.window.document.getElementById('public-page-heading'), heading);
    assert.ok(dom.window.document.querySelector('[role="status"]')?.textContent?.includes('Authenticating secure session'));
    assert.equal(dom.window.sessionStorage.getItem('learnx_active_tab'), 'admin');
    assert.equal(dom.window.document.querySelector('meta[name="robots"]')?.getAttribute('content'), 'index, follow');
    assert.equal(dom.window.document.querySelector('link[rel="canonical"]')?.getAttribute('href'), PUBLIC_URL);
    assert.equal(dom.window.document.querySelectorAll('h1').length, 1);
    for (const activeTab of ['lesson', 'assessment', 'progress', 'tutor', 'teacher', 'admin'] as const) {
      updateSeoMetadata({ activeTab, isNotFoundPath: false });
      assert.equal(dom.window.document.querySelector('meta[name="robots"]')?.getAttribute('content'), 'index, follow');
      assert.equal(dom.window.document.querySelectorAll('link[rel="canonical"]').length, 1);
      assert.equal(dom.window.document.querySelectorAll('script[type="application/ld+json"]').length, 2);
    }
  } finally {
    if (root) await act(async () => root!.unmount());
    for (const [key, descriptor] of previous) {
      if (descriptor) Object.defineProperty(globalThis, key, descriptor);
      else Reflect.deleteProperty(globalThis, key);
    }
    dom.window.close();
  }
});
