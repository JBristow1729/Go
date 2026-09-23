# Nokia 3210 / Opera Mini acceptance check

**Current experiment:** force the 240 × 320 layout regardless of reported height. Adaptive rules below are temporarily commented out; test on the handset before restoring them.

Use a deployed HTTPS preview. Record the handset model, Opera Mini version, Mobile view setting, text size, and which browser bars remain visible. The target is the 2024 Nokia 3210 4G with a 2.4-inch, 240 × 320 display. Check usable viewport heights of 200, 240, 280 and 320 CSS pixels: toolbar space varies. Normal screens retain the 200px compact fallback; direction icons and controls grow when more height is available.

- Start Journey is visible and selectable without scrolling.
- From/To inputs, Next and Back fit after returning from the native text editor.
- All three place choices and Edit search fit; distinct locality labels help identify the right result.
- Keypad focus is obvious and follows visual order. Walk and Drive work with the centre/select key.
- Ready and Begin fit.
- Timing, arrow, action, road, Prev/Next and attribution all fit for departure, turn, roundabout, U-turn and arrival.
- A long name is truncated with an ellipsis. Selecting the road line reveals the full name/instruction. Scrolling is acceptable only here (and in deliberately opened place details). Show less restores the compact screen.
- Prev or Next from an expanded instruction returns to compact mode.
- A no-results search and a temporary routing error fit and allow correction/retry.
- Browser Back does not accidentally select a different place. Repeating a submitted route does not calculate it again.
- An idle journey expires after two hours with a usable restart path.
- Check normal text size first. If enlarged browser text causes overflow, record the setting and resulting usable area; do not declare no-scroll compliance until the preferred phone configuration passes.

For live-provider checks, use Romsey → Romsey Abbey walking, a short local drive, an explicit London destination and an explicit Belfast search. Confirm actual route data, not the demo label. Long-distance routing can be limited by the provider's free service.

Status at delivery: requires the owner's physical phone and a deployed preview. Do not infer device acceptance from the desktop screenshots.
