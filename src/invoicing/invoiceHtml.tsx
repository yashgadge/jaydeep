import {renderToStaticMarkup} from 'react-dom/server';
import InvoiceDocument from './InvoiceDocument';
import type {Invoice} from './types';
import css from './invoice.css?raw';
import fonts from './invoice-font.css?raw';
// Shared by browser Print and the server PDF renderer; keep no second invoice layout.
export function invoiceHtml(invoice:Invoice){
 const markup=renderToStaticMarkup(<InvoiceDocument invoice={invoice}/>);
 const title=invoice.number.replace(/[^a-zA-Z0-9/-]/g,'');
 return `<!doctype html><html><head><meta charset="utf-8"><title>${title}</title><style>${fonts}\n${css}</style></head><body>${markup}</body></html>`;
}
