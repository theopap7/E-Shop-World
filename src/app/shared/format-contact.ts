export function formatPhone(value: string | null | undefined): string {
  const raw = String(value ?? '').replace(/\s+/g, '');
  const match = /^(?:\+30|0030)?(\d{10})$/.exec(raw);
  if (!match) return String(value ?? '');
  const digits = match[1];
  const grouped = `${digits.slice(0, 3)} ${digits.slice(3, 6)} ${digits.slice(6)}`;
  return raw.length > 10 ? `(+30) ${grouped}` : grouped;
}
