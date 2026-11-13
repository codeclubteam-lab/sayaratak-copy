import { describe, expect, it } from "bun:test"

import { renderCode } from "./templates"
import type { Locale } from "./send"

describe("transactional email presentation", () => {
  const locales: Locale[] = ["en", "ar"]
  for (const locale of locales) {
    it(`renders a branded, accessible ${locale} code email and text fallback`, () => {
      const mail = renderCode({
        template: "email-verification",
        locale,
        code: "012345",
      })
      expect(mail.html).toContain(`lang="${locale}"`)
      expect(mail.html).toContain('role="presentation"')
      expect(mail.html).toContain("#3659e3")
      expect(mail.html).toContain('dir="ltr"')
      expect(mail.html).toContain("012345")
      expect(mail.text).toContain("012345")
      expect(mail.text).toContain("10")
      expect(mail.html).not.toMatch(/<img|<script|https?:\/\//)
    })
  }
  it("escapes code text rather than interpreting it as HTML", () => {
    const mail = renderCode({
      template: "email-verification",
      locale: "en",
      code: "<script>alert(1)</script>",
    })
    expect(mail.html).not.toContain("<script>")
    expect(mail.html).toContain("&lt;script&gt;")
  })
})
