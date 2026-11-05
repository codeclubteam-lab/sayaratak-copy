# Sayaratak API for iOS and Android

Start with [Local walkthrough](#local-walkthrough). It signs in, searches listings, uploads a
photo, opens a conversation and triggers a push without a browser session.

## Addresses and contract

| Environment | API origin | Base URL for requests |
| --- | --- | --- |
| Local | `http://localhost:4000` | `http://localhost:4000/api/v1` |
| Production | Owner supplies the custom API hostname before release | `https://<API hostname>/api/v1` |

There is no staging service yet. Use local demo data, not production, for development. Ask the
owner for a staging API before shared testing. A Render test hostname is not a staging guarantee.

- The committed [`../openapi.json`](../openapi.json) is OpenAPI 3.1. Generate a client for your
  stack from it. Paths already contain `/api/v1`; generated clients use the API **origin**, not
  another `/api/v1` prefix. Handwritten examples below use `BASE` including `/api/v1`.
- `GET /api/v1/openapi.json` serves the contract. `/auth/*` belongs to Better-Auth 1.7.10 and is
  excluded from that file. Its app sign-in requests are documented below.
- `GET /api/docs` shows a read-only Scalar reference in development and test. It loads JavaScript
  from jsDelivr, so the browser needs internet access. It always returns 404 in production.
- Changes within v1 are additive. Ignore unknown response fields; give unknown notification types
  a notifications-screen fallback. Removed fields, changed types and new required inputs need v2.
- Money is whole Sudanese pounds, SDG, without a currency field. Dates are ISO strings. Text may
  be bilingual `{ "ar": "...", "en": "..." }`; select the active app locale.

## Headers

Send these from the native HTTP client, not a webview with a browser cookie jar.

| Header | Value | When |
| --- | --- | --- |
| `Authorization` | `Bearer <session token>` | Signed-in API requests, including private file downloads |
| `X-Platform` | `ios` or `android` | Every API request |
| `X-App-Version` | Three numeric parts, for example `1.4.0` | Every API request; no `v` prefix or build suffix |
| `Accept-Language` | `ar` or `en` | Every request; used for mail before an account locale exists |
| `Content-Type` | `application/json` | JSON bodies only |
| `Idempotency-Key` | A fresh UUID per action, reused on retries | Supported create requests, listed below |

For multipart uploads, let your HTTP library set `Content-Type` with its boundary. Do not set it
to JSON or manually to bare `multipart/form-data`. Do not send `Cookie`, `Origin`, proxy-IP
headers, or the obsolete `X-Upload-Token`. Browser CORS does not apply to native HTTP clients.

A missing or malformed version gets 426 when the owner has set that platform's minimum.
`Accept-Language` does not translate all API text or persist preferences: save the account's
locale with `PATCH /me`, and the device's locale with `POST /me/devices`.

## Sign-in and sessions

Store the session token in iOS Keychain or Android Keystore-backed secure storage, never logs or
plain preferences. Use bearer authentication only, even if the response also sets cookies. A
session lasts 60 days and is extended on use at most once a day. There is no separate refresh
token. Save a new `set-auth-token` header when an auth response supplies one.

```http
POST /api/v1/auth/sign-in/email
Content-Type: application/json
X-Platform: android
X-App-Version: 1.0.0

{"email":"user@demo.sy","password":"Demo1234"}
```

Success is 200 with `set-auth-token: <token>`. Then call `GET /me` with the bearer header for the
app's account shape. `/me` returns **200 null**, not 401, when signed out or the session is
invalid. Protected routes return 401 `unauthenticated`. Reauthenticate after an expired or revoked
session; do not retry writes in a loop. A banned user is refused on protected routes.

### Sign-up, codes and password recovery

These bodies are Better-Auth's, not the old web mock's `fullName` and `code` bodies.

| Method and path, relative to `/api/v1` | JSON body | Result |
| --- | --- | --- |
| `POST /auth/sign-up/email` | `{ "name": "Your name", "email": "...", "password": "..." }` | Sends verification code; no session yet |
| `POST /auth/email-otp/send-verification-otp` | `{ "email": "...", "type": "email-verification" }` | Sends a replacement code |
| `POST /auth/email-otp/verify-email` | `{ "email": "...", "otp": "123456" }` | Verifies and signs in; store `set-auth-token` |
| `POST /auth/email-otp/request-password-reset` | `{ "email": "..." }` | Asks for a reset code without revealing whether the account exists |
| `POST /auth/email-otp/reset-password` | `{ "email": "...", "otp": "123456", "password": "..." }` | Resets password and revokes existing sessions; sign in again |

Passwords are 8 to 128 characters with a letter and a digit. Codes are six digits, expire after
10 minutes and allow five wrong attempts. A replacement invalidates the previous code. The server
silently caps mail at five codes per email per hour; a successful resend response does not
guarantee another email. In local development without SMTP, read the `mail_dev` server log.

### Native Google, Apple and Facebook

Use the platform SDK, then send its token to `POST /auth/sign-in/social`. No browser redirect is
needed. Never embed provider client secrets or Apple signing keys in the app.

```json
{
  "provider": "google",
  "idToken": { "token": "<Google ID token>" }
}
```

Success is 200 with a session `token` and `user`, plus `set-auth-token`. Fetch `/me` afterwards.

| Provider | `idToken` body | Server verification |
| --- | --- | --- |
| Google | `{ "token": "<ID token>" }` | Keys, issuer and audience matching the configured Google client ID |
| Apple | `{ "token": "<identityToken>", "nonce": "<nonce>", "user": { "name": { "firstName": "...", "lastName": "..." } } }` | Keys, issuer and audience matching the app bundle ID or web Services ID. Pass the name on the first sign-in, when Apple supplies it |
| Facebook Limited Login on iOS | `{ "token": "<authentication JWT>" }` | Facebook keys and app ID |
| Facebook classic login | `{ "token": "<access token>", "accessToken": "<access token>" }` | Graph `debug_token` verifies the access token belongs to this app |

Pass the nonce used in the provider request when available. The API compares it to the token
claim; Apple accepts the raw nonce or its SHA-256. A failed token check returns 401.

A new provider account starts with role `user` and onboarding incomplete. Existing-account
linking requires verified emails. Facebook without email is allowed; `/me` omits `email` for
that account. Show a dismissible prompt to add a recovery email.

Provider setup still needed from the owner/app developer:

- Apple is off until the owner supplies the Apple Developer setup and all five `APPLE_*` values.
- Android should request a Google ID token for the API's web client ID, `serverClientId`. The
  current API accepts one `GOOGLE_CLIENT_ID`; add the iOS audience to server configuration when
  the iOS OAuth client exists. Do not ship iOS Google login assuming it is already accepted.
- Use provider applications configured for this environment, not production credentials in a
  local test app. Real-provider checks are separate from the demo password walkthrough.

### Sign-out

First `DELETE /me/devices/<URL-encoded FCM token>` while the bearer session is valid. Then
`POST /auth/sign-out` with that bearer token. Clear local credentials, private downloads and
account caches. Do not assume sign-out automatically unregisters this phone's push address.
`/admin/*` is forbidden to bearer sessions, including an admin's token. There are no app admin screens.

## Errors and app feedback

Application errors have this shape; `fields` and `retryAfter` are optional:

```json
{
  "code": "validation",
  "message": "validation",
  "fields": { "file": "validation.file_size_5mb" }
}
```

Use `code` and your own Arabic/English copy, not the raw `message`. `fields` maps field names to
i18n keys. Preserve the form's values after a refusal. Use this table even for codes in web-only
billing routes; apps must not expose checkout to handle them.

| HTTP | Code | What the app should show or do |
| --- | --- | --- |
| 401 | `unauthenticated` | Sign in; retain the pending action for an explicit retry |
| 401 | `invalid_credentials` | Incorrect password; keep the form open |
| 403 | `forbidden` | Action unavailable to this account; do not retry automatically |
| 403 | `banned` | Account restricted; stop protected actions |
| 403 | `limit_reached` | Plan allowance reached; show existing allowance, no purchase link |
| 404 | `not_found` | Item missing or unavailable; private files also use this to hide access |
| 409 | `exists` | Value already used; point to the relevant field or sign-in |
| 409 | `in_use`, `last_shown` | Reference item cannot be removed; admin-only, no app action |
| 409 | `payment_pending` | Payment already under review; show read-only status |
| 409 | `already_reviewed` | Review already exists; open the existing review |
| 409 | `no_credits`, `bump_wait`, `page_full` | Paid action unavailable; no app checkout or automatic retry |
| 409 | `conflict` | Data changed; refresh before the user tries again |
| 409 | `in_progress` | Keep action pending; back off, retry the same key and body |
| 410 | `code_expired` | Code expired; offer a new code |
| 422 | `validation` | Put translated `fields` messages next to inputs |
| 422 | `otp_invalid` | Incorrect code; keep the code entry open |
| 422 | `invalid_token` | Invalid recovery token; restart recovery |
| 422 | `contact_required` | Keep at least one contact method |
| 422 | `idempotency_mismatch` | Retry payload changed; stop and reconcile, do not silently mint a new key |
| 426 | `upgrade_required` | Require an app update before further API calls |
| 429 | `too_many_attempts` | Disable retry until `retryAfter` seconds, also sent as `Retry-After` |
| 500 | `server_error` | Temporary server failure; preserve input and offer retry |

Better-Auth `/auth/*` also returns its own uppercase codes and statuses. Do not lowercase them
blindly. Handle `INVALID_EMAIL_OR_PASSWORD` as incorrect credentials, `EMAIL_NOT_VERIFIED` by
opening email verification, `INVALID_OTP` as an incorrect code, `OTP_EXPIRED` by offering resend,
and `TOO_MANY_ATTEMPTS` as an exhausted code challenge. The latter is not necessarily HTTP 429:
request a new code rather than endlessly retrying the old one. Our auth hooks can also return
lowercase `validation`, `exists` and `too_many_attempts`. For an unknown auth error, retain input
and show a generic sign-in failure. Honor `Retry-After` when present, including generic auth 429s.

A network timeout has no JSON error and does not prove the write failed. Retry supported writes
with their saved idempotency key. Reverse-proxy 502/503 or non-JSON replies need generic temporary
failure handling, not a JSON parse crash. Record `X-Request-Id` for support, never bearer tokens.

## Lists, search and cursors

Paged responses are `{ items, total, page, pageSize }`. `page` starts at 1; stop when
`page * pageSize >= total`. Public listings add `facets`, render 24 per page, and accept `limit`
from 1 to 24 for short rails. They do not use a client-selected `pageSize`.

```text
GET /listings?kind=vehicle&page=2&sort=newest
GET /listings?kind=part&city=khartoum&limit=8
GET /listings?fuel=petrol&fuel=diesel&seller=u-dealer
```

Multi-select search filters repeat the key, not comma-separated text or JSON. Directory lists
default to 12 per page. Notifications default to 20, messages to 50; both cap `pageSize` at 100.
Where supported, `limit` wins over `pageSize` and caps it at 24. Some endpoints, such as
`GET /threads`, return a plain array, not a page. Read each operation's response schema.

For scrolling notifications, use `GET /notifications?limit=20`, then pass the **last** returned
notification's ID as `before` for older items. Notifications are newest first. For messages,
`GET /threads/<id>/messages?before=<message ID>&limit=20` returns messages older than that ID,
oldest first in the returned batch. Move back using the **first** returned ID. Without `before`,
messages start from the earliest page, not the latest. There is no special `before=latest` value.
Use `page=1` with each cursor and deduplicate by ID when merging. `total` counts matches older
than that cursor. An unknown cursor, or one outside the user's thread/notifications, gives an empty page.

## Photos, video and private files

`POST /uploads` requires a session or bearer token and multipart `file`. Optional `poster` is an
image for video. JPEG, PNG and WebP images are at most 5 MiB; MP4 and WebM video at most 30 MiB;
a video poster at most 1 MiB. SVG, PDF and unsupported types are refused. The server checks bytes,
not just the filename. Client-supplied dimensions and placeholder color are ignored.

Success is **201**, a Media object with `id`, `type`, `url`, `width`, `height`, `placeholderColor`
and `posterUrl`. Save that object and pass it in `media` when creating/editing the listing.
The upload belongs to the signed-in user. Unattached files are cleaned up after 24 hours.

- Public image `url` and `posterUrl` can contain `{w}`. Replace it with **320, 640, 960 or 1280**,
  choosing the smallest width that covers rendered pixels including device pixel ratio. Some
  demo URLs have no placeholder; use those unchanged, resolving relative ones on the web origin.
- `GET /uploads/<id>?w=640` redirects public files to their delivery URL. Unsupported `w` on
  this API route falls back to 1280. Do not invent Cloudinary transformations: strict mode rejects
  other CDN widths. Video URLs are directly playable and do not need width substitution.
- Public CDN requests need no token. Never forward an API bearer header to Cloudinary or to
  an arbitrary redirect host. Restrict the authenticated download client to the API origin.
- Receipts and verification documents are uploaded via their own multipart endpoints, not as
  public `/uploads` photos. Their returned URLs point to `/api/v1/uploads/<id>`, which streams
  the original privately. Send the bearer header, use authenticated image loading, honor
  `private, no-store` and clear temporary copies on sign-out. Missing access returns 404.

Without Cloudinary configured locally, uploads use an in-memory file fake. API upload/attachment
flows work, but the returned demo Cloudinary URL is not a real uploaded CDN asset. Configure
`CLOUDINARY_URL` and strict transformations to check actual delivery. Never put that secret in the app.

## Retrying creates safely

Send `Idempotency-Key` on `POST /listings`, `/listings/<id>/duplicate`, `/threads`,
`/threads/<id>/messages`, `/reviews`, `/reports`, `/uploads`, `/onboarding/complete`, `/me/verification`,
`/me/business/images`, `/me/services`, `/me/portfolio`, and the web-only
`/payments`, `/promotions`, `/campaigns` routes. The contract marks supported operations with
the header. It does not protect every POST; auth and device registration have their own behavior.

Generate one UUID when the user acts and persist it with the request until resolved. Reuse the
same method, path and body on retry, including exact JSON text. For multipart, keep the same
field order, values and file bytes; the boundary may change. Keys are scoped to the account,
across routes, and kept for 24 hours. Do not reuse one key for a different action or account.

| Retry | Answer |
| --- | --- |
| Same key and request after success | Original 2xx status and JSON; no duplicate write |
| Same key, changed request | 422 `idempotency_mismatch` |
| First request still running | 409 `in_progress`; use bounded backoff with jitter |
| First request failed | Error is not stored; retry can run again |

After 61 seconds a running claim can be reclaimed with the same body if the server died. After
24 hours deduplication is no longer guaranteed: reconcile with server state before another write.
Cancelling the phone's request does not cancel a committed server action.

## Push and navigation

Use the Firebase SDK to obtain an **FCM registration token**, on both Android and iOS. An APNs
device token alone is not accepted as an FCM address. iOS delivery also needs the owner's APNs
key configured in Firebase. Request OS permission and configure foreground/background handlers
in the app.

```http
POST /api/v1/me/devices
Authorization: Bearer <session token>
Content-Type: application/json

{"platform":"android","fcmToken":"<FCM token>","appVersion":"1.0.0","locale":"en"}
```

Success is 200 `{ "ok": true }`. Register again after sign-in, token rotation, locale change or
app update. Registering an existing token refreshes it and moves it to the signed-in account.
On sign-out, URL-encode the token in `DELETE /me/devices/<token>` **before** ending the session.
Tokens reported dead by FCM are removed. Delivery is asynchronous and retried through the outbox;
a successful message response is not proof of delivery to the phone.

FCM includes localized `notification.title` and `notification.body`, and string data:

```json
{"type":"message","href":"/account/messages?thread=t-abc","id":"n-abc"}
```

`id` is the **notification ID**, not a listing, message or thread ID. `href` is optional and
normally has no locale prefix. Map it to app screens; do not concatenate `/ar` before parsing.
The account bases are `/account`, `/dealer`, `/workshop`, `/mechanic` for the four public roles.

| `type` | Current `href` pattern | App destination |
| --- | --- | --- |
| `message` | `/account/messages?thread=<id>`, `/dealer/messages?thread=<id>`, `/workshop/inquiries?thread=<id>`, `/mechanic/inquiries?thread=<id>` | Conversation identified by `thread` |
| `listing_approved` | `/account/listings` or `/dealer/inventory` | Own listings |
| `listing_rejected` | Same listings paths; can have no href for report-driven removal | Own listings or notification detail |
| `listing_expired` | `/account/listings` or `/dealer/inventory` | Own listings |
| `saved_search_match` | `/listing/<slug>` | Public listing, identified by slug |
| `review_new` | `/<account base>/reviews` | Business reviews |
| `payment_approved` | `/<account base>/billing`, or `/ads` for a campaign | Read-only billing/campaign status |
| `payment_rejected` | Same as payment approval | Read-only status, no app checkout |
| `subscription_expiring` | `/<account base>/billing` | Current plan/status, no purchase links |
| `verification_result` | `/<account base>/verification` | Verification status |
| `business_status` | `/dealer`, `/workshop` or `/mechanic`; `/.../billing` for plan assignment | Business overview or current plan |
| `broadcast` | Optional owner-chosen internal path | Allowlisted app destination, otherwise notifications |

For example, `/<account base>/billing` for a dealer means `/dealer/billing`, not
`//dealer/billing`. Parse internal paths and query values with a URL parser. Never execute an
arbitrary broadcast link as a command or payment action. Unknown types, unsupported routes and
absent hrefs open notifications. Require sign-in before protected destinations, fetch fresh
server data and handle deleted resources. Push text is not authorization.

Preferences in `GET/PATCH /me/notification-prefs` control both the in-app notification and push:
`messages`, `updates`, `savedSearchMatches`, `reviews`, `billing`, `announcements`. The device
registration's locale controls push language. Use `GET /notifications` as the source of truth,
`POST /notifications/read` with `{ "ids": ["n-abc"] }` to mark opened notifications, and
`GET /me/counts` for unread counts. Offline or disabled push must not hide the inbox.

## Rate limits

All limits below are ceilings, not targets. Respect 429 and `Retry-After`. Do not assume accounts
on one carrier have different public IPs. Reads have no dedicated limit in this table.

| Operation | Per account | Shared-IP ceiling |
| --- | --- | --- |
| Start thread | 20/hour | 100/hour |
| Send message | 30/minute | 300/minute |
| Upload media | 60/hour | 300/hour |
| Submit review | 10/hour | 60/hour |
| Submit report | 10/hour | 60/hour |
| Contact form | None | 10/hour |
| Analytics events | None | 120/minute |
| Payment receipt, web only | 5/hour | 20/hour |

Auth limits are separate: sign-in endpoints 100/minute/IP, sign-up 20/10 minutes/IP, code-send
endpoints 30/10 minutes/IP and code-check endpoints 60/minute/IP. Password guesses are also
limited per email and IP to five failed attempts per 10 minutes, and per email across all IPs
to 20 failed attempts per hour. Five mailed codes per email per hour is a silent cap, described
above. Avoid automatic code resends. Limits can tighten after release; use response headers,
not hard-coded client assumptions, to schedule retries.

## No buying in the apps

Plans, Featured promotions, bumps and banner campaigns are purchased on the website only.
The apps may show an existing plan, usage, credits and review status, but must have **no buy
buttons, checkout screens or payment links**, including links hidden in push navigation. Do not
add Bankak receipt submission or call the paid create routes from the app. The API exposes them
for the web and does not enforce this store-policy rule for you. Browsing, calling, WhatsApp and
messaging sellers about vehicles remain normal marketplace features.

## Local walkthrough

Run against your own local database only. Requires this **whole repository**, Bun 1.4.2, running
Docker Desktop/Engine with Compose, `curl`, `jq` and a POSIX shell. Compose runs Postgres 18,
not the API. Keep production credentials and data out of this setup.

### 1. Start the API

From the repository root:

```sh
bun install --frozen-lockfile
cd api
cp -n .env.example .env
```

Do not overwrite an existing `.env`. For a fresh clone, set `BETTER_AUTH_SECRET` in `.env` to
the output of `openssl rand -base64 32`. Keep the example's local database URLs,
`APP_ENV=development`, `NODE_ENV=development`, `BETTER_AUTH_URL=http://localhost:4000` and
`WEB_ORIGIN=http://localhost:3000`. Leave `MIGRATE_DATABASE_URL` and service credentials blank
for the first pass. Do not use a deployed database URL.

```sh
docker compose up -d --wait
bun run db:migrate
bun run db:seed
bun run dev
```

Seed creates demo accounts and data, not a clean production install. Do not reseed to reset
existing data or run it in production; it refuses `APP_ENV=production`. Ports 5432, 5434 and
4000 must be free. Docker Desktop must be unpaused. Open `http://localhost:4000/api/docs` in a
browser to inspect the contract; the page has no request-execution buttons.

For Android Emulator, use `http://10.0.2.2:4000`; iOS Simulator uses `localhost`. A real phone
needs the laptop's LAN address and an open development firewall port. HTTP may need a
development-only Android network-security or iOS ATS exception. Never ship a cleartext exception
in production. Keep auth URLs and allowed web origin consistent when testing provider callbacks.
For seeded relative image paths, start the web server separately with `bun run --cwd web dev`
from the repo root, or use real Cloudinary images; the API does not serve `web/public`.

### 2. Sign in with a bearer token and list listings

In a second terminal, `cd api` from the repository root. Keep this shell for the following steps.
The credentials below are public demo credentials for local development only.

```sh
umask 077
BASE=http://localhost:4000/api/v1
WORK=$(mktemp -d)
curl -fsS http://localhost:4000/api/health/ready | jq -e '.ok == true'

curl -fsS -D "$WORK/login.headers" -o "$WORK/login.json" \
  -H 'Content-Type: application/json' \
  -H 'X-Platform: android' -H 'X-App-Version: 1.0.0' -H 'Accept-Language: en' \
  -d '{"email":"user@demo.sy","password":"Demo1234"}' \
  "$BASE/auth/sign-in/email"
TOKEN=$(awk 'tolower($1)=="set-auth-token:" {gsub("\r", "", $2); print $2}' "$WORK/login.headers")
test -n "$TOKEN"
curl -fsS -H "Authorization: Bearer $TOKEN" "$BASE/me" | jq -e '.id == "u-omar"'
curl -fsS "$BASE/listings?seller=u-dealer&sort=newest" -o "$WORK/listings.json"
jq -e '.items | length > 0' "$WORK/listings.json"
LISTING_ID=$(jq -er '.items[0].id' "$WORK/listings.json")
```

Expect readiness true, Omar's account and listings with `items`, `total`, `page`, `pageSize` and
`facets`. These `curl` requests never save or replay cookies. In your app, add the platform,
version and locale headers to every API request as shown in the header table.

### 3. Upload a photo, then replay it safely

This uses a small image included in the repository. You can substitute your own JPEG/PNG/WebP.

```sh
UPLOAD_KEY=$(bun -e 'console.log(crypto.randomUUID())')
curl -fsS -o "$WORK/media.json" \
  -H "Authorization: Bearer $TOKEN" -H "Idempotency-Key: $UPLOAD_KEY" \
  -F 'file=@../web/public/images/categories/cars-320.webp;type=image/webp' \
  "$BASE/uploads"
jq -e '.id and .type == "image" and .url' "$WORK/media.json"
curl -fsS -o "$WORK/media-retry.json" \
  -H "Authorization: Bearer $TOKEN" -H "Idempotency-Key: $UPLOAD_KEY" \
  -F 'file=@../web/public/images/categories/cars-320.webp;type=image/webp' \
  "$BASE/uploads"
test "$(jq -r '.id' "$WORK/media.json")" = "$(jq -r '.id' "$WORK/media-retry.json")"
```

Both uploads must return the same Media ID. Without Cloudinary, this proves the API flow, not
CDN delivery. The unattached walkthrough upload is removed by the orphan cleanup job after 24 hours.

### 4. Register for push, open a conversation and receive a reply

For an end-to-end phone check, configure `FCM_SERVICE_ACCOUNT` in the API's `.env`, restart the
API, and set `FCM_TOKEN` below to the real registration token from your app using that Firebase
project. Do not paste service-account keys in chat or put them in the app.

For a local-only first pass, leave `FCM_SERVICE_ACCOUNT` blank and use the demo token below. The
API logs `push_dev` instead of contacting FCM. That is **not** proof of a phone receiving a push.

```sh
FCM_TOKEN=local-walkthrough-token
jq -n --arg token "$FCM_TOKEN" \
  '{platform:"android",fcmToken:$token,appVersion:"1.0.0",locale:"en"}' > "$WORK/device.json"
curl -fsS -H "Authorization: Bearer $TOKEN" -H 'Content-Type: application/json' \
  --data-binary @"$WORK/device.json" "$BASE/me/devices" | jq -e '.ok == true'

THREAD_KEY=$(bun -e 'console.log(crypto.randomUUID())')
jq -n --arg id "$LISTING_ID" \
  '{subjectType:"listing",subjectId:$id,body:"Is this vehicle still available?"}' > "$WORK/thread.json"
curl -fsS -H "Authorization: Bearer $TOKEN" -H 'Content-Type: application/json' \
  -H "Idempotency-Key: $THREAD_KEY" --data-binary @"$WORK/thread.json" \
  "$BASE/threads" -o "$WORK/thread-response.json"
THREAD_ID=$(jq -er '.id' "$WORK/thread-response.json")

curl -fsS -D "$WORK/dealer.headers" -o "$WORK/dealer.json" \
  -H 'Content-Type: application/json' \
  -d '{"email":"dealer@demo.sy","password":"Demo1234"}' "$BASE/auth/sign-in/email"
DEALER_TOKEN=$(awk 'tolower($1)=="set-auth-token:" {gsub("\r", "", $2); print $2}' "$WORK/dealer.headers")
test -n "$DEALER_TOKEN"
MESSAGE_KEY=$(bun -e 'console.log(crypto.randomUUID())')
curl -fsS -H "Authorization: Bearer $DEALER_TOKEN" -H 'Content-Type: application/json' \
  -H "Idempotency-Key: $MESSAGE_KEY" -d '{"body":"Yes, it is available."}' \
  "$BASE/threads/$THREAD_ID/messages" | jq -e '.id and .threadId'
curl -fsS -H "Authorization: Bearer $TOKEN" \
  "$BASE/threads/$THREAD_ID/messages?limit=20" | jq '.items'
curl -fsS -H "Authorization: Bearer $TOKEN" "$BASE/notifications?limit=20" \
  | jq --arg href "/account/messages?thread=$THREAD_ID" \
      -e '.items[] | select(.type == "message" and .href == $href)'
```

The dealer's reply must appear in the conversation and Omar's notifications. With local push,
look for `push_dev` with `data.type=message`, `data.href=/account/messages?thread=<THREAD_ID>` and
a notification `data.id`. With real FCM, put the app in the background and confirm receipt, then
tap the notification to open this thread. Repeat on a physical iPhone after the owner's APNs
setup. If preferences were edited, enable `messages` via `PATCH /me/notification-prefs` first.

### 5. Unregister and sign out

```sh
ENCODED_TOKEN=$(jq -nr --arg token "$FCM_TOKEN" '$token | @uri')
curl -fsS -X DELETE -H "Authorization: Bearer $TOKEN" \
  "$BASE/me/devices/$ENCODED_TOKEN" | jq -e '.ok == true'
curl -fsS -X POST -H "Authorization: Bearer $TOKEN" "$BASE/auth/sign-out"
curl -fsS -X POST -H "Authorization: Bearer $DEALER_TOKEN" "$BASE/auth/sign-out"
curl -fsS -H "Authorization: Bearer $TOKEN" "$BASE/me" | jq -e '. == null'
unset TOKEN DEALER_TOKEN
```

Delete the temporary files in the directory printed by `echo "$WORK"`; they contain session
tokens. Stop the API with Ctrl+C. `docker compose stop` stops local databases without deleting
the dev volume. Do not use `down -v` unless you intend to erase that local database.

### Handoff checks

Guide validation, 2026-11-05: the commands in steps 2 to 5 passed against a separately migrated
and seeded local Postgres 18 scratch database, with the API on port 4013 and external services
disabled. The `push_dev` log matched the reply's in-app notification ID and conversation href.
The Scalar page also loaded its contract in Chromium with request controls hidden. This validates
the local fake-service path, not a fresh developer's setup or real-device push receipt.

- [ ] A new developer follows this guide from a fresh local clone without production secrets.
- [ ] Bearer sign-in, listings, photo upload and idempotent replay work.
- [ ] A message and dealer reply appear, with a matching in-app notification.
- [ ] A real Android device receives the FCM push and opens the conversation.
- [ ] A real iPhone does the same after Firebase/APNs and Apple setup.
- [ ] The owner supplies final API/web origins and resolves staging before shared app testing.

Local fake files and `push_dev` logs are useful smoke checks, not substitutes for the real-device
checks. Server tests can be run with `bun run test` from `api/` after Compose is healthy.
