import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import vm from 'node:vm';
import { defaultSettings, makeQuote, makeWorkOrder } from './data.js';
import { applyCustomer, newCustomer } from './customers.js';
import { makePdf } from './pdf.js';

const customer = { ...newCustomer(), name: 'Kevin Contact', company: 'Test Company', addressLine1: '12 Main Street', city: 'Toronto', provinceState: 'ON', postalCode: 'A1B 2C3', phone: '905-555-0101', email: 'contact@example.test', customerID: 'C-100' };
const quote = makeQuote(defaultSettings);
applyCustomer('quotes', quote, customer);
assert.equal(quote.billedTo.email, customer.email);
assert.equal(quote.customerID, 'C-100');
quote.billedTo.name = 'Different contact';
assert.equal(customer.name, 'Kevin Contact', 'Document overrides must not edit the customer');
const workOrder = makeWorkOrder(defaultSettings);
applyCustomer('workOrders', workOrder, customer);
assert.equal(workOrder.customerDetails.phone, customer.phone);
assert.equal(workOrder.customer, customer.company);

// Use the actual vendored PDF library and intercept text coordinates/widths.
const context = { exports: {}, console, TextEncoder, TextDecoder, Uint8Array, ArrayBuffer, atob, btoa };
vm.runInNewContext(readFileSync(new URL('./vendor/jspdf.umd.min.js', import.meta.url), 'utf8'), context);
const JsPDF = context.jspdf.jsPDF;
assert.equal(typeof JsPDF, 'function');
let printed;
globalThis.jspdf = { jsPDF: function(options) {
  const pdf = new JsPDF(options); printed = [];
  const text = pdf.text.bind(pdf);
  pdf.text = (value, x, y, options) => {
    printed.push({ value, x, y, options, widths: (Array.isArray(value) ? value : [value]).map(line => pdf.getTextWidth(line)), page: pdf.getCurrentPageInfo().pageNumber });
    return text(value, x, y, options);
  };
  return pdf;
} };
globalThis.__MDK_PDF_LOGO__ = `data:image/jpeg;base64,${readFileSync(new URL('./assets/mdk-logo.jpg', import.meta.url)).toString('base64')}`;
quote.items = [{ quantity: 2.5, unitCost: 35.75, description: ('Long electrical item description ' + 'W'.repeat(180) + '\n').repeat(45) }];
const result = await makePdf('quotes', quote, defaultSettings);
assert.ok(result.pdf.getNumberOfPages() > 2, 'Extremely long descriptions should continue onto other pages');
const descriptionRuns = printed.filter(run => Array.isArray(run.value) && run.x === 10.5 && run.value.some(line => line.includes('electrical') || line.includes('WW')));
assert.ok(descriptionRuns.length >= 2);
const columnWidth = (215.9 - 17) * 105 / 193 - 4;
for (const run of descriptionRuns) {
  assert.ok(run.widths.every(width => width <= columnWidth + 0.05), 'Description must stay within its own column');
  const lastBaseline = run.y + (run.value.length - 1) * 3.45;
  assert.ok(lastBaseline < 262, 'Description must not run through page footer');
}
assert.ok(printed.some(run => String(run.value).includes('89.38')), 'Amounts should stay in the PDF');
console.log('Customer overrides and multi-page PDF layout tests passed.');
