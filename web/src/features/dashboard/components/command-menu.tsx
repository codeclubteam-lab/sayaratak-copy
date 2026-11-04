import { useEffect, useState } from "react"
import { useQuery } from "@tanstack/react-query"
import { useRouter } from "@tanstack/react-router"
import { GlobeIcon, PlusIcon, SearchIcon } from "lucide-react"

import { useDebounced } from "@/hooks/use-debounced"
import { useT } from "@/lib/i18n/use-t"
import { localeHref, postPath } from "@/lib/navigation"
import type { User } from "@sayaratak/shared/schemas/user"
import { Button } from "@/components/ui/button"
import {
  Command,
  CommandDialog,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
} from "@/components/ui/command"
import { Kbd } from "@/components/ui/kbd"
import { adminQueries } from "@/features/admin/queries"
import { navConfig, navHref } from "../nav-config"

const kinds = ["listings", "users", "businesses", "payments"] as const

// Ctrl+K. Lists every nav destination of the role, "Post a listing" and the public site. The admin version also searches entities.
export function CommandMenu({ role }: { role: User["role"] }) {
  const { t, locale } = useT()
  const router = useRouter()
  const [open, setOpen] = useState(false)
  const [q, setQ] = useState("")
  const term = useDebounced(q.trim())
  const admin = role === "admin"
  const hits = useQuery({
    ...adminQueries.search(term),
    enabled: admin && open && term.length >= 2,
  })
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key.toLowerCase() === "k" && (e.ctrlKey || e.metaKey)) {
        e.preventDefault()
        setOpen((o) => !o)
      }
    }
    window.addEventListener("keydown", onKey)
    return () => window.removeEventListener("keydown", onKey)
  }, [])
  const go = (path: string) => {
    setOpen(false)
    router.history.push(localeHref(path, locale))
  }
  const post = postPath(role)
  const pages = navConfig[role]
    .flatMap((group) => group.items)
    .map((item) => ({
      key: item.key,
      label: t(item.key),
      path: navHref(role, item.path),
      icon: item.icon,
    }))
  return (
    <>
      <Button
        variant="outline"
        size="sm"
        onClick={() => setOpen(true)}
        className="gap-2 text-muted-foreground md:min-w-48 md:justify-start"
      >
        <SearchIcon aria-hidden="true" />
        <span className="max-md:sr-only">{t("dashboard.search_pages")}</span>
        <Kbd className="ms-auto hidden md:inline-flex">Ctrl K</Kbd>
      </Button>
      <CommandDialog
        open={open}
        onOpenChange={setOpen}
        title={t("dashboard.search_pages")}
        description={t("dashboard.search_placeholder")}
      >
        <Command>
          <CommandInput
            value={q}
            onValueChange={setQ}
            placeholder={t("dashboard.search_placeholder")}
          />
          <CommandList>
            <CommandEmpty>{t("dashboard.search_empty")}</CommandEmpty>
            {hits.isError && (
              <p role="alert" className="px-3 py-2 text-ui text-destructive">
                {t("dashboard.search_error")}
              </p>
            )}
            {hits.data &&
              kinds.map(
                (kind) =>
                  hits.data[kind].length > 0 && (
                    <CommandGroup
                      key={kind}
                      heading={t(`dashboard.search_${kind}`)}
                    >
                      {hits.data[kind].map((hit) => (
                        <CommandItem
                          key={hit.id}
                          value={`${kind} ${hit.id}`}
                          keywords={[term]}
                          onSelect={() => go(hit.href)}
                        >
                          <bdi>{hit.label[locale]}</bdi>
                          {hit.detail && (
                            <span className="text-caption text-muted-foreground">
                              <bdi>{hit.detail}</bdi>
                            </span>
                          )}
                        </CommandItem>
                      ))}
                    </CommandGroup>
                  )
              )}
            <CommandGroup heading={t("dashboard.search_pages_group")}>
              {pages.map((page) => (
                <CommandItem
                  key={page.key}
                  value={page.label}
                  onSelect={() => go(page.path)}
                >
                  <page.icon aria-hidden="true" />
                  {page.label}
                </CommandItem>
              ))}
            </CommandGroup>
            <CommandGroup heading={t("dashboard.search_actions_group")}>
              {post && (
                <CommandItem
                  value={t("listing.post")}
                  onSelect={() => go(post)}
                >
                  <PlusIcon aria-hidden="true" />
                  {t("listing.post")}
                </CommandItem>
              )}
              <CommandItem
                value={t("dashboard.view_site")}
                onSelect={() => go("/")}
              >
                <GlobeIcon aria-hidden="true" />
                {t("dashboard.view_site")}
              </CommandItem>
            </CommandGroup>
          </CommandList>
        </Command>
      </CommandDialog>
    </>
  )
}
