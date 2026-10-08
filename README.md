# Prime Edge Football

Next.js 16 App Router frontend with React 19 and TypeScript. The public site uses the supplied football artwork, a midnight-blue interface, self-hosted fonts, and interactive SoccerTradeView charts. Lists use numbered rows or plain text, never checkmarks.

## Run locally

Requires Node.js 22.12+ (developed with Node.js 26).

```sh
npm ci
npm run dev
```

Open http://localhost:5173. Run `npm run build` followed by `npm start` for the production server on the same port. `npm run preview` serves the production build on port 4173.

## Deploy to Vercel

Import the repository into Vercel and select the **Next.js** framework preset. Keep the default build command (`npm run build`) and default output settings. Next.js manages output in `.next`; do not set the output directory to `dist`.

No SPA rewrite or `200.html` fallback is required. Remove any Vite-era catch-all rewrite from project settings before deployment. Next.js handles routing, server rendering, metadata, static assets and image optimization. This migration does not deploy the app.

## Architecture

- `src/app/`: App Router layouts, pages, metadata, 404/error boundaries and global styles.
- `src/views/LandingPage.tsx`: server-rendered landing content and supplied artwork.
- `src/components/Header.tsx`: responsive navigation with keyboard dismissal.
- `src/components/SoccerTradeViewSection.tsx` and `ProductPreview.tsx`: market selection, candle aggregation and product walkthrough.
- `src/views/AuthPage.tsx`: login/registration validation, visibility toggles, loading and errors.
- `src/services/auth.ts`: preserved typed authentication boundary.
- `src/services/session.tsx`: session restoration, retry, user state and injectable test service.
- `src/components/ProtectedAccount.tsx`: workspace guard and safe return URL.
- `public/football-artwork.png`: original supplied artwork, displayed through `next/image`.

Next.js prerenders the landing page and server-renders auth pages. Static marketing content remains in Server Components; interactive elements use Client Components. Native metadata replaces the previous client updater. Vite entry points, React Router and custom HTML generation were removed.

## Routes

| Route        | Behavior                                            |
| ------------ | --------------------------------------------------- |
| `/`          | Public landing page                                 |
| `/signup`    | Registration form                                   |
| `/login`     | Sign-in form                                        |
| `/dashboard` | Protected account shell; guests redirect to sign-in |
| Unknown path | Next.js 404 page with a route home                  |

Auth pages accept a `next` query parameter restricted to local `/dashboard` destinations and are marked `noindex`.

## Authentication integration

**No backend has been provided. Login and registration deliberately report service unavailability. They never simulate success, invent API endpoints, or persist credentials.**

The original contract is preserved:

- `getSession()` returns a verified user or `null`.
- `login({ email, password })` returns a verified user.
- `register({ name, email, password })` returns an authenticated user or verification-required result.
- `logout()` invalidates the server session before the UI clears its user.
- `AuthError` supports credential failures, validation and field errors; network errors receive retry guidance.

Implement these functions using the actual backend contract. Prefer secure HttpOnly cookies and enforce authorization on the server for private data. The client route guard preserves the existing UX; it is not server authorization. The account page remains an integration shell, not a working subscription dashboard.

Registration still requires eight password characters; sign-in passwords are unchanged. Remember-me, password reset, contact and legal links remain omitted until supported flows exist.

## Data and artwork

Chart scores, odds, match events and signals are labelled illustrative. Market controls retain their existing sample-data behavior. The supplied artwork is visual direction, not a live feed. No prices, testimonials or performance claims are invented. Subscriptions, payments and live data require their backend services.

Manrope and IBM Plex Mono are self-hosted, with licenses in `public/fonts/`.

## Verification

```sh
npx playwright install chromium
npm test
npm run build
npm run test:production
npm run format:check
```

Unit tests exercise the authentication lifecycle with injected test-only adapters: session restoration, redirects, registration, email verification, loading, network/credential errors, retries and logout. Browser tests cover navigation, validation, missing-backend behavior, chart controls, five responsive widths, mobile navigation and accessibility. Production tests check server HTML, metadata, hydration, protected-route redirects and 404 pages.

# telegram_relay_frontend
