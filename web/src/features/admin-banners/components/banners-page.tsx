import { useCallback, useState } from "react"
import { useNavigate, useSearch } from "@tanstack/react-router"
import { PlusIcon } from "lucide-react"

import { useT } from "@/lib/i18n/use-t"
import {
  adminTableSearchSchema,
  type AdminTableSearch,
} from "@/features/admin/schemas"
import { usePageTitle } from "@/features/dashboard/components/page-title"
import type { Banner } from "@sayaratak/shared/schemas/admin"
import { PageHeader } from "@/components/app/page-header"
import { Button } from "@/components/ui/button"
import { fromBanner, bannerFormDefaults, type BannerForm } from "../schemas"
import { BannerSheet, type BannerDraft } from "./banner-sheet"
import { BannersTable } from "./banners-table"

// All banners with their state and counts; the sheet creates, edits or duplicates one.
export function BannersPage() {
  const { t } = useT()
  const title = t("dashboard.nav_banners")
  usePageTitle(title)
  const search = adminTableSearchSchema.parse(useSearch({ strict: false }))
  const navigate = useNavigate()
  const go = useCallback(
    (next: AdminTableSearch, push = false) =>
      void navigate({
        to: ".",
        search: next,
        replace: !push,
        resetScroll: false,
      }),
    [navigate]
  )
  const [draft, setDraft] = useState<BannerDraft>()
  return (
    <div className="flex flex-col gap-6">
      <PageHeader title={title} hint={t("admin.banners_hint")}>
        <Button
          type="button"
          onClick={() => setDraft({ values: bannerFormDefaults() })}
        >
          <PlusIcon data-icon="inline-start" />
          {t("admin.banners_new")}
        </Button>
      </PageHeader>
      <BannersTable
        search={search}
        go={go}
        onEdit={(b: Banner) => setDraft({ id: b.id, values: fromBanner(b) })}
        onDuplicate={(b: Banner) =>
          setDraft({
            values: {
              ...fromBanner(b),
              title: t("admin.banners_copy_of", { name: b.title }),
              active: false,
            } satisfies Partial<BannerForm>,
          })
        }
      />
      <BannerSheet draft={draft} onClose={() => setDraft(undefined)} />
    </div>
  )
}
