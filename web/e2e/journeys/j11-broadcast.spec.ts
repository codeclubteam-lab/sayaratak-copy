import { expect, khartoum, pick, test, visit } from "./fixtures"

test("J11 broadcast to dealerships in one city reaches only them, in their language", async ({
  page: admin,
  as,
  signIn,
  t,
  at,
  lang,
}) => {
  const title = {
    ar: "تحديث مهم للمعارض",
    en: "Important update for showrooms",
  }
  const body = {
    ar: "سنراجع الإعلانات القديمة هذا الأسبوع.",
    en: "We will review old listings this week.",
  }

  await signIn("admin")
  await visit(admin, at("/admin/broadcasts"))
  const form = admin.locator("main")
  await form.getByLabel(t("admin.broadcast_title_ar")).fill(title.ar)
  await form.getByLabel(t("admin.broadcast_body_ar")).fill(body.ar)
  await form.getByLabel(t("admin.broadcast_title_en")).fill(title.en)
  await form.getByLabel(t("admin.broadcast_body_en")).fill(body.en)
  for (const role of ["user", "workshop", "mechanic"])
    await form
      .locator("label")
      .filter({
        has: admin.getByRole("checkbox", {
          name: t(`admin.broadcast_role_${role}`),
          exact: true,
        }),
      })
      .click()
  await pick(admin, t("admin.broadcast_city"), khartoum[lang])
  await form.getByRole("button", { name: t("admin.broadcast_send") }).click()
  const sent = admin.waitForResponse(
    (r) =>
      r.url().includes("/api/admin/broadcasts") &&
      r.request().method() === "POST"
  )
  await admin
    .getByRole("alertdialog")
    .getByRole("button", { name: t("admin.broadcast_send") })
    .click()
  expect((await sent).ok()).toBe(true)
  // The bells ring in the background; the history follows the broadcast until it says Sent.
  await expect(
    admin
      .getByRole("table")
      .getByText(t("admin.broadcast_status_sent"), { exact: true })
  ).toBeVisible({ timeout: 15_000 })

  // The Khartoum dealership reads it in the language it is using.
  const other = lang === "ar" ? "en" : "ar"
  const dealer = await as("dealer")
  await visit(dealer, at("/dealer/notifications"))
  await expect(dealer.locator("main").getByText(title[lang])).toBeVisible()
  await expect(dealer.locator("main").getByText(body[lang])).toBeVisible()
  await expect(dealer.locator("main").getByText(title[other])).toHaveCount(0)

  // A workshop and a user are left out.
  for (const [role, path] of [
    ["workshop", "/workshop/notifications"],
    ["user", "/account/notifications"],
  ] as const) {
    const page = await as(role)
    await visit(page, at(path))
    await expect(page.locator("main h1")).toBeVisible()
    await expect(page.locator("main").getByText(title[lang])).toHaveCount(0)
  }
})
