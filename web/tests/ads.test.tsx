import { fireEvent, screen, waitFor } from "@testing-library/react"
import { beforeEach, describe, expect, it, vi } from "vitest"

import { BannerSlot } from "@/components/app/banner-slot"
import { adPageOf } from "@/features/ads/ad-page-of"
import { AdminCampaignsPage } from "@/features/ads/components/admin-campaigns-page"
import { AdsPage } from "@/features/ads/components/ads-page"
import { NewCampaignPage } from "@/features/ads/components/new-campaign-page"
import { NowProvider } from "@/lib/now"
import { db, resetDb } from "@/mocks/db"
import { renderShell } from "./shell-render"

beforeEach(() => {
  resetDb()
  vi.stubGlobal(
    "IntersectionObserver",
    class {
      observe() {}
      disconnect() {}
    }
  )
})

const now = (ui: React.ReactNode) => (
  <NowProvider serverNow={Date.now()}>{ui}</NowProvider>
)

describe("banner ads", () => {
  it("maps each search to its own ad page", () => {
    expect(adPageOf({ kind: "part" })).toBe("search_parts")
    expect(adPageOf({ kind: "vehicle", type: "rickshaw" })).toBe(
      "search_tuk_tuk"
    )
    expect(adPageOf({ kind: "vehicle" })).toBe("search_car")
  })

  it("serves the running campaign of the page as a sponsored banner", async () => {
    await renderShell(<BannerSlot placement="search_top" ad="search_truck" />)
    expect(await screen.findByText("Pickups ready to work")).toBeTruthy()
    expect(screen.getByText("Ad")).toBeTruthy()
  })

  it("lists the business's campaigns with their state and results", async () => {
    await renderShell(now(<AdsPage role="dealership" />), {
      role: "dealership",
      path: "/en/dealer/ads",
    })
    expect(await screen.findByText("Pickups ready to work")).toBeTruthy()
    expect(screen.getByText("Running")).toBeTruthy()
    expect(screen.getByRole("link", { name: "New campaign" })).toBeTruthy()
  })

  it("keeps the wizard on step 1 until the banner is complete", async () => {
    await renderShell(now(<NewCampaignPage role="dealership" />), {
      role: "dealership",
      path: "/en/dealer/ads/new",
    })
    fireEvent.click(screen.getByRole("button", { name: "Continue" }))
    expect(await screen.findByText("Add a banner photo")).toBeTruthy()
    expect(screen.getByText("Choose where the banner opens")).toBeTruthy()
    expect(screen.getByText("Step 1 of 4")).toBeTruthy()
  })

  it("lets the admin approve one campaign and reject another with a reason", async () => {
    const second = structuredClone(db.campaigns.find((c) => c.id === "camp-2")!)
    db.campaigns.push({ ...second, id: "camp-3" })
    await renderShell(now(<AdminCampaignsPage />), {
      role: "admin",
      path: "/en/admin/ads",
    })
    expect(await screen.findByText("2 waiting for review")).toBeTruthy()
    fireEvent.click(screen.getAllByRole("button", { name: "Approve" })[0]!)
    await waitFor(() =>
      expect(db.campaigns.filter((c) => c.status === "approved").length).toBe(2)
    )
    fireEvent.click(await screen.findByRole("button", { name: "Reject" }))
    fireEvent.change(
      await screen.findByLabelText("Reason the advertiser will see"),
      { target: { value: "Photo is blurry" } }
    )
    fireEvent.click(screen.getAllByRole("button", { name: "Reject" }).at(-1)!)
    await waitFor(() =>
      expect(
        db.campaigns.find((c) => c.status === "rejected")?.rejectionReason
      ).toBe("Photo is blurry")
    )
  })
})
