import { readFileSync } from "node:fs"
import { describe, expect, it } from "vitest"

// The path rule overrides the original artwork's fills with the royal blue primary.
describe("public/sayaratak-logo.svg", () => {
  const svg = readFileSync("public/sayaratak-logo.svg", "utf8")
  it("has no gradients", () => {
    expect(svg).not.toMatch(/gradient|url\(/i)
  })
  it("uses one color, the primary", () => {
    expect(svg).toContain("<style>path { fill: #3659E3; }</style>")
  })
})
