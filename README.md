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
- `src/app/dashboard/layout.tsx`: shared dashboard shell with navigation and sign-out.
- `src/views/LandingPage.tsx`: server-rendered landing content and supplied artwork.
- `src/components/Header.tsx`: responsive navigation with keyboard dismissal.
- `src/components/SoccerTradeViewSection.tsx` and `ProductPreview.tsx`: market selection, candle aggregation and product walkthrough.
- `src/views/AuthPage.tsx`: login/registration validation, visibility toggles, loading and errors.
- `src/services/auth.ts`: preserved typed authentication boundary.
- `src/services/session.tsx`: session restoration, retry, user state and injectable test service.
- `src/components/ProtectedAccount.tsx`: reusable `RequireAuth` guard plus the account-page wrapper.
- `src/views/TelegramAccountsView.tsx`: Telegram account list, summary and state handling.
- `src/components/TelegramWizard.tsx`: multi-step Telegram connection wizard.
- `src/components/TelegramAccountCard.tsx`: per-account details, reconnect, health check and disconnect.
- `src/services/telegram.ts`: typed Telegram backend adapter configured by `NEXT_PUBLIC_TELEGRAM_API_BASE_URL`.
- `public/football-artwork.png`: original supplied artwork, displayed through `next/image`.

Next.js prerenders the landing page and server-renders auth pages. Static marketing content remains in Server Components; interactive elements use Client Components. Native metadata replaces the previous client updater. Vite entry points, React Router and custom HTML generation were removed.

## Routes

| Route                          | Behavior                                            |
| ------------------------------ | --------------------------------------------------- |
| `/`                            | Public landing page                                 |
| `/signup`                      | Registration form                                   |
| `/login`                       | Sign-in form                                        |
| `/dashboard`                   | Protected account shell; guests redirect to sign-in |
| `/dashboard/telegram-accounts` | Protected Telegram account management               |
| Unknown path                   | Next.js 404 page with a route home                  |

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

## Telegram accounts integration

`/dashboard/telegram-accounts` lets an authenticated owner connect and manage Telegram accounts through a separate Python/Telethon backend. **No backend is wired up yet**: without configuration the page reports that the integration is unavailable and never invents accounts.

### Configuration

Set `NEXT_PUBLIC_TELEGRAM_API_BASE_URL` (see `.env.example`) to the Python backend’s base URL, without a trailing slash. The value is inlined into the client bundle at build time, so it must be present in the Vercel project environment before `next build`. Leave it empty to keep the feature in its honest “not configured” state. Run `npm run dev` without the variable to see that state.

All requests are issued from `src/services/telegram.ts` with `credentials: "include"` so the website session cookie is forwarded. The Python backend must:

- Accept the website’s session cookie on every endpoint and enforce authorization server-side (the browser is never trusted with ownership).
- Allow the frontend origin in CORS with `Access-Control-Allow-Credentials: true` and an explicit `Access-Control-Allow-Origin` (not `*`).
- Treat `X-Requested-With: XMLHttpRequest` as the CSRF signal for cookie-authenticated mutations, or use `SameSite` cookies plus a CSRF token; the adapter sends the header on every request.
- Require HTTPS in production.

If the website later switches to bearer tokens, add the `Authorization` header in the single `request()` helper in `src/services/telegram.ts`; no UI changes are needed.

### Expected API contract

All paths are relative to `NEXT_PUBLIC_TELEGRAM_API_BASE_URL`. Success bodies use camelCase JSON. Errors use `{ "error": { "code", "message", "retryAfterSeconds?" } }`; unknown codes fall back to HTTP-status mapping (401 → unauthorized, 404 → not-found, 410 → expired, 429 → flood-wait, 400/422 → validation, 5xx → server). Wire codes recognized by name: `invalid_phone`, `invalid_code`, `code_expired`, `expired`, `incorrect_password`, `flood_wait`, `rate_limited`, `unauthorized`, `not_found`, `validation`, `server_error`.

| Method | Endpoint                                            | Purpose                                               | Status          |
| ------ | --------------------------------------------------- | ----------------------------------------------------- | --------------- |
| POST   | `/api/v1/telegram/connections`                      | Start a connection (`{ phoneNumber }`)                | pending backend |
| POST   | `/api/v1/telegram/connections/{id}/send-code`       | Request or resend a code                              | pending backend |
| POST   | `/api/v1/telegram/connections/{id}/verify-code`     | Verify the login code (`{ code }`)                    | pending backend |
| POST   | `/api/v1/telegram/connections/{id}/verify-password` | Submit two-step verification (`{ password }`)         | pending backend |
| GET    | `/api/v1/telegram/connections/{id}`                 | Retrieve connection status                            | pending backend |
| GET    | `/api/v1/telegram/accounts`                         | List accounts (`{ accounts: [...] }` or a bare array) | pending backend |
| GET    | `/api/v1/telegram/accounts/{id}`                    | Retrieve account details                              | pending backend |
| POST   | `/api/v1/telegram/accounts/{id}/reconnect`          | Reconnect an account                                  | pending backend |
| DELETE | `/api/v1/telegram/accounts/{id}`                    | Disconnect an account (204 or `{ ok: true }`)         | pending backend |
| GET    | `/api/v1/telegram/accounts/{id}/health`             | Retrieve account health                               | pending backend |

Connection responses share one shape: `{ connectionId, nextStep, expiresAt, retryAfterSeconds?, message?, account? }` where `nextStep` is one of `phone`, `code`, `password`, `connecting`, `completed`, `expired`, `failed`. Accounts use `{ id, telegramUserId, username, displayName, maskedPhoneNumber, status, lastConnectedAt, lastActivityAt, lastError }` with `status` in `connected`, `connecting`, `disconnected`, `reconnecting`, `requires_attention`, `unknown`. Health responses use `{ accountId, status, lastCheckedAt, message }`. The frontend types live in `src/services/telegram.ts` and should be adapted when the real backend contract is finalized.

### Security behavior

Verification codes and two-step verification passwords exist only in component memory for the lifetime of a request; forms are cleared immediately after submission, nothing is written to local storage, session storage or cookies, and secrets are never logged. Session strings, API hashes and encryption keys stay on the Python backend. The wizard polls connection status only while it is open and only for the active attempt.

### Testing the wizard

Unit tests (`npm run test:unit`) drive the wizard against an injected fake `TelegramService`; the production service always reports unavailability until the backend URL is configured. Browser tests cover the unauthenticated redirect for `/dashboard/telegram-accounts`. To exercise the real flow locally, run the Python backend, set `NEXT_PUBLIC_TELEGRAM_API_BASE_URL`, sign in, and open **Dashboard → Telegram Accounts → Connect Telegram**.

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

Unit tests exercise the authentication lifecycle with injected test-only adapters: session restoration, redirects, registration, email verification, loading, network/credential errors, retries and logout. Telegram tests cover the API adapter’s request construction and error mapping plus the accounts view and connection wizard. Browser tests cover navigation, validation, missing-backend behavior, chart controls, five responsive widths, mobile navigation, the protected Telegram route and accessibility. Production tests check server HTML, metadata, hydration, protected-route redirects and 404 pages.

# telegram_relay_frontend
