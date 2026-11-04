# Backend handoff

What the real API has to provide so the frontend works unchanged, and what the mock does today that the backend must repeat. The mock in `src/mocks` is the reference implementation: when this file and the mock disagree, read the handler named in each section.

## Conventions

- Base path `/api`. JSON in and out, except the multipart uploads named below.
- Every request and response is checked by a Zod schema in `packages/shared/src/schemas`. In the tables, `inputs:loginInputSchema` means the export `loginInputSchema` of `packages/shared/src/schemas/inputs.ts`. The backend imports the same files (the workspace package `@sayaratak/shared`), so the contract cannot drift.
- `Page<X>` is `{ items: X[], total, page, pageSize }` (`fields:pageOf`). Page lists take `page` and `pageSize`; short lists and rails take `limit` (1 to 24) instead.
- Array query params repeat the key: `fuel=petrol&fuel=diesel`.
- Errors: HTTP status plus `{ code, message, fields?, retryAfter? }`. `fields` maps a field name to an i18n key such as `validation.required`. The UI reacts to `code` only.
- Money is whole SDG, as integers, with no currency field. Dates are ISO strings in UTC; the UI shows them in `Africa/Khartoum`.
- Bilingual text is `{ ar, en }` (`fields:bilingualSchema`): taxonomy names, business names and descriptions, notification titles and bodies, pages, banners.
- Session by cookie. "public" marks endpoints that work signed out; every other endpoint answers 401 `unauthenticated` when signed out and 403 `banned` for a banned account.

### Error codes

| Status and code | Meaning |
|---|---|
| 401 `unauthenticated` | No session. The UI opens the sign-in dialog and replays the action |
| 401 `invalid_credentials` | Wrong email or password, or wrong current password |
| 403 `forbidden` | Wrong role or not the owner |
| 403 `banned` | The account is banned |
| 403 `limit_reached` | Listing limit of the plan reached |
| 404 `not_found` | Missing, or not visible to this viewer |
| 409 `exists` | Email or phone taken; payment item already paid or under review |
| 409 `in_use` | Taxonomy row or plan still referenced |
| 409 `last_shown` | Would hide the last vehicle type or country |
| 409 `payment_pending` | A receipt for this item is already under review |
| 409 `already_reviewed` | One review per author per target |
| 409 `no_credits` | No featured credit left |
| 409 `bump_wait` | The listing was bumped less than 24 hours ago |
| 409 `page_full` | An ad page has no free slot for those dates |
| 409 `conflict` | State does not allow the action (for example replying to a hidden review) |
| 410 `code_expired` | Emailed code expired, used, or failed five times |
| 422 `validation` | Body or query failed its schema; `fields` holds the keys |
| 422 `otp_invalid` | Wrong code |
| 422 `invalid_token` | Reset token unknown or used |
| 422 `contact_required` | Would remove the last email or phone |
| 429 `too_many_attempts` | Throttled; `retryAfter` in seconds |
| 5xx or network | The UI shows a retry |

## Endpoints

### Session and account (`handlers/auth.ts`)

The auth rows are the mock's contract. The backend plan replaces them with Better-Auth's own endpoints (owner decision, 2026-10-27); `SWAP_TO_REAL_API.md` lists what changes in the frontend. The behaviors in "Auth rules" still apply.

| Endpoint | Input | Output |
|---|---|---|
| `GET /me` (public) | | `user:userSchema` or `null` |
| `POST /auth/login` | `inputs:loginInputSchema` (email, password) | `user:userSchema` + session cookie |
| `POST /auth/signup` | `inputs:signupInputSchema` (email, fullName, password) | `api:codeSentSchema`. Creates nothing yet |
| `POST /auth/signup/verify` | `inputs:codeInputSchema` (email, code) | 201 `user:userSchema` + session cookie |
| `POST /auth/oauth/:provider` | `inputs:oauthInputSchema`. `google` or `facebook` | `user:userSchema` + session cookie |
| `POST /auth/otp/send` | `inputs:otpSendInputSchema` | `api:okSchema` |
| `POST /auth/otp/verify` | `inputs:otpVerifyInputSchema` | `user:userSchema` (signs in when signed out) or `api:okSchema` |
| `POST /auth/forgot` | `inputs:emailInputSchema` | `api:codeSentSchema`, same answer for unknown emails |
| `POST /auth/forgot/verify` | `inputs:codeInputSchema` | `api:resetTokenSchema` (one-time token) |
| `POST /auth/reset` | `inputs:resetInputSchema` (token, password) | `api:okSchema` |
| `POST /auth/logout` | | `{ ok }`, clears the cookie |
| `PATCH /me` | `inputs:profilePatchSchema` | `user:userSchema` |
| `POST /me/password` | `inputs:passwordInputSchema` | `api:okSchema` |
| `DELETE /me` | | `{ ok }`, clears the cookie. Admins get 403 |
| `GET /me/notification-prefs`, `PATCH` | `inputs:notificationPrefsInputSchema` | `api:notificationPrefsSchema` |
| `GET /drafts/:key`, `PATCH` | `inputs:draftInputSchema` | `api:draftSchema` |
| `POST /onboarding/complete` | `inputs:onboardingInputSchema` (`role`, `payload`) | `user:userSchema`. Creates the business record (`handlers/onboarding.ts`) |
| `GET /me/counts` | | `api:countsSchema` (unread messages, notifications, admin queue sizes) |

### Catalog, listings and search (`handlers/listings.ts`, `mocks/search.ts`, `handlers/map.ts`)

| Endpoint | Input | Output |
|---|---|---|
| `GET /taxonomy` (public) | | `taxonomy:taxonomySchema` |
| `GET /listings` (public) | query `search/schemas:searchParamsSchema` (`packages/shared/src/search/schemas.ts`), plus `limit`, `exclude` | `listing:listingPageSchema` (page plus `facets`) |
| `GET /listings/:slug` (public) | slug resolves by its trailing id | `listing:listingSchema` |
| `GET /listings/:id/similar` (public) | | `listing:listingSchema[]`, up to 8 |
| `POST /listings` | `inputs:listingCreateSchema` (`submit` true sends for review, false saves a draft) | `listing:listingSchema` |
| `PATCH /listings/:id` | `inputs:listingPatchSchema` | `listing:listingSchema` |
| `DELETE /listings/:id` | | empty |
| `POST /listings/:id/status` | `inputs:listingStatusInputSchema` | `listing:listingSchema` |
| `POST /listings/:id/renew`, `/duplicate` | | `listing:listingSchema` |
| `GET /me/listings` | `tab`, `type`, `intent`, `sort`, `q`, `needsAttention`, `page`, `pageSize` up to 500 (CSV export) | `Page<listing:listingSchema>` |
| `GET /listings/:id/analytics` | `range=7d\|30d\|90d` | `api:listingAnalyticsSchema` |
| `GET /map` (public) | `layers` (repeat: vehicles, dealerships, workshops, mechanics), `bbox=west,south,east,north`, vehicle filters | `responses:mapResponseSchema`, at most 300 items |
| `POST /uploads` (public) | multipart `file`, and `poster` for a video; optional `width`, `height`, `placeholderColor` | `listing:mediaSchema` |
| `GET /uploads/:id` (public) | | the file |
| `POST /events` (public) | `inputs:eventInputSchema` (`view`, `phone_click`, `whatsapp_click`, `share`, `banner_click`, `banner_view`, `targetId`) | `api:okSchema` |
| `GET /me/analytics` | `range` | `responses:analyticsSchema`, role scoped |

### Directories and business self-service (`handlers/directory.ts`)

| Endpoint | Input | Output |
|---|---|---|
| `GET /dealerships`, `/workshops`, `/mechanics` (public) | filters of each directory page (`city`, `verified`, `q`, `service`, `specialization`, `minYears`, `available`, `openNow`, `lat`, `lng`, `sort`), `page`, `limit` | `Page<profile:dealershipSchema \| workshopSchema \| mechanicSchema>` |
| `GET /dealerships/:slug`, `/workshops/:slug`, `/mechanics/:slug` (public) | | the profile schema, with `unavailable` when the owner is banned |
| `GET /me/business`, `PATCH` | `inputs:businessPatchSchema` | the profile schema of the caller's role |
| `POST /me/business/images`, `PUT` | `inputs:imagesInputSchema`, `inputs:idsInputSchema` (ordered) | `profile:workshopSchema` |
| `GET/POST /me/services`, `PATCH/DELETE /me/services/:id`, `POST /me/services/reorder` | `inputs:serviceInputSchema`, `inputs:idsInputSchema` | workshop services |
| `GET/POST /me/portfolio`, `PATCH/DELETE /me/portfolio/:id`, `POST /me/portfolio/reorder` | `inputs:portfolioInputSchema` (with an upload `imageId`), `inputs:idsInputSchema` | mechanic portfolio |

### Reviews, saved items, messaging, notifications, trust

| Endpoint | Input | Output |
|---|---|---|
| `GET /reviews` (public) | `targetType`, `targetId`, `page`; owner only: `includeHidden`, `needsReply` | `Page<review:reviewSchema>` |
| `POST /reviews`, `PATCH/DELETE /reviews/:id` | `inputs:reviewInputSchema`, `inputs:reviewPatchSchema` | `review:reviewSchema` |
| `POST /reviews/:id/reply` | `inputs:replyInputSchema` | `review:reviewSchema` |
| `POST /reviews/:id/flag` | | `review:reviewSchema` |
| `GET /me/favorite-ids` (public) | | `{ ids: string[] }`, empty signed out |
| `GET /favorites` | `sort=recent\|price_asc\|price_desc`, `type`, `page` | `listing:favoritePageSchema` (each item has `savedAt`, `unavailable`) |
| `POST /favorites`, `DELETE /favorites/:listingId`, `DELETE /favorites` (all) | `inputs:favoriteInputSchema` | `api:okSchema` |
| `GET/POST /saved-searches`, `PATCH/DELETE /saved-searches/:id` | `inputs:savedSearchInputSchema`, `inputs:savedSearchPatchSchema` (`name`, `alerts`, `markSeen`) | `saved-search:savedSearchSchema` |
| `GET /threads`, `POST /threads` | `inputs:threadInputSchema` (`subjectType`, `subjectId`, `body`) | `messaging:threadSchema[]`, `messaging:threadSchema` |
| `GET /threads/:id/messages`, `POST` | `inputs:messageInputSchema` | `Page<messaging:messageSchema>`, `messaging:messageSchema` |
| `POST /threads/:id/read` | | `api:okSchema` |
| `GET /notifications` | `unread`, `page`, `limit` | `Page<messaging:notificationSchema>` |
| `POST /notifications/read` | `inputs:readInputSchema` (`ids?`; none marks all) | `api:okSchema` |
| `POST /reports` | `inputs:reportInputSchema` | `admin:reportSchema` |
| `POST /me/verification` | multipart: `label` and `file` per document (1 to 5 images, 5 MB each), `note` | `admin:verificationRequestSchema` |
| `GET /me/verification` | | `admin:verificationRequestSchema` or `null` |

### Billing, promotions and ads (`handlers/billing.ts`, `handlers/ads.ts`)

| Endpoint | Input | Output |
|---|---|---|
| `GET /plans` (public) | `audience` | `billing:planSchema[]`, enabled only; `[]` for `user` while individual subscriptions are off |
| `GET /me/subscription` | | `responses:meSubscriptionSchema` (subscription, plan, usage, credits, plan under review) |
| `DELETE /me/chosen-plan` | | Drops the paid plan picked in onboarding |
| `GET /me/payments` | `page` | `Page<billing:paymentSchema>` |
| `POST /payments` | multipart: `itemType` (`plan`, `promotion`, `campaign`), `itemId`, `transactionRef` (4+ characters), `payerName`, `receipt` (image, 5 MB) | `billing:paymentSchema` |
| `GET /checkout` | `item=plan:<id>\|promotion:<id>\|campaign:<id>` | `responses:checkoutSchema` |
| `GET /promotion-prices` (public) | | `billing:promotionPriceSchema[]` |
| `POST /promotions` | `inputs:promotionInputSchema` (`listingId`, then `priceId` or `useCredit: true`) | `billing:promotionSchema` |
| `GET /me/promotions` | | `responses:myPromotionsSchema` |
| `GET /ad-pages` (public) | | `ads:adPageSchema[]` with free slots |
| `GET /me/ad-targets` | | `ads:adTargetSchema[]` (the advertiser's profile and live listings) |
| `GET /me/campaigns`, `POST /campaigns` | `inputs:campaignInputSchema` | `ads:campaignSchema[]`, `ads:campaignSchema` |
| `GET /ads` (public) | `page` (an `ads:adPageIdSchema`) | one running campaign as `admin:bannerSchema`, or `null` |

### Content (`handlers/content.ts`)

| Endpoint | Input | Output |
|---|---|---|
| `GET /site` (public) | | `responses:siteSchema` (contact details and locales only) |
| `GET /pages/:slug` (public) | | `admin:sitePageSchema` |
| `GET /banners` (public) | `placement` | `admin:bannerSchema[]`, only live ones |
| `POST /contact` (public) | `inputs:contactInputSchema` | `api:okSchema` |

### Admin (`handlers/admin*.ts`). Every endpoint needs role `admin`

| Endpoint | Input | Output |
|---|---|---|
| `GET /admin/stats` | `range` | `responses:adminStatsSchema` |
| `GET /admin/activity` | | `responses:activitySchema` (ten newest events) |
| `GET /admin/search` | `q` | `responses:adminSearchSchema` (up to five hits per kind) |
| `GET /admin/moderation` | `type`, `sellerKind`, `q`, `page` | `Page<listing:listingSchema>`, pending only |
| `POST /admin/listings/:id/approve\|reject\|remove\|restore` | reject takes `inputs:rejectInputSchema` | `listing:listingSchema` |
| `POST /admin/listings/bulk` | `inputs:bulkInputSchema` | `admin:bulkResultSchema` (`count`, rows that do not fit are skipped) |
| `GET /admin/listings`, `PATCH /admin/listings/:id` | filters `moderation`, `status`, `type`, `sellerKind`, `cityId`, `promoted`, `ownerId`, `id`, `q`; `inputs:adminListingPatchSchema` (status only) | `Page<admin:adminListingSchema>`, `listing:listingSchema` |
| `GET /admin/users`, `POST /admin/users/:id/ban\|unban` | `role`, `status`, `id`, `q`; `inputs:banInputSchema` (`reason`, `duration` 7d, 30d, permanent) | `Page<admin:adminUserSchema>`, `user:userSchema` |
| `GET /admin/businesses`, `PATCH /admin/businesses/:id` | `type`, `cityId`, `verified`, `status`, `planId`, `id`, `q`; `inputs:businessAdminPatchSchema` | `Page<admin:adminBusinessSchema>`, `admin:adminBusinessSchema` |
| `POST /admin/businesses/:id/assign-plan` | `inputs:assignPlanInputSchema` (plan, custom price, limit, days, note) | `admin:adminBusinessSchema` |
| `GET /admin/verifications`, `POST /admin/verifications/:id/approve\|reject` | `status`, `id`, `q`; `inputs:rejectInputSchema` | `Page<admin:adminVerificationSchema>`, `admin:adminVerificationSchema` |
| `GET /admin/payments`, `POST /admin/payments/:id/approve\|reject` | `status`, `userId`, `id`, `q`; `inputs:rejectInputSchema` | `responses:adminPaymentsPageSchema` (page plus summary strip), `billing:paymentSchema` |
| `GET/POST /admin/plans`, `PATCH/DELETE /admin/plans/:id` | `inputs:planInputSchema` | `admin:adminPlanSchema` |
| `GET /admin/subscriptions` | `audience`, `planId`, `status`, `q` | `Page<admin:adminSubscriptionSchema>` |
| `GET /admin/promotion-prices`, `PATCH /:id` (price, and days of a Featured row; the set of rows is fixed) | | `billing:promotionPriceSchema` |
| `GET /admin/promotions`, `POST /admin/promotions/grant`, `POST /admin/promotions/:id/end` | `inputs:grantInputSchema` | `Page<responses:myPromotionSchema>`, `responses:myPromotionSchema` |
| `GET /admin/reviews`, `POST /admin/reviews/:id/hide\|show` | `status`, `targetType`, `rating`, `id`, `q` | `Page<admin:adminReviewSchema>`, `review:reviewSchema` |
| `GET /admin/reports`, `POST /admin/reports/:id/dismiss\|action` | `status`, `id`; `inputs:noteInputSchema`, `inputs:reportActionInputSchema` (`note`, `ban?`) | `Page<admin:adminReportSchema>`, `admin:adminReportSchema` |
| `GET/POST /admin/taxonomy/:type`, `PATCH/DELETE /admin/taxonomy/:type/:id` | `type` is `api:taxonomyTypeSchema` (countries, cities, districts, makes, models, vehicle-types, part-categories); `inputs:taxonomyInputSchema` | `api:taxonomyRowSchema`, `admin:adminCountrySchema`, `adminCitySchema`, `adminDistrictSchema` |
| `GET /admin/broadcasts`, `POST`, `GET /admin/broadcasts/estimate` | `inputs:broadcastInputSchema`; estimate takes the audience params | `Page<api:broadcastSchema>`, `api:broadcastSchema`, `responses:estimateSchema` |
| `GET/POST /admin/banners`, `PATCH/DELETE /:id` | `inputs:bannerInputSchema` | `admin:bannerSchema` |
| `GET /admin/campaigns`, `POST /admin/campaigns/:id/approve\|reject` | `inputs:rejectInputSchema` | `Page<ads:campaignSchema>` |
| `GET /admin/ad-pages`, `PATCH /admin/ad-pages/:id` | `inputs:adPagePatchSchema` (weekly price, slots, for sale) | `ads:adPageSchema` |
| `GET/PATCH /admin/pages/:slug` | `inputs:pagePatchSchema` | `admin:sitePageSchema` |
| `GET/PATCH /admin/settings` | `inputs:settingsPatchSchema` | `admin:settingsSchema` |
| `GET/POST /admin/backups`, `POST /admin/backups/:id/restore` | | `admin:backupSchema` |

`POST /mock/reset`, `/mock/expire-session` and `/mock/ban-me` are demo tools and have no real counterpart.

## Behaviors the backend must repeat

### Visibility

- A listing is public when it is approved, its owner is not banned and the owner's business is not suspended. The owner and admins also see draft, pending, rejected and removed ones. Anyone else gets 404.
- Sold and rented listings leave search unless `includeSold` is set.
- Everyone except the owner and admins gets a listing's `location` rounded to 2 decimals (about 1 km), in `GET /listings/:slug`, `GET /listings`, `GET /favorites` and `GET /map`.
- A banned owner's business page still opens, with `unavailable` set and no contact details (dealership `phones` empty, workshop and mechanic `phone` empty text, `whatsapp` null), but leaves directories, the map and the sitemap. A suspended business leaves the same places and its owner sees a banner on every dashboard page.
- Cities of a disabled country, and their districts, are left out of the public `/taxonomy`.
- Favorites keep listings that are no longer public, flagged `unavailable`, so the person can remove them.

### Search, ranking and facets (`mocks/search.ts`)

- Filters combine with AND. Multi-value filters (fuel, transmission, body, drive, origin, driver, part type) match any listed value. `features` needs every listed feature. Yes-only flags (customs cleared, accident free, registered, first owner, full service, warranty, exchange, financing, insurance included, delivery, installation) keep listings whose field says yes. For parts, `type` matches any of `compatibleTypes`.
- `q` matches every word against the title, both description languages and the make and model names in both languages.
- A radius needs `lat`, `lng` and `radius` in km; distance is haversine. A city's center wins over the browser position as origin.
- Sorts: `relevance`, `newest` (by `bumpedAt`, else `createdAt`), `price_asc`, `price_desc`, `year_desc`, `mileage_asc`, `nearest` (falls back to relevance without a position).
- Relevance: listings with a Featured promotion running now first, then listings with photos, then newest. Then `capPaid`: Featured listings take turns, ordered by a hash of the listing id and the current hour (stable while a buyer pages through, different each hour, so every paying seller gets a share of page 1); each page of 24 opens with a row of up to 4 Featured listings, then one Featured may lead each later row of 4 (at most 9 a page), the rest are organic. Featured listings left over move to later pages, still ahead of organic ones there.
- `featured=true` (the home page rail) keeps listings with a running Featured promotion.
- Facets are disjunctive: each facet (`type`, `make` with `model`, `fuel`, `transmission`, `city` with `district`) is counted with every filter applied except its own, so picking a make still shows counts for the other makes.
- Paid mechanics (active subscription to a plan with price above 0) lead every sort of `GET /mechanics`.

### Listings lifecycle (`handlers/listings.ts`, `handlers/admin.ts`)

- Moderation states: `draft`, `pending`, `approved`, `rejected`, `removed`. Sale status: `available`, `reserved`, `sold`, `rented`.
- Submitting runs the full wizard validation (`packages/shared/src/listings/schemas.ts`: the flat `listingInputSchema`, then the type, details, photos and contact step rules). A draft may be incomplete.
- Auto-approve: when `settings.autoApproveVerifiedDealers` is on and the owner is a verified dealership, a submitted listing is `approved` at once; otherwise `pending`.
- Editing title, description, media, kind, vehicle type or part category of an approved listing sends it back to review (unless auto-approved). Price and status never do. Admin edits never do.
- Approve and restore set `approved` and clear the rejection reason. Reject stores the reason. Each notifies the owner.
- Renew sets `expiresAt` to the later of now and the current end, plus `settings.listingExpiryDays`.
- Duplicate makes a new draft copy.
- Delete removes the listing and its favorites. Deleting an account marks its listings removed and keeps them for the admin history (`mocks/account.ts`).
- Slugs: `packages/shared/src/lib/slug.ts` `makeListingSlug(title, city, id)`. Rebuilt when the title or city changes. The id is six characters and never changes; a city slug is made once from its English name and never changes.

### Plans, limits and credits (`mocks/lib.ts`, `handlers/billing.ts`)

- A listing counts against the limit while it is pending or approved, available or reserved, and not expired.
- Individuals: no limit while `settings.individualSubscriptionsEnabled` is off; otherwise their active subscription's limit, else `settings.freeListingLimit`. Dealerships: their subscription's `listingLimit`. Workshops and mechanics post no listings. Over the limit, submit returns 403 `limit_reached`.
- Each audience's free plan is its first plan priced 0. Finishing business onboarding starts an active subscription to it without payment. A free subscription renews itself when it ends (the mock does not age subscriptions; the backend needs a job).
- Workshop plans may cap `serviceLimit` and `photoLimit`, mechanic plans `portfolioLimit`. Over a cap, only reorder and remove pass, so a downgraded account keeps what it has.
- `featuredCredits` per plan: each credit is a free 7-day Featured (`POST /promotions` with `useCredit: true`), counted per subscription period, no carry-over. 409 `no_credits` when none is left.
- Plans: the audience never changes; the free plan keeps price 0 and stays on; deleting a plan that any subscription or payment names is 409 `in_use`.

### Payments (manual Bankak transfer)

- `POST /payments` only for an enabled plan of the payer's own role, an unpaid promotion of the payer's listing, or an unpaid campaign of the payer. A second receipt while one is under review is 409 `payment_pending`. The reference is stable per payer and item (`SY-` plus six digits).
- Approve, plan: cancels the active subscription and starts a new one for the plan's days with the plan's price and limit. Promotion: a Featured starts now for its days and is added to the listing; a bump sets the listing's `bumpedAt` to now and reads `ended` at once. Campaign: approves it. Then notifies `payment_approved`.
- Reject stores the reason and notifies `payment_rejected`. A rejected campaign goes back to unpaid; a rejected plan becomes the account's chosen plan again, waiting for payment.
- Only a payment in review can be decided (else 409).
- The admin summary counts approved payments in the current month on the Khartoum calendar.

### Promotions and ads

- Two promotion types. **Featured** runs for days (one price row per length: 3, 7 and 14 days in the seed), lifts the listing in relevance, joins the home page rail and shows the Featured badge. **Bump** (one price row, 0 days) is one-off: on approval the listing's `bumpedAt` becomes now, so it goes back to the top of the newest; no badge and nothing added to `promotions`.
- `POST /promotions` with a `priceId` creates `pending_payment` with that row's type and days, or returns the existing unpaid one for the same listing, type and days. A bump is refused with 409 `bump_wait` within 24 hours of the listing's last bump. An admin grant starts at once and costs nothing (`source: admin_grant`). Ending removes it from the listing at once. A running promotion whose end has passed reads as `ended`.
- Campaign price is the sum of the chosen pages' weekly prices times weeks, computed on the server. A campaign holds its slots from the moment its receipt is sent until it ends; sending the receipt re-checks free slots (409 `page_full`). `GET /ads` serves one running campaign of the page at random; house banners fill unsold slots.

### Events and analytics (`handlers/analytics.ts`)

- `POST /events` adds one to a per-target, per-day counter (`view`, `phone_click`, `whatsapp_click`, `share`, `banner_click`, `banner_view`). Listing views, calls and WhatsApp clicks also update the listing's own `stats`. Banner and campaign clicks and views update their counters.
- The frontend sends a `view` once per session per listing or profile page.
- Analytics windows count whole days: n days is today and the n - 1 days before. `previous` is the window of the same length just before. Scope: sellers see their listings, businesses their profile, admins everything.

### Notifications

Created on: new message, listing approved or rejected, verification result (approved, rejected, badge removed), business suspended or restored, saved-search match, new review, payment approved or rejected, subscription expiring, listing expired (api job only, the mock does not age listings), admin broadcast. Each stores title and body in both languages and a link for the recipient's dashboard. Nothing is written when the recipient turned that kind off in their notification settings (`mocks/lib.ts` `prefOf` maps type to setting). Subscription-expiring notices are only seeded in the mock; the backend needs a job that sends them.

### Saved searches

On every approval, each saved search with alerts on (not the listing owner's) whose params match the listing gets `newCount + 1` and a `saved_search_match` notification. `markSeen` resets the count.

### Messaging

One thread per pair of people and subject; asking again reuses it. The demo auto-reply after 8 seconds is mock only.

### Reviews

One review per author per target (409 `already_reviewed`). The target's owner may reply (a new reply replaces the old one) and may flag a review: it stays public until an admin hides it; flagging twice changes nothing. Show sets it back to visible. Replying to a hidden review is 409 `conflict`.

### Admin actions

- Ban takes a reason and a duration; a timed ban lifts itself when it ends (the mock checks on each request). No notification: the person gets 403 `banned` on their next request and sees the suspended page. Admins cannot be banned.
- Report action removes the listing and notifies the owner, or with `ban` bans the owner and notifies nobody. Every open report on that listing closes with the same note.
- Verifying or un-verifying a dealership copies the badge to its listings.
- Suspending a business needs a reason; the owner is notified on suspend and on restore.
- Assign plan replaces the business's active subscription; empty custom fields take the plan's values.
- Taxonomy: a row in use is 409 `in_use`. The last shown vehicle type and the last enabled country cannot be turned off (409 `last_shown`).
- Broadcast audience: roles, optional city (individuals by profile city, businesses by business city), verified only (leaves individuals out). Only accounts with announcements on are counted and notified. The api queues the broadcast (`status` queued, 0 recipients) and a job rings the bells in chunks (`sending`, then `sent`; `recipients` counts those reached so far); the mock does the same 1.5 seconds after Send. Only accounts that existed when it was sent are reached.
- Backups store a full snapshot; restore puts it back and keeps the backup list.

### Auth rules

- Emailed codes: 6 digits, valid 10 minutes, one use, gone after 5 wrong tries; sending again replaces the code. Sign-up creates the account only after the right code.
- Forgot password answers the same for unknown emails and sends nothing.
- Login throttling: 5 failures per email in 10 minutes gives 429 `too_many_attempts` with `retryAfter`. A password reset clears the counter.
- Changing email or phone needs a code sent to the new value; removing one is refused when it is the last.

### Uploads

Images up to 5 MB (the client already resizes them to WebP; receipts and verification documents go up as they are, JPEG, PNG or WebP only), no SVG (it can carry script), video up to 30 MB with a poster up to 1 MB. The backend should read width, height and dominant color from the file instead of trusting the client, and serve `{w}` widths 320, 640, 960 and 1280 (the mock serves the original for every width).

### Scheduled jobs the mock does not have

The mock computes these at read time or not at all. The backend needs jobs for: listing expiry, promotion end, subscription end and free-plan renewal, subscription-expiring notices, timed ban lift, automatic backups (daily or weekly per settings).

## Security notes the mock cannot show

- **Rate limits.** Throttle login, sign-up, code send and code verify per email and per IP, `POST /auth/forgot`, `POST /contact`, `POST /reports`, `POST /reviews`, `POST /threads` and messages, `POST /uploads`, and `POST /events`. Return 429 with `retryAfter`.
- **Account enumeration.** Forgot password already answers the same either way. Sign-up returns 409 `exists` for a taken email; keep that only behind rate limits, or switch to "check your email" for both cases. Login must not reveal whether the email exists.
- **Uploads.** Check type by content, not extension; strip EXIF (phone photos carry GPS); scan for malware; re-encode images; serve from a separate origin with `Content-Disposition` and a strict content type. `POST /uploads` is public in the mock for the post wizard before sign-in: in production require a session or a short-lived upload token, and delete orphaned uploads.
- **Authorization.** Check ownership on every `:id` route on the server, not only role. Admin endpoints check role `admin` on every call.
- **Audit log.** Record every admin action (approve, reject, remove, ban, verify, suspend, payment decision, plan change, settings, taxonomy, broadcast, restore) with admin id, target, before and after, reason, time and IP. The admin activity feed can read from it.
- **Sessions.** httpOnly, `Secure`, `SameSite=Lax` cookies; rotate on sign-in and on password change; sign out other sessions after a password reset. CSRF protection on state-changing requests.
- **Response headers.** `src/server.ts` sets a per-request CSP nonce, `Content-Security-Policy`, `X-Content-Type-Options: nosniff` and `Referrer-Policy` on the web app. When the API moves to its own origin, add that origin to `connect-src` (it comes from `VITE_API_BASE_URL`) and image hosts to `IMAGE_ORIGINS`, and send `nosniff` from the API too.
- **Payment receipts** are personal financial data: admins only, never public URLs.
- **Location privacy.** Round positions on the server, never in the client.
- **Browser web push.** Notifications are in-app only today. Web push needs VAPID keys, a subscription endpoint, per-device storage, and the same per-type preference check as in-app notifications.
