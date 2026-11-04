import { fireEvent, screen, waitFor } from "@testing-library/react"
import { describe, expect, it } from "vitest"

import { ClientLinks } from "@/components/app/client-links"
import { renderShell } from "./shell-render"

const page = (
  <>
    <ClientLinks locale="en" />
    <a href="/en/workshops">workshops</a>
    <a href="/en/workshops" target="_blank">
      new tab
    </a>
    <a href="/ar/workshops">other language</a>
    <a href="https://example.com/x">external</a>
  </>
)

// `fireEvent` returns false when a listener called preventDefault, which is what a client navigation does.
describe("ClientLinks", () => {
  it("a plain click on a same-language link navigates in the app", async () => {
    const { router } = await renderShell(page)
    expect(fireEvent.click(await screen.findByText("workshops"))).toBe(false)
    await waitFor(() =>
      expect(router.history.location.pathname).toBe("/en/workshops")
    )
  })
  it("leaves new tabs, other languages, other sites and modifier clicks to the browser", async () => {
    await renderShell(page)
    for (const name of ["new tab", "other language", "external"])
      expect(fireEvent.click(await screen.findByText(name))).toBe(true)
    expect(
      fireEvent.click(screen.getByText("workshops"), { ctrlKey: true })
    ).toBe(true)
  })
})
