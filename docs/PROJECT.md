# Family Christmas List — Project Spec

**Owner:** Jeremy (product owner, makes all decisions)
**Started:** Nov 20, 2026
**Mockups:** https://claude.ai/artifact/KKhxFT46gKUriKn9K8s3mB
**Live at:** https://schillig-gift-list.vercel.app (Vercel, deploys on every push to `main`; the original christmas-list-alpha.vercel.app redirects here)

This file records decisions with the reasons attached, the same way the meal planner's
`docs/PROJECT.md` does. The original brief is `christmas-list-build-plan.md` and
`christmas-list-conversation-summary.md` (in Downloads); everything settled since is below.

---

## The problem

Ellie makes a Google Slides deck of ideas, Jeremy retypes all four lists into a Google
Sheet, and relatives mark items purchased (yes/no, no name). It works, but it means
entering everything twice, there's no surprise protection, and nobody knows who bought what.

## Who uses it

- **List owners:** Jeremy, Jessica, Austin, Ellie
- **Buyers:** extended family plus the four owners
- **Admins:** Jeremy and Jessica

## The one rule above all others

**A list owner never learns the purchase status of their own list,** directly or by
inference. This is enforced **on the server**, not just hidden in the UI: the API never
sends status for a person's own list to that person, so a curious kid with browser dev
tools gets nothing. It also shapes other decisions: an owner is never blocked from
editing or deleting a bought item, because the block itself would give the secret away.

---

## Look

Style **B (Evergreen layout)** in the **Plum & Rose Gold** palette:

| Token | Value | Use |
|---|---|---|
| primary | `#4E2A4F` | headings, primary buttons |
| accent | `#C08A7A` | hairlines, monogram rings |
| accentText | `#93594A` | small uppercase labels (passes 4.5:1 on bg) |
| accentLight | `#EBC3B6` | accent on the primary color |
| bg | `#FBF7F6` | page |
| soft | `#F3E9E7` | taken rows, note blocks |
| border | `#EBDDDA` | card borders |
| status green | `#2E6B47` | "You got this", "1 bought so far" |

Fraunces (serif) for names and titles, Inter for everything else. White cards on the
blush page, floating pill tab bar, bottom sheets for item detail. iPhone first; an
add-to-home-screen icon is nice to have.

## Sign-in

- Link → pick your name → PIN. The phone remembers the person afterward.
- Admins add each person with a **starter PIN** and tell them what it is. On first
  sign-in the person can keep it or choose their own. (A starter PIN stops anyone from
  claiming an unused name before its owner signs in.)
- Forgotten PIN: an admin resets it back to a starter PIN.
- Only Jeremy and Jessica can add people.

## Items

Fields: name, link, size, color, notes, price, priority, cash option (with "what it's
for"), "more than one is fine", **photo**.

- **Photo:** pulled automatically from the link when possible. Some sites (Amazon
  especially) block this, so those items show a tidy placeholder. The owner can replace
  the photo themselves.
- **Price:** filled in from the link too (store product data), unless one was typed.
  It's a snapshot from when the link was added, not live: no Black Friday updates.
  Amazon, Target, Free People and Hollister block this, so those are typed in.
- **Store-only requests** go on separate lines, each with its own size.
- **Who can edit:** an owner edits their own list. Jeremy and Jessica can also edit
  Austin's and Ellie's lists.

## Buying

- "I got this" records the signed-in buyer. Others see "Taken"; the buyer sees "You got
  this" and can undo. "More than one is fine" items stay open and show "N bought so far".
- **Parents' note:** Jeremy or Jessica can put a red note on an idea on a kid's list,
  e.g. "Pre-purchased by Jeremy & Jessica. Reach out to them if you'd like to give it."
  Everyone but the kid sees it (own table, never fetched for the owner). On that item
  "I got this" reads "I notified Jeremy & Jessica", and going in together is hidden.

### Going in together (group gifts)

- Anyone can mark an open item "Willing to split" and enter how much they'll put in.
  That person is the default purchaser.
- Others see "Going in together", a progress bar and the amount still needed. They
  join by entering their own amount, since a gift may take 2–3 people.
- Any member can tap **"I'll order it"** to take over as purchaser. Paying each other
  back happens outside the app.
- Anyone can remove their name before it's ordered, for example if nobody else joins and
  they'd rather buy something different. If the last person leaves, the item goes back to open.
- Members get an in-app note when someone joins or leaves. Other buyers see the item as
  "Taken" once it's ordered. The owner never sees any of it.

## Flags (an owner changes a bought item)

- **In the app only:** a badge on the buyer's My Gifts tab and on the Admin tab.
- **Who sees it:** the buyer, plus any admin who isn't that list's owner. The owner never does.
- **Only changes that matter raise a flag:** size, color, name, link, or deleting the item.
  Notes, price, priority and the "more than one" checkbox change quietly.
- **Deleting a bought item** removes it from the owner's view, but the buyer and admins
  keep seeing it as "Removed by Ellie: you already bought this."
- **The flag shows what changed:** "Color: Black → Navy".

## Seasons (year to year)

- When a new season starts, bought items move to that year's history. Unbought items
  carry forward onto the new list.
- Each carried-over list shows **"Not reviewed for 2027 yet"** to buyers, and **"I got
  this" is turned off** until the owner taps "My list is up to date". Carried items get a
  small "From last year" tag.

## Screens

1. **Home:** a card per list owner with the number of open items. Your own card shows no count.
2. **Person's list:** top picks first, taken items grayed at the bottom.
3. **My Gifts:** everything you've claimed or joined, as a shopping checklist, plus flags.
4. **My List** (owners): add and edit items, with no status anywhere.
5. **Admin** (Jeremy and Jessica): who bought what on every list except your own, plus flags
   and managing people and PINs.

---

## Stack

The same setup as the meal planner, as a **separate** project: Next.js + React +
TypeScript + Tailwind, Supabase (Postgres), hosted on Vercel, with every push to `main`
deploying.

Unlike the meal planner, there's no shared household login. Relatives sign in with
name + PIN. PINs are hashed in the database, and every read and write goes through
server routes that apply the surprise rule. The browser never talks to the database
directly.

**Region:** the Supabase database is in Oregon (us-west-2), so `vercel.json` runs the
app's code in Portland (`pdx1`). Vercel's default is Washington DC (`iad1`), which put
a cross-country trip on each of the 10–15 database calls behind a tap.

## Working agreement

- One step at a time, with the next step restated at each stage.
- Jeremy reviews every change before it's committed and pushed.
- UI is rendered and looked at before it ships. Screens behind sign-in get dev-only
  bench pages with fake data, as in the meal planner.

## Build steps

1. **Project setup:** create the Next.js app here, a new GitHub repo, and a new Supabase
   project. Jeremy creates the Supabase project and the repo; Claude does the rest.
2. **Database:** people, items, claims, splits, flags and seasons tables, plus seed data
   for the four owners and a couple of test buyers.
3. **Sign-in:** name picker, PIN pad, remembered device, starter-PIN change.
4. **Home + person's list + item sheet + "I got this"**, with the surprise rule enforced
   server-side and covered by tests.
5. **My List** (add and edit, photo from link and photo replace).
6. **My Gifts + going in together.**
7. **Admin:** who bought what, flags, managing people and PINs.
8. **Seasons:** carry-over and the review gate.
9. **Load Ellie's list from her Google Slides,** then a family test run and deploy.

## Open

- Nothing blocking. Ellie's Slides deck for step 9: https://docs.google.com/presentation/d/1aTeFo0wPfZfQlFHDfHd8yydjRdGFsSxm43639Fav9gA/edit

---

## Build log

**Step 1, project setup (Nov 20).** Next.js 16.3.1 app created with the meal planner's
config: TypeScript, Tailwind 4, ESLint, and the test hook in `tests/`. The palette is in
`app/globals.css` as Tailwind colors (`bg-plum`, `text-rose-text`…), and the fonts come
from `next/font` (Fraunces + Inter). A placeholder home page shows the four owner cards
in the new look. It builds clean, lint is clean, and it was checked at iPhone width
(375 px): no sideways scroll, and the cards sit in an even 2×2 grid.
`npm run dev` serves on port 3200, so it never collides with the meal planner. In the
preview pane it's the `christmas-list` entry in the shared `.claude/launch.json`.
`git init` is done; there are no commits yet.

**Planned for step 2, keys.** The meal planner deliberately has no service-role key,
because every phone shares one household login and Supabase's own row rules do the
guarding. This app can't work that way. The surprise rule depends on *who* is asking,
and relatives sign in with a PIN rather than a Supabase account. So the plan is: the
database has row-level security switched on with **no** public policies (the browser
can read nothing), and only server routes talk to it, using the service-role key. That
key lives only in `.env.local` and Vercel, and is never prefixed `NEXT_PUBLIC_`.

**Step 2, database (Nov 20).** `supabase/01-schema.sql` defines these tables: people,
sessions, pin_attempts, seasons, list_reviews, items, claims, splits, split_members and
notifications. Row-level security is on for all of them with no policies, as planned.
The decisions worth knowing:
- Items are never hard-deleted; `deleted_at` is set instead, so a bought item stays
  visible to its buyer and the admins.
- Notifications are written one row per recipient at the moment of the event, and
  the owner is never a recipient.
- PINs are scrypt-hashed (`lib/pin.ts`, tested). Sessions store only a hash of the
  cookie token. Wrong PIN guesses are counted in `pin_attempts` for a lockout.
- `lib/db.ts` is marked `server-only`, so the build fails if a page ever imports it.

`npm run db:check` checks that the schema is in place. `npm run db:seed` adds the four
owners plus Test Grandma and Test Grandpa, and writes their starter PINs to
`scripts/starter-pins.local.json` (git-ignored). Found while testing: a Supabase
`head: true` count on a missing table returns no error and a null count, so the check
uses a real request instead.
Also found on the first real run: new Supabase projects no longer grant `service_role`
access to new tables, so every read failed with "permission denied". The schema now
grants it explicitly. And `package.json` now says `"type": "module"`, which silences
Node's warning about guessing the module type of `lib/pin.ts`.

**Step 3, sign-in (Nov 20).**
- `/sign-in` shows the four owners as cards and everyone else under "Family". Pick a
  name, then type a PIN on the keypad (`components/PinPad.tsx`), which submits by
  itself on the fourth digit.
- A wrong PIN shakes the dots and says how many tries are left.
- `lib/lockout.ts` (tested): every 5 misses in a row lock that name. The first lock
  is 5 minutes, and each one after doubles, up to a day. The lock is checked *before*
  the PIN is looked at, so a locked name can't be guessed at all.
- A starter PIN leads to `/welcome`: keep it, or choose your own (entered twice).
- `lib/session.ts`: a 400-day httpOnly cookie, whose token is stored as an HMAC keyed
  with SESSION_SECRET. Sign out revokes the session.
- All of it is server functions in `app/actions/auth.ts`. The home page is still a
  placeholder, now with "Welcome back, <name>" and a sign-out link.

Checked in the preview at 375 px: sign-in, a wrong PIN, the welcome screen, choosing a
PIN (including a mismatch), staying signed in after a reload, the cookie not being
visible to page scripts, sign out, and the lockout and its expiry. Three bugs were
found and fixed along the way:
- Digits pressed faster than React re-rendered overwrote each other, so the pad
  never reached four. The digits now also live in a ref.
- "Those didn't match" vanished with the pad that would have shown it.
- Four filled dots stayed under the "Too many tries" message.

**Step 4, Home, lists and "I got this" (Nov 20).**
- **The surprise rule** is `loadList` in `lib/listview.ts`. When the viewer owns the
  list, it returns before claims or splits are fetched, and the items it returns
  have no status field at all. Tests prove this by counting database calls and by
  searching the owner's view for "taken", "bought" and the buyer's name. `homeFor`
  only fetches purchases for *other people's* items, and your own card shows
  "Your list · N ideas" rather than an open count.
- **Checked live as well.** Test Grandpa was briefly made an owner with one item
  Test Grandma had bought. Neither his list page nor the raw data the app downloads
  for it contained "Taken", a status, "bought" or "Test Grandma". The change was undone
  afterwards, and that was checked too.
- **Statuses:** open, mine, taken, and together (a group gift, filled in at step 6).
  "More than one is fine" items stay open and count purchases: "You got one · 1
  bought so far".
- **"I got this" and Undo** (`app/actions/items.ts`): every refusal, including an
  owner trying to claim their own item, gets the same message, so a refusal never
  hints at whether something was bought. If two people tap the same item at the same
  moment, both claims can land. That's acceptable for a family; the admin view will
  show both names.
- **Sample items:** `npm run db:sample` adds 12 (records their ids in
  `scripts/sample-items.local.json`), and `npm run db:sample -- --remove` removes
  exactly those.
- **Found in testing:** the item sheet rendered completely unstyled in the dev
  preview, while the production build was fine. Tailwind looks for class names
  relative to the folder the dev server starts in, and the preview starts it from
  the parent folder. `globals.css` now names the project folder with
  `source("../")`. Also, bulk inserts send a missing column as null rather than its
  default, so the sample rows spell out every field.

**Step 5, My List (Nov 20).**
- **Signed-in screens** now live in the `app/(app)/` route group, whose layout adds
  the floating tab bar (`components/TabBar.tsx`). Lists for everyone, plus My List
  for owners; My Gifts and Admin arrive in steps 6 and 7.
- **`/my-list`** lets you add, edit and remove your ideas (`components/ItemEditor.tsx`).
  Jeremy and Jessica get Mine / Austin / Ellie chips (`?for=<id>`). `lib/permissions.ts`
  (tested) says parents can edit the kids' lists but not each other's. The edit
  screen never fetches purchases.
- **Photos:**
  - Saving with a link fetches the store page, reads JSON-LD or og:image
    (`lib/linkpreview.ts`, tested), and copies the image into the public
    `item-photos` Supabase bucket (`npm run db:storage` creates it). A pasted link
    also suggests a name.
  - The server refuses private addresses at every redirect hop, after DNS lookup
    too, with a 6 s timeout and size caps.
  - The owner can replace a photo; it's shrunk in the browser to 1600 px JPEG
    (`lib/shrink.ts`) and marked `photo_source = 'upload'`, so a later link change
    won't overwrite it. Replaced photos are deleted from storage.
- **Change alerts:** editing name, size, color, link or "what it's for" on a bought
  item, or removing it, writes notifications to its buyers and the admins, never to
  the owner or the person who made the change (`changeRecipients`, tested). Removing
  an idea always keeps the row (`deleted_at`), and the editor gets the same plain
  confirmation either way.

Checked in the preview at 375 px, with Test Grandpa temporarily made an owner and
admin and every change undone and checked afterwards:
- Add an idea with a link: the name filled in from the page.
- Edit a link: a photo was pulled and copied into the bucket.
- Replace a photo: a 2400 px image was stored as a 1600 px, 19 KB JPEG, and the old
  file was deleted.
- On Ellie's list, a color change on the bought hoodie alerted Test Grandma, Jeremy
  and Jessica with "Gray → Navy", and nobody else. Removing the bought shorts did
  the same, and the row was kept.
- A plain buyer gets no My List tab, and `/my-list` sends them home.

Found:
- Lululemon answers automated requests with 403, and REI serves its page but
  returns 503 for the image. Those stores fall back to "no photo, add your own",
  which is the case the replace button exists for.
- Moving folders while `next dev` runs fails on Windows (the folder is locked). Stop
  the preview first, and clear `.next/dev` if the build then complains about the
  old paths.

**Step 6, My Gifts and going in together (Nov 20).**
- **Going in together** (`app/actions/splits.ts`, `components/GroupGift.tsx`):
  - "Go in together with others instead" on an open item starts a group gift. The
    starter is the first member and the purchaser.
  - Others see a "Going in together" section on the list (its own section, between
    open and taken, since they can still join), with a progress bar against the
    price and each member's name and share. They join with their own amount and can
    change their share.
  - Any member can tap "I'll order it instead". The purchaser taps "I ordered it" (or
    "Not ordered yet after all"), and once it's ordered, non-members see "Taken".
  - Leaving: when the purchaser leaves, ordering passes to whoever joined earliest,
    and when the last person leaves, the split is deleted and the item reopens
    (`lib/splits.ts`, tested).
  - Notes go to the other members only: joined, left, and who's ordering now.
  - Not offered on "more than one is fine" items, which anyone can just buy.
- **My Gifts** (`/my-gifts`, `lib/mygifts.ts`):
  - Every gift you're buying, alone or together, grouped "For Ellie", "For Austin"…
  - Each gift shows its status: "You got this" with Undo, or "Going in together ·
    your share $75 · Grandpa is ordering it".
  - A gift changed after you picked it shows the changes. One the owner removed is
    crossed out with "Removed by Ellie".
  - An Updates list shows the notes, marked New until seen; opening the tab marks
    them read, and the My Gifts tab shows an unread badge.
  - Only notes about gifts you're in appear here. An admin's alerts about items they
    didn't buy wait for the Admin tab (step 7).
- **Home:** the "Your shopping" card now links to My Gifts and counts group gifts too.
- **The surprise rule:** split data is only fetched on the buyer path, after
  `loadList` has already returned for owners. A new test confirms an owner's view
  carries no "together", member names or amounts.

Checked in the preview at 375 px with both test buyers, on Austin's headphones:
- Grandpa started a $100 group gift.
- Grandma saw "Going in together · 1 person in · $149 to go", joined with $75 ($74 to
  go), took over ordering, and marked it ordered. The list then read 1 taken.
- Grandpa got "joined with $75" and "will order it now" notes. Austin got nothing.
- With two alerts inserted for Grandma (a color change and a removal), My Gifts showed
  the tab badge "2 new", both updates, the change on the hoodie and the crossed-out
  shorts, and the badge cleared after viewing.
- Grandma un-ordered and left: ordering went back to Grandpa and the join form
  returned.

All step 6 test data was removed afterwards and checked: no splits, members or
notifications remain, and the shorts are restored.

**Step 7, Admin (Nov 20).** `/admin`, for Jeremy and Jessica only. Anyone else is
redirected home, and every admin action re-checks `is_admin`.
- **Purchases** (`lib/admin.ts`):
  - Every list except your own (`adminVisibleLists`, tested). Your own list is never
    queried.
  - Each list shows "N bought · N open", then each bought item with who bought it:
    several names on a "more than one" item, or "Together: Grandma $100, Grandpa $75
    · Grandma will order it / ordered it".
  - Items removed after being bought stay listed, tagged "removed from list", since
    they still need wrapping. Unbought items sit under a collapsed "N not bought
    yet".
  - "Changed after buying" lists the change and removal alerts with who bought each
    item. They're marked New until seen, and the Admin tab shows an unread badge.
- **People & PINs** (`app/actions/admin.ts`):
  - **Add a family member** (name only) creates a buyer with a random starter PIN,
    shown once in large digits to pass on.
  - **Reset PIN** gives a new starter PIN, signs that person out on every phone and
    clears their wrong-guess count. It isn't offered on your own row.
  - **Remove** works for relatives only, never list owners. It confirms first,
    saying how many gifts they'd marked; those go back to open, and any group gift
    they were ordering passes to the next member.
- **Tab bar:** now up to four tabs (Lists, My Gifts, My List, Admin), each an icon
  over a small label so all four fit at iPhone width.

Checked in the preview at 375 px, with Test Grandpa temporarily an owner and admin,
plus a group gift on Austin's headphones, an item on Grandpa's *own* list bought by
Grandma, and one alert:
- Admin showed Jeremy, Jessica, Austin and Ellie with the right buyers, the group
  gift, and the alert with "Bought by Test Grandma". Grandpa's own list and that
  item appeared nowhere, in the page or its raw data. The badge cleared after
  viewing.
- Adding "Test Aunt" showed her PIN. Resetting Test Grandma left her with a starter
  PIN, no live sessions and no wrong guesses. Removing Test Aunt (who had no gifts)
  worked after the confirmation.
- As a non-admin, Test Grandma had no Admin tab, and `/admin` sent her home.

Afterwards everything was undone and checked: Grandma's PIN is back to the value in
`scripts/starter-pins.local.json`, Grandpa is a plain buyer again, and the test item,
split and alerts are gone.

**Step 8, seasons (Nov 20).**
- **Starting a season is one database step:** `supabase/02-seasons.sql` (run Nov 20)
  adds `start_season(new_year)` and `undo_season(year)`, callable only with the
  server key. Starting either completes entirely or not at all, so a half-moved
  season can't happen. If 01-schema is ever re-run, re-run 02 after it.
- **What moves** (`lib/seasons.ts`, tested; the SQL mirrors it, and the TS copy powers
  the preview):
  - Ideas nobody bought or went in on move to the new year, with `carried_from_year`
    set ("From last year").
  - Bought ideas and group gifts stay in last year's history.
  - A bought "more than one is fine" idea stays in history *and* gets a fresh copy
    in the new year (`carried_from_item` points back at it).
  - Removed ideas stay behind.
- **Undo** is offered only while nothing has happened in the new season: no new ideas
  and no purchases. It deletes the copies, moves carried ideas back, and drops the
  season and its reviews. One known limit: an idea that had already carried once
  before loses its earlier "carried" year on undo.
- **Admin › Season:** shows the current season and a preview ("11 ideas come forward ·
  2 stay in 2026's history"), "Start Christmas 2027" with a confirmation, and "Undo
  starting 2027" when allowed. Admin › Purchases gets year buttons; a past year is
  read-only history ("Looking back at Christmas 2026").
- **Review gate:** a list with carried ideas and no `list_reviews` row for this season
  shows "Not reviewed for 2027 yet" on its Home card and a notice on the list, and
  `claimable` refuses "I got this" and group gifts. In My List the owner, or a parent
  for a kid's list, sees "Is this list still right for 2027?" and "My list is up to
  date". Carried ideas are tagged "From last year" everywhere.
- **Photos:** because a copied idea shares its photo file with last year's, a stored
  photo is now only deleted once no item points at it.

Checked in the preview at 375 px, twice, with Test Grandpa temporarily an admin:
- **Start:** the preview said 11 forward / 2 stay, and starting did exactly that (10
  moved, 1 copied).
- **Review gate:** Home showed "Not reviewed for 2027 yet" on every list. Ellie's list
  had the notice, the tags and no buttons; the bought hoodie stayed in 2026 and the
  shorts came forward fresh. Marking her list up to date from My List brought the
  buttons back.
- **History:** Admin's 2026 view showed Test Grandma's two purchases.
- **Undo:** first run from the database, then by tapping the real "Undo 2027" button.
  Both times every idea and purchase afterwards was identical to a snapshot taken
  before starting.

Small fix found: a past year said "Nothing bought yet", and now says "Nothing was
bought."

**Step 9, Ellie's list (Nov 20).**
- **Sample items removed** (`npm run db:sample -- --remove`); the two test purchases
  went with them.
- **Reading her deck:** "Ellie's Christmas List 2026" was read with the Google Slides
  connector. Her store links are attached to the *pictures*, not the text (35
  links), and her slides run most-wanted first.
- **The draft** (`scripts/ellie-list.local.json`, git-ignored) has 46 items, one per
  link, as the spec says for store-only requests:
  - Product names come from the slides or the store pages.
  - Sizes come from the slides, checked against the size selected in each Shopify
    link (all matched). The Art on Wheels hoodie's link supplied the missing Black /
    S. Jeremy confirmed S for the Amazon tank tops from the links.
  - "GRAGAE" was meant to be "Garage".
  - Top picks are what she marked with "!": the monkey, the Hotty Hot shorts, Alo,
    and the Scuffers, PacSun and Wings hoodies. The monkey and the cheese wheel
    stay, as written.
- **Loading:** `npm run db:import -- Ellie <draft> <photos>` (`scripts/import-list.ts`)
  loads a draft in order, with her slide pictures copied in as photos. They're marked
  `upload` so a link change never replaces them. `-- --remove Ellie` undoes it
  exactly.
  - 43 of 46 items have photos. The TV and Six Flags slides have no picture, and the
    Scuba half-zip shares the shorts' slide picture.
  - Two full-size PNGs were over the 5 MB limit, so the script now asks Google for
    1200 px.
  - The two Lululemon items link to lululemon.com's homepage, because that's all her
    slide links to.
- **Checked** at 375 px as a buyer: 46 open, top picks first, all 43 photos load, no
  sideways scroll, and the item sheet shows the photo.

**Step 9, live on Vercel (Nov 20).** Jeremy imported the repo into Vercel with the
three settings from `.env.local`. Checked at 375 px on https://christmas-list-alpha.vercel.app:
- Sign-in works, and the session cookie isn't readable by page scripts.
- Ellie's 46 ideas show with all 43 photos and no sideways scroll.
- "I got this" and Undo both save, so the server key works from Vercel. The test
  claim was undone, and 0 purchases remain.

**One shared starter PIN (Nov 20, Jeremy's decision).**
- Everyone starts on **1111**: new relatives, people whose PIN was reset, and (as of
  today) all four owners. That lets the invitation be a single email.
- To keep a shared PIN safe, it works only once. Signing in with it goes to "Choose
  your PIN" with no keep option, every signed-in page redirects there while
  `pin_is_starter` is true, and 1111 can't be chosen as anyone's own PIN
  (`isChoosablePin`, tested). The welcome screen has "Not <name>? Go back" for
  anyone who tapped the wrong name.
- The four owners should sign in once before the link goes out. Until then anyone
  could claim their names, including a kid signing in as a parent and seeing
  purchases in Admin.
- Checked in the preview: a 1111 user is redirected from /, /my-gifts, /list, /admin
  and /my-list. Choosing 1111 is refused. After choosing a real PIN, 1111 no longer
  signs that person in.
- Test Grandma and Test Grandpa removed (no purchases). The people are now Jeremy,
  Jessica, Austin and Ellie.

### Parents' note and prices (Nov 20)

- Asked for after launch: Jeremy and Jessica already bought Ellie's Six Flags pass on
  sale, and parents want prices to shop by budget.
- `supabase/03-parent-notes.sql` (run): `parent_notes` table, same no-public-access
  model. `loadList` fetches it only for buyers, next to claims; tested.
- Prices: `parsePreview` reads JSON-LD offers (variant in the link wins, USD only,
  ProductGroup / PacSun "variants") and the price meta tags. `npm run db:prices --
  <Name> [--save]` fills blanks on an existing list: 20 of Ellie's 39 linked ideas.
- Checked in the preview at 375px with a temporary admin and buyer (both removed): note
  add/save, red note on card and sheet, "I notified…" claim and undo, and a pasted
  Tweezerman link filling "Classic Lash Curler" and $19. The live Six Flags note is
  set as Jeremy.
