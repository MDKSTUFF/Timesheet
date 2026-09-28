import { displayDate, money, quoteTotals, timesheetTotals, workOrderTotals } from "./data.js";

const PAGE_WIDTH = 215.9;
const MARGIN = 8.5;
const CONTENT_WIDTH = PAGE_WIDTH - MARGIN * 2;
const CONTENT_BOTTOM = 262;
const BLUE = [65, 110, 215];
const NAVY = [21, 35, 66];
const SLATE = [89, 111, 143];
const TEXT = [27, 38, 58];
const LINE = [207, 218, 233];
const PANEL = [246, 248, 252];
const ALT_ROW = [244, 247, 251];
let logoDataUrl;

async function getLogo() {
  if (logoDataUrl) return logoDataUrl;
  if (globalThis.__MDK_PDF_LOGO__) {
    logoDataUrl = globalThis.__MDK_PDF_LOGO__;
    return logoDataUrl;
  }
  const response = await fetch(new URL("./assets/mdk-logo.jpg", import.meta.url));
  const blob = await response.blob();
  logoDataUrl = await new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(reader.result);
    reader.onerror = reject;
    reader.readAsDataURL(blob);
  });
  return logoDataUrl;
}

function clean(value) {
  return String(value ?? "").trim() || "—";
}

function safeFilename(value) {
  return clean(value).replace(/[^a-z0-9_-]+/gi, "_");
}

function fileInfo(type, doc) {
  const labels = { workOrders: "Work_Order", timesheets: "Timesheet", quotes: "Quote" };
  return {
    filename: `${labels[type]}_${safeFilename(doc.number)}.pdf`,
    title: `${labels[type].replace("_", " ")} ${clean(doc.number)}`,
  };
}

function addCompanyHeader(pdf, settings) {
  try { pdf.addImage(logoDataUrl, "JPEG", MARGIN, 5.5, 94, 15.5); } catch { /* company text remains */ }
  pdf.setTextColor(...SLATE);
  pdf.setFont("helvetica", "bold");
  pdf.setFontSize(7.8);
  const companyLines = [settings.companyName, settings.addressLine1, settings.cityProvincePostal, `${settings.phone}  |  ${settings.website}`];
  companyLines.forEach((line, index) => pdf.text(clean(line), PAGE_WIDTH - MARGIN, 6.8 + index * 4.2, { align: "right" }));
  pdf.setFillColor(...BLUE);
  pdf.rect(MARGIN, 26.8, CONTENT_WIDTH, 1.2, "F");
  return 37;
}

function addContinuationHeading(pdf, title, number, y) {
  pdf.setFont("helvetica", "bold");
  pdf.setFontSize(10);
  pdf.setTextColor(...NAVY);
  pdf.text(`${title.toUpperCase()}  |  ${clean(number)}  |  CONTINUED`, MARGIN, y);
  return y + 6;
}

function newPage(pdf, settings, title, number) {
  pdf.addPage();
  pdf.setPage(pdf.getNumberOfPages());
  return addContinuationHeading(pdf, title, number, addCompanyHeader(pdf, settings));
}

function ensureSpace(pdf, y, height, settings, title, number) {
  return y + height <= CONTENT_BOTTOM ? y : newPage(pdf, settings, title, number);
}

function addTitle(pdf, title, number, y) {
  pdf.setTextColor(...NAVY);
  pdf.setFont("helvetica", "bold");
  pdf.setFontSize(19);
  pdf.text(title.toUpperCase(), MARGIN, y);
  pdf.setTextColor(...BLUE);
  pdf.setFontSize(11.5);
  pdf.text(clean(number), MARGIN, y + 7.2);
  return y + 14;
}

function addFooter(pdf, settings) {
  const pages = pdf.getNumberOfPages();
  for (let page = 1; page <= pages; page += 1) {
    pdf.setPage(page);
    pdf.setDrawColor(...LINE);
    pdf.setLineWidth(0.35);
    pdf.line(MARGIN, 266, PAGE_WIDTH - MARGIN, 266);
    pdf.setFont("helvetica", "normal");
    pdf.setFontSize(6.5);
    pdf.setTextColor(...SLATE);
    const footer = `${settings.companyName} · ${settings.phone} · ${settings.email} · HST ${settings.hstNumber}`;
    pdf.text(footer, PAGE_WIDTH / 2, 270.3, { align: "center" });
    if (pages > 1) pdf.text(`${page} / ${pages}`, PAGE_WIDTH - MARGIN, 270.3, { align: "right" });
  }
}

function drawPanel(pdf, x, y, width, height, label, value, options = {}) {
  pdf.setFillColor(...PANEL);
  pdf.setDrawColor(...LINE);
  pdf.setLineWidth(0.3);
  pdf.roundedRect(x, y, width, height, 2, 2, "FD");
  pdf.setFont("helvetica", "bold");
  pdf.setTextColor(...SLATE);
  pdf.setFontSize(6.7);
  pdf.text(String(label).toUpperCase(), x + 3, y + 5.2);
  pdf.setFont("helvetica", options.boldValue ? "bold" : "normal");
  pdf.setTextColor(...TEXT);
  pdf.setFontSize(options.valueSize || 8.3);
  const lines = pdf.splitTextToSize(clean(value), width - 6);
  pdf.text(lines.slice(0, options.maxLines || Math.max(1, Math.floor((height - 9) / 3.8))), x + 3, y + 10.2);
}

function drawInlinePanel(pdf, x, y, width, label, value) {
  pdf.setFillColor(...PANEL);
  pdf.setDrawColor(...LINE);
  pdf.roundedRect(x, y, width, 12, 1.6, 1.6, "FD");
  pdf.setFont("helvetica", "bold");
  pdf.setFontSize(7.6);
  pdf.setTextColor(...SLATE);
  pdf.text(label, x + 3, y + 7.5);
  pdf.setTextColor(...TEXT);
  pdf.text(clean(value), x + width - 3, y + 7.5, { align: "right" });
}

function drawDetailPanel(pdf, x, y, width, rows) {
  const rowHeight = 7.5;
  const height = rows.length * rowHeight + 1;
  pdf.setFillColor(...PANEL);
  pdf.setDrawColor(...LINE);
  pdf.roundedRect(x, y, width, height, 2, 2, "FD");
  rows.forEach(([label, value], index) => {
    const top = y + 1 + index * rowHeight;
    if (index) pdf.line(x + 3, top, x + width - 3, top);
    pdf.setFont("helvetica", "bold");
    pdf.setFontSize(7.3);
    pdf.setTextColor(...SLATE);
    pdf.text(label, x + 3, top + 4.8);
    pdf.setTextColor(...TEXT);
    pdf.text(clean(value), x + width - 3, top + 4.8, { align: "right" });
  });
  return height;
}

function sectionTitle(pdf, label, y, settings, title, number) {
  y = ensureSpace(pdf, y, 8, settings, title, number);
  pdf.setFont("helvetica", "bold");
  pdf.setFontSize(9.3);
  pdf.setTextColor(39, 75, 185);
  pdf.text(label, MARGIN, y + 4.8);
  return y + 7;
}

function drawTable(pdf, columns, rows, y, settings, title, number) {
  const totalWidth = columns.reduce((sum, column) => sum + column.width, 0);
  const scale = CONTENT_WIDTH / totalWidth;
  const widths = columns.map(column => column.width * scale);
  const drawHeader = () => {
    pdf.setFillColor(...BLUE);
    pdf.rect(MARGIN, y, CONTENT_WIDTH, 7.3, "F");
    let x = MARGIN;
    columns.forEach((column, index) => {
      pdf.setFont("helvetica", "bold");
      pdf.setFontSize(6.5);
      pdf.setTextColor(255, 255, 255);
      const align = column.align || "left";
      const textX = align === "right" ? x + widths[index] - 2 : align === "center" ? x + widths[index] / 2 : x + 2;
      pdf.text(column.label, textX, y + 4.9, { align });
      x += widths[index];
    });
    y += 7.3;
  };
  y = ensureSpace(pdf, y, 17, settings, title, number);
  drawHeader();
  if (!rows.length) {
    pdf.setFont("helvetica", "italic");
    pdf.setFontSize(7.6);
    pdf.setTextColor(123, 137, 158);
    pdf.text("No entries entered", PAGE_WIDTH / 2, y + 5.5, { align: "center" });
    pdf.setDrawColor(...LINE);
    pdf.line(MARGIN, y + 8, PAGE_WIDTH - MARGIN, y + 8);
    return y + 11;
  }
  rows.forEach((row, rowIndex) => {
    const wrapped = row.map((value, index) => pdf.splitTextToSize(clean(value), widths[index] - 4));
    const rowHeight = Math.max(7.3, Math.max(...wrapped.map(lines => lines.length)) * 3.45 + 3.2);
    if (y + rowHeight > CONTENT_BOTTOM) {
      y = newPage(pdf, settings, title, number);
      drawHeader();
    }
    if (rowIndex % 2 === 1) {
      pdf.setFillColor(...ALT_ROW);
      pdf.rect(MARGIN, y, CONTENT_WIDTH, rowHeight, "F");
    }
    pdf.setDrawColor(...LINE);
    pdf.line(MARGIN, y + rowHeight, PAGE_WIDTH - MARGIN, y + rowHeight);
    let x = MARGIN;
    wrapped.forEach((lines, index) => {
      pdf.setFont("helvetica", "bold");
      pdf.setFontSize(7.4);
      pdf.setTextColor(...TEXT);
      const align = columns[index].align || "left";
      const textX = align === "right" ? x + widths[index] - 2 : align === "center" ? x + widths[index] / 2 : x + 2;
      pdf.text(lines, textX, y + 4.8, { align });
      x += widths[index];
    });
    y += rowHeight;
  });
  return y + 3.5;
}

function drawTotals(pdf, rows, y, settings, title, number, width = 95) {
  const rowHeight = 6.5;
  const height = rows.length * rowHeight + 2;
  y = ensureSpace(pdf, y, height, settings, title, number);
  const x = PAGE_WIDTH - MARGIN - width;
  pdf.setFillColor(243, 246, 251);
  pdf.roundedRect(x, y, width, height, 2, 2, "F");
  rows.forEach(([label, value, emphasized], index) => {
    const top = y + 1 + index * rowHeight;
    if (index) {
      pdf.setDrawColor(...LINE);
      pdf.line(x + 3, top, x + width - 3, top);
    }
    pdf.setFont("helvetica", "bold");
    pdf.setFontSize(emphasized ? 10.5 : 7.7);
    pdf.setTextColor(...(emphasized ? BLUE : TEXT));
    pdf.text(label, x + 3, top + 4.5);
    pdf.text(String(value), x + width - 3, top + 4.5, { align: "right" });
  });
  return y + height + 4;
}

function drawSignatures(pdf, fields, y, settings, title, number) {
  y = ensureSpace(pdf, y, 18, settings, title, number);
  const gap = 4;
  const width = (CONTENT_WIDTH - gap * (fields.length - 1)) / fields.length;
  fields.forEach(([label, value], index) => {
    const x = MARGIN + index * (width + gap);
    pdf.setDrawColor(...SLATE);
    pdf.line(x, y + 8, x + width, y + 8);
    pdf.setFont("helvetica", "bold");
    pdf.setFontSize(8.2);
    pdf.setTextColor(...TEXT);
    if (String(value || "").trim()) pdf.text(String(value), x, y + 5.2);
    pdf.setFont("helvetica", "bold");
    pdf.setFontSize(6.2);
    pdf.setTextColor(...SLATE);
    pdf.text(label.toUpperCase(), x, y + 13);
  });
  return y + 17;
}

function addressLines(address) {
  return [address.name, address.company, address.addressLine1, address.addressLine2,
    [address.city, address.provinceState, address.postalCode].filter(Boolean).join(", "), address.country, address.phone, address.email]
    .filter(value => String(value || "").trim()).join("\n");
}

function dayName(value) {
  if (!value) return "—";
  return new Intl.DateTimeFormat("en-CA", { weekday: "long" }).format(new Date(`${value.slice(0, 10)}T12:00:00`));
}

function monthYear(value) {
  if (!value) return "—";
  return new Intl.DateTimeFormat("en-CA", { month: "long", year: "numeric" }).format(new Date(`${value.slice(0, 10)}T12:00:00`));
}

function buildWorkOrder(pdf, doc, settings, title) {
  const totals = workOrderTotals(doc);
  let y = addTitle(pdf, title, doc.number, addCompanyHeader(pdf, settings));
  const gap = 3;
  const leftWidth = 97.5;
  const rightWidth = CONTENT_WIDTH - leftWidth - gap;
  const detailHeight = 31;
  drawPanel(pdf, MARGIN, y, leftWidth, detailHeight, "Customer", doc.customer, { boldValue: true, maxLines: 5 });
  drawDetailPanel(pdf, MARGIN + leftWidth + gap, y, rightWidth, [
    ["Job No.", doc.jobNumber], ["Date", displayDate(doc.date)], ["Completed By", doc.completedBy], ["Incident No.", doc.incidentNumber],
  ]);
  y += detailHeight + 5;
  const workLines = pdf.splitTextToSize(clean(doc.workCompleted), CONTENT_WIDTH - 6);
  const workHeight = Math.max(25, workLines.length * 3.8 + 12);
  drawPanel(pdf, MARGIN, y, CONTENT_WIDTH, workHeight, "Work completed", doc.workCompleted, { boldValue: true, maxLines: 12 });
  y += workHeight + 4;
  y = sectionTitle(pdf, "Materials", y, settings, title, doc.number);
  y = drawTable(pdf, [
    { label: "Qty", width: 18 }, { label: "Description", width: 92 }, { label: "Unit Cost", width: 35 }, { label: "Extension", width: 38, align: "right" },
  ], doc.materials.map(row => [row.quantity, row.description, money(row.unitCost), money((Number(row.quantity) || 0) * (Number(row.unitCost) || 0))]), y, settings, title, doc.number);
  y = sectionTitle(pdf, "Labour", y, settings, title, doc.number);
  y = drawTable(pdf, [
    { label: "Date", width: 36 }, { label: "Name", width: 54 }, { label: "Hours", width: 22 }, { label: "Rate", width: 33 }, { label: "Extension", width: 38, align: "right" },
  ], doc.labour.map(row => [displayDate(row.date), row.name, row.hours, money(row.hourlyRate), money((Number(row.hours) || 0) * (Number(row.hourlyRate) || 0))]), y, settings, title, doc.number);
  y = sectionTitle(pdf, "Expenses", y, settings, title, doc.number);
  y = drawTable(pdf, [
    { label: "Date", width: 34 }, { label: "Name", width: 42 }, { label: "Description", width: 72 }, { label: "Amount", width: 35, align: "right" },
  ], doc.expenses.map(row => [displayDate(row.date), row.employeeName, row.description, money(row.amount)]), y, settings, title, doc.number);
  y = drawTotals(pdf, [
    ["Material", money(totals.material)], ["Labour", money(totals.labour)], ["Expenses", money(totals.expenses)], ["Subtotal", money(totals.subtotal)],
    [`HST (${(Number(doc.taxRate || 0) * 100).toFixed(1)}%)`, money(totals.tax)], ["AMOUNT OWING", money(totals.total), true],
  ], y, settings, title, doc.number);
  y = drawSignatures(pdf, [["Authorized By", doc.authorizedBy], ["Customer PO", doc.customerPO], ["Date", displayDate(doc.authorizationDate)]], y, settings, title, doc.number);
  if (doc.internalNotes) drawPanel(pdf, MARGIN, ensureSpace(pdf, y, 20, settings, title, doc.number), CONTENT_WIDTH, 18, "Internal notes", doc.internalNotes, { maxLines: 2 });
}

function buildTimesheet(pdf, doc, settings, title) {
  const totals = timesheetTotals(doc);
  let y = addTitle(pdf, title, doc.number, addCompanyHeader(pdf, settings));
  const gap = 3;
  const cellWidth = (CONTENT_WIDTH - gap * 2) / 3;
  drawInlinePanel(pdf, MARGIN, y, cellWidth, "Employee", doc.employee);
  drawInlinePanel(pdf, MARGIN + cellWidth + gap, y, cellWidth, "Month", monthYear(doc.weekEnding));
  drawInlinePanel(pdf, MARGIN + (cellWidth + gap) * 2, y, cellWidth, "Week Ending", displayDate(doc.weekEnding));
  y += 18;
  y = drawTable(pdf, [
    { label: "Day", width: 25 }, { label: "Date", width: 27 }, { label: "Customer / PO", width: 34 }, { label: "Job Description", width: 57 },
    { label: "Reg", width: 12, align: "center" }, { label: "1.5", width: 12, align: "center" }, { label: "2.0", width: 12, align: "center" }, { label: "Expenses", width: 22, align: "right" },
  ], doc.entries.slice().sort((a, b) => String(a.date).localeCompare(String(b.date))).map(row => [dayName(row.date), displayDate(row.date), row.customerPO, row.jobDescription, row.regularHours, row.overtimeHours, row.doubleTimeHours, money(row.expenses)]), y, settings, title, doc.number);
  y = drawTotals(pdf, [
    ["Regular Hours", totals.regular.toFixed(2)], ["1.5x Hours", totals.overtime.toFixed(2)], ["2x Hours", totals.doubleTime.toFixed(2)],
    ["Total Hours", totals.totalHours.toFixed(2), true], ["Expenses", money(totals.expenses)],
  ], y, settings, title, doc.number, 108);
  y = drawSignatures(pdf, [["Signature", doc.signatureName], ["Date", displayDate(doc.signedDate)]], y, settings, title, doc.number);
  if (doc.notes) drawPanel(pdf, MARGIN, ensureSpace(pdf, y, 20, settings, title, doc.number), CONTENT_WIDTH, 18, "Notes", doc.notes, { maxLines: 2 });
}

function buildQuote(pdf, doc, settings, title) {
  const totals = quoteTotals(doc);
  let y = addTitle(pdf, title, doc.number, addCompanyHeader(pdf, settings));
  const gap = 3;
  const half = (CONTENT_WIDTH - gap) / 2;
  const shipping = doc.useBillingForShipping ? doc.billedTo : doc.shipTo;
  drawPanel(pdf, MARGIN, y, half, 35, "Billed to", addressLines(doc.billedTo), { boldValue: true, maxLines: 7 });
  drawPanel(pdf, MARGIN + half + gap, y, half, 35, "Ship to", addressLines(shipping), { boldValue: true, maxLines: 7 });
  y += 41;
  const thirds = (CONTENT_WIDTH - gap * 2) / 3;
  drawInlinePanel(pdf, MARGIN, y, thirds, "Date", displayDate(doc.date));
  drawInlinePanel(pdf, MARGIN + thirds + gap, y, thirds, "Customer ID", doc.customerID);
  drawInlinePanel(pdf, MARGIN + (thirds + gap) * 2, y, thirds, "Purchase Order", doc.purchaseOrder);
  y += 17;
  drawInlinePanel(pdf, MARGIN, y, CONTENT_WIDTH, "Quote Valid Until", displayDate(doc.validUntil));
  y += 15;
  y = drawTable(pdf, [
    { label: "Description", width: 105 }, { label: "Unit Cost", width: 34 }, { label: "Qty", width: 18, align: "center" }, { label: "Amount", width: 36, align: "right" },
  ], doc.items.map(row => [row.description, money(row.unitCost, doc.currencyCode), row.quantity, money((Number(row.unitCost) || 0) * (Number(row.quantity) || 0), doc.currencyCode)]), y, settings, title, doc.number);
  const bottomHeight = Math.max(34, doc.specialNotes ? pdf.splitTextToSize(doc.specialNotes, half - 6).length * 3.8 + 12 : 34);
  y = ensureSpace(pdf, y, Math.max(bottomHeight, 31), settings, title, doc.number);
  drawPanel(pdf, MARGIN, y, half, bottomHeight, "Special notes and instructions", doc.specialNotes, { maxLines: 8 });
  drawTotals(pdf, [
    ["Subtotal", money(totals.subtotal, doc.currencyCode)], ["Discount", money(-Number(doc.discountAmount || 0), doc.currencyCode)],
    [`Tax (${(Number(doc.taxRate || 0) * 100).toFixed(1)}%)`, money(totals.tax, doc.currencyCode)], ["TOTAL", money(totals.total, doc.currencyCode), true],
  ], y, settings, title, doc.number, half);
}

export async function makePdf(type, doc, settings) {
  const jsPdfLibrary = globalThis.jspdf || globalThis.window?.jspdf;
  if (!jsPdfLibrary?.jsPDF) throw new Error("The PDF creator did not load. Refresh and try again.");
  logoDataUrl = await getLogo();
  const pdf = new jsPdfLibrary.jsPDF({ unit: "mm", format: "letter", compress: true });
  const info = fileInfo(type, doc);
  const title = type === "workOrders" ? "Work Order" : type === "timesheets" ? "Timesheet" : "Quote";
  if (type === "workOrders") buildWorkOrder(pdf, doc, settings, title);
  if (type === "timesheets") buildTimesheet(pdf, doc, settings, title);
  if (type === "quotes") buildQuote(pdf, doc, settings, title);
  addFooter(pdf, settings);
  pdf.setProperties({ title: info.title, subject: `${settings.companyName} field document`, author: settings.companyName, creator: "MDK Field Web App" });
  return { pdf, ...info };
}

export async function savePdf(type, doc, settings) {
  const result = await makePdf(type, doc, settings);
  result.pdf.save(result.filename);
  return result.filename;
}

export async function sharePdf(type, doc, settings) {
  const result = await makePdf(type, doc, settings);
  const blob = result.pdf.output("blob");
  const file = new File([blob], result.filename, { type: "application/pdf" });
  if (navigator.share && navigator.canShare?.({ files: [file] })) {
    await navigator.share({ title: result.title, text: `${settings.companyName} - ${result.title}`, files: [file] });
    return { shared: true, filename: result.filename };
  }
  result.pdf.save(result.filename);
  return { shared: false, filename: result.filename };
}
