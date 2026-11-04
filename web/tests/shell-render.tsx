import type { ReactNode } from "react"
import { QueryClient, QueryClientProvider } from "@tanstack/react-query"
import {
  RouterProvider,
  createMemoryHistory,
  createRootRoute,
  createRoute,
  createRouter,
} from "@tanstack/react-router"
import { render } from "@testing-library/react"
import { I18nextProvider } from "react-i18next"

import { sessionCaches } from "@/features/auth/session-ended"
import { keys } from "@/lib/api/query-keys"
import { createI18n } from "@/lib/i18n/create"
import { PrefsProvider, type Prefs } from "@/lib/prefs"
import type { Locale } from "@sayaratak/shared/schemas/locale"
import type { User } from "@sayaratak/shared/schemas/user"
import { DirectionProvider } from "@/components/ui/direction"
import { db } from "@/mocks/db"
import { publicUser } from "@/mocks/lib"
import ar from "@/messages/ar/common.json"
import en from "@/messages/en/common.json"
import arAuth from "@/messages/ar/auth.json"
import enAuth from "@/messages/en/auth.json"
import arError from "@/messages/ar/error.json"
import enError from "@/messages/en/error.json"
import arValidation from "@/messages/ar/validation.json"
import enValidation from "@/messages/en/validation.json"
import arListing from "@/messages/ar/listing.json"
import enListing from "@/messages/en/listing.json"
import arSearch from "@/messages/ar/search.json"
import enSearch from "@/messages/en/search.json"
import arDirectory from "@/messages/ar/directory.json"
import enDirectory from "@/messages/en/directory.json"
import arStatus from "@/messages/ar/status.json"
import enStatus from "@/messages/en/status.json"
import arDashboard from "@/messages/ar/dashboard.json"
import enDashboard from "@/messages/en/dashboard.json"
import arBilling from "@/messages/ar/billing.json"
import enBilling from "@/messages/en/billing.json"
import arOnboarding from "@/messages/ar/onboarding.json"
import enOnboarding from "@/messages/en/onboarding.json"
import arHome from "@/messages/ar/home.json"
import enHome from "@/messages/en/home.json"
import arManager from "@/messages/ar/manager.json"
import enManager from "@/messages/en/manager.json"
import arToast from "@/messages/ar/toast.json"
import enToast from "@/messages/en/toast.json"
import arAdmin from "@/messages/ar/admin.json"
import enAdmin from "@/messages/en/admin.json"
import { useMockFetch } from "./mock-fetch"

export async function renderShell(
  ui: ReactNode,
  options: {
    locale?: Locale
    role?: User["role"]
    path?: string
    prefs?: Prefs
  } = {}
) {
  const {
    locale = "en",
    role,
    path = `/${locale}`,
    prefs = { dataSaver: false, listingView: "grid" },
  } = options
  const row = role
    ? db.users.find((user) => user.role === role && user.onboardingDone)
    : undefined
  const me = row ? publicUser(row) : null
  useMockFetch(me?.id)
  const client: QueryClient = new QueryClient({
    ...sessionCaches(() => client),
    defaultOptions: { queries: { retry: false }, mutations: { retry: false } },
  })
  client.setQueryData(keys.me, me)
  const i18n = createI18n(locale, {
    common: locale === "ar" ? ar : en,
    auth: locale === "ar" ? arAuth : enAuth,
    error: locale === "ar" ? arError : enError,
    validation: locale === "ar" ? arValidation : enValidation,
    listing: locale === "ar" ? arListing : enListing,
    search: locale === "ar" ? arSearch : enSearch,
    directory: locale === "ar" ? arDirectory : enDirectory,
    status: locale === "ar" ? arStatus : enStatus,
    dashboard: locale === "ar" ? arDashboard : enDashboard,
    billing: locale === "ar" ? arBilling : enBilling,
    toast: locale === "ar" ? arToast : enToast,
    manager: locale === "ar" ? arManager : enManager,
    home: locale === "ar" ? arHome : enHome,
    onboarding: locale === "ar" ? arOnboarding : enOnboarding,
    admin: locale === "ar" ? arAdmin : enAdmin,
  })
  const root = createRootRoute({
    component: () => (
      <QueryClientProvider client={client}>
        <I18nextProvider i18n={i18n}>
          <DirectionProvider direction={locale === "ar" ? "rtl" : "ltr"}>
            <PrefsProvider prefs={prefs}>{ui}</PrefsProvider>
          </DirectionProvider>
        </I18nextProvider>
      </QueryClientProvider>
    ),
  })
  const catchAll = createRoute({
    getParentRoute: () => root,
    path: "$",
    component: () => null,
  })
  const router = createRouter({
    routeTree: root.addChildren([catchAll]),
    history: createMemoryHistory({ initialEntries: [path] }),
  })
  await router.load()
  const rendered = render(<RouterProvider router={router} />)
  return { ...rendered, client, router }
}
