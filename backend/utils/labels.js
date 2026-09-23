const ORDER_STATUS_LABELS = {
  pending: 'Σε αναμονή',
  processing: 'Σε επεξεργασία',
  shipped: 'Αποστολή',
  delivered: 'Παραδόθηκε',
  cancelled: 'Ακυρώθηκε',
};

const PAYMENT_STATUS_LABELS = {
  paid: 'Πληρωμένη',
  pending: 'Σε εκκρεμότητα',
  refunded: 'Επιστροφή χρημάτων',
  partially_refunded: 'Μερική επιστροφή',
  cancelled: 'Ακυρώθηκε',
};

const PAYMENT_METHOD_LABELS = {
  cod: 'Αντικαταβολή',
  card_mock: 'Κάρτα',
  bank_transfer: 'Τραπεζική κατάθεση',
};

const SHIPPING_METHOD_LABELS = {
  courier_standard: 'Τυπική Αποστολή',
  courier_express: 'Γρήγορη Αποστολή',
  pickup: 'Παραλαβή από κατάστημα',
};

module.exports = { ORDER_STATUS_LABELS, PAYMENT_STATUS_LABELS, PAYMENT_METHOD_LABELS, SHIPPING_METHOD_LABELS };
