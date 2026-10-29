/**
 * Android SMS User Consent: when the code SMS arrives, the system asks the buyer (one tap) to let
 * TradeVistar read that single message, and the code is filled in. No SMS permission is needed.
 * The SMS Retriever API is not used because DLT-registered templates cannot carry its app hash.
 *
 * Unavailable (iOS, no Play services, tests) resolves to "not listening"; the buyer types or
 * pastes the code instead.
 */
import { useEffect, useRef } from 'react';
import {
  DeviceEventEmitter,
  NativeModules,
  Platform,
  type EmitterSubscription,
} from 'react-native';
import { logger } from '@/core/logger';

interface SmsConsentNative {
  start(): Promise<boolean>;
  stop(): void;
}

export type SmsConsentEvent =
  | { type: 'code'; code: string }
  | { type: 'denied' }
  | { type: 'timeout' }
  | { type: 'error'; message?: string };

const native: SmsConsentNative | undefined =
  Platform.OS === 'android' ? NativeModules.TVSmsConsent : undefined;

export function isSmsConsentAvailable(): boolean {
  return Boolean(native);
}

/**
 * Listens for the code SMS while `enabled`. `listenKey` restarts listening (after a resend, the
 * consent window of five minutes starts again).
 */
export function useSmsConsent(
  enabled: boolean,
  listenKey: number,
  onCode: (code: string) => void,
): void {
  const onCodeRef = useRef(onCode);
  onCodeRef.current = onCode;

  useEffect(() => {
    if (!enabled || !native) return;
    let subscription: EmitterSubscription | null =
      DeviceEventEmitter.addListener(
        'TVSmsConsent',
        (event: SmsConsentEvent) => {
          if (event.type === 'code') onCodeRef.current(event.code);
          else if (event.type === 'error')
            logger.info('[sms] consent', event.message);
        },
      );
    native
      .start()
      .catch(error => logger.info('[sms] consent unavailable', error));
    return () => {
      subscription?.remove();
      subscription = null;
      native.stop();
    };
  }, [enabled, listenKey]);
}
