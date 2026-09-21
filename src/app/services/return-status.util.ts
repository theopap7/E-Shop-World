export function returnStatusLabel(status: string): string {
  switch ((status || '').toLowerCase()) {
    case 'pending': return 'Σε αναμονή';
    case 'approved': return 'Εγκρίθηκε';
    case 'rejected': return 'Απορρίφθηκε';
    default: return status || '—';
  }
}
