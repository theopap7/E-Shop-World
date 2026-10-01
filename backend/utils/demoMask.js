const DEMO_ROLE = 'demo';

function maskWord(word) {
  return word ? `${word[0]}***` : word;
}

function maskName(value) {
  return String(value).trim().split(/\s+/).map(maskWord).join(' ');
}

function maskEmail(value) {
  const [local, domain] = String(value).split('@');
  return domain ? `${maskWord(local)}@${domain}` : maskWord(local);
}

function maskPhone(value) {
  const digits = String(value).replace(/\s+/g, '');
  return `${'*'.repeat(Math.max(digits.length - 2, 0))}${digits.slice(-2)}`;
}

function maskText() {
  return '***';
}

const FIELD_MASKS = {
  first_name: maskName,
  last_name: maskName,
  recipient_name: maskName,
  email: maskEmail,
  user_email: maskEmail,
  phone: maskPhone,
  customer_phone: maskPhone,
  ship_address1: maskText,
  ship_notes: maskText,
  gift_message: maskText,
  payment_iban: maskText,
};

function maskCustomer(row) {
  const masked = { ...row };
  for (const [field, mask] of Object.entries(FIELD_MASKS)) {
    if (masked[field] !== null && masked[field] !== undefined && masked[field] !== '') {
      masked[field] = mask(masked[field]);
    }
  }
  return masked;
}

function isDemo(req) {
  return req.user?.role === DEMO_ROLE;
}

function maskForDemo(req, data) {
  if (!isDemo(req)) return data;
  return Array.isArray(data) ? data.map(maskCustomer) : maskCustomer(data);
}

module.exports = { DEMO_ROLE, isDemo, maskCustomer, maskForDemo, maskName, maskEmail, maskPhone };
