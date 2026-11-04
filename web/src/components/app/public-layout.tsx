import { Outlet } from "@tanstack/react-router"

import { useT } from "@/lib/i18n/use-t"
import { Footer } from "./footer"
import { Header } from "./header"
import { MobileTabBar } from "./mobile-tab-bar"

export function PublicLayout() {
  const { t } = useT()
  return (
    <div className="flex min-h-dvh flex-col pb-[calc(56px+env(safe-area-inset-bottom))] has-[[data-mobile-contact-bar]]:pb-[calc(80px+env(safe-area-inset-bottom))] md:pb-0 md:has-[[data-mobile-contact-bar]]:pb-[calc(80px+env(safe-area-inset-bottom))] lg:has-[[data-mobile-contact-bar]]:pb-0">
      <a
        href="#main-content"
        className="sr-only z-(--z-dialog) rounded-lg bg-primary px-4 py-3 text-ui font-medium text-primary-foreground focus:not-sr-only focus:fixed focus:start-4 focus:top-2"
        onClick={() => document.getElementById("main-content")?.focus()}
      >
        {t("nav.skip_to_content")}
      </a>
      <Header />
      <main
        id="main-content"
        tabIndex={-1}
        className="mx-auto w-full max-w-[1200px] flex-1 px-4 md:px-6"
      >
        <Outlet />
      </main>
      <Footer />
      <MobileTabBar />
    </div>
  )
}
