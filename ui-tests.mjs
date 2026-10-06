import assert from 'node:assert/strict';
import { JSDOM } from 'jsdom';
import { indexedDB } from 'fake-indexeddb';
const dom = new JSDOM('<div id="app"></div>', { url: 'https://mdkstuff.github.io/Timesheet/' });
for (const name of ['window', 'document', 'localStorage', 'location']) globalThis[name] = dom.window[name];
Object.defineProperty(globalThis, 'navigator', { value: dom.window.navigator, configurable: true });
globalThis.indexedDB = indexedDB;
globalThis.confirm = () => true;
window.scrollTo = () => {};
const vault = await import('./vault.js');
const { initialState } = await import('./data.js');
await vault.unlockVault('mdk-test-password', initialState());
await import('./app.js');
const $ = selector => document.querySelector(selector);
const click = async selector => { assert.ok($(selector), `Missing element ${selector}`); $(selector).click(); await new Promise(resolve => setTimeout(resolve, 0)); };
const input = (selector, value) => { const node = $(selector); assert.ok(node, `Missing input ${selector}`); node.value = value; node.dispatchEvent(new window.Event('input', { bubbles: true })); return node; };
async function until(check) { for (let i = 0; i < 300; i++) { if (check()) return; await new Promise(resolve => setTimeout(resolve, 10)); } throw new Error('Timed out waiting for UI operation'); }
await click('[data-new="quotes"]'); await click('[data-add="items"]');
const costInput = input('[data-path="items.0.unitCost"]', '12.50');
input('[data-path="items.0.quantity"]', '2.5');
assert.equal($('[data-extension="0"]').value, '$31.25');
assert.equal($('[data-path="items.0.unitCost"]'), costInput, 'Typing must not recreate the active input');
input('[data-path="items.0.unitCost"]', '0');
assert.equal($('[data-extension="0"]').value, '$0.00');
input('[data-path="items.0.unitCost"]', '10');
await click('[data-action="save-record"]');
await until(() => vault.privateData().history?.length === 1);
await click('[data-nav="workOrders"]'); await click('[data-new="workOrders"]'); await click('[data-add="materials"]');
input('[data-path="materials.0.unitCost"]', '20'); input('[data-path="materials.0.quantity"]', '3');
assert.equal($('[data-extension="0"]').value, '$60.00');
await click('[data-add="labour"]'); input('[data-path="labour.0.hours"]', '2'); input('[data-path="labour.0.hourlyRate"]', '105');
assert.equal(document.querySelectorAll('[data-extension="0"]')[1].value, '$210.00');
input('[data-path="customerDetails.name"]', 'Manual contact'); // New and legacy orders support manual address entry.
await click('[data-nav="customers"]'); await click('[data-owner="new-customer"]');
input('[data-customer-field="company"]', 'Private Test Company'); input('[data-customer-field="name"]', 'Owner contact');
input('[data-customer-field="phone"]', '905-555-0101'); input('[data-customer-field="email"]', 'private@example.test');
input('[data-customer-field="addressLine1"]', '12 Main Street');
await click('[data-owner="save-customer"]');
await until(() => !document.querySelector('[data-owner="save-customer"]'));
const customer = vault.privateData().customers[0];
assert.equal(customer.company, 'Private Test Company');
await click('[data-nav="quotes"]'); await click('[data-new="quotes"]');
$('[data-customer-picker]').value = customer.id;
$('[data-customer-picker]').dispatchEvent(new window.Event('change', { bubbles: true }));
assert.equal($('[data-path="billedTo.email"]').value, 'private@example.test');
input('[data-path="billedTo.name"]', 'Override contact');
assert.equal(vault.privateData().customers[0].name, 'Owner contact');
await click('[data-nav="workOrders"]'); await click('[data-new="workOrders"]');
$('[data-customer-picker]').value = customer.id;
$('[data-customer-picker]').dispatchEvent(new window.Event('change', { bubbles: true }));
assert.equal($('[data-path="customerDetails.phone"]').value, '905-555-0101');
assert.equal($('[data-path="customer"]').value, 'Private Test Company');

const state = JSON.parse(localStorage.getItem('mdk-field-web-v1'));
const envelope = await vault.saveVault(state);
assert.ok(!JSON.stringify(envelope).includes('Private Test Company'));
const encrypted = structuredClone(envelope);
encrypted.ciphertext = encrypted.ciphertext.slice(0, -4) + 'AAAA';
await assert.rejects(vault.decryptEnvelope(encrypted, 'mdk-test-password'));
vault.lockVault();
await assert.rejects(vault.unlockVault('wrong-password', state), /Incorrect/);
assert.equal(vault.isUnlocked(), false);
await vault.unlockVault('mdk-test-password', state);
assert.equal(vault.privateData().customers[0].email, 'private@example.test');
await assert.rejects(vault.restoreEnvelope(envelope, 'wrong-password'), /Incorrect/);
assert.equal(vault.privateData().customers[0].name, 'Owner contact');

// Mock remote transport to test encryption, denied-owner handling and cloud recovery.
const files = new Map(); const owner = '11111111-1111-4111-8111-111111111111';
let permit = false;
globalThis.fetch = async (url, options) => {
  const path = new URL(url).pathname;
  if (path === '/auth/v1/token') return Response.json({ access_token: 'test-session', refresh_token: 'test-refresh', expires_in: 3600, user: { id: owner } });
  assert.equal(new Headers(options.headers).get('Authorization'), 'Bearer test-session');
  if (path === '/rest/v1/mdk_owners') return Response.json(permit ? [{ user_id: owner }] : []);
  if (path.startsWith('/storage/v1/object/authenticated/mdk-private/')) {
    const name = decodeURIComponent(path.split('/authenticated/mdk-private/')[1]);
    assert.ok(files.has(name)); return new Response(files.get(name), { headers: { 'content-type': 'application/json' } });
  }
  if (path.startsWith('/storage/v1/object/mdk-private/')) {
    const name = decodeURIComponent(path.split('/object/mdk-private/')[1]);
    const body = JSON.parse(options.body);
    assert.equal(body.format, 'mdk-private-v1');
    assert.ok(!options.body.includes('Private Test Company'));
    if (files.has(name)) return Response.json({ error: 'Duplicate' }, { status: 409 });
    files.set(name, options.body); return Response.json({ Key: name });
  }
  throw new Error(`Unexpected remote call ${url}`);
};
assert.throws(() => vault.configureCloud('https://test.supabase.co', 'sb_secret_nope'), /never a secret/);
vault.configureCloud('https://test.supabase.co', 'sb_publishable_test');
await assert.rejects(vault.cloudLogin('owner@example.test', 'password'), /not the MDK owner/);
assert.equal(vault.cloudConnected(), false);
permit = true; await vault.cloudLogin('owner@example.test', 'password');
await vault.archivePdf('quotes', { id: 'quote-id', number: 'Q-1' }, new Blob(['pdf-content']), 'Q-1.pdf');
await vault.saveVault(state);
await vault.uploadBackup(); await vault.uploadBackup();
assert.equal([...files.keys()].filter(name => name.endsWith('.mdkpdf')).length, 1, 'PDF versions must not be duplicated in every cloud snapshot');
const backupName = [...files.keys()].filter(name => name.endsWith('.mdkbackup')).at(-1).split('/').at(-1);
const cloudEnvelope = await vault.readCloudBackup(backupName);
const manifest = (await vault.decryptEnvelope(cloudEnvelope, 'mdk-test-password')).data;
assert.equal(manifest.pdfs[0].content, undefined, 'Cloud snapshots reference encrypted PDF files');
assert.ok(manifest.pdfs[0].cloudPath.startsWith(`${owner}/quotes/`));
await vault.restoreEnvelope(cloudEnvelope, 'mdk-test-password', true);
assert.equal(new TextDecoder().decode(vault.fromBase64(vault.privateData().pdfs[0].content)), 'pdf-content');
vault.cloudLogout(); assert.equal(vault.cloudConnected(), false);

await click('[data-nav="customers"]'); await click('[data-owner="lock"]');
assert.ok(!document.body.textContent.includes('Private Test Company'), 'Locked customer list must not expose contacts');
await click('[data-nav="quotes"]'); await click('[data-new="quotes"]'); await click('[data-action="save-record"]');
assert.ok($('[data-vault-password]'), 'Save must require unlocking the private archive');
input('[data-vault-password]', 'mdk-test-password'); await click('[data-owner="unlock"]');
await until(() => Boolean(document.querySelector('[data-action="save-record"]')));
assert.ok($('[data-action="save-record"]'), 'Unlock must preserve and reopen the unsaved document');
console.log('Live row amounts, customer autofill, encryption, owner checks and cloud recovery tests passed.');
