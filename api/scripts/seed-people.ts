import { hashPassword } from "better-auth/crypto"

import { account, user } from "~/modules/auth/auth.tables"
import * as biz from "~/modules/businesses/businesses.tables"
import { uploads } from "~/modules/uploads/uploads.tables"
import type { Executor } from "~/shared/db/tx"

import type { buildSeed } from "../../web/src/mocks/seed"

type Seed = ReturnType<typeof buildSeed>
type Upload = typeof uploads.$inferInsert
type Photo = {
  url: string
  width?: number
  height?: number
  placeholderColor?: string
}

// Demo photos are web's `public/mock` files, kept as `url` uploads (2.7).
function demoUpload(id: string, ownerUserId: string, photo: Photo): Upload {
  return {
    id,
    ownerUserId,
    kind: "image",
    delivery: "public",
    url: photo.url,
    width: photo.width,
    height: photo.height,
    placeholderColor: photo.placeholderColor,
    attachedAt: new Date(),
    createdAt: new Date(),
  }
}

/** Users with a credential account each, then the three kinds of business and their parts. */
export async function seedPeople(ex: Executor, data: Seed) {
  const files: Upload[] = []
  await ex.insert(user).values(data.users.map(userRow)).onConflictDoNothing()
  await seedPasswords(ex, data)
  const image = (id: string, owner: string, url: string | undefined) => {
    if (!url) return null
    files.push(demoUpload(id, owner, { url }))
    return id
  }
  const rows = businessRows(data, image)
  const parts = businessParts(data, files)
  await ex.insert(uploads).values(files).onConflictDoNothing()
  await ex
    .insert(biz.dealerships)
    .values(rows.dealerships)
    .onConflictDoNothing()
  await ex.insert(biz.workshops).values(rows.workshops).onConflictDoNothing()
  await ex.insert(biz.mechanics).values(rows.mechanics).onConflictDoNothing()
  await ex.insert(biz.workshopImages).values(parts.images).onConflictDoNothing()
  await ex
    .insert(biz.workshopServices)
    .values(parts.services)
    .onConflictDoNothing()
  await ex
    .insert(biz.portfolioItems)
    .values(parts.portfolio)
    .onConflictDoNothing()
  await ex.insert(biz.mechanicCities).values(parts.cities).onConflictDoNothing()
  await ex
    .insert(biz.mechanicSpecializations)
    .values(parts.skills)
    .onConflictDoNothing()
}

function userRow(row: Seed["users"][number]): typeof user.$inferInsert {
  const createdAt = new Date(row.createdAt)
  return {
    id: row.id,
    name: row.fullName,
    // Every seeded account has one since 2.2; the fallback only satisfies the optional API type.
    email: row.email ?? `${row.id}@example.sy`,
    emailVerified: row.verifiedEmail,
    createdAt,
    updatedAt: createdAt,
    role: row.role,
    // Every admin signs in with an emailed code as well (A6, owner 3.7).
    twoFactorEnabled: row.role === "admin",
    banned: row.banned,
    banReason: row.bannedReason,
    banExpires: row.bannedUntil ? new Date(row.bannedUntil) : null,
    phone: row.phone,
    verifiedPhone: row.verifiedPhone,
    cityId: row.cityId,
    locale: row.locale,
    onboardingDone: row.onboardingDone,
    interests: row.interests,
    prefs: row.prefs,
    chosenPlanId: row.chosenPlanId,
  }
}

// Hashing is slow on purpose, and every demo account shares a few passwords: one hash each.
async function seedPasswords(ex: Executor, data: Seed) {
  const hashes = new Map<string, string>()
  for (const row of data.users)
    if (row.password && !hashes.has(row.password))
      hashes.set(row.password, await hashPassword(row.password))
  const rows = data.users.flatMap((row) => {
    const password = row.password && hashes.get(row.password)
    if (!password) return []
    const at = new Date(row.createdAt)
    const id = `acc-${row.id}`
    return [
      {
        id,
        accountId: row.id,
        providerId: "credential",
        userId: row.id,
        password,
        createdAt: at,
        updatedAt: at,
      },
    ]
  })
  await ex.insert(account).values(rows).onConflictDoNothing()
}

type Image = (
  id: string,
  owner: string,
  url: string | undefined
) => string | null

function businessRows(data: Seed, image: Image) {
  const place = (
    b: Seed["dealerships"][number] | Seed["workshops"][number]
  ) => ({
    ownerUserId: b.ownerId,
    districtId: b.districtId || null,
    lat: b.location?.lat,
    lng: b.location?.lng,
    logoUploadId: image(`up-${b.id}-logo`, b.ownerId, b.logoUrl),
    coverUploadId: image(`up-${b.id}-cover`, b.ownerId, b.coverUrl),
    createdAt: new Date(b.createdAt),
  })
  return {
    dealerships: data.dealerships.map((b) => ({ ...b, ...place(b) })),
    workshops: data.workshops.map((b) => ({ ...b, ...place(b) })),
    mechanics: data.mechanics.map((m) => ({
      ...m,
      ownerUserId: m.ownerId,
      photoUploadId: image(`up-${m.id}-photo`, m.ownerId, m.photoUrl),
      createdAt: new Date(m.createdAt),
    })),
  }
}

// Workshop photos and portfolio items keep the mock's ids: a photo's media id is its upload id.
function businessParts(data: Seed, files: Upload[]) {
  const images = data.workshops.flatMap((w) =>
    w.images.map((media, position) => {
      files.push(demoUpload(media.id, w.ownerId, media))
      return { workshopId: w.id, position, uploadId: media.id }
    })
  )
  const services = data.workshops.flatMap((w) =>
    w.services.map((s, position) => ({ ...s, workshopId: w.id, position }))
  )
  const portfolio = data.mechanics.flatMap((m) =>
    m.portfolio.map(({ id, caption, ...photo }, position) => {
      files.push(demoUpload(`up-${id}`, m.ownerId, photo))
      return { id, mechanicId: m.id, uploadId: `up-${id}`, caption, position }
    })
  )
  const ordered = (key: "servedCityIds" | "specializationIds") =>
    data.mechanics.flatMap((m) =>
      m[key].map((id, position) => ({ mechanicId: m.id, id, position }))
    )
  return {
    images,
    services,
    portfolio,
    cities: ordered("servedCityIds").map(({ id, ...r }) => ({
      ...r,
      cityId: id,
    })),
    skills: ordered("specializationIds").map(({ id, ...r }) => ({
      ...r,
      specializationId: id,
    })),
  }
}
