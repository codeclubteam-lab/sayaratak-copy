# Step 3.1 verification

Completed 2026-10-05 against the local production build at `http://localhost:3000`, with `APP_ORIGIN` set to that origin. This verifies the public shell, not the later homepage or destination content.

Native Chrome screenshots cover Arabic RTL and English LTR at 360, 390, 768, 1024, 1280 and 1536 px, at viewport height 900 px. `browser-results.json` records document width, header height, visible primary links, overlap, mobile tab visibility, title and canonical at each size. Every measured width matches the viewport; header groups do not overlap. Headers measure 56 px below lg and 64 px from lg. Mobile tabs hide from md. Five primary links plus Services appear at lg; eight links appear at xl.

Inspected representative desktop, mobile and mobile-menu screenshots. The first pass found a wordmark covered by an image that failed before hydration, Messages visible below lg, and Arabic header overflow at 1024 px. The final screenshots show their corrections.

The browser interaction checks passed:

- Language switching preserves `/ar?city=x&city=y#results` as `/en?city=x&city=y#results`, and changing language changes document direction.
- Escape closes the Arabic menu and returns focus to its trigger.
- Data saver changes the cookie and pressed state, persists after a full reload, and renders enabled from an SSR request cookie.
- Public settings expose only contact fields.
- No uncaught browser runtime exceptions.

Vitest covers role posting, documented message paths, auth destination preservation, unread counts, sign-out, menu operation, logo fallback, actual Router home-link preload cancellation, preference updates, footer failure/retry, skip-link focus and landmarks, banner empty/loading/error/missing-image states, visible impression deduplication and click delivery with `keepalive`. Tests call the real mock handlers through the shared fetch shim.

`typecheck`, `lint`, `check`, `i18n:check`, production `build` and configured `size` passed. The full suite passed all 128 tests, including the final skip-link case. Playwright and axe were not installed or run, respecting the earlier owner decision. No screen-reader or Lighthouse result is claimed.

The entry is 185.4 KB gzip, the public shell route 44.7 KB and Match 5.5 KB. Individual chunk checks pass; the combined initial script size remains above the original total-home target and needs the phase 14.5 pass.

Destination pages, auth dialog, notification popover and data saver media consumers remain in their assigned steps. Missing canonical brand art uses the text fallback. BannerSlot is component-tested; its visual integration belongs to the pages that mount it.

The QA scripts used native Chrome DevTools Protocol and local temporary files, without adding dependencies. Production/browser processes launched by the final check were stopped afterward. This directory and the planning documents remain local and gitignored.
