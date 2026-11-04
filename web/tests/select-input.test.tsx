import { fireEvent, render, screen, waitFor } from "@testing-library/react"
import { afterEach, describe, expect, it, vi } from "vitest"

import { SelectInput } from "@/components/app/select-input"

const options = Array.from({ length: 12 }, (_, i) => ({
  value: `o${i}`,
  label: `Option ${i}`,
}))
const open = () => {
  render(
    <SelectInput
      value=""
      onChange={() => {}}
      options={options}
      aria-label="Make"
    />
  )
  const trigger = screen.getByRole("combobox", { name: "Make" })
  return trigger
}
const place = (trigger: HTMLElement, top: number) =>
  vi.spyOn(trigger, "getBoundingClientRect").mockReturnValue({
    top,
    bottom: top + 48,
    height: 48,
  } as DOMRect)

describe("SelectInput", () => {
  afterEach(() => vi.restoreAllMocks())

  it("scrolls the page up when too little room is left below, so the list drops down", async () => {
    const scroll = vi.spyOn(window, "scrollBy").mockImplementation(() => {})
    const trigger = open()
    place(trigger, window.innerHeight - 100)
    fireEvent.pointerDown(trigger, { button: 0, pointerType: "mouse" })
    fireEvent.mouseDown(trigger, { button: 0 })
    await waitFor(() => expect(scroll).toHaveBeenCalledOnce())
    expect(scroll.mock.calls[0]?.[0]).toMatchObject({ behavior: "instant" })
    expect((scroll.mock.calls[0]?.[0] as ScrollToOptions).top).toBeGreaterThan(
      0
    )
  })

  it("does not scroll when the list already fits below", async () => {
    const scroll = vi.spyOn(window, "scrollBy").mockImplementation(() => {})
    const trigger = open()
    place(trigger, 100)
    fireEvent.pointerDown(trigger, { button: 0, pointerType: "mouse" })
    fireEvent.mouseDown(trigger, { button: 0 })
    await screen.findByRole("listbox")
    expect(scroll).not.toHaveBeenCalled()
  })
})
