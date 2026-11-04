import { useState } from "react"
import { fireEvent, screen, waitFor, within } from "@testing-library/react"
import { beforeEach, describe, expect, it, vi } from "vitest"

import { Button } from "@/components/ui/button"
import { AdminTable } from "@/features/admin/components/admin-table"
import { BanDialog } from "@/features/admin/components/ban-dialog"
import { EntitySheet } from "@/features/admin/components/entity-sheet"
import { ReasonDialog } from "@/features/admin/components/reason-dialog"
import { SellerPanel } from "@/features/admin/components/seller-panel"
import { StatusSwitch } from "@/features/admin/components/status-switch"
import type { AdminTableSearch } from "@/features/admin/schemas"
import { db, resetDb } from "@/mocks/db"
import { pick } from "./pick"
import { renderShell } from "./shell-render"

Element.prototype.scrollIntoView = () => {}
window.scrollTo = () => {}

beforeEach(() => {
  resetDb()
  vi.stubGlobal("matchMedia", () => ({
    matches: false,
    addEventListener: () => {},
    removeEventListener: () => {},
  }))
})

const admin = { role: "admin" as const, path: "/en/admin" }

describe("ReasonDialog", () => {
  it("asks for a reason; a chip fills the box and can still be edited", async () => {
    const onConfirm = vi.fn()
    await renderShell(
      <ReasonDialog
        open
        onOpenChange={() => {}}
        title="Reject listing"
        label="Reason the seller will see"
        confirmLabel="Reject"
        chips={["Unclear photos", "Duplicate"]}
        onConfirm={onConfirm}
      />,
      admin
    )
    const dialog = await screen.findByRole("dialog", { name: "Reject listing" })
    fireEvent.click(within(dialog).getByRole("button", { name: "Reject" }))
    expect(
      await within(dialog).findByText("This field is required")
    ).toBeTruthy()
    expect(onConfirm).not.toHaveBeenCalled()
    fireEvent.click(within(dialog).getByRole("button", { name: "Duplicate" }))
    const box = within(dialog).getByLabelText("Reason the seller will see")
    expect((box as HTMLTextAreaElement).value).toBe("Duplicate")
    fireEvent.change(box, { target: { value: "Duplicate of an older ad" } })
    fireEvent.click(within(dialog).getByRole("button", { name: "Reject" }))
    await waitFor(() =>
      expect(onConfirm).toHaveBeenCalledWith("Duplicate of an older ad")
    )
  })
})

describe("BanDialog", () => {
  it("sends the reason and the chosen duration", async () => {
    const onConfirm = vi.fn()
    await renderShell(
      <BanDialog
        open
        onOpenChange={() => {}}
        name="Omar"
        onConfirm={onConfirm}
      />,
      admin
    )
    const dialog = await screen.findByRole("dialog", { name: "Ban Omar" })
    fireEvent.change(within(dialog).getByLabelText("Reason"), {
      target: { value: "Spam listings" },
    })
    await pick(within(dialog).getByRole("combobox"), "30 days")
    fireEvent.click(within(dialog).getByRole("button", { name: "Ban" }))
    await waitFor(() =>
      expect(onConfirm).toHaveBeenCalledWith({
        reason: "Spam listings",
        duration: "30d",
      })
    )
  })
})

describe("StatusSwitch", () => {
  function Demo({ save }: { save: (next: boolean) => Promise<unknown> }) {
    const [on, setOn] = useState(false)
    return (
      <StatusSwitch
        checked={on}
        label="Verified, Nile Motors"
        confirmTitle={(next) => (next ? "Verify Nile Motors?" : "Unverify?")}
        confirmLabel={(next) => (next ? "Verify" : "Unverify")}
        onConfirm={(next) => save(next).then(() => setOn(next))}
      />
    )
  }

  it("saves only after the confirm", async () => {
    const save = vi.fn(() => Promise.resolve())
    await renderShell(<Demo save={save} />, admin)
    const toggle = await screen.findByRole("switch", {
      name: "Verified, Nile Motors",
    })
    fireEvent.click(toggle)
    fireEvent.click(await screen.findByRole("button", { name: "Cancel" }))
    expect(save).not.toHaveBeenCalled()
    expect(toggle.getAttribute("aria-checked")).toBe("false")
    fireEvent.click(toggle)
    expect(
      await screen.findByRole("alertdialog", { name: "Verify Nile Motors?" })
    ).toBeTruthy()
    fireEvent.click(screen.getByRole("button", { name: "Verify" }))
    await waitFor(() => expect(save).toHaveBeenCalledWith(true))
    await waitFor(() =>
      expect(toggle.getAttribute("aria-checked")).toBe("true")
    )
    await waitFor(() => expect(screen.queryByRole("alertdialog")).toBeNull())
  })
})

describe("EntitySheet", () => {
  it("shows the title, the body and the action footer", async () => {
    const onOpenChange = vi.fn()
    await renderShell(
      <EntitySheet
        open
        onOpenChange={onOpenChange}
        title="Omar Ali"
        footer={<Button type="button">Ban</Button>}
      >
        <p>Joined in 2024</p>
      </EntitySheet>,
      admin
    )
    const sheet = await screen.findByRole("dialog", { name: "Omar Ali" })
    expect(within(sheet).getByText("Joined in 2024")).toBeTruthy()
    expect(within(sheet).getByRole("button", { name: "Ban" })).toBeTruthy()
    expect(sheet.getAttribute("data-side")).toBe("inline-end")
    fireEvent.click(within(sheet).getByRole("button", { name: "Close" }))
    expect(onOpenChange).toHaveBeenCalledWith(false, expect.anything())
  })
})

describe("AdminTable", () => {
  type Row = { id: string; name: string }
  const items: Row[] = [
    { id: "a", name: "Amna" },
    { id: "b", name: "Bakri" },
  ]

  it("reports search, sort and page to the URL and offers bulk actions", async () => {
    const onNavigate = vi.fn()
    const bulk = vi.fn()
    const search: AdminTableSearch = { page: 2, q: "am" }
    await renderShell(
      <AdminTable<Row, AdminTableSearch>
        label="Users"
        columns={[
          {
            id: "name",
            header: "Name",
            accessorKey: "name",
            meta: { sortKey: "name" },
          },
        ]}
        getRowId={(r) => r.id}
        empty={<p>No users</p>}
        search={search}
        onNavigate={onNavigate}
        result={{ items, total: 60, pageSize: 20 }}
        bulkActions={(ids) => (
          <Button type="button" onClick={() => bulk(ids)}>
            Ban selected
          </Button>
        )}
      />,
      { ...admin, path: "/en/admin/users?q=am&page=2" }
    )
    const table = await screen.findByRole("table", { name: "Users" })
    fireEvent.click(within(table).getByRole("button", { name: "Name" }))
    expect(onNavigate).toHaveBeenLastCalledWith({
      q: "am",
      sort: "name_asc",
      page: 1,
    })
    expect(screen.getByRole("link", { name: /3/ }).getAttribute("href")).toBe(
      "/en/admin/users?page=3&q=am"
    )
    fireEvent.click(within(table).getAllByRole("checkbox")[1]!)
    fireEvent.click(screen.getByRole("button", { name: "Ban selected" }))
    expect(bulk).toHaveBeenCalledWith(["a"])
  })
})

describe("SellerPanel", () => {
  it("shows the seller's approved and rejected counts and links to the user", async () => {
    const listing = db.listings.find(
      (l) => l.ownerUserId === "u-omar" && l.owner.type === "user"
    )!
    const count = (m: string) =>
      db.listings.filter(
        (l) => l.ownerUserId === "u-omar" && l.moderation === m
      ).length
    await renderShell(<SellerPanel owner={listing.owner} />, admin)
    const panel = await screen.findByRole("region", { name: "Seller" })
    await waitFor(() =>
      expect(
        within(panel).getByText("Approved listings").nextElementSibling
          ?.textContent
      ).toBe(String(count("approved")))
    )
    expect(
      within(panel).getByText("Rejected listings").nextElementSibling
        ?.textContent
    ).toBe(String(count("rejected")))
    expect(
      within(panel)
        .getByRole("link", { name: "Open user" })
        .getAttribute("href")
    ).toBe("/en/admin/users?id=u-omar")
  })
})
