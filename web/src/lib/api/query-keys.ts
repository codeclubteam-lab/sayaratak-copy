import type { SearchParams } from "@sayaratak/shared/search/schemas"

type Params = Record<string, unknown> | undefined

// Every query key in the app comes from here; mutations invalidate by prefix.
export const keys = {
  me: ["me"] as const,
  taxonomy: ["taxonomy"] as const,
  counts: ["counts"] as const,
  prefs: ["me", "notification-prefs"] as const,
  drafts: (key: string) => ["drafts", key] as const,
  listings: {
    all: ["listings"] as const,
    list: (f: SearchParams) => ["listings", "list", f] as const,
    rail: (f: Partial<SearchParams> & { exclude?: string }, limit: number) =>
      ["listings", "rail", f, limit] as const,
    detail: (slug: string) => ["listings", "detail", slug] as const,
    similar: (id: string) => ["listings", "similar", id] as const,
    mine: (f: Params) => ["listings", "mine", f] as const,
    analytics: (id: string, range: string) =>
      ["listings", "analytics", id, range] as const,
  },
  favorites: {
    all: ["favorites"] as const,
    ids: ["favorites", "ids"] as const,
    lists: ["favorites", "list"] as const,
    list: (f: Params) => ["favorites", "list", f] as const,
  },
  savedSearches: ["saved-searches"] as const,
  map: (f: Params) => ["map", f] as const,
  directory: {
    all: (type: string) => ["directory", type] as const,
    list: (type: string, f: Params) => ["directory", type, "list", f] as const,
    detail: (type: string, slug: string) =>
      ["directory", type, "detail", slug] as const,
  },
  business: {
    all: ["business"] as const,
    mine: ["business", "mine"] as const,
    services: ["business", "services"] as const,
    portfolio: ["business", "portfolio"] as const,
  },
  reviews: {
    all: ["reviews"] as const,
    list: (type: string, id: string, f: Params) =>
      ["reviews", type, id, f] as const,
  },
  threads: {
    all: ["threads"] as const,
    messages: (id: string) => ["threads", id, "messages"] as const,
  },
  notifications: {
    all: ["notifications"] as const,
    list: (f: Params) => ["notifications", "list", f] as const,
  },
  billing: {
    all: ["billing"] as const,
    plans: (audience?: string) => ["billing", "plans", audience] as const,
    subscription: ["billing", "subscription"] as const,
    payments: (f: Params) => ["billing", "payments", f] as const,
    promotionPrices: ["billing", "promotion-prices"] as const,
    promotions: ["billing", "promotions"] as const,
    checkout: (item: string) => ["billing", "checkout", item] as const,
  },
  verification: ["verification"] as const,
  content: {
    site: ["content", "site"] as const,
    page: (slug: string) => ["content", "page", slug] as const,
    banners: (placement?: string) => ["content", "banners", placement] as const,
    // The paid banner served on a page; public, picked at random per request.
    ad: (page: string) => ["content", "ad", page] as const,
  },
  ads: {
    all: ["ads"] as const,
    pages: (f: Params) => ["ads", "pages", f] as const,
    targets: ["ads", "targets"] as const,
    mine: ["ads", "mine"] as const,
  },
  analytics: (range: string) => ["analytics", range] as const,
  admin: {
    all: ["admin"] as const,
    list: (name: string, f?: Params) => ["admin", name, f] as const,
  },
}

// Queries that do not depend on who is signed in; everything else is dropped on sign out.
export const publicKeyRoots = new Set([
  "taxonomy",
  "listings",
  "directory",
  "content",
  "map",
  "reviews",
])
