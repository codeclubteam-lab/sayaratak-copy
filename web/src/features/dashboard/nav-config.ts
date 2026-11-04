import {
  BadgeCheckIcon,
  BarChart3Icon,
  BellIcon,
  BookmarkIcon,
  BriefcaseIcon,
  CarIcon,
  CircleDollarSignIcon,
  ClipboardCheckIcon,
  CreditCardIcon,
  DatabaseBackupIcon,
  FileTextIcon,
  FlagIcon,
  HeartIcon,
  ImageIcon,
  ImagesIcon,
  InboxIcon,
  LayersIcon,
  LayoutDashboardIcon,
  ListChecksIcon,
  MapPinIcon,
  MegaphoneIcon,
  MessageSquareIcon,
  PresentationIcon,
  SendIcon,
  SettingsIcon,
  ShieldCheckIcon,
  StarIcon,
  StoreIcon,
  TagsIcon,
  UserRoundIcon,
  UsersIcon,
  WrenchIcon,
  type LucideIcon,
} from "lucide-react"

import { dashboardPath } from "@/lib/navigation"
import type { Counts } from "@sayaratak/shared/schemas/api"
import type { User } from "@sayaratak/shared/schemas/user"

type Role = User["role"]

// `path` follows the role's base path; `count` names the field of GET /me/counts shown as a badge.
export type NavItem = {
  key: string
  path: string
  icon: LucideIcon
  count?: keyof Counts
}
export type NavGroup = { key?: string; items: NavItem[] }

const item = (
  name: string,
  path: string,
  icon: LucideIcon,
  count?: keyof Counts
): NavItem => ({ key: `dashboard.nav_${name}`, path, icon, count })

const overview = item("overview", "", LayoutDashboardIcon)
const notifications = item(
  "notifications",
  "/notifications",
  BellIcon,
  "unreadNotifications"
)
const billing = item("billing", "/billing", CreditCardIcon)
const ads = item("ads", "/ads", PresentationIcon)
const settings = item("settings", "/settings", SettingsIcon)
const reviews = item("reviews", "/reviews", StarIcon)
const analytics = item("analytics", "/analytics", BarChart3Icon)
const verification = item("verification", "/verification", BadgeCheckIcon)
const profile = item("profile", "/profile", UserRoundIcon)
const inquiries = item("inquiries", "/inquiries", InboxIcon, "unreadMessages")

const group = (key: string, items: NavItem[]): NavGroup => ({
  key: `dashboard.nav_group_${key}`,
  items,
})

export const navConfig: Record<Role, NavGroup[]> = {
  user: [
    {
      items: [
        overview,
        item("listings", "/listings", CarIcon),
        item("favorites", "/favorites", HeartIcon),
        item("saved_searches", "/saved-searches", BookmarkIcon),
        item("messages", "/messages", MessageSquareIcon, "unreadMessages"),
        notifications,
        billing,
        settings,
      ],
    },
  ],
  dealership: [
    {
      items: [
        overview,
        item("inventory", "/inventory", CarIcon),
        item("messages", "/messages", MessageSquareIcon, "unreadMessages"),
        analytics,
        item("promotions", "/promotions", MegaphoneIcon),
        reviews,
        profile,
        verification,
        ads,
        billing,
        notifications,
        settings,
      ],
    },
  ],
  workshop: [
    {
      items: [
        overview,
        profile,
        item("services", "/services", WrenchIcon),
        item("photos", "/photos", ImageIcon),
        inquiries,
        reviews,
        analytics,
        verification,
        ads,
        billing,
        notifications,
        settings,
      ],
    },
  ],
  mechanic: [
    {
      items: [
        overview,
        profile,
        item("portfolio", "/portfolio", ImagesIcon),
        inquiries,
        reviews,
        analytics,
        verification,
        ads,
        billing,
        notifications,
        settings,
      ],
    },
  ],
  admin: [
    { items: [overview] },
    group("moderation", [
      item(
        "review_queue",
        "/moderation",
        ClipboardCheckIcon,
        "pendingListings"
      ),
      item("reports", "/reports", FlagIcon, "openReports"),
      item("reviews", "/reviews", StarIcon, "flaggedReviews"),
      item(
        "verifications",
        "/verifications",
        ShieldCheckIcon,
        "pendingVerifications"
      ),
    ]),
    group("marketplace", [
      item("all_listings", "/listings", CarIcon),
      item("users", "/users", UsersIcon),
      item("dealerships", "/dealerships", StoreIcon),
      item("workshops", "/workshops", WrenchIcon),
      item("mechanics", "/mechanics", BriefcaseIcon),
    ]),
    group("money", [
      item("payments", "/payments", CircleDollarSignIcon, "pendingPayments"),
      item("plans", "/plans", LayersIcon),
      item("promotions", "/promotions", MegaphoneIcon),
      item("ad_campaigns", "/ads", PresentationIcon),
      item("ad_prices", "/ad-prices", TagsIcon),
    ]),
    group("catalog", [
      item("categories", "/categories", TagsIcon),
      item("locations", "/locations", MapPinIcon),
      item("makes", "/makes", ListChecksIcon),
    ]),
    group("communication", [
      notifications,
      item("broadcasts", "/broadcasts", SendIcon),
      item("banners", "/banners", ImagesIcon),
    ]),
    group("site", [
      item("pages", "/pages", FileTextIcon),
      settings,
      item("backups", "/backups", DatabaseBackupIcon),
    ]),
  ],
}

export const navHref = (role: Role, path: string) => dashboardPath(role) + path

// The user card in the sidebar footer: admin has an account page, the others their settings.
export const accountPath = (role: Role) =>
  role === "admin" ? "/admin/account" : navHref(role, "/settings")
