# Go

A small, dark directions website for the Nokia 3210 4G and Opera Mini. Walking and driving across the UK, with Romsey-biased place search. Planned address: **go.wholegrainstudios.co.uk**.

Go renders ordinary HTML on the server. The phone needs no JavaScript, GPS, map tiles or app installation. Each turn shows a fixed travel-time estimate; you move through the route with Prev and Next. Road names expand on request, which is the only intentionally scrolling state.

## Run locally

Requires Node.js 24 or newer. Install dependencies from the pinned pnpm lockfile:

```sh
npx --yes pnpm@11.19.0 install --frozen-lockfile
cp .env.example .env
```

For the sample journey, edit `.env` and set `GO_DEMO=1`, then:

```sh
node --env-file=.env src/server.mjs
```

Open http://127.0.0.1:3000. Search **Romsey**, select a result, then search **Abbey**. Choose Walk or Drive and Begin. All demo screens say **Demo · sample journey**. Demo directions are fictional test data, including the deliberately long road name; do not use them to navigate. London and Belfast searches also demonstrate distant results.

The local server binds only to your computer. It does not publish your site or make it accessible to your phone. Use the later Netlify deployment for handset testing.

## Enable real directions without billing

1. Visit the [HeiGIT account portal](https://account.heigit.org/) and create a **free** account. Do not enable a paid plan or add payment details.
2. Obtain an API key with access to **Pelias search** and **Openrouteservice directions**. Check the current free-plan quotas and service availability in your account. If the available plan asks for billing, stop rather than enabling it.
3. Put the key in the private `.env` file as `HEIGIT_API_KEY=...` and set `GO_DEMO=0`. Restart the server. Never paste the key into source, GitHub, a URL or a public chat.
4. Verify a Romsey walk and drive, then searches elsewhere in the UK, including Northern Ireland. Search data is OpenStreetMap/Pelias data, not Google Maps; individual businesses and postcodes may differ in coverage.

The app calls `api.heigit.org`, not the deprecated `api.openrouteservice.org` hostname. API errors stay visible and never silently switch to demo results. Free services have quotas; exhausting them means directions are temporarily unavailable. No billing account is created by this project.

## Deploy with Netlify

The repository includes the Netlify configuration. Deploy from the repository root.

1. In Netlify, choose **Add new project → Import an existing project → GitHub**, then select **JBristow1729/Go** and branch **main**.
2. Choose the **Free** plan. It has a hard usage limit; the site pauses if the allowance is exhausted. Do not enable a paid plan or purchase extra credits.
3. `netlify.toml` specifies Node 24, `public` as the publish directory, and `netlify/functions` as the functions directory. No frontend build command is needed. Leave the base directory and build command blank.
4. Under **Project configuration → Environment variables**, add `HEIGIT_API_KEY` using the key from your local `.env`. Include the **Functions** scope if scope controls are shown. Redeploy after changing variables. Set `GO_DEMO=0` for live use; use `GO_DEMO=1` only for a visibly labelled preview. Blobs uses Netlify's runtime context; no additional secret token belongs in the repository.
5. Deploy and exercise the whole flow. Check that `/go.css` and `/icons/straight.png` serve assets and `/` serves Start Journey. Check the hourly cleanup function in Netlify.
6. Add `go.wholegrainstudios.co.uk` to the site and at your DNS provider create a **CNAME** record named **go** pointing to the assigned **your-project.netlify.app** hostname (no https:// or path). Follow Netlify's displayed DNS instructions if different. Wait for HTTPS before live use.
7. Run the [actual-phone checks](docs/device-check.md). Desktop viewport checks are not a guarantee about Opera Mini's browser bars, fonts or Mobile view settings.

## Tests and editable assets

```sh
node --test tests/*.test.mjs
npx --yes pnpm@11.19.0 exec playwright install chromium
node --test tests/browser/*.test.mjs
node scripts/build-icons.mjs
```

Browser tests explicitly disable JavaScript. They require an environment able to launch Chromium. The initial Codex environment blocks standalone Chromium at the operating-system sandbox; rendered checks were instead performed with the supported in-app browser. See [verification evidence](docs/verification.md) for exactly what passed and what is pending, and [development notes](docs/development-notes.md) for the remaining minor storage issue.

The server sets `script-src 'none'`, uses POST forms for searches, and stores route data server-side. Icons are editable SVG sources with committed PNG outputs. `sharp` is needed only to regenerate them; it is not needed at runtime. `playwright` and `prettier` are development dependencies.

## Data and limitations

- Two-hour idle session expiry. The secure production cookie refreshes while you use Go. Hourly cleanup normally removes expired records within the following hour; expired journeys are refused immediately even if cleanup is delayed.
- Netlify Blobs stores search terms, selected places and route instructions. HeiGIT receives search text and route coordinates. The app has no analytics and does not log these contents; hosting and provider infrastructure have their own operational logs.
- The local adapter is for one Node process. Production uses strongly consistent Blob reads, conditional per-session leases and ETag-fenced session writes/deletion. A request interrupted mid-flight can be retried after the 30-second lease expires. Completed form retries reuse saved state; exactly-once upstream calls across process crashes are not guaranteed.
- Ten API-triggering requests per minute per session, plus the provider's account quota. This is not bot-proof abuse protection: a new cookie can create a new session. The site is intended for small personal use; keep provider quotas enabled.
- Routes are calculated once. No live traffic refresh, countdown, automatic rerouting, background tracking, transit or offline mode.
- Long action/road text is abbreviated on compact cards. Click the underlined road line to read the full original instruction. Roundabout exit numbers and short manoeuvre labels remain visible.
- The native phone text-entry editor and browser settings may use their own scrolling independently of the site.

Map data: [© OpenStreetMap contributors](https://www.openstreetmap.org/copyright). Routing/search: [HeiGIT](https://heigit.org/) / [Openrouteservice](https://openrouteservice.org/). Retain required provider attribution when distributing the site.
