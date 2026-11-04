import { useQuery } from "@tanstack/react-query"

import { ImageUploader } from "@/components/app/image-uploader"
import { PageHeader } from "@/components/app/page-header"
import { SectionError } from "@/components/app/section-error"
import { buttonVariants } from "@/components/ui/button"
import { Skeleton } from "@/components/ui/skeleton"
import { toast } from "@/components/ui/toast"
import { billingQueries } from "@/features/billing/queries"
import { usePageTitle } from "@/features/dashboard/components/page-title"
import {
  businessQueries,
  useSaveBusinessImages,
} from "@/features/directory/queries"
import { errorText } from "@/lib/api/error-text"
import { useT } from "@/lib/i18n/use-t"
import { localeHref } from "@/lib/navigation"
import { workshopSchema } from "@sayaratak/shared/schemas/profile"

// The workshop's public gallery: upload, reorder, remove. Each change saves at once.
export function PhotosPage() {
  const { t, locale } = useT()
  const title = t("dashboard.nav_photos")
  usePageTitle(title)
  const mine = useQuery(businessQueries.mine)
  const save = useSaveBusinessImages()
  const w = workshopSchema.safeParse(mine.data).data
  const cap = useQuery(billingQueries.subscription).data?.plan?.photoLimit

  return (
    <div className="flex flex-col gap-6">
      <PageHeader title={title} hint={t("dashboard.photos_hint")} />
      {mine.isError && !w ? (
        <SectionError
          message={t("dashboard.photos_load_error")}
          onRetry={() => void mine.refetch()}
        />
      ) : !w ? (
        <Skeleton
          role="status"
          aria-label={t("common.loading")}
          className="h-64 w-full rounded-xl"
        />
      ) : (
        <section className="flex flex-col gap-3 rounded-xl bg-card p-4 md:p-5">
          {cap !== undefined && (
            <p className="text-caption text-muted-foreground">
              {t("dashboard.photos_plan_limit", { count: cap })}{" "}
              <a
                href={localeHref("/workshop/billing", locale)}
                className={buttonVariants({ variant: "link", size: "sm" })}
              >
                {t("post.limit_upgrade")}
              </a>
            </p>
          )}
          <ImageUploader
            mode="multi"
            max={cap ?? 20}
            cover={false}
            label={t("dashboard.photos_label")}
            value={w.images}
            onChange={(images) =>
              save.mutate(images, {
                onSuccess: () =>
                  toast.add({ title: t("toast.photos_updated") }),
                onError: (error) => toast.add({ title: errorText(t, error) }),
              })
            }
          />
        </section>
      )}
    </div>
  )
}
