import { fireEvent, screen, waitFor } from "@testing-library/react"
import { useRouterState } from "@tanstack/react-router"
import { useFormContext } from "react-hook-form"
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest"
import { z } from "zod"

import { ListingWizard } from "@/features/listings/wizard/listing-wizard"
import {
  firstInvalidIndex,
  wizardSearchSchema,
  type WizardStep,
} from "@/features/listings/wizard/wizard-config"
import type { WizardBase } from "@/features/listings/wizard/use-wizard-draft"
import { db, resetDb } from "@/mocks/db"
import { renderShell } from "./shell-render"

function NameField() {
  const { register, formState } = useFormContext()
  return (
    <>
      <input aria-label="Name" {...register("name")} />
      {formState.errors.name && (
        <p role="alert">{String(formState.errors.name.message)}</p>
      )}
    </>
  )
}
function NoteField() {
  const { register } = useFormContext()
  return <input aria-label="Note" {...register("note")} />
}
const steps: WizardStep[] = [
  {
    id: "a",
    labelKey: "post.step_type",
    titleKey: "post.step_type",
    Component: NameField,
    schema: () => z.object({ name: z.string().min(1, "validation.required") }),
  },
  {
    id: "b",
    labelKey: "post.step_details",
    titleKey: "post.step_details",
    Component: NoteField,
  },
]

// The route passes `step` from its search param; the stub route has no validator, so read it raw.
function Harness({
  base,
  editId,
  onPublish = () => Promise.resolve(),
}: {
  base?: WizardBase
  editId?: string
  onPublish?: () => Promise<unknown>
}) {
  const stepId = useRouterState({
    select: (s) => new URLSearchParams(s.location.searchStr).get("step") ?? "a",
  })
  return (
    <ListingWizard
      context="public"
      stepId={stepId}
      steps={steps}
      editId={editId}
      base={base}
      onPublish={onPublish}
    />
  )
}

const open = (
  props: Parameters<typeof Harness>[0] = {},
  options: { role?: "user"; step?: string } = {}
) =>
  renderShell(<Harness {...props} />, {
    role: options.role,
    path: `/en/post?step=${options.step ?? "a"}${props.editId ? `&edit=${props.editId}` : ""}`,
  })
const step = (shell: Awaited<ReturnType<typeof open>>) =>
  new URLSearchParams(shell.router.state.location.searchStr).get("step")
const name = () => screen.findByLabelText<HTMLInputElement>("Name")
const type = (label: string, value: string) =>
  fireEvent.change(screen.getByLabelText(label), { target: { value } })
const next = () => fireEvent.click(screen.getByRole("button", { name: "Next" }))

beforeEach(() => {
  resetDb()
  sessionStorage.clear()
  window.scrollTo = vi.fn()
})
afterEach(() => vi.restoreAllMocks())

describe("wizard config", () => {
  it("search schema falls back to the type step", () => {
    expect(wizardSearchSchema.parse({ step: "nope" }).step).toBe("type")
    expect(wizardSearchSchema.parse({}).step).toBe("type")
    expect(wizardSearchSchema.parse({ step: "done", listing: "l1" })).toEqual({
      step: "done",
      listing: "l1",
    })
  })
  it("the furthest step is the first with failing rules, or the last", () => {
    expect(firstInvalidIndex(steps, {})).toBe(0)
    expect(firstInvalidIndex(steps, { name: "x" })).toBe(1)
  })
})

describe("ListingWizard", () => {
  it("does not reserve a blank error line under each field (long forms stay short)", async () => {
    await open()
    await name()
    expect(document.querySelector("[data-reserve-errors]")).toBeNull()
  })

  it("keeps values across refresh, Back and a step jump", async () => {
    const error = vi.spyOn(console, "error")
    const first = await open()
    fireEvent.change(await name(), { target: { value: "Toyota" } })
    next()
    await waitFor(() => expect(step(first)).toBe("b"))
    type("Note", "clean")
    fireEvent.click(screen.getByRole("button", { name: "Back" }))
    await waitFor(() => expect(step(first)).toBe("a"))
    expect((await name()).value).toBe("Toyota")
    first.unmount()

    // A refresh: new page, same tab. The step at the URL is b.
    const again = await open({}, { step: "b" })
    await waitFor(() =>
      expect(screen.getByLabelText<HTMLInputElement>("Note").value).toBe(
        "clean"
      )
    )
    expect(step(again)).toBe("b")
    // The indicator jumps back to a completed step.
    expect(
      screen.getByRole("link", { name: "Type" }).getAttribute("href")
    ).toBe("/en/post?step=a")
    expect(error).not.toHaveBeenCalled()
  })

  it("the first render matches the server: no restored values until the effect", async () => {
    sessionStorage.setItem(
      "sy:draft:listing:new",
      JSON.stringify({
        savedAt: new Date().toISOString(),
        values: { name: "Saved" },
      })
    )
    await open()
    // Fields mount only after the draft is read, so nothing rendered can differ from the server's markup.
    expect((await name()).value).toBe("Saved")
  })

  it("Next on an invalid step stays and does not move on", async () => {
    const shell = await open()
    await name()
    next()
    expect((await screen.findByRole("alert")).textContent).toBe(
      "validation.required"
    )
    expect(step(shell)).toBe("a")
  })

  it("a step opens only when the earlier ones are valid", async () => {
    const shell = await open({}, { step: "b" })
    await waitFor(() => expect(step(shell)).toBe("a"))
    expect(screen.queryByRole("link", { name: "Details" })).toBeNull()
  })

  it("Back on the first step leaves the wizard and keeps the draft", async () => {
    const shell = await open()
    fireEvent.change(await name(), { target: { value: "Kept" } })
    fireEvent.click(screen.getByRole("button", { name: "Back" }))
    await waitFor(() =>
      expect(shell.router.state.location.pathname).toBe("/en")
    )
    expect(sessionStorage.getItem("sy:draft:listing:new")).toContain("Kept")
  })

  it("Save draft and exit leaves for home with the draft saved", async () => {
    const shell = await open({}, { role: "user" })
    fireEvent.change(await name(), { target: { value: "Later" } })
    fireEvent.click(screen.getByRole("button", { name: "Save draft and exit" }))
    await waitFor(() =>
      expect(shell.router.state.location.pathname).toBe("/en")
    )
    expect(sessionStorage.getItem("sy:draft:listing:new")).toContain("Later")
    await waitFor(() =>
      expect(
        db.drafts.find((d) => d.key === "listing:new")?.data
      ).toMatchObject({ values: { name: "Later" } })
    )
  })

  it("a signed-in person saves to the server on each step change and gets it back", async () => {
    const first = await open({}, { role: "user" })
    fireEvent.change(await name(), { target: { value: "Server" } })
    next()
    await waitFor(() => expect(step(first)).toBe("b"))
    await waitFor(() =>
      expect(
        db.drafts.find((d) => d.key === "listing:new")?.data
      ).toMatchObject({ values: { name: "Server" } })
    )
    first.unmount()
    sessionStorage.clear()
    await open({}, { role: "user" })
    expect((await name()).value).toBe("Server")
  })

  it("the draft beats the edited listing only when it is newer", async () => {
    const draft = (savedAt: string) =>
      sessionStorage.setItem(
        "sy:draft:listing:edit:l1",
        JSON.stringify({ savedAt, values: { name: "Draft" } })
      )
    const base = (updatedAt: string): WizardBase => ({
      updatedAt,
      values: { name: "Listing" },
    })
    draft("2026-10-02T00:00:00.000Z")
    const older = await open({
      editId: "l1",
      base: base("2026-10-03T00:00:00.000Z"),
    })
    expect((await name()).value).toBe("Listing")
    older.unmount()
    const newer = await open({
      editId: "l1",
      base: base("2026-10-01T00:00:00.000Z"),
    })
    expect((await name()).value).toBe("Draft")
    newer.unmount()
  })

  it("waits for an edited listing to load before showing fields", async () => {
    await open({ editId: "l1" })
    expect(screen.queryByLabelText("Name")).toBeNull()
  })

  it("Publish on the last step calls onPublish with every step's values", async () => {
    const onPublish = vi.fn(() => Promise.resolve())
    const shell = await open({ onPublish })
    fireEvent.change(await name(), { target: { value: "All" } })
    next()
    await waitFor(() => expect(step(shell)).toBe("b"))
    type("Note", "done")
    fireEvent.click(screen.getByRole("button", { name: "Publish" }))
    await waitFor(() =>
      expect(onPublish).toHaveBeenCalledWith({ name: "All", note: "done" })
    )
  })
})
