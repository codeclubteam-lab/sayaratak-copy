import { act, fireEvent, screen, waitFor, within } from "@testing-library/react"
import { beforeEach, describe, expect, it, vi } from "vitest"

import { keys } from "@/lib/api/query-keys"
import { NowProvider } from "@/lib/now"
import { MessagesPage } from "@/features/messaging/components/messages-page"
import { counterpart } from "@/features/messaging/counterpart"
import {
  messagesSearchSchema,
  pruneMessagesSearch,
} from "@/features/messaging/schemas"
import { toThread } from "@/mocks/handlers/messaging"
import { handleMock } from "@/mocks/router"
import { db, resetDb } from "@/mocks/db"
import { renderShell } from "./shell-render"

Element.prototype.scrollIntoView = () => {}

beforeEach(() => {
  resetDb()
  document.cookie = "mock_fail=; Path=/; Max-Age=0"
  vi.stubGlobal("matchMedia", () => ({
    matches: false,
    addEventListener: () => {},
    removeEventListener: () => {},
  }))
})

const me = () => db.users.find((u) => u.role === "user" && u.onboardingDone)!
const mine = () =>
  db.threads
    .filter((t) => t.participantIds.includes(me().id))
    .map((t) => toThread(t, me().id))
    .sort((a, b) =>
      b.lastMessage.createdAt.localeCompare(a.lastMessage.createdAt)
    )
const nameOf = (thread: ReturnType<typeof toThread>) =>
  counterpart(thread, me().id)!.name

async function open(
  search = "",
  role: "user" | "workshop" | "dealership" | "mechanic" = "user",
  labelKey: "messages" | "inquiries" = "messages"
) {
  const view = await renderShell(
    <NowProvider serverNow={Date.now()}>
      <MessagesPage labelKey={labelKey} />
    </NowProvider>,
    { role, path: `/en/account/messages${search}` }
  )
  return view
}
const list = () => screen.findByRole("list", { name: "Conversations" })
const itemsOf = async () => within(await list()).getAllByRole("listitem")
const currentSearch = (router: { state: { location: { search: unknown } } }) =>
  router.state.location.search as Record<string, string | undefined>

describe("search params", () => {
  it("keep only what differs from the defaults", () => {
    expect(pruneMessagesSearch(messagesSearchSchema.parse({}))).toEqual({})
    expect(
      pruneMessagesSearch(
        messagesSearchSchema.parse({
          thread: "t-1",
          q: " omar ",
          filter: "unread",
        })
      )
    ).toEqual({ thread: "t-1", q: "omar", filter: "unread" })
    expect(messagesSearchSchema.parse({ filter: "nope" }).filter).toBe("all")
  })
})

describe("MessagesPage", () => {
  it("lists the inbox newest first with unread counts", async () => {
    await open()
    const items = await itemsOf()
    const threads = mine()
    expect(items).toHaveLength(threads.length)
    expect(within(items[0]!).getByText(nameOf(threads[0]!))).toBeTruthy()
    const unread = threads.find((t) => t.unreadCount > 0)!
    const row = items.find((li) => within(li).queryByText(nameOf(unread)))!
    expect(within(row).getByText(`${unread.unreadCount} new`)).toBeTruthy()
    expect(screen.getByRole("heading", { level: 1 }).textContent).toBe(
      "Messages"
    )
  })

  it("filters by unread and by text, and keeps both in the URL", async () => {
    const { router } = await open()
    await itemsOf()
    const unreadThreads = mine().filter((t) => t.unreadCount > 0)
    fireEvent.click(screen.getByRole("button", { name: "Unread" }))
    await waitFor(async () =>
      expect(await itemsOf()).toHaveLength(unreadThreads.length)
    )
    expect(currentSearch(router).filter).toBe("unread")
    fireEvent.click(screen.getByRole("button", { name: "Unread" }))
    await waitFor(async () =>
      expect(await itemsOf()).toHaveLength(mine().length)
    )

    const first = mine()[0]!
    fireEvent.change(
      screen.getByRole("searchbox", { name: "Search conversations" }),
      {
        target: { value: nameOf(first) },
      }
    )
    await waitFor(() => expect(currentSearch(router).q).toBe(nameOf(first)), {
      timeout: 2000,
    })
    const names = (await itemsOf()).map((li) => li.textContent)
    expect(names.length).toBeGreaterThan(0)
    for (const text of names) expect(text).toContain(nameOf(first))
  })

  it("opens a thread, shows its messages by day and marks it read", async () => {
    const { router, client } = await open()
    await itemsOf()
    const target = mine().find((t) => t.unreadCount > 0)!
    fireEvent.click(
      screen.getByRole("button", { name: new RegExp(nameOf(target)) })
    )
    await waitFor(() => expect(currentSearch(router).thread).toBe(target.id))
    const log = await screen.findByRole("log", {
      name: `Conversation with ${nameOf(target)}`,
    })
    const stored = db.messages.filter((m) => m.threadId === target.id)
    await waitFor(() =>
      expect(within(log).getAllByRole("listitem").length).toBeGreaterThan(0)
    )
    // Seeded lines repeat inside a thread, so count the lines instead of looking each up.
    expect(
      within(log).getAllByText(stored.at(-1)!.body).length
    ).toBeGreaterThan(0)
    expect(within(log).getAllByRole("listitem").length).toBeGreaterThanOrEqual(
      stored.length
    )
    // Opening marks the other person's messages read, and the sidebar count follows.
    await waitFor(() =>
      expect(
        db.messages
          .filter((m) => m.threadId === target.id && m.senderId !== me().id)
          .every((m) => m.readAt)
      ).toBe(true)
    )
    await waitFor(() =>
      expect(
        client.getQueryData<{ unreadMessages: number }>(keys.counts)
          ?.unreadMessages ?? 0
      ).toBeLessThan(
        mine().reduce((n, t) => n + t.unreadCount, 0) + target.unreadCount
      )
    )
    const row = within(await list()).getByRole("button", {
      name: new RegExp(nameOf(target)),
    })
    await waitFor(() => expect(within(row).queryByText(/ new$/)).toBeNull())
  })

  it("shows a thread a buyer started from a listing page as unread, and the seller can answer", async () => {
    const seller = me()
    const listing = db.listings.find(
      (l) => l.ownerUserId === seller.id && l.moderation === "approved"
    )!
    const buyer = db.users.find((u) => u.role === "user" && u.id !== seller.id)!
    const started = await handleMock(
      new Request("http://localhost/api/threads", {
        method: "POST",
        headers: {
          cookie: `sy_session=${buyer.id}`,
          "content-type": "application/json",
        },
        body: JSON.stringify({
          subjectType: "listing",
          subjectId: listing.id,
          body: "Is the car still available?",
        }),
      })
    )
    const { id } = await started.json()
    const { router } = await open()
    const row = within(await list())
      .getAllByRole("button")
      .find((b) => b.textContent.includes("Is the car still available?"))!
    expect(within(row).getByText("1 new")).toBeTruthy()
    fireEvent.click(row)
    await waitFor(() => expect(currentSearch(router).thread).toBe(id))
    const box = await screen.findByRole("textbox", { name: "Write a message" })
    fireEvent.change(box, { target: { value: "Yes, come and see it." } })
    fireEvent.keyDown(box, { key: "Enter" })
    await waitFor(() =>
      expect(
        db.messages.some(
          (m) => m.threadId === id && m.body === "Yes, come and see it."
        )
      ).toBe(true)
    )
  })

  it("a dealership's inbox gets threads from its listing and from its profile", async () => {
    const dealer = db.users.find(
      (u) => u.role === "dealership" && u.onboardingDone
    )!
    const business = db.dealerships.find((b) => b.ownerId === dealer.id)!
    const listing = db.listings.find(
      (l) => l.ownerUserId === dealer.id && l.moderation === "approved"
    )!
    const buyer = me()
    const start = (subjectType: string, subjectId: string, body: string) =>
      handleMock(
        new Request("http://localhost/api/threads", {
          method: "POST",
          headers: {
            cookie: `sy_session=${buyer.id}`,
            "content-type": "application/json",
          },
          body: JSON.stringify({ subjectType, subjectId, body }),
        })
      )
    expect((await start("listing", listing.id, "Price for cash?")).ok).toBe(
      true
    )
    expect((await start("dealership", business.id, "Open on Friday?")).ok).toBe(
      true
    )
    await open("", "dealership")
    for (const text of ["Price for cash?", "Open on Friday?"]) {
      const row = within(await list())
        .getAllByRole("button")
        .find((b) => b.textContent.includes(text))!
      expect(within(row).getByText("1 new")).toBeTruthy()
    }
  })

  it("a workshop's inquiries get a thread from its public page", async () => {
    const owner = db.users.find((u) => u.id === "u-workshop")!
    const business = db.workshops.find((b) => b.ownerId === owner.id)!
    const res = await handleMock(
      new Request("http://localhost/api/threads", {
        method: "POST",
        headers: {
          cookie: `sy_session=${me().id}`,
          "content-type": "application/json",
        },
        body: JSON.stringify({
          subjectType: "workshop",
          subjectId: business.id,
          body: "Can you fix brakes today?",
        }),
      })
    )
    expect(res.ok).toBe(true)
    await open("", "workshop", "inquiries")
    const row = within(await list())
      .getAllByRole("button")
      .find((b) => b.textContent.includes("Can you fix brakes today?"))!
    expect(within(row).getByText("1 new")).toBeTruthy()
  })

  it("a mechanic's inquiries get a thread from its public page", async () => {
    const owner = db.users.find(
      (u) => u.role === "mechanic" && u.onboardingDone
    )!
    const business = db.mechanics.find((b) => b.ownerId === owner.id)!
    const res = await handleMock(
      new Request("http://localhost/api/threads", {
        method: "POST",
        headers: {
          cookie: `sy_session=${me().id}`,
          "content-type": "application/json",
        },
        body: JSON.stringify({
          subjectType: "mechanic",
          subjectId: business.id,
          body: "Can you come to Bahri tomorrow?",
        }),
      })
    )
    expect(res.ok).toBe(true)
    await open("", "mechanic", "inquiries")
    const row = within(await list())
      .getAllByRole("button")
      .find((b) => b.textContent.includes("Can you come to Bahri tomorrow?"))!
    expect(within(row).getByText("1 new")).toBeTruthy()
  })

  it("sends at once, on Enter, and clears the box", async () => {
    await open(`?thread=${mine()[0]!.id}`)
    const box = await screen.findByRole("textbox", { name: "Write a message" })
    const send = screen.getByRole("button", { name: "Send" })
    expect((send as HTMLButtonElement).disabled).toBe(true)
    fireEvent.change(box, { target: { value: "Is it still for sale?" } })
    expect((send as HTMLButtonElement).disabled).toBe(false)
    fireEvent.keyDown(box, { key: "Enter" })
    // The line shows before the server answers.
    expect(await screen.findByText("Is it still for sale?")).toBeTruthy()
    expect((box as HTMLTextAreaElement).value).toBe("")
    await waitFor(() =>
      expect(db.messages.some((m) => m.body === "Is it still for sale?")).toBe(
        true
      )
    )
    await waitFor(() =>
      expect(screen.getByText("Is it still for sale?")).toBeTruthy()
    )
  })

  it("Shift+Enter and touch Enter add a line instead of sending", async () => {
    await open(`?thread=${mine()[0]!.id}`)
    const box = await screen.findByRole("textbox", { name: "Write a message" })
    fireEvent.change(box, { target: { value: "first" } })
    fireEvent.keyDown(box, { key: "Enter", shiftKey: true })
    vi.stubGlobal("matchMedia", () => ({
      matches: true,
      addEventListener: () => {},
      removeEventListener: () => {},
    }))
    fireEvent.keyDown(box, { key: "Enter" })
    expect(db.messages.some((m) => m.body === "first")).toBe(false)
    expect((box as HTMLTextAreaElement).value).toBe("first")
  })

  it("keeps a failed message as Not sent with Retry, and Discard removes it", async () => {
    await open(`?thread=${mine()[0]!.id}`)
    const box = await screen.findByRole("textbox", { name: "Write a message" })
    document.cookie = "mock_fail=500; Path=/"
    fireEvent.change(box, { target: { value: "will fail" } })
    fireEvent.click(screen.getByRole("button", { name: "Send" }))
    expect(await screen.findByText("Not sent.")).toBeTruthy()
    expect(db.messages.some((m) => m.body === "will fail")).toBe(false)

    document.cookie = "mock_fail=; Path=/; Max-Age=0"
    fireEvent.click(screen.getByRole("button", { name: "Retry" }))
    await waitFor(() => expect(screen.queryByText("Not sent.")).toBeNull())
    await waitFor(() =>
      expect(db.messages.filter((m) => m.body === "will fail")).toHaveLength(1)
    )

    document.cookie = "mock_fail=500; Path=/"
    fireEvent.change(box, { target: { value: "drop me" } })
    fireEvent.click(screen.getByRole("button", { name: "Send" }))
    await screen.findByText("Not sent.")
    fireEvent.click(screen.getByRole("button", { name: "Discard" }))
    expect(screen.queryByText("drop me")).toBeNull()
  })

  it("offers New messages when a reply lands while the reader is scrolled up", async () => {
    const thread = mine()[0]!
    const { client } = await open(`?thread=${thread.id}`)
    const log = await screen.findByRole("log")
    await waitFor(() =>
      expect(within(log).getAllByRole("listitem").length).toBeGreaterThan(0)
    )
    Object.defineProperty(log, "scrollHeight", {
      configurable: true,
      value: 2000,
    })
    Object.defineProperty(log, "clientHeight", {
      configurable: true,
      value: 300,
    })
    log.scrollTop = 0
    fireEvent.scroll(log)
    expect(screen.queryByRole("button", { name: "New messages" })).toBeNull()

    db.messages.push({
      id: "msg-late",
      threadId: thread.id,
      senderId: counterpart(thread, me().id)!.id,
      body: "Are you there?",
      createdAt: new Date().toISOString(),
    })
    await act(() => client.invalidateQueries({ queryKey: keys.threads.all }))
    const chip = await screen.findByRole("button", { name: "New messages" })
    fireEvent.click(chip)
    expect(screen.queryByRole("button", { name: "New messages" })).toBeNull()
  })

  it("follows a new message when the reader is at the end", async () => {
    const thread = mine()[0]!
    const { client } = await open(`?thread=${thread.id}`)
    const log = await screen.findByRole("log")
    await waitFor(() =>
      expect(within(log).getAllByRole("listitem").length).toBeGreaterThan(0)
    )
    db.messages.push({
      id: "msg-late",
      threadId: thread.id,
      senderId: counterpart(thread, me().id)!.id,
      body: "Are you there?",
      createdAt: new Date().toISOString(),
    })
    await act(() => client.invalidateQueries({ queryKey: keys.threads.all }))
    expect(await within(log).findByText("Are you there?")).toBeTruthy()
    expect(screen.queryByRole("button", { name: "New messages" })).toBeNull()
  })

  it("shows an error with Retry when the inbox fails, and recovers", async () => {
    document.cookie = "mock_fail=500; Path=/"
    await open()
    expect(
      await screen.findByText("Could not load your conversations.")
    ).toBeTruthy()
    document.cookie = "mock_fail=; Path=/; Max-Age=0"
    fireEvent.click(screen.getByRole("button", { name: "Try again" }))
    expect(await list()).toBeTruthy()
  })

  it("shows an error inside the thread when its messages fail", async () => {
    const id = mine()[0]!.id
    const { client } = await open(`?thread=${id}`)
    await screen.findByRole("log")
    document.cookie = "mock_fail=500; Path=/"
    await act(() =>
      client.resetQueries({ queryKey: keys.threads.messages(id) })
    )
    expect(
      await screen.findByText("Could not load this conversation.")
    ).toBeTruthy()
  })

  it("shows the empty state with a link to browse listings", async () => {
    db.threads.splice(0)
    db.messages.splice(0)
    await open()
    expect(await screen.findByText("No messages yet")).toBeTruthy()
    expect(
      screen.getByRole("link", { name: "Browse listings" }).getAttribute("href")
    ).toBe("/en/vehicles/cars/sale")
  })

  it("says so when the thread in the URL is not in the inbox", async () => {
    await open("?thread=nope")
    expect(
      await screen.findByText("This conversation is not available.")
    ).toBeTruthy()
    expect(
      screen.getByRole("button", { name: "Back to conversations" })
    ).toBeTruthy()
  })

  it("a workshop sees Inquiries and a link to its public profile when empty", async () => {
    db.threads.splice(0)
    db.messages.splice(0)
    await open("", "workshop", "inquiries")
    expect(screen.getByRole("heading", { level: 1 }).textContent).toBe(
      "Inquiries"
    )
    expect(await screen.findByText("No inquiries yet")).toBeTruthy()
    const link = await screen.findByRole("link", {
      name: "View your public profile",
    })
    expect(link.getAttribute("href")).toMatch(/^\/en\/workshops\/.+/)
  })
})
