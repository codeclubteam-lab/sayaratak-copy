import { readdirSync } from "node:fs"
import { QueryClient, QueryClientProvider } from "@tanstack/react-query"
import { render as rtlRender, screen } from "@testing-library/react"
import type { ReactElement } from "react"
import { describe, expect, it } from "vitest"

import { MakeLogo } from "@/components/app/make-logo"
import { SelectInput } from "@/components/app/select-input"
import { keys } from "@/lib/api/query-keys"
import { buildSeed } from "@/mocks/seed"

const files = readdirSync("public/images/makes")
  .filter((f) => f.endsWith(".svg"))
  .map((f) => f.replace(".svg", ""))

// MakeLogo reads uploaded logos from the cached taxonomy.
const render = (ui: ReactElement) => {
  const client = new QueryClient()
  const wrap = (el: ReactElement) => (
    <QueryClientProvider client={client}>{el}</QueryClientProvider>
  )
  const out = rtlRender(wrap(ui))
  return { ...out, rerender: (el: ReactElement) => out.rerender(wrap(el)) }
}

describe("MakeLogo", () => {
  it("shows the file of every make that has one", () => {
    expect(files.length).toBeGreaterThan(0)
    for (const id of files) {
      const { container, unmount } = render(<MakeLogo id={id} />)
      expect(container.querySelector("img")?.getAttribute("src")).toBe(
        `/images/makes/${id}.svg`
      )
      unmount()
    }
  })

  it("has a logo file for every seeded make, so none shows a letter tile", () => {
    const ids = buildSeed({ empty: true }).taxonomy.makes.map((m) => m.id)
    expect(ids.length).toBeGreaterThan(0)
    expect(ids.filter((id) => !files.includes(id))).toEqual([])
  })

  it("shows the initial for a make without a file, and nothing without a name", () => {
    const { container, rerender } = render(<MakeLogo id="dayun" name="Dayun" />)
    expect(container.querySelector("img")).toBeNull()
    expect(container.textContent).toBe("D")
    rerender(<MakeLogo id="dayun" />)
    expect(container.innerHTML).toBe("")
    rerender(<MakeLogo id={null} />)
    expect(container.innerHTML).toBe("")
  })

  it("keeps the option name clean when a select option has an icon", () => {
    render(
      <SelectInput
        value="toyota"
        onChange={() => {}}
        aria-label="Make"
        options={[
          { value: "toyota", label: "Toyota", icon: <MakeLogo id="toyota" /> },
        ]}
      />
    )
    const trigger = screen.getByRole("combobox", { name: "Make" })
    expect(trigger.textContent).toContain("Toyota")
    expect(trigger.querySelector("[aria-hidden]")).not.toBeNull()
  })
})

describe("MakeLogo uploaded", () => {
  it("prefers the uploaded logoUrl over the static file", () => {
    const client = new QueryClient()
    client.setQueryData(keys.taxonomy, {
      makes: [{ id: "toyota", logoUrl: "/api/uploads/x.png" }],
    })
    const { container } = rtlRender(
      <QueryClientProvider client={client}>
        <MakeLogo id="toyota" />
      </QueryClientProvider>
    )
    expect(container.querySelector("img")?.getAttribute("src")).toBe(
      "/api/uploads/x.png"
    )
  })
})
