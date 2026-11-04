import type { MouseEvent } from "react"

import { useT } from "@/lib/i18n/use-t"
import { resultsHeadingId } from "./results-header"
import {
  Pagination,
  PaginationContent,
  PaginationEllipsis,
  PaginationItem,
  PaginationLink,
  PaginationNext,
  PaginationPrevious,
} from "@/components/ui/pagination"

// First, last and the pages around the current one, with gaps shown as ellipses.
function windowOf(page: number, count: number) {
  const pages = new Set([1, count, page - 1, page, page + 1])
  const sorted = [...pages]
    .filter((p) => p >= 1 && p <= count)
    .sort((a, b) => a - b)
  const out: (number | "gap")[] = []
  sorted.forEach((p, i) => {
    if (i > 0 && p - sorted[i - 1]! > 1) out.push("gap")
    out.push(p)
  })
  return out
}

// Real links, so each page has a URL crawlers and the back button can use. A plain click is handed to `onPageChange` to navigate without a reload, then the results heading takes focus.
export function ResultsPagination({
  page,
  pageCount,
  hrefFor,
  onPageChange,
}: {
  page: number
  pageCount: number
  hrefFor: (page: number) => string
  onPageChange: (page: number) => void
}) {
  const { t } = useT()
  if (pageCount <= 1) return null
  const link = (p: number) => ({
    role: "link",
    href: hrefFor(p),
    onClick: (e: MouseEvent) => {
      if (e.metaKey || e.ctrlKey || e.shiftKey || e.button !== 0) return
      e.preventDefault()
      onPageChange(p)
      // The new page starts at its heading: scrolled to at once, never smoothly, and focused for screen readers.
      const heading = document.getElementById(resultsHeadingId)
      heading?.scrollIntoView({ block: "start" })
      heading?.focus({ preventScroll: true })
    },
  })
  return (
    <Pagination aria-label={t("search.pagination")}>
      <PaginationContent>
        {page > 1 && (
          <PaginationItem>
            <PaginationPrevious
              text={t("common.previous")}
              {...link(page - 1)}
            />
          </PaginationItem>
        )}
        {windowOf(page, pageCount).map((p, i) => (
          <PaginationItem key={p === "gap" ? `gap-${i}` : p}>
            {p === "gap" ? (
              <PaginationEllipsis />
            ) : (
              <PaginationLink
                isActive={p === page}
                aria-label={t("search.go_to_page", { page: p })}
                {...link(p)}
              >
                <span className="num">{p}</span>
              </PaginationLink>
            )}
          </PaginationItem>
        ))}
        {page < pageCount && (
          <PaginationItem>
            <PaginationNext text={t("common.next")} {...link(page + 1)} />
          </PaginationItem>
        )}
      </PaginationContent>
    </Pagination>
  )
}
