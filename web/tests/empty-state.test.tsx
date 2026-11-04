import { screen } from "@testing-library/react"
import { InboxIcon } from "lucide-react"
import { describe, expect, it } from "vitest"

import { EmptyState } from "@/components/app/empty-state"
import { renderShell } from "./shell-render"

describe("EmptyState", () => {
  it("is the shadcn Empty: icon tile, titled heading, sentence and action", async () => {
    await renderShell(
      <EmptyState
        icon={InboxIcon}
        title="Nothing here"
        body="Come back later."
        action={<button type="button">Go</button>}
      />
    )
    const root = document.querySelector("[data-slot=empty]")
    expect(root).toBeTruthy()
    expect(root?.querySelector("[data-slot=empty-icon] svg")).toBeTruthy()
    expect(
      screen.getByRole("heading", { level: 2, name: "Nothing here" })
    ).toBeTruthy()
    expect(screen.getByText("Come back later.")).toBeTruthy()
    expect(root?.querySelector("[data-slot=empty-content] button")).toBeTruthy()
  })

  it("inside a titled section the title is a level 3 heading, and no action means no content block", async () => {
    await renderShell(
      <EmptyState icon={InboxIcon} title="No services" level={3} />
    )
    expect(
      screen.getByRole("heading", { level: 3, name: "No services" })
    ).toBeTruthy()
    expect(document.querySelector("[data-slot=empty-content]")).toBeNull()
  })
})
