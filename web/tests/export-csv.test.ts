import { afterEach, expect, it, vi } from "vitest"

import { downloadCsv } from "@/features/listings-manager/export-csv"

afterEach(() => vi.restoreAllMocks())

it("writes a UTF-8 file with a byte order mark and safe cells", async () => {
  let blob: Blob | undefined
  URL.createObjectURL = (b) => {
    blob = b as Blob
    return "blob:test"
  }
  URL.revokeObjectURL = () => {}
  vi.spyOn(HTMLAnchorElement.prototype, "click").mockImplementation(() => {})
  downloadCsv("listings.csv", [
    ["ID", "Title"],
    ["l1", 'تويوتا "كورولا"'],
    ["l2", "=HYPERLINK()"],
  ])
  const text = await blob!.text()
  expect(new Uint8Array(await blob!.arrayBuffer()).slice(0, 3)).toEqual(
    new Uint8Array([0xef, 0xbb, 0xbf])
  )
  expect(text).toContain('"l1","تويوتا ""كورولا"""')
  expect(text).toContain(`"l2","'=HYPERLINK()"`)
})
