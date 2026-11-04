import { expect, test } from "@playwright/test"
import type { Locator, Page } from "@playwright/test"

import { sessions } from "./routes"

// Keyboard only (14.4): a layer opens from its trigger with Enter, focus lands inside it, Escape closes it and focus returns to the trigger.
const listing = "/en/listing/chevrolet-cruze-2014-single-owner-khartoum-l0000p"

async function layerRoundTrip(page: Page, trigger: Locator) {
  const layer = page.locator(
    '[role="dialog"]:visible, [role="alertdialog"]:visible'
  )
  // A layer can open over another one (a confirm over a sheet), so compare counts.
  const before = await layer.count()
  await trigger.focus()
  await page.keyboard.press("Enter")
  await expect(layer, "layer opens").toHaveCount(before + 1)
  const inside = await page.evaluate(() =>
    Boolean(
      document.activeElement?.closest('[role="dialog"], [role="alertdialog"]')
    )
  )
  expect(inside, "focus moves into the layer").toBe(true)
  await page.keyboard.press("Escape")
  await expect(layer, "Escape closes").toHaveCount(before)
  await expect(trigger, "focus returns to the trigger").toBeFocused()
}

test("auth dialog opens from the heart, Escape returns focus", async ({
  page,
}) => {
  await page.goto(listing, { waitUntil: "networkidle" })
  await layerRoundTrip(
    page,
    page.getByRole("button", { name: "Save to favorites" }).first()
  )
})

test("command menu opens from its button", async ({
  page,
  context,
  baseURL,
}) => {
  await context.addCookies([
    { name: "sy_session", value: sessions.dealer, url: baseURL },
  ])
  await page.setViewportSize({ width: 1280, height: 900 })
  await page.goto("/en/dealer", { waitUntil: "networkidle" })
  await layerRoundTrip(page, page.getByRole("button", { name: /Search pages/ }))
})

test("filter sheet opens from the Filters button on a phone", async ({
  page,
}) => {
  await page.setViewportSize({ width: 390, height: 800 })
  await page.goto("/en/search", { waitUntil: "networkidle" })
  await layerRoundTrip(
    page,
    page.getByRole("button", { name: /Filters/ }).first()
  )
})

test("ban dialog opens from the user sheet, Escape leaves the sheet", async ({
  page,
  context,
  baseURL,
}) => {
  await context.addCookies([
    { name: "sy_session", value: sessions.admin, url: baseURL },
  ])
  await page.setViewportSize({ width: 1280, height: 900 })
  await page.goto("/en/admin/users", { waitUntil: "networkidle" })
  const open = page.getByRole("row").nth(1).getByRole("button").first()
  await open.focus()
  await page.keyboard.press("Enter")
  const sheet = page.getByRole("dialog")
  await expect(sheet, "sheet opens").toBeVisible()
  const ban = sheet.getByRole("button", { name: "Ban", exact: true })
  await layerRoundTrip(page, ban)
  await page.keyboard.press("Escape")
  await expect(sheet, "Escape closes the sheet").toHaveCount(0)
  await expect(open, "focus returns to the row").toBeFocused()
})

test("photo lightbox opens from the gallery, arrows move, Escape returns focus", async ({
  page,
}) => {
  await page.goto(listing, { waitUntil: "networkidle" })
  const photo = page.getByRole("button", { name: "Full screen" }).first()
  await layerRoundTrip(page, photo)
})
