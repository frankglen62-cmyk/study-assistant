import { setTestEnv } from '../test-env';

describe('email challenge helpers', () => {
  beforeAll(() => {
    setTestEnv();
  });

  it('creates and verifies a login approval request token', async () => {
    const { createSignedEmailLoginRequestToken, verifySignedEmailLoginRequestToken } = await import('@/lib/auth/email-challenge');

    const token = await createSignedEmailLoginRequestToken({
      userId: '5b090d08-c11f-4a77-b68a-c9a95010c0c5',
      email: 'owner@example.com',
      nextPath: '/dashboard',
    });

    const payload = await verifySignedEmailLoginRequestToken(token);

    expect(payload).toMatchObject({
      userId: '5b090d08-c11f-4a77-b68a-c9a95010c0c5',
      email: 'owner@example.com',
      nextPath: '/dashboard',
      kind: 'email_login_request',
    });
  });

  it('creates and verifies an email login session token', async () => {
    const { createSignedEmailLoginSessionToken, verifySignedEmailLoginSessionToken } = await import('@/lib/auth/email-challenge');

    const token = await createSignedEmailLoginSessionToken({
      userId: 'c7bad17d-fccc-4f3e-a43d-5b846d42aaf7',
      signInAt: '2026-03-26T12:00:00.000Z',
    });

    const payload = await verifySignedEmailLoginSessionToken(token);

    expect(payload).toMatchObject({
      userId: 'c7bad17d-fccc-4f3e-a43d-5b846d42aaf7',
      signInAt: '2026-03-26T12:00:00.000Z',
      kind: 'email_login_session',
    });
  });

  it('creates and verifies an email change approval token', async () => {
    const { createSignedEmailChangeRequestToken, verifySignedEmailChangeRequestToken } = await import('@/lib/auth/email-challenge');

    const token = await createSignedEmailChangeRequestToken({
      userId: 'eaab7d3f-3066-4521-ac7d-49e5d7f90a11',
      currentEmail: 'old@example.com',
      targetEmail: 'new@example.com',
      nextPath: '/account',
    });

    const payload = await verifySignedEmailChangeRequestToken(token);

    expect(payload).toMatchObject({
      userId: 'eaab7d3f-3066-4521-ac7d-49e5d7f90a11',
      currentEmail: 'old@example.com',
      targetEmail: 'new@example.com',
      nextPath: '/account',
      kind: 'email_change_request',
    });
  });

  it('rejects tampered tokens', async () => {
    const { createSignedEmailLoginRequestToken, verifySignedEmailLoginRequestToken } = await import('@/lib/auth/email-challenge');

    const token = await createSignedEmailLoginRequestToken({
      userId: '5b090d08-c11f-4a77-b68a-c9a95010c0c5',
      email: 'owner@example.com',
      nextPath: '/dashboard',
    });

    const tampered = `${token.slice(0, -1)}A`;

    await expect(verifySignedEmailLoginRequestToken(tampered)).resolves.toBeNull();
  });
});
