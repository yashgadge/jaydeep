# Maharashtra Vision Media — studio workspace

## Routes

- `/`: cinematic public agency site, supplied partner portraits, animated name loader, prominent Login / Book actions, Instagram, and published CMS content.
- `/billing` or `/portal`: Google client login, booking/enquiry cards, shoots, deliveries, revisions, documents, social content approvals, and WhatsApp preferences.
- `/admin`: overview, custom bookings, orders, calendar, packages/add-ons, contacts/Excel exports, WhatsApp, payments/refunds, documents, social plans/content, website CMS, team access, and settings.
- `/go`: compact daily workspace with own assignments, available work to claim, quick stage/delivery updates, and manual booking.
- Development-only `/admin/layout`, `/portal/layout`, `/billing/layout`: empty layout previews, never production demo records.

## Business setup

Sign in with `account@example.invalid`. The backend validates the verified Google identity before bootstrapping owner access. Other people first register using Google; owner then adds them from Team & access and selects module permissions. A normal login never grants administration rights.

1. Settings: save actual billing address, phone, business details, heading/prefix, terms, accent, and optional registration information.
2. Packages: add actual services/prices, advances, inclusions, reels/images, delivery estimates, occasions, crew capacity, and add-ons. Publish only real packages. Other is always available for shoot occasions.
3. Booking settings: set capacity, booking notice/window, location modes, studio base/radius, cancellation/reschedule policy, and client/team inactivity timeouts.
4. If using the currently requested bypass mode, enable it in invoice settings and client booking settings. Bypass confirms capacity immediately and bills zero. No actual payment or receipt is fabricated. Keep it off if a free confirmation is unwanted.
5. Website: publish real portfolio/Reel entries, managed handles, testimonials, FAQs, and contact details. Portraits and partner/agency Instagram links are already the supplied real assets.

Bookings default OFF until configured. There are no seeded clients, orders, prices, testimonials, payment successes, or portfolio projects.

Three owner-requested starter offers are installed: Celebration Stories, The Delivery Moment, and Brand in Motion. They are real editable catalog entries, published as **Request a quote** with no invented fixed price or client activity. Set their real prices and switch off quote-only mode before using fixed-price confirmation.

The studio supports two live phone numbers. They can be changed from admin at any time; the published site, client call buttons and new invoice identity sync automatically. Billing address, location and radius may be configured later. Previously issued bills retain their original snapshot.

Products & unit prices lets the owner add reels, photos, videos or other deliverables, per-item pricing, quantity bounds, visibility and quote-only mode. Clients can build a custom shoot from these products; the backend loads authoritative prices and validates each quantity. Custom advances, crew requirements, revisions and delivery text are configurable.

Distance minimums are an optional separate switch. The owner can add up to 12 increasing thresholds, such as greater than 5 km requiring an agreed order value of ₹2,000 and greater than 10 km requiring ₹4,000. These examples are not preconfigured prices. The highest matching tier is enforced on the backend; a client cannot select a cheaper distance rule. The base radius, extended absolute maximum and minimum agreed value all apply. Beyond the absolute maximum, only a call/enquiry is offered. Bypass uses the agreed package/product value for eligibility but still records a zero billed invoice.

## Order and financial lifecycle

Registered client -> select a published package, occasion, date, Morning / Evening / Night, and verified eligible venue -> confirm using enabled zero-value bypass. Without a connected payment gateway, paid checkout cannot claim success; clients can request a callback. Manual/outside-area venues remain enquiries; admin can create a real custom booking for a registered client.

Order creation is a Firestore transaction: registered-client check, price/package snapshots, capacity check/reservation, permanent order number, one immutable invoice, and audit event commit together. Manual blocks/travel slots reserve the same capacity. Concurrent requests cannot claim the same last unit. Google location IDs are server-owned, user-scoped, expiring, and checked against the current radius at booking time.

- Human tracking IDs: `MVM-CLI-YYYY-000001`, `MVM-ORD-YYYY-000001`, `MVM-PAY-YYYY-000001`, `MVM-RCP-YYYY-000001`, `MVM-REF-YYYY-000001`, and enquiry IDs. Firestore document IDs remain stable technical references.
- Invoice: one per confirmed order, numbered atomically by Indian financial year, `PREFIX/YYYY-YY/000001`. Retries reuse the invoice.
- Advance / part payment / final payment: each actual received payment gets a distinct numbered receipt, linked to the same invoice and order. The receipt stores cumulative paid/balance at that specific payment; event delivery order does not change historical balances.
- Offline cash, UPI and bank entries require actual received amounts. Integer paise, idempotency keys, duplicate transaction-reference checks, and overpayment guards run on the backend.
- Refund entries acknowledge money already returned offline. They never initiate a transfer, erase the payment ledger, or masquerade as tax credit notes.
- Bypass: actual billed amount and client line prices are zero; original agreed amount remains internal. No paid receipt is issued for a bypass.
- Delivery links are scoped to the registered client and assigned/authorised team. Revisions and booking-change requests have server-checked ownership, stages, policy snapshots, and limits.

Invoice identity is snapshotted when issued. Changing settings later does not rewrite past bills. Printed HTML/CSS bills and privately archived PDFs are available in Bills & receipts. Download authorisation is checked on every call; PDFs have no public download token. Owner/billing staff can retry a pending PDF archive without renumbering the record or overwriting an existing object.

Registration fields alone do not implement GST/tax calculations. Define applicable taxes and adjustments before using these documents as tax invoices.

## Persistence and protection

Project `m-v-ml`: Firestore `(default)` and Storage are in Mumbai (`asia-south1` / `ASIA-SOUTH1`). Database deletion protection is enabled. Daily Firestore backups retain seven days. This protects against ordinary application deletion mistakes; it is not an absolute guarantee against a project owner deleting cloud resources, and a new backup schedule is not an already completed backup. Backup storage and restore operations can be billed.

Browser writes are denied. Financial snapshots/counters/audits are server-controlled; the UI archives fulfilled/cancelled orders instead of deleting them. Storage is private, and server PDF writes use create-only object preconditions. Restoring from a database backup and regenerating PDFs from restored snapshots is an operational recovery procedure.

App Check uses a domain-restricted reCAPTCHA Enterprise key. Google auth is authorised for existing production domains plus localhost and 127.0.0.1. Callables enforce verified Google identity, App Check, active member permissions, rate limits, and session age/idle expiry. Private Firestore reads also require the current non-expired server session. No service-account key is in the frontend.

## Optional provider activation

**WhatsApp:** leave OFF until Meta business onboarding, phone/account IDs, token, app secret, verification token, approved templates, and webhook are ready. Backend secrets: `MVM_WHATSAPP_ACCESS_TOKEN`, `MVM_WHATSAPP_APP_SECRET`, `MVM_WHATSAPP_VERIFY_TOKEN`. Set real `MVM_WHATSAPP_PHONE_ID`, `MVM_WHATSAPP_ACCOUNT_ID`, supported `MVM_WHATSAPP_API_VERSION`, and `MVM_ENABLE_WHATSAPP_PROVIDER=true` in the Functions environment, then deploy provider/automation functions. No dummy credentials are used.

Owner maps approved utility template parameters to real client/order fields. Booking/payment/delivery events and one shared daily reminder worker create idempotent jobs. Shoot/renewal reminders run at 07:00 India time; balance chasing is weekly. Manual campaigns require recipient/cost review. The worker rechecks current consent, STOP state, staff access, event switches, template status, master-stop generation, per-client frequency, daily limit, and reserved monthly estimate immediately before sending. Unknown provider outcomes are not blindly retried. Approved templates are required outside a verified 24-hour service window.

**Google location:** enable the required Google Places/Geocoding APIs and put a restricted backend key in Secret Manager as `MVM_GOOGLE_MAPS_KEY`. Set `MVM_ENABLE_MAPS_PROVIDER=true`; deploy `searchStudioAddresses`, `resolveStudioAddress`, `verifyStudioCoordinates`, `getStudioMapConfig`, and `saveStudioSettings`. Restrict the server key to the required APIs and enforce Cloud-side quotas. Interactive selection additionally needs a browser key restricted to the site referrers and Maps JavaScript API, stored as `MVM_GOOGLE_MAPS_BROWSER_KEY` in the backend environment. Enable maps/pin selection/preview individually in admin after setup. Current location and picked coordinates are reverse-geocoded server-side; unverified text cannot confirm a client booking.

**Payments:** gateway deliberately remains unselected. Current supported money movement is an actual offline ledger or explicit zero-value bypass. A production gateway needs server-created checkout, signature-verified webhooks, idempotent settlement/refund handling, and reconciliation before paid checkout is enabled.

## Cost-conscious operation

Public CMS is compiled to one published document, rather than reading every project/package for every visit. Management pages use bounded pages, aggregate overview counts, and a small invalidation signal; document history is loaded only in its active tab. Excel export is lazy-loaded and scans bounded pages with a 10,000-record safety limit. No duplicate Realtime Database store is maintained.

Functions have no warm minimum instances and a maximum of two instances each. WhatsApp and Maps default OFF. Application usage reservations are estimates/attempt limits, not a universal hard cap on Google/Meta billing. Apply actual provider quotas and billing alerts in addition to app settings. Provider setup, actual tariffs, and real sign-in/checkout/message delivery must be verified before launch.

## Verification

`npm.cmd run build`. For backend tests, start the Firestore emulator with project `demo-mvm-invoices`, set `FIRESTORE_EMULATOR_HOST` and `GCLOUD_PROJECT=demo-mvm-invoices`, then run `npm.cmd test --prefix functions`. Tests refuse production data, intercept Meta sends, and create no real bookings/payments/messages. UI preview routes show empty records only.

## Final management behaviour

Team assignments reserve a member’s date/slot atomically and reject conflicting claims. Admin schedule/cancellation exceptions require an explicit reason. Issued financial documents remain immutable; actual returned money receives a separate refund acknowledgement. This is not a tax credit note.

Admin archive/restore keeps fulfilled/cancelled orders online and preserves the client’s delivery history. Upcoming dashboard cards query open scheduled work independently of paginated history. Member permission updates invalidate active management views.

## On the go weekly schedule

`/go` opens Schedule by default; the original overview remains under On the go. A Monday–Sunday strip supports previous/next week, selected-day navigation, a native date jump and Today; phone users can swipe the strip. The day timeline uses the actual Morning, Evening and Night slots. Cards show booking status/ID, client, location and assigned team and open the existing order tools. The quick plus opens the existing manual booking editor, with a Close action.

`getGoSchedule` queries a bounded seven-day range independently of paginated order history. All active staff may read their own assignments; Studio scope requires owner, order-management or calendar-management permission. Calendar block reasons additionally require calendar permission. Historic delivered/archived records remain visible; cancelled bookings can be toggled. More than 200 returned bookings produces an explicit incomplete-results notice. The frontend caches up to eight recent weeks for 30 seconds and invalidates on the existing studio change signal. No polling or full database listener is added.

The schedule callable is deployed and ACTIVE; its assignees/shootDate index is READY. Session/App Check checks remain in force. Development-only `/go/layout` is an empty, non-saving visual preview. It contains no sample bookings.
