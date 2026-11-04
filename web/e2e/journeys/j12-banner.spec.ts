import { expect, pick, test, visit } from "./fixtures"
import type { Locator, Page } from "@playwright/test"

type Banner = { id: string; title: string; clicks: number }

test("J12 a banner shows only in its window and placement and counts clicks", async ({
  page: admin,
  as,
  signIn,
  t,
  at,
  lang,
}) => {
  const name = "Journey banner"
  const heading = { ar: "سيارات جاهزة للبيع", en: "Cars ready to sell" }

  const fill = async (scope: Locator, label: string, value: string) =>
    scope.getByRole("textbox", { name: label, exact: true }).fill(value)
  const banners = async () =>
    (await (
      await admin.request.get("/api/admin/banners")
    ).json()) as Array<Banner>
  const ours = async () => (await banners()).find((b) => b.title === name)

  await signIn("admin")
  await visit(admin, at("/admin/banners"))
  await admin.getByRole("button", { name: t("admin.banners_new") }).click()
  const sheet = admin.getByRole("dialog")
  await sheet
    .locator("input[type=file]")
    .first()
    .setInputFiles("public/mock/banner-2.webp")
  await fill(sheet, t("admin.banners_title"), name)
  await sheet
    .getByRole("textbox", { name: /^Link|^الرابط/ })
    .fill("/search?type=car")
  await pick(
    admin,
    t("admin.banners_placement"),
    t("admin.banners_placement_directory_top")
  )
  for (const copy of ["ar", "en"] as const) {
    const group = sheet.getByRole("group", {
      name: t(`admin.banners_copy_${copy}`),
    })
    await fill(group, t("admin.banners_copy_heading"), heading[copy])
    await fill(
      group,
      t("admin.banners_copy_body"),
      "Inspected cars from trusted sellers"
    )
    await fill(group, t("admin.banners_copy_cta"), "See cars")
  }
  await sheet.getByRole("button", { name: t("common.save") }).click()
  await expect(admin.getByText(t("admin.banners_saved"))).toBeVisible()

  // A visitor sees it on the directories and not on search.
  const visitor = await as("user")
  const shown = (page: Page) =>
    page
      .getByRole("complementary", { name: t("nav.advertisement") })
      .getByText(heading[lang])
  await visit(visitor, at("/search"))
  await expect(visitor.locator("main h1")).toBeVisible()
  await expect(shown(visitor)).toHaveCount(0)
  await visit(visitor, at("/dealerships"))
  await expect(shown(visitor)).toBeVisible()

  // A click is counted and opens the link.
  const before = (await ours())!.clicks
  const counted = visitor.waitForResponse((r) =>
    r.url().endsWith("/api/events")
  )
  await shown(visitor).click()
  await counted
  await expect(visitor).toHaveURL(/\/search\?type=car/)
  await expect.poll(async () => (await ours())!.clicks).toBe(before + 1)

  // Moved to next month, it leaves the site until then.
  await visit(admin, at("/admin/banners"))
  await admin
    .getByRole("button", { name: new RegExp(name) })
    .locator("visible=true")
    .first()
    .click()
  await admin.getByRole("menuitem", { name: t("common.edit") }).click()
  const edit = admin.getByRole("dialog")
  for (const [label, months] of [
    ["admin.banners_ends", 2],
    ["admin.banners_starts", 1],
  ] as const) {
    await edit.getByRole("button", { name: t(label) }).click()
    const calendar = admin.getByRole("dialog").last()
    for (let i = 0; i < months; i++)
      await calendar.getByRole("button", { name: /next|التالي/i }).click()
    await calendar.getByRole("gridcell", { name: "28" }).first().click()
  }
  await edit.getByRole("button", { name: t("common.save") }).click()
  await expect(admin.getByText(t("admin.banners_saved"))).toBeVisible()

  await visit(visitor, at("/dealerships"))
  await expect(visitor.locator("main h1")).toBeVisible()
  await expect(shown(visitor)).toHaveCount(0)
})
