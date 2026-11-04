import { fireEvent, screen, waitFor, within } from "@testing-library/react"
import { beforeEach, describe, expect, it, vi } from "vitest"

import { VerificationPage } from "@/features/verification/components/verification-page"
import { verificationFormSchema } from "@/features/verification/schemas"
import { db, newId, resetDb } from "@/mocks/db"
import { confirmRemove } from "./confirm"
import { renderShell } from "./shell-render"

Element.prototype.scrollIntoView = () => {}
window.scrollTo = () => {}

beforeEach(() => {
  resetDb()
  document.cookie = "mock_fail=; Path=/; Max-Age=0"
  vi.stubGlobal("matchMedia", () => ({
    matches: false,
    addEventListener: () => {},
    removeEventListener: () => {},
  }))
})

const owner = () =>
  db.users.find((u) => u.role === "dealership" && u.onboardingDone)!
const biz = () => db.dealerships.find((d) => d.ownerId === owner().id)!
const png = (name = "doc.png") => new File(["x"], name, { type: "image/png" })
// The dealer starts with no request and no badge; `setup` adds the state under test.
const open = (setup?: (id: string) => void) => {
  db.verifications = db.verifications.filter((v) => v.ownerId !== owner().id)
  biz().verified = false
  setup?.(owner().id)
  return renderShell(<VerificationPage targetType="dealership" />, {
    role: "dealership",
    path: "/en/dealer/verification",
  })
}
const request = (status: "pending" | "approved" | "rejected", extra = {}) => ({
  id: newId("vr"),
  targetType: "dealership" as const,
  targetId: biz().id,
  ownerId: owner().id,
  documents: [
    { id: "d1", label: "commercial_registration", url: "/api/uploads/up-1" },
    { id: "d2", label: "shop_photo", url: "/api/uploads/up-2" },
  ],
  status,
  createdAt: "2026-10-01T09:00:00.000Z",
  ...extra,
})
const files = () => [
  ...document.querySelectorAll<HTMLInputElement>("input[type=file]"),
]
const pick = (input: HTMLInputElement, file = png()) =>
  fireEvent.change(input, { target: { files: [file] } })

describe("verification form schema", () => {
  const doc = { label: "other", file: png() }
  it("needs one to five documents and a note of at most 300 characters", () => {
    const parse = (v: unknown) => verificationFormSchema.safeParse(v)
    expect(parse({ documents: [doc] }).success).toBe(true)
    expect(parse({ documents: [] }).error?.issues[0]?.message).toBe(
      "validation.select_min"
    )
    expect(parse({ documents: Array(6).fill(doc) }).success).toBe(false)
    expect(parse({ documents: [doc], note: "x".repeat(301) }).success).toBe(
      false
    )
  })
  it("refuses a missing file, a non-image and an unknown label", () => {
    const first = (documents: unknown[]) =>
      verificationFormSchema.safeParse({ documents }).error?.issues[0]?.message
    expect(first([{ label: "other" }])).toBe("validation.required")
    expect(
      first([
        {
          label: "other",
          file: new File(["x"], "a.pdf", { type: "text/pdf" }),
        },
      ])
    ).toBe("validation.image_type")
    expect(first([{ label: "selfie", file: png() }])).toBeTruthy()
  })
})

describe("VerificationPage", () => {
  it("not requested: says so, lists what to send and offers one row per requirement", async () => {
    await open()
    expect(
      await screen.findByRole("heading", { name: "Not verified yet" })
    ).toBeTruthy()
    const list = within(
      screen.getByRole("heading", { name: "What to send" }).closest("section")!
    )
    expect(list.getByText("Commercial registration")).toBeTruthy()
    expect(list.getByText("Showroom or shopfront photo")).toBeTruthy()
    expect(screen.getByRole("group", { name: "Document 1" })).toBeTruthy()
    expect(screen.getByRole("group", { name: "Document 2" })).toBeTruthy()
    expect(screen.getByText("(Optional)")).toBeTruthy()
  })

  it("sends nothing while a file is missing and shows the error on each row", async () => {
    await open()
    fireEvent.click(
      await screen.findByRole("button", { name: "Send for review" })
    )
    expect(await screen.findAllByText("This field is required")).toHaveLength(2)
    expect(db.verifications.some((v) => v.ownerId === owner().id)).toBe(false)
  })

  it("sends the files as multipart and flips to under review", async () => {
    await open()
    // jsdom's FormData cannot cross into the mock server's request parser (handlers.test.ts covers that side), so the post is answered here from the fields the form sent.
    const mock = globalThis.fetch
    let sent: FormData | undefined
    vi.stubGlobal("fetch", async (input: RequestInfo, init?: RequestInit) => {
      if (String(input) !== "/api/me/verification" || init?.method !== "POST")
        return mock(input, init)
      sent = init.body as FormData
      const row = request("pending", {
        createdAt: new Date().toISOString(),
        note: String(sent.get("note")),
      })
      db.verifications.unshift(row)
      return Response.json(row)
    })
    await screen.findByRole("button", { name: "Send for review" })
    files().forEach((input, i) => pick(input, png(`doc-${i}.png`)))
    expect(await screen.findByText("doc-1.png")).toBeTruthy()
    fireEvent.change(screen.getByLabelText(/Note for the reviewer/), {
      target: { value: "Please check" },
    })
    fireEvent.click(screen.getByRole("button", { name: "Send for review" }))
    expect(
      await screen.findByRole("heading", { name: "Under review" })
    ).toBeTruthy()
    expect(sent!.getAll("label")).toEqual([
      "commercial_registration",
      "shop_photo",
    ])
    expect(sent!.getAll("file").map((f) => (f as File).name)).toEqual([
      "doc-0.png",
      "doc-1.png",
    ])
    expect(sent!.get("note")).toBe("Please check")
    await waitFor(() =>
      expect(
        screen.queryByRole("button", { name: "Send for review" })
      ).toBeNull()
    )
    expect(
      screen.getByText(/Documents sent: Commercial registration/)
    ).toBeTruthy()
  })

  it("adds rows up to five and keeps the last one", async () => {
    await open()
    const add = () =>
      screen.getByRole("button", { name: "Add another document" })
    await screen.findByRole("button", { name: "Send for review" })
    for (let i = 0; i < 3; i++) fireEvent.click(add())
    expect(screen.getAllByRole("group", { name: /^Document / })).toHaveLength(5)
    expect(
      screen.queryByRole("button", { name: "Add another document" })
    ).toBeNull()
    for (let i = 5; i > 1; i--) {
      fireEvent.click(screen.getByRole("button", { name: "Remove document 1" }))
      await confirmRemove("Remove document 1?")
      await waitFor(() =>
        expect(
          screen.getAllByRole("group", { name: /^Document / })
        ).toHaveLength(i - 1)
      )
    }
    expect(screen.getAllByRole("group", { name: /^Document / })).toHaveLength(1)
    expect(
      screen.queryByRole("button", { name: /^Remove document/ })
    ).toBeNull()
  })

  it("pending: shows the date and documents and hides the form", async () => {
    await open((id) => {
      db.verifications.unshift(request("pending"))
      expect(id).toBe(owner().id)
    })
    expect(
      await screen.findByRole("heading", { name: "Under review" })
    ).toBeTruthy()
    expect(screen.getByText(/Sent on .*2026/)).toBeTruthy()
    expect(
      screen.getByText(/Documents sent: Commercial registration and Showroom/)
    ).toBeTruthy()
    expect(screen.queryByRole("button", { name: "Send for review" })).toBeNull()
    expect(screen.queryByRole("heading", { name: "What to send" })).toBeNull()
  })

  it("verified: shows the badge and no form, even when the business was verified without a request", async () => {
    await open(() => {
      biz().verified = true
    })
    const heading = await screen.findByRole("heading", {
      name: /You are verified/,
    })
    expect(
      within(heading).getByText("Verified", { selector: "span" })
    ).toBeTruthy()
    expect(
      screen.getByText("The badge shows on your public page.")
    ).toBeTruthy()
    expect(screen.queryByRole("button", { name: "Send for review" })).toBeNull()
  })

  it("rejected: shows the reason and opens the form with Submit again", async () => {
    await open(() => {
      db.verifications.unshift(
        request("rejected", { rejectionReason: "The photo is blurry" })
      )
    })
    expect(
      await screen.findByRole("heading", { name: "Not approved" })
    ).toBeTruthy()
    expect(screen.getByText("Reason: The photo is blurry")).toBeTruthy()
    expect(screen.queryByRole("button", { name: "Send for review" })).toBeNull()
    fireEvent.click(screen.getByRole("button", { name: "Submit again" }))
    expect(
      await screen.findByRole("button", { name: "Send for review" })
    ).toBeTruthy()
    expect(screen.queryByRole("button", { name: "Submit again" })).toBeNull()
  })

  it("shows an error with a retry when the status cannot load, and recovers", async () => {
    document.cookie = "mock_fail=500; Path=/"
    await open()
    expect(
      await screen.findByText("Could not load your verification status")
    ).toBeTruthy()
    document.cookie = "mock_fail=; Path=/; Max-Age=0"
    fireEvent.click(screen.getByRole("button", { name: "Try again" }))
    expect(
      await screen.findByRole("heading", { name: "Not verified yet" })
    ).toBeTruthy()
  })
})
