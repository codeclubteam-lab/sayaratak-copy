import { KeyboardIcon } from "lucide-react"

import { Kbd } from "@/components/ui/kbd"
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover"
import { Switch } from "@/components/ui/switch"
import { buttonVariants } from "@/components/ui/button"
import { useT } from "@/lib/i18n/use-t"
import { cn } from "@/lib/utils"

// Lists the queue's keys and turns them off (WCAG 2.1.4).
export function ShortcutsPopover({
  on,
  onChange,
}: {
  on: boolean
  onChange: (on: boolean) => void
}) {
  const { t } = useT()
  const keys = [
    ["J", t("admin.shortcut_next")],
    ["K", t("admin.shortcut_prev")],
    ["A", t("admin.approve")],
    ["R", t("admin.reject")],
  ]
  return (
    <Popover>
      <PopoverTrigger
        aria-label={t("admin.shortcuts")}
        className={cn(buttonVariants({ variant: "outline", size: "icon" }))}
      >
        <KeyboardIcon aria-hidden="true" strokeWidth={1.5} className="size-5" />
      </PopoverTrigger>
      <PopoverContent
        align="end"
        aria-label={t("admin.shortcuts")}
        className="w-72 gap-3"
      >
        <p className="text-ui font-semibold">{t("admin.shortcuts")}</p>
        <dl className="grid grid-cols-[auto_1fr] items-center gap-x-3 gap-y-2 text-ui">
          {keys.map(([key, label]) => (
            <div key={key} className="contents">
              <dt>
                <Kbd>{key}</Kbd>
              </dt>
              <dd>{label}</dd>
            </div>
          ))}
        </dl>
        <p className="text-caption text-muted-foreground">
          {t("admin.shortcuts_hint")}
        </p>
        <label className="flex items-center gap-3 text-ui">
          <Switch checked={on} onCheckedChange={onChange} />
          {t("admin.shortcuts_on")}
        </label>
      </PopoverContent>
    </Popover>
  )
}
