import { describe, expect, it } from 'vitest';

import { defaultSystemSettings, systemSettingsSchema } from '@/lib/platform/system-settings-schema';

describe('systemSettingsSchema', () => {
  it('provides safe maintenance defaults for the admin portal', () => {
    const parsed = systemSettingsSchema.parse({});

    expect(parsed.platformName).toBe(defaultSystemSettings.platformName);
    expect(parsed.maintenanceMode).toBe(false);
    expect(parsed.maintenanceMessage).toContain('maintenance');
  });

  it('accepts an empty public banner while preserving the maintenance message', () => {
    const parsed = systemSettingsSchema.parse({
      systemBanner: '',
      maintenanceMessage: 'Updating checkout rules right now.',
    });

    expect(parsed.systemBanner).toBe('');
    expect(parsed.maintenanceMessage).toBe('Updating checkout rules right now.');
  });
});
