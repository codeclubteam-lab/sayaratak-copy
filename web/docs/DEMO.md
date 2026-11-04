# Demo script

A ten minute walk through Sayaratak for a client review. It runs in Arabic first, the default, and switches to English at the end. Button names below are the English labels; in Arabic they sit in the same place, mirrored.

Screenshots of every page are in `docs/screens/` (see the last section), so a reviewer can look ahead or check a page after the call.

## Before the call

1. Build and start the production server once, and keep it running for the whole demo. The mock keeps its data in memory, so a restart puts the seed data back.

   ```bash
   bun install --frozen-lockfile
   cp .env.example .env      # VITE_DEMO=true is the default
   bun run build
   bun run start             # http://localhost:3000
   ```

2. Open `http://localhost:3000/ar` in a private window, so no earlier session or cookie gets in the way.
3. Keep a second private window ready for the admin part.
4. Every demo account uses the password `Demo1234`. With `VITE_DEMO=true` the sign-in form has a folded "Demo accounts" list under the form: one button per role (Buyer, Dealership, Workshop, Mechanic, Admin) that signs in straight away. The new account is not in that list; type its email and the password.

| Account                                  | Email              | Used in       |
| ---------------------------------------- | ------------------ | ------------- |
| Individual, "Buyer" button (Omar Hassan) | `user@demo.sy`     | Steps 3 and 4 |
| New account, onboarding not done         | `new@demo.sy`      | Step 5        |
| Dealership (Al Nasr Motors)              | `dealer@demo.sy`   | Step 6        |
| Workshop (Al Amal Auto Care)             | `workshop@demo.sy` | Step 7        |
| Mechanic (Yousif Ibrahim)                | `mechanic@demo.sy` | Step 7        |
| Admin                                    | `admin@demo.sy`    | Step 8        |

To start a fresh run, sign in as admin, open Settings and press "Reset demo data", or restart the server.

## The walk

### 1. Home (0:00 to 1:00)

Open `/ar`.

- Point out the layout: Arabic, right to left, prices in SDG only.
- Type a make (for example "Toyota") in the search box on the banner and press Search. Come back with the browser's back button.
- Scroll to the categories: cars, trucks, motorcycles, tuk-tuks, spare parts, rentals, and the dealerships, workshops and mechanics directories. Press one category to show it opens a ready-made results page, then come back.
- Point out the Featured listings: these are paid promotions, the only place the amber color appears.

### 2. Search results (1:00 to 2:00)

Open `/ar/search`.

- Open the filters (a sheet on a phone, a side column on a computer). Set a city, a price range and a year range.
- Show the chips above the results: one per active filter. Press the × on one chip to drop that filter. The URL changes with every filter, so the page can be shared or bookmarked.
- Change the sort, then move to page 2 (24 listings a page, numbered pages).
- Press "Save search". As a visitor this opens the sign-in dialog; close it for now. Saving searches is shown after sign-in in step 4.

### 3. Listing detail (2:00 to 3:00)

Open any listing from the results, for example `/ar/listing/chevrolet-cruze-2014-single-owner-khartoum-l0000p`.

- Open the gallery and swipe or use the arrows. Photos are flat placeholder tiles until the real photos arrive (blocker B1).
- Show the specs and the seller panel.
- Press "Call" and "WhatsApp": both work for visitors, without signing in. WhatsApp opens with a ready message that names the listing.
- Press "Share" to show the share options.

### 4. Sign in from a gated action (3:00 to 3:30)

Still on the listing:

- Press the heart (save to favorites). As a visitor the sign-in dialog opens.
- Open "Demo accounts" and press "Buyer".
- The dialog closes and the heart is already filled: the action you started is finished for you after sign-in. The same happens for Message, Save search, Post a listing and reviews.
- Go back to the search page and press "Save search" again: it saves this time.
- Sign out from the account menu.

### 5. Onboarding as a new dealership (3:30 to 4:30)

- Open `/ar/auth/login`, type `new@demo.sy` and `Demo1234`, press "Log in". The site sends you to "How will you use Sayaratak?".
- Pick "Dealership". Fill only the required fields on each screen: your dealership, where to find you, opening hours (Saturday to Thursday open by default), then choose a plan.
- Pick the free plan and finish. You land on the new dealership dashboard.
- Mention that a paid plan goes to checkout with a manual Bankak transfer and a receipt upload, which an admin approves (step 8).
- Sign out.

### 6. Dealership dashboard (4:30 to 6:00)

Sign in with the "Dealership" demo button (`dealer@demo.sy`). You land on `/ar/dealer`.

- Inventory: the table of vehicles with status tabs (Active, Pending, Rejected, Sold or rented, Expired, Drafts), search, filters, "Export CSV", and a status menu on each row. Tick two rows to show the bulk actions. Press "Post a listing" to show the form, then go back.
- Analytics: listing views over time, contacts per day and the top listings.
- Promotions: press "Promote a listing": Featured for 3, 7 or 14 days, or Bump up to move a listing back to the top of results (once every 24 hours).
- Billing: the current plan and the other plans. Press "Upgrade to Pro" to open checkout: the Bankak account details and the receipt upload.
- Sign out.

### 7. Workshop and mechanic (6:00 to 8:00)

Sign in with the "Workshop" demo button (`/ar/workshop`).

- Services: the services with prices. "Add from templates" adds common ones fast; "Add service" adds your own.
- Photos and Profile: what shows on the public workshop page.
- Inquiries: messages from drivers.
- Verification: the workshop starts unverified; upload a document to send a request (the admin approves it in step 8).

Sign out and sign in with the "Mechanic" demo button (`/ar/mechanic`).

- Show the "Available for new work" switch on the overview: the public mechanic page shows it.
- Portfolio: photos of past work. "Add work" adds one; the order can be changed.
- Sign out.

### 8. Admin (8:00 to 9:30)

In the second private window, open `/ar/auth/login` and sign in with the "Admin" demo button (`/ar/admin`).

- Review queue (Moderation): open a pending listing, approve one, reject another with a reason.
- Payments: open a pending payment (the order number, for example SY-100000), look at the uploaded receipt, approve it. The plan or promotion starts for that account.
- Verifications: open a request (for example Kassala Motors, or the one sent in step 7), look at the document, approve it. The business gets its verified badge.
- Banners: photo banners with a placement and start and end days. Press "Turn off" on one, then "Turn on" again.
- Settings: listing rules, the Bankak account details shown at checkout, contact details, and "Reset demo data" under Demo tools.

### 9. English and data saver (9:30 to 10:00)

Back in the first window, open `/ar`.

- Switch the language to English in the header. The page turns to `/en`, left to right, same content.
- Turn on "Data saver" in the header (in the menu on a phone). Photos load at a smaller size, pages stop loading ahead when you point at a link, and heavy parts such as the map wait until you ask for them. It is meant for slow and costly mobile data. Turn it off again.

## Screenshots

`bun run shots` captures every public route family and every dashboard section, at 390 and 1280 px wide, in Arabic and English, into `docs/screens/390/` and `docs/screens/1280/`. File names are `<locale>-<route>.png`, for example `docs/screens/1280/en-dealer-promotions.png`. The script needs the production server on port 3100:

```bash
bun run build
PORT=3100 API_BASE_URL=http://localhost:3100 bun run start
bun run shots    # in a second terminal
```

The screenshots are not committed (`docs/screens/` is in `.gitignore`); run the script and zip the folder to send it.

The same run checks each rendered page against the visual rules (a card inside a card, more than one primary button, stray shadows or borders, banned type) and exits with an error if one breaks.

## Open client decisions

These do not block the demo. Each one runs on a default today; please answer them at the review.

| #   | Question                                                                           | Default in the demo                                |
| --- | ---------------------------------------------------------------------------------- | -------------------------------------------------- |
| 1   | Western digits (0-9) or Eastern Arabic digits on Arabic pages?                     | Western digits                                     |
| 2   | Which days make the business week for default opening hours?                       | Saturday to Thursday, Friday closed, editable      |
| 3   | Should individual sellers have a free listing limit, and how many?                 | 3 free listings, admin setting                     |
| 4   | How long does a listing stay live before it expires?                               | 30 days, admin setting                             |
| 5   | Does "truck purchases" mean a separate wanted-ads feature?                         | No, it is the buyer view of trucks for sale        |
| 6   | Should workshops and mechanics be able to post spare parts?                        | No, only individuals and dealerships post listings |
| 7   | Is browser web push wanted in the first version?                                   | No, in-app notifications only                      |
| 8   | Which countries are enabled at launch?                                             | Sudan only; the admin can add more                 |
| 9   | TikTok has no web share link. Is copying the link with a short hint acceptable?    | Yes, copy link plus a message                      |
| 10  | Is the Nile green and amber palette approved?                                      | Yes, until the client says otherwise               |
| 11  | Is a five-screen post wizard, with promotion offered after publishing, acceptable? | Yes                                                |

Still waiting on the client, with a stand-in in place: real photos (flat tiles now), the real Bankak account details (placeholder now), the production map tiles (public OpenStreetMap now) and final plan and promotion prices (placeholder SDG prices, editable by the admin).
