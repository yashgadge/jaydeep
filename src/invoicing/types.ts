export interface InvoiceSettings {
  businessName: string;
  address: string;
  phone: string;
  secondaryPhone: string;
  email: string;
  website: string;
  registrationLabel: string;
  registrationValue: string;
  prefix: string;
  accent: string;
  logoUrl: string;
  signatureName: string;
  documentTitle: string;
  footer: string;
  terms: string;
  bypassEnabled: boolean;
}

export interface Invoice {
  paymentRequestAmountPaise?:number;
  paymentReceiving?:{upiEnabled:boolean;upiId:string;payeeName:string;bankEnabled:boolean;accountHolder:string;bankName:string;accountNumber:string;ifsc:string;branch:string;accountType:string;instructions:string;amountPaise:number;upiUri:string;qrDataUrl:string};
  documentType?: string;
  documentTitle?: string;
  receiptAmountPaise?: number;
  refundedPaise?: number;
  invoiceNumber?: string;
  paymentPublicId?: string;
  reference?: string;
  orderPublicId?: string;
  id: string;
  orderId: string;
  number: string;
  issuedAt: string;
  clientUid: string;
  client: { name: string; email: string; phone: string; address: string };
  business: InvoiceSettings;
  project: string;
  plan: string;
  shootDate: string;
  slot: string;
  location: string;
  deliveryEstimate: string;
  inclusions: string;
  items: Array<{ description: string; quantity: number; unitPaise: number; linePaise: number }>;
  subtotalPaise: number;
  totalPaise: number;
  paidPaise: number;
  balancePaise: number;
  paymentMode: 'online' | 'offline' | 'bypass';
  paymentStatus: string;
  note: string;
}

// Initial form values are configuration defaults, not issued invoices or fictitious records.
export const initialInvoiceSettings: InvoiceSettings = {
  businessName: 'Maharashtra Vision Media', address: '', phone: '', secondaryPhone:'', email: '', website: '',
  registrationLabel: '', registrationValue: '', prefix: 'MVM', accent: '#c81d38',
  logoUrl: '', signatureName: '', documentTitle: 'Invoice',
  footer: 'Thank you for creating with Maharashtra Vision Media.', terms: '', bypassEnabled: false,
};

export const formatMoney = (paise: number) => new Intl.NumberFormat('en-IN', {
  style: 'currency', currency: 'INR', minimumFractionDigits: 2,
}).format(paise / 100);

export const formatInvoiceDate = (iso: string) => new Intl.DateTimeFormat('en-IN', {
  dateStyle: 'medium', timeZone: 'Asia/Kolkata',
}).format(new Date(iso));
