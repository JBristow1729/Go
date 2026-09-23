# Go Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended by the skill) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking. For this project, native execution is recommended because the modules share a small set of interfaces.

**Goal:** Build Go, a UK walking/driving directions website usable without JavaScript or normal-page scrolling on a Nokia 3210 running Opera Mini.

**Architecture:** Server-rendered HTML uses a shared Fetch Request/Response handler in a local Node server and Netlify Functions. HeiGIT supplies search and routes; short-lived journey state lives in local storage or Netlify Blobs. No frontend framework is needed.

**Tech Stack:** Node.js 24 LTS, ECMAScript modules, built-in fetch and node:test, Netlify Functions, @netlify/blobs, Playwright for browser verification. Simple authored SVG icon sources are converted to committed PNGs with sharp during development; phone pages use PNGs.

**Spec:** [Approved Go design](go-design.md), approved in conversation on 23 September 2026.

## Global Constraints

- Support walking and driving across the UK.
- Use non-Google data and a free API account without a payment card or billing setup.
- Public transport is deferred.
- Core functionality must work with JavaScript disabled.
- No scrolling is required in normal screens.
- The sole agreed exception is deliberate expansion of truncated text; that instruction may scroll until collapsed or left.
- Times are fixed estimates for a segment, not countdowns or GPS-based guidance.
- Records expire after two hours of inactivity; enforce expiry on reads and clean up expired records.
- Do not put addresses, complete routes, or credentials in URLs.
- Do not log search text or route contents.
- No deployment or billing account is created during local development.
- Physical-device testing is required before claiming that Opera Mini never scrolls; desktop dimensions alone cannot prove this.

## Review Focus

1. A provider step describes the action at the start of its own segment: Go must display the preceding segment's time before that action. Task 2 pins this with unequal segment durations.
2. Browser Back, repeated POSTs and stale result selections must not silently pick a different place or trigger repeated route calls. Task 3 tests selection revisions and completed submissions.
3. Names with unusually wide characters, punctuation, markup and long unbroken words must remain readable and expandable without breaking compact height. Tasks 4 and 6 test this.
4. UK-wide support must include Northern Ireland, while a Romsey bias must not become a hard local boundary. Tasks 1 and 6 exercise Belfast and explicit distant towns.
5. Opera Mini users may share proxy IPs and may retain cached pages after a session expires. Tasks 3 and 5 check session-based limits, expiry, cache headers and recovery.

## Workspace and file map

Create the deliverable under `outputs/go/` after plan approval. Paths below are relative to that root. Intermediate screenshots, browser profiles and scratch tools belong in `work/`. Keep the approved design and this plan alongside the deliverable and copy both into `docs/` for eventual repository delivery.

- `package.json`, `package-lock.json`, `.gitignore`, `.env.example`: runtime/scripts, pinned installation and secret exclusions.
- `src/provider.mjs`: HeiGIT requests, validation and typed errors.
- `src/instructions.mjs`: provider steps to presentation-independent cards.
- `src/storage.mjs`, `src/netlify-storage.mjs`: local/memory and Blob storage adapters.
- `src/sessions.mjs`: cookie parsing, expiry, limits and session lifecycle.
- `src/app.mjs`: HTTP routes, wizard transitions and dependency injection.
- `src/render.mjs`: escaped semantic HTML and compact/expanded views.
- `src/server.mjs`: local HTTP and static-file adapter.
- `public/go.css`, `public/icons/*.png`: small device assets.
- `assets/icons/*.svg`, `scripts/build-icons.mjs`: editable icon sources and deterministic conversion.
- `netlify/functions/go.mjs`, `netlify/functions/cleanup.mjs`, `netlify.toml`: deployment adapters and expiry cleanup.
- `tests/provider.test.mjs`, `tests/instructions.test.mjs`, `tests/sessions.test.mjs`, `tests/app.test.mjs`, `tests/render.test.mjs`, `tests/deployment.test.mjs`: behavioural tests.
- `tests/fixtures/*.json`, `src/demo-provider.mjs`: explicit, deterministic offline demo data.
- `tests/browser/journey.test.mjs`: no-JavaScript journey and viewport checks.
- `README.md`, `docs/device-check.md`, `docs/verification.md`: local use, deployment and evidence.

Git is available at `/Users/jakebristow/.cache/codex-runtimes/codex-primary-runtime/dependencies/bin/fallback/git`; Node is available at `/Users/jakebristow/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/bin/node`. Add their containing directories to a task-specific shell PATH when executing. Browser automation and sharp are bundled too. Use normal portable package scripts in the delivered project. The user's GitHub deferral takes precedence over the skill's commit-per-task convention: record completed checkboxes and verification evidence locally; no push, repository inspection or admin installation is required now.

## Shared interfaces

```js
// Place: { id: string, name: string, locality: string,
//          label: string, coordinates: [longitude, latitude] }
// Mode: 'walk' | 'drive'
// Provider: search(text) => Promise<Place[]>;
//           route(fromPlace, toPlace, mode) => Promise<ORS JSON response>
// Card: { time: string, icon: string, action: string, road: string,
//         fullText: string, kind: 'departure' | 'turn' | 'arrival' }
// Store: get(id), set(id, record), delete(id), entries()
//        all asynchronous; entries is an async iterable of [id, record].
// Session: { id, csrf, expiresAt, revision, fromQuery, toQuery,
//            candidates: { from: [], to: [] }, from, to, mode,
//            cards: [], completedSubmissions: {}, apiTimes: [] }
// createApp({ provider, store, now, secureCookies, demo })
//   => async function handle(request: Request): Promise<Response>
```

Use `now = () => Date.now()` by default and inject a fake clock in tests. Cookie name `go_session`; identifier is 32 random bytes encoded as hex, never derived from addresses. Expose no session identifiers in links. Card indices and `expanded=1` are acceptable URL parameters.

## Task 1: Validated UK search and route provider

**Files:** package/config files, `src/provider.mjs`, `tests/provider.test.mjs`, `tests/fixtures/search.json`, `tests/fixtures/route.json`.

**Interfaces:** export `createProvider({ apiKey, fetchImpl = fetch })`, returning `search(text)` and `route(from, to, mode)`. Export `ProviderError` with `code` in `configuration | input | unavailable | quota | no-route | invalid-data`. Consumers display safe copy rather than raw provider bodies.

- [ ] Add the package as private ESM with `engines.node: >=24`, `test: node --test tests/*.test.mjs`, `start: node --env-file-if-exists=.env src/server.mjs`. Keep browser tests separately invocable so basic tests do not require a browser. Ignore `.env`, `.data`, `node_modules`, logs and browser artifacts.
- [ ] Write failing tests using an injected fetch recorder. This core assertion fixes country restriction and soft bias without a local radius:

```js
const calls = [];
const provider = createProvider({ apiKey: 'test-key', fetchImpl: async (url, init) => {
  calls.push({ url: new URL(url), init });
  return Response.json({ features: [{ properties: {
    id: 'belfast', name: 'City Hall', locality: 'Belfast',
    label: 'City Hall, Belfast', country_a: 'GBR'
  }, geometry: { coordinates: [-5.93, 54.60] } }] });
}});
const results = await provider.search('City Hall Belfast');
assert.equal(calls[0].url.searchParams.get('boundary.country'), 'GBR');
assert.equal(calls[0].url.searchParams.get('size'), '3');
assert.ok(calls[0].url.searchParams.has('focus.point.lat'));
assert.equal(calls[0].url.searchParams.has('boundary.circle.radius'), false);
assert.equal(results[0].locality, 'Belfast');
```

- [ ] Run `node --test tests/provider.test.mjs`; establish failure at the missing provider module/behaviour.
- [ ] Implement a 160-character trimmed query limit, Unicode-preserving text handling, an 8-second fetch timeout and server-only key authentication. Use `https://api.heigit.org/pelias/v1/search`, `boundary.country=GBR`, `size=3`, Romsey focus approximately latitude 50.989, longitude -1.499. Preserve provider ranking, remove duplicates, reject malformed/out-of-country entries and return at most three valid places. Do not add a hard Romsey boundary.
- [ ] Implement route POSTs at `https://api.heigit.org/openrouteservice/v2/directions/foot-walking` or `driving-car` with confirmed coordinates, English instructions and no alternatives. Validate finite coordinate pairs and modes before making a request. Reject missing/invalid duration or instruction structures rather than synthesising live directions.
- [ ] Add tests for 0/1/3+ results, a duplicate, malformed coordinates, blank/oversized query, encoded punctuation, bad mode, missing key, timeout, 401/403, 429, provider no-route response and malformed JSON. Assert no credentials are included in thrown error messages or public output.
- [ ] Run provider tests; record passing result. Pin any installed dependencies in the lockfile; no live key is needed for this task.

## Task 2: Correctly timed instruction cards

**Files:** `src/instructions.mjs`, `tests/instructions.test.mjs`, route fixtures.

**Interfaces:** export `normaliseRoute(raw): Card[]` and `formatTime(seconds): string`. Consume the validated ORS response and produce cards independent of HTML.

- [ ] Write the primary failing timing test with intentionally unequal segment durations:

```js
const raw = { routes: [{ segments: [{ steps: [
  { type: 11, instruction: 'Head north', name: 'First Road', duration: 300 },
  { type: 1, instruction: 'Turn right', name: 'Second Road', duration: 120 },
  { type: 10, instruction: 'Arrive', name: '-', duration: 0 }
] }] }] };
const cards = normaliseRoute(raw);
assert.deepEqual(cards.map(c => c.time), ['Now', 'In 5 minutes', 'In 2 minutes']);
assert.equal(cards[1].road, 'Second Road');
assert.equal(cards.filter(c => c.kind === 'arrival').length, 1);
assert.equal(formatTime(30), 'In <1 minute');
assert.equal(formatTime(60), 'In 1 minute');
```

- [ ] Run `node --test tests/instructions.test.mjs`; observe the intended failure.
- [ ] Implement the departure card, then pair every later action with the prior travelled segment's duration. Keep finish-step handling explicit. Use the current documented ORS instruction-type mapping, including sharp/slight turns, roundabouts, keep-left/right and U-turns; retain required distinctions in text even when sharing an icon.
- [ ] Implement `formatTime`: zero → Now, 0–60 exclusive → In <1 minute, otherwise nearest minute with singular/plural. Reject negative or non-finite values.
- [ ] Add tests for an immediate turn, 89/90-second rounding, final segment, no duplicate arrival, unnamed road, sharp turn, third roundabout exit, U-turn, unknown manoeuvre, missing step duration and empty route. Unknown types retain the original instruction with a neutral icon; do not invent an exit number.
- [ ] Run provider and instruction tests together and record results.

## Task 3: Journey state, wizard transitions and recovery

**Files:** `src/storage.mjs`, `src/sessions.mjs`, `src/app.mjs`, `tests/sessions.test.mjs`, `tests/app.test.mjs`.

**Interfaces:** export `createMemoryStore()` and `createFileStore(directory)` implementing the shared Store interface; `createApp(...)` implements the shared handler. Renderer dependency starts as a minimal injected test renderer until Task 4 supplies real HTML. Export `createSessions({ store, now })` with asynchronous `create()`, `load(id)`, `save(session)` and `cleanup()` methods. `load` enforces expiry and refreshes active records; cleanup deletes expired records and is also used by the scheduled adapter.

- [ ] Write a failing expiry test using a fake clock and memory store:

```js
let instant = 0;
const store = createMemoryStore();
const sessions = createSessions({ store, now: () => instant });
const first = await sessions.create();
instant = 7_200_001;
assert.equal(await sessions.load(first.id), null);
assert.equal(await store.get(first.id), null);
```

- [ ] Add HTTP tests that maintain cookies and submit form data through Request objects. Check the route sequence below, then run session/app tests and confirm intended failures.

| Method/path | Behaviour |
| --- | --- |
| GET `/` | Start Journey |
| POST `/start` | New session; redirect to `/from` |
| GET `/from`, `/to` | Input form, retained query, Back |
| POST `/search/from`, `/search/to` | Validate form/session, search, save candidates and revision, redirect to results |
| GET `/results/from`, `/results/to` | Up to three choices |
| POST `/select/from`, `/select/to` | Accept only an index in stored candidates at the submitted revision |
| GET `/how` | Require both places; show Walk and Drive |
| POST `/mode` | Validate mode; calculate/store route once; redirect to Ready |
| GET `/ready` | Begin link only when route exists |
| GET `/journey?step=0` | Render stored card; validate integer and bounds |
| GET `/journey?step=0&expanded=1` | Same card with full text |
| GET `/about` | Compact attribution/privacy index; linked short pages if needed |

- [ ] Implement random cookie/session creation, two-hour sliding expiry and HTTP-only SameSite=Lax cookies (Secure on HTTPS). Session reads must reject expired records. Store local files atomically using temporary file plus rename; accept only hex session IDs as filenames. Keep test storage in memory.
- [ ] Implement transitions with POST/Redirect/GET. Store submitted queries before requesting the provider so errors retain edits. Changing an origin or destination invalidates downstream route state. Use form CSRF tokens and candidate revisions. Reject stale candidate selection with a compact recoverable message instead of choosing a new item by reused index.
- [ ] Limit body size to 8 KiB; reject unsupported methods/content types and oversized input. Add per-session API throttling (10 requests/minute) and suppress duplicate completed form submissions. Coalesce in-flight identical route requests within the same process; use storage-backed submission state for cross-instance retries, with a bounded recovery timeout rather than a permanent busy state. Do not promise exactly-once provider calls across crashes.
- [ ] Add regression tests: empty query, no matches, no route, provider failure, expiry during a POST, stale result revision, modified selection index, missing CSRF, two different sessions from one proxy IP, sequential duplicate mode POSTs, route changes after editing origin, and Prev/Next/expand with a provider route-call counter fixed at one.
- [ ] Check `Cache-Control: private, no-store` on journey responses and redirects, no sensitive URL data, no raw provider error leakage, and safe navigation when cookies are unavailable. Run Tasks 1–3 tests and record results.

## Task 4: Compact dark phone interface

**Files:** `src/render.mjs`, `public/go.css`, `assets/icons/*.svg`, `public/icons/*.png`, `scripts/build-icons.mjs`, `tests/render.test.mjs`.

**Interfaces:** `renderPage(view, model): string`, producing a full escaped HTML document. `view` covers the route table and error states. Model contains only server-validated state, form tokens and optional compact error copy. Export `escapeHtml(text)` and `compactText(text, limit)` for direct behavioural tests.

- [ ] Write rendering tests proving provider markup cannot become active HTML, disclosure preserves full text, route-critical roundabout text remains visible, and mode controls are real submit buttons:

```js
assert.equal(escapeHtml('<img onerror="x">'), '&lt;img onerror=&quot;x&quot;&gt;');
assert.equal(compactText('Albany Wissey Biddlibong Way', 12), 'Albany Wiss…');
const html = renderPage('journey', {
  card: { time: 'In 5 minutes', icon: 'roundabout', action: 'Take 3rd exit',
    road: 'Albany Wissey Biddlibong Way', fullText: 'Take 3rd exit onto Albany Wissey Biddlibong Way', kind: 'turn' },
  step: 1, total: 4, expanded: false, demo: false
});
assert.match(html, /Take 3rd exit/);
assert.match(html, /expanded=1/);
assert.doesNotMatch(html, /<script/);
```

- [ ] Run renderer tests and confirm failure before implementation.
- [ ] Implement the full wizard using standard inputs, forms, buttons and anchors. Use dark backgrounds (#111111 / #242424), light text (#f2f2f2), system sans-serif fonts, visible borders and focus states. Use approximately 14px body text, 18px headings, compact padding, and 40–48px manoeuvre icons. Design to a maximum normal content budget around 200px; do not hide overflow to pass tests.
- [ ] Render directions as timing, icon/action, truncated road disclosure, then Prev/Next. Keep the departure, normal turn and arrival layouts distinct. Disabling navigation means omitting the link, not a nonfunctional clickable control. Arrival offers Start again.
- [ ] Implement explicit full-text views and Show less. All navigation out of an expanded card returns to compact mode. Selection rows provide an unambiguous separate details link if truncation would hide distinguishing locality text; full details permit explicit selection and return to the three-result list.
- [ ] Author consistent monochrome SVG icons (straight, left/right, slight left/right, roundabout, U-turn, departure, arrival, neutral, walk and car). Convert to PNG via sharp; commit both source and generated files in eventual source delivery. Use meaningful alt text and text mode labels. No image-generation service or downloaded icon-font dependency is needed.
- [ ] Account for required OpenStreetMap/HeiGIT attribution in the screen height. Keep the landing screen's sole central control Start Journey. Present concise privacy/attribution information on small linked pages rather than introducing an unapproved long scrolling information page.
- [ ] Add long-action, long-result, Unicode, apostrophe, ampersand, missing-road, images-disabled and compact-error renderer cases. Run renderer and existing tests.

## Task 5: Local demo and Netlify delivery adapters

**Files:** `src/server.mjs`, `src/demo-provider.mjs`, `src/netlify-storage.mjs`, `netlify/functions/go.mjs`, `netlify/functions/cleanup.mjs`, `netlify.toml`, `.env.example`, `tests/deployment.test.mjs`, `README.md`.

**Interfaces:** local server and Netlify wrapper construct the same `createApp(...)`; Blob adapter implements Store. Cleanup calls store iteration and deletes only records whose `expiresAt` is past the injected clock. Demo provider implements the same provider methods and is selected only with `GO_DEMO=1`.

- [ ] Write adapter contract tests for store get/set/delete/list, expiry cleanup and local HTTP static serving. Verify `GET /go.css` is served as CSS, missing assets return 404, path traversal cannot escape public/, and cookie HTTPS settings differ correctly between local HTTP and production HTTPS.
- [ ] Run adapter tests and observe failure.
- [ ] Build the local HTTP adapter with bounded bodies, Request/Response conversion, MIME types and a public-directory allowlist. Development defaults to live provider mode; absent key produces an explicit setup error. Explicit `GO_DEMO=1` enables a visible Demo label on every page and known fictional fixture routes only. Never fall back to demo automatically on a live API error.
- [ ] Install and lock @netlify/blobs; read its current primary documentation for getStore, strong consistency, pagination and conditional writes. Implement storage with strong reads and a site-wide store named `go-sessions`; use metadata for expiry so cleanup can avoid fetching route payloads. Write adapter tests with an injected Blob client so no account is needed locally. Use conditional writes for submission ownership where supported; verify contested claims fail safely.
- [ ] Connect the Fetch-style function and static public files with Netlify configuration. Use the platform's environment-provided Blobs credentials, not a token committed to the repository. Add an hourly scheduled cleanup function. Reject sessions immediately after expiry even if physical cleanup waits until the next run. Document this retention window.
- [ ] Add `.env.example` containing `HEIGIT_API_KEY=`, `GO_DEMO=0`, and `PORT=3000`; never put an actual key in a deliverable. Document free-account setup, required search/routing access, demo operation, API quotas, and Netlify free-plan checks. Do not require the user to paste a key into chat.
- [ ] Include source-only deployment steps: import the eventual repository, use public/ as publish directory, configure the function directory, set private environment variables, then configure go.wholegrainstudios.co.uk. Do not deploy, create accounts, connect DNS, push GitHub or enable paid usage.
- [ ] Run adapter and full unit tests. Smoke-test the local demo server over HTTP. Record that Netlify runtime integration remains unverified until a real deployment is available; mocked SDK tests do not prove hosted compatibility.

## Task 6: Complete journey and viewport verification

**Files:** `tests/browser/journey.test.mjs`, `docs/device-check.md`, `docs/verification.md`, final README and lockfile.

**Interfaces:** browser tests use the local server with `GO_DEMO=1`, a fresh temporary data directory, and an explicit fixture provider. No user API quota is consumed.

- [ ] Write a complete no-JavaScript browser scenario from Start Journey to arrival with assertions at every screen. For each viewport, assert document dimensions rather than checking CSS declarations:

```js
const context = await browser.newContext({
  javaScriptEnabled: false, viewport: { width: 240, height: 200 }
});
const page = await context.newPage();
await page.goto(baseURL);
await page.getByRole('button', { name: 'Start Journey' }).click();
await page.getByLabel('From:').fill('Romsey');
await page.getByRole('button', { name: 'Next', exact: true }).click();
const size = await page.evaluate(() => ({
  width: document.documentElement.scrollWidth,
  height: document.documentElement.scrollHeight,
  availableWidth: document.documentElement.clientWidth,
  availableHeight: document.documentElement.clientHeight
}));
assert.ok(size.width <= size.availableWidth);
assert.ok(size.height <= size.availableHeight);
```

- [ ] Extend the scenario to choose origin/destination, select Walk, begin, step forward/back, expand a deliberately long name, collapse, and reach arrival. Browser automation evaluation is measurement only; production pages contain no client JavaScript.
- [ ] Run at 240×200, 240×240 and 240×320. Include three long matches, wide capital-letter strings, unbroken names, every icon/action type, all compact error pages, 0/1/3 matches, unavailable cookies, stale form submission, session expiry, and images disabled. Check that expansion is the only intended overflow state. For browser-native text editing, document the platform limitation rather than hiding controls.
- [ ] Use keyboard Tab/Enter to traverse the complete flow. Check focus styling and readable contrast. Inspect screenshots of the search list, longest compact instruction, expanded instruction, mode choice and arrival. Fix any clipped or overlapping text and rerun only affected checks plus the complete journey.
- [ ] Add offline provider fixtures demonstrating searches elsewhere in the UK, including Belfast. These demonstrate application behaviour, not live data coverage. Document a separate live checklist: Romsey walk, Romsey drive, London destination, Belfast destination, empty search and provider quota handling.
- [ ] Request a locally configured free API key only when live checks are otherwise ready. If unavailable, finish all independent implementation and report live routing as unverified; do not present fabricated results as real. Verify actual service entitlements without enabling billing.
- [ ] Write an actual-device checklist: Opera Mini version/settings, visible browser bars, normal and large text settings, keypad focus, text entry, every normal page without scrolling, and explicit expansion/collapse. Treat owner handset testing as outstanding until evidence arrives.
- [ ] Run the complete unit and browser suites once after the final changes, inspect all failures and record actual commands/results in `docs/verification.md`. Deliver source and a local preview, with clear labels for demo/live and tests performed versus pending. Preserve all no-billing and GitHub-deferral requirements.

## Execution and acceptance

Recommended method: native execution in this task, followed by the review required by the execution skill. This avoids giving a succession of implementers the same tightly coupled session/rendering interfaces. Subagent-driven execution is also available if the owner prefers separate review for each task.

Local acceptance means the deterministic wizard, instructions, failure handling and viewport checks pass and source is prepared for Netlify. Live API acceptance requires the owner's free key. Nokia compatibility acceptance requires the actual phone. Netlify hosting acceptance requires the owner's later deployment. Report these separately; do not conflate a demo with a complete live service.

## Plan self-review

- Spec coverage: provider/search Task 1; timing/icons Task 2 and 4; state/privacy/recovery Task 3; layout/expansion Task 4; deployment/account docs Task 5; device/live evidence Task 6.
- Interfaces: shared Place, Card, Provider, Store and createApp contracts are consistent across all tasks.
- Review focus: all five classes above have explicit tests in their owning tasks.
- Git deferral: no task requires GitHub access or administrator rights.
- Approval: this plan is ready for owner review and execution-method selection; product code has not been created.
