import { PageHeader } from "@/components/app/page-header"
import { useT } from "@/lib/i18n/use-t"
import { usePageTitle } from "./page-title"

// A titled stand-in for a dashboard page whose step is not built yet. The step replaces the route's component.
export function PlaceholderPage({ titleKey }: { titleKey: string }) {
  const { t } = useT()
  usePageTitle(t(titleKey))
  return <PageHeader title={t(titleKey)} />
}
