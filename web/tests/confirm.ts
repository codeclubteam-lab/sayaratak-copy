import { fireEvent, screen, within } from "@testing-library/react"

// Answers the dialog every Remove opens: pass the question it asks, then press its Remove button.
export async function confirmRemove(title: string) {
  const dialog = await screen.findByRole("alertdialog", { name: title })
  fireEvent.click(within(dialog).getByRole("button", { name: "Remove" }))
}
