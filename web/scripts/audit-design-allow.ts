// Findings that audit:design accepts, each with the reason. `match` is a substring of the reported text ("" accepts every finding of that rule in the file).
export type Allowed = { file: string; rule: string; match: string; why: string }

const a = (file: string, rule: string, match: string, why: string) => ({
  file: `src/${file}`,
  rule,
  match,
  why,
})

// The meta-line rule is about listing facts (year, mileage, fuel). These dots join other things: names, dates, places, a title.
const notFacts = (file: string, what: string) =>
  a(file, "meta lines", "", `not listing facts: ${what}`)

export const allowed: Allowed[] = [
  // Sizes named in A5 and A11.
  a(
    "components/app/public-layout.tsx",
    "spacing",
    "max-w-[1200px]",
    "A5 public container"
  ),
  a(
    "components/app/state-panel.tsx",
    "spacing",
    "max-w-[1200px]",
    "A5 public container"
  ),
  a(
    "components/app/footer.tsx",
    "spacing",
    "max-w-[1200px]",
    "A5 public container"
  ),
  a(
    "features/dashboard/components/dashboard-layout.tsx",
    "spacing",
    "max-w-[1440px]",
    "Deviations: Dashboard width"
  ),
  a(
    "components/app/gallery.tsx",
    "spacing",
    "w-[72px]",
    "A5 gallery thumbnail"
  ),
  a(
    "components/app/page-skeleton.tsx",
    "spacing",
    "360px",
    "A11 detail aside 360"
  ),
  a(
    "features/map/components/map-page.tsx",
    "spacing",
    "w-[360px]",
    "A11 aside width, same as the detail aside"
  ),
  a(
    "features/admin-moderation/components/moderation-page.tsx",
    "spacing",
    "360px",
    "A11 queue list 360"
  ),
  a(
    "features/search/components/search-results.tsx",
    "spacing",
    "296px",
    "A11 filter panel 296"
  ),
  a(
    "features/onboarding/components/onboarding-layout.tsx",
    "spacing",
    "520px_360px",
    "A11 form 520, preview 360"
  ),
  a(
    "features/auth/components/auth-dialog.tsx",
    "spacing",
    "max-w-[400px]",
    "A11 auth dialog 400"
  ),
  a(
    "components/app/price-text.tsx",
    "type",
    "text-[1.75rem]",
    "A5 detail price 28 / 36"
  ),
  a(
    "components/app/primary-nav.tsx",
    "type",
    "text-[14px]",
    "A11 header nav links 14/20 in both languages"
  ),
  a(
    "components/app/primary-nav.tsx",
    "spacing",
    "text-[14px]",
    "A11 header nav links 14/20 in both languages"
  ),
  // Borders on form controls (A5 allows them).
  a(
    "components/app/phone-input.tsx",
    "border",
    "border",
    "dial code box is part of the phone field"
  ),
  a(
    "features/auth/components/code-step.tsx",
    "border",
    "border-s",
    "OTP slots are form controls"
  ),
  a(
    "components/app/hero-slide.tsx",
    "border",
    "md:border",
    "the hero call to action is an outline button on the deep banner (Deviations: 14.2 outline)"
  ),
  // Shadows on layers that float (A5 floating shadow).
  a(
    "features/messaging/components/new-messages-chip.tsx",
    "shadow",
    "shadow-floating",
    "chip floats over the message list (A5b)"
  ),
  a(
    "components/app/dev-panel.tsx",
    "shadow",
    "shadow-floating",
    "dev panel floats over the page, dev builds only"
  ),
  a(
    "features/home/components/home-hero.tsx",
    "shadow",
    "shadow-floating",
    "search card floats over the banner (Deviations: 6.1 hero)"
  ),
  a(
    "components/app/auth-panel/styles.ts",
    "shadow",
    "shadow-floating",
    "one floating card per scene (Deviations: Auth panel carousel)"
  ),
  // The one timing exception in A5b.
  a(
    "components/app/navigation-progress.tsx",
    "motion",
    "duration-[8s]",
    "A5b navigation progress bar"
  ),
  // Data, not styling: the stored placeholder color of an image.
  a(
    "lib/image-process.ts",
    "tokens",
    "#c9d3cf",
    "fallback placeholderColor value stored with an upload"
  ),
  a(
    "features/admin-banners/schemas.ts",
    "tokens",
    "placeholderColor",
    "default placeholderColor value of a banner image"
  ),
  notFacts(
    "lib/listing-title.ts",
    "part title, category and make (Deviations: 6.1 title)"
  ),
  notFacts(
    "components/app/save-search-button.tsx",
    "saved search name from its filters"
  ),
  notFacts("components/app/image-uploader-impl.tsx", "photo count and minimum"),
  notFacts(
    "components/app/auth-panel/plan-scene.tsx",
    "payment method and reference"
  ),
  notFacts(
    "features/admin-reviews/components/review-card.tsx",
    "reviewer and date"
  ),
  notFacts("features/admin-users/components/user-details.tsx", "role and city"),
  notFacts(
    "features/admin-broadcasts/components/history-card.tsx",
    "date and recipient count"
  ),
  notFacts(
    "features/admin-broadcasts/components/use-audience-summary.ts",
    "audience parts"
  ),
  notFacts(
    "features/admin-reports/components/report-card.tsx",
    "reporter and date"
  ),
  notFacts(
    "features/admin-plans/components/subscriber-card.tsx",
    "plan and audience"
  ),
  notFacts(
    "features/admin-plans/components/subscriber-filters.tsx",
    "plan name and audience"
  ),
  notFacts("features/listings/wizard/contact-step.tsx", "place and phone"),
  notFacts(
    "features/listings/wizard/review-body.tsx",
    "type, category, intent and contact methods"
  ),
  notFacts(
    "features/ads/components/admin-campaign-row.tsx",
    "ad pages and dates"
  ),
  notFacts("features/ads/components/campaign-card.tsx", "ad pages"),
  notFacts(
    "features/admin-moderation/components/queue-row.tsx",
    "seller, seller type and date"
  ),
  notFacts(
    "features/admin-businesses/components/business-details.tsx",
    "type and city"
  ),
  notFacts(
    "features/admin-businesses/components/business-card.tsx",
    "owner and plan"
  ),
  notFacts(
    "features/admin-listings/components/admin-listing-card.tsx",
    "owner and date"
  ),
  notFacts(
    "features/admin-verifications/components/verification-card.tsx",
    "type, document count, owner and date"
  ),
  notFacts(
    "features/admin-verifications/components/verification-details.tsx",
    "type and city"
  ),
  notFacts(
    "features/admin-payments/components/admin-payment-card.tsx",
    "payer and date"
  ),
  notFacts(
    "features/admin-payments/components/payment-details.tsx",
    "submitted and reviewed dates"
  ),
]
