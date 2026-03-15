import { setTestEnv } from '../test-env';

describe('client settings normalization', () => {
  beforeAll(() => {
    setTestEnv();
  });

  it('fills missing values with safe defaults', async () => {
    const { normalizeClientSettings } = await import('@/features/client/settings');

    expect(normalizeClientSettings({ answerStyle: 'detailed' })).toEqual({
      answerStyle: 'detailed',
      showConfidence: true,
      detectionMode: 'auto',
      lowCreditNotifications: true,
      theme: 'system',
      language: 'English',
    });
  });

  it('trims language values and falls back on blank input', async () => {
    const { normalizeClientSettings } = await import('@/features/client/settings');

    expect(
      normalizeClientSettings({
        language: '  Filipino  ',
      }).language,
    ).toBe('Filipino');

    expect(
      normalizeClientSettings({
        language: '   ',
      }).language,
    ).toBe('English');
  });
});
