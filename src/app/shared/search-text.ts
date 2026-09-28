export function normalizeSearchText(value: string | null | undefined): string {
  return (value ?? '')
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .toLowerCase()
    .replace(/ς/g, 'σ');
}

export function matchesSearch(term: string, ...fields: (string | null | undefined)[]): boolean {
  const needle = normalizeSearchText(term.trim());
  if (!needle) return true;
  return fields.some(field => normalizeSearchText(field).includes(needle));
}
