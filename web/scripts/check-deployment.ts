import process from "node:process"
import { siteSchema } from "@sayaratak/shared/schemas/responses"
import { taxonomySchema } from "@sayaratak/shared/schemas/taxonomy"
import { z } from "zod"

const readinessSchema = z.object({
  ok: z.literal(true),
  checks: z.object({
    database: z.literal("ok"),
    migrations: z.literal("ok"),
    smtp: z.enum(["ok", "off"]),
    jobs: z.literal("ok"),
  }),
})
const REQUEST_TIMEOUT_MS = 120_000

/** Reads public pages and API contracts without cookies, redirects or mutations. */
export async function checkDeployment(
  webOrigin: string,
  apiOrigin: string,
  fetchImpl: typeof fetch = fetch
): Promise<boolean> {
  if (![webOrigin, apiOrigin].every(isOrigin)) {
    process.stdout.write("origins invalid\n")
    return false
  }
  const checks = [
    ...["ar", "en"].map((locale) => ({
      name: "homepage",
      url: `${webOrigin}/${locale}`,
      validate: async (response: Response) =>
        response.headers.get("content-type")?.includes("text/html") === true &&
        new RegExp(`<html\\b[^>]*lang=["']${locale}["']`).test(
          await response.text()
        ),
    })),
    ...[webOrigin, apiOrigin].flatMap((origin) =>
      [
        { name: "site", schema: siteSchema },
        { name: "taxonomy", schema: taxonomySchema },
        { name: "me", schema: z.null() },
      ].map(({ name, schema }) => ({
        name,
        url: `${origin}/api/v1/${name}`,
        validate: (response: Response) => jsonMatches(response, schema),
      }))
    ),
    {
      name: "readiness",
      url: `${apiOrigin}/api/health/ready`,
      validate: (response: Response) => jsonMatches(response, readinessSchema),
    },
  ]
  let passed = true
  for (const check of checks) {
    let status = 0
    let valid = false
    try {
      const response = await fetchImpl(check.url, {
        method: "GET",
        redirect: "manual",
        credentials: "omit",
        signal: AbortSignal.timeout(REQUEST_TIMEOUT_MS),
      })
      status = response.status
      valid = status === 200 && (await check.validate(response))
    } catch {
      // Never print upstream bodies, cookie values or exception details.
      valid = false
    }
    passed = passed && valid
    process.stdout.write(
      `${new URL(check.url).pathname} ${status} ${check.name} ${valid ? "pass" : "fail"}\n`
    )
  }
  return passed
}

function isOrigin(value: string) {
  if (!URL.canParse(value)) return false
  const url = new URL(value)
  return ["http:", "https:"].includes(url.protocol) && value === url.origin
}

async function jsonMatches(response: Response, schema: z.ZodType) {
  if (!response.headers.get("content-type")?.includes("application/json"))
    return false
  return schema.safeParse(await response.json()).success
}

if (import.meta.main) {
  const [webOrigin, apiOrigin, extra] = process.argv.slice(2)
  if (!webOrigin || !apiOrigin || extra) {
    process.stderr.write(
      "usage: check-deployment.ts <website-origin> <api-origin>\n"
    )
    process.exitCode = 1
  } else {
    process.exitCode = (await checkDeployment(webOrigin, apiOrigin)) ? 0 : 1
  }
}
