import { setTestEnv } from '../test-env';

describe('extension token helpers', () => {
  beforeAll(() => {
    setTestEnv();
  });

  it('issues and verifies extension access tokens', async () => {
    const { createExtensionAccessToken, verifyExtensionAccessToken } = await import('@/lib/auth/extension-tokens');

    const token = createExtensionAccessToken({
      installationId: '0c8b8ff0-1ff1-4bb3-96da-50529fc88a01',
      userId: 'eaab7d3f-3066-4521-ac7d-49e5d7f90a11',
      ttlSeconds: 300,
    });

    const payload = verifyExtensionAccessToken(token);

    expect(payload.installationId).toBe('0c8b8ff0-1ff1-4bb3-96da-50529fc88a01');
    expect(payload.userId).toBe('eaab7d3f-3066-4521-ac7d-49e5d7f90a11');
    expect(payload.type).toBe('extension_access');
  });
});
