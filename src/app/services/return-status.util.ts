export function returnStatusLabel(status: string): string {
  switch ((status || '').toLowerCase()) {
    case 'pending': return 'Σε αναμονή';
    case 'approved': return 'Εγκρίθηκε';
    case 'rejected': return 'Απορρίφθηκε';
    case 'partially_approved': return 'Εγκρίθηκε μερικώς';
    default: return status || '—';
  }
}

export function returnItemSymbol(status: string): string {
  switch (status) {
    case 'approved': return '✓';
    case 'rejected': return '✕';
    default: return '↩';
  }
}
