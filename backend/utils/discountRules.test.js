const { isDiscountExpired } = require('./discountRules');

describe('isDiscountExpired', () => {
  const now = new Date('2026-09-23T10:45:00Z');

  it('treats a code without an expiry date as never expiring', () => {
    expect(isDiscountExpired(null, now)).toBe(false);
  });

  it('keeps a code valid for the whole of its expiry day', () => {
    expect(isDiscountExpired('2026-09-23 00:00:00', now)).toBe(false);
    expect(isDiscountExpired('2026-09-23', now)).toBe(false);
  });

  it('expires a code once its expiry day has passed', () => {
    expect(isDiscountExpired('2026-09-22 23:59:59', now)).toBe(true);
  });

  it('switches days at midnight Athens time, whatever the server timezone', () => {
    const justBeforeAthensMidnight = new Date('2026-09-23T20:59:00Z');
    const justAfterAthensMidnight = new Date('2026-09-23T21:01:00Z');

    expect(isDiscountExpired('2026-09-23', justBeforeAthensMidnight)).toBe(false);
    expect(isDiscountExpired('2026-09-23', justAfterAthensMidnight)).toBe(true);
  });

  it('reads Date objects in Athens time as well', () => {
    expect(isDiscountExpired(new Date('2026-09-23T12:00:00Z'), now)).toBe(false);
    expect(isDiscountExpired(new Date('2026-09-22T12:00:00Z'), now)).toBe(true);
  });
});
