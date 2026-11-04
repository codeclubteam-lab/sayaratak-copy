import { useQuery } from "@tanstack/react-query"

import { PageHeader } from "@/components/app/page-header"
import { SectionError } from "@/components/app/section-error"
import { SettingsSection } from "@/components/app/settings-section"
import { ShellLink } from "@/components/app/shell-link"
import { buttonVariants } from "@/components/ui/button"
import { cn } from "@/lib/utils"
import { Skeleton } from "@/components/ui/skeleton"
import { meQuery } from "@/features/auth/queries"
import { usePageTitle } from "@/features/dashboard/components/page-title"
import { navHref } from "@/features/dashboard/nav-config"
import { useT } from "@/lib/i18n/use-t"
import type { Role } from "@sayaratak/shared/schemas/fields"
import { DeleteAccountDialog } from "./delete-account-dialog"
import { PasswordForm } from "./password-form"
import { PreferencesForm } from "./preferences-form"
import { ProfileForm } from "./profile-form"

// One page for every dashboard: the person behind the account, not the business profile. The admin has no account to delete.
export function SettingsPage({ role }: { role: Role }) {
  const { t } = useT()
  const title = t(
    role === "admin" ? "settings.account_title" : "dashboard.nav_settings"
  )
  usePageTitle(title)
  const me = useQuery(meQuery)
  const user = me.data
  return (
    <div className="flex flex-col gap-2">
      <PageHeader title={title} />
      {me.isError && !user ? (
        <SectionError
          message={t("settings.load_error")}
          onRetry={() => void me.refetch()}
        />
      ) : !user ? (
        <div aria-hidden="true" className="flex flex-col gap-4">
          <Skeleton className="h-64 w-full" />
          <Skeleton className="h-40 w-full" />
        </div>
      ) : (
        <>
          <SettingsSection
            title={t("settings.profile_title")}
            description={t("settings.profile_body")}
          >
            <ProfileForm me={user} />
          </SettingsSection>
          <SettingsSection
            title={t("settings.security_title")}
            description={t(
              user.hasPassword
                ? "settings.security_body"
                : "settings.security_body_new"
            )}
          >
            <PasswordForm hasPassword={user.hasPassword} />
          </SettingsSection>
          <SettingsSection
            title={t("settings.preferences_title")}
            description={t("settings.preferences_body")}
          >
            <PreferencesForm />
          </SettingsSection>
          <SettingsSection
            title={t("settings.notifications_title")}
            description={t("settings.notifications_body")}
          >
            <ShellLink
              path={navHref(role, "/notifications")}
              className={cn(buttonVariants({ variant: "outline" }))}
            >
              {t("settings.notifications_link")}
            </ShellLink>
          </SettingsSection>
          {role !== "admin" && (
            <SettingsSection
              title={t("settings.delete_title")}
              description={t("settings.delete_body")}
            >
              <DeleteAccountDialog role={role} />
            </SettingsSection>
          )}
        </>
      )}
    </div>
  )
}
