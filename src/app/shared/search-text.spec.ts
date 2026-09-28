import { matchesSearch, normalizeSearchText } from './search-text';

describe('normalizeSearchText', () => {
  it('drops Greek accents and diaeresis and lowercases', () => {
    expect(normalizeSearchText('Παπούτσια')).toBe('παπουτσια');
    expect(normalizeSearchText('ΪΫ ϊΰ')).toBe('ιυ ιυ');
  });

  it('treats final sigma like a regular sigma', () => {
    expect(normalizeSearchText('Ρούχας')).toBe('ρουχασ');
  });
});

describe('matchesSearch', () => {
  it('matches regardless of accents on either side', () => {
    expect(matchesSearch('παπουτσια', 'Παπούτσια')).toBeTrue();
    expect(matchesSearch('Μαρία', 'Μαρια Λιβανη')).toBeTrue();
  });

  it('matches when any of the fields contains the term', () => {
    expect(matchesSearch('βιβλ', 'Harry Potter', null, 'Βιβλία')).toBeTrue();
    expect(matchesSearch('ρουχα', 'Harry Potter', 'Βιβλία')).toBeFalse();
  });

  it('matches everything for an empty term', () => {
    expect(matchesSearch('  ', 'Οτιδήποτε')).toBeTrue();
  });
});
