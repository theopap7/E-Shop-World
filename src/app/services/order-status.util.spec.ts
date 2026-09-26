import { statusLabel } from './order-status.util';

describe('statusLabel', () => {
  it('labels a shipped courier order as sent', () => {
    expect(statusLabel('shipped', 'courier_standard')).toBe('Απεστάλη');
  });

  it('labels a shipped pickup order as ready for collection', () => {
    expect(statusLabel('shipped', 'pickup')).toBe('Έτοιμη για παραλαβή');
  });

  it('keeps the other statuses the same for pickup orders', () => {
    expect(statusLabel('delivered', 'pickup')).toBe('Παραδόθηκε');
  });
});
