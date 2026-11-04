import { useEffect, useRef, useState } from "react"
import { useQuery } from "@tanstack/react-query"
import type { FieldValues, UseFormReturn } from "react-hook-form"
import { z } from "zod"

import {
  draftQuery,
  saveDraftOnExit,
  useSaveDraft,
} from "@/features/auth/queries"
import { meQuery } from "@/features/auth/me-query"

const SAVE_DELAY = 800

const stored = z.object({
  savedAt: z.string(),
  values: z.record(z.string(), z.unknown()),
})
type Stored = z.infer<typeof stored>
export type WizardBase = { values: FieldValues; updatedAt: string }

const sessionKey = (key: string) => `sy:draft:${key}`
function readSession(key: string) {
  try {
    const parsed = stored.safeParse(
      JSON.parse(sessionStorage.getItem(sessionKey(key)) ?? "null")
    )
    return parsed.success ? parsed.data : null
  } catch {
    return null
  }
}
export function clearSessionDraft(key: string) {
  try {
    sessionStorage.removeItem(sessionKey(key))
  } catch {
    // Storage is blocked; there is nothing stored to remove.
  }
}
function writeSession(key: string, draft: Stored) {
  try {
    sessionStorage.setItem(sessionKey(key), JSON.stringify(draft))
  } catch {
    // Storage is full or blocked; a signed-in person still has the server copy.
  }
}
const snapshot = (values: FieldValues): Stored => ({
  savedAt: new Date().toISOString(),
  values,
})
const time = (draft: Stored) => Date.parse(draft.savedAt)

// Keeps the form values of the whole wizard: in sessionStorage 800 ms after the last change, and for a signed-in person also on the server when `saveNow` runs (each step change). Read back in an effect, never during render, so server rendering stays clean. The newest draft wins, and it beats the data of the listing being edited only when it is newer than that listing's `updatedAt`.
export function useWizardDraft({
  form,
  draftKey,
  base,
}: {
  form: UseFormReturn<FieldValues>
  draftKey: string
  // The listing being edited as form values: `undefined` while it loads, `null` for a new listing.
  base: WizardBase | null | undefined
}) {
  const me = useQuery(meQuery).data
  const server = useQuery({ ...draftQuery(draftKey), enabled: !!me })
  const save = useSaveDraft(draftKey)
  const [restored, setRestored] = useState(false)
  // Set once the listing is saved: nothing writes the draft again after that.
  const closed = useRef(false)
  const ready = base !== undefined && (!me || !server.isPending)

  useEffect(() => {
    if (restored || !ready) return
    const drafts = [
      readSession(draftKey),
      stored.safeParse(server.data?.data).data ?? null,
    ].filter((d) => d !== null)
    const newest = drafts.sort((a, b) => time(b) - time(a))[0]
    const from =
      newest && (!base || time(newest) > Date.parse(base.updatedAt))
        ? newest.values
        : base?.values
    // The step body is not rendered before `restored`, so the form still holds only its defaults.
    if (from) form.reset({ ...form.getValues(), ...from })
    setRestored(true)
  }, [restored, ready, draftKey, base, server.data, form])

  useEffect(() => {
    if (!restored) return
    let timer: ReturnType<typeof setTimeout> | undefined
    let changed = false
    const flush = (toServer: boolean) => {
      clearTimeout(timer)
      if (!changed || closed.current) return
      changed = false
      const draft = snapshot(form.getValues())
      writeSession(draftKey, draft)
      if (toServer && me) saveDraftOnExit(draftKey, draft)
    }
    const watching = form.watch(() => {
      changed = true
      clearTimeout(timer)
      timer = setTimeout(() => flush(false), SAVE_DELAY)
    })
    const onHide = () => document.visibilityState === "hidden" && flush(true)
    const onPageHide = () => flush(true)
    document.addEventListener("visibilitychange", onHide)
    window.addEventListener("pagehide", onPageHide)
    return () => {
      flush(true)
      watching.unsubscribe()
      document.removeEventListener("visibilitychange", onHide)
      window.removeEventListener("pagehide", onPageHide)
    }
  }, [restored, draftKey, form, me])

  // Step changes and "Save draft and exit": both copies now.
  const saveNow = () => {
    const draft = snapshot(form.getValues())
    writeSession(draftKey, draft)
    if (me) save.mutate(draft)
  }

  // After a successful publish: both copies of the draft go, and the form stops saving.
  const clear = () => {
    closed.current = true
    clearSessionDraft(draftKey)
    if (me) saveDraftOnExit(draftKey, {})
  }

  return { restored, saveNow, clear }
}
