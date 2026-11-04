import { createFileRoute } from "@tanstack/react-router"

import { requireRole } from "@/features/auth/guards"
import { dashboardPage } from "@/features/dashboard/overview-route"
import { taxonomyQuery } from "@/features/listings/queries"
import { wizardSearchSchema } from "@/features/listings/wizard/wizard-config"
import { WizardPage } from "@/features/listings/wizard/wizard-page"

const page = dashboardPage("/dealer/inventory/new", "post.new_listing")

export const Route = createFileRoute("/$locale/dealer_/inventory/new")({
  // Outside the dealer layout, so the wizard is a focused page with no sidebar; same guard as the dashboard.
  ssr: false,
  beforeLoad: requireRole("dealership"),
  validateSearch: wizardSearchSchema,
  ...page,
  loader: async (args) => {
    const [data] = await Promise.all([
      page.loader(args),
      args.context.queryClient.ensureQueryData(taxonomyQuery),
    ])
    return data
  },
  component: function NewVehicle() {
    const { step, listing } = Route.useSearch()
    const navigate = Route.useNavigate()
    return (
      <WizardPage
        context="dealer"
        step={step}
        savedId={listing}
        onSaved={(id) =>
          void navigate({ search: { step: "done", listing: id } })
        }
      />
    )
  },
})
