import { z } from "zod"

const text = z.string().min(1)
const semver = z.string().regex(/^\d+\.\d+\.\d+$/)

// Third-party accounts the owner fills in over time (A14). Optional in
// development and test, required when APP_ENV is production.
const services = {
  COOKIE_DOMAIN: text,
  GOOGLE_CLIENT_ID: text,
  GOOGLE_CLIENT_SECRET: text,
  FACEBOOK_CLIENT_ID: text,
  FACEBOOK_CLIENT_SECRET: text,
  CLOUDINARY_URL: text,
  SMTP_HOST: text,
  SMTP_PORT: z.coerce.number().int().positive(),
  SMTP_SECURE: z.stringbool(),
  SMTP_USER: text,
  SMTP_PASS: text,
  MAIL_FROM: text,
  R2_ACCOUNT_ID: text,
  R2_ACCESS_KEY_ID: text,
  R2_SECRET_ACCESS_KEY: text,
  R2_BUCKET: text,
  FCM_SERVICE_ACCOUNT: text,
  APPLE_CLIENT_ID: text,
  APPLE_TEAM_ID: text,
  APPLE_KEY_ID: text,
  APPLE_PRIVATE_KEY: text,
  APPLE_APP_BUNDLE_ID: text,
}

const core = {
  NODE_ENV: z.enum(["development", "test", "production"]),
  APP_ENV: z.enum(["development", "test", "production"]),
  PORT: z.coerce.number().int().positive().default(4000),
  DATABASE_URL: z.url(),
  // Owner of the database, for `db:migrate` and `pg_restore`. When set, `DATABASE_URL` is the limited app user (10.5).
  MIGRATE_DATABASE_URL: z.url().optional(),
  TEST_DATABASE_URL: z.url().optional(),
  DB_POOL_MAX: z.coerce.number().int().positive().default(10),
  WEB_ORIGIN: z.url(),
  TRUSTED_PROXIES: z
    .string()
    .default("")
    .transform((value) =>
      value
        .split(",")
        .map((ip) => ip.trim())
        .filter(Boolean)
    ),
  BETTER_AUTH_SECRET: z.string().min(32),
  BETTER_AUTH_URL: z.url(),
  // Semver such as 1.4.0 (A18 426 gate).
  MIN_APP_VERSION_IOS: semver.optional(),
  MIN_APP_VERSION_ANDROID: semver.optional(),
  // Put in front of `pg_dump` and `pg_restore` (8.11); development runs a version 18 image, production leaves it blank.
  PG_CLIENT_CMD: z.string().optional(),
  LOG_LEVEL: z.enum(["debug", "info", "warn", "error"]).default("info"),
  // One info line per request (10.4); `false` silences it, tests do.
  LOG_REQUESTS: z.stringbool().default(true),
  // The platform admin endpoint (8.12) is off while either is blank. The inbox gets the confirm
  // codes, so a lost admin mailbox can still be fixed.
  ADMIN_SECRET_KEY: z.string().min(32).optional(),
  ADMIN_RECOVERY_EMAIL: z.email().optional(),
}

const devSchema = z.object({ ...core, ...z.object(services).partial().shape })
const prodSchema = z.object({ ...core, ...services })

export type Env = z.infer<typeof devSchema>

// A blank line in .env (`SMTP_HOST=`) counts as not set.
const source = Object.fromEntries(
  Object.entries(process.env).filter(([, value]) => value !== "")
)
const schema = source.APP_ENV === "production" ? prodSchema : devSchema
const result = schema.safeParse(source)

if (!result.success) {
  const lines = result.error.issues.map(
    (issue) => `- ${issue.path.join(".")}: ${issue.message}`
  )
  process.stderr.write(`Missing or invalid env:\n${lines.join("\n")}\n`)
  process.exit(1)
}

export const env: Env = result.data
