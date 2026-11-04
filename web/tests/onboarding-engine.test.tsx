import { fireEvent, screen, waitFor } from "@testing-library/react"
import { useRouterState } from "@tanstack/react-router"
import { useFormContext } from "react-hook-form"
import { beforeEach, describe, expect, it, vi } from "vitest"
import { z } from "zod"

import { draftQuery } from "@/features/auth/queries"
import { OnboardingStepPage } from "@/features/onboarding/components/onboarding-step-page"
import { flatValues, reachableIndex } from "@/features/onboarding/draft"
import type { FlowStep } from "@/features/onboarding/flows"
import { db, resetDb } from "@/mocks/db"
import { renderShell } from "./shell-render"

beforeEach(() => {
  resetDb()
  window.scrollTo = vi.fn()
})

function NameField() {
  const { register } = useFormContext()
  return <input aria-label="Name" {...register("name")} />
}
const dummy = (extra: Partial<FlowStep> = {}): FlowStep[] => [
  {
    id: "a",
    titleKey: "onboarding.step_dealership_business_title",
    helperKey: "onboarding.step_dealership_business_helper",
    schema: z.object({ name: z.string().min(1, "validation.required") }),
    Component: NameField,
  },
  {
    id: "b",
    titleKey: "onboarding.step_dealership_location_title",
    helperKey: "onboarding.step_dealership_location_helper",
    schema: z.object({}),
    optional: true,
    Component: () => null,
    ...extra,
  },
]

// The page follows the last path segment, as the real route does.
function Harness({
  steps,
  redirect,
}: {
  steps: FlowStep[]
  redirect?: string
}) {
  const stepId = useRouterState({
    select: (s) => s.location.pathname.split("/").pop() ?? "",
  })
  return (
    <OnboardingStepPage
      role="dealership"
      stepId={stepId}
      steps={steps}
      redirect={redirect}
    />
  )
}

const user = () => db.users.find((u) => u.role === "user" && u.onboardingDone)!
const draft = () =>
  db.drafts.find((d) => d.id === `${user().id}:onboarding:dealership`)?.data
const open = (steps = dummy(), step = "a", redirect?: string) =>
  renderShell(<Harness steps={steps} redirect={redirect} />, {
    role: "user",
    path: `/en/onboarding/dealership/${step}`,
  })
// The route loader has the draft ready before the page renders; tests wait for it.
const openWithDraft = async (
  steps: FlowStep[],
  data: object,
  redirect?: string
) => {
  db.drafts.push({
    id: `${user().id}:onboarding:dealership`,
    userId: user().id,
    key: "onboarding:dealership",
    data: { ...data },
  })
  const shell = await open(steps, "b", redirect)
  await waitFor(() =>
    expect(
      shell.client.getQueryData(draftQuery("onboarding:dealership").queryKey)
    ).toBeDefined()
  )
  return shell
}
const type = (value: string) =>
  fireEvent.change(screen.getByRole("textbox", { name: "Name" }), {
    target: { value },
  })

describe("OnboardingStepPage", () => {
  it("shows the step count and title", async () => {
    await open()
    expect(screen.getByText("Step 2 of 3")).toBeTruthy()
    expect(
      screen.getByRole("heading", { name: "Your dealership" })
    ).toBeTruthy()
  })

  it("blocks Next on invalid input, then saves, moves on and focuses the heading", async () => {
    const { router } = await open()
    fireEvent.click(screen.getByRole("button", { name: "Continue" }))
    await waitFor(() => expect(screen.getByRole("textbox")).toBeTruthy())
    expect(draft()).toBeUndefined()
    type("Abc")
    fireEvent.click(screen.getByRole("button", { name: "Continue" }))
    await waitFor(() =>
      expect(router.state.location.pathname).toBe("/en/onboarding/dealership/b")
    )
    expect(draft()).toEqual({ a: { name: "Abc" } })
    await waitFor(() =>
      expect(document.activeElement?.textContent).toBe("Where to find you")
    )
    expect(window.scrollTo).toHaveBeenCalled()
  })

  it("keeps typed values when going Back", async () => {
    const { router } = await open()
    type("Kept")
    fireEvent.click(screen.getByRole("button", { name: "Continue" }))
    await waitFor(() => expect(router.state.location.pathname).toMatch(/\/b$/))
    fireEvent.click(screen.getByRole("button", { name: "Back" }))
    await waitFor(() => expect(router.state.location.pathname).toMatch(/\/a$/))
    await waitFor(() =>
      expect(screen.getByRole("textbox", { name: "Name" })).toHaveProperty(
        "value",
        "Kept"
      )
    )
  })

  it("goes back to role selection from the first step", async () => {
    const { router } = await open()
    fireEvent.click(screen.getByRole("button", { name: "Back" }))
    await waitFor(() =>
      expect(router.state.location.pathname).toBe("/en/onboarding/role")
    )
  })

  it("Save and exit saves a valid step and goes home; an invalid one is not saved", async () => {
    const { router, unmount } = await open()
    type("Saved")
    fireEvent.click(screen.getByRole("button", { name: "Save and exit" }))
    await waitFor(() => expect(router.state.location.pathname).toBe("/en"))
    await waitFor(() => expect(draft()).toEqual({ a: { name: "Saved" } }))
    unmount()
    resetDb()
    const again = await open()
    fireEvent.click(screen.getByRole("button", { name: "Save and exit" }))
    await waitFor(() =>
      expect(again.router.state.location.pathname).toBe("/en")
    )
    expect(draft()).toBeUndefined()
  })

  it("Skip on an optional last step finishes onboarding", async () => {
    const id = user().id
    const { router } = await openWithDraft(dummy(), {
      a: { name: "Desert Motors" },
    })
    fireEvent.click(screen.getByRole("button", { name: "Skip" }))
    await waitFor(() =>
      expect(router.state.location.href).toBe("/en/dealer?welcome=1")
    )
    expect(db.users.find((u) => u.id === id)?.role).toBe("dealership")
    expect(db.dealerships.some((d) => d.name.en === "Desert Motors")).toBe(true)
  })

  it("the last required step shows the finish label and finishes", async () => {
    const { router } = await openWithDraft(dummy({ optional: false }), {
      a: { name: "Finish Co" },
    })
    expect(screen.queryByRole("button", { name: "Skip" })).toBeNull()
    fireEvent.click(
      screen.getByRole("button", { name: "Create my dealership" })
    )
    await waitFor(() =>
      expect(router.state.location.pathname).toBe("/en/dealer")
    )
    expect(db.dealerships.some((d) => d.name.en === "Finish Co")).toBe(true)
  })
})

describe("redirect target", () => {
  const via = "?redirect=%2Fen%2Fpost"
  it("travels with Next and Back, and Save and exit drops it", async () => {
    const { router } = await open(dummy(), "a", "/en/post")
    type("Abc")
    fireEvent.click(screen.getByRole("button", { name: "Continue" }))
    await waitFor(() =>
      expect(router.state.location.href).toBe(
        `/en/onboarding/dealership/b${via}`
      )
    )
    fireEvent.click(screen.getByRole("button", { name: "Back" }))
    await waitFor(() =>
      expect(router.state.location.href).toBe(
        `/en/onboarding/dealership/a${via}`
      )
    )
    fireEvent.click(screen.getByRole("button", { name: "Save and exit" }))
    await waitFor(() => expect(router.state.location.href).toBe("/en"))
  })

  it("Back from the first step keeps it for role selection", async () => {
    const { router } = await open(dummy(), "a", "/en/post")
    fireEvent.click(screen.getByRole("button", { name: "Back" }))
    await waitFor(() =>
      expect(router.state.location.href).toBe(`/en/onboarding/role${via}`)
    )
  })

  it("finishing lands on the target instead of the dashboard", async () => {
    const { router } = await openWithDraft(
      dummy({ optional: false }),
      { a: { name: "Finish Co" } },
      "/en/post"
    )
    fireEvent.click(
      screen.getByRole("button", { name: "Create my dealership" })
    )
    await waitFor(() => expect(router.state.location.href).toBe("/en/post"))
    expect(db.dealerships.some((d) => d.name.en === "Finish Co")).toBe(true)
  })
})

describe("draft helpers", () => {
  const steps = dummy()
  it("a step opens only after every earlier required step is saved", () => {
    expect(reachableIndex(steps, {})).toBe(0)
    expect(reachableIndex(steps, { a: { name: "" } })).toBe(0)
    expect(reachableIndex(steps, { a: { name: "x" } })).toBe(1)
  })
  it("skips an unsaved optional step when a later one is required", () => {
    const three = [...steps, { ...steps[0]!, id: "c" }]
    expect(reachableIndex(three, { a: { name: "x" } })).toBe(2)
  })
  it("flattens saved steps in order", () => {
    expect(flatValues(steps, { a: { name: "x" }, b: { y: 1 } })).toEqual({
      name: "x",
      y: 1,
    })
  })
})
