import { betterAuth } from "better-auth"
import { drizzleAdapter } from "better-auth/adapters/drizzle"
import { admin, bearer, emailOTP, twoFactor } from "better-auth/plugins"
import { createAuthMiddleware } from "better-auth/api"

import { env } from "~/env"
import { db } from "~/shared/db/client"
import { ALL_PREFS } from "~/shared/db/defaults"
import * as schema from "~/shared/db/schema"
import { send } from "~/shared/mail/send"

import {
  ADMIN_CODE_PATH,
  adminCodeAfter,
  adminCodeBefore,
} from "./auth.admin.service"
import { authAfter, authBefore, CLIENT_IP_HEADER } from "./auth.guard.service"
import { mailCode } from "./auth.mail.service"
import { hasApple, socialProviders } from "./auth.social.service"

// 600 s and 5 tries: the web code step says "10 minutes" and "5 tries";
// Better-Auth's defaults are 300 and 3.
const OTP_SECONDS = 600
const OTP_TRIES = 5
// Per-IP ceilings (owner, 3.6). Loose on purpose: whole mobile carriers share
// a few IPs (A12), so these only stop one machine flooding a route. The real
// guards are per email: the sign-in throttle in auth.guard.service.ts and the
// 5 codes an hour cap in send.ts. Windows in seconds.
const SIGN_IN_PER_IP = { window: 60, max: 100 }
const SIGN_UP_PER_IP = { window: 600, max: 20 }
const CODE_SEND_PER_IP = { window: 600, max: 30 }
const CODE_CHECK_PER_IP = { window: 60, max: 60 }
// A6: 60 days, extended once a day on use.
const SESSION_SECONDS = 60 * 24 * 3600
const SESSION_REFRESH_SECONDS = 24 * 3600

const isProduction = env.APP_ENV === "production"

// Apple answers the web redirect with a form POST from its own origin.
const APPLE_ORIGIN = "https://appleid.apple.com"

/**
 * The one Better-Auth instance (A6), served under /api/v1/auth/* by
 * auth.routes.ts.
 *
 * Regenerate the tables after changing fields or plugins:
 * `bunx --bun auth@1.7.10 generate --config src/modules/auth/auth.config.ts --output src/modules/auth/auth.tables.ts`,
 * then put back the hand edits listed at the top of auth.tables.ts.
 */
export const auth = betterAuth({
  basePath: "/api/v1/auth",
  secret: env.BETTER_AUTH_SECRET,
  baseURL: env.BETTER_AUTH_URL,
  database: drizzleAdapter(db, { provider: "pg", schema }),
  trustedOrigins: [
    new URL(env.WEB_ORIGIN).origin,
    ...(hasApple ? [APPLE_ORIGIN] : []),
  ],
  // Admin plugin HTTP routes we never expose; our admin routes call auth.api.* (A6).
  disabledPaths: [
    "/admin/impersonate-user",
    "/admin/stop-impersonating",
    "/admin/set-role",
    "/admin/create-user",
    "/admin/remove-user",
    "/admin/set-user-password",
    "/admin/update-user",
    // Two-factor is the admin email code only (3.7): no authenticator app or
    // backup codes, and nobody switches it on or off over HTTP (create-admin
    // and the seed do), so an admin cannot drop the code step.
    "/two-factor/enable",
    "/two-factor/disable",
    "/two-factor/get-totp-uri",
    "/two-factor/verify-totp",
    "/two-factor/generate-backup-codes",
    "/two-factor/verify-backup-code",
  ],
  emailAndPassword: {
    enabled: true,
    requireEmailVerification: true,
    minPasswordLength: 8,
    maxPasswordLength: 128,
    revokeSessionsOnPasswordReset: true,
  },
  emailVerification: { autoSignInAfterVerification: true },
  // Better-Auth links a provider to an existing account only when the
  // provider says the email is verified and ours is verified too (A6); new
  // accounts get role `user` and onboarding not done from the field defaults.
  // Apps post the platform SDK's token to /sign-in/social as `idToken` (A18):
  // Google and Apple ID tokens, Facebook's Limited Login token or access token.
  socialProviders,
  session: {
    expiresIn: SESSION_SECONDS,
    updateAge: SESSION_REFRESH_SECONDS,
  },
  user: {
    additionalFields: {
      phone: { type: "string", required: false },
      verifiedPhone: { type: "boolean", defaultValue: false, input: false },
      avatarUploadId: { type: "string", required: false, input: false },
      cityId: { type: "string", required: false, input: false },
      locale: { type: "string", defaultValue: "ar", input: false },
      onboardingDone: { type: "boolean", defaultValue: false, input: false },
      interests: { type: "string[]", defaultValue: [], input: false },
      prefs: { type: "json", defaultValue: ALL_PREFS, input: false },
      chosenPlanId: { type: "string", required: false, input: false },
    },
  },
  advanced: {
    cookiePrefix: "sy",
    useSecureCookies: isProduction,
    defaultCookieAttributes: { sameSite: "lax", httpOnly: true },
    crossSubDomainCookies: {
      enabled: Boolean(env.COOKIE_DOMAIN),
      domain: env.COOKIE_DOMAIN,
    },
    // Better-Auth reads only our header, which carries the A3 client IP, so a
    // forged X-Forwarded-For cannot dodge its limits.
    ipAddress: { ipAddressHeaders: [CLIENT_IP_HEADER] },
    // Better-Auth switches its Origin and callbackURL checks off when
    // NODE_ENV is "test". Stating `false` keeps production's behaviour in
    // tests too, so auth.origin.test.ts proves `trustedOrigins` (A12).
    disableOriginCheck: false,
  },
  rateLimit: {
    enabled: true,
    storage: "database",
    customRules: {
      "/sign-in/*": SIGN_IN_PER_IP,
      "/sign-up/*": SIGN_UP_PER_IP,
      "/email-otp/send-verification-otp": CODE_SEND_PER_IP,
      "/email-otp/request-password-reset": CODE_SEND_PER_IP,
      "/email-otp/request-email-change": CODE_SEND_PER_IP,
      "/email-otp/verify-email": CODE_CHECK_PER_IP,
      "/email-otp/check-verification-otp": CODE_CHECK_PER_IP,
      "/email-otp/reset-password": CODE_CHECK_PER_IP,
      "/email-otp/change-email": CODE_CHECK_PER_IP,
      "/two-factor/send-otp": CODE_SEND_PER_IP,
      "/two-factor/verify-otp": CODE_CHECK_PER_IP,
    },
  },
  hooks: {
    before: createAuthMiddleware((ctx) =>
      ctx.path === ADMIN_CODE_PATH ? adminCodeBefore(ctx) : authBefore(ctx)
    ),
    after: createAuthMiddleware((ctx) =>
      ctx.path === ADMIN_CODE_PATH
        ? adminCodeAfter(ctx)
        : authAfter({ ...ctx, returned: ctx.context.returned })
    ),
  },
  plugins: [
    emailOTP({
      otpLength: 6,
      expiresIn: OTP_SECONDS,
      allowedAttempts: OTP_TRIES,
      sendVerificationOnSignUp: true,
      overrideDefaultEmailVerification: true,
      // Sign-up needs a name and password (/sign-up/email); a code alone
      // never creates an account.
      disableSignUp: true,
      // PATCH /me checks the code sent to a new address (3.5).
      changeEmail: { enabled: true },
      // A database dump never holds a live code (A9).
      storeOTP: "hashed",
      // Not awaited (A6): the answer time must not tell whether the email exists.
      sendVerificationOTP: async (mail, ctx) => {
        mailCode(mail, ctx?.request)
      },
    }),
    twoFactor({
      totpOptions: { disable: true },
      otpOptions: {
        sendOTP: async ({ user, otp }) => {
          send.adminCode(user, otp)
        },
      },
    }),
    admin({ defaultRole: "user", adminRoles: ["admin"] }),
    bearer(),
  ],
})
