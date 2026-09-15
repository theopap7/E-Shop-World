function requiresManualPaymentConfirmation(paymentMethod) {
  return paymentMethod === 'bank_transfer';
}
module.exports = { requiresManualPaymentConfirmation };
