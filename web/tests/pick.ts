import { fireEvent, screen, within } from "@testing-library/react"

// Opens a shadcn Select (Base UI) and chooses one option by its visible name.
export async function pick(trigger: HTMLElement, option: string) {
  fireEvent.pointerDown(trigger, { button: 0, pointerType: "mouse" })
  fireEvent.mouseDown(trigger, { button: 0 })
  // Search only the open list, and skip the visibility check there: it reads styles for every option and is slow on long lists.
  const item = await within(await screen.findByRole("listbox")).findByRole(
    "option",
    { name: option, hidden: true }
  )
  fireEvent.mouseMove(item)
  fireEvent.pointerUp(item, { button: 0, pointerType: "mouse" })
  fireEvent.mouseUp(item, { button: 0 })
  fireEvent.click(item)
}
