import { useT } from "@/lib/i18n/use-t"
import { ContactActions } from "./contact-actions"

// Fixed at the bottom below lg, in place of the aside. The `data-mobile-contact-bar` attribute is how the public layout knows to hide the tab bar and pad the page, so only one bar is ever fixed (CSS `:has`, so it also works in server HTML).
export function MobileContactBar(props: Parameters<typeof ContactActions>[0]) {
  const { t } = useT()
  return (
    <div
      data-mobile-contact-bar
      role="region"
      aria-label={t("listing.contact_bar")}
      className="fixed inset-x-0 bottom-0 z-(--z-sticky) border-t border-border bg-card p-2 pb-[calc(8px+env(safe-area-inset-bottom))] [view-transition-name:contact-bar] lg:hidden"
    >
      <ContactActions {...props} layout="bar" />
    </div>
  )
}
