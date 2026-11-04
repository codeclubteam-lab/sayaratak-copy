import { QueryClient } from "@tanstack/react-query"
import { createRouter as createTanStackRouter } from "@tanstack/react-router"
import { setupRouterSsrQueryIntegration } from "@tanstack/react-router-ssr-query"
import {
  createIsomorphicFn,
  getGlobalStartContext,
} from "@tanstack/react-start"

import { sessionCaches } from "@/features/auth/session-ended"
import { pageTransition } from "@/lib/motion"
import { NotFound } from "@/components/app/not-found"
import { PageSkeleton } from "@/components/app/page-skeleton"
import { RouteError } from "@/components/app/route-error"
import { z } from "zod"

import { routeTree } from "./routeTree.gen"

const nonceContext = z.object({ nonce: z.string() })
// The CSP nonce that src/server.ts made for this request; none in the browser.
const requestNonce = createIsomorphicFn()
  .server(() => nonceContext.safeParse(getGlobalStartContext()).data?.nonce)
  .client(() => undefined)

// One QueryClient per router, and the router is created per request on the server, so nothing leaks between visitors.
export function getRouter() {
  const queryClient: QueryClient = new QueryClient({
    ...sessionCaches(() => queryClient),
    defaultOptions: {
      queries: { staleTime: 30_000, retry: 1, refetchOnWindowFocus: false },
    },
  })
  const router = createTanStackRouter({
    routeTree,
    context: { queryClient },
    scrollRestoration: true,
    defaultPreload: "intent",
    defaultPreloadStaleTime: 0,
    defaultNotFoundComponent: NotFound,
    defaultErrorComponent: RouteError,
    defaultPendingComponent: PageSkeleton,
    // A route skeleton only for loads slower than 400 ms, then shown for at least 300 ms. Before that the page stays and the progress bar answers (A5b).
    defaultPendingMs: 400,
    defaultPendingMinMs: 300,
    defaultViewTransition: pageTransition,
    ssr: { nonce: requestNonce() },
  })
  setupRouterSsrQueryIntegration({ router, queryClient })
  return router
}

declare module "@tanstack/react-router" {
  interface Register {
    router: ReturnType<typeof getRouter>
  }
}
