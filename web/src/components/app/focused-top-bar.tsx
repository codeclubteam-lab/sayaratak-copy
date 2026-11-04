import type { ReactNode } from "react"

import { Button } from "@/components/ui/button"
import { BrandLogo } from "./brand-logo"
import { LanguageSwitcher } from "./language-switcher"

// Top bar of onboarding and the post wizard. No navigation links, so nothing pulls the person out of the flow.
export function FocusedTopBar({
  start,
  action,
}: {
  start?: ReactNode
  action?: { label: string; onClick: () => void; disabled?: boolean }
}) {
  return (
    <header className="flex h-16 items-center justify-between gap-3 px-4 md:px-6">
      {start ?? <BrandLogo />}
      <div className="flex items-center gap-2">
        <LanguageSwitcher />
        {action && (
          <Button
            type="button"
            variant="ghost"
            disabled={action.disabled}
            onClick={action.onClick}
          >
            {action.label}
          </Button>
        )}
      </div>
    </header>
  )
}
