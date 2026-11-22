import type { CSSProperties } from 'react';
import { formatInvoiceDate, formatMoney, initialInvoiceSettings, type Invoice, type InvoiceSettings } from './types';
import './invoice.css';
import './invoice-font.css';

export default function InvoiceDocument({ invoice, settings }: { invoice: Invoice | null; settings?: InvoiceSettings }) {
  const business = invoice?.business ?? settings ?? initialInvoiceSettings;
  const paymentRequest=invoice?.documentType==='payment_request';
  const receiving=invoice?.paymentReceiving;
  const refund=invoice?.documentType==='refund';
  const receipt = invoice?.documentType === 'receipt'||refund;
  const placeholder = (label: string) => <span className="invoice-placeholder">{label}</span>;
  return (
    <article className={`invoice-sheet${paymentRequest?' invoice-payment-request':''}`} style={{ '--invoice-accent': business.accent } as CSSProperties} aria-label={invoice ? `Invoice ${invoice.number}` : 'Invoice layout preview'}>
      {!invoice && <div className="invoice-proof">LAYOUT PREVIEW · NOT AN ISSUED INVOICE</div>}
      <header className="invoice-header">
        <div className="invoice-identity">
          {business.logoUrl ? <img className="invoice-logo" src={business.logoUrl} alt={`${business.businessName} logo`} /> : <div className="invoice-monogram" aria-hidden>M<span>V</span>M</div>}
          <div><p className="invoice-eyebrow">THE CREATIVE STUDIO</p><h1>{business.businessName}</h1><p className="invoice-preline">{business.address || placeholder('Business address from settings')}</p></div>
        </div>
        <div className="invoice-heading"><p className="invoice-eyebrow">BILLING DOCUMENT</p><h2>{invoice?.documentTitle ?? business.documentTitle}</h2><p className="invoice-number">{invoice?.number ?? placeholder('PREFIX / FINANCIAL YEAR / NUMBER')}</p><span className="invoice-status">{invoice?.paymentStatus ?? 'Unissued layout'}</span></div>
      </header>

      <section className="invoice-parties">
        <div><p className="invoice-eyebrow">BILLED TO</p><h3>{invoice?.client.name ?? placeholder('Client name from order')}</h3><p>{invoice?.client.email ?? placeholder('Client email')}</p>{invoice?.client.phone && <p>{invoice.client.phone}</p>}<p className="invoice-preline">{invoice?.client.address ?? placeholder('Client billing address')}</p></div>
        <dl className="invoice-meta"><div><dt>Issued</dt><dd>{invoice ? formatInvoiceDate(invoice.issuedAt) : placeholder('Date of issue')}</dd></div><div><dt>Order reference</dt><dd>{invoice?.orderPublicId ?? invoice?.orderId ?? placeholder('Order reference')}</dd></div><div><dt>Currency</dt><dd>INR</dd></div>{business.registrationValue && <div><dt>{business.registrationLabel || 'Registration'}</dt><dd>{business.registrationValue}</dd></div>}</dl>
      </section>

      <section className="invoice-project">
        <p className="invoice-eyebrow">YOUR PRODUCTION</p><h3>{invoice?.project ?? placeholder('Shoot or project title')}</h3>
        <div className="invoice-project-grid"><div><span>PACKAGE</span><p>{invoice?.plan || (invoice ? 'Custom agreement' : placeholder('Selected package / custom plan'))}</p></div><div><span>SHOOT DATE / SLOT</span><p>{invoice ? [invoice.shootDate, invoice.slot].filter(Boolean).join(' · ') || 'Not specified' : placeholder('Date · Morning / Evening / Night')}</p></div><div><span>LOCATION</span><p>{invoice?.location || (invoice ? 'Not specified' : placeholder('Confirmed shoot location'))}</p></div></div>
        {(invoice?.deliveryEstimate || !invoice) && <p className="invoice-delivery">Delivery estimate: {invoice?.deliveryEstimate ?? placeholder('Agreed delivery estimate')}</p>}
      </section>

      <table className="invoice-items"><thead><tr><th scope="col">Deliverables & services</th><th scope="col">Qty</th><th scope="col">Unit price</th><th scope="col">Amount</th></tr></thead><tbody>
        {invoice ? invoice.items.map((line, index) => <tr key={index}><td><span className="invoice-line-index">{String(index + 1).padStart(2, '0')}</span>{line.description}</td><td>{line.quantity}</td><td>{formatMoney(line.unitPaise)}</td><td>{formatMoney(line.linePaise)}</td></tr>) : <tr><td>{placeholder('Package items, reels, images, and selected add-ons')}</td><td>—</td><td>—</td><td>—</td></tr>}
      </tbody></table>

      <section className="invoice-settlement"><div className="invoice-scope">{paymentRequest&&receiving&&<section className="invoice-pay-details" aria-label="Payment QR and bank details"><p className="invoice-eyebrow">AMOUNT TO PAY</p><strong className="invoice-request-amount">{formatMoney(receiving.amountPaise)}</strong>{receiving.upiEnabled&&receiving.qrDataUrl&&<div className="invoice-qr-row"><img className="invoice-upi-qr" src={receiving.qrDataUrl} alt={`UPI payment QR for ${formatMoney(receiving.amountPaise)}`}/><div><strong>Scan with a UPI app</strong><p>{receiving.payeeName}</p><p className="invoice-payment-id">{receiving.upiId}</p><p>Amount is pre-filled.</p><a href={receiving.upiUri}>Open UPI app ↗</a></div></div>}{receiving.instructions&&<p className="invoice-preline">{receiving.instructions}</p>}<p className="invoice-payment-reminder">Verify the receiver name in your UPI app. Share the transaction reference with the studio after paying.</p></section>}<p className="invoice-eyebrow">AGREED SCOPE</p>{invoice?.invoiceNumber&&<p>Against invoice: {invoice.invoiceNumber}</p>}{invoice?.paymentPublicId&&<p>Payment ID: {invoice.paymentPublicId}</p>}{invoice?.reference&&<p>Reference: {invoice.reference}</p>}<p className="invoice-preline">{invoice?.inclusions || (invoice ? 'As detailed in the line items above.' : placeholder('Package inclusions and custom deliverables from the order'))}</p>{invoice?.note && <div className="invoice-note">{invoice.note}</div>}</div><div className="invoice-payment-summary"><dl className="invoice-totals"><div><dt>{refund?'Refund recorded':receipt?'Received this payment':'Subtotal'}</dt><dd>{invoice ? formatMoney(receipt ? invoice.receiptAmountPaise??0 : invoice.subtotalPaise) : '—'}</dd></div><div className="invoice-total"><dt>Invoice total</dt><dd>{invoice ? formatMoney(invoice.totalPaise) : '—'}</dd></div><div><dt>{refund?'Total payments received':receipt?'Received through this payment':'Payments recorded at issue'}</dt><dd>{invoice ? formatMoney(invoice.paidPaise) : '—'}</dd></div><div className="invoice-balance"><dt>{refund?'Total refunds to date':receipt?'Remaining balance':'Balance at issue'}</dt><dd>{invoice ? formatMoney(refund?invoice.refundedPaise??0:invoice.balancePaise) : '—'}</dd></div></dl>{paymentRequest&&receiving?.bankEnabled&&<div className="invoice-bank-details"><strong>{receiving.upiEnabled?'Bank transfer · if QR does not work':'Bank transfer'}</strong><p>Account holder: {receiving.accountHolder}</p><p>Bank: {receiving.bankName}</p><p>Account: <b>{receiving.accountNumber}</b></p><p>IFSC: <b>{receiving.ifsc}</b></p><p>{receiving.accountType==='savings'?'Savings':'Current'}{receiving.branch?` · ${receiving.branch}`:''}</p></div>}</div></section>

      <section className="invoice-bottom"><div><p className="invoice-eyebrow">TERMS & NOTES</p><p className="invoice-preline">{business.terms || (invoice ? 'Refer to your booking agreement for applicable terms.' : placeholder('Your configured invoice terms appear here.'))}</p></div><div className="invoice-signature"><p>{business.signatureName || business.businessName}</p><span>Authorised issuer</span></div></section>
      <footer className="invoice-footer"><p>{business.footer}</p><p>{[business.phone,business.secondaryPhone, business.email, business.website].filter(Boolean).join(' · ') || placeholder('Your configured contact details')}</p><span>MAHARASHTRA VISION MEDIA</span></footer>
    </article>
  );
}
