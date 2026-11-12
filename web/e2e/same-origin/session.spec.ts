import { spawnSync } from "node:child_process"
import { readFileSync } from "node:fs"
import process from "node:process"
import { expect, test } from "@playwright/test"
import type { Page } from "@playwright/test"
import { z } from "zod"

import { text } from "../journeys/fixtures"

const upstream = "http://127.0.0.1:4000"
const visitor = { "cf-connecting-ip": "192.0.2.31" }
const listing = "/listing/chevrolet-cruze-2014-single-owner-khartoum-l0000p"
const locales: Array<"ar" | "en"> = ["ar", "en"]

function localDatabase() {
  const value = process.env.DATABASE_URL ?? ""
  const url = new URL(value)
  if (
    !["postgres:", "postgresql:"].includes(url.protocol) ||
    !["localhost", "127.0.0.1", "[::1]"].includes(url.hostname) ||
    url.port !== "5434" ||
    url.pathname !== "/sayaratak" ||
    url.search ||
    url.hash
  )
    throw new Error(
      "same-origin fixtures require local postgres-test on port 5434"
    )
  return value
}

function databaseRows(query: string): unknown {
  const databaseUrl = localDatabase()
  const run = spawnSync(
    "bun",
    [
      "--no-env-file",
      "-e",
      `
    const sql = new Bun.SQL(process.env.DATABASE_URL);
    try { process.stdout.write(JSON.stringify(await sql.unsafe(${JSON.stringify(query)}))); }
    finally { await sql.close(); }
  `,
    ],
    {
      env: { PATH: process.env.PATH, DATABASE_URL: databaseUrl },
      encoding: "utf8",
      timeout: 30_000,
    }
  )
  expect(run.status, "local test DB command").toBe(0)
  return JSON.parse(run.stdout)
}

async function browserJson(page: Page, path: string, body?: object) {
  return page.evaluate(
    async ({ path, body }) => {
      const response = await fetch(
        `/api/v1${path}`,
        body
          ? {
              method: "POST",
              headers: { "content-type": "application/json" },
              body: JSON.stringify(body),
            }
          : undefined
      )
      return { status: response.status, body: await response.json() }
    },
    { path, body }
  )
}

async function login(page: Page, lang: "ar" | "en") {
  await page.goto(`/${lang}/auth/login`)
  await page.getByLabel(text(lang, "auth.email_label")).fill("user@demo.sy")
  await page
    .getByLabel(text(lang, "auth.password_label"), { exact: true })
    .fill("Demo1234")
  const signed = page.waitForResponse(
    (r) => r.url().endsWith("/auth/sign-in/email") && r.ok()
  )
  await page
    .getByRole("button", { name: text(lang, "auth.login_submit"), exact: true })
    .click()
  return signed
}

function expectCookieAttributes(
  value: string,
  secure: boolean,
  deleted = false
) {
  // Assert booleans so a failed security check never prints the cookie's value.
  expect(/; HttpOnly/i.test(value), "HttpOnly").toBe(true)
  expect(/; SameSite=Lax/i.test(value), "SameSite=Lax").toBe(true)
  expect(/; Path=\/(?:;|$)/i.test(value), "Path=/").toBe(true)
  expect(/; Domain=/i.test(value), "host-only").toBe(false)
  expect(/; Secure(?:;|$)/i.test(value), "HTTPS Secure").toBe(secure)
  if (deleted) expect(/; Max-Age=0/i.test(value), "logout expiry").toBe(true)
}

test.beforeEach(async ({ page }) => {
  localDatabase()
  const reset = await fetch(`${upstream}/api/_test/reset`, {
    method: "POST",
    headers: visitor,
  })
  expect(reset.status).toBe(200)
  const cdp = await page.context().newCDPSession(page)
  await cdp.send("Network.enable")
  // Installed Chrome still requires the two exception flags removed from newer protocol types.
  const controls = {
    enableThirdPartyCookieRestriction: true,
    disableThirdPartyCookieMetadata: true,
    disableThirdPartyCookieHeuristics: true,
  }
  await cdp.send("Network.setCookieControls", controls)
})

for (const lang of locales) {
  test(`${lang} signup, inbox verification, login, reload, locale, gate, logout and expiry`, async ({
    page,
    context,
    baseURL,
  }) => {
    const requests: string[] = []
    page.on("request", (request) => {
      if (new URL(request.url()).pathname.startsWith("/api/"))
        requests.push(request.url())
    })
    await page.goto(`/${lang}`)
    await expect(page.locator("html")).toHaveAttribute(
      "dir",
      lang === "ar" ? "rtl" : "ltr"
    )
    await page.goto(`/${lang}/auth/signup`)
    const email = `${lang}@same-origin.test`
    await page
      .getByLabel(text(lang, "auth.full_name_label"))
      .fill("Local Browser")
    await page.getByLabel(text(lang, "auth.email_label")).fill(email)
    await page
      .getByLabel(text(lang, "auth.password_label"), { exact: true })
      .fill("Journey1234")
    await page
      .getByLabel(text(lang, "auth.confirm_password_label"))
      .fill("Journey1234")
    await page.getByRole("checkbox").click()
    const signup = page.waitForResponse(
      (r) => r.url().endsWith("/auth/sign-up/email") && r.ok()
    )
    await page
      .getByRole("button", { name: text(lang, "auth.create_account") })
      .click()
    await signup
    const inbox = await fetch(
      `${upstream}/api/_test/otp?email=${encodeURIComponent(email)}&template=email-verification`,
      { headers: visitor }
    )
    expect(inbox.status).toBe(200)
    const { code } = z.object({ code: z.string() }).parse(await inbox.json())
    await page.getByLabel(text(lang, "auth.otp_label")).fill(code)
    await expect(
      page.getByText(text(lang, "auth.verified_title"))
    ).toBeVisible()
    expect((await browserJson(page, "/me")).body).toMatchObject({
      email,
      verifiedEmail: true,
    })
    expect((await browserJson(page, "/auth/sign-out", {})).status).toBe(200)

    const signed = await login(page, lang)
    const secure = baseURL!.startsWith("https:")
    const sessionName = `${secure ? "__Secure-" : ""}sy.session_token`
    const setCookies = (await signed.headersArray()).filter(
      ({ name }) => name.toLowerCase() === "set-cookie"
    )
    expect(
      setCookies.some(({ value }) => value.startsWith(`${sessionName}=`))
    ).toBe(true)
    for (const { value } of setCookies) {
      expectCookieAttributes(value, secure)
    }
    const cookie = (await context.cookies(baseURL)).find(
      ({ name }) => name === sessionName
    )
    expect(
      cookie && {
        domain: cookie.domain,
        path: cookie.path,
        httpOnly: cookie.httpOnly,
        secure: cookie.secure,
        sameSite: cookie.sameSite,
      }
    ).toEqual({
      domain: "localhost",
      path: "/",
      httpOnly: true,
      secure,
      sameSite: "Lax",
    })
    expect(
      await page.evaluate((name) => document.cookie.includes(name), sessionName)
    ).toBe(false)
    await page.goto(`/${lang}${listing}`)
    const heart = page
      .locator("main")
      .getByRole("button", { name: text(lang, "listing.favorite_add") })
      .first()
    await heart.click()
    await expect(heart).toHaveAttribute("aria-pressed", "true")
    await page.reload()
    expect((await browserJson(page, "/me")).body).toMatchObject({
      id: "u-omar",
    })
    const other = lang === "ar" ? "en" : "ar"
    await page
      .getByRole("link", {
        name: other === "ar" ? "العربية" : "English",
        exact: true,
      })
      .first()
      .click()
    await expect(page).toHaveURL(new RegExp(`/${other}/listing/`))
    expect((await browserJson(page, "/me")).body).toMatchObject({
      id: "u-omar",
    })
    const observations = readFileSync(
      process.env.SAME_ORIGIN_OBSERVATIONS!,
      "utf8"
    )
      .trim()
      .split("\n")
      .map((line) =>
        z
          .object({
            ip: z.string().nullable(),
            userId: z.string().nullable(),
            ssr: z.boolean(),
          })
          .parse(JSON.parse(line))
      )
    expect(
      observations.filter(
        (row) =>
          row.ssr &&
          row.ip === visitor["cf-connecting-ip"] &&
          row.userId === "u-omar"
      ).length
    ).toBeGreaterThanOrEqual(3)

    await page
      .getByRole("button", { name: text(other, "nav.account"), exact: true })
      .click()
    const logout = page.waitForResponse(
      (r) => r.url().endsWith("/auth/sign-out") && r.ok()
    )
    await page
      .getByRole("menuitem", { name: text(other, "common.sign_out") })
      .click()
    const deleted = (await (await logout).headersArray()).filter(
      ({ name }) => name.toLowerCase() === "set-cookie"
    )
    expect(
      deleted.some(({ value }) => value.startsWith(`${sessionName}=`))
    ).toBe(true)
    for (const { value } of deleted) {
      expectCookieAttributes(value, secure, true)
    }
    await page.reload()
    expect((await browserJson(page, "/me")).body).toBeNull()
    expect(
      (await context.cookies(baseURL)).some(({ name }) => name === sessionName)
    ).toBe(false)
    await page.goto(`/${lang}${listing}`)
    await page
      .locator("main")
      .getByRole("button", { name: text(lang, "listing.favorite_add") })
      .first()
      .click()
    await expect(page.getByRole("dialog")).toBeVisible()
    await login(page, lang)
    // Only the local test session is expired; no application/test endpoint is added.
    databaseRows(
      "update session set expires_at = now() - interval '1 minute' where user_id = 'u-omar' returning id"
    )
    await page.goto(`/${lang}/account/favorites`)
    await expect(page).toHaveURL(new RegExp(`/${lang}/auth/login`))
    expect((await browserJson(page, "/me")).body).toBeNull()
    expect(requests.length).toBeGreaterThan(5)
    expect(requests.every((url) => new URL(url).origin === baseURL)).toBe(true)
  })
}

test("multipart bytes and private receipt owner/other authorization through the website", async ({
  page,
  context,
}) => {
  await page.goto("/en")
  expect(
    (
      await browserJson(page, "/auth/sign-in/email", {
        email: "user@demo.sy",
        password: "Demo1234",
      })
    ).status
  ).toBe(200)
  const uploaded = await page.evaluate(async () => {
    const bytes = new Uint8Array(64)
    bytes.set([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a])
    const form = new FormData()
    form.set("file", new File([bytes], "local.png", { type: "image/png" }))
    const response = await fetch("/api/v1/uploads", {
      method: "POST",
      body: form,
    })
    return { status: response.status, body: await response.json() }
  })
  expect(uploaded.status).toBe(201)
  expect(uploaded.body).toMatchObject({
    type: "image",
    width: 1200,
    height: 800,
  })
  const [receipt] = z
    .array(z.object({ id: z.string(), email: z.string() }))
    .parse(
      databaseRows(
        `select uploads.id, "user".email from uploads join "user" on "user".id = uploads.owner_user_id where uploads.kind = 'receipt' and "user".email in ('user@demo.sy', 'dealer@demo.sy', 'workshop@demo.sy', 'mechanic@demo.sy') limit 1`
      )
    )
  expect(receipt).toBeDefined()
  expect(
    (
      await browserJson(page, "/auth/sign-in/email", {
        email: receipt!.email,
        password: "Demo1234",
      })
    ).status
  ).toBe(200)
  const owned = await page.evaluate(async (id) => {
    const response = await fetch(`/api/v1/uploads/${id}`)
    return {
      status: response.status,
      bytes: (await response.arrayBuffer()).byteLength,
      cache: response.headers.get("cache-control"),
    }
  }, receipt!.id)
  expect(owned).toMatchObject({ status: 200, cache: "private, no-store" })
  expect(owned.bytes).toBeGreaterThan(0)
  await context.clearCookies()
  const email =
    receipt!.email === "user@demo.sy" ? "workshop@demo.sy" : "user@demo.sy"
  expect(
    (
      await browserJson(page, "/auth/sign-in/email", {
        email,
        password: "Demo1234",
      })
    ).status
  ).toBe(200)
  expect((await browserJson(page, `/uploads/${receipt!.id}`)).status).toBe(404)
})

test("signed proxy/SSR IPs, distinct visitor buckets, forged assertions and native bearer stay isolated", async ({
  page,
  context,
  request,
}) => {
  await page.goto("/en")
  for (let attempt = 0; attempt < 11; attempt++) {
    expect((await browserJson(page, "/contact", {})).status).toBe(
      attempt === 10 ? 429 : 422
    )
  }
  await context.setExtraHTTPHeaders({
    "cf-connecting-ip": "192.0.2.32",
    "x-forwarded-for": "6.6.6.6",
    "x-sy-proxy-ip": "6.6.6.6",
    "x-sy-proxy-signature": "forged",
  })
  expect((await browserJson(page, "/contact", {})).status).toBe(422)
  expect(
    (
      await browserJson(page, "/auth/sign-in/email", {
        email: "user@demo.sy",
        password: "Demo1234",
      })
    ).status
  ).toBe(200)
  expect(
    databaseRows(
      "select ip_address from session where user_id = 'u-omar' order by created_at desc limit 1"
    )
  ).toEqual([{ ip_address: "192.0.2.32" }])
  // APIRequestContext sends native HTTP without Node fetch's synthetic Sec-Fetch-Mode.
  const native = await request.post(`${upstream}/api/v1/auth/sign-in/email`, {
    headers: {
      "cf-connecting-ip": "192.0.2.33",
      "content-type": "application/json",
      "x-platform": "ios",
      "x-app-version": "1.0.0",
    },
    data: { email: "user@demo.sy", password: "Demo1234" },
  })
  expect(native.status()).toBe(200)
  const { token } = z.object({ token: z.string() }).parse(await native.json())
  // A separate transport has no login cookie jar: identity must come from the bearer alone.
  const me = await fetch(`${upstream}/api/v1/me`, {
    headers: {
      "cf-connecting-ip": "192.0.2.33",
      authorization: `Bearer ${token}`,
    },
  })
  expect(await me.json()).toMatchObject({ id: "u-omar" })
  expect(
    databaseRows(
      "select ip_address from session where user_id = 'u-omar' order by created_at desc limit 1"
    )
  ).toEqual([{ ip_address: "192.0.2.33" }])
  const forged = await fetch(`${upstream}/api/v1/me`, {
    headers: {
      ...visitor,
      "x-sy-proxy-ip": "6.6.6.6",
      "x-sy-proxy-signature": "forged",
    },
  })
  expect(forged.status).toBe(403)
})

test("controlled Google state/cookies return through the website callback", async ({
  page,
  context,
  baseURL,
}) => {
  await page.route("https://accounts.google.com/**", async (route) => {
    const target = new URL(route.request().url())
    expect(target.searchParams.get("redirect_uri")).toBe(
      `${baseURL}/api/v1/auth/callback/google`
    )
    const callback = new URL(`${baseURL}/api/v1/auth/callback/google`)
    callback.searchParams.set("code", "local-provider-code")
    callback.searchParams.set("state", target.searchParams.get("state") ?? "")
    await route.fulfill({
      contentType: "text/html",
      body: `<a href="${callback.href.replaceAll("&", "&amp;")}">Approve local provider</a>`,
    })
  })
  // This page settles after hydration; clicking SSR markup can otherwise lose the event.
  await page.goto("/en/auth/login", { waitUntil: "networkidle" })
  const started = page.waitForResponse((response) =>
    response.url().endsWith("/api/v1/auth/sign-in/social")
  )
  await page
    .getByRole("button", { name: text("en", "auth.continue_google") })
    .click()
  expect((await started).status()).toBe(200)
  await expect(
    page.getByRole("link", { name: "Approve local provider" })
  ).toBeVisible()
  const stateCookies = (await context.cookies(baseURL)).filter(({ name }) =>
    name.endsWith("sy.state")
  )
  expect(stateCookies.length).toBeGreaterThan(0)
  await page.getByRole("link", { name: "Approve local provider" }).click()
  await expect(page).toHaveURL(new RegExp(`^${baseURL}/en/`))
  expect((await browserJson(page, "/me")).body).toMatchObject({
    email: "oauth@same-origin.test",
    verifiedEmail: true,
  })
  await page.reload()
  expect((await browserJson(page, "/me")).body).toMatchObject({
    email: "oauth@same-origin.test",
  })
})
