import { SQL } from "bun"

import { ALL_PREFS } from "~/shared/db/defaults"

import { runMigrations } from "./migrate"

/**
 * 10.6: a scratch database at production size, for `EXPLAIN ANALYZE` and the load run.
 * 50,000 listings (about 110,000 photos), 5,000 users, 500,000 event rows, plus 100,000
 * notifications and 10,000 threads with 50,000 messages so those queries have something to read.
 *
 *   createdb sayaratak_scale
 *   DATABASE_URL=postgres://.../sayaratak_scale bun scripts/scale-seed.ts
 *
 * The database name must end in `_scale`: this script writes a lot of rows and never touches
 * the dev or production database. Generated in SQL with a fixed `setseed`, so a run is repeatable.
 */
const url = Bun.env.DATABASE_URL ?? ""
if (Bun.env.APP_ENV === "production" || !/_scale(\?.*)?$/.test(url)) {
  process.stderr.write(
    "scale-seed needs DATABASE_URL on a database ending in _scale\n"
  )
  process.exit(1)
}

await runMigrations(url)
const { bootstrap } = await import("./bootstrap")
const { db } = await import("~/shared/db/client")
await bootstrap(db)

// One connection, so `setseed` and the temp tables reach every statement.
const sql = new SQL({ url, max: 1 })
const [{ n }] = await sql`select count(*)::int n from listings`
if (n > 0) {
  process.stderr.write(
    "already seeded; drop the database and create it again\n"
  )
  process.exit(1)
}

const hex = (prefix: string, expr: string, width: number) =>
  `'${prefix}' || lpad(to_hex(${expr}), ${width}, '0')`
const prefs = JSON.stringify(ALL_PREFS)
const pick = (list: string[], r = "random()") =>
  `(array[${list.map((w) => `'${w}'`).join(",")}])[1 + floor(${r} * ${list.length})::int]`
const words = pick([
  "clean",
  "imported",
  "family car",
  "first owner",
  "full option",
  "accident free",
  "نظيفة",
  "وارد",
  "فل كامل",
  "استخدام شخصي",
  "وكالة",
  "بحالة ممتازة",
])

const steps: [string, string][] = [
  ["seed", "select setseed(0.42)"],
  [
    "users 5,000",
    `insert into "user" (id, name, email, email_verified, created_at, updated_at, role, banned, verified_phone, prefs)
     select ${hex("u", "i", 5)}, 'User ' || i, 'user' || i || '@scale.test', true,
       now() - random() * interval '700 days', now(),
       case when i <= 200 then 'dealership'::role else 'user'::role end,
       i % 250 = 0, random() < 0.4, '${prefs}'::jsonb
     from generate_series(1, 5000) i`,
  ],
  [
    "model lookup",
    `create temp table tm as
     select row_number() over (order by m.id) rn, m.id model_id, m.make_id,
       k.name ->> 'ar' || ' ' || (k.name ->> 'en') make_names, m.name ->> 'ar' || ' ' || (m.name ->> 'en') model_names,
       k.name ->> 'en' make_en, m.name ->> 'en' model_en
     from models m join makes k on k.id = m.make_id;
     create temp table tc as
     select row_number() over (order by position) rn, id, lat, lng from cities;
     create temp table gen as
     select i, random() a, random() b, random() c, random() d, random() e, random() f, random() g, random() h, random() j, random() k, random() m, random() n
     from generate_series(1, 50000) i`,
  ],
  [
    "listings 50,000",
    // One random column for each thing that must not move with another: a city, b kind and type, c model,
    // d date and condition, e price and year, f geo, g intent, h owner, j status, k transmission, m fuel, n moderation.
    `insert into listings (id, slug, owner_user_id, owner_type, owner_name, kind, intent, vehicle_type, title,
       description, price, negotiable, rent_period, condition, make_id, model_id, year, mileage_km, fuel,
       transmission, color, engine_cc, part_number, part_category_id, compatible_types, details, city_id,
       district_id, lat, lng, contact, status, moderation, search_text, bumped_at, expires_at, created_at, updated_at)
     select l.id, 's-' || l.id, ${hex("u", "l.owner", 5)}, case when l.owner <= 200 then 'dealership' else 'user' end::owner_type,
       jsonb_build_object('ar', 'بائع ' || l.owner, 'en', 'Seller ' || l.owner),
       l.kind, l.intent, l.vtype, l.title, jsonb_build_object('ar', l.desc_ar, 'en', l.desc_en),
       l.price, l.g > 0.5, case when l.intent = 'rent' then 'day'::rent_period end,
       case when l.d < 0.2 then 'new' else 'used' end::condition,
       l.make_id, l.model_id, l.yr, l.km,
       case when l.kind = 'vehicle' then (array['petrol','diesel','hybrid','electric','lpg'])[1 + floor(l.m * 5)::int]::fuel end,
       case when l.kind = 'vehicle' then (array['automatic','manual'])[1 + floor(l.k * 2)::int]::transmission end,
       case when l.kind = 'vehicle' then (array['white','black','silver','blue','red'])[1 + floor(l.e * 5)::int] end,
       case when l.kind = 'vehicle' then 1000 + floor(l.f * 3000)::int end,
       case when l.kind = 'part' then 'PN-' || l.i end,
       case when l.kind = 'part' then (select id from part_categories order by id offset floor(l.c * 10)::int limit 1) end,
       case when l.kind = 'part' then (case when l.b < 0.9 then array['car']::vehicle_type[] else array['car','truck']::vehicle_type[] end) else '{}' end,
       '{}'::jsonb, l.city, l.district, l.lat, l.lng,
       '{"phone":"+249912345678","whatsapp":"+249912345678","showPhone":true,"methods":["call","whatsapp","chat"]}'::jsonb,
       l.status::listing_status, l.moderation::moderation,
       lower(concat_ws(' ', l.title, l.desc_ar, l.desc_en, l.make_names, l.model_names)),
       case when l.f < 0.1 then l.created + (now() - l.created) * l.g end,
       now() + (l.g - 0.1) * interval '60 days', l.created, l.created
     from (
       select g.*, ${hex("l", "g.i", 5)} id,
         case when g.i <= 15000 then 1 + floor(200 * g.h * g.h)::int else 201 + floor(4800 * power(g.h, 1.5))::int end owner,
         case when g.b < 0.85 then 'vehicle' else 'part' end::listing_kind kind,
         case when g.g < 0.75 then 'sale' else 'rent' end::intent intent,
         case when g.b >= 0.85 then null when g.b < 0.6 then 'car' when g.b < 0.7 then 'truck' when g.b < 0.77 then 'motorcycle'
           when g.b < 0.82 then 'tuk_tuk' else 'rickshaw' end::vehicle_type vtype,
         case when g.b >= 0.85 then null else m.make_id end make_id, case when g.b >= 0.85 then null else m.model_id end model_id,
         m.make_names, m.model_names, tc.id city,
         (select d.id from districts d where d.city_id = tc.id order by random() limit 1) district,
         case when g.f < 0.7 then tc.lat + (g.d - 0.5) * 0.2 end lat, case when g.f < 0.7 then tc.lng + (g.e - 0.5) * 0.2 end lng,
         case when g.b >= 0.85 then null else 1995 + floor(g.e * 31)::int end yr,
         case when g.b >= 0.85 then null else floor(g.f * 350000)::int end km,
         case when g.b >= 0.85 then 'Part ' || g.i else m.make_en || ' ' || m.model_en || ' ' || (1995 + floor(g.e * 31)::int) end title,
         ${pick(["Well kept", "Ready to drive", "Serious buyers only"], "g.g")} || ' ' || m.make_en || ' ' || ${words} desc_en,
         m.make_names || ' ' || ${words} desc_ar,
         case when g.b >= 0.85 then 5000 + floor(g.e * g.e * 500000)::int when g.g >= 0.75 then 20000 + floor(g.e * 280000)::int
           else 2000000 + floor(g.e * g.e * 58000000)::int end price,
         case when g.n < 0.85 then 'approved' when g.n < 0.9 then 'pending' when g.n < 0.94 then 'rejected'
           when g.n < 0.97 then 'draft' else 'removed' end moderation,
         case when g.j < 0.75 then 'available' when g.j < 0.83 then 'reserved' when g.j < 0.95 then 'sold' else 'rented' end status,
         now() - g.d * interval '60 days' created
       from gen g
       join tm m on m.rn = 1 + floor(g.c * (select count(*) from tm))::int
       join tc on tc.rn = 1 + floor(10 * g.a * g.a)::int
     ) l`,
  ],
  [
    "stats and promotions",
    `insert into listing_stats select id, floor(random() * 2000), floor(random() * 50), floor(random() * 80), floor(random() * 40) from listings;
     insert into promotions (id, listing_id, type, status, duration_days, starts_at, ends_at, source)
     select ${hex("p", "row_number() over ()", 5)}, id, 'featured', 'active', 7, now() - interval '1 day', now() + interval '5 days', 'paid'
     from (select id from listings where moderation = 'approved' order by random() limit 400) f`,
  ],
  [
    "photos",
    `create temp table mg as
     select row_number() over () n, l.id lid, l.owner_user_id owner, p.p pos
     from listings l join generate_series(1, 4) p(p) on p.p <= case when abs(hashtext(l.id)) % 7 = 0 then 0 else 1 + abs(hashtext(l.id)) % 4 end;
     insert into uploads (id, owner_user_id, kind, url, delivery, width, height, placeholder_color, attached_at, created_at)
     select ${hex("m", "n", 6)}, owner, 'image', 'https://scale.example/p/' || n || '-{w}.jpg', 'public', 1200, 900, '#888888', now(), now() from mg;
     insert into listing_media select lid, pos - 1, ${hex("m", "n", 6)} from mg`,
  ],
  [
    "events 500,000",
    `insert into events select current_date - d, l.id, 'view', 1 + floor(random() * 30)::int
     from listings l cross join generate_series(0, 9) d`,
  ],
  [
    "notifications 100,000",
    `insert into notifications (id, user_id, type, title, body, href, created_at, read_at)
     select ${hex("n", "n", 6)}, ${hex("u", "1 + (n % 5000)", 5)},
       (enum_range(null::notification_type))[1 + floor(random() * 12)::int],
       '{"ar":"إشعار","en":"Notice"}'::jsonb, '{"ar":"نص","en":"Body"}'::jsonb, '/account',
       now() - random() * interval '180 days', case when random() < 0.7 then now() - random() * interval '90 days' end
     from generate_series(1, 100000) n`,
  ],
  [
    "threads 10,000, messages 50,000",
    `create temp table tg as
     select t, case when t % 10 < 3 then 1 + (t % 200) else 201 + (t * 7919) % 4800 end a, 201 + (t * 104729) % 4800 b
     from generate_series(1, 10000) t;
     insert into threads select ${hex("t", "t", 5)}, 'listing', ${hex("l", "t", 5)}, '{"ar":"إعلان","en":"Listing"}'::jsonb, null,
       ${hex("u", "least(a, b)", 5)} || ':' || ${hex("u", "greatest(a, b)", 5)}, now() - random() * interval '90 days' from tg;
     insert into thread_participants select ${hex("t", "t", 5)}, ${hex("u", "a", 5)}, 0 from tg
       union all select ${hex("t", "t", 5)}, ${hex("u", "b", 5)}, 1 from tg;
     insert into messages select ${hex("g", "n", 6)}, ${hex("t", "1 + (n % 10000)", 5)},
       ${hex("u", "case when n % 2 = 0 then a else b end", 5)}, 'Is it still available?',
       now() - random() * interval '90 days', case when random() < 0.6 then now() end
     from generate_series(1, 50000) n join tg on tg.t = 1 + (n % 10000)`,
  ],
  ["analyze", "analyze"],
]

for (const [label, text] of steps) {
  const start = performance.now()
  await sql.unsafe(text)
  process.stdout.write(
    `${label}: ${Math.round(performance.now() - start)} ms\n`
  )
}
process.exit(0)
