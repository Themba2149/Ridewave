# RideWave

E-hailing platform for South Africa (Johannesburg demo, ZAR). **Status: Phase 7 (Integrations) complete.**
Testing hardening, documentation and the production checklist arrive in Phases 8-9.

## Prerequisites (Windows 10/11)
1. Node.js 20.11+ LTS (https://nodejs.org). Verify: `node -v`
2. Visual Studio Code, with the recommended extensions when prompted.

## Setup (PowerShell, from the project folder)
```powershell
npm install
npm run setup        # creates .env with a generated SESSION_SECRET, generates Prisma client, creates SQLite DB
npm run db:seed      # ride categories + demonstration fare configuration
npm run dev          # API on http://localhost:4000, web on http://localhost:5173
```
Health check: http://localhost:4000/api/v1/health

## Useful commands
| Command | Purpose |
|---|---|
| `npm run check:env` | Verify Node version, .env and dependencies |
| `npm test` | API and web unit tests |
| `npm run typecheck` / `npm run lint` | Static checks |
| `npm run build` | Production builds |
| `npm run db:reset` | **Deletes all local data** after you type RESET |

## Troubleshooting
- **Invalid environment configuration** on start: run `npm run setup` or copy `.env.example` to `.env` and set `SESSION_SECRET` (32+ chars).
- **Port in use**: change `PORT` in `.env` (and `VITE_API_PROXY_TARGET` to match); the web port is 5173.
- **Prisma download errors**: Prisma fetches engine binaries on first run; check your network/proxy.
- **"Cannot reach the RideWave API"** on the web page: the API is not running or the database is not migrated.

## Development-mode substitutes
Maps, payments and email default to `dev` adapters: nothing live, nothing real is sent or charged. The status page labels this.

## Pages (Phase 2)
`/` Home, `/how-it-works`, `/ride-options` (live rates from the database), `/safety`, `/drive-with-us`, `/contact` (saves a support ticket),
`/terms`, `/privacy` (draft placeholders), `/status`, and `/login`, `/register`, `/forgot-password`, `/reset-password`
(forms validate, but submitting says accounts are not available until Phase 3).
New API endpoints: `GET /api/v1/ride-categories`, `POST /api/v1/support/contact`.
After pulling Phase 2 over Phase 1, run `npm install` then `npm run db:seed` (so Ride Options has data).

## Demo accounts (development only)
`npm run db:seed` creates these (password for all: `RideWave-Demo-2026`). They are never created when `NODE_ENV=production`.

| Role | Email |
|---|---|
| Admin | admin@ridewave.test |
| Passenger | passenger1@ridewave.test, passenger2@ridewave.test |
| Driver (approved, with vehicle) | driver1@ridewave.test, driver2@ridewave.test |
| Driver (pending approval) | driver3@ridewave.test |

## Authentication notes (Phase 3)
- Sign-in sets an HTTP-only session cookie; only a keyed hash of the session token is stored in the database. Passwords are hashed with bcrypt (cost 12).
- State-changing requests are protected by an Origin check plus a CSRF token header. **Open the site at http://localhost:5173** (not 127.0.0.1): the origin must match `WEB_ORIGIN`.
- Password reset is a development flow: no email is sent; the reset link is shown on the page.
- Dashboards: `/passenger`, `/driver`, `/admin` (each role only sees its own; the API enforces this, not just the UI).

## Testing the phone layout
In Edge or Chrome press F12, then Ctrl+Shift+M (device toolbar) and pick a phone such as "iPhone 14" or "Pixel 7".

## Passenger booking (Phase 4)
Sign in as `passenger1@ridewave.test`, then: Book a ride (pick sample places, compare fares, confirm), My rides, Places, receipts, and reviews.
Run `npm run db:seed` again to load sample rides: one completed and reviewed, one completed and awaiting a review (use it to try the review form and receipt), one cancelled, plus saved places Home and Work.
- **Development map:** place search uses a fixed list of sample Johannesburg places, and distance/time are deterministic estimates from straight-line distance. Nothing is live. The UI labels this everywhere.
- **Fares** are always calculated by the server (integer cents). The browser never sends a fare.
- **Cancellation:** free until a driver has been assigned for more than the free window (2 minutes by default); after that a fee applies. Trips in progress cannot be cancelled by the passenger.

## Driver operations (Phase 5)
**Try the whole ride loop with two browser sessions** (e.g. a normal window and a private/incognito window, because each holds its own sign-in):
1. Window A: sign in as `passenger1@ridewave.test`, Book a ride (Economy, from Sandton City).
2. Window B: sign in as `driver1@ridewave.test` (approved, online, near Sandton). The request appears on Overview; Accept, then "I have arrived", "Start trip", "Complete trip".
3. Window A follows along (the page refreshes every 5 s), then shows the final fare, a receipt, and a review form.
Use `driver2@ridewave.test` for Comfort rides. `driver3@ridewave.test` is pending approval and cannot go online (admin approval arrives in Phase 6).

How it behaves
- **Matching** offers a ride to the nearest eligible driver (approved, online, active vehicle in that category, no other active ride, within 15 km of pickup). A driver has 60 s to accept; otherwise the offer passes to the next driver. If nobody is available for 60 s the ride becomes "No driver available" and the passenger can search again or cancel.
- **No double-booking of a driver:** a driver is claimed with a single atomic database statement (checked against real SQLite). Two passengers can never hold the same driver.
- **Polling-driven dispatch:** there is no background worker yet. Matching advances when a passenger or driver loads/polls their page, and when a driver goes online. Real-time push is planned for Phase 7.
- **Driver location** is chosen from sample places (no live GPS in development). "Use my browser location" works only inside the Johannesburg service area.
- **Final fare:** recalculated on completion by the server. There is no GPS metering, so distance is the booked distance and time never bills below the estimate.
- **Commission:** earnings use a placeholder 20% commission, clearly labelled as a demonstration value.
- **Cancellation fee** applies only after a driver has *accepted*, measured from acceptance.

## Administration (Phase 6)
Sign in as `admin@ridewave.test`. Tabs: Overview (live figures + chart), Users, Drivers, Rides, Vehicles, Pricing, Support, Audit.
- **Everything is computed from database records.** Revenue is shown as "fares from completed rides" and labelled as not money received (payments arrive in Phase 7).
- **Driver approval:** open a driver, review their vehicles and documents, then Approve / Reject / Suspend (a reason is required to reject or suspend). Try it with `driver3@ridewave.test`: sign in as that driver, upload a document under Documents, then review it as the admin. Approval is a manual decision; nothing is verified automatically.
- **Private documents:** uploads (PDF/PNG/JPEG, max 5 MB) are checked by their real file content, stored under a random name in `apps/api/storage/documents` (override with `STORAGE_DIR`), and are only available through authorised endpoints (the owner or an admin). Opening a document as an admin is written to the audit log.
- **Pricing:** change rates per category; amounts are entered in rand and stored as whole cents. New estimates use the new rates at once; existing rides keep their fare. Rates are demonstration values.
- **Audit log:** user suspensions, driver approvals, document reviews/views, pricing and category changes, vehicle changes, admin ride cancellations and ticket changes record who, what (before/after) and when.
- Admins cannot change their own account status. Suspending a user signs them out immediately and takes a driver offline.

Not in this phase: notification management, a platform-settings screen (a configurable commission rate needs a small database change and is planned for the integrations phase), and the payments list.

## Integrations (Phase 7)

### One-time database step after upgrading from Phase 6 (new `PlatformSetting` table)
```powershell
npm install
npm run db:migrate -- --name platform_settings
npm run db:seed
```
Prisma creates the migration from the schema and applies it. Until you do this the app still works (it logs a warning and uses default settings); only saving settings needs the table. A fresh install is covered by `npm run setup`.

### Payments (simulated)
- A provider-independent payment module with a **development adapter that moves no money**. Everything it produces is labelled "Simulated" and its references start with `dev_`.
- After a ride completes, the passenger pays from the ride page: **cash**, or a saved **card / digital wallet** (simulated). Cash stays *pending* until the driver confirms receiving it (Trips tab, "Confirm cash received").
- Saved methods keep only a name and the **last 4 digits**; full numbers and CVV are rejected. Demo outcomes by last 4 digits: `0002` is declined, `0005` stays pending for about 15 seconds then succeeds, anything else succeeds.
- **No double charging:** one in-flight payment per ride is enforced by a database unique key; repeating or double-clicking returns the same payment. A failed payment can be retried (a new attempt). Every status change is recorded as a payment event.
- Receipts show the payment. Admins see all payments under Payments (totals are simulated).

### Real-time updates
- Socket.IO on the same port as the API. Connections use your sign-in cookie, the browser origin must match `WEB_ORIGIN`, and users only receive events for their own rides. Events carry no ride data: the app re-fetches over the normal authorised API. Signing out or suspension closes live connections.
- Polling remains as a fallback (the dashboard header shows "Live updates" or "Updates every few seconds").

### Notifications
- In-app notifications for ride progress, offers, payments and announcements (bell in the header). **No email or SMS is sent**: those providers are not connected. Admins can send announcements under Announcements.

### Platform settings (Admin > Settings)
- Driver commission, driver response time, search timeout and maximum pickup distance are now editable and audited. The default 20% commission is still a demonstration value.

### Map provider
- The map seam is `apps/api/src/providers/map-provider.ts` (`MapProvider` interface). Only the development provider exists; adding Mapbox or Google means implementing that interface. The booking code does not change.
