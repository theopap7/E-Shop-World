export const STORE_BANK_ACCOUNT = {
  holder: 'E-Shop ΙΚΕ',
  iban: 'GR16 0110 1250 0000 0001 2300 695',
  bank: 'Εθνική Τράπεζα',
};

export function formatIban(iban: string | null | undefined): string {
  return (iban ?? '').replace(/\s+/g, '').replace(/(.{4})/g, '$1 ').trim();
}
