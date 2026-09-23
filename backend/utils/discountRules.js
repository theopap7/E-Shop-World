const athensDateFormatter = new Intl.DateTimeFormat('en-CA', {
  year: 'numeric',
  month: '2-digit',
  day: '2-digit',
  timeZone: 'Europe/Athens',
});

function isDiscountExpired(expiresAt, now = new Date()) {
  if (!expiresAt) return false;
  const expiryDay = expiresAt instanceof Date ? athensDateFormatter.format(expiresAt) : String(expiresAt).slice(0, 10);
  return expiryDay < athensDateFormatter.format(now);
}

module.exports = { isDiscountExpired };
