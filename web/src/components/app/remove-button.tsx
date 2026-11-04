import { useState, type ComponentProps } from "react"

import { useT } from "@/lib/i18n/use-t"
import { Button } from "@/components/ui/button"
import { ConfirmDialog } from "./confirm-dialog"

// Every Remove in the app goes through here: the button asks first, and only the dialog's Remove runs `onConfirm`. Pass the Button props (variant, size, aria-label, children) as usual.
export function RemoveButton({
  title,
  onConfirm,
  ...props
}: Omit<ComponentProps<typeof Button>, "onClick" | "type"> & {
  // The question the dialog asks, such as "Remove this photo?".
  title: string
  onConfirm: () => void
}) {
  const { t } = useT()
  const [open, setOpen] = useState(false)
  return (
    <>
      <Button type="button" {...props} onClick={() => setOpen(true)} />
      <ConfirmDialog
        open={open}
        onOpenChange={setOpen}
        title={title}
        confirmLabel={t("common.remove")}
        destructive
        onConfirm={() => {
          setOpen(false)
          onConfirm()
        }}
      />
    </>
  )
}
