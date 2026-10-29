/**
 * Bank verification on the add-account form: the IFSC is checked once it is complete and the buyer
 * pauses; the account only once the IFSC is genuine and the number is confirmed; every answer
 * belongs to the exact input it was for, so a stale reply is never used and its token never sent.
 */
import type { BankVerificationResult } from '@tradevistar/seller-api';
import React from 'react';
import { act, create } from 'react-test-renderer';

const mockVerify = jest.fn();
jest.mock('@tradevistar/seller-api', () => ({
  ...jest.requireActual('@tradevistar/seller-api'),
  verifyBankDetails: (...args: unknown[]) => mockVerify(...args),
}));

import {
  useBankVerification,
  type BankVerification,
} from '../useBankVerification';

const IFSC = 'HDFC0001234';
const ACCOUNT = '123456789012';

const result = (
  patch: Partial<BankVerificationResult>,
): BankVerificationResult =>
  ({
    verified: false,
    ifscVerified: false,
    bankAccountVerified: false,
    ifsc: IFSC,
    bankName: null,
    branch: null,
    message: '',
    reason: null,
    verificationToken: null,
    ...patch,
  } as BankVerificationResult);

interface Inputs {
  ifsc: string;
  account: string;
  onIfsc?: (result: BankVerificationResult) => void;
}

function mount(initial: Inputs) {
  const out = { current: undefined as unknown as BankVerification };
  function Probe(props: Inputs) {
    out.current = useBankVerification(props.ifsc, props.account, props.onIfsc);
    return null;
  }
  let renderer!: ReturnType<typeof create>;
  act(() => {
    renderer = create(<Probe {...initial} />);
  });
  return {
    out,
    update: (next: Inputs) =>
      act(() => {
        renderer.update(<Probe {...next} />);
      }),
  };
}

/** Lets timers and resolved promises run. */
async function flush(ms = 0) {
  await act(async () => {
    jest.advanceTimersByTime(ms);
  });
  await act(async () => {
    await Promise.resolve();
  });
}

beforeEach(() => {
  jest.useFakeTimers();
  mockVerify.mockReset();
});
afterEach(() => jest.useRealTimers());

describe('IFSC', () => {
  it('does nothing until the IFSC is complete', async () => {
    const { out } = mount({ ifsc: 'HDFC000123', account: '' });
    await flush(2000);
    expect(mockVerify).not.toHaveBeenCalled();
    expect(out.current.ifscPhase).toBe('idle');
    expect(out.current.verifying).toBe(false);
  });

  it('waits for a pause in typing, then verifies and fills the bank and branch', async () => {
    const onIfsc = jest.fn();
    mockVerify.mockResolvedValue(
      result({
        ifscVerified: true,
        bankName: 'HDFC Bank',
        branch: 'Fort',
        message: 'ok',
      }),
    );
    const { out } = mount({ ifsc: IFSC, account: '', onIfsc });
    expect(out.current.ifscPhase).toBe('verifying');
    expect(out.current.verifying).toBe(true);
    await flush(399);
    expect(mockVerify).not.toHaveBeenCalled();
    await flush(1);
    expect(mockVerify).toHaveBeenCalledWith(
      { ifsc: IFSC },
      expect.any(AbortSignal),
    );
    expect(out.current.ifscPhase).toBe('verified');
    expect(onIfsc).toHaveBeenCalledWith(
      expect.objectContaining({ bankName: 'HDFC Bank', branch: 'Fort' }),
    );
  });

  it('upper-cases what was typed', async () => {
    mockVerify.mockResolvedValue(result({ ifscVerified: true }));
    mount({ ifsc: 'hdfc0001234', account: '' });
    await flush(400);
    expect(mockVerify).toHaveBeenCalledWith(
      { ifsc: IFSC },
      expect.any(AbortSignal),
    );
  });

  it("shows the service's reason when the IFSC is refused, and does not fill anything", async () => {
    const onIfsc = jest.fn();
    mockVerify.mockResolvedValue(
      result({ ifscVerified: false, message: 'Invalid IFSC' }),
    );
    const { out } = mount({ ifsc: IFSC, account: ACCOUNT, onIfsc });
    await flush(400);
    expect(out.current.ifscPhase).toBe('failed');
    expect(out.current.ifscMessage).toBe('Invalid IFSC');
    expect(onIfsc).not.toHaveBeenCalled();
    // A refused IFSC never goes on to spend an account check.
    await flush(2000);
    expect(mockVerify).toHaveBeenCalledTimes(1);
  });

  it('does not ask again for an IFSC it has already answered', async () => {
    mockVerify.mockResolvedValue(result({ ifscVerified: true }));
    const { update } = mount({ ifsc: IFSC, account: '' });
    await flush(400);
    update({ ifsc: 'ICIC0001234', account: '' });
    update({ ifsc: IFSC, account: '' });
    await flush(2000);
    // HDFC once, ICIC once (in flight, cancelled by the switch back — then HDFC is settled).
    const asked = mockVerify.mock.calls.map(call => call[0].ifsc);
    expect(asked.filter((ifsc: string) => ifsc === IFSC)).toHaveLength(1);
  });

  it('cancels a lookup in flight when the IFSC changes, and ignores its late answer', async () => {
    let resolveFirst: (value: BankVerificationResult) => void = () => undefined;
    mockVerify
      .mockImplementationOnce(
        () =>
          new Promise<BankVerificationResult>(resolve => {
            resolveFirst = resolve;
          }),
      )
      .mockResolvedValueOnce(
        result({ ifscVerified: false, message: 'Second said no' }),
      );
    const onIfsc = jest.fn();
    const { out, update } = mount({ ifsc: IFSC, account: '', onIfsc });
    await flush(400);
    const firstSignal = mockVerify.mock.calls[0][1] as AbortSignal;
    update({ ifsc: 'ICIC0001234', account: '', onIfsc });
    expect(firstSignal.aborted).toBe(true);
    // The first answer arrives late, saying "verified" for the old IFSC.
    await act(async () => {
      resolveFirst(result({ ifscVerified: true, bankName: 'Old bank' }));
    });
    expect(onIfsc).not.toHaveBeenCalled();
    await flush(400);
    expect(out.current.ifscPhase).toBe('failed');
    expect(out.current.ifscMessage).toBe('Second said no');
  });

  it('reports an unreachable service as an error and tries again on the next change', async () => {
    mockVerify.mockRejectedValueOnce(new Error('offline'));
    const { out, update } = mount({ ifsc: IFSC, account: '' });
    await flush(400);
    expect(out.current.ifscPhase).toBe('error');
    expect(out.current.verifying).toBe(false);
    mockVerify.mockResolvedValueOnce(result({ ifscVerified: true }));
    update({ ifsc: 'ICIC0001234', account: '' });
    update({ ifsc: IFSC, account: '' });
    await flush(400);
    expect(out.current.ifscPhase).toBe('verified');
  });
});

describe('account', () => {
  const verifiedIfsc = () =>
    mockVerify.mockImplementation(async (body: { accountNumber?: string }) =>
      body.accountNumber
        ? result({
            bankAccountVerified: true,
            message: 'Account ok',
            verificationToken: `tok-${body.accountNumber}`,
          })
        : result({ ifscVerified: true }),
    );

  it('is never checked while the number is unconfirmed (the screen passes "")', async () => {
    verifiedIfsc();
    const { out } = mount({ ifsc: IFSC, account: '' });
    await flush(2000);
    expect(
      mockVerify.mock.calls.filter(call => call[0].accountNumber),
    ).toHaveLength(0);
    expect(out.current.accountPhase).toBe('idle');
    expect(out.current.verificationToken).toBeNull();
  });

  it('is checked once the IFSC is genuine and the number is confirmed, and gives its token', async () => {
    verifiedIfsc();
    const { out, update } = mount({ ifsc: IFSC, account: '' });
    await flush(400);
    update({ ifsc: IFSC, account: ACCOUNT });
    expect(out.current.accountPhase).toBe('verifying');
    expect(out.current.verifying).toBe(true);
    await flush(500);
    expect(mockVerify).toHaveBeenCalledWith(
      { ifsc: IFSC, accountNumber: ACCOUNT },
      expect.any(AbortSignal),
    );
    expect(out.current.accountPhase).toBe('verified');
    expect(out.current.accountMessage).toBe('Account ok');
    expect(out.current.verificationToken).toBe(`tok-${ACCOUNT}`);
  });

  it('never hands back a token for a number that is no longer in the form', async () => {
    verifiedIfsc();
    const { out, update } = mount({ ifsc: IFSC, account: '' });
    await flush(400);
    update({ ifsc: IFSC, account: ACCOUNT });
    await flush(500);
    expect(out.current.verificationToken).toBe(`tok-${ACCOUNT}`);
    update({ ifsc: IFSC, account: '999999999999' });
    expect(out.current.verificationToken).toBeNull();
    expect(out.current.accountPhase).toBe('verifying');
    // The buyer un-confirms the number: no token, and nothing left to wait for.
    update({ ifsc: IFSC, account: '' });
    expect(out.current.verificationToken).toBeNull();
    expect(out.current.accountPhase).toBe('idle');
  });

  it('drops the token when the IFSC changes', async () => {
    verifiedIfsc();
    const { out, update } = mount({ ifsc: IFSC, account: '' });
    await flush(400);
    update({ ifsc: IFSC, account: ACCOUNT });
    await flush(500);
    update({ ifsc: 'ICIC0001234', account: ACCOUNT });
    expect(out.current.verificationToken).toBeNull();
  });

  it('shows why an account was refused, with no token', async () => {
    mockVerify.mockImplementation(async (body: { accountNumber?: string }) =>
      body.accountNumber
        ? result({
            bankAccountVerified: false,
            message: 'Account not found',
            reason: 'ACCOUNT_NOT_FOUND',
          })
        : result({ ifscVerified: true }),
    );
    const { out, update } = mount({ ifsc: IFSC, account: '' });
    await flush(400);
    update({ ifsc: IFSC, account: ACCOUNT });
    await flush(500);
    expect(out.current.accountPhase).toBe('failed');
    expect(out.current.accountMessage).toBe('Account not found');
    expect(out.current.verificationToken).toBeNull();
  });

  it('lets saving go ahead, unverified, when the service cannot be reached', async () => {
    mockVerify.mockImplementation(async (body: { accountNumber?: string }) => {
      if (body.accountNumber) throw new Error('offline');
      return result({ ifscVerified: true });
    });
    const { out, update } = mount({ ifsc: IFSC, account: '' });
    await flush(400);
    update({ ifsc: IFSC, account: ACCOUNT });
    await flush(500);
    expect(out.current.accountPhase).toBe('error');
    expect(out.current.verifying).toBe(false);
    expect(out.current.verificationToken).toBeNull();
  });

  it('does not check a number of the wrong length', async () => {
    verifiedIfsc();
    const { out, update } = mount({ ifsc: IFSC, account: '' });
    await flush(400);
    update({ ifsc: IFSC, account: '12345678' });
    await flush(2000);
    expect(out.current.accountPhase).toBe('idle');
    expect(
      mockVerify.mock.calls.filter(call => call[0].accountNumber),
    ).toHaveLength(0);
  });
});
