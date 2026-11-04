import type { ReactNode } from "react"

import { useIsMobile } from "@/hooks/use-mobile"
import { Dialog, DialogContent, DialogTitle } from "@/components/ui/dialog"
import { Sheet, SheetContent, SheetTitle } from "@/components/ui/sheet"

// A dialog on desktop and a bottom sheet below md, the same pattern as the auth dialog.
export function ResponsiveDialog({
  open,
  onOpenChange,
  title,
  description,
  wide = false,
  closable = true,
  className = "",
  children,
}: {
  open: boolean
  onOpenChange: (open: boolean) => void
  title: string
  description?: string
  // A long body: the dialog widens to 4xl, both containers stop at 85% of the screen height and the body scrolls.
  wide?: boolean
  // False hides the close button, for a step that must not be left halfway.
  closable?: boolean
  // Extra classes for the dialog and the sheet, e.g. a different surface colour.
  className?: string
  children: ReactNode
}) {
  const mobile = useIsMobile()
  const body = (
    <>
      {description && (
        <p className="text-ui text-muted-foreground">{description}</p>
      )}
      {wide ? (
        <div className="-mx-6 min-h-0 overflow-y-auto px-6 pb-1">
          {children}
        </div>
      ) : (
        children
      )}
    </>
  )
  const size = `${wide ? "max-h-[85dvh] sm:max-w-4xl" : ""} ${className}`
  return mobile ? (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent
        side="bottom"
        showCloseButton={closable}
        className={`gap-4 p-6 ${size}`}
      >
        <SheetTitle>{title}</SheetTitle>
        {body}
      </SheetContent>
    </Sheet>
  ) : (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent
        showCloseButton={closable}
        className={`gap-4 p-6 ${size} ${wide ? "grid-rows-[auto_minmax(0,1fr)]" : ""}`}
      >
        <DialogTitle>{title}</DialogTitle>
        {body}
      </DialogContent>
    </Dialog>
  )
}
