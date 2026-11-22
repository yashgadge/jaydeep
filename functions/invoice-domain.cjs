const MAX_PAISE = 100_000_000;

function text(value, label, max = 500, required = false) {
  if (typeof value !== 'string' || value.length > max || (required && !value.trim())) {
    throw new Error(`Invalid ${label}.`);
  }
  return value.trim();
}

function money(value, label) {
  if (!Number.isSafeInteger(value) || value < 0 || value > MAX_PAISE) {
    throw new Error(`Invalid ${label}; use non-negative integer paise.`);
  }
  return value;
}

function validateSettings(input) {
  const fields = {
    businessName: [100, true], address: [700, true], phone: [50, true], secondaryPhone: [50, false],
    email: [150, false], website: [200, false], registrationLabel: [80, false],
    registrationValue: [100, false], footer: [1000, false], terms: [2500, false],
    signatureName: [100, false], documentTitle: [60, true],
  };
  const result = {};
  for (const [key, [max, required]] of Object.entries(fields)) {
    result[key] = text(input[key] ?? '', key, max, required);
  }
  result.prefix = text(input.prefix, 'invoice prefix', 12, true).toUpperCase();
  if (!/^[A-Z0-9-]+$/.test(result.prefix)) throw new Error('Use letters, digits, or hyphens in the prefix.');
  result.accent = text(input.accent, 'accent colour', 7, true);
  if (!/^#[a-f\d]{6}$/i.test(result.accent)) throw new Error('Invalid accent colour.');
  result.logoUrl = text(input.logoUrl ?? '', 'logo URL', 500);
  if (result.logoUrl) {
    const url = new URL(result.logoUrl);
    if (url.protocol !== 'https:') throw new Error('Logo must use HTTPS.');
  }
  if (typeof input.bypassEnabled !== 'boolean') throw new Error('Specify payment bypass mode.');
  result.bypassEnabled = input.bypassEnabled;
  return result;
}

function financialYear(iso) {
  const parts = new Intl.DateTimeFormat('en-IN', {
    timeZone: 'Asia/Kolkata', year: 'numeric', month: 'numeric',
  }).formatToParts(new Date(iso));
  const year = Number(parts.find(p => p.type === 'year').value);
  const month = Number(parts.find(p => p.type === 'month').value);
  const start = month >= 4 ? year : year - 1;
  return `${start}-${String(start + 1).slice(-2)}`;
}

function buildInvoice(order, settings, number, issuedAt) {
  if (!order || typeof order.clientUid !== 'string' || !order.clientUid) throw new Error('Order has no client.');
  if (!Array.isArray(order.items) || order.items.length < 1 || order.items.length > 100) {
    throw new Error('Order requires between 1 and 100 line items.');
  }
  if (!['online', 'offline', 'bypass'].includes(order.paymentMode)) throw new Error('Invalid payment mode.');
  const bypass = order.paymentMode === 'bypass';
  if (bypass && !settings.bypassEnabled) throw new Error('Bypass mode is disabled.');
  const items = order.items.map(item => {
    if (!Number.isSafeInteger(item.quantity) || item.quantity < 1 || item.quantity > 10000) {
      throw new Error('Invalid quantity.');
    }
    const unitPaise = money(item.unitPaise, 'unit price');
    money(unitPaise * item.quantity, 'line total');
    return {
      description: text(item.description, 'line description', 500, true),
      quantity: item.quantity,
      unitPaise: bypass ? 0 : unitPaise,
      linePaise: bypass ? 0 : unitPaise * item.quantity,
    };
  });
  const subtotalPaise = money(items.reduce((sum, item) => sum + item.linePaise, 0), 'subtotal');
  const agreedTotalPaise = money(order.items.reduce((sum, item) => sum + item.unitPaise * item.quantity, 0), 'agreed total');
  const paidPaise = money(order.paidPaise ?? 0, 'recorded payments');
  if (bypass && paidPaise !== 0) throw new Error('Cannot issue a zero-value bypass invoice for an order with recorded payments.');
  if (paidPaise > subtotalPaise) throw new Error('Recorded payments exceed the invoice total.');
  return {
    number, issuedAt, currency: 'INR', clientUid: order.clientUid,
    client: {
      name: text(order.client?.name, 'client name', 150, true),
      email: text(order.client?.email ?? '', 'client email', 150),
      phone: text(order.client?.phone ?? '', 'client phone', 50),
      address: text(order.client?.address ?? '', 'client address', 700),
    },
    project: text(order.title, 'order title', 200, true),
    shootDate: text(order.shootDate ?? '', 'shoot date', 40),
    slot: text(order.slot ?? '', 'slot', 30),
    location: text(order.location ?? '', 'shoot location', 700),
    plan: text(order.plan ?? '', 'package', 200),
    deliveryEstimate: text(order.deliveryEstimate ?? '', 'delivery estimate', 200),
    inclusions: text(order.inclusions ?? '', 'inclusions', 5000),
    items, subtotalPaise, totalPaise: subtotalPaise, paidPaise,
    balancePaise: subtotalPaise - paidPaise,
    paymentMode: order.paymentMode,
    paymentStatus: bypass ? 'No charge' : paidPaise === subtotalPaise ? 'Paid' : paidPaise > 0 ? 'Partially paid' : 'Unpaid',
    note: bypass ? 'Payment bypass applied. This invoice has a zero billed value; no payment was collected.' : '',
    business: { ...settings },
    // Internal audit value: deliberately excluded from client-facing invoice rendering.
    agreedTotalPaise,
  };
}

module.exports = { validateSettings, financialYear, buildInvoice };
