// Greek-locale formatting shared by the PDF invoice and the CSV export so they match the storefront.
const eurFormatter = new Intl.NumberFormat('el-GR', { style: 'currency', currency: 'EUR' });

const dateFormatter = new Intl.DateTimeFormat('el-GR', {
  day: '2-digit',
  month: '2-digit',
  year: 'numeric',
  timeZone: 'Europe/Athens',
});

const timeFormatter = new Intl.DateTimeFormat('el-GR', {
  hour: '2-digit',
  minute: '2-digit',
  hourCycle: 'h23',
  timeZone: 'Europe/Athens',
});

function toDate(value) {
  if (value === null || value === undefined || value === '') return null;
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? null : date;
}

// 1499.9 -> "1.499,90 €"
function formatEur(value) {
  return eurFormatter.format(Number(value));
}

// -> "21/09/2026"
function formatDate(value) {
  const date = toDate(value);
  return date ? dateFormatter.format(date) : '';
}

// -> "21/09/2026 13:05"
function formatDateTime(value) {
  const date = toDate(value);
  return date ? `${dateFormatter.format(date)} ${timeFormatter.format(date)}` : '';
}

function formatPhone(value) {
  const raw = String(value ?? '').replace(/\s+/g, '');
  const match = /^(?:\+30|0030)?(\d{10})$/.exec(raw);
  if (!match) return String(value ?? '');
  const digits = match[1];
  const grouped = `${digits.slice(0, 3)} ${digits.slice(3, 6)} ${digits.slice(6)}`;
  return raw.length > 10 ? `(+30) ${grouped}` : grouped;
}

function formatZip(value) {
  const raw = String(value ?? '').replace(/\s+/g, '');
  return /^\d{5}$/.test(raw) ? `${raw.slice(0, 3)} ${raw.slice(3)}` : String(value ?? '');
}

function formatFloor(value) {
  const raw = String(value ?? '').trim();
  if (!/^\d+$/.test(raw)) return raw;
  const floor = Number(raw);
  return floor === 0 ? 'Ισόγειο' : `${floor}ος`;
}

module.exports = { formatEur, formatDate, formatDateTime, formatPhone, formatZip, formatFloor };
