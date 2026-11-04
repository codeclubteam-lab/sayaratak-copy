import { useState } from "react"
import type { QueryClient } from "@tanstack/react-query"
import {
  HeadContent,
  Outlet,
  Scripts,
  createRootRouteWithContext,
} from "@tanstack/react-router"
import { TanStackRouterDevtoolsPanel } from "@tanstack/react-router-devtools"
import { TanStackDevtools } from "@tanstack/react-devtools"
import { I18nextProvider } from "react-i18next"

import { DevPanelHost } from "@/components/app/dev-panel-host"
import { AuthDialogHost } from "@/features/auth/components/auth-dialog-host"
import { NavigationProgress } from "@/components/app/navigation-progress"
import { OfflineBanner } from "@/components/app/offline-banner"
import { meQuery } from "@/features/auth/me-query"
import { DirectionProvider } from "@/components/ui/direction"
import { Toaster } from "@/components/ui/toast"
import { createI18n } from "@/lib/i18n/create"
import { getRootData } from "@/lib/i18n/server"
import { NowProvider } from "@/lib/now"
import { PrefsProvider } from "@/lib/prefs"
import { isRtl } from "@/lib/utils"
import type { Locale } from "@sayaratak/shared/schemas/locale"
import appCss from "../styles.css?url"
import latin400 from "@fontsource/ibm-plex-sans/files/ibm-plex-sans-latin-400-normal.woff2?url"
import latin600 from "@fontsource/ibm-plex-sans/files/ibm-plex-sans-latin-600-normal.woff2?url"
import arabic400 from "@fontsource/ibm-plex-sans-arabic/files/ibm-plex-sans-arabic-arabic-400-normal.woff2?url"
import arabic600 from "@fontsource/ibm-plex-sans-arabic/files/ibm-plex-sans-arabic-arabic-600-normal.woff2?url"

// Preload only the active script's regular and semibold files.
const fontPreloads = (locale: Locale) =>
  (isRtl(locale) ? [arabic400, arabic600] : [latin400, latin600]).map(
    (href) => ({
      rel: "preload",
      href,
      as: "font",
      type: "font/woff2",
      crossOrigin: "anonymous" as const,
    })
  )

export const Route = createRootRouteWithContext<{ queryClient: QueryClient }>()(
  {
    // The signed-in user (or null) is in route context before anything renders, on the server too.
    // A failing session call degrades to signed out, so the shell (and the dev panel) still render; pages show their own errors.
    beforeLoad: async ({ context }) => ({
      me: await context.queryClient.ensureQueryData(meQuery).catch(() => null),
    }),
    // Locale is fixed for the life of a document (the language switch reloads the page), so load once.
    staleTime: Infinity,
    loader: ({ location }) =>
      getRootData({ data: { pathname: location.pathname } }),
    head: ({ loaderData }) => ({
      meta: [
        {
          charSet: "utf-8",
        },
        {
          name: "viewport",
          content: "width=device-width, initial-scale=1",
        },
        {
          title: "Sayaratak",
        },
      ],
      // Runs before first paint: images fade in only when JavaScript is there to mark them loaded (`img[data-fade]` in styles.css).
      scripts: [{ children: "document.documentElement.classList.add('js')" }],
      links: [
        {
          rel: "stylesheet",
          href: appCss,
        },
        { rel: "icon", href: "/sayaratak-logo.svg", type: "image/svg+xml" },
        { rel: "icon", href: "/favicon.ico", sizes: "16x16 32x32 48x48" },
        ...(loaderData ? fontPreloads(loaderData.locale) : []),
      ],
    }),
    shellComponent: RootDocument,
    component: RootComponent,
  }
)

function RootDocument({ children }: { children: React.ReactNode }) {
  const { locale, prefs } = Route.useLoaderData()
  return (
    <html
      lang={locale}
      dir={isRtl(locale) ? "rtl" : "ltr"}
      data-data-saver={prefs.dataSaver ? "" : undefined}
      suppressHydrationWarning
    >
      <head>
        <HeadContent />
      </head>
      <body>
        {children}
        {import.meta.env.DEV && <DevPanelHost />}
        {import.meta.env.DEV && (
          <TanStackDevtools
            config={{
              position: "bottom-right",
            }}
            plugins={[
              {
                name: "Tanstack Router",
                render: <TanStackRouterDevtoolsPanel />,
              },
            ]}
          />
        )}
        <Scripts />
      </body>
    </html>
  )
}

function RootComponent() {
  const { locale, messages, prefs, serverNow } = Route.useLoaderData()
  const [i18n] = useState(() => createI18n(locale, messages))
  return (
    <I18nextProvider i18n={i18n}>
      <DirectionProvider direction={isRtl(locale) ? "rtl" : "ltr"}>
        <PrefsProvider prefs={prefs}>
          <NowProvider serverNow={serverNow}>
            <Toaster>
              <NavigationProgress />
              <OfflineBanner />
              <Outlet />
              <AuthDialogHost />
            </Toaster>
          </NowProvider>
        </PrefsProvider>
      </DirectionProvider>
    </I18nextProvider>
  )
}
