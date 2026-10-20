<div align="center">
<img width="1200" height="475" alt="GHBanner" src="https://ai.google.dev/static/site-assets/images/share-ais-513315318.png" />
</div>

# Run and deploy your AI Studio app

This contains everything you need to run your app locally.

View your app in AI Studio: https://ai.studio/apps/bd42e5f2-8440-4070-bd8d-a4140baa7ff8

## Run Locally

**Prerequisites:**  Node.js


1. Install dependencies:
   `npm install`
2. Copy `.env.example` to a local, ignored `.env` file and set the server-only
   `GEMINI_API_KEY`, database credentials, and `JWT_SECRET`. Never prefix secrets
   with `VITE_`, commit them, or expose them to browser code.
3. Run the app:
   `npm run dev`

### Optional public-site settings

The public shell accepts intentionally public, non-secret values. Set the
`VITE_PUBLIC_*` variants for the client build and the matching `PUBLIC_*`
variants for server-rendered HTML:

- `PUBLIC_LAST_UPDATED` / `VITE_PUBLIC_LAST_UPDATED` (`YYYY-MM-DD` or another
  non-future date)
- `PUBLIC_CONTACT_EMAIL` / `VITE_PUBLIC_CONTACT_EMAIL`
- `PUBLIC_CONTACT_PHONE` / `VITE_PUBLIC_CONTACT_PHONE`
- `PUBLIC_CREATOR_URL` / `VITE_PUBLIC_CREATOR_URL`
- `PUBLIC_CREATOR_LABEL` / `VITE_PUBLIC_CREATOR_LABEL`
- `PUBLIC_SITE_PHRASE` / `VITE_PUBLIC_SITE_PHRASE`

These values are rendered publicly in the footer, contact action, and
attribution area. Leave them blank to omit those links; do not put secrets in
these variables. For example, the creator label can be set to `Krishan Builds`
once the correct public URL is known.
