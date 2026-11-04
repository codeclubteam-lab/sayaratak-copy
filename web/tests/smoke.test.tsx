import { render, screen } from "@testing-library/react"
import { expect, it } from "vitest"

import { Button } from "@/components/ui/button"
import { cn } from "@/lib/utils"

it("renders a component under jsdom", () => {
  render(<Button>Go</Button>)
  expect(screen.getByRole("button", { name: "Go" })).toBeTruthy()
})

it("merges conflicting tailwind classes", () => {
  expect(cn("p-2", "p-4")).toBe("p-4")
})
