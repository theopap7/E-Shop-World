export const CLOTHING_SIZES = ['XS', 'S', 'M', 'L', 'XL', 'XXL'];
export const SHOE_SIZES = ['36', '37', '38', '39', '40', '41', '42', '43', '44', '45'];

const SIZE_ORDER = [...CLOTHING_SIZES, ...SHOE_SIZES];

export function sortSizes(sizes: string[]): string[] {
  return [...sizes].sort((a, b) => SIZE_ORDER.indexOf(a) - SIZE_ORDER.indexOf(b));
}
