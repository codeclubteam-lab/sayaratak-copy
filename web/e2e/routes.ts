// Every page route (A6 and the dashboard route blocks), with the role that may open it and seeded params.
// Paths have no locale prefix; the smoke test adds /ar and /en. Splat routes ($.tsx) are left out: they are 404 pages by design.

export type Role =
  "anon" | "user" | "dealer" | "workshop" | "mechanic" | "admin"

// Seeded params (fixed faker seed).
const listing = "chevrolet-cruze-2014-single-owner-khartoum-l0000p"
const dealerListing = "l0008g"

const publicRoutes = [
  "",
  "/search",
  "/search?kind=part",
  "/parts",
  "/map",
  "/vehicles/cars/sale",
  "/vehicles/cars/sale/khartoum",
  `/listing/${listing}`,
  "/dealerships",
  "/dealerships/al-salam-motors",
  "/workshops",
  "/workshops/nile-workshop",
  "/mechanics",
  "/mechanics/um-5-6",
  "/about",
  "/contact",
  "/privacy",
  "/terms",
  "/suspended",
]

const authRoutes = ["/auth", "/auth/login", "/auth/signup", "/auth/forgot"]

// Checkout needs an item; a paid plan of the role's audience.
const checkout = (plan: string) => `/billing/checkout?item=plan:${plan}`

const business = (plan: string) => [
  "",
  "/ads",
  "/ads/new",
  "/analytics",
  "/billing",
  checkout(plan),
  "/notifications",
  "/profile",
  "/reviews",
  "/settings",
  "/verification",
]

const dashboards: Record<Exclude<Role, "anon">, Array<string>> = {
  user: [
    "/account",
    "/account/billing",
    `/account${checkout("plan-user-plus")}`,
    "/account/favorites",
    "/account/listings",
    "/account/messages",
    "/account/notifications",
    "/account/saved-searches",
    "/account/settings",
    "/post",
    "/onboarding",
  ],
  dealer: [
    ...business("plan-dealer-growth").map((p) => `/dealer${p}`),
    "/dealer/inventory",
    "/dealer/inventory/new",
    `/dealer/inventory/${dealerListing}/edit`,
    "/dealer/messages",
    "/dealer/promotions",
  ],
  workshop: [
    ...business("plan-workshop-plus").map((p) => `/workshop${p}`),
    "/workshop/inquiries",
    "/workshop/photos",
    "/workshop/services",
  ],
  mechanic: [
    ...business("plan-mechanic-plus").map((p) => `/mechanic${p}`),
    "/mechanic/inquiries",
    "/mechanic/portfolio",
  ],
  admin: [
    "",
    "/account",
    "/ad-prices",
    "/ads",
    "/backups",
    "/banners",
    "/broadcasts",
    "/categories",
    "/dealerships",
    "/listings",
    "/locations",
    "/makes",
    "/mechanics",
    "/moderation",
    "/notifications",
    "/pages",
    "/payments",
    "/plans",
    "/promotions",
    "/reports",
    "/reviews",
    "/settings",
    "/users",
    "/verifications",
    "/workshops",
  ].map((p) => `/admin${p}`),
}

// Anonymous visitors open public and auth pages; signed-in roles open public pages and their own dashboard.
export const routesFor = (role: Role): Array<string> =>
  role === "anon"
    ? [...publicRoutes, ...authRoutes]
    : [...publicRoutes, ...dashboards[role]]
