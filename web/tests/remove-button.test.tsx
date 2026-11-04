import { fireEvent, screen, waitFor, within } from "@testing-library/react"
import { describe, expect, it, vi } from "vitest"

import { RemoveButton } from "@/components/app/remove-button"
import { confirmRemove } from "./confirm"
import { renderShell } from "./shell-render"

describe("RemoveButton", () => {
  it("asks first, and only the dialog's Remove runs the action", async () => {
    const onConfirm = vi.fn()
    await renderShell(
      <RemoveButton title="Remove this thing?" onConfirm={onConfirm}>
        Remove
      </RemoveButton>
    )
    fireEvent.click(screen.getByRole("button", { name: "Remove" }))
    const dialog = await screen.findByRole("alertdialog", {
      name: "Remove this thing?",
    })
    expect(onConfirm).not.toHaveBeenCalled()
    fireEvent.click(within(dialog).getByRole("button", { name: "Cancel" }))
    await waitFor(() => expect(screen.queryByRole("alertdialog")).toBeNull())
    expect(onConfirm).not.toHaveBeenCalled()
    fireEvent.click(screen.getByRole("button", { name: "Remove" }))
    await confirmRemove("Remove this thing?")
    expect(onConfirm).toHaveBeenCalledOnce()
  })
})
