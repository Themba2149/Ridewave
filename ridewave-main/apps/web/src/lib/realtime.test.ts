import { describe, expect, it } from 'vitest';
import { invalidationsFor } from './realtime';

describe('real-time invalidation', () => {
  it('refreshes ride, driver and admin data when a ride changes', () => {
    const keys = invalidationsFor('ride:updated').map((k) => k[0]);
    expect(keys).toEqual(expect.arrayContaining(['ride', 'rides', 'driver-requests', 'driver-rides', 'admin']));
  });
  it('refreshes payment views and notifications for their own events', () => {
    expect(invalidationsFor('payment:updated').map((k) => k[0])).toEqual(expect.arrayContaining(['ride', 'receipt', 'payment']));
    expect(invalidationsFor('notification:new')).toEqual([['notifications']]);
  });
});
