import { expect, it } from "vitest"

import {
  codeInputSchema,
  contactInputSchema,
  deviceInputSchema,
  draftInputSchema,
  emailInputSchema,
  eventInputSchema,
  favoriteInputSchema,
  favoriteSortSchema,
  listingCreateSchema,
  listingPatchSchema,
  listingStatusInputSchema,
  loginInputSchema,
  messageInputSchema,
  notificationPrefsInputSchema,
  oauthInputSchema,
  onboardingInputSchema,
  otpSendInputSchema,
  otpVerifyInputSchema,
  passwordInputSchema,
  profilePatchSchema,
  promotionInputSchema,
  readInputSchema,
  replyInputSchema,
  reportInputSchema,
  resetInputSchema,
  reviewInputSchema,
  reviewPatchSchema,
  savedSearchInputSchema,
  savedSearchPatchSchema,
  signupInputSchema,
  threadInputSchema,
} from "@sayaratak/shared/schemas/inputs"
import { runCases } from "./schema-case"

const email = "a@b.co"
const password = "abcd1234"
const contact = {
  phone: "+249912345678",
  whatsapp: null,
  showPhone: true,
  methods: ["call"],
}
const listing = {
  title: "Toyota Hilux 2019",
  price: 4_500_000,
  cityId: "khartoum",
  contact,
}
const review = {
  targetType: "dealership",
  targetId: "d1",
  rating: 4,
  body: "Good service and fair prices.",
}

// Request bodies for auth, profile, listings, reviews, saved searches, messages and reports.
runCases([
  {
    name: "loginInputSchema",
    schema: loginInputSchema,
    valid: [{ email, password: "x" }],
    bad: [
      ["bad email", { email: "a", password: "x" }, "validation.email"],
      ["no password", { email, password: "" }, "validation.required"],
    ],
  },
  {
    name: "signupInputSchema",
    schema: signupInputSchema,
    valid: [{ fullName: "Omar Hassan", email, password }],
    bad: [
      ["short name", { fullName: "O", email, password }, "validation.name_min"],
      [
        "weak password",
        { fullName: "Omar", email, password: "abc" },
        "validation.password_min",
      ],
    ],
  },
  {
    name: "emailInputSchema",
    schema: emailInputSchema,
    valid: [{ email }],
    bad: [["bad email", { email: "x" }, "validation.email"]],
  },
  {
    name: "codeInputSchema",
    schema: codeInputSchema,
    valid: [{ email, code: "123456" }],
    bad: [["five digits", { email, code: "12345" }, "validation.otp"]],
  },
  {
    name: "oauthInputSchema",
    schema: oauthInputSchema,
    valid: [{ accountId: "g1" }],
    bad: [["empty", { accountId: "" }, "validation.required"]],
  },
  {
    name: "otpSendInputSchema",
    schema: otpSendInputSchema,
    valid: [{}, { identifier: email }],
    bad: [["number", { identifier: 1 }]],
  },
  {
    name: "otpVerifyInputSchema",
    schema: otpVerifyInputSchema,
    valid: [{ code: "123456" }],
    bad: [["empty code", { code: "" }, "validation.otp"]],
  },
  {
    name: "resetInputSchema",
    schema: resetInputSchema,
    valid: [{ token: "t", password }],
    bad: [
      ["no token", { token: "", password }, "validation.required"],
      [
        "no digit",
        { token: "t", password: "abcdefgh" },
        "validation.password_digit",
      ],
    ],
  },
  {
    name: "profilePatchSchema",
    schema: profilePatchSchema,
    valid: [
      {},
      { email: "", phone: "" },
      { fullName: "Omar", interests: ["cars"], locale: "en" },
    ],
    bad: [
      ["bad phone", { phone: "0912" }, "validation.phone"],
      ["empty code", { code: "" }, "validation.otp"],
      ["unknown interest", { interests: ["boats"] }],
    ],
  },
  {
    name: "passwordInputSchema",
    schema: passwordInputSchema,
    valid: [
      { newPassword: password },
      { currentPassword: "old", newPassword: password },
    ],
    bad: [["weak", { newPassword: "12345678" }, "validation.password_letter"]],
  },
  {
    name: "draftInputSchema",
    schema: draftInputSchema,
    valid: [{ data: { a: 1 } }],
    bad: [["no data", {}]],
  },
  {
    name: "onboardingInputSchema",
    schema: onboardingInputSchema,
    valid: [{ role: "dealership" }, { role: "user", payload: { a: 1 } }],
    bad: [["admin", { role: "admin" }]],
  },
  {
    name: "notificationPrefsInputSchema",
    schema: notificationPrefsInputSchema,
    valid: [{}, { messages: false }],
    bad: [["not a boolean", { messages: "no" }]],
  },
  {
    name: "listingCreateSchema",
    schema: listingCreateSchema,
    valid: [listing, { ...listing, kind: "part", year: null, mileageKm: null }],
    bad: [
      ["no title", { ...listing, title: " " }, "validation.required"],
      [
        "long title",
        { ...listing, title: "a".repeat(121) },
        "validation.too_long",
      ],
      ["zero price", { ...listing, price: 0 }, "validation.price_min"],
      ["no city", { ...listing, cityId: "" }, "validation.required"],
      [
        "no contact method",
        { ...listing, contact: { ...contact, methods: [] } },
        "validation.contact_required",
      ],
      [
        "bad phone",
        { ...listing, contact: { ...contact, phone: "0912" } },
        "validation.phone",
      ],
      ["old year", { ...listing, year: 1900 }, "validation.year_range"],
      ["negative mileage", { ...listing, mileageKm: -1 }, "validation.number"],
      [
        "long description",
        { ...listing, description: "a".repeat(4001) },
        "validation.too_long",
      ],
    ],
  },
  {
    name: "listingPatchSchema",
    schema: listingPatchSchema,
    valid: [{}, { price: 10, moderation: "approved" }],
    bad: [
      ["zero price", { price: 0 }, "validation.price_min"],
      ["unknown moderation", { moderation: "maybe" }],
    ],
  },
  {
    name: "listingStatusInputSchema",
    schema: listingStatusInputSchema,
    valid: [{ status: "sold" }],
    bad: [["unknown", { status: "lost" }]],
  },
  {
    name: "reviewInputSchema",
    schema: reviewInputSchema,
    valid: [review, { ...review, body: undefined }],
    bad: [
      ["no rating", { ...review, rating: 0 }, "validation.rating_required"],
      ["six stars", { ...review, rating: 6 }],
      ["short body", { ...review, body: "ok" }, "validation.review_min"],
      [
        "long body",
        { ...review, body: "a".repeat(1001) },
        "validation.too_long",
      ],
      ["listing target", { ...review, targetType: "listing" }],
    ],
  },
  {
    name: "reviewPatchSchema",
    schema: reviewPatchSchema,
    valid: [{}, { rating: 5 }],
    bad: [["short body", { body: "ok" }, "validation.review_min"]],
  },
  {
    name: "replyInputSchema",
    schema: replyInputSchema,
    valid: [{ body: "Thanks" }],
    bad: [
      ["one letter", { body: " a " }, "validation.message_min"],
      ["long", { body: "a".repeat(1001) }, "validation.too_long"],
    ],
  },
  {
    name: "favoriteInputSchema",
    schema: favoriteInputSchema,
    valid: [{ listingId: "k1" }],
    bad: [["empty", { listingId: "" }]],
  },
  {
    name: "favoriteSortSchema",
    schema: favoriteSortSchema,
    valid: ["recent", "price_desc"],
    bad: [["unknown", "oldest"]],
  },
  {
    name: "savedSearchInputSchema",
    schema: savedSearchInputSchema,
    valid: [{ name: "Hilux", params: {} }],
    bad: [
      ["no name", { name: "", params: {} }, "validation.required"],
      [
        "long name",
        { name: "a".repeat(61), params: {} },
        "validation.too_long",
      ],
    ],
  },
  {
    name: "savedSearchPatchSchema",
    schema: savedSearchPatchSchema,
    valid: [{}, { alerts: false, markSeen: true }],
    bad: [["blank name", { name: " " }, "validation.required"]],
  },
  {
    name: "threadInputSchema",
    schema: threadInputSchema,
    valid: [{ subjectType: "listing", subjectId: "k1", body: "Hi" }],
    bad: [
      [
        "blank body",
        { subjectType: "listing", subjectId: "k1", body: " " },
        "validation.message_min",
      ],
      [
        "long body",
        { subjectType: "listing", subjectId: "k1", body: "a".repeat(2001) },
        "validation.too_long",
      ],
      ["unknown subject", { subjectType: "user", subjectId: "k1", body: "Hi" }],
    ],
  },
  {
    name: "messageInputSchema",
    schema: messageInputSchema,
    valid: [{ body: "Hi" }],
    bad: [["blank", { body: "" }, "validation.message_min"]],
  },
  {
    name: "readInputSchema",
    schema: readInputSchema,
    valid: [{}, { ids: ["n1"] }],
    bad: [["not a list", { ids: "n1" }]],
  },
  {
    name: "deviceInputSchema",
    schema: deviceInputSchema,
    valid: [
      { platform: "ios", fcmToken: "t:1", appVersion: "1.4.0", locale: "ar" },
    ],
    bad: [
      [
        "unknown platform",
        { platform: "web", fcmToken: "t", appVersion: "1", locale: "ar" },
      ],
      [
        "empty token",
        { platform: "ios", fcmToken: "", appVersion: "1", locale: "en" },
      ],
      [
        "unknown locale",
        { platform: "ios", fcmToken: "t", appVersion: "1", locale: "fr" },
      ],
    ],
  },
  {
    name: "promotionInputSchema",
    schema: promotionInputSchema,
    valid: [
      { listingId: "k1", priceId: "featured-7" },
      { listingId: "k1", useCredit: true },
    ],
    bad: [
      ["neither a price nor a credit", { listingId: "k1" }],
      ["empty price id", { listingId: "k1", priceId: "" }],
    ],
  },
  {
    name: "reportInputSchema",
    schema: reportInputSchema,
    valid: [{ listingId: "k1", reason: "scam" }],
    bad: [
      ["unknown reason", { listingId: "k1", reason: "rude" }],
      [
        "long details",
        { listingId: "k1", reason: "other", details: "a".repeat(1001) },
        "validation.too_long",
      ],
    ],
  },
  {
    name: "contactInputSchema",
    schema: contactInputSchema,
    valid: [
      {
        name: "Omar",
        contact: "0912345678",
        subject: "general",
        message: "A question about a car.",
      },
    ],
    bad: [
      [
        "short name",
        {
          name: "O",
          contact: email,
          subject: "general",
          message: "A question about a car.",
        },
        "validation.name_min",
      ],
      [
        "bad contact",
        {
          name: "Omar",
          contact: "abc",
          subject: "general",
          message: "A question about a car.",
        },
        "validation.identifier",
      ],
      [
        "short message",
        { name: "Omar", contact: email, subject: "general", message: "Hi" },
        "validation.message_min",
      ],
    ],
  },
  {
    name: "eventInputSchema",
    schema: eventInputSchema,
    valid: [{ type: "view", targetId: "k1" }],
    bad: [["unknown type", { type: "like", targetId: "k1" }]],
  },
])

it("savedSearchInputSchema turns alerts on by default", () => {
  expect(
    savedSearchInputSchema.parse({ name: "Hilux", params: {} }).alerts
  ).toBe(true)
})
