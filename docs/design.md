# Go — version 1 design

Review draft · 23 September 2026

## Purpose and agreed scope

Go is a dark, minimal directions website for the Nokia 3210 4G's 2.4-inch screen and Opera Mini. Intended address: go.wholegrainstudios.co.uk. Development takes place locally for now, with eventual source delivery to JBristow1729/Go and deployment by the owner through Netlify.

Support walking and driving across the UK. Use non-Google data and a free API account without a payment card or billing setup. Public transport is deferred. Search should favour Romsey, Hampshire for ambiguous queries without preventing searches elsewhere in the UK.

The user advances directions manually. Times are fixed estimates for a segment, not countdowns or GPS-based guidance. No scrolling is required in normal screens. The sole agreed exception is deliberate expansion of truncated text; that instruction may scroll until collapsed or left.

## Architecture

Use server-rendered HTML with standard links and form submissions. Core functionality must work with JavaScript disabled. Netlify Functions perform place searches, request routes, normalise instructions, and render pages. A local Node server runs the same application for development. No frontend framework, map tiles, client-side routing, external fonts, or browser geolocation is required.

Use HeiGIT's hosted Pelias search and Openrouteservice walking/driving directions. Current documented endpoints use api.heigit.org/pelias/v1/search and api.heigit.org/openrouteservice/v2/directions/{profile}. Profiles are foot-walking and driving-car. API access and actual free-account entitlements must be checked with the owner's account before calling the integration live-ready. Never silently switch to a paid plan or another provider.

Keep API keys in environment variables. Use short-lived server-side journey records accessed through an unpredictable session cookie. Provide a local storage adapter for development and a Netlify Blobs adapter for deployment. Verify the selected Netlify free plan supports the required functions/storage before deployment. Records expire after two hours of inactivity; enforce expiry on reads and clean up expired records. Do not put addresses, complete routes, or credentials in URLs. Do not log search text or route contents.

Separate provider access, instruction normalisation, session storage, HTML rendering, and HTTP handling into small modules. Keep provider-specific response formats out of templates. Store the calculated route once; Prev, Next, expansion and collapse must not trigger another paid/quota-counted routing request. Submit controls and redirects must tolerate retries and browser Back.

## Screens

1. Start: one large Start Journey button.
2. From: label, text input, Next, and a small Back link.
3. Origin results: up to three selectable matches, each with a compact name and locality, plus Back to edit. Do not manufacture a third result if fewer exist.
4. To: label, text input, Next, Back.
5. Destination results: same presentation as origin results.
6. How?: Walk and Drive buttons with simple monochrome image icons and text labels; Back.
7. Ready!: Begin button and Back. Calculate the route when travel mode is submitted so this screen only appears after a valid route is available.
8. Directions: fixed time estimate, large manoeuvre icon, short action/road name, Prev and Next. First screen includes the initial heading; final screen says Arrived and offers Start again.

Search runs only on Next, never per keystroke. Restrict results to the UK using the provider's supported country filter. Apply a soft Romsey relevance bias rather than a geographic exclusion. Explicit towns/postcodes remain meaningful. Origin and destination must each be confirmed by selection.

## Instructions and timing

Provide icons for straight, left, slight left, right, slight right, roundabout, U-turn, departure, and arrival. Preserve sharp-turn and roundabout-exit meanings in the action text; do not force every manoeuvre into five arrows. Use PNG assets for dependable rendering and text alternatives for disabled images.

Avoid an off-by-one timing error: the time before a turn comes from the segment travelled BEFORE that turn, not from the segment entered after it. The departure card tells the user how to begin. Subsequent cards pair the preceding segment's duration with the upcoming manoeuvre and destination road. Arrival uses the duration of the final approach. Handle the provider's finish step without duplicate arrival cards.

Display positive durations below a minute as In <1 minute; round longer durations to the nearest whole minute, with correct singular/plural. Use Now for an immediate action. These are estimates and do not update while the user travels. Keep route-critical qualifiers, such as exit numbers, visible in compact mode.

If a road is unnamed, use a meaningful provider instruction or Road name unavailable instead of an empty name. Unknown manoeuvres use a neutral icon and the actual action text. Never fabricate a direction or timing when provider data is invalid.

## Layout and input

Use muted black and dark grey backgrounds, light text, and a clearly visible focus state. Target a 240-pixel-wide portrait display, allowing for browser controls. Begin with a compact content budget of approximately 200 CSS pixels high; test at 240×200, 240×240 and 240×320 and tune against the actual handset. Physical-device testing is required before claiming that Opera Mini never scrolls; desktop dimensions alone cannot prove this.

Use simple block/table-compatible layout rather than relying on modern grid, sticky positioning or viewport-height behaviour. Keep text readable (approximately 14–16px body text), controls keypad-focusable and focus order consistent with visual order. Icons use actual image assets rather than emoji or an icon font. Browser-native text entry is outside the website's control.

Constrain compact text lengths on the server as well as visually, so the layout does not depend on JavaScript or sophisticated CSS. Truncate long road names with an ellipsis, e.g. On to Albany W…. Selecting the shortened name loads an expanded version of that same instruction, with full text, Show less, and Prev/Next beneath it. Expansion may scroll. Navigation to another instruction returns to compact mode. Use the same explicit disclosure behaviour for unusually long result labels or action text when necessary to retain meaningful information.

Keep result names and locality distinguishable within three short rows. Required provider/data attribution must be readable on relevant screens and accounted for in the height budget. Include an About/privacy route accessible outside the central journey controls; attribution links can lead there. No overlays or cookie-consent banners are needed for this functional session-only design.

## Failure cases

Empty input: retain the input screen with a short prompt. No matches: No places found, with Edit search. No route: No route found for this mode, with Change mode and Edit journey. Provider outage or quota exhaustion: a compact explanation with Retry and Back. Missing API key: a clear setup message in development, never fabricated live results. Expired session: Journey expired and Start again. Unknown step/session parameters return a safe error or valid recovery screen.

Preserve entered locations when correcting a search or retrying a provider request. Bound input size and provider timeouts, escape all provider/user text, validate selected coordinates and mode server-side, and throttle API-triggering requests. Do not treat Opera Mini proxy IP addresses as unique users. Do not offer automatic rerouting, background tracking, offline operation, saved places, or user accounts in version 1.

## Verification and delivery

Test real behavioural risks: UK search filtering, selection validation, timing alignment, short-duration rounding, roundabouts and U-turns, unknown/unnamed roads, HTML escaping, provider failures, expired sessions, and instruction navigation without repeated route calls.

Run the complete wizard with JavaScript disabled and deterministic provider fixtures. Check keyboard navigation, focus visibility, contrast, compact screen overflow, three long search results, unusually long road names, expanded/collapsed text, and all error screens. Fixture mode must be explicitly marked as demo data and must never masquerade as a live route.

Live verification needs the free API key: test a short Romsey walk, a Romsey drive, and searches/routes elsewhere in the UK including Northern Ireland. The owner then checks the site on their actual Nokia/Opera Mini; adjust content height and wrapping before calling the no-scroll requirement verified.

Deliver source, tests, Netlify configuration, an environment-variable example without secrets, and concise local-run/API-account/deployment instructions. GitHub connection and custom-domain setup follow later as requested. No deployment or billing account is created during local development.

## Reference documentation

- Opera Mini rendering: https://help.opera.com/en/opera-mini-and-javascript/
- Current HeiGIT API endpoints: https://openrouteservice.org/dev/
- API hostname migration: https://ask.openrouteservice.org/t/deprecating-api-openrouteservice-org-in-favour-of-api-heigit-org/7912
- Directions reference: https://giscience.github.io/openrouteservice/api-reference/endpoints/directions/
- Account and plans: https://account.heigit.org/info/plans

## Review status

The overall flow, walking/driving scope, UK/Romsey search intent, static timing, additional manoeuvre icons, and explicit expansion exception were approved in conversation. This written draft makes the remaining layout, storage, error-handling and verification choices concrete for review. It is not yet an implementation or a claim of device compatibility. Git commit is deferred under the owner's instruction to deal with GitHub/tooling later.
