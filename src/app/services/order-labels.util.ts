const PAYMENT_STATUS_LABELS: Record<string, string> = {
  paid: 'Πληρωμένη',
  pending: 'Σε εκκρεμότητα',
  refunded: 'Επιστροφή χρημάτων',
  partially_refunded: 'Μερική επιστροφή',
  cancelled: 'Ακυρώθηκε',
};

const PAYMENT_METHOD_LABELS: Record<string, string> = {
  cod: 'Αντικαταβολή',
  card_mock: 'Κάρτα',
  bank_transfer: 'Τραπεζική κατάθεση',
};

const SHIPPING_METHOD_LABELS: Record<string, string> = {
  courier_standard: 'Τυπική Αποστολή',
  courier_express: 'Γρήγορη Αποστολή',
  pickup: 'Παραλαβή από κατάστημα',
};

export function paymentStatusLabel(paymentStatus: string, orderStatus?: string): string {
  if (orderStatus === 'cancelled' && paymentStatus === 'pending') return PAYMENT_STATUS_LABELS['cancelled'];
  return PAYMENT_STATUS_LABELS[(paymentStatus || '').toLowerCase()] ?? (paymentStatus || '—');
}

export function paymentMethodLabel(method: string): string {
  return PAYMENT_METHOD_LABELS[method] ?? (method || '—');
}

export function shippingMethodLabel(method: string): string {
  return SHIPPING_METHOD_LABELS[method] ?? (method || '—');
}
