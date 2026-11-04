import { readFileSync } from "node:fs"

import { expect, test, text, visit } from "./fixtures"
import type { Page } from "@playwright/test"

// The widest photo the cards on the page may load, from their srcset.
const widest = (page: Page) =>
  page.evaluate(() =>
    Math.max(
      ...[...document.querySelectorAll("main [data-media] img")].flatMap(
        (img) =>
          (img.getAttribute("srcset") ?? "")
            .split(",")
            .map((part) => Number(part.trim().split(" ")[1]?.replace("w", "")))
            .filter(Boolean)
      )
    )
  )

test("J10 language and data saver keep the path and params, photos get smaller", async ({
  page,
  lang,
}) => {
  const other = lang === "ar" ? "en" : "ar"
  // Blocker B1: the seed photos are missing, and a photo that fails is taken out of the page. Serve a stand-in.
  const photo = readFileSync("public/mock/banner-1.webp")
  await page.route(/\/mock\/vehicle-/, (route) =>
    route.fulfill({ body: photo, contentType: "image/webp" })
  )
  const path = "/vehicles/cars/sale/khartoum?maxPrice=20000000&sort=price_asc"
  await visit(page, `/${lang}${path}`)
  await expect.poll(() => widest(page)).toBe(1280)

  // Below lg both controls sit in the menu.
  const controls = async (now: "ar" | "en") => {
    const menu = page.getByRole("button", { name: text(now, "nav.menu") })
    if (await menu.isVisible()) {
      await menu.click()
      return page.getByRole("dialog")
    }
    return page.getByRole("banner")
  }

  await (
    await controls(lang)
  )
    .getByRole("link", { name: other === "en" ? "English" : "العربية" })
    .click()
  await expect(page).toHaveURL(`/${other}${path}`)
  await expect(page.locator("html")).toHaveAttribute("lang", other)
  // The switch is a full page load; wait for it to hydrate.
  await page.waitForLoadState("networkidle")

  const saver = (await controls(other)).getByRole("button", {
    name: text(other, "nav.data_saver"),
  })
  await saver.click()
  await expect(saver).toHaveAttribute("aria-pressed", "true")
  await page.keyboard.press("Escape")
  await expect(page).toHaveURL(`/${other}${path}`)
  await expect.poll(() => widest(page)).toBe(640)

  // Both choices hold after a reload.
  await page.reload({ waitUntil: "networkidle" })
  await expect(page).toHaveURL(`/${other}${path}`)
  await expect.poll(() => widest(page)).toBe(640)
})
