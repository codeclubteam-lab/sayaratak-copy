import {
  QueryClient,
  QueryClientProvider,
  useQuery,
} from "@tanstack/react-query"
import { act, renderHook, waitFor } from "@testing-library/react"
import type { ReactNode } from "react"
import { beforeEach, describe, expect, it, vi } from "vitest"

import {
  authGate,
  resolveAuthGate,
  useRequireAuth,
} from "@/features/auth/auth-gate"
import { restore, snapshot } from "@/lib/api/mutation"
import { meQuery, useLogin } from "@/features/auth/queries"
import {
  favoriteQueries,
  listingQueries,
  useSetListingStatus,
  useToggleFavorite,
} from "@/features/listings/queries"
import {
  notificationQueries,
  useMarkNotificationsRead,
} from "@/features/notifications/queries"
import { db, resetDb } from "@/mocks/db"
import { searchParamsSchema } from "@sayaratak/shared/search/schemas"
import { useMockFetch } from "./mock-fetch"

const setup = () => {
  const qc = new QueryClient({
    defaultOptions: { queries: { retry: false }, mutations: { retry: false } },
  })
  const wrapper = ({ children }: { children: ReactNode }) => (
    <QueryClientProvider client={qc}>{children}</QueryClientProvider>
  )
  return { qc, wrapper }
}

beforeEach(() => {
  resetDb()
  vi.unstubAllGlobals()
})

describe("useRequireAuth", () => {
  it("authenticates every account switch through one mounted login hook", async () => {
    useMockFetch()
    const { qc, wrapper } = setup()
    const { result } = renderHook(() => useLogin(), { wrapper })
    await act(() =>
      result.current.mutateAsync({
        email: "dealer@demo.sy",
        password: "Demo1234",
      })
    )
    expect(qc.getQueryData(meQuery.queryKey)).toMatchObject({
      role: "dealership",
    })
    await act(() =>
      result.current.mutateAsync({
        email: "workshop@demo.sy",
        password: "Demo1234",
      })
    )
    expect(qc.getQueryData(meQuery.queryKey)).toMatchObject({
      role: "workshop",
    })
    await act(async () => {
      await expect(
        result.current.mutateAsync({
          email: "mechanic@demo.sy",
          password: "wrong-password",
        })
      ).rejects.toMatchObject({ code: "invalid_credentials" })
    })
    expect(qc.getQueryData(meQuery.queryKey)).toMatchObject({
      role: "workshop",
    })
  })
  it("opens the gate when signed out and replays the action after sign in", async () => {
    useMockFetch()
    const { qc, wrapper } = setup()
    const action = vi.fn()
    const { result } = renderHook(
      () => ({
        require: useRequireAuth(),
        me: useQuery(meQuery),
        login: useLogin(),
      }),
      { wrapper }
    )
    await waitFor(() => expect(result.current.me.isSuccess).toBe(true))
    act(() => result.current.require(action, "favorite"))
    expect(action).not.toHaveBeenCalled()
    expect(authGate.state).toMatchObject({ open: true, reason: "favorite" })
    await act(() =>
      result.current.login.mutateAsync({
        email: "user@demo.sy",
        password: "Demo1234",
      })
    )
    expect(qc.getQueryData(meQuery.queryKey)).toMatchObject({ id: "u-omar" })
    act(() => resolveAuthGate())
    expect(action).toHaveBeenCalledOnce()
    expect(authGate.state.open).toBe(false)
  })
  it("runs the action at once when signed in", async () => {
    useMockFetch("u-omar")
    const { wrapper } = setup()
    const action = vi.fn()
    const { result } = renderHook(
      () => ({ require: useRequireAuth(), me: useQuery(meQuery) }),
      { wrapper }
    )
    await waitFor(() => expect(result.current.me.data?.id).toBe("u-omar"))
    act(() => result.current.require(action))
    expect(action).toHaveBeenCalledOnce()
  })
})

describe("optimistic updates", () => {
  it("favorites flip at once and roll back when the server refuses", async () => {
    useMockFetch("u-new")
    const { qc, wrapper } = setup()
    const id = db.listings.find((l) => l.moderation === "approved")?.id ?? ""
    const { result } = renderHook(
      () => ({
        ids: useQuery(favoriteQueries.ids),
        toggle: useToggleFavorite(),
      }),
      { wrapper }
    )
    await waitFor(() => expect(result.current.ids.isSuccess).toBe(true))
    act(() => result.current.toggle.mutate({ id, on: true }))
    await waitFor(() =>
      expect(qc.getQueryData(favoriteQueries.ids.queryKey)).toContain(id)
    )
    await waitFor(() => expect(result.current.toggle.isSuccess).toBe(true))
    vi.stubGlobal("fetch", () =>
      Promise.resolve(Response.json({ code: "server_error" }, { status: 500 }))
    )
    act(() => result.current.toggle.mutate({ id, on: false }))
    await waitFor(() => expect(result.current.toggle.isError).toBe(true))
    expect(qc.getQueryData(favoriteQueries.ids.queryKey)).toContain(id)
  })
  it("listing status shows in cached lists, notifications mark read in rows and badge", async () => {
    useMockFetch("u-omar")
    const { qc, wrapper } = setup()
    const mine = listingQueries.mine({})
    const { result } = renderHook(
      () => ({
        mine: useQuery(mine),
        notes: useQuery(notificationQueries.list()),
        counts: useQuery(notificationQueries.counts),
        status: useSetListingStatus(),
        read: useMarkNotificationsRead(),
      }),
      { wrapper }
    )
    await waitFor(() =>
      expect(
        result.current.mine.isSuccess &&
          result.current.notes.isSuccess &&
          result.current.counts.isSuccess
      ).toBe(true)
    )
    const first = result.current.mine.data?.items.find(
      (l) => l.status === "available"
    )
    act(() =>
      result.current.status.mutate({ id: first?.id ?? "", status: "sold" })
    )
    await waitFor(() =>
      expect(qc.getQueryData(mine.queryKey)).toMatchObject({
        items: expect.arrayContaining([
          expect.objectContaining({ id: first?.id, status: "sold" }),
        ]),
      })
    )
    const before = result.current.counts.data?.unreadNotifications ?? 0
    expect(before).toBeGreaterThan(0)
    act(() => result.current.read.mutate(undefined))
    await waitFor(() =>
      expect(
        qc.getQueryData(notificationQueries.counts.queryKey)
      ).toMatchObject({ unreadNotifications: 0 })
    )
  })
})

describe("listing list query", () => {
  it("sends filters as the URL and parses the page", async () => {
    useMockFetch()
    const { wrapper } = setup()
    const filters = searchParamsSchema.parse({
      type: "truck",
      fuel: ["diesel"],
      sort: "price_asc",
    })
    const { result } = renderHook(
      () => useQuery(listingQueries.list(filters)),
      { wrapper }
    )
    await waitFor(() => expect(result.current.isSuccess).toBe(true))
    expect(
      result.current.data?.items.every((l) => l.vehicleType === "truck")
    ).toBe(true)
  })
})

describe("mutation cache snapshot", () => {
  it("captures and restores matching query keys", async () => {
    const qc = new QueryClient()
    qc.setQueryData(["sample", "a"], { count: 1 })
    const snap = await snapshot(qc, ["sample"])
    qc.setQueryData(["sample", "a"], { count: 2 })
    restore(qc, snap)
    expect(qc.getQueryData(["sample", "a"])).toEqual({ count: 1 })
  })
})
