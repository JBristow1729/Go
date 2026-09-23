# Verification record

## Automated checks

The complete Node unit/integration suite passes **42 tests**. It covers UK search filtering, input/coordinate validation, upstream errors, profile selection, manoeuvres and timing, HTML escaping, full-text disclosure, journey transitions, stale selections, request retries, session expiry, cookie renewal, CSRF, session throttling, local HTTP/assets and Netlify Blob ownership.

Each implementation or regression group was exercised failing first, then passing. The final review added four regressions: conditional Blob HTTP failures cannot grant ownership; an expired owner cannot overwrite or delete a newer session; arrival details retain the destination side; roundabout exit numbers remain concise even if supplied only in the instruction text. The Blob failure regression uses the installed SDK with injected HTTP responses, not only an idealized storage mock.

The frozen pnpm dependency installation also succeeds. Actual deployment is still pending.

## Live API verification

The owner's private key was configured locally and used successfully. It is excluded from source packaging and Git.

- Romsey Railway Station and Romsey War Memorial Park were identified by name and locality.
- Walking between those confirmed matches returned 18 instruction cards.
- Driving between those matches returned 6 instruction cards.
- Every live walking and driving card was traversed in the browser and measured at 240×200 with no compact-page overflow.
- The live arrival instruction included “on the left”; the expanded arrival page preserved it.
- Belfast City Hall and 10 Downing Street, London returned matching places, providing a UK-wide search check outside Romsey.

Search coverage is imperfect. “Romsey Abbey” and some Waterloo Station query variations did not return the intended landmark. The app displays the returned names for explicit user selection and never selects a place automatically. Try the street/address/postcode when a landmark is missing. These findings should not be described as universal POI coverage or independent confirmation of real-world route correctness.

## Rendered and input checks

The supported Codex browser completed both demo and live flows. Seventeen stress pages were measured at each of 240×200, 240×240 and 240×320, including extreme wide-letter names, errors, all icon types and the short information pages. No compact page overflow remained after fixes.

The deliberately expanded long instruction measured 308px high; Show less returned it to the compact page. Keyboard Tab/Enter submission, a visible focus outline, and selecting a place through its full details were exercised. Screenshots of the results, roundabout instruction and arrival were visually inspected.

The production application contains zero script tags and sends `script-src 'none'`. The included standalone Playwright suite explicitly disables JavaScript, but macOS sandboxing prevented its Chromium process from launching before any page loaded. That runner is **environment-blocked, not passing** here. Browser measurements were instead made through Codex's supported in-app browser.

## Independent review

A fresh reviewer inspected the implementation. Four Important findings were reproduced and fixed with failing-to-passing regressions; the complete suite passed afterwards. No Critical findings were reported. The reviewer did not certify the phone, live provider, hosted infrastructure or legal sufficiency of publication copy. Live checks were subsequently performed by the implementer as described above.

One minor remains deferred: a request carrying a missing session ID can leave a small orphan lock record in Netlify Blobs. It contains no route/search data, but repeated missing sessions can accumulate storage entries. Session records themselves have enforced expiry and scheduled cleanup.

## Still required

- Actual Nokia 3210 / Opera Mini verification, including browser bars, preferred text size and keypad behavior.
- A Netlify deployment to verify Functions, Blobs and scheduled cleanup on hosted infrastructure, and confirm current free-plan entitlements.

GitHub, deployment, DNS and billing configuration have not been changed.

Road-name clarification: named turns display the road entered, even if it has the same name as the previous road. Missing names now display “Road name unavailable”, replacing the misleading “On this road”. Regression tests pass and the updated card fits 240×200.

## 240 × 320 handset layout update

Checked 17 rendered screen cases at each usable viewport size of 240 × 200,
240 × 240, 240 × 280 and 240 × 320 using the supported in-app browser:
68 checks, no horizontal or vertical overflow. Cases cover long results and
instructions, input/routing errors, information pages and all direction icons.
Direction icons measure 40px, 56px and 72px as usable height increases.
The 200px baseline remains the fallback if height media queries are unsupported.
These checks do not emulate Opera Mini's proxy rendering or native text editor;
physical-phone confirmation remains necessary.

## Temporary forced QVGA experiment

At the owner's request, adaptive height and desktop media rules are commented out.
The viewport requests width=240, height=320; 72px arrows and larger controls apply
unconditionally. CSS URL version 3 bypasses the previous stylesheet cache.
All 17 screen fixtures fit 240 × 320 in the in-app browser. This temporarily
supersedes the adaptive layout above; Opera Mini may still override viewport hints.
Restore the commented rules, remove the final fixed-layout block, restore the
device-width viewport and browser test sizes, and bump the CSS URL to revert.
