import { CopyButton } from "@/components/app/copy-button"
import { useT } from "@/lib/i18n/use-t"
import { localeHref } from "@/lib/navigation"
import { origin } from "@/lib/seo"

// The public page address. The slug is set when the business is created and never changes.
export function PublicAddress({ path }: { path: string }) {
  const { t, locale } = useT()
  const url = origin() + localeHref(path, locale)
  return (
    <div className="flex flex-col gap-1">
      <span className="text-ui font-medium">
        {t("dashboard.profile_address")}
      </span>
      <div className="flex items-center gap-2 rounded-lg bg-muted ps-3">
        <bdi dir="ltr" className="min-w-0 flex-1 truncate text-ui">
          {url}
        </bdi>
        <CopyButton value={url} label={t("dashboard.profile_copy")} />
      </div>
      <p className="text-caption text-muted-foreground">
        {t("dashboard.profile_address_hint")}
      </p>
    </div>
  )
}
