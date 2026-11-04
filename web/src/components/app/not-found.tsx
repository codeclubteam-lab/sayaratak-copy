import { buttonVariants } from "@/components/ui/button"
import { cn } from "@/lib/utils"
import { useT } from "@/lib/i18n/use-t"
import { localeHref } from "@/lib/navigation"
import { StatePanel } from "./state-panel"

// Native links: /search is built in a later phase and is not a typed route yet.
export function NotFound() {
  const { t, locale } = useT()
  return (
    <StatePanel
      title={t("error.not_found_title")}
      body={t("error.not_found_body")}
    >
      <a href={localeHref("/search", locale)} className={buttonVariants()}>
        {t("error.search_listings")}
      </a>
      <a
        href={localeHref("/", locale)}
        className={cn(buttonVariants({ variant: "outline" }))}
      >
        {t("error.go_home")}
      </a>
    </StatePanel>
  )
}
