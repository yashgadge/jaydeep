Current implementation and cloud configuration: see STUDIO_SETUP.md. Provider-specific activation remains required.

# Studio operations setup

## Routes and activation

`/admin` now contains the full management shell; `/go` is its compact daily workspace. `/billing` is the client portal. The contacts, WhatsApp and payments modules are embedded within this shell. Development-only `/admin/layout` and `/billing/layout` contain empty layout previews, never fake client records.

Firebase project: `m-v-ml`. Core functions, Google provider configuration, and domain-restricted App Check are deployed; see `STUDIO_SETUP.md`. Actual owner sign-in still needs user verification. No production records or messages were created by development tests.

## Contacts and access

Google registration creates a contact with both WhatsApp preferences off. Clients choose order updates and promotions separately. A manual new opt-in or opted-in number change requires recorded evidence. Registration/contact creation never implies consent.

Owner independently grants `contactsManage`, `whatsappSend`, `clientsExport`, `paymentsManage`, and `invoiceManage`. Settings and member grants remain owner-only. Messaging-only recipient responses exclude internal notes and consent evidence. Clients access preferences through a sanitised callable, not direct contact writes.

Filters: name/business/email/phone/tags search, exact city/service, registered/manual source, consent, and added-date range in India time. Payment filters add method/client UID. Queries scan bounded pages; sparse results can still have a Load more option.

## WhatsApp connection

Function parameters: `MVM_WHATSAPP_PHONE_ID`, `MVM_WHATSAPP_ACCOUNT_ID`, `MVM_WHATSAPP_API_VERSION`. Backend secrets: `MVM_WHATSAPP_ACCESS_TOKEN`, `MVM_WHATSAPP_APP_SECRET`, `MVM_WHATSAPP_VERIFY_TOKEN`. Never put secrets in frontend configuration or Firestore.

Register `whatsAppWebhook` with Meta for the business number. It verifies challenge/signature and number ID. Verified inbound timestamps establish a 24-hour service window. STOP/unsubscribe/बंद blocks the phone and clears matching contact flags. START/resume clears the block without creating marketing consent. Newer stop preferences take precedence over old events.

Owner syncs approved templates from Meta. The initial composer supports the first 100 provider templates, limited to approved text-body utility/marketing templates with numbered parameters (no header/buttons). Custom text requires a verified open service window and update consent. Arbitrary bulk text outside that window is not supported.

Flow: filter/select contacts -> compose -> preview eligibility/cost -> queue. Five-minute preview; repeat clicks use the same campaign ID. The worker rechecks permission, consent, template, duplicates/frequency, master switch, and limits. Accepted is distinct from delivered/read. Unknown provider outcomes require review, with no automatic retry that could double-charge.

## Cost controls

Sending, automation, and promotions default OFF. Configuration defaults: 30 attempted messages/day, 2/client/day, 4 hours between updates, 30 days between promotions, maximum 50 campaign recipients, and ₹500 monthly reserved estimate. Unit estimates initially 12 paise utility/service and 87 paise marketing, editable by owner.

These are conservative application estimates, not a live Meta bill or a guaranteed provider spending cap. Verify applicable rates/taxes/fees before enabling. Atomic reservations remain counted for failed/uncertain attempts. Lowering a limit does not undo prior reservations.

Dedicated Stop all WhatsApp now works independently of unsaved form edits. Stop generation cancels old queued jobs even after re-enabling. In-flight/already accepted messages cannot be recalled. No stopped or uncertain jobs silently resume.

Message history subscribes to the newest 50 jobs using changed-document updates. Two small usage counters are observed while that tab is open. Other lists use bounded pages/revision signals instead of polling whole collections.

Automatic-event switches are saved/enforced for jobs tagged `automated` and their event type. Booking/payment/delivery event producers and a shared reminder worker are implemented; they are activated only after the real WhatsApp provider environment/secrets are connected. See STUDIO_SETUP.md.

## Exports and payments

Excel export freezes filters at click time and scans all matching pages, with a 10,000-scanned-record safety guard. Oversized/cancelled exports never download a partial file. Workbook includes supported profile/contact/consent/evidence/date/tag/note fields and an Export scope sheet. Provider secrets/tokens are excluded. Formula-like strings remain text; phone prefixes are preserved. Export library is lazy-loaded; exported pages are audited. Selected campaign recipients and filtered export scope are labelled separately.

Payments show actual collections, references, received date, method, client/order, status, and provider; totals are explicitly for loaded records. Manual cash/UPI/bank payments require confirmation and an existing real order. Backend uses integer paise, rejects overpayments, prevents duplicate request IDs and UPI/bank references, and updates order balance atomically. Bypass orders cannot create income. No payment gateway or simulated payment is implemented. Issued invoices retain their original at-issue snapshot.

Tests use only `demo-mvm-invoices` locally. Meta transport is intercepted: no real messages are sent. Core cloud functions are deployed and a real App Check request reached the authentication guard. Owner sign-in and Meta onboarding/templates/webhook delivery still need live verification.

