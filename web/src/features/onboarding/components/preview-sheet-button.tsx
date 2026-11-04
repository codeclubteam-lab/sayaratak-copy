import type { ReactNode } from "react"

import { Button } from "@/components/ui/button"
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
  SheetTrigger,
} from "@/components/ui/sheet"
import { useT } from "@/lib/i18n/use-t"

// Below lg the preview column is hidden; this opens the same preview in a bottom sheet.
export function PreviewSheetButton({ children }: { children: ReactNode }) {
  const { t } = useT()
  return (
    <Sheet>
      <SheetTrigger render={<Button variant="ghost" className="lg:hidden" />}>
        {t("onboarding.preview")}
      </SheetTrigger>
      <SheetContent side="bottom">
        <SheetHeader>
          <SheetTitle>{t("onboarding.preview")}</SheetTitle>
        </SheetHeader>
        <div className="px-4 pb-4">{children}</div>
      </SheetContent>
    </Sheet>
  )
}
