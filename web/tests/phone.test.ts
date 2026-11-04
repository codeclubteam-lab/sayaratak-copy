import { expect, it } from "vitest"

import {
  formatPhone,
  normalizePhone,
  toWhatsappUrl,
} from "@sayaratak/shared/lib/phone"

it("normalizes every accepted phone shape to +249 and 9 digits", () => {
  for (const input of [
    "٠٩١٢٣٤٥٦٧٨",
    "0912345678",
    "091 234-5678",
    "912345678",
    "00249912345678",
    "+249 (91) 234 5678",
    "+249912345678",
  ]) {
    expect(normalizePhone(input)).toBe("+249912345678")
  }
  expect(normalizePhone("+971501234567")).toBe("+971501234567")
  expect(normalizePhone("12345")).toBe("12345")
})

it("formats for display and builds WhatsApp links", () => {
  expect(formatPhone("+249912345678")).toBe("+249 91 234 5678")
  expect(formatPhone("+971501234567")).toBe("+971501234567")
  expect(toWhatsappUrl("+249912345678")).toBe("https://wa.me/249912345678")
  expect(toWhatsappUrl("+249912345678", "Hi & bye")).toBe(
    "https://wa.me/249912345678?text=Hi%20%26%20bye"
  )
})
