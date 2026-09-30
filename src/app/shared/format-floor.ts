export function formatFloor(floor: string | null | undefined): string {
  const raw = String(floor ?? '').trim();
  if (!/^\d+$/.test(raw)) return raw;
  const n = Number(raw);
  return n === 0 ? 'Ισόγειο' : `${n}ος`;
}
