import { Leaf } from "lucide-react"

import { useT } from "@/lib/i18n/use-t"
import { usePrefs, useSetPrefs } from "@/lib/prefs"
import { Button } from "@/components/ui/button"

export function DataSaverToggle({ expanded = false }: { expanded?: boolean }) {
  const { t } = useT()
  const { dataSaver } = usePrefs()
  const setPrefs = useSetPrefs()
  return (
    <Button
      variant="ghost"
      size={expanded ? "default" : "icon"}
      aria-label={t("nav.data_saver")}
      aria-pressed={dataSaver}
      title={t(dataSaver ? "nav.data_saver_on" : "nav.data_saver_off")}
      onClick={() => setPrefs({ dataSaver: !dataSaver })}
      className={dataSaver ? "text-primary" : undefined}
    >
      <Leaf className="size-5" strokeWidth={1.5} aria-hidden="true" />
      {expanded && t("nav.data_saver")}
    </Button>
  )
}
