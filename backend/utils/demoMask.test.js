const { maskCustomer, maskForDemo, maskName, maskEmail, maskPhone } = require('./demoMask');

describe('demoMask', () => {
  it('keeps only the first letter of each word in a name', () => {
    expect(maskName('Γιώργος Παπαδόπουλος')).toBe('Γ*** Π***');
  });

  it('masks the local part of an email and keeps the domain', () => {
    expect(maskEmail('george@example.com')).toBe('g***@example.com');
  });

  it('keeps only the last two digits of a phone number', () => {
    expect(maskPhone('6912345678')).toBe('********78');
  });

  it('masks customer fields and leaves order data untouched', () => {
    const row = {
      id: 7,
      total_amount: '59.99',
      ship_city: 'Αθήνα',
      first_name: 'Γιώργος',
      last_name: 'Παπαδόπουλος',
      email: 'george@example.com',
      phone: '6912345678',
      ship_address1: 'Ερμού 10',
      payment_iban: 'GR1601101250000000012300695',
      ship_notes: null,
    };

    expect(maskCustomer(row)).toEqual({
      id: 7,
      total_amount: '59.99',
      ship_city: 'Αθήνα',
      first_name: 'Γ***',
      last_name: 'Π***',
      email: 'g***@example.com',
      phone: '********78',
      ship_address1: '***',
      payment_iban: '***',
      ship_notes: null,
    });
  });

  it('masks every row for a demo user', () => {
    const req = { user: { id: 1, role: 'demo' } };
    const rows = [{ email: 'a@b.com' }, { email: 'c@d.com' }];

    expect(maskForDemo(req, rows)).toEqual([{ email: 'a***@b.com' }, { email: 'c***@d.com' }]);
  });

  it('returns the data unchanged for an admin', () => {
    const req = { user: { id: 1, role: 'admin' } };
    const rows = [{ email: 'a@b.com' }];

    expect(maskForDemo(req, rows)).toBe(rows);
  });
});
