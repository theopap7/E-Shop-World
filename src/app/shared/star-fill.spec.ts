import { starFill } from './star-fill';

describe('starFill', () => {
  const stars = (rating: number | string | null) => [1, 2, 3, 4, 5].map(star => starFill(star, rating));

  it('shows a half star for a x.5 average', () => {
    expect(stars(3.5)).toEqual(['full', 'full', 'full', 'half', 'empty']);
  });

  it('rounds to the nearest half star', () => {
    expect(stars(4.2)).toEqual(['full', 'full', 'full', 'full', 'empty']);
    expect(stars(4.3)).toEqual(['full', 'full', 'full', 'full', 'half']);
  });

  it('accepts the decimal strings the API returns and treats missing ratings as zero', () => {
    expect(stars('3.5')).toEqual(['full', 'full', 'full', 'half', 'empty']);
    expect(stars(null)).toEqual(['empty', 'empty', 'empty', 'empty', 'empty']);
  });
});
