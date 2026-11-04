import { readFileSync } from "node:fs"
import { describe, expect, it } from "vitest"

// The logo is drawn in the primary Nile green (`--primary`, #135E42) with flat fills: A5 allows no gradients and no second brand color.
describe("public/sayaratak-logo.svg", () => {
  const svg = readFileSync("public/sayaratak-logo.svg", "utf8")
  it("has no gradients", () => {
    expect(svg).not.toMatch(/gradient|url\(/i)
  })
  it("uses one color, the primary", () => {
    const fills = new Set(
      [...svg.matchAll(/ fill="([^"]+)"/g)]
        .map((m) => m[1]?.toUpperCase())
        .filter((c) => c !== "NONE")
    )
    expect([...fills]).toEqual(["#135E42"])
  })
})
