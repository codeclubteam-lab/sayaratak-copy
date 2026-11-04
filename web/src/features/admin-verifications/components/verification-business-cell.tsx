import { MediaImage } from "@/components/app/media-image"
import { useT } from "@/lib/i18n/use-t"
import type { AdminVerification } from "@sayaratak/shared/schemas/admin"

// Logo and business name as one button that opens the request's sheet.
export function VerificationBusinessCell({
  request,
  onOpen,
}: {
  request: AdminVerification
  onOpen: () => void
}) {
  const { t, locale } = useT()
  const { target } = request
  return (
    <button
      type="button"
      onClick={onOpen}
      className="flex min-h-11 max-w-72 min-w-0 items-center gap-3 rounded-lg text-start motion-color hover:text-primary"
    >
      <MediaImage
        src={target?.imageUrl ?? null}
        alt=""
        sizes="48px"
        className="size-10 shrink-0 rounded-lg"
      />
      <span className="truncate text-ui font-medium">
        <bdi>{target?.name[locale] ?? t("admin.verification_target_gone")}</bdi>
      </span>
    </button>
  )
}
