# Studio controls and receipts — owner guide

## Bills & receipts

- **Manual receipt → Past shoot · new entry:** use only for a completed shoot that has never been entered. Choose a registered or manually added client, describe the shoot, enter its original date and agreed total, and record an amount actually received. A new completed order, invoice and payment receipt are created. No past calendar slot is reserved. Documents are issued today; the original shoot/payment dates appear separately.
- **Manual receipt → Existing completed shoot:** choose the existing completed/preparing/delivered order with a balance. Records another actual payment and its receipt. It does not create another order or invoice. UPI/bank references and remaining balances are checked by the server. Retrying the same request cannot collect twice.
- **View bill:** opens the immutable document snapshot. **Download PDF:** downloads its archived A4 PDF. **Print / Save PDF:** opens the print layout.
- **Search:** bill/receipt number, order ID, project, client name, email or phone.
- **Client:** exact client filter, including manually added contacts. **Document type:** all, invoice, receipt or refund acknowledgement.
- **Filter dates by:** choose the document issue date or the actual shoot date, then From/Through (inclusive, India time). Press Apply filters. Reset removes all filters.
- **Select shown:** selects at most 50 currently loaded documents. Individual checkboxes allow mixed shoots. **Download selected PDF:** combines the selected original documents, each with its own document number/page footer, into one PDF.
- **Download filtered PDF:** scans all matching pages, rather than only the visible page. Up to 50 matching documents and a 7 MB combined PDF per request; narrow client/date/type filters for larger collections. Invoice and receipt are separate documents, not two charges.
- **WhatsApp PDF:** shows the saved client number and exact approved message, then queues the PDF attachment. Requires WhatsApp send permission plus billing/payment access. Actual sending requires the API connection, master switch on, an approved utility template with a DOCUMENT header and exactly three body parameters (client name, document number, amount), and client permission for order updates. Queue, accepted, delivered/read and failed/uncertain states remain distinct. No silent retries after an uncertain provider outcome. No public PDF links are created.
- **Archive PDF again:** repairs PDF archiving for an issued record; it does not issue a second bill.

## Booking, location & session controls

| Option | What it does / current status |
|---|---|
| Allow client bookings | Permits new client confirmations. Staff entries and callback enquiries are separate. Cashfree checkout is not connected yet. |
| Allow client payment bypass | Enables **₹0 billed / no-charge** client bookings when invoice bypass is also enabled. It is not pay-later. Use a normal offline order and Payments for pay-later. |
| Studio phones and names | Controls contact/call buttons and future document phone lines. Does not connect WhatsApp API credentials. Optional phone 2 can be blank. |
| Agency Instagram URL | Sets the public agency link. Only approved HTTPS Instagram hosts are accepted. |
| Total team capacity per slot | Limits combined crew units reserved in each slot. Individual package/custom crew requirements consume that capacity. |
| Booking notice (hours) | Minimum lead time for new client bookings. |
| Book ahead (days) | Maximum advance booking horizon. |
| Client address entry | Manual only, Google suggestions only, or both. Manual addresses create enquiries; verified coordinates are required for direct client confirmation. |
| Default address option | The initially selected available address method. |
| Google address lookups | Server-verified autocomplete/place/geocoding. Disabled until restricted server key + provider activation. Enabling without the provider is rejected. |
| Show location map preview | Shows the selected verified location. This is presentation, not an independent verification. |
| Interactive map pins | Requires restricted browser Maps key plus server coordinate verification. Not live-tested without keys. |
| Studio latitude / longitude | Studio origin used for distance calculations; bounds are validated. |
| Base shoot radius | Included travel distance; beyond it a matching minimum-order tier is required. |
| Maximum travel distance | Hard limit beyond which online booking is rejected and studio review is needed. |
| Distance pricing rules | Highest applicable configured distance tier sets the minimum order value. It does not add a travel surcharge. The server checks verified coordinates. |
| Allow custom shoots | Enables published products and quantity selection. |
| Custom advance (%) | Advance proposed for a custom-priced shoot. Cashfree collection remains pending. |
| Custom team members | Capacity units required for a custom shoot. Cannot exceed total slot capacity. |
| Custom revisions | Included revision requests after delivery. |
| Custom delivery estimate | Delivery wording copied into new custom plans/documents. |
| Lookup attempts/day and /month | Studio-wide India-day/month application attempt budgets. Zero stops lookups. Not Google's billing totals. |
| Lookups/client/minute | Per-user server rate limit for Maps requests. |
| Client/team idle timeout | Browser warns/signs out; server rejects expired idle sessions too. |
| Maximum session hours | Absolute time since authentication; signing in again is required. |
| Cancellation notice | Client cancellation cut-off relative to shoot slot. Existing bookings retain the policy agreed when created. |
| Cancellation fee | Stored policy value for cancellation/refund review. No automatic deduction or refund is claimed. |
| Reschedule notice | Minimum notice before clients can request moving a shoot. Capacity is checked again. |
| Maximum reschedules | Per-booking client reschedule allowance. |

`travelBufferSlots`, `holdMinutes` and `rateCooldownMinutes` exist as reserved/default data but have no active user-facing workflow/setting in this release. They are not working features and are not exposed as controls.

## Other settings panels

- **Public business/legal contact details:** publishes the studio identity and policy revision. Old policy versions and each booking's accepted version stay recorded.
- **Business identity & invoice format:** business/address/phones/email/website, invoice prefix/title, registration label/value, accent, signature, terms/footer and bypass switch apply to future issued documents. Business phones sync with studio contact settings. PDF downloads and Print now share the website invoice component and fonts. Small public PNG/JPEG/WebP logos are fetched safely and embedded into downloads; unavailable logos fall back to the MVM monogram. Previously archived PDFs are regenerated on first download in the current print layout, without changing issued invoice details.
- **Usage & activity:** application Maps attempts plus recent audit entries. Not a provider billing statement. Different legacy audit writers use different timestamp keys, so this list is not a complete forensic history.
- **Packages:** authoritative unit/package prices. **Payments:** actual offline money received and refunds. **WhatsApp:** sending switches, approved template sync, cost caps and client frequency limits. **Team & access:** separate permissions for orders, payments, billing, clients, messages and the two staff dashboards.

## Verification performed, 19 November 2026

- Production build passed.
- Existing backend test suite plus new receipt/export/settings tests passed (see output/VERIFICATION.md for final counts). Existing emulator-dependent tests were deliberately skipped; no emulator was started.
- New callable-level tests use an isolated in-memory transaction store, assert reads precede writes, and exercise receipt creation/retries, permissions, duplicate references, final payments, overpayment rejection, client scoping, filtered pagination and PDF merge.
- All exposed studio settings round-trip through the server validator; owner save and rejection of non-owner/Maps activation are tested. Domain tests cover dates, capacity, travel pricing, policy and invoice amounts.
- A sample A4 receipt and combined PDF were generated and visually inspected. They are marked TEST PREVIEW and were never written to the live ledger.
- Browser checks cover the new forms/filters/help in layout preview. No fake financial records, payments or WhatsApp messages were created in production.
- **Not yet end-to-end verified:** real WhatsApp delivery/template approval/webhook, Google address or pin lookup, Cashfree checkout, and real production receipt creation. These need provider setup or a genuine completed shoot/payment entry. A successful code test or deployment is not a claim that every live integration has been verified.

## WhatsApp provider preparation

Use a utility template with a DOCUMENT header, no buttons, and three numbered body values. Suggested text: `Hello {{1}}, your document {{2}} for {{3}} is attached. Thank you, Maharashtra Vision Media.` Meta approval is required. Configure the existing server secrets/account/phone IDs, activate the provider, deploy, sync templates in WhatsApp, and enable sending. The PDF is uploaded privately from server storage to Meta and sent by media ID.

Official references: [Meta media template request](https://www.postman.com/meta/whatsapp-business-platform/request/2qbotrb/send-message-template-media), [Meta media upload overview](https://whatsappbusiness.com/blog/media-messages-via-app/).

## UPI/bank details, payment PDFs and money history — 19 Nov 2026

### Set up receiving details
Open **Settings → UPI & bank details**. Enable UPI QR and enter your receiving UPI ID and receiver name. Enable bank-transfer details and enter the account holder, bank, account number (twice), IFSC, account type and optional branch/instructions. Only the owner can read or change the receiving configuration. Disabled methods are excluded from client document data, not merely hidden visually. This form never asks for a PIN, OTP or bank password.

### Ask a client to pay
On an invoice under **Bills & receipts**, choose **Request payment · QR**. The default is the live unpaid balance; you can request a smaller part-payment. The server rejects zero, over-balance, paid or cancelled bills. The resulting payment-request PDF includes the original invoice details, total, received amount, current remaining balance, requested amount, an amount-filled UPI QR and the enabled bank-transfer fallback.

The payment request has its own tracking number and is not an extra charge or a receipt. Existing invoice snapshots stay unchanged. QR/UPI contains the exact rupee amount, receiving UPI ID, receiver name, INR currency and request/invoice reference. The payment app must still be used to confirm payment; the website does not automatically detect money arriving through a standalone UPI QR.

When ready, use **Send PDF on WhatsApp** from the PDF viewer or document row. This uses the existing saved client number, order-update permission, approved utility document template and delivery-tracked queue. WhatsApp API setup is still required. A change in balance, receiving configuration or bill cancellation supersedes old requests and blocks them from being newly queued/sent through this flow. Downloaded/shared snapshots remain historical records.

### Record payment or cancel
- **Mark payment received:** enter the amount actually received, method, received date and UPI/bank reference, then confirm receipt of funds. You can record part-payments or the full balance. The server updates the ledger and creates the corresponding receipt. Transaction references and request IDs prevent duplicate entries.
- **Cancel bill:** enter a reason and confirm. Stops new collection requests, sets collectible balance to zero, creates a cancellation document and retains the original invoice plus every payment. It does not cancel the shoot, erase income or make a refund. Money already received is flagged for refund review.
- **Record late payment:** cancelled bills can record money that genuinely arrived afterwards, with explicit acknowledgement and refund review. It is not silently discarded or treated as a new charge.
- A previously shared UPI QR cannot be disabled at the bank. Cancellation prevents new sends in the website, but cannot recall a PDF or block a payment made from an old copy. Verify actual bank/UPI receipts and record any late payment.

### Money history
Bills & receipts includes received, refunded, net collected, still-to-receive and cancelled-unpaid totals. The expandable ledger lists actual payments, refunds and cancellations with client/order/date/reference. Filter by client and transaction dates; load older rows in pages of 100. Received/refunded/cancelled totals use the date range. Still to receive shows the client's current outstanding balance across all dates. Creating or sending a QR never adds income. Refunds count only when recorded as actually made.

The main studio overview also excludes cancelled bill balances. Late or out-of-order receipt generation cannot reopen cancelled bills or change a fully paid order back to part-paid. Provider acceptance/delivery is tracked separately from financial settlement.

### Verification
The local backend suite covers bank/UPI validation, leading-zero account numbers, role restrictions, real QR PNG decoding, exact requested amount, request snapshots/idempotency, balance checks, actual payment receipts, cancellation/refund review, late payments, money totals/client/date filtering, disabled-method privacy and stale-request WhatsApp blocking. The generated A4 sample was rasterized and its printed QR successfully decoded as INR 1,500.00. No real bank configuration, customer payment, cancellation or WhatsApp send was performed as a test.
