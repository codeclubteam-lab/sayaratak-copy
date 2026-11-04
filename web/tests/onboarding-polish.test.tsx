import { useState } from "react"
import { fireEvent, render, screen, waitFor } from "@testing-library/react"
import { useRouterState } from "@tanstack/react-router"
import { useFormContext } from "react-hook-form"
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest"
import { z } from "zod"

import { FormField } from "@/components/app/form-field"
import { PhoneInput } from "@/components/app/phone-input"
import { OnboardingStepPage } from "@/features/onboarding/components/onboarding-step-page"
import type { FlowStep } from "@/features/onboarding/flows"
import { db, resetDb } from "@/mocks/db"
import { renderShell } from "./shell-render"

beforeEach(() => {
  resetDb()
  window.scrollTo = vi.fn()
  vi.stubGlobal("matchMedia", () => ({
    matches: false,
    addEventListener: () => {},
    removeEventListener: () => {},
  }))
})
afterEach(() => vi.unstubAllGlobals())

function TwoFields() {
  const { register } = useFormContext()
  return (
    <>
      <input aria-label="Name" {...register("name")} />
      <input aria-label="Other" {...register("other")} />
    </>
  )
}
function WithAbout() {
  const { register } = useFormContext()
  return (
    <>
      <TwoFields />
      <textarea aria-label="About" {...register("about")} />
    </>
  )
}
// Not an input, so RHF has no ref to focus on a failed submit.
function PickButton() {
  const { formState } = useFormContext()
  return (
    <FormField label="Pick" error={formState.errors.pick?.message as string}>
      {(control) => (
        <button type="button" {...control}>
          Pick
        </button>
      )}
    </FormField>
  )
}
const step = (extra: Partial<FlowStep> = {}): FlowStep => ({
  id: "a",
  titleKey: "onboarding.step_dealership_business_title",
  helperKey: "onboarding.step_dealership_business_helper",
  schema: z.object({ name: z.string().min(1, "validation.required") }),
  Component: TwoFields,
  ...extra,
})
const second: FlowStep = step({ id: "b", Component: () => null })

function Harness({ steps }: { steps: FlowStep[] }) {
  const stepId = useRouterState({
    select: (s) => s.location.pathname.split("/").pop() ?? "",
  })
  return <OnboardingStepPage role="dealership" stepId={stepId} steps={steps} />
}
const open = (steps: FlowStep[]) =>
  renderShell(<Harness steps={steps} />, {
    role: "user",
    path: "/en/onboarding/dealership/a",
  })
const owner = () => db.users.find((u) => u.role === "user" && u.onboardingDone)!
const draft = () =>
  db.drafts.find((d) => d.id === `${owner().id}:onboarding:dealership`)?.data
const hint = (name: string) =>
  screen.getByRole("textbox", { name }).getAttribute("enterkeyhint")

describe("onboarding step polish", () => {
  it("hints next on every input and done on the last of the last step", async () => {
    await open([step()])
    expect(hint("Name")).toBe("next")
    expect(hint("Other")).toBe("done")
  })

  it("gives a textarea no hint and keeps next on the input before it", async () => {
    await open([step({ Component: WithAbout })])
    expect(hint("Other")).toBe("next")
    expect(
      screen
        .getByRole("textbox", { name: "About" })
        .hasAttribute("enterkeyhint")
    ).toBe(false)
  })

  it("keeps next on the last input of a step that has a following step", async () => {
    await open([step(), second])
    expect(hint("Other")).toBe("next")
  })

  it("focuses the first field when the step opens on desktop", async () => {
    await open([step()])
    expect(document.activeElement).toBe(
      screen.getByRole("textbox", { name: "Name" })
    )
  })

  it("focuses the first invalid field on submit, a custom control too", async () => {
    await open([
      step({
        schema: z.object({
          name: z.string().min(1, "validation.required"),
          pick: z.string().min(1, "validation.required"),
        }),
        Component: () => (
          <>
            <TwoFields />
            <PickButton />
          </>
        ),
      }),
      second,
    ])
    const name = screen.getByRole("textbox", { name: "Name" })
    fireEvent.input(name, { target: { value: "Abc" } })
    ;(document.activeElement as HTMLElement).blur()
    fireEvent.click(screen.getByRole("button", { name: "Continue" }))
    await waitFor(() =>
      expect(document.activeElement).toBe(
        screen.getByRole("button", { name: "Pick" })
      )
    )
  })

  it("saves what was typed when the page is hidden, and only then", async () => {
    await open([step(), second])
    window.dispatchEvent(new Event("pagehide"))
    await new Promise((r) => setTimeout(r, 50))
    expect(draft()).toBeUndefined()
    fireEvent.input(screen.getByRole("textbox", { name: "Name" }), {
      target: { value: "Abc" },
    })
    window.dispatchEvent(new Event("pagehide"))
    await waitFor(() => expect(draft()).toMatchObject({ a: { name: "Abc" } }))
  })

  it("offers a retry inline when the save fails", async () => {
    const { router } = await open([step(), second])
    // Wraps the mock fetch the shell installed.
    const real = fetch
    let down = true
    vi.stubGlobal("fetch", (i: RequestInfo | URL, init?: RequestInit) =>
      down && init?.method === "PATCH"
        ? Promise.reject(new TypeError("offline"))
        : real(i, init)
    )
    fireEvent.input(screen.getByRole("textbox", { name: "Name" }), {
      target: { value: "Abc" },
    })
    fireEvent.click(screen.getByRole("button", { name: "Continue" }))
    expect(await screen.findByRole("alert")).toBeTruthy()
    down = false
    fireEvent.click(screen.getByRole("button", { name: "Try again" }))
    await waitFor(() =>
      expect(router.state.location.pathname).toBe("/en/onboarding/dealership/b")
    )
  })
})

describe("phone paste", () => {
  const paste = (el: HTMLElement, text: string) =>
    fireEvent.paste(el, { clipboardData: { getData: () => text } })

  it("cleans a pasted number into the national digits", () => {
    function Wrapper() {
      const [value, setValue] = useState("")
      return (
        <>
          <PhoneInput aria-label="Phone" value={value} onChange={setValue} />
          <output>{value}</output>
        </>
      )
    }
    render(<Wrapper />)
    const input = screen.getByLabelText("Phone")
    paste(input, "٠٩١٢ ٣٤٥-٦٧٨")
    expect(screen.getByRole("status").textContent).toBe("+249912345678")
    expect((input as HTMLInputElement).value).toBe("912345678")
    paste(input, "+249 91 234 5678")
    expect(screen.getByRole("status").textContent).toBe("+249912345678")
  })
})
