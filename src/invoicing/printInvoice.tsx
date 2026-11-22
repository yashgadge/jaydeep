import {invoiceHtml} from './invoiceHtml';
import type { Invoice } from './types';

export async function printInvoice(invoice: Invoice) {
  // An isolated print document avoids printing dashboard controls and keeps text selectable.
  const frame = document.createElement('iframe');
  frame.title = 'Invoice print document';
  frame.style.cssText = 'position:fixed;left:-10000px;top:0;width:900px;height:1200px;border:0';
  const html=invoiceHtml(invoice);
  const ready = new Promise<void>((resolve, reject) => {
    frame.onload = () => resolve();
    frame.onerror = () => reject(new Error('Unable to open invoice for printing.'));
  });
  frame.srcdoc = html;
  document.body.append(frame);
  try {
    await ready;
    const target = frame.contentWindow;
    if (!target) throw new Error('Print window is unavailable.');
    await target.document.fonts.ready;
    const imagesReady = Promise.all(Array.from(target.document.images).map(image => image.decode().catch(() => undefined)));
    // An unreachable optional logo must not prevent exporting the bill indefinitely.
    await Promise.race([imagesReady, new Promise(resolve => setTimeout(resolve, 5000))]);
    target.addEventListener('afterprint', () => frame.remove(), { once: true });
    target.focus();
    target.print();
    // Fallback for browsers without afterprint. Never run this before the dialog opens.
    setTimeout(() => frame.remove(), 300000);
  } catch (error) { frame.remove(); throw error; }
}
