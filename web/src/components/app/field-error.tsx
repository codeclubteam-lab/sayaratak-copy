import { useT } from "@/lib/i18n/use-t"
import { FieldError as BaseFieldError } from "@/components/ui/field"

// Schema messages are i18n keys, so this is the one place they become text.
export function FieldError({
  message,
  id,
  className,
}: {
  message?: string
  id?: string
  className?: string
}) {
  const { t } = useT()
  // Flows mark themselves with data-reserve-errors: the line stays reserved, so an error never shifts the layout.
  return (
    <div className="contents [[data-reserve-errors]_&]:block [[data-reserve-errors]_&]:min-h-5">
      {message && (
        <BaseFieldError id={id} className={className}>
          {t(message)}
        </BaseFieldError>
      )}
    </div>
  )
}
