import { useEffect, useRef } from "react"
import { useQuery } from "@tanstack/react-query"
import { useFormContext } from "react-hook-form"

import { meQuery } from "@/features/auth/me-query"
import { businessQueries } from "@/features/directory/queries"
import type { Dealership } from "@sayaratak/shared/schemas/profile"

// What a dealership's own details put into the form. Without a WhatsApp number the first phone stands in, as for anyone who keeps "same number".
export const dealerContact = (d: Dealership) => ({
  cityId: d.cityId,
  districtId: d.districtId,
  location: d.location,
  phone: d.phones[0] ?? "",
  whatsapp: d.whatsapp ?? d.phones[0] ?? null,
})

const cityCookie = () =>
  document.cookie.match(/(?:^|; )city=([^;]*)/)?.[1] ?? ""

// Fills an untouched step once: the dealership's details for a dealer, else the profile's city and phone, else the `city` cookie. Returns the dealership (null for anyone else).
export function useContactPrefill() {
  const { getValues, setValue } = useFormContext()
  const me = useQuery(meQuery)
  const isDealer = me.data?.role === "dealership"
  const mine = useQuery({ ...businessQueries.mine, enabled: isDealer })
  const dealer = mine.data && "phones" in mine.data ? mine.data : null
  const done = useRef(false)
  useEffect(() => {
    if (done.current || me.isPending || (isDealer && mine.isPending)) return
    done.current = true
    const have = getValues()
    if (have.cityId || have.phone) return
    const from = dealer
      ? dealerContact(dealer)
      : { cityId: me.data?.cityId || cityCookie(), phone: me.data?.phone }
    for (const [name, value] of Object.entries(from))
      if (value) setValue(name, value)
  }, [me.isPending, mine.isPending])
  return dealer
}
