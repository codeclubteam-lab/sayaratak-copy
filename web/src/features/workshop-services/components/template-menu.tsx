import { ChevronDownIcon } from "lucide-react"

import { Button } from "@/components/ui/button"
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"
import { useT } from "@/lib/i18n/use-t"

// "Add from templates": the common services the workshop has not added yet. A pick opens the form filled in, so a price can go in before saving. Hidden once every template is used.
export function TemplateMenu({
  templates,
  onPick,
}: {
  templates: { id: string; name: string }[]
  onPick: (template: { id: string; name: string }) => void
}) {
  const { t } = useT()
  if (templates.length === 0) return null
  return (
    <DropdownMenu>
      <DropdownMenuTrigger render={<Button variant="outline" />}>
        {t("dashboard.services_from_templates")}
        <ChevronDownIcon data-icon="inline-end" aria-hidden="true" />
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="max-h-80">
        {templates.map((s) => (
          <DropdownMenuItem
            key={s.id}
            className="min-h-11 md:min-h-10"
            onClick={() => onPick(s)}
          >
            {s.name}
          </DropdownMenuItem>
        ))}
      </DropdownMenuContent>
    </DropdownMenu>
  )
}
