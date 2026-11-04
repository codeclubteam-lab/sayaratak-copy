import { expect, it } from "vitest"

import { createI18n } from "@/lib/i18n/create"
import { isRtl } from "@/lib/utils"

it("resolves flat keys from any namespace, per locale", () => {
  const ar = createI18n("ar", { listing: { "listing.call": "اتصال" } })
  const en = createI18n("en", { listing: { "listing.call": "Call" } })
  expect(ar.t("listing.call")).toBe("اتصال")
  expect(en.t("listing.call")).toBe("Call")
})

it("only Arabic is RTL", () => {
  expect(isRtl("ar")).toBe(true)
  expect(isRtl("en")).toBe(false)
})
