/** Opening support from the signed-out screens: email always, phone when the build has one. */
import { Linking } from 'react-native';
import { env } from '@/config/env';
import { logger } from '@/core/logger';

export function openSupportEmail(subject?: string): void {
  const query = subject ? `?subject=${encodeURIComponent(subject)}` : '';
  Linking.openURL(`mailto:${env.supportEmail}${query}`).catch(error =>
    logger.info('[support] no mail app', error),
  );
}

export function openSupportPhone(): void {
  if (!env.supportPhone) return;
  Linking.openURL(`tel:${env.supportPhone.replace(/\s+/g, '')}`).catch(error =>
    logger.info('[support] no dialer', error),
  );
}

export function openWebLink(url: string): void {
  Linking.openURL(url).catch(error =>
    logger.info('[links] cannot open', error),
  );
}
