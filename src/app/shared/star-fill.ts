export type StarFill = 'full' | 'half' | 'empty';

export const STAR_CLASSES: Record<StarFill, string> = {
  full: 'star-filled',
  half: 'star-half',
  empty: 'star-empty',
};

export function starFill(star: number, rating: number | string | null | undefined): StarFill {
  const roundedToHalf = Math.round(Number(rating || 0) * 2) / 2;
  if (star <= roundedToHalf) return 'full';
  if (star - 0.5 === roundedToHalf) return 'half';
  return 'empty';
}
