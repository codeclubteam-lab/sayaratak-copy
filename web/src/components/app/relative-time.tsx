import { formatRelative } from "@/lib/format"
import { useT } from "@/lib/i18n/use-t"
import { useNow } from "@/lib/now"

export function RelativeTime({
  iso,
  className,
}: {
  iso: string
  className?: string
}) {
  const { locale } = useT()
  const now = useNow()
  return (
    <time dateTime={iso} className={className}>
      {formatRelative(iso, now, locale)}
    </time>
  )
}
