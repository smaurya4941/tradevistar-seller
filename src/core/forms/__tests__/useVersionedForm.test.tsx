import { ApiError } from '@tradevistar/seller-api';
import React from 'react';
import { act, create } from 'react-test-renderer';
import { useVersionedForm, type VersionedForm } from '../useVersionedForm';

interface Server extends Record<string, unknown> {
  name: string;
  website: string | null;
  version: number;
}
interface Form extends Record<string, unknown> {
  name: string;
  website: string;
}

const toForm = (server: Server): Form => ({
  name: server.name,
  website: server.website ?? '',
});

function mount(options: {
  server: Server;
  save: (changes: Partial<Form>, version: number) => Promise<Server>;
  refetch: () => Promise<Server | undefined>;
}) {
  const out = { current: undefined as unknown as VersionedForm<Server, Form> };
  let current = options.server;
  function Probe({ server }: { server: Server }) {
    out.current = useVersionedForm<Server, Form>({
      server,
      toForm,
      save: options.save,
      refetch: options.refetch,
    });
    return null;
  }
  let renderer!: ReturnType<typeof create>;
  act(() => {
    renderer = create(<Probe server={current} />);
  });
  return {
    out,
    setServer: (next: Server) => {
      current = next;
      act(() => renderer.update(<Probe server={next} />));
    },
  };
}

const server: Server = { name: 'Acme', website: null, version: 3 };

describe('useVersionedForm', () => {
  it('is clean until a field really changes, and a blank equals missing', () => {
    const { out } = mount({ server, save: jest.fn(), refetch: jest.fn() });
    expect(out.current.dirty).toBe(false);
    act(() => out.current.setField('website', ''));
    expect(out.current.dirty).toBe(false);
    act(() => out.current.setField('name', 'Acme Exports'));
    expect(out.current.dirty).toBe(true);
    expect(out.current.changes).toEqual({ name: 'Acme Exports' });
  });

  it('sends only the changed fields with the version it read, then clears the edits', async () => {
    const save = jest.fn(async (_changes: Partial<Form>, _version: number) => ({
      ...server,
      name: 'Acme Exports',
      version: 4,
    }));
    const { out } = mount({ server, save, refetch: jest.fn() });
    act(() => out.current.setField('name', 'Acme Exports'));
    let result = '';
    await act(async () => {
      result = await out.current.submit();
    });
    expect(result).toBe('saved');
    expect(save).toHaveBeenCalledWith({ name: 'Acme Exports' }, 3);
    expect(out.current.dirty).toBe(false);
  });

  it('on a stale version refetches and keeps the seller’s edits on top of the new copy', async () => {
    const newer: Server = {
      name: 'Acme Ltd',
      website: 'https://acme.example',
      version: 5,
    };
    const save = jest.fn(async () => {
      throw new ApiError(409, {
        code: 'STALE_RESOURCE_VERSION',
        message: 'changed',
      });
    });
    const refetch = jest.fn(async () => newer);
    const { out, setServer } = mount({ server, save, refetch });
    act(() => out.current.setField('name', 'My edit'));
    let result = '';
    await act(async () => {
      result = await out.current.submit();
    });
    expect(result).toBe('stale');
    expect(refetch).toHaveBeenCalledTimes(1);
    expect(out.current.staleNotice).toBe(true);
    // The query delivers the newer copy: the edit stays, the untouched field takes the new value.
    setServer(newer);
    expect(out.current.form).toEqual({
      name: 'My edit',
      website: 'https://acme.example',
    });
    expect(out.current.dirty).toBe(true);
    expect(out.current.server?.version).toBe(5);
  });

  it('keeps the edits and reports the error when the save fails for another reason', async () => {
    const save = jest.fn(async () => {
      throw new ApiError(400, {
        code: 'VALIDATION',
        message: 'bad',
        details: ['website must start with http'],
      });
    });
    const { out } = mount({ server, save, refetch: jest.fn() });
    act(() => out.current.setField('website', 'nope'));
    let result = '';
    await act(async () => {
      result = await out.current.submit();
    });
    expect(result).toBe('failed');
    expect(out.current.error).toBeInstanceOf(ApiError);
    expect(out.current.form?.website).toBe('nope');
  });

  it('does nothing when nothing changed', async () => {
    const save = jest.fn();
    const { out } = mount({ server, save, refetch: jest.fn() });
    let result = '';
    await act(async () => {
      result = await out.current.submit();
    });
    expect(result).toBe('nothing');
    expect(save).not.toHaveBeenCalled();
  });
});
