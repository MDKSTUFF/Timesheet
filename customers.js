export const newCustomer = () => ({ id: crypto.randomUUID(), name: '', company: '', addressLine1: '', addressLine2: '', city: '', provinceState: '', postalCode: '', country: 'Canada', phone: '', email: '', customerID: '', notes: '' });
export function applyCustomer(type, doc, customer) {
  const fields = ['name', 'company', 'addressLine1', 'addressLine2', 'city', 'provinceState', 'postalCode', 'country', 'phone', 'email'];
  const details = Object.fromEntries(fields.map(field => [field, customer[field] || '']));
  doc.customerRecordId = customer.id;
  doc.customerID = customer.customerID || '';
  if (type === 'quotes') {
    doc.billedTo = details;
  } else if (type === 'workOrders') {
    doc.customer = customer.company || customer.name;
    doc.customerDetails = details;
  }
}
