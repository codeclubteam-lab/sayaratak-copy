import { useState } from "react"

import { ConfirmDialog } from "@/components/app/confirm-dialog"
import { Switch } from "@/components/ui/switch"

// A switch that saves only after a confirm. `onConfirm` returns the mutation's promise; the dialog closes when it settles.
export function StatusSwitch({
  checked,
  label,
  confirmTitle,
  confirmBody,
  confirmLabel,
  destructive,
  onConfirm,
}: {
  checked: boolean
  // Names the switch for screen readers, e.g. "Verified, Al Nile Motors".
  label: string
  confirmTitle: (next: boolean) => string
  confirmBody?: (next: boolean) => string
  confirmLabel: (next: boolean) => string
  destructive?: (next: boolean) => boolean
  onConfirm: (next: boolean) => Promise<unknown>
}) {
  const [asking, setAsking] = useState(false)
  const [pending, setPending] = useState(false)
  const next = !checked
  return (
    <>
      <Switch
        checked={checked}
        aria-label={label}
        onCheckedChange={() => setAsking(true)}
      />
      <ConfirmDialog
        open={asking}
        onOpenChange={setAsking}
        title={confirmTitle(next)}
        description={confirmBody?.(next)}
        confirmLabel={confirmLabel(next)}
        destructive={destructive?.(next)}
        pending={pending}
        onConfirm={() => {
          setPending(true)
          void onConfirm(next)
            .catch(() => undefined)
            .finally(() => {
              setPending(false)
              setAsking(false)
            })
        }}
      />
    </>
  )
}
