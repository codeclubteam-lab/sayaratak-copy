import { MediaImage } from "@/components/app/media-image"
import { useT } from "@/lib/i18n/use-t"
import type { AdminBusiness } from "@sayaratak/shared/schemas/admin"

// Logo or photo and the business name as one button that opens its sheet.
export function BusinessCell({
  business,
  onOpen,
}: {
  business: AdminBusiness
  onOpen: () => void
}) {
  const { locale } = useT()
  return (
    <button
      type="button"
      onClick={onOpen}
      className="flex min-h-11 max-w-72 min-w-0 items-center gap-3 rounded-lg text-start motion-color hover:text-primary"
    >
      <MediaImage
        src={business.imageUrl || null}
        alt=""
        sizes="48px"
        className="size-10 shrink-0 rounded-lg"
      />
      <span className="truncate text-ui font-medium">
        <bdi>{business.name[locale]}</bdi>
      </span>
    </button>
  )
}
