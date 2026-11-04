import { useState, type ComponentProps } from "react"

import { Button } from "@/components/ui/button"
import { ConfirmDialog } from "./confirm-dialog"

// A button that asks first: only the dialog's confirm runs `onConfirm`. For a decision that tells someone or publishes something (approve, restore). Removals use RemoveButton.
export function ConfirmButton({
  title,
  description,
  confirmLabel,
  onConfirm,
  ...props
}: Omit<ComponentProps<typeof Button>, "onClick" | "type" | "title"> & {
  title: string
  description?: string
  confirmLabel: string
  onConfirm: () => void
}) {
  const [open, setOpen] = useState(false)
  return (
    <>
      <Button type="button" {...props} onClick={() => setOpen(true)} />
      <ConfirmDialog
        open={open}
        onOpenChange={setOpen}
        title={title}
        description={description}
        confirmLabel={confirmLabel}
        onConfirm={() => {
          setOpen(false)
          onConfirm()
        }}
      />
    </>
  )
}
