import { useState } from "react"
import { fireEvent, screen, waitFor } from "@testing-library/react"
import { describe, expect, it, vi } from "vitest"

import { FavoriteButton } from "@/components/app/favorite-button"
import { ListingPickerDialog } from "@/components/app/listing-picker-dialog"
import { ServicePicker, type ServiceRow } from "@/components/app/service-picker"
import { db } from "@/mocks/db"
import { renderShell } from "./shell-render"

const templates = [
  { id: "oil-change", name: "Oil change" },
  { id: "brakes", name: "Brakes" },
]
function Picker() {
  const [value, setValue] = useState<ServiceRow[]>([])
  return (
    <>
      <ServicePicker value={value} onChange={setValue} templates={templates} />
      <output data-testid="rows">{JSON.stringify(value)}</output>
    </>
  )
}
const rows = () =>
  JSON.parse(screen.getByTestId("rows").textContent) as ServiceRow[]

describe("ServicePicker with template ids", () => {
  it("stores the template id, keeps it when the name is edited, and gives custom rows null", async () => {
    await renderShell(<Picker />)
    fireEvent.click(screen.getByRole("checkbox", { name: "Oil change" }))
    expect(rows()).toEqual([
      { name: "Oil change", priceFrom: null, templateId: "oil-change" },
    ])
    fireEvent.change(screen.getByRole("textbox", { name: "Service 1 name" }), {
      target: { value: "Full oil service" },
    })
    // The chip stays ticked: the row still carries its template.
    expect(
      screen.getByRole<HTMLInputElement>("checkbox", { name: "Oil change" })
        .checked
    ).toBe(true)
    fireEvent.click(
      screen.getByRole("button", { name: "Add a custom service" })
    )
    expect(rows().map((r) => r.templateId)).toEqual(["oil-change", null])
    // Unticking removes the template row only.
    fireEvent.click(screen.getByRole("checkbox", { name: "Oil change" }))
    expect(rows()).toEqual([{ name: "", priceFrom: null, templateId: null }])
  })
})

describe("ListingPickerDialog source", () => {
  it("source admin lists approved listings of every seller", async () => {
    const onSelect = vi.fn()
    await renderShell(
      <ListingPickerDialog
        open
        onOpenChange={() => {}}
        onSelect={onSelect}
        title="Pick"
        source="admin"
      />,
      { role: "admin" }
    )
    const rowsFound = await screen.findAllByRole("button", { name: /SDG|\d/ })
    expect(rowsFound.length).toBeGreaterThan(0)
    fireEvent.click(rowsFound[0]!)
    const id = onSelect.mock.calls[0]![0] as string
    const row = db.listings.find((l) => l.id === id)
    expect(row?.moderation).toBe("approved")
    expect(row?.ownerUserId).not.toBe("u-admin")
  })
})

describe("FavoriteButton", () => {
  it("reads the favorite ids endpoint and flips at once", async () => {
    const listing = db.listings.find((l) => l.moderation === "approved")!
    await renderShell(<FavoriteButton listingId={listing.id} />, {
      role: "user",
    })
    const heart = screen.getByRole("button", { name: "Save to favorites" })
    expect(heart.getAttribute("aria-pressed")).toBe("false")
    fireEvent.click(heart)
    await waitFor(() => expect(heart.getAttribute("aria-pressed")).toBe("true"))
    const saved = await (await fetch("/api/me/favorite-ids")).json()
    expect(saved.ids).toContain(listing.id)
  })
})
