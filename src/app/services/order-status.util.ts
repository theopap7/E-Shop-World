export function statusLabel(status: string): string {
  switch ((status || '').toLowerCase()) {
    case 'pending': return 'Σε αναμονή';
    case 'processing': return 'Σε επεξεργασία';
    case 'shipped': return 'Αποστολή';
    case 'delivered': return 'Παραδόθηκε';
    case 'cancelled': return 'Ακυρώθηκε';
    default: return status || '—';
  }
}
