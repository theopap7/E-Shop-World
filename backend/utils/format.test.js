const { formatEur, formatDate, formatDateTime } = require('./format');

describe('formatEur', () => {
  it('uses Greek grouping, decimal comma and a trailing euro sign', () => {
    expect(formatEur(1499.9)).toBe('1.499,90 €');
    expect(formatEur('12.5')).toBe('12,50 €');
    expect(formatEur(0)).toBe('0,00 €');
  });
});

describe('formatDate', () => {
  it('zero-pads day and month', () => {
    expect(formatDate('2026-09-21T10:00:00Z')).toBe('21/09/2026');
    expect(formatDate('2026-01-05T10:00:00Z')).toBe('05/01/2026');
  });

  it('returns an empty string for an invalid date', () => {
    expect(formatDate(undefined)).toBe('');
    expect(formatDate('not a date')).toBe('');
  });
});

describe('formatDateTime', () => {
  it('uses a 24-hour clock in Athens time', () => {
    expect(formatDateTime('2026-09-21T13:05:00Z')).toBe('21/09/2026 16:05');
    expect(formatDateTime('2026-09-21T21:30:00Z')).toBe('22/09/2026 00:30');
  });

  it('returns an empty string for an invalid date', () => {
    expect(formatDateTime(null)).toBe('');
  });
});
