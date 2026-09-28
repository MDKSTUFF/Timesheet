import assert from "node:assert/strict";
import {
  defaultSettings,
  makeQuote,
  makeTimesheet,
  makeWorkOrder,
  quoteTotals,
  setPath,
  timesheetTotals,
  validateBackup,
  workOrderTotals,
} from "./data.js";

const settings = structuredClone(defaultSettings);

const workOrder = makeWorkOrder(settings);
workOrder.materials = [{ quantity: 2, unitCost: 25 }];
workOrder.labour = [{ hours: 3, hourlyRate: 105 }];
workOrder.expenses = [{ amount: 10 }];
assert.deepEqual(workOrderTotals(workOrder), {
  material: 50,
  labour: 315,
  expenses: 10,
  subtotal: 375,
  tax: 48.75,
  total: 423.75,
});

const timesheet = makeTimesheet(settings);
assert.equal(timesheet.entries.length, 7);
assert.equal(timesheet.entries.at(-1).date, timesheet.weekEnding);
timesheet.entries[0].regularHours = 8;
timesheet.entries[1].overtimeHours = 2;
timesheet.entries[2].doubleTimeHours = 1;
timesheet.entries[3].expenses = 12.5;
assert.deepEqual(timesheetTotals(timesheet), {
  regular: 8,
  overtime: 2,
  doubleTime: 1,
  expenses: 12.5,
  totalHours: 11,
});

const quote = makeQuote(settings);
quote.items = [{ quantity: 2, unitCost: 100 }];
quote.discountAmount = 25;
assert.deepEqual(quoteTotals(quote), {
  subtotal: 200,
  discounted: 175,
  tax: 22.75,
  total: 197.75,
});

setPath(quote, "billedTo.company", "MDK Test");
assert.equal(quote.billedTo.company, "MDK Test");

const backup = validateBackup({ settings, workOrders: [], timesheets: [], quotes: [] });
assert.equal(backup.settings.companyName, "MDK Electric Ltd.");
assert.throws(() => validateBackup({}), /not a valid MDK Field backup/);

console.log("MDK data and calculation tests passed.");
