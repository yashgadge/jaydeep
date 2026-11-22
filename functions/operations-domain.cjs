const DAY = 86400000;
const DEFAULT_WHATSAPP_SETTINGS = Object.freeze({
  enabled: false, automatedEnabled: false, marketingEnabled: false,
  dailyMessageLimit: 30, monthlyBudgetPaise: 50000, perClientDailyLimit: 2,
  minimumUpdateHours: 4, marketingCooldownDays: 30, maxCampaignRecipients: 50,
  utilityCostPaise: 12, marketingCostPaise: 87, serviceCostPaise: 12,
  bookingConfirmation: true, paymentUpdate: false, shootReminder: true,
  deliveryReady: true, balanceReminder: false, renewalReminder: false,
});
const PERMISSIONS = ['invoiceManage', 'contactsManage', 'whatsappSend', 'clientsExport', 'paymentsManage', 'ordersManage', 'calendarManage', 'servicesManage', 'contentManage', 'deliveriesManage', 'tasksManage'];
const string = (value, label, max = 200, required = false) => {
  if (typeof value !== 'string' || value.length > max || (required && !value.trim())) throw new Error(`Invalid ${label}.`);
  return value.trim();
};
const integer = (value, min, max, label) => {
  if (!Number.isSafeInteger(value) || value < min || value > max) throw new Error(`Invalid ${label}.`);
  return value;
};
function phone(value) {
  const cleaned = string(value, 'WhatsApp number', 40).replace(/[\s()-]/g, '');
  if (!cleaned) return '';
  const normalized = /^\d{10}$/.test(cleaned) ? `+91${cleaned}` : cleaned;
  if (!/^\+[1-9]\d{7,14}$/.test(normalized)) throw new Error('Enter a valid WhatsApp number with country code.');
  return normalized;
}
function validateWhatsAppSettings(input) {
  const result = {};
  for (const [key, initial] of Object.entries(DEFAULT_WHATSAPP_SETTINGS)) {
    if (typeof initial === 'boolean') {
      if (typeof input[key] !== 'boolean') throw new Error(`Specify ${key}.`);
      result[key] = input[key];
    }
  }
  const bounds = {
    dailyMessageLimit: [0, 1000], monthlyBudgetPaise: [0, 10000000], perClientDailyLimit: [0, 10],
    minimumUpdateHours: [0, 168], marketingCooldownDays: [1, 365], maxCampaignRecipients: [1, 100],
    utilityCostPaise: [1, 10000], marketingCostPaise: [1, 10000], serviceCostPaise: [1, 10000],
  };
  for (const [key, [min, max]] of Object.entries(bounds)) result[key] = integer(input[key], min, max, key);
  return result;
}
function validateContact(input) {
  return {
    name: string(input.name, 'client name', 150, true), businessName: string(input.businessName ?? '', 'business name', 150),
    email: string(input.email ?? '', 'email', 150), phone: phone(input.phone ?? ''),
    city: string(input.city ?? '', 'city', 100), address: string(input.address ?? '', 'address', 700),
    instagram: string(input.instagram ?? '', 'Instagram handle', 200), serviceType: string(input.serviceType ?? '', 'service type', 100),
    tags: string(input.tags ?? '', 'tags', 500), notes: string(input.notes ?? '', 'notes', 1500),
  };
}
function consent(input) {
  if (typeof input.updatesOptIn !== 'boolean' || typeof input.marketingOptIn !== 'boolean') throw new Error('Choose your WhatsApp preferences.');
  return { updatesOptIn: input.updatesOptIn, marketingOptIn: input.marketingOptIn };
}
function validateFilters(input = {}) {
  const result = {};
  for (const field of ['search', 'city', 'serviceType', 'source', 'consent', 'from', 'to', 'method', 'clientUid']) {
    result[field] = string(input[field] ?? '', field, field === 'search' ? 200 : 128);
  }
  for (const date of [result.from, result.to]) if (date && (!/^\d{4}-\d{2}-\d{2}$/.test(date) || !Number.isFinite(Date.parse(`${date}T00:00:00+05:30`)))) throw new Error('Invalid date filter.');
  if (result.from && result.to && result.from > result.to) throw new Error('Start date must precede end date.');
  if (result.source && !['registered', 'manual'].includes(result.source)) throw new Error('Invalid source.');
  if (result.consent && !['updates', 'marketing', 'none'].includes(result.consent)) throw new Error('Invalid consent filter.');
  return result;
}
function matches(record, filters) {
  const f = filters;
  const day = record.createdAtISO ? new Intl.DateTimeFormat('en-CA', { timeZone: 'Asia/Kolkata', year: 'numeric', month: '2-digit', day: '2-digit' }).format(new Date(record.createdAtISO)) : '';
  if ((f.from && (!day || day < f.from)) || (f.to && (!day || day > f.to))) return false;
  if (f.search && ![record.name, record.businessName, record.email, record.phone, record.tags, record.orderId, record.reference, record.clientName].some(value => String(value ?? '').toLowerCase().includes(f.search.toLowerCase()))) return false;
  for (const field of ['city', 'serviceType', 'source', 'method', 'clientUid']) if (f[field] && String(record[field] ?? '').toLowerCase() !== f[field].toLowerCase()) return false;
  if (f.consent === 'updates' && !record.updatesOptIn) return false;
  if (f.consent === 'marketing' && !record.marketingOptIn) return false;
  if (f.consent === 'none' && (record.marketingOptIn || record.updatesOptIn)) return false;
  return true;
}
function validateMessage(input) {
  const category = string(input.category, 'message category', 20, true);
  if (!['utility', 'marketing', 'service'].includes(category)) throw new Error('Invalid message category.');
  const text = string(input.text ?? '', 'message text', 3000, category === 'service');
  const templateId = string(input.templateId ?? '', 'template', 128, category !== 'service');
  if (!Array.isArray(input.parameters) || input.parameters.length > 20) throw new Error('Invalid template parameters.');
  return { category, text, templateId, parameters: input.parameters.map(value => string(value, 'template parameter', 1000, true)) };
}
function recipientReason(contact, message, settings, state = {}, now = Date.now()) {
  if (!contact?.phone) return 'No WhatsApp number';
  if (state.blocked) return 'WhatsApp opted out';
  if (message.category === 'marketing' ? !contact.marketingOptIn : !contact.updatesOptIn) return 'Consent not given';
  if (message.category === 'marketing' && !settings.marketingEnabled) return 'Promotions paused';
  if (settings.perClientDailyLimit === 0) return 'Client daily limit';
  if (message.category === 'service' && (!state.lastInboundAtMs || now - state.lastInboundAtMs >= DAY)) return 'Customer-service window closed';
  if (message.category === 'marketing' && state.lastMarketingAtMs && now - state.lastMarketingAtMs < settings.marketingCooldownDays * DAY) return 'Promotional frequency limit';
  if (message.category !== 'marketing' && state.lastSentAtMs && now - state.lastSentAtMs < settings.minimumUpdateHours * 3600000) return 'Update frequency limit';
  const today = new Intl.DateTimeFormat('en-CA', { timeZone: 'Asia/Kolkata', year: 'numeric', month: '2-digit', day: '2-digit' }).format(new Date(now));
  if (state.day === today && state.count >= settings.perClientDailyLimit) return 'Client daily limit';
  return '';
}
function orderBalance(order) {
  if (!Array.isArray(order.items) || !order.items.length) throw new Error('Order line items are missing.');
  const agreed = order.items.reduce((sum, line) => sum + integer(line.quantity, 1, 10000, 'quantity') * integer(line.unitPaise, 0, 100000000, 'price'), 0);
  const totalPaise = order.paymentMode === 'bypass' ? 0 : integer(order.billedTotalPaise ?? agreed, 0, 100000000, 'order total');
  const paidPaise = integer(order.paidPaise ?? 0, 0, totalPaise, 'recorded payments');
  return { totalPaise, paidPaise, balancePaise: totalPaise - paidPaise };
}
module.exports = { DEFAULT_WHATSAPP_SETTINGS, PERMISSIONS, string, integer, phone, validateContact, consent, validateWhatsAppSettings, validateFilters, matches, validateMessage, recipientReason, orderBalance };
