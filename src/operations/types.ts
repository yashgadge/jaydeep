export interface OperationsRole {
  owner: boolean; invoiceManage: boolean; contactsManage: boolean;
  whatsappSend: boolean; clientsExport: boolean; paymentsManage: boolean;
}
export interface Contact {
  publicId?: string;
  id: string; clientUid: string; name: string; businessName: string; email: string; phone: string;
  city: string; address: string; instagram: string; serviceType: string; tags: string; notes: string;
  source: string; updatesOptIn: boolean; marketingOptIn: boolean;
  consentSource: string; consentAtISO: string; consentEvidence: string; createdAtISO: string; updatedAtISO: string;
}
export type ContactForm = Pick<Contact, 'name'|'businessName'|'email'|'phone'|'city'|'address'|'instagram'|'serviceType'|'tags'|'notes'|'updatesOptIn'|'marketingOptIn'|'consentEvidence'>;
export const blankContact: ContactForm = { name:'',businessName:'',email:'',phone:'',city:'',address:'',instagram:'',serviceType:'',tags:'',notes:'',updatesOptIn:false,marketingOptIn:false,consentEvidence:'' };
export interface Filters { search:string; city:string; serviceType:string; source:string; consent:string; from:string; to:string; method:string; clientUid:string }
export const blankFilters: Filters = { search:'',city:'',serviceType:'',source:'',consent:'',from:'',to:'',method:'',clientUid:'' };
export interface Page<T> { rows:T[]; scanned:number; cursor:string|null }
export interface WhatsAppSettings {
  enabled:boolean; automatedEnabled:boolean; marketingEnabled:boolean;
  dailyMessageLimit:number; monthlyBudgetPaise:number; perClientDailyLimit:number;
  minimumUpdateHours:number; marketingCooldownDays:number; maxCampaignRecipients:number;
  utilityCostPaise:number; marketingCostPaise:number; serviceCostPaise:number;
  bookingConfirmation:boolean; paymentUpdate:boolean; shootReminder:boolean; deliveryReady:boolean; balanceReminder:boolean; renewalReminder:boolean;
  providerConfigured?:boolean;
}
export interface Template { id:string; name:string; body:string; language:string; category:string; headerFormat?:string;parameterCount:number }
export interface WhatsAppAdmin { settings:WhatsAppSettings; dailyReserved:number; monthlyReservedPaise:number; templates:Template[] }
export interface Message { category:'utility'|'marketing'|'service'; templateId:string; text:string; parameters:string[] }
export interface CampaignPreview { previewId:string; recipients:Array<{contactId:string;name:string;eligible:boolean;reason:string}>; estimatePaise:number; masterEnabled:boolean; providerConfigured:boolean; expiresAtMs:number }
export interface Payment { id:string; publicId?:string; receiptDocumentId?:string; orderId:string; clientUid:string; clientName:string; amountPaise:number; method:string; reference:string; notes:string; status:string; provider:string; receivedAtISO:string; createdAtISO:string }
export interface OrderBalance { id:string; title:string; clientName:string; clientUid:string; totalPaise?:number; paidPaise?:number; balancePaise?:number }

export function rupeesToPaise(value:string) {
  if (!/^\d+(\.\d{1,2})?$/.test(value.trim())) throw new Error('Enter an amount with no more than two decimal places.');
  const [whole, fraction=''] = value.trim().split('.');
  const paise = Number(whole)*100 + Number(fraction.padEnd(2,'0'));
  if (!Number.isSafeInteger(paise) || paise < 1 || paise > 100000000) throw new Error('Enter a valid positive payment amount.');
  return paise;
}
