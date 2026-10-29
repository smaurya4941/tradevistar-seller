import {
  changePasswordAndRenew,
  confirmContactAndRenew,
} from '../accountChanges';

describe('password change renews the session', () => {
  it('renews after the change, in that order, and reports the revoked sessions', async () => {
    const order: string[] = [];
    const revoked = await changePasswordAndRenew({
      change: async () => {
        order.push('change');
        return { otherSessionsRevoked: 2 };
      },
      renewSession: async () => {
        order.push('renew');
      },
    });
    expect(revoked).toBe(2);
    expect(order).toEqual(['change', 'renew']);
  });

  it('does not renew when the change is refused', async () => {
    const renewSession = jest.fn(async () => undefined);
    await expect(
      changePasswordAndRenew({
        change: async () => {
          throw new Error('wrong password');
        },
        renewSession,
      }),
    ).rejects.toThrow('wrong password');
    expect(renewSession).not.toHaveBeenCalled();
  });

  it('still succeeds when the renew fails, and says so', async () => {
    const onRenewFailed = jest.fn();
    const revoked = await changePasswordAndRenew({
      change: async () => ({ otherSessionsRevoked: 0 }),
      renewSession: async () => {
        throw new Error('offline');
      },
      onRenewFailed,
    });
    expect(revoked).toBe(0);
    expect(onRenewFailed).toHaveBeenCalledTimes(1);
  });
});

describe('login contact change renews the session', () => {
  it('renews after the code is confirmed and returns the new contacts', async () => {
    const order: string[] = [];
    const result = await confirmContactAndRenew({
      confirm: async () => {
        order.push('confirm');
        return { emailAddress: 'new@shop.in', mobileNumber: null };
      },
      renewSession: async () => {
        order.push('renew');
      },
    });
    expect(result.emailAddress).toBe('new@shop.in');
    expect(order).toEqual(['confirm', 'renew']);
  });

  it('does not renew when the code is wrong', async () => {
    const renewSession = jest.fn(async () => undefined);
    await expect(
      confirmContactAndRenew({
        confirm: async () => {
          throw new Error('bad code');
        },
        renewSession,
      }),
    ).rejects.toThrow('bad code');
    expect(renewSession).not.toHaveBeenCalled();
  });
});
