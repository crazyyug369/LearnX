# Public React SSR integration

The frontend is ready for anonymous React SSR. `server.ts` must call the helper
below instead of sending the unrendered Vite `dist/index.html`. The helper uses
`react-dom/server`; `src/main.tsx` hydrates the resulting anonymous App snapshot.
No cookie, authenticated profile, roster, mastery, tutor history, or database
lookup is used to generate this document. Saved tabs/theme and the session
request run only after hydration. Public curriculum/FAQs stay visible across
client-side tab changes, so the URL `/` retains its public metadata.

## Production `createStaticAssetHandler(distRoot)`

Add this import in `server.ts` (esbuild includes the renderer in `server.cjs`):

```ts
import { createPublicPageHandler } from './src/public-site/server';
```

Replace the `spaRoutes` / sendFile-for-home logic inside
`createStaticAssetHandler` with this flow, retaining the existing static
allowlist, traversal checks, and `resolveStaticAssetPath` unchanged:

```ts
export function createStaticAssetHandler(distRoot: string): RequestHandler {
  const publicPage = createPublicPageHandler(
    fs.readFileSync(path.join(distRoot, 'index.html'), 'utf8'),
    {
      PUBLIC_AUTHOR_NAME: process.env.PUBLIC_AUTHOR_NAME,
      PUBLIC_AUTHOR_BIO: process.env.PUBLIC_AUTHOR_BIO,
    },
  );

  return (req, res, next) => {
    const requestPath = req.originalUrl.split('?')[0] || '/';
    if (/^\/api(?:\/|$)/.test(requestPath)) return next();

    // This must precede sendFile: /index.html is a 308, not a second homepage.
    if (requestPath === '/' || requestPath === '/index.html') {
      return publicPage(req, res, next);
    }

    const assetPath = resolveStaticAssetPath(distRoot, requestPath);
    if (assetPath) return res.sendFile(assetPath);

    // Asset/traversal failures stay plain 404. This also keeps the existing
    // static-security tests independent of their intentionally minimal HTML
    // fixture. Missing .html documents still get proper not-found metadata.
    const extension = path.posix.extname(requestPath).toLowerCase();
    if (requestPath.startsWith('/assets/') || (extension && extension !== '.html')) {
      return res.status(404).send('Not Found');
    }

    // A missing public document gets 404 HTML, never a home redirect.
    return publicPage(req, res, next);
  };
}
```

Keep the existing final API 404 handling and security middleware ahead of the
static handler. Ensure GET and HEAD reach this handler. `GET /index.html` returns
one **308** to `/` (query parameters are preserved), `/` returns **200**, and
unknown document paths return **404** with noindex metadata and no home canonical
or JSON-LD. Missing assets remain 404, not home redirects. Do not pass request
headers, cookies, current-user data, or database state into the renderer.

The template requires exactly one `<!--learnx-public-head-->` and one
`<div id="root"><!--learnx-public-app--></div>` marker; Vite preserves these while
adding the real production JS/CSS links. Rebuild the frontend before starting
the compiled server. Do not deploy Vite preview or a bare static host as the
production SSR server. The helper defers template validation/rendering until
the first document request, so static-only tests can retain their existing
minimal dist fixtures. Tests that request rendered documents need the actual
template.

## CSP

Keep `script-src 'self'`. All executable scripts are external same-origin assets;
the font stylesheet uses a regular stylesheet link, with no inline onload
handler. `createPublicPageHandler` extends the existing response's **script-src
only** with the exact SHA-256 hashes of the two non-executable JSON-LD blocks.
It leaves the remaining CSP directives intact. No nonce or `unsafe-inline`
script permission is needed. If using `renderPublicDocument` or
`createPublicPageRenderer` directly instead, add `page.cspScriptHashes` through
`withPublicScriptHashes(existingPolicy, page.cspScriptHashes)` before sending
`page.html`. Do not change the JSON-LD whitespace after hashing it.

## Explicit public author text

There is no default author, team bio, credential, or expert claim. To publish
one, set **both** `PUBLIC_AUTHOR_NAME` and `PUBLIC_AUTHOR_BIO` to accurate public
text, then restart the server. React escapes the visible text, head meta, and
hydration data attributes. These are public fields, never private environment
values. A partial/empty configuration publishes nothing. The origin is the real
production URL in `content.ts`, `public/sitemap.xml`, and `public/robots.txt`;
update these together if the production domain changes. The sitemap contains
only the existing public document `/`, with no fabricated curriculum URLs or
unverified last-modified date.

## Vite development

Direct Vite source development still uses `createRoot` when the SSR marker is
absent. To exercise SSR in Vite middleware mode, call
`vite.transformIndexHtml(requestPath, sourceIndexHtml)`, then pass that transformed
template to `createPublicPageHandler`/`renderPublicDocument`; invoke it for `/`,
`/index.html`, and unknown **document** requests after Vite has served its assets.
The production build/server path above is the required crawler/no-JS behavior.
