import { setTestEnv } from '../test-env';

describe('wallet guards', () => {
  beforeAll(() => {
    setTestEnv();
  });

  it('allows spendable wallets to continue', async () => {
    const { assertWalletSpendable } = await import('@/lib/billing/wallet');

    expect(() =>
      assertWalletSpendable({
        walletStatus: 'active',
        remainingSeconds: 600,
        requiredSeconds: 60,
      }),
    ).not.toThrow();
  });

  it('blocks locked wallets before debiting', async () => {
    const { assertWalletSpendable } = await import('@/lib/billing/wallet');

    expect(() =>
      assertWalletSpendable({
        walletStatus: 'locked',
        remainingSeconds: 600,
        requiredSeconds: 60,
      }),
    ).toThrow(/locked/i);
  });

  it('blocks insufficient balance before debiting', async () => {
    const { assertWalletSpendable } = await import('@/lib/billing/wallet');

    expect(() =>
      assertWalletSpendable({
        walletStatus: 'active',
        remainingSeconds: 30,
        requiredSeconds: 60,
      }),
    ).toThrow(/enough credits/i);
  });
});
