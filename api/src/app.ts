import { Hono } from "hono"
import { cors } from "hono/cors"
import { requestId } from "hono/request-id"
import { secureHeaders } from "hono/secure-headers"
import { z } from "zod"

import { env } from "~/env"
import { appVersion } from "~/shared/http/app-version"
import { clientIp } from "~/shared/http/client-ip"
import { csrfOrigin } from "~/shared/http/csrf-origin"
import { onError, onNotFound } from "~/shared/http/errors"
import { healthRoutes } from "~/shared/http/health"
import { requestLog } from "~/shared/http/request-log"
import { testRoutes } from "~/test-routes"
import { buildOpenApi } from "~/shared/openapi/build"
import { docsRoutes } from "~/shared/openapi/docs"
import { spec } from "~/shared/openapi/registry"
import { session } from "~/modules/auth/auth.middleware"
import { adminListingsRoutes } from "~/modules/admin-listings/admin-listings.routes"
import { adminBusinessesRoutes } from "~/modules/admin-businesses/admin-businesses.routes"
import { adminPaymentsRoutes } from "~/modules/admin-payments/admin-payments.routes"
import { adminVerificationsRoutes } from "~/modules/admin-verifications/admin-verifications.routes"
import { adminReportsRoutes } from "~/modules/admin-reports/admin-reports.routes"
import { adminAdsRoutes } from "~/modules/admin-ads/admin-ads.routes"
import { adminBackupsRoutes } from "~/modules/admin-backups/admin-backups.routes"
import { adminBannersRoutes } from "~/modules/admin-banners/admin-banners.routes"
import { adminBroadcastsRoutes } from "~/modules/admin-broadcasts/admin-broadcasts.routes"
import { adminContentRoutes } from "~/modules/admin-content/admin-content.routes"
import { adminTaxonomyRoutes } from "~/modules/admin-taxonomy/admin-taxonomy.routes"
import { adminReviewsRoutes } from "~/modules/admin-reviews/admin-reviews.routes"
import { platformAdminRoutes } from "~/modules/platform-admin/platform-admin.routes"
import { adminPlansRoutes } from "~/modules/admin-plans/admin-plans.routes"
import { adminPromotionsRoutes } from "~/modules/admin-promotions/admin-promotions.routes"
import { adminUsersRoutes } from "~/modules/admin-users/admin-users.routes"
import { adminRoutes } from "~/modules/admin/admin.routes"
import { accountRoutes } from "~/modules/account/account.routes"
import { analyticsRoutes } from "~/modules/analytics/analytics.routes"
import { authRoutes } from "~/modules/auth/auth.routes"
import { contentRoutes } from "~/modules/content/content.routes"
import { devicesRoutes } from "~/modules/devices/devices.routes"
import { directoryRoutes } from "~/modules/directory/directory.routes"
import { favoritesRoutes } from "~/modules/favorites/favorites.routes"
import { listingsRoutes } from "~/modules/listings/listings.routes"
import { mapRoutes } from "~/modules/map/map.routes"
import { messagingRoutes } from "~/modules/messaging/messaging.routes"
import { notificationsRoutes } from "~/modules/notifications/notifications.routes"
import { mechanicPortfolioRoutes } from "~/modules/mechanic-portfolio/mechanic-portfolio.routes"
import { myBusinessRoutes } from "~/modules/my-business/my-business.routes"
import { verificationRoutes } from "~/modules/verification/verification.routes"
import { workshopServicesRoutes } from "~/modules/workshop-services/workshop-services.routes"
import { onboardingRoutes } from "~/modules/onboarding/onboarding.routes"
import { adsRoutes } from "~/modules/ads/ads.routes"
import { paymentsRoutes } from "~/modules/payments/payments.routes"
import { plansRoutes } from "~/modules/plans/plans.routes"
import { promotionsRoutes } from "~/modules/promotions/promotions.routes"
import { reportsRoutes } from "~/modules/reports/reports.routes"
import { reviewsRoutes } from "~/modules/reviews/reviews.routes"
import { savedSearchesRoutes } from "~/modules/saved-searches/saved-searches.routes"
import { taxonomyRoutes } from "~/modules/taxonomy/taxonomy.routes"
import { uploadsRoutes } from "~/modules/uploads/uploads.routes"

// The Origin header never has a trailing slash; WEB_ORIGIN may.
const webOrigin = new URL(env.WEB_ORIGIN).origin

// Built once, on the first request: the router no longer changes by then.
let openApi: ReturnType<typeof buildOpenApi> | undefined

const v1 = new Hono()
  .use(session)
  .get(
    "/openapi.json",
    spec({
      summary: "This contract, OpenAPI 3.1",
      access: "public",
      responses: { 200: z.looseObject({ openapi: z.literal("3.1.0") }) },
    }),
    (c) => {
      openApi ??= buildOpenApi(app)
      return c.json(openApi)
    }
  )
  .route("/", authRoutes)
  .route("/", contentRoutes)
  .route("/", accountRoutes)
  .route("/", onboardingRoutes)
  .route("/", myBusinessRoutes)
  .route("/", mechanicPortfolioRoutes)
  .route("/", workshopServicesRoutes)
  .route("/", directoryRoutes)
  .route("/", notificationsRoutes)
  .route("/", devicesRoutes)
  .route("/", taxonomyRoutes)
  .route("/", uploadsRoutes)
  .route("/", listingsRoutes)
  .route("/", mapRoutes)
  .route("/", analyticsRoutes)
  .route("/", reviewsRoutes)
  .route("/", favoritesRoutes)
  .route("/", savedSearchesRoutes)
  .route("/", messagingRoutes)
  .route("/", reportsRoutes)
  .route("/", verificationRoutes)
  .route("/", plansRoutes)
  .route("/", paymentsRoutes)
  .route("/", promotionsRoutes)
  .route("/", adsRoutes)
  .route("/", adminRoutes)
  .route("/", adminListingsRoutes)
  .route("/", adminUsersRoutes)
  .route("/", adminBusinessesRoutes)
  .route("/", adminVerificationsRoutes)
  .route("/", adminPaymentsRoutes)
  .route("/", adminPlansRoutes)
  .route("/", adminPromotionsRoutes)
  .route("/", adminReviewsRoutes)
  .route("/", adminReportsRoutes)
  .route("/", adminTaxonomyRoutes)
  .route("/", adminContentRoutes)
  .route("/", adminAdsRoutes)
  .route("/", adminBackupsRoutes)
  .route("/", adminBannersRoutes)
  .route("/", adminBroadcastsRoutes)
  .route("/", platformAdminRoutes)

// Middleware in A3 order. The 500 log line is in onError, the per-request
// line in requestLog.
const base = new Hono()
  .onError(onError)
  .notFound(onNotFound)
  .use(requestId())
  .use(clientIp(env.TRUSTED_PROXIES))
  .use(requestLog())
  .use(
    secureHeaders({
      // HSTS is set by Render's edge (A12).
      strictTransportSecurity: false,
      referrerPolicy: "strict-origin-when-cross-origin",
      // Web and api share one site (example.sd, api.example.sd), so web pages
      // may show images the api streams, such as private receipts.
      crossOriginResourcePolicy: "same-site",
    })
  )
  .use(async (c, next) => {
    await next()
    // A12: no-store unless a public reference read sets its own Cache-Control.
    // An answer carrying a cookie (a refreshed session) is never cacheable.
    if (!c.res.headers.has("Cache-Control") || c.res.headers.has("Set-Cookie"))
      c.header("Cache-Control", "no-store")
  })
  .use(
    cors({
      origin: webOrigin,
      credentials: true,
      allowMethods: ["GET", "POST", "PATCH", "PUT", "DELETE"],
      allowHeaders: ["content-type"],
    })
  )
  .use(
    appVersion({
      ios: env.MIN_APP_VERSION_IOS,
      android: env.MIN_APP_VERSION_ANDROID,
    })
  )
  .use(csrfOrigin(webOrigin))
  .route("/api", docsRoutes(env.APP_ENV))
  .route("/api/health", healthRoutes())
  .route("/api/v1", v1)

export const app =
  env.NODE_ENV === "test" && env.APP_ENV === "test"
    ? base.route("/api/_test", testRoutes())
    : base
