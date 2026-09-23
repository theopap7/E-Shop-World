const { formatEur, formatDate, formatDateTime, formatPhone, formatZip, formatFloor } = require('./format');

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

describe('formatPhone', () => {
  it('groups a Greek number so spreadsheets keep it as text', () => {
    expect(formatPhone('6971313131')).toBe('697 131 3131');
    expect(formatPhone('+306971313131')).toBe('(+30) 697 131 3131');
    expect(formatPhone('00306971313131')).toBe('(+30) 697 131 3131');
  });

  it('leaves numbers it does not recognise unchanged', () => {
    expect(formatPhone('+44 20 7946 0958')).toBe('+44 20 7946 0958');
    expect(formatPhone(null)).toBe('');
  });
});

describe('formatZip', () => {
  it('splits a five-digit postcode the way Greek addresses write it', () => {
    expect(formatZip('26442')).toBe('264 42');
    expect(formatZip('264 42')).toBe('264 42');
  });

  it('leaves other values unchanged', () => {
    expect(formatZip('SW1A 1AA')).toBe('SW1A 1AA');
    expect(formatZip(null)).toBe('');
  });
});

describe('formatFloor', () => {
  it('writes numeric floors as Greek ordinals', () => {
    expect(formatFloor('1')).toBe('1ος');
    expect(formatFloor(3)).toBe('3ος');
    expect(formatFloor('0')).toBe('Ισόγειο');
  });

  it('leaves free-text floors unchanged', () => {
    expect(formatFloor('3Α')).toBe('3Α');
    expect(formatFloor(null)).toBe('');
  });
});
