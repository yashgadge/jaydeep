# Maharashtra Vision Media — agreed product requirements

Recorded 2026-11-18. Scope document; see LAYOUT.md and the setup documents for which parts are implemented and which remain pending.

## Existing application and visual direction

- Update the existing React/TypeScript/Vite reference in this workspace.
- Preserve near-black, crimson, warm-white public styling and the existing Bebas Neue, Inter, and Instrument Serif font system.
- Public pages should be cinematic, media-led, responsive, and smoothly animated. Respect reduced-motion preferences.
- Client portal uses a professional light theme with clear visual service cards, illustrations, and restrained task-focused motion.
- Admin screens must be modern, mobile-friendly, readable, and quick to operate.
- No seeded clients, fake bookings, invented metrics, fake payment confirmations, or demo content in production. Empty, loading, error, and unconfigured states must be honest.

## Single website

- Public agency site, Google client login, client portal, and authorised admin/team workspace share one website/domain.
- Public site: portfolio, services, packages, managed client handles, agency/team story, testimonials, FAQs, contact, booking entry.
- Agency Instagram: https://www.instagram.com/maharashtra_vision_media/
- Partners: https://www.instagram.com/its_jaydeep2524/ and https://www.instagram.com/viraj_murkute__/
- Curated Instagram Reel links/embeds and shareable project pages. Do not invent client work or social statistics.
- Clients only access records belonging to authorised client memberships. Drive permissions must separately grant access to intended clients.

## Dynamic services, packages, and pricing

- Admin can create, edit, reorder, feature, publish, and hide service cards and occasion choices.
- Service cards support SVG icons/illustrations and images. Sanitize uploaded SVG content.
- Example service flows: shoot booking, social media management callback, custom enquiry. These examples are not production seed data.
- Packages and add-ons configured in admin: price, advance, inclusions, quantities, coverage, delivery estimate, revisions, and flow.
- Support fixed price, starting price, or quotation-based offerings.
- Preserve an immutable snapshot of purchased price/inclusions/policies on each booking.
- Include an Other occasion option with a short description field.

## Booking and location

- Google sign-in before booking/location search.
- Standard instant booking: service/package, eligible location, date, Morning/Evening/Night slot, advance, confirmation.
- No exact-time picker for clients. Team assignment is internal and is not offered as a client choice.
- Quote-based services use callback/enquiry flow instead of instant checkout.
- Admin address mode: Google suggestions only, manual only, or both; configure the default when both are enabled.
- Separate admin toggle controls the View location on map button/interactive map.
- Suggestion-based instant booking requires a selected place with server-validated coordinates. Editing search text invalidates the previous selection.
- Optional landmark/entrance details separate from the selected address.
- Retain current-location selection as an optional location method when enabled; require permission and venue confirmation.
- Admin sets base location and service-radius distance. Straight-line radius unless road-distance rules are explicitly adopted later.
- Outside-area or unverified manual locations use a clear call/enquiry path; do not silently permit automatic checkout.
- Maps unavailability/usage pause preserves booking draft and offers manual enquiry/call fallback.
- Admin can create manual bookings, custom orders, date/slot blocks, and documented service-area overrides.
- Quick custom order: first select an existing client who has registered through Google sign-in, then enter the agreed number of reels, number of images, optional additional deliverables/notes, agreed total price, date, and Morning/Evening/Night slot.
- Custom orders do not require creating a public service/package. Store the individually agreed deliverables and price on the order, reserve calendar capacity with backend conflict checks, and show the order in that client's portal.
- Only registered clients can be selected for this custom-order flow. A client who has not registered must first sign in with Google; do not fabricate an account or substitute a manually entered email for registration.
- Custom-order payment starts unpaid unless an authorised member explicitly records an actual advance/offline payment. Balance is calculated from recorded payments.
- Slot capacity and travel buffers are server-enforced, independent of later staff claims.
- Temporary checkout holds, expiry, payment reconciliation, and confirmation must prevent double booking.

## Team and permissions

- Jaydeep and Viraj have separate accounts and personalised on-the-go dashboards.
- Unassigned orders have an I'll take this order action. Claim with an atomic backend operation; reject conflicting claims.
- Owner can add future members and configure module visibility, actions, record scope, and which settings each member can change.
- Enforce all permissions in backend/security rules, not only navigation visibility.
- Members cannot grant themselves permissions. Record sensitive actions in an activity log.
- Decide team capacity/required crew rules before enabling instant paid bookings; unassigned must not imply unlimited availability.

## Payments and policy changes

- Payment gateway selection deferred. Build provider-neutral payment records and verified backend integration boundaries.
- Updated invoice bypass requirement: when explicitly enabled and used, billed order/invoice value is zero and no collection is recorded. Preserve the originally agreed price in the internal order/audit record. This is distinct from a pay-later order, which retains a payable balance.
- Separate booking status from payment status; preserve quoted amount, advance, balance, offline payments, and future provider references.
- Restrict who can enable bypass or record offline payments; log changes.
- Modern HTML/CSS invoice with A4 print/Save PDF export; business identity, address/contact, branding, notes, and numbering prefix configurable by owner. Client/order/package/deliverables/prices sync from trusted order records.
- Issue unique numbers through backend atomic counters, with idempotent issuance and immutable identity/price snapshots. Issued invoices accessible to the respective client and authorised admin; no browser-generated authoritative numbers.
- Production online payments remain unavailable until a real provider is configured. Never simulate successful charges/refunds.
- Cancellation/reschedule policies, deadlines, fees, eligibility, and approval controls configurable by authorised admin.
- Snapshot applicable policy on booking. Clients request changes; backend validates permissions, policy, availability, and financial effects.
- Refund records distinguish requested, processing, paid, failed, and manual processing as applicable.

## Client history and fast deliveries

- Portal shows upcoming shoots, previous projects, booking progress, payment state, and deliveries.
- From an order/client on the on-the-go page, add labelled photo/video/other Drive links and publish in a short interaction.
- Store links, authorisation, labels, publishing metadata, and revision requests in Firebase; original delivery files stay in Drive.
- Basic revision request and delivery notifications. Avoid an unnecessarily complex file-management interface.

## Managed social media clients

- Monthly packages, onboarding brief, content calendar, approvals/change requests, and renewal tracking.
- Public managed-handle showcase distinguishes active management, past client, and one-off shoot.

## WhatsApp only for client notifications

- No client email notification workflow requested; Google login remains.
- Official WhatsApp Business Platform for automatic booking/payment updates, shoot reminders, delivery notices, renewals, and promotional campaigns.
- Store client WhatsApp number separately from Google login identity.
- Contacts can register or be added manually. Contact creation does not automatically grant marketing consent.
- Store appropriate opt-in and opt-out records; promotional audience excludes contacts without applicable consent.
- Approved templates where required, campaign audience preview, message count/cost estimate, limits, and delivery/failure status.
- Backend queue with duplicate protection, bounded retries, and cancellation of obsolete reminders after reschedules/cancellations.
- Client has independent, optional tick boxes for order updates and promotions, off by default. Manual opt-ins require recorded evidence; verified WhatsApp STOP is honoured per phone.
- Owner master stop covers manual and automatic sends and invalidates previously queued jobs. Separate automation/event/promotion switches, per-client daily limits, update/promotional cooldowns, daily volume, and monthly estimated budgets are configurable.
- Manual composer supports one/many selected clients, filtered eligibility/cost preview, approved templates outside verified service windows, and deduplication of shared numbers. Unknown provider outcomes are not automatically retried.
- Client Excel export includes supported profile/contact/consent details for the applied date/filter scope across pages, with explicit export permission and no partial download beyond a safety cap. Payment ledger has its own permission, filters, actual collection recording, references, and balances.
- Do not claim a message was delivered before provider confirmation. Unconfigured provider shows notifications unavailable.

## Firebase architecture and cost controls

- Firebase Hosting, Authentication (Google), Firestore for persistent application data, Cloud Functions for privileged logic/webhooks, and Storage for suitable site media.
- User has Blaze plan. Firebase project m-v-ml is configured; see STUDIO_SETUP.md for verified cloud setup and remaining provider/business configuration.
- Firestore already supports realtime listeners. Use Realtime Database only for a distinct justified need; do not duplicate business records across databases.
- Narrow live queries to visible/current records, unsubscribe when not needed, paginate history, cache public content, and avoid continuous polling or global collection listeners.
- Use shared scheduled reminder processing rather than one scheduled job per booking.
- Protect with Security Rules, App Check, account/IP rate limiting, bounded function resources/retries, monitoring, and supported provider quotas/spend controls.
- Track estimates honestly; provider billing reporting is authoritative and may lag. Do not promise a universal instantaneous hard spending cap on Blaze.
- Store API/provider secrets on backend. Protect client Drive links with record-level access controls.
- Test permission isolation, concurrency, policy enforcement, and payment state transitions using local emulators and isolated fixtures; no test data in production.

## Admin settings and dashboard

- Today/upcoming shoots, own assignments, unassigned work, edit/delivery deadlines, balances, callbacks, manual booking, and quick delivery publishing.
- Only real records; dashboard empty states should guide setup without invented activity.
- Full management: clients, orders, calendar, services/packages, social media retainers, payments, deliveries, website content, members/permissions, notifications, integrations, and activity history.
- Admin-adjustable client inactivity, admin inactivity, checkout-hold, and rate-limit cooldown timers within validated bounds.
- Warn before session expiry, offer stay signed in, preserve drafts, and enforce session rules server-side.
- Maps usage tracking, pause controls, thresholds, and Google-side key/quota restrictions.

## Decisions/configuration still outstanding

- Supplied Firebase project: `m-v-ml`; web app configuration added. Initial authorised owner is `account@example.invalid`; owner can grant registered members invoice access. Firestore and Storage are in Mumbai, App Check is configured, database deletion protection and daily seven-day backups are enabled. Verify deployed function state and real owner sign-in before launch.
- Real agency content, services/packages/prices, base location/radius, contact number, media, and client handles.
- Operational capacity, package crew requirements, and travel-buffer behaviour before staff assignment.
- Final cancellation/refund policy. Explicit zero-value bypass bookings confirm and reserve capacity immediately, create a zero-value invoice, and never create a fictitious payment receipt.
- WhatsApp business number/account, direct Cloud API versus provider, templates, and applicable rate card.
- Payment gateway and production credentials deferred by user.

