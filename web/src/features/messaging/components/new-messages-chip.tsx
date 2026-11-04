import { ArrowDownIcon } from "lucide-react"

import { Button } from "@/components/ui/button"
import { useT } from "@/lib/i18n/use-t"

// Shown above the composer when messages arrive while the reader is scrolled up; pressing it jumps to the newest.
export function NewMessagesChip({ onPress }: { onPress: () => void }) {
  const { t } = useT()
  return (
    <div className="pointer-events-none absolute inset-x-0 bottom-2 flex justify-center">
      <Button
        type="button"
        size="sm"
        onClick={onPress}
        className="pointer-events-auto rounded-full shadow-floating"
      >
        <ArrowDownIcon aria-hidden="true" data-icon="inline-start" />
        {t("common.new_messages")}
      </Button>
    </div>
  )
}
