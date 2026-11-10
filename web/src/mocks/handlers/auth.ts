import { customAlphabet, nanoid } from "nanoid"

import { normalizePhone } from "@sayaratak/shared/lib/phone"
import {
  codeSentSchema,
  notificationPrefsSchema,
  okSchema,
  draftSchema,
  resetTokenSchema,
} from "@sayaratak/shared/schemas/api"
import {
  codeInputSchema,
  draftInputSchema,
  emailInputSchema,
  loginInputSchema,
  notificationPrefsInputSchema,
  oauthInputSchema,
  otpSendInputSchema,
  otpVerifyInputSchema,
  passwordInputSchema,
  profilePatchSchema,
  resetInputSchema,
  signupInputSchema,
} from "@sayaratak/shared/schemas/inputs"
import { defaultPrefs, slugify } from "@/mocks/seed/util"

import { db, find, insert, newId } from "../db"
import { removeAccount } from "../account"
import { fail, needUser, route, withSession } from "../http"
import { nowIso, publicUser } from "../lib"
import type { EmailCode, UserRow } from "../types"

const WINDOW_MS = 10 * 60_000
const MAX_FAILS = 5
const isEmail = (id: string) => id.includes("@")
const normalize = (id: string) =>
  isEmail(id) ? id.trim().toLowerCase() : normalizePhone(id)
export const findByIdentifier = (id: string) => {
  const key = normalize(id)
  return db.users.find((u) => (isEmail(id) ? u.email === key : u.phone === key))
}

const CODE_TTL_MS = 10 * 60_000
const CODE_FAILS = 5
const newCode = customAlphabet("0123456789", 6)

function sendCode(key: string, signup?: EmailCode["signup"]) {
  const code = newCode()
  db.codes.set(key, {
    code,
    expiresAt: Date.now() + CODE_TTL_MS,
    fails: 0,
    signup,
  })
  return codeSentSchema.parse({ ok: true, demoCode: code })
}
// A code works once. Five wrong tries or ten minutes and it is gone; the person asks for a new one.
function checkCode(key: string, code: string) {
  const entry = db.codes.get(key)
  if (!entry || entry.expiresAt < Date.now()) {
    db.codes.delete(key)
    throw fail(410, "code_expired")
  }
  if (entry.code !== code) {
    if (++entry.fails >= CODE_FAILS) db.codes.delete(key)
    throw fail(422, "otp_invalid", { code: "auth.otp_invalid" })
  }
  db.codes.delete(key)
  return entry
}

function throttled(key: string) {
  const recent = (db.attempts.get(key) ?? []).filter(
    (t) => Date.now() - t < WINDOW_MS
  )
  db.attempts.set(key, recent)
  const first = recent[0]
  if (recent.length >= MAX_FAILS && first !== undefined) {
    throw fail(429, "too_many_attempts", undefined, {
      retryAfter: Math.ceil((first + WINDOW_MS - Date.now()) / 1000),
    })
  }
}

route("GET", "/me", ({ user }) => (user ? publicUser(user) : null))

route("POST", "/auth/login", async (c) => {
  const { email, password } = await c.body(loginInputSchema)
  throttled(email)
  const user = findByIdentifier(email)
  if (!user || user.password !== password) {
    db.attempts.set(email, [...(db.attempts.get(email) ?? []), Date.now()])
    throw fail(401, "invalid_credentials")
  }
  if (user.banned) throw fail(403, "banned")
  db.attempts.delete(email)
  return withSession(user.id, publicUser(user))
})

// Sign up: nothing is created until the emailed code comes back. Sending again replaces the code.
route("POST", "/auth/signup", async (c) => {
  const { email, fullName, password } = await c.body(signupInputSchema)
  if (findByIdentifier(email)) throw fail(409, "exists")
  return sendCode(`signup:${email}`, { fullName, password })
})
route("POST", "/auth/signup/verify", async (c) => {
  const { email, code } = await c.body(codeInputSchema)
  const { signup } = checkCode(`signup:${email}`, code)
  if (!signup) throw fail(410, "code_expired")
  if (findByIdentifier(email)) throw fail(409, "exists")
  const user: UserRow = {
    id: newId("u"),
    role: "user",
    fullName: signup.fullName,
    password: signup.password,
    email,
    verifiedPhone: false,
    verifiedEmail: true,
    banned: false,
    createdAt: nowIso(),
    onboardingDone: false,
    interests: [],
    locale: "ar",
    prefs: { ...defaultPrefs },
  }
  insert(db.users, user)
  return withSession(user.id, publicUser(user), 201)
})

route("POST", "/auth/oauth/:provider", async (c) => {
  if (c.params.provider !== "google" && c.params.provider !== "facebook")
    throw fail(404, "not_found")
  const { accountId } = await c.body(oauthInputSchema)
  const email = `${c.params.provider}-${slugify(accountId)}@demo.sy`
  let user = db.users.find((u) => u.email === email)
  if (!user) {
    user = {
      id: newId("u"),
      role: "user",
      fullName: accountId,
      email,
      password: null,
      verifiedPhone: false,
      verifiedEmail: true,
      banned: false,
      createdAt: nowIso(),
      onboardingDone: false,
      interests: [],
      locale: "ar",
      prefs: { ...defaultPrefs },
    }
    insert(db.users, user)
  }
  if (user.banned) throw fail(403, "banned")
  return withSession(user.id, publicUser(user))
})

route("POST", "/auth/otp/send", async (c) => {
  const { identifier } = await c.body(otpSendInputSchema)
  // Signed in, the code is for a new phone or email, so one that another account owns is refused up front.
  const owner = identifier ? findByIdentifier(identifier) : undefined
  if (c.user && owner && owner.id !== c.user.id) throw fail(409, "exists")
  return okSchema.parse({ ok: true })
})
// The code 123456 always passes; a signed-in user gets the matching verified flag.
route("POST", "/auth/otp/verify", async (c) => {
  const { code, identifier } = await c.body(otpVerifyInputSchema)
  if (code !== "123456")
    throw fail(422, "otp_invalid", { code: "auth.otp_invalid" })
  // Signed out (code instead of a password): the code signs in the matching account.
  const user = c.user ?? (identifier ? findByIdentifier(identifier) : undefined)
  if (user) {
    if (user.banned) throw fail(403, "banned")
    if (identifier ? isEmail(identifier) : !user.phone)
      user.verifiedEmail = true
    else user.verifiedPhone = true
    return c.user ? publicUser(user) : withSession(user.id, publicUser(user))
  }
  return okSchema.parse({ ok: true })
})

// Answers the same whether or not the account exists; only a real account gets a code.
route("POST", "/auth/forgot", async (c) => {
  const { email } = await c.body(emailInputSchema)
  return findByIdentifier(email)
    ? sendCode(`reset:${email}`)
    : codeSentSchema.parse({ ok: true })
})
route("POST", "/auth/forgot/verify", async (c) => {
  const { email, code } = await c.body(codeInputSchema)
  checkCode(`reset:${email}`, code)
  const user = findByIdentifier(email)
  if (!user) throw fail(410, "code_expired")
  const token = nanoid()
  db.resetTokens.set(token, user.id)
  return resetTokenSchema.parse({ token })
})
route("POST", "/auth/reset", async (c) => {
  const { token, password } = await c.body(resetInputSchema)
  const user = db.users.find((u) => u.id === db.resetTokens.get(token))
  if (!user) throw fail(422, "invalid_token")
  db.resetTokens.delete(token)
  user.password = password
  for (const id of [user.email, user.phone])
    if (id) db.attempts.delete(normalize(id))
  return okSchema.parse({ ok: true })
})
route("POST", "/auth/logout", () => withSession(null, { ok: true }))

// Match the real API (11.1): email needs a code; phone saves unverified until SMS exists.
route("PATCH", "/me", async (c) => {
  const user = needUser(c)
  const { code, email, phone, cityId, avatarUrl, locale, ...rest } =
    await c.body(profilePatchSchema)
  const change = (
    field: "email" | "phone",
    verified: "verifiedEmail" | "verifiedPhone",
    value: string | undefined
  ) => {
    if (value === undefined || value === user[field]) return
    if (value === "") {
      if (field === "email") throw fail(422, "contact_required")
      delete user[field]
      user[verified] = false
      return
    }
    if (db.users.some((u) => u.id !== user.id && u[field] === value))
      throw fail(409, "exists")
    if (field === "email" && code !== "123456")
      throw fail(422, "otp_invalid", { code: "auth.otp_invalid" })
    user[field] = value
    user[verified] = field === "email"
  }
  change("email", "verifiedEmail", email)
  change("phone", "verifiedPhone", phone)
  Object.assign(user, rest)
  if (locale) user.locale = locale
  if (cityId !== undefined) user.cityId = cityId || undefined
  if (avatarUrl !== undefined) user.avatarUrl = avatarUrl || undefined
  return publicUser(user)
})
route("POST", "/me/password", async (c) => {
  const user = needUser(c)
  const { currentPassword, newPassword } = await c.body(passwordInputSchema)
  if (user.password && user.password !== currentPassword)
    throw fail(401, "invalid_credentials")
  user.password = newPassword
  return okSchema.parse({ ok: true })
})
route("DELETE", "/me", (c) => {
  const user = needUser(c)
  if (user.role === "admin") throw fail(403, "forbidden")
  removeAccount(user)
  return withSession(null, { ok: true })
})
route("GET", "/me/notification-prefs", (c) =>
  notificationPrefsSchema.parse(needUser(c).prefs)
)
route("PATCH", "/me/notification-prefs", async (c) => {
  const user = needUser(c)
  const patch = await c.body(notificationPrefsInputSchema)
  Object.assign(user.prefs, patch)
  return notificationPrefsSchema.parse(user.prefs)
})

route("GET", "/drafts/:key", (c) => {
  const user = needUser(c)
  return draftSchema.parse({
    data: find(db.drafts, `${user.id}:${c.params.key}`)?.data ?? {},
  })
})
route("PATCH", "/drafts/:key", async (c) => {
  const user = needUser(c)
  const { data } = await c.body(draftInputSchema)
  const id = `${user.id}:${c.params.key}`
  const row = find(db.drafts, id)
  if (row) row.data = data
  else insert(db.drafts, { id, userId: user.id, key: c.params.key ?? "", data })
  return draftSchema.parse({ data })
})
