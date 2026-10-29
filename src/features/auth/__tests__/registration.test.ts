import { ApiError, REGISTER_TICKET_TTL_MS } from '@tradevistar/seller-api';
import { deviceStorage, DeviceKeys } from '@/core/storage/kv';
import { translate } from '@/i18n';
import {
  clearDraft,
  draftNeedsPassword,
  EMPTY_DRAFT,
  emailVerified,
  persistedFields,
  phoneVerified,
  registrationDraft,
  updateDraft,
  type RegistrationDraft,
} from '../registration/registrationDraft';
import {
  buildRegistrationInput,
  businessErrors,
  firstUnverifiedStep,
  idempotencyKeyFor,
  submitRegistration,
} from '../registration/registrationFlow';

const t = (
  key: Parameters<typeof translate>[1],
  values?: Record<string, string | number>,
) => translate('en', key, values);

const NOW = Date.UTC(2026, 9, 20, 10, 0, 0);

function verifiedDraft(
  extra: Partial<RegistrationDraft> = {},
): RegistrationDraft {
  return {
    ...EMPTY_DRAFT,
    mobile: '9876543210',
    email: 'owner@acme.in',
    password: 'secret-pass',
    confirmPassword: 'secret-pass',
    companyName: ' Acme Traders ',
    gstin: '27AAPFU0939F1ZV',
    countryCode: 'IN',
    categoryCode: 'textiles',
    phoneTicket: {
      value: 'phone-ticket',
      identifier: '9876543210',
      issuedAt: NOW,
    },
    emailTicket: {
      value: 'email-ticket',
      identifier: 'owner@acme.in',
      issuedAt: NOW,
    },
    ...extra,
  };
}

describe('the registration draft on the device', () => {
  beforeEach(() => clearDraft());

  it('never writes a password or a ticket', () => {
    updateDraft(verifiedDraft());

    const saved = JSON.parse(
      deviceStorage.getString(DeviceKeys.registrationDraft) ?? '{}',
    ) as Record<string, unknown>;

    expect(saved).toMatchObject({
      mobile: '9876543210',
      email: 'owner@acme.in',
      companyName: ' Acme Traders ',
    });
    const text = JSON.stringify(saved);
    expect(text).not.toContain('secret-pass');
    expect(text).not.toContain('phone-ticket');
    expect(text).not.toContain('email-ticket');
    expect(saved).not.toHaveProperty('password');
    expect(saved).not.toHaveProperty('phoneTicket');
  });

  it('persistedFields lists only the non-secret fields', () => {
    expect(Object.keys(persistedFields(verifiedDraft())).sort()).toEqual([
      'categoryCode',
      'categoryName',
      'companyName',
      'countryCode',
      'countryName',
      'email',
      'gstin',
      'mobile',
    ]);
  });

  it('clearing forgets everything, including what was saved', () => {
    updateDraft(verifiedDraft());
    clearDraft();
    expect(registrationDraft.get()).toEqual(EMPTY_DRAFT);
    expect(
      deviceStorage.getString(DeviceKeys.registrationDraft),
    ).toBeUndefined();
  });
});

describe('verification state', () => {
  it('needs a ticket for the identifier as it stands now', () => {
    const draft = verifiedDraft();
    expect(phoneVerified(draft, NOW)).toBe(true);
    expect(emailVerified(draft, NOW)).toBe(true);
    // Editing the number after verifying invalidates it.
    expect(phoneVerified({ ...draft, mobile: '9123456789' }, NOW)).toBe(false);
  });

  it('expires after the ticket life', () => {
    const draft = verifiedDraft();
    expect(firstUnverifiedStep(draft, NOW + REGISTER_TICKET_TTL_MS)).toBe(
      'mobile',
    );
    expect(
      firstUnverifiedStep(
        {
          ...draft,
          phoneTicket: { ...draft.phoneTicket!, issuedAt: NOW + 1_000_000 },
        },
        NOW + REGISTER_TICKET_TTL_MS,
      ),
    ).toBe('email');
  });

  it('asks for a password unless the joined account already has one', () => {
    expect(draftNeedsPassword(verifiedDraft())).toBe(true);
    expect(
      draftNeedsPassword(
        verifiedDraft({ emailExisting: true, emailPasswordSet: true }),
      ),
    ).toBe(false);
    expect(draftNeedsPassword(verifiedDraft({ phoneExisting: true }))).toBe(
      true,
    );
  });
});

describe('the request', () => {
  it('sends everything the endpoint needs, trimmed', () => {
    expect(buildRegistrationInput(verifiedDraft(), NOW)).toEqual({
      phone: '9876543210',
      email: 'owner@acme.in',
      password: 'secret-pass',
      phoneTicket: 'phone-ticket',
      emailTicket: 'email-ticket',
      companyName: 'Acme Traders',
      gstin: '27AAPFU0939F1ZV',
      categoryCode: 'textiles',
      businessCountryCode: 'IN',
    });
  });

  it('omits the password for an account that keeps its own, and empty optional fields', () => {
    const input = buildRegistrationInput(
      verifiedDraft({
        phonePasswordSet: true,
        phoneExisting: true,
        gstin: '',
        categoryCode: '',
      }),
      NOW,
    );
    expect(input).not.toHaveProperty('password');
    expect(input).not.toHaveProperty('gstin');
    expect(input).not.toHaveProperty('categoryCode');
  });

  it('is not built without good tickets', () => {
    expect(
      buildRegistrationInput(verifiedDraft({ emailTicket: null }), NOW),
    ).toBeNull();
  });

  it('reuses the key for an identical payload and mints a new one when it changes', () => {
    clearDraft();
    updateDraft(verifiedDraft());
    let n = 0;
    const mint = () => `key-${++n}`;
    const input = buildRegistrationInput(registrationDraft.get(), NOW)!;

    const first = idempotencyKeyFor(registrationDraft.get(), input, mint);
    const again = idempotencyKeyFor(registrationDraft.get(), input, mint);
    const changed = idempotencyKeyFor(
      registrationDraft.get(),
      { ...input, companyName: 'Other' },
      mint,
    );

    expect(first).toBe('key-1');
    expect(again).toBe('key-1');
    expect(changed).toBe('key-2');
  });
});

describe('business details', () => {
  it('requires a company name and a country, and validates a GSTIN when given', () => {
    expect(
      businessErrors({ companyName: '  ', gstin: '', countryCode: '' }, t),
    ).toEqual({
      companyName: 'Company name is required.',
      country: 'Please select your business country.',
    });
    expect(
      businessErrors(
        { companyName: 'Acme', gstin: '27AAPFU0939F1ZX', countryCode: 'IN' },
        t,
      ).gstin,
    ).toBeTruthy();
    expect(
      businessErrors({ companyName: 'Acme', gstin: '', countryCode: 'IN' }, t),
    ).toEqual({});
  });
});

describe('submitting', () => {
  beforeEach(() => clearDraft());

  const newKey = () => 'generated-key';

  it('sends the registration and clears the draft on success', async () => {
    updateDraft(verifiedDraft());
    const api = {
      registerSeller: jest.fn(async () => ({
        registered: true as const,
        approvalStatus: 'PENDING' as const,
        linkedExistingAccount: true,
      })),
    };

    const outcome = await submitRegistration(
      api,
      registrationDraft.get(),
      newKey,
      t,
      NOW,
    );

    expect(outcome).toEqual({ kind: 'done', linked: true });
    expect(api.registerSeller).toHaveBeenCalledWith(
      expect.objectContaining({ phoneTicket: 'phone-ticket' }),
      'generated-key',
    );
    expect(registrationDraft.get()).toEqual(EMPTY_DRAFT);
  });

  it('sends the seller back to an expired verification without calling the server', async () => {
    const api = { registerSeller: jest.fn() };
    const draft = verifiedDraft({
      emailTicket: {
        value: 'e',
        identifier: 'owner@acme.in',
        issuedAt: NOW - REGISTER_TICKET_TTL_MS,
      },
    });

    const outcome = await submitRegistration(api, draft, newKey, t, NOW);

    expect(outcome).toMatchObject({ kind: 'verify', step: 'email' });
    expect(api.registerSeller).not.toHaveBeenCalled();
  });

  it('clears both tickets when the server refuses one, and returns to the first step', async () => {
    updateDraft(verifiedDraft());
    const api = {
      registerSeller: jest.fn(async () => {
        throw new ApiError(401, {
          code: 'UNAUTHORIZED',
          message: 'Verification ticket was already used',
        });
      }),
    };

    const outcome = await submitRegistration(
      api,
      registrationDraft.get(),
      newKey,
      t,
      NOW,
    );

    expect(outcome).toMatchObject({ kind: 'verify', step: 'mobile' });
    expect(registrationDraft.get().phoneTicket).toBeNull();
    expect(registrationDraft.get().emailTicket).toBeNull();
    // What the seller typed is kept.
    expect(registrationDraft.get().companyName).toBe(' Acme Traders ');
  });

  it('routes a conflict to the step that owns the identifier', async () => {
    const make = (message: string) => ({
      registerSeller: jest.fn(async () => {
        throw new ApiError(409, { code: 'CONFLICT', message });
      }),
    });
    expect(
      await submitRegistration(
        make('An account with this email already exists'),
        verifiedDraft(),
        newKey,
        t,
        NOW,
      ),
    ).toMatchObject({ kind: 'conflict', step: 'email' });
    expect(
      await submitRegistration(
        make('An account with this mobile number already exists'),
        verifiedDraft(),
        newKey,
        t,
        NOW,
      ),
    ).toMatchObject({ kind: 'conflict', step: 'mobile' });
  });

  it('keeps the form on a network failure', async () => {
    const api = {
      registerSeller: jest.fn(async () => {
        throw new ApiError(0, { code: 'NETWORK_ERROR', message: 'offline' });
      }),
    };
    updateDraft(verifiedDraft());

    const outcome = await submitRegistration(
      api,
      registrationDraft.get(),
      newKey,
      t,
      NOW,
    );

    expect(outcome).toMatchObject({
      kind: 'failed',
      error: { kind: 'network' },
    });
    expect(registrationDraft.get().companyName).toBe(' Acme Traders ');
  });
});
