export function statusLabel(status: string): string {
  switch ((status || '').toLowerCase()) {
    case 'pending': return 'Σε Αναμονή';
    case 'processing': return 'Σε Επεξεργασία';
    case 'shipped': return 'Αποστολή';
    case 'delivered': return 'Παραδόθηκε';
    case 'cancelled': return 'Ακυρώθηκε';
    default: return status || '—';
  }
}
