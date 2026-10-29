import { emitSellerEvent } from '@tradevistar/seller-api';
import {
  appConfigStore,
  decideLaunch,
  wireMaintenanceEvents,
} from '../appConfigStore';
import { bundledAppConfig } from '../appConfigService';
import {
  dismissMaintenanceBlock,
  maintenanceBlockStore,
} from '../maintenanceBlock';

const resolved = (
  verdict: 'force' | 'optional' | 'current',
  active = false,
) => ({
  verdict,
  config: { ...bundledAppConfig(), maintenance: { active, message: null } },
});

describe('decideLaunch', () => {
  it('lets a current app through', () => {
    expect(decideLaunch({ resolved: resolved('current') })).toEqual({
      screen: 'main',
      optionalUpdate: false,
    });
  });

  it('offers an optional update without blocking', () => {
    expect(decideLaunch({ resolved: resolved('optional') })).toEqual({
      screen: 'main',
      optionalUpdate: true,
    });
  });

  it('blocks an unsupported version', () => {
    expect(decideLaunch({ resolved: resolved('force') }).screen).toBe(
      'forceUpdate',
    );
  });

  it('shows maintenance when the remote config switches it on', () => {
    expect(decideLaunch({ resolved: resolved('current', true) }).screen).toBe(
      'maintenance',
    );
  });

  it('puts a force update ahead of maintenance', () => {
    expect(decideLaunch({ resolved: resolved('force', true) }).screen).toBe(
      'forceUpdate',
    );
  });
});

describe('a 503 MAINTENANCE_MODE response', () => {
  beforeAll(() => wireMaintenanceEvents());
  afterEach(() => dismissMaintenanceBlock());

  it('shows the server message and end time without blocking the app', () => {
    emitSellerEvent('notices:maintenance-paused', {
      code: 'MAINTENANCE_MODE',
      message: 'Back soon',
      details: { endsAt: '2026-10-20T10:00:00.000Z' },
    });

    expect(maintenanceBlockStore.get()).toMatchObject({
      message: 'Back soon',
      endsAt: '2026-10-20T10:00:00.000Z',
    });
    expect(decideLaunch(appConfigStore.get()).screen).toBe('main');
  });

  it('copes with a refusal that carries no details', () => {
    emitSellerEvent('notices:maintenance-paused');
    expect(maintenanceBlockStore.get()).toMatchObject({
      message: null,
      endsAt: null,
    });
  });

  it('shows again for a second refusal with the same text', () => {
    emitSellerEvent('notices:maintenance-paused');
    const first = maintenanceBlockStore.get()?.seq;
    emitSellerEvent('notices:maintenance-paused');
    expect(maintenanceBlockStore.get()?.seq).not.toBe(first);
  });
});
