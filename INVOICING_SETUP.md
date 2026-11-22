# Invoices and receipts

See [STUDIO_SETUP.md](STUDIO_SETUP.md) for current setup and deployment requirements.

- A confirmed order gets one immutable, uniquely numbered invoice, allocated transactionally by Indian financial year.
- Actual advance, part-payment, and final-payment entries each get their own uniquely numbered receipt against that invoice. Stored cumulative balances remain correct even if trigger delivery is out of order.
- Explicit payment bypass bills zero, preserves agreed value internally, and fabricates no collection or receipt.
- Offline refunds create a separately numbered acknowledgement and never erase actual collections or transfer money.
- Documents are viewable/printable as HTML/CSS and archived as private server-generated PDFs. Client/admin downloads enforce ownership/permissions. A retry does not overwrite an existing PDF or allocate another number.
- Business identity, terms, scope, plan, dates/slot/location and prices are snapshotted. Settings affect new documents only. Marathi/English text is supported by the bundled OFL font.
- The admin can customise identity/address/contacts/registration fields, heading, prefix, colour, terms, footer and issuer. A registration field does not implement GST/tax calculations.
- Clients can search and paginate their own document history. Counters and records cannot be changed/deleted by the browser.
- Firestore database deletion protection and daily seven-day backups are configured in the real project. Backup/restore/storage operations may be billed; this is not an absolute project-owner deletion guarantee.

Production gateway checkout remains deliberately deferred until a provider is chosen. There are no fake transactions, client records or issued sample invoices. Local format proofs are clearly marked unissued and never uploaded as business records.
