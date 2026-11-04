# Design

The look is a well-run dealership office: calm, legible, quick. Asphalt for text, Nile green for trust and action, road-marking amber for paid promotion only. Surfaces are a cool green-grey. Speed and clear feedback carry the feel; motion is short and rare.

All tokens live in `src/styles.css`. Restyle through tokens; never edit `src/components/ui` for looks.

## Screens

Arabic screenshots from the 14.3 walk, in `docs/screens/ar-walk/`. `bun run shots` makes fresh ones in both languages.

| Search | Listing | Post wizard |
|---|---|---|
| ![Search](screens/ar-walk/ar-search.png) | ![Listing](screens/ar-walk/ar-listing-chevrolet-cruze-2014-single-owner-khartoum-l0000p.png) | ![Post](screens/ar-walk/ar-post.png) |

| Onboarding | Dealer dashboard | Admin users |
|---|---|---|
| ![Onboarding](screens/ar-walk/ar-onboarding.png) | ![Dealer](screens/ar-walk/ar-dealer.png) | ![Admin](screens/ar-walk/ar-admin-users.png) |

## Color tokens

Light theme only. OKLCH is the source of truth; re-run `bun run contrast` after any change.

| Token | OKLCH | Use |
|---|---|---|
| `--background` | `0.966 0.004 150` | Page |
| `--card` | `1 0 0` | Cards, dialogs, sheets, sidebar, header |
| `--foreground` | `0.2 0.012 160` | Text |
| `--muted` | `0.952 0.005 150` | Inset blocks, hover rows, skeletons, quiet badge fill, `secondary` buttons |
| `--muted-foreground` | `0.46 0.012 160` | Secondary text |
| `--border` | `0.915 0.005 150` | Row dividers, sticky-layer line |
| `--input` | `0.64 0.012 160` | Form control border, unchecked switch track |
| `--field` | `--card` on the page, `--muted` inside a card, dialog, sheet or popover | Form control fill, so a field is never white on white |
| `--primary` / `--ring` | `0.43 0.085 163` | Main actions, links, focus |
| `--primary-foreground` | `0.985 0.003 150` | Text on primary and destructive |
| `--accent` / `--accent-foreground` | `0.93 0.028 163` / `0.32 0.07 163` | Selected nav item, chip, row |
| `--signal` / `--signal-foreground` | `0.82 0.16 82` / `0.26 0.05 80` | Paid promotion badges and Promote. Nothing else |
| `--deep` / `--deep-foreground` / `--deep-accent` | `0.27 0.05 163` / `0.99 0.004 150` / `0.8 0.09 160` | Dark green banner and hero slide surfaces |
| `--success` | `0.5 0.13 150` | Available, approved |
| `--warning` | `0.48 0.09 65` | Reserved, pending review |
| `--destructive` | `0.53 0.2 27` | Errors, delete, rejected |
| `--chart-1` to `--chart-5` | primary, signal, `0.55 0.02 170`, `0.55 0.07 200`, `0.5 0.1 350` | Charts. Every series is also labeled |

Status badges: 12 percent tint of the status color as fill, solid color as text, no border, no icon. Sold and Rented use the muted fill. Verified uses primary. A card shows the Featured badge, solid signal, while a Featured promotion runs. A bump shows no badge.

## Type

IBM Plex Sans and IBM Plex Sans Arabic, self-hosted (`@fontsource`), weights 400, 500, 600 only. Headings 600, labels 500, body 400, prices 600. Arabic sits one step larger and taller than English at the same role.

| Role (utility) | English size / line | Arabic size / line |
|---|---|---|
| `text-caption` (captions, badges) | 12 / 16 | 13 / 20 |
| `text-ui` (buttons, inputs, cells) | 14 / 20 | 15 / 24 |
| `text-body` | 16 / 26 | 17 / 28 |
| `text-lead` | 18 / 28 | 19 / 30 |
| `text-title` (section) | 20 / 28 | 21 / 30 |
| `text-page` | 24 / 32 | 25 / 36 |
| `text-hero` | 32 / 40 | 33 / 46 |

- Prices and table numbers use `tabular-nums`. A price is the amount, then the unit (`SDG`, `جنيه`) at caption size in muted text, then the rent period if any. Cards 20 / 28, detail 28 / 36, tables 14 / 20.
- No uppercase, italic or letter-spacing: spacing breaks Arabic joining.
- Titles `text-wrap: balance`, body `text-wrap: pretty`, reading width at most 70 characters.
- `cn()` treats type roles as text colors. Never pass a role and a text color to one `cn()` call (`cn("text-ui", "text-muted-foreground")` drops `text-ui`); put them in one literal string or on separate elements.

## Spacing and layout

| Token | Value |
|---|---|
| Spacing | 4, 8, 12, 16, 20, 24, 32, 48 only. Section gap 48 desktop, 32 mobile |
| Breakpoints | `sm` 640, `md` 768, `lg` 1024, `xl` 1280, `2xl` 1536 |
| Public container | max 1200, side padding 16 below `md`, 24 from `md`. Header full width |
| Dashboard content | max 1440, padding 16 / 24 / 32. Sidebar 248 (64 collapsed, sheet below `lg`), topbar 56 |
| Card padding | 20 desktop, 16 mobile |
| Radius | controls 8, cards and dialogs 12, images 8, chips and badges full |
| Control height (`--control-h`) | 44 below `md`, 36 from `md`. Hero search 48 |
| Header | 64 desktop, 56 mobile; mobile tab bar 56 plus safe area |
| z-index | sticky 30, progress bar 40, popover 50, dialog and sheet 60, toast 70 |
| Images | 4:3 cards and gallery, 3:1 covers (2:1 mobile), 1:1 logos and avatars; placeholder color until loaded |
| Icons | lucide-react, stroke 1.5; 16 in small buttons, 20 default |

## Components

- **Surfaces.** Page, card, inset. A card never sits in a card. Cards have no border and no shadow. Borders only on form controls, table row dividers, settings separators and the line under a sticky layer once content scrolls under it. The only shadow is on floating layers (popover, menu, select, dialog, sheet, toast).
- **Buttons.** `default` (one per view), `secondary`, `ghost`, `destructive`, `link`, `signal` (Promote only). `outline` is still used in app code by owner decision. A section's Save is `secondary` until its form is dirty. Navigation links use `buttonVariants`, never a `Link` inside a `Button`. Base UI uses `render`, not `asChild`.
- **Form controls.** `--field` fill, 1 px `--input` border, radius 8. Focus: ring plus primary border. Error: destructive border and the message under the field. 16 px text below `md` so iOS does not zoom.
- **Required marks.** A form marks its minority: "(Optional)" by default, asterisks with `<FieldMarks value="required">` when optional fields are the majority.
- **Remove.** Always `RemoveButton`, which confirms first. The undo toast comes after the confirm, not instead of it.
- **Table.** No outer border, row dividers, row height 48, header 12 px muted, hover muted at 50 percent, selected row accent.
- **Tabs.** Text with a 2 px primary underline, no pill.
- **Skeletons.** Static muted blocks at the final size, after 150 ms, kept at least 300 ms. No shimmer or pulse.
- **Toasts.** Bottom end, one line, icon only for errors, at most three, 4 s (6 s for errors and toasts with an action).
- **Empty and error states.** One written sentence and one action, no illustration.
- **Charts.** In a `dir="ltr"` box, labels still translated.

## Motion

| Token | Value | Use |
|---|---|---|
| `--ease-standard` | `cubic-bezier(0.2, 0, 0, 1)` | Entering and changing |
| `--ease-exit` | `cubic-bezier(0.4, 0, 1, 1)` | Layers closing |
| `--dur-press` | 80 ms | Pressed state (`scale(0.97)`) |
| `--dur-fast` | 120 ms | Colors, hover, layer exit |
| `--dur-base` | 160 ms | Popover, dialog, tooltip, image fade, route fade |
| `--dur-sheet` | 220 ms | Sheet enter |

Only `opacity`, `transform` and colors move. Every press shows a response within 100 ms. Results that are reloading stay and dim to 60 percent after 150 ms. Under reduced motion every duration is 0; data saver also turns off view transitions.

## Do and do not

| Do | Do not |
|---|---|
| Make the price the largest thing on a card | Gradients, glass, blur, illustrations, stock hero photos |
| Use one green main action per screen | Use amber for anything but paid promotion |
| Separate with tone (page vs card) | Borders or shadows on cards |
| Use logical CSS (`ms-`, `pe-`, `start-`, `text-start`) | `ml-`, `pr-`, `left-`, `text-right`, `rounded-l` outside `components/ui` |
| Wrap phones, plates and model names in `<bdi>` or `dir="ltr"` | Let mixed-direction text reorder itself |
| Keep old content on screen while new content loads | Hover lifts, entrance animations, count-ups, shaking fields, `transition-all` |
| Write short sentences, verbs on buttons, nouns as titles | Exclamation marks, "please", "oops", apologies |
| Use plain everyday Modern Standard Arabic | Formal or legal register outside the legal pages |
| Confirm every Remove | A remove that acts on the first press |

`bun run audit:design` checks the rules a script can see; its allowlist records the accepted exceptions and why.

## Contrast

`bun run contrast` (`scripts/contrast.ts`) reads the OKLCH tokens in `src/styles.css`, converts them to 8-bit sRGB and prints the WCAG 2.2 ratio of every pair below. It fails under 4.5 for text and under 3 for UI parts. Re-run it after any token change.

```
ok    16.3  (min 4.5)  foreground on background
ok    18.0  (min 4.5)  foreground on card
ok     6.4  (min 4.5)  muted-foreground on background
ok     7.1  (min 4.5)  muted-foreground on card
ok     6.2  (min 4.5)  muted-foreground on muted
ok     7.5  (min 4.5)  primary-foreground on primary
ok     7.8  (min 4.5)  primary on card
ok     7.0  (min 4.5)  primary on background
ok    10.0  (min 4.5)  accent-foreground on accent
ok     8.8  (min 4.5)  signal-foreground on signal
ok     5.6  (min 4.5)  primary-foreground on destructive
ok     5.9  (min 4.5)  destructive on card
ok     4.8  (min 4.5)  badge success on its tint
ok     5.6  (min 4.5)  badge warning on its tint
ok     4.8  (min 4.5)  badge destructive on its tint
ok     6.4  (min 4.5)  badge primary on its tint
ok     3.4  (min 3)  input border on card
ok     3.0  (min 3)  input border on background
ok     7.8  (min 3)  ring on card
ok     7.0  (min 3)  ring on background
```

The badge pairs use a 12 percent tint of the status color over the card.

## Focus

Every control shows a 2 px focus outline with a 2 px offset in `--ring` (same green as primary, 7.8 on the card, 7.0 on the page). Text inputs and selects show a ring (box shadow) instead. Checked by tabbing through home, search, listing, sign up and the post wizard: every control kind showed one of the two.
