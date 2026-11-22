# Maharashtra Vision Media

Agency website, Google client portal, full studio admin, and compact On the go workspace. Retains the reference's black/crimson palette, typography, portrait treatment, cinematic name reveal, and smooth motion.

## Local development

Node.js 22. Run `npm.cmd ci`, `npm.cmd ci --prefix functions`, then `npm.cmd run dev`. Open http://127.0.0.1:5173/. Build with `npm.cmd run build`.

## Main routes

- `/`: public agency website.
- `/billing` or `/portal`: client bookings, shoots/deliveries, documents, social content and preferences.
- `/admin`: full management.
- `/go`: quick daily assignments and management.
- Development-only `/admin/layout`, `/portal/layout`, `/billing/layout`: empty design previews.

Read [STUDIO_SETUP.md](STUDIO_SETUP.md) for the implemented workflow, invoice/receipt lifecycle, cloud protection, business setup, and provider activation. No demo business records are seeded. Maps, WhatsApp and paid checkout require their real provider configuration; they never simulate success. Initial owner is the explicitly supplied Google account `account@example.invalid`.

Tests use only the isolated `demo-mvm-invoices` emulator project. See the setup document before running integration tests. No real messages or payments leave the tests.

Design adapted from the user-selected [Portfolio_series](https://github.com/Sushmitadasari/Portfolio_series), with the supplied Jaydeep and Viraj portraits and real agency/partner links. Original personal content has been removed.
