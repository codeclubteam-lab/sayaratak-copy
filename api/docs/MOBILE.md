# Sayaratak API for the mobile apps

Guide for the iOS and Android developer. Step 10.9 completes it (headers, errors, pagination, uploads, push, local setup). This first part covers sign-in (step 3.8).

All paths are under `/api/v1`. Better-Auth answers every `/api/v1/auth/*` route and documents them itself; `openapi.json` covers the rest.

## Sessions with a bearer token

Apps never use cookies. Every sign-in answer carries the session token in the `set-auth-token` response header. Store it in the Keychain (iOS) or Keystore (Android) and send it on every request:

```
Authorization: Bearer <token>
```

- A session lasts 60 days and is extended on use (at most once a day).
- No `Origin` header is needed. The CSRF check only applies to browser cookie requests.
- A banned account gets `403 { "code": "banned" }` on every route that needs a signed-in user.
- `/api/v1/admin/*` always answers `403 forbidden` to a bearer token. Admin work happens on the website only.

## Email and password

```
POST /api/v1/auth/sign-in/email   { "email": "...", "password": "..." }
-> 200, header set-auth-token: <token>

GET /api/v1/me    Authorization: Bearer <token>
-> the account (userSchema), or null when the token is not valid
```

Sign-up (`/auth/sign-up/email`) mails a 6-digit code. The account gets a session only after `/auth/email-otp/verify-email` with that code. Five wrong passwords from one IP within 10 minutes answer `429 { "code": "too_many_attempts", "retryAfter": <seconds> }`.

## Native Google, Apple and Facebook sign-in

Use the platform SDK, then post its token to Better-Auth. There is no browser redirect.

```
POST /api/v1/auth/sign-in/social
{ "provider": "google" | "apple" | "facebook", "idToken": { ... } }
-> 200 { "token": "...", "user": { ... } }, header set-auth-token: <token>
```

| Provider | `idToken` body | Checked against |
|---|---|---|
| Google | `{ "token": "<Google ID token>" }` | Google's keys, issuer, and audience = the Google client id configured on the API |
| Apple | `{ "token": "<identityToken>", "user": { "name": { "firstName", "lastName" } } }`. Apple sends the name only on the first sign-in, so pass it then | Apple's keys, issuer, and audience = the app's bundle id (or the web Services ID) |
| Facebook | Limited Login (iOS): `{ "token": "<authentication token JWT>" }`. Classic login: `{ "token": "<access token>", "accessToken": "<access token>" }` | The JWT against Facebook's keys and app id; an access token through Graph `debug_token`, which must name our app |

An optional `nonce` in `idToken` is compared with the token's `nonce` claim (Apple accepts the raw nonce or its SHA-256). A token that fails any check answers `401`.

A new account starts with role `user` and onboarding not done. A provider account is linked to an existing account only when the provider says the email is verified. A Facebook account without an email gets a placeholder address and `/me` leaves `email` out; ask the user to add one.

Open items:

- Apple sign-in is off until the owner creates the Apple Developer account and fills the five `APPLE_*` values (task T10).
- The API checks Google ID tokens against one client id (`GOOGLE_CLIENT_ID`). On Android, request the ID token for that web client id (`serverClientId`). iOS ID tokens carry the iOS client id; the API must list it once the app's Google clients exist.

## Signing out

`POST /api/v1/auth/sign-out` with the bearer header ends the session.
