import { beforeEach, vi } from 'vitest';

// Every test file gets in-memory stand-ins for these repositories, so no test touches a real database.
vi.mock('../repositories/settings.repository', async () => ({ settingsRepository: (await import('./helpers/fake-extras')).extras.settingsRepo }));
vi.mock('../repositories/notifications.repository', async () => ({ notificationsRepository: (await import('./helpers/fake-extras')).extras.notificationsRepo }));
vi.mock('../repositories/payments.repository', async () => ({ paymentsRepository: (await import('./helpers/fake-extras')).extras.paymentsRepo }));

beforeEach(async () => {
  (await import('./helpers/fake-extras')).extras.reset();
  (await import('../services/settings.service')).resetSettingsCache();
});
