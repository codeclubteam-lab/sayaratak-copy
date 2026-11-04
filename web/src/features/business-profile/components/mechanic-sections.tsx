import { SettingsSection } from "@/components/app/settings-section"
import { AvailabilitySwitch } from "@/features/mechanic-overview/components/availability-switch"
import { MechanicExpertiseStep } from "@/features/onboarding/components/mechanic-expertise-step"
import { useT } from "@/lib/i18n/use-t"
import type { Mechanic } from "@sayaratak/shared/schemas/profile"
import * as s from "../schemas"
import { MechanicAboutFields } from "./mechanic-about-fields"
import { SectionForm } from "./section-form"
import { WorkshopContactFields } from "./workshop-contact-fields"

type Section = (id: string) => {
  id: string
  title: string
  description: string
  onDirty: (id: string, dirty: boolean) => void
}

// About, Skills and Contact save on their own; Availability saves on each toggle like the overview card.
export function MechanicSections({
  mechanic: m,
  section,
}: {
  mechanic: Mechanic
  section: Section
}) {
  const { t } = useT()
  return (
    <div>
      <SectionForm
        {...section("about")}
        schema={s.mechanicAboutSectionSchema}
        values={s.mechanicAboutValues(m)}
      >
        <MechanicAboutFields cityId={m.cityId} />
      </SectionForm>
      <SectionForm
        {...section("skills")}
        schema={s.expertiseSchema}
        values={s.expertiseValues(m)}
        toBody={s.expertiseBody}
      >
        <MechanicExpertiseStep />
      </SectionForm>
      <SectionForm
        {...section("contact")}
        schema={s.workshopContactSchema}
        values={s.workshopContactValues(m)}
        toBody={s.workshopContactBody}
      >
        <WorkshopContactFields />
      </SectionForm>
      <SettingsSection
        title={t("dashboard.availability_title")}
        description={t("dashboard.profile_availability_body")}
      >
        <AvailabilitySwitch />
      </SettingsSection>
    </div>
  )
}
