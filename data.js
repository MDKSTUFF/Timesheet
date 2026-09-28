export const STORAGE_KEY = "mdk-field-web-v1";

export const defaultSettings = {
  companyName: "MDK Electric Ltd.",
  addressLine1: "1755 Plummer St, Suite 21",
  cityProvincePostal: "Pickering, Ontario, L1W 3L7",
  phone: "905-428-7622",
  email: "wallychillman@mdkelectric.ca",
  website: "mdkelectric.ca",
  hstNumber: "139791636 RT",
  defaultTaxRate: 0.13,
  defaultEmailRecipient: "",
  workOrderPrefix: "WO-",
  quotePrefix: "Q-",
  timesheetPrefix: "TS-",
  nextWorkOrderNumber: 1001,
  nextQuoteNumber: 3631,
  nextTimesheetNumber: 1001,
  staffNames: ["Kevin", "Dustin", "Mike", "Justin", "Michael", "Neill", "Cal", "Noah", "Josh", "Anthony", "Patrick", "Scott"],
};

const localIsoDate = date => {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
};
const today = () => localIsoDate(new Date());
const id = () => globalThis.crypto?.randomUUID?.() || `${Date.now()}-${Math.random().toString(16).slice(2)}`;
const plusDays = (dateString, days) => {
  const [year, month, day] = dateString.split("-").map(Number);
  const d = new Date(year, month - 1, day, 12);
  d.setDate(d.getDate() + days);
  return localIsoDate(d);
};

export function initialState() {
  return { version: 1, settings: structuredClone(defaultSettings), workOrders: [], timesheets: [], quotes: [] };
}

export function loadState() {
  try {
    const saved = JSON.parse(localStorage.getItem(STORAGE_KEY));
    if (!saved || typeof saved !== "object") return initialState();
    return {
      ...initialState(),
      ...saved,
      settings: { ...defaultSettings, ...(saved.settings || {}) },
      workOrders: Array.isArray(saved.workOrders) ? saved.workOrders : [],
      timesheets: Array.isArray(saved.timesheets) ? saved.timesheets : [],
      quotes: Array.isArray(saved.quotes) ? saved.quotes : [],
    };
  } catch {
    return initialState();
  }
}

export function persist(state) {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
}

export function makeWorkOrder(settings) {
  return {
    id: id(), number: `${settings.workOrderPrefix}${settings.nextWorkOrderNumber}`, customer: "", jobNumber: "",
    date: today(), workCompleted: "", completedBy: "", incidentNumber: "", materials: [], labour: [], expenses: [],
    taxRate: Number(settings.defaultTaxRate) || 0, authorizedBy: "", customerPO: "", authorizationDate: today(),
    internalNotes: "", status: "Draft", createdAt: new Date().toISOString(), modifiedAt: new Date().toISOString(),
  };
}

export function makeTimesheet(settings) {
  const now = new Date();
  const daysUntilSunday = (7 - now.getDay()) % 7;
  const weekEnding = plusDays(today(), daysUntilSunday);
  return {
    id: id(), number: `${settings.timesheetPrefix}${settings.nextTimesheetNumber}`, employee: "", weekEnding,
    entries: Array.from({ length: 7 }, (_, i) => ({ id: id(), date: plusDays(weekEnding, i - 6), customerPO: "", jobDescription: "", regularHours: 0, overtimeHours: 0, doubleTimeHours: 0, expenses: 0 })),
    signatureName: "", signedDate: today(), notes: "", status: "Draft", createdAt: new Date().toISOString(), modifiedAt: new Date().toISOString(),
  };
}

const address = () => ({ name: "", company: "", addressLine1: "", addressLine2: "", city: "", provinceState: "", postalCode: "", country: "Canada", phone: "", email: "" });

export function makeQuote(settings) {
  return {
    id: id(), number: `${settings.quotePrefix}${settings.nextQuoteNumber}`, date: today(), validUntil: plusDays(today(), 30),
    customerID: "", purchaseOrder: "", billedTo: address(), shipTo: address(), useBillingForShipping: true, items: [],
    specialNotes: "", discountAmount: 0, taxRate: Number(settings.defaultTaxRate) || 0, currencyCode: "CAD", status: "Draft",
    createdAt: new Date().toISOString(), modifiedAt: new Date().toISOString(),
  };
}

export const newMaterial = () => ({ id: id(), quantity: 1, description: "", unitCost: 0 });
export const newLabour = () => ({ id: id(), date: today(), name: "", hours: 0, hourlyRate: 0 });
export const newExpense = () => ({ id: id(), date: today(), employeeName: "", description: "", amount: 0 });
export const newQuoteItem = () => ({ id: id(), description: "", unitCost: 0, quantity: 1 });

const number = value => Number(value) || 0;
export function workOrderTotals(doc) {
  const material = doc.materials.reduce((sum, row) => sum + number(row.quantity) * number(row.unitCost), 0);
  const labour = doc.labour.reduce((sum, row) => sum + number(row.hours) * number(row.hourlyRate), 0);
  const expenses = doc.expenses.reduce((sum, row) => sum + number(row.amount), 0);
  const subtotal = material + labour + expenses;
  const tax = subtotal * number(doc.taxRate);
  return { material, labour, expenses, subtotal, tax, total: subtotal + tax };
}

export function timesheetTotals(doc) {
  const regular = doc.entries.reduce((sum, row) => sum + number(row.regularHours), 0);
  const overtime = doc.entries.reduce((sum, row) => sum + number(row.overtimeHours), 0);
  const doubleTime = doc.entries.reduce((sum, row) => sum + number(row.doubleTimeHours), 0);
  const expenses = doc.entries.reduce((sum, row) => sum + number(row.expenses), 0);
  return { regular, overtime, doubleTime, expenses, totalHours: regular + overtime + doubleTime };
}

export function quoteTotals(doc) {
  const subtotal = doc.items.reduce((sum, row) => sum + number(row.quantity) * number(row.unitCost), 0);
  const discounted = Math.max(0, subtotal - number(doc.discountAmount));
  const tax = discounted * number(doc.taxRate);
  return { subtotal, discounted, tax, total: discounted + tax };
}

export function setPath(object, path, value) {
  const parts = path.split(".");
  let cursor = object;
  for (let i = 0; i < parts.length - 1; i += 1) cursor = cursor[parts[i]];
  cursor[parts.at(-1)] = value;
}

export function displayDate(value) {
  if (!value) return "—";
  return new Intl.DateTimeFormat("en-CA", { year: "numeric", month: "short", day: "numeric" }).format(new Date(`${value.slice(0, 10)}T12:00:00`));
}

export function money(value, code = "CAD") {
  return new Intl.NumberFormat("en-CA", { style: "currency", currency: code }).format(number(value));
}

export function exportBackup(state) {
  const backup = { ...state, exportedAt: new Date().toISOString() };
  const blob = new Blob([JSON.stringify(backup, null, 2)], { type: "application/json" });
  const url = URL.createObjectURL(blob);
  const anchor = document.createElement("a");
  anchor.href = url;
  anchor.download = `MDK_Field_Backup_${today()}.json`;
  anchor.click();
  URL.revokeObjectURL(url);
}

export function validateBackup(data) {
  if (!data || typeof data !== "object" || !data.settings || !Array.isArray(data.workOrders) || !Array.isArray(data.timesheets) || !Array.isArray(data.quotes)) {
    throw new Error("This is not a valid MDK Field backup.");
  }
  return { ...initialState(), ...data, settings: { ...defaultSettings, ...data.settings } };
}
