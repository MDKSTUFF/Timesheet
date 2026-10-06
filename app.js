import {
  displayDate, loadState, makeQuote, makeTimesheet, makeWorkOrder, money,
  newExpense, newLabour, newMaterial, newQuoteItem, persist, quoteTotals, setPath,
  timesheetTotals, validateBackup, workOrderTotals,
} from "./data.js";
import { makePdf } from "./pdf.js";
import {
  archivePdf, archiveRecord, cloudConfig, cloudConnected, cloudLogin, cloudLogout, configureCloud,
  downloadBlob, downloadEnvelope, fromBase64, hasVault, isUnlocked, listCloudBackups,
  lockVault, privateData, readCloudBackup, restoreEnvelope, saveVault, unlockVault,
  uploadBackup, uploadCloudRecord,
} from "./vault.js";
import { applyCustomer, newCustomer } from "./customers.js";

const app = document.querySelector("#app");
let state = loadState();
let toastTimer;
let installPrompt;
const ui = { view: "dashboard", editingType: null, editing: null, search: "", customer: null, cloudBackups: [], cloudStatus: "", vaultExists: false };
let privateBusy = false;

const typeConfig = {
  workOrders: { label: "Work Orders", singular: "Work Order", icon: "🛠", primary: doc => doc.customer || "No customer", date: doc => doc.date },
  timesheets: { label: "Timesheets", singular: "Timesheet", icon: "◷", primary: doc => doc.employee || "No employee", date: doc => doc.weekEnding },
  quotes: { label: "Quotes", singular: "Quote", icon: "▤", primary: doc => doc.billedTo?.name || doc.billedTo?.company || "No customer", date: doc => doc.date },
};

const icons = { dashboard: "⌂", workOrders: "🛠", timesheets: "◷", quotes: "▤", customers: "♙", backups: "▣", more: "•••" };
const navItems = [
  ["dashboard", "Dashboard"], ["workOrders", "Work Orders"], ["timesheets", "Timesheets"], ["quotes", "Quotes"], ["customers", "Customers"], ["backups", "Backups"], ["more", "More"],
];

function esc(value) {
  return String(value ?? "").replace(/[&<>'"]/g, char => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", "'": "&#39;", '"': "&quot;" })[char]);
}

function clone(value) { return structuredClone(value); }
function count() { return state.workOrders.length + state.timesheets.length + state.quotes.length; }
function number(value) { return Number(value) || 0; }
function percent(value) { return `${(number(value) * 100).toFixed(1)}%`; }

function isoDayNumber(value) {
  const parts = String(value || "").split("-").map(Number);
  if (parts.length !== 3 || parts.some(part => !Number.isFinite(part))) return NaN;
  return Date.UTC(parts[0], parts[1] - 1, parts[2]) / 86_400_000;
}

function shiftIsoDate(value, days) {
  const dayNumber = isoDayNumber(value);
  if (!Number.isFinite(dayNumber)) return value;
  return new Date((dayNumber + days) * 86_400_000).toISOString().slice(0, 10);
}

function shiftTimesheetWeek(doc, oldWeekEnding, newWeekEnding) {
  const difference = Math.round(isoDayNumber(newWeekEnding) - isoDayNumber(oldWeekEnding));
  if (!Number.isFinite(difference) || difference === 0) return;
  doc.entries.forEach(entry => { entry.date = shiftIsoDate(entry.date, difference); });
}

function navButton(view, label, side = false) {
  const active = ui.view === view && !ui.editing;
  return `<button class="nav-button${active ? " active" : ""}" data-nav="${view}" aria-label="${label}"${active ? ' aria-current="page"' : ""}>
    <span class="icon" aria-hidden="true">${icons[view]}</span><span>${side ? label : label.replace("Work Orders", "Orders").replace("Timesheets", "Time")}</span>
  </button>`;
}

function shell(content) {
  return `<div class="shell">
    <aside class="sidebar" aria-label="Main navigation">
      <div class="side-brand"><div><strong>MDK Field</strong><small>MDK ELECTRIC</small></div></div>
      <nav class="side-nav">${navItems.map(([view, label]) => navButton(view, label, true)).join("")}</nav>
      <div class="side-foot">Private browser storage<br><span id="connection-status">${navigator.onLine ? "Online" : "Offline ready"}</span></div>
    </aside>
    <main class="main" id="main">
      ${ui.editing ? "" : `<header class="topbar"><div><div class="eyebrow">MDK ELECTRIC</div><h1>${esc(pageTitle())}</h1></div><div class="topbar-actions">${installPrompt ? '<button class="button ghost" data-action="install">Install</button>' : ""}</div></header>`}
      ${content}
    </main>
    <nav class="bottom-nav" aria-label="Main navigation">${navItems.map(([view, label]) => navButton(view, label)).join("")}</nav>
  </div>`;
}

function pageTitle() {
  if (ui.view === "dashboard") return greeting();
  return typeConfig[ui.view]?.label || ({ more: "More", customers: "Customers", backups: "Private backups" }[ui.view]) || "MDK Field";
}

function greeting() {
  const hour = new Date().getHours();
  return `Good ${hour < 12 ? "morning" : hour < 17 ? "afternoon" : "evening"}`;
}

function render() {
  const content = ui.editing ? renderEditor() : ui.view === "dashboard" ? dashboard() : typeConfig[ui.view] ? listPage(ui.view) : ui.view === "customers" ? customersPage() : ui.view === "backups" ? backupsPage() : morePage();
  app.innerHTML = shell(content);
  document.title = ui.editing ? `${ui.editing.number} • MDK Field` : `${pageTitle()} • MDK Field`;
}

function dashboard() {
  const recent = [
    ...state.workOrders.map(doc => ({ type: "workOrders", doc })),
    ...state.timesheets.map(doc => ({ type: "timesheets", doc })),
    ...state.quotes.map(doc => ({ type: "quotes", doc })),
  ].sort((a, b) => String(b.doc.modifiedAt).localeCompare(String(a.doc.modifiedAt))).slice(0, 7);

  return `<section class="hero card">
      <div class="hero-copy"><div class="eyebrow">FIELD DOCUMENTS</div><h2>Ready when the job is.</h2><p class="muted">Create, save, download, and share branded documents from any phone or computer.</p></div>
      <img class="hero-logo" src="./assets/mdk-logo.jpg" alt="MDK Electric Ltd.">
    </section>
    <section class="metrics" aria-label="Saved document totals">
      ${metric(count(), "Saved Documents", "▣")}${metric(state.workOrders.length, "Work Orders", "🛠")}${metric(state.timesheets.length, "Timesheets", "◷")}${metric(state.quotes.length, "Quotes", "▤")}
    </section>
    <div class="section-head"><h2>Quick access</h2></div>
    <section class="quick-grid" aria-label="Create a document">
      ${quick("workOrders", "Work Order", "+▣")}${quick("timesheets", "Timesheet", "+◷")}${quick("quotes", "Quote", "+▤")}
    </section>
    <div class="section-head"><h2>Recently modified</h2>${recent.length ? "" : '<span class="muted">Nothing saved yet</span>'}</div>
    ${recent.length ? `<section class="record-list">${recent.map(item => recordCard(item.type, item.doc, false)).join("")}</section>` : `<section class="empty card"><div class="icon">＋</div><h3>Create your first document</h3><p class="muted">Your work stays on this device until you export a backup or share a PDF.</p></section>`}`;
}

function metric(value, label, icon) {
  return `<article class="metric card"><span class="metric-icon" aria-hidden="true">${icon}</span><div><strong>${value}</strong><span>${label}</span></div></article>`;
}

function quick(type, label, icon) {
  return `<button class="quick" data-new="${type}"><span class="icon" aria-hidden="true">${icon}</span><span>${label}</span></button>`;
}

function listPage(type) {
  const config = typeConfig[type];
  const query = ui.search.toLowerCase().trim();
  const documents = state[type].filter(doc => JSON.stringify(doc).toLowerCase().includes(query));
  return `<div class="toolbar">
      <label class="search"><span class="skip-link">Search ${config.label}</span><input type="search" data-search placeholder="Search ${config.label.toLowerCase()}" value="${esc(ui.search)}"></label>
      <button class="button primary" data-new="${type}"><span aria-hidden="true">＋</span><span class="desktop-label">New</span></button>
    </div>
    ${documents.length ? `<section class="record-list">${documents.map(doc => recordCard(type, doc, true)).join("")}</section>` : `<section class="empty card"><div class="icon">${config.icon}</div><h3>${query ? "No matches" : `No ${config.label.toLowerCase()} yet`}</h3><p class="muted">${query ? "Try a different search." : `Tap New to create a ${config.singular.toLowerCase()}.`}</p></section>`}`;
}

function recordCard(type, doc, actions) {
  const config = typeConfig[type];
  const status = esc(doc.status || "Draft");
  return `<article class="record card">
    <button class="record-main" data-open="${type}" data-id="${esc(doc.id)}">
      <div class="record-title">${esc(doc.number)}</div><div class="record-subtitle">${esc(config.primary(doc))}</div>
      <div class="record-meta"><span class="status">${status}</span><span>${esc(displayDate(config.date(doc)))}</span>${type === "workOrders" ? `<span>${money(workOrderTotals(doc).total)}</span>` : type === "timesheets" ? `<span>${timesheetTotals(doc).totalHours.toFixed(2)} hours</span>` : `<span>${money(quoteTotals(doc).total, doc.currencyCode)}</span>`}</div>
    </button>
    ${actions ? `<div class="record-actions"><button class="button icon-only ghost" data-record-pdf="${type}" data-id="${esc(doc.id)}" aria-label="Download PDF">⇩</button><button class="button icon-only ghost" data-delete="${type}" data-id="${esc(doc.id)}" aria-label="Delete">⌫</button></div>` : ""}
  </article>`;
}

function input(label, path, value, type = "text", attrs = "") {
  const dateClass = type === "date" ? " date-field" : "";
  const inputClass = type === "date" ? ' class="date-input"' : "";
  return `<label class="field${dateClass}"><span>${label}</span><input${inputClass} type="${type}" data-path="${path}" value="${esc(value)}" ${attrs}></label>`;
}

function textarea(label, path, value, attrs = "") {
  return `<label class="field"><span>${label}</span><textarea data-path="${path}" ${attrs}>${esc(value)}</textarea></label>`;
}

function select(label, path, value, options) {
  return `<label class="field"><span>${label}</span><select data-path="${path}">${options.map(option => `<option value="${esc(option)}"${option === value ? " selected" : ""}>${esc(option)}</option>`).join("")}</select></label>`;
}

function renderEditor() {
  const type = ui.editingType;
  const doc = ui.editing;
  const config = typeConfig[type];
  return `<header class="editor-head">
      <button class="button ghost icon-only" data-action="close-editor" aria-label="Back">←</button>
      <div class="editor-title"><div class="eyebrow">${esc(config.singular.toUpperCase())}</div><h1>${esc(doc.number)}</h1></div>
      <div class="editor-actions"><button class="button ghost" data-action="share-pdf">Share PDF</button><button class="button ghost" data-action="save-pdf">Save PDF</button><button class="button primary" data-action="save-record">Save</button></div>
    </header>
    <form class="form-stack two-column" id="editor-form" autocomplete="off">
      ${type === "workOrders" ? workOrderEditor(doc) : type === "timesheets" ? timesheetEditor(doc) : quoteEditor(doc)}
    </form>`;
}

function commonDocumentFields(doc) {
  return `${input("Document number", "number", doc.number)}${select("Status", "status", doc.status, ["Draft", "Ready", "Submitted", "Approved", "Void"])}`;
}

function workOrderEditor(doc) {
  doc.customerDetails ||= newCustomer();
  const totals = workOrderTotals(doc);
  return `<section class="form-section card"><h2>Work order details</h2><div class="fields two">${commonDocumentFields(doc)}${customerPicker(doc)}${input("Customer ID", "customerID", doc.customerID)}${textarea("Customer / company", "customer", doc.customer)}${addressFields("customerDetails", doc.customerDetails || newCustomer())}${input("Job number", "jobNumber", doc.jobNumber)}${input("Date", "date", doc.date, "date")}${select("Completed by", "completedBy", doc.completedBy, ["", ...state.settings.staffNames])}${input("Incident number", "incidentNumber", doc.incidentNumber)}</div></section>
    <section class="form-section card"><h2>Work completed</h2>${textarea("Description of completed work", "workCompleted", doc.workCompleted)}</section>
    <section class="form-section card span-two"><h2>Materials</h2><div class="row-list">${doc.materials.map((row, i) => `<div class="line-row"><div class="line-row-head"><strong>Material ${i + 1}</strong><button type="button" class="button danger icon-only" data-remove="materials" data-index="${i}" aria-label="Remove material">⌫</button></div><div class="row-fields material">${input("Quantity", `materials.${i}.quantity`, row.quantity, "number", 'step="any" inputmode="decimal"')}${input("Description", `materials.${i}.description`, row.description)}${input("Unit cost", `materials.${i}.unitCost`, row.unitCost, "number", 'step="0.01" inputmode="decimal"')}${input("Extension", "", money(number(row.quantity) * number(row.unitCost)), "text", `readonly data-extension="${i}"`)}</div></div>`).join("") || '<p class="muted">No materials entered.</p>'}</div><button type="button" class="button section-add" data-add="materials">＋ Add material</button></section>
    <section class="form-section card span-two"><h2>Labour</h2><div class="row-list">${doc.labour.map((row, i) => `<div class="line-row"><div class="line-row-head"><strong>Labour ${i + 1}</strong><button type="button" class="button danger icon-only" data-remove="labour" data-index="${i}" aria-label="Remove labour">⌫</button></div><div class="row-fields labour">${input("Date", `labour.${i}.date`, row.date, "date")}${select("Name", `labour.${i}.name`, row.name, ["", ...state.settings.staffNames])}${input("Hours", `labour.${i}.hours`, row.hours, "number", 'step="0.25" inputmode="decimal"')}${input("Hourly rate", `labour.${i}.hourlyRate`, row.hourlyRate, "number", 'step="0.01" inputmode="decimal"')}${input("Extension", "", money(number(row.hours) * number(row.hourlyRate)), "text", `readonly data-extension="${i}"`)}</div></div>`).join("") || '<p class="muted">No labour entered.</p>'}</div><button type="button" class="button section-add" data-add="labour">＋ Add labour</button></section>
    <section class="form-section card span-two"><h2>Expenses</h2><div class="row-list">${doc.expenses.map((row, i) => `<div class="line-row"><div class="line-row-head"><strong>Expense ${i + 1}</strong><button type="button" class="button danger icon-only" data-remove="expenses" data-index="${i}" aria-label="Remove expense">⌫</button></div><div class="row-fields expense">${input("Date", `expenses.${i}.date`, row.date, "date")}${select("Name", `expenses.${i}.employeeName`, row.employeeName, ["", ...state.settings.staffNames])}${input("Description", `expenses.${i}.description`, row.description)}${input("Amount", `expenses.${i}.amount`, row.amount, "number", 'step="0.01" inputmode="decimal"')}</div></div>`).join("") || '<p class="muted">No expenses entered.</p>'}</div><button type="button" class="button section-add" data-add="expenses">＋ Add expense</button></section>
    <section class="form-section card"><h2>Authorization</h2><div class="fields">${input("Authorized by", "authorizedBy", doc.authorizedBy)}${input("Customer PO", "customerPO", doc.customerPO)}${input("Authorization date", "authorizationDate", doc.authorizationDate, "date")}${textarea("Internal notes", "internalNotes", doc.internalNotes)}</div></section>
    <section class="form-section card"><h2>Totals</h2>${input("HST rate (0.13 = 13%)", "taxRate", doc.taxRate, "number", 'step="0.01" inputmode="decimal"')}<div class="totals" data-totals>${workOrderTotalHtml(totals)}</div></section>`;
}

function workOrderTotalHtml(totals) {
  return totalLine("Materials", money(totals.material)) + totalLine("Labour", money(totals.labour)) + totalLine("Expenses", money(totals.expenses)) + totalLine("Subtotal", money(totals.subtotal)) + totalLine("HST", money(totals.tax)) + totalLine("Amount owing", money(totals.total), true);
}

function timesheetEditor(doc) {
  const totals = timesheetTotals(doc);
  return `<section class="form-section card span-two"><h2>Timesheet details</h2><div class="fields three">${commonDocumentFields(doc)}${select("Employee", "employee", doc.employee, ["", ...state.settings.staffNames])}${input("Week ending", "weekEnding", doc.weekEnding, "date")}</div></section>
    <section class="form-section card span-two"><h2>Daily entries</h2><div class="row-list">${doc.entries.map((row, i) => `<div class="line-row"><div class="line-row-head"><strong>${displayDate(row.date)}</strong><button type="button" class="button quick-hours" data-set-eight="${i}">Set 8h</button></div><div class="row-fields timesheet">${input("Customer / PO", `entries.${i}.customerPO`, row.customerPO)}${input("Job description", `entries.${i}.jobDescription`, row.jobDescription)}${input("Reg", `entries.${i}.regularHours`, row.regularHours, "number", 'step="0.25" inputmode="decimal"')}${input("1.5x", `entries.${i}.overtimeHours`, row.overtimeHours, "number", 'step="0.25" inputmode="decimal"')}${input("2x", `entries.${i}.doubleTimeHours`, row.doubleTimeHours, "number", 'step="0.25" inputmode="decimal"')}${input("Expenses", `entries.${i}.expenses`, row.expenses, "number", 'step="0.01" inputmode="decimal"')}</div></div>`).join("")}</div></section>
    <section class="form-section card"><h2>Sign-off</h2><div class="fields">${input("Signature name", "signatureName", doc.signatureName)}${input("Signed date", "signedDate", doc.signedDate, "date")}${textarea("Notes", "notes", doc.notes)}</div></section>
    <section class="form-section card"><h2>Totals</h2><div class="totals" data-totals>${timesheetTotalHtml(totals)}</div></section>`;
}

function timesheetTotalHtml(totals) {
  return totalLine("Regular", `${totals.regular.toFixed(2)} hr`) + totalLine("1.5x", `${totals.overtime.toFixed(2)} hr`) + totalLine("2x", `${totals.doubleTime.toFixed(2)} hr`) + totalLine("Total hours", totals.totalHours.toFixed(2), true) + totalLine("Expenses", money(totals.expenses));
}

function addressFields(prefix, address) {
  return `${input("Name", `${prefix}.name`, address.name)}${input("Company", `${prefix}.company`, address.company)}${input("Address line 1", `${prefix}.addressLine1`, address.addressLine1)}${input("Address line 2", `${prefix}.addressLine2`, address.addressLine2)}${input("City", `${prefix}.city`, address.city)}${input("Province / State", `${prefix}.provinceState`, address.provinceState)}${input("Postal code", `${prefix}.postalCode`, address.postalCode)}${input("Country", `${prefix}.country`, address.country)}${input("Phone", `${prefix}.phone`, address.phone, "tel")}${input("Email", `${prefix}.email`, address.email, "email")}`;
}

function quoteEditor(doc) {
  const totals = quoteTotals(doc);
  return `<section class="form-section card span-two"><h2>Quote details</h2><div class="fields three">${commonDocumentFields(doc)}${input("Date", "date", doc.date, "date")}${input("Valid until", "validUntil", doc.validUntil, "date")}${input("Customer ID", "customerID", doc.customerID)}${input("Purchase order", "purchaseOrder", doc.purchaseOrder)}${select("Currency", "currencyCode", doc.currencyCode, ["CAD", "USD"])}</div></section>
    <section class="form-section card"><h2>Billed to</h2>${customerPicker(doc)}<div class="fields two">${addressFields("billedTo", doc.billedTo)}</div></section>
    <section class="form-section card"><h2>Shipping</h2><label class="field check-field"><input type="checkbox" data-path="useBillingForShipping"${doc.useBillingForShipping ? " checked" : ""}><span>Same as billing address</span></label>${doc.useBillingForShipping ? '<p class="notice">The billing address will also appear as the shipping address.</p>' : `<div class="fields two">${addressFields("shipTo", doc.shipTo)}</div>`}</section>
    <section class="form-section card span-two"><h2>Items</h2><div class="row-list">${doc.items.map((row, i) => `<div class="line-row"><div class="line-row-head"><strong>Item ${i + 1}</strong><button type="button" class="button danger icon-only" data-remove="items" data-index="${i}" aria-label="Remove item">⌫</button></div><div class="row-fields quote-item">${input("Description", `items.${i}.description`, row.description)}${input("Unit cost", `items.${i}.unitCost`, row.unitCost, "number", 'step="0.01" inputmode="decimal"')}${input("Quantity", `items.${i}.quantity`, row.quantity, "number", 'step="any" inputmode="decimal"')}${input("Amount", "", money(number(row.unitCost) * number(row.quantity), doc.currencyCode), "text", `readonly data-extension="${i}"`)}</div></div>`).join("") || '<p class="muted">No quote items entered.</p>'}</div><button type="button" class="button section-add" data-add="items">＋ Add quote item</button></section>
    <section class="form-section card"><h2>Notes</h2>${textarea("Special notes and instructions", "specialNotes", doc.specialNotes)}</section>
    <section class="form-section card"><h2>Totals</h2><div class="fields">${input("Discount", "discountAmount", doc.discountAmount, "number", 'step="0.01" inputmode="decimal"')}${input("Tax rate (0.13 = 13%)", "taxRate", doc.taxRate, "number", 'step="0.01" inputmode="decimal"')}</div><div class="totals" data-totals>${quoteTotalHtml(totals, doc.currencyCode)}</div></section>`;
}

function quoteTotalHtml(totals, currency) {
  return totalLine("Subtotal", money(totals.subtotal, currency)) + totalLine("Discounted subtotal", money(totals.discounted, currency)) + totalLine("Tax", money(totals.tax, currency)) + totalLine("Total", money(totals.total, currency), true);
}

function totalLine(label, value, grand = false) {
  return `<div class="total-line${grand ? " grand" : ""}"><span>${label}</span><strong>${value}</strong></div>`;
}

function morePage() {
  const s = state.settings;
  return `<div class="settings-grid">
    <section class="form-section card"><h2>Files & backups</h2><p class="muted">An encrypted backup includes customers, PDFs, documents, numbering, staff names, and company settings.</p><div class="backup-actions"><button class="button primary" data-action="export-backup">⇩ Export full backup</button><label class="button">⇧ Import backup<input class="file-input" type="file" accept="application/json,.json" data-import></label></div><p class="notice">Documents are stored privately in this browser. Open the Backups tab for owner login, encrypted backups, and cloud recovery.</p></section>
    <section class="form-section card"><h2>Company</h2><div class="fields two">${settingInput("Company name", "companyName", s.companyName)}${settingInput("Address", "addressLine1", s.addressLine1)}${settingInput("City, province, postal code", "cityProvincePostal", s.cityProvincePostal)}${settingInput("Phone", "phone", s.phone, "tel")}${settingInput("Company email", "email", s.email, "email")}${settingInput("Website", "website", s.website)}${settingInput("HST number", "hstNumber", s.hstNumber)}${settingInput("Default email recipient", "defaultEmailRecipient", s.defaultEmailRecipient, "email")}</div></section>
    <section class="form-section card"><h2>Defaults & numbering</h2><div class="fields three">${settingInput("HST rate (0.13 = 13%)", "defaultTaxRate", s.defaultTaxRate, "number", 'step="0.01"')}${settingInput("Work order prefix", "workOrderPrefix", s.workOrderPrefix)}${settingInput("Next work order", "nextWorkOrderNumber", s.nextWorkOrderNumber, "number", 'step="1"')}${settingInput("Timesheet prefix", "timesheetPrefix", s.timesheetPrefix)}${settingInput("Next timesheet", "nextTimesheetNumber", s.nextTimesheetNumber, "number", 'step="1"')}${settingInput("Quote prefix", "quotePrefix", s.quotePrefix)}${settingInput("Next quote", "nextQuoteNumber", s.nextQuoteNumber, "number", 'step="1"')}</div></section>
    <section class="form-section card"><h2>Employees</h2><label class="field"><span>One name per line</span><textarea data-staff>${esc(s.staffNames.join("\n"))}</textarea></label></section>
    <section class="form-section card danger-zone"><h2>Storage reset</h2><p class="muted">This permanently removes all locally saved documents and resets company settings. Export a backup first.</p><button class="button danger" data-action="reset-data">Delete local data</button></section>
  </div>`;
}

function settingInput(label, key, value, type = "text", attrs = "") {
  return `<label class="field"><span>${label}</span><input type="${type}" data-setting="${key}" value="${esc(value)}" ${attrs}></label>`;
}

function createNew(type) {
  if (type === "workOrders") { ui.editing = makeWorkOrder(state.settings); state.settings.nextWorkOrderNumber += 1; }
  if (type === "timesheets") { ui.editing = makeTimesheet(state.settings); state.settings.nextTimesheetNumber += 1; }
  if (type === "quotes") { ui.editing = makeQuote(state.settings); state.settings.nextQuoteNumber += 1; }
  persist(state);
  ui.editingType = type;
  render();
  window.scrollTo(0, 0);
}

function openRecord(type, id) {
  const doc = state[type].find(item => item.id === id);
  if (!doc) return;
  ui.editingType = type;
  ui.editing = clone(doc);
  render();
  window.scrollTo(0, 0);
}

async function saveRecord() {
  if (!requireOwner()) return;
  const doc = ui.editing;
  const type = ui.editingType;
  if (!String(doc.number || "").trim()) return showToast("Add a document number before saving.");
  doc.modifiedAt = new Date().toISOString();
  const index = state[type].findIndex(item => item.id === doc.id);
  if (index >= 0) state[type][index] = clone(doc); else state[type].unshift(clone(doc));
  state[type].sort((a, b) => String(b.modifiedAt).localeCompare(String(a.modifiedAt)));
  persist(state);
  archiveRecord(type, doc);
  await backupCurrent();
  showToast(`${typeConfig[type].singular} saved with a private backup.${cloudConnected() ? " " + ui.cloudStatus : " Cloud not connected."}`);
}

function updateTotals() {
  const totalsNode = document.querySelector("[data-totals]");
  if (!ui.editing) return;
  document.querySelectorAll('[data-extension]').forEach(node => {
    const i = Number(node.dataset.extension);
    const collection = node.closest('.row-fields').classList.contains('quote-item') ? 'items' : node.closest('.row-fields').classList.contains('material') ? 'materials' : 'labour';
    const row = ui.editing[collection][i];
    node.value = money(collection === 'labour' ? number(row.hours) * number(row.hourlyRate) : number(row.quantity) * number(row.unitCost), ui.editing.currencyCode || 'CAD');
  });
  if (!totalsNode) return;
  if (ui.editingType === "workOrders") totalsNode.innerHTML = workOrderTotalHtml(workOrderTotals(ui.editing));
  if (ui.editingType === "timesheets") totalsNode.innerHTML = timesheetTotalHtml(timesheetTotals(ui.editing));
  if (ui.editingType === "quotes") totalsNode.innerHTML = quoteTotalHtml(quoteTotals(ui.editing), ui.editing.currencyCode);
}

function addRow(collection) {
  const factories = { materials: newMaterial, labour: newLabour, expenses: newExpense, items: newQuoteItem };
  ui.editing[collection].push(factories[collection]());
  render();
}

function showToast(message) {
  document.querySelector(".toast")?.remove();
  const node = document.createElement("div");
  node.className = "toast";
  node.setAttribute("role", "status");
  node.textContent = message;
  document.body.append(node);
  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => node.remove(), 3500);
}

async function handlePdf(action, type = ui.editingType, doc = ui.editing) {
  if (!requireOwner()) return;
  try {
    showToast("Preparing PDF and private backup…");
    const result = await makePdf(type, doc, state.settings);
    const blob = result.pdf.output("blob");
    // Save the editable document even when the user only presses Save/Share PDF.
    doc.modifiedAt = new Date().toISOString();
    const index = state[type].findIndex(item => item.id === doc.id);
    if (index >= 0) state[type][index] = clone(doc); else state[type].unshift(clone(doc));
    persist(state);
    archiveRecord(type, doc);
    await archivePdf(type, doc, blob, result.filename);
    await backupCurrent();
    const file = new File([blob], result.filename, { type: "application/pdf" });
    if (action === "share" && navigator.share && navigator.canShare?.({ files: [file] })) {
      await navigator.share({ title: result.title, files: [file] });
    } else downloadBlob(blob, result.filename);
    showToast(`PDF ${action === "share" ? "prepared" : "downloaded"}; private copy saved. ${ui.cloudStatus || "Cloud not connected."}`);
  } catch (error) {
    if (error?.name !== "AbortError") showToast(error?.message || "Could not create the PDF.");
  }
}

app.addEventListener("click", async event => {
  try {
  if (await ownerClick(event)) return;
  const nav = event.target.closest("[data-nav]");
  if (nav) { ui.view = nav.dataset.nav; ui.editing = null; ui.editingType = null; ui.search = ""; render(); window.scrollTo(0, 0); return; }
  const create = event.target.closest("[data-new]");
  if (create) return createNew(create.dataset.new);
  const open = event.target.closest("[data-open]");
  if (open) return openRecord(open.dataset.open, open.dataset.id);
  const remove = event.target.closest("[data-remove]");
  if (remove) { ui.editing[remove.dataset.remove].splice(Number(remove.dataset.index), 1); render(); return; }
  const add = event.target.closest("[data-add]");
  if (add) return addRow(add.dataset.add);
  const setEight = event.target.closest("[data-set-eight]");
  if (setEight) {
    const index = Number(setEight.dataset.setEight);
    if (ui.editingType === "timesheets" && ui.editing.entries[index]) {
      ui.editing.entries[index].regularHours = 8;
      const hoursInput = document.querySelector(`[data-path="entries.${index}.regularHours"]`);
      if (hoursInput) hoursInput.value = "8";
      updateTotals();
      showToast(`${displayDate(ui.editing.entries[index].date)} set to 8 regular hours.`);
    }
    return;
  }
  const deletion = event.target.closest("[data-delete]");
  if (deletion) {
    const type = deletion.dataset.delete;
    const doc = state[type].find(item => item.id === deletion.dataset.id);
    if (doc && requireOwner() && confirm(`Delete ${doc.number} from this device? Its private backup is retained.`)) { state[type] = state[type].filter(item => item.id !== doc.id); persist(state); render(); showToast(`${doc.number} deleted.`); }
    return;
  }
  const recordPdf = event.target.closest("[data-record-pdf]");
  if (recordPdf) {
    const doc = state[recordPdf.dataset.recordPdf].find(item => item.id === recordPdf.dataset.id);
    if (doc) await handlePdf("save", recordPdf.dataset.recordPdf, doc);
    return;
  }
  const action = event.target.closest("[data-action]")?.dataset.action;
  if (!action) return;
  if (action === "close-editor") { ui.editing = null; ui.editingType = null; render(); return; }
  if (action === "save-record") return await saveRecord();
  if (action === "save-pdf") return await handlePdf("save");
  if (action === "share-pdf") return await handlePdf("share");
  if (action === "export-backup") { if (!requireOwner()) return; downloadEnvelope(await saveVault(state)); showToast("Encrypted backup downloaded."); return; }
  if (action === "install" && installPrompt) { installPrompt.prompt(); await installPrompt.userChoice; installPrompt = null; render(); return; }
  if (action === "reset-data" && requireOwner() && confirm("Delete every locally saved MDK document and reset settings? This cannot be undone.")) {
    localStorage.removeItem("mdk-field-web-v1"); state = loadState(); render(); showToast("Local app data reset. Private archive retained in Backups.");
  }
  } catch (error) { showToast(error.message || "Could not complete this action."); }
});

app.addEventListener("input", event => {
  const target = event.target;
  if (target.matches('[data-customer-field]') && isUnlocked() && ui.customer) { ui.customer[target.dataset.customerField] = target.value; return; }
  if (target.matches("[data-search]")) { ui.search = target.value; const cursor = target.selectionStart; render(); const next = document.querySelector("[data-search]"); next?.focus(); next?.setSelectionRange(cursor, cursor); return; }
  if (target.matches("[data-path]") && ui.editing) {
    const path = target.dataset.path;
    if (!path) return;
    const oldWeekEnding = path === "weekEnding" ? ui.editing.weekEnding : null;
    const value = target.type === "checkbox" ? target.checked : target.type === "number" ? number(target.value) : target.value;
    setPath(ui.editing, path, value);
    if (path === "weekEnding" && ui.editingType === "timesheets") {
      shiftTimesheetWeek(ui.editing, oldWeekEnding, value);
      render();
      showToast(`Daily entries moved to the week ending ${displayDate(value)}.`);
      return;
    }
    if (target.type === "checkbox" || path === "currencyCode") render(); else updateTotals();
    return;
  }
  if (target.matches("[data-setting]")) {
    state.settings[target.dataset.setting] = target.type === "number" ? number(target.value) : target.value;
    persist(state);
    return;
  }
  if (target.matches("[data-staff]")) {
    state.settings.staffNames = target.value.split(/\r?\n/).map(name => name.trim()).filter(Boolean);
    persist(state);
  }
});

app.addEventListener("change", async event => {
  if (event.target.matches('[data-customer-picker]') && ui.editing && isUnlocked()) {
    const customer = privateData().customers.find(c => c.id === event.target.value);
    if (customer) applyCustomer(ui.editingType, ui.editing, customer);
    else ui.editing.customerRecordId = '';
    render(); return;
  }
  if (event.target.matches('[data-private-import]') && event.target.files?.[0]) {
    try {
      const envelope = JSON.parse(await event.target.files[0].text());
      if (!confirm('Restore this encrypted backup? Current documents and customers will be replaced. Export your current private backup first if you need to keep them.')) return;
      const password = document.querySelector('[data-restore-password]').value;
      state = validateBackup(await restoreEnvelope(envelope, password)); persist(state); ui.vaultExists = true; ui.customer = null; render(); showToast('Private backup restored.');
    } catch (error) { showToast(error.message); }
    return;
  }
  const inputNode = event.target.closest("[data-import]");
  if (!inputNode?.files?.[0]) return;
  try {
    if (!requireOwner()) return;
    const imported = validateBackup(JSON.parse(await inputNode.files[0].text()));
    if (!confirm(`Restore ${imported.workOrders.length + imported.timesheets.length + imported.quotes.length} documents from this backup? Current local data will be replaced.`)) return;
    state = imported;
    persist(state);
    await backupCurrent();
    render();
    showToast("Backup restored successfully.");
  } catch (error) {
    showToast(error?.message || "The backup could not be imported.");
  }
});

window.addEventListener("beforeinstallprompt", event => { event.preventDefault(); installPrompt = event; render(); });
window.addEventListener("online", () => { if (isUnlocked() && cloudConnected()) backupCurrent().catch(error => showToast(error.message)); const node = document.querySelector("#connection-status"); if (node) node.textContent = "Online"; });
window.addEventListener("offline", () => { const node = document.querySelector("#connection-status"); if (node) node.textContent = "Offline ready"; });

if ("serviceWorker" in navigator && location.protocol.startsWith("http")) {
  window.addEventListener("load", () => navigator.serviceWorker.register("./sw.js").catch(() => {}));
}

render();
hasVault().then(exists => { ui.vaultExists = exists; if (["customers", "backups"].includes(ui.view)) render(); }).catch(error => showToast(error.message));
app.addEventListener('submit', event => event.preventDefault());

function requireOwner() {
  if (isUnlocked()) return true;
  ui.view = 'backups';
  showToast('Unlock the private archive before saving. Your open document is kept; return to it after unlocking.');
  // Keep editor in memory but display owner screen while it is locked.
  ui.ownerReturn = { editing: ui.editing, editingType: ui.editingType };
  ui.editing = null; ui.editingType = null; render();
  return false;
}
function unlockForm() {
  return `<section class="form-section card"><h2>${ui.vaultExists ? 'Unlock private data' : 'Create your private archive'}</h2>
    <p class="muted">Customers and backups are encrypted with your password. Keep it safe: it cannot be recovered. Cloud sign-in is separate from this backup password.</p>
    <div class="fields"><label class="field"><span>Backup password</span><input type="password" data-vault-password autocomplete="current-password" minlength="8"></label>
    ${ui.vaultExists ? '' : '<label class="field"><span>Confirm backup password</span><input type="password" data-vault-confirm autocomplete="new-password" minlength="8"></label>'}</div>
    <button class="button primary" data-owner="unlock">${ui.vaultExists ? 'Unlock' : 'Create private archive'}</button></section>`;
}
function customerPicker(doc) {
  if (!isUnlocked()) return '<p class="notice">Unlock Customers & Backups to select a saved customer. Manual entry is available.</p>';
  return `<label class="field"><span>Saved customer</span><select data-customer-picker><option value="">Manual entry / different customer</option>${privateData().customers.map(c => `<option value="${esc(c.id)}"${doc.customerRecordId === c.id ? ' selected' : ''}>${esc([c.company, c.name].filter(Boolean).join(' — '))}</option>`).join('')}</select></label><p class="muted">Selecting fills the details below. You can change any field for this document without changing the customer database.</p>`;
}
function customersPage() {
  if (!isUnlocked()) return unlockForm();
  const customers = privateData().customers;
  const c = ui.customer;
  const fields = { name: 'Contact name', company: 'Company', customerID: 'Customer number / ID', addressLine1: 'Address line 1', addressLine2: 'Address line 2', city: 'City', provinceState: 'Province / State', postalCode: 'Postal code', country: 'Country', phone: 'Phone', email: 'Email', notes: 'Notes' };
  return `<div class="toolbar"><button class="button primary" data-owner="new-customer">＋ Add customer</button><button class="button" data-owner="lock">Lock private data</button></div>
    ${c ? `<section class="form-section card"><h2>${customers.some(item => item.id === c.id) ? 'Edit customer' : 'New customer'}</h2><div class="fields two">${Object.entries(fields).map(([key, label]) => `<label class="field"><span>${label}</span><input data-customer-field="${key}" type="${key === 'email' ? 'email' : key === 'phone' ? 'tel' : 'text'}" value="${esc(c[key])}"></label>`).join('')}</div><div class="backup-actions"><button class="button primary" data-owner="save-customer">Save customer</button><button class="button" data-owner="cancel-customer">Cancel</button></div></section>` : ''}
    <section class="record-list">${customers.length ? customers.slice().sort((a, b) => (a.company || a.name).localeCompare(b.company || b.name)).map(item => `<article class="record card"><div><h3>${esc(item.company || item.name)}</h3><p>${esc(item.name)} · ${esc(item.phone)} · ${esc(item.email)}</p><p class="muted">${esc([item.addressLine1, item.city, item.postalCode].filter(Boolean).join(', '))}</p></div><div class="record-actions"><button class="button" data-customer-edit="${esc(item.id)}">Edit</button><button class="button danger" data-customer-delete="${esc(item.id)}">Delete</button></div></article>`).join('') : '<div class="empty card">No customers yet. Add contacts here, then select them on quotes and work orders.</div>'}</section>`;
}
function backupsPage() {
  const config = cloudConfig();
  const data = isUnlocked() ? privateData() : null;
  const pdfs = data?.pdfs || [];
  const history = data?.history || [];
  return `${data ? `<section class="form-section card"><h2>Private archive unlocked</h2><p class="muted">Every Save and PDF export keeps an encrypted copy here. ${data.customers.length} customers · ${pdfs.length} PDF versions.</p><div class="backup-actions"><button class="button primary" data-action="export-backup">Download encrypted backup</button><button class="button" data-owner="lock">Lock private data</button></div></section>` : unlockForm()}
    <section class="form-section card"><h2>Free cloud backups</h2><p class="muted">Connect your Supabase project once on each device. Sign in with your owner account to back up or recover documents anywhere. Files are private and encrypted. Backups preserve versions from each device; restore a recent version before editing on another device.</p>
      <details${config.url ? '' : ' open'}><summary>Project connection</summary><div class="fields"><label class="field"><span>Supabase project URL</span><input data-cloud-url type="url" value="${esc(config.url)}" placeholder="https://your-project.supabase.co"></label><label class="field"><span>Publishable / anon key</span><input data-cloud-key value="${esc(config.publicKey)}" autocomplete="off"></label></div><button class="button" data-owner="configure-cloud">Save connection</button><p class="muted">Never enter a service-role or secret key. See <a href="https://github.com/MDKSTUFF/Timesheet/blob/fix/customers-private-backups/CLOUD_SETUP.md" target="_blank" rel="noopener">one-time setup instructions</a>.</p></details>
      ${cloudConnected() ? `<div class="backup-actions"><button class="button primary" data-owner="backup-cloud">Back up now</button><button class="button" data-owner="refresh-cloud">Refresh cloud backups</button><button class="button" data-owner="cloud-logout">Sign out</button></div>` : `<div class="fields two"><label class="field"><span>Owner email</span><input data-cloud-email type="email" autocomplete="username"></label><label class="field"><span>Owner account password</span><input data-cloud-password type="password" autocomplete="current-password"></label></div><button class="button primary" data-owner="cloud-login">Sign in</button>`}
      <p class="notice" role="status">${esc(ui.cloudStatus || 'Cloud backups are not connected yet. Local encrypted copies stay on this device until uploaded or downloaded.')}</p>
      ${ui.cloudBackups.length ? `<label class="field"><span>Cloud backup version</span><select data-cloud-version>${ui.cloudBackups.map(item => `<option value="${esc(item.name)}">${esc(item.created_at || item.name)}</option>`).join('')}</select></label><button class="button" data-owner="restore-cloud">Restore selected version</button>` : ''}
    </section>
    <section class="form-section card"><h2>Restore encrypted backup</h2><p class="muted">Restore a downloaded file or a selected cloud version using the password that encrypted it.</p><label class="field"><span>Backup password for restore</span><input type="password" data-restore-password autocomplete="off"></label><label class="button">Choose encrypted backup<input class="file-input" type="file" accept=".mdkbackup,application/json" data-private-import></label></section>
    ${data ? `<section class="form-section card"><h2>Saved document versions</h2><p class="muted">Recover an editable version even if it was deleted from the main list.</p><div class="record-list">${history.slice().reverse().map(item => `<article class="record card"><div><strong>${esc(item.document.number)}</strong><p class="muted">${esc(typeConfig[item.type]?.label)} · ${esc(item.createdAt)}</p></div><button class="button" data-archive-record="${esc(item.id)}">Recover</button></article>`).join('') || '<p>No saved versions yet.</p>'}</div></section><section class="form-section card"><h2>Saved PDFs</h2><p class="muted">Download any saved version without regenerating it. Editable documents are included in the encrypted backup.</p><div class="record-list">${pdfs.slice().reverse().map(pdf => `<article class="record card"><div><strong>${esc(pdf.filename)}</strong><p class="muted">${esc(typeConfig[pdf.type]?.label)} · ${esc(pdf.createdAt)}</p></div><button class="button" data-archive-pdf="${esc(pdf.id)}">Download</button></article>`).join('') || '<p>No PDFs archived yet.</p>'}</div></section>` : ''}`;
}
async function backupCurrent() {
  const envelope = await saveVault(state);
  if (cloudConnected()) {
    try {
      await uploadBackup(envelope);
      if (ui.editing && ui.editingType) await uploadCloudRecord(ui.editingType, ui.editing);
      ui.cloudStatus = `Cloud backup saved ${new Date().toLocaleString()}.`;
    } catch (error) { ui.cloudStatus = `Saved privately on this device. Cloud backup pending: ${error.message} Use Back up now to retry.`; }
  }
  return envelope;
}
async function ownerClick(event) {
  const edit = event.target.closest('[data-customer-edit]');
  const deletion = event.target.closest('[data-customer-delete]');
  const pdf = event.target.closest('[data-archive-pdf]');
  const archivedRecord = event.target.closest('[data-archive-record]');
  const action = event.target.closest('[data-owner]')?.dataset.owner;
  if (!edit && !deletion && !pdf && !archivedRecord && !action) return false;
  if (privateBusy) { showToast('Please wait for the private archive operation to finish.'); return true; }
  privateBusy = true;
  try {
    if (edit) { if (requireOwner()) ui.customer = clone(privateData().customers.find(c => c.id === edit.dataset.customerEdit)); render(); return true; }
    if (deletion) {
      if (!requireOwner()) return true;
      if (confirm('Delete this contact from the customer database? Existing documents keep their entered details.')) {
        privateData().customers = privateData().customers.filter(c => c.id !== deletion.dataset.customerDelete);
        await backupCurrent(); render();
      }
      return true;
    }
    if (archivedRecord) {
      if (!requireOwner()) return true;
      const item = privateData().history?.find(r => r.id === archivedRecord.dataset.archiveRecord);
      if (item) {
        ui.editingType = item.type; ui.editing = clone(item.document);
        showToast('Archived version opened. Save to restore it to the main list.'); render();
      }
      return true;
    }
    if (pdf) {
      if (!requireOwner()) return true;
      const item = privateData().pdfs.find(p => p.id === pdf.dataset.archivePdf);
      if (item) downloadBlob(new Blob([fromBase64(item.content)], { type: 'application/pdf' }), item.filename);
      return true;
    }
    if (action === 'unlock') {
      const password = document.querySelector('[data-vault-password]').value;
      const confirmation = document.querySelector('[data-vault-confirm]');
      if (confirmation && confirmation.value !== password) throw new Error('Backup passwords do not match.');
      await unlockVault(password, state); ui.vaultExists = true;
      if (ui.ownerReturn) { Object.assign(ui, ui.ownerReturn); ui.ownerReturn = null; }
      render(); showToast('Private archive unlocked.');
    } else if (action === 'lock') {
      lockVault(); cloudLogout(); ui.cloudBackups = []; ui.cloudStatus = ''; ui.customer = null; render();
    } else if (action === 'new-customer') { if (requireOwner()) ui.customer = newCustomer(); render(); }
    else if (action === 'cancel-customer') { ui.customer = null; render(); }
    else if (action === 'save-customer') {
      if (!requireOwner() || !ui.customer) return true;
      if (!ui.customer.name.trim() && !ui.customer.company.trim()) throw new Error('Add a contact name or company.');
      const index = privateData().customers.findIndex(c => c.id === ui.customer.id);
      if (index < 0) privateData().customers.push(clone(ui.customer)); else privateData().customers[index] = clone(ui.customer);
      await backupCurrent(); ui.customer = null; render(); showToast(`Customer saved privately. ${ui.cloudStatus || 'Cloud not connected.'}`);
    } else if (action === 'configure-cloud') {
      configureCloud(document.querySelector('[data-cloud-url]').value.trim(), document.querySelector('[data-cloud-key]').value.trim()); ui.cloudBackups = []; ui.cloudStatus = ''; render(); showToast('Project connection saved. Sign in with your owner account.');
    } else if (action === 'cloud-login') {
      await cloudLogin(document.querySelector('[data-cloud-email]').value.trim(), document.querySelector('[data-cloud-password]').value);
      ui.cloudBackups = await listCloudBackups(); ui.cloudStatus = 'Owner signed in. Restore a recent version on a new device, or back up this device now.'; render();
    } else if (action === 'cloud-logout') { cloudLogout(); ui.cloudBackups = []; ui.cloudStatus = ''; render(); }
    else if (action === 'refresh-cloud') { ui.cloudBackups = await listCloudBackups(); render(); }
    else if (action === 'backup-cloud') {
      if (!requireOwner()) return true;
      await backupCurrent(); ui.cloudBackups = await listCloudBackups(); render();
    } else if (action === 'restore-cloud') {
      const name = document.querySelector('[data-cloud-version]').value;
      const password = document.querySelector('[data-restore-password]').value;
      if (!confirm('Replace the documents and customers on this device with this cloud version? Download your current encrypted backup first if needed.')) return true;
      const envelope = await readCloudBackup(name);
      state = validateBackup(await restoreEnvelope(envelope, password, true)); persist(state); ui.vaultExists = true; ui.customer = null; render(); showToast('Cloud backup restored. Customers, documents and saved PDFs are available.');
    }
    return true;
  } finally { privateBusy = false; }
}
