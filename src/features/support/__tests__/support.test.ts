import {
  ApiError,
  type SupportTicket,
  type SupportTicketDetail,
} from '@tradevistar/seller-api';
import { sortAnnouncements } from '../components/Announcements';
import {
  filterFaqs,
  forgetVote,
  groupFaqs,
  hasVoted,
  rememberVote,
  resetViewedForTests,
  shouldCountView,
} from '../knowledge';
import { isAmbiguousFailure, ReplySender, TicketCreator } from '../writes';
import {
  clearTicketDraft,
  isBlankDraft,
  loadTicketDraft,
  saveTicketDraft,
} from '../ticketDraft';

const ticket = (over: Partial<SupportTicket> = {}): SupportTicket => ({
  id: 't1',
  ticketNumber: 'TKT-1',
  subject: 'Payout missing',
  message: 'My payout has not arrived',
  orderId: null,
  orderNumber: null,
  category: 'PAYMENTS',
  priority: 'NORMAL',
  status: 'OPEN',
  messageCount: 1,
  rating: null,
  ratingComment: null,
  changeRequest: null,
  lastActivityAt: '2026-10-22T10:00:10Z',
  createdAt: '2026-10-22T10:00:10Z',
  ...over,
});

const timeout = () =>
  new ApiError(0, { code: 'NETWORK_ERROR', message: 'timeout' });
const refusal = () => new ApiError(422, { code: 'VALIDATION', message: 'bad' });

describe('failures that leave a write in doubt', () => {
  it('treats a lost connection, a timeout, a throttle and a 5xx as ambiguous', () => {
    expect(isAmbiguousFailure(timeout())).toBe(true);
    expect(
      isAmbiguousFailure(new ApiError(503, { code: 'X', message: '' })),
    ).toBe(true);
    expect(
      isAmbiguousFailure(new ApiError(429, { code: 'X', message: '' })),
    ).toBe(true);
    expect(isAmbiguousFailure(new Error('boom'))).toBe(true);
  });

  it('treats a refusal as certain', () => {
    expect(isAmbiguousFailure(refusal())).toBe(false);
    expect(
      isAmbiguousFailure(new ApiError(409, { code: 'X', message: '' })),
    ).toBe(false);
  });
});

describe('TicketCreator', () => {
  const body = {
    subject: 'Payout missing',
    message: 'My payout has not arrived',
    category: 'PAYMENTS',
  };

  it('creates the ticket and does not look first', async () => {
    const recent = jest.fn(async () => []);
    const create = jest.fn(async () => ticket());
    const creator = new TicketCreator({ create, recent });
    await expect(creator.submit(body)).resolves.toMatchObject({ id: 't1' });
    expect(recent).not.toHaveBeenCalled();
  });

  it('after a timeout, finds the ticket that did get through instead of posting twice', async () => {
    const create = jest.fn().mockRejectedValueOnce(timeout());
    const recent = jest.fn(async () => [
      ticket({ createdAt: new Date(Date.now() + 5_000).toISOString() }),
    ]);
    const creator = new TicketCreator({ create, recent });
    await expect(creator.submit(body)).rejects.toBeInstanceOf(ApiError);
    const made = await creator.submit(body);
    expect(made.id).toBe('t1');
    expect(create).toHaveBeenCalledTimes(1);
  });

  it('after a timeout, sends again when the ticket is not there', async () => {
    const create = jest
      .fn()
      .mockRejectedValueOnce(timeout())
      .mockResolvedValueOnce(ticket({ id: 't2' }));
    const creator = new TicketCreator({ create, recent: async () => [] });
    await expect(creator.submit(body)).rejects.toBeInstanceOf(ApiError);
    await expect(creator.submit(body)).resolves.toMatchObject({ id: 't2' });
    expect(create).toHaveBeenCalledTimes(2);
  });

  it('does not mistake an older identical ticket for the new one', async () => {
    const create = jest
      .fn()
      .mockRejectedValueOnce(timeout())
      .mockResolvedValueOnce(ticket({ id: 't3' }));
    const old = ticket({ createdAt: '2020-01-01T00:00:00Z' });
    const creator = new TicketCreator({ create, recent: async () => [old] });
    await expect(creator.submit(body)).rejects.toBeInstanceOf(ApiError);
    await expect(creator.submit(body)).resolves.toMatchObject({ id: 't3' });
  });

  it('sends straight away after a refusal, and for a different ticket', async () => {
    const create = jest
      .fn()
      .mockRejectedValueOnce(refusal())
      .mockResolvedValueOnce(ticket());
    const recent = jest.fn(async () => []);
    const creator = new TicketCreator({ create, recent });
    await expect(creator.submit(body)).rejects.toBeInstanceOf(ApiError);
    await creator.submit(body);
    expect(recent).not.toHaveBeenCalled();
  });

  it('sends when the look-up itself fails', async () => {
    const create = jest
      .fn()
      .mockRejectedValueOnce(timeout())
      .mockResolvedValueOnce(ticket({ id: 't4' }));
    const creator = new TicketCreator({
      create,
      recent: async () => {
        throw timeout();
      },
    });
    await expect(creator.submit(body)).rejects.toBeInstanceOf(ApiError);
    await expect(creator.submit(body)).resolves.toMatchObject({ id: 't4' });
  });
});

describe('ReplySender', () => {
  const detail = (
    messages: SupportTicketDetail['messages'],
  ): SupportTicketDetail =>
    ({ ...ticket(), messages, events: [] } as SupportTicketDetail);

  it('after a timeout, does not post the reply again when it is already in the thread', async () => {
    const reply = jest.fn().mockRejectedValueOnce(timeout());
    const posted = detail([
      {
        id: 'm1',
        body: 'Thanks',
        authorUserId: 'me',
        fromSupport: false,
        createdAt: new Date(Date.now() + 5_000).toISOString(),
      },
    ]);
    const sender = new ReplySender({ reply, thread: async () => posted });
    await expect(sender.send('t1', 'Thanks')).rejects.toBeInstanceOf(ApiError);
    await expect(sender.send('t1', ' Thanks ')).resolves.toBe(posted);
    expect(reply).toHaveBeenCalledTimes(1);
  });

  it('sends again when the thread does not have it', async () => {
    const after = detail([]);
    const reply = jest
      .fn()
      .mockRejectedValueOnce(timeout())
      .mockResolvedValueOnce(after);
    const sender = new ReplySender({ reply, thread: async () => detail([]) });
    await expect(sender.send('t1', 'Thanks')).rejects.toBeInstanceOf(ApiError);
    await expect(sender.send('t1', 'Thanks')).resolves.toBe(after);
    expect(reply).toHaveBeenCalledTimes(2);
  });

  it('a different reply is never confused with the one in doubt', async () => {
    const thread = jest.fn(async () => detail([]));
    const reply = jest
      .fn()
      .mockRejectedValueOnce(timeout())
      .mockResolvedValueOnce(detail([]));
    const sender = new ReplySender({ reply, thread });
    await expect(sender.send('t1', 'One')).rejects.toBeInstanceOf(ApiError);
    await sender.send('t1', 'Two');
    expect(thread).not.toHaveBeenCalled();
  });
});

describe('knowledge base', () => {
  const faqs = [
    {
      id: '1',
      slug: 'a',
      category: 'PAYMENTS',
      q: 'When is my payout?',
      a: 'Every Friday after delivery.',
    },
    {
      id: '2',
      slug: 'b',
      category: 'ORDERS',
      q: 'How do I ship?',
      a: 'Print the label and hand over.',
    },
    {
      id: '3',
      slug: 'c',
      category: 'PAYMENTS',
      q: 'What is escrow?',
      a: 'Held until the buyer receives goods.',
    },
  ];

  it('searches question and answer text, every word', () => {
    expect(filterFaqs(faqs, 'payout friday').map(f => f.id)).toEqual(['1']);
    expect(filterFaqs(faqs, 'ESCROW').map(f => f.id)).toEqual(['3']);
    expect(filterFaqs(faqs, '   ')).toHaveLength(3);
    expect(filterFaqs(faqs, 'zzz')).toEqual([]);
  });

  it('groups by category in the order they first appear, with readable titles', () => {
    const groups = groupFaqs(faqs);
    expect(groups.map(g => [g.title, g.faqs.length])).toEqual([
      ['Payments', 2],
      ['Orders', 1],
    ]);
    expect(groupFaqs([{ ...faqs[0], category: '' }])[0].title).toBe('General');
  });

  it('counts an article view once per session', () => {
    resetViewedForTests();
    expect(shouldCountView('1')).toBe(true);
    expect(shouldCountView('1')).toBe(false);
    expect(shouldCountView('2')).toBe(true);
  });

  it('remembers a helpful vote so it is sent once, and lets a failed vote be retried', () => {
    expect(hasVoted('x')).toBe(false);
    expect(rememberVote('x')).toBe(true);
    expect(hasVoted('x')).toBe(true);
    expect(rememberVote('x')).toBe(false);
    forgetVote('x');
    expect(hasVoted('x')).toBe(false);
  });

  it('puts pinned announcements first, then the newest', () => {
    const sorted = sortAnnouncements([
      {
        id: 'a',
        title: '',
        body: '',
        isPinned: false,
        publishAt: '2026-10-20',
        expiresAt: null,
      },
      {
        id: 'b',
        title: '',
        body: '',
        isPinned: true,
        publishAt: '2026-09-01',
        expiresAt: null,
      },
      {
        id: 'c',
        title: '',
        body: '',
        isPinned: false,
        publishAt: '2026-10-21',
        expiresAt: null,
      },
    ]);
    expect(sorted.map(item => item.id)).toEqual(['b', 'c', 'a']);
  });
});

describe('ticket draft', () => {
  it('keeps what was typed and restores it', () => {
    clearTicketDraft();
    expect(isBlankDraft(loadTicketDraft())).toBe(true);
    saveTicketDraft({
      subject: 'Help',
      category: 'ORDER',
      message: 'Where is my order',
    });
    expect(loadTicketDraft()).toEqual({
      subject: 'Help',
      category: 'ORDER',
      message: 'Where is my order',
    });
  });

  it('does not keep an empty form', () => {
    saveTicketDraft({ subject: 'Help', category: '', message: '' });
    saveTicketDraft({ subject: '  ', category: '', message: '' });
    expect(isBlankDraft(loadTicketDraft())).toBe(true);
  });

  it('clears once the ticket is sent', () => {
    saveTicketDraft({ subject: 'Help', category: 'ORDER', message: 'x' });
    clearTicketDraft();
    expect(isBlankDraft(loadTicketDraft())).toBe(true);
  });
});
