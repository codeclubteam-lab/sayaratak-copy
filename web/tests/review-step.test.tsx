import { act, fireEvent, screen, waitFor } from "@testing-library/react"
import { useRouter, useRouterState } from "@tanstack/react-router"
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest"

import { closeAuthGate, authGate } from "@/features/auth/auth-gate"
import { ListingWizard } from "@/features/listings/wizard/listing-wizard"
import { useListingLimit } from "@/features/listings/wizard/use-listing-limit"
import { usePublishListing } from "@/features/listings/wizard/use-publish-listing"
import type { WizardBase } from "@/features/listings/wizard/use-wizard-draft"
import { wizardDefaults } from "@/features/listings/wizard/wizard-defaults"
import { wizardSteps } from "@/features/listings/wizard/wizard-steps"
import { keys } from "@/lib/api/query-keys"
import { db, resetDb } from "@/mocks/db"
import type { Media } from "@sayaratak/shared/schemas/listing"
import { userSchema } from "@sayaratak/shared/schemas/user"
import { renderShell } from "./shell-render"

vi.mock("@/components/app/map-canvas-impl", () => ({
  MapCanvasImpl: () => null,
}))

function Harness({ editId, base }: { editId?: string; base?: WizardBase }) {
  const router = useRouter()
  const stepId = useRouterState({
    select: (s) =>
      new URLSearchParams(s.location.searchStr).get("step") ?? "type",
  })
  const publish = usePublishListing({
    editId,
    onSaved: (l) => router.history.push(`/en/post?step=done&listing=${l.id}`),
  })
  const { reached } = useListingLimit(!!editId)
  return (
    <ListingWizard
      context="public"
      stepId={stepId}
      steps={wizardSteps}
      editId={editId}
      base={base}
      defaultValues={wizardDefaults}
      publishDisabled={reached}
      onPublish={publish}
    />
  )
}
const media = (id: string): Media => ({
  id,
  type: "image",
  url: `/mock/${id}-{w}.webp`,
  width: 1280,
  height: 853,
  placeholderColor: "#b8c4c0",
  posterUrl: null,
})
// A car whose four steps are valid, so the review may open.
const car = {
  ...wizardDefaults,
  kind: "vehicle",
  vehicleType: "car",
  makeId: "toyota",
  modelId: "toyota-corolla",
  year: 2018,
  fuel: "petrol",
  transmission: "automatic",
  mileageKm: 90000,
  title: "Toyota Corolla 2018",
  description: "Clean car, one owner, full service history.",
  price: 12_000_000,
  media: [..."abc"].map((id) => media(id)),
  cityId: "khartoum",
  districtId: "khartoum-riyadh",
  phone: "+249912345678",
  whatsapp: "+249912345678",
  features: ["abs", "sunroof"],
}
const draft = (values: object = {}) =>
  sessionStorage.setItem(
    "sy:draft:listing:new",
    JSON.stringify({
      savedAt: new Date().toISOString(),
      values: { ...car, ...values },
    })
  )
const open = async (
  options: Parameters<typeof renderShell>[1] = {},
  props: Parameters<typeof Harness>[0] = {}
) => {
  const shell = await renderShell(<Harness {...props} />, {
    path: "/en/post?step=review",
    ...options,
  })
  await screen.findByRole("heading", { name: "Review and publish" })
  await screen.findByRole("link", { name: "Edit Type" })
  return shell
}
const publishButton = () => screen.getByRole("button", { name: "Publish" })
// The person `renderShell` signs in, on the free plan: the seed gives some of them a paid one with its own limit.
const freePlan = () => {
  const id = db.users.find((u) => u.role === "user" && u.onboardingDone)!.id
  db.subscriptions = db.subscriptions.filter((s) => s.userId !== id)
}
const mine = (title: string) => db.listings.filter((l) => l.title === title)
const where = (router: { state: { location: { href: string } } }) =>
  router.state.location.href

beforeEach(() => {
  resetDb()
  sessionStorage.clear()
  window.scrollTo = vi.fn()
  Element.prototype.scrollIntoView = vi.fn()
  db.settings.individualSubscriptionsEnabled = false
})
afterEach(() => closeAuthGate())

describe("ReviewStep", () => {
  it("shows the card and the four steps, each with an Edit link back to it", async () => {
    draft()
    await open()
    expect(screen.getAllByText("Toyota Corolla 2018").length).toBeGreaterThan(0)
    for (const [section, step] of [
      ["Type", "type"],
      ["Details", "details"],
      ["Photos", "photos"],
      ["Contact", "contact"],
    ]) {
      expect(
        screen
          .getByRole("link", { name: `Edit ${section}` })
          .getAttribute("href")
      ).toBe(`/en/post?step=${step}`)
    }
    expect(screen.getByText("3 photos")).toBeTruthy()
    expect(await screen.findByText("Riyadh, Khartoum")).toBeTruthy()
    expect(screen.getByText("Call · WhatsApp · Message")).toBeTruthy()
    // the specs and the features of the details step
    expect(screen.getByText("Sunroof")).toBeTruthy()
  })

  it("does not open until the steps before it are valid", async () => {
    draft({ title: "" })
    await renderShell(<Harness />, { path: "/en/post?step=review" })
    expect(
      await screen.findByRole("heading", { name: "Add the details" })
    ).toBeTruthy()
  })

  it("signed in: Publish saves a listing for review, opens the done step and drops the draft", async () => {
    draft()
    const { router } = await open({ role: "user" })
    fireEvent.click(publishButton())
    await waitFor(() => expect(where(router)).toContain("step=done"))
    const [saved] = mine("Toyota Corolla 2018")
    expect(saved?.moderation).toBe("pending")
    expect(where(router)).toContain(`listing=${saved?.id}`)
    expect(saved?.features).toEqual(["abs", "sunroof"])
    expect(saved?.contact.methods).toEqual(["call", "whatsapp", "chat"])
    expect(sessionStorage.getItem("sy:draft:listing:new")).toBeNull()
  })

  it("signed out: Publish opens the sign in dialog and saves nothing", async () => {
    draft()
    await open()
    fireEvent.click(publishButton())
    await waitFor(() => expect(authGate.state.open).toBe(true))
    expect(authGate.state.reason).toBe("auth.reason_post")
    expect(mine("Toyota Corolla 2018")).toHaveLength(0)
    expect(sessionStorage.getItem("sy:draft:listing:new")).not.toBeNull()
  })

  it("at the free limit: the meter links to plans and Publish is off", async () => {
    db.settings.individualSubscriptionsEnabled = true
    db.settings.freeListingLimit = 0
    freePlan()
    draft()
    await open({ role: "user" })
    expect(await screen.findByText(/^\d+ of 0$/)).toBeTruthy()
    expect(screen.getByText("You reached the limit of your plan")).toBeTruthy()
    expect(
      screen.getByRole("link", { name: "See plans" }).getAttribute("href")
    ).toBe("/en/account/billing")
    await waitFor(() =>
      expect(publishButton().hasAttribute("disabled")).toBe(true)
    )
  })

  it("under the limit the meter shows the use and Publish works", async () => {
    db.settings.freeListingLimit = 50
    db.settings.individualSubscriptionsEnabled = true
    freePlan()
    draft()
    await open({ role: "user" })
    expect(await screen.findByText(/^\d+ of 50$/)).toBeTruthy()
    expect(screen.queryByRole("link", { name: "See plans" })).toBeNull()
    expect(publishButton().hasAttribute("disabled")).toBe(false)
  })

  it("a new account is asked for a name and city first, then publishes", async () => {
    draft()
    const { client, router } = await open({ role: "user" })
    const me = userSchema.parse(client.getQueryData(keys.me))
    act(() => {
      client.setQueryData(keys.me, { ...me, onboardingDone: false })
    })
    const name = await screen.findByLabelText<HTMLInputElement>(/Full name/)
    expect(name.value).toBe(me.fullName)
    expect(
      screen.getByRole("combobox", { name: /City/ }).textContent
    ).toContain("Khartoum")
    fireEvent.change(name, { target: { value: "" } })
    fireEvent.click(publishButton())
    expect(await screen.findByText("Enter at least 2 characters")).toBeTruthy()
    expect(mine("Toyota Corolla 2018")).toHaveLength(0)
    fireEvent.change(name, { target: { value: "Test Seller" } })
    fireEvent.click(publishButton())
    await waitFor(() => expect(where(router)).toContain("step=done"))
    expect(mine("Toyota Corolla 2018")).toHaveLength(1)
    expect(db.users.find((u) => u.id === me.id)?.fullName).toBe("Test Seller")
  })

  it("editing saves over the listing, creates no new one and has no limit", async () => {
    db.settings.individualSubscriptionsEnabled = true
    db.settings.freeListingLimit = 0
    freePlan()
    const owner = db.users.find((u) => u.role === "user" && u.onboardingDone)!
    const row = db.listings.find((l) => l.ownerUserId === owner.id)!
    const before = db.listings.length
    const base = {
      values: { ...car, title: "Toyota Corolla 2018 edited" },
      updatedAt: new Date(Date.now() - 1000).toISOString(),
    }
    const { router } = await open({ role: "user" }, { editId: row.id, base })
    expect(screen.queryByText(/^\d+ of 0$/)).toBeNull()
    fireEvent.click(publishButton())
    await waitFor(() => expect(where(router)).toContain("step=done"))
    expect(db.listings).toHaveLength(before)
    expect(row.title).toBe("Toyota Corolla 2018 edited")
    expect(where(router)).toContain(`listing=${row.id}`)
  })
})
