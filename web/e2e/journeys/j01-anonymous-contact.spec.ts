import { expect, readNumber, test } from "./fixtures"

// A listing of the demo dealership; it is on the first page of these results.
// Vehicle type names come from the taxonomy, not the message files.
const id = "l0000p"

test("J1 search with filters, open a listing, call and WhatsApp count in the seller's analytics @en", async ({
  page,
  t,
  at,
  as,
  lang,
}) => {
  // The seller's numbers before the visit.
  const seller = await as("dealer")
  await seller.goto(at("/dealer/analytics"))
  const stat = (key: string) =>
    seller.locator(`p:text-is("${t(key)}") + p > span.text-title`)
  await expect(stat("analytics.stat_calls")).toBeVisible()
  const calls = await readNumber(stat("analytics.stat_calls"))
  const whatsapp = await readNumber(stat("analytics.stat_whatsapp"))

  await page.goto(at(""), { waitUntil: "networkidle" })
  await page
    .locator("main form")
    .first()
    .getByRole("button", { name: t("common.search") })
    .click()
  await expect(page).toHaveURL(/\/search/)

  // Below lg the filters are in a sheet with an apply button; from lg they sit beside the results and apply as you go.
  const wide = (page.viewportSize()?.width ?? 0) >= 1024
  if (!wide)
    await page.getByRole("button", { name: t("common.filters") }).click()
  const filters = wide
    ? page.getByRole("complementary", { name: t("search.filters_title") })
    : page.getByRole("dialog")
  // Chips hide the radio itself; the label takes the click.
  await filters
    .locator("label", { hasText: lang === "ar" ? "سيارات (" : "Cars (" })
    .click()
  await filters.getByLabel(t("search.max_price")).fill("20000000")
  if (!wide) await filters.locator("button[type=submit]").click()

  // The type moves into the path (landing preset), the price stays a param.
  await expect(page).toHaveURL(/\/vehicles\/cars\/sale\?maxPrice=20000000$/)
  const url = page.url()
  await page.reload()
  expect(page.url()).toBe(url)

  // Results carry the filters after the reload.
  const card = page.locator(`main h3 a[href*="${id}"]`)
  const title = await card.innerText()
  await card.click()
  await expect(page).toHaveURL(new RegExp(`/listing/.*${id}`))
  await expect(page.locator("h1")).toHaveText(title)

  // Desktop shows the contact stack beside the gallery, mobile a fixed bar; only one is visible.
  await page
    .getByRole("button", { name: t("listing.call"), exact: true })
    .locator("visible=true")
    .first()
    .click()
  await expect(
    page
      .getByRole("link", {
        name: t("listing.call_number", { phone: "+249 91 234 5602" }),
      })
      .locator("visible=true")
  ).toHaveAttribute("href", "tel:+249912345602")

  const wa = page
    .getByRole("link", { name: t("listing.whatsapp") })
    .locator("visible=true")
    .first()
  const href = new URL((await wa.getAttribute("href")) ?? "")
  expect(href.origin + href.pathname).toBe("https://wa.me/249912345602")
  expect(href.searchParams.get("text")).toBe(
    t("listing.whatsapp_text", { title, url: page.url() })
  )
  // The click is counted; the WhatsApp tab itself is not loaded.
  await page
    .context()
    .route("https://wa.me/**", (route) => route.fulfill({ body: "" }))
  const counted = page.waitForResponse(
    (r) => r.url().endsWith("/api/events") && r.ok()
  )
  await wa.click()
  await counted

  await seller.reload()
  await expect(stat("analytics.stat_calls")).toBeVisible()
  expect(await readNumber(stat("analytics.stat_calls"))).toBe(calls + 1)
  expect(await readNumber(stat("analytics.stat_whatsapp"))).toBe(whatsapp + 1)
})
