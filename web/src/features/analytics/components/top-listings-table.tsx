import { useId } from "react"
import { Link } from "@tanstack/react-router"
import { CarIcon, PencilIcon } from "lucide-react"

import { EmptyState } from "@/components/app/empty-state"
import { MediaImage } from "@/components/app/media-image"
import { buttonVariants } from "@/components/ui/button"
import { Skeleton } from "@/components/ui/skeleton"
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table"
import { formatNumber } from "@/lib/format"
import { useT } from "@/lib/i18n/use-t"
import type { Analytics } from "@sayaratak/shared/schemas/responses"

// Contacts (calls and WhatsApp) divided by views, as a whole percent.
const conversion = (contacts: number, views: number) =>
  views ? Math.round((contacts / views) * 100) : undefined

// The ten listings with the most views in the period. The title opens the public page, Edit opens the editor.
export function TopListingsTable({
  rows,
  loading,
}: {
  rows?: Analytics["topListings"]
  loading?: boolean
}) {
  const { t, locale } = useT()
  const id = useId()
  return (
    <section
      aria-labelledby={id}
      className="flex flex-col gap-4 rounded-xl bg-card p-5"
    >
      <h2 id={id} className="text-body font-semibold">
        {t("analytics.top_title")}
      </h2>
      {loading ? (
        <Skeleton className="h-64" aria-hidden="true" />
      ) : !rows?.length ? (
        <EmptyState
          icon={CarIcon}
          title={t("analytics.top_empty")}
          action={
            <Link
              to="/$locale/dealer/inventory/new"
              params={{ locale }}
              className={buttonVariants({ variant: "outline" })}
            >
              {t("listing.post")}
            </Link>
          }
          level={3}
          className="py-6"
        />
      ) : (
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>{t("analytics.col_listing")}</TableHead>
              <TableHead className="hidden text-end md:table-cell">
                {t("analytics.col_views")}
              </TableHead>
              <TableHead className="hidden text-end md:table-cell">
                {t("analytics.col_contacts")}
              </TableHead>
              <TableHead className="hidden text-end md:table-cell">
                {t("analytics.col_conversion")}
              </TableHead>
              <TableHead>
                <span className="sr-only">{t("manager.col_actions")}</span>
              </TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {rows.map((row) => {
              const rate = conversion(row.contacts, row.views)
              return (
                <TableRow key={row.id}>
                  <TableCell className="whitespace-normal md:whitespace-nowrap">
                    <div className="flex min-w-0 items-center gap-3">
                      <MediaImage
                        src={row.coverUrl}
                        alt=""
                        sizes="48px"
                        className="size-12 shrink-0 rounded-lg"
                      />
                      <div className="flex min-w-0 flex-col">
                        <Link
                          to="/$locale/listing/$slug"
                          params={{ locale, slug: row.slug }}
                          className="text-ui font-medium hover:text-primary md:max-w-xs md:truncate"
                        >
                          <bdi>{row.title}</bdi>
                        </Link>
                        {/* The number columns need room, so below md they sit under the title. */}
                        <span className="text-caption text-muted-foreground md:hidden">
                          {t("analytics.row_summary", {
                            views: formatNumber(row.views, locale),
                            contacts: formatNumber(row.contacts, locale),
                            rate:
                              rate === undefined
                                ? "—"
                                : `${formatNumber(rate, locale)}%`,
                          })}
                        </span>
                      </div>
                    </div>
                  </TableCell>
                  <TableCell className="hidden text-end num md:table-cell">
                    {formatNumber(row.views, locale)}
                  </TableCell>
                  <TableCell className="hidden text-end num md:table-cell">
                    {formatNumber(row.contacts, locale)}
                  </TableCell>
                  <TableCell className="hidden text-end num md:table-cell">
                    {rate === undefined ? (
                      <span aria-label={t("analytics.no_conversion")}>—</span>
                    ) : (
                      <bdi dir="ltr">{formatNumber(rate, locale)}%</bdi>
                    )}
                  </TableCell>
                  <TableCell className="text-end">
                    <Link
                      to="/$locale/dealer/inventory/$id/edit"
                      params={{ locale, id: row.id }}
                      aria-label={t("analytics.edit_listing", {
                        name: row.title,
                      })}
                      className={buttonVariants({ variant: "ghost" })}
                    >
                      <PencilIcon aria-hidden="true" />
                      <span className="hidden md:inline">
                        {t("common.edit")}
                      </span>
                    </Link>
                  </TableCell>
                </TableRow>
              )
            })}
          </TableBody>
        </Table>
      )}
    </section>
  )
}
