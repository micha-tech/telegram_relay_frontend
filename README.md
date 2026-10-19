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
- `src/services/api.ts`: shared HTTP boundary — base URL, JWT bearer auth, automatic access-token refresh, and the backend `{ success, data, message }` envelope.
- `src/services/auth.ts`: login, registration, logout and session lookup against the Django/SimpleJWT backend; access and refresh tokens are stored in `localStorage`.
- `src/services/session.tsx`: session restoration, retry, user state and injectable test service.
- `src/components/ProtectedAccount.tsx`: reusable `RequireAuth` guard plus the account-page wrapper.
- `src/views/TelegramAccountsView.tsx`: Telegram account list, summary and state handling.
- `src/components/TelegramWizard.tsx`: multi-step Telegram connection wizard (phone → code → two-step verification).
- `src/components/TelegramAccountCard.tsx`: per-account details, reconnect, health check, recent activity and disconnect.
- `src/services/telegram.ts`: typed adapter for the Django/Telethon relay API, configured by `NEXT_PUBLIC_TELEGRAM_API_BASE_URL`.
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

Authentication talks to the Django REST Framework backend through `src/services/api.ts` and `src/services/auth.ts` using SimpleJWT bearer tokens.

- `getSession()` returns the verified user from `GET /auth/me`, or `null` when there is no access token or the token is rejected.
- `login({ email, password })` posts to `POST /auth/login` and stores the returned access and refresh tokens.
- `register({ name, email, password })` posts to `POST /auth/register`. The backend currently ignores `name`; the UI derives a display name from the email until the backend persists it.
- `logout()` blacklists the refresh token via `POST /auth/logout`, then clears local tokens. If the request fails the user stays signed in so they can retry.
- Access tokens last 15 minutes. `src/services/api.ts` transparently refreshes them via `POST /auth/refresh` on a `401` and retries the request once. If the refresh fails the tokens are cleared and the user is treated as signed out.
- `AuthError` maps backend failures to `unavailable`, `invalid-credentials`, `email-in-use`, `network` and `validation`, exposing field errors where the backend provides them.

Tokens are stored in `localStorage` (a deliberate product decision). This is convenient for a bearer-token API but is readable by any script on the origin; prefer HttpOnly cookies once the backend supports a cookie session. The client route guard preserves the existing UX; it is not server authorization — the backend is the source of truth for ownership.

### Required backend CORS

The browser calls the backend cross-origin, so the backend must allow the frontend origin. On the VPS set the backend environment variable and restart:

```sh
CORS_ORIGINS=http://localhost:5173,https://your-frontend-domain
```

The deployed backend currently only allows its own origin, so requests from `http://localhost:5173` are blocked until this is set. `django-cors-headers` already allows the `authorization` and `content-type` headers used here; `CORS_ALLOW_CREDENTIALS` stays `false` because bearer tokens are used instead of cookies.

## Telegram accounts integration

`/dashboard/telegram-accounts` lets an authenticated owner connect and manage Telegram accounts through the Python/Telethon relay backend. Requests use the same JWT bearer token as authentication.

### Configuration

Set `NEXT_PUBLIC_TELEGRAM_API_BASE_URL` (see `.env.example`) to the backend’s API base **including the version prefix**, without a trailing slash, e.g. `https://telethon.example.com/api/v1`. The value is inlined into the client bundle at build time, so it must be present in the Vercel project environment before `next build`. Leave it empty to keep the feature in its honest “not configured” state. Run `npm run dev` without the variable to see that state.

The browser tests run the dev server with an empty value so they stay deterministic and never hit a live backend.

### API contract

All paths are relative to `NEXT_PUBLIC_TELEGRAM_API_BASE_URL`. Successful responses use the envelope `{ success: true, data, message }`; errors use `{ success: false, data: null, message, error: { code, details } }`. Backend error codes are mapped to typed `TelegramApiError` codes (`unauthorized`, `forbidden`, `not-found`, `flood-wait`, `validation`, `server`, `request`); throttling messages expose a `retryAfterSeconds` hint.

| Method | Endpoint                              | Purpose                                                 |
| ------ | ------------------------------------- | ------------------------------------------------------- |
| POST   | `/auth/register`                      | Create an account (`{ email, password }`)               |
| POST   | `/auth/login`                         | Sign in (`{ email, password }`)                         |
| POST   | `/auth/logout`                        | Blacklist a refresh token (`{ refresh }`)               |
| POST   | `/auth/refresh`                       | Refresh an access token (`{ refresh }`)                 |
| GET    | `/auth/me`                            | Current user (`{ id, email }`)                          |
| POST   | `/telegram/auth/start`                | Start a login challenge (`{ phone_number }`)            |
| POST   | `/telegram/auth/verify`               | Verify the login code (`{ challenge_id, code }`)        |
| POST   | `/telegram/auth/2fa`                  | Submit two-step password (`{ challenge_id, password }`) |
| GET    | `/telegram/accounts/`                 | List accounts (paginated `{ count, results }`)          |
| GET    | `/telegram/accounts/{id}/`            | Retrieve an account                                     |
| GET    | `/telegram/accounts/{id}/health/`     | Retrieve account health                                 |
| GET    | `/telegram/accounts/{id}/events/`     | Recent connection events                                |
| GET    | `/telegram/accounts/{id}/dialogs/`    | Telegram dialogs for the account                        |
| POST   | `/telegram/accounts/{id}/reconnect/`  | Reconnect a stored session                              |
| POST   | `/telegram/accounts/{id}/disconnect/` | Disconnect and revoke the session                       |

Challenge responses are `{ challenge_id, status, expires_at }` where `status` is `code_sent`, `password_required`, `complete`, `failed` or `expired`. Accounts use `{ id, phone_masked, telegram_user_id, display_name, username, status, last_connected_at, last_activity_at, last_error, created_at }` with `status` in `pending`, `connected`, `disconnected`, `invalid`, `error`. Health responses use `{ status, session_present, worker_active, last_connected_at, last_activity_at, last_error, checked_at }`. The frontend types live in `src/services/telegram.ts`.

### Security behavior

Verification codes and two-step verification passwords exist only in component memory for the lifetime of a request; forms are cleared immediately after submission, nothing is written to local storage, session storage or cookies, and secrets are never logged. Session strings, API hashes and encryption keys stay on the Python backend.

### Testing the wizard

Unit tests (`npm run test:unit`) drive the wizard and account views against an injected fake `TelegramService`. Browser tests cover the unauthenticated redirect for `/dashboard/telegram-accounts` and the honest “not configured” state. To exercise the real flow locally, run the Python backend, set `NEXT_PUBLIC_TELEGRAM_API_BASE_URL` (with `/api/v1`), add the frontend origin to the backend `CORS_ORIGINS`, sign in, and open **Dashboard → Telegram Accounts → Connect Telegram**.

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
