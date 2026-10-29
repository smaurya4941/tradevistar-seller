import type {
  BankAccountView,
  CompanyDocumentView,
  KycChangeRequest,
  ProfileRequirement,
} from '@tradevistar/seller-api';
import React from 'react';
import { act, create } from 'react-test-renderer';
import { BankCard } from '../components/BankCard';
import { CompletionRing } from '../components/CompletionRing';
import { DocumentCard } from '../components/DocumentCards';
import { orderedMissing } from '../ProfileHubScreen';
import { rowsToHours } from '../WorkingHoursScreen';

jest.mock('react-native-safe-area-context', () => ({
  useSafeAreaInsets: () => ({ top: 0, bottom: 0, left: 0, right: 0 }),
}));

function render(element: React.ReactElement) {
  let renderer!: ReturnType<typeof create>;
  act(() => {
    renderer = create(element);
  });
  return renderer;
}

/** Every string a tree shows or speaks, so a test can look for words without relying on structure. */
function words(node: unknown): string {
  const out: string[] = [];
  const visit = (value: unknown) => {
    if (typeof value === 'string') out.push(value);
    else if (Array.isArray(value)) value.forEach(visit);
    else if (value && typeof value === 'object') {
      const item = value as {
        children?: unknown;
        props?: Record<string, unknown>;
      };
      for (const prop of ['accessibilityLabel', 'testID']) {
        if (typeof item.props?.[prop] === 'string')
          out.push(String(item.props[prop]));
      }
      visit(item.children);
    }
  };
  visit(node);
  return out.join(' | ');
}

const doc = (
  patch: Partial<CompanyDocumentView> = {},
): CompanyDocumentView => ({
  id: 'd1',
  mediaAssetId: 'm1',
  documentType: 'PAN_CARD',
  label: null,
  documentNumber: null,
  fileName: 'pan.pdf',
  fileUrl: null,
  mimeType: 'application/pdf',
  sizeBytes: 250_000,
  uploadedByUserId: 'u1',
  uploadedByName: 'Asha',
  uploadedAt: '2026-10-01T00:00:00Z',
  verificationState: 'PENDING',
  verifiedAt: null,
  rejectionReason: null,
  expiresOn: null,
  isExpired: false,
  version: 1,
  isActive: true,
  ...patch,
});

const request = (status: KycChangeRequest['status']): KycChangeRequest => ({
  id: 'r1',
  documentType: 'PAN_CARD',
  reason: 'wrong file',
  status,
  decisionNote: null,
  ticketId: null,
  createdAt: '2026-10-02T00:00:00Z',
});

const handlers = {
  onUpload: jest.fn(),
  onView: jest.fn(),
  onRemove: jest.fn(),
  onRequestChange: jest.fn(),
};

function card(
  document: CompanyDocumentView | null,
  req: KycChangeRequest | null = null,
) {
  return words(
    render(
      <DocumentCard
        type="PAN_CARD"
        required
        document={document}
        request={req}
        {...handlers}
      />,
    ).toJSON(),
  );
}

describe('DocumentCard', () => {
  it('offers only Upload for a missing document', () => {
    const text = card(null);
    expect(text).toContain('Not uploaded');
    expect(text).toContain('doc-PAN_CARD-upload');
    expect(text).not.toContain('doc-PAN_CARD-view');
    expect(text).not.toContain('doc-PAN_CARD-remove');
  });

  it('lets an uploaded document be viewed, replaced and removed', () => {
    const text = card(doc());
    expect(text).toContain('Uploaded');
    expect(text).toContain('pan.pdf');
    for (const id of ['view', 'upload', 'remove'])
      expect(text).toContain(`doc-PAN_CARD-${id}`);
    expect(text).not.toContain('doc-PAN_CARD-change');
  });

  it('shows the rejection reason', () => {
    expect(
      card(
        doc({ verificationState: 'REJECTED', rejectionReason: 'Blurry scan' }),
      ),
    ).toContain('Rejected: Blurry scan');
  });

  it('flags an expired document', () => {
    const text = card(doc({ isExpired: true, expiresOn: '2026-01-01' }));
    expect(text).toContain('Expired');
  });

  it('locks a verified document and offers Request change instead of Remove or Replace', () => {
    const text = card(doc({ verificationState: 'VERIFIED' }));
    expect(text).toContain('Verified');
    expect(text).toContain('doc-PAN_CARD-change');
    expect(text).not.toContain('doc-PAN_CARD-remove');
    expect(text).not.toContain('doc-PAN_CARD-upload');
  });

  it('shows a pending change request without a second request button', () => {
    const text = card(
      doc({ verificationState: 'VERIFIED' }),
      request('PENDING'),
    );
    expect(text).toContain('Change requested');
    expect(text).not.toContain('doc-PAN_CARD-change');
  });

  it('allows one replacement upload once a change is approved', () => {
    const text = card(
      doc({ verificationState: 'VERIFIED' }),
      request('APPROVED'),
    );
    expect(text).toContain('Change approved');
    expect(text).toContain('Upload new file');
    expect(text).not.toContain('doc-PAN_CARD-remove');
  });

  it('shows an archived file as archived with no actions that change it', () => {
    const text = card(doc({ isActive: false }));
    expect(text).toContain('Archived');
    expect(text).not.toContain('doc-PAN_CARD-upload');
    expect(text).not.toContain('doc-PAN_CARD-remove');
  });
});

const bank = (patch: Partial<BankAccountView> = {}): BankAccountView => ({
  id: 'b1',
  holderName: 'Asha Traders',
  bankName: 'HDFC Bank',
  branch: 'Pune',
  accountNumberMasked: 'XXXXXX9012',
  ifsc: 'HDFC0001234',
  accountType: 'CURRENT',
  countryCode: 'IN',
  currency: 'INR',
  status: 'VERIFIED',
  isPrimary: false,
  settlementEnabled: true,
  verifiedAt: null,
  failureReason: null,
  automaticPayoutLinked: false,
  automaticPayoutsAvailable: true,
  version: 1,
  createdAt: '2026-10-01T00:00:00Z',
  ...patch,
});

function bankText(account: BankAccountView) {
  return words(
    render(
      <BankCard
        account={account}
        onMakePrimary={jest.fn()}
        onLinkPayouts={jest.fn()}
        onHistory={jest.fn()}
        onRemove={jest.fn()}
      />,
    ).toJSON(),
  );
}

describe('BankCard', () => {
  it('offers settlement and payout linking on a verified account', () => {
    const text = bankText(bank());
    expect(text).toContain('XXXXXX9012');
    expect(text).toContain('bank-b1-primary');
    expect(text).toContain('bank-b1-link');
    expect(text).not.toContain('Cannot receive settlements yet');
  });

  it('badges the settlement account and linked payouts, and hides their actions', () => {
    const text = bankText(
      bank({ isPrimary: true, automaticPayoutLinked: true }),
    );
    expect(text).toContain('Settlement account');
    expect(text).toContain('Automatic payouts on');
    expect(text).not.toContain('bank-b1-primary');
    expect(text).not.toContain('bank-b1-link');
  });

  it('says an unverified account cannot receive settlements yet', () => {
    const text = bankText(
      bank({ status: 'PENDING_VERIFICATION', settlementEnabled: false }),
    );
    expect(text).toContain('Cannot receive settlements yet');
    expect(text).not.toContain('bank-b1-primary');
    expect(text).not.toContain('bank-b1-link');
  });

  it('hides payout linking when the platform has automatic payouts off', () => {
    expect(bankText(bank({ automaticPayoutsAvailable: false }))).not.toContain(
      'bank-b1-link',
    );
  });

  it('shows the failure reason', () => {
    expect(
      bankText(
        bank({
          status: 'FAILED',
          failureReason: 'Name does not match',
          settlementEnabled: false,
        }),
      ),
    ).toContain('Name does not match');
  });
});

describe('CompletionRing', () => {
  it('speaks the percent as a progress value', () => {
    const text = JSON.stringify(
      render(
        <CompletionRing percent={60} label="Profile 60% complete" />,
      ).toJSON(),
    );
    expect(text).toContain('Profile 60% complete');
    expect(text).toContain('"now":60');
  });

  it('clamps out-of-range values', () => {
    expect(
      JSON.stringify(
        render(<CompletionRing percent={140} label="x" />).toJSON(),
      ),
    ).toContain('"now":100');
    expect(
      JSON.stringify(
        render(<CompletionRing percent={-5} label="x" />).toJSON(),
      ),
    ).toContain('"now":0');
  });
});

describe('profile checklist order', () => {
  const item = (
    key: string,
    blocking: boolean,
    complete: boolean,
  ): ProfileRequirement => ({
    key,
    label: key,
    description: '',
    href: `/seller/dashboard/profile/${key}`,
    blocking,
    complete,
  });
  it('puts blocking items first and drops completed ones', () => {
    const ordered = orderedMissing([
      item('a', false, false),
      item('b', true, false),
      item('c', true, true),
      item('d', false, false),
    ]);
    expect(ordered.map(entry => entry.key)).toEqual(['b', 'a', 'd']);
  });
});

describe('working hours rows', () => {
  it('turns typed times into minutes and flags closing before opening', () => {
    const { hours, errors } = rowsToHours([
      { dayOfWeek: 1, isClosed: false, opens: '09:00', closes: '18:00' },
      { dayOfWeek: 2, isClosed: false, opens: '10:00', closes: '09:00' },
      { dayOfWeek: 3, isClosed: false, opens: '9', closes: '18:00' },
      { dayOfWeek: 4, isClosed: true, opens: 'xx', closes: 'yy' },
    ]);
    expect(hours[0]).toMatchObject({
      opensAtMinutes: 540,
      closesAtMinutes: 1080,
    });
    expect(errors).toEqual({ 2: 'order', 3: 'time' });
  });
});
